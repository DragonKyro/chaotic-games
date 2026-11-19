// Doomlings art helpers: palette, a deterministic per-kind PRNG and the blob
// path every membrane is drawn with. Pure functions, no React — the home
// Thumbnail imports these, so they ride in the main bundle; keep them tiny.

import type { DmTraitColor } from './types';

export interface Hue {
  /** Membrane / body fill. */
  core: string;
  /** Rim light and glow. */
  glow: string;
  /** Shadow side, nucleus. */
  deep: string;
}

/** Bioluminescent trait colours. */
export const HUE: Record<DmTraitColor, Hue> = {
  red: { core: '#ff4f6d', glow: '#ffb0bd', deep: '#5c0a1f' },
  blue: { core: '#38a6ff', glow: '#b3e2ff', deep: '#08295c' },
  green: { core: '#46e07f', glow: '#c2ffd3', deep: '#08442a' },
  purple: { core: '#b56cff', glow: '#e6ccff', deep: '#35105f' },
  colorless: { core: '#c7d0dd', glow: '#f4f7fb', deep: '#2e3a4c' },
};

const f = (n: number) => n.toFixed(1);

/**
 * A smooth closed blob: `n` points round (cx, cy) at radius r ± jitter,
 * joined by quadratic curves through their midpoints. `squash` flattens it
 * vertically (bodies sit on the ground).
 */
export function blobPath(cx: number, cy: number, r: number, n: number, jitter: number, rand: () => number, squash = 1): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const rr = r * (1 - jitter + rand() * jitter * 2);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * squash]);
  }
  const mid = (a: [number, number], b: [number, number]) => `${f((a[0] + b[0]) / 2)} ${f((a[1] + b[1]) / 2)}`;
  let d = `M${mid(pts[n - 1]!, pts[0]!)}`;
  for (let i = 0; i < n; i++) d += ` Q${f(pts[i]![0])} ${f(pts[i]![1])} ${mid(pts[i]!, pts[(i + 1) % n]!)}`;
  return `${d}Z`;
}

/** A wavy tail from (x, y) heading at `angle`, `len` long. */
export function wavyPath(x: number, y: number, angle: number, len: number, amp: number, waves = 2): string {
  const steps = waves * 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let d = `M${f(x)} ${f(y)}`;
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * len;
    const side = i % 2 ? amp : -amp;
    const cx = x + dx * (t - len / steps / 2) - dy * side;
    const cy = y + dy * (t - len / steps / 2) + dx * side;
    d += ` Q${f(cx)} ${f(cy)} ${f(x + dx * t)} ${f(y + dy * t)}`;
  }
  return d;
}
