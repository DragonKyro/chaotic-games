// Here to Slay — complete verified Base Game card library (6 Party Leaders, 15 Monsters,
// 48 Heroes, 11 Items, 4 Cursed Items, 25 Modifiers, 13 Magic, 14 Challenges = 136 playable cards).

import type { RngState } from '@/core/rng';
import { shuffle } from '@/core/rng';
import type { Seat } from '@/core/types';
import type { HtsBaseClass, HtsCard, HtsCardType, HtsMonster } from './types';

export interface HtsCardDef {
  kind: string;
  name: string;
  type: HtsCardType;
  class: HtsBaseClass | null;
  count: number;
  abilityThreshold: number | null;
  modifierChoices: number[] | null;
  text: string;
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
  failPenalty: 'sacrificeHero' | 'discard2';
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

export function dealHtsSetup(seats: Seat[], rng: RngState): {
  deck: HtsCard[];
  monsterRow: HtsMonster[];
  monsterDeck: HtsMonster[];
  hands: Record<string, HtsCard[]>;
  partyLeaders: Record<string, HtsCard>;
} {
  let nextId = 1;

  const leaders: HtsCard[] = HTS_PARTY_LEADERS.map((d) => ({
    id: nextId++,
    kind: d.kind,
    name: d.name,
    type: d.type,
    class: d.class,
    text: d.text,
    abilityThreshold: null,
    modifierChoices: null,
  }));
  const shuffledLeaders = shuffle(rng, leaders);
  const partyLeaders: Record<string, HtsCard> = {};
  seats.forEach((seat, idx) => {
    partyLeaders[seat.id] = shuffledLeaders[idx % shuffledLeaders.length]!;
  });

  const monsters: HtsMonster[] = HTS_MONSTER_DEFS.map((m) => ({
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

  const pool: HtsCard[] = [];
  for (const def of HTS_MAIN_DECK_DEFS) {
    for (let i = 0; i < def.count; i++) {
      pool.push({
        id: nextId++,
        kind: def.kind,
        name: def.name,
        type: def.type,
        class: def.class,
        text: def.text,
        abilityThreshold: def.abilityThreshold,
        modifierChoices: def.modifierChoices,
      });
    }
  }
  const shuffledPool = shuffle(rng, pool);
  const hands: Record<string, HtsCard[]> = {};
  let cursor = 0;
  for (const seat of seats) {
    hands[seat.id] = shuffledPool.slice(cursor, cursor + 5);
    cursor += 5;
  }
  const deck = shuffledPool.slice(cursor);

  return { deck, monsterRow, monsterDeck, hands, partyLeaders };
}
