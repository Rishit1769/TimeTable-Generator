/**
 * useGridFilters.ts
 *
 * Thin wrapper over useGridStore's activeFilters.
 * Setting a department or year automatically re-fetches the grid.
 */

'use client';

import { useGridStore } from '@/store/useGridStore';

export function useGridFilters() {
  const activeFilters = useGridStore((s) => s.activeFilters);
  const setFilter     = useGridStore((s) => s.setFilter);
  const loadGrid      = useGridStore((s) => s.loadGrid);

  const setDepartment = (department: string | null) => {
    setFilter({ department });
    void loadGrid(department ?? undefined, activeFilters.year ?? undefined);
  };

  const setYear = (year: string | null) => {
    setFilter({ year });
    void loadGrid(activeFilters.department ?? undefined, year ?? undefined);
  };

  return { activeFilters, setDepartment, setYear };
}
