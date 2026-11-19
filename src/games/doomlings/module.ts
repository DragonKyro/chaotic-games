// Doomlings — GameModule (Classic 2nd-edition base game plus the built expansions).

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState } from './reducer';
import { DM_EXPANSIONS, dmExpansionLockedReason } from './types';
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
      if (!name) errors.push(`Unknown Doomlings expansion: ${id}`);
      else if (dmExpansionLockedReason(id)) errors.push(`${name} isn’t available: ${dmExpansionLockedReason(id)}`);
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
