import { useEffect, useRef } from 'react';
import { COLORS, PERSIST_DEBOUNCE_MS, STORAGE_KEY, type Color, type Note } from '../types';
import type { NotesState } from '../state/notesReducer';

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isString = (v: unknown): v is string => typeof v === 'string';
const isColor = (v: unknown): v is Color => isString(v) && (COLORS as ReadonlyArray<string>).includes(v);

const isNote = (v: unknown): v is Note => {
  if (!v || typeof v !== 'object') return false;
  const n = v as Record<string, unknown>;
  return (
    isString(n.id) &&
    isFiniteNumber(n.x) &&
    isFiniteNumber(n.y) &&
    isFiniteNumber(n.width) &&
    isFiniteNumber(n.height) &&
    isString(n.text) &&
    isColor(n.color) &&
    isFiniteNumber(n.z)
  );
};

export const loadNotesState = (): NotesState | undefined => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const p = parsed as Record<string, unknown>;
    if (!Array.isArray(p.notes) || !isFiniteNumber(p.maxZ)) return undefined;
    if (!p.notes.every(isNote)) return undefined;
    return { notes: p.notes, maxZ: p.maxZ };
  } catch {
    return undefined;
  }
};

export function usePersistNotes(state: NotesState): void {
  const timerRef = useRef<number | undefined>(undefined);
  // Skip the very first effect run — it would overwrite storage with whatever we just
  // hydrated from it. Harmless but wasteful.
  const initialRef = useRef(true);

  useEffect(() => {
    if (initialRef.current) {
      initialRef.current = false;
      return;
    }
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Storage full or unavailable — silently ignore; in-memory state still works.
      }
    }, PERSIST_DEBOUNCE_MS);

    return () => {
      if (timerRef.current !== undefined) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [state]);
}
