/**
 * app/architect/page.tsx
 *
 * The Timetable Architect editor page.
 *
 * Layout:
 * ┌────────────────────────────────────────────────────────────┐
 * │  ArchitectToolbar (sticky, 48 px)                          │
 * ├─────────────────────────────────────────┬──────────────────┤
 * │                                         │                  │
 * │  TimetableGrid (scrollable)             │ WorkloadTracker  │
 * │                                         │  (fixed 280 px)  │
 * └─────────────────────────────────────────┴──────────────────┘
 *
 * • On screens < lg the sidebar collapses to a toggle button.
 * • loadGrid() runs once on mount using the activeFilters from the store.
 * • A global swap-mode banner appears when swapModeSource is set.
 */

'use client';

import React, { MouseEvent, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ArchitectToolbar   from '@/components/toolbar/ArchitectToolbar';
import TimetableGrid      from '@/components/grid/TimetableGrid';
import WorkloadTracker    from '@/components/sidebar/WorkloadTracker';
import SlotContextMenu    from '@/components/context-menu/SlotContextMenu';
import { useGridStore }   from '@/store/useGridStore';

// Heavy components loaded client-only (DnD + portals)
const TOOLBAR_H = 48; // px — matches h-12

interface ContextMenuState {
  x:        number;
  y:        number;
  day:      string;
  timeSlot: string;
}

export default function ArchitectPage() {
  const loadGrid       = useGridStore((s) => s.loadGrid);
  const swapModeSource = useGridStore((s) => s.swapModeSource);
  const setSwapMode    = useGridStore((s) => s.setSwapModeSource);
  const activeFilters  = useGridStore((s) => s.activeFilters);

  const [contextMenu,    setContextMenu]   = useState<ContextMenuState | null>(null);
  const [sidebarOpen,    setSidebarOpen]   = useState(true);

  // Initial grid load
  useEffect(() => {
    void loadGrid(
      activeFilters.department ?? undefined,
      activeFilters.year        ?? undefined,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

  // ── Context menu open/close ───────────────────────────────────────────

  const openContextMenu = (
    e:       MouseEvent<HTMLDivElement>,
    day:     string,
    timeSlot: string,
  ) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, day, timeSlot });
  };

  const closeContextMenu = () => setContextMenu(null);

  // ── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col" style={{ height: '100vh' }}>
      {/* ── Sticky toolbar ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30">
        <ArchitectToolbar />
      </div>

      {/* ── Swap-mode banner ───────────────────────────────────────────── */}
      {swapModeSource && (
        <div className="flex items-center justify-between bg-blue-900/60 px-4 py-1.5 text-xs text-blue-200">
          <span>
            Swap mode active — click any other cell to complete the swap
            ({swapModeSource.day} · {swapModeSource.timeSlot})
          </span>
          <button
            onClick={() => setSwapMode(null)}
            className="ml-4 underline hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Main content area ──────────────────────────────────────────── */}
      <div
        className="flex flex-1 overflow-hidden"
        style={{ height: `calc(100vh - ${TOOLBAR_H}px)` }}
      >
        {/* Grid area */}
        <main className="flex-1 overflow-y-auto p-4">
          <TimetableGrid onContextMenu={openContextMenu} />
        </main>

        {/* Workload sidebar (lg+) */}
        <div className={`hidden lg:flex ${sidebarOpen ? 'w-[280px]' : 'w-0'} overflow-hidden transition-all duration-200`}>
          <WorkloadTracker />
        </div>

        {/* Sidebar toggle button (lg+) */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          title={sidebarOpen ? 'Collapse sidebar' : 'Expand workload panel'}
          className="hidden lg:flex h-full w-4 items-center justify-center border-l border-zinc-800 bg-zinc-950 text-zinc-600 hover:text-zinc-300 transition-colors"
          aria-label="Toggle sidebar"
        >
          <span className="text-[10px]">{sidebarOpen ? '›' : '‹'}</span>
        </button>
      </div>

      {/* ── Context menu portal ────────────────────────────────────────── */}
      {contextMenu && (
        <SlotContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          day={contextMenu.day}
          timeSlot={contextMenu.timeSlot}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
}
