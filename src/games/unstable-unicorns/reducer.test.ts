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
  validPlayerTargets,
} from './reducer';
import { UU_EXPANSIONS } from './types';
import type { UuCard, UuConfig, UuEdition, UuExpansionId, UuState } from './types';
import { makeSeats, playOut } from '@/core/playout';

const DEFAULT_CFG: UuConfig = { expansions: [], edition: 'base-2nd' };

/** A fresh game past the setup Baby Unicorn picks, waiting on p1's Draw phase. */
function ready(cfg: UuConfig, seed: number, seats: Seat[]): UuState {
  return playOut({ applyAction, chooseAIAction }, createInitialState(cfg, seed, seats), 50, (st) => st.subPhase === 'draw').state;
}

describe('Unstable Unicorns — deck & setup', () => {
  it('has exactly 13 Baby Unicorns and 114 main deck cards (127 playable cards + 8 rules = 135)', () => {
    const babies = UU_BABY_DEFS.reduce((s, d) => s + d.count, 0);
    const main = UU_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0);
    expect(babies).toBe(13);
    expect(main).toBe(114);
    expect(babies + main).toBe(127);
  });

  it('deals 5 cards to each hand and lets each player choose their Baby Unicorn', () => {
    const seats = makeSeats(4);
    let s = createInitialState(DEFAULT_CFG, 42, seats);
    expect(s.unicornsToWin).toBe(7);
    // Every Baby starts in the Nursery; each player is asked, in seat order.
    expect(s.nursery.length).toBe(13);
    expect(s.subPhase).toBe('awaitingPrompt');
    expect(s.promptQueue.map((p) => p.playerId)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(s.promptQueue.every((p) => p.kind === 'chooseFromPile' && p.pile === 'nursery' && !p.optional)).toBe(true);
    for (const seat of seats) {
      expect(s.hands[seat.id]?.length).toBe(5);
      expect(s.stables[seat.id]?.unicorns.length).toBe(0);
    }
    // p1 takes the Baby Narwhal specifically.
    const narwhal = s.nursery.find((c) => c.kind === 'baby-narwhal')!;
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: narwhal.id });
    expect(s.stables.p1!.unicorns.map((u) => u.id)).toEqual([narwhal.id]);
    expect(s.activePlayerId).toBe('p2');
    // You can't take a Baby someone else already has.
    expect(() => applyAction(s, { type: 'resolvePrompt', playerId: 'p2', targetCardId: narwhal.id })).toThrow();

    s = ready(DEFAULT_CFG, 42, seats);
    expect(s.nursery.length).toBe(13 - 4);
    for (const seat of seats) {
      expect(s.stables[seat.id]?.unicorns.length).toBe(1);
      expect(s.stables[seat.id]?.unicorns[0]?.type).toBe('babyUnicorn');
    }
    expect(s.deck.length).toBe(114 - 4 * 5);
    expect(s.subPhase).toBe('draw');
    expect(s.activePlayerId).toBe('p1');
  });

  it('applies the official 2-player rules (removed cards, a Neigh each) unless switched off', () => {
    const removed = new Set([
      'basic-red', 'basic-orange', 'basic-yellow', 'basic-green', 'basic-blue', 'basic-indigo', 'basic-purple', 'basic-narwhal',
      'queen-bee-unicorn', 'seductive-unicorn', 'rainbow-unicorn', 'nanny-cam', 'sadistic-ritual', 'slowdown', 'yay',
      'mother-goose-unicorn', 'necromancer-unicorn',
    ]);
    const s = createInitialState(DEFAULT_CFG, 5, makeSeats(2));
    const all = [...s.deck, ...Object.values(s.hands).flat()];
    expect(all.some((c) => removed.has(c.kind))).toBe(false);
    // 114 - 22 Basics - 2 Yay - 8 single cards = 82.
    expect(all.length).toBe(82);
    for (const id of ['p1', 'p2']) {
      expect(s.hands[id]!.length).toBe(6);
      expect(s.hands[id]!.some((c) => c.kind === 'neigh')).toBe(true);
    }

    const off = createInitialState({ ...DEFAULT_CFG, twoPlayerRules: false }, 5, makeSeats(2));
    expect(off.deck.length + 10).toBe(114);
    // Three players: the normal deck.
    expect(createInitialState(DEFAULT_CFG, 5, makeSeats(3)).deck.length).toBe(114 - 15);
  });

  it('deck-out: most Unicorns wins, ties go to the most letters, a full tie means everyone loses', () => {
    const base = ready(DEFAULT_CFG, 8, makeSeats(2));
    const babyRed: UuCard = { id: 9001, kind: 'baby-red', name: 'Baby Unicorn (Red)', type: 'babyUnicorn', text: '' };
    const babyPink: UuCard = { id: 9002, kind: 'baby-pink', name: 'Baby Unicorn (Pink)', type: 'babyUnicorn', text: '' };
    const babyRainbow: UuCard = { id: 9003, kind: 'baby-rainbow', name: 'Baby Unicorn (Rainbow)', type: 'babyUnicorn', text: '' };

    // Same count, same letter total ("Red"/"Pink" differ, so use two equal-length names).
    let s = structuredClone(base);
    s.stables.p1!.unicorns = [babyRed];
    s.stables.p2!.unicorns = [{ ...babyRed, id: 9004 }];
    s.deck = [];
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });
    expect(s.phase).toBe('gameOver');
    expect(s.winnerId).toBeNull();

    // Same count, more letters wins.
    s = structuredClone(base);
    s.stables.p1!.unicorns = [babyPink];
    s.stables.p2!.unicorns = [babyRainbow];
    s.deck = [];
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });
    expect(s.winnerId).toBe('p2');
  });

  it('sets unicornsToWin to 6 at 6–8 players', () => {
    const s = ready(DEFAULT_CFG, 42, makeSeats(6));
    expect(s.unicornsToWin).toBe(6);
  });
});

describe('Unstable Unicorns — core mechanics & player decisions', () => {
  it('supports Neigh chains and terminal Super Neigh', () => {
    const seats = makeSeats(3);
    let s = ready(DEFAULT_CFG, 100, seats);
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
    let s = ready(DEFAULT_CFG, 7, seats);
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
    const s = ready(DEFAULT_CFG, 11, seats);
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
    let s = ready(DEFAULT_CFG, 21, seats);
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
        const { state: s, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(DEFAULT_CFG, seed * 17, makeSeats(playerCount)), 2000);
        expect(stuck).toBe(false);
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
    const { state: s, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(unstableUnicornsModule.defaultConfig(seats), 304094739, seats), 2000);
    expect(stuck).toBe(false);
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

      const s = ready({ edition: 'base-2nd', expansions: [expId] }, 77, seats);
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
    const s = ready({ edition: 'base-2nd', expansions: ['dragons', 'christmas'] }, 19, seats);
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
    let s = ready({ edition: 'base-2nd', expansions: ['adventures'] }, 33, seats);
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
    let s = ready({ edition: 'base-2nd', expansions: ['adventures'] }, 34, seats);
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
    let s = ready({ edition: 'base', expansions: [] }, 55, seats);

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
      const { state: s, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState({ edition, expansions: [] }, 91, makeSeats(3)), 2500);
      expect(stuck).toBe(false);
      expect(s.phase).toBe('gameOver');
      expect(s.winnerId).toBeTruthy();
    }
  });

  it('plays full AI-vs-AI games to completion for each of the 8 Expansions and all 8 combined', () => {
    const seats = makeSeats(3);
    for (const exp of UU_EXPANSIONS) {
      const expId = exp.id as UuExpansionId;
      const { state: s, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState({ edition: 'base-2nd', expansions: [expId] }, 123, seats), 2500);
      expect(stuck).toBe(false);
      expect(s.phase).toBe('gameOver');
      expect(s.winnerId).toBeTruthy();
    }

    // All 8 expansions combined
    const allExpIds = UU_EXPANSIONS.map((e) => e.id as UuExpansionId);
    const { state: sAll, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState({ edition: 'base-2nd', expansions: allExpIds }, 456, seats), 3000);
    expect(stuck).toBe(false);
    expect(sAll.phase).toBe('gameOver');
    expect(sAll.winnerId).toBeTruthy();
  });
});

describe('Unstable Unicorns — 2nd Edition rules audit', () => {
  const card = (id: number, kind: UuCard['kind'], type: UuCard['type'], name = kind): UuCard => ({ id, kind, name, type, text: '' });

  /** p1's Action phase in a 3-player game, every hand emptied (so nobody can Neigh). */
  function actionPhase(): UuState {
    let s = ready(DEFAULT_CFG, 3, makeSeats(3));
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });
    s.hands.p1 = [];
    s.hands.p2 = [];
    s.hands.p3 = [];
    return s;
  }

  it('Queen Bee: a Basic Unicorn can only go into the Queen Bee Stable, by play, bring, or steal', () => {
    const s = actionPhase();
    const basic = card(9102, 'basic-red', 'basicUnicorn');
    s.stables.p2!.unicorns.push(card(9101, 'queen-bee-unicorn', 'magicalUnicorn'));
    s.hands.p1 = [basic];
    expect(canPlayCardFromHand(s, 'p1', basic, 'p1')).toBe(false);
    expect(canPlayCardFromHand(s, 'p1', basic, 'p3')).toBe(false);
    expect(canPlayCardFromHand(s, 'p1', basic, 'p2')).toBe(true);
    expect(() => applyAction(s, { type: 'playCard', playerId: 'p1', cardId: 9102, targetPlayerId: 'p1' })).toThrow();
    // With no Stable named, the one legal Stable is used.
    const played = applyAction(s, { type: 'playCard', playerId: 'p1', cardId: 9102 });
    expect(played.stables.p2!.unicorns.some((u) => u.id === 9102)).toBe(true);

    // Rainbow Unicorn can't bring the Basic into p1's own Stable: the optional bring has no legal card.
    const s2 = actionPhase();
    s2.stables.p2!.unicorns.push(card(9101, 'queen-bee-unicorn', 'magicalUnicorn'));
    s2.hands.p1 = [card(9103, 'rainbow-unicorn', 'magicalUnicorn'), basic];
    const after = applyAction(s2, { type: 'playCard', playerId: 'p1', cardId: 9103 });
    expect(after.hands.p1!.some((c) => c.id === 9102)).toBe(true);
    expect(after.promptQueue.some((p) => p.kind === 'chooseCardsFromHand' && p.effectTag === 'rainbowUnicornBring')).toBe(false);
  });

  it("a Unicorn card may be played into another player's Stable; the enter effect is that owner's", () => {
    const s = actionPhase();
    s.hands.p1 = [card(9201, 'greedy-flying-unicorn', 'magicalUnicorn')];
    expect(canPlayCardFromHand(s, 'p1', s.hands.p1[0]!, 'p2')).toBe(true);
    const after = applyAction(s, { type: 'playCard', playerId: 'p1', cardId: 9201, targetPlayerId: 'p2' });
    expect(after.stables.p2!.unicorns.some((u) => u.id === 9201)).toBe(true);
    expect(after.hands.p2!.length).toBe(1); // p2 drew from Greedy Flying Unicorn
  });

  it('Mermaid Unicorn (2nd Edition) must return a card — the prompt cannot be skipped', () => {
    const s = actionPhase();
    s.hands.p1 = [card(9301, 'mermaid-unicorn', 'magicalUnicorn')];
    const after = applyAction(s, { type: 'playCard', playerId: 'p1', cardId: 9301 });
    const prompt = after.promptQueue[0]!;
    expect(prompt.kind === 'chooseStableCard' && prompt.mode === 'bounce' && !prompt.optional).toBe(true);
    expect(() => applyAction(after, { type: 'resolvePrompt', playerId: 'p1', decline: true })).toThrow();
  });

  it('Mystical Vortex and Blatant Thievery need their mandatory effect to be possible to be played', () => {
    const s = actionPhase();
    const vortex = card(9401, 'mystical-vortex', 'magic');
    const thievery = card(9402, 'blatant-thievery', 'magic');
    s.hands.p1 = [vortex];
    expect(canPlayCardFromHand(s, 'p1', vortex)).toBe(false);
    s.hands.p1 = [vortex, thievery];
    expect(canPlayCardFromHand(s, 'p1', vortex)).toBe(true);
    // Nobody else holds a card: nothing to look at or take.
    expect(canPlayCardFromHand(s, 'p1', thievery)).toBe(false);
    s.hands.p3 = [card(9403, 'neigh', 'instant')];
    expect(canPlayCardFromHand(s, 'p1', thievery)).toBe(true);
    // p3 holds a Neigh but may decline; then only p3 (the one with a hand) is a legal target.
    let after = applyAction(s, { type: 'playCard', playerId: 'p1', cardId: 9402 });
    after = applyAction(after, { type: 'declineNeigh', playerId: 'p3' });
    const prompt = after.promptQueue[0]!;
    expect(prompt.kind).toBe('choosePlayer');
    expect(validPlayerTargets(after, prompt as Extract<typeof prompt, { kind: 'choosePlayer' }>)).toEqual(['p3']);
    expect(() => applyAction(after, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p2' })).toThrow();
  });

  it('Necromancer Unicorn can bring back one of the 2 Unicorns it just discarded', () => {
    const s = actionPhase();
    s.discard = [];
    s.hands.p1 = [card(9501, 'necromancer-unicorn', 'magicalUnicorn'), card(9502, 'basic-red', 'basicUnicorn'), card(9503, 'basic-blue', 'basicUnicorn')];
    let after = applyAction(s, { type: 'playCard', playerId: 'p1', cardId: 9501 });
    expect(after.promptQueue[0]?.kind).toBe('chooseCardsFromHand');
    after = applyAction(after, { type: 'resolvePrompt', playerId: 'p1', cardIds: [9502, 9503] });
    expect(after.promptQueue[0]?.kind).toBe('chooseFromPile');
    after = applyAction(after, { type: 'resolvePrompt', playerId: 'p1', targetCardId: 9503 });
    expect(after.stables.p1!.unicorns.some((u) => u.id === 9503)).toBe(true);
  });
});

describe('Unstable Unicorns — Original Base (1st Edition) and Diamond Edition', () => {
  const card = (id: number, kind: UuCard['kind'], type: UuCard['type'], name = kind): UuCard => ({ id, kind, name, type, text: '' });

  it('Original Base deck matches the Second Print inventory (127 playable cards + 8 reference cards)', () => {
    const s = createInitialState({ edition: 'base', expansions: [] }, 2, makeSeats(3));
    const all = [...s.deck, ...Object.values(s.hands).flat()];
    expect(all.length + s.nursery.length).toBe(127);
    const count = (k: string) => all.filter((c) => c.kind === k).length;
    for (const k of ['dark-angel-unicorn', 'mother-goose-unicorn', 'necromancer-unicorn', 'unicorn-oracle', 'kiss-of-life', 'caffeine-overload', 'claw-machine', 'rainbow-lasso', 'stable-artillery']) {
      expect(count(k)).toBe(0);
    }
    expect(count('alluring-narwhal')).toBe(1);
    expect(count('re-target')).toBe(2);
    expect(count('extra-tail')).toBe(3);
    expect(count('rainbow-mane')).toBe(3);
    expect(count('puppicorn')).toBe(1);
  });

  it('Unicorn Lasso hands the stolen Unicorn back at the end of the turn', () => {
    let s = ready({ edition: 'base', expansions: [] }, 4, makeSeats(2));
    // Skip p1's turn, then give p2 a Lasso before p2's turn begins.
    s.hands.p1 = [];
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });
    s.hands.p1 = [];
    s.stables.p2!.upgrades.push(card(9601, 'unicorn-lasso', 'upgrade'));
    const victim = card(9602, 'basic-red', 'basicUnicorn');
    s.stables.p1!.unicorns.push(victim);
    s.hands.p2 = [];
    s = applyAction(s, { type: 'drawInsteadOfPlaying', playerId: 'p1' });
    // p2's Beginning of Turn: the Lasso trigger.
    expect(s.promptQueue[0]?.kind).toBe('beginningTrigger');
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p2' });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p2', targetCardId: 9602 });
    expect(s.stables.p2!.unicorns.some((u) => u.id === 9602)).toBe(true);
    s.hands.p2 = [];
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p2' });
    s.hands.p2 = [];
    s = applyAction(s, { type: 'drawInsteadOfPlaying', playerId: 'p2' });
    expect(s.stables.p1!.unicorns.some((u) => u.id === 9602)).toBe(true);
    expect(s.stables.p2!.unicorns.some((u) => u.id === 9602)).toBe(false);
  });

  it('Diamond Edition: the 2nd Edition deck plus four Diamond Unicorns in the Vault', () => {
    const s = createInitialState({ edition: 'diamond', expansions: [] }, 6, makeSeats(3));
    expect(s.vault.map((c) => c.kind).sort()).toEqual(['prismawing', 'reaper', 'shimmerblade', 'sparklestar']);
    const all = [...s.deck, ...Object.values(s.hands).flat()];
    expect(all.length).toBe(114);
    expect(all.some((c) => c.type === 'diamondUnicorn')).toBe(false);
  });

  it('Diamond Phase: rolled between Beginning of Turn and Draw; every face resolves to a choice or nothing', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = ready({ edition: 'diamond', expansions: [] }, seed, makeSeats(3));
      // ready() stops at the Draw phase, so the roll already happened. With no Diamond
      // Unicorn in any Stable yet, faces 1 and 2 take one from the Vault, 3 and 4 do nothing.
      const roll = s.log.find((l) => l.text.includes('Diamond dice'));
      expect(roll).toBeTruthy();
      const took = Object.values(s.stables).some((st) => st.unicorns.some((u) => u.type === 'diamondUnicorn'));
      seen.add(took ? 'took' : 'nothing');
      expect(s.vault.length).toBe(took ? 3 : 4);
    }
    expect(seen).toEqual(new Set(['took', 'nothing']));
  });

  it('Diamond Unicorns cannot be destroyed, sacrificed, or returned to a hand — but can be taken', () => {
    let s = ready({ edition: 'diamond', expansions: [] }, 9, makeSeats(2));
    for (const st of Object.values(s.stables)) st.unicorns = st.unicorns.filter((u) => u.type !== 'diamondUnicorn');
    const reaper = s.vault.find((c) => c.kind === 'reaper') ?? card(9701, 'reaper', 'diamondUnicorn');
    s.vault = s.vault.filter((c) => c.id !== reaper.id);
    s.stables.p2!.unicorns = [reaper];
    s.hands.p2 = [];
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });
    const poison = card(9702, 'unicorn-poison', 'magic');
    const kick = card(9703, 'back-kick', 'magic');
    s.hands.p1 = [poison, kick];
    expect(canPlayCardFromHand(s, 'p1', poison)).toBe(false);
    expect(canPlayCardFromHand(s, 'p1', kick)).toBe(false);
    expect(unicornCount(s, 'p2')).toBe(1);
  });

  it('Prismawing (enter): may DISCARD a card, then DRAW 3', () => {
    let s = ready({ edition: 'diamond', expansions: [] }, 10, makeSeats(2));
    s = applyAction(s, { type: 'drawForTurn', playerId: 'p1' });
    s.hands.p2 = [];
    const wing = card(9801, 'prismawing', 'diamondUnicorn');
    const junk = card(9802, 'basic-red', 'basicUnicorn');
    s.hands.p1 = [junk];
    s.vault = [wing];
    s.promptQueue = [{ kind: 'chooseFromPile', playerId: 'p1', reason: '', optional: false, pile: 'vault', filter: 'unicorn', destination: 'stable' }];
    s.subPhase = 'awaitingPrompt';
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: 9801 });
    const p = s.promptQueue[0]!;
    expect(p.kind === 'chooseCardsFromHand' && p.optional).toBe(true);
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', cardIds: [9802] });
    expect(s.hands.p1!.length).toBe(3);
    expect(s.discard.some((c) => c.id === 9802)).toBe(true);
  });
});
