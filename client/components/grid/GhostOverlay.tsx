/**
 * GhostOverlay.tsx
 *
 * Renders the floating drag preview via @dnd-kit/core DragOverlay.
 * Must be mounted INSIDE DndContext.
 *
 * Shows a slightly scaled-up (1.05x) copy of the dragged SubjectBlock
 * with an elevated drop-shadow so it clearly floats over the grid.
 */

'use client';

import React from 'react';
import { DragOverlay } from '@dnd-kit/core';
import { useGridStore, GridSlotData } from '@/store/useGridStore';
import { getSubjectColor }            from '@/lib/colorMap';

interface GhostOverlayProps {
  activeId: string | null;
}

function FloatingCard({ data }: { data: GridSlotData }) {
  const viewMode = useGridStore((s) => s.viewMode);
  const color    = getSubjectColor(data.subject_id);

  return (
    <div
      style={{ transform: 'scale(1.05)', transformOrigin: 'center' }}
      className={`
        flex min-h-[72px] w-40 cursor-grabbing flex-col justify-between
        overflow-hidden rounded-md border px-2 py-1.5 shadow-2xl shadow-black/60
        ${color.bg} ${color.border}
      `}
    >
      <div className={`truncate text-[11px] font-bold leading-tight ${color.text}`}>
        {viewMode === 'paper_code'
          ? (data.paper_code || data.subject_code)
          : data.teacher_name}
      </div>
      <div className="truncate text-[10px] text-zinc-400">
        {viewMode === 'paper_code'
          ? data.subject_name
          : `M${data.module_number} · ${data.module_name}`}
      </div>
      <span className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${color.dot}`} />
    </div>
  );
}

export default function GhostOverlay({ activeId }: GhostOverlayProps) {
  const grid = useGridStore((s) => s.grid);

  const draggedData: GridSlotData | null = React.useMemo(() => {
    if (!activeId) return null;
    const [day, timeSlot] = activeId.split('__');
    return grid[day]?.[timeSlot] ?? null;
  }, [activeId, grid]);

  return (
    <DragOverlay dropAnimation={null}>
      {draggedData ? <FloatingCard data={draggedData} /> : null}
    </DragOverlay>
  );
}
