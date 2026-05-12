import { useCallback, useEffect, useRef } from 'react';

export interface DragDelta {
  readonly dx: number;
  readonly dy: number;
}

export interface DragHandlers {
  onDragStart?: (e: React.PointerEvent<HTMLElement>) => void;
  onDragMove?: (delta: DragDelta, e: PointerEvent) => void;
  onDragEnd?: (delta: DragDelta, e: PointerEvent) => void;
  onDragCancel?: () => void;
}

interface DragBinding {
  readonly onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
}

interface ActiveDrag {
  startX: number;
  startY: number;
  pointerId: number;
  element: HTMLElement;
  cleanup: () => void;
}

/**
 * Pointer-event drag primitive. Calls `setPointerCapture` so move/up fire even when the
 * pointer leaves the source element. Handles `pointercancel` symmetrically with
 * `pointerup` (Firefox can fire cancel mid-drag if it thinks a gesture started).
 *
 * Listeners are released on pointerup, pointercancel, or component unmount.
 */
export function useDrag(handlers: DragHandlers): DragBinding {
  // Direct render-body assignment: refs read only inside event callbacks that fire
  // after the commit, so this is sound and avoids the one-render staleness of useEffect.
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const activeRef = useRef<ActiveDrag | null>(null);

  // Defensive unmount cleanup: if the component owning the captured element unmounts
  // mid-drag, release listeners and notify the consumer via onDragCancel.
  useEffect(() => {
    return () => {
      const active = activeRef.current;
      if (!active) return;
      active.cleanup();
      handlersRef.current.onDragCancel?.();
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    if (activeRef.current) return; // Already mid-drag; ignore re-entrancy.
    e.preventDefault();

    const element = e.currentTarget;
    const pointerId = e.pointerId;

    const onMove = (ev: PointerEvent) => {
      const active = activeRef.current;
      if (!active || ev.pointerId !== active.pointerId) return;
      handlersRef.current.onDragMove?.({ dx: ev.clientX - active.startX, dy: ev.clientY - active.startY }, ev);
    };

    const onUp = (ev: PointerEvent) => {
      const active = activeRef.current;
      if (!active || ev.pointerId !== active.pointerId) return;
      const delta = { dx: ev.clientX - active.startX, dy: ev.clientY - active.startY };
      active.cleanup();
      handlersRef.current.onDragEnd?.(delta, ev);
    };

    const onCancel = (ev: PointerEvent) => {
      const active = activeRef.current;
      if (!active || ev.pointerId !== active.pointerId) return;
      active.cleanup();
      handlersRef.current.onDragCancel?.();
    };

    const cleanup = () => {
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onCancel);
      try {
        element.releasePointerCapture(pointerId);
      } catch {
        // Already released — ignore.
      }
      activeRef.current = null;
    };

    activeRef.current = { startX: e.clientX, startY: e.clientY, pointerId, element, cleanup };

    try {
      element.setPointerCapture(pointerId);
    } catch {
      // Capture can fail in rare cases (e.g., element detached); proceed without it.
    }

    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onCancel);

    handlersRef.current.onDragStart?.(e);
  }, []);

  return { onPointerDown };
}
