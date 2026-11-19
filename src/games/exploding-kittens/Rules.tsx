// Exploding Kittens — the in-app rules book. Opened by the 📖 Rules button in
// both the lobby and the game (the shell renders it in a modal whenever a
// module's UI bundle exports `Rules`).
//
// Doubles as the reference for what THIS implementation does. Every rule here
// was read off the publisher's rule sheets (file list in types.ts).

import { RulesTable } from '@/ui/RulesBook';
import { Card } from './Card';
import {
  BARKING_DECK_COUNTS,
  BASE_DECK_COUNTS,
  CARD_LABEL,
  CARD_TEXT,
  IMPLODING_DECK_COUNTS,
  PARTY_PACK_COUNTS,
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

/** Party Pack: which cards are used at which player counts. */
function PartyTable() {
  const entries = Object.entries(PARTY_PACK_COUNTS) as [EkBaseCardKind, readonly [number, number]][];
  const sum = (i: 0 | 1) => entries.reduce((n, [, c]) => n + c[i], 0);
  return (
    <RulesTable
      columns={['Card', 'No paw (4–7)', 'Paw (2–3)']}
      numeric={[1, 2]}
      rows={[
        ...entries.map(([kind, [noPaw, paw]]) => ({
          key: kind,
          cells: [CARD_LABEL[kind], noPaw, paw],
          tone: KITTENS.includes(kind) ? ('bad' as const) : undefined,
        })),
        { key: 'total', cells: ['Total (8–10 players use both)', sum(0), sum(1)], tone: 'total' as const },
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
          Drawing is not optional — it is how a turn ends. The exceptions are the
          Skips and the Attacks.
        </li>
      </ol>
      <p>
        If the card you draw is an Exploding Kitten you must immediately play a
        Defuse and secretly put the kitten back anywhere in the deck — or you are
        out. The kitten that got you lies face up in front of you, and the rest of
        your hand face down: out of the game, not in the discard pile.
      </p>

      <h4>Setup</h4>
      <p>
        Set aside the Exploding Kittens and the Defuses. Deal each player one
        Defuse, and shuffle <strong>two</strong> of the spare Defuses back into the
        deck (at 5 players there is only one spare). Deal 7 cards to everyone — a
        hand of 8. Then <strong>one fewer Exploding Kitten than there are
        players</strong> goes into the deck, and it is shuffled. That is why exactly
        one player survives.
      </p>

      <h4>Attacks stack</h4>
      <p>
        Attack ends your turn without drawing, and the next player takes two turns.
        If the <em>victim</em> of an Attack plays one, their remaining turns pass on
        too: the next player takes the attacker's current and untaken turns
        <strong> plus two</strong>. Attacked, then Attack straight away: the next
        player owes 4. Take one of your two turns first, then Attack: they owe 3.
        Skip only ends one of the turns you owe.
      </p>

      <h4>Combos</h4>
      <p>
        Any matching cards make a combo — not just cats: two Skips are a pair. The
        cards' own instructions are ignored.
      </p>
      <ul>
        <li><strong>Two of a kind</strong> — steal a random card from a player of your choice.</li>
        <li><strong>Three of a kind</strong> — name a card; that player must hand it over if they have it.</li>
      </ul>
      <p className="ek-rules-note">
        Older printings also had a <strong>Five different</strong> combo (take any
        card from the discard pile). It is off unless switched on in the lobby. The
        lobby can also restrict combos to cat cards as a house rule.
      </p>

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

      <h4>Card reference (Original Edition)</h4>
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

      <h5>Imploding Kittens (+20 cards, up to 6 players)</h5>
      <p>
        The Imploding Kitten counts as one of the kittens: the deck holds one fewer
        kitten than players in total. The first time it is drawn it goes back face
        up wherever you like; drawing it face up kills you outright.
      </p>
      <CountTable counts={IMPLODING_DECK_COUNTS} />

      <h5>Streaking Kittens (+15 cards)</h5>
      <p>
        Adds an Exploding Kitten, so there are as many kittens as players. Whether
        a Streaking Kitten holds an Exploding Kitten you draw is a standing choice by
        your hand, so the draw itself gives nothing away. Lose the Streaking Kitten
        and the kitten goes off; anyone who steals or is handed an Exploding Kitten
        must Defuse it. A Cursed player picks face-down cards at random — one at a
        time, choosing a target after the card is revealed — until they draw safely.
      </p>
      <CountTable counts={STREAKING_DECK_COUNTS} />

      <h5>Barking Kittens (+20 cards)</h5>
      <p>
        At setup, 6 cards are dealt face down as the Stash for the Tower of Power.
        Barking Kittens cannot be Noped; play both together (or the second while the
        first is in front of you) to pick any target.
      </p>
      <CountTable counts={BARKING_DECK_COUNTS} />

      <h5>Zombie Kittens (+22 cards, up to 5 players)</h5>
      <p>
        The Defuses are removed; everyone gets a Zombie Kitten instead. Dying does
        not take your cards: you keep your hand, may still play Nope and NOW cards,
        and wait to be brought back. You may choose not to play a Zombie Kitten. If
        you play one while anyone is dead you must bring one of them back, and hide
        their kitten in the deck as well as yours. With 2 players, Attack of the Dead,
        Grave Robber, Feed the Dead and Super Skip are left out.
      </p>
      <CountTable counts={ZOMBIE_DECK_COUNTS} />

      <h5>Party Pack (2–10 players)</h5>
      <p>
        A replacement core deck of 120 cards rather than an add-on. 2–3 players use
        only the cards with a paw print, 4–7 only the ones without, 8–10 everything.
        Every spare Defuse goes back into the deck.
      </p>
      <PartyTable />

      <h5>Recipes for Disaster</h5>
      <p className="ek-rules-note">
        Not modeled. The box's 13 recipe booklets are not reproduced here; turning it
        on mixes the Imploding, Streaking and Barking cards it collects into the base
        deck as a stand-in.
      </p>

      <h4>Where this implementation makes a call</h4>
      <ul>
        <li>
          <strong>Personal Attack when attacked.</strong> The card says Attacks stack;
          a victim who plays it takes their owed turns plus three.
        </li>
        <li>
          <strong>Dig Deeper.</strong> The card you put back returns to the top before
          the card beneath it is resolved.
        </li>
        <li>
          <strong>Clairvoyance</strong> shows you where the kittens went; that stays
          true until the deck is shuffled, reordered over them, or something is
          slipped in above them.
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
