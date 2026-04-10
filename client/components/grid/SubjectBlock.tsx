/**
 * SubjectBlock.tsx
 *
 * The coloured card that represents a scheduled subject inside a cell.
 *
 * • Draggable via @dnd-kit/core useDraggable.
 * • Shows paper_code or teacher+module depending on viewMode.
 * • Emits onContextMenu to open SlotContextMenu.
 * • When isDragging the card fades to a ghost (opacity-30).
 */

'use client';

import React, { MouseEvent } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS }          from '@dnd-kit/utilities';
import { useGridStore, GridSlotData } from '@/store/useGridStore';
import { getSubjectColor }            from '@/lib/colorMap';

interface SubjectBlockProps {
  day:      string;
  timeSlot: string;
  data:     GridSlotData;
  /** Called when the user right-clicks – parent uses this to open context menu. */
  onContextMenu?: (e: MouseEvent<HTMLDivElement>, day: string, timeSlot: string) => void;
}

function SubjectBlock({ day, timeSlot, data, onContextMenu }: SubjectBlockProps) {
  const viewMode = useGridStore((s) => s.viewMode);
  const id       = `${day}__${timeSlot}`;
  const color    = getSubjectColor(data.subject_id);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id });

  const handleContextMenu = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    onContextMenu?.(e, day, timeSlot);
  };

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onContextMenu={handleContextMenu}
      className={`
        relative flex h-full w-full cursor-grab flex-col justify-between
        overflow-hidden rounded-md border px-2 py-1.5 transition-opacity
        active:cursor-grabbing select-none
        ${color.bg} ${color.border}
        ${isDragging ? 'opacity-25' : 'opacity-100'}
      `}
    >
      {/* ── Primary label ─────────────────────────────────────────────────── */}
      <div className={`truncate text-[11px] font-bold leading-tight ${color.text}`}>
        {viewMode === 'paper_code'
          ? (data.paper_code || data.subject_code)
          : `${data.teacher_name}`}
      </div>

      {/* ── Secondary label ───────────────────────────────────────────────── */}
      <div className="truncate text-[10px] text-zinc-400">
        {viewMode === 'paper_code'
          ? data.subject_name
          : `M${data.module_number} · ${data.module_name}`}
      </div>

      {/* ── Colour dot ────────────────────────────────────────────────────── */}
      <span
        className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${color.dot}`}
      />
    </div>
  );
}

export default React.memo(SubjectBlock);
