'use client';

import { useState, useRef, type DragEvent, type ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { uploadCSV }       from '@/lib/api';
import { useUploadStore }  from '@/store/useUploadStore';
import ErrorReport         from '@/components/ErrorReport';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024)             return `${bytes} B`;
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UploadZone() {
  const router = useRouter();

  const [isDragging,   setIsDragging]   = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading,  setIsUploading]  = useState(false);
  const [uploadDone,   setUploadDone]   = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { errorReport, setErrorReport, setUploadStatus, setLastSessionId } =
    useUploadStore();

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file?.name.toLowerCase().endsWith('.csv')) {
      setSelectedFile(file);
      setErrorReport([]);
      setUploadDone(false);
    }
  };

  // ── File-input handler ─────────────────────────────────────────────────────

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setErrorReport([]);
      setUploadDone(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadDone(false);
    setErrorReport([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Upload handler ─────────────────────────────────────────────────────────

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadStatus('uploading');
    setErrorReport([]);

    const result = await uploadCSV(selectedFile);

    setIsUploading(false);

    if (result.success) {
      setUploadStatus('success');
      setUploadDone(true);
      if (result.session_id != null) setLastSessionId(result.session_id);
      setTimeout(() => router.push('/subjects'), 1400);
    } else {
      setUploadStatus('error');
      setErrorReport(result.error_report ?? []);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !selectedFile && fileInputRef.current?.click()}
        className={[
          'relative rounded-xl border-2 border-dashed p-12 text-center transition-all duration-200',
          isDragging
            ? 'border-blue-400 bg-blue-950/30'
            : 'border-zinc-700 bg-zinc-900/40 hover:border-zinc-500',
          !selectedFile ? 'cursor-pointer' : 'cursor-default',
        ].join(' ')}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileChange}
        />

        {!selectedFile ? (
          <div className="space-y-3">
            <div className="text-5xl select-none">📋</div>
            <p className="text-lg font-medium text-zinc-300">
              Drag &amp; drop your CSV file here
            </p>
            <p className="text-sm text-zinc-500">
              or{' '}
              <span className="text-blue-400 hover:underline">click to browse</span>
            </p>
            <p className="mt-2 text-xs text-zinc-600">Accepts .csv files · max 10 MB</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-4xl select-none">📄</div>
            <p className="font-semibold text-zinc-200">{selectedFile.name}</p>
            <p className="text-sm text-zinc-500">{formatBytes(selectedFile.size)}</p>
            <button
              onClick={(e) => { e.stopPropagation(); clearFile(); }}
              className="text-xs text-zinc-500 underline hover:text-zinc-300"
            >
              Remove file
            </button>
          </div>
        )}
      </div>

      {/* Validate & Upload button */}
      {selectedFile && !uploadDone && (
        <button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-all
                     hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-900"
        >
          {isUploading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner />
              Running Module Audit…
            </span>
          ) : (
            'Validate & Upload'
          )}
        </button>
      )}

      {/* Success badge */}
      {uploadDone && (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-emerald-700
                        bg-emerald-950 px-6 py-3 font-semibold text-emerald-400">
          <span>✓</span>
          <span>Validated — Redirecting to subjects…</span>
        </div>
      )}

      {/* Error report */}
      {errorReport.length > 0 && <ErrorReport errors={errorReport} />}
    </div>
  );
}

// ─── Inline spinner ────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
