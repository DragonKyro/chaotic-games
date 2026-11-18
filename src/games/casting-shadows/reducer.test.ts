import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import {
  CS_CHARACTERS,
  CS_COMPANION_DEFS,
  CS_COUNTERSPELL_DEFS,
  CS_HEX_DEFS,
  CS_MAIN_DECK_DEFS,
} from './cards';
import { chooseAIAction } from './ai';
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
});
