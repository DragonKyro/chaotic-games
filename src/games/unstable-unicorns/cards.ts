// Unstable Unicorns — 2nd Edition Base Deck (127 playable cards + 8 reference cards = 135).
// All card counts and 2nd Edition rulebook texts verified against the Unstable Games Wiki.

import type { RngState } from '@/core/rng';
import { shuffle } from '@/core/rng';
import type { Seat } from '@/core/types';
import type { UuCard, UuCardKind, UuCardType, UuConfig, UuEdition, UuExpansionId } from './types';

export interface UuCardDef {
  kind: UuCardKind;
  name: string;
  type: UuCardType;
  count: number;
  text: string;
  source?: UuExpansionId | UuEdition;
}

export const UU_BABY_DEFS: readonly UuCardDef[] = [
  { kind: 'baby-red', name: 'Baby Unicorn (Red)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-pink', name: 'Baby Unicorn (Pink)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-orange', name: 'Baby Unicorn (Orange)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-yellow', name: 'Baby Unicorn (Yellow)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-green', name: 'Baby Unicorn (Green)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-blue', name: 'Baby Unicorn (Blue)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-purple', name: 'Baby Unicorn (Purple)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-black', name: 'Baby Unicorn (Black)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-white', name: 'Baby Unicorn (White)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-brown', name: 'Baby Unicorn (Brown)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-rainbow', name: 'Baby Unicorn (Rainbow)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-death', name: 'Baby Unicorn (Death)', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
  { kind: 'baby-narwhal', name: 'Baby Narwhal', type: 'babyUnicorn', count: 1, text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.' },
];

export const UU_MAIN_DECK_DEFS: readonly UuCardDef[] = [
  // Basic Unicorns (22)
  { kind: 'basic-red', name: 'Basic Unicorn (Red)', type: 'basicUnicorn', count: 3, text: 'This card has no special powers, but it sure is cute!' },
  { kind: 'basic-orange', name: 'Basic Unicorn (Orange)', type: 'basicUnicorn', count: 3, text: 'This card has no special powers, but it sure is cute!' },
  { kind: 'basic-yellow', name: 'Basic Unicorn (Yellow)', type: 'basicUnicorn', count: 3, text: 'This card has no special powers, but it sure is cute!' },
  { kind: 'basic-green', name: 'Basic Unicorn (Green)', type: 'basicUnicorn', count: 3, text: 'This card has no special powers, but it sure is cute!' },
  { kind: 'basic-blue', name: 'Basic Unicorn (Blue)', type: 'basicUnicorn', count: 3, text: 'This card has no special powers, but it sure is cute!' },
  { kind: 'basic-indigo', name: 'Basic Unicorn (Indigo)', type: 'basicUnicorn', count: 3, text: 'This card has no special powers, but it sure is cute!' },
  { kind: 'basic-purple', name: 'Basic Unicorn (Purple)', type: 'basicUnicorn', count: 3, text: 'This card has no special powers, but it sure is cute!' },
  { kind: 'basic-narwhal', name: 'Narwhal', type: 'basicUnicorn', count: 1, text: 'This card has no special powers, but it sure is cute!' },

  // Magical Unicorns (30)
  {
    kind: 'alluring-narwhal',
    name: 'Alluring Narwhal',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may STEAL an Upgrade card.',
  },
  {
    kind: 'americorn',
    name: 'Americorn',
    type: 'magicalUnicorn',
    count: 1,
    text: "When this card enters your Stable, you may pull a card at random from another player's hand.",
  },
  {
    kind: 'annoying-flying-unicorn',
    name: 'Annoying Flying Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may force another player to DISCARD a card. If this card would be sacrificed or destroyed, return it to your hand instead.',
  },
  {
    kind: 'black-knight-unicorn',
    name: 'Black Knight Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'If a Unicorn card in your Stable would be destroyed, you may SACRIFICE this card instead.',
  },
  {
    kind: 'chainsaw-unicorn',
    name: 'Chainsaw Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may DESTROY an Upgrade card or SACRIFICE a Downgrade card.',
  },
  {
    kind: 'classy-narwhal',
    name: 'Classy Narwhal',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may search the deck for an Upgrade card and add it to your hand, then shuffle the deck.',
  },
  {
    kind: 'dark-angel-unicorn',
    name: 'Dark Angel Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may SACRIFICE a Unicorn card, then bring a Unicorn card from the discard pile into your Stable.',
  },
  {
    kind: 'extremely-destructive-unicorn',
    name: 'Extremely Destructive Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, each player (including you) must SACRIFICE a Unicorn card.',
  },
  {
    kind: 'ginormous-unicorn',
    name: 'Ginormous Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'This card counts for 2 Unicorns. You cannot play any Neigh cards.',
  },
  {
    kind: 'greedy-flying-unicorn',
    name: 'Greedy Flying Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, DRAW a card. If this card would be sacrificed or destroyed, return it to your hand instead.',
  },
  {
    kind: 'llamacorn',
    name: 'Llamacorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, each player (including you) must DISCARD a card.',
  },
  {
    kind: 'magical-flying-unicorn',
    name: 'Magical Flying Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may add a Magic card from the discard pile to your hand. If this card would be sacrificed or destroyed, return it to your hand instead.',
  },
  {
    kind: 'magical-kittencorn',
    name: 'Magical Kittencorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'This card cannot be destroyed by Magic cards.',
  },
  {
    kind: 'majestic-flying-unicorn',
    name: 'Majestic Flying Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may add a Unicorn card from the discard pile to your hand. If this card would be sacrificed or destroyed, return it to your hand instead.',
  },
  {
    kind: 'mermaid-unicorn',
    name: 'Mermaid Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: "When this card enters your Stable, return a card in another player's Stable to their hand.",
  },
  {
    kind: 'mother-goose-unicorn',
    name: 'Mother Goose Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may bring a Baby Unicorn card from the Nursery into your Stable.',
  },
  {
    kind: 'narwhal-torpedo',
    name: 'Narwhal Torpedo',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, SACRIFICE all Downgrade cards in your Stable.',
  },
  {
    kind: 'necromancer-unicorn',
    name: 'Necromancer Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may DISCARD 2 Unicorn cards, then bring a Unicorn card from the discard pile into your Stable.',
  },
  {
    kind: 'queen-bee-unicorn',
    name: 'Queen Bee Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: "Basic Unicorn cards cannot enter any player's Stable except yours.",
  },
  {
    kind: 'rainbow-unicorn',
    name: 'Rainbow Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may bring a Basic Unicorn card from your hand into your Stable.',
  },
  {
    kind: 'rhinocorn',
    name: 'Rhinocorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'If this card is in your Stable at the beginning of your turn, you may DESTROY a Unicorn card. If you do, immediately end your turn.',
  },
  {
    kind: 'seductive-unicorn',
    name: 'Seductive Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may DISCARD a card, then STEAL a Unicorn card.',
  },
  {
    kind: 'shabby-the-narwhal',
    name: 'Shabby the Narwhal',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may search the deck for a Downgrade card and add it to your hand, then shuffle the deck.',
  },
  {
    kind: 'shark-with-a-horn',
    name: 'Shark With a Horn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may SACRIFICE this card, then DESTROY a Unicorn card.',
  },
  {
    kind: 'stabby-the-unicorn',
    name: 'Stabby the Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'If this card is sacrificed or destroyed, you may DESTROY a Unicorn card.',
  },
  {
    kind: 'swift-flying-unicorn',
    name: 'Swift Flying Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may add a Neigh card from the discard pile to your hand. If this card would be sacrificed or destroyed, return it to your hand instead.',
  },
  {
    kind: 'the-great-narwhal',
    name: 'The Great Narwhal',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, you may search the deck for a card with "Narwhal" in its name and add it to your hand, then shuffle the deck.',
  },
  {
    kind: 'unicorn-on-the-cob',
    name: 'Unicorn on the Cob',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, DRAW 2 cards and DISCARD a card.',
  },
  {
    kind: 'unicorn-oracle',
    name: 'Unicorn Oracle',
    type: 'magicalUnicorn',
    count: 1,
    text: 'When this card enters your Stable, look at the top 3 cards of the deck and add one of them to your hand, then return the other two to the top of the deck in any order.',
  },
  {
    kind: 'unicorn-phoenix',
    name: 'Unicorn Phoenix',
    type: 'magicalUnicorn',
    count: 1,
    text: 'If this card would be sacrificed or destroyed, you may DISCARD a card instead.',
  },

  // Magic Cards (25)
  {
    kind: 'back-kick',
    name: 'Back Kick',
    type: 'magic',
    count: 3,
    text: "Return a card in another player's Stable to their hand. That player must DISCARD a card.",
  },
  {
    kind: 'blatant-thievery',
    name: 'Blatant Thievery',
    type: 'magic',
    count: 1,
    text: "Look at another player's hand. Choose a card and add it to your hand.",
  },
  {
    kind: 'change-of-luck',
    name: 'Change of Luck',
    type: 'magic',
    count: 2,
    text: 'DRAW 2 cards and DISCARD 3 cards, then take another turn.',
  },
  {
    kind: 'glitter-tornado',
    name: 'Glitter Tornado',
    type: 'magic',
    count: 2,
    text: "Return a card in each player's Stable (including yours) to their hand.",
  },
  {
    kind: 'good-deal',
    name: 'Good Deal',
    type: 'magic',
    count: 1,
    text: 'DRAW 3 cards and DISCARD a card.',
  },
  {
    kind: 'kiss-of-life',
    name: 'Kiss of Life',
    type: 'magic',
    count: 1,
    text: 'Bring a Unicorn card from the discard pile into your Stable.',
  },
  {
    kind: 'mystical-vortex',
    name: 'Mystical Vortex',
    type: 'magic',
    count: 1,
    text: 'Each player (including you) must DISCARD a card. Shuffle the discard pile into the deck.',
  },
  {
    kind: 're-target',
    name: 'Re-Target',
    type: 'magic',
    count: 2,
    text: "Move an Upgrade or Downgrade card from any player's Stable to any other player's Stable.",
  },
  {
    kind: 'reset-button',
    name: 'Reset Button',
    type: 'magic',
    count: 1,
    text: 'Each player (including you) must SACRIFICE all Upgrade and Downgrade cards in their Stable. Shuffle the discard pile into the deck.',
  },
  {
    kind: 'shake-up',
    name: 'Shake Up',
    type: 'magic',
    count: 1,
    text: 'Shuffle this card, your hand, and the discard pile into the deck. DRAW 5 cards.',
  },
  {
    kind: 'targeted-destruction',
    name: 'Targeted Destruction',
    type: 'magic',
    count: 1,
    text: 'DESTROY an Upgrade card or SACRIFICE a Downgrade card.',
  },
  {
    kind: 'two-for-one',
    name: 'Two-For-One',
    type: 'magic',
    count: 2,
    text: 'SACRIFICE a card, then DESTROY 2 cards.',
  },
  {
    kind: 'unfair-bargain',
    name: 'Unfair Bargain',
    type: 'magic',
    count: 2,
    text: 'Trade hands with any other player.',
  },
  {
    kind: 'unicorn-poison',
    name: 'Unicorn Poison',
    type: 'magic',
    count: 3,
    text: 'DESTROY a Unicorn card.',
  },
  {
    kind: 'unicorn-swap',
    name: 'Unicorn Swap',
    type: 'magic',
    count: 2,
    text: "Move a Unicorn card in your Stable to any other player's Stable, then STEAL a Unicorn card from that player's Stable.",
  },

  // Instant Cards (15)
  {
    kind: 'neigh',
    name: 'Neigh',
    type: 'instant',
    count: 14,
    text: 'Play this card when another player tries to play a card. Stop their card from being played and send it to the discard pile.',
  },
  {
    kind: 'super-neigh',
    name: 'Super Neigh',
    type: 'instant',
    count: 1,
    text: "Play this card when another player tries to play a card. Stop their card from being played and send it to the discard pile. This card cannot be Neigh'd.",
  },

  // Upgrade Cards (14)
  {
    kind: 'caffeine-overload',
    name: 'Caffeine Overload',
    type: 'upgrade',
    count: 1,
    text: 'If this card is in your Stable at the beginning of your turn, you may SACRIFICE a card, then DRAW 2 cards.',
  },
  {
    kind: 'claw-machine',
    name: 'Claw Machine',
    type: 'upgrade',
    count: 3,
    text: 'If this card is in your Stable at the beginning of your turn, you may DISCARD a card, then DRAW a card.',
  },
  {
    kind: 'double-dutch',
    name: 'Double Dutch',
    type: 'upgrade',
    count: 1,
    text: 'If this card is in your Stable at the beginning of your turn, you may play 2 cards during your Action phase.',
  },
  {
    kind: 'glitter-bomb',
    name: 'Glitter Bomb',
    type: 'upgrade',
    count: 2,
    text: 'If this card is in your Stable at the beginning of your turn, you may SACRIFICE a card, then DESTROY a card.',
  },
  {
    kind: 'rainbow-aura',
    name: 'Rainbow Aura',
    type: 'upgrade',
    count: 1,
    text: 'Your Unicorn cards cannot be destroyed.',
  },
  {
    kind: 'rainbow-lasso',
    name: 'Rainbow Lasso',
    type: 'upgrade',
    count: 1,
    text: 'If this card is in your Stable at the beginning of your turn, you may DISCARD 3 cards, then STEAL a Unicorn card.',
  },
  {
    kind: 'stable-artillery',
    name: 'Stable Artillery',
    type: 'upgrade',
    count: 3,
    text: 'If this card is in your Stable at the beginning of your turn, you may DISCARD 2 cards, then DESTROY a Unicorn card.',
  },
  {
    kind: 'yay',
    name: 'Yay',
    type: 'upgrade',
    count: 2,
    text: "Cards you play cannot be Neigh'd.",
  },

  // Downgrade Cards (8)
  {
    kind: 'barbed-wire',
    name: 'Barbed Wire',
    type: 'downgrade',
    count: 1,
    text: 'Each time a Unicorn card enters or leaves your Stable, DISCARD a card.',
  },
  {
    kind: 'blinding-light',
    name: 'Blinding Light',
    type: 'downgrade',
    count: 1,
    text: 'All of your Unicorn cards are considered Basic Unicorns with no effects.',
  },
  {
    kind: 'broken-stable',
    name: 'Broken Stable',
    type: 'downgrade',
    count: 1,
    text: 'You cannot play Upgrade cards.',
  },
  {
    kind: 'nanny-cam',
    name: 'Nanny Cam',
    type: 'downgrade',
    count: 1,
    text: 'Your hand must be visible to all players.',
  },
  {
    kind: 'pandamonium',
    name: 'Pandamonium',
    type: 'downgrade',
    count: 1,
    text: 'All of your Unicorns are considered Pandas. Cards that affect Unicorn cards do not affect your Pandas.',
  },
  {
    kind: 'sadistic-ritual',
    name: 'Sadistic Ritual',
    type: 'downgrade',
    count: 1,
    text: 'If this card is in your Stable at the beginning of your turn, SACRIFICE a Unicorn card, then DRAW a card.',
  },
  {
    kind: 'slowdown',
    name: 'Slowdown',
    type: 'downgrade',
    count: 1,
    text: 'You cannot play Neigh cards.',
  },
  {
    kind: 'tiny-stable',
    name: 'Tiny Stable',
    type: 'downgrade',
    count: 1,
    text: 'If at any time you have more than 5 Unicorns in your Stable, SACRIFICE a Unicorn card.',
  },
];

// ============================================================================
// Expansion Card Definitions (all 8 official expansions)
// ============================================================================

export const UU_EXPANSION_DEFS: readonly UuCardDef[] = [
  // 1. Rainbow Apocalypse ('rainbow-apocalypse')
  {
    kind: 'baby-apocalypse',
    name: 'Baby Unicorn of the Apocalypse',
    type: 'babyUnicorn',
    count: 1,
    source: 'rainbow-apocalypse',
    text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.',
  },
  {
    kind: 'four-horsecorn',
    name: 'Four Horsecorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'rainbow-apocalypse',
    text: 'When this card enters your Stable, you may search the deck for a Unicorn card and add it to your hand, then shuffle the deck.',
  },
  {
    kind: 'unicorn-of-famine',
    name: 'Unicorn of Famine',
    type: 'magicalUnicorn',
    count: 1,
    source: 'rainbow-apocalypse',
    text: "Each other player's hand limit is reduced by 1 card.",
  },
  {
    kind: 'unicorn-of-pestilence',
    name: 'Unicorn of Pestilence',
    type: 'magicalUnicorn',
    count: 1,
    source: 'rainbow-apocalypse',
    text: 'When this card enters your Stable, each other player must DISCARD a card.',
  },
  {
    kind: 'unicorn-of-war',
    name: 'Unicorn of War',
    type: 'magicalUnicorn',
    count: 1,
    source: 'rainbow-apocalypse',
    text: 'When this card enters your Stable, you may DESTROY a Unicorn card.',
  },
  {
    kind: 'unicorn-of-death',
    name: 'Unicorn of Death',
    type: 'magicalUnicorn',
    count: 1,
    source: 'rainbow-apocalypse',
    text: 'If this card is in your Stable at the beginning of your turn, you may SACRIFICE a Unicorn card, then DESTROY a Unicorn card.',
  },
  {
    kind: 'unicorn-rainbow-princess',
    name: 'Unicorn Rainbow Princess',
    type: 'magicalUnicorn',
    count: 1,
    source: 'rainbow-apocalypse',
    text: 'When this card enters your Stable, DRAW 2 cards, then each other player DRAWs a card.',
  },
  {
    kind: 'catastrophe',
    name: 'Catastrophe',
    type: 'magic',
    count: 1,
    source: 'rainbow-apocalypse',
    text: 'Each player (including you) must SACRIFICE a Unicorn card.',
  },
  {
    kind: 'rainbow-apocalypse-magic',
    name: 'Rainbow Apocalypse',
    type: 'magic',
    count: 1,
    source: 'rainbow-apocalypse',
    text: 'SACRIFICE a Unicorn card, then bring up to 2 Unicorn cards from the discard pile into your Stable.',
  },
  {
    kind: 'plague-of-death',
    name: 'Plague of Death',
    type: 'magic',
    count: 1,
    source: 'rainbow-apocalypse',
    text: 'DESTROY a Unicorn card, then DRAW a card.',
  },
  {
    kind: 'apocalypse-bunker',
    name: 'Rainbow Sprinkles',
    type: 'upgrade',
    count: 1,
    source: 'rainbow-apocalypse',
    text: 'If this card is in your Stable at the beginning of your turn, you may DRAW a card.',
  },
  {
    kind: 'all-out-of-rainbows',
    name: 'All Out of Rainbows',
    type: 'downgrade',
    count: 1,
    source: 'rainbow-apocalypse',
    text: 'If this card is in your Stable at the beginning of your turn, you must DISCARD a card.',
  },
  {
    kind: 'neigh-thank-you',
    name: 'Neigh, Thank You',
    type: 'instant',
    count: 2,
    source: 'rainbow-apocalypse',
    text: 'Play this card when another player tries to play a card. Stop their card from being played and send it to the discard pile. Each player DRAWs a card.',
  },

  // 2. Dragons ('dragons')
  {
    kind: 'baby-dragoncorn',
    name: 'Baby Dragoncorn',
    type: 'babyUnicorn',
    count: 1,
    source: 'dragons',
    text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.',
  },
  {
    kind: 'bahamuticorn',
    name: 'Bahamuticorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'dragons',
    text: 'This card counts for 2 Unicorns. When this card enters your Stable, you may DESTROY an Upgrade card or SACRIFICE a Downgrade card.',
  },
  {
    kind: 'twin-dragoncorns',
    name: 'Twin Dragoncorns',
    type: 'magicalUnicorn',
    count: 1,
    source: 'dragons',
    text: 'This card counts for 2 Unicorns. If this card would be destroyed, return it to your hand instead.',
  },
  {
    kind: 'dragon-riders',
    name: 'Dragon Riders',
    type: 'magicalUnicorn',
    count: 1,
    source: 'dragons',
    text: 'When this card enters your Stable, you may search the deck for an Upgrade or Unicorn card and add it to your hand, then shuffle the deck.',
  },
  {
    kind: 'dragon-slayer-unicorn',
    name: 'Dragon Slayer Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'dragons',
    text: 'When this card enters your Stable, you may DESTROY a Unicorn card.',
  },
  {
    kind: 'scaled-flying-unicorn',
    name: 'Scaled Flying Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'dragons',
    text: 'When this card enters your Stable, you may add an Upgrade card from the discard pile to your hand. If this card would be sacrificed or destroyed, return it to your hand instead.',
  },
  {
    kind: 'dragons-breath',
    name: "Dragon's Breath",
    type: 'magic',
    count: 2,
    source: 'dragons',
    text: "DESTROY a Unicorn card or an Upgrade card in another player's Stable.",
  },
  {
    kind: 'dragons-fire',
    name: "Dragon's Fire",
    type: 'magic',
    count: 1,
    source: 'dragons',
    text: 'Each other player must DISCARD a card. DRAW a card.',
  },
  {
    kind: 'dragons-blessing',
    name: "Dragon's Blessing",
    type: 'upgrade',
    count: 1,
    source: 'dragons',
    text: 'Effects of your Downgrade cards do not affect you.',
  },
  {
    kind: 'dragons-fortune',
    name: "Dragon's Fortune",
    type: 'upgrade',
    count: 1,
    source: 'dragons',
    text: 'If this card is in your Stable at the beginning of your turn, you may DRAW a card.',
  },
  {
    kind: 'dragons-curse',
    name: "Dragon's Curse",
    type: 'downgrade',
    count: 1,
    source: 'dragons',
    text: 'Effects of your Upgrade cards do not affect you.',
  },
  {
    kind: 'dragon-skies',
    name: 'Dragon Skies',
    type: 'downgrade',
    count: 1,
    source: 'dragons',
    text: 'When a Unicorn card enters your Stable, its enter-Stable effect does not trigger.',
  },
  {
    kind: 'neigh-foul-beast',
    name: 'Neigh, Foul Beast',
    type: 'instant',
    count: 2,
    source: 'dragons',
    text: 'Play this card when another player tries to play a card. Stop their card from being played and send it to the discard pile.',
  },

  // 3. Unicorns of Legend ('unicorns-of-legend')
  {
    kind: 'baby-knight-unicorn',
    name: 'Baby Knight Unicorn',
    type: 'babyUnicorn',
    count: 1,
    source: 'unicorns-of-legend',
    text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.',
  },
  {
    kind: 'archangel-unicorn',
    name: 'Archangel Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'unicorns-of-legend',
    text: 'When this card enters your Stable, you may bring a Unicorn card from the discard pile into your Stable.',
  },
  {
    kind: 'nine-tailed-foxicorn',
    name: 'Nine-Tailed Foxicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'unicorns-of-legend',
    text: 'When this card enters your Stable, DRAW 2 cards and you may STEAL an Upgrade card.',
  },
  {
    kind: 'mage-unicorn',
    name: 'Mage Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'unicorns-of-legend',
    text: 'When this card enters your Stable, you may search the deck for a Magic card and add it to your hand, then shuffle the deck.',
  },
  {
    kind: 'bardicorn',
    name: 'Bardicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'unicorns-of-legend',
    text: 'When this card enters your Stable, DRAW a card and you may STEAL an Upgrade card.',
  },
  {
    kind: 'paladincorn',
    name: 'Paladincorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'unicorns-of-legend',
    text: 'When this card enters your Stable, SACRIFICE all Downgrade cards in your Stable and DRAW a card.',
  },
  {
    kind: 'raze-the-stables',
    name: 'Raze the Stables',
    type: 'magic',
    count: 2,
    source: 'unicorns-of-legend',
    text: 'Each other player must SACRIFICE a Unicorn card.',
  },
  {
    kind: 'fireball',
    name: 'Fireball',
    type: 'magic',
    count: 1,
    source: 'unicorns-of-legend',
    text: 'DESTROY a Unicorn card, then DRAW a card.',
  },
  {
    kind: 'dwarven-forge',
    name: 'Dwarven Armory',
    type: 'upgrade',
    count: 1,
    source: 'unicorns-of-legend',
    text: 'If this card is in your Stable at the beginning of your turn, you may add a Magic card from the discard pile to your hand.',
  },
  {
    kind: 'medieval-sanitation',
    name: 'Medieval Sanitation',
    type: 'downgrade',
    count: 1,
    source: 'unicorns-of-legend',
    text: 'If this card is in your Stable at the beginning of your turn, you must DISCARD a card.',
  },
  {
    kind: 'neigh-mlord',
    name: "Neigh, M'Lord",
    type: 'instant',
    count: 2,
    source: 'unicorns-of-legend',
    text: 'Play this card when another player tries to play a card. Stop their card from being played and send it to the discard pile.',
  },

  // 4. Adventures ('adventures')
  {
    kind: 'baby-adventurer',
    name: 'Baby Adventurer Unicorn',
    type: 'babyUnicorn',
    count: 1,
    source: 'adventures',
    text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.',
  },
  {
    kind: 'cutthroat-captain-unicorn',
    name: 'Cutthroat Captain Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'adventures',
    text: "When this card enters your Stable, you may STEAL a Unicorn card from another player's Stable, then that player DRAWs a card.",
  },
  {
    kind: 'extreme-adventurer-unicorn',
    name: 'Extreme Adventurer Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'adventures',
    text: 'When this card enters your Stable, DRAW 2 cards. If this card would be sacrificed or destroyed, return it to your hand instead.',
  },
  {
    kind: 'pillaging-pirate-unicorn',
    name: 'Pillaging Pirate Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'adventures',
    text: "When this card enters your Stable, you may pull a card at random from another player's hand.",
  },
  {
    kind: 'treasure-hunter-unicorn',
    name: 'Treasure Hunter Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'adventures',
    text: 'When this card enters your Stable, you may add an Upgrade or Magic card from the discard pile to your hand.',
  },
  {
    kind: 'the-great-baby-heist',
    name: 'The Great Baby Heist',
    type: 'magic',
    count: 1,
    source: 'adventures',
    text: 'Bring a Baby Unicorn card from the Nursery into your Stable, then DRAW a card.',
  },
  {
    kind: 'mysterious-compass',
    name: 'Mysterious Compass',
    type: 'magic',
    count: 1,
    source: 'adventures',
    text: 'Look at the top 3 cards of the deck and add one of them to your hand, then return the other two to the top of the deck in any order.',
  },
  {
    kind: 'unicorn-survival-kit',
    name: 'Unicorn Survival Kit',
    type: 'upgrade',
    count: 1,
    source: 'adventures',
    text: 'If a Unicorn card in your Stable would be destroyed, you may SACRIFICE this card instead.',
  },
  {
    kind: 'royal-hooves',
    name: 'Royal Hooves',
    type: 'upgrade',
    count: 1,
    source: 'adventures',
    text: 'Each time a Unicorn card enters your Stable, DRAW a card.',
  },
  {
    kind: 'the-black-spot',
    name: 'The Black Spot',
    type: 'downgrade',
    count: 1,
    source: 'adventures',
    text: 'You cannot play Instant cards. If this card is in your Stable at the beginning of your turn, you may SACRIFICE a Unicorn card to SACRIFICE this card.',
  },
  {
    kind: 'unicorn-net',
    name: 'Unicorn Net',
    type: 'instant',
    count: 2,
    source: 'adventures',
    text: 'Play this card when another player tries to play a card. Stop their card from resolving and add it to your hand instead!',
  },
  {
    kind: 'absorb-and-reflect',
    name: 'Absorb and Reflect',
    type: 'instant',
    count: 1,
    source: 'adventures',
    text: 'Play this card when another player tries to play a card. Add their card to your hand instead and force them to DISCARD a card.',
  },
  {
    kind: 'redirect',
    name: 'Redirect',
    type: 'instant',
    count: 2,
    source: 'adventures',
    text: 'Play this card when another player tries to play a card. Redirect their card so it resolves for you (or onto their Stable if it is a Downgrade)!',
  },
  {
    kind: 'flare-gun',
    name: 'Flare Gun',
    type: 'instant',
    count: 1,
    source: 'adventures',
    text: 'Play this card when another player tries to play a card. Stop their card from being played, send it to the discard pile, and DRAW a card.',
  },
  {
    kind: 'trapped-chest',
    name: 'Trapped Chest',
    type: 'instant',
    count: 1,
    source: 'adventures',
    text: 'Play this card when another player tries to play a card. Stop their card from being played and force them to DISCARD a card.',
  },

  // 5. Nightmares ('nightmares')
  {
    kind: 'baby-nightmare',
    name: 'Baby Nightmare Unicorn',
    type: 'babyUnicorn',
    count: 1,
    source: 'nightmares',
    text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.',
  },
  {
    kind: 'phantom-steedicorn',
    name: 'Phantom Steedicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'nightmares',
    text: 'When this card enters your Stable, you may bring a Unicorn card from the discard pile into your Stable. If this card would be destroyed, return it to your hand instead.',
  },
  {
    kind: 'vampirellacorn',
    name: 'Vampirellacorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'nightmares',
    text: 'When this card enters your Stable, you may DESTROY a Unicorn card, then DRAW a card.',
  },
  {
    kind: 'jack-the-reapercorn',
    name: 'Jack the Reapercorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'nightmares',
    text: 'If this card is in your Stable at the beginning of your turn, you may DESTROY a Unicorn card, then DISCARD a card.',
  },
  {
    kind: 'chainsaw-massicorn',
    name: 'Chainsaw Massicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'nightmares',
    text: 'When this card enters your Stable, you may DESTROY an Upgrade card or SACRIFICE a Downgrade card, then DRAW a card.',
  },
  {
    kind: 'nightmare-pact',
    name: 'Nightmare Pact',
    type: 'magic',
    count: 1,
    source: 'nightmares',
    text: 'SACRIFICE a card in your Stable, then DRAW 2 cards and bring a Unicorn card from the discard pile into your Stable.',
  },
  {
    kind: 'black-hole',
    name: 'Black Hole',
    type: 'magic',
    count: 2,
    source: 'nightmares',
    text: "DESTROY a Unicorn card in another player's Stable. That player must DISCARD a card.",
  },
  {
    kind: 'saved-by-the-sigil',
    name: 'Saved by the Sigil',
    type: 'upgrade',
    count: 1,
    source: 'nightmares',
    text: 'If this card is in your Stable at the beginning of your turn, you may add a Unicorn card from the discard pile to your hand.',
  },
  {
    kind: 'hex',
    name: 'Hex',
    type: 'downgrade',
    count: 1,
    source: 'nightmares',
    text: 'When a Unicorn card enters your Stable, its enter-Stable effect does not trigger. You cannot play Magic cards.',
  },
  {
    kind: 'hex-neigh',
    name: 'Hex Neigh',
    type: 'instant',
    count: 2,
    source: 'nightmares',
    text: 'Play this card when another player tries to play a card. Stop their card from being played and send it to the discard pile.',
  },

  // 6. Christmas ('christmas')
  {
    kind: 'baby-rudolphicorn',
    name: 'Baby Rudolphicorn',
    type: 'babyUnicorn',
    count: 1,
    source: 'christmas',
    text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.',
  },
  {
    kind: 'santaicorn',
    name: 'Santaicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'christmas',
    text: 'When this card enters your Stable, DRAW 2 cards.',
  },
  {
    kind: 'reindeercorn',
    name: 'Reindeercorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'christmas',
    text: 'When this card enters your Stable, you may bring a Basic Unicorn card from your hand into your Stable. If this card would be sacrificed or destroyed, return it to your hand instead.',
  },
  {
    kind: 'flying-krampuscorn',
    name: 'Flying Krampuscorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'christmas',
    text: 'When this card enters your Stable, you may DESTROY a Unicorn card. If this card would be sacrificed or destroyed, return it to your hand instead.',
  },
  {
    kind: 'humbug',
    name: 'Humbug',
    type: 'magic',
    count: 2,
    source: 'christmas',
    text: "DESTROY an Upgrade card or a Unicorn card in another player's Stable.",
  },
  {
    kind: 'gift-receipt',
    name: 'Gift Receipt',
    type: 'magic',
    count: 1,
    source: 'christmas',
    text: 'Return a card in your Stable to your hand, then DRAW 2 cards.',
  },
  {
    kind: 'gingerbread-stable',
    name: 'Gingerbread Stable',
    type: 'upgrade',
    count: 1,
    source: 'christmas',
    text: 'If this card is in your Stable at the beginning of your turn, you may DRAW a card.',
  },
  {
    kind: 'ugly-holiday-sweater',
    name: 'Ugly Holiday Sweater',
    type: 'upgrade',
    count: 1,
    source: 'christmas',
    text: 'Your Unicorn cards cannot be stolen or returned to your hand by other players.',
  },
  {
    kind: 'gift-inspector',
    name: 'Gift Inspector',
    type: 'upgrade',
    count: 1,
    source: 'christmas',
    text: "If this card is in your Stable at the beginning of your turn, you may pull a card at random from another player's hand.",
  },
  {
    kind: 'lump-of-coal',
    name: 'Lump of Coal',
    type: 'downgrade',
    count: 1,
    source: 'christmas',
    text: 'Your hand limit is reduced by 2 cards.',
  },
  {
    kind: 'jingle-all-the-neigh',
    name: 'Jingle All The Neigh',
    type: 'instant',
    count: 2,
    source: 'christmas',
    text: 'Play this card when another player tries to play a card. Stop their card from being played, send it to the discard pile, and DRAW a card.',
  },

  // 7. Uncut Unicorns ('uncut-unicorns')
  {
    kind: 'baby-uncut',
    name: 'Baby Uncut Unicorn',
    type: 'babyUnicorn',
    count: 1,
    source: 'uncut-unicorns',
    text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.',
  },
  {
    kind: 'uncut-unicorn',
    name: 'Uncut Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'uncut-unicorns',
    text: 'Your hand limit is increased by 1 card. When this card enters your Stable, DRAW a card.',
  },
  {
    kind: 'stripper-unicorn',
    name: 'Burlesque Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'uncut-unicorns',
    text: 'When this card enters your Stable, you may force another player to DISCARD a card, then DRAW a card.',
  },
  {
    kind: 'hangover-unicorn',
    name: 'Hangover Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'uncut-unicorns',
    text: 'When this card enters your Stable, DRAW 2 cards.',
  },
  {
    kind: 'liquid-courage',
    name: 'Liquid Courage',
    type: 'magic',
    count: 1,
    source: 'uncut-unicorns',
    text: 'DRAW 2 cards, then you may DESTROY an Upgrade card or SACRIFICE a Downgrade card.',
  },
  {
    kind: 'walk-of-shame',
    name: 'Walk of Shame',
    type: 'magic',
    count: 1,
    source: 'uncut-unicorns',
    text: "Return a Unicorn card in another player's Stable to their hand.",
  },
  {
    kind: 'vip-lounge',
    name: 'VIP Stable Pass',
    type: 'upgrade',
    count: 1,
    source: 'uncut-unicorns',
    text: 'If this card is in your Stable at the beginning of your turn, you may DRAW a card.',
  },
  {
    kind: 'stage-fright',
    name: 'Stage Fright',
    type: 'downgrade',
    count: 1,
    source: 'uncut-unicorns',
    text: 'You cannot play Magical Unicorn cards while you have 5 or more Unicorns in your Stable.',
  },
  {
    kind: 'neigh-bitch',
    name: 'Safe Word Neigh',
    type: 'instant',
    count: 2,
    source: 'uncut-unicorns',
    text: 'Play this card when another player tries to play a card. Stop their card from being played and send it to the discard pile.',
  },

  // 8. NSFW ('nsfw')
  {
    kind: 'baby-nsfw',
    name: 'Baby Rebel Unicorn',
    type: 'babyUnicorn',
    count: 1,
    source: 'nsfw',
    text: 'If this card would be sacrificed, destroyed, or returned to your hand, return it to the Nursery instead.',
  },
  {
    kind: 'dominatrix-unicorn',
    name: 'Dominatrix Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'nsfw',
    text: 'When this card enters your Stable, you may force another player to SACRIFICE a Unicorn card, then DRAW a card.',
  },
  {
    kind: 'sugar-daddy-unicorn',
    name: 'Sugar Daddy Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'nsfw',
    text: 'When this card enters your Stable, DRAW 2 cards and you may STEAL an Upgrade card.',
  },
  {
    kind: 'polyamorous-unicorn',
    name: 'Polyamorous Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'nsfw',
    text: 'When this card enters your Stable, you may bring a Unicorn card from your hand into your Stable.',
  },
  {
    kind: 'booty-call',
    name: 'Midnight Summons',
    type: 'magic',
    count: 1,
    source: 'nsfw',
    text: 'Search the deck for a Unicorn card and add it to your hand, then shuffle the deck.',
  },
  {
    kind: 'ghosted',
    name: 'Ghosted',
    type: 'magic',
    count: 1,
    source: 'nsfw',
    text: "DESTROY a Unicorn card in another player's Stable.",
  },
  {
    kind: 'leather-harness',
    name: 'Spiked Harness',
    type: 'upgrade',
    count: 1,
    source: 'nsfw',
    text: 'Whenever a Unicorn card in your Stable is destroyed by another player, that player must DISCARD a card.',
  },
  {
    kind: 'ball-and-chain',
    name: 'Ball and Chain',
    type: 'downgrade',
    count: 1,
    source: 'nsfw',
    text: 'Unicorn cards in your Stable cannot be returned to your hand.',
  },
  {
    kind: 'hard-limit-neigh',
    name: 'Hard Limit Neigh',
    type: 'instant',
    count: 2,
    source: 'nsfw',
    text: 'Play this card when another player tries to play a card. Stop their card from being played and send it to the discard pile.',
  },
];

// ============================================================================
// Edition-specific Card Definitions
// ============================================================================

export const UU_FIRST_EDITION_DEFS: readonly UuCardDef[] = [
  {
    kind: 'extremely-fertile-unicorn',
    name: 'Extremely Fertile Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'base',
    text: 'If this card is in your Stable at the beginning of your turn, you may DISCARD a card. If you do, bring a Baby Unicorn card from the Nursery directly into your Stable.',
  },
  {
    kind: 'puppicorn',
    name: 'Puppicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'base',
    text: "Each time any player begins their turn, move this card to that player's Stable. This card cannot be sacrificed or destroyed.",
  },
  {
    kind: 'zombie-unicorn',
    name: 'Zombie Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'base',
    text: 'If this card is in your Stable at the beginning of your turn, you may DISCARD a Unicorn card. If you do, choose a Unicorn card from the discard pile and bring it directly into your Stable, then immediately skip to your End of Turn Phase.',
  },
  {
    kind: 'angel-unicorn',
    name: 'Angel Unicorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'base',
    text: 'If this card is in your Stable at the beginning of your turn, you may SACRIFICE this card. If you do, choose a Unicorn card from the discard pile and bring it directly into your Stable.',
  },
  {
    kind: 'unicorn-shrinkray',
    name: 'Unicorn Shrinkray',
    type: 'magic',
    count: 1,
    source: 'base',
    text: "Choose any player. Move all of that player's Unicorn cards to the discard pile without triggering any of their effects, then bring the same number of Baby Unicorn cards from the Nursery directly into that player's Stable.",
  },
  {
    kind: 'extra-tail',
    name: 'Extra Tail',
    type: 'upgrade',
    count: 3,
    source: 'base',
    text: 'This card can only enter a Stable if there is a Basic Unicorn card in that Stable. If this card is in your Stable at the beginning of your turn, you may DRAW an extra card.',
  },
  {
    kind: 'rainbow-mane',
    name: 'Rainbow Mane',
    type: 'upgrade',
    count: 3,
    source: 'base',
    text: 'This card can only enter a Stable if there is a Basic Unicorn card in that Stable. If this card is in your Stable at the beginning of your turn, you may bring a Basic Unicorn card from your hand directly into your Stable.',
  },
  {
    kind: 'summoning-ritual',
    name: 'Summoning Ritual',
    type: 'upgrade',
    count: 1,
    source: 'base',
    text: 'If this card is in your Stable at the beginning of your turn, you may DISCARD 2 Unicorn cards. If you do, bring a Unicorn card directly from the discard pile into your Stable.',
  },
  {
    kind: 'unicorn-lasso',
    name: 'Unicorn Lasso',
    type: 'upgrade',
    count: 1,
    source: 'base',
    text: 'If this card is in your Stable at the beginning of your turn, you may STEAL a Unicorn card. At the end of your turn, return that Unicorn card to the Stable from which you stole it.',
  },
];

export const UU_CONTROL_EDITION_DEFS: readonly UuCardDef[] = [
  {
    kind: 'chronocorn',
    name: 'Chronocorn',
    type: 'magicalUnicorn',
    count: 1,
    source: 'control',
    text: 'When this card enters your Stable, look at the top 3 cards of the deck and add one to your hand, then return the other two to the top of the deck in any order.',
  },
  {
    kind: 'unicorn-of-order',
    name: 'Unicorn of Order',
    type: 'magicalUnicorn',
    count: 1,
    source: 'control',
    text: 'When this card enters your Stable, you may search the deck for an Upgrade card and add it to your hand, then shuffle the deck.',
  },
  {
    kind: 'time-shift',
    name: 'Time Shift',
    type: 'magic',
    count: 2,
    source: 'control',
    text: 'Add a Unicorn or Upgrade card from the discard pile to your hand, then DRAW a card.',
  },
  {
    kind: 'aura-of-order',
    name: 'Aura of Order',
    type: 'upgrade',
    count: 1,
    source: 'control',
    text: 'If this card is in your Stable at the beginning of your turn, you may DRAW a card.',
  },
  {
    kind: 'absorb-and-reflect',
    name: 'Absorb and Reflect',
    type: 'instant',
    count: 2,
    source: 'control',
    text: 'Play this card when another player tries to play a card. Add their card to your hand instead and force them to DISCARD a card.',
  },
];

export const UU_CHAOS_EDITION_DEFS: readonly UuCardDef[] = [
  {
    kind: 'unicorn-of-chaos',
    name: 'Unicorn of Chaos',
    type: 'magicalUnicorn',
    count: 1,
    source: 'chaos',
    text: 'When this card enters your Stable, you may DESTROY a Unicorn card and DRAW a card.',
  },
  {
    kind: 'hells-steedicorn',
    name: "Hell's Steedicorn",
    type: 'magicalUnicorn',
    count: 1,
    source: 'chaos',
    text: 'When this card enters your Stable, you may SACRIFICE a card, then DESTROY a Unicorn card.',
  },
  {
    kind: 'chaos-storm',
    name: 'Chaos Storm',
    type: 'magic',
    count: 2,
    source: 'chaos',
    text: 'Each player must SACRIFICE a Unicorn card, then you DRAW a card.',
  },
  {
    kind: 'altar-of-chaos',
    name: 'Altar of Chaos',
    type: 'upgrade',
    count: 1,
    source: 'chaos',
    text: 'If this card is in your Stable at the beginning of your turn, you may SACRIFICE a card, then DESTROY a card.',
  },
  {
    kind: 'redirect',
    name: 'Redirect',
    type: 'instant',
    count: 2,
    source: 'chaos',
    text: 'Play this card when another player tries to play a card. Redirect their card so it resolves for you (or onto their Stable if it is a Downgrade)!',
  },
];

/**
 * Diamond Edition (2024): the 2nd Edition Base Deck unchanged, plus these four
 * Diamond Unicorns, which never enter the deck. They start face up in the Vault
 * and move only through the Diamond Phase or card effects (wiki "Unstable
 * Unicorns Diamond - Rules" / "Inventory List"; texts from each card's page).
 * Diamond Unicorns cannot be destroyed, sacrificed, or returned to a hand.
 */
export const UU_DIAMOND_EDITION_DEFS: readonly UuCardDef[] = [
  {
    kind: 'prismawing',
    name: 'Prismawing',
    type: 'diamondUnicorn',
    count: 1,
    source: 'diamond',
    text: 'When this card enters your Stable, you may DISCARD a card, then DRAW 3 cards.',
  },
  {
    kind: 'reaper',
    name: 'Reaper',
    type: 'diamondUnicorn',
    count: 1,
    source: 'diamond',
    // Not modeled: Reaper's printed text could not be confirmed (its wiki page was
    // never archived). It counts as a Unicorn and follows the Diamond rules.
    text: 'Printed effect not confirmed — not modeled here: this Diamond Unicorn has no effect.',
  },
  {
    kind: 'shimmerblade',
    name: 'Shimmerblade',
    type: 'diamondUnicorn',
    count: 1,
    source: 'diamond',
    text: "When this card enters your Stable, you may look at another player's hand. If you do, you may choose a card and add it to your hand.",
  },
  {
    kind: 'sparklestar',
    name: 'Sparklestar',
    type: 'diamondUnicorn',
    count: 1,
    source: 'diamond',
    text: 'When this card enters your Stable, you may add a Magic card from the discard pile to your hand.',
  },
];

export const UU_TRAVEL_EDITION_DEFS: readonly UuCardDef[] = [
  {
    kind: 'travel-unicorn',
    name: 'Globetrotter Unicorn',
    type: 'magicalUnicorn',
    count: 2,
    source: 'travel',
    text: 'When this card enters your Stable, DRAW a card and SACRIFICE all Downgrade cards in your Stable.',
  },
];

const FLYER_KINDS: readonly UuCardKind[] = [
  'annoying-flying-unicorn',
  'greedy-flying-unicorn',
  'magical-flying-unicorn',
  'majestic-flying-unicorn',
  'swift-flying-unicorn',
  'scaled-flying-unicorn',
  'extreme-adventurer-unicorn',
  'reindeercorn',
  'flying-krampuscorn',
];

export function isFlyerKind(kind: UuCardKind): boolean {
  return FLYER_KINDS.includes(kind);
}

export function isNarwhalCard(card: UuCard): boolean {
  return card.name.toLowerCase().includes('narwhal');
}

export function isNeighCard(card: UuCard): boolean {
  return card.type === 'instant';
}

const BASICS: readonly UuCardKind[] = [
  'basic-red', 'basic-orange', 'basic-yellow', 'basic-green', 'basic-blue', 'basic-indigo', 'basic-purple', 'basic-narwhal',
];

/**
 * Cards taken out of the deck for a 2-player game (Unstable Games Wiki, "Two
 * Player Rules": every Basic Unicorn and anything naming Basic Unicorns, plus
 * cards too strong against a single opponent). Only the two base decks are
 * listed: the other editions' and expansions' pools here are not the printed
 * sets, so their removal lists can't be applied faithfully.
 */
const TWO_PLAYER_REMOVALS: Partial<Record<UuEdition, ReadonlySet<UuCardKind>>> = {
  'base-2nd': new Set<UuCardKind>([
    ...BASICS,
    'queen-bee-unicorn', 'seductive-unicorn', 'rainbow-unicorn', 'nanny-cam', 'sadistic-ritual', 'slowdown', 'yay',
    'mother-goose-unicorn', 'necromancer-unicorn',
  ]),
  base: new Set<UuCardKind>([
    ...BASICS,
    'extremely-fertile-unicorn', 'seductive-unicorn', 'nanny-cam', 'queen-bee-unicorn', 'sadistic-ritual', 'slowdown', 'yay',
  ]),
};

export function dealUuSetup(
  seats: Seat[],
  rng: RngState,
  config?: UuConfig,
): {
  deck: UuCard[];
  nursery: UuCard[];
  hands: Record<string, UuCard[]>;
  vault: UuCard[];
} {
  const edition: UuEdition = config?.edition ?? 'base-2nd';
  const expansions: readonly UuExpansionId[] = config?.expansions ?? [];

  let nextId = 1;
  const babies: UuCard[] = [];

  // Travel edition uses 8 Baby Unicorns (or seat count if > 8), other editions use all 13 base babies
  const baseBabies = edition === 'travel' ? UU_BABY_DEFS.slice(0, Math.max(8, seats.length)) : UU_BABY_DEFS;
  for (const def of baseBabies) {
    for (let i = 0; i < def.count; i++) {
      babies.push({
        id: nextId++,
        kind: def.kind,
        name: def.name,
        type: def.type,
        text: def.text,
        source: def.source,
      });
    }
  }

  // Add expansion Baby Unicorns
  for (const def of UU_EXPANSION_DEFS) {
    if (def.type === 'babyUnicorn' && def.source && expansions.includes(def.source as UuExpansionId)) {
      for (let i = 0; i < def.count; i++) {
        babies.push({
          id: nextId++,
          kind: def.kind,
          name: def.name,
          type: def.type,
          text: def.text,
          source: def.source,
        });
      }
    }
  }

  // Every Baby Unicorn starts in the Nursery: each player then *chooses* one for
  // their Stable (2nd Edition rulesheet, "How To Start") — see createInitialState.
  const nursery = shuffle(rng, babies);

  // Build main deck based on edition
  const mainDefs: UuCardDef[] = [];
  if (edition === 'base') {
    // Original Base Deck (Second Print inventory, 135 cards): the nine 2nd-Edition-only
    // kinds (wiki "Cards In This Deck", ♦) are swapped for the nine retired classics.
    const replacedIn1st = new Set<UuCardKind>([
      'dark-angel-unicorn',
      'mother-goose-unicorn',
      'necromancer-unicorn',
      'unicorn-oracle',
      'kiss-of-life',
      'caffeine-overload',
      'claw-machine',
      'rainbow-lasso',
      'stable-artillery',
    ]);
    for (const def of UU_MAIN_DECK_DEFS) {
      if (!replacedIn1st.has(def.kind)) {
        mainDefs.push(def);
      }
    }
    mainDefs.push(...UU_FIRST_EDITION_DEFS);
  } else if (edition === 'travel') {
    // Travel Edition: compact portable deck (~74 main deck cards)
    for (const def of UU_MAIN_DECK_DEFS) {
      if (def.type === 'basicUnicorn') {
        mainDefs.push({ ...def, count: Math.min(2, def.count) });
      } else if (def.kind === 'neigh') {
        mainDefs.push({ ...def, count: 10 });
      } else {
        mainDefs.push({ ...def, count: Math.min(1, def.count) });
      }
    }
    mainDefs.push(...UU_TRAVEL_EDITION_DEFS);
  } else {
    mainDefs.push(...UU_MAIN_DECK_DEFS);
    if (edition === 'control') {
      mainDefs.push(...UU_CONTROL_EDITION_DEFS);
    } else if (edition === 'chaos') {
      mainDefs.push(...UU_CHAOS_EDITION_DEFS);
    } else if (edition === 'nsfw') {
      for (const def of UU_EXPANSION_DEFS) {
        if (def.source === 'nsfw' && def.type !== 'babyUnicorn') {
          mainDefs.push(def);
        }
      }
    }
  }

  // Add selected Expansion main-deck cards
  for (const def of UU_EXPANSION_DEFS) {
    if (def.type !== 'babyUnicorn' && def.source && expansions.includes(def.source as UuExpansionId)) {
      mainDefs.push(def);
    }
  }

  const twoPlayer = seats.length === 2 && config?.twoPlayerRules !== false;
  // The Diamond Edition deck is the 2nd Edition deck card for card, and its
  // rulesheet points to the same 2-player rules.
  const rulesDeck: UuEdition = edition === 'diamond' ? 'base-2nd' : edition;
  const removed = twoPlayer ? TWO_PLAYER_REMOVALS[rulesDeck] : undefined;

  const pool: UuCard[] = [];
  for (const def of mainDefs) {
    if (removed?.has(def.kind)) continue;
    for (let i = 0; i < def.count; i++) {
      pool.push({
        id: nextId++,
        kind: def.kind,
        name: def.name,
        type: def.type,
        text: def.text,
        source: def.source,
      });
    }
  }

  // 2-player rules (2nd Edition rulesheet): "Before shuffling the deck, take out
  // two Neigh cards and hand one to each player", then deal 5 as usual.
  const hands: Record<string, UuCard[]> = {};
  for (const seat of seats) hands[seat.id] = [];
  if (twoPlayer && rulesDeck === 'base-2nd') {
    for (const seat of seats) {
      const i = pool.findIndex((c) => c.kind === 'neigh');
      if (i >= 0) hands[seat.id]!.push(pool.splice(i, 1)[0]!);
    }
  }

  const shuffledDeck = shuffle(rng, pool);
  let cursor = 0;
  for (const seat of seats) {
    hands[seat.id]!.push(...shuffledDeck.slice(cursor, cursor + 5));
    cursor += 5;
  }
  const deck = shuffledDeck.slice(cursor);

  const vault: UuCard[] = [];
  if (edition === 'diamond') {
    for (const def of UU_DIAMOND_EDITION_DEFS) {
      for (let i = 0; i < def.count; i++) {
        vault.push({ id: nextId++, kind: def.kind, name: def.name, type: def.type, text: def.text, source: def.source });
      }
    }
  }

  return { deck, nursery, hands, vault };
}
