// Here to Slay — types + design outline. NO LOGIC YET.
//
// ============================================================================
// Core loop
// ============================================================================
// Party-building + dice. Each turn you get 3 ACTION POINTS, spent on:
//   draw a card (1)  ·  play a hero to your party (1)  ·  equip an item (1)
//   attack a monster (2)  ·  use a hero's ability (1, requires a dice roll)
//   discard and redraw (1)  ·  play a Challenge/Modifier (free, out of turn)
// Two win conditions: slay 3 monsters, OR assemble a full party (one hero of
// each of the 6 base classes; your Party Leader's class counts).
//
// ============================================================================
// New primitives this game needs
// ============================================================================
// 1. DICE. Rolls are 2d6. Per the project's determinism rule the roll must be
//    folded into the action payload by the acting player, not drawn from state
//    mid-reducer — same pattern the card-collecting games used for draws.
// 2. TWO stacked interrupt types, both out-of-turn:
//      Challenge — cancels a hero/item/ability play outright, and can itself
//                  be challenged (same LIFO stack as Nope/Neigh).
//      Modifier  — does NOT cancel; adds +/- to a pending dice roll, and
//                  several can pile on before the roll is finalised.
//    So the reaction window needs to support "cancel" and "modify" responses,
//    and Modifiers open a window on a ROLL rather than on a card play.
// 3. Per-class thresholds: hero abilities and monster attacks each have a
//    target number the modified roll must meet.

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

// ============================================================================
// Classes
// ============================================================================

/** The six base classes. Each has a Party Leader and a set of heroes. */
export type HtsBaseClass =
  | 'fighter'
  | 'bard'
  | 'guardian'
  | 'ranger'
  | 'thief'
  | 'wizard';

/** Classes added by expansions. */
export type HtsExpansionClass =
  | 'warrior'      // Warriors & Druids
  | 'druid'        // Warriors & Druids
  | 'berserker'    // Berserkers & Necromancers
  | 'necromancer'  // Berserkers & Necromancers
  | 'dragon';      // sold as dice/meeple sets — needs confirming as a playable class

export type HtsClass = HtsBaseClass | HtsExpansionClass;

// ============================================================================
// Cards
// ============================================================================

export type HtsCardType =
  | 'partyLeader'
  | 'hero'
  | 'item'          // equipped to a hero
  | 'magic'         // one-shot effect
  | 'challenge'     // out-of-turn cancel
  | 'modifier'      // out-of-turn +/- to a roll
  | 'monster';      // sits in the shared monster row until slain

export interface HtsCard {
  id: number;
  name: string;
  type: HtsCardType;
  /** Heroes, Party Leaders and some items belong to a class. */
  class: HtsClass | null;
  text: string;
  /** Roll needed for a hero's ability, when it has one. */
  abilityThreshold: number | null;
  /** Modifier cards only: the signed adjustment they apply to a roll. */
  modifier: number | null;
  source: 'base' | HtsExpansionId;
}

/**
 * A monster in the shared row. Attacking requires 2 action points; the
 * modified roll is compared against both thresholds to decide the outcome.
 */
export interface HtsMonster {
  card: HtsCard;
  /** Class requirement to be allowed to attack it at all (e.g. 2+ Fighters). */
  requirement: string;
  /** Roll at or above this = slain, and you take the card as a trophy. */
  slayThreshold: number;
  /** Roll at or below this = the monster's penalty hits you. */
  failThreshold: number;
}

/** A hero in a party, with whatever is equipped to it and whether it's exhausted. */
export interface HtsPartyHero {
  card: HtsCard;
  equippedItems: HtsCard[];
  /** Abilities are once per turn — reset at end of turn. */
  usedThisTurn: boolean;
}

// ============================================================================
// Reaction stack — two flavours
// ============================================================================

/** An open reaction window on a card play, answerable with Challenge. */
export interface HtsPendingPlay {
  byPlayerId: PlayerId;
  card: HtsCard;
  targetPlayerId: PlayerId | null;
  /** Challenges stacked on top, LIFO. Odd count = cancelled. */
  challengeCount: number;
  respondedPlayerIds: PlayerId[];
}

/**
 * An open reaction window on a DICE ROLL, answerable with Modifier cards.
 * The roll is already fixed (folded into the action payload) — modifiers change
 * the total, not the dice.
 */
export interface HtsPendingRoll {
  byPlayerId: PlayerId;
  reason: 'heroAbility' | 'monsterAttack';
  /** The two d6 values, chosen by the acting client and broadcast. */
  dice: [number, number];
  /** Signed modifiers played so far, in play order. */
  modifiers: { playerId: PlayerId; cardId: number; amount: number }[];
  /** What the modified total must reach. */
  threshold: number;
  /** Hero ability or monster being resolved. */
  sourceCardId: number;
  respondedPlayerIds: PlayerId[];
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
    summary: 'Holiday-themed expansion. Contents need confirming from the rulebook.',
    verified: true,
  },
];

export interface HtsConfig extends ScaffoldConfig {
  expansions: HtsExpansionId[];
  /**
   * Full-party win requires one hero per class. Adding classes changes what
   * "full" means — needs a rulebook answer on whether expansions raise the
   * requirement or keep it at 6 distinct classes.
   */
  monstersToWin: number;
}

// ============================================================================
// State
// ============================================================================

export type HtsSubPhase =
  | 'awaitingAction'        // active player spending action points
  | 'awaitingChallenge'     // a play is on the stack
  | 'awaitingModifiers'     // a roll is open for +/- cards
  | 'awaitingTarget'
  | 'awaitingDiscard'
  | 'gameOver';

export interface HtsState extends GameStateShape {
  subPhase: HtsSubPhase;

  deck: HtsCard[];
  discard: HtsCard[];
  /** Shared row of available monsters, refilled from the monster deck. */
  monsterRow: HtsMonster[];
  monsterDeck: HtsMonster[];

  hands: Record<PlayerId, HtsCard[]>;
  /** null until the leader is dealt at setup. Their class counts toward a full party. */
  partyLeaders: Record<PlayerId, HtsCard | null>;
  parties: Record<PlayerId, HtsPartyHero[]>;
  /** Slain monsters kept as trophies — 3 wins the game. */
  trophies: Record<PlayerId, HtsMonster[]>;

  /** Action points left this turn. Starts at 3. */
  actionPointsRemaining: number;

  pendingPlay: HtsPendingPlay | null;
  pendingRoll: HtsPendingRoll | null;

  config: HtsConfig;
}

// ============================================================================
// Actions
// ============================================================================
// Dice values are supplied by the acting client so every peer reduces the same
// roll. Never roll inside the reducer.

export type HtsAction =
  | { type: 'drawCard'; playerId: PlayerId }
  | { type: 'playHero'; playerId: PlayerId; cardId: number }
  | { type: 'equipItem'; playerId: PlayerId; cardId: number; heroCardId: number }
  | { type: 'playMagic'; playerId: PlayerId; cardId: number; targetPlayerId?: PlayerId }
  | { type: 'useHeroAbility'; playerId: PlayerId; heroCardId: number; dice: [number, number] }
  | { type: 'attackMonster'; playerId: PlayerId; monsterCardId: number; dice: [number, number] }
  | { type: 'discardAndRedraw'; playerId: PlayerId; cardIds: number[] }
  /** Out of turn: cancel a pending play. Challengeable in turn. */
  | { type: 'playChallenge'; playerId: PlayerId; cardId: number }
  | { type: 'declineChallenge'; playerId: PlayerId }
  /** Out of turn: adjust a pending roll. Several may stack. */
  | { type: 'playModifier'; playerId: PlayerId; cardId: number }
  | { type: 'declineModifier'; playerId: PlayerId }
  | { type: 'chooseTarget'; playerId: PlayerId; targetPlayerId: PlayerId; targetCardId?: number }
  | { type: 'endTurn'; playerId: PlayerId };

// ============================================================================
// Open questions
// ============================================================================
// 1. Full card list per class (base + 3 expansions) needs the rulebooks.
// 2. Exact action-point costs need confirming — the list at the top of this
//    file is from memory and MUST be checked before the reducer is written.
// 3. Monster requirements ("you must have 2+ Fighters") are per-card text;
//    model as a predicate on the party once the list is in hand.
// 4. Does the full-party win condition scale with expansion classes, or stay at
//    the 6 base classes? Affects HtsConfig.
// 5. Is 'dragon' a real playable class or just a cosmetic dice/meeple line?
//    Sold as "Dragon Class Meeple Set" / "Dragon Class Dice Set" — unconfirmed.
// 6. Modifier windows are the fiddliest part: multiple players may stack
//    modifiers on one roll, so the window must iterate until everyone passes.
