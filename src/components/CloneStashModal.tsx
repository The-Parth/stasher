'use client';
import { useEffect, useRef, useState } from 'react';
import { generateStashId, validateStashId } from '@/lib/stash';
import type { Stash } from '@/lib/types';

interface CloneStashModalProps {
  onVerifySource: (id: string, password: string) => Promise<Stash>;
  onSubmit: (sourceStash: Stash, newName: string, newId: string, newPassword: string) => Promise<void>;
  onCancel: () => void;
}

export default function CloneStashModal({
  onVerifySource,
  onSubmit,
  onCancel,
}: CloneStashModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  // Step 1
  const [sourceId, setSourceId] = useState('');
  const [sourcePassword, setSourcePassword] = useState('');
  const [sourceStash, setSourceStash] = useState<Stash | null>(null);

  // Step 2
  const [name, setName] = useState('');
  const [customId, setCustomId] = useState('');
  const [useCustomId, setUseCustomId] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [generatedId] = useState(() => generateStashId());

  const sourceIdRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { 
    if (step === 1) setTimeout(() => sourceIdRef.current?.focus(), 50); 
    if (step === 2) setTimeout(() => nameRef.current?.focus(), 50); 
  }, [step]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const finalId = useCustomId ? customId.trim() : generatedId;

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId.trim()) return setLocalError('Source ID is required.');
    if (!sourcePassword) return setLocalError('Source password is required.');
    
    setLocalError('');
    setIsLoading(true);
    try {
      const stash = await onVerifySource(sourceId.trim().toLowerCase(), sourcePassword);
      setSourceStash(stash);
      setName(`Clone of ${stash.name}`);
      setStep(2);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to verify source stash.');
    } finally {
      setIsLoading(false);
    }
  };

  const validateStep2 = (): string | null => {
    if (!name.trim()) return 'Name is required.';
    if (useCustomId && !validateStashId(finalId)) return 'ID must be 4–32 lowercase letters/numbers.';
    if (!password) return 'Password is required.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStep2();
    if (err) return setLocalError(err);
    if (!sourceStash) return;

    setLocalError('');
    setIsLoading(true);
    try {
      await onSubmit(sourceStash, name.trim(), finalId, password);
    } catch (err: any) {
      setLocalError(err.message || 'Failed to clone stash.');
      setIsLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ maxWidth: 480 }} role="dialog" aria-modal aria-labelledby="cs-title">
        <div className="modal-title">
          <span style={{ fontSize: '1.3rem' }}>✦</span>
          <span id="cs-title">Clone Stash</span>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p className="text-sm text-muted" style={{ marginTop: '-var(--space-4)' }}>
              Enter the details of the stash you want to copy. You can use either the master or read-only password.
            </p>
            <div className="field">
              <label className="label" htmlFor="src-id">Source Stash ID</label>
              <input ref={sourceIdRef} id="src-id" type="text" className="input mono" placeholder="my-stash-id" value={sourceId} onChange={e => setSourceId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} disabled={isLoading} maxLength={32} />
            </div>
            <div className="field">
              <label className="label" htmlFor="src-pw">Source Password</label>
              <input id="src-pw" type="password" className="input" placeholder="Password for the source stash…" value={sourcePassword} onChange={e => setSourcePassword(e.target.value)} disabled={isLoading} />
            </div>
            {localError && (
              <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', fontSize: '0.83rem', color: 'var(--error)' }}>
                {localError}
              </div>
            )}
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={isLoading}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isLoading || !sourceId || !sourcePassword}>
                {isLoading ? <><span className="spinner spinner-sm" /> Verifying…</> : 'Next →'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <p className="text-sm text-muted" style={{ marginTop: '-var(--space-4)' }}>
              Set up the new cloned stash.
            </p>
            <div className="field">
              <label className="label" htmlFor="cs-name">New Stash Name</label>
              <input ref={nameRef} id="cs-name" type="text" className="input" placeholder="My cloned links…" value={name} onChange={e => setName(e.target.value)} disabled={isLoading} maxLength={80} />
            </div>
            <div className="field">
              <div className="flex items-center justify-between">
                <label className="label" htmlFor="cs-id">New Stash ID</label>
                <button type="button" className="btn-ghost btn-sm" onClick={() => setUseCustomId(v => !v)} style={{ fontSize: '0.75rem', padding: '2px 8px' }}>
                  {useCustomId ? 'Use random' : 'Customize'}
                </button>
              </div>
              {useCustomId ? (
                <input id="cs-id" type="text" className="input mono" placeholder="new-stash-id" value={customId} onChange={e => setCustomId(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))} disabled={isLoading} maxLength={32} />
              ) : (
                <div className="input mono" style={{ color: 'var(--text-muted)', userSelect: 'all', cursor: 'default' }}>{generatedId}</div>
              )}
              <span className="field-hint">Accessible at <span className="mono">/stash/{finalId || '…'}</span></span>
            </div>
            <div className="field">
              <label className="label" htmlFor="cs-pw">New Master Password</label>
              <input id="cs-pw" type="password" className="input" placeholder="Choose a strong password…" value={password} onChange={e => setPassword(e.target.value)} disabled={isLoading} autoComplete="new-password" />
            </div>
            <div className="field">
              <label className="label" htmlFor="cs-cpw">Confirm Password</label>
              <input id="cs-cpw" type="password" className={`input${confirmPassword && password !== confirmPassword ? ' input-error' : ''}`} placeholder="Repeat password…" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} disabled={isLoading} autoComplete="new-password" />
            </div>
            
            {localError && (
              <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 'var(--radius)', padding: 'var(--space-3) var(--space-4)', fontSize: '0.83rem', color: 'var(--error)' }}>
                {localError}
              </div>
            )}
            
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => { setStep(1); setLocalError(''); }} disabled={isLoading}>← Back</button>
              <button type="submit" className="btn btn-primary" disabled={isLoading || !password || !confirmPassword || !name.trim()}>
                {isLoading ? <><span className="spinner spinner-sm" /> Cloning…</> : 'Clone Stash'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
