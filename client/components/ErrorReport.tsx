import type { UploadError } from '@/lib/api';

interface ErrorReportProps {
  errors: UploadError[];
}

/**
 * ErrorReport renders a structured validation-failure table.
 *
 * Colour coding:
 *   delta < 0  — red row   (missing hours)
 *   delta > 0  — amber row (excess hours)
 */
export default function ErrorReport({ errors }: ErrorReportProps) {
  return (
    <div className="space-y-3">
      {/* Summary banner */}
      <div className="flex items-center gap-2 rounded-lg border border-red-800 bg-red-950/30 px-4 py-3">
        <span className="text-lg text-red-400">⚠</span>
        <p className="text-sm font-semibold text-red-400">
          {errors.length} subject{errors.length !== 1 ? 's' : ''} failed validation.
          Fix your CSV and re-upload.
        </p>
      </div>

      {/* Error table */}
      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="px-4 py-3 text-left font-medium text-zinc-400">Subject Code</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-400">Subject Name</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-400">Expected Hrs</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-400">Calculated Hrs</th>
              <th className="px-4 py-3 text-right font-medium text-zinc-400">Delta</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-400">Error Message</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((err, idx) => {
              const rowCls =
                err.delta < 0
                  ? 'bg-red-950/20 hover:bg-red-950/40'
                  : 'bg-amber-950/20 hover:bg-amber-950/40';
              const deltaCls = err.delta < 0 ? 'text-red-400' : 'text-amber-400';
              const deltaStr = err.delta > 0 ? `+${err.delta}` : String(err.delta);

              return (
                <tr key={idx} className={`border-b border-zinc-800/50 ${rowCls}`}>
                  <td className="px-4 py-3 font-mono text-zinc-300">{err.subject_code}</td>
                  <td className="px-4 py-3 text-zinc-300">{err.subject_name}</td>
                  <td className="px-4 py-3 text-right text-zinc-400">{err.expected_total}</td>
                  <td className="px-4 py-3 text-right text-zinc-400">{err.calculated_total}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${deltaCls}`}>{deltaStr}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{err.error}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
