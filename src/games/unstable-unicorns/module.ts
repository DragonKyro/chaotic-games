// Unstable Unicorns — GameModule outline. No reducer yet.

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { baseInitialState, notImplemented } from '../_scaffold';
import type { UuAction, UuConfig, UuState } from './types';
import { UU_EXPANSIONS } from './types';

const NAME = 'Unstable Unicorns';

export const unstableUnicornsModule: GameModule<UuState, UuAction, UuConfig> = {
  id: 'unstable-unicorns',
  name: NAME,
  tagline: 'Build a unicorn army. Betray your friends. Neigh everything.',
  minPlayers: 2,
  maxPlayers: 8,

  defaultConfig: (_seats: Seat[]): UuConfig => ({ expansions: [], edition: 'base' }),

  validateConfig: (config) => {
    const errors: string[] = [];
    if (!config.edition) errors.push('Pick exactly one base edition.');
    return errors;
  },

  createInitialState: (config, seed, seats): UuState => ({
    ...baseInitialState(seats, seed),
    subPhase: 'beginningOfTurn',
    // TODO: build the deck from edition + expansions, deal 5, give each player
    // one Baby Unicorn from the Nursery. Needs cards.ts.
    deck: [],
    discard: [],
    nursery: [],
    vault: [],
    hands: Object.fromEntries(seats.map((s) => [s.id, []])),
    stables: Object.fromEntries(
      seats.map((s) => [s.id, { unicorns: [], upgrades: [], downgrades: [] }]),
    ),
    pending: null,
    unicornsToWin: seats.length >= 6 ? 6 : 7,
    config,
  }),

  applyAction: () => notImplemented(NAME),

  ui: async () => {
    const { makeScaffoldUi } = await import('../_scaffold/ui');
    return makeScaffoldUi<UuState, UuAction, UuConfig>({
      gameName: NAME,
      premise:
        '2–8 players. First to 7 unicorns in their Stable wins (6 at 6–8 players). Four-phase turns, 7-card hand limit, and anyone can Neigh a card they do not like.',
      expansions: UU_EXPANSIONS,
      todo: [
        'Reaction window for Neigh — reuse the Exploding Kittens Nope primitive, plus a terminal Super Neigh that cannot be answered.',
        'Stable tableau with continuous Upgrade/Downgrade modifiers computed on read, never cached as flags.',
        'Nursery zone: Baby Unicorns return there instead of to hand or discard.',
        '135 base cards need rulebook text; model by trigger tier (on-play, continuous, triggered).',
        'Editions (Control, Chaos, Diamond, Travel, Kids, NSFW) are alternate base decks — one only, not stackable.',
        'Deck-exhaustion win: most unicorns, tiebreak on total letters in tabled unicorn names.',
      ],
    });
  },
};
