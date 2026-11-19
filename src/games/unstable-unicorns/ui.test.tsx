// Render smoke tests: crashes, missing keys and bad prop plumbing — not looks.

import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { makeSeats, playOut } from '@/core/playout';
import { chooseAIAction } from './ai';
import { Gallery } from './Gallery';
import { applyAction, createInitialState } from './reducer';
import { Rules } from './Rules';
import { GameView, LobbyConfig } from './ui';
import type { UuConfig } from './types';

const noop = () => {};

describe('Unstable Unicorns UI', () => {
  it('asks the local player to choose their Baby Unicorn at setup', () => {
    const s = createInitialState({ edition: 'base-2nd', expansions: [] }, 12, makeSeats(3));
    render(<GameView state={s} localPlayerId="p1" dispatch={noop} />);
    expect(screen.getAllByText(/choose a Baby Unicorn/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Pick from the Nursery')).toBeDefined();
  });

  it('shows the Vault in a Diamond Edition game and renders a Diamond Unicorn', () => {
    let s = createInitialState({ edition: 'diamond', expansions: [] }, 12, makeSeats(3));
    s = playOut({ applyAction, chooseAIAction }, s, 80, (st) => st.subPhase === 'action').state;
    const wing = s.vault[0] ?? Object.values(s.stables).flatMap((st) => st.unicorns).find((u) => u.type === 'diamondUnicorn')!;
    s.hands.p1 = [...s.hands.p1!, { ...wing, id: 99999 }];
    render(<GameView state={s} localPlayerId="p1" dispatch={noop} />);
    expect(screen.getByText('Vault')).toBeDefined();
  });

  it('offers the 2-player rules toggle only at 2 seats', () => {
    const config: UuConfig = { edition: 'base-2nd', expansions: [] };
    const two = render(<LobbyConfig config={config} seats={makeSeats(2)} onChange={noop} />);
    expect(screen.getByText('Official 2-player rules')).toBeDefined();
    two.unmount();
    render(<LobbyConfig config={config} seats={makeSeats(3)} onChange={noop} />);
    expect(screen.queryByText('Official 2-player rules')).toBeNull();
  });

  it('renders the rules book and the card gallery', () => {
    const r = render(<Rules />);
    r.unmount();
    render(<Gallery />);
    expect(screen.getAllByText(/Diamond Unicorn/).length).toBeGreaterThan(0);
  });
});
