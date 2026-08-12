// Exploding Kittens — types for the implemented BASE GAME.
//
// ============================================================================
// Core loop
// ============================================================================
// A turn is: play any number of cards (or none), then END YOUR TURN BY DRAWING
// one card. Drawing is the turn-ender, not an action you pick — the only ways to
// end a turn without drawing are Skip and Attack. Draw an Exploding Kitten and
// you must play a Defuse (then secretly reinsert the kitten anywhere in the
// deck) or you are out. Last player alive wins.
//
// Deck holds exactly (playerCount - 1) kittens, so exactly one player survives.
// See cards.ts for the 56-card composition and the setup deal.
//
// ============================================================================
// Hidden information — the deck-order caveat
// ============================================================================
// Per the project's model the full state is replicated, so `state.deck` is
// readable by every peer in devtools. We accept that (friends-only honour, same
// stance as the sibling project) rather than making the host authoritative.
// Two consequences the code must respect:
//   - The UI NEVER renders deck contents. The only legitimate window into the
//     deck is `knownTopCount`, below.
//   - The AI must not read `state.deck` beyond `knownTopCount[me]`. Anything
//     else is cheating, and it would also make the AI unbeatable and boring.
//
// ============================================================================
// Turn / subphase state machine
// ============================================================================
//   awaitingAction      main loop: active player plays cards or draws
//   awaitingNope        a play is parked; eligible holders may Nope, LIFO
//   awaitingDefuse      active player drew a kitten and holds a Defuse
//   awaitingKittenPlace Defuse played; choose the secret reinsertion index
//   awaitingFavorGive   Favor resolved; the target picks a card to hand over
//   awaitingDiscardPick five-different combo; take any card from the discard
//   awaitingFutureView  See the Future peek is open; acknowledge to close
//   gameOver
//
// `activePlayerId` follows whoever owes a decision — during awaitingNope it
// parks on the next eligible responder, and during awaitingFavorGive on the
// Favor's victim. That keeps the shell's AI driver ticking one seat at a time
// without any special-casing (same trick the sibling project used).

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Cards
// ============================================================================

/**
 * Base set card kinds. The five cat cards have no ability of their own — they
 * exist purely as combo fodder.
 */
export type EkBaseCardKind =
  | 'explodingKitten'
  | 'defuse'
  | 'nope'
  | 'attack'
  | 'skip'
  | 'favor'
  | 'shuffle'
  | 'seeTheFuture'
  | 'tacoCat'
  | 'rainbowRalphingCat'
  | 'cattermelon'
  | 'hairyPotatoCat'
  | 'beardCat';

// Cards the expansions add, for planning only — none are implemented, and
// `EkCard.kind` is deliberately narrowed to the base set so the reducer cannot
// silently receive one:
//
//   Imploding Kittens — implodingKitten, reverse, drawFromTheBottom,
//                       alterTheFuture, feralCat, targetedAttack
//   Streaking Kittens — streakingKitten, superSkip, swapTopAndBottom,
//                       catomicBomb, curseOfTheCatButt, garbageCollector, mark
//   Barking Kittens   — barkingKitten, bury, alterTheFutureNow, illTakeThat,
//                       shareTheFuture, towerOfPower, personalAttack, potluck
//   Zombie Kittens    — zombieKitten

/**
 * A physical card instance. Instance ids matter more here than in the sibling
 * project: the deck is an ordered list of specific cards, and a Defuse moves
 * one exact card to one exact index.
 */
export interface EkCard {
  id: number;
  kind: EkBaseCardKind;
}

export type EkComboKind = 'pair' | 'triple' | 'fiveDifferent';

// ============================================================================
// Reaction stack (the Nope primitive)
// ============================================================================

/**
 * A play that has been declared but not yet resolved, sitting under an open
 * Nope window. Resolution is LIFO: an ODD number of Nopes cancels the play, an
 * even number means it still resolves.
 */
export interface EkPendingPlay {
  byPlayerId: PlayerId;
  /** The card(s) played. A combo puts 2, 3 or 5 cards down at once. */
  cards: EkCard[];
  combo: EkComboKind | null;
  /** Declared on play, so responders can decide knowing the target. */
  targetPlayerId: PlayerId | null;
  /** Three-of-a-kind: the card type being demanded, named on play. */
  demandKind: EkBaseCardKind | null;
  /** Nopes stacked on top, in play order. Odd = cancelled. */
  nopeCards: EkCard[];
  /**
   * Live players who still owe a respond/decline decision in the CURRENT
   * window. Rebuilt each time a Nope lands, since the situation changed.
   * Players holding no Nope are never queued — they have no legal response.
   */
  responderQueue: PlayerId[];
}

// ============================================================================
// Log
// ============================================================================
// A take-that game is unreadable without a record of who did what to whom, so
// the log is part of replicated state. Capped in the reducer.

export interface EkLogEntry {
  /** Monotonic counter, not a timestamp — reducers must stay pure. */
  seq: number;
  byPlayerId: PlayerId | null;
  text: string;
  /** Drives log styling: explosions and eliminations read differently. */
  tone: 'normal' | 'danger' | 'good';
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
  /** None are implemented — the lobby shows them as unavailable. */
  expansions: EkExpansionId[];
  /**
   * Random cards dealt to each player before their guaranteed Defuse. The
   * rulebook deal is 4 (+1 Defuse = a 5-card opening hand). Newer printings
   * bundled with expansions deal 7.
   */
  handSize: number;
  /**
   * ⚠ Rule uncertainty, see cards.ts. false (default) = any matching cards may
   * form a combo; true = cat cards only.
   */
  combosCatsOnly: boolean;
}

// ============================================================================
// State
// ============================================================================

export type EkSubPhase =
  | 'awaitingAction'
  | 'awaitingNope'
  | 'awaitingDefuse'
  | 'awaitingKittenPlace'
  | 'awaitingFavorGive'
  | 'awaitingDiscardPick'
  | 'awaitingFutureView'
  | 'gameOver';

export interface EkState extends GameStateShape {
  subPhase: EkSubPhase;

  /** Ordered; index 0 is the top of the deck. Never render this in the UI. */
  deck: EkCard[];
  /** Top of the discard is the last element. Public. */
  discard: EkCard[];
  hands: Record<PlayerId, EkCard[]>;

  /** Seats knocked out, in elimination order. Turn advance skips these. */
  eliminated: PlayerId[];

  /**
   * How many top-of-deck cards each player legitimately knows, from See the
   * Future or from placing a kitten on top themselves. This is the ONLY channel
   * through which a player or AI may look at the deck. Invalidated by draws
   * (decrement), shuffles (zero), and reinsertions (clamped to the insert index).
   */
  knownTopCount: Record<PlayerId, number>;

  /**
   * Whose TURN it is. Distinct from `activePlayerId`, which is repurposed to
   * point at whoever owes the next decision — a Nope responder, or a Favor's
   * victim. Always come back to this seat when a subphase finishes.
   */
  turnPlayerId: PlayerId;

  /**
   * Turns the active player still owes, including the one in progress. Attack
   * pushes this onto the next player; Skip burns exactly one.
   */
  turnsRemaining: number;

  /** +1 clockwise. Always +1 in the base game — Reverse arrives with Imploding. */
  turnDirection: 1 | -1;

  /** Open reaction window, if any. */
  pending: EkPendingPlay | null;

  /** Open See the Future peek — drives the modal, then folds into knownTopCount. */
  peek: { playerId: PlayerId; cards: EkCard[] } | null;

  /** In-flight Favor: `from` owes `to` a card of their choosing. */
  pendingFavor: { fromPlayerId: PlayerId; toPlayerId: PlayerId } | null;

  /**
   * A kitten that has been drawn and is awaiting resolution — first a Defuse,
   * then a secret reinsertion index.
   */
  pendingKitten: EkCard | null;

  /**
   * Cards that have been played and resolved but not yet flushed to the discard
   * pile. Only the five-different combo uses this, so that the five cards you
   * just played aren't available for you to immediately reclaim.
   */
  limbo: EkCard[];

  log: EkLogEntry[];
  logSeq: number;

  config: EkConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type EkAction =
  /**
   * Play one card, or a declared combo. Opens a Nope window rather than
   * resolving immediately. Targets and demands are declared here so responders
   * can judge the play.
   */
  | {
      type: 'playCards';
      playerId: PlayerId;
      cardIds: number[];
      targetPlayerId?: PlayerId;
      demandKind?: EkBaseCardKind;
    }
  /** Nope the pending play. Out of turn — legal for any live holder of a Nope. */
  | { type: 'playNope'; playerId: PlayerId; cardId: number }
  /** Decline to respond in the open Nope window. */
  | { type: 'declineNope'; playerId: PlayerId }
  /** End your turn by drawing. Resolves kitten draws into a Defuse or death. */
  | { type: 'drawCard'; playerId: PlayerId }
  /** Play the Defuse for the kitten you just drew. */
  | { type: 'playDefuse'; playerId: PlayerId; cardId: number }
  /** Secretly reinsert the defused kitten. index 0 = top of deck. */
  | { type: 'placeKitten'; playerId: PlayerId; index: number }
  /** Favor's victim hands over a card of their own choosing. */
  | { type: 'giveCard'; playerId: PlayerId; cardId: number }
  /** Five-different combo: take any one card from the discard pile. */
  | { type: 'takeFromDiscard'; playerId: PlayerId; cardId: number }
  /** Close a See the Future peek. */
  | { type: 'ackPeek'; playerId: PlayerId };
