// Every Casting Shadows face for art reviews (?gallery=casting-shadows):
// all card kinds, both backs, each caster in both forms, the gem dice, the hexes.

import type { CSSProperties } from 'react';
import { Die } from '@/ui/kit';
import { CasterArt, GemIconSvg, hexPoints, INK, TERRAIN, TerrainArt, type GemIcon } from './art';
import { CardBack, CardView } from './Card';
import {
  CS_ALL_CHARACTERS, CS_ALL_HEX_DEFS, CS_COMPANION_DEFS, CS_COUNTERSPELL_DEFS, CS_ICE_STORM_COMPANION_DEFS,
  CS_ICE_STORM_COUNTERSPELL_DEFS, CS_ICE_STORM_MAIN_DECK_DEFS, CS_MAIN_DECK_DEFS, CS_MOLTEN_ROCK_COMPANION_DEFS,
  CS_MOLTEN_ROCK_COUNTERSPELL_DEFS, CS_MOLTEN_ROCK_MAIN_DECK_DEFS,
} from './cards';
import type { CsCard } from './types';

const ALL_DEFS = [
  ...CS_MAIN_DECK_DEFS, ...CS_ICE_STORM_MAIN_DECK_DEFS, ...CS_MOLTEN_ROCK_MAIN_DECK_DEFS,
  ...CS_COUNTERSPELL_DEFS, ...CS_ICE_STORM_COUNTERSPELL_DEFS, ...CS_MOLTEN_ROCK_COUNTERSPELL_DEFS,
  ...CS_COMPANION_DEFS, ...CS_ICE_STORM_COMPANION_DEFS, ...CS_MOLTEN_ROCK_COMPANION_DEFS,
];

const FACES: GemIcon[] = ['redGem', 'blueGem', 'purpleGem', 'redOrb', 'blueOrb', 'purpleOrb', 'shadowFragment', 'cursedCrystal', 'anyGem', 'anyOrb'];

/** `?part=1..4` shows one slice (art reviews of a long sheet); no part shows everything. */
function part(): number {
  if (typeof window === 'undefined') return 0;
  return Number(new URLSearchParams(window.location.search).get('part') ?? 0);
}

export function Gallery() {
  const p = part();
  const seen = new Set<string>();
  const cards: CsCard[] = [];
  ALL_DEFS.forEach((d, i) => {
    if (seen.has(d.kind)) return;
    seen.add(d.kind);
    cards.push({ ...d, id: 9000 + i });
  });
  const slice = p >= 2 ? cards.slice((p - 2) * 30, (p - 1) * 30) : cards;
  return (
    <div className="cs-table cs-gallery">
      {(p === 0 || p === 1) && (<>
      <h3>Casters</h3>
      <div className="cs-gallery-row">
        {CS_ALL_CHARACTERS.map((c) => (
          <div key={c.id} className="cs-gallery-caster">
            <CasterArt characterId={c.id} form="light" />
            <CasterArt characterId={c.id} form="shadow" />
            <span>{c.lightName} / {c.shadowName}</span>
          </div>
        ))}
      </div>
      <h3>Gems &amp; dice</h3>
      <div className="cs-gallery-row">
        {FACES.map((f) => <GemIconSvg key={f} icon={f} size={40} />)}
        {(['redGem', 'blueOrb', 'purpleGem', 'shadowFragment', 'cursedCrystal'] as GemIcon[]).map((f, i) => (
          <span key={f} className={`cs-die cs-die-${['red', 'red', 'blue', 'blue', 'purple'][i]}`}>
            <Die value={<GemIconSvg icon={f} size={30} />} size={52} />
          </span>
        ))}
      </div>
      <h3>Hexes</h3>
      <div className="cs-gallery-row">
        {CS_ALL_HEX_DEFS.map((h) => (
          <svg key={h.id} viewBox="-50 -50 100 100" width={130} style={{ '--glow': TERRAIN[h.id].glow } as CSSProperties} className="cs-gallery-hex">
            <polygon points={hexPoints(48)} fill={TERRAIN[h.id].top} stroke={INK} strokeWidth={3} />
            <polygon points={hexPoints(44)} fill="none" stroke={TERRAIN[h.id].glow} strokeWidth={1.4} />
            <TerrainArt hexId={h.id} />
            <text className="cs-hex-name" x={0} y={-30} textAnchor="middle">{h.name}</text>
          </svg>
        ))}
      </div>
      </>)}
      {p !== 1 && (<>
      <h3>Cards</h3>
      <div className="cs-gallery-row">
        {p <= 2 && <CardBack size="lg" />}
        {p <= 2 && <CardBack size="lg" variant="ward" />}
        {slice.map((c) => <CardView key={c.kind} card={c} size="lg" inspect={false} />)}
      </div>
      </>)}
    </div>
  );
}
