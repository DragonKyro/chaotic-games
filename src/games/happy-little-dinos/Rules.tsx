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
                <li>A <strong>Disaster</strong> is flipped: Natural, Predatory, Emotional or Meteor.</li>
                <li>Everyone picks one <strong>Point card (0–9)</strong> face-down at the same time, then all are revealed. (No Point card in hand? Discard it and draw 5 new.)</li>
                <li>Point card effects are used from the <strong>lowest value to the highest</strong> (ties: fewest Escape Route points first, then seat order). &ldquo;During this round&rdquo; cards act first; &ldquo;During scoring&rdquo; cards act at scoring.</li>
                <li>Then players may play <strong>Instants &ldquo;during scoring&rdquo;</strong>, one at a time; any play gives everyone another chance.</li>
                <li>The <strong>highest score</strong> collects that many points on the Escape Route (at 5–6 players the top <strong>two</strong> do). The <strong>lowest score</strong> takes the Disaster, and may then discard a card.</li>
                <li>Every surviving dino moves +1 per Disaster it holds, then everyone draws back up to 5.</li>
              </ol>
              <p>
                <strong>Ties:</strong> everyone tied for highest collects. A tie for lowest is <strong>Sudden Death</strong> — the tied players each play another
                Point card and the lowest printed value takes the Disaster (no traits, effects or Instants). If everyone ties, nobody collects and the Disaster goes
                to the bottom of its deck. Score inversions (Mouth Trap, Score Inversion) swap everyone tied for highest with everyone tied for lowest.
              </p>
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
                    hint={c === 'meteor' ? 'Wild: counts as any of the other three.' : `Each dino is good (+) or bad (−) against some types.`}
                  />
                ))}
              </RulesGrid>
              <p>Your Disaster meter shows what you hold; when the next slot glows red, the next Disaster of that type would be fatal.</p>
              <p>
                <strong>2 players:</strong> the rulebook suggests removing every Point card worth 1, 2 or 3 and eliminating only at four Disasters of one type or two
                of each type. It's on by default (lobby option).
              </p>
            </>
          ),
        },
        {
          title: 'Dinosaurs',
          body: (
            <>
              <p>
                {HLD_DINO_DEFS.length} boards: four in the base game, Pterry Dactyl and Raging Raptor with the 5–6 Player Expansion, Easygoing Anky and Moody
                Mosasaur with Hazards Ahead. Each board's traits add to or subtract from your score when that Disaster type is face-up. Against a Meteor only a
                Meteor trait (Stego's) applies. Pick yours in the lobby, or switch before your first card.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {HLD_DINO_DEFS.map((d) => <DinoCard key={d.id} dino={d.id} />)}
              </div>
            </>
          ),
        },
        {
          title: 'Expansions',
          body: (
            <>
              <ul>
                {HLD_EXPANSIONS.map((e) => (
                  <li key={e.id}><strong>{e.name}:</strong> {e.summary}</li>
                ))}
              </ul>
              <p>5–6 players need the 5–6 Player Expansion or Hazards Ahead (each adds two boards).</p>
              <p>
                <strong>Hazards Ahead</strong>&rsquo;s Lucky Day Disasters (Fruit Shower, Treasure Trove, Wishful Thinking, One Of Us) go to the bottom of the deck
                instead of your area and give you something. Its Hazard tokens and its {HLD_HAZARD_CARD_DEFS.length} Hazard cards
                ({HLD_HAZARD_CARD_DEFS.map((h) => h.name).join(', ')}) are <em>not modeled</em>: their rulebook isn&rsquo;t available, so every
                &ldquo;Hazard token / Hazard card&rdquo; clause does nothing here.
              </p>
              <p className="muted">Base main deck: {HLD_MAIN_DECK_DEFS.reduce((n, d) => n + d.count, 0)} cards.</p>
            </>
          ),
        },
        {
          title: 'House calls',
          body: (
            <>
              <p>Where the rules don&rsquo;t say, this app decides:</p>
              <ul>
                <li>Effect-order ties the rulebook breaks by &ldquo;youngest player&rdquo; go by seat order.</li>
                <li>Against a Meteor, only Meteor traits count.</li>
                <li>Voodoo Dino, Joy of Puberty and Spiteful Bullying put all their points on one chosen player.</li>
                <li>Dating Disasters&rsquo; &ldquo;you may add 1 point per…&rdquo; bonus is taken automatically; you&rsquo;re offered to turn it down only while scores are inverted (the only time it could hurt).</li>
                <li>Whoever loses Sudden Death may still play a Disaster-saving Instant.</li>
                <li>If two dinos pass the goal on the same move, the one further along wins (then the one with fewer Disasters).</li>
              </ul>
            </>
          ),
        },
      ]}
    />
  );
}
