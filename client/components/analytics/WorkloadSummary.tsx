/**
 * WorkloadSummary.tsx
 *
 * Summary card showing total and per-teacher weekly hours from the
 * current timetable.  Fetches from GET /api/teachers/workload.
 */

'use client';

import React, { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface TeacherWorkload {
  teacher_id:          number;
  name:                string;
  department:          string;
  weekly_hours:        number;
  max_hours_per_week:  number;
  utilization_percent: number;
}

function bar(pct: number) {
  const capped = Math.min(pct, 100);
  const color  = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-500';
  return (
    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${capped}%` }} />
    </div>
  );
}

export default function WorkloadSummary() {
  const [workloads, setWorkloads] = useState<TeacherWorkload[]>([]);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/teachers/workload`)
      .then<TeacherWorkload[]>((r) => r.json())
      .then(setWorkloads)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalAssigned = workloads.reduce((s, w) => s + w.weekly_hours, 0);
  const overloaded    = workloads.filter((w) => w.utilization_percent > 100).length;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <h3 className="mb-4 text-sm font-semibold text-zinc-200">Teacher Workload Summary</h3>

      {/* KPI strip */}
      <div className="mb-5 flex gap-6">
        <div>
          <div className="text-2xl font-bold text-zinc-100">{totalAssigned}</div>
          <div className="text-[10px] text-zinc-500">Total slots assigned</div>
        </div>
        <div>
          <div className={`text-2xl font-bold ${overloaded > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {overloaded}
          </div>
          <div className="text-[10px] text-zinc-500">Overloaded teachers</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-zinc-100">{workloads.length}</div>
          <div className="text-[10px] text-zinc-500">Total teachers</div>
        </div>
      </div>

      {/* Per-teacher bars */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-5 rounded bg-zinc-800" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {[...workloads]
            .sort((a, b) => b.utilization_percent - a.utilization_percent)
            .map((w) => (
              <div key={w.teacher_id}>
                <div className="flex items-baseline justify-between">
                  <span className="max-w-[200px] truncate text-xs text-zinc-300">{w.name}</span>
                  <span
                    className={`ml-2 text-[10px] font-medium ${
                      w.utilization_percent > 100 ? 'text-red-400' : 'text-zinc-500'
                    }`}
                  >
                    {w.weekly_hours}/{w.max_hours_per_week}h ({w.utilization_percent}%)
                  </span>
                </div>
                {bar(w.utilization_percent)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
