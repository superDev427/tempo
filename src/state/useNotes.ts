import { useMemo, useReducer } from 'react';
import type { Color, Rect } from '../types';
import { initialState, notesReducer, type NotesState } from './notesReducer';
import { loadNotesState, usePersistNotes } from '../hooks/useLocalStorage';

export interface NotesActions {
  readonly add: (rect: Rect) => void;
  readonly move: (id: string, dx: number, dy: number, bounds: { width: number; height: number }) => void;
  readonly resize: (id: string, dw: number, dh: number, bounds: { width: number; height: number }) => void;
  readonly remove: (id: string) => void;
  readonly setText: (id: string, text: string) => void;
  readonly setColor: (id: string, color: Color) => void;
  readonly bringToFront: (id: string) => void;
}

export interface NotesApi {
  readonly state: NotesState;
  readonly actions: NotesActions;
}

export function useNotes(): NotesApi {
  const [state, dispatch] = useReducer(notesReducer, undefined, () => loadNotesState() ?? initialState);

  usePersistNotes(state);

  // dispatch is stable across renders; actions never need to be recreated.
  const actions = useMemo<NotesActions>(
    () => ({
      add: (rect) => dispatch({ type: 'ADD', rect }),
      move: (id, dx, dy, bounds) => dispatch({ type: 'MOVE', id, dx, dy, bounds }),
      resize: (id, dw, dh, bounds) => dispatch({ type: 'RESIZE', id, dw, dh, bounds }),
      remove: (id) => dispatch({ type: 'REMOVE', id }),
      setText: (id, text) => dispatch({ type: 'SET_TEXT', id, text }),
      setColor: (id, color) => dispatch({ type: 'SET_COLOR', id, color }),
      bringToFront: (id) => dispatch({ type: 'BRING_TO_FRONT', id }),
    }),
    [],
  );

  return { state, actions };
}
