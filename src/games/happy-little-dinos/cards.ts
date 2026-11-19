// Happy Little Dinosaurs — the official card pools (see types.ts for sources):
// - Base Game: 4 Dinosaur boards, 28 Disasters, 53 Point cards, 16 Instants
// - 5–6 Player Expansion: 2 boards, 14 Disasters, 24 Point cards, 12 Instants (50 cards)
// - Perils of Puberty: 16 Disasters, 28 Point cards, 10 Instants (54 cards)
// - Dating Disasters: 15 Disasters, 26 Point cards, 12 Instants (53 cards)
// - Hazards Ahead: 2 boards, 22 Disasters, 14 Point cards, 2 Instants, 12 Hazard cards (50 cards) —
//   the Hazard cards are listed for reference but never dealt (Hazard tokens are not modeled).

import type { RngState } from '@/core/rng';
import { shuffle } from '@/core/rng';
import type {
  HldCard,
  HldCardKind,
  HldDinoDef,
  HldDisasterCard,
  HldDisasterCategory,
  HldDisasterEffect,
  HldExpansionId,
  HldPlayCardType,
} from './types';

export const HLD_DINO_DEFS: readonly HldDinoDef[] = [
  { id: 'nervous-rex', name: 'Nervous Rex', traits: { predator: 1, emotional: -1 }, text: '+1 against Predatory Disasters, −1 against Emotional Disasters.' },
  { id: 'cry-ceratops', name: 'Cry Ceratops', traits: { emotional: 1, natural: -1 }, text: '+1 against Emotional Disasters, −1 against Natural Disasters.' },
  { id: 'bad-luck-bronto', name: 'Bad Luck Bronto', traits: { natural: 1, predator: -1 }, text: '+1 against Natural Disasters, −1 against Predatory Disasters.' },
  { id: 'stego', name: 'Stego', traits: { meteor: 1 }, text: '+1 against Meteors. No weakness.' },
  {
    id: 'pterry-dactyl',
    name: 'Pterry Dactyl',
    traits: { emotional: 1, predator: 1, natural: -2 },
    expansion: 'players-5-6',
    text: '+1 against Emotional and Predatory Disasters, −2 against Natural Disasters.',
  },
  {
    id: 'raging-raptor',
    name: 'Raging Raptor',
    traits: { predator: 2, emotional: -1, natural: -1 },
    expansion: 'players-5-6',
    text: '+2 against Predatory Disasters, −1 against Emotional and Natural Disasters.',
  },
  {
    id: 'easygoing-anky',
    name: 'Easygoing Anky',
    traits: { hazard: 1, natural: -1 },
    expansion: 'hazards-ahead',
    text: '−1 against Natural Disasters. (Its Hazard +1 trait is not modeled.)',
  },
  {
    id: 'moody-mosasaur',
    name: 'Moody Mosasaur',
    traits: { hazard: 1, emotional: -1 },
    expansion: 'hazards-ahead',
    text: '−1 against Emotional Disasters. (Its Hazard +1 trait is not modeled.)',
  },
];

/** The boards available with these expansions, in board order. */
export function availableDinos(expansions: readonly HldExpansionId[]): HldDinoDef[] {
  return HLD_DINO_DEFS.filter((d) => !d.expansion || expansions.includes(d.expansion));
}

export interface HldDisasterDef {
  name: string;
  category: HldDisasterCategory;
  text: string;
  effect?: HldDisasterEffect;
  count?: number;
}

const METEOR_TEXT = 'This card acts as any type of Disaster card.';

export const HLD_DISASTER_DEFS: readonly HldDisasterDef[] = [
  // Natural (8)
  { name: 'Spa Day', category: 'natural', text: 'Your relaxing spa day turns into tragedy as you start to sink in hot tar.' },
  { name: 'Uncommon Cold', category: 'natural', text: 'Is it just a cough… or are you secretly dying? Time to start panicking.' },
  { name: 'Bright Idea', category: 'natural', text: '"The sun isn\'t actually that bright," they said. You proved them wrong.' },
  { name: 'Leaf Me Alone', category: 'natural', text: 'You get cut by a particularly sharp leaf.' },
  { name: 'Downpour', category: 'natural', text: 'When it rains, it pours… but only on you.' },
  { name: 'This Feels Personal', category: 'natural', text: 'A small earthquake hits only under you. You fall through a crack in the earth.' },
  { name: 'Trapped', category: 'natural', text: 'If a tree falls on you in a forest and no one is around to save you, is this your new life now?' },
  { name: 'Casual Afternoon Stroll', category: 'natural', text: "You hike a volcano that's been dormant for thousands of years. It erupts." },
  // Predatory (8)
  { name: 'A Day At The Beach', category: 'predator', text: 'Your beach day turns into a whale of a surprise…' },
  { name: 'Feeling Squirrely', category: 'predator', text: 'Life is going great! Just kidding. You are attacked by sabertoothed squirrels.' },
  { name: 'Shark With Legs', category: 'predator', text: 'Just your average day, running in horror from a land shark.' },
  { name: 'Armed And Dangerous', category: 'predator', text: 'The tiny dinos looked adorable until they threatened you and your family.' },
  { name: 'Stomped', category: 'predator', text: "You're crushed by a mega dino and your herd awkwardly walks away." },
  { name: 'Love Hurts', category: 'predator', text: 'All you want is to be loved. A boa constrictor gives you a "hug".' },
  { name: "Lil' Cannibal", category: 'predator', text: 'Maybe next time think twice before babysitting a carnivore.' },
  { name: 'Fired Up', category: 'predator', text: 'Prehistoric fire ants unleash their wrath on you for napping on their hill.' },
  // Emotional (8)
  { name: 'Baddest Hair Day', category: 'emotional', text: 'You try to cut your own hair. You watch as your self-esteem falls to the floor.' },
  { name: 'Emergency Ex-it', category: 'emotional', text: 'Looks like your ex is better off without you after all…' },
  { name: 'Ghosted', category: 'emotional', text: 'You get ghosted by your dino date.' },
  { name: 'Left Behind…Again', category: 'emotional', text: 'Your friends plan a road trip without you.' },
  { name: 'Ooh, Burn…', category: 'emotional', text: 'The cookies you were looking forward to all day burned to a crisp.' },
  { name: 'Outer Circle', category: 'emotional', text: 'Are the other dinosaurs really talking about you? Yes.' },
  { name: 'The Future Is Bleak', category: 'emotional', text: "You visit a fortune teller and the crystal ball explodes… that can't be a good sign." },
  { name: 'The Sad Truth', category: 'emotional', text: 'You lie awake at night thinking about how much of a disappointment you are.' },
  // Meteor (4)
  { name: 'Meteor!', category: 'meteor', text: METEOR_TEXT, count: 4 },
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

/** A plain Point card. */
const pt = (kind: HldCardKind, name: string, value: number, count: number): HldCardDef => ({
  kind, name, type: 'point', value, count, hasEffect: false, text: `Point Value: ${value}.`,
});
/** A Point card with an effect. */
const fx = (kind: HldCardKind, name: string, value: number, count: number, text: string): HldCardDef => ({
  kind, name, type: 'point', value, count, hasEffect: true, text,
});
/** An Instant card. */
const inst = (kind: HldCardKind, name: string, count: number, text: string): HldCardDef => ({
  kind, name, type: 'instant', value: null, count, hasEffect: true, text,
});

const DURING_SCORING = 'Play this card during scoring.';
const IF_DISASTER = 'Play this card if you would add a Disaster card to your Disaster Area this round.';

const TXT = {
  petRock: 'You may discard a Point card from your hand, then add its point value to your score this round.',
  dinoGrabber: "You may look at another player's hand. Choose a card and add it to your hand.",
  grapplingSnake: 'You may swap this card with the Point card of the player to your right or left. You cannot swap for a card that has an effect.',
  smoothie: 'You may discard a Point card with an effect from your hand, then add its point value to your score this round.',
  fireSpray: 'You may discard up to 3 cards from your hand.',
  mouthTrap: 'During scoring this round, switch the score of the highest-scoring player with the score of the lowest-scoring player after scores have been calculated.',
  starFruit: 'During scoring this round, double the effects of Score Booster and Score Sapper cards.',
  treenoculars: 'You may look at the top 2 cards in the deck. Choose a card and add it to your hand. Discard the other card.',
  hungryPlant: 'You may swap the Point cards of any two other players.',
  chainsaw: 'During this round, all other Point card effects are ignored.',
  booster: `${DURING_SCORING} Add 2 points to any player's score this round.`,
  sapper: `${DURING_SCORING} Subtract 2 points from any player's score this round.`,
  inversion: `${DURING_SCORING} Switch the score of the highest-scoring player with the score of the lowest-scoring player after scores have been calculated.`,
  insurance: `${IF_DISASTER} Move that Disaster card to the bottom of the Disaster deck instead.`,
  redirect: `${IF_DISASTER} Add that Disaster card to another player's Disaster Area instead.`,
} as const;

export const HLD_MAIN_DECK_DEFS: readonly HldCardDef[] = [
  // Point cards (53)
  fx('pet-rock', 'Pet Rock', 0, 4, TXT.petRock),
  pt('cool-stick', 'Cool Stick', 1, 4),
  fx('dino-grabber', 'Dino Grabber', 1, 2, TXT.dinoGrabber),
  pt('handy-pan', 'Handy Pan', 2, 4),
  fx('grappling-snake', 'Grappling Snake', 2, 2, TXT.grapplingSnake),
  pt('grave-maker', 'Grave Maker', 3, 4),
  fx('delicious-smoothie', '"Delicious" Smoothie', 3, 2, TXT.smoothie),
  pt('bonehead', 'Bonehead', 4, 4),
  fx('fire-spray', 'Fire Spray', 4, 2, TXT.fireSpray),
  pt('run-home-bat', 'Run Home Bat', 5, 4),
  fx('mouth-trap', 'Mouth Trap', 5, 2, TXT.mouthTrap),
  pt('bow-and-dino', 'Bow and Dino', 6, 4),
  fx('special-star-fruit', 'Special Star Fruit', 6, 2, TXT.starFruit),
  pt('sting-stabber', 'Sting Stabber', 7, 3),
  fx('treenoculars', 'Treenoculars', 7, 2, TXT.treenoculars),
  pt('iced-ptea', 'Iced Ptea', 8, 3),
  fx('hungry-plant', 'Hungry Plant', 8, 1, TXT.hungryPlant),
  pt('meteor-cannon', 'Meteor Cannon', 9, 3),
  fx('flaming-chainsaw', 'Flaming Chainsaw', 9, 1, TXT.chainsaw),
  // Instant cards (16)
  inst('score-booster', 'Score Booster', 5, TXT.booster),
  inst('score-sapper', 'Score Sapper', 5, TXT.sapper),
  inst('score-inversion', 'Score Inversion', 2, TXT.inversion),
  inst('disaster-insurance', 'Disaster Insurance', 3, TXT.insurance),
  inst('disaster-redirect', 'Disaster Redirect', 1, TXT.redirect),
];

// ============================================================================
// 5–6 Player Expansion (14 Disasters + 24 Point + 12 Instant = 50 cards)
// ============================================================================

export const HLD_5_6_DISASTER_DEFS: readonly HldDisasterDef[] = [
  { name: 'Allergies', category: 'natural', text: 'You thought you were going to get honey, but all you feel is the sting of failure.' },
  { name: 'Oh, Poo', category: 'natural', text: 'You come across a particularly offensive pile of poop.' },
  { name: 'Prized Produce', category: 'natural', text: 'The tomatoes you grew all summer were trampled by a pack of velociraptors.' },
  { name: 'Ptornado!', category: 'natural', text: "Pterodactyls start flying in a circle directly above your head. This won't end well." },
  { name: 'Getting Carried Away', category: 'predator', text: 'You always wondered what it would be like to fly. Now you know.' },
  { name: 'Lower Back Pain', category: 'predator', text: 'Next time you get sassy with a T-Rex, you\'ll know not to say "bite me".' },
  { name: 'Wild Chicken Attack', category: 'predator', text: 'A wild chicken appears. And attacks.' },
  { name: 'Wrapped Up', category: 'predator', text: 'A giant spider has turned you into a burrito.' },
  { name: 'Dissed', category: 'emotional', text: 'Someone got you with a "your mom" joke and you spend the day thinking up a comeback.' },
  { name: 'Parent of the Year', category: 'emotional', text: 'You only left the nest for five minutes…' },
  { name: 'Plot Twist', category: 'emotional', text: 'Your favorite book was turned into a movie. You will now live in regret forever.' },
  { name: 'Zit City', category: 'emotional', text: 'You have a big date tonight, and you woke up with the breakout of the century.' },
  { name: 'Meteor!', category: 'meteor', text: METEOR_TEXT, count: 2 },
];

export const HLD_5_6_MAIN_DECK_DEFS: readonly HldCardDef[] = [
  // Point cards (24)
  pt('cool-stick', 'Cool Stick', 1, 2),
  fx('good-luck-rod', 'Good Luck Rod', 1, 2, 'You may look at the top 3 cards in the deck. If at least one of them is a Point card, choose one of them and add its point value to your score this round, then discard all 3 cards.'),
  pt('handy-pan', 'Handy Pan', 2, 2),
  pt('grave-maker', 'Grave Maker', 3, 2),
  fx('isopod-swap', 'Isopod Swap', 3, 2, 'You may swap this card with the Point card of another player. You cannot swap for a card that has an effect.'),
  pt('bonehead', 'Bonehead', 4, 2),
  pt('run-home-bat', 'Run Home Bat', 5, 2),
  fx('voodoo-dino', 'Voodoo Dino', 5, 2, "You may discard any number of Point cards from your hand. For each card discarded, you may subtract 1 point from any player's score this round."),
  pt('bow-and-dino', 'Bow and Dino', 6, 2),
  pt('sting-stabber', 'Sting Stabber', 7, 2),
  fx('swiss-shears', 'Swiss Shears', 7, 1, 'During scoring this round, the effects of Score Booster and Score Sapper cards played by any other player are halved.'),
  pt('iced-ptea', 'Iced Ptea', 8, 1),
  pt('meteor-cannon', 'Meteor Cannon', 9, 1),
  fx('behemoth-blade', 'Behemoth Blade', 9, 1, 'During scoring this round, no player may play Instant cards.'),
  // Instant cards (12)
  inst('disaster-insurance', 'Disaster Insurance', 2, TXT.insurance),
  inst('disaster-redirect', 'Disaster Redirect', 1, TXT.redirect),
  inst('helping-hand', 'Helping Hand', 2, `${DURING_SCORING} Discard any number of Point cards with a value of 1, 2, or 3 from your hand, then add the point value of the discarded cards to your score this round.`),
  inst('score-booster', 'Score Booster', 3, TXT.booster),
  inst('score-inversion', 'Score Inversion', 1, TXT.inversion),
  inst('score-sapper', 'Score Sapper', 3, TXT.sapper),
];

// ============================================================================
// Perils of Puberty (16 Disasters + 28 Point + 10 Instant = 54 cards)
// ============================================================================

export const HLD_PUBERTY_DISASTER_DEFS: readonly HldDisasterDef[] = [
  { name: 'Art Class', category: 'emotional', text: 'You fall asleep in class and everyone draws on your face, including your teacher.' },
  { name: 'Doomed to Failure', category: 'emotional', text: 'Your classmates vote you "Most likely to fail."' },
  { name: 'Fire Drill', category: 'emotional', effect: 'counts-double', text: 'This card counts as 2 Emotional Disasters. The fire alarm rings while you change for gym.' },
  { name: 'Say Cheese!', category: 'emotional', text: "It's picture day, and you forgot how to smile." },
  { name: "You're Out", category: 'emotional', text: "You get hit in the face with a dodgeball in front of your crush." },
  // Category of Hairy Situation is inferred (the dataset files its text under a misnamed Natural card).
  { name: 'Hairy Situation', category: 'natural', text: "Your body hair is growing at an alarmingly accelerated rate. This doesn't seem normal." },
  { name: 'Hot and Steamy', category: 'natural', text: 'Your glasses fog up walking through the hot springs. You trip into a geyser.' },
  { name: 'Oh Hail No', category: 'natural', text: "It's raining golf-ball sized hail, and you still have a 3-mile walk home." },
  { name: 'Shocking!', category: 'natural', text: '' },
  { name: 'Total Loss', category: 'natural', effect: 'counts-double', text: 'This card counts as 2 Natural Disasters. A giant boulder falls on your first car.' },
  { name: 'Hungry Hungry Dinos', category: 'predator', effect: 'counts-double', text: 'This card counts as 2 Predatory Disasters. You are sent to boarding school with carnivores.' },
  { name: 'Pet Problems', category: 'predator', text: 'Your pet velociraptor ate your homework, and no one will believe you.' },
  { name: 'Rabid Rabbit', category: 'predator', text: "A bunny bites you while you fetch your ball from the neighbor's lawn." },
  { name: 'Raving Madness', category: 'predator', text: 'A herd of bigger dinos tramples you on the way into your first concert.' },
  { name: 'Super Murder Hornets', category: 'predator', text: 'Your class visits the insectarium. Giant hornets attack you.' },
  { name: 'Meteor!', category: 'meteor', text: METEOR_TEXT },
];

export const HLD_PUBERTY_MAIN_DECK_DEFS: readonly HldCardDef[] = [
  // Point cards (28)
  fx('trash-into-treasure', 'Trash into Treasure', 0, 2, 'You may discard up to 3 cards. For each card you discard, add 3 points to your score this round.'),
  pt('cool-stick', 'Cool Stick', 1, 2),
  pt('handy-pan', 'Handy Pan', 2, 2),
  fx('unwanted-lunch', 'Unwanted Lunch', 2, 2, 'You may swap hands with another player.'),
  pt('grave-maker', 'Grave Maker', 3, 2),
  pt('bonehead', 'Bonehead', 4, 2),
  fx('handy-backpack', 'Handy Backpack', 4, 2, 'During scoring this round, add 2 points to your score for each Disaster card in your Disaster Area.'),
  pt('run-home-bat', 'Run Home Bat', 5, 2),
  pt('bow-and-dino', 'Bow and Dino', 6, 2),
  fx('ice-cream', 'Ice Cream!', 6, 2, 'If you have the highest score this round at the end of scoring, move a Disaster card from your Disaster Area to the bottom of the Disaster deck.'),
  pt('sting-stabber', 'Sting Stabber', 7, 2),
  pt('iced-ptea', 'Iced Ptea', 8, 2),
  fx('really-thick-glasses', 'Really Thick Glasses', 8, 1, 'Look at the top card of the Disaster deck. You may either place it back on top of the Disaster deck or move it to the bottom of the Disaster deck.'),
  pt('meteor-cannon', 'Meteor Cannon', 9, 2),
  fx('extra-sharp-stick', 'Extra Sharp Stick', 9, 1, 'If you have the highest score this round at the end of scoring, collect 2 additional points.'),
  // Instant cards (10)
  inst('bffs-help', "BFF's Help", 2, `${DURING_SCORING} Add 3 points to any player's score this round.`),
  inst('frenemys-curse', "Frenemy's Curse", 2, `${DURING_SCORING} Subtract 3 points from any player's score this round.`),
  inst('joy-of-puberty', 'Joy of Puberty', 2, `${DURING_SCORING} Move your Dinosaur meeple backward on your Escape Route up to 5 spaces. For each space you move backward, add 1 point to any player's score this round.`),
  inst('spiteful-bullying', 'Spiteful Bullying', 2, `${DURING_SCORING} Move your Dinosaur meeple backward on your Escape Route up to 5 spaces. For each space you move backward, subtract 1 point from any player's score this round.`),
  inst('lucky-break', 'Lucky Break', 2, `${IF_DISASTER} Move that Disaster card to the bottom of the Disaster deck instead and collect 3 points.`),
];

// ============================================================================
// Dating Disasters (15 Disasters + 26 Point + 12 Instant = 53 cards)
// ============================================================================

const bonusText = (type: string) =>
  `During scoring each round, you may add 1 point to your score for each ${type} Disaster card in your Disaster Area.`;

export const HLD_DATING_DISASTER_DEFS: readonly HldDisasterDef[] = [
  { name: 'Awkward Greeting', category: 'emotional', text: 'Your date says hello and you reply "Good, how are you?"' },
  { name: 'Emergency Exit', category: 'emotional', text: "Your date talks nonstop about their ex. You search for an exit and realize you're trapped." },
  { name: 'Friend Zoned', category: 'emotional', text: 'You have fallen into the bottomless pit of despair. The dreaded friend zone.' },
  { name: 'I Love You', category: 'emotional', text: 'You try to say "I love hot sauce." Instead you say "I love you."' },
  { name: 'Waiting for a Reply', category: 'emotional', effect: 'scoring-bonus', text: bonusText('Emotional') },
  { name: 'Caught in the Rain', category: 'natural', effect: 'scoring-bonus', text: bonusText('Natural') },
  { name: 'Drifting Apart', category: 'natural', text: "Your date said even an ice age couldn't keep you apart. They lied." },
  { name: 'Table Manners', category: 'natural', text: 'Your date chews loudly with their mouth open. You get caught in the crossfire.' },
  { name: 'Wave Goodbye', category: 'natural', text: 'A tsunami strikes on your first date in years. You lose your date to the sea.' },
  { name: "You're on Fire", category: 'natural', text: "You're at the bar chatting up dinos, and you're on fire. Literally." },
  { name: 'Catfished', category: 'predator', effect: 'scoring-bonus', text: bonusText('Predatory') },
  { name: 'Coolest Dino Ever', category: 'predator', text: 'You meet a dino so cool you totally understand when they leave with your date.' },
  { name: 'Pterrible Move', category: 'predator', text: "You accidentally liked your ex's photo. Your phone dies before you can unlike it." },
  { name: 'Picnic Pests', category: 'predator', text: 'You plan a romantic picnic. Tiny dinos steal your food. And your date.' },
  { name: 'Snack Attack', category: 'predator', text: "Your date said you're so cute they could eat you. They were serious." },
];

export const HLD_DATING_MAIN_DECK_DEFS: readonly HldCardDef[] = [
  // Point cards (26)
  fx('bouquet-of-flowers', 'Bouquet of Flowers', 4, 3, 'Reveal the top 3 cards of the deck. You may add all Instant cards to your hand. Discard all other cards.'),
  pt('wine-bottle', 'Wine Bottle', 4, 2),
  pt('broken-high-heel', 'Broken High Heel', 5, 2),
  fx('teddy-bear', 'Teddy Bear', 5, 3, 'At the end of the round, collect 5 points.'),
  pt('bedazzled-belt', 'Bedazzled Belt', 6, 2),
  fx('heart-bomb', 'Heart Bomb', 6, 3, 'At the end of the round, each player must discard all cards in their hand.'),
  pt('stinky-perfume', 'Stinky Perfume', 7, 2),
  fx('love-bug', 'Love Bug', 7, 2, 'During scoring this round, each other player must subtract 1 point from their score for each Instant card you play this round.'),
  pt('mixtape', 'Mixtape', 8, 1),
  fx('cold-feet', 'Cold Feet', 8, 3, 'During this round, you cannot play Instant cards.'),
  pt('box-of-chocolates', 'Box of Chocolates', 9, 2),
  fx('minty-gum', 'Minty Gum', 9, 1, 'During scoring this round, the advantages of your Dinosaur Traits are doubled.'),
  // Instant cards (12)
  inst('awkward-first-kiss', 'Awkward First Kiss', 2, `${IF_DISASTER} Collect 5 points.`),
  inst('baby-pictures', 'Baby Pictures', 3, `${DURING_SCORING} Choose a player. Move that player's Dinosaur meeple backward 3 spaces on their Escape Route.`),
  inst('crippling-shyness', 'Crippling Shyness', 2, `${DURING_SCORING} The highest-scoring player at the end of the round may only collect up to 5 points.`),
  inst('double-date', 'Double Date', 3, `${DURING_SCORING} The advantages and disadvantages of all Dinosaur Traits are doubled.`),
  inst('one-week-anniversary', 'One Week Anniversary', 2, `${DURING_SCORING} Swap the face-up Disaster card with a Disaster card in your Disaster Area.`),
];

// ============================================================================
// Hazards Ahead (22 Disasters + 14 Point + 2 Instant + 12 Hazard = 50 cards)
// ============================================================================

const HAZARD_TOKEN_TEXT =
  "When you add this Disaster card to your Disaster Area, you may add a Hazard token to any other player's Escape Route. (Hazard tokens are not modeled.)";
const luckyText = (then: string) =>
  `Lucky Day! When you add this Disaster card to your Disaster Area, move it to the bottom of the Disaster deck instead, then ${then}`;

export const HLD_HAZARDS_DISASTER_DEFS: readonly HldDisasterDef[] = [
  ...(['Bad Plant Parent', 'Emo Phase', 'Free Samples', 'Incoming Call', 'Search History Shame'] as const).map(
    (name): HldDisasterDef => ({ name, category: 'emotional', effect: 'hazard-token', text: HAZARD_TOKEN_TEXT }),
  ),
  ...(['Crabification', 'Hot Springs', 'Not So Fungi', 'Sinking Feeling', 'Spoiled Rotten'] as const).map(
    (name): HldDisasterDef => ({ name, category: 'natural', effect: 'hazard-token', text: HAZARD_TOKEN_TEXT }),
  ),
  ...(["Bigfoot's Revenge", "Don't Trip", 'Pyramid Scheme', 'Red Carpet Regret', 'To-Go Meal'] as const).map(
    (name): HldDisasterDef => ({ name, category: 'predator', effect: 'hazard-token', text: HAZARD_TOKEN_TEXT }),
  ),
  // Printed with all three Disaster types: modeled as a wild (Meteor-type) Disaster.
  { name: 'Coming In Hot', category: 'meteor', effect: 'hazard-token', count: 3, text: `Acts as any type of Disaster card. ${HAZARD_TOKEN_TEXT}` },
  { name: 'Fruit Shower', category: 'lucky', effect: 'fruit-shower', text: luckyText('look at the top 2 cards of the deck. Choose a card and add it to your hand, then discard the other.') },
  { name: 'One Of Us', category: 'lucky', effect: 'one-of-us', text: luckyText("move a Hazard card in your Hazard Area to another player's Hazard Area. (Hazard cards are not modeled.)") },
  { name: 'Treasure Trove', category: 'lucky', effect: 'treasure-trove', text: luckyText('search the discard pile for a Point card and add it to your hand.') },
  { name: 'Wishful Thinking', category: 'lucky', effect: 'wishful-thinking', text: luckyText("choose a player. Move that player's Dinosaur meeple backward 3 spaces on their Escape Route.") },
];

const NOT_MODELED = '(Hazard tokens are not modeled.)';

export const HLD_HAZARDS_MAIN_DECK_DEFS: readonly HldCardDef[] = [
  // Point cards (14)
  fx('spiky-shroom', 'Spiky Shroom', 2, 2, `If you have the lowest score this round at the end of scoring, you may add a Hazard token to another player's Escape Route. ${NOT_MODELED}`),
  fx('a-bone-to-flick', 'A Bone to Flick', 3, 2, `Discard up to 3 cards and add a Hazard token to another player's Escape Route. ${NOT_MODELED}`),
  fx('rock-candy', 'Rock Candy', 4, 2, 'During scoring this round, add 2 points to your score for each Hazard card in your Hazard Area. (Hazard cards are not modeled.)'),
  fx('molotov-crocktail', 'Molotov Crocktail', 5, 2, 'You may remove a Hazard card from your Hazard Area. (Hazard cards are not modeled.)'),
  fx('suck-up', 'Suck Up', 6, 2, `If you have the lowest score this round at the end of scoring, you may remove a Hazard token from your Escape Route. ${NOT_MODELED}`),
  fx('coconut-bolas', 'Coconut Bolas', 7, 2, `If you have the highest score this round at the end of scoring, you may add a Hazard token to another player's Escape Route. ${NOT_MODELED}`),
  fx('epic-flail', 'Epic Flail', 8, 2, 'You cannot play Instant cards this round.'),
  // Instant cards (2)
  inst('hazard-redirect', 'Hazard Redirect', 2, `Play this card if you would add a Hazard token to your Escape Route this round. Add that Hazard token to another player's Escape Route instead. ${NOT_MODELED}`),
];

export interface HldHazardDef {
  name: string;
  text: string;
}

/** The 12 Hazard cards (one of each) — reference only, never dealt. */
export const HLD_HAZARD_CARD_DEFS: readonly HldHazardDef[] = [
  { name: 'Brittle Bones', text: 'If this card is in your Hazard Area, you may only collect up to 7 points at the end of the round.' },
  { name: 'Icy Roads', text: 'If this card is in your Hazard Area, you cannot play Disaster Insurance cards during scoring.' },
  { name: 'Juice Cleanse', text: 'If this card is in your Hazard Area, ignore advantages from your Dinosaur Trait during scoring.' },
  { name: 'Leechy Keen', text: 'If this card is in your Hazard Area, you cannot play more than 1 Instant card per round.' },
  { name: 'Live. Laugh. Lava.', text: 'If this card is in your Hazard Area, the effects of Score Sapper and Score Booster cards you play are halved.' },
  { name: 'Ollie Oops', text: 'If this card is in your Hazard Area, subtract 2 from the value of Point cards you play during Sudden Death.' },
  { name: 'Restraining Order', text: 'If this card is in your Hazard Area, you cannot play Score Sapper cards during scoring.' },
  { name: 'Rex Marks The Spot', text: 'If this card is in your Hazard Area, subtract 1 point from your score for each Instant card you play during scoring.' },
  { name: 'Rock Slide', text: 'If this card is in your Hazard Area, double disadvantages from your Dinosaur Trait during scoring.' },
  { name: 'Slippery Slope', text: 'If this card is in your Hazard Area, each round after scores have been calculated, move your Dinosaur meeple backward 1 space on your Escape Route.' },
  { name: 'Tarnished Plans', text: 'If this card is in your Hazard Area, you cannot play Score Booster cards during scoring.' },
  { name: 'Up In Flames', text: 'If this card is in your Hazard Area, subtract 1 point from your score for each Hazard card in your Hazard Area during scoring.' },
];

/** Total copies across a list of defs (a Disaster def without `count` is one card). */
export const copies = (defs: readonly { count?: number }[]): number => defs.reduce((n, d) => n + (d.count ?? 1), 0);

export function buildHldDecks(
  rng: RngState,
  expansions: readonly HldExpansionId[] = [],
  opts: { removeLowPointCards?: boolean } = {},
): {
  disasterDeck: HldDisasterCard[];
  deck: HldCard[];
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

  const disasters: HldDisasterCard[] = [];
  for (const d of disasterSources) {
    for (let i = 0; i < (d.count ?? 1); i++) {
      disasters.push({ id: nextId++, name: d.name, category: d.category, text: d.text, ...(d.effect ? { effect: d.effect } : {}) });
    }
  }

  const cards: HldCard[] = [];
  for (const def of mainSources) {
    // 2-player rules: "remove all Point cards with a value of 1, 2, or 3 from the Main deck."
    if (opts.removeLowPointCards && def.type === 'point' && def.value !== null && def.value >= 1 && def.value <= 3) continue;
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
