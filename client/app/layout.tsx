import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title:       'Smart Timetable Architect',
  description: 'Phase 1 — Academic timetable data ingestion and validation',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 min-h-screen antialiased">
        {/* ── Navigation bar ── */}
        <nav className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur-sm">
          <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
            <Link href="/" className="font-bold tracking-tight text-zinc-100">
              📅 Timetable Architect
            </Link>
            <div className="flex items-center gap-6 text-sm">
              <Link
                href="/upload"
                className="text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Upload
              </Link>
              <Link
                href="/subjects"
                className="text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Subjects
              </Link>
              <Link
                href="/architect"
                className="text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Architect
              </Link>
              <Link
                href="/analytics"
                className="text-zinc-400 transition-colors hover:text-zinc-200"
              >
                Analytics
              </Link>
            </div>
          </div>
        </nav>

        {children}
      </body>
    </html>
  );
}
