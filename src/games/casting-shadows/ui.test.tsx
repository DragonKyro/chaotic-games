// Render smoke tests for the prompts the audit added: each decision the rules give
// a player must reach the dock as a real choice, in plain words.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { makeSeats } from '@/core/playout';
import { CS_COUNTERSPELL_DEFS, CS_MAIN_DECK_DEFS } from './cards';
import { Rules } from './Rules';
import { applyAction, createInitialState } from './reducer';
import type { CsCard, CsConfig, CsState } from './types';
import { GameView } from './ui';

const CFG: CsConfig = { expansions: [], characterByPlayer: {} };
let nextId = 7000;
function card(kind: string): CsCard {
  const d = [...CS_MAIN_DECK_DEFS, ...CS_COUNTERSPELL_DEFS].find((x) => x.kind === kind)!;
  const { count: _c, ...rest } = d;
  return { ...rest, id: nextId++ };
}
function rolled(players = 2): CsState {
  const s = createInitialState(CFG, 42, makeSeats(players, { ai: false, local: true }));
  return applyAction(s, { type: 'rollResourceDice', playerId: 'p1', dice: ['redGem', 'redOrb', 'blueGem', 'blueOrb', 'purpleGem'] });
}

describe('Casting Shadows UI prompts', () => {
  it('renders the Rules', () => {
    render(<Rules />);
    expect(screen.getByText(/What this build has not confirmed/)).toBeDefined();
  });

  it('a Stunned caster is asked which die to leave out', () => {
    const s = createInitialState(CFG, 42, makeSeats(2, { ai: false, local: true }));
    s.boards.p1!.stunned = true;
    const dispatch = vi.fn();
    render(<GameView state={s} localPlayerId="p1" dispatch={dispatch} />);
    fireEvent.click(screen.getByText('Leave out the purple die'));
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ type: 'rollResourceDice', slots: [0, 1, 2, 3] });
  });

  it('Run Away! asks for the hex to flee to before it is revealed', () => {
    let s = rolled();
    s.boards.p1!.hexId = 'ancient-rune';
    s.boards.p2!.hexId = 'underground-volcano';
    const run = card('run-away');
    s.boards.p2!.spellBook = [run];
    s.boards.p1!.spellBook = [card('bubble-trouble')];
    s = applyAction(s, { type: 'castSpell', playerId: 'p1', spellId: s.boards.p1!.spellBook[0]!.id, targetPlayerId: 'p2' });
    const dispatch = vi.fn();
    render(<GameView state={s} localPlayerId="p2" dispatch={dispatch} />);
    fireEvent.click(screen.getAllByText('Run Away!')[0]!);
    expect(screen.getByText('Where do you run to?')).toBeDefined();
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Ancient Rune' })[0]!);
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ type: 'respondCounterspell', counterspellId: run.id, escapeHexId: 'ancient-rune' });
  });

  it('a full Spell Book asks which card to give up', () => {
    const s = rolled();
    s.boards.p1!.spellBook = [card('pointed-shield'), card('fatal-fronds'), card('res-red-gem'), card('curse-void'), card('heavy-hand')];
    s.hexes[s.boards.p1!.hexId].faceUpCard = card('bubble-trouble');
    const dispatch = vi.fn();
    render(<GameView state={s} localPlayerId="p1" dispatch={dispatch} />);
    fireEvent.click(screen.getByText('Collect · 1 AP'));
    expect(dispatch).not.toHaveBeenCalled();
    expect(screen.getByText(/discard a spell or resource card/)).toBeDefined();
  });

  it('Nuzzle the Savage is asked how much HP to give up', () => {
    const s = createInitialState({ expansions: [], characterByPlayer: { p1: 'nuzzle' } }, 42, makeSeats(2, { ai: false, local: true }));
    const r = applyAction(s, { type: 'rollResourceDice', playerId: 'p1', dice: ['redGem', 'redOrb', 'blueGem', 'blueOrb', 'purpleGem'] });
    r.boards.p1!.form = 'shadow';
    r.boards.p1!.shadowEnergy = 5;
    const dispatch = vi.fn();
    render(<GameView state={r} localPlayerId="p1" dispatch={dispatch} />);
    fireEvent.click(screen.getByText(/Shadow ability ·/));
    fireEvent.click(screen.getByText('Give up 2 HP → 2 DMG to each enemy'));
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ type: 'useShadowAbility', amount: 2 });
  });
});
