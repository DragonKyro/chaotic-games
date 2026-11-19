// Unstable Unicorns — types for the implemented 2nd Edition Base Game.

import type { GameStateShape } from '@/core/module';
import type { ExpansionConfig, ExpansionMeta, PlayerId } from '@/core/types';
import type { LogEntry } from '@/core/state';

// ============================================================================
// Cards
// ============================================================================

export type UuCardType =
  | 'babyUnicorn'
  | 'basicUnicorn'
  | 'magicalUnicorn'
  | 'magic'
  | 'instant'
  | 'upgrade'
  | 'downgrade';

export function isUnicornType(t: UuCardType): boolean {
  return t === 'babyUnicorn' || t === 'basicUnicorn' || t === 'magicalUnicorn';
}

export type UuCardKind =
  // Baby Unicorns (13)
  | 'baby-red'
  | 'baby-pink'
  | 'baby-orange'
  | 'baby-yellow'
  | 'baby-green'
  | 'baby-blue'
  | 'baby-purple'
  | 'baby-black'
  | 'baby-white'
  | 'baby-brown'
  | 'baby-rainbow'
  | 'baby-death'
  | 'baby-narwhal'
  // Basic Unicorns (8 kinds, 22 cards)
  | 'basic-red'
  | 'basic-orange'
  | 'basic-yellow'
  | 'basic-green'
  | 'basic-blue'
  | 'basic-indigo'
  | 'basic-purple'
  | 'basic-narwhal'
  // Magical Unicorns (30 kinds, 30 cards)
  | 'alluring-narwhal'
  | 'americorn'
  | 'annoying-flying-unicorn'
  | 'black-knight-unicorn'
  | 'chainsaw-unicorn'
  | 'classy-narwhal'
  | 'dark-angel-unicorn'
  | 'extremely-destructive-unicorn'
  | 'ginormous-unicorn'
  | 'greedy-flying-unicorn'
  | 'llamacorn'
  | 'magical-flying-unicorn'
  | 'magical-kittencorn'
  | 'majestic-flying-unicorn'
  | 'mermaid-unicorn'
  | 'mother-goose-unicorn'
  | 'narwhal-torpedo'
  | 'necromancer-unicorn'
  | 'queen-bee-unicorn'
  | 'rainbow-unicorn'
  | 'rhinocorn'
  | 'seductive-unicorn'
  | 'shabby-the-narwhal'
  | 'shark-with-a-horn'
  | 'stabby-the-unicorn'
  | 'swift-flying-unicorn'
  | 'the-great-narwhal'
  | 'unicorn-on-the-cob'
  | 'unicorn-oracle'
  | 'unicorn-phoenix'
  // Magic cards (15 kinds, 25 cards)
  | 'back-kick'
  | 'blatant-thievery'
  | 'change-of-luck'
  | 'glitter-tornado'
  | 'good-deal'
  | 'kiss-of-life'
  | 'mystical-vortex'
  | 're-target'
  | 'reset-button'
  | 'shake-up'
  | 'targeted-destruction'
  | 'two-for-one'
  | 'unfair-bargain'
  | 'unicorn-poison'
  | 'unicorn-swap'
  // Instant cards (2 kinds, 15 cards)
  | 'neigh'
  | 'super-neigh'
  // Upgrade cards (8 kinds, 14 cards)
  | 'caffeine-overload'
  | 'claw-machine'
  | 'double-dutch'
  | 'glitter-bomb'
  | 'rainbow-aura'
  | 'rainbow-lasso'
  | 'stable-artillery'
  | 'yay'
  // Downgrade cards (8 kinds, 8 cards)
  | 'barbed-wire'
  | 'blinding-light'
  | 'broken-stable'
  | 'nanny-cam'
  | 'pandamonium'
  | 'sadistic-ritual'
  | 'slowdown'
  | 'tiny-stable'
  // Rainbow Apocalypse expansion
  | 'baby-apocalypse'
  | 'four-horsecorn'
  | 'unicorn-of-famine'
  | 'unicorn-of-pestilence'
  | 'unicorn-of-war'
  | 'unicorn-of-death'
  | 'unicorn-rainbow-princess'
  | 'catastrophe'
  | 'rainbow-apocalypse-magic'
  | 'plague-of-death'
  | 'apocalypse-bunker'
  | 'all-out-of-rainbows'
  | 'neigh-thank-you'
  // Dragons expansion
  | 'baby-dragoncorn'
  | 'bahamuticorn'
  | 'twin-dragoncorns'
  | 'dragon-riders'
  | 'dragon-slayer-unicorn'
  | 'scaled-flying-unicorn'
  | 'dragons-breath'
  | 'dragons-fire'
  | 'dragons-blessing'
  | 'dragons-fortune'
  | 'dragons-curse'
  | 'dragon-skies'
  | 'neigh-foul-beast'
  // Unicorns of Legend expansion
  | 'baby-knight-unicorn'
  | 'archangel-unicorn'
  | 'nine-tailed-foxicorn'
  | 'mage-unicorn'
  | 'bardicorn'
  | 'paladincorn'
  | 'raze-the-stables'
  | 'fireball'
  | 'dwarven-forge'
  | 'medieval-sanitation'
  | 'neigh-mlord'
  // Adventures expansion
  | 'baby-adventurer'
  | 'cutthroat-captain-unicorn'
  | 'extreme-adventurer-unicorn'
  | 'pillaging-pirate-unicorn'
  | 'treasure-hunter-unicorn'
  | 'the-great-baby-heist'
  | 'mysterious-compass'
  | 'unicorn-survival-kit'
  | 'royal-hooves'
  | 'the-black-spot'
  | 'unicorn-net'
  | 'absorb-and-reflect'
  | 'redirect'
  | 'flare-gun'
  | 'trapped-chest'
  // Nightmares expansion
  | 'baby-nightmare'
  | 'phantom-steedicorn'
  | 'vampirellacorn'
  | 'jack-the-reapercorn'
  | 'chainsaw-massicorn'
  | 'nightmare-pact'
  | 'black-hole'
  | 'saved-by-the-sigil'
  | 'hex'
  | 'hex-neigh'
  // Christmas expansion
  | 'baby-rudolphicorn'
  | 'santaicorn'
  | 'reindeercorn'
  | 'flying-krampuscorn'
  | 'humbug'
  | 'gift-receipt'
  | 'gingerbread-stable'
  | 'ugly-holiday-sweater'
  | 'gift-inspector'
  | 'lump-of-coal'
  | 'jingle-all-the-neigh'
  // Uncut Unicorns expansion
  | 'baby-uncut'
  | 'uncut-unicorn'
  | 'stripper-unicorn'
  | 'hangover-unicorn'
  | 'liquid-courage'
  | 'walk-of-shame'
  | 'vip-lounge'
  | 'stage-fright'
  | 'neigh-bitch'
  // NSFW expansion
  | 'baby-nsfw'
  | 'dominatrix-unicorn'
  | 'sugar-daddy-unicorn'
  | 'polyamorous-unicorn'
  | 'booty-call'
  | 'ghosted'
  | 'leather-harness'
  | 'ball-and-chain'
  | 'hard-limit-neigh'
  // 1st Edition ('base') / Control / Chaos / Diamond / Travel edition cards
  | 'extremely-fertile-unicorn'
  | 'puppicorn'
  | 'zombie-unicorn'
  | 'angel-unicorn'
  | 'unicorn-shrinkray'
  | 'extra-tail'
  | 'rainbow-mane'
  | 'summoning-ritual'
  | 'unicorn-lasso'
  | 'chronocorn'
  | 'unicorn-of-order'
  | 'time-shift'
  | 'aura-of-order'
  | 'unicorn-of-chaos'
  | 'hells-steedicorn'
  | 'chaos-storm'
  | 'altar-of-chaos'
  | 'diamond-unicorn'
  | 'crystal-narwhal'
  | 'diamond-dust'
  | 'prismatic-shield'
  | 'travel-unicorn';

export interface UuCard {
  id: number;
  kind: UuCardKind;
  name: string;
  type: UuCardType;
  text: string;
  source?: UuExpansionId | UuEdition;
}

// ============================================================================
// Zones & Prompts
// ============================================================================

export interface UuStable {
  unicorns: UuCard[];
  upgrades: UuCard[];
  downgrades: UuCard[];
}

export interface UuPendingPlay {
  byPlayerId: PlayerId;
  card: UuCard;
  /** Target stable owner where a Unicorn/Upgrade/Downgrade will enter, or target of a Magic card. */
  targetPlayerId: PlayerId | null;
  neighCards: UuCard[];
  instantPlays?: { byPlayerId: PlayerId; card: UuCard }[];
  superNeighed: boolean;
  responderQueue: PlayerId[];
}

export type UuPrompt =
  | {
      kind: 'beginningTrigger';
      playerId: PlayerId;
      sourceCard: UuCard;
      mandatory: boolean;
    }
  | {
      kind: 'chooseCardsFromHand';
      playerId: PlayerId;
      reason: string;
      count: number;
      optional: boolean;
      filter: 'any' | 'unicorn' | 'basicUnicorn';
      effectTag:
        | 'discard'
        | 'rainbowUnicornBring'
        | 'unicornBring'
        | 'necromancerDiscard'
        | 'seductiveDiscard'
        | 'changeOfLuckDiscard'
        | 'mysticalVortexDiscard'
        | 'PhoenixSave'
        | 'clawMachineDiscard'
        | 'stableArtilleryDiscard'
        | 'rainbowLassoDiscard'
        | 'fertileDiscard'
        | 'zombieDiscard'
        | 'summoningRitualDiscard'
        | 'endOfTurnLimit';
      contextCardId?: number;
      afterContext?: {
        pendingDestroyOwnerId?: PlayerId;
        pendingDestroyCardId?: number;
        fromSacrifice?: boolean;
      };
    }
  | {
      kind: 'chooseStableCard';
      playerId: PlayerId;
      reason: string;
      optional: boolean;
      scope: 'own' | 'others' | 'any' | 'specificPlayer';
      specificPlayerId?: PlayerId;
      filter:
        | 'any'
        | 'unicorn'
        | 'upgrade'
        | 'downgrade'
        | 'upgradeOrDowngrade'
        | 'unicornOrUpgrade'
        | 'destroyUpgradeOrSacrificeDowngrade';
      mode: 'sacrifice' | 'destroy' | 'steal' | 'bounce' | 'moveSource' | 'swapGive' | 'swapSteal';
      sourceType: 'magic' | 'unicorn' | 'upgrade' | 'downgrade';
      effectTag?: string;
    }
  | {
      kind: 'choosePlayer';
      playerId: PlayerId;
      reason: string;
      optional: boolean;
      allowSelf: boolean;
      effectTag:
        | 'americornPull'
        | 'annoyingDiscard'
        | 'blatantThieveryLook'
        | 'unfairBargainTrade'
        | 'reTargetDestination'
        | 'unicornSwapTarget'
        | 'shrinkrayTarget'
        | 'dominatrixForceSacrifice';
      movedCardId?: number;
      movedFromPlayerId?: PlayerId;
    }
  | {
      kind: 'chooseFromOpponentHand';
      playerId: PlayerId;
      targetPlayerId: PlayerId;
      reason: string;
    }
  | {
      kind: 'chooseFromPile';
      playerId: PlayerId;
      reason: string;
      optional: boolean;
      pile: 'discard' | 'deck' | 'nursery';
      filter:
        | 'unicorn'
        | 'magic'
        | 'upgrade'
        | 'downgrade'
        | 'neigh'
        | 'narwhal'
        | 'baby'
        | 'unicornOrUpgrade'
        | 'magicOrUpgrade';
      destination: 'hand' | 'stable';
      shuffleDeckAfter?: boolean;
    }
  | {
      kind: 'oraclePeek';
      playerId: PlayerId;
      cards: UuCard[];
    }
  | {
      kind: 'blackKnightSave';
      playerId: PlayerId;
      blackKnightCardId: number;
      targetUnicornId: number;
      sourceType: 'magic' | 'unicorn' | 'upgrade' | 'downgrade';
    };

// ============================================================================
// Config
// ============================================================================

export type UuExpansionId =
  | 'uncut-unicorns'
  | 'nsfw'
  | 'rainbow-apocalypse'
  | 'dragons'
  | 'unicorns-of-legend'
  | 'adventures'
  | 'christmas'
  | 'nightmares';

export type UuEdition =
  | 'base'
  | 'base-2nd'
  | 'control'
  | 'chaos'
  | 'nsfw'
  | 'travel'
  | 'kids'
  | 'diamond';

export const UU_EXPANSIONS: readonly ExpansionMeta[] = [
  {
    id: 'uncut-unicorns',
    name: 'Uncut Unicorns',
    summary: 'Uncut Unicorn (+1 hand limit), Burlesque & Hangover Unicorns, Liquid Courage, Walk of Shame, Stage Fright.',
    verified: true,
  },
  {
    id: 'nsfw',
    name: 'NSFW',
    summary: 'Dominatrix, Sugar Daddy & Polyamorous Unicorns, Spiked Harness, Ball and Chain, Hard Limit Neigh.',
    verified: true,
  },
  {
    id: 'rainbow-apocalypse',
    name: 'Rainbow Apocalypse',
    summary: 'Four Horsecorn, Unicorns of Famine/Pestilence/War/Death, Catastrophe, Rainbow Apocalypse, Neigh Thank You.',
    verified: true,
  },
  {
    id: 'dragons',
    name: 'Dragons',
    summary: "Bahamuticorn, Twin Dragoncorns, Dragon Riders, Dragon's Breath, Dragon's Blessing (ignores Downgrades), Dragon's Curse.",
    verified: true,
  },
  {
    id: 'unicorns-of-legend',
    name: 'Unicorns of Legend',
    summary: 'Archangel Unicorn, Nine-Tailed Foxicorn, Mage Unicorn, Bardicorn, Paladincorn, Raze the Stables, Medieval Sanitation.',
    verified: true,
  },
  {
    id: 'adventures',
    name: 'Adventures',
    summary: 'New Instant responses (Unicorn Net, Absorb & Reflect, Redirect, Flare Gun, Trapped Chest), Pirate & Adventurer Unicorns.',
    verified: true,
  },
  {
    id: 'christmas',
    name: 'Christmas',
    summary: 'Santaicorn, Reindeercorn, Flying Krampuscorn, Gingerbread Stable, Ugly Holiday Sweater, Gift Inspector, Jingle All The Neigh.',
    verified: true,
  },
  {
    id: 'nightmares',
    name: 'Nightmares',
    summary: 'Phantom Steedicorn, Vampirellacorn, Jack the Reapercorn, Nightmare Pact, Black Hole, Saved by the Sigil, Hex.',
    verified: true,
  },
];

export interface UuConfig extends ExpansionConfig {
  expansions: UuExpansionId[];
  edition: UuEdition;
}

// ============================================================================
// State
// ============================================================================

export type UuPhase =
  | 'beginningOfTurn'
  | 'draw'
  | 'action'
  | 'endOfTurn'
  | 'awaitingNeigh'
  | 'awaitingPrompt'
  | 'gameOver';

export interface UuState extends GameStateShape {
  subPhase: UuPhase;
  /** The phase to resume once awaitingNeigh / awaitingPrompt finishes. */
  resumePhase: 'beginningOfTurn' | 'draw' | 'action' | 'endOfTurn';

  deck: UuCard[];
  discard: UuCard[];
  nursery: UuCard[];

  hands: Record<PlayerId, UuCard[]>;
  stables: Record<PlayerId, UuStable>;

  turnPlayerId: PlayerId;
  /** Number of card plays left in the current Action phase (1 normally, 2 if Double Dutch was active at start of turn). */
  playsRemaining: number;
  /** True if the active player already took an action in the Action phase (so they can end Action phase if Double Dutch gave 2 plays). */
  actedInActionPhase: boolean;
  /** Set by Change of Luck when resolved; grants an extra turn after this one. */
  extraTurnPending: boolean;
  /** Set by Rhinocorn when its beginning-of-turn destroy is used; skips immediately to endOfTurn. */
  skipToEndOfTurn: boolean;

  pending: UuPendingPlay | null;
  promptQueue: UuPrompt[];

  unicornsToWin: number;
  winnerId: PlayerId | null;

  log: LogEntry[];
  logSeq: number;

  config: UuConfig;
}

// ============================================================================
// Actions
// ============================================================================

export type UuAction =
  | { type: 'drawForTurn'; playerId: PlayerId }
  | {
      type: 'playCard';
      playerId: PlayerId;
      cardId: number;
      targetPlayerId?: PlayerId;
    }
  | { type: 'drawInsteadOfPlaying'; playerId: PlayerId }
  | { type: 'endActionPhase'; playerId: PlayerId }
  | { type: 'playNeigh'; playerId: PlayerId; cardId: number }
  | { type: 'declineNeigh'; playerId: PlayerId }
  | {
      type: 'resolvePrompt';
      playerId: PlayerId;
      decline?: boolean;
      cardIds?: number[];
      targetPlayerId?: PlayerId;
      targetCardId?: number;
      /** For oraclePeek: chosen card to add to hand, and ordered [top, second] ids to put back on deck. */
      oraclePickId?: number;
      oracleTopOrder?: number[];
    };
