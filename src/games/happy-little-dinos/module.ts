// Happy Little Dinosaurs — GameModule (Base Game + all 4 Expansions).

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import { HLD_EXPANSIONS, HLD_SEAT_EXPANSIONS, type HldAction, type HldConfig, type HldState } from './types';
import { HldThumbnail } from './Thumbnail';

const NAME = 'Happy Little Dinosaurs';

const VALID_EXPANSION_IDS = new Set(HLD_EXPANSIONS.map((e) => e.id));

export const happyLittleDinosModule: GameModule<HldState, HldAction, HldConfig> = {
  id: 'happy-little-dinos',
  name: NAME,
  tagline: 'Survive the disasters of everyday dinosaur life. Barely.',
  minPlayers: 2,
  maxPlayers: 6,
  accent: '#ff9f1c',

  defaultConfig: (seats: Seat[]): HldConfig => ({
    expansions: seats.length >= 5 ? ['players-5-6'] : [],
    trackLength: 50,
    twoPlayerVariant: true,
  }),

  validateConfig: (config, seats) => {
    const errors: string[] = [];
    // The base box has four Dinosaur boards; the 5–6 Player Expansion and Hazards Ahead add two each.
    if (seats && seats.length >= 5 && !config.expansions.some((e) => HLD_SEAT_EXPANSIONS.includes(e))) {
      errors.push('5–6 players need the 5–6 Player Expansion or Hazards Ahead (each adds two Dinosaur boards).');
    }
    if (config.trackLength < 10 || config.trackLength > 100) {
      errors.push('Track length must be between 10 and 100.');
    }
    for (const exp of config.expansions) {
      if (!VALID_EXPANSION_IDS.has(exp)) {
        errors.push(`Unknown expansion "${exp}".`);
      }
    }
    return errors;
  },

  createInitialState,
  applyAction,
  chooseAIAction,
  Thumbnail: HldThumbnail,

  ui: async () => {
    const [{ GameView, LobbyConfig }, { Rules }, { Gallery }] = await Promise.all([
      import('./ui'),
      import('./Rules'),
      import('./Gallery'),
      import('./hld.css'),
    ]);
    return { GameView, LobbyConfig, Rules, Gallery };
  },
};
