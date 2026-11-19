// Exploding Kittens — deck compositions, card metadata, setup dealer.
//
// ============================================================================
// DECK COMPOSITION
// ============================================================================
// Every count below is read off the publisher's rule sheets (see types.ts for
// the file list). Original Edition, 56 cards:
//
//   Exploding Kitten 4 · Defuse 6 · Nope 5 · Attack 4 · Skip 4 · Favor 4 ·
//   Shuffle 4 · See the Future 5 · five cat cards, 4 of each (20)
//
// Imploding Kittens 20 · Streaking Kittens 15 (incl. 1 Exploding Kitten) ·
// Barking Kittens 20 · Zombie Kittens 22 · Party Pack 120 (a replacement core
// deck, split by paw prints — see PARTY_PACK_COUNTS).

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

/** Copies of each card in the 56-card Original Edition deck. */
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

/** Streaking Kittens expansion — 15 cards, one of them an extra Exploding Kitten. */
export const STREAKING_DECK_COUNTS: Partial<Record<EkBaseCardKind, number>> = {
  explodingKitten: 1,
  streakingKitten: 1,
  superSkip: 1,
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

/** Zombie Kittens expansion — 22 cards. The Zombie Kittens replace the Defuses. */
export const ZOMBIE_DECK_COUNTS: Partial<Record<EkBaseCardKind, number>> = {
  zombieKitten: 5,
  digDeeper: 4,
  clone: 2,
  clairvoyance: 2,
  superSkip: 2,
  feedTheDead: 2,
  graveRobber: 1,
  attackOfTheDead: 3,
  shuffleNow: 1,
};

/** Zombie Kittens, 2 players: "Remove all of the Attack of the Dead, Grave Robber, Feed The Dead, and Super Skip cards". */
const ZOMBIE_TWO_PLAYER_REMOVED: readonly EkBaseCardKind[] = ['attackOfTheDead', 'graveRobber', 'feedTheDead', 'superSkip'];

/**
 * Party Pack — 120 cards: [without paw print, with paw print]. 2–3 players use
 * only the paw-print cards, 4–7 only the others, 8–10 everything. The 9
 * Exploding Kittens carry no paw print and are used at every count.
 */
export const PARTY_PACK_COUNTS: Partial<Record<EkBaseCardKind, readonly [number, number]>> = {
  explodingKitten: [9, 0],
  defuse: [7, 3],
  nope: [5, 4],
  attack: [2, 3],
  targetedAttack: [3, 2],
  skip: [6, 4],
  favor: [4, 2],
  shuffle: [4, 2],
  seeTheFuture: [3, 3],
  alterTheFuture: [4, 2],
  drawFromTheBottom: [4, 3],
  tacoCat: [4, 3],
  rainbowRalphingCat: [4, 3],
  cattermelon: [4, 3],
  hairyPotatoCat: [4, 3],
  beardCat: [4, 3],
  feralCat: [4, 2],
};

/** The Party Pack cards in play for this many players. */
function partyPackCounts(players: number): Partial<Record<EkBaseCardKind, number>> {
  const out: Partial<Record<EkBaseCardKind, number>> = {};
  for (const [kind, [noPaw, paw]] of Object.entries(PARTY_PACK_COUNTS) as [EkBaseCardKind, readonly [number, number]][]) {
    out[kind] = kind === 'explodingKitten' ? noPaw
      : players <= 3 ? paw
      : players <= 7 ? noPaw
      : noPaw + paw;
  }
  return out;
}

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

/** Cards that can never be put down as a turn action or a combo. */
export function isKittenKind(kind: EkBaseCardKind): boolean {
  return kind === 'explodingKitten' || kind === 'implodingKitten';
}

function hasImplodingKitten(expansions: readonly EkExpansionId[]): boolean {
  return expansions.includes('imploding-kittens') || expansions.includes('recipes-for-disaster');
}

export function hasStreakingKittens(expansions: readonly EkExpansionId[]): boolean {
  return expansions.includes('streaking-kittens') || expansions.includes('recipes-for-disaster');
}

function hasBarkingKittens(expansions: readonly EkExpansionId[]): boolean {
  return expansions.includes('barking-kittens') || expansions.includes('recipes-for-disaster');
}

/**
 * Seat limits. Original Edition 2–5; Imploding Kittens "adds one additional
 * player"; the Party Pack is a 2–10 core deck; the Zombie Kittens expansion
 * has exactly 5 Zombie Kittens (one per player) so it caps at 5; the Recipes
 * box is 2–5.
 */
export function maxPlayersForExpansions(expansions: readonly EkExpansionId[]): number {
  let max = expansions.includes('party-pack') ? 10
    : expansions.includes('imploding-kittens') ? 6
    : 5;
  if (expansions.includes('zombie-kittens')) max = Math.min(max, 5);
  return max;
}

/**
 * How many kittens go into the deck. Base: players − 1. Streaking Kittens:
 * players ("the total number of Kittens is equal to the number of players").
 * The Imploding Kitten counts towards that total.
 */
export function kittenPlan(players: number, expansions: readonly EkExpansionId[]): { exploding: number; imploding: number } {
  const total = Math.max(0, players - 1 + (hasStreakingKittens(expansions) ? 1 : 0));
  const imploding = hasImplodingKitten(expansions) && total > 0 ? 1 : 0;
  return { exploding: total - imploding, imploding };
}

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
  feedTheDead: 'Feed the Dead',
  graveRobber: 'Grave Robber',
  attackOfTheDead: 'Attack of the Dead',
  shuffleNow: 'Shuffle NOW',
};

export const CARD_TEXT: Record<EkBaseCardKind, string> = {
  explodingKitten: 'You explode and are out of the game — unless you can play a Defuse.',
  defuse: 'Play this when you draw an Exploding Kitten to neutralise it, then secretly put the kitten back anywhere in the deck. Your turn is over.',
  nope: 'Stop any action except an Exploding Kitten or a Defuse. Playable at any time, even out of turn. A Nope can be Noped.',
  attack: 'End your turn without drawing, and force the next player to take two turns. If you were attacked, your remaining turns pass on too, plus two.',
  skip: 'End one of your turns without drawing a card.',
  favor: 'Force one other player to give you a card of their choosing.',
  shuffle: 'Shuffle the draw pile.',
  seeTheFuture: 'Privately peek at the top three cards of the deck.',
  tacoCat: 'No ability on its own — collect matching cards to play a combo.',
  rainbowRalphingCat: 'No ability on its own — collect matching cards to play a combo.',
  cattermelon: 'No ability on its own — collect matching cards to play a combo.',
  hairyPotatoCat: 'No ability on its own — collect matching cards to play a combo.',
  beardCat: 'No ability on its own — collect matching cards to play a combo.',
  // Imploding Kittens
  implodingKitten: 'First draw: put it back face up anywhere in the deck (no Defuse). Draw it face up and you die — it cannot be Defused or Noped.',
  reverse: 'Reverse the order of play and end one of your turns without drawing a card. With two players it is a Skip.',
  drawFromTheBottom: 'End your turn by drawing the bottom card from the draw pile instead of the top.',
  alterTheFuture: 'Privately view and rearrange the top three cards of the draw pile in any order.',
  targetedAttack: 'End your turn without drawing and choose any player (including yourself) to take two turns. Stacks like Attack.',
  feralCat: 'Use as any Cat Card in a pair or three of a kind. Cannot stand in for a non-cat card.',
  // Streaking Kittens
  streakingKitten: 'While this is in your hand you can secretly hold one Exploding Kitten. If it leaves your hand, that kitten goes off.',
  superSkip: 'End ALL of your remaining turns without drawing a card.',
  seeTheFuture5x: 'Privately peek at the top five cards of the deck.',
  alterTheFuture5x: 'Privately view and rearrange the top five cards of the deck in any order.',
  swapTopAndBottom: 'Swap the top and bottom cards of the draw pile without looking.',
  garbageCollection: 'Everyone with cards (you too) secretly puts one card from their hand into the draw pile, then it is shuffled.',
  catomicBomb: 'Show every Exploding Kitten in the draw pile, shuffle the rest, put the kittens on top, and end your turn without drawing.',
  mark: 'Pick a player — one random card in their hand is turned to face everyone until it is played or stolen.',
  curseOfTheCatButt: 'Curse a player: their hand goes face down and they play cards picked at random until they draw a card safely.',
  // Barking Kittens
  barkingKitten: 'Whoever holds the other Barking Kitten must Defuse or explode. If nobody does, it stays face up in front of you — and you are the target. Cannot be Noped.',
  alterTheFutureNow: 'Playable at any time, even out of turn: view and rearrange the top three cards of the deck.',
  bury: "End your turn by drawing a card, looking at it, and secretly putting it back anywhere. Not while an I'll Take That is in front of you.",
  personalAttack: 'Take 3 turns in a row, starting with this one. Stacks with other Attacks.',
  shareTheFuture: 'View and rearrange the top three cards of the deck, then show them to the next player.',
  illTakeThat: 'Put this in front of another player; the next card they draw goes to you instead.',
  potluck: 'Starting with you, each player with cards puts one card of their choice face down on top of the deck.',
  towerOfPower: 'Wear the Crown and take the 6-card Stash into it. Anyone stealing from you takes a random Crown card instead.',
  // Zombie Kittens
  zombieKitten: 'Acts as a Defuse (you may choose not to). If anyone is dead, you must bring one back — and hide their kitten in the deck too.',
  digDeeper: 'Look at the top card: keep it and end your turn, or put it back and draw the next card no matter what.',
  clone: 'Becomes the card directly beneath it on the discard pile. Play it with a card to make a pair, or as a Zombie Kitten on top of one.',
  clairvoyance: 'NOW: when another player plays a Zombie Kitten, watch where they hide the kitten(s).',
  feedTheDead: 'NOW: choose a dead player. Every living player except you gives them a card.',
  graveRobber: 'Every dead player with cards shuffles one card from their hand into the draw pile. Needs a dead player.',
  attackOfTheDead: 'End your turn without drawing. The next player takes 3 turns for each dead player. Stacks like Attack.',
  shuffleNow: 'NOW: shuffle the draw pile, even when it is not your turn.',
};

export const ALL_CARD_KINDS = Object.keys(CARD_LABEL) as EkBaseCardKind[];

/** Cards with an effect of their own when played as a single card. */
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
    || kind === 'feedTheDead'
    || kind === 'graveRobber'
    || kind === 'attackOfTheDead'
    || kind === 'shuffleNow'
  );
}

/**
 * NOW cards: playable at any time before an action has begun, even out of
 * turn, and (with Zombie Kittens) by dead players. Clairvoyance is a NOW card
 * too, but it only answers a Zombie Kitten, so it has its own window.
 */
export function isNowKind(kind: EkBaseCardKind): boolean {
  return kind === 'alterTheFutureNow' || kind === 'shuffleNow' || kind === 'feedTheDead';
}

/** Single-card actions that require choosing a target player. */
export function needsTargetForKind(kind: EkBaseCardKind): boolean {
  return (
    kind === 'favor'
    || kind === 'targetedAttack'
    || kind === 'mark'
    || kind === 'curseOfTheCatButt'
    || kind === 'illTakeThat'
    || kind === 'feedTheDead'
  );
}

/** Kinds a lone Clone may become: action cards with an effect of their own (no Clone on Clone, no kittens). */
export function isCloneableKind(kind: EkBaseCardKind): boolean {
  return kind !== 'clone' && kind !== 'barkingKitten' && isPlayableAction(kind);
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
  attackOfTheDead: 5.5,
  skip: 5,             // dodges one draw
  reverse: 5,          // dodges one draw + flips direction
  drawFromTheBottom: 4.8, // dodges top-of-deck danger
  bury: 4.5,           // safe draw + reinsert
  digDeeper: 4.5,      // a second chance at the draw
  attack: 4.5,         // dodges a draw AND loads the next player
  alterTheFuture5x: 4.2,
  alterTheFutureNow: 4,
  alterTheFuture: 3.8,
  seeTheFuture5x: 3.5,
  towerOfPower: 3.5,
  shareTheFuture: 3.2,
  seeTheFuture: 3,     // converts a gamble into a decision
  clone: 3,
  shuffleNow: 3,
  clairvoyance: 2.8,
  swapTopAndBottom: 2.8,
  graveRobber: 2.6,
  shuffle: 2.5,        // re-rolls a known-bad deck
  favor: 2.5,          // net +1 card, but the target picks
  illTakeThat: 2.4,
  feedTheDead: 2.3,
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
  explodingKitten: 0,  // never desirable to hold
  implodingKitten: 0,
};

// ============================================================================
// Combos
// ============================================================================
// "Two of a kind … now applies to ANY pair of cards in the deck with the same
// title. Ignore the instructions on the cards." Three of a kind: the same, but
// name the card you want. Feral Cat is any Cat Card (never a non-cat). A Clone
// played with a card becomes that card, so Clone + X is a pair of X.
// Five different (take any card from the discard pile) is from older printings
// only — `fiveDifferent` opts in.

export interface ComboRules {
  catsOnly: boolean;
  fiveDifferent: boolean;
}

/** Does this set of cards form a legal combo? Returns the kind, or null. */
export function detectCombo(cards: EkCard[], rules: ComboRules): EkComboKind | null {
  if (cards.some((c) => isKittenKind(c.kind) || c.kind === 'barkingKitten')) return null;
  const pairable = (kind: EkBaseCardKind) => !rules.catsOnly || isCatKind(kind);
  if (cards.length === 2 || cards.length === 3) {
    const [first] = cards;
    if (!first) return null;
    const size: EkComboKind = cards.length === 2 ? 'pair' : 'triple';
    const allSame = cards.every((c) => c.kind === first.kind);
    if (allSame) return pairable(first.kind) && first.kind !== 'clone' ? size : null;
    // Clone + one other card: the Clone becomes the card beneath it.
    if (cards.length === 2) {
      const clone = cards.find((c) => c.kind === 'clone');
      const other = cards.find((c) => c.kind !== 'clone');
      if (clone && other) return pairable(other.kind) ? 'pair' : null;
    }
    // Feral Cat stands in for any Cat Card.
    if (cards.every((c) => isCatKind(c.kind))) {
      const nonFeralKinds = new Set(cards.filter((c) => c.kind !== 'feralCat').map((c) => c.kind));
      if (nonFeralKinds.size <= 1) return size;
    }
    return null;
  }
  if (cards.length === 5 && rules.fiveDifferent) {
    if (rules.catsOnly && cards.some((c) => !isCatKind(c.kind))) return null;
    const nonFeral = cards.filter((c) => c.kind !== 'feralCat');
    // All non-feral cards must be distinct; Feral Cats fill the other cat slots.
    if (new Set(nonFeral.map((c) => c.kind)).size !== nonFeral.length) return null;
    const ferals = cards.length - nonFeral.length;
    const distinctCats = new Set(nonFeral.filter((c) => isCatKind(c.kind)).map((c) => c.kind)).size;
    if (ferals > 0 && distinctCats + ferals > 5) return null;
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
  /** Barking Kittens: the 6-card Stash waiting under the Tower of Power Crown. */
  stash: EkCard[];
}

/** The core deck (Original Edition or Party Pack) for this many players. */
function coreCounts(players: number, expansions: readonly EkExpansionId[]): Partial<Record<EkBaseCardKind, number>> {
  return expansions.includes('party-pack') ? partyPackCounts(players) : BASE_DECK_COUNTS;
}

/** Exploding Kittens available: the core deck's, plus the one in the Streaking Kittens box. */
function explodingKittensAvailable(players: number, expansions: readonly EkExpansionId[]): number {
  return (coreCounts(players, expansions).explodingKitten ?? 0) + (hasStreakingKittens(expansions) ? 1 : 0);
}

/**
 * Setup per the rulebooks:
 *   1. Set aside the Exploding (and Imploding) Kittens and the Defuses.
 *   2. Deal one Defuse to each player. Original Edition: shuffle 2 of the spares
 *      back into the deck (only 1 exists at 5 players). Party Pack: all spares.
 *      Zombie Kittens: the Defuses are removed and each player gets a Zombie
 *      Kitten instead; spares are removed.
 *   3. Barking Kittens: deal 6 cards face down as the Stash.
 *   4. Deal `handSize` cards to each player (spare Defuses can be among them).
 *   5. Insert the kittens (see kittenPlan) and shuffle.
 * No card is ever invented: config validation keeps the player count inside
 * what the boxes contain.
 */
export function dealSetup(
  seats: Seat[],
  rng: RngState,
  handSize: number,
  expansions: readonly EkExpansionId[] = [],
): DealtSetup {
  let nextId = 1;
  const make = (kind: EkBaseCardKind): EkCard => ({ id: nextId++, kind });
  const n = seats.length;
  const zombie = expansions.includes('zombie-kittens');
  const partyPack = expansions.includes('party-pack');
  const core = coreCounts(n, expansions);

  // ---- kittens --------------------------------------------------------------
  const plan = kittenPlan(n, expansions);
  const ekCount = Math.min(plan.exploding, explodingKittensAvailable(n, expansions));
  const kittens = [
    ...Array.from({ length: ekCount }, () => make('explodingKitten')),
    ...Array.from({ length: plan.imploding }, () => make('implodingKitten')),
  ];

  // ---- defuses --------------------------------------------------------------
  const defuseKind: EkBaseCardKind = zombie ? 'zombieKitten' : 'defuse';
  const defuseCount = zombie ? (ZOMBIE_DECK_COUNTS.zombieKitten ?? 0) : (core.defuse ?? 0);
  const defuses = Array.from({ length: defuseCount }, () => make(defuseKind));
  const dealtDefuses = defuses.slice(0, n);
  const spares = defuses.slice(n);
  const sparesBack = zombie ? [] : partyPack ? spares : spares.slice(0, 2);

  // ---- everything else --------------------------------------------------------
  const pool: EkCard[] = [];
  const add = (counts: Partial<Record<EkBaseCardKind, number>>, skip: readonly EkBaseCardKind[] = []) => {
    for (const [k, count] of Object.entries(counts) as [EkBaseCardKind, number][]) {
      if (isKittenKind(k) || isDefuseKind(k) || skip.includes(k)) continue;
      for (let i = 0; i < count; i++) pool.push(make(k));
    }
  };
  add(core);
  if (hasImplodingKitten(expansions)) add(IMPLODING_DECK_COUNTS);
  if (hasStreakingKittens(expansions)) add(STREAKING_DECK_COUNTS);
  if (hasBarkingKittens(expansions)) add(BARKING_DECK_COUNTS);
  if (zombie) add(ZOMBIE_DECK_COUNTS, n === 2 ? ZOMBIE_TWO_PLAYER_REMOVED : []);
  pool.push(...sparesBack);

  // ---- Barking Kittens' Stash ------------------------------------------------------
  // "Remove the Tower of Power … shuffle the deck, and deal out 6 cards face
  // down … This is the Stash. Insert the Tower of Power Card back into the deck."
  let stash: EkCard[] = [];
  let rest = pool;
  if (hasBarkingKittens(expansions)) {
    const tower = rest.filter((c) => c.kind === 'towerOfPower');
    const shuffledForStash = shuffle(rng, rest.filter((c) => c.kind !== 'towerOfPower'));
    stash = shuffledForStash.slice(0, 6);
    rest = [...shuffledForStash.slice(6), ...tower];
  }

  // ---- deal ---------------------------------------------------------------------
  const shuffled = shuffle(rng, rest);
  const hands: Record<string, EkCard[]> = {};
  let cursor = 0;
  seats.forEach((seat, i) => {
    const dealt = shuffled.slice(cursor, cursor + handSize);
    cursor += handSize;
    const defuse = dealtDefuses[i];
    hands[seat.id] = defuse ? [...dealt, defuse] : dealt;
  });

  const deck = shuffle(rng, [...shuffled.slice(cursor), ...kittens]);
  return { deck, hands, stash };
}
