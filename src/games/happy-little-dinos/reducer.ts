// Happy Little Dinosaurs — pure deterministic reducer for Base Game + all 4 Expansions.
//
// A round (official rulesheet): flip a Disaster → everyone picks a Point card face-down → reveal →
// Point card effects ("During this round" first, then lowest value first; ties → fewest Escape Route
// points → seat order, standing in for "youngest") → Instants "during scoring" → the highest score
// collects points (top two at 5–6 players), the lowest takes the Disaster (ties → Sudden Death; all tied
// → nobody) → +1 space per Disaster held → draw back to 5.
//
// Ongoing effects ("During scoring this round", Dinosaur Traits, Cold Feet, Behemoth Blade…) are read off
// the cards on the table each time — never stored as flags. One-shot effects that already happened
// (Pet Rock's discard, an Instant played) are kept as records and folded into the scores on read.

import { createRng, shuffle } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import { availableDinos, buildHldDecks, HLD_DINO_DEFS } from './cards';
import type {
  HldAction,
  HldCard,
  HldCardKind,
  HldConfig,
  HldDinoId,
  HldDisasterCard,
  HldInstantPlay,
  HldPrompt,
  HldState,
  HldTraitKey,
} from './types';
import { cloneState, isLive, livePlayerIds, pushLog, seatName } from '@/core/state';

const HAND_SIZE = 5;

/** Instants played "during scoring". (Hazard Redirect answers a Hazard token, which is not modeled.) */
const SCORING_INSTANT_KINDS: readonly HldCardKind[] = [
  'score-booster',
  'score-sapper',
  'score-inversion',
  'helping-hand',
  'bffs-help',
  'frenemys-curse',
  'joy-of-puberty',
  'spiteful-bullying',
  'baby-pictures',
  'crippling-shyness',
  'double-date',
  'one-week-anniversary',
];

/** Instants played "if you would add a Disaster card to your Disaster Area this round". */
const DISASTER_SAVE_INSTANT_KINDS: readonly HldCardKind[] = [
  'disaster-insurance',
  'disaster-redirect',
  'lucky-break',
  'awkward-first-kiss',
];

/** Scoring Instants that need a target player. */
export const TARGETED_INSTANTS: readonly HldCardKind[] = [
  'score-booster',
  'score-sapper',
  'bffs-help',
  'frenemys-curse',
  'joy-of-puberty',
  'spiteful-bullying',
  'baby-pictures',
];

// ============================================================================
// Setup
// ============================================================================

/** True when the rulesheet's suggested 2-player rules are in force. */
export function twoPlayerRules(s: { seats: readonly Seat[]; config: HldConfig }): boolean {
  return s.seats.length === 2 && s.config.twoPlayerVariant !== false;
}

/** Give each seat its chosen board when it's available and untaken, else the first free one. */
export function assignDinos(config: HldConfig, seats: readonly Seat[]): Record<PlayerId, HldDinoId> {
  const pool = availableDinos(config.expansions);
  const taken = new Set<HldDinoId>();
  const out: Record<PlayerId, HldDinoId> = {};
  for (const seat of seats) {
    const want = config.dinoSelections?.[seat.id];
    if (want && pool.some((d) => d.id === want) && !taken.has(want)) {
      out[seat.id] = want;
      taken.add(want);
    }
  }
  for (const seat of seats) {
    if (out[seat.id]) continue;
    const free = pool.find((d) => !taken.has(d.id)) ?? HLD_DINO_DEFS.find((d) => !taken.has(d.id)) ?? HLD_DINO_DEFS[0]!;
    out[seat.id] = free.id;
    taken.add(free.id);
  }
  return out;
}

export function createInitialState(config: HldConfig, seed: number, seats: Seat[]): HldState {
  const rngState = createRng(seed);
  const first = seats[0];
  if (!first) throw new Error('Happy Little Dinosaurs needs at least one seat');

  const twoP = seats.length === 2 && config.twoPlayerVariant !== false;
  const { disasterDeck, deck } = buildHldDecks(rngState, config.expansions, { removeLowPointCards: twoP });
  const per = <T,>(v: () => T): Record<PlayerId, T> => Object.fromEntries(seats.map((s) => [s.id, v()]));

  const state: HldState = {
    phase: 'playing',
    seats,
    activePlayerId: first.id,
    finalScores: null,
    rngState,

    subPhase: 'selecting',
    dinos: assignDinos(config, seats),
    disasterDeck,
    disasterDiscard: [],
    currentDisaster: null,

    deck,
    discard: [],
    hands: per(() => []),

    pendingPicks: per(() => null),
    revealedPicks: per(() => null),
    usedEffectCardIds: [],

    pointEffectBonuses: per(() => 0),
    instantPlays: [],
    skippedDisasterBonus: [],
    roundScores: null,

    promptQueue: [],
    resumeAt: 'pointEffects',
    instantResponderQueue: [],
    suddenDeathPlayers: [],
    pendingDisasterVictimId: null,

    disasterAreas: per(() => []),
    trackPosition: per(() => 0),
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
// Helpers
// ============================================================================

export function handOf(s: HldState, id: PlayerId): HldCard[] {
  const h = s.hands[id];
  if (!h) throw new Error(`unknown hand ${id}`);
  return h;
}

const hasPointCard = (s: HldState, id: PlayerId) => handOf(s, id).some((c) => c.type === 'point');

function drawOneCard(s: HldState): HldCard | null {
  if (s.deck.length === 0 && s.discard.length > 0) {
    s.deck = shuffle(s.rngState, s.discard);
    s.discard = [];
  }
  return s.deck.shift() ?? null;
}

function drawCards(s: HldState, n: number): HldCard[] {
  const out: HldCard[] = [];
  for (let i = 0; i < n; i++) {
    const c = drawOneCard(s);
    if (!c) break;
    out.push(c);
  }
  return out;
}

/** "Collect points" — move forward on the Escape Route. */
function collect(s: HldState, id: PlayerId, n: number) {
  if (n <= 0) return;
  s.trackPosition[id] = (s.trackPosition[id] ?? 0) + n;
}

/** Move backward on the Escape Route (never below the start). */
function moveBack(s: HldState, id: PlayerId, n: number) {
  s.trackPosition[id] = Math.max(0, (s.trackPosition[id] ?? 0) - n);
}

function takeFromHand(s: HldState, id: PlayerId, cardId: number, pred: (c: HldCard) => boolean = () => true): HldCard | null {
  const hand = handOf(s, id);
  const idx = hand.findIndex((c) => c.id === cardId && pred(c));
  if (idx < 0) return null;
  return hand.splice(idx, 1)[0] ?? null;
}

function nextUnpickedPlayer(s: HldState, pool: PlayerId[]): PlayerId | null {
  const unpicked = pool.filter((id) => !s.pendingPicks[id]);
  if (unpicked.length === 0) return null;
  // Park activePlayerId on AI seats first so GameHost's AI driver ticks them immediately
  const aiSeat = unpicked.find((id) => s.seats.find((st) => st.id === id)?.isAI);
  return aiSeat ?? unpicked[0] ?? null;
}

// ---- cards on the table, read live ---------------------------------------------------

const isChainsawActive = (s: HldState) =>
  livePlayerIds(s).some((id) => s.revealedPicks[id]?.kind === 'flaming-chainsaw');

/** Live players whose face-up Point card is `kind` and whose effect is not ignored (Flaming Chainsaw). */
function holdersOf(s: HldState, kind: HldCardKind): PlayerId[] {
  if (kind !== 'flaming-chainsaw' && isChainsawActive(s)) return [];
  return livePlayerIds(s).filter((id) => s.revealedPicks[id]?.kind === kind);
}

const holds = (s: HldState, id: PlayerId, kind: HldCardKind) => holdersOf(s, kind).includes(id);

/** Cold Feet ("During this round, you cannot play Instant cards") / Epic Flail. */
function cannotPlayInstants(s: HldState, id: PlayerId): boolean {
  return holds(s, id, 'cold-feet') || holds(s, id, 'epic-flail');
}

/** Behemoth Blade: "During scoring this round, no player may play Instant cards." */
const scoringInstantsBlocked = (s: HldState) => holdersOf(s, 'behemoth-blade').length > 0;

// ---- Disasters --------------------------------------------------------------------------

export interface EliminationRule {
  /** Disasters of one type that eliminate. */
  same: number;
  /** Disasters of each of the three types that eliminate. */
  each: number;
}

export function eliminationRule(s: { seats: readonly Seat[]; config: HldConfig }): EliminationRule {
  // 2-player rules: "four Disaster cards of the same type or two of each of the three types".
  return twoPlayerRules(s) ? { same: 4, each: 2 } : { same: 3, each: 1 };
}

const BASE_TYPES = ['natural', 'predator', 'emotional'] as const;

/**
 * Three of one type or three different types (four / two-of-each under the 2-player rules). A Meteor
 * acts as any type; "counts as 2" Disasters (Perils of Puberty) count twice toward their type.
 */
export function isEliminatedByDisasters(cards: readonly HldDisasterCard[], rule: EliminationRule = { same: 3, each: 1 }): boolean {
  const count = { natural: 0, predator: 0, emotional: 0 };
  let wild = 0;
  for (const c of cards) {
    const weight = c.effect === 'counts-double' ? 2 : 1;
    if (c.category === 'meteor') wild += weight;
    else if (c.category !== 'lucky') count[c.category] += weight;
  }
  if (BASE_TYPES.some((t) => count[t] + wild >= rule.same)) return true;
  const missing = BASE_TYPES.reduce((n, t) => n + Math.max(0, rule.each - count[t]), 0);
  return missing <= wild;
}

/** Which Dinosaur Trait the face-up Disaster triggers. A Meteor triggers only a Meteor trait (Stego). */
function traitKeyFor(d: HldDisasterCard): HldTraitKey | null {
  return d.category === 'lucky' ? null : d.category;
}

/** This round's Dinosaur Trait adjustment for `playerId`, with Minty Gum and Double Date applied. */
export function dinoTraitDelta(s: HldState, playerId: PlayerId): number {
  const disaster = s.currentDisaster;
  if (!disaster) return 0;
  const key = traitKeyFor(disaster);
  if (!key || key === 'hazard') return 0;
  const def = HLD_DINO_DEFS.find((d) => d.id === s.dinos[playerId]);
  let v = def?.traits[key] ?? 0;
  if (v === 0) return 0;
  // Minty Gum: "the advantages of your Dinosaur Traits are doubled."
  if (v > 0 && holds(s, playerId, 'minty-gum')) v *= 2;
  // Double Date: "The advantages and disadvantages of all Dinosaur Traits are doubled."
  const doubleDates = s.instantPlays.filter((p) => p.kind === 'double-date').length;
  return v * 2 ** doubleDates;
}

/** Dating Disasters' "you may add 1 point per [type] Disaster card in your Disaster Area" — before any skip. */
export function disasterScoringBonus(s: HldState, playerId: PlayerId): number {
  const area = s.disasterAreas[playerId] ?? [];
  let bonus = 0;
  for (const d of area) {
    if (d.effect === 'scoring-bonus') bonus += area.filter((x) => x.category === d.category).length;
  }
  return bonus;
}

// ============================================================================
// Scoring
// ============================================================================

/** How many score inversions (Mouth Trap, Score Inversion) are in effect this round. */
function inversionCount(s: HldState): number {
  return holdersOf(s, 'mouth-trap').length + s.instantPlays.filter((p) => p.kind === 'score-inversion').length;
}

/** A Score Booster / Score Sapper's effect: doubled by each Special Star Fruit, halved by another player's Swiss Shears. */
function boosterMultiplier(s: HldState, by: PlayerId): number {
  let m = 2 ** holdersOf(s, 'special-star-fruit').length;
  for (const h of holdersOf(s, 'swiss-shears')) if (h !== by) m /= 2;
  return m;
}

/**
 * Each live player's score this round: Point value + Dinosaur Trait + Point card effects + Instants,
 * then any inversions ("the scores of all players involved are inverted" when tied).
 * Once scoring is final the frozen `roundScores` are returned instead.
 */
export function computeRoundScores(s: HldState): Record<PlayerId, number> {
  if (s.roundScores) return { ...s.roundScores };
  const live = livePlayerIds(s);
  const raw: Record<PlayerId, number> = {};

  for (const id of live) {
    const card = s.revealedPicks[id];
    let v = (card?.value ?? 0) + dinoTraitDelta(s, id) + (s.pointEffectBonuses[id] ?? 0);
    // Handy Backpack: +2 per Disaster card in your Disaster Area.
    if (holds(s, id, 'handy-backpack')) v += 2 * (s.disasterAreas[id]?.length ?? 0);
    if (!s.skippedDisasterBonus.includes(id)) v += disasterScoringBonus(s, id);
    raw[id] = v;
  }

  for (const p of s.instantPlays) {
    const t = p.targetId;
    switch (p.kind) {
      case 'score-booster':
      case 'score-sapper':
        if (t && raw[t] !== undefined) raw[t] += (p.kind === 'score-booster' ? 2 : -2) * boosterMultiplier(s, p.by);
        break;
      case 'bffs-help':
        if (t && raw[t] !== undefined) raw[t] += 3;
        break;
      case 'frenemys-curse':
        if (t && raw[t] !== undefined) raw[t] -= 3;
        break;
      case 'joy-of-puberty':
        if (t && raw[t] !== undefined) raw[t] += p.amount ?? 0;
        break;
      case 'spiteful-bullying':
        if (t && raw[t] !== undefined) raw[t] -= p.amount ?? 0;
        break;
      case 'helping-hand':
        if (raw[p.by] !== undefined) raw[p.by] += p.amount ?? 0;
        break;
      default:
        break;
    }
  }

  // Love Bug: every other player −1 per Instant its holder played this round.
  for (const h of holdersOf(s, 'love-bug')) {
    const n = s.instantPlays.filter((p) => p.by === h).length;
    if (n === 0) continue;
    for (const id of live) if (id !== h) raw[id] = raw[id]! - n;
  }

  if (inversionCount(s) % 2 === 1 && live.length >= 2) {
    const vals = live.map((id) => raw[id]!);
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

// ============================================================================
// Round lifecycle
// ============================================================================

function refillHands(s: HldState) {
  for (const id of livePlayerIds(s)) {
    const hand = handOf(s, id);
    hand.push(...drawCards(s, HAND_SIZE - hand.length));
    // "If a player does not have any Point cards in their hand … discard their hand and draw 5 new
    // cards (and repeat the process until they have a Point card)." Bounded by the cards in circulation.
    let guard = s.deck.length + s.discard.length + hand.length + 1;
    while (!hand.some((c) => c.type === 'point') && hand.length > 0 && guard > 0) {
      guard -= hand.length;
      s.discard.push(...hand);
      hand.length = 0;
      hand.push(...drawCards(s, HAND_SIZE));
    }
  }
}

function startNextRound(s: HldState) {
  if (checkGameEnd(s)) return;

  s.roundNumber += 1;
  refillHands(s);

  if (s.disasterDeck.length === 0 && s.disasterDiscard.length > 0) {
    s.disasterDeck = shuffle(s.rngState, s.disasterDiscard);
    s.disasterDiscard = [];
  }
  const disaster = s.disasterDeck.shift() ?? {
    id: 9999 + s.roundNumber,
    name: 'Meteor!',
    category: 'meteor',
    text: 'This card acts as any type of Disaster card.',
  };
  s.currentDisaster = disaster;

  for (const seat of s.seats) {
    s.pendingPicks[seat.id] = null;
    s.revealedPicks[seat.id] = null;
    s.pointEffectBonuses[seat.id] = 0;
  }
  s.usedEffectCardIds = [];
  s.instantPlays = [];
  s.skippedDisasterBonus = [];
  s.roundScores = null;
  s.promptQueue = [];
  s.instantResponderQueue = [];
  s.suddenDeathPlayers = [];
  s.pendingDisasterVictimId = null;

  s.subPhase = 'selecting';
  s.activePlayerId = nextUnpickedPlayer(s, livePlayerIds(s));
  pushLog(s, null, `🌋 Round ${s.roundNumber}: the Disaster is ${disaster.name} (${disaster.category.toUpperCase()})!`, 'danger');
}

function revealAllPicks(s: HldState) {
  const live = livePlayerIds(s);
  for (const id of live) {
    s.revealedPicks[id] = s.pendingPicks[id] ?? null;
    s.pendingPicks[id] = null;
  }
  pushLog(s, null, `Revealed: ${live.map((id) => `${seatName(s, id)} ${s.revealedPicks[id]?.name ?? '—'} (${s.revealedPicks[id]?.value ?? 0})`).join(', ')}.`, 'normal');
  if (isChainsawActive(s)) pushLog(s, null, 'Flaming Chainsaw: every other Point card effect is ignored this round!', 'danger');
  s.resumeAt = 'pointEffects';
  continuePointEffects(s);
}

/** Point cards whose effect is used during the effects step (one decision each). */
const ACTIVE_EFFECT_KINDS: readonly HldCardKind[] = [
  'pet-rock',
  'dino-grabber',
  'grappling-snake',
  'delicious-smoothie',
  'fire-spray',
  'treenoculars',
  'hungry-plant',
  'good-luck-rod',
  'isopod-swap',
  'voodoo-dino',
  'trash-into-treasure',
  'unwanted-lunch',
  'really-thick-glasses',
  'bouquet-of-flowers',
  'a-bone-to-flick',
  'molotov-crocktail',
];

/**
 * The next face-up Point card whose effect is still to be used: lowest value first; ties → the player
 * with the fewest collected points; then seat order (the rulebook says "youngest player"). Read fresh
 * each time, so a card swapped onto someone else's table spot is used by whoever holds it then.
 */
function nextEffectCard(s: HldState): { holder: PlayerId; card: HldCard } | null {
  if (isChainsawActive(s)) return null;
  const live = livePlayerIds(s);
  const candidates = live
    .map((id, seatIdx) => ({ holder: id, card: s.revealedPicks[id], seatIdx }))
    .filter((x): x is { holder: PlayerId; card: HldCard; seatIdx: number } =>
      !!x.card && ACTIVE_EFFECT_KINDS.includes(x.card.kind) && !s.usedEffectCardIds.includes(x.card.id));
  candidates.sort((a, b) =>
    (a.card.value ?? 0) - (b.card.value ?? 0) ||
    (s.trackPosition[a.holder] ?? 0) - (s.trackPosition[b.holder] ?? 0) ||
    a.seatIdx - b.seatIdx);
  const next = candidates[0];
  return next ? { holder: next.holder, card: next.card } : null;
}

/** Live players other than `id`, in seat order. */
const othersOf = (s: HldState, id: PlayerId) => livePlayerIds(s).filter((o) => o !== id);

/** Neighbours (left / right among live players) whose face-up Point card has no effect. */
function grapplingTargets(s: HldState, id: PlayerId): PlayerId[] {
  const live = livePlayerIds(s);
  const idx = live.indexOf(id);
  if (idx < 0 || live.length < 2) return [];
  const around = [...new Set([live[(idx - 1 + live.length) % live.length]!, live[(idx + 1) % live.length]!])];
  return around.filter((o) => o !== id && !!s.revealedPicks[o] && !s.revealedPicks[o]!.hasEffect);
}

function isopodTargets(s: HldState, id: PlayerId): PlayerId[] {
  return othersOf(s, id).filter((o) => !!s.revealedPicks[o] && !s.revealedPicks[o]!.hasEffect);
}

/** Build the prompt for one Point card effect, or apply it straight away when there is nothing to decide. */
function promptForEffect(s: HldState, holder: PlayerId, card: HldCard): HldPrompt | null {
  const hand = handOf(s, holder);
  const cardsLeft = s.deck.length + s.discard.length;
  switch (card.kind) {
    case 'pet-rock':
      return hand.some((c) => c.type === 'point') ? { kind: 'discardForPoints', playerId: holder, source: 'pet-rock' } : null;
    case 'delicious-smoothie':
      return hand.some((c) => c.type === 'point' && c.hasEffect)
        ? { kind: 'discardForPoints', playerId: holder, source: 'delicious-smoothie' }
        : null;
    case 'dino-grabber':
      return othersOf(s, holder).some((o) => handOf(s, o).length > 0) ? { kind: 'takeFromHand', playerId: holder } : null;
    case 'grappling-snake': {
      const targets = grapplingTargets(s, holder);
      return targets.length ? { kind: 'swapPoint', playerId: holder, source: 'grappling-snake', targets } : null;
    }
    case 'isopod-swap': {
      const targets = isopodTargets(s, holder);
      return targets.length ? { kind: 'swapPoint', playerId: holder, source: 'isopod-swap', targets } : null;
    }
    case 'fire-spray':
    case 'trash-into-treasure':
    case 'a-bone-to-flick':
      return hand.length ? { kind: 'discardUpTo', playerId: holder, source: card.kind, max: 3 } : null;
    case 'treenoculars':
    case 'good-luck-rod':
      return cardsLeft > 0 ? { kind: 'peekDeck', playerId: holder, source: card.kind, cards: null } : null;
    case 'bouquet-of-flowers': {
      // "Reveal the top 3 cards of the deck. You may add all Instant cards to your hand. Discard all other cards."
      const top = drawCards(s, 3);
      if (top.length === 0) return null;
      pushLog(s, holder, `Bouquet of Flowers reveals ${top.map((c) => c.name).join(', ')}.`, 'normal');
      if (!top.some((c) => c.type === 'instant')) {
        s.discard.push(...top);
        return null;
      }
      return { kind: 'peekDeck', playerId: holder, source: 'bouquet-of-flowers', cards: top };
    }
    case 'hungry-plant':
      return othersOf(s, holder).filter((o) => !!s.revealedPicks[o]).length >= 2 ? { kind: 'swapOthers', playerId: holder } : null;
    case 'voodoo-dino':
      return hand.some((c) => c.type === 'point') ? { kind: 'voodoo', playerId: holder } : null;
    case 'unwanted-lunch':
      return othersOf(s, holder).length > 0 ? { kind: 'swapHands', playerId: holder } : null;
    case 'really-thick-glasses': {
      if (s.disasterDeck.length === 0) return null;
      return { kind: 'peekDisaster', playerId: holder, disaster: s.disasterDeck[0]! };
    }
    case 'molotov-crocktail':
      // "You may remove a Hazard card from your Hazard Area." Hazard cards are not modeled.
      return null;
    default:
      return null;
  }
}

/** Resolve Point card effects until one needs a decision; then open the scoring Instants. */
function continuePointEffects(s: HldState) {
  for (;;) {
    if (s.promptQueue.length > 0) {
      s.subPhase = 'pointEffects';
      s.activePlayerId = s.promptQueue[0]!.playerId;
      return;
    }
    const next = nextEffectCard(s);
    if (!next) break;
    s.usedEffectCardIds.push(next.card.id);
    const prompt = promptForEffect(s, next.holder, next.card);
    if (prompt) s.promptQueue.push(prompt);
  }
  openOrResolveScoringInstants(s);
}

// ---- the scoring Instant window ------------------------------------------------------

/** Whether `card` (in `playerId`'s hand) may be played during scoring right now. */
export function canPlayScoringInstantCard(s: HldState, playerId: PlayerId, card: HldCard): boolean {
  if (!isLive(s, playerId) || s.subPhase === 'gameOver') return false;
  if (!SCORING_INSTANT_KINDS.includes(card.kind)) return false;
  if (scoringInstantsBlocked(s) || cannotPlayInstants(s, playerId)) return false;
  switch (card.kind) {
    case 'helping-hand':
      return handOf(s, playerId).some((c) => c.type === 'point' && c.value !== null && c.value >= 1 && c.value <= 3);
    case 'joy-of-puberty':
    case 'spiteful-bullying':
      return (s.trackPosition[playerId] ?? 0) >= 1;
    case 'one-week-anniversary':
      return !!s.currentDisaster && (s.disasterAreas[playerId]?.length ?? 0) > 0;
    default:
      return true;
  }
}

/**
 * The Dating Disasters bonus is a "may": a player can turn it down once per round. It can only ever hurt
 * to take it while an odd number of inversions is in play, so the window only asks then.
 */
export function canSkipDisasterBonus(s: HldState, playerId: PlayerId): boolean {
  return (
    isLive(s, playerId) &&
    inversionCount(s) % 2 === 1 &&
    !s.skippedDisasterBonus.includes(playerId) &&
    disasterScoringBonus(s, playerId) > 0
  );
}

function hasScoringDecision(s: HldState, playerId: PlayerId): boolean {
  return handOf(s, playerId).some((c) => canPlayScoringInstantCard(s, playerId, c)) || canSkipDisasterBonus(s, playerId);
}

/**
 * Only players with something to play are asked, one at a time in seat order. Every play reopens the
 * window for everyone; it closes when the asked players have all passed in a row.
 */
function openOrResolveScoringInstants(s: HldState) {
  s.promptQueue = [];
  const queue = livePlayerIds(s).filter((id) => hasScoringDecision(s, id));
  s.instantResponderQueue = queue;
  const first = queue[0];
  if (!first) {
    finalizeRoundScoring(s);
    return;
  }
  s.subPhase = 'awaitingScoringInstants';
  s.activePlayerId = first;
}

/** The players who collect this round, with how much — or `null` when everyone tied. */
function collectors(s: HldState, scores: Record<PlayerId, number>): { id: PlayerId; points: number; highest: boolean }[] | null {
  const live = livePlayerIds(s);
  const vals = live.map((id) => scores[id]!);
  const maxScore = Math.max(...vals);
  const minScore = Math.min(...vals);
  if (live.length >= 2 && maxScore === minScore) return null;

  const highest = live.filter((id) => scores[id] === maxScore);
  const out = highest.map((id) => ({ id, points: maxScore, highest: true }));
  // 5–6 Player rules: the two highest scores collect. A tie for highest shuts out second place; if
  // everyone else ties for lowest, they go to Sudden Death and only the highest collects.
  if (s.seats.length >= 5 && highest.length === 1) {
    const rest = live.filter((id) => scores[id] !== maxScore);
    const second = Math.max(...rest.map((id) => scores[id]!));
    if (rest.length > 0 && second > minScore) {
      for (const id of rest.filter((r) => scores[r] === second)) out.push({ id, points: second, highest: false });
    }
  }
  return out;
}

function finalizeRoundScoring(s: HldState) {
  s.instantResponderQueue = [];
  const scores = computeRoundScores(s);
  s.roundScores = scores;
  const live = livePlayerIds(s);

  const winners = collectors(s, scores);
  if (!winners) {
    // "If all players tie, move the face-up Disaster card to the bottom of the Disaster deck and end the
    // round. No player collects points for the round."
    if (s.currentDisaster) s.disasterDeck.push(s.currentDisaster);
    s.currentDisaster = null;
    pushLog(s, null, `Everyone tied on ${scores[live[0]!] ?? 0} — nobody collects and the Disaster goes to the bottom of the deck.`, 'normal');
    endRound(s);
    return;
  }

  const capped = s.instantPlays.some((p) => p.kind === 'crippling-shyness');
  for (const w of winners) {
    // Crippling Shyness: "The highest-scoring player at the end of the round may only collect up to 5 points."
    let gain = Math.max(0, w.points);
    if (w.highest && capped) gain = Math.min(gain, 5);
    collect(s, w.id, gain);
    pushLog(s, w.id, `${seatName(s, w.id)} scored ${w.points} (${w.highest ? 'highest' : 'second-highest'}) and collected ${gain}!`, 'good');
    // Extra Sharp Stick: "If you have the highest score … collect 2 additional points."
    if (w.highest && holds(s, w.id, 'extra-sharp-stick')) {
      collect(s, w.id, 2);
      pushLog(s, w.id, `Extra Sharp Stick: ${seatName(s, w.id)} collects 2 more.`, 'good');
    }
  }
  if (checkGameEnd(s)) return;

  // Ice Cream!: "If you have the highest score … move a Disaster card from your Disaster Area to the bottom."
  for (const w of winners) {
    if (!w.highest || !holds(s, w.id, 'ice-cream')) continue;
    const area = s.disasterAreas[w.id] ?? [];
    if (area.length === 0) continue;
    if (new Set(area.map((d) => d.name)).size === 1) sendAreaDisasterToBottom(s, w.id, area[0]!.id);
    else s.promptQueue.push({ kind: 'iceCream', playerId: w.id });
  }
  s.resumeAt = 'afterCollect';
  runPromptsOr(s, () => resolveLowest(s));
}

function sendAreaDisasterToBottom(s: HldState, id: PlayerId, disasterId: number) {
  const area = s.disasterAreas[id] ?? [];
  const idx = area.findIndex((d) => d.id === disasterId);
  if (idx < 0) return;
  const [d] = area.splice(idx, 1);
  s.disasterDeck.push(d!);
  pushLog(s, id, `Ice Cream!: ${seatName(s, id)} sends ${d!.name} to the bottom of the Disaster deck.`, 'good');
}

/** Park on the next prompt, or carry on with `then`. */
function runPromptsOr(s: HldState, then: () => void) {
  if (s.promptQueue.length > 0) {
    s.subPhase = 'resolving';
    s.activePlayerId = s.promptQueue[0]!.playerId;
    return;
  }
  then();
}

/** Continue the round once the prompt queue has emptied. */
function resume(s: HldState) {
  switch (s.resumeAt) {
    case 'pointEffects':
      continuePointEffects(s);
      return;
    case 'afterCollect':
      resolveLowest(s);
      return;
    case 'endRound':
      endRound(s);
      return;
  }
}

function resolveLowest(s: HldState) {
  const scores = s.roundScores ?? computeRoundScores(s);
  const live = livePlayerIds(s);
  const minScore = Math.min(...live.map((id) => scores[id] ?? 0));
  const losers = live.filter((id) => (scores[id] ?? 0) === minScore);
  if (losers.length === 1) {
    assignPendingDisaster(s, losers[0]!);
    return;
  }
  pushLog(s, null, `⚡ Sudden Death between ${losers.map((id) => seatName(s, id)).join(' & ')}!`, 'danger');
  startSuddenDeath(s, losers);
}

/** Sudden Death: the tied players each play another Point card; no traits, effects or Instants. */
function startSuddenDeath(s: HldState, tied: PlayerId[]) {
  // "If at any time one of the players involved in Sudden Death does not have a Point card … that player
  // must add the face-up Disaster card … If more than one player runs out … move it to the bottom."
  const without = tied.filter((id) => !hasPointCard(s, id));
  if (without.length === 1) {
    pushLog(s, without[0]!, `${seatName(s, without[0]!)} has no Point card left for Sudden Death.`, 'danger');
    assignPendingDisaster(s, without[0]!);
    return;
  }
  if (without.length > 1) {
    if (s.currentDisaster) s.disasterDeck.push(s.currentDisaster);
    s.currentDisaster = null;
    pushLog(s, null, 'Several Sudden Death players are out of Point cards — the Disaster goes to the bottom of the deck.', 'normal');
    endRound(s);
    return;
  }
  s.suddenDeathPlayers = tied;
  for (const id of tied) s.pendingPicks[id] = null;
  s.subPhase = 'suddenDeath';
  s.activePlayerId = nextUnpickedPlayer(s, tied);
}

// ---- taking the Disaster ----------------------------------------------------------------

export function canPlayDisasterSaveCard(s: HldState, playerId: PlayerId, card: HldCard): boolean {
  if (!DISASTER_SAVE_INSTANT_KINDS.includes(card.kind)) return false;
  if (cannotPlayInstants(s, playerId)) return false;
  if (card.kind === 'disaster-redirect') return othersOf(s, playerId).length > 0;
  return true;
}

function assignPendingDisaster(s: HldState, victimId: PlayerId) {
  s.pendingDisasterVictimId = victimId;
  s.suddenDeathPlayers = [];
  if (s.currentDisaster && handOf(s, victimId).some((c) => canPlayDisasterSaveCard(s, victimId, c))) {
    s.subPhase = 'awaitingDisasterSave';
    s.activePlayerId = victimId;
    return;
  }
  addDisaster(s, victimId);
}

/** The Disaster actually lands: Lucky Days pay out; others go to the area (elimination check, may discard). */
function addDisaster(s: HldState, victimId: PlayerId) {
  const d = s.currentDisaster;
  s.currentDisaster = null;
  s.pendingDisasterVictimId = null;
  s.resumeAt = 'endRound';
  if (!d) {
    endRound(s);
    return;
  }

  if (d.category === 'lucky') {
    s.disasterDeck.push(d);
    pushLog(s, victimId, `🍀 Lucky Day! ${d.name} goes to the bottom of the Disaster deck instead of ${seatName(s, victimId)}'s area.`, 'good');
    luckyDay(s, victimId, d);
    runPromptsOr(s, () => endRound(s));
    return;
  }

  s.disasterAreas[victimId]!.push(d);
  pushLog(s, victimId, `💥 ${seatName(s, victimId)} adds ${d.name} (${d.category}) to their Disaster Area!`, 'danger');
  if (isEliminatedByDisasters(s.disasterAreas[victimId]!, eliminationRule(s))) {
    eliminate(s, victimId);
    if (checkGameEnd(s)) return;
    endRound(s);
    return;
  }
  // "If a player adds a Disaster card to their Disaster Area, they may discard a card from their hand."
  if (handOf(s, victimId).length > 0) s.promptQueue.push({ kind: 'discardAfterDisaster', playerId: victimId });
  runPromptsOr(s, () => endRound(s));
}

function eliminate(s: HldState, id: PlayerId) {
  if (s.eliminated.includes(id)) return;
  s.eliminated.push(id);
  s.discard.push(...handOf(s, id));
  s.hands[id] = [];
  s.promptQueue = s.promptQueue.filter((p) => p.playerId !== id);
  pushLog(s, id, `☄️ ${seatName(s, id)} has a fatal set of Disasters and is ELIMINATED!`, 'danger');
}

function luckyDay(s: HldState, id: PlayerId, d: HldDisasterCard) {
  switch (d.effect) {
    case 'fruit-shower': {
      const top = drawCards(s, 2);
      if (top.length === 1) handOf(s, id).push(top[0]!);
      else if (top.length === 2) s.promptQueue.push({ kind: 'peekDeck', playerId: id, source: 'fruit-shower', cards: top });
      break;
    }
    case 'treasure-trove':
      if (s.discard.some((c) => c.type === 'point')) s.promptQueue.push({ kind: 'treasureTrove', playerId: id });
      break;
    case 'wishful-thinking':
      s.promptQueue.push({ kind: 'wishfulThinking', playerId: id });
      break;
    case 'one-of-us':
    default:
      // Moves a Hazard card between Hazard Areas — Hazard cards are not modeled.
      break;
  }
}

function endRound(s: HldState) {
  s.promptQueue = [];
  s.instantResponderQueue = [];
  s.suddenDeathPlayers = [];
  if (checkGameEnd(s)) return;
  const live = livePlayerIds(s);

  // "At the end of the round, each player moves their Dinosaur meeple forward … equal to the number of
  // disasters in their Disaster Area."
  for (const id of live) collect(s, id, s.disasterAreas[id]?.length ?? 0);
  // Teddy Bear: "At the end of the round, collect 5 points."
  for (const id of holdersOf(s, 'teddy-bear')) {
    collect(s, id, 5);
    pushLog(s, id, `Teddy Bear: ${seatName(s, id)} collects 5.`, 'good');
  }
  // Heart Bomb: "At the end of the round, each player must discard all cards in their hand."
  if (holdersOf(s, 'heart-bomb').length > 0) {
    for (const id of live) {
      s.discard.push(...handOf(s, id));
      s.hands[id] = [];
    }
    pushLog(s, null, 'Heart Bomb! Everyone discards their whole hand.', 'danger');
  }
  // Clear the table.
  for (const seat of s.seats) {
    const c = s.revealedPicks[seat.id];
    if (c) s.discard.push(c);
    s.revealedPicks[seat.id] = null;
  }
  if (checkGameEnd(s)) return;
  startNextRound(s);
}

function checkGameEnd(s: HldState): boolean {
  if (s.phase === 'gameOver') return true;
  const live = livePlayerIds(s);
  if (live.length <= 1) {
    const winner = live[0] ?? s.seats[0]!.id;
    s.phase = 'gameOver';
    s.subPhase = 'gameOver';
    s.activePlayerId = null;
    s.winnerId = winner;
    s.promptQueue = [];
    s.finalScores = Object.fromEntries(
      s.seats.map((st) => [st.id, isLive(s, st.id) ? 100 + (s.trackPosition[st.id] ?? 0) : s.trackPosition[st.id] ?? 0]),
    );
    pushLog(s, winner, `🦕 ${seatName(s, winner)} is the last Dinosaur standing and wins!`, 'good');
    return true;
  }

  const reachedGoal = live.filter((id) => (s.trackPosition[id] ?? 0) >= s.config.trackLength);
  if (reachedGoal.length > 0) {
    // Unconfirmed: two dinos crossing on the same move — the further one wins, then fewer Disasters.
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
    s.promptQueue = [];
    s.finalScores = Object.fromEntries(s.seats.map((st) => [st.id, s.trackPosition[st.id] ?? 0]));
    pushLog(s, winner, `🏁 ${seatName(s, winner)} reached ${s.trackPosition[winner]} on the Escape Route and wins!`, 'good');
    return true;
  }
  return false;
}

// ============================================================================
// Action handlers
// ============================================================================

/** Boards a player may switch to: available with these expansions and not on someone else's seat. */
export function selectableDinos(s: HldState, playerId: PlayerId): HldDinoId[] {
  return availableDinos(s.config.expansions)
    .map((d) => d.id)
    .filter((d) => d === s.dinos[playerId] || !s.seats.some((st) => st.id !== playerId && s.dinos[st.id] === d));
}

function handleChooseDino(s: HldState, a: Extract<HldAction, { type: 'chooseDino' }>) {
  // Boards are chosen before play: allowed only before your first Point card.
  if (s.roundNumber !== 1 || s.subPhase !== 'selecting') throw new Error('Dinosaurs are chosen before the first card');
  if (!isLive(s, a.playerId) || !s.hands[a.playerId]) throw new Error('not a player');
  if (s.pendingPicks[a.playerId]) throw new Error('you already played your first card');
  if (!selectableDinos(s, a.playerId).includes(a.dinoId)) throw new Error('that Dinosaur is not available');
  s.dinos[a.playerId] = a.dinoId;
}

function handleSubmitPick(s: HldState, a: Extract<HldAction, { type: 'submitPick' }>) {
  if (s.subPhase !== 'selecting') throw new Error(`cannot submit pick during ${s.subPhase}`);
  if (!isLive(s, a.playerId)) throw new Error('eliminated players cannot act');
  if (s.pendingPicks[a.playerId]) throw new Error('already submitted a Point card this round');

  const card = takeFromHand(s, a.playerId, a.cardId, (c) => c.type === 'point');
  if (!card) throw new Error('must select a Point card from your hand');
  s.pendingPicks[a.playerId] = card;

  const next = nextUnpickedPlayer(s, livePlayerIds(s));
  if (next) {
    s.activePlayerId = next;
    return;
  }
  revealAllPicks(s);
}

function handleResolvePrompt(s: HldState, a: Extract<HldAction, { type: 'resolvePrompt' }>) {
  if (s.subPhase !== 'pointEffects' && s.subPhase !== 'resolving') throw new Error('no decision is pending');
  const prompt = s.promptQueue[0];
  if (!prompt || prompt.playerId !== a.playerId) throw new Error('not your prompt');
  const me = a.playerId;
  const hand = handOf(s, me);

  // "You may look" prompts: looking keeps the prompt open with the cards now shown.
  if (prompt.kind === 'peekDeck' && prompt.cards === null) {
    if (a.decline) {
      s.promptQueue.shift();
    } else {
      prompt.cards = drawCards(s, prompt.source === 'good-luck-rod' ? 3 : 2);
      if (prompt.cards.length === 0) s.promptQueue.shift();
      else if (prompt.source === 'good-luck-rod' && !prompt.cards.some((c) => c.type === 'point')) {
        s.discard.push(...prompt.cards);
        pushLog(s, me, `Good Luck Rod: no Point card among ${prompt.cards.map((c) => c.name).join(', ')} — all discarded.`, 'normal');
        s.promptQueue.shift();
      } else if (prompt.source === 'treenoculars' && prompt.cards.length === 1) {
        hand.push(prompt.cards[0]!);
        s.promptQueue.shift();
      }
      if (s.promptQueue[0] === prompt) return; // waiting for the pick
    }
    afterPrompt(s);
    return;
  }

  s.promptQueue.shift();

  switch (prompt.kind) {
    case 'discardForPoints': {
      if (a.decline || a.targetCardId === undefined) break;
      const c = takeFromHand(s, me, a.targetCardId, (x) => x.type === 'point' && (prompt.source !== 'delicious-smoothie' || x.hasEffect));
      if (!c) throw new Error('pick a Point card from your hand');
      s.discard.push(c);
      s.pointEffectBonuses[me] = (s.pointEffectBonuses[me] ?? 0) + (c.value ?? 0);
      pushLog(s, me, `${seatName(s, me)} discarded ${c.name} for +${c.value ?? 0} this round.`, 'good');
      break;
    }

    case 'takeFromHand': {
      if (a.decline || !a.targetPlayerId || a.targetCardId === undefined) break;
      if (a.targetPlayerId === me || !isLive(s, a.targetPlayerId)) throw new Error('pick another player');
      const c = takeFromHand(s, a.targetPlayerId, a.targetCardId);
      if (!c) throw new Error('that card is not in their hand');
      hand.push(c);
      pushLog(s, me, `Dino Grabber: ${seatName(s, me)} took a card from ${seatName(s, a.targetPlayerId)}.`, 'good');
      break;
    }

    case 'swapPoint': {
      if (a.decline || !a.targetPlayerId) break;
      const t = a.targetPlayerId;
      const valid = prompt.source === 'grappling-snake' ? grapplingTargets(s, me) : isopodTargets(s, me);
      if (!valid.includes(t)) throw new Error('you cannot swap with that card');
      const mine = s.revealedPicks[me] ?? null;
      s.revealedPicks[me] = s.revealedPicks[t] ?? null;
      s.revealedPicks[t] = mine;
      pushLog(s, me, `${mine?.name ?? 'Swap'}: ${seatName(s, me)} swapped Point cards with ${seatName(s, t)}.`, 'normal');
      break;
    }

    case 'discardUpTo': {
      if (a.decline || !a.cardIds || a.cardIds.length === 0) break;
      const ids = [...new Set(a.cardIds)].slice(0, prompt.max);
      let n = 0;
      for (const id of ids) {
        const c = takeFromHand(s, me, id);
        if (c) {
          s.discard.push(c);
          n++;
        }
      }
      if (prompt.source === 'trash-into-treasure') {
        s.pointEffectBonuses[me] = (s.pointEffectBonuses[me] ?? 0) + 3 * n;
        pushLog(s, me, `Trash into Treasure: ${seatName(s, me)} discarded ${n} for +${3 * n}.`, 'good');
      } else {
        pushLog(s, me, `${seatName(s, me)} discarded ${n} card${n === 1 ? '' : 's'}.`, 'normal');
      }
      break;
    }

    case 'peekDeck': {
      const cards = prompt.cards ?? [];
      if (prompt.source === 'bouquet-of-flowers') {
        const instants = cards.filter((c) => c.type === 'instant');
        const keep = a.decline ? [] : instants;
        hand.push(...keep);
        s.discard.push(...cards.filter((c) => !keep.includes(c)));
        if (keep.length) pushLog(s, me, `Bouquet of Flowers: ${seatName(s, me)} keeps ${keep.length} Instant${keep.length === 1 ? '' : 's'}.`, 'good');
        break;
      }
      if (prompt.source === 'good-luck-rod') {
        const picked = cards.find((c) => c.id === a.targetCardId && c.type === 'point');
        if (!picked) throw new Error('choose one of the Point cards');
        s.pointEffectBonuses[me] = (s.pointEffectBonuses[me] ?? 0) + (picked.value ?? 0);
        s.discard.push(...cards);
        pushLog(s, me, `Good Luck Rod: ${seatName(s, me)} adds ${picked.name}'s ${picked.value ?? 0}.`, 'good');
        break;
      }
      // Treenoculars / Fruit Shower: keep one, discard the rest.
      const picked = cards.find((c) => c.id === a.targetCardId);
      if (!picked) throw new Error('choose one of the cards');
      hand.push(picked);
      s.discard.push(...cards.filter((c) => c.id !== picked.id));
      break;
    }

    case 'swapOthers': {
      if (a.decline || !a.targetPlayerId || !a.secondPlayerId) break;
      const [p1, p2] = [a.targetPlayerId, a.secondPlayerId];
      if (p1 === p2 || p1 === me || p2 === me || !isLive(s, p1) || !isLive(s, p2)) {
        throw new Error('Hungry Plant swaps the Point cards of two other players');
      }
      const c1 = s.revealedPicks[p1] ?? null;
      s.revealedPicks[p1] = s.revealedPicks[p2] ?? null;
      s.revealedPicks[p2] = c1;
      pushLog(s, me, `Hungry Plant: ${seatName(s, me)} swapped ${seatName(s, p1)}'s and ${seatName(s, p2)}'s Point cards!`, 'danger');
      break;
    }

    case 'voodoo': {
      if (a.decline || !a.cardIds || a.cardIds.length === 0) break;
      const t = a.targetPlayerId;
      if (!t || !isLive(s, t)) throw new Error('choose whose score to lower');
      let n = 0;
      for (const id of new Set(a.cardIds)) {
        const c = takeFromHand(s, me, id, (x) => x.type === 'point');
        if (c) {
          s.discard.push(c);
          n++;
        }
      }
      s.pointEffectBonuses[t] = (s.pointEffectBonuses[t] ?? 0) - n;
      pushLog(s, me, `Voodoo Dino: ${seatName(s, me)} discarded ${n} for −${n} to ${seatName(s, t)}.`, 'danger');
      break;
    }

    case 'swapHands': {
      if (a.decline || !a.targetPlayerId) break;
      const t = a.targetPlayerId;
      if (t === me || !isLive(s, t)) throw new Error('pick another player');
      const mine = handOf(s, me);
      s.hands[me] = handOf(s, t);
      s.hands[t] = mine;
      pushLog(s, me, `Unwanted Lunch: ${seatName(s, me)} swapped hands with ${seatName(s, t)}!`, 'normal');
      break;
    }

    case 'peekDisaster': {
      const top = s.disasterDeck[0];
      if (a.toBottom && top && top.id === prompt.disaster.id) {
        s.disasterDeck.push(s.disasterDeck.shift()!);
        pushLog(s, me, `Really Thick Glasses: ${seatName(s, me)} sent the top Disaster to the bottom.`, 'normal');
      } else {
        pushLog(s, me, `Really Thick Glasses: ${seatName(s, me)} left the top Disaster where it is.`, 'normal');
      }
      break;
    }

    case 'iceCream': {
      const area = s.disasterAreas[me] ?? [];
      const id = area.some((d) => d.id === a.targetCardId) ? a.targetCardId! : area[0]?.id;
      if (id !== undefined) sendAreaDisasterToBottom(s, me, id);
      break;
    }

    case 'treasureTrove': {
      const idx = s.discard.findIndex((c) => c.id === a.targetCardId && c.type === 'point');
      if (idx < 0) throw new Error('choose a Point card from the discard pile');
      const [c] = s.discard.splice(idx, 1);
      hand.push(c!);
      pushLog(s, me, `Treasure Trove: ${seatName(s, me)} takes ${c!.name} from the discard pile.`, 'good');
      break;
    }

    case 'wishfulThinking': {
      const t = a.targetPlayerId;
      if (!t || !isLive(s, t)) throw new Error('choose a player');
      moveBack(s, t, 3);
      pushLog(s, me, `Wishful Thinking: ${seatName(s, t)} moves back 3 spaces.`, 'danger');
      break;
    }

    case 'discardAfterDisaster': {
      if (a.decline || a.targetCardId === undefined) break;
      const c = takeFromHand(s, me, a.targetCardId);
      if (!c) throw new Error('that card is not in your hand');
      s.discard.push(c);
      pushLog(s, me, `${seatName(s, me)} discarded a card.`, 'normal');
      break;
    }
  }

  afterPrompt(s);
}

function afterPrompt(s: HldState) {
  if (s.promptQueue.length > 0) {
    s.activePlayerId = s.promptQueue[0]!.playerId;
    return;
  }
  resume(s);
}

function handlePlayScoringInstant(s: HldState, a: Extract<HldAction, { type: 'playScoringInstant' }>) {
  if (s.subPhase !== 'awaitingScoringInstants') throw new Error('not in scoring instant window');
  // Answers are taken one at a time in queue order (every play reopens the window for everyone), so two
  // peers can never act on the same state at once.
  if (s.instantResponderQueue[0] !== a.playerId) throw new Error('not your turn to respond');

  const hand = handOf(s, a.playerId);
  const card = hand.find((c) => c.id === a.cardId);
  if (!card || !canPlayScoringInstantCard(s, a.playerId, card)) throw new Error('Scoring Instant card not in hand or not playable');
  const me = a.playerId;
  const target = a.targetPlayerId;
  if (TARGETED_INSTANTS.includes(card.kind) && (!target || !isLive(s, target))) throw new Error('choose a player');

  const play: HldInstantPlay = { by: me, kind: card.kind };
  if (target && TARGETED_INSTANTS.includes(card.kind)) play.targetId = target;

  switch (card.kind) {
    case 'helping-hand': {
      const ids = [...new Set(a.handCardIds ?? [])];
      const picked = hand.filter((c) => ids.includes(c.id) && c.type === 'point' && c.value !== null && c.value >= 1 && c.value <= 3);
      if (picked.length === 0) throw new Error('discard at least one Point card worth 1, 2 or 3');
      for (const c of picked) {
        hand.splice(hand.indexOf(c), 1);
        s.discard.push(c);
      }
      play.amount = picked.reduce((n, c) => n + (c.value ?? 0), 0);
      break;
    }
    case 'joy-of-puberty':
    case 'spiteful-bullying': {
      const max = Math.min(5, s.trackPosition[me] ?? 0);
      const n = Math.floor(a.amount ?? max);
      if (n < 1 || n > max) throw new Error(`move back between 1 and ${max} spaces`);
      moveBack(s, me, n);
      play.amount = n;
      break;
    }
    case 'baby-pictures':
      moveBack(s, target!, 3);
      break;
    case 'one-week-anniversary': {
      const area = s.disasterAreas[me]!;
      const idx = area.findIndex((d) => d.id === a.disasterId);
      if (idx < 0 || !s.currentDisaster) throw new Error('choose a Disaster from your Disaster Area');
      const mine = area[idx]!;
      area[idx] = s.currentDisaster;
      s.currentDisaster = mine;
      break;
    }
    default:
      break;
  }

  hand.splice(hand.indexOf(card), 1);
  s.discard.push(card);
  s.instantPlays.push(play);
  const amountNote = play.amount !== undefined ? ` (${play.amount})` : '';
  pushLog(s, me, `${seatName(s, me)} played ${card.name}${target && play.targetId ? ` on ${seatName(s, target)}` : ''}${amountNote}!`, 'normal');

  if (card.kind === 'one-week-anniversary' && isEliminatedByDisasters(s.disasterAreas[me]!, eliminationRule(s))) {
    eliminate(s, me);
    if (checkGameEnd(s)) return;
  }
  openOrResolveScoringInstants(s);
}

function handleSkipDisasterBonus(s: HldState, a: Extract<HldAction, { type: 'skipDisasterBonus' }>) {
  if (s.subPhase !== 'awaitingScoringInstants') throw new Error('not in scoring instant window');
  if (s.instantResponderQueue[0] !== a.playerId) throw new Error('not your turn to respond');
  if (!canSkipDisasterBonus(s, a.playerId)) throw new Error('no Disaster bonus to turn down');
  s.skippedDisasterBonus.push(a.playerId);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} turns down their Disaster bonus this round.`, 'normal');
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

  const card = takeFromHand(s, a.playerId, a.cardId, (c) => c.type === 'point');
  if (!card) throw new Error('must pick a Point card');
  s.pendingPicks[a.playerId] = card;

  const next = nextUnpickedPlayer(s, s.suddenDeathPlayers);
  if (next) {
    s.activePlayerId = next;
    return;
  }

  // All Sudden Death players picked — compare the printed Point values only.
  const vals: Record<PlayerId, number> = {};
  for (const id of s.suddenDeathPlayers) {
    const c = s.pendingPicks[id];
    vals[id] = c?.value ?? 0;
    if (c) s.discard.push(c);
    s.pendingPicks[id] = null;
  }
  pushLog(s, null, `Sudden Death: ${s.suddenDeathPlayers.map((id) => `${seatName(s, id)} ${vals[id]}`).join(', ')}.`, 'normal');
  const minVal = Math.min(...s.suddenDeathPlayers.map((id) => vals[id]!));
  const lowest = s.suddenDeathPlayers.filter((id) => vals[id] === minVal);
  if (lowest.length === 1) {
    assignPendingDisaster(s, lowest[0]!);
    return;
  }
  startSuddenDeath(s, lowest);
}

function handlePlayDisasterSave(s: HldState, a: Extract<HldAction, { type: 'playDisasterSave' }>) {
  if (s.subPhase !== 'awaitingDisasterSave') throw new Error('not awaiting disaster save');
  if (a.playerId !== s.pendingDisasterVictimId) throw new Error('not the disaster victim');

  const me = a.playerId;
  const hand = handOf(s, me);
  const card = hand.find((c) => c.id === a.cardId);
  if (!card || !canPlayDisasterSaveCard(s, me, card)) throw new Error('card not in hand or not playable');
  if (card.kind === 'disaster-redirect') {
    const t = a.targetPlayerId;
    if (!t || t === me || !isLive(s, t)) throw new Error('must choose another live player for Disaster Redirect');
  }
  hand.splice(hand.indexOf(card), 1);
  s.discard.push(card);

  switch (card.kind) {
    case 'disaster-insurance':
    case 'lucky-break': {
      if (s.currentDisaster) s.disasterDeck.push(s.currentDisaster);
      s.currentDisaster = null;
      s.pendingDisasterVictimId = null;
      pushLog(s, me, `🛡️ ${seatName(s, me)} played ${card.name}: the Disaster goes to the bottom of the deck.`, 'good');
      if (card.kind === 'lucky-break') {
        collect(s, me, 3);
        if (checkGameEnd(s)) return;
      }
      endRound(s);
      return;
    }
    case 'awkward-first-kiss': {
      // "Collect 5 points." The Disaster still lands unless another save is played.
      collect(s, me, 5);
      pushLog(s, me, `💋 ${seatName(s, me)} played Awkward First Kiss and collects 5.`, 'good');
      if (checkGameEnd(s)) return;
      assignPendingDisaster(s, me);
      return;
    }
    case 'disaster-redirect':
    default: {
      const t = a.targetPlayerId!;
      pushLog(s, me, `↩️ ${seatName(s, me)} played Disaster Redirect onto ${seatName(s, t)}!`, 'danger');
      assignPendingDisaster(s, t);
      return;
    }
  }
}

function handleDeclineDisasterSave(s: HldState, a: Extract<HldAction, { type: 'declineDisasterSave' }>) {
  if (s.subPhase !== 'awaitingDisasterSave') throw new Error('not awaiting disaster save');
  if (a.playerId !== s.pendingDisasterVictimId) throw new Error('not the disaster victim');
  addDisaster(s, a.playerId);
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
    case 'skipDisasterBonus':
      handleSkipDisasterBonus(s, action);
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

  // "The first Dinosaur to reach 50 points … wins" — the moment it happens.
  checkGameEnd(s);
  return s;
}
