// Happy Little Dinosaurs — GameModule (Base Game implemented).

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import type { HldAction, HldConfig, HldState } from './types';

const NAME = 'Happy Little Dinosaurs';

export const happyLittleDinosModule: GameModule<HldState, HldAction, HldConfig> = {
  id: 'happy-little-dinos',
  name: NAME,
  tagline: 'Survive the disasters of everyday dinosaur life. Barely.',
  minPlayers: 2,
  maxPlayers: 6,

  defaultConfig: (_seats: Seat[]): HldConfig => ({ expansions: [], trackLength: 50 }),

  validateConfig: (config) => {
    const errors: string[] = [];
    if (config.trackLength < 10 || config.trackLength > 100) {
      errors.push('Track length must be between 10 and 100.');
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
