import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState, livePlayerIds } from './reducer';
import type { EkBaseCardKind, EkCard, EkConfig, EkState } from './types';

function seats(n: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    color: '#fff',
    isAI: true,
    isLocal: true,
  }));
}

const CONFIG: EkConfig = { expansions: [], handSize: 4, combosCatsOnly: false };

let nextTestId = 50_000;
function card(kind: EkBaseCardKind): EkCard {
  return { id: nextTestId++, kind };
}

function rig(overrides: Partial<EkState>, n = 3): EkState {
  const base = createInitialState(CONFIG, 4242, seats(n));
  return { ...base, ...overrides };
}

// ============================================================================
// Full games — the important test. Every seat is AI, so any illegal action,
// stall, or unhandled subphase shows up as a thrown error or a hang.
// ============================================================================

interface PlayoutResult {
  state: EkState;
  ticks: number;
}

function playToCompletion(seed: number, playerCount: number, maxTicks = 4000): PlayoutResult {
  let state = createInitialState(CONFIG, seed, seats(playerCount));
  let ticks = 0;

  while (state.phase !== 'gameOver') {
    ticks += 1;
    if (ticks > maxTicks) {
      throw new Error(
        `game did not finish in ${maxTicks} ticks (subPhase=${state.subPhase}, active=${state.activePlayerId}, deck=${state.deck.length})`,
      );
    }
    const active = state.activePlayerId;
    if (!active) throw new Error(`no active player during ${state.subPhase}`);

    const action = chooseAIAction(state, active);
    if (!action) throw new Error(`AI returned null during ${state.subPhase} for ${active}`);
    state = applyAction(state, action);
  }
  return { state, ticks };
}

describe('AI vs AI playouts', () => {
  const seedList = [1, 2, 3, 7, 11, 42, 99, 123, 555, 1001, 31337, 65535];

  for (const playerCount of [2, 3, 4, 5]) {
    it(`completes ${playerCount}-player games across many seeds`, () => {
      for (const seed of seedList) {
        const { state, ticks } = playToCompletion(seed, playerCount);
        expect(state.phase).toBe('gameOver');
        expect(ticks).toBeGreaterThan(0);
        // Exactly one survivor.
        expect(livePlayerIds(state)).toHaveLength(1);
        expect(state.eliminated).toHaveLength(playerCount - 1);
        expect(state.finalScores).not.toBeNull();
      }
    });
  }

  it('conserves cards through a whole game', () => {
    const { state } = playToCompletion(2024, 4);
    const inHands = Object.values(state.hands).reduce((sum, h) => sum + h.length, 0);
    const total = state.deck.length + state.discard.length + inHands + state.limbo.length;
    // 56-card box minus the kittens that stayed in the box (4 - (players - 1)).
    expect(total).toBe(56 - (4 - 3));
  });

  it('never leaves a pending play unresolved at game over', () => {
    for (const seed of [5, 50, 500]) {
      const { state } = playToCompletion(seed, 3);
      expect(state.pending).toBeNull();
      expect(state.pendingKitten).toBeNull();
      expect(state.pendingFavor).toBeNull();
      expect(state.limbo).toEqual([]);
    }
  });

  it('produces the same game twice from the same seed', () => {
    const a = playToCompletion(777, 4);
    const b = playToCompletion(777, 4);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(a.ticks).toBe(b.ticks);
  });
});

// ============================================================================
// Fair play — the AI must not read the deck beyond what it legitimately knows
// ============================================================================

describe('the AI does not cheat', () => {
  it('walks into a kitten it has no way of knowing about', () => {
    // Top card is lethal, the AI holds a Skip, but has zero knowledge and the
    // base rate is low. A cheating AI would Skip; an honest one draws.
    const s = rig({
      deck: [card('explodingKitten'), ...Array.from({ length: 30 }, () => card('tacoCat'))],
      hands: { p0: [card('skip')], p1: [], p2: [] },
      knownTopCount: { p0: 0, p1: 0, p2: 0 },
    });
    const action = chooseAIAction(s, 'p0');
    expect(action).toEqual({ type: 'drawCard', playerId: 'p0' });
  });

  it('dodges a kitten it legitimately knows about', () => {
    const s = rig({
      deck: [card('explodingKitten'), ...Array.from({ length: 30 }, () => card('tacoCat'))],
      hands: { p0: [card('skip')], p1: [], p2: [] },
      knownTopCount: { p0: 1, p1: 0, p2: 0 },
    });
    const action = chooseAIAction(s, 'p0');
    expect(action?.type).toBe('playCards');
  });
});

// ============================================================================
// Specific tactical decisions
// ============================================================================

describe('turn decisions', () => {
  it('prefers Attack over Skip on a known kitten — it passes the problem along', () => {
    const s = rig({
      deck: [card('explodingKitten'), card('tacoCat')],
      hands: { p0: [card('skip'), card('attack')], p1: [], p2: [] },
      knownTopCount: { p0: 1, p1: 0, p2: 0 },
    });
    const action = chooseAIAction(s, 'p0') as { type: string; cardIds: number[] };
    const played = s.hands.p0!.find((c) => c.id === action.cardIds[0]);
    expect(played?.kind).toBe('attack');
  });

  it('shuffles a known kitten away when it cannot dodge', () => {
    const s = rig({
      deck: [card('explodingKitten'), card('tacoCat')],
      hands: { p0: [card('shuffle')], p1: [], p2: [] },
      knownTopCount: { p0: 1, p1: 0, p2: 0 },
    });
    const action = chooseAIAction(s, 'p0') as { cardIds: number[] };
    expect(s.hands.p0!.find((c) => c.id === action.cardIds[0])?.kind).toBe('shuffle');
  });

  it('draws into a known kitten when holding a Defuse, to re-hide it', () => {
    const s = rig({
      deck: [card('explodingKitten'), card('tacoCat')],
      hands: { p0: [card('defuse')], p1: [], p2: [] },
      knownTopCount: { p0: 1, p1: 0, p2: 0 },
    });
    expect(chooseAIAction(s, 'p0')).toEqual({ type: 'drawCard', playerId: 'p0' });
  });

  it('buys information when the deck looks dangerous', () => {
    const s = rig({
      // 2 kittens seeded among 4 cards = 50% — well past the scary line.
      deck: Array.from({ length: 4 }, () => card('tacoCat')),
      hands: { p0: [card('seeTheFuture'), card('skip')], p1: [], p2: [] },
      knownTopCount: { p0: 0, p1: 0, p2: 0 },
    });
    const action = chooseAIAction(s, 'p0') as { cardIds: number[] };
    expect(s.hands.p0!.find((c) => c.id === action.cardIds[0])?.kind).toBe('seeTheFuture');
  });

  it('demands a Defuse with a three-of-a-kind when in danger', () => {
    const s = rig({
      deck: Array.from({ length: 3 }, () => card('tacoCat')),
      hands: {
        p0: [card('beardCat'), card('beardCat'), card('beardCat')],
        p1: [card('defuse'), card('skip')],
        p2: [],
      },
      knownTopCount: { p0: 0, p1: 0, p2: 0 },
    });
    const action = chooseAIAction(s, 'p0') as { type: string; demandKind?: string; targetPlayerId?: string };
    expect(action.type).toBe('playCards');
    expect(action.demandKind).toBe('defuse');
    expect(action.targetPlayerId).toBe('p1');
  });

  it('targets the player holding the most cards', () => {
    const s = rig({
      deck: Array.from({ length: 3 }, () => card('tacoCat')),
      hands: {
        p0: [card('beardCat'), card('beardCat')],
        p1: [card('skip')],
        p2: [card('skip'), card('skip'), card('skip')],
      },
      knownTopCount: { p0: 0, p1: 0, p2: 0 },
    });
    const action = chooseAIAction(s, 'p0') as { targetPlayerId?: string };
    expect(action.targetPlayerId).toBe('p2');
  });
});

describe('forced decisions', () => {
  it('always defuses', () => {
    const s = rig({
      subPhase: 'awaitingDefuse',
      pendingKitten: card('explodingKitten'),
      hands: { p0: [card('defuse'), card('skip')], p1: [], p2: [] },
    });
    const action = chooseAIAction(s, 'p0') as { type: string; cardId: number };
    expect(action.type).toBe('playDefuse');
    expect(s.hands.p0!.find((c) => c.id === action.cardId)?.kind).toBe('defuse');
  });

  it('hides the kitten on top when the next player draws next', () => {
    const s = rig({
      subPhase: 'awaitingKittenPlace',
      pendingKitten: card('explodingKitten'),
      deck: Array.from({ length: 10 }, () => card('tacoCat')),
      turnsRemaining: 1,
    });
    expect(chooseAIAction(s, 'p0')).toEqual({ type: 'placeKitten', playerId: 'p0', index: 0 });
  });

  it('buries the kitten when it still owes turns and would draw it itself', () => {
    const s = rig({
      subPhase: 'awaitingKittenPlace',
      pendingKitten: card('explodingKitten'),
      deck: Array.from({ length: 10 }, () => card('tacoCat')),
      turnsRemaining: 3,
    });
    const action = chooseAIAction(s, 'p0') as { index: number };
    expect(action.index).toBeGreaterThanOrEqual(3);
  });

  it('gives away its least valuable card to a Favor', () => {
    const s = rig({
      subPhase: 'awaitingFavorGive',
      pendingFavor: { fromPlayerId: 'p1', toPlayerId: 'p0' },
      activePlayerId: 'p1',
      hands: { p0: [], p1: [card('defuse'), card('tacoCat'), card('nope')], p2: [] },
    });
    const action = chooseAIAction(s, 'p1') as { type: string; cardId: number };
    expect(action.type).toBe('giveCard');
    expect(s.hands.p1!.find((c) => c.id === action.cardId)?.kind).toBe('tacoCat');
  });

  it('takes the best card out of the discard pile', () => {
    const s = rig({
      subPhase: 'awaitingDiscardPick',
      discard: [card('tacoCat'), card('defuse'), card('shuffle')],
      hands: { p0: [], p1: [], p2: [] },
    });
    const action = chooseAIAction(s, 'p0') as { type: string; cardId: number };
    expect(action.type).toBe('takeFromDiscard');
    expect(s.discard.find((c) => c.id === action.cardId)?.kind).toBe('defuse');
  });

  it('acknowledges a peek', () => {
    const s = rig({
      subPhase: 'awaitingFutureView',
      peek: { playerId: 'p0', cards: [card('tacoCat')] },
    });
    expect(chooseAIAction(s, 'p0')).toEqual({ type: 'ackPeek', playerId: 'p0' });
  });
});

describe('nope decisions', () => {
  it('nopes a three-of-a-kind aimed at it', () => {
    const s = rig({
      subPhase: 'awaitingNope',
      activePlayerId: 'p1',
      hands: { p0: [], p1: [card('nope'), card('defuse')], p2: [] },
      pending: {
        byPlayerId: 'p0',
        cards: [card('beardCat'), card('beardCat'), card('beardCat')],
        combo: 'triple',
        targetPlayerId: 'p1',
        demandKind: 'defuse',
        nopeCards: [],
        responderQueue: ['p1'],
      },
    });
    const action = chooseAIAction(s, 'p1') as { type: string };
    expect(action.type).toBe('playNope');
  });

  it('does not waste its only Nope on a Shuffle that does not affect it', () => {
    const s = rig({
      subPhase: 'awaitingNope',
      activePlayerId: 'p1',
      deck: Array.from({ length: 30 }, () => card('tacoCat')),
      hands: { p0: [], p1: [card('nope')], p2: [] },
      knownTopCount: { p0: 0, p1: 0, p2: 0 },
      pending: {
        byPlayerId: 'p0',
        cards: [card('shuffle')],
        combo: null,
        targetPlayerId: null,
        demandKind: null,
        nopeCards: [],
        responderQueue: ['p1'],
      },
    });
    expect(chooseAIAction(s, 'p1')).toEqual({ type: 'declineNope', playerId: 'p1' });
  });

  it('nopes an Attack that would land on it while it is defenceless', () => {
    const s = rig({
      subPhase: 'awaitingNope',
      activePlayerId: 'p1',
      // Dangerous deck, and p1 holds no Defuse.
      deck: Array.from({ length: 4 }, () => card('tacoCat')),
      hands: { p0: [], p1: [card('nope')], p2: [] },
      knownTopCount: { p0: 0, p1: 0, p2: 0 },
      pending: {
        byPlayerId: 'p0',
        cards: [card('attack')],
        combo: null,
        targetPlayerId: null,
        demandKind: null,
        nopeCards: [],
        responderQueue: ['p1'],
      },
    });
    const action = chooseAIAction(s, 'p1') as { type: string };
    expect(action.type).toBe('playNope');
  });

  it('stops a rival from dodging a kitten it knows is on top', () => {
    const s = rig({
      subPhase: 'awaitingNope',
      activePlayerId: 'p1',
      deck: [card('explodingKitten'), ...Array.from({ length: 20 }, () => card('tacoCat'))],
      hands: { p0: [], p1: [card('nope')], p2: [] },
      knownTopCount: { p0: 0, p1: 1, p2: 0 },
      pending: {
        byPlayerId: 'p0',
        cards: [card('skip')],
        combo: null,
        targetPlayerId: null,
        demandKind: null,
        nopeCards: [],
        responderQueue: ['p1'],
      },
    });
    const action = chooseAIAction(s, 'p1') as { type: string };
    expect(action.type).toBe('playNope');
  });
});

describe('AI vs AI playouts with expansions', () => {
  const expansionSets: EkConfig['expansions'][] = [
    ['imploding-kittens'],
    ['streaking-kittens'],
    ['barking-kittens'],
    ['zombie-kittens'],
    ['party-pack'],
    ['recipes-for-disaster'],
    ['imploding-kittens', 'streaking-kittens', 'barking-kittens', 'zombie-kittens'],
  ];

  for (const expansions of expansionSets) {
    it(`completes games with expansions: ${expansions.join(', ')}`, () => {
      const playerCount = expansions.includes('party-pack') ? 7 : 4;
      for (const seed of [1, 7, 42, 99]) {
        let state = createInitialState({ ...CONFIG, expansions }, seed, seats(playerCount));
        let ticks = 0;
        while (state.phase !== 'gameOver') {
          ticks += 1;
          if (ticks > 6000) {
            throw new Error(`expansion game did not finish in 6000 ticks (subPhase=${state.subPhase})`);
          }
          const active = state.activePlayerId!;
          const action = chooseAIAction(state, active);
          if (!action) throw new Error(`AI returned null during ${state.subPhase}`);
          state = applyAction(state, action);
        }
        expect(state.phase).toBe('gameOver');
        expect(livePlayerIds(state)).toHaveLength(1);
      }
    });
  }
});
