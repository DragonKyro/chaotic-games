// Casting Shadows — components.
//
// Base game (confirmed against the official rulebook, the Hex Tile Reference Sheet
// and the Unstable Games Wiki card pages — see types.ts for the sources):
// - 4 double-sided Player Boards, 7 Hex Tiles
// - 52 Main Deck cards (34 Attack Spells, 10 Conversion Spells, 8 Resource cards)
// - 10 Counterspells, 10 Companions
// Cards whose wiki page was never archived are kept as built and marked UNCONFIRMED:
// Magma Hand, Sapphire Synthesis (pattern of Ruby Synthesis), Blue Orb (pattern of
// Red Orb), Sharp Hedge, and Frill the Regenerator's ability.
//
// The Ice Storm / The Molten Rock: hex tiles, character names and home hexes, Talon's
// ability and the Freeze / Stun rules are official; their decks are this app's own
// RECONSTRUCTION (the official card lists are below; their texts were not sourced).

import type { RngState } from '@/core/rng';
import { rngInt, shuffle } from '@/core/rng';
import type { Seat } from '@/core/types';
import type {
  CsCard,
  CsCastTier,
  CsCharacterDef,
  CsExpansionId,
  CsHexId,
  CsHexTile,
  CsResource,
  CsResourceCost,
  CsSpellRange,
} from './types';

// ============================================================================
// Characters
// ============================================================================

export const CS_CHARACTERS: readonly CsCharacterDef[] = [
  {
    id: 'kit',
    lightName: 'Kit Gale',
    shadowName: 'Kit the Turbulent',
    homeHex: 'amber-mountain',
    shadowAbilityCost: 3,
    shadowAbilityText: 'Spend 3 Shadow Energy to deal 1 DMG to each enemy. This DMG cannot be reduced.',
    aim: { kind: 'none' },
    confirmed: true,
  },
  {
    id: 'frill',
    lightName: 'Frill Lilypad',
    shadowName: 'Frill the Regenerator',
    homeHex: 'floating-lake',
    shadowAbilityCost: 3,
    shadowAbilityText: 'Spend 3 Shadow Energy to gain 2 HP and deal 1 DMG to an enemy in range. (Unconfirmed text.)',
    aim: { kind: 'player', range: 'sameOrAdjacent' },
    confirmed: false,
  },
  {
    id: 'nuzzle',
    lightName: 'Nuzzle Thornwood',
    shadowName: 'Nuzzle the Savage',
    homeHex: 'dark-forest',
    shadowAbilityCost: 4,
    shadowAbilityText: 'Spend 4 Shadow Energy to reduce your HP by up to 4, then deal the same amount of DMG to each enemy.',
    aim: { kind: 'amount', max: 4 },
    confirmed: true,
  },
  {
    id: 'haze',
    lightName: 'Haze Greentongue',
    shadowName: 'Haze the Devastator',
    homeHex: 'mushroom-cave',
    shadowAbilityCost: 5,
    shadowAbilityText: 'Spend 5 Shadow Energy to deal 5 DMG to a Hex tile in range.',
    aim: { kind: 'hex', range: 'upToTwo' },
    confirmed: true,
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
    aim: { kind: 'none' },
    confirmed: true,
    expansion: 'ice-storm',
  },
  {
    id: 'frost',
    lightName: 'Frost Polarpaw',
    shadowName: 'Frost the Merciless',
    homeHex: 'desolate-glacier',
    shadowAbilityCost: 3,
    shadowAbilityText: 'Spend 3 Shadow Energy to Freeze an enemy in range and deal 1 DMG to them. (Placeholder — the printed ability was not sourced.)',
    aim: { kind: 'player', range: 'sameOrAdjacent' },
    confirmed: false,
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
    shadowAbilityText:
      'Spend 2 Shadow Energy to gain +2 Fortify and deal 1 DMG to an enemy on your Hex tile. (Placeholder — the printed ability was not sourced.)',
    aim: { kind: 'player', range: 'same' },
    confirmed: false,
    expansion: 'molten-rock',
  },
  {
    id: 'ashe',
    lightName: 'Ashe Firecrest',
    shadowName: 'Ashe the Inferno',
    homeHex: 'fiery-meadows',
    shadowAbilityCost: 3,
    shadowAbilityText:
      'Spend 3 Shadow Energy to deal 1 DMG and Burn to each enemy on a Hex tile in range. (Placeholder — the printed ability was not sourced.)',
    aim: { kind: 'hex', range: 'sameOrAdjacent' },
    confirmed: false,
    expansion: 'molten-rock',
  },
];

export const CS_ALL_CHARACTERS: readonly CsCharacterDef[] = [
  ...CS_CHARACTERS,
  ...CS_ICE_STORM_CHARACTERS,
  ...CS_MOLTEN_ROCK_CHARACTERS,
];

export function characterDef(id: string): CsCharacterDef {
  return CS_ALL_CHARACTERS.find((c) => c.id === id) ?? CS_CHARACTERS[0]!;
}

export function getCharactersForExpansions(expansions: readonly CsExpansionId[] = []): CsCharacterDef[] {
  const out = [...CS_CHARACTERS];
  if (expansions.includes('ice-storm')) out.push(...CS_ICE_STORM_CHARACTERS);
  if (expansions.includes('molten-rock')) out.push(...CS_MOLTEN_ROCK_CHARACTERS);
  return out;
}

/**
 * One Character per seat — each comes with its own Player Board, so no two seats
 * share one. A seat's pick is honoured (an expansion Character brings its expansion
 * along); everyone else gets the first free Character.
 */
export function pickCharacters(
  seats: readonly Seat[],
  chosen: Record<string, string>,
  expansions: readonly CsExpansionId[],
): CsCharacterDef[] {
  const taken = new Set<string>();
  const picks: (CsCharacterDef | null)[] = seats.map((seat) => {
    const def = CS_ALL_CHARACTERS.find((c) => c.id === chosen[seat.id]);
    if (!def || taken.has(def.id)) return null;
    taken.add(def.id);
    return def;
  });
  const pool = [...getCharactersForExpansions(expansions), ...CS_ALL_CHARACTERS];
  return picks.map((p) => {
    if (p) return p;
    const free = pool.find((c) => !taken.has(c.id))!;
    taken.add(free.id);
    return free;
  });
}

// ============================================================================
// Hex tiles (Hex Tile Reference Sheet) and the map
// ============================================================================

export type CsHexDef = Omit<CsHexTile, 'faceUpCard' | 'q' | 'r' | 'hasMainDeckSlot'>;

export const CS_HEX_DEFS: readonly CsHexDef[] = [
  {
    id: 'ancient-rune',
    name: 'Ancient Rune',
    startTurnResource: null,
    effectText: 'If you start your turn on this Hex tile, gain 2 HP. Cards cannot be collected from this Hex tile.',
  },
  {
    id: 'dusty-desert',
    name: 'Dusty Desert',
    startTurnResource: null,
    effectText: 'If you are on this Hex tile, you may spend 1 Action point, 1 Gem, and 1 Orb to Collect a Counterspell card.',
  },
  {
    id: 'underground-volcano',
    name: 'Underground Volcano',
    startTurnResource: 'shadowFragment',
    effectText: 'If you start your turn on this Hex tile, take a Shadow Fragment token and add it to your Resource Pool.',
  },
  {
    id: 'amber-mountain',
    name: 'Amber Mountain',
    startTurnResource: null,
    effectText: "If you are alone on this Hex tile, you cannot take DMG from Attack Spell cards. Kit Gale's Home Hex tile.",
  },
  {
    id: 'floating-lake',
    name: 'Floating Lake',
    startTurnResource: 'blueOrb',
    effectText: "If you start your turn on this Hex tile, take a Blue Orb token and add it to your Resource Pool. Frill Lilypad's Home Hex tile.",
  },
  {
    id: 'dark-forest',
    name: 'Dark Forest',
    startTurnResource: 'redOrb',
    effectText: "If you start your turn on this Hex tile, take a Red Orb token and add it to your Resource Pool. Nuzzle Thornwood's Home Hex tile.",
  },
  {
    id: 'mushroom-cave',
    name: 'Mushroom Cave',
    startTurnResource: null,
    effectText:
      "If an enemy tries to deal more than 1 DMG to you with an Attack Spell while you are on this Hex tile, reduce that DMG by 1. Haze Greentongue's Home Hex tile.",
  },
];

export const CS_ICE_STORM_HEX_DEFS: readonly CsHexDef[] = [
  {
    id: 'mushroom-bog',
    name: 'Mushroom Bog',
    startTurnResource: null,
    effectText: 'If you deal DMG to an enemy while you are on this Hex tile, increase that DMG by 1.',
    expansion: 'ice-storm',
  },
  {
    id: 'desolate-glacier',
    name: 'Desolate Glacier',
    startTurnResource: null,
    effectText:
      "If you deal DMG to an enemy while you are on this Hex tile, you may spend 1 Blue Orb to Freeze that enemy. Frost Polarpaw's Home Hex tile.",
    expansion: 'ice-storm',
  },
  {
    id: 'floating-temple',
    name: 'Floating Temple',
    startTurnResource: null,
    effectText:
      "If you deal DMG to an enemy while you are on this Hex tile, you may spend 1 Red Orb to Stun that enemy. Talon Lightfeather's Home Hex tile.",
    expansion: 'ice-storm',
  },
];

export const CS_MOLTEN_ROCK_HEX_DEFS: readonly CsHexDef[] = [
  {
    id: 'sacred-falls',
    name: 'Sacred Falls',
    startTurnResource: null,
    effectText: 'If you are on this Hex tile, you cannot take DMG from Cursed Crystals.',
    expansion: 'molten-rock',
  },
  {
    id: 'cobble-cove',
    name: 'Cobble Cove',
    startTurnResource: null,
    effectText:
      "If you deal DMG to an enemy while you are on this Hex tile, you may spend 1 Shadow Fragment to Fortify yourself. Dread Terrashell's Home Hex tile. (Fortify is not modeled.)",
    expansion: 'molten-rock',
  },
  {
    id: 'fiery-meadows',
    name: 'Fiery Meadows',
    startTurnResource: null,
    effectText:
      "If you deal DMG to an enemy while you are on this Hex tile, you may spend 1 Cursed Crystal to Scorch that enemy's Hex tile. Ashe Firecrest's Home Hex tile. (Scorch is not modeled.)",
    expansion: 'molten-rock',
  },
];

export const CS_ALL_HEX_DEFS: readonly CsHexDef[] = [...CS_HEX_DEFS, ...CS_ICE_STORM_HEX_DEFS, ...CS_MOLTEN_ROCK_HEX_DEFS];

function getHexDefsForExpansions(expansions: readonly CsExpansionId[] = []): CsHexDef[] {
  const out = [...CS_HEX_DEFS];
  if (expansions.includes('ice-storm')) out.push(...CS_ICE_STORM_HEX_DEFS);
  if (expansions.includes('molten-rock')) out.push(...CS_MOLTEN_ROCK_HEX_DEFS);
  return out;
}

type Pos = [q: number, r: number];

/** Tiles that never sit in a player position on their own account. */
const MIDDLE_ROW: readonly CsHexId[] = ['ancient-rune', 'dusty-desert', 'underground-volcano'];
/** The second centre tile of a 10-tile map (nobody's home). */
const CENTRE_TILES: readonly CsHexId[] = ['mushroom-bog', 'sacred-falls'];

/**
 * Map layouts, as drawn in the rulebooks (axial coordinates, pointy-top):
 *  - 7 tiles (2–4 players, base rulebook p.4): Dusty Desert · Ancient Rune · Underground
 *    Volcano across the middle; Players 3 and 4 above, Players 2 and 1 below. Every tile
 *    but the Ancient Rune and Dusty Desert gets a face-up card.
 *  - 10 tiles (5–6 players, Ice Storm rulebook p.3): Dusty Desert · Ancient Rune · Mushroom
 *    Bog · Underground Volcano across the middle; Players 4 5 6 above, 3 2 1 below. Cards
 *    go only beside the tiles on the left and right edges (not Dusty Desert).
 *    UNCONFIRMED: with The Molten Rock alone, Sacred Falls takes Mushroom Bog's place.
 */
const SEATS_7: readonly Pos[] = [[0, 1], [-1, 1], [0, -1], [1, -1]];
const SEATS_10: readonly Pos[] = [[1, 1], [0, 1], [-1, 1], [0, -1], [1, -1], [2, -1]];
/** 10-tile seat positions on the left / right edges: P1, P3, P4, P6. */
const EDGE_SEATS_10: readonly number[] = [0, 2, 3, 5];

/**
 * Build the map: each seat's Home Hex tile goes in its player number's position; any
 * positions left over are filled with the remaining tiles ("you may fill the rest of
 * the Map with any remaining Hex tiles" — base homes first, then expansion tiles).
 */
export function buildMap(homes: readonly CsHexId[], expansions: readonly CsExpansionId[]): Record<CsHexId, CsHexTile> {
  const big = homes.length > 4;
  const byId = new Map(CS_ALL_HEX_DEFS.map((d) => [d.id, d]));
  const hexes = {} as Record<CsHexId, CsHexTile>;
  const place = (id: CsHexId, [q, r]: Pos, slot: boolean) => {
    hexes[id] = { ...byId.get(id)!, q, r, hasMainDeckSlot: slot, faceUpCard: null };
  };

  let centre: CsHexId | null = null;
  if (big) {
    centre = expansions.includes('ice-storm') ? 'mushroom-bog' : 'sacred-falls';
    place('dusty-desert', [-1, 0], false);
    place('ancient-rune', [0, 0], false);
    place(centre, [1, 0], false);
    place('underground-volcano', [2, 0], true);
  } else {
    place('dusty-desert', [-1, 0], false);
    place('ancient-rune', [0, 0], false);
    place('underground-volcano', [1, 0], true);
  }

  const seats = big ? SEATS_10 : SEATS_7;
  const tiles: CsHexId[] = [...homes];
  const defs = getHexDefsForExpansions(expansions);
  const fillers = [
    ...defs.filter((d) => !CENTRE_TILES.includes(d.id)),
    ...defs.filter((d) => CENTRE_TILES.includes(d.id)),
  ]
    .map((d) => d.id)
    .filter((id) => !MIDDLE_ROW.includes(id) && id !== centre && !homes.includes(id));
  while (tiles.length < seats.length && fillers.length) tiles.push(fillers.shift()!);
  tiles.slice(0, seats.length).forEach((id, i) => place(id, seats[i]!, big ? EDGE_SEATS_10.includes(i) : true));
  return hexes;
}

export function hexDistance(a: Pick<CsHexTile, 'q' | 'r'>, b: Pick<CsHexTile, 'q' | 'r'>): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

export function areHexesAdjacent(a: CsHexTile | undefined, b: CsHexTile | undefined): boolean {
  if (!a || !b) return false;
  return hexDistance(a, b) === 1;
}

/** The five official range types (rulebook p.16), counted in Hex tiles from where you stand. */
export function isHexInSpellRange(
  hexes: Record<CsHexId, CsHexTile>,
  fromId: CsHexId,
  toId: CsHexId,
  range: CsSpellRange,
): boolean {
  const a = hexes[fromId];
  const b = hexes[toId];
  if (!a || !b) return false;
  const d = hexDistance(a, b);
  switch (range) {
    case 'same':
      return d === 0;
    case 'adjacent':
      return d === 1;
    case 'sameOrAdjacent':
      return d <= 1;
    case 'upToTwo':
      return d <= 2;
    case 'twoNotSame':
      return d === 1 || d === 2;
  }
}

// ============================================================================
// Resource dice. UNCONFIRMED faces: the rulebook art shows three faces per die
// (each colour die its Gem, its Orb and a Cursed Crystal; a blue die also a
// Shadow Fragment; the special die a Purple Gem, Purple Orb and Cursed Crystal).
// The rest of the distribution is the original build's.
// ============================================================================

const DIE_FACES_RED: readonly CsResource[] = ['redGem', 'redGem', 'redOrb', 'redOrb', 'shadowFragment', 'cursedCrystal'];
const DIE_FACES_BLUE: readonly CsResource[] = ['blueGem', 'blueGem', 'blueOrb', 'blueOrb', 'shadowFragment', 'cursedCrystal'];
const DIE_FACES_PURPLE: readonly CsResource[] = ['purpleGem', 'purpleOrb', 'shadowFragment', 'shadowFragment', 'cursedCrystal', 'cursedCrystal'];

/** Die slots 0–1 are red, 2–3 blue, 4 the special purple die. */
function dieFaces(slot: number): readonly CsResource[] {
  if (slot === 0 || slot === 1) return DIE_FACES_RED;
  if (slot === 2 || slot === 3) return DIE_FACES_BLUE;
  return DIE_FACES_PURPLE;
}

export function rollDieSlot(rng: RngState, slot: number): CsResource {
  return dieFaces(slot)[rngInt(rng, 6)]!;
}

/** Roll the given dice (a Stunned caster rolls four of the five). */
export function rollDiceSlots(rng: RngState, slots: readonly number[] = [0, 1, 2, 3, 4]): CsResource[] {
  return slots.map((slot) => rollDieSlot(rng, slot));
}

// ============================================================================
// Base game cards (Unstable Games Wiki card pages + the base Inventory List)
// ============================================================================

export interface CsMainCardDef extends Omit<CsCard, 'id'> {
  count: number;
}

/** "Spend up to N <unit> to deal a/b/c DMG": one cast tier per amount spent. */
function upTo(unit: CsResourceCost, dmg: readonly number[], noun: string): CsCastTier[] {
  return dmg.map((d, i) => {
    const n = i + 1;
    const cost = Object.fromEntries(Object.entries(unit).map(([k, v]) => [k, (v ?? 0) * n])) as CsResourceCost;
    return { cost, damage: d, label: `${n} ${noun}${n > 1 ? 's' : ''} → ${d} DMG` };
  });
}

export const CS_MAIN_DECK_DEFS: readonly CsMainCardDef[] = [
  // ---- Attack Spells (34) ----
  {
    kind: 'bubble-trouble',
    name: 'Bubble Trouble',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { blueOrb: 1, blueGem: 1 },
    range: 'adjacent',
    castTiers: [{ cost: { blueGem: 1 }, damage: 3, label: '1 Blue Gem → 3 DMG' }],
    text: 'Spend 1 Blue Gem to deal 3 DMG to an enemy in range.',
  },
  {
    kind: 'deadly-shroud',
    name: 'Deadly Shroud',
    type: 'attackSpell',
    level: 2,
    count: 1,
    requiresSpellLevel: 1,
    collectionCost: { shadowFragment: 2 },
    range: 'adjacent',
    targetsAllOnHex: true,
    castTiers: [{ cost: { cursedCrystal: 1 }, damage: 5, label: '1 Cursed Crystal → 5 DMG' }],
    text: 'Spend 1 Cursed Crystal to deal 5 DMG to a Hex tile in range.',
  },
  {
    kind: 'fatal-fronds',
    name: 'Fatal Fronds',
    type: 'attackSpell',
    level: 1,
    count: 4,
    collectionCost: { anyOrb: 2 },
    range: 'same',
    castTiers: [{ cost: {}, damage: 2, label: '2 DMG' }],
    text: 'Deal 2 DMG to an enemy on your current Hex tile.',
  },
  {
    kind: 'feeding-frenzy',
    name: 'Feeding Frenzy',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { blueOrb: 1, blueGem: 1 },
    range: 'sameOrAdjacent',
    castTiers: upTo({ blueGem: 1 }, [2, 4], 'Blue Gem'),
    text: 'Spend up to 2 Blue Gems to deal 2/4 DMG to an enemy in range.',
  },
  {
    kind: 'heat-wave',
    name: 'Heat Wave',
    type: 'attackSpell',
    level: 1,
    count: 3,
    // The wiki page lists "1 Red Gem, 1 Red Crystal" — read as the Red Orb + Red Gem of its sister cards.
    collectionCost: { redGem: 1, redOrb: 1 },
    range: 'adjacent',
    castTiers: [{ cost: { redGem: 1 }, damage: 3, label: '1 Red Gem → 3 DMG' }],
    text: 'Spend 1 Red Gem to deal 3 DMG to an enemy in range.',
  },
  {
    kind: 'heavy-hand',
    name: 'Heavy Hand',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { redOrb: 1, redGem: 1 },
    range: 'sameOrAdjacent',
    castTiers: upTo({ redGem: 1 }, [2, 4], 'Red Gem'),
    text: 'Spend up to 2 Red Gems to deal 2/4 DMG to an enemy in range.',
  },
  {
    kind: 'infernal-assault',
    name: 'Infernal Assault',
    type: 'attackSpell',
    level: 3,
    count: 1,
    requiresSpellLevel: 2,
    collectionCost: { shadowFragment: 1, redOrb: 1 },
    range: 'upToTwo',
    castTiers: [{ cost: { redGem: 2 }, damage: 8, label: '2 Red Gems → 8 DMG' }],
    text: 'Spend 2 Red Gems to deal 8 DMG to an enemy in range.',
  },
  {
    kind: 'kinetic-wave',
    name: 'Kinetic Wave',
    type: 'attackSpell',
    level: 2,
    count: 1,
    requiresSpellLevel: 1,
    collectionCost: { blueOrb: 1, shadowFragment: 1, anyGem: 1 },
    range: 'twoNotSame',
    targetsAllOnHex: true,
    castTiers: [{ cost: { blueGem: 2 }, damage: 5, label: '2 Blue Gems → 5 DMG' }],
    text: 'Spend 2 Blue Gems to deal 5 DMG to a Hex tile in range.',
  },
  {
    kind: 'lightning-bug',
    name: 'Lightning Bug',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { anyOrb: 1, anyGem: 1 },
    range: 'adjacent',
    castTiers: [{ cost: { anyGem: 1 }, damage: 2, label: '1 Gem → 2 DMG (0 vs Shadow Form)' }],
    text: 'Spend 1 Gem to deal 2 DMG to an enemy in range. Deal 0 DMG if that enemy is in Shadow Form.',
  },
  {
    // UNCONFIRMED: no archived card page. Kept as built, plus the Level 1 Spell requirement
    // every confirmed Level 2 card carries.
    kind: 'magma-hand',
    name: 'Magma Hand',
    type: 'attackSpell',
    level: 2,
    count: 1,
    requiresSpellLevel: 1,
    collectionCost: { redGem: 1, redOrb: 1 },
    range: 'same',
    castTiers: [{ cost: { redGem: 2 }, damage: 5, label: '2 Red Gems → 5 DMG' }],
    text: 'Spend 2 Red Gems to deal 5 DMG to an enemy on your current Hex tile. (Unconfirmed text.)',
  },
  {
    kind: 'personal-space',
    name: 'Personal Space',
    type: 'attackSpell',
    level: 2,
    count: 1,
    requiresSpellLevel: 1,
    collectionCost: { anyOrb: 2 },
    range: 'same',
    castTiers: [{ cost: {}, damage: 4, label: '4 DMG' }],
    text: 'Deal 4 DMG to an enemy on your current Hex tile.',
  },
  {
    kind: 'phoenix-flash',
    name: 'Phoenix Flash',
    type: 'attackSpell',
    level: 2,
    count: 1,
    requiresSpellLevel: 1,
    collectionCost: { anyOrb: 1, redGem: 1 },
    range: 'sameOrAdjacent',
    castTiers: upTo({ redGem: 1 }, [3, 5, 6], 'Red Gem'),
    text: 'Spend up to 3 Red Gems to deal 3/5/6 DMG to an enemy in range.',
  },
  {
    kind: 'psychic-spikes',
    name: 'Psychic Spikes',
    type: 'attackSpell',
    level: 2,
    count: 1,
    requiresSpellLevel: 1,
    collectionCost: { redOrb: 1, shadowFragment: 1, anyGem: 1 },
    range: 'adjacent',
    targetsAllOnHex: true,
    castTiers: upTo({ anyGem: 1 }, [2, 3, 5, 6], 'Gem'),
    text: 'Spend up to 4 Gems to deal 2/3/5/6 DMG to a Hex tile in range.',
  },
  {
    kind: 'sinister-screech',
    name: 'Sinister Screech',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { shadowFragment: 1, anyGem: 2 },
    range: 'adjacent',
    castTiers: [{ cost: { cursedCrystal: 1 }, damage: 4, label: '1 Cursed Crystal → 4 DMG' }],
    text: 'Spend 1 Cursed Crystal to deal 4 DMG to an enemy in range.',
  },
  {
    kind: 'spectral-slap',
    name: 'Spectral Slap',
    type: 'attackSpell',
    level: 1,
    count: 3,
    collectionCost: { blueOrb: 1, anyGem: 1 },
    range: 'adjacent',
    targetsAllOnHex: true,
    castTiers: [{ cost: { redGem: 1, blueGem: 1 }, damage: 3, label: '1 Red Gem + 1 Blue Gem → 3 DMG' }],
    text: 'Spend 1 Red Gem and 1 Blue Gem to deal 3 DMG to a Hex tile in range.',
  },
  {
    kind: 'sudden-doom',
    name: 'Sudden Doom',
    type: 'attackSpell',
    level: 3,
    count: 1,
    requiresSpellLevel: 2,
    collectionCost: { shadowFragment: 1, blueOrb: 1 },
    range: 'sameOrAdjacent',
    targetsAllOnHex: true,
    castTiers: [1, 2, 3].map((n) => ({
      cost: { blueGem: n },
      damage: 5,
      hexCount: n,
      label: `${n} Blue Gem${n > 1 ? 's' : ''} → 5 DMG to ${n} Hex tile${n > 1 ? 's' : ''}`,
    })),
    text: 'Spend up to 3 Blue Gems to deal 5 DMG to 1/2/3 Hex tiles in range.',
  },
  {
    kind: 'unicorn-rush',
    name: 'Unicorn Rush',
    type: 'attackSpell',
    level: 2,
    count: 1,
    requiresSpellLevel: 1,
    collectionCost: { anyOrb: 1, blueGem: 1 },
    range: 'sameOrAdjacent',
    castTiers: upTo({ blueGem: 1 }, [3, 5, 6], 'Blue Gem'),
    text: 'Spend up to 3 Blue Gems to deal 3/5/6 DMG to an enemy in range.',
  },

  // ---- Conversion Spells (10) ----
  {
    kind: 'crystallization',
    name: 'Crystallization',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { blueOrb: 1, redGem: 1 },
    castTiers: [
      { cost: { redGem: 1 }, damage: 0, produce: ['redOrb'], label: 'Red Gem → Red Orb' },
      { cost: { blueGem: 1 }, damage: 0, produce: ['blueOrb'], label: 'Blue Gem → Blue Orb' },
      { cost: { purpleGem: 1 }, damage: 0, produce: ['purpleOrb'], label: 'Purple Gem → Purple Orb' },
    ],
    text: 'Turn 1 Gem in your Resource Pool into 1 Orb of the same color.',
  },
  {
    kind: 'curse-void',
    name: 'Curse Void',
    type: 'conversionSpell',
    level: 1,
    count: 2,
    collectionCost: { shadowFragment: 1, anyGem: 1 },
    castTiers: [
      { cost: { cursedCrystal: 1 }, damage: 0, produce: ['redGem'], label: 'Cursed Crystal → Red Gem' },
      { cost: { cursedCrystal: 1 }, damage: 0, produce: ['blueGem'], label: 'Cursed Crystal → Blue Gem' },
    ],
    text: 'Turn 1 Cursed Crystal in your Resource Pool into 1 Gem.',
  },
  {
    kind: 'energy-bloom',
    name: 'Energy Bloom',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 2 },
    castTiers: [
      { cost: { blueGem: 1 }, damage: 0, produce: ['redGem'], label: 'Blue Gem → Red Gem' },
      { cost: { redGem: 1 }, damage: 0, produce: ['blueGem'], label: 'Red Gem → Blue Gem' },
    ],
    text: 'Turn 1 Blue Gem in your Resource Pool into 1 Red Gem, or 1 Red Gem into 1 Blue Gem.',
  },
  {
    kind: 'gem-duplication',
    name: 'Gem Duplication',
    type: 'conversionSpell',
    level: 2,
    count: 1,
    requiresSpellLevel: 1,
    collectionCost: { anyGem: 1 },
    castTiers: [
      { cost: { redGem: 1 }, damage: 0, produce: ['redGem', 'redGem'], label: 'Red Gem → 2 Red Gems' },
      { cost: { blueGem: 1 }, damage: 0, produce: ['blueGem', 'blueGem'], label: 'Blue Gem → 2 Blue Gems' },
      { cost: { purpleGem: 1 }, damage: 0, produce: ['purpleGem', 'purpleGem'], label: 'Purple Gem → 2 Purple Gems' },
    ],
    text: 'Turn 1 Gem in your Resource Pool into 2 Gems of the same color.',
  },
  {
    kind: 'luminous-glow',
    name: 'Luminous Glow',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { redOrb: 1, blueGem: 1 },
    castTiers: [
      { cost: { redOrb: 1 }, damage: 0, produce: ['redGem'], label: 'Red Orb → Red Gem' },
      { cost: { blueOrb: 1 }, damage: 0, produce: ['blueGem'], label: 'Blue Orb → Blue Gem' },
      { cost: { purpleOrb: 1 }, damage: 0, produce: ['purpleGem'], label: 'Purple Orb → Purple Gem' },
    ],
    text: 'Turn 1 Orb in your Resource Pool into 1 Gem of the same color.',
  },
  {
    kind: 'metamorphosis',
    name: 'Metamorphosis',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 2 },
    castTiers: [
      { cost: { blueOrb: 1 }, damage: 0, produce: ['redOrb'], label: 'Blue Orb → Red Orb' },
      { cost: { redOrb: 1 }, damage: 0, produce: ['blueOrb'], label: 'Red Orb → Blue Orb' },
    ],
    text: 'Turn 1 Blue Orb in your Resource Pool into 1 Red Orb, or 1 Red Orb into 1 Blue Orb.',
  },
  {
    kind: 'orb-duplication',
    name: 'Orb Duplication',
    type: 'conversionSpell',
    level: 2,
    count: 1,
    requiresSpellLevel: 1,
    collectionCost: { anyOrb: 1 },
    castTiers: [
      { cost: { redOrb: 1 }, damage: 0, produce: ['redOrb', 'redOrb'], label: 'Red Orb → 2 Red Orbs' },
      { cost: { blueOrb: 1 }, damage: 0, produce: ['blueOrb', 'blueOrb'], label: 'Blue Orb → 2 Blue Orbs' },
      { cost: { purpleOrb: 1 }, damage: 0, produce: ['purpleOrb', 'purpleOrb'], label: 'Purple Orb → 2 Purple Orbs' },
    ],
    text: 'Turn 1 Orb in your Resource Pool into 2 Orbs of the same color.',
  },
  {
    kind: 'ruby-synthesis',
    name: 'Ruby Synthesis',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 1, redGem: 1 },
    castTiers: [
      { cost: { redOrb: 1 }, damage: 0, produce: ['redGem'], label: 'Red Orb → Red Gem' },
      { cost: { redGem: 1 }, damage: 0, produce: ['redOrb'], label: 'Red Gem → Red Orb' },
    ],
    text: 'Turn 1 Red Orb in your Resource Pool into 1 Red Gem, or 1 Red Gem into 1 Red Orb.',
  },
  {
    // UNCONFIRMED: no archived card page; modeled on its sister card Ruby Synthesis.
    kind: 'sapphire-synthesis',
    name: 'Sapphire Synthesis',
    type: 'conversionSpell',
    level: 1,
    count: 1,
    collectionCost: { anyOrb: 1, blueGem: 1 },
    castTiers: [
      { cost: { blueOrb: 1 }, damage: 0, produce: ['blueGem'], label: 'Blue Orb → Blue Gem' },
      { cost: { blueGem: 1 }, damage: 0, produce: ['blueOrb'], label: 'Blue Gem → Blue Orb' },
    ],
    text: 'Turn 1 Blue Orb in your Resource Pool into 1 Blue Gem, or 1 Blue Gem into 1 Blue Orb. (Unconfirmed text.)',
  },

  // ---- Resource cards (8): collected for 1 Action point and no Resources ----
  {
    kind: 'res-blue-gem',
    name: 'Blue Gem',
    type: 'resource',
    level: 1,
    count: 3,
    collectionCost: {},
    grantsResource: 'blueGem',
    text: 'Move this card to the discard pile to add 1 Blue Gem to your Resource Pool.',
  },
  {
    // UNCONFIRMED text (no archived page): the pattern of its three sister cards.
    kind: 'res-blue-orb',
    name: 'Blue Orb',
    type: 'resource',
    level: 1,
    count: 1,
    collectionCost: {},
    grantsResource: 'blueOrb',
    text: 'Move this card to the discard pile to add 1 Blue Orb to your Resource Pool.',
  },
  {
    kind: 'res-red-gem',
    name: 'Red Gem',
    type: 'resource',
    level: 1,
    count: 3,
    collectionCost: {},
    grantsResource: 'redGem',
    text: 'Move this card to the discard pile to add 1 Red Gem to your Resource Pool.',
  },
  {
    kind: 'res-red-orb',
    name: 'Red Orb',
    type: 'resource',
    level: 1,
    count: 1,
    collectionCost: {},
    grantsResource: 'redOrb',
    text: 'Move this card to the discard pile to add 1 Red Orb to your Resource Pool.',
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
    counterTrigger: 'attackSpellDamage',
    text: 'Reveal this card when an enemy deals DMG to you with an Attack Spell; reduce that DMG by 2.',
  },
  {
    kind: 'run-away',
    name: 'Run Away!',
    type: 'counterspell',
    level: 1,
    count: 3,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    counterTrigger: 'attackSpellDamage',
    text: 'Reveal this card when an enemy deals DMG to you with an Attack Spell; Travel to an adjacent Hex tile.',
  },
  {
    kind: 'bees-everywhere',
    name: 'Bees Everywhere',
    type: 'counterspell',
    level: 1,
    count: 2,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    counterTrigger: 'attackSpellDamage',
    text: 'Reveal this card when an enemy deals DMG to you with an Attack Spell; deal 3 DMG to that enemy.',
  },
  {
    kind: 'safety-dome',
    name: 'Safety Dome',
    type: 'counterspell',
    level: 1,
    count: 1,
    collectionCost: { anyGem: 1, anyOrb: 1 },
    counterTrigger: 'attackSpellDamage',
    text: 'Reveal this card when an enemy deals DMG to you with an Attack Spell; reduce that DMG to 0.',
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
    text: 'Each time you Cast an Attack Spell, you may spend 1 Gem to deal 2 DMG to an enemy on an adjacent Hex tile.',
  },
  {
    kind: 'crushing-tortoise',
    name: 'Crushing Tortoise',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Each time you end your turn on the same Hex tile as an enemy, you may deal 1 DMG to that enemy.',
  },
  {
    kind: 'cursemaster-raccoon',
    name: 'Cursemaster Raccoon',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Each time you Reroll, you may choose to Reroll Cursed Crystals.',
  },
  {
    kind: 'hydrattle-snake',
    name: 'Hydrattle Snake',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'On your turn, you may spend up to 5 Action points instead of 4.',
  },
  {
    kind: 'occult-octo',
    name: 'Occult Octo',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Each time you Protect, you may deal 1 DMG to an adjacent Hex tile.',
  },
  {
    kind: 'protective-panda',
    name: 'Protective Panda',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Each time an enemy deals more than 1 DMG to you with an Attack Spell, reduce that DMG by 1.',
  },
  {
    kind: 'recovery-raven',
    name: 'Recovery Raven',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Each time you Cast a Conversion Spell, you may spend 1 Orb to gain 1 HP.',
  },
  {
    // UNCONFIRMED: no archived card page; kept as built.
    kind: 'sharp-hedge',
    name: 'Sharp Hedge',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Whenever an enemy on your Hex tile deals DMG to you, deal 1 DMG back to them. (Unconfirmed text.)',
  },
  {
    kind: 'speed-mouster',
    name: 'Speed Mouster',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Each time you Travel, you may Travel twice instead of once.',
  },
  {
    kind: 'swamp-monster',
    name: 'Swamp Monster',
    type: 'companion',
    level: 1,
    count: 1,
    collectionCost: {},
    text: 'Each time you Protect, you may remove any number of Cursed Crystals from your Resource Pool instead of 1.',
  },
];

// ============================================================================
// The official expansion card lists (wiki "Inventory List" pages). Their texts were
// not sourced, so the decks below are a reconstruction; these lists are recorded for
// whoever sources the printed cards.
// ============================================================================

export const CS_ICE_STORM_OFFICIAL_CARDS = {
  attackSpells: { 'Draining Vines': 1, 'Earth Shatter': 1, 'Electric Twister': 3, 'Frozen Flock': 3, 'Glacial Strike': 1, Groundbreaker: 3, 'Shadow Swarm': 1, 'Supercharged Jewel': 1, 'Vort-Hex': 1 },
  conversionSpells: { 'Dark Duplication': 1, 'Gem Mutation': 1, Gemeration: 1, 'Orb Absorption': 1, Orbulence: 1 },
  resources: { 'Shadow Fragment': 4 },
  counterspells: { 'Icy Fists': 1, 'Knowledge Theft': 1, 'Positive Vibes': 1, 'Shocking Waves': 1 },
  companions: { 'Masked Monkey': 1, 'Mirror Crab': 1, 'Undersea Healer': 1, 'Scaled Alchemist': 1 },
} as const;

export const CS_MOLTEN_ROCK_OFFICIAL_CARDS = {
  attackSpells: { 'Combustion Blast': 3, 'Comet Storm': 3, 'Fragmented Focus': 2, 'Gravity Gambit': 1, 'Obsidian Arrow': 1, 'Pillar Guard': 1, 'Scorching Bolts': 2, 'Twilight Transit': 1 },
  conversionSpells: { 'Flameless Forge': 2, 'Radiant Refuge': 3, 'Shadow Sanctuary': 2, 'Shatter Surge': 3 },
  counterspells: { 'Arcane Wormhole': 1, 'Burn Buffer': 1, 'Healing Flame': 1, 'Phase Shift': 1 },
  companions: { 'Char Bull': 1, 'Ember Raptor': 1, 'Ferret Prowler': 1, 'Harvest Hamster': 1 },
} as const;

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
    range: 'upToTwo',
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
    counterTrigger: 'anyEnemyDamage',
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
    counterTrigger: 'anyEnemyDamage',
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
    counterTrigger: 'anyEnemyDamage',
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
    counterTrigger: 'anyEnemyDamage',
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
    range: 'upToTwo',
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
    counterTrigger: 'anyEnemyDamage',
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
    counterTrigger: 'anyEnemyDamage',
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
    counterTrigger: 'anyEnemyDamage',
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
          requiresSpellLevel: d.requiresSpellLevel,
          counterTrigger: d.counterTrigger,
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
