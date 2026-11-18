// Here to Slay — types for the implemented Base Game.

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Classes & Cards
// ============================================================================

export type HtsBaseClass =
  | 'fighter'
  | 'bard'
  | 'guardian'
  | 'ranger'
  | 'thief'
  | 'wizard'
  | 'warrior'
  | 'druid'
  | 'berserker'
  | 'necromancer';

export const HTS_BASE_CLASSES: readonly HtsBaseClass[] = [
  'fighter',
  'bard',
  'guardian',
  'ranger',
  'thief',
  'wizard',
];

export const HTS_ALL_CLASSES: readonly HtsBaseClass[] = [
  'fighter',
  'bard',
  'guardian',
  'ranger',
  'thief',
  'wizard',
  'warrior',
  'druid',
  'berserker',
  'necromancer',
];

export type HtsCardType =
  | 'partyLeader'
  | 'hero'
  | 'item'
  | 'cursedItem'
  | 'magic'
  | 'modifier'
  | 'challenge'
  | 'monster'
  | 'gift';

export interface HtsCard {
  id: number;
  kind: string;
  name: string;
  type: HtsCardType;
  class: HtsBaseClass | null;
  text: string;
  /** Roll threshold for a Hero's ability (e.g. 7 means 7+, or <=7 when rollLow is true). */
  abilityThreshold: number | null;
  /** When true (Druid Heroes), the ability roll succeeds when total <= abilityThreshold. */
  rollLow?: boolean;
  /** Maximum number of Item cards that can be equipped to this Hero (default 1; 2 for some Warriors/Berserkers). */
  maxItems?: number;
  /** Allowed signed values for a Modifier card (e.g. [2, -2] or [4]). */
  modifierChoices: number[] | null;
  /** Optional expansion identifier. */
  expansion?: HtsExpansionId;
}

export interface HtsMonster {
  card: HtsCard;
  /** Required number of total Heroes in Party (including any class-specific ones). */
  requiredHeroes: number;
  /** Optional specific class required in Party (either a Hero or Party Leader of this class). */
  requiredClass: HtsBaseClass | null;
  /** Requirement label for display. */
  requirementText: string;
  /** Roll >= slayThreshold slays the monster (except Dracos where slayOnLow is true: roll <= slayThreshold). */
  slayThreshold: number;
  slayOnLow?: boolean;
  /** Roll <= failThreshold (or >= failThreshold for Dracos) triggers penalty. */
  failThreshold: number;
  failPenalty: 'sacrificeHero' | 'discard2';
}

export interface HtsPartyHero {
  card: HtsCard;
  equippedItem: HtsCard | null;
  /** Additional equipped items when a Hero can hold 2+ items (Warriors/Berserkers/Bottomless Bag). */
  extraItems?: HtsCard[];
  usedThisTurn: boolean;
}

// ============================================================================
// Reaction Windows & Prompts
// ============================================================================

export interface HtsPendingPlay {
  byPlayerId: PlayerId;
  card: HtsCard;
  /** For equipping an item: target player and hero card id. */
  targetPlayerId: PlayerId | null;
  targetHeroCardId: number | null;
  responderQueue: PlayerId[];
}

export interface HtsAppliedModifier {
  playerId: PlayerId;
  card: HtsCard;
  amount: number;
  /** For Challenge rolls, which side the modifier was applied to ('actor' | 'challenger'). */
  targetSide: 'actor' | 'challenger';
}

export interface HtsPendingRoll {
  byPlayerId: PlayerId;
  reason: 'heroAbility' | 'monsterAttack' | 'challengeDuel';
  dice: [number, number];
  /** Only for challengeDuel: challenger player id and their 2d6 roll. */
  challengerId: PlayerId | null;
  challengerDice: [number, number] | null;
  /** Hero card id (for heroAbility) or Monster card id (for monsterAttack). */
  sourceCardId: number;
  threshold: number;
  /** When true (Druid Hero ability or low-roll effect), roll succeeds on <= threshold. */
  rollLow?: boolean;
  modifiers: HtsAppliedModifier[];
  responderQueue: PlayerId[];
}

export type HtsPrompt =
  | {
      kind: 'rollEnteredHero';
      playerId: PlayerId;
      heroCard: HtsCard;
    }
  | {
      kind: 'chooseHeroTarget';
      playerId: PlayerId;
      reason: string;
      optional: boolean;
      scope: 'own' | 'others' | 'any' | 'specificPlayer';
      specificPlayerId?: PlayerId;
      mode: 'destroy' | 'sacrifice' | 'steal' | 'swapGive' | 'bounceItem' | 'stealItem';
      effectTag?: string;
    }
  | {
      kind: 'chooseCardsFromHand';
      playerId: PlayerId;
      reason: string;
      count: number;
      upTo?: boolean;
      optional: boolean;
      filter: 'any' | 'hero' | 'item' | 'magic';
      effectTag:
        | 'discard'
        | 'qiBearDiscard'
        | 'destructiveSpellDiscard'
        | 'entanglingTrapDiscard'
        | 'bearyWiseDiscard'
        | 'greedyCheeksGive'
        | 'slipperyPawsDiscard'
        | 'barkHexerDiscard'
        | 'playFreeHero'
        | 'playFreeItem'
        | 'playFreeItemsUpTo2'
        | 'playFreeMagic'
        | 'snowballFreeMagic'
        | 'endOfTurnLimit';
      toPlayerId?: PlayerId;
    }
  | {
      kind: 'choosePlayer';
      playerId: PlayerId;
      reason: string;
      optional: boolean;
      effectTag:
        | 'pullOne'
        | 'bearClawPull'
        | 'furyKnucklePull'
        | 'buttonsPull'
        | 'luckyBuckyPull'
        | 'slyPickingsPull'
        | 'wildBuckPull'
        | 'plunderingPumaPull'
        | 'slipperyPawsPull'
        | 'dodgyDealerTrade'
        | 'heavyBearDiscard'
        | 'hopperSacrifice'
        | 'sharpFoxLook'
        | 'silentShadowSteal'
        | 'buckOmensSteal'
        | 'blindingBladeStealItems'
        | 'tipsyTootieSwap'
        | 'meowzioSteal'
        | 'forcedExchangeTarget'
        | 'giftBagBanditSteal';
      sourceHeroId?: number;
    }
  | {
      kind: 'chooseFromPile';
      playerId: PlayerId;
      reason: string;
      optional: boolean;
      cards: HtsCard[];
      source: 'discard' | 'opponentHand' | 'bearyWisePool' | 'discardReviveToParty' | 'discardReviveAndRoll' | 'discardPlayMagic';
      opponentId?: PlayerId;
    }
  | {
      kind: 'bullseyePeek';
      playerId: PlayerId;
      cards: HtsCard[];
    }
  | {
      kind: 'peekHandAck';
      playerId: PlayerId;
      targetPlayerId: PlayerId;
      cards: HtsCard[];
    }
  | {
      kind: 'corruptedSabretoothChoice';
      playerId: PlayerId;
      ownerId: PlayerId;
      heroCardId: number;
    };

export interface HtsLogEntry {
  seq: number;
  byPlayerId: PlayerId | null;
  text: string;
  tone: 'normal' | 'danger' | 'good';
}

// ============================================================================
// Config
// ============================================================================

export type HtsExpansionId =
  | 'warriors-druids'
  | 'berserkers-necromancers'
  | 'here-to-sleigh';

export const HTS_EXPANSIONS: readonly ExpansionMeta[] = [
  {
    id: 'warriors-druids',
    name: 'Warriors & Druids',
    summary: 'Adds the Warrior and Druid classes with their party leaders, heroes and monsters.',
    verified: true,
  },
  {
    id: 'berserkers-necromancers',
    name: 'Berserkers & Necromancers',
    summary: 'Adds the Berserker and Necromancer classes with their party leaders, heroes and monsters.',
    verified: true,
  },
  {
    id: 'here-to-sleigh',
    name: 'Here to Sleigh',
    summary: 'Holiday-themed expansion with Festive Leaders, Holiday Heroes, Monsters, and Nice List Gifts.',
    verified: true,
  },
];

export interface HtsConfig extends ScaffoldConfig {
  expansions: HtsExpansionId[];
  monstersToWin: number;
  /** Number of distinct classes needed in a Party to win (defaults to 7 with class expansions, 6 in base game). */
  classesToWin?: number;
}

// ============================================================================
// State
// ============================================================================

export type HtsSubPhase =
  | 'awaitingAction'
  | 'awaitingChallenge'
  | 'awaitingModifiers'
  | 'awaitingPrompt'
  | 'gameOver';

export interface HtsTurnBuffs {
  rollBonus: number;
  unchallengeable: boolean;
  shadowClawUsed: boolean;
  nobleShamanUsed?: boolean;
  gnawingDreadUsed?: boolean;
  noOpponentModifiers?: boolean;
}

export interface HtsState extends GameStateShape {
  subPhase: HtsSubPhase;

  deck: HtsCard[];
  discard: HtsCard[];
  monsterRow: HtsMonster[];
  monsterDeck: HtsMonster[];

  hands: Record<PlayerId, HtsCard[]>;
  partyLeaders: Record<PlayerId, HtsCard>;
  parties: Record<PlayerId, HtsPartyHero[]>;
  trophies: Record<PlayerId, HtsMonster[]>;

  /** Here to Sleigh expansion: Nice Gifts collected by each player (3 Nice Gifts wins!) and remaining Gift deck. */
  niceGifts: Record<PlayerId, HtsCard[]>;
  giftDeck: HtsCard[];

  /** Protection flags lasting until the start of that player's next turn. */
  protectedFromSteal: Record<PlayerId, boolean>;
  protectedFromDestroy: Record<PlayerId, boolean>;

  turnPlayerId: PlayerId;
  actionPointsRemaining: number;
  turnBuffs: HtsTurnBuffs;

  /** Temporary pool for Beary Wise discarded cards. */
  bearyWisePool: HtsCard[];

  pendingPlay: HtsPendingPlay | null;
  pendingRoll: HtsPendingRoll | null;
  promptQueue: HtsPrompt[];

  winnerId: PlayerId | null;
  log: HtsLogEntry[];
  logSeq: number;

  config: HtsConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type HtsAction =
  | { type: 'choosePartyLeader'; playerId: PlayerId; leaderKind: string }
  | { type: 'drawCard'; playerId: PlayerId }
  | { type: 'playHero'; playerId: PlayerId; cardId: number }
  | {
      type: 'equipItem';
      playerId: PlayerId;
      cardId: number;
      targetPlayerId: PlayerId;
      heroCardId: number;
    }
  | { type: 'playMagic'; playerId: PlayerId; cardId: number }
  | {
      type: 'useHeroAbility';
      playerId: PlayerId;
      heroCardId: number;
      dice: [number, number];
    }
  | {
      type: 'attackMonster';
      playerId: PlayerId;
      monsterCardId: number;
      dice: [number, number];
    }
  | { type: 'shadowClawPull'; playerId: PlayerId; targetPlayerId: PlayerId }
  | { type: 'nobleShamanAdjust'; playerId: PlayerId; delta: 1 | -1 }
  | { type: 'gnawingDreadSearch'; playerId: PlayerId }
  | { type: 'claimHolidayGift'; playerId: PlayerId }
  | { type: 'discardAndRedraw'; playerId: PlayerId }
  | {
      type: 'playChallenge';
      playerId: PlayerId;
      cardId: number;
      actorDice: [number, number];
      challengerDice: [number, number];
    }
  | { type: 'declineChallenge'; playerId: PlayerId }
  | {
      type: 'playModifier';
      playerId: PlayerId;
      cardId: number;
      chosenValue: number;
      protectingHornDelta?: 1 | -1;
      targetSide?: 'actor' | 'challenger';
    }
  | { type: 'declineModifier'; playerId: PlayerId }
  | {
      type: 'resolvePrompt';
      playerId: PlayerId;
      decline?: boolean;
      dice?: [number, number];
      cardIds?: number[];
      targetPlayerId?: PlayerId;
      targetCardId?: number;
      bullseyePickId?: number;
      bullseyeTopOrder?: number[];
    }
  | { type: 'endTurn'; playerId: PlayerId };
