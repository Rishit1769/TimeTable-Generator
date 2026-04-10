/**
 * TimetableGrid.tsx
 *
 * Main grid component — owns the DndContext and handles all DnD lifecycle,
 * conflict checking, and forwarding swap-mode clicks.
 *
 * Layout
 * ──────
 *   " " │ MON │ TUE │ … │ SAT
 * ───────┼─────┼─────┼───┼─────
 *  09:00 │cell │cell │   │cell
 *  10:00 │cell │…
 *
 * Implemented as a CSS grid:
 *   gridTemplateColumns: 80px repeat(N, 1fr)
 */

'use client';

import React, { MouseEvent, useState } from 'react';
import {
  DndContext,
  closestCenter,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useGridStore }        from '@/store/useGridStore';
import { useConflictChecker }  from '@/hooks/useConflictChecker';
import { formatTimeSlot }      from '@/lib/grid.utils';
import DayColumn               from './DayColumn';
import TimeSlotCell            from './TimeSlotCell';
import GhostOverlay            from './GhostOverlay';

interface TimetableGridProps {
  onContextMenu: (
    e:       MouseEvent<HTMLDivElement>,
    day:     string,
    timeSlot: string,
  ) => void;
}

export default function TimetableGrid({ onContextMenu }: TimetableGridProps) {
  const days        = useGridStore((s) => s.days);
  const timeSlots   = useGridStore((s) => s.timeSlots);
  const isLoading   = useGridStore((s) => s.isLoading);
  const moveSlot    = useGridStore((s) => s.moveSlot);
  const swapSlots   = useGridStore((s) => s.swapSlots);
  const setDragState     = useGridStore((s) => s.setDragState);
  const clearConflictMap = useGridStore((s) => s.clearConflictMap);
  const swapModeSource   = useGridStore((s) => s.swapModeSource);
  const setSwapModeSource = useGridStore((s) => s.setSwapModeSource);
  const dragState        = useGridStore((s) => s.dragState);

  const { check } = useConflictChecker();

  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 }, // require 6px movement before drag starts
    }),
  );

  // ── Drag lifecycle ──────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id.toString();
    const [day, timeSlot] = id.split('__');
    setActiveId(id);
    setDragState({ isDragging: true, draggedSlot: { day, timeSlot } });
  };

  const handleDragOver = (event: DragOverEvent) => {
    if (!event.over) return;
    const [day, timeSlot] = event.over.id.toString().split('__');
    const { draggedSlot } = dragState;
    if (!draggedSlot) return;

    // Same cell — no check needed
    if (draggedSlot.day === day && draggedSlot.timeSlot === timeSlot) return;

    const grid = useGridStore.getState().grid;
    const dragged = grid[draggedSlot.day]?.[draggedSlot.timeSlot];
    if (!dragged) return;

    check(day, timeSlot, {
      subject_id:  dragged.subject_id,
      teacher_id:  dragged.teacher_id,
      year:        dragged.year,
      department:  dragged.department,
      room:        null,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    setActiveId(null);
    clearConflictMap();
    setDragState({ isDragging: false, draggedSlot: null });

    if (!over) return;

    const fromId = active.id.toString();
    const toId   = over.id.toString();
    if (fromId === toId) return;

    const [fromDay, fromTs] = fromId.split('__');
    const [toDay,   toTs  ] = toId.split('__');

    const conflictState = useGridStore.getState().dragState.conflictMap[toId];
    if (conflictState === 'invalid') return;

    // Check if target is occupied → swap; else move
    const grid    = useGridStore.getState().grid;
    const toSlot  = grid[toDay]?.[toTs];

    if (toSlot) {
      swapSlots({ day: fromDay, timeSlot: fromTs }, { day: toDay, timeSlot: toTs });
    } else {
      moveSlot({ day: fromDay, timeSlot: fromTs }, { day: toDay, timeSlot: toTs });
    }
  };

  // ── Swap-mode click handler ─────────────────────────────────────────────

  const handleSwapClick = (day: string, timeSlot: string) => {
    if (!swapModeSource) return;
    // Don't swap with self
    if (swapModeSource.day === day && swapModeSource.timeSlot === timeSlot) {
      setSwapModeSource(null);
      return;
    }
    swapSlots(swapModeSource, { day, timeSlot });
    setSwapModeSource(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-zinc-500">
        Loading grid…
      </div>
    );
  }

  const colCount = days.length;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-2"
        style={{ contain: 'layout' }}
      >
        {/* CSS Grid table */}
        <div
          className="min-w-max"
          style={{
            display:               'grid',
            gridTemplateColumns:   `80px repeat(${colCount}, minmax(120px, 1fr))`,
            gap:                   '4px',
          }}
        >
          {/* ── Header row ── */}
          <div /> {/* corner spacer */}
          {days.map((day) => (
            <DayColumn key={day} day={day} />
          ))}

          {/* ── Body rows (one row per time-slot) ── */}
          {timeSlots.map((ts) => (
            <React.Fragment key={ts}>
              {/* Time label */}
              <div className="flex h-full items-start pt-2 text-[10px] font-medium text-zinc-500">
                {formatTimeSlot(ts)}
              </div>

              {/* Cells */}
              {days.map((day) => (
                <TimeSlotCell
                  key={`${day}__${ts}`}
                  day={day}
                  timeSlot={ts}
                  onContextMenu={onContextMenu}
                  onSwapClick={handleSwapClick}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Floating drag overlay */}
      <GhostOverlay activeId={activeId} />
    </DndContext>
  );
}
