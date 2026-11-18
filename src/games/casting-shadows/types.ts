// Casting Shadows — types for the implemented Base Game.

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Hex Map & Resources
// ============================================================================

export type CsHexId =
  | 'ancient-rune'
  | 'dusty-desert'
  | 'underground-volcano'
  | 'amber-mountain'
  | 'whispering-marsh'
  | 'crystal-crypt'
  | 'scorched-peaks';

export type CsResource =
  | 'redGem'
  | 'blueGem'
  | 'purpleGem'
  | 'redOrb'
  | 'blueOrb'
  | 'purpleOrb'
  | 'shadowFragment'
  | 'cursedCrystal';

export interface CsHexTile {
  id: CsHexId;
  name: string;
  q: number;
  r: number;
  startTurnResource: CsResource | null;
  hasMainDeckSlot: boolean;
  faceUpCard: CsCard | null;
  effectText: string;
}

// ============================================================================
// Cards & Characters
// ============================================================================

export type CsCardType =
  | 'attackSpell'
  | 'conversionSpell'
  | 'resource'
  | 'counterspell'
  | 'companion';

export type CsSpellRange = 'same' | 'adjacent' | 'sameOrAdjacent' | 'any';

export interface CsResourceCost {
  redGem?: number;
  blueGem?: number;
  anyGem?: number;
  redOrb?: number;
  blueOrb?: number;
  anyOrb?: number;
  shadowFragment?: number;
  cursedCrystal?: number;
}

export interface CsCard {
  id: number;
  kind: string;
  name: string;
  type: CsCardType;
  level: 1 | 2 | 3;
  collectionCost: CsResourceCost;
  /** For Attack / Conversion spells: one or more cast tiers the player can choose from. */
  castTiers?: {
    cost: CsResourceCost;
    damage: number;
    heal?: number;
    produce?: CsResource[];
    label: string;
  }[];
  range?: CsSpellRange;
  targetsAllOnHex?: boolean;
  grantsResource?: CsResource;
  text: string;
}

export type CsForm = 'light' | 'shadow';

export interface CsCharacterDef {
  id: string;
  lightName: string;
  shadowName: string;
  homeHex: CsHexId;
  shadowAbilityCost: number;
  shadowAbilityText: string;
}

export interface CsPlayerBoard {
  characterId: string;
  form: CsForm;
  hexId: CsHexId;
  hp: number;
  maxHp: number;
  shadowEnergy: number;
  spellBook: CsCard[];
  usedSpellIdsThisTurn: number[];
  companion: CsCard | null;
  usedShadowAbilityThisTurn: boolean;
}

export interface CsPendingAttack {
  attackerId: PlayerId;
  targetId: PlayerId;
  damage: number;
  unreducible: boolean;
  remainingTargetIds: PlayerId[];
}

export interface CsLogEntry {
  seq: number;
  byPlayerId: PlayerId | null;
  text: string;
  tone: 'normal' | 'danger' | 'good';
}

// ============================================================================
// Config
// ============================================================================

export type CsExpansionId = 'ice-storm' | 'molten-rock';

export const CS_EXPANSIONS: readonly ExpansionMeta[] = [
  {
    id: 'ice-storm',
    name: 'The Ice Storm',
    summary: 'Adds Stun/Freeze mechanics, 2 characters, hex tiles, and spells.',
    verified: true,
  },
  {
    id: 'molten-rock',
    name: 'The Molten Rock',
    summary: 'Adds Burn/Fortify mechanics, 2 characters, hex tiles, and spells.',
    verified: true,
  },
];

export interface CsConfig extends ScaffoldConfig {
  expansions: CsExpansionId[];
  characterByPlayer: Record<PlayerId, string>;
}

// ============================================================================
// State
// ============================================================================

export type CsSubPhase =
  | 'awaitingRoll'
  | 'awaitingAction'
  | 'awaitingCompanionPick'
  | 'awaitingCounterspell'
  | 'gameOver';

export interface CsState extends GameStateShape {
  subPhase: CsSubPhase;

  hexes: Record<CsHexId, CsHexTile>;
  boards: Record<PlayerId, CsPlayerBoard>;
  eliminated: PlayerId[];

  mainDeck: CsCard[];
  mainDiscard: CsCard[];
  counterspellDeck: CsCard[];
  counterspellDiscard: CsCard[];
  companionDeck: CsCard[];
  companionPortal: CsCard[];

  turnPlayerId: PlayerId;
  actionPointsRemaining: number;
  /** Current turn's rolled 5 dice + bonus tokens in the active player's Resource Pool. */
  dicePool: CsResource[];
  bonusPool: CsResource[];

  pendingAttack: CsPendingAttack | null;
  winnerId: PlayerId | null;

  log: CsLogEntry[];
  logSeq: number;

  config: CsConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type CsAction =
  | { type: 'rollResourceDice'; playerId: PlayerId; dice: CsResource[] }
  | { type: 'travel'; playerId: PlayerId; toHexId: CsHexId }
  | {
      type: 'rerollDice';
      playerId: PlayerId;
      diceIndices: number[];
      newValues: CsResource[];
    }
  | { type: 'protect'; playerId: PlayerId; targetHexId?: CsHexId }
  | { type: 'refreshHexCard'; playerId: PlayerId }
  | {
      type: 'collectCard';
      playerId: PlayerId;
      fromCounterspellDeck?: boolean;
      replaceSpellId?: number;
    }
  | {
      type: 'castSpell';
      playerId: PlayerId;
      spellId: number;
      tierIndex?: number;
      targetPlayerId?: PlayerId;
      targetHexId?: CsHexId;
    }
  | {
      type: 'useShadowAbility';
      playerId: PlayerId;
      targetPlayerId?: PlayerId;
      targetHexId?: CsHexId;
    }
  | { type: 'transformAndEndTurn'; playerId: PlayerId; transform?: boolean }
  | { type: 'pickCompanion'; playerId: PlayerId; companionId: number }
  | {
      type: 'respondCounterspell';
      playerId: PlayerId;
      counterspellId?: number;
      escapeHexId?: CsHexId;
    };
