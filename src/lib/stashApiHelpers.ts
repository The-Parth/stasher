import { head, put } from '@vercel/blob';
import { decrypt, encryptV3, encryptV3WithExistingMasterKey, updatePayloadV3 } from './crypto';
import type { Stash, StashLink, StashSection, EncryptedPayload, EncryptedPayloadV3 } from './types';
import { createLink, createSection, generateItemId, touchStash } from './stash';

function blobKey(id: string) {
  return `stashes/${id}.json`;
}

// ─── Fetch and Decrypt ───────────────────────────────────────────────────────
export async function fetchAndDecrypt(id: string, password: string): Promise<{
  stash: Stash;
  role: 'admin' | 'read';
  masterKey?: CryptoKey;
  editToken?: string;
  payload: EncryptedPayload;
}> {
  let response;
  try {
    const meta = await head(blobKey(id));
    response = await fetch(meta.url, { cache: 'no-store' });
  } catch {
    throw new Error('Stash not found.');
  }

  if (!response.ok) {
    throw new Error('Failed to fetch stash data.');
  }

  const payload = await response.json() as EncryptedPayload;
  try {
    const result = await decrypt<Stash>(payload, password);
    return { stash: result.data, role: result.role, masterKey: result.masterKey, editToken: result.editToken, payload };
  } catch {
    throw new Error('Incorrect password.');
  }
}

// ─── Encrypt and Save ────────────────────────────────────────────────────────
export async function encryptAndSave(
  id: string,
  stash: Stash,
  password: string,
  role: 'admin' | 'read',
  masterKey: CryptoKey | undefined,
  oldPayload: EncryptedPayload
): Promise<void> {
  if (role !== 'admin') {
    throw new Error('Read-only access. Cannot modify.');
  }

  let newPayload: EncryptedPayloadV3;
  if (oldPayload.schemaVersion === 1) {
    newPayload = await encryptV3(stash, id, password);
  } else if (oldPayload.schemaVersion === 2) {
    if (!masterKey) {
      throw new Error('Missing master key for schema v2 save.');
    }
    newPayload = (await encryptV3WithExistingMasterKey(
      stash,
      id,
      masterKey,
      password,
      oldPayload
    )).payload;
  } else {
    if (!masterKey) {
      throw new Error('Missing master key for schema v3 save.');
    }
    newPayload = await updatePayloadV3(stash, masterKey, oldPayload as EncryptedPayloadV3);
  }

  await put(
    blobKey(id),
    JSON.stringify(newPayload),
    {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true,
    }
  );
}

// ─── Find Item ───────────────────────────────────────────────────────────────
export function findItemById(stash: Stash, itemId: string): {
  type: 'link' | 'section';
  item: StashLink | StashSection;
  parentPath: string[]; // section IDs leading to this item
} | null {
  // Check root links
  for (const link of stash.links) {
    if (link.id === itemId) return { type: 'link', item: link, parentPath: [] };
  }

  // Recursive search in sections
  function searchSections(sections: StashSection[], currentPath: string[]): ReturnType<typeof findItemById> {
    for (const section of sections) {
      if (section.id === itemId) return { type: 'section', item: section, parentPath: currentPath };
      for (const link of section.links) {
        if (link.id === itemId) return { type: 'link', item: link, parentPath: [...currentPath, section.id] };
      }
      const found = searchSections(section.children, [...currentPath, section.id]);
      if (found) return found;
    }
    return null;
  }

  return searchSections(stash.sections, []);
}

// ─── Add Link ────────────────────────────────────────────────────────────────
export function addLinkToStash(
  stash: Stash,
  url: string,
  label: string,
  previewText: string,
  sectionId?: string
): { stash: Stash; link: StashLink } {
  const link = createLink(url, label);
  link.previewText = previewText;

  let newStash = { ...stash };

  if (!sectionId) {
    newStash.links = [...newStash.links, link];
  } else {
    const updateSectionLinks = (sections: StashSection[]): boolean => {
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].id === sectionId) {
          sections[i] = { ...sections[i], links: [...sections[i].links, link] };
          return true;
        }
        if (updateSectionLinks(sections[i].children)) {
          // Recreate section object to trigger reactivity if used in UI, though less critical for API
          sections[i] = { ...sections[i], children: [...sections[i].children] };
          return true;
        }
      }
      return false;
    };
    
    // Deep clone sections to avoid mutating original
    const clonedSections = JSON.parse(JSON.stringify(stash.sections));
    const found = updateSectionLinks(clonedSections);
    
    if (!found) throw new Error('Section not found.');
    newStash.sections = clonedSections;
  }

  return { stash: touchStash(newStash), link };
}

// ─── Add Section ─────────────────────────────────────────────────────────────
export function addSectionToStash(
  stash: Stash,
  title: string,
  description: string,
  parentSectionId?: string
): { stash: Stash; section: StashSection } {
  const section = createSection(title);
  section.description = description;
  let newStash = { ...stash };

  if (!parentSectionId) {
    newStash.sections = [...newStash.sections, section];
  } else {
    let depth = 0;
    const updateSectionChildren = (sections: StashSection[], currentDepth: number): boolean => {
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].id === parentSectionId) {
          if (currentDepth >= 3) throw new Error('Maximum nesting depth (3) reached.');
          sections[i] = { ...sections[i], children: [...sections[i].children, section] };
          return true;
        }
        if (updateSectionChildren(sections[i].children, currentDepth + 1)) {
          sections[i] = { ...sections[i], children: [...sections[i].children] };
          return true;
        }
      }
      return false;
    };

    const clonedSections = JSON.parse(JSON.stringify(stash.sections));
    const found = updateSectionChildren(clonedSections, 1);
    
    if (!found) throw new Error('Parent section not found.');
    newStash.sections = clonedSections;
  }

  return { stash: touchStash(newStash), section };
}

// ─── Update Item ─────────────────────────────────────────────────────────────
export function updateItemInStash(
  stash: Stash,
  itemId: string,
  updates: Partial<StashLink & StashSection>
): { stash: Stash; item: StashLink | StashSection } {
  let newStash = { ...stash };
  let updatedItem: StashLink | StashSection | null = null;

  // Root links
  for (let i = 0; i < newStash.links.length; i++) {
    if (newStash.links[i].id === itemId) {
      newStash.links[i] = { ...newStash.links[i], ...updates } as StashLink;
      updatedItem = newStash.links[i];
      newStash.links = [...newStash.links];
      break;
    }
  }

  if (!updatedItem) {
    const updateNested = (sections: StashSection[]): boolean => {
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].id === itemId) {
          sections[i] = { ...sections[i], ...updates } as StashSection;
          updatedItem = sections[i];
          return true;
        }
        for (let j = 0; j < sections[i].links.length; j++) {
          if (sections[i].links[j].id === itemId) {
            sections[i].links[j] = { ...sections[i].links[j], ...updates } as StashLink;
            updatedItem = sections[i].links[j];
            sections[i] = { ...sections[i], links: [...sections[i].links] };
            return true;
          }
        }
        if (updateNested(sections[i].children)) {
          sections[i] = { ...sections[i], children: [...sections[i].children] };
          return true;
        }
      }
      return false;
    };

    const clonedSections = JSON.parse(JSON.stringify(stash.sections));
    updateNested(clonedSections);
    newStash.sections = clonedSections;
  }

  if (!updatedItem) throw new Error('Item not found.');
  return { stash: touchStash(newStash), item: updatedItem };
}

// ─── Delete Item ─────────────────────────────────────────────────────────────
export function deleteItemFromStash(
  stash: Stash,
  itemId: string
): Stash {
  let newStash = { ...stash };
  let found = false;

  // Root links
  newStash.links = newStash.links.filter(l => {
    if (l.id === itemId) found = true;
    return l.id !== itemId;
  });

  if (!found) {
    const deleteNested = (sections: StashSection[]): boolean => {
      const initialLen = sections.length;
      for (let i = 0; i < sections.length; i++) {
        if (sections[i].id === itemId) {
          sections.splice(i, 1);
          return true;
        }
        const initialLinksLen = sections[i].links.length;
        sections[i].links = sections[i].links.filter(l => l.id !== itemId);
        if (sections[i].links.length < initialLinksLen) {
          return true;
        }
        if (deleteNested(sections[i].children)) {
          return true;
        }
      }
      return sections.length < initialLen;
    };

    const clonedSections = JSON.parse(JSON.stringify(stash.sections));
    found = deleteNested(clonedSections);
    newStash.sections = clonedSections;
  }

  if (!found) throw new Error('Item not found.');
  return touchStash(newStash);
}
