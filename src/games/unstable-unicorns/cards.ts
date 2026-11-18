// Unstable Unicorns — 2nd Edition Base Deck (127 playable cards + 8 reference cards = 135).
// All card counts and 2nd Edition rulebook texts verified against the Unstable Games Wiki.

import type { RngState } from '@/core/rng';
import { shuffle } from '@/core/rng';
import type { Seat } from '@/core/types';
import type { UuCard, UuCardKind, UuCardType } from './types';

export interface UuCardDef {
  kind: UuCardKind;
  name: string;
  type: UuCardType;
  count: number;
  text: string;
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
    text: "When this card enters your Stable, you may return a card in another player's Stable to their hand.",
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

export const FLYER_KINDS: readonly UuCardKind[] = [
  'annoying-flying-unicorn',
  'greedy-flying-unicorn',
  'magical-flying-unicorn',
  'majestic-flying-unicorn',
  'swift-flying-unicorn',
];

export function isFlyerKind(kind: UuCardKind): boolean {
  return FLYER_KINDS.includes(kind);
}

export function isNarwhalCard(card: UuCard): boolean {
  return card.name.toLowerCase().includes('narwhal');
}

export function isNeighCard(card: UuCard): boolean {
  return card.kind === 'neigh' || card.kind === 'super-neigh';
}

export function dealUuSetup(seats: Seat[], rng: RngState): {
  deck: UuCard[];
  nursery: UuCard[];
  hands: Record<string, UuCard[]>;
  startingBabies: Record<string, UuCard>;
} {
  let nextId = 1;
  const babies: UuCard[] = [];
  for (const def of UU_BABY_DEFS) {
    for (let i = 0; i < def.count; i++) {
      babies.push({
        id: nextId++,
        kind: def.kind,
        name: def.name,
        type: def.type,
        text: def.text,
      });
    }
  }
  const shuffledBabies = shuffle(rng, babies);
  const startingBabies: Record<string, UuCard> = {};
  seats.forEach((seat, idx) => {
    const b = shuffledBabies[idx];
    if (b) startingBabies[seat.id] = b;
  });
  const nursery = shuffledBabies.slice(seats.length);

  const pool: UuCard[] = [];
  for (const def of UU_MAIN_DECK_DEFS) {
    for (let i = 0; i < def.count; i++) {
      pool.push({
        id: nextId++,
        kind: def.kind,
        name: def.name,
        type: def.type,
        text: def.text,
      });
    }
  }
  const shuffledDeck = shuffle(rng, pool);
  const hands: Record<string, UuCard[]> = {};
  let cursor = 0;
  for (const seat of seats) {
    hands[seat.id] = shuffledDeck.slice(cursor, cursor + 5);
    cursor += 5;
  }
  const deck = shuffledDeck.slice(cursor);

  return { deck, nursery, hands, startingBabies };
}
