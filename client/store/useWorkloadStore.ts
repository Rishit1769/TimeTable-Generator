/**
 * useWorkloadStore.ts
 *
 * Manages teacher workload data.
 *
 * recomputeFromGrid() is called by WorkloadTracker whenever the grid changes.
 * It counts slots per teacher_id in the current in-memory grid and updates
 * weekly_hours + utilization_percent locally — no API round-trip needed.
 */

import { create } from 'zustand';
import { fetchTeachersWorkload, TeacherWorkload } from '@/lib/grid.api';
import { Grid } from './useGridStore';

interface WorkloadStore {
  workloads:          TeacherWorkload[];
  isLoading:          boolean;
  fetchWorkload:      () => Promise<void>;
  recomputeFromGrid:  (grid: Grid) => void;
}

export const useWorkloadStore = create<WorkloadStore>((set) => ({
  workloads: [],
  isLoading: false,

  // ── fetchWorkload ─────────────────────────────────────────────────────────

  fetchWorkload: async () => {
    set({ isLoading: true });
    try {
      const data = await fetchTeachersWorkload();
      set({ workloads: data, isLoading: false });
    } catch (err) {
      console.error('[useWorkloadStore] fetchWorkload failed:', err);
      set({ isLoading: false });
    }
  },

  // ── recomputeFromGrid ─────────────────────────────────────────────────────
  // Scans the in-memory grid and updates weekly_hours / utilization_percent
  // for every teacher already present in workloads[].

  recomputeFromGrid: (grid) => {
    const counts: Record<number, number> = {};

    for (const daySlots of Object.values(grid)) {
      for (const slot of Object.values(daySlots)) {
        if (slot?.teacher_id != null) {
          counts[slot.teacher_id] = (counts[slot.teacher_id] ?? 0) + 1;
        }
      }
    }

    set((state) => ({
      workloads: state.workloads.map((w) => {
        const weekly_hours      = counts[w.teacher_id] ?? 0;
        const max               = w.max_hours_per_week > 0 ? w.max_hours_per_week : 1;
        const utilization_percent = Math.round((weekly_hours / max) * 100);
        return { ...w, weekly_hours, utilization_percent };
      }),
    }));
  },
}));
