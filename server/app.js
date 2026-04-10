/**
 * app.js — Smart Timetable Architect API server
 *
 * Base URL: http://localhost:4000
 *
 * Endpoints:
 *   POST /api/upload              — ingest & validate CSV
 *   GET  /api/upload-sessions     — upload audit log
 *   GET  /api/subjects            — all subjects with modules & teachers
 *   GET  /api/subjects/full       — subjects + per-module teacher names
 *   POST /api/generate            — run timetable generation (Phase 2)
 *   GET  /api/grid                — retrieve persisted timetable grid
 *   GET  /api/teacher-hours/:id   — teacher weekly workload
 *   POST /api/conflict-check      — real-time conflict check during drag
 *   POST /api/grid/swap           — persist a manual slot swap
 *   GET  /api/teachers/workload   — all teachers with slot counts
 *   POST /api/export/pdf          — Puppeteer PDF generation (Phase 4)
 *   GET  /api/export/csv          — flat CSV download (Phase 4)
 *   GET  /api/export/projections  — syllabus completion projections (Phase 4)
 */

import express  from 'express';
import cors     from 'cors';
import dotenv   from 'dotenv';

import uploadRouter     from './routes/upload.routes.js';
import subjectsRouter   from './routes/subjects.routes.js';
import generateRouter   from './routes/generate.routes.js';
import gridEditorRouter from './routes/grid.editor.routes.js';
import exportRouter     from './routes/export.routes.js';
import pool             from './db/connection.js';

dotenv.config();

const app  = express();
const PORT = Number(process.env.PORT) || 4000;

// Expose the connection pool to routes via app.locals (used by csv.export.service)
app.locals.db = pool;

// ─── Global middleware ────────────────────────────────────────────────────────

app.use(
  cors({
    origin:  process.env.CLIENT_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  }),
);

app.use(express.json());

// ─── Routes ───────────────────────────────────────────────────────────────────

// uploadRouter handles:  POST /api/upload  and  GET /api/upload-sessions
app.use('/api', uploadRouter);

// subjectsRouter handles:  GET /api/subjects
app.use('/api', subjectsRouter);

// generateRouter handles:  POST /api/generate, GET /api/grid, GET /api/teacher-hours/:id
app.use('/api', generateRouter);

// gridEditorRouter handles: POST /api/conflict-check, POST /api/grid/swap, GET /api/teachers/workload
app.use('/api', gridEditorRouter);

// exportRouter handles: POST /api/export/pdf, GET /api/export/csv, GET /api/export/projections
app.use('/api', exportRouter);

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Global error handler ─────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  const status = err.status ?? 500;
  res.status(status).json({
    success: false,
    message: status === 500 ? 'Internal server error.' : err.message,
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀  Timetable API running at http://localhost:${PORT}`);
});
