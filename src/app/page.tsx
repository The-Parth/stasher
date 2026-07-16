'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const [stashId, setStashId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      </div>

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
      </div>
    </main>
  );
}
