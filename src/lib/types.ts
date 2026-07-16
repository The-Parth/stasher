// Schema version for future migrations
export const SCHEMA_VERSION = 1;

// ─── Link ────────────────────────────────────────────────────────────────────

export interface StashLink {
  id: string;
  url: string;
  label: string;
  previewText: string;
  createdAt: string; // ISO string
}

// ─── Section (recursive, max 3 levels) ───────────────────────────────────────

export interface StashSection {
  id: string;
  title: string;
  description: string; // max 200 chars
  links: StashLink[];
  children: StashSection[]; // max depth = 3
}

// ─── Stash Root ───────────────────────────────────────────────────────────────

export interface Stash {
  id: string;
  name: string;
  createdAt: string; // ISO string
  updatedAt: string; // ISO string
  schemaVersion: number;
  sections: StashSection[];
  links: StashLink[]; // top-level links (outside any section)
}

// ─── Encrypted Payload (stored in Vercel Blob) ─────────────────────────────

export interface EncryptedPayload {
  schemaVersion: number;
  stashId: string;
  salt: string;       // base64-encoded
  iv: string;         // base64-encoded
  ciphertext: string; // base64-encoded
}

// ─── Media types ─────────────────────────────────────────────────────────────

export type MediaType = 'video' | 'image' | 'other';

// ─── UI state helpers ─────────────────────────────────────────────────────────

export type StashLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'awaiting-password' }
  | { status: 'decrypting' }
  | { status: 'ready'; stash: Stash }
  | { status: 'error'; message: string };
