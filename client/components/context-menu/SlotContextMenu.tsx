/**
 * SlotContextMenu.tsx
 *
 * Right-click context menu for a timetable cell.
 *
 * Features
 * ────────
 *   • "Swap with…"  → enters swap mode (next cell click triggers swap)
 *   • "View Details" → shows a simple slide-over panel
 *   • "Clear Slot"  → confirms then clears (move to null)
 *   • Escape key  → dismiss
 *   • Click outside → dismiss
 *
 * The menu renders at `position: fixed` using the cursor coordinates
 * supplied by the parent via onContextMenu.
 *
 * Mounting via a React Portal keeps it on top of everything and avoids
 * overflow: hidden clip from ancestor elements.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal }         from 'react-dom';
import { useGridStore }         from '@/store/useGridStore';

interface SlotContextMenuProps {
  x:        number;
  y:        number;
  day:      string;
  timeSlot: string;
  onClose:  () => void;
}

interface DetailsPanelProps {
  day:      string;
  timeSlot: string;
  onClose:  () => void;
}

function DetailsPanel({ day, timeSlot, onClose }: DetailsPanelProps) {
  const data = useGridStore((s) => s.grid[day]?.[timeSlot] ?? null);
  if (!data) return null;

  return (
    <div
      className="fixed inset-y-0 right-0 z-[90] flex w-72 flex-col border-l border-zinc-800 bg-zinc-900 p-5 shadow-2xl"
      role="dialog"
      aria-label="Slot details"
    >
      <button
        onClick={onClose}
        className="mb-4 self-end text-xs text-zinc-500 hover:text-zinc-200"
        aria-label="Close details"
      >
        ✕ Close
      </button>
      <h4 className="mb-4 text-sm font-semibold text-zinc-100">
        {data.subject_name}
      </h4>
      <dl className="space-y-2 text-xs">
        {[
          ['Paper Code', data.paper_code || data.subject_code],
          ['Subject Code', data.subject_code],
          ['Teacher', data.teacher_name],
          ['Module', `M${data.module_number} · ${data.module_name}`],
          ['Year', data.year],
          ['Dept', data.department],
          ['Day', day],
          ['Slot', timeSlot],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="text-zinc-200 text-right">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function SlotContextMenu({
  x, y, day, timeSlot, onClose,
}: SlotContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const slotData       = useGridStore((s) => s.grid[day]?.[timeSlot] ?? null);
  const setSwapMode    = useGridStore((s) => s.setSwapModeSource);
  const swapModeSource = useGridStore((s) => s.swapModeSource);
  const moveSlot       = useGridStore((s) => s.moveSlot);

  // ── Dismiss on outside click ──────────────────────────────────────────
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [onClose]);

  // ── Dismiss on Escape ─────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  // ── Compute a "safe" position so the menu doesn't clip off-screen ─────
  const menuW = 192;
  const menuH = 160;
  const safeX = Math.min(x, window.innerWidth  - menuW - 8);
  const safeY = Math.min(y, window.innerHeight - menuH - 8);

  // ── Actions ───────────────────────────────────────────────────────────

  const handleSwapWith = () => {
    setSwapMode({ day, timeSlot });
    onClose();
  };

  const handleClear = () => {
    if (!confirmClear) { setConfirmClear(true); return; }
    // "Clear" is a move from this slot to a temp that doesn't exist yet.
    // Simplest: set the slot to null directly in the store.
    useGridStore.setState((state) => ({
      grid: {
        ...state.grid,
        [day]: { ...state.grid[day], [timeSlot]: null },
      },
    }));
    onClose();
  };

  const menu = (
    <div
      ref={menuRef}
      style={{ top: safeY, left: safeX }}
      className="fixed z-[80] w-48 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-2xl shadow-black/60"
      role="menu"
    >
      {/* Header */}
      <div className="border-b border-zinc-800 px-3 py-1.5">
        <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {day} · {timeSlot}
        </p>
        {slotData && (
          <p className="truncate text-xs text-zinc-300">
            {slotData.subject_code}
          </p>
        )}
      </div>

      {slotData && (
        <>
          {/* Swap with */}
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800"
            onClick={handleSwapWith}
            role="menuitem"
          >
            <span className="text-base leading-none">⇄</span>
            {swapModeSource ? 'Cancel swap mode' : 'Swap with…'}
          </button>

          {/* View details */}
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800"
            onClick={() => setShowDetails(true)}
            role="menuitem"
          >
            <span className="text-base leading-none">ℹ</span>
            View Details
          </button>

          <div className="my-1 border-t border-zinc-800" />

          {/* Clear slot */}
          <button
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-800 ${
              confirmClear ? 'text-red-400 font-semibold' : 'text-zinc-400'
            }`}
            onClick={handleClear}
            role="menuitem"
          >
            <span className="text-base leading-none">✕</span>
            {confirmClear ? 'Confirm clear?' : 'Clear Slot'}
          </button>
        </>
      )}

      {!slotData && (
        <div className="px-3 py-2 text-xs text-zinc-600">Empty slot</div>
      )}
    </div>
  );

  return (
    <>
      {createPortal(menu, document.body)}
      {showDetails &&
        createPortal(
          <DetailsPanel
            day={day}
            timeSlot={timeSlot}
            onClose={() => { setShowDetails(false); onClose(); }}
          />,
          document.body,
        )}
    </>
  );
}
