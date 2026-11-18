// Unstable Unicorns — GameModule (2nd Edition Base Game implemented).

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import type { UuAction, UuConfig, UuState } from './types';

const NAME = 'Unstable Unicorns';

export const unstableUnicornsModule: GameModule<UuState, UuAction, UuConfig> = {
  id: 'unstable-unicorns',
  name: NAME,
  tagline: 'Build a unicorn army. Betray your friends. Neigh everything.',
  minPlayers: 2,
  maxPlayers: 8,

  defaultConfig: (_seats: Seat[]): UuConfig => ({ expansions: [], edition: 'base-2nd' }),

  validateConfig: (config) => {
    const errors: string[] = [];
    if (!config.edition) errors.push('Pick a base edition.');
    if (config.expansions.length > 0) {
      errors.push('Expansions are not implemented yet — play the 2nd Edition base game.');
    }
    return errors;
  },

  createInitialState,
  applyAction,
  chooseAIAction,

  ui: async () => {
    const [{ GameView, LobbyConfig }, { Rules }] = await Promise.all([
      import('./ui'),
      import('./Rules'),
    ]);
    return { GameView, LobbyConfig, Rules };
  },
};
