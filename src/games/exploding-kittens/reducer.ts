// Exploding Kittens — the reducer. Pure: same (state, action) → same next state.
// No Date.now, no Math.random, no I/O. All randomness comes from state.rngState,
// which is replicated, so every peer reduces identically.
//
// Throws on illegal actions. The UI is responsible for only offering legal ones;
// a throw means either a bug or a desynced peer.

import { shuffle, rngInt } from '@/core/rng';
import type { Seat } from '@/core/types';
import type { PlayerId } from '@/core/types';
import {
  CARD_LABEL,
  dealSetup,
  detectCombo,
  isCatKind,
  isPlayableAction,
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

const LOG_CAP = 60;
const FUTURE_COUNT = 3;

// ============================================================================
// Setup
// ============================================================================

export function createInitialState(config: EkConfig, seed: number, seats: Seat[]): EkState {
  const rngState = { seed: seed >>> 0 };
  const { deck, hands } = dealSetup(seats, rngState, config.handSize);
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
    knownTopCount: Object.fromEntries(seats.map((s) => [s.id, 0])),
    turnPlayerId: first.id,
    turnsRemaining: 1,
    turnDirection: 1,
    pending: null,
    peek: null,
    pendingFavor: null,
    pendingKitten: null,
    limbo: [],
    log: [],
    logSeq: 0,
    config,
  };

  pushLog(state, null, `${seats.length} players. ${deck.length} cards in the deck, with ${Math.max(0, seats.length - 1)} kitten${seats.length === 2 ? '' : 's'} hiding in it.`, 'normal');
  pushLog(state, first.id, `${first.name} goes first.`, 'normal');
  return state;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Deep clone so handlers can mutate freely without touching the caller's state.
 * The state is a few dozen small objects, so the cost is irrelevant and it
 * removes a whole class of accidental-shared-reference bugs.
 */
function clone(state: EkState): EkState {
  return JSON.parse(JSON.stringify(state)) as EkState;
}

function pushLog(s: EkState, byPlayerId: PlayerId | null, text: string, tone: 'normal' | 'danger' | 'good') {
  s.logSeq += 1;
  s.log.push({ seq: s.logSeq, byPlayerId, text, tone });
  if (s.log.length > LOG_CAP) s.log = s.log.slice(-LOG_CAP);
}

export function seatName(s: EkState, id: PlayerId | null): string {
  if (!id) return 'Someone';
  return s.seats.find((x) => x.id === id)?.name ?? 'Someone';
}

export function isLive(s: EkState, id: PlayerId): boolean {
  return !s.eliminated.includes(id);
}

export function livePlayerIds(s: EkState): PlayerId[] {
  return s.seats.filter((x) => isLive(s, x.id)).map((x) => x.id);
}

/** Next living seat from `from`, following turnDirection. */
function nextLivePlayer(s: EkState, from: PlayerId): PlayerId {
  const n = s.seats.length;
  const start = s.seats.findIndex((x) => x.id === from);
  if (start < 0) throw new Error(`unknown seat ${from}`);
  for (let step = 1; step <= n; step++) {
    const raw = start + step * s.turnDirection;
    const idx = ((raw % n) + n) % n;
    const seat = s.seats[idx];
    if (seat && isLive(s, seat.id)) return seat.id;
  }
  return from; // sole survivor
}

function handOf(s: EkState, id: PlayerId): EkCard[] {
  const hand = s.hands[id];
  if (!hand) throw new Error(`unknown hand ${id}`);
  return hand;
}

function takeFromHand(s: EkState, id: PlayerId, cardId: number): EkCard {
  const hand = handOf(s, id);
  const idx = hand.findIndex((c) => c.id === cardId);
  if (idx < 0) throw new Error(`card ${cardId} not in ${seatName(s, id)}'s hand`);
  const [card] = hand.splice(idx, 1);
  if (!card) throw new Error('splice returned nothing');
  return card;
}

function hasKind(s: EkState, id: PlayerId, kind: EkBaseCardKind): boolean {
  return handOf(s, id).some((c) => c.kind === kind);
}

/** Everyone's knowledge of the top of the deck shifts down by one on a draw. */
function decayKnowledgeOnDraw(s: EkState) {
  for (const id of Object.keys(s.knownTopCount)) {
    s.knownTopCount[id] = Math.max(0, (s.knownTopCount[id] ?? 0) - 1);
  }
}

/** Cards at indices below the insert point are unchanged; everything else is stale. */
function clampKnowledgeOnInsert(s: EkState, index: number, placerId: PlayerId) {
  for (const id of Object.keys(s.knownTopCount)) {
    s.knownTopCount[id] = Math.min(s.knownTopCount[id] ?? 0, index);
  }
  // The placer put it there, so if it went on top they know exactly what's on top.
  if (index === 0) s.knownTopCount[placerId] = 1;
}

// ============================================================================
// Turn flow
// ============================================================================

/** Hand control back to the turn owner with no subphase pending. */
function backToAction(s: EkState) {
  s.subPhase = 'awaitingAction';
  s.activePlayerId = s.turnPlayerId;
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
  const next = nextLivePlayer(s, s.turnPlayerId);
  s.turnPlayerId = next;
  s.turnsRemaining = 1;
  backToAction(s);
}

function eliminate(s: EkState, id: PlayerId) {
  s.eliminated.push(id);
  // An exploded player discards their whole hand along with the kitten.
  s.discard.push(...handOf(s, id));
  s.hands[id] = [];
  s.knownTopCount[id] = 0;
  pushLog(s, id, `💥 ${seatName(s, id)} exploded.`, 'danger');

  const live = livePlayerIds(s);
  if (live.length <= 1) {
    const winner = live[0];
    s.phase = 'gameOver';
    s.subPhase = 'gameOver';
    s.activePlayerId = null;
    // Score = how many players you outlasted. Winner tops the table.
    s.finalScores = Object.fromEntries(
      s.seats.map((seat) => {
        const place = s.eliminated.indexOf(seat.id);
        return [seat.id, place < 0 ? s.seats.length - 1 : place];
      }),
    );
    if (winner) pushLog(s, winner, `🏆 ${seatName(s, winner)} is the last cat standing.`, 'good');
    return;
  }

  // The dead player's owed turns die with them; the next seat starts fresh.
  const next = nextLivePlayer(s, id);
  s.turnPlayerId = next;
  s.turnsRemaining = 1;
  backToAction(s);
}

// ============================================================================
// Reaction window
// ============================================================================

/**
 * Who may still respond to the pending play. Only live players who actually
 * hold a Nope are queued — everyone else has no legal response, so prompting
 * them would be noise. `justPlayedBy` is excluded: you don't get to answer
 * your own card.
 */
function buildResponderQueue(s: EkState, justPlayedBy: PlayerId): PlayerId[] {
  return livePlayerIds(s).filter((id) => id !== justPlayedBy && hasKind(s, id, 'nope'));
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
    backToAction(s);
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

// ============================================================================
// Effects
// ============================================================================

function applySingleEffect(s: EkState, p: EkPendingPlay) {
  const card = p.cards[0];
  if (!card) throw new Error('single play with no card');
  const by = p.byPlayerId;

  switch (card.kind) {
    case 'attack': {
      // End your turn(s) now; the next player owes 2 PLUS whatever you still owed.
      const carried = Math.max(0, s.turnsRemaining - 1);
      const next = nextLivePlayer(s, s.turnPlayerId);
      s.turnPlayerId = next;
      s.turnsRemaining = carried + 2;
      pushLog(s, by, `${seatName(s, by)} attacked — ${seatName(s, next)} now owes ${s.turnsRemaining} turns.`, 'danger');
      backToAction(s);
      return;
    }
    case 'skip': {
      pushLog(s, by, `${seatName(s, by)} skipped without drawing.`, 'normal');
      endTurn(s);
      return;
    }
    case 'shuffle': {
      s.deck = shuffle(s.rngState, s.deck);
      for (const id of Object.keys(s.knownTopCount)) s.knownTopCount[id] = 0;
      pushLog(s, by, `${seatName(s, by)} shuffled the deck. Nobody knows anything now.`, 'normal');
      backToAction(s);
      return;
    }
    case 'seeTheFuture': {
      s.peek = { playerId: by, cards: s.deck.slice(0, FUTURE_COUNT) };
      s.subPhase = 'awaitingFutureView';
      s.activePlayerId = by;
      pushLog(s, by, `${seatName(s, by)} peeked at the future.`, 'normal');
      return;
    }
    case 'favor': {
      const target = p.targetPlayerId;
      if (!target) throw new Error('favor resolved with no target');
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
    default:
      throw new Error(`card ${card.kind} has no single-play effect`);
  }
}

function applyComboEffect(s: EkState, p: EkPendingPlay) {
  const by = p.byPlayerId;

  if (p.combo === 'pair') {
    const target = p.targetPlayerId;
    if (!target) throw new Error('pair resolved with no target');
    const victimHand = handOf(s, target);
    if (victimHand.length === 0) {
      pushLog(s, by, `${seatName(s, by)} went fishing in ${seatName(s, target)}'s empty hand.`, 'normal');
      backToAction(s);
      return;
    }
    const idx = rngInt(s.rngState, victimHand.length);
    const [stolen] = victimHand.splice(idx, 1);
    if (stolen) handOf(s, by).push(stolen);
    pushLog(s, by, `${seatName(s, by)} stole a card at random from ${seatName(s, target)}.`, 'normal');
    backToAction(s);
    return;
  }

  if (p.combo === 'triple') {
    const target = p.targetPlayerId;
    const want = p.demandKind;
    if (!target || !want) throw new Error('triple resolved without target + demand');
    const victimHand = handOf(s, target);
    const idx = victimHand.findIndex((c) => c.kind === want);
    if (idx < 0) {
      pushLog(s, by, `${seatName(s, by)} demanded ${CARD_LABEL[want]} from ${seatName(s, target)} — they had none.`, 'normal');
      backToAction(s);
      return;
    }
    const [taken] = victimHand.splice(idx, 1);
    if (taken) handOf(s, by).push(taken);
    pushLog(s, by, `${seatName(s, by)} took ${CARD_LABEL[want]} from ${seatName(s, target)}.`, 'normal');
    backToAction(s);
    return;
  }

  // fiveDifferent — pick anything out of the discard pile.
  if (s.discard.length === 0) {
    pushLog(s, by, `${seatName(s, by)} played five different cards, but the discard pile is empty.`, 'normal');
    flush(s, s.limbo);
    s.limbo = [];
    backToAction(s);
    return;
  }
  s.subPhase = 'awaitingDiscardPick';
  s.activePlayerId = by;
  pushLog(s, by, `${seatName(s, by)} played five different cards and is digging through the discard pile.`, 'normal');
}

// ============================================================================
// Action handlers
// ============================================================================

function handlePlayCards(s: EkState, a: Extract<EkAction, { type: 'playCards' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot play cards during ${s.subPhase}`);
  if (a.playerId !== s.activePlayerId) throw new Error('not your turn');
  if (!isLive(s, a.playerId)) throw new Error('eliminated players cannot act');
  if (a.cardIds.length === 0) throw new Error('no cards specified');

  const hand = handOf(s, a.playerId);
  const cards = a.cardIds.map((id) => {
    const card = hand.find((c) => c.id === id);
    if (!card) throw new Error(`card ${id} not in hand`);
    return card;
  });
  if (new Set(a.cardIds).size !== a.cardIds.length) throw new Error('duplicate card ids');

  const combo = cards.length === 1 ? null : detectCombo(cards, s.config.combosCatsOnly);

  if (cards.length === 1) {
    const kind = cards[0]!.kind;
    if (kind === 'nope') throw new Error('Nope can only be played in response to another card');
    if (kind === 'defuse') throw new Error('Defuse can only be played against a drawn kitten');
    if (kind === 'explodingKitten') throw new Error('you cannot play an Exploding Kitten');
    if (isCatKind(kind)) throw new Error('cat cards do nothing on their own — play a combo');
    if (!isPlayableAction(kind)) throw new Error(`${kind} cannot be played on its own`);
  } else if (!combo) {
    throw new Error('those cards do not form a legal combo');
  }

  // Target / demand validation.
  const needsTarget = combo === 'pair' || combo === 'triple'
    || (cards.length === 1 && cards[0]!.kind === 'favor');
  if (needsTarget) {
    const t = a.targetPlayerId;
    if (!t) throw new Error('this play needs a target');
    if (t === a.playerId) throw new Error('you cannot target yourself');
    if (!isLive(s, t)) throw new Error('target is out of the game');
  }
  if (combo === 'triple' && !a.demandKind) throw new Error('a three-of-a-kind must name a card');

  // Move the cards out of hand and onto the table.
  const played = a.cardIds.map((id) => takeFromHand(s, a.playerId, id));

  const label = combo ? comboLabel(combo) : CARD_LABEL[played[0]!.kind];
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} played ${label}${a.targetPlayerId ? ` on ${seatName(s, a.targetPlayerId)}` : ''}.`, 'normal');

  s.pending = {
    byPlayerId: a.playerId,
    cards: played,
    combo,
    targetPlayerId: a.targetPlayerId ?? null,
    demandKind: a.demandKind ?? null,
    nopeCards: [],
    responderQueue: [],
  };
  openOrResolve(s, a.playerId);
}

function handlePlayNope(s: EkState, a: Extract<EkAction, { type: 'playNope' }>) {
  if (s.subPhase !== 'awaitingNope') throw new Error('there is nothing to Nope');
  const p = s.pending;
  if (!p) throw new Error('no pending play');
  if (!isLive(s, a.playerId)) throw new Error('eliminated players cannot act');
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

function handleDrawCard(s: EkState, a: Extract<EkAction, { type: 'drawCard' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot draw during ${s.subPhase}`);
  if (a.playerId !== s.activePlayerId) throw new Error('not your turn');

  const drawn = s.deck.shift();
  if (!drawn) {
    // Unreachable in a legal game: kittens are always reinserted, so the deck
    // can only empty once every kitten has exploded — which ends the game.
    pushLog(s, a.playerId, 'The deck is empty. Turn passes.', 'normal');
    endTurn(s);
    return;
  }
  decayKnowledgeOnDraw(s);

  if (drawn.kind !== 'explodingKitten') {
    handOf(s, a.playerId).push(drawn);
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} drew a card and ended their turn.`, 'normal');
    endTurn(s);
    return;
  }

  // Kitten!
  s.pendingKitten = drawn;
  if (hasKind(s, a.playerId, 'defuse')) {
    s.subPhase = 'awaitingDefuse';
    s.activePlayerId = a.playerId;
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} drew an Exploding Kitten!`, 'danger');
    return;
  }
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} drew an Exploding Kitten with no Defuse.`, 'danger');
  s.discard.push(drawn);
  s.pendingKitten = null;
  eliminate(s, a.playerId);
}

function handlePlayDefuse(s: EkState, a: Extract<EkAction, { type: 'playDefuse' }>) {
  if (s.subPhase !== 'awaitingDefuse') throw new Error('nothing to defuse');
  if (a.playerId !== s.activePlayerId) throw new Error('not your kitten');
  const card = takeFromHand(s, a.playerId, a.cardId);
  if (card.kind !== 'defuse') {
    handOf(s, a.playerId).push(card);
    throw new Error('that card is not a Defuse');
  }
  // Defuse cannot be Noped, so it resolves with no reaction window.
  s.discard.push(card);
  s.subPhase = 'awaitingKittenPlace';
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} defused it. Now they hide it.`, 'good');
}

function handlePlaceKitten(s: EkState, a: Extract<EkAction, { type: 'placeKitten' }>) {
  if (s.subPhase !== 'awaitingKittenPlace') throw new Error('no kitten to place');
  if (a.playerId !== s.activePlayerId) throw new Error('not your kitten');
  const kitten = s.pendingKitten;
  if (!kitten) throw new Error('no pending kitten');

  const index = Math.max(0, Math.min(a.index, s.deck.length));
  s.deck.splice(index, 0, kitten);
  s.pendingKitten = null;
  clampKnowledgeOnInsert(s, index, a.playerId);
  // Deliberately vague: the position is secret information.
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} slipped the kitten back into the deck.`, 'normal');
  endTurn(s);
}

function handleGiveCard(s: EkState, a: Extract<EkAction, { type: 'giveCard' }>) {
  if (s.subPhase !== 'awaitingFavorGive') throw new Error('no favour owed');
  const favor = s.pendingFavor;
  if (!favor) throw new Error('no pending favour');
  if (a.playerId !== favor.fromPlayerId) throw new Error('not your favour to pay');

  const card = takeFromHand(s, a.playerId, a.cardId);
  handOf(s, favor.toPlayerId).push(card);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} handed a card to ${seatName(s, favor.toPlayerId)}.`, 'normal');
  s.pendingFavor = null;
  backToAction(s);
}

function handleTakeFromDiscard(s: EkState, a: Extract<EkAction, { type: 'takeFromDiscard' }>) {
  if (s.subPhase !== 'awaitingDiscardPick') throw new Error('not picking from the discard');
  if (a.playerId !== s.activePlayerId) throw new Error('not your pick');

  const idx = s.discard.findIndex((c) => c.id === a.cardId);
  if (idx < 0) throw new Error('that card is not in the discard pile');
  const [card] = s.discard.splice(idx, 1);
  if (card) handOf(s, a.playerId).push(card);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} fished ${card ? CARD_LABEL[card.kind] : 'a card'} out of the discard pile.`, 'normal');

  // Now the five played cards join the pile.
  flush(s, s.limbo);
  s.limbo = [];
  backToAction(s);
}

function handleAckPeek(s: EkState, a: Extract<EkAction, { type: 'ackPeek' }>) {
  if (s.subPhase !== 'awaitingFutureView') throw new Error('no peek open');
  const peek = s.peek;
  if (!peek) throw new Error('no peek');
  if (a.playerId !== peek.playerId) throw new Error('not your peek');
  // The peek becomes durable knowledge: they still know those cards next turn.
  s.knownTopCount[a.playerId] = peek.cards.length;
  s.peek = null;
  backToAction(s);
}

// ============================================================================
// Entry point
// ============================================================================

export function applyAction(state: EkState, action: EkAction): EkState {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  const s = clone(state);

  switch (action.type) {
    case 'playCards': handlePlayCards(s, action); break;
    case 'playNope': handlePlayNope(s, action); break;
    case 'declineNope': handleDeclineNope(s, action); break;
    case 'drawCard': handleDrawCard(s, action); break;
    case 'playDefuse': handlePlayDefuse(s, action); break;
    case 'placeKitten': handlePlaceKitten(s, action); break;
    case 'giveCard': handleGiveCard(s, action); break;
    case 'takeFromDiscard': handleTakeFromDiscard(s, action); break;
    case 'ackPeek': handleAckPeek(s, action); break;
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
 * How many kittens are still in the deck, from PUBLIC information only:
 * setup put (playerCount - 1) in, and each explosion moves one to the discard.
 * Deliberately does not read `state.deck`.
 */
export function kittensInDeck(s: EkState): number {
  const seeded = Math.max(0, s.seats.length - 1);
  const gone = s.discard.filter((c) => c.kind === 'explodingKitten').length;
  return Math.max(0, seeded - gone);
}

/** The top cards this player legitimately knows about, top-first. */
export function knownTopCards(s: EkState, playerId: PlayerId): EkCard[] {
  const n = Math.min(s.knownTopCount[playerId] ?? 0, s.deck.length);
  return s.deck.slice(0, n);
}

/**
 * Probability the next draw is a kitten, from this player's point of view.
 * Certain (1 or 0) when they know the top card.
 */
export function drawDanger(s: EkState, playerId: PlayerId): number {
  if (s.deck.length === 0) return 0;
  const known = knownTopCards(s, playerId);
  const top = known[0];
  if (top) return top.kind === 'explodingKitten' ? 1 : 0;
  return kittensInDeck(s) / s.deck.length;
}

/** Legal single-card plays for a player on their own turn. */
export function playableSingles(s: EkState, playerId: PlayerId): EkCard[] {
  return handOf(s, playerId).filter((c) => isPlayableAction(c.kind));
}

/** All legal combos in a hand, as arrays of card ids. */
export function availableCombos(s: EkState, playerId: PlayerId): { kind: EkComboKind; cardIds: number[] }[] {
  const hand = handOf(s, playerId);
  const catsOnly = s.config.combosCatsOnly;
  const out: { kind: EkComboKind; cardIds: number[] }[] = [];

  const byKind = new Map<EkBaseCardKind, EkCard[]>();
  for (const c of hand) {
    if (catsOnly && !isCatKind(c.kind)) continue;
    const list = byKind.get(c.kind) ?? [];
    list.push(c);
    byKind.set(c.kind, list);
  }
  for (const [, list] of byKind) {
    if (list.length >= 2) out.push({ kind: 'pair', cardIds: [list[0]!.id, list[1]!.id] });
    if (list.length >= 3) out.push({ kind: 'triple', cardIds: [list[0]!.id, list[1]!.id, list[2]!.id] });
  }
  if (byKind.size >= 5) {
    const five = [...byKind.values()].slice(0, 5).map((l) => l[0]!.id);
    out.push({ kind: 'fiveDifferent', cardIds: five });
  }
  return out;
}
