// Exploding Kittens — heuristic AI.
//
// ============================================================================
// Fair play
// ============================================================================
// The full state is replicated, so this function *could* read `state.deck` and
// play perfectly. It must not. The only legitimate windows into hidden
// information are:
//   - `drawDanger(state, me)` / `knownTopCards(state, me)` — what THIS seat
//     knows about the top of the deck, from its own See the Future, from
//     hiding a card itself, or from watching with Clairvoyance.
//   - `kittensInDeck(state)` — public: setup seeded a known number and every
//     kitten that killed someone lies face up.
//   - Cards this seat is shown by a prompt (its own peek, its Dig Deeper card,
//     its Bury card).
//   - Opponents' HAND SIZES, which are public. Never their contents.
// A Cursed seat can't see its own hand either, so it picks face-down cards by
// position. An AI that cheats isn't just unsporting, it's boring to play against.
//
// ============================================================================
// Shape
// ============================================================================
// Deterministic, single difficulty, no search. It scores the legal options and
// takes the best. One action per call — the shell's AI driver ticks it
// repeatedly, so "play See the Future, then decide whether to Skip" falls out
// naturally across two ticks without any lookahead.

import type { PlayerId } from '@/core/types';
import { CARD_VALUE, isCatKind, isDefuseKind, needsTargetForKind } from './cards';
import {
  availableCombos,
  barkingNeedsTarget,
  deadPlayerIds,
  defuseCards,
  drawDanger,
  findCloneTargetKind,
  isCursed,
  knownTopCards,
  legalTargetsFor,
  playableSingles,
} from './reducer';
import type { EkAction, EkBaseCardKind, EkCard, EkState } from './types';
import { isLive, livePlayerIds } from '@/core/state';

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

function countDefuses(s: EkState, me: PlayerId): number {
  return hand(s, me).filter((c) => isDefuseKind(c.kind)).length;
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

/** The dead player holding the fewest cards — the weakest rival to bring back or feed. */
function weakestDead(s: EkState): PlayerId | null {
  const dead = deadPlayerIds(s).sort((a, b) => (s.hands[a]?.length ?? 0) - (s.hands[b]?.length ?? 0));
  return dead[0] ?? null;
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

function isLethalTopCard(s: EkState, card: EkCard | undefined): boolean {
  if (!card) return false;
  if (card.kind === 'explodingKitten') return true;
  if (card.kind === 'implodingKitten' && s.implodingFaceUp) return true;
  return false;
}

/**
 * How badly we want to keep a card. Mostly CARD_VALUE, but a cat card that
 * completes a pair is worth more than a lone one, and a second Defuse matters
 * less than the first. Never give away a Streaking Kitten that is currently
 * protecting an Exploding Kitten in our hand!
 */
function keepValue(s: EkState, me: PlayerId, card: EkCard): number {
  if (card.kind === 'streakingKitten' && countKind(s, me, 'explodingKitten') > 0) {
    return 100;
  }
  const base = CARD_VALUE[card.kind];
  if (isCatKind(card.kind)) {
    const copies = countKind(s, me, card.kind) + (card.kind !== 'feralCat' ? countKind(s, me, 'feralCat') : 0);
    // Part of a pair we could actually fire → worth about as much as the steal.
    return copies >= 2 ? 3.5 : base;
  }
  if (isDefuseKind(card.kind)) {
    return countDefuses(s, me) > 1 ? 8 : 10;
  }
  return base;
}

/** The card we would least mind losing (never a held Exploding Kitten unless allowed). */
function worstCard(s: EkState, me: PlayerId, allowKitten = false): EkCard | null {
  const h = hand(s, me);
  if (h.length === 0) return null;
  const pool = !allowKitten && h.some((c) => c.kind !== 'explodingKitten')
    ? h.filter((c) => c.kind !== 'explodingKitten')
    : h;
  return pool.reduce((worst, c) => (keepValue(s, me, c) < keepValue(s, me, worst) ? c : worst), pool[0]!);
}

/** A Cursed seat can't look at its hand: it takes whatever face-down card comes first. */
function blindPick(s: EkState, me: PlayerId, avoid?: (c: EkCard) => boolean): EkCard | null {
  const h = hand(s, me);
  return (avoid ? h.find((c) => !avoid(c)) : undefined) ?? h[0] ?? null;
}

/** The card we would most like to gain. */
function bestCard(cards: EkCard[]): EkCard | null {
  if (cards.length === 0) return null;
  return cards.reduce((best, c) => (CARD_VALUE[c.kind] > CARD_VALUE[best.kind] ? c : best), cards[0]!);
}

// ============================================================================
// Main entry
// ============================================================================

/** With Zombie Kittens the dead still answer Nope and Clairvoyance windows and feed Grave Robbers. */
const DEAD_PROMPTS: readonly EkState['subPhase'][] = ['awaitingNope', 'awaitingClairvoyance', 'awaitingDonation'];

export function chooseAIAction(state: EkState, playerId: PlayerId): EkAction | null {
  if (state.phase === 'gameOver') return null;
  if (!isLive(state, playerId)) {
    if (!state.config.expansions.includes('zombie-kittens') || !DEAD_PROMPTS.includes(state.subPhase)) return null;
  }

  switch (state.subPhase) {
    case 'awaitingNope': return decideNope(state, playerId);
    case 'awaitingBlindTarget': return decideBlindTarget(state, playerId);
    case 'awaitingDefuse': return decideDefuse(state, playerId);
    case 'awaitingClairvoyance': return decideClairvoyance(state, playerId);
    case 'awaitingKittenPlace': return decideKittenPlacement(state, playerId);
    case 'awaitingFavorGive': return decideFavorGive(state, playerId);
    case 'awaitingDiscardPick': return decideDiscardPick(state, playerId);
    case 'awaitingFutureView': return decideFutureView(state, playerId);
    case 'awaitingGarbagePick': return decideGarbagePick(state, playerId);
    case 'awaitingBuryPlace': return decideBuryPlacement(state, playerId);
    case 'awaitingPotluckPick': return decidePotluckPick(state, playerId);
    case 'awaitingDigDeeper': return decideDigDeeper(state, playerId);
    case 'awaitingDonation': return decideDonation(state, playerId);
    case 'awaitingAction': return decideTurn(state, playerId);
    default: return null;
  }
}

// ============================================================================
// The turn decision
// ============================================================================

function decideTurn(s: EkState, me: PlayerId): EkAction {
  // Cursed: every card would be a blind gamble. Drawing safely lifts the curse.
  if (isCursed(s, me)) {
    return { type: 'drawCard', playerId: me };
  }

  const danger = drawDanger(s, me);
  const known = knownTopCards(s, me);
  const knowsTop = known.length > 0;
  const topIsKitten = isLethalTopCard(s, known[0]);
  const defuses = countDefuses(s, me);
  const combos = availableCombos(s, me);
  const singles = playableSingles(s, me);
  const cloneAs = findCloneTargetKind(s);
  /** The card to put down as `kind`: the real thing, or a Clone sitting on one. */
  const cardFor = (kind: EkBaseCardKind): EkCard | undefined =>
    singles.find((c) => c.kind === kind) ?? (cloneAs === kind ? singles.find((c) => c.kind === 'clone') : undefined);
  const has = (k: EkBaseCardKind) => cardFor(k) !== undefined;
  const opponents = opponentsByHandSize(s, me);
  const richestOpponent = opponents[0];

  const play = (kind: EkBaseCardKind, extra?: Partial<Extract<EkAction, { type: 'playCards' }>>): EkAction => {
    let target: PlayerId | undefined;
    if (needsTargetForKind(kind)) {
      const legal = legalTargetsFor(s, me, kind);
      target = kind === 'feedTheDead'
        ? weakestDead(s) ?? legal[0]
        : opponents.find((id) => legal.includes(id)) ?? legal.find((id) => id !== me) ?? legal[0];
    }
    return {
      type: 'playCards',
      playerId: me,
      cardIds: [cardFor(kind)!.id],
      ...(target ? { targetPlayerId: target } : {}),
      ...extra,
    };
  };

  // ---- Certain death on top of the deck -------------------------------------
  if (knowsTop && topIsKitten) {
    // Attack is the best answer: we dodge the draw AND the victim inherits the kitten.
    if (has('attack')) return play('attack');
    if (has('attackOfTheDead')) return play('attackOfTheDead');
    if (has('targetedAttack') && richestOpponent) return play('targetedAttack', { targetPlayerId: richestOpponent });
    if (has('superSkip') && s.turnsRemaining > 1) return play('superSkip');
    if (has('skip')) return play('skip');
    if (has('reverse')) return play('reverse');
    if (has('superSkip')) return play('superSkip');
    if (has('drawFromTheBottom') && s.deck.length > 1) return play('drawFromTheBottom');
    if (has('swapTopAndBottom') && s.deck.length > 1) return play('swapTopAndBottom');
    if (has('alterTheFuture') && s.deck.length > 1) return play('alterTheFuture');
    if (has('alterTheFuture5x') && s.deck.length > 1) return play('alterTheFuture5x');
    if (has('alterTheFutureNow') && s.deck.length > 1) return play('alterTheFutureNow');
    if (has('shareTheFuture') && s.deck.length > 1) return play('shareTheFuture');
    if (has('digDeeper') && s.deck.length > 1) return play('digDeeper');
    if (has('bury')) return play('bury');
    // Shuffling turns a certainty back into a gamble.
    if (has('shuffle')) return play('shuffle');
    if (has('shuffleNow')) return play('shuffleNow');
    if (has('catomicBomb')) return play('catomicBomb');
    // With a Defuse (or a free Streaking Kitten for an Exploding Kitten) we can eat it.
    if (known[0]?.kind === 'explodingKitten' && (defuses > 0 || defuseCards(s, me).length > 0 || canStreak(s, me))) {
      return { type: 'drawCard', playerId: me };
    }
    // Last resort: try to buy an out. A steal might find a Skip or Defuse.
    const beg = tryToAcquire(s, me, combos);
    if (beg) return beg;
    return { type: 'drawCard', playerId: me };
  }

  // ---- Known-safe top: draw greedily, it's free ------------------------------
  if (knowsTop && !topIsKitten) {
    const greedy = tryValueCombo(s, me, combos);
    if (greedy) return greedy;
    if (has('towerOfPower')) return play('towerOfPower');
    const bark = tryBarking(s, me);
    if (bark) return bark;
    return { type: 'drawCard', playerId: me };
  }

  // ---- Unknown top: manage risk ---------------------------------------------
  // Cheap information first. Knowing beats guessing, and we get to re-decide
  // on the next tick with certainty.
  if (danger >= SCARY) {
    if (has('seeTheFuture')) return play('seeTheFuture');
    if (has('seeTheFuture5x')) return play('seeTheFuture5x');
    if (has('alterTheFuture')) return play('alterTheFuture');
    if (has('alterTheFuture5x')) return play('alterTheFuture5x');
    if (has('alterTheFutureNow')) return play('alterTheFutureNow');
    if (has('shareTheFuture')) return play('shareTheFuture');
    if (has('graveRobber')) return play('graveRobber');
  }

  if (danger >= DIRE && defuses < COMFORTABLE_DEFUSES) {
    if (has('attack')) return play('attack');
    if (has('attackOfTheDead')) return play('attackOfTheDead');
    if (has('targetedAttack') && richestOpponent) return play('targetedAttack', { targetPlayerId: richestOpponent });
    if (has('superSkip')) return play('superSkip');
    if (has('skip')) return play('skip');
    if (has('reverse')) return play('reverse');
    if (has('catomicBomb')) return play('catomicBomb');
    if (has('drawFromTheBottom')) return play('drawFromTheBottom');
    if (has('digDeeper')) return play('digDeeper');
    if (has('bury')) return play('bury');
    if (has('shuffle')) return play('shuffle');
    if (has('shuffleNow')) return play('shuffleNow');
    const beg = tryToAcquire(s, me, combos);
    if (beg) return beg;
  }

  if (danger >= SCARY && defuses === 0) {
    // Not dire, but we have no safety net. Prefer stealing a Defuse over burning
    // a Skip we might need later.
    const beg = tryToAcquire(s, me, combos);
    if (beg) return beg;
    if (has('superSkip') && s.turnsRemaining > 1) return play('superSkip');
    if (has('skip')) return play('skip');
    if (has('reverse')) return play('reverse');
    if (has('attack')) return play('attack');
    if (has('attackOfTheDead')) return play('attackOfTheDead');
    if (has('targetedAttack') && richestOpponent) return play('targetedAttack', { targetPlayerId: richestOpponent });
    if (has('digDeeper')) return play('digDeeper');
    if (has('drawFromTheBottom')) return play('drawFromTheBottom');
  }

  // ---- Low risk: build advantage --------------------------------------------
  if (has('towerOfPower')) return play('towerOfPower');
  const bark = tryBarking(s, me);
  if (bark) return bark;

  const value = tryValueCombo(s, me, combos);
  if (value) return value;

  if (danger < SCARY) {
    const targetWithCards = opponents.find((id) => (s.hands[id]?.length ?? 0) > 0);
    if (has('favor') && targetWithCards) {
      return play('favor', { targetPlayerId: targetWithCards });
    }
    if (has('mark') && targetWithCards) {
      return play('mark', { targetPlayerId: targetWithCards });
    }
    if (has('curseOfTheCatButt') && targetWithCards && !isCursed(s, targetWithCards)) {
      return play('curseOfTheCatButt', { targetPlayerId: targetWithCards });
    }
    const ittTarget = opponents.find((id) => !s.illTakeThat?.[id]);
    if (has('illTakeThat') && ittTarget) {
      return play('illTakeThat', { targetPlayerId: ittTarget });
    }
    if (has('feedTheDead') && opponents.some((id) => (s.hands[id]?.length ?? 0) > 0)) {
      return play('feedTheDead');
    }
  }

  return { type: 'drawCard', playerId: me };
}

/** Holding a Streaking Kitten with room for one more Exploding Kitten. */
function canStreak(s: EkState, me: PlayerId): boolean {
  return countKind(s, me, 'streakingKitten') > countKind(s, me, 'explodingKitten');
}

/**
 * Barking Kittens. Holding both (or one already in front of us): aim them at
 * the richest opponent. Holding one: bark and hope someone has the other.
 */
function tryBarking(s: EkState, me: PlayerId): EkAction | null {
  const barks = hand(s, me).filter((c) => c.kind === 'barkingKitten');
  if (barks.length === 0) return null;
  if (barkingNeedsTarget(s, me, barks.length)) {
    const target = opponentsByHandSize(s, me)[0];
    if (!target) return null;
    return { type: 'playCards', playerId: me, cardIds: barks.map((c) => c.id), targetPlayerId: target };
  }
  return { type: 'playCards', playerId: me, cardIds: [barks[0]!.id] };
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
  // Never trade lifelines (Defuses, Nopes, Streaking Kittens) for a random grab.
  const h = hand(s, me);
  const spendable = (ids: number[]) => ids.every((id) => {
    const card = h.find((c) => c.id === id);
    return !!card && CARD_VALUE[card.kind] < CARD_VALUE.nope;
  });
  combos = combos.filter((c) => spendable(c.cardIds));

  const demand: EkBaseCardKind = s.config.expansions.includes('zombie-kittens') ? 'zombieKitten' : 'defuse';
  const triple = combos.find((c) => c.kind === 'triple');
  if (triple) {
    return { type: 'playCards', playerId: me, cardIds: triple.cardIds, targetPlayerId: target, demandKind: demand };
  }
  const pair = combos.find((c) => c.kind === 'pair');
  if (pair) {
    return { type: 'playCards', playerId: me, cardIds: pair.cardIds, targetPlayerId: target };
  }
  const five = combos.find((c) => c.kind === 'fiveDifferent');
  if (five && s.discard.some((c) => isDefuseKind(c.kind) || c.kind === 'skip' || c.kind === 'superSkip')) {
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

  const demand: EkBaseCardKind = s.config.expansions.includes('zombie-kittens') ? 'zombieKitten' : 'defuse';
  const triple = combos.find((c) => c.kind === 'triple');
  if (triple && isJunkSet(triple.cardIds)) {
    return { type: 'playCards', playerId: me, cardIds: triple.cardIds, targetPlayerId: target, demandKind: demand };
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
  const effectiveKind = card?.kind === 'clone' ? p.clonedKind : card?.kind;

  let worth = 0;

  if (targetsMe) {
    // Someone is taking a card off us or attacking us directly.
    if (p.combo === 'triple') worth = 8;        // they name the card — probably our Defuse
    else if (effectiveKind === 'targetedAttack') worth = 7;
    else if (p.combo === 'pair') worth = 5;     // random grab
    else if (effectiveKind === 'favor') worth = 5; // we pick, so it stings less
    else if (effectiveKind === 'curseOfTheCatButt') worth = 5;
  }

  // An Attack aimed at whoever follows the attacker — if that's us, we inherit
  // two turns of drawing, which is how people die.
  if ((effectiveKind === 'attack' || effectiveKind === 'attackOfTheDead') && nextVictim(s, s.turnPlayerId) === me) {
    const danger = drawDanger(s, me);
    const defuses = countDefuses(s, me);
    worth = Math.max(worth, danger >= SCARY && defuses === 0 ? 9 : 6);
  }

  if (effectiveKind === 'catomicBomb' && nextVictim(s, p.byPlayerId) === me) {
    worth = Math.max(worth, 8);
  }

  // Deny an escape: if we know the deck's top is lethal, do not let them dodge it.
  const known = knownTopCards(s, me);
  if (isLethalTopCard(s, known[0]) && p.byPlayerId === s.turnPlayerId
      && (effectiveKind === 'skip' || effectiveKind === 'superSkip' || effectiveKind === 'reverse'
          || effectiveKind === 'attack' || effectiveKind === 'targetedAttack' || effectiveKind === 'attackOfTheDead'
          || effectiveKind === 'shuffle' || effectiveKind === 'shuffleNow' || effectiveKind === 'drawFromTheBottom'
          || effectiveKind === 'swapTopAndBottom')) {
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

/** Clairvoyance only ever helps, and it is only playable here. */
function decideClairvoyance(s: EkState, me: PlayerId): EkAction {
  const card = firstOfKind(s, me, 'clairvoyance');
  if (!card || isCursed(s, me)) return { type: 'declineClairvoyance', playerId: me };
  return { type: 'playClairvoyance', playerId: me, cardId: card.id };
}

// ============================================================================
// Forced decisions
// ============================================================================

function decideBlindTarget(s: EkState, me: PlayerId): EkAction | null {
  const card = s.pendingBlindCard;
  if (!card) return null;
  const kind = card.kind === 'clone' ? findCloneTargetKind(s) ?? card.kind : card.kind;
  const legal = kind === 'barkingKitten' ? livePlayerIds(s).filter((id) => id !== me) : legalTargetsFor(s, me, kind);
  const target = kind === 'feedTheDead'
    ? weakestDead(s) ?? legal[0]
    : opponentsByHandSize(s, me).find((id) => legal.includes(id)) ?? legal[0];
  if (!target) return null;
  return { type: 'chooseBlindTarget', playerId: me, targetPlayerId: target };
}

function decideDefuse(s: EkState, me: PlayerId): EkAction | null {
  const reviveChoice = weakestDead(s);
  if (isCursed(s, me)) {
    // Blind: flip the first face-down card and hope. Name who to revive up front,
    // in case it turns out to be a Zombie Kitten.
    const pick = blindPick(s, me);
    return pick ? { type: 'playDefuse', playerId: me, cardId: pick.id, ...(reviveChoice ? { targetPlayerId: reviveChoice } : {}) } : null;
  }
  const options = defuseCards(s, me);
  // A Clone sitting on a Zombie Kitten is the cheapest answer; keep the real thing.
  const defuse = options.find((c) => c.kind === 'clone') ?? options[0];
  if (!defuse) {
    return s.config.expansions.includes('zombie-kittens') ? { type: 'declineDefuse', playerId: me } : null;
  }
  const revives = defuse.kind === 'zombieKitten' || defuse.kind === 'clone';
  const revive = revives ? reviveChoice : null;
  return { type: 'playDefuse', playerId: me, cardId: defuse.id, ...(revive ? { targetPlayerId: revive } : {}) };
}

/**
 * Where to hide the kitten. On top is devastating — but only if we aren't the
 * one drawing next. If we will draw again ourselves, bury it instead.
 */
function decideKittenPlacement(s: EkState, me: PlayerId): EkAction {
  const deckSize = s.deck.length;
  const turnContinues = s.defuseEndsTurn === false;
  const turnOwnerDrawsNext = turnContinues || s.turnsRemaining > 1;
  const nextDrawer = turnOwnerDrawsNext ? s.turnPlayerId : nextVictim(s, s.turnPlayerId);

  if (nextDrawer === me) {
    // Deep enough that we won't hit it on our remaining turns, but shallow
    // enough to still catch someone. Never the very bottom — that's often dead.
    const depth = Math.min(deckSize, Math.max(3, s.turnsRemaining + 1));
    return { type: 'placeKitten', playerId: me, index: depth };
  }
  if (nextDrawer) return { type: 'placeKitten', playerId: me, index: 0 };
  return { type: 'placeKitten', playerId: me, index: Math.min(2, deckSize) };
}

function decideFavorGive(s: EkState, me: PlayerId): EkAction | null {
  if (isCursed(s, me)) {
    const pick = blindPick(s, me);
    return pick ? { type: 'giveCard', playerId: me, cardId: pick.id } : null;
  }
  // Streaking: whoever receives an Exploding Kitten from our hand has to deal with it.
  const kitten = firstOfKind(s, me, 'explodingKitten');
  const give = kitten ?? worstCard(s, me, false);
  if (!give) return null;
  return { type: 'giveCard', playerId: me, cardId: give.id };
}

function decideDiscardPick(s: EkState, me: PlayerId): EkAction | null {
  const nonKittens = s.discard.filter((c) => c.kind !== 'explodingKitten' && c.kind !== 'implodingKitten');
  const want = bestCard(nonKittens) ?? s.discard[0];
  if (!want) return null;
  return { type: 'takeFromDiscard', playerId: me, cardId: want.id };
}

function decideFutureView(s: EkState, me: PlayerId): EkAction {
  const peek = s.peek;
  if (peek?.canReorder && peek.cards.length > 1) {
    // Out of turn, push kittens to the top for the player about to draw; on our
    // own turn, put safe/high-value cards first and push kittens down.
    const ourTurn = s.turnPlayerId === me;
    const sorted = [...peek.cards].sort((a, b) => {
      const aLethal = isLethalTopCard(s, a) ? 1 : 0;
      const bLethal = isLethalTopCard(s, b) ? 1 : 0;
      if (aLethal !== bLethal) return ourTurn ? aLethal - bLethal : bLethal - aLethal;
      return CARD_VALUE[b.kind] - CARD_VALUE[a.kind];
    });
    const changed = sorted.some((c, i) => c.id !== peek.cards[i]?.id);
    if (changed) {
      return {
        type: 'reorderFuture',
        playerId: me,
        orderedCardIds: sorted.map((c) => c.id),
      };
    }
  }
  return { type: 'ackPeek', playerId: me };
}

function decideGarbagePick(s: EkState, me: PlayerId): EkAction | null {
  if (isCursed(s, me)) {
    const pick = blindPick(s, me);
    return pick ? { type: 'garbagePick', playerId: me, cardId: pick.id } : null;
  }
  // If holding an Exploding Kitten via Streaking Kitten, dump it back into the deck!
  const heldKitten = firstOfKind(s, me, 'explodingKitten');
  if (heldKitten) {
    return { type: 'garbagePick', playerId: me, cardId: heldKitten.id };
  }
  const give = worstCard(s, me, true);
  if (!give) return null;
  return { type: 'garbagePick', playerId: me, cardId: give.id };
}

function decideBuryPlacement(s: EkState, me: PlayerId): EkAction {
  const deckSize = s.deck.length;
  const buryCard = s.pendingBury;
  const isKitten = buryCard?.kind === 'explodingKitten' || (buryCard?.kind === 'implodingKitten' && s.implodingFaceUp);
  if (isKitten) {
    const index = s.turnsRemaining > 1 ? Math.min(deckSize, s.turnsRemaining + 1) : 0;
    return { type: 'placeBury', playerId: me, index };
  }
  const index = s.turnsRemaining > 1 ? 0 : deckSize;
  return { type: 'placeBury', playerId: me, index };
}

function decidePotluckPick(s: EkState, me: PlayerId): EkAction | null {
  if (isCursed(s, me)) {
    const pick = blindPick(s, me);
    return pick ? { type: 'potluckPick', playerId: me, cardId: pick.id } : null;
  }
  const heldKitten = firstOfKind(s, me, 'explodingKitten');
  if (heldKitten && s.turnPlayerId !== me) {
    return { type: 'potluckPick', playerId: me, cardId: heldKitten.id };
  }
  const give = worstCard(s, me, false);
  if (!give) return null;
  return { type: 'potluckPick', playerId: me, cardId: give.id };
}

/** We have seen the top card. Keep it unless it would kill us. */
function decideDigDeeper(s: EkState, me: PlayerId): EkAction | null {
  const card = s.pendingDigDeeper?.card;
  if (!card) return null;
  return { type: 'pickDigDeeper', playerId: me, keep: !isLethalTopCard(s, card) };
}

function decideDonation(s: EkState, me: PlayerId): EkAction | null {
  const pd = s.pendingDonation;
  if (!pd) return null;
  const isKitten = (c: EkCard) => c.kind === 'explodingKitten';
  if (isCursed(s, me)) {
    const pick = blindPick(s, me, pd.kind === 'feedTheDead' ? isKitten : undefined);
    return pick ? { type: 'donateCard', playerId: me, cardId: pick.id } : null;
  }
  if (pd.kind === 'graveRobber') {
    const heldKitten = firstOfKind(s, me, 'explodingKitten');
    const give = heldKitten ?? worstCard(s, me, true);
    return give ? { type: 'donateCard', playerId: me, cardId: give.id } : null;
  }
  const give = worstCard(s, me, false);
  if (!give || isKitten(give)) return null;
  return { type: 'donateCard', playerId: me, cardId: give.id };
}
