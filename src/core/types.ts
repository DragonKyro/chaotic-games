// Cross-game shared types. Anything specific to a particular game lives in its
// own module under src/games/<id>/.

export type PlayerId = string;

export type Seat = {
  id: PlayerId;          // stable identity (uuid)
  name: string;
  color: string;         // hex
  isAI: boolean;
  isLocal: boolean;      // a seat on this device's hot-seat table (online seats are never local)
  /** AI seats: one of the module's `aiLevels` ids (absent = the module's default level). */
  aiLevel?: string;
};

export type GamePhase = 'lobby' | 'playing' | 'gameOver';

/** One expansion / add-on for a game, as sold. */
export interface ExpansionMeta {
  /** Stable id stored in config.expansions and over the wire. */
  id: string;
  name: string;
  /** What it adds, one line. */
  summary: string;
  /**
   * false = the name or contents still need confirming against the physical
   * product or rulebook. Never treat an unverified entry as authoritative.
   */
  verified: boolean;
}

/** Every game's config carries at least the set of enabled expansion ids. */
export interface ExpansionConfig {
  expansions: string[];
}
