'use client';
import { useState } from 'react';
import type { EncryptedPayloadV2 } from '@/lib/types';
import { generateEditToken, hashEditToken, wrapMasterKey, bufToB64 } from '@/lib/crypto';
import { useRouter } from 'next/navigation';

interface StashSettingsModalProps {
  stashId: string;
  payload: EncryptedPayloadV2;
  masterKey: CryptoKey;
  editToken: string;
  onClose: () => void;
  onUpdated: (newPayload: EncryptedPayloadV2, newEditToken: string) => void;
}

export default function StashSettingsModal({
  stashId,
  payload,
  masterKey,
  editToken,
  onClose,
  onUpdated,
}: StashSettingsModalProps) {
  const [tab, setTab] = useState<'read' | 'master' | 'danger'>('read');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const router = useRouter();

  // Master Password Form
  const [newMasterPw, setNewMasterPw] = useState('');
  const [confirmMasterPw, setConfirmMasterPw] = useState('');

  // Read Password Form
  const [newReadPw, setNewReadPw] = useState('');
  const [confirmReadPw, setConfirmReadPw] = useState('');

  // Danger Form
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const clearMessages = () => { setError(''); setSuccess(''); };

  const handleUpdateMaster = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (newMasterPw !== confirmMasterPw) return setError('Passwords do not match.');
    if (newMasterPw.length < 4) return setError('Password must be at least 4 characters.');

    setLoading(true);
    try {
      const { salt: masterSalt, wrappedKey: masterWrappedKey } = await wrapMasterKey(masterKey, newMasterPw);
      const newEditToken = await generateEditToken(newMasterPw, stashId);
      const authSaltArray = new Uint8Array(16);
      crypto.getRandomValues(authSaltArray);
      const authSalt = bufToB64(authSaltArray.buffer);
      const authVerifyHash = await hashEditToken(newEditToken, authSalt);

      const newPayload: EncryptedPayloadV2 = {
        ...payload,
        masterSalt,
        masterWrappedKey,
        authVerifyHash,
        authSalt,
      };

      const res = await fetch(`/api/stash/${stashId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${editToken}`
        },
        body: JSON.stringify(newPayload),
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update.');
      
      setSuccess('Master password changed successfully!');
      setNewMasterPw(''); setConfirmMasterPw('');
      onUpdated(newPayload, newEditToken);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRead = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (newReadPw && newReadPw !== confirmReadPw) return setError('Passwords do not match.');

    setLoading(true);
    try {
      let readSalt, readWrappedKey;
      if (newReadPw) {
        const wrapped = await wrapMasterKey(masterKey, newReadPw);
        readSalt = wrapped.salt;
        readWrappedKey = wrapped.wrappedKey;
      }

      const newPayload: EncryptedPayloadV2 = {
        ...payload,
        readSalt,
        readWrappedKey,
      };

      // If newReadPw is empty, we remove the read credentials.
      if (!newReadPw) {
        delete newPayload.readSalt;
        delete newPayload.readWrappedKey;
      }

      const res = await fetch(`/api/stash/${stashId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${editToken}`
        },
        body: JSON.stringify(newPayload),
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to update.');
      
      setSuccess(newReadPw ? 'Read-only password updated!' : 'Read-only password removed!');
      setNewReadPw(''); setConfirmReadPw('');
      onUpdated(newPayload, editToken);
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessages();
    if (deleteConfirm !== stashId) return setError('Stash ID does not match.');

    setLoading(true);
    try {
      const res = await fetch(`/api/stash/${stashId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${editToken}`
        },
      });

      if (!res.ok) throw new Error((await res.json()).error || 'Failed to delete.');
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'An error occurred.');
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }} role="dialog" aria-modal aria-labelledby="settings-title">
        <div className="modal-title">
          <span style={{ fontSize: '1.3rem' }}>⚙</span>
          <span id="settings-title">Stash Settings</span>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border)', paddingBottom: 'var(--space-2)' }}>
          <button className={`btn-ghost btn-sm ${tab === 'read' ? 'active' : ''}`} onClick={() => { setTab('read'); clearMessages(); }} style={{ background: tab === 'read' ? 'var(--surface-hover)' : 'transparent' }}>Read-Only</button>
          <button className={`btn-ghost btn-sm ${tab === 'master' ? 'active' : ''}`} onClick={() => { setTab('master'); clearMessages(); }} style={{ background: tab === 'master' ? 'var(--surface-hover)' : 'transparent' }}>Master Password</button>
          <button className={`btn-ghost btn-sm ${tab === 'danger' ? 'active' : ''}`} onClick={() => { setTab('danger'); clearMessages(); }} style={{ background: tab === 'danger' ? 'var(--error-bg)' : 'transparent', color: tab === 'danger' ? 'var(--error)' : undefined }}>Danger</button>
        </div>

        {error && <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}>{error}</div>}
        {success && <div style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--space-3)', fontSize: '0.85rem' }}>{success}</div>}

        {tab === 'read' && (
          <form onSubmit={handleUpdateRead} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p className="text-sm text-muted">A read-only password allows others to view this stash without the ability to edit or delete anything. Leave blank to remove.</p>
            <div className="field">
              <label className="label">New Read Password</label>
              <input type="password" placeholder="Enter new read password…" className="input" value={newReadPw} onChange={e => setNewReadPw(e.target.value)} disabled={loading} />
            </div>
            {newReadPw && (
              <div className="field">
                <label className="label">Confirm Read Password</label>
                <input type="password" placeholder="Confirm new read password…" className="input" value={confirmReadPw} onChange={e => setConfirmReadPw(e.target.value)} disabled={loading} />
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: 'var(--space-2)' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Save Changes'}</button>
            </div>
          </form>
        )}

        {tab === 'master' && (
          <form onSubmit={handleUpdateMaster} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <p className="text-sm text-muted">Change your master password. Because of our advanced crypto architecture, this change happens instantly without needing to re-encrypt your links!</p>
            <div className="field">
              <label className="label">New Master Password</label>
              <input type="password" placeholder="Enter new master password…" className="input" value={newMasterPw} onChange={e => setNewMasterPw(e.target.value)} disabled={loading} required />
            </div>
            <div className="field">
              <label className="label">Confirm Master Password</label>
              <input type="password" placeholder="Confirm new master password…" className="input" value={confirmMasterPw} onChange={e => setConfirmMasterPw(e.target.value)} disabled={loading} required />
            </div>
            <div className="modal-actions" style={{ marginTop: 'var(--space-2)' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Close</button>
              <button type="submit" className="btn btn-primary" disabled={loading || !newMasterPw}>{loading ? 'Changing…' : 'Change Master Password'}</button>
            </div>
          </form>
        )}

        {tab === 'danger' && (
          <form onSubmit={handleDelete} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ background: 'var(--error-bg)', border: '1px solid var(--error)', padding: 'var(--space-3)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}>
              <strong style={{ color: 'var(--error)', display: 'block', marginBottom: '8px' }}>Warning: Permanent Deletion</strong>
              This will permanently delete your stash and all its contents from our servers. This action cannot be undone.
            </div>
            <div className="field">
              <label className="label">Type <strong className="mono">{stashId}</strong> to confirm</label>
              <input type="text" className="input" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} disabled={loading} placeholder={stashId} required />
            </div>
            <div className="modal-actions" style={{ marginTop: 'var(--space-2)' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ background: 'var(--error)', color: '#fff', border: 'none' }} disabled={loading || deleteConfirm !== stashId}>
                {loading ? 'Deleting…' : 'Permanently Delete Stash'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
