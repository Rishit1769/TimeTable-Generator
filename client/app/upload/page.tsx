import UploadZone from '@/components/UploadZone';

export default function UploadPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Upload Timetable Data</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Upload a CSV containing subject, teacher, and module data. The system runs
            an automatic module-hour audit before committing anything to the database.
          </p>
        </div>
        <UploadZone />
      </div>
    </main>
  );
}
