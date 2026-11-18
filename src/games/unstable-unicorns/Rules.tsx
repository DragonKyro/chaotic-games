// Unstable Unicorns — in-app RulesBook covering Base Rules, Editions, and all 8 Expansions.

import { RulesBook, RulesGrid, RulesHero, RulesTile } from '@/ui/RulesBook';
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
                <strong>6 Unicorns</strong> in a 6–8 player game). Every player begins with 1 Baby Unicorn from the
                Nursery in their Stable and 5 cards in hand.
              </p>
              <h4>Turn Structure (4 Phases)</h4>
              <RulesGrid cols={2}>
                <RulesTile
                  label="1. Beginning of Turn"
                  hint='Trigger any "at the beginning of your turn" effects in your Stable.'
                  accent="#f97316"
                />
                <RulesTile
                  label="2. Draw Phase"
                  hint="Draw 1 card from the main deck."
                  accent="#3b82f6"
                />
                <RulesTile
                  label="3. Action Phase"
                  hint="Either play 1 card from your hand OR draw 1 extra card."
                  accent="#22c55e"
                />
                <RulesTile
                  label="4. End of Turn"
                  hint="Discard down to your hand limit (default 7 cards) if needed."
                  accent="#eab308"
                />
              </RulesGrid>
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
                  <strong>Neigh &amp; Instant Responses:</strong> Playable out of turn whenever another player plays a
                  card. Resolves LIFO (an odd number of Neighs cancels the card; <em>Super Neigh</em> cannot be Neighed).
                  The <strong>Adventures</strong>, <strong>Control</strong>, <strong>Chaos</strong>, and{' '}
                  <strong>Christmas</strong> sets add special Instant cards like <em>Unicorn Net</em> (capture the played
                  card into your hand), <em>Absorb and Reflect</em> (steal the card + force a discard),{' '}
                  <em>Redirect</em> (redirect the played card to your own Stable or back onto the caster),{' '}
                  <em>Flare Gun</em>, and <em>Jingle All The Neigh</em>.
                </li>
                <li>
                  <strong>Nursery &amp; Baby Unicorns:</strong> If a Baby Unicorn would ever be sacrificed, destroyed, or
                  returned to a hand, it returns to the shared Nursery instead.
                </li>
                <li>
                  <strong>Continuous Modifiers &amp; Dragon&apos;s Blessing:</strong> Upgrades and Downgrades modify
                  rules while in a Stable (<em>Pandamonium</em> turns your Unicorns into Pandas,{' '}
                  <em>Blinding Light</em> disables Unicorn abilities, <em>Rainbow Aura</em> prevents Unicorn
                  destruction, <em>Yay</em> makes your plays un-Neighable). <strong>Dragon&apos;s Blessing</strong>{' '}
                  (&quot;Effects of your Downgrade cards do not affect you&quot;) overrides all Downgrades in your own
                  Stable!
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
                  label="2nd Edition Base Deck (base-2nd)"
                  hint="Official 135-card 2nd Edition deck (13 Baby Unicorns + 114 Main Deck cards + 8 rules cards)."
                  accent="#3b82f6"
                />
                <RulesTile
                  label="1st / Original Print (base)"
                  hint="Includes Extremely Fertile Unicorn, Puppicorn, Zombie Unicorn, Angel Unicorn, Unicorn Shrinkray, Extra Tail, Rainbow Mane, Summoning Ritual, and Unicorn Lasso."
                  accent="#a855f7"
                />
                <RulesTile
                  label="Control & Chaos Editions"
                  hint="Collector's editions featuring Chronocorn, Unicorn of Order, Time Shift, Absorb and Reflect, Unicorn of Chaos, Hell's Steedicorn, Chaos Storm, and Redirect."
                  accent="#f97316"
                />
                <RulesTile
                  label="Diamond & Travel Editions"
                  hint="Diamond adds 2-Unicorn Diamond Unicorns & Prismatic Shield; Travel uses a fast 82-card portable deck."
                  accent="#22c55e"
                />
              </RulesGrid>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', textAlign: 'left' }}>
                    <th style={{ padding: 4 }}>Card</th>
                    <th style={{ padding: 4 }}>Edition</th>
                    <th style={{ padding: 4 }}>Type</th>
                    <th style={{ padding: 4 }}>Effect</th>
                  </tr>
                </thead>
                <tbody>
                  {editionDefs.map((d) => (
                    <tr key={`${d.source}-${d.kind}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: 4 }}><strong>{d.name}</strong></td>
                      <td style={{ padding: 4 }}>{d.source}</td>
                      <td style={{ padding: 4 }}>{d.type}</td>
                      <td style={{ padding: 4 }}>{d.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', textAlign: 'left' }}>
                    <th style={{ padding: 4 }}>Card</th>
                    <th style={{ padding: 4 }}>Expansion</th>
                    <th style={{ padding: 4 }}>Type</th>
                    <th style={{ padding: 4 }}>Effect</th>
                  </tr>
                </thead>
                <tbody>
                  {UU_EXPANSION_DEFS.map((d) => (
                    <tr key={`${d.source}-${d.kind}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: 4 }}><strong>{d.name}</strong></td>
                      <td style={{ padding: 4 }}>{d.source}</td>
                      <td style={{ padding: 4 }}>{d.type}</td>
                      <td style={{ padding: 4 }}>{d.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', textAlign: 'left' }}>
                    <th style={{ padding: 4 }}>Card</th>
                    <th style={{ padding: 4 }}>Type</th>
                    <th style={{ padding: 4 }}>×</th>
                    <th style={{ padding: 4 }}>Effect</th>
                  </tr>
                </thead>
                <tbody>
                  {UU_MAIN_DECK_DEFS.map((d) => (
                    <tr key={d.kind} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: 4 }}><strong>{d.name}</strong></td>
                      <td style={{ padding: 4 }}>{d.type}</td>
                      <td style={{ padding: 4 }}>{d.count}</td>
                      <td style={{ padding: 4 }}>{d.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        },
      ]}
    />
  );
}
