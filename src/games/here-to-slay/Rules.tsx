// Here to Slay — in-app Rules & Card Reference (base game + expansions).

import {
  HTS_ALL_PARTY_LEADERS,
  HTS_BERSERKERS_NECROMANCERS_DECK_DEFS,
  HTS_MAIN_DECK_DEFS,
  HTS_MONSTER_DEFS,
  HTS_PARTY_LEADERS,
  HTS_SLEIGH_DECK_DEFS,
  HTS_WARRIORS_DRUIDS_DECK_DEFS,
} from './cards';

const count = (defs: readonly { count: number }[]) => defs.reduce((s, d) => s + d.count, 0);

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
        <strong>full Party of distinct classes</strong> — <strong>6 classes</strong> in the Base Game,{' '}
        <strong>7</strong> with Warriors &amp; Druids or Berserkers &amp; Necromancers. Your Party Leader and Mask items count. A full Party only wins if it
        is still full when your own turn ends. When playing with <strong>Here to Sleigh</strong>, you can also win by
        collecting <strong>3 Nice List Gifts</strong>.
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

      <h4>Warriors &amp; Druids ({count(HTS_WARRIORS_DRUIDS_DECK_DEFS)} cards, 2 Party Leaders, 2 Monsters)</h4>
      <p>
        Built from the official card list and card pages. With it in the game you need <strong>7 classes</strong> to win.
      </p>
      <ul>
        <li>
          <strong>Druids</strong> need <strong>low</strong> rolls: a Druid marked <code>7-</code> succeeds on 7 or lower
          (Modifiers and bonuses still count, so a +2 hurts).
        </li>
        <li>
          <strong>Warriors</strong> with the two-Item symbol (Agile Dagger, Critical Fang) can carry two Items — each still
          costs an action point, and at most one may be a Mask.
        </li>
        <li>
          <strong>Druid / Warrior Challenge</strong>: playable only with that class in your Party; +3 to your Challenge roll.
        </li>
        <li>
          Highlights: Big Buckley attacks a Monster for free; Buck Omens takes a Hero from another player&apos;s hand into your
          Party; Maegisty sends your Heroes back to your hand instead of the discard pile until your next turn; Majestelk
          gives +5 or −5 to each of your rolls (you choose each time); Bottomless Bag lets a Hero roll again for another
          action point; Soul Tether and Cursed Glove chain your Heroes&apos; fates; Feral Dragon draws a card for every
          sacrifice at the table; Muscipula Rex gives a free draw each turn.
        </li>
      </ul>

      <h4>Berserkers &amp; Necromancers ({count(HTS_BERSERKERS_NECROMANCERS_DECK_DEFS)} cards, 2 Party Leaders, 2 Monsters)</h4>
      <p>
        Built from the official card list and card pages. With it in the game you need <strong>7 classes</strong> to win.
      </p>
      <ul>
        <li>
          <strong>Berserkers</strong> with the two-Item symbol (Meowntain, Vicious Wildcat) can carry two Items, at most one
          a Mask.
        </li>
        <li>
          <strong>Necromancers</strong> often start with a cost — &ldquo;DISCARD a card&rdquo;, &ldquo;SACRIFICE a Hero
          card&rdquo;, &ldquo;SACRIFICE an Item card&rdquo;. You must pay it to use the rest of the effect; if you can&apos;t,
          nothing else happens.
        </li>
        <li>
          <strong>SACRIFICE a card</strong> (Grim Pupper, Meowntain, Rabid Beast, Brawling Spirit) means a Hero (its Items go
          with it) or a single Item equipped in your Party. <strong>Berserker / Necromancer Challenge</strong>: needs that
          class in your Party; +3 to your Challenge roll.
        </li>
        <li>
          Highlights: Vicious Wildcat slays any Monster outright, then your turn ends; Roaryal Guard sends every Hero of a
          class back to its player&apos;s hand; Biggest Ring Ever trades up to 3 cards from your hand for +2 each on its
          Hero&apos;s roll; Goblet of Caffeination is sacrificed for a second try; Modifier +7 costs your whole hand; the
          B&amp;N Modifier +2/-2 is +4 on your own Monster attack; Doombringer lets you take a card from the discard pile
          each time you sacrifice one.
        </li>
      </ul>

      <h4>Expansion not yet rebuilt (unverified)</h4>
      <ul>
        <li>
          <strong>Here to Sleigh ({count(HTS_SLEIGH_DECK_DEFS)} main-deck cards + Holiday Gifts):</strong> Holiday Heroes and a
          Nice List Gift win (collect 3 Nice Gifts) — a house variant, not the published Gift / Stockpile rules.
        </li>
      </ul>

      <h4>Unconfirmed rulings</h4>
      <p>No source settles these; the game plays them as described.</p>
      <ul>
        <li>
          Blinding Blade, Looting Lupo, Tenacious Timber, Brawling Spirit, Gruesome Gladiator, Rabid Beast and Unbridled Fury
          hold one Item (no source shows the two-Item symbol on them).
        </li>
        <li>
          &ldquo;SACRIFICE / DESTROY a card&rdquo; never takes a slain Monster card; Brawling Spirit&apos;s &ldquo;cards in
          their Party&rdquo; counts Heroes and their Items (not the Party Leader or Monsters).
        </li>
        <li>Majestelk&apos;s &ldquo;+5 or -5 to each of your rolls&rdquo; is chosen roll by roll, after the dice land.</li>
        <li>The W&amp;D Modifier +4 and -4 (&ldquo;if the roll is modified above 12 / below 2&rdquo;) look at the final total once every Modifier is in.</li>
        <li>A class Challenge&apos;s requirement is met by a Party Leader of that class too, as for a Monster&apos;s class symbol.</li>
        <li>Soulbound Grimoire&apos;s 2 action points apply to the paid roll; a free &ldquo;roll … immediately&rdquo; stays free.</li>
        <li>With both class expansions, a full Party is still 7 classes (each rulesheet says 7); the lobby lets you pick 8.</li>
      </ul>

      <h4>Card Pool Summary</h4>
      <p>
        Base Game ({HTS_PARTY_LEADERS.length} Party Leaders, {HTS_MONSTER_DEFS.length} Monsters,{' '}
        {count(HTS_MAIN_DECK_DEFS)} Main Deck cards) + 3 Expansions ({HTS_ALL_PARTY_LEADERS.length} total Leaders).
      </p>
    </div>
  );
}
