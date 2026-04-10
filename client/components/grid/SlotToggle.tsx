/**
 * SlotToggle.tsx
 *
 * Pill toggle that switches the grid between "paper_code" and
 * "teacher_module" view modes.  Lives in the toolbar row.
 */

'use client';

import React from 'react';
import { useGridStore } from '@/store/useGridStore';

export default function SlotToggle() {
  const viewMode    = useGridStore((s) => s.viewMode);
  const setViewMode = useGridStore((s) => s.setViewMode);

  return (
    <div className="flex items-center gap-1 rounded-full bg-zinc-800 p-1 text-xs font-medium">
      <button
        onClick={() => setViewMode('paper_code')}
        className={`rounded-full px-3 py-1 transition-colors ${
          viewMode === 'paper_code'
            ? 'bg-indigo-600 text-white shadow'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
        title="Show Paper Code"
      >
        Code
      </button>
      <button
        onClick={() => setViewMode('teacher_module')}
        className={`rounded-full px-3 py-1 transition-colors ${
          viewMode === 'teacher_module'
            ? 'bg-indigo-600 text-white shadow'
            : 'text-zinc-400 hover:text-zinc-200'
        }`}
        title="Show Teacher / Module"
      >
        Teacher
      </button>
    </div>
  );
}
