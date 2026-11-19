// Drive a match with the module's own AI, the way GameHost's AI driver does:
// only the seat `activePlayerId` parks on moves. Used by every game's AI-vs-AI
// tests and by the dev-only demo route. Game-agnostic.

import type { GameStateShape } from './module';
import type { PlayerId, Seat } from './types';

interface Playable<S, A> {
  applyAction(state: S, action: A): S;
  chooseAIAction?(state: S, playerId: PlayerId): A | null;
}

export interface PlayoutResult<S> {
  state: S;
  steps: number;
  /** True when play stopped with nobody able to move: no active seat, or its AI had no answer. */
  stuck: boolean;
}

/**
 * Play AI moves for whichever seat is active until the match ends, `maxSteps`
 * moves have been made, or `until(state)` holds (checked before each move).
 */
export function playOut<S extends GameStateShape, A>(
  module: Playable<S, A>,
  start: S,
  maxSteps: number,
  until?: (state: S) => boolean,
): PlayoutResult<S> {
  let state = start;
  let steps = 0;
  while (state.phase !== 'gameOver' && steps < maxSteps && !until?.(state)) {
    const active = state.activePlayerId;
    const action = active ? module.chooseAIAction?.(state, active) : null;
    if (!action) return { state, steps, stuck: true };
    state = module.applyAction(state, action);
    steps++;
  }
  return { state, steps, stuck: false };
}

/** `n` seats with ids `p1`…`pn` (or from `firstIndex`), all AI unless `ai: false`. */
export function makeSeats(n: number, opts: { ai?: boolean; firstIndex?: number; local?: boolean } = {}): Seat[] {
  const { ai = true, firstIndex = 1, local = false } = opts;
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + firstIndex}`,
    name: `Player ${i + firstIndex}`,
    color: '#888888',
    isAI: ai,
    isLocal: local,
  }));
}
