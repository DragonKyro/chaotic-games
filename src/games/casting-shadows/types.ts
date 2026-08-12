// Casting Shadows — types + design outline. NO LOGIC YET.
//
// ============================================================================
// ⚠ CONFIDENCE WARNING
// ============================================================================
// This is the least-verified outline in the project. The expansion names below
// are confirmed from the publisher's store (Unstable Games / TeeTurtle), but the
// RULES are reconstructed from general knowledge of the game and the components
// sold alongside it (central board, per-player play mats, resource dice sets,
// character standees in paired "light form / shadow form" sets).
//
// Do not write the reducer from this file. Get the rulebook first, then rewrite
// these types. Everything below marked ⚠ is a guess.
//
// ============================================================================
// Core loop (⚠ reconstructed)
// ============================================================================
// A dice-driven battle game on a shared modular board. Broad shape:
//   - Each player controls a character that has a light form and a SHADOW form
//     it transforms into as it powers up (the store sells standees in pairs, e.g.
//     "Nuzzle Thornwood & Nuzzle the Savage").
//   - Turns involve moving on the board, gathering resources (resource dice),
//     crafting/casting spells from cards, and battling monsters or other players.
//   - Combat resolves by rolling dice against a target, modified by spells and
//     equipment.
//   - ⚠ Win condition unknown: likely first to a shadow/victory threshold.
//
// ============================================================================
// What this game adds to the engine
// ============================================================================
// 1. SPATIAL STATE. The first game in this project with a board — tiles,
//    positions, adjacency, movement ranges. Everything so far has been zones
//    (hand / deck / tableau). Positions are plain coordinates in state; keep
//    adjacency as a pure function over the tile layout, not stored edges.
// 2. DICE POOLS, not single rolls. Multiple dice rolled and allocated. Same
//    determinism rule as Here to Slay: the acting client rolls and the results
//    ride along in the action payload.
// 3. PLAYER-VS-PLAYER COMBAT with a defender who gets to respond — another
//    reaction window, but two-sided rather than table-wide.

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Board (⚠ all guesses)
// ============================================================================

/** Axial coordinate on the central board. ⚠ Hex vs square grid unconfirmed. */
export interface CsPosition {
  q: number;
  r: number;
}

/** ⚠ Terrain types are a placeholder — the real set comes from the board art. */
export type CsTerrain = 'forest' | 'mountain' | 'water' | 'ash' | 'ice' | 'void';

export interface CsTile {
  position: CsPosition;
  terrain: CsTerrain;
  /** Resource harvested by ending movement here, if any. */
  yields: CsResource | null;
}

// ============================================================================
// Resources & spells (⚠)
// ============================================================================

/** ⚠ Placeholder resource set — "Sparkle Core" dice are sold as an add-on. */
export type CsResource = 'spark' | 'ember' | 'frost' | 'bloom' | 'shadow';

export interface CsSpellCard {
  id: number;
  name: string;
  /** Resources that must be spent to cast. */
  cost: Partial<Record<CsResource, number>>;
  text: string;
  source: 'base' | CsExpansionId;
}

// ============================================================================
// Characters
// ============================================================================

/** Each character has two forms; the shadow form is the powered-up state. */
export type CsForm = 'light' | 'shadow';

export interface CsCharacter {
  id: string;
  /** e.g. "Nuzzle Thornwood" / "Nuzzle the Savage". */
  lightName: string;
  shadowName: string;
  source: 'base' | CsExpansionId;
}

export interface CsPlayerBoard {
  character: CsCharacter | null;
  form: CsForm;
  position: CsPosition | null;
  health: number;
  resources: Record<CsResource, number>;
  /** Spells crafted and available to cast. */
  spells: CsSpellCard[];
  /** ⚠ Progress toward transformation / victory. Mechanic unconfirmed. */
  shadowPoints: number;
}

// ============================================================================
// Combat (⚠)
// ============================================================================

export interface CsPendingCombat {
  attackerId: PlayerId;
  /** A player, or a monster id on the board. */
  defenderId: PlayerId | null;
  defenderMonsterId: number | null;
  /** Dice rolled by the attacking client and broadcast. */
  attackDice: number[];
  /** Defender's response dice, once they act. */
  defenceDice: number[] | null;
  spellsPlayed: { playerId: PlayerId; cardId: number }[];
}

// ============================================================================
// Config
// ============================================================================

export type CsExpansionId = 'ice-storm' | 'molten-rock';

export const CS_EXPANSIONS: readonly ExpansionMeta[] = [
  {
    id: 'ice-storm',
    name: 'The Ice Storm',
    summary: 'Expansion — new characters, spells and board content. Contents need the rulebook.',
    verified: true,
  },
  {
    id: 'molten-rock',
    name: 'The Molten Rock',
    summary: 'Expansion — new characters, spells and board content. Contents need the rulebook.',
    verified: true,
  },
];

export interface CsConfig extends ScaffoldConfig {
  expansions: CsExpansionId[];
  /** Chosen character per seat, keyed by PlayerId. Empty until picked in the lobby. */
  characterByPlayer: Record<PlayerId, string>;
}

// ============================================================================
// State
// ============================================================================

export type CsSubPhase =
  | 'awaitingCharacterPick'
  | 'awaitingMovement'
  | 'awaitingAction'
  | 'awaitingSpellCast'
  | 'awaitingCombatDefence'
  | 'gameOver';

export interface CsState extends GameStateShape {
  subPhase: CsSubPhase;

  /** The central board. Layout is modular, so tiles live in state. */
  tiles: CsTile[];
  boards: Record<PlayerId, CsPlayerBoard>;

  spellDeck: CsSpellCard[];
  spellDiscard: CsSpellCard[];

  pendingCombat: CsPendingCombat | null;

  config: CsConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type CsAction =
  | { type: 'pickCharacter'; playerId: PlayerId; characterId: string }
  | { type: 'move'; playerId: PlayerId; to: CsPosition }
  | { type: 'harvest'; playerId: PlayerId }
  | { type: 'craftSpell'; playerId: PlayerId; cardId: number }
  | { type: 'castSpell'; playerId: PlayerId; cardId: number; targetPlayerId?: PlayerId; targetPosition?: CsPosition }
  | { type: 'attack'; playerId: PlayerId; targetPlayerId?: PlayerId; targetMonsterId?: number; dice: number[] }
  | { type: 'defend'; playerId: PlayerId; dice: number[]; spellCardIds: number[] }
  | { type: 'transform'; playerId: PlayerId }
  | { type: 'endTurn'; playerId: PlayerId };

// ============================================================================
// Open questions — ALL of them, effectively
// ============================================================================
// 1. Get the rulebook. Everything above is provisional.
// 2. Player count (⚠ believed 2–4) and whether expansions change it.
// 3. Board geometry: hex or square, fixed or modular per match.
// 4. The real resource set and how the resource dice work.
// 5. Win condition and what shadowPoints actually represents.
// 6. Whether combat is symmetric (both roll) or attacker-only vs a defence value.
// 7. Character roster for base + both expansions.
