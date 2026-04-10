/**
 * projection.service.js
 *
 * Pure, side-effect-free functions for syllabus completion projection.
 *
 * Formula:
 *   weeksRequired = ceil(remainingHours / hoursPerWeek)
 *   completionDate = startDate + weeksRequired * 7 days
 *
 * Modules are chained sequentially — Module 2 begins the day after Module 1
 * completes.
 */

/**
 * Calculates when a single module will be completed.
 *
 * @param {object} params
 * @param {Date}   params.startDate
 * @param {number} params.moduleHours
 * @param {number} params.completedHours  — hours already delivered (default 0)
 * @param {number} params.hoursPerWeek
 * @returns {{ completionDate: Date, weeksRequired: number, remainingHours: number }}
 */
export function calculateModuleCompletion({ startDate, moduleHours, completedHours = 0, hoursPerWeek }) {
  const remainingHours = moduleHours - completedHours;

  if (remainingHours <= 0) {
    return { completionDate: new Date(startDate), weeksRequired: 0, remainingHours: 0 };
  }

  const weeksRequired = Math.ceil(remainingHours / hoursPerWeek);
  const completionDate = new Date(startDate);
  completionDate.setDate(completionDate.getDate() + weeksRequired * 7);

  return { completionDate, weeksRequired, remainingHours };
}

/**
 * Calculates projections for all modules of all subjects.
 * Modules within a subject are chained sequentially.
 *
 * @param {Array<{
 *   id: number, subject_code: string, subject_name: string,
 *   expected_hours_per_week: number, total_semester_hours: number,
 *   modules: Array<{id:number, module_number:number, module_name:string,
 *                   module_hours:number, assigned_teacher_name:string|null}>
 * }>} subjects
 * @param {Date} semesterStartDate
 * @returns {Array<SubjectProjection>}
 */
export function calculateSyllabusProjections(subjects, semesterStartDate) {
  return subjects.map((subject) => {
    let runningDate = new Date(semesterStartDate);
    const moduleProjections = [];

    // Ensure sequential order by module_number
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
        assigned_teacher: mod.assigned_teacher_name ?? null,
        start_date:       runningDate.toISOString().split('T')[0],
        completion_date:  completionDate.toISOString().split('T')[0],
        weeks_required:   weeksRequired,
        remaining_hours:  remainingHours,
      });

      // Next module starts the day after this one completes
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
