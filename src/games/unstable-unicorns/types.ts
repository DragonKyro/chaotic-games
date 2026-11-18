// Unstable Unicorns — types for the implemented 2nd Edition Base Game.

import type { GameStateShape } from '@/core/module';
import type { PlayerId } from '@/core/types';
import type { ExpansionMeta, ScaffoldConfig } from '../_scaffold';

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

export const UNICORN_TYPES: readonly UuCardType[] = [
  'babyUnicorn',
  'basicUnicorn',
  'magicalUnicorn',
];

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
  | 'tiny-stable';

export interface UuCard {
  id: number;
  kind: UuCardKind;
  name: string;
  type: UuCardType;
  text: string;
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
        | 'necromancerDiscard'
        | 'seductiveDiscard'
        | 'changeOfLuckDiscard'
        | 'mysticalVortexDiscard'
        | 'PhoenixSave'
        | 'clawMachineDiscard'
        | 'stableArtilleryDiscard'
        | 'rainbowLassoDiscard'
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
        | 'unicornSwapTarget';
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
      filter: 'unicorn' | 'magic' | 'upgrade' | 'downgrade' | 'neigh' | 'narwhal' | 'baby';
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

export interface UuLogEntry {
  seq: number;
  byPlayerId: PlayerId | null;
  text: string;
  tone: 'normal' | 'danger' | 'good';
}

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
  { id: 'uncut-unicorns', name: 'Uncut Unicorns', summary: 'Expansion pack.', verified: true },
  { id: 'nsfw', name: 'NSFW', summary: 'Adult-humour expansion pack.', verified: true },
  { id: 'rainbow-apocalypse', name: 'Rainbow Apocalypse', summary: 'Expansion pack.', verified: true },
  { id: 'dragons', name: 'Dragons', summary: 'Expansion pack.', verified: true },
  { id: 'unicorns-of-legend', name: 'Unicorns of Legend', summary: 'Expansion pack.', verified: true },
  { id: 'adventures', name: 'Adventures', summary: 'Expansion pack.', verified: true },
  { id: 'christmas', name: 'Christmas', summary: 'Holiday expansion pack.', verified: true },
  { id: 'nightmares', name: 'Nightmares', summary: 'Expansion pack.', verified: true },
];

export interface UuConfig extends ScaffoldConfig {
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

  log: UuLogEntry[];
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
