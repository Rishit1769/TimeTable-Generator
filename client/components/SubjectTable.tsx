'use client';

import React, { useState, useEffect } from 'react';
import { getSubjects, type Subject }   from '@/lib/api';
import ValidationBadge                 from '@/components/ValidationBadge';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSubjectValid(subject: Subject): boolean {
  const sum = subject.modules.reduce((acc, m) => acc + m.module_hours, 0);
  return sum === subject.total_semester_hours;
}

// ─── Loading / empty / error skeletons ───────────────────────────────────────

function StateRow({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={10} className="py-20 text-center text-zinc-500">
        {children}
      </td>
    </tr>
  );
}

// ─── Inline spinner ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="mr-2 inline h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SubjectTable() {
  const [subjects,     setSubjects]     = useState<Subject[]>([]);
  const [expandedIds,  setExpandedIds]  = useState<Set<number>>(new Set());
  const [isLoading,    setIsLoading]    = useState(true);
  const [fetchError,   setFetchError]   = useState<string | null>(null);

  useEffect(() => {
    getSubjects()
      .then(setSubjects)
      .catch(() => setFetchError('Failed to load subjects. Make sure the API server is running.'))
      .finally(() => setIsLoading(false));
  }, []);

  const toggleRow = (id: number) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm">

        {/* ── Header ── */}
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900 text-left">
            <th className="w-8 px-3 py-3" />
            <th className="px-4 py-3 font-medium text-zinc-400">Subject Name</th>
            <th className="px-4 py-3 font-medium text-zinc-400">Code</th>
            <th className="px-4 py-3 font-medium text-zinc-400">Year</th>
            <th className="px-4 py-3 text-right font-medium text-zinc-400">Credits</th>
            <th className="px-4 py-3 text-right font-medium text-zinc-400">Total Hrs</th>
            <th className="px-4 py-3 text-right font-medium text-zinc-400">Hrs/Week</th>
            <th className="px-4 py-3 font-medium text-zinc-400">Teacher 1</th>
            <th className="px-4 py-3 font-medium text-zinc-400">Teacher 2</th>
            <th className="px-4 py-3 text-center font-medium text-zinc-400">Status</th>
          </tr>
        </thead>

        {/* ── Body ── */}
        <tbody>
          {isLoading && (
            <StateRow>
              <Spinner />Loading subjects…
            </StateRow>
          )}

          {!isLoading && fetchError && (
            <StateRow>
              <span className="text-red-400">{fetchError}</span>
            </StateRow>
          )}

          {!isLoading && !fetchError && subjects.length === 0 && (
            <StateRow>No subjects found. Upload a CSV to get started.</StateRow>
          )}

          {!isLoading && !fetchError && subjects.map((subject) => {
            const expanded = expandedIds.has(subject.id);
            const valid    = isSubjectValid(subject);

            return (
              <React.Fragment key={subject.id}>

                {/* ── Subject row ── */}
                <tr
                  onClick={() => toggleRow(subject.id)}
                  className="cursor-pointer border-b border-zinc-800/50 bg-zinc-900/20
                             transition-colors hover:bg-zinc-800/30"
                >
                  <td className="px-3 py-3 text-center text-xs text-zinc-500 select-none">
                    {expanded ? '▼' : '▶'}
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-200">{subject.name}</td>
                  <td className="px-4 py-3 font-mono text-zinc-400">{subject.code}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300">
                      {subject.year}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-zinc-400">{subject.credits}</td>
                  <td className="px-4 py-3 text-right text-zinc-400">{subject.total_semester_hours}</td>
                  <td className="px-4 py-3 text-right text-zinc-400">{subject.expected_hours_per_week}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{subject.teacher1_name ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{subject.teacher2_name ?? '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <ValidationBadge isValid={valid} />
                  </td>
                </tr>

                {/* ── Expandable module breakdown ── */}
                {expanded && (
                  <tr className="bg-zinc-950">
                    <td colSpan={10} className="px-8 py-4">
                      <div className="overflow-hidden rounded-lg border border-zinc-800">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900">
                              <th className="px-4 py-2 text-left font-medium text-zinc-500">Module #</th>
                              <th className="px-4 py-2 text-left font-medium text-zinc-500">Module Name</th>
                              <th className="px-4 py-2 text-right font-medium text-zinc-500">Hours</th>
                              <th className="px-4 py-2 text-left font-medium text-zinc-500">Assigned Teacher</th>
                            </tr>
                          </thead>
                          <tbody>
                            {subject.modules.map((mod) => (
                              <tr
                                key={mod.id}
                                className="border-b border-zinc-800/30 hover:bg-zinc-900/30"
                              >
                                <td className="px-4 py-2 text-zinc-500">M{mod.module_number}</td>
                                <td className="px-4 py-2 text-zinc-300">{mod.module_name}</td>
                                <td className="px-4 py-2 text-right text-zinc-400">{mod.module_hours}</td>
                                <td className="px-4 py-2 text-zinc-500">{mod.teacher_name ?? '—'}</td>
                              </tr>
                            ))}

                            {/* Totals row */}
                            <tr className="bg-zinc-900/50">
                              <td colSpan={2} className="px-4 py-2 text-right font-medium text-zinc-500">
                                Total
                              </td>
                              <td className="px-4 py-2 text-right font-semibold text-zinc-300">
                                {subject.modules.reduce((s, m) => s + m.module_hours, 0)}
                              </td>
                              <td />
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}

              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
