/**
 * grid.builder.js
 *
 * Transforms the in-memory grid produced by the backtracker into two
 * output formats consumed by the API and (in Phase 4) the CSV exporter:
 *
 *   grid2D  — Nested JSON keyed by day → timeSlot → slot detail(s).
 *             Matches the frontend's rendering model exactly.
 *
 *   grid1D  — Flat array of one object per timetable entry.
 *             Suitable for CSV export and bulk DB insert.
 *
 * A subject/teacher lookup map must be provided so the builder can enrich
 * stored IDs with human-readable names without issuing additional DB queries.
 */

/**
 * @typedef {Object} SubjectMapEntry
 * @property {number}      subject_id
 * @property {string}      subject_name
 * @property {string}      subject_code
 * @property {string}      year
 * @property {string}      department
 * @property {number|null} teacher1_id
 * @property {string|null} teacher1_name
 * @property {number|null} teacher2_id
 * @property {string|null} teacher2_name
 * @property {Array<{id:number, module_number:number, module_name:string, module_hours:number}>} modules
 */

/**
 * @typedef {Object<number, SubjectMapEntry>} SubjectMap
 */

/**
 * @typedef {Object<number, {id:number, name:string, email:string}>} TeacherMap
 */

/**
 * @typedef {Object} SlotDetail
 * @property {number}      subject_id
 * @property {string}      subject_code
 * @property {string}      subject_name
 * @property {number|null} teacher_id
 * @property {string|null} teacher_name
 * @property {number|null} module_id
 * @property {number|null} module_number
 * @property {string|null} module_name
 * @property {string}      year
 * @property {string}      department
 * @property {string|null} room
 */

// ─── Lookup helpers ───────────────────────────────────────────────────────────

/**
 * Enriches a raw grid entry (stored IDs) with display names.
 *
 * @param {import('./slot.service.js').OccupiedSlot} entry
 * @param {SubjectMap} subjectMap
 * @param {TeacherMap} teacherMap
 * @returns {SlotDetail}
 */
function enrichEntry(entry, subjectMap, teacherMap) {
  const subject = subjectMap[entry.subject_id] ?? {};
  const teacher = entry.teacher_id != null ? (teacherMap[entry.teacher_id] ?? {}) : {};
  const module  = subject.modules?.find((m) => m.id === entry.module_id) ?? null;

  return {
    subject_id:    entry.subject_id,
    subject_code:  entry.subject_code  ?? subject.subject_code  ?? null,
    subject_name:  subject.subject_name ?? subject.name         ?? null,
    teacher_id:    entry.teacher_id    ?? null,
    teacher_name:  teacher.name        ?? teacher.teacher1_name ?? null,
    module_id:     entry.module_id     ?? null,
    module_number: entry.module_number ?? module?.module_number ?? null,
    module_name:   module?.module_name ?? null,
    year:          entry.year,
    department:    entry.department,
    room:          entry.room ?? null,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Converts the backtracker's in-memory grid into the final JSON shapes used
 * by the API response and the DB persist layer.
 *
 * @param {import('./slot.service.js').Grid} grid
 * @param {SubjectMap} subjectMap
 * @param {TeacherMap} teacherMap
 * @returns {{
 *   grid2D: Object,
 *   grid1D: Object[],
 *   meta:   { generated_at: string, total_subjects_scheduled: number, incomplete: boolean, unscheduled: string[] }
 * }}
 */
export function buildGridJSON(grid, subjectMap, teacherMap) {
  const grid2D = {};
  const grid1D = [];
  const scheduledSubjectIds = new Set();

  for (const day of Object.keys(grid)) {
    grid2D[day] = {};

    for (const timeSlot of Object.keys(grid[day])) {
      const entries = grid[day][timeSlot];

      if (!entries || entries.length === 0) {
        grid2D[day][timeSlot] = null;
        continue;
      }

      const enriched = entries.map((e) => enrichEntry(e, subjectMap, teacherMap));

      // Expose a single object when there's only one entry (common case),
      // or an array when multiple cohorts share the same time-slot.
      grid2D[day][timeSlot] = enriched.length === 1 ? enriched[0] : enriched;

      // Build 1D flat list
      for (const detail of enriched) {
        scheduledSubjectIds.add(detail.subject_id);
        grid1D.push({ day, time_slot: timeSlot, ...detail });
      }
    }
  }

  return {
    grid2D,
    grid1D,
    meta: {
      generated_at:              new Date().toISOString(),
      total_subjects_scheduled:  scheduledSubjectIds.size,
      incomplete:                false,  // caller overrides this
      unscheduled:               [],     // caller overrides this
    },
  };
}

// ─── Map builders (called by scheduler/index.js) ─────────────────────────────

/**
 * Builds a subject lookup map from the weighted-subject array returned by
 * getSortedSubjects().  Modules are attached separately if provided.
 *
 * @param {import('./weightage.service.js').WeightedSubject[]} subjects
 * @returns {SubjectMap}
 */
export function buildSubjectMap(subjects) {
  const map = {};
  for (const s of subjects) {
    map[s.subject_id] = {
      ...s,
      subject_name: s.subject_name,
      modules:      s.modules ?? [],
    };
  }
  return map;
}

/**
 * Builds a teacher lookup map keyed by teacher ID, extracting both teacher
 * slots from each weighted subject row.
 *
 * @param {import('./weightage.service.js').WeightedSubject[]} subjects
 * @returns {TeacherMap}
 */
export function buildTeacherMap(subjects) {
  const map = {};
  for (const s of subjects) {
    if (s.teacher1_id != null) {
      map[s.teacher1_id] = { id: s.teacher1_id, name: s.teacher1_name, email: s.teacher1_email };
    }
    if (s.teacher2_id != null) {
      map[s.teacher2_id] = { id: s.teacher2_id, name: s.teacher2_name, email: s.teacher2_email };
    }
  }
  return map;
}
