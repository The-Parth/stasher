'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { StashLink } from '@/lib/types';
import LinkItem from './LinkItem';

interface SortableLinkProps {
  link: StashLink;
  onEdit?: (link: StashLink) => void;
  onDelete?: (id: string) => void;
}

export default function SortableLink({ link, onEdit, onDelete }: SortableLinkProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: link.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 100 : undefined,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <LinkItem
        link={link}
        onEdit={onEdit}
        onDelete={onDelete}
        dragHandleProps={onEdit ? { ...attributes, ...listeners } : undefined}
      />
    </div>
  );
}
