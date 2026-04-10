/**
 * WorkloadTracker.tsx
 *
 * Fixed 280px sidebar that shows weekly workload for every teacher.
 *
 * • Fetches initial data from GET /api/teachers/workload on mount.
 * • Subscribes to the grid store and re-runs recomputeFromGrid()
 *   whenever the grid changes (so DnD moves are reflected instantly).
 * • Sorted: overloaded teachers float to the top.
 */

'use client';

import React, { useEffect, useRef } from 'react';
import { useGridStore }      from '@/store/useGridStore';
import { useWorkloadStore }  from '@/store/useWorkloadStore';
import WorkloadBar           from './WorkloadBar';
import { Grid }              from '@/store/useGridStore';

export default function WorkloadTracker() {
  const grid              = useGridStore((s) => s.grid);
  const fetchWorkload     = useWorkloadStore((s) => s.fetchWorkload);
  const recomputeFromGrid = useWorkloadStore((s) => s.recomputeFromGrid);
  const workloads         = useWorkloadStore((s) => s.workloads);
  const isLoading         = useWorkloadStore((s) => s.isLoading);

  // Fetch once on mount
  useEffect(() => {
    void fetchWorkload();
  }, [fetchWorkload]);

  // Re-compute whenever grid changes
  const prevGridRef = useRef<Grid | null>(null);
  useEffect(() => {
    if (grid !== prevGridRef.current) {
      prevGridRef.current = grid;
      recomputeFromGrid(grid);
    }
  }, [grid, recomputeFromGrid]);

  // Sort: overloaded first, then by utilization desc
  const sorted = [...workloads].sort(
    (a, b) => b.utilization_percent - a.utilization_percent,
  );

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-l border-zinc-800 bg-zinc-950 px-4 pt-4 pb-6">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Teacher Workload
      </h3>

      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 rounded bg-zinc-800" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-xs text-zinc-600">No teacher data.</p>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1">
          {sorted.map((t) => (
            <WorkloadBar key={t.teacher_id} teacher={t} />
          ))}
        </div>
      )}
    </aside>
  );
}
