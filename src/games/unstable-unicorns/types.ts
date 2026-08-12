// Unstable Unicorns — types + design outline. NO LOGIC YET.
//
// ============================================================================
// Core loop
// ============================================================================
// Build a Stable of 7 unicorns (6 at 6–8 players) and you win. Everyone starts
// with one Baby Unicorn from the shared Nursery. Turn is four phases:
//   Beginning  — "at the start of your turn" effects fire
//   Draw       — draw 1
//   Action     — EITHER play a card OR draw an extra card
//   End        — "at the end of your turn" effects fire, then discard to 7
// If the deck runs out, most unicorns wins; tie broken by total letters in the
// names of tabled unicorns; still tied = nobody wins.
//
// ============================================================================
// Why it matters for this project
// ============================================================================
// Neigh is the same primitive as Exploding Kittens' Nope: an Instant, playable
// out of turn, cancelling another player's card, and itself Neigh-able. Build
// the reaction window once in Exploding Kittens and reuse it here.
//
// The other new shape is a persistent TABLEAU with continuous modifiers —
// Upgrades and Downgrades sit in a Stable and change the rules while they're
// there. Follow the card-collecting project's rule for this: compute modifiers
// by walking the tableau, never store them as flags.

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Cards
// ============================================================================

/** The nine card types, colour-coded across the visible spectrum in the physical game. */
export type UuCardType =
  | 'instant'          // Neigh, Super Neigh — playable out of turn
  | 'upgrade'          // beneficial persistent card in your Stable
  | 'downgrade'        // detrimental persistent card, usually forced onto a rival
  | 'magic'            // one-shot effect, then discarded
  | 'basicUnicorn'
  | 'magicalUnicorn'   // unicorn with an ongoing or triggered ability
  | 'babyUnicorn'      // from the Nursery; cannot be sacrificed/destroyed/returned
  | 'ultimateUnicorn'
  | 'diamondUnicorn';  // Diamond Edition only

/** Everything that counts toward the 7-unicorn win condition. */
export const UNICORN_TYPES: readonly UuCardType[] = [
  'basicUnicorn', 'magicalUnicorn', 'babyUnicorn', 'ultimateUnicorn', 'diamondUnicorn',
];

/**
 * When an ability fires. Effects themselves are deliberately unmodelled at this
 * stage — the base deck is 135 cards and each needs rulebook text.
 */
export type UuTriggerTiming =
  | 'onPlay'           // "When this card enters your Stable…"
  | 'beginningOfTurn'
  | 'endOfTurn'
  | 'onDestroyed'
  | 'onSacrificed'
  | 'continuous';      // static rule modification while in a Stable

export interface UuCard {
  id: number;
  name: string;
  type: UuCardType;
  /** Rulebook text, verbatim. Effects get modelled later, one card at a time. */
  text: string;
  triggers: UuTriggerTiming[];
  /** Which product this card comes from — base or an expansion id. */
  source: 'base' | UuExpansionId;
}

// ============================================================================
// Zones
// ============================================================================

/** One player's board. Unicorns win the game; upgrades/downgrades modify rules. */
export interface UuStable {
  unicorns: UuCard[];
  upgrades: UuCard[];
  downgrades: UuCard[];
}

// ============================================================================
// Reaction stack (shared shape with Exploding Kittens' Nope)
// ============================================================================

export interface UuPendingPlay {
  byPlayerId: PlayerId;
  card: UuCard;
  targetPlayerId: PlayerId | null;
  /** Target card within the target's Stable, when the card needs one. */
  targetCardId: number | null;
  /** Neighs stacked on top. Odd = cancelled. Super Neigh cannot be Neighed. */
  neighCount: number;
  superNeighed: boolean;
  respondedPlayerIds: PlayerId[];
}

// ============================================================================
// Config
// ============================================================================

export type UuExpansionId =
  | 'uncut-unicorns'
  | 'nsfw'
  | 'rainbow-apocalypse'
  | 'dragons'
  | 'unicorns-of-legend'
  | 'adventures'
  | 'christmas'
  | 'nightmares';

/** Alternate base decks, not expansions — pick exactly one. */
export type UuEdition =
  | 'base'
  | 'base-2nd'
  | 'control'      // Kickstarter exclusive: protective magic + deck manipulation
  | 'chaos'        // Kickstarter exclusive: destruction + discard recursion
  | 'nsfw'
  | 'travel'
  | 'kids'
  | 'diamond';     // adds 4 Diamond Unicorns, a d4, and the Vault zone

export const UU_EXPANSIONS: readonly ExpansionMeta[] = [
  { id: 'uncut-unicorns', name: 'Uncut Unicorns', summary: 'Expansion pack.', verified: true },
  { id: 'nsfw', name: 'NSFW', summary: 'Adult-humour expansion pack.', verified: true },
  { id: 'rainbow-apocalypse', name: 'Rainbow Apocalypse', summary: 'Expansion pack.', verified: true },
  { id: 'dragons', name: 'Dragons', summary: 'Expansion pack.', verified: true },
  { id: 'unicorns-of-legend', name: 'Unicorns of Legend', summary: 'Expansion pack.', verified: true },
  { id: 'adventures', name: 'Adventures', summary: 'Expansion pack.', verified: true },
  { id: 'christmas', name: 'Christmas', summary: 'Holiday expansion pack.', verified: true },
  { id: 'nightmares', name: 'Nightmares', summary: 'Expansion pack.', verified: true },
];

export interface UuConfig extends ScaffoldConfig {
  expansions: UuExpansionId[];
  edition: UuEdition;
}

// ============================================================================
// State
// ============================================================================

export type UuPhase =
  | 'beginningOfTurn'
  | 'draw'
  | 'action'
  | 'endOfTurn'
  | 'awaitingNeigh'        // reaction window open
  | 'awaitingTarget'       // played card needs a target chosen
  | 'awaitingSacrifice'    // player must choose one of their own to lose
  | 'awaitingDiscard'      // over the 7-card hand limit at end of turn
  | 'awaitingNurseryPick'
  | 'gameOver';

export interface UuState extends GameStateShape {
  subPhase: UuPhase;

  deck: UuCard[];
  discard: UuCard[];
  /** Shared pool of Baby Unicorns. Babies always return here, never to a hand. */
  nursery: UuCard[];
  /** Diamond Edition only — set aside zone. */
  vault: UuCard[];

  hands: Record<PlayerId, UuCard[]>;
  stables: Record<PlayerId, UuStable>;

  pending: UuPendingPlay | null;

  /** 7 unicorns at 2–5 players, 6 at 6–8. Derived at setup, stored for clarity. */
  unicornsToWin: number;

  config: UuConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type UuAction =
  | { type: 'drawForTurn'; playerId: PlayerId }
  /** Action phase: play a card. Opens a Neigh window. */
  | { type: 'playCard'; playerId: PlayerId; cardId: number; targetPlayerId?: PlayerId; targetCardId?: number }
  /** Action phase alternative: draw an extra card instead of playing. */
  | { type: 'drawInsteadOfPlaying'; playerId: PlayerId }
  | { type: 'playNeigh'; playerId: PlayerId; cardId: number }
  | { type: 'declineNeigh'; playerId: PlayerId }
  | { type: 'chooseTarget'; playerId: PlayerId; targetPlayerId: PlayerId; targetCardId?: number }
  | { type: 'sacrifice'; playerId: PlayerId; cardId: number }
  | { type: 'discardToLimit'; playerId: PlayerId; cardIds: number[] }
  | { type: 'takeFromNursery'; playerId: PlayerId; cardId: number }
  | { type: 'endTurn'; playerId: PlayerId };

// ============================================================================
// Open questions
// ============================================================================
// 1. 135 base cards each need rulebook text before effects can be modelled.
//    Plan: model by trigger tier (pure on-play → continuous → triggered), same
//    staged approach the card-collecting project used for 7 Wonders Leaders.
// 2. Continuous Upgrade/Downgrade effects must be computed from the tableau on
//    read, never cached as flags.
// 3. Super Neigh cannot be Neighed — the reaction window needs a "terminal"
//    response, unlike Exploding Kittens where every Nope can be Noped.
// 4. Editions are alternate base decks, not stackable expansions. validateConfig
//    should enforce exactly one edition.
// 5. Deck-exhaustion tiebreak (letters in unicorn names) is trivially
//    deterministic — implement it, it's a fun detail.
