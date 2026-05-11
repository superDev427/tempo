import type { Point, Rect } from '../types';

export const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

export const rectFromTwoPoints = (a: Point, b: Point): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(a.x - b.x);
  const height = Math.abs(a.y - b.y);
  return { x, y, width, height };
};

export const pointInRect = (p: Point, r: DOMRect): boolean =>
  p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
