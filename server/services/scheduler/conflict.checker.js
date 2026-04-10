/**
 * conflict.checker.js
 *
 * The single most critical utility in Phase 2.
 * Evaluates whether placing a candidate entry at a specific day + time-slot
 * violates any hard constraint, and surfaces soft-constraint warnings.
 *
 * Checks (evaluated in order):
 *   1. Year / Department clash   — same cohort already has a class here.
 *   2. Teacher double-booking    — teacher is already teaching at this time.
 *   3. Room conflict             — room is already in use at this time.
 *   4. Spread soft check         — subject already appears ≥ 2 times today.
 *
 * Returns { valid: boolean, reason: string | null }
 *   valid  = false  →  hard violation; do NOT place.
 *   valid  = true   →  place is allowed; reason may contain a soft warning.
 */

import { getSlot, getSubjectSlotsPerDay } from './slot.service.js';

/**
 * @typedef {Object} ConflictCandidate
 * @property {number}      subject_id
 * @property {number|null} teacher_id
 * @property {string}      year
 * @property {string}      department
 * @property {string|null} room
 */

/**
 * @typedef {Object} ConflictResult
 * @property {boolean}     valid
 * @property {string|null} reason   null when fully valid with no warnings
 */

/**
 * Checks all hard and soft constraints before placing a slot.
 *
 * @param {import('./slot.service.js').Grid} grid
 * @param {string}            day
 * @param {string}            timeSlot
 * @param {ConflictCandidate} candidate
 * @returns {ConflictResult}
 */
export function checkConflict(grid, day, timeSlot, candidate) {
  const entries = getSlot(grid, day, timeSlot);

  // ── 1. Year / Department clash ─────────────────────────────────────────────
  // A cohort (year + department) can attend only one class at a time.
  // This is the primary "slot occupied" gate for the candidate's cohort.

  const yearDeptClash = entries.find(
    (e) => e.year === candidate.year && e.department === candidate.department,
  );
  if (yearDeptClash) {
    return {
      valid:  false,
      reason: `${candidate.year}-${candidate.department} already has a class at ${day} ${timeSlot}`,
    };
  }

  // ── 2. Teacher double-booking ──────────────────────────────────────────────
  // A teacher can only be in one place at a time.
  // We scan all concurrent entries (various cohorts) at this time-slot.

  if (candidate.teacher_id != null) {
    const teacherClash = entries.find((e) => e.teacher_id === candidate.teacher_id);
    if (teacherClash) {
      return {
        valid:  false,
        reason: `Teacher (id=${candidate.teacher_id}) is already scheduled at ${day} ${timeSlot}`,
      };
    }
  }

  // ── 3. Room conflict ───────────────────────────────────────────────────────
  // A physical room cannot host two classes simultaneously.

  if (candidate.room != null) {
    const roomClash = entries.find((e) => e.room === candidate.room);
    if (roomClash) {
      return {
        valid:  false,
        reason: `Room ${candidate.room} is already occupied at ${day} ${timeSlot}`,
      };
    }
  }

  // ── 4. Spread soft check ───────────────────────────────────────────────────
  // Discourage the same subject appearing more than twice on the same day.
  // Still valid — backtracker should deprioritize but not block.

  const slotsToday = getSubjectSlotsPerDay(grid, candidate.subject_id, day);
  if (slotsToday >= 2) {
    return {
      valid:  true,
      reason: `soft_warn: subject ${candidate.subject_id} already appears ${slotsToday} time(s) today (${day})`,
    };
  }

  return { valid: true, reason: null };
}
