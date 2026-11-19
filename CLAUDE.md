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

All six base games are implemented, playable, and **audited against official
sources** (the 2026-11-19 rules audit — see each game's section and "Rules
sources" below). Expansions are a mixed picture: the audit found that much of
the original expansion content had been approximated or invented. What could
be rebuilt from sources was; the rest is flagged `verified: false` (the lobby
shows "unverified") or locked, never passed off as official.

| Game | Base game | Expansions |
|---|---|---|
| Exploding Kittens | ✅ verified against the official rule-sheet PDFs | ✅ Imploding, Streaking, Barking, Zombie Kittens, Party Pack verified · ⚠ Recipes for Disaster: placeholder, recipes not modeled |
| Unstable Unicorns | ✅ 2nd Edition verified; Original Base (Second Print) and Diamond Edition rebuilt to their inventories | ⚠ all 8 expansions and the Control / Chaos / Travel editions are approximations, flagged unverified (real card lists in `types.ts`) |
| Here to Slay | ✅ verified against the official rulebook | ✅ Warriors & Druids, Berserkers & Necromancers built and verified · ⚠ Here to Sleigh is an approximation, flagged unverified |
| Casting Shadows | ✅ rebuilt from the rulebook, hex reference sheet and card pages | ⚠ hexes and characters official, decks still the app's own, flagged unverified (official lists in `cards.ts`) |
| Happy Little Dinosaurs | ✅ verified | ✅ 5–6 Player, Perils of Puberty, Dating Disasters verified · ⚠ Hazards Ahead partial (its tokens and Hazard cards are no-ops), unverified |
| Doomlings | ✅ Classic (2nd edition) rebuilt from scratch and verified | ✅ Castle Glass, Overlush, Imaginary Ends (creature sets) built and verified · ⛔ Magical Merchants, Legends of Enderas, Upgrade, Mokoko Village, Shadow Puppets, Nightflower Island, Special Edition locked |

Each game has a pure deterministic reducer, interactive prompts for every
player decision (the audit's main check: no decision the rules give a player
is taken for them), a heuristic AI that answers every prompt, its own art
direction (original SVG card art system, card back, board, home-page
`Thumbnail`, a `Gallery` of every card face), a `GameView` built on the shared
kit with state-driven FX, `LobbyConfig`, `Rules`, and unit + AI-vs-AI tests.

532 tests pass (`npm run test:run`): every game's rules (one test per audit
fix), AI-vs-AI playouts across player counts, editions and expansion sets, UI
tests for all six games (every state of full AI games renders; no hidden card
leaks to another seat), the online layer (rooms, lobby, action log, races,
rejoin, spectators) and a whole online match of each game.

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

Both variants now exist:
- **Cancel, terminal** — Super Neigh (Unstable Unicorns) cannot be answered.
- **Modify, accumulating** — Here to Slay's Modifiers adjust a pending dice *roll*. Any number per player; after each one the window reopens for everyone, clockwise from the roller. Rolls are public state (`lastRoll`).

One deliberate exception to "playing is a shout": Happy Little Dinosaurs'
scoring Instants are accepted only from the head of the queue, and every play
reopens the window for everyone. Nobody loses a chance to respond, and no two
devices can act on the same state.

### 2. Player elimination — BUILT

`eliminated: PlayerId[]` plus `nextLivePlayer()` skipping dead seats, in
`exploding-kittens/reducer.ts`. Notes:

- An exploded player's killing kitten lies face up in front of them and the rest of their hand face down (`deadKittens` / `deadHands`) — not discarded, so it can't be fished back out of the discard pile. With Zombie Kittens the dead keep their hands, may still play Nope and NOW cards, and can be revived.
- Their owed turns (from an Attack) die with them; the next seat starts fresh on one turn.
- `GameStateShape.finalScores` is `Record<PlayerId, number>`, so a last-one-standing game scores by **how many players you outlasted** — the winner tops the table and the end screen stays meaningful. Don't change the contract for this.

### 3. Secret deck order — DECIDED: accept it

Friends-only honour, same stance as the sibling project. Not host-authoritative
(that would break "every peer reduces identically" and make the host a server),
and not commit-and-reveal (deterministic and cheat-resistant, but a lot of work
for a game you play with five friends).

What makes it hold up in practice is **`knownTopCount: Record<PlayerId, number>`**
— how many top-of-deck cards each seat has legitimately earned sight of — plus
**`sightings`**, the kittens a player watched being reinserted (Clairvoyance).
These are the *only* sanctioned windows into the deck, and the rule is enforced
by convention plus tests:

- The UI renders deck contents **only** via `knownTopCards(state, localPlayerId)` / `sightedKittens()`.
- The AI reads the deck **only** via `drawDanger()` / `knownTopCards()` / `sightedKittens()`, plus `kittensInDeck()`, which counts from public information only (the setup count, minus kittens lying face up in front of the dead or on the discard, plus a face-up Imploding Kitten). `ai.test.ts` asserts it walks into a kitten it had no way of knowing about. (The audit removed two places — Clairvoyance and Tower of Power — where card code read the deck directly.)
- Knowledge decays honestly: a draw decrements everyone by one, a shuffle zeroes everyone, a reinsertion clamps everyone to the insert index (cards below it are unchanged) and grants the placer exactly one card of knowledge if they hid it on top.

If you add a card that reveals or manipulates the deck (Alter the Future, Draw
From The Bottom, Swap Top and Bottom), **update the knowledge rules in the same
change** or the AI silently starts cheating.

Related: dice (Here to Slay, Casting Shadows) are *not* affected — a roll is
public the instant it happens, so folding it into the action payload is enough.

## The games

Each `types.ts` is the design doc — read it before touching that game. Sources
for every confirmed rule are listed at the top of that file. Rules the sources
couldn't settle are marked UNCONFIRMED in code and listed in-app in `Rules.tsx`.

### Exploding Kittens (`src/games/exploding-kittens/`)

2–5 players (to 10 with Party Pack). Play cards, then end your turn **by
drawing** — drawing is the turn-ender, not a choice. Draw a kitten without a
Defuse and you're out. The deck holds `players - 1` kittens, so one survives.

**Files:** `cards.ts` (compositions, metadata, `dealSetup`, combos, AI card
values), `types.ts`, `reducer.ts` (all rules, plus the shared derivations
`kittensInDeck`, `drawDanger`, `knownTopCards`, `availableCombos`), `ai.ts`,
`CardArt.tsx` / `Card.tsx` / `ui.tsx` / `Gallery.tsx` / `Rules.tsx` / `ek.css`.
184 tests.

**Verified against the publisher's rule-sheet PDFs** (Original Edition,
Imploding, Streaking, Barking, Zombie Kittens + Zombie Apocalypse sheet, Party
Pack, Recipes for Disaster) and the official FAQ:
- `BASE_DECK_COUNTS` (56 cards) is confirmed. Setup: two spare Defuses are shuffled in *before* the deal; the default deal is 7 + 1 Defuse (4 is kept as a shorter game).
- **Combos** work with any 2 or 3 cards of the same title — confirmed. `combosCatsOnly` is now labelled a house rule. Five Different isn't in current printings: opt-in (`fiveDifferentCombo`), off by default.
- **Attack stacking:** an attacked player who Attacks hands on their current + untaken turns + 2; anyone else hands on 2 (`underAttack`). Personal Attack is 3 and stacks.
- Imploding: kittens total `players - 1` with the Imploding Kitten counted among them. Streaking: holding a kitten is secret (a standing `streakingHold` preference). Barking: Tower of Power's Stash is dealt at setup. Zombie Kittens: the full 22-card set; the dead keep their hands and can be revived. Party Pack is its own 120-card core deck (paw-print subsets by player count), not base × 2.
- Not modeled (placeholder, labelled): Recipes for Disaster's recipes, the Zombie Apocalypse combination rules, the faster-game variants, the Imploding 2-player variant.

**AI design.** Deterministic, single difficulty, no search, one action per call —
the shell's driver ticks it repeatedly, so "See the Future, then decide whether
to Skip" falls out across two ticks with no lookahead. It ranks by risk:
certain-death on top → Attack (best: dodges the draw *and* hands the next player
the kitten) > Skip > Shuffle > eat it with a Defuse and re-hide it. Unknown top →
buy information first, then dodge. Safe → build advantage with combos. It
deliberately does **not** Attack when the deck is safe, and never spends Defuses,
Nopes or Zombie Kittens on steal combos. Nopes are spent only on plays that
actually hurt it. It buries a kitten when its own turn continues.

**Fair play is a hard rule here** — see primitive 3 above.

### Unstable Unicorns (`src/games/unstable-unicorns/`)

2–8 players. Build a Stable of 7 unicorns (6 at 6–8 players). Four-phase turns
(Beginning / Draw / Action: play 1 or draw 1 / End), 7-card hand limit, Nursery
of Baby Unicorns. Neigh is the reaction primitive; Super Neigh is terminal.

**Verified** (official Unstable Games Wiki: rulesheet, FAQ, Two Player Rules,
per-deck card lists and inventories): the 2nd Edition base deck card for card.
Each player **chooses** their Baby Unicorn at setup; 2-player rules are a lobby
toggle (on by default); a deck-out goes to the most unicorns, then most letters
in their names, and a full tie means everyone loses. Queen Bee's restriction is
one gate (`canEnterStable`) covering every route into a Stable. The Original
Base deck is the Second Print inventory (127 cards); the Diamond Edition is
rebuilt (Vault, Diamond Phase, protected Diamond Unicorns).

**Not the printed sets:** the 8 expansions and the Control / Chaos / Travel
editions mix a few real card names with invented ones ("Uncut Unicorns" isn't a
product at all). They're flagged unverified; the real card lists are recorded
in `types.ts` for a rebuild (300+ unique effects).

The AI never offers a Dark Angel Unicorn to Dark Angel's own sacrifice: it
used to sacrifice the Dark Angel itself, bring it straight back from the
discard, re-trigger, and loop forever. Watch for the same shape in any other
"when this enters, sacrifice, then bring back" card.

### Here to Slay (`src/games/here-to-slay/`)

2–6 players. 3 action points a turn: draw (1), play a Hero / Item / Magic (1),
roll for a Hero's ability (1), attack a Monster (2), discard your hand and
draw 5 (3). Win by slaying 3 Monsters or **ending your turn** with a full
6-class party.

**Verified** against the official rulebook (retail and Kickstarter PDFs) and the
wiki inventories: Party Leaders are **drafted at setup** in reverse seat order
(seat 1 picks last and starts), never swapped afterwards; no hand limit; a
Party Leader meets a Monster's class requirement; any number of Modifiers per
player on one roll; Challenges apply to cards played "immediately" by effects
too; dice rolls are public (`lastRoll`); `finalScores` is winner 1, everyone
else 0 (the rulebook has no scoring).

**Expansions.** Warriors & Druids and Berserkers & Necromancers are built to
their official inventories (official per-card wiki pages for most cards; two
open-source datasets that agree for the rest) with their rules: 7 classes to
win, Druids succeed at or below their number, two-Item Warriors / Berserkers,
Necromancers pay their cost first. Readings no source settles are marked
UNCONFIRMED and listed in `Rules.tsx`. Here to Sleigh is still an
approximation, flagged unverified — its rulesheet survives only as images.

Known AI gap: the AI never casts Magic cards from its hand (they reach play
only through other effects).

### Casting Shadows (`src/games/casting-shadows/`)

2–4 players (5–6 with an expansion), last caster standing wins (18 HP).

**Rebuilt** from the rulebook, the Ice Storm rulebook, the Hex Tile Reference
Sheet and ~45 per-card wiki pages — nearly every base card text, cost, level
and range had been invented, as had the hex tiles. Now: the 7 official base
tiles (Ancient Rune gives +2 HP and allows no collecting), home tiles placed in
seat positions, the five official range types, Shadow Abilities need full
energy, Spell Book upgrades cost a lower Attack / Conversion spell (never a
Counterspell) and the player chooses what to give up, Resource cards are free
to collect and spent for a token, used Counterspells go to the bottom of their
deck. The AI travels toward where its spells can hurt someone, which fixed the
old stalemate (seed `699613345` now ends in 106 moves). `finalScores` counts
the players each caster outlasted. Five base items have no archived source and
are kept as first built, so may be made up (marked UNCONFIRMED in `cards.ts`):
Frill's Shadow Ability, Magma Hand, Sapphire Synthesis, Sharp Hedge and the
Blue Orb resource card.

**Expansions:** hexes, character names and the Ice Storm statuses are
official, but the decks couldn't be sourced and are still the app's own —
flagged unverified. The official card lists are kept in `cards.ts`
(`CS_ICE_STORM_OFFICIAL_CARDS`, `CS_MOLTEN_ROCK_OFFICIAL_CARDS`) as reference
for a rebuild; knip reports them as unused, on purpose.

### Happy Little Dinosaurs (`src/games/happy-little-dinos/`)

2–4 players (5–6 with a board-adding expansion: 5–6 Player or Hazards Ahead).
Every round a Disaster flips, everyone picks a Point card face-down at once,
picks reveal, effects resolve, the highest score moves up the Escape Route, the
lowest takes the Disaster. First to 50 wins; 3 same-type or 3 different-type
Disasters eliminate you.

**Verified** (official rulesheet v5, the 5–6 Player rulesheet, per-deck
inventories and card pages): base, 5–6 Player, Perils of Puberty and Dating
Disasters — most Disaster names, expansion effects and two dinos' traits had
been invented. Point-card effects resolve "during this round" ones first, then
lowest value; ties go to fewest Escape Route points, then the youngest (seat
order). An all-tie sends the Disaster to the bottom; a win is checked after
every action; boards are unique; a 2-player variant is a lobby option.

**Hazards Ahead is partial:** its rulebook isn't online, so its card pool is
official but its Hazard tokens and Hazard cards are no-ops — flagged unverified.

### Doomlings (`src/games/doomlings/`)

2–6 players. **Rebuilt from scratch as the Classic (2nd edition) base game** —
every card in the old implementation, and all seven "expansions", had been
invented. Sources: the official Classic rulesheet as transcribed in
`nycocado/doomlings-atlas` (`assets/doomlings/rules/classic.md`), that repo's
per-card data (`assets/doomlings/classic/cards.json`), and `azabicki/DoomPy`'s
card sheet and scoring code (the two agree on every trait's value, colour and
Dominant).

116 traits (107 distinct), 25 Ages, 15 Catastrophes. The Age deck is three Era
piles of 3 Ages + 1 Catastrophe under The Birth of Life. You must play a trait
if you can; actions are mandatory unless they say "may"; the Gene Pool is a
running counter (a trait leaving always reverses its change); World's End
resolves the Catastrophic effect → traits' World's End effects in turn order →
the Catastrophe's World's End effect → scoring. Tied players each draw a trait
and add its face value. Live scores never count bonuses that depend on hidden
hands (shown as "+?").

**Expansions** (card lists in `packs/*.ts`, from `doomlings-atlas`): Castle
Glass (Shell / Coral / Fish classes and their bonuses), Overlush (each game
draws 40 basic traits, 8 Dominants, 8 Ages and 4 Catastrophes from it into the
Classic decks) and Imaginary Ends' four creature sets (Suppress, subspecies)
are built, verified and unlocked. Still locked, with the reason shown in the
lobby: Imaginary Ends' Magical Merchants add-on (trinkets), Legends of Enderas
(attachments, Mythling spells, hidden Treasures with a Cloak reaction window),
Upgrade, Special Edition, and Mokoko Village / Shadow Puppets / Nightflower
Island (no rulesheet in the sources).

## Rules sources

Live publisher sites, BGG and the fan wikis don't connect from this network,
and web search is unavailable. What works:

- **The Wayback Machine.** Archived copies of server-rendered pages — above all the official **Unstable Games Wiki** (`https://unstablegameswiki.com/index.php?title=…`: per-deck "Cards In This Deck", inventory lists, rulesheets, FAQ), which covers Unstable Unicorns, Here to Slay, Happy Little Dinosaurs and Casting Shadows.
- **The publisher's CDN.** Exploding Kittens' rule-sheet PDFs (`cdn.shopify.com/s/files/1/0345/9180/1483/files/…`, linked from the archived `explodingkittens.com/pages/rules-*` pages) download live.
- **GitHub** (API and `raw.githubusercontent.com` via curl): open-source implementations with card data — secondary sources; cross-check them.
- **`python scripts/fetchtext.py URL [--archive] [--cdx PREFIX] [--grep W] [--links]`** fetches a page (or its newest archived copy) as text, lists what the archive holds under a prefix, caches everything in `.research-cache/` (git-ignored) and paces archive requests to one per 10 s — the archive blocks bursts as bot traffic.

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
- `python scripts/fetchtext.py URL --archive` — read a rules source (see "Rules sources")
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

1. **Rebuild the remaining flagged expansions**, best-sourced first: Doomlings' Legends of Enderas and Magical Merchants (rulebooks and card data in `doomlings-atlas`), then Unstable Unicorns' 8 expansions and 3 editions (lists in `types.ts`; 300+ effects). Casting Shadows' expansion decks, Here to Sleigh and Recipes for Disaster depend on reading card text or rules from archived images; Hazards Ahead needs its rulebook. Consider dropping "Uncut Unicorns", which isn't a real product.
2. **Settle the UNCONFIRMED rules** each game lists in `Rules.tsx` once a source turns up.
3. **Main bundle size:** every game's rules and card data load with the home page (≈260 KB gzipped). Lazy-loading each game's logic would need the contract to allow an async `createInitialState` / module load.

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
