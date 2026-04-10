/**
 * DayColumn.tsx
 *
 * Sticky column header that shows a single weekday label.
 */

'use client';

import React from 'react';
import { formatDay } from '@/lib/grid.utils';

interface DayColumnProps {
  day: string;
}

export default React.memo(function DayColumn({ day }: DayColumnProps) {
  return (
    <div className="flex h-10 items-center justify-center rounded-md bg-zinc-800 text-xs font-semibold uppercase tracking-widest text-zinc-300">
      {formatDay(day)}
    </div>
  );
});
