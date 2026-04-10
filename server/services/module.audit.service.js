/**
 * module.audit.service.js
 *
 * Validates that Σ(module_hours) === total_semester_hours for every subject.
 * Returns a structured error_report[] array.
 *
 * The upload route MUST NOT call commitSubjectData() if errors.length > 0.
 */

/**
 * @typedef {Object} ModuleAuditError
 * @property {string} subject_code
 * @property {string} subject_name
 * @property {number} expected_total     – value from CSV "Total Semester Hours"
 * @property {number} calculated_total   – Σ(module_hours)
 * @property {number} delta              – calculated_total - expected_total  (<0 = missing, >0 = excess)
 * @property {string} error              – human-readable message
 */

/**
 * Audits module-hour totals for every parsed row.
 *
 * @param {import('./csv.parser.service.js').ParsedRow[]} parsedRows
 * @returns {ModuleAuditError[]}   Empty array means all rows are valid.
 */
export function auditModules(parsedRows) {
  const errors = [];

  for (const row of parsedRows) {
    const { subject, modules } = row;

    const calculatedTotal = modules.reduce((sum, m) => sum + m.module_hours, 0);
    const expectedTotal   = subject.total_semester_hours;

    if (calculatedTotal !== expectedTotal) {
      const delta = calculatedTotal - expectedTotal;

      const detail =
        delta < 0
          ? `Missing ${Math.abs(delta)} hour(s).`
          : `Excess ${delta} hour(s).`;

      errors.push({
        subject_code:      subject.code,
        subject_name:      subject.name,
        expected_total:    expectedTotal,
        calculated_total:  calculatedTotal,
        delta,
        error: `Module hours sum (${calculatedTotal}) does not match Total Semester Hours (${expectedTotal}). ${detail}`,
      });
    }
  }

  return errors;
}
