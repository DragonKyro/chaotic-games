// Exploding Kittens — types + design outline. NO LOGIC YET.
//
// ============================================================================
// Core loop
// ============================================================================
// Turn = optionally play any number of cards, then END YOUR TURN BY DRAWING one
// card from the deck. Drawing is the turn-ender, not an action you choose — the
// only ways to end a turn without drawing are Skip and Attack.
// Draw an Exploding Kitten and you must play a Defuse (then secretly reinsert
// the kitten anywhere in the deck) or you are OUT. Last player alive wins.
//
// Deck setup (base): remove all Exploding Kittens and Defuses. Deal 7 random
// cards + 1 Defuse to each player. Return (playerCount - 1) Exploding Kittens
// and the leftover Defuses to the deck, shuffle. So the deck ALWAYS has exactly
// one fewer kitten than players — someone survives.
//
// ============================================================================
// Why this game first
// ============================================================================
// It's the smallest ruleset that forces all three engine primitives this whole
// project needs (see README "Chaos primitives"):
//   1. Player elimination + turn advance that skips the dead.
//   2. Reaction windows — Nope can be played by anyone, out of turn, and Noped
//      by another Nope, LIFO.
//   3. Secret deck order — Defuse reinsertion, See The Future, Alter the Future.
//      Under full state replication every peer can read the deck array. This is
//      the project's open design question; see README.
//
// ============================================================================
// Turn / subphase state machine
// ============================================================================
//   awaitingAction        main loop: active player plays cards or draws
//   awaitingNope          a card is on the stack; eligible players may Nope
//   awaitingDefuse        active player drew a kitten and holds a Defuse
//   awaitingKittenPlace   Defuse played; choose the reinsertion index (secret)
//   awaitingFavorTarget   Favor played; choose whom to take from
//   awaitingFavorGive     target chooses which card to hand over
//   awaitingComboTarget   2-of-a-kind: choose a victim (blind steal)
//   awaitingComboSteal    3-of-a-kind: name a card type to demand
//   awaitingFutureView    See The Future: peek top 3 (view-only, ack to close)
//   awaitingFutureOrder   Alter the Future: reorder the top 3 (Imploding)
//   gameOver
//
// `activePlayerId` follows the acting seat. During awaitingNope it parks on the
// next seat eligible to respond so the GameHost AI driver ticks responders one
// at a time (same trick the card-collecting project used for simultaneous picks).

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Cards
// ============================================================================

/**
 * Base set card kinds. The five "cat" cards have no ability on their own —
 * they exist purely as pair/triple fodder for combos.
 *
 * Base deck (56 cards) composition per the rulebook still needs confirming
 * card-by-card before `cards.ts` is written.
 */
export type EkBaseCardKind =
  | 'explodingKitten'
  | 'defuse'
  | 'attack'
  | 'skip'
  | 'favor'
  | 'shuffle'
  | 'seeTheFuture'
  // Cat cards (combo fodder only)
  | 'tacoCat'
  | 'rainbowRalphingCat'
  | 'cattermelon'
  | 'hairyPotatoCat'
  | 'beardCat'
  // Nope is base but deliberately listed last: it's the only card playable
  // out of turn, so it's the one the reaction-window primitive is built for.
  | 'nope';

/** Cards introduced by expansions. Grouped by source; contents per Wikipedia's expansion table. */
export type EkExpansionCardKind =
  // Imploding Kittens
  | 'implodingKitten'      // cannot be defused; first draw = face up, second = death
  | 'reverse'              // reverses turn order and ends your turn
  | 'drawFromTheBottom'
  | 'alterTheFuture'       // view AND reorder top 3
  | 'feralCat'             // wild cat card — counts as any cat for combos
  | 'targetedAttack'       // choose who takes the extra turns
  // Streaking Kittens
  | 'streakingKitten'      // lets you secretly hold one Exploding Kitten
  | 'superSkip'
  | 'swapTopAndBottom'
  | 'catomicBomb'
  | 'curseOfTheCatButt'
  | 'garbageCollector'
  | 'mark'                 // force a card in a player's hand face up
  // Barking Kittens
  | 'barkingKitten'        // pair mechanic — one holds, one is drawn
  | 'bury'
  | 'alterTheFutureNow'
  | 'illTakeThat'
  | 'shareTheFuture'
  | 'towerOfPower'
  | 'personalAttack'
  | 'potluck'
  // Zombie Kittens
  | 'zombieKitten';        // exploded players continue from the graveyard

export type EkCardKind = EkBaseCardKind | EkExpansionCardKind;

/**
 * A physical card instance. Instance ids matter here more than in the
 * card-collecting games: the deck is an ordered list of specific cards, and
 * Defuse reinsertion moves one exact card to one exact index.
 */
export interface EkCard {
  id: number;
  kind: EkCardKind;
}

// ============================================================================
// Combos
// ============================================================================
// 2 of a kind → pick a player, steal a RANDOM card from their hand.
// 3 of a kind → pick a player, NAME a card type; they must give it if they have it.
// 5 different cats → take any one card from the discard pile.
// Feral Cat (Imploding) counts as any cat card for these.

export type EkComboKind = 'pair' | 'triple' | 'fiveDifferent';

// ============================================================================
// Reaction stack (the Nope primitive)
// ============================================================================

/**
 * A card played but not yet resolved, sitting under an open Nope window.
 * Resolution is LIFO: the last Nope played wins, so an even number of Nopes on
 * top of a card means it still resolves.
 */
export interface EkPendingPlay {
  byPlayerId: PlayerId;
  /** The card(s) played — a combo puts 2, 3, or 5 cards on the stack at once. */
  cards: EkCard[];
  /** Set for combos so the resolver knows which combo shape was declared. */
  combo: EkComboKind | null;
  /** Chosen target, when the card needs one and it's declared on play. */
  targetPlayerId: PlayerId | null;
  /** Nopes stacked on top, in play order. Odd count = negated. */
  nopeCount: number;
  /** Seats that have already declined to respond in the current window. */
  respondedPlayerIds: PlayerId[];
}

// ============================================================================
// Config
// ============================================================================

export type EkExpansionId =
  | 'imploding-kittens'
  | 'streaking-kittens'
  | 'barking-kittens'
  | 'zombie-kittens'
  | 'party-pack'
  | 'recipes-for-disaster';

export const EK_EXPANSIONS: readonly ExpansionMeta[] = [
  {
    id: 'imploding-kittens',
    name: 'Imploding Kittens',
    summary: '+20 cards, max players 5→6. Imploding Kitten, Reverse, Draw From The Bottom, Alter The Future, Feral Cat, Targeted Attack.',
    verified: true,
  },
  {
    id: 'streaking-kittens',
    name: 'Streaking Kittens',
    summary: '+15 cards. Streaking Kitten (hold a kitten), Super Skip, Swap Top And Bottom, Catomic Bomb, Curse of the Cat Butt, Garbage Collector, Mark.',
    verified: true,
  },
  {
    id: 'barking-kittens',
    name: 'Barking Kittens',
    summary: '+20 cards. Barking Kittens pair, Bury, Alter The Future Now, I\'ll Take That, Share The Future, Tower of Power, Personal Attack, Potluck.',
    verified: true,
  },
  {
    id: 'zombie-kittens',
    name: 'Zombie Kittens',
    summary: 'Exploded players keep playing from a graveyard instead of being eliminated.',
    verified: true,
  },
  {
    id: 'party-pack',
    name: 'Party Pack',
    summary: 'Up to 10 players. Replaces Attack with the mobile game\'s Slap, folds in Imploding Kittens content.',
    verified: true,
  },
  {
    id: 'recipes-for-disaster',
    name: 'Recipes for Disaster',
    summary: '121 cards compiling earlier sets + "recipes" (preset deck variations). Mixing with other decks is discouraged.',
    verified: true,
  },
];

export interface EkConfig extends ScaffoldConfig {
  expansions: EkExpansionId[];
  /**
   * Base is 2–5. Imploding Kittens raises the cap to 6; Party Pack to 10.
   * The module's maxPlayers is the widest case; validateConfig narrows it
   * against the enabled expansions.
   */
  humanReadableNote?: string;
}

// ============================================================================
// State
// ============================================================================

export type EkSubPhase =
  | 'awaitingAction'
  | 'awaitingNope'
  | 'awaitingDefuse'
  | 'awaitingKittenPlace'
  | 'awaitingFavorTarget'
  | 'awaitingFavorGive'
  | 'awaitingComboTarget'
  | 'awaitingComboSteal'
  | 'awaitingFutureView'
  | 'awaitingFutureOrder'
  | 'gameOver';

export interface EkState extends GameStateShape {
  subPhase: EkSubPhase;

  /** Ordered, top of deck = index 0. SECRET in the physical game (see README). */
  deck: EkCard[];
  /** Top of discard = last element. Publicly visible. */
  discard: EkCard[];
  hands: Record<PlayerId, EkCard[]>;

  /** Seats knocked out, in elimination order. Turn advance skips these. */
  eliminated: PlayerId[];

  /**
   * Attack stacking: how many turns the active player still owes. An Attack
   * ends your turn immediately and gives the next player 2 turns; an Attack
   * played into that adds to the count rather than resetting it.
   */
  turnsRemaining: number;

  /** +1 clockwise, -1 counter-clockwise. Flipped by Reverse (Imploding). */
  turnDirection: 1 | -1;

  /** Open reaction window, if any. */
  pending: EkPendingPlay | null;

  /** Cards revealed to one player by See The Future / Share The Future. */
  peek: { playerId: PlayerId; cards: EkCard[] } | null;

  /** Face-up Imploding Kitten location once revealed, else null. */
  implodingRevealedAt: number | null;

  config: EkConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type EkAction =
  /** Play one card, or a declared combo. Does not resolve until the Nope window closes. */
  | { type: 'playCards'; playerId: PlayerId; cardIds: number[]; combo: EkComboKind | null; targetPlayerId?: PlayerId }
  /** Nope the current pending play. Out of turn — legal for any live player holding a Nope. */
  | { type: 'playNope'; playerId: PlayerId; cardId: number }
  /** Decline to respond in the open Nope window. */
  | { type: 'declineNope'; playerId: PlayerId }
  /** End your turn by drawing. Resolves kitten draws into awaitingDefuse or elimination. */
  | { type: 'drawCard'; playerId: PlayerId }
  /** Play the Defuse for a kitten you just drew. */
  | { type: 'playDefuse'; playerId: PlayerId; cardId: number }
  /** Secretly reinsert the defused kitten at `index` (0 = top). */
  | { type: 'placeKitten'; playerId: PlayerId; index: number }
  /** Favor / combo target selection. */
  | { type: 'chooseTarget'; playerId: PlayerId; targetPlayerId: PlayerId }
  /** Favor: the target hands over a card of their choosing. */
  | { type: 'giveCard'; playerId: PlayerId; cardId: number }
  /** 3-of-a-kind: name the card type being demanded. */
  | { type: 'demandKind'; playerId: PlayerId; kind: EkCardKind }
  /** Close a See The Future peek. */
  | { type: 'ackPeek'; playerId: PlayerId }
  /** Alter The Future: submit the new order for the peeked cards. */
  | { type: 'reorderFuture'; playerId: PlayerId; cardIds: number[] };

// ============================================================================
// Open questions — resolve before writing the reducer
// ============================================================================
// 1. SECRET DECK ORDER. The blocker. Options in README; pick one first.
// 2. Nope window timing. Physically it's a real-time shout. We need a
//    deterministic window: does every live holder of a Nope get an explicit
//    respond/decline prompt (slow but exact), or a short timer (fast but
//    racy over P2P)? Leaning explicit prompt, skipping seats with no Nope in
//    hand since they have no legal response anyway.
// 3. Base deck composition card-by-card, and per-player-count kitten/Defuse
//    counts for Party Pack's 6–10 player range.
// 4. Streaking Kitten lets a player HOLD an Exploding Kitten in hand — the
//    "cards in hand are private" assumption needs to survive that.
// 5. Barking Kitten's two-card pair mechanic needs rulebook text.
// 6. Party Pack replaces Attack with Slap; Slap's exact rules need confirming.
//    Treat party-pack as mutually exclusive with plain Attack in validateConfig.
