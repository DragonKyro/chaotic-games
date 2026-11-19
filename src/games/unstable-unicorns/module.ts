// Unstable Unicorns — GameModule (all Base Editions + all 8 Expansions implemented).

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import { Thumbnail } from './Thumbnail';
import type { UuAction, UuConfig, UuState } from './types';

const NAME = 'Unstable Unicorns';

export const unstableUnicornsModule: GameModule<UuState, UuAction, UuConfig> = {
  id: 'unstable-unicorns',
  name: NAME,
  tagline: 'Build a unicorn army. Betray your friends. Neigh everything.',
  minPlayers: 2,
  maxPlayers: 8,
  accent: '#ff5fd2',

  Thumbnail,

  defaultConfig: (_seats: Seat[]): UuConfig => ({ expansions: [], edition: 'base-2nd' }),

  validateConfig: (config) => {
    const errors: string[] = [];
    if (!config.edition) errors.push('Pick a base edition.');
    return errors;
  },

  createInitialState,
  applyAction,
  chooseAIAction,

  ui: async () => {
    const [{ GameView, LobbyConfig }, { Rules }, { Gallery }] = await Promise.all([
      import('./ui'),
      import('./Rules'),
      import('./Gallery'),
      import('./uu.css'),
    ]);
    return { GameView, LobbyConfig, Rules, Gallery };
  },
};
