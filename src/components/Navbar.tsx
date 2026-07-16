'use client';
import Link from 'next/link';
import { useState } from 'react';
import CreateStashModal from './CreateStashModal';
import { useRouter } from 'next/navigation';
import type { EncryptedPayload } from '@/lib/types';
import { createDefaultStash, generateStashId } from '@/lib/stash';
import { encrypt } from '@/lib/crypto';
import Toast from './Toast';

export default function Navbar() {
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const router = useRouter();

  const handleCreate = async (name: string, id: string, password: string) => {
    setCreating(true);
    setCreateError('');
    try {
      const stash = createDefaultStash(name, id);
      const { salt, iv, ciphertext } = await encrypt(stash, password);
      const payload: EncryptedPayload = {
        schemaVersion: 1,
        stashId: id,
        salt,
        iv,
        ciphertext,
      };
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
        <button
          id="navbar-create-btn"
          className="btn btn-primary btn-sm"
          onClick={() => { setShowCreate(true); setCreateError(''); }}
          aria-label="Create a new stash"
        >
          <span aria-hidden="true">+</span>
          New Stash
        </button>
      </nav>

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
