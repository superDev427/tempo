export const COLORS = ['#FFE57F', '#FFAB91', '#A5D6A7', '#90CAF9', '#CE93D8'] as const;
export type Color = typeof COLORS[number];

export interface Note {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly text: string;
  readonly color: Color;
  readonly z: number;
}

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export const MIN_NOTE_SIZE = 80;
export const DEFAULT_COLOR: Color = '#FFE57F';
export const PERSIST_DEBOUNCE_MS = 250;
export const STORAGE_KEY = 'sticky-notes:v1';
