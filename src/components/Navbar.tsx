'use client';
import Link from 'next/link';
import { useState } from 'react';
import CreateStashModal from './CreateStashModal';
import ThemeModal from './ThemeModal';
import { useRouter } from 'next/navigation';
import type { EncryptedPayload } from '@/lib/types';
import { createDefaultStash, generateStashId } from '@/lib/stash';
import { encryptV2 } from '@/lib/crypto';
import Toast from './Toast';

export default function Navbar() {
  const [showCreate, setShowCreate] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const router = useRouter();

  const handleCreate = async (name: string, id: string, password: string, readPassword?: string) => {
    setCreating(true);
    setCreateError('');
    try {
      const stash = createDefaultStash(name, id);
      const payload = await encryptV2(stash, id, password, readPassword);

      const res = await fetch('/api/stash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, payload }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCreateError(json.error || 'Failed to create stash.');
        return;
      }
      setShowCreate(false);
      setToast({ message: 'Stash created! Redirecting…', type: 'success' });
      // Store password in sessionStorage temporarily so the stash page can use it
      sessionStorage.setItem(`stash_pw_${id}`, password);
      setTimeout(() => router.push(`/stash/${id}`), 600);
    } catch (e) {
      console.error(e);
      setCreateError('An unexpected error occurred.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <nav className="navbar" aria-label="Main navigation">
        <Link href="/" className="navbar-brand" id="navbar-brand">
          <span className="navbar-dot" aria-hidden="true" />
          Stasher
        </Link>
        <span className="navbar-spacer" />
        <div className="flex items-center gap-3">
          <button
            className="btn-icon"
            onClick={() => setShowThemeModal(true)}
            aria-label="Theme Settings"
            title="Theme Settings"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </button>
          <button
            id="navbar-create-btn"
            className="btn btn-primary btn-sm"
            onClick={() => { setShowCreate(true); setCreateError(''); }}
            aria-label="Create a new stash"
          >
            <span aria-hidden="true">+</span>
            New Stash
          </button>
        </div>
      </nav>

      {showThemeModal && (
        <ThemeModal onClose={() => setShowThemeModal(false)} />
      )}

      {showCreate && (
        <CreateStashModal
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); setCreateError(''); }}
          isLoading={creating}
          error={createError}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}
