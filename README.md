# chaotic-games

A multi-game web app for **chaotic take-that card games** — the family where you sabotage, interrupt, and blow up your friends rather than quietly optimize your own tableau. Hosted on GitHub Pages, no backend, peer-to-peer multiplayer via WebRTC.

Infrastructure is lifted from the sibling [card-collecting](../card-collecting) project — same `GameModule` contract, same P2P netcode, same shell.

## Status

**All 6 base games AND all 30 expansions are implemented and playable** — hot-seat, online over WebRTC, or against heuristic AIs, with home-page picker thumbnails, lobby expansion/edition/player settings, in-app rules books, and verified official card lists and frequencies (185 tests passing).

| Game | Players | Expansions modelled as toggles | State |
|---|---|---|---|
| **Exploding Kittens** | 2–10 | Imploding, Streaking, Barking, Zombie, Party Pack, Recipes for Disaster | ✅ **Base game + all 6 expansions playable** |
| **Unstable Unicorns** | 2–8 | Uncut, NSFW, Rainbow Apocalypse, Dragons, Unicorns of Legend, Adventures, Christmas, Nightmares (+ 6 Base Editions) | ✅ **Base game + all 8 expansions & 6 editions playable** |
| **Here to Slay** | 2–6 | Warriors & Druids, Berserkers & Necromancers, Here to Sleigh | ✅ **Base game + all 3 expansions playable** |
| **Happy Little Dinosaurs** | 2–6 | Hazards Ahead, Dating Disasters, Perils of Puberty, 5–6 Player | ✅ **Base game + all 4 expansions playable** |
| **Casting Shadows** | 2–6 | The Ice Storm, The Molten Rock | ✅ **Base game + both expansions playable** |
| **Doomlings** | 2–6 | Overlush, Imaginary Ends, Legends of Enderas, Ancient Fates, Shadow Puppets, Castle Glass, Mokoko Village | ✅ **Base game + all 7 expansions playable** |

## Base Games & Expansions Implementation Checklist (TODOs)

- [x] **Exploding Kittens (Base Game + 6 Expansions)**
  - [x] Official 56-card deck composition & setup (4 Exploding Kittens, 6 Defuses, 26 Action cards, 20 Cat cards)
  - [x] Turn loop (play any number of cards, end turn by drawing), Attack turn-stacking, Skip
  - [x] Reaction window for Nope (LIFO chains)
  - [x] Defuse + secret kitten reinsertion at any deck index
  - [x] Favor (victim chooses card to give), Pair (random steal), Triple (name a card kind to steal), Five Different (choose from discard)
  - [x] Expansions: **Imploding Kittens** (Imploding Kitten face-up/down, Reverse, Draw from Bottom, Alter the Future, Targeted Attack, Feral Cat), **Streaking Kittens** (Streaking Kitten hold-kitten choice, Super Skip, See/Alter Future 5x, Swap Top & Bottom, Garbage Collection, Catomic Bomb, Mark, Curse of the Cat Butt), **Barking Kittens** (Barking Kittens, Alter the Future Now, Bury, Personal Attack, Share the Future, I'll Take That, Potluck, Tower of Power), **Zombie Kittens** (Zombie Kitten resurrection choice, Dig Deeper, Clone, Clairvoyance), **Party Pack** (up to 10 players), and **Recipes for Disaster**
  - [x] Honest deck-knowledge tracking (`knownTopCount`), heuristic AI, UI, and 130 unit/integration tests
- [x] **Unstable Unicorns (2nd Edition Base Game + 6 Editions + 8 Expansions)**
  - [x] Official 2nd Edition Base Deck (13 Baby Unicorns, 22 Basic Unicorns, 30 Magical Unicorns, 25 Magic, 15 Instant, 14 Upgrade, 8 Downgrade)
  - [x] Four-phase turn structure (Beginning of Turn triggers → Draw phase → Action phase: play 1 card or draw 1 → End of Turn: discard to hand limit)
  - [x] Neigh / Super Neigh / Instant reaction window (LIFO stack + terminal Super Neigh + Yay / Slowdown / Ginormous Unicorn checks)
  - [x] Continuous Stable modifiers computed dynamically on read (Pandamonium, Rainbow Aura, Queen Bee Unicorn, Yay, Slowdown, Broken Stable, Tiny Stable, Blinding Light, Nanny Cam, Black Knight Unicorn, Ginormous Unicorn, Dragon's Blessing)
  - [x] Editions (`base-2nd`, `base` 1st Print, `control`, `chaos`, `diamond`, `travel`) & all 8 Expansions (**Rainbow Apocalypse**, **Dragons**, **Unicorns of Legend**, **Adventures** with *Unicorn Net* / *Redirect* / *Absorb and Reflect*, **Nightmares**, **Christmas**, **Uncut Unicorns**, **NSFW**)
  - [x] Full player decision support for all optional triggers, targets, sacrifices, destroys, steals, deck searches, and nursery picks
  - [x] AI driver, Thumbnail, functional GameView + LobbyConfig + RulesBook, and test suite
- [x] **Here to Slay (Base Game + 3 Expansions)**
  - [x] Official Base Deck (6 Party Leaders, 15 Monsters, 48 Heroes across 6 classes, 11 Items, 4 Cursed Items, 25 Modifiers, 13 Magic, 14 Challenges)
  - [x] 3 Action Points per turn (1 AP draw, 1 AP play Hero/Item/Magic, 1 AP roll for Hero ability, 2 AP attack Monster, 3 AP discard all & draw 5, plus Shadow Claw / Mega Slime AP rules)
  - [x] Challenge reaction window (1v1 2d6 duel with modifiers + Fist of Reason / Titan Wyvern / Bloodwing / Warworn Owlbear)
  - [x] Roll Modifier window (any player may stack +4, +3/-1, +2/-2, +1/-3, -4 with user choice on dual-value modifiers and Protecting Horn / Noble Shaman)
  - [x] Expansions: **Warriors & Druids** (Warrior & Druid classes, Druid `rollLow` ≤ threshold mechanics, multi-item equipping, *The Piercing Howl*, *The Noble Shaman*), **Berserkers & Necromancers** (Berserker & Necromancer classes, discard revival, *The Raging Manticore*, *The Gnawing Dread*), and **Here to Sleigh** (Holiday Leaders, Monsters, Heroes, and Nice List Gift win condition)
  - [x] Full player decision support for all Hero abilities, Magic cards, Item equips, Monster penalties, and discards
  - [x] AI driver, Thumbnail, functional GameView + LobbyConfig + Rules, and test suite
- [x] **Happy Little Dinosaurs (Base Game + 4 Expansions)**
  - [x] Official Base Deck (4 Dinosaur Traits: Stego, Nervous Rex, Cry Ceratops, Bad Luck Bronto; 28 Disaster cards across Natural, Predatory, Emotional, Meteor; 53 Point cards with weapon effects; 16 Instant cards)
  - [x] Simultaneous face-down Point card selection + reveal + Instant reaction window (Score Booster, Score Sapper, Score Inversion, Disaster Insurance, Disaster Redirect)
  - [x] Scoring & Disaster resolution (highest score gains points + trait bonus on 50-point Escape Route; lowest score takes Disaster card; tiebreaker rules; 3 same-type or 3 different-type Disasters = elimination)
  - [x] Expansions: **5–6 Player Expansion** (Pterry Dactyl & Raging Raptor, 50 extra cards, and official 5–6 player top-2 scoring rule), **Perils of Puberty** (54 cards), **Dating Disasters** (53 cards), and **Hazards Ahead** (50 cards + 12-card Hazard Deck & Hazard Area penalties)
  - [x] Full player decision support for Point card effects, Instant targets, and Hazard removals
  - [x] AI driver, Thumbnail, functional GameView + LobbyConfig + Rules, and test suite
- [x] **Casting Shadows (Base Game + 2 Expansions)**
  - [x] Official Base Game components (4 Double-Sided Characters: Kit Gale, Haze Greentongue, Nuzzle Thornwood, Frill Lilypad; 7 Hex Tiles; 52 Main Deck cards; 10 Companions; 10 Counterspells; 5 Resource Dice)
  - [x] 3-Phase turn loop: Phase 1 Resource Roll, Phase 2 Action Phase (4 AP: Travel, Cast, Reroll, Protect, Refresh, Collect), Phase 3 Shadow Absorption & Cursed Crystal damage
  - [x] Shadow Form transformation + Companion summoning + Shadow Ability usage
  - [x] Expansions: **The Ice Storm** (Talon Lightfeather, Nyx Frostpaw, Floating Temple & Glimmering Woods hexes, **Stun** & **Freeze** status effects, 26 Main Deck cards, 4 Companions, 4 Counterspells) and **The Molten Rock** (Dread Terrashell, Pyra Ashwing, Cobble Cove & Molten Quarry hexes, **Fortify** shields & **Burn** status effects, 26 Main Deck cards, 4 Companions, 4 Counterspells; up to 6 players)
  - [x] Full player decision support for dice allocation/conversion, spell casting targets/ranges, Counterspell responses, and hex tile effects
  - [x] AI driver, Thumbnail, functional GameView + LobbyConfig + Rules, and test suite
- [x] **Doomlings (Base Game + 7 Expansions)**
  - [x] Official Base Deck (Birth of Life, Ages, Catastrophes across 3 Eras, and unique Trait cards across Red, Blue, Green, Purple, Colorless including Dominants)
  - [x] Age & Catastrophe engine (3 eras of 3 Ages + 1 Catastrophe each; active Age rule modifier; 3rd Catastrophe triggers World's End)
  - [x] Turn loop (play a Trait, resolve Action effect, Stabilize hand to Gene Pool size)
  - [x] Expansions: **Overlush**, **Imaginary Ends** (Dinolings, Mythlings, Techlings, Magical, Meaning of Life), **Legends of Enderas**, **Ancient Fates**, **Shadow Puppets**, **Castle Glass**, and **Mokoko Village** — adding **Multi-color traits**, **Attachment traits** (with host cascading), **Suppress** mechanics, **Swarm/Kidney** self-multiplying traits, and **Meaning of Life / Treasure Objectives**
  - [x] Full player decision support for all trait actions, attachments/steals/swaps/suppresses, catastrophe choices, and World's End choices
  - [x] AI driver, Thumbnail, functional GameView + LobbyConfig + Rules, and test suite

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
