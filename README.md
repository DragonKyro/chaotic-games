# chaotic-games

A multi-game web app for **chaotic take-that card games** — the family where you sabotage, interrupt, and blow up your friends rather than quietly optimize your own tableau. Hosted on GitHub Pages, no backend, peer-to-peer multiplayer via WebRTC.

Infrastructure is lifted from the sibling [card-collecting](../card-collecting) project — same `GameModule` contract, same P2P netcode, same shell.

## Status

**Exploding Kittens (base game) is playable** — hot-seat, online, or against the AI, with its own hand-drawn card art and an in-app rules book. The other five games are outlines only: types, state machines and design notes, with reducers that throw. Each game's `types.ts` is its design doc.

| Game | Players | Expansions modelled as toggles | State |
|---|---|---|---|
| **Exploding Kittens** | 2–5 | Imploding, Streaking, Barking, Zombie, Party Pack, Recipes for Disaster | ✅ **Base game playable.** Expansions not built |
| **Unstable Unicorns** | 2–8 | Uncut, NSFW, Rainbow Apocalypse, Dragons, Unicorns of Legend, Adventures, Christmas, Nightmares | Outline. Rules solid, 135 cards needed |
| **Here to Slay** | 2–6 | Warriors & Druids, Berserkers & Necromancers, Here to Sleigh | Outline. ⚠ Action-point costs unconfirmed |
| **Happy Little Dinosaurs** | 2–4 (6 w/ exp.) | Hazards Ahead, Dating Disasters, Perils of Puberty, 5–6 Player | Outline. ⚠ Resolution order unconfirmed |
| **Casting Shadows** | 2–4 ⚠ | The Ice Storm, The Molten Rock | Outline. ⚠⚠ Rules reconstructed — get the rulebook |
| **Doomlings** | 2–6 ⚠ | *none sourced yet* | Outline. ⚠⚠ Rules reconstructed, expansion list missing |

Expansion names were verified against the publishers' stores, except Doomlings — its site was unreachable during research, so its list is deliberately empty rather than guessed.

### Exploding Kittens

Everything in the base game: the 56-card deck, drawing as the turn-ender, Defuse
plus secret reinsertion, the Nope stack, Attack turn-stacking, Skip, Favor,
Shuffle, See the Future, all three combos, and player elimination. 93 tests
cover it, including 48 complete AI-vs-AI games across 2–5 players.

- **Card art** is original inline SVG — thirteen cards built from one shared cat-head primitive, in `CardArt.tsx`. No raster assets.
- **The AI** plays to a risk model and is deliberately honest: it only reads the deck through what that seat has legitimately seen. See below.
- **Rules** live in the app behind the 📖 button, including a card-count table and a note on every place the rules were ambiguous.

Two calls we had to make, both documented in-app and in `cards.ts`:

- **Combos work with any matching cards**, not just cats — the common reading of the rules. A lobby toggle restricts them to cats if your group plays it that way.
- **Card counts were reconstructed, not read off the box.** Every rules source was unreachable at implementation time. The split totals 56 and cross-checks cleanly, but it deserves a spot-check: `BASE_DECK_COUNTS` in `cards.ts` is the single place to fix it.

## Tech stack

| | |
|---|---|
| Build | Vite + TypeScript |
| UI | React 19 |
| State | Zustand |
| Multiplayer | Trystero (WebRTC over BitTorrent trackers — no backend) |
| Tests | Vitest |
| Hosting | GitHub Pages (static) |

## Project structure

```
src/
  core/         GameModule contract, RNG, shared types. Game-agnostic.
  net/          Trystero wrapper, stable identity, wire envelopes.
  store/        Zustand stores (gameStore, networkStore).
  ui/           Shell — App, GameLobby, GameHost, ChatPanel, RulesBook, theme.
  games/
    registry.ts            List of all GameModules.
    _scaffold/             Temporary placeholder helpers for the outlines. Delete when done.
    exploding-kittens/     Outline: types + design notes.
    unstable-unicorns/     Outline.
    here-to-slay/          Outline.
    casting-shadows/       Outline.
    happy-little-dinos/    Outline.
    doomlings/             Outline.
```

Each game lives in its own folder behind the `GameModule<S, A, C>` contract from `src/core/module.ts`. To add a new game: create `src/games/<id>/`, export a module, add it to `src/games/registry.ts`. **No other file needs to change.**

Every game currently exports a `module.ts` whose `applyAction` throws, and borrows a placeholder lobby form + board from `_scaffold/`. As each game gets a real implementation it stops importing `_scaffold/`; the folder gets deleted when the last one does.

## Multiplayer model

- Full state replication: every peer holds the full `GameState` and runs the same pure `applyAction` reducer.
- Actions (not diffs) are broadcast over Trystero channels. Randomness is decided by the acting player and folded into the action payload so peers reduce identically.
- Lobby is host-authoritative. Host broadcasts the opening state at start; mid-game joiners get a snapshot addressed to their peer id.
- Stable identity is a `localStorage` UUID exchanged over the `hello` channel. `?fresh` switches to `sessionStorage` for local two-window testing.
- Channels: `hello` (uuid + name), `lobby` (host → all), `start` (host → all), `action` (peer → all), `snap` (host → newcomer), `chat`. Trystero loads as a separate chunk so the solo/hot-seat bundle stays small.
- No accounts, no matchmaking, no anti-cheat — friends-only.

### Online flow

1. **Host online** mints a 6-character room code and joins a Trystero room (app id `chaotic-games-v1`, password = room code). The host configures options and assigns each seat to a connected peer via a dropdown.
2. **Join** by entering the room code on the lobby screen. The host sees you appear in the peer list and can drop you into any open seat.
3. **Start** broadcasts the opening `GameState` + the `seat → uuid` map. Each peer's reducer runs identically off that state; subsequent actions are envelopes `{ byUuid, actionJson }` applied through the same `applyAction`.
4. **Mid-game join**: the host responds to a new arrival's `hello` with a targeted snapshot. If the joiner's uuid matches a seat they become a guest; otherwise they're a spectator.
5. **AI in online**: only the host runs the AI driver, firing whenever `state.activePlayerId` resolves to an AI seat. If the host disconnects, AI seats freeze.

## Commands

| | |
|---|---|
| `npm run dev` | Dev server at <http://localhost:5173/chaotic-games/> |
| `npm run build` | `tsc` typecheck then `vite build` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest watch |
| `npm run test:run` | Vitest single run |

## Project plan / roadmap

### Phase 0 — Infrastructure ✅
Copied from card-collecting: `GameModule` contract, seeded RNG, Trystero P2P layer, Zustand stores, game-agnostic shell (picker / lobby / host / chat / rules modal), GitHub Pages deploy workflow.

### Phase 1 — Game outlines ✅
All six games scaffolded: `types.ts` per game carrying the state machine, action union, config and expansion list, plus a `module.ts` registered in the picker whose reducer throws. Expansion lists researched and verified (except Doomlings). Design notes record what's confirmed and what's a guess.

### Phase 2 — Chaos primitives ✅ (via Exploding Kittens)
Three engine capabilities the card-collecting games never needed. Each was built in the first game that needed it rather than speculatively:

1. **Reaction windows** — built. Nope, Neigh, Challenge and Modifier are one shape: a card playable out of turn that answers a pending play and can itself be answered, resolving last-in-first-out. The implementation parks the play in `state.pending`, queues only players who actually hold an answer, and reopens the window every time one lands. Deterministic, no real-time race between peers. Still to generalise when reused: a *terminal* cancel (Super Neigh can't be Noped) and an *accumulating modify* (Here to Slay's dice modifiers adjust a roll instead of cancelling it).
2. **Player elimination** — built. `eliminated: PlayerId[]` plus a turn advance that skips dead seats, and final scores ranked by who outlasted whom.
3. **Secret deck order** — **decided: accept it.** Same friends-only honour stance as the sibling project; no host authority, no commit-and-reveal. What makes it work in practice is `knownTopCount` — a per-player count of how many top-of-deck cards that seat has legitimately earned sight of, via See the Future or by hiding a kitten itself. The UI renders the deck *only* through that, and the AI reads it *only* through that. See the note below.

Dice (Here to Slay, Casting Shadows) need no new primitive: a roll is public the moment it happens, so folding it into the action payload is enough.

### Phase 3 — Exploding Kittens base game ✅
See the status section above.

### Phase 4+ — Remaining titles
Unstable Unicorns is the natural next one: Neigh chains reuse the reaction window almost directly, and it needs a terminal-cancel variant. Then Happy Little Dinosaurs (simultaneous face-down commits), Doomlings (trait tableau + ages deck), Here to Slay and Casting Shadows (dice; Casting Shadows also brings the first spatial board).

Exploding Kittens' own expansions are a separate track — Imploding Kittens is the cheapest, since Reverse and Alter the Future both slot into machinery that already exists.

Blocked on research: Casting Shadows and Doomlings both need rulebooks, and Doomlings needs its expansion list sourced.

## Decided: hidden deck order

The card-collecting project's hidden information was opponents' hands — easy to honour-system, since you have no reason to peek. This family leans much harder on *secret deck order*: See the Future, Defuse reinsertion and deck-stacking are only fun if you can't read the deck. Full state replication means a determined player can open devtools and see it.

The options were to accept it, to make the host authoritative over deck order (which breaks "every peer reduces identically" and turns the host into a server), or to do commit-and-reveal with hashes (deterministic and cheat-resistant, but a lot of work).

**We accept it** — friends-only honour, consistent with the sibling project. The discipline that makes it hold up:

- The UI never renders deck contents. The only window in is `knownTopCount[playerId]`, the number of top cards that seat has legitimately seen.
- The AI is written against the same window. It has `drawDanger()` and `knownTopCards()` and nothing else; a test asserts it walks into a kitten it had no way of knowing about. An AI that peeked would also be unbeatable and boring.
- Knowledge decays honestly: a draw shifts it down by one, a shuffle wipes it, and a reinsertion clamps everyone's to the insert index.

Revisit only if the game ever leaves the friends-only setting.

## Non-goals

- Persistent saves between sessions
- User accounts, matchmaking, lobby browser
- Anti-cheat / verifiable randomness (unless the deck-order tension above forces it)
- Monetization, ads, telemetry
- Server-side anything

## Deployment

`.github/workflows/deploy.yml` deploys `dist/` to GitHub Pages on push to `main`. Vite `base` is `/chaotic-games/` — update in `vite.config.ts` if the repo is renamed.
