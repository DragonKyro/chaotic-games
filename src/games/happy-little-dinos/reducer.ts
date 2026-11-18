// Happy Little Dinosaurs — pure deterministic reducer for the Base Game.

import { shuffle } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import { buildHldDecks, HLD_DINO_DEFS } from './cards';
import type {
  HldAction,
  HldCard,
  HldConfig,
  HldDinoId,
  HldDisasterCard,
  HldState,
} from './types';

const LOG_CAP = 60;

// ============================================================================
// Setup
// ============================================================================

export function createInitialState(config: HldConfig, seed: number, seats: Seat[]): HldState {
  const rngState = { seed: seed >>> 0 };
  const first = seats[0];
  if (!first) throw new Error('Happy Little Dinosaurs needs at least one seat');

  const { disasterDeck, deck } = buildHldDecks(rngState);
  const dinos: Record<PlayerId, HldDinoId> = {};
  seats.forEach((s, i) => {
    dinos[s.id] = HLD_DINO_DEFS[i % HLD_DINO_DEFS.length]!.id;
  });

  const state: HldState = {
    phase: 'playing',
    seats,
    activePlayerId: first.id,
    finalScores: null,
    rngState,

    subPhase: 'selecting',
    dinos,
    disasterDeck,
    disasterDiscard: [],
    currentDisaster: null,

    deck,
    discard: [],
    hands: Object.fromEntries(seats.map((s) => [s.id, []])),

    pendingPicks: Object.fromEntries(seats.map((s) => [s.id, null])),
    revealedPicks: Object.fromEntries(seats.map((s) => [s.id, null])),

    pointEffectBonuses: Object.fromEntries(seats.map((s) => [s.id, 0])),
    instantScoreDeltas: Object.fromEntries(seats.map((s) => [s.id, 0])),
    scoreInversionsPlayed: 0,

    promptQueue: [],
    instantResponderQueue: [],
    suddenDeathPlayers: [],
    pendingDisasterVictimId: null,

    disasterAreas: Object.fromEntries(seats.map((s) => [s.id, []])),
    trackPosition: Object.fromEntries(seats.map((s) => [s.id, 0])),
    eliminated: [],
    winnerId: null,

    roundNumber: 0,
    log: [],
    logSeq: 0,
    config,
  };

  startNextRound(state);
  return state;
}

// ============================================================================
// Helpers & Score Calculation
// ============================================================================

function clone(state: HldState): HldState {
  return JSON.parse(JSON.stringify(state)) as HldState;
}

function pushLog(s: HldState, byPlayerId: PlayerId | null, text: string, tone: 'normal' | 'danger' | 'good') {
  s.logSeq += 1;
  s.log.push({ seq: s.logSeq, byPlayerId, text, tone });
  if (s.log.length > LOG_CAP) s.log = s.log.slice(-LOG_CAP);
}

export function seatName(s: HldState, id: PlayerId | null): string {
  if (!id) return 'Someone';
  return s.seats.find((x) => x.id === id)?.name ?? 'Someone';
}

export function isLive(s: HldState, id: PlayerId): boolean {
  return !s.eliminated.includes(id);
}

export function livePlayerIds(s: HldState): PlayerId[] {
  return s.seats.filter((st) => isLive(s, st.id)).map((st) => st.id);
}

export function handOf(s: HldState, id: PlayerId): HldCard[] {
  const h = s.hands[id];
  if (!h) throw new Error(`unknown hand ${id}`);
  return h;
}

export function dinoTraitDelta(s: HldState, playerId: PlayerId): number {
  const disaster = s.currentDisaster;
  if (!disaster) return 0;
  const dinoId = s.dinos[playerId];
  const def = HLD_DINO_DEFS.find((d) => d.id === dinoId);
  if (!def) return 0;

  if (disaster.category === 'meteor') {
    // Meteor acts as all 3 categories (and triggers Stego's +1 on Meteor)
    if (def.plusCategory === 'meteor') return 1;
    // For Dinosaurs with +1 on one category and -1 on another, Meteor triggers both (+1 - 1 = 0)
    return 0;
  }

  if (def.plusCategory === disaster.category) return 1;
  if (def.minusCategory === disaster.category) return -1;
  return 0;
}

export function isChainsawActive(s: HldState): boolean {
  for (const id of livePlayerIds(s)) {
    if (s.revealedPicks[id]?.kind === 'flaming-chainsaw') return true;
  }
  return false;
}

export function starFruitMultiplier(s: HldState): number {
  if (isChainsawActive(s)) return 1;
  let mult = 1;
  for (const id of livePlayerIds(s)) {
    if (s.revealedPicks[id]?.kind === 'special-star-fruit') {
      mult *= 2;
    }
  }
  return mult;
}

/**
 * Compute each live player's score for the current round, including Mouth Trap / Score Inversion swaps.
 */
export function computeRoundScores(s: HldState): Record<PlayerId, number> {
  const live = livePlayerIds(s);
  const chainsaw = isChainsawActive(s);
  const mult = starFruitMultiplier(s);
  const raw: Record<PlayerId, number> = {};

  for (const id of live) {
    const card = s.revealedPicks[id];
    const base = card?.value ?? 0;
    const trait = dinoTraitDelta(s, id);
    const ptBonus = chainsaw ? 0 : s.pointEffectBonuses[id] ?? 0;
    const instBonus = (s.instantScoreDeltas[id] ?? 0) * mult;
    raw[id] = base + trait + ptBonus + instBonus;
  }

  let mouthTraps = 0;
  if (!chainsaw) {
    for (const id of live) {
      if (s.revealedPicks[id]?.kind === 'mouth-trap') mouthTraps += 1;
    }
  }
  const totalInversions = mouthTraps + s.scoreInversionsPlayed;

  if (totalInversions % 2 === 1 && live.length >= 2) {
    const vals = Object.values(raw);
    const maxVal = Math.max(...vals);
    const minVal = Math.min(...vals);
    if (maxVal !== minVal) {
      for (const id of live) {
        if (raw[id] === maxVal) raw[id] = minVal;
        else if (raw[id] === minVal) raw[id] = maxVal;
      }
    }
  }

  return raw;
}

export function isEliminatedByDisasters(cards: HldDisasterCard[]): boolean {
  let natural = 0;
  let predator = 0;
  let emotional = 0;
  let meteor = 0;
  for (const c of cards) {
    if (c.category === 'natural') natural++;
    else if (c.category === 'predator') predator++;
    else if (c.category === 'emotional') emotional++;
    else if (c.category === 'meteor') meteor++;
  }
  // Meteor is wild: 1+ Meteor plus any 2 other Disasters always makes 3 same or 3 different
  if (meteor >= 1 && cards.length >= 3) return true;
  if (natural >= 3 || predator >= 3 || emotional >= 3) return true;
  if (natural >= 1 && predator >= 1 && emotional >= 1) return true;
  return false;
}

function drawOneCard(s: HldState): HldCard | null {
  if (s.deck.length === 0 && s.discard.length > 0) {
    s.deck = shuffle(s.rngState, s.discard);
    s.discard = [];
  }
  return s.deck.shift() ?? null;
}

function refillHandsTo5WithPointCard(s: HldState) {
  for (const id of livePlayerIds(s)) {
    const hand = handOf(s, id);
    while (hand.length < 5) {
      const c = drawOneCard(s);
      if (!c) break;
      hand.push(c);
    }
    // Rulebook: if a player has no Point cards in hand, discard hand and draw 5 new cards
    let attempts = 0;
    while (!hand.some((c) => c.type === 'point') && attempts < 5) {
      attempts++;
      s.discard.push(...hand);
      hand.length = 0;
      for (let i = 0; i < 5; i++) {
        const c = drawOneCard(s);
        if (!c) break;
        hand.push(c);
      }
    }
  }
}

function nextUnpickedPlayer(s: HldState, pool: PlayerId[]): PlayerId | null {
  const unpicked = pool.filter((id) => !s.pendingPicks[id]);
  if (unpicked.length === 0) return null;
  // Park activePlayerId on AI seats first so GameHost's AI driver ticks them immediately
  const aiSeat = unpicked.find((id) => s.seats.find((st) => st.id === id)?.isAI);
  return aiSeat ?? unpicked[0] ?? null;
}

// ============================================================================
// Round Lifecycle
// ============================================================================

function startNextRound(s: HldState) {
  if (checkGameEnd(s)) return;

  s.roundNumber += 1;
  refillHandsTo5WithPointCard(s);

  if (s.disasterDeck.length === 0 && s.disasterDiscard.length > 0) {
    s.disasterDeck = shuffle(s.rngState, s.disasterDiscard);
    s.disasterDiscard = [];
  }
  const disaster = s.disasterDeck.shift() ?? {
    id: 9999 + s.roundNumber,
    name: 'Meteor!',
    category: 'meteor',
    text: 'Wild Disaster!',
  };
  s.currentDisaster = disaster;

  for (const seat of s.seats) {
    s.pendingPicks[seat.id] = null;
    s.revealedPicks[seat.id] = null;
    s.pointEffectBonuses[seat.id] = 0;
    s.instantScoreDeltas[seat.id] = 0;
  }
  s.scoreInversionsPlayed = 0;
  s.suddenDeathPlayers = [];
  s.pendingDisasterVictimId = null;

  s.subPhase = 'selecting';
  s.activePlayerId = nextUnpickedPlayer(s, livePlayerIds(s));
  pushLog(
    s,
    null,
    `🌋 Round ${s.roundNumber}: Disaster flipped — ${disaster.name} (${disaster.category.toUpperCase()})!`,
    'danger',
  );
}

function revealAllPicks(s: HldState) {
  const live = livePlayerIds(s);
  for (const id of live) {
    s.revealedPicks[id] = s.pendingPicks[id] ?? null;
    s.pendingPicks[id] = null;
  }

  // Queue Point card effects in order from lowest Point value to highest, tiebroken by lowest trackPosition
  if (!isChainsawActive(s)) {
    const ordered = [...live].sort((a, b) => {
      const va = s.revealedPicks[a]?.value ?? 0;
      const vb = s.revealedPicks[b]?.value ?? 0;
      if (va !== vb) return va - vb;
      return (s.trackPosition[a] ?? 0) - (s.trackPosition[b] ?? 0);
    });

    for (const id of ordered) {
      const card = s.revealedPicks[id];
      if (!card) continue;
      if (card.kind === 'pet-rock' && handOf(s, id).some((c) => c.type === 'point')) {
        s.promptQueue.push({ kind: 'petRockDiscard', playerId: id, smoothieOnlyEffects: false });
      } else if (card.kind === 'dino-grabber' && live.some((o) => o !== id && handOf(s, o).length > 0)) {
        s.promptQueue.push({ kind: 'dinoGrabberSteal', playerId: id });
      } else if (card.kind === 'grappling-snake') {
        const neighbors = adjacentSwapTargets(s, id);
        if (neighbors.length > 0) {
          s.promptQueue.push({ kind: 'grapplingSnakeSwap', playerId: id, validNeighbors: neighbors });
        }
      } else if (
        card.kind === 'delicious-smoothie' &&
        handOf(s, id).some((c) => c.type === 'point' && c.hasEffect)
      ) {
        s.promptQueue.push({ kind: 'petRockDiscard', playerId: id, smoothieOnlyEffects: true });
      } else if (card.kind === 'fire-spray' && handOf(s, id).length > 0) {
        s.promptQueue.push({ kind: 'fireSprayDiscard', playerId: id });
      } else if (card.kind === 'treenoculars') {
        const top2: HldCard[] = [];
        const c1 = drawOneCard(s);
        const c2 = drawOneCard(s);
        if (c1) top2.push(c1);
        if (c2) top2.push(c2);
        if (top2.length > 0) {
          s.promptQueue.push({ kind: 'treenocularsPick', playerId: id, cards: top2 });
        }
      } else if (card.kind === 'hungry-plant' && live.length >= 2) {
        s.promptQueue.push({ kind: 'hungryPlantSwap', playerId: id });
      }
    }
  } else {
    pushLog(s, null, 'Flaming Chainsaw ignores all other Point card effects this round!', 'danger');
  }

  advanceFromPointEffects(s);
}

function adjacentSwapTargets(s: HldState, playerId: PlayerId): PlayerId[] {
  const live = livePlayerIds(s);
  const idx = live.indexOf(playerId);
  if (idx < 0 || live.length < 2) return [];
  const left = live[(idx - 1 + live.length) % live.length]!;
  const right = live[(idx + 1) % live.length]!;
  const candidates = Array.from(new Set([left, right])).filter((id) => id !== playerId);
  // Cannot swap for a card that has an effect
  return candidates.filter((id) => {
    const c = s.revealedPicks[id];
    return c && !c.hasEffect;
  });
}

function advanceFromPointEffects(s: HldState) {
  if (s.promptQueue.length > 0) {
    s.subPhase = 'pointEffects';
    s.activePlayerId = s.promptQueue[0]!.playerId;
    return;
  }

  openOrResolveScoringInstants(s);
}

function hasScoringInstant(s: HldState, playerId: PlayerId): boolean {
  return handOf(s, playerId).some(
    (c) => c.kind === 'score-booster' || c.kind === 'score-sapper' || c.kind === 'score-inversion',
  );
}

function openOrResolveScoringInstants(s: HldState) {
  const queue = livePlayerIds(s).filter((id) => hasScoringInstant(s, id));
  s.instantResponderQueue = queue;
  const first = queue[0];
  if (!first) {
    finalizeRoundScoring(s);
    return;
  }
  s.subPhase = 'awaitingScoringInstants';
  s.activePlayerId = first;
}

function finalizeRoundScoring(s: HldState) {
  const scores = computeRoundScores(s);
  const live = livePlayerIds(s);
  const vals = live.map((id) => scores[id]!);
  const maxScore = Math.max(...vals);
  const minScore = Math.min(...vals);

  // Move revealed Point cards to discard
  for (const id of live) {
    const c = s.revealedPicks[id];
    if (c) s.discard.push(c);
  }

  // Highest scoring player(s) advance on Escape Route!
  const winners = live.filter((id) => scores[id] === maxScore);
  for (const w of winners) {
    const gain = Math.max(0, maxScore);
    s.trackPosition[w] = (s.trackPosition[w] ?? 0) + gain;
    pushLog(s, w, `${seatName(s, w)} had the highest score (${maxScore}) and moved +${gain} on their Escape Route!`, 'good');
  }

  // Lowest scoring player(s)
  const losers = live.filter((id) => scores[id] === minScore);
  if (losers.length === 1) {
    assignPendingDisaster(s, losers[0]!);
    return;
  }

  // Tie for lowest score -> Sudden Death!
  // Check if any tied player has no Point card in hand:
  const withoutPoint = losers.filter((id) => !handOf(s, id).some((c) => c.type === 'point'));
  if (withoutPoint.length === 1) {
    assignPendingDisaster(s, withoutPoint[0]!);
    return;
  }
  if (withoutPoint.length > 1) {
    // If multiple tied losers have no Point cards, nobody takes the disaster (moves to bottom of disaster deck)
    if (s.currentDisaster) s.disasterDeck.push(s.currentDisaster);
    s.currentDisaster = null;
    endRoundCleanup(s);
    return;
  }

  s.suddenDeathPlayers = losers;
  for (const id of losers) s.pendingPicks[id] = null;
  s.subPhase = 'suddenDeath';
  s.activePlayerId = nextUnpickedPlayer(s, losers);
  pushLog(s, null, `⚡ Sudden Death tiebreaker between ${losers.map((id) => seatName(s, id)).join(' & ')}!`, 'danger');
}

function assignPendingDisaster(s: HldState, victimId: PlayerId) {
  s.pendingDisasterVictimId = victimId;
  const canSave = handOf(s, victimId).some(
    (c) => c.kind === 'disaster-insurance' || c.kind === 'disaster-redirect',
  );
  if (canSave) {
    s.subPhase = 'awaitingDisasterSave';
    s.activePlayerId = victimId;
    return;
  }
  inflictDisaster(s, victimId);
}

function inflictDisaster(s: HldState, victimId: PlayerId) {
  const disaster = s.currentDisaster;
  s.currentDisaster = null;
  s.pendingDisasterVictimId = null;

  if (disaster) {
    s.disasterAreas[victimId]!.push(disaster);
    pushLog(s, victimId, `💥 ${seatName(s, victimId)} added ${disaster.name} (${disaster.category}) to their Disaster Area!`, 'danger');

    if (isEliminatedByDisasters(s.disasterAreas[victimId]!)) {
      s.eliminated.push(victimId);
      s.discard.push(...handOf(s, victimId));
      s.hands[victimId] = [];
      pushLog(s, victimId, `☄️ ${seatName(s, victimId)} collected 3 Disasters and is ELIMINATED!`, 'danger');
    }
  }

  endRoundCleanup(s);
}

function endRoundCleanup(s: HldState) {
  if (checkGameEnd(s)) return;

  // Surviving players advance +1 space per Disaster card in their Disaster Area
  for (const id of livePlayerIds(s)) {
    const bonus = s.disasterAreas[id]?.length ?? 0;
    if (bonus > 0) {
      s.trackPosition[id] = (s.trackPosition[id] ?? 0) + bonus;
    }
  }

  if (checkGameEnd(s)) return;
  startNextRound(s);
}

function checkGameEnd(s: HldState): boolean {
  const live = livePlayerIds(s);
  if (live.length <= 1) {
    const winner = live[0] ?? s.seats[0]!.id;
    s.phase = 'gameOver';
    s.subPhase = 'gameOver';
    s.activePlayerId = null;
    s.winnerId = winner;
    s.finalScores = Object.fromEntries(
      s.seats.map((st) => [st.id, isLive(s, st.id) ? 100 + (s.trackPosition[st.id] ?? 0) : s.trackPosition[st.id] ?? 0]),
    );
    pushLog(s, winner, `🦕 ${seatName(s, winner)} is the last Dinosaur standing and wins!`, 'good');
    return true;
  }

  const reachedGoal = live.filter((id) => (s.trackPosition[id] ?? 0) >= s.config.trackLength);
  if (reachedGoal.length > 0) {
    reachedGoal.sort((a, b) => {
      const diff = (s.trackPosition[b] ?? 0) - (s.trackPosition[a] ?? 0);
      if (diff !== 0) return diff;
      return (s.disasterAreas[a]?.length ?? 0) - (s.disasterAreas[b]?.length ?? 0);
    });
    const winner = reachedGoal[0]!;
    s.phase = 'gameOver';
    s.subPhase = 'gameOver';
    s.activePlayerId = null;
    s.winnerId = winner;
    s.finalScores = Object.fromEntries(s.seats.map((st) => [st.id, s.trackPosition[st.id] ?? 0]));
    pushLog(s, winner, `🏁 ${seatName(s, winner)} reached ${s.trackPosition[winner]} points on the Escape Route and wins!`, 'good');
    return true;
  }

  return false;
}

// ============================================================================
// Action Handlers
// ============================================================================

function handleChooseDino(s: HldState, a: Extract<HldAction, { type: 'chooseDino' }>) {
  if (!HLD_DINO_DEFS.some((d) => d.id === a.dinoId)) throw new Error('unknown Dinosaur');
  s.dinos[a.playerId] = a.dinoId;
}

function handleSubmitPick(s: HldState, a: Extract<HldAction, { type: 'submitPick' }>) {
  if (s.subPhase !== 'selecting') throw new Error(`cannot submit pick during ${s.subPhase}`);
  if (!isLive(s, a.playerId)) throw new Error('eliminated players cannot act');
  if (s.pendingPicks[a.playerId]) throw new Error('already submitted a Point card this round');

  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex((c) => c.id === a.cardId && c.type === 'point');
  if (idx < 0) throw new Error('must select a Point card from your hand');
  const [card] = hand.splice(idx, 1);
  s.pendingPicks[a.playerId] = card!;

  const next = nextUnpickedPlayer(s, livePlayerIds(s));
  if (next) {
    s.activePlayerId = next;
    return;
  }

  revealAllPicks(s);
}

function handleResolvePrompt(s: HldState, a: Extract<HldAction, { type: 'resolvePrompt' }>) {
  if (s.subPhase !== 'pointEffects') throw new Error('not resolving point effects');
  const prompt = s.promptQueue[0];
  if (!prompt || prompt.playerId !== a.playerId) throw new Error('not your prompt');

  s.promptQueue.shift();

  switch (prompt.kind) {
    case 'petRockDiscard': {
      if (!a.decline && a.targetCardId !== undefined) {
        const hand = handOf(s, prompt.playerId);
        const idx = hand.findIndex(
          (c) =>
            c.id === a.targetCardId &&
            c.type === 'point' &&
            (!prompt.smoothieOnlyEffects || c.hasEffect),
        );
        if (idx >= 0) {
          const [discarded] = hand.splice(idx, 1);
          if (discarded) {
            s.discard.push(discarded);
            s.pointEffectBonuses[prompt.playerId] =
              (s.pointEffectBonuses[prompt.playerId] ?? 0) + (discarded.value ?? 0);
            pushLog(
              s,
              prompt.playerId,
              `${seatName(s, prompt.playerId)} discarded ${discarded.name} (+${discarded.value ?? 0} points this round).`,
              'good',
            );
          }
        }
      }
      break;
    }

    case 'dinoGrabberSteal': {
      if (!a.decline && a.targetPlayerId && a.targetCardId !== undefined) {
        const oppHand = handOf(s, a.targetPlayerId);
        const idx = oppHand.findIndex((c) => c.id === a.targetCardId);
        if (idx >= 0) {
          const [taken] = oppHand.splice(idx, 1);
          if (taken) {
            handOf(s, prompt.playerId).push(taken);
            pushLog(s, prompt.playerId, `Dino Grabber: ${seatName(s, prompt.playerId)} took a card from ${seatName(s, a.targetPlayerId)}!`, 'good');
          }
        }
      }
      break;
    }

    case 'grapplingSnakeSwap': {
      if (!a.decline && a.targetPlayerId && prompt.validNeighbors.includes(a.targetPlayerId)) {
        const mine = s.revealedPicks[prompt.playerId] ?? null;
        const theirs = s.revealedPicks[a.targetPlayerId] ?? null;
        if (mine && theirs && !theirs.hasEffect) {
          s.revealedPicks[prompt.playerId] = theirs;
          s.revealedPicks[a.targetPlayerId] = mine;
          pushLog(s, prompt.playerId, `Grappling Snake: ${seatName(s, prompt.playerId)} swapped Point cards with ${seatName(s, a.targetPlayerId)}!`, 'normal');
        }
      }
      break;
    }

    case 'fireSprayDiscard': {
      if (!a.decline && a.cardIds && a.cardIds.length > 0) {
        const hand = handOf(s, prompt.playerId);
        for (const id of a.cardIds.slice(0, 3)) {
          const idx = hand.findIndex((c) => c.id === id);
          if (idx >= 0) {
            s.discard.push(hand.splice(idx, 1)[0]!);
          }
        }
      }
      break;
    }

    case 'treenocularsPick': {
      const picked = prompt.cards.find((c) => c.id === a.targetCardId) ?? prompt.cards[0];
      if (picked) {
        handOf(s, prompt.playerId).push(picked);
        for (const c of prompt.cards) {
          if (c.id !== picked.id) s.discard.push(c);
        }
      }
      break;
    }

    case 'hungryPlantSwap': {
      if (
        !a.decline &&
        a.targetPlayerId &&
        a.secondPlayerId &&
        a.targetPlayerId !== a.secondPlayerId
      ) {
        const c1 = s.revealedPicks[a.targetPlayerId] ?? null;
        const c2 = s.revealedPicks[a.secondPlayerId] ?? null;
        if (c1 && c2) {
          s.revealedPicks[a.targetPlayerId] = c2;
          s.revealedPicks[a.secondPlayerId] = c1;
          pushLog(
            s,
            prompt.playerId,
            `Hungry Plant: ${seatName(s, prompt.playerId)} swapped the Point cards of ${seatName(s, a.targetPlayerId)} and ${seatName(s, a.secondPlayerId)}!`,
            'danger',
          );
        }
      }
      break;
    }
  }

  advanceFromPointEffects(s);
}

function handlePlayScoringInstant(s: HldState, a: Extract<HldAction, { type: 'playScoringInstant' }>) {
  if (s.subPhase !== 'awaitingScoringInstants') throw new Error('not in scoring instant window');
  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex(
    (c) =>
      c.id === a.cardId &&
      (c.kind === 'score-booster' || c.kind === 'score-sapper' || c.kind === 'score-inversion'),
  );
  if (idx < 0) throw new Error('Scoring Instant card not in hand');
  const [card] = hand.splice(idx, 1);
  s.discard.push(card!);

  if (card!.kind === 'score-booster') {
    const target = a.targetPlayerId ?? a.playerId;
    s.instantScoreDeltas[target] = (s.instantScoreDeltas[target] ?? 0) + 2;
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} played Score Booster on ${seatName(s, target)} (+2)!`, 'good');
  } else if (card!.kind === 'score-sapper') {
    const target = a.targetPlayerId ?? livePlayerIds(s).find((id) => id !== a.playerId) ?? a.playerId;
    s.instantScoreDeltas[target] = (s.instantScoreDeltas[target] ?? 0) - 2;
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} played Score Sapper on ${seatName(s, target)} (-2)!`, 'danger');
  } else if (card!.kind === 'score-inversion') {
    s.scoreInversionsPlayed += 1;
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} played Score Inversion!`, 'danger');
  }

  openOrResolveScoringInstants(s);
}

function handleDeclineScoringInstant(s: HldState, a: Extract<HldAction, { type: 'declineScoringInstant' }>) {
  if (s.subPhase !== 'awaitingScoringInstants') throw new Error('not in scoring instant window');
  if (s.instantResponderQueue[0] !== a.playerId) throw new Error('not your turn to respond');

  s.instantResponderQueue.shift();
  const next = s.instantResponderQueue[0];
  if (!next) {
    finalizeRoundScoring(s);
    return;
  }
  s.activePlayerId = next;
}

function handleSubmitSuddenDeathPick(s: HldState, a: Extract<HldAction, { type: 'submitSuddenDeathPick' }>) {
  if (s.subPhase !== 'suddenDeath') throw new Error('not in Sudden Death');
  if (!s.suddenDeathPlayers.includes(a.playerId)) throw new Error('not in Sudden Death tiebreaker');
  if (s.pendingPicks[a.playerId]) throw new Error('already submitted Sudden Death card');

  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex((c) => c.id === a.cardId && c.type === 'point');
  if (idx < 0) throw new Error('must pick a Point card');
  const [card] = hand.splice(idx, 1);
  s.pendingPicks[a.playerId] = card!;

  const next = nextUnpickedPlayer(s, s.suddenDeathPlayers);
  if (next) {
    s.activePlayerId = next;
    return;
  }

  // All Sudden Death players picked — compare pure Point card values!
  const sdVals: Record<PlayerId, number> = {};
  let minVal = Infinity;
  for (const id of s.suddenDeathPlayers) {
    const c = s.pendingPicks[id];
    const v = c?.value ?? 0;
    sdVals[id] = v;
    minVal = Math.min(minVal, v);
    if (c) s.discard.push(c);
    s.pendingPicks[id] = null;
  }
  const lowest = s.suddenDeathPlayers.filter((id) => sdVals[id] === minVal);
  if (lowest.length > 1 && lowest.every((id) => handOf(s, id).some((c) => c.type === 'point'))) {
    s.suddenDeathPlayers = lowest;
    s.activePlayerId = nextUnpickedPlayer(s, lowest);
    return;
  }
  const loser = lowest.find((id) => !handOf(s, id).some((c) => c.type === 'point')) ?? lowest[0]!;
  assignPendingDisaster(s, loser);
}

function handlePlayDisasterSave(s: HldState, a: Extract<HldAction, { type: 'playDisasterSave' }>) {
  if (s.subPhase !== 'awaitingDisasterSave') throw new Error('not awaiting disaster save');
  if (a.playerId !== s.pendingDisasterVictimId) throw new Error('not the disaster victim');

  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex(
    (c) => c.id === a.cardId && (c.kind === 'disaster-insurance' || c.kind === 'disaster-redirect'),
  );
  if (idx < 0) throw new Error('card not in hand');
  const [card] = hand.splice(idx, 1);
  s.discard.push(card!);

  if (card!.kind === 'disaster-insurance') {
    if (s.currentDisaster) s.disasterDeck.push(s.currentDisaster);
    s.currentDisaster = null;
    s.pendingDisasterVictimId = null;
    pushLog(s, a.playerId, `🛡️ ${seatName(s, a.playerId)} played Disaster Insurance and dodged the Disaster!`, 'good');
    endRoundCleanup(s);
    return;
  }

  // Disaster Redirect!
  const target = a.targetPlayerId;
  if (!target || target === a.playerId || !isLive(s, target)) {
    throw new Error('must choose another live player for Disaster Redirect');
  }
  pushLog(s, a.playerId, `↩️ ${seatName(s, a.playerId)} played Disaster Redirect onto ${seatName(s, target)}!`, 'danger');
  assignPendingDisaster(s, target);
}

function handleDeclineDisasterSave(s: HldState, a: Extract<HldAction, { type: 'declineDisasterSave' }>) {
  if (s.subPhase !== 'awaitingDisasterSave') throw new Error('not awaiting disaster save');
  if (a.playerId !== s.pendingDisasterVictimId) throw new Error('not the disaster victim');

  inflictDisaster(s, a.playerId);
}

// ============================================================================
// Entry point
// ============================================================================

export function applyAction(state: HldState, action: HldAction): HldState {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  const s = clone(state);

  switch (action.type) {
    case 'chooseDino':
      handleChooseDino(s, action);
      break;
    case 'submitPick':
      handleSubmitPick(s, action);
      break;
    case 'resolvePrompt':
      handleResolvePrompt(s, action);
      break;
    case 'playScoringInstant':
      handlePlayScoringInstant(s, action);
      break;
    case 'declineScoringInstant':
      handleDeclineScoringInstant(s, action);
      break;
    case 'submitSuddenDeathPick':
      handleSubmitSuddenDeathPick(s, action);
      break;
    case 'playDisasterSave':
      handlePlayDisasterSave(s, action);
      break;
    case 'declineDisasterSave':
      handleDeclineDisasterSave(s, action);
      break;
    default: {
      const never: never = action;
      throw new Error(`unknown action ${JSON.stringify(never)}`);
    }
  }

  return s;
}
