// Exploding Kittens — types, and the design doc for the whole game.
//
// ============================================================================
// Sources
// ============================================================================
// Every rule below was checked against the publisher's own rule sheets
// (cdn.shopify.com/s/files/1/0345/9180/1483/files/…, linked from
// explodingkittens.com/pages/rules-*):
//   ekoe-instructions-english.pdf            Original Edition (2025 printing)
//   EKG-ORG_Instructions_20OCT23.pdf         Original Edition (2023 printing)
//   imploding-english.pdf                    Imploding Kittens (2023)
//   EKG-2EXP_Instructions_3OCT2023-R2.pdf    Streaking Kittens (2023)
//   EKG-3EXP_Instructions_16JUNE2025.pdf     Barking Kittens (2025)
//   EKG-4EXP_Instructions_14MAR2024_….pdf    Zombie Kittens expansion (2024)
//   ekpp-instructions-english.pdf            Party Pack (2025)
//   EKG-RFD_*_04APR2025_*.pdf                Recipes for Disaster (2024)
// and the official FAQ (explodingkittens.com/pages/faq-exploding-kittens).
//
// ============================================================================
// Core loop
// ============================================================================
// A turn is: play any number of cards (or none), then END YOUR TURN BY DRAWING
// one card. Drawing is the turn-ender, not an action you pick — the only ways to
// end a turn without drawing are Skip-likes and Attack-likes. Draw an Exploding
// Kitten and you must play a Defuse (then secretly reinsert the kitten anywhere
// in the deck) or you are out. Last player alive wins.
//
// Setup (Original Edition): 1 Defuse each, 2 of the spare Defuses shuffled back
// (only 1 spare exists at 5 players), deal 7, then insert (players − 1) kittens.
// The spare Defuses are in the deck BEFORE the deal, so an opening hand can hold
// two. An exploded player's cards are NOT discarded: the kitten lies face up in
// front of them and the rest of their hand face down — out of the game.
//
// Attack stacking (printed on the card): "If the victim of an Attack plays this
// card on any of their turns, the attacks stack … the card's victim must take
// the Attacker's current and remaining untaken turn(s) PLUS 2 additional turns.
// e.g. Attacked, then Attack straight away → 4; finish one turn, then Attack →
// 3." A player who was NOT attacked just hands on 2. `underAttack` tracks it.
//
// Combos (current rulebooks list only these two): any two cards with the same
// title steal a random card; any three name a card and take it if held. Combo
// cards' own text is ignored. The old Five Different combo is not in any current
// printing — it is an opt-in lobby toggle (`fiveDifferentCombo`).
//
// ============================================================================
// Hidden information — the deck-order caveat
// ============================================================================
// Per the project's model the full state is replicated, so `state.deck` is
// readable by every peer in devtools. We accept that (friends-only honour, same
// stance as the sibling project) rather than making the host authoritative.
// Two consequences the code must respect:
//   - The UI NEVER renders deck contents. The only legitimate windows into the
//     deck are `knownTopCount` and `sightings` (Clairvoyance), via
//     `knownTopCards()` / `sightedKittens()`.
//   - The AI must not read `state.deck` beyond those. Anything else is cheating.
// Holding an Exploding Kitten with a Streaking Kitten is secret: it is decided
// by the standing `streakingHold` preference, so the draw looks like any other.
//
// ============================================================================
// Turn / subphase state machine
// ============================================================================
//   awaitingAction       main loop: active player plays cards or draws
//   awaitingNope         a play is parked; eligible holders may Nope, LIFO
//   awaitingBlindTarget  a Cursed player's face-down card was revealed and needs a target
//   awaitingDefuse       a kitten went off (drawn / exposed / Barking) — Defuse it
//   awaitingClairvoyance a Zombie Kitten was played; Clairvoyance holders may watch
//   awaitingKittenPlace  choose the secret reinsertion index (one kitten at a time)
//   awaitingFavorGive    Favor resolved; the target picks a card to hand over
//   awaitingDiscardPick  five-different combo; take any card from the discard
//   awaitingFutureView   See / Alter / Share the Future peek is open
//   awaitingGarbagePick  Garbage Collection: each player feeds the deck a card
//   awaitingBuryPlace    Bury: put the drawn card back anywhere
//   awaitingPotluckPick  Potluck: each player puts a card on top of the deck
//   awaitingDigDeeper    Dig Deeper: keep the top card, or draw the next one
//   awaitingDonation     Feed the Dead / Grave Robber: each listed player gives a card
//   gameOver
//
// `activePlayerId` follows whoever owes a decision — during awaitingNope it
// parks on the next eligible responder, and during awaitingFavorGive on the
// Favor's victim. That keeps the shell's AI driver ticking one seat at a time
// without any special-casing (same trick the sibling project used).

import type { GameStateShape } from '@/core/module';
import type { ExpansionConfig, ExpansionMeta, PlayerId } from '@/core/types';
import type { LogEntry } from '@/core/state';

// ============================================================================
// Cards
// ============================================================================

/**
 * Base set card kinds. The five cat cards have no ability of their own — they
 * exist purely as combo fodder.
 */
export type EkCoreCardKind =
  | 'explodingKitten'
  | 'defuse'
  | 'nope'
  | 'attack'
  | 'skip'
  | 'favor'
  | 'shuffle'
  | 'seeTheFuture'
  | 'tacoCat'
  | 'rainbowRalphingCat'
  | 'cattermelon'
  | 'hairyPotatoCat'
  | 'beardCat';

/** Expansion card kinds across Imploding, Streaking, Barking, and Zombie Kittens. */
export type EkExpansionCardKind =
  // Imploding Kittens
  | 'implodingKitten'
  | 'reverse'
  | 'drawFromTheBottom'
  | 'alterTheFuture'
  | 'targetedAttack'
  | 'feralCat'
  // Streaking Kittens
  | 'streakingKitten'
  | 'superSkip'
  | 'seeTheFuture5x'
  | 'alterTheFuture5x'
  | 'swapTopAndBottom'
  | 'garbageCollection'
  | 'catomicBomb'
  | 'mark'
  | 'curseOfTheCatButt'
  // Barking Kittens
  | 'barkingKitten'
  | 'alterTheFutureNow'
  | 'bury'
  | 'personalAttack'
  | 'shareTheFuture'
  | 'illTakeThat'
  | 'potluck'
  | 'towerOfPower'
  // Zombie Kittens
  | 'zombieKitten'
  | 'digDeeper'
  | 'clone'
  | 'clairvoyance'
  | 'feedTheDead'
  | 'graveRobber'
  | 'attackOfTheDead'
  | 'shuffleNow';

export type EkBaseCardKind = EkCoreCardKind | EkExpansionCardKind;
export type EkCardKind = EkBaseCardKind;

/**
 * A physical card instance. Instance ids matter more here than in the sibling
 * project: the deck is an ordered list of specific cards, and a Defuse moves
 * one exact card to one exact index.
 */
export interface EkCard {
  id: number;
  kind: EkBaseCardKind;
}

export type EkComboKind = 'pair' | 'triple' | 'fiveDifferent';

// ============================================================================
// Reaction stack (the Nope primitive)
// ============================================================================

/**
 * A play that has been declared but not yet resolved, sitting under an open
 * Nope window. Resolution is LIFO: an ODD number of Nopes cancels the play, an
 * even number means it still resolves.
 */
export interface EkPendingPlay {
  byPlayerId: PlayerId;
  /** The card(s) played. A combo puts 2, 3 or 5 cards down at once. */
  cards: EkCard[];
  combo: EkComboKind | null;
  /** Declared on play, so responders can decide knowing the target. */
  targetPlayerId: PlayerId | null;
  /** Three-of-a-kind: the card type being demanded, named on play. */
  demandKind: EkBaseCardKind | null;
  /** When Clone is played alone, the kind of the card directly beneath it on the discard pile. */
  clonedKind?: EkBaseCardKind | null;
  /** Nopes stacked on top, in play order. Odd = cancelled. */
  nopeCards: EkCard[];
  /**
   * Players who still owe a respond/decline decision in the CURRENT window.
   * Rebuilt each time a Nope lands, since the situation changed. Players
   * holding no Nope are never queued — they have no legal response.
   */
  responderQueue: PlayerId[];
}

// ============================================================================
// Config
// ============================================================================

export type EkExpansionId =
  | 'imploding-kittens'
  | 'streaking-kittens'
  | 'barking-kittens'
  | 'zombie-kittens'
  | 'party-pack'
  | 'recipes-for-disaster';

export const EK_EXPANSIONS: readonly ExpansionMeta[] = [
  {
    id: 'imploding-kittens',
    name: 'Imploding Kittens',
    summary: '+20 cards, up to 6 players. Imploding Kitten (counts as one of the kittens), Reverse, Draw From The Bottom, Alter The Future, Feral Cat, Targeted Attack.',
    verified: true,
  },
  {
    id: 'streaking-kittens',
    name: 'Streaking Kittens',
    summary: '+15 cards incl. 1 extra Exploding Kitten (kittens = players). Streaking Kitten, Super Skip, See/Alter the Future 5x, Swap Top And Bottom, Garbage Collection, Catomic Bomb, Mark, Curse of the Cat Butt.',
    verified: true,
  },
  {
    id: 'barking-kittens',
    name: 'Barking Kittens',
    summary: '+20 cards. Barking Kittens, Tower of Power (6-card Stash dealt at setup), Bury, Alter The Future NOW, I\'ll Take That, Share The Future, Personal Attack, Potluck, Super Skip.',
    verified: true,
  },
  {
    id: 'zombie-kittens',
    name: 'Zombie Kittens',
    summary: '+22 cards, up to 5 players. Zombie Kittens replace Defuses and revive the dead; dead players keep their hands and may still Nope and play NOW cards. Dig Deeper, Clone, Clairvoyance, Feed the Dead, Grave Robber, Attack of the Dead, Shuffle Now, Super Skip.',
    verified: true,
  },
  {
    id: 'party-pack',
    name: 'Party Pack',
    summary: 'Swaps the core deck for the 120-card Party Pack (2–10 players): paw-print cards for 2–3 players, the others for 4–7, everything for 8–10. Adds Targeted Attack, Alter the Future, Draw from the Bottom and Feral Cat.',
    verified: true,
  },
  {
    id: 'recipes-for-disaster',
    name: 'Recipes for Disaster',
    summary: 'Not modeled: the 13 recipe booklets are not reproduced. Placeholder that mixes the Imploding, Streaking and Barking cards the box collects into the base deck. 2–5 players.',
    verified: false,
  },
];

export interface EkConfig extends ExpansionConfig {
  /** Enabled expansion packs. */
  expansions: EkExpansionId[];
  /**
   * Cards dealt to each player on top of their one Defuse. Every current
   * rulebook deals 7 (a hand of 8); 4 is offered as a shorter game.
   */
  handSize: number;
  /**
   * House rule. false (default, per every current rulebook) = any two or three
   * cards with the same title form a combo; true = cat cards only.
   */
  combosCatsOnly: boolean;
  /**
   * Opt-in: the Five Different combo (take any card from the discard pile). Not
   * in any current printing of the rules; absent = off.
   */
  fiveDifferentCombo?: boolean;
}

// ============================================================================
// State
// ============================================================================

export type EkSubPhase =
  | 'awaitingAction'
  | 'awaitingNope'
  | 'awaitingBlindTarget'
  | 'awaitingDefuse'
  | 'awaitingClairvoyance'
  | 'awaitingKittenPlace'
  | 'awaitingFavorGive'
  | 'awaitingDiscardPick'
  | 'awaitingFutureView'
  | 'awaitingGarbagePick'
  | 'awaitingBuryPlace'
  | 'awaitingPotluckPick'
  | 'awaitingDigDeeper'
  | 'awaitingDonation'
  | 'gameOver';

export interface EkState extends GameStateShape {
  subPhase: EkSubPhase;

  /** Ordered; index 0 is the top of the deck. Never render this in the UI. */
  deck: EkCard[];
  /** Top of the discard is the last element. Public. */
  discard: EkCard[];
  hands: Record<PlayerId, EkCard[]>;

  /**
   * Seats knocked out, in elimination order. Turn advance skips these. With
   * Zombie Kittens these are the DEAD — they keep their hands, can still Nope
   * and play NOW cards, and a Zombie Kitten can bring them back.
   */
  eliminated: PlayerId[];

  /** The kitten(s) that killed each dead player, face up in front of them. Public. */
  deadKittens: Record<PlayerId, EkCard[]>;

  /**
   * Base game: an exploded player's hand, face down in front of them — out of
   * the game, not in the discard. (With Zombie Kittens the dead keep their hand.)
   */
  deadHands: Record<PlayerId, EkCard[]>;

  /**
   * How many top-of-deck cards each player legitimately knows, from See the
   * Future or from placing a card themselves. With `sightings`, this is the
   * ONLY channel through which a player or AI may look at the deck. Invalidated
   * by draws (decrement), shuffles (zero), and reinsertions (clamped to the
   * insert index).
   */
  knownTopCount: Record<PlayerId, number>;

  /**
   * Clairvoyance: ids of kittens a player WATCHED being reinserted. Their
   * position is known until a shuffle, a reorder over them, or a secret
   * insertion above them makes it stale.
   */
  sightings?: Record<PlayerId, number[]>;

  /**
   * Whose TURN it is. Distinct from `activePlayerId`, which is repurposed to
   * point at whoever owes the next decision — a Nope responder, or a Favor's
   * victim. Always come back to this seat when a subphase finishes.
   */
  turnPlayerId: PlayerId;

  /**
   * Turns the turn player still owes, including the one in progress. Attack
   * pushes this onto the next player; Skip burns exactly one.
   */
  turnsRemaining: number;

  /**
   * The turn player's owed turns came from an Attack-type card (Attack,
   * Targeted Attack, Personal Attack, Attack of the Dead). Only a victim's own
   * Attack stacks; a fresh turn always starts false.
   */
  underAttack: boolean;

  /** +1 clockwise, -1 counter-clockwise (flipped by Reverse). */
  turnDirection: 1 | -1;

  /** Open reaction window, if any. */
  pending: EkPendingPlay | null;

  /** Open See/Alter/Share the Future peek — drives the modal, then folds into knownTopCount. */
  peek: {
    playerId: PlayerId;
    cards: EkCard[];
    canReorder?: boolean;
    shareWithNext?: boolean;
  } | null;

  /** In-flight Favor: `from` owes `to` a card of their choosing. */
  pendingFavor: { fromPlayerId: PlayerId; toPlayerId: PlayerId } | null;

  /**
   * A kitten that has gone off and is awaiting resolution — first a Defuse,
   * then a secret reinsertion index.
   */
  pendingKitten: EkCard | null;

  /**
   * More kittens the same player must hide after `pendingKitten` — a Zombie
   * Kitten reinserts the revived player's kitten too, each in its own spot.
   */
  kittenQueue?: EkCard[];

  /** Players who played Clairvoyance and watch the kitten placements now under way. */
  kittenWatchers?: PlayerId[];

  /**
   * A Cursed player blindly played an Exploding Kitten they were holding while
   * already defusing one: "you must defuse each of them before continuing".
   */
  moreKittensToDefuse?: EkCard[];

  /**
   * Cards that have been played and resolved but not yet flushed to the discard
   * pile. Only the five-different combo uses this, so that the five cards you
   * just played aren't available for you to immediately reclaim.
   */
  limbo: EkCard[];

  /** Whether the Imploding Kitten has been drawn once and is now face-up. */
  implodingFaceUp?: boolean;

  /** Card IDs that have been Marked and are visible to all players while in a hand. */
  markedCardIds?: number[];

  /** Players under Curse of the Cat Butt: they play face-down cards at random until they draw safely. */
  cursedPlayers?: PlayerId[];

  /** A Cursed player's face-down card, revealed and playable, waiting for them to pick its target. */
  pendingBlindCard?: EkCard | null;

  /**
   * Streaking Kitten: whether a player wants a drawn Exploding Kitten held in
   * secret (true / unset) rather than defused (false). A standing preference so
   * the draw itself reveals nothing. Ignored when they have no Defuse.
   */
  streakingHold?: Record<PlayerId, boolean>;

  /** In-flight Garbage Collection queue and cards collected to be shuffled into the deck. */
  pendingGarbage?: { queue: PlayerId[]; collected: EkCard[] } | null;

  /** Card drawn via Bury awaiting secret reinsertion into the deck. */
  pendingBury?: EkCard | null;

  /** In-flight Potluck queue of players choosing a card to place on top of the deck. */
  pendingPotluck?: { queue: PlayerId[] } | null;

  /** Dig Deeper: the top card, which only the digger has looked at. */
  pendingDigDeeper?: { playerId: PlayerId; card: EkCard } | null;

  /** Clairvoyance window opened by a Zombie Kitten: who may still answer, who already chose to watch. */
  pendingClairvoyance?: { placerId: PlayerId; queue: PlayerId[]; watchers: PlayerId[] } | null;

  /** Feed the Dead (cards go to a dead player) / Grave Robber (cards go into the deck). */
  pendingDonation?: {
    kind: 'feedTheDead' | 'graveRobber';
    queue: PlayerId[];
    toPlayerId: PlayerId | null;
    collected: EkCard[];
  } | null;

  /** I'll Take That cards lying face up in front of their victims, keyed by victim. */
  illTakeThat?: Record<PlayerId, { thiefId: PlayerId; card: EkCard }>;

  /** Barking Kittens: the unclaimed 6-card Stash dealt at setup, waiting under the Crown. */
  stash?: EkCard[];

  /** Tower of Power: the Crown's cards, keyed by the player wearing it. Thieves take from here first. */
  towerStash?: Record<PlayerId, EkCard[]>;

  /** A Barking Kitten face up in front of the player who played it while nobody held the other. */
  barkingFaceUp?: Record<PlayerId, EkCard>;

  /** Whether resolving the current pendingKitten ends the active turn (true on draw, false on mid-turn exposure). */
  defuseEndsTurn?: boolean;

  log: LogEntry[];
  logSeq: number;

  config: EkConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type EkAction =
  /**
   * Play one card, or a declared combo. Opens a Nope window rather than
   * resolving immediately. Targets and demands are declared here so responders
   * can judge the play. NOW cards may be played by anyone during awaitingAction.
   */
  | {
      type: 'playCards';
      playerId: PlayerId;
      cardIds: number[];
      targetPlayerId?: PlayerId;
      demandKind?: EkBaseCardKind;
    }
  /** Nope the pending play. Out of turn — legal for any queued holder of a Nope. */
  | { type: 'playNope'; playerId: PlayerId; cardId: number }
  /** Decline to respond in the open Nope window. */
  | { type: 'declineNope'; playerId: PlayerId }
  /** A Cursed player names the target for the face-down card they just revealed. */
  | { type: 'chooseBlindTarget'; playerId: PlayerId; targetPlayerId: PlayerId }
  /** End your turn by drawing. Resolves kitten draws into a Defuse or death. */
  | { type: 'drawCard'; playerId: PlayerId }
  /** Streaking Kitten: hold (true) or defuse (false) an Exploding Kitten you draw. */
  | { type: 'setStreakingHold'; playerId: PlayerId; hold: boolean }
  /**
   * Play a Defuse (or Zombie Kitten, or a Clone copying one) for the kitten that
   * went off. A Zombie Kitten must name a dead player to bring back, if any. A
   * Cursed player picks blind: any card id, and non-Defuses are lost.
   */
  | { type: 'playDefuse'; playerId: PlayerId; cardId: number; targetPlayerId?: PlayerId }
  /** Zombie Kittens: choose to die rather than play your Zombie Kitten. */
  | { type: 'declineDefuse'; playerId: PlayerId }
  /** Clairvoyance window: watch where the Zombie Kitten's kittens go. */
  | { type: 'playClairvoyance'; playerId: PlayerId; cardId: number }
  | { type: 'declineClairvoyance'; playerId: PlayerId }
  /** Secretly reinsert the pending kitten. index 0 = top of deck. */
  | { type: 'placeKitten'; playerId: PlayerId; index: number }
  /** Favor's victim hands over a card of their own choosing. */
  | { type: 'giveCard'; playerId: PlayerId; cardId: number }
  /** Five-different combo: take any one card from the discard pile. */
  | { type: 'takeFromDiscard'; playerId: PlayerId; cardId: number }
  /** Close a See/Alter/Share the Future peek without changing the card order. */
  | { type: 'ackPeek'; playerId: PlayerId }
  /** Rearrange the top cards during Alter the Future / Share the Future and close the peek. */
  | { type: 'reorderFuture'; playerId: PlayerId; orderedCardIds: number[] }
  /** Garbage Collection: choose 1 card from your hand to shuffle back into the deck. */
  | { type: 'garbagePick'; playerId: PlayerId; cardId: number }
  /** Bury: secretly insert the drawn card at any index in the deck to end your turn. */
  | { type: 'placeBury'; playerId: PlayerId; index: number }
  /** Potluck: choose 1 card from your hand to place on top of the deck. */
  | { type: 'potluckPick'; playerId: PlayerId; cardId: number }
  /** Dig Deeper: keep the top card (ends your turn), or draw the next one no matter what. */
  | { type: 'pickDigDeeper'; playerId: PlayerId; keep: boolean }
  /** Feed the Dead / Grave Robber: hand over the card you choose. */
  | { type: 'donateCard'; playerId: PlayerId; cardId: number };
