// Here to Slay — card art. Original, inline SVG, no raster assets.
//
// Heroes are heraldic: a shield whose chief carries the class sigil, over a
// field division, tinctures and a charge all picked deterministically from the
// card's kind, so every hero has its own coat of arms. Party Leaders hang as
// crowned swallowtail banners. Monsters are dark silhouettes from eleven body
// forms with glowing eyes. Items, magic, modifiers, challenges and gifts each
// get their own icon family. Every art canvas is 0 0 100 100.

import { hashString } from '@/core/rng';
import type { ReactNode } from 'react';
import { useSvgIds } from '@/ui/kit/hooks';
import { CLASS_META, INK, SigilShape } from './sigils';
import type { HtsBaseClass, HtsCard } from './types';

// ============================================================================
// Determinism
// ============================================================================

const pick = <T,>(arr: readonly T[], kind: string, salt: string): T => arr[hashString(`${kind}:${salt}`) % arr.length]!;

// ============================================================================
// Heraldry
// ============================================================================

const COLORS = ['#b3262b', '#2b56a8', '#2f7a3d', '#6b3f93', '#2a2230', '#8a3a1e'] as const; // gules azure vert purpure sable murrey
const METALS = ['#e8b84a', '#ece6d6'] as const; // or, argent
const DIVISIONS = ['plain', 'perPale', 'perFess', 'perBend', 'chevron', 'quarterly', 'bordure', 'paly'] as const;
type Division = (typeof DIVISIONS)[number];
const CHARGES = ['tower', 'crescent', 'mullet', 'sun', 'key', 'crown', 'rose', 'eagle', 'stag', 'wolf', 'fish', 'chalice'] as const;
type ChargeName = (typeof CHARGES)[number];

const SHIELD = 'M20 12 H80 V46 C80 70 66 84 50 92 C34 84 20 70 20 46 Z';

function star(cx: number, cy: number, r: number, inner: number, n = 5, rot = -Math.PI / 2): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? inner : r;
    const a = rot + (i * Math.PI) / n;
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(1)},${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return pts.join(' ');
}

/** A heraldic charge centred on (0,0), about 40 units across. */
function Charge({ name, fill }: { name: ChargeName; fill: string }) {
  const s = { stroke: INK, strokeWidth: 2, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (name) {
    case 'tower':
      return (
        <g {...s} fill={fill}>
          <path d="M-11 18 V-6 H-14 V-15 H-9 V-11 H-4 V-15 H4 V-11 H9 V-15 H14 V-6 H11 V18 Z" />
          <path d="M-4 18 V8 Q0 2 4 8 V18 Z" fill={INK} />
          <rect x={-2} y={-4} width={4} height={6} rx={1} fill={INK} />
        </g>
      );
    case 'crescent':
      return <path {...s} fill={fill} transform="rotate(-90)" d="M7 -17 A18 18 0 1 0 7 17 A13.5 13.5 0 1 1 7 -17 Z" />;
    case 'mullet':
      return <polygon {...s} fill={fill} points={star(0, 1, 19, 8)} />;
    case 'sun':
      return (
        <g {...s} fill={fill}>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            const b = a + 0.18;
            const c = a - 0.18;
            return <polygon key={i} points={`${Math.cos(b) * 11},${Math.sin(b) * 11} ${Math.cos(a) * 20},${Math.sin(a) * 20} ${Math.cos(c) * 11},${Math.sin(c) * 11}`} />;
          })}
          <circle r={11} />
          <circle cx={-4} cy={-2} r={1.6} fill={INK} stroke="none" />
          <circle cx={4} cy={-2} r={1.6} fill={INK} stroke="none" />
          <path d="M-4 4 Q0 7 4 4" fill="none" />
        </g>
      );
    case 'key':
      return (
        <g {...s} fill={fill}>
          <path d="M0 -20 A8 8 0 1 0 0.01 -20 Z M0 -16 A4 4 0 1 1 -0.01 -16 Z" fillRule="evenodd" />
          <rect x={-2.5} y={-4} width={5} height={22} />
          <path d="M2.5 10 H8 V14 H2.5 Z M2.5 4 H6 V7.5 H2.5 Z" />
        </g>
      );
    case 'crown':
      return (
        <g {...s} fill={fill}>
          <path d="M-17 6 L-17 -10 L-8 -1 L0 -15 L8 -1 L17 -10 L17 6 Z" />
          <rect x={-17} y={6} width={34} height={8} rx={1} />
          <circle cx={0} cy={10} r={2} fill="#c2263c" />
          <circle cx={-10} cy={10} r={1.6} fill="#2b56a8" />
          <circle cx={10} cy={10} r={1.6} fill="#2b56a8" />
        </g>
      );
    case 'rose':
      return (
        <g {...s} fill={fill}>
          {Array.from({ length: 5 }, (_, i) => {
            const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
            return <circle key={i} cx={Math.cos(a) * 9} cy={Math.sin(a) * 9} r={8.5} />;
          })}
          <circle r={6} fill="#e8b84a" />
          <circle r={2.2} fill={INK} stroke="none" />
        </g>
      );
    case 'eagle':
      return (
        <g {...s} fill={fill}>
          <path d="M-4 -2 L-21 -13 L-18 -5 L-22 -1 L-17 2 L-20 8 L-5 6 Z" />
          <path d="M4 -2 L21 -13 L18 -5 L22 -1 L17 2 L20 8 L5 6 Z" />
          <path d="M-5 14 L0 20 L5 14 Z" />
          <ellipse cx={0} cy={2} rx={5.5} ry={11} />
          <circle cx={0} cy={-12} r={4.5} />
          <path d="M3.5 -12 L8 -10.5 L3.5 -9.5 Z" fill="#e8b84a" />
          <circle cx={1} cy={-13} r={1} fill={INK} stroke="none" />
        </g>
      );
    case 'stag':
      return (
        <g {...s}>
          <g fill="none" stroke={INK} strokeWidth={5}>
            <path d="M-4 -4 Q-9 -14 -15 -19 M-8 -11 L-15 -10 M-11 -15 L-9 -21" />
            <path d="M4 -4 Q9 -14 15 -19 M8 -11 L15 -10 M11 -15 L9 -21" />
          </g>
          <g fill="none" stroke={fill} strokeWidth={2.4}>
            <path d="M-4 -4 Q-9 -14 -15 -19 M-8 -11 L-15 -10 M-11 -15 L-9 -21" />
            <path d="M4 -4 Q9 -14 15 -19 M8 -11 L15 -10 M11 -15 L9 -21" />
          </g>
          <path d="M-7 -3 Q0 -7 7 -3 L4 14 Q0 19 -4 14 Z" fill={fill} />
          <path d="M-7 -2 L-13 -6 L-9 1 Z M7 -2 L13 -6 L9 1 Z" fill={fill} />
          <circle cx={-3} cy={3} r={1.3} fill={INK} stroke="none" />
          <circle cx={3} cy={3} r={1.3} fill={INK} stroke="none" />
          <ellipse cx={0} cy={14} rx={2.4} ry={1.6} fill={INK} stroke="none" />
        </g>
      );
    case 'wolf':
      return (
        <g {...s} fill={fill}>
          <path d="M-13 8 L-17 -2 L-9 -7 L-7 -18 L-2 -9 L5 -8 L18 0 L9 4 L5 11 L-4 14 Z" />
          <path d="M9 4 L13 7 L6 7" fill="none" />
          <circle cx={1} cy={-3} r={1.6} fill={INK} stroke="none" />
          <path d="M-11 6 Q-6 9 -2 7" fill="none" />
        </g>
      );
    case 'fish':
      return (
        <g {...s} fill={fill} transform="rotate(-20)">
          <path d="M-18 0 Q-3 -13 10 0 Q-3 13 -18 0 Z" />
          <path d="M10 0 L19 -9 L17 0 L19 9 Z" />
          <path d="M-6 -6 Q-3 0 -6 6" fill="none" />
          <circle cx={-12} cy={-2} r={1.6} fill={INK} stroke="none" />
        </g>
      );
    case 'chalice':
      return (
        <g {...s} fill={fill}>
          <path d="M-13 -16 H13 Q13 1 0 3 Q-13 1 -13 -16 Z" />
          <rect x={-2.5} y={3} width={5} height={10} />
          <ellipse cx={0} cy={15} rx={10} ry={3.5} />
          <path d="M-9 -12 Q-8 -4 -3 -2" fill="none" stroke="#ffffff" strokeOpacity={0.6} strokeWidth={1.4} />
        </g>
      );
  }
}

function Field({ division, color, metal, clip }: { division: Division; color: string; metal: string; clip: string }) {
  return (
    <g clipPath={clip}>
      <rect x={0} y={0} width={100} height={100} fill={color} />
      {division === 'perPale' && <rect x={50} y={0} width={50} height={100} fill={metal} />}
      {division === 'perFess' && <rect x={0} y={61} width={100} height={40} fill={metal} />}
      {division === 'perBend' && <polygon points="20,30 80,96 80,30" fill={metal} />}
      {division === 'chevron' && <polygon points="16,80 50,50 84,80 84,94 50,64 16,94" fill={metal} />}
      {division === 'quarterly' && (
        <>
          <rect x={50} y={30} width={40} height={31} fill={metal} />
          <rect x={10} y={61} width={40} height={40} fill={metal} />
        </>
      )}
      {division === 'paly' && [26, 42, 58, 74].map((x) => <rect key={x} x={x} y={0} width={8} height={100} fill={metal} />)}
      {division === 'bordure' && <path d={SHIELD} fill="none" stroke={metal} strokeWidth={14} />}
    </g>
  );
}

/** Two laurel branches curving up either side of a shield. */
function Laurels() {
  const leaves = Array.from({ length: 7 }, (_, i) => i);
  const branch = (side: 1 | -1) => (
    <g>
      <path d={`M50 96 Q${50 - side * 34} 86 ${50 - side * 36} 30`} fill="none" stroke="#7a5a1e" strokeWidth={2} />
      {leaves.map((i) => {
        const t = (i + 1) / 8;
        // along the branch's curve (quadratic), leaves alternate a little in angle
        const x = (1 - t) * (1 - t) * 50 + 2 * (1 - t) * t * (50 - side * 34) + t * t * (50 - side * 36);
        const y = (1 - t) * (1 - t) * 96 + 2 * (1 - t) * t * 86 + t * t * 30;
        const rot = side * (-60 + i * 10);
        return <ellipse key={i} cx={x} cy={y} rx={6.4} ry={2.8} transform={`rotate(${rot} ${x} ${y})`} fill="#e8b84a" stroke={INK} strokeWidth={1.2} />;
      })}
    </g>
  );
  return <g>{branch(1)}{branch(-1)}</g>;
}

/** A hero's coat of arms: class chief, kind-hashed field and charge. */
export function HeroCrest({ kind, cls }: { kind: string; cls: HtsBaseClass | null }) {
  const id = useSvgIds();
  const meta = cls ? CLASS_META[cls] : { color: '#7a6a55', deep: '#3e3428', label: '' };
  const division = pick(DIVISIONS, kind, 'div');
  const color = pick(COLORS, kind, 'col');
  const metal = pick(METALS, kind, 'met');
  const charge = pick(CHARGES, kind, 'chg');
  const twoTone = division !== 'plain' && division !== 'bordure';
  const chargeFill = twoTone ? (metal === METALS[0] ? METALS[1] : METALS[0]) : metal;
  return (
    <g>
      <defs>
        <clipPath id={id('shield')}><path d={SHIELD} /></clipPath>
        <linearGradient id={id('sheen')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.32} />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.25} />
        </linearGradient>
      </defs>
      {/* golden laurels framing the shield */}
      <Laurels />
      <Field division={division} color={color} metal={metal} clip={id.url('shield')} />
      <g clipPath={id.url('shield')}>
        <rect x={0} y={0} width={100} height={30} fill={meta.color} />
        <path d="M0 30 H100" stroke={INK} strokeWidth={2} />
        <g transform="translate(41 12) scale(0.75)">
          <SigilShape cls={cls ?? 'guardian'} fill="#f6e2b0" />
        </g>
      </g>
      <g transform="translate(50 61) scale(0.88)">
        <Charge name={charge} fill={chargeFill} />
      </g>
      <path d={SHIELD} fill={id.url('sheen')} />
      <path d={SHIELD} fill="none" stroke={INK} strokeWidth={3.2} strokeLinejoin="round" />
    </g>
  );
}

/** A Party Leader: a crowned swallowtail banner of the class. */
export function LeaderBanner({ cls }: { cls: HtsBaseClass | null }) {
  const id = useSvgIds();
  const meta = cls ? CLASS_META[cls] : CLASS_META.guardian;
  return (
    <g strokeLinejoin="round">
      <defs>
        <linearGradient id={id('cloth')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={meta.deep} />
          <stop offset="0.35" stopColor={meta.color} />
          <stop offset="0.7" stopColor={meta.color} />
          <stop offset="1" stopColor={meta.deep} />
        </linearGradient>
      </defs>
      <path d="M50 2 L56 9 L50 16 L44 9 Z" fill="#e8b84a" stroke={INK} strokeWidth={1.6} />
      <path d="M38 14 L38 4 L44 9 L50 1 L56 9 L62 4 L62 14 Z" fill="#e8b84a" stroke={INK} strokeWidth={1.8} />
      <circle cx={50} cy={10} r={1.6} fill="#c2263c" />
      <rect x={14} y={15} width={72} height={5} rx={2.5} fill="#7a4a24" stroke={INK} strokeWidth={1.6} />
      <circle cx={13} cy={17.5} r={3.4} fill="#e8b84a" stroke={INK} strokeWidth={1.4} />
      <circle cx={87} cy={17.5} r={3.4} fill="#e8b84a" stroke={INK} strokeWidth={1.4} />
      <path d="M24 20 H76 V90 L50 76 L24 90 Z" fill={id.url('cloth')} stroke={INK} strokeWidth={2.6} />
      <path d="M29 24 H71 V82 L50 70.5 L29 82 Z" fill="none" stroke="#e8b84a" strokeWidth={1.6} strokeDasharray="0" />
      <circle cx={50} cy={47} r={16} fill="#e8b84a" stroke={INK} strokeWidth={2.2} />
      <circle cx={50} cy={47} r={12.5} fill={meta.deep} stroke={INK} strokeWidth={1} />
      <g transform="translate(38 35)">
        <SigilShape cls={cls ?? 'guardian'} fill="#f6e2b0" />
      </g>
      {[30, 70].map((x) => (
        <g key={x} stroke={INK} strokeWidth={1.2}>
          <path d={`M${x} 20 V30`} />
          <circle cx={x} cy={32} r={2.4} fill="#e8b84a" />
        </g>
      ))}
    </g>
  );
}

// ============================================================================
// Monsters
// ============================================================================

type MonsterForm =
  | { body: 'dragon'; crown?: boolean }
  | { body: 'serpent'; crown?: boolean; twin?: boolean; hood?: boolean }
  | { body: 'slime' }
  | { body: 'beast'; feature: 'fangs' | 'horns' | 'tusks' | 'owl' | 'twin' }
  | { body: 'toad' }
  | { body: 'bat' }
  | { body: 'shell' }
  | { body: 'plant' }
  | { body: 'wraith' }
  | { body: 'giant'; feature: 'horns' | 'fur' }
  | { body: 'tyrant' };

const GLOW = { ember: '#ff7a2e', toxic: '#a6ff3d', frost: '#86ecff', blood: '#ff3355', arcane: '#c77dff', gold: '#ffd23f' } as const;

const MONSTERS: Record<string, { form: MonsterForm; glow: string }> = {
  'monster-abyss-queen': { form: { body: 'serpent', hood: true }, glow: GLOW.arcane },
  'monster-anuran-cauldron': { form: { body: 'toad' }, glow: GLOW.toxic },
  'monster-arctic-aries': { form: { body: 'beast', feature: 'horns' }, glow: GLOW.frost },
  'monster-bloodwing': { form: { body: 'bat' }, glow: GLOW.blood },
  'monster-corrupted-sabretooth': { form: { body: 'beast', feature: 'fangs' }, glow: GLOW.arcane },
  'monster-crowned-serpent': { form: { body: 'serpent', crown: true }, glow: GLOW.gold },
  'monster-dark-dragon-king': { form: { body: 'dragon', crown: true }, glow: GLOW.arcane },
  'monster-dracos': { form: { body: 'dragon' }, glow: GLOW.ember },
  'monster-malamammoth': { form: { body: 'beast', feature: 'tusks' }, glow: GLOW.frost },
  'monster-mega-slime': { form: { body: 'slime' }, glow: GLOW.toxic },
  'monster-orthus': { form: { body: 'beast', feature: 'twin' }, glow: GLOW.ember },
  'monster-rex-major': { form: { body: 'tyrant' }, glow: GLOW.ember },
  'monster-terratuga': { form: { body: 'shell' }, glow: GLOW.gold },
  'monster-titan-wyvern': { form: { body: 'dragon' }, glow: GLOW.frost },
  'monster-warworn-owlbear': { form: { body: 'beast', feature: 'owl' }, glow: GLOW.gold },
  'monster-feral-dragon': { form: { body: 'dragon' }, glow: GLOW.toxic },
  'monster-muscipula-rex': { form: { body: 'plant' }, glow: GLOW.toxic },
  'monster-doombringer': { form: { body: 'wraith' }, glow: GLOW.arcane },
  'monster-reptilian-ripper': { form: { body: 'tyrant' }, glow: GLOW.blood },
  'monster-frostbite-krampus': { form: { body: 'giant', feature: 'horns' }, glow: GLOW.frost },
  'monster-abominable-snowbeast': { form: { body: 'giant', feature: 'fur' }, glow: GLOW.frost },
};

const FALLBACK_FORMS: MonsterForm[] = [
  { body: 'dragon' }, { body: 'serpent' }, { body: 'slime' }, { body: 'beast', feature: 'fangs' },
  { body: 'bat' }, { body: 'wraith' }, { body: 'giant', feature: 'horns' },
];

function monsterLook(kind: string): { form: MonsterForm; glow: string } {
  return MONSTERS[kind] ?? { form: pick(FALLBACK_FORMS, kind, 'form'), glow: pick(Object.values(GLOW), kind, 'glow') };
}

const BODY = '#0d080a';

function Eyes({ pts, glow, r = 2.2 }: { pts: [number, number][]; glow: string; r?: number }) {
  return (
    <g>
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r * 2.3} fill={glow} opacity={0.28} />
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.8} fill={glow} />
          <circle cx={x - r * 0.25} cy={y - r * 0.2} r={r * 0.38} fill="#fffbe8" />
        </g>
      ))}
    </g>
  );
}

function Silhouette({ form, glow }: { form: MonsterForm; glow: string }): ReactNode {
  const rim = { fill: BODY, stroke: glow, strokeWidth: 1.4, strokeOpacity: 0.75, strokeLinejoin: 'round' as const };
  switch (form.body) {
    case 'dragon':
      return (
        <g>
          <g {...rim}>
            <path d="M50 48 L16 16 L21 33 L6 31 L17 46 L5 53 L27 57 Z" />
            <path d="M50 48 L84 16 L79 33 L94 31 L83 46 L95 53 L73 57 Z" />
            <path d="M62 80 Q84 86 90 72 Q86 85 66 89 Z" />
            <path d="M33 88 Q29 62 44 52 Q50 48 56 52 Q71 62 67 88 Z" />
            <path d="M45 56 Q41 40 47 30 L42 21 L49 25 L51 19 L53 25 L58 21 L53 30 Q59 40 55 56 Z" />
          </g>
          {form.crown && <path d="M43 20 L43 13 L46.5 16.5 L50 11 L53.5 16.5 L57 13 L57 20 Z" fill="#e8b84a" stroke={INK} strokeWidth={1} />}
          <Eyes pts={[[47.4, 31.5], [52.6, 31.5]]} glow={glow} r={1.5} />
          <path d="M46 37 L48 40 L50 37 L52 40 L54 37" fill="none" stroke={glow} strokeWidth={0.9} opacity={0.8} />
        </g>
      );
    case 'serpent':
      return (
        <g>
          <path d="M26 86 Q12 74 30 66 Q52 58 67 70 Q81 82 60 89 Q40 93 34 80 Q30 70 50 66" fill="none" stroke={glow} strokeOpacity={0.75} strokeWidth={14.8} strokeLinecap="round" />
          <path d="M26 86 Q12 74 30 66 Q52 58 67 70 Q81 82 60 89 Q40 93 34 80 Q30 70 50 66" fill="none" stroke={BODY} strokeWidth={12} strokeLinecap="round" />
          {[form.twin ? -1 : 0, ...(form.twin ? [1] : [])].map((side) => {
            const dx = side * 14;
            return (
              <g key={side}>
                <path d={`M50 66 Q${44 + dx} 48 ${52 + dx * 1.3} 34`} fill="none" stroke={glow} strokeOpacity={0.75} strokeWidth={11.6} strokeLinecap="round" />
                <path d={`M50 66 Q${44 + dx} 48 ${52 + dx * 1.3} 34`} fill="none" stroke={BODY} strokeWidth={9} strokeLinecap="round" />
                {form.hood && <path d={`M${40 + dx} 40 Q${52 + dx} 14 ${66 + dx} 40 Q${53 + dx} 34 ${40 + dx} 40 Z`} {...rim} />}
                <ellipse cx={54 + dx * 1.3} cy={30} rx={9.5} ry={6.5} transform={`rotate(-12 ${54 + dx * 1.3} 30)`} {...rim} />
                <path d={`M${57 + dx * 1.3} 35 L${58.5 + dx * 1.3} 40 L${60 + dx * 1.3} 35`} fill="#f4ecd8" />
                <Eyes pts={[[50 + dx * 1.3, 28.5], [58 + dx * 1.3, 27]]} glow={glow} r={1.5} />
                {form.crown && <path d={`M${46 + dx} 23 L${46 + dx} 16 L${50 + dx} 19.5 L${54 + dx} 13 L${58 + dx} 19.5 L${62 + dx} 16 L${62 + dx} 23 Z`} fill="#e8b84a" stroke={INK} strokeWidth={1} />}
              </g>
            );
          })}
        </g>
      );
    case 'slime':
      return (
        <g>
          <path d="M18 86 Q14 60 30 46 Q40 28 56 33 Q78 35 82 56 Q88 72 83 86 Q78 84 76 90 Q72 84 66 87 Q60 84 54 90 Q48 84 42 88 Q36 84 30 89 Q24 84 18 86 Z" {...rim} />
          <circle cx={34} cy={52} r={3} fill={glow} opacity={0.22} />
          <circle cx={68} cy={66} r={4} fill={glow} opacity={0.18} />
          <circle cx={62} cy={44} r={2} fill={glow} opacity={0.3} />
          <Eyes pts={[[42, 58], [60, 58]]} glow={glow} r={3.4} />
          <path d="M42 70 Q51 78 60 70" fill="none" stroke={glow} strokeWidth={1.6} />
        </g>
      );
    case 'beast': {
      const twin = form.feature === 'twin';
      const heads = twin ? [-13, 13] : [0];
      return (
        <g>
          <path d="M20 88 Q18 64 33 58 Q50 52 67 58 Q82 64 80 88 Z" {...rim} />
          {heads.map((dx) => (
            <g key={dx} transform={`translate(${dx} ${twin ? 2 : 0})`}>
              {form.feature === 'horns' && (
                <g fill="none" stroke={glow} strokeOpacity={0.8} strokeWidth={5}>
                  <path d="M38 40 Q26 30 30 46 Q34 54 40 48" />
                  <path d="M62 40 Q74 30 70 46 Q66 54 60 48" />
                </g>
              )}
              {form.feature === 'owl' && <path d="M38 38 L34 26 L44 34 Z M62 38 L66 26 L56 34 Z" {...rim} />}
              {form.feature !== 'owl' && form.feature !== 'horns' && <path d="M37 42 L35 30 L44 37 Z M63 42 L65 30 L56 37 Z" {...rim} />}
              <path d="M37 58 Q35 38 50 36 Q65 38 63 58 Q57 67 50 67 Q43 67 37 58 Z" {...rim} />
              {form.feature === 'fangs' && <path d="M44 61 L45.5 75 L47.5 62 Z M56 61 L54.5 75 L52.5 62 Z" fill="#f4ecd8" stroke={INK} strokeWidth={0.8} />}
              {form.feature === 'tusks' && (
                <g>
                  <path d="M50 60 Q48 76 54 84" fill="none" stroke={BODY} strokeWidth={7} strokeLinecap="round" />
                  <path d="M43 62 Q30 70 34 80" fill="none" stroke="#f4ecd8" strokeWidth={3} strokeLinecap="round" />
                  <path d="M57 62 Q70 70 66 80" fill="none" stroke="#f4ecd8" strokeWidth={3} strokeLinecap="round" />
                </g>
              )}
              {form.feature === 'owl' && <path d="M47 55 L50 62 L53 55 Z" fill={glow} opacity={0.9} />}
              {(form.feature === 'twin' || form.feature === 'horns') && <path d="M45 61 L47 65 L49 61 L51 65 L53 61 L55 65" fill="none" stroke={glow} strokeWidth={0.9} />}
              <Eyes pts={[[44, 49], [56, 49]]} glow={glow} r={form.feature === 'owl' ? 3 : 2.2} />
            </g>
          ))}
        </g>
      );
    }
    case 'toad':
      return (
        <g>
          <path d="M18 50 Q14 40 26 40 Q24 30 34 34 Q40 24 46 33" fill="none" stroke={glow} strokeOpacity={0.35} strokeWidth={2} />
          <path d="M30 62 Q30 42 50 42 Q70 42 70 62 Z" {...rim} />
          <circle cx={39} cy={44} r={6} {...rim} />
          <circle cx={61} cy={44} r={6} {...rim} />
          <Eyes pts={[[39, 44], [61, 44]]} glow={glow} r={2.6} />
          <path d="M40 56 Q50 61 60 56" fill="none" stroke={glow} strokeWidth={1.4} />
          <path d="M22 60 H78 Q82 86 63 91 H37 Q18 86 22 60 Z" fill="#1b1416" stroke={glow} strokeOpacity={0.75} strokeWidth={1.4} />
          <ellipse cx={50} cy={60} rx={29} ry={5} fill="#241a1c" stroke={glow} strokeOpacity={0.75} strokeWidth={1.4} />
          <path d="M30 74 H70" stroke={glow} strokeOpacity={0.3} strokeWidth={1.2} />
          <circle cx={44} cy={58} r={2} fill={glow} opacity={0.5} />
          <circle cx={57} cy={59} r={1.4} fill={glow} opacity={0.5} />
        </g>
      );
    case 'bat':
      return (
        <g>
          <path d="M50 50 Q34 26 8 32 Q15 42 11 50 Q22 48 26 57 Q34 50 38 59 Q44 52 50 62 Z" {...rim} />
          <path d="M50 50 Q66 26 92 32 Q85 42 89 50 Q78 48 74 57 Q66 50 62 59 Q56 52 50 62 Z" {...rim} />
          <ellipse cx={50} cy={58} rx={8} ry={15} {...rim} />
          <path d="M44 42 L42 32 L48 38 Z M56 42 L58 32 L52 38 Z" {...rim} />
          <circle cx={50} cy={45} r={7.5} {...rim} />
          <Eyes pts={[[47, 44], [53, 44]]} glow={glow} r={1.7} />
          <path d="M47.5 49 L48.5 52.5 L49.5 49 M50.5 49 L51.5 52.5 L52.5 49" fill="#f4ecd8" />
        </g>
      );
    case 'shell':
      return (
        <g>
          <path d="M28 74 L24 86 M44 78 L42 88 M58 78 L60 88 M72 74 L76 86" stroke={BODY} strokeWidth={6} strokeLinecap="round" />
          <path d="M78 64 Q92 58 93 68 Q90 76 80 74 Z" {...rim} />
          <Eyes pts={[[87, 65]]} glow={glow} r={1.6} />
          <path d="M16 74 Q20 34 50 31 Q80 34 84 74 Z" {...rim} />
          <g fill="none" stroke={glow} strokeOpacity={0.5} strokeWidth={1.2}>
            <path d="M30 70 L36 52 L50 46 L64 52 L70 70" />
            <path d="M36 52 L30 42 M64 52 L70 42 M50 46 V33" />
          </g>
          <path d="M40 32 L44 22 L48 32 Z M52 31 L57 18 L62 32 Z" fill={BODY} stroke={glow} strokeOpacity={0.6} strokeWidth={1} />
        </g>
      );
    case 'plant':
      return (
        <g>
          <path d="M50 92 Q45 72 52 58" fill="none" stroke={glow} strokeOpacity={0.6} strokeWidth={6} strokeLinecap="round" />
          <path d="M50 92 Q45 72 52 58" fill="none" stroke={BODY} strokeWidth={4} strokeLinecap="round" />
          <path d="M50 88 Q30 86 24 74 Q38 74 50 84 Z M50 86 Q70 82 78 70 Q64 70 50 82 Z" {...rim} />
          <path d="M26 46 Q50 14 74 46 Z" {...rim} />
          <path d="M26 52 Q50 82 74 52 Z" {...rim} />
          <path d="M30 46 L33 51 L36 46 L39 51 L42 46 L45 51 L48 46 L51 51 L54 46 L57 51 L60 46 L63 51 L66 46 L69 51 L71 46" fill="none" stroke="#f4ecd8" strokeWidth={1.4} />
          <ellipse cx={50} cy={49} rx={20} ry={2.4} fill={glow} opacity={0.35} />
          <Eyes pts={[[44, 33], [56, 33]]} glow={glow} r={1.8} />
        </g>
      );
    case 'wraith':
      return (
        <g>
          <path d="M50 16 Q29 20 27 50 L16 92 L29 83 L35 93 L43 84 L50 95 L57 84 L65 93 L71 83 L84 92 L73 50 Q71 20 50 16 Z" {...rim} />
          <path d="M30 54 L10 63 L15 66 L8 71 L17 71 L13 77 L24 70 M70 54 L90 63 L85 66 L92 71 L83 71 L87 77 L76 70" fill="none" stroke={glow} strokeOpacity={0.8} strokeWidth={1.6} strokeLinejoin="round" />
          <ellipse cx={50} cy={38} rx={11} ry={13} fill="#000000" />
          <Eyes pts={[[45.5, 38], [54.5, 38]]} glow={glow} r={2} />
        </g>
      );
    case 'giant':
      return (
        <g>
          <path d="M18 92 Q16 60 32 50 Q50 44 68 50 Q84 60 82 92 Z" {...rim} />
          <path d="M22 58 Q8 70 12 88 Q18 92 22 86 Q20 74 28 66 Z M78 58 Q92 70 88 88 Q82 92 78 86 Q80 74 72 66 Z" {...rim} />
          {form.feature === 'horns' && (
            <g fill="none" stroke={glow} strokeOpacity={0.8} strokeWidth={3.6} strokeLinecap="round">
              <path d="M42 36 Q32 24 36 12" />
              <path d="M58 36 Q68 24 64 12" />
            </g>
          )}
          {form.feature === 'fur' && <path d="M36 44 L38 34 L42 40 L46 30 L50 38 L54 30 L58 40 L62 34 L64 44" fill={BODY} stroke={glow} strokeOpacity={0.75} strokeWidth={1.2} />}
          <path d="M38 52 Q38 32 50 32 Q62 32 62 52 Q56 58 50 58 Q44 58 38 52 Z" {...rim} />
          <Eyes pts={[[45, 44], [55, 44]]} glow={glow} r={2} />
          {form.feature === 'horns'
            ? <path d="M48 52 Q50 62 47 68" fill="none" stroke="#ff3355" strokeWidth={2.4} strokeLinecap="round" />
            : <path d="M45 52 L47 55 L49 52 L51 55 L53 52 L55 55" fill="none" stroke={glow} strokeWidth={0.9} />}
        </g>
      );
    case 'tyrant':
      return (
        <g>
          <path d="M10 76 Q8 44 36 36 Q64 28 86 44 Q92 54 82 59 L54 61 Q48 70 34 82 Q22 86 10 76 Z" {...rim} />
          <path d="M54 61 L80 60 Q76 70 60 70 Z" {...rim} />
          <path d="M57 61 L59 65 L61 61 L63 65 L65 61 L67 65 L69 61 L71 65 L73 61 L75 64.5 L77 60.5" fill="none" stroke="#f4ecd8" strokeWidth={1.2} />
          <path d="M40 66 Q44 72 40 76 M40 76 L44 76" fill="none" stroke={glow} strokeOpacity={0.8} strokeWidth={1.6} />
          <Eyes pts={[[62, 46]]} glow={glow} r={2.4} />
          <path d="M57 41 L67 42" stroke={glow} strokeWidth={1.2} opacity={0.7} />
        </g>
      );
  }
}

export function MonsterArt({ kind }: { kind: string }) {
  const id = useSvgIds();
  const { form, glow } = monsterLook(kind);
  return (
    <g>
      <defs>
        <radialGradient id={id('bg')} cx="50%" cy="46%" r="62%">
          <stop offset="0" stopColor={glow} stopOpacity={0.55} />
          <stop offset="0.45" stopColor={glow} stopOpacity={0.12} />
          <stop offset="1" stopColor="#000000" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={100} height={100} fill={id.url('bg')} />
      <ellipse cx={50} cy={92} rx={36} ry={5} fill="#000000" opacity={0.55} />
      <g transform="translate(50 56) scale(1.14) translate(-50 -56)">
        <Silhouette form={form} glow={glow} />
      </g>
    </g>
  );
}

// ============================================================================
// Items, magic, modifiers, challenges, gifts
// ============================================================================

const s2 = { stroke: INK, strokeWidth: 2.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
const GOLD = '#e8b84a';
const BRASS = '#c8913a';

function classFromName(name: string): HtsBaseClass | null {
  const n = name.toLowerCase();
  return (Object.keys(CLASS_META) as HtsBaseClass[]).find((c) => n.startsWith(c)) ?? null;
}

export function ItemArt({ card }: { card: Pick<HtsCard, 'kind' | 'name' | 'type'> }) {
  const n = card.name.toLowerCase();
  const cursed = card.type === 'cursedItem';
  const glow = cursed ? '#b06bff' : '#ffd88a';
  let body: ReactNode;
  if (n.includes('mask')) {
    const cls = classFromName(card.name) ?? 'thief';
    const m = CLASS_META[cls];
    body = (
      <g>
        <path {...s2} fill={m.color} d="M10 46 Q14 30 50 36 Q86 30 90 46 Q90 72 68 70 Q56 68 50 56 Q44 68 32 70 Q10 72 10 46 Z" />
        <ellipse cx={32} cy={50} rx={9} ry={6} fill={INK} />
        <ellipse cx={68} cy={50} rx={9} ry={6} fill={INK} />
        <path d="M10 46 Q4 44 2 52 M90 46 Q96 44 98 52" fill="none" stroke={INK} strokeWidth={2.4} />
        <g transform="translate(40 18) scale(0.85)"><SigilShape cls={cls} fill="#f6e2b0" /></g>
      </g>
    );
  } else if (n.includes('doll')) {
    body = (
      <g {...s2} fill="#d9b56f">
        <path d="M50 26 V88" fill="none" stroke="#7a4a24" strokeWidth={5} />
        <circle cx={50} cy={28} r={11} />
        <path d="M24 44 H76 L70 52 H30 Z" />
        <path d="M38 50 H62 L60 74 H40 Z" />
        <path d="M44 24 L47 29 M56 24 L53 29" />
        <path d="M45 34 Q50 37 55 34" fill="none" />
        <circle cx={50} cy={60} r={5} fill="#c2263c" />
        <circle cx={50} cy={60} r={2} fill="#f4ecd8" stroke="none" />
      </g>
    );
  } else if (n.includes('coin')) {
    const rusty = n.includes('rusty');
    body = (
      <g {...s2}>
        <circle cx={50} cy={52} r={28} fill={rusty ? '#9a5a2e' : GOLD} />
        <circle cx={50} cy={52} r={21} fill="none" strokeWidth={1.6} />
        <path d="M44 42 Q50 36 56 42 Q50 48 56 58 Q50 66 44 60" fill="none" strokeWidth={2.2} />
        {rusty
          ? [[36, 40], [62, 66], [66, 42], [40, 66]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={3} fill="#5a3218" stroke="none" />)
          : <path d="M74 22 L76 28 L82 30 L76 32 L74 38 L72 32 L66 30 L72 28 Z" fill="#fff6d0" strokeWidth={1.4} />}
      </g>
    );
  } else if (n.includes('ring')) {
    // Really Big Ring < Even Bigger Ring < Biggest Ring Ever: the gem grows.
    const size = n.includes('biggest') ? 2 : n.includes('even') ? 1 : 0;
    const gem = ['50,22 61,33 50,44 39,33', '50,14 66,30 50,48 34,30', '50,6 72,28 50,52 28,28'][size]!;
    const facets = ['M39 33 H61 M50 22 L46 33 L50 44 M50 22 L54 33 L50 44', 'M34 30 H66 M50 14 L44 30 L50 48 M50 14 L56 30 L50 48', 'M28 28 H72 M50 6 L42 28 L50 52 M50 6 L58 28 L50 52'][size]!;
    body = (
      <g {...s2}>
        <ellipse cx={50} cy={62} rx={26} ry={22} fill="none" stroke={INK} strokeWidth={13} />
        <ellipse cx={50} cy={62} rx={26} ry={22} fill="none" stroke={GOLD} strokeWidth={8} />
        <polygon points={gem} fill={size === 2 ? '#ff5fa2' : '#3fd2c0'} />
        <path d={facets} fill="none" strokeWidth={1.2} />
        {size === 2 && [[18, 22], [82, 20], [84, 48]].map(([x, y]) => <polygon key={x} points={star(x!, y!, 6, 2, 4)} fill="#fff6d0" strokeWidth={1} />)}
      </g>
    );
  } else if (n.includes('snake')) {
    body = (
      <g {...s2}>
        <rect x={18} y={38} width={28} height={28} rx={6} fill="#f4ecd8" transform="rotate(-12 32 52)" />
        <rect x={54} y={36} width={28} height={28} rx={6} fill="#f4ecd8" transform="rotate(10 68 50)" />
        <circle cx={32} cy={52} r={4} fill="#c2263c" stroke="none" />
        <circle cx={68} cy={50} r={4} fill="#c2263c" stroke="none" />
        <path d="M12 80 Q30 66 50 80 Q70 94 88 76" fill="none" stroke={INK} strokeWidth={8} />
        <path d="M12 80 Q30 66 50 80 Q70 94 88 76" fill="none" stroke="#5aa832" strokeWidth={4.5} />
        <circle cx={88} cy={76} r={4} fill="#5aa832" />
      </g>
    );
  } else if (n.includes('key')) {
    body = <g transform="translate(50 52) scale(1.6) rotate(-35)"><Charge name="key" fill={GOLD} /></g>;
  } else if (n.includes('bag')) {
    body = (
      <g {...s2}>
        <path d="M30 40 Q16 60 22 80 Q50 94 78 80 Q84 60 70 40 Z" fill="#8a5a32" />
        <path d="M30 40 L40 26 H60 L70 40" fill="#a06a3c" />
        <path d="M36 38 H64" stroke={GOLD} strokeWidth={4} />
        <path d="M40 66 Q50 54 60 66 Q50 76 44 68" fill="none" stroke="#3fd2c0" strokeWidth={3} />
      </g>
    );
  } else if (n.includes('hourglass')) {
    body = (
      <g {...s2}>
        <rect x={26} y={16} width={48} height={8} rx={3} fill={BRASS} />
        <rect x={26} y={80} width={48} height={8} rx={3} fill={BRASS} />
        <path d="M32 24 H68 Q68 44 52 52 Q68 60 68 80 H32 Q32 60 48 52 Q32 44 32 24 Z" fill="#cfeef0" fillOpacity={0.85} />
        <path d="M38 30 H62 Q60 42 50 48 Q40 42 38 30 Z" fill="#e8c27a" stroke="none" />
        <path d="M38 78 Q50 66 62 78 Z" fill="#e8c27a" stroke="none" />
        <path d="M50 52 V72" stroke="#e8c27a" strokeWidth={1.6} />
      </g>
    );
  } else if (n.includes('glove')) {
    body = (
      <g {...s2} fill="#5a3a6e">
        <path d="M34 86 V54 L30 34 Q30 28 35 29 L40 46 V24 Q40 18 45 19 L48 44 V20 Q49 14 54 16 L56 44 V24 Q58 18 62 21 L63 48 L70 38 Q75 36 76 41 L68 62 Q66 76 62 86 Z" />
        <path d="M34 78 H62" stroke="#b06bff" strokeWidth={3} />
      </g>
    );
  } else if (n.includes('tether')) {
    body = (
      <g {...s2} fill="none">
        {[[28, 30], [42, 44], [56, 58], [70, 72]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={11} ry={7} transform={`rotate(45 ${x} ${y})`} stroke={INK} strokeWidth={7} />
        ))}
        {[[28, 30], [42, 44], [56, 58], [70, 72]].map(([x, y], i) => (
          <ellipse key={i} cx={x} cy={y} rx={11} ry={7} transform={`rotate(45 ${x} ${y})`} stroke={i % 2 ? '#9aa3ad' : '#c8ced4'} strokeWidth={3.4} />
        ))}
        <path d="M74 22 Q90 30 82 44 Q78 36 70 38 Q80 30 74 22 Z" fill="#b5f4ff" fillOpacity={0.7} stroke="#b5f4ff" strokeWidth={1} />
      </g>
    );
  } else if (n.includes('goblet')) {
    // Goblet of Caffeination: a steaming cup of something far too strong.
    body = (
      <g {...s2}>
        <path d="M38 30 Q36 20 42 16 M50 28 Q46 18 52 12 M62 30 Q60 20 66 16" fill="none" stroke="#f4ecd8" strokeWidth={2.6} opacity={0.9} />
        <path d="M26 36 H74 Q74 62 50 66 Q26 62 26 36 Z" fill={BRASS} />
        <ellipse cx={50} cy={37} rx={23} ry={5} fill="#5a3218" />
        <rect x={46} y={66} width={8} height={12} fill={BRASS} />
        <ellipse cx={50} cy={82} rx={18} ry={5} fill={BRASS} />
        <circle cx={50} cy={52} r={5} fill="#3fd2c0" />
      </g>
    );
  } else if (n.includes('silver')) {
    // Silver Lining: a storm cloud with a bright edge and a ray breaking through.
    body = (
      <g {...s2}>
        <path d="M58 70 L66 90 M44 72 L40 88" stroke="#ffd23f" strokeWidth={4} />
        <path d="M22 66 Q14 66 14 56 Q14 46 26 46 Q26 32 42 32 Q50 22 62 30 Q80 28 80 46 Q90 48 88 58 Q86 68 76 66 Z" fill="#5c6270" />
        <path d="M26 46 Q26 32 42 32 Q50 22 62 30 Q80 28 80 46" fill="none" stroke="#e8eef4" strokeWidth={5} />
      </g>
    );
  } else if (n.includes('bile')) {
    // Dragon's Bile: a corked flask of something green and bubbling.
    body = (
      <g {...s2}>
        <rect x={42} y={14} width={16} height={10} rx={2} fill="#9a6a3c" />
        <path d="M44 24 H56 V36 Q76 44 74 64 Q72 86 50 86 Q28 86 26 64 Q24 44 44 36 Z" fill="#cfeef0" fillOpacity={0.6} />
        <path d="M27 60 Q50 52 73 60 Q72 84 50 84 Q28 84 27 60 Z" fill="#7ee03a" stroke="none" />
        {[[42, 70, 3], [56, 66, 2.4], [50, 76, 2]].map(([x, y, r]) => <circle key={x} cx={x} cy={y} r={r} fill="#d6ff9a" strokeWidth={1} />)}
      </g>
    );
  } else if (n.includes('grimoire')) {
    // Soulbound Grimoire: a chained book with an eye on its cover.
    body = (
      <g {...s2}>
        <path d="M22 24 H70 Q78 24 78 32 V82 H30 Q22 82 22 74 Z" fill="#4a2a5e" />
        <path d="M30 82 V30 H78" fill="none" strokeWidth={1.6} />
        <ellipse cx={54} cy={52} rx={12} ry={8} fill="#f4ecd8" />
        <circle cx={54} cy={52} r={4.5} fill="#b06bff" />
        <path d="M18 44 L84 64 M18 64 L84 44" stroke="#9aa3ad" strokeWidth={4.5} />
        <rect x={47} y={50} width={14} height={12} rx={2} fill={GOLD} />
      </g>
    );
  } else if (n.includes('cookie')) {
    body = (
      <g {...s2}>
        <path d="M22 26 H48 L44 84 H26 Z" fill="#f6f2ea" />
        <path d="M24 44 H46" strokeWidth={1.4} />
        <circle cx={64} cy={64} r={20} fill="#c98a44" />
        {[[58, 56], [70, 60], [62, 72], [72, 72], [56, 66]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={2.6} fill="#4a2a14" stroke="none" />)}
      </g>
    );
  } else if (n.includes('skate')) {
    body = (
      <g {...s2}>
        <path d="M26 24 H50 V54 Q64 56 76 64 Q80 70 74 72 H26 Z" fill="#f6f2ea" />
        <path d="M30 34 H46 M30 42 H46" strokeWidth={1.4} />
        <path d="M18 82 H84 Q88 82 86 78" fill="none" stroke="#c8ced4" strokeWidth={4} />
        <path d="M34 72 V82 M66 72 V82" />
      </g>
    );
  } else {
    body = (
      <g {...s2}>
        <path d="M18 46 Q18 28 50 28 Q82 28 82 46 Z" fill="#8a5a32" />
        <rect x={18} y={46} width={64} height={36} rx={3} fill="#a06a3c" />
        <rect x={44} y={42} width={12} height={14} rx={2} fill={GOLD} />
      </g>
    );
  }
  return (
    <g>
      <circle cx={50} cy={54} r={40} fill={glow} opacity={cursed ? 0.22 : 0.3} />
      {cursed && <path d="M20 22 Q22 30 18 34 M82 20 Q80 28 84 32 M50 8 Q48 14 52 16" fill="none" stroke="#b06bff" strokeWidth={2} opacity={0.7} />}
      {body}
    </g>
  );
}

const MAGIC_GLYPHS: { match: string; glyph: ReactNode }[] = [
  { match: 'fallen', glyph: <g transform="translate(-12 -14) scale(1)"><SigilShape cls="necromancer" fill="#e6dcff" /></g> },
  { match: 'boost', glyph: <path d="M0 -16 L12 -2 H5 V16 H-5 V-2 H-12 Z" fill="#ffd23f" stroke={INK} strokeWidth={2} strokeLinejoin="round" /> },
  { match: 'destructive', glyph: <polygon points={star(0, 0, 18, 8, 9)} fill="#ff7a2e" stroke={INK} strokeWidth={2} strokeLinejoin="round" /> },
  { match: 'enchanted', glyph: <g fill="#fff3b0" stroke={INK} strokeWidth={1.6} strokeLinejoin="round"><polygon points={star(0, 0, 15, 4, 4)} /><polygon points={star(12, -10, 6, 1.8, 4)} /><polygon points={star(-12, 10, 5, 1.6, 4)} /></g> },
  { match: 'trap', glyph: <g fill="none" stroke="#7ee08a" strokeWidth={3} strokeLinecap="round"><path d="M-16 10 Q-6 -16 4 6 Q10 18 16 -6" /><path d="M-14 -8 Q0 4 14 14" /></g> },
  { match: 'exchange', glyph: <g fill="none" stroke="#9fd0ff" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round"><path d="M-14 -4 A14 14 0 0 1 12 -8 M12 -8 L13 -16 M12 -8 L4 -9" /><path d="M14 4 A14 14 0 0 1 -12 8 M-12 8 L-13 16 M-12 8 L-4 9" /></g> },
  { match: 'winds', glyph: <g fill="none" stroke="#cfe9ff" strokeWidth={3} strokeLinecap="round"><path d="M-18 -8 H6 Q14 -8 12 -15 Q9 -20 4 -16" /><path d="M-18 2 H12 Q20 2 18 9 Q15 14 10 10" /><path d="M-14 12 H0" /></g> },
  { match: 'beast', glyph: <g fill="#f4d7a8" stroke={INK} strokeWidth={1.8}><path d="M0 4 q-10 0 -10 7 q0 6 10 6 q10 0 10 -6 q0 -7 -10 -7 Z" /><ellipse cx={-11} cy={-4} rx={4} ry={5} /><ellipse cx={-4} cy={-11} rx={4} ry={5.4} /><ellipse cx={4} cy={-11} rx={4} ry={5.4} /><ellipse cx={11} cy={-4} rx={4} ry={5} /></g> },
  { match: 'refresh', glyph: <g fill="none" stroke="#a6ff3d" strokeWidth={3.6} strokeLinecap="round"><path d="M12 -10 A15 15 0 1 0 15 4" /><path d="M12 -10 L13 -19 M12 -10 L3 -10" /></g> },
  { match: 'labrys', glyph: <g stroke={INK} strokeWidth={1.8} strokeLinejoin="round"><rect x={-2} y={-16} width={4} height={34} rx={1.5} fill="#7a4a24" /><path d="M-2 -12 Q-16 -16 -18 -4 Q-16 6 -2 2 Z M2 -12 Q16 -16 18 -4 Q16 6 2 2 Z" fill="#dfe6ee" /><path d="M8 4 L2 12 H7 L1 20" fill="none" stroke="#ffd23f" strokeWidth={2.4} /></g> },
  { match: 'sacrifice', glyph: <g stroke={INK} strokeWidth={1.8} strokeLinejoin="round"><path d="M0 -18 L4 4 H-4 Z" fill="#dfe6ee" /><rect x={-9} y={4} width={18} height={4} rx={1.5} fill={GOLD} /><rect x={-2.5} y={8} width={5} height={10} fill="#7a4a24" /></g> },
  { match: 'cheer', glyph: <g stroke={INK} strokeWidth={2} strokeLinejoin="round"><path d="M-12 8 Q-12 -14 0 -14 Q12 -14 12 8 L15 12 H-15 Z" fill={GOLD} /><circle cx={0} cy={15} r={3.4} fill={GOLD} /><path d="M-6 -18 Q0 -24 6 -18" fill="none" stroke="#c2263c" strokeWidth={3} /></g> },
];

export function MagicArt({ card }: { card: Pick<HtsCard, 'kind' | 'name'> }) {
  const n = card.name.toLowerCase();
  const glyph = (MAGIC_GLYPHS.find((g) => n.includes(g.match)) ?? MAGIC_GLYPHS[3]!).glyph;
  const runes = Array.from({ length: 12 }, (_, i) => i);
  return (
    <g>
      <circle cx={50} cy={50} r={40} fill="#2a2470" opacity={0.35} />
      <circle cx={50} cy={50} r={36} fill="none" stroke="#9fd0ff" strokeWidth={1.6} opacity={0.8} />
      <circle cx={50} cy={50} r={29} fill="none" stroke="#9fd0ff" strokeWidth={1} opacity={0.6} />
      {runes.map((i) => {
        const a = (i / 12) * Math.PI * 2;
        const x = 50 + Math.cos(a) * 32.5;
        const y = 50 + Math.sin(a) * 32.5;
        return <path key={i} d={`M${x - 2} ${y - 2} L${x + 2} ${y + 2} M${x + 2} ${y - 2} L${x} ${y}`} stroke="#cfe9ff" strokeWidth={1} opacity={0.8} />;
      })}
      <polygon points={star(50, 50, 28, 12, 6, -Math.PI / 2)} fill="none" stroke="#9fd0ff" strokeWidth={0.8} opacity={0.45} />
      <g transform="translate(50 51) scale(1.6)">{glyph}</g>
    </g>
  );
}

export function ModifierArt({ choices }: { choices: number[] | null }) {
  const vals = choices ?? [];
  const fmt = (v: number) => (v > 0 ? `+${v}` : `−${Math.abs(v)}`);
  const one = vals.length <= 1;
  const teeth = Array.from({ length: 16 }, (_, i) => i);
  return (
    <g>
      <g fill={BRASS} stroke={INK} strokeWidth={1.6}>
        {teeth.map((i) => (
          <rect key={i} x={46} y={8} width={8} height={10} rx={1.5} transform={`rotate(${i * 22.5} 50 50)`} />
        ))}
        <circle cx={50} cy={50} r={36} />
      </g>
      <circle cx={50} cy={50} r={29} fill="#f2e3bf" stroke={INK} strokeWidth={1.6} />
      {one ? (
        <text x={50} y={62} textAnchor="middle" fontSize={34} fontWeight={800} fill={(vals[0] ?? 0) >= 0 ? '#2f7a3d' : '#b3262b'} fontFamily="var(--font-ui)">
          {vals.length ? fmt(vals[0]!) : '±'}
        </text>
      ) : (
        <g fontFamily="var(--font-ui)" fontWeight={800} textAnchor="middle">
          <path d="M28 72 L72 28" stroke={INK} strokeWidth={1.6} />
          <text x={39} y={48} fontSize={22} fill="#2f7a3d">{fmt(vals[0]!)}</text>
          <text x={62} y={72} fontSize={22} fill="#b3262b">{fmt(vals[1]!)}</text>
        </g>
      )}
    </g>
  );
}

/** A Challenge: crossed swords on a red burst; a class Challenge carries that class's sigil and colour instead. */
export function ChallengeArt({ cls = null }: { cls?: HtsBaseClass | null }) {
  const burst = star(50, 50, 40, 26, 12);
  const meta = cls ? CLASS_META[cls] : null;
  return (
    <g>
      <polygon points={burst} fill={meta?.color ?? '#c2263c'} stroke={INK} strokeWidth={2} strokeLinejoin="round" />
      <polygon points={star(50, 50, 30, 20, 12, 0.2)} fill={meta ? '#ffffff' : '#ff6a3d'} opacity={meta ? 0.22 : 0.6} />
      {meta && <circle cx={50} cy={50} r={25} fill={meta.deep} stroke={INK} strokeWidth={2} />}
      <g transform={meta ? 'translate(29 29) scale(1.75)' : 'translate(18 18) scale(2.66)'}>
        <SigilShape cls={cls ?? 'fighter'} fill="#f4ecd8" />
      </g>
      {meta && (
        <g fontFamily="var(--font-ui)" fontWeight={800} textAnchor="middle">
          <circle cx={78} cy={78} r={12} fill="#f2e3bf" stroke={INK} strokeWidth={1.8} />
          <text x={78} y={83.5} fontSize={14} fill="#2f7a3d">+3</text>
        </g>
      )}
    </g>
  );
}

export function GiftArt({ kind }: { kind: string }) {
  const paper = pick(['#c2263c', '#2f7a3d', '#2b56a8', '#e8b84a'], kind, 'paper');
  const ribbon = paper === '#e8b84a' ? '#c2263c' : '#e8b84a';
  return (
    <g {...s2}>
      <rect x={20} y={42} width={60} height={42} rx={3} fill={paper} />
      <rect x={16} y={32} width={68} height={14} rx={3} fill={paper} />
      <rect x={45} y={32} width={10} height={52} fill={ribbon} />
      <path d="M50 32 Q34 14 28 24 Q26 32 50 32 Q66 14 72 24 Q74 32 50 32 Z" fill={ribbon} />
      {[[30, 60], [68, 70], [32, 76], [66, 54]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={2.4} fill="#ffffff" stroke="none" opacity={0.75} />)}
    </g>
  );
}

/** The back of a card (fills the card, viewBox 0 0 100 140): walnut, gilt, a sword-and-die crest. */
export function CardBack() {
  const id = useSvgIds();
  return (
    <svg viewBox="0 0 100 140" className="hts-back" role="img" aria-label="Face-down card" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={id('wood')} cx="50%" cy="44%" r="72%">
          <stop offset="0" stopColor="#6b3c1e" />
          <stop offset="1" stopColor="#24130a" />
        </radialGradient>
        <pattern id={id('grain')} width={100} height={6} patternUnits="userSpaceOnUse">
          <path d="M0 3 Q25 1 50 3 T100 3" fill="none" stroke="#000000" strokeOpacity={0.18} strokeWidth={1} />
        </pattern>
      </defs>
      <rect width={100} height={140} fill={id.url('wood')} />
      <rect width={100} height={140} fill={id.url('grain')} />
      <rect x={5} y={5} width={90} height={130} rx={7} fill="none" stroke={GOLD} strokeWidth={2} />
      <rect x={9} y={9} width={82} height={122} rx={5} fill="none" stroke={GOLD} strokeWidth={0.8} strokeDasharray="2 2" />
      {[[9, 9], [91, 9], [9, 131], [91, 131]].map(([x, y]) => <polygon key={`${x}${y}`} points={star(x!, y!, 5, 2, 4)} fill={GOLD} />)}
      <g transform="translate(50 68)">
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M-40 -42 L-35 -46 L26 18 L21 22 Z" fill="#dfe6ee" />
          <path d="M40 -42 L35 -46 L-26 18 L-21 22 Z" fill="#dfe6ee" />
          <path d="M17 27 L29 15 M-17 27 L-29 15" strokeWidth={4} stroke={GOLD} />
          <circle cx={27} cy={28} r={3} fill={GOLD} />
          <circle cx={-27} cy={28} r={3} fill={GOLD} />
        </g>
        <path d="M-20 -22 H20 V2 C20 18 10 27 0 32 C-10 27 -20 18 -20 2 Z" fill="#8a1f22" stroke={INK} strokeWidth={2.4} />
        <path d="M-16 -18 H16 V2 C16 15 8 22 0 26 C-8 22 -16 15 -16 2 Z" fill="none" stroke={GOLD} strokeWidth={1.2} />
        <rect x={-10} y={-10} width={20} height={20} rx={4} fill="#f4ecd8" stroke={INK} strokeWidth={1.8} transform="rotate(12)" />
        {[[-4.5, -4.5], [4.5, 4.5], [0, 0], [-4.5, 4.5], [4.5, -4.5]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.7} fill={INK} transform="rotate(12)" />)}
      </g>
      <path d="M26 114 Q50 106 74 114 L70 122 Q50 114 30 122 Z" fill={GOLD} stroke={INK} strokeWidth={1.2} opacity={0.9} />
    </svg>
  );
}
