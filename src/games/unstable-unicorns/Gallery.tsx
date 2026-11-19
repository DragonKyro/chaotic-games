// Every Unstable Unicorns card face (one per kind, across all editions and
// expansions) grouped by type, plus the back — for art reviews
// (?gallery=unstable-unicorns).

import {
  UU_BABY_DEFS, UU_CHAOS_EDITION_DEFS, UU_CONTROL_EDITION_DEFS, UU_DIAMOND_EDITION_DEFS, UU_EXPANSION_DEFS,
  UU_FIRST_EDITION_DEFS, UU_MAIN_DECK_DEFS, UU_TRAVEL_EDITION_DEFS, type UuCardDef,
} from './cards';
import { TYPE_META } from './CardArt';
import { UuCardBack, UuCardView } from './Card';
import type { UuCardType } from './types';

const ORDER: UuCardType[] = ['babyUnicorn', 'basicUnicorn', 'magicalUnicorn', 'diamondUnicorn', 'magic', 'instant', 'upgrade', 'downgrade'];

export function Gallery() {
  const seen = new Set<string>();
  const defs: UuCardDef[] = [];
  for (const d of [
    ...UU_BABY_DEFS, ...UU_MAIN_DECK_DEFS, ...UU_FIRST_EDITION_DEFS, ...UU_CONTROL_EDITION_DEFS, ...UU_CHAOS_EDITION_DEFS,
    ...UU_DIAMOND_EDITION_DEFS, ...UU_TRAVEL_EDITION_DEFS, ...UU_EXPANSION_DEFS,
  ]) {
    if (seen.has(d.kind)) continue;
    seen.add(d.kind);
    defs.push(d);
  }
  return (
    <div className="uu-gallery">
      {ORDER.map((t) => {
        const of = defs.filter((d) => d.type === t);
        return (
          <section key={t}>
            <h3>{TYPE_META[t].label} · {of.length}</h3>
            <div className="uu-gallery-row">
              {of.map((d) => <UuCardView key={d.kind} card={d} size="md" inspect={false} />)}
            </div>
          </section>
        );
      })}
      <section>
        <h3>Back</h3>
        <div className="uu-gallery-row">
          <UuCardBack size="lg" />
          <UuCardView card={UU_MAIN_DECK_DEFS.find((d) => d.kind === 'super-neigh')!} size="lg" />
          <UuCardView card={UU_MAIN_DECK_DEFS.find((d) => d.type === 'magicalUnicorn')!} size="lg" />
        </div>
      </section>
    </div>
  );
}
