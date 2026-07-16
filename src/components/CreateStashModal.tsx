'use client';
import { useEffect, useRef, useState } from 'react';
import { generateStashId, validateStashId } from '@/lib/stash';

interface CreateStashModalProps {
  onSubmit: (name: string, id: string, password: string, readPassword?: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
  error?: string;
}

export default function CreateStashModal({
  onSubmit,
  onCancel,
  isLoading = false,
  error,
}: CreateStashModalProps) {
  const [name, setName] = useState('');
  const [customId, setCustomId] = useState('');
  const [useCustomId, setUseCustomId] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [readPassword, setReadPassword] = useState('');
  const [generatedId] = useState(() => generateStashId());
  const [localError, setLocalError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 50); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const finalId = useCustomId ? customId.trim() : generatedId;

  const validate = (): string | null => {
    if (!name.trim()) return 'Name is required.';
    if (useCustomId && !validateStashId(finalId)) return 'ID must be 4–32 lowercase letters/numbers.';
    if (!password) return 'Password is required.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate();
    if (err) { setLocalError(err); return; }
    setLocalError('');
    onSubmit(name.trim(), finalId, password, readPassword || undefined);
  };

  const displayError = error || localError;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 480 }} role="dialog" aria-modal aria-labelledby="cs-title">
        <div className="modal-title">
          <span style={{ fontSize: '1.3rem' }}>✦</span>
          <span id="cs-title">Create a Stash</span>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div className="field">
            <label className="label" htmlFor="cs-name">Stash name</label>
            <input ref={nameRef} id="cs-name" type="text" className="input" placeholder="My links…" value={name} onChange={e => setName(e.target.value)} disabled={isLoading} maxLength={80} />
          </div>
          <div className="field">
            <div className="flex items-center justify-between">
              <label className="label" htmlFor="cs-id">Stash ID</label>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setUseCustomId(v => !v)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                {useCustomId ? 'Use random' : 'Customize'}
              </button>
            </div>
            {useCustomId ? (
              <input id="cs-id" type="text" className="input mono" placeholder="my-stash-id" value={customId} onChange={e => setCustomId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} disabled={isLoading} maxLength={32} />
            ) : (
              <div className="input mono" style={{ color: 'var(--text-muted)', userSelect: 'all', cursor: 'default' }}>{generatedId}</div>
            )}
            <span className="field-hint">Accessible at <span className="mono">/stash/{finalId || '…'}</span></span>
          </div>
          <div className="field">
            <label className="label" htmlFor="cs-pw">Password</label>
            <input id="cs-pw" type="password" className="input" placeholder="Choose a strong password…" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} autoComplete="new-password" />
          </div>
          <div className="field">
            <label className="label" htmlFor="cs-cpw">Confirm password</label>
            <input id="cs-cpw" type="password" className={`input${confirmPassword && password !== confirmPassword ? ' input-error' : ''}`} placeholder="Repeat password…" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isLoading} autoComplete="new-password" />
          </div>
          <div className="field">
            <label className="label" htmlFor="cs-rpw">Read-only password (Optional)</label>
            <input id="cs-rpw" type="password" className="input" placeholder="Allows read access without edit rights" value={readPassword} onChange={e => setReadPassword(e.target.value)} disabled={isLoading} autoComplete="new-password" />
          </div>
          {displayError && (
            <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', fontSize: '0.83rem', color: 'var(--error)' }}>
              {displayError}
            </div>
          )}
          <div style={{ background: 'var(--yellow-glow)', border: '1px solid rgba(232,212,77,0.2)', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', fontSize: '0.78rem', color: 'var(--yellow)', display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
            <span style={{ flexShrink: 0 }}>⚠</span>
            <span>Losing your password makes this stash <strong>unrecoverable</strong>.</span>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isLoading || !name || !password || !confirmPassword} id="create-stash-submit">
              {isLoading ? <><span className="spinner spinner-sm" /> Creating…</> : 'Create Stash'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
