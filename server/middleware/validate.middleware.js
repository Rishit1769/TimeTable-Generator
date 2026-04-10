/**
 * validate.middleware.js  —  Weekly Target Middleware
 *
 * Called after the CSV has been parsed and the module audit has passed.
 *
 * Responsibilities:
 *  1. Verify that expected_hours_per_week is a positive integer ≥ 1 for
 *     every subject row.
 *  2. Attach computed WeeklyTarget[] to req.weeklyTargets so that the
 *     route handler can include it in the success response.
 *
 * Usage in a route:
 *   router.post('/upload', upload.single('file'), validateWeeklyTargets, handler);
 *   — or inline as done in upload.routes.js —
 */

import { computeWeeklyTargets } from '../services/weekly.target.service.js';

/**
 * Express middleware.
 * Expects req.parsedData (ParsedRow[]) to be populated by the route handler
 * before this middleware runs.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function validateWeeklyTargets(req, res, next) {
  const parsedData = req.parsedData ?? [];

  const invalidRows = parsedData.filter(({ subject }) => {
    const v = subject.expected_hours_per_week;
    return !Number.isInteger(v) || v < 1;
  });

  if (invalidRows.length > 0) {
    return res.status(400).json({
      success: false,
      message:  'Invalid "Expected Hours/Week" value(s) detected.',
      errors: invalidRows.map(({ subject }) => ({
        subject_code:             subject.code,
        subject_name:             subject.name,
        expected_hours_per_week:  subject.expected_hours_per_week,
        error:                    'Expected Hours/Week must be a positive integer ≥ 1.',
      })),
    });
  }

  req.weeklyTargets = computeWeeklyTargets(parsedData);
  next();
}
