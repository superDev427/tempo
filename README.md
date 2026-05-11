# Sticky Notes

A single-page sticky-notes web app implemented in TypeScript + React, hand-rolled without any third-party UI / drag-and-drop libraries.

## Features

**Required**
- Create a new note at a specified position and size — drag on the empty canvas to define a rectangle.
- Resize a note by dragging the bottom-right handle.
- Move a note by dragging its body.
- Delete a note by dragging it over the trash zone (bottom-right).

**Bonus**
- Edit note text (double-click to enter edit mode; blur or Escape to exit).
- Bring overlapping notes to the front on click.
- Persist notes to `localStorage` (debounced); restore on page load.
- Five note colors (palette inside each note).

## Build & Run

Prerequisites: Node 18+.

```
npm install
npm run dev       # http://localhost:5173
npm run build     # type-check + production bundle to ./dist
npm run preview   # serve the built bundle locally
```

Tested on the latest Chrome, Firefox, and Edge. Minimum supported resolution: 1024×768.

## Architecture

**Single source of truth via a `useReducer` hook.** All note state lives in `src/state/notesReducer.ts` — a pure function over an immutable `{ notes, maxZ }` shape. Actions (`ADD`, `MOVE`, `RESIZE`, `REMOVE`, `SET_TEXT`, `SET_COLOR`, `BRING_TO_FRONT`, `HYDRATE`) are the only way state mutates, which keeps invariants (minimum size, board bounds, monotonic z-index) enforced in one place. The reducer is wrapped by [`useNotes`](src/state/useNotes.ts), which lazily hydrates from `localStorage` and writes back through a debounced effect. Action callbacks are memoized with empty deps and stay reference-stable for the lifetime of the component, so consumers passed them down don't bust `React.memo`.

**One drag primitive, three consumers.** The [`useDrag`](src/hooks/useDrag.ts) hook is a thin abstraction over Pointer Events: `pointerdown` → `setPointerCapture` → `pointermove` / `pointerup` / `pointercancel`. `pointercancel` is handled symmetrically with `pointerup` so Firefox's aggressive gesture-cancel doesn't leave drags stuck. The hook is parameterized with `onDragStart/Move/End/Cancel`, never mode-switched. Three independent consumers bind it: the `Board` for create-by-drag, the `Note` body for move, and the resize handle for resize. Each consumer reads its own deltas; trash hit-testing during a move drag is co-located on the `Board`, which caches the trash bounding rect on drag start and arms/disarms a flag as the pointer crosses it.

**Per-drag locality for performance.** During a move or resize, only the dragged note re-renders. The dispatch to the reducer happens just once, on `pointerup` — the commit. Until then, the note keeps its transient delta in local `useState`, and its rendered position is `committed + transient`. Combined with `React.memo` on the `Note` component and reference-stable callback props from the `Board`, the React Profiler shows a single Note (the one being dragged) re-rendering on each `pointermove`, regardless of how many notes exist. Positions are written via `transform: translate3d(...)` so the compositor handles motion without re-layout.

## Project Layout

```
src/
  main.tsx                   Vite entry
  App.tsx                    Hooks state, renders Board
  types.ts                   Note, Rect, Color, constants
  state/
    notesReducer.ts          Pure reducer + initial state
    useNotes.ts              useReducer + hydration + persistence wiring
  hooks/
    useDrag.ts               Pointer-events drag primitive
    useLocalStorage.ts       Hydrate + debounced save
  components/
    Board/Board.tsx          Canvas; owns create-drag and trash hit-test
    Note/Note.tsx            Memoized; owns move/resize/edit/colors
    Trash/Trash.tsx          Drop zone with armed state
  utils/
    geometry.ts              clamp, rectFromTwoPoints, pointInRect
    id.ts                    crypto.randomUUID with fallback
  styles/global.css          Reset + CSS custom properties
```

## Usability Notes

- **Create**: click-drag on the empty canvas. The rectangle must meet the 80 px minimum on both axes to become a note (preventing accidental tiny notes on stray clicks).
- **Move / Resize**: bounds are clamped in the reducer so notes can never go off-board or shrink below the minimum size.
- **Delete**: drag a note over the red zone (bottom-right). The zone scales and turns solid red when armed, and the note dims. Releasing outside the zone cancels the delete.
- **Text editing**: double-click. Blur or Escape exits edit mode. Escape discards changes; blur commits.
- **Color**: each note shows a five-swatch palette at the top. Clicking a swatch is a discrete interaction — it does not initiate a move.
- **z-index**: any `pointerdown` on a note brings it to the front; `maxZ` is monotonic, so this is a constant-cost operation.

## What Was Deliberately Omitted

- The REST API mock bonus, in favor of polishing the persistence layer that's already in scope.
- An automated test suite — the project is small enough that the reducer is the only thing worth unit-testing in isolation; given the 3–4 hour budget I prioritized architecture and UX correctness over a Jest setup. The reducer is pure and trivially testable if extended.
