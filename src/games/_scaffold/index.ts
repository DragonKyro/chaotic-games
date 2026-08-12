// Shared scaffolding for games that exist as an OUTLINE ONLY — types + design
// notes, no reducer, no art. Every game in the registry currently uses this.
//
// This folder is temporary by design. As each game gets a real reducer and UI,
// it stops importing from here; when the last one is done, delete `_scaffold/`.
// The leading underscore marks it as "not a game" so the registry pattern
// (one folder per game) still reads cleanly.
//
// Non-React half only — modules import this statically. The placeholder UI
// lives in ./ui.tsx and is imported lazily from module.ui(), matching the
// project's rule that game UI never lands in the initial bundle.

import type { GameStateShape } from '@/core/module';
import type { Seat } from '@/core/types';
import { createRng } from '@/core/rng';

/** One expansion / add-on for a game, as sold. */
export interface ExpansionMeta {
  /** Stable id stored in config.expansions and over the wire. */
  id: string;
  name: string;
  /** What it adds, one line. */
  summary: string;
  /**
   * false = the name or contents still need confirming against the physical
   * product or rulebook. Never treat an unverified entry as authoritative.
   */
  verified: boolean;
}

/** Every game's config carries at least a set of enabled expansion ids. */
export interface ScaffoldConfig {
  expansions: string[];
}

/** The game-agnostic slice of an opening state. Games spread this and add their own fields. */
export function baseInitialState(seats: Seat[], seed: number): GameStateShape {
  return {
    phase: 'playing',
    seats,
    activePlayerId: seats[0]?.id ?? null,
    finalScores: null,
    rngState: createRng(seed),
  };
}

/** Called by outline reducers. Keeps the failure loud and identifiable. */
export function notImplemented(gameName: string): never {
  throw new Error(
    `${gameName}: reducer not implemented yet — this game is an outline only.`,
  );
}

export interface ScaffoldUiOptions {
  gameName: string;
  /** Player-count + core-loop summary shown in the lobby and the placeholder board. */
  premise: string;
  expansions: readonly ExpansionMeta[];
  /** Bullet list of what still needs building / deciding. Rendered on the board. */
  todo: readonly string[];
}
