// Here to Slay — in-app Rules & Card Reference.

import { HTS_MAIN_DECK_DEFS, HTS_MONSTER_DEFS, HTS_PARTY_LEADERS } from './cards';

export function Rules() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
      <h4>Win Conditions</h4>
      <p>
        Be the first player to either <strong>slay 3 Monsters</strong> OR assemble a{' '}
        <strong>full Party of 6 different classes</strong> (Fighter, Bard, Guardian, Ranger, Thief, Wizard — your Party
        Leader&apos;s class counts!).
      </p>

      <h4>Action Points (3 AP per turn)</h4>
      <ul>
        <li><strong>1 AP:</strong> Draw 1 card from the deck.</li>
        <li><strong>1 AP:</strong> Play a Hero, Item, or Magic card from your hand (playing a Hero lets you roll 2d6 for its ability immediately for free).</li>
        <li><strong>1 AP:</strong> Roll 2d6 to use a Hero&apos;s ability in your Party (once per turn per Hero).</li>
        <li><strong>2 AP:</strong> Roll 2d6 to ATTACK a Monster card in the center row.</li>
        <li><strong>3 AP:</strong> Discard your entire hand and draw 5 new cards.</li>
      </ul>

      <h4>Challenges &amp; Modifiers</h4>
      <p>
        When a player plays a Hero, Item, or Magic card, any opponent may play a <strong>Challenge</strong> card. Both
        players roll 2d6; if the challenger&apos;s total is equal to or higher than the player&apos;s total, the card is
        discarded! Any player may play <strong>Modifier</strong> cards (+4, +3/-1, +2/-2, +1/-3, -4) on any dice roll.
      </p>

      <h4>Party Leaders ({HTS_PARTY_LEADERS.length}) &amp; Monsters ({HTS_MONSTER_DEFS.length}) &amp; Main Deck ({HTS_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0)} cards)</h4>
      <p>All 6 Party Leaders, 15 Monsters, 48 Heroes, 15 Items/Cursed Items, 13 Magic cards, 25 Modifiers, and 14 Challenges from the Base Game are included.</p>
    </div>
  );
}
