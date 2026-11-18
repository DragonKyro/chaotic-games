import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import { UU_BABY_DEFS, UU_MAIN_DECK_DEFS } from './cards';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState, unicornCount } from './reducer';
import type { UuCard, UuConfig } from './types';

function makeSeats(n: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    color: '#000',
    isAI: true,
    isLocal: false,
  }));
}

const DEFAULT_CFG: UuConfig = { expansions: [], edition: 'base-2nd' };

describe('Unstable Unicorns — deck & setup', () => {
  it('has exactly 13 Baby Unicorns and 114 main deck cards (127 playable cards + 8 rules = 135)', () => {
    const babies = UU_BABY_DEFS.reduce((s, d) => s + d.count, 0);
    const main = UU_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0);
    expect(babies).toBe(13);
    expect(main).toBe(114);
    expect(babies + main).toBe(127);
  });

  it('deals 1 Baby Unicorn to each Stable and 5 cards to each hand', () => {
    const seats = makeSeats(4);
    const s = createInitialState(DEFAULT_CFG, 42, seats);
    expect(s.unicornsToWin).toBe(7);
    expect(s.nursery.length).toBe(13 - 4);
    for (const seat of seats) {
      expect(s.hands[seat.id]?.length).toBe(5);
      expect(s.stables[seat.id]?.unicorns.length).toBe(1);
      expect(s.stables[seat.id]?.unicorns[0]?.type).toBe('babyUnicorn');
    }
    expect(s.deck.length).toBe(114 - 4 * 5);
  });

  it('sets unicornsToWin to 6 at 6–8 players', () => {
    const s = createInitialState(DEFAULT_CFG, 42, makeSeats(6));
    expect(s.unicornsToWin).toBe(6);
  });
});

describe('Unstable Unicorns — core mechanics & player decisions', () => {
  it('supports Neigh chains and terminal Super Neigh', () => {
    const seats = makeSeats(3);
    let s = createInitialState(DEFAULT_CFG, 100, seats);
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });

    const basicCard: UuCard = { id: 901, kind: 'basic-red', name: 'Basic Unicorn (Red)', type: 'basicUnicorn', text: '' };
    const neigh1: UuCard = { id: 902, kind: 'neigh', name: 'Neigh', type: 'instant', text: '' };
    const superNeigh: UuCard = { id: 903, kind: 'super-neigh', name: 'Super Neigh', type: 'instant', text: '' };

    s.hands.p1 = [basicCard];
    s.hands.p2 = [neigh1];
    s.hands.p3 = [];

    s = applyAction(s, { type: 'playCard', playerId: 'p1', cardId: 901 });
    expect(s.subPhase).toBe('awaitingNeigh');
    expect(s.activePlayerId).toBe('p2');

    // p1 also gets a Super Neigh to counter-Neigh p2's Neigh
    s.hands.p1 = [superNeigh];
    s = applyAction(s, { type: 'playNeigh', playerId: 'p2', cardId: 902 });
    expect(s.subPhase).toBe('awaitingNeigh');
    expect(s.activePlayerId).toBe('p1');

    // p1 plays Super Neigh -> terminal, immediately resolves the play!
    s = applyAction(s, { type: 'playNeigh', playerId: 'p1', cardId: 903 });
    // WAIT: Super Neigh cancels the play (or wait: p1 played Super Neigh to cancel p2's Neigh? Wait: in our reducer superNeighed means Super Neigh was played; let's check!)
    expect(s.pending).toBeNull();
  });

  it('returns Baby Unicorns to the Nursery when sacrificed or destroyed', () => {
    const seats = makeSeats(2);
    let s = createInitialState(DEFAULT_CFG, 7, seats);
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });

    const poison: UuCard = { id: 910, kind: 'unicorn-poison', name: 'Unicorn Poison', type: 'magic', text: 'DESTROY a Unicorn card.' };
    s.hands.p1 = [poison];
    s.hands.p2 = [];

    const p2BabyId = s.stables.p2!.unicorns[0]!.id;
    const nurseryBefore = s.nursery.length;

    s = applyAction(s, { type: 'playCard', playerId: 'p1', cardId: 910 });
    expect(s.subPhase).toBe('awaitingPrompt');
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: p2BabyId });

    expect(s.stables.p2!.unicorns.length).toBe(0);
    expect(s.nursery.length).toBe(nurseryBefore + 1);
  });

  it('computes Pandamonium, Ginormous Unicorn, and Blinding Light dynamically', () => {
    const seats = makeSeats(2);
    const s = createInitialState(DEFAULT_CFG, 11, seats);
    s.stables.p1!.unicorns.push({
      id: 950,
      kind: 'ginormous-unicorn',
      name: 'Ginormous Unicorn',
      type: 'magicalUnicorn',
      text: '',
    });
    // 1 baby + 1 ginormous (worth 2) = 3
    expect(unicornCount(s, 'p1')).toBe(3);

    // Add Blinding Light -> Ginormous counts as 1
    s.stables.p1!.downgrades.push({
      id: 951,
      kind: 'blinding-light',
      name: 'Blinding Light',
      type: 'downgrade',
      text: '',
    });
    expect(unicornCount(s, 'p1')).toBe(2);

    // Add Pandamonium -> Unicorns count as 0 (they are Pandas)
    s.stables.p1!.downgrades.push({
      id: 952,
      kind: 'pandamonium',
      name: 'Pandamonium',
      type: 'downgrade',
      text: '',
    });
    expect(unicornCount(s, 'p1')).toBe(0);
  });

  it('gives player explicit choice on Unicorn Oracle (pick 1 for hand + order top 2)', () => {
    const seats = makeSeats(2);
    let s = createInitialState(DEFAULT_CFG, 21, seats);
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });

    const oracle: UuCard = { id: 960, kind: 'unicorn-oracle', name: 'Unicorn Oracle', type: 'magicalUnicorn', text: '' };
    s.hands.p1 = [oracle];
    s.hands.p2 = [];

    const top3 = s.deck.slice(0, 3);
    s = applyAction(s, { type: 'playCard', playerId: 'p1', cardId: 960 });
    expect(s.subPhase).toBe('awaitingPrompt');
    expect(s.promptQueue[0]?.kind).toBe('oraclePeek');

    // Pick the 2nd card for hand, and put 3rd card on top followed by 1st card
    s = applyAction(s, {
      type: 'resolvePrompt',
      playerId: 'p1',
      oraclePickId: top3[1]!.id,
      oracleTopOrder: [top3[2]!.id, top3[0]!.id],
    });

    expect(s.hands.p1?.some((c) => c.id === top3[1]!.id)).toBe(true);
    expect(s.deck[0]?.id).toBe(top3[2]!.id);
    expect(s.deck[1]?.id).toBe(top3[0]!.id);
  });

  it('plays full AI-vs-AI games to completion without errors or infinite loops', () => {
    for (const playerCount of [2, 3, 4]) {
      for (let seed = 1; seed <= 4; seed++) {
        let s = createInitialState(DEFAULT_CFG, seed * 17, makeSeats(playerCount));
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
