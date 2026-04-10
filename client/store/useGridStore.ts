/**
 * useGridStore.ts
 *
 * Single source of truth for all grid editor state.
 *
 * Undo / Redo stack notes:
 *   • history[0] is the initial state (before any edits).
 *   • history[historyIndex] is the currently displayed state.
 *   • pushHistory() saves the CURRENT grid into history before a mutation,
 *     so undo() always reverts to the previous snapshot.
 *   • Max 50 history entries — oldest are evicted.
 */

import { create } from 'zustand';
import { fetchGrid,
         swapSlots as apiSwapSlots } from '@/lib/grid.api';
import { buildGridFromRows,
         DEFAULT_DAYS,
         DEFAULT_TIME_SLOTS,
         createEmptyGrid }           from '@/lib/grid.utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GridSlotData {
  subject_id:    number;
  subject_code:  string;
  subject_name:  string;
  paper_code:    string;
  teacher_id:    number;
  teacher_name:  string;
  module_id:     number;
  module_number: number;
  module_name:   string;
  year:          string;
  department:    string;
}

export type Grid = Record<string, Record<string, GridSlotData | null>>;

export interface HistoryEntry {
  grid:        Grid;
  description: string;
}

interface DragState {
  isDragging:  boolean;
  draggedSlot: { day: string; timeSlot: string } | null;
  conflictMap: Record<string, 'valid' | 'invalid' | 'unchecked'>;
}

interface GridStore {
  // ── State ──────────────────────────────────────────────────────────────────
  grid:          Grid;
  days:          string[];
  timeSlots:     string[];
  viewMode:      'paper_code' | 'teacher_module';
  activeFilters: { department: string | null; year: string | null };
  dragState:     DragState;
  swapModeSource: { day: string; timeSlot: string } | null;
  history:       HistoryEntry[];
  historyIndex:  number;
  isLoading:     boolean;

  // ── Actions ────────────────────────────────────────────────────────────────
  setGrid:           (grid: Grid) => void;
  moveSlot:          (from: { day: string; timeSlot: string }, to: { day: string; timeSlot: string }) => void;
  swapSlots:         (slotA: { day: string; timeSlot: string }, slotB: { day: string; timeSlot: string }) => void;
  setViewMode:       (mode: 'paper_code' | 'teacher_module') => void;
  setConflictResult: (day: string, timeSlot: string, result: 'valid' | 'invalid') => void;
  clearConflictMap:  () => void;
  setDragState:      (patch: Partial<DragState>) => void;
  setFilter:         (filter: Partial<GridStore['activeFilters']>) => void;
  setSwapModeSource: (slot: { day: string; timeSlot: string } | null) => void;
  undo:              () => void;
  redo:              () => void;
  pushHistory:       (description: string) => void;
  loadGrid:          (department?: string, year?: string) => Promise<void>;
}

const MAX_HISTORY = 50;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useGridStore = create<GridStore>((set, get) => ({
  grid:          createEmptyGrid(),
  days:          [...DEFAULT_DAYS],
  timeSlots:     [...DEFAULT_TIME_SLOTS],
  viewMode:      'paper_code',
  activeFilters: { department: null, year: null },
  swapModeSource: null,
  dragState: {
    isDragging:  false,
    draggedSlot: null,
    conflictMap: {},
  },
  history:      [],
  historyIndex: -1,
  isLoading:    false,

  // ── setGrid ──────────────────────────────────────────────────────────────

  setGrid: (grid) => set({ grid }),

  // ── loadGrid ─────────────────────────────────────────────────────────────

  loadGrid: async (department, year) => {
    set({ isLoading: true });
    try {
      const rows = await fetchGrid(department ?? null, year ?? null);

      // Derive unique days + timeSlots from response, fall back to defaults
      const daySet  = new Set<string>([...DEFAULT_DAYS]);
      const tsSet   = new Set<string>([...DEFAULT_TIME_SLOTS]);
      for (const r of rows) { daySet.add(r.day); tsSet.add(r.time_slot); }

      const days      = [...DEFAULT_DAYS].filter((d) => daySet.has(d));
      const timeSlots = [...DEFAULT_TIME_SLOTS].filter((t) => tsSet.has(t));

      const grid = buildGridFromRows(rows, days, timeSlots);

      set({
        grid,
        days,
        timeSlots,
        isLoading: false,
        history:      [{ grid, description: 'Initial load' }],
        historyIndex: 0,
      });
    } catch (err) {
      console.error('[useGridStore] loadGrid failed:', err);
      set({ isLoading: false });
    }
  },

  // ── moveSlot ─────────────────────────────────────────────────────────────

  moveSlot: (from, to) => {
    const { grid } = get();
    const slotData = grid[from.day]?.[from.timeSlot];
    if (!slotData) return;

    get().pushHistory(
      `Moved ${slotData.subject_code} from ${from.day} ${from.timeSlot} to ${to.day} ${to.timeSlot}`,
    );

    set((state) => ({
      grid: {
        ...state.grid,
        [from.day]: { ...state.grid[from.day], [from.timeSlot]: null },
        [to.day]:   { ...state.grid[to.day],   [to.timeSlot]:   slotData },
      },
    }));

    // Persist to DB (fire-and-forget)
    void apiSwapSlots(from, to).catch(console.error);
  },

  // ── swapSlots ────────────────────────────────────────────────────────────

  swapSlots: (slotA, slotB) => {
    const { grid } = get();
    const dataA = grid[slotA.day]?.[slotA.timeSlot] ?? null;
    const dataB = grid[slotB.day]?.[slotB.timeSlot] ?? null;

    const label =
      `${dataA?.subject_code ?? 'empty'} ↔ ${dataB?.subject_code ?? 'empty'}`
      + ` (${slotA.day} ${slotA.timeSlot} ↔ ${slotB.day} ${slotB.timeSlot})`;

    get().pushHistory(`Swapped ${label}`);

    set((state) => ({
      grid: {
        ...state.grid,
        [slotA.day]: { ...state.grid[slotA.day], [slotA.timeSlot]: dataB },
        [slotB.day]: { ...state.grid[slotB.day], [slotB.timeSlot]: dataA },
      },
      swapModeSource: null,
    }));

    // Persist to DB (fire-and-forget)
    void apiSwapSlots(slotA, slotB).catch(console.error);
  },

  // ── viewMode ─────────────────────────────────────────────────────────────

  setViewMode: (mode) => set({ viewMode: mode }),

  // ── dragState helpers ────────────────────────────────────────────────────

  setConflictResult: (day, timeSlot, result) =>
    set((state) => ({
      dragState: {
        ...state.dragState,
        conflictMap: {
          ...state.dragState.conflictMap,
          [`${day}__${timeSlot}`]: result,
        },
      },
    })),

  clearConflictMap: () =>
    set((state) => ({
      dragState: { ...state.dragState, conflictMap: {} },
    })),

  setDragState: (patch) =>
    set((state) => ({
      dragState: { ...state.dragState, ...patch },
    })),

  // ── filters ──────────────────────────────────────────────────────────────

  setFilter: (filter) =>
    set((state) => ({
      activeFilters: { ...state.activeFilters, ...filter },
    })),

  // ── swap mode ────────────────────────────────────────────────────────────

  setSwapModeSource: (slot) => set({ swapModeSource: slot }),

  // ── undo / redo ──────────────────────────────────────────────────────────

  pushHistory: (description) => {
    const { grid, history, historyIndex } = get();
    // Discard any "future" states beyond the current index
    const trimmed = history.slice(0, historyIndex + 1);
    const next    = [...trimmed, { grid, description }];
    // Evict oldest entries if over cap
    const capped  = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    set({ history: capped, historyIndex: capped.length - 1 });
  },

  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    set({ grid: history[newIndex].grid, historyIndex: newIndex });
  },

  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    set({ grid: history[newIndex].grid, historyIndex: newIndex });
  },
}));
