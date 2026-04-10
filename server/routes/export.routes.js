/**
 * export.routes.js
 *
 * Mounts on /api (see app.js).
 *
 * Routes:
 *   POST /api/export/pdf         — Puppeteer PDF generation
 *   GET  /api/export/csv         — Flat CSV download
 *   GET  /api/export/projections — Syllabus completion projections
 */

import express from 'express';
import { generateTimetablePDF }       from '../services/export/puppeteer.service.js';
import { exportGridAsCSV }            from '../services/export/csv.export.service.js';
import { calculateSyllabusProjections } from '../services/export/projection.service.js';
import { getSubjectsWithModules }     from '../db/grid.queries.js';

const router = express.Router();

// ─── POST /export/pdf ─────────────────────────────────────────────────────────

router.post('/export/pdf', async (req, res, next) => {
  const { department, year, semester } = req.body;

  if (!department || !year || !semester) {
    return res.status(400).json({
      error: 'department, year, and semester are required',
    });
  }

  try {
    const printUrl = (process.env.NEXT_APP_URL || 'http://localhost:3000') + '/print';

    const pdfBuffer = await generateTimetablePDF({ department, year, semester, printUrl });

    const safeSemester = semester.replace(/\s+/g, '_');
    const filename     = `Timetable_${department}_${year}_${safeSemester}.pdf`;

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length':      pdfBuffer.length,
    });

    return res.end(pdfBuffer, 'binary');
  } catch (err) {
    return next(err);
  }
});

// ─── GET /export/csv ──────────────────────────────────────────────────────────

router.get('/export/csv', async (req, res, next) => {
  const { department = null, year = null } = req.query;

  try {
    const csvContent = await exportGridAsCSV({
      department,
      year,
      db: req.app.locals.db,
    });

    const deptStr = department ?? 'ALL';
    const yearStr = year       ?? 'ALL';
    const filename = `Timetable_${deptStr}_${yearStr}.csv`;

    res.set({
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return res.send(csvContent);
  } catch (err) {
    return next(err);
  }
});

// ─── GET /export/projections ──────────────────────────────────────────────────

router.get('/export/projections', async (req, res, next) => {
  const { department = null, year = null, startDate } = req.query;

  if (!startDate) {
    return res.status(400).json({ error: 'startDate query param is required (YYYY-MM-DD)' });
  }

  const parsedStart = new Date(startDate);
  if (isNaN(parsedStart.getTime())) {
    return res.status(400).json({ error: 'startDate must be a valid ISO date (YYYY-MM-DD)' });
  }

  try {
    const subjects    = await getSubjectsWithModules(department, year);
    const projections = calculateSyllabusProjections(subjects, parsedStart);

    return res.json({ success: true, subjects, projections });
  } catch (err) {
    return next(err);
  }
});

export default router;
