/**
 * upload.routes.js
 *
 * Mounts on /api (see app.js).
 *
 * Routes:
 *   POST /upload          — Accept a CSV, audit it, commit or reject.
 *   GET  /upload-sessions — Return the full upload-audit history.
 *
 * Orchestration flow for POST /upload:
 *   multer → parseAndTransform → auditModules
 *     ↳ fail  → persist error_report, return 400
 *     ↳ pass  → validateWeeklyTargets middleware
 *                 ↳ fail  → return 400
 *                 ↳ pass  → commitSubjectData → mark validated → return 200
 */

import express                        from 'express';
import multer                         from 'multer';
import pool                           from '../db/connection.js';
import { parseAndTransform,
         commitSubjectData }          from '../services/csv.parser.service.js';
import { auditModules }               from '../services/module.audit.service.js';
import { validateWeeklyTargets }      from '../middleware/validate.middleware.js';

const router = express.Router();

// ─── Multer setup ────────────────────────────────────────────────────────────

const fileFilter = (_req, file, cb) => {
  const isCsv =
    file.mimetype === 'text/csv' ||
    file.mimetype === 'application/vnd.ms-excel' ||
    file.originalname.toLowerCase().endsWith('.csv');
  isCsv
    ? cb(null, true)
    : cb(new Error('Only .csv files are accepted.'), false);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB hard limit
});

// ─── POST /api/upload ────────────────────────────────────────────────────────

router.post(
  '/upload',
  upload.single('file'),
  async (req, res, next) => {
    // 1. Guard: file must be present
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No CSV file provided. Include a file field named "file".',
      });
    }

    // 2. Create a pending upload_session (audit trail)
    let sessionId;
    try {
      const [result] = await pool.execute(
        'INSERT INTO upload_sessions (filename, status) VALUES (?, ?)',
        [req.file.originalname, 'pending'],
      );
      sessionId = result.insertId;
    } catch (dbErr) {
      return next(dbErr);
    }

    try {
      // 3. Parse CSV buffer → structured ParsedRow[]
      const parsedData = await parseAndTransform(req.file.buffer);

      if (parsedData.length === 0) {
        await pool.execute(
          'UPDATE upload_sessions SET status = ?, error_report = ? WHERE id = ?',
          ['failed', JSON.stringify([{ error: 'CSV file contains no data rows.' }]), sessionId],
        );
        return res.status(400).json({
          success:   false,
          session_id: sessionId,
          message:   'CSV file contains no data rows.',
        });
      }

      // 4. Module audit
      const auditErrors = auditModules(parsedData);

      if (auditErrors.length > 0) {
        await pool.execute(
          'UPDATE upload_sessions SET status = ?, error_report = ? WHERE id = ?',
          ['failed', JSON.stringify(auditErrors), sessionId],
        );
        return res.status(400).json({
          success:      false,
          session_id:   sessionId,
          message:      `${auditErrors.length} subject(s) failed module-hour validation. Fix your CSV and re-upload.`,
          error_report: auditErrors,
        });
      }

      // 5. Weekly-target validation via middleware (inline invocation)
      req.parsedData = parsedData;

      await new Promise((resolve, reject) => {
        validateWeeklyTargets(req, res, (err) => {
          if (err) return reject(err);
          // If res was already sent by middleware (validation error), reject silently
          if (res.headersSent) return reject(new Error('__HEADERS_SENT__'));
          resolve();
        });
      }).catch((err) => {
        if (err.message !== '__HEADERS_SENT__') throw err;
      });

      if (res.headersSent) return; // middleware already responded with 400

      // 6. Commit data to DB
      await commitSubjectData(parsedData);

      // 7. Mark session as validated
      await pool.execute(
        'UPDATE upload_sessions SET status = ? WHERE id = ?',
        ['validated', sessionId],
      );

      // 8. Return success with weekly-target constraints
      return res.status(200).json({
        success:           true,
        session_id:        sessionId,
        subjects_imported: parsedData.length,
        weekly_targets:    req.weeklyTargets,
      });
    } catch (err) {
      // Attempt to mark session as failed on unexpected errors
      try {
        await pool.execute(
          'UPDATE upload_sessions SET status = ?, error_report = ? WHERE id = ?',
          ['failed', JSON.stringify([{ error: err.message }]), sessionId],
        );
      } catch (_) { /* best-effort */ }
      return next(err);
    }
  },
);

// ─── GET /api/upload-sessions ────────────────────────────────────────────────

router.get('/upload-sessions', async (_req, res, next) => {
  try {
    const [sessions] = await pool.execute(
      'SELECT * FROM upload_sessions ORDER BY uploaded_at DESC',
    );

    // mysql2 auto-parses JSON columns; guard in case the column is returned as string
    const result = sessions.map((s) => ({
      ...s,
      error_report:
        typeof s.error_report === 'string'
          ? JSON.parse(s.error_report)
          : s.error_report,
    }));

    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

export default router;
