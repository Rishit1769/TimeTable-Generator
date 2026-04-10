/**
 * api.ts — Typed fetch wrappers for the Timetable API.
 *
 * All functions return typed response objects.
 * Network errors are caught and normalised into UploadResponse shape
 * so callers never have to handle raw exceptions from uploadCSV().
 */

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

// ─── Shared types ────────────────────────────────────────────────────────────

export interface UploadError {
  subject_code:     string;
  subject_name:     string;
  expected_total:   number;
  calculated_total: number;
  delta:            number;
  error:            string;
}

export interface WeeklyTarget {
  subject_code:        string;
  subject_name:        string;
  year:                string;
  department:          string;
  weekly_slots_needed: number;
}

export interface UploadResponse {
  success:           boolean;
  session_id?:       number;
  subjects_imported?: number;
  weekly_targets?:   WeeklyTarget[];
  error_report?:     UploadError[];
  message?:          string;
}

export interface SubjectModule {
  id:                  number;
  subject_id:          number;
  module_number:       number;
  module_name:         string;
  module_hours:        number;
  assigned_teacher_id: number | null;
  teacher_name:        string | null;
}

export interface Subject {
  id:                      number;
  name:                    string;
  code:                    string;
  paper_code:              string;
  department:              string;
  year:                    string;
  credits:                 number;
  total_semester_hours:    number;
  expected_hours_per_week: number;
  teacher1_id:             number | null;
  teacher1_name:           string | null;
  teacher1_email:          string | null;
  teacher2_id:             number | null;
  teacher2_name:           string | null;
  teacher2_email:          string | null;
  modules:                 SubjectModule[];
}

export interface UploadSession {
  id:           number;
  uploaded_at:  string;
  filename:     string;
  status:       'pending' | 'validated' | 'failed';
  error_report: UploadError[] | null;
}

// ─── API calls ───────────────────────────────────────────────────────────────

/**
 * POST /api/upload
 * Sends the CSV as multipart/form-data.
 * Never throws — network failures are returned as a failed UploadResponse.
 */
export async function uploadCSV(file: File): Promise<UploadResponse> {
  try {
    const body = new FormData();
    body.append('file', file);

    const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body });
    return (await res.json()) as UploadResponse;
  } catch {
    return {
      success: false,
      message: 'Network error — ensure the API server is running.',
      error_report: [],
    };
  }
}

/**
 * GET /api/subjects
 * Returns all subjects with embedded module arrays.
 */
export async function getSubjects(): Promise<Subject[]> {
  const res = await fetch(`${API_BASE}/subjects`);
  if (!res.ok) throw new Error(`GET /subjects failed: ${res.status}`);
  return (await res.json()) as Subject[];
}

/**
 * GET /api/upload-sessions
 * Returns the upload audit log.
 */
export async function getUploadSessions(): Promise<UploadSession[]> {
  const res = await fetch(`${API_BASE}/upload-sessions`);
  if (!res.ok) throw new Error(`GET /upload-sessions failed: ${res.status}`);
  return (await res.json()) as UploadSession[];
}
