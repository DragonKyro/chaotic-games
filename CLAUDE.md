# CLAUDE.md

Context for Claude working in this repo.

**Keep this file and [README.md](README.md) current.** Update them as part of the
work, not afterwards — whenever a game moves from outline to implemented, a rule
gets confirmed against a rulebook, an expansion list changes, or an
architectural decision is made (especially the secret-deck-order question below).

## What this is

A personal multi-game web app for **chaotic take-that card games** — Exploding
Kittens, Unstable Unicorns, Here to Slay, Casting Shadows, Happy Little
Dinosaurs, Doomlings. Hosted on GitHub Pages, played hot-seat or with friends
over WebRTC. No backend.

Sibling project: `../card-collecting` (Sushi Go, Sea Salt & Paper, 7 Wonders,
7 Wonders Duel, Air Land & Sea). **All infrastructure here was copied from it**
— same `GameModule` contract, same netcode, same shell. When you need a pattern
for something (simultaneous picks, expansion hooks, AI drivers, hidden info),
look there first; it has five finished games' worth of precedent.

## Current status

**Infrastructure complete. All six games are OUTLINES ONLY.** Each has a
`types.ts` with state/action/config types plus design notes, and a `module.ts`
whose `applyAction` throws via `notImplemented()`. No reducers, no cards, no art.

Next up: **Exploding Kittens** — it's the smallest ruleset that forces all three
engine primitives this family needs (see below).

## Tech stack (locked)

TypeScript, Vite, React 19, Zustand for state, Trystero (`/torrent`) for WebRTC
P2P, Vitest for tests. No backend — GitHub Pages is static-only.

## Architecture

Five layers, separated by directory:

- **`src/core/`** — `GameModule<S, A, C>` contract, seeded RNG (mulberry32 in `rng.ts`), shared types (`Seat`, `PlayerId`, `GamePhase`). Game-agnostic — never references a specific game.
- **`src/games/<id>/`** — one folder per game. Each folder owns its own types, reducer (`applyAction`), AI, and UI bundle. Registered in `src/games/registry.ts`.
- **`src/net/`** — Trystero wrapper (`room.ts`), stable identity (`identity.ts` — localStorage UUID + `?fresh` escape hatch), wire envelopes (`types.ts`).
- **`src/store/`** — Zustand stores (`gameStore`, `networkStore`). `gameStore` holds the active module + state and exposes `dispatch` (broadcasts) and `applyLocal` (silent receiver path).
- **`src/ui/`** — Game-agnostic shell: `App.tsx` (route between picker / lobby / playing), `GameLobby.tsx` (seat builder + game's `LobbyConfig`), `GameHost.tsx` (mounts the active game's `GameView`), `ChatPanel.tsx`, `RulesBook.tsx`, `theme.css`.

Plus one temporary folder:

- **`src/games/_scaffold/`** — placeholder helpers shared by the six outlines: `index.ts` (`baseInitialState`, `notImplemented`, `ExpansionMeta`) and `ui.tsx` (`makeScaffoldUi`, the "outline only" lobby form + board). Games stop importing it as they get real implementations; **delete the folder when the last one is done**, along with the `.scaffold-*` rules in `theme.css`.

## GameModule contract

The single rule that makes the multi-game design work:

```ts
GameModule<S, A, C> {
  id, name, tagline, minPlayers, maxPlayers
  defaultConfig(seats) → C
  validateConfig(config) → string[]
  createInitialState(config, seed, seats) → S
  applyAction(state, action) → S          // pure, deterministic
  chooseAIAction?(state, playerId) → A | null
  Thumbnail?: React.ComponentType
  ui() → Promise<{ LobbyConfig, GameView, Rules? }>   // lazy-loaded
}
```

**Hard invariants every module must uphold:**
- `applyAction` is pure. No `Date.now`, no `Math.random`, no I/O. RNG draws from `state.rngState`.
- Randomness chosen by the acting player (deals, draws, **dice**) is folded into the action payload so all peers reduce identically.
- `S` (game state) is JSON-serializable — sent over the wire, snapshotted on join.
- The full state is replicated; hidden-information rules are a UI concern. Friends-only honor, no anti-cheat. **But see the deck-order caveat — it bites harder in this family than in the sibling project.**

The shell, store, and net layer never name a specific game. Adding a new game
means: drop a folder, register it, done.

## Multiplayer model

- **Trystero `/torrent`** for WebRTC signaling. No backend. App ID `chaotic-games-v1`; room code is both the topic and the encryption password. Lazy-imported in `src/net/room.ts` so the solo bundle stays small.
- **Stable identity**: `localStorage` UUID (`chaotic-games.uuid`), exchanged via `hello` channel. `?fresh` flips storage to `sessionStorage` for two-window local testing.
- **Full state replication**: every peer holds full `GameState`.
- **Actions, not diffs**: `{ byUuid, actionJson }` envelopes; receivers verify the UUID owns a seat in `lobby.seats` before applying via `gameStore.applyLocal`.
- **Determinism**: randomness lives in `state.rngState` (mulberry32 seeded at game start), plus per-action payload for player-chosen draws and dice.
- **Host-authoritative lobby**: host owns lobby state, broadcasts on every edit. Seat assignment is done by the host via a per-seat peer dropdown. Start broadcasts the initial `GameState` + `seatUuids[]`.
- **Rejoin / spectator**: when a peer says hello, the host responds with `sendLobby` (always) and `sendSnapshot(toPeerId)` (if a game is in flight). Joiner's uuid matching a seat → guest; otherwise spectator (read-only — dispatch is no-op'd in `GameHost`).
- **AI in online**: only the host runs `chooseAIAction`, fired from `GameHost.tsx` when `state.activePlayerId` resolves to an AI seat. Driver early-returns for `guest` / `spectator`. If the host drops, AI seats freeze.
- **Chat**: in-memory in `networkStore.chat`, not part of `GameState`.
- **Channels**: `hello`, `lobby`, `start`, `action`, `snap`, `chat`. Each is a separate `makeAction` namespace.

## The three chaos primitives

This family needs three engine capabilities the card-collecting games never did.
Build each **once**, in the first game that needs it, then reuse. Don't build
them speculatively.

### 1. Reaction windows (the big one)

Nope (Exploding Kittens), Neigh (Unstable Unicorns), Challenge and Modifier
(Here to Slay) are all the same shape: a card playable **out of turn** that
answers a pending play, and which can itself be answered. Resolution is LIFO.

Physically it's a real-time shout. Over P2P it must be **deterministic**: park a
pending play in state, give each eligible responder an explicit respond/decline
prompt, and resolve when the window closes. Never a timer race between peers.
Skip seats holding no legal response — they have no decision to make.

Variants the primitive must support:
- **Cancel, stackable** — Nope, Neigh, Challenge. Odd count = negated.
- **Cancel, terminal** — Super Neigh cannot be answered.
- **Modify, accumulating** — Here to Slay's Modifier cards adjust a pending dice roll rather than cancelling it, and several can pile on. The window opens on a *roll*, not on a card play, and iterates until everyone passes.

`activePlayerId` should park on the next eligible responder during an open
window so the `GameHost` AI driver ticks them one at a time — the same trick the
sibling project used for simultaneous picks.

### 2. Player elimination

Exploding Kittens knocks players out; Happy Little Dinosaurs runs them off a
track. Needs an `eliminated: PlayerId[]` concept and turn advance that skips
dead seats. Note `GameStateShape.finalScores` is `Record<PlayerId, number>` —
for a last-one-standing game, score it 1/0 rather than changing the contract.

### 3. Secret deck order — UNRESOLVED, decide before Exploding Kittens

The sibling project's hidden information was opponents' hands: easy to
honor-system, since you have no reason to peek. This family leans on **secret
deck order** — See The Future, Alter the Future, and especially Defuse
reinsertion are only fun if you can't read the deck. Full state replication
means a determined player can open devtools and see it.

Three options:
1. **Accept it** — friends-only honor, consistent with the sibling project.
2. **Host-authoritative deck** — keep order only on the host and stream reveals. Breaks the "every peer reduces identically" invariant and makes the host a server.
3. **Commit-and-reveal** — hash the shuffled order at setup, reveal with proofs. Deterministic and cheat-resistant, but a real chunk of work.

**No decision yet.** Pick one before writing the Exploding Kittens reducer, and
record the choice here and in README.

Related: dice (Here to Slay, Casting Shadows) are *not* affected — a roll is
public the instant it happens, so folding it into the action payload is enough.

## The games

All six are outlines. Each `types.ts` is the design doc — read it before
touching that game. Expansion lists were verified against publisher stores
except where noted.

### Exploding Kittens (`src/games/exploding-kittens/`)
2–5 players (6 with Imploding Kittens, 10 with Party Pack). Play cards, then end
your turn **by drawing** — drawing is the turn-ender, not a choice. Draw a
kitten without a Defuse and you're out. Deck always holds exactly
`playerCount - 1` kittens.
Expansions (verified): Imploding Kittens, Streaking Kittens, Barking Kittens,
Zombie Kittens, Party Pack, Recipes for Disaster.
Needs: all three primitives. **Implement this first.**

### Unstable Unicorns (`src/games/unstable-unicorns/`)
2–8 players. Build a Stable of 7 unicorns (6 at 6–8 players). Four-phase turns
(Beginning / Draw / Action / End), 7-card hand limit, shared Nursery for Baby
Unicorns. Neigh = the reaction primitive; Super Neigh is terminal.
Expansions (verified): Uncut Unicorns, NSFW, Rainbow Apocalypse, Dragons,
Unicorns of Legend, Adventures, Christmas, Nightmares.
Editions (Control, Chaos, Diamond, Travel, Kids, NSFW, 2nd) are **alternate base
decks, not stackable expansions** — `UuConfig.edition`, exactly one.
135 base cards need rulebook text; model by trigger tier.

### Here to Slay (`src/games/here-to-slay/`)
2–6 players. 3 action points a turn; recruit heroes, equip items, attack monsters
with 2d6. Win by slaying 3 monsters or completing a full party.
Expansions (verified): Warriors & Druids, Berserkers & Necromancers, Here to Sleigh.
⚠ Action-point costs in `types.ts` are from memory — confirm before coding.
⚠ Whether 'dragon' is a playable class or just a cosmetic dice/meeple line is unconfirmed.

### Casting Shadows (`src/games/casting-shadows/`)
⚠ **Least verified outline in the repo.** Expansion names are confirmed (The Ice
Storm, The Molten Rock); the *rules* in `types.ts` are reconstructed from general
knowledge and the components sold alongside it. Get the rulebook before writing
anything. First game here with **spatial state** (board tiles, positions,
adjacency) and dice pools.

### Happy Little Dinosaurs (`src/games/happy-little-dinos/`)
2–4 players, 6 with the player expansion. Flip a disaster, everyone commits a
point card face down, reveal, whoever fails takes the hit and moves down their
survival track.
Expansions (verified): Hazards Ahead, Dating Disasters, Perils of Puberty, 5–6 Player.
⚠ Resolution order, track length and disaster category names are reconstructed.
Simultaneous face-down commits — reuse the sibling project's `pendingPick` +
reveal-tick pattern, **including parking `activePlayerId` on the next
un-submitted AI seat** or all-AI matches freeze. That trap was hit twice over there.

### Doomlings (`src/games/doomlings/`)
⚠ **The one game with no verified expansion list** — doomlings.com returned 503
and BGG blocked fetches during research, so `DM_EXPANSIONS` is deliberately
empty rather than guessed. Source it from the publisher before building lobby
toggles. Tableau of trait cards, Ages deck driving the clock with catastrophes
shuffled in, most points at the World's End.

## Conventions

- Strict TypeScript. No `any` unless genuinely necessary.
- Co-locate tests next to code: `reducer.ts` and `reducer.test.ts` side by side.
- Game logic in `src/games/<id>/` must not import from `src/ui`, `src/net`, or `src/store`.
- The net layer may import from `src/core` but not `src/ui`.
- Path alias: `@/` → `src/`.
- Game-specific UI is lazy-loaded via `module.ui()` — keeps the picker bundle tiny. Don't statically import a game's UI from its `module.ts`; it defeats the split.
- Don't introduce game-agnostic code into a game folder, or game-specific code into the shell. If you're about to, you probably want a new field on `GameModule` or `GameStateShape` instead.
- Ongoing / continuous card effects are computed by walking the tableau on read — **never stored as flags**. (Sibling-project rule, learned the hard way.)
- Expansions get hooks, not `if (expansion === ...)` conditionals in the base reducer. See `../card-collecting/src/games/seven-wonders/expansions/` for the pattern.
- When a rule can't be confirmed, model it as a **placeholder no-op with a "not modeled" note** rather than guessing. Flag it in `types.ts` and in this file.

## Commands

- `npm run dev` — local dev server at `http://localhost:5173/chaotic-games/`
- `npm run build` — production build (`tsc` typecheck then `vite build`)
- `npm run typecheck` — `tsc` no-emit
- `npm run test` — Vitest watch
- `npm run test:run` — Vitest single run

## Deployment

`.github/workflows/deploy.yml` deploys `dist/` to GitHub Pages on push to
`main`. Vite `base` is `/chaotic-games/` — update in `vite.config.ts` if the repo
is renamed. CI uses `npm install` (not `npm ci`) because the committed lockfile
carries Artifactory URLs from Kyle's local environment; the project `.npmrc`
points CI at public npmjs.org.

## Non-goals (do not implement)

- Persistent saves between sessions
- User accounts, matchmaking, lobby browser
- Anti-cheat / verifiable randomness — *unless* the deck-order question forces option 3
- Monetization, ads, telemetry
- Server-side anything

## Where to start next

1. **Decide the secret-deck-order question.** It blocks Exploding Kittens.
2. **Exploding Kittens**: `cards.ts` (56-card base deck, card-by-card from the rulebook) → reaction window → elimination + turn advance → combos → reducer tests.
3. **Source the Doomlings expansion list** and confirm Casting Shadows' rules — the two research gaps.
4. Confirm Here to Slay's action-point costs and Happy Little Dinosaurs' resolution order against their rulebooks.
