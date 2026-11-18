// Here to Slay — in-app Rules & Card Reference (Base Game + All 3 Expansions).

import {
  HTS_ALL_PARTY_LEADERS,
  HTS_BERSERKERS_NECROMANCERS_DECK_DEFS,
  HTS_MAIN_DECK_DEFS,
  HTS_MONSTER_DEFS,
  HTS_PARTY_LEADERS,
  HTS_SLEIGH_DECK_DEFS,
  HTS_WARRIORS_DRUIDS_DECK_DEFS,
} from './cards';

export function Rules() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, lineHeight: 1.45 }}>
      <h4>Win Conditions</h4>
      <p>
        Be the first player to either <strong>slay 3 Monsters</strong> OR assemble a{' '}
        <strong>full Party of distinct classes</strong> (<strong>6 classes</strong> in the Base Game, or{' '}
        <strong>7 classes</strong> when playing with Warriors &amp; Druids or Berserkers &amp; Necromancers — your Party
        Leader and Mask items count!). When playing with <strong>Here to Sleigh</strong>, you can also win by collecting{' '}
        <strong>3 Nice List Gifts</strong>!
      </p>

      <h4>Action Points (3 AP per turn, or 4 AP with Mega Slime)</h4>
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

      <h4>Expansions</h4>
      <ul>
        <li>
          <strong>Warriors &amp; Druids ({HTS_WARRIORS_DRUIDS_DECK_DEFS.reduce((s, d) => s + d.count, 0)} main-deck cards):</strong>{' '}
          Adds <strong>Warriors</strong> (who scale off equipped Items and can equip up to 2 Items on heroes like{' '}
          <em>Agile Dagger</em> and <em>Mightyvis</em>, led by <em>The Piercing Howl</em>) and <strong>Druids</strong>{' '}
          (who have <strong>low-roll thresholds</strong> like <code>≤6</code> or <code>≤7</code> where you must roll at
          or below the target number to succeed, led by <em>The Noble Shaman</em>) plus <em>Feral Dragon</em> and{' '}
          <em>Muscipula</em>.
        </li>
        <li>
          <strong>Berserkers &amp; Necromancers ({HTS_BERSERKERS_NECROMANCERS_DECK_DEFS.reduce((s, d) => s + d.count, 0)} main-deck cards):</strong>{' '}
          Adds <strong>Berserkers</strong> (ferocious Hero destroyers led by <em>The Raging Manticore</em> who draws 2
          cards every time you destroy a Hero, plus <em>Venomous Gemini</em>) and <strong>Necromancers</strong>{' '}
          (grave-callers who revive Heroes directly from the discard pile into your Party or hand, led by{' '}
          <em>The Gnawing Dread</em> who can spend 2 AP to tutor any card from the discard pile, plus{' '}
          <em>Clawed Nightmare</em>).
        </li>
        <li>
          <strong>Here to Sleigh ({HTS_SLEIGH_DECK_DEFS.reduce((s, d) => s + d.count, 0)} main-deck cards + Holiday Gifts):</strong>{' '}
          Adds holiday Party Leaders (<em>The Festive Noel</em>, <em>The Holly Spirit</em>), Holiday Heroes, Items
          (<em>Milk and Cookies</em>, <em>Freshly Sharpened Skates</em>), Holiday Monsters, and the{' '}
          <strong>Nice List Gift</strong> win condition (collect 3 Nice Gifts to win!).
        </li>
      </ul>

      <h4>Card Pool Summary</h4>
      <p>
        Base Game ({HTS_PARTY_LEADERS.length} Party Leaders, {HTS_MONSTER_DEFS.length} Monsters,{' '}
        {HTS_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0)} Main Deck cards) + 3 Expansions ({HTS_ALL_PARTY_LEADERS.length}{' '}
        total Leaders).
      </p>
    </div>
  );
}
