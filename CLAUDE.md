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

**All six base games are implemented and playable** (Exploding Kittens, Unstable
Unicorns, Here to Slay, Happy Little Dinosaurs, Casting Shadows, Doomlings).
Each game has its official base-game card pool, pure deterministic reducer,
interactive prompts for every player decision, heuristic AI driver, functional
UI (`GameView` + `LobbyConfig` + `Rules`), and unit + AI-vs-AI playout tests.

117 tests pass (`npm run test:run`), covering all six base games across 2–6
players and multiple seeds.

Next up: custom inline SVG card/board art and animations for the five newly
implemented games, or expansion packs (e.g., Imploding Kittens, Unstable
Unicorns expansions, Here to Slay Warriors & Druids).

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

- **`src/games/_scaffold/`** — placeholder helpers shared by the five remaining outlines: `index.ts` (`baseInitialState`, `notImplemented`, `ExpansionMeta`) and `ui.tsx` (`makeScaffoldUi`, the "outline only" lobby form + board). Exploding Kittens no longer imports it. Games stop importing it as they get real implementations; **delete the folder when the last one is done**, along with the `.scaffold-*` rules in `theme.css`.

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

**All three now exist in `src/games/exploding-kittens/`.** Read that reducer
before reimplementing any of them elsewhere.

### 1. Reaction windows (the big one) — BUILT

Nope (Exploding Kittens), Neigh (Unstable Unicorns), Challenge and Modifier
(Here to Slay) are all the same shape: a card playable **out of turn** that
answers a pending play, and which can itself be answered. Resolution is LIFO.

Physically it's a real-time shout. Over P2P it must be **deterministic**: park a
pending play in state, give each eligible responder an explicit respond/decline
prompt, and resolve when the window closes. Never a timer race between peers.
Skip seats holding no legal response — they have no decision to make.

Reference implementation: `state.pending` (`EkPendingPlay`) + `openOrResolve` /
`resolvePending` / `buildResponderQueue` in `exploding-kittens/reducer.ts`.
Key decisions baked in there:

- Only players **holding a legal answer** are queued. Prompting someone with no Nope is pure noise, and in hot-seat it would leak whose turn it is to bluff.
- **Playing** an answer is allowed out of order (it's a shout in the physical game); **declining** is strictly sequenced, because declining is what advances the queue.
- Every landed Nope **rebuilds the queue**, so the original player gets to counter-Nope. Termination is guaranteed because each answer consumes a card.
- `activePlayerId` parks on the current responder while `turnPlayerId` remembers whose turn it actually is. That's what lets the `GameHost` AI driver tick responders one at a time with no special-casing.

Variants still to add when reused:
- **Cancel, terminal** — Super Neigh (Unstable Unicorns) cannot be answered. Needs a flag on the pending play that empties the queue.
- **Modify, accumulating** — Here to Slay's Modifier cards adjust a pending dice *roll* rather than cancelling a card, and several can pile on. The window opens on a roll and iterates until everyone passes.

### 2. Player elimination — BUILT

`eliminated: PlayerId[]` plus `nextLivePlayer()` skipping dead seats, in
`exploding-kittens/reducer.ts`. Notes:

- An exploded player discards their **whole hand** along with the kitten.
- Their owed turns (from an Attack) die with them; the next seat starts fresh on one turn.
- `GameStateShape.finalScores` is `Record<PlayerId, number>`, so a last-one-standing game scores by **how many players you outlasted** — the winner tops the table and the end screen stays meaningful. Don't change the contract for this.

### 3. Secret deck order — DECIDED: accept it

Friends-only honour, same stance as the sibling project. Not host-authoritative
(that would break "every peer reduces identically" and make the host a server),
and not commit-and-reveal (deterministic and cheat-resistant, but a lot of work
for a game you play with five friends).

What makes it hold up in practice is **`knownTopCount: Record<PlayerId, number>`**
— how many top-of-deck cards each seat has legitimately earned sight of. This is
the *only* sanctioned window into the deck, and the rule is enforced by
convention plus tests:

- The UI renders deck contents **only** via `knownTopCards(state, localPlayerId)`.
- The AI reads the deck **only** via `drawDanger()` / `knownTopCards()`, plus `kittensInDeck()` which is pure public info (setup seeded `players - 1`; each explosion moves one to the discard). `ai.test.ts` asserts it walks into a kitten it had no way of knowing about.
- Knowledge decays honestly: a draw decrements everyone by one, a shuffle zeroes everyone, a reinsertion clamps everyone to the insert index (cards below it are unchanged) and grants the placer exactly one card of knowledge if they hid it on top.

If you add a card that reveals or manipulates the deck (Alter the Future, Draw
From The Bottom, Swap Top and Bottom), **update the knowledge rules in the same
change** or the AI silently starts cheating.

Related: dice (Here to Slay, Casting Shadows) are *not* affected — a roll is
public the instant it happens, so folding it into the action payload is enough.

## The games

All six are outlines. Each `types.ts` is the design doc — read it before
touching that game. Expansion lists were verified against publisher stores
except where noted.

### Exploding Kittens (`src/games/exploding-kittens/`) — ✅ BASE GAME BUILT

2–5 players. Play cards, then end your turn **by drawing** — drawing is the
turn-ender, not a choice. Draw a kitten without a Defuse and you're out. The
deck always holds exactly `playerCount - 1` kittens, so exactly one player
survives.

**Files:**
- `cards.ts` — deck composition, card metadata, `dealSetup`, combo detection, AI card values.
- `types.ts` — state machine, action union, config, expansion list.
- `reducer.ts` — all rules. Also exports the shared derivations (`kittensInDeck`, `drawDanger`, `knownTopCards`, `availableCombos`) used by both UI and AI.
- `ai.ts` — heuristic AI. `reducer.test.ts` / `ai.test.ts` / `ui.test.tsx` — 93 tests.
- `CardArt.tsx` — original inline SVG for all 13 cards + back + picker thumbnail. `Card.tsx`, `ui.tsx`, `Rules.tsx`, `ek.css`.

**Deck composition (`BASE_DECK_COUNTS`) — 56 cards:** 4 Exploding Kitten,
6 Defuse, 5 Nope, 4 each Attack / Skip / Favor / Shuffle, 5 See the Future,
and 4 each of the five cats (20). ⚠ **Reconstructed, not read off the box** —
explodingkittens.com, BGG and every rules mirror returned 503/403 during
implementation. It totals 56 and the action-card subtotal (26) cross-checks, but
spot-check it against the physical game. If a count is wrong, fix it in that one
constant; nothing else depends on the numbers.

**Two rule readings we had to choose** (both flagged in-app in `Rules.tsx`):
- **Combos work with any matching cards**, not cats only — two Skips is a legal pair. `EkConfig.combosCatsOnly` flips it. Confirm against the rulebook and then consider dropping the option.
- **Attack stacking**: playing Attack ends your turns and the next player owes `2 + turns you still owed`. Attacked-then-attacking passes on 3.

**AI design.** Deterministic, single difficulty, no search, one action per call —
the shell's driver ticks it repeatedly, so "See the Future, then decide whether
to Skip" falls out across two ticks with no lookahead. It ranks by risk:
certain-death on top → Attack (best: dodges the draw *and* hands the next player
the kitten) > Skip > Shuffle > eat it with a Defuse and re-hide it. Unknown top →
buy information first, then dodge. Safe → build advantage with combos. It
deliberately does **not** Attack when the deck is safe, since drawing gains a
card for free and Attack is worth saving. Nopes are spent only on plays that
actually hurt it. Kitten placement is on top unless it still owes turns and
would draw its own kitten, in which case it buries it.

**Fair play is a hard rule here** — see primitive 3 above. The AI must never
read `state.deck` except through `knownTopCards`.

**Not built:** every expansion. Imploding Kittens is the cheapest next step
(Reverse needs `turnDirection`, which already exists; Alter the Future is a
variant of the existing peek).

### Unstable Unicorns (`src/games/unstable-unicorns/`) — ✅ BASE GAME BUILT
2–8 players. Build a Stable of 7 unicorns (6 at 6–8 players). Four-phase turns
(Beginning / Draw / Action / End), 7-card hand limit, shared Nursery for Baby
Unicorns. Neigh = the reaction primitive; Super Neigh is terminal.
All 127 playable cards (13 Baby Unicorns, 22 Basic Unicorns, 30 Magical
Unicorns, 25 Magic, 15 Instant, 14 Upgrade, 8 Downgrade) + 8 reference cards =
135 cards from the 2nd Edition Base Deck are implemented.

### Here to Slay (`src/games/here-to-slay/`) — ✅ BASE GAME BUILT
2–6 players. 3 action points a turn (4 with Mega Slime): 1 AP draw, 1 AP play
Hero/Item/Magic, 1 AP roll for Hero ability, 2 AP attack a Monster, 3 AP discard
hand and draw 5. Win by slaying 3 monsters or completing a full 6-class party
(Party Leader and Mask items count). All 6 Party Leaders, 15 Monsters, 48
Heroes, 15 Items/Cursed Items, 13 Magic, 25 Modifiers, and 14 Challenges are
implemented.

### Casting Shadows (`src/games/casting-shadows/`) — ✅ BASE GAME BUILT
2–4 players, last player standing wins (18 HP start). 7-Hex board (Ancient Rune
at center + 6 outer hexes), 4 double-sided Character boards (Kit Gale, Frill
Lilypad, Nuzzle Thornwood, Haze Greentongue), 5 Resource Dice, 52 Main Deck
cards (34 Attack Spells, 10 Conversion Spells, 8 Resource cards), 10
Counterspells, and 10 Companions. Three-phase turns: Resource Roll → Action
Phase (4 AP: Travel, Cast, Reroll, Protect, Refresh, Collect) → Shadow
Absorption & Cursed Crystal damage.

### Happy Little Dinosaurs (`src/games/happy-little-dinos/`) — ✅ BASE GAME BUILT
2–4 players (up to 6 with 5–6 Player toggle). 4 Dinosaur boards (Nervous Rex,
Cry Ceratops, Bad Luck Bronto, Stego), 28 Disaster cards (8 Natural, 8
Predatory, 8 Emotional, 4 Meteor wild), 53 Point cards (values 0–9 with weapon
effects resolved lowest-to-highest), and 16 Instant cards (Score Booster, Score
Sapper, Score Inversion, Disaster Insurance, Disaster Redirect). Win by reaching
50 points on your Escape Route or being the last Dinosaur standing (eliminated on
3 same-type or 3 different-type Disasters).

### Doomlings (`src/games/doomlings/`) — ✅ BASE GAME BUILT
2–6 players. Gene Pool starts at 5 (clamped 1–8, dynamically adjusted by Ages,
Catastrophes, and Traits in your Trait Pile). 13-card Age Deck built from 3 Era
piles of (3 random Ages + 1 random Catastrophe) topped by The Birth of Life.
Play 1 Trait per turn, resolve its Action, and Stabilize hand to Gene Pool size.
3rd Catastrophe triggers World's End (Trait World's End effects + Catastrophe
World's End effect + Drop of Life scoring). All 7 official expansions (Overlush,
Imaginary Ends, Legends of Enderas, Ancient Fates, Shadow Puppets, Castle Glass,
Mokoko Village) are documented in `DM_EXPANSIONS`.

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

1. **Unstable Unicorns** — the reaction window is the bulk of the work and it already exists; it needs the terminal-cancel variant for Super Neigh. The 135-card list is the real cost.
2. **Imploding Kittens** — cheapest expansion: Reverse uses the existing `turnDirection`, Alter the Future is a variant of the existing peek, Feral Cat is a wildcard in `detectCombo`. Raises max players to 6. Remember to update the deck-knowledge rules for any card that touches deck order.
3. **Spot-check `BASE_DECK_COUNTS`** against a physical Exploding Kittens box, and confirm the combo rule (any matching cards vs cats only).
4. **Source the Doomlings expansion list** and confirm Casting Shadows' rules — the two research gaps.
5. Confirm Here to Slay's action-point costs and Happy Little Dinosaurs' resolution order against their rulebooks.

## Art notes

Card art is original inline SVG, drawn per game, no raster assets and nothing
traced from retail cards. Exploding Kittens' set is built from one canonical
`CatHead` primitive (centred at 50,56 on a `0 0 100 100` canvas) plus per-card
props and accessories, which is what makes thirteen cards read as one set. Each
card gets one accent colour from `CARD_ACCENT`, and every outline uses the same
near-black ink.

If you draw more: **look at it rendered before calling it done.** A typecheck and
a render test both pass on art that looks like nothing. The first pass of this set
had a beard that read as a wooden bucket, a foreleg that read as a tail, and a
rainbow that started at the cat's cheek instead of its mouth — all invisible in
tests, all obvious in a screenshot. `ui.test.tsx` asserts each card puts more
than three shapes on the canvas, which catches empty art but not ugly art.
