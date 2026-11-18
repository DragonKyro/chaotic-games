// Happy Little Dinosaurs — complete verified Base Game deck:
// - 4 Dinosaur Boards (+2 for 5–6 player games)
// - 28 Disaster Cards (8 Natural, 8 Predatory, 8 Emotional, 4 Meteor)
// - 53 Point Cards (values 0–9)
// - 16 Instant Cards
// Total = 97 cards in the Base Game.

import type { RngState } from '@/core/rng';
import { shuffle } from '@/core/rng';
import type {
  HldCard,
  HldCardKind,
  HldDinoDef,
  HldDisasterCard,
  HldDisasterCategory,
  HldPlayCardType,
} from './types';

export const HLD_DINO_DEFS: readonly HldDinoDef[] = [
  {
    id: 'nervous-rex',
    name: 'Nervous Rex',
    plusCategory: 'predator',
    minusCategory: 'emotional',
    text: '+1 on Predatory Disasters, -1 on Emotional Disasters.',
  },
  {
    id: 'cry-ceratops',
    name: 'Cry Ceratops',
    plusCategory: 'emotional',
    minusCategory: 'natural',
    text: '+1 on Emotional Disasters, -1 on Natural Disasters.',
  },
  {
    id: 'bad-luck-bronto',
    name: 'Bad Luck Bronto',
    plusCategory: 'natural',
    minusCategory: 'predator',
    text: '+1 on Natural Disasters, -1 on Predatory Disasters.',
  },
  {
    id: 'stego',
    name: 'Stego',
    plusCategory: 'meteor',
    minusCategory: null,
    text: '+1 on Meteor Disasters, no penalty on any Disaster.',
  },
  {
    id: 'pterry-dactyl',
    name: 'Pterry Dactyl',
    plusCategory: 'natural',
    minusCategory: 'emotional',
    text: '+1 on Natural Disasters, -1 on Emotional Disasters.',
  },
  {
    id: 'raging-raptor',
    name: 'Raging Raptor',
    plusCategory: 'predator',
    minusCategory: 'natural',
    text: '+1 on Predatory Disasters, -1 on Natural Disasters.',
  },
];

export const HLD_DISASTER_DEFS: readonly { name: string; category: HldDisasterCategory; text: string }[] = [
  // Natural Disasters (8)
  { name: 'Uncommon Cold', category: 'natural', text: 'You catch a sudden prehistoric chill.' },
  { name: 'Leaf Me Alone', category: 'natural', text: 'You get papercut by a razor-sharp fern leaf.' },
  { name: 'Hot Lava', category: 'natural', text: 'The floor is literally lava today.' },
  { name: 'Flash Flood', category: 'natural', text: 'A sudden torrent sweeps away your favorite rock.' },
  { name: 'Prickly Bush', category: 'natural', text: 'You tumble straight into a prehistoric cactus patch.' },
  { name: 'Sinkhole', category: 'natural', text: 'The ground opens up right beneath your feet.' },
  { name: 'Falling Boulder', category: 'natural', text: 'A rogue boulder rolls down the mountainside.' },
  { name: 'Tar Pit Trap', category: 'natural', text: 'Your feet get stuck in sticky tar.' },

  // Predatory Disasters (8)
  { name: 'Stomped', category: 'predator', text: 'A much bigger dinosaur steps right on your tail.' },
  { name: 'Feeling Squirrelly', category: 'predator', text: 'You are ambushed by saber-toothed squirrels!' },
  { name: 'Hangry Shark', category: 'predator', text: 'A prehistoric shark leaps out of the lagoon.' },
  { name: 'Giant Swooping Bird', category: 'predator', text: 'A giant terror-bird tries to carry you off.' },
  { name: 'Piranha Bite', category: 'predator', text: 'Something toothy nibbles your toes in the river.' },
  { name: 'Venomous Critter', category: 'predator', text: 'A tiny angry lizard gives you a chomp.' },
  { name: 'Swarm of Mosquitoes', category: 'predator', text: 'Jurassic-sized mosquitoes ruin your afternoon.' },
  { name: 'Carnivorous Vine', category: 'predator', text: 'The salad tries to eat you back.' },

  // Emotional Disasters (8)
  { name: 'Ghosted', category: 'emotional', text: 'You get ghosted by your dino date.' },
  { name: 'Baddest Hair Day', category: 'emotional', text: 'Your scales and feathers refuse to cooperate.' },
  { name: 'Existential Crisis', category: 'emotional', text: 'You wonder if an asteroid is going to turn you into oil.' },
  { name: 'Awkward Wave', category: 'emotional', text: 'You wave back at someone who was waving at the dino behind you.' },
  { name: 'Dropped Ice Cream', category: 'emotional', text: 'Your scoop falls splat onto the dirt.' },
  { name: 'Forgotten Birthday', category: 'emotional', text: 'Nobody came to your hatch-day party.' },
  { name: 'Tiny Arms Problem', category: 'emotional', text: 'You cannot reach the itch on your nose.' },
  { name: 'Stepped on a Lego', category: 'emotional', text: 'You step on a sharp prehistoric pebble in the dark.' },

  // Meteor Disasters (4)
  { name: 'Meteor!', category: 'meteor', text: 'Acts as any of the three Disaster types (Natural, Predatory, or Emotional)!' },
  { name: 'Meteor!', category: 'meteor', text: 'Acts as any of the three Disaster types (Natural, Predatory, or Emotional)!' },
  { name: 'Meteor!', category: 'meteor', text: 'Acts as any of the three Disaster types (Natural, Predatory, or Emotional)!' },
  { name: 'Meteor!', category: 'meteor', text: 'Acts as any of the three Disaster types (Natural, Predatory, or Emotional)!' },
];

export interface HldCardDef {
  kind: HldCardKind;
  name: string;
  type: HldPlayCardType;
  value: number | null;
  count: number;
  hasEffect: boolean;
  text: string;
}

export const HLD_MAIN_DECK_DEFS: readonly HldCardDef[] = [
  // Point Cards (53)
  {
    kind: 'flaming-chainsaw',
    name: 'Flaming Chainsaw',
    type: 'point',
    value: 9,
    count: 1,
    hasEffect: true,
    text: 'During this round, all other Point card effects are ignored.',
  },
  {
    kind: 'meteor-cannon',
    name: 'Meteor Cannon',
    type: 'point',
    value: 9,
    count: 3,
    hasEffect: false,
    text: 'Point Value: 9.',
  },
  {
    kind: 'hungry-plant',
    name: 'Hungry Plant',
    type: 'point',
    value: 8,
    count: 1,
    hasEffect: true,
    text: 'You may swap the Point cards of any two players.',
  },
  {
    kind: 'iced-ptea',
    name: 'Iced Ptea',
    type: 'point',
    value: 8,
    count: 3,
    hasEffect: false,
    text: 'Point Value: 8.',
  },
  {
    kind: 'treenoculars',
    name: 'Treenoculars',
    type: 'point',
    value: 7,
    count: 2,
    hasEffect: true,
    text: 'You may look at the top 2 cards in the deck. Choose 1 card to add to your hand and discard the other.',
  },
  {
    kind: 'sting-stabber',
    name: 'Sting Stabber',
    type: 'point',
    value: 7,
    count: 3,
    hasEffect: false,
    text: 'Point Value: 7.',
  },
  {
    kind: 'special-star-fruit',
    name: 'Special Star Fruit',
    type: 'point',
    value: 6,
    count: 2,
    hasEffect: true,
    text: 'During scoring this round, double the effects of Score Booster and Score Sapper cards.',
  },
  {
    kind: 'bow-and-dino',
    name: 'Bow and Dino',
    type: 'point',
    value: 6,
    count: 4,
    hasEffect: false,
    text: 'Point Value: 6.',
  },
  {
    kind: 'mouth-trap',
    name: 'Mouth Trap',
    type: 'point',
    value: 5,
    count: 2,
    hasEffect: true,
    text: 'During scoring this round, switch the score of the highest-scoring player with the score of the lowest-scoring player after scores have been calculated.',
  },
  {
    kind: 'run-home-bat',
    name: 'Run Home Bat',
    type: 'point',
    value: 5,
    count: 4,
    hasEffect: false,
    text: 'Point Value: 5.',
  },
  {
    kind: 'fire-spray',
    name: 'Fire Spray',
    type: 'point',
    value: 4,
    count: 2,
    hasEffect: true,
    text: 'You may discard up to 3 cards from your hand.',
  },
  {
    kind: 'bonehead',
    name: 'Bonehead',
    type: 'point',
    value: 4,
    count: 4,
    hasEffect: false,
    text: 'Point Value: 4.',
  },
  {
    kind: 'delicious-smoothie',
    name: 'Delicious Smoothie',
    type: 'point',
    value: 3,
    count: 2,
    hasEffect: true,
    text: 'You may discard a Point card with an effect from your hand, then add its point value to your score this round.',
  },
  {
    kind: 'grave-maker',
    name: 'Grave Maker',
    type: 'point',
    value: 3,
    count: 4,
    hasEffect: false,
    text: 'Point Value: 3.',
  },
  {
    kind: 'grappling-snake',
    name: 'Grappling Snake',
    type: 'point',
    value: 2,
    count: 2,
    hasEffect: true,
    text: 'You may swap this card with the Point card of the player to your right or left. You cannot swap for a card that has an effect.',
  },
  {
    kind: 'handy-pan',
    name: 'Handy Pan',
    type: 'point',
    value: 2,
    count: 4,
    hasEffect: false,
    text: 'Point Value: 2.',
  },
  {
    kind: 'dino-grabber',
    name: 'Dino Grabber',
    type: 'point',
    value: 1,
    count: 2,
    hasEffect: true,
    text: "You may look at another player's hand. Choose a card and add it to your hand.",
  },
  {
    kind: 'cool-stick',
    name: 'Cool Stick',
    type: 'point',
    value: 1,
    count: 4,
    hasEffect: false,
    text: 'Point Value: 1.',
  },
  {
    kind: 'pet-rock',
    name: 'Pet Rock',
    type: 'point',
    value: 0,
    count: 4,
    hasEffect: true,
    text: 'You may discard a Point card from your hand, then add its point value to your score this round.',
  },

  // Instant Cards (16)
  {
    kind: 'score-booster',
    name: 'Score Booster',
    type: 'instant',
    value: null,
    count: 5,
    hasEffect: true,
    text: "Play this card during scoring. Add 2 points to any player's score this round.",
  },
  {
    kind: 'score-sapper',
    name: 'Score Sapper',
    type: 'instant',
    value: null,
    count: 5,
    hasEffect: true,
    text: "Play this card during scoring. Subtract 2 points from any player's score this round.",
  },
  {
    kind: 'score-inversion',
    name: 'Score Inversion',
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: 'Play this card during scoring. The player with the highest score must switch scores with the player with the lowest score this round.',
  },
  {
    kind: 'disaster-insurance',
    name: 'Disaster Insurance',
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: 'Play this card if you would add a Disaster card to your Disaster Area this round. Move that Disaster card to the bottom of the Disaster deck instead.',
  },
  {
    kind: 'disaster-redirect',
    name: 'Disaster Redirect',
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: "Play this card if you would add a Disaster card to your Disaster Area this round. Move that Disaster card to another player's Disaster Area instead.",
  },
];

export function buildHldDecks(rng: RngState): {
  disasterDeck: HldDisasterCard[];
  deck: HldCard[];
} {
  let nextId = 1;
  const disasters: HldDisasterCard[] = HLD_DISASTER_DEFS.map((d) => ({
    id: nextId++,
    name: d.name,
    category: d.category,
    text: d.text,
  }));

  const cards: HldCard[] = [];
  for (const def of HLD_MAIN_DECK_DEFS) {
    for (let i = 0; i < def.count; i++) {
      cards.push({
        id: nextId++,
        kind: def.kind,
        name: def.name,
        type: def.type,
        value: def.value,
        hasEffect: def.hasEffect,
        text: def.text,
      });
    }
  }

  return {
    disasterDeck: shuffle(rng, disasters),
    deck: shuffle(rng, cards),
  };
}
