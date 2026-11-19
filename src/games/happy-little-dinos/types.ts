// Happy Little Dinosaurs — types for Base Game + all 4 Expansions.

import type { GameStateShape } from '@/core/module';
import type { ExpansionConfig, ExpansionMeta, PlayerId } from '@/core/types';
import type { LogEntry } from '@/core/state';

// ============================================================================
// Dinosaurs, Disasters, Hazards & Cards
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
  drawsHazard?: boolean;
}

export type HldHazardPenalty =
  | 'score-minus-1'
  | 'score-minus-2'
  | 'hand-size-minus-1'
  | 'no-instants'
  | 'ignore-dino-plus'
  | 'extra-disaster-Check';

export interface HldHazardCard {
  id: number;
  name: string;
  penalty: HldHazardPenalty;
  text: string;
}

export type HldPlayCardType = 'point' | 'instant';

export type HldCardKind =
  // Base Point cards (19 kinds, 53 cards)
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
  // Base Instant cards (5 kinds, 16 cards)
  | 'score-booster'
  | 'score-sapper'
  | 'score-inversion'
  | 'disaster-insurance'
  | 'disaster-redirect'
  // Perils of Puberty Point cards
  | 'extra-sharp-stick'
  | 'really-thick-glasses'
  | 'trash-into-treasure'
  | 'handy-backpack'
  | 'ice-cream'
  | 'unwanted-lunch'
  // Perils of Puberty Instant cards
  | 'bffs-help'
  | 'frenemys-curse'
  | 'joy-of-puberty'
  | 'lucky-break'
  | 'spiteful-bullying'
  // Dating Disasters Point cards
  | 'mixtape'
  | 'minty-gum'
  | 'box-of-chocolates'
  | 'wine-bottle'
  | 'heart-bomb'
  | 'bedazzled-belt'
  | 'teddy-bear'
  | 'bouquet-of-flowers'
  | 'stinky-perfume'
  | 'broken-high-heel'
  | 'love-bug'
  | 'cold-feet'
  // Dating Disasters Instant cards
  | 'awkward-first-kiss'
  | 'baby-pictures'
  | 'crippling-shyness'
  | 'double-date'
  | 'one-week-anniversary'
  // Hazards Ahead Point & Instant cards
  | 'molotov-crocktail'
  | 'suck-up'
  | 'caution-sign'
  | 'protective-helmet'
  | 'hazard-suit'
  | 'safety-cone'
  | 'roadblock'
  | 'detour';

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
    }
  | {
      kind: 'trashIntoTreasurePick';
      playerId: PlayerId;
    }
  | {
      kind: 'unwantedLunchSwap';
      playerId: PlayerId;
    }
  | {
      kind: 'coldFeetSwap';
      playerId: PlayerId;
      topDiscardPointCardId: number;
    }
  | {
      kind: 'removeHazardPick';
      playerId: PlayerId;
      canTransferToOpponent: boolean;
    };

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
    id: 'players-5-6',
    name: '5–6 Player Expansion',
    summary: 'Raises the player cap from 4 to 6. Adds Pterry Dactyl & Raging Raptor, 14 Disasters, 36 Main cards, and Top-2 Scoring for 5–6 players.',
    verified: true,
  },
  {
    id: 'perils-of-puberty',
    name: 'Perils of Puberty',
    summary: '54-card expansion — 16 puberty-themed Disasters, 28 Point cards (Trash into Treasure, Ice Cream!, Unwanted Lunch), and 10 Instants.',
    verified: true,
  },
  {
    id: 'dating-disasters',
    name: 'Dating Disasters',
    summary: '53-card expansion — 15 romance-themed Disasters, 26 Point cards (Box of Chocolates, Bouquet of Flowers, Cold Feet), and 12 Instants.',
    verified: true,
  },
  {
    id: 'hazards-ahead',
    name: 'Hazards Ahead',
    summary: '50-card expansion — adds the 12-card Hazard Deck & Hazard Area penalties, 22 Disasters, and 16 Standard cards (Molotov Crocktail, Suck Up).',
    verified: true,
  },
];

export interface HldConfig extends ExpansionConfig {
  expansions: HldExpansionId[];
  trackLength: number;
  dinoSelections?: Record<PlayerId, HldDinoId>;
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

  hazardDeck: HldHazardCard[];
  hazardDiscard: HldHazardCard[];
  hazardAreas: Record<PlayerId, HldHazardCard[]>;

  deck: HldCard[];
  discard: HldCard[];
  hands: Record<PlayerId, HldCard[]>;

  /** Hidden face-down Point card commits during `selecting` or `suddenDeath`. */
  pendingPicks: Record<PlayerId, HldCard | null>;
  /** Revealed Point cards in front of each player for the current round. */
  revealedPicks: Record<PlayerId, HldCard | null>;

  /** Bonus points added to a player's score this round from Point card effects. */
  pointEffectBonuses: Record<PlayerId, number>;
  /** Signed adjustments from Scoring Instant cards (before Star Fruit doubling). */
  instantScoreDeltas: Record<PlayerId, number>;
  /** Number of Score Inversion instants played this round. */
  scoreInversionsPlayed: number;
  /** Pairwise score swaps triggered by Spiteful Bullying or Awkward First Kiss. */
  instantScoreSwaps: [PlayerId, PlayerId][];

  promptQueue: HldPrompt[];
  instantResponderQueue: PlayerId[];
  suddenDeathPlayers: PlayerId[];
  pendingDisasterVictimId: PlayerId | null;

  /** Collected Disaster cards per player. */
  disasterAreas: Record<PlayerId, HldDisasterCard[]>;
  /** Position on each player's 0..50 Escape Route. */
  trackPosition: Record<PlayerId, number>;
  eliminated: PlayerId[];
  winnerId: PlayerId | null;

  roundNumber: number;
  log: LogEntry[];
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
      secondPlayerId?: PlayerId;
      handCardId?: number;
    }
  | { type: 'declineScoringInstant'; playerId: PlayerId }
  | { type: 'submitSuddenDeathPick'; playerId: PlayerId; cardId: number }
  | {
      type: 'playDisasterSave';
      playerId: PlayerId;
      cardId: number;
      targetPlayerId?: PlayerId;
      discardCardId?: number;
    }
  | { type: 'declineDisasterSave'; playerId: PlayerId };
