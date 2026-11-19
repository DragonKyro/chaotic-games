// Doomlings — types for the Classic (2nd edition) base game.
//
// This file is the design doc. Sources, in order of authority:
//   1. The official Classic rulesheet (Doomlings_Rulebook.pdf, 2024 upload),
//      transcribed in github.com/nycocado/doomlings-atlas
//      (assets/doomlings/rules/classic.md).
//   2. Card data for every Classic card, from the same repo
//      (assets/doomlings/classic/cards.json — taken from the Tabletop Simulator
//      mod that uses the publisher's card images, checked card by card).
//   3. Cross-check: github.com/azabicki/DoomPy (cards.xlsx + scoring rules).
//      Face values, colours and Dominant flags agree with (2) for every Classic
//      trait; DoomPy also lists some 1st-edition variants, which we ignore.
//
// Expansions: the seven packs this game used to ship (Overlush, Imaginary
// Ends, Legends of Enderas, Ancient Fates, Shadow Puppets, Castle Glass,
// Mokoko Village) were **invented** card lists, not the published ones —
// "Ancient Fates" does not appear in any source at all. They were removed.
// The six real expansions are listed in DM_EXPANSIONS so the lobby can show
// them, locked, until someone ports their published card lists (the atlas
// repo has all of them).
//
// Rule readings we had to choose (no source settles them) are marked
// UNCONFIRMED where they are implemented, and listed in Rules.tsx.

import type { GameStateShape } from '@/core/module';
import type { ExpansionConfig, ExpansionMeta, PlayerId } from '@/core/types';
import type { LogEntry } from '@/core/state';

// ============================================================================
// Expansions & sources
// ============================================================================

export type DmExpansionId =
  | 'overlush'
  | 'imaginary-ends'
  | 'legends-of-enderas'
  | 'mokoko-village'
  | 'shadow-puppets'
  | 'castle-glass';

export type DmCardSource = 'classic' | DmExpansionId;

/**
 * The published Doomlings expansions (names and contents per the atlas card
 * data). None is implemented yet: the lobby shows them locked and
 * `validateConfig` rejects them.
 */
export const DM_EXPANSIONS: readonly ExpansionMeta[] = [
  { id: 'overlush', name: 'Overlush', summary: 'Mystery expansion: 146 traits (dual-colour traits included), 28 Ages and 15 Catastrophes.', verified: true },
  { id: 'imaginary-ends', name: 'Imaginary Ends', summary: 'Dinoling / Mythling / Techling traits, plus Trinkets and Merchants.', verified: true },
  { id: 'legends-of-enderas', name: 'Legends of Enderas', summary: 'New traits and hidden one-use Treasure cards.', verified: true },
  { id: 'mokoko-village', name: 'Mokoko Village', summary: 'Bolster expansion: 43 traits, 3 Ages and 1 Catastrophe.', verified: true },
  { id: 'shadow-puppets', name: 'Shadow Puppets', summary: 'Bolster expansion: 37 traits, 2 Ages and 1 Catastrophe.', verified: true },
  { id: 'castle-glass', name: 'Castle Glass', summary: 'Bolster expansion: Shell / Coral / Fish trait classes with class bonuses.', verified: true },
];

/** Why every expansion toggle is locked (shown in the lobby). */
export const DM_EXPANSION_LOCKED_REASON = 'Not implemented yet — only the Classic base game is playable.';

export interface DmConfig extends ExpansionConfig {
  expansions: string[];
}

// ============================================================================
// Traits
// ============================================================================

export type DmTraitColor = 'red' | 'blue' | 'green' | 'purple' | 'colorless';

/** The four colours. Colorless (grey) "isn't used for colour-designated effects". */
export const DM_SCORING_COLORS: readonly DmTraitColor[] = ['red', 'blue', 'green', 'purple'];

/** Every Classic trait, by card name. Behaviour is dispatched on this. */
export type DmTraitKind =
  | 'adorable' | 'altruistic' | 'antlers' | 'apex-predator' | 'appealing' | 'automimicry' | 'bad' | 'bark'
  | 'big-ears' | 'blubber' | 'boredom' | 'branches' | 'brave' | 'brute-strength' | 'camouflage' | 'chromatophores'
  | 'clever' | 'cold-blood' | 'confusion' | 'costly-signaling' | 'deep-roots' | 'delicious' | 'denial'
  | 'directly-register' | 'doting' | 'dreamer' | 'echolocation' | 'egg-clusters' | 'eloquence' | 'endurance'
  | 'faith' | 'fangs' | 'fear' | 'fecundity' | 'fine-motor-skills' | 'fire-skin' | 'flatulence' | 'flight'
  | 'fortunate' | 'gills' | 'gratitude' | 'heat-vision' | 'heroic' | 'hot-temper' | 'hyper-intelligence'
  | 'immunity' | 'impatience' | 'introspective' | 'inventive' | 'iridescent-scales' | 'just' | 'kidney' | 'late'
  | 'leaves' | 'memory' | 'migratory' | 'mindful' | 'mitochondrion' | 'morality' | 'nocturnal' | 'nosy'
  | 'optimistic-nihilism' | 'overgrowth' | 'pack-behavior' | 'painted-shell' | 'parasitic' | 'persuasive'
  | 'photosynthesis' | 'poisonous' | 'pollination' | 'prepper' | 'propagation' | 'quick' | 'random-fertilization'
  | 'reckless' | 'regenerative-tissue' | 'retractable-claws' | 'saliva' | 'saudade' | 'scutes' | 'selective-memory'
  | 'self-awareness' | 'self-replicating' | 'selfish' | 'sentience' | 'sneaky' | 'spiny' | 'sticky-secretions'
  | 'stone-skin' | 'super-spreader' | 'swarm' | 'sweat' | 'symbiosis' | 'teeth' | 'telekinetic' | 'tentacles'
  | 'territorial' | 'the-third-eye' | 'tiny' | 'tiny-little-melons' | 'trunk' | 'vampirism' | 'venomous' | 'viral'
  | 'voracious' | 'warm-blood' | 'woody-stems';

export interface DmTraitCard {
  id: number;
  kind: DmTraitKind;
  name: string;
  /** Printed colour; 'colorless' for grey traits. */
  color: DmTraitColor;
  /** Second colour of a dual-colour trait (expansions only — none in Classic). */
  secondaryColor?: DmTraitColor;
  /** Printed face value. Compass-star traits ("Value is equal to…") count as 0. */
  points: number;
  compassStar?: boolean;
  dominant: boolean;
  /** Gene Pool change while this trait is in a pile (applied on entry, reversed on exit). */
  genePoolDelta: number;
  /** Has the Action icon: resolves only when played directly from a hand. */
  action?: boolean;
  /** Drop of Life icon: a scoring bonus. */
  dropOfLife?: boolean;
  /** World's End icon: resolves after the final catastrophe. */
  worldsEnd?: boolean;
  /** Play-When icon: may be played out of turn. */
  playWhen?: boolean;
  /** No effect text at all (High Tides and Boredom care). */
  effectless?: boolean;
  /** The Swarm trait (the creature art gives swarms tag-alongs). */
  isSwarm?: boolean;
  source: DmCardSource;
  /** Our own plain-English summary of the card's effect (not the printed wording). */
  text: string;
}

// ============================================================================
// Ages & Catastrophes
// ============================================================================

export type DmAgeCardKind = 'birthOfLife' | 'age' | 'catastrophe';

/** One tag per Classic Age (25), plus 'none' for The Birth of Life and catastrophes. */
export type DmAgeRuleTag =
  | 'none'
  | 'dracula'          // Age of Dracula
  | 'nietzsche'        // Age of Nietzsche
  | 'ignoreActions'    // Age of Peace
  | 'stabilizeTo4'     // Age of Wonder
  | 'reason'           // Age of Reason
  | 'alienTerraform'   // Alien Terraform
  | 'noBlue'           // Arid Lands
  | 'awakening'        // Awakening
  | 'birthOfAHero'     // Birth of a Hero
  | 'coastalFormations'
  | 'cometShowers'
  | 'noRed'            // Eclipse
  | 'enlightenment'
  | 'flourish'
  | 'galacticDrift'
  | 'maxFaceValue3'    // Glacial Drift
  | 'highTides'
  | 'noPurple'         // Lunar Retreat
  | 'naturalHarmony'
  | 'northernWinds'
  | 'prosperity'
  | 'protectTraitPiles' // Reforestation
  | 'noGreen'          // Tectonic Shift
  | 'messiah'          // The Messiah
  | 'noColorless';     // Tropical Lands

/** One tag per Classic Catastrophe (15). */
export type DmCatastropheTag =
  | 'aiTakeover' | 'deusExMachina' | 'glacialMeltdown' | 'greyGoo' | 'iceAge' | 'massExtinction'
  | 'megaTsunami' | 'nuclearWinter' | 'overpopulation' | 'pulseEvent' | 'retrovirus' | 'solarFlare'
  | 'superVolcano' | 'theBigOne' | 'fourHorsemen';

export interface DmAgeCard {
  id: number;
  name: string;
  kind: DmAgeCardKind;
  /** Catastrophes only: permanent change to every Gene Pool. */
  genePoolDelta: number;
  ruleTag: DmAgeRuleTag;
  catastrophe?: DmCatastropheTag;
  source: DmCardSource;
  /** Age effect, or a catastrophe's Catastrophic effect. */
  text: string;
  /** Catastrophes: the gold World's End effect. */
  worldsEndText?: string;
}

// ============================================================================
// The work queue
// ============================================================================
//
// Everything that happens is a task on `state.tasks` (front = next). A task
// either runs straight away or needs a decision, in which case it becomes the
// one open `state.prompt` and the queue waits for that player's answer. Effects
// that say "then…" push their follow-ups in order to the FRONT of the queue, so
// nested plays (Propagation → another trait → its action) resolve depth-first,
// the way they do at the table.

export type DmPlayFrom = 'hand' | 'discard' | 'deck';

export type DmTask =
  // ---- round & turn flow ---------------------------------------------------
  | { t: 'flipAge' }
  | { t: 'beginTurns' }
  | { t: 'turnStart'; p: PlayerId }
  | { t: 'endTurn'; p: PlayerId }
  | { t: 'enlightenment'; p: PlayerId }
  | { t: 'stabilizeChoice'; p: PlayerId }
  | { t: 'stabilize'; p: PlayerId }
  | { t: 'afterStabilize'; p: PlayerId }
  | { t: 'late'; p: PlayerId }
  | { t: 'nextTurn' }
  | { t: 'nihilism' }
  // ---- age effects (before turns) ---------------------------------------
  | { t: 'ageRandomDiscard'; p: PlayerId }
  | { t: 'draculaSteal'; p: PlayerId }
  | { t: 'reasonKeep'; p: PlayerId; cardIds: number[] }
  | { t: 'alienTerraform'; p: PlayerId }
  | { t: 'heroRises'; p: PlayerId }
  | { t: 'discardFromHand'; p: PlayerId; count: number; why: string }
  // ---- catastrophes ----------------------------------------------------------
  | { t: 'catastropheEffect'; p: PlayerId; tag: DmCatastropheTag }
  | { t: 'keepOne'; p: PlayerId; why: string }
  | { t: 'passHandsRight' }
  | { t: 'bigOneGive'; p: PlayerId; to: PlayerId[] }
  | { t: 'applyGifts' }
  | { t: 'afterCatastrophe' }
  // ---- playing traits ------------------------------------------------------
  | { t: 'payCost'; p: PlayerId; cardId: number; from: DmPlayFrom; triggerAction: boolean }
  | { t: 'moralityTo'; p: PlayerId; cardId: number; giftId: number; from: DmPlayFrom; triggerAction: boolean }
  | {
      t: 'play';
      p: PlayerId;
      cardId: number;
      from: DmPlayFrom;
      /** Resolve its Action (only plays straight from a hand do, and only when told to). */
      triggerAction: boolean;
      /** Birth of a Hero: ignore requirements, age restrictions and the Dominant limit. */
      unrestricted?: boolean;
      /** Morality / Retractable Claws: the "to play" cost has been paid. */
      costPaid?: boolean;
      /** A Play-When card used as instructed: no reaction windows, doesn't count as a turn. */
      outOfTurn?: boolean;
      /** Self-Awareness: the pile it goes into (default: the player's own). */
      into?: PlayerId;
    }
  | { t: 'parasiticWindow'; actor: PlayerId; cardId: number; asked: PlayerId[] }
  | { t: 'selfReplicatingReturn'; p: PlayerId; srcId: number }
  | { t: 'onEnter'; p: PlayerId; cardId: number }
  | { t: 'preventWindow'; actor: PlayerId; srcId: number; kind: DmTraitKind; asked: PlayerId[] }
  | { t: 'action'; actor: PlayerId; srcId: number; kind: DmTraitKind }
  | { t: 'extraPlay'; p: PlayerId; rule: 'colorless' | 'effectless' }
  | { t: 'playAnother'; p: PlayerId; why: string; triggerAction: boolean; cardIds?: number[]; optional?: boolean }
  // ---- action steps ----------------------------------------------------------
  | {
      t: 'pickTrait';
      p: PlayerId;
      mode: DmPickMode;
      /** The card whose effect this is (-1 for The Four Horsemen's catastrophic effect). */
      srcId: number;
      /** discardTheirs: whose pile. */
      owner?: PlayerId;
      /** swapTheirs: your trait being swapped away. */
      ref?: number;
      /** Which card's rule filters the targets (Selfish, Tentacles, Inventive…). */
      filter?: DmTraitKind;
      /** Cost steps: how the trait being paid for is then played. */
      cost?: { from: DmPlayFrom; triggerAction: boolean };
    }
  | { t: 'pickPlayer'; p: PlayerId; mode: DmPlayerMode; srcId: number; ref?: number }
  | { t: 'pickColor'; p: PlayerId; mode: DmColorMode; srcId: number; from?: DmTraitColor }
  | { t: 'pickDiscard'; p: PlayerId; srcId: number; triggerAction: boolean }
  | { t: 'cleverReveal'; actor: PlayerId; opp: PlayerId }
  | { t: 'cleverSteal'; actor: PlayerId }
  | { t: 'nosySteal'; actor: PlayerId; opp: PlayerId; cardIds: number[] }
  | { t: 'dotingPick'; p: PlayerId }
  | { t: 'dotingTo'; p: PlayerId; cardId: number }
  | { t: 'memory'; p: PlayerId }
  | { t: 'regenDraw'; p: PlayerId }
  | { t: 'prepper'; p: PlayerId }
  | { t: 'sneaky'; p: PlayerId; cardId: number }
  // ---- World's End -------------------------------------------------------
  | { t: 'worldsEnd' }
  | { t: 'weTraits'; order: PlayerId[]; idx: number }
  | { t: 'weResolve'; p: PlayerId; cardId: number }
  | { t: 'weCatastrophe' }
  | { t: 'weDiscardTrait'; p: PlayerId; rule: 'blue' | 'green' | 'red' | 'purple' | 'colorless' | 'face4' }
  | { t: 'score' };

/** What a "choose a trait in a trait pile" step does with the trait. */
export type DmPickMode =
  | 'steal'            // into the chooser's pile (filtered by srcId's card)
  | 'returnToHand'     // Costly Signaling
  | 'swapWithSource'   // Poisonous
  | 'swapOwn'          // Telekinetic / Tentacles: your side first
  | 'swapTheirs'       // …then theirs (ref = your trait)
  | 'giveOwn'          // Scutes: your trait first, then who gets it
  | 'discardOwn'       // Voracious, Four Horsemen, Reckless (opponent's side)
  | 'discardTheirs'    // Reckless (your side)
  | 'territorial'      // opponent discards one of their red traits
  | 'borrowAction'     // Inventive (opponents' piles) / Painted Shell (yours)
  | 'vampirism'        // steal a trait, then play its action
  | 'moralityGift'     // Morality's cost: a positive-value trait to give away
  | 'clawsCost';       // Retractable Claws' cost: a red trait to discard

export type DmPlayerMode =
  | 'swapHands'     // Flight
  | 'stealRandom2'  // Impatience
  | 'nosy'          // Nosy
  | 'moveSource'    // Venomous: who receives it
  | 'giveTrait'     // Scutes / Morality: who receives `ref`
  | 'reckless';     // Reckless: which opponent

export type DmColorMode = 'persuasive' | 'hyperIntelligence' | 'sentience' | 'viral' | 'faithFrom' | 'faithTo';

// ============================================================================
// Prompts
// ============================================================================

export interface DmPromptBase {
  playerId: PlayerId;
  /** Plain-English instruction for the chooser. */
  title: string;
  /** Extra context (what is being answered, what happens next). */
  detail?: string;
  /** May the player decline? `declineLabel` names that button. */
  optional: boolean;
  declineLabel?: string;
  /** The step this decision belongs to; its answer is applied by the reducer. */
  task: DmTask;
}

export type DmPrompt =
  | (DmPromptBase & {
      kind: 'cards';
      /** Eligible cards. `from: 'hand'` = the chooser's own hand; 'shown' = cards only the chooser sees (Nosy) or everyone sees (Clever). */
      cardIds: number[];
      from: 'hand' | 'shown';
      min: number;
      max: number;
    })
  | (DmPromptBase & { kind: 'trait'; targets: { ownerId: PlayerId; cardId: number }[] })
  | (DmPromptBase & { kind: 'player'; playerIds: PlayerId[] })
  | (DmPromptBase & { kind: 'color'; colors: DmTraitColor[] })
  | (DmPromptBase & { kind: 'option'; options: { id: string; label: string }[] });

// ============================================================================
// State
// ============================================================================

export type DmSubPhase = 'awaitingAction' | 'awaitingPrompt' | 'gameOver';

export interface DmWorldsEnd {
  /** Catastrophe whose gold effect the world ends on (Prepper can change it). */
  effect: DmCatastropheTag;
  /** Trait World's End effects already resolved (card ids), and Sneaky refusals. */
  resolved: number[];
  /** Sentience / Viral colour choices, by card id. */
  chosenColor: Record<number, DmTraitColor>;
  /** Faith: one colour of a player's traits now counts as another. */
  colorChange: Record<PlayerId, { from: DmTraitColor; to: DmTraitColor } | null>;
  /** Deus Ex Machina: the face value each player drew (capped at +5). */
  deusDraws: Record<PlayerId, number>;
  /** Tie-break draws: face value of the trait each tied player drew. */
  tiebreak: Record<PlayerId, number>;
}

export interface DmState extends GameStateShape {
  subPhase: DmSubPhase;

  traitDeck: DmTraitCard[];
  /** Face up; the LAST element is the top card. */
  traitDiscard: DmTraitCard[];
  ageDeck: DmAgeCard[];
  agesPlayed: DmAgeCard[];
  currentAge: DmAgeCard;
  /** Ids of ages flipped past by Optimistic Nihilism (their effects never happened). */
  skippedAgeIds: number[];

  hands: Record<PlayerId, DmTraitCard[]>;
  tableaus: Record<PlayerId, DmTraitCard[]>;
  /**
   * The Gene Pool card, as a counter. The rulebook makes it path-dependent:
   * an increase/decrease that would leave 1–8 is ignored, but a trait LEAVING a
   * pile always reverses its effect. So it can't be recomputed from the pile.
   */
  genePool: Record<PlayerId, number>;

  firstPlayerIndex: number;
  /** This round's turn order (The Messiah reverses it). */
  roundOrder: PlayerId[];
  turnIndex: number;
  turnPlayerId: PlayerId;
  /** 'main' = waiting for the turn player's one trait; otherwise resolving / between turns. */
  turnStage: 'main' | 'resolving';
  catastrophesSeen: number;

  /** Denial cards already used, and the catastrophe each ignored (null: it met The Four Horsemen). */
  spentDenials: { cardId: number; catastropheId: number | null }[];
  /** Colours of the most recently played trait (Natural Harmony). */
  lastPlayedColors: DmTraitColor[] | null;
  /** Age id each player has legitimately seen ahead of time (The Third Eye). */
  peekedAge: Record<PlayerId, number | null>;
  /** Cards revealed to everyone by Clever, waiting to be stolen. */
  revealed: { ownerId: PlayerId; cardId: number }[];
  /** The Big One: gifts chosen from each original hand, applied together. */
  pendingGifts: { from: PlayerId; to: PlayerId; cardId: number }[];

  tasks: DmTask[];
  prompt: DmPrompt | null;

  worldsEnd: DmWorldsEnd | null;
  winnerId: PlayerId | null;
  winnerIds: PlayerId[];

  log: LogEntry[];
  logSeq: number;
  config: DmConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type DmAction =
  /** Your one trait for the turn (main stage only). */
  | { type: 'playTrait'; playerId: PlayerId; cardId: number }
  /** Self-Awareness, played "at any time" into an opponent's pile (offered during your own turn). */
  | { type: 'playOutOfTurn'; playerId: PlayerId; cardId: number; targetPlayerId: PlayerId }
  /** Only legal when you can't play any trait: skip your turn (optionally discarding your hand to draw 3). */
  | { type: 'passTurn'; playerId: PlayerId; discardHand?: boolean }
  | {
      type: 'resolvePrompt';
      playerId: PlayerId;
      decline?: boolean;
      cardIds?: number[];
      targetPlayerId?: PlayerId;
      targetCardId?: number;
      chosenColor?: DmTraitColor;
      optionId?: string;
    };
