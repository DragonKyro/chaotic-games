// Doomlings — types for the Base Game and all 7 official expansions.

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Expansions & Sources
// ============================================================================

export type DmExpansionId =
  | 'overlush'
  | 'imaginary-ends'
  | 'legends-of-enderas'
  | 'ancient-fates'
  | 'shadow-puppets'
  | 'castle-glass'
  | 'mokoko-village';

export type DmCardSource = 'base' | DmExpansionId;

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
  | 'venomousMoveSelf'
  | 'suppressFromHand1'
  | 'suppressFromHand2'
  | 'suppressFromPile1'
  | 'draw2AndSuppress1'
  | 'discard1ToDraw3'
  | 'playFromDiscard1';

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
  | 'minusPerColorless'
  | 'perMultiColor'
  | 'perAttachment'
  | 'perSuppressed'
  | 'perSameKindOwnPile'
  | 'perSwarmAllPiles'
  | 'perDominant'
  | 'perDiscardPile3'
  | 'glassHeartBonus';

export type DmWorldsEndTag =
  | 'hyperIntelligenceDiscardColor'
  | 'viralPenaltyColor'
  | 'faithChangeColor'
  | 'eloquencePlayTrait'
  | 'suppressHandAtWorldsEnd';

export interface DmTraitCard {
  id: number;
  kind: string;
  name: string;
  color: DmTraitColor;
  /** Optional second color for Multi-color traits (Overlush, Imaginary Ends, etc.). */
  secondaryColor?: DmTraitColor;
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
  /** True if this card cannot be removed from your Trait Pile (e.g. Fulfilled, Roots, or granted by Attachment). */
  indestructible?: boolean;
  /** True if this trait is an Attachment that attaches to a non-Dominant host trait in your Trait Pile. */
  isAttachment?: boolean;
  /** ID of the host trait in the same Trait Pile that this attachment is attached to. */
  attachedToId?: number;
  /** Extra bonus points granted when this attachment is attached to a host trait. */
  hostBonusPoints?: number;
  /** True if attaching this card grants Indestructible to its host trait. */
  grantsIndestructible?: boolean;
  /** True if this card is a Swarm/Community trait (Mokoko Village). */
  isSwarm?: boolean;
  /** Expansion or base game source of this card. */
  source?: DmCardSource;
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
  | 'allDraw2'
  | 'allDiscard1'
  | 'allSuppress1'
  | 'noDominants';

export type DmCatastropheEffectTag =
  | 'discardHandPerBlue'
  | 'discardHandPerGreen'
  | 'discardHandPerRed'
  | 'discardHandPerPurple'
  | 'sacrificeOneTrait'
  | 'drawPerColorType'
  | 'discardAndRedrawGenePool'
  | 'passCardLeft'
  | 'suppressOneFromHand';

export type DmWorldsEndCatastropheTag =
  | 'minus1PerBlue'
  | 'minus1PerGreen'
  | 'minus1PerRed'
  | 'minus1PerPurple'
  | 'plus4FewestTraits'
  | 'minus5MostTraits'
  | 'plus1PerColorless'
  | 'plus2PerDominant'
  | 'plus2PerMultiColor'
  | 'plus1PerSuppressed';

export interface DmAgeCard {
  id: number;
  name: string;
  kind: DmAgeCardKind;
  genePoolDelta: number;
  ruleTag: DmAgeRuleTag;
  catastropheEffect?: DmCatastropheEffectTag;
  worldsEndEffect?: DmWorldsEndCatastropheTag;
  source?: DmCardSource;
  text: string;
  worldsEndText?: string;
}

// ============================================================================
// Meaning of Life / Treasure Objectives
// ============================================================================

export type DmObjectiveTag =
  | 'twoOfEachColor'
  | 'genePool6Plus'
  | 'fewestTraits'
  | 'fiveRed'
  | 'fiveBlue'
  | 'fiveGreen'
  | 'fivePurple'
  | 'twoDominants'
  | 'fourColorless'
  | 'eightTraits';

export interface DmObjectiveCard {
  id: number;
  name: string;
  kind: 'meaningOfLife' | 'treasure';
  source: 'imaginary-ends' | 'legends-of-enderas';
  points: number;
  conditionTag: DmObjectiveTag;
  text: string;
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
      effectTag:
        | 'discard'
        | 'stabilizeDiscard'
        | 'giveToOpponent'
        | 'playExtraTrait'
        | 'eloquencePlay'
        | 'suppress'
        | 'discardToDraw3';
    }
  | {
      kind: 'chooseTraitInPile';
      playerId: PlayerId;
      reason: string;
      optional: boolean;
      scope: 'own' | 'others';
      mode: 'steal' | 'destroy' | 'sacrifice' | 'attach' | 'suppress';
      attachmentCardId?: number;
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
      mode?: 'takeToHand' | 'playDirectly';
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
  {
    id: 'overlush',
    name: 'Overlush',
    summary: 'Multi-color traits, lush Dominants, and Overlush Ages & Catastrophes.',
    verified: true,
  },
  {
    id: 'imaginary-ends',
    name: 'Imaginary Ends',
    summary: 'Multi-pack expansion: Dinolings, Mythlings, Techlings, Magical, Attachments & Meaning of Life objectives.',
    verified: true,
  },
  {
    id: 'legends-of-enderas',
    name: 'Legends of Enderas',
    summary: 'Treasure objectives, Relic attachments, Realm Ages, and Enderas traits.',
    verified: true,
  },
  {
    id: 'ancient-fates',
    name: 'Ancient Fates',
    summary: 'Suppress-synergy traits, Destiny Ages, and Ancient Dominants.',
    verified: true,
  },
  {
    id: 'shadow-puppets',
    name: 'Shadow Puppets',
    summary: 'Bolster expansion: Suppress & trickster shadow traits and Ages.',
    verified: true,
  },
  {
    id: 'castle-glass',
    name: 'Castle Glass',
    summary: 'Bolster expansion: High-value glass traits, Indestructible shields & defensive Ages.',
    verified: true,
  },
  {
    id: 'mokoko-village',
    name: 'Mokoko Village',
    summary: 'Bolster expansion: Community Swarm & Kidney self-multiplying traits and Ages.',
    verified: true,
  },
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
  /** Number of tucked/suppressed cards per player (+1 pt each at World's End, plus trait bonuses). */
  suppressedCount: Record<PlayerId, number>;
  /** Personal Meaning of Life / Treasure Objective card per player (when imaginary-ends or legends-of-enderas is enabled). */
  objectives: Record<PlayerId, DmObjectiveCard | null>;
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
  /** Internal flag: true when current player's action prompts should be followed by Stabilize & turn end. */
  turnEndingAfterPrompts?: boolean;

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
