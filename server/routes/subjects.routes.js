/**
 * subjects.routes.js
 *
 * Mounts on /api (see app.js).
 *
 * Routes:
 *   GET /subjects — Return all subjects with teacher info and module breakdown.
 *
 * Implementation note:
 *   We run two parameterized SELECTs (subjects + modules) and merge in JS
 *   rather than using GROUP_CONCAT, giving us clean typed objects.
 */

import express from 'express';
import pool    from '../db/connection.js';
import { getSubjectsWithModules } from '../db/grid.queries.js';

const router = express.Router();

router.get('/subjects', async (_req, res, next) => {
  try {
    // 1. Fetch all subjects joined with teacher names
    const [subjects] = await pool.execute(`
      SELECT
        s.id,
        s.name,
        s.code,
        s.paper_code,
        s.department,
        s.year,
        s.credits,
        s.total_semester_hours,
        s.expected_hours_per_week,
        t1.id    AS teacher1_id,
        t1.name  AS teacher1_name,
        t1.email AS teacher1_email,
        t2.id    AS teacher2_id,
        t2.name  AS teacher2_name,
        t2.email AS teacher2_email
      FROM subjects s
      LEFT JOIN teachers t1 ON s.teacher1_id = t1.id
      LEFT JOIN teachers t2 ON s.teacher2_id = t2.id
      ORDER BY s.department, s.year, s.name
    `);

    // 2. Fetch all modules joined with their assigned teacher's name
    const [modules] = await pool.execute(`
      SELECT
        sm.id,
        sm.subject_id,
        sm.module_number,
        sm.module_name,
        sm.module_hours,
        sm.assigned_teacher_id,
        t.name AS teacher_name
      FROM subject_modules sm
      LEFT JOIN teachers t ON sm.assigned_teacher_id = t.id
      ORDER BY sm.subject_id, sm.module_number
    `);

    // 3. Group modules by subject_id
    /** @type {Map<number, object[]>} */
    const modulesBySubject = new Map();
    for (const mod of modules) {
      if (!modulesBySubject.has(mod.subject_id)) {
        modulesBySubject.set(mod.subject_id, []);
      }
      modulesBySubject.get(mod.subject_id).push(mod);
    }

    // 4. Attach module arrays to subjects
    const result = subjects.map((s) => ({
      ...s,
      modules: modulesBySubject.get(s.id) ?? [],
    }));

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// ─── GET /subjects/full ───────────────────────────────────────────────────────
// Returns subjects with nested modules + per-module teacher name.
// Used by the print page (legend) and analytics dashboard.
// Query params: department, year (both optional)

router.get('/subjects/full', async (req, res, next) => {
  try {
    const { department = null, year = null } = req.query;
    const data = await getSubjectsWithModules(department, year);
    return res.json(data);
  } catch (err) {
    return next(err);
  }
});

export default router;
