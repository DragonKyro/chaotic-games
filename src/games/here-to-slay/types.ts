// Here to Slay — types and design notes.
//
// Rules sources (audited 2026-11):
//   - Base game: the official rulebook (retail and 2020 Kickstarter editions,
//     unstablegameswiki.com uploads via the Wayback Machine) and the official
//     wiki "Base Deck - Inventory List" (6 Party Leaders, 15 Monsters, 115-card
//     main deck). cards.ts matches that inventory card for card.
//   - Warriors & Druids (rebuilt 2026-11-19, `verified`): the official wiki
//     "Here To Slay Dragon Warrior and Druid Expansion - Inventory List" and
//     "- Expansion Instructions" pages, the W&D rulesheet PDF (archived wiki
//     upload, mirrored in DavidManiaM/HereToSlay: 7-class win, Druids roll that
//     number or lower, two-Item Warriors with at most one Mask), and the
//     official per-card wiki pages (text, roll icons, Monster bands, "Two Item
//     cards allowed" notes) for 25 of its 35 cards. The other ten (Critical
//     Fang, Looting Lupo, Tenacious Timber, Even Bigger Ring, Cursed Glove,
//     Soul Tether, Beast Call, Rapid Refresh, Modifier +1/-1, The Piercing
//     Howl) come from the Here to Slay fandom wiki and ShadowzLmao2/
//     HereToSlay-Online (src/cards.py), which agree wherever they overlap.
//   - Berserkers & Necromancers (rebuilt 2026-11-19, `verified`): the official
//     wiki "Here To Slay Dragon Berserkers and Necromancers Expansion -
//     Inventory List" and "- Expansion Instructions" pages (7-class win,
//     two-Item Berserkers with at most one Mask, Necromancers pay the cost at
//     the start of their effect or get nothing), and the official per-card
//     pages for 25 of its 33 different cards. The other eight (Brawling Spirit, Gruesome
//     Gladiator, Rabid Beast, Unbridled Fury, Goblet of Caffeination,
//     Soulbound Grimoire, The Gnawing Dread, The Raging Manticore) come from
//     miurary/here_to_slay (wiggles/src/cards/*.json) and ShadowzLmao2, which
//     agree on every B&N card, and the fandom wiki where it has a page.
//
// ⚠ Here to Sleigh is still unverified: its card pool is an approximation
// (the published set has Gift cards, a Stockpile and REGIFT / EXCHANGE), and
// HTS_EXPANSIONS marks it `verified: false`.
//
// UNCONFIRMED (modeled as stated, listed in Rules.tsx):
//   - The two-Item symbol on Blinding Blade, Looting Lupo, Tenacious Timber,
//     Brawling Spirit, Gruesome Gladiator, Rabid Beast and Unbridled Fury (no
//     source shows one; modeled as one Item).
//   - "SACRIFICE / DESTROY a card" offers Heroes and equipped Items, not slain
//     Monster cards; Brawling Spirit's "cards in their Party" counts Heroes and
//     their Items (the rulebook's Party is "the area in front of you in which
//     you play Hero cards and Item cards").
//   - Majestelk's "+5 or -5 to each of your rolls": declared per roll, after
//     the dice, like a two-option Modifier.
//   - W&D Modifier +4 / -4 ("if the roll is modified above 12 / below 2"):
//     checked against that side's final total.
//   - A class Challenge's requirement met by a Party Leader of that class (as
//     for a Monster's class symbol).
//   - Classes needed to win with BOTH class expansions: each rulesheet says 7.
//
// Rules NOT modeled (deliberately):
//   - "When modifying another player's roll you may wait until that player
//     chooses their targets": the Modifier window closes before targets are
//     picked.
//   - The 2v2 team variant (Kickstarter insert).
//   - Optional pure-upside effects are taken automatically: "you may DRAW a
//     card" (Arctic Aries, Dracos, Crowned Serpent), "you may spend an extra
//     action point this turn" (Temporal Hourglass, Beast Call, Unbridled
//     Fury); Rex Major's "may reveal it" reveals automatically (logged
//     publicly). Soulbound Grimoire's 2 action points apply to the paid roll,
//     not to a free "roll … immediately".

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
  /**
   * Item slots (default 1). 2 for the Warrior / Berserker Heroes printed with
   * the two-Item symbol — at most one of them a Mask (W&D and B&N rulesheets).
   */
  maxItems?: number;
  /** Allowed signed values for a Modifier card (e.g. [2, -2] or [4]). */
  modifierChoices: number[] | null;
  /**
   * Class Challenge cards (Warrior / Druid / Berserker / Necromancer
   * Challenge): playable only with that class in your Party, +3 to your
   * Challenge roll.
   */
  challengeClass?: HtsBaseClass;
  challengeBonus?: number;
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
  failPenalty: HtsFailPenalty;
}

/** What a Monster does to you when your attack roll lands in its fail range. */
export type HtsFailPenalty =
  | 'sacrificeHero'
  | 'discard2'
  /** Doombringer (B&N): DISCARD your hand. */
  | 'discardHand'
  /** Reptilian Ripper (B&N): SACRIFICE 2 Hero cards. */
  | 'sacrificeTwoHeroes';

export interface HtsPartyHero {
  card: HtsCard;
  equippedItem: HtsCard | null;
  /** The second Item on a two-Item Warrior / Berserker. */
  extraItems?: HtsCard[];
  usedThisTurn: boolean;
  /**
   * Rolls for this Hero's effect this turn. Normally 0 or 1; Bottomless Bag
   * allows more (one action point each).
   */
  rollsThisTurn?: number;
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
  /**
   * Queued once this play has resolved (or been challenged away): the next
   * step of an effect that plays cards one after another (Glowing Antler).
   */
  after?: HtsPrompt[];
}

/** Which cards a pile search (or a look at a hand) may take. */
export type HtsPileFilter = 'any' | 'hero' | 'item' | 'magic' | 'modifier' | 'challenge' | 'heroOrItem';

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
  /** challengeDuel: the Challenge card's own bonus to the challenger (class Challenges: +3). */
  challengerBonus?: number;
  threshold: number;
  /** When true (Druid Hero ability or low-roll effect), roll succeeds on <= threshold. */
  rollLow?: boolean;
  modifiers: HtsAppliedModifier[];
  responderQueue: PlayerId[];
  /** Biggest Ring Ever has been used on this roll (once per roll). */
  ringUsed?: boolean;
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
      mode: 'destroy' | 'sacrifice' | 'steal' | 'swapGive' | 'bounceItem' | 'equipItem' | 'returnCursedItem';
      /**
       * Follow-ups once the target is chosen: 'shurikittyDestroy',
       * 'wigglesStealAndRoll', 'unbridledFuryDestroy' (+1 AP on a Berserker),
       * 'majestelkCost' / 'beholdenCost' (a cost: the rest of the effect is
       * queued only once it is paid).
       */
      effectTag?: string;
      /** For mode 'equipItem': the Item card (still in the chooser's hand) being played. */
      itemCardId?: number;
      /** Tipsy Tootie: the Hero that moves to the target's Party once the steal is done. */
      sourceHeroId?: number;
    }
  | {
      /**
       * "SACRIFICE a card" / "DESTROY a card": any card in a Party — a Hero
       * (with its Items) or a single equipped Item. Party Leaders never; slain
       * Monster cards are not offered (UNCONFIRMED, see Rules).
       */
      kind: 'choosePartyCard';
      playerId: PlayerId;
      reason: string;
      optional: boolean;
      scope: 'own' | 'others';
      mode: 'sacrifice' | 'destroy';
      filter: 'any' | 'item';
      effectTag?:
        /** Rabid Beast: keep sacrificing (tally counts them), then destroy that many. */
        | 'rabidBeastSacrifice'
        /** Bone Collector's cost: the rest of its effect follows once an Item is sacrificed. */
        | 'boneCollectorCost';
      tally?: number;
    }
  | {
      /** Big Buckley (attack, dice in the answer) / Vicious Wildcat (slay outright). */
      kind: 'chooseMonster';
      playerId: PlayerId;
      reason: string;
      mode: 'attack' | 'slay';
    }
  | {
      /** Roaryal Guard: "Choose a Class." */
      kind: 'chooseClass';
      playerId: PlayerId;
      reason: string;
      classes: HtsBaseClass[];
      effectTag: 'roaryalGuard';
    }
  | {
      /** Goblet of Caffeination: after a failed roll, sacrifice the Goblet and roll again (dice in the answer). */
      kind: 'rerollHero';
      playerId: PlayerId;
      heroCardId: number;
      itemCardId: number;
      reason: string;
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
        | 'playFreeMagicsUpTo2'
        | 'snowballFreeMagic'
        | 'shadowSaintCost'
        | 'lightningLabrysDiscard'
        | 'bostonTerrorGive';
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
      /** Which play of a "play up to N" sequence this is (Glowing Antler: 1, then 2). */
      sequence?: number;
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
        | 'plunderingPumaPull'
        | 'slipperyPawsPull'
        | 'dodgyDealerTrade'
        | 'heavyBearDiscard'
        | 'hopperSacrifice'
        | 'sharpFoxLook'
        | 'silentShadowSteal'
        | 'buckOmensLook'
        | 'hollowHuskLook'
        | 'bostonTerrorAsk'
        | 'lightningLabrysSacrifice'
        | 'blindingBladeStealItems'
        | 'tipsyTootieSwap'
        | 'meowzioSteal'
        | 'forcedExchangeTarget'
        | 'giftBagBanditSteal';
      sourceHeroId?: number;
      /** "Choose any player" (Blinding Blade): you may pick yourself. */
      includeSelf?: boolean;
    }
  | {
      kind: 'chooseFromPile';
      playerId: PlayerId;
      reason: string;
      optional: boolean;
      cards: HtsCard[];
      source: 'discard' | 'opponentHand' | 'bearyWisePool';
      opponentId?: PlayerId;
      /**
       * Which cards qualify. For 'discard' and 'opponentHand' the choices are
       * re-read from the live pile / hand when the prompt comes up (a queued
       * search sees what is there by then, never a stale copy).
       */
      filter?: HtsPileFilter;
      /**
       * Only these may be taken; the rest are just shown ("Look at another
       * player's hand. Choose a Hero card from their hand (if they have one)").
       */
      onlyCardIds?: number[];
      /**
       * What happens to the chosen card: 'hand' (default), 'playImmediately'
       * (add it to your hand, then play it — Challengeable), 'bringToParty'
       * (straight into your Party: not played), 'mayPlay' (add it to your hand;
       * you may play it immediately).
       */
      then?: 'hand' | 'playImmediately' | 'bringToParty' | 'mayPlay';
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
      step:
        | { type: 'draw'; count: number }
        /** Doe Fallow: "…then DRAW cards until you have 7 cards in your hand." */
        | { type: 'drawUntil'; handSize: number }
        | { type: 'moveHero'; heroCardId: number; fromPlayerId: PlayerId; toPlayerId: PlayerId };
    };

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
    summary: '31 cards, 2 Party Leaders, 2 Monsters: Druids that need low rolls, Warriors that can carry two Items. Win with 7 classes.',
    verified: true,
  },
  {
    id: 'berserkers-necromancers',
    name: 'Berserkers & Necromancers',
    summary: '31 cards, 2 Party Leaders, 2 Monsters: Berserkers that can carry two Items, Necromancers that pay a cost first. Win with 7 classes.',
    verified: true,
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

/** Effects that last "until the end of your turn" (reset when the turn passes). */
export interface HtsTurnBuffs {
  rollBonus: number;
  unchallengeable: boolean;
  shadowClawUsed: boolean;
  nobleShamanUsed?: boolean;
  gnawingDreadUsed?: boolean;
  noOpponentModifiers?: boolean;
  /** Critical Fang: "+4 to your rolls to ATTACK a Monster card until the end of your turn." */
  attackBonus?: number;
  /** Silent Shield: sacrificing / destroying a Hero lets you search the discard pile for a Hero. */
  silentShield?: boolean;
  /** Muscipula Rex's free draw has been taken this turn. */
  muscipulaUsed?: boolean;
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
  /**
   * Maegisty (W&D), until that player's next turn: a Hero in their Party that
   * would be sacrificed or destroyed returns to their hand instead.
   */
  returnToHandShield?: Record<PlayerId, boolean>;
  /** Majestelk (W&D), until that player's next turn: ±5 to each of their rolls. */
  majestelk?: Record<PlayerId, boolean>;
  /** Vicious Wildcat: "…then end your turn" — the turn ends once the current effects resolve. */
  endTurnPending?: boolean;

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
  /** Muscipula Rex: once per turn on your turn, DRAW a card without spending an action point. */
  | { type: 'muscipulaDraw'; playerId: PlayerId }
  /** Biggest Ring Ever (during the Modifier window on your own Hero roll): DISCARD up to 3 cards, +2 each. */
  | { type: 'biggestRingDiscard'; playerId: PlayerId; cardIds: number[] }
  /**
   * Majestelk (during the Modifier window): declare +5 or -5 on your own roll.
   * Owed on each of your rolls until your next turn; you can't pass until you have.
   */
  | { type: 'majestelkSign'; playerId: PlayerId; sign: 1 | -1; targetSide?: 'actor' | 'challenger' }
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
      /** chooseClass answer. */
      className?: HtsBaseClass;
    }
  | { type: 'endTurn'; playerId: PlayerId };
