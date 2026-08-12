import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import { BASE_DECK_COUNTS, TOTAL_BASE_CARDS, dealSetup, detectCombo } from './cards';
import {
  applyAction,
  availableCombos,
  createInitialState,
  drawDanger,
  kittensInDeck,
} from './reducer';
import type { EkBaseCardKind, EkCard, EkConfig, EkState } from './types';

// ============================================================================
// Fixtures
// ============================================================================

function seats(n: number): Seat[] {
  const colors = ['#e64a4a', '#3a6ec9', '#f37025', '#8a47c4', '#1abc9c'];
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `P${i}`,
    color: colors[i] ?? '#fff',
    isAI: false,
    isLocal: true,
  }));
}

const CONFIG: EkConfig = { expansions: [], handSize: 4, combosCatsOnly: false };

function newGame(n = 3, config: Partial<EkConfig> = {}): EkState {
  return createInitialState({ ...CONFIG, ...config }, 12345, seats(n));
}

let nextTestId = 10_000;
function card(kind: EkBaseCardKind): EkCard {
  return { id: nextTestId++, kind };
}

/** Hand-build a state so a specific rule can be tested in isolation. */
function rig(overrides: Partial<EkState>, n = 3): EkState {
  const base = newGame(n);
  return { ...base, ...overrides };
}

// ============================================================================
// Deck composition
// ============================================================================

describe('deck composition', () => {
  it('is 56 cards', () => {
    expect(TOTAL_BASE_CARDS).toBe(56);
  });

  it('splits into 4 kittens, 6 defuses, 26 action cards and 20 cats', () => {
    const counts = BASE_DECK_COUNTS;
    expect(counts.explodingKitten).toBe(4);
    expect(counts.defuse).toBe(6);

    const action = counts.nope + counts.attack + counts.skip
      + counts.favor + counts.shuffle + counts.seeTheFuture;
    expect(action).toBe(26);

    const cats = counts.tacoCat + counts.rainbowRalphingCat + counts.cattermelon
      + counts.hairyPotatoCat + counts.beardCat;
    expect(cats).toBe(20);

    expect(counts.explodingKitten + counts.defuse + action + cats).toBe(56);
  });
});

// ============================================================================
// Setup
// ============================================================================

describe('setup', () => {
  it('gives every player handSize cards plus exactly one Defuse', () => {
    for (const n of [2, 3, 4, 5]) {
      const s = newGame(n);
      for (const seat of s.seats) {
        const hand = s.hands[seat.id]!;
        expect(hand).toHaveLength(CONFIG.handSize + 1);
        expect(hand.filter((c) => c.kind === 'defuse')).toHaveLength(1);
      }
    }
  });

  it('puts exactly playerCount - 1 kittens in the deck', () => {
    for (const n of [2, 3, 4, 5]) {
      const s = newGame(n);
      const inDeck = s.deck.filter((c) => c.kind === 'explodingKitten').length;
      expect(inDeck).toBe(n - 1);
    }
  });

  it('never deals a kitten into an opening hand', () => {
    for (const n of [2, 3, 4, 5]) {
      const s = newGame(n);
      for (const seat of s.seats) {
        expect(s.hands[seat.id]!.some((c) => c.kind === 'explodingKitten')).toBe(false);
      }
    }
  });

  it('conserves all 56 cards across deck and hands', () => {
    for (const n of [2, 3, 4, 5]) {
      const s = newGame(n);
      const inHands = Object.values(s.hands).reduce((sum, h) => sum + h.length, 0);
      // Unused kittens and unused defuses stay in the box.
      const boxedKittens = BASE_DECK_COUNTS.explodingKitten - (n - 1);
      expect(s.deck.length + inHands + boxedKittens).toBe(TOTAL_BASE_CARDS);
    }
  });

  it('gives every card a unique id', () => {
    const s = newGame(5);
    const ids = [...s.deck, ...Object.values(s.hands).flat()].map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is deterministic for a given seed', () => {
    const a = createInitialState(CONFIG, 999, seats(4));
    const b = createInitialState(CONFIG, 999, seats(4));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('deals 7 + 1 when handSize is 7', () => {
    const s = newGame(3, { handSize: 7 });
    expect(s.hands.p0).toHaveLength(8);
  });

  it('leaves leftover Defuses in the deck', () => {
    // 6 defuses, 2 players → 2 dealt, 4 back into the deck.
    const s = newGame(2);
    expect(s.deck.filter((c) => c.kind === 'defuse')).toHaveLength(4);
  });

  it('dealSetup handles the 5-player edge where only one Defuse is left over', () => {
    const rng = { seed: 7 };
    const { deck, hands } = dealSetup(seats(5), rng, 4);
    expect(Object.keys(hands)).toHaveLength(5);
    expect(deck.filter((c) => c.kind === 'defuse')).toHaveLength(1);
  });
});

// ============================================================================
// Turn flow
// ============================================================================

describe('drawing', () => {
  it('ends the turn and passes to the next player', () => {
    const s = newGame(3);
    // Force a safe top card.
    s.deck = [card('tacoCat'), ...s.deck.filter((c) => c.kind !== 'explodingKitten')];
    const next = applyAction(s, { type: 'drawCard', playerId: 'p0' });
    expect(next.turnPlayerId).toBe('p1');
    expect(next.activePlayerId).toBe('p1');
    expect(next.hands.p0).toHaveLength(6);
  });

  it('rejects a draw from the wrong player', () => {
    const s = newGame(3);
    expect(() => applyAction(s, { type: 'drawCard', playerId: 'p1' })).toThrow(/not your turn/);
  });

  it('eliminates a player with no Defuse and discards their whole hand', () => {
    const s = rig({
      deck: [card('explodingKitten'), card('tacoCat')],
      hands: { p0: [card('skip'), card('beardCat')], p1: [card('nope')], p2: [] },
    });
    const next = applyAction(s, { type: 'drawCard', playerId: 'p0' });
    expect(next.eliminated).toEqual(['p0']);
    expect(next.hands.p0).toEqual([]);
    // Kitten + both hand cards.
    expect(next.discard).toHaveLength(3);
    expect(next.turnPlayerId).toBe('p1');
  });

  it('offers a Defuse when the drawer holds one', () => {
    const s = rig({
      deck: [card('explodingKitten')],
      hands: { p0: [card('defuse')], p1: [], p2: [] },
    });
    const next = applyAction(s, { type: 'drawCard', playerId: 'p0' });
    expect(next.subPhase).toBe('awaitingDefuse');
    expect(next.pendingKitten?.kind).toBe('explodingKitten');
    expect(next.eliminated).toEqual([]);
  });

  it('ends the game when only one player is left', () => {
    const s = rig({
      deck: [card('explodingKitten')],
      hands: { p0: [], p1: [], p2: [] },
      eliminated: ['p2'],
    });
    const next = applyAction(s, { type: 'drawCard', playerId: 'p0' });
    expect(next.phase).toBe('gameOver');
    expect(next.activePlayerId).toBeNull();
    // Winner outlasted the most players.
    expect(next.finalScores!.p1).toBeGreaterThan(next.finalScores!.p0);
    expect(next.finalScores!.p0).toBeGreaterThan(next.finalScores!.p2);
  });
});

describe('defuse and reinsertion', () => {
  it('puts the kitten back at the chosen index and ends the turn', () => {
    const s = rig({
      subPhase: 'awaitingDefuse',
      deck: [card('tacoCat'), card('beardCat')],
      pendingKitten: card('explodingKitten'),
      hands: { p0: [card('defuse')], p1: [], p2: [] },
    });
    const defused = applyAction(s, { type: 'playDefuse', playerId: 'p0', cardId: s.hands.p0![0]!.id });
    expect(defused.subPhase).toBe('awaitingKittenPlace');

    const placed = applyAction(defused, { type: 'placeKitten', playerId: 'p0', index: 0 });
    expect(placed.deck[0]!.kind).toBe('explodingKitten');
    expect(placed.pendingKitten).toBeNull();
    expect(placed.turnPlayerId).toBe('p1');
  });

  it('clamps an out-of-range index to the bottom of the deck', () => {
    const s = rig({
      subPhase: 'awaitingKittenPlace',
      deck: [card('tacoCat'), card('beardCat')],
      pendingKitten: card('explodingKitten'),
    });
    const placed = applyAction(s, { type: 'placeKitten', playerId: 'p0', index: 999 });
    expect(placed.deck).toHaveLength(3);
    expect(placed.deck[2]!.kind).toBe('explodingKitten');
  });

  it('lets the placer know the top card when they hide it on top', () => {
    const s = rig({
      subPhase: 'awaitingKittenPlace',
      deck: [card('tacoCat')],
      pendingKitten: card('explodingKitten'),
      knownTopCount: { p0: 0, p1: 3, p2: 2 },
    });
    const placed = applyAction(s, { type: 'placeKitten', playerId: 'p0', index: 0 });
    expect(placed.knownTopCount.p0).toBe(1);
    // Everyone else's knowledge is now stale.
    expect(placed.knownTopCount.p1).toBe(0);
    expect(placed.knownTopCount.p2).toBe(0);
  });

  it('leaves knowledge below the insert point intact', () => {
    const s = rig({
      subPhase: 'awaitingKittenPlace',
      deck: [card('tacoCat'), card('beardCat'), card('skip')],
      pendingKitten: card('explodingKitten'),
      knownTopCount: { p0: 0, p1: 3, p2: 0 },
    });
    const placed = applyAction(s, { type: 'placeKitten', playerId: 'p0', index: 2 });
    expect(placed.knownTopCount.p1).toBe(2);
  });
});

describe('skip and attack', () => {
  it('skip ends the turn without drawing', () => {
    const s = rig({ hands: { p0: [card('skip')], p1: [], p2: [] } });
    const deckBefore = s.deck.length;
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.deck).toHaveLength(deckBefore);
    expect(next.turnPlayerId).toBe('p1');
  });

  it('attack hands the next player two turns', () => {
    const s = rig({ hands: { p0: [card('attack')], p1: [], p2: [] } });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.turnPlayerId).toBe('p1');
    expect(next.turnsRemaining).toBe(2);
  });

  it('attack stacks: 2 owed + attack = 3 for the next player', () => {
    const s = rig({
      hands: { p0: [], p1: [card('attack')], p2: [] },
      turnPlayerId: 'p1',
      activePlayerId: 'p1',
      turnsRemaining: 2,
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p1', cardIds: [s.hands.p1![0]!.id] });
    expect(next.turnPlayerId).toBe('p2');
    expect(next.turnsRemaining).toBe(3);
  });

  it('skip burns only one of several owed turns', () => {
    const s = rig({
      hands: { p0: [card('skip'), card('skip')], p1: [], p2: [] },
      turnsRemaining: 2,
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.turnPlayerId).toBe('p0');
    expect(next.turnsRemaining).toBe(1);
  });

  it('turn advance skips eliminated seats', () => {
    const s = rig({
      hands: { p0: [card('skip')], p1: [], p2: [] },
      eliminated: ['p1'],
    }, 3);
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.turnPlayerId).toBe('p2');
  });
});

// ============================================================================
// Nope
// ============================================================================

describe('nope window', () => {
  it('resolves immediately when nobody holds a Nope', () => {
    const s = rig({ hands: { p0: [card('skip')], p1: [], p2: [] } });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.subPhase).toBe('awaitingAction');
    expect(next.pending).toBeNull();
  });

  it('opens a window for Nope holders only', () => {
    const s = rig({ hands: { p0: [card('skip')], p1: [card('nope')], p2: [card('tacoCat')] } });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.subPhase).toBe('awaitingNope');
    expect(next.pending!.responderQueue).toEqual(['p1']);
    expect(next.activePlayerId).toBe('p1');
  });

  it('one Nope cancels the play', () => {
    const s = rig({ hands: { p0: [card('skip')], p1: [card('nope')], p2: [] } });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    const noped = applyAction(opened, { type: 'playNope', playerId: 'p1', cardId: s.hands.p1![0]!.id });
    // Skip was cancelled, so p0 still owes a turn.
    expect(noped.subPhase).toBe('awaitingAction');
    expect(noped.turnPlayerId).toBe('p0');
    expect(noped.discard).toHaveLength(2);
  });

  it('two Nopes cancel each other and the play resolves', () => {
    const s = rig({ hands: { p0: [card('skip'), card('nope')], p1: [card('nope')], p2: [] } });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    const noped = applyAction(opened, { type: 'playNope', playerId: 'p1', cardId: s.hands.p1![0]!.id });
    // The window reopened and now includes p0, who can counter-Nope.
    expect(noped.subPhase).toBe('awaitingNope');
    expect(noped.pending!.responderQueue).toContain('p0');

    const counter = applyAction(noped, { type: 'playNope', playerId: 'p0', cardId: s.hands.p0![1]!.id });
    // Nobody holds a Nope now, so it resolves: the Skip goes through.
    expect(counter.subPhase).toBe('awaitingAction');
    expect(counter.turnPlayerId).toBe('p1');
  });

  it('declining passes the response along and then resolves', () => {
    const s = rig({ hands: { p0: [card('skip')], p1: [card('nope')], p2: [card('nope')] } });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(opened.pending!.responderQueue).toEqual(['p1', 'p2']);

    const one = applyAction(opened, { type: 'declineNope', playerId: 'p1' });
    expect(one.activePlayerId).toBe('p2');
    const two = applyAction(one, { type: 'declineNope', playerId: 'p2' });
    expect(two.subPhase).toBe('awaitingAction');
    expect(two.turnPlayerId).toBe('p1'); // skip resolved
  });

  it('lets any Nope holder jump in, not just the one at the head of the queue', () => {
    // Nope is a shout in the physical game, so a holder may answer out of order.
    // Only DECLINING is sequenced, since that is what advances the queue.
    const s = rig({ hands: { p0: [card('skip')], p1: [card('nope')], p2: [card('nope')] } });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(opened.pending!.responderQueue).toEqual(['p1', 'p2']);
    const noped = applyAction(opened, { type: 'playNope', playerId: 'p2', cardId: s.hands.p2![0]!.id });
    expect(noped.pending!.nopeCards).toHaveLength(1);
  });

  it('rejects a Nope from someone who holds none', () => {
    const s = rig({ hands: { p0: [card('skip')], p1: [card('nope')], p2: [card('tacoCat')] } });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(opened.pending!.responderQueue).toEqual(['p1']);
    expect(() => applyAction(opened, { type: 'playNope', playerId: 'p2', cardId: s.hands.p2![0]!.id }))
      .toThrow(/not being asked/);
  });

  it('rejects declining out of order', () => {
    const s = rig({ hands: { p0: [card('skip')], p1: [card('nope')], p2: [card('nope')] } });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(() => applyAction(opened, { type: 'declineNope', playerId: 'p2' }))
      .toThrow(/not your response/);
  });

  it('rejects playing Nope as a turn action', () => {
    const s = rig({ hands: { p0: [card('nope')], p1: [], p2: [] } });
    expect(() => applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] }))
      .toThrow(/in response/);
  });
});

// ============================================================================
// Favor and combos
// ============================================================================

describe('favor', () => {
  it('lets the victim choose which card to hand over', () => {
    const s = rig({
      hands: { p0: [card('favor')], p1: [card('defuse'), card('tacoCat')], p2: [] },
    });
    const opened = applyAction(s, {
      type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id], targetPlayerId: 'p1',
    });
    expect(opened.subPhase).toBe('awaitingFavorGive');
    expect(opened.activePlayerId).toBe('p1');

    const junk = s.hands.p1![1]!.id;
    const given = applyAction(opened, { type: 'giveCard', playerId: 'p1', cardId: junk });
    expect(given.hands.p0!.map((c) => c.kind)).toEqual(['tacoCat']);
    expect(given.hands.p1!.map((c) => c.kind)).toEqual(['defuse']);
    expect(given.activePlayerId).toBe('p0');
    expect(given.subPhase).toBe('awaitingAction');
  });

  it('is a no-op against an empty hand', () => {
    const s = rig({ hands: { p0: [card('favor')], p1: [], p2: [] } });
    const next = applyAction(s, {
      type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id], targetPlayerId: 'p1',
    });
    expect(next.subPhase).toBe('awaitingAction');
    expect(next.hands.p0).toEqual([]);
  });

  it('requires a target', () => {
    const s = rig({ hands: { p0: [card('favor')], p1: [], p2: [] } });
    expect(() => applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] }))
      .toThrow(/needs a target/);
  });

  it('rejects targeting yourself', () => {
    const s = rig({ hands: { p0: [card('favor')], p1: [], p2: [] } });
    expect(() => applyAction(s, {
      type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id], targetPlayerId: 'p0',
    })).toThrow(/target yourself/);
  });
});

describe('combos', () => {
  it('a pair steals one random card', () => {
    const s = rig({
      hands: {
        p0: [card('tacoCat'), card('tacoCat')],
        p1: [card('defuse'), card('skip'), card('shuffle')],
        p2: [],
      },
    });
    const ids = s.hands.p0!.map((c) => c.id);
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: ids, targetPlayerId: 'p1' });
    expect(next.hands.p0).toHaveLength(1);
    expect(next.hands.p1).toHaveLength(2);
    expect(next.subPhase).toBe('awaitingAction');
  });

  it('a triple takes the named card', () => {
    const s = rig({
      hands: {
        p0: [card('beardCat'), card('beardCat'), card('beardCat')],
        p1: [card('defuse'), card('skip')],
        p2: [],
      },
    });
    const ids = s.hands.p0!.map((c) => c.id);
    const next = applyAction(s, {
      type: 'playCards', playerId: 'p0', cardIds: ids, targetPlayerId: 'p1', demandKind: 'defuse',
    });
    expect(next.hands.p0!.map((c) => c.kind)).toEqual(['defuse']);
    expect(next.hands.p1!.map((c) => c.kind)).toEqual(['skip']);
  });

  it('a triple against a player without the card takes nothing', () => {
    const s = rig({
      hands: {
        p0: [card('beardCat'), card('beardCat'), card('beardCat')],
        p1: [card('skip')],
        p2: [],
      },
    });
    const ids = s.hands.p0!.map((c) => c.id);
    const next = applyAction(s, {
      type: 'playCards', playerId: 'p0', cardIds: ids, targetPlayerId: 'p1', demandKind: 'defuse',
    });
    expect(next.hands.p0).toEqual([]);
    expect(next.hands.p1!.map((c) => c.kind)).toEqual(['skip']);
  });

  it('a triple must name a card', () => {
    const s = rig({
      hands: { p0: [card('beardCat'), card('beardCat'), card('beardCat')], p1: [card('skip')], p2: [] },
    });
    const ids = s.hands.p0!.map((c) => c.id);
    expect(() => applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: ids, targetPlayerId: 'p1' }))
      .toThrow(/must name a card/);
  });

  it('five different cards take from the discard, excluding the five just played', () => {
    const played = [
      card('tacoCat'), card('beardCat'), card('cattermelon'),
      card('hairyPotatoCat'), card('rainbowRalphingCat'),
    ];
    const buried = card('defuse');
    const s = rig({
      hands: { p0: played, p1: [], p2: [] },
      discard: [buried],
    });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: played.map((c) => c.id) });
    expect(opened.subPhase).toBe('awaitingDiscardPick');
    // The five played cards are in limbo, not yet reclaimable.
    expect(opened.discard.map((c) => c.id)).toEqual([buried.id]);

    const took = applyAction(opened, { type: 'takeFromDiscard', playerId: 'p0', cardId: buried.id });
    expect(took.hands.p0!.map((c) => c.kind)).toEqual(['defuse']);
    // Now the five join the pile.
    expect(took.discard).toHaveLength(5);
    expect(took.limbo).toEqual([]);
  });

  it('rejects a mismatched pair', () => {
    const s = rig({ hands: { p0: [card('tacoCat'), card('beardCat')], p1: [card('skip')], p2: [] } });
    const ids = s.hands.p0!.map((c) => c.id);
    expect(() => applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: ids, targetPlayerId: 'p1' }))
      .toThrow(/legal combo/);
  });

  it('rejects a lone cat card', () => {
    const s = rig({ hands: { p0: [card('tacoCat')], p1: [], p2: [] } });
    expect(() => applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] }))
      .toThrow(/do nothing on their own/);
  });

  it('detectCombo honours combosCatsOnly', () => {
    const skips = [card('skip'), card('skip')];
    expect(detectCombo(skips, false)).toBe('pair');
    expect(detectCombo(skips, true)).toBeNull();
    const cats = [card('tacoCat'), card('tacoCat')];
    expect(detectCombo(cats, true)).toBe('pair');
  });

  it('availableCombos finds pairs, triples and five-differents', () => {
    const s = rig({
      hands: {
        p0: [
          card('tacoCat'), card('tacoCat'), card('tacoCat'),
          card('beardCat'), card('cattermelon'), card('skip'), card('nope'),
        ],
        p1: [], p2: [],
      },
    });
    const combos = availableCombos(s, 'p0');
    expect(combos.some((c) => c.kind === 'pair')).toBe(true);
    expect(combos.some((c) => c.kind === 'triple')).toBe(true);
    expect(combos.some((c) => c.kind === 'fiveDifferent')).toBe(true);
  });
});

// ============================================================================
// See the Future and deck knowledge
// ============================================================================

describe('see the future', () => {
  it('reveals three cards and remembers them', () => {
    const top = [card('tacoCat'), card('skip'), card('explodingKitten')];
    const s = rig({
      hands: { p0: [card('seeTheFuture')], p1: [], p2: [] },
      deck: [...top, card('beardCat')],
    });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(opened.subPhase).toBe('awaitingFutureView');
    expect(opened.peek!.cards.map((c) => c.kind)).toEqual(['tacoCat', 'skip', 'explodingKitten']);

    const acked = applyAction(opened, { type: 'ackPeek', playerId: 'p0' });
    expect(acked.peek).toBeNull();
    expect(acked.knownTopCount.p0).toBe(3);
    expect(acked.subPhase).toBe('awaitingAction');
  });

  it('knowledge decays by one on each draw', () => {
    const s = rig({
      knownTopCount: { p0: 3, p1: 3, p2: 0 },
      deck: [card('tacoCat'), card('skip')],
      hands: { p0: [], p1: [], p2: [] },
    });
    const next = applyAction(s, { type: 'drawCard', playerId: 'p0' });
    expect(next.knownTopCount.p0).toBe(2);
    expect(next.knownTopCount.p1).toBe(2);
    expect(next.knownTopCount.p2).toBe(0);
  });

  it('shuffling wipes everyone’s knowledge', () => {
    const s = rig({
      hands: { p0: [card('shuffle')], p1: [], p2: [] },
      knownTopCount: { p0: 3, p1: 2, p2: 1 },
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(Object.values(next.knownTopCount)).toEqual([0, 0, 0]);
  });
});

describe('derived information', () => {
  it('kittensInDeck uses public info only', () => {
    const s = newGame(4);
    expect(kittensInDeck(s)).toBe(3);
    const withExplosion: EkState = { ...s, discard: [card('explodingKitten')] };
    expect(kittensInDeck(withExplosion)).toBe(2);
  });

  it('drawDanger is certain when the top card is known', () => {
    const s = rig({
      // 3 players → 2 kittens seeded, so an 8-card deck reads as 25% to a player
      // who cannot see the top.
      deck: [card('explodingKitten'), ...Array.from({ length: 7 }, () => card('tacoCat'))],
      knownTopCount: { p0: 1, p1: 0, p2: 0 },
    });
    expect(drawDanger(s, 'p0')).toBe(1);
    expect(drawDanger(s, 'p1')).toBeCloseTo(0.25);
  });

  it('drawDanger is the kitten ratio when the top is unknown', () => {
    const s = rig({
      deck: [card('tacoCat'), card('tacoCat'), card('tacoCat'), card('tacoCat')],
      knownTopCount: { p0: 0, p1: 0, p2: 0 },
    });
    // 3 players → 2 kittens seeded, 4 cards in deck.
    expect(drawDanger(s, 'p0')).toBeCloseTo(0.5);
  });
});

// ============================================================================
// Purity
// ============================================================================

describe('purity', () => {
  it('does not mutate the input state', () => {
    const s = newGame(3);
    const before = JSON.stringify(s);
    applyAction(s, { type: 'drawCard', playerId: 'p0' });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('is deterministic: same state and action produce the same result', () => {
    const s = rig({
      hands: { p0: [card('tacoCat'), card('tacoCat')], p1: [card('skip'), card('nope')], p2: [] },
    });
    const a = applyAction(s, {
      type: 'playCards', playerId: 'p0', cardIds: s.hands.p0!.map((c) => c.id), targetPlayerId: 'p1',
    });
    const b = applyAction(s, {
      type: 'playCards', playerId: 'p0', cardIds: s.hands.p0!.map((c) => c.id), targetPlayerId: 'p1',
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('refuses to act after game over', () => {
    const s = rig({ phase: 'gameOver' });
    expect(() => applyAction(s, { type: 'drawCard', playerId: 'p0' })).toThrow(/game is over/);
  });
});
