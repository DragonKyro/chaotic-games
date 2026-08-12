// Happy Little Dinosaurs — GameModule outline. No reducer yet.

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { baseInitialState, notImplemented } from '../_scaffold';
import type { HldAction, HldConfig, HldExpansionId, HldState } from './types';
import { HLD_EXPANSIONS } from './types';

const NAME = 'Happy Little Dinosaurs';

function maxPlayersFor(expansions: readonly HldExpansionId[]): number {
  return expansions.includes('players-5-6') ? 6 : 4;
}

export const happyLittleDinosModule: GameModule<HldState, HldAction, HldConfig> = {
  id: 'happy-little-dinos',
  name: NAME,
  tagline: 'Survive the disasters of everyday dinosaur life. Barely.',
  minPlayers: 2,
  maxPlayers: 6,

  defaultConfig: (_seats: Seat[]): HldConfig => ({ expansions: [], trackLength: 50 }),

  validateConfig: (config) => {
    const errors: string[] = [];
    const cap = maxPlayersFor(config.expansions);
    if (cap < 6) {
      errors.push(`Max ${cap} players — enable the 5–6 Player Expansion for more.`);
    }
    return errors;
  },

  createInitialState: (config, seed, seats): HldState => ({
    ...baseInitialState(seats, seed),
    subPhase: 'revealDisaster',
    // TODO: build both decks from base + expansions and deal opening hands.
    // Needs cards.ts + disasters.ts.
    disasterDeck: [],
    disasterDiscard: [],
    currentDisaster: null,
    deck: [],
    discard: [],
    hands: Object.fromEntries(seats.map((s) => [s.id, []])),
    pendingPicks: Object.fromEntries(seats.map((s) => [s.id, null])),
    trackPosition: Object.fromEntries(seats.map((s) => [s.id, 0])),
    eliminated: [],
    config,
  }),

  applyAction: () => notImplemented(NAME),

  ui: async () => {
    const { makeScaffoldUi } = await import('../_scaffold/ui');
    return makeScaffoldUi<HldState, HldAction, HldConfig>({
      gameName: NAME,
      premise:
        '2–4 players (6 with the player expansion). Flip a disaster, everyone commits a point card face down, reveal, and whoever fails takes the hit. Survive the track to win.',
      expansions: HLD_EXPANSIONS,
      todo: [
        'Get the rulebook — resolution order, track length and disaster categories are all reconstructed.',
        'Simultaneous face-down commits: reuse the pendingPicks + reveal-tick pattern from the sibling project.',
        'Park activePlayerId on the next un-submitted AI seat during selecting, or all-AI matches freeze.',
        'Per-player survival track plus elimination when a dinosaur runs out of it.',
        'Escape cards keyed to disaster category.',
        'Card lists for base + Hazards Ahead + Dating Disasters + Perils of Puberty.',
      ],
    });
  },
};
