/**
 * app/print/page.tsx
 *
 * Suspense boundary for the PrintContent client component.
 * useSearchParams() requires Suspense in Next.js 15 App Router.
 */

import { Suspense } from 'react';
import PrintContent from './_components/PrintContent';

export default function PrintPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            padding:    '20mm',
            fontFamily: 'Inter, Arial, sans-serif',
            color:      '#374151',
          }}
        >
          Preparing timetable…
        </div>
      }
    >
      <PrintContent />
    </Suspense>
  );
}
