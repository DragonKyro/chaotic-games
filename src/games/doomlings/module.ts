// Doomlings — GameModule (Classic 2nd-edition base game; expansions not yet implemented).

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import { DM_EXPANSIONS } from './types';
import type { DmAction, DmConfig, DmState } from './types';
import { DmThumbnail } from './Thumbnail';

const NAME = 'Doomlings';
const KNOWN_EXPANSIONS = new Map(DM_EXPANSIONS.map((e) => [e.id, e.name]));

export const doomlingsModule: GameModule<DmState, DmAction, DmConfig> = {
  id: 'doomlings',
  name: NAME,
  tagline: 'Evolve a species of weirdos. Outlast the catastrophes.',
  minPlayers: 2,
  maxPlayers: 6,
  accent: '#8cff5a',

  defaultConfig: (_seats: Seat[]): DmConfig => ({ expansions: [] }),

  validateConfig: (config) => {
    const errors: string[] = [];
    for (const id of config.expansions ?? []) {
      const name = KNOWN_EXPANSIONS.get(id);
      errors.push(name ? `${name} isn’t implemented yet.` : `Unknown Doomlings expansion: ${id}`);
    }
    return errors;
  },

  createInitialState,
  applyAction,
  chooseAIAction,
  Thumbnail: DmThumbnail,

  ui: async () => {
    const [{ GameView, LobbyConfig }, { Rules }, { Gallery }] = await Promise.all([
      import('./ui'),
      import('./Rules'),
      import('./Gallery'),
      import('./dm.css'),
    ]);
    return { GameView, LobbyConfig, Rules, Gallery };
  },
};
