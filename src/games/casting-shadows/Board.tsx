// The hex map: an SVG of glowing rune hexes (terrain, name, yield) under an
// HTML layer for the things that move or need a hover zoom — casters' orbs,
// each hex's face-up card, travel pills. Positions are percentages of the
// map, so the layer scales with the SVG.

import type { CSSProperties } from 'react';
import type { PlayerId } from '@/core/types';
import { isLive } from '@/core/state';
import { useSvgIds } from '@/ui/kit';
import { GemGlyph, hexPoints, INK, TERRAIN, TerrainArt } from './art';
import { CardView } from './Card';
import type { CsHexId, CsState } from './types';

const R = 50;
const SQ3 = Math.sqrt(3);

function hexCenter(q: number, r: number): [number, number] {
  return [R * SQ3 * (q + r / 2), R * 1.5 * r];
}

export function HexMap({
  state: s, me, selected, reachable, targetHexes, targetPlayers, onHex, onTravel, onPlayer,
}: {
  state: CsState;
  me: PlayerId | null;
  selected: CsHexId | null;
  /** Hexes you can Travel to right now. */
  reachable: ReadonlySet<CsHexId>;
  /** While aiming a hex spell (or choosing an escape hex). */
  targetHexes: ReadonlySet<CsHexId> | null;
  /** While aiming at a caster. */
  targetPlayers: ReadonlySet<PlayerId> | null;
  onHex: (id: CsHexId) => void;
  onTravel: (id: CsHexId) => void;
  onPlayer: (id: PlayerId) => void;
}) {
  const id = useSvgIds();
  const hexes = Object.values(s.hexes);
  const pts = hexes.map((h) => hexCenter(h.q, h.r));
  const minX = Math.min(...pts.map((p) => p[0])) - R * 0.92;
  const maxX = Math.max(...pts.map((p) => p[0])) + R * 0.92;
  const minY = Math.min(...pts.map((p) => p[1])) - R * 1.02;
  const maxY = Math.max(...pts.map((p) => p[1])) + R * 1.02;
  const W = maxX - minX;
  const H = maxY - minY;
  const pct = (x: number, y: number) => ({ left: `${((x - minX) / W) * 100}%`, top: `${((y - minY) / H) * 100}%` });
  const myHex = me && s.boards[me] && isLive(s, me) ? s.boards[me]!.hexId : null;

  // casters by hex, for the orb rings
  const byHex = new Map<CsHexId, PlayerId[]>();
  for (const seat of s.seats) {
    if (!isLive(s, seat.id)) continue;
    const h = s.boards[seat.id]!.hexId;
    byHex.set(h, [...(byHex.get(h) ?? []), seat.id]);
  }

  return (
    <div className="cs-map" style={{ aspectRatio: `${W} / ${H}` }}>
      <svg viewBox={`${minX} ${minY} ${W} ${H}`} className="cs-map-svg" aria-label="The hex map">
        <defs>
          {hexes.map((h) => (
            <linearGradient key={h.id} id={id(`t-${h.id}`)} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={TERRAIN[h.id].top} />
              <stop offset="1" stopColor={TERRAIN[h.id].bottom} />
            </linearGradient>
          ))}
          <radialGradient id={id('halo')} cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#7cf5ff" stopOpacity={0.35} />
            <stop offset="1" stopColor="#7cf5ff" stopOpacity={0} />
          </radialGradient>
        </defs>
        {/* one soft halo under the whole map (the only glow layer) */}
        <ellipse cx={(minX + maxX) / 2} cy={(minY + maxY) / 2} rx={W * 0.48} ry={H * 0.46} fill={id.url('halo')} />
        {hexes.map((h) => {
          const [x, y] = hexCenter(h.q, h.r);
          const t = TERRAIN[h.id];
          const isMine = h.id === myHex;
          const isTarget = targetHexes?.has(h.id) ?? false;
          const isReach = !targetHexes && reachable.has(h.id);
          const cls = ['cs-hex', isMine && 'is-mine', isTarget && 'is-target', isReach && 'is-reach', selected === h.id && 'is-selected', targetHexes && !isTarget && 'is-dim']
            .filter(Boolean).join(' ');
          return (
            <g key={h.id} className={cls} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} onClick={() => onHex(h.id)} style={{ '--glow': t.glow } as CSSProperties}>
              <polygon points={hexPoints(R * 0.96)} fill={id.url(`t-${h.id}`)} stroke={INK} strokeWidth={3} />
              <polygon className="cs-hex-rim" points={hexPoints(R * 0.88)} fill="none" stroke={t.glow} strokeWidth={1.4} />
              <g transform="translate(0 2) scale(0.95)"><TerrainArt hexId={h.id} /></g>
              {h.startTurnResource && (
                <g transform={`translate(${-R * 0.7} ${-R * 0.14}) scale(0.5)`}>
                  <circle cx={12} cy={12} r={13} fill={INK} opacity={0.6} />
                  <GemGlyph icon={h.startTurnResource} />
                </g>
              )}
              {h.id === 'ancient-rune' && <text className="cs-hex-tag" x={0} y={R * 0.58} textAnchor="middle">+2 HP</text>}
              {h.id === 'dusty-desert' && <text className="cs-hex-tag" x={0} y={R * 0.58} textAnchor="middle">Counterspells</text>}
            </g>
          );
        })}
        {/* names on their own layer, so a neighbouring hex never paints over one */}
        {hexes.map((h) => {
          const [x, y] = hexCenter(h.q, h.r);
          return <text key={`n-${h.id}`} className="cs-hex-name" x={x} y={y - R * 0.6} textAnchor="middle">{h.name}</text>;
        })}
      </svg>

      {/* face-up cards */}
      {hexes.map((h) => {
        if (!h.faceUpCard) return null;
        const [x, y] = hexCenter(h.q, h.r);
        return (
          <div key={`c-${h.id}`} className="cs-map-card" style={pct(x + R * 0.4, y + R * 0.18)}>
            <CardView card={h.faceUpCard} size="xs" />
          </div>
        );
      })}

      {/* travel pills */}
      {!targetHexes && [...reachable].map((hid) => {
        const h = s.hexes[hid];
        if (!h) return null;
        const [x, y] = hexCenter(h.q, h.r);
        return (
          <button key={`t-${hid}`} type="button" className="cs-travel" style={pct(x, y + R * 0.58)} onClick={() => onTravel(hid)}>
            Travel ›
          </button>
        );
      })}

      {/* casters */}
      {[...byHex.entries()].flatMap(([hid, ids]) => {
        const h = s.hexes[hid];
        const [x, y] = hexCenter(h.q, h.r);
        return ids.map((pid, i) => {
          const seat = s.seats.find((st) => st.id === pid)!;
          const n = ids.length;
          const a = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2;
          const spread = n > 1 ? R * 0.22 : 0;
          const ox = x - R * 0.34 + Math.cos(a) * spread;
          const oy = y + R * 0.16 + Math.sin(a) * spread;
          const shadow = s.boards[pid]!.form === 'shadow';
          const pickable = targetPlayers?.has(pid) ?? false;
          return (
            <button
              key={pid}
              type="button"
              className={`cs-orb${s.turnPlayerId === pid && s.phase === 'playing' ? ' is-turn' : ''}${shadow ? ' is-shadow' : ''}${pickable ? ' is-target' : ''}${pid === me ? ' is-me' : ''}`}
              style={{ ...pct(ox, oy), '--seat': seat.color } as CSSProperties}
              title={`${seat.name}${pid === me ? ' (you)' : ''} — ${s.boards[pid]!.hp} HP`}
              onClick={pickable ? () => onPlayer(pid) : () => onHex(hid)}
              aria-label={seat.name}
            >
              <span>{seat.name.slice(0, 1).toUpperCase()}</span>
            </button>
          );
        });
      })}
    </div>
  );
}
