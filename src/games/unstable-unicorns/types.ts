// Unstable Unicorns — types and design notes.
//
// RULES AUDIT (Nov 2026, sources: the Unstable Games Wiki via the Wayback
// Machine — "Second Edition Rules", "FAQ", "Two Player Rules", the per-deck
// "Cards In This Deck" / "Inventory List" pages, "Second Print and 2nd Edition
// Comparisons", and the Gameplay Terminology pages Requirement / Impossible /
// Pull / Stable / Play / Unicorn Card / Queen Bee Unicorn).
//
// Verified card-for-card (names, counts, 2nd Edition texts):
//   - 'base-2nd'  2nd Edition Base Deck: 13 Babies + 114 cards (+ 8 reference cards).
//   - 'diamond'   the same 114 + 13, plus 4 Diamond Unicorns in a Vault and a
//                 Diamond Phase (d4). Reaper's printed text was never archived:
//                 it is modeled as a Diamond Unicorn with NO effect (not modeled).
// Composition verified, wording not:
//   - 'base'      Original Base Deck, Second Print inventory (127 + 8). The nine
//                 retired cards use their Second Print text; the cards it shares
//                 with the 2nd Edition still use 2nd Edition wording, which differs
//                 for Americorn, Annoying Flying, Chainsaw, Ginormous, Llamacorn,
//                 Kittencorn, Mermaid, Seductive, Unicorn Phoenix, Back Kick,
//                 Blatant Thievery, Targeted Destruction, Blinding Light, Slowdown.
// NOT the printed decks (unofficial approximations, flagged in the lobby):
//   - 'control', 'chaos': real decks are full ~140-card base games of their own
//     (Ultimate Unicorns, new Basics such as Raccoonicorn...), not base + 5 cards.
//   - 'travel': the real Travel deck is a cut-down 2nd Edition deck plus eight
//     cards of its own (Annoying Traveling, Frequent Flyer, Friendly Local, Road
//     Trip, Traveling Doctor, Up For Anything Unicorn; Souvenir Shop; Tourist Trap)
//     and lists no Baby Unicorns.
//   - every expansion in UU_EXPANSIONS: see the official contents noted there.
//
// Unconfirmed (code's reading kept): the deck "runs out" when someone must DRAW
// from an empty deck; Pandas are also shielded from "a card" (not just "a
// Unicorn card") effects; letters for the deck-out tiebreak are counted on the
// names as listed here, e.g. "Basic Unicorn (Red)".

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
  /** Diamond Edition only: kept in the Vault, never in the deck or a hand. */
  | 'diamondUnicorn'
  | 'magic'
  | 'instant'
  | 'upgrade'
  | 'downgrade';

export function isUnicornType(t: UuCardType): boolean {
  return t === 'babyUnicorn' || t === 'basicUnicorn' || t === 'magicalUnicorn' || t === 'diamondUnicorn';
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
  // Diamond Edition: the four Diamond Unicorns of the Vault
  | 'prismawing'
  | 'reaper'
  | 'shimmerblade'
  | 'sparklestar'
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
        | 'prismawingDiscard'
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
        | 'diamond'
        | 'destroyUpgradeOrSacrificeDowngrade';
      /** `toVault`: Diamond Edition — return a Diamond Unicorn to the Vault. */
      mode: 'sacrifice' | 'destroy' | 'steal' | 'bounce' | 'moveSource' | 'swapGive' | 'swapSteal' | 'toVault';
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
        | 'shimmerbladeLook'
        | 'dominatrixForceSacrifice';
      movedCardId?: number;
      movedFromPlayerId?: PlayerId;
    }
  | {
      kind: 'chooseFromOpponentHand';
      playerId: PlayerId;
      targetPlayerId: PlayerId;
      reason: string;
      /** Shimmerblade: "you may choose a card" — the look need not end in a take. */
      optional?: boolean;
    }
  | {
      kind: 'chooseFromPile';
      playerId: PlayerId;
      reason: string;
      optional: boolean;
      pile: 'discard' | 'deck' | 'nursery' | 'vault';
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

/**
 * None of these card pools is the printed expansion: each mixes a few real card
 * names (texts unconfirmed) with cards that don't exist. They stay playable, but
 * are flagged unverified. Official contents, for the rebuild (wiki "Cards In This
 * Deck", 2nd Edition prints):
 *
 * - Rainbow Apocalypse: Babies (Flowers, Sparkles); Basics Horse With An Ice Cream
 *   Cone, Innocent Bunnicorn; Magical Adorable Flying Unicorn, Angel Unicorn, Cotton
 *   Candy Llamacorn, Extremely Destructive Unicorn, Extremely Fertile Unicorn,
 *   Frenchiecorn, Glitter Unicorn, Llamacorn, Magical Kittencorn, The Tiniest
 *   Unicorn, Unicorn of Death / Famine / Pestilence / War, Unicorn Phoenix, Unicorn
 *   Rainbow Princess, Zombie Unicorn; Magic A Cute Attack, Fire and Brimstone,
 *   Heavenly Smite, Llamapocalypse, Overpopulation, Plague of Death, Storm of
 *   Cuteness, Ultimate Destruction, Unicorn Nap, Unicorns of the Apocalypse, Zombie
 *   Apocalypse; Instant Neigh, Thank You; Upgrades Rainbow Sprinkles, Special
 *   Delivery; Downgrade Tiny Hooves.
 * - Dragons: 6 Baby Dragoncorns (Black, Blue, Green, Orange, Pink, Red); Basics
 *   Apprentice Unicorn, Dragon Cosplay Unicorn, High Roller Unicorn, Unicorn With a
 *   Dragon Tattoo; Magical Angry Dragoncorn, Dragon Rider Unicorn, Dragon Slayer
 *   Unicorn, Dragon Summoner Unicorn, Dragon Tamer Unicorn, Dragon Turtle Unicorn,
 *   Dragon Unicorn, Friendly Dragoncorn, Mage Unicorn, Scaled Flying Unicorn; Magic
 *   Dragon's Breath, Dragon's Fire, Dragon Kiss, Dragon-Scorched Stables; Instant
 *   Neigh, Foul Beast; Upgrades Dragon's Blessing, Dragon's Fortune, Dragon
 *   Protection; Downgrades Dragon's Curse, Dragon's Misfortune, Dragon Skies.
 * - Unicorns of Legend: Babies Dwarficorn, Elficorn, Gnomicorn, Orcicorn; Basics
 *   Guardsman, Blacksmith, Innkeeper, Noble Unicorn; Magical Beast Master Unicorn,
 *   Berserkercorn, Charming Bardicorn, Divine Unicorn, Dwarficorn Artificer, Elficorn
 *   Scout, Orcicorn Raider, Paladin Unicorn, Rogue Unicorn, Warlock Unicorn, Wizard
 *   Unicorn; Magic Alignment Change, Chain Lightning, Fireball, Necromancy, Prismatic
 *   Bray, Raze the Stables; Instants Neigh, M'Lord / Peasant / Scoundrel; Upgrades
 *   Critical Hit, Extradimensional Saddlebag, Wall of Horns; Downgrades Divine
 *   Peace, Hex, Medieval Sanitation.
 * - Adventures: Babies (Fisherman, Forest, Pirate, Safari); Basics Eager
 *   Adventurer, Glamping, Indoor Rockclimber, Land Lubber Unicorn; Magical Bungee
 *   Jumping, Cutthroat Captain, Extreme Adventurer, Fearless, First Mer-mate,
 *   Fisherman, Hornswoggler, Pillaging Pirate, Salty Seadogicorn, Stowaway,
 *   Vagabond, Survivalist Unicorn; Magic Glowing Horn, Metal Detector, Mysterious
 *   Compass, Silver Tongue, The Great Baby Heist, Unicorn Shovel; Instants Fishing
 *   Rod, Flare Gun, Neigh, Mate!, Unicorn Net; Upgrades Ancient Ritual, Pit Covered
 *   in Leaves, Royal Hooves, Unicorn Survival Kit; Downgrades Broken Sundial,
 *   Extremely Small Backpack, The Black Spot, Unicorn Overboard.
 * - Christmas: Babies (Elf, Gingerbread, Present); Basics Fa La Llamacorn, Mariah
 *   Karaokecorn, Silly Chilly Unicorn, Sugar Crash Unicorn; Magical Festive Flying
 *   Unicorn, Flying Krampuscorn, Friendly Snowmancorn, Helper Elficorn,
 *   Not-So-Secret Santacorn, Nutcrackercorn, Procrastinating Shoppercorn, Unicorn
 *   Caroler, White Elephantcorn, Winter Wondercorn; Magic Gift Receipt, Nog Wild,
 *   Silver Lining; Instant Jingle All The Neigh; Upgrades Gift Inspector,
 *   Gingerbread Stable, Ugly Holiday Sweater; Downgrades Humbug, Naughty List, Oh,
 *   Deer, Uneaten Fruitcake.
 * - Nightmares: Babies (Ghost, Horror, Look Back); Basics (Raincoat, Scared, School
 *   Girl, Security Guard); Magical Chainsaw Massicorn, Clairvoyant Unicorn, Dancing
 *   Clownicorn, Demonicorn, Jack the Reapercorn, Phantom Unicorn, Playful Puppet
 *   Unicorn, Sweet Old Ladycorn, Unicorn Slasher, Vengeful Unicorn, Winged
 *   Horrorcorn; Magic HEEEEERE'S STABBY, Possession, Reanimation, Supernatural
 *   Selection, The Cornjuring; Instant Hex Neigh; Upgrades Ghost Guide, Magic
 *   Elixir, Paranormal Affection, Poltergeist Swipe, Saved by the Sigil; Downgrades
 *   Nightmare: Buried Alive / Currently Indisposed / Existential Dread / Exorcise
 *   Regimen.
 * - NSFW Expansion (2nd Print): 6 Babies (Bye Bye, Cannibal, Dumpster, Shotgun,
 *   Tasty, Upside Down), 4 Basics, 9 Magical (incl. Polyamorous Unicorn, Naked
 *   Narwhal), 6 Magic, 3 Instants (Hell Neigh!, Neigh, Bitch!, Neigh,
 *   Motherfucker!), 3 Upgrades, 2 Downgrades.
 * - "Uncut Unicorns" does not appear in the wiki's list of Unstable Unicorns
 *   products at all.
 */
export const UU_EXPANSIONS: readonly ExpansionMeta[] = [
  {
    id: 'uncut-unicorns',
    name: 'Uncut Unicorns',
    summary: 'Unofficial — not a listed Unstable Unicorns product; these cards are invented.',
    verified: false,
  },
  {
    id: 'nsfw',
    name: 'NSFW',
    summary: 'Approximation — a few real names (Polyamorous Unicorn) among invented cards; not the printed pack.',
    verified: false,
  },
  {
    id: 'rainbow-apocalypse',
    name: 'Rainbow Apocalypse',
    summary: 'Approximation — real names (Unicorns of Death/Famine/Pestilence/War, Plague of Death) with unconfirmed texts, plus invented cards.',
    verified: false,
  },
  {
    id: 'dragons',
    name: 'Dragons',
    summary: "Approximation — real names (Dragon's Blessing/Curse/Breath, Dragon Skies) with unconfirmed texts, plus invented cards.",
    verified: false,
  },
  {
    id: 'unicorns-of-legend',
    name: 'Unicorns of Legend',
    summary: 'Approximation — mostly invented cards; the printed pack (Berserkercorn, Chain Lightning, Critical Hit...) is different.',
    verified: false,
  },
  {
    id: 'adventures',
    name: 'Adventures',
    summary: 'Approximation — real names (Unicorn Net, Flare Gun, Royal Hooves, The Black Spot) with unconfirmed texts, plus invented cards.',
    verified: false,
  },
  {
    id: 'christmas',
    name: 'Christmas',
    summary: 'Approximation — real names (Gift Receipt, Ugly Holiday Sweater, Humbug) with unconfirmed texts, plus invented cards.',
    verified: false,
  },
  {
    id: 'nightmares',
    name: 'Nightmares',
    summary: 'Approximation — mostly invented cards; the printed pack (Demonicorn, Possession, The Cornjuring...) is different.',
    verified: false,
  },
];

export interface UuConfig extends ExpansionConfig {
  expansions: UuExpansionId[];
  edition: UuEdition;
  /**
   * Official 2-player modifications (on unless set to false): remove the cards
   * listed for the base deck and, in the 2nd Edition, hand each player a Neigh
   * before dealing. Ignored at 3+ players.
   */
  twoPlayerRules?: boolean;
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
  /**
   * The phase to resume once awaitingNeigh / awaitingPrompt finishes. `diamond`
   * is the Diamond Edition's Diamond Phase (roll the d4) between Beginning of
   * Turn and Draw.
   */
  resumePhase: 'beginningOfTurn' | 'diamond' | 'draw' | 'action' | 'endOfTurn';

  deck: UuCard[];
  discard: UuCard[];
  nursery: UuCard[];
  /** Diamond Edition: Diamond Unicorns not in any Stable (empty otherwise). */
  vault: UuCard[];
  /** Unicorn Lasso (Original Base): Unicorns to hand back at the end of the thief's turn. */
  lassoReturns?: { cardId: number; fromPlayerId: PlayerId; thiefId: PlayerId }[];

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
