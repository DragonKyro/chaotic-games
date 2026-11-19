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
