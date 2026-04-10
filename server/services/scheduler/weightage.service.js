/**
 * weightage.service.js
 *
 * Fetches all validated subjects from the database, computes a numeric
 * priority_score for each, and returns them sorted in descending priority
 * order so the backtracker schedules the most important subjects first.
 *
 * Priority formula:
 *   priority_score = (credits × 10) + (expected_hours_per_week × 5) + (total_semester_hours × 0.5)
 *
 * Higher-credit, more-frequent subjects are placed first, ensuring they get
 * the best (earliest) time slots before less-critical subjects compete.
 */

import pool from '../../db/connection.js';

/**
 * @typedef {Object} WeightedSubject
 * @property {number}      subject_id
 * @property {string}      subject_name
 * @property {string}      subject_code
 * @property {string}      paper_code
 * @property {string}      department
 * @property {string}      year
 * @property {number}      credits
 * @property {number}      total_semester_hours
 * @property {number}      expected_hours_per_week
 * @property {number|null} teacher1_id
 * @property {string|null} teacher1_name
 * @property {string|null} teacher1_email
 * @property {number|null} teacher2_id
 * @property {string|null} teacher2_name
 * @property {string|null} teacher2_email
 * @property {number}      priority_score
 */

/**
 * Fetches subjects from the DB (optionally filtered), computes their
 * priority scores, and returns them sorted highest-first.
 *
 * All DB values are returned as-is; the priority_score is computed in SQL
 * for consistency and returned alongside the row data.
 *
 * @param {string|null} [departmentFilter] - Restrict to a specific department.
 * @param {string|null} [yearFilter]       - Restrict to a specific year (FY/SY/TY).
 * @returns {Promise<WeightedSubject[]>}   Sorted descending by priority_score.
 */
export async function getSortedSubjects(departmentFilter = null, yearFilter = null) {
  // Build WHERE clause dynamically to avoid passing NULL as a bind param,
  // which behaves differently across MySQL drivers.
  const conditions = [];
  const params     = [];

  if (departmentFilter) {
    conditions.push('s.department = ?');
    params.push(departmentFilter);
  }
  if (yearFilter) {
    conditions.push('s.year = ?');
    params.push(yearFilter);
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const query = `
    SELECT
      s.id                                                                    AS subject_id,
      s.name                                                                  AS subject_name,
      s.code                                                                  AS subject_code,
      s.paper_code,
      s.department,
      s.year,
      s.credits,
      s.total_semester_hours,
      s.expected_hours_per_week,
      s.teacher1_id,
      s.teacher2_id,
      t1.name                                                                 AS teacher1_name,
      t1.email                                                                AS teacher1_email,
      t2.name                                                                 AS teacher2_name,
      t2.email                                                                AS teacher2_email,
      ((s.credits * 10) + (s.expected_hours_per_week * 5) + (s.total_semester_hours * 0.5)) AS priority_score
    FROM   subjects  s
    LEFT   JOIN teachers t1 ON s.teacher1_id = t1.id
    LEFT   JOIN teachers t2 ON s.teacher2_id = t2.id
    ${whereClause}
    ORDER  BY priority_score DESC
  `;

  const [rows] = await pool.execute(query, params);

  // mysql2 may return BigInt / Decimal strings for computed columns — normalise
  return rows.map((row) => ({
    ...row,
    credits:                 Number(row.credits),
    total_semester_hours:    Number(row.total_semester_hours),
    expected_hours_per_week: Number(row.expected_hours_per_week),
    priority_score:          Number(row.priority_score),
  }));
}
