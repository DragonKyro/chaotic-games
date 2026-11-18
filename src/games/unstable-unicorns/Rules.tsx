// Unstable Unicorns — in-app Rules & Card Reference for the 2nd Edition Base Game.

import { UU_BABY_DEFS, UU_MAIN_DECK_DEFS } from './cards';

export function Rules() {
  const totalMain = UU_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0);
  const totalBabies = UU_BABY_DEFS.reduce((s, d) => s + d.count, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
      <h4>Objective</h4>
      <p>
        Be the first player to collect <strong>7 Unicorns</strong> in your Stable (or <strong>6 Unicorns</strong> in a
        6–8 player game). Everyone starts with 1 Baby Unicorn from the Nursery and 5 cards in hand.
      </p>

      <h4>Turn Structure (4 Phases)</h4>
      <ol>
        <li><strong>Beginning of Turn Phase:</strong> Trigger any "at the beginning of your turn" effects in your Stable.</li>
        <li><strong>Draw Phase:</strong> Draw 1 card from the deck.</li>
        <li><strong>Action Phase:</strong> Either <strong>play 1 card</strong> from your hand OR <strong>draw 1 extra card</strong>.</li>
        <li><strong>End of Turn Phase:</strong> Discard down to the 7-card hand limit if needed.</li>
      </ol>

      <h4>Key Mechanics</h4>
      <ul>
        <li>
          <strong>Neigh &amp; Super Neigh:</strong> Playable out of turn whenever another player plays a card. Resolves
          LIFO (an odd number of Neighs cancels the card; Super Neigh cannot be Neighed).
        </li>
        <li>
          <strong>Nursery &amp; Baby Unicorns:</strong> If a Baby Unicorn would ever be sacrificed, destroyed, or
          returned to a hand, it returns to the shared Nursery instead.
        </li>
        <li>
          <strong>Continuous Modifiers:</strong> Upgrades and Downgrades modify rules while in a Stable (e.g. Pandamonium
          turns your Unicorns into Pandas, Blinding Light disables Unicorn abilities, Rainbow Aura prevents Unicorn
          destruction, Yay makes your plays un-Neighable).
        </li>
      </ul>

      <h4>2nd Edition Base Deck ({totalBabies} Babies + {totalMain} Main Deck = {totalBabies + totalMain} playable cards)</h4>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
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
  );
}
