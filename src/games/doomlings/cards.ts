// Doomlings — the Classic (2nd edition) card pool: 116 traits (107 distinct),
// 25 Ages, 15 Catastrophes and The Birth of Life; and the deck builder that
// mixes in the enabled expansion packs (their card lists live in packs/).
//
// Names, colours, face values, Dominant flags, Gene Pool modifiers and icons
// are taken from the atlas card data (see types.ts for sources) and were
// cross-checked against DoomPy. `text` is our own short summary of what the
// card does, not the printed wording.

import type { RngState } from '@/core/rng';
import { shuffle } from '@/core/rng';
import { CASTLE_GLASS_AGES, CASTLE_GLASS_CATASTROPHES, CASTLE_GLASS_TRAITS } from './packs/castle-glass';
import { IMAGINARY_ENDS_AGES, IMAGINARY_ENDS_CATASTROPHES, IMAGINARY_ENDS_TRAITS } from './packs/imaginary-ends';
import { OVERLUSH_AGES, OVERLUSH_CATASTROPHES, OVERLUSH_MYSTERY_DRAW, OVERLUSH_TRAITS } from './packs/overlush';
import type { DmAgeCard, DmAgeRuleTag, DmCardSource, DmCatastropheTag, DmTraitCard, DmTraitColor, DmTraitKind } from './types';
import { DM_BUILT_EXPANSIONS } from './types';

export type TraitSeed = Omit<DmTraitCard, 'id' | 'kind' | 'source' | 'genePoolDelta' | 'dominant'> & {
  k: DmTraitKind;
  dominant?: boolean;
  genePoolDelta?: number;
  copies?: number;
};

export const CLASSIC_TRAITS: readonly TraitSeed[] = [
  { k: 'adorable', name: 'Adorable', color: 'purple', points: 4, effectless: true, text: '' },
  { k: 'altruistic', name: 'Altruistic', color: 'colorless', points: 0, compassStar: true, dropOfLife: true, text: 'Worth your Gene Pool size.' },
  { k: 'antlers', name: 'Antlers', color: 'red', points: 3, effectless: true, text: '' },
  { k: 'apex-predator', name: 'Apex Predator', color: 'red', points: 4, dominant: true, dropOfLife: true, text: '+4 if you have more traits than every opponent (ties don’t count).' },
  { k: 'appealing', name: 'Appealing', color: 'green', points: 3, effectless: true, text: '' },
  { k: 'automimicry', name: 'Automimicry', color: 'blue', points: -1, playWhen: true, text: 'Play from your hand at any time to stop an Action.' },
  { k: 'bad', name: 'Bad', color: 'red', points: 1, action: true, text: 'Action: every opponent discards 2 random cards from their hand.' },
  { k: 'bark', name: 'Bark', color: 'green', points: 2, effectless: true, text: '' },
  { k: 'big-ears', name: 'Big Ears', color: 'purple', points: 1, effectless: true, text: '' },
  { k: 'blubber', name: 'Blubber', color: 'blue', points: 4, effectless: true, text: '' },
  { k: 'boredom', name: 'Boredom', color: 'colorless', points: 0, compassStar: true, dropOfLife: true, text: 'Worth the number of cards with effects in your hand.' },
  { k: 'branches', name: 'Branches', color: 'green', points: 0, dropOfLife: true, text: '+1 for every pair of green traits in each opponent’s pile.' },
  { k: 'brave', name: 'Brave', color: 'red', points: 1, dropOfLife: true, text: '+2 for each Dominant trait in your hand.' },
  { k: 'brute-strength', name: 'Brute Strength', color: 'red', points: 4, genePoolDelta: -1, text: '−1 Gene Pool.' },
  { k: 'camouflage', name: 'Camouflage', color: 'purple', points: 1, dominant: true, genePoolDelta: 1, dropOfLife: true, text: '+1 Gene Pool. +1 for each card in your hand.' },
  { k: 'chromatophores', name: 'Chromatophores', color: 'blue', points: 0, playWhen: true, text: 'Play from your hand at any time to stop an Action.' },
  { k: 'clever', name: 'Clever', color: 'purple', points: 1, action: true, text: 'Action: each opponent reveals a card from their hand; steal one of them and play it immediately.' },
  { k: 'cold-blood', name: 'Cold Blood', color: 'blue', points: 1, action: true, text: 'Action: draw 3. You may play one of them now.' },
  { k: 'confusion', name: 'Confusion', color: 'colorless', points: -2, effectless: true, text: '' },
  { k: 'costly-signaling', name: 'Costly Signaling', color: 'blue', points: -2, action: true, text: 'Action: return a trait from an opponent’s pile to their hand, then play another trait.' },
  { k: 'deep-roots', name: 'Deep Roots', color: 'green', points: 2, effectless: true, text: '' },
  { k: 'delicious', name: 'Delicious', color: 'colorless', points: 4, text: 'To play: you need a colorless trait in your pile.' },
  { k: 'denial', name: 'Denial', color: 'colorless', points: 4, dominant: true, text: 'Ignore the next catastrophe. (The Four Horsemen can’t be ignored.)' },
  { k: 'directly-register', name: 'Directly Register', color: 'purple', points: 1, action: true, text: 'Action: steal a trait with face value 1 from an opponent’s pile.' },
  { k: 'doting', name: 'Doting', color: 'colorless', points: 2, action: true, text: 'Action: give a card from your hand to an opponent.' },
  { k: 'dreamer', name: 'Dreamer', color: 'purple', points: 1, genePoolDelta: 1, text: '+1 Gene Pool.' },
  { k: 'echolocation', name: 'Echolocation', color: 'blue', points: 4, dominant: true, text: 'Until World’s End: draw 1 at the start of each of your turns.' },
  { k: 'egg-clusters', name: 'Egg Clusters', color: 'blue', points: -1, dropOfLife: true, text: '+1 for each blue trait in your pile (this one too).' },
  { k: 'eloquence', name: 'Eloquence', color: 'colorless', points: 1, worldsEnd: true, text: 'World’s End: play another trait from your hand, ignoring its Action.' },
  { k: 'endurance', name: 'Endurance', color: 'red', points: 1, text: 'If you discard this from your pile, it comes straight back.' },
  { k: 'faith', name: 'Faith', color: 'colorless', points: 4, dominant: true, worldsEnd: true, text: 'World’s End: you may turn all your traits of one colour into another colour.' },
  { k: 'fangs', name: 'Fangs', color: 'red', points: 1, effectless: true, text: '' },
  { k: 'fear', name: 'Fear', color: 'colorless', points: 1, effectless: true, text: '' },
  { k: 'fecundity', name: 'Fecundity', color: 'green', points: 1, genePoolDelta: 1, text: '+1 Gene Pool.' },
  { k: 'fine-motor-skills', name: 'Fine Motor Skills', color: 'purple', points: 2, effectless: true, text: '' },
  { k: 'fire-skin', name: 'Fire Skin', color: 'red', points: 3, effectless: true, text: '' },
  { k: 'flatulence', name: 'Flatulence', color: 'colorless', points: 3, effectless: true, text: '' },
  { k: 'flight', name: 'Flight', color: 'blue', points: 2, action: true, text: 'Action: swap hands with an opponent.' },
  { k: 'fortunate', name: 'Fortunate', color: 'green', points: 0, compassStar: true, dropOfLife: true, text: 'Worth the number of cards in your hand.' },
  { k: 'gills', name: 'Gills', color: 'blue', points: 1, effectless: true, text: '' },
  { k: 'gratitude', name: 'Gratitude', color: 'colorless', points: 0, compassStar: true, dropOfLife: true, text: 'Worth the number of different colours in your pile.' },
  { k: 'heat-vision', name: 'Heat Vision', color: 'red', points: -1, dropOfLife: true, text: '+1 for each red trait in your pile (this one too).' },
  { k: 'heroic', name: 'Heroic', color: 'green', points: 7, dominant: true, text: 'To play: you need 3 or more green traits in your pile.' },
  { k: 'hot-temper', name: 'Hot Temper', color: 'red', points: 2, action: true, text: 'Action: discard 2 cards from your hand.' },
  { k: 'hyper-intelligence', name: 'Hyper-Intelligence', color: 'red', points: 4, dominant: true, worldsEnd: true, text: 'World’s End: choose a colour. Every opponent discards a random trait of that colour from their pile.' },
  { k: 'immunity', name: 'Immunity', color: 'blue', points: 4, dominant: true, dropOfLife: true, text: '+2 for each trait with a negative face value in your pile.' },
  { k: 'impatience', name: 'Impatience', color: 'purple', points: 1, action: true, text: 'Action: steal 2 random cards from an opponent’s hand.' },
  { k: 'introspective', name: 'Introspective', color: 'colorless', points: 1, action: true, text: 'Action: draw 4.' },
  { k: 'inventive', name: 'Inventive', color: 'purple', points: 1, action: true, text: 'Action: play the Action of a trait in an opponent’s pile.' },
  { k: 'iridescent-scales', name: 'Iridescent Scales', color: 'blue', points: 1, action: true, text: 'Action: draw 3.' },
  { k: 'just', name: 'Just', color: 'colorless', points: 2, genePoolDelta: 1, text: '+1 Gene Pool.' },
  { k: 'kidney', name: 'Kidney', color: 'red', points: 0, compassStar: true, dropOfLife: true, copies: 6, text: 'Worth the number of Kidneys in your pile (this one too).' },
  { k: 'late', name: 'Late', color: 'colorless', points: 1, playWhen: true, text: 'You may play this from your hand right after you stabilize.' },
  { k: 'leaves', name: 'Leaves', color: 'green', points: 1, effectless: true, text: '' },
  { k: 'memory', name: 'Memory', color: 'purple', points: 2, action: true, text: 'Action: you may discard your hand and stabilize.' },
  { k: 'migratory', name: 'Migratory', color: 'blue', points: 2, effectless: true, text: '' },
  { k: 'mindful', name: 'Mindful', color: 'colorless', points: 0, dropOfLife: true, text: '+1 for each colorless trait in your pile (this one too).' },
  { k: 'mitochondrion', name: 'Mitochondrion', color: 'colorless', points: 1, genePoolDelta: 1, text: '+1 Gene Pool.' },
  { k: 'morality', name: 'Morality', color: 'colorless', points: 5, text: 'To play: give a trait with a positive face value from your pile to an opponent.' },
  { k: 'nocturnal', name: 'Nocturnal', color: 'purple', points: 3, effectless: true, text: '' },
  { k: 'nosy', name: 'Nosy', color: 'purple', points: 1, action: true, text: 'Action: look at 2 random cards from an opponent’s hand. Steal one and play it immediately.' },
  { k: 'optimistic-nihilism', name: 'Optimistic Nihilism', color: 'colorless', points: 4, dominant: true, text: 'Bring on the next catastrophe: skip all turns and every age (and its effect) on the way. Don’t stabilize.' },
  { k: 'overgrowth', name: 'Overgrowth', color: 'green', points: -1, dropOfLife: true, text: '+1 for each green trait in your pile (this one too).' },
  { k: 'pack-behavior', name: 'Pack Behavior', color: 'green', points: 3, dominant: true, dropOfLife: true, text: '+1 for every pair of same-colour traits in your pile.' },
  { k: 'painted-shell', name: 'Painted Shell', color: 'blue', points: 1, action: true, text: 'Action: play the Action of another trait in your pile.' },
  { k: 'parasitic', name: 'Parasitic', color: 'purple', points: -2, playWhen: true, text: 'When an opponent plays a trait, you may play this from your hand: steal that trait and stop its Action.' },
  { k: 'persuasive', name: 'Persuasive', color: 'purple', points: 1, action: true, text: 'Action: choose a colour. Every player (you too) discards every card of that colour from their hand.' },
  { k: 'photosynthesis', name: 'Photosynthesis', color: 'green', points: 1, action: true, text: 'Action: draw 2. If either is green, play one immediately (unless restricted).' },
  { k: 'poisonous', name: 'Poisonous', color: 'purple', points: 2, action: true, text: 'Action: swap this with a trait in an opponent’s pile.' },
  { k: 'pollination', name: 'Pollination', color: 'green', points: 1, dropOfLife: true, text: '+1 for every trait in your pile with face value 1 (this one too).' },
  { k: 'prepper', name: 'Prepper', color: 'colorless', points: 2, worldsEnd: true, text: 'World’s End: choose which of the 3 catastrophes’ World’s End effects the game ends on.' },
  { k: 'propagation', name: 'Propagation', color: 'green', points: 1, action: true, text: 'Action: play another trait.' },
  { k: 'quick', name: 'Quick', color: 'red', points: 2, effectless: true, text: '' },
  { k: 'random-fertilization', name: 'Random Fertilization', color: 'green', points: 0, compassStar: true, dropOfLife: true, text: 'Worth your Gene Pool size.' },
  { k: 'reckless', name: 'Reckless', color: 'red', points: 3, action: true, text: 'Action: you and an opponent each discard a trait from the other’s pile (never this one).' },
  { k: 'regenerative-tissue', name: 'Regenerative Tissue', color: 'blue', points: 0, text: 'Whenever you discard a trait from your pile (this one too): draw 1 and play it immediately, ignoring its Action (unless restricted).' },
  { k: 'retractable-claws', name: 'Retractable Claws', color: 'red', points: 5, text: 'To play: discard a red trait from your pile.' },
  { k: 'saliva', name: 'Saliva', color: 'blue', points: 1, genePoolDelta: 1, text: '+1 Gene Pool.' },
  { k: 'saudade', name: 'Saudade', color: 'colorless', points: 1, dropOfLife: true, text: '+1 for each different colour in your hand.' },
  { k: 'scutes', name: 'Scutes', color: 'blue', points: 3, action: true, text: 'Action: give a trait from your pile to an opponent.' },
  { k: 'selective-memory', name: 'Selective Memory', color: 'blue', points: 0, action: true, text: 'Action: play a trait from the discard pile — and play its Action.' },
  { k: 'self-awareness', name: 'Self-Awareness', color: 'colorless', points: -1, playWhen: true, text: 'You may play this from your hand into an opponent’s pile at any time.' },
  { k: 'self-replicating', name: 'Self-Replicating', color: 'green', points: 0, action: true, text: 'Action: play a trait from the discard pile, ignoring its Action. When you play another green trait from your hand, you may return this to your hand.' },
  { k: 'selfish', name: 'Selfish', color: 'purple', points: 1, action: true, text: 'Action: steal a red trait from an opponent’s pile.' },
  { k: 'sentience', name: 'Sentience', color: 'red', points: 2, dominant: true, dropOfLife: true, worldsEnd: true, text: 'World’s End: choose a colour. +1 for each of your traits of that colour.' },
  { k: 'sneaky', name: 'Sneaky', color: 'purple', points: 2, worldsEnd: true, playWhen: true, text: 'At World’s End you may play this from your hand.' },
  { k: 'spiny', name: 'Spiny', color: 'blue', points: 1, effectless: true, text: '' },
  { k: 'sticky-secretions', name: 'Sticky Secretions', color: 'purple', points: -1, dropOfLife: true, text: '+1 for each purple trait in your pile (this one too).' },
  { k: 'stone-skin', name: 'Stone Skin', color: 'red', points: 2, effectless: true, text: '' },
  { k: 'super-spreader', name: 'Super Spreader', color: 'purple', points: 2, text: 'While this is in play, every player (you too) has −1 Gene Pool.' },
  { k: 'swarm', name: 'Swarm', color: 'green', points: 0, compassStar: true, dropOfLife: true, isSwarm: true, copies: 5, text: 'Worth the number of Swarm traits in all piles (this one too).' },
  { k: 'sweat', name: 'Sweat', color: 'blue', points: 2, action: true, text: 'Action: discard 1 card from your hand.' },
  { k: 'symbiosis', name: 'Symbiosis', color: 'green', points: 3, dominant: true, dropOfLife: true, text: '+2 for each trait of your lowest colour count (needs 2+ colours).' },
  { k: 'teeth', name: 'Teeth', color: 'purple', points: 1, genePoolDelta: 1, text: '+1 Gene Pool.' },
  { k: 'telekinetic', name: 'Telekinetic', color: 'purple', points: 1, action: true, text: 'Action: swap a trait in your pile with an opponent’s trait of a different colour.' },
  { k: 'tentacles', name: 'Tentacles', color: 'blue', points: 1, action: true, text: 'Action: swap a trait in your pile with an opponent’s trait of the same colour.' },
  { k: 'territorial', name: 'Territorial', color: 'red', points: 1, action: true, text: 'Action: every opponent discards a red trait from their pile.' },
  { k: 'the-third-eye', name: 'The Third Eye', color: 'colorless', points: 0, action: true, text: 'Action: peek at the next age, then play another trait.' },
  { k: 'tiny', name: 'Tiny', color: 'blue', points: 17, dominant: true, dropOfLife: true, text: '−1 for each trait in your pile (this one too).' },
  { k: 'tiny-little-melons', name: 'Tiny Little Melons', color: 'green', points: 1, action: true, text: 'Action: steal a green trait from an opponent’s pile.' },
  { k: 'trunk', name: 'Trunk', color: 'green', points: 1, action: true, text: 'Action: play the top card of the discard pile, ignoring its Action.' },
  { k: 'vampirism', name: 'Vampirism', color: 'purple', points: 3, dominant: true, text: 'When played: steal a trait from an opponent’s pile and play its Action.' },
  { k: 'venomous', name: 'Venomous', color: 'purple', points: -2, action: true, text: 'Action: play another trait, then move this to an opponent’s pile.' },
  { k: 'viral', name: 'Viral', color: 'purple', points: 2, dominant: true, dropOfLife: true, worldsEnd: true, text: 'World’s End: choose a colour. Opponents get −1 for each trait of that colour in their pile.' },
  { k: 'voracious', name: 'Voracious', color: 'red', points: 2, action: true, text: 'Action: play another trait, then discard a trait from your pile.' },
  { k: 'warm-blood', name: 'Warm Blood', color: 'red', points: -1, genePoolDelta: 2, text: '+2 Gene Pool.' },
  { k: 'woody-stems', name: 'Woody Stems', color: 'green', points: 1, effectless: true, text: '' },
];

export type AgeSeed = { name: string; ruleTag: DmAgeRuleTag; text: string };

export const CLASSIC_AGES: readonly AgeSeed[] = [
  { name: 'Age of Dracula', ruleTag: 'dracula', text: 'Everyone discards 1 random card from their hand. Anyone with Vampirism in their pile then steals 1 random card from an opponent’s hand.' },
  { name: 'Age of Nietzsche', ruleTag: 'nietzsche', text: 'Instead of stabilizing this turn, you may discard your hand and draw 3.' },
  { name: 'Age of Peace', ruleTag: 'ignoreActions', text: 'Ignore all trait Actions.' },
  { name: 'Age of Wonder', ruleTag: 'stabilizeTo4', text: 'End your turn with exactly 4 cards in your hand.' },
  { name: 'Age of Reason', ruleTag: 'reason', text: 'Draw 3 cards. Keep 1 and discard the other 2.' },
  { name: 'Alien Terraform', ruleTag: 'alienTerraform', text: 'You may discard Dominant cards from your hand. If you do, stabilize immediately.' },
  { name: 'Arid Lands', ruleTag: 'noBlue', text: 'No one can play blue traits.' },
  { name: 'Awakening', ruleTag: 'awakening', text: 'Preview the next age before you take your turn.' },
  { name: 'Birth of a Hero', ruleTag: 'birthOfAHero', text: 'If you hold Heroic, play it now with no restrictions.' },
  { name: 'Coastal Formations', ruleTag: 'coastalFormations', text: 'Draw 1 card after you stabilize.' },
  { name: 'Comet Showers', ruleTag: 'cometShowers', text: 'Discard 1 random card from your hand.' },
  { name: 'Eclipse', ruleTag: 'noRed', text: 'No one can play red traits.' },
  { name: 'Enlightenment', ruleTag: 'enlightenment', text: 'You may discard up to 2 cards from your hand before you stabilize.' },
  { name: 'Flourish', ruleTag: 'flourish', text: 'Draw 2 cards.' },
  { name: 'Galactic Drift', ruleTag: 'galacticDrift', text: 'If you play a colorless trait, you may play another colorless trait.' },
  { name: 'Glacial Drift', ruleTag: 'maxFaceValue3', text: 'Only traits with a face value of 3 or lower can be played.' },
  { name: 'High Tides', ruleTag: 'highTides', text: 'If you play an effectless trait, you may play another effectless trait.' },
  { name: 'Lunar Retreat', ruleTag: 'noPurple', text: 'No one can play purple traits.' },
  { name: 'Natural Harmony', ruleTag: 'naturalHarmony', text: 'You can’t play a trait of the same colour as the last trait played.' },
  { name: 'Northern Winds', ruleTag: 'northernWinds', text: 'Draw 1 card, then discard 1 card from your hand.' },
  { name: 'Prosperity', ruleTag: 'prosperity', text: 'At the end of your turn you may choose not to stabilize.' },
  { name: 'Reforestation', ruleTag: 'protectTraitPiles', text: 'Traits in trait piles can’t be swapped, stolen or discarded.' },
  { name: 'Tectonic Shift', ruleTag: 'noGreen', text: 'No one can play green traits.' },
  { name: 'The Messiah', ruleTag: 'messiah', text: 'This round runs in reverse: the first player goes last and the last player goes first.' },
  { name: 'Tropical Lands', ruleTag: 'noColorless', text: 'No one can play colorless traits.' },
];

export type CatastropheSeed = { name: string; tag: DmCatastropheTag; genePoolDelta: number; text: string; worldsEndText: string };

export const CLASSIC_CATASTROPHES: readonly CatastropheSeed[] = [
  { name: 'AI Takeover', tag: 'aiTakeover', genePoolDelta: -1, text: 'Discard all but 1 card from your hand.', worldsEndText: 'Every non-Dominant colorless trait is worth 2, and its effects are ignored.' },
  { name: 'Deus Ex Machina', tag: 'deusExMachina', genePoolDelta: 0, text: 'Everyone stabilizes. Crisis averted.', worldsEndText: 'Draw a card and add its face value to your score (+5 at most), then discard it.' },
  { name: 'Glacial Meltdown', tag: 'glacialMeltdown', genePoolDelta: -1, text: 'Discard 2 random cards from your hand.', worldsEndText: 'Discard a blue trait from your pile.' },
  { name: 'Grey Goo', tag: 'greyGoo', genePoolDelta: 0, text: 'Discard your hand, then stabilize.', worldsEndText: '−5 to the player(s) with the most traits in their pile.' },
  { name: 'Ice Age', tag: 'iceAge', genePoolDelta: -1, text: 'Discard 1 card from your hand for every red trait in your pile.', worldsEndText: '−1 for every red trait in your pile.' },
  { name: 'Mass Extinction', tag: 'massExtinction', genePoolDelta: -1, text: 'Discard 1 card from your hand for every colorless trait in your pile.', worldsEndText: 'Discard a green trait from your pile.' },
  { name: 'Mega Tsunami', tag: 'megaTsunami', genePoolDelta: -1, text: 'Pass your hand to the player on your right.', worldsEndText: 'Discard a red trait from your pile.' },
  { name: 'Nuclear Winter', tag: 'nuclearWinter', genePoolDelta: -1, text: 'Stabilize, then discard 1 card from your hand.', worldsEndText: 'Discard a colorless trait from your pile.' },
  { name: 'Overpopulation', tag: 'overpopulation', genePoolDelta: 1, text: 'Draw 1 card for every colour in your pile.', worldsEndText: '+4 to the player(s) with the fewest traits in their pile.' },
  { name: 'Pulse Event', tag: 'pulseEvent', genePoolDelta: -1, text: 'Discard 1 card from your hand for every purple trait in your pile.', worldsEndText: 'Discard a purple trait from your pile.' },
  { name: 'Retrovirus', tag: 'retrovirus', genePoolDelta: -1, text: 'Discard 1 card from your hand for every green trait in your pile.', worldsEndText: '−1 for every green trait in your pile.' },
  { name: 'Solar Flare', tag: 'solarFlare', genePoolDelta: -1, text: 'Discard half your hand, rounded up.', worldsEndText: '−1 for every purple trait in your pile.' },
  { name: 'Super Volcano', tag: 'superVolcano', genePoolDelta: -1, text: 'Discard 1 card from your hand for every blue trait in your pile.', worldsEndText: '−1 for every blue trait in your pile.' },
  { name: 'The Big One', tag: 'theBigOne', genePoolDelta: -1, text: 'Give 1 card from your hand to each neighbour (left and right).', worldsEndText: '−2 for each colour missing from your pile.' },
  { name: 'The Four Horsemen', tag: 'fourHorsemen', genePoolDelta: -1, text: 'Discard a trait from your pile.', worldsEndText: 'Discard a trait with a face value of 4 or more from your pile.' },
];

const BIRTH_OF_LIFE_TEXT = 'Everyone’s Gene Pool starts at 5. Play 1 trait each turn, then stabilize to end it.';

export interface DmPackCards {
  traits: readonly TraitSeed[];
  ages: readonly AgeSeed[];
  catastrophes: readonly CatastropheSeed[];
}

/** Card lists by set: Classic plus every built expansion. */
export const DM_PACK_CARDS: Partial<Record<DmCardSource, DmPackCards>> = {
  classic: { traits: CLASSIC_TRAITS, ages: CLASSIC_AGES, catastrophes: CLASSIC_CATASTROPHES },
  'castle-glass': { traits: CASTLE_GLASS_TRAITS, ages: CASTLE_GLASS_AGES, catastrophes: CASTLE_GLASS_CATASTROPHES },
  overlush: { traits: OVERLUSH_TRAITS, ages: OVERLUSH_AGES, catastrophes: OVERLUSH_CATASTROPHES },
  'imaginary-ends': { traits: IMAGINARY_ENDS_TRAITS, ages: IMAGINARY_ENDS_AGES, catastrophes: IMAGINARY_ENDS_CATASTROPHES },
};

function expandTraits(seeds: readonly TraitSeed[], source: DmCardSource, firstId: number): DmTraitCard[] {
  const out: DmTraitCard[] = [];
  let id = firstId;
  for (const seed of seeds) {
    const { k, copies = 1, dominant = false, genePoolDelta = 0, ...rest } = seed;
    for (let i = 0; i < copies; i++) {
      out.push({ ...rest, id: id++, kind: k, dominant, genePoolDelta, source });
    }
  }
  return out;
}

function expandAges(pack: DmPackCards, source: DmCardSource, firstId: number): { ages: DmAgeCard[]; catastrophes: DmAgeCard[] } {
  let id = firstId;
  const ages = pack.ages.map((a): DmAgeCard => ({ id: id++, name: a.name, kind: 'age', genePoolDelta: 0, ruleTag: a.ruleTag, source, text: a.text }));
  const catastrophes = pack.catastrophes.map((c): DmAgeCard => ({
    id: id++, name: c.name, kind: 'catastrophe', genePoolDelta: c.genePoolDelta, ruleTag: 'none', catastrophe: c.tag,
    source, text: c.text, worldsEndText: c.worldsEndText,
  }));
  return { ages, catastrophes };
}

/** Every Classic trait card, ids from 1 (copies expanded). */
export function classicTraitCards(firstId = 1): DmTraitCard[] {
  return expandTraits(CLASSIC_TRAITS, 'classic', firstId);
}

/** Every trait card of one set (copies expanded). */
export function packTraitCards(source: DmCardSource, firstId = 1): DmTraitCard[] {
  const pack = DM_PACK_CARDS[source];
  return pack ? expandTraits(pack.traits, source, firstId) : [];
}

/** One set's Ages and Catastrophes. */
export function packAgeCards(source: DmCardSource, firstId: number): { ages: DmAgeCard[]; catastrophes: DmAgeCard[] } {
  const pack = DM_PACK_CARDS[source];
  return pack ? expandAges(pack, source, firstId) : { ages: [], catastrophes: [] };
}

export function classicAgeCards(firstId: number): { ages: DmAgeCard[]; catastrophes: DmAgeCard[]; birthOfLife: DmAgeCard } {
  const birthOfLife: DmAgeCard = { id: firstId, name: 'The Birth of Life', kind: 'birthOfLife', genePoolDelta: 0, ruleTag: 'none', source: 'classic', text: BIRTH_OF_LIFE_TEXT };
  return { ...expandAges(DM_PACK_CARDS.classic!, 'classic', firstId + 1), birthOfLife };
}

/** The sets in play: Classic, then each enabled built expansion (in a fixed order). */
export function setsInPlay(expansions: readonly string[]): DmCardSource[] {
  return ['classic', ...DM_BUILT_EXPANSIONS.filter((id) => expansions.includes(id))];
}

/**
 * Setup, per the rulesheet: shuffle the ages and deal 3 piles of 3; shuffle
 * the catastrophes and add 1 to each pile; shuffle each pile on its own;
 * stack them and put The Birth of Life on top. Shuffle the traits.
 *
 * Bolster packs (Castle Glass): their traits, Ages and Catastrophe are
 * shuffled into the base decks before dealing. UNCONFIRMED: the rules card
 * only says "the base game of Doomlings is required to play".
 *
 * Overlush, per its rulesheet ("the Mystery Expansion experience"): its basic
 * traits, Dominants, Ages and Catastrophes are shuffled as four piles, and 40
 * traits, 8 Dominants, 8 Ages and 4 Catastrophes are drawn and added to the
 * game; the rest stay in the box.
 */
export function buildDmDecks(rng: RngState, expansions: readonly string[] = []): { traitDeck: DmTraitCard[]; ageDeck: DmAgeCard[]; birthOfLife: DmAgeCard } {
  const sets = setsInPlay(expansions);
  const traits: DmTraitCard[] = [];
  // Ids are numbered over every card of every set in play, so they stay
  // stable whatever the Overlush draw picks.
  let firstId = 1;
  for (const set of sets) {
    const all = packTraitCards(set, firstId);
    firstId += all.length;
    if (set === 'overlush') {
      const basic = shuffle(rng, all.filter((c) => !c.dominant)).slice(0, OVERLUSH_MYSTERY_DRAW.traits);
      const doms = shuffle(rng, all.filter((c) => c.dominant)).slice(0, OVERLUSH_MYSTERY_DRAW.dominants);
      traits.push(...basic, ...doms);
    } else {
      traits.push(...all);
    }
  }
  let next = firstId;
  const birthOfLife: DmAgeCard = { id: next++, name: 'The Birth of Life', kind: 'birthOfLife', genePoolDelta: 0, ruleTag: 'none', source: 'classic', text: BIRTH_OF_LIFE_TEXT };
  const ages: DmAgeCard[] = [];
  const catastrophes: DmAgeCard[] = [];
  for (const set of sets) {
    const pack = DM_PACK_CARDS[set]!;
    const got = expandAges(pack, set, next);
    next += got.ages.length + got.catastrophes.length;
    if (set === 'overlush') {
      ages.push(...shuffle(rng, got.ages).slice(0, OVERLUSH_MYSTERY_DRAW.ages));
      catastrophes.push(...shuffle(rng, got.catastrophes).slice(0, OVERLUSH_MYSTERY_DRAW.catastrophes));
    } else {
      ages.push(...got.ages);
      catastrophes.push(...got.catastrophes);
    }
  }
  // Classic-only id order is unchanged: ages, then catastrophes, numbered per set.
  const allAges = shuffle(rng, ages);
  const allCats = shuffle(rng, catastrophes);
  const piles = [0, 1, 2].map((i) => shuffle(rng, [...allAges.slice(i * 3, i * 3 + 3), allCats[i]!]));
  return { traitDeck: shuffle(rng, traits), ageDeck: piles.flat(), birthOfLife };
}

/** A trait's colours (colorless traits have none; Imaginary Ends' four-colour traits have all four). */
export function printedColors(card: Pick<DmTraitCard, 'color' | 'secondaryColor' | 'isAllColors'>): DmTraitColor[] {
  if (card.isAllColors) return ['red', 'blue', 'green', 'purple'];
  const out: DmTraitColor[] = [];
  if (card.color !== 'colorless') out.push(card.color);
  if (card.secondaryColor && card.secondaryColor !== 'colorless' && card.secondaryColor !== card.color) out.push(card.secondaryColor);
  return out;
}
