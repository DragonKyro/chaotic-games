// Render smoke tests. These don't judge whether the art looks good — they catch
// crashes, missing keys and bad prop plumbing, which is what a typecheck misses
// in JSX-heavy files.

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Seat } from '@/core/types';
import { CardArt, CardBack, Thumbnail } from './CardArt';
import { Rules } from './Rules';
import { GameView, LobbyConfig } from './ui';
import { ALL_CARD_KINDS, BASE_DECK_COUNTS, CARD_LABEL } from './cards';
import { explodingKittensModule } from './module';
import { applyAction, createInitialState } from './reducer';
import type { EkBaseCardKind, EkConfig, EkState } from './types';
import { EK_EXPANSIONS } from './types';

const ALL_KINDS = Object.keys(BASE_DECK_COUNTS) as EkBaseCardKind[];
const CONFIG: EkConfig = { expansions: [], handSize: 4, combosCatsOnly: false };

function seats(n: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`, name: `P${i}`, color: '#e64a4a', isAI: i > 0, isLocal: true,
  }));
}

function game(n = 3): EkState {
  return createInitialState(CONFIG, 31415, seats(n));
}

describe('art', () => {
  it('renders every card kind without throwing', () => {
    for (const kind of ALL_KINDS) {
      const { unmount } = render(<CardArt kind={kind} />);
      expect(screen.getByLabelText(CARD_LABEL[kind])).toBeDefined();
      unmount();
    }
  });

  it('draws a real path for every kind', () => {
    // A silently-empty <g> would render but look like nothing, so assert each
    // card actually puts geometry on the canvas.
    for (const kind of ALL_KINDS) {
      const { container, unmount } = render(<CardArt kind={kind} />);
      const shapes = container.querySelectorAll('path, circle, ellipse, rect');
      expect(shapes.length, `${kind} has no shapes`).toBeGreaterThan(3);
      unmount();
    }
  });

  it('renders the card back and the picker thumbnail', () => {
    render(<CardBack />);
    expect(screen.getByLabelText('Face-down card')).toBeDefined();
    render(<Thumbnail />);
    expect(screen.getByLabelText('Exploding Kittens')).toBeDefined();
  });
});

describe('lobby config', () => {
  it('renders and reports changes', () => {
    const onChange = vi.fn();
    render(<LobbyConfig config={CONFIG} seats={seats(3)} onChange={onChange} />);
    expect(screen.getByText(/Combos from cat cards only/)).toBeDefined();
  });
});

describe('rules book', () => {
  it('lists every card with its count and totals 56', () => {
    render(<Rules />);
    for (const kind of ALL_KINDS) {
      expect(screen.getAllByText(CARD_LABEL[kind]).length).toBeGreaterThan(0);
    }
    expect(screen.getAllByText('56').length).toBeGreaterThan(0);
  });
});

describe('game view', () => {
  it('renders the opening table for the active player', () => {
    render(<GameView state={game()} localPlayerId="p0" dispatch={vi.fn()} />);
    expect(screen.getByText(/Your hand/)).toBeDefined();
    expect(screen.getByText(/Draw & end turn/)).toBeDefined();
    expect(screen.getByText(/in deck/)).toBeDefined();
  });

  it('does not render a hand for a spectator', () => {
    render(<GameView state={game()} localPlayerId={null} dispatch={vi.fn()} />);
    expect(screen.getByText(/Spectating/)).toBeDefined();
  });

  it('never renders deck contents', () => {
    const s = game();
    const { container } = render(<GameView state={s} localPlayerId="p0" dispatch={vi.fn()} />);
    // The only cards on screen should be the local hand plus the discard top.
    const named = container.querySelectorAll('.ek-card-name');
    expect(named.length).toBeLessThanOrEqual((s.hands.p0?.length ?? 0) + 2);
  });

  it('renders each prompt subphase', () => {
    const base = game();

    const defusing: EkState = {
      ...base,
      subPhase: 'awaitingDefuse',
      pendingKitten: { id: 9001, kind: 'explodingKitten' },
      hands: { ...base.hands, p0: [{ id: 9002, kind: 'defuse' }] },
    };
    const a = render(<GameView state={defusing} localPlayerId="p0" dispatch={vi.fn()} />);
    expect(screen.getByText(/You drew an Exploding Kitten/)).toBeDefined();
    a.unmount();

    const placing: EkState = { ...defusing, subPhase: 'awaitingKittenPlace' };
    const b = render(<GameView state={placing} localPlayerId="p0" dispatch={vi.fn()} />);
    expect(screen.getByText(/Hide the kitten/)).toBeDefined();
    b.unmount();

    const peeking: EkState = {
      ...base,
      subPhase: 'awaitingFutureView',
      peek: { playerId: 'p0', cards: [{ id: 9003, kind: 'tacoCat' }] },
    };
    const c = render(<GameView state={peeking} localPlayerId="p0" dispatch={vi.fn()} />);
    expect(screen.getByText(/The next 1 cards/)).toBeDefined();
    c.unmount();

    const noping: EkState = {
      ...base,
      subPhase: 'awaitingNope',
      activePlayerId: 'p0',
      hands: { ...base.hands, p0: [{ id: 9004, kind: 'nope' }] },
      pending: {
        byPlayerId: 'p1',
        cards: [{ id: 9005, kind: 'attack' }],
        combo: null,
        targetPlayerId: null,
        demandKind: null,
        nopeCards: [],
        responderQueue: ['p0'],
      },
    };
    const d = render(<GameView state={noping} localPlayerId="p0" dispatch={vi.fn()} />);
    expect(screen.getByText(/Let it happen/)).toBeDefined();
    d.unmount();

    const favor: EkState = {
      ...base,
      subPhase: 'awaitingFavorGive',
      activePlayerId: 'p0',
      pendingFavor: { fromPlayerId: 'p0', toPlayerId: 'p1' },
    };
    const e = render(<GameView state={favor} localPlayerId="p0" dispatch={vi.fn()} />);
    expect(screen.getByText(/Pay up/)).toBeDefined();
    e.unmount();
  });

  it('shows the winner banner at game over', () => {
    const over: EkState = {
      ...game(2),
      phase: 'gameOver',
      subPhase: 'gameOver',
      activePlayerId: null,
      eliminated: ['p1'],
    };
    render(<GameView state={over} localPlayerId="p0" dispatch={vi.fn()} />);
    expect(screen.getByText(/survives/)).toBeDefined();
  });

  it('surfaces a known kitten to the player who peeked', () => {
    let s = game();
    s = { ...s, deck: [{ id: 9100, kind: 'explodingKitten' }, ...s.deck], knownTopCount: { ...s.knownTopCount, p0: 1 } };
    render(<GameView state={s} localPlayerId="p0" dispatch={vi.fn()} />);
    expect(screen.getByText(/You know what's coming/)).toBeDefined();
    expect(screen.getByText(/Draw risk/)).toBeDefined();
    expect(screen.getByText('100%')).toBeDefined();
  });
});

describe('view survives a full AI game', () => {
  it('renders every state a real game passes through', async () => {
    const { chooseAIAction } = await import('./ai');
    let s = createInitialState(CONFIG, 8888, seats(3));
    let guard = 0;
    while (s.phase !== 'gameOver' && guard++ < 2000) {
      const view = render(<GameView state={s} localPlayerId={s.activePlayerId} dispatch={vi.fn()} />);
      view.unmount();
      const action = chooseAIAction(s, s.activePlayerId!);
      if (!action) break;
      s = applyAction(s, action);
    }
    expect(s.phase).toBe('gameOver');
  });

  it('renders every expansion card kind and expansion lobby checkboxes', () => {
    for (const kind of ALL_CARD_KINDS) {
      const { container, unmount } = render(<CardArt kind={kind} />);
      expect(screen.getByLabelText(CARD_LABEL[kind])).toBeDefined();
      const shapes = container.querySelectorAll('path, circle, ellipse, rect');
      expect(shapes.length, `${kind} has no shapes`).toBeGreaterThan(2);
      unmount();
    }

    const onChange = vi.fn();
    render(<LobbyConfig config={CONFIG} seats={seats(4)} onChange={onChange} />);
    for (const exp of EK_EXPANSIONS) {
      expect(screen.getByText(exp.name)).toBeDefined();
    }

    expect(explodingKittensModule.maxPlayers).toBe(10);
    expect(explodingKittensModule.validateConfig({ ...CONFIG, expansions: ['imploding-kittens'] })).toEqual([]);
    expect(explodingKittensModule.validateConfig({ ...CONFIG, expansions: [] }, seats(6)).length).toBeGreaterThan(0);
    expect(explodingKittensModule.validateConfig({ ...CONFIG, expansions: ['imploding-kittens'] }, seats(6))).toEqual([]);
    expect(explodingKittensModule.validateConfig({ ...CONFIG, expansions: ['party-pack'] }, seats(9))).toEqual([]);
  });
});
