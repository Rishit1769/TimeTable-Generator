/**
 * WorkloadBar.tsx
 *
 * Per-teacher horizontal progress bar.
 * Colour bands:
 *   < 70%   → green
 *   70–89%  → amber
 *   ≥ 90%   → red
 */

'use client';

import React from 'react';
import { TeacherWorkload } from '@/lib/grid.api';

interface WorkloadBarProps {
  teacher: TeacherWorkload;
}

function getBarColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function WorkloadBar({ teacher }: WorkloadBarProps) {
  const pct    = Math.min(teacher.utilization_percent, 100);
  const over   = teacher.utilization_percent > 100;
  const color  = getBarColor(teacher.utilization_percent);

  return (
    <div className="mb-3">
      {/* Name + numbers */}
      <div className="mb-1 flex items-baseline justify-between">
        <span
          className="max-w-[160px] truncate text-[11px] font-medium text-zinc-300"
          title={teacher.name}
        >
          {teacher.name}
        </span>
        <span
          className={`ml-2 shrink-0 text-[10px] font-medium ${
            over ? 'text-red-400' : 'text-zinc-500'
          }`}
        >
          {teacher.weekly_hours}/{teacher.max_hours_per_week}h
        </span>
      </div>

      {/* Bar track */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Over-limit badge */}
      {over && (
        <div className="mt-0.5 text-[9px] font-semibold text-red-400">
          Overloaded +{teacher.utilization_percent - 100}%
        </div>
      )}
    </div>
  );
}

export default React.memo(WorkloadBar);
