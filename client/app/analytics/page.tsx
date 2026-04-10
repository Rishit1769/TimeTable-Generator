/**
 * app/analytics/page.tsx
 *
 * Syllabus Projection Dashboard
 *
 * • User picks semester start date via <input type="date">
 * • Fetches subjects-with-modules from the API once on load / filter change
 * • Recalculates projections entirely client-side on every date change
 *   (no API round-trip — projection.ts is a pure function library)
 * • Renders ProjectionTable + WorkloadSummary
 */

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import ProjectionTable from '@/components/analytics/ProjectionTable';
import WorkloadSummary from '@/components/analytics/WorkloadSummary';
import {
  SubjectForProjection,
  SubjectProjection,
  calculateSyllabusProjections,
} from '@/lib/projection';

const API_BASE      = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
const DEPARTMENTS   = ['CS', 'IT', 'MECH', 'CIVIL', 'ELEC', 'CHEM'];
const YEARS         = ['FY', 'SY', 'TY'];
const SEMESTER_WEEKS = 20; // default semester length

function isoToday(): string {
  return new Date().toISOString().split('T')[0];
}

function addWeeks(isoDate: string, weeks: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

export default function AnalyticsPage() {
  const [startDate,   setStartDate]   = useState<string>(isoToday());
  const [department,  setDepartment]  = useState<string>('');
  const [year,        setYear]        = useState<string>('');
  const [subjects,    setSubjects]    = useState<SubjectForProjection[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);

  const semesterEndDate = addWeeks(startDate, SEMESTER_WEEKS);

  // ── Fetch subjects (only when department / year changes) ─────────────────

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (department) params.set('department', department);
    if (year)       params.set('year', year);

    fetch(`${API_BASE}/subjects/full?${params}`)
      .then<SubjectForProjection[]>((r) => r.json())
      .then((data) => setSubjects(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [department, year]);

  // ── Recalculate projections whenever startDate or subjects change ─────────

  const projections = useMemo<SubjectProjection[]>(() => {
    if (subjects.length === 0) return [];
    return calculateSyllabusProjections(subjects, new Date(startDate));
  }, [subjects, startDate]);

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* ── Page heading ───────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">
            Syllabus Projection Dashboard
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Completion dates are projected from{' '}
            <span className="text-zinc-200">{startDate}</span>, assuming{' '}
            {SEMESTER_WEEKS}-week semester.
          </p>
        </div>
        <Link
          href="/architect"
          className="rounded bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          ← Back to Editor
        </Link>
      </div>

      {/* ── Filters ────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        {/* Semester start date */}
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Semester Start
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded bg-zinc-800 px-2 py-1.5 text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>

        {/* Calculated end date (read-only) */}
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Semester End (auto)
          <input
            readOnly
            value={semesterEndDate}
            className="rounded bg-zinc-800/60 px-2 py-1.5 text-zinc-400 outline-none cursor-default"
          />
        </label>

        <div className="h-8 w-px bg-zinc-800" />

        {/* Department */}
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Department
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            className="rounded bg-zinc-800 px-2 py-1.5 text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All</option>
            {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </label>

        {/* Year */}
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Year
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="rounded bg-zinc-800 px-2 py-1.5 text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All</option>
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>

        {/* Quick legend */}
        <div className="ml-auto flex items-center gap-3 text-[10px] text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            On track
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
            Within 2 wks of end
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
            Past semester end
          </span>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────── */}
      <div className="flex gap-6">
        {/* Projection table (grows) */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-zinc-800" />
              ))}
            </div>
          ) : (
            <ProjectionTable
              projections={projections}
              semesterEndDate={semesterEndDate}
            />
          )}
        </div>

        {/* Workload summary (fixed 320px) */}
        <div className="w-80 shrink-0">
          <WorkloadSummary />
        </div>
      </div>
    </div>
  );
}
