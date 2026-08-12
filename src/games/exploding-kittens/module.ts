// Exploding Kittens — GameModule. Base game, fully implemented.

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import { Thumbnail } from './CardArt';
import type { EkAction, EkConfig, EkState } from './types';

const NAME = 'Exploding Kittens';

export const explodingKittensModule: GameModule<EkState, EkAction, EkConfig> = {
  id: 'exploding-kittens',
  name: NAME,
  tagline: 'Russian roulette with kittens. Draw, defuse, or die.',
  minPlayers: 2,
  // Base game is 2–5. Imploding Kittens (6) and Party Pack (10) aren't built yet.
  maxPlayers: 5,

  Thumbnail,

  defaultConfig: (_seats: Seat[]): EkConfig => ({
    expansions: [],
    handSize: 4,
    combosCatsOnly: false,
  }),

  validateConfig: (config) => {
    const errors: string[] = [];
    if (config.expansions.length > 0) {
      errors.push('Expansions are not implemented yet — play the base game.');
    }
    if (config.handSize < 1 || config.handSize > 7) {
      errors.push('Opening hand must be between 1 and 7 cards.');
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
      import('./ek.css'),
    ]);
    return { GameView, LobbyConfig, Rules };
  },
};
