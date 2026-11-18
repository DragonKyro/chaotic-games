import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import {
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
} from './cards';
import { chooseAIAction } from './ai';
import { castingShadowsModule } from './module';
import { applyAction, createInitialState } from './reducer';
import type { CsConfig } from './types';

function makeSeats(n: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    color: '#000',
    isAI: true,
    isLocal: false,
  }));
}

const DEFAULT_CFG: CsConfig = { expansions: [], characterByPlayer: {} };

describe('Casting Shadows — deck & setup', () => {
  it('has 4 Characters, 7 Hex Tiles, 52 Main Deck cards, 10 Counterspells, and 10 Companions', () => {
    expect(CS_CHARACTERS.length).toBe(4);
    expect(CS_HEX_DEFS.length).toBe(7);
    const main = CS_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0);
    const cs = CS_COUNTERSPELL_DEFS.reduce((s, d) => s + d.count, 0);
    const comp = CS_COMPANION_DEFS.reduce((s, d) => s + d.count, 0);
    expect(main).toBe(52);
    expect(cs).toBe(10);
    expect(comp).toBe(10);
  });

  it('has complete Ice Storm and Molten Rock expansion decks, characters, and hex tiles', () => {
    expect(CS_ICE_STORM_CHARACTERS.map((c) => c.id)).toEqual(['talon', 'nyx']);
    expect(CS_ICE_STORM_HEX_DEFS.map((h) => h.id)).toEqual(['floating-temple', 'glimmering-woods']);
    expect(CS_ICE_STORM_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0)).toBe(26);
    expect(CS_ICE_STORM_COMPANION_DEFS.reduce((s, d) => s + d.count, 0)).toBe(4);
    expect(CS_ICE_STORM_COUNTERSPELL_DEFS.reduce((s, d) => s + d.count, 0)).toBe(4);

    expect(CS_MOLTEN_ROCK_CHARACTERS.map((c) => c.id)).toEqual(['dread', 'ember']);
    expect(CS_MOLTEN_ROCK_HEX_DEFS.map((h) => h.id)).toEqual(['cobble-cove', 'molten-quarry']);
    expect(CS_MOLTEN_ROCK_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0)).toBe(26);
    expect(CS_MOLTEN_ROCK_COMPANION_DEFS.reduce((s, d) => s + d.count, 0)).toBe(4);
    expect(CS_MOLTEN_ROCK_COUNTERSPELL_DEFS.reduce((s, d) => s + d.count, 0)).toBe(4);

    expect(castingShadowsModule.maxPlayers).toBe(6);
    expect(castingShadowsModule.Thumbnail).toBeTruthy();
    expect(castingShadowsModule.validateConfig({ expansions: [], characterByPlayer: {} }, makeSeats(5)).length).toBeGreaterThan(0);
    expect(castingShadowsModule.validateConfig({ expansions: ['ice-storm'], characterByPlayer: {} }, makeSeats(6))).toEqual([]);
  });

  it('places players on their Home Hexes at 18 HP and deals 5 face-up Hex cards and 3 Companion Portal cards', () => {
    const seats = makeSeats(4);
    const s = createInitialState(DEFAULT_CFG, 42, seats);
    expect(s.companionPortal.length).toBe(3);
    for (const seat of seats) {
      expect(s.boards[seat.id]?.hp).toBe(18);
      expect(s.boards[seat.id]?.form).toBe('light');
    }
    expect(s.hexes['ancient-rune'].faceUpCard).toBeNull();
    expect(s.hexes['dusty-desert'].faceUpCard).toBeNull();
    expect(s.hexes['amber-mountain'].faceUpCard).toBeTruthy();
  });
});

describe('Casting Shadows — mechanics & player decisions', () => {
  it('handles Resource Roll, Travel, Collect, Shadow Form transformation, Companion summon, and Counterspells', () => {
    const seats = makeSeats(2);
    let s = createInitialState(DEFAULT_CFG, 99, seats);

    // Phase 1: Roll 3 Shadow Fragments + 1 Red Orb + 1 Red Gem
    s = applyAction(s, {
      type: 'rollResourceDice',
      playerId: 'p1',
      dice: ['shadowFragment', 'shadowFragment', 'shadowFragment', 'redOrb', 'redGem'],
    });
    expect(s.subPhase).toBe('awaitingAction');
    expect(s.actionPointsRemaining).toBe(4);

    // Phase 3: Absorb 3 Shadow Fragments -> transform into Shadow Form -> awaitingCompanionPick!
    s = applyAction(s, { type: 'transformAndEndTurn', playerId: 'p1', transform: true });
    expect(s.boards.p1?.form).toBe('shadow');
    expect(s.subPhase).toBe('awaitingCompanionPick');

    const compId = s.companionPortal[0]!.id;
    s = applyAction(s, { type: 'pickCompanion', playerId: 'p1', companionId: compId });
    expect(s.boards.p1?.companion?.id).toBe(compId);
    expect(s.turnPlayerId).toBe('p2');
  });

  it('handles Ice Storm Stun and Freeze status effects and Talon & Nyx Shadow Abilities', () => {
    const cfg: CsConfig = {
      expansions: ['ice-storm'],
      characterByPlayer: { p1: 'talon', p2: 'nyx' },
    };
    let s = createInitialState(cfg, 101, makeSeats(2));
    expect(s.boards.p1?.hexId).toBe('floating-temple');
    expect(s.boards.p2?.hexId).toBe('glimmering-woods');

    // Move p1 and p2 to same hex and test Talon Shadow Ability (Stun)
    s.boards.p1!.form = 'shadow';
    s.boards.p1!.shadowEnergy = 4;
    s.boards.p2!.hexId = 'floating-temple';

    s = applyAction(s, {
      type: 'rollResourceDice',
      playerId: 'p1',
      dice: ['blueGem', 'blueGem', 'blueOrb', 'redGem', 'redOrb'],
    });
    // Floating Temple grants +1 Blue Gem at start of turn
    expect(s.bonusPool).toContain('blueGem');

    s = applyAction(s, { type: 'useShadowAbility', playerId: 'p1' });
    expect(s.boards.p2?.stunned).toBe(true);

    // End p1 turn -> p2 starts turn Stunned (-1 AP = 3 AP) and clears stunned
    s = applyAction(s, { type: 'transformAndEndTurn', playerId: 'p1' });
    expect(s.turnPlayerId).toBe('p2');
    s = applyAction(s, {
      type: 'rollResourceDice',
      playerId: 'p2',
      dice: ['blueGem', 'blueGem', 'blueOrb', 'redGem', 'redOrb'],
    });
    expect(s.actionPointsRemaining).toBe(3);
    expect(s.boards.p2?.stunned).toBe(false);

    // Nyx uses Shadow Ability to Freeze p1 and deal 1 DMG
    s.boards.p2!.form = 'shadow';
    s.boards.p2!.shadowEnergy = 3;
    s = applyAction(s, { type: 'useShadowAbility', playerId: 'p2', targetPlayerId: 'p1' });
    expect(s.boards.p1?.frozen).toBe(true);
    expect(s.boards.p1?.hp).toBe(17);

    // End p2 turn -> p1 is Frozen and cannot Travel until unfreezing
    s = applyAction(s, { type: 'transformAndEndTurn', playerId: 'p2' });
    s = applyAction(s, {
      type: 'rollResourceDice',
      playerId: 'p1',
      dice: ['blueGem', 'blueGem', 'blueOrb', 'redGem', 'redOrb'],
    });
    expect(() =>
      applyAction(s, { type: 'travel', playerId: 'p1', toHexId: 'amber-mountain' }),
    ).toThrow(/Frozen/);

    // Spend 1 AP to unfreeze, then Travel succeeds
    s = applyAction(s, { type: 'unfreeze', playerId: 'p1' });
    expect(s.boards.p1?.frozen).toBe(false);
    expect(s.actionPointsRemaining).toBe(3);
    s = applyAction(s, { type: 'travel', playerId: 'p1', toHexId: 'amber-mountain' });
    expect(s.boards.p1?.hexId).toBe('amber-mountain');
  });

  it('handles Molten Rock Fortify and Burn status effects and Dread & Pyra Shadow Abilities', () => {
    const cfg: CsConfig = {
      expansions: ['molten-rock'],
      characterByPlayer: { p1: 'dread', p2: 'ember' },
    };
    let s = createInitialState(cfg, 202, makeSeats(2));
    expect(s.boards.p1?.hexId).toBe('cobble-cove');
    expect(s.boards.p2?.hexId).toBe('molten-quarry');

    // Put p2 on cobble-cove with p1; Dread uses Shadow Ability (+2 Fortify & 1 DMG to p2)
    s.boards.p1!.form = 'shadow';
    s.boards.p1!.shadowEnergy = 2;
    s.boards.p2!.hexId = 'cobble-cove';

    s = applyAction(s, {
      type: 'rollResourceDice',
      playerId: 'p1',
      dice: ['redGem', 'redGem', 'redOrb', 'blueGem', 'blueOrb'],
    });
    expect(s.bonusPool).toContain('redGem');
    s = applyAction(s, { type: 'useShadowAbility', playerId: 'p1', targetPlayerId: 'p2' });
    expect(s.boards.p1?.fortified).toBe(2);
    expect(s.boards.p2?.hp).toBe(17);

    // End p1 turn -> p2 (Pyra/ember) uses Shadow Ability (1 DMG + Burn on p1)
    s = applyAction(s, { type: 'transformAndEndTurn', playerId: 'p1' });
    s = applyAction(s, {
      type: 'rollResourceDice',
      playerId: 'p2',
      dice: ['redGem', 'redGem', 'redOrb', 'blueGem', 'blueOrb'],
    });
    s.boards.p2!.form = 'shadow';
    s.boards.p2!.shadowEnergy = 3;
    s = applyAction(s, { type: 'useShadowAbility', playerId: 'p2', targetPlayerId: 'p1' });

    // p1's +2 Fortify shield absorbs the 1 DMG and is consumed, while p1 is now Burning!
    expect(s.boards.p1?.hp).toBe(18);
    expect(s.boards.p1?.fortified).toBe(0);
    expect(s.boards.p1?.burning).toBe(true);

    // End p2 turn -> p1 takes 1 Burn DMG at the end of p1's turn if not extinguished
    s = applyAction(s, { type: 'transformAndEndTurn', playerId: 'p2' });
    s = applyAction(s, {
      type: 'rollResourceDice',
      playerId: 'p1',
      dice: ['redGem', 'redGem', 'redOrb', 'blueGem', 'blueOrb'],
    });
    s = applyAction(s, { type: 'transformAndEndTurn', playerId: 'p1' });
    expect(s.boards.p1?.hp).toBe(17);
    expect(s.boards.p1?.burning).toBe(false);
  });

  it('handles expansion Attack Spells, Counterspells, Companions, extinguishing Burn, and Crystal Crypt vs Fortify', () => {
    const cfg: CsConfig = {
      expansions: ['ice-storm', 'molten-rock'],
      characterByPlayer: { p1: 'talon', p2: 'dread' },
    };
    let s = createInitialState(cfg, 303, makeSeats(2));
    s.boards.p1!.hexId = 'amber-mountain';
    s.boards.p2!.hexId = 'amber-mountain';

    // Give p1 Glacial Strike (Freeze) and Ravaging Draco companion (Burn on Attack Spells)
    s.boards.p1!.spellBook = [
      {
        id: 901,
        kind: 'glacial-strike',
        name: 'Glacial Strike',
        type: 'attackSpell',
        level: 2,
        collectionCost: { blueGem: 2, blueOrb: 1 },
        range: 'sameOrAdjacent',
        inflictFreeze: true,
        castTiers: [{ cost: { blueGem: 2 }, damage: 4, inflictFreeze: true, label: '2 Blue Gems -> 4 DMG & Freeze' }],
        text: 'Deal 4 DMG and Freeze.',
      },
    ];
    s.boards.p1!.companion = {
      id: 902,
      kind: 'ravaging-draco',
      name: 'Ravaging Draco',
      type: 'companion',
      level: 1,
      collectionCost: {},
      text: 'Inflict Burn on Attack Spells.',
    };

    // Give p2 Magma Shield Counterspell (-2 DMG & Burn attacker) and +1 Fortify
    s.boards.p2!.fortified = 1;
    s.boards.p2!.spellBook = [
      {
        id: 903,
        kind: 'magma-shield',
        name: 'Magma Shield',
        type: 'counterspell',
        level: 1,
        collectionCost: { anyGem: 1, anyOrb: 1 },
        text: 'Reduce DMG by 2 and Burn attacker.',
      },
    ];

    s = applyAction(s, {
      type: 'rollResourceDice',
      playerId: 'p1',
      dice: ['blueGem', 'blueGem', 'redGem', 'redOrb', 'blueOrb'],
    });
    s = applyAction(s, {
      type: 'castSpell',
      playerId: 'p1',
      spellId: 901,
      tierIndex: 0,
      targetPlayerId: 'p2',
    });
    // 4 DMG reduced by 1 Fortify -> 3 DMG pending -> awaitingCounterspell for p2
    expect(s.subPhase).toBe('awaitingCounterspell');
    expect(s.boards.p2?.fortified).toBe(0);
    expect(s.pendingAttack?.damage).toBe(3);

    // p2 reveals Magma Shield (-2 DMG -> 1 DMG taken, p1 is Burned)
    s = applyAction(s, {
      type: 'respondCounterspell',
      playerId: 'p2',
      counterspellId: 903,
    });
    expect(s.boards.p2?.hp).toBe(17);
    expect(s.boards.p2?.frozen).toBe(true);
    expect(s.boards.p2?.burning).toBe(true);
    expect(s.boards.p1?.burning).toBe(true);

    // p1 spends 1 AP to Protect/extinguish Burn during Phase 2
    s = applyAction(s, { type: 'protect', playerId: 'p1', clearStatus: 'burning' });
    expect(s.boards.p1?.burning).toBe(false);
  });

  it('plays full AI-vs-AI games across 2, 3, and 4 players to completion', () => {
    for (const playerCount of [2, 3, 4]) {
      for (let seed = 1; seed <= 3; seed++) {
        let s = createInitialState(DEFAULT_CFG, seed * 37, makeSeats(playerCount));
        let steps = 0;
        while (s.phase !== 'gameOver' && steps < 2500) {
          const active = s.activePlayerId;
          expect(active).toBeTruthy();
          const action = chooseAIAction(s, active!);
          expect(action).toBeTruthy();
          s = applyAction(s, action!);
          steps++;
        }
        expect(s.phase).toBe('gameOver');
        expect(s.winnerId).toBeTruthy();
      }
    }
  });

  it('plays full AI-vs-AI games with Ice Storm, Molten Rock, and 6-player combined expansions', () => {
    const configs: { cfg: CsConfig; players: number }[] = [
      { cfg: { expansions: ['ice-storm'], characterByPlayer: {} }, players: 4 },
      { cfg: { expansions: ['molten-rock'], characterByPlayer: {} }, players: 4 },
      { cfg: { expansions: ['ice-storm', 'molten-rock'], characterByPlayer: {} }, players: 6 },
    ];
    for (const { cfg, players } of configs) {
      let s = createInitialState(cfg, 77, makeSeats(players));
      let steps = 0;
      while (s.phase !== 'gameOver' && steps < 3500) {
        const active = s.activePlayerId;
        expect(active).toBeTruthy();
        const action = chooseAIAction(s, active!);
        expect(action).toBeTruthy();
        s = applyAction(s, action!);
        steps++;
      }
      expect(s.phase).toBe('gameOver');
      expect(s.winnerId).toBeTruthy();
    }
  });
});
