/**
 * colorMap.ts
 *
 * Assigns a deterministic, professional color to each subject based on its
 * subject_id.  Colors are designed for dark (zinc/slate) backgrounds.
 *
 * Usage:
 *   const { bg, border, text, dot } = getSubjectColor(subject_id)
 */

export interface SubjectColor {
  bg:     string;  // Tailwind background class
  border: string;  // Tailwind border color class
  text:   string;  // Tailwind text color class
  dot:    string;  // Tailwind background class for the indicator dot
}

const SUBJECT_COLORS: SubjectColor[] = [
  { bg: 'bg-violet-900/60',   border: 'border-violet-500',  text: 'text-violet-200',  dot: 'bg-violet-400'  },
  { bg: 'bg-sky-900/60',      border: 'border-sky-500',     text: 'text-sky-200',     dot: 'bg-sky-400'     },
  { bg: 'bg-emerald-900/60',  border: 'border-emerald-500', text: 'text-emerald-200', dot: 'bg-emerald-400' },
  { bg: 'bg-amber-900/60',    border: 'border-amber-500',   text: 'text-amber-200',   dot: 'bg-amber-400'   },
  { bg: 'bg-rose-900/60',     border: 'border-rose-500',    text: 'text-rose-200',    dot: 'bg-rose-400'    },
  { bg: 'bg-cyan-900/60',     border: 'border-cyan-500',    text: 'text-cyan-200',    dot: 'bg-cyan-400'    },
  { bg: 'bg-fuchsia-900/60',  border: 'border-fuchsia-500', text: 'text-fuchsia-200', dot: 'bg-fuchsia-400' },
  { bg: 'bg-lime-900/60',     border: 'border-lime-500',    text: 'text-lime-200',    dot: 'bg-lime-400'    },
  { bg: 'bg-indigo-900/60',   border: 'border-indigo-500',  text: 'text-indigo-200',  dot: 'bg-indigo-400'  },
  { bg: 'bg-teal-900/60',     border: 'border-teal-500',    text: 'text-teal-200',    dot: 'bg-teal-400'    },
  { bg: 'bg-orange-900/60',   border: 'border-orange-500',  text: 'text-orange-200',  dot: 'bg-orange-400'  },
  { bg: 'bg-pink-900/60',     border: 'border-pink-500',    text: 'text-pink-200',    dot: 'bg-pink-400'    },
  { bg: 'bg-green-900/60',    border: 'border-green-500',   text: 'text-green-200',   dot: 'bg-green-400'   },
  { bg: 'bg-red-900/60',      border: 'border-red-500',     text: 'text-red-200',     dot: 'bg-red-400'     },
  { bg: 'bg-yellow-900/60',   border: 'border-yellow-500',  text: 'text-yellow-200',  dot: 'bg-yellow-400'  },
  { bg: 'bg-blue-900/60',     border: 'border-blue-500',    text: 'text-blue-200',    dot: 'bg-blue-400'    },
];

/**
 * Returns the color palette entry for a given subject, cycling through the
 * 16-color palette using subject_id modulo.
 *
 * @param subject_id  The numeric subject ID (deterministic mapping).
 */
export function getSubjectColor(subject_id: number): SubjectColor {
  return SUBJECT_COLORS[subject_id % SUBJECT_COLORS.length];
}
