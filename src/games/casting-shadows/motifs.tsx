// Name-driven motifs: what a spell *is*, drawn over its element's sky. The
// first pattern matching a card's kind wins; cards with no match fall back to
// their element emblem (art.tsx). Same 100×100 canvas, same ink, drawn in the
// element's palette so motif and border always agree.

import type { ReactNode } from 'react';

const INK = '#060b16';

export interface MotifPalette {
  main: string;
  glow: string;
  deep: string;
}

type Draw = (c: MotifPalette) => ReactNode;

const ink = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function star(cx: number, cy: number, r: number, n: number, inner: number): string {
  return Array.from({ length: n * 2 }, (_, i) => {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    return `${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
}

const LEAF = 'M50 84 C40 64 40 40 50 22 C60 40 60 64 50 84 Z';
const GEM = (x: number, y: number, s: number) => `${x},${y - 14 * s} ${x + 11 * s},${y - 4 * s} ${x},${y + 16 * s} ${x - 11 * s},${y - 4 * s}`;

const bubbles: Draw = (c) => (
  <g {...ink}>
    <circle cx={40} cy={60} r={16} fill={c.main} />
    <circle cx={64} cy={42} r={11} fill={c.main} />
    <circle cx={63} cy={70} r={7} fill={c.main} />
    <circle cx={34} cy={54} r={4} fill={c.glow} stroke="none" />
    <circle cx={61} cy={38} r={3} fill={c.glow} stroke="none" />
  </g>
);

const veil: Draw = (c) => (
  <g {...ink}>
    <path d="M50 16 C72 22 80 46 76 86 L24 86 C20 46 28 22 50 16 Z" fill={c.main} />
    <path d="M40 86 Q44 60 50 56 Q56 60 60 86" fill={c.deep} strokeWidth={1.4} />
    <ellipse cx={50} cy={44} rx={13} ry={11} fill={INK} />
    <circle cx={45} cy={44} r={2.6} fill={c.glow} stroke="none" />
    <circle cx={55} cy={44} r={2.6} fill={c.glow} stroke="none" />
  </g>
);

const fronds: Draw = (c) => (
  <g {...ink}>
    {[-36, 0, 36].map((a) => (
      <g key={a} transform={`rotate(${a} 50 84)`}>
        <path d={LEAF} fill={c.main} />
        <path d="M50 80 L50 30" stroke={c.glow} strokeWidth={1.6} />
      </g>
    ))}
  </g>
);

const fangs: Draw = (c) => (
  <g {...ink}>
    <path d="M18 34 Q50 20 82 34 L82 42 Q50 30 18 42 Z" fill={c.main} />
    <path d="M18 70 Q50 84 82 70 L82 62 Q50 74 18 62 Z" fill={c.main} />
    {[28, 40, 52, 64].map((x, i) => <polygon key={x} points={`${x},${36 - (i % 2)} ${x + 8},${35} ${x + 4},${54 - (i === 1 || i === 2 ? 4 : 0)}`} fill="#f4fbff" strokeWidth={1.6} />)}
    {[32, 46, 58].map((x) => <polygon key={x} points={`${x},68 ${x + 8},68 ${x + 4},54`} fill="#f4fbff" strokeWidth={1.6} />)}
  </g>
);

const waves: Draw = (c) => (
  <g fill="none" strokeLinecap="round">
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <path d={`M${20 + i * 6} ${76 - i * 2} Q50 ${30 + i * 10} ${80 - i * 6} ${76 - i * 2}`} stroke={INK} strokeWidth={8} />
        <path d={`M${20 + i * 6} ${76 - i * 2} Q50 ${30 + i * 10} ${80 - i * 6} ${76 - i * 2}`} stroke={i === 1 ? c.glow : c.main} strokeWidth={4.4} />
      </g>
    ))}
  </g>
);

const palm: Draw = (c) => (
  <g {...ink}>
    <path d="M32 86 L32 56 Q32 50 38 50 L62 50 Q68 50 68 56 L68 86 Z" fill={c.main} />
    {[34, 43, 52, 61].map((x, i) => <rect key={x} x={x} y={22 + (i === 0 || i === 3 ? 8 : 0)} width={8} height={34 - (i === 0 || i === 3 ? 8 : 0)} rx={4} fill={c.main} />)}
    <path d="M32 66 Q20 60 20 50 Q22 46 26 48 L34 58" fill={c.main} />
    <path d="M40 72 Q50 78 60 72" fill="none" stroke={c.glow} strokeWidth={1.8} />
  </g>
);

const phoenix: Draw = (c) => (
  <g {...ink}>
    <path d="M50 54 Q30 30 12 34 Q24 42 26 52 Q16 52 12 60 Q30 62 46 62 Z" fill={c.main} />
    <path d="M50 54 Q70 30 88 34 Q76 42 74 52 Q84 52 88 60 Q70 62 54 62 Z" fill={c.main} />
    <path d="M46 60 Q42 76 50 88 Q58 76 54 60 Z" fill={c.glow} />
    <circle cx={50} cy={44} r={7} fill={c.glow} />
    <path d="M50 37 Q46 28 50 22 Q54 28 50 37" fill={c.main} />
  </g>
);

const burst: Draw = (c) => (
  <g {...ink}>
    <polygon points={star(50, 52, 34, 10, 0.5)} fill={c.main} />
    <polygon points={star(50, 52, 18, 8, 0.55)} fill={c.glow} strokeWidth={1.6} />
  </g>
);

const arrows: Draw = (c) => (
  <g {...ink}>
    {Array.from({ length: 6 }, (_, i) => (
      <g key={i} transform={`rotate(${i * 60} 50 52)`}>
        <path d="M50 44 L50 22" stroke={INK} strokeWidth={6} />
        <path d="M50 44 L50 22" stroke={c.main} strokeWidth={3} />
        <polygon points="50,14 57,25 43,25" fill={c.glow} strokeWidth={1.6} />
      </g>
    ))}
    <circle cx={50} cy={52} r={8} fill={c.glow} />
  </g>
);

const bolt: Draw = (c) => (
  <g {...ink}>
    <polygon points="56,12 30,56 48,56 40,90 72,42 54,42 64,12" fill={c.glow} />
    <polygon points="56,12 30,56 48,56 52,40 64,12" fill={c.main} strokeWidth={0} />
  </g>
);

const critters: Draw = (c) => (
  <g {...ink}>
    {[[34, 40, -20], [64, 34, 15], [54, 66, -5]].map(([x, y, r]) => (
      <g key={x} transform={`translate(${x} ${y}) rotate(${r})`}>
        <ellipse cx={-7} cy={-6} rx={8} ry={5} fill={c.glow} fillOpacity={0.85} strokeWidth={1.4} />
        <ellipse cx={7} cy={-6} rx={8} ry={5} fill={c.glow} fillOpacity={0.85} strokeWidth={1.4} />
        <ellipse cx={0} cy={0} rx={5} ry={9} fill={c.main} />
        <circle cx={0} cy={-9} r={3.4} fill={INK} stroke="none" />
      </g>
    ))}
  </g>
);

const rings: Draw = (c) => (
  <g fill="none">
    {[34, 24, 14].map((r, i) => <circle key={r} cx={50} cy={52} r={r} stroke={i === 1 ? c.glow : c.main} strokeWidth={4} strokeDasharray={i === 0 ? '10 6' : undefined} />)}
    <circle cx={50} cy={52} r={6} fill={c.glow} stroke={INK} strokeWidth={2} />
  </g>
);

const spikes: Draw = (c) => (
  <g {...ink}>
    {[-48, -24, 0, 24, 48].map((a) => <polygon key={a} points="50,14 57,52 43,52" fill={a === 0 ? c.glow : c.main} transform={`rotate(${a} 50 72)`} />)}
    <path d="M22 76 Q50 60 78 76 Q50 90 22 76 Z" fill={c.main} />
  </g>
);

const screech: Draw = (c) => (
  <g>
    <polygon points="22,46 46,52 22,60" fill={c.glow} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
    {[0, 1, 2].map((i) => (
      <path key={i} d={`M${54 + i * 9} ${32 - i * 6} Q${66 + i * 10} 52 ${54 + i * 9} ${72 + i * 6}`} fill="none" stroke={c.main} strokeWidth={4.4} strokeLinecap="round" />
    ))}
  </g>
);

const skull: Draw = (c) => (
  <g {...ink}>
    <path d="M26 50 C26 28 38 18 50 18 C62 18 74 28 74 50 C74 60 68 64 66 70 L34 70 C32 64 26 60 26 50 Z" fill={c.main} />
    <rect x={36} y={68} width={28} height={14} rx={4} fill={c.main} />
    <ellipse cx={40} cy={48} rx={7} ry={8} fill={INK} />
    <ellipse cx={60} cy={48} rx={7} ry={8} fill={INK} />
    <circle cx={40} cy={48} r={2.4} fill={c.glow} stroke="none" />
    <circle cx={60} cy={48} r={2.4} fill={c.glow} stroke="none" />
    <path d="M47 62 L50 56 L53 62 Z M44 70 V82 M50 70 V82 M56 70 V82" fill={INK} strokeWidth={1.6} />
  </g>
);

const horn: Draw = (c) => (
  <g {...ink}>
    <polygon points="54,12 66,84 38,84" fill={c.glow} />
    {[30, 44, 58, 72].map((y, i) => <path key={y} d={`M${41 + i * 1.5} ${y + 10} L${63 - i * 2} ${y - 2}`} stroke={c.main} strokeWidth={2.6} />)}
    <circle cx={30} cy={30} r={3} fill={c.main} />
    <circle cx={74} cy={44} r={2.4} fill={c.main} />
  </g>
);

const cluster: Draw = (c) => (
  <g {...ink}>
    <polygon points={GEM(36, 58, 1.1)} fill={c.main} />
    <polygon points={GEM(64, 58, 1.1)} fill={c.main} />
    <polygon points={GEM(50, 44, 1.4)} fill={c.glow} />
    <path d="M38.6 39.6 L50 30 L61.4 39.6" fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={1.4} />
  </g>
);

const cursed: Draw = (c) => (
  <g {...ink}>
    <polygon points="34,18 66,18 78,52 66,86 34,86 22,52" fill={c.deep} />
    <polygon points="34,18 66,18 58,34 42,34" fill={c.main} />
    <ellipse cx={40} cy={54} rx={7} ry={8} fill={c.main} stroke="none" />
    <ellipse cx={60} cy={54} rx={7} ry={8} fill={c.main} stroke="none" />
    <path d="M66 18 L58 34 L64 46 L56 60" fill="none" stroke={c.glow} strokeWidth={1.4} />
  </g>
);

const bloom: Draw = (c) => (
  <g {...ink}>
    {Array.from({ length: 6 }, (_, i) => <ellipse key={i} cx={50} cy={32} rx={9} ry={17} fill={i % 2 ? c.main : c.glow} transform={`rotate(${i * 60} 50 52)`} />)}
    <circle cx={50} cy={52} r={9} fill={c.deep} />
  </g>
);

const twins: Draw = (c) => (
  <g {...ink}>
    <polygon points={GEM(38, 54, 1.6)} fill={c.main} />
    <polygon points={GEM(62, 50, 1.6)} fill={c.glow} fillOpacity={0.9} />
    <path d="M44 84 Q50 90 56 84" fill="none" stroke={c.glow} strokeWidth={2.4} />
  </g>
);

const sun: Draw = (c) => (
  <g {...ink}>
    {Array.from({ length: 12 }, (_, i) => <polygon key={i} points="50,12 54,26 46,26" fill={c.glow} transform={`rotate(${i * 30} 50 52)`} strokeWidth={1.2} />)}
    <circle cx={50} cy={52} r={19} fill={c.main} />
    <circle cx={44} cy={46} r={6} fill="#fff" fillOpacity={0.5} stroke="none" />
  </g>
);

const swirl: Draw = (c) => (
  <g fill="none" strokeLinecap="round">
    <path d="M50 52 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 0 1 8 -8 a12 12 0 0 1 12 12 a16 16 0 0 1 -16 16 a22 22 0 0 1 -22 -22 a28 28 0 0 1 28 -28" stroke={INK} strokeWidth={8} />
    <path d="M50 52 m0 -4 a4 4 0 1 1 -4 4 a8 8 0 0 1 8 -8 a12 12 0 0 1 12 12 a16 16 0 0 1 -16 16 a22 22 0 0 1 -22 -22 a28 28 0 0 1 28 -28" stroke={c.main} strokeWidth={4} />
    <circle cx={50} cy={24} r={5} fill={c.glow} stroke={INK} strokeWidth={2} />
  </g>
);

const flask: Draw = (c) => (
  <g {...ink}>
    <path d="M42 18 H58 V36 Q76 44 76 62 Q76 84 50 84 Q24 84 24 62 Q24 44 42 36 Z" fill="#cfe9f2" fillOpacity={0.25} />
    <path d="M27 62 Q50 54 73 62 Q73 82 50 82 Q27 82 27 62 Z" fill={c.main} strokeWidth={0} />
    <polygon points={GEM(50, 66, 0.8)} fill={c.glow} strokeWidth={1.6} />
    <path d="M40 18 H60" strokeWidth={3} />
  </g>
);

const icicles: Draw = (c) => (
  <g {...ink}>
    <rect x={14} y={20} width={72} height={10} rx={4} fill={c.main} />
    {[[20, 54], [32, 74], [44, 60], [56, 82], [68, 58], [78, 46]].map(([x, len]) => <polygon key={x} points={`${x - 5},30 ${x + 5},30 ${x},${len}`} fill={c.glow} />)}
  </g>
);

const avalanche: Draw = (c) => (
  <g {...ink}>
    <polygon points="12,86 44,26 88,86" fill={c.deep} />
    <polygon points="44,26 56,48 48,44 40,52 32,48" fill={c.glow} />
    <circle cx={64} cy={58} r={7} fill={c.glow} />
    <circle cx={74} cy={72} r={5} fill={c.glow} />
    <circle cx={56} cy={76} r={4} fill={c.main} />
  </g>
);

const blade: Draw = (c) => (
  <g {...ink}>
    <path d="M78 14 L84 20 L40 64 L34 58 Z" fill={c.glow} />
    <path d="M78 14 L84 20 L60 44 Z" fill="#fff" fillOpacity={0.6} strokeWidth={0} />
    <rect x={26} y={56} width={22} height={6} rx={2} fill={c.main} transform="rotate(45 37 59)" />
    <path d="M34 66 L20 80" stroke={c.main} strokeWidth={7} />
    <path d="M34 66 L20 80" stroke={INK} strokeWidth={1} strokeDasharray="2 3" />
  </g>
);

const tornado: Draw = (c) => (
  <g {...ink}>
    {[[50, 22, 30], [52, 36, 24], [50, 50, 18], [54, 62, 12], [52, 74, 7]].map(([x, y, rx], i) => <ellipse key={y} cx={x} cy={y} rx={rx} ry={5} fill={i % 2 ? c.glow : c.main} />)}
  </g>
);

const cracked: Draw = (c) => (
  <g {...ink}>
    <polygon points="12,58 44,46 88,54 84,80 16,82" fill={c.main} />
    <path d="M50 46 L44 58 L54 64 L46 82" fill="none" stroke={INK} strokeWidth={3} />
    <polygon points="30,36 36,22 42,36" fill={c.glow} />
    <polygon points="62,34 70,16 76,34" fill={c.glow} />
  </g>
);

const vortex: Draw = (c) => (
  <g fill="none" strokeLinecap="round">
    {[34, 26, 18, 10].map((r, i) => (
      <path key={r} d={`M${50 + r} 52 A${r} ${r} 0 1 0 ${50} ${52 + r}`} stroke={i % 2 ? c.glow : c.main} strokeWidth={4.4} transform={`rotate(${i * 50} 50 52)`} />
    ))}
    <circle cx={50} cy={52} r={4} fill={c.glow} />
  </g>
);

const vines: Draw = (c) => (
  <g strokeLinecap="round">
    <path d="M20 84 C20 50 60 66 54 40 C50 26 34 28 38 18" fill="none" stroke={INK} strokeWidth={7} />
    <path d="M20 84 C20 50 60 66 54 40 C50 26 34 28 38 18" fill="none" stroke={c.main} strokeWidth={3.6} />
    <path d="M80 84 C80 60 56 70 62 50" fill="none" stroke={INK} strokeWidth={7} />
    <path d="M80 84 C80 60 56 70 62 50" fill="none" stroke={c.main} strokeWidth={3.6} />
    {[[32, 60, -30], [56, 46, 40], [70, 66, -50], [40, 26, 20]].map(([x, y, r]) => (
      <ellipse key={x} cx={x} cy={y} rx={4} ry={8} fill={c.glow} stroke={INK} strokeWidth={1.6} transform={`rotate(${r} ${x} ${y})`} />
    ))}
  </g>
);

const volcano: Draw = (c) => (
  <g {...ink}>
    <polygon points="14,86 40,38 60,38 86,86" fill={c.deep} />
    <path d="M40 38 Q50 46 60 38 L58 52 Q52 60 54 86 L46 86 Q48 60 42 52 Z" fill={c.main} strokeWidth={1.6} />
    <path d="M44 32 Q36 20 46 12 Q48 22 54 18 Q50 26 56 30" fill={c.glow} strokeWidth={1.6} />
  </g>
);

const plates: Draw = (c) => {
  const hex = (x: number, y: number) => Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(x + Math.cos(a) * 12).toFixed(1)},${(y + Math.sin(a) * 12).toFixed(1)}`;
  }).join(' ');
  return (
    <g {...ink}>
      {[[50, 52], [32, 42], [68, 42], [32, 62], [68, 62], [50, 32], [50, 72]].map(([x, y], i) => <polygon key={i} points={hex(x!, y!)} fill={i === 0 ? c.glow : c.main} strokeWidth={1.8} />)}
    </g>
  );
};

const heart: Draw = (c) => (
  <g {...ink}>
    <path d="M50 84 C24 64 16 50 22 36 C28 22 46 24 50 38 C54 24 72 22 78 36 C84 50 76 64 50 84 Z" fill={c.main} />
    <path d="M30 40 Q34 32 42 34" fill="none" stroke="#fff" strokeOpacity={0.7} strokeWidth={2.4} />
    <path d="M50 46 V66 M40 56 H60" stroke={c.glow} strokeWidth={4} />
  </g>
);

const embers: Draw = (c) => (
  <g {...ink}>
    <path d="M30 84 Q50 64 70 84 Z" fill={c.main} />
    {[[40, 58, 1], [56, 44, 1.3], [46, 30, 0.9], [64, 24, 0.7], [32, 40, 0.8]].map(([x, y, s]) => <polygon key={x} points={`${x},${y! - 7 * s!} ${x! + 4 * s!},${y} ${x},${y! + 7 * s!} ${x! - 4 * s!},${y}`} fill={c.glow} strokeWidth={1.4} />)}
  </g>
);

const orbits: Draw = (c) => (
  <g>
    <ellipse cx={50} cy={52} rx={34} ry={14} fill="none" stroke={c.main} strokeWidth={2} transform="rotate(-20 50 52)" />
    <circle cx={50} cy={52} r={14} fill={c.main} stroke={INK} strokeWidth={2.2} />
    <circle cx={45} cy={47} r={4.5} fill="#fff" fillOpacity={0.6} />
    {[[20, 62], [80, 42], [60, 66]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={6} fill={c.glow} stroke={INK} strokeWidth={2} />)}
  </g>
);

const spikedShield: Draw = (c) => (
  <g {...ink}>
    <path d="M50 18 L78 28 C78 56 70 74 50 88 C30 74 22 56 22 28 Z" fill={c.main} />
    <polygon points="50,30 58,56 50,50 42,56" fill={c.glow} />
    {[[22, 28], [78, 28]].map(([x, y]) => <polygon key={x} points={`${x},${y} ${x! + (x === 22 ? -8 : 8)},${y! - 10} ${x! + (x === 22 ? 6 : -6)},${y! - 4}`} fill={c.glow} strokeWidth={1.6} />)}
  </g>
);

const footsteps: Draw = (c) => (
  <g {...ink}>
    {[[34, 66, -14], [58, 40, 10]].map(([x, y, r]) => (
      <g key={x} transform={`rotate(${r} ${x} ${y})`}>
        <ellipse cx={x} cy={y} rx={8} ry={12} fill={c.main} />
        {[-7, -2.5, 2.5, 7].map((dx) => <circle key={dx} cx={x! + dx} cy={y! - 16} r={2.6} fill={c.main} />)}
      </g>
    ))}
    <path d="M62 76 H86 M78 68 L86 76 L78 84" fill="none" stroke={c.glow} strokeWidth={3.4} />
  </g>
);

const bees: Draw = (c) => (
  <g {...ink}>
    {[[38, 44, -15], [64, 58, 12], [40, 72, 5]].map(([x, y, r]) => (
      <g key={x} transform={`translate(${x} ${y}) rotate(${r})`}>
        <ellipse cx={-4} cy={-9} rx={6} ry={5} fill="#fff" fillOpacity={0.8} strokeWidth={1.2} />
        <ellipse cx={5} cy={-9} rx={6} ry={5} fill="#fff" fillOpacity={0.8} strokeWidth={1.2} />
        <ellipse cx={0} cy={0} rx={11} ry={7.5} fill="#ffd36b" />
        <path d="M-3 -7 V7 M4 -6.5 V6.5" stroke={INK} strokeWidth={3} />
      </g>
    ))}
    <circle cx={74} cy={30} r={3} fill={c.glow} />
  </g>
);

const dome: Draw = (c) => (
  <g {...ink}>
    <path d="M14 76 A36 36 0 0 1 86 76 Z" fill={c.main} fillOpacity={0.55} />
    <path d="M22 76 A28 28 0 0 1 78 76" fill="none" stroke={c.glow} strokeWidth={1.6} strokeDasharray="3 3" />
    <path d="M10 76 H90" strokeWidth={3.4} />
    <path d="M30 52 Q36 44 44 42" fill="none" stroke="#fff" strokeOpacity={0.8} strokeWidth={2.4} />
  </g>
);

const wall: Draw = (c) => (
  <g {...ink}>
    {[0, 1, 2, 3].map((row) => [0, 1, 2].map((col) => (
      <rect key={`${row}${col}`} x={18 + col * 22 - (row % 2) * 11} y={22 + row * 16} width={22} height={16} fill={(row + col) % 2 ? c.main : c.glow} strokeWidth={1.8} />
    )))}
  </g>
);

const mirror: Draw = (c) => (
  <g {...ink}>
    <ellipse cx={50} cy={46} rx={24} ry={30} fill={c.deep} strokeWidth={5} stroke={c.main} />
    <ellipse cx={50} cy={46} rx={24} ry={30} fill="none" />
    <path d="M38 30 L48 22 M36 44 L58 26" stroke={c.glow} strokeWidth={3} />
    <rect x={46} y={76} width={8} height={12} rx={2} fill={c.main} />
  </g>
);

const fist: Draw = (c) => (
  <g {...ink}>
    <rect x={26} y={34} width={48} height={34} rx={12} fill={c.main} />
    {[30, 41, 52, 63].map((x) => <path key={x} d={`M${x} 34 Q${x + 5} 28 ${x + 10} 34`} fill="none" strokeWidth={1.6} />)}
    <path d="M26 52 Q18 50 22 42 Q28 38 38 44" fill={c.main} />
    <rect x={34} y={66} width={32} height={18} rx={4} fill={c.main} />
    <path d="M18 24 L26 30 M82 24 L74 30 M50 14 V22" stroke={c.glow} strokeWidth={3} />
  </g>
);

const smoke: Draw = (c) => (
  <g {...ink}>
    {[[34, 64, 14], [56, 60, 16], [44, 42, 13], [64, 36, 10], [30, 36, 8]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill={i % 2 ? c.main : c.glow} fillOpacity={0.9} strokeWidth={1.6} />)}
  </g>
);

const retaliate: Draw = (c) => (
  <g strokeLinecap="round" strokeLinejoin="round">
    <path d="M72 30 A28 28 0 1 0 74 66" fill="none" stroke={INK} strokeWidth={9} />
    <path d="M72 30 A28 28 0 1 0 74 66" fill="none" stroke={c.main} strokeWidth={5} />
    <polygon points="64,62 86,64 76,82" fill={c.glow} stroke={INK} strokeWidth={2.2} />
  </g>
);

const meteor: Draw = (c) => (
  <g strokeLinecap="round">
    {[0, 1, 2].map((i) => <path key={i} d={`M${82 - i * 8} ${14 + i * 2} L${50 - i * 4} ${46 + i * 6}`} stroke={i === 1 ? c.glow : c.main} strokeWidth={6 - i} />)}
    <circle cx={40} cy={60} r={18} fill={c.main} stroke={INK} strokeWidth={2.2} />
    <circle cx={34} cy={56} r={4} fill={INK} opacity={0.5} />
    <circle cx={46} cy={66} r={3} fill={INK} opacity={0.5} />
  </g>
);

const MOTIFS: [RegExp, Draw][] = [
  [/bubble/, bubbles],
  [/shroud/, veil],
  [/frond/, fronds],
  [/frenzy|fang/, fangs],
  [/heat-wave|kinetic-wave/, waves],
  [/hand|slap/, palm],
  [/phoenix/, phoenix],
  [/pyro|burst/, burst],
  [/kinetic/, arrows],
  [/lightning|electric|shocking/, bolt],
  [/bug|flock|swarm/, critters],
  [/personal-space/, rings],
  [/psychic|spike/, spikes],
  [/screech/, screech],
  [/sudden-doom/, skull],
  [/cataclysm/, meteor],
  [/unicorn/, horn],
  [/crystalli|jewel|gemeration/, cluster],
  [/curse/, cursed],
  [/bloom/, bloom],
  [/duplication|mutation/, twins],
  [/glow|luminous/, sun],
  [/metamorph|alchemy|orbulence/, swirl],
  [/synthesis|infusion/, flask],
  [/glacial|blizzard/, icicles],
  [/avalanche|arctic/, avalanche],
  [/katana/, blade],
  [/twister/, tornado],
  [/earth|ground/, cracked],
  [/vort/, vortex],
  [/vine|draining/, vines],
  [/volcan/, volcano],
  [/carapace/, plates],
  [/mend/, heart],
  [/ember/, embers],
  [/absorption/, orbits],
  [/pointed-shield|magma-shield/, spikedShield],
  [/run-away/, footsteps],
  [/bees/, bees],
  [/dome/, dome],
  [/ice-wall/, wall],
  [/mirror/, mirror],
  [/fist/, fist],
  [/smoke/, smoke],
  [/retaliation/, retaliate],
];

/** The motif for a card kind, or null when its element emblem should stand alone. */
export function motifFor(kind: string): Draw | null {
  for (const [re, draw] of MOTIFS) if (re.test(kind)) return draw;
  return null;
}
