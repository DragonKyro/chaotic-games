import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import { DM_AGE_DEFS, DM_CATASTROPHE_DEFS } from './cards';
import { chooseAIAction } from './ai';
import {
  applyAction,
  canPlayTrait,
  computePlayerScore,
  createInitialState,
  effectiveGenePool,
} from './reducer';
import { DM_EXPANSIONS } from './types';
import type { DmConfig, DmTraitCard } from './types';

function makeSeats(n: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    color: '#000',
    isAI: true,
    isLocal: false,
  }));
}

const DEFAULT_CFG: DmConfig = { expansions: [] };

describe('Doomlings — deck & setup', () => {
  it('has 25 Ages, 15 Catastrophes, 7 verified expansions, and builds a 13-card Age Deck (Birth of Life + 3 Eras of 4)', () => {
    expect(DM_AGE_DEFS.length).toBe(25);
    expect(DM_CATASTROPHE_DEFS.length).toBe(15);
    expect(DM_EXPANSIONS.length).toBe(7);

    const seats = makeSeats(4);
    const s = createInitialState(DEFAULT_CFG, 42, seats);
    expect(s.currentAge.kind).toBe('birthOfLife');
    expect(s.ageDeck.length).toBe(12);
    expect(s.ageDeck.filter((a) => a.kind === 'catastrophe').length).toBe(3);
    for (const seat of seats) {
      expect(s.hands[seat.id]?.length).toBe(5);
      expect(effectiveGenePool(s, seat.id)).toBe(5);
    }
  });
});

describe('Doomlings — mechanics & scoring', () => {
  it('enforces the 2-Dominant limit, dynamic Gene Pool adjustments, and Drop of Life scoring', () => {
    const seats = makeSeats(2);
    const s = createInitialState(DEFAULT_CFG, 15, seats);

    const dom1: DmTraitCard = {
      id: 901,
      kind: 'camouflage',
      name: 'Camouflage',
      color: 'purple',
      points: 2,
      dominant: true,
      genePoolDelta: 1,
      dropOfLifeTag: 'perHandCard',
      dropOfLifeMultiplier: 1,
      text: '',
    };
    const dom2: DmTraitCard = {
      id: 902,
      kind: 'ruggedized',
      name: 'Ruggedized',
      color: 'colorless',
      points: 4,
      dominant: true,
      genePoolDelta: 1,
      text: '',
    };
    const dom3: DmTraitCard = {
      id: 903,
      kind: 'sentience',
      name: 'Sentience',
      color: 'colorless',
      points: 2,
      dominant: true,
      genePoolDelta: 0,
      text: '',
    };

    s.tableaus.p1 = [dom1, dom2];
    expect(effectiveGenePool(s, 'p1')).toBe(7);
    expect(canPlayTrait(s, 'p1', dom3)).toBe(false);

    // Score check: face (2 + 4 = 6) + Camouflage (+1 per hand card = 5) = 11
    const score = computePlayerScore(s, 'p1');
    expect(score.faceValue).toBe(6);
    expect(score.dropOfLifeBonus).toBe(5);
    expect(score.total).toBe(11);
  });

  it('plays full AI-vs-AI games across 2, 3, and 4 players through all 3 Catastrophes to World\'s End', () => {
    for (const playerCount of [2, 3, 4]) {
      for (let seed = 1; seed <= 4; seed++) {
        let s = createInitialState(DEFAULT_CFG, seed * 43, makeSeats(playerCount));
        let steps = 0;
        while (s.phase !== 'gameOver' && steps < 1500) {
          const active = s.activePlayerId;
          expect(active).toBeTruthy();
          const action = chooseAIAction(s, active!);
          expect(action).toBeTruthy();
          s = applyAction(s, action!);
          steps++;
        }
        expect(s.phase).toBe('gameOver');
        expect(s.catastrophesSeen).toBe(3);
        expect(s.winnerId).toBeTruthy();
        expect(s.finalScores).toBeTruthy();
      }
    }
  });
});
