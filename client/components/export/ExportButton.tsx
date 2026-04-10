/**
 * ExportButton.tsx
 *
 * Toolbar button that opens the ExportModal.
 * Used in ArchitectToolbar.
 */

'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';

// Load the modal lazily — Puppeteer blob logic doesn't need to be in initial bundle
const ExportModal = dynamic(() => import('./ExportModal'), { ssr: false });

export default function ExportButton() {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 rounded bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-600 transition-colors"
        title="Export timetable as PDF or CSV"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
          <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
          <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
        </svg>
        Export
      </button>

      {modalOpen && <ExportModal onClose={() => setModalOpen(false)} />}
    </>
  );
}
