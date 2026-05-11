import { memo, useCallback, useRef, useState, type RefObject } from 'react';
import { COLORS, MIN_NOTE_SIZE, type Color, type Note as NoteModel } from '../../types';
import { useDrag, type DragDelta } from '../../hooks/useDrag';
import { clamp } from '../../utils/geometry';
import styles from './Note.module.css';

export interface NoteCallbacks {
  readonly onMoveStart: (id: string) => void;
  readonly onMoveMove: (id: string, clientX: number, clientY: number) => void;
  readonly onMoveEnd: (id: string, delta: DragDelta) => void;
  readonly onResizeEnd: (id: string, delta: DragDelta) => void;
  readonly onTextChange: (id: string, text: string) => void;
  readonly onColorChange: (id: string, color: Color) => void;
  readonly onBringToFront: (id: string) => void;
}

interface NoteProps extends NoteCallbacks {
  readonly note: NoteModel;
  readonly armedForDelete: boolean;
  readonly boardRef: RefObject<HTMLElement>;
}

const ZERO: DragDelta = { dx: 0, dy: 0 };

const stopPointerDown = (e: React.PointerEvent) => e.stopPropagation();

function NoteImpl(props: NoteProps) {
  const { note, armedForDelete, boardRef } = props;
  const [moveDelta, setMoveDelta] = useState<DragDelta>(ZERO);
  const [resizeDelta, setResizeDelta] = useState<DragDelta>(ZERO);
  const [editing, setEditing] = useState(false);
  const editTextRef = useRef(note.text);

  // Bounds captured at drag-start so we can pre-clamp the visual delta to the board.
  // Avoids the "drag off the edge then snap back on release" UX glitch.
  const dragBoundsRef = useRef<{ width: number; height: number } | null>(null);

  const readBounds = (): { width: number; height: number } | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    return rect ? { width: rect.width, height: rect.height } : null;
  };

  const moveDrag = useDrag({
    onDragStart: () => {
      dragBoundsRef.current = readBounds();
      props.onMoveStart(note.id);
    },
    onDragMove: (delta, ev) => {
      const b = dragBoundsRef.current;
      const clamped: DragDelta = b
        ? {
            dx: clamp(delta.dx, -note.x, b.width - note.width - note.x),
            dy: clamp(delta.dy, -note.y, b.height - note.height - note.y),
          }
        : delta;
      setMoveDelta(clamped);
      // Use the real cursor coords for trash hit-test, not the clamped delta.
      props.onMoveMove(note.id, ev.clientX, ev.clientY);
    },
    onDragEnd: (delta) => {
      dragBoundsRef.current = null;
      setMoveDelta(ZERO);
      props.onMoveEnd(note.id, delta);
    },
    onDragCancel: () => {
      dragBoundsRef.current = null;
      setMoveDelta(ZERO);
    },
  });

  const resizeDrag = useDrag({
    onDragStart: () => {
      dragBoundsRef.current = readBounds();
    },
    onDragMove: (delta) => {
      const b = dragBoundsRef.current;
      const clamped: DragDelta = b
        ? {
            dx: clamp(delta.dx, MIN_NOTE_SIZE - note.width, b.width - note.x - note.width),
            dy: clamp(delta.dy, MIN_NOTE_SIZE - note.height, b.height - note.y - note.height),
          }
        : delta;
      setResizeDelta(clamped);
    },
    onDragEnd: (delta) => {
      dragBoundsRef.current = null;
      setResizeDelta(ZERO);
      props.onResizeEnd(note.id, delta);
    },
    onDragCancel: () => {
      dragBoundsRef.current = null;
      setResizeDelta(ZERO);
    },
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      props.onBringToFront(note.id);
      // Prevent the Board's create-drag from also seeing this pointerdown.
      e.stopPropagation();
      moveDrag.onPointerDown(e);
    },
    [moveDrag, note.id, props],
  );

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      resizeDrag.onPointerDown(e);
    },
    [resizeDrag],
  );

  const onDoubleClick = useCallback(() => {
    editTextRef.current = note.text;
    setEditing(true);
  }, [note.text]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    if (editTextRef.current !== note.text) {
      props.onTextChange(note.id, editTextRef.current);
    }
  }, [note.id, note.text, props]);

  const cancelEdit = useCallback(() => {
    editTextRef.current = note.text;
    setEditing(false);
  }, [note.text]);

  const dragging = moveDelta.dx !== 0 || moveDelta.dy !== 0;
  const x = note.x + moveDelta.dx;
  const y = note.y + moveDelta.dy;
  const width = Math.max(MIN_NOTE_SIZE, note.width + resizeDelta.dx);
  const height = Math.max(MIN_NOTE_SIZE, note.height + resizeDelta.dy);

  return (
    <div
      className={`${styles.note} ${dragging ? styles.dragging : ''} ${armedForDelete ? styles.willDelete : ''}`}
      style={{
        transform: `translate3d(${x}px, ${y}px, 0)`,
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: note.color,
        zIndex: note.z,
      }}
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
    >
      <div className={styles.colorBar} onPointerDown={stopPointerDown}>
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`${styles.colorDot} ${c === note.color ? styles.active : ''}`}
            style={{ backgroundColor: c }}
            aria-label={`Color ${c}`}
            onClick={() => props.onColorChange(note.id, c)}
          />
        ))}
      </div>
      {editing ? (
        <textarea
          className={styles.editor}
          defaultValue={note.text}
          autoFocus
          onPointerDown={stopPointerDown}
          onChange={(e) => {
            editTextRef.current = e.target.value;
          }}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelEdit();
            }
          }}
        />
      ) : (
        <div className={styles.body}>
          {note.text || <span className={styles.placeholder}>Double-click to edit</span>}
        </div>
      )}
      <div className={styles.resizeHandle} onPointerDown={onResizePointerDown} role="presentation" />
    </div>
  );
}

export const Note = memo(NoteImpl);
