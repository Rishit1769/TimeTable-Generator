/**
 * grid.editor.routes.js
 *
 * Phase 3 editor-specific endpoints called by the interactive UI.
 *
 * Routes:
 *   POST /api/conflict-check     — real-time conflict validation during drag
 *   POST /api/grid/swap          — persist a slot swap to master_grid
 *   GET  /api/teachers/workload  — all teachers with live workload counts
 */

import express                from 'express';
import { checkConflict }      from '../services/scheduler/conflict.checker.js';
import {
  getTeachersWorkload,
  swapGridSlots,
  reconstructInMemoryGrid,
}                             from '../db/grid.queries.js';

const router = express.Router();

// ─── POST /api/conflict-check ────────────────────────────────────────────────

/**
 * Rebuilds the in-memory grid from the current master_grid DB state and runs
 * the conflict checker against the proposed placement.
 *
 * Body: { day, timeSlot, candidate: { subject_id?, teacher_id, year, department, room } }
 * Response: { valid: boolean, reason: string | null }
 */
router.post('/conflict-check', async (req, res, next) => {
  const { day, timeSlot, candidate } = req.body ?? {};

  if (!day || !timeSlot || !candidate) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: day, timeSlot, candidate.',
    });
  }

  if (!candidate.year || !candidate.department) {
    return res.status(400).json({
      success: false,
      error: 'candidate must include year and department.',
    });
  }

  try {
    // Reconstruct the live in-memory grid from the DB
    const grid = await reconstructInMemoryGrid();

    // Ensure the target slot exists in the grid (may be empty)
    if (!grid[day])            grid[day] = {};
    if (!grid[day][timeSlot])  grid[day][timeSlot] = [];

    const result = checkConflict(grid, day, timeSlot, {
      subject_id:  candidate.subject_id  ?? null,
      teacher_id:  candidate.teacher_id  ?? null,
      year:        candidate.year,
      department:  candidate.department,
      room:        candidate.room        ?? null,
    });

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// ─── POST /api/grid/swap ─────────────────────────────────────────────────────

/**
 * Persists a slot swap (or move) in master_grid.
 *
 * Body: {
 *   slotA: { day: string, timeSlot: string },
 *   slotB: { day: string, timeSlot: string }
 * }
 * Response: { success: true }
 */
router.post('/grid/swap', async (req, res, next) => {
  const { slotA, slotB } = req.body ?? {};

  const isValidSlot = (s) =>
    s && typeof s.day === 'string' && typeof s.timeSlot === 'string';

  if (!isValidSlot(slotA) || !isValidSlot(slotB)) {
    return res.status(400).json({
      success: false,
      error: 'slotA and slotB must each have string fields: day, timeSlot.',
    });
  }

  try {
    await swapGridSlots(slotA, slotB);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

// ─── GET /api/teachers/workload ───────────────────────────────────────────────

/**
 * Returns all teachers with their current master_grid slot count and
 * utilization_percent.
 *
 * Response: TeacherWorkload[]
 */
router.get('/teachers/workload', async (_req, res, next) => {
  try {
    const workloads = await getTeachersWorkload();
    return res.json(workloads);
  } catch (err) {
    return next(err);
  }
});

export default router;
