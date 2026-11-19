// Exploding Kittens — the reducer. Pure: same (state, action) → same next state.
// No Date.now, no Math.random, no I/O. All randomness comes from state.rngState,
// which is replicated, so every peer reduces identically.
//
// Throws on illegal actions. The UI is responsible for only offering legal ones;
// a throw means either a bug or a desynced peer.
//
// The rules (and where each was read) are in types.ts.

import { createRng, rngInt, shuffle } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import {
  CARD_LABEL,
  dealSetup,
  detectCombo,
  hasStreakingKittens,
  isCatKind,
  isCloneableKind,
  isDefuseKind,
  isKittenKind,
  isNowKind,
  isPlayableAction,
  kittenPlan,
  needsTargetForKind,
  type ComboRules,
} from './cards';
import type {
  EkAction,
  EkBaseCardKind,
  EkCard,
  EkComboKind,
  EkConfig,
  EkPendingPlay,
  EkState,
} from './types';
import { cloneState, isLive, livePlayerIds, pushLog, seatName } from '@/core/state';

const FUTURE_COUNT = 3;

// ============================================================================
// Setup
// ============================================================================

export function createInitialState(config: EkConfig, seed: number, seats: Seat[]): EkState {
  const rngState = createRng(seed);
  const { deck, hands, stash } = dealSetup(seats, rngState, config.handSize, config.expansions);
  const first = seats[0];
  if (!first) throw new Error('Exploding Kittens needs at least one seat');

  const state: EkState = {
    phase: 'playing',
    seats,
    activePlayerId: first.id,
    finalScores: null,
    rngState,

    subPhase: 'awaitingAction',
    deck,
    discard: [],
    hands,
    eliminated: [],
    deadKittens: {},
    deadHands: {},
    knownTopCount: Object.fromEntries(seats.map((s) => [s.id, 0])),
    sightings: {},
    turnPlayerId: first.id,
    turnsRemaining: 1,
    underAttack: false,
    turnDirection: 1,
    pending: null,
    peek: null,
    pendingFavor: null,
    pendingKitten: null,
    kittenQueue: [],
    kittenWatchers: [],
    moreKittensToDefuse: [],
    limbo: [],
    implodingFaceUp: false,
    markedCardIds: [],
    cursedPlayers: [],
    pendingBlindCard: null,
    streakingHold: {},
    pendingGarbage: null,
    pendingBury: null,
    pendingPotluck: null,
    pendingDigDeeper: null,
    pendingClairvoyance: null,
    pendingDonation: null,
    illTakeThat: {},
    stash,
    towerStash: {},
    barkingFaceUp: {},
    defuseEndsTurn: true,
    log: [],
    logSeq: 0,
    config,
  };

  const plan = kittenPlan(seats.length, config.expansions);
  const kittens = plan.exploding + plan.imploding;
  pushLog(state, null, `${seats.length} players. ${deck.length} cards in the deck, with ${kittens} kitten${kittens === 1 ? '' : 's'} hiding in it.`, 'normal');
  pushLog(state, first.id, `${first.name} goes first.`, 'normal');
  return state;
}

// ============================================================================
// Helpers
// ============================================================================

function zombieMode(s: EkState): boolean {
  return s.config.expansions.includes('zombie-kittens');
}

function comboRules(s: EkState): ComboRules {
  return { catsOnly: s.config.combosCatsOnly, fiveDifferent: s.config.fiveDifferentCombo === true };
}

/** Dead players in seat order. */
export function deadPlayerIds(s: EkState): PlayerId[] {
  return s.seats.filter((x) => !isLive(s, x.id)).map((x) => x.id);
}

/** Live players in current turn order starting from `from`. */
function livePlayersFrom(s: EkState, from: PlayerId): PlayerId[] {
  return seatsFrom(s, from).filter((id) => isLive(s, id));
}

/** Every seat in turn order starting from `from` (inclusive). */
function seatsFrom(s: EkState, from: PlayerId): PlayerId[] {
  const n = s.seats.length;
  const start = s.seats.findIndex((x) => x.id === from);
  if (start < 0) return s.seats.map((x) => x.id);
  const out: PlayerId[] = [];
  for (let step = 0; step < n; step++) {
    const seat = s.seats[(((start + step * s.turnDirection) % n) + n) % n];
    if (seat) out.push(seat.id);
  }
  return out;
}

/** Next living seat from `from`, following turnDirection. */
function nextLivePlayer(s: EkState, from: PlayerId): PlayerId {
  const n = s.seats.length;
  const start = s.seats.findIndex((x) => x.id === from);
  if (start < 0) throw new Error(`unknown seat ${from}`);
  for (let step = 1; step <= n; step++) {
    const seat = s.seats[(((start + step * s.turnDirection) % n) + n) % n];
    if (seat && isLive(s, seat.id)) return seat.id;
  }
  return from; // sole survivor
}

function handOf(s: EkState, id: PlayerId): EkCard[] {
  const hand = s.hands[id];
  if (!hand) throw new Error(`unknown hand ${id}`);
  return hand;
}

function unmarkCard(s: EkState, cardId: number) {
  if (s.markedCardIds && s.markedCardIds.length > 0) {
    s.markedCardIds = s.markedCardIds.filter((id) => id !== cardId);
  }
}

function takeFromHand(s: EkState, id: PlayerId, cardId: number): EkCard {
  const hand = handOf(s, id);
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new Error(`card ${cardId} not in ${seatName(s, id)}'s hand`);
  const [card] = hand.splice(idx, 1);
  if (!card) throw new Error('splice returned nothing');
  unmarkCard(s, cardId);
  return card;
}

export function isCursed(s: EkState, id: PlayerId): boolean {
  return s.cursedPlayers?.includes(id) ?? false;
}

function uncurse(s: EkState, id: PlayerId) {
  if (isCursed(s, id)) {
    s.cursedPlayers = (s.cursedPlayers ?? []).filter((p) => p !== id);
    pushLog(s, id, `${seatName(s, id)} shook off the Curse of the Cat Butt.`, 'good');
  }
}

/**
 * A card arrives in a hand. A Cursed hand is face down and shuffled, so the
 * new card is shuffled in ("turn it face down and shuffle it into your hand").
 */
function addToHand(s: EkState, id: PlayerId, card: EkCard) {
  handOf(s, id).push(card);
  if (isCursed(s, id)) s.hands[id] = shuffle(s.rngState, handOf(s, id));
}

function hasKind(s: EkState, id: PlayerId, kind: EkBaseCardKind): boolean {
  return handOf(s, id).some((c) => c.kind === kind);
}

/** The card a Clone played right now would become: the top of the discard pile. */
function cloneSourceKind(s: EkState): EkBaseCardKind | null {
  return s.discard[s.discard.length - 1]?.kind ?? null;
}

/** What a lone Clone would copy right now, if anything legal. */
export function findCloneTargetKind(s: EkState): EkBaseCardKind | null {
  const top = cloneSourceKind(s);
  return top && isCloneableKind(top) ? top : null;
}

/** Cards in this hand that can answer a kitten: Defuse, Zombie Kitten, or a Clone sitting on one. */
export function defuseCards(s: EkState, id: PlayerId): EkCard[] {
  const top = cloneSourceKind(s);
  const cloneDefuses = top !== null && isDefuseKind(top);
  return handOf(s, id).filter((c) => isDefuseKind(c.kind) || (cloneDefuses && c.kind === 'clone'));
}

function canDefuse(s: EkState, id: PlayerId): boolean {
  return defuseCards(s, id).length > 0;
}

function canHoldWithStreaking(s: EkState, id: PlayerId): boolean {
  const h = handOf(s, id);
  const streakingCount = h.filter((c) => c.kind === 'streakingKitten').length;
  const kittenCount = h.filter((c) => c.kind === 'explodingKitten').length;
  return streakingCount > kittenCount;
}

/** Does this player want a drawn Exploding Kitten held secretly? Default yes; no Defuse means yes. */
function wantsHold(s: EkState, id: PlayerId): boolean {
  return s.streakingHold?.[id] !== false || !canDefuse(s, id);
}

// ============================================================================
// Deck knowledge — the ONLY sanctioned window into the deck
// ============================================================================

/** If the face-up Imploding Kitten is at index 0, everyone sees it on top of the deck. */
function syncFaceUpImplodingKnowledge(s: EkState) {
  if (s.implodingFaceUp && s.deck[0]?.kind === 'implodingKitten') {
    for (const seat of s.seats) {
      s.knownTopCount[seat.id] = Math.max(s.knownTopCount[seat.id] ?? 0, 1);
    }
  }
}

/** Drop every sighting matching `stale`. */
function forgetSightings(s: EkState, stale: (cardId: number, playerId: PlayerId) => boolean) {
  if (!s.sightings) return;
  for (const [pid, ids] of Object.entries(s.sightings)) {
    s.sightings[pid] = ids.filter((id) => !stale(id, pid));
  }
}

/** Sightings of cards that have left the deck are meaningless. */
function pruneSightings(s: EkState) {
  const inDeck = new Set(s.deck.map((c) => c.id));
  forgetSightings(s, (id) => !inDeck.has(id));
}

/** A shuffle: nobody knows anything. */
function forgetEverything(s: EkState) {
  for (const id of Object.keys(s.knownTopCount)) s.knownTopCount[id] = 0;
  s.sightings = {};
  syncFaceUpImplodingKnowledge(s);
}

/** Everyone's knowledge of the top of the deck shifts down by one on a draw. */
function decayKnowledgeOnDraw(s: EkState) {
  for (const id of Object.keys(s.knownTopCount)) {
    s.knownTopCount[id] = Math.max(0, (s.knownTopCount[id] ?? 0) - 1);
  }
  pruneSightings(s);
  syncFaceUpImplodingKnowledge(s);
}

/**
 * A card was secretly put in at `index`. Cards above it are unchanged;
 * everything at or below it is stale — except for the placer, who knows exactly
 * what moved, and Clairvoyance watchers, who saw where it went.
 */
function clampKnowledgeOnInsert(s: EkState, index: number, placerId: PlayerId, watchers: readonly PlayerId[] = []) {
  const inserted = s.deck[index];
  for (const id of Object.keys(s.knownTopCount)) {
    const old = s.knownTopCount[id] ?? 0;
    const sawIt = id === placerId || watchers.includes(id);
    s.knownTopCount[id] = sawIt && old >= index ? old + 1 : Math.min(old, index);
  }
  const position = new Map(s.deck.map((c, i) => [c.id, i] as const));
  forgetSightings(s, (cardId, pid) => pid !== placerId && !watchers.includes(pid) && (position.get(cardId) ?? 0) > index);
  if (inserted && (isKittenKind(inserted.kind) || inserted.kind === 'barkingKitten')) {
    if (!s.sightings) s.sightings = {};
    for (const w of watchers) {
      s.sightings[w] = [...(s.sightings[w] ?? []).filter((x) => x !== inserted.id), inserted.id];
    }
  }
  syncFaceUpImplodingKnowledge(s);
}

/** The top `count` cards were rearranged by `by`: only they (and whoever they show) still know them. */
function knowledgeAfterReorder(s: EkState, count: number, by: PlayerId, alsoShown: PlayerId | null) {
  const topIds = new Set(s.deck.slice(0, count).map((c) => c.id));
  for (const id of Object.keys(s.knownTopCount)) {
    const old = s.knownTopCount[id] ?? 0;
    s.knownTopCount[id] = id === by || id === alsoShown ? Math.max(old, count) : 0;
  }
  forgetSightings(s, (cardId, pid) => pid !== by && pid !== alsoShown && topIds.has(cardId));
  syncFaceUpImplodingKnowledge(s);
}

// ============================================================================
// Turn flow
// ============================================================================

/** Hand control back to the turn owner with no subphase pending. */
function backToAction(s: EkState) {
  s.subPhase = 'awaitingAction';
  s.activePlayerId = s.turnPlayerId;
}

/** Start `to`'s turn(s). */
function passTurn(s: EkState, to: PlayerId, turns = 1, attacked = false) {
  s.turnPlayerId = to;
  s.turnsRemaining = turns;
  s.underAttack = attacked;
  backToAction(s);
}

/**
 * A turn has been spent (by drawing, or by a Skip). Burn one owed turn; if the
 * player still owes turns they go again, otherwise play passes on.
 */
function endTurn(s: EkState) {
  s.turnsRemaining -= 1;
  if (s.turnsRemaining > 0) {
    pushLog(s, s.turnPlayerId, `${seatName(s, s.turnPlayerId)} still owes ${s.turnsRemaining} turn${s.turnsRemaining === 1 ? '' : 's'}.`, 'normal');
    backToAction(s);
    return;
  }
  passTurn(s, nextLivePlayer(s, s.turnPlayerId));
}

/**
 * Turns an Attack-type card hands over. A player who was not attacked hands on
 * the card's number; a victim's attack stacks: "the Attacker's current and
 * remaining untaken turn(s) PLUS 2 additional turns".
 */
function attackTurns(s: EkState, n: number): number {
  return s.underAttack ? s.turnsRemaining + n : n;
}

function finishIfOver(s: EkState): boolean {
  const live = livePlayerIds(s);
  if (live.length > 1) return false;
  const winner = live[0];
  s.phase = 'gameOver';
  s.subPhase = 'gameOver';
  s.activePlayerId = null;
  s.pending = null;
  // Score = how many players you outlasted. Winner tops the table.
  s.finalScores = Object.fromEntries(
    s.seats.map((seat) => {
      const place = s.eliminated.indexOf(seat.id);
      return [seat.id, place < 0 ? s.seats.length - 1 : place];
    }),
  );
  if (winner) pushLog(s, winner, `🏆 ${seatName(s, winner)} is the last cat standing.`, 'good');
  return true;
}

/**
 * `id` explodes. The kitten(s) that killed them go face up in front of them.
 * Base game: the rest of their hand goes face down in front of them, out of
 * the game. Zombie Kittens: the dead keep their hand.
 */
function eliminate(s: EkState, id: PlayerId, killers: EkCard[]) {
  s.eliminated.push(id);
  s.deadKittens[id] = [...(s.deadKittens[id] ?? []), ...killers];

  // Anything others placed in front of them, and anything they placed in front of others, is discarded.
  if (s.illTakeThat) {
    for (const [victim, itt] of Object.entries(s.illTakeThat)) {
      if (victim === id || itt.thiefId === id) {
        s.discard.push(itt.card);
        delete s.illTakeThat[victim];
      }
    }
  }

  if (!zombieMode(s)) {
    const out = [...handOf(s, id)];
    for (const c of out) unmarkCard(s, c.id);
    const crown = s.towerStash?.[id];
    if (crown) {
      out.push(...crown);
      delete s.towerStash![id];
    }
    const bark = s.barkingFaceUp?.[id];
    if (bark) {
      s.discard.push(bark);
      delete s.barkingFaceUp![id];
    }
    s.deadHands[id] = [...(s.deadHands[id] ?? []), ...out];
    s.hands[id] = [];
    s.knownTopCount[id] = 0;
    if (s.sightings) s.sightings[id] = [];
    s.cursedPlayers = (s.cursedPlayers ?? []).filter((p) => p !== id);
  }
  pushLog(s, id, zombieMode(s) ? `🧟 ${seatName(s, id)} died.` : `💥 ${seatName(s, id)} exploded.`, 'danger');

  if (finishIfOver(s)) return;

  // The turn owner exploding passes the turn (any owed turns die with them);
  // someone exploding mid-turn leaves the turn owner's turn running.
  if (id === s.turnPlayerId || !isLive(s, s.turnPlayerId)) {
    passTurn(s, nextLivePlayer(s, id));
    return;
  }
  backToAction(s);
}

/** Put `pid` in front of `kitten`: Defuse prompt if they can, death if they can't. */
function confrontKitten(s: EkState, pid: PlayerId, kitten: EkCard, endsTurn: boolean): void {
  s.pendingKitten = kitten;
  s.defuseEndsTurn = endsTurn;
  // (A Cursed player answers blind, flipping face-down cards until a Defuse
  // turns up — but with no Defuse at all the outcome is already certain.)
  if (canDefuse(s, pid)) {
    s.subPhase = 'awaitingDefuse';
    s.activePlayerId = pid;
    return;
  }
  explodePending(s, pid);
}

/** The player facing `pendingKitten` dies: no Defuse, or (Zombie Kittens) they chose not to. */
function explodePending(s: EkState, pid: PlayerId) {
  const kitten = s.pendingKitten;
  s.pendingKitten = null;
  const killers = [...(kitten ? [kitten] : []), ...(s.moreKittensToDefuse ?? [])];
  s.moreKittensToDefuse = [];
  const endsTurn = s.defuseEndsTurn !== false;
  s.defuseEndsTurn = true;
  // Read before eliminate(): a dying turn owner passes the turn on.
  const wasTurnOwner = pid === s.turnPlayerId;
  eliminate(s, pid, killers);
  if (s.phase === 'gameOver') return;
  // Someone else died from the turn owner's draw (I'll Take That): the draw still ends that turn.
  if (endsTurn && !wasTurnOwner) endTurn(s);
}

/**
 * Streaking Kitten: a live player holding more Exploding Kittens than
 * Streaking Kittens has one go off. Returns true if it took over the flow.
 */
function checkExposedKittens(s: EkState): boolean {
  for (const pid of livePlayerIds(s)) {
    const h = handOf(s, pid);
    const streakingCount = h.filter((c) => c.kind === 'streakingKitten').length;
    const kittens = h.filter((c) => c.kind === 'explodingKitten');
    if (kittens.length > streakingCount) {
      const exposed = takeFromHand(s, pid, kittens[0]!.id);
      pushLog(s, pid, `💥 ${seatName(s, pid)} lost their Streaking Kitten — the Exploding Kitten they were hiding goes off!`, 'danger');
      confrontKitten(s, pid, exposed, false);
      return true;
    }
  }
  return false;
}

/** Common tail for effects that move cards between hands. */
function settle(s: EkState) {
  if (!checkExposedKittens(s)) backToAction(s);
}

/**
 * Move a card from one hand to another (steal, Favor, demand). "If another
 * player steals or receives an Exploding Kitten from your hand, they explode.
 * They must defuse it or die." Returns true if a kitten took over the flow.
 */
function transferCard(s: EkState, to: PlayerId, card: EkCard): boolean {
  unmarkCard(s, card.id);
  if (card.kind === 'explodingKitten') {
    pushLog(s, to, `💥 ${seatName(s, to)} got an Exploding Kitten out of someone's hand!`, 'danger');
    confrontKitten(s, to, card, false);
    return true;
  }
  addToHand(s, to, card);
  return false;
}

// ============================================================================
// Reaction window
// ============================================================================

/**
 * Who may still respond to the pending play. Only players who actually hold a
 * Nope are queued — everyone else has no legal response, so prompting them
 * would be noise. `justPlayedBy` is excluded: you don't get to answer your own
 * card. Dead players may Nope with Zombie Kittens. Cursed players can't look
 * at their cards, so they are never asked.
 */
function buildResponderQueue(s: EkState, justPlayedBy: PlayerId): PlayerId[] {
  const pool = zombieMode(s) ? s.seats.map((x) => x.id) : livePlayerIds(s);
  return pool.filter((id) => id !== justPlayedBy && !isCursed(s, id) && hasKind(s, id, 'nope'));
}

function openOrResolve(s: EkState, justPlayedBy: PlayerId) {
  const queue = buildResponderQueue(s, justPlayedBy);
  if (!s.pending) throw new Error('openOrResolve with no pending play');
  s.pending.responderQueue = queue;
  const first = queue[0];
  if (!first) {
    resolvePending(s);
    return;
  }
  s.subPhase = 'awaitingNope';
  s.activePlayerId = first;
}

/** Flush played cards to the discard pile. */
function flush(s: EkState, cards: EkCard[]) {
  s.discard.push(...cards);
}

/**
 * Resolve the parked play. An odd number of Nopes cancels it; an even number
 * (including zero) means it goes through.
 */
function resolvePending(s: EkState) {
  const p = s.pending;
  if (!p) throw new Error('resolvePending with no pending play');
  s.pending = null;

  const cancelled = p.nopeCards.length % 2 === 1;
  const spent = [...p.cards, ...p.nopeCards];

  if (cancelled) {
    const label = p.combo ? comboLabel(p.combo) : CARD_LABEL[p.cards[0]!.kind];
    pushLog(s, null, `${label} was Noped${p.nopeCards.length > 1 ? ` (${p.nopeCards.length} Nopes deep)` : ''}.`, 'normal');
    flush(s, spent);
    settle(s);
    return;
  }

  // The five-different combo keeps its cards out of the discard until after the
  // pick, so the player can't reclaim what they just played.
  if (p.combo === 'fiveDifferent') {
    flush(s, p.nopeCards);
    s.limbo = p.cards;
    applyComboEffect(s, p);
    return;
  }

  // I'll Take That sits face up in front of its victim, not on the discard pile.
  const single = p.cards[0];
  const effective = single && !p.combo ? effectiveKind(p) : null;
  if (effective === 'illTakeThat' && single) {
    flush(s, p.nopeCards);
    applySingleEffect(s, p);
    return;
  }

  flush(s, spent);
  if (p.combo) {
    applyComboEffect(s, p);
    return;
  }
  applySingleEffect(s, p);
}

function comboLabel(c: EkComboKind): string {
  if (c === 'pair') return 'A pair';
  if (c === 'triple') return 'A three-of-a-kind';
  return 'A five-card spread';
}

function effectiveKind(p: EkPendingPlay): EkBaseCardKind {
  const card = p.cards[0];
  if (!card) throw new Error('single play with no card');
  if (card.kind !== 'clone') return card.kind;
  if (!p.clonedKind) throw new Error('Clone resolved with nothing to copy');
  return p.clonedKind;
}

// ============================================================================
// Effects
// ============================================================================

/**
 * Tower of Power: "If anyone steals cards from you, they take a random card
 * from the Crown instead of your hand (until there are no more cards left in
 * the Crown)." That covers Favor, pairs, and three of a kind alike.
 */
function takeFromCrown(s: EkState, target: PlayerId): EkCard | null {
  const crown = s.towerStash?.[target];
  if (!crown || crown.length === 0 || !isLive(s, target)) return null;
  const [taken] = crown.splice(rngInt(s.rngState, crown.length), 1);
  return taken ?? null;
}

function startPeek(s: EkState, by: PlayerId, count: number, canReorder: boolean, shareWithNext = false) {
  s.peek = { playerId: by, cards: s.deck.slice(0, count), canReorder, ...(shareWithNext ? { shareWithNext } : {}) };
  s.subPhase = 'awaitingFutureView';
  s.activePlayerId = by;
}

function applySingleEffect(s: EkState, p: EkPendingPlay) {
  const card = p.cards[0]!;
  const by = p.byPlayerId;
  const kind = effectiveKind(p);

  switch (kind) {
    case 'attack': {
      const next = nextLivePlayer(s, s.turnPlayerId);
      const turns = attackTurns(s, 2);
      pushLog(s, by, `${seatName(s, by)} attacked — ${seatName(s, next)} now owes ${turns} turns.`, 'danger');
      passTurn(s, next, turns, true);
      return;
    }
    case 'targetedAttack': {
      const target = p.targetPlayerId ?? nextLivePlayer(s, s.turnPlayerId);
      const turns = attackTurns(s, 2);
      pushLog(s, by, `${seatName(s, by)} launched a Targeted Attack on ${target === by ? 'themselves' : seatName(s, target)} — ${turns} turns.`, 'danger');
      passTurn(s, target, turns, true);
      return;
    }
    case 'attackOfTheDead': {
      const dead = deadPlayerIds(s).length;
      const next = nextLivePlayer(s, s.turnPlayerId);
      const turns = attackTurns(s, 3 * dead);
      pushLog(s, by, `🧟 ${seatName(s, by)} raised an Attack of the Dead — ${seatName(s, next)} now owes ${turns} turns.`, 'danger');
      passTurn(s, next, turns, true);
      return;
    }
    case 'personalAttack': {
      // "Immediately take 3 turns in a row. Continue taking your current turn as normal."
      s.turnsRemaining = attackTurns(s, 3);
      s.underAttack = true;
      pushLog(s, by, `${seatName(s, by)} played a Personal Attack — ${s.turnsRemaining} turns in a row.`, 'normal');
      backToAction(s);
      return;
    }
    case 'skip': {
      pushLog(s, by, `${seatName(s, by)} skipped without drawing.`, 'normal');
      endTurn(s);
      return;
    }
    case 'superSkip': {
      pushLog(s, by, `${seatName(s, by)} played Super Skip and ended all their turns.`, 'normal');
      s.turnsRemaining = 1;
      endTurn(s);
      return;
    }
    case 'reverse': {
      s.turnDirection = s.turnDirection === 1 ? -1 : 1;
      pushLog(s, by, `${seatName(s, by)} reversed the order of play and ended a turn without drawing.`, 'normal');
      endTurn(s);
      return;
    }
    case 'drawFromTheBottom': {
      const drawn = s.deck.pop();
      pushLog(s, by, `${seatName(s, by)} drew from the bottom of the deck.`, 'normal');
      resolveDrawnCard(s, by, drawn, 'bottom');
      return;
    }
    case 'shuffle':
    case 'shuffleNow': {
      s.deck = shuffle(s.rngState, s.deck);
      forgetEverything(s);
      pushLog(s, by, `${seatName(s, by)} shuffled the deck. Nobody knows anything now.`, 'normal');
      backToAction(s);
      return;
    }
    case 'swapTopAndBottom': {
      if (s.deck.length >= 2) {
        const top = s.deck[0]!;
        const bottom = s.deck[s.deck.length - 1]!;
        s.deck[0] = bottom;
        s.deck[s.deck.length - 1] = top;
        for (const id of Object.keys(s.knownTopCount)) s.knownTopCount[id] = 0;
        forgetSightings(s, (cardId) => cardId === top.id || cardId === bottom.id);
        syncFaceUpImplodingKnowledge(s);
      }
      pushLog(s, by, `${seatName(s, by)} swapped the top and bottom cards of the deck.`, 'normal');
      backToAction(s);
      return;
    }
    case 'seeTheFuture':
      pushLog(s, by, `${seatName(s, by)} peeked at the future.`, 'normal');
      startPeek(s, by, FUTURE_COUNT, false);
      return;
    case 'seeTheFuture5x':
      pushLog(s, by, `${seatName(s, by)} peeked 5 cards into the future.`, 'normal');
      startPeek(s, by, 5, false);
      return;
    case 'alterTheFuture':
    case 'alterTheFutureNow':
      pushLog(s, by, `${seatName(s, by)} is altering the top 3 cards of the future.`, 'normal');
      startPeek(s, by, FUTURE_COUNT, true);
      return;
    case 'alterTheFuture5x':
      pushLog(s, by, `${seatName(s, by)} is altering the top 5 cards of the future.`, 'normal');
      startPeek(s, by, 5, true);
      return;
    case 'shareTheFuture':
      pushLog(s, by, `${seatName(s, by)} is rearranging the future to share with the next player.`, 'normal');
      startPeek(s, by, FUTURE_COUNT, true, true);
      return;
    case 'favor': {
      const target = p.targetPlayerId;
      if (!target) throw new Error('favor resolved with no target');
      const crownCard = takeFromCrown(s, target);
      if (crownCard) {
        pushLog(s, by, `${seatName(s, target)}'s Tower of Power absorbed the Favor — ${seatName(s, by)} took a random Crown card.`, 'normal');
        if (!transferCard(s, by, crownCard)) settle(s);
        return;
      }
      if (handOf(s, target).length === 0) {
        pushLog(s, by, `${seatName(s, by)} asked ${seatName(s, target)} for a favour, but their hand is empty.`, 'normal');
        backToAction(s);
        return;
      }
      s.pendingFavor = { fromPlayerId: target, toPlayerId: by };
      s.subPhase = 'awaitingFavorGive';
      s.activePlayerId = target;
      pushLog(s, by, `${seatName(s, by)} demanded a favour from ${seatName(s, target)}.`, 'normal');
      return;
    }
    case 'catomicBomb': {
      // "Remove all the Exploding Kittens … so that everyone can see them. Shuffle
      // the Draw Pile, then return all the Exploding Kittens face down on top. Then,
      // end your turn." The Imploding Kitten stays in the shuffle.
      const kittens = s.deck.filter((c) => c.kind === 'explodingKitten');
      const rest = shuffle(s.rngState, s.deck.filter((c) => c.kind !== 'explodingKitten'));
      s.deck = [...kittens, ...rest];
      forgetEverything(s);
      for (const id of Object.keys(s.knownTopCount)) s.knownTopCount[id] = Math.max(s.knownTopCount[id] ?? 0, kittens.length);
      pushLog(s, by, `☢️ ${seatName(s, by)} dropped the Catomic Bomb! ${kittens.length} Exploding Kitten${kittens.length === 1 ? '' : 's'} now sit on top of the deck.`, 'danger');
      endTurn(s);
      return;
    }
    case 'garbageCollection': {
      const queue = livePlayersFrom(s, by).filter((id) => handOf(s, id).length > 0);
      if (queue.length === 0) {
        s.deck = shuffle(s.rngState, s.deck);
        forgetEverything(s);
        backToAction(s);
        return;
      }
      s.pendingGarbage = { queue, collected: [] };
      s.subPhase = 'awaitingGarbagePick';
      s.activePlayerId = queue[0]!;
      pushLog(s, by, `${seatName(s, by)} triggered Garbage Collection — every player puts a card into the deck.`, 'normal');
      return;
    }
    case 'mark': {
      const target = p.targetPlayerId;
      if (!target) throw new Error('mark resolved with no target');
      const victimHand = handOf(s, target);
      if (victimHand.length === 0) {
        pushLog(s, by, `${seatName(s, by)} tried to Mark ${seatName(s, target)}, but their hand is empty.`, 'normal');
        backToAction(s);
        return;
      }
      if (!s.markedCardIds) s.markedCardIds = [];
      const unmarked = victimHand.filter((c) => !s.markedCardIds!.includes(c.id));
      const pool = unmarked.length > 0 ? unmarked : victimHand;
      const chosen = pool[rngInt(s.rngState, pool.length)]!;
      if (!s.markedCardIds.includes(chosen.id)) s.markedCardIds.push(chosen.id);
      // A Marked card faces everyone, so naming it in the log hides nothing.
      pushLog(s, by, `🎯 ${seatName(s, by)} Marked a card in ${seatName(s, target)}'s hand (${CARD_LABEL[chosen.kind]}).`, 'normal');
      backToAction(s);
      return;
    }
    case 'curseOfTheCatButt': {
      const target = p.targetPlayerId;
      if (!target) throw new Error('curseOfTheCatButt resolved with no target');
      if (!s.cursedPlayers) s.cursedPlayers = [];
      if (!s.cursedPlayers.includes(target)) s.cursedPlayers.push(target);
      s.hands[target] = shuffle(s.rngState, handOf(s, target));
      pushLog(s, by, `🙈 ${seatName(s, by)} cursed ${seatName(s, target)} with the Curse of the Cat Butt!`, 'danger');
      backToAction(s);
      return;
    }
    case 'bury': {
      const top = s.deck.shift();
      if (!top) {
        endTurn(s);
        return;
      }
      decayKnowledgeOnDraw(s);
      uncurse(s, by);
      s.pendingBury = top;
      s.subPhase = 'awaitingBuryPlace';
      s.activePlayerId = by;
      pushLog(s, by, `${seatName(s, by)} drew the top card to Bury it back in the deck.`, 'normal');
      return;
    }
    case 'illTakeThat': {
      const target = p.targetPlayerId;
      if (!target) throw new Error('illTakeThat resolved with no target');
      if (!s.illTakeThat) s.illTakeThat = {};
      s.illTakeThat[target] = { thiefId: by, card };
      pushLog(s, by, `${seatName(s, by)} put "I'll Take That" in front of ${seatName(s, target)}.`, 'normal');
      backToAction(s);
      return;
    }
    case 'potluck': {
      const queue = livePlayersFrom(s, by).filter((id) => handOf(s, id).length > 0);
      if (queue.length === 0) {
        backToAction(s);
        return;
      }
      s.pendingPotluck = { queue };
      s.subPhase = 'awaitingPotluckPick';
      s.activePlayerId = queue[0]!;
      pushLog(s, by, `${seatName(s, by)} started a Potluck — each player puts a card on top of the deck.`, 'normal');
      return;
    }
    case 'towerOfPower': {
      if (!s.towerStash) s.towerStash = {};
      const stash = s.stash ?? [];
      s.towerStash[by] = [...(s.towerStash[by] ?? []), ...stash];
      s.stash = [];
      pushLog(s, by, `👑 ${seatName(s, by)} put on the Tower of Power Crown, with ${stash.length} Stash cards inside.`, 'good');
      backToAction(s);
      return;
    }
    case 'digDeeper': {
      // "If there is only 1 card remaining in the Draw Pile, Dig Deeper has no effect."
      const top = s.deck[0];
      if (s.deck.length <= 1 || !top) {
        pushLog(s, by, `${seatName(s, by)} tried to Dig Deeper, but there is nothing to dig into.`, 'normal');
        backToAction(s);
        return;
      }
      s.knownTopCount[by] = Math.max(s.knownTopCount[by] ?? 0, 1);
      s.pendingDigDeeper = { playerId: by, card: top };
      s.subPhase = 'awaitingDigDeeper';
      s.activePlayerId = by;
      pushLog(s, by, `${seatName(s, by)} is Digging Deeper — looking at the top card.`, 'normal');
      return;
    }
    case 'feedTheDead': {
      const target = p.targetPlayerId;
      if (!target) throw new Error('feedTheDead resolved with no target');
      if (isLive(s, target)) {
        pushLog(s, by, `${seatName(s, target)} is back among the living — Feed the Dead does nothing.`, 'normal');
        backToAction(s);
        return;
      }
      const queue = livePlayersFrom(s, s.turnPlayerId).filter((id) => id !== by && handOf(s, id).some((c) => c.kind !== 'explodingKitten'));
      pushLog(s, by, `🧟 ${seatName(s, by)} is Feeding the Dead — everyone alive gives ${seatName(s, target)} a card.`, 'normal');
      startDonation(s, 'feedTheDead', queue, target);
      return;
    }
    case 'graveRobber': {
      const queue = seatsFrom(s, s.turnPlayerId).filter((id) => !isLive(s, id) && handOf(s, id).length > 0);
      pushLog(s, by, `🪦 ${seatName(s, by)} robbed the graves — each dead player shuffles a card into the deck.`, 'normal');
      startDonation(s, 'graveRobber', queue, null);
      return;
    }
    default:
      throw new Error(`card ${card.kind} has no single-play effect`);
  }
}

function startDonation(s: EkState, kind: 'feedTheDead' | 'graveRobber', queue: PlayerId[], to: PlayerId | null) {
  if (queue.length === 0) {
    s.pendingDonation = { kind, queue, toPlayerId: to, collected: [] };
    finishDonation(s);
    return;
  }
  s.pendingDonation = { kind, queue, toPlayerId: to, collected: [] };
  s.subPhase = 'awaitingDonation';
  s.activePlayerId = queue[0]!;
}

function finishDonation(s: EkState) {
  const pd = s.pendingDonation;
  s.pendingDonation = null;
  if (pd?.kind === 'graveRobber') {
    s.deck = shuffle(s.rngState, [...s.deck, ...pd.collected]);
    forgetEverything(s);
    pushLog(s, null, `🪦 ${pd.collected.length} card${pd.collected.length === 1 ? '' : 's'} went from the graves into the deck, and it was shuffled.`, 'normal');
  }
  settle(s);
}

function applyComboEffect(s: EkState, p: EkPendingPlay) {
  const by = p.byPlayerId;

  if (p.combo === 'pair' || p.combo === 'triple') {
    const target = p.targetPlayerId;
    if (!target) throw new Error(`${p.combo} resolved with no target`);
    const crownCard = takeFromCrown(s, target);
    if (crownCard) {
      pushLog(s, by, `${seatName(s, target)}'s Tower of Power protected their hand — ${seatName(s, by)} took a random Crown card.`, 'normal');
      if (!transferCard(s, by, crownCard)) settle(s);
      return;
    }
    const victimHand = handOf(s, target);
    if (p.combo === 'pair') {
      if (victimHand.length === 0) {
        pushLog(s, by, `${seatName(s, by)} went fishing in ${seatName(s, target)}'s empty hand.`, 'normal');
        backToAction(s);
        return;
      }
      const [stolen] = victimHand.splice(rngInt(s.rngState, victimHand.length), 1);
      pushLog(s, by, `${seatName(s, by)} stole a card at random from ${seatName(s, target)}.`, 'normal');
      if (stolen && transferCard(s, by, stolen)) return;
      settle(s);
      return;
    }
    const want = p.demandKind;
    if (!want) throw new Error('triple resolved without a demand');
    const idx = victimHand.findIndex((c) => c.kind === want);
    if (idx < 0) {
      pushLog(s, by, `${seatName(s, by)} demanded ${CARD_LABEL[want]} from ${seatName(s, target)} — they had none.`, 'normal');
      backToAction(s);
      return;
    }
    const [taken] = victimHand.splice(idx, 1);
    if (isCursed(s, target)) s.hands[target] = shuffle(s.rngState, victimHand);
    pushLog(s, by, `${seatName(s, by)} took ${CARD_LABEL[want]} from ${seatName(s, target)}.`, 'normal');
    if (taken && transferCard(s, by, taken)) return;
    settle(s);
    return;
  }

  // fiveDifferent — pick anything out of the discard pile.
  if (s.discard.length === 0) {
    pushLog(s, by, `${seatName(s, by)} played five different cards, but the discard pile is empty.`, 'normal');
    flush(s, s.limbo);
    s.limbo = [];
    settle(s);
    return;
  }
  s.subPhase = 'awaitingDiscardPick';
  s.activePlayerId = by;
  pushLog(s, by, `${seatName(s, by)} played five different cards and is digging through the discard pile.`, 'normal');
}

// ============================================================================
// Playing cards
// ============================================================================

/**
 * Can this card be put down on its own right now (ignoring targets)? Shared by
 * the reducer, the UI and the AI so all three agree.
 */
export function canPlaySingle(s: EkState, playerId: PlayerId, card: EkCard): boolean {
  const kind = card.kind === 'clone' ? findCloneTargetKind(s) : card.kind;
  if (!kind || !isPlayableAction(kind)) return false;
  // A Clone becomes the card it copies, but is still a Clone when played: never out of turn.
  if (card.kind === 'clone' && (playerId !== s.turnPlayerId || !isLive(s, playerId))) return false;
  if (kind === 'bury' && s.illTakeThat?.[playerId]) return false;
  if ((kind === 'graveRobber' || kind === 'attackOfTheDead' || kind === 'feedTheDead') && deadPlayerIds(s).length === 0) return false;
  if (kind === 'towerOfPower' && (s.stash?.length ?? 0) === 0) return false;
  return true;
}

/** Who this single card may target. */
export function legalTargetsFor(s: EkState, playerId: PlayerId, kind: EkBaseCardKind): PlayerId[] {
  if (kind === 'feedTheDead') return deadPlayerIds(s);
  const live = livePlayerIds(s);
  if (kind === 'targetedAttack') return live; // "choose any player (including yourself)"
  if (kind === 'illTakeThat') return live.filter((id) => id !== playerId && !s.illTakeThat?.[id]);
  return live.filter((id) => id !== playerId);
}

/** Does putting these Barking Kittens down need a target? (Both of them together, in any way.) */
export function barkingNeedsTarget(s: EkState, playerId: PlayerId, cardCount: number): boolean {
  return cardCount >= 2 || !!s.barkingFaceUp?.[playerId];
}

function openPlay(
  s: EkState,
  by: PlayerId,
  cards: EkCard[],
  combo: EkComboKind | null,
  targetPlayerId: PlayerId | null,
  demandKind: EkBaseCardKind | null,
  clonedKind: EkBaseCardKind | null,
) {
  const label = combo ? comboLabel(combo) : CARD_LABEL[cards[0]!.kind];
  const as = clonedKind ? ` (as ${CARD_LABEL[clonedKind]})` : '';
  pushLog(s, by, `${seatName(s, by)} played ${label}${as}${targetPlayerId ? ` on ${targetPlayerId === by ? 'themselves' : seatName(s, targetPlayerId)}` : ''}.`, 'normal');
  s.pending = {
    byPlayerId: by,
    cards,
    combo,
    targetPlayerId,
    demandKind,
    clonedKind,
    nopeCards: [],
    responderQueue: [],
  };
  openOrResolve(s, by);
}

function handlePlayCards(s: EkState, a: Extract<EkAction, { type: 'playCards' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot play cards during ${s.subPhase}`);
  if (a.cardIds.length === 0) throw new Error('no cards specified');
  if (new Set(a.cardIds).size !== a.cardIds.length) throw new Error('duplicate card ids');
  const actor = a.playerId;
  const live = isLive(s, actor);
  const hand = handOf(s, actor);
  const cards = a.cardIds.map((id) => {
    const card = hand.find((c) => c.id === id);
    if (!card) throw new Error(`card ${id} not in hand`);
    return card;
  });

  const onTurn = live && actor === s.activePlayerId;
  const nowPlay = cards.length === 1 && isNowKind(cards[0]!.kind);
  if (!onTurn) {
    if (!nowPlay) throw new Error('not your turn');
    if (!live && !zombieMode(s)) throw new Error('eliminated players cannot act');
  }

  if (isCursed(s, actor)) {
    if (!onTurn) throw new Error('a Cursed player can only play blind on their own turn');
    handleBlindPlay(s, actor, cards);
    return;
  }

  // Barking Kittens can't be Noped: they go off at once.
  if (cards.every((c) => c.kind === 'barkingKitten')) {
    if (cards.length > 2) throw new Error('there are only two Barking Kittens');
    playBarking(s, actor, cards.map((c) => c.id), a.targetPlayerId);
    return;
  }

  const single = cards.length === 1 ? cards[0]! : null;
  const combo = single ? null : detectCombo(cards, comboRules(s));
  let clonedKind: EkBaseCardKind | null = null;
  if (single) {
    const kind = single.kind;
    if (kind === 'nope') throw new Error('Nope can only be played in response to another card');
    if (isDefuseKind(kind)) throw new Error('Defuse can only be played against a kitten');
    if (isKittenKind(kind)) throw new Error('you cannot play an Exploding Kitten');
    if (isCatKind(kind)) throw new Error('cat cards do nothing on their own — play a combo');
    if (kind === 'clairvoyance') throw new Error('Clairvoyance answers a Zombie Kitten');
    if (kind === 'clone' && !findCloneTargetKind(s)) throw new Error('there is nothing on the discard pile a Clone can copy');
    if (!canPlaySingle(s, actor, single)) throw new Error(`${CARD_LABEL[kind]} cannot be played right now`);
    if (kind === 'clone') clonedKind = findCloneTargetKind(s);
  } else if (!combo) {
    throw new Error('those cards do not form a legal combo');
  }
  const effectiveSingleKind = single ? (clonedKind ?? single.kind) : null;

  // Target / demand validation.
  const needsTarget = combo === 'pair' || combo === 'triple'
    || (effectiveSingleKind !== null && needsTargetForKind(effectiveSingleKind));
  const targetPlayerId = a.targetPlayerId ?? null;
  if (needsTarget) {
    if (!targetPlayerId) throw new Error('this play needs a target');
    const legal = effectiveSingleKind ? legalTargetsFor(s, actor, effectiveSingleKind) : livePlayerIds(s).filter((id) => id !== actor);
    if (!legal.includes(targetPlayerId)) {
      if (targetPlayerId === actor) throw new Error('you cannot target yourself');
      throw new Error('that player cannot be targeted');
    }
  }
  if (combo === 'triple' && !a.demandKind) throw new Error('a three-of-a-kind must name a card');

  const played = a.cardIds.map((id) => takeFromHand(s, actor, id));
  openPlay(s, actor, played, combo, needsTarget ? targetPlayerId : null, combo === 'triple' ? a.demandKind ?? null : null, clonedKind);
}

/**
 * Curse of the Cat Butt: "if the Cursed player decides to play any cards,
 * those cards must be picked randomly and played face up on the Discard Pile.
 * If the card is playable, play as normal. If not (a single Cat Card, etc.)
 * the card is lost." One face-down card at a time; its target is chosen after
 * it is revealed.
 */
function handleBlindPlay(s: EkState, actor: PlayerId, cards: EkCard[]) {
  if (cards.length !== 1) throw new Error('a Cursed player plays one face-down card at a time');
  const card = takeFromHand(s, actor, cards[0]!.id);
  const kind = card.kind;
  pushLog(s, actor, `🙈 ${seatName(s, actor)} blindly played… ${CARD_LABEL[kind]}!`, 'normal');

  if (kind === 'explodingKitten') {
    // "If you play an Exploding Kitten while Cursed, you explode immediately and must defuse it without looking."
    confrontKitten(s, actor, card, false);
    return;
  }
  if (kind === 'barkingKitten') {
    if (barkingNeedsTarget(s, actor, 1)) {
      s.pendingBlindCard = card;
      s.subPhase = 'awaitingBlindTarget';
      s.activePlayerId = actor;
      return;
    }
    handOf(s, actor).push(card);
    playBarking(s, actor, [card.id], undefined);
    return;
  }

  const playable = kind !== 'clairvoyance' && canPlaySingle(s, actor, card);
  if (!playable) {
    flush(s, [card]);
    pushLog(s, actor, `It does nothing on its own — the ${CARD_LABEL[kind]} is lost.`, 'normal');
    settle(s);
    return;
  }
  const clonedKind = kind === 'clone' ? findCloneTargetKind(s) : null;
  const effective = clonedKind ?? kind;
  if (needsTargetForKind(effective)) {
    if (legalTargetsFor(s, actor, effective).length === 0) {
      flush(s, [card]);
      pushLog(s, actor, `Nobody can be targeted — the ${CARD_LABEL[kind]} is lost.`, 'normal');
      settle(s);
      return;
    }
    s.pendingBlindCard = card;
    s.subPhase = 'awaitingBlindTarget';
    s.activePlayerId = actor;
    return;
  }
  openPlay(s, actor, [card], null, null, null, clonedKind);
}

function handleChooseBlindTarget(s: EkState, a: Extract<EkAction, { type: 'chooseBlindTarget' }>) {
  if (s.subPhase !== 'awaitingBlindTarget') throw new Error('no blind card waiting for a target');
  if (a.playerId !== s.activePlayerId) throw new Error('not your card');
  const card = s.pendingBlindCard;
  if (!card) throw new Error('no blind card');
  if (card.kind === 'barkingKitten') {
    s.pendingBlindCard = null;
    handOf(s, a.playerId).push(card);
    playBarking(s, a.playerId, [card.id], a.targetPlayerId);
    return;
  }
  const clonedKind = card.kind === 'clone' ? findCloneTargetKind(s) : null;
  const effective = clonedKind ?? card.kind;
  if (!legalTargetsFor(s, a.playerId, effective).includes(a.targetPlayerId)) throw new Error('that player cannot be targeted');
  s.pendingBlindCard = null;
  openPlay(s, a.playerId, [card], null, a.targetPlayerId, null, clonedKind);
}

/**
 * Barking Kittens. One alone: whoever holds the other (or has it face up in
 * front of them) is the target. If nobody does, it stays face up in front of
 * you and YOU are the target when the other is played. Both together (or the
 * second while the first is in front of you): pick any player. The target
 * must Defuse — without reinserting anything — or explode. Cannot be Noped.
 */
function playBarking(s: EkState, by: PlayerId, cardIds: number[], targetPlayerId: PlayerId | undefined) {
  const both = barkingNeedsTarget(s, by, cardIds.length);
  if (both) {
    if (!targetPlayerId || targetPlayerId === by || !isLive(s, targetPlayerId)) throw new Error('choose another living player as the Barking Kittens\' target');
  }
  const played = cardIds.map((id) => takeFromHand(s, by, id));
  const card = played[0]!;

  if (both) {
    const mine = s.barkingFaceUp?.[by];
    if (mine) delete s.barkingFaceUp![by];
    const all = [...played, ...(mine ? [mine] : [])];
    pushLog(s, by, `🐶🐶 ${seatName(s, by)} has both Barking Kittens — and set them on ${seatName(s, targetPlayerId!)}!`, 'danger');
    barkingHit(s, targetPlayerId!, all);
    return;
  }

  const others = livePlayerIds(s).filter((id) => id !== by);
  const holder = others.find((id) => hasKind(s, id, 'barkingKitten'));
  const faceUpOwner = others.find((id) => !!s.barkingFaceUp?.[id]);
  const victim = holder ?? faceUpOwner;
  if (!victim) {
    if (!s.barkingFaceUp) s.barkingFaceUp = {};
    s.barkingFaceUp[by] = card;
    pushLog(s, by, `🐶 ${seatName(s, by)} barked — but nobody has the other Barking Kitten. It stays in front of them.`, 'normal');
    backToAction(s);
    return;
  }
  let other: EkCard | undefined;
  if (holder) {
    const theirs = handOf(s, holder).find((c) => c.kind === 'barkingKitten');
    if (theirs) other = takeFromHand(s, holder, theirs.id);
  } else if (faceUpOwner) {
    other = s.barkingFaceUp![faceUpOwner];
    delete s.barkingFaceUp![faceUpOwner];
  }
  pushLog(s, by, `🐶💥 ${seatName(s, by)}'s Barking Kitten found ${seatName(s, victim)}!`, 'danger');
  barkingHit(s, victim, [card, ...(other ? [other] : [])]);
}

function barkingHit(s: EkState, victim: PlayerId, barkCards: EkCard[]) {
  const [first, ...rest] = barkCards;
  // The extra Barking Kitten(s) go to the discard now; the first stands in for "the kitten" being defused.
  flush(s, rest);
  confrontKitten(s, victim, first!, false);
}

function handlePlayNope(s: EkState, a: Extract<EkAction, { type: 'playNope' }>) {
  if (s.subPhase !== 'awaitingNope') throw new Error('there is nothing to Nope');
  const p = s.pending;
  if (!p) throw new Error('no pending play');
  if (!p.responderQueue.includes(a.playerId)) throw new Error('you are not being asked to respond');

  const card = takeFromHand(s, a.playerId, a.cardId);
  if (card.kind !== 'nope') {
    handOf(s, a.playerId).push(card);
    throw new Error('that card is not a Nope');
  }
  p.nopeCards.push(card);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} said NOPE.`, 'danger');

  // A Nope changes the situation, so the window reopens for everyone else.
  openOrResolve(s, a.playerId);
}

function handleDeclineNope(s: EkState, a: Extract<EkAction, { type: 'declineNope' }>) {
  if (s.subPhase !== 'awaitingNope') throw new Error('nothing to respond to');
  const p = s.pending;
  if (!p) throw new Error('no pending play');
  if (p.responderQueue[0] !== a.playerId) throw new Error('it is not your response');

  p.responderQueue.shift();
  const next = p.responderQueue[0];
  if (!next) {
    resolvePending(s);
    return;
  }
  s.activePlayerId = next;
}

// ============================================================================
// Drawing
// ============================================================================

/**
 * Resolve a drawn card. `knowledge` says how the deck changed: 'top' and
 * 'bottom' are the usual draws; 'done' means the caller already updated it.
 */
function resolveDrawnCard(s: EkState, drawerId: PlayerId, drawn: EkCard | undefined, knowledge: 'top' | 'bottom' | 'done') {
  if (!drawn) {
    pushLog(s, drawerId, 'The deck is empty. Turn passes.', 'normal');
    endTurn(s);
    return;
  }

  if (knowledge === 'top') {
    decayKnowledgeOnDraw(s);
  } else if (knowledge === 'bottom') {
    for (const id of Object.keys(s.knownTopCount)) {
      s.knownTopCount[id] = Math.min(s.knownTopCount[id] ?? 0, s.deck.length);
    }
    pruneSightings(s);
    syncFaceUpImplodingKnowledge(s);
  }

  // I'll Take That: "The next time they draw a card, they must secretly view and then hand it to you."
  let recipientId = drawerId;
  const itt = s.illTakeThat?.[drawerId];
  if (itt) {
    delete s.illTakeThat![drawerId];
    s.discard.push(itt.card);
    if (isLive(s, itt.thiefId)) {
      recipientId = itt.thiefId;
      pushLog(s, itt.thiefId, `${seatName(s, itt.thiefId)}'s "I'll Take That" took the card ${seatName(s, drawerId)} drew!`, 'normal');
      // The drawer did draw successfully, even if they handed over a kitten.
      uncurse(s, drawerId);
    }
  }

  if (drawn.kind === 'implodingKitten') {
    if (!s.implodingFaceUp) {
      s.implodingFaceUp = true;
      s.pendingKitten = drawn;
      s.subPhase = 'awaitingKittenPlace';
      s.activePlayerId = recipientId;
      s.defuseEndsTurn = true;
      uncurse(s, drawerId);
      pushLog(s, recipientId, `🌀 ${seatName(s, recipientId)} drew the Imploding Kitten! It goes back into the deck FACE UP.`, 'danger');
      return;
    }
    // Face up: "you immediately die. This card cannot be Defused nor can it be Noped."
    pushLog(s, recipientId, `🌀💥 ${seatName(s, recipientId)} drew the face-up Imploding Kitten and imploded!`, 'danger');
    s.pendingKitten = drawn;
    s.defuseEndsTurn = true;
    explodePending(s, recipientId);
    return;
  }

  if (drawn.kind !== 'explodingKitten') {
    addToHand(s, recipientId, drawn);
    uncurse(s, drawerId);
    pushLog(s, drawerId, `${seatName(s, drawerId)} drew a card and ended their turn.`, 'normal');
    endTurn(s);
    return;
  }

  // Exploding Kitten! A Streaking Kitten lets the drawer keep it — in secret, so
  // the log reads exactly like any other draw.
  if (recipientId === drawerId && canHoldWithStreaking(s, drawerId) && wantsHold(s, drawerId)) {
    handOf(s, drawerId).push(drawn);
    uncurse(s, drawerId);
    pushLog(s, drawerId, `${seatName(s, drawerId)} drew a card and ended their turn.`, 'normal');
    endTurn(s);
    return;
  }
  pushLog(s, recipientId, `${seatName(s, recipientId)} drew an Exploding Kitten!`, 'danger');
  confrontKitten(s, recipientId, drawn, true);
}

function handleDrawCard(s: EkState, a: Extract<EkAction, { type: 'drawCard' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot draw during ${s.subPhase}`);
  if (a.playerId !== s.activePlayerId) throw new Error('not your turn');
  resolveDrawnCard(s, a.playerId, s.deck.shift(), 'top');
}

function handleSetStreakingHold(s: EkState, a: Extract<EkAction, { type: 'setStreakingHold' }>) {
  if (!s.hands[a.playerId]) throw new Error('unknown player');
  if (!s.streakingHold) s.streakingHold = {};
  s.streakingHold[a.playerId] = a.hold;
}

// ============================================================================
// Defusing and hiding kittens
// ============================================================================

function handlePlayDefuse(s: EkState, a: Extract<EkAction, { type: 'playDefuse' }>) {
  if (s.subPhase !== 'awaitingDefuse') throw new Error('nothing to defuse');
  if (a.playerId !== s.activePlayerId) throw new Error('not your kitten');
  const kitten = s.pendingKitten;
  if (!kitten) throw new Error('no pending kitten');
  const actor = a.playerId;
  const actsAsZombie = (c: EkCard) => c.kind === 'zombieKitten' || (c.kind === 'clone' && cloneSourceKind(s) === 'zombieKitten');
  const legal = defuseCards(s, actor);
  const handCard = handOf(s, actor).find((c) => c.id === a.cardId);
  if (!handCard) throw new Error('that card is not in your hand');

  if (isCursed(s, actor)) {
    // Blind: flip the chosen face-down card. "All non-Defuse Cards played are lost without any effect."
    const card = takeFromHand(s, actor, handCard.id);
    const isAnswer = legal.some((c) => c.id === card.id);
    if (!isAnswer) {
      if (card.kind === 'explodingKitten') {
        if (!s.moreKittensToDefuse) s.moreKittensToDefuse = [];
        s.moreKittensToDefuse.push(card);
        pushLog(s, actor, `🙈 ${seatName(s, actor)} flipped over… another Exploding Kitten! Both must be defused.`, 'danger');
      } else {
        flush(s, [card]);
        pushLog(s, actor, `🙈 ${seatName(s, actor)} flipped over ${CARD_LABEL[card.kind]} — lost.`, 'normal');
      }
      if (!canDefuse(s, actor)) explodePending(s, actor);
      return;
    }
    handOf(s, actor).push(card); // put back so the shared path below can take it
    uncurse(s, actor);
  } else if (!legal.some((c) => c.id === handCard.id)) {
    throw new Error('that card is not a Defuse');
  }

  // "If there are any Dead players, you must choose one of them to bring back into the game."
  const zombie = actsAsZombie(handCard);
  const dead = deadPlayerIds(s);
  let reviveId: PlayerId | null = null;
  if (zombie && dead.length > 0) {
    reviveId = a.targetPlayerId ?? (dead.length === 1 ? dead[0]! : null);
    if (!reviveId || !dead.includes(reviveId)) throw new Error('a Zombie Kitten must bring back one of the dead');
  }

  const card = takeFromHand(s, actor, handCard.id);
  // Defuse cannot be Noped, so it resolves with no reaction window.
  s.discard.push(card);

  if (reviveId) revive(s, actor, reviveId);

  if (kitten.kind === 'barkingKitten') {
    // "when the target of a Barking Kitten plays a Defuse, they do not get to put a card back."
    s.discard.push(kitten);
    s.pendingKitten = null;
    pushLog(s, actor, `${seatName(s, actor)} defused the Barking Kitten.`, 'good');
    const queued = s.kittenQueue ?? [];
    if (queued.length > 0) {
      s.pendingKitten = queued.shift()!;
      s.kittenQueue = queued;
      openClairvoyanceOrPlace(s, actor, zombie);
      return;
    }
    s.defuseEndsTurn = true;
    settle(s);
    return;
  }

  pushLog(s, actor, `${seatName(s, actor)} defused it. Now they hide it.`, 'good');
  openClairvoyanceOrPlace(s, actor, zombie);
}

/**
 * Zombie Kitten: "If they choose to bring you back to life … take their
 * Exploding Kitten and the Exploding Kitten in front of you and put both of
 * them separately back into the Draw Pile anywhere they'd like in secret."
 */
function revive(s: EkState, reviverId: PlayerId, reviveId: PlayerId) {
  s.eliminated = s.eliminated.filter((id) => id !== reviveId);
  const theirKittens = s.deadKittens[reviveId] ?? [];
  delete s.deadKittens[reviveId];
  s.kittenQueue = [...(s.kittenQueue ?? []), ...theirKittens];
  pushLog(s, reviverId, `🧟 ${seatName(s, reviverId)}'s Zombie Kitten brought ${seatName(s, reviveId)} back to life!`, 'good');
}

function openClairvoyanceOrPlace(s: EkState, placerId: PlayerId, zombieKittenPlayed: boolean) {
  if (zombieKittenPlayed) {
    const queue = seatsFrom(s, placerId).filter((id) => id !== placerId
      && (isLive(s, id) || zombieMode(s))
      && !isCursed(s, id)
      && hasKind(s, id, 'clairvoyance'));
    if (queue.length > 0) {
      s.pendingClairvoyance = { placerId, queue, watchers: [] };
      s.subPhase = 'awaitingClairvoyance';
      s.activePlayerId = queue[0]!;
      return;
    }
  }
  if (!s.pendingKitten) {
    afterKittensHidden(s, placerId);
    return;
  }
  s.subPhase = 'awaitingKittenPlace';
  s.activePlayerId = placerId;
}

function closeClairvoyance(s: EkState) {
  const pc = s.pendingClairvoyance!;
  s.pendingClairvoyance = null;
  s.kittenWatchers = pc.watchers;
  if (!s.pendingKitten) {
    afterKittensHidden(s, pc.placerId);
    return;
  }
  s.subPhase = 'awaitingKittenPlace';
  s.activePlayerId = pc.placerId;
}

function handlePlayClairvoyance(s: EkState, a: Extract<EkAction, { type: 'playClairvoyance' }>) {
  if (s.subPhase !== 'awaitingClairvoyance') throw new Error('no Zombie Kitten to watch');
  const pc = s.pendingClairvoyance;
  if (!pc || !pc.queue.includes(a.playerId)) throw new Error('you are not being asked');
  const card = takeFromHand(s, a.playerId, a.cardId);
  if (card.kind !== 'clairvoyance') {
    handOf(s, a.playerId).push(card);
    throw new Error('that card is not Clairvoyance');
  }
  s.discard.push(card);
  pc.watchers.push(a.playerId);
  pc.queue = pc.queue.filter((id) => id !== a.playerId);
  pushLog(s, a.playerId, `🔮 ${seatName(s, a.playerId)} used Clairvoyance — they will watch where the kittens go.`, 'normal');
  if (pc.queue.length === 0) {
    closeClairvoyance(s);
    return;
  }
  s.activePlayerId = pc.queue[0]!;
}

function handleDeclineClairvoyance(s: EkState, a: Extract<EkAction, { type: 'declineClairvoyance' }>) {
  if (s.subPhase !== 'awaitingClairvoyance') throw new Error('no Zombie Kitten to watch');
  const pc = s.pendingClairvoyance;
  if (!pc || pc.queue[0] !== a.playerId) throw new Error('it is not your answer');
  pc.queue.shift();
  if (pc.queue.length === 0) {
    closeClairvoyance(s);
    return;
  }
  s.activePlayerId = pc.queue[0]!;
}

function handleDeclineDefuse(s: EkState, a: Extract<EkAction, { type: 'declineDefuse' }>) {
  if (s.subPhase !== 'awaitingDefuse') throw new Error('nothing to defuse');
  if (a.playerId !== s.activePlayerId) throw new Error('not your kitten');
  if (!zombieMode(s)) throw new Error('only Zombie Kittens let you choose to die');
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} chose not to play a Zombie Kitten.`, 'normal');
  explodePending(s, a.playerId);
}

function handlePlaceKitten(s: EkState, a: Extract<EkAction, { type: 'placeKitten' }>) {
  if (s.subPhase === 'awaitingBuryPlace') {
    handlePlaceBury(s, { type: 'placeBury', playerId: a.playerId, index: a.index });
    return;
  }
  if (s.subPhase !== 'awaitingKittenPlace') throw new Error('no kitten to place');
  if (a.playerId !== s.activePlayerId) throw new Error('not your kitten');
  const kitten = s.pendingKitten;
  if (!kitten) throw new Error('no pending kitten');

  const index = Math.max(0, Math.min(a.index, s.deck.length));
  s.deck.splice(index, 0, kitten);
  s.pendingKitten = null;
  clampKnowledgeOnInsert(s, index, a.playerId, s.kittenWatchers ?? []);
  // Deliberately vague: the position is secret information.
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} slipped the kitten back into the deck.`, 'normal');

  const queued = s.kittenQueue ?? [];
  if (queued.length > 0) {
    s.pendingKitten = queued.shift()!;
    s.kittenQueue = queued;
    return; // same player hides the next one
  }
  afterKittensHidden(s, a.playerId);
}

/** All kittens from this event are back in the deck. */
function afterKittensHidden(s: EkState, placerId: PlayerId) {
  s.kittenWatchers = [];
  const more = s.moreKittensToDefuse ?? [];
  if (more.length > 0) {
    const next = more.shift()!;
    s.moreKittensToDefuse = more;
    confrontKitten(s, placerId, next, s.defuseEndsTurn !== false);
    return;
  }
  if (s.defuseEndsTurn !== false) {
    endTurn(s);
    return;
  }
  s.defuseEndsTurn = true;
  settle(s);
}

// ============================================================================
// Other prompts
// ============================================================================

function handleGiveCard(s: EkState, a: Extract<EkAction, { type: 'giveCard' }>) {
  if (s.subPhase !== 'awaitingFavorGive') throw new Error('no favour owed');
  const favor = s.pendingFavor;
  if (!favor) throw new Error('no pending favour');
  if (a.playerId !== favor.fromPlayerId) throw new Error('not your favour to pay');

  const card = takeFromHand(s, a.playerId, a.cardId);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} handed a card to ${seatName(s, favor.toPlayerId)}.`, 'normal');
  s.pendingFavor = null;
  if (transferCard(s, favor.toPlayerId, card)) return;
  settle(s);
}

function handleTakeFromDiscard(s: EkState, a: Extract<EkAction, { type: 'takeFromDiscard' }>) {
  if (s.subPhase !== 'awaitingDiscardPick') throw new Error('not picking from the discard');
  if (a.playerId !== s.activePlayerId) throw new Error('not your pick');

  const idx = s.discard.findIndex((c) => c.id === a.cardId);
  if (idx < 0) throw new Error('that card is not in the discard pile');
  const [card] = s.discard.splice(idx, 1);
  if (card) addToHand(s, a.playerId, card);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} fished ${card ? CARD_LABEL[card.kind] : 'a card'} out of the discard pile.`, 'normal');

  // Now the five played cards join the pile.
  flush(s, s.limbo);
  s.limbo = [];
  settle(s);
}

function handleAckPeek(s: EkState, a: Extract<EkAction, { type: 'ackPeek' }>) {
  if (s.subPhase !== 'awaitingFutureView') throw new Error('no peek open');
  const peek = s.peek;
  if (!peek) throw new Error('no peek');
  if (a.playerId !== peek.playerId) throw new Error('not your peek');
  // The peek becomes durable knowledge: they still know those cards next turn.
  s.knownTopCount[a.playerId] = Math.max(s.knownTopCount[a.playerId] ?? 0, peek.cards.length);
  if (peek.shareWithNext) {
    const next = nextLivePlayer(s, a.playerId);
    s.knownTopCount[next] = Math.max(s.knownTopCount[next] ?? 0, peek.cards.length);
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} showed the top ${peek.cards.length} cards to ${seatName(s, next)}.`, 'normal');
  }
  s.peek = null;
  backToAction(s);
}

function handleReorderFuture(s: EkState, a: Extract<EkAction, { type: 'reorderFuture' }>) {
  if (s.subPhase !== 'awaitingFutureView') throw new Error('no future view open');
  const peek = s.peek;
  if (!peek) throw new Error('no peek');
  if (a.playerId !== peek.playerId) throw new Error('not your peek');
  if (!peek.canReorder) throw new Error('this peek cannot be reordered');

  const count = peek.cards.length;
  if (a.orderedCardIds.length !== count || new Set(a.orderedCardIds).size !== count) {
    throw new Error('orderedCardIds must contain the exact peeked cards');
  }
  const reordered: EkCard[] = a.orderedCardIds.map((id) => {
    const found = peek.cards.find((c) => c.id === id);
    if (!found) throw new Error(`card ${id} is not in the peeked future`);
    return found;
  });

  const changed = reordered.some((c, i) => c.id !== s.deck[i]?.id);
  s.deck.splice(0, count, ...reordered);
  const shownTo = peek.shareWithNext ? nextLivePlayer(s, a.playerId) : null;
  if (changed) {
    knowledgeAfterReorder(s, count, a.playerId, shownTo);
  } else {
    s.knownTopCount[a.playerId] = Math.max(s.knownTopCount[a.playerId] ?? 0, count);
    if (shownTo) s.knownTopCount[shownTo] = Math.max(s.knownTopCount[shownTo] ?? 0, count);
  }
  s.peek = null;
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} rearranged the top ${count} cards of the deck${shownTo ? ` and showed them to ${seatName(s, shownTo)}` : ''}.`, 'normal');
  backToAction(s);
}

function handleGarbagePick(s: EkState, a: Extract<EkAction, { type: 'garbagePick' }>) {
  if (s.subPhase !== 'awaitingGarbagePick') throw new Error('not in garbage collection');
  const pg = s.pendingGarbage;
  if (!pg || pg.queue[0] !== a.playerId) throw new Error('not your garbage pick');

  const card = takeFromHand(s, a.playerId, a.cardId);
  pg.collected.push(card);
  pg.queue.shift();

  const next = pg.queue[0];
  if (next) {
    s.activePlayerId = next;
    return;
  }

  s.deck = shuffle(s.rngState, [...s.deck, ...pg.collected]);
  forgetEverything(s);
  s.pendingGarbage = null;
  pushLog(s, null, '🗑️ Garbage Collection complete — the chosen cards were shuffled into the deck.', 'normal');
  settle(s);
}

function handlePlaceBury(s: EkState, a: Extract<EkAction, { type: 'placeBury' }>) {
  if (s.subPhase !== 'awaitingBuryPlace') throw new Error('no card to bury');
  if (a.playerId !== s.activePlayerId) throw new Error('not your bury');
  const card = s.pendingBury;
  if (!card) throw new Error('no pending bury card');

  const index = Math.max(0, Math.min(a.index, s.deck.length));
  s.deck.splice(index, 0, card);
  s.pendingBury = null;
  clampKnowledgeOnInsert(s, index, a.playerId);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} buried the card in the deck and ended their turn.`, 'normal');
  endTurn(s);
}

function handlePotluckPick(s: EkState, a: Extract<EkAction, { type: 'potluckPick' }>) {
  if (s.subPhase !== 'awaitingPotluckPick') throw new Error('not in potluck');
  const pp = s.pendingPotluck;
  if (!pp || pp.queue[0] !== a.playerId) throw new Error('not your potluck pick');

  const card = takeFromHand(s, a.playerId, a.cardId);
  s.deck.unshift(card);
  clampKnowledgeOnInsert(s, 0, a.playerId);
  pp.queue.shift();

  const next = pp.queue[0];
  if (next) {
    s.activePlayerId = next;
    return;
  }

  s.pendingPotluck = null;
  pushLog(s, null, '🍲 Potluck complete — every player put a card on top of the deck.', 'normal');
  settle(s);
}

/**
 * Dig Deeper: "Draw the top card, look at it, and decide if you want to keep
 * it. If so, put it in your hand, and your turn is over. Otherwise you MUST
 * draw the next card no matter what it is. Then, put the card you decided not
 * to draw back on top of the Draw Pile."
 */
function handlePickDigDeeper(s: EkState, a: Extract<EkAction, { type: 'pickDigDeeper' }>) {
  if (s.subPhase !== 'awaitingDigDeeper') throw new Error('not digging deeper');
  const dd = s.pendingDigDeeper;
  if (!dd || dd.playerId !== a.playerId) throw new Error('not your dig deeper');
  s.pendingDigDeeper = null;

  if (a.keep) {
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} kept the top card.`, 'normal');
    resolveDrawnCard(s, a.playerId, s.deck.shift(), 'top');
    return;
  }
  // The rejected card stays on top; the one under it is drawn.
  const [second] = s.deck.splice(1, 1);
  for (const id of Object.keys(s.knownTopCount)) {
    const k = s.knownTopCount[id] ?? 0;
    s.knownTopCount[id] = k >= 2 ? k - 1 : k;
  }
  s.knownTopCount[a.playerId] = Math.max(s.knownTopCount[a.playerId] ?? 0, 1);
  pruneSightings(s);
  syncFaceUpImplodingKnowledge(s);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} put the top card back and drew the one beneath it.`, 'normal');
  resolveDrawnCard(s, a.playerId, second, 'done');
}

function handleDonateCard(s: EkState, a: Extract<EkAction, { type: 'donateCard' }>) {
  if (s.subPhase !== 'awaitingDonation') throw new Error('nobody is collecting cards');
  const pd = s.pendingDonation;
  if (!pd || pd.queue[0] !== a.playerId) throw new Error('not your turn to give');
  const card = handOf(s, a.playerId).find((c) => c.id === a.cardId);
  if (!card) throw new Error('that card is not in your hand');
  // Zombie Apocalypse rules: Feed the Dead can't hand a dead player an Exploding Kitten.
  if (pd.kind === 'feedTheDead' && card.kind === 'explodingKitten') throw new Error('you cannot feed the dead an Exploding Kitten');
  takeFromHand(s, a.playerId, card.id);
  if (pd.kind === 'feedTheDead' && pd.toPlayerId) {
    addToHand(s, pd.toPlayerId, card);
  } else {
    pd.collected.push(card);
  }
  pd.queue.shift();
  const next = pd.queue[0];
  if (next) {
    s.activePlayerId = next;
    return;
  }
  finishDonation(s);
}

// ============================================================================
// Entry point
// ============================================================================

export function applyAction(state: EkState, action: EkAction): EkState {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  const s = cloneState(state);

  switch (action.type) {
    case 'playCards': handlePlayCards(s, action); break;
    case 'playNope': handlePlayNope(s, action); break;
    case 'declineNope': handleDeclineNope(s, action); break;
    case 'chooseBlindTarget': handleChooseBlindTarget(s, action); break;
    case 'drawCard': handleDrawCard(s, action); break;
    case 'setStreakingHold': handleSetStreakingHold(s, action); break;
    case 'playDefuse': handlePlayDefuse(s, action); break;
    case 'declineDefuse': handleDeclineDefuse(s, action); break;
    case 'playClairvoyance': handlePlayClairvoyance(s, action); break;
    case 'declineClairvoyance': handleDeclineClairvoyance(s, action); break;
    case 'placeKitten': handlePlaceKitten(s, action); break;
    case 'giveCard': handleGiveCard(s, action); break;
    case 'takeFromDiscard': handleTakeFromDiscard(s, action); break;
    case 'ackPeek': handleAckPeek(s, action); break;
    case 'reorderFuture': handleReorderFuture(s, action); break;
    case 'garbagePick': handleGarbagePick(s, action); break;
    case 'placeBury': handlePlaceBury(s, action); break;
    case 'potluckPick': handlePotluckPick(s, action); break;
    case 'pickDigDeeper': handlePickDigDeeper(s, action); break;
    case 'donateCard': handleDonateCard(s, action); break;
    default: {
      const never: never = action;
      throw new Error(`unknown action ${JSON.stringify(never)}`);
    }
  }
  return s;
}

// ============================================================================
// Public derivations — shared by the UI and the AI
// ============================================================================

/**
 * How many deadly kittens are in the deck, from PUBLIC information only: setup
 * seeded a known number of Exploding Kittens, and each one that killed someone
 * lies face up in front of them (or sits on the discard pile). A face-up
 * Imploding Kitten in the deck is visible to all. Deliberately does not read
 * the deck's hidden cards.
 */
export function kittensInDeck(s: EkState): number {
  const seeded = kittenPlan(s.seats.length, s.config?.expansions ?? []).exploding;
  const faceUp = [...s.discard, ...Object.values(s.deadKittens ?? {}).flat()];
  const gone = faceUp.filter((c) => c.kind === 'explodingKitten').length;
  const faceUpImploding = s.implodingFaceUp && s.deck.some((c) => c.kind === 'implodingKitten') ? 1 : 0;
  return Math.max(0, seeded - gone + faceUpImploding);
}

/** Card ids of the kittens this player watched go into the deck (Clairvoyance), with their depth. */
export function sightedKittens(s: EkState, playerId: PlayerId): { card: EkCard; index: number }[] {
  const ids = s.sightings?.[playerId] ?? [];
  const out: { card: EkCard; index: number }[] = [];
  s.deck.forEach((card, index) => {
    if (ids.includes(card.id)) out.push({ card, index });
  });
  return out;
}

/** The top cards this player legitimately knows about, top-first. */
export function knownTopCards(s: EkState, playerId: PlayerId): EkCard[] {
  const baseCount = s.knownTopCount[playerId] ?? 0;
  const faceUpTop = s.implodingFaceUp && s.deck[0]?.kind === 'implodingKitten' ? 1 : 0;
  let n = Math.min(Math.max(baseCount, faceUpTop), s.deck.length);
  // A watched kitten right below what they know extends the run.
  const seen = s.sightings?.[playerId] ?? [];
  while (n < s.deck.length && seen.includes(s.deck[n]!.id)) n++;
  return s.deck.slice(0, n);
}

function isDeadlyOnTop(s: EkState, card: EkCard): boolean {
  return card.kind === 'explodingKitten' || (card.kind === 'implodingKitten' && !!s.implodingFaceUp);
}

/**
 * Probability the next draw is a kitten, from this player's point of view.
 * Certain (1 or 0) when they know the top card.
 */
export function drawDanger(s: EkState, playerId: PlayerId): number {
  if (s.deck.length === 0) return 0;
  const known = knownTopCards(s, playerId);
  const top = known[0];
  if (top) return isDeadlyOnTop(s, top) ? 1 : 0;
  // Kittens they watched go in elsewhere aren't on top.
  const sighted = sightedKittens(s, playerId).filter((x) => isDeadlyOnTop(s, x.card)).length;
  const unknown = Math.max(1, s.deck.length - sightedKittens(s, playerId).length);
  return Math.min(1, Math.max(0, kittensInDeck(s) - sighted) / unknown);
}

/** Legal single-card plays for a player right now. */
export function playableSingles(s: EkState, playerId: PlayerId): EkCard[] {
  return handOf(s, playerId).filter((c) => canPlaySingle(s, playerId, c)
    && (!needsTargetForKind(c.kind === 'clone' ? findCloneTargetKind(s) ?? c.kind : c.kind)
      || legalTargetsFor(s, playerId, c.kind === 'clone' ? findCloneTargetKind(s) ?? c.kind : c.kind).length > 0));
}

/** All legal combos in a hand, as arrays of card ids (including Feral Cat wilds and Clones). */
export function availableCombos(s: EkState, playerId: PlayerId): { kind: EkComboKind; cardIds: number[] }[] {
  const hand = handOf(s, playerId);
  const rules = comboRules(s);
  const out: { kind: EkComboKind; cardIds: number[] }[] = [];

  const byKind = new Map<EkBaseCardKind, EkCard[]>();
  const ferals: EkCard[] = [];
  const clones: EkCard[] = [];
  for (const c of hand) {
    if (isKittenKind(c.kind) || c.kind === 'barkingKitten') continue;
    if (c.kind === 'clone') clones.push(c);
    if (rules.catsOnly && !isCatKind(c.kind)) continue;
    if (c.kind === 'feralCat') ferals.push(c);
    const list = byKind.get(c.kind) ?? [];
    list.push(c);
    byKind.set(c.kind, list);
  }
  for (const [kind, list] of byKind) {
    if (kind === 'clone') continue;
    if (list.length >= 2) out.push({ kind: 'pair', cardIds: [list[0]!.id, list[1]!.id] });
    if (list.length >= 3) out.push({ kind: 'triple', cardIds: [list[0]!.id, list[1]!.id, list[2]!.id] });
  }
  // Feral Cat can also combine with any other cat kind to complete a pair or triple.
  if (ferals.length > 0) {
    for (const [kind, list] of byKind) {
      if (kind === 'feralCat' || !isCatKind(kind)) continue;
      if (list.length === 1) out.push({ kind: 'pair', cardIds: [list[0]!.id, ferals[0]!.id] });
      if (list.length + ferals.length >= 3 && list.length < 3) {
        out.push({ kind: 'triple', cardIds: [...list, ...ferals].slice(0, 3).map((c) => c.id) });
      }
    }
  }
  // A Clone played with any lone card makes a pair (only on your own turn).
  if (clones.length > 0 && playerId === s.turnPlayerId) {
    for (const [kind, list] of byKind) {
      if (kind === 'clone' || list.length !== 1) continue;
      out.push({ kind: 'pair', cardIds: [list[0]!.id, clones[0]!.id] });
    }
  }
  if (rules.fiveDifferent) {
    const nonFeralEntries = [...byKind.entries()].filter(([k]) => k !== 'feralCat');
    if (nonFeralEntries.length + ferals.length >= 5) {
      const picked = nonFeralEntries.slice(0, 5).map(([, l]) => l[0]!);
      for (let i = 0; i < ferals.length && picked.length < 5; i++) picked.push(ferals[i]!);
      if (picked.length === 5 && detectCombo(picked, rules) === 'fiveDifferent') {
        out.push({ kind: 'fiveDifferent', cardIds: picked.map((c) => c.id) });
      }
    }
  }
  return out;
}

/** Whether a Streaking Kitten is protecting this player's draws (for the UI's hold toggle). */
export function streakingMatters(s: EkState, playerId: PlayerId): boolean {
  return hasStreakingKittens(s.config.expansions) && !!s.hands[playerId] && canHoldWithStreaking(s, playerId);
}
