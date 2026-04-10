/**
 * slot.service.js
 *
 * Builds and manages the in-memory slot grid that the backtracking algorithm
 * operates on before any data is committed to the database.
 *
 * Grid shape (supports multiple concurrent classes per slot so that
 * cross-department / cross-year scheduling can coexist correctly):
 *
 *   grid[day][timeSlot] = OccupiedSlot[]   (empty array = nothing scheduled)
 *
 * All mutating operations (setSlot, clearSlot) return NEW grid objects —
 * they never mutate in place. Structural sharing is used (spread-copy only
 * the affected day and time-slot) for efficient backtracking.
 */

// ─── Default configuration ────────────────────────────────────────────────────

export const DEFAULT_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export const DEFAULT_TIME_SLOTS = [
  '09:00-10:00',
  '10:00-11:00',
  '11:00-12:00',
  '12:00-13:00',
  '14:00-15:00',
  '15:00-16:00',
  '16:00-17:00',
];

// ─── Types (JSDoc) ────────────────────────────────────────────────────────────

/**
 * @typedef {Object} OccupiedSlot
 * @property {number}      subject_id
 * @property {string}      subject_code
 * @property {number|null} teacher_id
 * @property {number|null} module_id
 * @property {number|null} module_number
 * @property {string}      year
 * @property {string}      department
 * @property {string|null} room
 */

/**
 * @typedef {Object.<string, Object.<string, OccupiedSlot[]>>} Grid
 *   grid[day][timeSlot] = OccupiedSlot[]
 */

// ─── Grid factory ─────────────────────────────────────────────────────────────

/**
 * Creates a fresh empty grid with all slots initialised to empty arrays.
 *
 * @param {string[]} [days]      - Defaults to DEFAULT_DAYS.
 * @param {string[]} [timeSlots] - Defaults to DEFAULT_TIME_SLOTS.
 * @returns {Grid}
 */
export function initGrid(days = DEFAULT_DAYS, timeSlots = DEFAULT_TIME_SLOTS) {
  const grid = {};
  for (const day of days) {
    grid[day] = {};
    for (const slot of timeSlots) {
      grid[day][slot] = [];
    }
  }
  return grid;
}

// ─── Slot accessors ───────────────────────────────────────────────────────────

/**
 * Returns the list of OccupiedSlot entries at a specific day + time-slot.
 * Returns an empty array if the day or slot does not exist in the grid.
 *
 * @param {Grid}   grid
 * @param {string} day
 * @param {string} timeSlot
 * @returns {OccupiedSlot[]}
 */
export function getSlot(grid, day, timeSlot) {
  return grid[day]?.[timeSlot] ?? [];
}

/**
 * Returns a new grid with slotData appended to the given day + time-slot.
 * Uses structural sharing — only the affected day and slot are shallow-copied.
 *
 * @param {Grid}         grid
 * @param {string}       day
 * @param {string}       timeSlot
 * @param {OccupiedSlot} slotData
 * @returns {Grid}
 */
export function setSlot(grid, day, timeSlot, slotData) {
  const existingEntries = grid[day]?.[timeSlot] ?? [];
  return {
    ...grid,
    [day]: {
      ...grid[day],
      [timeSlot]: [...existingEntries, slotData],
    },
  };
}

/**
 * Returns a new grid with all entries matching subjectId removed from the
 * specified day + time-slot.  Leaves all other slots unchanged.
 *
 * @param {Grid}   grid
 * @param {string} day
 * @param {string} timeSlot
 * @param {number} subjectId - The subject_id whose entry should be removed.
 * @returns {Grid}
 */
export function clearSlot(grid, day, timeSlot, subjectId) {
  const existingEntries = grid[day]?.[timeSlot] ?? [];
  return {
    ...grid,
    [day]: {
      ...grid[day],
      [timeSlot]: existingEntries.filter((e) => e.subject_id !== subjectId),
    },
  };
}

// ─── Grid queries ─────────────────────────────────────────────────────────────

/**
 * Returns all {day, timeSlot} combinations present in the grid.
 * Because every slot starts as an empty array, this is equivalent to
 * "all possible slots in this schedule configuration."
 *
 * @param {Grid} grid
 * @returns {Array<{day: string, timeSlot: string}>}
 */
export function getAvailableSlots(grid) {
  const slots = [];
  for (const day of Object.keys(grid)) {
    for (const timeSlot of Object.keys(grid[day])) {
      slots.push({ day, timeSlot });
    }
  }
  return slots;
}

/**
 * Counts how many times a specific subject already appears on a given day,
 * across all time-slots for that day.  Used to enforce spread distribution.
 *
 * @param {Grid}   grid
 * @param {number} subjectId
 * @param {string} day
 * @returns {number}
 */
export function getSubjectSlotsPerDay(grid, subjectId, day) {
  const daySlots = grid[day];
  if (!daySlots) return 0;
  let count = 0;
  for (const entries of Object.values(daySlots)) {
    for (const entry of entries) {
      if (entry.subject_id === subjectId) count++;
    }
  }
  return count;
}
