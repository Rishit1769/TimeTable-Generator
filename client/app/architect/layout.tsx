/**
 * app/architect/layout.tsx
 *
 * Minimal shell for the Architect route segment.
 * All heavy UI (toolbar, sidebar, grid) is in page.tsx.
 */

import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Timetable Architect',
  description: 'Interactive drag-and-drop timetable editor',
};

export default function ArchitectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      {children}
    </div>
  );
}
