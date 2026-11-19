// Every card face plus the back, grouped by type, for art reviews
// (?gallery=here-to-slay). Built from the definition tables, so it covers all
// three expansions.

import {
  HTS_ALL_PARTY_LEADERS,
  HTS_BERSERKERS_NECROMANCERS_DECK_DEFS,
  HTS_BERSERKERS_NECROMANCERS_MONSTERS,
  HTS_MAIN_DECK_DEFS,
  HTS_MONSTER_DEFS,
  HTS_SLEIGH_DECK_DEFS,
  HTS_SLEIGH_GIFTS,
  HTS_SLEIGH_MONSTERS,
  HTS_WARRIORS_DRUIDS_DECK_DEFS,
  HTS_WARRIORS_DRUIDS_MONSTERS,
  type HtsCardDef,
} from './cards';
import { FaceDownCard, HtsCardView, MonsterCard } from './Card';
import { CLASS_META } from './sigils';
import type { HtsBaseClass, HtsCard, HtsCardType, HtsMonster } from './types';

const DECKS = [...HTS_MAIN_DECK_DEFS, ...HTS_WARRIORS_DRUIDS_DECK_DEFS, ...HTS_BERSERKERS_NECROMANCERS_DECK_DEFS, ...HTS_SLEIGH_DECK_DEFS, ...HTS_SLEIGH_GIFTS];
const MONSTER_DEFS = [...HTS_MONSTER_DEFS, ...HTS_WARRIORS_DRUIDS_MONSTERS, ...HTS_BERSERKERS_NECROMANCERS_MONSTERS, ...HTS_SLEIGH_MONSTERS];

function toCard(d: HtsCardDef, id: number): HtsCard {
  return {
    id,
    kind: d.kind,
    name: d.name,
    type: d.type,
    class: d.class,
    text: d.text,
    abilityThreshold: d.abilityThreshold,
    rollLow: d.rollLow,
    maxItems: d.maxItems,
    modifierChoices: d.modifierChoices,
    expansion: d.expansion,
  };
}

function unique(defs: readonly HtsCardDef[]): HtsCardDef[] {
  const seen = new Set<string>();
  return defs.filter((d) => {
    const k = `${d.kind}|${d.name}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const ofType = (t: HtsCardType) => unique(DECKS.filter((d) => d.type === t));

export function Gallery() {
  let id = 1;
  const row = (title: string, defs: readonly HtsCardDef[]) => (
    <section className="hts-gallery-row" key={title}>
      <h3>{title} <small>{defs.length}</small></h3>
      <div>{defs.map((d) => <HtsCardView key={`${d.kind}${d.name}`} card={toCard(d, id++)} size="lg" />)}</div>
    </section>
  );
  const heroesByClass = (Object.keys(CLASS_META) as HtsBaseClass[])
    .map((c) => [c, unique(DECKS.filter((d) => d.type === 'hero' && d.class === c))] as const)
    .filter(([, defs]) => defs.length > 0);
  const monsters: HtsMonster[] = MONSTER_DEFS.map((m) => ({
    card: { id: id++, kind: m.kind, name: m.name, type: 'monster', class: null, text: m.text, abilityThreshold: null, modifierChoices: null },
    requiredHeroes: m.requiredHeroes,
    requiredClass: m.requiredClass,
    requirementText: m.requirementText,
    slayThreshold: m.slayThreshold,
    slayOnLow: m.slayOnLow,
    failThreshold: m.failThreshold,
    failPenalty: m.failPenalty,
  }));
  return (
    <div className="hts-gallery">
      {row('Party Leaders', unique(HTS_ALL_PARTY_LEADERS))}
      <section className="hts-gallery-row">
        <h3>Monsters <small>{monsters.length}</small></h3>
        <div>{monsters.map((m) => <MonsterCard key={m.card.kind} monster={m} size="lg" />)}</div>
      </section>
      {heroesByClass.map(([c, defs]) => row(`${CLASS_META[c].label} heroes`, defs))}
      {row('Items', ofType('item'))}
      {row('Cursed Items', ofType('cursedItem'))}
      {row('Magic', ofType('magic'))}
      {row('Modifiers', ofType('modifier'))}
      {row('Challenges', ofType('challenge'))}
      {row('Nice Gifts', ofType('gift'))}
      <section className="hts-gallery-row">
        <h3>Back</h3>
        <div><FaceDownCard size="lg" /></div>
      </section>
    </div>
  );
}
