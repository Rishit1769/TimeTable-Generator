/**
 * ProjectionBar.tsx
 *
 * Gantt-style visual timeline bar for a single subject.
 *
 * Each module is rendered as a proportional coloured segment.
 * Tooltip on hover: "Module N: Name — X hrs — Completes YYYY-MM-DD"
 *
 * The bar spans from semesterStart to lastModuleCompletion.
 * If all modules complete < semesterEnd → green cap indicator.
 */

'use client';

import React, { useState } from 'react';
import { SubjectProjection, ModuleProjection } from '@/lib/projection';

// ─── Module segment colours (index 0-7, cycling) ─────────────────────────────

const SEGMENT_COLORS = [
  'bg-indigo-500',
  'bg-sky-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-violet-500',
  'bg-orange-500',
];

interface ProjectionBarProps {
  projection:      SubjectProjection;
  semesterEndDate: string; // ISO YYYY-MM-DD
}

export default function ProjectionBar({ projection, semesterEndDate }: ProjectionBarProps) {
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  const totalWeeks = projection.total_weeks_required;
  if (totalWeeks === 0) return null;

  return (
    <div className="relative mt-1.5">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-zinc-800">
        {projection.modules.map((mod, i) => {
          const pct = (mod.weeks_required / totalWeeks) * 100;
          return (
            <div
              key={mod.module_id}
              className={`relative h-full ${SEGMENT_COLORS[i % SEGMENT_COLORS.length]} cursor-pointer
                          transition-opacity hover:opacity-80`}
              style={{ width: `${pct}%` }}
              onMouseEnter={(e) =>
                setTooltip({
                  text: `M${mod.module_number}: ${mod.module_name} — ${mod.module_hours} hrs — Completes ${mod.completion_date}`,
                  x:    e.clientX,
                  y:    e.clientY,
                })
              }
              onMouseLeave={() => setTooltip(null)}
            />
          );
        })}
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 max-w-xs rounded bg-zinc-900 px-2 py-1 text-[10px] text-zinc-200 shadow-lg border border-zinc-700"
          style={{ top: tooltip.y - 32, left: tooltip.x + 12, pointerEvents: 'none' }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
