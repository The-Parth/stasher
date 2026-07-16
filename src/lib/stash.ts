import type { Stash, StashSection, StashLink } from './types';
import { SCHEMA_VERSION } from './types';

// ─── ID Generation ───────────────────────────────────────────────────────────

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 8;

export function generateStashId(): string {
  const arr = new Uint8Array(ID_LENGTH);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => ID_CHARS[b % ID_CHARS.length])
    .join('');
}

export function generateItemId(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function validateStashId(id: string): boolean {
  return /^[a-z0-9]{4,32}$/.test(id);
}

// ─── Default Factories ────────────────────────────────────────────────────────

export function createDefaultStash(name: string, id: string): Stash {
  const now = new Date().toISOString();
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
    sections: [],
    links: [],
  };
}

export function createSection(title: string): StashSection {
  return {
    id: generateItemId(),
    title,
    description: '',
    links: [],
    children: [],
  };
}

export function createLink(url: string, label?: string): StashLink {
  return {
    id: generateItemId(),
    url,
    label: label || '',
    previewText: '',
    createdAt: new Date().toISOString(),
  };
}

// ─── Section helpers ─────────────────────────────────────────────────────────

/**
 * Returns the section at the given path of IDs, or null if not found.
 * path = [] means root (use stash.sections / stash.links directly)
 */
export function getSectionByPath(
  stash: Stash,
  path: string[]
): StashSection | null {
  if (path.length === 0) return null;
  let sections = stash.sections;
  let found: StashSection | null = null;
  for (const id of path) {
    found = sections.find((s) => s.id === id) ?? null;
    if (!found) return null;
    sections = found.children;
  }
  return found;
}

/**
 * Immutably updates a stash's updatedAt timestamp.
 */
export function touchStash(stash: Stash): Stash {
  return { ...stash, updatedAt: new Date().toISOString() };
}

/**
 * Returns links and sections for the current view target.
 * path=[] means root level.
 */
export function getViewTarget(
  stash: Stash,
  sectionPath: string[]
): { links: StashLink[]; sections: StashSection[] } {
  if (sectionPath.length === 0) {
    return { links: stash.links, sections: stash.sections };
  }
  const section = getSectionByPath(stash, sectionPath);
  if (!section) return { links: [], sections: [] };
  return { links: section.links, sections: section.children };
}
