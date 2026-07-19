'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { StashSection } from '@/lib/types';

interface SortableSectionCardProps {
  section: StashSection;
  onClick: () => void;
  isAdmin: boolean;
}

export default function SortableSectionCard({ section, onClick, isAdmin }: SortableSectionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : undefined,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <button
        className="card-sm section-card"
        onClick={onClick}
        id={`section-card-${section.id}`}
      >
        {isAdmin && (
          <span
            className="drag-handle section-drag-handle"
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
            aria-label="Drag to reorder"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <circle cx="5" cy="3" r="1.5" /><circle cx="11" cy="3" r="1.5" />
              <circle cx="5" cy="8" r="1.5" /><circle cx="11" cy="8" r="1.5" />
              <circle cx="5" cy="13" r="1.5" /><circle cx="11" cy="13" r="1.5" />
            </svg>
          </span>
        )}
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {section.title}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {section.links.length} link{section.links.length !== 1 ? 's' : ''} · {section.children.length} section{section.children.length !== 1 ? 's' : ''}
        </div>
      </button>
    </div>
  );
}
