// Here to Slay — GameModule outline. No reducer yet.

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { baseInitialState, notImplemented } from '../_scaffold';
import type { HtsAction, HtsConfig, HtsState } from './types';
import { HTS_EXPANSIONS } from './types';

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
    return errors;
  },

  createInitialState: (config, seed, seats): HtsState => ({
    ...baseInitialState(seats, seed),
    subPhase: 'awaitingAction',
    // TODO: build the deck from base + expansions, deal a party leader and 5
    // cards each, lay out the monster row. Needs cards.ts + monsters.ts.
    deck: [],
    discard: [],
    monsterRow: [],
    monsterDeck: [],
    hands: Object.fromEntries(seats.map((s) => [s.id, []])),
    partyLeaders: Object.fromEntries(seats.map((s) => [s.id, null])),
    parties: Object.fromEntries(seats.map((s) => [s.id, []])),
    trophies: Object.fromEntries(seats.map((s) => [s.id, []])),
    actionPointsRemaining: 3,
    pendingPlay: null,
    pendingRoll: null,
    config,
  }),

  applyAction: () => notImplemented(NAME),

  ui: async () => {
    const { makeScaffoldUi } = await import('../_scaffold/ui');
    return makeScaffoldUi<HtsState, HtsAction, HtsConfig>({
      gameName: NAME,
      premise:
        '2–6 players. Spend 3 action points a turn to draw, recruit heroes, equip items and attack monsters with 2d6. Win by slaying 3 monsters or completing a full party.',
      expansions: HTS_EXPANSIONS,
      todo: [
        'Dice: rolls are chosen by the acting client and folded into the action payload — never rolled inside the reducer.',
        'Two interrupt flavours: Challenge cancels a play (LIFO stack); Modifier adjusts a pending roll and several can stack.',
        'Confirm action-point costs against the rulebook — the current list is from memory.',
        'Card lists per class for base + Warriors & Druids + Berserkers & Necromancers + Here to Sleigh.',
        'Monster requirements ("2+ Fighters") as predicates over the party.',
        'Decide whether expansion classes raise the full-party win requirement.',
      ],
    });
  },
};
