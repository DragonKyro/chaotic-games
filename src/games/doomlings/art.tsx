// Doomlings art — "cosmic petri dish". Original inline SVG.
//
//   OrganelleArt   every trait's specimen: a living cell drawn from its kind
//                  hash, dressed by colour (red spikes, blue cilia, green
//                  chloroplasts, purple psionic rings, colorless crystal).
//   Species        each player's creature, assembled from their Trait Pile:
//                  it grows, sprouts spikes / fins / fronds / armour / an
//                  aura as traits land, and gets a crown for Dominants.
//   AgeArt         landscapes for Ages, apocalypses for Catastrophes.
//   TraitBack, GenePool helix pips, marker glyphs, ClassIcon (Castle Glass's
//   Shell / Coral / Fish — a class card's specimen grows that motif too).
//
// No SVG filters anywhere (they're costly per card); depth comes from
// gradients with ids from useSvgIds, so a hand of the same card never
// shares a gradient.

import { hashString, seededRandom } from '@/core/rng';
import type { ReactNode } from 'react';
import { useSvgIds } from '@/ui/kit/hooks';
import type { DmAgeCard, DmClass, DmClassTier, DmSubspecies, DmTraitCard, DmTraitColor } from './types';
import { HUE, blobPath, wavyPath } from './shapes';

const INK = '#03100b';

export interface TraitLook {
  kind: string;
  color: DmTraitColor;
  secondaryColor?: DmTraitColor;
  isAllColors?: boolean;
  dominant?: boolean;
  cls?: DmClass;
  tier?: DmClassTier;
  sub?: DmSubspecies[];
}

/** Castle Glass class colours: sand shells, coral reefs, tropical fish. */
export const CLASS_HUE: Record<DmClass, { fill: string; light: string }> = {
  shell: { fill: '#f2c38b', light: '#fff1d6' },
  coral: { fill: '#ff7a6b', light: '#ffd0c6' },
  fish: { fill: '#4fd8e8', light: '#d4fbff' },
};

export const CLASS_WORD: Record<DmClass, string> = { shell: 'Shell', coral: 'Coral', fish: 'Fish' };
export const TIER_WORD: Record<DmClassTier, string> = { basic: '', curious: 'Curious', exotic: 'Exotic' };

const RAINBOW: DmTraitColor[] = ['red', 'blue', 'green', 'purple'];

/** The colours a trait shows, in order (Motley shows all four). */
export function traitColors(c: TraitLook): DmTraitColor[] {
  if (c.isAllColors) return RAINBOW;
  return c.secondaryColor && c.secondaryColor !== c.color ? [c.color, c.secondaryColor] : [c.color];
}

/** CSS background for a trait's membrane (card border). */
export function membraneCss(c: TraitLook): string {
  const cols = traitColors(c).map((k) => HUE[k].core);
  if (cols.length === 1) return `linear-gradient(140deg, ${HUE[c.color].glow}, ${cols[0]} 45%, ${HUE[c.color].deep})`;
  if (c.isAllColors) return `conic-gradient(from 210deg, ${cols.join(', ')}, ${cols[0]})`;
  return `linear-gradient(135deg, ${cols[0]} 0 48%, ${cols[1]} 52% 100%)`;
}

const f = (n: number) => n.toFixed(1);

// ============================================================================
// Trait specimens
// ============================================================================

export function OrganelleArt({ look, label }: { look: TraitLook; label?: string }) {
  const id = useSvgIds();
  const rand = seededRandom(hashString(look.kind));
  // Body plan first, so it's the most stable choice per kind.
  const plan = Math.floor(rand() * 5) as 0 | 1 | 2 | 3 | 4; // coccus, rod, amoeba, diatom, colony
  const cols = traitColors(look);
  const h = HUE[look.color];
  const h2 = HUE[cols[1] ?? look.color];
  const last = HUE[cols[cols.length - 1]!];
  const r = (plan === 4 ? 33 : 30) + rand() * 5;
  const cx = 50 + (rand() - 0.5) * 4;
  const cy = 52 + (rand() - 0.5) * 4;
  const rot = rand() * 180;
  const spikeN = 7 + Math.floor(rand() * 5);
  const spikeLen = 6 + rand() * 7;
  const tail = plan !== 4 && rand() < 0.5;
  const tailAngle = Math.PI * (0.1 + rand() * 0.8);
  const eye = rand() < 0.38;
  const twoNuclei = rand() < 0.25;
  const nucR = 7 + rand() * 4;
  const agar = Array.from({ length: 8 }, () => [rand() * 100, rand() * 100, 0.6 + rand() * 1.8] as const);
  const rings = rand() < 0.5;

  // ---- the membrane ----------------------------------------------------------
  let membrane: string;
  let bodyEls: { d: string; scale: number }[] = [];
  if (plan === 1) {
    // rod: a rounded capsule, rotated
    const L = r * 1.75;
    const T = r * 1.08;
    const a = (rot * Math.PI) / 180;
    const ux = Math.cos(a);
    const uy = Math.sin(a);
    const px = -uy;
    const py = ux;
    const e1 = [cx - ux * (L / 2 - T / 2), cy - uy * (L / 2 - T / 2)];
    const e2 = [cx + ux * (L / 2 - T / 2), cy + uy * (L / 2 - T / 2)];
    const hT = T / 2;
    membrane = `M${f(e1[0]! + px * hT)} ${f(e1[1]! + py * hT)} L${f(e2[0]! + px * hT)} ${f(e2[1]! + py * hT)} A${f(hT)} ${f(hT)} 0 0 0 ${f(e2[0]! - px * hT)} ${f(e2[1]! - py * hT)} L${f(e1[0]! - px * hT)} ${f(e1[1]! - py * hT)} A${f(hT)} ${f(hT)} 0 0 0 ${f(e1[0]! + px * hT)} ${f(e1[1]! + py * hT)} Z`;
  } else if (plan === 2) {
    membrane = blobPath(cx, cy, r, 13, 0.27, rand);
  } else if (plan === 3) {
    // diatom: a symmetric glassy shell
    const n = 12 + 2 * Math.floor(rand() * 3);
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const rr = i % 2 ? r * 0.84 : r;
      return `${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
    });
    membrane = `M${pts.join(' L')} Z`;
  } else if (plan === 4) {
    // colony: three cells stuck together
    const sub = r * 0.56;
    bodyEls = [0, 1, 2].map((i) => {
      const a = (rot * Math.PI) / 180 + (i / 3) * Math.PI * 2;
      return { d: blobPath(cx + Math.cos(a) * sub * 0.78, cy + Math.sin(a) * sub * 0.78, sub, 9, 0.1, rand), scale: 1 };
    });
    membrane = bodyEls[0]!.d;
  } else {
    membrane = blobPath(cx, cy, r, 9 + Math.floor(rand() * 4), 0.06 + rand() * 0.1, rand);
  }

  const ringed = plan === 0 || plan === 2 || plan === 3; // appendages sit on a circle
  const ring = (k: number, d = r) => cx + Math.cos(k) * d;
  const ringY = (k: number, d = r) => cy + Math.sin(k) * d;
  const innerR = plan === 1 ? r * 0.42 : plan === 4 ? r * 0.62 : r * 0.62;
  const inner = Array.from({ length: 2 + Math.floor(rand() * 3) }, (_, i) => ({
    a: rand() * Math.PI * 2,
    d: innerR * (0.45 + rand() * 0.55),
    rot: rand() * 180,
    type: Math.floor(rand() * 3),
    col: HUE[cols[i % cols.length]!],
  }));
  const nx = cx + (plan === 4 ? 0 : (rand() - 0.5) * r * 0.3);
  const ny = cy + (plan === 4 ? 0 : (rand() - 0.5) * r * 0.3);

  return (
    <svg viewBox="0 0 100 100" className="dm-organelle" role="img" aria-label={label}>
      <defs>
        <radialGradient id={id('bg')} cx="50%" cy="48%" r="62%">
          <stop offset="0" stopColor={h.deep} />
          <stop offset="0.78" stopColor="#04110d" />
          <stop offset="1" stopColor="#020807" />
        </radialGradient>
        <radialGradient id={id('cell')} cx="36%" cy="32%" r="72%">
          <stop offset="0" stopColor={h.glow} stopOpacity={0.95} />
          <stop offset="0.42" stopColor={h.core} stopOpacity={0.85} />
          <stop offset="1" stopColor={h2.deep} stopOpacity={0.96} />
        </radialGradient>
      </defs>
      <rect width={100} height={100} fill={id.url('bg')} />
      {rings
        ? [38, 46].map((rr) => <circle key={rr} cx={50} cy={50} r={rr} fill="none" stroke={h.glow} strokeOpacity={0.1} strokeWidth={1} />)
        : agar.map(([x, y, rr], i) => <circle key={i} cx={f(x)} cy={f(y)} r={f(rr)} fill={h.glow} opacity={0.13} />)}
      <circle cx={f(cx)} cy={f(cy)} r={f(r + 10)} fill={h.core} opacity={0.11} />

      {/* outside the membrane: the colour's signature */}
      {look.color === 'red' && ringed && Array.from({ length: spikeN }, (_, i) => {
        const a = (i / spikeN) * Math.PI * 2 + rand() * 0.25;
        const b = 0.15;
        const base = plan === 3 ? r * 0.92 : r * 0.96;
        const tip = r + spikeLen * (0.7 + rand() * 0.5);
        return (
          <path
            key={`s${i}`}
            d={`M${f(ring(a - b, base))} ${f(ringY(a - b, base))} L${f(ring(a, tip))} ${f(ringY(a, tip))} L${f(ring(a + b, base))} ${f(ringY(a + b, base))} Z`}
            fill={h.core}
            stroke={h.deep}
            strokeWidth={1.2}
            strokeLinejoin="round"
          />
        );
      })}
      {look.color === 'red' && !ringed && [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        return <path key={`h${i}`} d={`M${f(ring(a, r * 0.7))} ${f(ringY(a, r * 0.7))} L${f(ring(a, r * 1.2))} ${f(ringY(a, r * 1.2))}`} stroke={h.core} strokeWidth={3.2} strokeLinecap="round" />;
      })}
      {look.color === 'blue' && ringed && (
        <g stroke={h.glow} strokeWidth={1.3} strokeLinecap="round" opacity={0.85}>
          {Array.from({ length: 22 }, (_, i) => {
            const a = (i / 22) * Math.PI * 2;
            const l = 4 + (i % 3) * 1.8;
            return <path key={`c${i}`} d={`M${f(ring(a))} ${f(ringY(a))} l${f(Math.cos(a + 0.4) * l)} ${f(Math.sin(a + 0.4) * l)}`} />;
          })}
        </g>
      )}
      {look.color === 'blue' && [0, 1, 2].map((i) => (
        <circle key={`b${i}`} cx={f(12 + rand() * 76)} cy={f(8 + rand() * 20)} r={f(1.5 + rand() * 2.4)} fill="none" stroke={h.glow} strokeWidth={1} opacity={0.6} />
      ))}
      {look.color === 'purple' && (
        <g fill="none" stroke={h.glow} strokeWidth={1.2} opacity={0.55}>
          <circle cx={f(cx)} cy={f(cy)} r={f(r + 7)} strokeDasharray="3 4" />
          <circle cx={f(cx)} cy={f(cy)} r={f(r + 13)} strokeDasharray="1.5 5" />
        </g>
      )}
      {look.color === 'purple' && [0, 1, 2, 3].map((i) => {
        const x = 10 + rand() * 80;
        const y = 8 + rand() * 84;
        const s = 2 + rand() * 1.6;
        return <path key={`p${i}`} d={`M${f(x)} ${f(y - s)} L${f(x + s * 0.3)} ${f(y - s * 0.3)} L${f(x + s)} ${f(y)} L${f(x + s * 0.3)} ${f(y + s * 0.3)} L${f(x)} ${f(y + s)} L${f(x - s * 0.3)} ${f(y + s * 0.3)} L${f(x - s)} ${f(y)} L${f(x - s * 0.3)} ${f(y - s * 0.3)} Z`} fill={h.glow} opacity={0.85} />;
      })}
      {look.color === 'green' && [0, 1].map((i) => {
        const a = -Math.PI / 2 + (i ? 0.75 : -0.75) + (rand() - 0.5) * 0.3;
        const bx = ring(a, r * 0.9);
        const by = ringY(a, r * 0.9);
        const tx = ring(a, r + 16);
        const ty = ringY(a, r + 16);
        return (
          <g key={`l${i}`}>
            <path d={`M${f(bx)} ${f(by)} Q${f((bx + tx) / 2 + 6)} ${f((by + ty) / 2)} ${f(tx)} ${f(ty)} Q${f((bx + tx) / 2 - 6)} ${f((by + ty) / 2)} ${f(bx)} ${f(by)} Z`} fill={h.core} stroke={h.deep} strokeWidth={1.1} />
            <path d={`M${f(bx)} ${f(by)} L${f(tx)} ${f(ty)}`} stroke={h.deep} strokeWidth={0.9} />
          </g>
        );
      })}
      {tail && !look.cls && (
        <path d={wavyPath(ring(tailAngle, r * 0.92), ringY(tailAngle, r * 0.92), tailAngle, 16 + rand() * 10, 3.2, 2)} fill="none" stroke={h.glow} strokeWidth={1.9} strokeLinecap="round" />
      )}
      {look.cls && <ClassMotif cls={look.cls} cx={cx} cy={cy} r={r} side={rot > 90 ? 1 : -1} />}
      {look.sub?.includes('deepling') && (
        // Imaginary Ends Deeplings: ink tendrils reaching up from the dark below.
        <g fill="none" stroke="#120a2a" strokeLinecap="round">
          {[-1, 0, 1].map((k) => <path key={`dp${k}`} d={wavyPath(cx + k * r * 0.5, 100, -Math.PI / 2 + k * 0.25, 22, 3, 2)} strokeWidth={5} opacity={0.85} />)}
        </g>
      )}

      {/* the cell */}
      {plan === 4 ? (
        bodyEls.map((b, i) => <path key={i} d={b.d} fill={id.url('cell')} stroke={h.glow} strokeWidth={2} />)
      ) : (
        <path d={membrane} fill={id.url('cell')} stroke={h.glow} strokeWidth={2.2} strokeLinejoin="round" />
      )}
      {plan === 3 && Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return <path key={`st${i}`} d={`M${f(ring(a, r * 0.32))} ${f(ringY(a, r * 0.32))} L${f(ring(a, r * 0.78))} ${f(ringY(a, r * 0.78))}`} stroke={h.glow} strokeWidth={0.8} opacity={0.6} />;
      })}

      {inner.map((o, i) => {
        const x = cx + Math.cos(o.a) * o.d;
        const y = cy + Math.sin(o.a) * o.d;
        if (o.type === 0) {
          return (
            <g key={`o${i}`} transform={`rotate(${f(o.rot)} ${f(x)} ${f(y)})`}>
              <rect x={f(x - 6.5)} y={f(y - 3.2)} width={13} height={6.4} rx={3.2} fill={o.col.deep} stroke={o.col.glow} strokeWidth={1} />
              <path d={`M${f(x - 4.6)} ${f(y)} l1.9 -1.9 l1.9 3.8 l1.9 -3.8 l1.9 3.8 l1.9 -1.9`} fill="none" stroke={o.col.glow} strokeWidth={0.8} />
            </g>
          );
        }
        if (o.type === 1) {
          return (
            <g key={`o${i}`}>
              <circle cx={f(x)} cy={f(y)} r={4} fill={o.col.core} opacity={0.6} stroke={o.col.glow} strokeWidth={0.9} />
              <circle cx={f(x - 1.2)} cy={f(y - 1.2)} r={1.1} fill="#fff" opacity={0.7} />
            </g>
          );
        }
        return (
          <g key={`o${i}`} fill={o.col.glow} opacity={0.85}>
            <circle cx={f(x)} cy={f(y)} r={1.1} />
            <circle cx={f(x + 2.5)} cy={f(y + 1)} r={1.1} />
            <circle cx={f(x + 0.8)} cy={f(y + 2.7)} r={1.1} />
          </g>
        );
      })}
      {look.color === 'green' && [0, 1, 2].map((i) => {
        const a = rand() * Math.PI * 2;
        const x = cx + Math.cos(a) * innerR * 0.7;
        const y = cy + Math.sin(a) * innerR * 0.7;
        return (
          <g key={`g${i}`} transform={`rotate(${f(rand() * 180)} ${f(x)} ${f(y)})`}>
            <ellipse cx={f(x)} cy={f(y)} rx={5.4} ry={2.9} fill="#1f9a4e" stroke={h.glow} strokeWidth={0.8} />
            <path d={`M${f(x - 3)} ${f(y)} h6 M${f(x - 2)} ${f(y - 1.3)} h4 M${f(x - 2)} ${f(y + 1.3)} h4`} stroke={h.glow} strokeWidth={0.6} />
          </g>
        );
      })}
      {look.color === 'colorless' && [0, 1, 2].map((i) => {
        const a = rand() * Math.PI * 2;
        const x = cx + Math.cos(a) * innerR * 0.6;
        const y = cy + Math.sin(a) * innerR * 0.6;
        const s = 4 + rand() * 3;
        const pts = Array.from({ length: 6 }, (_, k) => `${f(x + Math.cos((k / 6) * Math.PI * 2) * s)},${f(y + Math.sin((k / 6) * Math.PI * 2) * s)}`).join(' ');
        return <polygon key={`x${i}`} points={pts} fill="#ffffff" fillOpacity={0.2} stroke={h.glow} strokeWidth={1} />;
      })}

      {/* nucleus (or two) */}
      {(twoNuclei ? [-1, 1] : [0]).map((side) => {
        const x = nx + side * nucR * 1.1;
        const y = ny - side * nucR * 0.4;
        const nr = twoNuclei ? nucR * 0.75 : nucR;
        return (
          <g key={`n${side}`}>
            <ellipse cx={f(x)} cy={f(y)} rx={f(nr)} ry={f(nr * 0.86)} fill={h.deep} stroke={h.glow} strokeWidth={1.3} />
            <circle cx={f(x + nr * 0.25)} cy={f(y - nr * 0.15)} r={f(nr * 0.32)} fill={last.core} />
          </g>
        );
      })}
      {eye && !twoNuclei && (
        <g>
          <ellipse cx={f(nx)} cy={f(ny)} rx={f(nucR * 0.66)} ry={f(nucR * 0.52)} fill="#f8fff9" />
          <circle cx={f(nx + 1)} cy={f(ny + 0.5)} r={f(nucR * 0.3)} fill={INK} />
          <circle cx={f(nx + 1.8)} cy={f(ny - 0.6)} r={0.9} fill="#fff" />
        </g>
      )}
      {/* rim light */}
      <path d={`M${f(cx - r * 0.6)} ${f(cy - r * 0.32)} Q${f(cx - r * 0.45)} ${f(cy - r * 0.74)} ${f(cx + r * 0.05)} ${f(cy - r * 0.76)}`} fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" opacity={0.42} />
      {look.dominant && <Crown x={50} y={11} s={1} />}
      {look.tier === 'exotic' && <Sparkle x={84} y={18} s={1} />}
      {look.sub?.includes('glitterling') && [[16, 20, 0.8], [86, 30, 0.6], [22, 84, 0.55]].map(([x, y, k], i) => (
        <path key={`gl${i}`} transform={`translate(${x} ${y}) scale(${k})`} d="M0 -8 Q1.2 -1.2 8 0 Q1.2 1.2 0 8 Q-1.2 1.2 -8 0 Q-1.2 -1.2 0 -8 Z" fill="#ff9be1" stroke={INK} strokeWidth={1.2} />
      ))}
      {look.sub?.includes('moonling') && (
        <path d="M80 6 a10 10 0 1 0 10 16 a7.5 7.5 0 1 1 -10 -16 Z" fill="#f4f1d6" stroke={INK} strokeWidth={1.2} />
      )}
      {look.tier === 'curious' && [0, 1, 2].map((i) => <circle key={`cb${i}`} cx={14 + i * 5} cy={24 - i * 7} r={1.6 + i * 0.7} fill="none" stroke={CLASS_HUE[look.cls ?? 'fish'].light} strokeWidth={0.9} opacity={0.8} />)}
    </svg>
  );
}

/**
 * Castle Glass: the class grows on the specimen, drawn behind the cell — a
 * coiled shell, a coral branch rising from the agar, or a fish's tail and fin.
 */
function ClassMotif({ cls, cx, cy, r, side }: { cls: DmClass; cx: number; cy: number; r: number; side: 1 | -1 }) {
  const c = CLASS_HUE[cls];
  if (cls === 'shell') {
    // a conch coil tucked behind the lower side of the cell
    const x = cx + side * r * 0.78;
    const y = cy + r * 0.62;
    let coil = `M${f(x)} ${f(y)}`;
    for (let i = 1; i <= 18; i++) {
      const a = i * 0.62;
      const rr = 1 + i * 0.75;
      coil += ` L${f(x + Math.cos(a) * rr * side)} ${f(y + Math.sin(a) * rr)}`;
    }
    return (
      <g>
        <circle cx={f(x)} cy={f(y)} r={15} fill={c.fill} stroke={INK} strokeWidth={1.4} />
        <path d={coil} fill="none" stroke="#8a5a2b" strokeWidth={1.4} strokeLinecap="round" />
        <circle cx={f(x - side * 5)} cy={f(y - 6)} r={2} fill={c.light} opacity={0.8} />
      </g>
    );
  }
  if (cls === 'coral') {
    const bx = cx - side * r * 0.55;
    const branch = (x: number, y: number, a: number, len: number, depth: number): string => {
      const x2 = x + Math.cos(a) * len;
      const y2 = y + Math.sin(a) * len;
      let d = `M${f(x)} ${f(y)} L${f(x2)} ${f(y2)}`;
      if (depth > 0) d += branch(x2, y2, a - 0.5, len * 0.66, depth - 1) + branch(x2, y2, a + 0.45, len * 0.62, depth - 1);
      return d;
    };
    const d = branch(bx, 100, -Math.PI / 2 - side * 0.15, 20, 2);
    return (
      <g strokeLinecap="round" fill="none">
        <path d={d} stroke={INK} strokeWidth={6.2} />
        <path d={d} stroke={c.fill} strokeWidth={4} />
        <path d={d} stroke={c.light} strokeWidth={1} opacity={0.6} />
      </g>
    );
  }
  // fish: a forked tail on one side, a dorsal fin on top
  const tx = cx - side * r;
  const ty = cy + 2;
  return (
    <g fill={c.fill} stroke={INK} strokeWidth={1.4} strokeLinejoin="round">
      <path d={`M${f(tx + side * 4)} ${f(ty)} L${f(tx - side * 16)} ${f(ty - 13)} Q${f(tx - side * 9)} ${f(ty)} ${f(tx - side * 16)} ${f(ty + 13)} Z`} />
      <path d={`M${f(cx - side * r * 0.45)} ${f(cy - r * 0.86)} Q${f(cx + side * 2)} ${f(cy - r - 16)} ${f(cx + side * r * 0.5)} ${f(cy - r * 0.84)} Z`} />
    </g>
  );
}

function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -8 Q1.2 -1.2 8 0 Q1.2 1.2 0 8 Q-1.2 1.2 -8 0 Q-1.2 -1.2 0 -8 Z"
      fill="#ffd23f"
      stroke={INK}
      strokeWidth={1}
    />
  );
}

/** A Castle Glass class glyph (14×14): a scallop, a coral sprig or a fish. */
export function ClassIcon({ cls, size = 14 }: { cls: DmClass; size?: number }) {
  const c = CLASS_HUE[cls];
  let body: ReactNode;
  if (cls === 'shell') {
    body = (
      <g stroke={INK} strokeWidth={1} strokeLinejoin="round">
        <path d="M7 12.5 L1.6 5.6 Q7 -0.6 12.4 5.6 Z" fill={c.fill} />
        <path d="M7 12.5 L4.6 3 M7 12.5 L7 2 M7 12.5 L9.4 3" fill="none" strokeWidth={0.8} />
        <rect x={5.2} y={11.4} width={3.6} height={2} rx={0.6} fill={c.fill} />
      </g>
    );
  } else if (cls === 'coral') {
    body = (
      <g fill="none" strokeLinecap="round">
        <path d="M7 13 V7 M7 9 L3.5 5.5 V2.5 M7 7.5 L10.5 4 V1.5 M3.5 5.5 L1.8 4 M10.5 5 L12.4 4.4" stroke={INK} strokeWidth={3} />
        <path d="M7 13 V7 M7 9 L3.5 5.5 V2.5 M7 7.5 L10.5 4 V1.5 M3.5 5.5 L1.8 4 M10.5 5 L12.4 4.4" stroke={c.fill} strokeWidth={1.6} />
      </g>
    );
  } else {
    body = (
      <g stroke={INK} strokeWidth={1} strokeLinejoin="round">
        <path d="M9.6 7 L13.2 3.6 V10.4 Z" fill={c.fill} />
        <ellipse cx={6.2} cy={7} rx={5} ry={3.6} fill={c.fill} />
        <circle cx={3.8} cy={6.2} r={0.9} fill={INK} stroke="none" />
      </g>
    );
  }
  return (
    <svg viewBox="0 0 14 14" width={size} height={size} aria-hidden="true">
      {body}
    </svg>
  );
}

function Crown({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-10 4 L-11 -6 L-5 -1 L0 -9 L5 -1 L11 -6 L10 4 Z" fill="#ffd23f" stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx={0} cy={-9} r={1.6} fill="#ff4f6d" stroke={INK} strokeWidth={0.8} />
      <rect x={-10} y={3} width={20} height={3.4} rx={1.2} fill="#ffb800" stroke={INK} strokeWidth={1.2} />
    </g>
  );
}

// ============================================================================
// The card back: a glowing helix in a petri dish.
// ============================================================================

export function TraitBack() {
  const id = useSvgIds();
  const strand = (phase: number) => {
    let d = '';
    for (let i = 0; i <= 24; i++) {
      const y = 24 + i * 3.8;
      const x = 50 + Math.sin(i * 0.52 + phase) * 15;
      d += `${i ? ' L' : 'M'}${f(x)} ${f(y)}`;
    }
    return d;
  };
  return (
    <svg viewBox="0 0 100 140" className="dm-back" role="img" aria-label="Face-down trait" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={id('dish')} cx="50%" cy="50%" r="55%">
          <stop offset="0" stopColor="#123d2c" />
          <stop offset="0.7" stopColor="#061a14" />
          <stop offset="1" stopColor="#020807" />
        </radialGradient>
      </defs>
      <rect width={100} height={140} fill={id.url('dish')} />
      <circle cx={50} cy={70} r={40} fill="none" stroke="#8cff5a" strokeOpacity={0.25} strokeWidth={1.4} />
      <circle cx={50} cy={70} r={34} fill="none" stroke="#8cff5a" strokeOpacity={0.12} strokeWidth={6} />
      {Array.from({ length: 12 }, (_, i) => {
        const y = 28 + i * 7.6;
        const a = i * 1.0;
        const x1 = 50 + Math.sin(a) * 15;
        const x2 = 50 + Math.sin(a + Math.PI) * 15;
        return <path key={i} d={`M${f(x1)} ${f(y)} L${f(x2)} ${f(y)}`} stroke={i % 2 ? '#38a6ff' : '#ff4f6d'} strokeWidth={2} strokeLinecap="round" opacity={0.85} />;
      })}
      <path d={strand(0)} fill="none" stroke="#8cff5a" strokeWidth={3} strokeLinecap="round" />
      <path d={strand(Math.PI)} fill="none" stroke="#b56cff" strokeWidth={3} strokeLinecap="round" />
      {[[16, 16], [84, 124], [82, 20], [18, 120]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.2} fill="#8cff5a" opacity={0.5} />
      ))}
      <rect x={4} y={4} width={92} height={132} rx={9} fill="none" stroke="#8cff5a" strokeOpacity={0.35} strokeWidth={1.2} strokeDasharray="2 3" />
    </svg>
  );
}

// ============================================================================
// Species: the player's creature, built from their Trait Pile.
// ============================================================================

function speciesCounts(traits: readonly DmTraitCard[]) {
  const counts: Record<DmTraitColor, number> = { red: 0, blue: 0, green: 0, purple: 0, colorless: 0 };
  for (const t of traits) for (const c of traitColors(t)) counts[c] += 1;
  return {
    counts,
    total: traits.length,
    dominants: traits.filter((t) => t.dominant).length,
    // Play-When traits (out-of-turn tricks) orbit the creature as little moons.
    attachments: traits.filter((t) => t.playWhen).length,
    swarm: traits.some((t) => t.isSwarm),
    shells: traits.filter((t) => t.cls === 'shell').length,
    hidden: traits.reduce((n, t) => n + (t.under?.length ?? 0), 0),
    corals: traits.filter((t) => t.cls === 'coral').length,
    fish: traits.filter((t) => t.cls === 'fish').length,
  };
}

/**
 * The creature. Feature slots read from a fixed per-seat random table, so
 * adding a trait adds a feature without reshuffling the rest.
 */
export function Species({ traits, seedKey, tint, size = 120, label }: {
  traits: readonly DmTraitCard[];
  seedKey: string;
  /** Body colour before any trait has coloured it (the seat colour). */
  tint: string;
  size?: number;
  label?: string;
}) {
  const id = useSvgIds();
  const rand = seededRandom(hashString(seedKey));
  const R = Array.from({ length: 48 }, rand);
  const { counts, total, dominants, attachments, swarm, shells, corals, fish, hidden } = speciesCounts(traits);
  const ranked = (['red', 'blue', 'green', 'purple', 'colorless'] as DmTraitColor[])
    .filter((c) => counts[c] > 0)
    .sort((a, b) => counts[b] - counts[a]);
  const main = ranked[0] ? HUE[ranked[0]] : { core: tint, glow: '#ffffff', deep: '#0b1a14' };
  const second = ranked[1] ? HUE[ranked[1]] : main;
  const r = 30 + Math.min(total, 10) * 1.15;
  const cx = 60;
  const cy = 75;
  const body = blobPath(cx, cy, r, 11, 0.07 + R[0]! * 0.05, seededRandom(hashString(seedKey) ^ 0x9e3779b9), 0.9);
  const eyes = Math.min(4, 1 + Math.floor(total / 3));
  const spikes = Math.min(6, counts.red);
  const fins = Math.min(4, counts.blue);
  const fronds = Math.min(3, counts.green);
  const auras = Math.min(3, counts.purple);
  const plates = Math.min(4, counts.colorless);
  const top = (a: number, k = 1) => [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * 0.9 * k] as const;
  const toothy = counts.red >= 2;

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className="dm-species" role="img" aria-label={label ?? 'Species'}>
      <defs>
        <radialGradient id={id('body')} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor={main.glow} />
          <stop offset="0.4" stopColor={main.core} />
          <stop offset="1" stopColor={second.deep} />
        </radialGradient>
      </defs>
      {/* purple: a psionic aura */}
      {Array.from({ length: auras }, (_, i) => (
        <circle key={`a${i}`} cx={cx} cy={cy - 4} r={f(r + 8 + i * 6)} fill="none" stroke={HUE.purple.glow} strokeWidth={1.4} strokeDasharray={i % 2 ? '2 5' : '6 4'} opacity={0.55 - i * 0.12} />
      ))}
      {/* shadow */}
      <ellipse cx={cx} cy={cy + r * 0.86} rx={f(r * 0.9)} ry={4} fill="#000" opacity={0.35} />
      {/* blue: fins and tentacles */}
      {Array.from({ length: fins }, (_, i) => {
        const side = i % 2 ? 1 : -1;
        const a = Math.PI / 2 + side * (0.35 + Math.floor(i / 2) * 0.45);
        const [bx, by] = top(a, 0.95);
        return (
          <path key={`f${i}`} d={wavyPath(bx, by, a + side * 0.25, 16 + R[1 + i]! * 6, 3, 2)} fill="none" stroke={HUE.blue.core} strokeWidth={4.2} strokeLinecap="round" />
        );
      })}
      {/* stubby feet once it's grown at all */}
      {total > 0 && [-1, 1].map((side) => (
        <ellipse key={`ft${side}`} cx={f(cx + side * r * 0.45)} cy={f(cy + r * 0.82)} rx={7} ry={4.5} fill={main.deep} stroke={INK} strokeWidth={1.6} />
      ))}
      {/* red: spikes along the back */}
      {Array.from({ length: spikes }, (_, i) => {
        const a = -Math.PI / 2 + (i - (spikes - 1) / 2) * 0.42;
        const [x1, y1] = top(a - 0.13);
        const [x2, y2] = top(a + 0.13);
        const [tx, ty] = top(a, 1.38 + R[8 + i]! * 0.1);
        return <path key={`s${i}`} d={`M${f(x1)} ${f(y1)} L${f(tx)} ${f(ty)} L${f(x2)} ${f(y2)} Z`} fill={HUE.red.core} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />;
      })}
      {/* green: leafy antennae */}
      {Array.from({ length: fronds }, (_, i) => {
        const a = -Math.PI / 2 + (i - (fronds - 1) / 2) * 0.7 + 0.08;
        const [bx, by] = top(a, 0.96);
        const tx = bx + Math.cos(a) * 18;
        const ty = by + Math.sin(a) * 18 - 4;
        return (
          <g key={`g${i}`}>
            <path d={`M${f(bx)} ${f(by)} Q${f((bx + tx) / 2 + 4)} ${f((by + ty) / 2)} ${f(tx)} ${f(ty)}`} fill="none" stroke={HUE.green.deep} strokeWidth={2} />
            <path d={`M${f(tx)} ${f(ty)} q6 -6 0 -13 q-6 7 0 13 Z`} fill={HUE.green.core} stroke={INK} strokeWidth={1.3} />
          </g>
        );
      })}
      {/* Castle Glass fish: a forked tail */}
      {fish > 0 && (
        <path
          d={`M${f(cx + r * 0.85)} ${f(cy + 4)} L${f(cx + r + 17)} ${f(cy - 10 - Math.min(fish, 3) * 2)} Q${f(cx + r + 9)} ${f(cy + 4)} ${f(cx + r + 17)} ${f(cy + 18 + Math.min(fish, 3) * 2)} Z`}
          fill={CLASS_HUE.fish.fill}
          stroke={INK}
          strokeWidth={1.8}
          strokeLinejoin="round"
        />
      )}
      {/* Castle Glass coral: branching antlers */}
      {corals > 0 && [-1, 1].slice(0, corals > 1 ? 2 : 1).map((side) => {
        const bx = cx + side * r * 0.32;
        const by = cy - r * 0.82;
        const d = `M${f(bx)} ${f(by)} L${f(bx + side * 6)} ${f(by - 14)} M${f(bx + side * 3)} ${f(by - 7)} L${f(bx - side * 4)} ${f(by - 15)} M${f(bx + side * 6)} ${f(by - 14)} L${f(bx + side * 12)} ${f(by - 18)} M${f(bx + side * 6)} ${f(by - 14)} L${f(bx + side * 4)} ${f(by - 22)}`;
        return (
          <g key={`co${side}`} fill="none" strokeLinecap="round">
            <path d={d} stroke={INK} strokeWidth={5} />
            <path d={d} stroke={CLASS_HUE.coral.fill} strokeWidth={3} />
          </g>
        );
      })}
      {/* swarm: two little clones tagging along */}
      {swarm && [-1, 1].map((side) => (
        <g key={`w${side}`}>
          <circle cx={cx + side * (r + 14)} cy={cy + r * 0.6} r={7} fill={main.core} stroke={INK} strokeWidth={1.4} />
          <circle cx={cx + side * (r + 14) + 1.5} cy={cy + r * 0.6 - 1.5} r={1.6} fill={INK} />
        </g>
      ))}

      {/* the body */}
      <path d={body} fill={id.url('body')} stroke={INK} strokeWidth={2.6} />
      {/* belly */}
      <ellipse cx={cx} cy={f(cy + r * 0.32)} rx={f(r * 0.55)} ry={f(r * 0.36)} fill="#ffffff" opacity={0.16} />
      {/* colour spots, a few per colour it carries */}
      {ranked.slice(1).flatMap((c, ci) =>
        Array.from({ length: Math.min(3, counts[c]) }, (_, i) => {
          const a = R[16 + ci * 3 + i]! * Math.PI * 2;
          const d = r * (0.3 + R[30 + ci + i]! * 0.4);
          return <circle key={`p${c}${i}`} cx={f(cx + Math.cos(a) * d)} cy={f(cy + Math.sin(a) * d * 0.8 + 4)} r={f(2.6 + R[40 + i]! * 2)} fill={HUE[c].core} stroke={HUE[c].deep} strokeWidth={0.8} />;
        }),
      )}
      {/* colorless: armour plates */}
      {Array.from({ length: plates }, (_, i) => {
        const x = cx - r * 0.55 + i * (r * 0.38);
        const y = cy + r * 0.05 + (i % 2) * 5;
        return <path key={`ar${i}`} d={`M${f(x)} ${f(y - 6)} L${f(x + 6)} ${f(y - 3)} L${f(x + 6)} ${f(y + 4)} L${f(x)} ${f(y + 7)} L${f(x - 6)} ${f(y + 4)} L${f(x - 6)} ${f(y - 3)} Z`} fill={HUE.colorless.core} stroke={INK} strokeWidth={1.2} opacity={0.9} />;
      })}
      {/* eyes */}
      {Array.from({ length: eyes }, (_, i) => {
        const spread = eyes === 1 ? 0 : (i - (eyes - 1) / 2) * (r * 0.42);
        const x = cx + spread;
        const y = cy - r * 0.32 - (eyes > 2 && (i === 0 || i === eyes - 1) ? -3 : 0);
        const er = 5.4 - eyes * 0.35;
        const look = (R[44]! - 0.5) * 2;
        return (
          <g key={`e${i}`}>
            <circle cx={f(x)} cy={f(y)} r={f(er)} fill="#fbfff9" stroke={INK} strokeWidth={1.5} />
            <circle cx={f(x + look)} cy={f(y + 0.8)} r={f(er * 0.5)} fill={INK} />
            <circle cx={f(x + look + 0.9)} cy={f(y - 0.4)} r={0.9} fill="#fff" />
          </g>
        );
      })}
      {/* purple: a third eye on the brow */}
      {auras > 0 && (
        <g>
          <ellipse cx={cx} cy={f(cy - r * 0.62)} rx={4} ry={2.6} fill={HUE.purple.glow} stroke={INK} strokeWidth={1.2} />
          <circle cx={cx} cy={f(cy - r * 0.62)} r={1.3} fill={HUE.purple.deep} />
        </g>
      )}
      {/* mouth */}
      {total === 0 ? (
        <ellipse cx={cx} cy={f(cy + r * 0.08)} rx={2.4} ry={2} fill={INK} />
      ) : toothy ? (
        <g>
          <path d={`M${f(cx - 9)} ${f(cy + r * 0.05)} Q${cx} ${f(cy + r * 0.05 + 10)} ${f(cx + 9)} ${f(cy + r * 0.05)} Z`} fill={INK} />
          <path d={`M${f(cx - 7)} ${f(cy + r * 0.05 + 0.5)} l2.3 3.2 l2.3 -3.2 l2.3 3.2 l2.3 -3.2 l2.3 3.2 l1.6 -2.6`} fill="#fff" stroke="#fff" strokeWidth={0.5} />
        </g>
      ) : (
        <path d={`M${f(cx - 7)} ${f(cy + r * 0.06)} Q${cx} ${f(cy + r * 0.06 + 7)} ${f(cx + 7)} ${f(cy + r * 0.06)}`} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      )}
      {/* Imaginary Ends: suppressed cards lurk in a dark pool at its feet, eyes glinting */}
      {hidden > 0 && (
        <g>
          <ellipse cx={cx} cy={f(cy + r * 0.92)} rx={f(r * 0.75 + Math.min(hidden, 6) * 2.5)} ry={f(5 + Math.min(hidden, 6) * 0.7)} fill="#2a1650" stroke="#8b5cf6" strokeWidth={1.4} opacity={0.92} />
          {Array.from({ length: Math.min(hidden, 6) }, (_, i) => {
            const n = Math.min(hidden, 6);
            const x = cx + (n === 1 ? 0 : (i / (n - 1) - 0.5) * r * 1.3);
            return <circle key={`he${i}`} cx={f(x)} cy={f(cy + r * 0.92 + (i % 2 ? 1.6 : -1.2))} r={1.8} fill="#e6ccff" />;
          })}
        </g>
      )}
      {/* Castle Glass shells: a coiled shell riding on its back */}
      {shells > 0 && (
        <g>
          <circle cx={f(cx - r * 0.62)} cy={f(cy - r * 0.38)} r={f(8 + Math.min(shells, 4) * 1.6)} fill={CLASS_HUE.shell.fill} stroke={INK} strokeWidth={1.8} />
          <path
            d={`M${f(cx - r * 0.62)} ${f(cy - r * 0.38)} m-2 0 a2 2 0 1 1 4 0 a4 4 0 1 1 -8 0 a6 6 0 1 1 12 0`}
            fill="none"
            stroke="#8a5a2b"
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </g>
      )}
      {/* attachments: little moons in orbit */}
      {Array.from({ length: Math.min(attachments, 3) }, (_, i) => {
        const a = -0.4 - i * 0.9;
        return <circle key={`m${i}`} cx={f(cx + Math.cos(a) * (r + 14))} cy={f(cy + Math.sin(a) * (r + 12))} r={3.4} fill="#ffd23f" stroke={INK} strokeWidth={1.2} />;
      })}
      {dominants > 0 && <Crown x={cx} y={Math.round(cy - r * 0.9 - 9)} s={1.1} />}
      {dominants > 1 && <ellipse cx={cx} cy={f(cy - r * 0.9 - 22)} rx={13} ry={3.4} fill="none" stroke="#ffd23f" strokeWidth={2.4} />}
    </svg>
  );
}

// ============================================================================
// Gene Pool: a helix with one lit rung per card of hand size.
// ============================================================================

export function GenePool({ size, max = 8, title }: { size: number; max?: number; title?: string }) {
  const w = 10;
  const W = max * w;
  const strand = (phase: number) => {
    let d = '';
    for (let i = 0; i <= max * 4; i++) {
      const x = (i / 4) * w;
      const y = 9 + Math.sin((x / w) * Math.PI + phase) * 6;
      d += `${i ? ' L' : 'M'}${f(x)} ${f(y)}`;
    }
    return d;
  };
  return (
    <svg className="dm-genepool" viewBox={`-1 0 ${W + 2} 18`} width={W + 2} height={18} role="img" aria-label={title ?? `Gene Pool ${size}`}>
      <title>{title ?? `Gene Pool: stabilize to ${size} cards`}</title>
      <path d={strand(0)} fill="none" stroke="rgba(140, 255, 90, 0.35)" strokeWidth={1.4} />
      <path d={strand(Math.PI)} fill="none" stroke="rgba(181, 108, 255, 0.35)" strokeWidth={1.4} />
      {Array.from({ length: max }, (_, i) => {
        const x = i * w + w / 2;
        const y1 = 9 + Math.sin((x / w) * Math.PI) * 6;
        const y2 = 9 + Math.sin((x / w) * Math.PI + Math.PI) * 6;
        const lit = i < size;
        return (
          <g key={i} opacity={lit ? 1 : 0.28}>
            <path d={`M${f(x)} ${f(y1)} L${f(x)} ${f(y2)}`} stroke={lit ? '#eafff2' : '#9ccab5'} strokeWidth={lit ? 2.4 : 1.4} strokeLinecap="round" />
            <circle cx={f(x)} cy={f(y1)} r={lit ? 2.3 : 1.5} fill={lit ? '#8cff5a' : '#9ccab5'} />
            <circle cx={f(x)} cy={f(y2)} r={lit ? 2.3 : 1.5} fill={lit ? '#b56cff' : '#9ccab5'} />
          </g>
        );
      })}
    </svg>
  );
}

// ============================================================================
// Marker glyphs (14×14) for the card's corner.
// ============================================================================

export type Mark = 'dominant' | 'action' | 'drop' | 'worldsEnd' | 'playWhen' | 'shield' | 'swarm';

export const MARK_LABEL: Record<Mark, string> = {
  dominant: 'Dominant',
  action: 'Action when played',
  drop: 'Drop of Life bonus',
  worldsEnd: "World's End effect",
  playWhen: 'Play When — can be played out of turn',
  shield: 'Indestructible',
  swarm: 'Swarm',
};

export function MarkIcon({ mark }: { mark: Mark }) {
  let body: ReactNode;
  switch (mark) {
    case 'dominant':
      body = <path d="M2 11 L1.5 4 L4.5 6.5 L7 2 L9.5 6.5 L12.5 4 L12 11 Z" fill="#ffd23f" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />;
      break;
    case 'action':
      body = <path d="M8 1 L3 8 h3.4 L5.4 13 L11 5.6 h-3.6 Z" fill="#8cff5a" stroke={INK} strokeWidth={1} strokeLinejoin="round" />;
      break;
    case 'drop':
      body = <path d="M7 1.5 C9.5 5 11 7 11 9 a4 4 0 0 1 -8 0 C3 7 4.5 5 7 1.5 Z" fill="#38a6ff" stroke={INK} strokeWidth={1} />;
      break;
    case 'worldsEnd':
      body = (
        <g>
          <circle cx={7} cy={7} r={5.5} fill="#ff4f6d" stroke={INK} strokeWidth={1} />
          <path d="M3.5 9 Q7 3 10.5 9" fill="none" stroke="#ffd23f" strokeWidth={1.3} />
        </g>
      );
      break;
    case 'playWhen':
      body = (
        <g>
          <circle cx={7} cy={7} r={5.5} fill="#ffd23f" stroke={INK} strokeWidth={1} />
          <path d="M7 3.6 V7.6" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={7} cy={10.2} r={0.95} fill={INK} />
        </g>
      );
      break;
    case 'shield':
      body = <path d="M7 1.5 L12 3.5 V7 C12 10 9.6 12 7 13 C4.4 12 2 10 2 7 V3.5 Z" fill="#c7d0dd" stroke={INK} strokeWidth={1} />;
      break;
    case 'swarm':
      body = (
        <g fill="#ffd23f" stroke={INK} strokeWidth={0.9}>
          <circle cx={4.5} cy={5} r={2.6} />
          <circle cx={9.5} cy={5} r={2.6} />
          <circle cx={7} cy={9.6} r={2.6} />
        </g>
      );
      break;
  }
  return (
    <svg viewBox="0 0 14 14" width={14} height={14} aria-hidden="true">
      {body}
    </svg>
  );
}

export function traitMarks(c: DmTraitCard, indestructible: boolean): Mark[] {
  const out: Mark[] = [];
  if (c.dominant) out.push('dominant');
  if (c.action) out.push('action');
  if (c.dropOfLife) out.push('drop');
  if (c.worldsEnd) out.push('worldsEnd');
  if (c.playWhen) out.push('playWhen');
  if (indestructible) out.push('shield');
  if (c.isSwarm) out.push('swarm');
  return out;
}

// ============================================================================
// Ages & Catastrophes
// ============================================================================

type Scene =
  | 'birth' | 'eclipse' | 'dunes' | 'rift' | 'flare' | 'tropic' | 'calm' | 'glacier' | 'forest'
  | 'stars' | 'sunrise' | 'wind' | 'comets' | 'fog' | 'crown' | 'drift' | 'sandcastle'
  | 'meteor' | 'ice' | 'flood' | 'plague' | 'eruption' | 'goo' | 'machine' | 'stillwater';

const CATASTROPHE_SCENES: Scene[] = ['meteor', 'ice', 'flood', 'plague', 'eruption', 'goo', 'machine'];

function ageScene(a: Pick<DmAgeCard, 'kind' | 'ruleTag' | 'name'>): Scene {
  if (a.kind === 'birthOfLife') return 'birth';
  if (a.kind === 'catastrophe') {
    const n = a.name.toLowerCase();
    if (/still water/.test(n)) return 'stillwater';
    // Imaginary Ends
    if (/abyss/.test(n)) return 'flood';
    if (/isolation/.test(n)) return 'ice';
    if (/moonpocalypse/.test(n)) return 'meteor';
    if (/pink/.test(n)) return 'goo';
    // Overlush
    if (/ash|volcan/.test(n)) return 'eruption';
    if (/monsoon|deluge|superstorm|algal/.test(n)) return 'flood';
    if (/vine|rot|invasive|deforest|corruption/.test(n)) return 'plague';
    if (/strange matter|tragedy/.test(n)) return 'goo';
    if (/collapse|sacrifice/.test(n)) return 'meteor';
    if (/volcan|erupt|magma|lava|solar|flare/.test(n)) return 'eruption';
    if (/ice|glaci|frost|winter|freeze|snow|melt/.test(n)) return 'ice';
    if (/virus|plague|pandemic|disease|retro|spore|mutat/.test(n)) return 'plague';
    if (/flood|tsunami|deluge|sea|ocean|wave/.test(n)) return 'flood';
    if (/goo|nano|swarm|overpopul/.test(n)) return 'goo';
    if (/\bai\b|machine|deus|robot|tech|nuclear|takeover|pulse/.test(n)) return 'machine';
    if (/impact|meteor|comet|asteroid|extinction|horsemen|apocal|big one/.test(n)) return 'meteor';
    return CATASTROPHE_SCENES[hashString(a.name) % CATASTROPHE_SCENES.length]!;
  }
  switch (a.ruleTag) {
    case 'noRed': return 'eclipse';
    case 'noBlue': return 'dunes';
    case 'noGreen': return 'rift';
    case 'noPurple': return 'flare';
    case 'noColorless': return 'tropic';
    case 'ignoreActions': return 'calm';
    case 'maxFaceValue3': return 'glacier';
    case 'protectTraitPiles': return 'forest';
    case 'stabilizeTo4': return 'stars';
    case 'reason':
    case 'awakening':
    case 'prosperity': return 'sunrise';
    case 'northernWinds': return 'wind';
    case 'cometShowers': return 'comets';
    case 'dracula': return 'fog';
    case 'birthOfAHero':
    case 'messiah': return 'crown';
    case 'nietzsche':
    case 'enlightenment':
    case 'galacticDrift': return 'stars';
    case 'flourish':
    case 'naturalHarmony': return 'forest';
    case 'highTides': return 'calm';
    case 'alienTerraform': return 'rift';
    case 'castleGlass': return 'sandcastle';
    case 'magicHour': return 'sunrise';
    // Imaginary Ends
    case 'quietMoment':
    case 'moonlight': return 'calm';
    case 'reverie': return 'stars';
    case 'solitude':
    case 'fadingAway': return 'fog';
    case 'glitterstorm': return 'comets';
    case 'teaParties': return 'sunrise';
    case 'unusualFriends': return 'forest';
    // Overlush
    case 'certainty':
    case 'livingLibrary':
    case 'discardPurple': return 'stars';
    case 'discovery':
    case 'paintedValley':
    case 'discardRed': return 'sunrise';
    case 'envy':
    case 'duelingMoons': return 'eclipse';
    case 'noNegative':
    case 'noMulticolor':
    case 'stranger': return 'fog';
    case 'backwoods':
    case 'glimmeringGardens':
    case 'noDominants':
    case 'tangledCanopies':
    case 'discardGreen': return 'forest';
    case 'cleansingRains':
    case 'swamplands':
    case 'discardBlue': return 'calm';
    case 'harlequinFalls':
    case 'ramblinRiver': return 'tropic';
    case 'kingOfTheJungle':
    case 'mokokoLegend': return 'crown';
    case 'crackletown': return 'flare';
    case 'rustlingMeadows': return 'wind';
    case 'starTails': return 'comets';
    default: return 'drift';
  }
}

const BANNED: Partial<Record<string, DmTraitColor>> = { noRed: 'red', noBlue: 'blue', noGreen: 'green', noPurple: 'purple', noColorless: 'colorless' };

/** A landscape (0 0 160 90) for an Age, an apocalypse for a Catastrophe. */
export function AgeArt({ age }: { age: Pick<DmAgeCard, 'kind' | 'ruleTag' | 'name'> }) {
  const id = useSvgIds();
  const scene = ageScene(age);
  const rand = seededRandom(hashString(age.name));
  const doom = age.kind === 'catastrophe';
  const sky: [string, string] = doom
    ? scene === 'ice' ? ['#9fd6ff', '#183a66'] : scene === 'flood' ? ['#1b4f7a', '#051226'] : scene === 'plague' ? ['#2f5a1c', '#0a1406'] : scene === 'machine' ? ['#1a2440', '#05070f'] : scene === 'stillwater' ? ['#a9b8c6', '#2b3a4c'] : ['#ff8a3d', '#3a0716']
    : scene === 'birth' ? ['#1f8c76', '#04261f']
    : scene === 'eclipse' || scene === 'stars' || scene === 'fog' ? ['#2a2160', '#070512']
    : scene === 'dunes' || scene === 'sunrise' || scene === 'flare' ? ['#ffb35c', '#7a2a3d']
    : scene === 'glacier' ? ['#bfe9ff', '#3a6c9c']
    : scene === 'calm' ? ['#4a86b8', '#0d2438']
    : scene === 'sandcastle' ? ['#ffd59a', '#3a8fb0']
    : ['#5fc9a8', '#123d48'];
  const ground = doom ? '#140509' : scene === 'glacier' ? '#e6f6ff' : scene === 'dunes' ? '#d98c4a' : '#0d2a22';
  const banned = BANNED[age.ruleTag];
  const stars = Array.from({ length: 14 }, () => [rand() * 160, rand() * 50, 0.4 + rand() * 0.9] as const);

  return (
    <svg viewBox="0 0 160 90" className="dm-age-art" preserveAspectRatio="xMidYMid slice" role="img" aria-label={age.name}>
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sky[1]} />
          <stop offset="1" stopColor={sky[0]} />
        </linearGradient>
        <radialGradient id={id('sun')} cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#fff7c2" />
          <stop offset="0.5" stopColor="#ffd23f" />
          <stop offset="1" stopColor="#ff8a3d" stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={160} height={90} fill={id.url('sky')} />
      {(scene === 'eclipse' || scene === 'stars' || scene === 'fog' || scene === 'machine' || scene === 'meteor' || scene === 'birth') &&
        stars.map(([x, y, r], i) => <circle key={i} cx={f(x)} cy={f(y)} r={f(r)} fill="#fff" opacity={0.7} />)}

      {/* ---- the sky's event ---- */}
      {(scene === 'sunrise' || scene === 'dunes' || scene === 'birth' || scene === 'drift' || scene === 'tropic' || scene === 'forest' || scene === 'wind' || scene === 'sandcastle') && (
        <circle cx={scene === 'sunrise' || scene === 'birth' ? 80 : 118} cy={scene === 'sunrise' || scene === 'birth' ? 62 : 26} r={scene === 'sunrise' ? 34 : 22} fill={id.url('sun')} />
      )}
      {scene === 'sunrise' && Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI + (i / 8) * Math.PI;
        return <path key={i} d={`M${f(80 + Math.cos(a) * 26)} ${f(62 + Math.sin(a) * 26)} L${f(80 + Math.cos(a) * 46)} ${f(62 + Math.sin(a) * 46)}`} stroke="#ffe27a" strokeWidth={2} opacity={0.6} />;
      })}
      {scene === 'eclipse' && (
        <g>
          <circle cx={112} cy={28} r={18} fill="#ffd23f" opacity={0.9} />
          <circle cx={112} cy={28} r={22} fill="none" stroke="#ff8a3d" strokeWidth={2} opacity={0.5} />
          <circle cx={117} cy={25} r={17} fill="#140f2e" />
        </g>
      )}
      {scene === 'flare' && (
        <g>
          <circle cx={36} cy={30} r={20} fill={id.url('sun')} />
          <path d="M50 22 Q78 4 96 26 Q78 18 56 32" fill="#ff5a3d" opacity={0.8} />
        </g>
      )}
      {scene === 'calm' && <path d="M112 16 a10 10 0 1 0 8 16 a8 8 0 1 1 -8 -16 Z" fill="#f4f1d6" />}
      {scene === 'stars' && (
        <g opacity={0.8}>
          <ellipse cx={90} cy={30} rx={46} ry={12} fill="#b56cff" opacity={0.25} transform="rotate(-12 90 30)" />
          <ellipse cx={80} cy={34} rx={26} ry={6} fill="#38a6ff" opacity={0.25} transform="rotate(-12 80 34)" />
        </g>
      )}
      {scene === 'wind' && [0, 1, 2].map((i) => (
        <path key={i} d={`M${10 + i * 12} ${24 + i * 12} q30 -10 52 0 q14 6 6 14 q-8 4 -10 -4`} fill="none" stroke="#e9fff1" strokeWidth={2} strokeLinecap="round" opacity={0.7} />
      ))}
      {scene === 'comets' && [0, 1, 2].map((i) => (
        <g key={i}>
          <path d={`M${30 + i * 40} ${8 + i * 8} l-26 22`} stroke="#ffd23f" strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
          <circle cx={30 + i * 40} cy={8 + i * 8} r={3} fill="#fff7c2" />
        </g>
      ))}
      {scene === 'fog' && [0, 1, 2].map((i) => (
        <ellipse key={i} cx={30 + i * 50} cy={58 - i * 6} rx={44} ry={9} fill="#6b5aa8" opacity={0.35} />
      ))}
      {scene === 'crown' && (
        <g transform="translate(80 32) scale(1.6)">
          <path d="M-10 4 L-11 -6 L-5 -1 L0 -9 L5 -1 L11 -6 L10 4 Z" fill="#ffd23f" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
          <path d="M-2 -8 L1 -2 L-1 0 L2 4" fill="none" stroke={INK} strokeWidth={1.4} />
        </g>
      )}

      {/* ---- catastrophes ---- */}
      {scene === 'meteor' && (
        <g>
          <path d="M150 0 L84 52" stroke="#ffd23f" strokeWidth={10} strokeLinecap="round" opacity={0.35} />
          <path d="M150 0 L86 50" stroke="#fff7c2" strokeWidth={3.4} strokeLinecap="round" />
          <circle cx={84} cy={52} r={9} fill="#ff5a3d" stroke="#fff7c2" strokeWidth={2} />
          <ellipse cx={80} cy={70} rx={60} ry={10} fill="#ff8a3d" opacity={0.45} />
        </g>
      )}
      {scene === 'eruption' && (
        <g>
          <path d="M44 90 L70 40 L90 40 L116 90 Z" fill="#2a0a0e" stroke="#000" strokeWidth={1.4} />
          <path d="M70 40 Q80 48 90 40 L84 54 L78 46 L74 56 Z" fill="#ff5a3d" />
          <path d="M80 40 Q60 10 72 0 M80 40 Q96 14 108 4" stroke="#ff8a3d" strokeWidth={5} fill="none" strokeLinecap="round" />
          {[0, 1, 2, 3].map((i) => <circle key={i} cx={f(60 + rand() * 40)} cy={f(6 + rand() * 24)} r={f(2 + rand() * 2)} fill="#ffd23f" />)}
          <ellipse cx={80} cy={14} rx={40} ry={12} fill="#3a2a2a" opacity={0.55} />
        </g>
      )}
      {scene === 'ice' && (
        <g>
          {Array.from({ length: 22 }, (_, i) => <circle key={i} cx={f(rand() * 160)} cy={f(rand() * 70)} r={f(0.8 + rand() * 1.4)} fill="#fff" opacity={0.9} />)}
          <path d="M0 90 L14 54 L26 74 L40 44 L56 78 L72 50 L86 80 L100 46 L118 76 L132 52 L148 80 L160 60 L160 90 Z" fill="#dff4ff" stroke="#6fb4e6" strokeWidth={1.4} />
        </g>
      )}
      {scene === 'flood' && (
        <g>
          <path d="M0 52 Q30 14 74 30 Q50 34 56 52 Q80 26 110 40 Q140 20 160 34 L160 90 L0 90 Z" fill="#1f6fb0" stroke="#9ad7ff" strokeWidth={2} />
          <path d="M0 66 Q40 50 80 64 T160 62 L160 90 L0 90 Z" fill="#0b3a66" />
          {[0, 1, 2].map((i) => <circle key={i} cx={f(40 + i * 34)} cy={f(36 + rand() * 6)} r={2} fill="#e9fbff" />)}
        </g>
      )}
      {scene === 'plague' && Array.from({ length: 6 }, (_, i) => {
        const x = 16 + rand() * 128;
        const y = 10 + rand() * 50;
        const r = 5 + rand() * 6;
        return (
          <g key={i} opacity={0.9}>
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k / 8) * Math.PI * 2;
              return <path key={k} d={`M${f(x + Math.cos(a) * r)} ${f(y + Math.sin(a) * r)} l${f(Math.cos(a) * 3.5)} ${f(Math.sin(a) * 3.5)}`} stroke="#c6ff6a" strokeWidth={1.4} />;
            })}
            <circle cx={f(x)} cy={f(y)} r={f(r)} fill="#5aa832" stroke="#c6ff6a" strokeWidth={1.2} />
          </g>
        );
      })}
      {scene === 'goo' && Array.from({ length: 9 }, (_, i) => {
        // Imaginary Ends' Too Much Pink gets pink goo.
        const pink = /pink/i.test(age.name);
        return <path key={i} d={blobPath(10 + rand() * 140, 40 + rand() * 40, 6 + rand() * 10, 7, 0.2, rand)} fill={pink ? '#ff7ad9' : '#8a93a3'} stroke={pink ? '#ffd0f1' : '#d5dbe4'} strokeWidth={1} opacity={0.85} />;
      })}
      {scene === 'machine' && (
        <g>
          {Array.from({ length: 7 }, (_, i) => <path key={i} d={`M${i * 24} 90 V${60 + (i % 3) * 8} H${i * 24 + 12} V${44 + (i % 2) * 10}`} fill="none" stroke="#38a6ff" strokeWidth={1.4} opacity={0.7} />)}
          <circle cx={80} cy={34} r={18} fill="#0a1020" stroke="#ff4f6d" strokeWidth={2.4} />
          <circle cx={80} cy={34} r={7} fill="#ff4f6d" />
          <circle cx={78} cy={32} r={2} fill="#fff" />
        </g>
      )}

      {scene === 'stillwater' && (
        <g>
          {/* a pale sun and its perfect reflection on a dead-flat sea */}
          <circle cx={58} cy={30} r={11} fill="#eef3f7" opacity={0.85} />
          <rect x={0} y={52} width={160} height={38} fill="#4f6378" />
          <ellipse cx={58} cy={68} rx={10} ry={4} fill="#eef3f7" opacity={0.45} />
          <path d="M0 52 H160" stroke="#d7e2ec" strokeWidth={1.2} opacity={0.8} />
          {[0, 1, 2, 3].map((i) => <path key={i} d={`M${18 + i * 34} ${60 + (i % 2) * 14} h${16 - (i % 2) * 6}`} stroke="#c3d2df" strokeWidth={1} opacity={0.5} />)}
          {/* the tip of a drowned sandcastle */}
          <path d="M112 52 V44 H115 V46 H118 V44 H121 V52 Z" fill="#9c8a6c" stroke="#2b3a4c" strokeWidth={1} />
          <path d="M112 52 V58 H121 V52" fill="#9c8a6c" opacity={0.3} />
        </g>
      )}

      {/* ---- ground ---- */}
      {scene !== 'flood' && scene !== 'ice' && scene !== 'eruption' && scene !== 'stillwater' && scene !== 'sandcastle' && (
        <path d={`M0 ${70 + rand() * 6} Q40 ${58 + rand() * 8} 80 ${66 + rand() * 6} T160 ${62 + rand() * 8} L160 90 L0 90 Z`} fill={ground} />
      )}
      {scene === 'eruption' && <path d="M0 80 Q40 74 80 82 T160 78 L160 90 L0 90 Z" fill={ground} />}
      {scene === 'dunes' && <path d="M0 78 Q30 64 70 76 Q110 86 160 70 L160 90 L0 90 Z" fill="#b8692f" />}
      {scene === 'rift' && <path d="M60 66 L72 74 L66 80 L80 90 L90 90 L76 78 L84 72 L70 64 Z" fill="#ff5a3d" />}
      {scene === 'glacier' && <path d="M0 70 L20 52 L34 64 L54 46 L78 66 L98 50 L120 66 L140 54 L160 64 L160 90 L0 90 Z" fill="#f2fbff" stroke="#8cc9ef" strokeWidth={1.2} />}
      {scene === 'forest' && Array.from({ length: 8 }, (_, i) => (
        <path key={i} d={`M${8 + i * 20} 78 L${16 + i * 20} ${52 + (i % 3) * 6} L${24 + i * 20} 78 Z`} fill="#155c3a" stroke="#0a2a1c" strokeWidth={1} />
      ))}
      {scene === 'tropic' && (
        <g>
          <path d="M0 78 Q40 70 80 78 T160 76 L160 90 L0 90 Z" fill="#1f8fb0" />
          <path d="M40 76 Q44 60 40 46" stroke="#5a3a1c" strokeWidth={2.4} fill="none" />
          <path d="M40 46 q-14 -2 -18 8 M40 46 q14 -2 18 8 M40 46 q-4 -12 -14 -12 M40 46 q6 -12 16 -10" stroke="#2fbf6a" strokeWidth={3} fill="none" strokeLinecap="round" />
        </g>
      )}
      {scene === 'calm' && <path d="M0 70 Q40 66 80 70 T160 68 L160 90 L0 90 Z" fill="#163a58" />}
      {scene === 'drift' && <path d="M20 74 q14 -10 30 -4 q-6 8 -30 4 Z M96 70 q20 -8 40 2 q-14 8 -40 -2 Z" fill="#1f6a4a" />}
      {scene === 'sandcastle' && (
        <g>
          <path d="M0 58 Q40 54 80 58 T160 56 L160 66 L0 66 Z" fill="#2f8fb8" />
          <path d="M0 60 Q20 57 40 60 T80 60 T120 60 T160 59" fill="none" stroke="#e9fbff" strokeWidth={1.2} opacity={0.7} />
          <path d="M0 68 Q40 62 80 66 T160 64 L160 90 L0 90 Z" fill="#e8c58a" />
          {/* the castle: two towers and a keep, with glass windows catching the light */}
          <g fill="#d9ae6c" stroke="#5a3d1c" strokeWidth={1.2} strokeLinejoin="round">
            <path d="M52 76 V52 H56 V55 H60 V52 H64 V76 Z" />
            <path d="M96 76 V52 H100 V55 H104 V52 H108 V76 Z" />
            <path d="M62 76 V42 H67 V46 H72 V40 H78 V46 H83 V42 H88 V46 H93 V42 H98 V76 Z" />
          </g>
          <path d="M80 30 V40" stroke="#5a3d1c" strokeWidth={1.2} />
          <path d="M80 30 L90 33 L80 36 Z" fill="#ff7a6b" stroke="#5a3d1c" strokeWidth={0.8} />
          {[[58, 62], [102, 62], [76, 52], [84, 58]].map(([x, y], i) => (
            <path key={i} d={`M${x} ${y! - 3} L${x! + 2.5} ${y} L${x} ${y! + 3} L${x! - 2.5} ${y} Z`} fill="#bff2ff" stroke="#3a8fb0" strokeWidth={0.6} />
          ))}
          <path d="M74 76 Q80 68 86 76 Z" fill="#5a3d1c" />
          <circle cx={30} cy={80} r={2.6} fill="#ff7a6b" stroke="#5a3d1c" strokeWidth={0.8} />
          <path d="M128 82 l3 -5 l3 5 Z" fill="#f2c38b" stroke="#5a3d1c" strokeWidth={0.8} />
        </g>
      )}
      {scene === 'birth' && (
        <g>
          <path d="M0 72 Q40 66 80 72 T160 70 L160 90 L0 90 Z" fill="#0b5a4a" />
          <circle cx={80} cy={78} r={6} fill="#8cff5a" opacity={0.35} />
          <path d={blobPath(80, 78, 3.6, 7, 0.15, rand)} fill="#c2ffd3" />
        </g>
      )}

      {/* "no <colour>" Ages wear the banned colour as a struck-out cell */}
      {banned && (
        <g transform="translate(22 22)">
          <circle r={11} fill={HUE[banned].core} stroke={INK} strokeWidth={1.8} />
          <circle r={11} fill="none" stroke="#fff" strokeWidth={1} opacity={0.4} />
          <path d="M-8 -8 L8 8" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          <path d="M-8 -8 L8 8" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )}
      {doom && <rect width={160} height={90} fill="none" stroke="#ff4f6d" strokeWidth={3} opacity={0.6} />}
    </svg>
  );
}
