// Happy Little Dinosaurs — pure deterministic reducer for Base Game + all 4 Expansions.

import { createRng, rngInt, shuffle } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import { buildHldDecks, HLD_DINO_DEFS } from './cards';
import type {
  HldAction,
  HldCard,
  HldCardKind,
  HldConfig,
  HldDinoId,
  HldDisasterCard,
  HldHazardCard,
  HldState,
} from './types';
import { cloneState, isLive, livePlayerIds, pushLog, seatName } from '@/core/state';


const SCORING_INSTANT_KINDS: readonly HldCardKind[] = [
  'score-booster',
  'score-sapper',
  'score-inversion',
  'bffs-help',
  'frenemys-curse',
  'joy-of-puberty',
  'spiteful-bullying',
  'awkward-first-kiss',
  'baby-pictures',
  'double-date',
  'one-week-anniversary',
  'roadblock',
];

const DISASTER_SAVE_INSTANT_KINDS: readonly HldCardKind[] = [
  'disaster-insurance',
  'disaster-redirect',
  'lucky-break',
  'crippling-shyness',
  'detour',
];

// ============================================================================
// Setup
// ============================================================================

export function createInitialState(config: HldConfig, seed: number, seats: Seat[]): HldState {
  const rngState = createRng(seed);
  const first = seats[0];
  if (!first) throw new Error('Happy Little Dinosaurs needs at least one seat');

  const { disasterDeck, deck, hazardDeck } = buildHldDecks(rngState, config.expansions);
  const dinos: Record<PlayerId, HldDinoId> = {};
  seats.forEach((s, i) => {
    const chosen = config.dinoSelections?.[s.id];
    const valid = chosen && HLD_DINO_DEFS.some((d) => d.id === chosen);
    dinos[s.id] = valid ? chosen : HLD_DINO_DEFS[i % HLD_DINO_DEFS.length]!.id;
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

    hazardDeck,
    hazardDiscard: [],
    hazardAreas: Object.fromEntries(seats.map((s) => [s.id, []])),

    deck,
    discard: [],
    hands: Object.fromEntries(seats.map((s) => [s.id, []])),

    pendingPicks: Object.fromEntries(seats.map((s) => [s.id, null])),
    revealedPicks: Object.fromEntries(seats.map((s) => [s.id, null])),

    pointEffectBonuses: Object.fromEntries(seats.map((s) => [s.id, 0])),
    instantScoreDeltas: Object.fromEntries(seats.map((s) => [s.id, 0])),
    scoreInversionsPlayed: 0,
    instantScoreSwaps: [],

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

export function handOf(s: HldState, id: PlayerId): HldCard[] {
  const h = s.hands[id];
  if (!h) throw new Error(`unknown hand ${id}`);
  return h;
}

export function hazardScorePenalty(s: HldState, playerId: PlayerId): number {
  const hazards = s.hazardAreas?.[playerId] ?? [];
  let delta = 0;
  for (const h of hazards) {
    if (h.penalty === 'score-minus-1') delta -= 1;
    else if (h.penalty === 'score-minus-2') delta -= 2;
  }
  return delta;
}

function maxHandRefillSize(s: HldState, playerId: PlayerId): number {
  const hazards = s.hazardAreas?.[playerId] ?? [];
  let cap = 5;
  for (const h of hazards) {
    if (h.penalty === 'hand-size-minus-1') cap -= 1;
  }
  return Math.max(2, cap);
}

function hasNoInstantsHazard(s: HldState, playerId: PlayerId): boolean {
  const hazards = s.hazardAreas?.[playerId] ?? [];
  return hazards.some((h) => h.penalty === 'no-instants');
}

export function dinoTraitDelta(s: HldState, playerId: PlayerId): number {
  const disaster = s.currentDisaster;
  if (!disaster) return 0;
  const dinoId = s.dinos[playerId];
  const def = HLD_DINO_DEFS.find((d) => d.id === dinoId);
  if (!def) return 0;

  const ignorePlus = (s.hazardAreas?.[playerId] ?? []).some((h) => h.penalty === 'ignore-dino-plus');

  if (disaster.category === 'meteor') {
    // Meteor acts as all 3 categories (and triggers Stego's +1 on Meteor)
    if (def.plusCategory === 'meteor') return ignorePlus ? 0 : 1;
    // For Dinosaurs with +1 on one category and -1 on another, Meteor triggers both (+1 - 1 = 0, or -1 if +1 ignored)
    return ignorePlus && def.minusCategory ? -1 : 0;
  }

  if (def.plusCategory === disaster.category) return ignorePlus ? 0 : 1;
  if (def.minusCategory === disaster.category) return -1;
  return 0;
}

function isChainsawActive(s: HldState): boolean {
  for (const id of livePlayerIds(s)) {
    if (s.revealedPicks[id]?.kind === 'flaming-chainsaw') return true;
  }
  return false;
}

function starFruitMultiplier(s: HldState): number {
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
 * Compute each live player's score for the current round, including Hazard penalties,
 * Spiteful Bullying / Awkward First Kiss pairwise swaps, and Mouth Trap / Score Inversion swaps.
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
    const hazPenalty = hazardScorePenalty(s, id);
    raw[id] = base + trait + ptBonus + instBonus + hazPenalty;
  }

  for (const [p1, p2] of s.instantScoreSwaps ?? []) {
    if (raw[p1] !== undefined && raw[p2] !== undefined) {
      const tmp = raw[p1]!;
      raw[p1] = raw[p2]!;
      raw[p2] = tmp;
    }
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

function drawOneHazardCard(s: HldState): HldHazardCard | null {
  if (s.hazardDeck.length === 0 && s.hazardDiscard.length > 0) {
    s.hazardDeck = shuffle(s.rngState, s.hazardDiscard);
    s.hazardDiscard = [];
  }
  return s.hazardDeck.shift() ?? null;
}

function refillHandsTo5WithPointCard(s: HldState) {
  for (const id of livePlayerIds(s)) {
    const hand = handOf(s, id);
    const targetSize = maxHandRefillSize(s, id);
    while (hand.length < targetSize) {
      const c = drawOneCard(s);
      if (!c) break;
      hand.push(c);
    }
    // Rulebook: if a player has no Point cards in hand, discard hand and draw new cards
    let attempts = 0;
    while (!hand.some((c) => c.type === 'point') && attempts < 5) {
      attempts++;
      s.discard.push(...hand);
      hand.length = 0;
      for (let i = 0; i < targetSize; i++) {
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
  s.instantScoreSwaps = [];
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

function findTopDiscardPointCard(s: HldState): HldCard | null {
  for (let i = s.discard.length - 1; i >= 0; i--) {
    const c = s.discard[i];
    if (c && c.type === 'point') return c;
  }
  return null;
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
      } else if (card.kind === 'cold-feet') {
        const topDiscardPt = findTopDiscardPointCard(s);
        if (topDiscardPt) {
          s.promptQueue.push({
            kind: 'coldFeetSwap',
            playerId: id,
            topDiscardPointCardId: topDiscardPt.id,
          });
        }
      } else if (
        (card.kind === 'dino-grabber' || card.kind === 'bouquet-of-flowers') &&
        live.some((o) => o !== id && handOf(s, o).length > 0)
      ) {
        s.promptQueue.push({ kind: 'dinoGrabberSteal', playerId: id });
      } else if (card.kind === 'grappling-snake') {
        const neighbors = adjacentSwapTargets(s, id);
        if (neighbors.length > 0) {
          s.promptQueue.push({ kind: 'grapplingSnakeSwap', playerId: id, validNeighbors: neighbors });
        }
      } else if (card.kind === 'love-bug') {
        const drawn = drawOneCard(s);
        if (drawn) handOf(s, id).push(drawn);
        s.pointEffectBonuses[id] = (s.pointEffectBonuses[id] ?? 0) + 1;
        pushLog(s, id, `Love Bug: ${seatName(s, id)} drew a card and gained +1 score this round.`, 'good');
      } else if (
        card.kind === 'delicious-smoothie' &&
        handOf(s, id).some((c) => c.type === 'point' && c.hasEffect)
      ) {
        s.promptQueue.push({ kind: 'petRockDiscard', playerId: id, smoothieOnlyEffects: true });
      } else if (card.kind === 'fire-spray' && handOf(s, id).length > 0) {
        s.promptQueue.push({ kind: 'fireSprayDiscard', playerId: id });
      } else if (
        card.kind === 'unwanted-lunch' &&
        handOf(s, id).length > 0 &&
        live.some((o) => o !== id)
      ) {
        s.promptQueue.push({ kind: 'unwantedLunchSwap', playerId: id });
      } else if (
        card.kind === 'caution-sign' &&
        (s.hazardAreas[id]?.length ?? 0) > 0 &&
        live.some((o) => o !== id)
      ) {
        s.promptQueue.push({ kind: 'removeHazardPick', playerId: id, canTransferToOpponent: true });
      } else if (card.kind === 'ice-cream') {
        const disCount = s.disasterAreas[id]?.length ?? 0;
        if (disCount > 0) {
          s.pointEffectBonuses[id] = (s.pointEffectBonuses[id] ?? 0) + disCount;
          pushLog(s, id, `Ice Cream!: ${seatName(s, id)} gained +${disCount} from their Disasters!`, 'good');
        }
      } else if (card.kind === 'bedazzled-belt') {
        if (dinoTraitDelta(s, id) > 0) {
          s.pointEffectBonuses[id] = (s.pointEffectBonuses[id] ?? 0) + 2;
          pushLog(s, id, `Bedazzled Belt: ${seatName(s, id)} gained +2 for matching Dinosaur specialty!`, 'good');
        }
      } else if (
        (card.kind === 'molotov-crocktail' || card.kind === 'suck-up') &&
        (s.hazardAreas[id]?.length ?? 0) > 0
      ) {
        s.promptQueue.push({ kind: 'removeHazardPick', playerId: id, canTransferToOpponent: false });
      } else if (card.kind === 'handy-backpack') {
        const c1 = drawOneCard(s);
        const c2 = drawOneCard(s);
        if (c1) handOf(s, id).push(c1);
        if (c2) handOf(s, id).push(c2);
        pushLog(s, id, `Handy Backpack: ${seatName(s, id)} drew 2 cards.`, 'good');
      } else if (card.kind === 'treenoculars' || card.kind === 'box-of-chocolates') {
        const top2: HldCard[] = [];
        const c1 = drawOneCard(s);
        const c2 = drawOneCard(s);
        if (c1) top2.push(c1);
        if (c2) top2.push(c2);
        if (top2.length > 0) {
          s.promptQueue.push({ kind: 'treenocularsPick', playerId: id, cards: top2 });
        }
      } else if (card.kind === 'trash-into-treasure' && s.discard.some((c) => c.type === 'point')) {
        s.promptQueue.push({ kind: 'trashIntoTreasurePick', playerId: id });
      } else if (card.kind === 'hungry-plant' && live.length >= 2) {
        s.promptQueue.push({ kind: 'hungryPlantSwap', playerId: id });
      } else if (card.kind === 'really-thick-glasses') {
        const c1 = drawOneCard(s);
        if (c1) handOf(s, id).push(c1);
        s.pointEffectBonuses[id] = (s.pointEffectBonuses[id] ?? 0) + 1;
        pushLog(s, id, `Really Thick Glasses: ${seatName(s, id)} drew 1 card and gained +1 score.`, 'good');
      } else if (card.kind === 'extra-sharp-stick') {
        s.pointEffectBonuses[id] = (s.pointEffectBonuses[id] ?? 0) + 1;
        pushLog(s, id, `Extra Sharp Stick: ${seatName(s, id)} gained +1 score.`, 'good');
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

export function canPlayScoringInstantCard(s: HldState, playerId: PlayerId, card: HldCard): boolean {
  if (hasNoInstantsHazard(s, playerId)) return false;
  if (!SCORING_INSTANT_KINDS.includes(card.kind)) return false;
  if (card.kind === 'bffs-help') {
    return handOf(s, playerId).some((c) => c.type === 'point');
  }
  return true;
}

function hasScoringInstant(s: HldState, playerId: PlayerId): boolean {
  if (hasNoInstantsHazard(s, playerId)) return false;
  return handOf(s, playerId).some((c) => canPlayScoringInstantCard(s, playerId, c));
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

  // Official 5–6 Player Rule: When 5 or 6 players are in the game (s.seats.length >= 5),
  // if only 1 player has the highest score and the 2nd-highest score is not tied for lowest,
  // the 2nd-highest-scoring player(s) also collect points equal to their respective scores!
  if (s.seats.length >= 5 && winners.length === 1) {
    const remaining = live.filter((id) => scores[id] !== maxScore);
    if (remaining.length > 0) {
      const secondMaxScore = Math.max(...remaining.map((id) => scores[id]!));
      if (secondMaxScore > minScore) {
        const secondWinners = remaining.filter((id) => scores[id] === secondMaxScore);
        for (const sw of secondWinners) {
          const gain = Math.max(0, secondMaxScore);
          s.trackPosition[sw] = (s.trackPosition[sw] ?? 0) + gain;
          pushLog(
            s,
            sw,
            `${seatName(s, sw)} had the 2nd-highest score (${secondMaxScore}) and moved +${gain} on their Escape Route!`,
            'good',
          );
        }
      }
    }
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

export function canPlayDisasterSaveCard(s: HldState, playerId: PlayerId, card: HldCard): boolean {
  if (!DISASTER_SAVE_INSTANT_KINDS.includes(card.kind)) return false;
  if (card.kind === 'lucky-break') {
    return handOf(s, playerId).some((c) => c.type === 'point');
  }
  return true;
}

function assignPendingDisaster(s: HldState, victimId: PlayerId) {
  s.pendingDisasterVictimId = victimId;
  const canSave = handOf(s, victimId).some((c) => canPlayDisasterSaveCard(s, victimId, c));
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
    } else if (disaster.drawsHazard) {
      const hazard = drawOneHazardCard(s);
      if (hazard) {
        s.hazardAreas[victimId]!.push(hazard);
        pushLog(
          s,
          victimId,
          `⚠️ ${seatName(s, victimId)} also drew a Hazard card: ${hazard.name} (${hazard.text})!`,
          'danger',
        );
      }
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
            pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} took a card from ${seatName(s, a.targetPlayerId)}!`, 'good');
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

    case 'trashIntoTreasurePick': {
      if (!a.decline) {
        let idx = -1;
        if (a.targetCardId !== undefined) {
          idx = s.discard.findIndex((c) => c.id === a.targetCardId && c.type === 'point');
        }
        if (idx < 0) {
          for (let i = s.discard.length - 1; i >= 0; i--) {
            if (s.discard[i]?.type === 'point') {
              idx = i;
              break;
            }
          }
        }
        if (idx >= 0) {
          const [recovered] = s.discard.splice(idx, 1);
          if (recovered) {
            handOf(s, prompt.playerId).push(recovered);
            pushLog(
              s,
              prompt.playerId,
              `Trash into Treasure: ${seatName(s, prompt.playerId)} recovered ${recovered.name} from the discard pile!`,
              'good',
            );
          }
        }
      }
      break;
    }

    case 'unwantedLunchSwap': {
      if (
        !a.decline &&
        a.targetPlayerId &&
        a.targetPlayerId !== prompt.playerId &&
        isLive(s, a.targetPlayerId) &&
        a.targetCardId !== undefined
      ) {
        const myHand = handOf(s, prompt.playerId);
        const oppHand = handOf(s, a.targetPlayerId);
        const giveIdx = myHand.findIndex((c) => c.id === a.targetCardId);
        if (giveIdx >= 0) {
          const [given] = myHand.splice(giveIdx, 1);
          if (oppHand.length > 0) {
            const randIdx = rngInt(s.rngState, oppHand.length);
            const [stolen] = oppHand.splice(randIdx, 1);
            if (stolen) myHand.push(stolen);
          }
          if (given) oppHand.push(given);
          pushLog(
            s,
            prompt.playerId,
            `Unwanted Lunch: ${seatName(s, prompt.playerId)} traded a card with ${seatName(s, a.targetPlayerId)}!`,
            'normal',
          );
        }
      }
      break;
    }

    case 'coldFeetSwap': {
      if (!a.decline) {
        let idx = s.discard.findIndex(
          (c) => c.id === prompt.topDiscardPointCardId && c.type === 'point',
        );
        if (idx < 0) {
          for (let i = s.discard.length - 1; i >= 0; i--) {
            if (s.discard[i]?.type === 'point') {
              idx = i;
              break;
            }
          }
        }
        const currentCard = s.revealedPicks[prompt.playerId];
        if (idx >= 0 && currentCard) {
          const [fromDiscard] = s.discard.splice(idx, 1, currentCard);
          if (fromDiscard) {
            s.revealedPicks[prompt.playerId] = fromDiscard;
            pushLog(
              s,
              prompt.playerId,
              `Cold Feet: ${seatName(s, prompt.playerId)} swapped Cold Feet with ${fromDiscard.name} from the discard pile!`,
              'good',
            );
          }
        }
      }
      break;
    }

    case 'removeHazardPick': {
      if (!a.decline) {
        const myHazards = s.hazardAreas[prompt.playerId] ?? [];
        if (myHazards.length > 0) {
          let idx =
            a.targetCardId !== undefined
              ? myHazards.findIndex((h) => h.id === a.targetCardId)
              : 0;
          if (idx < 0) idx = 0;
          const [removed] = myHazards.splice(idx, 1);
          if (removed) {
            if (
              prompt.canTransferToOpponent &&
              a.targetPlayerId &&
              a.targetPlayerId !== prompt.playerId &&
              isLive(s, a.targetPlayerId)
            ) {
              s.hazardAreas[a.targetPlayerId]!.push(removed);
              pushLog(
                s,
                prompt.playerId,
                `Caution Sign: ${seatName(s, prompt.playerId)} moved Hazard ${removed.name} to ${seatName(s, a.targetPlayerId)}!`,
                'danger',
              );
            } else {
              s.hazardDiscard.push(removed);
              pushLog(
                s,
                prompt.playerId,
                `🧹 ${seatName(s, prompt.playerId)} removed Hazard ${removed.name} from their Hazard Area!`,
                'good',
              );
            }
          }
        }
      }
      break;
    }
  }

  advanceFromPointEffects(s);
}

function handlePlayScoringInstant(s: HldState, a: Extract<HldAction, { type: 'playScoringInstant' }>) {
  if (s.subPhase !== 'awaitingScoringInstants') throw new Error('not in scoring instant window');
  if (hasNoInstantsHazard(s, a.playerId)) throw new Error('Panic Attack Hazard prevents playing Scoring Instants');

  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex((c) => c.id === a.cardId && canPlayScoringInstantCard(s, a.playerId, c));
  if (idx < 0) throw new Error('Scoring Instant card not in hand or not playable');
  const [card] = hand.splice(idx, 1);
  s.discard.push(card!);

  const live = livePlayerIds(s);

  switch (card!.kind) {
    case 'score-booster': {
      const target = a.targetPlayerId ?? a.playerId;
      s.instantScoreDeltas[target] = (s.instantScoreDeltas[target] ?? 0) + 2;
      pushLog(s, a.playerId, `${seatName(s, a.playerId)} played Score Booster on ${seatName(s, target)} (+2)!`, 'good');
      break;
    }
    case 'score-sapper':
    case 'baby-pictures': {
      const target = a.targetPlayerId ?? live.find((id) => id !== a.playerId) ?? a.playerId;
      s.instantScoreDeltas[target] = (s.instantScoreDeltas[target] ?? 0) - 2;
      pushLog(
        s,
        a.playerId,
        `${seatName(s, a.playerId)} played ${card!.name} on ${seatName(s, target)} (-2)!`,
        'danger',
      );
      break;
    }
    case 'score-inversion': {
      s.scoreInversionsPlayed += 1;
      pushLog(s, a.playerId, `${seatName(s, a.playerId)} played Score Inversion!`, 'danger');
      break;
    }
    case 'bffs-help': {
      const target = a.targetPlayerId ?? a.playerId;
      const ptCards = hand.filter((c) => c.type === 'point');
      ptCards.sort((x, y) => (y.value ?? 0) - (x.value ?? 0));
      const revealedHandCard =
        (a.handCardId !== undefined ? ptCards.find((c) => c.id === a.handCardId) : undefined) ??
        ptCards[0];
      const bonus = revealedHandCard?.value ?? 0;
      s.instantScoreDeltas[target] = (s.instantScoreDeltas[target] ?? 0) + bonus;
      pushLog(
        s,
        a.playerId,
        `${seatName(s, a.playerId)} played BFF's Help showing ${revealedHandCard?.name ?? 'a Point card'} (+${bonus} to ${seatName(s, target)})!`,
        'good',
      );
      break;
    }
    case 'frenemys-curse': {
      const curScores = computeRoundScores(s);
      const maxVal = Math.max(...live.map((id) => curScores[id]!));
      const highestPlayers = live.filter((id) => curScores[id] === maxVal);
      const target =
        a.targetPlayerId && highestPlayers.includes(a.targetPlayerId)
          ? a.targetPlayerId
          : highestPlayers[0] ?? a.playerId;
      s.instantScoreDeltas[target] = (s.instantScoreDeltas[target] ?? 0) - 3;
      pushLog(
        s,
        a.playerId,
        `${seatName(s, a.playerId)} played Frenemy's Curse on highest scorer ${seatName(s, target)} (-3)!`,
        'danger',
      );
      break;
    }
    case 'joy-of-puberty': {
      const disCount = s.disasterAreas[a.playerId]?.length ?? 0;
      const gain = disCount * 2;
      s.instantScoreDeltas[a.playerId] = (s.instantScoreDeltas[a.playerId] ?? 0) + gain;
      pushLog(
        s,
        a.playerId,
        `${seatName(s, a.playerId)} played Joy of Puberty (+${gain} from ${disCount} Disasters)!`,
        'good',
      );
      break;
    }
    case 'spiteful-bullying': {
      const p1 = a.targetPlayerId ?? a.playerId;
      const p2 = a.secondPlayerId ?? live.find((id) => id !== p1) ?? p1;
      if (p1 !== p2 && isLive(s, p1) && isLive(s, p2)) {
        s.instantScoreSwaps.push([p1, p2]);
        pushLog(
          s,
          a.playerId,
          `${seatName(s, a.playerId)} played Spiteful Bullying to swap ${seatName(s, p1)} and ${seatName(s, p2)}'s scores!`,
          'danger',
        );
      }
      break;
    }
    case 'awkward-first-kiss': {
      const other =
        a.targetPlayerId && a.targetPlayerId !== a.playerId
          ? a.targetPlayerId
          : live.find((id) => id !== a.playerId);
      if (other && isLive(s, other)) {
        s.instantScoreSwaps.push([a.playerId, other]);
        pushLog(
          s,
          a.playerId,
          `${seatName(s, a.playerId)} played Awkward First Kiss to swap scores with ${seatName(s, other)}!`,
          'danger',
        );
      }
      break;
    }
    case 'double-date': {
      const p1 = a.targetPlayerId ?? a.playerId;
      const p2 =
        a.secondPlayerId && a.secondPlayerId !== p1
          ? a.secondPlayerId
          : live.find((id) => id !== p1);
      s.instantScoreDeltas[p1] = (s.instantScoreDeltas[p1] ?? 0) + 2;
      if (p2) {
        s.instantScoreDeltas[p2] = (s.instantScoreDeltas[p2] ?? 0) + 2;
        pushLog(
          s,
          a.playerId,
          `${seatName(s, a.playerId)} played Double Date (+2 to ${seatName(s, p1)} and +2 to ${seatName(s, p2)})!`,
          'good',
        );
      } else {
        pushLog(s, a.playerId, `${seatName(s, a.playerId)} played Double Date (+2 to ${seatName(s, p1)})!`, 'good');
      }
      break;
    }
    case 'one-week-anniversary': {
      const target = a.targetPlayerId ?? a.playerId;
      s.instantScoreDeltas[target] = (s.instantScoreDeltas[target] ?? 0) + 3;
      pushLog(
        s,
        a.playerId,
        `${seatName(s, a.playerId)} played One Week Anniversary on ${seatName(s, target)} (+3)!`,
        'good',
      );
      break;
    }
    case 'roadblock': {
      const target = a.targetPlayerId ?? live.find((id) => id !== a.playerId) ?? a.playerId;
      const penalty = 2 + (s.hazardAreas[target]?.length ?? 0);
      s.instantScoreDeltas[target] = (s.instantScoreDeltas[target] ?? 0) - penalty;
      pushLog(
        s,
        a.playerId,
        `${seatName(s, a.playerId)} played Roadblock on ${seatName(s, target)} (-${penalty})!`,
        'danger',
      );
      break;
    }
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
  const idx = hand.findIndex((c) => c.id === a.cardId && canPlayDisasterSaveCard(s, a.playerId, c));
  if (idx < 0) throw new Error('card not in hand or not playable');
  const [card] = hand.splice(idx, 1);
  s.discard.push(card!);

  if (card!.kind === 'disaster-insurance' || card!.kind === 'crippling-shyness') {
    if (s.currentDisaster) s.disasterDeck.push(s.currentDisaster);
    s.currentDisaster = null;
    s.pendingDisasterVictimId = null;
    pushLog(s, a.playerId, `🛡️ ${seatName(s, a.playerId)} played ${card!.name} and dodged the Disaster!`, 'good');
    endRoundCleanup(s);
    return;
  }

  if (card!.kind === 'lucky-break') {
    const ptIdx =
      a.discardCardId !== undefined
        ? hand.findIndex((c) => c.id === a.discardCardId && c.type === 'point')
        : hand.findIndex((c) => c.type === 'point');
    if (ptIdx < 0) throw new Error('Lucky Break requires discarding a Point card from your hand');
    const [discardedPt] = hand.splice(ptIdx, 1);
    if (discardedPt) s.discard.push(discardedPt);
    if (s.currentDisaster) s.disasterDeck.push(s.currentDisaster);
    s.currentDisaster = null;
    s.pendingDisasterVictimId = null;
    pushLog(
      s,
      a.playerId,
      `🍀 ${seatName(s, a.playerId)} played Lucky Break (discarding ${discardedPt?.name ?? 'a Point card'}) and dodged the Disaster!`,
      'good',
    );
    endRoundCleanup(s);
    return;
  }

  if (card!.kind === 'detour') {
    if (s.currentDisaster) s.disasterDeck.push(s.currentDisaster);
    s.currentDisaster = null;
    s.pendingDisasterVictimId = null;
    const removedHaz = s.hazardAreas[a.playerId]?.shift();
    if (removedHaz) s.hazardDiscard.push(removedHaz);
    pushLog(
      s,
      a.playerId,
      `🚧 ${seatName(s, a.playerId)} played Detour to dodge the Disaster${removedHaz ? ` and removed Hazard ${removedHaz.name}` : ''}!`,
      'good',
    );
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
  const s = cloneState(state);

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
