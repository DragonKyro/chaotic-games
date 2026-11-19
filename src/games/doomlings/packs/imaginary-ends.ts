// Doomlings — Imaginary Ends (2024): the Deeplings, Glitterlings, Moonlings
// and Fuzelings collections — 64 traits (7 Dominants), 8 Ages and
// 4 Catastrophes, exactly the counts on their rules cards (16+2, 16+2, 16+2
// and 9+1 traits; 2 Ages and 1 Catastrophe each). GENERATED from
// doomlings-atlas assets/doomlings/imaginary-ends/cards.json; rules from
// rules/imaginary-ends.md (Deeplings' suppress rules). The box's Magical
// Merchants (11 merchants, 40 trinkets) are a separate add-on, not built.
// `text` is our own summary.

import type { AgeSeed, CatastropheSeed, TraitSeed } from '../cards';

export const IMAGINARY_ENDS_TRAITS: readonly TraitSeed[] = [
  { k: 'atavism', name: 'Atavism', color: 'blue', points: 0, suppress: true, sub: ['deepling'], text: 'Suppress every trait in your pile that changes your Gene Pool, then set your Gene Pool to 5.' },
  { k: 'awesome', name: 'Awesome!', color: 'blue', isAllColors: true, points: 1, dominant: true, dropOfLife: true, worldsEnd: true, sub: ['glitterling'], text: 'World’s End: stabilize to 2. Score the face values of 2 cards in your hand (+17 at most).' },
  { k: 'baffling', name: 'Baffling', color: 'purple', points: -2, suppress: true, sub: ['deepling'], text: 'Suppress 1 trait in your pile, then move Baffling to an opponent’s pile.' },
  { k: 'bedazzled', name: 'Bedazzled', color: 'purple', points: 2, action: true, sub: ['glitterling'], text: 'Action: draw 1. If it is effectless, play it now; if it is a Glitterling, do this again.' },
  { k: 'bubbly', name: 'Bubbly', color: 'blue', points: 3, worldsEnd: true, sub: ['glitterling'], text: 'World’s End: draw 1 and reveal it. If it is blue or colorless, discard a trait from your pile.' },
  { k: 'chemotroph', name: 'Chemotroph', color: 'green', points: 0, suppress: true, sub: ['deepling'], text: 'To play: suppress 1 trait in your pile. Then play another trait.' },
  { k: 'cryptic', name: 'Cryptic', color: 'blue', points: 5, dropOfLife: true, sub: ['deepling'], text: '−4 if you have 12 or more traits.' },
  { k: 'decaying-ooze', name: 'Decaying Ooze', color: 'red', points: -4, effectless: true, sub: ['deepling'], text: '' },
  { k: 'dipped', name: 'Dipped', color: 'red', points: 1, effectless: true, sub: ['glitterling'], text: '' },
  { k: 'eccentric', name: 'Eccentric', color: 'blue', secondaryColor: 'purple', points: 2, action: true, sub: ['glitterling', 'moonling'], text: 'Action: every opponent stabilizes to your Gene Pool.' },
  { k: 'effervescent', name: 'Effervescent', color: 'green', points: 1, suppress: true, sub: ['deepling', 'glitterling'], text: 'Draw 1 and suppress it. If it is a Deepling or Glitterling, do it again.' },
  { k: 'elegance', name: 'Elegance', color: 'blue', points: 2, action: true, sub: ['glitterling'], text: 'Action: you and every opponent may discard negative cards from your hands.' },
  { k: 'enigma', name: 'Enigma', color: 'purple', points: -3, dropOfLife: true, sub: ['deepling'], text: '+10 if you have 10 or fewer traits.' },
  { k: 'ephemeral', name: 'Ephemeral', color: 'purple', points: 5, worldsEnd: true, sub: ['glitterling'], text: 'World’s End: draw 1 and reveal it. If it is purple or colorless, Ephemeral returns to your hand.' },
  { k: 'ethereal', name: 'Ethereal', color: 'blue', points: 1, dominant: true, suppress: true, sub: ['deepling'], text: 'If you hold 6 or fewer cards at the end of your turn, you may suppress 1 from your hand instead of stabilizing (if that empties your hand, draw 2).' },
  { k: 'extravagant', name: 'Extravagant', color: 'purple', points: 3, action: true, sub: ['glitterling', 'moonling'], text: 'Action: give an opponent every Moonling and Glitterling in your hand.' },
  { k: 'feisty', name: 'Feisty', color: 'green', points: 2, genePoolDelta: 1, sub: ['glitterling'], text: '+1 Gene Pool. To play: draw 1 and reveal it — if it is green, every opponent gets +1 Gene Pool.' },
  { k: 'frumious', name: 'Frumious', color: 'green', secondaryColor: 'red', points: 1, effectless: true, sub: ['deepling', 'moonling'], text: '' },
  { k: 'frumple-pumple', name: 'Frumple Pumple', color: 'green', points: 0, dropOfLife: true, sub: ['moonling'], text: '+5 if you hold 3 or fewer cards.' },
  { k: 'fuffle-nuffs', name: 'Fuffle Nuffs', color: 'blue', points: 3, action: true, sub: ['moonling'], text: 'Action: return a trait from your pile to your hand, then give an opponent 1 card.' },
  { k: 'fumplepop', name: 'Fumplepop', color: 'blue', points: -2, effectless: true, sub: ['moonling'], text: '' },
  { k: 'glamorous', name: 'Glamorous', color: 'blue', secondaryColor: 'red', points: 1, effectless: true, sub: ['glitterling', 'moonling'], text: '' },
  { k: 'gob-lopters', name: 'Gob Lopters', color: 'colorless', points: 4, sub: ['moonling'], text: 'To play: give an opponent 2 random cards from your hand.' },
  { k: 'gossamer', name: 'Gossamer', color: 'green', secondaryColor: 'purple', points: 2, effectless: true, sub: ['deepling', 'glitterling'], text: '' },
  { k: 'grobblebobble', name: 'Grobblebobble', color: 'purple', points: 1, sub: ['moonling'], text: 'Can’t be discarded from your hand.' },
  { k: 'gurvendirs', name: 'Gurvendirs', color: 'blue', points: 3, action: true, sub: ['moonling'], text: 'Action: give an opponent 2 cards from your hand.' },
  { k: 'hidden', name: 'Hidden', color: 'purple', points: 1, suppress: true, sub: ['deepling'], text: 'Steal a trait from an opponent’s pile, then suppress it.' },
  { k: 'humdumpling', name: 'Humdumpling', color: 'red', points: 0, action: true, sub: ['moonling'], text: 'Action: give an opponent 1 card from your hand, then play another trait.' },
  { k: 'hurmflerm', name: 'Hurmflerm', color: 'blue', points: 5, genePoolDelta: -2, action: true, sub: ['moonling'], text: '−2 Gene Pool. Action: draw 2. Don’t stabilize this turn.' },
  { k: 'imaginative', name: 'Imaginative', color: 'blue', points: 3, action: true, sub: ['glitterling'], text: 'Action: name a colour and discard the top card of the deck. If it matches, you and every opponent draw 2.' },
  { k: 'jibwib', name: 'Jibwib', color: 'colorless', points: 6, dominant: true, dropOfLife: true, sub: ['moonling'], text: 'Every player with a Gene Pool of 2 or less scores +5.' },
  { k: 'lure', name: 'Lure', color: 'blue', points: 2, suppress: true, sub: ['deepling'], text: 'The opponent on your right names a colour: suppress every card of it from your hand.' },
  { k: 'magic-beans', name: 'Magic Beans', color: 'green', points: 1, action: true, sub: ['glitterling'], text: 'Action: draw 1. If its face value is 1, play it (Action ignored) and do this again.' },
  { k: 'merry', name: 'Merry', color: 'green', points: 0, dropOfLife: true, sub: ['glitterling'], text: '+1 for each Dominant in your opponents’ piles.' },
  { k: 'mimsy', name: 'Mimsy', color: 'blue', points: 1, suppress: true, sub: ['deepling', 'moonling'], text: 'Give an opponent 1 card from your hand, then suppress every card of its colour from your hand.' },
  { k: 'monstrosity', name: 'Monstrosity', color: 'purple', points: 3, effectless: true, sub: ['deepling'], text: '' },
  { k: 'mufflemops', name: 'Mufflemops', color: 'green', points: 1, genePoolDelta: -1, dropOfLife: true, sub: ['moonling'], text: '−1 Gene Pool. +1 for each Moonling in your pile.' },
  { k: 'nurplers', name: 'Nurplers', color: 'purple', points: 2, effectless: true, sub: ['moonling'], text: '' },
  { k: 'pink', name: 'Pink', color: 'colorless', points: 3, action: true, sub: ['glitterling'], text: 'Action: every opponent draws 1.' },
  { k: 'polka-dots', name: 'Polka Dots', color: 'purple', points: 1, action: true, sub: ['glitterling'], text: 'Action: discard the top 5 cards of the deck; play any with face value 0 (Actions ignored).' },
  { k: 'popplebelly', name: 'Popplebelly', color: 'green', points: 4, dominant: true, sub: ['moonling'], text: 'Your Gene Pool is 1 and can’t change. Draw 2 at the start of each of your turns.' },
  { k: 'rainbow-magic', name: 'Rainbow Magic', color: 'blue', isAllColors: true, points: 3, dominant: true, sub: ['glitterling'], text: 'After you stabilize you may return it to your hand, then play a random card from your hand, ignoring restrictions and requirements.' },
  { k: 'remarkable', name: 'Remarkable', color: 'red', points: 1, dominant: true, suppress: true, sub: ['deepling', 'glitterling', 'moonling'], text: 'To play: hold 3 or fewer cards. Every opponent passes their hand right and stabilizes; then suppress your hand.' },
  { k: 'rogloblers', name: 'Rogloblers', color: 'red', points: -3, effectless: true, sub: ['moonling'], text: '' },
  { k: 'scintillant', name: 'Scintillant', color: 'blue', secondaryColor: 'green', points: -3, dropOfLife: true, sub: ['deepling', 'glitterling'], text: '+1 for each Deepling and Glitterling in your pile (this one too).' },
  { k: 'scrappy', name: 'Scrappy', color: 'green', points: 1, action: true, sub: ['glitterling'], text: 'Action: draw 2. Play neither — or play both (Actions ignored) and discard Scrappy.' },
  { k: 'slithy', name: 'Slithy', color: 'purple', secondaryColor: 'red', points: -1, dropOfLife: true, sub: ['deepling', 'moonling'], text: '+5 if one of your Moonlings or Deeplings has a card suppressed under it.' },
  { k: 'spineless', name: 'Spineless', color: 'colorless', points: 5, dropOfLife: true, suppress: true, sub: ['deepling'], text: 'Suppress every face-value-1 trait in your pile. −1 for each face-value-1 trait in your pile.' },
  { k: 'sprinkles', name: 'Sprinkles', color: 'red', points: 3, action: true, sub: ['glitterling'], text: 'Action: draw 1 and reveal it. If it is red or colorless, give every opponent 1 card from your hand.' },
  { k: 'still', name: 'Still', color: 'green', points: 4, effectless: true, sub: ['deepling'], text: '' },
  { k: 'stygian', name: 'Stygian', color: 'colorless', points: 10, dominant: true, dropOfLife: true, worldsEnd: true, suppress: true, sub: ['deepling'], text: 'World’s End: name a colour and suppress every trait of it in your pile. −2 for each colour in your pile.' },
  { k: 'telescopic-eyes', name: 'Telescopic Eyes', color: 'colorless', points: 2, dropOfLife: true, sub: ['deepling'], text: '+2 for each opponent with more traits than you.' },
  { k: 'thwopplers', name: 'Thwopplers', color: 'colorless', points: 6, dropOfLife: true, sub: ['moonling'], text: 'Subtract the lowest Gene Pool at the table from your score.' },
  { k: 'toasty', name: 'Toasty', color: 'colorless', points: 3, effectless: true, sub: ['glitterling'], text: '' },
  { k: 'translucent', name: 'Translucent', color: 'colorless', points: 1, suppress: true, sub: ['deepling'], text: 'Suppress 1 card from your hand.' },
  { k: 'turkendurt', name: 'Turkendurt', color: 'purple', points: 2, action: true, sub: ['moonling'], text: 'Action: if your Gene Pool is 3 or less, steal a trait from an opponent’s pile.' },
  { k: 'umbleboos', name: 'Umbleboos', color: 'green', points: 1, genePoolDelta: -2, playWhen: true, sub: ['moonling'], text: '−2 Gene Pool. You may play it at any time into a pile whose Gene Pool is 6 or more.' },
  { k: 'undulating', name: 'Undulating', color: 'red', points: 1, worldsEnd: true, suppress: true, sub: ['deepling'], text: 'World’s End: suppress 1 trait in your pile.' },
  { k: 'untold', name: 'Untold', color: 'red', points: -1, dropOfLife: true, suppress: true, sub: ['deepling'], text: 'Suppress up to 2 traits in your pile. +1 for each card suppressed under Untold.' },
  { k: 'urf', name: 'Urf', color: 'red', points: 3, genePoolDelta: -3, sub: ['moonling'], text: '−3 Gene Pool. At the start of your turn you may discard it from your pile to draw 3.' },
  { k: 'whimsy', name: 'Whimsy', color: 'colorless', points: 3, sub: ['glitterling'], text: 'To play: draw 1 and reveal it. If it has no Action, play it now; if it is Dominant, discard it along with Whimsy.' },
  { k: 'whip-tail', name: 'Whip Tail', color: 'green', points: 2, suppress: true, sub: ['deepling'], text: 'Suppress 1 trait in your pile.' },
  { k: 'whopple', name: 'Whopple', color: 'purple', points: 2, action: true, sub: ['moonling'], text: 'Action: if you hold 3 or fewer cards, draw 1. Then play another trait.' },
  { k: 'wishful', name: 'Wishful', color: 'red', points: 2, effectless: true, sub: ['glitterling'], text: '' },
];

export const IMAGINARY_ENDS_AGES: readonly AgeSeed[] = [
  { name: 'A Quiet Moment', ruleTag: 'quietMoment', text: 'Discard up to 3 cards from your hand. If you start your turn with an empty hand, draw 4.' },
  { name: 'Age of Reverie', ruleTag: 'reverie', text: 'Suppress a random card from your hand, then pass 1 card to the left.' },
  { name: 'Age of Solitude', ruleTag: 'solitude', text: 'Suppress 1 card from your hand.' },
  { name: 'Fading Away', ruleTag: 'fadingAway', text: 'Every non-Dominant trait you play is suppressed once its effect has resolved.' },
  { name: 'Glitterstorm', ruleTag: 'glitterstorm', text: 'Discard 1, 2 or 3 cards from your hand at random, then stabilize.' },
  { name: 'Moonlight', ruleTag: 'moonlight', text: 'Gene Pool 4 or more: discard 1. Gene Pool 3 or less: draw 2.' },
  { name: 'Sunshine & Tea Parties', ruleTag: 'teaParties', text: 'Draw 1 and show it to everyone.' },
  { name: 'Unusual Friends', ruleTag: 'unusualFriends', text: 'Whenever you play a Deepling, Moonling or Glitterling, draw 2.' },
];

export const IMAGINARY_ENDS_CATASTROPHES: readonly CatastropheSeed[] = [
  { name: 'Abyss Stares Back', tag: 'abyssStaresBack', genePoolDelta: -1, text: 'Suppress your whole hand, then stabilize.', worldsEndText: '−5 if you have 12 or more traits.' },
  { name: 'Isolation', tag: 'isolation', genePoolDelta: -1, text: 'If you hold 3 or fewer cards, suppress a random card from your hand and stabilize.', worldsEndText: 'If you hold 3 or fewer cards, add the face value of 1 card in your hand to your score.' },
  { name: 'Moonpocalypse', tag: 'moonpocalypse', genePoolDelta: -2, text: 'This catastrophe can’t bring your Gene Pool below 4.', worldsEndText: '−5 if your Gene Pool is 4 or more.' },
  { name: 'Too Much Pink', tag: 'tooMuchPink', genePoolDelta: -1, text: 'Discard your hand. Draw 4 at the start of your turn.', worldsEndText: 'Turn up the top card of the deck: +1 for each trait of its colour in your pile.' },
];
