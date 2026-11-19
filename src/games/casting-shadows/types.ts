// Casting Shadows — types for the Base Game + The Ice Storm + The Molten Rock.
//
// SOURCES (audited Nov 2026). Everything marked "confirmed" was read off official
// Unstable Games material, reached through the Wayback Machine:
//   - Base rulebook PDF (unstablegameswiki.com/images/f/ff/Casting-Shadows-Base-Game-Rules.pdf)
//     and the wiki's "Casting Shadows - Rules of Play" page: components, setup, the
//     3-phase turn, actions, Spell Book, ranges, Resource / Companion / Counterspell rules.
//   - The Ice Storm rules PDF (…/images/1/14/Casting-Shadows-Ice-Storm-Rules.pdf):
//     5–6 player 10-hex map, Freeze and Stun.
//   - Hex Tile Reference Sheet PDF (…/images/d/df/CastingShadows_HexRefSheet_BISMRKS.pdf):
//     every hex tile's effect, base + Ice Storm + Molten Rock.
//   - The wiki's per-card pages ("Casting Shadows - <card>"): card text, level,
//     Collection Cost, range and copy counts for the base deck, and player-board texts.
//
// NOT CONFIRMED (no archived source):
//   - Frill the Regenerator's Shadow Ability (its board page was never archived).
//   - The expansions' cards and characters. The official card lists are known
//     (see CS_ICE_STORM_OFFICIAL_CARDS / CS_MOLTEN_ROCK_OFFICIAL_CARDS in cards.ts) but
//     not their texts, so the expansion decks here are the app's own reconstruction
//     and do NOT match the printed cards. Characters carry the official names and
//     home hexes; their Shadow Abilities are placeholders except where noted.
//   - The Molten Rock rulebook (Fortify, Scorch). Cobble Cove's and Fiery Meadows'
//     on-hit effects are therefore not modeled; the reconstructed Molten Rock cards'
//     Fortify shield and Burn are this app's own mechanics.
//   - Resource-die faces (only three faces of each die are visible in the rulebook art).
//   - Reshuffling the discard pile when the Main deck runs out (the rules don't say).

import type { GameStateShape } from '@/core/module';
import type { ExpansionConfig, ExpansionMeta, PlayerId } from '@/core/types';
import type { LogEntry } from '@/core/state';

// ============================================================================
// Hex Map & Resources
// ============================================================================

export type CsHexId =
  // Base game (7 tiles)
  | 'ancient-rune'
  | 'dusty-desert'
  | 'underground-volcano'
  | 'amber-mountain'
  | 'floating-lake'
  | 'dark-forest'
  | 'mushroom-cave'
  // The Ice Storm
  | 'mushroom-bog'
  | 'desolate-glacier'
  | 'floating-temple'
  // The Molten Rock
  | 'sacred-falls'
  | 'cobble-cove'
  | 'fiery-meadows';

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
  /** Axial coordinates on the map (pointy-top), fixed at setup by the tile's map position. */
  q: number;
  r: number;
  /** Token added to your Resource Pool when you start your turn here. */
  startTurnResource: CsResource | null;
  /** A face-up Main-deck card sits next to this tile (set by map position at setup). */
  hasMainDeckSlot: boolean;
  faceUpCard: CsCard | null;
  effectText: string;
  expansion?: CsExpansionId;
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

/**
 * The five official range types (rulebook p.16):
 *   same          — only your current Hex tile
 *   sameOrAdjacent — your current Hex tile and any adjacent Hex tile
 *   adjacent      — any adjacent Hex tile, not your current one
 *   upToTwo       — your current Hex tile and up to 2 Hex tiles away
 *   twoNotSame    — up to 2 Hex tiles away, not your current one
 */
export type CsSpellRange = 'same' | 'adjacent' | 'sameOrAdjacent' | 'upToTwo' | 'twoNotSame';

export interface CsResourceCost {
  redGem?: number;
  blueGem?: number;
  anyGem?: number;
  redOrb?: number;
  blueOrb?: number;
  anyOrb?: number;
  /** Exactly a Purple Gem / Orb (same-colour conversions). */
  purpleGem?: number;
  purpleOrb?: number;
  shadowFragment?: number;
  cursedCrystal?: number;
}

export interface CsCastTier {
  cost: CsResourceCost;
  damage: number;
  /** Hex-targeting spells that hit several Hex tiles (Sudden Doom: 1/2/3 tiles). Default 1. */
  hexCount?: number;
  heal?: number;
  produce?: CsResource[];
  inflictStun?: boolean;
  inflictFreeze?: boolean;
  inflictBurn?: boolean;
  gainFortify?: number;
  gainShadowEnergy?: number;
  label: string;
}

/** When a Counterspell may be revealed. Every base-game Counterspell answers Attack Spell DMG. */
export type CsCounterTrigger = 'attackSpellDamage' | 'anyEnemyDamage';

export interface CsCard {
  id: number;
  kind: string;
  name: string;
  type: CsCardType;
  level: 1 | 2 | 3;
  collectionCost: CsResourceCost;
  /** The gray Spell symbol in a Collection Cost: discard an Attack or Conversion Spell of this level. */
  requiresSpellLevel?: 1 | 2;
  /** For Attack / Conversion spells: the cast options ("spend up to N" spells have one per N). */
  castTiers?: CsCastTier[];
  range?: CsSpellRange;
  targetsAllOnHex?: boolean;
  /** Resource cards: the token(s) added when you move the card to the discard pile. */
  grantsResource?: CsResource;
  counterTrigger?: CsCounterTrigger;
  inflictStun?: boolean;
  inflictFreeze?: boolean;
  inflictBurn?: boolean;
  gainFortify?: number;
  expansion?: CsExpansionId;
  text: string;
}

export type CsForm = 'light' | 'shadow';

/** How a Shadow Ability is aimed (drives the prompt and the AI). */
export type CsAbilityAim =
  | { kind: 'none' }
  | { kind: 'player'; range: CsSpellRange }
  | { kind: 'hex'; range: CsSpellRange }
  /** Nuzzle the Savage: choose how much HP to give up (1..max). */
  | { kind: 'amount'; max: number };

export interface CsCharacterDef {
  id: string;
  lightName: string;
  shadowName: string;
  homeHex: CsHexId;
  shadowAbilityCost: number;
  shadowAbilityText: string;
  aim: CsAbilityAim;
  /** The ability text was read off the printed board. */
  confirmed: boolean;
  expansion?: CsExpansionId;
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
  /** Ice Storm Stun token: roll 4 Resource dice instead of 5. */
  stunned: boolean;
  /** Ice Storm Freeze token: cannot Travel. */
  frozen: boolean;
  /** Reconstructed Molten Rock mechanic (unconfirmed): absorbs incoming DMG once. */
  fortified: number;
  /** Reconstructed Molten Rock mechanic (unconfirmed): 1 DMG at the end of your turn. */
  burning: boolean;
}

/**
 * One hit of an attack, parked while its target decides whether to reveal a
 * Counterspell. An attack that hits several casters (a hex-wide spell, Kit's
 * ability) resolves them one at a time in turn order; `spec` is the attack as
 * cast, so each later target gets its own reductions rather than the previous
 * target's.
 */
export interface CsPendingAttack {
  attackerId: PlayerId;
  targetId: PlayerId;
  /** DMG to this target after its own reductions (hex tile, companion, Fortify). */
  damage: number;
  /** This target's DMG cannot be reduced. */
  unreducible: boolean;
  remainingTargetIds: PlayerId[];
  spec: CsAttackSpecState;
}

/**
 * A "you may …" the turn player gets in the middle of an action, parked until they answer:
 *   hexStatus  — Desolate Glacier / Floating Temple: after you deal DMG there, spend an Orb to Freeze / Stun that enemy.
 *   stagStrike — Charging Stag: after you Cast an Attack Spell, spend 1 Gem to deal 2 DMG to an enemy on an adjacent hex.
 *   ravenHeal  — Recovery Raven: after you Cast a Conversion Spell, spend 1 Orb to gain 1 HP.
 *   tortoise   — Crushing Tortoise: ending your turn on an enemy's hex, deal them 1 DMG.
 */
export type CsPendingOffer =
  | {
      kind: 'hexStatus';
      playerId: PlayerId;
      targetId: PlayerId;
      effect: 'freeze' | 'stun';
      cost: CsResourceCost;
      /** Where to pick the attack back up once the offer is answered. */
      resume: { spec: CsAttackSpecState; queue: PlayerId[] } | null;
    }
  | { kind: 'stagStrike'; playerId: PlayerId; options: PlayerId[]; cost: CsResourceCost }
  | { kind: 'ravenHeal'; playerId: PlayerId; cost: CsResourceCost }
  /** Crushing Tortoise, at the end of your turn: deal 1 DMG to an enemy on your hex (asked once per enemy). */
  | { kind: 'tortoise'; playerId: PlayerId; options: PlayerId[] };

/** An attack as cast (JSON form, so it can wait inside a pending offer). */
export interface CsAttackSpecState {
  attackerId: PlayerId;
  baseDamage: number;
  unreducible: boolean;
  fromAttackSpell: boolean;
  inflictStun?: boolean;
  inflictFreeze?: boolean;
  inflictBurn?: boolean;
}

/** Ice Storm: you Stunned the player whose turn it is — you may take a Resource from their pool. */
export interface CsPendingStunSteal {
  byId: PlayerId;
  victimId: PlayerId;
}

// ============================================================================
// Config
// ============================================================================

export type CsExpansionId = 'ice-storm' | 'molten-rock';

export const CS_EXPANSIONS: readonly ExpansionMeta[] = [
  {
    id: 'ice-storm',
    name: 'The Ice Storm',
    summary:
      'Freeze & Stun (official), 3 hex tiles (official), Frost & Talon, and a 5–6 player map. Its cards are reconstructed, not the printed ones.',
    verified: false,
  },
  {
    id: 'molten-rock',
    name: 'The Molten Rock',
    summary:
      '3 hex tiles (official), Dread & Ashe, and a 5–6 player map. Its cards and the Burn / Fortify rules are reconstructed, not the printed ones.',
    verified: false,
  },
];

export interface CsConfig extends ExpansionConfig {
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
  | 'awaitingOffer'
  | 'awaitingStunSteal'
  | 'gameOver';

export interface CsState extends GameStateShape {
  subPhase: CsSubPhase;

  hexes: Record<CsHexId, CsHexTile>;
  boards: Record<PlayerId, CsPlayerBoard>;
  eliminated: PlayerId[];

  mainDeck: CsCard[];
  mainDiscard: CsCard[];
  /** Used Counterspells go to the bottom of this deck (they never hit a discard pile). */
  counterspellDeck: CsCard[];
  companionDeck: CsCard[];
  companionPortal: CsCard[];

  turnPlayerId: PlayerId;
  actionPointsRemaining: number;
  /** This turn's rolled Resource dice; `diceSlots[i]` is which of the 5 dice (0-1 red, 2-3 blue, 4 purple) rolled `dicePool[i]`. */
  dicePool: CsResource[];
  diceSlots: number[];
  /** Tokens added to the Resource Pool (hex tiles, Resource cards, Conversion Spells). */
  bonusPool: CsResource[];
  /** Status tokens the turn player started the turn with — removed at the end of that turn. */
  turnStartStatus: { frozen: boolean; stunned: boolean };

  pendingAttack: CsPendingAttack | null;
  pendingOffer: CsPendingOffer | null;
  pendingStunSteal: CsPendingStunSteal | null;
  winnerId: PlayerId | null;

  log: LogEntry[];
  logSeq: number;

  config: CsConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type CsAction =
  /** `dice[i]` is die `slots[i]`'s face (slots default to 0..4). A Stunned caster rolls 4, choosing the die to leave out. */
  | { type: 'rollResourceDice'; playerId: PlayerId; dice: CsResource[]; slots?: number[] }
  | { type: 'travel'; playerId: PlayerId; toHexId: CsHexId }
  | {
      type: 'rerollDice';
      playerId: PlayerId;
      diceIndices: number[];
      newValues: CsResource[];
    }
  | {
      type: 'protect';
      playerId: PlayerId;
      /** Occult Octo: the adjacent Hex tile to deal 1 DMG to (omit to decline). */
      targetHexId?: CsHexId;
      clearStatus?: 'cursedCrystal' | 'burning';
      /** Swamp Monster: how many Cursed Crystals to remove (default 1). */
      count?: number;
    }
  | { type: 'refreshHexCard'; playerId: PlayerId }
  | {
      type: 'collectCard';
      playerId: PlayerId;
      fromCounterspellDeck?: boolean;
      /** The book card discarded to pay a Spell requirement, or to make room in a full book. */
      replaceSpellId?: number;
    }
  | { type: 'useResourceCard'; playerId: PlayerId; cardId: number }
  | {
      type: 'castSpell';
      playerId: PlayerId;
      spellId: number;
      tierIndex?: number;
      targetPlayerId?: PlayerId;
      targetHexId?: CsHexId;
      /** Multi-hex tiers (Sudden Doom). */
      targetHexIds?: CsHexId[];
    }
  | {
      type: 'useShadowAbility';
      playerId: PlayerId;
      targetPlayerId?: PlayerId;
      targetHexId?: CsHexId;
      /** Nuzzle the Savage: HP to give up (and DMG to deal). */
      amount?: number;
    }
  | { type: 'transformAndEndTurn'; playerId: PlayerId; transform?: boolean }
  | { type: 'pickCompanion'; playerId: PlayerId; companionId: number }
  | {
      type: 'respondCounterspell';
      playerId: PlayerId;
      counterspellId?: number;
      escapeHexId?: CsHexId;
    }
  | { type: 'answerOffer'; playerId: PlayerId; accept: boolean; targetPlayerId?: PlayerId }
  /** `poolIndex` indexes [...bonusPool, ...dicePool]; omit to take nothing. */
  | { type: 'stunSteal'; playerId: PlayerId; poolIndex?: number };
