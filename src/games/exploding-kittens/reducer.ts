// Exploding Kittens — the reducer. Pure: same (state, action) → same next state.
// No Date.now, no Math.random, no I/O. All randomness comes from state.rngState,
// which is replicated, so every peer reduces identically.
//
// Throws on illegal actions. The UI is responsible for only offering legal ones;
// a throw means either a bug or a desynced peer.

import { createRng, rngInt, shuffle } from '@/core/rng';
import type { Seat } from '@/core/types';
import type { PlayerId } from '@/core/types';
import {
  CARD_LABEL,
  dealSetup,
  detectCombo,
  isCatKind,
  isDefuseKind,
  isPlayableAction,
  needsTargetForKind,
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
  const { deck, hands } = dealSetup(seats, rngState, config.handSize, config.expansions);
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
    implodingFaceUp: false,
    markedCardIds: [],
    cursedPlayers: [],
    pendingGarbage: null,
    pendingBury: null,
    pendingPotluck: null,
    pendingDigDeeper: null,
    illTakeThat: {},
    towerStash: {},
    activeBarking: [],
    clairvoyantPlayers: [],
    defuseEndsTurn: true,
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
/** Live players in current turn order starting from `from`. */
function livePlayersFrom(s: EkState, from: PlayerId): PlayerId[] {
  const n = s.seats.length;
  const start = s.seats.findIndex((x) => x.id === from);
  if (start < 0) return livePlayerIds(s);
  const out: PlayerId[] = [];
  for (let step = 0; step < n; step++) {
    const raw = start + step * s.turnDirection;
    const idx = ((raw % n) + n) % n;
    const seat = s.seats[idx];
    if (seat && isLive(s, seat.id)) out.push(seat.id);
  }
  return out;
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

function hasKind(s: EkState, id: PlayerId, kind: EkBaseCardKind): boolean {
  return handOf(s, id).some((c) => c.kind === kind);
}

function hasDefuse(s: EkState, id: PlayerId): boolean {
  return handOf(s, id).some((c) => isDefuseKind(c.kind));
}

export function canHoldWithStreaking(s: EkState, id: PlayerId): boolean {
  const h = handOf(s, id);
  const streakingCount = h.filter((c) => c.kind === 'streakingKitten').length;
  const kittenCount = h.filter((c) => c.kind === 'explodingKitten').length;
  return streakingCount > kittenCount;
}

export function findCloneTargetKind(s: EkState): EkBaseCardKind | null {
  for (let i = s.discard.length - 1; i >= 0; i--) {
    const c = s.discard[i];
    if (c && c.kind !== 'clone' && isPlayableAction(c.kind)) {
      return c.kind;
    }
  }
  return null;
}

/** If the face-up Imploding Kitten is at index 0, everyone sees it on top of the deck. */
function syncFaceUpImplodingKnowledge(s: EkState) {
  if (s.implodingFaceUp && s.deck[0]?.kind === 'implodingKitten') {
    for (const seat of s.seats) {
      if (isLive(s, seat.id)) {
        s.knownTopCount[seat.id] = Math.max(s.knownTopCount[seat.id] ?? 0, 1);
      }
    }
  }
}

/** Everyone's knowledge of the top of the deck shifts down by one on a draw. */
function decayKnowledgeOnDraw(s: EkState) {
  for (const id of Object.keys(s.knownTopCount)) {
    s.knownTopCount[id] = Math.max(0, (s.knownTopCount[id] ?? 0) - 1);
  }
  syncFaceUpImplodingKnowledge(s);
}

/** Cards at indices below the insert point are unchanged; everything else is stale. */
function clampKnowledgeOnInsert(s: EkState, index: number, placerId: PlayerId) {
  for (const id of Object.keys(s.knownTopCount)) {
    s.knownTopCount[id] = Math.min(s.knownTopCount[id] ?? 0, index);
  }
  // The placer put it there, so if it went on top they know exactly what's on top.
  if (index === 0) s.knownTopCount[placerId] = 1;
  // Clairvoyance holders/users sense where reinserted cards go.
  for (const id of livePlayerIds(s)) {
    if (s.clairvoyantPlayers?.includes(id) || hasKind(s, id, 'clairvoyance')) {
      s.knownTopCount[id] = Math.max(s.knownTopCount[id] ?? 0, index + 1);
    }
  }
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
  const hand = handOf(s, id);
  for (const c of hand) unmarkCard(s, c.id);
  // An exploded player discards their whole hand along with the kitten.
  s.discard.push(...hand);
  s.hands[id] = [];
  s.knownTopCount[id] = 0;
  if (s.cursedPlayers) s.cursedPlayers = s.cursedPlayers.filter((p) => p !== id);
  if (s.activeBarking) s.activeBarking = s.activeBarking.filter((p) => p !== id);
  if (s.illTakeThat) {
    delete s.illTakeThat[id];
    for (const [k, v] of Object.entries(s.illTakeThat)) {
      if (v === id) delete s.illTakeThat[k];
    }
  }
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

  // If the eliminated player was the current turn owner, advance to the next seat;
  // if they exploded mid-turn (e.g. Barking Kitten or stolen Streaking Kitten),
  // the current turn owner keeps their turn.
  if (id === s.turnPlayerId || !isLive(s, s.turnPlayerId)) {
    const next = nextLivePlayer(s, id);
    s.turnPlayerId = next;
    s.turnsRemaining = 1;
  }
  backToAction(s);
}

/**
 * Check if any live player is holding an Exploding Kitten without a Streaking Kitten
 * (e.g. their Streaking Kitten was stolen, given away, or discarded).
 * Returns true if an explosion or awaitingDefuse subphase was triggered.
 */
function checkExposedKittens(s: EkState): boolean {
  for (const pid of livePlayerIds(s)) {
    const h = handOf(s, pid);
    const streakingCount = h.filter((c) => c.kind === 'streakingKitten').length;
    const kittens = h.filter((c) => c.kind === 'explodingKitten');
    if (kittens.length > streakingCount) {
      const exposed = takeFromHand(s, pid, kittens[0]!.id);
      if (hasDefuse(s, pid)) {
        s.pendingKitten = exposed;
        s.subPhase = 'awaitingDefuse';
        s.activePlayerId = pid;
        s.defuseEndsTurn = false;
        pushLog(s, pid, `💥 ${seatName(s, pid)}'s Exploding Kitten was exposed! They must Defuse it!`, 'danger');
        return true;
      }
      pushLog(s, pid, `💥 ${seatName(s, pid)} lost their Streaking Kitten with no Defuse!`, 'danger');
      s.discard.push(exposed);
      eliminate(s, pid);
      return true;
    }
  }
  return false;
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
    if (!checkExposedKittens(s)) backToAction(s);
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

function takeFromTowerStash(s: EkState, target: PlayerId, preferredKind?: EkBaseCardKind | null): EkCard | null {
  const stash = s.towerStash?.[target];
  if (!stash || stash.length === 0) return null;
  if (preferredKind) {
    const matchIdx = stash.findIndex((c) => c.kind === preferredKind);
    if (matchIdx >= 0) {
      const [taken] = stash.splice(matchIdx, 1);
      return taken ?? null;
    }
  }
  const idx = rngInt(s.rngState, stash.length);
  const [taken] = stash.splice(idx, 1);
  return taken ?? null;
}

function applySingleEffect(s: EkState, p: EkPendingPlay) {
  const card = p.cards[0];
  if (!card) throw new Error('single play with no card');
  const by = p.byPlayerId;
  const effectiveKind = card.kind === 'clone' ? (p.clonedKind ?? findCloneTargetKind(s)) : card.kind;
  if (!effectiveKind) throw new Error('Clone resolved with no target card in discard');

  switch (effectiveKind) {
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
    case 'targetedAttack': {
      const target = p.targetPlayerId ?? nextLivePlayer(s, s.turnPlayerId);
      const carried = Math.max(0, s.turnsRemaining - 1);
      s.turnPlayerId = target;
      s.turnsRemaining = carried + 2;
      pushLog(s, by, `${seatName(s, by)} launched a Targeted Attack on ${seatName(s, target)} — ${seatName(s, target)} now owes ${s.turnsRemaining} turns.`, 'danger');
      backToAction(s);
      return;
    }
    case 'personalAttack': {
      const carried = Math.max(0, s.turnsRemaining - 1);
      s.turnPlayerId = by;
      s.turnsRemaining = carried + 3;
      pushLog(s, by, `${seatName(s, by)} played a Personal Attack — ${seatName(s, by)} now takes ${s.turnsRemaining} turns in a row.`, 'normal');
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
      resolveDrawnCard(s, by, drawn, false);
      return;
    }
    case 'shuffle': {
      s.deck = shuffle(s.rngState, s.deck);
      for (const id of Object.keys(s.knownTopCount)) s.knownTopCount[id] = 0;
      syncFaceUpImplodingKnowledge(s);
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
        syncFaceUpImplodingKnowledge(s);
      }
      pushLog(s, by, `${seatName(s, by)} swapped the top and bottom cards of the deck.`, 'normal');
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
    case 'seeTheFuture5x': {
      s.peek = { playerId: by, cards: s.deck.slice(0, 5) };
      s.subPhase = 'awaitingFutureView';
      s.activePlayerId = by;
      pushLog(s, by, `${seatName(s, by)} peeked 5 cards into the future.`, 'normal');
      return;
    }
    case 'alterTheFuture':
    case 'alterTheFutureNow': {
      s.peek = { playerId: by, cards: s.deck.slice(0, FUTURE_COUNT), canReorder: true };
      s.subPhase = 'awaitingFutureView';
      s.activePlayerId = by;
      pushLog(s, by, `${seatName(s, by)} is altering the top 3 cards of the future.`, 'normal');
      return;
    }
    case 'alterTheFuture5x': {
      s.peek = { playerId: by, cards: s.deck.slice(0, 5), canReorder: true };
      s.subPhase = 'awaitingFutureView';
      s.activePlayerId = by;
      pushLog(s, by, `${seatName(s, by)} is altering the top 5 cards of the future.`, 'normal');
      return;
    }
    case 'shareTheFuture': {
      s.peek = { playerId: by, cards: s.deck.slice(0, FUTURE_COUNT), canReorder: true, shareWithNext: true };
      s.subPhase = 'awaitingFutureView';
      s.activePlayerId = by;
      pushLog(s, by, `${seatName(s, by)} is rearranging and sharing the future with the next player.`, 'normal');
      return;
    }
    case 'favor': {
      const target = p.targetPlayerId;
      if (!target) throw new Error('favor resolved with no target');
      const stashCard = takeFromTowerStash(s, target);
      if (stashCard) {
        handOf(s, by).push(stashCard);
        pushLog(s, by, `${seatName(s, target)}'s Tower of Power absorbed the Favor — ${seatName(s, by)} took a stash card instead.`, 'normal');
        if (!checkExposedKittens(s)) backToAction(s);
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
      const kittens = s.deck.filter((c) => c.kind === 'explodingKitten');
      const rest = shuffle(s.rngState, s.deck.filter((c) => c.kind !== 'explodingKitten'));
      s.deck = [...kittens, ...rest];
      for (const id of Object.keys(s.knownTopCount)) {
        s.knownTopCount[id] = kittens.length;
      }
      syncFaceUpImplodingKnowledge(s);
      pushLog(s, by, `☢️ ${seatName(s, by)} dropped the Catomic Bomb! ${kittens.length} Exploding Kitten${kittens.length === 1 ? '' : 's'} moved to the top of the deck.`, 'danger');
      s.turnsRemaining = 1;
      endTurn(s);
      return;
    }
    case 'garbageCollection': {
      const queue = livePlayersFrom(s, by).filter((id) => handOf(s, id).length > 0);
      if (queue.length === 0) {
        s.deck = shuffle(s.rngState, s.deck);
        for (const id of Object.keys(s.knownTopCount)) s.knownTopCount[id] = 0;
        syncFaceUpImplodingKnowledge(s);
        backToAction(s);
        return;
      }
      s.pendingGarbage = { queue, collected: [] };
      s.subPhase = 'awaitingGarbagePick';
      s.activePlayerId = queue[0]!;
      pushLog(s, by, `${seatName(s, by)} triggered Garbage Collection — every player must discard a card into the deck.`, 'normal');
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
    case 'barkingKitten': {
      // Check if another live player holds the other Barking Kitten (in hand or activeBarking).
      const otherHolder = livePlayerIds(s).find(
        (id) => id !== by && (hasKind(s, id, 'barkingKitten') || s.activeBarking?.includes(id)),
      ) ?? (p.targetPlayerId && p.targetPlayerId !== by && isLive(s, p.targetPlayerId) && hasKind(s, by, 'barkingKitten')
        ? p.targetPlayerId
        : undefined);

      if (otherHolder) {
        const otherCard = handOf(s, otherHolder).find((c) => c.kind === 'barkingKitten');
        if (otherCard) {
          const taken = takeFromHand(s, otherHolder, otherCard.id);
          s.discard.push(taken);
        }
        if (s.activeBarking) {
          s.activeBarking = s.activeBarking.filter((id) => id !== otherHolder && id !== by);
        }
        if (hasDefuse(s, otherHolder)) {
          s.pendingKitten = card;
          s.subPhase = 'awaitingDefuse';
          s.activePlayerId = otherHolder;
          s.defuseEndsTurn = false;
          pushLog(s, by, `🐶💥 ${seatName(s, by)}'s Barking Kitten caught ${seatName(s, otherHolder)}! They must Defuse it!`, 'danger');
          return;
        }
        pushLog(s, by, `🐶💥 ${seatName(s, by)}'s Barking Kitten blew up ${seatName(s, otherHolder)}!`, 'danger');
        eliminate(s, otherHolder);
        return;
      }

      if (!s.activeBarking) s.activeBarking = [];
      if (!s.activeBarking.includes(by)) s.activeBarking.push(by);
      pushLog(s, by, `🐶 ${seatName(s, by)} played a Barking Kitten, but nobody held the other one.`, 'normal');
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
      s.pendingBury = top;
      s.subPhase = 'awaitingBuryPlace';
      s.activePlayerId = by;
      pushLog(s, by, `${seatName(s, by)} drew the top card to Bury it back into the deck.`, 'normal');
      return;
    }
    case 'illTakeThat': {
      const target = p.targetPlayerId;
      if (!target) throw new Error('illTakeThat resolved with no target');
      if (!s.illTakeThat) s.illTakeThat = {};
      s.illTakeThat[target] = by;
      pushLog(s, by, `${seatName(s, by)} placed "I'll Take That" in front of ${seatName(s, target)}.`, 'normal');
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
      const stash: EkCard[] = s.towerStash[by] ? [...s.towerStash[by]!] : [];
      // Draw up to 6 non-kitten cards from the deck into the stash (or generate safe cat cards if deck is tiny).
      for (let i = s.deck.length - 1; i >= 0 && stash.length < 6; i--) {
        const c = s.deck[i]!;
        if (c.kind !== 'explodingKitten' && c.kind !== 'implodingKitten') {
          s.deck.splice(i, 1);
          stash.push(c);
        }
      }
      while (stash.length < 6) {
        stash.push({ id: 90000 + s.logSeq * 10 + stash.length, kind: 'tacoCat' });
      }
      s.towerStash[by] = stash;
      for (const id of Object.keys(s.knownTopCount)) {
        s.knownTopCount[id] = Math.min(s.knownTopCount[id] ?? 0, s.deck.length);
      }
      pushLog(s, by, `👑 ${seatName(s, by)} donned the Tower of Power with a 6-card stash!`, 'good');
      backToAction(s);
      return;
    }
    case 'digDeeper': {
      if (s.deck.length === 0) {
        endTurn(s);
        return;
      }
      if (s.deck.length === 1) {
        const drawn = s.deck.shift();
        resolveDrawnCard(s, by, drawn, true);
        return;
      }
      const top2 = s.deck.slice(0, 2);
      s.pendingDigDeeper = { playerId: by, cards: top2 };
      s.subPhase = 'awaitingDigDeeper';
      s.activePlayerId = by;
      pushLog(s, by, `${seatName(s, by)} is Digging Deeper into the top 2 cards of the deck.`, 'normal');
      return;
    }
    case 'clairvoyance': {
      if (!s.clairvoyantPlayers) s.clairvoyantPlayers = [];
      if (!s.clairvoyantPlayers.includes(by)) s.clairvoyantPlayers.push(by);
      const kittenIdx = s.deck.findIndex((c) => c.kind === 'explodingKitten' || c.kind === 'implodingKitten');
      s.knownTopCount[by] = Math.max(
        s.knownTopCount[by] ?? 0,
        kittenIdx >= 0 ? kittenIdx + 1 : Math.min(FUTURE_COUNT, s.deck.length),
      );
      pushLog(s, by, `🔮 ${seatName(s, by)} activated Clairvoyance and senses where the kittens are hidden.`, 'good');
      backToAction(s);
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
    const stashCard = takeFromTowerStash(s, target);
    if (stashCard) {
      handOf(s, by).push(stashCard);
      pushLog(s, by, `${seatName(s, target)}'s Tower of Power protected their hand — ${seatName(s, by)} stole from the stash instead.`, 'normal');
      if (!checkExposedKittens(s)) backToAction(s);
      return;
    }
    const victimHand = handOf(s, target);
    if (victimHand.length === 0) {
      pushLog(s, by, `${seatName(s, by)} went fishing in ${seatName(s, target)}'s empty hand.`, 'normal');
      backToAction(s);
      return;
    }
    const idx = rngInt(s.rngState, victimHand.length);
    const [stolen] = victimHand.splice(idx, 1);
    if (stolen) {
      unmarkCard(s, stolen.id);
      handOf(s, by).push(stolen);
    }
    pushLog(s, by, `${seatName(s, by)} stole a card at random from ${seatName(s, target)}.`, 'normal');
    if (!checkExposedKittens(s)) backToAction(s);
    return;
  }

  if (p.combo === 'triple') {
    const target = p.targetPlayerId;
    const want = p.demandKind;
    if (!target || !want) throw new Error('triple resolved without target + demand');
    const stashCard = takeFromTowerStash(s, target, want);
    if (stashCard) {
      handOf(s, by).push(stashCard);
      pushLog(s, by, `${seatName(s, target)}'s Tower of Power intercepted the demand — ${seatName(s, by)} took a card from the stash.`, 'normal');
      if (!checkExposedKittens(s)) backToAction(s);
      return;
    }
    const victimHand = handOf(s, target);
    const idx = victimHand.findIndex((c) => c.kind === want);
    if (idx < 0) {
      pushLog(s, by, `${seatName(s, by)} demanded ${CARD_LABEL[want]} from ${seatName(s, target)} — they had none.`, 'normal');
      backToAction(s);
      return;
    }
    const [taken] = victimHand.splice(idx, 1);
    if (taken) {
      unmarkCard(s, taken.id);
      handOf(s, by).push(taken);
    }
    pushLog(s, by, `${seatName(s, by)} took ${CARD_LABEL[want]} from ${seatName(s, target)}.`, 'normal');
    if (!checkExposedKittens(s)) backToAction(s);
    return;
  }

  // fiveDifferent — pick anything out of the discard pile.
  if (s.discard.length === 0) {
    pushLog(s, by, `${seatName(s, by)} played five different cards, but the discard pile is empty.`, 'normal');
    flush(s, s.limbo);
    s.limbo = [];
    if (!checkExposedKittens(s)) backToAction(s);
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
  if (!isLive(s, a.playerId)) throw new Error('eliminated players cannot act');
  if (a.cardIds.length === 0) throw new Error('no cards specified');

  const hand = handOf(s, a.playerId);
  const cards = a.cardIds.map((id) => {
    const card = hand.find((c) => c.id === id);
    if (!card) throw new Error(`card ${id} not in hand`);
    return card;
  });
  if (new Set(a.cardIds).size !== a.cardIds.length) throw new Error('duplicate card ids');

  const isOutOfTurnNow = cards.length === 1 && cards[0]!.kind === 'alterTheFutureNow';
  if (a.playerId !== s.activePlayerId && !isOutOfTurnNow) {
    throw new Error('not your turn');
  }

  // If the player is under Curse of the Cat Butt and plays a card blindly that
  // isn't playable on its own (and not a legal combo), discard it and end the blind play.
  const isCursed = s.cursedPlayers?.includes(a.playerId) ?? false;
  const combo = cards.length === 1 ? null : detectCombo(cards, s.config.combosCatsOnly);

  let clonedKind: EkBaseCardKind | null = null;
  if (cards.length === 1) {
    const kind = cards[0]!.kind;
    if (isCursed && (isCatKind(kind) || !isPlayableAction(kind))) {
      const discarded = a.cardIds.map((id) => takeFromHand(s, a.playerId, id));
      flush(s, discarded);
      pushLog(s, a.playerId, `🙈 ${seatName(s, a.playerId)} blindly played ${CARD_LABEL[kind]}, which fizzled into the discard pile!`, 'normal');
      checkExposedKittens(s);
      return;
    }
    if (kind === 'nope') throw new Error('Nope can only be played in response to another card');
    if (kind === 'defuse' || kind === 'zombieKitten') throw new Error('Defuse can only be played against a drawn kitten');
    if (kind === 'explodingKitten' || kind === 'implodingKitten') throw new Error('you cannot play an Exploding Kitten');
    if (isCatKind(kind)) throw new Error('cat cards do nothing on their own — play a combo');
    if (!isPlayableAction(kind)) throw new Error(`${kind} cannot be played on its own`);
    if (kind === 'clone') {
      clonedKind = findCloneTargetKind(s);
      if (!clonedKind) throw new Error('no playable action card in the discard pile to Clone');
    }
  } else if (!combo) {
    throw new Error('those cards do not form a legal combo');
  }

  const effectiveSingleKind = cards.length === 1 ? (clonedKind ?? cards[0]!.kind) : null;

  // Target / demand validation.
  const needsTarget = combo === 'pair' || combo === 'triple'
    || (effectiveSingleKind !== null && needsTargetForKind(effectiveSingleKind));
  let targetPlayerId = a.targetPlayerId;
  if (needsTarget) {
    if (!targetPlayerId && isCursed) {
      targetPlayerId = nextLivePlayer(s, a.playerId);
    }
    if (!targetPlayerId) throw new Error('this play needs a target');
    if (targetPlayerId === a.playerId && effectiveSingleKind !== 'targetedAttack') {
      throw new Error('you cannot target yourself');
    }
    if (!isLive(s, targetPlayerId)) throw new Error('target is out of the game');
  }
  if (combo === 'triple' && !a.demandKind) throw new Error('a three-of-a-kind must name a card');

  // Move the cards out of hand and onto the table.
  const played = a.cardIds.map((id) => takeFromHand(s, a.playerId, id));

  const label = combo ? comboLabel(combo) : CARD_LABEL[played[0]!.kind];
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} played ${label}${targetPlayerId ? ` on ${seatName(s, targetPlayerId)}` : ''}.`, 'normal');

  s.pending = {
    byPlayerId: a.playerId,
    cards: played,
    combo,
    targetPlayerId: targetPlayerId ?? null,
    demandKind: a.demandKind ?? null,
    clonedKind,
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

function resolveDrawnCard(s: EkState, drawerId: PlayerId, drawn: EkCard | undefined, fromTop: boolean) {
  // Drawing a card clears Curse of the Cat Butt on the drawer.
  if (s.cursedPlayers?.includes(drawerId)) {
    s.cursedPlayers = s.cursedPlayers.filter((id) => id !== drawerId);
  }

  if (!drawn) {
    pushLog(s, drawerId, 'The deck is empty. Turn passes.', 'normal');
    endTurn(s);
    return;
  }

  if (fromTop) {
    decayKnowledgeOnDraw(s);
  } else {
    for (const id of Object.keys(s.knownTopCount)) {
      s.knownTopCount[id] = Math.min(s.knownTopCount[id] ?? 0, s.deck.length);
    }
    syncFaceUpImplodingKnowledge(s);
  }

  // Check if "I'll Take That" is in front of drawerId.
  let recipientId = drawerId;
  const thiefId = s.illTakeThat?.[drawerId];
  if (thiefId && isLive(s, thiefId)) {
    delete s.illTakeThat![drawerId];
    recipientId = thiefId;
    pushLog(s, thiefId, `${seatName(s, thiefId)}'s "I'll Take That" took the card drawn by ${seatName(s, drawerId)}!`, 'normal');
  }

  if (drawn.kind === 'implodingKitten') {
    if (!s.implodingFaceUp) {
      s.implodingFaceUp = true;
      s.pendingKitten = drawn;
      s.subPhase = 'awaitingKittenPlace';
      s.activePlayerId = recipientId;
      s.defuseEndsTurn = true;
      pushLog(s, recipientId, `🌀 ${seatName(s, recipientId)} drew the Imploding Kitten face-down! They must reinsert it FACE-UP.`, 'danger');
      return;
    }
    // Drawn while face-up: immediate explosion, cannot be Defused!
    pushLog(s, recipientId, `🌀💥 ${seatName(s, recipientId)} drew the face-up Imploding Kitten and imploded!`, 'danger');
    s.discard.push(drawn);
    s.pendingKitten = null;
    if (recipientId !== drawerId) {
      eliminate(s, recipientId);
      if (s.phase !== 'gameOver') endTurn(s);
    } else {
      eliminate(s, recipientId);
    }
    return;
  }

  if (drawn.kind !== 'explodingKitten') {
    handOf(s, recipientId).push(drawn);
    pushLog(s, drawerId, `${seatName(s, drawerId)} drew a card and ended their turn.`, 'normal');
    endTurn(s);
    return;
  }

  // Exploding Kitten!
  s.pendingKitten = drawn;
  s.defuseEndsTurn = true;
  if (hasDefuse(s, recipientId) || canHoldWithStreaking(s, recipientId)) {
    s.subPhase = 'awaitingDefuse';
    s.activePlayerId = recipientId;
    pushLog(s, recipientId, `${seatName(s, recipientId)} drew an Exploding Kitten!`, 'danger');
    return;
  }
  pushLog(s, recipientId, `${seatName(s, recipientId)} drew an Exploding Kitten with no Defuse.`, 'danger');
  s.discard.push(drawn);
  s.pendingKitten = null;
  if (recipientId !== drawerId) {
    eliminate(s, recipientId);
    if (s.phase !== 'gameOver') endTurn(s);
  } else {
    eliminate(s, recipientId);
  }
}

function handleDrawCard(s: EkState, a: Extract<EkAction, { type: 'drawCard' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot draw during ${s.subPhase}`);
  if (a.playerId !== s.activePlayerId) throw new Error('not your turn');

  const drawn = s.deck.shift();
  resolveDrawnCard(s, a.playerId, drawn, true);
}

function handleKeepKitten(s: EkState, a: Extract<EkAction, { type: 'keepKitten' }>) {
  if (s.subPhase !== 'awaitingDefuse') throw new Error('no kitten to keep');
  if (a.playerId !== s.activePlayerId) throw new Error('not your kitten');
  const kitten = s.pendingKitten;
  if (!kitten || kitten.kind !== 'explodingKitten') throw new Error('can only keep an Exploding Kitten');
  if (!canHoldWithStreaking(s, a.playerId)) {
    throw new Error('need a Streaking Kitten (without already holding an Exploding Kitten) to keep it');
  }

  handOf(s, a.playerId).push(kitten);
  s.pendingKitten = null;
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} secretly stashed the Exploding Kitten with their Streaking Kitten!`, 'good');
  if (s.defuseEndsTurn !== false) {
    endTurn(s);
  } else {
    s.defuseEndsTurn = true;
    backToAction(s);
  }
}

function handlePlayDefuse(s: EkState, a: Extract<EkAction, { type: 'playDefuse' }>) {
  if (s.subPhase !== 'awaitingDefuse') throw new Error('nothing to defuse');
  if (a.playerId !== s.activePlayerId) throw new Error('not your kitten');
  const card = takeFromHand(s, a.playerId, a.cardId);
  if (!isDefuseKind(card.kind)) {
    handOf(s, a.playerId).push(card);
    throw new Error('that card is not a Defuse');
  }

  if (card.kind === 'zombieKitten' && s.eliminated.length > 0) {
    const reviveId = a.targetPlayerId;
    if (!reviveId || !s.eliminated.includes(reviveId)) {
      handOf(s, a.playerId).push(card);
      throw new Error('Zombie Kitten must choose an eliminated player to resurrect');
    }
    s.eliminated = s.eliminated.filter((id) => id !== reviveId);
    // Return 1 Exploding Kitten from discard to the deck so livePlayers - 1 kittens remain in play.
    const discardKittenIdx = s.discard.findIndex((c) => c.kind === 'explodingKitten');
    if (discardKittenIdx >= 0) {
      const [revivedKitten] = s.discard.splice(discardKittenIdx, 1);
      if (revivedKitten) {
        const insertPos = rngInt(s.rngState, s.deck.length + 1);
        s.deck.splice(insertPos, 0, revivedKitten);
      }
    }
    // Deal the resurrected player up to 3 non-kitten cards from discard if available.
    const revivedHand: EkCard[] = [];
    for (let i = s.discard.length - 1; i >= 0 && revivedHand.length < 3; i--) {
      const c = s.discard[i]!;
      if (c.kind !== 'explodingKitten' && c.kind !== 'implodingKitten' && !isDefuseKind(c.kind)) {
        s.discard.splice(i, 1);
        revivedHand.push(c);
      }
    }
    s.hands[reviveId] = revivedHand;
    s.knownTopCount[reviveId] = 0;
    pushLog(s, a.playerId, `🧟 ${seatName(s, a.playerId)} played Zombie Kitten and brought ${seatName(s, reviveId)} back to life!`, 'good');
  }

  // Defuse cannot be Noped, so it resolves with no reaction window.
  s.discard.push(card);

  if (s.pendingKitten?.kind === 'barkingKitten') {
    s.discard.push(s.pendingKitten);
    s.pendingKitten = null;
    s.defuseEndsTurn = true;
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} defused the Barking Kitten.`, 'good');
    backToAction(s);
    return;
  }

  s.subPhase = 'awaitingKittenPlace';
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} defused it. Now they hide it.`, 'good');
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
  clampKnowledgeOnInsert(s, index, a.playerId);
  // Deliberately vague: the position is secret information (unless Imploding Kitten is placed on top).
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} slipped the kitten back into the deck.`, 'normal');
  if (s.defuseEndsTurn !== false) {
    endTurn(s);
  } else {
    s.defuseEndsTurn = true;
    backToAction(s);
  }
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
  if (!checkExposedKittens(s)) backToAction(s);
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
  if (!checkExposedKittens(s)) backToAction(s);
}

function handleAckPeek(s: EkState, a: Extract<EkAction, { type: 'ackPeek' }>) {
  if (s.subPhase !== 'awaitingFutureView') throw new Error('no peek open');
  const peek = s.peek;
  if (!peek) throw new Error('no peek');
  if (a.playerId !== peek.playerId) throw new Error('not your peek');
  // The peek becomes durable knowledge: they still know those cards next turn.
  s.knownTopCount[a.playerId] = peek.cards.length;
  if (peek.shareWithNext) {
    const next = nextLivePlayer(s, a.playerId);
    s.knownTopCount[next] = peek.cards.length;
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
  if (changed) {
    for (const id of Object.keys(s.knownTopCount)) {
      if (id !== a.playerId) s.knownTopCount[id] = 0;
    }
  }
  s.knownTopCount[a.playerId] = count;
  if (peek.shareWithNext) {
    const next = nextLivePlayer(s, a.playerId);
    s.knownTopCount[next] = count;
  }
  syncFaceUpImplodingKnowledge(s);
  s.peek = null;
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} rearranged the top ${count} cards of the deck.`, 'normal');
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

  s.deck.push(...pg.collected);
  s.deck = shuffle(s.rngState, s.deck);
  for (const id of Object.keys(s.knownTopCount)) s.knownTopCount[id] = 0;
  syncFaceUpImplodingKnowledge(s);
  s.pendingGarbage = null;
  pushLog(s, null, '🗑️ Garbage Collection complete — the chosen cards were shuffled into the deck.', 'normal');
  if (!checkExposedKittens(s)) backToAction(s);
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
  pushLog(s, null, '🍲 Potluck complete — every player placed a card on top of the deck.', 'normal');
  if (!checkExposedKittens(s)) backToAction(s);
}

function handlePickDigDeeper(s: EkState, a: Extract<EkAction, { type: 'pickDigDeeper' }>) {
  if (s.subPhase !== 'awaitingDigDeeper') throw new Error('not digging deeper');
  const dd = s.pendingDigDeeper;
  if (!dd || dd.playerId !== a.playerId) throw new Error('not your dig deeper');

  const chosenIdx = dd.cards.findIndex((c) => c.id === a.cardId);
  if (chosenIdx < 0) throw new Error('card is not one of the Dig Deeper options');
  const chosen = dd.cards[chosenIdx]!;
  const other = dd.cards[chosenIdx === 0 ? 1 : 0];

  s.deck.splice(0, dd.cards.length);
  decayKnowledgeOnDraw(s);
  if (other) {
    s.deck.unshift(other);
    clampKnowledgeOnInsert(s, 0, a.playerId);
  }
  s.pendingDigDeeper = null;
  resolveDrawnCard(s, a.playerId, chosen, false);
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
    case 'drawCard': handleDrawCard(s, action); break;
    case 'playDefuse': handlePlayDefuse(s, action); break;
    case 'keepKitten': handleKeepKitten(s, action); break;
    case 'placeKitten': handlePlaceKitten(s, action); break;
    case 'giveCard': handleGiveCard(s, action); break;
    case 'takeFromDiscard': handleTakeFromDiscard(s, action); break;
    case 'ackPeek': handleAckPeek(s, action); break;
    case 'reorderFuture': handleReorderFuture(s, action); break;
    case 'garbagePick': handleGarbagePick(s, action); break;
    case 'placeBury': handlePlaceBury(s, action); break;
    case 'potluckPick': handlePotluckPick(s, action); break;
    case 'pickDigDeeper': handlePickDigDeeper(s, action); break;
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
 * setup put (playerCount - 1) in (+1 with Streaking Kittens), and each
 * explosion moves one to the discard. Deliberately does not read `state.deck`.
 */
export function kittensInDeck(s: EkState): number {
  const exps = s.config?.expansions ?? [];
  const extra = exps.includes('streaking-kittens') || exps.includes('recipes-for-disaster') ? 1 : 0;
  const seeded = Math.max(0, s.seats.length - 1 + extra);
  const gone = s.discard.filter((c) => c.kind === 'explodingKitten').length;
  const faceUpImploding = s.implodingFaceUp && !s.discard.some((c) => c.kind === 'implodingKitten') ? 1 : 0;
  return Math.max(0, seeded - gone + faceUpImploding);
}

/** The top cards this player legitimately knows about, top-first. */
export function knownTopCards(s: EkState, playerId: PlayerId): EkCard[] {
  const baseCount = s.knownTopCount[playerId] ?? 0;
  const faceUpTop = s.implodingFaceUp && s.deck[0]?.kind === 'implodingKitten' ? 1 : 0;
  const n = Math.min(Math.max(baseCount, faceUpTop), s.deck.length);
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
  if (top) {
    if (top.kind === 'explodingKitten') return 1;
    if (top.kind === 'implodingKitten') return s.implodingFaceUp ? 1 : 0;
    return 0;
  }
  return Math.min(1, kittensInDeck(s) / s.deck.length);
}

/** Legal single-card plays for a player on their own turn. */
export function playableSingles(s: EkState, playerId: PlayerId): EkCard[] {
  return handOf(s, playerId).filter((c) => {
    if (c.kind === 'clone') return findCloneTargetKind(s) !== null;
    return isPlayableAction(c.kind);
  });
}

/** All legal combos in a hand, as arrays of card ids (including Feral Cat wilds). */
export function availableCombos(s: EkState, playerId: PlayerId): { kind: EkComboKind; cardIds: number[] }[] {
  const hand = handOf(s, playerId);
  const catsOnly = s.config.combosCatsOnly;
  const out: { kind: EkComboKind; cardIds: number[] }[] = [];

  const byKind = new Map<EkBaseCardKind, EkCard[]>();
  const ferals: EkCard[] = [];
  for (const c of hand) {
    if (c.kind === 'explodingKitten' || c.kind === 'implodingKitten') continue;
    if (catsOnly && !isCatKind(c.kind)) continue;
    if (c.kind === 'feralCat') ferals.push(c);
    const list = byKind.get(c.kind) ?? [];
    list.push(c);
    byKind.set(c.kind, list);
  }
  for (const [, list] of byKind) {
    if (list.length >= 2) out.push({ kind: 'pair', cardIds: [list[0]!.id, list[1]!.id] });
    if (list.length >= 3) out.push({ kind: 'triple', cardIds: [list[0]!.id, list[1]!.id, list[2]!.id] });
  }
  // Feral Cat can also combine with any other cat kind to complete a pair or triple.
  if (ferals.length > 0) {
    for (const [kind, list] of byKind) {
      if (kind === 'feralCat' || !isCatKind(kind)) continue;
      if (list.length === 1 && ferals.length >= 1) {
        out.push({ kind: 'pair', cardIds: [list[0]!.id, ferals[0]!.id] });
      }
      if (list.length + ferals.length >= 3 && list.length < 3) {
        const combined = [...list, ...ferals].slice(0, 3).map((c) => c.id);
        out.push({ kind: 'triple', cardIds: combined });
      }
    }
  }
  const nonFeralEntries = [...byKind.entries()].filter(([k]) => k !== 'feralCat');
  if (nonFeralEntries.length + ferals.length >= 5) {
    const picked = nonFeralEntries.slice(0, 5).map(([, l]) => l[0]!);
    for (let i = 0; i < ferals.length && picked.length < 5; i++) {
      picked.push(ferals[i]!);
    }
    if (picked.length === 5 && detectCombo(picked, catsOnly) === 'fiveDifferent') {
      out.push({ kind: 'fiveDifferent', cardIds: picked.map((c) => c.id) });
    }
  }
  return out;
}
