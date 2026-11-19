// Home-tile art (16:10): a nervous Rex legging it down the Escape Route away
// from an erupting volcano, a meteor inbound, the finish flag just ahead.
// Registered on the module, so it lives in the main bundle: kept lean, and it
// imports useSvgIds from kit/hooks (not the kit index, which carries CSS).

import { useSvgIds } from '@/ui/kit/hooks';
import { DinoShape, INK } from './DinoArt';

export function HldThumbnail() {
  const id = useSvgIds();
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label="Happy Little Dinosaurs" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5fc4ff" />
          <stop offset="1" stopColor="#d4f4ff" />
        </linearGradient>
      </defs>
      <rect width={160} height={100} fill={id.url('sky')} />
      <circle cx={136} cy={18} r={11} fill="#ffe14d" stroke={INK} strokeWidth={2} />
      {/* meteor */}
      <path d="M118 2 L92 26" stroke="#ff7a1a" strokeWidth={9} strokeLinecap="round" />
      <path d="M118 2 L94 24" stroke="#ffd23f" strokeWidth={4} strokeLinecap="round" />
      <circle cx={90} cy={29} r={6} fill="#7a4a2a" stroke={INK} strokeWidth={2} />
      {/* volcano */}
      <path d="M-4 74 L22 30 H40 L66 74 Z" fill="#8a5a3a" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M22 30 C25 36 28 33 31 38 C34 33 37 36 40 30 Z" fill="#ff7a1a" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      <path d="M28 38 C26 50 30 58 27 74 M34 37 C37 49 33 62 36 74" fill="none" stroke="#ff7a1a" strokeWidth={3.4} strokeLinecap="round" />
      <circle cx={26} cy={22} r={6} fill="#cfc6d8" stroke={INK} strokeWidth={1.8} />
      <circle cx={36} cy={14} r={8} fill="#cfc6d8" stroke={INK} strokeWidth={1.8} />
      <circle cx={24} cy={8} r={5} fill="#cfc6d8" stroke={INK} strokeWidth={1.8} />
      {[[12, 12], [46, 22], [50, 6]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={2.6} fill="#ff4d4d" stroke={INK} strokeWidth={1.4} />)}
      {/* ground + route */}
      <path d="M0 70 C40 62 90 74 160 64 V100 H0 Z" fill="#7cca4e" stroke={INK} strokeWidth={2.4} />
      <path d="M8 92 C40 84 70 96 100 86 C120 80 136 80 150 72" fill="none" stroke={INK} strokeWidth={9} strokeLinecap="round" />
      <path d="M8 92 C40 84 70 96 100 86 C120 80 136 80 150 72" fill="none" stroke="#e0b07a" strokeWidth={6} strokeLinecap="round" />
      {/* finish flag */}
      <path d="M150 72 V48" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      <path d="M151 48 H164 L160 53 L164 58 H151 Z" fill="#ff4d4d" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
      {/* the runner */}
      <svg x={74} y={44} width={58} height={48} viewBox="0 0 120 100">
        <DinoShape dino="nervous-rex" mood="scared" />
      </svg>
      <path d="M70 62 H60 M70 70 H56 M72 78 H62" stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.6} />
      {/* a palm in front */}
      <g transform="translate(150 98)">
        {[-50, -15, 20].map((a) => (
          <path key={a} transform={`rotate(${a})`} d="M0 0 C-5 -12 -3 -22 0 -30 C3 -22 5 -12 0 0 Z" fill="#3b963a" stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
        ))}
      </g>
    </svg>
  );
}
