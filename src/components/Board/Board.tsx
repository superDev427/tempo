import { useCallback, useRef, useState } from 'react';
import { MIN_NOTE_SIZE, type Color, type Rect } from '../../types';
import { useDrag, type DragDelta } from '../../hooks/useDrag';
import { pointInRect, rectFromTwoPoints } from '../../utils/geometry';
import type { NotesApi } from '../../state/useNotes';
import { Note } from '../Note/Note';
import { Trash } from '../Trash/Trash';
import styles from './Board.module.css';

interface BoardProps {
  readonly api: NotesApi;
}

export default function Board({ api }: BoardProps) {
  const { state, actions } = api;
  // `actions` is memoized with empty deps in useNotes — stable across renders.
  // Read directly via a ref so the empty-deps callbacks below see the latest value
  // even if the hook's contract ever changes.
  const actionsRef = useRef(actions);
  actionsRef.current = actions;

  const boardRef = useRef<HTMLDivElement | null>(null);
  const trashRef = useRef<HTMLDivElement | null>(null);

  // Cached at drag-start to avoid layout reads during pointermove.
  const boardRectRef = useRef<DOMRect | null>(null);
  const trashRectRef = useRef<DOMRect | null>(null);
  const createStartRef = useRef<{ x: number; y: number } | null>(null);
  // Mirror of armedDeleteId so the stable onMoveEnd callback can read the latest value.
  const armedDeleteIdRef = useRef<string | null>(null);
  // Latest draft rect for the create gesture's commit path.
  const draftRectRef = useRef<Rect | null>(null);

  const [draftRect, setDraftRect] = useState<Rect | null>(null);
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);

  const updateDraft = useCallback((r: Rect | null) => {
    draftRectRef.current = r;
    setDraftRect(r);
  }, []);

  const updateArmed = useCallback((id: string | null) => {
    if (armedDeleteIdRef.current === id) return;
    armedDeleteIdRef.current = id;
    setArmedDeleteId(id);
  }, []);

  const createDrag = useDrag({
    onDragStart: (e) => {
      const rect = boardRef.current!.getBoundingClientRect();
      boardRectRef.current = rect;
      const start = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      createStartRef.current = start;
      updateDraft({ x: start.x, y: start.y, width: 0, height: 0 });
    },
    onDragMove: (_, ev) => {
      const rect = boardRectRef.current;
      const start = createStartRef.current;
      if (!rect || !start) return;
      const current = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
      updateDraft(rectFromTwoPoints(start, current));
    },
    onDragEnd: () => {
      const draft = draftRectRef.current;
      updateDraft(null);
      boardRectRef.current = null;
      createStartRef.current = null;
      if (!draft) return;
      if (draft.width >= MIN_NOTE_SIZE && draft.height >= MIN_NOTE_SIZE) {
        actionsRef.current.add(draft);
      }
    },
    onDragCancel: () => {
      updateDraft(null);
      boardRectRef.current = null;
      createStartRef.current = null;
    },
  });

  const onBoardPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only start create-drag on the board background, not on a child note.
      // Notes also call stopPropagation; this is a defensive double-check.
      if (e.target !== e.currentTarget) return;
      createDrag.onPointerDown(e);
    },
    [createDrag],
  );

  // The callbacks below are stable (empty deps). They read latest values via refs.
  const onMoveStart = useCallback(() => {
    trashRectRef.current = trashRef.current?.getBoundingClientRect() ?? null;
    updateArmed(null);
  }, [updateArmed]);

  const onMoveMove = useCallback(
    (id: string, clientX: number, clientY: number) => {
      const trashRect = trashRectRef.current;
      if (!trashRect) return;
      updateArmed(pointInRect({ x: clientX, y: clientY }, trashRect) ? id : null);
    },
    [updateArmed],
  );

  const onMoveEnd = useCallback(
    (id: string, delta: DragDelta) => {
      const armed = armedDeleteIdRef.current === id;
      trashRectRef.current = null;
      updateArmed(null);
      if (armed) {
        actionsRef.current.remove(id);
        return;
      }
      if (delta.dx === 0 && delta.dy === 0) return;
      const rect = boardRef.current!.getBoundingClientRect();
      actionsRef.current.move(id, delta.dx, delta.dy, { width: rect.width, height: rect.height });
    },
    [updateArmed],
  );

  const onResizeEnd = useCallback((id: string, delta: DragDelta) => {
    if (delta.dx === 0 && delta.dy === 0) return;
    const rect = boardRef.current!.getBoundingClientRect();
    actionsRef.current.resize(id, delta.dx, delta.dy, { width: rect.width, height: rect.height });
  }, []);

  const onTextChange = useCallback((id: string, text: string) => actionsRef.current.setText(id, text), []);
  const onColorChange = useCallback((id: string, color: Color) => actionsRef.current.setColor(id, color), []);
  const onBringToFront = useCallback((id: string) => actionsRef.current.bringToFront(id), []);

  return (
    <div ref={boardRef} className={styles.board} onPointerDown={onBoardPointerDown}>
      {state.notes.map((note) => (
        <Note
          key={note.id}
          note={note}
          armedForDelete={armedDeleteId === note.id}
          boardRef={boardRef}
          onMoveStart={onMoveStart}
          onMoveMove={onMoveMove}
          onMoveEnd={onMoveEnd}
          onResizeEnd={onResizeEnd}
          onTextChange={onTextChange}
          onColorChange={onColorChange}
          onBringToFront={onBringToFront}
        />
      ))}
      {draftRect && (
        <div
          className={styles.draft}
          style={{
            transform: `translate3d(${draftRect.x}px, ${draftRect.y}px, 0)`,
            width: `${draftRect.width}px`,
            height: `${draftRect.height}px`,
          }}
        />
      )}
      <Trash ref={trashRef} armed={armedDeleteId !== null} />
      <div className={styles.hint}>
        Drag on empty canvas to create a note · Drag a note over the red zone to delete · Double-click to edit
      </div>
    </div>
  );
}
