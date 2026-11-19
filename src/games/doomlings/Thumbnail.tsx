// Home tile: an evolved weirdo climbing out of a glowing petri dish while a
// meteor comes in for World's End. Imports only the tiny shapes helpers and
// useSvgIds (kit/hooks), since module.ts — and so the main bundle — loads it.

import { seededRandom } from '@/core/rng';
import { useSvgIds } from '@/ui/kit/hooks';
import { HUE, blobPath, wavyPath } from './shapes';

const INK = '#03100b';

export function DmThumbnail() {
  const id = useSvgIds();
  const rand = seededRandom(20261118);
  const body = blobPath(80, 58, 24, 11, 0.07, rand, 0.92);
  const floaters: [number, number, number, keyof typeof HUE][] = [
    [22, 70, 6, 'red'], [36, 82, 4.5, 'blue'], [128, 76, 5.5, 'purple'], [140, 64, 3.5, 'green'], [112, 86, 3.8, 'red'],
  ];
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label="Doomlings" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={id('sky')} cx="50%" cy="85%" r="95%">
          <stop offset="0" stopColor="#12493a" />
          <stop offset="0.55" stopColor="#081a22" />
          <stop offset="1" stopColor="#0a0616" />
        </radialGradient>
        <radialGradient id={id('ooze')} cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#c6ff8a" />
          <stop offset="0.5" stopColor="#46e07f" />
          <stop offset="1" stopColor="#0a4d2b" />
        </radialGradient>
        <radialGradient id={id('body')} cx="36%" cy="28%" r="80%">
          <stop offset="0" stopColor="#e4ffd0" />
          <stop offset="0.42" stopColor="#7cf05a" />
          <stop offset="1" stopColor="#3a1070" />
        </radialGradient>
        <linearGradient id={id('trail')} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff7c2" stopOpacity={0} />
          <stop offset="1" stopColor="#ffd23f" />
        </linearGradient>
      </defs>
      <rect width={160} height={100} fill={id.url('sky')} />
      {Array.from({ length: 18 }, (_, i) => (
        <circle key={i} cx={(rand() * 160).toFixed(1)} cy={(rand() * 40).toFixed(1)} r={(0.4 + rand() * 0.8).toFixed(1)} fill="#eafff2" opacity={0.7} />
      ))}
      {/* the meteor */}
      <path d="M160 -4 L118 30" stroke={id.url('trail')} strokeWidth={9} strokeLinecap="round" opacity={0.55} />
      <path d="M160 -4 L120 28" stroke="#fff7c2" strokeWidth={2.6} strokeLinecap="round" />
      <circle cx={119} cy={29} r={6} fill="#ff5a3d" stroke="#fff7c2" strokeWidth={1.8} />

      {/* petri dish: back rim, ooze, front rim */}
      <ellipse cx={80} cy={86} rx={74} ry={18} fill="#03100b" stroke="#8cff5a" strokeOpacity={0.55} strokeWidth={2} />
      <ellipse cx={80} cy={86} rx={68} ry={14} fill={id.url('ooze')} opacity={0.9} />
      {floaters.map(([x, y, r, c], i) => (
        <g key={i}>
          <path d={blobPath(x, y, r, 7, 0.14, rand)} fill={HUE[c].core} stroke={HUE[c].glow} strokeWidth={1} />
          <circle cx={x + r * 0.2} cy={y - r * 0.1} r={r * 0.35} fill={HUE[c].deep} />
        </g>
      ))}

      {/* the creature */}
      <circle cx={80} cy={52} r={38} fill="none" stroke={HUE.purple.glow} strokeOpacity={0.35} strokeWidth={1.4} strokeDasharray="5 4" />
      {[-1, 1].map((side) => (
        <path key={`t${side}`} d={wavyPath(80 + side * 18, 74, Math.PI / 2 + side * 0.9, 16, 3, 2)} fill="none" stroke={HUE.blue.core} strokeWidth={4} strokeLinecap="round" />
      ))}
      {[-0.95, -0.55, -0.15, 0.25, 0.65].map((o, i) => {
        const a = -Math.PI / 2 + o * 0.9;
        const b = 0.13;
        const p = (k: number, d: number) => `${(80 + Math.cos(k) * d).toFixed(1)} ${(58 + Math.sin(k) * d * 0.92).toFixed(1)}`;
        return <path key={`s${i}`} d={`M${p(a - b, 23)} L${p(a, 34 + (i % 2) * 3)} L${p(a + b, 23)} Z`} fill={HUE.red.core} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />;
      })}
      <path d="M100 42 q12 -8 14 -20 q-10 4 -14 20 Z" fill={HUE.green.core} stroke={INK} strokeWidth={1.3} />
      <path d={body} fill={id.url('body')} stroke={INK} strokeWidth={2.6} />
      <ellipse cx={80} cy={67} rx={13} ry={7} fill="#ffffff" opacity={0.16} />
      {[[70, 50], [80, 46], [90, 50]].map(([x, y], i) => (
        <g key={`e${i}`}>
          <circle cx={x} cy={y} r={4.6} fill="#fbfff9" stroke={INK} strokeWidth={1.4} />
          <circle cx={x! + 1} cy={y! + 0.8} r={2.2} fill={INK} />
          <circle cx={x! + 1.8} cy={y! - 0.3} r={0.8} fill="#fff" />
        </g>
      ))}
      <path d="M71 59 Q80 69 89 59 Z" fill={INK} />
      <path d="M73 59.6 l2 2.8 l2 -2.8 l2 2.8 l2 -2.8 l2 2.8 l2 -2.8 l1.6 2.2" fill="none" stroke="#fff" strokeWidth={0.9} />
      <circle cx={63} cy={62} r={2.8} fill={HUE.purple.core} stroke={INK} strokeWidth={0.8} />
      <circle cx={97} cy={64} r={2.2} fill={HUE.blue.core} stroke={INK} strokeWidth={0.8} />
      <g transform="translate(80 29) scale(1.15)">
        <path d="M-10 4 L-11 -6 L-5 -1 L0 -9 L5 -1 L11 -6 L10 4 Z" fill="#ffd23f" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
        <rect x={-10} y={3} width={20} height={3.4} rx={1.2} fill="#ffb800" stroke={INK} strokeWidth={1.1} />
        <circle cx={0} cy={-9} r={1.6} fill="#ff4f6d" stroke={INK} strokeWidth={0.8} />
      </g>
      {/* front rim of the dish, over the creature's base */}
      <path d="M6 86 A74 18 0 0 0 154 86" fill="none" stroke="#c2ffd3" strokeOpacity={0.75} strokeWidth={2.4} />
      <path d="M22 92 A64 12 0 0 0 76 103" fill="none" stroke="#ffffff" strokeOpacity={0.35} strokeWidth={1.6} />
    </svg>
  );
}
