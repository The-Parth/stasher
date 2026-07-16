'use client';
import { useState } from 'react';
import type { StashSection } from '@/lib/types';
import { createSection } from '@/lib/stash';

const MAX_DESC = 200;

interface SectionFormProps {
  initial?: StashSection | null;
  depth: number; // 1 = root level, 2 = second, 3 = third
  onSave: (section: StashSection) => void;
  onCancel: () => void;
}

export default function SectionForm({ initial, depth, onSave, onCancel }: SectionFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const section: StashSection = initial
      ? { ...initial, title: title.trim(), description: description.slice(0, MAX_DESC) }
      : { ...createSection(title.trim()), description: description.slice(0, MAX_DESC) };
    onSave(section);
  };

  const descLen = description.length;
  const counterClass = descLen > MAX_DESC ? 'char-counter over' : descLen > MAX_DESC - 30 ? 'char-counter near' : 'char-counter';

  const depthLabel = ['', 'root', 'sub-', 'sub-sub-'][depth] || '';

  return (
    <div className="form-panel">
      <div className="form-panel-title">{initial ? 'Edit section' : `Add ${depthLabel}section`}</div>
      <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
        <div className="field">
          <label className="label" htmlFor="sf-title">Title</label>
          <input id="sf-title" type="text" className="input" placeholder="Section name…" value={title} onChange={e => setTitle(e.target.value)} autoFocus maxLength={80} />
        </div>
        <div className="field">
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="sf-desc">Description <span style={{ textTransform: 'none', fontWeight: 400, color: 'var(--text-disabled)' }}>(optional)</span></label>
            <span className={counterClass}>{descLen}/{MAX_DESC}</span>
          </div>
          <textarea
            id="sf-desc" className="input" placeholder="What's in this section…"
            value={description} onChange={e => setDescription(e.target.value.slice(0, MAX_DESC))}
            rows={2}
          />
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!title.trim()} id="sf-save">Save section</button>
        </div>
      </form>
    </div>
  );
}
