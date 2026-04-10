/**
 * ProjectionTable.tsx
 *
 * Collapsible per-subject syllabus projection table.
 *
 * • Each subject row shows completion date, weeks, and a ProjectionBar.
 * • Clicking a row toggles the module breakdown.
 * • Green / amber / red completion date based on semesterEndDate proximity.
 */

'use client';

import React, { useState } from 'react';
import { SubjectProjection, completionDateColor } from '@/lib/projection';
import ProjectionBar from './ProjectionBar';

interface ProjectionTableProps {
  projections:     SubjectProjection[];
  semesterEndDate: string; // ISO YYYY-MM-DD
}

const DATE_COLOR_CLASSES = {
  green: 'text-emerald-400',
  amber: 'text-amber-400',
  red:   'text-red-400',
};

export default function ProjectionTable({ projections, semesterEndDate }: ProjectionTableProps) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (projections.length === 0) {
    return (
      <p className="text-sm text-zinc-500">No subjects found. Upload CSV data first.</p>
    );
  }

  return (
    <div className="space-y-3">
      {projections.map((proj) => {
        const colorKey  = completionDateColor(proj.semester_completion_date, semesterEndDate);
        const colorCls  = DATE_COLOR_CLASSES[colorKey];
        const isOpen    = expanded.has(proj.subject_id);

        return (
          <div
            key={proj.subject_id}
            className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
          >
            {/* ── Summary row ──────────────────────────────────────────────── */}
            <button
              onClick={() => toggle(proj.subject_id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-[10px] font-semibold transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`}
                >
                  ▸
                </span>
                <div>
                  <span className="text-xs font-semibold text-zinc-200">
                    {proj.subject_code}
                  </span>
                  <span className="ml-2 text-xs text-zinc-400">{proj.subject_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <span className="text-zinc-500">{proj.total_weeks_required} weeks</span>
                {proj.semester_completion_date && (
                  <span className={`font-semibold ${colorCls}`}>
                    Ends: {proj.semester_completion_date}
                  </span>
                )}
              </div>
            </button>

            {/* ── Gantt bar ─────────────────────────────────────────────────── */}
            <div className="px-4 pb-2">
              <ProjectionBar projection={proj} semesterEndDate={semesterEndDate} />
            </div>

            {/* ── Module breakdown (collapsible) ──────────────────────────── */}
            {isOpen && (
              <div className="px-4 pb-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-800 text-zinc-500">
                      <th className="pb-1 text-left font-medium">Module</th>
                      <th className="pb-1 text-left font-medium">Name</th>
                      <th className="pb-1 text-right font-medium">Hrs</th>
                      <th className="pb-1 text-left font-medium">Teacher</th>
                      <th className="pb-1 text-right font-medium">Start</th>
                      <th className="pb-1 text-right font-medium">Completes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proj.modules.map((mod) => (
                      <tr key={mod.module_id} className="border-b border-zinc-800/60">
                        <td className="py-1 pr-2 text-zinc-400">M{mod.module_number}</td>
                        <td className="py-1 pr-4 text-zinc-300">{mod.module_name}</td>
                        <td className="py-1 text-right text-zinc-400">{mod.module_hours}</td>
                        <td className="py-1 pl-4 text-zinc-400">{mod.assigned_teacher ?? '—'}</td>
                        <td className="py-1 text-right text-zinc-500">{mod.start_date}</td>
                        <td
                          className={`py-1 text-right font-medium ${
                            completionDateColor(mod.completion_date, semesterEndDate) === 'red'
                              ? 'text-red-400'
                              : 'text-zinc-300'
                          }`}
                        >
                          {mod.completion_date}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
