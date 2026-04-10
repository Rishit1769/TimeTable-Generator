/**
 * grid.utils.ts
 *
 * Pure helper functions for timetable grid operations.
 * No side effects — safe to call anywhere without imports beyond types.
 */

import type { GridSlotData, Grid } from '@/store/useGridStore';

// ─── Slot ID encoding ─────────────────────────────────────────────────────────

/** Encodes a day + timeSlot into a single string key used by dnd-kit and conflictMap. */
export function encodeSlotId(day: string, timeSlot: string): string {
  return `${day}__${timeSlot}`;
}

/** Decodes a slot ID back into its components. */
export function decodeSlotId(id: string): { day: string; timeSlot: string } {
  const idx = id.indexOf('__');
  return {
    day:      id.slice(0, idx),
    timeSlot: id.slice(idx + 2),
  };
}

// ─── Grid traversal ───────────────────────────────────────────────────────────

/**
 * Returns all occupied slot entries as a flat array with their coordinates.
 *
 * @param grid  The 2D timetable grid.
 */
export function flattenGrid(
  grid: Grid,
): Array<{ day: string; timeSlot: string; data: GridSlotData }> {
  const result: Array<{ day: string; timeSlot: string; data: GridSlotData }> = [];
  for (const [day, slots] of Object.entries(grid)) {
    for (const [timeSlot, data] of Object.entries(slots)) {
      if (data != null) result.push({ day, timeSlot, data });
    }
  }
  return result;
}

/**
 * Counts total weekly slots for a specific teacher across the entire grid.
 *
 * @param grid       The 2D timetable grid.
 * @param teacherId  The teacher ID to count for.
 */
export function countTeacherSlots(grid: Grid, teacherId: number): number {
  let count = 0;
  for (const slots of Object.values(grid)) {
    for (const data of Object.values(slots)) {
      if (data?.teacher_id === teacherId) count++;
    }
  }
  return count;
}

// ─── Time slot helpers ────────────────────────────────────────────────────────

export const DEFAULT_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export const DEFAULT_TIME_SLOTS = [
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
] as const;

/** Human-readable label for a time-slot string (e.g. "09:00-10:00" → "9:00 AM"). */
export function formatTimeSlot(slot: string): string {
  const [start] = slot.split('-');
  const [hStr, mStr] = start.split(':');
  const h = parseInt(hStr, 10);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${period}`;
}

/** Short day label (e.g. "MON" → "Mon"). */
export function formatDay(day: string): string {
  return day.charAt(0) + day.slice(1).toLowerCase();
}

// ─── Grid initializer ─────────────────────────────────────────────────────────

/**
 * Creates a blank Grid object from the given days and time-slots.
 * Every cell is initialized to null.
 */
export function createEmptyGrid(
  days: string[]      = [...DEFAULT_DAYS],
  timeSlots: string[] = [...DEFAULT_TIME_SLOTS],
): Grid {
  const grid: Grid = {};
  for (const day of days) {
    grid[day] = {};
    for (const ts of timeSlots) {
      grid[day][ts] = null;
    }
  }
  return grid;
}

/**
 * Merges flat API row data into a 2D Grid.
 * Rows that lack subject_id are skipped (empty slot in DB).
 */
export function buildGridFromRows(
  rows: Array<{
    day: string;
    time_slot: string;
    subject_id: number | null;
    subject_code: string | null;
    subject_name: string | null;
    paper_code: string | null;
    teacher_id: number | null;
    teacher_name: string | null;
    module_id: number | null;
    module_number: number | null;
    module_name: string | null;
    year: string;
    department: string;
  }>,
  days: string[]      = [...DEFAULT_DAYS],
  timeSlots: string[] = [...DEFAULT_TIME_SLOTS],
): Grid {
  const grid = createEmptyGrid(days, timeSlots);

  for (const row of rows) {
    if (row.subject_id == null) continue;

    if (!grid[row.day])                grid[row.day] = {};
    if (grid[row.day][row.time_slot] === undefined) grid[row.day][row.time_slot] = null;

    grid[row.day][row.time_slot] = {
      subject_id:    row.subject_id,
      subject_code:  row.subject_code  ?? '',
      subject_name:  row.subject_name  ?? '',
      paper_code:    row.paper_code    ?? '',
      teacher_id:    row.teacher_id    ?? 0,
      teacher_name:  row.teacher_name  ?? '',
      module_id:     row.module_id     ?? 0,
      module_number: row.module_number ?? 0,
      module_name:   row.module_name   ?? '',
      year:          row.year,
      department:    row.department,
    };
  }

  return grid;
}
