// Dev-only deep links for art reviews and screenshots (scripts/render.mjs).
// Never shipped: App calls this behind `import.meta.env.DEV`, so production
// builds drop it.
//
//   ?demo=<gameId>          a hot-seat match: you + AIs, fast-forwarded by the
//                           AIs (your seat too) until it's your move again
//   &players=4 &seed=7      table size, deal
//   &moves=40               AI moves to play before handing you the turn
//   &over                   play to the end (the game-over screen)
//   &sub=<subPhase>         keep going until it's your decision in that sub-phase
//                           (every game's state has a `subPhase`); seeds are tried
//                           from &seed upwards until one gets there
//   &exp=a,b                expansion ids to enable
//   &humans=2               seats that are human (hot-seat: shows the pass-the-device screen)
//   ?lobby=<gameId>         that game's lobby
//   ?gallery=<gameId>       every card face the game draws (its ui bundle's Gallery)

import { getGameById } from '@/games/registry';
import type { GameStateShape } from '@/core/module';
import { playOut } from '@/core/playout';
import { SEAT_COLORS } from '@/core/seatColors';
import type { Seat } from '@/core/types';
import { getOrCreateUuid } from '@/net/identity';
import { useGameStore } from '@/store/gameStore';

const NAMES = ['Ash', 'Mabel', 'Rook', 'Juniper', 'Ozzie', 'Wren', 'Pip', 'Sable', 'Tamsin', 'Fig'];

export type DemoRoute = { kind: 'playing' } | { kind: 'lobby'; gameId: string } | { kind: 'gallery'; gameId: string } | null;

export function demoRoute(): DemoRoute {
  const q = new URLSearchParams(window.location.search);
  const gallery = q.get('gallery');
  if (gallery && getGameById(gallery)) return { kind: 'gallery', gameId: gallery };
  const lobby = q.get('lobby');
  if (lobby && getGameById(lobby)) return { kind: 'lobby', gameId: lobby };
  const id = q.get('demo');
  const module = id ? getGameById(id) : undefined;
  if (!module) return null;

  const players = Math.min(module.maxPlayers, Math.max(module.minPlayers, Number(q.get('players') ?? 4)));
  const me = getOrCreateUuid();
  const humans = Math.max(1, Number(q.get('humans') ?? 1));
  const seats: Seat[] = Array.from({ length: players }, (_, i) => ({
    id: i === 0 ? me : i < humans ? `human-${i}` : `ai-${i}`,
    name: NAMES[i] ?? `AI ${i}`,
    color: SEAT_COLORS[i % SEAT_COLORS.length]!,
    isAI: i >= humans,
    isLocal: true,
  }));
  const config = module.defaultConfig(seats) as Record<string, unknown>;
  const exp = q.get('exp');
  if (exp) config.expansions = exp.split(',').filter(Boolean);
  const seed = Number(q.get('seed') ?? 7);
  const sub = q.get('sub');
  const mine = (s: GameStateShape) =>
    s.activePlayerId === me && (!sub || (s as GameStateShape & { subPhase?: string }).subPhase === sub);

  // Every seat (yours included) plays as AI while fast-forwarding.
  const deal = (sd: number) => module.createInitialState(config, sd, seats) as GameStateShape;
  let state = deal(seed);
  if (q.has('over')) {
    state = playOut(module, state, 20000).state;
  } else if (sub) {
    for (let sd = seed; sd < seed + 60; sd++) {
      const tried = playOut(module, playOut(module, deal(sd), Number(q.get('moves') ?? 0)).state, 3000, mine).state;
      state = tried;
      if (mine(tried)) break;
    }
  } else {
    state = playOut(module, state, Number(q.get('moves') ?? 30)).state;
    state = playOut(module, state, 2000, mine).state;
  }
  useGameStore.getState().loadGame(module, state, me, { config, seats });
  return { kind: 'playing' };
}
