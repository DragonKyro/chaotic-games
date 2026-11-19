import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import { BASE_DECK_COUNTS, TOTAL_BASE_CARDS, dealSetup, detectCombo } from './cards';
import {
  applyAction,
  availableCombos,
  createInitialState,
  drawDanger,
  kittensInDeck,
  knownTopCards,
  sightedKittens,
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

  it('conserves all 56 cards across deck, hands and the box', () => {
    for (const n of [2, 3, 4, 5]) {
      const s = newGame(n);
      const inHands = Object.values(s.hands).reduce((sum, h) => sum + h.length, 0);
      // Unused kittens and the Defuses beyond the 2 spares stay in the box.
      const boxedKittens = BASE_DECK_COUNTS.explodingKitten - (n - 1);
      const boxedDefuses = BASE_DECK_COUNTS.defuse - n - Math.min(2, BASE_DECK_COUNTS.defuse - n);
      expect(s.deck.length + inHands + boxedKittens + boxedDefuses).toBe(TOTAL_BASE_CARDS);
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

  it('shuffles only 2 spare Defuses back in (rulebook: "Shuffle 2 of the extras back into the deck")', () => {
    // 6 Defuses: 2 players → 2 dealt, 4 spare, only 2 go back; the rest leave the game.
    for (const n of [2, 3, 4]) {
      const { deck, hands } = dealSetup(seats(n), { seed: 7 }, 4);
      const inPlay = [...deck, ...Object.values(hands).flat()].filter((c) => c.kind === 'defuse');
      expect(inPlay, `${n} players`).toHaveLength(n + 2);
    }
  });

  it('dealSetup handles the 5-player edge where only one Defuse is left over', () => {
    const rng = { seed: 7 };
    const { deck, hands } = dealSetup(seats(5), rng, 4);
    expect(Object.keys(hands)).toHaveLength(5);
    const inPlay = [...deck, ...Object.values(hands).flat()].filter((c) => c.kind === 'defuse');
    expect(inPlay).toHaveLength(6);
  });

  it('shuffles the spare Defuses in BEFORE the deal, so an opening hand can hold two', () => {
    // Over many seeds a spare must sometimes land in a hand.
    let sawDouble = false;
    for (let seed = 1; seed < 200 && !sawDouble; seed++) {
      const { hands } = dealSetup(seats(2), { seed }, 7);
      sawDouble = Object.values(hands).some((h) => h.filter((c) => c.kind === 'defuse').length >= 2);
    }
    expect(sawDouble).toBe(true);
  });

  it('defaults to the rulebook deal: 7 cards + 1 Defuse', async () => {
    const { explodingKittensModule } = await import('./module');
    const config = explodingKittensModule.defaultConfig(seats(3));
    expect(config.handSize).toBe(7);
    expect(config.fiveDifferentCombo).toBe(false);
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

  it('eliminates a player with no Defuse; their cards leave the game, not into the discard', () => {
    // "put the Kitten that killed you face up in front of you … and put the rest of
    // your cards face down in front of you."
    const s = rig({
      deck: [card('explodingKitten'), card('tacoCat')],
      hands: { p0: [card('skip'), card('beardCat')], p1: [card('nope')], p2: [] },
    });
    const next = applyAction(s, { type: 'drawCard', playerId: 'p0' });
    expect(next.eliminated).toEqual(['p0']);
    expect(next.hands.p0).toEqual([]);
    expect(next.discard).toHaveLength(0);
    expect(next.deadKittens.p0!.map((c) => c.kind)).toEqual(['explodingKitten']);
    expect(next.deadHands.p0!.map((c) => c.kind)).toEqual(['skip', 'beardCat']);
    expect(next.turnPlayerId).toBe('p1');
    // The face-up kitten counts as gone for the public kitten count.
    expect(kittensInDeck(next)).toBe(kittensInDeck(s) - 1);
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

  it('attack stacks: a victim who attacks straight away hands on 4 (rulebook example)', () => {
    const s = rig({ hands: { p0: [card('attack')], p1: [card('attack')], p2: [] } });
    const attacked = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(attacked.turnPlayerId).toBe('p1');
    expect(attacked.turnsRemaining).toBe(2);
    expect(attacked.underAttack).toBe(true);
    const next = applyAction(attacked, { type: 'playCards', playerId: 'p1', cardIds: [s.hands.p1![0]!.id] });
    expect(next.turnPlayerId).toBe('p2');
    expect(next.turnsRemaining).toBe(4);
  });

  it('attack stacks: a victim who completes one turn and then attacks hands on only 3', () => {
    const s = rig({
      deck: [card('tacoCat'), card('beardCat'), card('cattermelon')],
      hands: { p0: [card('attack')], p1: [card('attack')], p2: [] },
    });
    const attacked = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    const oneDone = applyAction(attacked, { type: 'drawCard', playerId: 'p1' });
    expect(oneDone.turnPlayerId).toBe('p1');
    expect(oneDone.turnsRemaining).toBe(1);
    const next = applyAction(oneDone, { type: 'playCards', playerId: 'p1', cardIds: [s.hands.p1![0]!.id] });
    expect(next.turnsRemaining).toBe(3);
  });

  it('a player who was not attacked always hands on exactly 2', () => {
    const s = rig({ hands: { p0: [card('attack')], p1: [], p2: [] }, turnsRemaining: 1, underAttack: false });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.turnsRemaining).toBe(2);
    // And a fresh turn after the attack is not "under attack".
    const fresh = applyAction(rig({ deck: [card('tacoCat'), card('tacoCat'), card('tacoCat')], hands: { p0: [], p1: [], p2: [] }, turnsRemaining: 1, underAttack: true }),
      { type: 'drawCard', playerId: 'p0' });
    expect(fresh.underAttack).toBe(false);
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

  it('five different cards take from the discard, excluding the five just played (opt-in)', () => {
    const played = [
      card('tacoCat'), card('beardCat'), card('cattermelon'),
      card('hairyPotatoCat'), card('rainbowRalphingCat'),
    ];
    const buried = card('defuse');
    const s = rig({
      hands: { p0: played, p1: [], p2: [] },
      discard: [buried],
      config: { ...CONFIG, fiveDifferentCombo: true },
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

  it('five different is not a combo under the current rulebook (off by default)', () => {
    const played = [
      card('tacoCat'), card('beardCat'), card('cattermelon'),
      card('hairyPotatoCat'), card('rainbowRalphingCat'),
    ];
    const s = rig({ hands: { p0: played, p1: [], p2: [] }, discard: [card('defuse')] });
    expect(() => applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: played.map((c) => c.id) }))
      .toThrow(/legal combo/);
    expect(availableCombos(s, 'p0').some((c) => c.kind === 'fiveDifferent')).toBe(false);
  });

  it('detectCombo honours combosCatsOnly', () => {
    const rules = (catsOnly: boolean) => ({ catsOnly, fiveDifferent: false });
    const skips = [card('skip'), card('skip')];
    expect(detectCombo(skips, rules(false))).toBe('pair');
    expect(detectCombo(skips, rules(true))).toBeNull();
    const cats = [card('tacoCat'), card('tacoCat')];
    expect(detectCombo(cats, rules(true))).toBe('pair');
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
      config: { ...CONFIG, fiveDifferentCombo: true },
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

// ============================================================================
// Expansions
// ============================================================================

describe('Expansion 1: imploding-kittens', () => {
  it('deals 1 implodingKitten into the deck and supports 6 players', () => {
    const s = newGame(6, { expansions: ['imploding-kittens'] });
    expect(s.seats).toHaveLength(6);
    expect(s.deck.filter((c) => c.kind === 'implodingKitten')).toHaveLength(1);
    expect(s.implodingFaceUp).toBe(false);
  });

  it('first draw of implodingKitten flips it face-up and requires placement without Defuse; second draw explodes immediately', () => {
    const ik = card('implodingKitten');
    const safe = card('tacoCat');
    const s = rig({
      deck: [ik, safe],
      hands: { p0: [card('defuse')], p1: [card('defuse')], p2: [] },
      implodingFaceUp: false,
    });
    // First draw: face-down -> goes straight to awaitingKittenPlace, does not consume Defuse.
    const drawn1 = applyAction(s, { type: 'drawCard', playerId: 'p0' });
    expect(drawn1.subPhase).toBe('awaitingKittenPlace');
    expect(drawn1.implodingFaceUp).toBe(true);
    expect(drawn1.hands.p0).toHaveLength(1);

    // Place it at index 0 (top of deck) -> everyone knows the top card is the face-up Imploding Kitten!
    const placed = applyAction(drawn1, { type: 'placeKitten', playerId: 'p0', index: 0 });
    expect(placed.turnPlayerId).toBe('p1');
    expect(placed.knownTopCount.p0).toBeGreaterThanOrEqual(1);
    expect(placed.knownTopCount.p1).toBeGreaterThanOrEqual(1);
    expect(placed.knownTopCount.p2).toBeGreaterThanOrEqual(1);
    expect(drawDanger(placed, 'p1')).toBe(1);

    // Second draw by p1 (who even holds a Defuse!) -> immediate explosion!
    const drawn2 = applyAction(placed, { type: 'drawCard', playerId: 'p1' });
    expect(drawn2.eliminated).toContain('p1');
    expect(drawn2.turnPlayerId).toBe('p2');
  });

  it('reverse flips turnDirection and ends 1 turn without drawing', () => {
    const s = rig({
      hands: { p0: [card('reverse')], p1: [], p2: [] },
      turnDirection: 1,
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.turnDirection).toBe(-1);
    // In 3-player game (p0, p1, p2), going -1 from p0 lands on p2.
    expect(next.turnPlayerId).toBe('p2');
  });

  it('drawFromTheBottom draws the bottom card of the deck and ends the turn', () => {
    const top = card('explodingKitten');
    const bottom = card('tacoCat');
    const s = rig({
      deck: [top, bottom],
      hands: { p0: [card('drawFromTheBottom')], p1: [], p2: [] },
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.hands.p0!.map((c) => c.id)).toEqual([bottom.id]);
    expect(next.deck.map((c) => c.id)).toEqual([top.id]);
    expect(next.turnPlayerId).toBe('p1');
  });

  it('alterTheFuture lets the player reorder the top 3 cards and clamps others knowledge', () => {
    const c1 = card('explodingKitten');
    const c2 = card('tacoCat');
    const c3 = card('skip');
    const s = rig({
      deck: [c1, c2, c3, card('beardCat')],
      hands: { p0: [card('alterTheFuture')], p1: [], p2: [] },
      knownTopCount: { p0: 0, p1: 3, p2: 2 },
    });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(opened.subPhase).toBe('awaitingFutureView');
    expect(opened.peek?.canReorder).toBe(true);

    const reordered = applyAction(opened, {
      type: 'reorderFuture',
      playerId: 'p0',
      orderedCardIds: [c2.id, c3.id, c1.id],
    });
    expect(reordered.subPhase).toBe('awaitingAction');
    expect(reordered.deck.slice(0, 3).map((c) => c.id)).toEqual([c2.id, c3.id, c1.id]);
    expect(reordered.knownTopCount.p0).toBe(3);
    expect(reordered.knownTopCount.p1).toBe(0);
    expect(reordered.knownTopCount.p2).toBe(0);
  });

  it('targetedAttack hits any chosen player; a victim stacks current + untaken turns + 2', () => {
    const s = rig({
      hands: { p0: [card('targetedAttack')], p1: [], p2: [] },
      turnsRemaining: 2,
      underAttack: true,
    });
    const next = applyAction(s, {
      type: 'playCards',
      playerId: 'p0',
      cardIds: [s.hands.p0![0]!.id],
      targetPlayerId: 'p2',
    });
    expect(next.turnPlayerId).toBe('p2');
    expect(next.turnsRemaining).toBe(4);
  });

  it('targetedAttack may target yourself ("any player (including yourself)")', () => {
    const s = rig({ hands: { p0: [card('targetedAttack')], p1: [], p2: [] } });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id], targetPlayerId: 'p0' });
    expect(next.turnPlayerId).toBe('p0');
    expect(next.turnsRemaining).toBe(2);
  });

  it('kittens total players - 1 with the Imploding Kitten counted among them', () => {
    for (const n of [2, 4, 6]) {
      const s = newGame(n, { expansions: ['imploding-kittens'] });
      const ek = s.deck.filter((c) => c.kind === 'explodingKitten').length;
      const ik = s.deck.filter((c) => c.kind === 'implodingKitten').length;
      expect(ik).toBe(1);
      expect(ek + ik, `${n} players`).toBe(n - 1);
      expect(kittensInDeck(s)).toBe(n - 2);
    }
  });

  it('feralCat substitutes for any Cat Card in pairs and triples', () => {
    const rules = { catsOnly: true, fiveDifferent: false };
    const pairCards = [card('feralCat'), card('tacoCat')];
    expect(detectCombo(pairCards, rules)).toBe('pair');
    const tripleCards = [card('feralCat'), card('beardCat'), card('feralCat')];
    expect(detectCombo(tripleCards, rules)).toBe('triple');
    // "This card cannot be used as a non-Cat Card."
    expect(detectCombo([card('feralCat'), card('skip')], { catsOnly: false, fiveDifferent: false })).toBeNull();

    const s = rig({
      hands: {
        p0: [card('feralCat'), card('tacoCat')],
        p1: [card('skip')],
        p2: [],
      },
    });
    const combos = availableCombos(s, 'p0');
    expect(combos.some((c) => c.kind === 'pair')).toBe(true);

    const next = applyAction(s, {
      type: 'playCards',
      playerId: 'p0',
      cardIds: s.hands.p0!.map((c) => c.id),
      targetPlayerId: 'p1',
    });
    expect(next.hands.p0!.map((c) => c.kind)).toEqual(['skip']);
  });
});

describe('Expansion 2: streaking-kittens', () => {
  it('seeds 1 extra explodingKitten (playerCount total)', () => {
    const s = newGame(4, { expansions: ['streaking-kittens'] });
    expect(s.deck.filter((c) => c.kind === 'explodingKitten')).toHaveLength(4);
    expect(kittensInDeck(s)).toBe(4);
    // With Imploding too: Imploding + Exploding together equal the player count.
    const both = newGame(6, { expansions: ['streaking-kittens', 'imploding-kittens'] });
    expect(both.deck.filter((c) => c.kind === 'explodingKitten' || c.kind === 'implodingKitten')).toHaveLength(6);
  });

  it('has exactly 15 cards, one Super Skip among them', async () => {
    const { STREAKING_DECK_COUNTS } = await import('./cards');
    expect(Object.values(STREAKING_DECK_COUNTS).reduce((a, b) => a + b, 0)).toBe(15);
    expect(STREAKING_DECK_COUNTS.superSkip).toBe(1);
  });

  it('streakingKitten holds a drawn Exploding Kitten in SECRET — the draw looks like any other', () => {
    const ek = card('explodingKitten');
    const sk = card('streakingKitten');
    const s = rig({
      deck: [ek, card('tacoCat')],
      hands: { p0: [sk], p1: [card('favor')], p2: [] },
    });
    const kept = applyAction(s, { type: 'drawCard', playerId: 'p0' });
    expect(kept.subPhase).toBe('awaitingAction');
    expect(kept.turnPlayerId).toBe('p1');
    expect(kept.hands.p0!.map((c) => c.kind)).toEqual(['streakingKitten', 'explodingKitten']);
    expect(kept.log.at(-1)?.text).toMatch(/drew a card and ended their turn/);
    expect(kept.log.some((e) => /Exploding Kitten/.test(e.text))).toBe(false);

    // Now p1 demands a Favor from p0, and p0 gives away their Streaking Kitten -> p0 explodes!
    const favorOpen = applyAction(kept, {
      type: 'playCards',
      playerId: 'p1',
      cardIds: [kept.hands.p1![0]!.id],
      targetPlayerId: 'p0',
    });
    const afterGive = applyAction(favorOpen, {
      type: 'giveCard',
      playerId: 'p0',
      cardId: sk.id,
    });
    expect(afterGive.eliminated).toContain('p0');
  });

  it('a player who would rather Defuse sets that in advance', () => {
    const s = rig({
      deck: [card('explodingKitten'), card('tacoCat')],
      hands: { p0: [card('streakingKitten'), card('defuse')], p1: [], p2: [] },
    });
    const pref = applyAction(s, { type: 'setStreakingHold', playerId: 'p0', hold: false });
    const drawn = applyAction(pref, { type: 'drawCard', playerId: 'p0' });
    expect(drawn.subPhase).toBe('awaitingDefuse');
    // With no Defuse to fall back on, the preference can't kill you: it holds anyway.
    const noDefuse = applyAction(rig({ deck: [card('explodingKitten')], hands: { p0: [card('streakingKitten')], p1: [], p2: [] }, streakingHold: { p0: false } }),
      { type: 'drawCard', playerId: 'p0' });
    expect(noDefuse.eliminated).toEqual([]);
  });

  it('whoever is handed an Exploding Kitten out of a hand must Defuse it or die', () => {
    const ek = card('explodingKitten');
    const s = rig({
      deck: [card('tacoCat')],
      hands: { p0: [card('favor')], p1: [card('streakingKitten'), ek], p2: [] },
    });
    const favor = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id], targetPlayerId: 'p1' });
    expect(favor.subPhase).toBe('awaitingFavorGive');
    const given = applyAction(favor, { type: 'giveCard', playerId: 'p1', cardId: ek.id });
    expect(given.eliminated).toEqual(['p0']);
    expect(given.eliminated).not.toContain('p1');
  });

  it('catomicBomb ends only ONE turn of an attacked player ("end your turn")', () => {
    const s = rig({
      deck: [card('tacoCat'), card('explodingKitten')],
      hands: { p0: [card('catomicBomb')], p1: [], p2: [] },
      turnsRemaining: 2,
      underAttack: true,
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.turnPlayerId).toBe('p0');
    expect(next.turnsRemaining).toBe(1);
    expect(next.knownTopCount.p0).toBe(1);
  });

  it('a Cursed player plays one face-down card and names its target only once it is revealed', () => {
    const favor = card('favor');
    const s = rig({
      deck: [card('tacoCat')],
      hands: { p0: [favor, card('beardCat')], p1: [card('skip')], p2: [card('nope')] },
      cursedPlayers: ['p0'],
    });
    expect(() => applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: s.hands.p0!.map((c) => c.id) })).toThrow(/one face-down card/);
    const revealed = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [favor.id] });
    expect(revealed.subPhase).toBe('awaitingBlindTarget');
    const aimed = applyAction(revealed, { type: 'chooseBlindTarget', playerId: 'p0', targetPlayerId: 'p1' });
    // p2's Nope gets its window, then the Favor resolves on p1.
    expect(aimed.subPhase).toBe('awaitingNope');
    const allowed = applyAction(aimed, { type: 'declineNope', playerId: 'p2' });
    expect(allowed.subPhase).toBe('awaitingFavorGive');
    expect(allowed.activePlayerId).toBe('p1');
  });

  it('a Cursed player\'s lone cat card is lost, and the curse lasts until a safe draw', () => {
    const cat = card('beardCat');
    const s = rig({
      deck: [card('tacoCat'), card('skip')],
      hands: { p0: [cat], p1: [], p2: [] },
      cursedPlayers: ['p0'],
    });
    const lost = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [cat.id] });
    expect(lost.discard.map((c) => c.id)).toContain(cat.id);
    expect(lost.cursedPlayers).toContain('p0');
    const drew = applyAction(lost, { type: 'drawCard', playerId: 'p0' });
    expect(drew.cursedPlayers).not.toContain('p0');
  });

  it('a Cursed player who draws an Exploding Kitten defuses blind; non-Defuses are lost', () => {
    const def = card('defuse');
    const junk = card('tacoCat');
    const s = rig({
      deck: [card('explodingKitten'), card('skip')],
      hands: { p0: [junk, def], p1: [], p2: [] },
      cursedPlayers: ['p0'],
    });
    const drawn = applyAction(s, { type: 'drawCard', playerId: 'p0' });
    expect(drawn.subPhase).toBe('awaitingDefuse');
    expect(drawn.cursedPlayers).toContain('p0');
    const miss = applyAction(drawn, { type: 'playDefuse', playerId: 'p0', cardId: junk.id });
    expect(miss.subPhase).toBe('awaitingDefuse');
    expect(miss.discard.map((c) => c.id)).toContain(junk.id);
    const hit = applyAction(miss, { type: 'playDefuse', playerId: 'p0', cardId: def.id });
    expect(hit.subPhase).toBe('awaitingKittenPlace');
    expect(hit.cursedPlayers).not.toContain('p0');
  });

  it('cursed players are never asked to Nope — they cannot see their hand', () => {
    const s = rig({
      hands: { p0: [card('skip')], p1: [card('nope')], p2: [] },
      cursedPlayers: ['p1'],
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.subPhase).toBe('awaitingAction');
  });

  it('superSkip ends all remaining turns even when attacked', () => {
    const s = rig({
      hands: { p0: [card('superSkip')], p1: [], p2: [] },
      turnsRemaining: 4,
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.turnPlayerId).toBe('p1');
    expect(next.turnsRemaining).toBe(1);
  });

  it('seeTheFuture5x and alterTheFuture5x operate on 5 cards', () => {
    const cards5 = [card('tacoCat'), card('skip'), card('beardCat'), card('shuffle'), card('explodingKitten')];
    const s = rig({
      deck: [...cards5, card('cattermelon')],
      hands: { p0: [card('seeTheFuture5x'), card('alterTheFuture5x')], p1: [], p2: [] },
    });
    const s1 = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(s1.peek?.cards).toHaveLength(5);
    const s2 = applyAction(s1, { type: 'ackPeek', playerId: 'p0' });
    expect(s2.knownTopCount.p0).toBe(5);

    const s3 = applyAction(s2, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![1]!.id] });
    expect(s3.peek?.canReorder).toBe(true);
    const revIds = [...cards5].reverse().map((c) => c.id);
    const s4 = applyAction(s3, { type: 'reorderFuture', playerId: 'p0', orderedCardIds: revIds });
    expect(s4.deck.slice(0, 5).map((c) => c.id)).toEqual(revIds);
  });

  it('swapTopAndBottom swaps index 0 and last index of the deck', () => {
    const top = card('explodingKitten');
    const mid = card('skip');
    const bot = card('tacoCat');
    const s = rig({
      deck: [top, mid, bot],
      hands: { p0: [card('swapTopAndBottom')], p1: [], p2: [] },
      knownTopCount: { p0: 2, p1: 1, p2: 0 },
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.deck.map((c) => c.id)).toEqual([bot.id, mid.id, top.id]);
    expect(next.knownTopCount.p0).toBe(0);
  });

  it('garbageCollection collects 1 card from each player and shuffles them into the deck', () => {
    const c0 = card('tacoCat');
    const c1 = card('beardCat');
    const s = rig({
      deck: [card('skip')],
      hands: { p0: [card('garbageCollection'), c0], p1: [c1], p2: [] },
    });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(opened.subPhase).toBe('awaitingGarbagePick');
    expect(opened.activePlayerId).toBe('p0');

    const pick0 = applyAction(opened, { type: 'garbagePick', playerId: 'p0', cardId: c0.id });
    expect(pick0.activePlayerId).toBe('p1');

    const pick1 = applyAction(pick0, { type: 'garbagePick', playerId: 'p1', cardId: c1.id });
    expect(pick1.subPhase).toBe('awaitingAction');
    expect(pick1.deck).toHaveLength(3);
  });

  it('catomicBomb moves all Exploding Kittens to the top of the deck and ends turn', () => {
    const k1 = card('explodingKitten');
    const k2 = card('explodingKitten');
    const s = rig({
      deck: [card('tacoCat'), k1, card('skip'), k2, card('beardCat')],
      hands: { p0: [card('catomicBomb')], p1: [], p2: [] },
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.deck[0]!.kind).toBe('explodingKitten');
    expect(next.deck[1]!.kind).toBe('explodingKitten');
    expect(next.knownTopCount.p1).toBe(2);
    expect(next.turnPlayerId).toBe('p1');
  });

  it('mark and curseOfTheCatButt apply their status effects', () => {
    const targetCard = card('defuse');
    const s = rig({
      deck: [card('tacoCat')],
      hands: { p0: [card('mark'), card('curseOfTheCatButt')], p1: [targetCard], p2: [] },
    });
    const marked = applyAction(s, {
      type: 'playCards',
      playerId: 'p0',
      cardIds: [s.hands.p0![0]!.id],
      targetPlayerId: 'p1',
    });
    expect(marked.markedCardIds).toEqual([targetCard.id]);

    const cursed = applyAction(marked, {
      type: 'playCards',
      playerId: 'p0',
      cardIds: [marked.hands.p0![0]!.id],
      targetPlayerId: 'p1',
    });
    expect(cursed.cursedPlayers).toContain('p1');
  });
});

describe('Expansion 3: barking-kittens', () => {
  it('barkingKitten explodes the holder of the other barkingKitten (or makes them Defuse)', () => {
    const bk1 = card('barkingKitten');
    const bk2 = card('barkingKitten');
    const def = card('defuse');
    const s = rig({
      hands: { p0: [bk1], p1: [bk2, def], p2: [] },
    });
    const played = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [bk1.id] });
    expect(played.subPhase).toBe('awaitingDefuse');
    expect(played.activePlayerId).toBe('p1');

    const defused = applyAction(played, { type: 'playDefuse', playerId: 'p1', cardId: def.id });
    expect(defused.subPhase).toBe('awaitingAction');
    expect(defused.turnPlayerId).toBe('p0');
    expect(defused.hands.p1).toHaveLength(0);
  });

  it('Barking Kittens cannot be Noped', () => {
    const bk1 = card('barkingKitten');
    const s = rig({ hands: { p0: [bk1], p1: [card('barkingKitten'), card('nope')], p2: [card('nope')] } });
    const played = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [bk1.id] });
    expect(played.pending).toBeNull();
    expect(played.subPhase).not.toBe('awaitingNope');
  });

  it('a lone Barking Kitten nobody answers stays face up in front of you — and makes you the target', () => {
    const bk1 = card('barkingKitten');
    const bk2 = card('barkingKitten');
    const s = rig({ hands: { p0: [bk1], p1: [], p2: [] } });
    const lonely = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [bk1.id] });
    expect(lonely.barkingFaceUp?.p0?.id).toBe(bk1.id);
    expect(lonely.discard.some((c) => c.id === bk1.id)).toBe(false);
    // Later p1 draws the other and plays it: p0 is the target.
    const later: EkState = { ...lonely, hands: { ...lonely.hands, p1: [bk2] }, turnPlayerId: 'p1', activePlayerId: 'p1' };
    const hit = applyAction(later, { type: 'playCards', playerId: 'p1', cardIds: [bk2.id] });
    expect(hit.eliminated).toContain('p0');
  });

  it('both Barking Kittens together pick any target', () => {
    const bks = [card('barkingKitten'), card('barkingKitten')];
    const s = rig({ hands: { p0: bks, p1: [], p2: [card('defuse')] } });
    expect(() => applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: bks.map((c) => c.id) })).toThrow(/target/);
    const hit = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: bks.map((c) => c.id), targetPlayerId: 'p2' });
    expect(hit.subPhase).toBe('awaitingDefuse');
    expect(hit.activePlayerId).toBe('p2');
  });

  it('bury cannot be played with an I\'ll Take That in front of you', () => {
    const s = rig({
      hands: { p0: [card('bury')], p1: [], p2: [] },
      illTakeThat: { p0: { thiefId: 'p1', card: card('illTakeThat') } },
    });
    expect(() => applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] })).toThrow(/cannot be played/);
  });

  it("I'll Take That cannot go in front of a player who already has one", () => {
    const s = rig({
      hands: { p0: [card('illTakeThat')], p1: [], p2: [] },
      illTakeThat: { p1: { thiefId: 'p2', card: card('illTakeThat') } },
    });
    expect(() => applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id], targetPlayerId: 'p1' })).toThrow(/cannot be targeted/);
  });

  it('personal attack stacks with a following Attack: 3 + 2 = 5 (rulebook example)', () => {
    const s = rig({ hands: { p0: [card('personalAttack'), card('attack')], p1: [], p2: [] } });
    const pa = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(pa.turnsRemaining).toBe(3);
    const atk = applyAction(pa, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![1]!.id] });
    expect(atk.turnPlayerId).toBe('p1');
    expect(atk.turnsRemaining).toBe(5);
  });

  it('alterTheFutureNow can be played out of turn', () => {
    const nowCard = card('alterTheFutureNow');
    const s = rig({
      deck: [card('tacoCat'), card('skip'), card('explodingKitten')],
      hands: { p0: [], p1: [nowCard], p2: [] },
      turnPlayerId: 'p0',
      activePlayerId: 'p0',
    });
    const played = applyAction(s, { type: 'playCards', playerId: 'p1', cardIds: [nowCard.id] });
    expect(played.subPhase).toBe('awaitingFutureView');
    expect(played.activePlayerId).toBe('p1');

    const done = applyAction(played, { type: 'ackPeek', playerId: 'p1' });
    expect(done.subPhase).toBe('awaitingAction');
    expect(done.activePlayerId).toBe('p0');
  });

  it('bury draws top card into pendingBury and inserts it back into deck to end turn', () => {
    const top = card('explodingKitten');
    const s = rig({
      deck: [top, card('tacoCat'), card('beardCat')],
      hands: { p0: [card('bury')], p1: [], p2: [] },
    });
    const burying = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(burying.subPhase).toBe('awaitingBuryPlace');
    expect(burying.pendingBury?.id).toBe(top.id);

    const buried = applyAction(burying, { type: 'placeBury', playerId: 'p0', index: 2 });
    expect(buried.subPhase).toBe('awaitingAction');
    expect(buried.deck[2]!.id).toBe(top.id);
    expect(buried.turnPlayerId).toBe('p1');
  });

  it('personalAttack gives yourself 3 turns in a row', () => {
    const s = rig({
      hands: { p0: [card('personalAttack')], p1: [], p2: [] },
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.turnPlayerId).toBe('p0');
    expect(next.turnsRemaining).toBe(3);
  });

  it('shareTheFuture grants knownTopCount = 3 to both player and next player', () => {
    const s = rig({
      deck: [card('tacoCat'), card('skip'), card('beardCat')],
      hands: { p0: [card('shareTheFuture')], p1: [], p2: [] },
    });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    const shared = applyAction(opened, { type: 'ackPeek', playerId: 'p0' });
    expect(shared.knownTopCount.p0).toBe(3);
    expect(shared.knownTopCount.p1).toBe(3);
  });

  it('illTakeThat redirects the target players next drawn card to you', () => {
    const prize = card('defuse');
    const s = rig({
      deck: [card('tacoCat'), prize],
      hands: { p0: [card('illTakeThat')], p1: [], p2: [] },
    });
    const played = applyAction(s, {
      type: 'playCards',
      playerId: 'p0',
      cardIds: [s.hands.p0![0]!.id],
      targetPlayerId: 'p1',
    });
    // p0 ends turn by drawing tacoCat
    const p0Drawn = applyAction(played, { type: 'drawCard', playerId: 'p0' });
    expect(p0Drawn.turnPlayerId).toBe('p1');

    // p1 draws prize, which is redirected to p0!
    const p1Drawn = applyAction(p0Drawn, { type: 'drawCard', playerId: 'p1' });
    expect(p1Drawn.hands.p0!.some((c) => c.id === prize.id)).toBe(true);
    expect(p1Drawn.hands.p1).toHaveLength(0);
    expect(p1Drawn.turnPlayerId).toBe('p2');
  });

  it('potluck makes each player put 1 card on top of the deck in turn order', () => {
    const c0 = card('tacoCat');
    const c1 = card('beardCat');
    const s = rig({
      deck: [card('skip')],
      hands: { p0: [card('potluck'), c0], p1: [c1], p2: [] },
    });
    const opened = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(opened.subPhase).toBe('awaitingPotluckPick');
    const step1 = applyAction(opened, { type: 'potluckPick', playerId: 'p0', cardId: c0.id });
    const step2 = applyAction(step1, { type: 'potluckPick', playerId: 'p1', cardId: c1.id });
    expect(step2.subPhase).toBe('awaitingAction');
    expect(step2.deck[0]!.id).toBe(c1.id);
    expect(step2.deck[1]!.id).toBe(c0.id);
  });

  it('deals the 6-card Stash at setup, before the hands', () => {
    const s = newGame(4, { expansions: ['barking-kittens'] });
    expect(s.stash).toHaveLength(6);
    expect(s.stash!.some((c) => c.kind === 'explodingKitten' || c.kind === 'towerOfPower')).toBe(false);
    const total = s.deck.length + s.stash!.length + Object.values(s.hands).flat().length;
    // 56 + 20 − unused kittens (4 − 3) − boxed Defuses (6 − 4 − 2 spares = 0).
    expect(total).toBe(56 + 20 - 1);
  });

  it('a three of a kind on the Crown wearer takes a RANDOM Crown card, not the named one', () => {
    const crown = [card('tacoCat'), card('tacoCat'), card('tacoCat')];
    const s = rig({
      hands: { p0: [card('skip'), card('skip'), card('skip')], p1: [card('defuse')], p2: [] },
      towerStash: { p1: crown },
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: s.hands.p0!.map((c) => c.id), targetPlayerId: 'p1', demandKind: 'defuse' });
    expect(next.hands.p1!.map((c) => c.kind)).toEqual(['defuse']);
    expect(next.hands.p0!.map((c) => c.kind)).toEqual(['tacoCat']);
    expect(next.towerStash!.p1).toHaveLength(2);
  });

  it('towerOfPower takes the Stash into the Crown, which absorbs steals', () => {
    const precious = card('defuse');
    const stash = Array.from({ length: 6 }, () => card('tacoCat'));
    const s = rig({
      hands: { p0: [card('towerOfPower'), precious], p1: [card('favor')], p2: [] },
      stash,
    });
    const crowned = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(crowned.towerStash?.p0?.map((c) => c.id)).toEqual(stash.map((c) => c.id));
    expect(crowned.stash).toEqual([]);

    // End p0 turn
    crowned.deck.unshift(card('tacoCat'));
    const p1Turn = applyAction(crowned, { type: 'drawCard', playerId: 'p0' });
    const afterFavor = applyAction(p1Turn, {
      type: 'playCards',
      playerId: 'p1',
      cardIds: [p1Turn.hands.p1![0]!.id],
      targetPlayerId: 'p0',
    });
    // Favor took from p0's towerStash instead of p0's hand!
    expect(afterFavor.towerStash?.p0).toHaveLength(5);
    expect(afterFavor.hands.p0!.some((c) => c.id === precious.id)).toBe(true);
    expect(afterFavor.hands.p1).toHaveLength(1);
  });
});

describe('Expansion 4: zombie-kittens', () => {
  const ZOMBIE: EkConfig = { ...CONFIG, expansions: ['zombie-kittens'] };

  it('replaces the Defuses with one Zombie Kitten each, and has 22 cards', async () => {
    const { ZOMBIE_DECK_COUNTS } = await import('./cards');
    expect(Object.values(ZOMBIE_DECK_COUNTS).reduce((a, b) => a + b, 0)).toBe(22);
    const s = newGame(4, { expansions: ['zombie-kittens'] });
    const all = [...s.deck, ...Object.values(s.hands).flat()];
    expect(all.filter((c) => c.kind === 'defuse')).toHaveLength(0);
    expect(all.filter((c) => c.kind === 'zombieKitten')).toHaveLength(4);
    for (const seat of s.seats) expect(s.hands[seat.id]!.filter((c) => c.kind === 'zombieKitten')).toHaveLength(1);
  });

  it('with 2 players, leaves out Attack of the Dead, Grave Robber, Feed the Dead and Super Skip', () => {
    const s = newGame(2, { expansions: ['zombie-kittens'] });
    const all = [...s.deck, ...Object.values(s.hands).flat()];
    for (const k of ['attackOfTheDead', 'graveRobber', 'feedTheDead', 'superSkip'] as const) {
      expect(all.some((c) => c.kind === k), k).toBe(false);
    }
  });

  it('the dead keep their hand and their kitten lies in front of them', () => {
    const s = rig({
      deck: [card('explodingKitten'), card('tacoCat')],
      hands: { p0: [card('nope'), card('skip')], p1: [], p2: [] },
      config: ZOMBIE,
    });
    const dead = applyAction(s, { type: 'drawCard', playerId: 'p0' });
    expect(dead.eliminated).toEqual(['p0']);
    expect(dead.hands.p0).toHaveLength(2);
    expect(dead.deadKittens.p0).toHaveLength(1);
    // ...and can still Nope from beyond the grave.
    const s2: EkState = { ...dead, hands: { ...dead.hands, p1: [card('skip')] } };
    const played = applyAction(s2, { type: 'playCards', playerId: 'p1', cardIds: [s2.hands.p1![0]!.id] });
    expect(played.subPhase).toBe('awaitingNope');
    expect(played.activePlayerId).toBe('p0');
  });

  it('playing a Zombie Kitten is optional', () => {
    const s = rig({
      subPhase: 'awaitingDefuse',
      pendingKitten: card('explodingKitten'),
      hands: { p0: [card('zombieKitten')], p1: [], p2: [] },
      config: ZOMBIE,
    });
    const died = applyAction(s, { type: 'declineDefuse', playerId: 'p0' });
    expect(died.eliminated).toEqual(['p0']);
    expect(died.hands.p0).toHaveLength(1);
    expect(() => applyAction({ ...s, config: CONFIG }, { type: 'declineDefuse', playerId: 'p0' })).toThrow(/Zombie/);
  });

  it('a Zombie Kitten must revive a chosen dead player, who keeps their hand, and both kittens are hidden one by one', () => {
    const zk = card('zombieKitten');
    const theirKitten = card('explodingKitten');
    const s = rig({
      subPhase: 'awaitingDefuse',
      pendingKitten: card('explodingKitten'),
      deck: [card('tacoCat'), card('skip'), card('beardCat')],
      hands: { p0: [zk], p1: [], p2: [card('nope')] },
      eliminated: ['p2'],
      deadKittens: { p2: [theirKitten] },
      config: ZOMBIE,
    });
    expect(() => applyAction({ ...s, eliminated: ['p1', 'p2'] }, { type: 'playDefuse', playerId: 'p0', cardId: zk.id })).toThrow(/bring back/);
    const revived = applyAction(s, { type: 'playDefuse', playerId: 'p0', cardId: zk.id, targetPlayerId: 'p2' });
    expect(revived.subPhase).toBe('awaitingKittenPlace');
    expect(revived.eliminated).not.toContain('p2');
    expect(revived.hands.p2!.map((c) => c.kind)).toEqual(['nope']);
    const first = applyAction(revived, { type: 'placeKitten', playerId: 'p0', index: 0 });
    expect(first.subPhase).toBe('awaitingKittenPlace');
    expect(first.pendingKitten?.id).toBe(theirKitten.id);
    const second = applyAction(first, { type: 'placeKitten', playerId: 'p0', index: 3 });
    expect(second.deck.filter((c) => c.kind === 'explodingKitten')).toHaveLength(2);
    expect(second.deck[0]!.kind).toBe('explodingKitten');
    expect(second.turnPlayerId).toBe('p1');
  });

  it('clairvoyance holders may watch where a Zombie Kitten\'s kittens go', () => {
    const zk = card('zombieKitten');
    const s = rig({
      subPhase: 'awaitingDefuse',
      pendingKitten: card('explodingKitten'),
      deck: [card('tacoCat'), card('skip'), card('beardCat'), card('cattermelon')],
      hands: { p0: [zk], p1: [card('clairvoyance')], p2: [] },
      config: ZOMBIE,
    });
    const defused = applyAction(s, { type: 'playDefuse', playerId: 'p0', cardId: zk.id });
    expect(defused.subPhase).toBe('awaitingClairvoyance');
    expect(defused.activePlayerId).toBe('p1');
    const watching = applyAction(defused, { type: 'playClairvoyance', playerId: 'p1', cardId: s.hands.p1![0]!.id });
    expect(watching.subPhase).toBe('awaitingKittenPlace');
    const placed = applyAction(watching, { type: 'placeKitten', playerId: 'p0', index: 2 });
    expect(sightedKittens(placed, 'p1').map((x) => x.index)).toEqual([2]);
    expect(sightedKittens(placed, 'p2')).toEqual([]);
    // Two draws later it is on top, and the watcher knows it.
    const d1 = applyAction(placed, { type: 'drawCard', playerId: 'p1' });
    const d2 = applyAction(d1, { type: 'drawCard', playerId: 'p2' });
    expect(knownTopCards(d2, 'p1')[0]?.kind).toBe('explodingKitten');
    expect(drawDanger(d2, 'p1')).toBe(1);
    expect(knownTopCards(d2, 'p2')).toEqual([]);
  });

  it('a plain Defuse opens no Clairvoyance window, and Clairvoyance is not a turn action', () => {
    const s = rig({ hands: { p0: [card('clairvoyance')], p1: [], p2: [] }, config: ZOMBIE });
    expect(() => applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] })).toThrow(/Zombie Kitten/);
  });

  it('dig deeper: look at the top card, keep it and end the turn', () => {
    const top = card('skip');
    const s = rig({ deck: [top, card('explodingKitten'), card('tacoCat')], hands: { p0: [card('digDeeper')], p1: [], p2: [] }, config: ZOMBIE });
    const digging = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(digging.subPhase).toBe('awaitingDigDeeper');
    expect(digging.pendingDigDeeper?.card.id).toBe(top.id);
    const kept = applyAction(digging, { type: 'pickDigDeeper', playerId: 'p0', keep: true });
    expect(kept.hands.p0!.map((c) => c.id)).toEqual([top.id]);
    expect(kept.turnPlayerId).toBe('p1');
  });

  it('dig deeper: put it back and you MUST draw the next card, whatever it is', () => {
    const top = card('explodingKitten');
    const next = card('tacoCat');
    const s = rig({ deck: [top, next, card('skip')], hands: { p0: [card('digDeeper')], p1: [], p2: [] }, config: ZOMBIE });
    const digging = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    const passed = applyAction(digging, { type: 'pickDigDeeper', playerId: 'p0', keep: false });
    expect(passed.hands.p0!.map((c) => c.id)).toEqual([next.id]);
    expect(passed.deck[0]!.id).toBe(top.id);
    expect(passed.knownTopCount.p0).toBe(1);
    expect(passed.turnPlayerId).toBe('p1');
  });

  it('dig deeper has no effect with one card left in the deck', () => {
    const s = rig({ deck: [card('tacoCat')], hands: { p0: [card('digDeeper')], p1: [], p2: [] }, config: ZOMBIE });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.subPhase).toBe('awaitingAction');
    expect(next.turnPlayerId).toBe('p0');
    expect(next.deck).toHaveLength(1);
  });

  it('clone becomes the card directly beneath it — not one further down', () => {
    const s = rig({
      discard: [card('skip')],
      hands: { p0: [card('clone')], p1: [], p2: [] },
      config: ZOMBIE,
    });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [s.hands.p0![0]!.id] });
    expect(next.turnPlayerId).toBe('p1');
    // A cat on top cannot be cloned alone, even with an action card under it.
    const onCat = rig({ discard: [card('skip'), card('tacoCat')], hands: { p0: [card('clone')], p1: [], p2: [] }, config: ZOMBIE });
    expect(() => applyAction(onCat, { type: 'playCards', playerId: 'p0', cardIds: [onCat.hands.p0![0]!.id] })).toThrow(/Clone/);
  });

  it('clone + a cat card is a pair', () => {
    const s = rig({ hands: { p0: [card('tacoCat'), card('clone')], p1: [card('skip')], p2: [] }, config: ZOMBIE });
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: s.hands.p0!.map((c) => c.id), targetPlayerId: 'p1' });
    expect(next.hands.p0!.map((c) => c.kind)).toEqual(['skip']);
  });

  it('clone on top of a Zombie Kitten works as one', () => {
    const clone = card('clone');
    const s = rig({
      subPhase: 'awaitingDefuse',
      pendingKitten: card('explodingKitten'),
      discard: [card('zombieKitten')],
      hands: { p0: [clone], p1: [], p2: [] },
      config: ZOMBIE,
    });
    const next = applyAction(s, { type: 'playDefuse', playerId: 'p0', cardId: clone.id });
    expect(next.subPhase).toBe('awaitingKittenPlace');
  });

  it('attack of the dead: 3 turns per dead player, and only with someone dead', () => {
    const aotd = card('attackOfTheDead');
    const none = rig({ hands: { p0: [aotd], p1: [], p2: [], p3: [] }, config: ZOMBIE }, 4);
    expect(() => applyAction(none, { type: 'playCards', playerId: 'p0', cardIds: [aotd.id] })).toThrow(/cannot be played/);
    const s = rig({ hands: { p0: [aotd], p1: [], p2: [], p3: [] }, eliminated: ['p2', 'p3'], config: ZOMBIE }, 4);
    const next = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [aotd.id] });
    expect(next.turnPlayerId).toBe('p1');
    expect(next.turnsRemaining).toBe(6);
  });

  it('feed the dead: every living player but you gives the chosen dead player a card', () => {
    const feed = card('feedTheDead');
    const gift = card('tacoCat');
    const s = rig({
      hands: { p0: [feed], p1: [gift], p2: [card('skip')] },
      eliminated: ['p2'],
      config: ZOMBIE,
    });
    const open = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [feed.id], targetPlayerId: 'p2' });
    expect(open.subPhase).toBe('awaitingDonation');
    expect(open.activePlayerId).toBe('p1');
    const done = applyAction(open, { type: 'donateCard', playerId: 'p1', cardId: gift.id });
    expect(done.hands.p2!.map((c) => c.id)).toContain(gift.id);
    expect(done.subPhase).toBe('awaitingAction');
  });

  it('feed the dead is a NOW card a dead player may play, even on themselves', () => {
    const feed = card('feedTheDead');
    const s = rig({ hands: { p0: [card('tacoCat')], p1: [card('skip')], p2: [feed] }, eliminated: ['p2'], config: ZOMBIE });
    const open = applyAction(s, { type: 'playCards', playerId: 'p2', cardIds: [feed.id], targetPlayerId: 'p2' });
    expect(open.subPhase).toBe('awaitingDonation');
    expect(open.pendingDonation?.queue).toEqual(['p0', 'p1']);
  });

  it('grave robber: each dead player with cards shuffles one into the deck', () => {
    const gr = card('graveRobber');
    const bone = card('beardCat');
    const s = rig({
      deck: [card('tacoCat')],
      hands: { p0: [gr], p1: [], p2: [bone] },
      eliminated: ['p2'],
      config: ZOMBIE,
    });
    const open = applyAction(s, { type: 'playCards', playerId: 'p0', cardIds: [gr.id] });
    expect(open.subPhase).toBe('awaitingDonation');
    expect(open.activePlayerId).toBe('p2');
    const done = applyAction(open, { type: 'donateCard', playerId: 'p2', cardId: bone.id });
    expect(done.deck).toHaveLength(2);
    expect(done.deck.some((c) => c.id === bone.id)).toBe(true);
  });

  it('caps the table at 5 (five Zombie Kittens, one each)', async () => {
    const { explodingKittensModule } = await import('./module');
    expect(explodingKittensModule.validateConfig(ZOMBIE, seats(5))).toEqual([]);
    expect(explodingKittensModule.validateConfig({ ...ZOMBIE, expansions: ['zombie-kittens', 'imploding-kittens'] }, seats(6)).length).toBeGreaterThan(0);
  });
});

describe('Expansions 5 & 6: party-pack and recipes-for-disaster', () => {
  it('party-pack is a 120-card core deck', async () => {
    const { PARTY_PACK_COUNTS } = await import('./cards');
    const total = Object.values(PARTY_PACK_COUNTS).reduce((sum, c) => sum + c[0] + c[1], 0);
    expect(total).toBe(120);
  });

  it('party-pack: 8–10 players use every card; no Imploding Kitten in the box', () => {
    const s = newGame(8, { expansions: ['party-pack'] });
    expect(s.seats).toHaveLength(8);
    expect(s.deck.filter((c) => c.kind === 'explodingKitten')).toHaveLength(7);
    expect(s.deck.filter((c) => c.kind === 'implodingKitten')).toHaveLength(0);
    // 120 − 2 unused kittens; every spare Defuse goes back in.
    const all = [...s.deck, ...Object.values(s.hands).flat()];
    expect(all).toHaveLength(118);
    expect(all.filter((c) => c.kind === 'defuse')).toHaveLength(10);
  });

  it('party-pack: 2–3 players use only the paw-print cards; 4–7 only the others', () => {
    const small = newGame(3, { expansions: ['party-pack'] });
    const smallAll = [...small.deck, ...Object.values(small.hands).flat()];
    expect(smallAll.filter((c) => c.kind === 'defuse')).toHaveLength(3);
    expect(smallAll.filter((c) => c.kind === 'tacoCat')).toHaveLength(3);
    expect(smallAll).toHaveLength(45 + 2);
    const mid = newGame(5, { expansions: ['party-pack'] });
    const midAll = [...mid.deck, ...Object.values(mid.hands).flat()];
    expect(midAll.filter((c) => c.kind === 'defuse')).toHaveLength(7);
    expect(midAll).toHaveLength(66 + 4);
  });

  it('recipes-for-disaster combines cards from Base, Imploding, Streaking, and Barking', () => {
    const s = newGame(5, { expansions: ['recipes-for-disaster'] });
    const allCards = [...s.deck, ...Object.values(s.hands).flat()];
    expect(allCards.some((c) => c.kind === 'implodingKitten')).toBe(true);
    expect(allCards.some((c) => c.kind === 'streakingKitten')).toBe(true);
    expect(allCards.some((c) => c.kind === 'barkingKitten')).toBe(true);
  });
});
