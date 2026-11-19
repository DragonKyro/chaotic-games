// Exploding Kittens — GameModule. Base game, fully implemented.

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { maxPlayersForExpansions } from './cards';
import { applyAction, createInitialState } from './reducer';
import { Thumbnail } from './CardArt';
import type { EkAction, EkConfig, EkState } from './types';

const NAME = 'Exploding Kittens';

export const explodingKittensModule: GameModule<EkState, EkAction, EkConfig> = {
  id: 'exploding-kittens',
  name: NAME,
  tagline: 'Russian roulette with kittens. Draw, defuse, or die.',
  minPlayers: 2,
  // Base game is 2–5; Imploding/Recipes supports up to 6; Party Pack supports up to 10.
  maxPlayers: 10,
  accent: '#ff4d4d',

  Thumbnail,

  defaultConfig: (_seats: Seat[]): EkConfig => ({
    expansions: [],
    handSize: 4,
    combosCatsOnly: false,
  }),

  validateConfig: (config, seats) => {
    const errors: string[] = [];
    if (config.handSize < 1 || config.handSize > 7) {
      errors.push('Opening hand must be between 1 and 7 cards.');
    }
    const maxAllowed = maxPlayersForExpansions(config.expansions);
    const playerCount = seats?.length ?? 0;
    if (playerCount > maxAllowed) {
      if (playerCount > 6) {
        errors.push('7–10 players requires the Party Pack expansion.');
      } else {
        errors.push('6 players requires Imploding Kittens, Party Pack, or Recipes for Disaster.');
      }
    }
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
      import('./ek.css'),
    ]);
    return { GameView, LobbyConfig, Rules, Gallery };
  },
};
