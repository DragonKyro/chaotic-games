// Here to Slay — types and design notes.
//
// Rules sources (audited 2026-11):
//   - Base game: the official rulebook (retail and 2020 Kickstarter editions,
//     unstablegameswiki.com uploads via the Wayback Machine) and the official
//     wiki "Base Deck - Inventory List" (6 Party Leaders, 15 Monsters, 115-card
//     main deck). cards.ts matches that inventory card for card.
//   - Warriors & Druids: the official W&D rulesheet (7-class win, Druid low
//     rolls, two-Item Warriors, one Mask per Hero).
//
// ⚠ EXPANSION CONTENT IS UNVERIFIED. The official wiki inventory lists for all
// three expansions name cards that cards.ts does not have (W&D: Doe Fallow,
// Majestelk, Critical Fang, Silent Shield, Wolfgang Pack, Muscipula Rex, Druid /
// Warrior Challenge, Modifier +1/-1 and +2/-1; B&N: Doombringer, Reptilian
// Ripper, Biggest Ring Ever, Goblet of Caffeination, Silver Lining, Dragon's
// Bile, Soulbound Grimoire, Lightning Labrys, Modifier +7, class Challenges;
// Here to Sleigh: Gift cards, a Stockpile, REGIFT / EXCHANGE, no new Party
// Leaders or Monsters), and the effects of the cards that do share a name
// mostly differ from secondary sources. HTS_EXPANSIONS marks all three
// `verified: false` until they are rebuilt from the official card text.
// Exception: The Piercing Howl, The Noble Shaman and The Raging Manticore use
// their published text (the Here to Slay fandom wiki and two independent
// open-source implementations agree on it).
//
// Rules NOT modeled (deliberately):
//   - "When modifying another player's roll you may wait until that player
//     chooses their targets": the Modifier window closes before targets are
//     picked.
//   - The 2v2 team variant (Kickstarter insert).
//   - Optional pure-upside draws ("you may DRAW a card": Arctic Aries, Dracos,
//     Crowned Serpent) are taken automatically; Rex Major's "may reveal it"
//     reveals automatically (logged publicly).

import type { GameStateShape } from '@/core/module';
import type { ExpansionConfig, ExpansionMeta, PlayerId } from '@/core/types';
import type { LogEntry } from '@/core/state';

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
      mode: 'destroy' | 'sacrifice' | 'steal' | 'swapGive' | 'bounceItem' | 'stealItem' | 'equipItem' | 'returnCursedItem';
      effectTag?: string;
      /** For mode 'equipItem': the Item card (still in the chooser's hand) being played. */
      itemCardId?: number;
      /** Tipsy Tootie: the Hero that moves to the target's Party once the steal is done. */
      sourceHeroId?: number;
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
        | 'snowballFreeMagic';
      toPlayerId?: PlayerId;
      /** Only these cards (just drawn / pulled) may be chosen. */
      onlyCardIds?: number[];
      /**
       * Keep the prompt even when nothing is choosable. Used for "if the card
       * you drew is a Hero, you may play it" effects: always asking (and
       * letting the player look at the card) stops the prompt's mere existence
       * from telling the table what was drawn.
       */
      keepIfEmpty?: boolean;
      /** Shown to the other players instead of `reason` when `reason` would leak a hidden card. */
      publicReason?: string;
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
      /** Shurikitty: if destroyed after all, its Items go to the destroyer's hand. */
      stealItemToHand?: boolean;
    }
  | {
      /** A yes / no decision ("That player may DRAW a card"). Accept = resolvePrompt without `decline`. */
      kind: 'confirm';
      playerId: PlayerId;
      reason: string;
      effectTag: 'plunderingPumaDraw';
    }
  | {
      /**
       * Not a decision: a deferred effect step ("…, then DRAW a card") that
       * advanceFlow carries out by itself when it reaches the front of the
       * queue. Keeps "do X, then Y" in order when X needs a prompt.
       */
      kind: 'step';
      playerId: PlayerId;
      step: { type: 'draw'; count: number } | { type: 'moveHero'; heroCardId: number; fromPlayerId: PlayerId; toPlayerId: PlayerId };
    };

// ============================================================================
// Config
// ============================================================================

export type HtsExpansionId =
  | 'warriors-druids'
  | 'berserkers-necromancers'
  | 'here-to-sleigh';

// The card pools behind these three ids do NOT match the published expansions
// (see the header note) — hence `verified: false`.
export const HTS_EXPANSIONS: readonly ExpansionMeta[] = [
  {
    id: 'warriors-druids',
    name: 'Warriors & Druids',
    summary: 'Adds Warrior and Druid heroes and leaders. Card list is an approximation, not the published set.',
    verified: false,
  },
  {
    id: 'berserkers-necromancers',
    name: 'Berserkers & Necromancers',
    summary: 'Adds Berserker and Necromancer heroes and leaders. Card list is an approximation, not the published set.',
    verified: false,
  },
  {
    id: 'here-to-sleigh',
    name: 'Here to Sleigh',
    summary: 'Holiday heroes and a gift win. Not the published Gift / Stockpile rules.',
    verified: false,
  },
];

export interface HtsConfig extends ExpansionConfig {
  expansions: HtsExpansionId[];
  monstersToWin: number;
  /** Number of distinct classes needed in a Party to win (defaults to 7 with class expansions, 6 in base game). */
  classesToWin?: number;
}

// ============================================================================
// State
// ============================================================================

export type HtsSubPhase =
  /** Setup: players pick their Party Leaders one at a time (rulebook: "each player chooses a Party Leader"). */
  | 'choosingLeaders'
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

export interface HtsLeaderDraft {
  /** Who picks next is order[0]. The last to pick takes the first turn (rulebook). */
  order: PlayerId[];
  /** Party Leaders still on offer (The Shadow Claw is left out of 2-player games). */
  pool: HtsCard[];
}

/** The most recent resolved roll — public, so every device can show it. */
export interface HtsRollRecord {
  /** Increments per resolved roll; UIs key their animation on it. */
  seq: number;
  roll: HtsPendingRoll;
  actorTotal: number;
  challengerTotal: number;
  /** Name of the Hero / Monster / challenged card that was rolled for. */
  subject: string;
  outcome: 'success' | 'failure' | 'slain' | 'penalty' | 'nothing' | 'challengeWon' | 'cardStands';
}

export interface HtsState extends GameStateShape {
  subPhase: HtsSubPhase;
  /** Non-null only while subPhase is 'choosingLeaders'. */
  leaderDraft: HtsLeaderDraft | null;
  lastRoll: HtsRollRecord | null;

  deck: HtsCard[];
  discard: HtsCard[];
  monsterRow: HtsMonster[];
  monsterDeck: HtsMonster[];

  hands: Record<PlayerId, HtsCard[]>;
  /** Empty until each player has picked theirs in the leader draft. */
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
  log: LogEntry[];
  logSeq: number;

  config: HtsConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type HtsAction =
  /** Leader draft only (subPhase 'choosingLeaders'); the leader is fixed for the rest of the game. */
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
  /** The Noble Shaman's -1 (during a Modifier window). `delta` must be -1; the old ±1 is gone. */
  | { type: 'nobleShamanAdjust'; playerId: PlayerId; delta: 1 | -1; targetSide?: 'actor' | 'challenger' }
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
