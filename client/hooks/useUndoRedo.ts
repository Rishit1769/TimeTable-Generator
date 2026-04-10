/**
 * useUndoRedo.ts
 *
 * Reads undo/redo state from useGridStore and registers
 * Ctrl+Z / Ctrl+Shift+Z (and Mac ⌘Z / ⌘⇧Z) keyboard shortcuts.
 *
 * Mount this hook once at the page/layout level.
 */

'use client';

import { useEffect } from 'react';
import { useGridStore } from '@/store/useGridStore';

export function useUndoRedo() {
  const undo         = useGridStore((s) => s.undo);
  const redo         = useGridStore((s) => s.redo);
  const history      = useGridStore((s) => s.history);
  const historyIndex = useGridStore((s) => s.historyIndex);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;
  const lastAction =
    historyIndex > 0 ? history[historyIndex].description : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  return { canUndo, canRedo, lastAction, undo, redo };
}
