// Picker tile art (16:10): a hooded caster on a glowing rune hex under the
// moon, with its shadow self — violet cloak, ember eyes — cast in the lake
// below. Gems drift between them. Lives in the main bundle (module.ts), so it
// imports only the hooks file from the kit, never the kit's stylesheet.

import { useSvgIds } from '@/ui/kit/hooks';

const INK = '#060b16';

function hex(cx: number, cy: number, r: number, sy = 1): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r * sy).toFixed(1)}`;
  }).join(' ');
}

/** Hood + cloak silhouette standing at (x, y feet). */
function Caster({ x, y, s, cloak, rim, eyes, flip = 1 }: { x: number; y: number; s: number; cloak: string; rim: string; eyes: string; flip?: 1 | -1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s} ${s * flip})`}>
      <path d="M-14 0 Q-12 -20 -5 -26 L5 -26 Q12 -20 14 0 Z" fill={cloak} stroke={rim} strokeWidth={0.7} />
      <path d="M-5 -26 L-7 -36 L-1 -31 Z M5 -26 L7 -36 L1 -31 Z" fill={cloak} />
      <path d="M-8 -24 Q-9 -38 0 -40 Q9 -38 8 -24 Q4 -27 0 -27 Q-4 -27 -8 -24 Z" fill={cloak} stroke={rim} strokeWidth={0.7} />
      <ellipse cx={0} cy={-31} rx={5.5} ry={4.6} fill="#000" />
      <ellipse cx={-2.3} cy={-31} rx={1.4} ry={1} fill={eyes} />
      <ellipse cx={2.3} cy={-31} rx={1.4} ry={1} fill={eyes} />
      <circle cx={-2.3} cy={-31} r={2.6} fill={eyes} opacity={0.25} />
      <circle cx={2.3} cy={-31} r={2.6} fill={eyes} opacity={0.25} />
      <path d="M11 0 L10 -24" stroke={rim} strokeWidth={1.2} strokeLinecap="round" />
      <circle cx={10} cy={-26} r={2.6} fill={eyes} stroke={INK} strokeWidth={0.6} />
    </g>
  );
}

function Gem({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} stroke={INK} strokeWidth={1.2} strokeLinejoin="round">
      <polygon points="0,-9 8,-3 0,9 -8,-3" fill={c} />
      <polygon points="-4,-3 0,-6.5 4,-3 0,-1" fill="#fff" fillOpacity={0.5} strokeWidth={0.6} />
    </g>
  );
}

export function Thumbnail() {
  const id = useSvgIds();
  const stars = [[12, 10], [30, 22], [52, 8], [70, 18], [96, 9], [118, 24], [140, 12], [150, 30], [8, 34], [134, 40]];
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label="Casting Shadows" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#03111f" />
          <stop offset="0.6" stopColor="#0b2a3c" />
          <stop offset="1" stopColor="#061827" />
        </linearGradient>
        <radialGradient id={id('moon')} cx="45%" cy="40%" r="60%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#bdf7ff" />
        </radialGradient>
        <radialGradient id={id('halo')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#7cf5ff" stopOpacity={0.5} />
          <stop offset="1" stopColor="#7cf5ff" stopOpacity={0} />
        </radialGradient>
        <linearGradient id={id('lake')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a0b30" />
          <stop offset="1" stopColor="#05020c" />
        </linearGradient>
      </defs>
      <rect width={160} height={100} fill={id.url('sky')} />
      {stars.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 0.6 : 1} fill="#e0fdff" opacity={0.8} />)}
      <circle cx={80} cy={26} r={32} fill={id.url('halo')} />
      <circle cx={80} cy={26} r={15} fill={id.url('moon')} />
      {/* treeline */}
      <path d="M0 58 L6 46 L10 54 L16 40 L22 54 L28 44 L34 58 Z M126 58 L132 42 L138 54 L144 38 L150 52 L156 44 L160 58 Z" fill="#020812" />
      {/* the lake, where the shadow lives */}
      <rect y={58} width={160} height={42} fill={id.url('lake')} />
      <ellipse cx={80} cy={70} rx={14} ry={3} fill="#ff5a3c" opacity={0.35} />
      <path d="M20 74 H48 M108 80 H140 M30 88 H60 M96 92 H124" stroke="#b06bff" strokeOpacity={0.35} strokeWidth={0.8} />
      {/* rune hex at the shore, and its reflection */}
      <polygon points={hex(80, 58, 22, 0.42)} fill="#0e3a4e" stroke="#7cf5ff" strokeWidth={1.6} />
      <polygon points={hex(80, 58, 15, 0.42)} fill="none" stroke="#7cf5ff" strokeOpacity={0.6} strokeWidth={0.8} strokeDasharray="1.5 1.5" />
      <polygon points={hex(80, 62, 22, 0.42)} fill="none" stroke="#b06bff" strokeOpacity={0.5} strokeWidth={1} />
      <Caster x={80} y={57} s={0.82} cloak="#02060c" rim="#7cf5ff" eyes="#bdf7ff" />
      <Caster x={80} y={61} s={0.82} cloak="#1c0b30" rim="#b06bff" eyes="#ff6a2a" flip={-1} />
      {/* drifting gems */}
      <Gem x={46} y={42} s={0.8} c="#ff3d5a" />
      <Gem x={114} y={40} s={0.8} c="#3d8bff" />
      <Gem x={58} y={22} s={0.55} c="#b45cff" />
      <Gem x={104} y={18} s={0.55} c="#ff7a3d" />
      <g transform="translate(132 76) scale(0.9)" stroke={INK} strokeWidth={1} strokeLinejoin="round">
        <polygon points="0,-8 5,-1 2,8 -4,2 -5,-4" fill="#22123a" />
        <polygon points="0,-8 5,-1 0,1" fill="#b06bff" />
      </g>
    </svg>
  );
}
