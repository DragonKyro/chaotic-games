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
import { shuffle } from '@/core/rng';
import type { Seat } from '@/core/types';
import type {
  EkBaseCardKind,
  EkCard,
  EkComboKind,
  EkCoreCardKind,
  EkExpansionId,
} from './types';

// ============================================================================
// Composition
// ============================================================================

/** Copies of each card in the full 56-card base deck. */
export const BASE_DECK_COUNTS: Record<EkCoreCardKind, number> = {
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

/** Imploding Kittens expansion — 20 cards. */
export const IMPLODING_DECK_COUNTS: Partial<Record<EkBaseCardKind, number>> = {
  implodingKitten: 1,
  reverse: 4,
  drawFromTheBottom: 4,
  alterTheFuture: 4,
  targetedAttack: 3,
  feralCat: 4,
};

/** Streaking Kittens expansion — 15 cards (+1 Exploding Kitten seeded into deck). */
export const STREAKING_DECK_COUNTS: Partial<Record<EkBaseCardKind, number>> = {
  streakingKitten: 1,
  superSkip: 2,
  seeTheFuture5x: 1,
  alterTheFuture5x: 1,
  swapTopAndBottom: 3,
  garbageCollection: 1,
  catomicBomb: 1,
  mark: 3,
  curseOfTheCatButt: 2,
};

/** Barking Kittens expansion — 20 cards. */
export const BARKING_DECK_COUNTS: Partial<Record<EkBaseCardKind, number>> = {
  barkingKitten: 2,
  alterTheFutureNow: 2,
  bury: 2,
  personalAttack: 4,
  shareTheFuture: 2,
  illTakeThat: 4,
  potluck: 2,
  towerOfPower: 1,
  superSkip: 1,
};

/** Zombie Kittens expansion cards (zombieKitten replaces Defuses). */
export const ZOMBIE_DECK_COUNTS: Partial<Record<EkBaseCardKind, number>> = {
  zombieKitten: 5,
  digDeeper: 4,
  clone: 3,
  clairvoyance: 2,
};

/** The five base cat cards plus Feral Cat. They exist only as combo fodder. */
const CAT_KINDS: readonly EkBaseCardKind[] = [
  'tacoCat', 'rainbowRalphingCat', 'cattermelon', 'hairyPotatoCat', 'beardCat', 'feralCat',
];

export function isCatKind(kind: EkBaseCardKind): boolean {
  return CAT_KINDS.includes(kind);
}

export function isDefuseKind(kind: EkBaseCardKind): boolean {
  return kind === 'defuse' || kind === 'zombieKitten';
}

export function maxPlayersForExpansions(expansions: readonly EkExpansionId[]): number {
  if (expansions.includes('party-pack')) return 10;
  if (
    expansions.includes('imploding-kittens')
    || expansions.includes('recipes-for-disaster')
  ) {
    return 6;
  }
  return 5;
}

/** Cards dealt into opening hands in the base game — everything except kittens and defuses. */
const DEALABLE_KINDS = (Object.keys(BASE_DECK_COUNTS) as EkCoreCardKind[])
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
  // Imploding Kittens
  implodingKitten: 'Imploding Kitten',
  reverse: 'Reverse',
  drawFromTheBottom: 'Draw from the Bottom',
  alterTheFuture: 'Alter the Future',
  targetedAttack: 'Targeted Attack',
  feralCat: 'Feral Cat',
  // Streaking Kittens
  streakingKitten: 'Streaking Kitten',
  superSkip: 'Super Skip',
  seeTheFuture5x: 'See the Future (5x)',
  alterTheFuture5x: 'Alter the Future (5x)',
  swapTopAndBottom: 'Swap Top and Bottom',
  garbageCollection: 'Garbage Collection',
  catomicBomb: 'Catomic Bomb',
  mark: 'Mark',
  curseOfTheCatButt: 'Curse of the Cat Butt',
  // Barking Kittens
  barkingKitten: 'Barking Kitten',
  alterTheFutureNow: 'Alter the Future NOW',
  bury: 'Bury',
  personalAttack: 'Personal Attack (3x)',
  shareTheFuture: 'Share the Future',
  illTakeThat: "I'll Take That",
  potluck: 'Potluck',
  towerOfPower: 'Tower of Power',
  // Zombie Kittens
  zombieKitten: 'Zombie Kitten',
  digDeeper: 'Dig Deeper',
  clone: 'Clone',
  clairvoyance: 'Clairvoyance',
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
  // Imploding Kittens
  implodingKitten: 'First draw: reinsert face-up anywhere in the deck. Second draw (while face-up): explode immediately — cannot be Defused!',
  reverse: 'Reverse the order of play and end one of your turns without drawing a card.',
  drawFromTheBottom: 'End your turn by drawing the bottom card from the draw pile instead of the top.',
  alterTheFuture: 'Privately view and rearrange the top three cards of the draw pile in any order.',
  targetedAttack: 'End your turn(s) without drawing and force any chosen player to take two turns.',
  feralCat: 'Counts as any Cat Card when playing a pair, three-of-a-kind, or five-different combo.',
  // Streaking Kittens
  streakingKitten: 'While in your hand, you can secretly hold 1 Exploding Kitten without exploding!',
  superSkip: 'End ALL of your remaining turns without drawing a card.',
  seeTheFuture5x: 'Privately peek at the top five cards of the deck.',
  alterTheFuture5x: 'Privately view and rearrange the top five cards of the deck in any order.',
  swapTopAndBottom: 'Swap the top and bottom cards of the draw pile without looking.',
  garbageCollection: 'Every player must choose 1 card from their hand to shuffle into the draw pile.',
  catomicBomb: 'Move all Exploding Kittens to the top of the deck, shuffle the rest, and end your turn without drawing.',
  mark: 'Pick a target player — one random card in their hand is revealed and stays visible to everyone.',
  curseOfTheCatButt: 'Blind a target player — their hand is kept face-down until they draw a card.',
  // Barking Kittens
  barkingKitten: 'If another player holds the other Barking Kitten, they must Defuse it or explode!',
  alterTheFutureNow: 'Playable at any time (even out of turn) to view and rearrange the top three cards of the deck.',
  bury: 'Draw the top card, look at it, and secretly insert it back anywhere in the deck to end your turn.',
  personalAttack: 'Attack yourself — take 3 turns in a row.',
  shareTheFuture: 'View and rearrange the top three cards of the deck, then show them to the next player.',
  illTakeThat: 'Play in front of another player; the next card they draw goes to you instead.',
  potluck: 'In turn order, each player chooses 1 card from their hand to place on top of the deck.',
  towerOfPower: 'Protect yourself with a 6-card stash; thieves steal from the stash instead of your hand.',
  // Zombie Kittens
  zombieKitten: 'Acts as a Defuse — and if any players are eliminated, brings one chosen dead player back to life!',
  digDeeper: 'Look at the top 2 cards of the deck, take 1 into your hand and put the other back to end your turn.',
  clone: 'Copies the action card beneath it on top of the discard pile.',
  clairvoyance: 'Sense the deck and know whenever and wherever reinserted kittens are placed.',
};

export const ALL_CARD_KINDS = Object.keys(CARD_LABEL) as EkBaseCardKind[];

/** Cards that resolve an effect when played from hand on your turn. */
export function isPlayableAction(kind: EkBaseCardKind): boolean {
  return (
    kind === 'attack'
    || kind === 'skip'
    || kind === 'favor'
    || kind === 'shuffle'
    || kind === 'seeTheFuture'
    // Imploding
    || kind === 'reverse'
    || kind === 'drawFromTheBottom'
    || kind === 'alterTheFuture'
    || kind === 'targetedAttack'
    // Streaking
    || kind === 'superSkip'
    || kind === 'seeTheFuture5x'
    || kind === 'alterTheFuture5x'
    || kind === 'swapTopAndBottom'
    || kind === 'garbageCollection'
    || kind === 'catomicBomb'
    || kind === 'mark'
    || kind === 'curseOfTheCatButt'
    // Barking
    || kind === 'barkingKitten'
    || kind === 'alterTheFutureNow'
    || kind === 'bury'
    || kind === 'personalAttack'
    || kind === 'shareTheFuture'
    || kind === 'illTakeThat'
    || kind === 'potluck'
    || kind === 'towerOfPower'
    // Zombie
    || kind === 'digDeeper'
    || kind === 'clone'
    || kind === 'clairvoyance'
  );
}

/** Single-card actions that require choosing a live target player. */
export function needsTargetForKind(kind: EkBaseCardKind): boolean {
  return (
    kind === 'favor'
    || kind === 'targetedAttack'
    || kind === 'mark'
    || kind === 'curseOfTheCatButt'
    || kind === 'illTakeThat'
  );
}

// ============================================================================
// AI card valuation
// ============================================================================
// Used when choosing what to hand over to a Favor, what to steal, and what to
// pull out of the discard pile. Not part of the rules.

export const CARD_VALUE: Record<EkBaseCardKind, number> = {
  defuse: 10,          // survival
  zombieKitten: 10,    // survival + resurrection
  streakingKitten: 9,  // lets you hold an Exploding Kitten safely
  nope: 7,             // denies a whole play
  superSkip: 6.5,      // dodges all owed draws
  catomicBomb: 6,      // stacks all kittens on top and ends turn
  targetedAttack: 5.5, // dodges draw and picks any victim
  skip: 5,             // dodges one draw
  reverse: 5,          // dodges one draw + flips direction
  drawFromTheBottom: 4.8, // dodges top-of-deck danger
  bury: 4.5,           // safe draw + reinsert
  digDeeper: 4.5,      // pick 1 of 2
  attack: 4.5,         // dodges a draw AND loads the next player
  alterTheFuture5x: 4.2,
  alterTheFutureNow: 4,
  alterTheFuture: 3.8,
  seeTheFuture5x: 3.5,
  towerOfPower: 3.5,
  shareTheFuture: 3.2,
  seeTheFuture: 3,     // converts a gamble into a decision
  clone: 3,
  clairvoyance: 2.8,
  swapTopAndBottom: 2.8,
  shuffle: 2.5,        // re-rolls a known-bad deck
  favor: 2.5,          // net +1 card, but the target picks
  illTakeThat: 2.4,
  mark: 2.2,
  curseOfTheCatButt: 2.2,
  barkingKitten: 2.2,
  feralCat: 2,         // wild cat
  potluck: 1.8,
  garbageCollection: 1.5,
  personalAttack: 1.2,
  tacoCat: 1,
  rainbowRalphingCat: 1,
  cattermelon: 1,
  hairyPotatoCat: 1,
  beardCat: 1,
  explodingKitten: 0,  // never desirable to hold in the base game
  implodingKitten: 0,
};

// ============================================================================
// Combos
// ============================================================================
// Two of a kind  → steal a random card from a chosen player.
// Three of a kind→ name a card type and take it from a chosen player if held.
// Five different → take any card from the discard pile.
// Feral Cat counts as any Cat Card in pairs, triples, and five-different.

/** Does this set of cards form a legal combo? Returns the kind, or null. */
export function detectCombo(cards: EkCard[], catsOnly: boolean): EkComboKind | null {
  if (cards.length === 2 || cards.length === 3) {
    const [first] = cards;
    if (!first) return null;
    const allSame = cards.every((c) => c.kind === first.kind);
    if (allSame) {
      if (catsOnly && !isCatKind(first.kind)) return null;
      return cards.length === 2 ? 'pair' : 'triple';
    }
    // Feral Cat acts as any Cat Card when paired/tripled with other cat cards.
    if (cards.every((c) => isCatKind(c.kind))) {
      const nonFeralKinds = new Set(cards.filter((c) => c.kind !== 'feralCat').map((c) => c.kind));
      if (nonFeralKinds.size <= 1) {
        return cards.length === 2 ? 'pair' : 'triple';
      }
    }
    return null;
  }
  if (cards.length === 5) {
    if (catsOnly && cards.some((c) => !isCatKind(c.kind))) return null;
    const nonFeral = cards.filter((c) => c.kind !== 'feralCat');
    const nonFeralKinds = new Set(nonFeral.map((c) => c.kind));
    // All non-feral cards must be distinct; feral cats fill in distinct cat slots.
    if (nonFeralKinds.size !== nonFeral.length) return null;
    const catCount = cards.filter((c) => isCatKind(c.kind)).length;
    if (cards.length - nonFeral.length > 0 && catCount > 5) return null;
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
 * Full setup per the rulebook (plus optional expansions):
 *   1. Set aside all Exploding/Imploding Kittens and all Defuses (or Zombie Kittens).
 *   2. Shuffle the rest; deal `handSize` cards to each player.
 *   3. Give every player exactly one Defuse (or Zombie Kitten).
 *   4. Put (playerCount - 1) Exploding Kittens (+1 if Streaking Kittens is enabled,
 *      plus 1 Imploding Kitten if Imploding/Party/Recipes is enabled) and leftover
 *      Defuses back into the deck, then shuffle.
 */
export function dealSetup(
  seats: Seat[],
  rng: RngState,
  handSize: number,
  expansions: readonly EkExpansionId[] = [],
): DealtSetup {
  let nextId = 1;
  const make = (kind: EkBaseCardKind): EkCard => ({ id: nextId++, kind });

  const hasImploding = expansions.includes('imploding-kittens')
    || expansions.includes('party-pack')
    || expansions.includes('recipes-for-disaster');
  const hasStreaking = expansions.includes('streaking-kittens')
    || expansions.includes('recipes-for-disaster');
  const hasBarking = expansions.includes('barking-kittens')
    || expansions.includes('recipes-for-disaster');
  const hasZombie = expansions.includes('zombie-kittens');
  const scale = expansions.includes('party-pack') || seats.length > 6 ? 2 : 1;

  const extraKitten = hasStreaking ? 1 : 0;
  const neededKittens = Math.max(0, seats.length - 1 + extraKitten);
  const totalKittens = Math.max(BASE_DECK_COUNTS.explodingKitten, neededKittens);
  const kittens = Array.from({ length: totalKittens }, () => make('explodingKitten'));

  const defuseKind: EkBaseCardKind = hasZombie ? 'zombieKitten' : 'defuse';
  const baseDefuseCount = hasZombie ? 5 : BASE_DECK_COUNTS.defuse;
  // The base box's 6 Defuses cover up to 5 players; bigger and expanded games
  // keep two spares in the deck beyond one per player.
  const baseGame = expansions.length === 0 && seats.length <= 5;
  const totalDefuses = baseGame ? baseDefuseCount : Math.max(baseDefuseCount, seats.length + 2);
  const defuses = Array.from({ length: totalDefuses }, () => make(defuseKind));

  const pool: EkCard[] = [];
  for (const kind of DEALABLE_KINDS) {
    for (let i = 0; i < BASE_DECK_COUNTS[kind] * scale; i++) {
      pool.push(make(kind));
    }
  }

  const addCounts = (counts: Partial<Record<EkBaseCardKind, number>>) => {
    for (const [k, count] of Object.entries(counts) as [EkBaseCardKind, number][]) {
      if (k === 'implodingKitten' || k === 'explodingKitten' || k === 'defuse' || k === 'zombieKitten') continue;
      for (let i = 0; i < count; i++) pool.push(make(k));
    }
  };

  if (hasImploding) addCounts(IMPLODING_DECK_COUNTS);
  if (hasStreaking) addCounts(STREAKING_DECK_COUNTS);
  if (hasBarking) addCounts(BARKING_DECK_COUNTS);
  if (hasZombie) addCounts(ZOMBIE_DECK_COUNTS);

  const implodingCards = hasImploding ? [make('implodingKitten')] : [];

  const shuffled = shuffle(rng, pool);
  const hands: Record<string, EkCard[]> = {};
  let cursor = 0;
  seats.forEach((seat, i) => {
    const dealt = shuffled.slice(cursor, cursor + handSize);
    cursor += handSize;
    const defuse = defuses[i];
    hands[seat.id] = defuse ? [...dealt, defuse] : dealt;
  });

  const leftoverDefuses = defuses.slice(seats.length);
  const kittensInPlay = [...kittens.slice(0, neededKittens), ...implodingCards];
  const deck = shuffle(rng, [...shuffled.slice(cursor), ...kittensInPlay, ...leftoverDefuses]);

  return { deck, hands };
}

