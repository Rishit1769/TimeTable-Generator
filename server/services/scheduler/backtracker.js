/**
 * backtracker.js
 *
 * Recursive CSP (Constraint Satisfaction Problem) solver.
 *
 * Algorithm overview:
 *   For each subject (in descending priority order):
 *     1. Build the slot sequence   (which teacher/module per weekly slot)
 *     2. Recursively try every available day+timeSlot to place the next slot
 *     3. On each successful placement recurse to the next required slot
 *     4. If all slotsNeeded are placed → recurse to the next subject
 *     5. If no valid placement exists for the current slot → return null (backtrack)
 *
 * The grid is NEVER mutated in place.  setSlot() returns a new grid object
 * (structural sharing), so backtracking is simply discarding the returned
 * reference — no explicit "undo" step is needed.
 *
 * Safeguards:
 *   • MAX_ITERATIONS (100 000) guards against infinite loops.
 *   • If the limit is hit the algorithm aborts the full-backtracking run and
 *     falls back to a greedy per-subject pass, returning a partial grid with
 *     incomplete = true and a populated unscheduled[] array.
 */

import { buildSlotSequence }   from './sequencing.service.js';
import {
  getAvailableSlots,
  getSubjectSlotsPerDay,
  setSlot,
}                              from './slot.service.js';
import { checkConflict }       from './conflict.checker.js';

const MAX_ITERATIONS = 100_000;

// ─── Slot ranking ─────────────────────────────────────────────────────────────

/**
 * Ranks all available slots for a given subject, preferring:
 *   1. Days where the subject has not yet appeared (spread distribution).
 *   2. Earlier (morning) time-slots within a day.
 *   3. Slots without a soft-spread warning (subject < 2 times today).
 *
 * Note: soft-warn slots are still returned — the conflict checker will flag
 * them and the backtracker will try non-soft-warn slots first.
 *
 * @param {Array<{day:string, timeSlot:string}>} slots
 * @param {import('./slot.service.js').Grid}     grid
 * @param {{ subject_id: number }}               subject
 * @param {string[]}                             orderedTimeSlots
 * @returns {Array<{day:string, timeSlot:string}>}
 */
function rankSlots(slots, grid, subject, orderedTimeSlots) {
  const timeIndex = Object.fromEntries(orderedTimeSlots.map((t, i) => [t, i]));

  return [...slots].sort((a, b) => {
    // Primary: fewer appearances today → prefer
    const aToday = getSubjectSlotsPerDay(grid, subject.subject_id, a.day);
    const bToday = getSubjectSlotsPerDay(grid, subject.subject_id, b.day);
    if (aToday !== bToday) return aToday - bToday;

    // Secondary: earlier time-slot → prefer
    const aTime = timeIndex[a.timeSlot] ?? 999;
    const bTime = timeIndex[b.timeSlot] ?? 999;
    return aTime - bTime;
  });
}

// ─── Core placement engine ───────────────────────────────────────────────────

/**
 * Recursively places all weekly slots for every subject starting at
 * `subjectIdx`.  Returns the completed grid on success, or null on failure.
 *
 * @param {import('./weightage.service.js').WeightedSubject[]} sortedSubjects
 * @param {import('./sequencing.service.js').SlotAssignment[][]} sequences
 * @param {import('./slot.service.js').Grid} grid
 * @param {number}                           subjectIdx
 * @param {{ count: number }}                counter  – shared iteration counter
 * @param {string[]}                         orderedTimeSlots
 * @returns {import('./slot.service.js').Grid | null}
 */
function scheduleSubjects(sortedSubjects, sequences, grid, subjectIdx, counter, orderedTimeSlots) {
  if (counter.count > MAX_ITERATIONS) return null;

  // Base case — all subjects have been placed
  if (subjectIdx === sortedSubjects.length) return grid;

  const subject    = sortedSubjects[subjectIdx];
  const slotSeq    = sequences[subjectIdx];
  const slotsNeeded = subject.expected_hours_per_week;

  /**
   * Recursively places one slot at a time for the current subject.
   *
   * @param {import('./slot.service.js').Grid} currentGrid
   * @param {number}                           placedCount  – slots placed so far
   * @returns {import('./slot.service.js').Grid | null}
   */
  function placeSlots(currentGrid, placedCount) {
    if (counter.count++ > MAX_ITERATIONS) return null;

    // All slots for this subject are placed → advance to next subject
    if (placedCount === slotsNeeded) {
      return scheduleSubjects(
        sortedSubjects, sequences, currentGrid, subjectIdx + 1, counter, orderedTimeSlots,
      );
    }

    const seqItem = slotSeq[placedCount];
    if (!seqItem) return null; // sequence shorter than expected (safety guard)

    const allSlots = getAvailableSlots(currentGrid);
    const ranked   = rankSlots(allSlots, currentGrid, subject, orderedTimeSlots);

    for (const { day, timeSlot } of ranked) {
      const candidate = {
        subject_id:  subject.subject_id,
        teacher_id:  seqItem.active_teacher_id,
        year:        subject.year,
        department:  subject.department,
        room:        null,
      };

      const check = checkConflict(currentGrid, day, timeSlot, candidate);

      // Hard constraint → skip this slot entirely
      if (!check.valid) continue;

      // Soft warn → still valid, but ranked lower by rankSlots; we continue
      const newGrid = setSlot(currentGrid, day, timeSlot, {
        subject_id:    subject.subject_id,
        subject_code:  subject.subject_code,
        teacher_id:    seqItem.active_teacher_id,
        module_id:     seqItem.module_id,
        module_number: seqItem.module_number,
        year:          subject.year,
        department:    subject.department,
        room:          null,
      });

      const result = placeSlots(newGrid, placedCount + 1);
      if (result !== null) return result;
      // Else: backtrack (newGrid is harmlessly discarded)
    }

    return null; // FAILURE — no valid slot found for this placement
  }

  return placeSlots(grid, 0);
}

// ─── Greedy fallback ─────────────────────────────────────────────────────────

/**
 * Places as many slots as possible for a single subject without backtracking.
 * Used in the greedy fallback when MAX_ITERATIONS is exceeded.
 *
 * @param {{ subject_id:number, subject_code:string, year:string, department:string, expected_hours_per_week:number }} subject
 * @param {import('./sequencing.service.js').SlotAssignment[]} slotSeq
 * @param {import('./slot.service.js').Grid} grid
 * @param {string[]} orderedTimeSlots
 * @returns {{ grid: import('./slot.service.js').Grid, success: boolean }}
 */
function greedyPlaceSubject(subject, slotSeq, grid, orderedTimeSlots) {
  const slotsNeeded = subject.expected_hours_per_week;
  let currentGrid   = grid;
  let placed        = 0;

  const ranked = rankSlots(getAvailableSlots(grid), grid, subject, orderedTimeSlots);

  for (const { day, timeSlot } of ranked) {
    if (placed === slotsNeeded) break;

    const seqItem   = slotSeq[placed];
    if (!seqItem) break;

    const candidate = {
      subject_id:  subject.subject_id,
      teacher_id:  seqItem.active_teacher_id,
      year:        subject.year,
      department:  subject.department,
      room:        null,
    };

    const check = checkConflict(currentGrid, day, timeSlot, candidate);
    if (!check.valid) continue;

    currentGrid = setSlot(currentGrid, day, timeSlot, {
      subject_id:    subject.subject_id,
      subject_code:  subject.subject_code,
      teacher_id:    seqItem.active_teacher_id,
      module_id:     seqItem.module_id,
      module_number: seqItem.module_number,
      year:          subject.year,
      department:    subject.department,
      room:          null,
    });
    placed++;
  }

  return { grid: currentGrid, success: placed === slotsNeeded };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Entry point for the backtracking engine.
 *
 * Pre-fetches all slot sequences (async DB calls), then runs the recursive
 * CSP solver synchronously.  If MAX_ITERATIONS is exceeded, falls back to a
 * greedy per-subject pass and returns a partial result.
 *
 * @param {import('./weightage.service.js').WeightedSubject[]} sortedSubjects
 * @param {import('./slot.service.js').Grid}                   initialGrid
 * @param {string[]}                                           [orderedTimeSlots]
 * @returns {Promise<{
 *   grid:        import('./slot.service.js').Grid,
 *   incomplete:  boolean,
 *   unscheduled: import('./weightage.service.js').WeightedSubject[]
 * }>}
 */
export async function runBacktracker(sortedSubjects, initialGrid, orderedTimeSlots) {
  const ts = (msg) =>
    console.log(`[${new Date().toISOString()}] [Backtracker] ${msg}`);

  const timeSlotOrder = orderedTimeSlots ?? Object.keys(Object.values(initialGrid)[0] ?? {});

  ts(`Building slot sequences for ${sortedSubjects.length} subject(s)…`);
  const sequences = await Promise.all(sortedSubjects.map((s) => buildSlotSequence(s)));

  // ── Phase 1: Full recursive backtracking ──────────────────────────────────

  const counter = { count: 0 };

  ts('Starting full backtracking pass…');
  const fullResult = scheduleSubjects(
    sortedSubjects, sequences, initialGrid, 0, counter, timeSlotOrder,
  );

  if (fullResult !== null) {
    ts(`Full backtracking succeeded in ${counter.count} iteration(s).`);
    return { grid: fullResult, incomplete: false, unscheduled: [] };
  }

  // ── Phase 2: Greedy fallback ───────────────────────────────────────────────

  ts(`MAX_ITERATIONS (${MAX_ITERATIONS}) reached. Falling back to greedy pass…`);

  const unscheduled  = [];
  let currentGrid    = initialGrid;

  for (let i = 0; i < sortedSubjects.length; i++) {
    const subject = sortedSubjects[i];
    const { grid: updatedGrid, success } = greedyPlaceSubject(
      subject, sequences[i], currentGrid, timeSlotOrder,
    );

    if (success) {
      currentGrid = updatedGrid;
    } else {
      ts(`  ✗ Could not schedule "${subject.subject_code}" (${subject.year}-${subject.department})`);
      unscheduled.push(subject);
    }
  }

  ts(`Greedy pass complete. Unscheduled: ${unscheduled.length} subject(s).`);

  return {
    grid:        currentGrid,
    incomplete:  true,
    unscheduled,
  };
}
