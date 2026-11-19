// Seeded RNG (mulberry32). Deterministic — every peer reduces to the same state
// when fed the same actions, so RNG-bearing actions (card draws, shuffles) carry
// their seed inline rather than relying on Math.random().

export type RngState = { seed: number };

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0 };
}

function rngNext(state: RngState): number {
  state.seed = (state.seed + 0x6d2b79f5) >>> 0;
  let t = state.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function rngInt(state: RngState, maxExclusive: number): number {
  return Math.floor(rngNext(state) * maxExclusive);
}

export function shuffle<T>(state: RngState, arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rngInt(state, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function randomSeed(): number {
  return (Math.random() * 0x100000000) >>> 0;
}

/** FNV-1a (32-bit) of a string: a stable number for a card kind, a seat id… */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A stream of numbers in [0, 1) fixed by `seed` — for drawing art that must
 * look the same for the same card on every render and every device. Never for
 * game logic: that draws from the state's own RngState.
 */
export function seededRandom(seed: number | string): () => number {
  const state = createRng(typeof seed === 'string' ? hashString(seed) : seed);
  return () => rngNext(state);
}
