/**
 * crypto.ts
 * Browser-native WebCrypto utilities for AES-GCM encryption/decryption.
 * The password never leaves memory and is never stored.
 */

const PBKDF2_ITERATIONS = 250_000;
const KEY_LENGTH = 256;
const SALT_LENGTH = 16; // bytes
const IV_LENGTH = 12;   // bytes (96-bit for AES-GCM)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str);
}

function b64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// ─── Key Derivation ──────────────────────────────────────────────────────────

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Encrypt ─────────────────────────────────────────────────────────────────

export interface EncryptResult {
  salt: string;       // base64
  iv: string;         // base64
  ciphertext: string; // base64
}

export async function encrypt(
  data: object,
  password: string
): Promise<EncryptResult> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH)) as Uint8Array<ArrayBuffer>;
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH)) as Uint8Array<ArrayBuffer>;

  const key = await deriveKey(password, salt);

  const plaintext = encoder.encode(JSON.stringify(data));
  const ciphertextBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    plaintext
  );

  return {
    salt: bufToB64(salt.buffer as ArrayBuffer),
    iv: bufToB64(iv.buffer as ArrayBuffer),
    ciphertext: bufToB64(ciphertextBuf),
  };
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────

/**
 * Returns the decrypted object, or throws if the password is wrong
 * or the data is corrupted.
 */
export async function decrypt<T = unknown>(
  payload: { salt: string; iv: string; ciphertext: string },
  password: string
): Promise<T> {
  const salt = new Uint8Array(b64ToBuf(payload.salt)) as Uint8Array<ArrayBuffer>;
  const iv = new Uint8Array(b64ToBuf(payload.iv)) as Uint8Array<ArrayBuffer>;
  const ciphertext = b64ToBuf(payload.ciphertext);

  const key = await deriveKey(password, salt);

  let plaintextBuf: ArrayBuffer;
  try {
    plaintextBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );
  } catch {
    throw new Error('Wrong password or corrupted data.');
  }

  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(plaintextBuf)) as T;
}
