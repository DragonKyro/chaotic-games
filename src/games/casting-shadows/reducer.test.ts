import { describe, expect, it } from 'vitest';
import {
  CS_ALL_CHARACTERS,
  CS_CHARACTERS,
  CS_COMPANION_DEFS,
  CS_COUNTERSPELL_DEFS,
  CS_HEX_DEFS,
  CS_ICE_STORM_CHARACTERS,
  CS_ICE_STORM_COMPANION_DEFS,
  CS_ICE_STORM_COUNTERSPELL_DEFS,
  CS_ICE_STORM_HEX_DEFS,
  CS_ICE_STORM_MAIN_DECK_DEFS,
  CS_MAIN_DECK_DEFS,
  CS_MOLTEN_ROCK_CHARACTERS,
  CS_MOLTEN_ROCK_COMPANION_DEFS,
  CS_MOLTEN_ROCK_COUNTERSPELL_DEFS,
  CS_MOLTEN_ROCK_HEX_DEFS,
  CS_MOLTEN_ROCK_MAIN_DECK_DEFS,
  hexDistance,
  isHexInSpellRange,
  type CsMainCardDef,
} from './cards';
import { chooseAIAction, strikingHexes } from './ai';
import { castingShadowsModule } from './module';
import {
  applyAction,
  canUseShadowAbility,
  createInitialState,
  legalCounterspells,
  roomNeededFor,
  shadowAbilityTargets,
  travelDestinations,
} from './reducer';
import type { CsAction, CsCard, CsConfig, CsHexId, CsResource, CsState } from './types';
import { makeSeats, playOut } from '@/core/playout';
import type { Seat } from '@/core/types';

const DEFAULT_CFG: CsConfig = { expansions: [], characterByPlayer: {} };
const ALL_DEFS: CsMainCardDef[] = [
  ...CS_MAIN_DECK_DEFS, ...CS_COUNTERSPELL_DEFS, ...CS_COMPANION_DEFS,
  ...CS_ICE_STORM_MAIN_DECK_DEFS, ...CS_ICE_STORM_COUNTERSPELL_DEFS, ...CS_ICE_STORM_COMPANION_DEFS,
  ...CS_MOLTEN_ROCK_MAIN_DECK_DEFS, ...CS_MOLTEN_ROCK_COUNTERSPELL_DEFS, ...CS_MOLTEN_ROCK_COMPANION_DEFS,
];
let nextId = 5000;
function card(kind: string): CsCard {
  const d = ALL_DEFS.find((x) => x.kind === kind);
  if (!d) throw new Error(`no card ${kind}`);
  const { count: _count, ...rest } = d;
  return { ...rest, id: nextId++ };
}
const count = (defs: readonly CsMainCardDef[], type?: CsCard['type']) => defs.filter((d) => !type || d.type === type).reduce((s, d) => s + d.count, 0);

/** A fresh game whose player 1 has rolled `dice` (default: a harmless roll). */
function started(players = 2, cfg: CsConfig = DEFAULT_CFG, dice: CsResource[] = ['redGem', 'redOrb', 'blueGem', 'blueOrb', 'purpleGem']): CsState {
  const s = createInitialState(cfg, 42, makeSeats(players));
  return applyAction(s, { type: 'rollResourceDice', playerId: 'p1', dice });
}
const act = (s: CsState, a: CsAction) => applyAction(s, a);
const at = (s: CsState, pid: string, hex: CsHexId) => {
  s.boards[pid]!.hexId = hex;
};
const endTurn = (s: CsState, pid: string) => act(s, { type: 'transformAndEndTurn', playerId: pid, transform: false });
const roll = (s: CsState, pid: string, dice: CsResource[] = ['redGem', 'redOrb', 'blueGem', 'blueOrb', 'purpleGem']) =>
  act(s, { type: 'rollResourceDice', playerId: pid, dice, ...(dice.length === 4 ? { slots: [0, 1, 2, 3] } : {}) });

// ============================================================================
describe('Casting Shadows — components (base game: official inventory)', () => {
  it('has 4 Characters, 7 Hex Tiles, 52 Main Deck cards (34 / 10 / 8), 10 Counterspells and 10 Companions', () => {
    expect(CS_CHARACTERS.length).toBe(4);
    expect(CS_HEX_DEFS.length).toBe(7);
    expect(count(CS_MAIN_DECK_DEFS)).toBe(52);
    expect(count(CS_MAIN_DECK_DEFS, 'attackSpell')).toBe(34);
    expect(count(CS_MAIN_DECK_DEFS, 'conversionSpell')).toBe(10);
    expect(count(CS_MAIN_DECK_DEFS, 'resource')).toBe(8);
    expect(count(CS_COUNTERSPELL_DEFS)).toBe(10);
    expect(count(CS_COMPANION_DEFS)).toBe(10);
  });

  it('has the printed home hexes, Shadow Ability costs and hex-tile effects', () => {
    const home = Object.fromEntries(CS_CHARACTERS.map((c) => [c.id, c.homeHex]));
    expect(home).toEqual({ kit: 'amber-mountain', frill: 'floating-lake', nuzzle: 'dark-forest', haze: 'mushroom-cave' });
    expect(Object.fromEntries(CS_CHARACTERS.map((c) => [c.id, c.shadowAbilityCost]))).toEqual({ kit: 3, frill: 3, nuzzle: 4, haze: 5 });
    const yieldOf = Object.fromEntries(CS_HEX_DEFS.map((h) => [h.id, h.startTurnResource]));
    expect(yieldOf['underground-volcano']).toBe('shadowFragment');
    expect(yieldOf['dark-forest']).toBe('redOrb');
    expect(yieldOf['floating-lake']).toBe('blueOrb');
    expect(yieldOf['ancient-rune']).toBeNull();
  });

  it('Level 2 / 3 cards carry the gray Spell requirement; Resource cards are free to collect', () => {
    for (const d of CS_MAIN_DECK_DEFS) {
      if (d.level === 2) expect(d.requiresSpellLevel, d.name).toBe(1);
      if (d.level === 3) expect(d.requiresSpellLevel, d.name).toBe(2);
      if (d.type === 'resource') expect(d.collectionCost, d.name).toEqual({});
    }
    expect(CS_COUNTERSPELL_DEFS.every((d) => d.counterTrigger === 'attackSpellDamage')).toBe(true);
  });

  it('records the expansions with official hexes and Character names; 5–6 players need an expansion', () => {
    expect(CS_ICE_STORM_CHARACTERS.map((c) => c.lightName)).toEqual(['Talon Lightfeather', 'Frost Polarpaw']);
    expect(CS_MOLTEN_ROCK_CHARACTERS.map((c) => c.lightName)).toEqual(['Dread Terrashell', 'Ashe Firecrest']);
    expect(CS_ICE_STORM_HEX_DEFS.map((h) => h.id)).toEqual(['mushroom-bog', 'desolate-glacier', 'floating-temple']);
    expect(CS_MOLTEN_ROCK_HEX_DEFS.map((h) => h.id)).toEqual(['sacred-falls', 'cobble-cove', 'fiery-meadows']);
    expect(castingShadowsModule.maxPlayers).toBe(6);
    expect(castingShadowsModule.validateConfig({ expansions: [], characterByPlayer: {} }, makeSeats(5)).length).toBeGreaterThan(0);
    expect(castingShadowsModule.validateConfig({ expansions: ['ice-storm'], characterByPlayer: {} }, makeSeats(6))).toEqual([]);
  });

  it('measures the five official ranges in hex tiles', () => {
    const s = createInitialState(DEFAULT_CFG, 1, makeSeats(4));
    const h = s.hexes;
    // p1's home (bottom right) to p3's home (top left) is 2 tiles; to the Ancient Rune 1.
    const far = s.boards.p3!.hexId;
    const home = s.boards.p1!.hexId;
    expect(hexDistance(h[home], h[far])).toBe(2);
    expect(isHexInSpellRange(h, home, home, 'same')).toBe(true);
    expect(isHexInSpellRange(h, home, home, 'adjacent')).toBe(false);
    expect(isHexInSpellRange(h, home, 'ancient-rune', 'adjacent')).toBe(true);
    expect(isHexInSpellRange(h, home, far, 'sameOrAdjacent')).toBe(false);
    expect(isHexInSpellRange(h, home, far, 'upToTwo')).toBe(true);
    expect(isHexInSpellRange(h, home, home, 'twoNotSame')).toBe(false);
    expect(isHexInSpellRange(h, home, far, 'twoNotSame')).toBe(true);
  });
});

// ============================================================================
describe('Casting Shadows — setup', () => {
  it('lays out the 7-tile map by seat, deals 5 face-up cards and a 3-card Companion Portal, everyone at 18 HP on their home', () => {
    const s = createInitialState(DEFAULT_CFG, 42, makeSeats(4));
    expect(Object.keys(s.hexes)).toHaveLength(7);
    expect([s.hexes['dusty-desert'].q, s.hexes['ancient-rune'].q, s.hexes['underground-volcano'].q]).toEqual([-1, 0, 1]);
    const p1 = s.hexes[s.boards.p1!.hexId];
    expect([p1.q, p1.r]).toEqual([0, 1]); // bottom right, beside the Underground Volcano
    expect(Object.values(s.hexes).filter((h) => h.faceUpCard)).toHaveLength(5);
    expect(s.hexes['ancient-rune'].faceUpCard).toBeNull();
    expect(s.hexes['dusty-desert'].faceUpCard).toBeNull();
    expect(s.companionPortal).toHaveLength(3);
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      const b = s.boards[id]!;
      expect(b.hp).toBe(18);
      expect(b.shadowEnergy).toBe(0);
      expect(b.hexId).toBe(CS_ALL_CHARACTERS.find((c) => c.id === b.characterId)!.homeHex);
    }
    expect(new Set(Object.values(s.boards).map((b) => b.characterId)).size).toBe(4);
  });

  it('fills spare positions with the remaining tiles, and gives two seats the same Character never', () => {
    const s = createInitialState({ expansions: [], characterByPlayer: { p1: 'kit', p2: 'kit' } }, 3, makeSeats(2));
    expect(Object.keys(s.hexes)).toHaveLength(7);
    expect(s.boards.p1!.characterId).toBe('kit');
    expect(s.boards.p2!.characterId).not.toBe('kit');
  });

  it('uses the 10-tile map for 5–6 players (Mushroom Bog in the middle, cards only on the edges)', () => {
    const s = createInitialState({ expansions: ['ice-storm'], characterByPlayer: {} }, 9, makeSeats(6));
    expect(Object.keys(s.hexes)).toHaveLength(10);
    expect([s.hexes['mushroom-bog'].q, s.hexes['mushroom-bog'].r]).toEqual([1, 0]);
    expect(Object.values(s.hexes).filter((h) => h.hasMainDeckSlot)).toHaveLength(5);
    expect(new Set(Object.values(s.boards).map((b) => b.hexId)).size).toBe(6);
  });
});

// ============================================================================
describe('Casting Shadows — the turn', () => {
  it('Phase 1: start-of-turn tokens and the Ancient Rune heal; 4 Action points', () => {
    let s = createInitialState(DEFAULT_CFG, 42, makeSeats(2));
    at(s, 'p1', 'underground-volcano');
    s = roll(s, 'p1');
    expect(s.bonusPool).toEqual(['shadowFragment']);
    expect(s.actionPointsRemaining).toBe(4);
    s = endTurn(s, 'p1');
    at(s, 'p2', 'ancient-rune');
    s.boards.p2!.hp = 10;
    s = roll(s, 'p2');
    expect(s.boards.p2!.hp).toBe(12);
    expect(s.bonusPool).toEqual([]);
  });

  it('Phase 3: absorbs fragments, offers (not forces) Shadow Form, summons a Companion, then Cursed Crystals hurt', () => {
    let s = started(2, DEFAULT_CFG, ['shadowFragment', 'shadowFragment', 'shadowFragment', 'cursedCrystal', 'redGem']);
    const stay = endTurn(s, 'p1');
    expect(stay.boards.p1!.form).toBe('light');
    expect(stay.boards.p1!.shadowEnergy).toBe(3);
    expect(stay.boards.p1!.hp).toBe(17);
    s = act(s, { type: 'transformAndEndTurn', playerId: 'p1', transform: true });
    expect(s.boards.p1!.form).toBe('shadow');
    expect(s.boards.p1!.shadowEnergy).toBe(0);
    expect(s.subPhase).toBe('awaitingCompanionPick');
    s = act(s, { type: 'pickCompanion', playerId: 'p1', companionId: s.companionPortal[1]!.id });
    expect(s.boards.p1!.hp).toBe(17);
    expect(s.turnPlayerId).toBe('p2');
  });

  it('Protect removes one Cursed Crystal; Cursed Crystals cannot be rerolled', () => {
    let s = started(2, DEFAULT_CFG, ['cursedCrystal', 'cursedCrystal', 'blueGem', 'blueOrb', 'purpleGem']);
    expect(() => act(s, { type: 'rerollDice', playerId: 'p1', diceIndices: [0], newValues: ['redGem'] })).toThrow(/Cursed/);
    s = act(s, { type: 'protect', playerId: 'p1' });
    expect(s.dicePool.filter((r) => r === 'cursedCrystal')).toHaveLength(1);
    expect(s.actionPointsRemaining).toBe(3);
  });

  it('cards cannot be collected on the Ancient Rune; Refresh is barred on it and Dusty Desert', () => {
    let s = started();
    at(s, 'p1', 'ancient-rune');
    expect(() => act(s, { type: 'collectCard', playerId: 'p1' })).toThrow();
    expect(() => act(s, { type: 'refreshHexCard', playerId: 'p1' })).toThrow();
    at(s, 'p1', 'dusty-desert');
    expect(() => act(s, { type: 'refreshHexCard', playerId: 'p1' })).toThrow();
    s = act(s, { type: 'collectCard', playerId: 'p1', fromCounterspellDeck: true });
    expect(s.boards.p1!.spellBook[0]!.type).toBe('counterspell');
  });
});

// ============================================================================
describe('Casting Shadows — Spell Book', () => {
  it('a full book asks which Spell or Resource card to discard — never a Counterspell, never picked for you', () => {
    let s = started();
    const book = [card('pointed-shield'), card('fatal-fronds'), card('res-red-gem'), card('curse-void'), card('heavy-hand')];
    s.boards.p1!.spellBook = book;
    const hex = s.boards.p1!.hexId;
    s.hexes[hex].faceUpCard = card('bubble-trouble');
    const room = roomNeededFor(s, 'p1', s.hexes[hex].faceUpCard)!;
    expect(room.map((c) => c.kind)).toEqual(['fatal-fronds', 'res-red-gem', 'curse-void', 'heavy-hand']);
    expect(() => act(s, { type: 'collectCard', playerId: 'p1' })).toThrow(/choose/);
    expect(() => act(s, { type: 'collectCard', playerId: 'p1', replaceSpellId: book[0]!.id })).toThrow();
    s = act(s, { type: 'collectCard', playerId: 'p1', replaceSpellId: book[2]!.id });
    expect(s.boards.p1!.spellBook.map((c) => c.kind)).toEqual(['pointed-shield', 'fatal-fronds', 'curse-void', 'heavy-hand', 'bubble-trouble']);
    expect(s.mainDiscard.map((c) => c.kind)).toContain('res-red-gem');
  });

  it('a Level 2 card costs a Level 1 Attack or Conversion Spell of your choice (exactly that level)', () => {
    let s = started(2, DEFAULT_CFG, ['redGem', 'redOrb', 'blueGem', 'blueOrb', 'purpleOrb']);
    const lvl1a = card('fatal-fronds');
    const lvl1b = card('curse-void');
    s.boards.p1!.spellBook = [card('pointed-shield'), card('res-blue-gem'), lvl1a, lvl1b];
    const hex = s.boards.p1!.hexId;
    s.hexes[hex].faceUpCard = card('unicorn-rush'); // L2: lvl 1 Spell + 1 Orb + 1 Blue Gem
    expect(roomNeededFor(s, 'p1', s.hexes[hex].faceUpCard)!.map((c) => c.kind)).toEqual(['fatal-fronds', 'curse-void']);
    expect(() => act(s, { type: 'collectCard', playerId: 'p1' })).toThrow(/choose/);
    s = act(s, { type: 'collectCard', playerId: 'p1', replaceSpellId: lvl1b.id });
    expect(s.boards.p1!.spellBook.map((c) => c.kind)).toEqual(['pointed-shield', 'res-blue-gem', 'fatal-fronds', 'unicorn-rush']);
  });

  it('a Level 3 card needs a Level 2 spell — a Level 1 will not do', () => {
    const s = started(2, DEFAULT_CFG, ['redGem', 'redOrb', 'blueGem', 'blueOrb', 'shadowFragment']);
    s.boards.p1!.spellBook = [card('fatal-fronds'), card('heavy-hand')];
    const hex = s.boards.p1!.hexId;
    s.hexes[hex].faceUpCard = card('sudden-doom');
    expect(() => act(s, { type: 'collectCard', playerId: 'p1' })).toThrow(/Level 2/);
    s.boards.p1!.spellBook.push(card('personal-space'));
    const after = act(s, { type: 'collectCard', playerId: 'p1' }); // the only Level 2 goes, no prompt needed
    expect(after.boards.p1!.spellBook.map((c) => c.kind)).toEqual(['fatal-fronds', 'heavy-hand', 'sudden-doom']);
  });

  it('a Resource card is collected for no Resources and spent for its token without an Action point', () => {
    let s = started();
    const hex = s.boards.p1!.hexId;
    s.hexes[hex].faceUpCard = card('res-red-orb');
    s = act(s, { type: 'collectCard', playerId: 'p1' });
    expect(s.dicePool).toHaveLength(5);
    const res = s.boards.p1!.spellBook[0]!;
    const apBefore = s.actionPointsRemaining;
    s = act(s, { type: 'useResourceCard', playerId: 'p1', cardId: res.id });
    expect(s.actionPointsRemaining).toBe(apBefore);
    expect(s.bonusPool).toContain('redOrb');
    expect(s.boards.p1!.spellBook).toHaveLength(0);
    expect(s.mainDiscard.map((c) => c.id)).toContain(res.id);
  });
});

// ============================================================================
describe('Casting Shadows — attacks, hexes and Counterspells', () => {
  it('a hex-wide spell hits every enemy on the tile, each with their own reductions (the old queue stopped after the first)', () => {
    let s = started(4, DEFAULT_CFG, ['redGem', 'redOrb', 'blueGem', 'blueOrb', 'purpleGem']);
    at(s, 'p1', 'ancient-rune');
    for (const p of ['p2', 'p3', 'p4']) at(s, p, 'underground-volcano');
    s.boards.p3!.companion = card('protective-panda');
    s.boards.p1!.spellBook = [card('spectral-slap')]; // 1 Red Gem + 1 Blue Gem → 3 DMG to a Hex tile in range (adjacent)
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[0]!.id, targetHexId: 'underground-volcano' });
    expect(s.boards.p2!.hp).toBe(15);
    expect(s.boards.p3!.hp).toBe(16); // Protective Panda: more than 1 DMG from an Attack Spell, -1
    expect(s.boards.p4!.hp).toBe(15);
    expect(s.subPhase).toBe('awaitingAction');
  });

  it('Counterspell windows open in turn order from the next player, and a used Counterspell goes to the bottom of its deck', () => {
    let s = started(4);
    at(s, 'p1', 'ancient-rune');
    for (const p of ['p2', 'p3', 'p4']) at(s, p, 'underground-volcano');
    const shield = card('pointed-shield');
    const dome = card('safety-dome');
    s.boards.p4!.spellBook = [shield];
    s.boards.p2!.spellBook = [dome];
    s.boards.p1!.spellBook = [card('spectral-slap')];
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[0]!.id, targetHexId: 'underground-volcano' });
    expect(s.activePlayerId).toBe('p2');
    s = act(s, { type: 'respondCounterspell', playerId: 'p2', counterspellId: dome.id });
    expect(s.boards.p2!.hp).toBe(18);
    expect(s.counterspellDeck[s.counterspellDeck.length - 1]!.id).toBe(dome.id);
    expect(s.boards.p3!.hp).toBe(15); // no Counterspell: hit straight away
    expect(s.activePlayerId).toBe('p4');
    s = act(s, { type: 'respondCounterspell', playerId: 'p4', counterspellId: shield.id });
    expect(s.boards.p4!.hp).toBe(17);
    expect(s.activePlayerId).toBe('p1');
  });

  it('Run Away! asks where to run, and the DMG still lands; Bees Everywhere deals 3 back', () => {
    let s = started();
    at(s, 'p1', 'ancient-rune');
    at(s, 'p2', 'underground-volcano');
    const run = card('run-away');
    s.boards.p2!.spellBook = [run, card('bees-everywhere')];
    s.boards.p1!.spellBook = [card('bubble-trouble')];
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[0]!.id, targetPlayerId: 'p2' });
    expect(s.subPhase).toBe('awaitingCounterspell');
    expect(() => act(s, { type: 'respondCounterspell', playerId: 'p2', counterspellId: run.id })).toThrow(/adjacent/);
    const fled = act(s, { type: 'respondCounterspell', playerId: 'p2', counterspellId: run.id, escapeHexId: 'ancient-rune' });
    expect(fled.boards.p2!.hexId).toBe('ancient-rune');
    expect(fled.boards.p2!.hp).toBe(15);
    const bees = act(s, { type: 'respondCounterspell', playerId: 'p2', counterspellId: s.boards.p2!.spellBook[1]!.id });
    expect(bees.boards.p1!.hp).toBe(15);
    expect(bees.boards.p2!.hp).toBe(15);
  });

  it('Counterspells answer Attack Spells only — but the window still opens for any Counterspell holder (they stay secret)', () => {
    let s = started();
    s.boards.p2!.spellBook = [card('pointed-shield')];
    s.boards.p1!.form = 'shadow';
    s.boards.p1!.shadowEnergy = 5;
    s = act(s, { type: 'useShadowAbility', playerId: 'p1' }); // Kit: 1 unreducible DMG to each enemy, not an Attack Spell
    expect(s.subPhase).toBe('awaitingAction'); // base game: no Counterspell answers it, so no window
    expect(s.boards.p2!.hp).toBe(17);
    expect(legalCounterspells(s, 'p2')).toEqual([]);
  });

  it('Amber Mountain shields a lone caster from Attack Spells; Mushroom Cave trims hits of more than 1', () => {
    let s = started();
    at(s, 'p1', 'ancient-rune');
    at(s, 'p2', 'amber-mountain');
    s.boards.p1!.spellBook = [card('bubble-trouble'), card('lightning-bug')];
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[0]!.id, targetPlayerId: 'p2' });
    expect(s.boards.p2!.hp).toBe(18);
    at(s, 'p2', 'mushroom-cave');
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[1]!.id, targetPlayerId: 'p2' });
    expect(s.boards.p2!.hp).toBe(17);
  });

  it('Lightning Bug does nothing to a Shadow Form enemy', () => {
    let s = started();
    at(s, 'p1', 'ancient-rune');
    at(s, 'p2', 'underground-volcano');
    s.boards.p2!.form = 'shadow';
    s.boards.p1!.spellBook = [card('lightning-bug')];
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[0]!.id, targetPlayerId: 'p2' });
    expect(s.boards.p2!.hp).toBe(18);
  });

  it('Sudden Doom aims at 1/2/3 hexes depending on what you spend', () => {
    let s = started(3, DEFAULT_CFG, ['redGem', 'redOrb', 'blueGem', 'blueGem', 'blueOrb']);
    at(s, 'p1', 'ancient-rune');
    at(s, 'p2', 'underground-volcano');
    at(s, 'p3', 'dusty-desert');
    s.boards.p1!.spellBook = [card('sudden-doom')];
    const id = s.boards.p1!.spellBook[0]!.id;
    expect(() => act(s, { type: 'castSpell', playerId: 'p1', spellId: id, tierIndex: 1, targetHexId: 'underground-volcano' })).toThrow(/2 Hex/);
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: id, tierIndex: 1, targetHexIds: ['underground-volcano', 'dusty-desert'] });
    expect([s.boards.p2!.hp, s.boards.p3!.hp]).toEqual([13, 13]);
  });

  it('an eliminated caster discards their Spell Book; dying on your own turn ends it', () => {
    let s = started(3);
    at(s, 'p1', 'ancient-rune');
    at(s, 'p2', 'underground-volcano');
    s.boards.p1!.hp = 2;
    s.boards.p1!.spellBook = [card('bubble-trouble')];
    s.boards.p2!.spellBook = [card('bees-everywhere'), card('heavy-hand')];
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[0]!.id, targetPlayerId: 'p2' });
    s = act(s, { type: 'respondCounterspell', playerId: 'p2', counterspellId: s.boards.p2!.spellBook[0]!.id });
    expect(s.eliminated).toEqual(['p1']);
    expect(s.boards.p1!.spellBook).toEqual([]);
    expect(s.mainDiscard.map((c) => c.kind)).toContain('bubble-trouble');
    expect(s.turnPlayerId).toBe('p2');
    expect(s.subPhase).toBe('awaitingRoll');
  });
});

// ============================================================================
describe('Casting Shadows — Shadow Abilities', () => {
  it('needs a fully charged tracker (5), then spends the board cost', () => {
    const s = started();
    s.boards.p1!.form = 'shadow';
    s.boards.p1!.shadowEnergy = 4;
    expect(canUseShadowAbility(s, 'p1')).toBe(false);
    expect(() => act(s, { type: 'useShadowAbility', playerId: 'p1' })).toThrow(/fully charged/);
    s.boards.p1!.shadowEnergy = 5;
    const after = act(s, { type: 'useShadowAbility', playerId: 'p1' });
    expect(after.boards.p1!.shadowEnergy).toBe(2); // Kit spends 3
  });

  it('Nuzzle the Savage chooses how much HP to give up and deals that much to each enemy', () => {
    let s = started(3, { expansions: [], characterByPlayer: { p1: 'nuzzle' } });
    s.boards.p1!.form = 'shadow';
    s.boards.p1!.shadowEnergy = 5;
    const t = shadowAbilityTargets(s, 'p1');
    expect(t).toEqual({ kind: 'amount', max: 4, hits: true });
    expect(() => act(s, { type: 'useShadowAbility', playerId: 'p1' })).toThrow(/how much/);
    s = act(s, { type: 'useShadowAbility', playerId: 'p1', amount: 3 });
    expect([s.boards.p1!.hp, s.boards.p2!.hp, s.boards.p3!.hp]).toEqual([15, 15, 15]);
  });

  it('Haze the Devastator deals 5 to a Hex tile in range (you choose the tile)', () => {
    let s = started(2, { expansions: [], characterByPlayer: { p1: 'haze' } });
    s.boards.p1!.form = 'shadow';
    s.boards.p1!.shadowEnergy = 5;
    expect(() => act(s, { type: 'useShadowAbility', playerId: 'p1' })).toThrow(/Hex tile/);
    s = act(s, { type: 'useShadowAbility', playerId: 'p1', targetHexId: s.boards.p2!.hexId });
    expect(s.boards.p2!.hp).toBe(13);
    expect(s.boards.p1!.shadowEnergy).toBe(0);
  });
});

// ============================================================================
describe('Casting Shadows — Companions', () => {
  it('Speed Mouster travels two tiles; Hydrattle Snake gives 5 Action points', () => {
    let s = createInitialState(DEFAULT_CFG, 42, makeSeats(2));
    s.boards.p1!.companion = card('speed-mouster');
    s = roll(s, 'p1');
    const far = Object.keys(s.hexes).find((h) => hexDistance(s.hexes[s.boards.p1!.hexId], s.hexes[h as CsHexId]) === 2) as CsHexId;
    expect(travelDestinations(s, 'p1')).toContain(far);
    s = act(s, { type: 'travel', playerId: 'p1', toHexId: far });
    expect(s.boards.p1!.hexId).toBe(far);
    s = endTurn(s, 'p1');
    s.boards.p2!.companion = card('hydrattle-snake');
    s = roll(s, 'p2');
    expect(s.actionPointsRemaining).toBe(5);
  });

  it('Charging Stag offers a 2-DMG charge after an Attack Spell (you may decline); Recovery Raven offers a heal after a Conversion', () => {
    let s = started(2, DEFAULT_CFG, ['redGem', 'redOrb', 'blueGem', 'blueOrb', 'purpleGem']);
    at(s, 'p1', 'ancient-rune');
    at(s, 'p2', 'underground-volcano');
    s.boards.p1!.companion = card('charging-stag');
    s.boards.p1!.spellBook = [card('bubble-trouble')];
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[0]!.id, targetPlayerId: 'p2' });
    expect(s.subPhase).toBe('awaitingOffer');
    expect(s.pendingOffer?.kind).toBe('stagStrike');
    const declined = act(s, { type: 'answerOffer', playerId: 'p1', accept: false });
    expect(declined.boards.p2!.hp).toBe(15);
    s = act(s, { type: 'answerOffer', playerId: 'p1', accept: true, targetPlayerId: 'p2' });
    expect(s.boards.p2!.hp).toBe(13);
    expect(s.subPhase).toBe('awaitingAction');

    let r = started(2, DEFAULT_CFG, ['redGem', 'redOrb', 'blueGem', 'blueOrb', 'purpleGem']);
    r.boards.p1!.companion = card('recovery-raven');
    r.boards.p1!.hp = 10;
    r.boards.p1!.spellBook = [card('metamorphosis')];
    r = act(r, { type: 'castSpell', playerId: 'p1', spellId: r.boards.p1!.spellBook[0]!.id, tierIndex: 1 });
    expect(r.pendingOffer?.kind).toBe('ravenHeal');
    r = act(r, { type: 'answerOffer', playerId: 'p1', accept: true });
    expect(r.boards.p1!.hp).toBe(11);
  });

  it('Crushing Tortoise offers 1 DMG to each enemy on your hex as the turn ends; Cursemaster Raccoon rerolls Cursed Crystals; Swamp Monster purges them all', () => {
    let s = started(3);
    at(s, 'p2', s.boards.p1!.hexId);
    s.boards.p1!.companion = card('crushing-tortoise');
    s = endTurn(s, 'p1');
    expect(s.pendingOffer?.kind).toBe('tortoise');
    s = act(s, { type: 'answerOffer', playerId: 'p1', accept: true, targetPlayerId: 'p2' });
    expect(s.boards.p2!.hp).toBe(17);
    expect(s.turnPlayerId).toBe('p2');

    let r = started(2, DEFAULT_CFG, ['cursedCrystal', 'cursedCrystal', 'blueGem', 'blueOrb', 'cursedCrystal']);
    r.boards.p1!.companion = card('cursemaster-raccoon');
    r = act(r, { type: 'rerollDice', playerId: 'p1', diceIndices: [0], newValues: ['redGem'] });
    expect(r.dicePool[0]).toBe('redGem');
    r.boards.p1!.companion = card('swamp-monster');
    r = act(r, { type: 'protect', playerId: 'p1' });
    expect(r.dicePool.includes('cursedCrystal')).toBe(false);
  });
});

// ============================================================================
describe('Casting Shadows — The Ice Storm', () => {
  const ICE: CsConfig = { expansions: ['ice-storm'], characterByPlayer: { p1: 'talon', p2: 'frost' } };

  it('Talon starts on Floating Temple and Frost on Desolate Glacier', () => {
    const s = createInitialState(ICE, 101, makeSeats(2));
    expect(s.boards.p1!.hexId).toBe('floating-temple');
    expect(s.boards.p2!.hexId).toBe('desolate-glacier');
  });

  it('Stun: roll only 4 dice (you choose which sits out); the token comes off after that turn', () => {
    let s = createInitialState(ICE, 101, makeSeats(2));
    s = roll(s, 'p1');
    at(s, 'p2', s.boards.p1!.hexId);
    s.boards.p1!.form = 'shadow';
    s.boards.p1!.shadowEnergy = 5;
    s = act(s, { type: 'useShadowAbility', playerId: 'p1' }); // Talon: Stun each enemy on your hex
    expect(s.boards.p2!.stunned).toBe(true);
    s = endTurn(s, 'p1');
    expect(() => roll(s, 'p2')).toThrow(/4 Resource dice/);
    s = act(s, { type: 'rollResourceDice', playerId: 'p2', dice: ['redGem', 'redOrb', 'blueGem', 'purpleGem'], slots: [0, 1, 2, 4] });
    expect(s.dicePool).toHaveLength(4);
    expect(s.diceSlots).toEqual([0, 1, 2, 4]);
    expect(s.actionPointsRemaining).toBe(4);
    s = endTurn(s, 'p2');
    expect(s.boards.p2!.stunned).toBe(false);
  });

  it('Freeze: no Travel (no paying your way out); frozen on your own turn, the token lasts until the end of your next turn', () => {
    let s = createInitialState(ICE, 101, makeSeats(2));
    s = roll(s, 'p1');
    s.boards.p1!.frozen = true; // as if frozen during this turn
    expect(travelDestinations(s, 'p1')).toEqual([]);
    expect(() => act(s, { type: 'travel', playerId: 'p1', toHexId: 'ancient-rune' })).toThrow(/Frozen/);
    s = endTurn(s, 'p1');
    expect(s.boards.p1!.frozen).toBe(true); // didn't start the turn Frozen
    s = endTurn(roll(s, 'p2'), 'p2');
    s = roll(s, 'p1');
    s = endTurn(s, 'p1');
    expect(s.boards.p1!.frozen).toBe(false);
  });

  it('Desolate Glacier offers to spend a Blue Orb to Freeze whoever you hit; Mushroom Bog adds 1 DMG', () => {
    let s = createInitialState({ expansions: ['ice-storm'], characterByPlayer: {} }, 5, makeSeats(6));
    s = roll(s, 'p1', ['redGem', 'redOrb', 'blueGem', 'blueOrb', 'purpleGem']);
    at(s, 'p1', 'desolate-glacier');
    at(s, 'p2', 'desolate-glacier');
    s.boards.p1!.spellBook = [card('fatal-fronds'), card('fatal-fronds')];
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[0]!.id, targetPlayerId: 'p2' });
    expect(s.pendingOffer).toMatchObject({ kind: 'hexStatus', effect: 'freeze', targetId: 'p2' });
    s = act(s, { type: 'answerOffer', playerId: 'p1', accept: true });
    expect(s.boards.p2!.frozen).toBe(true);
    expect(s.dicePool).not.toContain('blueOrb');
    at(s, 'p1', 'mushroom-bog');
    at(s, 'p2', 'mushroom-bog');
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[1]!.id, targetPlayerId: 'p2' });
    expect(s.boards.p2!.hp).toBe(18 - 2 - 3);
  });

  it('Stunning the player whose turn it is lets you take a Resource from their pool (or nothing)', () => {
    let s = createInitialState(ICE, 7, makeSeats(2));
    s = roll(s, 'p1');
    at(s, 'p1', 'ancient-rune'); // off Talon's Floating Temple, whose own Stun offer would come first
    at(s, 'p2', 'ancient-rune');
    s.boards.p2!.spellBook = [card('shocking-waves')]; // reconstructed: -1 DMG and Stun the attacker
    s.boards.p1!.spellBook = [card('fatal-fronds')];
    s = act(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[0]!.id, targetPlayerId: 'p2' });
    s = act(s, { type: 'respondCounterspell', playerId: 'p2', counterspellId: s.boards.p2!.spellBook[0]!.id });
    expect(s.boards.p1!.stunned).toBe(true);
    expect(s.subPhase).toBe('awaitingStunSteal');
    expect(s.activePlayerId).toBe('p2');
    const before = s.dicePool.length + s.bonusPool.length;
    s = act(s, { type: 'stunSteal', playerId: 'p2', poolIndex: 0 });
    expect(s.dicePool.length + s.bonusPool.length).toBe(before - 1);
    expect(s.activePlayerId).toBe('p1');
  });
});

// ============================================================================
describe('Casting Shadows — AI', () => {
  it('never reads opponents\' Counterspells or the decks, and answers every prompt', () => {
    const s = started();
    s.boards.p2!.spellBook = [card('pointed-shield')];
    const before = JSON.stringify(s.counterspellDeck);
    expect(chooseAIAction(s, 'p1')).toBeTruthy();
    expect(JSON.stringify(s.counterspellDeck)).toBe(before);
  });

  it('travels into range when every spell it holds needs an adjacent hex and the enemy shares its hex', () => {
    const s = started();
    at(s, 'p1', 'ancient-rune');
    at(s, 'p2', 'ancient-rune');
    s.boards.p1!.spellBook = [card('bubble-trouble')];
    expect(strikingHexes(s, 'p1').has('ancient-rune')).toBe(false);
    const a = chooseAIAction(s, 'p1');
    expect(a?.type).toBe('travel');
  });

  it('regression: the old 1-in-500 stalemate deal (3 seats, seed 699613345) now ends', () => {
    const seats: Seat[] = ['host-uuid', 'guest-uuid', 'ai-1'].map((id) => ({ id, name: id, color: '#888', isAI: true, isLocal: false }));
    const { state, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(DEFAULT_CFG, 699613345, seats), 4000);
    expect(stuck).toBe(false);
    expect(state.phase).toBe('gameOver');
  });

  it('plays full AI-vs-AI games across 2–4 players to completion, scored by players outlasted', () => {
    for (const playerCount of [2, 3, 4]) {
      for (let seed = 1; seed <= 4; seed++) {
        const { state: s, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(DEFAULT_CFG, seed * 37, makeSeats(playerCount)), 4000);
        expect(stuck).toBe(false);
        expect(s.phase).toBe('gameOver');
        expect(s.winnerId).toBeTruthy();
        expect([...Object.values(s.finalScores!)].sort((x, y) => x - y)).toEqual([...Array(playerCount).keys()]);
        expect(s.finalScores![s.winnerId!]).toBe(playerCount - 1);
      }
    }
  });

  it('plays full AI-vs-AI games with each expansion and 5–6 players', () => {
    const configs: { cfg: CsConfig; players: number }[] = [
      { cfg: { expansions: ['ice-storm'], characterByPlayer: {} }, players: 4 },
      { cfg: { expansions: ['molten-rock'], characterByPlayer: {} }, players: 4 },
      { cfg: { expansions: ['ice-storm'], characterByPlayer: {} }, players: 5 },
      { cfg: { expansions: ['molten-rock'], characterByPlayer: {} }, players: 6 },
      { cfg: { expansions: ['ice-storm', 'molten-rock'], characterByPlayer: {} }, players: 6 },
    ];
    for (const { cfg, players } of configs) {
      for (const seed of [77, 78]) {
        const { state: s, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(cfg, seed, makeSeats(players)), 5000);
        expect(stuck).toBe(false);
        expect(s.phase).toBe('gameOver');
        expect(s.winnerId).toBeTruthy();
      }
    }
  });
});
