/**
 * app.js — Smart Timetable Architect API server
 *
 * Base URL: http://localhost:4000
 *
 * Endpoints:
 *   POST /api/upload           — ingest & validate CSV
 *   GET  /api/upload-sessions  — upload audit log
 *   GET  /api/subjects         — all subjects with modules & teachers
 */

import express  from 'express';
import cors     from 'cors';
import dotenv   from 'dotenv';

import uploadRouter   from './routes/upload.routes.js';
import subjectsRouter from './routes/subjects.routes.js';

dotenv.config();

const app  = express();
const PORT = Number(process.env.PORT) || 4000;

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
