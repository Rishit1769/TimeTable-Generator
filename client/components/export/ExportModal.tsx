/**
 * ExportModal.tsx
 *
 * Export options modal — PDF or CSV download.
 *
 * PDF:  POST /api/export/pdf  → receive blob → auto-trigger download
 * CSV:  GET  /api/export/csv  → same blob pattern
 *
 * Shows a spinner + "Generating PDF… this may take 5–10 seconds" while
 * Puppeteer runs.
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGridStore } from '@/store/useGridStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:4000';

interface ExportModalProps {
  onClose: () => void;
}

type Format    = 'pdf' | 'csv';
type ColorScheme = 'dark' | 'light';

export default function ExportModal({ onClose }: ExportModalProps) {
  const activeFilters = useGridStore((s) => s.activeFilters);

  const [format,        setFormat]        = useState<Format>('pdf');
  const [semester,      setSemester]      = useState('Semester V');
  const [includeLegend, setIncludeLegend] = useState(true);
  const [colorScheme,   setColorScheme]   = useState<ColorScheme>('dark');
  const [isLoading,     setIsLoading]     = useState(false);
  const [error,         setError]         = useState<string | null>(null);

  const department = activeFilters.department ?? 'CS';
  const year       = activeFilters.year        ?? 'TY';

  const backdropRef = useRef<HTMLDivElement>(null);

  // ── Close on Escape ───────────────────────────────────────────────────────
  useEffect(() => {
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose]);

  // ── Close on backdrop click ───────────────────────────────────────────────
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === backdropRef.current) onClose();
  };

  // ── PDF download ──────────────────────────────────────────────────────────
  async function handlePDFDownload() {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/export/pdf`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department, year, semester, includeLegend, colorScheme }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error ?? `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      triggerDownload(blob, `Timetable_${department}_${year}.pdf`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF generation failed');
    } finally {
      setIsLoading(false);
    }
  }

  // ── CSV download ──────────────────────────────────────────────────────────
  async function handleCSVDownload() {
    setError(null);
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ department, year });
      const res = await fetch(`${API_BASE}/api/export/csv?${params}`);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      triggerDownload(blob, `Timetable_${department}_${year}.csv`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed');
    } finally {
      setIsLoading(false);
    }
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleDownload = () => (format === 'pdf' ? handlePDFDownload() : handleCSVDownload());

  // ─────────────────────────────────────────────────────────────────────────

  const modal = (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="w-80 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Export Timetable</h2>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Format toggle */}
        <div className="mb-5">
          <p className="mb-2 text-xs font-medium text-zinc-400">Format</p>
          <div className="flex gap-3">
            {(['pdf', 'csv'] as Format[]).map((f) => (
              <label key={f} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-300">
                <input
                  type="radio"
                  name="format"
                  value={f}
                  checked={format === f}
                  onChange={() => setFormat(f)}
                  className="accent-indigo-500"
                />
                {f.toUpperCase()}
              </label>
            ))}
          </div>
        </div>

        {/* PDF options */}
        {format === 'pdf' && (
          <div className="mb-5 space-y-3 border-t border-zinc-800 pt-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
              PDF Options
            </p>

            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Semester Label
              <input
                type="text"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                className="rounded bg-zinc-800 px-2 py-1.5 text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-300">
              <input
                type="checkbox"
                checked={includeLegend}
                onChange={(e) => setIncludeLegend(e.target.checked)}
                className="accent-indigo-500"
              />
              Include Teacher–Module Legend
            </label>

            <label className="flex flex-col gap-1 text-xs text-zinc-400">
              Colour Scheme
              <select
                value={colorScheme}
                onChange={(e) => setColorScheme(e.target.value as ColorScheme)}
                className="rounded bg-zinc-800 px-2 py-1.5 text-zinc-100 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </label>
          </div>
        )}

        {format === 'csv' && (
          <p className="mb-5 text-xs text-zinc-500 border-t border-zinc-800 pt-4">
            All columns included: Day, Time, Subject, Code, Paper Code, Year,
            Dept, Credits, Teacher, Email, Module No., Module Name, Module Hours.
          </p>
        )}

        {/* Error */}
        {error && (
          <p className="mb-3 rounded bg-red-950/40 px-3 py-2 text-xs text-red-400">
            {error}
          </p>
        )}

        {/* Loading hint */}
        {isLoading && format === 'pdf' && (
          <p className="mb-3 text-center text-xs text-zinc-400 animate-pulse">
            Generating PDF… this may take 5–10 seconds
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? (
              <>
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Working…
              </>
            ) : (
              <>⬇ Download</>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
