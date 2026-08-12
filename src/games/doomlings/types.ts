// Doomlings — types + design outline. NO LOGIC YET.
//
// ============================================================================
// ⚠ CONFIDENCE WARNING
// ============================================================================
// The EXPANSION LIST FOR THIS GAME IS MISSING. doomlings.com returned 503 and
// BoardGameGeek blocked automated fetches while this outline was written, so
// unlike the other five games there is no verified product list here.
// EXPANSIONS is deliberately empty rather than guessed — fill it in from the
// publisher's store before building the lobby toggles.
//
// The gameplay below is reconstructed from general knowledge and needs the
// rulebook. Items marked ⚠ are guesses.
//
// ============================================================================
// Core loop (⚠ reconstructed)
// ============================================================================
// Tableau-building over a fixed number of Ages. Broad shape:
//   - Each player builds a "species" by playing TRAIT cards into their tableau.
//     Traits have a colour and a point value; some have ongoing or scoring
//     abilities that reference other traits.
//   - The AGES deck drives the game clock. One age card is turned per round and
//     applies a rule or effect for that round. Shuffled into it are
//     CATASTROPHES, which force players to lose traits.
//   - Your GENE POOL is your hand limit / draw allowance.
//   - The game ends when the Ages deck runs out (the World's End). Highest total
//     points wins.
//
// ============================================================================
// What this game adds to the engine
// ============================================================================
// 1. A ROUND-LEVEL RULE MODIFIER — the current age card changes the rules while
//    it is face up. Same discipline as continuous tableau modifiers: read the
//    active age card when evaluating a rule, never copy its effect into flags.
// 2. GLOBAL DESTRUCTIVE EVENTS (catastrophes) that hit every player at once and
//    may require simultaneous choices about what to discard.
// 3. Endgame SCORING across categories with trait-to-trait references — the
//    closest thing here to the sibling project's 7 Wonders scoring pass.

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Cards
// ============================================================================

/** ⚠ Placeholder colour set — confirm against the physical cards. */
export type DmTraitColor = 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'colorless';

export interface DmTraitCard {
  id: number;
  name: string;
  color: DmTraitColor;
  /** Base point value printed on the card. */
  points: number;
  /** Rulebook text. Effects modelled later, one card at a time. */
  text: string;
  /** ⚠ "Dominant" traits are believed to be a distinct, stronger class. */
  dominant: boolean;
  source: 'base' | string;
}

/** Cards in the Ages deck: ordinary ages, catastrophes, and the final card. */
export type DmAgeCardKind = 'age' | 'catastrophe' | 'worldsEnd';

export interface DmAgeCard {
  id: number;
  name: string;
  kind: DmAgeCardKind;
  /** The rule this card applies while it is the current age. */
  text: string;
  source: 'base' | string;
}

// ============================================================================
// Config
// ============================================================================

/**
 * ⚠ EMPTY ON PURPOSE — see the warning at the top of this file. Do not invent
 * entries; take them from the publisher's product list.
 */
export const DM_EXPANSIONS: readonly ExpansionMeta[] = [];

export interface DmConfig extends ScaffoldConfig {
  /** Expansion ids, once the real list is known. */
  expansions: string[];
}

// ============================================================================
// State
// ============================================================================

export type DmSubPhase =
  | 'turnAge'              // flip the next age card
  | 'awaitingAction'       // active player draws / plays traits
  | 'awaitingCatastrophe'  // every player chooses what to lose
  | 'scoring'
  | 'gameOver';

export interface DmState extends GameStateShape {
  subPhase: DmSubPhase;

  traitDeck: DmTraitCard[];
  traitDiscard: DmTraitCard[];
  ageDeck: DmAgeCard[];
  /** Ages already turned, most recent last. The last element is the active rule. */
  agesPlayed: DmAgeCard[];

  hands: Record<PlayerId, DmTraitCard[]>;
  /** Each player's species — the traits they have in play. */
  tableaus: Record<PlayerId, DmTraitCard[]>;
  /** Hand limit / draw allowance per player; grows during the game. */
  genePool: Record<PlayerId, number>;

  /** Pending per-player catastrophe choices, null until submitted. */
  catastrophePicks: Record<PlayerId, number[] | null>;

  config: DmConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type DmAction =
  | { type: 'turnAge'; playerId: PlayerId }
  | { type: 'drawTrait'; playerId: PlayerId }
  | { type: 'playTrait'; playerId: PlayerId; cardId: number }
  | { type: 'discardTrait'; playerId: PlayerId; cardId: number }
  /** Catastrophe resolution: each player submits the traits they are losing. */
  | { type: 'submitCatastrophePick'; playerId: PlayerId; cardIds: number[] }
  | { type: 'endTurn'; playerId: PlayerId }
  | { type: 'continue'; playerId: PlayerId };

// ============================================================================
// Open questions
// ============================================================================
// 1. GET THE EXPANSION LIST. It is the one gap in the project's research.
// 2. Rulebook needed for: turn structure and how many traits may be played,
//    how the gene pool grows, catastrophe resolution, and the scoring pass.
// 3. Confirm the trait colour set and what "dominant" actually does.
// 4. Player count (⚠ believed 2–6) and the number of ages per match.
// 5. Catastrophes may need simultaneous submissions — if so, reuse the
//    face-down-commit pattern (see happy-little-dinos/types.ts) including the
//    activePlayerId parking trick so AI seats do not freeze.
