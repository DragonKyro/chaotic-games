// Exploding Kittens — heuristic AI.
//
// ============================================================================
// Fair play
// ============================================================================
// The full state is replicated, so this function *could* read `state.deck` and
// play perfectly. It must not. The only legitimate windows into hidden
// information are:
//   - `drawDanger(state, me)` / `knownTopCards(state, me)` — what THIS seat
//     knows about the top of the deck, from its own See the Future or from
//     hiding a kitten itself.
//   - `kittensInDeck(state)` — public: setup seeded (players - 1) and every
//     explosion moves one to the discard pile.
//   - Opponents' HAND SIZES, which are public. Never their contents.
// Everything below is built from those three. An AI that cheats isn't just
// unsporting, it's boring to play against.
//
// ============================================================================
// Shape
// ============================================================================
// Deterministic, single difficulty, no search. It scores the legal options and
// takes the best. One action per call — the shell's AI driver ticks it
// repeatedly, so "play See the Future, then decide whether to Skip" falls out
// naturally across two ticks without any lookahead.

import type { PlayerId } from '@/core/types';
import { CARD_VALUE, isCatKind } from './cards';
import {
  availableCombos,
  drawDanger,
  isLive,
  kittensInDeck,
  knownTopCards,
  livePlayerIds,
  playableSingles,
} from './reducer';
import type { EkAction, EkBaseCardKind, EkCard, EkState } from './types';

// ============================================================================
// Tuning
// ============================================================================

/** Above this chance of drawing a kitten, start spending cards to avoid it. */
const SCARY = 0.28;
/** Above this, spend almost anything. */
const DIRE = 0.5;
/** Hold at least this many Defuses before treating a draw as routine. */
const COMFORTABLE_DEFUSES = 1;

// ============================================================================
// Small helpers
// ============================================================================

function hand(s: EkState, me: PlayerId): EkCard[] {
  return s.hands[me] ?? [];
}

function countKind(s: EkState, me: PlayerId, kind: EkBaseCardKind): number {
  return hand(s, me).filter((c) => c.kind === kind).length;
}

function firstOfKind(s: EkState, me: PlayerId, kind: EkBaseCardKind): EkCard | undefined {
  return hand(s, me).find((c) => c.kind === kind);
}

/** Opponents still in the game, richest hand first — the juiciest targets. */
function opponentsByHandSize(s: EkState, me: PlayerId): PlayerId[] {
  return livePlayerIds(s)
    .filter((id) => id !== me)
    .sort((a, b) => (s.hands[b]?.length ?? 0) - (s.hands[a]?.length ?? 0));
}

/** Who draws next if we end our turn now. The victim of an Attack, or of a kitten on top. */
function nextVictim(s: EkState, me: PlayerId): PlayerId | null {
  const live = livePlayerIds(s);
  if (live.length < 2) return null;
  const i = s.seats.findIndex((x) => x.id === me);
  const n = s.seats.length;
  for (let step = 1; step <= n; step++) {
    const seat = s.seats[((i + step * s.turnDirection) % n + n) % n];
    if (seat && isLive(s, seat.id) && seat.id !== me) return seat.id;
  }
  return null;
}

/**
 * How badly we want to keep a card. Mostly CARD_VALUE, but a cat card that
 * completes a pair is worth more than a lone one, and a second Defuse matters
 * less than the first.
 */
function keepValue(s: EkState, me: PlayerId, card: EkCard): number {
  const base = CARD_VALUE[card.kind];
  if (isCatKind(card.kind)) {
    const copies = countKind(s, me, card.kind);
    // Part of a pair we could actually fire → worth about as much as the steal.
    return copies >= 2 ? 3.5 : base;
  }
  if (card.kind === 'defuse') {
    const copies = countKind(s, me, 'defuse');
    return copies > 1 ? 8 : 10;
  }
  return base;
}

/** The card we would least mind losing. */
function worstCard(s: EkState, me: PlayerId): EkCard | null {
  const h = hand(s, me);
  if (h.length === 0) return null;
  return h.reduce((worst, c) => (keepValue(s, me, c) < keepValue(s, me, worst) ? c : worst), h[0]!);
}

/** The card we would most like to gain. */
function bestCard(cards: EkCard[]): EkCard | null {
  if (cards.length === 0) return null;
  return cards.reduce((best, c) => (CARD_VALUE[c.kind] > CARD_VALUE[best.kind] ? c : best), cards[0]!);
}

// ============================================================================
// Main entry
// ============================================================================

export function chooseAIAction(state: EkState, playerId: PlayerId): EkAction | null {
  if (state.phase === 'gameOver') return null;
  if (!isLive(state, playerId)) return null;

  switch (state.subPhase) {
    case 'awaitingNope': return decideNope(state, playerId);
    case 'awaitingDefuse': return decideDefuse(state, playerId);
    case 'awaitingKittenPlace': return decideKittenPlacement(state, playerId);
    case 'awaitingFavorGive': return decideFavorGive(state, playerId);
    case 'awaitingDiscardPick': return decideDiscardPick(state, playerId);
    case 'awaitingFutureView': return { type: 'ackPeek', playerId };
    case 'awaitingAction': return decideTurn(state, playerId);
    default: return null;
  }
}

// ============================================================================
// The turn decision
// ============================================================================

function decideTurn(s: EkState, me: PlayerId): EkAction {
  const danger = drawDanger(s, me);
  const known = knownTopCards(s, me);
  const knowsTop = known.length > 0;
  const topIsKitten = known[0]?.kind === 'explodingKitten';
  const defuses = countKind(s, me, 'defuse');
  const combos = availableCombos(s, me);
  const singles = playableSingles(s, me);
  const has = (k: EkBaseCardKind) => singles.some((c) => c.kind === k);
  const play = (kind: EkBaseCardKind, extra?: Partial<Extract<EkAction, { type: 'playCards' }>>): EkAction => ({
    type: 'playCards',
    playerId: me,
    cardIds: [firstOfKind(s, me, kind)!.id],
    ...extra,
  });

  // ---- Certain death on top of the deck -------------------------------------
  if (knowsTop && topIsKitten) {
    // Attack is the best answer: we dodge the draw AND the next player inherits
    // both the kitten and two turns.
    if (has('attack')) return play('attack');
    if (has('skip')) return play('skip');
    // Shuffling turns a certainty back into a gamble.
    if (has('shuffle')) return play('shuffle');
    // With a Defuse we can eat it and then re-hide it under someone else.
    if (defuses > 0) return { type: 'drawCard', playerId: me };
    // Last resort: try to buy an out. A steal might find a Skip or Defuse.
    const beg = tryToAcquire(s, me, combos);
    if (beg) return beg;
    return { type: 'drawCard', playerId: me };
  }

  // ---- Known-safe top: draw greedily, it's free ------------------------------
  if (knowsTop && !topIsKitten) {
    // Fire a pair first if it's cheap value — we're drawing safely either way.
    const greedy = tryValueCombo(s, me, combos);
    if (greedy) return greedy;
    return { type: 'drawCard', playerId: me };
  }

  // ---- Unknown top: manage risk ---------------------------------------------
  // Cheap information first. Knowing beats guessing, and we get to re-decide
  // on the next tick with certainty.
  if (danger >= SCARY && has('seeTheFuture')) return play('seeTheFuture');

  if (danger >= DIRE && defuses < COMFORTABLE_DEFUSES) {
    if (has('attack')) return play('attack');
    if (has('skip')) return play('skip');
    if (has('shuffle')) return play('shuffle');
    const beg = tryToAcquire(s, me, combos);
    if (beg) return beg;
  }

  if (danger >= SCARY && defuses === 0) {
    // Not dire, but we have no safety net. Prefer stealing a Defuse over burning
    // a Skip we might need later.
    const beg = tryToAcquire(s, me, combos);
    if (beg) return beg;
    if (has('skip')) return play('skip');
    if (has('attack')) return play('attack');
  }

  // ---- Low risk: build advantage --------------------------------------------
  const value = tryValueCombo(s, me, combos);
  if (value) return value;

  // Favor is a free card when the table is calm and someone has cards to spare.
  if (danger < SCARY && has('favor')) {
    const target = opponentsByHandSize(s, me).find((id) => (s.hands[id]?.length ?? 0) > 0);
    if (target) return play('favor', { targetPlayerId: target });
  }

  // Deliberately NOT attacking here. When the deck is safe, drawing gains a card
  // for free; spending an Attack to avoid a draw we want costs us a resource and
  // gains nothing material. Attack is kept for when the deck turns lethal.
  return { type: 'drawCard', playerId: me };
}

/**
 * Spend a combo trying to get out of trouble — a three-of-a-kind names a
 * Defuse outright, a pair is a random grab from the fattest hand.
 */
function tryToAcquire(
  s: EkState,
  me: PlayerId,
  combos: { kind: string; cardIds: number[] }[],
): EkAction | null {
  const targets = opponentsByHandSize(s, me).filter((id) => (s.hands[id]?.length ?? 0) > 0);
  const target = targets[0];
  if (!target) return null;

  const triple = combos.find((c) => c.kind === 'triple');
  if (triple) {
    return { type: 'playCards', playerId: me, cardIds: triple.cardIds, targetPlayerId: target, demandKind: 'defuse' };
  }
  const pair = combos.find((c) => c.kind === 'pair');
  if (pair) {
    return { type: 'playCards', playerId: me, cardIds: pair.cardIds, targetPlayerId: target };
  }
  const five = combos.find((c) => c.kind === 'fiveDifferent');
  if (five && s.discard.some((c) => c.kind === 'defuse' || c.kind === 'skip')) {
    return { type: 'playCards', playerId: me, cardIds: five.cardIds };
  }
  return null;
}

/**
 * Fire a combo purely for value when we're safe. Only worth it with spare cat
 * cards — never break up a pair of Skips just to steal at random.
 */
function tryValueCombo(
  s: EkState,
  me: PlayerId,
  combos: { kind: string; cardIds: number[] }[],
): EkAction | null {
  const h = hand(s, me);
  const isJunkSet = (ids: number[]) =>
    ids.every((id) => {
      const card = h.find((c) => c.id === id);
      return card ? isCatKind(card.kind) : false;
    });

  const five = combos.find((c) => c.kind === 'fiveDifferent');
  if (five && s.discard.some((c) => CARD_VALUE[c.kind] >= CARD_VALUE.skip) && isJunkSet(five.cardIds)) {
    return { type: 'playCards', playerId: me, cardIds: five.cardIds };
  }

  const targets = opponentsByHandSize(s, me).filter((id) => (s.hands[id]?.length ?? 0) > 0);
  const target = targets[0];
  if (!target) return null;

  const triple = combos.find((c) => c.kind === 'triple');
  if (triple && isJunkSet(triple.cardIds)) {
    return { type: 'playCards', playerId: me, cardIds: triple.cardIds, targetPlayerId: target, demandKind: 'defuse' };
  }
  const pair = combos.find((c) => c.kind === 'pair');
  if (pair && isJunkSet(pair.cardIds)) {
    return { type: 'playCards', playerId: me, cardIds: pair.cardIds, targetPlayerId: target };
  }
  return null;
}

// ============================================================================
// Reaction window
// ============================================================================

/**
 * Nopes are scarce, so only spend one when the play actually hurts. Ranked by
 * how much damage the pending play does to us specifically.
 */
function decideNope(s: EkState, me: PlayerId): EkAction {
  const p = s.pending;
  const nope = firstOfKind(s, me, 'nope');
  const decline: EkAction = { type: 'declineNope', playerId: me };
  if (!p || !nope) return decline;

  const targetsMe = p.targetPlayerId === me;
  const nopesSoFar = p.nopeCards.length;
  const wouldResolve = nopesSoFar % 2 === 0; // even = the play is currently live
  const card = p.cards[0];

  let worth = 0;

  if (targetsMe) {
    // Someone is taking a card off us.
    if (p.combo === 'triple') worth = 8;        // they name the card — probably our Defuse
    else if (p.combo === 'pair') worth = 5;     // random grab
    else if (card?.kind === 'favor') worth = 5; // we pick, so it stings less
  }

  // An Attack aimed at whoever follows the attacker — if that's us, we inherit
  // two turns of drawing, which is how people die.
  if (card?.kind === 'attack' && nextVictim(s, p.byPlayerId) === me) {
    const danger = drawDanger(s, me);
    const defuses = countKind(s, me, 'defuse');
    worth = Math.max(worth, danger >= SCARY && defuses === 0 ? 9 : 6);
  }

  // Deny an escape: if we know the deck's top is lethal, do not let them dodge it.
  const known = knownTopCards(s, me);
  if (known[0]?.kind === 'explodingKitten'
      && (card?.kind === 'skip' || card?.kind === 'attack' || card?.kind === 'shuffle')) {
    worth = Math.max(worth, 7);
  }

  // Don't burn our last Nope on something mild; keep it for a real threat.
  const nopeCount = countKind(s, me, 'nope');
  const threshold = nopeCount > 1 ? 5 : 6;

  if (wouldResolve && worth >= threshold) {
    return { type: 'playNope', playerId: me, cardId: nope.id };
  }
  // If the play is currently Noped and it was OUR play, un-Nope it if it mattered.
  if (!wouldResolve && p.byPlayerId === me && worth === 0) {
    const mine = p.cards[0];
    const selfWorth = mine ? CARD_VALUE[mine.kind] : 0;
    if (selfWorth >= CARD_VALUE.skip) {
      return { type: 'playNope', playerId: me, cardId: nope.id };
    }
  }
  return decline;
}

// ============================================================================
// Forced decisions
// ============================================================================

function decideDefuse(s: EkState, me: PlayerId): EkAction | null {
  const defuse = firstOfKind(s, me, 'defuse');
  // Unreachable — the reducer only enters this subphase when we hold one.
  if (!defuse) return null;
  return { type: 'playDefuse', playerId: me, cardId: defuse.id };
}

/**
 * Where to hide the kitten. On top is devastating — but only if we aren't the
 * one drawing next. If we still owe turns, bury it instead.
 */
function decideKittenPlacement(s: EkState, me: PlayerId): EkAction {
  const deckSize = s.deck.length;
  const weDrawNext = s.turnsRemaining > 1;

  if (weDrawNext) {
    // Deep enough that we won't hit it on our remaining turns, but shallow
    // enough to still catch someone. Never the very bottom — that's often dead.
    const depth = Math.min(deckSize, Math.max(3, s.turnsRemaining + 1));
    return { type: 'placeKitten', playerId: me, index: depth };
  }

  const victim = nextVictim(s, me);
  if (victim) return { type: 'placeKitten', playerId: me, index: 0 };
  return { type: 'placeKitten', playerId: me, index: Math.min(2, deckSize) };
}

function decideFavorGive(s: EkState, me: PlayerId): EkAction | null {
  const give = worstCard(s, me);
  // Unreachable — the reducer skips the favour when the hand is empty. Returning
  // null rather than a bogus action keeps the failure visible instead of throwing.
  if (!give) return null;
  return { type: 'giveCard', playerId: me, cardId: give.id };
}

function decideDiscardPick(s: EkState, me: PlayerId): EkAction | null {
  const want = bestCard(s.discard) ?? s.discard[0];
  if (!want) return null;
  return { type: 'takeFromDiscard', playerId: me, cardId: want.id };
}

/** Exposed for tests: how the AI rates the current draw. */
export const aiInternals = { SCARY, DIRE, kittensInDeck, keepValue };
