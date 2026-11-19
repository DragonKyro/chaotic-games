// Picker tile art: a tavern table at night — a lit lantern, a crest over
// crossed swords, bone dice, and something with glowing eyes in the dark.
// Imported by module.ts, so only the kit's hooks (no kit CSS) come along.

import { useSvgIds } from '@/ui/kit/hooks';
import { SigilShape } from './sigils';

const INK = '#1d140d';

export function Thumbnail() {
  const id = useSvgIds();
  const pip = (cx: number, cy: number) => <circle cx={cx} cy={cy} r={1.9} fill={INK} />;
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label="Here to Slay" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={id('room')} cx="22%" cy="40%" r="90%">
          <stop offset="0" stopColor="#7a4a22" />
          <stop offset="0.45" stopColor="#3a200f" />
          <stop offset="1" stopColor="#120905" />
        </radialGradient>
        <radialGradient id={id('glow')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#ffd27a" stopOpacity={0.85} />
          <stop offset="1" stopColor="#ffb02e" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={id('table')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a3e1e" />
          <stop offset="1" stopColor="#2e180b" />
        </linearGradient>
      </defs>
      <rect width={160} height={100} fill={id.url('room')} />
      {/* the thing in the dark */}
      <g opacity={0.95}>
        <path d="M118 66 Q112 40 128 28 L122 14 L132 22 L136 10 L140 24 L150 16 L146 32 Q160 42 156 66 Z" fill="#0b0607" />
        <path d="M104 44 L88 30 L94 44 L82 44 L96 54 Z M160 40 L172 28 L166 44 L176 46 L160 54 Z" fill="#0b0607" />
        <ellipse cx={133} cy={34} rx={2.4} ry={1.8} fill="#ff7a2e" />
        <ellipse cx={143} cy={34} rx={2.4} ry={1.8} fill="#ff7a2e" />
        <circle cx={133} cy={34} r={5} fill="#ff7a2e" opacity={0.25} />
        <circle cx={143} cy={34} r={5} fill="#ff7a2e" opacity={0.25} />
      </g>
      {/* lantern glow + lantern */}
      <circle cx={30} cy={40} r={40} fill={id.url('glow')} />
      <g stroke={INK} strokeWidth={1.8} strokeLinejoin="round">
        <path d="M30 6 V12" fill="none" />
        <path d="M24 12 H36 L38 17 H22 Z" fill="#5a3a1e" />
        <path d="M22 17 H38 V42 H22 Z" fill="#ffcf6a" />
        <path d="M27 17 V42 M33 17 V42" strokeWidth={0.9} />
        <path d="M21 42 H39 L37 47 H23 Z" fill="#5a3a1e" />
      </g>
      <path d="M30 39 Q25 32 30 23 Q35 32 30 39 Z" fill="#fff6d0" />
      {/* the table */}
      <path d="M0 70 Q80 60 160 70 V100 H0 Z" fill={id.url('table')} />
      <path d="M0 70 Q80 60 160 70" fill="none" stroke="#9a6a3c" strokeWidth={1.4} opacity={0.6} />
      {/* crossed swords behind the crest */}
      <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
        <path d="M50 20 L54 16 L104 74 L100 78 Z" fill="#dfe6ee" />
        <path d="M110 20 L106 16 L56 74 L60 78 Z" fill="#dfe6ee" />
        <path d="M94 80 L106 68 M66 80 L54 68" stroke="#e8b84a" strokeWidth={4.5} />
      </g>
      {/* the crest */}
      <g stroke={INK} strokeLinejoin="round">
        <path d="M60 22 H100 V48 C100 64 90 74 80 79 C70 74 60 64 60 48 Z" fill="#b3262b" strokeWidth={2.6} />
        <path d="M60 22 H100 V33 H60 Z" fill="#e8b84a" strokeWidth={2} />
        <path d="M64 52 L80 40 L96 52 L96 58 L80 46 L64 58 Z" fill="#ece6d6" strokeWidth={1.6} />
      </g>
      <g transform="translate(72 23.5) scale(0.62)"><SigilShape cls="fighter" fill="#7a1d17" /></g>
      <path d="M60 22 H100 V48 C100 64 90 74 80 79" fill="none" stroke="#ffffff" strokeOpacity={0.2} strokeWidth={1.2} />
      {/* bone dice */}
      <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
        <g transform="rotate(-14 46 82)">
          <rect x={36} y={72} width={20} height={20} rx={4} fill="#f4ecd8" />
          {pip(41, 77)}{pip(51, 77)}{pip(41, 82)}{pip(51, 82)}{pip(41, 87)}{pip(51, 87)}
        </g>
        <g transform="rotate(12 116 84)">
          <rect x={106} y={74} width={20} height={20} rx={4} fill="#f4ecd8" />
          {pip(111, 79)}{pip(121, 79)}{pip(116, 84)}{pip(111, 89)}{pip(121, 89)}
        </g>
      </g>
    </svg>
  );
}
