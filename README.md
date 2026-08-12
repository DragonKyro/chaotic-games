# chaotic-games

A multi-game web app for **chaotic take-that card games** — the family where you sabotage, interrupt, and blow up your friends rather than quietly optimize your own tableau. Hosted on GitHub Pages, no backend, peer-to-peer multiplayer via WebRTC.

Infrastructure is lifted from the sibling [card-collecting](../card-collecting) project — same `GameModule` contract, same P2P netcode, same shell.

## Status

**Infrastructure is done. All six games are outlines only** — types, state machines and design notes, with reducers that throw. Nothing is playable yet. Each game's `types.ts` is its design doc.

| Game | Players | Expansions modelled as toggles | Outline confidence |
|---|---|---|---|
| **Exploding Kittens** | 2–5 (6 / 10 w/ exp.) | Imploding, Streaking, Barking, Zombie, Party Pack, Recipes for Disaster | Rules solid, deck list needed |
| **Unstable Unicorns** | 2–8 | Uncut, NSFW, Rainbow Apocalypse, Dragons, Unicorns of Legend, Adventures, Christmas, Nightmares | Rules solid, 135 cards needed |
| **Here to Slay** | 2–6 | Warriors & Druids, Berserkers & Necromancers, Here to Sleigh | ⚠ Action-point costs unconfirmed |
| **Happy Little Dinosaurs** | 2–4 (6 w/ exp.) | Hazards Ahead, Dating Disasters, Perils of Puberty, 5–6 Player | ⚠ Resolution order unconfirmed |
| **Casting Shadows** | 2–4 ⚠ | The Ice Storm, The Molten Rock | ⚠⚠ Rules reconstructed — get the rulebook |
| **Doomlings** | 2–6 ⚠ | *none sourced yet* | ⚠⚠ Rules reconstructed, expansion list missing |

Expansion names were verified against the publishers' stores, except Doomlings — its site was unreachable during research, so its list is deliberately empty rather than guessed.

**Next up: Exploding Kittens.** It's the smallest ruleset that forces all three engine primitives below.

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

### Phase 2 — Chaos primitives (next)
Three engine capabilities the card-collecting games never needed. Build each in the first game that needs it, then reuse — not speculatively:

1. **Reaction windows.** Nope, Neigh, Challenge and Modifier are one shape: a card playable out of turn that answers a pending play and can itself be answered, resolving last-in-first-out. Must be deterministic — explicit respond/decline prompts per eligible responder, never a real-time race between peers. Three variants: stackable cancel, terminal cancel (Super Neigh), and accumulating modify (Here to Slay's dice modifiers).
2. **Player elimination.** Exploding Kittens knocks players out; Happy Little Dinosaurs runs them off a track. Needs an `eliminated` list plus turn-advance that skips dead seats.
3. **Secret deck order.** See The Future, Alter the Future and Defuse reinsertion all depend on deck order being secret. Under full state replication every peer can read it — see the open question below. **This one is a decision, not code, and it blocks Phase 3.**

Dice (Here to Slay, Casting Shadows) need no new primitive: a roll is public the moment it happens, so folding it into the action payload is enough.

### Phase 3 — Exploding Kittens
Smallest ruleset that exercises all three primitives. Good forcing function for the shared scaffolding.

### Phase 4+ — Remaining titles
Unstable Unicorns (Neigh chains reuse the reaction window), Happy Little Dinosaurs (simultaneous face-down commits), Doomlings (trait tableau + ages deck), Here to Slay and Casting Shadows (dice; Casting Shadows also brings the first spatial board).

Blocked on research: Casting Shadows and Doomlings both need rulebooks, and Doomlings needs its expansion list sourced.

## Open question: hidden deck order

The card-collecting project's hidden information was opponents' hands — easy to honor-system, since you have no reason to peek. This family leans much harder on *secret deck order*: See The Future, Defuse reinsertion, and deck-stacking are only fun if you can't read the deck. Full state replication means a determined player can open devtools and see it.

Options, to be decided before the Exploding Kittens reducer is written:
- **Accept it** (friends-only honor, consistent with the sibling project's stance), or
- **Host-authoritative deck**: keep deck order only on the host and stream reveals — breaks the "every peer reduces identically" invariant and makes the host a server, or
- **Commit-and-reveal**: hash the shuffled order at setup, reveal cards with proofs — deterministic and cheat-resistant, but a significant chunk of work.

No decision yet. Documented here so it isn't discovered halfway through the first reducer.

## Non-goals

- Persistent saves between sessions
- User accounts, matchmaking, lobby browser
- Anti-cheat / verifiable randomness (unless the deck-order tension above forces it)
- Monetization, ads, telemetry
- Server-side anything

## Deployment

`.github/workflows/deploy.yml` deploys `dist/` to GitHub Pages on push to `main`. Vite `base` is `/chaotic-games/` — update in `vite.config.ts` if the repo is renamed.
