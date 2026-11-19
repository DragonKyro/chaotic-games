// Doomlings — Castle Glass (Bolster expansion, 2025): 30 traits, 7 Dominants,
// 2 Ages and 1 Catastrophe — the 40 cards numbered "xx/40 | CSGL".
//
// Source: doomlings-atlas assets/doomlings/castle-glass/cards.json (names,
// colours, face values, Dominant flags, Gene Pool, icons, class labels) and
// rules/castle-glass.md (the rules card: contents and class-bonus scoring).
// Left out: Luminous and Radiant — the atlas files them under Castle Glass,
// but their cards are printed "Special Edition | CSGL" and aren't among the 40.
// `text` is our own plain-English summary of each effect.

import type { AgeSeed, CatastropheSeed, TraitSeed } from '../cards';

export const CASTLE_GLASS_TRAITS: readonly TraitSeed[] = [
  { k: 'aposematic', name: 'Aposematic', color: 'colorless', points: 1, action: true, cls: 'fish', text: 'Action: draw 1, then play another trait.' },
  { k: 'banal', name: 'Banal', color: 'green', secondaryColor: 'red', points: 1, effectless: true, cls: 'fish', text: '' },
  { k: 'benthic', name: 'Benthic', color: 'purple', points: 1, action: true, cls: 'fish', text: 'Action: you may discard 1 card from your hand to play another trait.' },
  { k: 'biochromatic', name: 'Biochromatic', color: 'green', points: 2, action: true, cls: 'coral', text: 'Action: every opponent discards all colorless cards from their hand, then stabilizes.' },
  { k: 'black-and-blue', name: 'Black and Blue', color: 'blue', secondaryColor: 'green', points: 1, effectless: true, cls: 'fish', tier: 'curious', text: '' },
  { k: 'brainy', name: 'Brainy', color: 'colorless', points: 3, action: true, cls: 'coral', text: 'Action: your opponents can’t play purple traits on their next turn.' },
  { k: 'buttery-fins', name: 'Buttery Fins', color: 'blue', points: 1, effectless: true, cls: 'fish', tier: 'exotic', text: '' },
  { k: 'conchomancy', name: 'Conchomancy', color: 'red', points: 0, playWhen: true, cls: 'shell', tier: 'curious', text: 'Play at any time: peek at the next age.' },
  { k: 'copper-band', name: 'Copper Band', color: 'red', points: 1, action: true, cls: 'fish', text: 'Action: play another trait with face value 1.' },
  { k: 'countershading', name: 'Countershading', color: 'purple', secondaryColor: 'red', points: 1, playWhen: true, cls: 'fish', text: 'You may play this instead of stabilizing to end your turn.' },
  { k: 'crystal-skeleton', name: 'Crystal Skeleton', color: 'purple', points: 2, action: true, cls: 'coral', text: 'Action: every player (you too) discards all Dominants from their hand, then stabilizes.' },
  { k: 'fish-collector', name: 'Fish Collector', color: 'blue', secondaryColor: 'purple', points: 0, action: true, text: 'Action: steal a face-value-1 trait from up to two different opponents’ piles.' },
  { k: 'fragmentation', name: 'Fragmentation', color: 'red', points: -1, action: true, cls: 'coral', tier: 'curious', text: 'Action: stabilize to 4, then play another trait.' },
  { k: 'glass-predator', name: 'Glass Predator', color: 'purple', points: -3, action: true, cls: 'fish', text: 'Action: steal a trait from an opponent’s pile, then play another trait.' },
  { k: 'glossy', name: 'Glossy', color: 'purple', points: 2, effectless: true, cls: 'shell', text: '' },
  { k: 'guanine-crystals', name: 'Guanine Crystals', color: 'colorless', points: 1, action: true, cls: 'fish', tier: 'curious', text: 'Action: at the end of this turn, draw 2 instead of stabilizing.' },
  { k: 'harboring', name: 'Harboring', color: 'green', points: 1, action: true, cls: 'coral', tier: 'curious', text: 'Action: stabilize to 6 at the end of this turn.' },
  { k: 'keystone', name: 'Keystone', color: 'purple', points: 5, dominant: true, effectless: true, cls: 'coral', tier: 'exotic', text: '' },
  { k: 'mucous-coating', name: 'Mucous Coating', color: 'blue', points: 1, cls: 'fish', text: '+3 if you have a Coral in your pile.' },
  { k: 'natural-symmetry', name: 'Natural Symmetry', color: 'blue', points: 3, action: true, cls: 'shell', text: 'Action: every player previews the next age.' },
  { k: 'opulent', name: 'Opulent', color: 'purple', secondaryColor: 'red', points: 3, dominant: true, cls: 'fish', tier: 'exotic', text: 'When played: draw 1, then play another trait.' },
  { k: 'pearl', name: 'Pearl', color: 'colorless', points: 0, dominant: true, cls: 'shell', tier: 'exotic', text: 'When played: you may play 1 trait of each colour from your hand, ignoring their Actions.' },
  { k: 'pip', name: 'Pip', color: 'red', points: 0, dominant: true, cls: 'shell', text: 'When played: choose a face value, then play every trait of that face value from your hand, ignoring their Actions.' },
  { k: 'porous', name: 'Porous', color: 'purple', points: 0, genePoolDelta: 1, cls: 'shell', tier: 'curious', text: '+1 Gene Pool.' },
  { k: 'pteridines', name: 'Pteridines', color: 'green', points: 1, action: true, cls: 'fish', text: 'Action: draw 1. You may play it now.' },
  { k: 'radial-symmetry', name: 'Radial Symmetry', color: 'blue', points: 3, dominant: true, cls: 'coral', tier: 'curious', text: 'At the start of each of your turns you may discard every card of one colour from your hand.' },
  { k: 'resplendent', name: 'Resplendent', color: 'blue', secondaryColor: 'green', points: 1, dominant: true, genePoolDelta: 1, cls: 'fish', tier: 'exotic', text: '+1 Gene Pool. When played: play another trait.' },
  { k: 'sandy', name: 'Sandy', color: 'blue', points: 1, action: true, cls: 'shell', tier: 'exotic', text: 'Action: put the next age at the bottom of the age deck.' },
  { k: 'sea-glass', name: 'Sea Glass', color: 'green', points: 1, playWhen: true, cls: 'shell', text: 'You may play this at any time.' },
  { k: 'spiny-fins', name: 'Spiny Fins', color: 'red', points: 1, action: true, cls: 'fish', tier: 'curious', text: 'Action: play another trait, then discard it (a Dominant stays).' },
  { k: 'spiral-dome', name: 'Spiral Dome', color: 'colorless', points: 1, action: true, cls: 'shell', tier: 'curious', text: 'Action: draw 2.' },
  { k: 'spiral-motion', name: 'Spiral Motion', color: 'green', points: 1, action: true, cls: 'fish', text: 'Action: play another trait, then return it to your hand (a Dominant stays). Only once a turn.' },
  { k: 'striated', name: 'Striated', color: 'green', points: 3, effectless: true, cls: 'shell', text: '' },
  { k: 'sunny', name: 'Sunny', color: 'green', points: 3, dominant: true, playWhen: true, text: 'Play at any time: stabilize to 8.' },
  { k: 'tabular', name: 'Tabular', color: 'colorless', points: 2, effectless: true, cls: 'coral', tier: 'exotic', text: '' },
  { k: 'thermal-tolerance', name: 'Thermal Tolerance', color: 'red', points: -1, dropOfLife: true, worldsEnd: true, cls: 'coral', text: 'World’s End: choose an opponent. +1 for each red trait in their pile.' },
  { k: 'tidal-tolerance', name: 'Tidal Tolerance', color: 'blue', points: -1, dropOfLife: true, worldsEnd: true, cls: 'coral', text: 'World’s End: choose an opponent. +1 for each blue trait in their pile.' },
];

export const CASTLE_GLASS_AGES: readonly AgeSeed[] = [
  { name: 'Castle Glass', ruleTag: 'castleGlass', text: 'Discard 2 cards from your hand — not Shells, Corals or Fish — then draw 2.' },
  { name: 'Magic Hour', ruleTag: 'magicHour', text: 'Draw 2 — or set your Gene Pool to 5.' },
];

export const CASTLE_GLASS_CATASTROPHES: readonly CatastropheSeed[] = [
  { name: 'Still Water', tag: 'stillWater', genePoolDelta: -2, text: 'Draw 3. Nobody stabilizes at the end of their turn this round.', worldsEndText: '+8 if your Gene Pool is 1.' },
];
