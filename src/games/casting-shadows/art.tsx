// Casting Shadows — original inline-SVG art: one gem iconography (dice, pool,
// costs, hex yields), element emblems for spells, constellation familiars for
// companions, moonlit caster silhouettes (light + shadow form), hex terrain.
//
// Everything is parametric: a card's look comes from its element plus a
// deterministic hash of its kind (rotation, ring ticks, star field, orbiting
// glyphs), so 87 card kinds read as one set and no two are identical.
// Lean on purpose: gradients only, no SVG filters.

import { hashString, seededRandom } from '@/core/rng';
import type { ReactNode } from 'react';
import { useSvgIds } from '@/ui/kit/hooks';
import { motifFor } from './motifs';
import type { CsCard, CsCharacterDef, CsForm, CsHexId, CsResource, CsResourceCost } from './types';

export const INK = '#060b16';

// ============================================================================
// Deterministic variation
// ============================================================================

// ============================================================================
// Elements
// ============================================================================

export type CsElement = 'flame' | 'tide' | 'frost' | 'shadow' | 'stone' | 'arcane' | 'ward' | 'beast' | 'gem';

export const ELEMENT: Record<CsElement, { label: string; main: string; glow: string; deep: string }> = {
  flame: { label: 'Flame', main: '#ff7a45', glow: '#ffd27a', deep: '#2b0a12' },
  tide: { label: 'Tide', main: '#3fb2ff', glow: '#a8ecff', deep: '#061a34' },
  frost: { label: 'Frost', main: '#9feeff', glow: '#f0feff', deep: '#0b2336' },
  shadow: { label: 'Shadow', main: '#b06bff', glow: '#e7c8ff', deep: '#150926' },
  stone: { label: 'Stone', main: '#e2a556', glow: '#ffe1a6', deep: '#24160a' },
  arcane: { label: 'Arcane', main: '#7cf5ff', glow: '#e0fdff', deep: '#071d2a' },
  ward: { label: 'Counterspell', main: '#c9d4ff', glow: '#ffffff', deep: '#0f1430' },
  beast: { label: 'Companion', main: '#7dffb6', glow: '#dcffe9', deep: '#06221a' },
  gem: { label: 'Resource', main: '#f7d36b', glow: '#fff4c4', deep: '#1d1606' },
};

const STONE_KINDS = new Set(['earth-shatter', 'groundbreaker', 'iron-carapace', 'vort-hex', 'supercharged-jewel', 'res-molten-red-gem']);

function costColours(c: CsResourceCost | undefined, acc: { red: number; blue: number; shadow: number; any: number }) {
  if (!c) return;
  acc.red += (c.redGem ?? 0) + (c.redOrb ?? 0);
  acc.blue += (c.blueGem ?? 0) + (c.blueOrb ?? 0);
  acc.shadow += (c.shadowFragment ?? 0) + (c.cursedCrystal ?? 0);
  acc.any += (c.anyGem ?? 0) + (c.anyOrb ?? 0);
}

export function elementOf(card: Pick<CsCard, 'kind' | 'type' | 'castTiers' | 'collectionCost' | 'inflictFreeze' | 'inflictBurn' | 'expansion' | 'grantsResource'>): CsElement {
  if (card.type === 'counterspell') return 'ward';
  if (card.type === 'companion') return 'beast';
  if (card.type === 'resource') return 'gem';
  if (STONE_KINDS.has(card.kind)) return 'stone';
  const tiers = card.castTiers ?? [];
  if (card.inflictFreeze || tiers.some((t) => t.inflictFreeze)) return 'frost';
  const acc = { red: 0, blue: 0, shadow: 0, any: 0 };
  costColours(card.collectionCost, acc);
  for (const t of tiers) costColours(t.cost, acc);
  if (acc.shadow > 0 || /shadow|shroud|doom|spectral|sinister|psychic|curse|dark/.test(card.kind)) return 'shadow';
  if (card.inflictBurn || tiers.some((t) => t.inflictBurn) || acc.red > acc.blue) return 'flame';
  if (acc.blue > acc.red) return card.expansion === 'ice-storm' ? 'frost' : 'tide';
  return 'arcane';
}

// ============================================================================
// Gems: one iconography for dice, pools, costs and hex yields
// ============================================================================

export type GemIcon = CsResource | 'anyGem' | 'anyOrb';

const GEM_COLOUR: Record<GemIcon, string> = {
  redGem: '#ff3d5a',
  blueGem: '#3d8bff',
  purpleGem: '#b45cff',
  redOrb: '#ff7a3d',
  blueOrb: '#36d6ff',
  purpleOrb: '#d88bff',
  shadowFragment: '#9a6bd6',
  cursedCrystal: '#ff4d6d',
  anyGem: '#e6e6ff',
  anyOrb: '#e6e6ff',
};

const GEM_LABEL: Record<GemIcon, string> = {
  redGem: 'Red Gem',
  blueGem: 'Blue Gem',
  purpleGem: 'Purple Gem (wild)',
  redOrb: 'Red Orb',
  blueOrb: 'Blue Orb',
  purpleOrb: 'Purple Orb (wild)',
  shadowFragment: 'Shadow Fragment',
  cursedCrystal: 'Cursed Crystal',
  anyGem: 'Any Gem',
  anyOrb: 'Any Orb',
};

function Gem({ c, split }: { c: string; split?: [string, string] }) {
  return (
    <g stroke={INK} strokeWidth={1.3} strokeLinejoin="round">
      {split ? (
        <>
          <polygon points="12,2.5 12,21.5 3.5,8.5" fill={split[0]} />
          <polygon points="12,2.5 20.5,8.5 12,21.5" fill={split[1]} />
        </>
      ) : (
        <polygon points="12,2.5 20.5,8.5 12,21.5 3.5,8.5" fill={c} />
      )}
      <polygon points="7.5,8.5 12,4.5 16.5,8.5 12,10.5" fill="#fff" fillOpacity={0.45} strokeWidth={0.8} />
      <path d="M3.5 8.5 L12 10.5 L20.5 8.5 M12 10.5 L12 21.5" fill="none" strokeWidth={0.7} strokeOpacity={0.55} />
      <polygon points="12,10.5 20.5,8.5 12,21.5" fill="#000" fillOpacity={0.2} stroke="none" />
    </g>
  );
}

function Orb({ c, split }: { c: string; split?: [string, string] }) {
  return (
    <g>
      {split ? (
        <>
          <path d="M12 3.5 A8.5 8.5 0 0 0 12 20.5 Z" fill={split[0]} />
          <path d="M12 3.5 A8.5 8.5 0 0 1 12 20.5 Z" fill={split[1]} />
        </>
      ) : (
        <circle cx={12} cy={12} r={8.5} fill={c} />
      )}
      <circle cx={12} cy={12} r={8.5} fill="none" stroke={INK} strokeWidth={1.3} />
      <ellipse cx={12} cy={15.5} rx={6} ry={3.6} fill="#000" fillOpacity={0.18} />
      <ellipse cx={9.2} cy={8.6} rx={3} ry={2.1} fill="#fff" fillOpacity={0.6} transform="rotate(-30 9.2 8.6)" />
      <circle cx={15.5} cy={14.8} r={1} fill="#fff" fillOpacity={0.45} />
    </g>
  );
}

function Sparkle({ x, y, r = 2.6 }: { x: number; y: number; r?: number }) {
  return <path d={`M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z`} fill="#fff" stroke={INK} strokeWidth={0.6} />;
}

/** The icon for a resource or a wildcard cost, on a 24×24 canvas. */
export function GemGlyph({ icon }: { icon: GemIcon }) {
  switch (icon) {
    case 'redGem':
    case 'blueGem':
      return <Gem c={GEM_COLOUR[icon]} />;
    case 'purpleGem':
      return <g><Gem c={GEM_COLOUR.purpleGem} /><Sparkle x={19.5} y={4.5} /></g>;
    case 'redOrb':
    case 'blueOrb':
      return <Orb c={GEM_COLOUR[icon]} />;
    case 'purpleOrb':
      return <g><Orb c={GEM_COLOUR.purpleOrb} /><Sparkle x={19.5} y={4.5} /></g>;
    case 'anyGem':
      return <Gem c="#ddd" split={[GEM_COLOUR.redGem, GEM_COLOUR.blueGem]} />;
    case 'anyOrb':
      return <Orb c="#ddd" split={[GEM_COLOUR.redOrb, GEM_COLOUR.blueOrb]} />;
    case 'shadowFragment':
      return (
        <g stroke={INK} strokeWidth={1.3} strokeLinejoin="round">
          <polygon points="13,2 18.5,9.5 15,22 7.5,14.5 5.5,6.5" fill="#22123a" />
          <polygon points="13,2 18.5,9.5 12.5,12" fill="#b06bff" fillOpacity={0.85} strokeWidth={0.8} />
          <polygon points="5.5,6.5 12.5,12 7.5,14.5" fill="#6b3fb0" strokeWidth={0.8} />
          <path d="M12.5 12 L15 22" stroke="#e7c8ff" strokeOpacity={0.6} strokeWidth={0.7} />
        </g>
      );
    case 'cursedCrystal':
      return (
        <g stroke={INK} strokeWidth={1.3} strokeLinejoin="round">
          <polygon points="8,2.5 16,2.5 19.5,12 16,21.5 8,21.5 4.5,12" fill="#5a0c1f" />
          <polygon points="8,2.5 16,2.5 13.5,8 10.5,8" fill="#ff4d6d" fillOpacity={0.9} strokeWidth={0.8} />
          <ellipse cx={9.6} cy={12.5} rx={1.9} ry={2.3} fill="#ff4d6d" stroke="none" />
          <ellipse cx={14.4} cy={12.5} rx={1.9} ry={2.3} fill="#ff4d6d" stroke="none" />
          <path d="M10 17.5 h4 M11 17 v1.4 M13 17 v1.4" stroke="#ff4d6d" strokeWidth={0.9} />
          <path d="M16 2.5 L13.5 8 L15.5 11" fill="none" stroke="#ffb3c1" strokeWidth={0.6} />
        </g>
      );
  }
}

export function GemIconSvg({ icon, size = 20, title }: { icon: GemIcon; size?: number; title?: string }) {
  return (
    <svg className="cs-gem" viewBox="0 0 24 24" width={size} height={size} role="img" aria-label={title ?? GEM_LABEL[icon]}>
      <title>{title ?? GEM_LABEL[icon]}</title>
      <GemGlyph icon={icon} />
    </svg>
  );
}

const COST_ORDER: (keyof CsResourceCost)[] = ['redGem', 'blueGem', 'purpleGem', 'anyGem', 'redOrb', 'blueOrb', 'purpleOrb', 'anyOrb', 'shadowFragment', 'cursedCrystal'];

function costIcons(cost: CsResourceCost | undefined): GemIcon[] {
  const out: GemIcon[] = [];
  if (!cost) return out;
  for (const k of COST_ORDER) for (let i = 0; i < (cost[k] ?? 0); i++) out.push(k as GemIcon);
  return out;
}

/** A row of gem icons for a cost ("free" when empty). */
export function CostRow({ cost, size = 16, free = 'free' }: { cost: CsResourceCost | undefined; size?: number; free?: string }) {
  const icons = costIcons(cost);
  if (icons.length === 0) return <span className="cs-cost cs-cost-free">{free}</span>;
  return (
    <span className="cs-cost">
      {icons.map((ic, i) => <GemIconSvg key={i} icon={ic} size={size} />)}
    </span>
  );
}

// ============================================================================
// Element emblems (on a 100×100 art canvas, centred at 50,52)
// ============================================================================

function FlameEmblem({ v }: { v: number }) {
  return (
    <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
      <path d={v ? 'M50 18 C66 34 74 46 70 62 C67 76 57 84 50 84 C40 84 30 76 30 62 C30 50 38 44 42 34 C46 42 48 46 52 46 C54 36 52 28 50 18 Z' : 'M50 16 C60 30 72 40 72 58 C72 74 62 84 50 84 C38 84 28 74 28 58 C28 46 36 40 40 30 C44 40 50 42 50 42 C50 34 48 26 50 16 Z'} fill="#ff7a45" />
      <path d="M50 44 C58 54 62 60 60 68 C58 76 54 80 50 80 C45 80 40 76 40 68 C40 62 44 58 46 52 C48 56 50 58 51 58 C52 54 51 50 50 44 Z" fill="#ffd27a" />
      <ellipse cx={50} cy={72} rx={4} ry={6} fill="#fff6d0" stroke="none" />
    </g>
  );
}

function TideEmblem({ v }: { v: number }) {
  return v ? (
    <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
      <path d="M50 16 C60 34 72 46 72 62 C72 76 62 86 50 86 C38 86 28 76 28 62 C28 46 40 34 50 16 Z" fill="#3fb2ff" />
      <path d="M36 62 C40 72 46 76 54 76" fill="none" stroke="#a8ecff" strokeWidth={3.2} strokeLinecap="round" />
      <ellipse cx={42} cy={48} rx={4} ry={7} fill="#e8fbff" fillOpacity={0.75} stroke="none" transform="rotate(25 42 48)" />
    </g>
  ) : (
    <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
      <path d="M18 66 C24 44 44 30 62 36 C74 40 80 52 74 60 C68 66 58 60 62 54 C50 54 44 66 50 78 C38 80 24 76 18 66 Z" fill="#3fb2ff" />
      <path d="M62 54 C66 50 72 52 72 56" fill="none" stroke="#a8ecff" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M14 78 Q24 72 34 78 T54 78 T74 78 T90 78" fill="none" stroke="#a8ecff" strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

function FrostEmblem({ v }: { v: number }) {
  const arms = Array.from({ length: 6 }, (_, i) => i * 60 + (v ? 30 : 0));
  return (
    <g stroke={INK} strokeLinecap="round">
      {arms.map((a) => (
        <g key={a} transform={`rotate(${a} 50 52)`}>
          <path d="M50 52 V20 M50 30 L42 22 M50 30 L58 22 M50 40 L44 34 M50 40 L56 34" stroke={INK} strokeWidth={6} fill="none" />
          <path d="M50 52 V20 M50 30 L42 22 M50 30 L58 22 M50 40 L44 34 M50 40 L56 34" stroke="#d9faff" strokeWidth={3} fill="none" />
        </g>
      ))}
      <polygon points="50,44 57,48 57,56 50,60 43,56 43,48" fill="#9feeff" strokeWidth={2} strokeLinejoin="round" />
    </g>
  );
}

function ShadowEmblem({ v }: { v: number }) {
  return (
    <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
      {v ? (
        <>
          <path d="M60 18 A34 34 0 1 0 60 86 A26 26 0 1 1 60 18 Z" fill="#2a1450" />
          <path d="M22 52 Q50 30 78 52 Q50 74 22 52 Z" fill="#e7c8ff" />
          <circle cx={50} cy={52} r={9} fill="#b06bff" />
          <ellipse cx={50} cy={52} rx={3} ry={8} fill={INK} stroke="none" />
        </>
      ) : (
        <>
          <path d="M50 14 C64 30 78 40 78 58 C78 74 66 86 50 86 C34 86 22 74 22 58 C22 40 36 30 50 14 Z" fill="#2a1450" />
          <path d="M34 54 Q50 44 66 54 Q50 64 34 54 Z" fill="#e7c8ff" />
          <circle cx={50} cy={54} r={5.5} fill="#b06bff" />
          <path d="M36 72 Q50 80 64 72" fill="none" stroke="#b06bff" strokeWidth={2.6} strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

function StoneEmblem({ v }: { v: number }) {
  return (
    <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
      <polygon points={v ? '26,84 34,46 46,40 50,84' : '22,84 30,52 40,48 46,84'} fill="#b07a3a" />
      <polygon points="40,84 46,28 56,18 64,30 62,84" fill="#e2a556" />
      <polygon points={v ? '58,84 64,44 74,50 78,84' : '56,84 66,40 76,52 80,84'} fill="#c58b45" />
      <polygon points="46,28 56,18 54,40" fill="#ffe1a6" strokeWidth={1.2} />
      <path d="M18 84 H82" strokeWidth={3} />
    </g>
  );
}

function ArcaneEmblem({ v }: { v: number }) {
  const n = v ? 8 : 6;
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 12 : 30;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(1)},${(52 + Math.sin(a) * r).toFixed(1)}`);
  }
  return (
    <g stroke={INK} strokeWidth={2.2} strokeLinejoin="round">
      <circle cx={50} cy={52} r={34} fill="none" stroke="#7cf5ff" strokeWidth={1.6} strokeDasharray="2 4" />
      <polygon points={pts.join(' ')} fill="#7cf5ff" />
      <circle cx={50} cy={52} r={7} fill="#e0fdff" />
    </g>
  );
}

function WardEmblem({ v }: { v: number }) {
  return (
    <g stroke={INK} strokeWidth={2.4} strokeLinejoin="round">
      <path d="M50 16 L76 26 C76 54 68 72 50 86 C32 72 24 54 24 26 Z" fill="#8fa2e8" />
      <path d="M50 24 L68 31 C68 52 62 66 50 77 C38 66 32 52 32 31 Z" fill="#c9d4ff" strokeWidth={1.4} />
      {v ? <path d="M50 34 V68 M38 46 H62" fill="none" strokeWidth={3.2} /> : <path d="M40 40 L50 64 L60 40" fill="none" strokeWidth={3.2} />}
    </g>
  );
}

/** Familiars as constellations: [x, y] stars and the lines between them. */
const CONSTELLATIONS: Record<string, { stars: [number, number][]; lines: [number, number][] }> = {
  stag: { stars: [[30, 70], [40, 58], [58, 58], [68, 70], [42, 44], [36, 30], [46, 26], [60, 44], [66, 30], [56, 26], [72, 46]], lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6], [2, 7], [7, 8], [8, 9], [7, 10]] },
  tortoise: { stars: [[26, 66], [34, 50], [50, 42], [66, 50], [74, 66], [50, 70], [82, 56], [30, 74], [70, 74]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [3, 6], [0, 7], [4, 8]] },
  raccoon: { stars: [[34, 34], [66, 34], [30, 52], [50, 62], [70, 52], [42, 48], [58, 48], [50, 76]], lines: [[0, 2], [2, 3], [3, 4], [4, 1], [0, 5], [1, 6], [5, 6], [3, 7]] },
  snake: { stars: [[24, 70], [36, 60], [48, 66], [60, 56], [56, 42], [44, 36], [52, 26], [66, 24]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7]] },
  octo: { stars: [[50, 30], [38, 44], [62, 44], [28, 70], [40, 74], [52, 76], [64, 74], [74, 68]], lines: [[0, 1], [0, 2], [1, 3], [1, 4], [1, 5], [2, 5], [2, 6], [2, 7]] },
  panda: { stars: [[36, 28], [64, 28], [32, 48], [50, 56], [68, 48], [40, 74], [60, 74]], lines: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [5, 6]] },
  raven: { stars: [[24, 46], [40, 40], [54, 44], [68, 34], [78, 30], [60, 54], [46, 62], [34, 58]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7], [7, 1]] },
  hedge: { stars: [[28, 66], [36, 48], [50, 38], [64, 44], [74, 60], [60, 70], [44, 72], [30, 40], [52, 26], [72, 38]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [1, 7], [2, 8], [3, 9]] },
  mouse: { stars: [[36, 34], [62, 34], [50, 50], [40, 64], [62, 64], [76, 72], [84, 60]], lines: [[0, 2], [1, 2], [2, 3], [2, 4], [3, 4], [4, 5], [5, 6]] },
  swamp: { stars: [[30, 74], [32, 50], [44, 32], [58, 32], [70, 50], [70, 74], [42, 46], [58, 46]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [6, 7]] },
  fish: { stars: [[22, 52], [38, 40], [60, 40], [74, 52], [60, 64], [38, 64], [84, 40], [84, 64]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [3, 6], [3, 7]] },
  crab: { stars: [[30, 58], [50, 48], [70, 58], [50, 66], [24, 40], [34, 32], [76, 40], [66, 32], [26, 74], [74, 74]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [0, 4], [4, 5], [2, 6], [6, 7], [0, 8], [2, 9]] },
  moth: { stars: [[50, 30], [50, 74], [26, 38], [30, 60], [74, 38], [70, 60], [40, 22], [60, 22]], lines: [[0, 1], [0, 2], [2, 3], [3, 1], [0, 4], [4, 5], [5, 1], [0, 6], [0, 7]] },
  dragon: { stars: [[20, 64], [34, 56], [48, 58], [62, 48], [76, 40], [84, 30], [56, 34], [44, 26], [70, 64]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [3, 6], [6, 7], [2, 8]] },
  lizard: { stars: [[20, 56], [36, 52], [52, 50], [68, 46], [80, 40], [42, 64], [58, 62], [44, 38], [60, 36]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [1, 5], [2, 6], [1, 7], [2, 8]] },
  shroom: { stars: [[26, 48], [38, 30], [62, 30], [74, 48], [50, 48], [44, 74], [56, 74]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [4, 6], [5, 6]] },
  shade: { stars: [[50, 26], [36, 40], [64, 40], [40, 64], [60, 64], [50, 78]], lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5]] },
};

function familiarOf(kind: string): string {
  const k = kind;
  if (k.includes('stag')) return 'stag';
  if (k.includes('tortoise')) return 'tortoise';
  if (k.includes('raccoon')) return 'raccoon';
  if (k.includes('snake')) return 'snake';
  if (k.includes('octo')) return 'octo';
  if (k.includes('panda')) return 'panda';
  if (k.includes('raven')) return 'raven';
  if (k.includes('hedge')) return 'hedge';
  if (k.includes('mouster') || k.includes('mouse')) return 'mouse';
  if (k.includes('swamp')) return 'swamp';
  if (k.includes('healer') || k.includes('hammerhead')) return 'fish';
  if (k.includes('crab')) return 'crab';
  if (k.includes('flutter')) return 'moth';
  if (k.includes('draco')) return 'dragon';
  if (k.includes('alchemist')) return 'lizard';
  if (k.includes('shroom')) return 'shroom';
  return 'shade';
}

function Constellation({ kind, colour }: { kind: string; colour: string }) {
  const c = CONSTELLATIONS[familiarOf(kind)]!;
  return (
    <g>
      {c.lines.map(([a, b], i) => (
        <line key={i} x1={c.stars[a]![0]} y1={c.stars[a]![1]} x2={c.stars[b]![0]} y2={c.stars[b]![1]} stroke={colour} strokeOpacity={0.75} strokeWidth={1.6} strokeLinecap="round" />
      ))}
      {c.stars.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={i % 3 === 0 ? 4.6 : 3.4} fill={colour} fillOpacity={0.25} />
          <circle cx={x} cy={y} r={i % 3 === 0 ? 2.4 : 1.7} fill="#fff" />
        </g>
      ))}
    </g>
  );
}

function Emblem({ element, kind, colour }: { element: CsElement; kind: string; colour?: string }) {
  const v = hashString(kind) % 2;
  switch (element) {
    case 'flame': return <FlameEmblem v={v} />;
    case 'tide': return <TideEmblem v={v} />;
    case 'frost': return <FrostEmblem v={v} />;
    case 'shadow': return <ShadowEmblem v={v} />;
    case 'stone': return <StoneEmblem v={v} />;
    case 'arcane': return <ArcaneEmblem v={v} />;
    case 'ward': return <WardEmblem v={v} />;
    case 'beast': return <Constellation kind={kind} colour={colour ?? ELEMENT.beast.main} />;
    case 'gem': return null;
  }
}

// ============================================================================
// Card art windows
// ============================================================================

/** The art inside a card's arched window: sky, star field, rune ring, emblem. */
export function CardArt({ card }: { card: CsCard }) {
  const id = useSvgIds();
  const el = elementOf(card);
  const pal = ELEMENT[el];
  const rnd = seededRandom(card.kind);
  const ticks = 8 + Math.floor(rnd() * 9);
  const spin = Math.floor(rnd() * 360);
  const stars = Array.from({ length: 9 }, () => [rnd() * 100, rnd() * 70, 0.5 + rnd() * 1.3] as const);
  const orbiters = card.type === 'attackSpell' ? card.level : card.type === 'conversionSpell' ? 1 : 0;
  // What the spell is (by name), drawn a little askew per kind so siblings never match.
  const motif = motifFor(card.kind);
  const flip = rnd() < 0.5 ? -1 : 1;
  const tilt = Math.round((rnd() - 0.5) * 22);
  const scale = 0.9 + rnd() * 0.14;
  const pose = `translate(50 52) rotate(${tilt}) scale(${(scale * flip).toFixed(3)} ${scale.toFixed(3)}) translate(-50 -52)`;
  return (
    <svg viewBox="0 0 100 100" className="cs-art" role="img" aria-label={card.name} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={id('sky')} cx="50%" cy="45%" r="70%">
          <stop offset="0" stopColor={pal.main} stopOpacity={0.55} />
          <stop offset="0.55" stopColor={pal.deep} />
          <stop offset="1" stopColor="#02050c" />
        </radialGradient>
      </defs>
      <rect width={100} height={100} fill={id.url('sky')} />
      {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" opacity={0.35 + (i % 3) * 0.2} />)}
      {/* rune ring: tick count and rotation come from the kind */}
      <g transform={`rotate(${spin} 50 52)`} stroke={pal.glow} strokeOpacity={0.55} fill="none">
        <circle cx={50} cy={52} r={40} strokeWidth={1} />
        <circle cx={50} cy={52} r={44} strokeWidth={0.6} strokeDasharray="1 3" />
        {Array.from({ length: ticks }, (_, i) => (
          <path key={i} d="M50 8 V14" transform={`rotate(${(360 / ticks) * i} 50 52)`} strokeWidth={1.4} />
        ))}
      </g>
      {card.type === 'resource' && card.grantsResource ? (
        <g transform="translate(14 16) scale(3)"><GemGlyph icon={card.grantsResource} /></g>
      ) : (
        <g transform={pose}>
          {motif && card.type !== 'companion' ? motif(pal) : <Emblem element={el} kind={card.kind} />}
        </g>
      )}
      {Array.from({ length: orbiters }, (_, i) => {
        const a = ((spin + i * (360 / Math.max(orbiters, 1))) * Math.PI) / 180;
        return <circle key={i} cx={50 + Math.cos(a) * 40} cy={52 + Math.sin(a) * 40} r={3.4} fill={pal.glow} stroke={INK} strokeWidth={1.2} />;
      })}
    </svg>
  );
}

/** Face-down backs: the main deck (moon in a rune hex) or a hidden counterspell (ward seal). */
export function CardBackArt({ variant = 'main' }: { variant?: 'main' | 'ward' }) {
  const id = useSvgIds();
  const ward = variant === 'ward';
  const c = ward ? '#c9d4ff' : '#7cf5ff';
  return (
    <svg viewBox="0 0 100 160" className="cs-back" role="img" aria-label={ward ? 'Face-down Counterspell' : 'Face-down card'} preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={id('g')} cx="50%" cy="45%" r="70%">
          <stop offset="0" stopColor={ward ? '#28306a' : '#0f3346'} />
          <stop offset="1" stopColor="#040812" />
        </radialGradient>
      </defs>
      <rect width={100} height={160} fill={id.url('g')} />
      <rect x={6} y={6} width={88} height={148} rx={8} fill="none" stroke={c} strokeOpacity={0.5} strokeWidth={1.2} />
      <rect x={10} y={10} width={80} height={140} rx={6} fill="none" stroke={c} strokeOpacity={0.25} strokeWidth={0.8} strokeDasharray="2 3" />
      <g transform="translate(50 80)" fill="none" stroke={c}>
        <polygon points="0,-34 29.4,-17 29.4,17 0,34 -29.4,17 -29.4,-17" strokeWidth={1.6} />
        <polygon points="0,-34 29.4,17 -29.4,17" strokeOpacity={0.45} strokeWidth={1} />
        <polygon points="0,34 29.4,-17 -29.4,-17" strokeOpacity={0.45} strokeWidth={1} />
        <circle r={40} strokeOpacity={0.3} strokeWidth={0.8} />
      </g>
      {ward ? (
        <g transform="translate(25 54) scale(0.5)"><WardEmblem v={0} /></g>
      ) : (
        <path d="M58 64 A18 18 0 1 0 58 96 A13 13 0 1 1 58 64 Z" fill="#e0fdff" stroke={INK} strokeWidth={1.4} />
      )}
      {[[20, 26], [80, 30], [24, 134], [78, 130], [50, 20], [50, 140]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={1.4} fill={c} opacity={0.8} />)}
    </svg>
  );
}

// ============================================================================
// Casters — moonlit silhouettes, light and shadow
// ============================================================================

interface CasterLook {
  element: CsElement;
  eyes: string;
  /** What breaks the hood's outline: the hint of who's under it. */
  crest: 'ears' | 'frill' | 'spines' | 'horns' | 'tufts' | 'peaks' | 'shell' | 'wings';
  staff: 'crook' | 'orb' | 'thorn' | 'fork' | 'feather' | 'shard' | 'hammer' | 'flame';
}

const CASTER: Record<string, CasterLook> = {
  kit: { element: 'arcane', eyes: '#7cf5ff', crest: 'ears', staff: 'crook' },
  frill: { element: 'tide', eyes: '#7ff0c8', crest: 'frill', staff: 'orb' },
  nuzzle: { element: 'beast', eyes: '#c6ff6b', crest: 'spines', staff: 'thorn' },
  haze: { element: 'flame', eyes: '#ffd27a', crest: 'horns', staff: 'fork' },
  talon: { element: 'arcane', eyes: '#fff3a8', crest: 'tufts', staff: 'feather' },
  frost: { element: 'frost', eyes: '#d9faff', crest: 'peaks', staff: 'shard' },
  dread: { element: 'stone', eyes: '#ffcf7a', crest: 'shell', staff: 'hammer' },
  ashe: { element: 'flame', eyes: '#ffb36b', crest: 'wings', staff: 'flame' },
};

function casterLook(characterId: string): CasterLook {
  return CASTER[characterId] ?? CASTER.kit!;
}

function Crest({ crest, fill }: { crest: CasterLook['crest']; fill: string }) {
  switch (crest) {
    case 'ears': return <path d="M36 30 L33 12 L45 24 Z M64 30 L67 12 L55 24 Z" fill={fill} />;
    case 'frill': return <path d="M28 36 Q22 26 30 20 Q34 28 38 26 Q40 16 50 14 Q60 16 62 26 Q66 28 70 20 Q78 26 72 36 Z" fill={fill} />;
    case 'spines': return <path d="M30 34 L26 22 L36 28 L38 14 L46 24 L52 12 L56 24 L64 14 L64 28 L74 22 L70 34 Z" fill={fill} />;
    case 'horns': return <path d="M38 26 Q30 14 34 6 Q38 16 44 20 Z M62 26 Q70 14 66 6 Q62 16 56 20 Z" fill={fill} />;
    case 'tufts': return <path d="M38 24 L30 8 L44 20 Z M62 24 L70 8 L56 20 Z M48 18 L50 8 L52 18 Z" fill={fill} />;
    case 'peaks': return <path d="M34 30 L36 12 L42 22 L50 10 L58 22 L64 12 L66 30 Z" fill={fill} />;
    case 'shell': return <path d="M22 54 Q22 24 50 22 Q78 24 78 54 Q64 46 50 46 Q36 46 22 54 Z" fill={fill} />;
    case 'wings': return <path d="M30 56 Q10 40 14 18 Q24 30 34 34 Z M70 56 Q90 40 86 18 Q76 30 66 34 Z" fill={fill} />;
  }
}

function Staff({ staff, c, glow }: { staff: CasterLook['staff']; c: string; glow: string }) {
  const shaft = <path d="M78 96 L74 40" stroke={c} strokeWidth={3.4} strokeLinecap="round" />;
  const tops: Record<CasterLook['staff'], ReactNode> = {
    crook: <path d="M74 40 Q72 28 80 28 Q88 30 84 38" fill="none" stroke={c} strokeWidth={3.4} strokeLinecap="round" />,
    orb: <circle cx={74} cy={36} r={6} fill={glow} stroke={INK} strokeWidth={1.4} />,
    thorn: <path d="M74 40 L70 30 L74 33 L76 24 L78 34 L82 30 Z" fill={c} />,
    fork: <path d="M74 42 L68 28 M74 42 L74 26 M74 42 L80 28" stroke={c} strokeWidth={2.6} strokeLinecap="round" fill="none" />,
    feather: <path d="M74 42 Q64 30 76 18 Q82 30 74 42 Z" fill={glow} stroke={INK} strokeWidth={1.2} />,
    shard: <polygon points="74,22 79,34 74,44 69,34" fill={glow} stroke={INK} strokeWidth={1.2} />,
    hammer: <rect x={66} y={30} width={16} height={9} rx={2} fill={c} stroke={INK} strokeWidth={1.2} />,
    flame: <path d="M74 42 Q66 34 72 26 Q74 32 76 30 Q78 22 74 16 Q86 26 80 38 Q78 42 74 42 Z" fill={glow} stroke={INK} strokeWidth={1.2} />,
  };
  return <g>{shaft}{tops[staff]}</g>;
}

/**
 * A caster on a 100×100 canvas: a hooded silhouette against the moon, eyes and
 * staff lit by their element. `shadow` inverts it — eclipse sky, violet-black
 * cloak, ember eyes.
 */
export function CasterArt({ characterId, form = 'light', framed = true }: { characterId: string; form?: CsForm; framed?: boolean }) {
  const id = useSvgIds();
  const look = casterLook(characterId);
  const pal = ELEMENT[look.element];
  const dark = form === 'shadow';
  // A bright, element-tinted sky behind a black hood: the crest silhouette is what reads small.
  const sky = dark ? ['#6a1a4a', '#14051f'] : [pal.main, pal.deep];
  const moon = dark ? '#ff5a3c' : pal.glow;
  const cloak = dark ? '#1a0b2c' : '#04070f';
  const rim = dark ? '#b06bff' : pal.main;
  const eyes = dark ? '#ff6a2a' : look.eyes;
  return (
    <svg viewBox="0 0 100 100" className="cs-caster" role="img" aria-label={`${characterId} (${form})`}>
      <defs>
        <radialGradient id={id('sky')} cx="50%" cy="38%" r="75%">
          <stop offset="0" stopColor={sky[0]} stopOpacity={dark ? 1 : 0.9} />
          <stop offset="0.7" stopColor={sky[1]} />
          <stop offset="1" stopColor="#02040a" />
        </radialGradient>
        <radialGradient id={id('moon')} cx="40%" cy="35%" r="65%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor={moon} />
        </radialGradient>
      </defs>
      {framed && <rect width={100} height={100} fill={id.url('sky')} />}
      {/* the moon behind the hood (an eclipse ring in shadow form) */}
      {dark ? (
        <g>
          <circle cx={50} cy={40} r={30} fill="none" stroke={moon} strokeWidth={3} strokeOpacity={0.85} />
          <circle cx={50} cy={40} r={34} fill="none" stroke={moon} strokeWidth={1} strokeOpacity={0.4} />
        </g>
      ) : (
        <circle cx={50} cy={40} r={30} fill={id.url('moon')} opacity={0.9} />
      )}
      {/* cloak, crest, hood */}
      <path d="M18 100 Q22 66 36 54 L64 54 Q78 66 82 100 Z" fill={cloak} stroke={rim} strokeWidth={1.4} strokeOpacity={0.8} />
      <Crest crest={look.crest} fill={cloak} />
      <path d="M30 56 Q28 26 50 22 Q72 26 70 56 Q60 50 50 50 Q40 50 30 56 Z" fill={cloak} stroke={rim} strokeWidth={1.4} strokeOpacity={0.9} />
      <ellipse cx={50} cy={42} rx={13} ry={11} fill={dark ? '#0b0414' : '#000'} />
      {/* glowing eyes */}
      <g fill={eyes}>
        <ellipse cx={44.5} cy={42} rx={3.6} ry={dark ? 1.8 : 2.8} />
        <ellipse cx={55.5} cy={42} rx={3.6} ry={dark ? 1.8 : 2.8} />
      </g>
      <circle cx={44.5} cy={42} r={6} fill={eyes} opacity={0.18} />
      <circle cx={55.5} cy={42} r={6} fill={eyes} opacity={0.18} />
      <Staff staff={look.staff} c={dark ? '#3a1e5a' : '#2a3240'} glow={dark ? '#ff8a4a' : pal.glow} />
      {/* elemental sigil on the chest */}
      <g transform="translate(40 66) scale(0.2)">
        <Emblem element={look.element === 'beast' ? 'stone' : look.element} kind={characterId} />
      </g>
      {dark && <path d="M24 100 L30 84 L26 74 M76 100 L70 86 L76 76" stroke="#b06bff" strokeWidth={1.2} fill="none" strokeOpacity={0.7} />}
    </svg>
  );
}

// ============================================================================
// Hex terrain (drawn inside a hex of radius ~46 centred on 0,0)
// ============================================================================

export const TERRAIN: Record<CsHexId, { top: string; bottom: string; glow: string }> = {
  'ancient-rune': { top: '#163a52', bottom: '#061520', glow: '#7cf5ff' },
  'dusty-desert': { top: '#6a4a22', bottom: '#2a1a0a', glow: '#ffd27a' },
  'underground-volcano': { top: '#5a1418', bottom: '#1c0508', glow: '#ff5a3c' },
  'amber-mountain': { top: '#6a3f12', bottom: '#241206', glow: '#ffb347' },
  'floating-lake': { top: '#0f4a3e', bottom: '#041a16', glow: '#5ff0c8' },
  'mushroom-cave': { top: '#3a1c5a', bottom: '#12071e', glow: '#e08bff' },
  'dark-forest': { top: '#2a1a5a', bottom: '#0a0620', glow: '#c48bff' },
  'mushroom-bog': { top: '#1f4a3a', bottom: '#081a12', glow: '#9fffc0' },
  'desolate-glacier': { top: '#3a5a7a', bottom: '#0e1a2a', glow: '#d9f4ff' },
  'floating-temple': { top: '#2a4a7a', bottom: '#0a1430', glow: '#c9e8ff' },
  'sacred-falls': { top: '#1a4a6a', bottom: '#061a28', glow: '#8fe0ff' },
  'cobble-cove': { top: '#2a4a52', bottom: '#0a1a1e', glow: '#9fe8d8' },
  'fiery-meadows': { top: '#4a1a0a', bottom: '#160604', glow: '#ff8a3c' },
};

export function TerrainArt({ hexId }: { hexId: CsHexId }) {
  const g = TERRAIN[hexId].glow;
  const k = { stroke: INK, strokeWidth: 1.6, strokeLinejoin: 'round' as const };
  switch (hexId) {
    case 'ancient-rune':
      return (
        <g fill="none" stroke={g}>
          <circle r={22} strokeWidth={1.6} />
          <circle r={16} strokeWidth={0.8} strokeDasharray="2 2" />
          <path d="M0 -14 L12 7 L-12 7 Z M0 14 L12 -7 L-12 -7 Z" strokeWidth={1.4} />
          <circle r={4} fill={g} />
        </g>
      );
    case 'dusty-desert':
      return (
        <g {...k}>
          <circle cx={12} cy={-14} r={7} fill="#ffd27a" />
          <path d="M-30 14 Q-14 0 2 12 Q16 2 30 12 L30 24 L-30 24 Z" fill="#c8913f" />
          <path d="M-30 20 Q-8 10 12 20 Q22 14 30 18 L30 26 L-30 26 Z" fill="#a8722c" />
        </g>
      );
    case 'underground-volcano':
      return (
        <g {...k}>
          <path d="M-28 22 L-8 -12 L8 -12 L28 22 Z" fill="#3a1414" />
          <path d="M-8 -12 Q0 -6 8 -12 L6 -2 Q2 4 4 14 L-4 14 Q-2 4 -6 -2 Z" fill="#ff5a3c" strokeWidth={1.2} />
          <path d="M-4 -16 Q-8 -26 0 -30 Q2 -22 6 -24 Q4 -18 4 -16" fill="#ffb347" strokeWidth={1.2} />
        </g>
      );
    case 'amber-mountain':
      return (
        <g {...k}>
          <path d="M-30 22 L-12 -10 L-2 4 L10 -22 L30 22 Z" fill="#8a5318" />
          <path d="M10 -22 L16 -8 L10 -10 L6 -4 L2 -6 Z M-12 -10 L-7 0 L-12 -2 L-16 2 Z" fill="#ffd27a" strokeWidth={1} />
        </g>
      );
    case 'floating-lake':
      return (
        <g {...k}>
          <path d="M-30 14 Q0 6 30 14 L30 24 L-30 24 Z" fill="#0f6a58" />
          <path d="M-18 14 V-10 M-12 14 V-16 M14 14 V-8 M20 14 V-14" stroke="#7ff0c8" strokeWidth={1.8} />
          <ellipse cx={-12} cy={-18} rx={2.4} ry={5} fill="#5a3a1a" />
          <ellipse cx={20} cy={-16} rx={2.4} ry={5} fill="#5a3a1a" />
          <path d="M-24 19 Q-14 16 -4 19 M6 20 Q16 17 26 20" stroke="#5ff0c8" strokeWidth={1} fill="none" />
        </g>
      );
    case 'mushroom-cave':
      return (
        <g {...k}>
          <path d="M-22 22 L-22 -4 Q-22 -20 0 -20 Q22 -20 22 -4 L22 22 Z" fill="#1a0e2e" />
          <path d="M-8 22 V6 M10 22 V12" stroke="#e8d8f0" strokeWidth={3} />
          <path d="M-18 8 Q-8 -12 2 8 Z" fill="#e08bff" />
          <path d="M3 13 Q10 0 17 13 Z" fill="#b05ad8" />
          <circle cx={-10} cy={1} r={1.6} fill="#fff0ff" strokeWidth={0.6} />
          <circle cx={-4} cy={4} r={1.2} fill="#fff0ff" strokeWidth={0.6} />
          <circle cx={10} cy={7} r={1.2} fill="#fff0ff" strokeWidth={0.6} />
        </g>
      );
    case 'desolate-glacier':
      return (
        <g {...k}>
          <path d="M-30 22 L-16 -6 L-6 6 L6 -18 L18 2 L30 22 Z" fill="#4a6a8a" />
          <path d="M6 -18 L12 -8 L8 -9 L4 -5 L1 -8 Z M-16 -6 L-12 0 L-15 -1 L-18 2 L-19 -1 Z" fill="#e8f8ff" strokeWidth={1} />
        </g>
      );
    case 'floating-temple':
      return (
        <g {...k}>
          <path d="M-24 4 L24 4 L12 18 L-12 18 Z" fill="#3a5a8a" />
          <path d="M-16 4 V-12 M-6 4 V-12 M6 4 V-12 M16 4 V-12" stroke="#c9e8ff" strokeWidth={2.4} />
          <path d="M-20 -12 L0 -24 L20 -12 Z" fill="#c9e8ff" />
          <path d="M-6 22 Q0 26 6 22" stroke="#c9e8ff" fill="none" strokeWidth={1} />
        </g>
      );
    case 'dark-forest':
      return (
        <g {...k}>
          <path d="M-20 20 L-12 -14 L-4 20 Z M-2 20 L6 -22 L14 20 Z M12 20 L20 -6 L26 20 Z" fill="#2a1a5a" />
          <Sparkle x={-12} y={-20} r={3} />
          <Sparkle x={18} y={-14} r={2.4} />
          <Sparkle x={0} y={4} r={2} />
        </g>
      );
    case 'cobble-cove':
      return (
        <g {...k}>
          <path d="M-30 16 Q-16 10 0 16 Q16 22 30 14 L30 24 L-30 24 Z" fill="#1f6a7a" />
          <ellipse cx={-12} cy={6} rx={10} ry={7} fill="#5a6a6e" />
          <ellipse cx={8} cy={2} rx={8} ry={6} fill="#76888c" />
          <ellipse cx={18} cy={10} rx={6} ry={4} fill="#4a5a5e" />
        </g>
      );
    case 'fiery-meadows':
      return (
        <g {...k}>
          <path d="M-26 20 L-18 -8 L18 -8 L26 20 Z" fill="#2a0e06" />
          <path d="M-14 -2 L-2 6 L-8 14 M6 -4 L2 8 L12 14" stroke="#ff8a3c" strokeWidth={2} fill="none" />
          <ellipse cx={0} cy={-8} rx={18} ry={4} fill="#ff8a3c" />
        </g>
      );
    case 'mushroom-bog':
      return (
        <g {...k}>
          <path d="M-30 14 Q0 8 30 14 L30 24 L-30 24 Z" fill="#1f5a44" />
          <path d="M-14 14 V2 M10 14 V-2" stroke="#e8e0c8" strokeWidth={3} />
          <path d="M-24 4 Q-14 -12 -4 4 Z" fill="#b04a6a" />
          <path d="M-2 0 Q10 -20 22 0 Z" fill="#c85a7a" />
          <circle cx={-16} cy={-2} r={1.6} fill="#ffe8f0" strokeWidth={0.6} />
          <circle cx={8} cy={-8} r={2} fill="#ffe8f0" strokeWidth={0.6} />
          <circle cx={15} cy={-5} r={1.4} fill="#ffe8f0" strokeWidth={0.6} />
        </g>
      );
    case 'sacred-falls':
      return (
        <g {...k}>
          <path d="M-26 -18 L-8 -18 L-8 16 L-26 16 Z M8 -18 L26 -18 L26 16 L8 16 Z" fill="#3a4a5a" />
          <path d="M-8 -18 L8 -18 L8 16 L-8 16 Z" fill="#8fe0ff" strokeWidth={1.2} />
          <path d="M-4 -14 V12 M2 -16 V10" stroke="#e8fbff" strokeWidth={1.2} fill="none" />
          <path d="M-30 16 Q0 26 30 16 L30 24 L-30 24 Z" fill="#2a7aa0" />
        </g>
      );
  }
}

/** Hex outline points for a pointy-top hex of radius r centred on 0,0. */
export function hexPoints(r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`;
  }).join(' ');
}

export function characterName(def: CsCharacterDef | undefined, form: CsForm): string {
  if (!def) return '—';
  return form === 'shadow' ? def.shadowName : def.lightName;
}
