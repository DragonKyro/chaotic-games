// Casting Shadows — GameModule (Base Game + Ice Storm + Molten Rock Expansions).

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import type { CsAction, CsConfig, CsState } from './types';
import { Thumbnail } from './Thumbnail';

const NAME = 'Casting Shadows';

export const castingShadowsModule: GameModule<CsState, CsAction, CsConfig> & {
  validateConfig: (config: CsConfig, seats?: Seat[]) => string[];
} = {
  id: 'casting-shadows',
  name: NAME,
  tagline: 'Gather sparks, craft spells, and let your shadow off the leash.',
  minPlayers: 2,
  maxPlayers: 6,

  Thumbnail,

  defaultConfig: (seats: Seat[]): CsConfig => ({
    expansions: seats.length > 4 ? ['ice-storm'] : [],
    characterByPlayer: {},
  }),

  validateConfig: (config: CsConfig, seats?: Seat[]) => {
    const errors: string[] = [];
    const playerCount = seats?.length ?? Object.keys(config.characterByPlayer).length;
    if (playerCount > 4 && config.expansions.length === 0) {
      errors.push('5–6 players requires at least one expansion (The Ice Storm or The Molten Rock).');
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
