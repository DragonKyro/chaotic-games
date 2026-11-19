// Helpers every game's reducer shares. Game-agnostic: they touch only fields
// common to every game's state (seats, the move log, the eliminated list),
// typed structurally so any game's state fits.

import type { PlayerId, Seat } from './types';

/** Drives log styling: explosions and eliminations read differently from good news. */
export type LogTone = 'normal' | 'danger' | 'good';

export interface LogEntry {
  /** Monotonic counter, not a timestamp — reducers must stay pure. */
  seq: number;
  byPlayerId: PlayerId | null;
  text: string;
  tone: LogTone;
}

/** Entries kept in a game's log (it's replicated, so it stays short). */
const LOG_CAP = 60;

/** A deep copy for a reducer to mutate. JSON round-trip: states are JSON by contract. */
export function cloneState<S>(state: S): S {
  return JSON.parse(JSON.stringify(state)) as S;
}

export function pushLog(
  s: { log: LogEntry[]; logSeq: number },
  byPlayerId: PlayerId | null,
  text: string,
  tone: LogTone,
): void {
  s.logSeq += 1;
  s.log.push({ seq: s.logSeq, byPlayerId, text, tone });
  if (s.log.length > LOG_CAP) s.log = s.log.slice(-LOG_CAP);
}

export function seatName(s: { seats: readonly Seat[] }, id: PlayerId | null): string {
  if (!id) return 'Someone';
  return s.seats.find((x) => x.id === id)?.name ?? 'Someone';
}

/** For games with player elimination. */
export function isLive(s: { eliminated: readonly PlayerId[] }, id: PlayerId): boolean {
  return !s.eliminated.includes(id);
}

export function livePlayerIds(s: { seats: readonly Seat[]; eliminated: readonly PlayerId[] }): PlayerId[] {
  return s.seats.filter((x) => isLive(s, x.id)).map((x) => x.id);
}
