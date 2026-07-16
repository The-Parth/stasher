'use client';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import type { Stash, StashLink, StashSection, EncryptedPayload } from '@/lib/types';
import { decrypt, encrypt } from '@/lib/crypto';
import { getSectionByPath, touchStash, getViewTarget, createSection, createLink } from '@/lib/stash';
import SectionTree from '@/components/SectionTree';
import PasswordModal from '@/components/PasswordModal';
import LinkItem from '@/components/LinkItem';
import LinkForm from '@/components/LinkForm';
import SectionForm from '@/components/SectionForm';
import Toast from '@/components/Toast';

type LoadState =
  | { status: 'loading' }
  | { status: 'awaiting-password'; payload: EncryptedPayload }
  | { status: 'ready'; stash: Stash; password: string }
  | { status: 'error'; message: string };

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
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch encrypted payload on mount ──────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        // Check if password was pre-passed (e.g. from just-created stash)
        const prePw = sessionStorage.getItem(`stash_pw_${id}`);
        sessionStorage.removeItem(`stash_pw_${id}`);

        const res = await fetch(`/api/stash/${id}`);
        if (!res.ok) {
          const json = await res.json();
          setState({ status: 'error', message: json.error || 'Stash not found.' });
          return;
        }
        const payload = await res.json() as EncryptedPayload;

        if (prePw) {
          try {
            const stash = await decrypt<Stash>(payload, prePw);
            setState({ status: 'ready', stash, password: prePw });
            return;
          } catch { /* fall through to password prompt */ }
        }
        setState({ status: 'awaiting-password', payload });
      } catch {
        setState({ status: 'error', message: 'Failed to load stash. Check your connection.' });
      }
    }
    load();
  }, [id]);

  // ── Auto-save when stash changes ──────────────────────────────────────────
  const saveStash = useCallback(async (stash: Stash, password: string) => {
    setSaving(true);
    try {
      const { salt, iv, ciphertext } = await encrypt(stash, password);
      const payload: EncryptedPayload = { schemaVersion: 1, stashId: id, salt, iv, ciphertext };
      const res = await fetch(`/api/stash/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = await res.json();
        setToast({ message: json.error || 'Save failed.', type: 'error' });
      }
    } catch {
      setToast({ message: 'Save failed. Check your connection.', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [id]);

  const scheduleAutoSave = useCallback((stash: Stash, password: string) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveStash(stash, password), 1500);
  }, [saveStash]);

  // ── Unlock ────────────────────────────────────────────────────────────────
  const handleUnlock = async (password: string) => {
    if (state.status !== 'awaiting-password') return;
    setPwError('');
    try {
      const stash = await decrypt<Stash>(state.payload, password);
      setState({ status: 'ready', stash, password });
    } catch {
      setPwError('Wrong password. Try again.');
    }
  };

  // ── Mutation helpers ──────────────────────────────────────────────────────
  const updateStash = (updated: Stash) => {
    if (state.status !== 'ready') return;
    setState({ ...state, stash: updated });
    scheduleAutoSave(updated, state.password);
  };

  const handleSaveLink = (link: StashLink) => {
    if (state.status !== 'ready') return;
    const updated = updateLinksAtPath(state.stash, activePath, (links) => {
      const idx = links.findIndex(l => l.id === link.id);
      return idx >= 0 ? links.map(l => l.id === link.id ? link : l) : [...links, link];
    });
    updateStash(updated);
    setEditMode({ type: 'none' });
  };

  const handleDeleteLink = (linkId: string) => {
    if (state.status !== 'ready') return;
    const updated = updateLinksAtPath(state.stash, activePath, (links) => links.filter(l => l.id !== linkId));
    updateStash(updated);
  };

  const handleSaveSection = (section: StashSection) => {
    if (state.status !== 'ready' || editMode.type !== 'add-section' && editMode.type !== 'edit-section') return;
    let updated: Stash;
    if (editMode.type === 'add-section') {
      updated = addSectionAtPath(state.stash, editMode.parentPath, section);
    } else {
      updated = updateSectionMeta(state.stash, editMode.path, section);
    }
    updateStash(updated);
    setEditMode({ type: 'none' });
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
            onAddSection={(parentPath) => {
              setActivePath(parentPath);
              setEditMode({ type: 'add-section', parentPath });
              setSidebarOpen(false);
            }}
          />
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

            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexShrink: 0 }}>
              {saving && <span className="spinner spinner-sm" aria-label="Saving…" title="Saving…" />}
              <span className="badge badge-muted">{stash.id}</span>

              {activeSection && editMode.type === 'none' && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditMode({ type: 'edit-section', section: activeSection, path: activePath })}
                  id="edit-section-btn"
                >
                  Edit section
                </button>
              )}

              <button
                className="btn btn-primary btn-sm"
                onClick={() => setEditMode({ type: 'add-link' })}
                id="add-link-btn"
                disabled={editMode.type === 'add-link'}
              >
                + Add link
              </button>
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
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 'var(--space-3)' }}>
                {sections.map(sec => (
                  <button
                    key={sec.id}
                    className="card-sm"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', cursor: 'pointer', textAlign: 'left', transition: 'all var(--transition)' }}
                    onClick={() => { setActivePath([...activePath, sec.id]); setEditMode({ type: 'none' }); }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = '#3a3d45')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
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
            </div>
          )}

          {/* Links list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {links.length > 0 && (
              <div className="sidebar-header" style={{ paddingLeft: 0 }}>
                Links <span className="badge badge-muted" style={{ marginLeft: 'var(--space-2)' }}>{links.length}</span>
              </div>
            )}
            {links.map(link => (
              <LinkItem
                key={link.id}
                link={link}
                onEdit={(l) => setEditMode({ type: 'edit-link', link: l })}
                onDelete={handleDeleteLink}
              />
            ))}
          </div>

          {/* Empty state */}
          {links.length === 0 && sections.length === 0 && editMode.type === 'none' && (
            <div className="empty-state">
              <div className="empty-state-icon">⊚</div>
              <div className="empty-state-title">Nothing here yet</div>
              <p className="empty-state-desc">
                Add your first link with the <strong>+ Add link</strong> button, or create a section using the sidebar.
              </p>
              <button className="btn btn-primary btn-sm" onClick={() => setEditMode({ type: 'add-link' })} id="empty-add-link-btn">
                + Add link
              </button>
            </div>
          )}
        </main>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

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
