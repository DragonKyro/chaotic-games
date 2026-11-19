// Unstable Unicorns — in-app RulesBook covering Base Rules, Editions, and all 8 Expansions.

import { RulesBook, RulesGrid, RulesHero, RulesTable, RulesTile } from '@/ui/RulesBook';
import {
  UU_BABY_DEFS,
  UU_CHAOS_EDITION_DEFS,
  UU_CONTROL_EDITION_DEFS,
  UU_DIAMOND_EDITION_DEFS,
  UU_EXPANSION_DEFS,
  UU_FIRST_EDITION_DEFS,
  UU_MAIN_DECK_DEFS,
  UU_TRAVEL_EDITION_DEFS,
} from './cards';
import { UU_EXPANSIONS } from './types';

export function Rules() {
  const totalMain = UU_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0);
  const totalBabies = UU_BABY_DEFS.reduce((s, d) => s + d.count, 0);
  const editionDefs = [
    ...UU_FIRST_EDITION_DEFS,
    ...UU_CONTROL_EDITION_DEFS,
    ...UU_CHAOS_EDITION_DEFS,
    ...UU_DIAMOND_EDITION_DEFS,
    ...UU_TRAVEL_EDITION_DEFS,
  ];

  return (
    <RulesBook
      pages={[
        {
          title: 'Overview & Turn Phases',
          body: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
              <RulesHero
                title="Unstable Unicorns"
                subtitle="Build a Unicorn army. Betray your friends. Unicorns are your friends now."
                accent="linear-gradient(135deg, #3b82f6, #a855f7)"
              />
              <p>
                Be the first player to collect <strong>7 Unicorns</strong> in your Stable (or{' '}
                <strong>6 Unicorns</strong> in a 6–8 player game). Everyone is dealt 5 cards, then each player{' '}
                <strong>chooses</strong> a Baby Unicorn from the Nursery to start their Stable.
              </p>
              <h4>Turn Structure (4 Phases)</h4>
              <RulesGrid cols={2}>
                <RulesTile
                  label="1. Beginning of Turn"
                  hint='"If this card is in your Stable at the beginning of your turn" effects trigger. They happen simultaneously: you are asked about each, in no order of your choosing.'
                  accent="#f97316"
                />
                <RulesTile
                  label="2. Draw Phase"
                  hint="Draw 1 card from the deck. (Diamond Edition rolls the Diamond dice first.)"
                  accent="#3b82f6"
                />
                <RulesTile
                  label="3. Action Phase"
                  hint="Either play 1 card from your hand OR draw 1 card. (Double Dutch: up to 2 plays.)"
                  accent="#22c55e"
                />
                <RulesTile
                  label="4. End of Turn"
                  hint="Discard down to your hand limit (7 unless a card says otherwise). You choose what to discard."
                  accent="#eab308"
                />
              </RulesGrid>
              <h4>If the deck runs out</h4>
              <p>
                When someone has to draw from an empty deck, the game ends: the player with the most Unicorns wins. A tie goes to
                whoever has the most letters in the names of their Unicorn cards; a tie on both means everyone loses.
              </p>
              <h4>2-player games</h4>
              <p>
                The official 2-player rules are on by default (toggle in the lobby): every Basic Unicorn, plus Queen Bee,
                Seductive, Rainbow, Mother Goose and Necromancer Unicorn, Nanny Cam, Sadistic Ritual, Slowdown and Yay leave the
                2nd Edition deck, and each player starts with a Neigh on top of their 5 cards. The Original Base Deck removes its
                own list (Basics, Extremely Fertile, Seductive, Queen Bee, Nanny Cam, Sadistic Ritual, Slowdown, Yay).
              </p>
            </div>
          ),
        },
        {
          title: 'Core & Expansion Mechanics',
          body: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
              <RulesHero
                title="Key Mechanics & Interactions"
                subtitle="Instant reaction chains, the Nursery, and continuous Stable modifiers"
                accent="linear-gradient(135deg, #ef4444, #f97316)"
              />
              <ul>
                <li>
                  <strong>Neigh:</strong> Played out of turn whenever <em>another</em> player plays a card from their hand,
                  and can itself be Neigh&apos;d: an odd number of Neighs stops the card. <em>Super Neigh</em> cannot be
                  Neigh&apos;d. Neighs only stop cards being played: effects already in a Stable (and cards brought straight into
                  a Stable) can&apos;t be Neigh&apos;d. Ginormous Unicorn and Slowdown stop you playing Neighs; Yay makes your
                  cards un-Neigh-able.
                </li>
                <li>
                  <strong>Where cards go:</strong> Unicorn, Upgrade and Downgrade cards can be played into <em>any</em>{' '}
                  player&apos;s Stable; their effects belong to whoever&apos;s Stable they are in. <strong>Queen Bee Unicorn</strong>:
                  Basic Unicorns can&apos;t enter any Stable but hers, whether played, brought, or stolen.
                </li>
                <li>
                  <strong>Playing a card needs its effect to be possible:</strong> a Magic card whose mandatory effect you
                  can&apos;t carry out can&apos;t be played (e.g. Mystical Vortex with no other card in hand, Blatant Thievery
                  when no one else has a card, Unicorn Poison with nothing destroyable). Unicorn cards can always be played.
                </li>
                <li>
                  <strong>&quot;May&quot; vs. mandatory, and &quot;then&quot;:</strong> without &quot;may&quot; an effect is
                  mandatory (Mermaid Unicorn must return a card). After &quot;then&quot;, the second part only happens if the
                  first did. Impossible actions (discard with an empty hand...) are simply skipped.
                </li>
                <li>
                  <strong>Sacrifice / Destroy / Steal:</strong> sacrifice is from your own Stable, destroy from another&apos;s,
                  steal moves a card from another Stable into yours. A stolen Unicorn&apos;s &quot;when this card enters your
                  Stable&quot; effect triggers for its new owner.
                </li>
                <li>
                  <strong>Nursery &amp; Baby Unicorns:</strong> If a Baby Unicorn would ever be sacrificed, destroyed, or
                  returned to a hand, it returns to the shared Nursery instead.
                </li>
                <li>
                  <strong>Continuous modifiers</strong> are read off the Stable as it stands: <em>Pandamonium</em> turns your
                  Unicorns into Pandas (they don&apos;t count toward winning), <em>Blinding Light</em> makes your Unicorns Basic
                  with no effects, <em>Rainbow Aura</em> stops your Unicorns being destroyed.
                </li>
              </ul>
            </div>
          ),
        },
        {
          title: 'Base Editions',
          body: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
              <RulesHero
                title="Base Editions"
                subtitle="Switch between 2nd Edition, 1st Edition, Control, Chaos, Diamond, and Travel"
                accent="linear-gradient(135deg, #6366f1, #22c55e)"
              />
              <RulesGrid cols={2}>
                <RulesTile
                  label="2nd Edition Base Deck"
                  hint="The default: 13 Baby Unicorns + 114 cards (+ 8 reference cards), checked card by card against the official list."
                  accent="#3b82f6"
                />
                <RulesTile
                  label="Diamond Edition"
                  hint="The same deck plus 4 Diamond Unicorns in the Vault. Diamond Phase (after Beginning of Turn): roll the d4 to take one from the Vault, take one from another player, or send another player's or your own back. Diamond Unicorns can't be destroyed, sacrificed, or returned to a hand. Reaper's text is unconfirmed: it has no effect here."
                  accent="#22c55e"
                />
                <RulesTile
                  label="Original Base Deck (Second Print)"
                  hint="The pre-2nd Edition deck: Extremely Fertile, Puppicorn, Zombie and Angel Unicorn, Unicorn Shrinkray, Extra Tail, Rainbow Mane, Summoning Ritual and Unicorn Lasso replace the nine 2nd Edition newcomers. Cards shared with the 2nd Edition keep their 2nd Edition wording here."
                  accent="#a855f7"
                />
                <RulesTile
                  label="Control, Chaos & Travel (approximations)"
                  hint="Not the printed decks: the real Control and Chaos are complete base games of their own, and Travel is a cut-down deck with eight unique cards. These options are rough stand-ins."
                  accent="#f97316"
                />
              </RulesGrid>
              <RulesTable
                columns={['Card', 'Edition', 'Type', 'Effect']}
                rows={editionDefs.map((d) => ({ key: `${d.source}-${d.kind}`, cells: [<strong>{d.name}</strong>, d.source, d.type, d.text] }))}
              />
            </div>
          ),
        },
        {
          title: 'All 8 Expansions',
          body: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
              <RulesHero
                title="8 Official Expansion Packs"
                subtitle="Mix and match any combination of expansions in the game lobby"
                accent="linear-gradient(135deg, #ec4899, #8b5cf6)"
              />
              <p>
                <strong>Heads up:</strong> none of these card pools matches the printed expansion yet. Each borrows a few real card
                names (with unconfirmed effects) and fills out the rest with stand-ins, which is why the lobby marks them unverified.
              </p>
              <RulesGrid cols={2}>
                {UU_EXPANSIONS.map((exp) => (
                  <RulesTile
                    key={exp.id}
                    label={exp.name}
                    hint={exp.summary}
                    accent="#a855f7"
                  />
                ))}
              </RulesGrid>
              <RulesTable
                columns={['Card', 'Expansion', 'Type', 'Effect']}
                rows={UU_EXPANSION_DEFS.map((d) => ({ key: `${d.source}-${d.kind}`, cells: [<strong>{d.name}</strong>, d.source, d.type, d.text] }))}
              />
            </div>
          ),
        },
        {
          title: '2nd Edition Base Card List',
          body: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, lineHeight: 1.45 }}>
              <h4>
                2nd Edition Base Deck ({totalBabies} Babies + {totalMain} Main Deck = {totalBabies + totalMain} playable
                cards)
              </h4>
              <RulesTable
                columns={['Card', 'Type', '×', 'Effect']}
                rows={UU_MAIN_DECK_DEFS.map((d) => ({ key: d.kind, cells: [<strong>{d.name}</strong>, d.type, d.count, d.text] }))}
                numeric={[2]}
              />
            </div>
          ),
        },
      ]}
    />
  );
}
