'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CloneStashModal from '@/components/CloneStashModal';
import { decrypt, encryptV2 } from '@/lib/crypto';
import type { Stash, EncryptedPayload } from '@/lib/types';

export default function HomePage() {
  const [stashId, setStashId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const router = useRouter();

  const handleVerifySource = async (id: string, password: string): Promise<Stash> => {
    const res = await fetch(`/api/stash/${id}`);
    if (!res.ok) throw new Error('Source stash not found.');
    const payload = await res.json() as EncryptedPayload;
    try {
      const result = await decrypt<Stash>(payload, password);
      return result.data;
    } catch {
      throw new Error('Incorrect password for source stash.');
    }
  };

  const handleCloneSubmit = async (sourceStash: Stash, newName: string, newId: string, newPassword: string) => {
    const checkRes = await fetch(`/api/stash/${newId}`);
    if (checkRes.ok) throw new Error(`Stash ID "${newId}" is already taken.`);
    
    const updatedStash: Stash = {
      ...sourceStash,
      id: newId,
      name: newName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    const payload = await encryptV2(updatedStash, newId, newPassword);
    const saveRes = await fetch('/api/stash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: newId, payload })
    });
    
    if (!saveRes.ok) {
      const err = await saveRes.json();
      throw new Error(err.error || 'Failed to clone stash.');
    }
    
    setShowCloneModal(false);
    router.push(`/stash/${newId}`);
  };

  const handleOpen = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = stashId.trim().toLowerCase();
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/stash/${id}`);
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || 'Stash not found.');
        return;
      }
      router.push(`/stash/${id}`);
    } catch {
      setError('Could not connect. Check your network.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="landing-hero" style={{ position: 'relative' }}>
      <div className="landing-card">
        {/* Eyebrow */}
        <div className="landing-eyebrow" style={{ animationDelay: '100ms' }}>
          <span style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', boxShadow: '0 0 6px var(--accent)' }} />
          Private · Encrypted
        </div>

        {/* Title */}
        <div>
          <h1 className="landing-title" style={{ animationDelay: '200ms', animationFillMode: 'both', animationName: 'slideUp' }}>
          Your links, fully <br />
          <span style={{ color: 'var(--accent)' }}>secured.</span>
        </h1>
          <p className="landing-sub" style={{ marginTop: 'var(--space-3)' }}>
            A private, password-encrypted repository for all your links.
            No tracking, no indexing — just your stuff.
          </p>
        </div>

        <hr className="landing-divider" />

        {/* Open stash form */}
        <form onSubmit={handleOpen} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          <div className="field">
            <label className="label" htmlFor="stash-id-input">Open a stash</label>
            <input
              id="stash-id-input"
              type="text"
              className={`input mono${error ? ' input-error' : ''}`}
              placeholder="Enter stash ID…"
              value={stashId}
              onChange={e => { setStashId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')); setError(''); }}
              autoComplete="off"
              spellCheck={false}
              maxLength={32}
            />
            {error && <span className="field-error">{error}</span>}
          </div>
          <button
            id="open-stash-btn"
            type="submit"
            className="btn btn-primary"
            disabled={!stashId.trim() || loading}
            style={{ width: '100%' }}
          >
            {loading ? <><span className="spinner spinner-sm" /> Looking up…</> : 'Open Stash →'}
          </button>
        </form>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
          or
          <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border)' }} />
        </div>

        {/* Info row */}
        <p className="text-sm text-muted" style={{ textAlign: 'center', lineHeight: 1.8 }}>
          Click <span className="badge badge-green" style={{ verticalAlign: 'middle', fontSize: '0.7rem' }}>+ New Stash</span> in the top bar to create one.
        </p>

        <button 
          className="btn btn-secondary" 
          style={{ width: '100%' }}
          onClick={() => setShowCloneModal(true)}
        >
          Clone a Stash
        </button>
      </div>

      {showCloneModal && (
        <CloneStashModal
          onVerifySource={handleVerifySource}
          onSubmit={handleCloneSubmit}
          onCancel={() => setShowCloneModal(false)}
        />
      )}

      <div style={{
        position: 'absolute',
        bottom: 'var(--space-6)',
        width: '100%',
        textAlign: 'center',
        fontSize: '0.75rem',
        color: 'var(--text-muted)',
        animation: 'fadeIn 1s ease 1s both'
      }}>
        Made with ♥ by <a href="https://github.com/The-Parth" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>The-Parth</a>
        <br />
        <span style={{ opacity: 0.25, fontSize: '0.65rem', marginTop: 'var(--space-1)', display: 'inline-block' }}>I love Koishi :3</span>
        <br />
        <span style={{ opacity: 0.3, fontSize: '0.65rem', marginTop: 'var(--space-1)', display: 'inline-block', fontFamily: 'var(--font-mono)' }}>
          Build:{' '}
          {process.env.NEXT_PUBLIC_APP_VERSION ? (
            <a 
              href={`https://github.com/The-Parth/stasher/commit/${process.env.NEXT_PUBLIC_APP_VERSION}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'inherit', textDecoration: 'underline' }}
            >
              {process.env.NEXT_PUBLIC_APP_VERSION}
            </a>
          ) : (
            'unknown'
          )}
        </span>
      </div>
    </main>
  );
}
