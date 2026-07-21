'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import type { Stash, StashLink, StashSection, EncryptedPayload, EncryptedPayloadV2, EncryptedPayloadV3 } from '@/lib/types';
import { decrypt, encryptV1, encryptV2, updatePayloadV2, encryptV3, encryptV3WithExistingMasterKey, updatePayloadV3 } from '@/lib/crypto';
import { getSectionByPath, touchStash, getViewTarget, createSection, createLink } from '@/lib/stash';
import SectionTree from '@/components/SectionTree';
import PasswordModal from '@/components/PasswordModal';
import LinkItem from '@/components/LinkItem';
import LinkForm from '@/components/LinkForm';
import SectionForm from '@/components/SectionForm';
import Toast from '@/components/Toast';
import StashSettingsModal from '@/components/StashSettingsModal';
import SearchBar from '@/components/SearchBar';
import SortableLink from '@/components/SortableLink';
import SortableSectionCard from '@/components/SortableSectionCard';
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'awaiting-password'; payload: EncryptedPayload; blobVersion?: string }
  | { status: 'ready'; stash: Stash; password: string; role: 'admin' | 'read'; masterKey?: CryptoKey; editToken?: string; payload: EncryptedPayload; blobVersion?: string };

type EditMode =
  | { type: 'none' }
  | { type: 'add-link' }
  | { type: 'edit-link'; link: StashLink }
  | { type: 'add-section'; parentPath: string[] }
  | { type: 'edit-section'; section: StashSection; path: string[] };

// ─── Immutable stash updaters ─────────────────────────────────────────────────

function updateLinksAtPath(
  stash: Stash,
  path: string[],
  updater: (links: StashLink[]) => StashLink[]
): Stash {
  if (path.length === 0) {
    return touchStash({ ...stash, links: updater(stash.links) });
  }
  return touchStash({
    ...stash,
    sections: updateSectionsAtPath(stash.sections, path, updater),
  });
}

function updateSectionsAtPath(
  sections: StashSection[],
  path: string[],
  linksUpdater: (links: StashLink[]) => StashLink[]
): StashSection[] {
  const [head, ...rest] = path;
  return sections.map(s => {
    if (s.id !== head) return s;
    if (rest.length === 0) return { ...s, links: linksUpdater(s.links) };
    return { ...s, children: updateSectionsAtPath(s.children, rest, linksUpdater) };
  });
}

function addSectionAtPath(stash: Stash, parentPath: string[], section: StashSection): Stash {
  if (parentPath.length === 0) {
    return touchStash({ ...stash, sections: [...stash.sections, section] });
  }
  return touchStash({
    ...stash,
    sections: addChildSection(stash.sections, parentPath, section),
  });
}

function addChildSection(sections: StashSection[], path: string[], section: StashSection): StashSection[] {
  const [head, ...rest] = path;
  return sections.map(s => {
    if (s.id !== head) return s;
    if (rest.length === 0) return { ...s, children: [...s.children, section] };
    return { ...s, children: addChildSection(s.children, rest, section) };
  });
}

function updateSectionMeta(stash: Stash, path: string[], updated: StashSection): Stash {
  const updateInList = (sections: StashSection[], remaining: string[]): StashSection[] => {
    const [head, ...rest] = remaining;
    return sections.map(s => {
      if (s.id !== head) return s;
      if (rest.length === 0) return { ...s, title: updated.title, description: updated.description };
      return { ...s, children: updateInList(s.children, rest) };
    });
  };
  return touchStash({ ...stash, sections: updateInList(stash.sections, path) });
}

function deleteSectionAtPath(sections: StashSection[], path: string[]): StashSection[] {
  const [head, ...rest] = path;
  if (rest.length === 0) {
    return sections.filter(s => s.id !== head);
  }
  return sections.map(s => {
    if (s.id !== head) return s;
    return { ...s, children: deleteSectionAtPath(s.children, rest) };
  });
}

// ─── Page Component ────────────────────────────────────────────────────────────

export default function StashPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [pwError, setPwError] = useState('');
  const [activePath, setActivePath] = useState<string[]>([]);
  const [editMode, setEditMode] = useState<EditMode>({ type: 'none' });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch encrypted payload on mount ──────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        // Check if password was pre-passed (e.g. from just-created stash)
        const prePw = sessionStorage.getItem(`stash_pw_${id}`);
        sessionStorage.removeItem(`stash_pw_${id}`);

        const res = await fetch(`/api/stash/${id}`, { cache: 'no-store' });
        if (!res.ok) {
          const json = await res.json();
          setState({ status: 'error', message: json.error || 'Stash not found.' });
          return;
        }
        const payload = await res.json() as EncryptedPayload;
        const blobVersion = res.headers.get('X-Stash-Version') || undefined;

        if (prePw) {
          try {
            const { data: stash, role, masterKey, editToken } = await decrypt<Stash>(payload, prePw);
            setState({ status: 'ready', stash, password: prePw, role, masterKey, editToken, payload, blobVersion });
            return;
          } catch { /* fall through to password prompt */ }
        }
        setState({ status: 'awaiting-password', payload, blobVersion });
      } catch {
        setState({ status: 'error', message: 'Failed to load stash. Check your connection.' });
      }
    }
    load();
  }, [id]);

  // ── Size limits ────────────────────────────────────────────────────────────
  const SIZE_WARN = 4 * 1024 * 1024;    // 4 MB
  const SIZE_BLOCK = 4.45 * 1024 * 1024; // 4.45 MB

  // ── Auto-save when stash changes ──────────────────────────────────────────
  const saveStash = useCallback(async (stash: Stash, currentState: LoadState) => {
    if (currentState.status !== 'ready' || currentState.role === 'read') return;
    setSaving(true);
    try {
      let payload: EncryptedPayload;
      let newEditToken = currentState.editToken;
      let newMasterKey = currentState.masterKey;
      let requestEditToken = currentState.editToken;

      if (currentState.payload.schemaVersion === 1) {
        payload = await encryptV3(stash, id, currentState.password);
        // We could extract the new editToken/masterKey from encryptV3, but for simplicity
        // on upgrade, we'll just let the next reload fetch it. (Though they won't need to reload
        // as the state already has them as undefined, but actually they do need them to save again!)
        // So let's re-decrypt it quickly to get the new tokens.
        const { masterKey, editToken } = await decrypt<Stash>(payload, currentState.password);
        newMasterKey = masterKey;
        newEditToken = editToken;
      } else if (currentState.payload.schemaVersion === 2) {
        const upgradeResult = await encryptV3WithExistingMasterKey(
          stash,
          id,
          currentState.masterKey!,
          currentState.password,
          currentState.payload as EncryptedPayloadV2
        );
        payload = upgradeResult.payload;
        newMasterKey = currentState.masterKey;
        newEditToken = upgradeResult.editToken;
        requestEditToken = currentState.editToken;
      } else {
        payload = await updatePayloadV3(stash, currentState.masterKey!, currentState.payload as EncryptedPayloadV3);
      }
      
      const bodyStr = JSON.stringify(payload);
      const bodySize = new Blob([bodyStr]).size;

      if (bodySize > SIZE_BLOCK) {
        setToast({ message: `Stash too large (${(bodySize / 1024 / 1024).toFixed(1)} MB). Remove some items to continue saving.`, type: 'error' });
        setSaving(false);
        return;
      }
      if (bodySize > SIZE_WARN) {
        setToast({ message: `⚠ Stash is getting large (${(bodySize / 1024 / 1024).toFixed(1)} MB / 4.5 MB). Consider removing unused links.`, type: 'error' });
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (requestEditToken) headers['Authorization'] = `Bearer ${requestEditToken}`;
      if (currentState.blobVersion) headers['X-Stash-Version'] = currentState.blobVersion;

      const res = await fetch(`/api/stash/${id}`, {
        method: 'PUT',
        headers,
        body: bodyStr,
      });
      if (!res.ok) {
        if (res.status === 409) {
          setToast({ message: 'This stash was modified elsewhere. Please refresh to see the latest changes.', type: 'error' });
          setSaving(false);
          return;
        }
        const json = await res.json();
        setToast({ message: json.error || 'Save failed.', type: 'error' });
      } else {
        const json = await res.json();
        const newBlobVersion = json.version || currentState.blobVersion;
        setState(prev => prev.status === 'ready' ? { ...prev, payload, editToken: newEditToken, masterKey: newMasterKey, blobVersion: newBlobVersion } : prev);
      }
    } catch (e) {
      console.error(e);
      setToast({ message: 'Save failed. Check your connection.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [id]);

  const scheduleAutoSave = useCallback((stash: Stash, currentState: LoadState) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveStash(stash, currentState), 1500);
  }, [saveStash]);

  // ── Unlock ────────────────────────────────────────────────────────────────
  const handleUnlock = async (password: string) => {
    if (state.status !== 'awaiting-password') return;
    setPwError('');
    try {
      const { data: stash, role, masterKey, editToken } = await decrypt<Stash>(state.payload, password);
      setState({ status: 'ready', stash, password, role, masterKey, editToken, payload: state.payload, blobVersion: state.blobVersion });
    } catch {
      setPwError('Wrong password. Try again.');
    }
  };

  // ── Mutation helpers ──────────────────────────────────────────────────────
  const updateStash = (updated: Stash) => {
    if (state.status !== 'ready') return;
    const newState = { ...state, stash: updated };
    setState(newState);
    scheduleAutoSave(updated, newState);
  };

  const handleSaveLink = (link: StashLink) => {
    if (state.status !== 'ready') return;
    const isEdit = editMode.type === 'edit-link';
    const updated = updateLinksAtPath(state.stash, activePath, (links) => {
      const idx = links.findIndex(l => l.id === link.id);
      return idx >= 0 ? links.map(l => l.id === link.id ? link : l) : [...links, link];
    });
    updateStash(updated);
    setEditMode({ type: 'none' });
    setToast({ message: isEdit ? 'Link updated' : 'Link added', type: 'success' });
  };

  const handleDeleteLink = (linkId: string) => {
    if (state.status !== 'ready') return;
    const updated = updateLinksAtPath(state.stash, activePath, (links) => links.filter(l => l.id !== linkId));
    updateStash(updated);
    setToast({ message: 'Link deleted', type: 'success' });
  };

  const handleSaveSection = (section: StashSection) => {
    if (state.status !== 'ready' || editMode.type !== 'add-section' && editMode.type !== 'edit-section') return;
    const isEdit = editMode.type === 'edit-section';
    let updated: Stash;
    if (editMode.type === 'add-section') {
      updated = addSectionAtPath(state.stash, editMode.parentPath, section);
    } else {
      updated = updateSectionMeta(state.stash, editMode.path, section);
    }
    updateStash(updated);
    setEditMode({ type: 'none' });
    setToast({ message: isEdit ? 'Section updated' : 'Section created', type: 'success' });
  };

  const handleDeleteSection = (path: string[]) => {
    if (state.status !== 'ready') return;
    const updated = touchStash({ ...state.stash, sections: deleteSectionAtPath(state.stash.sections, path) });
    updateStash(updated);
    setToast({ message: 'Section deleted', type: 'success' });
    
    // If the active path is the deleted section (or inside it), go to parent
    const isUnderDeleted = activePath.length >= path.length && path.every((id, i) => activePath[i] === id);
    if (isUnderDeleted) {
      setActivePath(path.slice(0, -1));
      setEditMode({ type: 'none' });
    }
  };

  // ── Reorder helpers ────────────────────────────────────────────────────────
  const handleReorderLinks = (oldIndex: number, newIndex: number) => {
    if (state.status !== 'ready') return;
    const updated = updateLinksAtPath(state.stash, activePath, (links) => arrayMove(links, oldIndex, newIndex));
    updateStash(updated);
  };

  const handleReorderSections = (oldIndex: number, newIndex: number) => {
    if (state.status !== 'ready') return;
    if (activePath.length === 0) {
      const reordered = arrayMove(state.stash.sections, oldIndex, newIndex);
      updateStash(touchStash({ ...state.stash, sections: reordered }));
    } else {
      // Reorder children of the active section
      const updateChildren = (sections: StashSection[], path: string[]): StashSection[] => {
        const [head, ...rest] = path;
        return sections.map(s => {
          if (s.id !== head) return s;
          if (rest.length === 0) return { ...s, children: arrayMove(s.children, oldIndex, newIndex) };
          return { ...s, children: updateChildren(s.children, rest) };
        });
      };
      updateStash(touchStash({ ...state.stash, sections: updateChildren(state.stash.sections, activePath) }));
    }
  };

  // ── DnD sensors ────────────────────────────────────────────────────────────
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const touchSensor = useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } });
  const sensors = useSensors(pointerSensor, touchSensor);

  const handleLinkDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = links.findIndex(l => l.id === active.id);
    const newIndex = links.findIndex(l => l.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) handleReorderLinks(oldIndex, newIndex);
  };

  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) handleReorderSections(oldIndex, newIndex);
  };

  // ── View state ────────────────────────────────────────────────────────────
  if (state.status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 54px)', gap: 'var(--space-3)', color: 'var(--text-muted)' }}>
        <span className="spinner" />
        Loading stash…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 54px)' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', alignItems: 'center' }}>
          <span style={{ fontSize: '2.5rem', opacity: 0.4 }}>⊗</span>
          <p style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{state.message}</p>
          <a href="/" className="btn btn-secondary btn-sm">← Back home</a>
        </div>
      </div>
    );
  }

  if (state.status === 'awaiting-password') {
    return (
      <PasswordModal
        title="Unlock Stash"
        description={`Enter the password for stash "${id}".`}
        submitLabel="Unlock"
        error={pwError}
        onSubmit={handleUnlock}
        onCancel={() => window.history.back()}
      />
    );
  }

  // ── Ready state ───────────────────────────────────────────────────────────
  const { stash, password } = state;
  const { links, sections } = getViewTarget(stash, activePath);
  const activeSection = activePath.length > 0 ? getSectionByPath(stash, activePath) : null;
  const activeDepth = activePath.length + 1;

  return (
    <>
      <div className="page-layout">
        {/* Sidebar */}
        <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} aria-label="Section navigation">
          <div className="sidebar-header">Sections</div>
          <SectionTree
            sections={stash.sections}
            activePath={activePath}
            onSelectRoot={() => { setActivePath([]); setEditMode({ type: 'none' }); setSidebarOpen(false); }}
            onSelectSection={(path) => { setActivePath(path); setEditMode({ type: 'none' }); setSidebarOpen(false); }}
            onAddSection={state.role === 'admin' ? (parentPath) => {
              setActivePath(parentPath);
              setEditMode({ type: 'add-section', parentPath });
              setSidebarOpen(false);
            } : undefined}
            onDeleteSection={state.role === 'admin' ? handleDeleteSection : undefined}
          />
          <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)', fontSize: '0.7rem', color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)', textAlign: 'center' }}>
            Build:{' '}
            {process.env.NEXT_PUBLIC_APP_VERSION ? (
              <a 
                href={`https://github.com/The-Parth/stasher/commit/${process.env.NEXT_PUBLIC_APP_VERSION}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--border)' }}
              >
                {process.env.NEXT_PUBLIC_APP_VERSION}
              </a>
            ) : (
              'unknown'
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="main-content" aria-label="Stash content">
          {/* Header */}
          <div className="content-header">
            {/* Mobile sidebar toggle */}
            <button
              className="btn-icon"
              style={{ display: 'none' }}
              id="sidebar-toggle"
              onClick={() => setSidebarOpen(v => !v)}
              aria-label="Toggle sidebar"
              aria-expanded={sidebarOpen}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 4h12M2 8h12M2 12h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 className="content-title">
                {activeSection ? activeSection.title : stash.name}
              </h1>
              {activeSection?.description && (
                <p className="section-desc">{activeSection.description}</p>
              )}
            </div>

            <SearchBar
              stash={stash}
              onNavigateToSection={(path) => { setActivePath(path); setEditMode({ type: 'none' }); }}
              onNavigateToLink={(sectionPath, link) => {
                setActivePath(sectionPath);
                setEditMode({ type: 'none' });
                // Scroll to the link after React re-renders the new section
                setTimeout(() => {
                  const el = document.querySelector(`[data-link-id="${link.id}"]`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    // Brief highlight flash
                    el.classList.add('search-highlight');
                    setTimeout(() => el.classList.remove('search-highlight'), 1500);
                  }
                }, 100);
              }}
            />

            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexShrink: 0 }}>
              {saving && <span className="spinner spinner-sm" aria-label="Saving…" title="Saving…" />}
              <span className="badge badge-muted">{stash.id}</span>

              {activeSection && editMode.type === 'none' && state.role === 'admin' && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditMode({ type: 'edit-section', section: activeSection, path: activePath })}
                  id="edit-section-btn"
                >
                  Edit section
                </button>
              )}

              {state.role === 'admin' && (
                <>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowSettings(true)}
                    id="settings-btn"
                    title="Stash Settings"
                  >
                    ⚙
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setEditMode({ type: 'add-link' })}
                    id="add-link-btn"
                    disabled={editMode.type === 'add-link'}
                  >
                    + Add link
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Edit mode forms */}
          {(editMode.type === 'add-link' || editMode.type === 'edit-link') && (
            <LinkForm
              initial={editMode.type === 'edit-link' ? editMode.link : null}
              onSave={handleSaveLink}
              onCancel={() => setEditMode({ type: 'none' })}
            />
          )}

          {(editMode.type === 'add-section' || editMode.type === 'edit-section') && (
            <SectionForm
              initial={editMode.type === 'edit-section' ? editMode.section : null}
              depth={activeDepth}
              onSave={handleSaveSection}
              onCancel={() => setEditMode({ type: 'none' })}
            />
          )}

          {/* Sub-sections */}
          {sections.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              <div className="sidebar-header" style={{ paddingLeft: 0 }}>Sub-sections</div>
              {state.role === 'admin' ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                  <SortableContext items={sections.map(s => s.id)} strategy={rectSortingStrategy}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                      {sections.map(sec => (
                        <SortableSectionCard
                          key={sec.id}
                          section={sec}
                          isAdmin={true}
                          onClick={() => { setActivePath([...activePath, sec.id]); setEditMode({ type: 'none' }); }}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                  {sections.map(sec => (
                    <button
                      key={sec.id}
                      className="card-sm section-card"
                      onClick={() => { setActivePath([...activePath, sec.id]); setEditMode({ type: 'none' }); }}
                      id={`section-card-${sec.id}`}
                    >
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {sec.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {sec.links.length} link{sec.links.length !== 1 ? 's' : ''} · {sec.children.length} section{sec.children.length !== 1 ? 's' : ''}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Links list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {links.length > 0 && (
              <div className="sidebar-header" style={{ paddingLeft: 0 }}>
                Links <span className="badge badge-muted" style={{ marginLeft: 'var(--space-2)' }}>{links.length}</span>
              </div>
            )}
            {state.role === 'admin' ? (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLinkDragEnd}>
                <SortableContext items={links.map(l => l.id)} strategy={verticalListSortingStrategy}>
                  {links.map(link => (
                    <SortableLink
                      key={link.id}
                      link={link}
                      onEdit={(l) => setEditMode({ type: 'edit-link', link: l })}
                      onDelete={handleDeleteLink}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              links.map(link => (
                <LinkItem
                  key={link.id}
                  link={link}
                />
              ))
            )}
          </div>

          {/* Empty state */}
          {links.length === 0 && sections.length === 0 && editMode.type === 'none' && (
            <div className="empty-state">
              <div className="empty-state-icon">⊚</div>
              <div className="empty-state-title">Nothing here yet</div>
              {state.role === 'admin' ? (
                <>
                  <p className="empty-state-desc">
                    Add your first link with the <strong>+ Add link</strong> button, or create a section using the sidebar.
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={() => setEditMode({ type: 'add-link' })} id="empty-add-link-btn">
                    + Add link
                  </button>
                </>
              ) : (
                <p className="empty-state-desc">
                  This stash is currently empty.
                </p>
              )}
            </div>
          )}
        </main>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {showSettings && state.status === 'ready' && state.payload.schemaVersion >= 2 && (
        <StashSettingsModal
          stashId={id}
          payload={state.payload as EncryptedPayload}
          masterKey={state.masterKey!}
          editToken={state.editToken!}
          onClose={() => setShowSettings(false)}
          blobVersion={state.blobVersion}
          onUpdated={(newPayload, newEditToken, newBlobVersion) => {
            setState(prev => prev.status === 'ready' ? { ...prev, payload: newPayload, editToken: newEditToken, blobVersion: newBlobVersion || prev.blobVersion } : prev);
          }}
        />
      )}

      {/* Sidebar backdrop on mobile */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 199 }}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}
