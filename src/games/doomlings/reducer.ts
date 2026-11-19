// Doomlings — pure deterministic reducer for the Classic (2nd edition) base game.
//
// Rules source: the official Classic rulesheet (see types.ts). The engine is a
// work queue (`state.tasks`): every effect is a task, and every choice a rule
// gives a player becomes an explicit `state.prompt` for that player. A choice
// with exactly one legal answer resolves itself; one with none is skipped.

import { createRng, rngInt, shuffle } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import { cloneState, pushLog, seatName } from '@/core/state';
import { buildDmDecks, printedColors } from './cards';
import type {
  DmAction,
  DmAgeCard,
  DmCatastropheTag,
  DmConfig,
  DmPrompt,
  DmState,
  DmTask,
  DmTraitCard,
  DmTraitColor,
  DmTraitKind,
} from './types';
import { DM_SCORING_COLORS } from './types';

const GENE_POOL_MIN = 1;
const GENE_POOL_MAX = 8;
const MAX_DOMINANTS = 2;

// ============================================================================
// Setup
// ============================================================================

export function createInitialState(config: DmConfig, seed: number, seats: Seat[]): DmState {
  const rngState = createRng(seed);
  const first = seats[0];
  if (!first) throw new Error('Doomlings needs at least one seat');
  const { traitDeck, ageDeck, birthOfLife } = buildDmDecks(rngState);
  const hands: Record<PlayerId, DmTraitCard[]> = {};
  for (const seat of seats) hands[seat.id] = traitDeck.splice(0, 5);

  const state: DmState = {
    phase: 'playing',
    seats,
    activePlayerId: first.id,
    finalScores: null,
    rngState,

    subPhase: 'awaitingAction',
    traitDeck,
    traitDiscard: [],
    ageDeck,
    agesPlayed: [birthOfLife],
    currentAge: birthOfLife,
    skippedAgeIds: [],

    hands,
    tableaus: Object.fromEntries(seats.map((s) => [s.id, []])),
    genePool: Object.fromEntries(seats.map((s) => [s.id, 5])),

    firstPlayerIndex: 0,
    roundOrder: seats.map((s) => s.id),
    turnIndex: 0,
    turnPlayerId: first.id,
    turnStage: 'resolving',
    catastrophesSeen: 0,

    spentDenials: [],
    lastPlayedColors: null,
    peekedAge: Object.fromEntries(seats.map((s) => [s.id, null])),
    revealed: [],
    pendingGifts: [],

    tasks: [{ t: 'beginTurns' }],
    prompt: null,

    worldsEnd: null,
    winnerId: null,
    winnerIds: [],

    log: [],
    logSeq: 0,
    config,
  };
  pushLog(state, null, `The Birth of Life: ${seats.length} species start evolving. Gene Pools are set to 5.`, 'good');
  run(state);
  return state;
}

// ============================================================================
// Read helpers (also used by the UI and the AI)
// ============================================================================

export function handOf(s: DmState, id: PlayerId): DmTraitCard[] {
  const h = s.hands[id];
  if (!h) throw new Error(`unknown hand ${id}`);
  return h;
}

export function tableauOf(s: DmState, id: PlayerId): DmTraitCard[] {
  const t = s.tableaus[id];
  if (!t) throw new Error(`unknown tableau ${id}`);
  return t;
}

export function genePoolOf(s: DmState, id: PlayerId): number {
  return s.genePool[id] ?? 5;
}

/** A trait card anywhere in play: a hand, a pile, the discard. */
export function findCard(s: DmState, id: number): DmTraitCard | null {
  for (const seat of s.seats) {
    const c = handOf(s, seat.id).find((x) => x.id === id) ?? tableauOf(s, seat.id).find((x) => x.id === id);
    if (c) return c;
  }
  return s.traitDiscard.find((x) => x.id === id) ?? null;
}

function ownerOfHandCard(s: DmState, id: number): PlayerId | null {
  for (const seat of s.seats) if (handOf(s, seat.id).some((c) => c.id === id)) return seat.id;
  return null;
}

function seatIdx(s: DmState, p: PlayerId): number {
  return s.seats.findIndex((x) => x.id === p);
}

/** Clockwise from seat index `start` (turns pass to the left). */
function orderFrom(s: DmState, start: number): PlayerId[] {
  const n = s.seats.length;
  return Array.from({ length: n }, (_, i) => s.seats[(start + i) % n]!.id);
}

/** Everyone else, starting with the player on `p`'s left. */
export function opponentsOf(s: DmState, p: PlayerId): PlayerId[] {
  return orderFrom(s, seatIdx(s, p) + 1).filter((x) => x !== p);
}

function leftOf(s: DmState, p: PlayerId): PlayerId {
  return s.seats[(seatIdx(s, p) + 1) % s.seats.length]!.id;
}

function rightOf(s: DmState, p: PlayerId): PlayerId {
  const n = s.seats.length;
  return s.seats[(seatIdx(s, p) - 1 + n) % n]!.id;
}

/** The colours a trait in `owner`'s pile counts as (Faith can recolour them at World's End). */
function traitColorsFor(s: DmState, owner: PlayerId | null, card: DmTraitCard): DmTraitColor[] {
  const cols = printedColors(card);
  const change = owner ? s.worldsEnd?.colorChange[owner] ?? null : null;
  if (!change) return cols;
  return [...new Set(cols.map((c) => (c === change.from ? change.to : c)))];
}

function countColor(s: DmState, p: PlayerId, color: DmTraitColor): number {
  const pile = tableauOf(s, p);
  if (color === 'colorless') return pile.filter((c) => printedColors(c).length === 0).length;
  return pile.filter((c) => traitColorsFor(s, p, c).includes(color)).length;
}

function distinctColors(s: DmState, p: PlayerId): DmTraitColor[] {
  return DM_SCORING_COLORS.filter((col) => countColor(s, p, col) > 0);
}

/** Face value as it counts for effects: compass stars are 0. */
export function faceValue(card: DmTraitCard): number {
  return card.compassStar ? 0 : card.points;
}

function hasKind(s: DmState, p: PlayerId, kind: DmTraitKind): boolean {
  return tableauOf(s, p).some((c) => c.kind === kind);
}

function dominantCount(s: DmState, p: PlayerId): number {
  return tableauOf(s, p).filter((c) => c.dominant).length;
}

/** Hand size `p` must stabilize to right now. */
export function stabilizeTarget(s: DmState, p: PlayerId): number {
  return s.currentAge.ruleTag === 'stabilizeTo4' ? 4 : genePoolOf(s, p);
}

/** Reforestation: traits in piles can't be swapped, stolen or discarded this round. */
function pilesLocked(s: DmState): boolean {
  return s.currentAge.ruleTag === 'protectTraitPiles';
}

/** Can this pile trait be taken by a steal / swap? (Dominants never leave a pile.) */
function canTake(s: DmState, card: DmTraitCard): boolean {
  return !card.dominant && !pilesLocked(s);
}

/** Can this pile trait be discarded? */
function canDiscardFromPile(s: DmState, card: DmTraitCard): boolean {
  return !card.dominant && !pilesLocked(s);
}

/** Can this pile trait be given / returned / moved (not blocked by Reforestation)? */
function canMove(card: DmTraitCard): boolean {
  return !card.dominant;
}

// ---- play legality ------------------------------------------------------------

export type DmBlock = 'dominants' | 'age' | 'requirement';

/** Why `p` can't play `card` right now, or null if they can. */
export function playBlock(s: DmState, p: PlayerId, card: DmTraitCard, unrestricted = false): { kind: DmBlock; why: string } | null {
  if (unrestricted) return null;
  if (card.dominant && dominantCount(s, p) >= MAX_DOMINANTS) return { kind: 'dominants', why: 'You already have 2 Dominant traits.' };
  const cols = printedColors(card);
  const rule = s.currentAge.ruleTag;
  const banned: Partial<Record<typeof rule, DmTraitColor>> = { noRed: 'red', noBlue: 'blue', noGreen: 'green', noPurple: 'purple' };
  const bannedColor = banned[rule];
  if (bannedColor && cols.includes(bannedColor)) return { kind: 'age', why: `${s.currentAge.name}: no ${bannedColor} traits this round.` };
  if (rule === 'noColorless' && cols.length === 0) return { kind: 'age', why: `${s.currentAge.name}: no colorless traits this round.` };
  if (rule === 'maxFaceValue3' && faceValue(card) > 3) return { kind: 'age', why: `${s.currentAge.name}: only face value 3 or lower this round.` };
  if (rule === 'naturalHarmony' && s.lastPlayedColors && cols.some((c) => s.lastPlayedColors!.includes(c))) {
    return { kind: 'age', why: `${s.currentAge.name}: it shares a colour with the last trait played.` };
  }
  switch (card.kind) {
    case 'delicious':
      if (countColor(s, p, 'colorless') === 0) return { kind: 'requirement', why: 'Needs a colorless trait in your pile.' };
      break;
    case 'heroic':
      if (countColor(s, p, 'green') < 3) return { kind: 'requirement', why: 'Needs 3 or more green traits in your pile.' };
      break;
    case 'morality':
      if (!tableauOf(s, p).some((c) => canMove(c) && faceValue(c) > 0) || s.seats.length < 2) {
        return { kind: 'requirement', why: 'You must give away a positive-value trait from your pile.' };
      }
      break;
    case 'retractable-claws':
      if (!tableauOf(s, p).some((c) => canDiscardFromPile(s, c) && traitColorsFor(s, p, c).includes('red'))) {
        return { kind: 'requirement', why: 'You must discard a red trait from your pile.' };
      }
      break;
    default:
      break;
  }
  return null;
}

export function canPlayTrait(s: DmState, p: PlayerId, card: DmTraitCard, unrestricted = false): boolean {
  return playBlock(s, p, card, unrestricted) === null;
}

/** Traits `p` could play as their turn. */
export function playableFromHand(s: DmState, p: PlayerId): DmTraitCard[] {
  return handOf(s, p).filter((c) => canPlayTrait(s, p, c));
}

/** Self-Awareness cards `p` may slip into an opponent's pile right now (during their own turn). */
export function outOfTurnPlays(s: DmState, p: PlayerId): DmTraitCard[] {
  if (s.phase !== 'playing' || s.prompt || s.turnStage !== 'main' || s.turnPlayerId !== p || s.seats.length < 2) return [];
  return handOf(s, p).filter((c) => c.kind === 'self-awareness' && canPlayTrait(s, p, c));
}

/** The next age, if `p` may legitimately see it (Awakening on their turn, or The Third Eye). */
export function previewNextAge(s: DmState, p: PlayerId | null): DmAgeCard | null {
  const next = s.ageDeck[0];
  if (!next || !p) return null;
  if (s.peekedAge[p] === next.id) return next;
  if (s.currentAge.ruleTag === 'awakening' && s.turnPlayerId === p && s.phase === 'playing') return next;
  return null;
}

// ============================================================================
// Gene Pool
// ============================================================================

/**
 * Rulebook: "If an effect would have you exceed a Gene Pool of 8 or dip below
 * a Gene Pool of 1, ignore the effect. But when a trait leaves your trait
 * pile, ALWAYS adjust your Gene Pool."
 */
function adjustGenePool(s: DmState, p: PlayerId, delta: number, always: boolean) {
  if (!delta) return;
  const cur = genePoolOf(s, p);
  const next = cur + delta;
  if (always) s.genePool[p] = Math.max(GENE_POOL_MIN, Math.min(GENE_POOL_MAX, next));
  else if (next >= GENE_POOL_MIN && next <= GENE_POOL_MAX) s.genePool[p] = next;
}

function gpEnter(s: DmState, owner: PlayerId, card: DmTraitCard, global = true) {
  adjustGenePool(s, owner, card.genePoolDelta, false);
  if (global && card.kind === 'super-spreader') for (const seat of s.seats) adjustGenePool(s, seat.id, -1, false);
}

function gpLeave(s: DmState, owner: PlayerId, card: DmTraitCard, global = true) {
  adjustGenePool(s, owner, -card.genePoolDelta, true);
  if (global && card.kind === 'super-spreader') for (const seat of s.seats) adjustGenePool(s, seat.id, 1, true);
}

// ============================================================================
// Moving cards
// ============================================================================

function drawCards(s: DmState, p: PlayerId, n: number): DmTraitCard[] {
  const drawn: DmTraitCard[] = [];
  for (let i = 0; i < n; i++) {
    if (s.traitDeck.length === 0 && s.traitDiscard.length > 0) {
      s.traitDeck = shuffle(s.rngState, s.traitDiscard);
      s.traitDiscard = [];
      pushLog(s, null, 'The trait deck ran out: the discard pile was reshuffled into a new deck.', 'normal');
    }
    const c = s.traitDeck.shift();
    if (!c) break;
    handOf(s, p).push(c);
    drawn.push(c);
  }
  return drawn;
}

function discardHandCards(s: DmState, p: PlayerId, ids: readonly number[]) {
  const hand = handOf(s, p);
  for (const id of ids) {
    const i = hand.findIndex((c) => c.id === id);
    if (i >= 0) s.traitDiscard.push(hand.splice(i, 1)[0]!);
  }
}

function discardRandomFromHand(s: DmState, p: PlayerId, n: number): DmTraitCard[] {
  const hand = handOf(s, p);
  const out: DmTraitCard[] = [];
  for (let i = 0; i < n && hand.length; i++) {
    const c = hand.splice(rngInt(s.rngState, hand.length), 1)[0]!;
    s.traitDiscard.push(c);
    out.push(c);
  }
  return out;
}

function stealRandomFromHand(s: DmState, from: PlayerId, to: PlayerId, n: number): number {
  const hand = handOf(s, from);
  let got = 0;
  for (let i = 0; i < n && hand.length; i++) {
    handOf(s, to).push(hand.splice(rngInt(s.rngState, hand.length), 1)[0]!);
    got++;
  }
  return got;
}

function takeFromHand(s: DmState, p: PlayerId, id: number): DmTraitCard | null {
  const hand = handOf(s, p);
  const i = hand.findIndex((c) => c.id === id);
  return i >= 0 ? hand.splice(i, 1)[0]! : null;
}

function removeFromPile(s: DmState, owner: PlayerId, id: number, global = true): DmTraitCard | null {
  const pile = tableauOf(s, owner);
  const i = pile.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const card = pile.splice(i, 1)[0]!;
  gpLeave(s, owner, card, global);
  return card;
}

function addToPile(s: DmState, owner: PlayerId, card: DmTraitCard, global = true) {
  tableauOf(s, owner).push(card);
  gpEnter(s, owner, card, global);
}

/** Steal / swap / give: the trait changes piles (moving Super Spreader doesn't change anyone's Gene Pool). */
function moveTrait(s: DmState, from: PlayerId, to: PlayerId, id: number): DmTraitCard | null {
  const card = removeFromPile(s, from, id, false);
  if (card) addToPile(s, to, card, false);
  return card;
}

/**
 * Discard a trait from `owner`'s pile. Endurance comes straight back;
 * Regenerative Tissue (this one included) draws and plays a card.
 * UNCONFIRMED: any discard from your pile counts as "you discard", even when an
 * opponent's effect (Reckless) is the one choosing.
 */
function discardFromPile(s: DmState, owner: PlayerId, id: number) {
  const regen = tableauOf(s, owner).filter((c) => c.kind === 'regenerative-tissue').length;
  const card = removeFromPile(s, owner, id);
  if (!card) return;
  if (card.kind === 'endurance') {
    addToPile(s, owner, card);
    pushLog(s, owner, `${card.name} was discarded from ${seatName(s, owner)}'s pile — and came straight back.`, 'good');
  } else {
    s.traitDiscard.push(card);
    pushLog(s, owner, `${card.name} was discarded from ${seatName(s, owner)}'s pile.`, 'danger');
  }
  for (let i = 0; i < regen; i++) front(s, { t: 'regenDraw', p: owner });
}

function returnToHand(s: DmState, owner: PlayerId, id: number) {
  const card = removeFromPile(s, owner, id);
  if (card) handOf(s, owner).push(card);
}

// ============================================================================
// The work queue
// ============================================================================

function front(s: DmState, ...tasks: DmTask[]) {
  s.tasks.unshift(...tasks);
}

type Answer = {
  decline?: boolean;
  cardIds?: number[];
  target?: { ownerId: PlayerId; cardId: number };
  playerId?: PlayerId;
  color?: DmTraitColor;
  optionId?: string;
};

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type PromptSpec = DistOmit<DmPrompt, 'task'>;

function ask(s: DmState, task: DmTask, spec: PromptSpec) {
  s.prompt = { ...spec, task } as DmPrompt;
}

const FLOW: ReadonlySet<DmTask['t']> = new Set([
  'flipAge', 'beginTurns', 'turnStart', 'endTurn', 'enlightenment', 'stabilizeChoice', 'afterStabilize', 'late', 'nextTurn', 'afterCatastrophe',
]);

function run(s: DmState) {
  let guard = 0;
  while (s.phase === 'playing') {
    if (++guard > 20000) throw new Error('Doomlings: task queue did not settle');
    if (s.prompt) {
      s.subPhase = 'awaitingPrompt';
      s.activePlayerId = s.prompt.playerId;
      return;
    }
    const task = s.tasks.shift();
    if (!task) {
      if (s.turnStage === 'main') {
        s.subPhase = 'awaitingAction';
        s.activePlayerId = s.turnPlayerId;
        return;
      }
      // Every turn queues its own ending, so this is only a safety net.
      s.tasks.push({ t: 'nextTurn' });
      continue;
    }
    exec(s, task);
  }
}

// ============================================================================
// Task execution
// ============================================================================

function exec(s: DmState, task: DmTask) {
  switch (task.t) {
    // ---- round & turn flow ---------------------------------------------------
    case 'beginTurns': {
      const order = orderFrom(s, s.firstPlayerIndex);
      if (s.currentAge.ruleTag === 'messiah') {
        // "First player last and last player first."
        order.reverse();
      }
      s.roundOrder = order;
      s.turnIndex = 0;
      front(s, { t: 'turnStart', p: order[0]! });
      return;
    }
    case 'turnStart': {
      s.turnPlayerId = task.p;
      if (hasKind(s, task.p, 'echolocation')) {
        drawCards(s, task.p, 1);
        pushLog(s, task.p, `${seatName(s, task.p)} drew 1 (Echolocation).`, 'normal');
      }
      s.turnStage = 'main';
      return;
    }
    case 'endTurn': {
      const seq: DmTask[] = [];
      if (s.currentAge.ruleTag === 'enlightenment') seq.push({ t: 'enlightenment', p: task.p });
      seq.push({ t: 'stabilizeChoice', p: task.p }, { t: 'nextTurn' });
      front(s, ...seq);
      return;
    }
    case 'enlightenment': {
      const ids = handOf(s, task.p).map((c) => c.id);
      if (!ids.length) return;
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 0, max: Math.min(2, ids.length), optional: true,
        title: 'Enlightenment: discard up to 2 cards before you stabilize?', declineLabel: 'Keep them',
      });
      return;
    }
    case 'stabilizeChoice': {
      const p = task.p;
      const rule = s.currentAge.ruleTag;
      const target = stabilizeTarget(s, p);
      if (rule === 'prosperity' && handOf(s, p).length !== target) {
        ask(s, task, {
          kind: 'option', playerId: p, optional: false, title: `Prosperity: stabilize to ${target} cards?`,
          options: [{ id: 'stabilize', label: `Stabilize to ${target}` }, { id: 'skip', label: 'Don’t stabilize' }],
        });
        return;
      }
      if (rule === 'nietzsche') {
        ask(s, task, {
          kind: 'option', playerId: p, optional: false, title: 'Age of Nietzsche: stabilize, or discard your hand and draw 3 instead?',
          options: [{ id: 'stabilize', label: `Stabilize to ${target}` }, { id: 'nietzsche', label: 'Discard hand, draw 3' }],
        });
        return;
      }
      front(s, { t: 'stabilize', p }, { t: 'afterStabilize', p });
      return;
    }
    case 'stabilize': {
      const p = task.p;
      const target = stabilizeTarget(s, p);
      const hand = handOf(s, p);
      if (hand.length < target) {
        const n = drawCards(s, p, target - hand.length).length;
        if (n) pushLog(s, p, `${seatName(s, p)} stabilized: drew ${n}.`, 'normal');
      } else if (hand.length > target) {
        const excess = hand.length - target;
        ask(s, task, {
          kind: 'cards', playerId: p, cardIds: hand.map((c) => c.id), from: 'hand', min: excess, max: excess, optional: false,
          title: `Stabilize: discard ${excess} card${excess === 1 ? '' : 's'} (down to ${target}).`,
        });
      }
      return;
    }
    case 'afterStabilize': {
      const p = task.p;
      if (s.currentAge.ruleTag === 'coastalFormations' && drawCards(s, p, 1).length) {
        pushLog(s, p, `${seatName(s, p)} drew 1 after stabilizing (Coastal Formations).`, 'normal');
      }
      front(s, { t: 'late', p });
      return;
    }
    case 'late': {
      const late = handOf(s, task.p).find((c) => c.kind === 'late' && canPlayTrait(s, task.p, c));
      if (!late) return;
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'You just stabilized — play Late from your hand?',
        detail: 'It goes into your pile and doesn’t count as a turn.',
        options: [{ id: 'play', label: 'Play Late' }, { id: 'keep', label: 'Keep it' }],
      });
      return;
    }
    case 'nextTurn': {
      s.turnIndex += 1;
      s.turnStage = 'resolving';
      if (s.turnIndex < s.roundOrder.length) front(s, { t: 'turnStart', p: s.roundOrder[s.turnIndex]! });
      else front(s, { t: 'flipAge' });
      return;
    }
    case 'flipAge':
      flipAge(s);
      return;
    case 'nihilism': {
      while (s.ageDeck[0] && s.ageDeck[0].kind !== 'catastrophe') {
        const skipped = s.ageDeck.shift()!;
        s.agesPlayed.push(skipped);
        s.skippedAgeIds.push(skipped.id);
        pushLog(s, null, `${skipped.name.trim()} rushes past, ignored (Optimistic Nihilism).`, 'normal');
      }
      front(s, { t: 'flipAge' });
      return;
    }

    // ---- age effects ---------------------------------------------------------
    case 'ageRandomDiscard': {
      const gone = discardRandomFromHand(s, task.p, 1);
      if (gone.length) pushLog(s, task.p, `${seatName(s, task.p)} discarded ${gone[0]!.name} at random.`, 'danger');
      return;
    }
    case 'draculaSteal': {
      const opps = opponentsOf(s, task.p).filter((o) => handOf(s, o).length > 0);
      if (!opps.length || !hasKind(s, task.p, 'vampirism')) return;
      if (opps.length === 1) return answerTask(s, task, { playerId: opps[0]! });
      ask(s, task, { kind: 'player', playerId: task.p, playerIds: opps, optional: false, title: 'Age of Dracula: steal 1 random card from whose hand?' });
      return;
    }
    case 'reasonKeep': {
      if (!task.cardIds.length) {
        const drawn = drawCards(s, task.p, 3);
        if (drawn.length <= 1) return;
        const t2: DmTask = { ...task, cardIds: drawn.map((c) => c.id) };
        ask(s, t2, { kind: 'cards', playerId: task.p, cardIds: t2.cardIds, from: 'hand', min: 1, max: 1, optional: false, title: 'Age of Reason: keep 1 of the 3 cards you drew (the others are discarded).' });
      }
      return;
    }
    case 'alienTerraform': {
      const doms = handOf(s, task.p).filter((c) => c.dominant).map((c) => c.id);
      if (!doms.length) return;
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: doms, from: 'hand', min: 1, max: doms.length, optional: true, declineLabel: 'Keep them',
        title: 'Alien Terraform: discard Dominant cards from your hand? If you do, you stabilize right away.',
      });
      return;
    }
    case 'heroRises': {
      const heroic = handOf(s, task.p).find((c) => c.kind === 'heroic');
      if (!heroic) return;
      pushLog(s, task.p, `Birth of a Hero: ${seatName(s, task.p)} plays Heroic without restriction!`, 'good');
      front(s, { t: 'play', p: task.p, cardId: heroic.id, from: 'hand', triggerAction: false, unrestricted: true, outOfTurn: true });
      return;
    }
    case 'discardFromHand': {
      const hand = handOf(s, task.p);
      const n = Math.min(task.count, hand.length);
      if (n <= 0) return;
      if (n === hand.length) return answerTask(s, task, { cardIds: hand.map((c) => c.id) });
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: hand.map((c) => c.id), from: 'hand', min: n, max: n, optional: false, title: `${task.why}: discard ${n} card${n === 1 ? '' : 's'} from your hand.` });
      return;
    }

    // ---- catastrophes ----------------------------------------------------------
    case 'catastropheEffect':
      catastropheEffect(s, task.p, task.tag);
      return;
    case 'keepOne': {
      const hand = handOf(s, task.p);
      if (hand.length <= 1) return;
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: hand.map((c) => c.id), from: 'hand', min: 1, max: 1, optional: false, title: `${task.why}: choose the 1 card you keep; the rest are discarded.` });
      return;
    }
    case 'passHandsRight': {
      // Simultaneous. A player whose Denial ignored the catastrophe keeps their
      // hand and is skipped: each passer hands to the nearest passer on the right.
      const cat = s.currentAge;
      const passing = s.seats.map((x) => x.id).filter((p) => !denialIgnores(s, p, cat));
      if (passing.length < 2) return;
      const before = Object.fromEntries(passing.map((p) => [p, handOf(s, p)]));
      passing.forEach((p, i) => {
        const to = passing[(i - 1 + passing.length) % passing.length]!;
        s.hands[to] = before[p]!;
      });
      pushLog(s, null, 'Everyone passed their hand to the right.', 'normal');
      return;
    }
    case 'bigOneGive': {
      const pending = new Set(s.pendingGifts.filter((g) => g.from === task.p).map((g) => g.cardId));
      const ids = handOf(s, task.p).map((c) => c.id).filter((id) => !pending.has(id));
      const to = task.to[0];
      if (!to || !ids.length) return;
      if (task.to.length > 1) front(s, { t: 'bigOneGive', p: task.p, to: task.to.slice(1) });
      const t1: DmTask = { t: 'bigOneGive', p: task.p, to: [to] };
      if (ids.length === 1) return answerTask(s, t1, { cardIds: ids });
      ask(s, t1, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false, title: `The Big One: choose a card from your hand to give to ${seatName(s, to)}.` });
      return;
    }
    case 'applyGifts': {
      for (const g of s.pendingGifts) {
        const c = takeFromHand(s, g.from, g.cardId);
        if (c) handOf(s, g.to).push(c);
      }
      if (s.pendingGifts.length) pushLog(s, null, 'The Big One: everyone handed cards to their neighbours.', 'normal');
      s.pendingGifts = [];
      return;
    }
    case 'afterCatastrophe':
      front(s, s.catastrophesSeen >= 3 ? { t: 'worldsEnd' } : { t: 'beginTurns' });
      return;

    // ---- playing traits ------------------------------------------------------
    case 'payCost': {
      const card = findCard(s, task.cardId);
      if (!card) return;
      const mode = card.kind === 'morality' ? 'moralityGift' : 'clawsCost';
      front(s, { t: 'pickTrait', p: task.p, mode, srcId: card.id, cost: { from: task.from, triggerAction: task.triggerAction } });
      return;
    }
    case 'moralityTo': {
      const opps = opponentsOf(s, task.p);
      if (opps.length === 1) return answerTask(s, task, { playerId: opps[0]! });
      const gift = findCard(s, task.giftId);
      ask(s, task, { kind: 'player', playerId: task.p, playerIds: opps, optional: false, title: `Morality: who receives your ${gift?.name ?? 'trait'}?` });
      return;
    }
    case 'play':
      execPlay(s, task);
      return;
    case 'parasiticWindow':
      parasiticWindow(s, task);
      return;
    case 'preventWindow':
      preventWindow(s, task);
      return;
    case 'selfReplicatingReturn': {
      const src = tableauOf(s, task.p).find((c) => c.id === task.srcId);
      if (!src) return;
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'You played a green trait: return Self-Replicating to your hand?',
        options: [{ id: 'return', label: 'Return it to my hand' }, { id: 'keep', label: 'Leave it in my pile' }],
      });
      return;
    }
    case 'onEnter': {
      const card = tableauOf(s, task.p).find((c) => c.id === task.cardId);
      if (!card) return;
      if (card.kind === 'vampirism') front(s, { t: 'pickTrait', p: task.p, mode: 'vampirism', srcId: card.id });
      else if (card.kind === 'optimistic-nihilism') triggerNihilism(s, task.p);
      return;
    }
    case 'action':
      execAction(s, task.actor, task.srcId, task.kind);
      return;
    case 'extraPlay': {
      const ids = handOf(s, task.p)
        .filter((c) => (task.rule === 'colorless' ? printedColors(c).length === 0 : !!c.effectless) && canPlayTrait(s, task.p, c))
        .map((c) => c.id);
      if (!ids.length) return;
      const age = s.currentAge.name;
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: true, declineLabel: 'No thanks',
        title: `${age}: you may play another ${task.rule} trait.`,
      });
      return;
    }
    case 'playAnother': {
      const hand = handOf(s, task.p);
      const pool = task.cardIds ? hand.filter((c) => task.cardIds!.includes(c.id)) : hand;
      const ids = pool.filter((c) => canPlayTrait(s, task.p, c)).map((c) => c.id);
      if (!ids.length) {
        if (!task.cardIds) pushLog(s, task.p, `${seatName(s, task.p)} has no trait they can play (${task.why}).`, 'normal');
        return;
      }
      if (ids.length === 1 && !task.optional) return answerTask(s, task, { cardIds: ids });
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: !!task.optional, declineLabel: 'Don’t play one',
        title: task.why, detail: task.triggerAction ? undefined : 'Its Action is ignored.',
      });
      return;
    }

    // ---- action steps ----------------------------------------------------------
    case 'pickTrait': {
      const targets = traitTargets(s, task);
      if (!targets.length) return;
      if (targets.length === 1) return answerTask(s, task, { target: targets[0]! });
      ask(s, task, { kind: 'trait', playerId: task.p, targets, optional: false, title: pickTraitTitle(s, task) });
      return;
    }
    case 'pickPlayer': {
      const ids = playerTargets(s, task);
      if (!ids.length) return;
      if (ids.length === 1) return answerTask(s, task, { playerId: ids[0]! });
      ask(s, task, { kind: 'player', playerId: task.p, playerIds: ids, optional: false, title: pickPlayerTitle(s, task) });
      return;
    }
    case 'pickColor': {
      if (task.mode === 'faithFrom') {
        const have = distinctColors(s, task.p);
        if (!have.length) return;
        ask(s, task, { kind: 'color', playerId: task.p, colors: have, optional: true, declineLabel: 'Leave my colours', title: 'Faith: change all of your traits of which colour?' });
        return;
      }
      const colors = task.mode === 'faithTo' ? DM_SCORING_COLORS.filter((c) => c !== task.from) : [...DM_SCORING_COLORS];
      ask(s, task, { kind: 'color', playerId: task.p, colors, optional: false, title: pickColorTitle(task) });
      return;
    }
    case 'pickDiscard': {
      const ids = s.traitDiscard.filter((c) => canPlayTrait(s, task.p, c)).map((c) => c.id);
      if (!ids.length) {
        pushLog(s, task.p, `Nothing in the discard pile can be played.`, 'normal');
        return;
      }
      if (ids.length === 1) return answerTask(s, task, { cardIds: ids });
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'shown', min: 1, max: 1, optional: false,
        title: task.triggerAction ? 'Selective Memory: play a trait from the discard pile (its Action happens too).' : 'Self-Replicating: play a trait from the discard pile (its Action is ignored).',
      });
      return;
    }
    case 'cleverReveal': {
      const ids = handOf(s, task.opp).map((c) => c.id);
      if (!ids.length) return;
      if (ids.length === 1) return answerTask(s, task, { cardIds: ids });
      ask(s, task, { kind: 'cards', playerId: task.opp, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false, title: `Clever: reveal 1 card from your hand to everyone — ${seatName(s, task.actor)} will steal one of the revealed cards.` });
      return;
    }
    case 'cleverSteal': {
      const ids = s.revealed.filter((r) => handOf(s, r.ownerId).some((c) => c.id === r.cardId)).map((r) => r.cardId);
      if (!ids.length) {
        s.revealed = [];
        return;
      }
      if (ids.length === 1) return answerTask(s, task, { cardIds: ids });
      ask(s, task, { kind: 'cards', playerId: task.actor, cardIds: ids, from: 'shown', min: 1, max: 1, optional: false, title: 'Clever: steal one of the revealed cards and play it immediately.' });
      return;
    }
    case 'nosySteal': {
      const ids = task.cardIds.filter((id) => handOf(s, task.opp).some((c) => c.id === id));
      if (!ids.length) return;
      if (ids.length === 1) return answerTask(s, task, { cardIds: ids });
      ask(s, task, { kind: 'cards', playerId: task.actor, cardIds: ids, from: 'shown', min: 1, max: 1, optional: false, title: `Nosy: you see 2 random cards from ${seatName(s, task.opp)}'s hand. Steal one and play it immediately.` });
      return;
    }
    case 'dotingPick': {
      const ids = handOf(s, task.p).map((c) => c.id);
      if (!ids.length || s.seats.length < 2) return;
      if (ids.length === 1) return answerTask(s, task, { cardIds: ids });
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false, title: 'Doting: choose a card from your hand to give away.' });
      return;
    }
    case 'dotingTo': {
      const opps = opponentsOf(s, task.p);
      if (opps.length === 1) return answerTask(s, task, { playerId: opps[0]! });
      ask(s, task, { kind: 'player', playerId: task.p, playerIds: opps, optional: false, title: 'Doting: who gets the card?' });
      return;
    }
    case 'memory': {
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: `Memory: discard your hand and stabilize (draw ${stabilizeTarget(s, task.p)})?`,
        options: [{ id: 'yes', label: 'Discard and stabilize' }, { id: 'no', label: 'Keep my hand' }],
      });
      return;
    }
    case 'regenDraw':
      regenDraw(s, task.p);
      return;
    case 'prepper': {
      const cats = s.agesPlayed.filter((a) => a.kind === 'catastrophe' && a.catastrophe);
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'Prepper: which catastrophe’s World’s End effect does the world end on?',
        options: cats.map((a) => ({ id: a.catastrophe!, label: `${a.name}: ${a.worldsEndText ?? ''}` })),
      });
      return;
    }
    case 'sneaky': {
      const sneaky = handOf(s, task.p).find((c) => c.id === task.cardId);
      if (!sneaky || !canPlayTrait(s, task.p, sneaky)) return;
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'World’s End: play Sneaky from your hand?',
        options: [{ id: 'play', label: 'Play Sneaky' }, { id: 'keep', label: 'Keep it in my hand' }],
      });
      return;
    }

    // ---- World's End -------------------------------------------------------
    case 'worldsEnd': {
      s.worldsEnd = {
        effect: s.currentAge.catastrophe ?? 'greyGoo',
        resolved: [],
        chosenColor: {},
        colorChange: Object.fromEntries(s.seats.map((x) => [x.id, null])),
        deusDraws: {},
        tiebreak: {},
      };
      s.turnStage = 'resolving';
      pushLog(s, null, 'WORLD’S END! Traits’ World’s End effects resolve in turn order.', 'danger');
      front(s, { t: 'weTraits', order: orderFrom(s, s.firstPlayerIndex), idx: 0 });
      return;
    }
    case 'weTraits': {
      const p = task.order[task.idx];
      if (!p) {
        front(s, { t: 'weCatastrophe' });
        return;
      }
      const pending = pendingWorldsEnd(s, p);
      if (!pending.length) {
        front(s, { ...task, idx: task.idx + 1 });
        return;
      }
      if (pending.length === 1) {
        front(s, { t: 'weResolve', p, cardId: pending[0]!.id }, task);
        return;
      }
      ask(s, task, {
        kind: 'option', playerId: p, optional: false, title: 'World’s End: which of your effects resolves next?',
        options: pending.map((c) => ({ id: String(c.id), label: c.name })),
      });
      return;
    }
    case 'weResolve':
      weResolve(s, task.p, task.cardId);
      return;
    case 'weCatastrophe':
      weCatastrophe(s);
      return;
    case 'weDiscardTrait': {
      const targets = tableauOf(s, task.p)
        .filter((c) => canDiscardFromPile(s, c) && weDiscardMatches(s, task.p, c, task.rule))
        .map((c) => ({ ownerId: task.p, cardId: c.id }));
      if (!targets.length) return;
      if (targets.length === 1) return answerTask(s, task, { target: targets[0]! });
      ask(s, task, { kind: 'trait', playerId: task.p, targets, optional: false, title: `World’s End: discard ${WE_DISCARD_WORDS[task.rule]} from your pile.` });
      return;
    }
    case 'score':
      finishGame(s);
      return;
  }
}

// ============================================================================
// Ages & catastrophes
// ============================================================================

function flipAge(s: DmState) {
  const next = s.ageDeck.shift();
  if (!next) {
    front(s, { t: 'worldsEnd' });
    return;
  }
  s.agesPlayed.push(next);
  s.currentAge = next;
  for (const seat of s.seats) s.peekedAge[seat.id] = null;
  s.turnStage = 'resolving';

  if (next.kind === 'catastrophe') {
    flipCatastrophe(s, next);
    return;
  }

  pushLog(s, null, `New age: ${next.name.trim()} — ${next.text}`, 'normal');
  const order = orderFrom(s, s.firstPlayerIndex);
  const seq: DmTask[] = [];
  switch (next.ruleTag) {
    case 'dracula':
      for (const p of order) seq.push({ t: 'ageRandomDiscard', p });
      for (const p of order) seq.push({ t: 'draculaSteal', p });
      break;
    case 'cometShowers':
      for (const p of order) seq.push({ t: 'ageRandomDiscard', p });
      break;
    case 'reason':
      for (const p of order) seq.push({ t: 'reasonKeep', p, cardIds: [] });
      break;
    case 'alienTerraform':
      for (const p of order) seq.push({ t: 'alienTerraform', p });
      break;
    case 'birthOfAHero':
      for (const p of order) seq.push({ t: 'heroRises', p });
      break;
    case 'flourish':
      for (const p of order) drawCards(s, p, 2);
      break;
    case 'northernWinds':
      for (const p of order) {
        drawCards(s, p, 1);
        seq.push({ t: 'discardFromHand', p, count: 1, why: 'Northern Winds' });
      }
      break;
    default:
      break;
  }
  seq.push({ t: 'beginTurns' });
  front(s, ...seq);
}

/** Did `p`'s Denial ignore this catastrophe? (Dominants never leave a pile, so the owner is stable.) */
function denialIgnores(s: DmState, p: PlayerId, cat: DmAgeCard): boolean {
  return s.spentDenials.some((d) => d.catastropheId === cat.id && tableauOf(s, p).some((c) => c.id === d.cardId));
}

function flipCatastrophe(s: DmState, cat: DmAgeCard) {
  s.catastrophesSeen += 1;
  // "When a catastrophe is drawn: 1st player position moves 1 person to the left."
  s.firstPlayerIndex = (s.firstPlayerIndex + 1) % s.seats.length;
  pushLog(s, null, `CATASTROPHE ${s.catastrophesSeen} of 3: ${cat.name} — ${cat.text}`, 'danger');
  const order = orderFrom(s, s.firstPlayerIndex);

  // Denial: "Ignore the next catastrophe. You cannot ignore The Four Horsemen."
  // UNCONFIRMED: a Denial whose next catastrophe is The Four Horsemen is used up
  // all the same; and Denial ignores the Gene Pool and Catastrophic effects,
  // not the final catastrophe's World's End effect.
  for (const p of order) {
    const denial = tableauOf(s, p).find((c) => c.kind === 'denial' && !s.spentDenials.some((d) => d.cardId === c.id));
    if (!denial) continue;
    if (cat.catastrophe === 'fourHorsemen') {
      s.spentDenials.push({ cardId: denial.id, catastropheId: null });
      pushLog(s, p, `${seatName(s, p)}'s Denial can't ignore The Four Horsemen.`, 'danger');
    } else {
      s.spentDenials.push({ cardId: denial.id, catastropheId: cat.id });
      pushLog(s, p, `${seatName(s, p)}'s Denial ignores ${cat.name}.`, 'good');
    }
  }

  const affected = order.filter((p) => !denialIgnores(s, p, cat));
  for (const p of affected) adjustGenePool(s, p, cat.genePoolDelta, false);

  const seq: DmTask[] = [];
  const tag = cat.catastrophe!;
  if (tag === 'megaTsunami') seq.push({ t: 'passHandsRight' });
  else if (tag === 'theBigOne') {
    for (const p of affected) {
      const to = [...new Set([leftOf(s, p), rightOf(s, p)])].filter((x) => x !== p);
      seq.push({ t: 'bigOneGive', p, to });
    }
    seq.push({ t: 'applyGifts' });
  } else {
    for (const p of affected) seq.push({ t: 'catastropheEffect', p, tag });
  }
  seq.push({ t: 'afterCatastrophe' });
  front(s, ...seq);
}

function catastropheEffect(s: DmState, p: PlayerId, tag: DmCatastropheTag) {
  const hand = handOf(s, p);
  const name = s.currentAge.name;
  const perColor = (col: DmTraitColor) => {
    const n = Math.min(hand.length, countColor(s, p, col));
    if (n > 0) front(s, { t: 'discardFromHand', p, count: n, why: name });
  };
  switch (tag) {
    case 'aiTakeover':
      front(s, { t: 'keepOne', p, why: name });
      return;
    case 'deusExMachina':
      front(s, { t: 'stabilize', p });
      return;
    case 'glacialMeltdown': {
      const n = discardRandomFromHand(s, p, 2).length;
      if (n) pushLog(s, p, `${seatName(s, p)} discarded ${n} random card${n === 1 ? '' : 's'}.`, 'danger');
      return;
    }
    case 'greyGoo':
      discardHandCards(s, p, hand.map((c) => c.id));
      front(s, { t: 'stabilize', p });
      return;
    case 'iceAge':
      perColor('red');
      return;
    case 'massExtinction':
      perColor('colorless');
      return;
    case 'pulseEvent':
      perColor('purple');
      return;
    case 'retrovirus':
      perColor('green');
      return;
    case 'superVolcano':
      perColor('blue');
      return;
    case 'nuclearWinter':
      front(s, { t: 'stabilize', p }, { t: 'discardFromHand', p, count: 1, why: name });
      return;
    case 'overpopulation': {
      const n = distinctColors(s, p).length;
      if (n) drawCards(s, p, n);
      return;
    }
    case 'solarFlare': {
      const n = Math.ceil(hand.length / 2);
      if (n) front(s, { t: 'discardFromHand', p, count: n, why: name });
      return;
    }
    case 'fourHorsemen':
      front(s, { t: 'pickTrait', p, mode: 'discardOwn', srcId: -1 });
      return;
    case 'megaTsunami':
    case 'theBigOne':
      return; // handled for everyone at once in flipCatastrophe
  }
}

/** Optimistic Nihilism: skip every remaining turn and age up to the next catastrophe. */
function triggerNihilism(s: DmState, p: PlayerId) {
  if (s.catastrophesSeen >= 3 || !s.ageDeck.some((a) => a.kind === 'catastrophe')) {
    pushLog(s, p, 'Optimistic Nihilism: there is no catastrophe left to bring about.', 'normal');
    return;
  }
  pushLog(s, p, `${seatName(s, p)}'s Optimistic Nihilism brings on the next catastrophe! All turns are skipped.`, 'danger');
  s.tasks = s.tasks.filter((t) => !FLOW.has(t.t));
  s.tasks.push({ t: 'nihilism' });
  s.turnStage = 'resolving';
}

// ============================================================================
// Playing a trait
// ============================================================================

function needsCost(card: DmTraitCard): boolean {
  return card.kind === 'morality' || card.kind === 'retractable-claws';
}

function execPlay(s: DmState, task: Extract<DmTask, { t: 'play' }>) {
  const { p, cardId, from } = task;
  const inHand = from === 'discard' ? undefined : handOf(s, p).find((c) => c.id === cardId);
  const inDiscard = from === 'discard' ? s.traitDiscard.find((c) => c.id === cardId) : undefined;
  const card = inHand ?? inDiscard;
  if (!card) return;
  if (!canPlayTrait(s, p, card, task.unrestricted)) return;
  if (needsCost(card) && !task.unrestricted && !task.costPaid) {
    front(s, { t: 'payCost', p, cardId, from, triggerAction: task.triggerAction });
    return;
  }
  if (inHand) takeFromHand(s, p, cardId);
  else s.traitDiscard.splice(s.traitDiscard.indexOf(card), 1);

  const into = task.into ?? p;
  addToPile(s, into, card);
  s.lastPlayedColors = printedColors(card);
  const where = into === p ? '' : ` into ${seatName(s, into)}'s pile`;
  const fromWords = from === 'discard' ? ' from the discard pile' : '';
  pushLog(s, p, `${seatName(s, p)} played ${card.name}${fromWords}${where}.`, 'normal');

  const seq: DmTask[] = [];
  const turnPlay = !task.outOfTurn && from !== 'deck';
  if (turnPlay && !card.dominant && s.seats.length > 1) seq.push({ t: 'parasiticWindow', actor: p, cardId: card.id, asked: [] });
  if (card.kind === 'vampirism' || card.kind === 'optimistic-nihilism') seq.push({ t: 'onEnter', p: into, cardId: card.id });
  if (task.triggerAction && card.action && s.currentAge.ruleTag !== 'ignoreActions') {
    seq.push({ t: 'preventWindow', actor: p, srcId: card.id, kind: card.kind, asked: [] });
  }
  if (from === 'hand' && !task.outOfTurn) {
    if (printedColors(card).includes('green')) {
      for (const sr of tableauOf(s, p)) {
        if (sr.kind === 'self-replicating' && sr.id !== card.id) seq.push({ t: 'selfReplicatingReturn', p, srcId: sr.id });
      }
    }
    if (s.currentAge.ruleTag === 'galacticDrift' && printedColors(card).length === 0) seq.push({ t: 'extraPlay', p, rule: 'colorless' });
    if (s.currentAge.ruleTag === 'highTides' && card.effectless) seq.push({ t: 'extraPlay', p, rule: 'effectless' });
  }
  front(s, ...seq);
}

/** Parasitic: "when an opponent plays a trait, steal that trait, stop its action." */
function parasiticWindow(s: DmState, task: Extract<DmTask, { t: 'parasiticWindow' }>) {
  const card = tableauOf(s, task.actor).find((c) => c.id === task.cardId);
  if (!card || !canTake(s, card)) return;
  for (const q of opponentsOf(s, task.actor)) {
    if (task.asked.includes(q)) continue;
    const para = handOf(s, q).find((c) => c.kind === 'parasitic' && canPlayTrait(s, q, c));
    if (!para) continue;
    ask(s, { ...task, asked: [...task.asked, q] }, {
      kind: 'option', playerId: q, optional: false,
      title: `${seatName(s, task.actor)} played ${card.name}. Play Parasitic to steal it and stop its Action?`,
      detail: 'Parasitic (−2) goes into your pile; this doesn’t count as your turn.',
      options: [{ id: 'play', label: `Play Parasitic — steal ${card.name}` }, { id: 'pass', label: 'Let it be' }],
    });
    return;
  }
}

const PREVENTERS: readonly DmTraitKind[] = ['automimicry', 'chromatophores'];

/** Automimicry / Chromatophores: "play from your hand at any time to prevent an action". */
function preventWindow(s: DmState, task: Extract<DmTask, { t: 'preventWindow' }>) {
  const src = findCard(s, task.srcId);
  const order = [...opponentsOf(s, task.actor), task.actor];
  for (const q of order) {
    if (task.asked.includes(q)) continue;
    const cards = handOf(s, q).filter((c) => PREVENTERS.includes(c.kind) && canPlayTrait(s, q, c));
    if (!cards.length) continue;
    const kinds = [...new Set(cards.map((c) => c.kind))];
    const whose = q === task.actor ? 'your own' : `${seatName(s, task.actor)}'s`;
    ask(s, { ...task, asked: [...task.asked, q] }, {
      kind: 'option', playerId: q, optional: false,
      title: `Stop ${whose} ${src?.name ?? 'trait'} Action?`,
      detail: src?.text,
      options: [
        ...kinds.map((k) => {
          const c = cards.find((x) => x.kind === k)!;
          return { id: k, label: `Play ${c.name} (${c.points}) to stop it` };
        }),
        { id: 'pass', label: 'Let it happen' },
      ],
    });
    return;
  }
  front(s, { t: 'action', actor: task.actor, srcId: task.srcId, kind: task.kind });
}

function regenDraw(s: DmState, p: PlayerId) {
  const [card] = drawCards(s, p, 1);
  if (!card) return;
  const block = playBlock(s, p, card);
  pushLog(s, p, `Regenerative Tissue: ${seatName(s, p)} drew a card to play.`, 'normal');
  if (!block) {
    front(s, { t: 'play', p, cardId: card.id, from: 'deck', triggerAction: false });
  } else if (block.kind !== 'age') {
    // "If it's played randomly and you cannot fulfill the requirement, discard it" / a 3rd Dominant is discarded.
    takeFromHand(s, p, card.id);
    s.traitDiscard.push(card);
    pushLog(s, p, `${card.name} couldn't be played and was discarded.`, 'normal');
  }
}

// ============================================================================
// Trait actions
// ============================================================================

function execAction(s: DmState, actor: PlayerId, srcId: number, kind: DmTraitKind) {
  const src = findCard(s, srcId);
  const name = src?.name ?? 'The trait';
  const opps = opponentsOf(s, actor);
  const srcInMyPile = tableauOf(s, actor).some((c) => c.id === srcId);
  switch (kind) {
    case 'bad':
      for (const o of opps) {
        const n = discardRandomFromHand(s, o, 2).length;
        if (n) pushLog(s, o, `${seatName(s, o)} discarded ${n} random card${n === 1 ? '' : 's'} (Bad).`, 'danger');
      }
      return;
    case 'clever':
      s.revealed = [];
      front(s, ...opps.filter((o) => handOf(s, o).length > 0).map((o): DmTask => ({ t: 'cleverReveal', actor, opp: o })), { t: 'cleverSteal', actor });
      return;
    case 'cold-blood': {
      const drawn = drawCards(s, actor, 3);
      pushLog(s, actor, `${seatName(s, actor)} drew ${drawn.length} (Cold Blood).`, 'normal');
      if (drawn.length) front(s, { t: 'playAnother', p: actor, why: 'Cold Blood: you may play one of the cards you just drew.', triggerAction: true, cardIds: drawn.map((c) => c.id), optional: true });
      return;
    }
    case 'costly-signaling':
      front(s, { t: 'pickTrait', p: actor, mode: 'returnToHand', srcId }, { t: 'playAnother', p: actor, why: 'Costly Signaling: play another trait.', triggerAction: true });
      return;
    case 'directly-register':
    case 'selfish':
    case 'tiny-little-melons':
      front(s, { t: 'pickTrait', p: actor, mode: 'steal', srcId, filter: kind });
      return;
    case 'doting':
      front(s, { t: 'dotingPick', p: actor });
      return;
    case 'flight':
      front(s, { t: 'pickPlayer', p: actor, mode: 'swapHands', srcId });
      return;
    case 'hot-temper':
      front(s, { t: 'discardFromHand', p: actor, count: 2, why: name });
      return;
    case 'sweat':
      front(s, { t: 'discardFromHand', p: actor, count: 1, why: name });
      return;
    case 'impatience':
      front(s, { t: 'pickPlayer', p: actor, mode: 'stealRandom2', srcId });
      return;
    case 'introspective':
    case 'iridescent-scales': {
      const n = drawCards(s, actor, kind === 'introspective' ? 4 : 3).length;
      pushLog(s, actor, `${seatName(s, actor)} drew ${n} (${name}).`, 'normal');
      return;
    }
    case 'inventive':
    case 'painted-shell':
      front(s, { t: 'pickTrait', p: actor, mode: 'borrowAction', srcId, filter: kind });
      return;
    case 'memory':
      front(s, { t: 'memory', p: actor });
      return;
    case 'nosy':
      front(s, { t: 'pickPlayer', p: actor, mode: 'nosy', srcId });
      return;
    case 'persuasive':
      front(s, { t: 'pickColor', p: actor, mode: 'persuasive', srcId });
      return;
    case 'photosynthesis': {
      const drawn = drawCards(s, actor, 2);
      pushLog(s, actor, `${seatName(s, actor)} drew ${drawn.length} (Photosynthesis).`, 'normal');
      const greens = drawn.filter((c) => printedColors(c).includes('green')).map((c) => c.id);
      if (greens.length) front(s, { t: 'playAnother', p: actor, why: 'Photosynthesis: you drew a green trait — play one now.', triggerAction: true, cardIds: greens });
      return;
    }
    case 'poisonous':
      if (srcInMyPile) front(s, { t: 'pickTrait', p: actor, mode: 'swapWithSource', srcId });
      return;
    case 'propagation':
      front(s, { t: 'playAnother', p: actor, why: 'Propagation: play another trait.', triggerAction: true });
      return;
    case 'the-third-eye': {
      const next = s.ageDeck[0];
      if (next) {
        s.peekedAge[actor] = next.id;
        pushLog(s, actor, `${seatName(s, actor)} peeked at the next age (The Third Eye).`, 'normal');
      }
      front(s, { t: 'playAnother', p: actor, why: 'The Third Eye: play another trait.', triggerAction: true });
      return;
    }
    case 'reckless':
      front(s, { t: 'pickPlayer', p: actor, mode: 'reckless', srcId });
      return;
    case 'scutes':
      front(s, { t: 'pickTrait', p: actor, mode: 'giveOwn', srcId });
      return;
    case 'selective-memory':
      front(s, { t: 'pickDiscard', p: actor, srcId, triggerAction: true });
      return;
    case 'self-replicating':
      front(s, { t: 'pickDiscard', p: actor, srcId, triggerAction: false });
      return;
    case 'telekinetic':
    case 'tentacles':
      front(s, { t: 'pickTrait', p: actor, mode: 'swapOwn', srcId, filter: kind });
      return;
    case 'territorial':
      front(s, ...opps.map((o): DmTask => ({ t: 'pickTrait', p: o, mode: 'territorial', srcId })));
      return;
    case 'trunk': {
      const top = s.traitDiscard[s.traitDiscard.length - 1];
      if (top && canPlayTrait(s, actor, top)) front(s, { t: 'play', p: actor, cardId: top.id, from: 'discard', triggerAction: false });
      else pushLog(s, actor, 'Trunk: the top of the discard pile can’t be played.', 'normal');
      return;
    }
    case 'venomous': {
      const seq: DmTask[] = [{ t: 'playAnother', p: actor, why: 'Venomous: play another trait (then Venomous moves to an opponent).', triggerAction: true }];
      if (srcInMyPile) seq.push({ t: 'pickPlayer', p: actor, mode: 'moveSource', srcId });
      front(s, ...seq);
      return;
    }
    case 'voracious':
      front(s, { t: 'playAnother', p: actor, why: 'Voracious: play another trait (then discard a trait from your pile).', triggerAction: true }, { t: 'pickTrait', p: actor, mode: 'discardOwn', srcId });
      return;
    default:
      return;
  }
}

// ---- choosing traits in piles -------------------------------------------------------

type PickTraitTask = Extract<DmTask, { t: 'pickTrait' }>;

function isColoured(cols: DmTraitColor[]): boolean {
  return cols.length > 0;
}

/** Telekinetic: a different colour (no shared colour; both coloured). Tentacles: a shared colour. */
function swapMatches(rule: DmTraitKind | undefined, mine: DmTraitColor[], theirs: DmTraitColor[]): boolean {
  if (!isColoured(mine) || !isColoured(theirs)) return false;
  const shared = mine.some((c) => theirs.includes(c));
  return rule === 'tentacles' ? shared : !shared;
}

const BORROWABLE_EXCLUDED: readonly DmTraitKind[] = ['inventive', 'painted-shell'];

function traitTargets(s: DmState, task: PickTraitTask): { ownerId: PlayerId; cardId: number }[] {
  const p = task.p;
  const out: { ownerId: PlayerId; cardId: number }[] = [];
  const add = (ownerId: PlayerId, pred: (c: DmTraitCard) => boolean) => {
    for (const c of tableauOf(s, ownerId)) if (pred(c)) out.push({ ownerId, cardId: c.id });
  };
  const opps = opponentsOf(s, p);
  const colorsOf = (owner: PlayerId, c: DmTraitCard) => traitColorsFor(s, owner, c);
  switch (task.mode) {
    case 'steal':
    case 'vampirism':
      for (const o of opps) {
        add(o, (c) => {
          if (!canTake(s, c)) return false;
          if (task.filter === 'directly-register') return faceValue(c) === 1;
          if (task.filter === 'selfish') return colorsOf(o, c).includes('red');
          if (task.filter === 'tiny-little-melons') return colorsOf(o, c).includes('green');
          return true;
        });
      }
      break;
    case 'returnToHand':
      for (const o of opps) add(o, canMove);
      break;
    case 'swapWithSource': {
      const src = tableauOf(s, p).find((c) => c.id === task.srcId);
      if (!src || !canTake(s, src)) break;
      for (const o of opps) add(o, (c) => canTake(s, c));
      break;
    }
    case 'swapOwn':
      add(p, (mine) => canTake(s, mine) && opps.some((o) => tableauOf(s, o).some((t) => canTake(s, t) && swapMatches(task.filter, colorsOf(p, mine), colorsOf(o, t)))));
      break;
    case 'swapTheirs': {
      const mine = tableauOf(s, p).find((c) => c.id === task.ref);
      if (!mine) break;
      for (const o of opps) add(o, (t) => canTake(s, t) && swapMatches(task.filter, colorsOf(p, mine), colorsOf(o, t)));
      break;
    }
    case 'giveOwn':
      if (opps.length) add(p, canMove);
      break;
    case 'discardOwn':
      add(p, (c) => canDiscardFromPile(s, c));
      break;
    case 'discardTheirs':
      if (task.owner) add(task.owner, (c) => canDiscardFromPile(s, c) && c.id !== task.srcId);
      break;
    case 'territorial':
      add(p, (c) => canDiscardFromPile(s, c) && colorsOf(p, c).includes('red'));
      break;
    case 'borrowAction':
      if (task.filter === 'inventive') for (const o of opps) add(o, (c) => !!c.action && !BORROWABLE_EXCLUDED.includes(c.kind));
      else add(p, (c) => !!c.action && c.id !== task.srcId && !BORROWABLE_EXCLUDED.includes(c.kind));
      break;
    case 'moralityGift':
      add(p, (c) => canMove(c) && faceValue(c) > 0);
      break;
    case 'clawsCost':
      add(p, (c) => canDiscardFromPile(s, c) && colorsOf(p, c).includes('red'));
      break;
  }
  return out;
}

function pickTraitTitle(s: DmState, task: PickTraitTask): string {
  switch (task.mode) {
    case 'steal':
      return task.filter === 'directly-register' ? 'Directly Register: steal a trait with face value 1.'
        : task.filter === 'selfish' ? 'Selfish: steal a red trait from an opponent.'
        : task.filter === 'tiny-little-melons' ? 'Tiny Little Melons: steal a green trait from an opponent.'
        : 'Steal a trait from an opponent’s pile.';
    case 'vampirism': return 'Vampirism: steal a trait from an opponent’s pile (you then play its Action).';
    case 'returnToHand': return 'Costly Signaling: return an opponent’s trait to their hand.';
    case 'swapWithSource': return 'Poisonous: swap Poisonous with a trait in an opponent’s pile.';
    case 'swapOwn': return `${task.filter === 'tentacles' ? 'Tentacles' : 'Telekinetic'}: choose the trait from your pile to swap away.`;
    case 'swapTheirs': return `${task.filter === 'tentacles' ? 'Tentacles' : 'Telekinetic'}: choose the opponent’s trait to take (${task.filter === 'tentacles' ? 'same' : 'a different'} colour).`;
    case 'giveOwn': return 'Scutes: choose a trait from your pile to give away.';
    case 'discardOwn': return task.srcId === -1 ? 'The Four Horsemen: discard a trait from your pile.' : 'Voracious: discard a trait from your pile.';
    case 'discardTheirs': return task.owner === task.p ? 'Discard a trait.' : `Reckless: discard a trait from ${seatName(s, task.owner ?? null)}'s pile.`;
    case 'territorial': return 'Territorial: discard a red trait from your pile.';
    case 'borrowAction': return task.filter === 'inventive' ? 'Inventive: choose an opponent’s trait whose Action you play.' : 'Painted Shell: choose another trait in your pile whose Action you play.';
    case 'moralityGift': return 'Morality: to play it, choose a positive-value trait from your pile to give away.';
    case 'clawsCost': return 'Retractable Claws: to play it, discard a red trait from your pile.';
  }
}

// ---- choosing players & colours -----------------------------------------------------------

type PickPlayerTask = Extract<DmTask, { t: 'pickPlayer' }>;

function playerTargets(s: DmState, task: PickPlayerTask): PlayerId[] {
  const opps = opponentsOf(s, task.p);
  switch (task.mode) {
    case 'stealRandom2':
    case 'nosy':
      return opps.filter((o) => handOf(s, o).length > 0);
    case 'moveSource':
      return tableauOf(s, task.p).some((c) => c.id === task.srcId) ? opps : [];
    case 'giveTrait':
      return tableauOf(s, task.p).some((c) => c.id === task.ref) ? opps : [];
    default:
      return opps;
  }
}

function pickPlayerTitle(s: DmState, task: PickPlayerTask): string {
  switch (task.mode) {
    case 'swapHands': return 'Flight: swap hands with which opponent?';
    case 'stealRandom2': return 'Impatience: steal 2 random cards from whose hand?';
    case 'nosy': return 'Nosy: look at 2 random cards from whose hand?';
    case 'moveSource': return 'Venomous: move Venomous into whose pile?';
    case 'giveTrait': return `Scutes: who gets your ${findCard(s, task.ref ?? -1)?.name ?? 'trait'}?`;
    case 'reckless': return 'Reckless: which opponent? You each discard a trait from the other’s pile.';
  }
}

function pickColorTitle(task: Extract<DmTask, { t: 'pickColor' }>): string {
  switch (task.mode) {
    case 'persuasive': return 'Persuasive: choose a colour. Everyone discards every card of that colour from their hand.';
    case 'hyperIntelligence': return 'Hyper-Intelligence: choose a colour. Every opponent discards a random trait of that colour.';
    case 'sentience': return 'Sentience: choose a colour. +1 for each of your traits of that colour.';
    case 'viral': return 'Viral: choose a colour. Opponents get −1 for each trait of that colour.';
    case 'faithFrom': return 'Faith: change all of your traits of which colour?';
    case 'faithTo': return `Faith: your ${task.from} traits become which colour?`;
  }
}

// ============================================================================
// Answers
// ============================================================================

function answerTask(s: DmState, task: DmTask, a: Answer) {
  switch (task.t) {
    case 'enlightenment': {
      const ids = a.decline ? [] : a.cardIds ?? [];
      discardHandCards(s, task.p, ids);
      if (ids.length) pushLog(s, task.p, `${seatName(s, task.p)} discarded ${ids.length} (Enlightenment).`, 'normal');
      return;
    }
    case 'stabilizeChoice':
      if (a.optionId === 'skip') {
        pushLog(s, task.p, `${seatName(s, task.p)} chose not to stabilize (Prosperity).`, 'normal');
      } else if (a.optionId === 'nietzsche') {
        discardHandCards(s, task.p, handOf(s, task.p).map((c) => c.id));
        drawCards(s, task.p, 3);
        pushLog(s, task.p, `${seatName(s, task.p)} discarded their hand and drew 3 (Age of Nietzsche).`, 'normal');
      } else {
        front(s, { t: 'stabilize', p: task.p }, { t: 'afterStabilize', p: task.p });
      }
      return;
    case 'stabilize':
    case 'discardFromHand': {
      const ids = a.cardIds ?? [];
      discardHandCards(s, task.p, ids);
      pushLog(s, task.p, `${seatName(s, task.p)} discarded ${ids.length} card${ids.length === 1 ? '' : 's'}.`, 'normal');
      return;
    }
    case 'late':
      if (a.optionId === 'play') {
        const late = handOf(s, task.p).find((c) => c.kind === 'late');
        if (late) front(s, { t: 'play', p: task.p, cardId: late.id, from: 'hand', triggerAction: false, outOfTurn: true });
      }
      return;
    case 'draculaSteal':
      if (a.playerId && stealRandomFromHand(s, a.playerId, task.p, 1)) {
        pushLog(s, task.p, `${seatName(s, task.p)} stole a random card from ${seatName(s, a.playerId)} (Age of Dracula).`, 'normal');
      }
      return;
    case 'reasonKeep': {
      const keep = a.cardIds?.[0];
      discardHandCards(s, task.p, task.cardIds.filter((id) => id !== keep));
      return;
    }
    case 'alienTerraform': {
      const ids = a.decline ? [] : a.cardIds ?? [];
      if (!ids.length) return;
      discardHandCards(s, task.p, ids);
      pushLog(s, task.p, `${seatName(s, task.p)} discarded ${ids.length} Dominant card${ids.length === 1 ? '' : 's'} and stabilizes (Alien Terraform).`, 'normal');
      front(s, { t: 'stabilize', p: task.p });
      return;
    }
    case 'keepOne': {
      const keep = a.cardIds?.[0];
      discardHandCards(s, task.p, handOf(s, task.p).map((c) => c.id).filter((id) => id !== keep));
      pushLog(s, task.p, `${seatName(s, task.p)} kept 1 card and discarded the rest.`, 'danger');
      return;
    }
    case 'bigOneGive': {
      const id = a.cardIds?.[0];
      const to = task.to[0];
      if (id !== undefined && to) s.pendingGifts.push({ from: task.p, to, cardId: id });
      return;
    }
    case 'moralityTo': {
      if (!a.playerId) return;
      const gift = moveTrait(s, task.p, a.playerId, task.giftId);
      if (gift) pushLog(s, task.p, `${seatName(s, task.p)} gave ${gift.name} to ${seatName(s, a.playerId)} (Morality).`, 'normal');
      front(s, { t: 'play', p: task.p, cardId: task.cardId, from: task.from, triggerAction: task.triggerAction, costPaid: true });
      return;
    }
    case 'parasiticWindow': {
      if (a.optionId !== 'play') {
        front(s, task);
        return;
      }
      const q = task.asked[task.asked.length - 1]!;
      const para = handOf(s, q).find((c) => c.kind === 'parasitic');
      const stolen = tableauOf(s, task.actor).find((c) => c.id === task.cardId);
      if (!para || !stolen) return;
      takeFromHand(s, q, para.id);
      addToPile(s, q, para);
      s.lastPlayedColors = printedColors(para);
      moveTrait(s, task.actor, q, stolen.id);
      // "Stop its action": drop the stolen trait's pending action.
      s.tasks = s.tasks.filter((t) => !((t.t === 'preventWindow' || t.t === 'action') && t.srcId === stolen.id));
      pushLog(s, q, `${seatName(s, q)} played Parasitic and stole ${stolen.name} from ${seatName(s, task.actor)}! Its Action is stopped.`, 'danger');
      return;
    }
    case 'preventWindow': {
      if (!a.optionId || a.optionId === 'pass') {
        front(s, task);
        return;
      }
      const q = task.asked[task.asked.length - 1]!;
      const blocker = handOf(s, q).find((c) => c.kind === a.optionId);
      if (!blocker) {
        front(s, task);
        return;
      }
      takeFromHand(s, q, blocker.id);
      addToPile(s, q, blocker);
      s.lastPlayedColors = printedColors(blocker);
      const src = findCard(s, task.srcId);
      pushLog(s, q, `${seatName(s, q)} played ${blocker.name} and stopped ${src?.name ?? 'the'} Action!`, 'danger');
      return;
    }
    case 'selfReplicatingReturn':
      if (a.optionId === 'return') {
        returnToHand(s, task.p, task.srcId);
        pushLog(s, task.p, `${seatName(s, task.p)} returned Self-Replicating to their hand.`, 'normal');
      }
      return;
    case 'extraPlay':
    case 'playAnother': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      if (id === undefined) return;
      front(s, { t: 'play', p: task.p, cardId: id, from: 'hand', triggerAction: task.t === 'extraPlay' ? true : task.triggerAction });
      return;
    }
    case 'pickTrait':
      answerPickTrait(s, task, a.target!);
      return;
    case 'pickPlayer':
      answerPickPlayer(s, task, a.playerId!);
      return;
    case 'pickColor':
      answerPickColor(s, task, a);
      return;
    case 'pickDiscard': {
      const id = a.cardIds?.[0];
      if (id !== undefined) front(s, { t: 'play', p: task.p, cardId: id, from: 'discard', triggerAction: task.triggerAction });
      return;
    }
    case 'cleverReveal': {
      const id = a.cardIds?.[0];
      if (id === undefined) return;
      s.revealed.push({ ownerId: task.opp, cardId: id });
      pushLog(s, task.opp, `${seatName(s, task.opp)} revealed ${findCard(s, id)?.name ?? 'a card'} (Clever).`, 'normal');
      return;
    }
    case 'cleverSteal':
    case 'nosySteal': {
      const id = a.cardIds?.[0];
      s.revealed = [];
      if (id === undefined) return;
      const owner = ownerOfHandCard(s, id);
      if (!owner) return;
      const card = takeFromHand(s, owner, id)!;
      handOf(s, task.actor).push(card);
      pushLog(s, task.actor, `${seatName(s, task.actor)} stole ${card.name} from ${seatName(s, owner)} and plays it.`, 'normal');
      // UNCONFIRMED: the stolen card goes to your hand ("steal from a hand → put
      // it in your hand"), so playing it immediately is a play from your hand
      // and its Action happens. If it can't legally be played, it stays in hand.
      front(s, { t: 'play', p: task.actor, cardId: id, from: 'hand', triggerAction: true });
      return;
    }
    case 'dotingPick': {
      const id = a.cardIds?.[0];
      if (id !== undefined) front(s, { t: 'dotingTo', p: task.p, cardId: id });
      return;
    }
    case 'dotingTo': {
      const card = a.playerId ? takeFromHand(s, task.p, task.cardId) : null;
      if (card && a.playerId) {
        handOf(s, a.playerId).push(card);
        pushLog(s, task.p, `${seatName(s, task.p)} gave a card to ${seatName(s, a.playerId)} (Doting).`, 'normal');
      }
      return;
    }
    case 'memory':
      if (a.optionId === 'yes') {
        discardHandCards(s, task.p, handOf(s, task.p).map((c) => c.id));
        pushLog(s, task.p, `${seatName(s, task.p)} discarded their hand (Memory).`, 'normal');
        front(s, { t: 'stabilize', p: task.p });
      }
      return;
    case 'prepper':
      if (s.worldsEnd && a.optionId) {
        s.worldsEnd.effect = a.optionId as DmCatastropheTag;
        const cat = s.agesPlayed.find((x) => x.catastrophe === a.optionId);
        pushLog(s, task.p, `${seatName(s, task.p)}'s Prepper: the world ends on ${cat?.name ?? 'that catastrophe'}'s World's End effect.`, 'good');
      }
      return;
    case 'sneaky':
      if (a.optionId === 'play') front(s, { t: 'play', p: task.p, cardId: task.cardId, from: 'hand', triggerAction: false, outOfTurn: true });
      return;
    case 'weTraits': {
      const id = Number(a.optionId);
      front(s, { t: 'weResolve', p: task.order[task.idx]!, cardId: id }, task);
      return;
    }
    case 'weDiscardTrait':
      if (a.target) discardFromPile(s, task.p, a.target.cardId);
      return;
    default:
      throw new Error(`task ${task.t} takes no answer`);
  }
}

function answerPickTrait(s: DmState, task: PickTraitTask, target: { ownerId: PlayerId; cardId: number }) {
  const p = task.p;
  const card = tableauOf(s, target.ownerId).find((c) => c.id === target.cardId);
  if (!card) return;
  switch (task.mode) {
    case 'steal':
    case 'vampirism': {
      moveTrait(s, target.ownerId, p, card.id);
      pushLog(s, p, `${seatName(s, p)} stole ${card.name} from ${seatName(s, target.ownerId)}.`, 'danger');
      if (task.mode === 'vampirism' && card.action) front(s, { t: 'preventWindow', actor: p, srcId: card.id, kind: card.kind, asked: [] });
      return;
    }
    case 'returnToHand':
      returnToHand(s, target.ownerId, card.id);
      pushLog(s, p, `${seatName(s, p)} returned ${card.name} to ${seatName(s, target.ownerId)}'s hand.`, 'danger');
      return;
    case 'swapWithSource': {
      const src = tableauOf(s, p).find((c) => c.id === task.srcId);
      if (!src) return;
      moveTrait(s, target.ownerId, p, card.id);
      moveTrait(s, p, target.ownerId, src.id);
      pushLog(s, p, `${seatName(s, p)} swapped ${src.name} for ${seatName(s, target.ownerId)}'s ${card.name}.`, 'danger');
      return;
    }
    case 'swapOwn':
      front(s, { t: 'pickTrait', p, mode: 'swapTheirs', srcId: task.srcId, ref: card.id, filter: task.filter });
      return;
    case 'swapTheirs': {
      const mine = tableauOf(s, p).find((c) => c.id === task.ref);
      if (!mine) return;
      moveTrait(s, target.ownerId, p, card.id);
      moveTrait(s, p, target.ownerId, mine.id);
      pushLog(s, p, `${seatName(s, p)} swapped their ${mine.name} for ${seatName(s, target.ownerId)}'s ${card.name}.`, 'danger');
      return;
    }
    case 'giveOwn':
      front(s, { t: 'pickPlayer', p, mode: 'giveTrait', srcId: task.srcId, ref: card.id });
      return;
    case 'discardOwn':
    case 'discardTheirs':
    case 'territorial':
    case 'clawsCost':
    {
      const before = s.tasks.length;
      discardFromPile(s, target.ownerId, card.id);
      if (task.mode === 'clawsCost' && task.cost) {
        // Regenerative Tissue's draw (queued at the front by the discard) is
        // played "immediately", so Retractable Claws enters after it.
        const added = s.tasks.length - before;
        s.tasks.splice(added, 0, { t: 'play', p, cardId: task.srcId, from: task.cost.from, triggerAction: task.cost.triggerAction, costPaid: true });
      }
      return;
    }
    case 'borrowAction':
      pushLog(s, p, `${seatName(s, p)} plays the Action of ${card.name}.`, 'normal');
      front(s, { t: 'preventWindow', actor: p, srcId: card.id, kind: card.kind, asked: [] });
      return;
    case 'moralityGift':
      front(s, { t: 'moralityTo', p, cardId: task.srcId, giftId: card.id, from: task.cost?.from ?? 'hand', triggerAction: task.cost?.triggerAction ?? true });
      return;
  }
}

function answerPickPlayer(s: DmState, task: PickPlayerTask, target: PlayerId) {
  const p = task.p;
  switch (task.mode) {
    case 'swapHands': {
      const mine = handOf(s, p);
      s.hands[p] = handOf(s, target);
      s.hands[target] = mine;
      pushLog(s, p, `${seatName(s, p)} swapped hands with ${seatName(s, target)} (Flight).`, 'danger');
      return;
    }
    case 'stealRandom2': {
      const n = stealRandomFromHand(s, target, p, 2);
      pushLog(s, p, `${seatName(s, p)} stole ${n} random card${n === 1 ? '' : 's'} from ${seatName(s, target)} (Impatience).`, 'danger');
      return;
    }
    case 'nosy': {
      const hand = [...handOf(s, target)];
      const seen: number[] = [];
      for (let i = 0; i < 2 && hand.length; i++) seen.push(hand.splice(rngInt(s.rngState, hand.length), 1)[0]!.id);
      pushLog(s, p, `${seatName(s, p)} looks at 2 random cards from ${seatName(s, target)}'s hand (Nosy).`, 'normal');
      front(s, { t: 'nosySteal', actor: p, opp: target, cardIds: seen });
      return;
    }
    case 'moveSource': {
      const moved = moveTrait(s, p, target, task.srcId);
      if (moved) pushLog(s, p, `${seatName(s, p)} moved ${moved.name} into ${seatName(s, target)}'s pile.`, 'danger');
      return;
    }
    case 'giveTrait': {
      const moved = moveTrait(s, p, target, task.ref ?? -1);
      if (moved) pushLog(s, p, `${seatName(s, p)} gave ${moved.name} to ${seatName(s, target)}.`, 'normal');
      return;
    }
    case 'reckless':
      front(
        s,
        { t: 'pickTrait', p, mode: 'discardTheirs', srcId: task.srcId, owner: target },
        { t: 'pickTrait', p: target, mode: 'discardTheirs', srcId: task.srcId, owner: p },
      );
      return;
  }
}

function answerPickColor(s: DmState, task: Extract<DmTask, { t: 'pickColor' }>, a: Answer) {
  const p = task.p;
  const col = a.color;
  if (task.mode === 'faithFrom') {
    if (a.decline || !col) return;
    front(s, { t: 'pickColor', p, mode: 'faithTo', srcId: task.srcId, from: col });
    return;
  }
  if (!col) return;
  switch (task.mode) {
    case 'persuasive':
      for (const seat of s.seats) {
        const ids = handOf(s, seat.id).filter((c) => printedColors(c).includes(col)).map((c) => c.id);
        discardHandCards(s, seat.id, ids);
        if (ids.length) pushLog(s, seat.id, `${seatName(s, seat.id)} discarded ${ids.length} ${col} card${ids.length === 1 ? '' : 's'} (Persuasive).`, 'danger');
      }
      return;
    case 'hyperIntelligence':
      pushLog(s, p, `${seatName(s, p)}'s Hyper-Intelligence names ${col}.`, 'danger');
      for (const o of opponentsOf(s, p)) {
        const pool = tableauOf(s, o).filter((c) => canDiscardFromPile(s, c) && traitColorsFor(s, o, c).includes(col));
        if (!pool.length) continue;
        discardFromPile(s, o, pool[rngInt(s.rngState, pool.length)]!.id);
      }
      return;
    case 'sentience':
    case 'viral':
      if (s.worldsEnd) s.worldsEnd.chosenColor[task.srcId] = col;
      pushLog(s, p, `${seatName(s, p)}'s ${task.mode === 'viral' ? 'Viral' : 'Sentience'} names ${col}.`, 'normal');
      return;
    case 'faithTo':
      if (s.worldsEnd && task.from) {
        s.worldsEnd.colorChange[p] = { from: task.from, to: col };
        pushLog(s, p, `${seatName(s, p)}'s Faith turns their ${task.from} traits ${col}.`, 'normal');
      }
      return;
  }
}

// ============================================================================
// World's End & scoring
// ============================================================================

function pendingWorldsEnd(s: DmState, p: PlayerId): DmTraitCard[] {
  const done = s.worldsEnd?.resolved ?? [];
  const pile = tableauOf(s, p).filter((c) => c.worldsEnd && c.kind !== 'sneaky' && !done.includes(c.id));
  const sneaky = handOf(s, p).filter((c) => c.kind === 'sneaky' && !done.includes(c.id) && canPlayTrait(s, p, c));
  return [...pile, ...sneaky];
}

function weResolve(s: DmState, p: PlayerId, cardId: number) {
  const card = findCard(s, cardId);
  if (!card || !s.worldsEnd) return;
  s.worldsEnd.resolved.push(cardId);
  switch (card.kind) {
    case 'eloquence':
      front(s, { t: 'playAnother', p, why: 'Eloquence: play another trait (its Action is ignored).', triggerAction: false });
      return;
    case 'faith':
      front(s, { t: 'pickColor', p, mode: 'faithFrom', srcId: cardId });
      return;
    case 'hyper-intelligence':
      front(s, { t: 'pickColor', p, mode: 'hyperIntelligence', srcId: cardId });
      return;
    case 'sentience':
      front(s, { t: 'pickColor', p, mode: 'sentience', srcId: cardId });
      return;
    case 'viral':
      front(s, { t: 'pickColor', p, mode: 'viral', srcId: cardId });
      return;
    case 'prepper':
      front(s, { t: 'prepper', p });
      return;
    case 'sneaky':
      front(s, { t: 'sneaky', p, cardId });
      return;
    default:
      return;
  }
}

const WE_DISCARD_WORDS = { blue: 'a blue trait', green: 'a green trait', red: 'a red trait', purple: 'a purple trait', colorless: 'a colorless trait', face4: 'a trait with face value 4 or more' } as const;

function weDiscardMatches(s: DmState, p: PlayerId, c: DmTraitCard, rule: keyof typeof WE_DISCARD_WORDS): boolean {
  if (rule === 'face4') return faceValue(c) >= 4;
  if (rule === 'colorless') return printedColors(c).length === 0;
  return traitColorsFor(s, p, c).includes(rule);
}

function weCatastrophe(s: DmState) {
  const we = s.worldsEnd!;
  const cat = s.agesPlayed.find((a) => a.catastrophe === we.effect);
  pushLog(s, null, `The final World's End effect: ${cat?.name ?? we.effect} — ${cat?.worldsEndText ?? ''}`, 'danger');
  const order = orderFrom(s, s.firstPlayerIndex);
  const discardRule: Partial<Record<DmCatastropheTag, keyof typeof WE_DISCARD_WORDS>> = {
    glacialMeltdown: 'blue', massExtinction: 'green', megaTsunami: 'red', nuclearWinter: 'colorless', pulseEvent: 'purple', fourHorsemen: 'face4',
  };
  const rule = discardRule[we.effect];
  const seq: DmTask[] = [];
  if (rule) for (const p of order) seq.push({ t: 'weDiscardTrait', p, rule });
  if (we.effect === 'deusExMachina') {
    for (const p of order) {
      const [card] = drawCards(s, p, 1);
      if (!card) continue;
      takeFromHand(s, p, card.id);
      s.traitDiscard.push(card);
      we.deusDraws[p] = Math.min(5, faceValue(card));
      pushLog(s, p, `${seatName(s, p)} drew ${card.name}: ${we.deusDraws[p]! >= 0 ? '+' : ''}${we.deusDraws[p]} (Deus Ex Machina).`, 'normal');
    }
  }
  seq.push({ t: 'score' });
  front(s, ...seq);
}

export interface DmScore {
  faceValue: number;
  dropOfLifeBonus: number;
  worldsEndBonus: number;
  total: number;
  /** Some bonus depends on cards in a hand the viewer can't see (left out of the total). */
  hiddenBonus: boolean;
}

/** Drop of Life bonuses that read the contents (not just the size) of their owner's hand. */
const HAND_CONTENT_BONUS: ReadonlySet<DmTraitKind> = new Set(['boredom', 'brave', 'saudade']);

/** AI Takeover's World's End: non-Dominant colorless traits are worth 2 and their effects are ignored. */
function aiTakeoverHits(s: DmState, card: DmTraitCard): boolean {
  return s.worldsEnd?.effect === 'aiTakeover' && !card.dominant && printedColors(card).length === 0;
}

function effectiveFace(s: DmState, card: DmTraitCard): number {
  return aiTakeoverHits(s, card) ? 2 : faceValue(card);
}

/**
 * One trait's Drop of Life bonus (0 for traits without one). `handVisible`
 * false = the viewer can't see p's hand, so hand-content bonuses count 0.
 */
export function dropOfLifeOf(s: DmState, p: PlayerId, card: DmTraitCard, handVisible = true): number {
  if (aiTakeoverHits(s, card)) return 0;
  if (!handVisible && HAND_CONTENT_BONUS.has(card.kind)) return 0;
  const pile = tableauOf(s, p);
  const hand = handOf(s, p);
  switch (card.kind) {
    case 'altruistic':
    case 'random-fertilization':
      return genePoolOf(s, p);
    case 'apex-predator':
      return opponentsOf(s, p).every((o) => tableauOf(s, o).length < pile.length) ? 4 : 0;
    case 'boredom':
      return hand.filter((c) => !c.effectless).length;
    case 'branches':
      return opponentsOf(s, p).reduce((n, o) => n + Math.floor(countColor(s, o, 'green') / 2), 0);
    case 'brave':
      return 2 * hand.filter((c) => c.dominant).length;
    case 'camouflage':
    case 'fortunate':
      return hand.length;
    case 'egg-clusters':
      return countColor(s, p, 'blue');
    case 'heat-vision':
      return countColor(s, p, 'red');
    case 'overgrowth':
      return countColor(s, p, 'green');
    case 'sticky-secretions':
      return countColor(s, p, 'purple');
    case 'mindful':
      return countColor(s, p, 'colorless');
    case 'gratitude':
      return distinctColors(s, p).length;
    case 'immunity':
      return 2 * pile.filter((c) => effectiveFace(s, c) < 0).length;
    case 'kidney':
      return pile.filter((c) => c.kind === 'kidney').length;
    case 'pack-behavior':
      return DM_SCORING_COLORS.reduce((n, col) => n + Math.floor(countColor(s, p, col) / 2), 0);
    case 'pollination':
      return pile.filter((c) => effectiveFace(s, c) === 1).length;
    case 'saudade':
      return DM_SCORING_COLORS.filter((col) => hand.some((c) => printedColors(c).includes(col))).length;
    case 'swarm':
      return s.seats.reduce((n, x) => n + tableauOf(s, x.id).filter((c) => c.kind === 'swarm').length, 0);
    case 'symbiosis': {
      const counts = DM_SCORING_COLORS.map((col) => countColor(s, p, col)).filter((n) => n > 0);
      return counts.length >= 2 ? 2 * Math.min(...counts) : 0;
    }
    case 'tiny':
      return -pile.length;
    case 'sentience': {
      const col = s.worldsEnd?.chosenColor[card.id];
      return col ? countColor(s, p, col) : 0;
    }
    default:
      return 0;
  }
}

/**
 * Live score breakdown. World's End effects only count once the world has ended.
 * Pass `viewer` (a seat, or null for a spectator) to get only what that viewer
 * may know: before the game ends, bonuses that read the contents of someone
 * else's hand (Boredom, Brave, Saudade) are left out. Omit it for the true score.
 */
export function computePlayerScore(s: DmState, p: PlayerId, viewer?: PlayerId | null): DmScore {
  const pile = tableauOf(s, p);
  const handVisible = viewer === undefined || viewer === p || s.phase === 'gameOver';
  const face = pile.reduce((n, c) => n + effectiveFace(s, c), 0);
  const drop = pile.reduce((n, c) => n + dropOfLifeOf(s, p, c, handVisible), 0);
  const hiddenBonus = !handVisible && pile.some((c) => HAND_CONTENT_BONUS.has(c.kind) && !aiTakeoverHits(s, c));
  let end = 0;
  const we = s.worldsEnd;
  if (we) {
    // Viral, from opponents' piles.
    for (const o of opponentsOf(s, p)) {
      for (const v of tableauOf(s, o)) {
        const col = v.kind === 'viral' ? we.chosenColor[v.id] : undefined;
        if (col) end -= countColor(s, p, col);
      }
    }
    const sizes = s.seats.map((x) => tableauOf(s, x.id).length);
    switch (we.effect) {
      case 'iceAge': end -= countColor(s, p, 'red'); break;
      case 'retrovirus': end -= countColor(s, p, 'green'); break;
      case 'solarFlare': end -= countColor(s, p, 'purple'); break;
      case 'superVolcano': end -= countColor(s, p, 'blue'); break;
      case 'greyGoo': if (pile.length === Math.max(...sizes)) end -= 5; break;
      case 'overpopulation': if (pile.length === Math.min(...sizes)) end += 4; break;
      case 'theBigOne': end -= 2 * (DM_SCORING_COLORS.length - distinctColors(s, p).length); break;
      case 'deusExMachina': end += we.deusDraws[p] ?? 0; break;
      default: break;
    }
    end += we.tiebreak[p] ?? 0;
  }
  return { faceValue: face, dropOfLifeBonus: drop, worldsEndBonus: end, total: face + drop + end, hiddenBonus };
}

function finishGame(s: DmState) {
  const we = s.worldsEnd!;
  const totals = () => Object.fromEntries(s.seats.map((x) => [x.id, computePlayerScore(s, x.id).total])) as Record<PlayerId, number>;
  let scores = totals();
  const best = Math.max(...Object.values(scores));
  const tied = orderFrom(s, s.firstPlayerIndex).filter((p) => scores[p] === best);
  if (tied.length > 1) {
    // Rulesheet: "In the rare event of a tie … draw a trait from the top of the
    // deck, and apply only the face value to your final score!"
    // UNCONFIRMED: one draw each; players still tied after it share the win.
    pushLog(s, null, `A tie at ${best}! Tied players draw a trait and add its face value.`, 'normal');
    for (const p of tied) {
      const [card] = drawCards(s, p, 1);
      if (!card) continue;
      takeFromHand(s, p, card.id);
      s.traitDiscard.push(card);
      we.tiebreak[p] = faceValue(card);
      pushLog(s, p, `${seatName(s, p)} drew ${card.name} (${faceValue(card)}).`, 'normal');
    }
    scores = totals();
  }
  const top = Math.max(...Object.values(scores));
  s.winnerIds = s.seats.map((x) => x.id).filter((id) => scores[id] === top);
  s.winnerId = s.winnerIds[0] ?? null;
  s.finalScores = scores;
  s.phase = 'gameOver';
  s.subPhase = 'gameOver';
  s.activePlayerId = null;
  s.prompt = null;
  s.tasks = [];
  const names = s.winnerIds.map((id) => seatName(s, id)).join(' & ');
  pushLog(s, s.winnerId, `${names} ${s.winnerIds.length > 1 ? 'share the win' : 'wins'} with ${top} points!`, 'good');
}

// ============================================================================
// Action handlers
// ============================================================================

function handlePlayTrait(s: DmState, a: Extract<DmAction, { type: 'playTrait' }>) {
  if (s.subPhase !== 'awaitingAction' || s.turnStage !== 'main') throw new Error(`cannot play a trait during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');
  const card = handOf(s, a.playerId).find((c) => c.id === a.cardId);
  if (!card) throw new Error('card not in hand');
  const block = playBlock(s, a.playerId, card);
  if (block) throw new Error(`cannot play ${card.name}: ${block.why}`);
  s.turnStage = 'resolving';
  front(s, { t: 'play', p: a.playerId, cardId: card.id, from: 'hand', triggerAction: true }, { t: 'endTurn', p: a.playerId });
}

function handlePlayOutOfTurn(s: DmState, a: Extract<DmAction, { type: 'playOutOfTurn' }>) {
  const card = outOfTurnPlays(s, a.playerId).find((c) => c.id === a.cardId);
  if (!card) throw new Error('cannot play that out of turn now');
  if (a.targetPlayerId === a.playerId || !s.seats.some((x) => x.id === a.targetPlayerId)) throw new Error('choose an opponent');
  front(s, { t: 'play', p: a.playerId, cardId: card.id, from: 'hand', triggerAction: false, outOfTurn: true, into: a.targetPlayerId });
}

function handlePassTurn(s: DmState, a: Extract<DmAction, { type: 'passTurn' }>) {
  if (s.subPhase !== 'awaitingAction' || s.turnStage !== 'main') throw new Error(`cannot pass during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');
  const p = a.playerId;
  const hand = handOf(s, p);
  if (playableFromHand(s, p).length) throw new Error('you must play a trait if you can');
  s.turnStage = 'resolving';
  // "If your hand is empty, draw 5 cards and skip your turn! If you hold cards
  // but can't play any, skip your turn. You may, if you choose, discard your
  // entire hand and draw 3 cards. In either case, do not stabilize this turn!"
  if (!hand.length) {
    drawCards(s, p, 5);
    pushLog(s, p, `${seatName(s, p)} had no cards: drew 5 and skipped their turn.`, 'normal');
  } else if (a.discardHand) {
    discardHandCards(s, p, hand.map((c) => c.id));
    drawCards(s, p, 3);
    pushLog(s, p, `${seatName(s, p)} couldn't play: discarded their hand, drew 3 and skipped their turn.`, 'normal');
  } else {
    pushLog(s, p, `${seatName(s, p)} couldn't play a trait and skipped their turn.`, 'normal');
  }
  front(s, { t: 'nextTurn' });
}

function validateAnswer(prompt: DmPrompt, a: Extract<DmAction, { type: 'resolvePrompt' }>): Answer {
  if (a.decline) {
    if (!prompt.optional) throw new Error('this choice cannot be declined');
    return { decline: true };
  }
  switch (prompt.kind) {
    case 'cards': {
      const ids = a.cardIds ?? [];
      if (new Set(ids).size !== ids.length) throw new Error('duplicate cards');
      if (ids.some((id) => !prompt.cardIds.includes(id))) throw new Error('card not eligible');
      if (ids.length < prompt.min || ids.length > prompt.max) throw new Error(`choose ${prompt.min === prompt.max ? prompt.min : `${prompt.min}–${prompt.max}`} card(s)`);
      return { cardIds: ids };
    }
    case 'trait': {
      const t = prompt.targets.find((x) => x.cardId === a.targetCardId);
      if (!t) throw new Error('trait not eligible');
      return { target: t };
    }
    case 'player':
      if (!a.targetPlayerId || !prompt.playerIds.includes(a.targetPlayerId)) throw new Error('player not eligible');
      return { playerId: a.targetPlayerId };
    case 'color':
      if (!a.chosenColor || !prompt.colors.includes(a.chosenColor)) throw new Error('colour not eligible');
      return { color: a.chosenColor };
    case 'option':
      if (!a.optionId || !prompt.options.some((o) => o.id === a.optionId)) throw new Error('option not available');
      return { optionId: a.optionId };
  }
}

function handleResolvePrompt(s: DmState, a: Extract<DmAction, { type: 'resolvePrompt' }>) {
  const prompt = s.prompt;
  if (!prompt || s.subPhase !== 'awaitingPrompt') throw new Error('no decision is waiting');
  if (prompt.playerId !== a.playerId) throw new Error('not your decision');
  const ans = validateAnswer(prompt, a);
  s.prompt = null;
  answerTask(s, prompt.task, ans);
}

// ============================================================================
// Entry point
// ============================================================================

export function applyAction(state: DmState, action: DmAction): DmState {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  const s = cloneState(state);
  switch (action.type) {
    case 'playTrait':
      handlePlayTrait(s, action);
      break;
    case 'playOutOfTurn':
      handlePlayOutOfTurn(s, action);
      break;
    case 'passTurn':
      handlePassTurn(s, action);
      break;
    case 'resolvePrompt':
      handleResolvePrompt(s, action);
      break;
    default: {
      const never: never = action;
      throw new Error(`unknown action ${JSON.stringify(never)}`);
    }
  }
  run(s);
  return s;
}
