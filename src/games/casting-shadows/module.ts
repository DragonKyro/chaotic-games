// Casting Shadows — GameModule (Base Game implemented).

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import type { CsAction, CsConfig, CsState } from './types';

const NAME = 'Casting Shadows';

export const castingShadowsModule: GameModule<CsState, CsAction, CsConfig> = {
  id: 'casting-shadows',
  name: NAME,
  tagline: 'Gather sparks, craft spells, and let your shadow off the leash.',
  minPlayers: 2,
  maxPlayers: 4,

  defaultConfig: (_seats: Seat[]): CsConfig => ({ expansions: [], characterByPlayer: {} }),

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
