// Happy Little Dinosaurs — the scene behind the board (sky, sun, clouds, the
// smoking volcano you're escaping, jungle) and the Escape Route: a winding
// trail of stepping stones from the volcano to a finish flag, with every
// player's dino token standing on their score. Tokens slide (CSS transition)
// when a score changes.

import { useMemo, type CSSProperties } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import { DinoShape, INK, type DinoMood } from './DinoArt';
import type { HldDinoId } from './types';

// ----------------------------------------------------------------------------
// Geometry: three cubic segments, sampled once into an arc-length table.
// ----------------------------------------------------------------------------

type P = readonly [number, number];
const SEGMENTS: readonly (readonly [P, P, P, P])[] = [
  [[92, 120], [210, 124], [236, 54], [366, 62]],
  [[366, 62], [496, 70], [524, 128], [646, 113]],
  [[646, 113], [768, 98], [822, 44], [930, 52]],
];
const TRACK_D = `M${SEGMENTS[0]![0].join(' ')} ${SEGMENTS.map((s) => `C${s[1].join(' ')} ${s[2].join(' ')} ${s[3].join(' ')}`).join(' ')}`;

function bez(seg: readonly [P, P, P, P], t: number): P {
  const u = 1 - t;
  const [a, b, c, d] = seg;
  return [
    u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0],
    u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1],
  ];
}

const SAMPLES: { p: P; len: number }[] = (() => {
  const out: { p: P; len: number }[] = [];
  let len = 0;
  let prev: P | null = null;
  for (const seg of SEGMENTS) {
    for (let i = 0; i <= 80; i++) {
      const p = bez(seg, i / 80);
      if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      out.push({ p, len });
      prev = p;
    }
  }
  return out;
})();
const TOTAL = SAMPLES[SAMPLES.length - 1]!.len;

/** Point at a fraction (0..1) of the trail's length. */
function along(f: number): P {
  const target = Math.max(0, Math.min(1, f)) * TOTAL;
  let lo = 0;
  let hi = SAMPLES.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (SAMPLES[mid]!.len < target) lo = mid + 1;
    else hi = mid;
  }
  const b = SAMPLES[lo]!;
  const a = SAMPLES[Math.max(0, lo - 1)]!;
  const span = b.len - a.len || 1;
  const k = (target - a.len) / span;
  return [a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k];
}

// ----------------------------------------------------------------------------
// Backdrop
// ----------------------------------------------------------------------------

/** Sun, clouds, far hills, the volcano (its smoke is the one looping animation), jungle fronds. */
export function SceneBackdrop() {
  return (
    <svg className="hld-scene-art" viewBox="0 0 1000 340" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <circle cx={640} cy={66} r={50} fill="#ffe14d" opacity={0.25} />
      <circle cx={640} cy={66} r={32} fill="#ffe14d" stroke={INK} strokeWidth={4} />
      {[[260, 58, 0.9], [470, 52, 0.7], [860, 64, 0.8]].map(([x, y, s]) => (
        <path
          key={x}
          transform={`translate(${x} ${y}) scale(${s})`}
          d="M-50 16 C-62 16 -62 0 -48 -2 C-46 -20 -20 -24 -10 -10 C0 -26 32 -24 36 -6 C52 -8 58 14 44 16 Z"
          fill="#fff"
          stroke={INK}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      ))}
      <path d="M0 210 C120 150 220 170 320 150 C430 128 520 176 640 150 C760 124 860 140 1000 118 V340 H0 Z" fill="#9fdc75" stroke={INK} strokeWidth={4} />
      {/* the volcano you're running from */}
      <g>
        <path d="M-10 230 L60 96 H118 L196 230 Z" fill="#8a5a3a" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
        <path d="M60 96 C68 112 78 104 89 118 C100 104 110 112 118 96 Z" fill="#ff7a1a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <path d="M80 116 C76 150 86 170 78 230 M100 114 C106 146 96 186 104 230" fill="none" stroke="#ff7a1a" strokeWidth={8} strokeLinecap="round" />
        <g className="hld-smoke">
          <circle cx={74} cy={78} r={15} fill="#cfc6d8" stroke={INK} strokeWidth={3} />
          <circle cx={100} cy={60} r={20} fill="#cfc6d8" stroke={INK} strokeWidth={3} />
          <circle cx={78} cy={36} r={17} fill="#cfc6d8" stroke={INK} strokeWidth={3} />
          <circle cx={108} cy={22} r={12} fill="#cfc6d8" stroke={INK} strokeWidth={3} />
        </g>
      </g>
      <path d="M0 290 C140 268 300 300 460 280 C620 260 780 296 1000 270 V340 H0 Z" fill="#6cc24a" stroke={INK} strokeWidth={4} />
      {[[40, 300, -14], [210, 312, 10], [430, 300, -8], [660, 314, 12], [900, 302, -10]].map(([x, y, r]) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${r})`}>
          {[-50, -20, 10, 40].map((a) => (
            <path key={a} transform={`rotate(${a})`} d="M0 0 C-10 -24 -6 -44 0 -58 C6 -44 10 -24 0 0 Z" fill="#3b963a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          ))}
        </g>
      ))}
    </svg>
  );
}

// ----------------------------------------------------------------------------
// The Escape Route
// ----------------------------------------------------------------------------

export interface TrackRunner {
  seat: Seat;
  dino: HldDinoId;
  position: number;
  out: boolean;
  mood: DinoMood;
}

export function EscapeRoute({ length, runners, me }: { length: number; runners: readonly TrackRunner[]; me: PlayerId | null }) {
  const n = Math.max(1, length);
  const stones = useMemo(() => Array.from({ length: n + 1 }, (_, i) => ({ i, p: along(i / n) })), [n]);
  const milestone = n > 30 ? 10 : 5;

  // Runners sharing a stone stack up instead of hiding each other.
  const stacks = new Map<number, number>();
  const placed = runners.map((r) => {
    const pos = Math.max(0, Math.min(n, r.position));
    const k = stacks.get(pos) ?? 0;
    stacks.set(pos, k + 1);
    const [x, y] = along(pos / n);
    return { ...r, pos, x: x + k * 14, y: y - 24 - k * 16 };
  });
  // Draw the local player's token last, on top.
  placed.sort((a, b) => Number(a.seat.id === me) - Number(b.seat.id === me));

  const [fx, fy] = along(1);
  return (
    <svg className="hld-track" viewBox="0 0 1000 150" role="img" aria-label={`Escape Route to ${n}`}>
      <path d={TRACK_D} fill="none" stroke={INK} strokeWidth={30} strokeLinecap="round" />
      <path d={TRACK_D} fill="none" stroke="#e0b07a" strokeWidth={23} strokeLinecap="round" />
      <path d={TRACK_D} fill="none" stroke="#c98f52" strokeWidth={3} strokeDasharray="2 14" strokeLinecap="round" />
      {stones.map(({ i, p }) => {
        const big = i % milestone === 0 && i > 0 && i < n;
        return (
          <g key={i}>
            <ellipse cx={p[0]} cy={p[1]} rx={big ? 11 : 5} ry={big ? 8 : 3.6} fill={big ? '#fff8e7' : '#f3dcb8'} stroke={INK} strokeWidth={big ? 2.6 : 1.6} />
            {big && <text x={p[0]} y={p[1] + 4.5} textAnchor="middle" fontSize={11} fontFamily="'Luckiest Guy', sans-serif" fill={INK}>{i}</text>}
          </g>
        );
      })}
      {/* start, right at the volcano's foot */}
      <text x={along(0)[0] + 2} y={along(0)[1] - 22} textAnchor="middle" fontSize={15} fontFamily="'Luckiest Guy', sans-serif" fill="#fff" stroke={INK} strokeWidth={4} paintOrder="stroke">START</text>
      {/* finish flag on the safe hill */}
      <g transform={`translate(${fx} ${fy})`}>
        <path d="M0 0 V-44" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        <path d="M2 -44 H34 L26 -35 L34 -26 H2 Z" fill="#ff4d4d" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <path d="M10 -40 H18 V-33 H10 Z M18 -33 H26 V-27 H18 Z" fill="#fff8e7" />
        <ellipse cx={0} cy={0} rx={16} ry={7} fill="#ffd23f" stroke={INK} strokeWidth={3} />
        <text x={0} y={5} textAnchor="middle" fontSize={12} fontFamily="'Luckiest Guy', sans-serif" fill={INK}>{n}</text>
      </g>
      {placed.map((r) => (
        <g
          key={r.seat.id}
          className="hld-token"
          style={{ transform: `translate(${r.x}px, ${r.y}px)` } as CSSProperties}
          opacity={r.out ? 0.55 : 1}
        >
          <title>{`${r.seat.name}: ${r.position}`}</title>
          <path d="M0 26 L-6 14 H6 Z" fill={r.seat.color} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
          <circle r={20} fill={r.seat.color} stroke={INK} strokeWidth={3.2} />
          {r.seat.id === me && <circle r={25} fill="none" stroke="#fff" strokeWidth={3} strokeDasharray="5 4" />}
          <svg x={-19} y={-17} width={38} height={32} viewBox="0 0 120 100">
            <DinoShape dino={r.dino} mood={r.mood} />
          </svg>
          <g transform="translate(16 -16)">
            <circle r={10} fill="#fff8e7" stroke={INK} strokeWidth={2.4} />
            <text y={4} textAnchor="middle" fontSize={11} fontFamily="'Luckiest Guy', sans-serif" fill={INK}>{r.position}</text>
          </g>
        </g>
      ))}
    </svg>
  );
}
