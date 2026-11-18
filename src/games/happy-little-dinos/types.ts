// Happy Little Dinosaurs — types for the implemented Base Game.

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Dinosaurs & Cards
// ============================================================================

export type HldDisasterCategory =
  | 'natural'
  | 'predator'
  | 'emotional'
  | 'meteor';

export type HldDinoId =
  | 'nervous-rex'
  | 'cry-ceratops'
  | 'bad-luck-bronto'
  | 'stego'
  | 'pterry-dactyl'
  | 'raging-raptor';

export interface HldDinoDef {
  id: HldDinoId;
  name: string;
  plusCategory: HldDisasterCategory;
  minusCategory: HldDisasterCategory | null;
  text: string;
}

export interface HldDisasterCard {
  id: number;
  name: string;
  category: HldDisasterCategory;
  text: string;
}

export type HldPlayCardType = 'point' | 'instant';

export type HldCardKind =
  // Point cards (19 kinds, 53 cards)
  | 'flaming-chainsaw'
  | 'meteor-cannon'
  | 'hungry-plant'
  | 'iced-ptea'
  | 'treenoculars'
  | 'sting-stabber'
  | 'special-star-fruit'
  | 'bow-and-dino'
  | 'mouth-trap'
  | 'run-home-bat'
  | 'fire-spray'
  | 'bonehead'
  | 'delicious-smoothie'
  | 'grave-maker'
  | 'grappling-snake'
  | 'handy-pan'
  | 'dino-grabber'
  | 'cool-stick'
  | 'pet-rock'
  // Instant cards (5 kinds, 16 cards)
  | 'score-booster'
  | 'score-sapper'
  | 'score-inversion'
  | 'disaster-insurance'
  | 'disaster-redirect';

export interface HldCard {
  id: number;
  kind: HldCardKind;
  name: string;
  type: HldPlayCardType;
  value: number | null;
  hasEffect: boolean;
  text: string;
}

// ============================================================================
// Prompts
// ============================================================================

export type HldPrompt =
  | {
      kind: 'petRockDiscard';
      playerId: PlayerId;
      smoothieOnlyEffects: boolean;
    }
  | {
      kind: 'dinoGrabberSteal';
      playerId: PlayerId;
    }
  | {
      kind: 'grapplingSnakeSwap';
      playerId: PlayerId;
      validNeighbors: PlayerId[];
    }
  | {
      kind: 'fireSprayDiscard';
      playerId: PlayerId;
    }
  | {
      kind: 'treenocularsPick';
      playerId: PlayerId;
      cards: HldCard[];
    }
  | {
      kind: 'hungryPlantSwap';
      playerId: PlayerId;
    };

export interface HldLogEntry {
  seq: number;
  byPlayerId: PlayerId | null;
  text: string;
  tone: 'normal' | 'danger' | 'good';
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
    summary: 'Expansion pack — extra disasters and point cards.',
    verified: true,
  },
  {
    id: 'dating-disasters',
    name: 'Dating Disasters',
    summary: 'Expansion pack — romance-themed disasters.',
    verified: true,
  },
  {
    id: 'perils-of-puberty',
    name: 'Perils of Puberty',
    summary: 'Expansion pack — puberty-themed disasters.',
    verified: true,
  },
  {
    id: 'players-5-6',
    name: '5–6 Player Expansion',
    summary: 'Raises the player cap from 4 to 6. Adds Pterry Dactyl and Raging Raptor.',
    verified: true,
  },
];

export interface HldConfig extends ScaffoldConfig {
  expansions: HldExpansionId[];
  trackLength: number;
}

// ============================================================================
// State
// ============================================================================

export type HldSubPhase =
  | 'selecting'
  | 'pointEffects'
  | 'awaitingScoringInstants'
  | 'suddenDeath'
  | 'awaitingDisasterSave'
  | 'gameOver';

export interface HldState extends GameStateShape {
  subPhase: HldSubPhase;

  dinos: Record<PlayerId, HldDinoId>;
  disasterDeck: HldDisasterCard[];
  disasterDiscard: HldDisasterCard[];
  currentDisaster: HldDisasterCard | null;

  deck: HldCard[];
  discard: HldCard[];
  hands: Record<PlayerId, HldCard[]>;

  /** Hidden face-down Point card commits during `selecting` or `suddenDeath`. */
  pendingPicks: Record<PlayerId, HldCard | null>;
  /** Revealed Point cards in front of each player for the current round. */
  revealedPicks: Record<PlayerId, HldCard | null>;

  /** Bonus points added to a player's score this round from Pet Rock / Delicious Smoothie. */
  pointEffectBonuses: Record<PlayerId, number>;
  /** Signed adjustments from Score Booster / Score Sapper (before Star Fruit doubling). */
  instantScoreDeltas: Record<PlayerId, number>;
  /** Number of Score Inversion instants played this round. */
  scoreInversionsPlayed: number;

  promptQueue: HldPrompt[];
  instantResponderQueue: PlayerId[];
  suddenDeathPlayers: PlayerId[];
  pendingDisasterVictimId: PlayerId | null;

  /**Collected Disaster cards per player. */
  disasterAreas: Record<PlayerId, HldDisasterCard[]>;
  /** Position on each player's 0..50 Escape Route. */
  trackPosition: Record<PlayerId, number>;
  eliminated: PlayerId[];
  winnerId: PlayerId | null;

  roundNumber: number;
  log: HldLogEntry[];
  logSeq: number;

  config: HldConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type HldAction =
  | { type: 'chooseDino'; playerId: PlayerId; dinoId: HldDinoId }
  | { type: 'submitPick'; playerId: PlayerId; cardId: number }
  | {
      type: 'resolvePrompt';
      playerId: PlayerId;
      decline?: boolean;
      cardIds?: number[];
      targetPlayerId?: PlayerId;
      secondPlayerId?: PlayerId;
      targetCardId?: number;
    }
  | {
      type: 'playScoringInstant';
      playerId: PlayerId;
      cardId: number;
      targetPlayerId?: PlayerId;
    }
  | { type: 'declineScoringInstant'; playerId: PlayerId }
  | { type: 'submitSuddenDeathPick'; playerId: PlayerId; cardId: number }
  | {
      type: 'playDisasterSave';
      playerId: PlayerId;
      cardId: number;
      targetPlayerId?: PlayerId;
    }
  | { type: 'declineDisasterSave'; playerId: PlayerId };
