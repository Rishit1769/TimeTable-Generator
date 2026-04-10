/**
 * csv.parser.service.js
 *
 * Responsibilities:
 *  1. Parse a raw CSV Buffer into plain Row objects using csv-parser.
 *  2. Transform each raw row into a strongly-typed ParsedRow structure.
 *  3. Commit validated ParsedRow data to MySQL inside a single transaction.
 *
 * NOTE: This service never decides whether to commit.
 *       The upload route calls auditModules() first, then commitSubjectData()
 *       only when there are zero audit errors.
 */

import csv from 'csv-parser';
import { Readable } from 'stream';
import pool from '../db/connection.js';

// ─── Types (JSDoc) ──────────────────────────────────────────────────────────

/**
 * @typedef {Object} ParsedModule
 * @property {number} module_number
 * @property {string} module_name
 * @property {number} module_hours
 */

/**
 * @typedef {Object} ParsedTeacher
 * @property {string} name
 * @property {string} email
 * @property {number[]} moduleNumbers  – 1-based module indices owned by this teacher
 */

/**
 * @typedef {Object} ParsedSubject
 * @property {string} name
 * @property {string} code
 * @property {string} paper_code
 * @property {string} department
 * @property {string} year
 * @property {number} credits
 * @property {number} total_semester_hours
 * @property {number} expected_hours_per_week
 */

/**
 * @typedef {Object} ParsedRow
 * @property {ParsedSubject}        subject
 * @property {ParsedTeacher|null}   teacher1
 * @property {ParsedTeacher|null}   teacher2
 * @property {ParsedModule[]}       modules
 */

// ─── 1. Parse CSV Buffer ────────────────────────────────────────────────────

/**
 * Converts a Buffer of CSV bytes into an array of raw key→value row objects.
 * Column headers are trimmed to avoid whitespace-mismatch issues.
 *
 * @param {Buffer} buffer
 * @returns {Promise<Record<string, string>[]>}
 */
export function parseCSVBuffer(buffer) {
  return new Promise((resolve, reject) => {
    const rows = [];

    const readable = new Readable({
      read() {
        this.push(buffer);
        this.push(null);
      },
    });

    readable
      .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

// ─── 2. Transform a raw CSV row ─────────────────────────────────────────────

/**
 * Converts a raw csv-parser row (all strings) into a typed ParsedRow.
 *
 * @param {Record<string, string>} row
 * @returns {ParsedRow}
 */
export function transformRow(row) {
  // Collect populated modules (up to 6)
  const modules = [];
  for (let i = 1; i <= 6; i++) {
    const name     = row[`Module${i} Name`]?.trim();
    const hoursRaw = row[`Module${i} Hours`]?.trim();
    if (name && hoursRaw) {
      const hours = parseInt(hoursRaw, 10);
      if (!isNaN(hours)) {
        modules.push({ module_number: i, module_name: name, module_hours: hours });
      }
    }
  }

  // Parse teacher module assignments (comma-separated 1-based indices)
  const parseModuleList = (raw) =>
    raw
      ? raw
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
      : [];

  const teacher1 =
    row['Teacher1 Name']?.trim()
      ? {
          name:          row['Teacher1 Name'].trim(),
          email:         row['Teacher1 Email']?.trim() ?? '',
          moduleNumbers: parseModuleList(row['Teacher1 Modules']),
        }
      : null;

  const teacher2 =
    row['Teacher2 Name']?.trim()
      ? {
          name:          row['Teacher2 Name'].trim(),
          email:         row['Teacher2 Email']?.trim() ?? '',
          moduleNumbers: parseModuleList(row['Teacher2 Modules']),
        }
      : null;

  return {
    subject: {
      name:                    row['Subject Name']?.trim()           ?? '',
      code:                    row['Subject Code']?.trim()           ?? '',
      paper_code:              row['Paper Code']?.trim()             ?? '',
      department:              row['Department']?.trim()             ?? '',
      year:                    row['Year']?.trim()                   ?? '',
      credits:                 parseInt(row['Credits'],                   10) || 0,
      total_semester_hours:    parseInt(row['Total Semester Hours'],       10) || 0,
      expected_hours_per_week: parseInt(row['Expected Hours/Week'],        10) || 0,
    },
    teacher1,
    teacher2,
    modules,
  };
}

/**
 * Convenience wrapper: parse buffer → transform every row.
 *
 * @param {Buffer} buffer
 * @returns {Promise<ParsedRow[]>}
 */
export async function parseAndTransform(buffer) {
  const raw = await parseCSVBuffer(buffer);
  return raw.map(transformRow);
}

// ─── 3. Commit to Database ──────────────────────────────────────────────────

/**
 * Upserts teachers, subjects, and subject_modules within one transaction.
 * Call this ONLY after auditModules() returns zero errors.
 *
 * @param {ParsedRow[]} parsedRows
 * @returns {Promise<void>}
 */
export async function commitSubjectData(parsedRows) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const row of parsedRows) {
      const { subject, teacher1, teacher2, modules } = row;

      // 3a. Upsert teacher1
      let teacher1Id = null;
      if (teacher1) {
        await conn.execute(
          `INSERT INTO teachers (name, email, department)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name       = VALUES(name),
             department = VALUES(department)`,
          [teacher1.name, teacher1.email, subject.department],
        );
        const [[t1]] = await conn.execute(
          'SELECT id FROM teachers WHERE email = ?',
          [teacher1.email],
        );
        teacher1Id = t1.id;
      }

      // 3b. Upsert teacher2
      let teacher2Id = null;
      if (teacher2) {
        await conn.execute(
          `INSERT INTO teachers (name, email, department)
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name       = VALUES(name),
             department = VALUES(department)`,
          [teacher2.name, teacher2.email, subject.department],
        );
        const [[t2]] = await conn.execute(
          'SELECT id FROM teachers WHERE email = ?',
          [teacher2.email],
        );
        teacher2Id = t2.id;
      }

      // 3c. Upsert subject
      await conn.execute(
        `INSERT INTO subjects
           (name, code, paper_code, department, year, credits,
            total_semester_hours, expected_hours_per_week, teacher1_id, teacher2_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           name                    = VALUES(name),
           paper_code              = VALUES(paper_code),
           department              = VALUES(department),
           year                    = VALUES(year),
           credits                 = VALUES(credits),
           total_semester_hours    = VALUES(total_semester_hours),
           expected_hours_per_week = VALUES(expected_hours_per_week),
           teacher1_id             = VALUES(teacher1_id),
           teacher2_id             = VALUES(teacher2_id)`,
        [
          subject.name,
          subject.code,
          subject.paper_code,
          subject.department,
          subject.year,
          subject.credits,
          subject.total_semester_hours,
          subject.expected_hours_per_week,
          teacher1Id,
          teacher2Id,
        ],
      );

      const [[{ id: subjectId }]] = await conn.execute(
        'SELECT id FROM subjects WHERE code = ?',
        [subject.code],
      );

      // 3d. Delete stale modules then re-insert (clean idempotent re-upload)
      await conn.execute('DELETE FROM subject_modules WHERE subject_id = ?', [subjectId]);

      // 3e. Insert modules with correct assigned_teacher_id
      const teacher1Modules = new Set(teacher1?.moduleNumbers ?? []);
      const teacher2Modules = new Set(teacher2?.moduleNumbers ?? []);

      for (const mod of modules) {
        let assignedTeacherId = null;
        if (teacher1Modules.has(mod.module_number))      assignedTeacherId = teacher1Id;
        else if (teacher2Modules.has(mod.module_number)) assignedTeacherId = teacher2Id;

        await conn.execute(
          `INSERT INTO subject_modules
             (subject_id, module_number, module_name, module_hours, assigned_teacher_id)
           VALUES (?, ?, ?, ?, ?)`,
          [subjectId, mod.module_number, mod.module_name, mod.module_hours, assignedTeacherId],
        );
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
