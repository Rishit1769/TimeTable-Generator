/**
 * generate.routes.js
 *
 * Mounts on /api (see app.js).
 *
 * Routes:
 *   POST /generate             — run the scheduling pipeline
 *   GET  /grid                 — retrieve the persisted timetable grid
 *   GET  /teacher-hours/:id    — workload query for a specific teacher
 *
 * All business logic lives in the scheduler service; this file only handles
 * HTTP plumbing (parsing, validation, status codes, error formatting).
 */

import express                  from 'express';
import { runScheduler }         from '../services/scheduler/index.js';
import { getGridByDeptYear,
         getTeacherWeeklyHours } from '../db/grid.queries.js';
import { DEFAULT_DAYS,
         DEFAULT_TIME_SLOTS }   from '../services/scheduler/slot.service.js';

const router = express.Router();

// ─── Input validation helpers ────────────────────────────────────────────────

const VALID_YEARS = new Set(['FY', 'SY', 'TY']);
const VALID_DAYS  = new Set(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);

/**
 * Validates the optional days array from the request body.
 * Returns { valid: true, days } or { valid: false, reason }.
 *
 * @param {unknown} raw
 * @returns {{ valid: boolean, days?: string[], reason?: string }}
 */
function parseDays(raw) {
  if (raw == null) return { valid: true, days: DEFAULT_DAYS };
  if (!Array.isArray(raw) || raw.length === 0) {
    return { valid: false, reason: '"days" must be a non-empty array.' };
  }
  const invalid = raw.filter((d) => typeof d !== 'string' || !VALID_DAYS.has(d.toUpperCase()));
  if (invalid.length > 0) {
    return { valid: false, reason: `Invalid day(s): ${invalid.join(', ')}. Allowed: MON TUE WED THU FRI SAT` };
  }
  return { valid: true, days: raw.map((d) => d.toUpperCase()) };
}

/**
 * Validates an optional array of time-slot strings (format HH:MM-HH:MM).
 *
 * @param {unknown} raw
 * @returns {{ valid: boolean, timeSlots?: string[], reason?: string }}
 */
function parseTimeSlots(raw) {
  if (raw == null) return { valid: true, timeSlots: DEFAULT_TIME_SLOTS };
  if (!Array.isArray(raw) || raw.length === 0) {
    return { valid: false, reason: '"time_slots" must be a non-empty array.' };
  }
  const slotPattern = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
  const invalid = raw.filter((s) => typeof s !== 'string' || !slotPattern.test(s));
  if (invalid.length > 0) {
    return { valid: false, reason: `Invalid time_slot format(s): ${invalid.join(', ')}. Expected HH:MM-HH:MM.` };
  }
  return { valid: true, timeSlots: raw };
}

// ─── POST /api/generate ──────────────────────────────────────────────────────

router.post('/generate', async (req, res, next) => {
  const { department, year, days: rawDays, time_slots: rawTimeSlots } = req.body ?? {};

  // Validate year enum if provided
  if (year != null && !VALID_YEARS.has(String(year).toUpperCase())) {
    return res.status(400).json({
      success: false,
      error:   `Invalid year "${year}". Allowed values: FY, SY, TY.`,
    });
  }

  const daysResult = parseDays(rawDays);
  if (!daysResult.valid) {
    return res.status(400).json({ success: false, error: daysResult.reason });
  }

  const slotsResult = parseTimeSlots(rawTimeSlots);
  if (!slotsResult.valid) {
    return res.status(400).json({ success: false, error: slotsResult.reason });
  }

  try {
    console.log(`[${new Date().toISOString()}] [POST /api/generate] dept=${department ?? 'ALL'} year=${year ?? 'ALL'}`);

    const result = await runScheduler({
      department: department ? String(department) : null,
      year:       year       ? String(year).toUpperCase() : null,
      days:       daysResult.days,
      timeSlots:  slotsResult.timeSlots,
    });

    // ── 422: No subjects ───────────────────────────────────────────────────
    if (!result.success) {
      return res.status(422).json({ success: false, error: result.error });
    }

    const { grid2D, meta } = result;

    // ── 206: Partial success ───────────────────────────────────────────────
    if (meta.incomplete) {
      return res.status(206).json({
        success: true,
        partial: true,
        data:    { grid: grid2D, meta },
        warning: `${meta.unscheduled.length} subject(s) could not be scheduled. `
               + 'Increase available time slots or reduce expected_hours_per_week.',
      });
    }

    // ── 200: Full success ──────────────────────────────────────────────────
    return res.status(200).json({ success: true, data: { grid: grid2D, meta } });

  } catch (err) {
    return next(err);
  }
});

// ─── GET /api/grid ───────────────────────────────────────────────────────────

router.get('/grid', async (req, res, next) => {
  const { department, year } = req.query;

  try {
    const rows = await getGridByDeptYear(
      department ? String(department) : null,
      year       ? String(year)       : null,
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// ─── GET /api/teacher-hours/:id ──────────────────────────────────────────────

router.get('/teacher-hours/:id', async (req, res, next) => {
  const teacherId = parseInt(req.params.id, 10);
  if (isNaN(teacherId) || teacherId < 1) {
    return res.status(400).json({ success: false, error: 'Invalid teacher id.' });
  }

  try {
    const weeklySlots = await getTeacherWeeklyHours(teacherId);
    return res.json({ teacher_id: teacherId, weekly_slots: weeklySlots });
  } catch (err) {
    return next(err);
  }
});

export default router;
