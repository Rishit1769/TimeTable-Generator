/**
 * useConflictChecker.ts
 *
 * Provides a debounced (120 ms) conflict-check function.
 * Calls POST /api/conflict-check and stores the result in useGridStore.
 *
 * Usage:
 *   const { check } = useConflictChecker()
 *   check(day, timeSlot, candidate)   // call this inside onDragOver
 */

'use client';

import { useDebouncedCallback } from 'use-debounce';
import { checkConflict, ConflictCandidate } from '@/lib/grid.api';
import { useGridStore } from '@/store/useGridStore';

export function useConflictChecker() {
  const setConflictResult = useGridStore((s) => s.setConflictResult);

  const check = useDebouncedCallback(
    async (day: string, timeSlot: string, candidate: ConflictCandidate) => {
      const result = await checkConflict(day, timeSlot, candidate);
      setConflictResult(day, timeSlot, result.valid ? 'valid' : 'invalid');
    },
    120,
  );

  return { check };
}
