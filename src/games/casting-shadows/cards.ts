// Casting Shadows — complete verified Base Game components:
// - 4 Double-Sided Character Boards
// - 7 Hex Tiles
// - 52 Main Deck Cards (34 Attack Spells, 10 Conversion Spells, 8 Resource Cards)
// - 10 Counterspell Cards
// - 10 Companion Cards

import type { RngState } from '@/core/rng';
import { rngInt, shuffle } from '@/core/rng';
import type {
  CsCard,
  CsCharacterDef,
  CsExpansionId,
  CsHexId,
  CsHexTile,
  CsResource,
} from './types';

export const CS_CHARACTERS: readonly CsCharacterDef[] = [
  {
    id: 'kit',
    lightName: 'Kit Gale',
    shadowName: 'Kit the Turbulent',
    homeHex: 'amber-mountain',
    shadowAbilityCost: 3,
    shadowAbilityText: 'Spend 3 Shadow Energy to deal 1 DMG to each enemy. This DMG cannot be reduced.',
  },
  {
    id: 'frill',
    lightName: 'Frill Lilypad',
    shadowName: 'Frill the Regenerator',
    homeHex: 'whispering-marsh',
    shadowAbilityCost: 3,
    shadowAbilityText: 'Spend 3 Shadow Energy to gain 2 HP and deal 1 DMG to an enemy in range.',
  },
  {
    id: 'nuzzle',
    lightName: 'Nuzzle Thornwood',
    shadowName: 'Nuzzle the Savage',
    homeHex: 'crystal-crypt',
    shadowAbilityCost: 3,
    shadowAbilityText: 'Spend 3 Shadow Energy to deal 2 DMG to an enemy on your current Hex tile.',
  },
  {
    id: 'haze',
    lightName: 'Haze Greentongue',
    shadowName: 'Haze the Devastator',
    homeHex: 'scorched-peaks',
    shadowAbilityCost: 4,
    shadowAbilityText: 'Spend 4 Shadow Energy to deal 3 DMG to all enemies on an adjacent Hex tile.',
  },
];

export const CS_ICE_STORM_CHARACTERS: readonly CsCharacterDef[] = [
  {
    id: 'talon',
    lightName: 'Talon Lightfeather',
    shadowName: 'Talon the Dark Storm',
    homeHex: 'floating-temple',
    shadowAbilityCost: 4,
    shadowAbilityText: 'Spend 4 Shadow Energy to Stun each enemy on your current Hex tile.',
    expansion: 'ice-storm',
  },
  {
    id: 'nyx',
    lightName: 'Nyx Frostpaw',
    shadowName: 'Nyx the Blizzard',
    homeHex: 'glimmering-woods',
    shadowAbilityCost: 3,
    shadowAbilityText: 'Spend 3 Shadow Energy to Freeze an enemy in range and deal 1 DMG to them.',
    expansion: 'ice-storm',
  },
];

export const CS_MOLTEN_ROCK_CHARACTERS: readonly CsCharacterDef[] = [
  {
    id: 'dread',
    lightName: 'Dread Terrashell',
    shadowName: 'Dread the Ironclad',
    homeHex: 'cobble-cove',
    shadowAbilityCost: 2,
    shadowAbilityText: 'Spend 2 Shadow Energy to Fortify yourself (+2 Fortify shield) and deal 1 DMG to an enemy on your Hex.',
    expansion: 'molten-rock',
  },
  {
    id: 'ember',
    lightName: 'Pyra Ashwing',
    shadowName: 'Pyra the Inferno',
    homeHex: 'molten-quarry',
    shadowAbilityCost: 3,
    shadowAbilityText: 'Spend 3 Shadow Energy to inflict Burn on all enemies on your current or adjacent Hex tile and deal 1 DMG.',
    expansion: 'molten-rock',
  },
];

export const CS_ALL_CHARACTERS: readonly CsCharacterDef[] = [
  ...CS_CHARACTERS,
  ...CS_ICE_STORM_CHARACTERS,
  ...CS_MOLTEN_ROCK_CHARACTERS,
];

export function getCharactersForExpansions(expansions: readonly CsExpansionId[] = []): CsCharacterDef[] {
  const out = [...CS_CHARACTERS];
  if (expansions.includes('ice-storm')) out.push(...CS_ICE_STORM_CHARACTERS);
  if (expansions.includes('molten-rock')) out.push(...CS_MOLTEN_ROCK_CHARACTERS);
  return out;
}

export const CS_HEX_DEFS: readonly Omit<CsHexTile, 'faceUpCard'>[] = [
  {
    id: 'ancient-rune',
    name: 'Ancient Rune',
    q: 0,
    r: 0,
    startTurnResource: null,
    hasMainDeckSlot: false,
    effectText: 'Start turn here: +1 Action Point this turn (5 AP total).',
  },
  {
    id: 'dusty-desert',
    name: 'Dusty Desert',
    q: 1,
    r: 0,
    startTurnResource: null,
    hasMainDeckSlot: false,
    effectText: 'While here: you may Collect Counterspell cards (cost: 1 Gem + 1 Orb).',
  },
  {
    id: 'underground-volcano',
    name: 'Underground Volcano',
    q: -1,
    r: 0,
    startTurnResource: 'redGem',
    hasMainDeckSlot: true,
    effectText: 'Start turn here: +1 Red Gem.',
  },
  {
    id: 'amber-mountain',
    name: 'Amber Mountain',
    q: 0,
    r: -1,
    startTurnResource: 'redOrb',
    hasMainDeckSlot: true,
    effectText: 'Start turn here: +1 Red Orb. (Kit Home)',
  },
  {
    id: 'whispering-marsh',
    name: 'Whispering Marsh',
    q: 1,
    r: -1,
    startTurnResource: 'blueOrb',
    hasMainDeckSlot: true,
    effectText: 'Start turn here: +1 Blue Orb. (Frill Home)',
  },
  {
    id: 'crystal-crypt',
    name: 'Crystal Crypt',
    q: 0,
    r: 1,
    startTurnResource: 'blueGem',
    hasMainDeckSlot: true,
    effectText: 'Start turn here: +1 Blue Gem. While here, you cannot reduce incoming DMG. (Nuzzle Home)',
  },
  {
    id: 'scorched-peaks',
    name: 'Scorched Peaks',
    q: -1,
    r: 1,
    startTurnResource: 'purpleOrb',
    hasMainDeckSlot: true,
    effectText: 'Start turn here: +1 Purple Orb. (Haze Home)',
  },
];

export const CS_ICE_STORM_HEX_DEFS: readonly Omit<CsHexTile, 'faceUpCard'>[] = [
  {
    id: 'floating-temple',
    name: 'Floating Temple',
    q: 1,
    r: -2,
    startTurnResource: 'blueGem',
    hasMainDeckSlot: true,
    effectText: 'Start turn here: +1 Blue Gem. (Talon Home)',
    expansion: 'ice-storm',
  },
  {
    id: 'glimmering-woods',
    name: 'Glimmering Woods',
    q: 1,
    r: 1,
    startTurnResource: 'purpleGem',
    hasMainDeckSlot: true,
    effectText: 'Start turn here: +1 Purple Gem. (Nyx Home)',
    expansion: 'ice-storm',
  },
];

export const CS_MOLTEN_ROCK_HEX_DEFS: readonly Omit<CsHexTile, 'faceUpCard'>[] = [
  {
    id: 'cobble-cove',
    name: 'Cobble Cove',
    q: -1,
    r: 2,
    startTurnResource: 'redGem',
    hasMainDeckSlot: true,
    effectText: 'Start turn here: +1 Red Gem. (Dread Home)',
    expansion: 'molten-rock',
  },
  {
    id: 'molten-quarry',
    name: 'Molten Quarry',
    q: -1,
    r: -1,
    startTurnResource: 'shadowFragment',
    hasMainDeckSlot: true,
    effectText: 'Start turn here: +1 Shadow Fragment. (Pyra Home)',
    expansion: 'molten-rock',
  },
];

export const CS_ALL_HEX_DEFS: readonly Omit<CsHexTile, 'faceUpCard'>[] = [
  ...CS_HEX_DEFS,
  ...CS_ICE_STORM_HEX_DEFS,
  ...CS_MOLTEN_ROCK_HEX_DEFS,
];

export function getHexDefsForExpansions(
  expansions: readonly CsExpansionId[] = [],
): Omit<CsHexTile, 'faceUpCard'>[] {
  const out = [...CS_HEX_DEFS];
  if (expansions.includes('ice-storm')) out.push(...CS_ICE_STORM_HEX_DEFS);
  if (expansions.includes('molten-rock')) out.push(...CS_MOLTEN_ROCK_HEX_DEFS);
  return out;
}

export function hexDistance(a: CsHexTile, b: CsHexTile): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -a.q - a.r - (-b.q - b.r);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

export function areHexesAdjacent(a: CsHexTile, b: CsHexTile): boolean {
  if (!a || !b) return false;
  return hexDistance(a, b) === 1;
}

export function isHexInSpellRange(
  hexes: Record<CsHexId, CsHexTile>,
  fromId: CsHexId,
  toId: CsHexId,
  range: 'same' | 'adjacent' | 'sameOrAdjacent' | 'any',
): boolean {
  if (!hexes[fromId] || !hexes[toId]) return false;
  if (range === 'any') return true;
  if (range === 'same') return fromId === toId;
  const adj = areHexesAdjacent(hexes[fromId], hexes[toId]);
  if (range === 'adjacent') return adj;
  return fromId === toId || adj;
}

const DIE_FACES_RED: readonly CsResource[] = [
  'redGem',
  'redGem',
  'redOrb',
  'redOrb',
  'shadowFragment',
  'cursedCrystal',
];
const DIE_FACES_BLUE: readonly CsResource[] = [
  'blueGem',
  'blueGem',
  'blueOrb',
  'blueOrb',
  'shadowFragment',
  'cursedCrystal',
];
const DIE_FACES_PURPLE: readonly CsResource[] = [
  'purpleGem',
  'purpleOrb',
  'shadowFragment',
  'shadowFragment',
  'cursedCrystal',
  'cursedCrystal',
];

export function rollFiveResourceDice(rng: RngState): CsResource[] {
  return [
    DIE_FACES_RED[rngInt(rng, 6)]!,
    DIE_FACES_RED[rngInt(rng, 6)]!,
    DIE_FACES_BLUE[rngInt(rng, 6)]!,
    DIE_FACES_BLUE[rngInt(rng, 6)]!,
    DIE_FACES_PURPLE[rngInt(rng, 6)]!,
  ];
}

export function rollSingleDieForIndex(rng: RngState, dieIndex: number): CsResource {
  if (dieIndex === 0 || dieIndex === 1) return DIE_FACES_RED[rngInt(rng, 6)]!;
  if (dieIndex === 2 || dieIndex === 3) return DIE_FACES_BLUE[rngInt(rng, 6)]!;
  return DIE_FACES_PURPLE[rngInt(rng, 6)]!;
}

export interface CsMainCardDef extends Omit<CsCard, 'id'> {
  count: number;
}

export const CS_MAIN_DECK_DEFS: readonly CsMainCardDef[] = [
  // Attack Spells (34 cards across 17 kinds)
  {
    kind: 'bubble-trouble',
    name: 'Bubble Trouble',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { blueOrb: 1, anyGem: 1 },
    range: 'sameOrAdjacent',
    castTiers: [
      { cost: { blueOrb: 1 }, damage: 1, label: '1 Blue Orb → 1 DMG' },
      { cost: { blueOrb: 2 }, damage: 3, label: '2 Blue Orbs → 3 DMG' },
    ],
    text: 'Spend 1/2 Blue Orbs to deal 1/3 DMG to an enemy on your current or adjacent Hex.',
  },
  {
    kind: 'deadly-shroud',
    name: 'Deadly Shroud',
    type: 'attackSpell',
    level: 2,
    count: 1,
    collectionCost: { anyGem: 2, shadowFragment: 1 },
    range: 'sameOrAdjacent',
    castTiers: [{ cost: { anyGem: 2, shadowFragment: 1 }, damage: 5, label: '2 Gems + 1 Shadow → 5 DMG' }],
    text: 'Level 2: Spend 2 Gems and 1 Shadow Fragment to deal 5 DMG to an enemy in range.',
  },
  {
    kind: 'fatal-fronds',
    name: 'Fatal Fronds',
    type: 'attackSpell',
    level: 1,
    count: 4,
    collectionCost: { anyOrb: 1, anyGem: 1 },
    range: 'sameOrAdjacent',
    castTiers: [{ cost: { anyGem: 1 }, damage: 2, label: '1 Gem → 2 DMG' }],
    text: 'Spend 1 Gem to deal 2 DMG to an enemy on your current or adjacent Hex.',
  },
  {
    kind: 'feeding-frenzy',
    name: 'Feeding Frenzy',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { blueOrb: 1, blueGem: 1 },
    range: 'sameOrAdjacent',
    castTiers: [
      { cost: { blueGem: 1 }, damage: 2, label: '1 Blue Gem → 2 DMG' },
      { cost: { blueGem: 2 }, damage: 4, label: '2 Blue Gems → 4 DMG' },
    ],
    text: 'Spend 1/2 Blue Gems to deal 2/4 DMG to an enemy on your current or adjacent Hex.',
  },
  {
    kind: 'heat-wave',
    name: 'Heat Wave',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { redOrb: 1, redGem: 1 },
    range: 'adjacent',
    targetsAllOnHex: true,
    castTiers: [{ cost: { redOrb: 2 }, damage: 3, label: '2 Red Orbs → 3 DMG to Hex' }],
    text: 'Spend 2 Red Orbs to deal 3 DMG to all enemies on an adjacent Hex.',
  },
  {
    kind: 'heavy-hand',
    name: 'Heavy Hand',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { redOrb: 1, redGem: 1 },
    range: 'same',
    castTiers: [
      { cost: { redGem: 1 }, damage: 2, label: '1 Red Gem → 2 DMG' },
      { cost: { redGem: 2 }, damage: 4, label: '2 Red Gems → 4 DMG' },
    ],
    text: 'Spend 1/2 Red Gems to deal 2/4 DMG to an enemy on your current Hex.',
  },
  {
    kind: 'infernal-assault',
    name: 'Infernal Assault',
    type: 'attackSpell',
    level: 2,
    count: 1,
    collectionCost: { redGem: 2, redOrb: 1 },
    range: 'sameOrAdjacent',
    castTiers: [
      { cost: { redGem: 2 }, damage: 4, label: '2 Red Gems → 4 DMG' },
      { cost: { redGem: 3 }, damage: 6, label: '3 Red Gems → 6 DMG' },
    ],
    text: 'Level 2: Spend 2/3 Red Gems to deal 4/6 DMG to an enemy in range.',
  },
  {
    kind: 'kinetic-wave',
    name: 'Kinetic Wave',
    type: 'attackSpell',
    level: 2,
    count: 1,
    collectionCost: { blueGem: 2, blueOrb: 1 },
    range: 'adjacent',
    targetsAllOnHex: true,
    castTiers: [{ cost: { blueGem: 2 }, damage: 4, label: '2 Blue Gems → 4 DMG to Hex' }],
    text: 'Level 2: Spend 2 Blue Gems to deal 4 DMG to all enemies on an adjacent Hex.',
  },
  {
    kind: 'lightning-bug',
    name: 'Lightning Bug',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { anyOrb: 1, anyGem: 1 },
    range: 'adjacent',
    castTiers: [{ cost: { anyGem: 1 }, damage: 2, label: '1 Gem → 2 DMG (0 vs Shadow)' }],
    text: 'Spend 1 Gem to deal 2 DMG to an enemy on an adjacent Hex (0 DMG if target is in Shadow Form).',
  },
  {
    kind: 'magma-hand',
    name: 'Magma Hand',
    type: 'attackSpell',
    level: 2,
    count: 1,
    collectionCost: { redGem: 1, redOrb: 2 },
    range: 'same',
    castTiers: [{ cost: { redGem: 2 }, damage: 5, label: '2 Red Gems → 5 DMG' }],
    text: 'Level 2: Spend 2 Red Gems to deal 5 DMG to an enemy on your current Hex.',
  },
  {
    kind: 'personal-space',
    name: 'Personal Space',
    type: 'attackSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 2 },
    range: 'same',
    targetsAllOnHex: true,
    castTiers: [{ cost: { anyOrb: 2 }, damage: 3, label: '2 Orbs → 3 DMG on current Hex' }],
    text: 'Spend 2 Orbs to deal 3 DMG to all enemies on your current Hex.',
  },
  {
    kind: 'phoenix-flash',
    name: 'Phoenix Flash',
    type: 'attackSpell',
    level: 2,
    count: 1,
    collectionCost: { redOrb: 2, shadowFragment: 1 },
    range: 'sameOrAdjacent',
    castTiers: [{ cost: { redOrb: 2 }, damage: 3, heal: 2, label: '2 Red Orbs → 3 DMG & Heal 2 HP' }],
    text: 'Level 2: Spend 2 Red Orbs to deal 3 DMG to an enemy in range and gain 2 HP.',
  },
  {
    kind: 'psychic-spikes',
    name: 'Psychic Spikes',
    type: 'attackSpell',
    level: 2,
    count: 1,
    collectionCost: { blueOrb: 2, shadowFragment: 1 },
    range: 'any',
    castTiers: [{ cost: { blueOrb: 2 }, damage: 3, label: '2 Blue Orbs → 3 DMG (Any Hex)' }],
    text: 'Level 2: Spend 2 Blue Orbs to deal 3 DMG to an enemy on any Hex tile.',
  },
  {
    kind: 'sinister-screech',
    name: 'Sinister Screech',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { anyOrb: 1, shadowFragment: 1 },
    range: 'adjacent',
    castTiers: [{ cost: { shadowFragment: 1 }, damage: 2, label: '1 Shadow Fragment → 2 DMG' }],
    text: 'Spend 1 Shadow Fragment to deal 2 DMG to an enemy on an adjacent Hex.',
  },
  {
    kind: 'spectral-slap',
    name: 'Spectral Slap',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { anyOrb: 2 },
    range: 'sameOrAdjacent',
    castTiers: [{ cost: { anyOrb: 1 }, damage: 1, label: '1 Orb → 1 DMG' }],
    text: 'Spend 1 Orb to deal 1 DMG to an enemy on your current or adjacent Hex.',
  },
  {
    kind: 'sudden-doom',
    name: 'Sudden Doom',
    type: 'attackSpell',
    level: 3,
    count: 1,
    collectionCost: { anyGem: 2, anyOrb: 1, shadowFragment: 1 },
    range: 'sameOrAdjacent',
    castTiers: [{ cost: { anyGem: 2, shadowFragment: 1 }, damage: 6, label: '2 Gems + 1 Shadow → 6 DMG' }],
    text: 'Level 3: Spend 2 Gems and 1 Shadow Fragment to deal 6 DMG to an enemy in range.',
  },
  {
    kind: 'unicorn-rush',
    name: 'Unicorn Rush',
    type: 'attackSpell',
    level: 3,
    count: 1,
    collectionCost: { redGem: 1, blueGem: 1, shadowFragment: 1 },
    range: 'any',
    castTiers: [{ cost: { redGem: 1, blueGem: 1 }, damage: 5, label: '1 Red Gem + 1 Blue Gem → 5 DMG' }],
    text: 'Level 3: Spend 1 Red Gem and 1 Blue Gem to deal 5 DMG to an enemy on any Hex.',
  },

  // Conversion Spells (10 cards across 9 kinds)
  {
    kind: 'crystallization',
    name: 'Crystallization',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 2 },
    castTiers: [{ cost: { anyOrb: 1 }, damage: 0, produce: ['purpleGem'], label: '1 Orb → 1 Purple Gem' }],
    text: 'Turn 1 Orb in your Resource Pool into 1 Purple Gem.',
  },
  {
    kind: 'curse-void',
    name: 'Curse Void',
    type: 'conversionSpell',
    level: 1,
    count: 2,
    collectionCost: { anyOrb: 1, shadowFragment: 1 },
    castTiers: [{ cost: { cursedCrystal: 1 }, damage: 0, produce: ['purpleOrb'], label: '1 Cursed Crystal → 1 Purple Orb' }],
    text: 'Turn 1 Cursed Crystal in your Resource Pool into 1 Purple Orb.',
  },
  {
    kind: 'energy-bloom',
    name: 'Energy Bloom',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 1, anyGem: 1 },
    castTiers: [{ cost: { anyOrb: 1 }, damage: 0, produce: ['shadowFragment'], label: '1 Orb → 1 Shadow Fragment' }],
    text: 'Turn 1 Orb in your Resource Pool into 1 Shadow Fragment.',
  },
  {
    kind: 'gem-duplication',
    name: 'Gem Duplication',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 2 },
    castTiers: [{ cost: { anyGem: 1 }, damage: 0, produce: ['purpleGem', 'purpleGem'], label: '1 Gem → 2 Purple Gems' }],
    text: 'Spend 1 Gem in your Resource Pool to gain 2 Gems.',
  },
  {
    kind: 'luminous-glow',
    name: 'Luminous Glow',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 2 },
    castTiers: [{ cost: { shadowFragment: 1 }, damage: 0, heal: 2, label: '1 Shadow Fragment → Heal 2 HP' }],
    text: 'Spend 1 Shadow Fragment to gain 2 HP.',
  },
  {
    kind: 'metamorphosis',
    name: 'Metamorphosis',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 2 },
    castTiers: [{ cost: { anyOrb: 1 }, damage: 0, produce: ['purpleOrb'], label: '1 Orb → 1 Wild Purple Orb' }],
    text: 'Turn 1 Blue Orb into 1 Red Orb, or 1 Red Orb into 1 Blue Orb.',
  },
  {
    kind: 'orb-duplication',
    name: 'Orb Duplication',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 2 },
    castTiers: [{ cost: { anyOrb: 1 }, damage: 0, produce: ['purpleOrb', 'purpleOrb'], label: '1 Orb → 2 Purple Orbs' }],
    text: 'Spend 1 Orb in your Resource Pool to gain 2 Orbs.',
  },
  {
    kind: 'ruby-synthesis',
    name: 'Ruby Synthesis',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 1, redGem: 1 },
    castTiers: [
      { cost: { redOrb: 1 }, damage: 0, produce: ['redGem'], label: '1 Red Orb → 1 Red Gem' },
      { cost: { redGem: 1 }, damage: 0, produce: ['redOrb'], label: '1 Red Gem → 1 Red Orb' },
    ],
    text: 'Turn 1 Red Orb into 1 Red Gem, or 1 Red Gem into 1 Red Orb.',
  },
  {
    kind: 'sapphire-synthesis',
    name: 'Sapphire Synthesis',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 1, blueGem: 1 },
    castTiers: [
      { cost: { blueOrb: 1 }, damage: 0, produce: ['blueGem'], label: '1 Blue Orb → 1 Blue Gem' },
      { cost: { blueGem: 1 }, damage: 0, produce: ['blueOrb'], label: '1 Blue Gem → 1 Blue Orb' },
    ],
    text: 'Turn 1 Blue Orb into 1 Blue Gem, or 1 Blue Gem into 1 Blue Orb.',
  },

  // Resource Cards (8 cards across 4 kinds)
  {
    kind: 'res-blue-gem',
    name: 'Blue Gem',
    type: 'resource',
    level: 1,
    count: 3,
    collectionCost: { blueOrb: 2 },
    grantsResource: 'blueGem',
    text: 'At the start of your turn, add 1 Blue Gem to your Resource Pool.',
  },
  {
    kind: 'res-blue-orb',
    name: 'Blue Orb',
    type: 'resource',
    level: 1,
    count: 1,
    collectionCost: { blueGem: 1, anyOrb: 1 },
    grantsResource: 'blueOrb',
    text: 'At the start of your turn, add 1 Blue Orb to your Resource Pool.',
  },
  {
    kind: 'res-red-gem',
    name: 'Red Gem',
    type: 'resource',
    level: 1,
    count: 3,
    collectionCost: { redOrb: 2 },
    grantsResource: 'redGem',
    text: 'At the start of your turn, add 1 Red Gem to your Resource Pool.',
  },
  {
    kind: 'res-red-orb',
    name: 'Red Orb',
    type: 'resource',
    level: 1,
    count: 1,
    collectionCost: { redGem: 1, anyOrb: 1 },
    grantsResource: 'redOrb',
    text: 'At the start of your turn, add 1 Red Orb to your Resource Pool.',
  },
];

export const CS_COUNTERSPELL_DEFS: readonly CsMainCardDef[] = [
  {
    kind: 'pointed-shield',
    name: 'Pointed Shield',
    type: 'counterspell',
    level: 1,
    count: 4,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    text: 'Reveal when an enemy deals DMG to you: reduce that DMG by 2.',
  },
  {
    kind: 'run-away',
    name: 'Run Away!',
    type: 'counterspell',
    level: 1,
    count: 3,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    text: 'Reveal when an enemy deals DMG to you: reduce that DMG by 1 and Travel to an adjacent Hex tile.',
  },
  {
    kind: 'bees-everywhere',
    name: 'Bees Everywhere',
    type: 'counterspell',
    level: 1,
    count: 2,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    text: 'Reveal when an enemy deals DMG to you: deal 2 DMG back to that enemy.',
  },
  {
    kind: 'safety-dome',
    name: 'Safety Dome',
    type: 'counterspell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    text: 'Reveal when an enemy deals DMG to you: prevent all DMG from that attack.',
  },
];

export const CS_COMPANION_DEFS: readonly CsMainCardDef[] = [
  {
    kind: 'charging-stag',
    name: 'Charging Stag',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Each time you Cast an Attack Spell, deal +1 DMG.',
  },
  {
    kind: 'crushing-tortoise',
    name: 'Crushing Tortoise',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Each time you end your turn on the same Hex tile as an enemy, deal 1 DMG to that enemy.',
  },
  {
    kind: 'cursemaster-raccoon',
    name: 'Cursemaster Raccoon',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'You do not take DMG from Cursed Crystals at the end of your turn.',
  },
  {
    kind: 'hydrattle-snake',
    name: 'Hydrattle Snake',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'At the start of your turn, add 1 Purple Gem to your Resource Pool.',
  },
  {
    kind: 'occult-octo',
    name: 'Occult Octo',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Each time you Protect, deal 1 DMG to all enemies on an adjacent Hex tile.',
  },
  {
    kind: 'protective-panda',
    name: 'Protective Panda',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Reduce all incoming DMG from enemy Attack Spells by 1.',
  },
  {
    kind: 'recovery-raven',
    name: 'Recovery Raven',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'At the end of each of your turns, gain 1 HP.',
  },
  {
    kind: 'sharp-hedge',
    name: 'Sharp Hedge',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Whenever an enemy on your Hex tile deals DMG to you, deal 1 DMG back to them.',
  },
  {
    kind: 'speed-mouster',
    name: 'Speed Mouster',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'At the start of your turn, add 1 Purple Orb to your Resource Pool.',
  },
  {
    kind: 'swamp-monster',
    name: 'Swamp Monster',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'At the start of your turn, gain 1 Shadow Energy.',
  },
];

// ============================================================================
// The Ice Storm Expansion Cards (26 Main Deck, 4 Companions, 4 Counterspells)
// ============================================================================

export const CS_ICE_STORM_MAIN_DECK_DEFS: readonly CsMainCardDef[] = [
  // Attack Spells (17 cards)
  {
    kind: 'glacial-strike',
    name: 'Glacial Strike',
    type: 'attackSpell',
    level: 2,
    count: 1,
    collectionCost: { blueGem: 2, blueOrb: 1 },
    range: 'sameOrAdjacent',
    inflictFreeze: true,
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { blueGem: 2 },
        damage: 4,
        inflictFreeze: true,
        label: '2 Blue Gems → 4 DMG & Freeze',
      },
    ],
    text: 'Level 2: Spend 2 Blue Gems to deal 4 DMG to an enemy in range and Freeze them.',
  },
  {
    kind: 'frozen-flock',
    name: 'Frozen Flock',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { blueOrb: 1, anyGem: 1 },
    range: 'sameOrAdjacent',
    inflictFreeze: true,
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { blueOrb: 1 },
        damage: 1,
        inflictFreeze: true,
        label: '1 Blue Orb → 1 DMG & Freeze',
      },
      {
        cost: { blueOrb: 2 },
        damage: 3,
        inflictFreeze: true,
        label: '2 Blue Orbs → 3 DMG & Freeze',
      },
    ],
    text: 'Spend 1/2 Blue Orbs to deal 1/3 DMG to an enemy in range and Freeze them.',
  },
  {
    kind: 'electric-twister',
    name: 'Electric Twister',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { anyOrb: 1, anyGem: 1 },
    range: 'adjacent',
    targetsAllOnHex: true,
    inflictStun: true,
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { anyOrb: 2 },
        damage: 2,
        inflictStun: true,
        label: '2 Orbs → 2 DMG & Stun Hex',
      },
    ],
    text: 'Spend 2 Orbs to deal 2 DMG and Stun all enemies on an adjacent Hex.',
  },
  {
    kind: 'coral-katana',
    name: 'Coral Katana',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { blueGem: 1, anyOrb: 1 },
    range: 'same',
    inflictStun: true,
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { blueGem: 1 },
        damage: 2,
        inflictStun: true,
        label: '1 Blue Gem → 2 DMG & Stun',
      },
      {
        cost: { blueGem: 2 },
        damage: 4,
        inflictStun: true,
        label: '2 Blue Gems → 4 DMG & Stun',
      },
    ],
    text: 'Spend 1/2 Blue Gems to deal 2/4 DMG to an enemy on your current Hex and Stun them.',
  },
  {
    kind: 'shadow-swarm',
    name: 'Shadow Swarm',
    type: 'attackSpell',
    level: 1,
    count: 2,
    collectionCost: { shadowFragment: 1, anyOrb: 1 },
    range: 'adjacent',
    expansion: 'ice-storm',
    castTiers: [
      { cost: { blueGem: 1 }, damage: 2, label: '1 Blue Gem → 2 DMG' },
      { cost: { blueGem: 2 }, damage: 4, label: '2 Blue Gems → 4 DMG' },
    ],
    text: 'Spend 1/2 Blue Gems to deal 2/4 DMG to an enemy on an adjacent Hex.',
  },
  {
    kind: 'blizzard-blast',
    name: 'Blizzard Blast',
    type: 'attackSpell',
    level: 2,
    count: 2,
    collectionCost: { blueGem: 1, blueOrb: 2 },
    range: 'adjacent',
    targetsAllOnHex: true,
    inflictFreeze: true,
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { blueOrb: 2 },
        damage: 3,
        inflictFreeze: true,
        label: '2 Blue Orbs → 3 DMG & Freeze Hex',
      },
    ],
    text: 'Level 2: Spend 2 Blue Orbs to deal 3 DMG and Freeze all enemies on an adjacent Hex.',
  },
  {
    kind: 'frostbite-fang',
    name: 'Frostbite Fang',
    type: 'attackSpell',
    level: 1,
    count: 2,
    collectionCost: { blueGem: 1, anyGem: 1 },
    range: 'sameOrAdjacent',
    inflictFreeze: true,
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { anyGem: 1, shadowFragment: 1 },
        damage: 3,
        inflictFreeze: true,
        label: '1 Gem + 1 Shadow → 3 DMG & Freeze',
      },
    ],
    text: 'Spend 1 Gem and 1 Shadow Fragment to deal 3 DMG to an enemy in range and Freeze them.',
  },
  {
    kind: 'arctic-avalanche',
    name: 'Arctic Avalanche',
    type: 'attackSpell',
    level: 3,
    count: 1,
    collectionCost: { blueGem: 2, anyOrb: 1, shadowFragment: 1 },
    range: 'any',
    inflictFreeze: true,
    inflictStun: true,
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { blueGem: 2, shadowFragment: 1 },
        damage: 5,
        inflictFreeze: true,
        inflictStun: true,
        label: '2 Blue Gems + 1 Shadow → 5 DMG, Freeze & Stun',
      },
    ],
    text: 'Level 3: Spend 2 Blue Gems and 1 Shadow Fragment to deal 5 DMG, Freeze, and Stun an enemy on any Hex.',
  },

  // Conversion Spells (5 cards)
  {
    kind: 'dark-duplication',
    name: 'Dark Duplication',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 1, shadowFragment: 1 },
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { shadowFragment: 1 },
        damage: 0,
        produce: ['shadowFragment', 'shadowFragment'],
        label: '1 Shadow → 2 Shadow Fragments',
      },
    ],
    text: 'Spend 1 Shadow Fragment in your Resource Pool to gain 2 Shadow Fragments.',
  },
  {
    kind: 'gem-mutation',
    name: 'Gem Mutation',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 2 },
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { anyGem: 1 },
        damage: 0,
        produce: ['purpleGem'],
        heal: 1,
        label: '1 Gem → 1 Purple Gem & Heal 1 HP',
      },
    ],
    text: 'Turn 1 Gem into 1 Wild Purple Gem and gain 1 HP.',
  },
  {
    kind: 'gemeration',
    name: 'Gemeration',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 2 },
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { shadowFragment: 1 },
        damage: 0,
        produce: ['purpleGem'],
        label: '1 Shadow → 1 Purple Gem',
      },
    ],
    text: 'Spend 1 Shadow Fragment to gain 1 Purple Gem.',
  },
  {
    kind: 'orb-absorption',
    name: 'Orb Absorption',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 2 },
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { anyOrb: 1 },
        damage: 0,
        heal: 2,
        label: '1 Orb → Heal 2 HP',
      },
    ],
    text: 'Spend 1 Orb to gain 2 HP.',
  },
  {
    kind: 'orbulence',
    name: 'Orbulence',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    expansion: 'ice-storm',
    castTiers: [
      {
        cost: { shadowFragment: 1 },
        damage: 0,
        produce: ['purpleOrb', 'purpleOrb'],
        label: '1 Shadow → 2 Purple Orbs',
      },
    ],
    text: 'Spend 1 Shadow Fragment to gain 2 Purple Orbs.',
  },

  // Resource Cards (4 cards)
  {
    kind: 'res-shadow-fragment',
    name: 'Shadow Fragment',
    type: 'resource',
    level: 1,
    count: 2,
    collectionCost: { anyOrb: 1, shadowFragment: 1 },
    grantsResource: 'shadowFragment',
    expansion: 'ice-storm',
    text: 'At the start of your turn, add 1 Shadow Fragment to your Resource Pool.',
  },
  {
    kind: 'res-purple-gem',
    name: 'Purple Gem',
    type: 'resource',
    level: 1,
    count: 2,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    grantsResource: 'purpleGem',
    expansion: 'ice-storm',
    text: 'At the start of your turn, add 1 Purple Gem to your Resource Pool.',
  },
];

export const CS_ICE_STORM_COUNTERSPELL_DEFS: readonly CsMainCardDef[] = [
  {
    kind: 'ice-wall',
    name: 'Ice Wall',
    type: 'counterspell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    expansion: 'ice-storm',
    text: 'Reveal when an enemy deals DMG to you: reduce that DMG by 2 and Freeze the attacker.',
  },
  {
    kind: 'frost-mirror',
    name: 'Frost Mirror',
    type: 'counterspell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    expansion: 'ice-storm',
    text: 'Reveal when an enemy deals DMG to you: reduce that DMG by 1, deal 1 DMG back, and Freeze the attacker.',
  },
  {
    kind: 'icy-fists',
    name: 'Icy Fists',
    type: 'counterspell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    expansion: 'ice-storm',
    text: 'Reveal when an enemy deals DMG to you: deal 2 DMG back and Freeze the attacker.',
  },
  {
    kind: 'shocking-waves',
    name: 'Shocking Waves',
    type: 'counterspell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    expansion: 'ice-storm',
    text: 'Reveal when an enemy deals DMG to you: reduce that DMG by 1 and Stun the attacker.',
  },
];

export const CS_ICE_STORM_COMPANION_DEFS: readonly CsMainCardDef[] = [
  {
    kind: 'undersea-healer',
    name: 'Undersea Healer',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    expansion: 'ice-storm',
    text: 'At the start of your turn, gain 1 HP.',
  },
  {
    kind: 'mirror-crab',
    name: 'Mirror Crab',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    expansion: 'ice-storm',
    text: 'Whenever an enemy deals DMG to you, deal 1 DMG back to them.',
  },
  {
    kind: 'dark-flutter',
    name: 'Dark Flutter',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    expansion: 'ice-storm',
    text: 'At the start of your turn, add 1 Shadow Fragment to your Resource Pool.',
  },
  {
    kind: 'lil-shadow',
    name: "Lil' Shadow",
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    expansion: 'ice-storm',
    text: 'Your Shadow Ability costs 1 fewer Shadow Energy (minimum 1).',
  },
];

// ============================================================================
// The Molten Rock Expansion Cards (26 Main Deck, 4 Companions, 4 Counterspells)
// ============================================================================

export const CS_MOLTEN_ROCK_MAIN_DECK_DEFS: readonly CsMainCardDef[] = [
  // Attack Spells (17 cards)
  {
    kind: 'earth-shatter',
    name: 'Earth Shatter',
    type: 'attackSpell',
    level: 2,
    count: 2,
    collectionCost: { redGem: 2, anyOrb: 1 },
    range: 'adjacent',
    targetsAllOnHex: true,
    inflictBurn: true,
    gainFortify: 1,
    expansion: 'molten-rock',
    castTiers: [
      {
        cost: { redGem: 2 },
        damage: 3,
        inflictBurn: true,
        gainFortify: 1,
        label: '2 Red Gems → 3 DMG, Burn Hex & +1 Fortify',
      },
    ],
    text: 'Level 2: Spend 2 Red Gems to deal 3 DMG and Burn all enemies on an adjacent Hex, and gain +1 Fortify.',
  },
  {
    kind: 'groundbreaker',
    name: 'Groundbreaker',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { redGem: 1, anyOrb: 1 },
    range: 'sameOrAdjacent',
    gainFortify: 1,
    expansion: 'molten-rock',
    castTiers: [
      {
        cost: { redGem: 1 },
        damage: 2,
        gainFortify: 1,
        label: '1 Red Gem → 2 DMG & +1 Fortify',
      },
      {
        cost: { redGem: 2 },
        damage: 3,
        gainFortify: 2,
        label: '2 Red Gems → 3 DMG & +2 Fortify',
      },
    ],
    text: 'Spend 1/2 Red Gems to deal 2/3 DMG to an enemy in range and gain +1/+2 Fortify.',
  },
  {
    kind: 'supercharged-jewel',
    name: 'Supercharged Jewel',
    type: 'attackSpell',
    level: 2,
    count: 2,
    collectionCost: { anyGem: 2, shadowFragment: 1 },
    range: 'sameOrAdjacent',
    inflictBurn: true,
    expansion: 'molten-rock',
    castTiers: [
      {
        cost: { anyGem: 2 },
        damage: 4,
        inflictBurn: true,
        label: '2 Gems → 4 DMG & Burn',
      },
    ],
    text: 'Level 2: Spend 2 Gems to deal 4 DMG to an enemy in range and inflict Burn.',
  },
  {
    kind: 'vort-hex',
    name: 'Vort-Hex',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { redOrb: 1, anyGem: 1 },
    range: 'sameOrAdjacent',
    inflictBurn: true,
    expansion: 'molten-rock',
    castTiers: [
      {
        cost: { redOrb: 1 },
        damage: 1,
        inflictBurn: true,
        label: '1 Red Orb → 1 DMG & Burn',
      },
      {
        cost: { redOrb: 2 },
        damage: 3,
        inflictBurn: true,
        label: '2 Red Orbs → 3 DMG & Burn',
      },
    ],
    text: 'Spend 1/2 Red Orbs to deal 1/3 DMG to an enemy in range and inflict Burn.',
  },
  {
    kind: 'draining-vines',
    name: 'Draining Vines',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { anyOrb: 1, shadowFragment: 1 },
    range: 'sameOrAdjacent',
    expansion: 'molten-rock',
    castTiers: [
      {
        cost: { anyOrb: 1, shadowFragment: 1 },
        damage: 2,
        heal: 1,
        label: '1 Orb + 1 Shadow → 2 DMG & Heal 1 HP',
      },
    ],
    text: 'Spend 1 Orb and 1 Shadow Fragment to deal 2 DMG to an enemy in range and gain 1 HP.',
  },
  {
    kind: 'pyro-burst',
    name: 'Pyro Burst',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { redOrb: 1, redGem: 1 },
    range: 'same',
    targetsAllOnHex: true,
    inflictBurn: true,
    expansion: 'molten-rock',
    castTiers: [
      {
        cost: { redOrb: 1, redGem: 1 },
        damage: 2,
        inflictBurn: true,
        label: '1 Red Orb + 1 Red Gem → 2 DMG & Burn Hex',
      },
    ],
    text: 'Spend 1 Red Orb and 1 Red Gem to deal 2 DMG and Burn all enemies on your current Hex.',
  },
  {
    kind: 'volcanic-cataclysm',
    name: 'Volcanic Cataclysm',
    type: 'attackSpell',
    level: 3,
    count: 1,
    collectionCost: { redGem: 2, redOrb: 1, shadowFragment: 1 },
    range: 'any',
    inflictBurn: true,
    gainFortify: 2,
    expansion: 'molten-rock',
    castTiers: [
      {
        cost: { redGem: 2, shadowFragment: 1 },
        damage: 5,
        inflictBurn: true,
        gainFortify: 2,
        label: '2 Red Gems + 1 Shadow → 5 DMG, Burn & +2 Fortify',
      },
    ],
    text: 'Level 3: Spend 2 Red Gems and 1 Shadow Fragment to deal 5 DMG and Burn an enemy on any Hex, and gain +2 Fortify.',
  },

  // Conversion Spells (5 cards)
  {
    kind: 'iron-carapace',
    name: 'Iron Carapace',
    type: 'conversionSpell',
    level: 1,
    count: 2,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    gainFortify: 2,
    expansion: 'molten-rock',
    castTiers: [
      {
        cost: { anyGem: 1 },
        damage: 0,
        gainFortify: 2,
        label: '1 Gem → +2 Fortify',
      },
    ],
    text: 'Spend 1 Gem to gain +2 Fortify shield.',
  },
  {
    kind: 'molten-alchemy',
    name: 'Molten Alchemy',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { redOrb: 1, anyGem: 1 },
    expansion: 'molten-rock',
    castTiers: [
      {
        cost: { cursedCrystal: 1 },
        damage: 0,
        produce: ['redGem'],
        label: '1 Cursed Crystal → 1 Red Gem',
      },
    ],
    text: 'Turn 1 Cursed Crystal in your Resource Pool into 1 Red Gem.',
  },
  {
    kind: 'ember-infusion',
    name: 'Ember Infusion',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 2 },
    expansion: 'molten-rock',
    castTiers: [
      {
        cost: { anyOrb: 1 },
        damage: 0,
        produce: ['redGem', 'shadowFragment'],
        label: '1 Orb → 1 Red Gem + 1 Shadow Fragment',
      },
    ],
    text: 'Spend 1 Orb to gain 1 Red Gem and 1 Shadow Fragment.',
  },
  {
    kind: 'magma-mend',
    name: 'Magma Mend',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 1, shadowFragment: 1 },
    gainFortify: 1,
    expansion: 'molten-rock',
    castTiers: [
      {
        cost: { redGem: 1 },
        damage: 0,
        heal: 2,
        gainFortify: 1,
        label: '1 Red Gem → Heal 2 HP & +1 Fortify',
      },
    ],
    text: 'Spend 1 Red Gem to gain 2 HP and +1 Fortify shield.',
  },

  // Resource Cards (4 cards)
  {
    kind: 'res-molten-red-gem',
    name: 'Molten Red Gem',
    type: 'resource',
    level: 1,
    count: 2,
    collectionCost: { redOrb: 1, anyOrb: 1 },
    grantsResource: 'redGem',
    expansion: 'molten-rock',
    text: 'At the start of your turn, add 1 Red Gem to your Resource Pool.',
  },
  {
    kind: 'res-purple-orb',
    name: 'Purple Orb',
    type: 'resource',
    level: 1,
    count: 2,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    grantsResource: 'purpleOrb',
    expansion: 'molten-rock',
    text: 'At the start of your turn, add 1 Purple Orb to your Resource Pool.',
  },
];

export const CS_MOLTEN_ROCK_COUNTERSPELL_DEFS: readonly CsMainCardDef[] = [
  {
    kind: 'magma-shield',
    name: 'Magma Shield',
    type: 'counterspell',
    level: 1,
    count: 2,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    expansion: 'molten-rock',
    text: 'Reveal when an enemy deals DMG to you: reduce that DMG by 2 and inflict Burn on the attacker.',
  },
  {
    kind: 'smoke-screen',
    name: 'Smoke Screen',
    type: 'counterspell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    expansion: 'molten-rock',
    text: 'Reveal when an enemy deals DMG to you: prevent all DMG and gain +1 Fortify shield.',
  },
  {
    kind: 'molten-retaliation',
    name: 'Molten Retaliation',
    type: 'counterspell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    expansion: 'molten-rock',
    text: 'Reveal when an enemy deals DMG to you: deal 1 DMG back, inflict Burn on the attacker, and gain +1 Fortify shield.',
  },
];

export const CS_MOLTEN_ROCK_COMPANION_DEFS: readonly CsMainCardDef[] = [
  {
    kind: 'ravaging-draco',
    name: 'Ravaging Draco',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    expansion: 'molten-rock',
    text: 'Each time you Cast an Attack Spell, inflict Burn on the target(s).',
  },
  {
    kind: 'scaled-alchemist',
    name: 'Scaled Alchemist',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    expansion: 'molten-rock',
    text: 'At the start of your turn, gain +1 Fortify shield.',
  },
  {
    kind: 'hammerhead-harvester',
    name: 'Hammerhead Harvester',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    expansion: 'molten-rock',
    text: 'At the start of your turn, add 1 Red Gem to your Resource Pool.',
  },
  {
    kind: 'vital-shroom',
    name: 'Vital Shroom',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    expansion: 'molten-rock',
    text: 'Each time you Protect, gain 1 HP and +1 Fortify shield.',
  },
];

export function buildCsDecks(
  rng: RngState,
  expansions: readonly CsExpansionId[] = [],
): {
  mainDeck: CsCard[];
  counterspellDeck: CsCard[];
  companionDeck: CsCard[];
} {
  let nextId = 1;
  const expand = (defs: readonly CsMainCardDef[]): CsCard[] => {
    const out: CsCard[] = [];
    for (const d of defs) {
      for (let i = 0; i < d.count; i++) {
        out.push({
          id: nextId++,
          kind: d.kind,
          name: d.name,
          type: d.type,
          level: d.level,
          collectionCost: d.collectionCost,
          castTiers: d.castTiers,
          range: d.range,
          targetsAllOnHex: d.targetsAllOnHex,
          grantsResource: d.grantsResource,
          inflictStun: d.inflictStun,
          inflictFreeze: d.inflictFreeze,
          inflictBurn: d.inflictBurn,
          gainFortify: d.gainFortify,
          expansion: d.expansion,
          text: d.text,
        });
      }
    }
    return out;
  };

  const mainDefs: CsMainCardDef[] = [...CS_MAIN_DECK_DEFS];
  const counterDefs: CsMainCardDef[] = [...CS_COUNTERSPELL_DEFS];
  const companionDefs: CsMainCardDef[] = [...CS_COMPANION_DEFS];

  if (expansions.includes('ice-storm')) {
    mainDefs.push(...CS_ICE_STORM_MAIN_DECK_DEFS);
    counterDefs.push(...CS_ICE_STORM_COUNTERSPELL_DEFS);
    companionDefs.push(...CS_ICE_STORM_COMPANION_DEFS);
  }
  if (expansions.includes('molten-rock')) {
    mainDefs.push(...CS_MOLTEN_ROCK_MAIN_DECK_DEFS);
    counterDefs.push(...CS_MOLTEN_ROCK_COUNTERSPELL_DEFS);
    companionDefs.push(...CS_MOLTEN_ROCK_COMPANION_DEFS);
  }

  return {
    mainDeck: shuffle(rng, expand(mainDefs)),
    counterspellDeck: shuffle(rng, expand(counterDefs)),
    companionDeck: shuffle(rng, expand(companionDefs)),
  };
}
