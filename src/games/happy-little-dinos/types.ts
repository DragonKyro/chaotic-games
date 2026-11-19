// Happy Little Dinosaurs — types for Base Game + all 4 Expansions.
//
// Sources (audited 2026-11):
// - Base rules: official rulesheet v5 (unstablegameswiki.com/images/3/31/Happy_Little_Dinosaurs-Rules_v5.pdf,
//   via the Wayback Machine) and the wiki's "Rules of Play" page — round structure, scoring, ties,
//   Sudden Death, inversions, the 2-player variant, Point-card effect order.
// - 5–6 player rules: official 5–6 Player Expansion rulesheet (same wiki, archived) — top-two scoring.
// - Card lists and copy counts: the wiki's per-deck "Inventory List" pages.
// - Card texts: the wiki's per-card pages where archived; otherwise the GitHub dataset
//   AlessandroLongo23/HappyLittleDinosaurs (Public/Assets/Versions/*), which matched every wiki page checked.
// - Dinosaur traits: board images in the two official rulesheets (Rex, Bronto, Ceratops, Stego, Raptor,
//   Pterry's two +1s); the GitHub dataset for Pterry's −2 and the two Hazards Ahead dinosaurs.
//
// NOT MODELED / UNCONFIRMED — see the notes on each type below:
// - Hazards Ahead's Hazard tokens and Hazard cards (its rulebook is not online): every "add / remove /
//   redirect a Hazard token" clause, every Hazard card, and the dinosaurs' "Hazard +1" trait are no-ops.
// - Dinosaur Traits against a Meteor: only a trait that names Meteor (Stego) applies.
// - Two dinosaurs reaching 50 on the same move: the one further along wins, then the one with fewer Disasters.

import type { GameStateShape } from '@/core/module';
import type { ExpansionConfig, ExpansionMeta, PlayerId } from '@/core/types';
import type { LogEntry } from '@/core/state';

// ============================================================================
// Dinosaurs, Disasters, Hazards & Cards
// ============================================================================

/**
 * A Disaster's type. `meteor` is the wild type (acts as any of the three for elimination; Hazards
 * Ahead's "Coming In Hot" is printed with all three types and is modeled the same way). `lucky` is
 * Hazards Ahead's typeless "Lucky Day" Disaster, which never stays in a Disaster Area.
 */
export type HldDisasterCategory =
  | 'natural'
  | 'predator'
  | 'emotional'
  | 'meteor'
  | 'lucky';

/** What a Dinosaur Trait reacts to. `hazard` is Hazards Ahead's (unmodeled) Hazard trait. */
export type HldTraitKey = 'natural' | 'predator' | 'emotional' | 'meteor' | 'hazard';

export type HldDinoId =
  | 'nervous-rex'
  | 'cry-ceratops'
  | 'bad-luck-bronto'
  | 'stego'
  | 'pterry-dactyl'
  | 'raging-raptor'
  | 'easygoing-anky'
  | 'moody-mosasaur';

export interface HldDinoDef {
  id: HldDinoId;
  name: string;
  /** Signed trait per Disaster type faced this round (advantages > 0, disadvantages < 0). */
  traits: Partial<Record<HldTraitKey, number>>;
  /** The expansion that adds this board; base boards have none. */
  expansion?: HldExpansionId;
  text: string;
}

/**
 * Printed Disaster effects.
 * - `counts-double` — Perils of Puberty: "This card counts as 2 [type] Disasters."
 * - `scoring-bonus` — Dating Disasters: "During scoring each round, you may add 1 point to your score
 *   for each [type] Disaster card in your Disaster area."
 * - `hazard-token` — Hazards Ahead: "…you may add a Hazard token to any other player's Escape Route."
 *   NOT MODELED (Hazard tokens are not implemented).
 * - Lucky Day (Hazards Ahead): "When you add this Disaster card to your Disaster Area, move it to the
 *   bottom of the Disaster deck instead, then …" — `fruit-shower`, `treasure-trove`, `wishful-thinking`
 *   are modeled; `one-of-us` (moves a Hazard card) is a no-op because Hazard cards are not.
 */
export type HldDisasterEffect =
  | 'counts-double'
  | 'scoring-bonus'
  | 'hazard-token'
  | 'fruit-shower'
  | 'one-of-us'
  | 'treasure-trove'
  | 'wishful-thinking';

export interface HldDisasterCard {
  id: number;
  name: string;
  category: HldDisasterCategory;
  text: string;
  effect?: HldDisasterEffect;
}

/** A Hazards Ahead Hazard card — reference only; none are dealt (see the not-modeled note above). */
export interface HldHazardCard {
  id: number;
  name: string;
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
  // 5–6 Player Expansion
  | 'good-luck-rod'
  | 'isopod-swap'
  | 'voodoo-dino'
  | 'swiss-shears'
  | 'behemoth-blade'
  | 'helping-hand'
  // Perils of Puberty
  | 'trash-into-treasure'
  | 'unwanted-lunch'
  | 'handy-backpack'
  | 'ice-cream'
  | 'really-thick-glasses'
  | 'extra-sharp-stick'
  | 'bffs-help'
  | 'frenemys-curse'
  | 'joy-of-puberty'
  | 'lucky-break'
  | 'spiteful-bullying'
  // Dating Disasters
  | 'bouquet-of-flowers'
  | 'wine-bottle'
  | 'broken-high-heel'
  | 'teddy-bear'
  | 'bedazzled-belt'
  | 'heart-bomb'
  | 'stinky-perfume'
  | 'love-bug'
  | 'mixtape'
  | 'cold-feet'
  | 'box-of-chocolates'
  | 'minty-gum'
  | 'awkward-first-kiss'
  | 'baby-pictures'
  | 'crippling-shyness'
  | 'double-date'
  | 'one-week-anniversary'
  // Hazards Ahead (Hazard-token clauses not modeled)
  | 'spiky-shroom'
  | 'a-bone-to-flick'
  | 'rock-candy'
  | 'molotov-crocktail'
  | 'suck-up'
  | 'coconut-bolas'
  | 'epic-flail'
  | 'hazard-redirect';

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
// Prompts — one player's pending decision. Every "may" on a card is a prompt.
// ============================================================================

export type HldPrompt =
  /** Pet Rock / "Delicious" Smoothie: may discard a Point card (with an effect, for Smoothie) for its value. */
  | { kind: 'discardForPoints'; playerId: PlayerId; source: 'pet-rock' | 'delicious-smoothie' }
  /** Dino Grabber: may look at another player's hand and take a card. */
  | { kind: 'takeFromHand'; playerId: PlayerId }
  /** Grappling Snake (left/right neighbour) / Isopod Swap (anyone): may swap for a no-effect Point card. */
  | { kind: 'swapPoint'; playerId: PlayerId; source: 'grappling-snake' | 'isopod-swap'; targets: PlayerId[] }
  /** Fire Spray / Trash into Treasure / A Bone to Flick: discard up to 3 cards. */
  | { kind: 'discardUpTo'; playerId: PlayerId; source: 'fire-spray' | 'trash-into-treasure' | 'a-bone-to-flick'; max: number }
  /**
   * Treenoculars / Good Luck Rod ("you may look") start with `cards: null` — the player chooses whether
   * to look. Bouquet of Flowers and the Fruit Shower Lucky Day reveal straight away.
   */
  | {
      kind: 'peekDeck';
      playerId: PlayerId;
      source: 'treenoculars' | 'good-luck-rod' | 'bouquet-of-flowers' | 'fruit-shower';
      cards: HldCard[] | null;
    }
  /** Hungry Plant: may swap the Point cards of any two other players. */
  | { kind: 'swapOthers'; playerId: PlayerId }
  /** Voodoo Dino: may discard Point cards; −1 to a player's score per card. */
  | { kind: 'voodoo'; playerId: PlayerId }
  /** Unwanted Lunch: may swap hands with another player. */
  | { kind: 'swapHands'; playerId: PlayerId }
  /** Really Thick Glasses: the top Disaster stays on top or goes to the bottom. Only this player sees it. */
  | { kind: 'peekDisaster'; playerId: PlayerId; disaster: HldDisasterCard }
  /** Ice Cream! (highest score): which Disaster from your area goes to the bottom of the deck. */
  | { kind: 'iceCream'; playerId: PlayerId }
  /** Treasure Trove Lucky Day: take a Point card from the discard pile. */
  | { kind: 'treasureTrove'; playerId: PlayerId }
  /** Wishful Thinking Lucky Day: choose a player to move back 3 spaces. */
  | { kind: 'wishfulThinking'; playerId: PlayerId }
  /** Rulebook: "If a player adds a Disaster card to their Disaster Area, they may discard a card from their hand." */
  | { kind: 'discardAfterDisaster'; playerId: PlayerId };

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
    summary: 'Up to 6 players: Pterry Dactyl & Raging Raptor, 14 Disasters, 24 Point cards (Good Luck Rod, Isopod Swap, Voodoo Dino, Swiss Shears, Behemoth Blade) and 12 Instants (Helping Hand). At 5–6 players the top two scores collect.',
    verified: true,
  },
  {
    id: 'perils-of-puberty',
    name: 'Perils of Puberty',
    summary: '54-card add-on — 16 Disasters (three count double), 28 Point cards (Trash into Treasure, Ice Cream!, Unwanted Lunch, Really Thick Glasses…) and 10 Instants (BFF\'s Help, Lucky Break, Joy of Puberty…).',
    verified: true,
  },
  {
    id: 'dating-disasters',
    name: 'Dating Disasters',
    summary: '53-card add-on — 15 Disasters (three pay out every round), 26 Point cards (Teddy Bear, Heart Bomb, Cold Feet, Minty Gum…) and 12 Instants (Double Date, Baby Pictures, One Week Anniversary…).',
    verified: true,
  },
  {
    id: 'hazards-ahead',
    name: 'Hazards Ahead',
    summary: 'Up to 6 players: Easygoing Anky & Moody Mosasaur, 22 Disasters (incl. 4 Lucky Days) and 16 main-deck cards. Hazard tokens & the 12 Hazard cards are NOT modeled — the rulebook isn\'t available, so those clauses do nothing.',
    verified: false,
  },
];

/** Expansions that add two Dinosaur boards, letting 5–6 people play. */
export const HLD_SEAT_EXPANSIONS: readonly HldExpansionId[] = ['players-5-6', 'hazards-ahead'];

export interface HldConfig extends ExpansionConfig {
  expansions: HldExpansionId[];
  trackLength: number;
  dinoSelections?: Record<PlayerId, HldDinoId>;
  /**
   * The rulesheet's suggested 2-player rules: remove every Point card worth 1, 2 or 3, and eliminate only
   * at four Disasters of one type or two of each type. Applies only when exactly 2 play. Default on.
   */
  twoPlayerVariant?: boolean;
}

// ============================================================================
// State
// ============================================================================

export type HldSubPhase =
  | 'selecting'
  | 'pointEffects'
  | 'awaitingScoringInstants'
  | 'resolving'
  | 'suddenDeath'
  | 'awaitingDisasterSave'
  | 'gameOver';

/** One Instant played during scoring, kept as a record and folded into the scores on read. */
export interface HldInstantPlay {
  by: PlayerId;
  kind: HldCardKind;
  targetId?: PlayerId;
  /** Points for the variable Instants (Helping Hand, Joy of Puberty, Spiteful Bullying). */
  amount?: number;
}

/** Where the round continues once `promptQueue` empties. */
export type HldResume = 'pointEffects' | 'afterCollect' | 'endRound';

export interface HldState extends GameStateShape {
  subPhase: HldSubPhase;

  dinos: Record<PlayerId, HldDinoId>;
  disasterDeck: HldDisasterCard[];
  disasterDiscard: HldDisasterCard[];
  currentDisaster: HldDisasterCard | null;

  deck: HldCard[];
  discard: HldCard[];
  hands: Record<PlayerId, HldCard[]>;

  /** Hidden face-down Point card commits during `selecting` or `suddenDeath`. */
  pendingPicks: Record<PlayerId, HldCard | null>;
  /** Revealed Point cards in front of each player for the current round. */
  revealedPicks: Record<PlayerId, HldCard | null>;
  /** Ids of revealed Point cards whose effect has been used this round ("once per card per round"). */
  usedEffectCardIds: number[];

  /** One-shot score changes from Point card effects this round (Pet Rock, Good Luck Rod, Voodoo Dino…). */
  pointEffectBonuses: Record<PlayerId, number>;
  /** Instants played during scoring this round. */
  instantPlays: HldInstantPlay[];
  /** Players who chose not to take a Dating Disasters "may add 1 point per…" bonus this round. */
  skippedDisasterBonus: PlayerId[];
  /** The round's final scores, frozen when the scoring Instant window closes. */
  roundScores: Record<PlayerId, number> | null;

  promptQueue: HldPrompt[];
  resumeAt: HldResume;
  instantResponderQueue: PlayerId[];
  suddenDeathPlayers: PlayerId[];
  pendingDisasterVictimId: PlayerId | null;

  /** Collected Disaster cards per player. */
  disasterAreas: Record<PlayerId, HldDisasterCard[]>;
  /** Position on each player's Escape Route (0 = start; the goal is `config.trackLength`). */
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
      /** Skip an optional effect. */
      decline?: boolean;
      /** For "you may look" prompts: look at the cards (the prompt then asks for the pick). */
      look?: boolean;
      cardIds?: number[];
      targetPlayerId?: PlayerId;
      secondPlayerId?: PlayerId;
      targetCardId?: number;
      /** Really Thick Glasses: send the peeked Disaster to the bottom. */
      toBottom?: boolean;
    }
  | {
      type: 'playScoringInstant';
      playerId: PlayerId;
      cardId: number;
      targetPlayerId?: PlayerId;
      /** Helping Hand: the 1–3 value Point cards to discard. */
      handCardIds?: number[];
      /** Joy of Puberty / Spiteful Bullying: spaces to move back (1–5). */
      amount?: number;
      /** One Week Anniversary: the Disaster in your area to swap with the face-up one. */
      disasterId?: number;
    }
  | { type: 'skipDisasterBonus'; playerId: PlayerId }
  | { type: 'declineScoringInstant'; playerId: PlayerId }
  | { type: 'submitSuddenDeathPick'; playerId: PlayerId; cardId: number }
  | {
      type: 'playDisasterSave';
      playerId: PlayerId;
      cardId: number;
      targetPlayerId?: PlayerId;
    }
  | { type: 'declineDisasterSave'; playerId: PlayerId };
