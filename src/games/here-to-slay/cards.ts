// Here to Slay — card library.
//
// Base game: matches the official wiki "Here To Slay Base Deck - Inventory
// List" card for card (6 Party Leaders, 15 Monsters, and a 115-card main deck
// of 48 Heroes, 11 Items, 4 Cursed Items, 13 Magic, 25 Modifiers, 14
// Challenges); hero roll thresholds and monster bands cross-checked against
// two independent card databases.
//
// Warriors & Druids and Berserkers & Necromancers match their official
// inventory lists card for card (sources in each section). ⚠ Here to Sleigh
// does NOT match its published set (see types.ts): it is kept so existing
// configs still load, and flagged `verified: false` in HTS_EXPANSIONS.

import type { RngState } from '@/core/rng';
import { shuffle } from '@/core/rng';
import type { Seat } from '@/core/types';
import type { HtsBaseClass, HtsCard, HtsCardType, HtsExpansionId, HtsFailPenalty, HtsMonster } from './types';

export interface HtsCardDef {
  kind: string;
  name: string;
  type: HtsCardType;
  class: HtsBaseClass | null;
  count: number;
  abilityThreshold: number | null;
  rollLow?: boolean;
  maxItems?: number;
  modifierChoices: number[] | null;
  challengeClass?: HtsBaseClass;
  challengeBonus?: number;
  text: string;
  expansion?: HtsExpansionId;
}

export const HTS_PARTY_LEADERS: readonly HtsCardDef[] = [
  {
    kind: 'leader-charismatic-song',
    name: 'The Charismatic Song',
    type: 'partyLeader',
    class: 'bard',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    text: "Each time you roll to use a Hero card's effect, +1 to your roll.",
  },
  {
    kind: 'leader-cloaked-sage',
    name: 'The Cloaked Sage',
    type: 'partyLeader',
    class: 'wizard',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    text: 'Each time you play a Magic card, DRAW a card.',
  },
  {
    kind: 'leader-divine-arrow',
    name: 'The Divine Arrow',
    type: 'partyLeader',
    class: 'ranger',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    text: 'Each time you roll to ATTACK a Monster card, +1 to your roll.',
  },
  {
    kind: 'leader-fist-of-reason',
    name: 'The Fist of Reason',
    type: 'partyLeader',
    class: 'fighter',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    text: 'Each time you roll to CHALLENGE, +2 to your roll.',
  },
  {
    kind: 'leader-protecting-horn',
    name: 'The Protecting Horn',
    type: 'partyLeader',
    class: 'guardian',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    text: 'Each time you play a Modifier card on a roll, +1 or -1 to that roll.',
  },
  {
    kind: 'leader-shadow-claw',
    name: 'The Shadow Claw',
    type: 'partyLeader',
    class: 'thief',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    text: "Once per turn on your turn, you may spend 1 action point to pull a card from another player's hand.",
  },
];

export interface HtsMonsterDef {
  kind: string;
  name: string;
  requiredHeroes: number;
  requiredClass: HtsBaseClass | null;
  requirementText: string;
  slayThreshold: number;
  slayOnLow?: boolean;
  failThreshold: number;
  failPenalty: HtsFailPenalty;
  text: string;
}

export const HTS_MONSTER_DEFS: readonly HtsMonsterDef[] = [
  {
    kind: 'monster-abyss-queen',
    name: 'Abyss Queen',
    requiredHeroes: 2,
    requiredClass: null,
    requirementText: '2 Heroes',
    slayThreshold: 8,
    failThreshold: 5,
    failPenalty: 'sacrificeHero',
    text: 'Each time another player plays a Modifier card on one of your rolls, +1 to your roll.',
  },
  {
    kind: 'monster-anuran-cauldron',
    name: 'Anuran Cauldron',
    requiredHeroes: 3,
    requiredClass: null,
    requirementText: '3 Heroes',
    slayThreshold: 7,
    failThreshold: 6,
    failPenalty: 'sacrificeHero',
    text: 'Each time you roll, +1 to your roll.',
  },
  {
    kind: 'monster-arctic-aries',
    name: 'Arctic Aries',
    requiredHeroes: 1,
    requiredClass: null,
    requirementText: '1 Hero',
    slayThreshold: 10,
    failThreshold: 6,
    failPenalty: 'sacrificeHero',
    text: "Each time you successfully roll to use a Hero card's effect, you may DRAW a card.",
  },
  {
    kind: 'monster-bloodwing',
    name: 'Bloodwing',
    requiredHeroes: 2,
    requiredClass: null,
    requirementText: '2 Heroes',
    slayThreshold: 9,
    failThreshold: 6,
    failPenalty: 'sacrificeHero',
    text: 'Each time another player CHALLENGES you, that player must DISCARD a card.',
  },
  {
    kind: 'monster-corrupted-sabretooth',
    name: 'Corrupted Sabretooth',
    requiredHeroes: 3,
    requiredClass: null,
    requirementText: '3 Heroes',
    slayThreshold: 9,
    failThreshold: 6,
    failPenalty: 'sacrificeHero',
    text: 'Each time you would DESTROY a Hero card, you may STEAL that Hero card instead.',
  },
  {
    kind: 'monster-crowned-serpent',
    name: 'Crowned Serpent',
    requiredHeroes: 2,
    requiredClass: null,
    requirementText: '2 Heroes',
    slayThreshold: 10,
    failThreshold: 7,
    failPenalty: 'sacrificeHero',
    text: 'Each time any player (including you) plays a Modifier card, you may DRAW a card.',
  },
  {
    kind: 'monster-dark-dragon-king',
    name: 'Dark Dragon King',
    requiredHeroes: 2,
    requiredClass: 'bard',
    requirementText: '1 Bard + 1 Hero',
    slayThreshold: 8,
    failThreshold: 4,
    failPenalty: 'discard2',
    text: "Each time you roll for a Hero card's effect, +1 to your roll.",
  },
  {
    kind: 'monster-dracos',
    name: 'Dracos',
    requiredHeroes: 1,
    requiredClass: null,
    requirementText: '1 Hero',
    slayThreshold: 5,
    slayOnLow: true,
    failThreshold: 8,
    failPenalty: 'sacrificeHero',
    text: 'Each time a Hero card in your Party is destroyed, you may DRAW a card.',
  },
  {
    kind: 'monster-malamammoth',
    name: 'Malamammoth',
    requiredHeroes: 2,
    requiredClass: 'ranger',
    requirementText: '1 Ranger + 1 Hero',
    slayThreshold: 8,
    failThreshold: 4,
    failPenalty: 'discard2',
    text: 'Each time you DRAW an Item card, you may play it immediately.',
  },
  {
    kind: 'monster-mega-slime',
    name: 'Mega Slime',
    requiredHeroes: 4,
    requiredClass: null,
    requirementText: '4 Heroes',
    slayThreshold: 8,
    failThreshold: 7,
    failPenalty: 'sacrificeHero',
    text: 'You may spend an extra action point on each of your turns.',
  },
  {
    kind: 'monster-orthus',
    name: 'Orthus',
    requiredHeroes: 2,
    requiredClass: 'wizard',
    requirementText: '1 Wizard + 1 Hero',
    slayThreshold: 8,
    failThreshold: 4,
    failPenalty: 'discard2',
    text: 'Each time you DRAW a Magic card, you may play it immediately.',
  },
  {
    kind: 'monster-rex-major',
    name: 'Rex Major',
    requiredHeroes: 2,
    requiredClass: 'guardian',
    requirementText: '1 Guardian + 1 Hero',
    slayThreshold: 8,
    failThreshold: 4,
    failPenalty: 'discard2',
    text: 'Each time you DRAW a Modifier card, you may reveal it, then DRAW a second card.',
  },
  {
    kind: 'monster-terratuga',
    name: 'Terratuga',
    requiredHeroes: 1,
    requiredClass: null,
    requirementText: '1 Hero',
    slayThreshold: 11,
    failThreshold: 7,
    failPenalty: 'sacrificeHero',
    text: 'Your Hero cards cannot be destroyed.',
  },
  {
    kind: 'monster-titan-wyvern',
    name: 'Titan Wyvern',
    requiredHeroes: 2,
    requiredClass: 'fighter',
    requirementText: '1 Fighter + 1 Hero',
    slayThreshold: 8,
    failThreshold: 4,
    failPenalty: 'discard2',
    text: 'Each time you roll for a Challenge card, +1 to your roll.',
  },
  {
    kind: 'monster-warworn-owlbear',
    name: 'Warworn Owlbear',
    requiredHeroes: 2,
    requiredClass: 'thief',
    requirementText: '1 Thief + 1 Hero',
    slayThreshold: 8,
    failThreshold: 4,
    failPenalty: 'discard2',
    text: 'Item cards you play cannot be challenged.',
  },
];

export const HTS_MAIN_DECK_DEFS: readonly HtsCardDef[] = [
  // Fighter Heroes (8)
  { kind: 'bad-axe', name: 'Bad Axe', type: 'hero', class: 'fighter', count: 1, abilityThreshold: 8, modifierChoices: null, text: 'DESTROY a Hero card.' },
  { kind: 'bear-claw', name: 'Bear Claw', type: 'hero', class: 'fighter', count: 1, abilityThreshold: 7, modifierChoices: null, text: "Pull a card from another player's hand. If that card is a Hero card, pull a second card from that player's hand." },
  { kind: 'beary-wise', name: 'Beary Wise', type: 'hero', class: 'fighter', count: 1, abilityThreshold: 7, modifierChoices: null, text: 'Each other player must DISCARD a card. Choose one of the discarded cards and add it to your hand.' },
  { kind: 'fury-knuckle', name: 'Fury Knuckle', type: 'hero', class: 'fighter', count: 1, abilityThreshold: 5, modifierChoices: null, text: "Pull a card from another player's hand. If that card is a Challenge card, pull a second card from that player's hand." },
  { kind: 'heavy-bear', name: 'Heavy Bear', type: 'hero', class: 'fighter', count: 1, abilityThreshold: 5, modifierChoices: null, text: 'Choose a player. That player must DISCARD 2 cards.' },
  { kind: 'pan-chucks', name: 'Pan Chucks', type: 'hero', class: 'fighter', count: 1, abilityThreshold: 8, modifierChoices: null, text: 'DRAW 2 cards. If at least one of those cards is a Challenge card, you may reveal it, then DESTROY a Hero card.' },
  { kind: 'qi-bear', name: 'Qi Bear', type: 'hero', class: 'fighter', count: 1, abilityThreshold: 10, modifierChoices: null, text: 'DISCARD up to 3 cards. For each card discarded, DESTROY a Hero card.' },
  { kind: 'tough-teddy', name: 'Tough Teddy', type: 'hero', class: 'fighter', count: 1, abilityThreshold: 4, modifierChoices: null, text: 'Each other player with a Fighter in their Party must DISCARD a card.' },

  // Bard Heroes (8)
  { kind: 'dodgy-dealer', name: 'Dodgy Dealer', type: 'hero', class: 'bard', count: 1, abilityThreshold: 9, modifierChoices: null, text: 'Trade hands with another player.' },
  { kind: 'fuzzy-cheeks', name: 'Fuzzy Cheeks', type: 'hero', class: 'bard', count: 1, abilityThreshold: 8, modifierChoices: null, text: 'DRAW a card and play a Hero card from your hand immediately.' },
  { kind: 'greedy-cheeks', name: 'Greedy Cheeks', type: 'hero', class: 'bard', count: 1, abilityThreshold: 8, modifierChoices: null, text: 'Each other player must give you a card from their hand.' },
  { kind: 'lucky-bucky', name: 'Lucky Bucky', type: 'hero', class: 'bard', count: 1, abilityThreshold: 7, modifierChoices: null, text: "Pull a card from another player's hand. If that card is a Hero card, you may play it immediately." },
  { kind: 'mellow-dee', name: 'Mellow Dee', type: 'hero', class: 'bard', count: 1, abilityThreshold: 7, modifierChoices: null, text: 'DRAW a card. If that card is a Hero card, you may play it immediately.' },
  { kind: 'napping-nibbles', name: 'Napping Nibbles', type: 'hero', class: 'bard', count: 1, abilityThreshold: 2, modifierChoices: null, text: 'Do nothing.' },
  { kind: 'peanut', name: 'Peanut', type: 'hero', class: 'bard', count: 1, abilityThreshold: 7, modifierChoices: null, text: 'DRAW 2 cards.' },
  { kind: 'tipsy-tootie', name: 'Tipsy Tootie', type: 'hero', class: 'bard', count: 1, abilityThreshold: 6, modifierChoices: null, text: "Choose a player. STEAL a Hero card from that player's Party and move Tipsy Tootie to that player's Party." },

  // Guardian Heroes (8)
  { kind: 'calming-voice', name: 'Calming Voice', type: 'hero', class: 'guardian', count: 1, abilityThreshold: 9, modifierChoices: null, text: 'Hero cards in your Party cannot be stolen until your next turn.' },
  { kind: 'guiding-light', name: 'Guiding Light', type: 'hero', class: 'guardian', count: 1, abilityThreshold: 7, modifierChoices: null, text: 'Search the discard pile for a Hero card and add it to your hand.' },
  { kind: 'holy-curselifter', name: 'Holy Curselifter', type: 'hero', class: 'guardian', count: 1, abilityThreshold: 5, modifierChoices: null, text: 'Return a Cursed Item card equipped to a Hero card in your Party to your hand.' },
  { kind: 'iron-resolve', name: 'Iron Resolve', type: 'hero', class: 'guardian', count: 1, abilityThreshold: 8, modifierChoices: null, text: 'Cards you play cannot be challenged for the rest of your turn.' },
  { kind: 'mighty-blade', name: 'Mighty Blade', type: 'hero', class: 'guardian', count: 1, abilityThreshold: 8, modifierChoices: null, text: 'Hero cards in your Party cannot be destroyed until your next turn.' },
  { kind: 'radiant-horn', name: 'Radiant Horn', type: 'hero', class: 'guardian', count: 1, abilityThreshold: 6, modifierChoices: null, text: 'Search the discard pile for a Modifier card and add it to your hand.' },
  { kind: 'vibrant-glow', name: 'Vibrant Glow', type: 'hero', class: 'guardian', count: 1, abilityThreshold: 9, modifierChoices: null, text: '+5 to all of your rolls until the end of your turn.' },
  { kind: 'wise-shield', name: 'Wise Shield', type: 'hero', class: 'guardian', count: 1, abilityThreshold: 6, modifierChoices: null, text: '+3 to all of your rolls until the end of your turn.' },

  // Ranger Heroes (8)
  { kind: 'bullseye', name: 'Bullseye', type: 'hero', class: 'ranger', count: 1, abilityThreshold: 7, modifierChoices: null, text: 'Look at the top 3 cards of the deck. Add one to your hand, then return the other two to the top of the deck in any order.' },
  { kind: 'hook', name: 'Hook', type: 'hero', class: 'ranger', count: 1, abilityThreshold: 6, modifierChoices: null, text: 'Play an Item card from your hand immediately and DRAW a card.' },
  { kind: 'lookie-rookie', name: 'Lookie Rookie', type: 'hero', class: 'ranger', count: 1, abilityThreshold: 5, modifierChoices: null, text: 'Search the discard pile for an Item card and add it to your hand.' },
  { kind: 'quick-draw', name: 'Quick Draw', type: 'hero', class: 'ranger', count: 1, abilityThreshold: 8, modifierChoices: null, text: 'DRAW 2 cards. If at least one of them is an Item card, you may play it immediately.' },
  { kind: 'serious-grey', name: 'Serious Grey', type: 'hero', class: 'ranger', count: 1, abilityThreshold: 9, modifierChoices: null, text: 'DESTROY a Hero card and DRAW a card.' },
  { kind: 'sharp-fox', name: 'Sharp Fox', type: 'hero', class: 'ranger', count: 1, abilityThreshold: 5, modifierChoices: null, text: "Look at another player's hand." },
  { kind: 'wildshot', name: 'Wildshot', type: 'hero', class: 'ranger', count: 1, abilityThreshold: 8, modifierChoices: null, text: 'DRAW 3 cards and DISCARD a card.' },
  { kind: 'wily-red', name: 'Wily Red', type: 'hero', class: 'ranger', count: 1, abilityThreshold: 10, modifierChoices: null, text: 'DRAW until you have 7 cards in your hand.' },

  // Thief Heroes (8)
  { kind: 'kit-napper', name: 'Kit Napper', type: 'hero', class: 'thief', count: 1, abilityThreshold: 9, modifierChoices: null, text: 'STEAL a Hero card.' },
  { kind: 'meowzio', name: 'Meowzio', type: 'hero', class: 'thief', count: 1, abilityThreshold: 10, modifierChoices: null, text: "Choose a player. STEAL a Hero card from that player's Party and pull a card from that player's hand." },
  { kind: 'plundering-puma', name: 'Plundering Puma', type: 'hero', class: 'thief', count: 1, abilityThreshold: 6, modifierChoices: null, text: "Pull 2 cards from another player's hand. That player may DRAW a card." },
  { kind: 'shurikitty', name: 'Shurikitty', type: 'hero', class: 'thief', count: 1, abilityThreshold: 9, modifierChoices: null, text: 'DESTROY a Hero card. If that Hero card had an Item card equipped to it, add that Item card to your hand instead of moving it to the discard pile.' },
  { kind: 'silent-shadow', name: 'Silent Shadow', type: 'hero', class: 'thief', count: 1, abilityThreshold: 8, modifierChoices: null, text: "Look at another player's hand. Choose a card and add it to your hand." },
  { kind: 'slippery-paws', name: 'Slippery Paws', type: 'hero', class: 'thief', count: 1, abilityThreshold: 6, modifierChoices: null, text: "Pull 2 cards from another player's hand, then DISCARD one of those cards." },
  { kind: 'sly-pickings', name: 'Sly Pickings', type: 'hero', class: 'thief', count: 1, abilityThreshold: 6, modifierChoices: null, text: "Pull a card from another player's hand. If that card is an Item card, you may play it immediately." },
  { kind: 'smooth-mimimeow', name: 'Smooth Mimimeow', type: 'hero', class: 'thief', count: 1, abilityThreshold: 7, modifierChoices: null, text: 'Pull a card from the hand of each other player with a Thief in their Party.' },

  // Wizard Heroes (8)
  { kind: 'bun-bun', name: 'Bun Bun', type: 'hero', class: 'wizard', count: 1, abilityThreshold: 5, modifierChoices: null, text: 'Search the discard pile for a Magic card and add it to your hand.' },
  { kind: 'buttons', name: 'Buttons', type: 'hero', class: 'wizard', count: 1, abilityThreshold: 6, modifierChoices: null, text: "Pull a card from another player's hand. If it is a Magic card, you may play it immediately." },
  { kind: 'fluffy', name: 'Fluffy', type: 'hero', class: 'wizard', count: 1, abilityThreshold: 10, modifierChoices: null, text: 'DESTROY 2 Hero cards.' },
  { kind: 'hopper', name: 'Hopper', type: 'hero', class: 'wizard', count: 1, abilityThreshold: 7, modifierChoices: null, text: 'Choose a player. That player must SACRIFICE a Hero card.' },
  { kind: 'snowball', name: 'Snowball', type: 'hero', class: 'wizard', count: 1, abilityThreshold: 6, modifierChoices: null, text: 'DRAW a card. If that card is a Magic card, you may play it immediately and DRAW a second card.' },
  { kind: 'spooky', name: 'Spooky', type: 'hero', class: 'wizard', count: 1, abilityThreshold: 10, modifierChoices: null, text: 'Each other player must SACRIFICE a Hero card.' },
  { kind: 'whiskers', name: 'Whiskers', type: 'hero', class: 'wizard', count: 1, abilityThreshold: 11, modifierChoices: null, text: 'STEAL a Hero card and DESTROY a Hero card.' },
  { kind: 'wiggles', name: 'Wiggles', type: 'hero', class: 'wizard', count: 1, abilityThreshold: 10, modifierChoices: null, text: 'STEAL a Hero card and roll to use its effect immediately.' },

  // Items (11)
  { kind: 'bard-mask', name: 'Bard Mask', type: 'item', class: 'bard', count: 1, abilityThreshold: null, modifierChoices: null, text: 'The equipped Hero card is considered a Bard instead of its original class.' },
  { kind: 'fighter-mask', name: 'Fighter Mask', type: 'item', class: 'fighter', count: 1, abilityThreshold: null, modifierChoices: null, text: 'The equipped Hero card is considered a Fighter instead of its original class.' },
  { kind: 'guardian-mask', name: 'Guardian Mask', type: 'item', class: 'guardian', count: 1, abilityThreshold: null, modifierChoices: null, text: 'The equipped Hero card is considered a Guardian instead of its original class.' },
  { kind: 'ranger-mask', name: 'Ranger Mask', type: 'item', class: 'ranger', count: 1, abilityThreshold: null, modifierChoices: null, text: 'The equipped Hero card is considered a Ranger instead of its original class.' },
  { kind: 'thief-mask', name: 'Thief Mask', type: 'item', class: 'thief', count: 1, abilityThreshold: null, modifierChoices: null, text: 'The equipped Hero card is considered a Thief instead of its original class.' },
  { kind: 'wizard-mask', name: 'Wizard Mask', type: 'item', class: 'wizard', count: 1, abilityThreshold: null, modifierChoices: null, text: 'The equipped Hero card is considered a Wizard instead of its original class.' },
  { kind: 'decoy-doll', name: 'Decoy Doll', type: 'item', class: null, count: 1, abilityThreshold: null, modifierChoices: null, text: 'If the equipped Hero card would be sacrificed or destroyed, move Decoy Doll to the discard pile instead.' },
  { kind: 'particularly-rusty-coin', name: 'Particularly Rusty Coin', type: 'item', class: null, count: 2, abilityThreshold: null, modifierChoices: null, text: "If you unsuccessfully roll to use the equipped Hero card's effect, DRAW a card." },
  { kind: 'really-big-ring', name: 'Really Big Ring', type: 'item', class: null, count: 2, abilityThreshold: null, modifierChoices: null, text: "Each time you roll to use the equipped Hero card's effect, +2 to your roll." },

  // Cursed Items (4)
  { kind: 'curse-of-the-snakes-eyes', name: "Curse of the Snake's Eyes", type: 'cursedItem', class: null, count: 2, abilityThreshold: null, modifierChoices: null, text: "Each time you roll to use the equipped Hero card's effect, -2 to your roll." },
  { kind: 'sealing-key', name: 'Sealing Key', type: 'cursedItem', class: null, count: 1, abilityThreshold: null, modifierChoices: null, text: "You cannot use the equipped Hero card's effect." },
  { kind: 'suspiciously-shiny-coin', name: 'Suspiciously Shiny Coin', type: 'cursedItem', class: null, count: 1, abilityThreshold: null, modifierChoices: null, text: "If you successfully roll to use the equipped Hero card's effect, DISCARD a card." },

  // Magic (13)
  { kind: 'call-to-the-fallen', name: 'Call to the Fallen', type: 'magic', class: null, count: 1, abilityThreshold: null, modifierChoices: null, text: 'Search the discard pile for a Hero card and add it to your hand.' },
  { kind: 'critical-boost', name: 'Critical Boost', type: 'magic', class: null, count: 2, abilityThreshold: null, modifierChoices: null, text: 'DRAW 3 cards and DISCARD a card.' },
  { kind: 'destructive-spell', name: 'Destructive Spell', type: 'magic', class: null, count: 2, abilityThreshold: null, modifierChoices: null, text: 'DISCARD a card, then DESTROY a Hero card.' },
  { kind: 'enchanted-spell', name: 'Enchanted Spell', type: 'magic', class: null, count: 2, abilityThreshold: null, modifierChoices: null, text: '+2 to all of your rolls until the end of your turn.' },
  { kind: 'entangling-trap', name: 'Entangling Trap', type: 'magic', class: null, count: 2, abilityThreshold: null, modifierChoices: null, text: 'DISCARD 2 cards, then STEAL a Hero card.' },
  { kind: 'forced-exchange', name: 'Forced Exchange', type: 'magic', class: null, count: 1, abilityThreshold: null, modifierChoices: null, text: "Choose a player. STEAL a Hero card from that player's Party, then move a Hero card from your Party to that player's Party." },
  { kind: 'forceful-winds', name: 'Forceful Winds', type: 'magic', class: null, count: 1, abilityThreshold: null, modifierChoices: null, text: "Return every equipped Item card to its respective player's hand." },
  { kind: 'winds-of-change', name: 'Winds of Change', type: 'magic', class: null, count: 2, abilityThreshold: null, modifierChoices: null, text: "Return an Item card equipped to any player's Hero card to that player's hand, then DRAW a card." },

  // Modifiers (25)
  { kind: 'mod-plus-1-minus-3', name: 'Modifier +1/-3', type: 'modifier', class: null, count: 4, abilityThreshold: null, modifierChoices: [1, -3], text: 'Play this card after any player (including you) rolls the dice. +1 or -3 to that roll.' },
  { kind: 'mod-plus-2-minus-2', name: 'Modifier +2/-2', type: 'modifier', class: null, count: 9, abilityThreshold: null, modifierChoices: [2, -2], text: 'Play this card after any player (including you) rolls the dice. +2 or -2 to that roll.' },
  { kind: 'mod-plus-3-minus-1', name: 'Modifier +3/-1', type: 'modifier', class: null, count: 4, abilityThreshold: null, modifierChoices: [3, -1], text: 'Play this card after any player (including you) rolls the dice. +3 or -1 to that roll.' },
  { kind: 'mod-plus-4', name: 'Modifier +4', type: 'modifier', class: null, count: 4, abilityThreshold: null, modifierChoices: [4], text: 'Play this card after any player (including you) rolls the dice. +4 to that roll.' },
  { kind: 'mod-minus-4', name: 'Modifier -4', type: 'modifier', class: null, count: 4, abilityThreshold: null, modifierChoices: [-4], text: 'Play this card after any player (including you) rolls the dice. -4 to that roll.' },

  // Challenges (14)
  { kind: 'challenge', name: 'Challenge', type: 'challenge', class: null, count: 14, abilityThreshold: null, modifierChoices: null, text: 'You may play this card when another player attempts to play a Hero, Item, or Magic card. CHALLENGE that card.' },
];

// ============================================================================
// Expansion 1: Warriors & Druids (`warriors-druids`)
// ============================================================================
//
// Contents: the official wiki "Here To Slay Dragon Warrior and Druid Expansion
// - Inventory List" (2 Party Leaders, 2 Monsters, 31 main-deck cards: 16
// Heroes, 5 Items, 2 Cursed Items, 2 Magic, 4 Modifiers, 2 Challenges; one copy
// each). Card text: the official per-card wiki pages where archived, else the
// Here to Slay fandom wiki and ShadowzLmao2/HereToSlay-Online (src/cards.py),
// which agree wherever they overlap. Roll requirements are printed only on the
// card art: from ShadowzLmao2 (Druids as "or lower"), cross-checked against the
// fandom wiki for Critical Fang, Doe Fallow, Tenacious Timber, Wolfgang Pack.
// Two-Item Warriors (`maxItems: 2`): the official pages' "Specific Card Rules"
// ("Two Item cards allowed to be attached to this Hero") and the fandom wiki.

const WD = 'warriors-druids' as const;
const wdHero = (kind: string, name: string, cls: 'warrior' | 'druid', roll: number, text: string, maxItems?: number): HtsCardDef => ({
  kind, name, type: 'hero', class: cls, count: 1, abilityThreshold: roll, rollLow: cls === 'druid' ? true : undefined, maxItems, modifierChoices: null, expansion: WD, text,
});

export const HTS_WARRIORS_DRUIDS_LEADERS: readonly HtsCardDef[] = [
  {
    kind: 'leader-piercing-howl',
    name: 'The Piercing Howl',
    type: 'partyLeader',
    class: 'warrior',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    expansion: WD,
    text: 'Each time you roll, +1 to your roll for each Item card equipped to a Hero card in your Party.',
  },
  {
    kind: 'leader-noble-shaman',
    name: 'The Noble Shaman',
    type: 'partyLeader',
    class: 'druid',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    expansion: WD,
    text: "Once per turn on each player's turn, you may choose any player's roll. -1 to that roll.",
  },
];

export const HTS_WARRIORS_DRUIDS_MONSTERS: readonly HtsMonsterDef[] = [
  {
    kind: 'monster-feral-dragon',
    name: 'Feral Dragon',
    requiredHeroes: 2,
    requiredClass: null,
    requirementText: '2 Heroes',
    slayThreshold: 9,
    failThreshold: 6,
    failPenalty: 'sacrificeHero',
    text: 'Each time any player sacrifices a card, DRAW a card.',
  },
  {
    kind: 'monster-muscipula-rex',
    name: 'Muscipula Rex',
    requiredHeroes: 3,
    requiredClass: null,
    requirementText: '3 Heroes',
    slayThreshold: 10,
    failThreshold: 7,
    failPenalty: 'sacrificeHero',
    text: 'Once per turn on your turn, you may DRAW a card without spending an action point.',
  },
];

export const HTS_WARRIORS_DRUIDS_DECK_DEFS: readonly HtsCardDef[] = [
  // Druid Heroes (8) — roll this number OR LOWER.
  wdHero('big-buckley', 'Big Buckley', 'druid', 8, 'ATTACK a Monster card immediately. (You must still meet its Party requirement.)'),
  wdHero('buck-omens', 'Buck Omens', 'druid', 6, "Look at another player's hand. Choose a Hero card from their hand (if they have one) and bring it into your Party."),
  wdHero('doe-fallow', 'Doe Fallow', 'druid', 7, 'SACRIFICE a Hero card, then DRAW cards until you have 7 cards in your hand.'),
  wdHero('glowing-antler', 'Glowing Antler', 'druid', 7, 'You may play up to 2 Magic cards immediately.'),
  wdHero('maegisty', 'Maegisty', 'druid', 7, 'Until your next turn, if a Hero card in your Party would be sacrificed or destroyed, return it to your hand instead.'),
  wdHero('magus-moose', 'Magus Moose', 'druid', 5, 'Search the discard pile for a Hero card and add it to your hand, then play it immediately.'),
  wdHero('majestelk', 'Majestelk', 'druid', 7, 'SACRIFICE a Hero card. +5 or -5 to each of your rolls until your next turn.'),
  wdHero('stagguard', 'Stagguard', 'druid', 8, 'No other player can play Modifier cards until the end of your turn.'),

  // Warrior Heroes (8)
  wdHero('agile-dagger', 'Agile Dagger', 'warrior', 7, 'You may play up to 2 Item cards immediately.', 2),
  wdHero('blinding-blade', 'Blinding Blade', 'warrior', 8, "Choose any player. Return all equipped Item cards in that player's Party to your hand."),
  wdHero('critical-fang', 'Critical Fang', 'warrior', 6, '+4 to your rolls to ATTACK a Monster card until the end of your turn.', 2),
  wdHero('hardened-hunter', 'Hardened Hunter', 'warrior', 9, "DRAW a card for each Monster card in each other player's Party."),
  wdHero('looting-lupo', 'Looting Lupo', 'warrior', 5, 'DRAW a card for each Item card equipped to a Hero card in your Party.'),
  wdHero('silent-shield', 'Silent Shield', 'warrior', 6, 'For the rest of your turn, if you SACRIFICE or DESTROY a Hero card, you may search the discard pile for a Hero card and add it to your hand.'),
  wdHero('tenacious-timber', 'Tenacious Timber', 'warrior', 8, 'For each Monster card in your Party, STEAL a Hero card.'),
  wdHero('wolfgang-pack', 'Wolfgang Pack', 'warrior', 5, 'For each other Hero card in your Party, +1 to all of your rolls until the end of your turn.'),

  // Items (5)
  { kind: 'bottomless-bag', name: 'Bottomless Bag', type: 'item', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: WD, text: "You may roll to use the equipped Hero card's effect more than once per turn, at a cost of one action point for each roll to use." },
  { kind: 'druid-mask', name: 'Druid Mask', type: 'item', class: 'druid', count: 1, abilityThreshold: null, modifierChoices: null, expansion: WD, text: 'The equipped Hero card is considered a Druid instead of its original class.' },
  { kind: 'even-bigger-ring', name: 'Even Bigger Ring', type: 'item', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: WD, text: "Each time you roll to use the equipped Hero card's effect, +4 to your roll." },
  { kind: 'temporal-hourglass', name: 'Temporal Hourglass', type: 'item', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: WD, text: "If you unsuccessfully roll to use the equipped Hero card's effect, you may spend an extra action point this turn." },
  { kind: 'warrior-mask', name: 'Warrior Mask', type: 'item', class: 'warrior', count: 1, abilityThreshold: null, modifierChoices: null, expansion: WD, text: 'The equipped Hero card is considered a Warrior instead of its original class.' },

  // Cursed Items (2)
  { kind: 'cursed-glove', name: 'Cursed Glove', type: 'cursedItem', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: WD, text: 'If another Hero card in your Party is stolen, move the equipped Hero card to the Party of the player who stole it as well.' },
  { kind: 'soul-tether', name: 'Soul Tether', type: 'cursedItem', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: WD, text: 'If any Hero card in your Party is sacrificed or destroyed, SACRIFICE the equipped Hero card.' },

  // Magic (2)
  { kind: 'beast-call', name: 'Beast Call', type: 'magic', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: WD, text: 'Move all face-up Monster cards to the bottom of the Monster deck and flip the top 3 cards from the Monster deck face up. You may spend an extra action point this turn.' },
  { kind: 'rapid-refresh', name: 'Rapid Refresh', type: 'magic', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: WD, text: 'DISCARD every card in your hand (if you have any) and DRAW 4 cards.' },

  // Modifiers (4) — each with an extra effect
  { kind: 'mod-wd-plus-1-minus-1', name: 'Modifier +1/-1', type: 'modifier', class: null, count: 1, abilityThreshold: null, modifierChoices: [1, -1], expansion: WD, text: 'Play this card after any player (including you) rolls the dice. +1 or -1 to that roll. DRAW 2 cards.' },
  { kind: 'mod-wd-plus-2-minus-1', name: 'Modifier +2/-1', type: 'modifier', class: null, count: 1, abilityThreshold: null, modifierChoices: [2, -1], expansion: WD, text: 'Play this card after any player (including you) rolls the dice. +2 or -1 to that roll. DRAW a card.' },
  { kind: 'mod-wd-plus-4', name: 'Modifier +4', type: 'modifier', class: null, count: 1, abilityThreshold: null, modifierChoices: [4], expansion: WD, text: 'Play this card after any player (including you) rolls the dice. +4 to that roll. If the roll is modified above 12, DRAW a card.' },
  { kind: 'mod-wd-minus-4', name: 'Modifier -4', type: 'modifier', class: null, count: 1, abilityThreshold: null, modifierChoices: [-4], expansion: WD, text: 'Play this card after any player (including you) rolls the dice. -4 to that roll. If the roll is modified below 2, choose a card from the discard pile and add it to your hand.' },

  // Challenges (2) — official "Requirement to Play Card": that class in your Party
  { kind: 'challenge-druid', name: 'Druid Challenge', type: 'challenge', class: null, count: 1, abilityThreshold: null, modifierChoices: null, challengeClass: 'druid', challengeBonus: 3, expansion: WD, text: 'You may play this card when another player attempts to play a Hero, Item, or Magic card. CHALLENGE that card. +3 to your roll.' },
  { kind: 'challenge-warrior', name: 'Warrior Challenge', type: 'challenge', class: null, count: 1, abilityThreshold: null, modifierChoices: null, challengeClass: 'warrior', challengeBonus: 3, expansion: WD, text: 'You may play this card when another player attempts to play a Hero, Item, or Magic card. CHALLENGE that card. +3 to your roll.' },
];

// ============================================================================
// Expansion 2: Berserkers & Necromancers (`berserkers-necromancers`)
// ============================================================================
//
// Contents: the official wiki "Here To Slay Dragon Berserkers and
// Necromancers Expansion - Inventory List" (2 Party Leaders, 2 Monsters, 31
// main-deck cards: 16 Heroes, 5 Items, 2 Cursed Items, 4 Magic — 2 Lightning
// Labrys, 2 Mass Sacrifice — 2 Modifiers, 2 Challenges). Card text, roll icons,
// Monster bands and "Two Item cards allowed" notes: the official per-card wiki
// pages for 25 of its 33 different cards; the rest (Brawling Spirit, Gruesome
// Gladiator, Rabid Beast, Unbridled Fury, Goblet of Caffeination, Soulbound
// Grimoire, and the two Party Leaders) from miurary/here_to_slay
// (wiggles/src/cards) and ShadowzLmao2/HereToSlay-Online (src/cards.py), which
// agree on every card, and the Here to Slay fandom wiki where it has a page.

const BN = 'berserkers-necromancers' as const;
const bnHero = (kind: string, name: string, cls: 'berserker' | 'necromancer', roll: number, text: string, maxItems?: number): HtsCardDef => ({
  kind, name, type: 'hero', class: cls, count: 1, abilityThreshold: roll, maxItems, modifierChoices: null, expansion: BN, text,
});

export const HTS_BERSERKERS_NECROMANCERS_LEADERS: readonly HtsCardDef[] = [
  {
    kind: 'leader-raging-manticore',
    name: 'The Raging Manticore',
    type: 'partyLeader',
    class: 'berserker',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    expansion: BN,
    text: 'Each time you SLAY a Monster card, DRAW 2 cards.',
  },
  {
    kind: 'leader-gnawing-dread',
    name: 'The Gnawing Dread',
    type: 'partyLeader',
    class: 'necromancer',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    expansion: BN,
    text: 'Once per turn on your turn, you may spend 2 action points to search the discard pile for a card and add it to your hand.',
  },
];

export const HTS_BERSERKERS_NECROMANCERS_MONSTERS: readonly HtsMonsterDef[] = [
  {
    kind: 'monster-doombringer',
    name: 'Doombringer',
    requiredHeroes: 2,
    requiredClass: 'necromancer',
    requirementText: '1 Necromancer + 1 Hero',
    slayThreshold: 8,
    failThreshold: 4,
    failPenalty: 'discardHand',
    text: 'Each time you SACRIFICE a card, you may choose a card from the discard pile and add it to your hand.',
  },
  {
    kind: 'monster-reptilian-ripper',
    name: 'Reptilian Ripper',
    requiredHeroes: 2,
    requiredClass: 'berserker',
    requirementText: '1 Berserker + 1 Hero',
    slayThreshold: 7,
    failThreshold: 6,
    failPenalty: 'sacrificeTwoHeroes',
    text: 'Each time you roll to ATTACK a Monster card, +2 to your roll.',
  },
];

export const HTS_BERSERKERS_NECROMANCERS_DECK_DEFS: readonly HtsCardDef[] = [
  // Necromancer Heroes (8) — many pay a cost first: "you must pay the cost
  // stated at the beginning of the card's effect in order to use the rest".
  bnHero('bark-hexer', 'Bark Hexer', 'necromancer', 7, 'DISCARD a card. Each other player must DISCARD 2 cards.'),
  bnHero('beholden-retriever', 'Beholden Retriever', 'necromancer', 5, 'SACRIFICE a Hero card. Search the discard pile for a Hero or Item card and add it to your hand, then play it immediately.'),
  bnHero('bone-collector', 'Bone Collector', 'necromancer', 7, 'SACRIFICE an Item card. Search the discard pile for a Hero card and add it to your hand, then play it immediately.'),
  bnHero('boston-terror', 'Boston Terror', 'necromancer', 7, 'Choose a player. That player may give you a card from their hand. If they do not, you may choose 2 cards from the discard pile and add them to your hand.'),
  bnHero('grim-pupper', 'Grim Pupper', 'necromancer', 8, 'Each player (including you) must SACRIFICE a card.'),
  bnHero('hollow-husk', 'Hollow Husk', 'necromancer', 6, "Look at another player's hand. Choose a Magic card (if they have one) and add it to your hand. You may play it immediately."),
  bnHero('perfect-vessel', 'Perfect Vessel', 'necromancer', 4, 'SACRIFICE this card, then STEAL a Hero card.'),
  bnHero('shadow-saint', 'Shadow Saint', 'necromancer', 5, 'DISCARD a Modifier card. No other player can play Modifier cards until the end of your turn.'),

  // Berserker Heroes (8)
  bnHero('annihilator', 'Annihilator', 'berserker', 6, 'Search the discard pile for a Challenge card and add it to your hand.'),
  bnHero('brawling-spirit', 'Brawling Spirit', 'berserker', 9, 'Each player (including you) with more than 3 cards in their Party must SACRIFICE a card.'),
  bnHero('gruesome-gladiator', 'Gruesome Gladiator', 'berserker', 10, "Look at each other player's hand. Choose a card from each player's hand and add it to your hand."),
  bnHero('meowntain', 'Meowntain', 'berserker', 6, 'SACRIFICE a card. +5 to all of your rolls until the end of your turn.', 2),
  bnHero('rabid-beast', 'Rabid Beast', 'berserker', 6, 'SACRIFICE any number of cards, then DESTROY the same number of cards.'),
  bnHero('roaryal-guard', 'Roaryal Guard', 'berserker', 9, "Choose a Class. Return every Hero card of that Class to its respective player's hand."),
  bnHero('unbridled-fury', 'Unbridled Fury', 'berserker', 8, 'DESTROY a Hero card. If that Hero card is a Berserker, you may spend an extra action point this turn.'),
  bnHero('vicious-wildcat', 'Vicious Wildcat', 'berserker', 12, 'SLAY any Monster card, then end your turn.', 2),

  // Items (5)
  { kind: 'berserker-mask', name: 'Berserker Mask', type: 'item', class: 'berserker', count: 1, abilityThreshold: null, modifierChoices: null, expansion: BN, text: 'The equipped Hero card is considered a Berserker instead of its original class.' },
  { kind: 'biggest-ring-ever', name: 'Biggest Ring Ever', type: 'item', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: BN, text: "Each time you roll to use the equipped Hero card's effect, you may DISCARD up to 3 cards. For each card discarded, +2 to your roll." },
  { kind: 'goblet-of-caffeination', name: 'Goblet of Caffeination', type: 'item', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: BN, text: "If you unsuccessfully roll to use the equipped Hero card's effect, you may SACRIFICE this card, then roll to use that effect again immediately." },
  { kind: 'necromancer-mask', name: 'Necromancer Mask', type: 'item', class: 'necromancer', count: 1, abilityThreshold: null, modifierChoices: null, expansion: BN, text: 'The equipped Hero card is considered a Necromancer instead of its original class.' },
  { kind: 'silver-lining', name: 'Silver Lining', type: 'item', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: BN, text: "If you unsuccessfully roll to use the equipped Hero card's effect, +2 to all of your rolls for the rest of your turn." },

  // Cursed Items (2)
  { kind: 'dragons-bile', name: "Dragon's Bile", type: 'cursedItem', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: BN, text: "If you unsuccessfully roll to use the equipped Hero card's effect, SACRIFICE a Hero card." },
  { kind: 'soulbound-grimoire', name: 'Soulbound Grimoire', type: 'cursedItem', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: BN, text: "Rolling to use the equipped Hero card's effect costs 2 action points." },

  // Magic (4)
  { kind: 'lightning-labrys', name: 'Lightning Labrys', type: 'magic', class: null, count: 2, abilityThreshold: null, modifierChoices: null, expansion: BN, text: 'DISCARD up to 3 cards. For each card discarded, choose a player. That player must SACRIFICE a Hero card.' },
  { kind: 'mass-sacrifice', name: 'Mass Sacrifice', type: 'magic', class: null, count: 2, abilityThreshold: null, modifierChoices: null, expansion: BN, text: 'DISCARD your hand, then DRAW 5 cards.' },

  // Modifiers (2)
  { kind: 'mod-bn-plus-2-minus-2', name: 'Modifier +2/-2', type: 'modifier', class: null, count: 1, abilityThreshold: null, modifierChoices: [2, -2], expansion: BN, text: 'Play this card after any player (including you) rolls the dice. +2 or -2 to that roll. If you are attacking a Monster card, +4 to that roll instead.' },
  { kind: 'mod-bn-plus-7', name: 'Modifier +7', type: 'modifier', class: null, count: 1, abilityThreshold: null, modifierChoices: [7], expansion: BN, text: 'Play this card after any player (including you) rolls the dice. DISCARD your hand. +7 to that roll.' },

  // Challenges (2) — official "Requirement to Play Card": that class in your Party
  { kind: 'challenge-berserker', name: 'Berserker Challenge', type: 'challenge', class: null, count: 1, abilityThreshold: null, modifierChoices: null, challengeClass: 'berserker', challengeBonus: 3, expansion: BN, text: 'You may play this card when another player attempts to play a Hero, Item, or Magic card. CHALLENGE that card. +3 to your roll.' },
  { kind: 'challenge-necromancer', name: 'Necromancer Challenge', type: 'challenge', class: null, count: 1, abilityThreshold: null, modifierChoices: null, challengeClass: 'necromancer', challengeBonus: 3, expansion: BN, text: 'You may play this card when another player attempts to play a Hero, Item, or Magic card. CHALLENGE that card. +3 to your roll.' },
];

// ============================================================================
// Expansion 3: Here to Sleigh (`here-to-sleigh`)
// ============================================================================

export const HTS_SLEIGH_LEADERS: readonly HtsCardDef[] = [
  {
    kind: 'leader-festive-noel',
    name: 'The Festive Noel',
    type: 'partyLeader',
    class: 'bard',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    expansion: 'here-to-sleigh',
    text: "Each time you roll 10+ for a Hero card's effect, claim a Nice Gift from the Holiday pile!",
  },
  {
    kind: 'leader-holly-spirit',
    name: 'The Holly Spirit',
    type: 'partyLeader',
    class: 'guardian',
    count: 1,
    abilityThreshold: null,
    modifierChoices: null,
    expansion: 'here-to-sleigh',
    text: 'Each time you roll to use a Hero ability or attack a Monster, +1 to your roll.',
  },
];

export const HTS_SLEIGH_MONSTERS: readonly HtsMonsterDef[] = [
  {
    kind: 'monster-frostbite-krampus',
    name: 'Frostbite Krampus',
    requiredHeroes: 2,
    requiredClass: null,
    requirementText: '2 Heroes',
    slayThreshold: 8,
    failThreshold: 5,
    failPenalty: 'discard2',
    text: 'When slain, also claim a Nice Gift! Each time you roll for a Hero ability, +1 to your roll.',
  },
  {
    kind: 'monster-abominable-snowbeast',
    name: 'Abominable Snowbeast',
    requiredHeroes: 2,
    requiredClass: null,
    requirementText: '2 Heroes',
    slayThreshold: 9,
    failThreshold: 6,
    failPenalty: 'sacrificeHero',
    text: 'Each time you roll to ATTACK a Monster card, +2 to your roll.',
  },
];

export const HTS_SLEIGH_DECK_DEFS: readonly HtsCardDef[] = [
  // Holiday Heroes (6)
  { kind: 'santa-claws', name: 'Santa Claws', type: 'hero', class: 'fighter', count: 1, abilityThreshold: 7, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Claim a Nice Gift and DESTROY a Hero card.' },
  { kind: 'lil-drummer-bard', name: "Lil' Drummer Bard", type: 'hero', class: 'bard', count: 1, abilityThreshold: 6, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Claim a Nice Gift and DRAW 2 cards.' },
  { kind: 'holly-jolly', name: 'Holly Jolly', type: 'hero', class: 'guardian', count: 1, abilityThreshold: 6, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Claim a Nice Gift and Hero cards in your Party cannot be destroyed until your next turn.' },
  { kind: 'prancer', name: 'Prancer', type: 'hero', class: 'ranger', count: 1, abilityThreshold: 7, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Claim a Nice Gift and +2 to all of your rolls until the end of your turn.' },
  { kind: 'gift-bag-bandit', name: 'Gift Bag Bandit', type: 'hero', class: 'thief', count: 1, abilityThreshold: 7, modifierChoices: null, expansion: 'here-to-sleigh', text: "Steal a Nice Gift from another player (or claim one from the Gift pile) and pull a card from another player's hand." },
  { kind: 'snow-slinger', name: 'Snow Slinger', type: 'hero', class: 'wizard', count: 1, abilityThreshold: 7, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Claim a Nice Gift and search the discard pile for any card and add it to your hand.' },

  // Holiday Items (2), Magic (2), Challenges (2)
  { kind: 'milk-and-cookies', name: 'Milk and Cookies', type: 'item', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: 'here-to-sleigh', text: "If you successfully roll to use the equipped Hero card's effect, claim a Nice Gift!" },
  { kind: 'freshly-sharpened-skates', name: 'Freshly Sharpened Skates', type: 'item', class: null, count: 1, abilityThreshold: null, modifierChoices: null, expansion: 'here-to-sleigh', text: "Each time you roll to use the equipped Hero card's effect, +2 to your roll." },
  { kind: 'holiday-cheer', name: 'Holiday Cheer', type: 'magic', class: null, count: 2, abilityThreshold: null, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Claim a Nice Gift and DRAW 2 cards.' },
  { kind: 'challenge', name: 'Good Gift Challenge', type: 'challenge', class: null, count: 2, abilityThreshold: null, modifierChoices: null, expansion: 'here-to-sleigh', text: 'CHALLENGE a Hero, Item, or Magic card.' },
];

export const HTS_SLEIGH_GIFTS: readonly HtsCardDef[] = [
  { kind: 'gift-warm-socks', name: 'Warm Socks', type: 'gift', class: null, count: 2, abilityThreshold: null, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Nice List Gift — Collect 3 Nice Gifts to win the game!' },
  { kind: 'gift-bag-of-holding', name: 'Bag of Holding Gifts', type: 'gift', class: null, count: 2, abilityThreshold: null, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Nice List Gift — When claimed, DRAW a card.' },
  { kind: 'gift-rudolphs-nose', name: "Rudolph's Nose", type: 'gift', class: null, count: 2, abilityThreshold: null, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Nice List Gift — +1 to rolls this turn when claimed.' },
  { kind: 'gift-mint-mittens', name: 'Mint Condition Mittens', type: 'gift', class: null, count: 2, abilityThreshold: null, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Nice List Gift — Collect 3 Nice Gifts to win the game!' },
  { kind: 'gift-snows-of-time', name: 'Snows of Time', type: 'gift', class: null, count: 2, abilityThreshold: null, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Nice List Gift — Collect 3 Nice Gifts to win the game!' },
  { kind: 'gift-mythical-mystery', name: 'Mythical Mystery', type: 'gift', class: null, count: 2, abilityThreshold: null, modifierChoices: null, expansion: 'here-to-sleigh', text: 'Nice List Gift — Collect 3 Nice Gifts to win the game!' },
];

export const HTS_ALL_PARTY_LEADERS: readonly HtsCardDef[] = [
  ...HTS_PARTY_LEADERS,
  ...HTS_WARRIORS_DRUIDS_LEADERS,
  ...HTS_BERSERKERS_NECROMANCERS_LEADERS,
  ...HTS_SLEIGH_LEADERS,
];

function getPartyLeadersForExpansions(expansions: readonly HtsExpansionId[] = []): readonly HtsCardDef[] {
  const result: HtsCardDef[] = [...HTS_PARTY_LEADERS];
  if (expansions.includes('warriors-druids')) result.push(...HTS_WARRIORS_DRUIDS_LEADERS);
  if (expansions.includes('berserkers-necromancers')) result.push(...HTS_BERSERKERS_NECROMANCERS_LEADERS);
  if (expansions.includes('here-to-sleigh')) result.push(...HTS_SLEIGH_LEADERS);
  return result;
}

/** One physical card from its definition (optional fields only when set, so states stay lean). */
export function defToCard(def: HtsCardDef, id: number): HtsCard {
  const card: HtsCard = {
    id,
    kind: def.kind,
    name: def.name,
    type: def.type,
    class: def.class,
    text: def.text,
    abilityThreshold: def.abilityThreshold,
    modifierChoices: def.modifierChoices,
  };
  if (def.rollLow) card.rollLow = true;
  if (def.maxItems) card.maxItems = def.maxItems;
  if (def.challengeClass) card.challengeClass = def.challengeClass;
  if (def.challengeBonus) card.challengeBonus = def.challengeBonus;
  if (def.expansion) card.expansion = def.expansion;
  return card;
}

/** The Shadow Claw "may not be used as your Party Leader card in 2-player games" (rulebook). */
function leaderAllowed(kind: string, playerCount: number): boolean {
  return !(kind === 'leader-shadow-claw' && playerCount <= 2);
}

/**
 * Build every pile for a new game. Party Leaders are returned as the draft
 * pool and nobody holds cards yet: the rulebook has each player choose a
 * leader first, then deals five cards each (the reducer deals from the top of
 * `deck` once the draft is done).
 */
export function dealHtsSetup(
  seats: Seat[],
  rng: RngState,
  expansions: readonly HtsExpansionId[] = [],
): {
  deck: HtsCard[];
  monsterRow: HtsMonster[];
  monsterDeck: HtsMonster[];
  leaderPool: HtsCard[];
  giftDeck: HtsCard[];
} {
  let nextId = 1;

  const leaderDefs = getPartyLeadersForExpansions(expansions).filter((d) => leaderAllowed(d.kind, seats.length));
  const leaderPool: HtsCard[] = leaderDefs.map((d) => ({
    id: nextId++,
    kind: d.kind,
    name: d.name,
    type: d.type,
    class: d.class,
    text: d.text,
    abilityThreshold: null,
    modifierChoices: null,
    expansion: d.expansion,
  }));
  const monsterDefs: HtsMonsterDef[] = [...HTS_MONSTER_DEFS];
  if (expansions.includes('warriors-druids')) monsterDefs.push(...HTS_WARRIORS_DRUIDS_MONSTERS);
  if (expansions.includes('berserkers-necromancers')) monsterDefs.push(...HTS_BERSERKERS_NECROMANCERS_MONSTERS);
  if (expansions.includes('here-to-sleigh')) monsterDefs.push(...HTS_SLEIGH_MONSTERS);

  const monsters: HtsMonster[] = monsterDefs.map((m) => ({
    card: {
      id: nextId++,
      kind: m.kind,
      name: m.name,
      type: 'monster',
      class: null,
      text: m.text,
      abilityThreshold: null,
      modifierChoices: null,
    },
    requiredHeroes: m.requiredHeroes,
    requiredClass: m.requiredClass,
    requirementText: m.requirementText,
    slayThreshold: m.slayThreshold,
    slayOnLow: m.slayOnLow,
    failThreshold: m.failThreshold,
    failPenalty: m.failPenalty,
  }));
  const shuffledMonsters = shuffle(rng, monsters);
  const monsterRow = shuffledMonsters.slice(0, 3);
  const monsterDeck = shuffledMonsters.slice(3);

  const deckDefs: HtsCardDef[] = [...HTS_MAIN_DECK_DEFS];
  if (expansions.includes('warriors-druids')) deckDefs.push(...HTS_WARRIORS_DRUIDS_DECK_DEFS);
  if (expansions.includes('berserkers-necromancers')) deckDefs.push(...HTS_BERSERKERS_NECROMANCERS_DECK_DEFS);
  if (expansions.includes('here-to-sleigh')) deckDefs.push(...HTS_SLEIGH_DECK_DEFS);

  const pool: HtsCard[] = [];
  for (const def of deckDefs) {
    for (let i = 0; i < def.count; i++) pool.push(defToCard(def, nextId++));
  }
  const deck = shuffle(rng, pool);

  const giftPool: HtsCard[] = [];
  if (expansions.includes('here-to-sleigh')) {
    for (const g of HTS_SLEIGH_GIFTS) {
      for (let i = 0; i < g.count; i++) {
        giftPool.push({
          id: nextId++,
          kind: g.kind,
          name: g.name,
          type: 'gift',
          class: null,
          text: g.text,
          abilityThreshold: null,
          modifierChoices: null,
          expansion: 'here-to-sleigh',
        });
      }
    }
  }
  const giftDeck = giftPool.length > 0 ? shuffle(rng, giftPool) : [];

  return { deck, monsterRow, monsterDeck, leaderPool, giftDeck };
}
