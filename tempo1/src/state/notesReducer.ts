import { DEFAULT_COLOR, MIN_NOTE_SIZE, type Color, type Note, type Rect } from '../types';
import { clamp } from '../utils/geometry';
import { newId } from '../utils/id';

export interface NotesState {
  readonly notes: ReadonlyArray<Note>;
  readonly maxZ: number;
}

export type NotesAction =
  | { type: 'ADD'; rect: Rect }
  | { type: 'MOVE'; id: string; dx: number; dy: number; bounds: { width: number; height: number } }
  | { type: 'RESIZE'; id: string; dw: number; dh: number; bounds: { width: number; height: number } }
  | { type: 'REMOVE'; id: string }
  | { type: 'SET_TEXT'; id: string; text: string }
  | { type: 'SET_COLOR'; id: string; color: Color }
  | { type: 'BRING_TO_FRONT'; id: string };

export const initialState: NotesState = { notes: [], maxZ: 0 };

const updateNote = (
  state: NotesState,
  id: string,
  patch: (n: Note) => Note,
): NotesState => {
  let changed = false;
  const notes = state.notes.map((n) => {
    if (n.id !== id) return n;
    const next = patch(n);
    if (next !== n) changed = true;
    return next;
  });
  return changed ? { ...state, notes } : state;
};

export function notesReducer(state: NotesState, action: NotesAction): NotesState {
  switch (action.type) {
    case 'ADD': {
      const { rect } = action;
      const width = Math.max(MIN_NOTE_SIZE, rect.width);
      const height = Math.max(MIN_NOTE_SIZE, rect.height);
      const z = state.maxZ + 1;
      const note: Note = {
        id: newId(),
        x: rect.x,
        y: rect.y,
        width,
        height,
        text: '',
        color: DEFAULT_COLOR,
        z,
      };
      return { notes: [...state.notes, note], maxZ: z };
    }

    case 'MOVE': {
      const { id, dx, dy, bounds } = action;
      return updateNote(state, id, (n) => {
        const x = clamp(n.x + dx, 0, Math.max(0, bounds.width - n.width));
        const y = clamp(n.y + dy, 0, Math.max(0, bounds.height - n.height));
        return x === n.x && y === n.y ? n : { ...n, x, y };
      });
    }

    case 'RESIZE': {
      const { id, dw, dh, bounds } = action;
      return updateNote(state, id, (n) => {
        const width = clamp(n.width + dw, MIN_NOTE_SIZE, Math.max(MIN_NOTE_SIZE, bounds.width - n.x));
        const height = clamp(n.height + dh, MIN_NOTE_SIZE, Math.max(MIN_NOTE_SIZE, bounds.height - n.y));
        return width === n.width && height === n.height ? n : { ...n, width, height };
      });
    }

    case 'REMOVE':
      return { ...state, notes: state.notes.filter((n) => n.id !== action.id) };

    case 'SET_TEXT':
      return updateNote(state, action.id, (n) =>
        n.text === action.text ? n : { ...n, text: action.text },
      );

    case 'SET_COLOR':
      return updateNote(state, action.id, (n) =>
        n.color === action.color ? n : { ...n, color: action.color },
      );

    case 'BRING_TO_FRONT': {
      const note = state.notes.find((n) => n.id === action.id);
      if (!note || note.z === state.maxZ) return state;
      const z = state.maxZ + 1;
      const notes = state.notes.map((n) => (n.id === action.id ? { ...n, z } : n));
      return { notes, maxZ: z };
    }

    default: {
      // TS exhaustiveness check — if a new action variant is added, this fails to compile.
      const _exhaustive: never = action;
      void _exhaustive;
      return state;
    }
  }
}
