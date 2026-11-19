// Here to Slay — in-app Rules & Card Reference (Base Game + the unverified expansions).

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
      <h4>Setup</h4>
      <p>
        Each player chooses a <strong>Party Leader</strong>, one at a time; whoever picks last takes the first turn. Your
        leader stays in your Party all game — it can never be swapped, sacrificed, destroyed or stolen. (The Shadow Claw
        sits out 2-player games.) Then everyone is dealt <strong>5 cards</strong> and three Monsters are turned face up.
      </p>

      <h4>Win Conditions</h4>
      <p>
        <strong>Slay 3 Monsters</strong> (you win the moment the third falls), or <strong>end your turn</strong> with a{' '}
        <strong>full Party of distinct classes</strong> — <strong>6 classes</strong> in the Base Game, 7 with Warriors &amp;
        Druids. Your Party Leader and Mask items count. A full Party only wins if it is still full when your own turn
        ends. When playing with <strong>Here to Sleigh</strong>, you can also win by collecting <strong>3 Nice List Gifts</strong>.
      </p>

      <h4>Action Points (3 AP per turn, or 4 AP with Mega Slime)</h4>
      <ul>
        <li><strong>1 AP:</strong> Draw 1 card from the deck.</li>
        <li><strong>1 AP:</strong> Play a Hero, Item, or Magic card from your hand (playing a Hero lets you roll for its ability immediately, for free).</li>
        <li><strong>1 AP:</strong> Roll 2d6 to use a Hero&apos;s ability in your Party (once per turn per Hero, even if the roll fails).</li>
        <li><strong>2 AP:</strong> Roll 2d6 to ATTACK a Monster card in the center row.</li>
        <li><strong>3 AP:</strong> Discard your entire hand and draw 5 new cards.</li>
      </ul>
      <p>There is no hand limit. A card effect that says &ldquo;immediately&rdquo; costs no extra action point.</p>

      <h4>Monsters</h4>
      <p>
        To attack you must meet the Monster&apos;s Party requirement. A class symbol is met by a Hero of that class{' '}
        <em>or</em> your Party Leader; every other symbol needs a Hero of any class (your leader is not a Hero). Roll at or
        above the slay number to SLAY it; roll in its danger range and you pay its penalty.
      </p>

      <h4>Challenges &amp; Modifiers</h4>
      <p>
        Whenever a player plays a Hero, Item, or Magic card from their hand — with an action point, or
        &ldquo;immediately&rdquo; through a card effect — any other player may play a <strong>Challenge</strong> card. Both
        players roll 2d6; if the challenger&apos;s total is equal to or higher, the card is discarded (the action point is
        not refunded). A card can only be challenged once. Any player may play any number of{' '}
        <strong>Modifier</strong> cards (+4, +3/-1, +2/-2, +1/-3, -4) on any roll, choosing the value as they play it; in a
        Challenge, you also choose which of the two rolls to change.
      </p>

      <h4>Expansions (unverified)</h4>
      <p>
        <strong>These three do not match the published expansions yet.</strong> Their card lists and card text were
        written before they could be checked against the official sets, and the official inventories list different
        cards. Play them as house variants.
      </p>
      <ul>
        <li>
          <strong>Warriors &amp; Druids ({HTS_WARRIORS_DRUIDS_DECK_DEFS.reduce((s, d) => s + d.count, 0)} main-deck cards):</strong>{' '}
          Warriors that can hold up to 2 Items (one Mask at most) and Druids that succeed on a <strong>low</strong> roll
          (<code>≤6</code>, <code>≤7</code>) — both confirmed by the official rulesheet — plus leaders and monsters that
          are not yet the published ones.
        </li>
        <li>
          <strong>Berserkers &amp; Necromancers ({HTS_BERSERKERS_NECROMANCERS_DECK_DEFS.reduce((s, d) => s + d.count, 0)} main-deck cards):</strong>{' '}
          Hero destroyers and grave-callers, with <em>The Raging Manticore</em> and <em>The Gnawing Dread</em> (who can
          spend 2 AP to take any card from the discard pile).
        </li>
        <li>
          <strong>Here to Sleigh ({HTS_SLEIGH_DECK_DEFS.reduce((s, d) => s + d.count, 0)} main-deck cards + Holiday Gifts):</strong>{' '}
          Holiday Heroes and a Nice List Gift win (collect 3 Nice Gifts).
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
