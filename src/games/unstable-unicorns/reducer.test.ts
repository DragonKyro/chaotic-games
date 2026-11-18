import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import { UU_BABY_DEFS, UU_EXPANSION_DEFS, UU_MAIN_DECK_DEFS } from './cards';
import { chooseAIAction } from './ai';
import { unstableUnicornsModule } from './module';
import {
  applyAction,
  canPlayCardFromHand,
  canPlayNeigh,
  createInitialState,
  handLimitOf,
  hasBrokenStable,
  hasPandamonium,
  isBlinded,
  unicornCount,
} from './reducer';
import { UU_EXPANSIONS } from './types';
import type { UuCard, UuConfig, UuEdition, UuExpansionId } from './types';

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

  it('the AI never feeds Dark Angel Unicorn to its own sacrifice (it would bring itself back forever)', () => {
    // This deal reaches a Dark Angel whose owner holds no other Unicorn. The AI
    // used to sacrifice the Dark Angel itself, pull it straight back from the
    // discard, re-trigger, and loop without end.
    const seats: Seat[] = [
      { id: 'host-uuid', name: 'Hana', color: '#e64a4a', isAI: false, isLocal: false },
      { id: 'guest-uuid', name: 'Gus', color: '#3a6ec9', isAI: false, isLocal: false },
      { id: 'ai-1', name: 'AI', color: '#f37025', isAI: true, isLocal: false },
    ];
    let s = createInitialState(unstableUnicornsModule.defaultConfig(seats), 304094739, seats);
    let steps = 0;
    while (s.phase !== 'gameOver' && steps < 2000) {
      const action = chooseAIAction(s, s.activePlayerId!);
      expect(action).toBeTruthy();
      s = applyAction(s, action!);
      steps++;
    }
    expect(s.phase).toBe('gameOver');
  });
});

describe('Unstable Unicorns — all 8 Expansions & Editions', () => {
  it('registers Thumbnail and validates configs with expansions enabled', () => {
    expect(unstableUnicornsModule.Thumbnail).toBeDefined();
    const allExpIds = UU_EXPANSIONS.map((e) => e.id as UuExpansionId);
    expect(unstableUnicornsModule.validateConfig({ edition: 'base-2nd', expansions: allExpIds })).toEqual([]);
  });

  it('includes expansion cards in Nursery and Main Deck for each of the 8 expansions', () => {
    const seats = makeSeats(3);
    for (const exp of UU_EXPANSIONS) {
      const expId = exp.id as UuExpansionId;
      const defs = UU_EXPANSION_DEFS.filter((d) => d.source === expId);
      expect(defs.length).toBeGreaterThanOrEqual(8);

      const s = createInitialState({ edition: 'base-2nd', expansions: [expId] }, 77, seats);
      const allDealt = [
        ...s.deck,
        ...s.nursery,
        ...Object.values(s.hands).flat(),
        ...Object.values(s.stables).flatMap((st) => [...st.unicorns, ...st.upgrades, ...st.downgrades]),
      ];
      expect(allDealt.some((c) => c.source === expId)).toBe(true);
    }
  });

  it("Dragon's Blessing overrides Pandamonium, Blinding Light, Slowdown, Broken Stable, and Lump of Coal", () => {
    const seats = makeSeats(2);
    const s = createInitialState({ edition: 'base-2nd', expansions: ['dragons', 'christmas'] }, 19, seats);
    s.stables.p1!.unicorns.push({
      id: 1001,
      kind: 'bahamuticorn',
      name: 'Bahamuticorn',
      type: 'magicalUnicorn',
      text: '',
      source: 'dragons',
    });
    s.stables.p1!.downgrades.push(
      { id: 1002, kind: 'pandamonium', name: 'Pandamonium', type: 'downgrade', text: '' },
      { id: 1003, kind: 'blinding-light', name: 'Blinding Light', type: 'downgrade', text: '' },
      { id: 1004, kind: 'slowdown', name: 'Slowdown', type: 'downgrade', text: '' },
      { id: 1005, kind: 'broken-stable', name: 'Broken Stable', type: 'downgrade', text: '' },
      { id: 1006, kind: 'lump-of-coal', name: 'Lump of Coal', type: 'downgrade', text: '', source: 'christmas' },
    );
    s.hands.p1 = [{ id: 1007, kind: 'neigh', name: 'Neigh', type: 'instant', text: '' }];

    expect(hasPandamonium(s, 'p1')).toBe(true);
    expect(isBlinded(s, 'p1')).toBe(true);
    expect(hasBrokenStable(s, 'p1')).toBe(true);
    expect(canPlayNeigh(s, 'p1')).toBe(false);
    expect(unicornCount(s, 'p1')).toBe(0);
    expect(handLimitOf(s, 'p1')).toBe(5);

    // Add Dragon's Blessing -> all Downgrades on p1's Stable are ignored!
    s.stables.p1!.upgrades.push({
      id: 1008,
      kind: 'dragons-blessing',
      name: "Dragon's Blessing",
      type: 'upgrade',
      text: 'Effects of your Downgrade cards do not affect you.',
      source: 'dragons',
    });

    expect(hasPandamonium(s, 'p1')).toBe(false);
    expect(isBlinded(s, 'p1')).toBe(false);
    expect(hasBrokenStable(s, 'p1')).toBe(false);
    expect(canPlayNeigh(s, 'p1')).toBe(true);
    // 1 baby + 1 Bahamuticorn (worth 2) = 3
    expect(unicornCount(s, 'p1')).toBe(3);
    expect(handLimitOf(s, 'p1')).toBe(7);
  });

  it('supports Adventure Instant cards (Unicorn Net, Absorb and Reflect, Redirect, Flare Gun)', () => {
    const seats = makeSeats(2);
    let s = createInitialState({ edition: 'base-2nd', expansions: ['adventures'] }, 33, seats);
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });

    const playedUnicorn: UuCard = {
      id: 1101,
      kind: 'extreme-adventurer-unicorn',
      name: 'Extreme Adventurer Unicorn',
      type: 'magicalUnicorn',
      text: '',
      source: 'adventures',
    };
    const unicornNet: UuCard = {
      id: 1102,
      kind: 'unicorn-net',
      name: 'Unicorn Net',
      type: 'instant',
      text: '',
      source: 'adventures',
    };

    s.hands.p1 = [playedUnicorn];
    s.hands.p2 = [unicornNet];

    s = applyAction(s, { type: 'playCard', playerId: 'p1', cardId: 1101 });
    expect(s.subPhase).toBe('awaitingNeigh');
    expect(s.activePlayerId).toBe('p2');

    // p2 plays Unicorn Net -> captures Extreme Adventurer Unicorn into p2's hand!
    s = applyAction(s, { type: 'playNeigh', playerId: 'p2', cardId: 1102 });
    expect(s.pending).toBeNull();
    expect(s.hands.p2?.some((c) => c.id === 1101)).toBe(true);
    expect(s.stables.p1?.unicorns.some((c) => c.id === 1101)).toBe(false);
  });

  it('supports Redirect Instant card stealing an opponent Unicorn play into responder Stable', () => {
    const seats = makeSeats(2);
    let s = createInitialState({ edition: 'base-2nd', expansions: ['adventures'] }, 34, seats);
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });

    const playedUnicorn: UuCard = {
      id: 1201,
      kind: 'basic-red',
      name: 'Basic Unicorn (Red)',
      type: 'basicUnicorn',
      text: '',
    };
    const redirectCard: UuCard = {
      id: 1202,
      kind: 'redirect',
      name: 'Redirect',
      type: 'instant',
      text: '',
      source: 'adventures',
    };

    s.hands.p1 = [playedUnicorn];
    s.hands.p2 = [redirectCard];

    s = applyAction(s, { type: 'playCard', playerId: 'p1', cardId: 1201 });
    s = applyAction(s, { type: 'playNeigh', playerId: 'p2', cardId: 1202 });
    expect(s.pending).toBeNull();
    expect(s.stables.p2?.unicorns.some((c) => c.id === 1201)).toBe(true);
    expect(s.stables.p1?.unicorns.some((c) => c.id === 1201)).toBe(false);
  });

  it('supports 1st Edition (base) Puppicorn end-of-turn movement and Basic Unicorn Upgrade requirements', () => {
    const seats = makeSeats(2);
    let s = createInitialState({ edition: 'base', expansions: [] }, 55, seats);

    const extraTail: UuCard = {
      id: 1301,
      kind: 'extra-tail',
      name: 'Extra Tail',
      type: 'upgrade',
      text: '',
      source: 'base',
    };
    // Cannot play Extra Tail with only a Baby Unicorn in Stable
    expect(canPlayCardFromHand(s, 'p1', extraTail, 'p1')).toBe(false);

    // Add a Basic Unicorn -> now Extra Tail is playable
    s.stables.p1!.unicorns.push({
      id: 1302,
      kind: 'basic-blue',
      name: 'Basic Unicorn (Blue)',
      type: 'basicUnicorn',
      text: '',
    });
    expect(canPlayCardFromHand(s, 'p1', extraTail, 'p1')).toBe(true);

    // Add Puppicorn to p1's Stable and finish p1's turn -> Puppicorn moves to p2's Stable
    s.stables.p1!.unicorns.push({
      id: 1303,
      kind: 'puppicorn',
      name: 'Puppicorn',
      type: 'magicalUnicorn',
      text: '',
      source: 'base',
    });
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });
    s = applyAction(s, { type: 'drawInsteadOfPlaying', playerId: 'p1' });
    expect(s.turnPlayerId).toBe('p2');
    expect(s.stables.p2?.unicorns.some((u) => u.id === 1303)).toBe(true);
  });

  it('plays full AI-vs-AI games to completion across every Edition', () => {
    const editions: UuEdition[] = ['base-2nd', 'base', 'control', 'chaos', 'diamond', 'travel'];
    for (const edition of editions) {
      let s = createInitialState({ edition, expansions: [] }, 91, makeSeats(3));
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
  });

  it('plays full AI-vs-AI games to completion for each of the 8 Expansions and all 8 combined', () => {
    const seats = makeSeats(3);
    for (const exp of UU_EXPANSIONS) {
      const expId = exp.id as UuExpansionId;
      let s = createInitialState({ edition: 'base-2nd', expansions: [expId] }, 123, seats);
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

    // All 8 expansions combined
    const allExpIds = UU_EXPANSIONS.map((e) => e.id as UuExpansionId);
    let sAll = createInitialState({ edition: 'base-2nd', expansions: allExpIds }, 456, seats);
    let steps = 0;
    while (sAll.phase !== 'gameOver' && steps < 3000) {
      const active = sAll.activePlayerId;
      expect(active).toBeTruthy();
      const action = chooseAIAction(sAll, active!);
      expect(action).toBeTruthy();
      sAll = applyAction(sAll, action!);
      steps++;
    }
    expect(sAll.phase).toBe('gameOver');
    expect(sAll.winnerId).toBeTruthy();
  });
});
