/**
 * scheduler/index.js
 *
 * Orchestrates the full Phase 2 pipeline in a single async function:
 *
 *   1. getSortedSubjects()            ← weighted priority queue
 *   2. initGrid()                     ← fresh in-memory grid
 *   3. runBacktracker()               ← CSP solver + greedy fallback
 *   4. buildGridJSON()                ← enrich IDs → display names
 *   5. clearGridByDeptYear()          ← remove stale DB rows
 *   6. batchInsertGrid()              ← persist new rows
 *
 * Returns a plain result object consumed directly by the route handler.
 * No HTTP concerns leak into this file.
 */

import { getSortedSubjects }                from './weightage.service.js';
import { initGrid, DEFAULT_DAYS, DEFAULT_TIME_SLOTS } from './slot.service.js';
import { runBacktracker }                   from './backtracker.js';
import { buildGridJSON, buildSubjectMap, buildTeacherMap } from './grid.builder.js';
import { clearGridByDeptYear, batchInsertGrid }             from '../../db/grid.queries.js';

/**
 * @typedef {Object} SchedulerOptions
 * @property {string|null}   [department]  – filter subjects by department
 * @property {string|null}   [year]        – filter subjects by year (FY/SY/TY)
 * @property {string[]}      [days]        – override default day list
 * @property {string[]}      [timeSlots]   – override default time-slot list
 */

/**
 * @typedef {Object} SchedulerResult
 * @property {boolean}       success
 * @property {string}        [error]     – present when success = false
 * @property {Object}        [grid2D]
 * @property {Object[]}      [grid1D]
 * @property {{ generated_at:string, total_subjects_scheduled:number, incomplete:boolean, unscheduled:string[] }} [meta]
 */

/**
 * Log helper — prefixes every message with a UTC timestamp.
 *
 * @param {string} step
 * @param {string} msg
 */
function log(step, msg) {
  console.log(`[${new Date().toISOString()}] [Scheduler:${step}] ${msg}`);
}

/**
 * Runs the complete timetable generation pipeline.
 *
 * @param {SchedulerOptions} options
 * @returns {Promise<SchedulerResult>}
 */
export async function runScheduler(options = {}) {
  const {
    department = null,
    year       = null,
    days       = DEFAULT_DAYS,
    timeSlots  = DEFAULT_TIME_SLOTS,
  } = options;

  // ── Step 1: Fetch & prioritise subjects ─────────────────────────────────────

  log('WeightageService', `Fetching subjects (dept=${department ?? 'ALL'}, year=${year ?? 'ALL'})…`);
  const sortedSubjects = await getSortedSubjects(department, year);

  if (sortedSubjects.length === 0) {
    return {
      success: false,
      error:   'No validated subjects found. Run CSV upload and validation first.',
    };
  }

  log('WeightageService', `${sortedSubjects.length} subject(s) loaded and sorted by priority.`);

  // ── Step 2: Initialise in-memory grid ──────────────────────────────────────

  log('SlotService', `Initialising grid: ${days.length} days × ${timeSlots.length} slots.`);
  const initialGrid = initGrid(days, timeSlots);

  // ── Step 3: Run backtracker / CSP ─────────────────────────────────────────

  log('Backtracker', 'Starting CSP solver…');
  const { grid: filledGrid, incomplete, unscheduled } = await runBacktracker(
    sortedSubjects,
    initialGrid,
    timeSlots,
  );

  log('Backtracker', incomplete
    ? `Partial result. ${unscheduled.length} subject(s) could not be placed.`
    : 'Full schedule generated successfully.',
  );

  // ── Step 4: Enrich grid with display names ────────────────────────────────

  log('GridBuilder', 'Building 2D and 1D grid representations…');
  const subjectMap = buildSubjectMap(sortedSubjects);
  const teacherMap = buildTeacherMap(sortedSubjects);
  const { grid2D, grid1D, meta } = buildGridJSON(filledGrid, subjectMap, teacherMap);

  // Merge backtracker outcome into meta
  meta.incomplete  = incomplete;
  meta.unscheduled = unscheduled.map((s) => s.subject_code);

  log('GridBuilder', `${meta.total_subjects_scheduled} subject(s) scheduled; ${grid1D.length} slot(s) in 1D list.`);

  // ── Step 5 + 6: Persist to DB ─────────────────────────────────────────────

  log('DB', `Clearing existing grid rows (dept=${department ?? 'ALL'}, year=${year ?? 'ALL'})…`);
  await clearGridByDeptYear(department, year);

  if (grid1D.length > 0) {
    log('DB', `Inserting ${grid1D.length} row(s) into master_grid…`);
    await batchInsertGrid(grid1D);
    log('DB', 'Persist complete.');
  } else {
    log('DB', 'No rows to insert (empty grid).');
  }

  return { success: true, grid2D, grid1D, meta };
}
