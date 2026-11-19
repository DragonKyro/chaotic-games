// Every card face, both backs and every dinosaur, for art reviews
// (?gallery=happy-little-dinos).

import {
  HLD_5_6_DISASTER_DEFS, HLD_5_6_MAIN_DECK_DEFS, HLD_DATING_DISASTER_DEFS, HLD_DATING_MAIN_DECK_DEFS, HLD_DINO_DEFS,
  HLD_DISASTER_DEFS, HLD_HAZARD_CARD_DEFS, HLD_HAZARDS_DISASTER_DEFS, HLD_HAZARDS_MAIN_DECK_DEFS, HLD_MAIN_DECK_DEFS,
  HLD_PUBERTY_DISASTER_DEFS, HLD_PUBERTY_MAIN_DECK_DEFS, type HldCardDef, type HldDisasterDef,
} from './cards';
import { DinoCard, DisasterCard, FaceDownCard, HazardCard, PlayCard } from './Card';
import { DinoBadge } from './DinoArt';
import type { HldCard, HldDisasterCard } from './types';

const ALL_MAIN: readonly HldCardDef[] = [
  ...HLD_MAIN_DECK_DEFS, ...HLD_5_6_MAIN_DECK_DEFS, ...HLD_PUBERTY_MAIN_DECK_DEFS, ...HLD_DATING_MAIN_DECK_DEFS, ...HLD_HAZARDS_MAIN_DECK_DEFS,
];
const ALL_DISASTERS: readonly HldDisasterDef[] = [
  ...HLD_DISASTER_DEFS, ...HLD_5_6_DISASTER_DEFS, ...HLD_PUBERTY_DISASTER_DEFS, ...HLD_DATING_DISASTER_DEFS, ...HLD_HAZARDS_DISASTER_DEFS,
];

function uniqueCards(type: 'point' | 'instant'): HldCard[] {
  const seen = new Set<string>();
  const out: HldCard[] = [];
  for (const d of ALL_MAIN) {
    if (d.type !== type || seen.has(d.kind)) continue;
    seen.add(d.kind);
    out.push({ id: out.length + 1, kind: d.kind, name: d.name, type: d.type, value: d.value, hasEffect: d.hasEffect, text: d.text });
  }
  return type === 'point' ? out.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)) : out;
}

function uniqueDisasters(): HldDisasterCard[] {
  const seen = new Set<string>();
  const order = { natural: 0, predator: 1, emotional: 2, meteor: 3 } as const;
  return ALL_DISASTERS.filter((d) => !seen.has(d.name) && !!seen.add(d.name))
    .map((d, i) => ({ id: i + 1, name: d.name, category: d.category, text: d.text, ...(d.drawsHazard ? { drawsHazard: true } : {}) }))
    .sort((a, b) => order[a.category] - order[b.category]);
}

export function Gallery() {
  return (
    <div className="hld-gallery">
      <h3>Dinosaurs</h3>
      <div className="hld-gallery-row">
        {HLD_DINO_DEFS.map((d) => <DinoCard key={d.id} dino={d.id} />)}
        {HLD_DINO_DEFS.map((d) => <DinoCard key={`${d.id}-s`} dino={d.id} mood="scared" compact />)}
        {HLD_DINO_DEFS.map((d) => <DinoCard key={`${d.id}-o`} dino={d.id} mood="out" compact />)}
      </div>
      <div className="hld-gallery-row">
        {HLD_DINO_DEFS.map((d, i) => <DinoBadge key={d.id} dino={d.id} color={['#e64a4a', '#3a6ec9', '#f37025', '#f0f0f0', '#8a47c4', '#e85a9c'][i]!} size={56} />)}
      </div>
      <h3>Point cards</h3>
      <div className="hld-gallery-row">{uniqueCards('point').map((c) => <PlayCard key={c.kind} card={c} size="lg" inspect={false} />)}</div>
      <h3>Instants</h3>
      <div className="hld-gallery-row">{uniqueCards('instant').map((c) => <PlayCard key={c.kind} card={c} size="lg" inspect={false} />)}</div>
      <h3>Disasters</h3>
      <div className="hld-gallery-row">{uniqueDisasters().map((d) => <DisasterCard key={d.name} disaster={d} size="md" inspect={false} />)}</div>
      <h3>Hazards &amp; backs</h3>
      <div className="hld-gallery-row">
        {HLD_HAZARD_CARD_DEFS.map((h, i) => <HazardCard key={h.name} hazard={{ id: i, name: h.name, penalty: h.penalty, text: h.text }} size="lg" />)}
        <FaceDownCard size="lg" />
        <FaceDownCard size="lg" deck="disaster" />
      </div>
    </div>
  );
}
