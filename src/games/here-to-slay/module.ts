// Here to Slay — GameModule (Base Game + All 3 Expansions implemented).

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import type { HtsAction, HtsConfig, HtsState } from './types';
import { Thumbnail } from './Thumbnail';

const NAME = 'Here to Slay';

export const hereToSlayModule: GameModule<HtsState, HtsAction, HtsConfig> = {
  id: 'here-to-slay',
  name: NAME,
  tagline: 'Assemble a party of adorable murderers. Roll dice. Slay monsters.',
  minPlayers: 2,
  maxPlayers: 6,

  defaultConfig: (_seats: Seat[]): HtsConfig => ({
    expansions: [],
    monstersToWin: 3,
    classesToWin: 6,
  }),

  validateConfig: (config) => {
    const errors: string[] = [];
    if (config.monstersToWin < 1) errors.push('Monsters to win must be at least 1.');
    if (config.classesToWin !== undefined && config.classesToWin < 1) {
      errors.push('Classes to win must be at least 1.');
    }
    return errors;
  },

  createInitialState,
  applyAction,
  chooseAIAction,
  Thumbnail,

  ui: async () => {
    const [{ GameView, LobbyConfig }, { Rules }] = await Promise.all([
      import('./ui'),
      import('./Rules'),
    ]);
    return { GameView, LobbyConfig, Rules };
  },
};
