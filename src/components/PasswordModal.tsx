'use client';
import { useEffect, useRef, useState } from 'react';

interface PasswordModalProps {
  title?: string;
  description?: string;
  submitLabel?: string;
  error?: string;
  isLoading?: boolean;
  onSubmit: (password: string) => void;
  onCancel?: () => void;
}

export default function PasswordModal({
  title = 'Enter Password',
  description,
  submitLabel = 'Unlock',
  error,
  isLoading = false,
  onSubmit,
  onCancel,
}: PasswordModalProps) {
  const [password, setPassword] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && onCancel) onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password && !isLoading) onSubmit(password);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onCancel?.()}>
      <div className="modal" role="dialog" aria-modal aria-labelledby="pw-title">
        <div className="modal-title">
          <span style={{ fontSize: '1.3rem' }}>🔑</span>
          <span id="pw-title">{title}</span>
        </div>
        {description && <p className="text-sm text-muted" style={{ marginBottom: 'var(--space-5)' }}>{description}</p>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label" htmlFor="pw-input">Password</label>
            <input
              ref={inputRef} id="pw-input" type="password"
              className={`input${error ? ' input-error' : ''}`}
              placeholder="Enter password…" value={password}
              onChange={e => setPassword(e.target.value)}
              disabled={isLoading} autoComplete="current-password"
            />
            {error && <span className="field-error">{error}</span>}
          </div>
          <div className="modal-actions">
            {onCancel && <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={isLoading}>Cancel</button>}
            <button type="submit" className="btn btn-primary" disabled={!password || isLoading} id="pw-submit">
              {isLoading ? <><span className="spinner spinner-sm" /> Unlocking…</> : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
