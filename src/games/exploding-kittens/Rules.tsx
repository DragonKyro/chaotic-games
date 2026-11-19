// Exploding Kittens — the in-app rules book. Opened by the 📖 Rules button in
// both the lobby and the game (the shell renders it in a modal whenever a
// module's UI bundle exports `Rules`).
//
// Doubles as the reference for what THIS implementation does, including the two
// places where the rules are ambiguous and we had to pick a reading.

import { RulesTable } from '@/ui/RulesBook';
import { Card } from './Card';
import {
  BARKING_DECK_COUNTS,
  BASE_DECK_COUNTS,
  CARD_LABEL,
  CARD_TEXT,
  IMPLODING_DECK_COUNTS,
  STREAKING_DECK_COUNTS,
  TOTAL_BASE_CARDS,
  ZOMBIE_DECK_COUNTS,
} from './cards';
import type { EkBaseCardKind, EkCoreCardKind } from './types';

const ORDER: EkCoreCardKind[] = [
  'explodingKitten', 'defuse', 'nope', 'attack', 'skip', 'favor', 'shuffle', 'seeTheFuture',
  'tacoCat', 'rainbowRalphingCat', 'cattermelon', 'hairyPotatoCat', 'beardCat',
];

const CATS: EkCoreCardKind[] = [
  'tacoCat', 'rainbowRalphingCat', 'cattermelon', 'hairyPotatoCat', 'beardCat',
];

const KITTENS: readonly EkBaseCardKind[] = ['explodingKitten', 'implodingKitten'];

/** Card kinds with their counts and effects, plus a total row. */
function CountTable({ counts }: { counts: Partial<Record<EkBaseCardKind, number>> }) {
  const entries = Object.entries(counts) as [EkBaseCardKind, number][];
  const total = entries.reduce((sum, [, n]) => sum + n, 0);
  return (
    <RulesTable
      columns={['Card', '×', 'What it does']}
      numeric={[1]}
      rows={[
        ...entries.map(([kind, count]) => ({
          key: kind,
          cells: [CARD_LABEL[kind], count, CARD_TEXT[kind]],
          tone: KITTENS.includes(kind) ? ('bad' as const) : undefined,
        })),
        { key: 'total', cells: ['Total', total, null], tone: 'total' as const },
      ]}
    />
  );
}

export function Rules() {
  return (
    <div className="ek-rules">
      <h4>The point</h4>
      <p>
        Draw cards until someone draws an Exploding Kitten. They explode and are out.
        The last player alive wins. Everything else in the deck exists to push the
        kitten towards somebody else.
      </p>

      <h4>Your turn</h4>
      <ol>
        <li>Play as many cards as you like, or none at all.</li>
        <li>
          <strong>End your turn by drawing a card</strong> from the top of the deck.
          Drawing is not optional — it is how a turn ends. The only exceptions are
          Skip and Attack.
        </li>
      </ol>
      <p>
        If the card you draw is an Exploding Kitten you must immediately play a
        Defuse, or you are out of the game and your whole hand goes to the discard
        pile.
      </p>

      <h4>Setup</h4>
      <p>
        Every Exploding Kitten and Defuse is set aside. Each player is dealt a hand
        plus exactly one Defuse. Then <strong>one fewer Exploding Kitten than there
        are players</strong> goes back into the deck along with any leftover Defuses,
        and the deck is shuffled. That is why exactly one player survives.
      </p>

      <h4>Combos</h4>
      <p>Cat cards do nothing on their own. Matching cards do:</p>
      <ul>
        <li><strong>Two of a kind</strong> — steal a random card from a player of your choice.</li>
        <li><strong>Three of a kind</strong> — name a card type; that player must hand it over if they have it.</li>
        <li><strong>Five different cards</strong> — take any card you like out of the discard pile.</li>
      </ul>

      <h4>Nope</h4>
      <p>
        Nope cancels any action except an Exploding Kitten or a Defuse, and can be
        played out of turn. A Nope can be Noped: an <em>odd</em> number of Nopes on a
        play cancels it, an <em>even</em> number means it goes through after all.
      </p>
      <p className="ek-rules-note">
        In this implementation the Nope window is explicit rather than a shouting
        match. Only players actually holding a Nope get asked, and they answer one at
        a time — but any holder may jump in out of order, and each new Nope reopens
        the window for everyone else.
      </p>

      <h4>Card reference (Base Game)</h4>
      <p>
        The base deck is <strong>{TOTAL_BASE_CARDS} cards</strong>.
      </p>
      <CountTable counts={Object.fromEntries(ORDER.map((k) => [k, BASE_DECK_COUNTS[k]]))} />

      <h4>The cats</h4>
      <p>Five kinds, four of each. Powerless alone, dangerous in pairs.</p>
      <div className="ek-rules-cats">
        {CATS.map((kind) => (
          <Card key={kind} kind={kind} size="sm" footnote={`×${BASE_DECK_COUNTS[kind]}`} />
        ))}
      </div>

      <h4>Expansions</h4>
      <p>
        All six expansions can be toggled in the lobby:
      </p>

      <h5>1. Imploding Kittens (+20 cards, up to 6 players)</h5>
      <CountTable counts={IMPLODING_DECK_COUNTS} />

      <h5>2. Streaking Kittens (+15 cards, +1 Exploding Kitten)</h5>
      <CountTable counts={STREAKING_DECK_COUNTS} />

      <h5>3. Barking Kittens (+20 cards)</h5>
      <CountTable counts={BARKING_DECK_COUNTS} />

      <h5>4. Zombie Kittens (Zombie Kitten replaces Defuse)</h5>
      <CountTable counts={ZOMBIE_DECK_COUNTS} />

      <h5>5. Party Pack (Up to 10 players)</h5>
      <p>
        Doubles the action and cat card pool to support up to 10 players and includes
        the Imploding Kittens mechanics.
      </p>

      <h5>6. Recipes for Disaster (Up to 6 players)</h5>
      <p>
        Compiles the best action cards from the Base Game, Imploding Kittens,
        Streaking Kittens, and Barking Kittens into a combined chaos deck.
      </p>

      <h4>Where we had to make a call</h4>
      <ul>
        <li>
          <strong>Combos from any matching cards.</strong> The rules are widely read as
          allowing any two matching cards to form a pair, not just cats — that is the
          default here. The lobby has a toggle to restrict combos to cat cards if your
          group plays it the other way.
        </li>
        <li>
          <strong>Attack stacking.</strong> Playing Attack ends your turns immediately
          and the next player owes two turns <em>plus</em> any turns you still owed. So
          being attacked and answering with your own Attack passes on three.
        </li>
      </ul>

      <h4>Fair play online</h4>
      <p>
        Every player's browser holds the whole game state, deck order included, so a
        determined person could go looking. Nothing in the interface will ever show
        it, and the AI is written to only use what it has legitimately seen — but this
        is a friends-only game with no anti-cheat. Play nicely.
      </p>
    </div>
  );
}
