// Casting Shadows — GameModule outline. No reducer yet, and the rules in
// types.ts are provisional — see the confidence warning there.

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { baseInitialState, notImplemented } from '../_scaffold';
import type { CsAction, CsConfig, CsResource, CsState } from './types';
import { CS_EXPANSIONS } from './types';

const NAME = 'Casting Shadows';

const EMPTY_RESOURCES: Record<CsResource, number> = {
  spark: 0, ember: 0, frost: 0, bloom: 0, shadow: 0,
};

export const castingShadowsModule: GameModule<CsState, CsAction, CsConfig> = {
  id: 'casting-shadows',
  name: NAME,
  tagline: 'Gather sparks, craft spells, and let your shadow off the leash.',
  minPlayers: 2,
  // ⚠ Believed 2–4; confirm against the box.
  maxPlayers: 4,

  defaultConfig: (_seats: Seat[]): CsConfig => ({ expansions: [], characterByPlayer: {} }),

  validateConfig: () => [
    'Casting Shadows is an outline only — its rules have not been confirmed against the rulebook yet.',
  ],

  createInitialState: (config, seed, seats): CsState => ({
    ...baseInitialState(seats, seed),
    subPhase: 'awaitingCharacterPick',
    // TODO: lay out the central board, deal the spell deck, place characters.
    // Needs board.ts + spells.ts + characters.ts, and the rulebook first.
    tiles: [],
    boards: Object.fromEntries(
      seats.map((s) => [s.id, {
        character: null,
        form: 'light' as const,
        position: null,
        health: 0,
        resources: { ...EMPTY_RESOURCES },
        spells: [],
        shadowPoints: 0,
      }]),
    ),
    spellDeck: [],
    spellDiscard: [],
    pendingCombat: null,
    config,
  }),

  applyAction: () => notImplemented(NAME),

  ui: async () => {
    const { makeScaffoldUi } = await import('../_scaffold/ui');
    return makeScaffoldUi<CsState, CsAction, CsConfig>({
      gameName: NAME,
      premise:
        '⚠ Rules unconfirmed. A dice-and-spell battle game on a shared modular board where each character transforms into a shadow form. 2–4 players (unconfirmed).',
      expansions: CS_EXPANSIONS,
      todo: [
        'Get the rulebook — every rule in types.ts is a reconstruction, not a source.',
        'Spatial state: the first board game here. Tiles, positions, adjacency as a pure function over the layout.',
        'Dice pools rolled by the acting client, results folded into the action payload.',
        'Two-sided combat window: the defender responds with dice and spells.',
        'Confirm player count, board geometry, resource set, and the win condition.',
        'Character roster for base + The Ice Storm + The Molten Rock.',
      ],
    });
  },
};
