// Happy Little Dinosaurs — types + design outline. NO LOGIC YET.
//
// ============================================================================
// ⚠ CONFIDENCE: expansion names verified from the publisher's store; the rules
// below are reconstructed and need the rulebook before the reducer is written.
// ============================================================================
//
// ============================================================================
// Core loop (⚠ reconstructed)
// ============================================================================
// You are a dinosaur trying to survive daily disasters. Each round:
//   1. Flip a DISASTER card from the disaster deck. It has a category and a
//      point value everyone must beat.
//   2. Every player simultaneously plays one Point card face down.
//   3. Reveal. ⚠ Whoever fails the disaster (lowest, or below its value) takes
//      the hit and moves DOWN their survival track, unless they play an Escape
//      card that matches the disaster's category.
//   4. Advance on the track for surviving; win by reaching the end of the track
//      (⚠ 50 points) or by being the last dinosaur alive.
//
// Disaster categories (⚠ names need confirming): Natural Disaster, Predator,
// Foolishness, Bad Luck. Escape cards are category-specific, which is where the
// take-that comes from — you hold the escape for a disaster that hasn't come up.
//
// ============================================================================
// What this game adds to the engine
// ============================================================================
// 1. SIMULTANEOUS FACE-DOWN COMMITS. Everyone submits a hidden pick, then all
//    reveal. The card-collecting project solved this shape already (Sushi Go's
//    `selecting` subphase, 7 Wonders' `pendingPick`): park `activePlayerId` on
//    the next un-submitted AI seat so the host AI driver ticks them in turn,
//    and batch-apply once every live player has submitted.
// 2. A per-player TRACK — the first positional-but-not-spatial state here. Just
//    an integer per player; no board needed.
// 3. Instant/response cards played after the reveal (⚠ if the rulebook has
//    them) would reuse the reaction-window primitive.

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Cards
// ============================================================================

/** ⚠ Category names need confirming from the rulebook. */
export type HldDisasterCategory =
  | 'naturalDisaster'
  | 'predator'
  | 'foolishness'
  | 'badLuck';

export interface HldDisasterCard {
  id: number;
  name: string;
  category: HldDisasterCategory;
  /** Threshold the played point card must beat. */
  value: number;
  text: string;
  source: 'base' | HldExpansionId;
}

export type HldPlayCardType =
  | 'point'      // numeric value played against a disaster
  | 'escape'     // dodges one category of disaster outright
  | 'instant';   // ⚠ played in response to something; existence unconfirmed

export interface HldCard {
  id: number;
  name: string;
  type: HldPlayCardType;
  /** Point cards only. */
  value: number | null;
  /** Escape cards only — which category it dodges. */
  escapes: HldDisasterCategory | null;
  text: string;
  source: 'base' | HldExpansionId;
}

// ============================================================================
// Config
// ============================================================================

export type HldExpansionId =
  | 'hazards-ahead'
  | 'dating-disasters'
  | 'perils-of-puberty'
  | 'players-5-6';

export const HLD_EXPANSIONS: readonly ExpansionMeta[] = [
  {
    id: 'hazards-ahead',
    name: 'Hazards Ahead',
    summary: 'Expansion pack — extra disasters and point cards. Contents need the rulebook.',
    verified: true,
  },
  {
    id: 'dating-disasters',
    name: 'Dating Disasters',
    summary: 'Expansion pack — romance-themed disasters. Contents need the rulebook.',
    verified: true,
  },
  {
    id: 'perils-of-puberty',
    name: 'Perils of Puberty',
    summary: 'Expansion pack — puberty-themed disasters. Contents need the rulebook.',
    verified: true,
  },
  {
    id: 'players-5-6',
    name: '5–6 Player Expansion',
    summary: 'Raises the player cap from 4 to 6. Adds two more dinosaur tracks and cards.',
    verified: true,
  },
];

export interface HldConfig extends ScaffoldConfig {
  expansions: HldExpansionId[];
  /** ⚠ Believed 50. Confirm against the track on the physical board. */
  trackLength: number;
}

// ============================================================================
// State
// ============================================================================

export type HldSubPhase =
  | 'revealDisaster'     // flip the round's disaster
  | 'selecting'          // simultaneous face-down point-card commits
  | 'resolving'          // reveal + apply, click-through so players can read it
  | 'awaitingEscape'     // ⚠ a hit player may play a matching escape
  | 'gameOver';

export interface HldState extends GameStateShape {
  subPhase: HldSubPhase;

  disasterDeck: HldDisasterCard[];
  disasterDiscard: HldDisasterCard[];
  /** The disaster currently in play, null between rounds. */
  currentDisaster: HldDisasterCard | null;

  deck: HldCard[];
  discard: HldCard[];
  hands: Record<PlayerId, HldCard[]>;

  /**
   * Face-down commits for this round. Hidden-information rule as everywhere
   * else in this project: the value IS in replicated state, and the UI is
   * responsible for not rendering other players' picks until reveal.
   */
  pendingPicks: Record<PlayerId, number | null>;

  /** Position on each player's survival track. */
  trackPosition: Record<PlayerId, number>;
  /** Dinosaurs that have run out of track. Turn order skips them. */
  eliminated: PlayerId[];

  config: HldConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type HldAction =
  | { type: 'flipDisaster'; playerId: PlayerId }
  /** Simultaneous phase: commit a face-down point card. */
  | { type: 'submitPick'; playerId: PlayerId; cardId: number }
  /** Everyone has committed — reveal and apply. */
  | { type: 'resolveRound'; playerId: PlayerId }
  | { type: 'playEscape'; playerId: PlayerId; cardId: number }
  | { type: 'declineEscape'; playerId: PlayerId }
  /** Click-through so humans can read the round result before the next flip. */
  | { type: 'continue'; playerId: PlayerId };

// ============================================================================
// Open questions
// ============================================================================
// 1. Rulebook needed for: exact resolution (is it lowest-loses, or
//    below-threshold-loses?), track length and layout, and whether instants exist.
// 2. Confirm the four disaster category names.
// 3. Card lists for base + 3 content expansions.
// 4. Whether the 5–6 player expansion changes any rules beyond the cap.
// 5. Simultaneous-pick AI parking: `activePlayerId` must sit on the next
//    un-submitted AI seat during `selecting` or all-AI matches will freeze.
//    This is a known trap — the card-collecting project hit it twice.
