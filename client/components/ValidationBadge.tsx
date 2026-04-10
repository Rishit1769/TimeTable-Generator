interface ValidationBadgeProps {
  isValid: boolean;
}

/**
 * Small pill badge indicating whether a subject's module-hour sum matches
 * its total_semester_hours value.
 */
export default function ValidationBadge({ isValid }: ValidationBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold',
        isValid
          ? 'border-emerald-800 bg-emerald-950 text-emerald-400'
          : 'border-red-800   bg-red-950   text-red-400',
      ].join(' ')}
    >
      {isValid ? '✓ Valid' : '✗ Invalid'}
    </span>
  );
}
