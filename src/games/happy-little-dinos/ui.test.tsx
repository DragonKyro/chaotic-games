import { describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { makeSeats } from '@/core/playout';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import { Gallery } from './Gallery';
import { Rules } from './Rules';
import { GameView, LobbyConfig } from './ui';
import { happyLittleDinosModule } from './module';
import type { HldConfig, HldState } from './types';

const ALL: HldConfig = { expansions: ['players-5-6', 'perils-of-puberty', 'dating-disasters', 'hazards-ahead'], trackLength: 50 };

describe('Happy Little Dinosaurs UI', () => {
  it('renders the lobby, rules, gallery and thumbnail', () => {
    render(<LobbyConfig config={ALL} seats={makeSeats(4)} onChange={vi.fn()} />);
    expect(screen.getByText('Hazards Ahead')).toBeDefined();
    cleanup();
    render(<Rules />);
    expect(screen.getByText(/Escape — or be the last dino standing/)).toBeDefined();
    cleanup();
    const g = render(<Gallery />);
    expect(g.container.querySelectorAll('.hld-card').length).toBeGreaterThan(80);
    cleanup();
    const T = happyLittleDinosModule.Thumbnail!;
    render(<T />);
    expect(screen.getByLabelText('Happy Little Dinosaurs')).toBeDefined();
  });

  it('renders every state of a real game, for whoever has the decision', () => {
    for (const [players, config] of [[3, { expansions: [], trackLength: 50 }], [5, ALL]] as const) {
      let s: HldState = createInitialState(config as HldConfig, 11, makeSeats(players));
      for (let step = 0; step < 400 && s.phase !== 'gameOver'; step++) {
        const view = render(<GameView state={s} localPlayerId={s.activePlayerId} dispatch={vi.fn()} />);
        // Hidden information: other players' face-down picks never render face-up.
        if (s.subPhase === 'selecting') {
          const faceUpPicks = view.container.querySelectorAll('.hld-picks .hld-card:not(.is-facedown)');
          expect(faceUpPicks.length).toBeLessThanOrEqual(1);
        }
        view.unmount();
        const a = chooseAIAction(s, s.activePlayerId!);
        expect(a).toBeTruthy();
        s = applyAction(s, a!);
      }
      const over = render(<GameView state={s} localPlayerId={s.seats[0]!.id} dispatch={vi.fn()} />);
      if (s.phase === 'gameOver') expect(over.container.querySelector('.cg-gameover')).toBeTruthy();
      over.unmount();
    }
  });

  it('shows a spectator no hand', () => {
    const s = createInitialState({ expansions: [], trackLength: 50 }, 3, makeSeats(3));
    render(<GameView state={s} localPlayerId={null} dispatch={vi.fn()} />);
    expect(screen.getByText(/Spectating/)).toBeDefined();
  });
});
