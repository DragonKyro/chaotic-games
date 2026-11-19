# CLAUDE.md

Context for Claude working in this repo.

**Keep this file and [README.md](README.md) current.** Update them as part of the
work, not afterwards — whenever a game moves from outline to implemented, a rule
gets confirmed against a rulebook, an expansion list changes, or an
architectural decision is made (especially the secret-deck-order question below).

## What this is

A personal multi-game web app for **chaotic take-that card games** — Exploding
Kittens, Unstable Unicorns, Here to Slay, Casting Shadows, Happy Little
Dinosaurs, Doomlings. Hosted on GitHub Pages, played hot-seat or with friends online
(rooms in a Firebase Realtime Database shared with Kyle's other game sites).
No server code of our own.

Sibling project: `../card-collecting` (Sushi Go, Sea Salt & Paper, 7 Wonders,
7 Wonders Duel, Air Land & Sea). **All infrastructure here was copied from it**
— same `GameModule` contract, same netcode, same shell. When you need a pattern
for something (simultaneous picks, expansion hooks, AI drivers, hidden info),
look there first; it has five finished games' worth of precedent.

## Current status

**All six base games AND all 30 expansions are implemented and playable**
(Exploding Kittens + 6 expansions, Unstable Unicorns + 8 expansions & 6 base
editions, Here to Slay + 3 expansions, Happy Little Dinosaurs + 4 expansions,
Casting Shadows + 2 expansions, Doomlings + 7 expansions). Each game has its
official base and expansion card pools, pure deterministic reducer, interactive
prompts for every player decision, heuristic AI driver, its own art direction
(original SVG card art system, card back, board, home-page `Thumbnail`, a
`Gallery` of every card face), a `GameView` built on the shared kit with
state-driven FX, `LobbyConfig`, `Rules`, and unit + AI-vs-AI playout tests.

242 tests pass (`npm run test:run`), covering all six base games and all 30
expansions across 2–10 players and multiple seeds, plus the online layer
(rooms, lobby, action log, races, rejoin, spectators), a whole online match
of each of the six games, and UI tests for Exploding Kittens and Happy Little
Dinosaurs (every state of full AI games renders; no hidden card leaks).

## Tech stack (locked)

TypeScript, Vite, React 19, Zustand for state, Firebase Realtime Database +
anonymous Auth for online play (project `github-games-e7c7d`, shared with Kyle's
other game sites — this app's data lives under `/chaotic-games`), Vitest for
tests. No server code of our own: GitHub Pages hosts the static site, Firebase
holds the rooms, and the only server-side logic is the security rules in
`database.rules.json`.

## Architecture

Five layers, separated by directory:

- **`src/core/`** — `GameModule<S, A, C>` contract, seeded RNG (mulberry32 in `rng.ts`), shared types (`Seat`, `PlayerId`, `GamePhase`, `ExpansionMeta`, `ExpansionConfig`), the helpers every reducer shares (`state.ts`: `LogEntry`, `pushLog`, `cloneState`, `seatName`, `isLive`, `livePlayerIds`), `playout.ts` (`playOut` drives a match with its own AI the way the shell does, and `makeSeats`; used by every game's tests and the dev demo), seat helpers (`seats.ts`: simultaneous-decision order, AI levels) and the seat colour palette (`seatColors.ts`). Game-agnostic — never references a specific game.
- **`src/games/<id>/`** — one folder per game. Each folder owns its own types, reducer (`applyAction`), AI, and UI bundle. Registered in `src/games/registry.ts`.
- **`src/net/`** — the room transport: `transport.ts` (the `RoomTransport` / `RoomConnection` interface, log-slot encoding), `firebaseRoom.ts` (the Firebase implementation, lazy-loaded), `fakeTransport.ts` (in-memory server for tests); `identity.ts` (localStorage UUID + saved name + room codes, `?fresh` escape hatch), `roomLink.ts` (`?room=CODE` in the URL), wire types (`types.ts`). Never imports from `src/store` or `src/ui`.
- **`src/store/`** — Zustand stores (`gameStore`, `networkStore`) plus `actionSync.ts` (the online action log's pending queue and rollback). `gameStore` holds the active module + state and exposes `dispatch` (hands the move to networkStore's broadcast handler when online) and `applyLocal` (silent receiver path).
- **`src/ui/`** — Game-agnostic shell: `App.tsx` (routes between home / lobby / playing, or by room state while online), `Brand.tsx` (the logo mark), `GameLobby.tsx` (local seat builder + game's `LobbyConfig` + "Host online"), `OnlineLobby.tsx` (the room's lobby), `OnlineStatus.tsx` (join box, connecting / error card), `lobbyParts.tsx` (`LobbyBanner`, seat pickers, `RulesModal`), `GameHost.tsx` (mounts the active game's `GameView`, runs the AI driver, the hot-seat hand-off), `ChatPanel.tsx`, `RulesBook.tsx` (`RulesBook` / `RulesTable` / tiles), `theme.css` (the design system), `devDemo.ts` (dev-only deep links, see Commands).
- **`src/ui/kit/`** — the game-view kit every game's `ui.tsx` builds on: `GameTable` (layout), `PlayerStrip` / `PlayerPlate`, `Dock` (the decision panel), `CardFan` (the hand), `CardShell` (a card's button-or-div outer element plus hover zoom), `GameLog`, `Panel` / `Chip`, `useFx` + `FxLayer` (stamps, toasts, bursts), `TurnCue`, `GameOverPanel` (with confetti for a local win), `ExpansionPicker`, `Die`, `Tally`, `Inspect` (hover zoom), and hooks (`useSvgIds`, `useChangeKey`, `usePulse`). Art helpers that need no kit: `hashString` / `seededRandom` in `src/core/rng.ts`. Themed entirely by `--cg-*` CSS variables (`kit.css` header). See "UI and art" below.

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
  accent?: string                                     // signature colour: home tile, lobby banner, in-game bar
  Thumbnail?: React.ComponentType
  ui() → Promise<{ LobbyConfig, GameView, Rules?, Gallery? }>   // lazy-loaded
}
```

The shell also honours some optional fields that came over with the Firebase
netcode from card-collecting. **None of the six games sets them yet**, so all
of them run on the defaults: `onlineSupported` (default true), `replayInLobby`,
`hiddenInfo` (default true: hot-seat shows the pass-the-device screen),
`aiLevels` / `defaultAiLevel` (per-seat AI difficulty), `aiDelayMs`, `prepare`
(async setup before a match, e.g. loading AI policy files), and
`validateConfig(config, seats?)`. `LobbyConfig` receives `readOnly` for an
online guest.

**Hard invariants every module must uphold:**
- `applyAction` is pure. No `Date.now`, no `Math.random`, no I/O. RNG draws from `state.rngState`.
- Randomness chosen by the acting player (deals, draws, **dice**) is folded into the action payload so all peers reduce identically.
- `S` (game state) is JSON-serializable — sent over the wire, snapshotted on join.
- `createInitialState` must be pure given `(config, seed, seats)`: online, every device builds the opening itself from the room's start record.
- Every device holds the full state; hidden-information rules are a UI concern. Friends-only honor, no anti-cheat. **But see the deck-order caveat — it bites harder in this family than in the sibling project.**

The shell, store, and net layer never name a specific game. Adding a new game
means: drop a folder, register it, done.

## Multiplayer model

Ported from card-collecting (commit `eb1a838`), which ported it from the Catan
project. Trystero / WebRTC was dropped for the same reason they dropped it:
peer-to-peer never connected reliably (strict NAT with no TURN server, flaky
trackers, phones dropping sockets in the background).

- **Firebase Realtime Database** (instance `github-games-e7c7d-default-rtdb`, web app "Chaotic Games") via the Firebase JS SDK: one WebSocket on port 443, so it works on cellular and locked-down networks. The SDK loads lazily (`import('@/net/firebaseRoom')` from `networkStore`, its own ~77 KB gzip chunk); `warmUpNetwork()` starts it (and the sign-in) when an online box gets focus or the pointer. Solo / hot-seat play never downloads it or holds a connection: the transport `goOffline`s whenever no room is open.
- **Shared database — everything is prefixed.** Several web apps (Catan, card-collecting, Tractor, Mahjong, …) use the one database, so everything this app stores is under one top-level key, `DB_ROOT = 'chaotic-games'` (`firebaseRoom.ts`; every path below is relative to it), and `database.rules.json` defines only that key (root `.read` / `.write` stay false). A database has a single rules set, so a plain deploy would wipe the other apps' rules: `firebase.json`'s predeploy hook runs `scripts/merge-db-rules.mjs` (copied from the siblings), which reads the live rules, replaces only the keys our file defines and deploys the merged `.firebase/database.rules.deploy.json` (git-ignored); it refuses to deploy if the live rules can't be read. First deployed 2026-11-18.
- **Keep usage small.** The database bills bytes stored and downloaded plus open connections (free plan: 1 GB stored, 10 GB/month downloaded, 100 simultaneous connections — shared by every app on the database), not reads or writes. Every device downloads every move of the current match and a rejoin downloads its whole log, so payloads carry only what devices read: the start record is `createInitialState`'s inputs (not the state), a move is `{"a": action, "n": 8-char nonce}`.
- **Identity**: each device signs in **anonymously and silently** (no visible login). The uid exists only so the rules can tie writes to a device. Seats belong to the `localStorage` UUID (`chaotic-games.uuid`); an online human seat's `id` *is* its owner's UUID (so it's the `PlayerId` in game state), AI seats are `ai-N`. `?fresh` puts the UUID and the sign-in in `sessionStorage`, so two windows of one incognito session are two devices. The display name is saved too (`chaotic-games.displayName`).
- **Room layout** (`rooms/{CODE}`, header of `src/net/firebaseRoom.ts`): `meta` (host uuid / uid, createdAt, `build`, protocol `v`), `lobby` (JSON string of `LobbyState`; edited by transaction), `matches/m{N}/start` (`StartRecord`: `gameId`, `configJson`, `seed`, `seats`, `hostUuid`, `startedAt`, `check`sum of the built opening; write-once, host only), `matches/m{N}/actions/aNNNNNN` (write-once log slots), `chat/`, `presence/` (removed by `onDisconnect`). Payloads are JSON strings because the database drops empty arrays / objects and turns arrays into keyed objects. Written with each room: `roomDays/{day}` and `roomIndex/{day}/{CODE}`, so each new room's host sweeps rooms over a week old that nobody is in.
- **Rules** (`database.rules.json`; deploy with `npm run deploy:rules`): signed-in devices read a room by its code (no listing); a room can be created over a free code only; a week-old empty room can be deleted by anyone; `meta` is never rewritten; anyone in the room edits the lobby; a match's `start` once, by the host's uid; its log slots once each, only after its start; chat once per id; presence only by its own uid; size caps everywhere. Changing the layout means bumping `PROTOCOL_VERSION` and the `v` check in the rules together.
- **The action log is the source of truth.** Every device runs `createInitialState(JSON.parse(configJson), seed, seats)` and applies the match's log in slot order, so all devices reduce identically; one whose opening doesn't match `check` (another app version) gets a chat warning. `ActionSync`: your own move applies at once and goes in a pending queue; the head is written to the next free slot with a transaction. When another device's move took the slot (say, two players Noping the same play at once), the device restores its state, applies theirs, and replays its own on top: still-legal moves are rewritten, the rest dropped with a notice. **This is what keeps the reaction-window design below honest online**: playing an answer out of order is allowed, so two devices can race, and the log picks the winner deterministically.
- **Lobby** (`OnlineLobby.tsx`): guests seat themselves; each player renames / recolors their own seat; the host picks the game (the room isn't tied to one), its options (guests see `LobbyConfig` read-only), adds / removes AI seats, and starts. `lobbyStartProblem` surfaces `validateConfig` errors. A local lobby's "Host online" carries its options and AI seats into the new room.
- **Joining**: by code, or by link (`?room=ABCD` rides in the URL; a reload or "Copy invite link" rejoins automatically when a name is saved). Role: host uuid → host (a reloading host is the host again); a seat in the match → guest; else spectator (read-only). Devices on another `build` (`__APP_BUILD__`, the commit on CI) get a chat warning.
- **AI in online**: one device runs `chooseAIAction` — the host while it's connected, else the first connected seated human (a stand-in), and the host again when it returns. Every device derives it from presence, so they agree. `GameHost.tsx`'s driver fires when `state.activePlayerId` resolves to an AI seat — which is why reducers park `activePlayerId` on reaction-window responders (see below).
- **Chat**: stored in the room so rejoiners see it; mirrored in `networkStore.chat`, not part of `GameState`.
- **Tests**: `fakeTransport.ts` has the database's semantics (write-once slots, atomic lobby, async events, staged races). `networkStore.test.ts` runs several "devices" against a stand-in registry (`store/testGames.ts`). `networkStore.games.test.ts` plays a whole online match of each of the six games, host + guest + AI, and checks that every device and a late joiner end equal; it pins the deal seed (some deals end in AI stalemates — see Casting Shadows below). `networkStore.live.test.ts` runs the flow, the rules and the sweep against the real project (`FIREBASE_LIVE=1`; it prints the rooms it used — delete them afterwards).

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

Physically it's a real-time shout. Online it must be **deterministic**: park a
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

All six are built, with every expansion. Each `types.ts` is the design doc —
read it before touching that game. Expansion lists were verified against
publisher stores except where noted.

### Exploding Kittens (`src/games/exploding-kittens/`) — ✅ BASE GAME BUILT

2–5 players. Play cards, then end your turn **by drawing** — drawing is the
turn-ender, not a choice. Draw a kitten without a Defuse and you're out. The
deck always holds exactly `playerCount - 1` kittens, so exactly one player
survives.

**Files:**
- `cards.ts` — deck composition, card metadata, `dealSetup`, combo detection, AI card values.
- `types.ts` — state machine, action union, config, expansion list.
- `reducer.ts` — all rules. Also exports the shared derivations (`kittensInDeck`, `drawDanger`, `knownTopCards`, `availableCombos`) used by both UI and AI.
- `ai.ts` — heuristic AI. `reducer.test.ts` / `ai.test.ts` / `ui.test.tsx` — 130 tests.
- `CardArt.tsx` — original inline SVG for every card kind (base + expansions), the category badges, the card back and the home thumbnail. `Card.tsx` (the frame), `ui.tsx` (lobby + table, on the kit), `Gallery.tsx`, `Rules.tsx`, `ek.css`.

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

### Unstable Unicorns (`src/games/unstable-unicorns/`) — ✅ BASE GAME BUILT
2–8 players. Build a Stable of 7 unicorns (6 at 6–8 players). Four-phase turns
(Beginning / Draw / Action / End), 7-card hand limit, shared Nursery for Baby
Unicorns. Neigh = the reaction primitive; Super Neigh is terminal.
All 127 playable cards (13 Baby Unicorns, 22 Basic Unicorns, 30 Magical
Unicorns, 25 Magic, 15 Instant, 14 Upgrade, 8 Downgrade) + 8 reference cards =
135 cards from the 2nd Edition Base Deck are implemented.

The AI never offers a Dark Angel Unicorn to Dark Angel's own sacrifice: it
used to sacrifice the Dark Angel itself, bring it straight back from the
discard, re-trigger, and loop forever (about 1 deal in 400). Watch for the
same shape in any other "when this enters, sacrifice, then bring back" card.

### Here to Slay (`src/games/here-to-slay/`) — ✅ BASE GAME BUILT
2–6 players. 3 action points a turn (4 with Mega Slime): 1 AP draw, 1 AP play
Hero/Item/Magic, 1 AP roll for Hero ability, 2 AP attack a Monster, 3 AP discard
hand and draw 5. Win by slaying 3 monsters or completing a full 6-class party
(Party Leader and Mask items count). All 6 Party Leaders, 15 Monsters, 48
Heroes, 15 Items/Cursed Items, 13 Magic, 25 Modifiers, and 14 Challenges are
implemented.

Noticed during the UI rebuild, not fixed (confirm against the rulebook first):
`choosePartyLeader` is accepted at any point in your turn, so a leader can be
swapped mid-game (the rulebook fixes it at setup); and `finalScores` is an
invented `trophies × 10 + classes + gifts × 5`, so the end screen shows the
ranking without the numbers. AI rolls that resolve with no modifier window
never put their dice in state, so they show only in the log and FX, not the
roll tray.

### Casting Shadows (`src/games/casting-shadows/`) — ✅ BASE GAME BUILT
2–4 players, last player standing wins (18 HP start). 7-Hex board (Ancient Rune
at center + 6 outer hexes), 4 double-sided Character boards (Kit Gale, Frill
Lilypad, Nuzzle Thornwood, Haze Greentongue), 5 Resource Dice, 52 Main Deck
cards (34 Attack Spells, 10 Conversion Spells, 8 Resource cards), 10
Counterspells, and 10 Companions. Three-phase turns: Resource Roll → Action
Phase (4 AP: Travel, Cast, Reroll, Protect, Refresh, Collect) → Shadow
Absorption & Cursed Crystal damage.

⚠ **Known AI stalemate** (found 2026-11-18, not fixed): about 1 deal in 500
never ends AI-vs-AI. Two survivors end up on the same hex, every attack they
hold needs an *adjacent* hex, and neither AI Travels to bring one into range,
so chip damage and healing cancel out forever (e.g. 3 seats `host-uuid`,
`guest-uuid`, `ai-1`, default config, seed `699613345`). A human breaks it by
moving; an all-AI match won't. The fix belongs in `ai.ts`: Travel when no
held attack can reach a living enemy.

`finalScores` counts the players each caster outlasted (the last-one-standing
convention, as in Exploding Kittens; it used to be `100 + HP` for the winner
and 0 for every fallen player, which ranked them all tied). Noticed during the
UI rebuild, not fixed: with a full spell book and no `replaceSpellId`, the
reducer discards the first card to `mainDiscard` even when it is a
Counterspell; and collecting a level-2/3 spell may replace any card of a
high-enough level (Counterspells and Conversions included), not only a lower
Attack spell.

### Happy Little Dinosaurs (`src/games/happy-little-dinos/`) — ✅ BASE GAME BUILT
2–4 players (up to 6 with 5–6 Player toggle). 4 Dinosaur boards (Nervous Rex,
Cry Ceratops, Bad Luck Bronto, Stego), 28 Disaster cards (8 Natural, 8
Predatory, 8 Emotional, 4 Meteor wild), 53 Point cards (values 0–9 with weapon
effects resolved lowest-to-highest), and 16 Instant cards (Score Booster, Score
Sapper, Score Inversion, Disaster Insurance, Disaster Redirect). Win by reaching
50 points on your Escape Route or being the last Dinosaur standing (eliminated on
3 same-type or 3 different-type Disasters).

Noticed during the UI rebuild, not fixed: `handlePlayScoringInstant` doesn't
check that the player is the current responder, so any holder can play out of
turn (possibly intended, as a shout); `chooseDino` has no phase check.

### Doomlings (`src/games/doomlings/`) — ✅ BASE GAME BUILT
2–6 players. Gene Pool starts at 5 (clamped 1–8, dynamically adjusted by Ages,
Catastrophes, and Traits in your Trait Pile). 13-card Age Deck built from 3 Era
piles of (3 random Ages + 1 random Catastrophe) topped by The Birth of Life.
Play 1 Trait per turn, resolve its Action, and Stabilize hand to Gene Pool size.
3rd Catastrophe triggers World's End (Trait World's End effects + Catastrophe
World's End effect + Drop of Life scoring). All 7 official expansions (Overlush,
Imaginary Ends, Legends of Enderas, Ancient Fates, Shadow Puppets, Castle Glass,
Mokoko Village) are documented in `DM_EXPANSIONS`.

Noticed during the UI rebuild, not fixed: a World's End tie goes to the
first seat in seat order, with no tiebreak.

## Conventions

- Strict TypeScript. No `any` unless genuinely necessary.
- Co-locate tests next to code: `reducer.ts` and `reducer.test.ts` side by side.
- Game logic in `src/games/<id>/` (reducer, ai, cards, types) must not import from `src/ui`, `src/net`, or `src/store`. A game's UI files (`ui.tsx`, art, `Rules.tsx`, `Gallery.tsx`) build on `@/ui/kit` and `@/ui/RulesBook`.
- **Every AI must terminate.** An AI move loop isn't just a frozen screen online: the AI driver writes each move into the shared database's log, so a loop eats into the free plan every app shares. Sweep a few hundred seeds when you touch an AI.
- The net layer may import from `src/core` but not `src/ui`.
- Path alias: `@/` → `src/`.
- Game-specific UI is lazy-loaded via `module.ui()` — keeps the picker bundle tiny. Don't statically import a game's UI from its `module.ts`; it defeats the split. The one exception is `Thumbnail`, which the home page needs: it may import `@/ui/kit/hooks` but **not** `@/ui/kit` (the index pulls `kit.css` into the main bundle).
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
- `FIREBASE_LIVE=1 npx vitest run src/store/networkStore.live.test.ts` — online play + the security rules against the real Firebase project
- `npm run deploy:rules` — deploy `database.rules.json`, merged into the shared database's live rules by `scripts/merge-db-rules.mjs` (never deploy the file on its own; `node scripts/merge-db-rules.mjs` alone writes the merged file without deploying). From Git Bash, set `MSYS_NO_PATHCONV=1` for CLI database paths, e.g. `database:remove /chaotic-games/rooms/X --force`
- `npm run fix-lock` — after any `npm install`, rewrite the lockfile's mirror URLs to registry.npmjs.org (see Deployment)
- `node scripts/render.mjs [shot…]` — screenshots in headless Chrome (starts its own Vite), into `art-renders/` (git-ignored). Named shots: `home`, and per game `<k>-gallery` / `<k>-lobby` / `<k>-game` / `<k>-over` with `k` ∈ ek uu hts cs hld dm. `--url "?demo=…" --name x --wait .cg-table` for anything else; `--size 390,844 --mobile`, `--full`, `--click <selector>`, `--port` (parallel runs). Prints any page errors.
- Dev-only deep links (`src/ui/devDemo.ts`, stripped from production): `?demo=<gameId>` (you + AIs, fast-forwarded to your move; `&players` `&seed` `&moves` `&over` `&exp=a,b` `&humans=2` `&sub=<subPhase>` to land on a specific decision), `?lobby=<gameId>`, `?gallery=<gameId>` (every card face).

## Deployment

`.github/workflows/deploy.yml` deploys `dist/` to GitHub Pages on push to
`main`, installing with `npm ci`. Vite `base` is `/chaotic-games/` — update in
`vite.config.ts` if the repo is renamed. The Firebase rules deploy separately
(`npm run deploy:rules`); CI never touches them.

**The lockfile must carry no DRW Artifactory URLs.** Kyle's environment sets
`NPM_CONFIG_REGISTRY` to the corporate mirror, which overrides the project
`.npmrc`, so every local `npm install` writes mirror URLs into
`package-lock.json` — and GitHub Actions can't reach the mirror. Run
`npm run fix-lock` after any install (`scripts/fix-lockfile.mjs`: swaps the host
to registry.npmjs.org; same tarball paths, so the integrity hashes stay valid).
`scripts/lockfile.test.ts` fails the test run if a non-public URL slips
through.

## Non-goals (do not implement)

- Persistent saves between sessions
- User accounts or any visible sign-in (anonymous Firebase Auth stays invisible), matchmaking, lobby browser
- Anti-cheat / verifiable randomness — *unless* the deck-order question forces option 3
- Monetization, ads, telemetry
- Server code of our own (Cloud Functions, servers): Firebase is storage + security rules only

## Where to start next

1. **Fix the Casting Shadows AI stalemate** (see that game's section): Travel when no held attack can reach a living enemy.
2. **Spot-check `BASE_DECK_COUNTS`** against a physical Exploding Kittens box, and confirm the combo rule (any matching cards vs cats only).
3. Confirm Casting Shadows' rules, Here to Slay's action-point costs and Happy Little Dinosaurs' resolution order against their rulebooks.

## UI and art

**Shell: "midnight carnival".** Ink-violet night, chunky sticker outlines with
hard offset shadows (`--sticker`), a chaos-yellow signature (`--chaos`),
halftone + grain for texture. Fonts are self-hosted from `@fontsource`:
Outfit (UI) and Bungee (display) load with the shell; each game imports its
own display font from its own CSS, so it only downloads with that game.
Motion is transform / opacity only, and `theme.css` stops everything for
`prefers-reduced-motion`. Shared keyframes are named `cg-*` (fade-in, rise-in,
pop, deal-in, stamp, shake, pulse-ring, burst, confetti…).

**Every game view builds on `src/ui/kit/`** — read `kit.css`'s header first.
The rules that keep six art styles on one engine:

- Theme the table with **one class** passed to `GameTable` that sets the `--cg-*` variables (felt, surfaces, edge/ink, text, accent, danger, display font, radius, `--cg-card-w`, and `--cg-chip-bg` / `--cg-log-*` on light tables). The kit's defaults are zero-specificity (`:where`), so that one class always wins whatever order the CSS loads in.
- Game CSS loads lazily from `module.ui()` (`import('./xx.css')` in its `Promise.all`), as does a `Gallery`.
- **FX come from state transitions** — compare the previous state with the current one in an effect (`useFx` → `stamp` / `toast` / `burst`, `usePulse` for a shake, `useChangeKey` to replay an animation). Never parse log text.
- Hand prompts use the hand itself where natural ("click a card to give it"); targets are picked from player plates (`targetable` / `selected`) where natural. Player-facing text is plain English — never a raw subPhase name.
- Hidden information is a UI rule: render only `localPlayerId`'s hand, never deck order or other hands; a card face shown on the table must be public.
- Layout target: at 1440×900 the opponents strip, board, dock and the top of your hand are visible without scrolling; everything stacks at 390px.
- **Runtime budget:** lean SVG — gradients fine, no SVG filters (`feTurbulence` / `feGaussianBlur`) in per-card art; gradient ids via `useSvgIds` (duplicate ids break when the first copy unmounts); one-shot or hover animation only, continuous animation on at most one focal element; no `mix-blend-mode` on cards. Art variation comes from `hashString` / `seededRandom` (`src/core/rng.ts`), never `Math.random`.

**Art systems.** All art is original inline SVG — nothing traced from retail
cards, and deliberately not imitating any retail game's look. Hundreds of
cards are drawn by parametric primitives with deterministic per-kind variation:

| Game | Direction | Display font · accent | Art system |
|---|---|---|---|
| Exploding Kittens | Comic-book bomb shelter: charred crimson table under halftone | Bangers · `#ff4d4d` | One `CatHead` primitive + per-card props (`CardArt.tsx`); category badges; kittens on black stock; a deck whose fuse burns hotter with the draw risk |
| Unstable Unicorns | Glitter-goth sleepover: plum velvet, holo-foil frames | Shrikhand · `#ff5fd2` | One parametric unicorn head (`unicornArt.tsx`: coat, mane, horn, eyes, mouth, 28 name-picked accessories); keyword emblems for Magic / Instant / Upgrade / Downgrade (`emblemArt.tsx`); Stables as corrals |
| Here to Slay | Lantern-lit tavern: walnut planks, parchment, wax seals | Grenze Gotisch · `#ffb02e` | Ten class sigils (`sigils.tsx`); heroes as coats of arms (field, tinctures, one of 12 charges); 11 monster silhouettes; AP as lanterns; a 2d6 roll tray with modifier chips |
| Casting Shadows | Moonlit arcane woodland: the rune-hex map is the centrepiece | Almendra · `#7cf5ff` | Terrain art per hex (`Board.tsx`); hooded caster silhouettes with crests, inverted for Shadow form; one gem iconography for dice / pool / costs; tarot spell frames with ~45 name-picked motifs (`motifs.tsx`) |
| Happy Little Dinosaurs | Saturday-morning disaster cartoon: the only daytime table | Luckiest Guy · `#ff9f1c` | One papercraft dino primitive covering every species and mood (`DinoArt.tsx`); the winding Escape Route board with sliding tokens; 60 point / instant doodles; 14 disaster scenes |
| Doomlings | Cosmic petri dish: bioluminescent specimen slides | Gluten · `#8cff5a` | Living-cell trait art from five body plans × colour signatures (`shapes.ts`, `art.tsx`); each player's procedural species evolves with their Trait Pile; era timeline; Age and Catastrophe scenes |

**Look at it rendered before calling it done.** A typecheck and a render test
both pass on art that looks like nothing. Use `node scripts/render.mjs` (see
Commands): `?gallery=<gameId>` lays out every card face, and
`?demo=<gameId>&sub=<subPhase>` lands on any decision. Read the PNGs.
History: the first Exploding Kittens set had a beard that read as a wooden
bucket, a foreleg that read as a tail, and a rainbow that started at the
cat's cheek instead of its mouth — all invisible in tests, all obvious in a
screenshot.
