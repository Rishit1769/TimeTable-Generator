/**
 * grid.api.ts
 *
 * Typed fetch wrappers for all Phase 3 grid editor endpoints.
 * Never throws — callers receive typed response objects.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface GridApiRow {
  id:            number;
  day:           string;
  time_slot:     string;
  year:          string;
  department:    string;
  room:          string | null;
  subject_id:    number | null;
  subject_name:  string | null;
  subject_code:  string | null;
  paper_code:    string | null;
  teacher_id:    number | null;
  teacher_name:  string | null;
  module_id:     number | null;
  module_number: number | null;
  module_name:   string | null;
}

export interface ConflictCandidate {
  subject_id?: number;
  teacher_id:  number | null;
  year:        string;
  department:  string;
  room?:       string | null;
}

export interface ConflictResult {
  valid:  boolean;
  reason: string | null;
}

export interface TeacherWorkload {
  teacher_id:         number;
  name:               string;
  department:         string;
  weekly_hours:       number;
  max_hours_per_week: number;
  utilization_percent: number;
}

export interface SlotRef {
  day:      string;
  timeSlot: string;
}

// ─── API calls ────────────────────────────────────────────────────────────────

/**
 * GET /api/grid
 * Returns flat 1D rows for the given department/year filter.
 * Pass null to get the school-wide grid.
 */
export async function fetchGrid(
  department?: string | null,
  year?:       string | null,
): Promise<GridApiRow[]> {
  const params = new URLSearchParams();
  if (department) params.set('department', department);
  if (year)       params.set('year',       year);

  const url = `${API}/grid${params.size ? `?${params}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET /grid failed: ${res.status}`);
  return (await res.json()) as GridApiRow[];
}

/**
 * POST /api/conflict-check
 * Validates whether placing `candidate` at `day + timeSlot` causes a conflict.
 */
export async function checkConflict(
  day:       string,
  timeSlot:  string,
  candidate: ConflictCandidate,
): Promise<ConflictResult> {
  try {
    const res = await fetch(`${API}/conflict-check`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ day, timeSlot, candidate }),
    });
    return (await res.json()) as ConflictResult;
  } catch {
    return { valid: false, reason: 'Network error during conflict check.' };
  }
}

/**
 * POST /api/grid/swap
 * Persists a slot swap in the master_grid table.
 */
export async function swapSlots(slotA: SlotRef, slotB: SlotRef): Promise<void> {
  const res = await fetch(`${API}/grid/swap`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ slotA, slotB }),
  });
  if (!res.ok) throw new Error(`POST /grid/swap failed: ${res.status}`);
}

/**
 * GET /api/teachers/workload
 * Returns all teachers with their current weekly slot count + utilization.
 */
export async function fetchTeachersWorkload(): Promise<TeacherWorkload[]> {
  const res = await fetch(`${API}/teachers/workload`);
  if (!res.ok) throw new Error(`GET /teachers/workload failed: ${res.status}`);
  return (await res.json()) as TeacherWorkload[];
}
