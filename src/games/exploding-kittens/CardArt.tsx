// Exploding Kittens — hand-drawn card art, inline SVG.
//
// Original art, not traced from the retail cards: same joke, our own drawing.
// Everything is built from one canonical cat head (centred at 50,56 on a
// 0 0 100 100 canvas) plus per-card props, so thirteen cards read as one set.
// No raster assets — the whole game ships as vector inside the JS bundle.
//
// Palette is deliberately tiny: warm creams and tans for fur, one hot accent
// per card, and a single near-black ink for every outline.

import type { ReactElement } from 'react';
import { useSvgIds } from '@/ui/kit/hooks';
import type { EkBaseCardKind } from './types';
import { CARD_LABEL } from './cards';

const INK = '#221f33';
const PINK = '#f2909f';

// Fur tones, reused across the set.
const FUR = {
  tan: '#f6c48a',
  cream: '#fbeacf',
  grey: '#c3bfd0',
  ginger: '#ef9a5c',
  brown: '#b07b52',
  spud: '#c99a63',
} as const;

type Eyes = 'normal' | 'wide' | 'angry' | 'happy' | 'dead' | 'shifty' | 'glow';

interface HeadProps {
  fur?: string;
  eyes?: Eyes;
  /** Draw the mouth open (screaming, retching). */
  open?: boolean;
  /** Skip the whiskers when something else occupies that space. */
  whiskers?: boolean;
}

/**
 * The canonical head. Coordinates are hardcoded rather than derived so the
 * shapes stay hand-tuned; move or resize it with a wrapping <g transform>.
 */
function CatHead({ fur = FUR.tan, eyes = 'normal', open = false, whiskers = true }: HeadProps) {
  return (
    <g stroke={INK} strokeWidth={2.6} strokeLinejoin="round" strokeLinecap="round">
      {/* ears */}
      <path d="M32,42 L27,19 L49,34 Z" fill={fur} />
      <path d="M68,42 L73,19 L51,34 Z" fill={fur} />
      <path d="M33,38 L31,26 L43,34 Z" fill={PINK} strokeWidth={1.6} />
      <path d="M67,38 L69,26 L57,34 Z" fill={PINK} strokeWidth={1.6} />
      {/* head */}
      <circle cx={50} cy={56} r={23} fill={fur} />
      {/* eyes */}
      <CatEyes kind={eyes} />
      {/* nose */}
      <path d="M50,59.5 L46.4,63 L53.6,63 Z" fill={PINK} strokeWidth={1.6} />
      {/* mouth */}
      {open ? (
        <path d="M44,66 q6,9 12,0 q-6,4 -12,0 Z" fill="#8d3b52" strokeWidth={1.8} />
      ) : (
        <>
          <path d="M50,63 q-4,5 -7,1" fill="none" strokeWidth={1.8} />
          <path d="M50,63 q4,5 7,1" fill="none" strokeWidth={1.8} />
        </>
      )}
      {/* whiskers */}
      {whiskers && (
        <g strokeWidth={1.5} fill="none">
          <path d="M28,58 L14,55" />
          <path d="M28,62 L14,64" />
          <path d="M72,58 L86,55" />
          <path d="M72,62 L86,64" />
        </g>
      )}
    </g>
  );
}

function CatEyes({ kind }: { kind: Eyes }) {
  if (kind === 'dead') {
    return (
      <g strokeWidth={2.6} fill="none">
        <path d="M38,49 L46,56 M46,49 L38,56" />
        <path d="M54,49 L62,56 M62,49 L54,56" />
      </g>
    );
  }
  if (kind === 'happy') {
    return (
      <g strokeWidth={2.4} fill="none">
        <path d="M37,54 q5,-6 10,0" />
        <path d="M53,54 q5,-6 10,0" />
      </g>
    );
  }
  if (kind === 'angry') {
    return (
      <g>
        <circle cx={42} cy={54} r={3.4} fill={INK} stroke="none" />
        <circle cx={58} cy={54} r={3.4} fill={INK} stroke="none" />
        <path d="M35,46 L48,50" strokeWidth={2.6} fill="none" />
        <path d="M65,46 L52,50" strokeWidth={2.6} fill="none" />
      </g>
    );
  }
  if (kind === 'wide') {
    return (
      <g>
        <circle cx={42} cy={53} r={6.4} fill="#fff" />
        <circle cx={58} cy={53} r={6.4} fill="#fff" />
        <circle cx={42.6} cy={53.6} r={2.8} fill={INK} stroke="none" />
        <circle cx={58.6} cy={53.6} r={2.8} fill={INK} stroke="none" />
      </g>
    );
  }
  if (kind === 'shifty') {
    return (
      <g>
        <circle cx={42} cy={53} r={5.4} fill="#fff" />
        <circle cx={58} cy={53} r={5.4} fill="#fff" />
        <circle cx={44.6} cy={54} r={2.4} fill={INK} stroke="none" />
        <circle cx={60.6} cy={54} r={2.4} fill={INK} stroke="none" />
      </g>
    );
  }
  if (kind === 'glow') {
    return (
      <g>
        <ellipse cx={42} cy={53} rx={5.6} ry={6.4} fill="#a8e6ff" />
        <ellipse cx={58} cy={53} rx={5.6} ry={6.4} fill="#a8e6ff" />
        <path d="M42,48 L42,58" strokeWidth={2.8} />
        <path d="M58,48 L58,58" strokeWidth={2.8} />
      </g>
    );
  }
  return (
    <g>
      <circle cx={42} cy={53.5} r={4.6} fill="#fff" />
      <circle cx={58} cy={53.5} r={4.6} fill="#fff" />
      <circle cx={42} cy={54} r={2.4} fill={INK} stroke="none" />
      <circle cx={58} cy={54} r={2.4} fill={INK} stroke="none" />
    </g>
  );
}

// ============================================================================
// Per-card art
// ============================================================================

function ExplodingKittenArt() {
  return (
    <g>
      {/* blast */}
      <path
        d="M50,2 L58,22 L78,10 L72,32 L96,34 L76,48 L94,64 L70,64 L78,88 L58,74 L50,98 L42,74 L22,88 L30,64 L6,64 L24,48 L4,34 L28,32 L22,10 L42,22 Z"
        fill="#ff6b3d" stroke={INK} strokeWidth={2.6} strokeLinejoin="round"
      />
      <path
        d="M50,14 L56,28 L70,20 L66,36 L82,38 L68,48 L80,60 L64,60 L69,76 L56,66 L50,84 L44,66 L31,76 L36,60 L20,60 L32,48 L18,38 L34,36 L30,20 L44,28 Z"
        fill="#ffd24a" stroke="none"
      />
      <g transform="translate(0,4) scale(0.78) translate(14,12)">
        <CatHead fur={FUR.ginger} eyes="dead" open whiskers={false} />
      </g>
    </g>
  );
}

function DefuseArt() {
  return (
    <g>
      {/* the bomb, wearing a very relieved cat face */}
      <circle cx={44} cy={64} r={26} fill="#3a3752" stroke={INK} strokeWidth={2.6} />
      <ellipse cx={33} cy={53} rx={7} ry={4.5} fill="#6b6790" stroke="none" opacity={0.7} transform="rotate(-30 33 53)" />
      <g stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round">
        <path d="M32,60 q5,-6 10,0" />
        <path d="M48,60 q5,-6 10,0" />
      </g>
      <path d="M45,66 L41.4,69.5 L48.6,69.5 Z" fill={PINK} stroke={INK} strokeWidth={1.6} />
      <g stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round">
        <path d="M45,69.5 q-4,5 -7,1" />
        <path d="M45,69.5 q4,5 7,1" />
      </g>
      {/* fuse, and the snipped-off end tumbling away */}
      <path d="M56,42 Q72,26 84,33" fill="none" stroke="#c98a4b" strokeWidth={4.5} strokeLinecap="round" />
      <path d="M92,28 q5,-5 4,-11" fill="none" stroke="#c98a4b" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
      {/* scissors — the finger loops are what make it read as scissors */}
      <g strokeLinecap="round" strokeLinejoin="round">
        <path d="M64,46 L92,26" stroke={INK} strokeWidth={7} />
        <path d="M64,26 L92,44" stroke={INK} strokeWidth={7} />
        <path d="M64,46 L92,26" stroke="#cdd2e4" strokeWidth={3.6} />
        <path d="M64,26 L92,44" stroke="#cdd2e4" strokeWidth={3.6} />
        <circle cx={61} cy={48} r={5.4} fill="none" stroke={INK} strokeWidth={3} />
        <circle cx={61} cy={24} r={5.4} fill="none" stroke={INK} strokeWidth={3} />
        <circle cx={78} cy={35} r={2} fill={INK} stroke="none" />
      </g>
      {/* phew */}
      <g stroke="#4fd18b" strokeWidth={4.5} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8,24 L16,33 L32,10" />
      </g>
    </g>
  );
}

function NopeArt() {
  return (
    <g>
      <g transform="translate(0,3) scale(0.9) translate(5.5,2)">
        <CatHead fur={FUR.grey} eyes="angry" whiskers={false} />
      </g>
      {/* the universal "absolutely not" circle-slash */}
      <circle cx={50} cy={54} r={36} fill="none" stroke="#e33b4e" strokeWidth={8} opacity={0.92} />
      <path d="M25,79 L75,29" stroke="#e33b4e" strokeWidth={8} strokeLinecap="round" opacity={0.92} />
    </g>
  );
}

function AttackArt() {
  return (
    <g>
      <g transform="translate(-4,2) scale(0.92) translate(4,2)">
        <CatHead fur={FUR.ginger} eyes="angry" open whiskers={false} />
      </g>
      {/* claw slashes */}
      <g stroke="#fff" strokeWidth={5} strokeLinecap="round" opacity={0.95}>
        <path d="M70,16 L86,54" />
        <path d="M80,14 L94,48" />
        <path d="M60,20 L74,60" />
      </g>
      <g stroke="#e33b4e" strokeWidth={2} strokeLinecap="round">
        <path d="M70,16 L86,54" />
        <path d="M80,14 L94,48" />
        <path d="M60,20 L74,60" />
      </g>
    </g>
  );
}

function SkipArt() {
  return (
    <g>
      <g transform="translate(-10,4) scale(0.86) translate(6,2)">
        <CatHead fur={FUR.cream} eyes="shifty" whiskers={false} />
      </g>
      {/* nope-ing out, stage right */}
      <g stroke={INK} strokeWidth={2.6} fill="#5ec2e0" strokeLinejoin="round">
        <path d="M62,36 L84,56 L62,76 Z" />
        <path d="M78,36 L100,56 L78,76 Z" />
      </g>
      {/* speed lines */}
      <g stroke={INK} strokeWidth={2} strokeLinecap="round" opacity={0.5}>
        <path d="M8,40 L22,40" />
        <path d="M4,54 L20,54" />
        <path d="M8,68 L22,68" />
      </g>
    </g>
  );
}

function FavorArt() {
  return (
    <g>
      <g transform="translate(-14,-14) scale(0.74)">
        <CatHead fur={FUR.brown} eyes="happy" whiskers={false} />
      </g>
      {/* One big open paw, palm up. An earlier version drew a curving foreleg
        * across the card and everyone read it as a tail. */}
      <g stroke={INK} strokeWidth={2.6} strokeLinejoin="round">
        <path d="M58,100 L62,82 L90,82 L94,100 Z" fill={FUR.brown} />
        <ellipse cx={76} cy={75} rx={18} ry={13} fill={FUR.brown} />
        <ellipse cx={76} cy={77} rx={9.5} ry={6.5} fill={PINK} strokeWidth={1.5} />
        <circle cx={63} cy={65} r={4.2} fill={PINK} strokeWidth={1.5} />
        <circle cx={75} cy={61} r={4.2} fill={PINK} strokeWidth={1.5} />
        <circle cx={88} cy={65} r={4.2} fill={PINK} strokeWidth={1.5} />
      </g>
      {/* pleeease */}
      <g transform="translate(76,22) scale(2.2)">
        <path
          d="M0,7 C-8,-1 -6,-11 0,-6 C6,-11 8,-1 0,7 Z"
          fill="#f2647c" stroke={INK} strokeWidth={1.1} strokeLinejoin="round"
        />
      </g>
    </g>
  );
}

function ShuffleArt() {
  const PawBack = ({ x, y, rot }: { x: number; y: number; rot: number }) => (
    <g transform={`rotate(${rot} ${x + 17} ${y + 23})`}>
      <rect x={x} y={y} width={34} height={46} rx={5} fill="#2b2544" stroke={INK} strokeWidth={2.6} />
      <g fill={FUR.tan} stroke="none">
        <ellipse cx={x + 17} cy={y + 30} rx={9} ry={6.5} />
        <circle cx={x + 8} cy={y + 20} r={3.1} />
        <circle cx={x + 14} cy={y + 16} r={3.3} />
        <circle cx={x + 21} cy={y + 16} r={3.3} />
        <circle cx={x + 27} cy={y + 20} r={3.1} />
      </g>
    </g>
  );
  return (
    <g>
      {/* two cards swapping places */}
      <PawBack x={10} y={46} rot={-16} />
      <PawBack x={56} y={46} rot={16} />
      {/* a proper two-way cycle */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22,36 Q50,10 78,32" stroke={INK} strokeWidth={7} />
        <path d="M22,36 Q50,10 78,32" stroke="#5ec2e0" strokeWidth={3.6} />
        <path d="M78,32 L68,30 M78,32 L77,21" stroke={INK} strokeWidth={4} />
        <path d="M78,46 Q50,72 22,50" stroke={INK} strokeWidth={7} />
        <path d="M78,46 Q50,72 22,50" stroke="#5ec2e0" strokeWidth={3.6} />
        <path d="M22,50 L32,52 M22,50 L23,61" stroke={INK} strokeWidth={4} />
      </g>
    </g>
  );
}

function SeeTheFutureArt() {
  return (
    <g>
      {/* crystal ball */}
      <ellipse cx={50} cy={86} rx={26} ry={8} fill="#7d5a9c" stroke={INK} strokeWidth={2.6} />
      <circle cx={50} cy={54} r={30} fill="#b79ce0" stroke={INK} strokeWidth={2.6} opacity={0.95} />
      <circle cx={50} cy={54} r={30} fill="none" stroke="#fff" strokeWidth={1.4} opacity={0.6} />
      <ellipse cx={39} cy={42} rx={8} ry={5} fill="#fff" opacity={0.55} transform="rotate(-28 39 42)" />
      {/* the future is three cards, and one of them is bad news */}
      <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
        <rect x={30} y={44} width={13} height={20} rx={2.5} fill="#fbf6ea" transform="rotate(-12 36 54)" />
        <rect x={43} y={42} width={13} height={20} rx={2.5} fill="#fbf6ea" />
        <rect x={56} y={44} width={13} height={20} rx={2.5} fill="#ffb0a0" transform="rotate(12 62 54)" />
        <path d="M60,56 L66,50 M66,56 L60,50" stroke="#c0392b" strokeWidth={2} />
      </g>
      {/* sparkles */}
      <g fill="#ffe89a" stroke="none">
        <path d="M18,20 l2.5,6 6,2.5 -6,2.5 -2.5,6 -2.5,-6 -6,-2.5 6,-2.5 Z" />
        <path d="M84,26 l2,4.6 4.6,2 -4.6,2 -2,4.6 -2,-4.6 -4.6,-2 4.6,-2 Z" />
      </g>
    </g>
  );
}

function TacoCatArt() {
  return (
    <g>
      {/* the shell: a thick crescent opening upward */}
      <path
        d="M13,48 a37,37 0 0 0 74,0 l-11,0 a26,26 0 0 1 -52,0 Z"
        fill="#f0b93f" stroke={INK} strokeWidth={2.6} strokeLinejoin="round"
      />
      {/* fillings peeking out either side of the cat */}
      <g fill="none" strokeLinecap="round">
        <path d="M22,50 q28,-16 56,0" stroke="#63bd5e" strokeWidth={11} />
        <path d="M27,54 q23,-12 46,0" stroke="#e0574a" strokeWidth={8} />
      </g>
      {/* cat tucked down INTO the shell — floating above it read as a cat in a bowl */}
      <g transform="translate(19,5) scale(0.62)">
        <CatHead fur={FUR.tan} eyes="happy" whiskers={false} />
      </g>
      {/* front rim last, so the cat sits inside the shell rather than on it */}
      <path
        d="M13,48 a37,37 0 0 0 74,0 l-11,0 a26,26 0 0 1 -52,0 Z"
        fill="#f0b93f" stroke={INK} strokeWidth={2.6} strokeLinejoin="round"
      />
      <path d="M24,62 q26,9 52,0" fill="none" stroke="#d99b2b" strokeWidth={2.4} strokeLinecap="round" />
    </g>
  );
}

function RainbowRalphingCatArt() {
  // Head is placed first so the rainbow can start exactly at its mouth: the
  // transform below puts the mouth at roughly (44,48) on the card canvas.
  return (
    <g>
      <g transform="translate(4,-6) scale(0.8) rotate(-12 50 56)">
        <CatHead fur={FUR.cream} eyes="dead" open whiskers={false} />
      </g>
      {/* out it comes */}
      <g strokeLinecap="round" fill="none" strokeWidth={8}>
        <path d="M46,48 Q72,56 94,68" stroke="#e33b4e" />
        <path d="M45,50 Q69,62 89,79" stroke="#f2913b" />
        <path d="M44,52 Q65,69 81,90" stroke="#f4d03f" />
        <path d="M43,54 Q59,74 69,97" stroke="#5eb85e" />
        <path d="M42,56 Q51,77 55,100" stroke="#4a90d9" />
      </g>
      {/* a couple of escaping droplets */}
      <g fill="#8ec8f0" stroke={INK} strokeWidth={1.4}>
        <circle cx={88} cy={52} r={3} />
        <circle cx={96} cy={88} r={2.4} />
      </g>
    </g>
  );
}

function CattermelonArt() {
  return (
    <g>
      {/* watermelon wedge */}
      <path d="M6,80 a44,44 0 0 1 88,0 Z" fill="#e8455f" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M6,80 a44,44 0 0 1 88,0" fill="none" stroke="#8fd35a" strokeWidth={8} />
      <path d="M6,80 a44,44 0 0 1 88,0" fill="none" stroke={INK} strokeWidth={2.6} />
      {/* seeds */}
      <g fill={INK} stroke="none">
        <ellipse cx={30} cy={64} rx={2.4} ry={3.4} transform="rotate(-18 30 64)" />
        <ellipse cx={50} cy={70} rx={2.4} ry={3.4} />
        <ellipse cx={70} cy={64} rx={2.4} ry={3.4} transform="rotate(18 70 64)" />
      </g>
      {/* cat face melting out of the fruit */}
      <g transform="translate(0,-20) scale(0.66) translate(25,18)">
        <CatHead fur={FUR.cream} eyes="normal" whiskers={false} />
      </g>
    </g>
  );
}

function HairyPotatoCatArt() {
  return (
    <g>
      {/* ears first, so the lumpy body overlaps their base */}
      <g stroke={INK} strokeWidth={2.6} strokeLinejoin="round">
        <path d="M30,40 L24,15 L48,32 Z" fill={FUR.spud} />
        <path d="M70,40 L76,15 L52,32 Z" fill={FUR.spud} />
        <path d="M31,36 L28,22 L42,32 Z" fill={PINK} strokeWidth={1.6} />
        <path d="M69,36 L72,22 L58,32 Z" fill={PINK} strokeWidth={1.6} />
      </g>
      {/* lumpy potato body */}
      <path
        d="M23,56 q-5,-22 15,-27 q22,-6 34,7 q14,13 6,32 q-8,20 -29,20 q-23,0 -26,-32 Z"
        fill={FUR.spud} stroke={INK} strokeWidth={2.6} strokeLinejoin="round"
      />
      {/* hair. so much hair. */}
      <g stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none">
        <path d="M36,32 q-3,-11 3,-16" />
        <path d="M43,30 q-1,-13 5,-16" />
        <path d="M50,29 q1,-13 7,-15" />
        <path d="M57,31 q4,-12 11,-13" />
        <path d="M63,35 q7,-9 14,-8" />
        <path d="M23,46 q-11,-5 -15,-2" />
        <path d="M20,54 q-12,-1 -15,3" />
        <path d="M79,48 q11,-4 15,0" />
        <path d="M81,57 q12,0 15,4" />
        <path d="M26,70 q-11,4 -13,10" />
        <path d="M74,72 q11,5 13,11" />
        <path d="M46,88 q-2,9 2,12" />
        <path d="M56,88 q3,9 8,10" />
      </g>
      {/* face, sunk into the spud */}
      <g transform="translate(0,3)">
        <CatEyes kind="normal" />
      </g>
      <path d="M50,66 L46.4,69.5 L53.6,69.5 Z" fill={PINK} stroke={INK} strokeWidth={1.6} />
      <g stroke={INK} strokeWidth={1.8} fill="none" strokeLinecap="round">
        <path d="M50,69.5 q-4,5 -7,1" />
        <path d="M50,69.5 q4,5 7,1" />
      </g>
      {/* potato blemishes */}
      <g fill={INK} stroke="none" opacity={0.28}>
        <ellipse cx={33} cy={74} rx={3.2} ry={2.2} />
        <ellipse cx={68} cy={48} rx={2.8} ry={2} />
        <ellipse cx={60} cy={80} rx={2.4} ry={1.8} />
      </g>
    </g>
  );
}

function BeardCatArt() {
  return (
    <g>
      {/* The beard. TAPERS to a point — a constant-width version reads as a
        * wooden bucket, which is exactly what the first attempt looked like. */}
      <path
        d="M21,44
           C17,58 24,66 29,73
           C34,81 40,84 43,90
           C46,96 48,99 50,99
           C52,99 54,96 57,90
           C60,84 66,81 71,73
           C76,66 83,58 79,44
           C69,60 31,60 21,44 Z"
        fill="#6f4b33" stroke={INK} strokeWidth={2.6} strokeLinejoin="round"
      />
      {/* soft strands following the taper, not straight vertical staves */}
      <g stroke={INK} strokeWidth={1.5} fill="none" opacity={0.4} strokeLinecap="round">
        <path d="M35,60 q1,14 8,26" />
        <path d="M50,62 q0,16 0,30" />
        <path d="M65,60 q-1,14 -8,26" />
      </g>
      {/* head sits on top of the beard */}
      <g transform="translate(7,-10) scale(0.86)">
        <CatHead fur={FUR.grey} eyes="normal" whiskers={false} />
      </g>
      {/* a dignified moustache, sitting just under the nose */}
      <path
        d="M34,46 Q42,40 50,45 Q58,40 66,46 Q58,55 50,50 Q42,55 34,46 Z"
        fill="#6f4b33" stroke={INK} strokeWidth={2.2} strokeLinejoin="round"
      />
    </g>
  );
}

// ============================================================================
// Expansion card art
// ============================================================================

function ImplodingKittenArt() {
  return (
    <g>
      <circle cx={50} cy={50} r={42} fill="#1f1135" stroke={INK} strokeWidth={2.6} />
      <path d="M50,10 Q85,20 75,50 Q65,85 35,75 Q15,60 30,30" fill="none" stroke="#a66cff" strokeWidth={4} strokeLinecap="round" />
      <path d="M50,22 Q72,30 66,50 Q58,72 38,65" fill="none" stroke="#5ec2e0" strokeWidth={3} strokeLinecap="round" />
      <g transform="translate(8,8) scale(0.84)">
        <CatHead fur={FUR.grey} eyes="wide" open whiskers={false} />
      </g>
    </g>
  );
}

function ReverseArt() {
  return (
    <g>
      <g transform="translate(8,10) scale(0.82)">
        <CatHead fur={FUR.cream} eyes="shifty" whiskers={false} />
      </g>
      <g fill="none" stroke="#ffd24a" strokeWidth={4.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18,30 A34,34 0 0,1 82,30" />
        <path d="M18,30 L28,22 M18,30 L28,38" />
        <path d="M82,74 A34,34 0 0,1 18,74" />
        <path d="M82,74 L72,66 M82,74 L72,82" />
      </g>
    </g>
  );
}

function DrawFromTheBottomArt() {
  return (
    <g>
      <rect x={26} y={14} width={48} height={34} rx={5} fill="#2b2544" stroke={INK} strokeWidth={2.4} />
      <rect x={22} y={52} width={56} height={36} rx={5} fill="#ff9f43" stroke={INK} strokeWidth={2.6} />
      <g transform="translate(15,36) scale(0.7)">
        <CatHead fur={FUR.tan} eyes="happy" whiskers={false} />
      </g>
      <path d="M50,8 L50,44 M40,34 L50,44 L60,34" fill="none" stroke="#fff" strokeWidth={3.6} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function AlterTheFutureArt() {
  return (
    <g>
      <SeeTheFutureArt />
      <path d="M20,76 Q50,94 80,76" fill="none" stroke="#ffd24a" strokeWidth={4} strokeLinecap="round" />
      <path d="M72,70 L82,76 L72,84" fill="none" stroke="#ffd24a" strokeWidth={3.5} strokeLinecap="round" />
    </g>
  );
}

function TargetedAttackArt() {
  return (
    <g>
      <g transform="translate(5,4) scale(0.9)">
        <CatHead fur={FUR.ginger} eyes="angry" open whiskers={false} />
      </g>
      <circle cx={50} cy={54} r={34} fill="none" stroke="#ff4d4d" strokeWidth={3.5} />
      <circle cx={50} cy={54} r={18} fill="none" stroke="#ff4d4d" strokeWidth={2.5} />
      <path d="M50,12 L50,96 M8,54 L92,54" stroke="#ff4d4d" strokeWidth={2.5} strokeLinecap="round" />
    </g>
  );
}

function FeralCatArt() {
  return (
    <g>
      <path d="M12,26 L26,12 L42,24 L50,8 L58,24 L74,12 L88,26" fill="none" stroke="#ffd24a" strokeWidth={3.5} strokeLinejoin="round" />
      <CatHead fur={FUR.ginger} eyes="glow" open />
    </g>
  );
}

function StreakingKittenArt() {
  return (
    <g>
      <g stroke="#ffd24a" strokeWidth={3} strokeLinecap="round">
        <path d="M6,34 L28,34" />
        <path d="M4,52 L24,52" />
        <path d="M8,70 L28,70" />
      </g>
      <g transform="translate(8,4) scale(0.88)">
        <CatHead fur={FUR.tan} eyes="happy" open whiskers={false} />
      </g>
      <circle cx={80} cy={26} r={11} fill="#ff6b3d" stroke={INK} strokeWidth={2.2} />
    </g>
  );
}

function SuperSkipArt() {
  return (
    <g>
      <SkipArt />
      <path d="M44,12 L34,36 L50,36 L40,60 L66,30 L50,30 Z" fill="#ffd24a" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
    </g>
  );
}

function SeeTheFuture5xArt() {
  return (
    <g>
      <SeeTheFutureArt />
      <circle cx={80} cy={22} r={13} fill="#ffd24a" stroke={INK} strokeWidth={2.2} />
      <path d="M84,16 L76,16 L76,22 Q84,21 84,26 Q84,30 76,29" fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
    </g>
  );
}

function AlterTheFuture5xArt() {
  return (
    <g>
      <AlterTheFutureArt />
      <circle cx={80} cy={22} r={13} fill="#ff6b3d" stroke={INK} strokeWidth={2.2} />
      <path d="M84,16 L76,16 L76,22 Q84,21 84,26 Q84,30 76,29" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  );
}

function SwapTopAndBottomArt() {
  return (
    <g>
      <ShuffleArt />
      <path d="M50,14 L50,86 M38,26 L50,14 L62,26 M38,74 L50,86 L62,74" fill="none" stroke="#ffd24a" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function GarbageCollectionArt() {
  return (
    <g>
      <rect x={24} y={38} width={52} height={52} rx={6} fill="#7f8c8d" stroke={INK} strokeWidth={2.6} />
      <rect x={18} y={30} width={64} height={10} rx={3} fill="#95a5a6" stroke={INK} strokeWidth={2.6} />
      <g transform="translate(18,-6) scale(0.64)">
        <CatHead fur={FUR.grey} eyes="shifty" whiskers={false} />
      </g>
    </g>
  );
}

function CatomicBombArt() {
  return (
    <g>
      <ExplodingKittenArt />
      <circle cx={50} cy={50} r={16} fill="#ffd24a" stroke={INK} strokeWidth={2.4} opacity={0.9} />
      <circle cx={50} cy={50} r={5} fill={INK} />
    </g>
  );
}

function MarkArt() {
  return (
    <g>
      <CatHead fur={FUR.cream} eyes="wide" />
      <circle cx={50} cy={38} r={9} fill="#e33b4e" stroke={INK} strokeWidth={2} />
      <circle cx={50} cy={38} r={4} fill="#fff" />
    </g>
  );
}

function CurseOfTheCatButtArt() {
  return (
    <g>
      <CatHead fur={FUR.brown} eyes="dead" whiskers />
      <rect x={24} y={44} width={52} height={18} rx={6} fill="#221f33" stroke="#ffd24a" strokeWidth={2.2} />
    </g>
  );
}

function BarkingKittenArt() {
  return (
    <g>
      <CatHead fur={FUR.ginger} eyes="angry" open />
      <path d="M78,34 L94,26 M80,48 L96,48 M78,62 L94,70" stroke="#ffd24a" strokeWidth={3.5} strokeLinecap="round" />
    </g>
  );
}

function AlterTheFutureNowArt() {
  return (
    <g>
      <AlterTheFutureArt />
      <path d="M18,12 L10,32 L24,32 L16,52 L36,26 L22,26 Z" fill="#ffd24a" stroke={INK} strokeWidth={2} />
    </g>
  );
}

function BuryArt() {
  return (
    <g>
      <ellipse cx={50} cy={82} rx={36} ry={12} fill="#8b5a2b" stroke={INK} strokeWidth={2.6} />
      <g transform="translate(10,4) scale(0.8)">
        <CatHead fur={FUR.tan} eyes="shifty" whiskers={false} />
      </g>
    </g>
  );
}

function PersonalAttackArt() {
  return (
    <g>
      <AttackArt />
      <path d="M18,76 Q50,96 82,76" fill="none" stroke="#ffd24a" strokeWidth={4} strokeLinecap="round" />
    </g>
  );
}

function ShareTheFutureArt() {
  return (
    <g>
      <SeeTheFutureArt />
      <circle cx={22} cy={76} r={10} fill={FUR.tan} stroke={INK} strokeWidth={2.2} />
      <circle cx={78} cy={76} r={10} fill={FUR.cream} stroke={INK} strokeWidth={2.2} />
    </g>
  );
}

function IllTakeThatArt() {
  return (
    <g>
      <FavorArt />
      <path d="M22,26 L56,26 M44,16 L56,26 L44,36" fill="none" stroke="#ffd24a" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function PotluckArt() {
  return (
    <g>
      <path d="M16,54 a34,30 0 0 0 68,0 Z" fill="#3a3752" stroke={INK} strokeWidth={2.6} />
      <g transform="translate(15,-2) scale(0.7)">
        <CatHead fur={FUR.cream} eyes="happy" whiskers={false} />
      </g>
    </g>
  );
}

function TowerOfPowerArt() {
  return (
    <g>
      <g transform="translate(8,14) scale(0.84)">
        <CatHead fur={FUR.tan} eyes="happy" whiskers />
      </g>
      <path d="M24,34 L28,10 L42,24 L50,8 L58,24 L72,10 L76,34 Z" fill="#ffd24a" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
    </g>
  );
}

function ZombieKittenArt() {
  return (
    <g>
      <CatHead fur="#7bc67b" eyes="glow" open />
      <path d="M36,36 L48,42 M40,33 L44,44" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
    </g>
  );
}

function DigDeeperArt() {
  return (
    <g>
      <BuryArt />
      <path d="M76,16 L76,68 M66,56 L76,68 L86,56" fill="none" stroke="#5ec2e0" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

function CloneArt() {
  return (
    <g>
      <g transform="translate(-8,6) scale(0.74)">
        <CatHead fur={FUR.grey} eyes="normal" whiskers={false} />
      </g>
      <g transform="translate(20,14) scale(0.74)">
        <CatHead fur={FUR.grey} eyes="glow" whiskers={false} />
      </g>
    </g>
  );
}

function ClairvoyanceArt() {
  return (
    <g>
      <CatHead fur={FUR.cream} eyes="glow" />
      <ellipse cx={50} cy={38} rx={9} ry={5} fill="#a8e6ff" stroke={INK} strokeWidth={2} />
      <circle cx={50} cy={38} r={2.5} fill={INK} />
    </g>
  );
}

/** A small lightning bolt in the corner: the NOW mark (same as Alter the Future NOW). */
function NowBolt() {
  return <path d="M18,12 L10,32 L24,32 L16,52 L36,26 L22,26 Z" fill="#ffd24a" stroke={INK} strokeWidth={2} />;
}

function FeedTheDeadArt() {
  return (
    <g>
      {/* A zombie kitten tucking into a bowl: the head sits behind the bowl's rim. */}
      <g transform="translate(19,8) scale(0.66)">
        <CatHead fur="#7bc67b" eyes="glow" open whiskers={false} />
      </g>
      <path d="M14,60 a36,28 0 0 0 72,0 Z" fill="#3a3752" stroke={INK} strokeWidth={2.6} />
      <path d="M30,74 Q50,82 70,74" fill="none" stroke="#5a5675" strokeWidth={3} strokeLinecap="round" />
      <NowBolt />
    </g>
  );
}

function GraveRobberArt() {
  return (
    <g>
      <path d="M30,88 L30,40 Q30,20 50,20 Q70,20 70,40 L70,88 Z" fill="#8c8a9e" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M42,46 L58,46 M50,38 L50,62" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <ellipse cx={50} cy={88} rx={38} ry={8} fill="#8b5a2b" stroke={INK} strokeWidth={2.4} />
      <g transform="translate(52,44) scale(0.42)">
        <CatHead fur={FUR.grey} eyes="shifty" whiskers={false} />
      </g>
    </g>
  );
}

function AttackOfTheDeadArt() {
  return (
    <g>
      <AttackArt />
      <g transform="translate(54,50) scale(0.44)">
        <CatHead fur="#7bc67b" eyes="glow" open whiskers={false} />
      </g>
    </g>
  );
}

function ShuffleNowArt() {
  return (
    <g>
      <ShuffleArt />
      <NowBolt />
    </g>
  );
}

// ============================================================================
// Registry
// ============================================================================

const ART: Record<EkBaseCardKind, () => ReactElement> = {
  explodingKitten: ExplodingKittenArt,
  defuse: DefuseArt,
  nope: NopeArt,
  attack: AttackArt,
  skip: SkipArt,
  favor: FavorArt,
  shuffle: ShuffleArt,
  seeTheFuture: SeeTheFutureArt,
  tacoCat: TacoCatArt,
  rainbowRalphingCat: RainbowRalphingCatArt,
  cattermelon: CattermelonArt,
  hairyPotatoCat: HairyPotatoCatArt,
  beardCat: BeardCatArt,
  // Imploding Kittens
  implodingKitten: ImplodingKittenArt,
  reverse: ReverseArt,
  drawFromTheBottom: DrawFromTheBottomArt,
  alterTheFuture: AlterTheFutureArt,
  targetedAttack: TargetedAttackArt,
  feralCat: FeralCatArt,
  // Streaking Kittens
  streakingKitten: StreakingKittenArt,
  superSkip: SuperSkipArt,
  seeTheFuture5x: SeeTheFuture5xArt,
  alterTheFuture5x: AlterTheFuture5xArt,
  swapTopAndBottom: SwapTopAndBottomArt,
  garbageCollection: GarbageCollectionArt,
  catomicBomb: CatomicBombArt,
  mark: MarkArt,
  curseOfTheCatButt: CurseOfTheCatButtArt,
  // Barking Kittens
  barkingKitten: BarkingKittenArt,
  alterTheFutureNow: AlterTheFutureNowArt,
  bury: BuryArt,
  personalAttack: PersonalAttackArt,
  shareTheFuture: ShareTheFutureArt,
  illTakeThat: IllTakeThatArt,
  potluck: PotluckArt,
  towerOfPower: TowerOfPowerArt,
  // Zombie Kittens
  zombieKitten: ZombieKittenArt,
  digDeeper: DigDeeperArt,
  clone: CloneArt,
  clairvoyance: ClairvoyanceArt,
  feedTheDead: FeedTheDeadArt,
  graveRobber: GraveRobberArt,
  attackOfTheDead: AttackOfTheDeadArt,
  shuffleNow: ShuffleNowArt,
};

/** Accent colour behind the art, per card. Keeps kinds distinguishable at a glance. */
export const CARD_ACCENT: Record<EkBaseCardKind, string> = {
  explodingKitten: '#7a1f2b',
  defuse: '#1f6f52',
  nope: '#8c1f2f',
  attack: '#a8391f',
  skip: '#1f5c7a',
  favor: '#7a3f6b',
  shuffle: '#33527a',
  seeTheFuture: '#4a3070',
  tacoCat: '#8a6a1f',
  rainbowRalphingCat: '#2f6b57',
  cattermelon: '#8a2740',
  hairyPotatoCat: '#6b4a24',
  beardCat: '#4a4459',
  // Imploding Kittens
  implodingKitten: '#3a1b5e',
  reverse: '#246670',
  drawFromTheBottom: '#8c4b1f',
  alterTheFuture: '#5c2d82',
  targetedAttack: '#9e2424',
  feralCat: '#7d5218',
  // Streaking Kittens
  streakingKitten: '#b3471b',
  superSkip: '#1b6d8c',
  seeTheFuture5x: '#543285',
  alterTheFuture5x: '#682b87',
  swapTopAndBottom: '#2d577a',
  garbageCollection: '#4c5c5c',
  catomicBomb: '#8f2418',
  mark: '#8a243b',
  curseOfTheCatButt: '#4f3829',
  // Barking Kittens
  barkingKitten: '#963b1e',
  alterTheFutureNow: '#6b2878',
  bury: '#6e4726',
  personalAttack: '#8f341b',
  shareTheFuture: '#5a387d',
  illTakeThat: '#7a385c',
  potluck: '#4c4669',
  towerOfPower: '#8a6d1b',
  // Zombie Kittens
  zombieKitten: '#286e3b',
  digDeeper: '#5e4526',
  clone: '#3b526b',
  clairvoyance: '#38477a',
  feedTheDead: '#3f6b3a',
  graveRobber: '#4d4a5e',
  attackOfTheDead: '#7a2f2a',
  shuffleNow: '#2f4f80',
};

export function CardArt({ kind }: { kind: EkBaseCardKind }) {
  const Art = ART[kind];
  return (
    <svg viewBox="0 0 100 100" className="ek-art" role="img" aria-label={CARD_LABEL[kind]}>
      <Art />
    </svg>
  );
}

/** Which corner badge a card wears. */
export type EkCategory = 'kitten' | 'defuse' | 'cat' | 'reaction' | 'action';

/** Small corner glyphs, drawn on a 0 0 24 24 canvas. */
export function CategoryIcon({ category }: { category: EkCategory }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {category === 'kitten' && (
        <g stroke={INK} strokeWidth={1.8} strokeLinejoin="round">
          <circle cx={11} cy={14} r={7} fill={INK} />
          <path d="M6.5 9.5 L7.5 5.5 L10 8.6 Z M15.5 9.5 L14.5 5.5 L12 8.6 Z" fill={INK} />
          <path d="M16 8 Q19 5 20 3" fill="none" stroke="#c9a46a" strokeWidth={1.6} />
          <circle cx={20.4} cy={2.8} r={1.8} fill="#ffd23f" stroke="none" />
          <circle cx={8.6} cy={13.4} r={1.1} fill="#ffd23f" stroke="none" />
          <circle cx={13.4} cy={13.4} r={1.1} fill="#ffd23f" stroke="none" />
        </g>
      )}
      {category === 'defuse' && (
        <g stroke={INK} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M5 19 L13 11" strokeWidth={3.2} />
          <path d="M5 19 L13 11" stroke="#9fe3c4" strokeWidth={1.4} />
          <path d="M12.5 6.5 a4 4 0 1 0 5 5 l2.5 -1 -1.5 -1.5 1 -2.5 -2.5 1 -1.5 -1.5 Z" fill="#9fe3c4" />
        </g>
      )}
      {category === 'cat' && (
        <g fill="#f6c48a" stroke={INK} strokeWidth={1.6} strokeLinejoin="round">
          <path d="M12 21 q-6 0 -6 -4 q0 -3.5 6 -3.5 q6 0 6 3.5 q0 4 -6 4 Z" />
          <ellipse cx={5.5} cy={10.5} rx={2.4} ry={3} />
          <ellipse cx={9.6} cy={6.8} rx={2.4} ry={3.2} />
          <ellipse cx={14.4} cy={6.8} rx={2.4} ry={3.2} />
          <ellipse cx={18.5} cy={10.5} rx={2.4} ry={3} />
        </g>
      )}
      {category === 'reaction' && (
        <g stroke={INK} strokeWidth={1.8} strokeLinejoin="round">
          <circle cx={12} cy={12} r={9} fill="#ff5a6a" />
          <path d="M5.8 18.2 L18.2 5.8" stroke="#fff" strokeWidth={2.6} />
          <circle cx={12} cy={12} r={9} fill="none" />
        </g>
      )}
      {category === 'action' && (
        <path d="M13.5 2 L5 13.5 h6 L9.5 22 L19 9.5 h-6.2 Z" fill="#ffd23f" stroke={INK} strokeWidth={1.7} strokeLinejoin="round" />
      )}
    </svg>
  );
}

/**
 * The back of a card — face-down hands and the deck. Fills the whole card
 * (viewBox 0 0 100 140): charred violet stock, a hazard band, and a lit
 * cat-bomb seal.
 */
export function CardBack() {
  const id = useSvgIds();
  const stripes = Array.from({ length: 12 }, (_, i) => i * 18 - 40);
  return (
    <svg viewBox="0 0 100 140" className="ek-back" role="img" aria-label="Face-down card" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={id('glow')} cx="50%" cy="46%" r="62%">
          <stop offset="0" stopColor="#4a2a62" />
          <stop offset="1" stopColor="#1a1024" />
        </radialGradient>
        <pattern id={id('dots')} width={5} height={5} patternUnits="userSpaceOnUse">
          <circle cx={2.5} cy={2.5} r={0.8} fill="#ffffff" opacity={0.08} />
        </pattern>
        <clipPath id={id('band')}>
          <rect x={0} y={56} width={100} height={28} />
        </clipPath>
      </defs>
      <rect width={100} height={140} fill={id.url('glow')} />
      <rect width={100} height={140} fill={id.url('dots')} />
      {/* hazard band */}
      <g clipPath={id.url('band')}>
        <rect x={0} y={56} width={100} height={28} fill="#ffd23f" />
        {stripes.map((x) => (
          <path key={x} d={`M${x} 84 L${x + 9} 84 L${x + 37} 56 L${x + 28} 56 Z`} fill={INK} />
        ))}
      </g>
      <path d="M0 56 H100 M0 84 H100" stroke={INK} strokeWidth={2.4} />
      {/* the seal: a cat-shaped bomb with a lit fuse */}
      <circle cx={50} cy={70} r={25} fill="#ff5a6a" stroke={INK} strokeWidth={3} />
      <circle cx={50} cy={70} r={19} fill={INK} />
      <path d="M36.5 58 L38.5 47.5 L45.5 55.5 Z M63.5 58 L61.5 47.5 L54.5 55.5 Z" fill={INK} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <ellipse cx={43.5} cy={68.5} rx={3.4} ry={4.2} fill="#ffd23f" />
      <ellipse cx={56.5} cy={68.5} rx={3.4} ry={4.2} fill="#ffd23f" />
      <circle cx={44.4} cy={67.4} r={1.1} fill="#fff" />
      <circle cx={57.4} cy={67.4} r={1.1} fill="#fff" />
      <path d="M46 77 Q50 80 54 77" stroke="#ffd23f" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M62 50 Q70 40 66 31 Q63 25 69 20" stroke="#d9b07a" strokeWidth={2.6} fill="none" strokeLinecap="round" />
      <g className="ek-back-spark">
        <circle cx={69} cy={19} r={5} fill="#ffd23f" stroke={INK} strokeWidth={1.6} />
        <path d="M69 9 V13 M69 25 V29 M59 19 H63 M75 19 H79 M62 12 L64.5 14.5 M73.5 23.5 L76 26 M76 12 L73.5 14.5 M64.5 23.5 L62 26" stroke="#ffd23f" strokeWidth={1.8} strokeLinecap="round" />
      </g>
      {/* corner paws */}
      {[[12, 14], [88, 126]].map(([x, y]) => (
        <g key={x} fill="#ffd23f" opacity={0.85} transform={`translate(${x} ${y}) scale(0.55)`}>
          <path d="M0 6 q-7 0 -7 4 q0 4 7 4 q7 0 7 -4 q0 -4 -7 -4 Z" />
          <ellipse cx={-7} cy={-1} rx={2.6} ry={3.2} />
          <ellipse cx={-2.4} cy={-5} rx={2.6} ry={3.4} />
          <ellipse cx={2.4} cy={-5} rx={2.6} ry={3.4} />
          <ellipse cx={7} cy={-1} rx={2.6} ry={3.2} />
        </g>
      ))}
      <rect x={4} y={4} width={92} height={132} rx={8} fill="none" stroke="#ffd23f" strokeOpacity={0.35} strokeWidth={1.2} strokeDasharray="3 3" />
    </svg>
  );
}

/** Picker tile art: a lit cat-bomb in front of a KABOOM, cards flying. Registered on the module. */
export function Thumbnail() {
  const MiniCard = ({ x, y, rot, accent, children }: {
    x: number; y: number; rot: number; accent: string; children: React.ReactNode;
  }) => (
    <g transform={`rotate(${rot} ${x + 18} ${y + 25})`}>
      <rect x={x} y={y} width={36} height={50} rx={5} fill="#fdf6e3" stroke={INK} strokeWidth={2.4} />
      <svg x={x + 3.5} y={y + 3.5} width={29} height={31} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <rect x={0} y={0} width={100} height={100} fill={accent} />
        {children}
      </svg>
      <rect x={x + 3.5} y={y + 3.5} width={29} height={31} fill="none" stroke={INK} strokeWidth={1.6} />
      <rect x={x + 6} y={y + 39} width={24} height={4} rx={2} fill={INK} opacity={0.75} />
    </g>
  );
  const id = useSvgIds();
  const burst: string[] = [];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const r = i % 2 ? 23 : 44 - (i % 4 === 0 ? 6 : 0);
    burst.push(`${(80 + Math.cos(a) * r * 1.25).toFixed(1)},${(52 + Math.sin(a) * r).toFixed(1)}`);
  }
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label="Exploding Kittens" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={id('bg')} cx="50%" cy="50%" r="70%">
          <stop offset="0" stopColor="#d23a3a" />
          <stop offset="1" stopColor="#3a0d18" />
        </radialGradient>
        <pattern id={id('dots')} width={4} height={4} patternUnits="userSpaceOnUse">
          <circle cx={2} cy={2} r={0.9} fill="#120c1f" opacity={0.28} />
        </pattern>
      </defs>
      <rect width={160} height={100} fill={id.url('bg')} />
      <rect width={160} height={100} fill={id.url('dots')} />
      <polygon points={burst.join(' ')} fill="#ffd23f" stroke={INK} strokeWidth={2.6} strokeLinejoin="round" />
      <MiniCard x={6} y={30} rot={-24} accent={CARD_ACCENT.defuse}><DefuseArt /></MiniCard>
      <MiniCard x={118} y={30} rot={22} accent={CARD_ACCENT.nope}><NopeArt /></MiniCard>
      <MiniCard x={22} y={6} rot={-38} accent={CARD_ACCENT.tacoCat}><TacoCatArt /></MiniCard>
      <MiniCard x={104} y={4} rot={34} accent={CARD_ACCENT.seeTheFuture}><SeeTheFutureArt /></MiniCard>
      {/* the cat-bomb */}
      <g stroke={INK} strokeWidth={2.8} strokeLinejoin="round">
        <circle cx={80} cy={58} r={22} fill={INK} />
        <path d="M63 46 L65 31 L75 41 Z M97 46 L95 31 L85 41 Z" fill={INK} />
        <path d="M66 44 L67 36 L72 41 Z M94 44 L93 36 L88 41 Z" fill={PINK} strokeWidth={1.4} />
      </g>
      <circle cx={72} cy={50} r={6} fill="#ffffff" opacity={0.14} />
      <ellipse cx={72.5} cy={57} rx={4.4} ry={5.4} fill="#ffd23f" />
      <ellipse cx={87.5} cy={57} rx={4.4} ry={5.4} fill="#ffd23f" />
      <circle cx={73.4} cy={55.6} r={1.5} fill="#fff" />
      <circle cx={88.4} cy={55.6} r={1.5} fill="#fff" />
      <path d="M75 67 Q80 71 85 67" stroke="#ffd23f" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M64 63 H54 M64 67 L55 70 M96 63 H106 M96 67 L105 70" stroke="#ffd23f" strokeWidth={1.4} strokeLinecap="round" opacity={0.8} />
      <path d="M93 39 Q102 28 99 20 Q97 14 103 10" stroke="#d9b07a" strokeWidth={3} fill="none" strokeLinecap="round" />
      <circle cx={103.5} cy={9.5} r={5} fill="#fff4b0" stroke={INK} strokeWidth={1.8} />
      <path d="M103.5 0.5 V3.5 M103.5 15.5 V18.5 M94.5 9.5 H97.5 M109.5 9.5 H112.5 M97 3 L99 5 M108 14 L110 16 M110 3 L108 5 M99 14 L97 16" stroke="#fff4b0" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}
