// Exploding Kittens — base deck composition, card metadata, setup dealer.
//
// ============================================================================
// DECK COMPOSITION — 56 cards
// ============================================================================
// The box advertises 56 cards. The per-type counts below are the standard
// composition and are internally consistent with that total:
//
//   Exploding Kitten     4      \
//   Defuse               6       > removed from the deck during setup
//                               /
//   Nope                 5      \
//   Attack               4       |
//   Skip                 4       |  26 "action" cards
//   Favor                4       |
//   Shuffle              4       |
//   See the Future       5      /
//
//   Taco Cat             4      \
//   Rainbow-Ralphing Cat 4       |
//   Cattermelon          4       |  20 cat cards (combo fodder, no ability)
//   Hairy Potato Cat     4       |
//   Beard Cat            4      /
//                       ---
//                        56
//
// Cross-check: 56 − 4 kittens − 6 defuse = 46 dealable cards; 46 − 20 cats = 26
// action cards, which is exactly 5+4+4+4+4+5. Both totals land, which is good
// evidence the split is right.
//
// ⚠ Sourced from knowledge of the game, NOT from the rulebook — explodingkittens.com,
// BGG and every rules mirror returned 503/403 when this was written. Spot-check
// against the physical box when convenient; if a count is off, fix it HERE and
// nothing else needs to change.

import type { RngState } from '@/core/rng';
import { rngInt, shuffle } from '@/core/rng';
import type { Seat } from '@/core/types';
import type { EkBaseCardKind, EkCard, EkComboKind } from './types';

// ============================================================================
// Composition
// ============================================================================

/** Copies of each card in the full 56-card base deck. */
export const BASE_DECK_COUNTS: Record<EkBaseCardKind, number> = {
  explodingKitten: 4,
  defuse: 6,
  nope: 5,
  attack: 4,
  skip: 4,
  favor: 4,
  shuffle: 4,
  seeTheFuture: 5,
  tacoCat: 4,
  rainbowRalphingCat: 4,
  cattermelon: 4,
  hairyPotatoCat: 4,
  beardCat: 4,
};

export const TOTAL_BASE_CARDS = Object.values(BASE_DECK_COUNTS).reduce((a, b) => a + b, 0);

/** The five powerless cat cards. They exist only as combo fodder. */
export const CAT_KINDS: readonly EkBaseCardKind[] = [
  'tacoCat', 'rainbowRalphingCat', 'cattermelon', 'hairyPotatoCat', 'beardCat',
];

export function isCatKind(kind: EkBaseCardKind): boolean {
  return CAT_KINDS.includes(kind);
}

/** Cards dealt into opening hands — everything except kittens and defuses. */
const DEALABLE_KINDS = (Object.keys(BASE_DECK_COUNTS) as EkBaseCardKind[])
  .filter((k) => k !== 'explodingKitten' && k !== 'defuse');

// ============================================================================
// Display metadata
// ============================================================================

export const CARD_LABEL: Record<EkBaseCardKind, string> = {
  explodingKitten: 'Exploding Kitten',
  defuse: 'Defuse',
  nope: 'Nope',
  attack: 'Attack',
  skip: 'Skip',
  favor: 'Favor',
  shuffle: 'Shuffle',
  seeTheFuture: 'See the Future',
  tacoCat: 'Taco Cat',
  rainbowRalphingCat: 'Rainbow-Ralphing Cat',
  cattermelon: 'Cattermelon',
  hairyPotatoCat: 'Hairy Potato Cat',
  beardCat: 'Beard Cat',
};

export const CARD_TEXT: Record<EkBaseCardKind, string> = {
  explodingKitten: 'You explode and are out of the game — unless you can play a Defuse.',
  defuse: 'Play this when you draw an Exploding Kitten to neutralise it, then secretly put the kitten back anywhere in the deck.',
  nope: 'Stop any action except an Exploding Kitten or a Defuse. Playable at any time, even out of turn. A Nope can be Noped.',
  attack: 'End your turn without drawing, and force the next player to take two turns.',
  skip: 'End one of your turns without drawing a card.',
  favor: 'Force one player to give you a card of their choosing.',
  shuffle: 'Shuffle the draw pile.',
  seeTheFuture: 'Privately peek at the top three cards of the deck.',
  tacoCat: 'No ability on its own — collect matching cards to play a combo.',
  rainbowRalphingCat: 'No ability on its own — collect matching cards to play a combo.',
  cattermelon: 'No ability on its own — collect matching cards to play a combo.',
  hairyPotatoCat: 'No ability on its own — collect matching cards to play a combo.',
  beardCat: 'No ability on its own — collect matching cards to play a combo.',
};

/** Cards that resolve an effect when played from hand on your turn. */
export function isPlayableAction(kind: EkBaseCardKind): boolean {
  return kind === 'attack' || kind === 'skip' || kind === 'favor'
    || kind === 'shuffle' || kind === 'seeTheFuture';
}

/**
 * Nope stops any action EXCEPT an Exploding Kitten or a Defuse. Everything a
 * player can voluntarily play on their turn is nope-able.
 */
export function isNopeable(kind: EkBaseCardKind): boolean {
  return kind !== 'explodingKitten' && kind !== 'defuse';
}

// ============================================================================
// AI card valuation
// ============================================================================
// Used when choosing what to hand over to a Favor, what to steal, and what to
// pull out of the discard pile. Not part of the rules.

export const CARD_VALUE: Record<EkBaseCardKind, number> = {
  defuse: 10,          // survival
  nope: 7,             // denies a whole play
  skip: 5,             // dodges one draw
  attack: 4.5,         // dodges a draw AND loads the next player
  seeTheFuture: 3,     // converts a gamble into a decision
  shuffle: 2.5,        // re-rolls a known-bad deck
  favor: 2.5,          // net +1 card, but the target picks
  tacoCat: 1,
  rainbowRalphingCat: 1,
  cattermelon: 1,
  hairyPotatoCat: 1,
  beardCat: 1,
  explodingKitten: 0,  // never desirable to hold in the base game
};

// ============================================================================
// Combos
// ============================================================================
// Two of a kind  → steal a random card from a chosen player.
// Three of a kind→ name a card type and take it from a chosen player if held.
// Five different → take any card from the discard pile.
//
// ⚠ RULE UNCERTAINTY: the official rules are widely read as allowing combos
// from ANY matching cards (two Skips is a legal pair), with cat cards existing
// purely because they have no other use. That reading is the default here.
// `EkConfig.combosCatsOnly` flips it to cats-only for groups that play it that
// way. Confirm against the rulebook and then drop the option.

/** Does this set of cards form a legal combo? Returns the kind, or null. */
export function detectCombo(cards: EkCard[], catsOnly: boolean): EkComboKind | null {
  if (cards.length === 2 || cards.length === 3) {
    const [first] = cards;
    if (!first) return null;
    if (catsOnly && !isCatKind(first.kind)) return null;
    const allSame = cards.every((c) => c.kind === first.kind);
    if (!allSame) return null;
    return cards.length === 2 ? 'pair' : 'triple';
  }
  if (cards.length === 5) {
    const kinds = new Set(cards.map((c) => c.kind));
    if (kinds.size !== 5) return null;
    if (catsOnly && cards.some((c) => !isCatKind(c.kind))) return null;
    return 'fiveDifferent';
  }
  return null;
}

// ============================================================================
// Setup
// ============================================================================

export interface DealtSetup {
  deck: EkCard[];
  hands: Record<string, EkCard[]>;
}

/**
 * Full setup per the rulebook:
 *   1. Set aside all Exploding Kittens and all Defuses.
 *   2. Shuffle the rest; deal `handSize` cards to each player.
 *   3. Give every player exactly one Defuse.
 *   4. Put (playerCount - 1) Exploding Kittens and the leftover Defuses back
 *      into the deck, then shuffle.
 *
 * The deck therefore always holds one fewer kitten than there are players —
 * exactly one player survives.
 */
export function dealSetup(seats: Seat[], rng: RngState, handSize: number): DealtSetup {
  let nextId = 1;
  const make = (kind: EkBaseCardKind): EkCard => ({ id: nextId++, kind });

  // 1. Build the two set-aside piles and the dealable pool.
  const kittens = Array.from({ length: BASE_DECK_COUNTS.explodingKitten }, () => make('explodingKitten'));
  const defuses = Array.from({ length: BASE_DECK_COUNTS.defuse }, () => make('defuse'));
  const pool: EkCard[] = [];
  for (const kind of DEALABLE_KINDS) {
    for (let i = 0; i < BASE_DECK_COUNTS[kind]; i++) pool.push(make(kind));
  }

  // 2 + 3. Deal hands: handSize random cards plus one guaranteed Defuse each.
  const shuffled = shuffle(rng, pool);
  const hands: Record<string, EkCard[]> = {};
  let cursor = 0;
  seats.forEach((seat, i) => {
    const dealt = shuffled.slice(cursor, cursor + handSize);
    cursor += handSize;
    const defuse = defuses[i];
    hands[seat.id] = defuse ? [...dealt, defuse] : dealt;
  });

  // 4. Deck = undealt pool + (playerCount - 1) kittens + leftover Defuses.
  const leftoverDefuses = defuses.slice(seats.length);
  const kittensInPlay = kittens.slice(0, Math.max(0, seats.length - 1));
  const deck = shuffle(rng, [...shuffled.slice(cursor), ...kittensInPlay, ...leftoverDefuses]);

  return { deck, hands };
}

/** Pick a uniformly random index into a hand, using the replicated RNG. */
export function randomHandIndex(rng: RngState, handSize: number): number {
  return rngInt(rng, handSize);
}
