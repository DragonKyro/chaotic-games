// Unstable Unicorns — card art dispatch, type metadata, corner glyphs and the
// card back. Unicorns come from the portrait system (unicornArt.tsx); every
// other card gets an emblem (emblemArt.tsx).

import { hashString } from '@/core/rng';
import { useSvgIds } from '@/ui/kit/hooks';
import type { UuCard, UuCardType } from './types';
import { isUnicornType } from './types';
import { Emblem } from './emblemArt';
import { INK, UnicornPortrait } from './unicornArt';

export const TYPE_META: Record<UuCardType, { label: string; frame: string; frame2: string }> = {
  babyUnicorn: { label: 'Baby Unicorn', frame: '#d6a4ff', frame2: '#ffd0f2' },
  basicUnicorn: { label: 'Basic Unicorn', frame: '#7fd6ff', frame2: '#d4f6ff' },
  magicalUnicorn: { label: 'Magical Unicorn', frame: '#ff5fd2', frame2: '#ffd0f4' },
  diamondUnicorn: { label: 'Diamond Unicorn', frame: '#9ff3ff', frame2: '#ffffff' },
  magic: { label: 'Magic', frame: '#5ff2b0', frame2: '#d4ffef' },
  instant: { label: 'Instant', frame: '#ff4d6d', frame2: '#ffc7d1' },
  upgrade: { label: 'Upgrade', frame: '#ffc94d', frame2: '#fff2c4' },
  downgrade: { label: 'Downgrade', frame: '#a6e14d', frame2: '#e3ffbd' },
};

const WINDOW_TINTS = ['#3a1d5c', '#1d2f5c', '#4a1d4f', '#1d4a52', '#52203a', '#2b2a62', '#3d2452', '#1f3d4a'];

/** The art window's background tint for a card kind (a deep, varied plum). */
export function windowTint(kind: string): string {
  return WINDOW_TINTS[hashString(kind) % WINDOW_TINTS.length]!;
}

/** Corner glyph per card type, on a 0 0 24 24 canvas. */
export function TypeGlyph({ type }: { type: UuCardType }) {
  const s = { stroke: INK, strokeWidth: 1.7, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {(type === 'babyUnicorn' || type === 'basicUnicorn' || type === 'magicalUnicorn' || type === 'diamondUnicorn') && (
        <g {...s}>
          <path d={type === 'babyUnicorn' ? 'M9.5 20 L12 11 L14.5 20 Z' : 'M8.5 21 L12.5 2.5 L15 21 Z'} fill="#fff6b0" />
          <path d={type === 'babyUnicorn' ? 'M10.4 17 L13.6 16' : 'M9.6 16 L14.6 15 M10.6 11 L14 10.2'} fill="none" strokeWidth={1.1} />
          {(type === 'magicalUnicorn' || type === 'diamondUnicorn') && <path d="M19 4 L19.8 6.2 L22 7 L19.8 7.8 L19 10 L18.2 7.8 L16 7 L18.2 6.2 Z" fill="#fff" strokeWidth={1} />}
          {type === 'babyUnicorn' && <path d="M5 8 q-2 -2.5 -3.6 0 q-1.4 2.6 3.6 5 q5 -2.4 3.6 -5 q-1.6 -2.5 -3.6 0 Z" fill="#ff7ab8" strokeWidth={1.1} transform="translate(13 -3)" />}
        </g>
      )}
      {type === 'magic' && (
        <g {...s}>
          <path d="M4 21 L14 11" strokeWidth={3} />
          <path d="M16 2 L17.5 6.5 L22 7.5 L18.5 10 L19.5 14.5 L16 12 L12.5 14.5 L13.5 10 L10 7.5 L14.5 6.5 Z" fill="#9bffd6" />
        </g>
      )}
      {type === 'instant' && <path d="M14 1.5 L5 13.5 h6 L9.5 22.5 L19 10 h-6.4 Z" fill="#ffd23f" {...s} />}
      {type === 'upgrade' && <path d="M12 2.5 L21 12 L15.5 12 L15.5 21.5 L8.5 21.5 L8.5 12 L3 12 Z" fill="#ffe27a" {...s} />}
      {type === 'downgrade' && <path d="M12 21.5 L21 12 L15.5 12 L15.5 2.5 L8.5 2.5 L8.5 12 L3 12 Z" fill="#c6ff7a" {...s} />}
    </svg>
  );
}

/** The illustration for a card, filling its art window. */
export function CardArt({ card }: { card: Pick<UuCard, 'kind' | 'type' | 'name'> }) {
  const id = useSvgIds();
  return (
    <svg viewBox="0 0 100 100" className="uu-art" role="img" aria-label={card.name} preserveAspectRatio="xMidYMid slice">
      {isUnicornType(card.type) ? (
        <UnicornPortrait kind={card.kind} type={card.type === 'diamondUnicorn' ? 'magicalUnicorn' : (card.type as 'babyUnicorn' | 'basicUnicorn' | 'magicalUnicorn')} id={id} />
      ) : (
        <Emblem kind={card.kind} type={card.type} id={id} />
      )}
    </svg>
  );
}

/** The card back (viewBox 0 0 100 140): plum velvet, a holographic horn under a crescent. */
export function CardBack() {
  const id = useSvgIds();
  const stars = [[16, 18], [84, 24], [22, 112], [80, 118], [12, 66], [88, 72], [36, 30], [66, 108]];
  return (
    <svg viewBox="0 0 100 140" className="uu-back" role="img" aria-label="Face-down card" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={id('bg')} cx="50%" cy="45%" r="65%">
          <stop offset="0" stopColor="#5a2370" />
          <stop offset="1" stopColor="#1a0b24" />
        </radialGradient>
        <linearGradient id={id('holo')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5fd2" />
          <stop offset="0.33" stopColor="#ffe27a" />
          <stop offset="0.66" stopColor="#5ff2e6" />
          <stop offset="1" stopColor="#9a6bff" />
        </linearGradient>
        <pattern id={id('dots')} width={6} height={6} patternUnits="userSpaceOnUse">
          <circle cx={3} cy={3} r={0.7} fill="#fff" opacity={0.1} />
        </pattern>
      </defs>
      <rect width={100} height={140} fill={id.url('bg')} />
      <rect width={100} height={140} fill={id.url('dots')} />
      <rect x={6} y={6} width={88} height={128} rx={10} fill="none" stroke={id.url('holo')} strokeWidth={2.4} />
      <rect x={10} y={10} width={80} height={120} rx={8} fill="none" stroke="#fff" strokeOpacity={0.18} strokeDasharray="2 4" />
      {stars.map(([x, y], i) => (
        <path key={i} d={`M${x} ${y! - 3} L${x! + 0.9} ${y! - 0.9} L${x! + 3} ${y} L${x! + 0.9} ${y! + 0.9} L${x} ${y! + 3} L${x! - 0.9} ${y! + 0.9} L${x! - 3} ${y} L${x! - 0.9} ${y! - 0.9} Z`} fill="#fff" opacity={0.65} />
      ))}
      {/* crescent */}
      <path d="M68 40 A26 26 0 1 1 46 26 A20 20 0 1 0 68 40 Z" fill={id.url('holo')} stroke={INK} strokeWidth={2.4} transform="translate(-6 18)" />
      {/* horn through the crescent */}
      <g stroke={INK} strokeWidth={2.4} strokeLinejoin="round">
        <path d="M43 98 L52 30 L59 98 Z" fill={id.url('holo')} />
        <path d="M45 86 L57.5 84 M46.5 74 L56.5 72 M48 62 L55.5 60 M49.5 50 L54.5 48.4 M50.8 40 L53.6 39" fill="none" strokeWidth={1.4} />
      </g>
      <path d="M46 96 L51.5 38" stroke="#fff" strokeWidth={1.6} opacity={0.6} />
    </svg>
  );
}
