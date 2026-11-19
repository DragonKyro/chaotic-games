// Happy Little Dinosaurs — in-app Rules & Card Reference (Base + all 4 Expansions).

import { RulesBook, RulesGrid, RulesHero, RulesTile } from '@/ui/RulesBook';
import { DinoCard } from './Card';
import { CATEGORY_COLOR, CATEGORY_LABEL, CategoryIcon } from './CardArt';
import { HLD_DINO_DEFS, HLD_HAZARD_CARD_DEFS, HLD_MAIN_DECK_DEFS } from './cards';
import { HLD_EXPANSIONS } from './types';

const HERO = 'linear-gradient(135deg, #ff9f1c, #ff5f9e)';

export function Rules() {
  return (
    <RulesBook
      pages={[
        {
          title: 'The point',
          body: (
            <>
              <RulesHero title="Escape — or be the last dino standing" subtitle="First to the end of the Escape Route wins (50 by the rulebook)" accent={HERO} />
              <ol>
                <li>Hands refill to 5 (re-dealt if you hold no Point cards).</li>
                <li>A <strong>Disaster</strong> is flipped: Natural, Predatory, Emotional or Meteor.</li>
                <li>Everyone picks one <strong>Point card (0–9)</strong> face-down at the same time, then all are revealed.</li>
                <li>Point card effects resolve from the lowest value to the highest, then anyone may play <strong>Scoring Instants</strong>.</li>
                <li>The <strong>highest score</strong> moves up the Escape Route by that score (at 5–6 players the top <strong>two</strong> do). The <strong>lowest score</strong> takes the Disaster — ties go to Sudden Death.</li>
                <li>Every surviving dino moves +1 per Disaster it holds.</li>
              </ol>
            </>
          ),
        },
        {
          title: 'Disasters',
          body: (
            <>
              <RulesHero title="Three strikes" subtitle="3 Disasters of one type, or 3 different types, and you go extinct" accent="linear-gradient(135deg, #e8342e, #b35cff)" />
              <RulesGrid cols={2}>
                {(['natural', 'predator', 'emotional', 'meteor'] as const).map((c) => (
                  <RulesTile
                    key={c}
                    icon={<CategoryIcon category={c} size={26} />}
                    label={CATEGORY_LABEL[c]}
                    accent={CATEGORY_COLOR[c]}
                    hint={c === 'meteor' ? 'Wild: counts as any of the other three.' : `Each dino is good (+1) or bad (−1) against some types.`}
                  />
                ))}
              </RulesGrid>
              <p>Your Disaster meter shows three slots; when an empty slot glows red, the next Disaster of that type would be fatal.</p>
            </>
          ),
        },
        {
          title: 'Dinosaurs',
          body: (
            <>
              <p>{HLD_DINO_DEFS.length} dinosaurs (Pterry Dactyl and Raging Raptor come with the 5–6 Player Expansion). Pick yours in the lobby, or switch before your first card.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {HLD_DINO_DEFS.map((d) => <DinoCard key={d.id} dino={d.id} />)}
              </div>
            </>
          ),
        },
        {
          title: 'Expansions & Hazards',
          body: (
            <>
              <ul>
                {HLD_EXPANSIONS.map((e) => (
                  <li key={e.id}><strong>{e.name}:</strong> {e.summary}</li>
                ))}
              </ul>
              <p>
                Some <em>Hazards Ahead</em> Disasters also hand their victim a <strong>Hazard card</strong> ({HLD_HAZARD_CARD_DEFS.reduce((n, d) => n + d.count, 0)} in the deck):
                a lasting penalty until a card like Molotov Crocktail, Suck Up, Caution Sign or Detour clears it.
              </p>
              <ul>
                {HLD_HAZARD_CARD_DEFS.map((h) => (
                  <li key={h.name}><strong>{h.name} (×{h.count}):</strong> {h.text}</li>
                ))}
              </ul>
              <p className="muted">Base main deck: {HLD_MAIN_DECK_DEFS.reduce((n, d) => n + d.count, 0)} cards.</p>
            </>
          ),
        },
      ]}
    />
  );
}
