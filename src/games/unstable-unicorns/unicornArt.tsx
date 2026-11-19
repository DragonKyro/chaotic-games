// Unstable Unicorns — the unicorn portrait system (original art, inline SVG).
//
// One parametric head (front-facing, centred on a 0 0 100 100 canvas: face at
// 50,54, horn base at 50,30) drawn in the "glitter-goth" style: candy coats,
// gradient manes, sharp holographic horns, and a side-eye that says it will
// betray you. Every card kind hashes to its own coat / mane / horn / eyes /
// mouth, and its name picks an accessory (pirates get eye patches, queens get
// crowns), so hundreds of cards read as one set without being drawn by hand.
// Narwhals get their own body. Babies are rounder with a nub of a horn;
// Magical Unicorns get an aura.
//
// Kept apart from the emblem art so the home-page Thumbnail (main bundle)
// pulls in only this file.

import { hashString } from '@/core/rng';
import type { ReactNode } from 'react';
import type { SvgIds } from '@/ui/kit/hooks';

export const INK = '#1b0f24';

const pick = <T,>(h: number, shift: number, list: readonly T[]): T => list[(h >>> shift) % list.length]!;

const COAT_BY_COLOUR: Record<string, string> = {
  red: '#ff6b7f', pink: '#ffa3da', orange: '#ffb067', yellow: '#ffe27a', green: '#86e6a8',
  blue: '#86cbff', indigo: '#9a97ff', purple: '#cfa2ff', black: '#3b3249', white: '#f7f2ff',
  brown: '#bf9070', rainbow: '#fff7fd', death: '#2c2434',
};
const COATS = ['#e9d8ff', '#bff3df', '#ffd6c4', '#c6e7ff', '#ffc6df', '#fff2a8', '#dcc8ff', '#b8f1f3', '#ffb3a8', '#c9c3e3', '#fff4e2', '#e0b3ff'];
const MANES: readonly (readonly string[])[] = [
  ['#ff4fbf', '#8f4dff'],
  ['#38e1ff', '#4a6bff'],
  ['#ffd23f', '#ff7a3d'],
  ['#9bff6a', '#19c2a4'],
  ['#d65bff', '#ff4f8f'],
  ['#ff5b5b', '#ffb13d', '#ffe74d', '#5ce07a', '#4fb3ff', '#a96bff'],
  ['#2b1a3a', '#e0245e'],
  ['#e8e6ff', '#a68cff'],
];
const RAINBOW = MANES[5]!;

export type HornStyle = 'spiral' | 'crystal' | 'chipped' | 'curved';
export type EyeStyle = 'sweet' | 'sly' | 'side' | 'manic' | 'sleepy';
type Mouth = 'smirk' | 'fang' | 'grin' | 'pout' | 'tongue';
export type Accessory =
  | 'none' | 'crown' | 'halo' | 'darkHalo' | 'hood' | 'wizardHat' | 'santaHat' | 'antlers' | 'eyepatch' | 'bandana'
  | 'helmet' | 'wings' | 'tophat' | 'monocle' | 'catEars' | 'floppyEars' | 'fangs' | 'shades' | 'flames' | 'flowers'
  | 'bow' | 'stitches' | 'foxTails' | 'explorer' | 'hearts' | 'goggles' | 'fins' | 'lashes';

/** Which accessories (in drawing order) a card's name earns. First match wins per slot. */
const ACCESSORY_RULES: [RegExp, Accessory[]][] = [
  [/dark-angel|angel-of-death/, ['darkHalo', 'wings']],
  [/archangel|angel/, ['halo', 'wings']],
  [/queen|princess|royal|great-narwhal|bahamut/, ['crown']],
  [/santa/, ['santaHat']],
  [/reindeer|rudolph/, ['antlers']],
  [/krampus/, ['antlers', 'fangs']],
  [/pirate|cutthroat|pillaging|shabby/, ['eyepatch', 'bandana']],
  [/black-knight|knight|paladin/, ['helmet']],
  [/reaper|death|phantom|necromancer|nightmare|plague/, ['hood']],
  [/vampire/, ['fangs', 'darkHalo']],
  [/mage|oracle|wizard|sorcer/, ['wizardHat']],
  [/flying|majestic|swift|scaled|dragon-riders/, ['wings']],
  [/classy|sugar-daddy|chronocorn|order/, ['tophat', 'monocle']],
  [/kittencorn|kitten/, ['catEars']],
  [/puppicorn|llamacorn/, ['floppyEars']],
  [/travel|shades/, ['shades']],
  [/phoenix|chaos|hells|fire|war/, ['flames']],
  [/zombie|pestilence/, ['stitches']],
  [/foxicorn/, ['foxTails', 'catEars']],
  [/treasure|adventur|explorer/, ['explorer']],
  [/polyamorous|seductive|alluring/, ['lashes', 'hearts']],
  [/torpedo|survival/, ['goggles']],
  [/shark|mermaid/, ['fins']],
  [/dragon/, ['fangs']],
  [/bardicorn|stripper|hangover/, ['bow']],
];

export interface UnicornLook {
  coat: string;
  mane: readonly string[];
  horn: HornStyle;
  hornFill: readonly [string, string];
  eyes: EyeStyle;
  mouth: Mouth;
  accessories: Accessory[];
  baby: boolean;
  magical: boolean;
  narwhal: boolean;
  /** Baby Death and its kin: a skull mask on the face. */
  skull: boolean;
}

const HORN_FILLS: readonly (readonly [string, string])[] = [
  ['#fff6b0', '#ffb3f0'],
  ['#e0fbff', '#9fa8ff'],
  ['#ffe3a3', '#ff9a5c'],
  ['#f2e8ff', '#c0a2ff'],
];

/** The deterministic look of a unicorn card. */
export function unicornLook(kind: string, type: 'babyUnicorn' | 'basicUnicorn' | 'magicalUnicorn'): UnicornLook {
  const h = hashString(kind);
  const colour = kind.match(/^(?:baby|basic)-(\w+)$/)?.[1];
  const baby = type === 'babyUnicorn';
  const narwhal = /narwhal/.test(kind);
  const accessories: Accessory[] = [];
  for (const [re, acc] of ACCESSORY_RULES) {
    if (re.test(kind)) for (const a of acc) if (!accessories.includes(a)) accessories.push(a);
    if (accessories.length >= 2) break;
  }
  if (accessories.length === 0 && type === 'magicalUnicorn') accessories.push(pick(h, 23, ['none', 'bow', 'flowers', 'none', 'hearts'] as const));
  const coat = colour && COAT_BY_COLOUR[colour] ? COAT_BY_COLOUR[colour]! : pick(h, 0, COATS);
  const goth = /death|dark|nightmare|black|hells|reaper|vampire|phantom|plague|chaos/.test(kind);
  const mane = colour === 'rainbow' || /rainbow/.test(kind) ? RAINBOW : goth ? MANES[6]! : pick(h, 5, MANES);
  return {
    coat: goth && !colour ? '#3a3046' : coat,
    mane,
    horn: /diamond|crystal|prismatic/.test(kind) ? 'crystal' : pick(h, 9, ['spiral', 'crystal', 'chipped', 'curved', 'spiral'] as const),
    hornFill: pick(h, 12, HORN_FILLS),
    eyes: baby ? pick(h, 15, ['sweet', 'sweet', 'side', 'sleepy'] as const) : pick(h, 15, ['sly', 'side', 'manic', 'sly', 'sleepy', 'side', 'sweet'] as const),
    mouth: baby ? pick(h, 18, ['pout', 'smirk', 'tongue'] as const) : /shark|vampire|chainsaw|stabby|krampus|dragon/.test(kind) ? 'fang' : pick(h, 18, ['smirk', 'fang', 'grin', 'smirk', 'tongue'] as const),
    accessories,
    baby,
    magical: type === 'magicalUnicorn',
    narwhal,
    skull: kind === 'baby-death' || kind === 'unicorn-of-death',
  };
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function sparkle(x: number, y: number, r: number, fill = '#fff') {
  return <path d={`M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z`} fill={fill} />;
}

export function Sparkles({ seed = 0, count = 5, color = '#fff' }: { seed?: number; count?: number; color?: string }) {
  return (
    <g opacity={0.9}>
      {Array.from({ length: count }, (_, i) => {
        const a = ((seed >>> (i * 3)) % 360) * (Math.PI / 180) + i * 1.3;
        const d = 34 + ((seed >>> (i * 2)) % 12);
        return <g key={i}>{sparkle(50 + Math.cos(a) * d, 50 + Math.sin(a) * d * 0.9, 2.2 + (i % 3), color)}</g>;
      })}
    </g>
  );
}

function Horn({ style, fill, id, scale = 1 }: { style: HornStyle; fill: readonly [string, string]; id: SvgIds; scale?: number }) {
  const t = `translate(50 31) scale(${scale}) translate(-50 -31)`;
  const g = id.url('horn');
  return (
    <g transform={t} stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
      <defs>
        <linearGradient id={id('horn')} x1="0" y1="1" x2="0.4" y2="0">
          <stop offset="0" stopColor={fill[1]} />
          <stop offset="1" stopColor={fill[0]} />
        </linearGradient>
      </defs>
      {style === 'spiral' && (
        <>
          <path d="M44.5 32 L51.5 2.5 L55.5 32 Z" fill={g} />
          <path d="M45.6 27.5 L55 25.4 M46.8 22 L54.2 20 M48 16.5 L53.4 15 M49.2 11 L52.6 10" stroke={INK} strokeWidth={1.4} fill="none" />
        </>
      )}
      {style === 'crystal' && (
        <>
          <path d="M44 32 L46.5 17 L51 1.5 L54.5 17 L56 32 Z" fill={g} />
          <path d="M46.5 17 L50 21 L54.5 17 M50 21 L50 32 M51 1.5 L50 21" stroke={INK} strokeWidth={1.2} fill="none" opacity={0.7} />
          <path d="M46.5 17 L50 21 L50 32 L44 32 Z" fill="#fff" opacity={0.35} stroke="none" />
        </>
      )}
      {style === 'chipped' && (
        <>
          <path d="M44.5 32 L49 9 L52 6.5 L53 11 L55.5 32 Z" fill={g} />
          <path d="M49 9 L51 12.5 L52 6.5" fill="none" strokeWidth={1.3} />
          <path d="M47 24 L50.5 20 L49 17" fill="none" strokeWidth={1.1} opacity={0.6} />
        </>
      )}
      {style === 'curved' && (
        <>
          <path d="M44.5 32 Q44 14 58 3 Q52 16 55.5 32 Z" fill={g} />
          <path d="M46 25 Q50 23 54.6 24 M47 17 Q51 15 54.4 16" fill="none" strokeWidth={1.3} />
        </>
      )}
      <path d="M47 30 L49.5 9" stroke="#fff" strokeWidth={1.4} opacity={0.65} fill="none" />
    </g>
  );
}

function Eyes({ style, coat, baby }: { style: EyeStyle; coat: string; baby: boolean }) {
  const r = baby ? 1.25 : 1;
  const eye = (cx: number, side: 1 | -1) => {
    switch (style) {
      case 'sweet':
        return (
          <g key={cx}>
            <ellipse cx={cx} cy={53} rx={4.4 * r} ry={5.4 * r} fill={INK} />
            <circle cx={cx - 1.4} cy={51} r={1.7 * r} fill="#fff" />
            <circle cx={cx + 1.6} cy={55.4} r={0.8 * r} fill="#fff" />
          </g>
        );
      case 'sleepy':
        return (
          <g key={cx} fill="none" stroke={INK} strokeWidth={2} strokeLinecap="round">
            <path d={`M${cx - 4.5} 52.5 Q${cx} 56.5 ${cx + 4.5} 52.5`} />
            <path d={`M${cx - 4.2 * side} 53.6 l${-1.8 * side} 1.6 M${cx} 55.6 l0 2.2`} strokeWidth={1.3} />
          </g>
        );
      case 'manic':
        return (
          <g key={cx}>
            <circle cx={cx} cy={53} r={5.6 * r} fill="#fff" stroke={INK} strokeWidth={1.8} />
            <circle cx={cx + side * 0.6} cy={53.4} r={1.7} fill={INK} />
            {sparkle(cx - 2.4, 50.5, 1.4, '#ff4fbf')}
          </g>
        );
      case 'side':
        return (
          <g key={cx}>
            <ellipse cx={cx} cy={53.5} rx={5.2 * r} ry={4.4 * r} fill="#fff" stroke={INK} strokeWidth={1.8} />
            <circle cx={cx + 2.3} cy={54.4} r={2.4 * r} fill={INK} />
            {/* the lid: flat and unimpressed */}
            <path d={`M${cx - 5.6 * r} 52.2 L${cx + 5.6 * r} 52.2 L${cx + 5.6 * r} 48 L${cx - 5.6 * r} 48 Z`} fill={coat} />
            <path d={`M${cx - 5.6 * r} 52.2 L${cx + 5.6 * r} 52.2`} stroke={INK} strokeWidth={2} />
          </g>
        );
      case 'sly':
      default:
        return (
          <g key={cx}>
            <ellipse cx={cx} cy={53.5} rx={4.4 * r} ry={4.8 * r} fill={INK} />
            <circle cx={cx + side * 1.4} cy={52.6} r={1.3} fill="#fff" />
            <path d={`M${cx - 5.2} ${side > 0 ? 50.4 : 52.6} L${cx + 5.2} ${side > 0 ? 52.6 : 50.4} L${cx + 5.2} 47 L${cx - 5.2} 47 Z`} fill={coat} />
            <path d={`M${cx - 5.2} ${side > 0 ? 50.4 : 52.6} L${cx + 5.2} ${side > 0 ? 52.6 : 50.4}`} stroke={INK} strokeWidth={2} strokeLinecap="round" />
          </g>
        );
    }
  };
  const brows = !baby && (style === 'sly' || style === 'manic' || style === 'side');
  return (
    <g>
      {eye(41, -1)}
      {eye(59, 1)}
      {brows && (
        <g stroke={INK} strokeWidth={2} strokeLinecap="round">
          <path d={style === 'manic' ? 'M35.5 44 L44 45.5' : 'M36 45.5 L45 47.5'} />
          <path d={style === 'manic' ? 'M64.5 44 L56 45.5' : 'M64 45.5 L55 47.5'} />
        </g>
      )}
    </g>
  );
}

function MouthShape({ mouth }: { mouth: Mouth }) {
  const s = { fill: 'none', stroke: INK, strokeWidth: 1.9, strokeLinecap: 'round' as const };
  switch (mouth) {
    case 'fang':
      return (
        <g>
          <path d="M44 73.5 Q50 77.5 57 72.5" {...s} />
          <path d="M51.5 75.6 L53 79.6 L54.6 74.6 Z" fill="#fff" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
        </g>
      );
    case 'grin':
      return <path d="M43 72.5 Q50 80 57 72.5 Z" fill="#fff" stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />;
    case 'pout':
      return <ellipse cx={50} cy={74.5} rx={2.2} ry={1.8} fill={INK} />;
    case 'tongue':
      return (
        <g>
          <path d="M45 73 Q50 76.5 55 73" {...s} />
          <path d="M48.6 75 Q49.5 80 52 79 Q53.6 78 52.4 74.6" fill="#ff7aa8" stroke={INK} strokeWidth={1.2} />
        </g>
      );
    case 'smirk':
    default:
      return <path d="M45 74 Q50.5 76.8 56.5 72" {...s} />;
  }
}

/** Accessories that sit behind the head. */
function BackAccessory({ a, id }: { a: Accessory; id: SvgIds }) {
  switch (a) {
    case 'wings':
      return (
        <g fill="#fff" stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M30 58 Q8 40 10 22 Q18 34 24 32 Q20 44 32 50 Z" />
          <path d="M70 58 Q92 40 90 22 Q82 34 76 32 Q80 44 68 50 Z" />
          <path d="M14 30 Q20 40 28 44 M86 30 Q80 40 72 44" fill="none" strokeWidth={1.2} opacity={0.6} />
        </g>
      );
    case 'hood':
      return <path d="M22 96 Q18 52 30 32 Q50 6 70 32 Q82 52 78 96 Z" fill="#241a30" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />;
    case 'foxTails':
      return (
        <g fill="#ff9a4d" stroke={INK} strokeWidth={1.8}>
          {[-40, -15, 15, 40].map((r) => (
            <path key={r} d="M50 92 Q38 70 46 52 Q52 70 50 92 Z" transform={`rotate(${r} 50 92)`} />
          ))}
        </g>
      );
    case 'flames':
      return (
        <g stroke={INK} strokeWidth={1.8} strokeLinejoin="round">
          <path d="M14 78 Q2 46 22 26 Q20 42 30 42 Q26 20 44 4 Q44 24 54 26 Q58 8 72 2 Q66 22 74 34 Q82 22 90 18 Q100 48 86 78 Z" fill={id.url('flame')} />
          <path d="M26 70 Q20 52 30 40 Q32 50 38 50 Q38 34 48 24 Q50 38 58 38 Q62 28 70 24 Q68 38 74 46 Q80 58 74 70 Z" fill="#ffd23f" opacity={0.8} />
          <defs>
            <linearGradient id={id('flame')} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#ff3d5a" />
              <stop offset="1" stopColor="#ffd23f" />
            </linearGradient>
          </defs>
        </g>
      );
    case 'darkHalo':
      return <ellipse cx={50} cy={16} rx={20} ry={5.4} fill="none" stroke="#7c2bff" strokeWidth={4} />;
    default:
      return null;
  }
}

/** Accessories drawn over the face. */
function FrontAccessory({ a }: { a: Accessory }) {
  switch (a) {
    case 'crown':
      return (
        <g fill="#ffd23f" stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M33 34 L33 22 L39.5 28 L44 18 L50 26 L56 18 L60.5 28 L67 22 L67 34 Z" />
          <circle cx={44} cy={18} r={2} fill="#ff4fbf" />
          <circle cx={56} cy={18} r={2} fill="#38e1ff" />
        </g>
      );
    case 'halo':
      return <ellipse cx={50} cy={10} rx={17} ry={4.6} fill="none" stroke="#ffe27a" strokeWidth={3.4} />;
    case 'wizardHat':
      return (
        <g transform="rotate(-24 30 30)" stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M16 36 L28 2 L42 36 Z" fill="#5b2bd6" />
          <ellipse cx={29} cy={36} rx={17} ry={4} fill="#5b2bd6" />
          {sparkle(28, 22, 3, '#ffd23f')}
        </g>
      );
    case 'santaHat':
      return (
        <g transform="rotate(-22 32 30)" stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M16 36 Q24 6 44 14 Q36 22 42 36 Z" fill="#ff3d5a" />
          <rect x={14} y={32} width={30} height={7} rx={3.5} fill="#fff" />
          <circle cx={44} cy={14} r={4} fill="#fff" />
        </g>
      );
    case 'antlers':
      return (
        <g fill="none" stroke="#8a5a3b" strokeWidth={3.4} strokeLinecap="round">
          <path d="M34 34 Q26 20 30 8 M30 18 L22 14 M31 12 L26 6" />
          <path d="M66 34 Q74 20 70 8 M70 18 L78 14 M69 12 L74 6" />
          <circle cx={50} cy={67} r={4.2} fill="#ff3d5a" stroke={INK} strokeWidth={1.6} />
        </g>
      );
    case 'eyepatch':
      return (
        <g>
          <path d="M28 44 L72 60" stroke={INK} strokeWidth={2} />
          <ellipse cx={59} cy={53.5} rx={7} ry={6.4} fill={INK} />
        </g>
      );
    case 'bandana':
      return (
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M28 40 Q50 22 72 40 L72 34 Q50 16 28 34 Z" fill="#ff3d5a" />
          <path d="M72 37 L82 32 L80 42 Z" fill="#ff3d5a" />
          <circle cx={42} cy={32} r={1.4} fill="#fff" stroke="none" />
          <circle cx={56} cy={30} r={1.4} fill="#fff" stroke="none" />
        </g>
      );
    case 'helmet':
      return (
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M27 50 Q26 26 50 24 Q74 26 73 50 L66 50 L66 44 L34 44 L34 50 Z" fill="#9aa3c2" />
          <path d="M34 44 L66 44" strokeWidth={1.4} />
          <path d="M30 34 Q50 28 70 34" fill="none" stroke="#fff" strokeWidth={1.4} opacity={0.6} />
        </g>
      );
    case 'tophat':
      return (
        <g transform="rotate(-16 30 26)" stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <rect x={20} y={6} width={20} height={22} rx={2} fill="#2b1a3a" />
          <rect x={20} y={20} width={20} height={4} fill="#ff4fbf" />
          <ellipse cx={30} cy={28} rx={15} ry={3.6} fill="#2b1a3a" />
        </g>
      );
    case 'monocle':
      return (
        <g fill="none" stroke="#ffd23f" strokeWidth={2}>
          <circle cx={59} cy={53.5} r={7.4} />
          <path d="M66 58 Q70 66 66 76" strokeWidth={1.2} />
        </g>
      );
    case 'catEars':
      return (
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M26 44 L24 26 L38 34 Z" fill="#ff9fd6" />
          <path d="M74 44 L76 26 L62 34 Z" fill="#ff9fd6" />
          <path d="M30 64 L18 62 M30 68 L19 70 M70 64 L82 62 M70 68 L81 70" strokeWidth={1.2} />
        </g>
      );
    case 'floppyEars':
      return (
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round" fill="#c79a74">
          <path d="M30 40 Q14 46 18 66 Q26 64 32 50 Z" />
          <path d="M70 40 Q86 46 82 66 Q74 64 68 50 Z" />
        </g>
      );
    case 'fangs':
      return (
        <g fill="#fff" stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
          <path d="M45.5 74 L47 79 L48.6 74.6 Z" />
          <path d="M51.4 74.6 L53 79 L54.5 74 Z" />
        </g>
      );
    case 'shades':
      return (
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M33 49 L48 49 L46 57 L35 57 Z" fill="#2b1a3a" />
          <path d="M52 49 L67 49 L65 57 L54 57 Z" fill="#2b1a3a" />
          <path d="M48 51 L52 51" />
          <path d="M37 51 L42 51" stroke="#38e1ff" strokeWidth={1.4} />
        </g>
      );
    case 'flowers':
      return (
        <g stroke={INK} strokeWidth={1.4}>
          {[[34, 36, '#ff7ab8'], [42, 31, '#ffe27a'], [58, 31, '#9bff6a'], [66, 36, '#7ad3ff']].map(([x, y, c]) => (
            <g key={String(x)}>
              <circle cx={Number(x)} cy={Number(y)} r={3.6} fill={String(c)} />
              <circle cx={Number(x)} cy={Number(y)} r={1.2} fill="#fff" />
            </g>
          ))}
        </g>
      );
    case 'bow':
      return (
        <g stroke={INK} strokeWidth={1.8} strokeLinejoin="round" fill="#ff4fbf">
          <path d="M62 34 L72 28 L72 40 Z" />
          <path d="M62 34 L52 28 L52 40 Z" />
          <circle cx={62} cy={34} r={2.6} />
        </g>
      );
    case 'stitches':
      return (
        <g stroke={INK} strokeWidth={1.4} fill="none" strokeLinecap="round">
          <path d="M33 40 L44 46 M35 39 L33 43 M38 41 L36 45 M41 43 L39 47" />
          <path d="M60 62 L68 58 M62 59 L63 63 M65 58 L66 62" />
        </g>
      );
    case 'explorer':
      return (
        <g transform="rotate(-10 50 30)" stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <ellipse cx={50} cy={32} rx={28} ry={5} fill="#c9a26b" />
          <path d="M34 32 Q36 16 50 16 Q64 16 66 32 Z" fill="#d9b47c" />
          <path d="M35 28 L65 28" stroke="#8a5a3b" strokeWidth={3} />
        </g>
      );
    case 'hearts':
      return (
        <g fill="#ff4f8f" stroke={INK} strokeWidth={1.3}>
          <path d="M80 26 q-4 -5 -7 0 q-3 5 7 10 q10 -5 7 -10 q-3 -5 -7 0 Z" />
          <path d="M20 40 q-3 -4 -5.5 0 q-2.5 4 5.5 8 q8 -4 5.5 -8 q-2.5 -4 -5.5 0 Z" />
        </g>
      );
    case 'goggles':
      return (
        <g stroke={INK} strokeWidth={2}>
          <path d="M28 48 L72 48" strokeWidth={4} stroke="#8a5a3b" />
          <circle cx={41} cy={52} r={6.4} fill="#7ad3ff" fillOpacity={0.55} />
          <circle cx={59} cy={52} r={6.4} fill="#7ad3ff" fillOpacity={0.55} />
        </g>
      );
    case 'fins':
      return <path d="M44 34 Q48 14 62 12 Q56 22 58 34 Z" fill="#7ad3ff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />;
    case 'lashes':
      return (
        <g stroke={INK} strokeWidth={1.4} strokeLinecap="round">
          <path d="M35.5 49 l-3 -3 M37.5 47.6 l-1.6 -3.6 M64.5 49 l3 -3 M62.5 47.6 l1.6 -3.6" />
          <path d="M47 74.6 Q50 77 53 74.6" stroke="#ff3d7a" strokeWidth={2.6} />
        </g>
      );
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// The unicorn and the narwhal
// ---------------------------------------------------------------------------

function ManeGradient({ id, mane }: { id: SvgIds; mane: readonly string[] }) {
  return (
    <linearGradient id={id('mane')} x1="0" y1="0" x2="1" y2="1">
      {mane.map((c, i) => <stop key={i} offset={mane.length === 1 ? 0 : i / (mane.length - 1)} stopColor={c} />)}
    </linearGradient>
  );
}

export function UnicornHead({ look, id }: { look: UnicornLook; id: SvgIds }) {
  const { coat, baby } = look;
  const maneFill = id.url('mane');
  const back: Accessory[] = look.accessories.filter((a) => a === 'wings' || a === 'hood' || a === 'foxTails' || a === 'flames' || a === 'darkHalo');
  const front = look.accessories.filter((a) => !back.includes(a));
  const covered = look.accessories.includes('helmet') || look.accessories.includes('hood');
  const body = (
    <g>
      {back.map((a) => <BackAccessory key={a} a={a} id={id} />)}
      {/* neck */}
      <path d="M36 98 L38 74 L62 74 L64 98 Z" fill={coat} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M38 80 Q50 86 62 80" fill="none" stroke={INK} strokeWidth={1.2} opacity={0.3} />
      {/* mane, behind the face */}
      <path
        d="M30 40 Q22 50 25 64 Q18 72 24 86 Q30 80 33 72 Q32 62 36 56 Z M70 40 Q80 48 77 62 Q84 72 77 86 Q71 78 68 70 Q70 60 64 54 Z"
        fill={maneFill}
        stroke={INK}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {/* ears */}
      {!covered && (
        <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
          <path d="M33 40 L29 19 L45 33 Z" fill={coat} />
          <path d="M67 40 L71 19 L55 33 Z" fill={coat} />
          <path d="M33.5 36 L31.5 25 L39.5 32 Z M66.5 36 L68.5 25 L60.5 32 Z" fill="#ff9fd6" strokeWidth={0} />
        </g>
      )}
      {/* head + muzzle */}
      <ellipse cx={50} cy={53} rx={22.5} ry={20.5} fill={coat} stroke={INK} strokeWidth={2.4} />
      <ellipse cx={50} cy={68} rx={15.5} ry={11.5} fill={coat} stroke={INK} strokeWidth={2.4} />
      <ellipse cx={50} cy={69} rx={13.5} ry={9.5} fill="#fff" opacity={0.42} />
      <ellipse cx={41} cy={45} rx={6} ry={4} fill="#fff" opacity={0.35} />
      {look.skull && (
        <g fill="#f7f2ff" stroke={INK} strokeWidth={1.4}>
          <path d="M34 52 Q34 36 50 36 Q66 36 66 52 Q66 60 60 62 L58 68 L42 68 L40 62 Q34 60 34 52 Z" />
          <path d="M45 68 L45 64 M50 68 L50 64 M55 68 L55 64" />
        </g>
      )}
      {/* blush */}
      <ellipse cx={35.5} cy={62} rx={4.4} ry={2.6} fill="#ff6fae" opacity={baby ? 0.6 : 0.38} />
      <ellipse cx={64.5} cy={62} rx={4.4} ry={2.6} fill="#ff6fae" opacity={baby ? 0.6 : 0.38} />
      {/* nostrils */}
      <ellipse cx={45.5} cy={68} rx={1.5} ry={1.1} fill={INK} />
      <ellipse cx={54.5} cy={68} rx={1.5} ry={1.1} fill={INK} />
      <Eyes style={look.skull ? 'manic' : look.eyes} coat={coat} baby={baby} />
      <MouthShape mouth={look.mouth} />
      {/* forelock */}
      <path d="M36 36 Q40 26 50 30 Q58 24 66 34 Q60 32 57 38 Q52 32 47 38 Q42 33 36 36 Z" fill={maneFill} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      {front.filter((a) => a !== 'crown' && a !== 'halo').map((a) => <FrontAccessory key={a} a={a} />)}
      <Horn style={look.horn} fill={look.hornFill} id={id} scale={baby ? 0.5 : 1} />
      {front.filter((a) => a === 'crown' || a === 'halo').map((a) => <FrontAccessory key={a} a={a} />)}
    </g>
  );
  return (
    <g>
      <defs>
        <ManeGradient id={id} mane={look.mane} />
      </defs>
      {baby ? <g transform="translate(50 60) scale(1.12) translate(-50 -58)">{body}</g> : body}
    </g>
  );
}

function Narwhal({ look, id }: { look: UnicornLook; id: SvgIds }) {
  const front = look.accessories.filter((a) => a !== 'wings' && a !== 'hood' && a !== 'foxTails' && a !== 'flames');
  return (
    <g>
      <defs>
        <ManeGradient id={id} mane={look.mane} />
        <linearGradient id={id('tusk')} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={look.hornFill[1]} />
          <stop offset="1" stopColor={look.hornFill[0]} />
        </linearGradient>
      </defs>
      {/* waves */}
      <path d="M0 86 Q12 80 24 86 T48 86 T72 86 T100 86 L100 100 L0 100 Z" fill="#4fb3ff" opacity={0.5} />
      {/* tail */}
      <path d="M78 66 Q90 56 96 44 Q90 60 98 66 Q88 66 82 74 Z" fill={look.coat} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      {/* body */}
      <path d="M14 70 Q12 44 40 42 Q70 40 84 64 Q78 86 46 88 Q16 88 14 70 Z" fill={look.coat} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M20 76 Q46 90 76 74 Q64 84 46 85 Q28 85 20 76 Z" fill="#fff" opacity={0.45} />
      {/* spots in the mane colours */}
      <circle cx={56} cy={52} r={3} fill={id.url('mane')} />
      <circle cx={64} cy={58} r={2.2} fill={id.url('mane')} />
      <circle cx={50} cy={48} r={1.8} fill={id.url('mane')} />
      {/* tusk: a long spiral out of the forehead */}
      <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
        <path d={look.horn === 'crystal' ? 'M28 48 L8 10 L34 44 Z' : 'M27 49 L6 8 L34 45 Z'} fill={id.url('tusk')} />
        <path d="M24 42 L31 39 M20 34 L27 32 M16 26 L22 25 M12 18 L17 18" strokeWidth={1.2} fill="none" />
      </g>
      <ellipse cx={30} cy={62} rx={3} ry={3.6} fill={INK} />
      <circle cx={29} cy={60.6} r={1.1} fill="#fff" />
      <path d="M33 70 Q38 73 43 69" fill="none" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      <ellipse cx={24} cy={68} rx={3.6} ry={2.2} fill="#ff6fae" opacity={0.5} />
      <g transform="translate(-16 6)">{front.map((a) => <FrontAccessory key={a} a={a} />)}</g>
    </g>
  );
}

/** The art for one unicorn card (a <g>; the caller owns the <svg>). */
export function UnicornPortrait({ kind, type, id }: { kind: string; type: 'babyUnicorn' | 'basicUnicorn' | 'magicalUnicorn'; id: SvgIds }): ReactNode {
  const look = unicornLook(kind, type);
  const seed = hashString(kind);
  return (
    <g>
      {look.magical && (
        <g opacity={0.55}>
          <circle cx={50} cy={50} r={44} fill="none" stroke="#fff" strokeWidth={1} strokeDasharray="2 5" />
          <Sparkles seed={seed} count={5} />
        </g>
      )}
      {look.narwhal ? <Narwhal look={look} id={id} /> : <UnicornHead look={look} id={id} />}
    </g>
  );
}
