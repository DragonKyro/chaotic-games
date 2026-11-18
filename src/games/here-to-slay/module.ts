// Here to Slay — GameModule (Base Game implemented).

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import type { HtsAction, HtsConfig, HtsState } from './types';

const NAME = 'Here to Slay';

export const hereToSlayModule: GameModule<HtsState, HtsAction, HtsConfig> = {
  id: 'here-to-slay',
  name: NAME,
  tagline: 'Assemble a party of adorable murderers. Roll dice. Slay monsters.',
  minPlayers: 2,
  maxPlayers: 6,

  defaultConfig: (_seats: Seat[]): HtsConfig => ({ expansions: [], monstersToWin: 3 }),

  validateConfig: (config) => {
    const errors: string[] = [];
    if (config.monstersToWin < 1) errors.push('Monsters to win must be at least 1.');
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
