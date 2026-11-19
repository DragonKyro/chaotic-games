# chaotic-games

A multi-game web app for **chaotic take-that card games** — the family where you sabotage, interrupt, and blow up your friends rather than quietly optimize your own tableau. Hosted on GitHub Pages, with online rooms in a Firebase Realtime Database (no server code of our own).

Infrastructure is lifted from the sibling [card-collecting](../card-collecting) project — same `GameModule` contract, same Firebase room netcode, same shell.

## Status

**All six base games are implemented, playable and verified against official sources** — hot-seat, online with friends, or against heuristic AIs, each with its own original art direction, lobby settings and an in-app rules book (532 tests passing). A rules audit (2026-11-19) checked every game's components, setup, turns, card effects, reactions and scoring, and made sure every decision the rules give a player is actually offered to them. 13 expansions are built to the same standard so far.

## Expansions

**Checked** = built from the official rules and card lists, and verified. **Unchecked** = not built, or not complete. Unchecked expansions that are still playable are labelled "unverified" in the lobby; locked ones can't be selected.

### Exploding Kittens
- [x] Base game
- [x] Imploding Kittens
- [x] Streaking Kittens
- [x] Barking Kittens
- [x] Zombie Kittens
- [x] Party Pack
- [ ] Recipes for Disaster — placeholder; its 13 recipes aren't modeled

### Unstable Unicorns
- [x] 2nd Edition base deck
- [ ] Original Base deck (Second Print) — exact card list, but about 14 cards it shares with the 2nd Edition still use 2nd Edition wording
- [ ] Diamond Edition — rebuilt, except Reaper (its text was never archived, so it has no effect)
- [ ] Control, Chaos and Travel editions — approximations (unverified)
- [ ] NSFW, Rainbow Apocalypse, Dragons, Unicorns of Legend, Adventures, Christmas, Nightmares — approximations (unverified); the real card lists are recorded in `types.ts`
- [ ] Uncut Unicorns — not a real product; invented (unverified)

### Here to Slay
- [x] Base game
- [x] Warriors & Druids
- [x] Berserkers & Necromancers
- [ ] Here to Sleigh — approximation (unverified); its rulesheet is only available as images

### Casting Shadows
- [x] Base game
- [ ] The Ice Storm — hexes, characters and Freeze / Stun are official; the cards are reconstructed (unverified)
- [ ] The Molten Rock — hexes and characters are official; the cards and the Burn / Fortify rules are reconstructed (unverified)

### Happy Little Dinosaurs
- [x] Base game
- [x] 5–6 Player Expansion
- [x] Perils of Puberty
- [x] Dating Disasters
- [ ] Hazards Ahead — official card pool, but the Hazard tokens and 12 Hazard cards do nothing (its rulebook isn't online)

### Doomlings
- [x] Classic base game
- [x] Castle Glass
- [x] Overlush
- [x] Imaginary Ends (the four creature sets)
- [ ] Imaginary Ends: Magical Merchants — locked; the 40 trinkets and merchant Ages aren't built
- [ ] Legends of Enderas — locked; attachments, Mythling spells and hidden Treasures aren't built
- [ ] Upgrade — locked
- [ ] Mokoko Village, Shadow Puppets, Nightflower Island — locked; no rulesheet in the sources
- [ ] Special Edition — locked

## The games

### Exploding Kittens

Everything in the base game: the 56-card deck, drawing as the turn-ender, Defuse
plus secret reinsertion, the Nope stack, Attack turn-stacking, Skip, Favor,
Shuffle, See the Future, combos, and player elimination, plus five expansions,
all checked against the publisher's rule sheets. 184 tests cover it, including
complete AI-vs-AI games across 2–10 players.

- **Card art** is original inline SVG — every card built from one shared cat-head primitive, in `CardArt.tsx`. No raster assets.
- **The AI** plays to a risk model and is deliberately honest: it only reads the deck through what that seat has legitimately seen. See below.
- **Rules** live in the app behind the 📖 button, including a card-count table and a note on every place the rules were ambiguous.

Two calls that are now confirmed by the official rule sheet:

- **Combos work with any cards of the same title**, not just cats. A lobby toggle keeps cats-only as a house rule.
- **The 56-card base deck counts** (`BASE_DECK_COUNTS` in `cards.ts`).

## Tech stack

| | |
|---|---|
| Build | Vite + TypeScript |
| UI | React 19 |
| State | Zustand |
| Multiplayer | Firebase Realtime Database + anonymous Auth (project `github-games-e7c7d`, shared; this app's data under `/chaotic-games`) |
| Art & type | Original inline SVG (no raster assets); fonts self-hosted from `@fontsource` |
| Tests | Vitest |
| Hosting | GitHub Pages (static) |

## Project structure

```
src/
  core/         GameModule contract, RNG (+ art hashing), shared types, reducer helpers (state.ts),
                AI playout (playout.ts), seat helpers. Game-agnostic.
  net/          Room transport (Firebase, lazy-loaded; in-memory fake for tests), identity, room links.
  store/        Zustand stores (gameStore, networkStore) + actionSync (the online move log).
  ui/           Shell — App, Brand, GameLobby, OnlineLobby, OnlineStatus, GameHost, ChatPanel,
                RulesBook, theme.css (the design system), devDemo.ts (dev-only deep links).
    kit/        The game-view kit: table layout, player plates, decision dock, hand fan, card
                shell, log, FX, game over, expansion picker, dice. Themed by --cg-* variables.
  games/
    registry.ts            List of all GameModules.
    exploding-kittens/     Each game: types, cards, reducer, AI, tests, and its UI bundle —
    unstable-unicorns/     ui.tsx (lobby + table), card frame + art, Thumbnail, Gallery,
    here-to-slay/          Rules, and its own stylesheet.
    casting-shadows/
    happy-little-dinos/
    doomlings/
```

Outside `src/`: `database.rules.json` (this app's security rules), `firebase.json` / `.firebaserc`, and `scripts/` (`merge-db-rules.mjs` for rules deploys, `fix-lockfile.mjs` + `lockfile.test.ts` for the lockfile, `render.mjs` + `lib/chrome.mjs` for screenshots).

Each game lives in its own folder behind the `GameModule<S, A, C>` contract from `src/core/module.ts`. To add a new game: create `src/games/<id>/`, export a module, add it to `src/games/registry.ts`. **No other file needs to change.**

## Look and feel

The shell is a "midnight carnival": ink-violet night, chunky sticker outlines with hard offset shadows, and a chaos-yellow signature. Each game then paints its own table:

| Game | Direction |
|---|---|
| Exploding Kittens | Comic-book bomb shelter — halftone crimson, kittens on black stock, a deck whose fuse burns hotter with your draw risk, KABOOM / NOPE! / DEFUSED! stamps |
| Unstable Unicorns | Glitter-goth sleepover — plum velvet, holo-foil frames, a parametric unicorn for every card, Stables as corrals, NEIGH! stamps |
| Here to Slay | Lantern-lit tavern — walnut and parchment, heroes as coats of arms, monster silhouettes, lantern action points, a 2d6 roll tray |
| Casting Shadows | Moonlit arcane woodland — a glowing rune-hex map, hooded caster silhouettes, gem dice, tarot spells |
| Happy Little Dinosaurs | Saturday-morning disaster cartoon — a winding Escape Route board, papercraft dinos, egg-backed picks that flip together |
| Doomlings | Cosmic petri dish — living-cell trait cards, and a species for every player that evolves with their Trait Pile |

All art is original and drawn in code. Effects are driven by game-state changes, animate transform and opacity only, and stop for `prefers-reduced-motion`. Every game's code, art, CSS and fonts load only when that game is opened.

## Multiplayer model

Online play runs through a **Firebase Realtime Database** shared with Kyle's other game sites, ported from card-collecting (which ported it from Catan). It replaced peer-to-peer WebRTC (Trystero), which never connected reliably on strict NATs and phones. One WebSocket on port 443, so it works on cellular and locked-down networks.

- **Everything is prefixed.** The database is shared, so every path this app touches is under `/chaotic-games`, and `database.rules.json` defines only that key. Deploy rules with `npm run deploy:rules`: a predeploy hook merges our key into the live rules so the other apps' rules are left alone.
- **No sign-up.** Each device signs in anonymously and silently; a seat belongs to a `localStorage` UUID. `?fresh` switches to `sessionStorage` for two-window local testing.
- **The action log is the source of truth.** The host writes a start record (config, seed, seats) once; every device builds the opening itself and applies the match's moves from a write-once log in order, so all devices reduce identically. When two devices move at once (two Nopes on the same play), the log keeps the first and the other device rolls back and replays.
- **Solo play stays offline.** The Firebase SDK is its own lazily loaded chunk; hot-seat and vs-AI games never download it or open a connection.
- No accounts, no matchmaking, no anti-cheat — friends-only.

### Online flow

1. **Host online** from a game's lobby (enter a name): opens a room with a 4-character code, carrying the lobby's options and AI seats over.
2. **Join** by typing the code on the home screen, or open an invite link (`?room=ABCD`). Guests seat themselves while the lobby is open; the host picks the game and options, adds or removes AI seats, and starts.
3. **Play**: every move goes into the room's log. Chat is stored in the room.
4. **Rejoin / spectate**: reloading (or losing signal) rejoins the same seat from the log. Anyone else who joins mid-match watches as a spectator.
5. **AI in online**: the host runs the AI seats; if the host drops, the first connected seated player takes over until the host returns.
6. **Play again** starts a fresh deal for everyone; **Lobby** takes everyone back to change options. Rooms nobody is in are swept after a week.

## Commands

| | |
|---|---|
| `npm run dev` | Dev server at <http://localhost:5173/chaotic-games/> |
| `npm run build` | `tsc` typecheck then `vite build` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Vitest watch |
| `npm run test:run` | Vitest single run |
| `FIREBASE_LIVE=1 npx vitest run src/store/networkStore.live.test.ts` | Online play + security rules against the real Firebase project |
| `npm run deploy:rules` | Deploy `database.rules.json`, merged into the shared database's live rules |
| `npm run fix-lock` | After any `npm install`: point every lockfile URL at registry.npmjs.org |
| `python scripts/fetchtext.py URL --archive` | Read a rules source through the Wayback Machine (cached, paced) |
| `node scripts/render.mjs [shot…]` | Headless-Chrome screenshots into `art-renders/` (e.g. `home`, `ek-gallery`, `cs-game`; or `--url "?demo=doomlings&sub=…"`) |

## Project plan / roadmap

### Phase 0 — Infrastructure ✅
Copied from card-collecting: `GameModule` contract, seeded RNG, Zustand stores, game-agnostic shell (picker / lobby / host / chat / rules modal), GitHub Pages deploy workflow. The original Trystero P2P layer was replaced on 2026-11-18 by card-collecting's Firebase Realtime Database rooms.

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

### Phase 4 — Remaining titles ✅
Unstable Unicorns, Here to Slay, Casting Shadows, Happy Little Dinosaurs and Doomlings, with expansions (see Status for which are verified).

### Phase 5 — Online rooms ✅
Firebase Realtime Database rooms replaced peer-to-peer WebRTC (see Multiplayer model).

### Phase 6 — Look and feel ✅
The shell's design system, the shared game-view kit, and an original art direction for each game (see Look and feel).

### Phase 7 — Rules audit ✅
Every game checked against official sources; base games fixed or rebuilt, expansions verified, rebuilt, flagged or locked (see Status).

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
- User accounts or any visible sign-in, matchmaking, lobby browser
- Anti-cheat / verifiable randomness (unless the deck-order tension above forces it)
- Monetization, ads, telemetry
- Server code of our own — Firebase is storage + security rules only

## Deployment

`.github/workflows/deploy.yml` deploys `dist/` to GitHub Pages on push to `main` (`npm ci`, then `npm run build`). Vite `base` is `/chaotic-games/` — update in `vite.config.ts` if the repo is renamed. Firebase rules deploy separately with `npm run deploy:rules`.

The lockfile must point only at the public npm registry: a local install through a corporate mirror records the mirror's URLs, which GitHub Actions can't reach. Run `npm run fix-lock` after any install; `scripts/lockfile.test.ts` fails the test run if a mirror URL slips through.
