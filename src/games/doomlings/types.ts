// Doomlings — types for the Classic (2nd edition) base game and its expansions.
//
// This file is the design doc. Sources, in order of authority:
//   1. The official Classic rulesheet (Doomlings_Rulebook.pdf, 2024 upload),
//      transcribed in github.com/nycocado/doomlings-atlas
//      (assets/doomlings/rules/classic.md).
//   2. Card data for every card, from the same repo
//      (assets/doomlings/<set>/cards.json — taken from the Tabletop Simulator
//      mod that uses the publisher's card images, checked card by card), and
//      the expansions' official rules cards (assets/doomlings/rules/<set>.md,
//      from the rules guide in the same mod).
//   3. Cross-check: github.com/azabicki/DoomPy (cards.xlsx + scoring rules).
//      Face values, colours and Dominant flags agree with (2) for every Classic
//      trait; DoomPy also lists some 1st-edition variants, which we ignore.
//      DoomPy covers Overlush but none of the later packs.
//
// Expansions. The atlas has nine published sets besides Classic (set.json):
// Upgrade (2023), Overlush (2023), Imaginary Ends (2024), Legends of Enderas,
// Castle Glass, Mokoko Village, Nightflower Island and Shadow Puppets (2025),
// and the Special Edition cards. All nine are listed in DM_EXPANSIONS; a pack
// is playable only once it is built completely from its card data AND its
// rulesheet (`DM_BUILT_EXPANSIONS`). The others are locked in the lobby with
// the reason (`dmExpansionLockedReason`) and rejected by `validateConfig`.
//
//   Overlush — BUILT. The Mystery expansion: the whole collection the atlas
//     lists (146 traits incl. 35 Dominants, 28 Ages, 15 Catastrophes — the
//     173 numbered cards, their secret rares and the Relic printings). Its
//     rulesheet's setup is followed: each game draws 40 basic traits,
//     8 Dominants, 8 Ages and 4 Catastrophes from it into the Classic decks.
//     No new card types, but many new timings (removal reactions, Pinchy /
//     Snap-Trap, Elusive / Muse, Procrastination, Sleepy), Age of Certainty's
//     face-up deck and Psychedelic's restart.
//   Imaginary Ends — BUILT (its four creature collections). Deeplings,
//     Glitterlings, Moonlings and Fuzelings: 64 traits (7 Dominants), 8 Ages,
//     4 Catastrophes, matching their rules cards. New: suppress (cards hidden
//     face down under a trait, +1 each — `DmTraitCard.under`), subspecies,
//     "friends" (= opponents). The same box's Magical Merchants (11 merchant
//     Ages, 40 trinkets) is a separate add-on on its rulesheet, with its own
//     setup; it is listed on its own ('magical-merchants') and locked.
//   Castle Glass — BUILT. 40 numbered cards ("01/40 | CSGL"): 30 traits,
//     7 Dominants, 2 Ages, 1 Catastrophe, as its rules card says. The atlas
//     also files Luminous and Radiant under Castle Glass, but their cards are
//     printed "Special Edition | CSGL", not numbered in the 40 — they are left
//     out. New: trait classes (Shell / Coral / Fish, with Curious and Exotic
//     tiers) scored as class bonuses after Drop of Life (`classBonusOf`).
//
// The seven packs this game used to ship before the 2026-11-19 rules audit
// (including "Ancient Fates", which appears in no source) were invented card
// lists and were removed.
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
  | 'magical-merchants'
  | 'legends-of-enderas'
  | 'castle-glass'
  | 'mokoko-village'
  | 'shadow-puppets'
  | 'nightflower-island'
  | 'upgrade'
  | 'special-edition';

export type DmCardSource = 'classic' | DmExpansionId;

/** Packs built completely from their card data and rulesheet. Only these can be enabled. */
export const DM_BUILT_EXPANSIONS: readonly DmExpansionId[] = ['castle-glass', 'overlush', 'imaginary-ends'];

/**
 * Every published Doomlings set in the sources besides Classic (names and
 * contents per the atlas card data). `verified` is true only for built packs.
 */
export const DM_EXPANSIONS: readonly ExpansionMeta[] = [
  { id: 'castle-glass', name: 'Castle Glass', summary: 'Bolster: 30 traits, 7 Dominants, 2 Ages and 1 Catastrophe. Shell, Coral and Fish trait classes score class bonuses.', verified: true },
  { id: 'overlush', name: 'Overlush', summary: 'Mystery expansion: 146 traits, 28 Ages and 15 Catastrophes. Each game adds a random 40 traits, 8 Dominants, 8 Ages and 4 Catastrophes.', verified: true },
  { id: 'imaginary-ends', name: 'Imaginary Ends', summary: 'Deeplings (suppress), Glitterlings, Moonlings and Fuzelings: 64 traits, 8 Ages and 4 Catastrophes.', verified: true },
  { id: 'magical-merchants', name: 'Imaginary Ends: Magical Merchants', summary: 'The box’s add-on: 11 merchant Ages and 40 trinkets with pocket objectives.', verified: false },
  { id: 'legends-of-enderas', name: 'Legends of Enderas', summary: 'Techlings (attachments), Mythlings (spells), Dinolings and Fuzelings: 82 traits, 8 Ages, 4 Catastrophes, plus 26 hidden Treasures.', verified: false },
  { id: 'mokoko-village', name: 'Mokoko Village', summary: '43 traits, 3 Ages and 1 Catastrophe.', verified: false },
  { id: 'shadow-puppets', name: 'Shadow Puppets', summary: 'Deepling, Glitterling and Moonling traits: 37 traits, 2 Ages and 1 Catastrophe.', verified: false },
  { id: 'nightflower-island', name: 'Nightflower Island', summary: '35 traits and 7 Ages, mixing earlier packs’ subspecies and classes.', verified: false },
  { id: 'upgrade', name: 'Upgrade', summary: 'The Meaning of Life (hidden objectives) and the first Techlings, Dinolings, Mythlings and Multicolor boosters: 58 traits, 3 Ages, 3 Catastrophes.', verified: false },
  { id: 'special-edition', name: 'Special Edition', summary: '19 Special Edition traits and 1 Age.', verified: false },
];

const LOCKED_REASON: Record<DmExpansionId, string | null> = {
  'castle-glass': null,
  overlush: null,
  'imaginary-ends': null,
  'magical-merchants': 'Not built yet — the trinkets’ powers and pocket objectives and the merchant Ages aren’t implemented.',
  'legends-of-enderas': 'Not built yet — attachments, spells and Treasures aren’t implemented.',
  'mokoko-village': 'No rulesheet in the sources (card data only).',
  'shadow-puppets': 'No rulesheet in the sources (card data only).',
  'nightflower-island': 'No rulesheet in the sources (card data only).',
  upgrade: 'Not built yet (The Meaning of Life and the first-edition boosters).',
  'special-edition': 'Not built yet.',
};

/** Why an expansion toggle is locked (null = playable), shown in the lobby. */
export function dmExpansionLockedReason(id: string): string | null {
  return id in LOCKED_REASON ? LOCKED_REASON[id as DmExpansionId] : 'Unknown expansion.';
}

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
export type DmClassicKind =
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

/** Castle Glass traits (30 + 7 Dominants). */
export type DmCastleGlassKind =
  | 'aposematic' | 'banal' | 'benthic' | 'biochromatic' | 'black-and-blue' | 'brainy' | 'buttery-fins' | 'conchomancy'
  | 'copper-band' | 'countershading' | 'crystal-skeleton' | 'fish-collector' | 'fragmentation' | 'glass-predator'
  | 'glossy' | 'guanine-crystals' | 'harboring' | 'keystone' | 'mucous-coating' | 'natural-symmetry' | 'opulent'
  | 'pearl' | 'pip' | 'porous' | 'pteridines' | 'radial-symmetry' | 'resplendent' | 'sandy' | 'sea-glass'
  | 'spiny-fins' | 'spiral-dome' | 'spiral-motion' | 'striated' | 'sunny' | 'tabular' | 'thermal-tolerance'
  | 'tidal-tolerance';

/** Overlush traits (138 distinct; its Kidneys and Swarms reuse the Classic kinds). */
export type DmOverlushKind =
  | 'adrenalized' | 'agile' | 'antennae' | 'apricity' | 'arrested-muscles' | 'backbiter' | 'barbels' | 'big-feller'
  | 'bitter-berries' | 'blossom' | 'booming-call' | 'booster' | 'bottomfeeder' | 'bushwhacker' | 'caffeinated' | 'cap'
  | 'cheek-pouches' | 'chompers' | 'citrus' | 'cocoa' | 'collector' | 'compound-eyes' | 'constrictor' | 'contagious'
  | 'dart' | 'docile' | 'down' | 'ear-flaps' | 'electroreception' | 'elusive' | 'epic' | 'euphoric'
  | 'eusocial' | 'eyestalks' | 'fabled' | 'face-hugger' | 'fardingbag' | 'fearful-symmetry' | 'fierce' | 'filter-feeder'
  | 'firebite' | 'fleece' | 'fleshy-scales' | 'floofy' | 'freckles' | 'grooming-claws' | 'gular-pouch' | 'harmony'
  | 'harrier' | 'haustorium' | 'hive-mind' | 'hydrofuge' | 'illusory' | 'indomitable' | 'infectious' | 'ironwood'
  | 'jumpy' | 'lily-pad' | 'lucky' | 'mammoth' | 'mandibles' | 'mane' | 'meek' | 'metamorphosis'
  | 'mimicry' | 'motion-dazzle' | 'muse' | 'mutualism' | 'mycelium' | 'mycotoxins' | 'nectar' | 'nimble'
  | 'noxious' | 'nuptial-plumage' | 'nutty' | 'opposable-thumbs' | 'patches' | 'pinchy' | 'playful' | 'procrastination'
  | 'prolific' | 'prowler' | 'psychedelic' | 'pyrophyte' | 'quills' | 'ravenous' | 'rover' | 'ruffled'
  | 'sapient' | 'scavenger' | 'scruffy' | 'seedwing' | 'seeker' | 'self-pruning' | 'shady' | 'shy'
  | 'silk' | 'skimmer' | 'sleek' | 'sleepy' | 'slender-gams' | 'snap-trap' | 'snuffler' | 'sour-grapes'
  | 'sparkles' | 'spearfisher' | 'spectacled' | 'spicy' | 'spores' | 'spots' | 'sprightly' | 'stasher'
  | 'sticky-stalks' | 'stinging-tendrils' | 'strange' | 'super-sneaky' | 'swampy' | 'sweet' | 'sycophant' | 'tenacious'
  | 'tiny-teeth' | 'toe-beans' | 'torpor' | 'toxic' | 'trapper' | 'tricky-vines' | 'trippy' | 'ursine'
  | 'vagabond' | 'vivacious' | 'wanderlust' | 'webber' | 'whistler' | 'willow' | 'woolly' | 'xylophage';

/** Imaginary Ends traits (Deeplings, Glitterlings, Moonlings, Fuzelings). */
export type DmImaginaryEndsKind =
  | 'atavism' | 'awesome' | 'baffling' | 'bedazzled' | 'bubbly' | 'chemotroph' | 'cryptic' | 'decaying-ooze'
  | 'dipped' | 'eccentric' | 'effervescent' | 'elegance' | 'enigma' | 'ephemeral' | 'ethereal' | 'extravagant'
  | 'feisty' | 'frumious' | 'frumple-pumple' | 'fuffle-nuffs' | 'fumplepop' | 'glamorous' | 'gob-lopters' | 'gossamer'
  | 'grobblebobble' | 'gurvendirs' | 'hidden' | 'humdumpling' | 'hurmflerm' | 'imaginative' | 'jibwib' | 'lure'
  | 'magic-beans' | 'merry' | 'mimsy' | 'monstrosity' | 'mufflemops' | 'nurplers' | 'pink' | 'polka-dots'
  | 'popplebelly' | 'rainbow-magic' | 'remarkable' | 'rogloblers' | 'scintillant' | 'scrappy' | 'slithy' | 'spineless'
  | 'sprinkles' | 'still' | 'stygian' | 'telescopic-eyes' | 'thwopplers' | 'toasty' | 'translucent' | 'turkendurt'
  | 'umbleboos' | 'undulating' | 'untold' | 'urf' | 'whimsy' | 'whip-tail' | 'whopple' | 'wishful';

export type DmTraitKind = DmClassicKind | DmCastleGlassKind | DmOverlushKind | DmImaginaryEndsKind;

/** Imaginary Ends subspecies, printed on the card. */
export type DmSubspecies = 'deepling' | 'glitterling' | 'moonling';

/** Castle Glass trait classes, printed at the bottom of a card. */
export type DmClass = 'shell' | 'coral' | 'fish';
/** A class card's tier: worth +1 / +2 / +3 each in a class of 2 or more. */
export type DmClassTier = 'basic' | 'curious' | 'exotic';

export interface DmTraitCard {
  id: number;
  kind: DmTraitKind;
  name: string;
  /** Printed colour; 'colorless' for grey traits. */
  color: DmTraitColor;
  /** Second colour of a dual-colour trait (expansions only — none in Classic). */
  secondaryColor?: DmTraitColor;
  /** Castle Glass: the trait's class and tier. */
  cls?: DmClass;
  tier?: DmClassTier;
  /** Overlush's Opposable Thumbs: the Dominant this card became an exact copy of. */
  copyOf?: string;
  /** Imaginary Ends: all four colours at once (Awesome!, Rainbow Magic). */
  isAllColors?: boolean;
  /** Imaginary Ends: the Suppress icon. */
  suppress?: boolean;
  /** Imaginary Ends: Deepling / Glitterling / Moonling. */
  sub?: DmSubspecies[];
  /**
   * Imaginary Ends: cards suppressed face down under this trait (only on a
   * trait in a pile). Not traits; +1 point each; go to the bottom of the
   * trait deck if this trait leaves the pile.
   */
  under?: DmTraitCard[];
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

/** One tag per Age (Classic 25, Castle Glass 2), plus 'none' for The Birth of Life and catastrophes. */
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
  | 'noColorless'      // Tropical Lands
  // ---- Castle Glass
  | 'castleGlass'      // Castle Glass
  | 'magicHour'        // Magic Hour
  // ---- Imaginary Ends (8)
  | 'quietMoment' | 'reverie' | 'solitude' | 'fadingAway' | 'glitterstorm' | 'moonlight'
  | 'teaParties' | 'unusualFriends'
  // ---- Overlush (28)
  | 'adventure' | 'certainty' | 'discovery' | 'noNegative' | 'envy' | 'backwoods'
  | 'cleansingRains' | 'crackletown' | 'duelingMoons' | 'glimmeringGardens' | 'harlequinFalls' | 'kingOfTheJungle'
  | 'noMulticolor' | 'discardPurple' | 'discardGreen' | 'nostalgia' | 'discardBlue' | 'ramblinRiver'
  | 'rustlingMeadows' | 'noDominants' | 'starTails' | 'discardRed' | 'swamplands' | 'tangledCanopies'
  | 'mokokoLegend' | 'livingLibrary' | 'paintedValley' | 'stranger';

/** One tag per Catastrophe (Classic 15, Castle Glass 1). */
export type DmCatastropheTag =
  | 'aiTakeover' | 'deusExMachina' | 'glacialMeltdown' | 'greyGoo' | 'iceAge' | 'massExtinction'
  | 'megaTsunami' | 'nuclearWinter' | 'overpopulation' | 'pulseEvent' | 'retrovirus' | 'solarFlare'
  | 'superVolcano' | 'theBigOne' | 'fourHorsemen'
  | 'stillWater'
  // ---- Imaginary Ends (4)
  | 'abyssStaresBack' | 'isolation' | 'moonpocalypse' | 'tooMuchPink'
  // ---- Overlush (15)
  | 'algalSuperbloom' | 'ancientCorruption' | 'ashlands' | 'chokingVines' | 'ecologicalCollapse' | 'endlessMonsoon'
  | 'greatDeluge' | 'invasiveSpecies' | 'jungleRot' | 'planetaryDeforestation' | 'sacrifice' | 'strangeMatter'
  | 'tragedyOfTheCommons' | 'tropicalSuperstorm' | 'volcanicWinter';

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
  | { t: 'enlightenment'; p: PlayerId; why?: string }
  | { t: 'stabilizeChoice'; p: PlayerId }
  /**
   * `to`: an explicit hand size (Fragmentation's 4, Sunny's 8, Harboring's 6); default the current target.
   * `source`: where the draws come from (Scavenger may take the top of the discard pile).
   */
  | { t: 'stabilize'; p: PlayerId; to?: number; source?: 'deck' | 'discard' }
  | { t: 'afterStabilize'; p: PlayerId }
  /** After you stabilize: Late, "at any time" traits, and Overlush's Firebite / Harrier / Illusory / Mimicry. */
  | { t: 'late'; p: PlayerId; used?: string[] }
  | { t: 'nextTurn' }
  | { t: 'nihilism' }
  // ---- age effects (before turns) ---------------------------------------
  | { t: 'ageRandomDiscard'; p: PlayerId }
  | { t: 'draculaSteal'; p: PlayerId }
  | { t: 'reasonKeep'; p: PlayerId; cardIds: number[] }
  | { t: 'alienTerraform'; p: PlayerId }
  | { t: 'heroRises'; p: PlayerId }
  | { t: 'discardFromHand'; p: PlayerId; count: number; why: string; noClass?: boolean }
  | { t: 'draw'; p: PlayerId; n: number; why: string }
  | { t: 'magicHour'; p: PlayerId }
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
  | {
      t: 'playAnother';
      p: PlayerId;
      why: string;
      triggerAction: boolean;
      cardIds?: number[];
      optional?: boolean;
      /** Only traits matching this rule (Copper Band: face value 1). */
      filter?: DmPlayFilter;
      /** Then do this to the trait just played (Spiny Fins / Spiral Motion). */
      then?: 'discard' | 'return';
      /** Play it into this player's pile instead (Shady). */
      into?: PlayerId;
    }
  | { t: 'afterPlayed'; p: PlayerId; cardId: number; mode: 'discard' | 'return'; why: string }
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
      /** The chooser may decline ("up to"). */
      optional?: boolean;
      /** Piles already used by this effect (Fish Collector: two different piles). */
      skipOwners?: PlayerId[];
      /** Only these traits (Snap-Trap, Vagabond: the ones just played). */
      ids?: number[];
    }
  | { t: 'pickPlayer'; p: PlayerId; mode: DmPlayerMode; srcId: number; ref?: number }
  | { t: 'pickColor'; p: PlayerId; mode: DmColorMode; srcId: number; from?: DmTraitColor }
  | { t: 'pickDiscard'; p: PlayerId; srcId: number; triggerAction: boolean }
  | { t: 'cleverReveal'; actor: PlayerId; opp: PlayerId }
  | { t: 'spotsPick'; actor: PlayerId; color: DmTraitColor }
  | { t: 'cleverSteal'; actor: PlayerId }
  | { t: 'nosySteal'; actor: PlayerId; opp: PlayerId; cardIds: number[] }
  | { t: 'dotingPick'; p: PlayerId; why?: string; times?: number }
  | { t: 'dotingTo'; p: PlayerId; cardId: number; why?: string }
  | { t: 'memory'; p: PlayerId }
  | { t: 'regenDraw'; p: PlayerId }
  | { t: 'prepper'; p: PlayerId }
  | { t: 'sneaky'; p: PlayerId; cardId: number }
  // ---- Castle Glass ------------------------------------------------------------
  | { t: 'radialSymmetry'; p: PlayerId }
  | { t: 'benthic'; p: PlayerId }
  | { t: 'pearl'; p: PlayerId; used: DmTraitColor[] }
  | { t: 'pip'; p: PlayerId }
  | { t: 'pipPlay'; p: PlayerId; value: number; tried: number[]; negative?: boolean }
  // ---- Overlush: ages ------------------------------------------------------------
  | { t: 'adventure'; p: PlayerId; colors?: DmTraitColor[] }
  | { t: 'optDiscard'; p: PlayerId; why: string; max: number; then?: 'draw1'; negativeOnly?: boolean }
  | { t: 'colorDiscard'; p: PlayerId; color: DmTraitColor; why: string }
  | { t: 'passColor'; from: PlayerId; to: PlayerId; color: DmTraitColor }
  | { t: 'duelingMoons'; p: PlayerId }
  | { t: 'toDeck'; p: PlayerId; where: 'top' | 'bottom'; min: number; max: number; why: string }
  | { t: 'kingReveal'; p: PlayerId }
  | { t: 'kingResolve' }
  | { t: 'mokokoPlay'; p: PlayerId }
  | { t: 'livingLibrary'; p: PlayerId }
  | { t: 'swampDiscard'; p: PlayerId }
  | { t: 'procrastination'; asked: PlayerId[] }
  | { t: 'restartAge' }
  // ---- Overlush: catastrophes ------------------------------------------------------
  | { t: 'sleepyWindow'; catId: number; asked: PlayerId[] }
  | { t: 'catastropheGp'; catId: number }
  | { t: 'passRight'; colors: DmTraitColor[] | 'colorless' }
  | { t: 'weInvasive'; p: PlayerId }
  // ---- Overlush: traits --------------------------------------------------------------
  | { t: 'removalWindow'; owner: PlayerId; cardId: number; by: PlayerId | null; byDominant: boolean; asked: PlayerId[] }
  | { t: 'elusive'; p: PlayerId; cardId: number }
  | { t: 'muse'; p: PlayerId; cardId: number }
  | { t: 'mycelium'; p: PlayerId }
  | { t: 'snapTrap'; actor: PlayerId; ids: number[]; asked: PlayerId[] }
  | { t: 'pinchyReplay'; p: PlayerId }
  | { t: 'skimmer'; p: PlayerId }
  | { t: 'strange'; p: PlayerId }
  | { t: 'afterBorrow'; p: PlayerId; mode: 'discardHand' | 'discardRandom' | 'returnToOwner' | 'discardIt'; cardId: number; owner: PlayerId }
  | { t: 'agile'; p: PlayerId; done: number }
  | { t: 'fierce'; p: PlayerId; done: number }
  | { t: 'hiveMind'; p: PlayerId; done: number }
  | { t: 'selfPruning'; p: PlayerId }
  | { t: 'fromDiscard'; p: PlayerId; why: string; rule: 'face2' | 'any'; optional: boolean }
  | { t: 'gift'; p: PlayerId; to: PlayerId[]; why: string; pending?: boolean }
  | { t: 'discardIds'; p: PlayerId; ids: number[]; why: string }
  | { t: 'applyPending' }
  | { t: 'rover'; p: PlayerId; color: DmTraitColor }
  | { t: 'sapient'; p: PlayerId }
  | { t: 'seeker'; p: PlayerId }
  | { t: 'seekerPlay'; p: PlayerId; value: number; drawn: number[] }
  | { t: 'shady'; p: PlayerId }
  | { t: 'torpor'; p: PlayerId }
  | { t: 'trapper'; p: PlayerId; done: number }
  | { t: 'vagabondPlay'; p: PlayerId; actor: PlayerId }
  | { t: 'vagabondChoice'; actor: PlayerId; ids: number[] }
  | { t: 'wanderlust'; p: PlayerId; first: number }
  | { t: 'electro'; p: PlayerId; drawn: number[] }
  | { t: 'collector'; p: PlayerId; drawn: number[]; used: DmTraitColor[] }
  | { t: 'fabledCost'; p: PlayerId; cardId: number; from: DmPlayFrom; triggerAction: boolean }
  | { t: 'illusoryEnd'; p: PlayerId; cardId: number }
  | { t: 'harrier'; p: PlayerId }
  | { t: 'illusory'; p: PlayerId }
  | { t: 'woolly'; p: PlayerId }
  | { t: 'chompers'; p: PlayerId }
  | { t: 'lilyPad'; p: PlayerId; cardId: number; done: number }
  | { t: 'pyrophyte'; p: PlayerId; drawn: number[] }
  // ---- Imaginary Ends -----------------------------------------------------------------
  /** Choose `count` cards (one at a time) from your hand / pile to suppress. */
  | { t: 'suppressPick'; p: PlayerId; source: 'hand' | 'pile'; count: number; optional: boolean; why: string; exclude: number[] }
  /** Suppress these cards (in your hand or pile) under a host you choose. */
  | { t: 'suppressCards'; p: PlayerId; ids: number[]; why: string }
  | { t: 'glitterstorm'; p: PlayerId }
  | { t: 'setGenePool'; p: PlayerId; value: number; why: string }
  | { t: 'lureColor'; p: PlayerId; victim: PlayerId }
  | { t: 'bedazzled'; p: PlayerId }
  | { t: 'magicBeans'; p: PlayerId }
  | { t: 'effervescent'; p: PlayerId }
  | { t: 'scrappy'; p: PlayerId; srcId: number; drawn: number[] }
  | { t: 'giveCards'; p: PlayerId; n: number; why: string; to?: PlayerId }
  | { t: 'mimsy'; p: PlayerId }
  | { t: 'polkaDots'; p: PlayerId; ids: number[] }
  | { t: 'imaginative'; p: PlayerId }
  | { t: 'urf'; p: PlayerId }
  | { t: 'gobLopters'; p: PlayerId; cardId: number; from: DmPlayFrom; triggerAction: boolean }
  | { t: 'whimsy'; p: PlayerId; cardId: number; from: DmPlayFrom; triggerAction: boolean }
  // ---- World's End -------------------------------------------------------
  | { t: 'worldsEnd' }
  | { t: 'weTraits'; order: PlayerId[]; idx: number }
  | { t: 'weResolve'; p: PlayerId; cardId: number }
  | { t: 'weCatastrophe' }
  | { t: 'weDiscardTrait'; p: PlayerId; rule: 'blue' | 'green' | 'red' | 'purple' | 'colorless' | 'face4' | 'dropOfLife' }
  | { t: 'score' };

/** Which traits a "play another" step allows (all set fields must hold). */
export interface DmPlayFilter {
  face?: number;
  maxFace?: number;
  negative?: boolean;
  nonDominant?: boolean;
  color?: DmTraitColor;
}

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
  | 'clawsCost'        // Retractable Claws' cost: a red trait to discard
  // ---- Overlush
  | 'returnOwn'        // Nostalgia, Sacrifice, Sleek, Lily Pad: back to your hand
  | 'discardCost';     // Metamorphosis / Xylophage: traits discarded to play

export type DmPlayerMode =
  | 'swapHands'     // Flight
  | 'stealRandom2'  // Impatience
  | 'nosy'          // Nosy
  | 'moveSource'    // Venomous: who receives it
  | 'giveTrait'     // Scutes / Morality: who receives `ref`
  | 'reckless'      // Reckless: which opponent
  | 'tolerance'     // Thermal / Tidal Tolerance: whose pile is counted
  | 'peekHand'      // Eyestalks
  | 'extravagant'   // Imaginary Ends: who gets your Moonlings and Glitterlings
  | 'baffling'      // Imaginary Ends: whose pile Baffling moves into
  | 'gurvendirs'    // Imaginary Ends: who gets the cards (`ref`: how many)
  | 'nutty'         // Nutty: who draws 3 and gives you 1
  | 'shady';        // Shady: whose pile the card goes into

export type DmColorMode =
  | 'persuasive' | 'hyperIntelligence' | 'sentience' | 'viral' | 'faithFrom' | 'faithTo'
  // ---- Overlush
  | 'rover' | 'nectar' | 'spots' | 'harlequin' | 'paintedValley' | 'ramblin' | 'crackletown' | 'tragedy'
  // ---- Imaginary Ends
  | 'stygian';

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
  /** Thermal / Tidal Tolerance: the opponent each card counts, by card id. */
  chosenPlayer: Record<number, PlayerId>;
  /** Overlush Lily Pad: traits each card returned, by card id. */
  lilyPad?: Record<number, number>;
  /** Overlush Invasive Species / Imaginary Ends Isolation: the face value each player adds to their score. */
  addFace?: Record<PlayerId, number>;
  /** Imaginary Ends Too Much Pink: the colours of the card turned up. */
  pinkColors?: DmTraitColor[];
}

/** One-turn effects of the turn player's own Actions (reset at the start of every turn). */
export interface DmTurnFx {
  p: PlayerId;
  /** Guanine Crystals: draw 2 instead of stabilizing at the end of this turn. */
  draw2?: boolean;
  /** Harboring: stabilize to this many at the end of this turn. */
  stabilizeTo?: number;
  /** "Cannot play this effect twice in 1 turn" (Spiral Motion, Booming Call, Skimmer). */
  used: DmTraitKind[];
  /** Overlush Cheek Pouches: don't stabilize this turn. */
  noStabilize?: boolean;
  /** Traits the turn player played this turn (Snap-Trap, Mimicry). */
  plays?: number[];
  /** Actions the turn player resolved this turn (Illusory). */
  actions?: number;
  /** Overlush Illusory: this action's other Actions are ignored. */
  ignoreActions?: boolean;
}

/** Overlush one-round Age effects (reset whenever an age is flipped or restarted). */
export interface DmAgeFx {
  /** Ramblin' River Markets: colours a player can't play this round. */
  bans: { p: PlayerId; color: DmTraitColor }[];
  /** Star Tails: players who can't draw any more this round. */
  noDraw: PlayerId[];
  /** Swamplands: Action traits each player played this round. */
  swamp: { p: PlayerId; cardId: number }[];
  /** Procrastination: players already asked / who took an extra turn this round. */
  procrastinated: PlayerId[];
  /** Psychedelic: this age has already been restarted once. */
  restarted?: boolean;
  /** Sleepy: players who ignore this catastrophe's Gene Pool effect. */
  sleepy?: PlayerId[];
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
  /** Brainy: colours a player can't play on their next turn (cleared when that turn ends). */
  turnBans: { p: PlayerId; color: DmTraitColor; srcId: number }[];
  turnFx: DmTurnFx;
  ageFx: DmAgeFx;
  /** True while an age's (or catastrophe's) effect resolves, before turns start. */
  agePhase: boolean;
  /** Overlush Eyestalks: the hand `viewer` may see this turn. */
  peekHand: { viewer: PlayerId; owner: PlayerId } | null;
  /** Overlush Sapient: the last two ages in the age deck a player has seen. */
  peekedLast: Record<PlayerId, number[]>;
  /** Overlush King of the Jungle: cards chosen face down, revealed together. */
  pendingReveal: { p: PlayerId; cardId: number }[];

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
  | {
      type: 'playTrait';
      playerId: PlayerId;
      cardId: number;
      /** Overlush, The Legend of Mokoko Village (with Heroic): play 2 traits, ignoring their Actions. */
      twoIgnoringActions?: boolean;
    }
  /** Overlush Nimble (from your hand) / Seedwing (from your pile): discard it for its effect, on your turn. */
  | { type: 'useCard'; playerId: PlayerId; cardId: number }
  /**
   * A Play-When trait played "at any time" (offered during your own turn): Self-Awareness into an
   * opponent's pile; Castle Glass's Conchomancy, Sea Glass and Sunny into your own (target = you).
   */
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
