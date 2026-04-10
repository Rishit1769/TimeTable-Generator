import Link from 'next/link';
import SubjectTable from '@/components/SubjectTable';

export default function SubjectsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-12">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-100">Subject Preview</h1>
            <p className="mt-1 text-sm text-zinc-500">
              All imported subjects with module breakdown. Click a row to expand its
              modules.
            </p>
          </div>
          <Link
            href="/upload"
            className="rounded-lg bg-zinc-800 px-4 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
          >
            ← Upload New CSV
          </Link>
        </div>

        <SubjectTable />
      </div>
    </main>
  );
}
