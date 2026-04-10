/**
 * grid.queries.js
 *
 * All parameterized MySQL read/write operations for the master_grid table.
 * No raw string interpolation — every user-supplied value is bound via
 * the mysql2 prepared-statement placeholder (?) mechanism.
 *
 * Exported functions:
 *   clearGridByDeptYear(department, year)   — deletes stale rows before regen
 *   batchInsertGrid(rows[])                 — bulk-inserts 1D grid list
 *   getGridByDeptYear(department, year)     — fetches grid for display/export
 *   getTeacherWeeklyHours(teacher_id)       — counts a teacher's weekly slots
 */

import pool from './connection.js';

/**
 * @typedef {Object} GridRow
 * @property {string}      day
 * @property {string}      time_slot
 * @property {number|null} subject_id
 * @property {number|null} teacher_id
 * @property {number|null} module_id
 * @property {string}      year
 * @property {string}      department
 * @property {string|null} room
 */

// ─── clearGridByDeptYear ──────────────────────────────────────────────────────

/**
 * Deletes all existing master_grid rows that match the filter criteria before
 * a fresh generation run.
 *
 * If both department and year are null, the ENTIRE master_grid is cleared
 * (used when generating a school-wide timetable in one shot).
 *
 * @param {string|null} department
 * @param {string|null} year
 * @returns {Promise<void>}
 */
export async function clearGridByDeptYear(department, year) {
  const conditions = [];
  const params     = [];

  if (department) { conditions.push('department = ?'); params.push(department); }
  if (year)       { conditions.push('year = ?');       params.push(year); }

  const sql = conditions.length > 0
    ? `DELETE FROM master_grid WHERE ${conditions.join(' AND ')}`
    : 'DELETE FROM master_grid';

  await pool.execute(sql, params);
}

// ─── batchInsertGrid ──────────────────────────────────────────────────────────

/**
 * Inserts an array of 1D grid rows into master_grid in a single round-trip.
 * Falls back to individual inserts when the array is empty.
 *
 * @param {GridRow[]} rows
 * @returns {Promise<void>}
 */
export async function batchInsertGrid(rows) {
  if (rows.length === 0) return;

  // Build a multi-row INSERT: INSERT INTO ... VALUES (?,?,...), (?,?,...), ...
  const columns = ['day', 'time_slot', 'subject_id', 'teacher_id', 'module_id', 'year', 'department', 'room'];
  const placeholderRow = `(${columns.map(() => '?').join(', ')})`;
  const placeholders   = rows.map(() => placeholderRow).join(', ');

  const sql = `
    INSERT INTO master_grid (${columns.join(', ')})
    VALUES ${placeholders}
  `;

  // Flatten rows into a single values array in column order
  const values = rows.flatMap((r) => [
    r.day        ?? null,
    r.time_slot  ?? null,
    r.subject_id ?? null,
    r.teacher_id ?? null,
    r.module_id  ?? null,
    r.year       ?? null,
    r.department ?? null,
    r.room       ?? null,
  ]);

  await pool.execute(sql, values);
}

// ─── getGridByDeptYear ────────────────────────────────────────────────────────

/**
 * Fetches all master_grid rows for the given filter, joined with subject and
 * teacher display names, ordered by day and time-slot.
 *
 * Filters are optional — pass null to get the full school-wide grid.
 *
 * @param {string|null} department
 * @param {string|null} year
 * @returns {Promise<Object[]>}
 */
export async function getGridByDeptYear(department, year) {
  const conditions = [];
  const params     = [];

  if (department) { conditions.push('mg.department = ?'); params.push(department); }
  if (year)       { conditions.push('mg.year = ?');       params.push(year); }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const sql = `
    SELECT
      mg.id,
      mg.day,
      mg.time_slot,
      mg.year,
      mg.department,
      mg.room,
      s.id     AS subject_id,
      s.name   AS subject_name,
      s.code   AS subject_code,
      t.id     AS teacher_id,
      t.name   AS teacher_name,
      sm.id          AS module_id,
      sm.module_number,
      sm.module_name
    FROM   master_grid mg
    LEFT   JOIN subjects       s  ON mg.subject_id = s.id
    LEFT   JOIN teachers       t  ON mg.teacher_id = t.id
    LEFT   JOIN subject_modules sm ON mg.module_id  = sm.id
    ${whereClause}
    ORDER  BY
      FIELD(mg.day, 'MON','TUE','WED','THU','FRI','SAT'),
      mg.time_slot
  `;

  const [rows] = await pool.execute(sql, params);
  return rows;
}

// ─── getTeacherWeeklyHours ────────────────────────────────────────────────────

/**
 * Counts how many slots a specific teacher is currently assigned in the
 * master_grid (i.e., their weekly workload in the persisted timetable).
 *
 * Useful for workload-balance reporting and for Phase 3 room/teacher checks.
 *
 * @param {number} teacherId
 * @returns {Promise<number>}
 */
export async function getTeacherWeeklyHours(teacherId) {
  const [[row]] = await pool.execute(
    'SELECT COUNT(*) AS weekly_slots FROM master_grid WHERE teacher_id = ?',
    [teacherId],
  );
  return Number(row.weekly_slots);
}
