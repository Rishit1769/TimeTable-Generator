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
 *   getTeachersWorkload()                   — all teachers with slot count + utilization
 *   swapGridSlots(slotA, slotB)             — swap two day/time_slot entries
 *   reconstructInMemoryGrid()              — builds OccupiedSlot grid from DB rows
 *   getSubjectsWithModules(dept, year)     — subjects + modules + teacher names (for export/print)
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
      s.id          AS subject_id,
      s.name        AS subject_name,
      s.code        AS subject_code,
      s.paper_code,
      t.id          AS teacher_id,
      t.name        AS teacher_name,
      sm.id         AS module_id,
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

// ─── getTeachersWorkload ──────────────────────────────────────────────────────

/**
 * Returns all teachers with their current weekly slot count and max hours,
 * suitable for the Phase 3 workload sidebar.
 *
 * @returns {Promise<Array<{teacher_id:number, name:string, department:string, weekly_hours:number, max_hours_per_week:number, utilization_percent:number}>>}
 */
export async function getTeachersWorkload() {
  const [rows] = await pool.execute(`
    SELECT
      t.id                AS teacher_id,
      t.name,
      t.department,
      t.max_hours_per_week,
      COUNT(mg.id)        AS weekly_hours
    FROM   teachers t
    LEFT   JOIN master_grid mg ON t.id = mg.teacher_id
    GROUP  BY t.id, t.name, t.department, t.max_hours_per_week
    ORDER  BY t.name
  `);

  return rows.map((r) => {
    const weekly_hours        = Number(r.weekly_hours);
    const max_hours_per_week  = Number(r.max_hours_per_week);
    return {
      teacher_id:         Number(r.teacher_id),
      name:               r.name,
      department:         r.department,
      weekly_hours,
      max_hours_per_week,
      utilization_percent: max_hours_per_week > 0
        ? Math.round((weekly_hours / max_hours_per_week) * 100)
        : 0,
    };
  });
}

// ─── swapGridSlots ────────────────────────────────────────────────────────────

/**
 * Swaps the day+time_slot of two sets of grid rows identified by their
 * positions.  All rows at slotA move to slotB positions and vice versa.
 *
 * @param {{ day: string, timeSlot: string }} slotA
 * @param {{ day: string, timeSlot: string }} slotB
 * @returns {Promise<void>}
 */
export async function swapGridSlots(slotA, slotB) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Use a sentinel time_slot to avoid UK collision during the swap
    const TEMP = '__swap_temp__';

    await conn.execute(
      'UPDATE master_grid SET time_slot = ? WHERE day = ? AND time_slot = ?',
      [TEMP, slotA.day, slotA.timeSlot],
    );
    await conn.execute(
      'UPDATE master_grid SET day = ?, time_slot = ? WHERE day = ? AND time_slot = ?',
      [slotA.day, slotA.timeSlot, slotB.day, slotB.timeSlot],
    );
    await conn.execute(
      'UPDATE master_grid SET day = ?, time_slot = ? WHERE day = ? AND time_slot = ?',
      [slotB.day, slotB.timeSlot, slotA.day, TEMP],
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ─── reconstructInMemoryGrid ──────────────────────────────────────────────────

/**
 * Fetches all master_grid rows and rebuilds the in-memory grid format used by
 * conflict.checker.js.  Each cell holds an array of OccupiedSlot objects
 * because multiple cohorts (different year/dept) can share a time slot.
 *
 * @returns {Promise<Object.<string, Object.<string, Array<{subject_id:number|null, teacher_id:number|null, module_id:number|null, year:string, department:string, room:string|null}>>>>}
 */
export async function reconstructInMemoryGrid() {
  const [rows] = await pool.execute(
    'SELECT day, time_slot, subject_id, teacher_id, module_id, year, department, room FROM master_grid',
  );

  const grid = {};
  for (const row of rows) {
    if (!grid[row.day])                           grid[row.day]                 = {};
    if (!grid[row.day][row.time_slot])             grid[row.day][row.time_slot]  = [];
    grid[row.day][row.time_slot].push({
      subject_id: row.subject_id,
      teacher_id: row.teacher_id,
      module_id:  row.module_id,
      year:       row.year,
      department: row.department,
      room:       row.room,
    });
  }
  return grid;
}

// ─── getSubjectsWithModules ───────────────────────────────────────────────────

/**
 * Returns all subjects with their associated modules and per-module teacher
 * name.  Used by the export print page (legend) and the projections endpoint.
 *
 * @param {string|null} department
 * @param {string|null} year
 * @returns {Promise<Array<{
 *   id: number, subject_code: string, subject_name: string,
 *   paper_code: string, credits: number, year: string, department: string,
 *   expected_hours_per_week: number, total_semester_hours: number,
 *   teacher1_name: string|null, teacher2_name: string|null,
 *   modules: Array<{id:number, module_number:number, module_name:string,
 *                   module_hours:number, assigned_teacher_name:string|null}>
 * }>>}
 */
export async function getSubjectsWithModules(department, year) {
  const conditions = [];
  const params     = [];

  if (department) { conditions.push('s.department = ?'); params.push(department); }
  if (year)       { conditions.push('s.year = ?');       params.push(year); }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const [rows] = await pool.execute(`
    SELECT
      s.id,
      s.code        AS subject_code,
      s.name        AS subject_name,
      s.paper_code,
      s.credits,
      s.year,
      s.department,
      s.expected_hours_per_week,
      s.total_semester_hours,
      t1.name       AS teacher1_name,
      t2.name       AS teacher2_name,
      sm.id         AS module_id,
      sm.module_number,
      sm.module_name,
      sm.module_hours,
      tm.name       AS assigned_teacher_name
    FROM   subjects s
    LEFT   JOIN teachers         t1 ON s.teacher1_id        = t1.id
    LEFT   JOIN teachers         t2 ON s.teacher2_id        = t2.id
    LEFT   JOIN subject_modules  sm ON sm.subject_id        = s.id
    LEFT   JOIN teachers         tm ON sm.assigned_teacher_id = tm.id
    ${whereClause}
    ORDER  BY s.id, sm.module_number
  `, params);

  // Group module rows back onto their parent subject
  /** @type {Map<number, object>} */
  const subjectMap = new Map();

  for (const row of rows) {
    if (!subjectMap.has(row.id)) {
      subjectMap.set(row.id, {
        id:                      row.id,
        subject_code:            row.subject_code,
        subject_name:            row.subject_name,
        paper_code:              row.paper_code,
        credits:                 Number(row.credits),
        year:                    row.year,
        department:              row.department,
        expected_hours_per_week: Number(row.expected_hours_per_week),
        total_semester_hours:    Number(row.total_semester_hours),
        teacher1_name:           row.teacher1_name ?? null,
        teacher2_name:           row.teacher2_name ?? null,
        modules:                 [],
      });
    }

    if (row.module_id != null) {
      subjectMap.get(row.id).modules.push({
        id:                   row.module_id,
        module_number:        Number(row.module_number),
        module_name:          row.module_name,
        module_hours:         Number(row.module_hours),
        assigned_teacher_name: row.assigned_teacher_name ?? null,
      });
    }
  }

  return [...subjectMap.values()];
}
