// Render smoke tests: crashes and prop plumbing in a JSX-heavy file, plus the
// hidden-information rule — another player's hand and the deck never reach
// the page, except through the viewer's own peek prompt.

import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { cloneState } from '@/core/state';
import { makeSeats, playOut } from '@/core/playout';
import type { PlayerId } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import { Rules } from './Rules';
import { GameView } from './ui';
import type { HtsCard, HtsConfig, HtsState } from './types';

/** A copy where every card the viewer must not see carries a sentinel name. */
function withSecrets(s: HtsState, viewer: PlayerId): HtsState {
  const c = cloneState(s);
  for (const seat of c.seats) {
    if (seat.id === viewer) continue;
    for (const card of c.hands[seat.id]!) card.name = `SECRET-${card.id}`;
  }
  for (const card of c.deck) card.name = `SECRET-${card.id}`;
  return c;
}

/** The viewer's own prompt legitimately shows them another hand. */
function peeking(s: HtsState, viewer: PlayerId): boolean {
  const p = s.promptQueue[0];
  if (!p || p.playerId !== viewer || s.subPhase !== 'awaitingPrompt') return false;
  return p.kind === 'peekHandAck' || (p.kind === 'chooseFromPile' && p.source === 'opponentHand');
}

describe('Here to Slay UI', () => {
  it('renders the rules', () => {
    render(<Rules />);
    expect(screen.getByText(/end your turn/i, { selector: 'strong' })).toBeDefined();
    cleanup();
  });

  it('renders every state of real games for every seat, never showing a hidden card', () => {
    const configs: HtsConfig[] = [
      { expansions: [], monstersToWin: 3, classesToWin: 6 },
      { expansions: ['warriors-druids', 'berserkers-necromancers', 'here-to-sleigh'], monstersToWin: 3, classesToWin: 7 },
      { expansions: ['warriors-druids'], monstersToWin: 3 },
      { expansions: ['berserkers-necromancers'], monstersToWin: 3 },
    ];
    for (const [i, config] of configs.entries()) {
      let s = createInitialState(config, 101 + i, makeSeats(3));
      let sawDraft = false;
      let sawTray = false;
      for (let step = 0; step < (i === 0 ? 60 : 40) && s.phase !== 'gameOver'; step++) {
        if (s.subPhase === 'choosingLeaders') sawDraft = true;
        // Whoever has the decision, plus one bystander in rotation.
        const bystander = s.seats[step % s.seats.length]!.id;
        for (const viewer of new Set([s.activePlayerId!, bystander])) {
          const view = render(<GameView state={withSecrets(s, viewer)} localPlayerId={viewer} dispatch={vi.fn()} />);
          if (!peeking(s, viewer)) expect(view.container.innerHTML).not.toContain('SECRET-');
          if (s.lastRoll) sawTray = true;
          view.unmount();
        }
        const a = chooseAIAction(s, s.activePlayerId!);
        expect(a).toBeTruthy();
        s = applyAction(s, a!);
      }
      expect(sawDraft).toBe(true);
      expect(sawTray).toBe(true);
      const over = render(<GameView state={s} localPlayerId={s.seats[0]!.id} dispatch={vi.fn()} />);
      if (s.phase === 'gameOver') expect(over.container.querySelector('.cg-gameover')).toBeTruthy();
      over.unmount();
    }
  });

  it('renders the new decisions: a yes/no, an Item target, and a drawn card that cannot be played', () => {
    const base = playOut({ applyAction, chooseAIAction }, createInitialState({ expansions: [], monstersToWin: 3 }, 9, makeSeats(2)), 10, (x) => x.subPhase !== 'choosingLeaders').state;
    base.hands.p1 = [];
    base.hands.p2 = [];
    const card = (id: number, kind: string, type: HtsCard['type'], cls: HtsCard['class'] = null, abilityThreshold: number | null = null): HtsCard =>
      ({ id, kind, name: kind, type, class: cls, text: '', abilityThreshold, modifierChoices: null });

    // Plundering Puma's victim decides whether to draw.
    let s = cloneState(base);
    s.parties.p1 = [{ card: card(9001, 'plundering-puma', 'hero', 'thief', 6), equippedItem: null, usedThisTurn: false }];
    s.hands.p2 = [card(9002, 'challenge', 'challenge'), card(9003, 'challenge', 'challenge')];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9001, dice: [6, 6] });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p2' });
    let view = render(<GameView state={s} localPlayerId="p2" dispatch={vi.fn()} />);
    expect(screen.getByText('Yes')).toBeDefined();
    view.unmount();

    // Hook: pick the Item, then the Hero to wear it.
    s = cloneState(base);
    s.parties.p1 = [{ card: card(9011, 'hook', 'hero', 'ranger', 6), equippedItem: null, usedThisTurn: false }];
    s.hands.p1 = [card(9012, 'really-big-ring', 'item')];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9011, dice: [6, 6] });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', cardIds: [9012] });
    view = render(<GameView state={s} localPlayerId="p1" dispatch={vi.fn()} />);
    expect(screen.getByText('Equip an item')).toBeDefined();
    view.unmount();

    // Mellow Dee draws a Magic card: shown, nothing to play.
    s = cloneState(base);
    s.parties.p1 = [{ card: card(9021, 'mellow-dee', 'hero', 'bard', 7), equippedItem: null, usedThisTurn: false }];
    s.deck.unshift(card(9022, 'critical-boost', 'magic'));
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9021, dice: [6, 6] });
    view = render(<GameView state={s} localPlayerId="p1" dispatch={vi.fn()} />);
    expect(screen.getByText('Nothing to play')).toBeDefined();
    view.unmount();
    // …and the other player sees no hint of what it was.
    view = render(<GameView state={s} localPlayerId="p2" dispatch={vi.fn()} />);
    expect(view.container.innerHTML).not.toContain('critical-boost');
    view.unmount();
  });

  it('renders the Warriors & Druids decisions: a free attack, a look at a hand, Majestelk, a class Challenge, Muscipula Rex', () => {
    const base = playOut({ applyAction, chooseAIAction }, createInitialState({ expansions: ['warriors-druids'], monstersToWin: 3 }, 9, makeSeats(2)), 10, (x) => x.subPhase !== 'choosingLeaders').state;
    base.hands.p1 = [];
    base.hands.p2 = [];
    base.parties.p1 = [];
    base.parties.p2 = [];
    base.partyLeaders.p1 = { id: 8990, kind: 'leader-shadow-claw', name: 'The Shadow Claw', type: 'partyLeader', class: 'thief', text: '', abilityThreshold: null, modifierChoices: null };
    base.partyLeaders.p2 = { id: 8991, kind: 'leader-cloaked-sage', name: 'The Cloaked Sage', type: 'partyLeader', class: 'wizard', text: '', abilityThreshold: null, modifierChoices: null };
    const card = (id: number, kind: string, type: HtsCard['type'], cls: HtsCard['class'] = null, abilityThreshold: number | null = null, extra: Partial<HtsCard> = {}): HtsCard =>
      ({ id, kind, name: kind, type, class: cls, text: '', abilityThreshold, modifierChoices: null, ...extra });
    const hero = (id: number, kind: string, cls: HtsCard['class'], roll: number, low = false) => ({ card: card(id, kind, 'hero', cls, roll, low ? { rollLow: true } : {}), equippedItem: null, usedThisTurn: false });

    // Big Buckley: pick a monster to attack (it rolls on click).
    let s = cloneState(base);
    s.parties.p1 = [hero(9101, 'big-buckley', 'druid', 8, true)];
    s.monsterRow = s.monsterRow.map((m) => ({ ...m, requiredHeroes: 1, requiredClass: null }));
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9101, dice: [2, 2] });
    let view = render(<GameView state={s} localPlayerId="p1" dispatch={vi.fn()} />);
    expect(screen.getByText('Attack a monster · free')).toBeDefined();
    view.unmount();

    // Buck Omens: the hand is shown, only its Heroes can be taken; the owner sees no card names.
    s = cloneState(base);
    s.parties.p1 = [hero(9111, 'buck-omens', 'druid', 6, true)];
    s.hands.p2 = [card(9112, 'secret-hero', 'hero', 'bard', 7), card(9113, 'secret-challenge', 'challenge')];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9111, dice: [1, 1] });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p2' });
    view = render(<GameView state={s} localPlayerId="p1" dispatch={vi.fn()} />);
    expect(screen.getByText('Click one of the highlighted cards.')).toBeDefined();
    view.unmount();

    // Majestelk: +5 / -5 owed before Pass.
    s = cloneState(base);
    s.majestelk = { p1: true };
    s.parties.p1 = [hero(9121, 'peanut', 'bard', 7)];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9121, dice: [3, 3] });
    view = render(<GameView state={s} localPlayerId="p1" dispatch={vi.fn()} />);
    expect(screen.getAllByText('Majestelk')).toHaveLength(2);
    expect((screen.getByText('Pass') as HTMLButtonElement).disabled).toBe(true);
    view.unmount();

    // A Druid Challenge offered to a player with a Druid.
    s = cloneState(base);
    s.parties.p2 = [hero(9131, 'stagguard', 'druid', 8, true)];
    s.hands.p2 = [card(9132, 'challenge-druid', 'challenge', null, null, { name: 'Druid Challenge', challengeClass: 'druid', challengeBonus: 3 })];
    s.hands.p1 = [card(9133, 'peanut', 'hero', 'bard', 7)];
    s = applyAction(s, { type: 'playHero', playerId: 'p1', cardId: 9133 });
    view = render(<GameView state={s} localPlayerId="p2" dispatch={vi.fn()} />);
    expect(screen.getByText('Druid Challenge (+3)')).toBeDefined();
    view.unmount();

    // Muscipula Rex's free draw on your turn.
    s = cloneState(base);
    const rex = s.monsterRow[0]!;
    s.trophies.p1 = [{ ...rex, card: { ...rex.card, kind: 'monster-muscipula-rex', name: 'Muscipula Rex' } }];
    view = render(<GameView state={s} localPlayerId="p1" dispatch={vi.fn()} />);
    expect(screen.getByText('Muscipula Rex draw · free')).toBeDefined();
    view.unmount();
  });

  it('renders the Berserkers & Necromancers decisions: a class, a party card, a second roll, Biggest Ring Ever, a gift, an outright slay', () => {
    const base = playOut({ applyAction, chooseAIAction }, createInitialState({ expansions: ['berserkers-necromancers'], monstersToWin: 3 }, 9, makeSeats(2)), 10, (x) => x.subPhase !== 'choosingLeaders').state;
    for (const id of ['p1', 'p2']) {
      base.hands[id] = [];
      base.parties[id] = [];
    }
    base.partyLeaders.p1 = { id: 8990, kind: 'leader-shadow-claw', name: 'The Shadow Claw', type: 'partyLeader', class: 'thief', text: '', abilityThreshold: null, modifierChoices: null };
    base.partyLeaders.p2 = { id: 8991, kind: 'leader-cloaked-sage', name: 'The Cloaked Sage', type: 'partyLeader', class: 'wizard', text: '', abilityThreshold: null, modifierChoices: null };
    const card = (id: number, kind: string, type: HtsCard['type'], cls: HtsCard['class'] = null, abilityThreshold: number | null = null): HtsCard =>
      ({ id, kind, name: kind, type, class: cls, text: '', abilityThreshold, modifierChoices: null });
    const hero = (id: number, kind: string, cls: HtsCard['class'], roll: number, item: HtsCard | null = null) => ({ card: card(id, kind, 'hero', cls, roll), equippedItem: item, usedThisTurn: false });
    const show = (s: HtsState, who: PlayerId, text: string | RegExp) => {
      const view = render(<GameView state={s} localPlayerId={who} dispatch={vi.fn()} />);
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
      view.unmount();
    };

    // Roaryal Guard: one button per class in the game.
    let s = cloneState(base);
    s.parties.p1 = [hero(9201, 'roaryal-guard', 'berserker', 9)];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9201, dice: [5, 5] });
    show(s, 'p1', 'Necromancer');

    // Grim Pupper: a Hero or an equipped Item.
    s = cloneState(base);
    s.parties.p1 = [hero(9211, 'grim-pupper', 'necromancer', 8, card(9212, 'really-big-ring', 'item'))];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9211, dice: [4, 4] });
    show(s, 'p1', 'Sacrifice a card');
    show(s, 'p1', 'on grim-pupper');

    // Goblet of Caffeination: roll again?
    s = cloneState(base);
    s.parties.p1 = [hero(9221, 'peanut', 'bard', 7, card(9222, 'goblet-of-caffeination', 'item'))];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9221, dice: [1, 1] });
    show(s, 'p1', /roll again/);

    // Biggest Ring Ever: cards to discard in the Modifier window.
    s = cloneState(base);
    s.parties.p1 = [hero(9231, 'peanut', 'bard', 7, card(9232, 'biggest-ring-ever', 'item'))];
    s.hands.p1 = [card(9233, 'challenge', 'challenge')];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9231, dice: [1, 2] });
    show(s, 'p1', /Biggest Ring Ever — discard up to 3/);

    // Boston Terror: the chosen player may give a card (and sees their own hand only).
    s = cloneState(base);
    s.parties.p1 = [hero(9241, 'boston-terror', 'necromancer', 7)];
    s.hands.p2 = [card(9242, 'challenge', 'challenge')];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9241, dice: [4, 4] });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p2' });
    show(s, 'p2', /you may give/);

    // Vicious Wildcat: slay a monster outright.
    s = cloneState(base);
    s.parties.p1 = [hero(9251, 'vicious-wildcat', 'berserker', 12)];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9251, dice: [6, 6] });
    show(s, 'p1', 'Slay a monster');
    cleanup();
  });

  it('never names a card taken from a hand to the rest of the table (Hollow Husk)', () => {
    let s = playOut({ applyAction, chooseAIAction }, createInitialState({ expansions: ['berserkers-necromancers'], monstersToWin: 3 }, 4, makeSeats(3)), 12, (x) => x.subPhase !== 'choosingLeaders').state;
    for (const seat of s.seats) {
      s.hands[seat.id] = [];
      s.parties[seat.id] = [];
    }
    s.parties.p1 = [{ card: { id: 9301, kind: 'hollow-husk', name: 'Hollow Husk', type: 'hero', class: 'necromancer', text: '', abilityThreshold: 6, modifierChoices: null }, equippedItem: null, usedThisTurn: false }];
    s.hands.p2 = [{ id: 9302, kind: 'enchanted-spell', name: 'Secretly Enchanted Spell', type: 'magic', class: null, text: '', abilityThreshold: null, modifierChoices: null }];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 9301, dice: [6, 6] });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p2' });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: 9302 });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseCardsFromHand', playerId: 'p1' });
    const view = render(<GameView state={s} localPlayerId="p3" dispatch={vi.fn()} />);
    expect(view.container.innerHTML).not.toContain('Secretly Enchanted Spell');
    view.unmount();
  });

  it('offers the leader draft to the drafter only', () => {
    const s = createInitialState({ expansions: [], monstersToWin: 3 }, 5, makeSeats(2));
    const dispatch = vi.fn();
    const mine = render(<GameView state={s} localPlayerId="p2" dispatch={dispatch} />);
    expect(screen.getByText('Who leads your Party?')).toBeDefined();
    mine.unmount();
    render(<GameView state={s} localPlayerId="p1" dispatch={dispatch} />);
    expect(screen.getByText(/is choosing a Party Leader/)).toBeDefined();
    cleanup();
  });
});
