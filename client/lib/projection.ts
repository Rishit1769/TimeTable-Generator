/**
 * projection.ts
 *
 * Client-side TypeScript mirror of server/services/export/projection.service.js.
 * Pure functions — no side effects, no API calls.
 *
 * Used by the analytics page to recalculate projections in the browser
 * whenever the semester start date changes, without another round-trip.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SubjectModule {
  id:                    number;
  module_number:         number;
  module_name:           string;
  module_hours:          number;
  assigned_teacher_name: string | null;
}

export interface SubjectForProjection {
  id:                      number;
  subject_code:            string;
  subject_name:            string;
  paper_code:              string;
  expected_hours_per_week: number;
  total_semester_hours:    number;
  teacher1_name:           string | null;
  teacher2_name:           string | null;
  modules:                 SubjectModule[];
}

export interface ModuleProjection {
  module_id:       number;
  module_number:   number;
  module_name:     string;
  module_hours:    number;
  assigned_teacher: string | null;
  start_date:      string; // ISO YYYY-MM-DD
  completion_date: string; // ISO YYYY-MM-DD
  weeks_required:  number;
  remaining_hours: number;
}

export interface SubjectProjection {
  subject_id:               number;
  subject_code:             string;
  subject_name:             string;
  total_semester_hours:     number;
  expected_hours_per_week:  number;
  semester_completion_date: string | null;
  total_weeks_required:     number;
  modules:                  ModuleProjection[];
}

// ─── calculateModuleCompletion ────────────────────────────────────────────────

export function calculateModuleCompletion(params: {
  startDate:      Date;
  moduleHours:    number;
  completedHours: number;
  hoursPerWeek:   number;
}): { completionDate: Date; weeksRequired: number; remainingHours: number } {
  const { startDate, moduleHours, completedHours, hoursPerWeek } = params;
  const remainingHours = moduleHours - completedHours;

  if (remainingHours <= 0) {
    return { completionDate: new Date(startDate), weeksRequired: 0, remainingHours: 0 };
  }

  const weeksRequired  = Math.ceil(remainingHours / hoursPerWeek);
  const completionDate = new Date(startDate);
  completionDate.setDate(completionDate.getDate() + weeksRequired * 7);

  return { completionDate, weeksRequired, remainingHours };
}

// ─── calculateSyllabusProjections ────────────────────────────────────────────

export function calculateSyllabusProjections(
  subjects: SubjectForProjection[],
  semesterStartDate: Date,
): SubjectProjection[] {
  return subjects.map((subject) => {
    let runningDate = new Date(semesterStartDate);
    const moduleProjections: ModuleProjection[] = [];

    const sortedModules = [...subject.modules].sort(
      (a, b) => a.module_number - b.module_number,
    );

    for (const mod of sortedModules) {
      const { completionDate, weeksRequired, remainingHours } = calculateModuleCompletion({
        startDate:      runningDate,
        moduleHours:    mod.module_hours,
        completedHours: 0,
        hoursPerWeek:   subject.expected_hours_per_week,
      });

      moduleProjections.push({
        module_id:        mod.id,
        module_number:    mod.module_number,
        module_name:      mod.module_name,
        module_hours:     mod.module_hours,
        assigned_teacher: mod.assigned_teacher_name,
        start_date:       runningDate.toISOString().split('T')[0],
        completion_date:  completionDate.toISOString().split('T')[0],
        weeks_required:   weeksRequired,
        remaining_hours:  remainingHours,
      });

      runningDate = new Date(completionDate);
      runningDate.setDate(runningDate.getDate() + 1);
    }

    const subjectCompletionDate = moduleProjections.at(-1)?.completion_date ?? null;
    const totalWeeks = moduleProjections.reduce((sum, m) => sum + m.weeks_required, 0);

    return {
      subject_id:               subject.id,
      subject_code:             subject.subject_code,
      subject_name:             subject.subject_name,
      total_semester_hours:     subject.total_semester_hours,
      expected_hours_per_week:  subject.expected_hours_per_week,
      semester_completion_date: subjectCompletionDate,
      total_weeks_required:     totalWeeks,
      modules:                  moduleProjections,
    };
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Returns the deadline colour class for a subject's completion date.
 *
 * @param completionDate  ISO date string
 * @param semesterEndDate ISO date string
 */
export function completionDateColor(
  completionDate: string | null,
  semesterEndDate: string,
): 'green' | 'amber' | 'red' {
  if (!completionDate) return 'red';
  const end   = new Date(semesterEndDate).getTime();
  const compl = new Date(completionDate).getTime();
  const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;

  if (compl <= end - twoWeeksMs) return 'green';
  if (compl <= end)              return 'amber';
  return 'red';
}
