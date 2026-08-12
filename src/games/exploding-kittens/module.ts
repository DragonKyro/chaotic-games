// Exploding Kittens — GameModule outline. No reducer yet.

import type { GameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { baseInitialState, notImplemented } from '../_scaffold';
import type { EkAction, EkConfig, EkExpansionId, EkState } from './types';
import { EK_EXPANSIONS } from './types';

const NAME = 'Exploding Kittens';

/** Player caps by enabled expansion — base 5, Imploding 6, Party Pack 10. */
function maxPlayersFor(expansions: readonly EkExpansionId[]): number {
  if (expansions.includes('party-pack')) return 10;
  if (expansions.includes('imploding-kittens')) return 6;
  return 5;
}

export const explodingKittensModule: GameModule<EkState, EkAction, EkConfig> = {
  id: 'exploding-kittens',
  name: NAME,
  tagline: 'Russian roulette with kittens. Draw, defuse, or die.',
  minPlayers: 2,
  // Widest supported case; validateConfig narrows against enabled expansions.
  maxPlayers: 10,

  defaultConfig: (_seats: Seat[]): EkConfig => ({ expansions: [] }),

  validateConfig: (config) => {
    const errors: string[] = [];
    const cap = maxPlayersFor(config.expansions);
    if (cap < 10) {
      errors.push(
        `Max ${cap} players with the current expansions — enable Imploding Kittens (6) or Party Pack (10) for more.`,
      );
    }
    if (config.expansions.includes('party-pack') && config.expansions.length > 1) {
      errors.push('Party Pack replaces Attack with Slap and folds in other content — run it on its own.');
    }
    return errors;
  },

  createInitialState: (config, seed, seats): EkState => ({
    ...baseInitialState(seats, seed),
    subPhase: 'awaitingAction',
    // TODO: deal 7 cards + 1 Defuse each, then seed the deck with
    // (playerCount - 1) Exploding Kittens and shuffle. Needs cards.ts.
    deck: [],
    discard: [],
    hands: Object.fromEntries(seats.map((s) => [s.id, []])),
    eliminated: [],
    turnsRemaining: 1,
    turnDirection: 1,
    pending: null,
    peek: null,
    implodingRevealedAt: null,
    config,
  }),

  applyAction: () => notImplemented(NAME),

  ui: async () => {
    const { makeScaffoldUi } = await import('../_scaffold/ui');
    return makeScaffoldUi<EkState, EkAction, EkConfig>({
      gameName: NAME,
      premise:
        '2–5 players (6 with Imploding Kittens, 10 with Party Pack). Play cards, then end your turn by drawing. Draw a kitten without a Defuse and you are out. Last one alive wins.',
      expansions: EK_EXPANSIONS,
      todo: [
        'Decide how secret deck order works over P2P — Defuse reinsertion and See The Future depend on it (see README).',
        'Deterministic Nope reaction window: explicit respond/decline prompt per eligible holder, resolved last-in-first-out.',
        'Player elimination + turn advance that skips eliminated seats.',
        'Base 56-card deck composition, card-by-card, from the rulebook.',
        'Combos: 2-of-a-kind blind steal, 3-of-a-kind named demand, 5-different-cats discard grab.',
        'Attack turn-stacking (turnsRemaining) and Reverse (turnDirection).',
      ],
    });
  },
};
