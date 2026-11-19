// Render smoke tests: crashes, missing keys and bad prop plumbing — what a
// typecheck misses in JSX-heavy files. They don't judge how the art looks.

import { describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { makeSeats } from '@/core/playout';
import { chooseAIAction } from './ai';
import { classicTraitCards } from './cards';
import { Gallery } from './Gallery';
import { applyAction, createInitialState, handOf } from './reducer';
import { Rules } from './Rules';
import { TraitCard } from './TraitCard';
import { GameView, LobbyConfig } from './ui';
import type { DmState } from './types';

const noop = () => undefined;

describe('Doomlings UI', () => {
  it('renders every Classic trait card', () => {
    for (const card of classicTraitCards()) {
      const { unmount } = render(<TraitCard card={card} size="lg" />);
      unmount();
    }
  });

  it('renders the lobby (expansions locked), the rules and the gallery', () => {
    render(<LobbyConfig config={{ expansions: [] }} onChange={noop} />);
    for (const box of screen.getAllByRole('checkbox')) expect((box as HTMLInputElement).disabled).toBe(true);
    cleanup();
    render(<Rules />);
    expect(screen.getByText(/Readings we had to choose/)).toBeDefined();
    cleanup();
    render(<Gallery />);
    cleanup();
  });

  it('renders every state of an AI game for the deciding seat, another seat and a spectator', () => {
    let s: DmState = createInitialState({ expansions: [] }, 2026, makeSeats(4));
    const kinds = new Set<string>();
    const seen = new Set<string>();
    for (let step = 0; step < 600 && s.phase === 'playing'; step++) {
      const active = s.activePlayerId!;
      const other = s.seats.find((x) => x.id !== active)!.id;
      if (s.prompt) kinds.add(s.prompt.kind);
      // Each kind of decision once (per viewer role) keeps this quick.
      const key = s.prompt ? `${s.prompt.kind}:${s.prompt.task.t}` : s.subPhase;
      if (!seen.has(key)) {
        seen.add(key);
        for (const viewer of [active, other, null]) {
          const { unmount } = render(<GameView state={s} localPlayerId={viewer} dispatch={noop} />);
          unmount();
        }
      }
      s = applyAction(s, chooseAIAction(s, active)!);
    }
    expect(s.phase).toBe('gameOver');
    render(<GameView state={s} localPlayerId="p1" dispatch={noop} />);
    expect(screen.getAllByText(/World's End/).length).toBeGreaterThan(0);
    expect(kinds.has('cards')).toBe(true);
  });

  it("never renders another seat's hand", () => {
    const s = createInitialState({ expansions: [] }, 5, makeSeats(3));
    render(<GameView state={s} localPlayerId="p1" dispatch={noop} />);
    const shown = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? '').join('\n');
    for (const card of handOf(s, 'p2')) {
      if (handOf(s, 'p1').some((c) => c.name === card.name)) continue;
      expect(shown.includes(`${card.name} (`)).toBe(false);
    }
  });
});
