/**
 * TimeSlotCell.tsx
 *
 * A single cell in the timetable grid (one day × one time-slot).
 *
 * Visual states
 * ─────────────
 *   idle           – base zinc-900 background, zinc-800 border
 *   source-ghost   – the cell currently being dragged FROM (fades SubjectBlock)
 *   over-checking  – animate-pulse, waiting for conflict API
 *   over-valid     – green highlight, ready to accept drop
 *   over-invalid   – red highlight, won't accept drop
 *   in-swap-mode   – blue ring, waiting for user to pick swap target
 *
 * The cell is also a click target for swap-mode completion.
 */

'use client';

import React, { MouseEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useGridStore } from '@/store/useGridStore';
import SubjectBlock     from './SubjectBlock';

interface TimeSlotCellProps {
  day:      string;
  timeSlot: string;
  onContextMenu?: (e: MouseEvent<HTMLDivElement>, day: string, timeSlot: string) => void;
  /** Called when this cell is clicked during swap mode */
  onSwapClick?: (day: string, timeSlot: string) => void;
}

function TimeSlotCell({ day, timeSlot, onContextMenu, onSwapClick }: TimeSlotCellProps) {
  const id = `${day}__${timeSlot}`;

  const slotData       = useGridStore((s) => s.grid[day]?.[timeSlot] ?? null);
  const conflictState  = useGridStore((s) => s.dragState.conflictMap[id]);
  const draggedSlot    = useGridStore((s) => s.dragState.draggedSlot);
  const swapModeSource = useGridStore((s) => s.swapModeSource);

  const isDragSource =
    draggedSlot?.day === day && draggedSlot?.timeSlot === timeSlot;

  const isSwapTarget =
    swapModeSource !== null &&
    !(swapModeSource.day === day && swapModeSource.timeSlot === timeSlot);

  const { setNodeRef, isOver } = useDroppable({ id });

  // ── Visual class composition ──────────────────────────────────────────────

  let borderClass = 'border border-zinc-800';
  let bgClass     = 'bg-zinc-900';

  if (isDragSource) {
    borderClass = 'border border-dashed border-zinc-600';
    bgClass     = 'bg-zinc-900/50';
  } else if (isSwapTarget) {
    borderClass = 'border-2 border-blue-500';
    bgClass     = 'bg-blue-950/30';
  } else if (isOver) {
    if (!conflictState || conflictState === 'unchecked') {
      borderClass = 'border-2 border-zinc-500 animate-pulse';
      bgClass     = 'bg-zinc-800/60';
    } else if (conflictState === 'valid') {
      borderClass = 'border-2 border-green-400';
      bgClass     = 'bg-green-950/40 shadow-inner shadow-green-400/10';
    } else {
      borderClass = 'border-2 border-red-500';
      bgClass     = 'bg-red-950/40 shadow-inner shadow-red-500/10';
    }
  }

  const handleClick = () => {
    if (swapModeSource && onSwapClick) {
      onSwapClick(day, timeSlot);
    }
  };

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={`
        relative min-h-[72px] rounded-md p-0.5 transition-all duration-100
        ${borderClass} ${bgClass}
        ${isSwapTarget ? 'cursor-crosshair' : ''}
      `}
    >
      {slotData ? (
        <SubjectBlock
          day={day}
          timeSlot={timeSlot}
          data={slotData}
          onContextMenu={onContextMenu}
        />
      ) : (
        /* Empty slot hint */
        isOver && conflictState === 'valid' ? (
          <div className="flex h-full items-center justify-center text-[10px] text-green-400/70">
            Drop here
          </div>
        ) : null
      )}
    </div>
  );
}

export default React.memo(TimeSlotCell);
