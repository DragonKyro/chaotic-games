// Happy Little Dinosaurs — card art: one doodle per Point / Instant kind,
// disaster scenes by category (a keyword picks the variant: a flood isn't a
// sinkhole), hazards by penalty, and the two card backs.
//
// Everything is drawn on a 0 0 100 100 canvas in the same flat, fat-outline
// Saturday-morning style as the dinos (DinoArt.tsx). No filters, no rasters.

import { hashString } from '@/core/rng';
import type { ReactNode } from 'react';
import { INK } from './DinoArt';
import type { HldCardKind, HldDisasterCategory, HldHazardPenalty } from './types';

// ============================================================================
// Palette
// ============================================================================

export const CATEGORY_COLOR: Record<HldDisasterCategory, string> = {
  natural: '#5cbf3e',
  predator: '#ff4d4d',
  emotional: '#4f8dff',
  meteor: '#b35cff',
};

export const CATEGORY_LABEL: Record<HldDisasterCategory, string> = {
  natural: 'Natural',
  predator: 'Predatory',
  emotional: 'Emotional',
  meteor: 'Meteor',
};

/** Colour of a Point card's number badge: dull low, hot high. */
export function valueColor(v: number): string {
  if (v >= 8) return '#ff4d4d';
  if (v >= 6) return '#ff9f1c';
  if (v >= 4) return '#ffd23f';
  if (v >= 2) return '#5cc9a7';
  return '#9aa3b5';
}

const TINTS = ['#bfe9ff', '#ffe3a8', '#d7f7c2', '#ffd2e4', '#e4d7ff', '#ffe0c7', '#c9f3ee', '#fff1a8'];
export const tintOf = (kind: string) => TINTS[hashString(kind) % TINTS.length]!;

// ============================================================================
// Shared bits
// ============================================================================

const S = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function Heart({ x, y, r, fill = '#ff5f9e' }: { x: number; y: number; r: number; fill?: string }) {
  return (
    <path
      d={`M${x} ${y + r * 0.9} C${x - r * 1.6} ${y - r * 0.1} ${x - r * 0.9} ${y - r * 1.3} ${x} ${y - r * 0.45} C${x + r * 0.9} ${y - r * 1.3} ${x + r * 1.6} ${y - r * 0.1} ${x} ${y + r * 0.9} Z`}
      fill={fill}
      {...S}
    />
  );
}

function Flame({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 -16 C8 -8 10 -2 8 4 C6 10 -6 10 -8 4 C-10 -2 -6 -6 -4 -10 C-2 -6 0 -6 0 -16 Z" fill="#ff7a1a" {...S} strokeWidth={2.4} />
      <path d="M0 -6 C4 -2 4 2 2 5 C0 7 -3 6 -3 3 C-3 0 -1 -2 0 -6 Z" fill="#ffd23f" />
    </g>
  );
}

function Star({ x, y, r, fill = '#ffd23f' }: { x: number; y: number; r: number; fill?: string }) {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    pts.push(`${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`);
  }
  return <polygon points={pts.join(' ')} fill={fill} {...S} />;
}

function Bottle({ color, label, cap = '#8a5a2b' }: { color: string; label?: string; cap?: string }) {
  return (
    <g>
      <path d="M42 18 H58 V32 C66 36 70 44 70 54 V84 C70 88 66 90 62 90 H38 C34 90 30 88 30 84 V54 C30 44 34 36 42 32 Z" fill={color} {...S} />
      <rect x={40} y={12} width={20} height={9} rx={2} fill={cap} {...S} />
      <rect x={34} y={56} width={32} height={18} rx={3} fill={label ?? '#fff8e7'} {...S} strokeWidth={2.4} />
      <path d="M38 40 C38 36 40 34 44 33" stroke="#fff" strokeWidth={3} opacity={0.6} fill="none" strokeLinecap="round" />
    </g>
  );
}

// ============================================================================
// Point & Instant doodles
// ============================================================================

const DOODLES: Partial<Record<HldCardKind, () => ReactNode>> = {
  // ---- base Point cards
  'flaming-chainsaw': () => (
    <g>
      <rect x={22} y={44} width={30} height={22} rx={5} fill="#ff6b4a" {...S} />
      <path d="M52 48 H86 C90 48 92 52 90 56 L86 62 H52 Z" fill="#cfd8e3" {...S} />
      <path d="M56 48 L58 44 L61 48 L64 44 L67 48 L70 44 L73 48 L76 44 L79 48 L82 44 L85 48" fill="none" stroke={INK} strokeWidth={2.2} />
      <path d="M24 48 Q16 54 24 62" fill="none" {...S} strokeWidth={5} />
      <Flame x={70} y={42} s={1.1} />
      <Flame x={84} y={44} s={0.8} />
    </g>
  ),
  'meteor-cannon': () => (
    <g>
      <path d="M20 70 L62 44 L70 58 L28 82 Z" fill="#6b7a8f" {...S} />
      <circle cx={30} cy={80} r={9} fill="#8a5a2b" {...S} />
      <path d="M72 34 L92 18" stroke="#ff9f1c" strokeWidth={7} strokeLinecap="round" />
      <path d="M72 34 L92 18" stroke="#ffd23f" strokeWidth={3} strokeLinecap="round" />
      <circle cx={70} cy={38} r={9} fill="#7a4a2a" {...S} />
      <circle cx={67} cy={36} r={2.2} fill="#b37a4a" />
    </g>
  ),
  'hungry-plant': () => (
    <g>
      <path d="M50 90 C48 76 52 66 50 56" fill="none" stroke="#3b963a" strokeWidth={6} strokeLinecap="round" />
      <path d="M50 74 C40 70 34 72 30 78 C38 80 44 78 50 74 Z" fill="#6fd36b" {...S} strokeWidth={2.4} />
      <path d="M26 44 C26 26 74 26 74 44 L60 50 L50 44 L40 50 Z" fill="#ff5f9e" {...S} />
      <path d="M26 46 C30 64 70 64 74 46 L60 52 L50 46 L40 52 Z" fill="#ff5f9e" {...S} />
      <path d="M34 44 L38 49 L42 44 M58 44 L62 49 L66 44" fill="#fff" stroke={INK} strokeWidth={1.6} />
      <circle cx={42} cy={34} r={3} fill="#fff" stroke={INK} strokeWidth={1.6} />
    </g>
  ),
  'iced-ptea': () => (
    <g>
      <path d="M30 26 H70 L64 88 H36 Z" fill="#ffb86b" {...S} />
      <path d="M33 40 H67" stroke="#fff" strokeWidth={2} opacity={0.6} />
      <rect x={38} y={46} width={10} height={10} rx={2} fill="#d9f6ff" {...S} strokeWidth={2} transform="rotate(12 43 51)" />
      <rect x={52} y={56} width={10} height={10} rx={2} fill="#d9f6ff" {...S} strokeWidth={2} transform="rotate(-10 57 61)" />
      <path d="M56 26 L66 8" {...S} strokeWidth={5} stroke="#ff5f9e" />
      <path d="M66 26 C72 18 82 20 80 28 C78 32 72 30 70 26" fill="#ffd23f" {...S} strokeWidth={2.2} />
    </g>
  ),
  treenoculars: () => (
    <g>
      <path d="M50 92 C50 78 48 70 50 62" stroke="#8a5a2b" strokeWidth={8} strokeLinecap="round" />
      <circle cx={50} cy={36} r={24} fill="#6fd36b" {...S} />
      <circle cx={38} cy={40} r={11} fill="#2a1d16" {...S} />
      <circle cx={62} cy={40} r={11} fill="#2a1d16" {...S} />
      <circle cx={38} cy={40} r={6} fill="#8fdcff" />
      <circle cx={62} cy={40} r={6} fill="#8fdcff" />
      <circle cx={36} cy={38} r={2} fill="#fff" />
      <circle cx={60} cy={38} r={2} fill="#fff" />
    </g>
  ),
  'sting-stabber': () => (
    <g>
      <path d="M30 82 L74 24 L80 30 L36 88 Z" fill="#cfd8e3" {...S} />
      <path d="M74 24 L88 12 L82 30 Z" fill="#ffd23f" {...S} />
      <rect x={20} y={74} width={16} height={18} rx={4} fill="#ffd23f" {...S} transform="rotate(38 28 83)" />
      <path d="M22 80 L34 90 M26 76 L38 86" stroke={INK} strokeWidth={2.2} />
      <path d="M56 50 L64 58" stroke="#fff" strokeWidth={3} opacity={0.6} />
    </g>
  ),
  'special-star-fruit': () => (
    <g>
      <Star x={50} y={54} r={32} fill="#ffd23f" />
      <path d="M50 54 L50 30 M50 54 L72 46 M50 54 L64 72 M50 54 L36 72 M50 54 L28 46" stroke="#e6a800" strokeWidth={2} />
      <path d="M50 22 C52 14 58 12 62 14" fill="none" stroke="#3b963a" strokeWidth={4} strokeLinecap="round" />
      <circle cx={80} cy={22} r={3} fill="#fff" />
      <circle cx={20} cy={30} r={2} fill="#fff" />
    </g>
  ),
  'bow-and-dino': () => (
    <g>
      <path d="M30 14 C64 30 64 70 30 86" fill="none" stroke="#8a5a2b" strokeWidth={7} strokeLinecap="round" />
      <path d="M30 14 C64 30 64 70 30 86" fill="none" stroke={INK} strokeWidth={1.6} />
      <path d="M30 14 L30 86" stroke={INK} strokeWidth={2} />
      <path d="M22 50 H88" {...S} strokeWidth={4} />
      <path d="M88 50 L78 44 L80 50 L78 56 Z" fill="#cfd8e3" {...S} strokeWidth={2.2} />
      <path d="M22 50 L16 44 M22 50 L16 56" stroke="#ff5f9e" strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  'mouth-trap': () => (
    <g>
      <path d="M14 60 C14 30 86 30 86 60 Z" fill="#9aa3b5" {...S} />
      <path d="M14 60 C14 84 86 84 86 60 Z" fill="#9aa3b5" {...S} />
      <path d="M18 60 L26 48 L34 60 L42 48 L50 60 L58 48 L66 60 L74 48 L82 60" fill="#fff" stroke={INK} strokeWidth={2.2} />
      <path d="M18 60 L26 72 L34 60 L42 72 L50 60 L58 72 L66 60 L74 72 L82 60" fill="#fff" stroke={INK} strokeWidth={2.2} />
      <circle cx={50} cy={22} r={5} fill="#ff4d4d" {...S} strokeWidth={2} />
    </g>
  ),
  'run-home-bat': () => (
    <g>
      <path d="M22 84 L68 20 C72 14 82 18 80 26 L36 90 Z" fill="#d9a066" {...S} />
      <path d="M22 84 L30 92" stroke="#2a1d16" strokeWidth={8} strokeLinecap="round" />
      <path d="M64 30 L74 24" stroke="#fff" strokeWidth={3} opacity={0.5} strokeLinecap="round" />
      <circle cx={80} cy={70} r={10} fill="#fff8e7" {...S} />
      <path d="M74 64 C78 68 78 72 74 76 M86 64 C82 68 82 72 86 76" stroke="#ff4d4d" strokeWidth={1.8} fill="none" />
    </g>
  ),
  'fire-spray': () => (
    <g>
      <rect x={24} y={40} width={22} height={44} rx={6} fill="#ff4d4d" {...S} />
      <rect x={28} y={30} width={14} height={10} rx={2} fill="#2a1d16" />
      <path d="M42 34 H56" {...S} strokeWidth={4} />
      <Flame x={68} y={40} s={1.2} />
      <Flame x={82} y={30} s={0.8} />
      <Flame x={80} y={52} s={0.7} />
    </g>
  ),
  bonehead: () => (
    <g transform="rotate(-24 50 51)">
      {[[28, 45], [28, 57], [72, 45], [72, 57]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={8} fill="#fff8e7" {...S} />)}
      <rect x={27} y={44} width={46} height={14} fill="#fff8e7" />
      <path d="M30 44 H70 M30 58 H70" {...S} />
      <path d="M36 48 H58" stroke="#e6d6b8" strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  'delicious-smoothie': () => (
    <g>
      <path d="M28 30 H72 L64 88 H36 Z" fill="#ff8ad1" {...S} />
      <path d="M30 42 C40 46 60 38 70 42" fill="none" stroke="#fff" strokeWidth={3} opacity={0.6} />
      <path d="M54 30 L64 8 L70 10" fill="none" {...S} strokeWidth={4} />
      <circle cx={36} cy={28} r={8} fill="#ffd23f" {...S} strokeWidth={2.2} />
      <path d="M36 22 V34 M30 28 H42" stroke="#ff9f1c" strokeWidth={1.6} />
    </g>
  ),
  'grave-maker': () => (
    <g>
      <path d="M28 88 V40 C28 20 72 20 72 40 V88 Z" fill="#b7c0cf" {...S} />
      <path d="M50 34 V62 M40 44 H60" stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <path d="M16 90 H84" {...S} strokeWidth={4} />
      <path d="M24 88 C28 80 34 80 36 88 M66 88 C68 82 74 80 78 88" fill="#6fd36b" {...S} strokeWidth={2} />
    </g>
  ),
  'grappling-snake': () => (
    <g>
      <path d="M18 76 C28 92 44 84 42 70 C40 58 54 48 62 58 C70 68 82 60 80 46 C78 34 66 32 60 38" fill="none" stroke={INK} strokeWidth={12} strokeLinecap="round" />
      <path d="M18 76 C28 92 44 84 42 70 C40 58 54 48 62 58 C70 68 82 60 80 46 C78 34 66 32 60 38" fill="none" stroke="#6fd36b" strokeWidth={7} strokeLinecap="round" />
      <ellipse cx={58} cy={36} rx={9} ry={7} fill="#6fd36b" {...S} strokeWidth={2.4} />
      <circle cx={56} cy={34} r={1.8} fill={INK} />
      <path d="M50 38 L44 40 M44 40 L41 38 M44 40 L41 42" stroke="#ff4d4d" strokeWidth={1.8} strokeLinecap="round" />
    </g>
  ),
  'handy-pan': () => (
    <g>
      <circle cx={44} cy={54} r={26} fill="#4a4a5c" {...S} />
      <circle cx={44} cy={54} r={18} fill="#5f5f74" />
      <path d="M68 44 L92 30" stroke="#8a5a2b" strokeWidth={9} strokeLinecap="round" />
      <path d="M68 44 L92 30" stroke={INK} strokeWidth={1.5} />
      <ellipse cx={44} cy={54} rx={9} ry={7} fill="#fff" stroke={INK} strokeWidth={1.6} />
      <circle cx={46} cy={53} r={4} fill="#ffd23f" />
    </g>
  ),
  'dino-grabber': () => (
    <g>
      <path d="M20 86 L58 42" stroke="#ff9f1c" strokeWidth={8} strokeLinecap="round" />
      <path d="M20 86 L58 42" stroke={INK} strokeWidth={1.6} />
      <path d="M56 44 C54 30 60 22 70 22 M56 44 C70 40 78 46 80 56 M56 44 C64 34 76 32 82 38" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" />
      <path d="M56 44 C54 30 60 22 70 22 M56 44 C70 40 78 46 80 56 M56 44 C64 34 76 32 82 38" fill="none" stroke="#cfd8e3" strokeWidth={2} strokeLinecap="round" />
      <rect x={14} y={82} width={12} height={10} rx={3} fill="#4a4a5c" {...S} strokeWidth={2} />
    </g>
  ),
  'cool-stick': () => (
    <g>
      <path d="M24 86 L76 18" stroke="#b07b52" strokeWidth={10} strokeLinecap="round" />
      <path d="M24 86 L76 18" stroke={INK} strokeWidth={1.6} opacity={0.6} />
      <path d="M44 60 L34 52 M56 44 L66 40" stroke="#b07b52" strokeWidth={5} strokeLinecap="round" />
      <rect x={52} y={22} width={34} height={12} rx={6} fill={INK} transform="rotate(-50 69 28)" />
      <path d="M64 18 L70 24" stroke="#fff" strokeWidth={2} opacity={0.7} />
    </g>
  ),
  'pet-rock': () => (
    <g>
      <path d="M18 78 C16 54 34 38 52 40 C72 42 86 56 82 76 C80 86 22 88 18 78 Z" fill="#a7a0b5" {...S} />
      <circle cx={42} cy={60} r={3.4} fill={INK} />
      <circle cx={60} cy={60} r={3.4} fill={INK} />
      <path d="M44 70 Q51 75 58 70" stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M38 42 C42 32 54 30 60 40" fill="#ff5f9e" {...S} strokeWidth={2.2} />
      <path d="M30 58 Q32 50 38 48" stroke="#fff" strokeWidth={2.4} opacity={0.5} fill="none" strokeLinecap="round" />
    </g>
  ),
  // ---- Perils of Puberty
  'extra-sharp-stick': () => (
    <g>
      <path d="M24 86 L70 26" stroke="#b07b52" strokeWidth={10} strokeLinecap="round" />
      <path d="M66 30 L84 10 L76 36 Z" fill="#cfd8e3" {...S} />
      <path d="M86 18 L94 14 M88 26 L96 26 M80 10 L82 2" stroke="#ffd23f" strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  'really-thick-glasses': () => (
    <g>
      <circle cx={32} cy={52} r={18} fill="#d9f6ff" {...S} strokeWidth={7} />
      <circle cx={68} cy={52} r={18} fill="#d9f6ff" {...S} strokeWidth={7} />
      <path d="M50 50 Q50 44 50 50" {...S} />
      <path d="M48 50 C50 46 52 46 52 50" fill="none" {...S} strokeWidth={5} />
      <circle cx={32} cy={52} r={6} fill={INK} />
      <circle cx={68} cy={52} r={6} fill={INK} />
      <path d="M24 44 L30 40 M60 44 L66 40" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  'trash-into-treasure': () => (
    <g>
      <path d="M26 40 H74 L68 88 H32 Z" fill="#9aa3b5" {...S} />
      <rect x={22} y={32} width={56} height={10} rx={3} fill="#b7c0cf" {...S} />
      <path d="M40 50 V80 M50 50 V80 M60 50 V80" stroke={INK} strokeWidth={2} opacity={0.5} />
      <Star x={66} y={20} r={13} />
      <path d="M30 22 L34 16 M40 18 V10" stroke="#ffd23f" strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  'handy-backpack': () => (
    <g>
      <path d="M26 40 C26 26 74 26 74 40 V84 C74 88 70 90 66 90 H34 C30 90 26 88 26 84 Z" fill="#5aa9ff" {...S} />
      <path d="M38 28 C38 16 62 16 62 28" fill="none" {...S} strokeWidth={4} />
      <rect x={34} y={56} width={32} height={22} rx={5} fill="#2d6fc0" {...S} strokeWidth={2.4} />
      <circle cx={50} cy={58} r={3} fill="#ffd23f" stroke={INK} strokeWidth={1.6} />
    </g>
  ),
  'ice-cream': () => (
    <g>
      <path d="M34 50 L50 92 L66 50 Z" fill="#e8b46b" {...S} />
      <path d="M38 58 L60 74 M44 52 L64 64 M62 58 L42 76" stroke="#b57a3a" strokeWidth={1.6} />
      <circle cx={42} cy={44} r={14} fill="#ff8ad1" {...S} />
      <circle cx={60} cy={42} r={14} fill="#d9f6ff" {...S} />
      <circle cx={51} cy={28} r={13} fill="#c48a5a" {...S} />
      <circle cx={52} cy={14} r={4} fill="#ff4d4d" {...S} strokeWidth={2} />
    </g>
  ),
  'unwanted-lunch': () => (
    <g>
      <path d="M26 36 H74 L70 88 H30 Z" fill="#e8c99a" {...S} />
      <path d="M26 36 L34 24 H66 L74 36" fill="#d9b57a" {...S} />
      <path d="M40 52 C44 48 48 56 52 52 C56 48 60 56 64 52" fill="none" stroke="#6fd36b" strokeWidth={3} strokeLinecap="round" />
      <path d="M42 66 L58 72 M58 66 L42 72" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M72 16 C76 20 72 24 76 28 M82 14 C86 18 82 22 86 26" stroke="#6fd36b" strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </g>
  ),
  // ---- Dating Disasters
  mixtape: () => (
    <g>
      <rect x={14} y={28} width={72} height={46} rx={6} fill="#ff5f9e" {...S} />
      <rect x={24} y={36} width={52} height={20} rx={4} fill="#fff8e7" {...S} strokeWidth={2.4} />
      <circle cx={36} cy={46} r={6} fill={INK} />
      <circle cx={64} cy={46} r={6} fill={INK} />
      <path d="M28 74 L34 62 H66 L72 74" fill="#d63a78" {...S} strokeWidth={2.4} />
      <Heart x={50} y={44} r={5} fill="#ff4d4d" />
    </g>
  ),
  'minty-gum': () => (
    <g>
      <rect x={18} y={36} width={64} height={34} rx={6} fill="#5cd6b5" {...S} />
      <path d="M18 48 H82 M18 58 H82" stroke="#fff" strokeWidth={3} opacity={0.7} />
      <rect x={54} y={22} width={26} height={16} rx={4} fill="#d9fff3" {...S} transform="rotate(14 67 30)" />
      <path d="M26 80 C30 76 34 84 38 80 M62 82 C66 78 70 86 74 82" stroke="#5cd6b5" strokeWidth={3} fill="none" strokeLinecap="round" />
    </g>
  ),
  'box-of-chocolates': () => (
    <g>
      <Heart x={50} y={56} r={26} fill="#d63a78" />
      <Heart x={50} y={54} r={18} fill="#7a3a22" />
      {[[42, 50], [58, 50], [50, 62]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={5} fill="#c48a5a" stroke={INK} strokeWidth={1.8} />)}
      <path d="M50 30 C40 20 36 28 44 32 M50 30 C60 20 64 28 56 32" fill="none" stroke="#ffd23f" strokeWidth={3.4} strokeLinecap="round" />
    </g>
  ),
  'wine-bottle': () => <Bottle color="#7a2040" label="#ffd2e4" cap="#d63a78" />,
  'heart-bomb': () => (
    <g>
      <Heart x={46} y={58} r={28} fill="#ff4d6d" />
      <path d="M60 32 C66 24 72 22 78 24" fill="none" stroke="#c9a46a" strokeWidth={3.4} strokeLinecap="round" />
      <Star x={82} y={22} r={8} fill="#ffd23f" />
      <path d="M34 50 C36 44 40 42 44 42" stroke="#fff" strokeWidth={3} opacity={0.6} fill="none" strokeLinecap="round" />
    </g>
  ),
  'bedazzled-belt': () => (
    <g>
      <rect x={8} y={42} width={84} height={18} rx={6} fill="#ff9fd4" {...S} />
      <rect x={38} y={36} width={24} height={30} rx={5} fill="#ffd23f" {...S} />
      <rect x={44} y={42} width={12} height={18} rx={2} fill="#ff9fd4" stroke={INK} strokeWidth={2} />
      {[16, 26, 70, 80].map((x) => <path key={x} d={`M${x} 46 L${x + 4} 51 L${x} 56 L${x - 4} 51 Z`} fill="#bfe9ff" stroke={INK} strokeWidth={1.4} />)}
    </g>
  ),
  'teddy-bear': () => (
    <g>
      <circle cx={34} cy={24} r={9} fill="#c48a5a" {...S} />
      <circle cx={66} cy={24} r={9} fill="#c48a5a" {...S} />
      <ellipse cx={50} cy={70} rx={24} ry={20} fill="#c48a5a" {...S} />
      <circle cx={50} cy={38} r={20} fill="#c48a5a" {...S} />
      <ellipse cx={50} cy={46} rx={9} ry={7} fill="#f0d0a8" stroke={INK} strokeWidth={2} />
      <circle cx={43} cy={34} r={2.6} fill={INK} />
      <circle cx={57} cy={34} r={2.6} fill={INK} />
      <circle cx={50} cy={43} r={2.6} fill={INK} />
      <Heart x={50} y={70} r={8} fill="#ff5f9e" />
    </g>
  ),
  'bouquet-of-flowers': () => (
    <g>
      <path d="M40 92 L50 54 L60 92 Z" fill="#6fd36b" {...S} />
      {[[36, 36, '#ff5f9e'], [64, 36, '#ffd23f'], [50, 24, '#ff9f1c'], [42, 52, '#bfa3ff'], [60, 52, '#ff5f9e']].map(([x, y, c]) => (
        <g key={`${x}${y}`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={(x as number) + Math.cos((a * Math.PI) / 180) * 7} cy={(y as number) + Math.sin((a * Math.PI) / 180) * 7} r={5} fill={c as string} stroke={INK} strokeWidth={1.6} />
          ))}
          <circle cx={x as number} cy={y as number} r={4} fill="#fff8e7" stroke={INK} strokeWidth={1.6} />
        </g>
      ))}
    </g>
  ),
  'stinky-perfume': () => (
    <g>
      <rect x={28} y={46} width={40} height={42} rx={8} fill="#bfa3ff" {...S} />
      <rect x={42} y={34} width={12} height={12} fill="#ffd23f" {...S} strokeWidth={2.4} />
      <circle cx={64} cy={30} r={7} fill="#ff5f9e" {...S} strokeWidth={2.2} />
      <path d="M68 14 C74 18 70 22 76 26 M78 10 C84 14 80 18 86 22 M84 34 C90 34 90 40 94 40" stroke="#6fd36b" strokeWidth={3} fill="none" strokeLinecap="round" />
    </g>
  ),
  'broken-high-heel': () => (
    <g>
      <path d="M14 70 C30 70 40 60 52 48 C58 42 70 44 74 52 L82 66 C84 72 80 76 74 76 H18 C14 76 12 72 14 70 Z" fill="#ff4d6d" {...S} />
      <path d="M74 76 L76 90 L84 90" fill="none" {...S} strokeWidth={4} />
      <path d="M80 62 L88 54 L92 58" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M60 54 L64 58 L60 62" fill="none" stroke="#fff" strokeWidth={2} />
    </g>
  ),
  'love-bug': () => (
    <g>
      <ellipse cx={52} cy={60} rx={24} ry={20} fill="#ff4d6d" {...S} />
      <path d="M52 40 V80" stroke={INK} strokeWidth={2.4} />
      <circle cx={42} cy={54} r={4} fill={INK} />
      <circle cx={62} cy={66} r={4} fill={INK} />
      <circle cx={32} cy={40} r={11} fill={INK} />
      <path d="M26 32 L18 22 M36 30 L36 18" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <Heart x={18} y={20} r={5} fill="#ff5f9e" />
      <Heart x={36} y={16} r={5} fill="#ff5f9e" />
    </g>
  ),
  'cold-feet': () => (
    <g>
      <path d="M22 80 C18 60 22 40 34 40 C44 40 44 56 42 66 C50 66 56 70 56 78 C56 88 26 90 22 80 Z" fill="#bfe9ff" {...S} />
      <path d="M52 76 C50 58 54 40 66 40 C76 40 76 56 74 64 C82 64 88 68 88 76 C88 86 56 88 52 76 Z" fill="#bfe9ff" {...S} />
      <path d="M30 22 L30 34 M24 28 H36 M26 24 L34 32 M34 24 L26 32" stroke="#4f8dff" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M70 18 L70 30 M64 24 H76 M66 20 L74 28 M74 20 L66 28" stroke="#4f8dff" strokeWidth={2.4} strokeLinecap="round" />
    </g>
  ),
  // ---- Hazards Ahead
  'molotov-crocktail': () => (
    <g>
      <Bottle color="#6fd36b" label="#fff8e7" cap="#fff8e7" />
      <Flame x={50} y={10} s={1} />
      <path d="M40 62 L48 70 L60 58" fill="none" stroke="#ff4d4d" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  'suck-up': () => (
    <g>
      <rect x={34} y={44} width={32} height={44} rx={8} fill="#cfd8e3" {...S} />
      <path d="M42 44 C40 30 46 20 56 16 L64 24 C56 26 52 34 54 44" fill="#ff9f1c" {...S} />
      <circle cx={60} cy={20} r={10} fill="none" {...S} strokeWidth={4} />
      <path d="M40 60 H60 M40 70 H60" stroke={INK} strokeWidth={2} opacity={0.5} />
      <path d="M76 22 Q84 20 86 28 M80 34 Q88 36 88 44" stroke="#9aa3b5" strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </g>
  ),
  'caution-sign': () => (
    <g>
      <path d="M50 12 L90 84 H10 Z" fill="#ffd23f" {...S} strokeWidth={4} />
      <path d="M50 36 V60" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <circle cx={50} cy={72} r={4.4} fill={INK} />
    </g>
  ),
  'protective-helmet': () => (
    <g>
      <path d="M16 66 C16 30 84 30 84 66 Z" fill="#ffd23f" {...S} />
      <rect x={10} y={64} width={80} height={12} rx={6} fill="#ffb800" {...S} />
      <path d="M50 30 V64" stroke={INK} strokeWidth={4} />
      <path d="M30 40 C34 36 40 34 44 34" stroke="#fff" strokeWidth={3} opacity={0.6} fill="none" strokeLinecap="round" />
    </g>
  ),
  'hazard-suit': () => (
    <g>
      <path d="M30 34 H70 L76 88 H58 L54 66 H46 L42 88 H24 Z" fill="#ffd23f" {...S} />
      <circle cx={50} cy={22} r={14} fill="#ffd23f" {...S} />
      <rect x={40} y={16} width={20} height={12} rx={4} fill="#8fdcff" {...S} strokeWidth={2.2} />
      <path d="M50 44 L56 54 H44 Z" fill={INK} />
    </g>
  ),
  'safety-cone': () => (
    <g>
      <path d="M38 22 C42 16 58 16 62 22 L76 82 H24 Z" fill="#ff7a1a" {...S} />
      <path d="M33 46 H67 L70 58 H30 Z" fill="#fff" stroke={INK} strokeWidth={2} />
      <rect x={14} y={80} width={72} height={10} rx={3} fill="#ff7a1a" {...S} />
    </g>
  ),

  // ---- Instants
  'score-booster': () => (
    <g>
      <path d="M50 10 L84 46 H64 V88 H36 V46 H16 Z" fill="#46d68c" {...S} />
      <text x={50} y={74} textAnchor="middle" fontSize={22} fontFamily="'Luckiest Guy', sans-serif" fill="#fff" stroke={INK} strokeWidth={1.4}>+2</text>
    </g>
  ),
  'score-sapper': () => (
    <g>
      <path d="M50 90 L84 54 H64 V12 H36 V54 H16 Z" fill="#ff4d4d" {...S} />
      <text x={50} y={44} textAnchor="middle" fontSize={22} fontFamily="'Luckiest Guy', sans-serif" fill="#fff" stroke={INK} strokeWidth={1.4}>−2</text>
    </g>
  ),
  'score-inversion': () => (
    <g>
      <path d="M22 40 C22 22 60 18 72 34 L80 26 L82 52 L58 48 L66 40 C58 30 36 32 36 42 Z" fill="#ffd23f" {...S} />
      <path d="M78 60 C78 78 40 82 28 66 L20 74 L18 48 L42 52 L34 60 C42 70 64 68 64 58 Z" fill="#b35cff" {...S} />
    </g>
  ),
  'disaster-insurance': () => (
    <g>
      <path d="M50 10 L84 22 C84 54 72 76 50 90 C28 76 16 54 16 22 Z" fill="#5aa9ff" {...S} />
      <path d="M36 50 L46 60 L66 38" fill="none" stroke="#fff" strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  ),
  'disaster-redirect': () => (
    <g>
      <path d="M20 70 C20 36 44 26 66 30 L64 18 L90 38 L62 56 L64 44 C48 42 36 50 36 70 Z" fill="#ff9f1c" {...S} />
      <circle cx={26} cy={82} r={8} fill="#b35cff" {...S} strokeWidth={2.4} />
    </g>
  ),
  'bffs-help': () => (
    <g>
      <Heart x={34} y={50} r={20} fill="#ff8ad1" />
      <Heart x={66} y={50} r={20} fill="#ffd23f" />
      <path d="M42 72 C46 64 54 64 58 72" fill="none" {...S} strokeWidth={4} />
    </g>
  ),
  'frenemys-curse': () => (
    <g>
      <circle cx={50} cy={46} r={28} fill="#e4d7ff" {...S} />
      <circle cx={40} cy={42} r={7} fill={INK} />
      <circle cx={60} cy={42} r={7} fill={INK} />
      <path d="M50 52 L46 60 H54 Z" fill={INK} />
      <path d="M36 70 V80 M44 72 V82 M52 72 V82 M60 70 V80" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M22 18 L30 26 M78 18 L70 26" stroke="#b35cff" strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  'joy-of-puberty': () => (
    <g>
      <circle cx={50} cy={54} r={28} fill="#ffd23f" {...S} />
      <path d="M36 50 Q40 44 44 50 M56 50 Q60 44 64 50" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M36 62 Q50 76 64 62" fill="#ff4d6d" {...S} />
      <circle cx={40} cy={60} r={2} fill="#c98a5a" />
      <circle cx={62} cy={56} r={2} fill="#c98a5a" />
      <Star x={18} y={22} r={8} fill="#ff8ad1" />
      <Star x={84} y={20} r={7} fill="#5aa9ff" />
    </g>
  ),
  'lucky-break': () => (
    <g>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dy]) => (
        <Heart key={`${dx}${dy}`} x={50 + dx! * 13} y={46 + dy! * 13} r={13} fill="#46d68c" />
      ))}
      <path d="M50 60 C52 74 58 82 66 88" fill="none" stroke="#2c9a5c" strokeWidth={5} strokeLinecap="round" />
    </g>
  ),
  'spiteful-bullying': () => (
    <g>
      <path d="M30 40 C30 30 40 26 48 30 C52 24 62 24 66 30 C74 28 80 34 78 42 L76 66 C74 80 60 86 48 84 C36 82 28 72 30 60 Z" fill="#ffb86b" {...S} />
      <path d="M48 30 V48 M66 30 V48 M36 44 C42 40 46 44 46 50" fill="none" stroke={INK} strokeWidth={2.4} />
      <path d="M16 20 L26 30 M84 16 L76 28 M50 6 V16" stroke="#ff4d4d" strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  'awkward-first-kiss': () => (
    <g>
      <path d="M14 50 C26 34 40 38 50 46 C60 38 74 34 86 50 C74 62 60 70 50 70 C40 70 26 62 14 50 Z" fill="#ff4d6d" {...S} />
      <path d="M16 50 C30 54 70 54 84 50" fill="none" stroke={INK} strokeWidth={2.4} />
      <path d="M70 20 C74 14 82 16 80 22 M80 30 C86 28 90 34 84 36" stroke="#4f8dff" strokeWidth={2.6} fill="none" strokeLinecap="round" />
    </g>
  ),
  'baby-pictures': () => (
    <g>
      <rect x={14} y={30} width={72} height={52} rx={8} fill="#5f5f74" {...S} />
      <rect x={30} y={20} width={22} height={12} rx={3} fill="#5f5f74" {...S} />
      <circle cx={50} cy={56} r={17} fill="#bfe9ff" {...S} />
      <circle cx={50} cy={56} r={9} fill="#2a1d16" />
      <circle cx={46} cy={52} r={3} fill="#fff" />
      <circle cx={76} cy={40} r={4} fill="#ffd23f" />
    </g>
  ),
  'crippling-shyness': () => (
    <g>
      <circle cx={50} cy={52} r={30} fill="#ffd2e4" {...S} />
      <path d="M36 48 Q40 52 44 48 M56 48 Q60 52 64 48" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
      <ellipse cx={34} cy={60} rx={7} ry={4} fill="#ff8ad1" />
      <ellipse cx={66} cy={60} rx={7} ry={4} fill="#ff8ad1" />
      <path d="M46 66 Q50 64 54 66" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M20 30 C14 26 14 18 20 16 M80 30 C86 26 86 18 80 16" stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
    </g>
  ),
  'double-date': () => (
    <g>
      <Heart x={36} y={48} r={18} fill="#ff4d6d" />
      <Heart x={64} y={58} r={18} fill="#ff8ad1" />
      <text x={50} y={92} textAnchor="middle" fontSize={16} fontFamily="'Luckiest Guy', sans-serif" fill="#46d68c" stroke={INK} strokeWidth={1}>+2 +2</text>
    </g>
  ),
  'one-week-anniversary': () => (
    <g>
      <rect x={22} y={52} width={56} height={34} rx={5} fill="#ff8ad1" {...S} />
      <path d="M22 62 C30 68 38 58 46 64 C54 70 62 58 78 64" fill="none" stroke="#fff8e7" strokeWidth={4} strokeLinecap="round" />
      <rect x={46} y={34} width={8} height={18} rx={2} fill="#bfe9ff" {...S} strokeWidth={2.2} />
      <Flame x={50} y={30} s={0.7} />
    </g>
  ),
  roadblock: () => (
    <g>
      <rect x={10} y={40} width={80} height={20} rx={3} fill="#fff8e7" {...S} />
      {[14, 34, 54, 74].map((x) => <path key={x} d={`M${x} 40 L${x + 12} 40 L${x + 4} 60 L${x - 8} 60 Z`} fill="#ff4d4d" />)}
      <rect x={10} y={40} width={80} height={20} rx={3} fill="none" {...S} />
      <path d="M20 60 V86 M80 60 V86" {...S} strokeWidth={5} />
      <circle cx={20} cy={34} r={5} fill="#ffd23f" {...S} strokeWidth={2} />
      <circle cx={80} cy={34} r={5} fill="#ffd23f" {...S} strokeWidth={2} />
    </g>
  ),
  detour: () => (
    <g>
      <rect x={14} y={28} width={72} height={34} rx={5} fill="#ff9f1c" {...S} />
      <path d="M24 52 H52 V40 H44 L58 32 L72 40 H64 V52" fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <path d="M50 62 V90" {...S} strokeWidth={5} />
    </g>
  ),
};

/** The art window contents for a Point / Instant card. */
export function CardDoodle({ kind }: { kind: HldCardKind }) {
  const draw = DOODLES[kind];
  return (
    <svg viewBox="0 0 100 100" className="hld-doodle" aria-hidden="true">
      {draw ? draw() : <Star x={50} y={50} r={30} />}
    </svg>
  );
}

// ============================================================================
// Disasters
// ============================================================================

type DisasterArtKind =
  | 'eruption' | 'flood' | 'rocks' | 'storm' | 'plant'
  | 'jaws' | 'talons' | 'bugs' | 'stomp'
  | 'raincloud' | 'heartbreak' | 'ghost' | 'blush'
  | 'meteor';

/** Pick the scene from the card's category and a keyword in its name. */
function disasterArtKind(category: HldDisasterCategory, name: string): DisasterArtKind {
  const n = name.toLowerCase();
  const has = (re: RegExp) => re.test(n);
  if (category === 'meteor') return 'meteor';
  if (category === 'natural') {
    if (has(/lava|bake|hot|fire|solar|flare|steam|boil|drill/)) return 'eruption';
    if (has(/flood|rain|wave|hail|ice|drift|swamp/)) return 'flood';
    if (has(/storm|tornado|shock|cold|dust/)) return 'storm';
    if (has(/bush|leaf|ivy|vine|manners/)) return 'plant';
    return 'rocks';
  }
  if (category === 'predator') {
    if (has(/shark|piranha|clam|turtle|urchin|leech|snack|catfish|bite/)) return 'jaws';
    if (has(/bird|swoop|pter|raptor|sabertooth|badger|squirrel|rabbit/)) return 'talons';
    if (has(/mosquito|hornet|ant|centipede|scorpion|critter|beetle|pest|compsognathus/)) return 'bugs';
    return 'stomp';
  }
  if (has(/ghost|read|reply|waiting|nobody|exit|left/)) return 'ghost';
  if (has(/love|kiss|friend|crush|zoned|greeting|date|heart/)) return 'heartbreak';
  if (has(/hair|voice|wave|cheese|art|coolest|tripped|wardrobe|stage|lego/)) return 'blush';
  return 'raincloud';
}

const SCENES: Record<DisasterArtKind, () => ReactNode> = {
  eruption: () => (
    <g>
      <path d="M8 92 L38 38 H62 L92 92 Z" fill="#7a4a2a" {...S} />
      <path d="M38 38 C42 46 46 42 50 50 C54 42 58 46 62 38 Z" fill="#ff7a1a" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M44 48 C42 62 48 70 44 92 M56 46 C60 60 54 74 60 92" fill="none" stroke="#ff7a1a" strokeWidth={5} strokeLinecap="round" />
      <circle cx={34} cy={20} r={7} fill="#ff7a1a" {...S} strokeWidth={2.4} />
      <circle cx={66} cy={14} r={5} fill="#ffd23f" {...S} strokeWidth={2.4} />
      <circle cx={50} cy={24} r={9} fill="#ff4d4d" {...S} strokeWidth={2.4} />
    </g>
  ),
  flood: () => (
    <g>
      <path d="M0 58 C12 46 22 46 30 58 C38 70 50 70 58 58 C66 46 78 46 86 58 C92 66 98 64 100 60 V100 H0 Z" fill="#4f8dff" {...S} />
      <path d="M0 76 C12 66 22 66 30 76 C38 86 50 86 58 76 C66 66 78 66 86 76 C92 82 98 80 100 78" fill="none" stroke="#bfe9ff" strokeWidth={3} />
      <path d="M30 40 C34 30 46 28 50 36 C56 26 70 30 68 40 Z" fill="#9aa3b5" {...S} />
      {[[34, 46], [44, 50], [56, 46], [64, 50]].map(([x, y]) => <path key={x} d={`M${x} ${y} L${x! - 2} ${y! + 6}`} stroke="#4f8dff" strokeWidth={2.4} strokeLinecap="round" />)}
    </g>
  ),
  rocks: () => (
    <g>
      <path d="M0 40 L100 78 V100 H0 Z" fill="#c9a074" {...S} />
      <path d="M30 70 L38 80 L34 90 M58 82 L66 88" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={46} cy={44} r={24} fill="#9a90ad" {...S} />
      <path d="M32 36 C38 30 46 30 50 34 M40 54 L50 48 L58 54" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <circle cx={40} cy={40} r={4} fill="#b9b0cc" />
      <path d="M76 26 H92 M78 38 H96 M74 50 H88" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M14 82 L8 76 M22 88 L18 80" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  ),
  storm: () => (
    <g>
      <path d="M18 50 C10 50 8 38 18 36 C18 22 36 18 42 28 C48 16 70 18 72 32 C84 30 92 42 84 50 Z" fill="#6b7a8f" {...S} />
      <path d="M48 50 L38 70 H50 L42 92 L66 62 H54 L62 50 Z" fill="#ffd23f" {...S} strokeWidth={2.6} />
      <path d="M22 60 L18 70 M78 58 L74 68" stroke="#bfe9ff" strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  plant: () => (
    <g>
      <path d="M50 92 C50 70 46 56 50 40" fill="none" stroke="#3b963a" strokeWidth={6} strokeLinecap="round" />
      {[[-1, 52], [1, 62], [-1, 72], [1, 44]].map(([side, y]) => (
        <path key={y} d={`M50 ${y} C${50 + side! * 30} ${y! - 18} ${50 + side! * 40} ${y! - 2} ${50 + side! * 36} ${y! + 6} C${50 + side! * 24} ${y! + 8} ${50 + side! * 10} ${y! + 4} 50 ${y} Z`} fill="#6fd36b" {...S} strokeWidth={2.4} />
      ))}
      {[[24, 36], [76, 44], [30, 70], [72, 76]].map(([x, y]) => <path key={x} d={`M${x} ${y} L${x! + 6} ${y! - 6}`} stroke={INK} strokeWidth={2.4} strokeLinecap="round" />)}
    </g>
  ),
  jaws: () => (
    <g>
      <path d="M10 30 C30 10 70 10 90 30 L84 46 H16 Z" fill="#9aa3b5" {...S} />
      <path d="M16 46 L22 34 L28 46 L34 34 L40 46 L46 34 L52 46 L58 34 L64 46 L70 34 L76 46 L82 34 L84 46" fill="#fff" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M10 82 C30 96 70 96 90 82 L84 62 H16 Z" fill="#9aa3b5" {...S} />
      <path d="M16 62 L22 74 L28 62 L34 74 L40 62 L46 74 L52 62 L58 74 L64 62 L70 74 L76 62 L82 74 L84 62" fill="#fff" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={30} cy={22} r={4} fill="#ff4d4d" stroke={INK} strokeWidth={1.6} />
    </g>
  ),
  talons: () => (
    <g>
      <path d="M50 10 C62 10 70 22 66 36 L58 44 H42 L34 36 C30 22 38 10 50 10 Z" fill="#c48a5a" {...S} />
      {[30, 50, 70].map((x, i) => (
        <path key={x} d={`M${x} 46 C${x + (i - 1) * 6} 64 ${x + (i - 1) * 10} 76 ${x + (i - 1) * 4 + 8} 90`} fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      ))}
      {[30, 50, 70].map((x, i) => (
        <path key={x} d={`M${x} 46 C${x + (i - 1) * 6} 64 ${x + (i - 1) * 10} 76 ${x + (i - 1) * 4 + 8} 90`} fill="none" stroke="#fff6e0" strokeWidth={3} strokeLinecap="round" />
      ))}
      <path d="M12 40 L22 50 M14 60 L26 62 M88 40 L78 50" stroke="#ff4d4d" strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  bugs: () => (
    <g>
      {[[34, 40, 1], [66, 58, 0.85], [40, 76, 0.7]].map(([x, y, s]) => (
        <g key={x} transform={`translate(${x} ${y}) scale(${s})`}>
          <path d="M-14 -6 C-24 -18 -10 -22 -4 -8 M14 -6 C24 -18 10 -22 4 -8" fill="#d9f6ff" stroke={INK} strokeWidth={2.2} opacity={0.9} />
          <ellipse cx={0} cy={4} rx={9} ry={13} fill="#ff9f1c" stroke={INK} strokeWidth={2.6} />
          <path d="M-9 0 H9 M-8 8 H8" stroke={INK} strokeWidth={2.4} />
          <circle cx={0} cy={-11} r={6} fill={INK} />
          <path d="M0 17 L0 24" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
        </g>
      ))}
    </g>
  ),
  stomp: () => (
    <g>
      <ellipse cx={50} cy={92} rx={42} ry={6} fill={INK} opacity={0.25} />
      <path d="M30 0 H70 V34 C70 44 66 48 60 50 H40 C34 48 30 44 30 34 Z" fill="#8a6bd6" {...S} />
      {[[22, 46], [50, 52], [78, 46]].map(([x, y]) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx={13} ry={12} fill="#8a6bd6" {...S} />
          <path d={`M${x! - 6} ${y! + 8} L${x} ${y! + 26} L${x! + 6} ${y! + 8} Z`} fill="#fff6e0" {...S} strokeWidth={2.4} />
        </g>
      ))}
      <path d="M36 14 C40 10 46 10 50 14" fill="none" stroke="#b39af0" strokeWidth={3} strokeLinecap="round" />
      <path d="M8 70 L2 64 M92 70 L98 64 M10 84 L2 84 M90 84 L98 84" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
    </g>
  ),
  raincloud: () => (
    <g>
      <path d="M18 52 C8 52 6 38 18 36 C18 22 38 18 44 30 C50 18 72 20 74 34 C86 32 94 46 84 52 Z" fill="#8f9ab0" {...S} />
      <path d="M36 42 Q40 38 44 42 M56 42 Q60 38 64 42" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <path d="M42 48 Q50 44 58 48" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      {[[26, 62], [42, 70], [58, 64], [74, 72], [34, 84], [66, 88]].map(([x, y]) => (
        <path key={`${x}${y}`} d={`M${x} ${y} Q${x! + 3} ${y! + 6} ${x} ${y! + 8} Q${x! - 3} ${y! + 6} ${x} ${y} Z`} fill="#4f8dff" stroke={INK} strokeWidth={1.6} />
      ))}
    </g>
  ),
  heartbreak: () => (
    <g>
      <Heart x={50} y={54} r={32} fill="#ff4d6d" />
      <path d="M50 26 L42 42 L56 52 L44 66 L50 84" fill="none" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <path d="M50 26 L42 42 L56 52 L44 66 L50 84" fill="none" stroke="#fff8e7" strokeWidth={1.6} strokeLinejoin="round" />
    </g>
  ),
  ghost: () => (
    <g>
      <path d="M24 90 V44 C24 22 76 22 76 44 V90 L66 82 L58 90 L50 82 L42 90 L34 82 Z" fill="#f4f1ff" {...S} />
      <ellipse cx={40} cy={48} rx={5} ry={7} fill={INK} />
      <ellipse cx={60} cy={48} rx={5} ry={7} fill={INK} />
      <ellipse cx={50} cy={64} rx={6} ry={5} fill={INK} />
      <path d="M82 22 H94 V34 H82 Z" fill="#bfe9ff" {...S} strokeWidth={2.2} transform="rotate(12 88 28)" />
    </g>
  ),
  blush: () => (
    <g>
      <circle cx={50} cy={52} r={32} fill="#ffcf9a" {...S} />
      <path d="M36 46 L44 50 M56 50 L64 46" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M38 66 C44 60 56 60 62 66" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={30} cy={58} rx={7} ry={4} fill="#ff8ad1" />
      <ellipse cx={70} cy={58} rx={7} ry={4} fill="#ff8ad1" />
      <path d="M74 20 Q80 26 74 30 Q68 26 74 20 Z" fill="#8fdcff" stroke={INK} strokeWidth={1.8} />
    </g>
  ),
  meteor: () => (
    <g>
      <path d="M92 6 L44 54" stroke="#ff7a1a" strokeWidth={22} strokeLinecap="round" opacity={0.9} />
      <path d="M92 6 L48 50" stroke="#ffd23f" strokeWidth={10} strokeLinecap="round" />
      <circle cx={40} cy={60} r={22} fill="#7a4a2a" {...S} />
      <circle cx={34} cy={54} r={5} fill="#5a3418" />
      <circle cx={48} cy={66} r={4} fill="#5a3418" />
      <path d="M6 94 L22 78 M18 98 L28 84" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
    </g>
  ),
};

const SKIES = ['#ffffff', '#fff1c9', '#dff4ff', '#ffe1ea', '#ecf8dc', '#f1e8ff'];

export function DisasterArt({ category, name }: { category: HldDisasterCategory; name: string }) {
  return (
    <svg viewBox="0 0 100 100" className="hld-doodle" aria-hidden="true">
      <rect x={-10} y={-10} width={120} height={120} fill={SKIES[hashString(name) % SKIES.length]} />
      {SCENES[disasterArtKind(category, name)]()}
    </svg>
  );
}

/** The tiny category glyph used on disaster meters, chips and badges (0 0 24 24). */
export function CategoryIcon({ category, size = 18 }: { category: HldDisasterCategory; size?: number }) {
  const c = CATEGORY_COLOR[category];
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="hld-cat-icon">
      <circle cx={12} cy={12} r={11} fill={c} stroke={INK} strokeWidth={2} />
      {category === 'natural' && <path d="M4 18 L10 8 L13 12 L15 9 L20 18 Z" fill="#fff8e7" stroke={INK} strokeWidth={1.4} strokeLinejoin="round" />}
      {category === 'predator' && <path d="M5 9 L8 14 L10 9 L12 14 L14 9 L16 14 L19 9 M5 15 L8 19 L10 15 L12 19 L14 15 L16 19 L19 15" fill="none" stroke="#fff8e7" strokeWidth={1.8} strokeLinejoin="round" />}
      {category === 'emotional' && <path d="M12 19 C4 14 6 7 10 7 C11 7 12 8 12 9 C12 8 13 7 14 7 C18 7 20 14 12 19 Z M12 9 L11 12 L13 14 L12 17" fill="#fff8e7" stroke={INK} strokeWidth={1.3} strokeLinejoin="round" />}
      {category === 'meteor' && <><path d="M20 4 L12 12" stroke="#ffd23f" strokeWidth={3} strokeLinecap="round" /><circle cx={10} cy={14} r={4.4} fill="#7a4a2a" stroke={INK} strokeWidth={1.4} /></>}
    </svg>
  );
}

// ============================================================================
// Hazards
// ============================================================================

const HAZARDS: Record<HldHazardPenalty, () => ReactNode> = {
  'score-minus-1': () => (
    <g>
      <path d="M8 74 C10 60 30 56 50 58 C72 60 92 62 92 76 C92 88 12 90 8 74 Z" fill="#8a5a2b" {...S} />
      <circle cx={30} cy={70} r={5} fill="#a8774a" />
      <circle cx={64} cy={72} r={6} fill="#a8774a" />
      <path d="M40 44 C40 30 60 30 60 44" fill="none" {...S} strokeWidth={4} />
      <text x={50} y={36} textAnchor="middle" fontSize={22} fontFamily="'Luckiest Guy', sans-serif" fill="#ff4d4d" stroke={INK} strokeWidth={1.2}>−1</text>
    </g>
  ),
  'score-minus-2': () => (
    <g>
      <path d="M20 70 C8 70 8 52 22 52 C22 34 46 32 50 44 C56 30 80 34 78 52 C92 52 92 70 80 70 Z" fill="#9be26b" {...S} />
      <circle cx={40} cy={58} r={4} fill={INK} />
      <circle cx={60} cy={58} r={4} fill={INK} />
      <path d="M42 66 Q50 62 58 66" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      <text x={50} y={92} textAnchor="middle" fontSize={22} fontFamily="'Luckiest Guy', sans-serif" fill="#ff4d4d" stroke={INK} strokeWidth={1.2}>−2</text>
    </g>
  ),
  'hand-size-minus-1': () => (
    <g>
      <path d="M36 14 H56 V62 C70 62 84 68 84 80 C84 88 78 90 70 90 H36 Z" fill="#ffcf9a" {...S} />
      <path d="M36 44 H56 M36 54 H56" stroke="#fff8e7" strokeWidth={8} />
      <path d="M36 44 H56 M36 54 H56" stroke={INK} strokeWidth={1.4} strokeDasharray="3 3" />
      <path d="M62 30 L72 26 M64 40 L76 40" stroke="#ff4d4d" strokeWidth={3} strokeLinecap="round" />
    </g>
  ),
  'no-instants': () => (
    <g>
      <circle cx={50} cy={50} r={32} fill="#ffd2e4" {...S} />
      <circle cx={38} cy={44} r={7} fill="#fff" stroke={INK} strokeWidth={2.2} />
      <circle cx={62} cy={44} r={7} fill="#fff" stroke={INK} strokeWidth={2.2} />
      <circle cx={38} cy={44} r={2} fill={INK} />
      <circle cx={62} cy={44} r={2} fill={INK} />
      <ellipse cx={50} cy={66} rx={8} ry={6} fill={INK} />
      <path d="M86 18 L70 34 M70 18 L86 34" stroke="#ff4d4d" strokeWidth={4} strokeLinecap="round" />
    </g>
  ),
  'extra-disaster-Check': () => (
    <g>
      <path d="M50 10 L92 84 H8 Z" fill="#ff9f1c" {...S} strokeWidth={4} />
      <path d="M50 34 V58" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <circle cx={50} cy={70} r={4.4} fill={INK} />
      <text x={78} y={34} textAnchor="middle" fontSize={20} fontFamily="'Luckiest Guy', sans-serif" fill="#e8342e" stroke={INK} strokeWidth={1}>+1</text>
    </g>
  ),
  'ignore-dino-plus': () => (
    <g>
      <path d="M20 40 C20 22 80 22 80 40 C80 58 66 62 66 72 H34 C34 62 20 58 20 40 Z" fill="#e4d7ff" {...S} />
      <text x={50} y={58} textAnchor="middle" fontSize={34} fontFamily="'Luckiest Guy', sans-serif" fill="#b35cff" stroke={INK} strokeWidth={1.4}>?</text>
      <rect x={36} y={74} width={28} height={10} rx={3} fill="#9aa3b5" {...S} strokeWidth={2.4} />
    </g>
  ),
};

export function HazardArt({ penalty }: { penalty: HldHazardPenalty }) {
  return (
    <svg viewBox="0 0 100 100" className="hld-doodle" aria-hidden="true">
      {HAZARDS[penalty]()}
    </svg>
  );
}

// ============================================================================
// Backs
// ============================================================================

function Footprint({ x, y, r, rot, fill }: { x: number; y: number; r: number; rot: number; fill: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${r})`} fill={fill}>
      <path d="M0 4 C-6 4 -7 -2 -4 -6 C-2 -8 2 -8 4 -6 C7 -2 6 4 0 4 Z" />
      <path d="M-6 -8 L-9 -16 L-4 -10 Z M0 -10 L0 -19 L3 -10 Z M6 -8 L9 -16 L4 -10 Z" />
    </g>
  );
}

/** Main-deck back: orange stock, a trail of dino footprints. viewBox 0 0 100 140. */
export function CardBack() {
  return (
    <svg viewBox="0 0 100 140" className="hld-back-art" role="img" aria-label="Face-down card" preserveAspectRatio="xMidYMid slice">
      <rect width={100} height={140} fill="#ff9f1c" />
      <path d="M0 0 H100 V140 H0 Z M8 8 V132 H92 V8 Z" fill="#ff7a1a" fillRule="evenodd" />
      <rect x={8} y={8} width={84} height={124} rx={10} fill="none" stroke={INK} strokeWidth={2.4} />
      {[[30, 112, -20], [56, 94, 10], [36, 74, -16], [62, 54, 14], [42, 34, -12]].map(([x, y, r]) => (
        <Footprint key={y} x={x!} y={y!} r={1.5} rot={r!} fill="#c4561d" />
      ))}
      {/* a hatching egg */}
      <path d="M50 44 C64 44 72 64 72 78 C72 92 62 100 50 100 C38 100 28 92 28 78 C28 64 36 44 50 44 Z" fill="#fff8e7" stroke={INK} strokeWidth={3} />
      <circle cx={42} cy={64} r={3.4} fill="#7cca4e" />
      <circle cx={58} cy={86} r={4} fill="#7cca4e" />
      <circle cx={60} cy={60} r={2.4} fill="#5aa9ff" />
      <path d="M30 76 L38 72 L44 80 L50 72 L56 80 L62 72 L70 76" fill="none" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M44 52 C46 48 50 46 54 48" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}

/** Disaster-deck back: night sky, a lit volcano. viewBox 0 0 100 140. */
export function DisasterBack() {
  return (
    <svg viewBox="0 0 100 140" className="hld-back-art" role="img" aria-label="Disaster deck" preserveAspectRatio="xMidYMid slice">
      <rect width={100} height={140} fill="#2b1d3f" />
      {[[16, 20], [80, 30], [64, 14], [28, 44], [86, 60]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={1.4} fill="#fff8e7" />)}
      <path d="M0 140 L34 74 H66 L100 140 Z" fill="#6b3a22" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d="M34 74 C38 82 44 78 50 86 C56 78 62 82 66 74 Z" fill="#ff7a1a" stroke={INK} strokeWidth={2} />
      <path d="M44 86 C42 100 48 110 44 140 M56 84 C60 98 54 116 60 140" fill="none" stroke="#ff7a1a" strokeWidth={4} />
      <circle cx={42} cy={58} r={7} fill="#5a4a6a" stroke={INK} strokeWidth={2} />
      <circle cx={56} cy={46} r={9} fill="#5a4a6a" stroke={INK} strokeWidth={2} />
      <circle cx={48} cy={30} r={6} fill="#5a4a6a" stroke={INK} strokeWidth={2} />
      <rect x={8} y={8} width={84} height={124} rx={10} fill="none" stroke="#ff9f1c" strokeWidth={2} strokeDasharray="4 4" />
    </svg>
  );
}
