// Unstable Unicorns — pure deterministic reducer for the 2nd Edition Base Game.

import { rngInt, shuffle } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import { dealUuSetup, isFlyerKind, isNarwhalCard, isNeighCard } from './cards';
import { isUnicornType } from './types';
import type {
  UuAction,
  UuCard,
  UuConfig,
  UuPrompt,
  UuStable,
  UuState,
} from './types';

const LOG_CAP = 60;
const HAND_LIMIT = 7;

// ============================================================================
// Setup
// ============================================================================

export function createInitialState(config: UuConfig, seed: number, seats: Seat[]): UuState {
  const rngState = { seed: seed >>> 0 };
  const first = seats[0];
  if (!first) throw new Error('Unstable Unicorns needs at least one seat');

  const { deck, nursery, hands, startingBabies } = dealUuSetup(seats, rngState);
  const stables: Record<PlayerId, UuStable> = {};
  for (const s of seats) {
    const baby = startingBabies[s.id];
    stables[s.id] = {
      unicorns: baby ? [baby] : [],
      upgrades: [],
      downgrades: [],
    };
  }

  const unicornsToWin = seats.length >= 6 ? 6 : 7;

  const state: UuState = {
    phase: 'playing',
    seats,
    activePlayerId: first.id,
    finalScores: null,
    rngState,

    subPhase: 'beginningOfTurn',
    resumePhase: 'draw',
    deck,
    discard: [],
    nursery,
    hands,
    stables,

    turnPlayerId: first.id,
    playsRemaining: 1,
    actedInActionPhase: false,
    extraTurnPending: false,
    skipToEndOfTurn: false,

    pending: null,
    promptQueue: [],
    unicornsToWin,
    winnerId: null,

    log: [],
    logSeq: 0,
    config,
  };

  pushLog(state, null, `${seats.length} players. First to ${unicornsToWin} Unicorns in their Stable wins!`, 'normal');
  startTurn(state, first.id);
  return state;
}

// ============================================================================
// Basic helpers & continuous modifiers (computed on read, never cached)
// ============================================================================

function clone(state: UuState): UuState {
  return JSON.parse(JSON.stringify(state)) as UuState;
}

function pushLog(s: UuState, byPlayerId: PlayerId | null, text: string, tone: 'normal' | 'danger' | 'good') {
  s.logSeq += 1;
  s.log.push({ seq: s.logSeq, byPlayerId, text, tone });
  if (s.log.length > LOG_CAP) s.log = s.log.slice(-LOG_CAP);
}

export function seatName(s: UuState, id: PlayerId | null): string {
  if (!id) return 'Someone';
  return s.seats.find((x) => x.id === id)?.name ?? 'Someone';
}

export function stableOf(s: UuState, id: PlayerId): UuStable {
  const st = s.stables[id];
  if (!st) throw new Error(`unknown stable ${id}`);
  return st;
}

export function handOf(s: UuState, id: PlayerId): UuCard[] {
  const h = s.hands[id];
  if (!h) throw new Error(`unknown hand ${id}`);
  return h;
}

export function isBlinded(s: UuState, playerId: PlayerId): boolean {
  return stableOf(s, playerId).downgrades.some((c) => c.kind === 'blinding-light');
}

export function hasPandamonium(s: UuState, playerId: PlayerId): boolean {
  return stableOf(s, playerId).downgrades.some((c) => c.kind === 'pandamonium');
}

export function hasRainbowAura(s: UuState, playerId: PlayerId): boolean {
  return stableOf(s, playerId).upgrades.some((c) => c.kind === 'rainbow-aura');
}

export function hasBrokenStable(s: UuState, playerId: PlayerId): boolean {
  return stableOf(s, playerId).downgrades.some((c) => c.kind === 'broken-stable');
}

export function hasSlowdown(s: UuState, playerId: PlayerId): boolean {
  return stableOf(s, playerId).downgrades.some((c) => c.kind === 'slowdown');
}

export function hasYay(s: UuState, playerId: PlayerId): boolean {
  return stableOf(s, playerId).upgrades.some((c) => c.kind === 'yay');
}

export function hasNannyCam(s: UuState, playerId: PlayerId): boolean {
  return stableOf(s, playerId).downgrades.some((c) => c.kind === 'nanny-cam');
}

export function hasBarbedWire(s: UuState, playerId: PlayerId): boolean {
  return stableOf(s, playerId).downgrades.some((c) => c.kind === 'barbed-wire');
}

export function hasTinyStable(s: UuState, playerId: PlayerId): boolean {
  return stableOf(s, playerId).downgrades.some((c) => c.kind === 'tiny-stable');
}

export function queenBeeOwner(s: UuState): PlayerId | null {
  for (const seat of s.seats) {
    if (!isBlinded(s, seat.id) && stableOf(s, seat.id).unicorns.some((c) => c.kind === 'queen-bee-unicorn')) {
      return seat.id;
    }
  }
  return null;
}

/** How many Unicorns this player currently has toward the win condition. */
export function unicornCount(s: UuState, playerId: PlayerId): number {
  if (hasPandamonium(s, playerId)) return 0;
  const blinded = isBlinded(s, playerId);
  let total = 0;
  for (const u of stableOf(s, playerId).unicorns) {
    if (!blinded && u.kind === 'ginormous-unicorn') {
      total += 2;
    } else {
      total += 1;
    }
  }
  return total;
}

export function canPlayNeigh(s: UuState, playerId: PlayerId): boolean {
  if (hasSlowdown(s, playerId)) return false;
  if (!isBlinded(s, playerId) && stableOf(s, playerId).unicorns.some((c) => c.kind === 'ginormous-unicorn')) {
    return false;
  }
  return handOf(s, playerId).some((c) => isNeighCard(c));
}

export function allCardsInStable(st: UuStable): UuCard[] {
  return [...st.unicorns, ...st.upgrades, ...st.downgrades];
}

export function findCardInStable(s: UuState, playerId: PlayerId, cardId: number): UuCard | null {
  const st = stableOf(s, playerId);
  return allCardsInStable(st).find((c) => c.id === cardId) ?? null;
}

export function findStableOwnerOfCard(s: UuState, cardId: number): { ownerId: PlayerId; card: UuCard } | null {
  for (const seat of s.seats) {
    const found = findCardInStable(s, seat.id, cardId);
    if (found) return { ownerId: seat.id, card: found };
  }
  return null;
}

/**
 * Valid cards matching a `chooseStableCard` prompt. Shared by the reducer, UI, and AI.
 */
export function validStableTargets(s: UuState, prompt: Extract<UuPrompt, { kind: 'chooseStableCard' }>): { ownerId: PlayerId; card: UuCard }[] {
  const results: { ownerId: PlayerId; card: UuCard }[] = [];
  for (const seat of s.seats) {
    const ownerId = seat.id;
    if (prompt.scope === 'own' && ownerId !== prompt.playerId) continue;
    if (prompt.scope === 'others' && ownerId === prompt.playerId) continue;
    if (prompt.scope === 'specificPlayer' && ownerId !== prompt.specificPlayerId) continue;

    const st = stableOf(s, ownerId);
    const cards = allCardsInStable(st);
    for (const card of cards) {
      if (prompt.filter === 'unicorn') {
        if (!isUnicornType(card.type)) continue;
        if (hasPandamonium(s, ownerId)) continue;
      } else if (prompt.filter === 'upgrade') {
        if (card.type !== 'upgrade') continue;
      } else if (prompt.filter === 'downgrade') {
        if (card.type !== 'downgrade') continue;
      } else if (prompt.filter === 'upgradeOrDowngrade') {
        if (card.type !== 'upgrade' && card.type !== 'downgrade') continue;
      } else if (prompt.filter === 'destroyUpgradeOrSacrificeDowngrade') {
        const isDestroyOtherUpgrade = ownerId !== prompt.playerId && card.type === 'upgrade';
        const isSacrificeOwnDowngrade = ownerId === prompt.playerId && card.type === 'downgrade';
        if (!isDestroyOtherUpgrade && !isSacrificeOwnDowngrade) continue;
      } else if (prompt.filter === 'any') {
        if (isUnicornType(card.type) && hasPandamonium(s, ownerId)) continue;
      }

      // Destroy protection checks
      const isDestroy =
        prompt.mode === 'destroy' ||
        (prompt.filter === 'destroyUpgradeOrSacrificeDowngrade' && ownerId !== prompt.playerId);
      if (isDestroy && isUnicornType(card.type)) {
        if (hasRainbowAura(s, ownerId)) continue;
        if (prompt.sourceType === 'magic' && card.kind === 'magical-kittencorn' && !isBlinded(s, ownerId)) {
          continue;
        }
      }

      results.push({ ownerId, card });
    }
  }
  return results;
}

/**
 * Valid cards in a pile (`discard`, `deck`, or `nursery`) for a `chooseFromPile` prompt.
 */
export function validPileCards(s: UuState, prompt: Extract<UuPrompt, { kind: 'chooseFromPile' }>): UuCard[] {
  const pile = prompt.pile === 'discard' ? s.discard : prompt.pile === 'deck' ? s.deck : s.nursery;
  return pile.filter((c) => {
    if (prompt.filter === 'unicorn') return isUnicornType(c.type);
    if (prompt.filter === 'magic') return c.type === 'magic';
    if (prompt.filter === 'upgrade') return c.type === 'upgrade';
    if (prompt.filter === 'downgrade') return c.type === 'downgrade';
    if (prompt.filter === 'neigh') return isNeighCard(c);
    if (prompt.filter === 'narwhal') return isNarwhalCard(c);
    if (prompt.filter === 'baby') return c.type === 'babyUnicorn';
    return true;
  });
}

/**
 * Valid cards in `playerId`'s hand for a `chooseCardsFromHand` prompt.
 */
export function validHandCards(s: UuState, prompt: Extract<UuPrompt, { kind: 'chooseCardsFromHand' }>): UuCard[] {
  const hand = handOf(s, prompt.playerId);
  return hand.filter((c) => {
    if (prompt.filter === 'unicorn') return isUnicornType(c.type);
    if (prompt.filter === 'basicUnicorn') return c.type === 'basicUnicorn';
    return true;
  });
}

/**
 * Check whether a card in `playerId`'s hand can legally be played during the Action phase.
 */
export function canPlayCardFromHand(s: UuState, playerId: PlayerId, card: UuCard, targetPlayerId?: PlayerId): boolean {
  if (card.type === 'instant') return false;
  if (card.type === 'upgrade' && hasBrokenStable(s, playerId)) return false;

  if (card.type === 'basicUnicorn') {
    const qb = queenBeeOwner(s);
    const dest = targetPlayerId ?? playerId;
    if (qb && qb !== dest) return false;
  }

  // Magic cards with play requirements per official rules:
  if (card.kind === 'back-kick') {
    return s.seats.some((seat) => seat.id !== playerId && allCardsInStable(stableOf(s, seat.id)).length > 0);
  }
  if (card.kind === 'change-of-luck') {
    // Must have at least 1 other card in hand so after drawing 2 you have 3 cards to discard
    return handOf(s, playerId).length - 1 + Math.min(2, s.deck.length) >= 3;
  }
  if (card.kind === 'glitter-tornado') {
    return allCardsInStable(stableOf(s, playerId)).length > 0;
  }
  if (card.kind === 'kiss-of-life') {
    return s.discard.some((c) => isUnicornType(c.type));
  }
  if (card.kind === 're-target') {
    return s.seats.some((seat) => {
      const st = stableOf(s, seat.id);
      return st.upgrades.length > 0 || st.downgrades.length > 0;
    });
  }
  if (card.kind === 'reset-button') {
    return s.seats.some((seat) => {
      const st = stableOf(s, seat.id);
      return st.upgrades.length > 0 || st.downgrades.length > 0;
    });
  }
  if (card.kind === 'targeted-destruction') {
    const hasOtherUpgrade = s.seats.some((seat) => seat.id !== playerId && stableOf(s, seat.id).upgrades.length > 0);
    const hasOwnDowngrade = stableOf(s, playerId).downgrades.length > 0;
    return hasOtherUpgrade || hasOwnDowngrade;
  }
  if (card.kind === 'two-for-one') {
    return allCardsInStable(stableOf(s, playerId)).length > 0;
  }
  if (card.kind === 'unicorn-poison') {
    return s.seats.some((seat) => {
      if (seat.id === playerId) return false;
      if (hasPandamonium(s, seat.id) || hasRainbowAura(s, seat.id)) return false;
      return stableOf(s, seat.id).unicorns.some(
        (u) => !(u.kind === 'magical-kittencorn' && !isBlinded(s, seat.id)),
      );
    });
  }
  if (card.kind === 'unicorn-swap') {
    if (hasPandamonium(s, playerId) || stableOf(s, playerId).unicorns.length === 0) return false;
    return s.seats.some((seat) => seat.id !== playerId);
  }

  return true;
}

// ============================================================================
// Deck & Win Conditions
// ============================================================================

function drawCards(s: UuState, playerId: PlayerId, count: number): UuCard[] {
  const drawn: UuCard[] = [];
  for (let i = 0; i < count; i++) {
    const c = s.deck.shift();
    if (!c) {
      endGameByDeckExhaustion(s);
      return drawn;
    }
    handOf(s, playerId).push(c);
    drawn.push(c);
  }
  return drawn;
}

function endGameByDeckExhaustion(s: UuState) {
  s.phase = 'gameOver';
  s.subPhase = 'gameOver';
  s.activePlayerId = null;
  s.pending = null;
  s.promptQueue = [];

  // Tiebreaker per rulebook: most Unicorns, then total letters in Unicorn card names.
  let bestPlayer: PlayerId | null = null;
  let bestScore = -1;
  const scores: Record<PlayerId, number> = {};

  for (const seat of s.seats) {
    const count = unicornCount(s, seat.id);
    const letters = hasPandamonium(s, seat.id)
      ? 0
      : stableOf(s, seat.id).unicorns.reduce((sum, u) => sum + u.name.replace(/[^a-zA-Z]/g, '').length, 0);
    const combined = count * 1000 + letters;
    scores[seat.id] = count;
    if (combined > bestScore) {
      bestScore = combined;
      bestPlayer = seat.id;
    }
  }
  s.finalScores = scores;
  s.winnerId = bestPlayer;
  pushLog(s, bestPlayer, `The deck ran out! ${seatName(s, bestPlayer)} wins on Unicorn count / name length!`, 'good');
}

function checkWinCondition(s: UuState): boolean {
  if (s.phase === 'gameOver') return true;
  if (s.pending || s.promptQueue.length > 0) return false;

  for (const seat of s.seats) {
    const count = unicornCount(s, seat.id);
    if (count >= s.unicornsToWin) {
      s.phase = 'gameOver';
      s.subPhase = 'gameOver';
      s.activePlayerId = null;
      s.winnerId = seat.id;
      s.finalScores = Object.fromEntries(s.seats.map((st) => [st.id, unicornCount(s, st.id)]));
      pushLog(s, seat.id, `🦄 ${seat.name} built a Stable of ${count} Unicorns and wins!`, 'good');
      return true;
    }
  }
  return false;
}

// ============================================================================
// Turn & Prompt Queue Advancement
// ============================================================================

function startTurn(s: UuState, playerId: PlayerId) {
  s.turnPlayerId = playerId;
  s.playsRemaining = stableOf(s, playerId).upgrades.some((c) => c.kind === 'double-dutch') ? 2 : 1;
  s.actedInActionPhase = false;
  s.extraTurnPending = false;
  s.skipToEndOfTurn = false;
  s.subPhase = 'beginningOfTurn';
  s.resumePhase = 'draw';

  // Queue Beginning-of-Turn triggers in the player's Stable:
  const st = stableOf(s, playerId);
  // 1. Sadistic Ritual (mandatory if player has a Unicorn)
  for (const d of st.downgrades) {
    if (d.kind === 'sadistic-ritual' && !hasPandamonium(s, playerId) && st.unicorns.length > 0) {
      s.promptQueue.push({
        kind: 'beginningTrigger',
        playerId,
        sourceCard: d,
        mandatory: true,
      });
    }
  }
  // 2. Rhinocorn (if not blinded)
  if (!isBlinded(s, playerId)) {
    for (const u of st.unicorns) {
      if (u.kind === 'rhinocorn') {
        s.promptQueue.push({
          kind: 'beginningTrigger',
          playerId,
          sourceCard: u,
          mandatory: false,
        });
      }
    }
  }
  // 3. Beginning-of-turn Upgrades
  for (const up of st.upgrades) {
    if (
      up.kind === 'caffeine-overload' ||
      up.kind === 'claw-machine' ||
      up.kind === 'glitter-bomb' ||
      up.kind === 'rainbow-lasso' ||
      up.kind === 'stable-artillery'
    ) {
      s.promptQueue.push({
        kind: 'beginningTrigger',
        playerId,
        sourceCard: up,
        mandatory: false,
      });
    }
  }

  advanceFlow(s);
}

function advanceFlow(s: UuState) {
  if (s.phase === 'gameOver') return;

  // Prune any prompts on the front of the queue that have zero legal choices
  while (s.promptQueue.length > 0) {
    const front = s.promptQueue[0]!;
    if (isPromptImpossible(s, front)) {
      s.promptQueue.shift();
      continue;
    }
    break;
  }

  if (s.promptQueue.length > 0) {
    s.subPhase = 'awaitingPrompt';
    s.activePlayerId = s.promptQueue[0]!.playerId;
    return;
  }

  if (checkWinCondition(s)) return;

  if (s.skipToEndOfTurn) {
    s.skipToEndOfTurn = false;
    s.resumePhase = 'endOfTurn';
  }

  if (s.resumePhase === 'draw') {
    s.subPhase = 'draw';
    s.activePlayerId = s.turnPlayerId;
    return;
  }

  if (s.resumePhase === 'action') {
    if (s.playsRemaining <= 0) {
      s.resumePhase = 'endOfTurn';
    } else {
      s.subPhase = 'action';
      s.activePlayerId = s.turnPlayerId;
      return;
    }
  }

  if (s.resumePhase === 'endOfTurn') {
    const hand = handOf(s, s.turnPlayerId);
    if (hand.length > HAND_LIMIT) {
      s.promptQueue.push({
        kind: 'chooseCardsFromHand',
        playerId: s.turnPlayerId,
        reason: `Discard down to ${HAND_LIMIT} cards to end your turn.`,
        count: hand.length - HAND_LIMIT,
        optional: false,
        filter: 'any',
        effectTag: 'endOfTurnLimit',
      });
      s.subPhase = 'awaitingPrompt';
      s.activePlayerId = s.turnPlayerId;
      return;
    }
    finishTurn(s);
  }
}

function isPromptImpossible(s: UuState, p: UuPrompt): boolean {
  if (p.kind === 'beginningTrigger') {
    const c = p.sourceCard;
    if (c.kind === 'sadistic-ritual') {
      return hasPandamonium(s, p.playerId) || stableOf(s, p.playerId).unicorns.length === 0;
    }
    if (c.kind === 'rhinocorn') {
      return validStableTargets(s, {
        kind: 'chooseStableCard',
        playerId: p.playerId,
        reason: '',
        optional: true,
        scope: 'others',
        filter: 'unicorn',
        mode: 'destroy',
        sourceType: 'unicorn',
      }).length === 0;
    }
    if (c.kind === 'caffeine-overload') {
      return allCardsInStable(stableOf(s, p.playerId)).length === 0;
    }
    if (c.kind === 'claw-machine') {
      return handOf(s, p.playerId).length === 0;
    }
    if (c.kind === 'glitter-bomb') {
      return allCardsInStable(stableOf(s, p.playerId)).length === 0;
    }
    if (c.kind === 'rainbow-lasso') {
      const hasStealTargets = validStableTargets(s, {
        kind: 'chooseStableCard',
        playerId: p.playerId,
        reason: '',
        optional: true,
        scope: 'others',
        filter: 'unicorn',
        mode: 'steal',
        sourceType: 'upgrade',
      }).length > 0;
      return handOf(s, p.playerId).length < 3 || !hasStealTargets;
    }
    if (c.kind === 'stable-artillery') {
      const hasDestroyTargets = validStableTargets(s, {
        kind: 'chooseStableCard',
        playerId: p.playerId,
        reason: '',
        optional: true,
        scope: 'others',
        filter: 'unicorn',
        mode: 'destroy',
        sourceType: 'upgrade',
      }).length > 0;
      return handOf(s, p.playerId).length < 2 || !hasDestroyTargets;
    }
    return false;
  }
  if (p.kind === 'chooseCardsFromHand') {
    const valid = validHandCards(s, p);
    return valid.length < p.count && (valid.length === 0 || p.optional);
  }
  if (p.kind === 'chooseStableCard') {
    return validStableTargets(s, p).length === 0;
  }
  if (p.kind === 'chooseFromPile') {
    const valid = validPileCards(s, p);
    if (valid.length === 0) {
      if (p.shuffleDeckAfter) s.deck = shuffle(s.rngState, s.deck);
      return true;
    }
    return false;
  }
  if (p.kind === 'chooseFromOpponentHand') {
    return handOf(s, p.targetPlayerId).length === 0;
  }
  if (p.kind === 'oraclePeek') {
    return p.cards.length === 0;
  }
  return false;
}

function finishTurn(s: UuState) {
  if (checkWinCondition(s)) return;
  if (s.extraTurnPending) {
    s.extraTurnPending = false;
    pushLog(s, s.turnPlayerId, `${seatName(s, s.turnPlayerId)} takes another turn from Change of Luck!`, 'good');
    startTurn(s, s.turnPlayerId);
    return;
  }
  const idx = s.seats.findIndex((x) => x.id === s.turnPlayerId);
  const nextSeat = s.seats[(idx + 1) % s.seats.length]!;
  startTurn(s, nextSeat.id);
}

// ============================================================================
// Stable transitions & card effects
// ============================================================================

function checkTinyStable(s: UuState, playerId: PlayerId) {
  if (hasTinyStable(s, playerId) && unicornCount(s, playerId) > 5) {
    s.promptQueue.unshift({
      kind: 'chooseStableCard',
      playerId,
      reason: 'Tiny Stable: you have more than 5 Unicorns and must SACRIFICE a Unicorn card.',
      optional: false,
      scope: 'own',
      filter: 'unicorn',
      mode: 'sacrifice',
      sourceType: 'downgrade',
    });
  }
}

function enterStable(s: UuState, playerId: PlayerId, card: UuCard, triggerEnterEffects: boolean) {
  const st = stableOf(s, playerId);
  if (isUnicornType(card.type)) {
    st.unicorns.push(card);
  } else if (card.type === 'upgrade') {
    st.upgrades.push(card);
  } else if (card.type === 'downgrade') {
    st.downgrades.push(card);
  }

  // Barbed Wire check
  if (isUnicornType(card.type) && hasBarbedWire(s, playerId) && handOf(s, playerId).length > 0) {
    s.promptQueue.push({
      kind: 'chooseCardsFromHand',
      playerId,
      reason: 'Barbed Wire: a Unicorn entered your Stable — DISCARD a card.',
      count: 1,
      optional: false,
      filter: 'any',
      effectTag: 'discard',
    });
  }

  // Enter-Stable effects on Magical Unicorns (unless blinded by Blinding Light)
  if (triggerEnterEffects && card.type === 'magicalUnicorn' && !isBlinded(s, playerId)) {
    queueMagicalUnicornEnterEffect(s, playerId, card);
  }

  checkTinyStable(s, playerId);
}

function removeFromStable(
  s: UuState,
  ownerId: PlayerId,
  cardId: number,
  reason: 'sacrifice' | 'destroy' | 'bounce' | 'steal' | 'move',
  opts?: {
    toPlayerId?: PlayerId;
    sourceType?: 'magic' | 'unicorn' | 'upgrade' | 'downgrade';
    skipBlackKnightCheck?: boolean;
    skipPhoenixCheck?: boolean;
  },
) {
  const st = stableOf(s, ownerId);
  const card = findCardInStable(s, ownerId, cardId);
  if (!card) return;

  const blinded = isBlinded(s, ownerId);

  // 1. Black Knight Unicorn intercept on destroy of another Unicorn in the same Stable
  if (
    reason === 'destroy' &&
    isUnicornType(card.type) &&
    card.kind !== 'black-knight-unicorn' &&
    !blinded &&
    !opts?.skipBlackKnightCheck
  ) {
    const bk = st.unicorns.find((u) => u.kind === 'black-knight-unicorn');
    if (bk) {
      s.promptQueue.unshift({
        kind: 'blackKnightSave',
        playerId: ownerId,
        blackKnightCardId: bk.id,
        targetUnicornId: card.id,
        sourceType: opts?.sourceType ?? 'magic',
      });
      return;
    }
  }

  // 2. Unicorn Phoenix replacement effect on sacrifice or destroy
  if (
    (reason === 'sacrifice' || reason === 'destroy') &&
    card.kind === 'unicorn-phoenix' &&
    !blinded &&
    handOf(s, ownerId).length > 0 &&
    !opts?.skipPhoenixCheck
  ) {
    s.promptQueue.unshift({
      kind: 'chooseCardsFromHand',
      playerId: ownerId,
      reason: 'Unicorn Phoenix: you may DISCARD a card instead of losing Unicorn Phoenix.',
      count: 1,
      optional: true,
      filter: 'any',
      effectTag: 'PhoenixSave',
      contextCardId: card.id,
      afterContext: {
        pendingDestroyOwnerId: ownerId,
        pendingDestroyCardId: card.id,
        fromSacrifice: reason === 'sacrifice',
      },
    });
    return;
  }

  // Remove from the arrays
  st.unicorns = st.unicorns.filter((c) => c.id !== cardId);
  st.upgrades = st.upgrades.filter((c) => c.id !== cardId);
  st.downgrades = st.downgrades.filter((c) => c.id !== cardId);

  // Barbed Wire check on Unicorn leaving Stable
  if (isUnicornType(card.type) && hasBarbedWire(s, ownerId) && handOf(s, ownerId).length > 0) {
    s.promptQueue.push({
      kind: 'chooseCardsFromHand',
      playerId: ownerId,
      reason: 'Barbed Wire: a Unicorn left your Stable — DISCARD a card.',
      count: 1,
      optional: false,
      filter: 'any',
      effectTag: 'discard',
    });
  }

  // Destination routing
  if ((reason === 'steal' || reason === 'move') && opts?.toPlayerId) {
    enterStable(s, opts.toPlayerId, card, true);
    return;
  }

  if (card.type === 'babyUnicorn') {
    s.nursery.push(card);
    return;
  }

  if ((reason === 'sacrifice' || reason === 'destroy') && isFlyerKind(card.kind) && !blinded) {
    handOf(s, ownerId).push(card);
    pushLog(s, ownerId, `${card.name} flew back to ${seatName(s, ownerId)}'s hand.`, 'normal');
    return;
  }

  if (reason === 'bounce') {
    handOf(s, ownerId).push(card);
    return;
  }

  // Otherwise goes to discard pile
  s.discard.push(card);

  // Stabby the Unicorn trigger on sacrifice or destroy
  if ((reason === 'sacrifice' || reason === 'destroy') && card.kind === 'stabby-the-unicorn' && !blinded) {
    s.promptQueue.push({
      kind: 'chooseStableCard',
      playerId: ownerId,
      reason: 'Stabby the Unicorn was lost — you may DESTROY a Unicorn card.',
      optional: true,
      scope: 'others',
      filter: 'unicorn',
      mode: 'destroy',
      sourceType: 'unicorn',
    });
  }
}

function queueMagicalUnicornEnterEffect(s: UuState, playerId: PlayerId, card: UuCard) {
  switch (card.kind) {
    case 'alluring-narwhal':
      s.promptQueue.push({
        kind: 'chooseStableCard',
        playerId,
        reason: 'Alluring Narwhal: you may STEAL an Upgrade card.',
        optional: true,
        scope: 'others',
        filter: 'upgrade',
        mode: 'steal',
        sourceType: 'unicorn',
      });
      break;
    case 'americorn':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId,
        reason: "Americorn: you may pull a card at random from another player's hand.",
        optional: true,
        allowSelf: false,
        effectTag: 'americornPull',
      });
      break;
    case 'annoying-flying-unicorn':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId,
        reason: 'Annoying Flying Unicorn: you may force another player to DISCARD a card.',
        optional: true,
        allowSelf: false,
        effectTag: 'annoyingDiscard',
      });
      break;
    case 'chainsaw-unicorn':
      s.promptQueue.push({
        kind: 'chooseStableCard',
        playerId,
        reason: 'Chainsaw Unicorn: you may DESTROY an Upgrade card or SACRIFICE a Downgrade card.',
        optional: true,
        scope: 'any',
        filter: 'destroyUpgradeOrSacrificeDowngrade',
        mode: 'destroy',
        sourceType: 'unicorn',
      });
      break;
    case 'classy-narwhal':
      s.promptQueue.push({
        kind: 'chooseFromPile',
        playerId,
        reason: 'Classy Narwhal: you may search the deck for an Upgrade card and add it to your hand.',
        optional: true,
        pile: 'deck',
        filter: 'upgrade',
        destination: 'hand',
        shuffleDeckAfter: true,
      });
      break;
    case 'dark-angel-unicorn':
      s.promptQueue.push({
        kind: 'chooseStableCard',
        playerId,
        reason: 'Dark Angel Unicorn: you may SACRIFICE a Unicorn card to bring a Unicorn from the discard pile into your Stable.',
        optional: true,
        scope: 'own',
        filter: 'unicorn',
        mode: 'sacrifice',
        sourceType: 'unicorn',
        effectTag: 'darkAngelSacrifice',
      });
      break;
    case 'extremely-destructive-unicorn':
      for (const seat of s.seats) {
        s.promptQueue.push({
          kind: 'chooseStableCard',
          playerId: seat.id,
          reason: 'Extremely Destructive Unicorn: you must SACRIFICE a Unicorn card.',
          optional: false,
          scope: 'own',
          filter: 'unicorn',
          mode: 'sacrifice',
          sourceType: 'unicorn',
        });
      }
      break;
    case 'greedy-flying-unicorn':
      drawCards(s, playerId, 1);
      pushLog(s, playerId, `${seatName(s, playerId)} drew a card from Greedy Flying Unicorn.`, 'normal');
      break;
    case 'llamacorn':
      for (const seat of s.seats) {
        if (handOf(s, seat.id).length > 0) {
          s.promptQueue.push({
            kind: 'chooseCardsFromHand',
            playerId: seat.id,
            reason: 'Llamacorn: you must DISCARD a card.',
            count: 1,
            optional: false,
            filter: 'any',
            effectTag: 'discard',
          });
        }
      }
      break;
    case 'magical-flying-unicorn':
      s.promptQueue.push({
        kind: 'chooseFromPile',
        playerId,
        reason: 'Magical Flying Unicorn: you may add a Magic card from the discard pile to your hand.',
        optional: true,
        pile: 'discard',
        filter: 'magic',
        destination: 'hand',
      });
      break;
    case 'majestic-flying-unicorn':
      s.promptQueue.push({
        kind: 'chooseFromPile',
        playerId,
        reason: 'Majestic Flying Unicorn: you may add a Unicorn card from the discard pile to your hand.',
        optional: true,
        pile: 'discard',
        filter: 'unicorn',
        destination: 'hand',
      });
      break;
    case 'mermaid-unicorn':
      s.promptQueue.push({
        kind: 'chooseStableCard',
        playerId,
        reason: "Mermaid Unicorn: you may return a card in another player's Stable to their hand.",
        optional: true,
        scope: 'others',
        filter: 'any',
        mode: 'bounce',
        sourceType: 'unicorn',
      });
      break;
    case 'mother-goose-unicorn':
      s.promptQueue.push({
        kind: 'chooseFromPile',
        playerId,
        reason: 'Mother Goose Unicorn: you may bring a Baby Unicorn from the Nursery into your Stable.',
        optional: true,
        pile: 'nursery',
        filter: 'baby',
        destination: 'stable',
      });
      break;
    case 'narwhal-torpedo': {
      const downgrades = [...stableOf(s, playerId).downgrades];
      for (const d of downgrades) {
        removeFromStable(s, playerId, d.id, 'sacrifice', { sourceType: 'unicorn' });
      }
      if (downgrades.length > 0) {
        pushLog(s, playerId, `Narwhal Torpedo sacrificed ${downgrades.length} Downgrade card(s).`, 'good');
      }
      break;
    }
    case 'necromancer-unicorn':
      if (handOf(s, playerId).filter((c) => isUnicornType(c.type)).length >= 2 && s.discard.some((c) => isUnicornType(c.type))) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId,
          reason: 'Necromancer Unicorn: you may DISCARD 2 Unicorn cards to bring a Unicorn from the discard pile into your Stable.',
          count: 2,
          optional: true,
          filter: 'unicorn',
          effectTag: 'necromancerDiscard',
        });
      }
      break;
    case 'rainbow-unicorn':
      s.promptQueue.push({
        kind: 'chooseCardsFromHand',
        playerId,
        reason: 'Rainbow Unicorn: you may bring a Basic Unicorn card from your hand into your Stable.',
        count: 1,
        optional: true,
        filter: 'basicUnicorn',
        effectTag: 'rainbowUnicornBring',
      });
      break;
    case 'seductive-unicorn':
      if (handOf(s, playerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId,
          reason: 'Seductive Unicorn: you may DISCARD a card, then STEAL a Unicorn card.',
          count: 1,
          optional: true,
          filter: 'any',
          effectTag: 'seductiveDiscard',
        });
      }
      break;
    case 'shabby-the-narwhal':
      s.promptQueue.push({
        kind: 'chooseFromPile',
        playerId,
        reason: 'Shabby the Narwhal: you may search the deck for a Downgrade card and add it to your hand.',
        optional: true,
        pile: 'deck',
        filter: 'downgrade',
        destination: 'hand',
        shuffleDeckAfter: true,
      });
      break;
    case 'shark-with-a-horn':
      s.promptQueue.push({
        kind: 'chooseStableCard',
        playerId,
        reason: 'Shark With a Horn: you may SACRIFICE Shark With a Horn to DESTROY a Unicorn card.',
        optional: true,
        scope: 'others',
        filter: 'unicorn',
        mode: 'destroy',
        sourceType: 'unicorn',
        effectTag: `sharkSacrifice:${card.id}`,
      });
      break;
    case 'swift-flying-unicorn':
      s.promptQueue.push({
        kind: 'chooseFromPile',
        playerId,
        reason: 'Swift Flying Unicorn: you may add a Neigh card from the discard pile to your hand.',
        optional: true,
        pile: 'discard',
        filter: 'neigh',
        destination: 'hand',
      });
      break;
    case 'the-great-narwhal':
      s.promptQueue.push({
        kind: 'chooseFromPile',
        playerId,
        reason: 'The Great Narwhal: you may search the deck for a Narwhal card and add it to your hand.',
        optional: true,
        pile: 'deck',
        filter: 'narwhal',
        destination: 'hand',
        shuffleDeckAfter: true,
      });
      break;
    case 'unicorn-on-the-cob':
      drawCards(s, playerId, 2);
      if (s.phase !== 'gameOver' && handOf(s, playerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId,
          reason: 'Unicorn on the Cob: drew 2 cards — now DISCARD a card.',
          count: 1,
          optional: false,
          filter: 'any',
          effectTag: 'discard',
        });
      }
      break;
    case 'unicorn-oracle': {
      const top3 = s.deck.splice(0, 3);
      if (top3.length > 0) {
        s.promptQueue.push({
          kind: 'oraclePeek',
          playerId,
          cards: top3,
        });
      }
      break;
    }
    default:
      break;
  }
}

function resolveMagicEffect(s: UuState, byPlayerId: PlayerId, card: UuCard) {
  switch (card.kind) {
    case 'back-kick':
      s.promptQueue.push({
        kind: 'chooseStableCard',
        playerId: byPlayerId,
        reason: "Back Kick: choose a card in another player's Stable to return to their hand (they will then DISCARD a card).",
        optional: false,
        scope: 'others',
        filter: 'any',
        mode: 'bounce',
        sourceType: 'magic',
        effectTag: 'backKickBounce',
      });
      break;
    case 'blatant-thievery':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Blatant Thievery: choose another player to look at their hand and take a card.",
        optional: false,
        allowSelf: false,
        effectTag: 'blatantThieveryLook',
      });
      break;
    case 'change-of-luck':
      drawCards(s, byPlayerId, 2);
      if (s.phase !== 'gameOver') {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Change of Luck: DISCARD 3 cards to take another turn.',
          count: Math.min(3, handOf(s, byPlayerId).length),
          optional: false,
          filter: 'any',
          effectTag: 'changeOfLuckDiscard',
        });
      }
      break;
    case 'glitter-tornado':
      for (const seat of s.seats) {
        if (allCardsInStable(stableOf(s, seat.id)).length > 0) {
          s.promptQueue.push({
            kind: 'chooseStableCard',
            playerId: byPlayerId,
            reason: `Glitter Tornado: choose a card in ${seat.name}'s Stable to return to their hand.`,
            optional: false,
            scope: 'specificPlayer',
            specificPlayerId: seat.id,
            filter: 'any',
            mode: 'bounce',
            sourceType: 'magic',
          });
        }
      }
      break;
    case 'good-deal':
      drawCards(s, byPlayerId, 3);
      if (s.phase !== 'gameOver' && handOf(s, byPlayerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Good Deal: drew 3 cards — now DISCARD a card.',
          count: 1,
          optional: false,
          filter: 'any',
          effectTag: 'discard',
        });
      }
      break;
    case 'kiss-of-life':
      s.promptQueue.push({
        kind: 'chooseFromPile',
        playerId: byPlayerId,
        reason: 'Kiss of Life: choose a Unicorn card from the discard pile to bring into your Stable.',
        optional: false,
        pile: 'discard',
        filter: 'unicorn',
        destination: 'stable',
      });
      break;
    case 'mystical-vortex': {
      const seatsWithCards = s.seats.filter((seat) => handOf(s, seat.id).length > 0);
      if (seatsWithCards.length === 0) {
        s.deck = shuffle(s.rngState, [...s.deck, ...s.discard]);
        s.discard = [];
      } else {
        seatsWithCards.forEach((seat, idx) => {
          s.promptQueue.push({
            kind: 'chooseCardsFromHand',
            playerId: seat.id,
            reason: 'Mystical Vortex: you must DISCARD a card.',
            count: 1,
            optional: false,
            filter: 'any',
            effectTag: idx === seatsWithCards.length - 1 ? 'mysticalVortexDiscard' : 'discard',
          });
        });
      }
      break;
    }
    case 're-target':
      s.promptQueue.push({
        kind: 'chooseStableCard',
        playerId: byPlayerId,
        reason: 'Re-Target: choose an Upgrade or Downgrade card in any Stable to move.',
        optional: false,
        scope: 'any',
        filter: 'upgradeOrDowngrade',
        mode: 'moveSource',
        sourceType: 'magic',
      });
      break;
    case 'reset-button': {
      for (const seat of s.seats) {
        const st = stableOf(s, seat.id);
        const toSac = [...st.upgrades, ...st.downgrades];
        for (const c of toSac) {
          removeFromStable(s, seat.id, c.id, 'sacrifice', { sourceType: 'magic' });
        }
      }
      s.deck = shuffle(s.rngState, [...s.deck, ...s.discard]);
      s.discard = [];
      pushLog(s, byPlayerId, 'Reset Button sacrificed all Upgrades and Downgrades and shuffled the discard pile into the deck.', 'danger');
      break;
    }
    case 'shake-up': {
      // Remove Shake Up from discard (it was just placed there on resolution)
      const idx = s.discard.findIndex((c) => c.id === card.id);
      if (idx >= 0) s.discard.splice(idx, 1);
      const hand = handOf(s, byPlayerId);
      const pool = [...s.deck, ...hand, ...s.discard, card];
      s.hands[byPlayerId] = [];
      s.discard = [];
      s.deck = shuffle(s.rngState, pool);
      drawCards(s, byPlayerId, 5);
      pushLog(s, byPlayerId, `${seatName(s, byPlayerId)} played Shake Up and drew 5 fresh cards.`, 'normal');
      break;
    }
    case 'targeted-destruction':
      s.promptQueue.push({
        kind: 'chooseStableCard',
        playerId: byPlayerId,
        reason: 'Targeted Destruction: DESTROY an Upgrade card or SACRIFICE a Downgrade card.',
        optional: false,
        scope: 'any',
        filter: 'destroyUpgradeOrSacrificeDowngrade',
        mode: 'destroy',
        sourceType: 'magic',
      });
      break;
    case 'two-for-one':
      s.promptQueue.push({
        kind: 'chooseStableCard',
        playerId: byPlayerId,
        reason: 'Two-For-One: choose a card in your Stable to SACRIFICE (then DESTROY 2 cards).',
        optional: false,
        scope: 'own',
        filter: 'any',
        mode: 'sacrifice',
        sourceType: 'magic',
        effectTag: 'twoForOneSacrifice',
      });
      break;
    case 'unfair-bargain':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: 'Unfair Bargain: choose another player to trade hands with.',
        optional: false,
        allowSelf: false,
        effectTag: 'unfairBargainTrade',
      });
      break;
    case 'unicorn-poison':
      s.promptQueue.push({
        kind: 'chooseStableCard',
        playerId: byPlayerId,
        reason: 'Unicorn Poison: choose a Unicorn card to DESTROY.',
        optional: false,
        scope: 'others',
        filter: 'unicorn',
        mode: 'destroy',
        sourceType: 'magic',
      });
      break;
    case 'unicorn-swap':
      s.promptQueue.push({
        kind: 'chooseStableCard',
        playerId: byPlayerId,
        reason: 'Unicorn Swap: choose a Unicorn card in your Stable to move to another player.',
        optional: false,
        scope: 'own',
        filter: 'unicorn',
        mode: 'swapGive',
        sourceType: 'magic',
      });
      break;
    default:
      break;
  }
}

// ============================================================================
// Neigh Reaction Window
// ============================================================================

function buildNeighResponderQueue(s: UuState, justPlayedBy: PlayerId): PlayerId[] {
  const p = s.pending;
  if (!p) return [];
  if (p.superNeighed) return [];
  // If the last card on the stack was played by someone with Yay, it cannot be Neighed
  if (hasYay(s, justPlayedBy)) return [];

  return s.seats
    .map((seat) => seat.id)
    .filter((id) => id !== justPlayedBy && canPlayNeigh(s, id));
}

function openOrResolveNeigh(s: UuState, justPlayedBy: PlayerId) {
  const p = s.pending;
  if (!p) throw new Error('openOrResolveNeigh with no pending play');
  const queue = buildNeighResponderQueue(s, justPlayedBy);
  p.responderQueue = queue;
  const first = queue[0];
  if (!first) {
    resolvePendingPlay(s);
    return;
  }
  s.subPhase = 'awaitingNeigh';
  s.activePlayerId = first;
}

function resolvePendingPlay(s: UuState) {
  const p = s.pending;
  if (!p) throw new Error('resolvePendingPlay with no pending play');
  s.pending = null;

  s.discard.push(...p.neighCards);
  const cancelled = p.neighCards.length % 2 === 1;
  if (cancelled) {
    s.discard.push(p.card);
    pushLog(
      s,
      null,
      `${p.card.name} was Neighed${p.superNeighed ? ' (Super Neigh!)' : p.neighCards.length > 1 ? ` (${p.neighCards.length} Neighs deep)` : ''}!`,
      'danger',
    );
    advanceFlow(s);
    return;
  }

  // Card resolves!
  const destPlayer = p.targetPlayerId ?? p.byPlayerId;
  if (p.card.type === 'magic') {
    s.discard.push(p.card);
    resolveMagicEffect(s, p.byPlayerId, p.card);
  } else {
    enterStable(s, destPlayer, p.card, true);
  }

  advanceFlow(s);
}

// ============================================================================
// Action Handlers
// ============================================================================

function handleDrawForTurn(s: UuState, a: Extract<UuAction, { type: 'drawForTurn' }>) {
  if (s.subPhase !== 'draw') throw new Error(`cannot draw for turn during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');

  drawCards(s, a.playerId, 1);
  if (s.phase === 'gameOver') return;
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} drew a card for their Draw phase.`, 'normal');
  s.resumePhase = 'action';
  advanceFlow(s);
}

function handleDrawInsteadOfPlaying(s: UuState, a: Extract<UuAction, { type: 'drawInsteadOfPlaying' }>) {
  if (s.subPhase !== 'action') throw new Error(`cannot draw during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');
  if (s.actedInActionPhase) throw new Error('cannot draw for action after already playing a card');

  s.playsRemaining = 0;
  s.actedInActionPhase = true;
  drawCards(s, a.playerId, 1);
  if (s.phase === 'gameOver') return;
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} drew an extra card instead of playing a card.`, 'normal');
  s.resumePhase = 'endOfTurn';
  advanceFlow(s);
}

function handleEndActionPhase(s: UuState, a: Extract<UuAction, { type: 'endActionPhase' }>) {
  if (s.subPhase !== 'action') throw new Error(`cannot end action phase during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');
  if (!s.actedInActionPhase) throw new Error('must play a card or draw a card during your Action phase');

  s.playsRemaining = 0;
  s.resumePhase = 'endOfTurn';
  advanceFlow(s);
}

function handlePlayCard(s: UuState, a: Extract<UuAction, { type: 'playCard' }>) {
  if (s.subPhase !== 'action') throw new Error(`cannot play a card during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');
  if (s.playsRemaining <= 0) throw new Error('no card plays remaining this turn');

  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex((c) => c.id === a.cardId);
  if (idx < 0) throw new Error('card not in hand');
  const card = hand[idx]!;

  // Determine target Stable owner:
  let targetPlayerId: PlayerId = a.targetPlayerId ?? a.playerId;
  if (card.type === 'basicUnicorn') {
    const qb = queenBeeOwner(s);
    if (qb) targetPlayerId = qb;
  }

  if (!canPlayCardFromHand(s, a.playerId, card, targetPlayerId)) {
    throw new Error(`cannot legally play ${card.name} right now`);
  }

  hand.splice(idx, 1);
  s.playsRemaining -= 1;
  s.actedInActionPhase = true;
  s.resumePhase = s.playsRemaining > 0 ? 'action' : 'endOfTurn';

  const targetNote =
    card.type !== 'magic' && targetPlayerId !== a.playerId
      ? ` into ${seatName(s, targetPlayerId)}'s Stable`
      : '';
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} played ${card.name}${targetNote}.`, 'normal');

  s.pending = {
    byPlayerId: a.playerId,
    card,
    targetPlayerId,
    neighCards: [],
    superNeighed: false,
    responderQueue: [],
  };
  openOrResolveNeigh(s, a.playerId);
}

function handlePlayNeigh(s: UuState, a: Extract<UuAction, { type: 'playNeigh' }>) {
  if (s.subPhase !== 'awaitingNeigh') throw new Error('no play to Neigh');
  const p = s.pending;
  if (!p) throw new Error('no pending play');
  if (!p.responderQueue.includes(a.playerId)) throw new Error('you cannot Neigh this play');
  if (!canPlayNeigh(s, a.playerId)) throw new Error('you are prevented from playing Neigh cards');

  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex((c) => c.id === a.cardId);
  if (idx < 0) throw new Error('Neigh card not in hand');
  const card = hand[idx]!;
  if (!isNeighCard(card)) throw new Error('that card is not a Neigh');

  hand.splice(idx, 1);
  p.neighCards.push(card);
  if (card.kind === 'super-neigh') {
    p.superNeighed = true;
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} played SUPER NEIGH!`, 'danger');
  } else {
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} played Neigh!`, 'danger');
  }

  openOrResolveNeigh(s, a.playerId);
}

function handleDeclineNeigh(s: UuState, a: Extract<UuAction, { type: 'declineNeigh' }>) {
  if (s.subPhase !== 'awaitingNeigh') throw new Error('nothing to decline');
  const p = s.pending;
  if (!p) throw new Error('no pending play');
  if (p.responderQueue[0] !== a.playerId) throw new Error('not your turn to respond');

  p.responderQueue.shift();
  const next = p.responderQueue[0];
  if (!next) {
    resolvePendingPlay(s);
    return;
  }
  s.activePlayerId = next;
}

function handleResolvePrompt(s: UuState, a: Extract<UuAction, { type: 'resolvePrompt' }>) {
  if (s.subPhase !== 'awaitingPrompt') throw new Error('no prompt awaiting resolution');
  const prompt = s.promptQueue[0];
  if (!prompt) throw new Error('prompt queue empty');
  if (a.playerId !== prompt.playerId) throw new Error('not your prompt to resolve');

  s.promptQueue.shift();

  switch (prompt.kind) {
    case 'beginningTrigger': {
      if (a.decline) {
        if (prompt.mandatory) throw new Error('this effect is mandatory');
        advanceFlow(s);
        return;
      }
      const c = prompt.sourceCard;
      if (c.kind === 'sadistic-ritual') {
        s.promptQueue.unshift({
          kind: 'chooseStableCard',
          playerId: prompt.playerId,
          reason: 'Sadistic Ritual: SACRIFICE a Unicorn card, then DRAW a card.',
          optional: false,
          scope: 'own',
          filter: 'unicorn',
          mode: 'sacrifice',
          sourceType: 'downgrade',
          effectTag: 'sadisticRitualSacrifice',
        });
      } else if (c.kind === 'rhinocorn') {
        s.promptQueue.unshift({
          kind: 'chooseStableCard',
          playerId: prompt.playerId,
          reason: 'Rhinocorn: choose a Unicorn card to DESTROY (then immediately end your turn).',
          optional: true,
          scope: 'others',
          filter: 'unicorn',
          mode: 'destroy',
          sourceType: 'unicorn',
          effectTag: 'rhinocornDestroy',
        });
      } else if (c.kind === 'caffeine-overload') {
        s.promptQueue.unshift({
          kind: 'chooseStableCard',
          playerId: prompt.playerId,
          reason: 'Caffeine Overload: choose a card in your Stable to SACRIFICE (then DRAW 2 cards).',
          optional: true,
          scope: 'own',
          filter: 'any',
          mode: 'sacrifice',
          sourceType: 'upgrade',
          effectTag: 'caffeineOverloadSacrifice',
        });
      } else if (c.kind === 'claw-machine') {
        s.promptQueue.unshift({
          kind: 'chooseCardsFromHand',
          playerId: prompt.playerId,
          reason: 'Claw Machine: choose a card in your hand to DISCARD (then DRAW a card).',
          count: 1,
          optional: true,
          filter: 'any',
          effectTag: 'clawMachineDiscard',
        });
      } else if (c.kind === 'glitter-bomb') {
        s.promptQueue.unshift({
          kind: 'chooseStableCard',
          playerId: prompt.playerId,
          reason: 'Glitter Bomb: choose a card in your Stable to SACRIFICE (then DESTROY a card).',
          optional: true,
          scope: 'own',
          filter: 'any',
          mode: 'sacrifice',
          sourceType: 'upgrade',
          effectTag: 'glitterBombSacrifice',
        });
      } else if (c.kind === 'rainbow-lasso') {
        s.promptQueue.unshift({
          kind: 'chooseCardsFromHand',
          playerId: prompt.playerId,
          reason: 'Rainbow Lasso: choose 3 cards from your hand to DISCARD (then STEAL a Unicorn card).',
          count: 3,
          optional: true,
          filter: 'any',
          effectTag: 'rainbowLassoDiscard',
        });
      } else if (c.kind === 'stable-artillery') {
        s.promptQueue.unshift({
          kind: 'chooseCardsFromHand',
          playerId: prompt.playerId,
          reason: 'Stable Artillery: choose 2 cards from your hand to DISCARD (then DESTROY a Unicorn card).',
          count: 2,
          optional: true,
          filter: 'any',
          effectTag: 'stableArtilleryDiscard',
        });
      }
      advanceFlow(s);
      return;
    }

    case 'chooseCardsFromHand': {
      if (a.decline) {
        if (!prompt.optional) throw new Error('cannot decline mandatory hand choice');
        if (prompt.effectTag === 'PhoenixSave' && prompt.afterContext?.pendingDestroyOwnerId && prompt.afterContext.pendingDestroyCardId) {
          removeFromStable(
            s,
            prompt.afterContext.pendingDestroyOwnerId,
            prompt.afterContext.pendingDestroyCardId,
            prompt.afterContext.fromSacrifice ? 'sacrifice' : 'destroy',
            { skipPhoenixCheck: true },
          );
        }
        advanceFlow(s);
        return;
      }

      const valid = validHandCards(s, prompt);
      const needed = Math.min(prompt.count, valid.length);
      const ids = a.cardIds ?? [];
      if (ids.length !== needed || new Set(ids).size !== needed) {
        throw new Error(`must choose exactly ${needed} card(s)`);
      }
      const hand = handOf(s, prompt.playerId);
      const chosen: UuCard[] = [];
      for (const id of ids) {
        if (!valid.some((v) => v.id === id)) throw new Error('selected invalid card from hand');
        const idx = hand.findIndex((c) => c.id === id);
        if (idx < 0) throw new Error('card not in hand');
        chosen.push(hand.splice(idx, 1)[0]!);
      }

      if (prompt.effectTag === 'rainbowUnicornBring') {
        const u = chosen[0]!;
        const qb = queenBeeOwner(s);
        const dest = qb ?? prompt.playerId;
        enterStable(s, dest, u, true);
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} brought ${u.name} into Stable with Rainbow Unicorn.`, 'good');
      } else {
        s.discard.push(...chosen);
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} discarded ${chosen.map((c) => c.name).join(', ')}.`, 'normal');

        if (prompt.effectTag === 'necromancerDiscard') {
          s.promptQueue.unshift({
            kind: 'chooseFromPile',
            playerId: prompt.playerId,
            reason: 'Necromancer Unicorn: choose a Unicorn card from the discard pile to bring into your Stable.',
            optional: false,
            pile: 'discard',
            filter: 'unicorn',
            destination: 'stable',
          });
        } else if (prompt.effectTag === 'seductiveDiscard') {
          s.promptQueue.unshift({
            kind: 'chooseStableCard',
            playerId: prompt.playerId,
            reason: 'Seductive Unicorn: choose a Unicorn card to STEAL.',
            optional: false,
            scope: 'others',
            filter: 'unicorn',
            mode: 'steal',
            sourceType: 'unicorn',
          });
        } else if (prompt.effectTag === 'changeOfLuckDiscard') {
          if (chosen.length >= 3) {
            s.extraTurnPending = true;
          }
        } else if (prompt.effectTag === 'mysticalVortexDiscard') {
          s.deck = shuffle(s.rngState, [...s.deck, ...s.discard]);
          s.discard = [];
          pushLog(s, null, 'Mystical Vortex shuffled the discard pile into the deck.', 'normal');
        } else if (prompt.effectTag === 'clawMachineDiscard') {
          drawCards(s, prompt.playerId, 1);
        } else if (prompt.effectTag === 'stableArtilleryDiscard') {
          s.promptQueue.unshift({
            kind: 'chooseStableCard',
            playerId: prompt.playerId,
            reason: 'Stable Artillery: choose a Unicorn card to DESTROY.',
            optional: false,
            scope: 'others',
            filter: 'unicorn',
            mode: 'destroy',
            sourceType: 'upgrade',
          });
        } else if (prompt.effectTag === 'rainbowLassoDiscard') {
          s.promptQueue.unshift({
            kind: 'chooseStableCard',
            playerId: prompt.playerId,
            reason: 'Rainbow Lasso: choose a Unicorn card to STEAL.',
            optional: false,
            scope: 'others',
            filter: 'unicorn',
            mode: 'steal',
            sourceType: 'upgrade',
          });
        }
      }

      advanceFlow(s);
      return;
    }

    case 'chooseStableCard': {
      if (a.decline) {
        if (!prompt.optional) throw new Error('cannot decline mandatory Stable target choice');
        advanceFlow(s);
        return;
      }

      const valid = validStableTargets(s, prompt);
      const target = valid.find((v) => v.card.id === a.targetCardId);
      if (!target) throw new Error('invalid Stable card target');

      if (prompt.filter === 'destroyUpgradeOrSacrificeDowngrade') {
        const mode = target.ownerId === prompt.playerId ? 'sacrifice' : 'destroy';
        removeFromStable(s, target.ownerId, target.card.id, mode, { sourceType: prompt.sourceType });
        pushLog(
          s,
          prompt.playerId,
          `${seatName(s, prompt.playerId)} ${mode === 'sacrifice' ? 'sacrificed' : 'destroyed'} ${target.card.name}.`,
          'normal',
        );
        advanceFlow(s);
        return;
      }

      if (prompt.mode === 'moveSource') {
        s.promptQueue.unshift({
          kind: 'choosePlayer',
          playerId: prompt.playerId,
          reason: `Re-Target: choose which player's Stable to move ${target.card.name} to.`,
          optional: false,
          allowSelf: true,
          effectTag: 'reTargetDestination',
          movedCardId: target.card.id,
          movedFromPlayerId: target.ownerId,
        });
        advanceFlow(s);
        return;
      }

      if (prompt.mode === 'swapGive') {
        s.promptQueue.unshift({
          kind: 'choosePlayer',
          playerId: prompt.playerId,
          reason: `Unicorn Swap: choose which player's Stable to move ${target.card.name} to.`,
          optional: false,
          allowSelf: false,
          effectTag: 'unicornSwapTarget',
          movedCardId: target.card.id,
          movedFromPlayerId: target.ownerId,
        });
        advanceFlow(s);
        return;
      }

      if (prompt.mode === 'swapSteal') {
        removeFromStable(s, target.ownerId, target.card.id, 'steal', {
          toPlayerId: prompt.playerId,
          sourceType: prompt.sourceType,
        });
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} stole ${target.card.name} with Unicorn Swap!`, 'good');
        advanceFlow(s);
        return;
      }

      if (prompt.effectTag?.startsWith('sharkSacrifice:')) {
        const sharkId = Number(prompt.effectTag.split(':')[1]);
        removeFromStable(s, prompt.playerId, sharkId, 'sacrifice', { sourceType: 'unicorn' });
        removeFromStable(s, target.ownerId, target.card.id, 'destroy', { sourceType: 'unicorn' });
        pushLog(s, prompt.playerId, `Shark With a Horn sacrificed itself to destroy ${target.card.name}!`, 'danger');
        advanceFlow(s);
        return;
      }

      if (prompt.mode === 'steal') {
        removeFromStable(s, target.ownerId, target.card.id, 'steal', {
          toPlayerId: prompt.playerId,
          sourceType: prompt.sourceType,
        });
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} stole ${target.card.name} from ${seatName(s, target.ownerId)}!`, 'good');
      } else if (prompt.mode === 'bounce') {
        removeFromStable(s, target.ownerId, target.card.id, 'bounce', { sourceType: prompt.sourceType });
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} returned ${target.card.name} to ${seatName(s, target.ownerId)}'s hand.`, 'normal');
        if (prompt.effectTag === 'backKickBounce' && handOf(s, target.ownerId).length > 0) {
          s.promptQueue.unshift({
            kind: 'chooseCardsFromHand',
            playerId: target.ownerId,
            reason: 'Back Kick: you must DISCARD a card.',
            count: 1,
            optional: false,
            filter: 'any',
            effectTag: 'discard',
          });
        }
      } else if (prompt.mode === 'sacrifice') {
        removeFromStable(s, target.ownerId, target.card.id, 'sacrifice', { sourceType: prompt.sourceType });
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} sacrificed ${target.card.name}.`, 'normal');
        if (prompt.effectTag === 'darkAngelSacrifice') {
          s.promptQueue.unshift({
            kind: 'chooseFromPile',
            playerId: prompt.playerId,
            reason: 'Dark Angel Unicorn: choose a Unicorn card from the discard pile to bring into your Stable.',
            optional: false,
            pile: 'discard',
            filter: 'unicorn',
            destination: 'stable',
          });
        } else if (prompt.effectTag === 'sadisticRitualSacrifice') {
          drawCards(s, prompt.playerId, 1);
        } else if (prompt.effectTag === 'caffeineOverloadSacrifice') {
          drawCards(s, prompt.playerId, 2);
        } else if (prompt.effectTag === 'glitterBombSacrifice') {
          s.promptQueue.unshift({
            kind: 'chooseStableCard',
            playerId: prompt.playerId,
            reason: 'Glitter Bomb: choose a card in another Stable to DESTROY.',
            optional: false,
            scope: 'others',
            filter: 'any',
            mode: 'destroy',
            sourceType: 'upgrade',
          });
        } else if (prompt.effectTag === 'twoForOneSacrifice') {
          s.promptQueue.unshift(
            {
              kind: 'chooseStableCard',
              playerId: prompt.playerId,
              reason: 'Two-For-One (1 of 2): choose a card in another Stable to DESTROY.',
              optional: false,
              scope: 'others',
              filter: 'any',
              mode: 'destroy',
              sourceType: 'magic',
            },
            {
              kind: 'chooseStableCard',
              playerId: prompt.playerId,
              reason: 'Two-For-One (2 of 2): choose a second card in another Stable to DESTROY.',
              optional: false,
              scope: 'others',
              filter: 'any',
              mode: 'destroy',
              sourceType: 'magic',
            },
          );
        }
      } else if (prompt.mode === 'destroy') {
        removeFromStable(s, target.ownerId, target.card.id, 'destroy', { sourceType: prompt.sourceType });
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} destroyed ${target.card.name} in ${seatName(s, target.ownerId)}'s Stable!`, 'danger');
        if (prompt.effectTag === 'rhinocornDestroy') {
          s.skipToEndOfTurn = true;
          pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)}'s turn ends immediately after Rhinocorn's charge.`, 'normal');
        }
      }

      advanceFlow(s);
      return;
    }

    case 'choosePlayer': {
      if (a.decline) {
        if (!prompt.optional) throw new Error('cannot decline mandatory player choice');
        advanceFlow(s);
        return;
      }
      const targetId = a.targetPlayerId;
      if (!targetId || !s.seats.some((st) => st.id === targetId)) {
        throw new Error('invalid target player');
      }
      if (!prompt.allowSelf && targetId === prompt.playerId) {
        throw new Error('cannot choose yourself');
      }

      if (prompt.effectTag === 'americornPull') {
        const victimHand = handOf(s, targetId);
        if (victimHand.length > 0) {
          if (hasNannyCam(s, targetId)) {
            s.promptQueue.unshift({
              kind: 'chooseFromOpponentHand',
              playerId: prompt.playerId,
              targetPlayerId: targetId,
              reason: `Americorn (Nanny Cam active): choose a card from ${seatName(s, targetId)}'s visible hand.`,
            });
          } else {
            const idx = rngInt(s.rngState, victimHand.length);
            const [pulled] = victimHand.splice(idx, 1);
            if (pulled) handOf(s, prompt.playerId).push(pulled);
            pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} pulled a random card from ${seatName(s, targetId)}'s hand.`, 'normal');
          }
        }
      } else if (prompt.effectTag === 'annoyingDiscard') {
        if (handOf(s, targetId).length > 0) {
          s.promptQueue.unshift({
            kind: 'chooseCardsFromHand',
            playerId: targetId,
            reason: `Annoying Flying Unicorn: ${seatName(s, prompt.playerId)} forced you to DISCARD a card.`,
            count: 1,
            optional: false,
            filter: 'any',
            effectTag: 'discard',
          });
        }
      } else if (prompt.effectTag === 'blatantThieveryLook') {
        if (handOf(s, targetId).length > 0) {
          s.promptQueue.unshift({
            kind: 'chooseFromOpponentHand',
            playerId: prompt.playerId,
            targetPlayerId: targetId,
            reason: `Blatant Thievery: look at ${seatName(s, targetId)}'s hand and choose a card to take.`,
          });
        }
      } else if (prompt.effectTag === 'unfairBargainTrade') {
        const myHand = handOf(s, prompt.playerId);
        const theirHand = handOf(s, targetId);
        s.hands[prompt.playerId] = theirHand;
        s.hands[targetId] = myHand;
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} traded hands with ${seatName(s, targetId)}!`, 'danger');
      } else if (prompt.effectTag === 'reTargetDestination' && prompt.movedCardId && prompt.movedFromPlayerId) {
        if (targetId === prompt.movedFromPlayerId) {
          throw new Error('Re-Target must move the card to a different Stable');
        }
        removeFromStable(s, prompt.movedFromPlayerId, prompt.movedCardId, 'move', {
          toPlayerId: targetId,
          sourceType: 'magic',
        });
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} moved a card to ${seatName(s, targetId)}'s Stable with Re-Target.`, 'normal');
      } else if (prompt.effectTag === 'unicornSwapTarget' && prompt.movedCardId && prompt.movedFromPlayerId) {
        removeFromStable(s, prompt.movedFromPlayerId, prompt.movedCardId, 'move', {
          toPlayerId: targetId,
          sourceType: 'magic',
        });
        s.promptQueue.unshift({
          kind: 'chooseStableCard',
          playerId: prompt.playerId,
          reason: `Unicorn Swap: choose a Unicorn card in ${seatName(s, targetId)}'s Stable to STEAL.`,
          optional: false,
          scope: 'specificPlayer',
          specificPlayerId: targetId,
          filter: 'unicorn',
          mode: 'swapSteal',
          sourceType: 'magic',
        });
      }

      advanceFlow(s);
      return;
    }

    case 'chooseFromOpponentHand': {
      const victimHand = handOf(s, prompt.targetPlayerId);
      const idx = victimHand.findIndex((c) => c.id === a.targetCardId);
      if (idx < 0) throw new Error('chosen card not in target player hand');
      const [taken] = victimHand.splice(idx, 1);
      if (taken) {
        handOf(s, prompt.playerId).push(taken);
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} took a card from ${seatName(s, prompt.targetPlayerId)}'s hand.`, 'good');
      }
      advanceFlow(s);
      return;
    }

    case 'chooseFromPile': {
      if (a.decline) {
        if (!prompt.optional) throw new Error('cannot decline mandatory pile pick');
        if (prompt.shuffleDeckAfter) s.deck = shuffle(s.rngState, s.deck);
        advanceFlow(s);
        return;
      }
      const valid = validPileCards(s, prompt);
      const chosen = valid.find((c) => c.id === a.targetCardId);
      if (!chosen) throw new Error('chosen card is not valid in pile');

      const pile = prompt.pile === 'discard' ? s.discard : prompt.pile === 'deck' ? s.deck : s.nursery;
      const idx = pile.findIndex((c) => c.id === chosen.id);
      if (idx >= 0) pile.splice(idx, 1);

      if (prompt.shuffleDeckAfter) {
        s.deck = shuffle(s.rngState, s.deck);
      }

      if (prompt.destination === 'hand') {
        handOf(s, prompt.playerId).push(chosen);
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} added ${chosen.name} to their hand.`, 'good');
      } else {
        enterStable(s, prompt.playerId, chosen, true);
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} brought ${chosen.name} into their Stable.`, 'good');
      }

      advanceFlow(s);
      return;
    }

    case 'oraclePeek': {
      const pickId = a.oraclePickId ?? a.targetCardId;
      const picked = prompt.cards.find((c) => c.id === pickId);
      if (!picked) throw new Error('must pick one of the top 3 cards to add to hand');
      handOf(s, prompt.playerId).push(picked);

      const rest = prompt.cards.filter((c) => c.id !== picked.id);
      if (a.oracleTopOrder && a.oracleTopOrder.length === rest.length) {
        const ordered = a.oracleTopOrder.map((id) => rest.find((c) => c.id === id)).filter((c): c is UuCard => !!c);
        if (ordered.length === rest.length) {
          s.deck.unshift(...ordered);
        } else {
          s.deck.unshift(...rest);
        }
      } else {
        s.deck.unshift(...rest);
      }
      pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} consulted Unicorn Oracle.`, 'normal');
      advanceFlow(s);
      return;
    }

    case 'blackKnightSave': {
      if (a.decline) {
        removeFromStable(s, prompt.playerId, prompt.targetUnicornId, 'destroy', {
          sourceType: prompt.sourceType,
          skipBlackKnightCheck: true,
        });
      } else {
        removeFromStable(s, prompt.playerId, prompt.blackKnightCardId, 'sacrifice', {
          sourceType: 'unicorn',
        });
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} sacrificed Black Knight Unicorn to protect their Unicorn!`, 'good');
      }
      advanceFlow(s);
      return;
    }
  }
}

// ============================================================================
// Entry point
// ============================================================================

export function applyAction(state: UuState, action: UuAction): UuState {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  const s = clone(state);

  switch (action.type) {
    case 'drawForTurn':
      handleDrawForTurn(s, action);
      break;
    case 'drawInsteadOfPlaying':
      handleDrawInsteadOfPlaying(s, action);
      break;
    case 'endActionPhase':
      handleEndActionPhase(s, action);
      break;
    case 'playCard':
      handlePlayCard(s, action);
      break;
    case 'playNeigh':
      handlePlayNeigh(s, action);
      break;
    case 'declineNeigh':
      handleDeclineNeigh(s, action);
      break;
    case 'resolvePrompt':
      handleResolvePrompt(s, action);
      break;
    default: {
      const never: never = action;
      throw new Error(`unknown action ${JSON.stringify(never)}`);
    }
  }

  return s;
}
