// Doomlings — GameModule outline. No reducer yet, and its expansion list is
// still missing — see the warning in types.ts.

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { baseInitialState, notImplemented } from '../_scaffold';
import type { DmAction, DmConfig, DmState } from './types';
import { DM_EXPANSIONS } from './types';

const NAME = 'Doomlings';

export const doomlingsModule: GameModule<DmState, DmAction, DmConfig> = {
  id: 'doomlings',
  name: NAME,
  tagline: 'Evolve a species of weirdos. Outlast the catastrophes.',
  minPlayers: 2,
  // ⚠ Believed 2–6; confirm against the box.
  maxPlayers: 6,

  defaultConfig: (_seats: Seat[]): DmConfig => ({ expansions: [] }),

  validateConfig: () => [
    'Doomlings is an outline only — its rules and expansion list have not been confirmed yet.',
  ],

  createInitialState: (config, seed, seats): DmState => ({
    ...baseInitialState(seats, seed),
    subPhase: 'turnAge',
    // TODO: build the trait deck and the ages deck (with catastrophes shuffled
    // in and World's End on the bottom), then deal opening gene pools.
    traitDeck: [],
    traitDiscard: [],
    ageDeck: [],
    agesPlayed: [],
    hands: Object.fromEntries(seats.map((s) => [s.id, []])),
    tableaus: Object.fromEntries(seats.map((s) => [s.id, []])),
    genePool: Object.fromEntries(seats.map((s) => [s.id, 0])),
    catastrophePicks: Object.fromEntries(seats.map((s) => [s.id, null])),
    config,
  }),

  applyAction: () => notImplemented(NAME),

  ui: async () => {
    const { makeScaffoldUi } = await import('../_scaffold/ui');
    return makeScaffoldUi<DmState, DmAction, DmConfig>({
      gameName: NAME,
      premise:
        '⚠ Rules unconfirmed. Build a species from trait cards while the Ages deck counts down and catastrophes tear your tableau apart. Most points at the World\'s End wins. 2–6 players (unconfirmed).',
      expansions: DM_EXPANSIONS,
      todo: [
        'Find the expansion list — doomlings.com was down and BGG blocked fetches, so this is the one game with no verified product list.',
        'Get the rulebook: turn structure, gene pool growth, catastrophe resolution, scoring pass.',
        'Active age card as a round-level rule modifier, read on evaluation rather than copied into flags.',
        'Catastrophes as table-wide destructive events with simultaneous discard choices.',
        'Endgame scoring with trait-to-trait references.',
        'Confirm the trait colour set and what "dominant" does.',
      ],
    });
  },
};
