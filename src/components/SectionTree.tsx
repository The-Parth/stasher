'use client';
import type { StashSection } from '@/lib/types';
import { useState } from 'react';

interface SectionTreeProps {
  sections: StashSection[];
  activePath: string[];
  onSelectRoot: () => void;
  onSelectSection: (path: string[]) => void;
  onAddSection: (parentPath: string[]) => void;
  depth?: number;
  parentPath?: string[];
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SectionNode({
  section,
  activePath,
  currentPath,
  onSelectSection,
  onAddSection,
  depth,
}: {
  section: StashSection;
  activePath: string[];
  currentPath: string[];
  onSelectSection: (path: string[]) => void;
  onAddSection: (parentPath: string[]) => void;
  depth: number;
}) {
  const myPath = [...currentPath, section.id];
  const isActive = activePath.length === myPath.length && myPath.every((id, i) => activePath[i] === id);
  const isAncestor = myPath.every((id, i) => activePath[i] === id);
  const [open, setOpen] = useState(isAncestor || isActive);
  const hasChildren = section.children.length > 0;
  const canNest = depth < 3;

  return (
    <div className="tree-item-group">
      <div
        className={`tree-item${isActive ? ' active' : ''}`}
        onClick={() => { onSelectSection(myPath); setOpen(true); }}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { onSelectSection(myPath); setOpen(true); } }}
        aria-current={isActive ? 'page' : undefined}
      >
        <button
          className="btn-icon"
          style={{ padding: '1px', marginRight: '-4px', opacity: hasChildren ? 0.6 : 0.2, flexShrink: 0 }}
          onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
          aria-label={open ? 'Collapse' : 'Expand'}
          tabIndex={-1}
        >
          <ChevronIcon className={`tree-chevron${open ? ' open' : ''}`} />
        </button>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
          {section.title}
        </span>
        <span className="badge badge-muted" style={{ fontSize: '0.65rem', padding: '1px 5px' }}>
          {section.links.length}
        </span>
      </div>

      {open && (
        <div className="tree-children">
          {section.children.map(child => (
            <SectionNode
              key={child.id}
              section={child}
              activePath={activePath}
              currentPath={myPath}
              onSelectSection={onSelectSection}
              onAddSection={onAddSection}
              depth={depth + 1}
            />
          ))}
          {canNest && (
            <button className="tree-add-btn" onClick={() => onAddSection(myPath)} id={`add-section-${section.id}`}>
              <span>+</span> Add section
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function SectionTree({
  sections,
  activePath,
  onSelectRoot,
  onSelectSection,
  onAddSection,
}: SectionTreeProps) {
  const isRootActive = activePath.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div
        className={`tree-item${isRootActive ? ' active' : ''}`}
        onClick={onSelectRoot}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onSelectRoot(); }}
        aria-current={isRootActive ? 'page' : undefined}
        id="tree-root"
      >
        <span style={{ fontSize: '0.9rem', marginRight: '2px' }}>⊚</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>All links</span>
      </div>

      {sections.map(section => (
        <SectionNode
          key={section.id}
          section={section}
          activePath={activePath}
          currentPath={[]}
          onSelectSection={onSelectSection}
          onAddSection={onAddSection}
          depth={1}
        />
      ))}

      <button className="tree-add-btn" onClick={() => onAddSection([])} style={{ marginTop: 'var(--space-2)' }} id="add-root-section-btn">
        <span>+</span> Add section
      </button>
    </div>
  );
}
