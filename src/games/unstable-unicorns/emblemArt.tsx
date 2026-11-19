// Unstable Unicorns — emblem art for the non-unicorn cards (Magic, Instant,
// Upgrade, Downgrade). A card's name picks an emblem by keyword (a lasso for
// Rainbow Lasso, a panda for Pandamonium…), falling back to its type's
// default; the kind's hash picks the colours, so no two read alike.
// Canvas 0 0 100 100, centred on 50,52. Original drawings.

import { hashString } from '@/core/rng';
import type { ReactNode } from 'react';
import type { SvgIds } from '@/ui/kit/hooks';
import type { UuCardType } from './types';
import { INK, Sparkles } from './unicornArt';

type Emblem =
  | 'potion' | 'orb' | 'book' | 'wand' | 'vortex' | 'swap' | 'skull' | 'flame' | 'kiss' | 'grab' | 'scales' | 'reset' | 'dice'
  | 'hoof' | 'superHoof' | 'net' | 'redirect' | 'flare' | 'mirror' | 'chest' | 'bell'
  | 'party' | 'rainbow' | 'lasso' | 'cannon' | 'coffee' | 'rope' | 'claw' | 'glitterBomb' | 'gem' | 'shield' | 'anvil' | 'sweater'
  | 'wire' | 'eye' | 'brokenFence' | 'camera' | 'panda' | 'candle' | 'snail' | 'tinyHouse' | 'coal' | 'chain' | 'spiral' | 'brokenHeart';

const RULES: [RegExp, Emblem][] = [
  [/super-neigh/, 'superHoof'],
  [/neigh/, 'hoof'],
  [/net/, 'net'],
  [/redirect|re-target/, 'redirect'],
  [/flare/, 'flare'],
  [/absorb|reflect/, 'mirror'],
  [/chest|treasure|fortune|heist/, 'chest'],
  [/jingle/, 'bell'],
  [/poison|plague|death|black-spot/, 'skull'],
  [/fire|breath|fireball|forge/, 'flame'],
  [/kiss|life/, 'kiss'],
  [/thievery|steal|pillag|booty/, 'grab'],
  [/bargain|good-deal|gift|receipt|deal/, 'scales'],
  [/reset|time-shift|chrono/, 'reset'],
  [/luck|shake|chaos|catastrophe|storm/, 'dice'],
  [/swap|two-for-one|trade/, 'swap'],
  [/tornado|vortex|black-hole|raze/, 'vortex'],
  [/summon|ritual|nightmare-pact|sigil/, 'candle'],
  [/yay|party|vip/, 'party'],
  [/rainbow|aura|prismatic|apocalypse-magic/, 'rainbow'],
  [/lasso/, 'lasso'],
  [/artillery/, 'cannon'],
  [/caffeine|liquid-courage/, 'coffee'],
  [/double-dutch/, 'rope'],
  [/claw/, 'claw'],
  [/glitter-bomb|glitter/, 'glitterBomb'],
  [/bunker|shield|blessing|survival|harness/, 'shield'],
  [/hooves|sanitation|anvil/, 'anvil'],
  [/sweater/, 'sweater'],
  [/barbed|wire/, 'wire'],
  [/blinding|light|ghosted/, 'eye'],
  [/broken|raze/, 'brokenFence'],
  [/nanny|cam|inspector/, 'camera'],
  [/panda/, 'panda'],
  [/sadistic|hex/, 'candle'],
  [/slowdown|walk-of-shame|stage-fright/, 'snail'],
  [/tiny|gingerbread/, 'tinyHouse'],
  [/coal/, 'coal'],
  [/chain|curse/, 'chain'],
  [/humbug|all-out/, 'brokenHeart'],
  [/compass|mysterious/, 'orb'],
  [/dust|diamond/, 'gem'],
];

const DEFAULT: Record<string, Emblem[]> = {
  magic: ['potion', 'wand', 'book', 'orb', 'vortex'],
  instant: ['hoof'],
  upgrade: ['gem', 'party', 'shield'],
  downgrade: ['brokenHeart', 'spiral', 'chain'],
};

const TINTS = ['#ff4fbf', '#38e1ff', '#ffd23f', '#9bff6a', '#b06bff', '#ff7a3d', '#4f8bff', '#ff4f6d'];

function emblemFor(kind: string, type: UuCardType): Emblem {
  for (const [re, e] of RULES) if (re.test(kind)) return e;
  const list = DEFAULT[type] ?? DEFAULT.magic!;
  return list[hashString(kind) % list.length]!;
}

const S = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };

function draw(e: Emblem, c: string, c2: string, id: SvgIds): ReactNode {
  switch (e) {
    case 'potion':
      return (
        <g {...S}>
          <path d="M43 22 L57 22 L57 36 Q74 44 72 64 Q70 82 50 82 Q30 82 28 64 Q26 44 43 36 Z" fill={c} />
          <path d="M31 60 Q50 54 69 60 Q70 80 50 80 Q30 80 31 60 Z" fill={c2} />
          <rect x={40} y={16} width={20} height={7} rx={2} fill="#c9a26b" />
          <circle cx={42} cy={66} r={3} fill="#fff" opacity={0.8} stroke="none" />
          <circle cx={55} cy={70} r={2} fill="#fff" opacity={0.8} stroke="none" />
          <path d="M37 46 Q40 42 44 41" stroke="#fff" fill="none" opacity={0.7} />
        </g>
      );
    case 'orb':
      return (
        <g {...S}>
          <path d="M32 82 L68 82 L62 72 L38 72 Z" fill="#c9a26b" />
          <circle cx={50} cy={50} r={24} fill={c} />
          <path d="M34 56 Q50 30 66 50" fill="none" stroke={c2} strokeWidth={4} />
          <circle cx={42} cy={41} r={5} fill="#fff" opacity={0.6} stroke="none" />
        </g>
      );
    case 'book':
      return (
        <g {...S}>
          <path d="M18 30 Q34 24 50 32 L50 80 Q34 72 18 78 Z" fill={c} />
          <path d="M82 30 Q66 24 50 32 L50 80 Q66 72 82 78 Z" fill={c2} />
          <path d="M26 42 L42 44 M26 50 L42 52 M58 44 L74 42 M58 52 L74 50" strokeWidth={1.6} />
          <path d="M50 14 L52 22 L60 24 L52 26 L50 34 L48 26 L40 24 L48 22 Z" fill="#ffd23f" strokeWidth={1.4} />
        </g>
      );
    case 'wand':
      return (
        <g {...S}>
          <path d="M26 80 L58 44" strokeWidth={6} stroke={INK} />
          <path d="M26 80 L58 44" strokeWidth={3} stroke={c2} />
          <path d="M62 18 L67 33 L82 36 L69 44 L72 60 L60 50 L46 56 L52 42 L42 30 L57 31 Z" fill={c} />
        </g>
      );
    case 'vortex':
      return (
        <g fill="none" {...S}>
          <path d="M50 52 m-4 0 a4 4 0 1 1 8 0 a9 9 0 1 1 -18 0 a14 14 0 1 1 28 0 a20 20 0 1 1 -40 0 a26 26 0 1 1 52 0" stroke={c} strokeWidth={5} />
          <path d="M50 52 m-4 0 a4 4 0 1 1 8 0 a9 9 0 1 1 -18 0 a14 14 0 1 1 28 0 a20 20 0 1 1 -40 0 a26 26 0 1 1 52 0" stroke={INK} strokeWidth={1.2} />
        </g>
      );
    case 'swap':
      return (
        <g {...S}>
          <path d="M22 40 L66 40 L66 30 L82 46 L66 62 L66 52 L22 52 Z" fill={c} />
          <path d="M78 70 L34 70 L34 80 L18 64 L34 48 L34 58 L78 58 Z" fill={c2} transform="translate(0 6)" />
        </g>
      );
    case 'skull':
      return (
        <g {...S}>
          <path d="M28 46 Q28 22 50 22 Q72 22 72 46 Q72 58 64 62 L62 74 L38 74 L36 62 Q28 58 28 46 Z" fill="#f2ecff" />
          <ellipse cx={41} cy={48} rx={6} ry={7} fill={c} />
          <ellipse cx={59} cy={48} rx={6} ry={7} fill={c} />
          <path d="M50 56 L46 63 L54 63 Z" fill={INK} />
          <path d="M44 74 L44 68 M50 74 L50 68 M56 74 L56 68" strokeWidth={1.6} />
        </g>
      );
    case 'flame':
      return (
        <g {...S}>
          <path d="M50 14 Q62 32 70 40 Q82 56 72 72 Q62 86 50 86 Q34 86 28 72 Q20 54 34 40 Q36 52 44 54 Q38 34 50 14 Z" fill={c} />
          <path d="M50 46 Q60 58 60 68 Q58 80 50 80 Q42 80 40 70 Q40 60 50 46 Z" fill={c2} />
        </g>
      );
    case 'kiss':
      return (
        <g {...S}>
          <path d="M50 80 Q18 60 22 38 Q26 24 40 26 Q48 28 50 36 Q52 28 60 26 Q74 24 78 38 Q82 60 50 80 Z" fill={c} />
          <path d="M36 52 Q44 46 50 52 Q56 46 64 52 Q56 62 50 60 Q44 62 36 52 Z" fill={c2} />
        </g>
      );
    case 'grab':
      return (
        <g {...S}>
          <path d="M30 82 L30 50 Q30 42 36 42 L36 30 Q36 24 41 24 Q46 24 46 30 L46 26 Q46 20 51 20 Q56 20 56 26 L56 30 Q56 24 61 24 Q66 24 66 30 L66 40 Q66 34 71 34 Q76 34 76 40 L76 60 Q76 82 58 82 Z" fill={c} />
          <path d="M46 30 L46 46 M56 30 L56 46 M66 40 L66 50" strokeWidth={1.6} />
        </g>
      );
    case 'scales':
      return (
        <g {...S}>
          <path d="M50 20 L50 78 M36 80 L64 80 M22 34 L78 34" strokeWidth={3} />
          <path d="M14 54 L22 34 L30 54 Q22 62 14 54 Z" fill={c} />
          <path d="M70 54 L78 34 L86 54 Q78 62 70 54 Z" fill={c2} />
          <circle cx={50} cy={18} r={4} fill="#ffd23f" />
        </g>
      );
    case 'reset':
      return (
        <g {...S}>
          <circle cx={50} cy={52} r={28} fill={c} />
          <path d="M50 52 L50 34 M50 52 L62 58" strokeWidth={3} />
          <path d="M26 30 Q36 18 52 18 L48 10 M52 18 L44 22" fill="none" strokeWidth={3} stroke={c2} />
        </g>
      );
    case 'dice':
      return (
        <g {...S}>
          <rect x={20} y={34} width={34} height={34} rx={6} fill={c} transform="rotate(-14 37 51)" />
          <rect x={48} y={30} width={32} height={32} rx={6} fill={c2} transform="rotate(16 64 46)" />
          {[[32, 46], [42, 56], [37, 51]].map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r={2.6} fill={INK} stroke="none" />)}
          {[[58, 40], [70, 52]].map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r={2.6} fill={INK} stroke="none" />)}
        </g>
      );
    case 'hoof':
    case 'superHoof': {
      const holo = e === 'superHoof';
      return (
        <g {...S}>
          {holo && (
            <defs>
              <linearGradient id={id('holo')} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#ff4fbf" />
                <stop offset="0.35" stopColor="#ffd23f" />
                <stop offset="0.65" stopColor="#38e1ff" />
                <stop offset="1" stopColor="#b06bff" />
              </linearGradient>
            </defs>
          )}
          <path d="M28 76 Q22 48 34 32 Q50 16 66 32 Q78 48 72 76 L60 76 L58 58 Q50 52 42 58 L40 76 Z" fill={holo ? id.url('holo') : c} />
          <path d="M33 36 Q50 26 67 36" fill="none" strokeWidth={1.4} opacity={0.6} />
          {/* the "no" slash */}
          <circle cx={50} cy={52} r={34} fill="none" stroke="#ff4f6d" strokeWidth={6} />
          <path d="M26 76 L74 28" stroke="#ff4f6d" strokeWidth={6} />
          <circle cx={50} cy={52} r={34} fill="none" strokeWidth={1.4} />
          {holo && <path d="M56 6 L48 26 L58 26 L50 46" fill="none" stroke="#ffd23f" strokeWidth={4} />}
        </g>
      );
    }
    case 'net':
      return (
        <g fill="none" {...S}>
          <path d="M22 26 Q50 40 78 26 Q72 60 50 82 Q28 60 22 26 Z" fill={c} fillOpacity={0.35} />
          <path d="M30 34 L62 78 M42 38 L70 64 M54 38 L36 70 M66 34 L40 76 M26 44 L74 44 M30 58 L70 58" strokeWidth={1.6} />
          <path d="M22 26 Q50 40 78 26" strokeWidth={3} stroke={c2} />
        </g>
      );
    case 'redirect':
      return (
        <g {...S}>
          <path d="M20 70 Q20 34 56 34 L56 22 L80 42 L56 62 L56 50 Q34 50 34 70 Z" fill={c} />
          <circle cx={26} cy={78} r={5} fill={c2} />
        </g>
      );
    case 'flare':
      return (
        <g {...S}>
          <path d="M30 80 L40 50 L52 54 L44 84 Z" fill={c2} />
          <path d="M44 50 Q50 24 70 14 Q62 32 66 44 Z" fill={c} />
          {[[74, 20], [80, 34], [64, 8]].map(([x, y]) => <circle key={`${x}`} cx={x} cy={y} r={3} fill="#ffd23f" />)}
        </g>
      );
    case 'mirror':
      return (
        <g {...S}>
          <ellipse cx={50} cy={46} rx={22} ry={28} fill={c} />
          <ellipse cx={50} cy={46} rx={15} ry={21} fill="#fff" opacity={0.5} />
          <path d="M44 74 L44 86 L56 86 L56 74" fill={c2} />
          <path d="M42 34 L52 28 M40 44 L56 34" stroke="#fff" strokeWidth={2} />
        </g>
      );
    case 'chest':
      return (
        <g {...S}>
          <path d="M20 46 Q20 28 50 28 Q80 28 80 46 Z" fill={c} />
          <rect x={20} y={46} width={60} height={34} rx={3} fill={c} />
          <path d="M20 54 L80 54 M34 28 L34 80 M66 28 L66 80" stroke={c2} strokeWidth={4} />
          <rect x={44} y={48} width={12} height={14} rx={2} fill="#ffd23f" />
        </g>
      );
    case 'bell':
      return (
        <g {...S}>
          <path d="M30 70 Q30 30 50 26 Q70 30 70 70 L76 76 L24 76 Z" fill={c} />
          <circle cx={50} cy={80} r={5} fill={c2} />
          <path d="M44 20 Q50 12 56 20" fill="none" strokeWidth={3} />
        </g>
      );
    case 'party':
      return (
        <g {...S}>
          <path d="M22 82 L44 34 L68 58 Z" fill={c} />
          <path d="M30 64 L52 74 M36 50 L60 64" stroke={c2} strokeWidth={3} />
          {[[58, 22, '#ffd23f'], [76, 34, '#38e1ff'], [72, 16, '#ff4fbf'], [82, 50, '#9bff6a']].map(([x, y, f]) => (
            <rect key={String(x)} x={Number(x)} y={Number(y)} width={6} height={6} rx={1} fill={String(f)} transform={`rotate(30 ${x} ${y})`} />
          ))}
        </g>
      );
    case 'rainbow':
      return (
        <g fill="none" strokeLinecap="round">
          {['#ff4f6d', '#ff9a3d', '#ffe74d', '#5ce07a', '#4fb3ff', '#a96bff'].map((col, i) => (
            <path key={col} d={`M${16 + i * 5} 74 A${34 - i * 5} ${34 - i * 5} 0 0 1 ${84 - i * 5} 74`} stroke={col} strokeWidth={5} />
          ))}
          <path d="M16 74 A34 34 0 0 1 84 74" stroke={INK} strokeWidth={1.4} />
          <circle cx={24} cy={78} r={8} fill="#fff" stroke={INK} strokeWidth={2} />
          <circle cx={76} cy={78} r={8} fill="#fff" stroke={INK} strokeWidth={2} />
        </g>
      );
    case 'lasso':
      return (
        <g fill="none" {...S}>
          <ellipse cx={46} cy={40} rx={26} ry={16} stroke={c} strokeWidth={6} />
          <ellipse cx={46} cy={40} rx={26} ry={16} strokeWidth={1.4} />
          <path d="M66 50 Q74 66 62 82" stroke={c} strokeWidth={6} />
          <path d="M66 50 Q74 66 62 82" strokeWidth={1.4} />
        </g>
      );
    case 'cannon':
      return (
        <g {...S}>
          <path d="M22 62 L68 30 L76 42 L34 74 Z" fill={c} />
          <circle cx={36} cy={74} r={10} fill={c2} />
          <circle cx={80} cy={26} r={6} fill="#ffd23f" />
        </g>
      );
    case 'coffee':
      return (
        <g {...S}>
          <path d="M26 40 L70 40 L64 80 L32 80 Z" fill={c} />
          <path d="M70 48 Q84 48 82 60 Q80 70 66 68" fill="none" strokeWidth={4} />
          <path d="M38 30 Q34 22 40 16 M50 30 Q46 22 52 14 M62 30 Q58 22 64 16" fill="none" strokeWidth={2} stroke={c2} />
        </g>
      );
    case 'rope':
      return (
        <g fill="none" {...S}>
          <path d="M18 30 Q50 96 82 30" stroke={c} strokeWidth={5} />
          <path d="M18 30 Q50 74 82 30" stroke={c2} strokeWidth={5} />
          <rect x={12} y={20} width={10} height={14} rx={3} fill="#c9a26b" />
          <rect x={78} y={20} width={10} height={14} rx={3} fill="#c9a26b" />
        </g>
      );
    case 'claw':
      return (
        <g {...S}>
          <path d="M50 10 L50 34" strokeWidth={3} />
          <rect x={40} y={34} width={20} height={10} rx={3} fill={c} />
          <path d="M42 44 Q30 58 38 72 M58 44 Q70 58 62 72 M50 44 L50 70" fill="none" strokeWidth={4} stroke={c2} />
          <circle cx={50} cy={80} r={8} fill="#ff4fbf" />
        </g>
      );
    case 'glitterBomb':
      return (
        <g {...S}>
          <circle cx={46} cy={58} r={24} fill={c} />
          <path d="M60 36 L66 28" strokeWidth={5} />
          <path d="M66 28 Q72 18 80 20" fill="none" stroke="#c9a26b" strokeWidth={2.4} />
          <Sparkles seed={7} count={4} color="#ffd23f" />
          <circle cx={38} cy={50} r={5} fill="#fff" opacity={0.5} stroke="none" />
        </g>
      );
    case 'gem':
      return (
        <g {...S}>
          <path d="M28 40 L40 24 L60 24 L72 40 L50 82 Z" fill={c} />
          <path d="M28 40 L72 40 M40 24 L46 40 L50 82 M60 24 L54 40 L50 82" strokeWidth={1.4} />
          <path d="M40 24 L46 40 L28 40 Z" fill="#fff" opacity={0.45} />
        </g>
      );
    case 'shield':
      return (
        <g {...S}>
          <path d="M50 16 L78 26 Q78 66 50 84 Q22 66 22 26 Z" fill={c} />
          <path d="M50 24 L70 31 Q70 62 50 76 Z" fill={c2} />
          <path d="M44 48 L50 56 L62 40" fill="none" stroke="#fff" strokeWidth={4} />
        </g>
      );
    case 'anvil':
      return (
        <g {...S}>
          <path d="M18 36 L74 36 Q86 36 86 30 L86 46 Q70 50 64 56 L66 68 L36 68 L38 56 Q26 50 18 46 Z" fill={c} />
          <rect x={30} y={68} width={42} height={10} rx={2} fill={c2} />
        </g>
      );
    case 'sweater':
      return (
        <g {...S}>
          <path d="M34 22 L50 30 L66 22 L86 38 L76 50 L70 46 L70 82 L30 82 L30 46 L24 50 L14 38 Z" fill={c} />
          <path d="M32 58 L68 58 M32 68 L68 68" stroke="#fff" strokeWidth={3} strokeDasharray="4 4" />
          <path d="M50 40 L53 46 L50 52 L47 46 Z" fill="#fff" />
        </g>
      );
    case 'wire':
      return (
        <g fill="none" {...S}>
          <path d="M8 40 Q28 30 50 40 T92 40 M8 64 Q28 54 50 64 T92 64" strokeWidth={3} stroke={c} />
          {[20, 40, 60, 80].map((x) => <path key={x} d={`M${x - 5} ${35 + (x % 3)} L${x + 5} ${47 - (x % 3)} M${x + 5} ${35} L${x - 5} ${47}`} strokeWidth={2.4} />)}
          {[30, 50, 70].map((x) => <path key={x} d={`M${x - 5} 59 L${x + 5} 71 M${x + 5} 59 L${x - 5} 71`} strokeWidth={2.4} />)}
        </g>
      );
    case 'eye':
      return (
        <g {...S}>
          {[0, 45, 90, 135].map((r) => <path key={r} d="M50 6 L50 20 M50 84 L50 98" transform={`rotate(${r} 50 52)`} stroke={c2} strokeWidth={3} />)}
          <path d="M14 52 Q50 14 86 52 Q50 90 14 52 Z" fill="#fff" />
          <circle cx={50} cy={52} r={14} fill={c} />
          <circle cx={50} cy={52} r={6} fill={INK} />
        </g>
      );
    case 'brokenFence':
      return (
        <g {...S}>
          <path d="M14 46 L86 40 M14 64 L86 70" strokeWidth={6} stroke={c} />
          <rect x={20} y={30} width={10} height={50} fill={c2} />
          <path d="M44 30 L54 30 L52 52 L58 58 L50 82 L44 82 Z" fill={c2} transform="rotate(14 49 56)" />
          <rect x={70} y={30} width={10} height={50} fill={c2} />
        </g>
      );
    case 'camera':
      return (
        <g {...S}>
          <rect x={20} y={34} width={52} height={36} rx={6} fill={c} />
          <path d="M72 44 L86 36 L86 68 L72 60 Z" fill={c2} />
          <circle cx={38} cy={52} r={9} fill="#fff" />
          <circle cx={38} cy={52} r={4} fill={INK} />
          <circle cx={64} cy={42} r={3} fill="#ff4f6d" />
        </g>
      );
    case 'panda':
      return (
        <g {...S}>
          <circle cx={30} cy={30} r={10} fill={INK} />
          <circle cx={70} cy={30} r={10} fill={INK} />
          <circle cx={50} cy={54} r={28} fill="#fff" />
          <ellipse cx={39} cy={50} rx={7} ry={9} fill={INK} transform="rotate(-20 39 50)" />
          <ellipse cx={61} cy={50} rx={7} ry={9} fill={INK} transform="rotate(20 61 50)" />
          <circle cx={40} cy={49} r={2} fill="#fff" stroke="none" />
          <circle cx={60} cy={49} r={2} fill="#fff" stroke="none" />
          <ellipse cx={50} cy={64} rx={4} ry={3} fill={INK} />
        </g>
      );
    case 'candle':
      return (
        <g {...S}>
          <rect x={38} y={40} width={24} height={42} rx={3} fill={c} />
          <path d="M38 48 Q44 54 46 48 Q50 56 54 50" fill="none" strokeWidth={1.6} />
          <path d="M50 14 Q60 26 54 36 Q50 40 46 36 Q40 26 50 14 Z" fill="#ffd23f" />
          <path d="M20 84 L80 84" strokeWidth={3} stroke={c2} />
        </g>
      );
    case 'snail':
      return (
        <g {...S}>
          <path d="M14 76 Q14 66 26 66 L74 66 Q82 66 84 76 Z" fill={c2} />
          <circle cx={50} cy={52} r={22} fill={c} />
          <path d="M50 52 m-4 0 a4 4 0 1 1 8 0 a9 9 0 1 1 -18 0 a14 14 0 1 1 28 0" fill="none" strokeWidth={2} />
          <path d="M78 66 L84 46 M84 66 L92 48" strokeWidth={2} />
          <circle cx={84} cy={44} r={2.6} fill={INK} />
          <circle cx={92} cy={46} r={2.6} fill={INK} />
        </g>
      );
    case 'tinyHouse':
      return (
        <g {...S}>
          <path d="M32 50 L50 34 L68 50 L68 74 L32 74 Z" fill={c} />
          <path d="M26 54 L50 30 L74 54" fill="none" strokeWidth={4} stroke={c2} />
          <rect x={45} y={60} width={10} height={14} fill={INK} />
          <path d="M18 80 L82 80" strokeWidth={2} />
        </g>
      );
    case 'coal':
      return (
        <g {...S}>
          <path d="M22 62 L30 40 L52 30 L74 38 L80 62 L62 78 L34 78 Z" fill="#2b2433" />
          <path d="M30 40 L44 52 L52 30 M44 52 L62 78 M44 52 L22 62 M74 38 L60 54 L80 62" strokeWidth={1.2} stroke="#6b5c80" />
          <path d="M42 58 Q46 62 50 58 M56 58 Q60 62 64 58" fill="none" stroke={c} strokeWidth={2} />
        </g>
      );
    case 'chain':
      return (
        <g fill="none" {...S}>
          {[0, 1, 2, 3].map((i) => (
            <ellipse key={i} cx={22 + i * 18} cy={44 + i * 6} rx={11} ry={7} stroke={i % 2 ? c2 : c} strokeWidth={5} transform={`rotate(${i % 2 ? 60 : 20} ${22 + i * 18} ${44 + i * 6})`} />
          ))}
          <circle cx={82} cy={74} r={10} fill="#3b3249" stroke={INK} strokeWidth={2} />
        </g>
      );
    case 'spiral':
      return (
        <g fill="none" {...S}>
          <path d="M50 52 m-3 0 a3 3 0 1 1 6 0 a8 8 0 1 1 -16 0 a13 13 0 1 1 26 0 a19 19 0 1 1 -38 0 a25 25 0 1 1 50 0" stroke={c} strokeWidth={4} />
          <path d="M30 24 L36 30 M70 24 L64 30" strokeWidth={3} />
        </g>
      );
    case 'brokenHeart':
    default:
      return (
        <g {...S}>
          <path d="M50 80 Q18 60 22 38 Q26 24 40 26 Q48 28 50 36 L44 48 L54 56 L48 68 Z" fill={c} />
          <path d="M52 34 Q54 28 60 26 Q74 24 78 38 Q82 60 54 78 L58 64 L50 56 L58 46 Z" fill={c2} transform="translate(4 2)" />
        </g>
      );
  }
}

/** The art for one non-unicorn card (a <g>; the caller owns the <svg>). */
export function Emblem({ kind, type, id }: { kind: string; type: UuCardType; id: SvgIds }) {
  const h = hashString(kind);
  const c = TINTS[h % TINTS.length]!;
  const c2 = TINTS[(h >>> 7) % TINTS.length] === c ? TINTS[(h + 3) % TINTS.length]! : TINTS[(h >>> 7) % TINTS.length]!;
  return <g>{draw(emblemFor(kind, type), c, c2, id)}</g>;
}
