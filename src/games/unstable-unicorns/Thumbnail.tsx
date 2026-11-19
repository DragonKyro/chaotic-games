// Home-page tile (16:10): a side-eyeing unicorn with a holographic horn on a
// glitter night, fanned cards, and a NEIGH! hoof stamp. Imports only the
// portrait system (unicornArt.tsx) and the kit's hooks — this lands in the
// main bundle via module.ts.

import { useSvgIds } from '@/ui/kit/hooks';
import { INK, Sparkles, UnicornHead, unicornLook } from './unicornArt';

export function Thumbnail() {
  const id = useSvgIds();
  const hero = { ...unicornLook('thumbnail-hero', 'magicalUnicorn'), eyes: 'side' as const, mouth: 'fang' as const, horn: 'crystal' as const, coat: '#f4e8ff', mane: ['#ff4fbf', '#9a4dff', '#38e1ff'], accessories: [] as never[], magical: true };
  const stars = [[12, 14], [30, 8], [146, 12], [128, 22], [150, 50], [8, 46], [20, 84], [140, 86]];
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label="Unstable Unicorns" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={id('bg')} cx="50%" cy="40%" r="75%">
          <stop offset="0" stopColor="#6a2386" />
          <stop offset="0.6" stopColor="#2a0d3a" />
          <stop offset="1" stopColor="#12061a" />
        </radialGradient>
        <linearGradient id={id('holo')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff5fd2" />
          <stop offset="0.35" stopColor="#ffe27a" />
          <stop offset="0.7" stopColor="#5ff2e6" />
          <stop offset="1" stopColor="#9a6bff" />
        </linearGradient>
      </defs>
      <rect width={160} height={100} fill={id.url('bg')} />
      {stars.map(([x, y], i) => (
        <path key={i} d={`M${x} ${y! - 2.4} L${x! + 0.7} ${y! - 0.7} L${x! + 2.4} ${y} L${x! + 0.7} ${y! + 0.7} L${x} ${y! + 2.4} L${x! - 0.7} ${y! + 0.7} L${x! - 2.4} ${y} L${x! - 0.7} ${y! - 0.7} Z`} fill="#fff" opacity={0.75} />
      ))}
      {/* rainbow arc behind */}
      <g fill="none" strokeLinecap="round" opacity={0.9}>
        {['#ff4f6d', '#ff9a3d', '#ffe74d', '#5ce07a', '#4fb3ff', '#a96bff'].map((c, i) => (
          <path key={c} d={`M${22 + i * 4} 100 A${58 - i * 4} ${58 - i * 4} 0 0 1 ${138 - i * 4} 100`} stroke={c} strokeWidth={4} />
        ))}
      </g>
      {/* fanned cards */}
      <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
        <g transform="rotate(-20 32 70)">
          <rect x={14} y={44} width={34} height={48} rx={5} fill="#ff4d6d" />
          <rect x={18} y={48} width={26} height={26} rx={3} fill="#3a1d5c" />
          <path d="M24 70 Q22 58 27 53 Q31 50 35 53 Q40 58 38 70 L34 70 L33.5 64 Q31 62.5 28.5 64 L28 70 Z" fill="#ffc7d1" strokeWidth={1.4} />
        </g>
        <g transform="rotate(18 128 70)">
          <rect x={112} y={44} width={34} height={48} rx={5} fill="#ffc94d" />
          <rect x={116} y={48} width={26} height={26} rx={3} fill="#1d2f5c" />
          <path d="M122 70 L129 52 L136 70 Z M126 64 L132 64" fill="#ffe27a" strokeWidth={1.4} />
        </g>
      </g>
      {/* the unicorn */}
      <g transform="translate(36 -2) scale(0.9)">
        <Sparkles seed={0x9e3779b9} count={6} />
        <UnicornHead look={hero} id={id} />
      </g>
      {/* NEIGH! stamp */}
      <g transform="rotate(-12 34 22)">
        <rect x={8} y={12} width={52} height={20} rx={5} fill="#12061a" opacity={0.6} />
        <rect x={8} y={12} width={52} height={20} rx={5} fill="none" stroke="#ff4d6d" strokeWidth={2.6} />
        <text x={34} y={27.5} textAnchor="middle" fontSize={13} fontWeight={900} fill="#ff4d6d" fontFamily="Shrikhand, Bungee, Impact, sans-serif" letterSpacing={0.5}>NEIGH!</text>
      </g>
      <rect x={1} y={1} width={158} height={98} fill="none" stroke={id.url('holo')} strokeWidth={2} opacity={0.6} />
    </svg>
  );
}
