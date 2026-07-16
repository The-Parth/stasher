/**
 * crypto.ts
 * Browser-native WebCrypto utilities for AES-GCM and Key Wrapping.
 */

import type { EncryptedPayload, EncryptedPayloadV1, EncryptedPayloadV2 } from './types';

const PBKDF2_ITERATIONS = 250_000;
const KEY_LENGTH = 256;
const SALT_LENGTH = 16; // bytes
const IV_LENGTH = 12;   // bytes (96-bit for AES-GCM)

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str);
}

export function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─── Key Derivation ──────────────────────────────────────────────────────────

async function deriveKeyGCM(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false, ['encrypt', 'decrypt']
  );
}

async function deriveKeyKW(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-KW', length: KEY_LENGTH },
    false, ['wrapKey', 'unwrapKey']
  );
}

// ─── Auth Hashes ─────────────────────────────────────────────────────────────

export async function generateEditToken(password: string, stashId: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + stashId);
  const hashBuf = await crypto.subtle.digest('SHA-256', data);
  return bufToB64(hashBuf);
}

export async function hashEditToken(tokenB64: string, saltB64: string): Promise<string> {
  const token = b64ToBuf(tokenB64);
  const salt = b64ToBuf(saltB64);
  const combined = new Uint8Array(token.byteLength + salt.byteLength);
  combined.set(new Uint8Array(token), 0);
  combined.set(new Uint8Array(salt), token.byteLength);
  
  const hashBuf = await crypto.subtle.digest('SHA-256', combined);
  return bufToB64(hashBuf);
}

// ─── Key Wrapping ────────────────────────────────────────────────────────────

export async function generateMasterKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: 'AES-GCM', length: KEY_LENGTH },
    true, // extractable!
    ['encrypt', 'decrypt']
  );
}

export async function wrapMasterKey(masterKey: CryptoKey, password: string): Promise<{ salt: string, wrappedKey: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const kw = await deriveKeyKW(password, salt);
  const wrapped = await crypto.subtle.wrapKey('raw', masterKey, kw, 'AES-KW');
  return {
    salt: bufToB64(salt.buffer),
    wrappedKey: bufToB64(wrapped)
  };
}

export async function unwrapMasterKey(wrappedKeyB64: string, password: string, saltB64: string): Promise<CryptoKey> {
  const salt = new Uint8Array(b64ToBuf(saltB64));
  const wrappedKeyBuf = b64ToBuf(wrappedKeyB64);
  const kw = await deriveKeyKW(password, salt);
  return crypto.subtle.unwrapKey(
    'raw',
    wrappedKeyBuf,
    kw,
    'AES-KW',
    { name: 'AES-GCM', length: KEY_LENGTH },
    true, // extractable
    ['encrypt', 'decrypt']
  );
}

// ─── Encrypt (V1 - Legacy backward compatibility on save if not v2) ──────────

export interface EncryptResultV1 {
  salt: string;
  iv: string;
  ciphertext: string;
}

export async function encryptV1(data: object, password: string): Promise<EncryptResultV1> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKeyGCM(password, salt);
  const plaintext = encoder.encode(JSON.stringify(data));
  const ciphertextBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    salt: bufToB64(salt.buffer),
    iv: bufToB64(iv.buffer),
    ciphertext: bufToB64(ciphertextBuf),
  };
}

// ─── Encrypt (V2) ────────────────────────────────────────────────────────────

export async function encryptV2(
  data: object,
  stashId: string,
  adminPassword: string,
  readPassword?: string
): Promise<EncryptedPayloadV2> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const masterKey = await generateMasterKey();
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    plaintext
  );

  const { salt: masterSalt, wrappedKey: masterWrappedKey } = await wrapMasterKey(masterKey, adminPassword);
  
  let readSalt, readWrappedKey;
  if (readPassword) {
    const wrapped = await wrapMasterKey(masterKey, readPassword);
    readSalt = wrapped.salt;
    readWrappedKey = wrapped.wrappedKey;
  }

  const editToken = await generateEditToken(adminPassword, stashId);
  const authSalt = bufToB64(crypto.getRandomValues(new Uint8Array(SALT_LENGTH)));
  const authVerifyHash = await hashEditToken(editToken, authSalt);

  return {
    schemaVersion: 2,
    stashId,
    iv: bufToB64(iv.buffer),
    ciphertext: bufToB64(ciphertextBuf),
    masterSalt,
    masterWrappedKey,
    authVerifyHash,
    authSalt,
    ...(readSalt && readWrappedKey ? { readSalt, readWrappedKey } : {})
  };
}

// ─── Decrypt (Handles V1 and V2) ─────────────────────────────────────────────

export interface DecryptResult<T> {
  data: T;
  role: 'admin' | 'read';
  masterKey?: CryptoKey; // Returned only if admin
  editToken?: string;    // Returned only if admin
}

export async function decrypt<T = unknown>(
  payload: EncryptedPayload,
  password: string
): Promise<DecryptResult<T>> {
  if (payload.schemaVersion === 1) {
    const p1 = payload as EncryptedPayloadV1;
    const salt = new Uint8Array(b64ToBuf(p1.salt));
    const iv = new Uint8Array(b64ToBuf(p1.iv));
    const ciphertext = b64ToBuf(p1.ciphertext);
    const key = await deriveKeyGCM(password, salt);
    let plaintextBuf: ArrayBuffer;
    try {
      plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    } catch {
      throw new Error('Wrong password or corrupted data.');
    }
    const decoder = new TextDecoder();
    return { data: JSON.parse(decoder.decode(plaintextBuf)) as T, role: 'admin' };
  }

  if (payload.schemaVersion === 2) {
    const p2 = payload as EncryptedPayloadV2;
    let masterKey: CryptoKey | null = null;
    let role: 'admin' | 'read' = 'admin';

    try {
      masterKey = await unwrapMasterKey(p2.masterWrappedKey, password, p2.masterSalt);
    } catch {
      if (p2.readWrappedKey && p2.readSalt) {
        try {
          masterKey = await unwrapMasterKey(p2.readWrappedKey, password, p2.readSalt);
          role = 'read';
        } catch {
          throw new Error('Wrong password.');
        }
      } else {
        throw new Error('Wrong password.');
      }
    }

    const iv = new Uint8Array(b64ToBuf(p2.iv));
    const ciphertext = b64ToBuf(p2.ciphertext);
    let plaintextBuf: ArrayBuffer;
    try {
      plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, masterKey, ciphertext);
    } catch {
      throw new Error('Corrupted data.');
    }

    const decoder = new TextDecoder();
    const data = JSON.parse(decoder.decode(plaintextBuf)) as T;

    if (role === 'admin') {
      const editToken = await generateEditToken(password, payload.stashId);
      return { data, role, masterKey, editToken };
    } else {
      return { data, role };
    }
  }

  throw new Error('Unknown schema version');
}

// ─── Fast Update (Admin only) ─────────────────────────────────────────────────

export async function updatePayloadV2(
  data: object,
  masterKey: CryptoKey,
  oldPayload: EncryptedPayloadV2
): Promise<EncryptedPayloadV2> {
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(data));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    plaintext
  );

  return {
    ...oldPayload,
    iv: bufToB64(iv.buffer),
    ciphertext: bufToB64(ciphertextBuf)
  };
}
