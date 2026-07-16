'use client';
import { useState } from 'react';
import type { StashLink } from '@/lib/types';
import { createLink } from '@/lib/stash';

interface LinkFormProps {
  initial?: StashLink | null;
  onSave: (link: StashLink) => void;
  onCancel: () => void;
}

export default function LinkForm({ initial, onSave, onCancel }: LinkFormProps) {
  const [url, setUrl] = useState(initial?.url ?? '');
  const [label, setLabel] = useState(initial?.label ?? '');
  const [previewText, setPreviewText] = useState(initial?.previewText ?? '');
  const [urlError, setUrlError] = useState('');

  const validate = (): boolean => {
    try {
      new URL(url);
      setUrlError('');
      return true;
    } catch {
      setUrlError('Enter a valid URL (e.g. https://example.com).');
      return false;
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const link: StashLink = initial
      ? { ...initial, url: url.trim(), label: label.trim(), previewText: previewText.trim() }
      : { ...createLink(url.trim(), label.trim()), previewText: previewText.trim() };
    onSave(link);
  };

  return (
    <div className="form-panel">
      <div className="form-panel-title">{initial ? 'Edit link' : 'Add link'}</div>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div className="field">
          <label className="label" htmlFor="lf-url">URL</label>
          <input
            id="lf-url" type="url" className={`input${urlError ? ' input-error' : ''}`}
            placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)}
            autoFocus
          />
          {urlError && <span className="field-error">{urlError}</span>}
        </div>
        <div className="field">
          <label className="label" htmlFor="lf-label">Label <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-disabled)' }}>(optional)</span></label>
          <input id="lf-label" type="text" className="input" placeholder="My link…" value={label} onChange={e => setLabel(e.target.value)} maxLength={120} />
        </div>
        <div className="field">
          <label className="label" htmlFor="lf-preview">Preview text <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-disabled)' }}>(optional)</span></label>
          <textarea id="lf-preview" className="input" placeholder="Short description…" value={previewText} onChange={e => setPreviewText(e.target.value)} maxLength={300} rows={2} />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!url} id="lf-save">Save link</button>
        </div>
      </form>
    </div>
  );
}
