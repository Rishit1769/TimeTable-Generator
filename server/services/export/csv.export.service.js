/**
 * csv.export.service.js
 *
 * Flattens the persisted 2D timetable grid (from master_grid DB table) into a
 * clean, fully-joined 1D CSV string.
 *
 * Depends on:  csv-writer  (npm install csv-writer)
 */

import { createObjectCsvStringifier } from 'csv-writer';

/**
 * @param {object} params
 * @param {string|null} params.department
 * @param {string|null} params.year
 * @param {import('mysql2/promise').Pool} params.db   — pool from app.locals.db
 * @returns {Promise<string>}  — CSV string ready to stream as text/csv
 */
export async function exportGridAsCSV({ department, year, db }) {
  const conditions = [];
  const params     = [];

  if (department) { conditions.push('mg.department = ?'); params.push(department); }
  if (year)       { conditions.push('mg.year = ?');       params.push(year); }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(' AND ')}`
    : '';

  const [rows] = await db.query(`
    SELECT
      mg.day,
      mg.time_slot,
      s.name        AS subject_name,
      s.code        AS subject_code,
      s.paper_code,
      mg.year,
      mg.department,
      s.credits,
      t.name        AS teacher_name,
      t.email       AS teacher_email,
      sm.module_number,
      sm.module_name,
      sm.module_hours
    FROM  master_grid mg
    JOIN  subjects       s  ON mg.subject_id = s.id
    JOIN  teachers       t  ON mg.teacher_id = t.id
    JOIN  subject_modules sm ON mg.module_id  = sm.id
    ${whereClause}
    ORDER BY
      FIELD(mg.day, 'MON','TUE','WED','THU','FRI','SAT'),
      mg.time_slot
  `, params);

  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: 'day',           title: 'Day'           },
      { id: 'time_slot',     title: 'Time Slot'     },
      { id: 'subject_name',  title: 'Subject Name'  },
      { id: 'subject_code',  title: 'Subject Code'  },
      { id: 'paper_code',    title: 'Paper Code'    },
      { id: 'year',          title: 'Year'          },
      { id: 'department',    title: 'Department'    },
      { id: 'credits',       title: 'Credits'       },
      { id: 'teacher_name',  title: 'Teacher'       },
      { id: 'teacher_email', title: 'Teacher Email' },
      { id: 'module_number', title: 'Module No.'    },
      { id: 'module_name',   title: 'Module Name'   },
      { id: 'module_hours',  title: 'Module Hours'  },
    ],
  });

  return csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(rows);
}
