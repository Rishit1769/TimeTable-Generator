/**
 * weekly.target.service.js
 *
 * After a successful module audit, computes the weekly scheduling constraints
 * for every subject.  These constraint objects will be consumed by the
 * Phase 2 timetable-generation algorithm.
 *
 * All business logic for weekly-target computation lives here so that
 * the route handler and middleware remain free of such concerns.
 */

/**
 * @typedef {Object} WeeklyTarget
 * @property {string} subject_code
 * @property {string} subject_name
 * @property {string} year
 * @property {string} department
 * @property {number} weekly_slots_needed  – directly equal to expected_hours_per_week
 */

/**
 * Derive one WeeklyTarget per parsed row.
 *
 * @param {import('./csv.parser.service.js').ParsedRow[]} parsedRows
 * @returns {WeeklyTarget[]}
 */
export function computeWeeklyTargets(parsedRows) {
  return parsedRows.map(({ subject }) => ({
    subject_code:        subject.code,
    subject_name:        subject.name,
    year:                subject.year,
    department:          subject.department,
    weekly_slots_needed: subject.expected_hours_per_week,
  }));
}
