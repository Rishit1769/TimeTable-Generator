/**
 * sequencing.service.js
 *
 * Determines WHAT goes into each weekly slot for a subject, in order.
 * It does NOT assign days or time-slots — that is the backtracker's job.
 *
 * Rules:
 *   • Modules 1–3  → active teacher is teacher1.
 *   • Modules 4–6  → active teacher is teacher2.
 *   • If teacher2 is absent, teacher1 handles all modules.
 *
 * The weekly slot count equals subject.expected_hours_per_week.
 * Slots are distributed across the two teachers proportionally by their
 * total module-hours; within each teacher's portion the primary module_id
 * is used (the first of that teacher's modules), since the exact
 * within-module spread is tracked at semester level, not weekly-grid level.
 */

import pool from '../../db/connection.js';

/**
 * @typedef {Object} SlotAssignment
 * @property {number}      slot_sequence    – 1-based index within the week
 * @property {number|null} module_id        – FK to subject_modules.id
 * @property {number}      module_number    – 1-based module index
 * @property {number|null} active_teacher_id
 */

/**
 * Fetches all modules for a subject from the DB, ordered by module_number.
 *
 * @param {number} subjectId
 * @returns {Promise<Array<{id:number, module_number:number, module_name:string, module_hours:number, assigned_teacher_id:number|null}>>}
 */
async function getModulesForSubject(subjectId) {
  const [rows] = await pool.execute(
    `SELECT id, module_number, module_name, module_hours, assigned_teacher_id
       FROM subject_modules
      WHERE subject_id = ?
      ORDER BY module_number ASC`,
    [subjectId],
  );
  return rows;
}

/**
 * Builds the ordered sequence of SlotAssignment objects for a subject's
 * weekly timetable slots.
 *
 * @param {import('../scheduler/weightage.service.js').WeightedSubject} subject
 * @returns {Promise<SlotAssignment[]>}
 */
export async function buildSlotSequence(subject) {
  const modules = await getModulesForSubject(subject.subject_id);

  const slotsNeeded  = subject.expected_hours_per_week;
  const teacher1Id   = subject.teacher1_id;
  const teacher2Id   = subject.teacher2_id   ?? null;

  // ── Partition modules by teacher boundary ──────────────────────────────────

  const t1Modules = modules.filter((m) => m.module_number <= 3);
  const t2Modules = modules.filter((m) => m.module_number >  3);

  // If no teacher2 (or no teacher2 modules), all slots belong to teacher1
  if (!teacher2Id || t2Modules.length === 0) {
    const primary = t1Modules[0] ?? modules[0] ?? null;
    return Array.from({ length: slotsNeeded }, (_, i) => ({
      slot_sequence:     i + 1,
      module_id:         primary?.id          ?? null,
      module_number:     primary?.module_number ?? 1,
      active_teacher_id: teacher1Id,
    }));
  }

  // ── Proportional distribution based on module hours ────────────────────────

  const t1Hours   = t1Modules.reduce((s, m) => s + Number(m.module_hours), 0);
  const t2Hours   = t2Modules.reduce((s, m) => s + Number(m.module_hours), 0);
  const totalHours = t1Hours + t2Hours;

  const t1Slots = totalHours > 0
    ? Math.max(1, Math.round(slotsNeeded * (t1Hours / totalHours)))
    : Math.ceil(slotsNeeded / 2);
  const t2Slots = slotsNeeded - t1Slots;

  const t1Primary = t1Modules[0];
  const t2Primary = t2Modules[0];

  const sequence = [];

  for (let i = 0; i < t1Slots; i++) {
    sequence.push({
      slot_sequence:     sequence.length + 1,
      module_id:         t1Primary?.id           ?? null,
      module_number:     t1Primary?.module_number ?? 1,
      active_teacher_id: teacher1Id,
    });
  }

  for (let i = 0; i < t2Slots; i++) {
    sequence.push({
      slot_sequence:     sequence.length + 1,
      module_id:         t2Primary?.id           ?? null,
      module_number:     t2Primary?.module_number ?? 4,
      active_teacher_id: teacher2Id,
    });
  }

  return sequence;
}
