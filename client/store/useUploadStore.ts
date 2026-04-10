/**
 * useUploadStore.ts — Zustand store for upload state management.
 *
 * State flows:
 *   idle → uploading → success  (navigate to /subjects)
 *   idle → uploading → error    (render ErrorReport)
 */

import { create } from 'zustand';
import type { UploadError, Subject } from '@/lib/api';

export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

interface UploadState {
  // ── State ──────────────────────────────────────────────────────────────────
  uploadStatus:  UploadStatus;
  errorReport:   UploadError[];
  subjects:      Subject[];
  lastSessionId: number | null;

  // ── Actions ────────────────────────────────────────────────────────────────
  setUploadStatus:  (status: UploadStatus)   => void;
  setErrorReport:   (errors: UploadError[])  => void;
  setSubjects:      (subjects: Subject[])    => void;
  setLastSessionId: (id: number | null)      => void;
  reset:            ()                       => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  uploadStatus:  'idle',
  errorReport:   [],
  subjects:      [],
  lastSessionId: null,

  setUploadStatus:  (status)   => set({ uploadStatus: status }),
  setErrorReport:   (errors)   => set({ errorReport: errors }),
  setSubjects:      (subjects) => set({ subjects }),
  setLastSessionId: (id)       => set({ lastSessionId: id }),
  reset:            ()         => set({ uploadStatus: 'idle', errorReport: [], lastSessionId: null }),
}));
