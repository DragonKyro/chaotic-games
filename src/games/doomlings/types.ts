// Doomlings — types for the implemented Base Game.

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Trait Colors & Cards
// ============================================================================

export type DmTraitColor = 'red' | 'blue' | 'green' | 'purple' | 'colorless';

export const DM_COLORS: readonly DmTraitColor[] = ['red', 'blue', 'green', 'purple', 'colorless'];

export type DmActionTag =
  | 'draw1'
  | 'draw2'
  | 'draw3'
  | 'draw4'
  | 'playExtraTrait'
  | 'stealTrait'
  | 'vampirismSteal'
  | 'destroyOpponentTrait'
  | 'swapTraits'
  | 'giveCardFromHand'
  | 'stealRandomHandCard'
  | 'discardFromHand1'
  | 'discardFromHand2'
  | 'takeFromDiscard1'
  | 'venomousMoveSelf';

export type DmDropOfLifeTag =
  | 'perRed'
  | 'perBlue'
  | 'perGreen'
  | 'perPurple'
  | 'perColorless'
  | 'perColorPair'
  | 'perHandCard'
  | 'genePoolSize'
  | 'colorVariety'
  | 'symbiosisLowestColor'
  | 'apexPredatorMostTraits'
  | 'minusPerColorless';

export type DmWorldsEndTag =
  | 'hyperIntelligenceDiscardColor'
  | 'viralPenaltyColor'
  | 'faithChangeColor'
  | 'eloquencePlayTrait';

export interface DmTraitCard {
  id: number;
  kind: string;
  name: string;
  color: DmTraitColor;
  /** Printed face value (or 0 if variable via Drop of Life). */
  points: number;
  dominant: boolean;
  /** Permanent Gene Pool modifier while this card is in a player's Trait Pile. */
  genePoolDelta: number;
  /** Optional play requirement: must have at least 1 trait of this color in your Trait Pile. */
  requireColor?: DmTraitColor;
  /** Optional play requirement: must have at least N traits in your Trait Pile. */
  requireTraitCount?: number;
  /** True if this card is Motley (counts as Red, Blue, Green, and Purple simultaneously). */
  isAllColors?: boolean;
  /** True if this card cannot be removed from your Trait Pile (e.g. Fulfilled or Dominant). */
  indestructible?: boolean;
  actionTag?: DmActionTag;
  dropOfLifeTag?: DmDropOfLifeTag;
  dropOfLifeMultiplier?: number;
  worldsEndTag?: DmWorldsEndTag;
  text: string;
}

export type DmAgeCardKind = 'birthOfLife' | 'age' | 'catastrophe';

export type DmAgeRuleTag =
  | 'none'
  | 'noColorless'
  | 'noBlue'
  | 'noGreen'
  | 'noRed'
  | 'noPurple'
  | 'ignoreActions'
  | 'maxFaceValue3'
  | 'protectTraitPiles'
  | 'stabilizeTo4'
  | 'plusOneGenePoolPerm'
  | 'allDraw1'
  | 'allDiscard1';

export type DmCatastropheEffectTag =
  | 'discardHandPerBlue'
  | 'discardHandPerGreen'
  | 'discardHandPerRed'
  | 'discardHandPerPurple'
  | 'sacrificeOneTrait'
  | 'drawPerColorType'
  | 'discardAndRedrawGenePool'
  | 'passCardLeft';

export type DmWorldsEndCatastropheTag =
  | 'minus1PerBlue'
  | 'minus1PerGreen'
  | 'minus1PerRed'
  | 'minus1PerPurple'
  | 'plus4FewestTraits'
  | 'minus5MostTraits'
  | 'plus1PerColorless'
  | 'plus2PerDominant';

export interface DmAgeCard {
  id: number;
  name: string;
  kind: DmAgeCardKind;
  genePoolDelta: number;
  ruleTag: DmAgeRuleTag;
  catastropheEffect?: DmCatastropheEffectTag;
  worldsEndEffect?: DmWorldsEndCatastropheTag;
  text: string;
  worldsEndText?: string;
}

// ============================================================================
// Prompts
// ============================================================================

export type DmPrompt =
  | {
      kind: 'chooseCardsFromHand';
      playerId: PlayerId;
      reason: string;
      count: number;
      optional: boolean;
      effectTag: 'discard' | 'stabilizeDiscard' | 'giveToOpponent' | 'playExtraTrait' | 'eloquencePlay';
    }
  | {
      kind: 'chooseTraitInPile';
      playerId: PlayerId;
      reason: string;
      optional: boolean;
      scope: 'own' | 'others';
      mode: 'steal' | 'destroy' | 'sacrifice';
    }
  | {
      kind: 'chooseColor';
      playerId: PlayerId;
      reason: string;
      effectTag: 'hyperIntelligence' | 'viral' | 'faithFrom' | 'faithTo';
      fromColor?: DmTraitColor;
    }
  | {
      kind: 'chooseFromDiscard';
      playerId: PlayerId;
      reason: string;
    };

export interface DmLogEntry {
  seq: number;
  byPlayerId: PlayerId | null;
  text: string;
  tone: 'normal' | 'danger' | 'good';
}

// ============================================================================
// Config (Verified Expansion List from Doomlings)
// ============================================================================

export const DM_EXPANSIONS: readonly ExpansionMeta[] = [
  { id: 'overlush', name: 'Overlush', summary: 'Mystery expansion set adding new traits and ages.', verified: true },
  { id: 'imaginary-ends', name: 'Imaginary Ends', summary: 'Multi-pack expansion: Magical, Techlings, Meaning of Life, Dinolings, Mythlings.', verified: true },
  { id: 'legends-of-enderas', name: 'Legends of Enderas', summary: 'Expansion adding Treasure cards and new realms.', verified: true },
  { id: 'ancient-fates', name: 'Ancient Fates', summary: 'Expansion adding ancient traits and new ages.', verified: true },
  { id: 'shadow-puppets', name: 'Shadow Puppets', summary: 'Bolster expansion pack.', verified: true },
  { id: 'castle-glass', name: 'Castle Glass', summary: 'Bolster expansion pack.', verified: true },
  { id: 'mokoko-village', name: 'Mokoko Village', summary: 'Bolster expansion pack.', verified: true },
];

export interface DmConfig extends ScaffoldConfig {
  expansions: string[];
}

// ============================================================================
// State
// ============================================================================

export type DmSubPhase =
  | 'awaitingAction'
  | 'awaitingPrompt'
  | 'gameOver';

export interface DmState extends GameStateShape {
  subPhase: DmSubPhase;

  traitDeck: DmTraitCard[];
  traitDiscard: DmTraitCard[];
  ageDeck: DmAgeCard[];
  agesPlayed: DmAgeCard[];
  currentAge: DmAgeCard;

  hands: Record<PlayerId, DmTraitCard[]>;
  tableaus: Record<PlayerId, DmTraitCard[]>;
  /** Base Gene Pool before trait modifiers (starts at 5). */
  baseGenePool: Record<PlayerId, number>;
  /** Color overrides from Faith at World's End: playerId -> { from, to }. */
  faithColorSwap: Record<PlayerId, { from: DmTraitColor; to: DmTraitColor } | null>;
  /** Viral penalty colors chosen at World's End: { byPlayerId, color }[]. */
  viralPenalties: { byPlayerId: PlayerId; color: DmTraitColor }[];
  /** Players whose Denial dominant trait is still armed to ignore the next Catastrophe. */
  denialArmed: Record<PlayerId, boolean>;

  firstPlayerIndex: number;
  turnPlayerId: PlayerId;
  turnsTakenInRound: number;
  catastrophesSeen: number;

  promptQueue: DmPrompt[];
  winnerId: PlayerId | null;

  log: DmLogEntry[];
  logSeq: number;

  config: DmConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type DmAction =
  | { type: 'playTrait'; playerId: PlayerId; cardId: number }
  | { type: 'passTurn'; playerId: PlayerId }
  | {
      type: 'resolvePrompt';
      playerId: PlayerId;
      decline?: boolean;
      cardIds?: number[];
      targetPlayerId?: PlayerId;
      targetCardId?: number;
      chosenColor?: DmTraitColor;
    };
