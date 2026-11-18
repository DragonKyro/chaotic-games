// Doomlings — verified Base Game deck (Birth of Life, 25 Ages, 15 Catastrophes, and 113 Trait cards).

import type { RngState } from '@/core/rng';
import { shuffle } from '@/core/rng';
import type { DmAgeCard, DmTraitCard, DmTraitColor } from './types';

export const DM_BIRTH_OF_LIFE: Omit<DmAgeCard, 'id'> = {
  name: 'The Birth of Life',
  kind: 'birthOfLife',
  genePoolDelta: 0,
  ruleTag: 'none',
  text: 'Play 1 trait per turn and stabilize your hand to your Gene Pool size. If you start your turn with 0 cards, draw 3 cards and end your turn.',
};

export const DM_AGE_DEFS: readonly Omit<DmAgeCard, 'id'>[] = [
  { name: 'Tropical Lands', kind: 'age', genePoolDelta: 0, ruleTag: 'noColorless', text: 'Players cannot play Colorless traits this round.' },
  { name: 'Arid Lands', kind: 'age', genePoolDelta: 0, ruleTag: 'noBlue', text: 'Players cannot play Blue traits this round.' },
  { name: 'Tectonic Shift', kind: 'age', genePoolDelta: 0, ruleTag: 'noGreen', text: 'Players cannot play Green traits this round.' },
  { name: 'Lunar Eclipse', kind: 'age', genePoolDelta: 0, ruleTag: 'noRed', text: 'Players cannot play Red traits this round.' },
  { name: 'Solar Flare', kind: 'age', genePoolDelta: 0, ruleTag: 'noPurple', text: 'Players cannot play Purple traits this round.' },
  { name: 'Age of Peace', kind: 'age', genePoolDelta: 0, ruleTag: 'ignoreActions', text: 'Ignore all Trait Actions (A) this round.' },
  { name: 'Glacial Drift', kind: 'age', genePoolDelta: 0, ruleTag: 'maxFaceValue3', text: 'Players cannot play traits with a face value greater than 3 this round.' },
  { name: 'Reforestation', kind: 'age', genePoolDelta: 0, ruleTag: 'protectTraitPiles', text: 'Traits in Trait Piles cannot be swapped, stolen, or destroyed this round.' },
  { name: 'Age of Wonder', kind: 'age', genePoolDelta: 0, ruleTag: 'stabilizeTo4', text: 'Players stabilize to 4 cards at the end of their turn this round.' },
  { name: 'Prosperity', kind: 'age', genePoolDelta: 1, ruleTag: 'plusOneGenePoolPerm', text: 'All players gain +1 Gene Pool.' },
  { name: 'Age of Reason', kind: 'age', genePoolDelta: 0, ruleTag: 'allDraw1', text: 'Each player draws 1 card at the start of this round.' },
  { name: 'Comet Showers', kind: 'age', genePoolDelta: 0, ruleTag: 'allDiscard1', text: 'Each player discards 1 card from their hand at the start of this round.' },
  { name: 'The Awakening', kind: 'age', genePoolDelta: 0, ruleTag: 'allDraw1', text: 'Each player draws 1 card as consciousness dawns.' },
  { name: 'Northern Winds', kind: 'age', genePoolDelta: 0, ruleTag: 'allDraw1', text: 'Favorable winds: each player draws 1 card.' },
  { name: 'Continental Drift', kind: 'age', genePoolDelta: 0, ruleTag: 'none', text: 'The continents part peacefully. Normal rules apply.' },
  { name: 'Lush Archipelago', kind: 'age', genePoolDelta: 0, ruleTag: 'allDraw1', text: 'Abundant islands: each player draws 1 card.' },
  { name: 'Volcanic Vents', kind: 'age', genePoolDelta: 0, ruleTag: 'noBlue', text: 'Boiling seas: players cannot play Blue traits this round.' },
  { name: 'Frozen Tundra', kind: 'age', genePoolDelta: 0, ruleTag: 'noGreen', text: 'Deep frost: players cannot play Green traits this round.' },
  { name: 'Crimson Sky', kind: 'age', genePoolDelta: 0, ruleTag: 'noPurple', text: 'Players cannot play Purple traits this round.' },
  { name: ' Twilight Mist', kind: 'age', genePoolDelta: 0, ruleTag: 'noRed', text: 'Players cannot play Red traits this round.' },
  { name: 'Harmony', kind: 'age', genePoolDelta: 0, ruleTag: 'ignoreActions', text: 'Ignore all Trait Actions (A) this round.' },
  { name: 'Sanctuary', kind: 'age', genePoolDelta: 0, ruleTag: 'protectTraitPiles', text: 'Traits in Trait Piles cannot be stolen or destroyed this round.' },
  { name: 'Bountiful Harvest', kind: 'age', genePoolDelta: 1, ruleTag: 'plusOneGenePoolPerm', text: 'All players gain +1 Gene Pool.' },
  { name: 'Meteor Shower', kind: 'age', genePoolDelta: 0, ruleTag: 'allDiscard1', text: 'Each player discards 1 card from their hand.' },
  { name: 'Mini Ice Age', kind: 'age', genePoolDelta: 0, ruleTag: 'maxFaceValue3', text: 'Players may only play traits with face value 3 or less this round.' },
];

export const DM_CATASTROPHE_DEFS: readonly Omit<DmAgeCard, 'id'>[] = [
  {
    name: 'Super Volcano',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'discardHandPerBlue',
    worldsEndEffect: 'minus1PerBlue',
    text: '-1 Gene Pool. Discard 1 card from your hand for each Blue trait in your Trait Pile.',
    worldsEndText: "World's End: -1 point for each Blue trait in your Trait Pile.",
  },
  {
    name: 'Retrovirus',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'discardHandPerGreen',
    worldsEndEffect: 'minus1PerGreen',
    text: '-1 Gene Pool. Discard 1 card from your hand for each Green trait in your Trait Pile.',
    worldsEndText: "World's End: -1 point for each Green trait in your Trait Pile.",
  },
  {
    name: 'Ice Age',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'discardHandPerRed',
    worldsEndEffect: 'minus1PerRed',
    text: '-1 Gene Pool. Discard 1 card from your hand for each Red trait in your Trait Pile.',
    worldsEndText: "World's End: -1 point for each Red trait in your Trait Pile.",
  },
  {
    name: 'Mass Extinction',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'discardHandPerPurple',
    worldsEndEffect: 'minus1PerPurple',
    text: '-1 Gene Pool. Discard 1 card from your hand for each Purple trait in your Trait Pile.',
    worldsEndText: "World's End: -1 point for each Purple trait in your Trait Pile.",
  },
  {
    name: 'Overpopulation',
    kind: 'catastrophe',
    genePoolDelta: 1,
    ruleTag: 'none',
    catastropheEffect: 'drawPerColorType',
    worldsEndEffect: 'plus4FewestTraits',
    text: '+1 Gene Pool. Draw 1 card for every color in your Trait Pile.',
    worldsEndText: "World's End: +4 points to the player(s) with the fewest traits in their Trait Pile.",
  },
  {
    name: 'Grey Goo',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'sacrificeOneTrait',
    worldsEndEffect: 'minus5MostTraits',
    text: '-1 Gene Pool. Discard 1 non-Dominant trait from your Trait Pile.',
    worldsEndText: "World's End: -5 points to the player(s) with the most traits in their Trait Pile.",
  },
  {
    name: 'AI Takeover',
    kind: 'catastrophe',
    genePoolDelta: 0,
    ruleTag: 'none',
    catastropheEffect: 'discardAndRedrawGenePool',
    worldsEndEffect: 'plus1PerColorless',
    text: 'Discard your hand and draw cards equal to your Gene Pool.',
    worldsEndText: "World's End: +1 point for each Colorless trait in your Trait Pile.",
  },
  {
    name: 'Deus Ex Machina',
    kind: 'catastrophe',
    genePoolDelta: 1,
    ruleTag: 'none',
    catastropheEffect: 'drawPerColorType',
    worldsEndEffect: 'plus2PerDominant',
    text: '+1 Gene Pool. Draw 1 card for every color in your Trait Pile.',
    worldsEndText: "World's End: +2 points for each Dominant trait in your Trait Pile.",
  },
  {
    name: 'Planetary Impact',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'sacrificeOneTrait',
    worldsEndEffect: 'minus5MostTraits',
    text: '-1 Gene Pool. Discard 1 non-Dominant trait from your Trait Pile.',
    worldsEndText: "World's End: -5 points to the player(s) with the most traits in their Trait Pile.",
  },
  {
    name: 'The Bigucky',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'discardAndRedrawGenePool',
    worldsEndEffect: 'plus4FewestTraits',
    text: '-1 Gene Pool. Discard your hand and draw cards equal to your Gene Pool.',
    worldsEndText: "World's End: +4 points to the player(s) with the fewest traits.",
  },
  {
    name: 'Solar Storm',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'discardHandPerRed',
    worldsEndEffect: 'minus1PerRed',
    text: '-1 Gene Pool. Discard 1 card from your hand for each Red trait.',
    worldsEndText: "World's End: -1 point for each Red trait.",
  },
  {
    name: 'Deep Freeze',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'discardHandPerBlue',
    worldsEndEffect: 'minus1PerBlue',
    text: '-1 Gene Pool. Discard 1 card from your hand for each Blue trait.',
    worldsEndText: "World's End: -1 point for each Blue trait.",
  },
  {
    name: 'Blight',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'discardHandPerGreen',
    worldsEndEffect: 'minus1PerGreen',
    text: '-1 Gene Pool. Discard 1 card from your hand for each Green trait.',
    worldsEndText: "World's End: -1 point for each Green trait.",
  },
  {
    name: 'Miasma',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'discardHandPerPurple',
    worldsEndEffect: 'minus1PerPurple',
    text: '-1 Gene Pool. Discard 1 card from your hand for each Purple trait.',
    worldsEndText: "World's End: -1 point for each Purple trait.",
  },
  {
    name: 'The Four Horsemen',
    kind: 'catastrophe',
    genePoolDelta: -1,
    ruleTag: 'none',
    catastropheEffect: 'sacrificeOneTrait',
    worldsEndEffect: 'plus2PerDominant',
    text: '-1 Gene Pool. Discard 1 non-Dominant trait from your Trait Pile.',
    worldsEndText: "World's End: +2 points for each Dominant trait in your Trait Pile.",
  },
];

type TraitSeed = Omit<DmTraitCard, 'id'> & { copies?: number };

const TRAIT_SEEDS: readonly TraitSeed[] = [
  // Dominant Traits (17)
  {
    kind: 'apex-predator',
    name: 'Apex Predator',
    color: 'red',
    points: 4,
    dominant: true,
    genePoolDelta: 0,
    dropOfLifeTag: 'apexPredatorMostTraits',
    text: 'Dominant: +4 points if you have more traits in your Trait Pile than any opponent.',
  },
  {
    kind: 'hyper-intelligence',
    name: 'Hyper-Intelligence',
    color: 'red',
    points: 4,
    dominant: true,
    genePoolDelta: 0,
    worldsEndTag: 'hyperIntelligenceDiscardColor',
    text: "Dominant: At World's End, choose a color. Opponents discard 1 non-Dominant trait of that color.",
  },
  {
    kind: 'carnosaur-jaw',
    name: 'Carnosaur Jaw',
    color: 'red',
    points: 9,
    dominant: true,
    genePoolDelta: -1,
    requireTraitCount: 3,
    text: 'Dominant: Requires 3+ traits in your Trait Pile. -1 Gene Pool.',
  },
  {
    kind: 'pack-behavior',
    name: 'Pack Behavior',
    color: 'green',
    points: 3,
    dominant: true,
    genePoolDelta: 0,
    dropOfLifeTag: 'perColorPair',
    text: 'Dominant: +1 point for every pair of Red/Green/Blue/Purple traits in your Trait Pile.',
  },
  {
    kind: 'symbiosis',
    name: 'Symbiosis',
    color: 'green',
    points: 3,
    dominant: true,
    genePoolDelta: 0,
    dropOfLifeTag: 'symbiosisLowestColor',
    text: 'Dominant: +2 points for each trait of your least-common color (if you have at least 2 colors).',
  },
  {
    kind: 'heroic',
    name: 'Heroic',
    color: 'green',
    points: 7,
    dominant: true,
    genePoolDelta: 1,
    requireColor: 'green',
    text: 'Dominant: Requires a Green trait in your Trait Pile. +1 Gene Pool.',
  },
  {
    kind: 'tiny',
    name: 'Tiny',
    color: 'blue',
    points: 11,
    dominant: true,
    genePoolDelta: 0,
    dropOfLifeTag: 'perColorless',
    dropOfLifeMultiplier: -1,
    text: 'Dominant: High base points (11), -1 for each Colorless trait in your Trait Pile.',
  },
  {
    kind: 'echolocation',
    name: 'Echolocation',
    color: 'blue',
    points: 4,
    dominant: true,
    genePoolDelta: 0,
    dropOfLifeTag: 'perBlue',
    dropOfLifeMultiplier: 1,
    text: 'Dominant: +1 point for each Blue trait in your Trait Pile.',
  },
  {
    kind: 'immunity',
    name: 'Immunity',
    color: 'blue',
    points: 4,
    dominant: true,
    genePoolDelta: 0,
    dropOfLifeTag: 'perHandCard',
    dropOfLifeMultiplier: 1,
    text: 'Dominant: +1 point for each card in your hand at the end of the game.',
  },
  {
    kind: 'camouflage',
    name: 'Camouflage',
    color: 'purple',
    points: 2,
    dominant: true,
    genePoolDelta: 1,
    dropOfLifeTag: 'perHandCard',
    dropOfLifeMultiplier: 1,
    text: 'Dominant: +1 Gene Pool. Drop of Life: +1 point for each card in your hand.',
  },
  {
    kind: 'vampirism',
    name: 'Vampirism',
    color: 'purple',
    points: 3,
    dominant: true,
    genePoolDelta: 0,
    actionTag: 'vampirismSteal',
    text: "Dominant: Steal a non-Dominant trait from an opponent's Trait Pile.",
  },
  {
    kind: 'viral',
    name: 'Viral',
    color: 'purple',
    points: 2,
    dominant: true,
    genePoolDelta: 0,
    worldsEndTag: 'viralPenaltyColor',
    text: "Dominant: At World's End, choose a color. Opponents get -1 point for each trait of that color.",
  },
  {
    kind: 'denial',
    name: 'Denial',
    color: 'colorless',
    points: 4,
    dominant: true,
    genePoolDelta: 0,
    text: 'Dominant: Ignore the next Catastrophe (including its Gene Pool penalty).',
  },
  {
    kind: 'faith',
    name: 'Faith',
    color: 'colorless',
    points: 4,
    dominant: true,
    genePoolDelta: 0,
    worldsEndTag: 'faithChangeColor',
    text: "Dominant: At World's End, change all of your traits of 1 color into another color.",
  },
  {
    kind: 'sentience',
    name: 'Sentience',
    color: 'colorless',
    points: 2,
    dominant: true,
    genePoolDelta: 0,
    dropOfLifeTag: 'colorVariety',
    text: 'Dominant: +2 points for each distinct color in your Trait Pile.',
  },
  {
    kind: 'motley',
    name: 'Motley',
    color: 'colorless',
    points: 4,
    dominant: true,
    genePoolDelta: 0,
    isAllColors: true,
    text: 'Dominant: Counts as Red, Blue, Green, and Purple simultaneously!',
  },
  {
    kind: 'ruggedized',
    name: 'Ruggedized',
    color: 'colorless',
    points: 4,
    dominant: true,
    genePoolDelta: 1,
    text: 'Dominant: +1 Gene Pool.',
  },

  // Red Traits (24)
  { kind: 'heat-vision', name: 'Heat Vision', color: 'red', points: 1, dominant: false, genePoolDelta: 0, dropOfLifeTag: 'perRed', dropOfLifeMultiplier: 1, copies: 2, text: 'Drop of Life: +1 point for each Red trait in your Trait Pile.' },
  { kind: 'territorial', name: 'Territorial', color: 'red', points: 1, dominant: false, genePoolDelta: 0, actionTag: 'destroyOpponentTrait', copies: 2, text: "Action: Discard a Red or non-Dominant trait from an opponent's Trait Pile." },
  { kind: 'fangs', name: 'Fangs', color: 'red', points: 2, dominant: false, genePoolDelta: 0, actionTag: 'discardFromHand1', copies: 2, text: 'Action: Discard 1 card from your hand.' },
  { kind: 'horns', name: 'Horns', color: 'red', points: 3, dominant: false, genePoolDelta: 0, copies: 3, text: 'Fierce horns.' },
  { kind: 'talons', name: 'Talons', color: 'red', points: 2, dominant: false, genePoolDelta: 0, actionTag: 'stealRandomHandCard', copies: 2, text: "Action: Steal 1 random card from an opponent's hand." },
  { kind: 'warm-blood', name: 'Warm Blood', color: 'red', points: 2, dominant: false, genePoolDelta: 1, copies: 2, text: '+1 Gene Pool.' },
  { kind: 'brute-strength', name: 'Brute Strength', color: 'red', points: 4, dominant: false, genePoolDelta: -1, copies: 2, text: 'High points (4), -1 Gene Pool.' },
  { kind: 'fire-skin', name: 'Fire Skin', color: 'red', points: 3, dominant: false, genePoolDelta: 0, copies: 3, text: 'Glowing scales.' },
  { kind: 'adrenaline', name: 'Adrenaline', color: 'red', points: 1, dominant: false, genePoolDelta: 0, actionTag: 'playExtraTrait', copies: 2, text: 'Action: Play another trait from your hand.' },
  { kind: 'reckless', name: 'Reckless', color: 'red', points: 3, dominant: false, genePoolDelta: 0, actionTag: 'discardFromHand2', copies: 2, text: 'Action: Discard 2 cards from your hand.' },
  { kind: 'endurance', name: 'Endurance', color: 'red', points: 2, dominant: false, genePoolDelta: 1, copies: 2, text: '+1 Gene Pool.' },

  // Blue Traits (24)
  { kind: 'gills', name: 'Gills', color: 'blue', points: 1, dominant: false, genePoolDelta: 1, copies: 2, text: '+1 Gene Pool.' },
  { kind: 'blubber', name: 'Blubber', color: 'blue', points: 4, dominant: false, genePoolDelta: -1, copies: 2, text: 'Thick insulation (4 pts), -1 Gene Pool.' },
  { kind: 'tentacles', name: 'Tentacles', color: 'blue', points: 1, dominant: false, genePoolDelta: 0, actionTag: 'stealTrait', copies: 2, text: 'Action: Steal a low-value trait from an opponent.' },
  { kind: 'cold-blood', name: 'Cold Blood', color: 'blue', points: 1, dominant: false, genePoolDelta: 0, actionTag: 'draw2', copies: 2, text: 'Action: Draw 2 cards.' },
  { kind: 'iridescent-scales', name: 'Iridescent Scales', color: 'blue', points: 1, dominant: false, genePoolDelta: 0, dropOfLifeTag: 'perBlue', dropOfLifeMultiplier: 1, copies: 2, text: 'Drop of Life: +1 point for each Blue trait in your Trait Pile.' },
  { kind: 'echidna-spines', name: 'Spines', color: 'blue', points: 2, dominant: false, genePoolDelta: 0, copies: 3, text: 'Defensive spines.' },
  { kind: 'webbed-feet', name: 'Webbed Feet', color: 'blue', points: 2, dominant: false, genePoolDelta: 0, actionTag: 'draw1', copies: 3, text: 'Action: Draw 1 card.' },
  { kind: 'deep-diver', name: 'Deep Diver', color: 'blue', points: 2, dominant: false, genePoolDelta: 0, actionTag: 'takeFromDiscard1', copies: 2, text: 'Action: Take 1 card from the discard pile into your hand.' },
  { kind: 'sweat', name: 'Sweat', color: 'blue', points: 2, dominant: false, genePoolDelta: 0, actionTag: 'discardFromHand1', copies: 2, text: 'Action: Discard 1 card from your hand.' },
  { kind: 'flight', name: 'Flight', color: 'blue', points: 3, dominant: false, genePoolDelta: 0, copies: 2, text: 'Soar above predators.' },
  { kind: 'aquatic', name: 'Aquatic', color: 'blue', points: 2, dominant: false, genePoolDelta: 1, copies: 2, text: '+1 Gene Pool.' },

  // Green Traits (24)
  { kind: 'photosynthesis', name: 'Photosynthesis', color: 'green', points: 1, dominant: false, genePoolDelta: 0, dropOfLifeTag: 'perGreen', dropOfLifeMultiplier: 1, copies: 2, text: 'Drop of Life: +1 point for each Green trait in your Trait Pile.' },
  { kind: 'bark', name: 'Bark', color: 'green', points: 3, dominant: false, genePoolDelta: 0, copies: 3, text: 'Tough outer bark.' },
  { kind: 'branches', name: 'Branches', color: 'green', points: 1, dominant: false, genePoolDelta: 0, dropOfLifeTag: 'perColorPair', copies: 2, text: 'Drop of Life: +1 point for every pair of colored traits in your Trait Pile.' },
  { kind: 'leaves', name: 'Leaves', color: 'green', points: 2, dominant: false, genePoolDelta: 1, copies: 2, text: '+1 Gene Pool.' },
  { kind: 'roots', name: 'Roots', color: 'green', points: 2, dominant: false, genePoolDelta: 0, indestructible: true, copies: 2, text: 'This trait cannot be stolen or destroyed.' },
  { kind: 'pollinator', name: 'Pollinator', color: 'green', points: 1, dominant: false, genePoolDelta: 0, actionTag: 'playExtraTrait', copies: 2, text: 'Action: Play another trait from your hand.' },
  { kind: 'overgrowth', name: 'Overgrowth', color: 'green', points: 1, dominant: false, genePoolDelta: 0, actionTag: 'draw2', copies: 2, text: 'Action: Draw 2 cards.' },
  { kind: 'thorns', name: 'Thorns', color: 'green', points: 2, dominant: false, genePoolDelta: 0, actionTag: 'destroyOpponentTrait', copies: 2, text: "Action: Discard a non-Dominant trait from an opponent's Trait Pile." },
  { kind: 'spores', name: 'Spores', color: 'green', points: 1, dominant: false, genePoolDelta: 1, copies: 2, text: '+1 Gene Pool.' },
  { kind: 'nectar', name: 'Nectar', color: 'green', points: 3, dominant: false, genePoolDelta: 0, copies: 3, text: 'Sweet nectar.' },
  { kind: 'self-replicating', name: 'Self-Replicating', color: 'green', points: 2, dominant: false, genePoolDelta: 0, actionTag: 'draw1', copies: 2, text: 'Action: Draw 1 card.' },

  // Purple Traits (24)
  { kind: 'sticky-secretions', name: 'Sticky Secretions', color: 'purple', points: -1, dominant: false, genePoolDelta: 0, dropOfLifeTag: 'perPurple', dropOfLifeMultiplier: 1, copies: 2, text: 'Drop of Life: +1 point for each Purple trait in your Trait Pile.' },
  { kind: 'telekinetic', name: 'Telekinetic', color: 'purple', points: 1, dominant: false, genePoolDelta: 0, actionTag: 'stealTrait', copies: 2, text: 'Action: Steal a non-Dominant trait from an opponent.' },
  { kind: 'venomous', name: 'Venomous', color: 'purple', points: -2, dominant: false, genePoolDelta: 0, actionTag: 'venomousMoveSelf', copies: 2, text: "Action: Play another trait, then move Venomous to an opponent's Trait Pile!" },
  { kind: 'parasitic', name: 'Parasitic', color: 'purple', points: -2, dominant: false, genePoolDelta: 0, actionTag: 'venomousMoveSelf', copies: 2, text: "Action: Move Parasitic to an opponent's Trait Pile!" },
  { kind: 'super-spreader', name: 'Super Spreader', color: 'purple', points: 2, dominant: false, genePoolDelta: -1, copies: 2, text: '-1 Gene Pool.' },
  { kind: 'teeth', name: 'Teeth', color: 'purple', points: 1, dominant: false, genePoolDelta: 1, copies: 2, text: '+1 Gene Pool.' },
  { kind: 'Clever', name: 'Clever', color: 'purple', points: 1, dominant: false, genePoolDelta: 0, actionTag: 'stealRandomHandCard', copies: 2, text: "Action: Steal 1 random card from an opponent's hand." },
  { kind: 'poisonous', name: 'Poisonous', color: 'purple', points: 2, dominant: false, genePoolDelta: 0, actionTag: 'destroyOpponentTrait', copies: 2, text: "Action: Destroy 1 non-Dominant trait in an opponent's Trait Pile." },
  { kind: 'nocturnal', name: 'Nocturnal', color: 'purple', points: 3, dominant: false, genePoolDelta: 0, copies: 3, text: 'Thrives in the dark.' },
  { kind: 'dreamer', name: 'Dreamer', color: 'purple', points: 1, dominant: false, genePoolDelta: 0, actionTag: 'draw2', copies: 2, text: 'Action: Draw 2 cards.' },
  { kind: 'echomimicry', name: 'Mimicry', color: 'purple', points: 2, dominant: false, genePoolDelta: 0, copies: 3, text: 'Clever disguise.' },

  // Colorless Traits (24)
  { kind: 'mitochondrion', name: 'Mitochondrion', color: 'colorless', points: 1, dominant: false, genePoolDelta: 1, copies: 2, text: '+1 Gene Pool.' },
  { kind: 'just', name: 'Just', color: 'colorless', points: 2, dominant: false, genePoolDelta: 1, copies: 2, text: '+1 Gene Pool.' },
  { kind: 'introspective', name: 'Introspective', color: 'colorless', points: 1, dominant: false, genePoolDelta: 0, actionTag: 'draw4', copies: 2, text: 'Action: Draw 4 cards.' },
  { kind: 'mindful', name: 'Mindful', color: 'colorless', points: 0, dominant: false, genePoolDelta: 0, dropOfLifeTag: 'perColorless', dropOfLifeMultiplier: 1, copies: 2, text: 'Drop of Life: +1 point for each Colorless trait in your Trait Pile.' },
  { kind: 'gratitude', name: 'Gratitude', color: 'colorless', points: 0, dominant: false, genePoolDelta: 0, dropOfLifeTag: 'colorVariety', copies: 2, text: 'Drop of Life: +1 point for each color in your Trait Pile.' },
  { kind: 'altruistic', name: 'Altruistic', color: 'colorless', points: 0, dominant: false, genePoolDelta: 0, dropOfLifeTag: 'genePoolSize', copies: 2, text: 'Drop of Life: Points equal to your Gene Pool size.' },
  { kind: 'tetrachromatic', name: 'Tetrachromatic', color: 'colorless', points: 4, dominant: false, genePoolDelta: 0, dropOfLifeTag: 'minusPerColorless', copies: 2, text: 'Drop of Life: -1 point for each Colorless trait in your Trait Pile.' },
  { kind: 'fulfilled', name: 'Fulfilled', color: 'colorless', points: 4, dominant: false, genePoolDelta: 0, indestructible: true, copies: 2, text: 'This trait cannot be removed from your Trait Pile.' },
  { kind: 'delicious', name: 'Delicious', color: 'colorless', points: 4, dominant: false, genePoolDelta: 0, requireColor: 'colorless', copies: 2, text: 'Requires at least 1 Colorless trait in your Trait Pile to play.' },
  { kind: 'doting', name: 'Doting', color: 'colorless', points: 2, dominant: false, genePoolDelta: 0, actionTag: 'giveCardFromHand', copies: 2, text: 'Action: Give 1 card from your hand to an opponent.' },
  { kind: 'eloquence', name: 'Eloquence', color: 'colorless', points: 1, dominant: false, genePoolDelta: 0, worldsEndTag: 'eloquencePlayTrait', copies: 2, text: "At World's End: Play another trait from your hand (ignoring its Action)." },
  { kind: 'flatulence', name: 'Flatulence', color: 'colorless', points: 3, dominant: false, genePoolDelta: 0, copies: 2, text: 'Silent but deadly.' },
];

export function buildDmDecks(rng: RngState): {
  traitDeck: DmTraitCard[];
  ageDeck: DmAgeCard[];
  birthOfLife: DmAgeCard;
} {
  let nextId = 1;
  const traits: DmTraitCard[] = [];
  for (const seed of TRAIT_SEEDS) {
    const copies = seed.copies ?? 1;
    for (let i = 0; i < copies; i++) {
      const { copies: _c, ...rest } = seed;
      void _c;
      traits.push({
        id: nextId++,
        ...rest,
      });
    }
  }

  const birthOfLife: DmAgeCard = {
    id: nextId++,
    ...DM_BIRTH_OF_LIFE,
  };

  const allAges: DmAgeCard[] = shuffle(
    rng,
    DM_AGE_DEFS.map((a) => ({ id: nextId++, ...a })),
  );
  const allCats: DmAgeCard[] = shuffle(
    rng,
    DM_CATASTROPHE_DEFS.map((c) => ({ id: nextId++, ...c })),
  );

  // Build 3 Era piles of (3 Ages + 1 Catastrophe), each shuffled independently!
  const era1 = shuffle(rng, [...allAges.slice(0, 3), allCats[0]!]);
  const era2 = shuffle(rng, [...allAges.slice(3, 6), allCats[1]!]);
  const era3 = shuffle(rng, [...allAges.slice(6, 9), allCats[2]!]);

  return {
    traitDeck: shuffle(rng, traits),
    ageDeck: [...era1, ...era2, ...era3],
    birthOfLife,
  };
}

export function traitCountsAsColor(
  card: DmTraitCard,
  color: DmTraitColor,
  swap: { from: DmTraitColor; to: DmTraitColor } | null,
): boolean {
  if (card.isAllColors && color !== 'colorless') return true;
  const effectiveColor = swap && card.color === swap.from ? swap.to : card.color;
  return effectiveColor === color;
}
