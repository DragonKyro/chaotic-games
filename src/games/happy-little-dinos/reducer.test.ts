import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import { HLD_DISASTER_DEFS, HLD_MAIN_DECK_DEFS } from './cards';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState, isEliminatedByDisasters } from './reducer';
import type { HldConfig } from './types';

function makeSeats(n: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    color: '#000',
    isAI: true,
    isLocal: false,
  }));
}

const DEFAULT_CFG: HldConfig = { expansions: [], trackLength: 50 };

describe('Happy Little Dinosaurs — deck & setup', () => {
  it('has 28 Disaster cards and 69 Main Deck cards (53 Point + 16 Instant = 97 total)', () => {
    expect(HLD_DISASTER_DEFS.length).toBe(28);
    const pointCount = HLD_MAIN_DECK_DEFS.filter((d) => d.type === 'point').reduce((s, d) => s + d.count, 0);
    const instCount = HLD_MAIN_DECK_DEFS.filter((d) => d.type === 'instant').reduce((s, d) => s + d.count, 0);
    expect(pointCount).toBe(53);
    expect(instCount).toBe(16);
    expect(pointCount + instCount + HLD_DISASTER_DEFS.length).toBe(97);
  });

  it('deals 5 cards with at least 1 Point card to each player and flips the first Disaster', () => {
    const seats = makeSeats(4);
    const s = createInitialState(DEFAULT_CFG, 42, seats);
    expect(s.currentDisaster).toBeTruthy();
    expect(s.subPhase).toBe('selecting');
    for (const seat of seats) {
      expect(s.hands[seat.id]?.length).toBe(5);
      expect(s.hands[seat.id]?.some((c) => c.type === 'point')).toBe(true);
    }
  });
});

describe('Happy Little Dinosaurs — elimination & mechanics', () => {
  it('evaluates 3 same, 3 different, and Meteor wild elimination rules', () => {
    expect(
      isEliminatedByDisasters([
        { id: 1, name: 'A', category: 'natural', text: '' },
        { id: 2, name: 'B', category: 'natural', text: '' },
      ]),
    ).toBe(false);

    // 3 same
    expect(
      isEliminatedByDisasters([
        { id: 1, name: 'A', category: 'natural', text: '' },
        { id: 2, name: 'B', category: 'natural', text: '' },
        { id: 3, name: 'C', category: 'natural', text: '' },
      ]),
    ).toBe(true);

    // 3 different
    expect(
      isEliminatedByDisasters([
        { id: 1, name: 'A', category: 'natural', text: '' },
        { id: 2, name: 'B', category: 'predator', text: '' },
        { id: 3, name: 'C', category: 'emotional', text: '' },
      ]),
    ).toBe(true);

    // 1 Meteor + 2 other cards = always eliminated
    expect(
      isEliminatedByDisasters([
        { id: 1, name: 'A', category: 'natural', text: '' },
        { id: 2, name: 'B', category: 'natural', text: '' },
        { id: 3, name: 'M', category: 'meteor', text: '' },
      ]),
    ).toBe(true);
  });

  it('plays full AI-vs-AI games across 2, 3, and 4 players to completion', () => {
    for (const playerCount of [2, 3, 4]) {
      for (let seed = 1; seed <= 4; seed++) {
        let s = createInitialState(DEFAULT_CFG, seed * 31, makeSeats(playerCount));
        let steps = 0;
        while (s.phase !== 'gameOver' && steps < 2000) {
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
