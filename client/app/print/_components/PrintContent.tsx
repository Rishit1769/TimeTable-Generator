/**
 * PrintContent.tsx
 *
 * Client component — Puppeteer's actual render target.
 *
 * • Reads department / year / semester from URL searchParams.
 * • Fetches grid rows and full subject data independently (no Zustand).
 * • Renders an A4-landscape timetable table with inline styles
 *   (Tailwind classes are NOT used here — Puppeteer's printBackground
 *    requires explicit hex/rgb values for guaranteed fidelity).
 * • Sets data-pdf-ready="true" on #print-root after a 500ms settle delay.
 */

'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams }            from 'next/navigation';

// ─── Types ────────────────────────────────────────────────────────────────────

interface GridRow {
  day:            string;
  time_slot:      string;
  subject_id:     number;
  subject_name:   string;
  subject_code:   string;
  paper_code:     string;
  teacher_id:     number;
  teacher_name:   string;
  module_id:      number;
  module_number:  number;
  module_name:    string;
}

interface SubjectWithModules {
  id:            number;
  subject_code:  string;
  subject_name:  string;
  paper_code:    string;
  credits:       number;
  teacher1_name: string | null;
  teacher2_name: string | null;
  expected_hours_per_week: number;
  modules: { id: number; module_number: number; module_name: string; assigned_teacher_name: string | null }[];
}

// ─── Colour palette (hex, not Tailwind) ───────────────────────────────────────

const PRINT_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0:  { bg: '#1e1b4b', border: '#6d28d9', text: '#ddd6fe' },
  1:  { bg: '#0c4a6e', border: '#0284c7', text: '#bae6fd' },
  2:  { bg: '#064e3b', border: '#059669', text: '#a7f3d0' },
  3:  { bg: '#78350f', border: '#d97706', text: '#fde68a' },
  4:  { bg: '#4c0519', border: '#e11d48', text: '#fecdd3' },
  5:  { bg: '#083344', border: '#0891b2', text: '#a5f3fc' },
  6:  { bg: '#2e1065', border: '#7c3aed', text: '#ede9fe' },
  7:  { bg: '#14532d', border: '#16a34a', text: '#bbf7d0' },
  8:  { bg: '#3b0764', border: '#a855f7', text: '#f3e8ff' },
  9:  { bg: '#431407', border: '#ea580c', text: '#fed7aa' },
  10: { bg: '#1c1917', border: '#78716c', text: '#d6d3d1' },
  11: { bg: '#0d3347', border: '#06b6d4', text: '#cffafe' },
  12: { bg: '#3f3f46', border: '#71717a', text: '#f4f4f5' },
  13: { bg: '#312e81', border: '#4f46e5', text: '#e0e7ff' },
  14: { bg: '#134e4a', border: '#0d9488', text: '#ccfbf1' },
  15: { bg: '#1e3a5f', border: '#3b82f6', text: '#bfdbfe' },
};

const getPrintColor = (id: number) => PRINT_COLORS[id % 16];

const DEFAULT_DAYS       = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const DEFAULT_TIME_SLOTS = [
  '09:00-10:00', '10:00-11:00', '11:00-12:00',
  '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// ─── Sub-components ───────────────────────────────────────────────────────────

function PrintCell({ slot }: { slot: GridRow | null }) {
  if (!slot) {
    return (
      <td
        style={{
          border:    '1px solid #e5e7eb',
          minHeight: '40px',
          height:    '44px',
          padding:   0,
        }}
      />
    );
  }
  const c = getPrintColor(slot.subject_id);
  return (
    <td
      style={{
        backgroundColor: c.bg,
        borderLeft:      `3px solid ${c.border}`,
        borderTop:       '1px solid #374151',
        borderBottom:    '1px solid #374151',
        borderRight:     '1px solid #374151',
        color:           c.text,
        padding:         '4px 6px',
        fontSize:        '9px',
        fontFamily:      'Inter, Arial, sans-serif',
        verticalAlign:   'top',
        maxWidth:        '120px',
      }}
    >
      <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {slot.paper_code || slot.subject_code}
      </div>
      <div style={{ fontSize: '8px', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {slot.subject_name}
      </div>
      <div style={{ fontSize: '7px', marginTop: '2px', opacity: 0.7 }}>
        {slot.teacher_name} · M{slot.module_number}
      </div>
    </td>
  );
}

const thStyle: React.CSSProperties = {
  padding:         '4px 6px',
  textAlign:       'left',
  fontWeight:      600,
  fontSize:        '8px',
  fontFamily:      'Inter, Arial, sans-serif',
  borderBottom:    '1px solid #d1d5db',
  backgroundColor: '#f3f4f6',
  color:           '#374151',
};
const tdStyle: React.CSSProperties = {
  padding:      '3px 6px',
  fontSize:     '8px',
  fontFamily:   'Inter, Arial, sans-serif',
  verticalAlign: 'top',
  color:         '#1f2937',
  borderBottom:  '1px solid #e5e7eb',
};

function TeacherModuleLegend({ subjects }: { subjects: SubjectWithModules[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8mm' }}>
      <thead>
        <tr>
          <th style={thStyle}>Subject (Code)</th>
          <th style={thStyle}>Paper Code</th>
          <th style={thStyle}>Credits</th>
          <th style={thStyle}>Teacher 1</th>
          <th style={thStyle}>Modules (T1)</th>
          <th style={thStyle}>Teacher 2</th>
          <th style={thStyle}>Modules (T2)</th>
          <th style={thStyle}>Hrs/Wk</th>
        </tr>
      </thead>
      <tbody>
        {subjects.map((s) => {
          const c       = getPrintColor(s.id);
          const t1mods  = s.modules.filter((m) => m.module_number <= 3).map((m) => m.module_name).join(', ');
          const t2mods  = s.modules.filter((m) => m.module_number > 3).map((m) => m.module_name).join(', ') || '—';
          return (
            <tr key={s.id}>
              <td style={tdStyle}>
                <span
                  style={{
                    display:         'inline-block',
                    width:           8,
                    height:          8,
                    borderRadius:    2,
                    backgroundColor: c.border,
                    marginRight:     4,
                    verticalAlign:   'middle',
                  }}
                />
                {s.subject_name} ({s.subject_code})
              </td>
              <td style={tdStyle}>{s.paper_code}</td>
              <td style={tdStyle}>{s.credits}</td>
              <td style={tdStyle}>{s.teacher1_name ?? '—'}</td>
              <td style={{ ...tdStyle, maxWidth: '140px' }}>{t1mods}</td>
              <td style={tdStyle}>{s.teacher2_name ?? '—'}</td>
              <td style={{ ...tdStyle, maxWidth: '140px' }}>{t2mods}</td>
              <td style={tdStyle}>{s.expected_hours_per_week}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PrintContent() {
  const searchParams = useSearchParams();
  const department   = searchParams.get('department') ?? '';
  const year         = searchParams.get('year')        ?? '';
  const semester     = searchParams.get('semester')    ?? '';

  const [gridRows,  setGridRows]  = useState<GridRow[]>([]);
  const [subjects,  setSubjects]  = useState<SubjectWithModules[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch data ────────────────────────────────────────────────────────────

  useEffect(() => {
    const params = new URLSearchParams();
    if (department) params.set('department', department);
    if (year)       params.set('year', year);

    Promise.all([
      fetch(`${API_BASE}/grid?${params}`).then<GridRow[]>((r) => r.json()),
      fetch(`${API_BASE}/subjects/full?${params}`).then<SubjectWithModules[]>((r) => r.json()),
    ])
      .then(([rows, subs]) => {
        setGridRows(Array.isArray(rows) ? rows : []);
        setSubjects(Array.isArray(subs) ? subs : []);
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [department, year]);

  // ── Signal PDF-ready ──────────────────────────────────────────────────────

  useEffect(() => {
    if (isLoading) return;
    const timer = setTimeout(() => {
      document.getElementById('print-root')?.setAttribute('data-pdf-ready', 'true');
    }, 500);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // ── Build 2D grid map ─────────────────────────────────────────────────────

  const gridMap: Record<string, Record<string, GridRow>> = {};
  for (const row of gridRows) {
    if (!gridMap[row.day]) gridMap[row.day] = {};
    gridMap[row.day][row.time_slot] = row;
  }

  const days      = DEFAULT_DAYS;
  const timeSlots = DEFAULT_TIME_SLOTS;

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div
        id="print-root"
        style={{ padding: '20mm', fontFamily: 'Inter, Arial, sans-serif', color: '#374151' }}
      >
        Loading timetable…
      </div>
    );
  }

  return (
    <div
      id="print-root"
      style={{
        width:      '277mm',
        minHeight:  '190mm',
        padding:    '2mm 4mm',
        fontFamily: 'Inter, Arial, sans-serif',
        background: '#ffffff',
        color:      '#111',
      }}
    >
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div
        style={{
          display:        'flex',
          justifyContent: 'space-between',
          alignItems:     'flex-end',
          borderBottom:   '2px solid #1f2937',
          paddingBottom:  '3mm',
          marginBottom:   '3mm',
        }}
      >
        <div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827' }}>
            Weekly Timetable
          </div>
          <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
            {department} Department · {year} Year
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '10px', color: '#6b7280' }}>
          <div style={{ fontWeight: 600, color: '#374151' }}>{semester}</div>
          <div>Smart Timetable Architect</div>
        </div>
      </div>

      {/* ── Timetable grid ───────────────────────────────────────────────── */}
      <table
        style={{
          width:           '100%',
          borderCollapse:  'collapse',
          tableLayout:     'fixed',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                ...thStyle,
                width:      '55px',
                textAlign:  'center',
                background: '#1f2937',
                color:      '#f9fafb',
              }}
            >
              TIME
            </th>
            {days.map((day) => (
              <th
                key={day}
                style={{
                  ...thStyle,
                  textAlign:  'center',
                  background: '#1f2937',
                  color:      '#f9fafb',
                  fontSize:   '9px',
                }}
              >
                {day}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeSlots.map((ts) => (
            <tr key={ts}>
              <td
                style={{
                  fontSize:        '8px',
                  fontFamily:      'Inter, Arial, sans-serif',
                  textAlign:       'center',
                  verticalAlign:   'middle',
                  color:           '#6b7280',
                  border:          '1px solid #e5e7eb',
                  padding:         '2px 3px',
                  whiteSpace:      'nowrap',
                  backgroundColor: '#f9fafb',
                }}
              >
                {ts.slice(0, 5)}
              </td>
              {days.map((day) => (
                <PrintCell
                  key={`${day}-${ts}`}
                  slot={gridMap[day]?.[ts] ?? null}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Teacher–Module Legend ─────────────────────────────────────────── */}
      {subjects.length > 0 && <TeacherModuleLegend subjects={subjects} />}
    </div>
  );
}
