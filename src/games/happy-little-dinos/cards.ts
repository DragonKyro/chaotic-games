// Happy Little Dinosaurs — complete Base Game + all 4 Expansions:
// - Base Game: 4 Dinosaur Boards, 28 Disasters, 53 Point Cards, 16 Instants (97 cards)
// - 5–6 Player Expansion: 2 Dinosaur Boards (Pterry Dactyl, Raging Raptor), 14 Disasters, 36 Main cards (50 cards)
// - Perils of Puberty Expansion: 16 Disasters, 28 Point Cards, 10 Instants (54 cards)
// - Dating Disasters Expansion: 15 Disasters, 26 Point Cards, 12 Instants (53 cards)
// - Hazards Ahead Expansion: 22 Disasters, 16 Standard Cards, 12 Hazard Cards (50 cards)

import type { RngState } from '@/core/rng';
import { shuffle } from '@/core/rng';
import type {
  HldCard,
  HldCardKind,
  HldDinoDef,
  HldDisasterCard,
  HldDisasterCategory,
  HldExpansionId,
  HldHazardCard,
  HldHazardPenalty,
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

export interface HldDisasterDef {
  name: string;
  category: HldDisasterCategory;
  text: string;
  drawsHazard?: boolean;
}

export const HLD_DISASTER_DEFS: readonly HldDisasterDef[] = [
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

// ============================================================================
// Expansion 1: 5–6 Player Expansion (14 Disasters + 36 Main cards = 50 cards)
// ============================================================================

export const HLD_5_6_DISASTER_DEFS: readonly HldDisasterDef[] = [
  // Natural (4)
  { name: 'Quake and Bake', category: 'natural', text: 'An earthquake cracks open a vent of scalding steam.' },
  { name: 'Poison Ivy Patch', category: 'natural', text: 'Everything itches and your arms are still too short.' },
  { name: 'Tornado Warning', category: 'natural', text: 'A prehistoric twister spins you right out of your scales.' },
  { name: 'Acid Rain', category: 'natural', text: 'The clouds drizzle spicy volcano water on your parade.' },
  // Predatory (4)
  { name: 'Sabertooth Ambush', category: 'predator', text: 'A hungry kitty with giant fangs pounces from a bush.' },
  { name: 'Giant Centipede', category: 'predator', text: 'A hundred creepy legs tickle and chomp your ankles.' },
  { name: 'Pack of Compsognathus', category: 'predator', text: 'Twenty ankle-biters gang up on your lunch.' },
  { name: 'Snapper Turtle', category: 'predator', text: 'An armored boulder clamp-bites your tail.' },
  // Emotional (4)
  { name: 'Public Voice Crack', category: 'emotional', text: 'Your mighty roar comes out as a high-pitched squeak.' },
  { name: 'Left on Read', category: 'emotional', text: 'Your smoke-signal message was seen three days ago.' },
  { name: 'Nobody Laughs', category: 'emotional', text: 'You tell your best joke and only the crickets chirp.' },
  { name: 'Tripped in Front of Crush', category: 'emotional', text: 'You faceplant over a completely flat rock.' },
  // Meteor (2)
  { name: 'Meteor!', category: 'meteor', text: 'Acts as any of the three Disaster types (Natural, Predatory, or Emotional)!' },
  { name: 'Meteor!', category: 'meteor', text: 'Acts as any of the three Disaster types (Natural, Predatory, or Emotional)!' },
];

export const HLD_5_6_MAIN_DECK_DEFS: readonly HldCardDef[] = [
  // 28 Point Cards
  { kind: 'flaming-chainsaw', name: 'Flaming Chainsaw', type: 'point', value: 9, count: 1, hasEffect: true, text: 'During this round, all other Point card effects are ignored.' },
  { kind: 'meteor-cannon', name: 'Meteor Cannon', type: 'point', value: 9, count: 1, hasEffect: false, text: 'Point Value: 9.' },
  { kind: 'hungry-plant', name: 'Hungry Plant', type: 'point', value: 8, count: 1, hasEffect: true, text: 'You may swap the Point cards of any two players.' },
  { kind: 'iced-ptea', name: 'Iced Ptea', type: 'point', value: 8, count: 1, hasEffect: false, text: 'Point Value: 8.' },
  { kind: 'treenoculars', name: 'Treenoculars', type: 'point', value: 7, count: 1, hasEffect: true, text: 'You may look at the top 2 cards in the deck. Choose 1 card to add to your hand and discard the other.' },
  { kind: 'sting-stabber', name: 'Sting Stabber', type: 'point', value: 7, count: 2, hasEffect: false, text: 'Point Value: 7.' },
  { kind: 'special-star-fruit', name: 'Special Star Fruit', type: 'point', value: 6, count: 1, hasEffect: true, text: 'During scoring this round, double the effects of Score Booster and Score Sapper cards.' },
  { kind: 'bow-and-dino', name: 'Bow and Dino', type: 'point', value: 6, count: 2, hasEffect: false, text: 'Point Value: 6.' },
  { kind: 'mouth-trap', name: 'Mouth Trap', type: 'point', value: 5, count: 1, hasEffect: true, text: 'During scoring this round, switch the score of the highest-scoring player with the score of the lowest-scoring player after scores have been calculated.' },
  { kind: 'run-home-bat', name: 'Run Home Bat', type: 'point', value: 5, count: 2, hasEffect: false, text: 'Point Value: 5.' },
  { kind: 'fire-spray', name: 'Fire Spray', type: 'point', value: 4, count: 1, hasEffect: true, text: 'You may discard up to 3 cards from your hand.' },
  { kind: 'bonehead', name: 'Bonehead', type: 'point', value: 4, count: 2, hasEffect: false, text: 'Point Value: 4.' },
  { kind: 'delicious-smoothie', name: 'Delicious Smoothie', type: 'point', value: 3, count: 1, hasEffect: true, text: 'You may discard a Point card with an effect from your hand, then add its point value to your score this round.' },
  { kind: 'grave-maker', name: 'Grave Maker', type: 'point', value: 3, count: 2, hasEffect: false, text: 'Point Value: 3.' },
  { kind: 'grappling-snake', name: 'Grappling Snake', type: 'point', value: 2, count: 1, hasEffect: true, text: 'You may swap this card with the Point card of the player to your right or left. You cannot swap for a card that has an effect.' },
  { kind: 'handy-pan', name: 'Handy Pan', type: 'point', value: 2, count: 2, hasEffect: false, text: 'Point Value: 2.' },
  { kind: 'dino-grabber', name: 'Dino Grabber', type: 'point', value: 1, count: 1, hasEffect: true, text: "You may look at another player's hand. Choose a card and add it to your hand." },
  { kind: 'cool-stick', name: 'Cool Stick', type: 'point', value: 1, count: 2, hasEffect: false, text: 'Point Value: 1.' },
  { kind: 'pet-rock', name: 'Pet Rock', type: 'point', value: 0, count: 3, hasEffect: true, text: 'You may discard a Point card from your hand, then add its point value to your score this round.' },
  // 8 Instant Cards
  { kind: 'score-booster', name: 'Score Booster', type: 'instant', value: null, count: 3, hasEffect: true, text: "Play this card during scoring. Add 2 points to any player's score this round." },
  { kind: 'score-sapper', name: 'Score Sapper', type: 'instant', value: null, count: 3, hasEffect: true, text: "Play this card during scoring. Subtract 2 points from any player's score this round." },
  { kind: 'score-inversion', name: 'Score Inversion', type: 'instant', value: null, count: 1, hasEffect: true, text: 'Play this card during scoring. The player with the highest score must switch scores with the player with the lowest score this round.' },
  { kind: 'disaster-insurance', name: 'Disaster Insurance', type: 'instant', value: null, count: 1, hasEffect: true, text: 'Play this card if you would add a Disaster card to your Disaster Area this round. Move that Disaster card to the bottom of the Disaster deck instead.' },
];

// ============================================================================
// Expansion 2: Perils of Puberty (16 Disasters, 28 Point, 10 Instant = 54 cards)
// ============================================================================

export const HLD_PUBERTY_DISASTER_DEFS: readonly HldDisasterDef[] = [
  { name: 'Art Class', category: 'emotional', text: 'Everyone stares at your lopsided clay sculpture.' },
  { name: 'Doomed to Failure', category: 'emotional', text: 'You forgot to study for the prehistoric finals.' },
  { name: 'Fire Drill', category: 'natural', text: 'The volcano alarm goes off in the middle of gym class.' },
  { name: 'Hairy Situation', category: 'emotional', text: 'Weird proto-feathers are sprouting in awkward places.' },
  { name: 'Hot and Steamy', category: 'natural', text: 'A geyser erupts right inside the locker room.' },
  { name: 'Hungry Hungry Dinos', category: 'predator', text: 'You are sent away to boarding school with carnivorous dinosaurs.' },
  { name: 'Oh Hail No', category: 'natural', text: 'Golf-ball-sized hailstones pelt you on the walk home.' },
  { name: 'Meteor!', category: 'meteor', text: 'Acts as any of the three Disaster types (Natural, Predatory, or Emotional)!' },
  { name: 'Pet Problems', category: 'predator', text: 'Your class pet biting-beetle escapes its cage.' },
  { name: 'Rabid Rabbit', category: 'predator', text: 'A foaming prehistoric bunny chases you up a tree.' },
  { name: 'Raving Madness', category: 'emotional', text: 'Your mood swings harder than a boulder.' },
  { name: 'Say Cheese!', category: 'emotional', text: 'School picture day captures your worst angle forever.' },
  { name: 'Shocking!', category: 'natural', text: 'Static electricity zaps your snout on a metal locker.' },
  { name: 'Super Murder Hornets', category: 'predator', text: 'Giant prehistoric hornets build a nest in your backpack.' },
  { name: 'Total Loss', category: 'natural', text: 'A mudslide swallows your homework and your lunch.' },
  { name: "You're Out", category: 'predator', text: 'Dodgeball with boulders gets way too competitive.' },
];

export const HLD_PUBERTY_MAIN_DECK_DEFS: readonly HldCardDef[] = [
  // New Point Cards (10)
  {
    kind: 'extra-sharp-stick',
    name: 'Extra Sharp Stick',
    type: 'point',
    value: 9,
    count: 1,
    hasEffect: true,
    text: 'Add +1 to your score this round.',
  },
  {
    kind: 'really-thick-glasses',
    name: 'Really Thick Glasses',
    type: 'point',
    value: 8,
    count: 1,
    hasEffect: true,
    text: 'Draw 1 card and add +1 to your score this round.',
  },
  {
    kind: 'trash-into-treasure',
    name: 'Trash into Treasure',
    type: 'point',
    value: 7,
    count: 2,
    hasEffect: true,
    text: 'You may take a Point card from the discard pile and add it to your hand.',
  },
  {
    kind: 'handy-backpack',
    name: 'Handy Backpack',
    type: 'point',
    value: 6,
    count: 2,
    hasEffect: true,
    text: 'Draw 2 cards.',
  },
  {
    kind: 'ice-cream',
    name: 'Ice Cream!',
    type: 'point',
    value: 5,
    count: 2,
    hasEffect: true,
    text: 'Add +1 to your score this round for each Disaster card in your Disaster Area.',
  },
  {
    kind: 'unwanted-lunch',
    name: 'Unwanted Lunch',
    type: 'point',
    value: 4,
    count: 2,
    hasEffect: true,
    text: 'You may give a card from your hand to another player and take 1 random card from their hand.',
  },
  // Returning Point Cards (18)
  { kind: 'meteor-cannon', name: 'Meteor Cannon', type: 'point', value: 9, count: 2, hasEffect: false, text: 'Point Value: 9.' },
  { kind: 'iced-ptea', name: 'Iced Ptea', type: 'point', value: 8, count: 2, hasEffect: false, text: 'Point Value: 8.' },
  { kind: 'sting-stabber', name: 'Sting Stabber', type: 'point', value: 7, count: 2, hasEffect: false, text: 'Point Value: 7.' },
  { kind: 'bow-and-dino', name: 'Bow and Dino', type: 'point', value: 6, count: 2, hasEffect: false, text: 'Point Value: 6.' },
  { kind: 'run-home-bat', name: 'Run Home Bat', type: 'point', value: 5, count: 2, hasEffect: false, text: 'Point Value: 5.' },
  { kind: 'bonehead', name: 'Bonehead', type: 'point', value: 4, count: 2, hasEffect: false, text: 'Point Value: 4.' },
  { kind: 'grave-maker', name: 'Grave Maker', type: 'point', value: 3, count: 2, hasEffect: false, text: 'Point Value: 3.' },
  { kind: 'handy-pan', name: 'Handy Pan', type: 'point', value: 2, count: 2, hasEffect: false, text: 'Point Value: 2.' },
  { kind: 'cool-stick', name: 'Cool Stick', type: 'point', value: 1, count: 2, hasEffect: false, text: 'Point Value: 1.' },

  // Instant Cards (10)
  {
    kind: 'bffs-help',
    name: "BFF's Help",
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: "Play during scoring. Add the point value of a Point card in your hand to any player's score this round (without discarding it).",
  },
  {
    kind: 'frenemys-curse',
    name: "Frenemy's Curse",
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: "Play during scoring. Subtract 3 points from the highest-scoring player's score this round.",
  },
  {
    kind: 'joy-of-puberty',
    name: 'Joy of Puberty',
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: 'Play during scoring. Add +2 to your score this round for each Disaster card in your Disaster Area.',
  },
  {
    kind: 'lucky-break',
    name: 'Lucky Break',
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: 'Play if you would add a Disaster card to your Disaster Area. Discard a Point card from your hand to move the Disaster card to the bottom of the Disaster deck instead.',
  },
  {
    kind: 'spiteful-bullying',
    name: 'Spiteful Bullying',
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: "Play during scoring. Swap any two players' round scores.",
  },
];

// ============================================================================
// Expansion 3: Dating Disasters (15 Disasters, 26 Point, 12 Instant = 53 cards)
// ============================================================================

export const HLD_DATING_DISASTER_DEFS: readonly HldDisasterDef[] = [
  { name: 'Awkward Greeting', category: 'emotional', text: 'You go in for a hug while your date goes for a handshake.' },
  { name: 'Catfished', category: 'predator', text: 'Your date turns out to be three raptors in a trench coat.' },
  { name: 'Caught in the Rain', category: 'natural', text: 'A sudden monsoon ruins your romantic picnic.' },
  { name: 'Coolest Dino Ever', category: 'emotional', text: 'You try to do a cool flip and land in a bush.' },
  { name: 'Drifting Apart', category: 'natural', text: 'Continental drift literally separates your table for two.' },
  { name: 'Emergency Exit', category: 'emotional', text: 'Your date climbs out the bathroom window.' },
  { name: 'Friend Zoned', category: 'emotional', text: 'They say you are like a prehistoric sibling to them.' },
  { name: 'I Love You', category: 'emotional', text: 'You blurt out "I love you" to the waiter.' },
  { name: 'Pterrible Move', category: 'predator', text: 'A pterodactyl swoops down and steals your candlelit dinner.' },
  { name: 'Picnic Pests', category: 'predator', text: 'Fire ants march off with your entire charcuterie board.' },
  { name: 'Snack Attack', category: 'predator', text: 'Your date tries to take a bite out of your arm.' },
  { name: 'Table Manners', category: 'natural', text: 'You sneeze so hard the tablecloth flies off.' },
  { name: 'Waiting for a Reply', category: 'emotional', text: 'You stare at your message stone for six hours straight.' },
  { name: 'Wave Goodbye', category: 'natural', text: 'A rogue tidal wave washes your beach date out to sea.' },
  { name: "You're on Fire", category: 'natural', text: 'Your tail catches fire on the romantic table candle.' },
];

export const HLD_DATING_MAIN_DECK_DEFS: readonly HldCardDef[] = [
  // Point Cards (26)
  { kind: 'mixtape', name: 'Mixtape', type: 'point', value: 9, count: 1, hasEffect: false, text: 'Point Value: 9.' },
  { kind: 'minty-gum', name: 'Minty Gum', type: 'point', value: 8, count: 1, hasEffect: false, text: 'Point Value: 8.' },
  {
    kind: 'box-of-chocolates',
    name: 'Box of Chocolates',
    type: 'point',
    value: 7,
    count: 2,
    hasEffect: true,
    text: 'Draw 2 cards from the deck. Choose 1 card to keep in your hand and discard the other.',
  },
  { kind: 'wine-bottle', name: 'Wine Bottle', type: 'point', value: 6, count: 2, hasEffect: false, text: 'Point Value: 6.' },
  { kind: 'heart-bomb', name: 'Heart Bomb', type: 'point', value: 5, count: 3, hasEffect: false, text: 'Point Value: 5.' },
  {
    kind: 'bedazzled-belt',
    name: 'Bedazzled Belt',
    type: 'point',
    value: 5,
    count: 2,
    hasEffect: true,
    text: 'Add +2 to your score this round if your Dinosaur gets a +1 trait bonus on this Disaster.',
  },
  { kind: 'teddy-bear', name: 'Teddy Bear', type: 'point', value: 4, count: 3, hasEffect: false, text: 'Point Value: 4.' },
  {
    kind: 'bouquet-of-flowers',
    name: 'Bouquet of Flowers',
    type: 'point',
    value: 3,
    count: 3,
    hasEffect: true,
    text: "You may look at another player's hand. Choose a card and add it to your hand.",
  },
  { kind: 'stinky-perfume', name: 'Stinky Perfume', type: 'point', value: 2, count: 2, hasEffect: false, text: 'Point Value: 2.' },
  {
    kind: 'love-bug',
    name: 'Love Bug',
    type: 'point',
    value: 2,
    count: 2,
    hasEffect: true,
    text: 'Draw 1 card and add +1 to your score this round.',
  },
  { kind: 'broken-high-heel', name: 'Broken High Heel', type: 'point', value: 1, count: 2, hasEffect: false, text: 'Point Value: 1.' },
  {
    kind: 'cold-feet',
    name: 'Cold Feet',
    type: 'point',
    value: 0,
    count: 3,
    hasEffect: true,
    text: 'You may swap your Point card with the top Point card of the discard pile.',
  },

  // Instant Cards (12)
  {
    kind: 'awkward-first-kiss',
    name: 'Awkward First Kiss',
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: "Play during scoring. Swap your round score with another player's round score.",
  },
  {
    kind: 'baby-pictures',
    name: 'Baby Pictures',
    type: 'instant',
    value: null,
    count: 3,
    hasEffect: true,
    text: "Play during scoring. Subtract 2 points from any player's score this round.",
  },
  {
    kind: 'crippling-shyness',
    name: 'Crippling Shyness',
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: 'Play if you would add a Disaster card to your Disaster Area this round. Move that Disaster card to the bottom of the Disaster deck instead.',
  },
  {
    kind: 'double-date',
    name: 'Double Date',
    type: 'instant',
    value: null,
    count: 3,
    hasEffect: true,
    text: "Play during scoring. Add +2 points to two players' scores this round.",
  },
  {
    kind: 'one-week-anniversary',
    name: 'One Week Anniversary',
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: "Play during scoring. Add +3 points to any player's score this round.",
  },
];

// ============================================================================
// Expansion 4: Hazards Ahead (22 Disasters, 16 Standard, 12 Hazards = 50 cards)
// ============================================================================

export const HLD_HAZARDS_DISASTER_DEFS: readonly HldDisasterDef[] = [
  // Natural (7)
  { name: 'Boiling Mud Pit', category: 'natural', text: 'You step into bubbling mud! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Rockslide Alley', category: 'natural', text: 'Loose pebbles pelt you from above! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Toxic Swamp', category: 'natural', text: 'Green marsh gas makes your eyes water! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Jagged Ravine', category: 'natural', text: 'You scrape your tail climbing out of a gorge! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Thin Ice', category: 'natural', text: 'The frozen pond cracks beneath your claws.' },
  { name: 'Dust Storm', category: 'natural', text: 'Sand gets into your eyes, nostrils, and lunch.' },
  { name: 'Solar Flare', category: 'natural', text: 'You get a prehistoric sunburn through your scales.' },
  // Predatory (7)
  { name: 'Spiny Sea Urchin', category: 'predator', text: 'You step on a spiky urchin! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Leech Lagoon', category: 'predator', text: 'Prehistoric leeches latch onto your knees! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Scorpion Sting', category: 'predator', text: 'A giant scorpion zaps your toe! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Fire Ant Mound', category: 'predator', text: 'You sit right on an angry ant hill! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Raptor Patrol', category: 'predator', text: 'Neighborhood raptors shake you down for shiny rocks.' },
  { name: 'Snapping Clam', category: 'predator', text: 'A giant clam pinches your nose shut.' },
  { name: 'Angry Badger-Beast', category: 'predator', text: 'A prehistoric badger refuses to let you pass.' },
  // Emotional (6)
  { name: 'Stage Fright', category: 'emotional', text: 'You freeze up in front of the herd! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Bad Haircut', category: 'emotional', text: 'A crab trims your bangs unevenly! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Wardrobe Malfunction', category: 'emotional', text: 'Your leaf outfit blows away! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Social Burnout', category: 'emotional', text: 'Your social battery hits zero! Also draw a Hazard card.', drawsHazard: true },
  { name: 'Spoiled Ending', category: 'emotional', text: 'Someone spoils the ending of the Cretaceous period.' },
  { name: 'Wrong Cave', category: 'emotional', text: 'You walk into the wrong family cave and sit down.' },
  // Meteor (2)
  { name: 'Meteor!', category: 'meteor', text: 'Acts as any of the three Disaster types (Natural, Predatory, or Emotional)!' },
  { name: 'Meteor!', category: 'meteor', text: 'Acts as any of the three Disaster types (Natural, Predatory, or Emotional)!' },
];

export const HLD_HAZARDS_MAIN_DECK_DEFS: readonly HldCardDef[] = [
  // Point Cards (12)
  { kind: 'hazard-suit', name: 'Hazard Suit', type: 'point', value: 8, count: 2, hasEffect: false, text: 'Point Value: 8.' },
  { kind: 'protective-helmet', name: 'Protective Helmet', type: 'point', value: 7, count: 2, hasEffect: false, text: 'Point Value: 7.' },
  {
    kind: 'suck-up',
    name: 'Suck Up',
    type: 'point',
    value: 6,
    count: 2,
    hasEffect: true,
    text: 'You may remove a Hazard card from your Hazard Area.',
  },
  {
    kind: 'molotov-crocktail',
    name: 'Molotov Crocktail',
    type: 'point',
    value: 5,
    count: 2,
    hasEffect: true,
    text: 'You may remove a Hazard card from your Hazard Area.',
  },
  {
    kind: 'caution-sign',
    name: 'Caution Sign',
    type: 'point',
    value: 4,
    count: 2,
    hasEffect: true,
    text: "You may move a Hazard card from your Hazard Area to another player's Hazard Area.",
  },
  { kind: 'safety-cone', name: 'Safety Cone', type: 'point', value: 3, count: 2, hasEffect: false, text: 'Point Value: 3.' },
  // Instant Cards (4)
  {
    kind: 'roadblock',
    name: 'Roadblock',
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: "Play during scoring. Subtract 2 points from any player's score (plus -1 more per Hazard card in their Hazard Area).",
  },
  {
    kind: 'detour',
    name: 'Detour',
    type: 'instant',
    value: null,
    count: 2,
    hasEffect: true,
    text: 'Play if you would add a Disaster card to your Disaster Area. Move the Disaster to the bottom of the Disaster deck and remove 1 Hazard card from your Hazard Area.',
  },
];

export interface HldHazardDef {
  name: string;
  penalty: HldHazardPenalty;
  count: number;
  text: string;
}

export const HLD_HAZARD_CARD_DEFS: readonly HldHazardDef[] = [
  {
    name: 'Slippery Mud',
    penalty: 'score-minus-1',
    count: 3,
    text: 'Persistent Hazard: -1 to your score each round until removed.',
  },
  {
    name: 'Toxic Fumes',
    penalty: 'score-minus-2',
    count: 2,
    text: 'Persistent Hazard: -2 to your score each round until removed.',
  },
  {
    name: 'Sprained Ankle',
    penalty: 'hand-size-minus-1',
    count: 3,
    text: 'Persistent Hazard: Your hand refill size at the start of each round is reduced by 1 (minimum 2).',
  },
  {
    name: 'Panic Attack',
    penalty: 'no-instants',
    count: 2,
    text: 'Persistent Hazard: You cannot play Scoring Instant cards while this card is in your Hazard Area.',
  },
  {
    name: 'Identity Crisis',
    penalty: 'ignore-dino-plus',
    count: 2,
    text: "Persistent Hazard: Your Dinosaur's +1 trait bonus is ignored while this card is in your Hazard Area.",
  },
];

export function buildHldDecks(
  rng: RngState,
  expansions: readonly HldExpansionId[] = [],
): {
  disasterDeck: HldDisasterCard[];
  deck: HldCard[];
  hazardDeck: HldHazardCard[];
} {
  let nextId = 1;

  const disasterSources: HldDisasterDef[] = [...HLD_DISASTER_DEFS];
  const mainSources: HldCardDef[] = [...HLD_MAIN_DECK_DEFS];

  if (expansions.includes('players-5-6')) {
    disasterSources.push(...HLD_5_6_DISASTER_DEFS);
    mainSources.push(...HLD_5_6_MAIN_DECK_DEFS);
  }
  if (expansions.includes('perils-of-puberty')) {
    disasterSources.push(...HLD_PUBERTY_DISASTER_DEFS);
    mainSources.push(...HLD_PUBERTY_MAIN_DECK_DEFS);
  }
  if (expansions.includes('dating-disasters')) {
    disasterSources.push(...HLD_DATING_DISASTER_DEFS);
    mainSources.push(...HLD_DATING_MAIN_DECK_DEFS);
  }
  if (expansions.includes('hazards-ahead')) {
    disasterSources.push(...HLD_HAZARDS_DISASTER_DEFS);
    mainSources.push(...HLD_HAZARDS_MAIN_DECK_DEFS);
  }

  const disasters: HldDisasterCard[] = disasterSources.map((d) => ({
    id: nextId++,
    name: d.name,
    category: d.category,
    text: d.text,
    ...(d.drawsHazard ? { drawsHazard: true } : {}),
  }));

  const cards: HldCard[] = [];
  for (const def of mainSources) {
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

  const hazards: HldHazardCard[] = [];
  if (expansions.includes('hazards-ahead')) {
    for (const def of HLD_HAZARD_CARD_DEFS) {
      for (let i = 0; i < def.count; i++) {
        hazards.push({
          id: nextId++,
          name: def.name,
          penalty: def.penalty,
          text: def.text,
        });
      }
    }
  }

  return {
    disasterDeck: shuffle(rng, disasters),
    deck: shuffle(rng, cards),
    hazardDeck: hazards.length > 0 ? shuffle(rng, hazards) : [],
  };
}
