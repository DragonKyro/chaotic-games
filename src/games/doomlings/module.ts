// Doomlings — GameModule (Base Game implemented).

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import type { DmAction, DmConfig, DmState } from './types';

const NAME = 'Doomlings';

export const doomlingsModule: GameModule<DmState, DmAction, DmConfig> = {
  id: 'doomlings',
  name: NAME,
  tagline: 'Evolve a species of weirdos. Outlast the catastrophes.',
  minPlayers: 2,
  maxPlayers: 6,

  defaultConfig: (_seats: Seat[]): DmConfig => ({ expansions: [] }),

  validateConfig: (config) => {
    const errors: string[] = [];
    if (config.expansions.length > 0) {
      errors.push('Expansions are not implemented yet — play the base game.');
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
