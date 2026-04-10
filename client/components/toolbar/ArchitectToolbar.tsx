/**
 * ArchitectToolbar.tsx
 *
 * Sticky top bar for the Architect editor.
 * Contains:
 *   • Undo / Redo buttons (with last-action tooltip)
 *   • Department + Year filter selects  ← fires loadGrid via useGridFilters
 *   • SlotToggle (paper_code ↔ teacher_module)
 *   • Export button (placeholder)
 */

'use client';

import React from 'react';
import { useUndoRedo }    from '@/hooks/useUndoRedo';
import { useGridFilters } from '@/hooks/useGridFilters';
import SlotToggle   from '@/components/grid/SlotToggle';
import ExportButton  from '@/components/export/ExportButton';

const DEPARTMENTS = ['CS', 'IT', 'MECH', 'CIVIL', 'ELEC', 'CHEM'];
const YEARS       = ['FY', 'SY', 'TY'];

export default function ArchitectToolbar() {
  const { canUndo, canRedo, lastAction, undo, redo } = useUndoRedo();
  const { activeFilters, setDepartment, setYear }    = useGridFilters();

  return (
    <div className="flex h-12 items-center gap-3 border-b border-zinc-800 bg-zinc-950 px-4">
      {/* ── Undo / Redo ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          title={lastAction ? `Undo: ${lastAction}` : 'Nothing to undo'}
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Undo"
        >
          {/* ↩ */}
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M7.793 2.232a.75.75 0 0 1-.025 1.06L3.622 7.25h10.003a5.375 5.375 0 0 1 0 10.75H10.75a.75.75 0 0 1 0-1.5h2.875a3.875 3.875 0 0 0 0-7.75H3.622l4.146 3.957a.75.75 0 0 1-1.036 1.085l-5.5-5.25a.75.75 0 0 1 0-1.085l5.5-5.25a.75.75 0 0 1 1.061.025Z" clipRule="evenodd" />
          </svg>
        </button>

        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo"
          className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Redo"
        >
          {/* ↪ */}
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.207 2.232a.75.75 0 0 0 .025 1.06l4.146 3.958H6.375a5.375 5.375 0 0 0 0 10.75H9.25a.75.75 0 0 0 0-1.5H6.375a3.875 3.875 0 0 1 0-7.75h10.003l-4.146 3.957a.75.75 0 0 0 1.036 1.085l5.5-5.25a.75.75 0 0 0 0-1.085l-5.5-5.25a.75.75 0 0 0-1.061.025Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      <div className="h-6 w-px bg-zinc-800" />

      {/* ── Dept filter ─────────────────────────────────────────────────── */}
      <label className="flex items-center gap-1.5 text-xs text-zinc-400">
        Dept:
        <select
          value={activeFilters.department ?? ''}
          onChange={(e) => setDepartment(e.target.value || null)}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>

      {/* ── Year filter ──────────────────────────────────────────────────── */}
      <label className="flex items-center gap-1.5 text-xs text-zinc-400">
        Year:
        <select
          value={activeFilters.year ?? ''}
          onChange={(e) => setYear(e.target.value || null)}
          className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>

      <div className="h-6 w-px bg-zinc-800" />

      {/* ── View mode toggle ────────────────────────────────────────────── */}
      <SlotToggle />

      {/* ── Spacer ──────────────────────────────────────────────────────── */}
      <div className="flex-1" />

      {/* ── Export button (Phase 4) ──────────────────────────────────────── */}
      <ExportButton />
    </div>
  );
}
