// Doomlings — pure deterministic reducer for the Classic (2nd edition) base
// game and the built expansions (Castle Glass).
//
// Rules sources: the official Classic rulesheet and each pack's rules card
// (see types.ts). Card behaviour is dispatched on the card's kind, so a pack's
// cards bring their own effects; nothing here branches on which packs are on.
// The engine is a
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
  DmPlayFilter,
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
  const { traitDeck, ageDeck, birthOfLife } = buildDmDecks(rngState, config.expansions ?? []);
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
    turnBans: [],
    turnFx: { p: first.id, used: [] },
    ageFx: freshAgeFx(),
    agePhase: false,
    peekHand: null,
    peekedLast: Object.fromEntries(seats.map((s) => [s.id, []])),
    pendingReveal: [],

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

function freshAgeFx(): DmState['ageFx'] {
  return { bans: [], noDraw: [], swamp: [], procrastinated: [] };
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

/** A trait card anywhere: a hand, a pile, the discard (or the deck — Rover shows its bottom cards). */
export function findCard(s: DmState, id: number): DmTraitCard | null {
  for (const seat of s.seats) {
    const c = handOf(s, seat.id).find((x) => x.id === id) ?? tableauOf(s, seat.id).find((x) => x.id === id);
    if (c) return c;
  }
  return s.traitDiscard.find((x) => x.id === id) ?? s.traitDeck.find((x) => x.id === id) ?? null;
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

/** Dominant slots used (Overlush's Epic fills both). */
function dominantCount(s: DmState, p: PlayerId): number {
  return tableauOf(s, p).reduce((n, c) => n + (c.dominant ? (c.kind === 'epic' ? 2 : 1) : 0), 0);
}

/** Hand size `p` must stabilize to right now. */
export function stabilizeTarget(s: DmState, p: PlayerId): number {
  return s.currentAge.ruleTag === 'stabilizeTo4' ? 4 : genePoolOf(s, p);
}

/** This turn's one-turn Action effects, if `p` is the player they belong to. */
export function turnFxOf(s: DmState, p: PlayerId): DmState['turnFx'] | null {
  return s.turnFx.p === p && !s.agePhase ? s.turnFx : null;
}

/**
 * Hand size `p` stabilizes to at the end of their turn: Harboring makes it 6.
 * UNCONFIRMED: Age of Wonder's 4 still wins over Harboring ("Ages > Traits").
 */
export function endOfTurnTarget(s: DmState, p: PlayerId): number {
  if (s.currentAge.ruleTag === 'stabilizeTo4') return 4;
  // Overlush, Age of Envy: "stabilize to the size of the Gene Pool on your right".
  if (s.currentAge.ruleTag === 'envy') return genePoolOf(s, rightOf(s, p));
  return turnFxOf(s, p)?.stabilizeTo ?? genePoolOf(s, p);
}

/** How `p` ends their turn: stabilize as normal, draw 2 instead (Guanine Crystals), or not at all (Still Water). */
export function endOfTurnMode(s: DmState, p: PlayerId): 'stabilize' | 'draw2' | 'none' {
  if (s.currentAge.catastrophe === 'stillWater') return 'none';
  if (turnFxOf(s, p)?.noStabilize) return 'none';
  if (turnFxOf(s, p)?.draw2) return 'draw2';
  return 'stabilize';
}

/** Colours `p` can't play right now because of an opponent's Brainy (only during p's own turn). */
export function bannedColors(s: DmState, p: PlayerId): DmTraitColor[] {
  if (s.turnPlayerId !== p || s.agePhase) return [];
  return [...new Set(s.turnBans.filter((b) => b.p === p).map((b) => b.color))];
}

// ---- Castle Glass classes ---------------------------------------------------------

const TIER_BONUS = { basic: 1, curious: 2, exotic: 3 } as const;

/**
 * Castle Glass class bonuses: for each class with 2 or more cards in the pile,
 * every card of it scores +1 (+2 Curious, +3 Exotic). Counted after Drop of Life.
 */
export function classBonusOf(s: DmState, p: PlayerId): number {
  const byClass = new Map<string, DmTraitCard[]>();
  for (const c of tableauOf(s, p)) if (c.cls) byClass.set(c.cls, [...(byClass.get(c.cls) ?? []), c]);
  let n = 0;
  for (const cards of byClass.values()) if (cards.length >= 2) for (const c of cards) n += TIER_BONUS[c.tier ?? 'basic'];
  return n;
}

/** Reforestation: traits in piles can't be swapped, stolen or discarded this round. */
function pilesLocked(s: DmState): boolean {
  return s.currentAge.ruleTag === 'protectTraitPiles';
}

/**
 * Can't be removed from `owner`'s pile at all: a Dominant, or (Overlush) a
 * green trait under Ironwood while they have 5 or fewer greens, or a red one
 * under Meek while they have 3 or fewer reds.
 */
export function unremovable(s: DmState, owner: PlayerId, card: DmTraitCard): boolean {
  if (card.dominant) return true;
  const pile = tableauOf(s, owner);
  const cols = traitColorsFor(s, owner, card);
  if (cols.includes('green') && pile.some((c) => c.kind === 'ironwood') && countColor(s, owner, 'green') <= 5) return true;
  if (cols.includes('red') && pile.some((c) => c.kind === 'meek') && countColor(s, owner, 'red') <= 3) return true;
  return false;
}

/** Can this pile trait be taken by a steal / swap? */
function canTake(s: DmState, owner: PlayerId, card: DmTraitCard): boolean {
  return !unremovable(s, owner, card) && !pilesLocked(s);
}

/** Can this pile trait be discarded? */
function canDiscardFromPile(s: DmState, owner: PlayerId, card: DmTraitCard): boolean {
  return !unremovable(s, owner, card) && !pilesLocked(s);
}

/** Can this pile trait be given / returned / moved (not blocked by Reforestation)? */
function canMove(s: DmState, owner: PlayerId, card: DmTraitCard): boolean {
  return !unremovable(s, owner, card);
}

// ---- play legality ------------------------------------------------------------

/** 'age' and 'restriction' (Brainy) are temporary: such a card stays in hand; the others are discarded if drawn to play. */
export type DmBlock = 'dominants' | 'age' | 'restriction' | 'requirement';

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
  const ban = bannedColors(s, p).find((c) => cols.includes(c));
  if (ban) return { kind: 'restriction', why: `Brainy: you can’t play ${ban} traits this turn.` };
  // ---- Overlush ages
  if (rule === 'noNegative' && faceValue(card) < 0) return { kind: 'age', why: `${s.currentAge.name}: no traits with a negative face value this round.` };
  if (rule === 'noMulticolor' && cols.length > 1) return { kind: 'age', why: `${s.currentAge.name}: no multi-colour traits this round.` };
  if (rule === 'noDominants' && card.dominant) return { kind: 'age', why: `${s.currentAge.name}: no Dominant traits this round.` };
  const river = s.ageFx.bans.find((b) => b.p === p && cols.includes(b.color));
  if (river) return { kind: 'age', why: `${s.currentAge.name}: you can’t play ${river.color} traits this round.` };
  if (NOT_ON_YOUR_TURN.has(card.kind) && s.turnPlayerId === p && !s.agePhase && !s.worldsEnd) {
    return { kind: 'restriction', why: `${card.name} can’t be played on your turn.` };
  }
  switch (card.kind) {
    case 'delicious':
      if (countColor(s, p, 'colorless') === 0) return { kind: 'requirement', why: 'Needs a colorless trait in your pile.' };
      break;
    case 'heroic':
      if (countColor(s, p, 'green') < 3) return { kind: 'requirement', why: 'Needs 3 or more green traits in your pile.' };
      break;
    case 'morality':
      if (!tableauOf(s, p).some((c) => canMove(s, p, c) && faceValue(c) > 0) || s.seats.length < 2) {
        return { kind: 'requirement', why: 'You must give away a positive-value trait from your pile.' };
      }
      break;
    case 'retractable-claws':
      if (!tableauOf(s, p).some((c) => canDiscardFromPile(s, p, c) && traitColorsFor(s, p, c).includes('red'))) {
        return { kind: 'requirement', why: 'You must discard a red trait from your pile.' };
      }
      break;
    // ---- Overlush
    case 'citrus':
      if (!tableauOf(s, p).some((c) => faceValue(c) < 0)) return { kind: 'requirement', why: 'Needs a negative trait in your pile.' };
      break;
    case 'silk':
      if (genePoolOf(s, p) > 4) return { kind: 'requirement', why: 'Needs a Gene Pool of 4 or less.' };
      break;
    case 'epic':
      if (dominantCount(s, p) > 0) return { kind: 'requirement', why: 'Needs no Dominants in your pile (it takes both slots).' };
      break;
    case 'opposable-thumbs':
      if (!tableauOf(s, p).some((c) => c.dominant)) return { kind: 'requirement', why: 'Needs a Dominant in your pile to copy.' };
      break;
    case 'fabled':
      if (!fabledSet(handOf(s, p).filter((c) => c.id !== card.id))) return { kind: 'requirement', why: 'You must discard 4 cards of the 4 different colours from your hand.' };
      break;
    case 'metamorphosis':
      if (tableauOf(s, p).filter((c) => canDiscardFromPile(s, p, c) && faceValue(c) >= 1).length < 3) {
        return { kind: 'requirement', why: 'You must discard 3 traits of face value 1 or more from your pile.' };
      }
      break;
    case 'xylophage':
      if (!tableauOf(s, p).some((c) => canDiscardFromPile(s, p, c) && traitColorsFor(s, p, c).includes('green'))) {
        return { kind: 'requirement', why: 'You must discard a green trait from your pile.' };
      }
      break;
    // ---- Imaginary Ends
    case 'chemotroph':
      // UNCONFIRMED: it may be the host of the trait it suppresses.
      if (!tableauOf(s, p).some((c) => !unremovable(s, p, c))) return { kind: 'requirement', why: 'You must suppress a trait from your pile.' };
      break;
    case 'remarkable':
      // UNCONFIRMED: Remarkable itself isn't counted.
      if (handOf(s, p).filter((c) => c.id !== card.id).length > 3) return { kind: 'requirement', why: 'You must hold 3 or fewer cards.' };
      break;
    case 'gob-lopters':
      if (handOf(s, p).filter((c) => c.id !== card.id).length < 2 || s.seats.length < 2) return { kind: 'requirement', why: 'You must give an opponent 2 random cards from your hand.' };
      break;
    default:
      break;
  }
  return null;
}

/** Overlush Play-When traits that say "Cannot be played on your turn!". */
const NOT_ON_YOUR_TURN: ReadonlySet<DmTraitKind> = new Set(['dart', 'elusive', 'muse', 'super-sneaky']);

/**
 * Fabled's cost: 4 cards covering the 4 colours (a dual-colour card counts as
 * either of its colours). Returns one such set, or null.
 */
export function fabledSet(cards: readonly DmTraitCard[]): DmTraitCard[] | null {
  const pick = (i: number, used: Set<number>): DmTraitCard[] | null => {
    if (i === DM_SCORING_COLORS.length) return [];
    const col = DM_SCORING_COLORS[i]!;
    for (const c of cards) {
      if (used.has(c.id) || !printedColors(c).includes(col)) continue;
      const rest = pick(i + 1, new Set([...used, c.id]));
      if (rest) return [c, ...rest];
    }
    return null;
  };
  return pick(0, new Set());
}

export function canPlayTrait(s: DmState, p: PlayerId, card: DmTraitCard, unrestricted = false): boolean {
  return playBlock(s, p, card, unrestricted) === null;
}

/** Traits `p` could play as their turn. */
export function playableFromHand(s: DmState, p: PlayerId): DmTraitCard[] {
  return handOf(s, p).filter((c) => canPlayTrait(s, p, c));
}

/** Play-When traits whose "at any time" play goes into your own pile (Castle Glass). */
export const ANY_TIME_OWN: ReadonlySet<DmTraitKind> = new Set(['conchomancy', 'sea-glass', 'sunny', 'booster', 'lucky', 'trippy']);

/**
 * "At any time" traits `p` may play right now without using their turn
 * (offered during their own turn): Self-Awareness into an opponent's pile,
 * Conchomancy / Sea Glass / Sunny into their own.
 */
export function outOfTurnPlays(s: DmState, p: PlayerId): DmTraitCard[] {
  if (s.phase !== 'playing' || s.prompt || s.turnStage !== 'main' || s.turnPlayerId !== p) return [];
  return handOf(s, p).filter((c) => {
    if (c.kind === 'self-awareness') return s.seats.length >= 2 && canPlayTrait(s, p, c);
    if (c.kind === 'umbleboos') return umbleboosTargets(s).length > 0 && canPlayTrait(s, p, c);
    return ANY_TIME_OWN.has(c.kind) && canPlayTrait(s, p, c);
  });
}

/** Imaginary Ends Umbleboos: piles it may be played into (Gene Pool 6 or more). */
export function umbleboosTargets(s: DmState): PlayerId[] {
  return s.seats.map((x) => x.id).filter((q) => genePoolOf(s, q) >= 6);
}

/** The next age, if `p` may legitimately see it (Awakening on their turn, or The Third Eye). */
export function previewNextAge(s: DmState, p: PlayerId | null): DmAgeCard | null {
  const next = s.ageDeck[0];
  if (!next || !p) return null;
  if (s.peekedAge[p] === next.id) return next;
  if (s.currentAge.ruleTag === 'awakening' && s.turnPlayerId === p && s.phase === 'playing') return next;
  return null;
}

/** Overlush Sapient: the last ages of the age deck `p` has peeked at (still at the bottom). */
export function previewLastAges(s: DmState, p: PlayerId | null): DmAgeCard[] {
  if (!p) return [];
  const seen = s.peekedLast[p] ?? [];
  return s.ageDeck.filter((a) => seen.includes(a.id));
}

/** Overlush, Age of Certainty: the deck is flipped, and its next card is face up for everyone. */
export function visibleDeckTop(s: DmState): DmTraitCard | null {
  if (s.currentAge.ruleTag !== 'certainty') return null;
  return s.traitDeck[s.traitDeck.length - 1] ?? null;
}

/** Overlush Eyestalks: the opponent's hand `viewer` may look at right now. */
export function peekedHand(s: DmState, viewer: PlayerId | null): PlayerId | null {
  return viewer && s.peekHand?.viewer === viewer ? s.peekHand.owner : null;
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
  // Imaginary Ends Popplebelly: "Your Gene Pool is 1 and cannot be modified."
  if (hasKind(s, p, 'popplebelly')) return;
  const cur = genePoolOf(s, p);
  const next = cur + delta;
  if (always) s.genePool[p] = Math.max(GENE_POOL_MIN, Math.min(GENE_POOL_MAX, next));
  else if (next >= GENE_POOL_MIN && next <= GENE_POOL_MAX) s.genePool[p] = next;
}

/** Traits that change other players' Gene Pools while in play: Super Spreader (everyone −1), Overlush's Constrictor / Mutualism (opponents ∓1). */
const GLOBAL_GP: Partial<Record<DmTraitKind, { self: number; others: number }>> = {
  'super-spreader': { self: -1, others: -1 },
  constrictor: { self: 0, others: -1 },
  mutualism: { self: 0, others: 1 },
};

/** Sets a Gene Pool outright (Magic Hour, Atavism) — Popplebelly still holds it at 1. */
function setGenePool(s: DmState, p: PlayerId, value: number) {
  if (hasKind(s, p, 'popplebelly')) return;
  s.genePool[p] = Math.max(GENE_POOL_MIN, Math.min(GENE_POOL_MAX, value));
}

function gpEnter(s: DmState, owner: PlayerId, card: DmTraitCard, global = true) {
  adjustGenePool(s, owner, card.genePoolDelta, false);
  const g = GLOBAL_GP[card.kind];
  if (global && g) for (const seat of s.seats) adjustGenePool(s, seat.id, seat.id === owner ? g.self : g.others, false);
}

function gpLeave(s: DmState, owner: PlayerId, card: DmTraitCard, global = true) {
  adjustGenePool(s, owner, -card.genePoolDelta, true);
  const g = GLOBAL_GP[card.kind];
  if (global && g) for (const seat of s.seats) adjustGenePool(s, seat.id, -(seat.id === owner ? g.self : g.others), true);
}

// ============================================================================
// Moving cards
// ============================================================================

/** Takes the next card from one end of the trait deck (Age of Certainty flips it), reshuffling the discard when it runs out. */
function takeFromDeck(s: DmState, end: 'top' | 'bottom'): DmTraitCard | undefined {
  if (s.traitDeck.length === 0 && s.traitDiscard.length > 0) {
    s.traitDeck = shuffle(s.rngState, s.traitDiscard);
    s.traitDiscard = [];
    pushLog(s, null, 'The trait deck ran out: the discard pile was reshuffled into a new deck.', 'normal');
  }
  const fromTop = (end === 'top') !== (s.currentAge.ruleTag === 'certainty');
  return fromTop ? s.traitDeck.shift() : s.traitDeck.pop();
}

/** Puts a card on one end of the trait deck. */
function putOnDeck(s: DmState, card: DmTraitCard, end: 'top' | 'bottom') {
  const onTop = (end === 'top') !== (s.currentAge.ruleTag === 'certainty');
  if (onTop) s.traitDeck.unshift(card);
  else s.traitDeck.push(card);
}

function drawCards(s: DmState, p: PlayerId, n: number, end: 'top' | 'bottom' = 'top'): DmTraitCard[] {
  const drawn: DmTraitCard[] = [];
  // Overlush, Star Tails: no more drawing this round.
  if (s.ageFx.noDraw.includes(p)) return drawn;
  for (let i = 0; i < n; i++) {
    const c = takeFromDeck(s, end);
    if (!c) break;
    handOf(s, p).push(c);
    drawn.push(c);
  }
  gainedHand(s, p, drawn);
  return drawn;
}

/**
 * Cards just came into `p`'s hand. Overlush's Elusive: "when it enters your
 * hand during an age effect or an opponent's turn, you may play it".
 */
function gainedHand(s: DmState, p: PlayerId, cards: readonly DmTraitCard[]) {
  if (s.phase !== 'playing' || s.worldsEnd || (!s.agePhase && s.turnPlayerId === p)) return;
  for (const c of cards) if (c.kind === 'elusive') front(s, { t: 'elusive', p, cardId: c.id });
}

/** Cards just left `p`'s hand for the discard pile. Overlush's Muse may be played instead (not on your turn). */
function discardedFromHand(s: DmState, p: PlayerId, cards: readonly DmTraitCard[]) {
  if (s.phase !== 'playing' || (!s.agePhase && s.turnPlayerId === p && !s.worldsEnd)) return;
  for (const c of cards) if (c.kind === 'muse') front(s, { t: 'muse', p, cardId: c.id });
}

/** Imaginary Ends Grobblebobble "cannot be discarded from your hand". */
export function discardableFromHand(c: DmTraitCard): boolean {
  return c.kind !== 'grobblebobble';
}

function discardHandCards(s: DmState, p: PlayerId, ids: readonly number[]) {
  const hand = handOf(s, p);
  const gone: DmTraitCard[] = [];
  for (const id of ids) {
    const i = hand.findIndex((c) => c.id === id && discardableFromHand(c));
    if (i >= 0) {
      const c = hand.splice(i, 1)[0]!;
      s.traitDiscard.push(c);
      gone.push(c);
    }
  }
  discardedFromHand(s, p, gone);
}

function discardRandomFromHand(s: DmState, p: PlayerId, n: number): DmTraitCard[] {
  const hand = handOf(s, p);
  const out: DmTraitCard[] = [];
  for (let i = 0; i < n; i++) {
    const pool = hand.filter(discardableFromHand);
    if (!pool.length) break;
    const c = pool[rngInt(s.rngState, pool.length)]!;
    hand.splice(hand.indexOf(c), 1);
    s.traitDiscard.push(c);
    out.push(c);
  }
  discardedFromHand(s, p, out);
  return out;
}

function stealRandomFromHand(s: DmState, from: PlayerId, to: PlayerId, n: number): number {
  const hand = handOf(s, from);
  const got: DmTraitCard[] = [];
  for (let i = 0; i < n && hand.length; i++) {
    const c = hand.splice(rngInt(s.rngState, hand.length), 1)[0]!;
    handOf(s, to).push(c);
    got.push(c);
  }
  gainedHand(s, to, got);
  return got.length;
}

/** Moves a hand card to another player's hand (gifts, passes). */
function giveHandCard(s: DmState, from: PlayerId, to: PlayerId, id: number): DmTraitCard | null {
  const c = takeFromHand(s, from, id);
  if (!c) return null;
  handOf(s, to).push(c);
  gainedHand(s, to, [c]);
  return c;
}

function takeFromHand(s: DmState, p: PlayerId, id: number): DmTraitCard | null {
  const hand = handOf(s, p);
  const i = hand.findIndex((c) => c.id === id);
  return i >= 0 ? hand.splice(i, 1)[0]! : null;
}

/** Who removed a trait from a pile, and with which card's effect (srcId −1: an age or catastrophe). */
type RemovedBy = { p: PlayerId | null; srcId: number } | null;

function removeFromPile(s: DmState, owner: PlayerId, id: number, global = true, by: RemovedBy = null): DmTraitCard | null {
  const pile = tableauOf(s, owner);
  const i = pile.findIndex((c) => c.id === id);
  if (i < 0) return null;
  const card = pile.splice(i, 1)[0]!;
  gpLeave(s, owner, card, global);
  // Imaginary Ends: "If a trait leaves your trait pile, all suppressed cards under that trait are placed at the bottom of the trait deck."
  if (card.under?.length) {
    for (const c of card.under) putOnDeck(s, c, 'bottom');
    pushLog(s, owner, `${card.under.length} suppressed card${card.under.length === 1 ? '' : 's'} under ${card.name} went to the bottom of the deck.`, 'normal');
    delete card.under;
  }
  afterRemoval(s, owner, card, by);
  return card;
}

/** Imaginary Ends: traits in `p`'s pile a card can be suppressed under (not Dominants; not the cards being suppressed). */
function suppressHosts(s: DmState, p: PlayerId, exclude: readonly number[]): DmTraitCard[] {
  return tableauOf(s, p).filter((c) => !c.dominant && !exclude.includes(c.id));
}

/** Imaginary Ends: suppressed cards under `p`'s traits (+1 point each). */
export function suppressedCount(s: DmState, p: PlayerId): number {
  return tableauOf(s, p).reduce((n, c) => n + (c.under?.length ?? 0), 0);
}

/** Overlush: what happens when a trait leaves its owner's pile, for any reason. */
function afterRemoval(s: DmState, owner: PlayerId, card: DmTraitCard, by: RemovedBy) {
  if (s.phase !== 'playing') return;
  const seq: DmTask[] = [];
  if (card.kind === 'fleshy-scales') seq.push({ t: 'draw', p: owner, n: 1, why: 'Fleshy Scales' });
  if (card.kind === 'mycelium' && s.turnPlayerId === owner && !s.agePhase && !s.worldsEnd) seq.push({ t: 'mycelium', p: owner });
  const byDominant = !!by && by.srcId >= 0 && !!findCard(s, by.srcId)?.dominant;
  if (handOf(s, owner).some((c) => REMOVAL_REACTIONS.has(c.kind))) {
    seq.push({ t: 'removalWindow', owner, cardId: card.id, by: by?.p ?? null, byDominant, asked: [] });
  }
  if (seq.length) front(s, ...seq);
}

const REMOVAL_REACTIONS: ReadonlySet<DmTraitKind> = new Set(['dart', 'quills', 'patches', 'motion-dazzle']);

function addToPile(s: DmState, owner: PlayerId, card: DmTraitCard, global = true) {
  tableauOf(s, owner).push(card);
  gpEnter(s, owner, card, global);
}

/**
 * Steal / swap / give: the trait changes piles. Moving Super Spreader doesn't
 * change anyone's Gene Pool; Constrictor / Mutualism follow their new owner.
 */
function moveTrait(s: DmState, from: PlayerId, to: PlayerId, id: number, by: RemovedBy = null): DmTraitCard | null {
  const kind = tableauOf(s, from).find((c) => c.id === id)?.kind;
  const g = kind ? GLOBAL_GP[kind] : undefined;
  const global = !!g && g.self !== g.others;
  const card = removeFromPile(s, from, id, global, by);
  if (card) addToPile(s, to, card, global);
  return card;
}

/**
 * Discard a trait from `owner`'s pile. Endurance comes straight back;
 * Regenerative Tissue (this one included) draws and plays a card.
 * UNCONFIRMED: any discard from your pile counts as "you discard", even when an
 * opponent's effect (Reckless) is the one choosing.
 */
function discardFromPile(s: DmState, owner: PlayerId, id: number, by: RemovedBy = null) {
  const regen = tableauOf(s, owner).filter((c) => c.kind === 'regenerative-tissue').length;
  const card = removeFromPile(s, owner, id, true, by);
  if (!card) return;
  if (card.kind === 'endurance') {
    addToPile(s, owner, card);
    pushLog(s, owner, `${card.name} was discarded from ${seatName(s, owner)}'s pile — and came straight back.`, 'good');
  } else {
    s.traitDiscard.push(card);
    pushLog(s, owner, `${card.name} was discarded from ${seatName(s, owner)}'s pile.`, 'danger');
  }
  for (let i = 0; i < regen; i++) front(s, { t: 'regenDraw', p: owner });
  // Overlush "if this is discarded from your trait pile" effects.
  switch (card.kind) {
    case 'cap':
    case 'toxic':
      front(s, { t: 'draw', p: owner, n: card.kind === 'cap' ? 3 : 2, why: card.name });
      break;
    case 'spores':
      adjustGenePool(s, owner, 1, false);
      pushLog(s, owner, `Spores: ${seatName(s, owner)} gains +1 Gene Pool.`, 'good');
      break;
    case 'mycotoxins': {
      const order = orderFrom(s, seatIdx(s, owner));
      for (const q of order) discardRandomFromHand(s, q, 2);
      pushLog(s, owner, 'Mycotoxins: everyone discards 2 random cards and stabilizes.', 'danger');
      front(s, ...order.map((q): DmTask => ({ t: 'stabilize', p: q })));
      break;
    }
    default:
      break;
  }
}

function returnToHand(s: DmState, owner: PlayerId, id: number, by: RemovedBy = null) {
  const card = removeFromPile(s, owner, id, true, by);
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
  'livingLibrary', 'swampDiscard', 'procrastination', 'restartAge',
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
      s.agePhase = false;
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
      s.turnFx = { p: task.p, used: [] };
      s.peekHand = null;
      // Imaginary Ends: A Quiet Moment / Too Much Pink / Popplebelly draws, Urf's offer.
      if (s.currentAge.ruleTag === 'quietMoment' && !handOf(s, task.p).length) front(s, { t: 'draw', p: task.p, n: 4, why: 'A Quiet Moment' });
      if (s.currentAge.catastrophe === 'tooMuchPink') front(s, { t: 'draw', p: task.p, n: 4, why: 'Too Much Pink' });
      if (hasKind(s, task.p, 'popplebelly')) front(s, { t: 'draw', p: task.p, n: 2, why: 'Popplebelly' });
      if (hasKind(s, task.p, 'urf')) front(s, { t: 'urf', p: task.p });
      if (hasKind(s, task.p, 'adrenalized') && handOf(s, task.p).length <= 2) {
        const n = drawCards(s, task.p, 4).length;
        pushLog(s, task.p, `${seatName(s, task.p)} drew ${n} (Adrenalized).`, 'normal');
      }
      if (hasKind(s, task.p, 'echolocation')) {
        drawCards(s, task.p, 1);
        pushLog(s, task.p, `${seatName(s, task.p)} drew 1 (Echolocation).`, 'normal');
      }
      if (hasKind(s, task.p, 'radial-symmetry')) front(s, { t: 'radialSymmetry', p: task.p });
      s.turnStage = 'main';
      return;
    }
    case 'endTurn': {
      const seq: DmTask[] = [];
      if (s.currentAge.ruleTag === 'livingLibrary') seq.push({ t: 'livingLibrary', p: task.p });
      if (s.currentAge.ruleTag === 'enlightenment') seq.push({ t: 'enlightenment', p: task.p });
      if (hasKind(s, task.p, 'whistler')) seq.push({ t: 'enlightenment', p: task.p, why: 'Whistler' });
      seq.push({ t: 'stabilizeChoice', p: task.p }, { t: 'nextTurn' });
      front(s, ...seq);
      return;
    }
    case 'enlightenment': {
      const ids = handOf(s, task.p).filter(discardableFromHand).map((c) => c.id);
      if (!ids.length) return;
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 0, max: Math.min(2, ids.length), optional: true,
        title: `${task.why ?? 'Enlightenment'}: discard up to 2 cards before you stabilize?`, declineLabel: 'Keep them',
      });
      return;
    }
    case 'stabilizeChoice': {
      const p = task.p;
      const rule = s.currentAge.ruleTag;
      const mode = endOfTurnMode(s, p);
      if (mode === 'none') {
        pushLog(s, p, `${seatName(s, p)} doesn't stabilize (${s.currentAge.name}).`, 'normal');
        return;
      }
      if (mode === 'draw2') {
        const n = drawCards(s, p, 2).length;
        pushLog(s, p, `${seatName(s, p)} drew ${n} instead of stabilizing (Guanine Crystals).`, 'normal');
        return;
      }
      const target = endOfTurnTarget(s, p);
      const extra: { id: string; label: string }[] = [];
      const apricity = hasKind(s, p, 'apricity') && handOf(s, p).length <= 8;
      if ((rule === 'prosperity' && handOf(s, p).length !== target) || apricity) extra.push({ id: 'skip', label: 'Don’t stabilize' });
      if (rule === 'nietzsche') extra.push({ id: 'nietzsche', label: 'Discard hand, draw 3' });
      if (handOf(s, p).some((c) => c.kind === 'countershading' && canPlayTrait(s, p, c))) {
        extra.push({ id: 'countershading', label: 'Play Countershading instead' });
      }
      if (hasKind(s, p, 'ethereal') && handOf(s, p).length && handOf(s, p).length <= 6 && suppressHosts(s, p, []).length) {
        extra.push({ id: 'ethereal', label: 'Ethereal: suppress a card instead' });
      }
      if (!extra.length) {
        front(s, { t: 'stabilize', p, to: target }, { t: 'afterStabilize', p });
        return;
      }
      const why = extra.some((o) => o.id === 'skip') ? (apricity ? 'Apricity: ' : 'Prosperity: ') : rule === 'nietzsche' ? 'Age of Nietzsche: ' : '';
      ask(s, task, {
        kind: 'option', playerId: p, optional: false, title: `${why}end your turn — stabilize to ${target} cards?`,
        options: [{ id: 'stabilize', label: `Stabilize to ${target}` }, ...extra],
      });
      return;
    }
    case 'stabilize': {
      const p = task.p;
      const target = task.to ?? stabilizeTarget(s, p);
      const hand = handOf(s, p);
      if (hand.length < target) {
        // Overlush Scavenger: "when stabilizing, you may instead draw from the top of the discard pile".
        if (!task.source && hasKind(s, p, 'scavenger') && s.traitDiscard.length && !s.ageFx.noDraw.includes(p)) {
          const top = s.traitDiscard[s.traitDiscard.length - 1]!;
          ask(s, task, {
            kind: 'option', playerId: p, optional: false, title: `Scavenger: stabilize (draw ${target - hand.length}) from the deck, or from the top of the discard pile (${top.name} on top)?`,
            options: [{ id: 'deck', label: 'From the deck' }, { id: 'discard', label: 'From the discard pile' }],
          });
          return;
        }
        let n = 0;
        if (task.source === 'discard') {
          const got: DmTraitCard[] = [];
          while (hand.length < target && s.traitDiscard.length) got.push(s.traitDiscard.pop()!);
          hand.push(...got);
          gainedHand(s, p, got);
          n += got.length;
        }
        n += drawCards(s, p, target - hand.length).length;
        if (n) pushLog(s, p, `${seatName(s, p)} stabilized: drew ${n}${task.source === 'discard' ? ' (from the discard pile first — Scavenger)' : ''}.`, 'normal');
      } else if (hand.length > target) {
        const pool = hand.filter(discardableFromHand);
        const excess = Math.min(hand.length - target, pool.length);
        if (excess <= 0) return;
        if (excess === pool.length) return answerTask(s, task, { cardIds: pool.map((c) => c.id) });
        ask(s, task, {
          kind: 'cards', playerId: p, cardIds: pool.map((c) => c.id), from: 'hand', min: excess, max: excess, optional: false,
          title: `Stabilize: discard ${excess} card${excess === 1 ? '' : 's'} (down to ${hand.length - excess}).`,
        });
      }
      return;
    }
    case 'afterStabilize': {
      const p = task.p;
      if (s.currentAge.ruleTag === 'coastalFormations' && drawCards(s, p, 1).length) {
        pushLog(s, p, `${seatName(s, p)} drew 1 after stabilizing (Coastal Formations).`, 'normal');
      }
      front(s, ...(s.currentAge.ruleTag === 'swamplands' ? [{ t: 'swampDiscard', p } as DmTask] : []), { t: 'late', p });
      return;
    }
    case 'swampDiscard': {
      // "If you play any traits with actions, discard them after you stabilize, wherever they are."
      const mine = s.ageFx.swamp.filter((x) => x.p === task.p).map((x) => x.cardId);
      s.ageFx.swamp = s.ageFx.swamp.filter((x) => x.p !== task.p);
      for (const id of mine) discardAnywhere(s, id, task.p);
      return;
    }
    case 'late': {
      // Late ("right after you stabilize"), and the "at any time" traits, which
      // this is also a moment for (UNCONFIRMED: see outOfTurnPlays); Overlush's
      // Firebite (a play), Harrier, Illusory and Mimicry (once each).
      const p = task.p;
      const used = task.used ?? [];
      const seen = new Set<string>();
      const cards = handOf(s, p)
        .filter((c) => (c.kind === 'late' || c.kind === 'firebite' || ANY_TIME_OWN.has(c.kind)) && canPlayTrait(s, p, c))
        .filter((c) => (seen.has(c.kind) ? false : (seen.add(c.kind), true)));
      const options = cards.map((c) => ({ id: `play:${c.id}`, label: `Play ${c.name}` }));
      const hand = handOf(s, p);
      if (!used.includes('harrier') && hasKind(s, p, 'harrier') && hand.some((c) => c.effectless)) options.push({ id: 'harrier', label: 'Harrier: discard an effectless trait, draw 3' });
      const fx = turnFxOf(s, p);
      if (!used.includes('illusory') && hasKind(s, p, 'illusory') && !(fx?.actions ?? 0) && hand.some((c) => c.action)) options.push({ id: 'illusory', label: 'Illusory: play the Action of a card in your hand' });
      if (!used.includes('mimicry') && hasKind(s, p, 'mimicry') && (fx?.plays?.length ?? 0) === 1 && hand.some((c) => faceValue(c) === 1 && canPlayTrait(s, p, c))) {
        options.push({ id: 'mimicry', label: 'Mimicry: play a face-value-1 trait' });
      }
      const rainbow = tableauOf(s, p).find((c) => c.kind === 'rainbow-magic');
      if (!used.includes('rainbow') && rainbow) options.push({ id: 'rainbow', label: 'Rainbow Magic: return it to your hand, play a random card' });
      if (!options.length) return;
      ask(s, task, {
        kind: 'option', playerId: p, optional: false, title: `You just stabilized — ${options.length === 1 ? options[0]!.label : 'anything else'}?`,
        detail: 'None of these counts as a turn.',
        options: [...options, { id: 'keep', label: 'No, end my turn' }],
      });
      return;
    }
    case 'nextTurn': {
      // Brainy's ban lasted for the turn that just ended.
      s.turnBans = s.turnBans.filter((b) => b.p !== s.turnPlayerId);
      s.turnIndex += 1;
      s.turnStage = 'resolving';
      if (s.turnIndex < s.roundOrder.length) front(s, { t: 'turnStart', p: s.roundOrder[s.turnIndex]! });
      else front(s, { t: 'procrastination', asked: [] });
      return;
    }
    case 'procrastination': {
      // Overlush: "You may play Procrastination after last player's turn ends. If you do, take another turn this age."
      for (const q of orderFrom(s, s.firstPlayerIndex)) {
        if (s.ageFx.procrastinated.includes(q)) continue;
        const card = handOf(s, q).find((c) => c.kind === 'procrastination' && canPlayTrait(s, q, c));
        if (!card) continue;
        s.ageFx.procrastinated.push(q);
        ask(s, task, {
          kind: 'option', playerId: q, optional: false, title: 'The round is over — play Procrastination to take another turn?',
          options: [{ id: `play:${card.id}`, label: 'Play Procrastination' }, { id: 'keep', label: 'Keep it' }],
        });
        return;
      }
      front(s, { t: 'flipAge' });
      return;
    }
    case 'restartAge': {
      s.ageFx = { ...freshAgeFx(), restarted: true };
      s.agePhase = true;
      s.turnStage = 'resolving';
      pushLog(s, null, `${s.currentAge.name.trim()} starts over (Psychedelic): ${seatName(s, s.seats[s.firstPlayerIndex]!.id)} goes first.`, 'normal');
      front(s, ...ageEffects(s, s.currentAge), { t: 'beginTurns' });
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
      // noClass (the Castle Glass age): Shells, Corals and Fish can't be discarded.
      const pool = handOf(s, task.p).filter((c) => (!task.noClass || !c.cls) && discardableFromHand(c));
      const n = Math.min(task.count, pool.length);
      if (n <= 0) return;
      if (n === pool.length) return answerTask(s, task, { cardIds: pool.map((c) => c.id) });
      const not = task.noClass ? ' (not Shells, Corals or Fish)' : '';
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: pool.map((c) => c.id), from: 'hand', min: n, max: n, optional: false, title: `${task.why}: discard ${n} card${n === 1 ? '' : 's'} from your hand${not}.` });
      return;
    }
    case 'draw': {
      const n = drawCards(s, task.p, task.n).length;
      if (n) pushLog(s, task.p, `${seatName(s, task.p)} drew ${n} (${task.why}).`, 'normal');
      return;
    }
    case 'magicHour':
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: `Magic Hour: draw 2 cards, or set your Gene Pool to 5 (it is ${genePoolOf(s, task.p)})?`,
        options: [{ id: 'draw', label: 'Draw 2' }, { id: 'gp5', label: 'Set my Gene Pool to 5' }],
      });
      return;

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
      for (const g of s.pendingGifts) giveHandCard(s, g.from, g.to, g.cardId);
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
      const cost = { from: task.from, triggerAction: task.triggerAction };
      if (card.kind === 'fabled') front(s, { t: 'fabledCost', p: task.p, cardId: card.id, from: task.from, triggerAction: task.triggerAction });
      else if (card.kind === 'gob-lopters') front(s, { t: 'gobLopters', p: task.p, cardId: card.id, from: task.from, triggerAction: task.triggerAction });
      else if (card.kind === 'whimsy') front(s, { t: 'whimsy', p: task.p, cardId: card.id, from: task.from, triggerAction: task.triggerAction });
      else if (card.kind === 'metamorphosis' || card.kind === 'xylophage') front(s, { t: 'pickTrait', p: task.p, mode: 'discardCost', srcId: card.id, filter: card.kind, cost, ref: 0 });
      else front(s, { t: 'pickTrait', p: task.p, mode: card.kind === 'morality' ? 'moralityGift' : 'clawsCost', srcId: card.id, cost });
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
      onEnter(s, task.p, card);
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
      const pool = (task.cardIds ? hand.filter((c) => task.cardIds!.includes(c.id)) : hand).filter((c) => matchesPlayFilter(c, task.filter));
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
    case 'afterPlayed': {
      const card = tableauOf(s, task.p).find((c) => c.id === task.cardId);
      if (!card) return;
      if (card.dominant) {
        pushLog(s, task.p, `${card.name} is Dominant, so it stays (${task.why}).`, 'normal');
      } else if (task.mode === 'return') {
        returnToHand(s, task.p, card.id);
        pushLog(s, task.p, `${seatName(s, task.p)} returned ${card.name} to their hand (${task.why}).`, 'normal');
      } else if (canDiscardFromPile(s, task.p, card)) {
        discardFromPile(s, task.p, card.id, { p: task.p, srcId: -1 });
      }
      return;
    }
    case 'pickTrait': {
      const targets = traitTargets(s, task);
      if (!targets.length) return;
      if (targets.length === 1 && !task.optional) return answerTask(s, task, { target: targets[0]! });
      ask(s, task, { kind: 'trait', playerId: task.p, targets, optional: !!task.optional, declineLabel: task.optional ? 'Stop here' : undefined, title: pickTraitTitle(s, task) });
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
      if (task.mode === 'tragedy') {
        // UNCONFIRMED: colorless cards aren't a colour you can keep; a hand of only colorless cards is discarded.
        const have = DM_SCORING_COLORS.filter((col) => handOf(s, task.p).some((c) => printedColors(c).includes(col)));
        if (!have.length) {
          discardHandCards(s, task.p, handOf(s, task.p).map((c) => c.id));
          return;
        }
        if (have.length === 1) return answerTask(s, task, { color: have[0]! });
        ask(s, task, { kind: 'color', playerId: task.p, colors: have, optional: false, title: 'Tragedy of the Commons: choose a colour in your hand to keep — the rest of your hand is discarded.' });
        return;
      }
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
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false, title: `${task.why ?? 'Doting'}: choose a card from your hand to give away.` });
      return;
    }
    case 'dotingTo': {
      const opps = opponentsOf(s, task.p);
      if (opps.length === 1) return answerTask(s, task, { playerId: opps[0]! });
      ask(s, task, { kind: 'player', playerId: task.p, playerIds: opps, optional: false, title: `${task.why ?? 'Doting'}: who gets the card?` });
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
    case 'radialSymmetry': {
      const colors = DM_SCORING_COLORS.filter((col) => handOf(s, task.p).some((c) => printedColors(c).includes(col)));
      if (!colors.length) return;
      ask(s, task, {
        kind: 'color', playerId: task.p, colors, optional: true, declineLabel: 'Keep my hand',
        title: 'Radial Symmetry: discard every card of one colour from your hand?',
      });
      return;
    }
    case 'benthic': {
      const ids = handOf(s, task.p).map((c) => c.id);
      if (!ids.length) return;
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: true, declineLabel: 'Don’t discard',
        title: 'Benthic: discard 1 card from your hand to play another trait?',
      });
      return;
    }
    case 'pearl': {
      const open = DM_SCORING_COLORS.filter((c) => !task.used.includes(c));
      const ids = handOf(s, task.p).filter((c) => printedColors(c).some((col) => open.includes(col)) && canPlayTrait(s, task.p, c)).map((c) => c.id);
      if (!ids.length) return;
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: true, declineLabel: 'Stop here',
        title: `Pearl: you may play a ${open.join(' / ')} trait from your hand (its Action is ignored).`,
        detail: task.used.length ? `Already played: ${task.used.join(', ')}.` : undefined,
      });
      return;
    }
    case 'pip': {
      const values = [...new Set(handOf(s, task.p).filter((c) => canPlayTrait(s, task.p, c)).map(faceValue))].sort((a, b) => a - b);
      if (!values.length) return;
      if (values.length === 1) return answerTask(s, task, { optionId: String(values[0]) });
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'Pip: choose a face value — you play every trait of that value from your hand.',
        options: values.map((v) => {
          const n = handOf(s, task.p).filter((c) => faceValue(c) === v && canPlayTrait(s, task.p, c)).length;
          return { id: String(v), label: `Face value ${v} (${n} card${n === 1 ? '' : 's'})` };
        }),
      });
      return;
    }
    case 'pipPlay': {
      // Pip: every trait of the chosen face value. Backwoods Melodies (negative): every negative non-Dominant trait.
      const match = (c: DmTraitCard) => (task.negative ? faceValue(c) < 0 && !c.dominant : faceValue(c) === task.value);
      const card = handOf(s, task.p).find((c) => match(c) && !task.tried.includes(c.id) && canPlayTrait(s, task.p, c));
      if (!card) return;
      front(s, { t: 'play', p: task.p, cardId: card.id, from: 'hand', triggerAction: false, outOfTurn: s.agePhase || undefined }, { ...task, tried: [...task.tried, card.id] });
      return;
    }
    case 'sneaky': {
      const sneaky = handOf(s, task.p).find((c) => c.id === task.cardId);
      if (!sneaky || !canPlayTrait(s, task.p, sneaky)) return;
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: `World’s End: play ${sneaky.name} from your hand?`,
        options: [{ id: 'play', label: `Play ${sneaky.name}` }, { id: 'keep', label: 'Keep it in my hand' }],
      });
      return;
    }

    // ---- Overlush: ages ----------------------------------------------------------
    case 'adventure': {
      const ids = handOf(s, task.p).filter(discardableFromHand).map((c) => c.id);
      if (!ids.length) return answerTask(s, task, { cardIds: [] });
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 0, max: Math.min(4, ids.length), optional: false,
        title: 'Age of Adventure: discard up to 4 cards, then draw 1 — if it shares a colour with one you discarded, you may play it.',
      });
      return;
    }
    case 'optDiscard': {
      const ids = handOf(s, task.p).filter((c) => discardableFromHand(c) && (!task.negativeOnly || faceValue(c) < 0)).map((c) => c.id);
      if (!ids.length) return;
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 0, max: Math.min(task.max, ids.length), optional: true, declineLabel: 'Keep my hand',
        title: task.then === 'draw1' ? `${task.why}: discard 1 card to draw 1?`
          : task.negativeOnly ? `${task.why}: discard any negative cards from your hand?`
          : task.max < 99 ? `${task.why}: discard up to ${task.max} cards from your hand?` : `${task.why}: discard any number of cards from your hand?`,
      });
      return;
    }
    case 'colorDiscard': {
      if (!handOf(s, task.p).some((c) => printedColors(c).includes(task.color))) return;
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: `${task.why}: discard all ${task.color} cards from your hand?`,
        options: [{ id: 'yes', label: `Discard my ${task.color} cards` }, { id: 'no', label: 'Keep them' }],
      });
      return;
    }
    case 'passColor': {
      const ids = handOf(s, task.from).filter((c) => printedColors(c).includes(task.color)).map((c) => c.id);
      if (!ids.length) {
        pushLog(s, task.from, `${seatName(s, task.from)} has no ${task.color} card to pass (Crackletown).`, 'normal');
        return;
      }
      if (ids.length === 1) return answerTask(s, task, { cardIds: ids });
      ask(s, task, { kind: 'cards', playerId: task.from, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false, title: `Crackletown: pass ${seatName(s, task.to)} 1 ${task.color} card from your hand.` });
      return;
    }
    case 'duelingMoons': {
      const options = [{ id: 'bottom', label: 'Draw 1 from the bottom of the deck' }];
      if (handOf(s, task.p).length) options.unshift({ id: 'top', label: 'Put 1 card from my hand on top of the deck' });
      ask(s, task, { kind: 'option', playerId: task.p, optional: false, title: 'Dueling Moons: put a card on top of the deck, or draw 1 from the bottom?', options });
      return;
    }
    case 'toDeck': {
      const ids = handOf(s, task.p).map((c) => c.id);
      const max = Math.min(task.max, ids.length);
      if (max <= 0) return;
      const min = Math.min(task.min, ids.length);
      if (min === ids.length && min === max) return answerTask(s, task, { cardIds: ids });
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min, max, optional: false,
        title: `${task.why}: put ${min === max ? max : `up to ${max}`} card${max === 1 ? '' : 's'} from your hand on the ${task.where} of the deck.`,
      });
      return;
    }
    case 'kingReveal': {
      const ids = handOf(s, task.p).map((c) => c.id);
      if (!ids.length) return;
      if (ids.length === 1) return answerTask(s, task, { cardIds: ids });
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false, title: 'King of the Jungle: choose a card to reveal. Only the single highest face value keeps their hand.' });
      return;
    }
    case 'kingResolve': {
      // UNCONFIRMED: "(No ties!)" — players tied for the highest don't keep their hands either.
      const shown = s.pendingReveal.map((r) => ({ ...r, card: handOf(s, r.p).find((c) => c.id === r.cardId) })).filter((r) => r.card);
      s.pendingReveal = [];
      pushLog(s, null, `King of the Jungle: ${shown.map((r) => `${seatName(s, r.p)} shows ${r.card!.name} (${faceValue(r.card!)})`).join(', ') || 'nobody shows a card'}.`, 'normal');
      const best = Math.max(...shown.map((r) => faceValue(r.card!)));
      const top = shown.filter((r) => faceValue(r.card!) === best);
      const king = top.length === 1 ? top[0]!.p : null;
      for (const p of orderFrom(s, s.firstPlayerIndex)) {
        if (p === king) continue;
        discardHandCards(s, p, handOf(s, p).map((c) => c.id));
        drawCards(s, p, 3);
      }
      pushLog(s, king, king ? `${seatName(s, king)} keeps their hand; everyone else discards theirs and draws 3.` : 'No single highest card: everyone discards their hand and draws 3.', 'danger');
      return;
    }
    case 'mokokoPlay':
      front(s, { t: 'playAnother', p: task.p, why: 'The Legend of Mokoko Village: you may play a 2nd trait (its Action is ignored).', triggerAction: false, optional: true });
      return;
    case 'livingLibrary': {
      // srcId −1: the title names the age; 'painted-shell' = an Action in your own pile.
      front(s, { t: 'pickTrait', p: task.p, mode: 'borrowAction', srcId: -1, filter: 'painted-shell', optional: true });
      return;
    }
    // ---- Overlush: catastrophes -------------------------------------------------------
    case 'sleepyWindow': {
      for (const q of orderFrom(s, s.firstPlayerIndex)) {
        if (task.asked.includes(q)) continue;
        const card = handOf(s, q).find((c) => c.kind === 'sleepy' && canPlayTrait(s, q, c));
        if (!card) continue;
        const cat = s.agesPlayed.find((a) => a.id === task.catId);
        ask(s, { ...task, asked: [...task.asked, q] }, {
          kind: 'option', playerId: q, optional: false, title: `${cat?.name ?? 'A catastrophe'} was turned (${cat?.genePoolDelta ?? 0} Gene Pool): play Sleepy to ignore its Gene Pool effect?`,
          options: [{ id: `play:${card.id}`, label: 'Play Sleepy' }, { id: 'keep', label: 'Keep it' }],
        });
        return;
      }
      return;
    }
    case 'catastropheGp': {
      const cat = s.agesPlayed.find((a) => a.id === task.catId);
      if (cat) catastropheGp(s, cat);
      return;
    }
    case 'passRight': {
      // Simultaneous, like Mega Tsunami: each affected player passes to the nearest affected player on their right.
      const cat = s.currentAge;
      const passing = s.seats.map((x) => x.id).filter((p) => !denialIgnores(s, p, cat));
      if (passing.length < 2) return;
      const match = (c: DmTraitCard) => (task.colors === 'colorless' ? printedColors(c).length === 0 : printedColors(c).some((col) => (task.colors as DmTraitColor[]).includes(col)));
      const moving = passing.map((p) => handOf(s, p).filter(match));
      passing.forEach((p, i) => {
        for (const c of moving[i]!) takeFromHand(s, p, c.id);
      });
      passing.forEach((_, i) => {
        const to = passing[(i - 1 + passing.length) % passing.length]!;
        handOf(s, to).push(...moving[i]!);
        gainedHand(s, to, moving[i]!);
      });
      pushLog(s, null, `Everyone passed their ${task.colors === 'colorless' ? 'colorless' : task.colors.join(' and ')} cards to the right.`, 'normal');
      return;
    }
    case 'weInvasive': {
      // Overlush Invasive Species (discard a card of face value 7 or less) / Imaginary Ends Isolation (with 3 or fewer cards, keep it).
      const isolation = s.worldsEnd?.effect === 'isolation';
      if (isolation && handOf(s, task.p).length > 3) return;
      const ids = handOf(s, task.p).filter((c) => isolation || faceValue(c) <= 7).map((c) => c.id);
      if (!ids.length) return;
      if (ids.length === 1) return answerTask(s, task, { cardIds: ids });
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false,
        title: isolation ? 'Isolation: choose a card in your hand — its face value is added to your score.' : 'Invasive Species: discard a card of face value 7 or less from your hand — its face value is added to your score.',
      });
      return;
    }
    // ---- Overlush: traits -----------------------------------------------------------------
    case 'removalWindow': {
      const owner = task.owner;
      if (task.asked.includes(owner)) return;
      const hand = handOf(s, owner);
      const byOpp = task.by !== null && task.by !== owner;
      const find = (k: DmTraitKind) => hand.find((c) => c.kind === k && canPlayTrait(s, owner, c));
      const options: { id: string; label: string }[] = [];
      const removed = findCard(s, task.cardId) ?? s.traitDeck.find((c) => c.id === task.cardId);
      const dart = byOpp ? find('dart') : undefined;
      const quills = byOpp && task.by ? find('quills') : undefined;
      const patches = !task.byDominant && removed && !tableauOf(s, owner).some((c) => c.id === task.cardId) ? find('patches') : undefined;
      const dazzle = find('motion-dazzle');
      if (patches) options.push({ id: `patches:${patches.id}`, label: `Play Patches — ${removed!.name} comes back` });
      if (dart) options.push({ id: `play:${dart.id}`, label: 'Play Dart' });
      if (quills) options.push({ id: `quills:${quills.id}`, label: `Play Quills into ${seatName(s, task.by!)}'s pile` });
      if (dazzle) options.push({ id: `play:${dazzle.id}`, label: 'Play Motion Dazzle' });
      if (!options.length) return;
      ask(s, { ...task, asked: [owner] }, {
        kind: 'option', playerId: owner, optional: false, title: `${removed?.name ?? 'A trait'} left your pile — play a card in answer?`,
        detail: 'It goes into a pile out of turn.',
        options: [...options, { id: 'pass', label: 'No' }],
      });
      return;
    }
    case 'elusive': {
      const card = handOf(s, task.p).find((c) => c.id === task.cardId);
      if (!card || !canPlayTrait(s, task.p, card)) return;
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'Elusive came into your hand — play it now?',
        options: [{ id: 'play', label: 'Play Elusive' }, { id: 'keep', label: 'Keep it' }],
      });
      return;
    }
    case 'muse': {
      const card = s.traitDiscard.find((c) => c.id === task.cardId);
      if (!card || !canPlayTrait(s, task.p, card)) return;
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'Muse was discarded from your hand — play it into your pile instead?',
        options: [{ id: 'play', label: 'Play Muse' }, { id: 'keep', label: 'Let it go' }],
      });
      return;
    }
    case 'mycelium': {
      const top = s.traitDiscard[s.traitDiscard.length - 1];
      if (!top || !canPlayTrait(s, task.p, top)) return;
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: `Mycelium left your pile — play ${top.name} from the top of the discard pile (its Action happens)?`,
        options: [{ id: 'play', label: `Play ${top.name}` }, { id: 'no', label: 'No' }],
      });
      return;
    }
    case 'snapTrap': {
      const stealable = task.ids.filter((id) => tableauOf(s, task.actor).some((c) => c.id === id && canTake(s, task.actor, c)));
      if (!stealable.length) return;
      for (const q of opponentsOf(s, task.actor)) {
        if (task.asked.includes(q)) continue;
        const card = handOf(s, q).find((c) => c.kind === 'snap-trap' && canPlayTrait(s, q, c));
        if (!card) continue;
        ask(s, { ...task, asked: [...task.asked, q] }, {
          kind: 'option', playerId: q, optional: false, title: `${seatName(s, task.actor)} played a 2nd trait this turn — play Snap-Trap and steal one of them?`,
          options: [{ id: `play:${card.id}`, label: 'Play Snap-Trap' }, { id: 'pass', label: 'Let it be' }],
        });
        return;
      }
      return;
    }
    case 'pinchyReplay':
      front(s, { t: 'playAnother', p: task.p, why: 'Pinchy took your trait: you may play another.', triggerAction: true, optional: true });
      return;
    case 'skimmer':
      front(s, { t: 'pickTrait', p: task.p, mode: 'borrowAction', srcId: -1, filter: 'skimmer', optional: true });
      return;
    case 'strange': {
      const cats = s.agesPlayed.filter((a) => a.kind === 'catastrophe' && a.catastrophe);
      if (!cats.length) return;
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'Strange: trigger the Catastrophic effect of an earlier catastrophe?',
        options: [...cats.map((a) => ({ id: String(a.id), label: `${a.name}: ${a.text}` })), { id: 'none', label: 'No' }],
      });
      return;
    }
    case 'afterBorrow': {
      const p = task.p;
      switch (task.mode) {
        case 'discardHand': {
          const ids = handOf(s, p).map((c) => c.id);
          discardHandCards(s, p, ids);
          if (ids.length) pushLog(s, p, `${seatName(s, p)} discarded their hand (Antennae).`, 'normal');
          return;
        }
        case 'discardRandom': {
          const gone = discardRandomFromHand(s, p, 1);
          if (gone.length) pushLog(s, p, `${seatName(s, p)} discarded a random card (Compound Eyes).`, 'normal');
          return;
        }
        case 'returnToOwner': {
          const card = tableauOf(s, task.owner).find((c) => c.id === task.cardId);
          if (card && canMove(s, task.owner, card)) {
            returnToHand(s, task.owner, card.id, { p, srcId: -1 });
            pushLog(s, p, `${card.name} went back to ${seatName(s, task.owner)}'s hand.`, 'normal');
          }
          return;
        }
        case 'discardIt': {
          const card = tableauOf(s, task.owner).find((c) => c.id === task.cardId);
          if (card && canDiscardFromPile(s, task.owner, card)) discardFromPile(s, task.owner, card.id, { p, srcId: -1 });
          return;
        }
      }
      return;
    }
    case 'agile': {
      const p = task.p;
      const targets = tableauOf(s, p).filter((c) => canDiscardFromPile(s, p, c)).map((c) => ({ ownerId: p, cardId: c.id }));
      // Each pile discard costs a card from hand, so stop when the hand can't pay.
      if (task.done >= 3 || !targets.length || handOf(s, p).length <= task.done) return answerTask(s, task, { decline: true });
      ask(s, task, {
        kind: 'trait', playerId: p, targets, optional: true, declineLabel: task.done ? 'Stop here' : 'Don’t discard any',
        title: `Agile: discard a trait from your pile? (${task.done} so far — each costs 1 card from your hand)`,
      });
      return;
    }
    case 'fierce': {
      const p = task.p;
      const targets = tableauOf(s, p).filter((c) => canDiscardFromPile(s, p, c)).map((c) => ({ ownerId: p, cardId: c.id }));
      if (task.done >= 2 || !targets.length) return;
      ask(s, task, { kind: 'trait', playerId: p, targets, optional: true, declineLabel: 'Stop here', title: `Fierce: discard a trait from your pile to draw 2? (${task.done} of 2)` });
      return;
    }
    case 'hiveMind': {
      const p = task.p;
      if (task.done >= 2) return;
      const targets = traitTargets(s, { t: 'pickTrait', p, mode: 'swapOwn', srcId: -1, filter: 'hive-mind' });
      if (!targets.length) return;
      ask(s, task, { kind: 'trait', playerId: p, targets, optional: true, declineLabel: 'Stop here', title: `Hive Mind: swap a positive trait from your pile? (${task.done} of 2)` });
      return;
    }
    case 'selfPruning': {
      const p = task.p;
      const options: { id: string; label: string }[] = [];
      if (tableauOf(s, p).some((c) => canDiscardFromPile(s, p, c))) options.push({ id: 'pile', label: 'A trait from my pile' });
      if (handOf(s, p).length) options.push({ id: 'hand', label: 'A card from my hand' });
      if (!options.length) return;
      if (options.length === 1) return answerTask(s, task, { optionId: options[0]!.id });
      ask(s, task, { kind: 'option', playerId: p, optional: false, title: 'Self-Pruning: discard a trait from your pile, or a card from your hand?', options });
      return;
    }
    case 'fromDiscard': {
      const ids = s.traitDiscard.filter((c) => task.rule === 'any' || faceValue(c) === 2).map((c) => c.id);
      if (!ids.length) return;
      if (ids.length === 1 && !task.optional) return answerTask(s, task, { cardIds: ids });
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'shown', min: 1, max: 1, optional: task.optional, declineLabel: 'No thanks', title: task.why });
      return;
    }
    case 'gift': {
      const pending = new Set(s.pendingGifts.filter((g) => g.from === task.p).map((g) => g.cardId));
      const ids = handOf(s, task.p).map((c) => c.id).filter((id) => !pending.has(id));
      const to = task.to[0];
      if (!to || !ids.length) return;
      if (task.to.length > 1) front(s, { ...task, to: task.to.slice(1) });
      const t1: DmTask = { ...task, to: [to] };
      if (ids.length === 1) return answerTask(s, t1, { cardIds: ids });
      ask(s, t1, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false, title: `${task.why}: choose a card from your hand to give to ${seatName(s, to)}.` });
      return;
    }
    case 'applyPending':
      for (const g of s.pendingGifts) giveHandCard(s, g.from, g.to, g.cardId);
      s.pendingGifts = [];
      return;
    case 'discardIds':
      discardHandCards(s, task.p, task.ids.filter((id) => handOf(s, task.p).some((c) => c.id === id)));
      return;
    case 'rover': {
      // The bottom 5 (the actor sees them through the prompt).
      const bottom = s.currentAge.ruleTag === 'certainty' ? s.traitDeck.slice(0, 5) : s.traitDeck.slice(-5);
      const ids = bottom.filter((c) => printedColors(c).includes(task.color) && canPlayTrait(s, task.p, c)).map((c) => c.id);
      pushLog(s, task.p, `${seatName(s, task.p)} looks at the bottom ${bottom.length} cards of the deck (Rover).`, 'normal');
      if (!ids.length) return;
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'shown', min: 1, max: 1, optional: true, declineLabel: 'Play none',
        title: `Rover: you may play a ${task.color} trait from the bottom of the deck (its Action is ignored).`,
      });
      return;
    }
    case 'sapient':
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'Sapient: peek at the next age, or the last 2 ages in the age deck?',
        options: [{ id: 'next', label: 'The next age' }, { id: 'last', label: 'The last 2 ages' }],
      });
      return;
    case 'seeker':
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'Seeker: name a face value. You draw 5, play 1 of that value, and discard the rest.',
        options: SEEKER_VALUES.map((v) => ({ id: String(v), label: String(v) })),
      });
      return;
    case 'seekerPlay': {
      const ids = handOf(s, task.p).filter((c) => task.drawn.includes(c.id) && faceValue(c) === task.value && canPlayTrait(s, task.p, c)).map((c) => c.id);
      const rest = (keep: number | undefined) => ({ t: 'discardIds', p: task.p, ids: task.drawn.filter((id) => id !== keep), why: 'Seeker' } as DmTask);
      if (!ids.length) {
        pushLog(s, task.p, `Seeker: none of the 5 has face value ${task.value}.`, 'normal');
        front(s, rest(undefined));
        return;
      }
      if (ids.length === 1) return answerTask(s, task, { cardIds: ids });
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false, title: `Seeker: play one of these (face value ${task.value}); the rest are discarded.` });
      return;
    }
    case 'shady': {
      const ids = handOf(s, task.p).filter((c) => !c.dominant && canPlayTrait(s, task.p, c)).map((c) => c.id);
      if (!ids.length || s.seats.length < 2) return;
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false, title: 'Shady: choose a card from your hand to play into an opponent’s pile (its Action is ignored).' });
      return;
    }
    case 'torpor': {
      const options = [{ id: 'draw', label: 'Draw 2 from the bottom of the deck' }];
      if (handOf(s, task.p).length) options.push({ id: 'place', label: 'Put 1 card from my hand at the bottom' });
      if (options.length === 1) return answerTask(s, task, { optionId: 'draw' });
      ask(s, task, { kind: 'option', playerId: task.p, optional: false, title: 'Torpor: draw 2 from the bottom, or put a card at the bottom?', options });
      return;
    }
    case 'trapper': {
      const ids = s.traitDiscard.filter((c) => c.dominant).map((c) => c.id);
      if (task.done >= 5 || !ids.length) return;
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'shown', min: 1, max: 1, optional: true, declineLabel: 'Stop here',
        title: `Trapper: put a Dominant from the discard pile on top of the deck (${task.done} of up to 5; the last one you pick ends up on top).`,
      });
      return;
    }
    case 'vagabondPlay': {
      const ids = handOf(s, task.p).filter((c) => !c.dominant && canPlayTrait(s, task.p, c)).map((c) => c.id);
      if (!ids.length) return;
      if (ids.length === 1) return answerTask(s, task, { cardIds: ids });
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false, title: `Vagabond: play a non-Dominant trait from your hand (its Action is ignored). ${seatName(s, task.actor)} may then steal one.` });
      return;
    }
    case 'vagabondChoice': {
      const stealable = task.ids.filter((id) => s.seats.some((x) => x.id !== task.actor && tableauOf(s, x.id).some((c) => c.id === id && canTake(s, x.id, c))));
      const canPlay = playableFromHand(s, task.actor).length > 0;
      const options: { id: string; label: string }[] = [];
      if (stealable.length) options.push({ id: 'steal', label: 'Steal one of the traits they just played' });
      if (canPlay) options.push({ id: 'play', label: 'Play another trait' });
      if (!options.length) return;
      if (options.length === 1) return answerTask(s, { ...task, ids: stealable }, { optionId: options[0]!.id });
      ask(s, { ...task, ids: stealable }, { kind: 'option', playerId: task.actor, optional: false, title: 'Vagabond: steal one of those traits, or play another trait?', options });
      return;
    }
    case 'wanderlust': {
      const first = handOf(s, task.p).find((c) => c.id === task.first);
      const options: { id: string; label: string }[] = [];
      if (first && canPlayTrait(s, task.p, first)) options.push({ id: 'play', label: `Play ${first.name} now` });
      options.push({ id: 'bottom', label: 'Draw 1 from the bottom of the deck' }, { id: 'none', label: 'Neither' });
      ask(s, task, { kind: 'option', playerId: task.p, optional: false, title: `Wanderlust: you drew ${first?.name ?? 'a card'}. Play it now, or draw 1 from the bottom of the deck (and you may play that)?`, options });
      return;
    }
    case 'electro': {
      const ids = handOf(s, task.p).filter((c) => task.drawn.includes(c.id) && c.action).map((c) => c.id);
      if (!ids.length) return;
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: true, declineLabel: 'None', title: 'Electroreception: play the Action of one of the cards you drew? (The card stays in your hand.)' });
      return;
    }
    case 'collector': {
      const open = DM_SCORING_COLORS.filter((c) => !task.used.includes(c));
      const ids = handOf(s, task.p)
        .filter((c) => task.drawn.includes(c.id) && printedColors(c).some((col) => open.includes(col)) && canPlayTrait(s, task.p, c))
        .map((c) => c.id);
      if (!ids.length) return;
      ask(s, task, {
        kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: true, declineLabel: 'Stop here',
        title: `Collector: you may play one of the cards you drew per colour (${open.join(' / ')} left; Actions ignored).`,
      });
      return;
    }
    case 'fabledCost': {
      const ids = handOf(s, task.p).filter((c) => c.id !== task.cardId && printedColors(c).length > 0).map((c) => c.id);
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 4, max: 4, optional: false, title: 'Fabled: to play it, discard 4 cards of the 4 different colours (red, blue, green, purple).' });
      return;
    }
    case 'illusoryEnd': {
      s.turnFx.ignoreActions = false;
      const card = handOf(s, task.p).find((c) => c.id === task.cardId);
      if (card) {
        discardHandCards(s, task.p, [card.id]);
        pushLog(s, task.p, `${seatName(s, task.p)} discarded ${card.name} (Illusory).`, 'normal');
      }
      return;
    }
    case 'harrier': {
      const ids = handOf(s, task.p).filter((c) => c.effectless).map((c) => c.id);
      if (!ids.length) return;
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: true, declineLabel: 'No', title: 'Harrier: discard an effectless trait from your hand to draw 3?' });
      return;
    }
    case 'illusory': {
      const ids = handOf(s, task.p).filter((c) => c.action).map((c) => c.id);
      if (!ids.length) return;
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: true, declineLabel: 'No', title: 'Illusory: play the Action of a card in your hand (then discard it; other Actions are ignored)?' });
      return;
    }
    case 'woolly':
      return;
    case 'chompers': {
      let n = 0;
      const src = tableauOf(s, task.p).find((c) => c.kind === 'chompers');
      for (const o of opponentsOf(s, task.p)) {
        const pool = tableauOf(s, o).filter((c) => c.effectless && canDiscardFromPile(s, o, c));
        if (!pool.length) continue;
        discardFromPile(s, o, pool[rngInt(s.rngState, pool.length)]!.id, { p: task.p, srcId: src?.id ?? -1 });
        n++;
      }
      if (n) front(s, { t: 'draw', p: task.p, n, why: 'Chompers' });
      return;
    }
    case 'lilyPad': {
      const targets = tableauOf(s, task.p).filter((c) => canMove(s, task.p, c)).map((c) => ({ ownerId: task.p, cardId: c.id }));
      if (task.done >= 3 || !targets.length) return;
      ask(s, task, { kind: 'trait', playerId: task.p, targets, optional: true, declineLabel: 'Stop here', title: `Lily Pad: return a trait from your pile to your hand for +1? (${task.done} of 3)` });
      return;
    }
    case 'pyrophyte': {
      const ids = handOf(s, task.p).filter((c) => task.drawn.includes(c.id) && faceValue(c) <= 2 && canPlayTrait(s, task.p, c)).map((c) => c.id);
      if (!ids.length) return;
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: true, declineLabel: 'Stop here', title: 'Pyrophyte: play one of the cards you drew with face value 2 or less (its Action is ignored)?' });
      return;
    }
    case 'spotsPick': {
      const ids = opponentsOf(s, task.actor).flatMap((o) => handOf(s, o).filter((c) => printedColors(c).includes(task.color)).map((c) => c.id));
      if (ids.length) pushLog(s, task.actor, `Spots: opponents reveal ${ids.map((id) => findCard(s, id)?.name).join(', ')}.`, 'normal');
      const ok = ids.filter((id) => canPlayTrait(s, task.actor, findCard(s, id)!));
      if (!ok.length) return;
      if (ok.length === 1) return answerTask(s, task, { cardIds: ok });
      ask(s, task, { kind: 'cards', playerId: task.actor, cardIds: ok, from: 'shown', min: 1, max: 1, optional: false, title: `Spots: play one of the revealed ${task.color} cards into your pile (its Action is ignored).` });
      return;
    }

    // ---- Imaginary Ends -----------------------------------------------------------
    case 'suppressPick': {
      const p = task.p;
      if (task.count <= 0) return;
      if (task.source === 'hand') {
        const ids = handOf(s, p).filter((c) => !task.exclude.includes(c.id)).map((c) => c.id);
        if (!ids.length || !suppressHosts(s, p, []).length) return;
        if (ids.length === 1 && !task.optional) return answerTask(s, task, { cardIds: ids });
        ask(s, task, {
          kind: 'cards', playerId: p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: task.optional, declineLabel: 'Stop here',
          title: `${task.why}: suppress a card from your hand (face down under one of your traits, +1 point).`,
        });
        return;
      }
      const targets = tableauOf(s, p).filter((c) => !unremovable(s, p, c) && !task.exclude.includes(c.id)).map((c) => ({ ownerId: p, cardId: c.id }));
      // A host must remain once the trait is gone.
      const ok = targets.filter((t) => suppressHosts(s, p, [t.cardId]).length > 0);
      if (!ok.length) return;
      if (ok.length === 1 && !task.optional) return answerTask(s, task, { target: ok[0]! });
      ask(s, task, {
        kind: 'trait', playerId: p, targets: ok, optional: task.optional, declineLabel: 'Stop here',
        title: `${task.why}: suppress a trait from your pile (it becomes a face-down +1 card under another trait).`,
      });
      return;
    }
    case 'suppressCards': {
      const p = task.p;
      const ids = task.ids.filter((id) => handOf(s, p).some((c) => c.id === id) || tableauOf(s, p).some((c) => c.id === id));
      if (!ids.length) return;
      const hosts = suppressHosts(s, p, ids);
      if (!hosts.length) {
        pushLog(s, p, `${task.why}: ${seatName(s, p)} has no trait to suppress under.`, 'normal');
        return;
      }
      const t2: DmTask = { ...task, ids };
      if (hosts.length === 1) return answerTask(s, t2, { target: { ownerId: p, cardId: hosts[0]!.id } });
      ask(s, t2, {
        kind: 'trait', playerId: p, targets: hosts.map((c) => ({ ownerId: p, cardId: c.id })), optional: false,
        title: `${task.why}: suppress ${ids.length} card${ids.length === 1 ? '' : 's'} — under which of your traits?`,
        detail: 'Suppressed cards are worth +1 each. If that trait leaves your pile, they go to the bottom of the deck.',
      });
      return;
    }
    case 'setGenePool':
      setGenePool(s, task.p, task.value);
      pushLog(s, task.p, `${seatName(s, task.p)}'s Gene Pool is set to ${genePoolOf(s, task.p)} (${task.why}).`, 'normal');
      return;
    case 'glitterstorm': {
      const n = handOf(s, task.p).filter(discardableFromHand).length;
      if (!n) return;
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'Glitterstorm: discard how many random cards from your hand? Then you stabilize.',
        options: [1, 2, 3].filter((k) => k <= Math.max(1, n)).map((k) => ({ id: String(k), label: `${k} at random` })),
      });
      return;
    }
    case 'lureColor':
      ask(s, task, {
        kind: 'color', playerId: task.p, colors: [...DM_SCORING_COLORS], optional: false,
        title: `Lure: name a colour — ${seatName(s, task.victim)} suppresses every card of it from their hand.`,
      });
      return;
    case 'bedazzled': {
      const [c] = drawCards(s, task.p, 1);
      if (!c) return;
      pushLog(s, task.p, `Bedazzled: ${seatName(s, task.p)} drew ${c.name}.`, 'normal');
      const seq: DmTask[] = [];
      if (c.effectless && canPlayTrait(s, task.p, c)) seq.push({ t: 'play', p: task.p, cardId: c.id, from: 'hand', triggerAction: false });
      if (c.sub?.includes('glitterling')) seq.push({ t: 'bedazzled', p: task.p });
      front(s, ...seq);
      return;
    }
    case 'magicBeans': {
      const [c] = drawCards(s, task.p, 1);
      if (!c) return;
      pushLog(s, task.p, `Magic Beans: ${seatName(s, task.p)} drew ${c.name}.`, 'normal');
      if (faceValue(c) === 1 && canPlayTrait(s, task.p, c)) front(s, { t: 'play', p: task.p, cardId: c.id, from: 'hand', triggerAction: false }, { t: 'magicBeans', p: task.p });
      return;
    }
    case 'effervescent': {
      const [c] = drawCards(s, task.p, 1);
      if (!c) return;
      const again = c.sub?.includes('deepling') || c.sub?.includes('glitterling');
      front(s, { t: 'suppressCards', p: task.p, ids: [c.id], why: 'Effervescent' }, ...(again ? [{ t: 'effervescent', p: task.p } as DmTask] : []));
      return;
    }
    case 'scrappy': {
      const ids = task.drawn.filter((id) => handOf(s, task.p).some((c) => c.id === id && canPlayTrait(s, task.p, c)));
      if (ids.length < task.drawn.length || ids.length < 2) return; // "play both" or nothing
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'Scrappy: play both cards you drew (Actions ignored) and discard Scrappy, or play neither?',
        options: [{ id: 'both', label: 'Play both, discard Scrappy' }, { id: 'neither', label: 'Play neither' }],
      });
      return;
    }
    case 'giveCards': {
      const ids = handOf(s, task.p).map((c) => c.id);
      if (!ids.length || s.seats.length < 2) return;
      if (!task.to) {
        const opps = opponentsOf(s, task.p);
        if (opps.length === 1) return void front(s, { ...task, to: opps[0]! });
        ask(s, task, { kind: 'player', playerId: task.p, playerIds: opps, optional: false, title: `${task.why}: give ${task.n} cards from your hand to which opponent?` });
        return;
      }
      const n = Math.min(task.n, ids.length);
      if (n === ids.length) return answerTask(s, task, { cardIds: ids });
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: n, max: n, optional: false, title: `${task.why}: choose ${n} card${n === 1 ? '' : 's'} from your hand to give away.` });
      return;
    }
    case 'mimsy': {
      const ids = handOf(s, task.p).map((c) => c.id);
      if (!ids.length || s.seats.length < 2) return;
      if (ids.length === 1) return answerTask(s, task, { cardIds: ids });
      ask(s, task, { kind: 'cards', playerId: task.p, cardIds: ids, from: 'hand', min: 1, max: 1, optional: false, title: 'Mimsy: give a card from your hand to an opponent — then suppress every card of its colour from your hand.' });
      return;
    }
    case 'polkaDots': {
      const ids = task.ids.filter((id) => s.traitDiscard.some((c) => c.id === id && canPlayTrait(s, task.p, c)));
      if (!ids.length) return;
      // "If any have a face value of 0, play them now": all of them, one at a time.
      front(s, { t: 'play', p: task.p, cardId: ids[0]!, from: 'discard', triggerAction: false }, { ...task, ids: ids.slice(1) });
      return;
    }
    case 'imaginative':
      ask(s, task, { kind: 'color', playerId: task.p, colors: [...DM_SCORING_COLORS], optional: false, title: 'Imaginative: name a colour, then the top card of the deck is discarded — if it matches, you and every opponent draw 2.' });
      return;
    case 'urf':
      if (!tableauOf(s, task.p).some((c) => c.kind === 'urf' && canDiscardFromPile(s, task.p, c))) return;
      ask(s, task, {
        kind: 'option', playerId: task.p, optional: false, title: 'Urf: discard it from your pile to draw 3?',
        options: [{ id: 'yes', label: 'Discard Urf, draw 3' }, { id: 'no', label: 'Keep it' }],
      });
      return;
    case 'gobLopters': {
      const opps = opponentsOf(s, task.p);
      if (opps.length === 1) return answerTask(s, task, { playerId: opps[0]! });
      ask(s, task, { kind: 'player', playerId: task.p, playerIds: opps, optional: false, title: 'Gob Lopters: give 2 random cards from your hand to which opponent?' });
      return;
    }
    case 'whimsy': {
      // "To play, you must draw 1 and reveal it. If it has no action, play it now. If it is dominant, discard the card along with Whimsy."
      const [c] = drawCards(s, task.p, 1);
      const whimsy = handOf(s, task.p).find((x) => x.id === task.cardId) ?? s.traitDiscard.find((x) => x.id === task.cardId);
      if (!c) {
        front(s, { t: 'play', p: task.p, cardId: task.cardId, from: task.from, triggerAction: task.triggerAction, costPaid: true });
        return;
      }
      pushLog(s, task.p, `Whimsy: ${seatName(s, task.p)} reveals ${c.name}.`, 'normal');
      if (c.dominant) {
        discardHandCards(s, task.p, [c.id]);
        if (whimsy && task.from !== 'discard') discardHandCards(s, task.p, [task.cardId]);
        pushLog(s, task.p, 'It is Dominant: it is discarded along with Whimsy.', 'danger');
        return;
      }
      const seq: DmTask[] = [{ t: 'play', p: task.p, cardId: task.cardId, from: task.from, triggerAction: task.triggerAction, costPaid: true }];
      if (!c.action) seq.push({ t: 'play', p: task.p, cardId: c.id, from: 'hand', triggerAction: false });
      front(s, ...seq);
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
        chosenPlayer: {},
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
        .filter((c) => canDiscardFromPile(s, task.p, c) && weDiscardMatches(s, task.p, c, task.rule))
        .map((c) => ({ ownerId: task.p, cardId: c.id }));
      if (!targets.length) return;
      if (targets.length === 1) return answerTask(s, task, { target: targets[0]! });
      ask(s, task, { kind: 'trait', playerId: task.p, targets, optional: false, title: `World’s End: discard ${WE_DISCARD_WORDS[task.rule]} from your pile.` });
      return;
    }
    case 'score':
      finishGame(s);
      return;
    default: {
      const never: never = task;
      throw new Error(`unknown task ${JSON.stringify(never)}`);
    }
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
  s.ageFx = freshAgeFx();
  s.agePhase = true;

  if (next.kind === 'catastrophe') {
    flipCatastrophe(s, next);
    return;
  }

  pushLog(s, null, `New age: ${next.name.trim()} — ${next.text}`, 'normal');
  front(s, ...ageEffects(s, next), { t: 'beginTurns' });
}

/** What everyone does for an age before turns are taken (also when Psychedelic restarts it). */
function ageEffects(s: DmState, age: DmAgeCard): DmTask[] {
  const order = orderFrom(s, s.firstPlayerIndex);
  const seq: DmTask[] = [];
  const each = (f: (p: PlayerId) => DmTask | DmTask[]) => {
    for (const p of order) seq.push(...([] as DmTask[]).concat(f(p)));
  };
  switch (age.ruleTag) {
    case 'dracula':
      each((p) => ({ t: 'ageRandomDiscard', p }));
      each((p) => ({ t: 'draculaSteal', p }));
      break;
    case 'cometShowers':
      each((p) => ({ t: 'ageRandomDiscard', p }));
      break;
    case 'reason':
      each((p) => ({ t: 'reasonKeep', p, cardIds: [] }));
      break;
    case 'alienTerraform':
      each((p) => ({ t: 'alienTerraform', p }));
      break;
    case 'birthOfAHero':
      each((p) => ({ t: 'heroRises', p }));
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
    case 'castleGlass':
      // UNCONFIRMED: you draw 2 even if you held fewer than 2 cards you could discard.
      each((p) => [{ t: 'discardFromHand', p, count: 2, why: 'Castle Glass', noClass: true }, { t: 'draw', p, n: 2, why: 'Castle Glass' }]);
      break;
    case 'magicHour':
      each((p) => ({ t: 'magicHour', p }));
      break;
    // ---- Imaginary Ends
    case 'quietMoment':
      each((p) => ({ t: 'optDiscard', p, why: age.name, max: 3 }));
      break;
    case 'reverie':
      // UNCONFIRMED: the passes happen together, like The Big One's gifts.
      for (const p of order) {
        const hand = handOf(s, p);
        if (hand.length) seq.push({ t: 'suppressCards', p, ids: [hand[rngInt(s.rngState, hand.length)]!.id], why: age.name });
      }
      if (s.seats.length > 1) each((p) => ({ t: 'gift', p, to: [leftOf(s, p)], why: age.name, pending: true }));
      seq.push({ t: 'applyPending' });
      break;
    case 'solitude':
      each((p) => ({ t: 'suppressPick', p, source: 'hand', count: 1, optional: false, why: age.name, exclude: [] }));
      break;
    case 'glitterstorm':
      each((p) => [{ t: 'glitterstorm', p }, { t: 'stabilize', p }]);
      break;
    case 'moonlight':
      each((p) => (genePoolOf(s, p) >= 4 ? { t: 'discardFromHand', p, count: 1, why: age.name } : { t: 'draw', p, n: 2, why: age.name }));
      break;
    case 'teaParties':
      for (const p of order) {
        const [c] = drawCards(s, p, 1);
        if (c) pushLog(s, p, `${seatName(s, p)} drew and shows ${c.name} (Sunshine & Tea Parties).`, 'normal');
      }
      break;
    // ---- Overlush
    case 'adventure':
      each((p) => ({ t: 'adventure', p }));
      break;
    case 'discovery':
      each((p) => ({ t: 'draw', p, n: 3, why: age.name }));
      break;
    case 'backwoods':
      each((p) => ({ t: 'pipPlay', p, value: 0, tried: [], negative: true }));
      break;
    case 'cleansingRains':
      each((p) => ({ t: 'optDiscard', p, why: age.name, max: 99 }));
      break;
    case 'crackletown':
      if (s.seats.length > 1) each((p) => ({ t: 'pickColor', p, mode: 'crackletown', srcId: -1 }));
      break;
    case 'duelingMoons':
      each((p) => ({ t: 'duelingMoons', p }));
      break;
    case 'glimmeringGardens':
      each((p) => ({ t: 'pickTrait', p, mode: 'discardOwn', srcId: -1, optional: true }));
      break;
    case 'harlequinFalls':
      each((p) => ({ t: 'pickColor', p, mode: 'harlequin', srcId: -1 }));
      break;
    case 'kingOfTheJungle':
      each((p) => ({ t: 'kingReveal', p }));
      seq.push({ t: 'kingResolve' });
      break;
    case 'discardPurple':
    case 'discardGreen':
    case 'discardBlue':
    case 'discardRed': {
      const color = ({ discardPurple: 'purple', discardGreen: 'green', discardBlue: 'blue', discardRed: 'red' } as const)[age.ruleTag];
      each((p) => ({ t: 'colorDiscard', p, color, why: age.name }));
      break;
    }
    case 'nostalgia':
      each((p) => ({ t: 'pickTrait', p, mode: 'returnOwn', srcId: -1, optional: true }));
      break;
    case 'ramblinRiver':
      each((p) => ({ t: 'pickColor', p, mode: 'ramblin', srcId: -1 }));
      break;
    case 'rustlingMeadows':
      each((p) => ({ t: 'optDiscard', p, why: age.name, max: 1, then: 'draw1' }));
      break;
    case 'starTails':
      // UNCONFIRMED: "this turn" read as the rest of this round.
      for (const p of order) {
        drawCards(s, p, 3);
        s.ageFx.noDraw.push(p);
      }
      break;
    case 'tangledCanopies':
      if (s.traitDiscard.length) {
        s.traitDeck = shuffle(s.rngState, [...s.traitDeck, ...s.traitDiscard]);
        s.traitDiscard = [];
        pushLog(s, null, 'The discard pile was shuffled into the trait deck.', 'normal');
      }
      break;
    case 'mokokoLegend':
      each((p) => ({ t: 'draw', p, n: 1, why: age.name.trim() }));
      break;
    case 'paintedValley':
      each((p) => ({ t: 'pickColor', p, mode: 'paintedValley', srcId: -1 }));
      break;
    case 'stranger':
      for (const p of order) {
        const [c] = drawCards(s, p, 1);
        if (c && !c.dominant) seq.push({ t: 'playAnother', p, why: 'The Stranger: you may play the card you drew (its Action is ignored).', triggerAction: false, cardIds: [c.id], optional: true, filter: { nonDominant: true } });
      }
      break;
    default:
      break;
  }
  return seq;
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

  front(s, { t: 'sleepyWindow', catId: cat.id, asked: [] }, { t: 'catastropheGp', catId: cat.id });
}

/** Overlush Sleepy, then every Gene Pool changes, then the Catastrophic effect. */
function catastropheGp(s: DmState, cat: DmAgeCard) {
  const order = orderFrom(s, s.firstPlayerIndex);
  const affected = order.filter((p) => !denialIgnores(s, p, cat));
  for (const p of affected) {
    if (s.ageFx.sleepy?.includes(p)) continue;
    // Imaginary Ends Moonpocalypse: "cannot reduce your Gene Pool lower than 4".
    if (cat.catastrophe === 'moonpocalypse') {
      const gp = genePoolOf(s, p);
      if (gp > 4) adjustGenePool(s, p, Math.max(cat.genePoolDelta, 4 - gp), false);
    } else adjustGenePool(s, p, cat.genePoolDelta, false);
  }
  front(s, ...catastropheEffects(s, cat.catastrophe!, affected), { t: 'afterCatastrophe' });
}

/** A Catastrophic effect for these players (also Strange's trigger). */
function catastropheEffects(s: DmState, tag: DmCatastropheTag, affected: PlayerId[]): DmTask[] {
  const seq: DmTask[] = [];
  const pass: Partial<Record<DmCatastropheTag, DmTraitColor[] | 'colorless'>> = {
    endlessMonsoon: ['purple'], greatDeluge: ['blue'], invasiveSpecies: ['green'], strangeMatter: ['red'], tropicalSuperstorm: 'colorless',
  };
  if (tag === 'megaTsunami') seq.push({ t: 'passHandsRight' });
  else if (pass[tag]) seq.push({ t: 'passRight', colors: pass[tag]! });
  else if (tag === 'theBigOne') {
    for (const p of affected) {
      const to = [...new Set([leftOf(s, p), rightOf(s, p)])].filter((x) => x !== p);
      seq.push({ t: 'bigOneGive', p, to });
    }
    seq.push({ t: 'applyGifts' });
  } else {
    for (const p of affected) seq.push({ t: 'catastropheEffect', p, tag });
  }
  return seq;
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
    case 'stillWater': {
      // "Draw 3. Do not stabilize to end your turn this age." (see endOfTurnMode)
      const n = drawCards(s, p, 3).length;
      if (n) pushLog(s, p, `${seatName(s, p)} drew ${n} (Still Water).`, 'normal');
      return;
    }
    // ---- Overlush
    case 'algalSuperbloom': {
      const n = tableauOf(s, p).filter((c) => faceValue(c) < 0).length;
      if (n) front(s, { t: 'draw', p, n, why: name });
      return;
    }
    case 'ancientCorruption':
    case 'ashlands':
    case 'planetaryDeforestation':
    case 'volcanicWinter': {
      const match: (c: DmTraitCard) => boolean =
        tag === 'ancientCorruption' ? (c) => !!c.action
        : tag === 'ashlands' ? (c) => printedColors(c).some((col) => col === 'purple' || col === 'blue')
        : tag === 'planetaryDeforestation' ? (c) => printedColors(c).some((col) => col === 'green' || col === 'red')
        : (c) => faceValue(c) >= 4;
      const ids = hand.filter(match).map((c) => c.id);
      discardHandCards(s, p, ids);
      if (ids.length) pushLog(s, p, `${seatName(s, p)} discarded ${ids.length} card${ids.length === 1 ? '' : 's'} (${name}).`, 'danger');
      if (tag === 'ashlands' || tag === 'planetaryDeforestation') front(s, { t: 'stabilize', p });
      return;
    }
    case 'ecologicalCollapse': {
      const n = Math.min(hand.length, distinctColors(s, p).length);
      if (n) front(s, { t: 'discardFromHand', p, count: n, why: name });
      return;
    }
    case 'sacrifice':
      front(s, { t: 'pickTrait', p, mode: 'returnOwn', srcId: -1 });
      return;
    case 'tragedyOfTheCommons':
      front(s, { t: 'pickColor', p, mode: 'tragedy', srcId: -1 });
      return;
    case 'chokingVines':
    case 'jungleRot':
      return; // Actions of those colours are ignored this round (actionsIgnoredFor)
    // ---- Imaginary Ends
    case 'abyssStaresBack':
      front(s, ...(hand.length ? [{ t: 'suppressCards', p, ids: hand.map((c) => c.id), why: name } as DmTask] : []), { t: 'stabilize', p });
      return;
    case 'isolation':
      if (hand.length && hand.length <= 3) front(s, { t: 'suppressCards', p, ids: [hand[rngInt(s.rngState, hand.length)]!.id], why: name }, { t: 'stabilize', p });
      return;
    case 'tooMuchPink':
      discardHandCards(s, p, hand.map((c) => c.id));
      pushLog(s, p, `${seatName(s, p)} discarded their hand (Too Much Pink).`, 'danger');
      return;
    case 'moonpocalypse':
      return; // its Gene Pool rule is in catastropheGp
    case 'megaTsunami':
    case 'theBigOne':
    case 'endlessMonsoon':
    case 'greatDeluge':
    case 'invasiveSpecies':
    case 'strangeMatter':
    case 'tropicalSuperstorm':
      return; // handled for everyone at once in catastropheEffects
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
  s.turnBans = s.turnBans.filter((b) => b.p !== s.turnPlayerId);
  s.tasks.push({ t: 'nihilism' });
  s.turnStage = 'resolving';
}

// ============================================================================
// Playing a trait
// ============================================================================

function matchesPlayFilter(c: DmTraitCard, f: DmPlayFilter | undefined): boolean {
  if (!f) return true;
  if (f.face !== undefined && faceValue(c) !== f.face) return false;
  if (f.maxFace !== undefined && faceValue(c) > f.maxFace) return false;
  if (f.negative && faceValue(c) >= 0) return false;
  if (f.nonDominant && c.dominant) return false;
  if (f.color && !printedColors(c).includes(f.color)) return false;
  return true;
}

function needsCost(card: DmTraitCard): boolean {
  return ['morality', 'retractable-claws', 'fabled', 'metamorphosis', 'xylophage', 'gob-lopters', 'whimsy'].includes(card.kind);
}

function execPlay(s: DmState, task: Extract<DmTask, { t: 'play' }>) {
  const { p, cardId, from } = task;
  const inHand = from === 'discard' ? undefined : handOf(s, p).find((c) => c.id === cardId);
  const inDiscard = from === 'discard' ? s.traitDiscard.find((c) => c.id === cardId) : undefined;
  const card = inHand ?? inDiscard;
  if (!card) return;
  // A paid "to play" cost has met the requirement (paying it can use up what the requirement looks for).
  const block = playBlock(s, p, card, task.unrestricted);
  if (block && !(task.costPaid && block.kind === 'requirement')) return;
  if (needsCost(card) && !task.unrestricted && !task.costPaid) {
    front(s, { t: 'payCost', p, cardId, from, triggerAction: task.triggerAction });
    return;
  }
  if (inHand) takeFromHand(s, p, cardId);
  else s.traitDiscard.splice(s.traitDiscard.indexOf(card), 1);

  const into = task.into ?? p;
  // Overlush Opposable Thumbs: "Play this as an exact copy of your other dominant."
  if (card.kind === 'opposable-thumbs') becomeCopy(s, into, card);
  addToPile(s, into, card);
  s.lastPlayedColors = printedColors(card);
  const where = into === p ? '' : ` into ${seatName(s, into)}'s pile`;
  const fromWords = from === 'discard' ? ' from the discard pile' : '';
  pushLog(s, p, `${seatName(s, p)} played ${card.name}${fromWords}${where}.`, 'normal');

  const seq: DmTask[] = [];
  const turnPlay = !task.outOfTurn && from !== 'deck';
  const ownTurn = p === s.turnPlayerId && !s.agePhase && !s.worldsEnd && s.phase === 'playing';
  // Overlush Ravenous: "draw 3 cards before playing its effect".
  if (ownTurn && into === p && hasKind(s, p, 'ravenous') && printedColors(card).includes('red')) {
    const n = drawCards(s, p, 3).length;
    pushLog(s, p, `${seatName(s, p)} drew ${n} (Ravenous).`, 'normal');
  }
  if (turnPlay && !card.dominant && s.seats.length > 1) seq.push({ t: 'parasiticWindow', actor: p, cardId: card.id, asked: [] });
  if (ON_ENTER.has(card.kind)) seq.push({ t: 'onEnter', p: into, cardId: card.id });
  // Play-When effects, when the card is played from a hand.
  if (from === 'hand') {
    switch (card.kind) {
      case 'conchomancy':
        peekNextAge(s, p, 'Conchomancy');
        break;
      case 'sunny':
        seq.push({ t: 'stabilize', p, to: 8 });
        break;
      case 'booster':
        seq.push({ t: 'stabilize', p });
        break;
      case 'trippy':
        seq.push({ t: 'draw', p, n: 3, why: 'Trippy' });
        break;
      case 'firebite':
        // Only when played as instructed (after you stabilize), not as a turn's trait.
        if (task.outOfTurn) {
          for (const o of opponentsOf(s, p)) stealRandomFromHand(s, o, p, 1);
          pushLog(s, p, `Firebite: ${seatName(s, p)} stole a random card from each opponent.`, 'danger');
        }
        break;
      case 'collector': {
        const drawn = drawCards(s, p, 4);
        const doms = drawn.filter((c) => c.dominant).map((c) => c.id);
        discardHandCards(s, p, doms);
        pushLog(s, p, `Collector: ${seatName(s, p)} drew ${drawn.length}${doms.length ? ` and discarded ${doms.length} Dominant${doms.length === 1 ? '' : 's'}` : ''}.`, 'normal');
        seq.push({ t: 'collector', p, drawn: drawn.filter((c) => !c.dominant).map((c) => c.id), used: [] });
        break;
      }
      default:
        break;
    }
  }
  if (task.triggerAction && card.action && !actionsIgnoredFor(s, card)) {
    seq.push({ t: 'preventWindow', actor: p, srcId: card.id, kind: card.kind, asked: [] });
  }
  if (s.currentAge.ruleTag === 'swamplands' && card.action) s.ageFx.swamp.push({ p, cardId: card.id });
  // Imaginary Ends ages.
  if (s.currentAge.ruleTag === 'unusualFriends' && card.sub?.length) seq.push({ t: 'draw', p, n: 2, why: 'Unusual Friends' });
  if (ownTurn) {
    if (s.turnFx.p !== p) s.turnFx = { p, used: [] };
    const fx = s.turnFx;
    fx.plays = [...(fx.plays ?? []), card.id];
    if (fx.plays.length === 2 && opponentsOf(s, p).some((o) => handOf(s, o).some((c) => c.kind === 'snap-trap'))) {
      seq.push({ t: 'snapTrap', actor: p, ids: [...fx.plays], asked: [] });
    }
    if (card.effectless) {
      // UNCONFIRMED: Skimmer and Strange trigger on effectless traits played during your own turn.
      if (hasKind(s, p, 'skimmer') && !fx.used.includes('skimmer')) {
        fx.used.push('skimmer');
        seq.push({ t: 'skimmer', p });
      }
      if (hasKind(s, p, 'strange')) seq.push({ t: 'strange', p });
    }
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
  // Fading Away: "After playing a trait and resolving its effect, suppress it. (Excluding dominants.)"
  if (s.currentAge.ruleTag === 'fadingAway' && !card.dominant) seq.push({ t: 'suppressCards', p: into, ids: [card.id], why: 'Fading Away' });
  front(s, ...seq);
}

/**
 * Is this trait's Action ignored right now? Age of Peace (all), Overlush's
 * Choking Vines (blue / green) and Jungle Rot (red / purple), and anything
 * Illusory sets off.
 */
function actionsIgnoredFor(s: DmState, card: DmTraitCard): boolean {
  if (s.currentAge.ruleTag === 'ignoreActions') return true;
  return colourActionsIgnored(s, card) || !!s.turnFx.ignoreActions;
}

function colourActionsIgnored(s: DmState, card: DmTraitCard): boolean {
  const cols = printedColors(card);
  if (s.currentAge.catastrophe === 'chokingVines') return cols.some((c) => c === 'blue' || c === 'green');
  if (s.currentAge.catastrophe === 'jungleRot') return cols.some((c) => c === 'red' || c === 'purple');
  return false;
}

/** Overlush Opposable Thumbs becomes an exact copy of `p`'s other Dominant (for the rest of the game). */
function becomeCopy(s: DmState, p: PlayerId, card: DmTraitCard) {
  const other = tableauOf(s, p).find((c) => c.dominant && c.id !== card.id);
  if (!other) return;
  const { id, source } = card;
  Object.assign(card, { ...other, id, source, name: `${other.name} (Opposable Thumbs)`, copyOf: other.name });
  pushLog(s, p, `Opposable Thumbs becomes a copy of ${other.name}.`, 'normal');
}

/** Puts a task after any tasks added to the front since the queue had `before` entries ("immediately" effects go first). */
function frontAfterNew(s: DmState, before: number, task: DmTask) {
  s.tasks.splice(Math.max(0, s.tasks.length - before), 0, task);
}

/** Seeker's face values to name. */
const SEEKER_VALUES = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Swamplands: discard a card "wherever it is" (a hand or a pile; Dominants stay). */
function discardAnywhere(s: DmState, id: number, by: PlayerId) {
  for (const seat of s.seats) {
    const inPile = tableauOf(s, seat.id).find((c) => c.id === id);
    if (inPile) {
      if (canDiscardFromPile(s, seat.id, inPile)) discardFromPile(s, seat.id, id, { p: by, srcId: -1 });
      return;
    }
    if (handOf(s, seat.id).some((c) => c.id === id)) {
      discardHandCards(s, seat.id, [id]);
      pushLog(s, seat.id, `${findCard(s, id)?.name ?? 'A card'} was discarded from ${seatName(s, seat.id)}'s hand (Swamplands).`, 'normal');
      return;
    }
  }
}

/** Traits with a "when played" effect that isn't an Action (it happens however the trait is played). */
const ON_ENTER: ReadonlySet<DmTraitKind> = new Set([
  'vampirism', 'optimistic-nihilism', 'opulent', 'pearl', 'pip', 'resplendent', 'fierce', 'hive-mind',
  // Imaginary Ends: suppress effects "are not actions"; they happen when the trait is played.
  'atavism', 'baffling', 'chemotroph', 'effervescent', 'hidden', 'lure', 'mimsy', 'spineless', 'translucent', 'untold', 'whip-tail',
  'remarkable', 'feisty', 'popplebelly',
]);

function onEnter(s: DmState, p: PlayerId, card: DmTraitCard) {
  switch (card.kind) {
    case 'vampirism':
      front(s, { t: 'pickTrait', p, mode: 'vampirism', srcId: card.id });
      return;
    case 'optimistic-nihilism':
      triggerNihilism(s, p);
      return;
    case 'opulent': {
      const n = drawCards(s, p, 1).length;
      if (n) pushLog(s, p, `${seatName(s, p)} drew 1 (Opulent).`, 'normal');
      front(s, { t: 'playAnother', p, why: 'Opulent: play another trait.', triggerAction: true });
      return;
    }
    case 'resplendent':
      front(s, { t: 'playAnother', p, why: 'Resplendent: play another trait.', triggerAction: true });
      return;
    case 'pearl':
      // UNCONFIRMED: a dual-colour trait uses up both of its colours.
      front(s, { t: 'pearl', p, used: [] });
      return;
    case 'pip':
      front(s, { t: 'pip', p });
      return;
    case 'fierce':
      front(s, { t: 'fierce', p, done: 0 });
      return;
    case 'hive-mind':
      front(s, { t: 'hiveMind', p, done: 0 });
      return;
    // ---- Imaginary Ends
    case 'atavism': {
      const ids = tableauOf(s, p).filter((c) => c.genePoolDelta !== 0 && !unremovable(s, p, c)).map((c) => c.id);
      // The Gene Pool is set once those traits are suppressed (which reverses their changes).
      front(s, ...(ids.length ? [{ t: 'suppressCards', p, ids, why: 'Atavism' } as DmTask] : []), { t: 'setGenePool', p, value: 5, why: 'Atavism' });
      return;
    }
    case 'baffling':
      front(s, { t: 'suppressPick', p, source: 'pile', count: 1, optional: false, why: 'Baffling', exclude: [card.id] }, { t: 'pickPlayer', p, mode: 'baffling', srcId: card.id });
      return;
    case 'chemotroph':
      front(s, { t: 'suppressPick', p, source: 'pile', count: 1, optional: false, why: 'Chemotroph', exclude: [card.id] }, { t: 'playAnother', p, why: 'Chemotroph: play another trait.', triggerAction: true });
      return;
    case 'effervescent':
      front(s, { t: 'effervescent', p });
      return;
    case 'hidden':
      front(s, { t: 'pickTrait', p, mode: 'steal', srcId: card.id, filter: 'hidden' });
      return;
    case 'lure':
      if (s.seats.length > 1) front(s, { t: 'lureColor', p: rightOf(s, p), victim: p });
      return;
    case 'mimsy':
      front(s, { t: 'mimsy', p });
      return;
    case 'spineless': {
      const ids = tableauOf(s, p).filter((c) => faceValue(c) === 1 && !unremovable(s, p, c) && c.id !== card.id).map((c) => c.id);
      if (ids.length) front(s, { t: 'suppressCards', p, ids, why: 'Spineless' });
      return;
    }
    case 'translucent':
      front(s, { t: 'suppressPick', p, source: 'hand', count: 1, optional: false, why: 'Translucent', exclude: [] });
      return;
    case 'untold':
      front(s, { t: 'suppressPick', p, source: 'pile', count: 2, optional: true, why: 'Untold', exclude: [card.id] });
      return;
    case 'whip-tail':
      front(s, { t: 'suppressPick', p, source: 'pile', count: 1, optional: false, why: 'Whip Tail', exclude: [card.id] });
      return;
    case 'remarkable': {
      // "All your friends pass their hands right (not you!) and stabilize. Then, suppress your hand."
      const friends = orderFrom(s, seatIdx(s, p)).filter((q) => q !== p);
      if (friends.length > 1) {
        const before = friends.map((q) => handOf(s, q));
        friends.forEach((_, i) => {
          s.hands[friends[(i - 1 + friends.length) % friends.length]!] = before[i]!;
        });
        for (const q of friends) gainedHand(s, q, handOf(s, q));
        pushLog(s, p, 'Remarkable: every opponent passes their hand to the right.', 'danger');
      }
      const ids = handOf(s, p).map((c) => c.id);
      front(s, ...friends.map((q): DmTask => ({ t: 'stabilize', p: q })), ...(ids.length ? [{ t: 'suppressCards', p, ids, why: 'Remarkable' } as DmTask] : []));
      return;
    }
    case 'feisty': {
      const [c] = drawCards(s, p, 1);
      if (!c) return;
      pushLog(s, p, `Feisty: ${seatName(s, p)} reveals ${c.name}.`, 'normal');
      if (printedColors(c).includes('green')) {
        for (const o of opponentsOf(s, p)) adjustGenePool(s, o, 1, false);
        pushLog(s, p, 'It is green: every opponent gets +1 Gene Pool.', 'normal');
      }
      return;
    }
    case 'popplebelly':
      s.genePool[p] = 1;
      pushLog(s, p, `Popplebelly: ${seatName(s, p)}'s Gene Pool is 1 and can't change.`, 'normal');
      return;
    default:
      return;
  }
}

function peekNextAge(s: DmState, p: PlayerId, why: string) {
  const next = s.ageDeck[0];
  if (!next) return;
  s.peekedAge[p] = next.id;
  pushLog(s, p, `${seatName(s, p)} peeked at the next age (${why}).`, 'normal');
}

/**
 * Parasitic: "when an opponent plays a trait, steal that trait, stop its action."
 * Overlush Pinchy: "stop its action and add it to your hand. That opponent may play another trait."
 */
function parasiticWindow(s: DmState, task: Extract<DmTask, { t: 'parasiticWindow' }>) {
  const card = tableauOf(s, task.actor).find((c) => c.id === task.cardId);
  if (!card || !canTake(s, task.actor, card)) return;
  for (const q of opponentsOf(s, task.actor)) {
    if (task.asked.includes(q)) continue;
    const para = handOf(s, q).find((c) => c.kind === 'parasitic' && canPlayTrait(s, q, c));
    const pinchy = handOf(s, q).find((c) => c.kind === 'pinchy' && canPlayTrait(s, q, c));
    if (!para && !pinchy) continue;
    const options: { id: string; label: string }[] = [];
    if (para) options.push({ id: 'play', label: `Play Parasitic — steal ${card.name}` });
    if (pinchy) options.push({ id: 'pinchy', label: `Play Pinchy — ${card.name} goes to your hand` });
    ask(s, { ...task, asked: [...task.asked, q] }, {
      kind: 'option', playerId: q, optional: false,
      title: `${seatName(s, task.actor)} played ${card.name}. Answer it out of turn and stop its Action?`,
      detail: 'This doesn’t count as your turn.',
      options: [...options, { id: 'pass', label: 'Let it be' }],
    });
    return;
  }
}

const PREVENTERS: readonly DmTraitKind[] = ['automimicry', 'chromatophores'];

/** Automimicry / Chromatophores: "play from your hand at any time to prevent an action". */
function preventWindow(s: DmState, task: Extract<DmTask, { t: 'preventWindow' }>) {
  const src = findCard(s, task.srcId);
  if (src && colourActionsIgnored(s, src)) {
    pushLog(s, task.actor, `${src.name}'s Action is ignored (${s.currentAge.name}).`, 'normal');
    return;
  }
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
  } else if (block.kind === 'dominants' || block.kind === 'requirement') {
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
  if (s.turnFx.p === actor && actor === s.turnPlayerId) s.turnFx.actions = (s.turnFx.actions ?? 0) + 1;
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
    case 'the-third-eye':
      peekNextAge(s, actor, 'The Third Eye');
      front(s, { t: 'playAnother', p: actor, why: 'The Third Eye: play another trait.', triggerAction: true });
      return;
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

    // ---- Castle Glass --------------------------------------------------------
    case 'aposematic':
    case 'spiral-dome': {
      const n = drawCards(s, actor, kind === 'aposematic' ? 1 : 2).length;
      pushLog(s, actor, `${seatName(s, actor)} drew ${n} (${name}).`, 'normal');
      if (kind === 'aposematic') front(s, { t: 'playAnother', p: actor, why: 'Aposematic: play another trait.', triggerAction: true });
      return;
    }
    case 'benthic':
      front(s, { t: 'benthic', p: actor });
      return;
    case 'biochromatic':
    case 'crystal-skeleton': {
      // Biochromatic: opponents discard their colorless cards; Crystal Skeleton:
      // everyone (actor first) discards their Dominants. Then each of them stabilizes.
      const who = kind === 'biochromatic' ? opps : [actor, ...opps];
      for (const q of who) {
        const ids = handOf(s, q).filter((c) => (kind === 'biochromatic' ? printedColors(c).length === 0 : c.dominant)).map((c) => c.id);
        discardHandCards(s, q, ids);
        if (ids.length) pushLog(s, q, `${seatName(s, q)} discarded ${ids.length} ${kind === 'biochromatic' ? 'colorless' : 'Dominant'} card${ids.length === 1 ? '' : 's'} (${name}).`, 'danger');
      }
      front(s, ...who.map((q): DmTask => ({ t: 'stabilize', p: q })));
      return;
    }
    case 'brainy':
      for (const o of opps) if (!s.turnBans.some((b) => b.p === o && b.color === 'purple')) s.turnBans.push({ p: o, color: 'purple', srcId });
      pushLog(s, actor, `Brainy: ${seatName(s, actor)}'s opponents can't play purple traits on their next turn.`, 'danger');
      return;
    case 'copper-band':
      front(s, { t: 'playAnother', p: actor, why: 'Copper Band: play another trait with face value 1.', triggerAction: true, filter: { face: 1 } });
      return;
    case 'fish-collector':
      front(s, { t: 'pickTrait', p: actor, mode: 'steal', srcId, filter: kind, optional: true });
      return;
    case 'fragmentation':
      front(s, { t: 'stabilize', p: actor, to: 4 }, { t: 'playAnother', p: actor, why: 'Fragmentation: play another trait.', triggerAction: true });
      return;
    case 'glass-predator':
      front(s, { t: 'pickTrait', p: actor, mode: 'steal', srcId }, { t: 'playAnother', p: actor, why: 'Glass Predator: play another trait.', triggerAction: true });
      return;
    case 'guanine-crystals':
    case 'harboring':
      if (s.turnFx.p !== actor) s.turnFx = { p: actor, used: [] };
      if (kind === 'guanine-crystals') s.turnFx.draw2 = true;
      else s.turnFx.stabilizeTo = 6;
      pushLog(s, actor, kind === 'guanine-crystals' ? `${seatName(s, actor)} will draw 2 instead of stabilizing this turn.` : `${seatName(s, actor)} will stabilize to 6 this turn.`, 'normal');
      return;
    case 'natural-symmetry': {
      const next = s.ageDeck[0];
      if (!next) return;
      for (const seat of s.seats) s.peekedAge[seat.id] = next.id;
      pushLog(s, actor, 'Natural Symmetry: every player previews the next age.', 'normal');
      return;
    }
    case 'pteridines': {
      const drawn = drawCards(s, actor, 1);
      pushLog(s, actor, `${seatName(s, actor)} drew ${drawn.length} (Pteridines).`, 'normal');
      if (drawn.length) front(s, { t: 'playAnother', p: actor, why: 'Pteridines: you may play the card you just drew.', triggerAction: true, cardIds: drawn.map((c) => c.id), optional: true });
      return;
    }
    case 'sandy':
      if (s.ageDeck.length > 1) {
        s.ageDeck.push(s.ageDeck.shift()!);
        pushLog(s, actor, `Sandy: ${seatName(s, actor)} put the next age at the bottom of the age deck.`, 'normal');
      }
      return;
    case 'spiny-fins':
      front(s, { t: 'playAnother', p: actor, why: 'Spiny Fins: play another trait (then it is discarded).', triggerAction: true, then: 'discard' });
      return;
    // ---- Overlush --------------------------------------------------------------
    case 'agile':
      front(s, { t: 'agile', p: actor, done: 0 });
      return;
    case 'antennae':
    case 'compound-eyes':
      front(s, { t: 'pickTrait', p: actor, mode: 'borrowAction', srcId, filter: kind }, { t: 'afterBorrow', p: actor, mode: kind === 'antennae' ? 'discardHand' : 'discardRandom', cardId: -1, owner: actor });
      return;
    case 'hydrofuge':
    case 'mandibles':
    case 'sprightly':
      front(s, { t: 'pickTrait', p: actor, mode: 'borrowAction', srcId, filter: kind });
      return;
    case 'arrested-muscles':
      front(s, { t: 'fromDiscard', p: actor, why: 'Arrested Muscles: take a face-value-2 trait from the discard pile.', rule: 'face2', optional: false });
      return;
    case 'booming-call':
      if (s.turnFx.p === actor && s.turnFx.used.includes(kind)) {
        pushLog(s, actor, 'Booming Call’s Action can’t be used again this turn.', 'normal');
        return;
      }
      if (s.turnFx.p !== actor) s.turnFx = { p: actor, used: [] };
      s.turnFx.used.push(kind);
      if (srcInMyPile) front(s, { t: 'pickTrait', p: actor, mode: 'swapWithSource', srcId, filter: kind });
      return;
    case 'bottomfeeder':
    case 'swampy': {
      const n = drawCards(s, actor, kind === 'bottomfeeder' ? 2 : 3, 'bottom').length;
      pushLog(s, actor, `${seatName(s, actor)} drew ${n} from the bottom of the deck (${name}).`, 'normal');
      return;
    }
    case 'bushwhacker':
      front(s, ...[actor, ...opps].map((q): DmTask => ({ t: 'discardFromHand', p: q, count: 1, why: 'Bushwhacker' })), {
        t: 'fromDiscard', p: actor, why: 'Bushwhacker: you may take any card from the discard pile.', rule: 'any', optional: true,
      });
      return;
    case 'caffeinated': {
      const all = [actor, ...opps];
      for (const q of all) drawCards(s, q, 3);
      pushLog(s, actor, 'Caffeinated: everyone draws 3, then passes 1 to the right.', 'normal');
      front(s, ...all.map((q): DmTask => ({ t: 'gift', p: q, to: [rightOf(s, q)].filter((x) => x !== q), why: 'Caffeinated', pending: true })), { t: 'applyPending' });
      return;
    }
    case 'cheek-pouches': {
      const n = drawCards(s, actor, 2).length;
      if (s.turnFx.p !== actor) s.turnFx = { p: actor, used: [] };
      s.turnFx.noStabilize = true;
      pushLog(s, actor, `${seatName(s, actor)} drew ${n} and won't stabilize this turn (Cheek Pouches).`, 'normal');
      return;
    }
    case 'cocoa': {
      const n = drawCards(s, actor, 3).length;
      pushLog(s, actor, `${seatName(s, actor)} drew ${n} (Cocoa).`, 'normal');
      front(s, { t: 'dotingPick', p: actor, why: 'Cocoa' }, { t: 'dotingPick', p: actor, why: 'Cocoa' });
      return;
    }
    case 'contagious':
    case 'infectious':
    case 'noxious':
    case 'toxic':
      if (srcInMyPile) front(s, { t: 'pickTrait', p: actor, mode: 'swapWithSource', srcId, filter: kind });
      return;
    case 'electroreception': {
      const drawn = drawCards(s, actor, 3, 'bottom');
      pushLog(s, actor, `${seatName(s, actor)} drew ${drawn.length} from the bottom of the deck (Electroreception).`, 'normal');
      if (drawn.length) front(s, { t: 'electro', p: actor, drawn: drawn.map((c) => c.id) });
      return;
    }
    case 'eusocial': {
      // Simultaneous: everyone's random card is picked from their hand first, then passed left.
      const all = [actor, ...opps];
      const picks = all.map((q) => {
        const hand = handOf(s, q);
        return hand.length ? hand[rngInt(s.rngState, hand.length)]!.id : null;
      });
      all.forEach((q, i) => {
        const id = picks[i];
        if (id !== null && id !== undefined) giveHandCard(s, q, leftOf(s, q), id);
      });
      pushLog(s, actor, 'Eusocial: everyone passed a random card to the left.', 'normal');
      return;
    }
    case 'eyestalks':
      front(s, { t: 'pickPlayer', p: actor, mode: 'peekHand', srcId }, { t: 'playAnother', p: actor, why: 'Eyestalks: play another trait.', triggerAction: true });
      return;
    case 'fearful-symmetry':
      front(s, { t: 'playAnother', p: actor, why: 'Fearful Symmetry: you may play another trait of face value 2 (its Action happens).', triggerAction: true, optional: true, filter: { face: 2 } });
      return;
    case 'grooming-claws':
      for (const q of [actor, ...opps]) discardRandomFromHand(s, q, 1);
      pushLog(s, actor, 'Grooming Claws: everyone discards a random card.', 'danger');
      return;
    case 'haustorium': {
      s.traitDeck = shuffle(s.rngState, [...s.traitDeck, ...s.traitDiscard]);
      s.traitDiscard = [];
      discardHandCards(s, actor, handOf(s, actor).map((c) => c.id));
      pushLog(s, actor, `${seatName(s, actor)} shuffled the discard pile into the deck, then discarded their hand (Haustorium).`, 'normal');
      return;
    }
    case 'jumpy':
    case 'toe-beans':
      front(s, { t: 'pickTrait', p: actor, mode: 'steal', srcId, filter: kind });
      return;
    case 'nutty':
      front(s, { t: 'pickPlayer', p: actor, mode: 'nutty', srcId });
      return;
    case 'playful':
      for (const o of opps) stealRandomFromHand(s, o, actor, 1);
      pushLog(s, actor, `Playful: everyone gave ${seatName(s, actor)} a random card.`, 'normal');
      front(s, { t: 'gift', p: actor, to: opps, why: 'Playful' });
      return;
    case 'psychedelic':
      // "Restart the age. You are now 1st player. Take your turn. (You may not restart catastrophes.)"
      // UNCONFIRMED: an age is restarted at most once (so it can't loop), and the interrupted turn doesn't stabilize.
      if (s.currentAge.kind === 'catastrophe' || s.ageFx.restarted || s.worldsEnd) {
        pushLog(s, actor, `Psychedelic: ${s.currentAge.name.trim()} can't be restarted.`, 'normal');
        return;
      }
      pushLog(s, actor, `${seatName(s, actor)}'s Psychedelic restarts the age!`, 'danger');
      s.tasks = s.tasks.filter((t) => !FLOW.has(t.t));
      s.turnBans = s.turnBans.filter((b) => b.p !== actor);
      s.firstPlayerIndex = seatIdx(s, actor);
      s.turnStage = 'resolving';
      s.tasks.push({ t: 'restartAge' });
      return;
    case 'rover':
      front(s, { t: 'pickColor', p: actor, mode: 'rover', srcId });
      return;
    case 'sapient':
      front(s, { t: 'sapient', p: actor });
      return;
    case 'seeker':
      front(s, { t: 'seeker', p: actor });
      return;
    case 'self-pruning':
      front(s, { t: 'selfPruning', p: actor });
      return;
    case 'shady': {
      const n = drawCards(s, actor, 3).length;
      pushLog(s, actor, `${seatName(s, actor)} drew ${n} (Shady).`, 'normal');
      front(s, { t: 'shady', p: actor });
      return;
    }
    case 'sleek':
      front(s, { t: 'pickTrait', p: actor, mode: 'returnOwn', srcId, filter: kind });
      return;
    case 'snuffler': {
      const ids = handOf(s, actor).filter((c) => !c.effectless).map((c) => c.id);
      discardHandCards(s, actor, ids);
      pushLog(s, actor, `${seatName(s, actor)} discarded ${ids.length} card${ids.length === 1 ? '' : 's'} with effects (Snuffler).`, 'normal');
      return;
    }
    case 'stasher':
      front(s, { t: 'toDeck', p: actor, where: 'bottom', min: 0, max: 3, why: 'Stasher' });
      return;
    case 'stinging-tendrils':
      front(s, { t: 'pickTrait', p: actor, mode: 'swapOwn', srcId, filter: kind });
      return;
    case 'torpor':
      front(s, { t: 'torpor', p: actor });
      return;
    case 'trapper':
      front(s, { t: 'trapper', p: actor, done: 0 });
      return;
    case 'tricky-vines': {
      const all = s.seats.map((x) => x.id);
      const before = Object.fromEntries(all.map((q) => [q, handOf(s, q)]));
      all.forEach((q, i) => {
        const to = all[(i - 1 + all.length) % all.length]!;
        s.hands[to] = before[q]!;
      });
      for (const q of all) gainedHand(s, q, handOf(s, q));
      pushLog(s, actor, 'Tricky Vines: everyone passed their hand to the right.', 'normal');
      front(s, { t: 'playAnother', p: actor, why: 'Tricky Vines: you may play another trait.', triggerAction: true, optional: true });
      return;
    }
    case 'vagabond':
      front(s, ...opps.map((o): DmTask => ({ t: 'vagabondPlay', p: o, actor })), { t: 'vagabondChoice', actor, ids: [] });
      return;
    case 'wanderlust': {
      const [first] = drawCards(s, actor, 1);
      if (first) front(s, { t: 'wanderlust', p: actor, first: first.id });
      return;
    }
    case 'willow': {
      const n = drawCards(s, actor, 3).length;
      pushLog(s, actor, `${seatName(s, actor)} drew ${n} (Willow).`, 'normal');
      front(s, { t: 'toDeck', p: actor, where: 'bottom', min: 3, max: 3, why: 'Willow' });
      return;
    }
    case 'woolly': {
      const top = takeFromDeck(s, 'top');
      if (!top) return;
      s.traitDiscard.push(top);
      const cols = printedColors(top);
      // UNCONFIRMED: a colorless top card makes everyone discard their colorless cards.
      const match = (c: DmTraitCard) => (cols.length ? printedColors(c).some((col) => cols.includes(col)) : printedColors(c).length === 0);
      const all = [actor, ...opps];
      for (const q of all) discardHandCards(s, q, handOf(s, q).filter(match).map((c) => c.id));
      pushLog(s, actor, `Woolly turned up ${top.name}: everyone discards their ${cols.length ? cols.join(' / ') : 'colorless'} cards and stabilizes.`, 'danger');
      front(s, ...all.map((q): DmTask => ({ t: 'stabilize', p: q })));
      return;
    }
    // ---- Imaginary Ends -----------------------------------------------------------
    case 'bedazzled':
      front(s, { t: 'bedazzled', p: actor });
      return;
    case 'eccentric':
      front(s, ...opps.map((o): DmTask => ({ t: 'stabilize', p: o, to: genePoolOf(s, actor) })));
      pushLog(s, actor, `Eccentric: every opponent stabilizes to ${genePoolOf(s, actor)}.`, 'normal');
      return;
    case 'elegance':
      front(s, ...[actor, ...opps].map((q): DmTask => ({ t: 'optDiscard', p: q, why: 'Elegance', max: 99, negativeOnly: true })));
      return;
    case 'extravagant':
      if (handOf(s, actor).some((c) => c.sub?.includes('moonling') || c.sub?.includes('glitterling'))) front(s, { t: 'pickPlayer', p: actor, mode: 'extravagant', srcId });
      return;
    case 'fuffle-nuffs':
      front(s, { t: 'pickTrait', p: actor, mode: 'returnOwn', srcId }, { t: 'dotingPick', p: actor, why: 'Fuffle Nuffs' });
      return;
    case 'gurvendirs':
      front(s, { t: 'giveCards', p: actor, n: 2, why: 'Gurvendirs' });
      return;
    case 'humdumpling':
      front(s, { t: 'dotingPick', p: actor, why: 'Humdumpling' }, { t: 'playAnother', p: actor, why: 'Humdumpling: play another trait.', triggerAction: true });
      return;
    case 'hurmflerm': {
      const n = drawCards(s, actor, 2).length;
      if (s.turnFx.p !== actor) s.turnFx = { p: actor, used: [] };
      s.turnFx.noStabilize = true;
      pushLog(s, actor, `${seatName(s, actor)} drew ${n} and won't stabilize this turn (Hurmflerm).`, 'normal');
      return;
    }
    case 'imaginative':
      front(s, { t: 'imaginative', p: actor });
      return;
    case 'magic-beans':
      front(s, { t: 'magicBeans', p: actor });
      return;
    case 'pink':
      for (const o of opps) drawCards(s, o, 1);
      pushLog(s, actor, 'Pink: every opponent draws 1.', 'normal');
      return;
    case 'polka-dots': {
      const gone: DmTraitCard[] = [];
      for (let i = 0; i < 5; i++) {
        const c = takeFromDeck(s, 'top');
        if (!c) break;
        s.traitDiscard.push(c);
        gone.push(c);
      }
      pushLog(s, actor, `Polka Dots discarded ${gone.map((c) => c.name).join(', ') || 'nothing'} from the top of the deck.`, 'normal');
      const zeros = gone.filter((c) => faceValue(c) === 0).map((c) => c.id);
      if (zeros.length) front(s, { t: 'polkaDots', p: actor, ids: zeros });
      return;
    }
    case 'scrappy': {
      const drawn = drawCards(s, actor, 2);
      pushLog(s, actor, `${seatName(s, actor)} drew ${drawn.length} (Scrappy).`, 'normal');
      if (drawn.length === 2) front(s, { t: 'scrappy', p: actor, srcId, drawn: drawn.map((c) => c.id) });
      return;
    }
    case 'sprinkles': {
      const [c] = drawCards(s, actor, 1);
      if (!c) return;
      pushLog(s, actor, `Sprinkles: ${seatName(s, actor)} reveals ${c.name}.`, 'normal');
      if (printedColors(c).includes('red') || printedColors(c).length === 0) front(s, { t: 'gift', p: actor, to: opps, why: 'Sprinkles' });
      return;
    }
    case 'turkendurt':
      if (genePoolOf(s, actor) <= 3) front(s, { t: 'pickTrait', p: actor, mode: 'steal', srcId });
      return;
    case 'whopple':
      if (handOf(s, actor).length <= 3) drawCards(s, actor, 1);
      front(s, { t: 'playAnother', p: actor, why: 'Whopple: play another trait.', triggerAction: true });
      return;
    case 'spiral-motion':
      if (s.turnFx.p === actor && s.turnFx.used.includes(kind)) {
        pushLog(s, actor, 'Spiral Motion’s effect can’t be used twice in one turn.', 'normal');
        return;
      }
      if (s.turnFx.p !== actor) s.turnFx = { p: actor, used: [] };
      s.turnFx.used.push(kind);
      front(s, { t: 'playAnother', p: actor, why: 'Spiral Motion: play another trait (then it returns to your hand).', triggerAction: true, then: 'return' });
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

/**
 * Telekinetic / Stinging Tendrils: a different colour (no shared colour; both
 * coloured). Tentacles: a shared colour. Hive Mind: any trait at all.
 */
function swapMatches(rule: DmTraitKind | undefined, mine: DmTraitColor[], theirs: DmTraitColor[]): boolean {
  if (rule === 'hive-mind') return true;
  if (!isColoured(mine) || !isColoured(theirs)) return false;
  const shared = mine.some((c) => theirs.includes(c));
  return rule === 'tentacles' ? shared : !shared;
}

const BORROWABLE_EXCLUDED: readonly DmTraitKind[] = ['inventive', 'painted-shell'];

/** Swap-with-this traits and the colour they swap for (Poisonous / Booming Call: any). */
const SWAP_SOURCE_COLOR: Partial<Record<DmTraitKind, DmTraitColor>> = { contagious: 'red', infectious: 'blue', noxious: 'purple', toxic: 'green' };

/** Borrowed Actions: whose piles they come from, and a colour they must have. */
const BORROW_FROM: Partial<Record<DmTraitKind, { side: 'own' | 'opps'; color?: DmTraitColor }>> = {
  inventive: { side: 'opps' },
  'painted-shell': { side: 'own' },
  antennae: { side: 'own', color: 'red' },
  'compound-eyes': { side: 'own', color: 'purple' },
  hydrofuge: { side: 'opps', color: 'blue' },
  mandibles: { side: 'opps', color: 'green' },
  sprightly: { side: 'own' },
  skimmer: { side: 'own' },
};

function traitTargets(s: DmState, task: PickTraitTask): { ownerId: PlayerId; cardId: number }[] {
  const p = task.p;
  const out: { ownerId: PlayerId; cardId: number }[] = [];
  const add = (ownerId: PlayerId, pred: (c: DmTraitCard) => boolean) => {
    for (const c of tableauOf(s, ownerId)) if (pred(c)) out.push({ ownerId, cardId: c.id });
  };
  const opps = opponentsOf(s, p);
  const colorsOf = (owner: PlayerId, c: DmTraitCard) => traitColorsFor(s, owner, c);
  const f = task.filter;
  switch (task.mode) {
    case 'steal':
    case 'vampirism':
      for (const o of opps) {
        if (task.skipOwners?.includes(o)) continue;
        if (f === 'jumpy' && genePoolOf(s, o) <= genePoolOf(s, p)) continue;
        add(o, (c) => {
          if (!canTake(s, o, c)) return false;
          if (task.ids && !task.ids.includes(c.id)) return false;
          if (f === 'directly-register' || f === 'fish-collector') return faceValue(c) === 1;
          if (f === 'selfish') return colorsOf(o, c).includes('red');
          if (f === 'tiny-little-melons') return colorsOf(o, c).includes('green');
          if (f === 'toe-beans') return faceValue(c) < 0;
          return true;
        });
      }
      break;
    case 'returnToHand':
      for (const o of opps) add(o, (c) => canMove(s, o, c));
      break;
    case 'swapWithSource': {
      const src = tableauOf(s, p).find((c) => c.id === task.srcId);
      if (!src || !canTake(s, p, src)) break;
      const col = f ? SWAP_SOURCE_COLOR[f] : undefined;
      for (const o of opps) add(o, (c) => canTake(s, o, c) && (!col || colorsOf(o, c).includes(col)));
      break;
    }
    case 'swapOwn': {
      const ok = (mine: DmTraitCard) => {
        if (!canTake(s, p, mine)) return false;
        if (f === 'stinging-tendrils' && mine.id === task.srcId) return false;
        if (f === 'hive-mind' && faceValue(mine) <= 0) return false;
        return opps.some((o) => tableauOf(s, o).some((t) => canTake(s, o, t) && swapMatches(f, colorsOf(p, mine), colorsOf(o, t))));
      };
      add(p, ok);
      break;
    }
    case 'swapTheirs': {
      const mine = tableauOf(s, p).find((c) => c.id === task.ref);
      if (!mine) break;
      for (const o of opps) add(o, (t) => canTake(s, o, t) && swapMatches(f, colorsOf(p, mine), colorsOf(o, t)));
      break;
    }
    case 'giveOwn':
      if (opps.length) add(p, (c) => canMove(s, p, c));
      break;
    case 'discardOwn':
      add(p, (c) => canDiscardFromPile(s, p, c));
      break;
    case 'discardTheirs':
      if (task.owner) add(task.owner, (c) => canDiscardFromPile(s, task.owner!, c) && c.id !== task.srcId);
      break;
    case 'territorial':
      add(p, (c) => canDiscardFromPile(s, p, c) && colorsOf(p, c).includes('red'));
      break;
    case 'borrowAction': {
      const rule = f ? BORROW_FROM[f] : undefined;
      const ok = (owner: PlayerId) => (c: DmTraitCard) =>
        !!c.action && c.id !== task.srcId && !BORROWABLE_EXCLUDED.includes(c.kind) && (!rule?.color || colorsOf(owner, c).includes(rule.color));
      if (rule?.side === 'opps') for (const o of opps) add(o, ok(o));
      else add(p, ok(p));
      break;
    }
    case 'moralityGift':
      add(p, (c) => canMove(s, p, c) && faceValue(c) > 0);
      break;
    case 'clawsCost':
      add(p, (c) => canDiscardFromPile(s, p, c) && colorsOf(p, c).includes('red'));
      break;
    case 'returnOwn':
      add(p, (c) => {
        if (!canMove(s, p, c)) return false;
        if (f === 'sleek') return !!c.action;
        if (s.currentAge.catastrophe === 'sacrifice' && task.srcId === -1) return faceValue(c) > 0;
        return true;
      });
      break;
    case 'discardCost':
      add(p, (c) => canDiscardFromPile(s, p, c) && c.id !== task.srcId && (f === 'xylophage' ? colorsOf(p, c).includes('green') : faceValue(c) >= 1));
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
        : task.filter === 'fish-collector' ? `Fish Collector: steal a face-value-1 trait${task.skipOwners?.length ? ' from a second pile' : ''} (up to two piles).`
        : task.filter === 'jumpy' ? 'Jumpy: steal a trait from an opponent with a bigger Gene Pool.'
        : task.filter === 'snap-trap' ? 'Snap-Trap: steal one of the traits they played this turn.'
        : task.filter === 'vagabond' ? 'Vagabond: steal one of the traits they just played.'
        : task.filter === 'toe-beans' ? 'Toe Beans: steal a negative trait from an opponent’s pile.'
        : `${srcName(s, task.srcId)}: steal a trait from an opponent’s pile.`;
    case 'vampirism': return 'Vampirism: steal a trait from an opponent’s pile (you then play its Action).';
    case 'returnToHand': return 'Costly Signaling: return an opponent’s trait to their hand.';
    case 'swapWithSource': {
      const col = task.filter ? SWAP_SOURCE_COLOR[task.filter] : undefined;
      const name = srcName(s, task.srcId);
      return `${name}: swap ${name} with ${col ? `a ${col}` : 'a'} trait in an opponent’s pile.`;
    }
    case 'swapOwn': return `${srcName(s, task.srcId)}: choose the trait from your pile to swap away${task.filter === 'hive-mind' ? ' (a positive one)' : ''}.`;
    case 'swapTheirs': return `${srcName(s, task.srcId)}: choose the opponent’s trait to take${task.filter === 'hive-mind' ? '' : ` (${task.filter === 'tentacles' ? 'same' : 'a different'} colour)`}.`;
    case 'giveOwn': return 'Scutes: choose a trait from your pile to give away.';
    case 'discardOwn': return `${srcName(s, task.srcId)}: discard a trait from your pile.`;
    case 'discardTheirs': return task.owner === task.p ? 'Discard a trait.' : `Reckless: discard a trait from ${seatName(s, task.owner ?? null)}'s pile.`;
    case 'territorial': return 'Territorial: discard a red trait from your pile.';
    case 'borrowAction': {
      const rule = task.filter ? BORROW_FROM[task.filter] : undefined;
      const whose = rule?.side === 'opps' ? 'an opponent’s' : 'a';
      const col = rule?.color ? ` ${rule.color}` : '';
      const where = rule?.side === 'opps' ? '' : ' in your pile';
      return `${srcName(s, task.srcId)}: choose ${whose}${col} trait${where} whose Action you play.`;
    }
    case 'moralityGift': return 'Morality: to play it, choose a positive-value trait from your pile to give away.';
    case 'clawsCost': return 'Retractable Claws: to play it, discard a red trait from your pile.';
    case 'returnOwn': return `${srcName(s, task.srcId)}: return a trait from your pile to your hand.`;
    case 'discardCost': return task.filter === 'xylophage' ? 'Xylophage: to play it, discard a green trait from your pile.' : 'Metamorphosis: to play it, discard a trait of face value 1 or more from your pile.';
  }
}

/** The name of the card (or age / catastrophe, for srcId −1) whose effect this is. */
function srcName(s: DmState, srcId: number): string {
  return srcId < 0 ? s.currentAge.name.trim() : findCard(s, srcId)?.name ?? 'The trait';
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
    case 'shady':
      return handOf(s, task.p).some((c) => c.id === task.ref) ? opps : [];
    case 'baffling':
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
    case 'tolerance': {
      const col = findCard(s, task.srcId)?.kind === 'thermal-tolerance' ? 'red' : 'blue';
      return `${findCard(s, task.srcId)?.name ?? 'Tolerance'}: choose an opponent — +1 for each ${col} trait in their pile.`;
    }
    case 'peekHand': return 'Eyestalks: look at whose hand?';
    case 'extravagant': return 'Extravagant: give your Moonlings and Glitterlings to which opponent?';
    case 'baffling': return 'Baffling: move Baffling into whose pile?';
    case 'gurvendirs': return 'Give the cards to which opponent?';
    case 'nutty': return 'Nutty: which opponent draws 3 and gives you 1?';
    case 'shady': return `Shady: play ${findCard(s, task.ref ?? -1)?.name ?? 'the card'} into whose pile?`;
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
    case 'rover': return 'Rover: choose a colour, then look at the bottom 5 cards of the deck.';
    case 'nectar': return 'Nectar: choose a colour — each opponent may play a non-Dominant trait of it.';
    case 'spots': return 'Spots: choose a colour — opponents reveal their cards of it and you play one.';
    case 'harlequin': return 'Harlequin Falls: choose a colour, then draw 3 — you keep only that colour.';
    case 'paintedValley': return 'The Painted Valley: choose a colour, then draw 1 — if it matches, every opponent draws 1.';
    case 'ramblin': return 'Ramblin’ River Markets: choose a colour that neither you nor the player on your left can play this round.';
    case 'crackletown': return 'Crackletown: choose a colour — the player on your left passes you a card of it.';
    case 'tragedy': return 'Tragedy of the Commons: choose a colour to keep.';
    case 'stygian': return 'Stygian: choose a colour — every trait of it in your pile is suppressed.';
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
        pushLog(s, task.p, `${seatName(s, task.p)} chose not to stabilize (${hasKind(s, task.p, 'apricity') ? 'Apricity' : 'Prosperity'}).`, 'normal');
      } else if (a.optionId === 'nietzsche') {
        discardHandCards(s, task.p, handOf(s, task.p).map((c) => c.id));
        drawCards(s, task.p, 3);
        pushLog(s, task.p, `${seatName(s, task.p)} discarded their hand and drew 3 (Age of Nietzsche).`, 'normal');
      } else if (a.optionId === 'ethereal') {
        pushLog(s, task.p, `${seatName(s, task.p)} suppresses a card instead of stabilizing (Ethereal).`, 'normal');
        front(s, { t: 'suppressPick', p: task.p, source: 'hand', count: 1, optional: false, why: 'Ethereal', exclude: [] });
      } else if (a.optionId === 'countershading') {
        const cs = handOf(s, task.p).find((c) => c.kind === 'countershading');
        if (cs) {
          pushLog(s, task.p, `${seatName(s, task.p)} plays Countershading instead of stabilizing.`, 'normal');
          front(s, { t: 'play', p: task.p, cardId: cs.id, from: 'hand', triggerAction: false, outOfTurn: true });
        }
      } else {
        front(s, { t: 'stabilize', p: task.p, to: endOfTurnTarget(s, task.p) }, { t: 'afterStabilize', p: task.p });
      }
      return;
    case 'stabilize':
    case 'discardFromHand': {
      // Scavenger's choice of where a stabilize draws from.
      if (task.t === 'stabilize' && a.optionId) {
        front(s, { ...task, source: a.optionId === 'discard' ? 'discard' : 'deck' });
        return;
      }
      const ids = a.cardIds ?? [];
      discardHandCards(s, task.p, ids);
      pushLog(s, task.p, `${seatName(s, task.p)} discarded ${ids.length} card${ids.length === 1 ? '' : 's'}.`, 'normal');
      return;
    }
    case 'late': {
      const used = [...(task.used ?? [])];
      const again = (extra: string): DmTask => ({ ...task, used: [...used, extra] });
      if (a.optionId === 'harrier') return void front(s, { t: 'harrier', p: task.p }, again('harrier'));
      if (a.optionId === 'rainbow') {
        // "You may return Rainbow Magic to your hand (seriously!) after you stabilize. Then play 1 random card
        // from your hand. Ignore restrictions and requirements."
        const rm = tableauOf(s, task.p).find((c) => c.kind === 'rainbow-magic');
        if (rm) {
          const card = removeFromPile(s, task.p, rm.id, true, { p: task.p, srcId: rm.id })!;
          handOf(s, task.p).push(card);
          const hand = handOf(s, task.p);
          const pick = hand[rngInt(s.rngState, hand.length)]!;
          pushLog(s, task.p, `${seatName(s, task.p)} returns Rainbow Magic to their hand and plays ${pick.name} at random.`, 'normal');
          front(s, { t: 'play', p: task.p, cardId: pick.id, from: 'hand', triggerAction: false, unrestricted: true, outOfTurn: true }, again('rainbow'));
        }
        return;
      }
      if (a.optionId === 'illusory') return void front(s, { t: 'illusory', p: task.p }, again('illusory'));
      if (a.optionId === 'mimicry') {
        front(s, { t: 'playAnother', p: task.p, why: 'Mimicry: you may play a face-value-1 trait (its Action is ignored).', triggerAction: false, optional: true, filter: { face: 1 }, }, again('mimicry'));
        return;
      }
      const id = a.optionId?.startsWith('play:') ? Number(a.optionId.slice(5)) : NaN;
      const card = handOf(s, task.p).find((c) => c.id === id);
      // Each play uses up a card (and each other option is once only), so the window always ends.
      if (card) front(s, { t: 'play', p: task.p, cardId: card.id, from: 'hand', triggerAction: false, outOfTurn: true }, { ...task, used });
      return;
    }
    case 'procrastination': {
      const id = a.optionId?.startsWith('play:') ? Number(a.optionId.slice(5)) : NaN;
      const q = s.ageFx.procrastinated[s.ageFx.procrastinated.length - 1]!;
      const card = handOf(s, q).find((c) => c.id === id);
      if (card) {
        pushLog(s, q, `${seatName(s, q)} plays Procrastination and takes another turn!`, 'good');
        front(s, { t: 'play', p: q, cardId: card.id, from: 'hand', triggerAction: false, outOfTurn: true }, { t: 'turnStart', p: q });
      } else {
        front(s, task);
      }
      return;
    }
    // ---- Overlush: ages
    case 'adventure': {
      const ids = a.cardIds ?? [];
      const colors = [...new Set(ids.flatMap((id) => printedColors(findCard(s, id)!)))];
      discardHandCards(s, task.p, ids);
      const [drawn] = drawCards(s, task.p, 1);
      pushLog(s, task.p, `${seatName(s, task.p)} discarded ${ids.length} and drew 1 (Age of Adventure).`, 'normal');
      if (drawn && !drawn.dominant && printedColors(drawn).some((c) => colors.includes(c))) {
        front(s, { t: 'playAnother', p: task.p, why: `Age of Adventure: you drew ${drawn.name}, a colour you discarded — play it now? (Its Action is ignored.)`, triggerAction: false, cardIds: [drawn.id], optional: true });
      }
      return;
    }
    case 'optDiscard': {
      const ids = a.decline ? [] : a.cardIds ?? [];
      if (!ids.length) return;
      discardHandCards(s, task.p, ids);
      pushLog(s, task.p, `${seatName(s, task.p)} discarded ${ids.length} (${task.why}).`, 'normal');
      if (task.then === 'draw1') drawCards(s, task.p, 1);
      return;
    }
    case 'colorDiscard':
      if (a.optionId === 'yes') {
        const ids = handOf(s, task.p).filter((c) => printedColors(c).includes(task.color)).map((c) => c.id);
        discardHandCards(s, task.p, ids);
        pushLog(s, task.p, `${seatName(s, task.p)} discarded ${ids.length} ${task.color} card${ids.length === 1 ? '' : 's'} (${task.why}).`, 'normal');
      }
      return;
    case 'passColor': {
      const id = a.cardIds?.[0];
      if (id !== undefined && giveHandCard(s, task.from, task.to, id)) pushLog(s, task.from, `${seatName(s, task.from)} passed ${seatName(s, task.to)} a ${task.color} card (Crackletown).`, 'normal');
      return;
    }
    case 'duelingMoons':
      if (a.optionId === 'top') {
        front(s, { t: 'toDeck', p: task.p, where: 'top', min: 1, max: 1, why: 'Dueling Moons' });
      } else {
        const n = drawCards(s, task.p, 1, 'bottom').length;
        if (n) pushLog(s, task.p, `${seatName(s, task.p)} drew 1 from the bottom of the deck (Dueling Moons).`, 'normal');
      }
      return;
    case 'toDeck': {
      const ids = a.cardIds ?? [];
      for (const id of ids) {
        const c = takeFromHand(s, task.p, id);
        if (c) putOnDeck(s, c, task.where);
      }
      if (ids.length) pushLog(s, task.p, `${seatName(s, task.p)} put ${ids.length} card${ids.length === 1 ? '' : 's'} on the ${task.where} of the deck (${task.why}).`, 'normal');
      return;
    }
    case 'kingReveal': {
      const id = a.cardIds?.[0];
      if (id !== undefined) s.pendingReveal.push({ p: task.p, cardId: id });
      return;
    }
    // ---- Overlush: catastrophes
    case 'sleepyWindow': {
      const q = task.asked[task.asked.length - 1]!;
      const id = a.optionId?.startsWith('play:') ? Number(a.optionId.slice(5)) : NaN;
      if (handOf(s, q).some((c) => c.id === id)) {
        s.ageFx.sleepy = [...(s.ageFx.sleepy ?? []), q];
        pushLog(s, q, `${seatName(s, q)} plays Sleepy and ignores the Gene Pool effect.`, 'good');
        front(s, { t: 'play', p: q, cardId: id, from: 'hand', triggerAction: false, outOfTurn: true }, task);
      } else {
        front(s, task);
      }
      return;
    }
    case 'weInvasive': {
      const id = a.cardIds?.[0];
      const card = id === undefined ? undefined : handOf(s, task.p).find((c) => c.id === id);
      if (!card || !s.worldsEnd) return;
      const isolation = s.worldsEnd.effect === 'isolation';
      if (!isolation) discardHandCards(s, task.p, [card.id]);
      s.worldsEnd.addFace = { ...(s.worldsEnd.addFace ?? {}), [task.p]: faceValue(card) };
      pushLog(s, task.p, `${seatName(s, task.p)} ${isolation ? 'counts' : 'discards'} ${card.name} and adds ${faceValue(card)} to their score (${isolation ? 'Isolation' : 'Invasive Species'}).`, 'normal');
      return;
    }
    // ---- Imaginary Ends
    case 'suppressPick': {
      const id = a.decline ? undefined : a.target?.cardId ?? a.cardIds?.[0];
      if (id === undefined) return;
      front(s, { t: 'suppressCards', p: task.p, ids: [id], why: task.why }, { ...task, count: task.count - 1, exclude: [...task.exclude, id] });
      return;
    }
    case 'suppressCards': {
      const host = a.target ? tableauOf(s, task.p).find((c) => c.id === a.target!.cardId) : undefined;
      if (!host) return;
      const moved: DmTraitCard[] = [];
      for (const id of task.ids) {
        const c = takeFromHand(s, task.p, id) ?? removeFromPile(s, task.p, id, true, { p: task.p, srcId: -1 });
        if (c) moved.push(c);
      }
      host.under = [...(host.under ?? []), ...moved];
      pushLog(s, task.p, `${seatName(s, task.p)} suppressed ${moved.length} card${moved.length === 1 ? '' : 's'} under ${host.name} (${task.why}).`, 'normal');
      // Ethereal: "If this effect empties your hand, draw 2."
      if (task.why === 'Ethereal' && !handOf(s, task.p).length) front(s, { t: 'draw', p: task.p, n: 2, why: 'Ethereal' });
      return;
    }
    case 'glitterstorm': {
      const n = discardRandomFromHand(s, task.p, Number(a.optionId)).length;
      pushLog(s, task.p, `${seatName(s, task.p)} discarded ${n} random card${n === 1 ? '' : 's'} (Glitterstorm).`, 'danger');
      return;
    }
    case 'lureColor': {
      const col = a.color;
      if (!col) return;
      const ids = handOf(s, task.victim).filter((c) => printedColors(c).includes(col)).map((c) => c.id);
      pushLog(s, task.p, `${seatName(s, task.p)} names ${col} for Lure.`, 'normal');
      if (ids.length) front(s, { t: 'suppressCards', p: task.victim, ids, why: 'Lure' });
      return;
    }
    case 'scrappy':
      if (a.optionId === 'both') {
        const src = tableauOf(s, task.p).find((c) => c.id === task.srcId);
        front(
          s,
          ...task.drawn.map((id): DmTask => ({ t: 'play', p: task.p, cardId: id, from: 'hand', triggerAction: false })),
          ...(src ? [{ t: 'afterPlayed', p: task.p, cardId: src.id, mode: 'discard', why: 'Scrappy' } as DmTask] : []),
        );
      }
      return;
    case 'giveCards': {
      if (a.playerId) return void front(s, { ...task, to: a.playerId });
      const ids = a.cardIds ?? [];
      if (!task.to) return;
      for (const id of ids) giveHandCard(s, task.p, task.to, id);
      pushLog(s, task.p, `${seatName(s, task.p)} gave ${ids.length} card${ids.length === 1 ? '' : 's'} to ${seatName(s, task.to)} (${task.why}).`, 'normal');
      return;
    }
    case 'mimsy': {
      const id = a.cardIds?.[0];
      const card = id === undefined ? undefined : handOf(s, task.p).find((c) => c.id === id);
      if (!card) return;
      // UNCONFIRMED: giving a colorless card suppresses your colorless cards.
      const cols = printedColors(card);
      const same = handOf(s, task.p).filter((c) => c.id !== card.id && (cols.length ? printedColors(c).some((x) => cols.includes(x)) : printedColors(c).length === 0)).map((c) => c.id);
      front(s, { t: 'dotingTo', p: task.p, cardId: card.id, why: 'Mimsy' }, ...(same.length ? [{ t: 'suppressCards', p: task.p, ids: same, why: 'Mimsy' } as DmTask] : []));
      return;
    }
    case 'imaginative': {
      const col = a.color;
      const top = takeFromDeck(s, 'top');
      if (!col || !top) return;
      s.traitDiscard.push(top);
      const hit = printedColors(top).includes(col);
      pushLog(s, task.p, `Imaginative: ${seatName(s, task.p)} names ${col}; the top card was ${top.name}${hit ? ' — everyone draws 2. Yay!' : '.'}`, 'normal');
      if (hit) for (const q of orderFrom(s, seatIdx(s, task.p))) drawCards(s, q, 2);
      return;
    }
    case 'urf':
      if (a.optionId === 'yes') {
        const urf = tableauOf(s, task.p).find((c) => c.kind === 'urf');
        if (urf) {
          discardFromPile(s, task.p, urf.id, { p: task.p, srcId: urf.id });
          drawCards(s, task.p, 3);
        }
      }
      return;
    case 'gobLopters': {
      const to = a.playerId;
      if (!to) return;
      const pool = handOf(s, task.p).filter((c) => c.id !== task.cardId);
      for (let i = 0; i < 2 && pool.length; i++) giveHandCard(s, task.p, to, pool.splice(rngInt(s.rngState, pool.length), 1)[0]!.id);
      pushLog(s, task.p, `${seatName(s, task.p)} gave 2 random cards to ${seatName(s, to)} (Gob Lopters).`, 'normal');
      front(s, { t: 'play', p: task.p, cardId: task.cardId, from: task.from, triggerAction: task.triggerAction, costPaid: true });
      return;
    }
    // ---- Overlush: traits
    case 'removalWindow': {
      const owner = task.owner;
      const [how, raw] = (a.optionId ?? 'pass').split(':');
      const card = handOf(s, owner).find((c) => c.id === Number(raw));
      if (!card || how === 'pass') return;
      const again: DmTask = { ...task, asked: [] };
      if (how === 'quills' && task.by) {
        front(s, { t: 'play', p: owner, cardId: card.id, from: 'hand', triggerAction: false, outOfTurn: true, into: task.by }, again);
      } else if (how === 'patches') {
        front(s, { t: 'play', p: owner, cardId: card.id, from: 'hand', triggerAction: false, outOfTurn: true }, again);
        patchesReturn(s, owner, task.cardId);
      } else {
        front(s, { t: 'play', p: owner, cardId: card.id, from: 'hand', triggerAction: false, outOfTurn: true }, again);
      }
      return;
    }
    case 'elusive':
      if (a.optionId === 'play') front(s, { t: 'play', p: task.p, cardId: task.cardId, from: 'hand', triggerAction: false, outOfTurn: true });
      return;
    case 'muse':
      if (a.optionId === 'play') front(s, { t: 'play', p: task.p, cardId: task.cardId, from: 'discard', triggerAction: false, outOfTurn: true });
      return;
    case 'mycelium': {
      const top = s.traitDiscard[s.traitDiscard.length - 1];
      if (a.optionId === 'play' && top) front(s, { t: 'play', p: task.p, cardId: top.id, from: 'discard', triggerAction: true });
      return;
    }
    case 'snapTrap': {
      const q = task.asked[task.asked.length - 1]!;
      const id = a.optionId?.startsWith('play:') ? Number(a.optionId.slice(5)) : NaN;
      if (!handOf(s, q).some((c) => c.id === id)) {
        front(s, task);
        return;
      }
      front(s, { t: 'play', p: q, cardId: id, from: 'hand', triggerAction: false, outOfTurn: true }, { t: 'pickTrait', p: q, mode: 'steal', srcId: id, filter: 'snap-trap', ids: task.ids });
      return;
    }
    case 'strange': {
      const cat = s.agesPlayed.find((x) => String(x.id) === a.optionId);
      if (!cat?.catastrophe) return;
      pushLog(s, task.p, `${seatName(s, task.p)}'s Strange sets off ${cat.name}: ${cat.text}`, 'danger');
      front(s, ...catastropheEffects(s, cat.catastrophe, orderFrom(s, seatIdx(s, task.p))));
      return;
    }
    case 'agile': {
      if (a.decline || !a.target) {
        if (task.done) front(s, { t: 'discardFromHand', p: task.p, count: task.done, why: 'Agile' });
        return;
      }
      const before = s.tasks.length;
      discardFromPile(s, task.p, a.target.cardId, { p: task.p, srcId: -1 });
      frontAfterNew(s, before, { ...task, done: task.done + 1 });
      return;
    }
    case 'fierce': {
      if (a.decline || !a.target) return;
      const before = s.tasks.length;
      discardFromPile(s, task.p, a.target.cardId, { p: task.p, srcId: tableauOf(s, task.p).find((c) => c.kind === 'fierce')?.id ?? -1 });
      drawCards(s, task.p, 2);
      frontAfterNew(s, before, { ...task, done: task.done + 1 });
      return;
    }
    case 'hiveMind': {
      if (a.decline || !a.target) return;
      // The Dominant's own id, so Patches can tell a Dominant did the removing.
      const src = tableauOf(s, task.p).find((c) => c.kind === 'hive-mind');
      front(s, { t: 'pickTrait', p: task.p, mode: 'swapTheirs', srcId: src?.id ?? -1, ref: a.target.cardId, filter: 'hive-mind' }, { ...task, done: task.done + 1 });
      return;
    }
    case 'selfPruning':
      if (a.optionId === 'pile') {
        const src = tableauOf(s, task.p).find((c) => c.kind === 'self-pruning');
        front(s, { t: 'pickTrait', p: task.p, mode: 'discardOwn', srcId: src?.id ?? -1 });
      } else {
        front(s, { t: 'discardFromHand', p: task.p, count: 1, why: 'Self-Pruning' });
      }
      return;
    case 'fromDiscard': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      const i = id === undefined ? -1 : s.traitDiscard.findIndex((c) => c.id === id);
      if (i < 0) return;
      const card = s.traitDiscard.splice(i, 1)[0]!;
      handOf(s, task.p).push(card);
      gainedHand(s, task.p, [card]);
      pushLog(s, task.p, `${seatName(s, task.p)} took ${card.name} from the discard pile.`, 'normal');
      return;
    }
    case 'gift': {
      const id = a.cardIds?.[0];
      const to = task.to[0];
      if (id === undefined || !to) return;
      if (task.pending) s.pendingGifts.push({ from: task.p, to, cardId: id });
      else if (giveHandCard(s, task.p, to, id)) pushLog(s, task.p, `${seatName(s, task.p)} gave a card to ${seatName(s, to)} (${task.why}).`, 'normal');
      return;
    }
    case 'rover': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      const i = id === undefined ? -1 : s.traitDeck.findIndex((c) => c.id === id);
      if (i < 0) return;
      const card = s.traitDeck.splice(i, 1)[0]!;
      handOf(s, task.p).push(card);
      front(s, { t: 'play', p: task.p, cardId: card.id, from: 'deck', triggerAction: false });
      return;
    }
    case 'sapient':
      if (a.optionId === 'last') {
        s.peekedLast[task.p] = s.ageDeck.slice(-2).map((x) => x.id);
        pushLog(s, task.p, `${seatName(s, task.p)} peeked at the last ages in the age deck (Sapient).`, 'normal');
      } else {
        peekNextAge(s, task.p, 'Sapient');
      }
      return;
    case 'seeker': {
      const value = Number(a.optionId);
      const drawn = drawCards(s, task.p, 5);
      pushLog(s, task.p, `${seatName(s, task.p)} names ${value} and draws ${drawn.length} (Seeker).`, 'normal');
      front(s, { t: 'seekerPlay', p: task.p, value, drawn: drawn.map((c) => c.id) });
      return;
    }
    case 'seekerPlay': {
      const id = a.cardIds?.[0];
      const rest: DmTask = { t: 'discardIds', p: task.p, ids: task.drawn.filter((x) => x !== id), why: 'Seeker' };
      if (id === undefined) return void front(s, rest);
      front(s, { t: 'play', p: task.p, cardId: id, from: 'hand', triggerAction: true }, rest);
      return;
    }
    case 'shady': {
      const id = a.cardIds?.[0];
      if (id !== undefined) front(s, { t: 'pickPlayer', p: task.p, mode: 'shady', srcId: -1, ref: id });
      return;
    }
    case 'torpor':
      if (a.optionId === 'place') front(s, { t: 'toDeck', p: task.p, where: 'bottom', min: 1, max: 1, why: 'Torpor' });
      else {
        const n = drawCards(s, task.p, 2, 'bottom').length;
        pushLog(s, task.p, `${seatName(s, task.p)} drew ${n} from the bottom of the deck (Torpor).`, 'normal');
      }
      return;
    case 'trapper': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      const i = id === undefined ? -1 : s.traitDiscard.findIndex((c) => c.id === id);
      if (i < 0) return;
      const card = s.traitDiscard.splice(i, 1)[0]!;
      putOnDeck(s, card, 'top');
      pushLog(s, task.p, `${seatName(s, task.p)} put ${card.name} on top of the deck (Trapper).`, 'normal');
      front(s, { ...task, done: task.done + 1 });
      return;
    }
    case 'vagabondPlay': {
      const id = a.cardIds?.[0];
      if (id === undefined) return;
      const choice = s.tasks.find((x): x is Extract<DmTask, { t: 'vagabondChoice' }> => x.t === 'vagabondChoice' && x.actor === task.actor);
      if (choice) choice.ids.push(id);
      front(s, { t: 'play', p: task.p, cardId: id, from: 'hand', triggerAction: false, outOfTurn: true });
      return;
    }
    case 'vagabondChoice':
      if (a.optionId === 'steal') front(s, { t: 'pickTrait', p: task.actor, mode: 'steal', srcId: -1, filter: 'vagabond', ids: task.ids });
      else front(s, { t: 'playAnother', p: task.actor, why: 'Vagabond: play another trait.', triggerAction: true });
      return;
    case 'wanderlust':
      if (a.optionId === 'play') front(s, { t: 'play', p: task.p, cardId: task.first, from: 'hand', triggerAction: true });
      else if (a.optionId === 'bottom') {
        const [b] = drawCards(s, task.p, 1, 'bottom');
        if (b) front(s, { t: 'playAnother', p: task.p, why: `Wanderlust: you drew ${b.name} from the bottom — play it now?`, triggerAction: true, cardIds: [b.id], optional: true });
      }
      return;
    case 'electro': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      const card = id === undefined ? undefined : handOf(s, task.p).find((c) => c.id === id);
      if (!card) return;
      pushLog(s, task.p, `${seatName(s, task.p)} plays the Action of ${card.name} (Electroreception).`, 'normal');
      front(s, { t: 'preventWindow', actor: task.p, srcId: card.id, kind: card.kind, asked: [] });
      return;
    }
    case 'collector': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      const card = id === undefined ? undefined : handOf(s, task.p).find((c) => c.id === id);
      if (!card) return;
      front(s, { t: 'play', p: task.p, cardId: card.id, from: 'hand', triggerAction: false }, { ...task, used: [...task.used, ...printedColors(card)] });
      return;
    }
    case 'fabledCost': {
      const ids = a.cardIds ?? [];
      const cards = ids.map((id) => handOf(s, task.p).find((c) => c.id === id)).filter((c): c is DmTraitCard => !!c);
      if (cards.length !== 4 || !fabledSet(cards)) throw new Error('choose one card of each colour: red, blue, green and purple');
      discardHandCards(s, task.p, ids);
      pushLog(s, task.p, `${seatName(s, task.p)} discarded one card of each colour (Fabled).`, 'normal');
      front(s, { t: 'play', p: task.p, cardId: task.cardId, from: task.from, triggerAction: task.triggerAction, costPaid: true });
      return;
    }
    case 'harrier': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      if (id === undefined) return;
      discardHandCards(s, task.p, [id]);
      const n = drawCards(s, task.p, 3).length;
      pushLog(s, task.p, `${seatName(s, task.p)} discarded an effectless trait and drew ${n} (Harrier).`, 'normal');
      return;
    }
    case 'illusory': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      const card = id === undefined ? undefined : handOf(s, task.p).find((c) => c.id === id);
      if (!card) return;
      if (s.turnFx.p !== task.p) s.turnFx = { p: task.p, used: [] };
      s.turnFx.ignoreActions = true;
      pushLog(s, task.p, `${seatName(s, task.p)} plays the Action of ${card.name} from their hand (Illusory).`, 'normal');
      front(s, { t: 'preventWindow', actor: task.p, srcId: card.id, kind: card.kind, asked: [] }, { t: 'illusoryEnd', p: task.p, cardId: card.id });
      return;
    }
    case 'lilyPad': {
      if (a.decline || !a.target || !s.worldsEnd) return;
      returnToHand(s, task.p, a.target.cardId, { p: task.p, srcId: task.cardId });
      s.worldsEnd.lilyPad = { ...(s.worldsEnd.lilyPad ?? {}), [task.cardId]: task.done + 1 };
      front(s, { ...task, done: task.done + 1 });
      return;
    }
    case 'pyrophyte': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      if (id === undefined) return;
      front(s, { t: 'play', p: task.p, cardId: id, from: 'hand', triggerAction: false, outOfTurn: true }, task);
      return;
    }
    case 'spotsPick': {
      const id = a.cardIds?.[0];
      const owner = id === undefined ? null : ownerOfHandCard(s, id);
      if (id === undefined || !owner) return;
      const card = takeFromHand(s, owner, id)!;
      handOf(s, task.actor).push(card);
      pushLog(s, task.actor, `${seatName(s, task.actor)} plays ${card.name} from ${seatName(s, owner)}'s hand (Spots).`, 'normal');
      front(s, { t: 'play', p: task.actor, cardId: id, from: 'hand', triggerAction: false, outOfTurn: true });
      return;
    }
    case 'magicHour':
      if (a.optionId === 'gp5') {
        setGenePool(s, task.p, 5);
        pushLog(s, task.p, `${seatName(s, task.p)} set their Gene Pool to 5 (Magic Hour).`, 'normal');
      } else {
        const n = drawCards(s, task.p, 2).length;
        pushLog(s, task.p, `${seatName(s, task.p)} drew ${n} (Magic Hour).`, 'normal');
      }
      return;
    case 'radialSymmetry': {
      if (a.decline || !a.color) return;
      const col = a.color;
      const ids = handOf(s, task.p).filter((c) => printedColors(c).includes(col)).map((c) => c.id);
      discardHandCards(s, task.p, ids);
      pushLog(s, task.p, `${seatName(s, task.p)} discarded ${ids.length} ${col} card${ids.length === 1 ? '' : 's'} (Radial Symmetry).`, 'normal');
      return;
    }
    case 'benthic': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      if (id === undefined) return;
      discardHandCards(s, task.p, [id]);
      pushLog(s, task.p, `${seatName(s, task.p)} discarded a card to play another trait (Benthic).`, 'normal');
      front(s, { t: 'playAnother', p: task.p, why: 'Benthic: play another trait.', triggerAction: true });
      return;
    }
    case 'pearl': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      const card = id === undefined ? undefined : handOf(s, task.p).find((c) => c.id === id);
      if (!card) return;
      front(s, { t: 'play', p: task.p, cardId: card.id, from: 'hand', triggerAction: false }, { t: 'pearl', p: task.p, used: [...task.used, ...printedColors(card)] });
      return;
    }
    case 'pip': {
      const value = Number(a.optionId);
      pushLog(s, task.p, `Pip: ${seatName(s, task.p)} plays every trait of face value ${value}.`, 'normal');
      front(s, { t: 'pipPlay', p: task.p, value, tried: [] });
      return;
    }
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
      const gift = moveTrait(s, task.p, a.playerId, task.giftId, { p: task.p, srcId: task.cardId });
      if (gift) pushLog(s, task.p, `${seatName(s, task.p)} gave ${gift.name} to ${seatName(s, a.playerId)} (Morality).`, 'normal');
      front(s, { t: 'play', p: task.p, cardId: task.cardId, from: task.from, triggerAction: task.triggerAction, costPaid: true });
      return;
    }
    case 'parasiticWindow': {
      if (a.optionId === 'pinchy') {
        const q = task.asked[task.asked.length - 1]!;
        const pinchy = handOf(s, q).find((c) => c.kind === 'pinchy');
        const taken = tableauOf(s, task.actor).find((c) => c.id === task.cardId);
        if (!pinchy || !taken) return;
        takeFromHand(s, q, pinchy.id);
        addToPile(s, q, pinchy);
        s.lastPlayedColors = printedColors(pinchy);
        const card = removeFromPile(s, task.actor, taken.id, true, { p: q, srcId: pinchy.id })!;
        handOf(s, q).push(card);
        s.tasks = s.tasks.filter((t) => !((t.t === 'preventWindow' || t.t === 'action') && t.srcId === card.id));
        pushLog(s, q, `${seatName(s, q)} played Pinchy: ${card.name} goes to their hand and its Action is stopped.`, 'danger');
        front(s, { t: 'pinchyReplay', p: task.actor });
        return;
      }
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
      moveTrait(s, task.actor, q, stolen.id, { p: q, srcId: para.id });
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
        returnToHand(s, task.p, task.srcId, { p: task.p, srcId: task.srcId });
        pushLog(s, task.p, `${seatName(s, task.p)} returned Self-Replicating to their hand.`, 'normal');
      }
      return;
    case 'extraPlay':
    case 'playAnother': {
      const id = a.decline ? undefined : a.cardIds?.[0];
      if (id === undefined) return;
      const play: DmTask = {
        t: 'play', p: task.p, cardId: id, from: 'hand', triggerAction: task.t === 'extraPlay' ? true : task.triggerAction,
        // Plays during an age effect or World's End don't open reaction windows.
        outOfTurn: s.agePhase || !!s.worldsEnd || undefined,
        into: task.t === 'playAnother' ? task.into : undefined,
      };
      if (task.t === 'playAnother' && task.then) {
        const why = task.then === 'discard' ? 'Spiny Fins' : 'Spiral Motion';
        front(s, play, { t: 'afterPlayed', p: task.p, cardId: id, mode: task.then, why });
      } else {
        front(s, play);
      }
      return;
    }
    case 'pickTrait':
      if (a.decline || !a.target) return;
      answerPickTrait(s, task, a.target);
      return;
    case 'pickPlayer':
      answerPickPlayer(s, task, a.playerId!);
      return;
    case 'pickColor':
      answerPickColor(s, task, a);
      return;
    case 'pipPlay':
    case 'mokokoPlay':
    case 'livingLibrary':
    case 'swampDiscard':
    case 'restartAge':
    case 'catastropheGp':
    case 'passRight':
    case 'pinchyReplay':
    case 'skimmer':
    case 'afterBorrow':
    case 'applyPending':
    case 'discardIds':
    case 'illusoryEnd':
    case 'woolly':
    case 'chompers':
    case 'kingResolve':
    case 'setGenePool':
    case 'bedazzled':
    case 'magicBeans':
    case 'effervescent':
    case 'polkaDots':
    case 'whimsy':
      throw new Error(`task ${task.t} takes no answer`);
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
      if (id !== undefined) front(s, { t: 'dotingTo', p: task.p, cardId: id, why: task.why });
      return;
    }
    case 'dotingTo':
      if (a.playerId && giveHandCard(s, task.p, a.playerId, task.cardId)) {
        pushLog(s, task.p, `${seatName(s, task.p)} gave a card to ${seatName(s, a.playerId)} (${task.why ?? 'Doting'}).`, 'normal');
      }
      return;
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
      moveTrait(s, target.ownerId, p, card.id, { p, srcId: task.srcId });
      pushLog(s, p, `${seatName(s, p)} stole ${card.name} from ${seatName(s, target.ownerId)}.`, 'danger');
      if (task.mode === 'vampirism' && card.action) front(s, { t: 'preventWindow', actor: p, srcId: card.id, kind: card.kind, asked: [] });
      // Fish Collector: "from up to two trait piles" — a second, different pile.
      if (task.filter === 'fish-collector' && !task.skipOwners?.length) front(s, { ...task, skipOwners: [target.ownerId] });
      // Imaginary Ends Hidden: "Steal 1 trait from an opponent's trait pile. Then suppress it."
      if (task.filter === 'hidden') front(s, { t: 'suppressCards', p, ids: [card.id], why: 'Hidden' });
      return;
    }
    case 'returnToHand':
      returnToHand(s, target.ownerId, card.id, { p, srcId: task.srcId });
      pushLog(s, p, `${seatName(s, p)} returned ${card.name} to ${seatName(s, target.ownerId)}'s hand.`, 'danger');
      return;
    case 'swapWithSource': {
      const src = tableauOf(s, p).find((c) => c.id === task.srcId);
      if (!src) return;
      moveTrait(s, target.ownerId, p, card.id, { p, srcId: src.id });
      moveTrait(s, p, target.ownerId, src.id, { p, srcId: src.id });
      pushLog(s, p, `${seatName(s, p)} swapped ${src.name} for ${seatName(s, target.ownerId)}'s ${card.name}.`, 'danger');
      // Overlush Booming Call: "Play its action."
      if (task.filter === 'booming-call' && card.action) front(s, { t: 'preventWindow', actor: p, srcId: card.id, kind: card.kind, asked: [] });
      return;
    }
    case 'swapOwn':
      front(s, { t: 'pickTrait', p, mode: 'swapTheirs', srcId: task.srcId, ref: card.id, filter: task.filter });
      return;
    case 'swapTheirs': {
      const mine = tableauOf(s, p).find((c) => c.id === task.ref);
      if (!mine) return;
      moveTrait(s, target.ownerId, p, card.id, { p, srcId: task.srcId });
      moveTrait(s, p, target.ownerId, mine.id, { p, srcId: task.srcId });
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
      discardFromPile(s, target.ownerId, card.id, { p, srcId: task.srcId });
      if (task.mode === 'clawsCost' && task.cost) {
        // Regenerative Tissue's draw (queued at the front by the discard) is
        // played "immediately", so Retractable Claws enters after it.
        const added = s.tasks.length - before;
        s.tasks.splice(added, 0, { t: 'play', p, cardId: task.srcId, from: task.cost.from, triggerAction: task.cost.triggerAction, costPaid: true });
      }
      return;
    }
    case 'borrowAction': {
      pushLog(s, p, `${seatName(s, p)} plays the Action of ${card.name}.`, 'normal');
      // Overlush: Hydrofuge / Mandibles return it to its owner's hand; Sprightly discards it.
      const follow = task.filter === 'hydrofuge' || task.filter === 'mandibles' ? 'returnToOwner' : task.filter === 'sprightly' ? 'discardIt' : null;
      front(
        s,
        { t: 'preventWindow', actor: p, srcId: card.id, kind: card.kind, asked: [] },
        ...(follow ? [{ t: 'afterBorrow', p, mode: follow, cardId: card.id, owner: target.ownerId } as DmTask] : []),
      );
      return;
    }
    case 'moralityGift':
      front(s, { t: 'moralityTo', p, cardId: task.srcId, giftId: card.id, from: task.cost?.from ?? 'hand', triggerAction: task.cost?.triggerAction ?? true });
      return;
    case 'returnOwn':
      returnToHand(s, p, card.id, { p, srcId: task.srcId });
      pushLog(s, p, `${seatName(s, p)} returned ${card.name} to their hand (${srcName(s, task.srcId)}).`, 'normal');
      return;
    case 'discardCost': {
      // Metamorphosis: 3 traits, one at a time; Xylophage: 1. Then the trait is played.
      const before = s.tasks.length;
      discardFromPile(s, p, card.id, { p, srcId: task.srcId });
      const paid = (task.ref ?? 0) + 1;
      const need = task.filter === 'metamorphosis' ? 3 : 1;
      const next: DmTask = paid < need
        ? { ...task, ref: paid }
        : { t: 'play', p, cardId: task.srcId, from: task.cost?.from ?? 'hand', triggerAction: task.cost?.triggerAction ?? true, costPaid: true };
      frontAfterNew(s, before, next);
      return;
    }
  }
}

/** Overlush Patches: the removed trait comes back to its owner's pile, from wherever it went. */
function patchesReturn(s: DmState, owner: PlayerId, id: number) {
  let card: DmTraitCard | undefined;
  const i = s.traitDiscard.findIndex((c) => c.id === id);
  if (i >= 0) card = s.traitDiscard.splice(i, 1)[0];
  for (const seat of s.seats) {
    if (card) break;
    const pile = tableauOf(s, seat.id);
    const j = pile.findIndex((c) => c.id === id);
    if (j >= 0) {
      card = pile.splice(j, 1)[0]!;
      gpLeave(s, seat.id, card);
    } else if (handOf(s, seat.id).some((c) => c.id === id)) {
      card = takeFromHand(s, seat.id, id) ?? undefined;
    }
  }
  if (!card) return;
  addToPile(s, owner, card);
  pushLog(s, owner, `Patches: ${card.name} comes back to ${seatName(s, owner)}'s pile.`, 'good');
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
      const moved = moveTrait(s, p, target, task.srcId, { p, srcId: task.srcId });
      if (moved) pushLog(s, p, `${seatName(s, p)} moved ${moved.name} into ${seatName(s, target)}'s pile.`, 'danger');
      return;
    }
    case 'giveTrait': {
      const moved = moveTrait(s, p, target, task.ref ?? -1, { p, srcId: task.srcId });
      if (moved) pushLog(s, p, `${seatName(s, p)} gave ${moved.name} to ${seatName(s, target)}.`, 'normal');
      return;
    }
    case 'tolerance':
      if (s.worldsEnd) s.worldsEnd.chosenPlayer[task.srcId] = target;
      pushLog(s, p, `${seatName(s, p)}'s ${findCard(s, task.srcId)?.name ?? 'Tolerance'} counts ${seatName(s, target)}'s pile.`, 'normal');
      return;
    case 'peekHand':
      s.peekHand = { viewer: p, owner: target };
      pushLog(s, p, `${seatName(s, p)} peeks at ${seatName(s, target)}'s hand (Eyestalks).`, 'normal');
      return;
    case 'nutty': {
      const n = drawCards(s, target, 3).length;
      pushLog(s, p, `${seatName(s, target)} draws ${n} and gives ${seatName(s, p)} a card (Nutty).`, 'normal');
      front(s, { t: 'gift', p: target, to: [p], why: 'Nutty' });
      return;
    }
    case 'shady':
      if (task.ref !== undefined) front(s, { t: 'play', p, cardId: task.ref, from: 'hand', triggerAction: false, outOfTurn: true, into: target });
      return;
    case 'extravagant': {
      const ids = handOf(s, p).filter((c) => c.sub?.includes('moonling') || c.sub?.includes('glitterling')).map((c) => c.id);
      for (const id of ids) giveHandCard(s, p, target, id);
      pushLog(s, p, `${seatName(s, p)} gave ${ids.length} Moonlings / Glitterlings to ${seatName(s, target)} (Extravagant).`, 'normal');
      return;
    }
    case 'baffling': {
      const moved = moveTrait(s, p, target, task.srcId, { p, srcId: task.srcId });
      if (moved) pushLog(s, p, `${seatName(s, p)} moved Baffling into ${seatName(s, target)}'s pile.`, 'danger');
      return;
    }
    case 'gurvendirs':
      return;
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
        const pool = tableauOf(s, o).filter((c) => canDiscardFromPile(s, o, c) && traitColorsFor(s, o, c).includes(col));
        if (!pool.length) continue;
        discardFromPile(s, o, pool[rngInt(s.rngState, pool.length)]!.id, { p, srcId: task.srcId });
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
    // ---- Overlush
    case 'rover':
      front(s, { t: 'rover', p, color: col });
      return;
    case 'nectar':
      pushLog(s, p, `${seatName(s, p)}'s Nectar names ${col}.`, 'normal');
      front(s, ...opponentsOf(s, p).map((o): DmTask => ({
        t: 'playAnother', p: o, why: `Nectar: you may play a non-Dominant ${col} trait (its Action is ignored).`, triggerAction: false, optional: true, filter: { color: col, nonDominant: true },
      })));
      return;
    case 'spots':
      front(s, { t: 'spotsPick', actor: p, color: col });
      return;
    case 'harlequin': {
      const drawn = drawCards(s, p, 3);
      const off = drawn.filter((c) => !printedColors(c).includes(col)).map((c) => c.id);
      discardHandCards(s, p, off);
      pushLog(s, p, `${seatName(s, p)} named ${col}, drew ${drawn.length} and kept ${drawn.length - off.length} (Harlequin Falls).`, 'normal');
      return;
    }
    case 'paintedValley': {
      const [c] = drawCards(s, p, 1);
      if (c && printedColors(c).includes(col)) {
        for (const o of opponentsOf(s, p)) drawCards(s, o, 1);
        pushLog(s, p, `${seatName(s, p)} named ${col} and drew it — every opponent draws 1 too (The Painted Valley).`, 'normal');
      }
      return;
    }
    case 'ramblin': {
      const left = leftOf(s, p);
      for (const q of [...new Set([p, left])]) if (!s.ageFx.bans.some((b) => b.p === q && b.color === col)) s.ageFx.bans.push({ p: q, color: col });
      pushLog(s, p, `${seatName(s, p)} names ${col}: neither they nor ${seatName(s, left)} can play it this round.`, 'normal');
      return;
    }
    case 'crackletown':
      front(s, { t: 'passColor', from: leftOf(s, p), to: p, color: col });
      return;
    case 'stygian': {
      const ids = tableauOf(s, p).filter((c) => !unremovable(s, p, c) && traitColorsFor(s, p, c).includes(col)).map((c) => c.id);
      pushLog(s, p, `${seatName(s, p)}'s Stygian names ${col}.`, 'normal');
      if (ids.length) front(s, { t: 'suppressCards', p, ids, why: 'Stygian' });
      return;
    }
    case 'tragedy': {
      const ids = handOf(s, p).filter((c) => !printedColors(c).includes(col)).map((c) => c.id);
      discardHandCards(s, p, ids);
      pushLog(s, p, `${seatName(s, p)} keeps their ${col} cards and discards ${ids.length} (Tragedy of the Commons).`, 'danger');
      return;
    }
  }
}

// ============================================================================
// World's End & scoring
// ============================================================================

function pendingWorldsEnd(s: DmState, p: PlayerId): DmTraitCard[] {
  const done = s.worldsEnd?.resolved ?? [];
  const fromHand = (c: DmTraitCard) => c.kind === 'sneaky' || c.kind === 'super-sneaky';
  const pile = tableauOf(s, p).filter((c) => c.worldsEnd && !fromHand(c) && !done.includes(c.id));
  const sneaky = handOf(s, p).filter((c) => fromHand(c) && !done.includes(c.id) && canPlayTrait(s, p, c));
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
    case 'super-sneaky':
      front(s, { t: 'sneaky', p, cardId });
      return;
    // ---- Overlush
    case 'blossom': {
      const n = drawCards(s, p, 4).length;
      pushLog(s, p, `${seatName(s, p)} drew ${n} (Blossom).`, 'normal');
      front(s, { t: 'playAnother', p, why: 'Blossom: you may play a trait from your hand (its Action happens).', triggerAction: true, optional: true });
      return;
    }
    case 'chompers':
      front(s, { t: 'chompers', p });
      return;
    case 'lily-pad':
      front(s, { t: 'lilyPad', p, cardId, done: 0 });
      return;
    case 'nectar':
      front(s, { t: 'pickColor', p, mode: 'nectar', srcId: cardId });
      return;
    case 'pyrophyte': {
      const drawn = drawCards(s, p, 4);
      pushLog(s, p, `${seatName(s, p)} drew ${drawn.length} (Pyrophyte).`, 'normal');
      front(s, { t: 'pyrophyte', p, drawn: drawn.map((c) => c.id) });
      return;
    }
    case 'spots':
      front(s, { t: 'pickColor', p, mode: 'spots', srcId: cardId });
      return;
    // ---- Imaginary Ends
    case 'awesome':
      front(s, { t: 'stabilize', p, to: 2 });
      return;
    case 'bubbly':
    case 'ephemeral': {
      const [c] = drawCards(s, p, 1);
      if (!c) return;
      const cols = printedColors(c);
      const hit = cols.length === 0 || cols.includes(card.kind === 'bubbly' ? 'blue' : 'purple');
      pushLog(s, p, `${card.name}: ${seatName(s, p)} reveals ${c.name}${hit ? '!' : '.'}`, 'normal');
      if (!hit) return;
      if (card.kind === 'bubbly') front(s, { t: 'pickTrait', p, mode: 'discardOwn', srcId: cardId });
      else if (tableauOf(s, p).some((x) => x.id === cardId)) {
        returnToHand(s, p, cardId, { p, srcId: cardId });
        pushLog(s, p, 'Ephemeral returns to their hand.', 'normal');
      }
      return;
    }
    case 'stygian':
      front(s, { t: 'pickColor', p, mode: 'stygian', srcId: cardId });
      return;
    case 'undulating':
      front(s, { t: 'suppressPick', p, source: 'pile', count: 1, optional: false, why: 'Undulating', exclude: [cardId] });
      return;
    case 'thermal-tolerance':
    case 'tidal-tolerance':
      front(s, { t: 'pickPlayer', p, mode: 'tolerance', srcId: cardId });
      return;
    default:
      return;
  }
}

const WE_DISCARD_WORDS = {
  blue: 'a blue trait', green: 'a green trait', red: 'a red trait', purple: 'a purple trait', colorless: 'a colorless trait',
  face4: 'a trait with face value 4 or more', dropOfLife: 'a Drop of Life trait',
} as const;

function weDiscardMatches(s: DmState, p: PlayerId, c: DmTraitCard, rule: keyof typeof WE_DISCARD_WORDS): boolean {
  if (rule === 'face4') return faceValue(c) >= 4;
  if (rule === 'dropOfLife') return !!c.dropOfLife;
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
    tragedyOfTheCommons: 'dropOfLife',
  };
  const rule = discardRule[we.effect];
  const seq: DmTask[] = [];
  if (rule) for (const p of order) seq.push({ t: 'weDiscardTrait', p, rule });
  if (we.effect === 'invasiveSpecies' || we.effect === 'isolation') for (const p of order) seq.push({ t: 'weInvasive', p });
  if (we.effect === 'tooMuchPink') {
    // "Reveal the top card of the trait deck. +1 for each trait of that color in your trait pile."
    const top = takeFromDeck(s, 'top');
    if (top) {
      s.traitDiscard.push(top);
      we.pinkColors = printedColors(top);
      pushLog(s, null, `Too Much Pink turns up ${top.name}.`, 'normal');
    }
  }
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
  /** Castle Glass class bonuses. */
  classBonus: number;
  /** Imaginary Ends: +1 per suppressed card. */
  suppressed: number;
  worldsEndBonus: number;
  total: number;
  /** Some bonus depends on cards in a hand the viewer can't see (left out of the total). */
  hiddenBonus: boolean;
}

/** Drop of Life bonuses that read the contents (not just the size) of their owner's hand (with Sparkles: all of them). */
const HAND_CONTENT_BONUS: ReadonlySet<DmTraitKind> = new Set(['boredom', 'brave', 'saudade', 'awesome']);

/** Overlush Prowler (a Drop of Life in an opponent's pile): −2 for each colour p has fewer of than its owner. */
function prowlerPenalty(s: DmState, p: PlayerId): number {
  let n = 0;
  for (const o of opponentsOf(s, p)) {
    for (const c of tableauOf(s, o)) {
      if (c.kind !== 'prowler' || aiTakeoverHits(s, c)) continue;
      for (const col of DM_SCORING_COLORS) if (countColor(s, p, col) < countColor(s, o, col)) n -= 2;
    }
  }
  return n;
}

/** Imaginary Ends Jibwib (in any pile): "+5 to all players with a Gene Pool of 2 or lower". */
function jibwibBonus(s: DmState, p: PlayerId): number {
  if (genePoolOf(s, p) > 2) return 0;
  return 5 * s.seats.reduce((n, x) => n + tableauOf(s, x.id).filter((c) => c.kind === 'jibwib' && !aiTakeoverHits(s, c)).length, 0);
}

/** Overlush Sparkles: "Traits in your hand count toward your Drop of Life bonuses in your trait pile." */
function sparkles(s: DmState, p: PlayerId): boolean {
  return tableauOf(s, p).some((c) => c.kind === 'sparkles' && !aiTakeoverHits(s, c));
}

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
  const hand = handOf(s, p);
  // Sparkles: the hand's traits join the pile for these counts (only for a viewer who can see the hand).
  const extra = handVisible && sparkles(s, p) ? hand : [];
  const pile = [...tableauOf(s, p), ...extra];
  const cc = (col: DmTraitColor) => countColor(s, p, col) + extra.filter((c) => (col === 'colorless' ? printedColors(c).length === 0 : printedColors(c).includes(col))).length;
  const colorsHeld = () => DM_SCORING_COLORS.filter((col) => cc(col) > 0);
  const atLeast = (col: DmTraitColor, n: number, bonus: number) => (cc(col) >= n ? bonus : 0);
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
      return cc('blue');
    case 'heat-vision':
      return cc('red');
    case 'overgrowth':
      return cc('green');
    case 'sticky-secretions':
      return cc('purple');
    case 'mindful':
      return cc('colorless');
    case 'gratitude':
      return colorsHeld().length;
    case 'immunity':
      return 2 * pile.filter((c) => effectiveFace(s, c) < 0).length;
    case 'kidney':
      return pile.filter((c) => c.kind === 'kidney').length;
    case 'pack-behavior':
      return DM_SCORING_COLORS.reduce((n, col) => n + Math.floor(cc(col) / 2), 0);
    case 'pollination':
      return pile.filter((c) => effectiveFace(s, c) === 1).length;
    case 'saudade':
      return DM_SCORING_COLORS.filter((col) => hand.some((c) => printedColors(c).includes(col))).length;
    case 'swarm':
      return s.seats.reduce((n, x) => n + tableauOf(s, x.id).filter((c) => c.kind === 'swarm').length, 0) + extra.filter((c) => c.kind === 'swarm').length;
    case 'symbiosis': {
      const counts = DM_SCORING_COLORS.map((col) => cc(col)).filter((n) => n > 0);
      return counts.length >= 2 ? 2 * Math.min(...counts) : 0;
    }
    case 'tiny':
      return -pile.length;
    case 'sentience': {
      const col = s.worldsEnd?.chosenColor[card.id];
      return col ? cc(col) : 0;
    }
    // ---- Castle Glass
    case 'mucous-coating':
      return pile.some((c) => c.cls === 'coral') ? 3 : 0;
    case 'thermal-tolerance':
    case 'tidal-tolerance': {
      const who = s.worldsEnd?.chosenPlayer[card.id];
      return who ? countColor(s, who, card.kind === 'thermal-tolerance' ? 'red' : 'blue') : 0;
    }
    // ---- Overlush
    case 'backbiter':
      return pile.some((c) => effectiveFace(s, c) < 0) ? 3 : 0;
    case 'big-feller':
      return pile.filter((c) => effectiveFace(s, c) <= 1).length <= 4 ? 6 : 0;
    case 'bitter-berries':
      return Math.min(cc('purple'), cc('green'));
    case 'sour-grapes':
      return Math.min(cc('blue'), cc('red'));
    case 'spicy':
      return Math.min(cc('red'), cc('green'));
    case 'sweet':
      return Math.min(cc('green'), cc('blue'));
    case 'contagious':
      return -cc('green');
    case 'noxious':
      return -cc('red');
    case 'euphoric':
      return atLeast('purple', 4, 6);
    case 'prolific':
      return atLeast('green', 4, 6);
    case 'tenacious':
      return atLeast('red', 4, 6);
    case 'vivacious':
      return atLeast('blue', 4, 6);
    case 'harmony':
      return 2 * Math.min(...DM_SCORING_COLORS.map((col) => cc(col)));
    case 'nuptial-plumage':
      return 2 * DM_SCORING_COLORS.filter((col) => cc(col) >= 3).length;
    case 'shy':
      return DM_SCORING_COLORS.every((col) => cc(col) >= 2) ? 5 : 0;
    case 'sycophant':
      return opponentsOf(s, p).some((o) => countColor(s, o, 'red') >= 5) ? 5 : 0;
    case 'mutualism':
      return Math.max(...s.seats.map((x) => genePoolOf(s, x.id)));
    case 'lily-pad':
      return s.worldsEnd?.lilyPad?.[card.id] ?? 0;
    // ---- Imaginary Ends
    case 'cryptic':
      return pile.length >= 12 ? -4 : 0;
    case 'enigma':
      return pile.length <= 10 ? 10 : 0;
    case 'frumple-pumple':
      return hand.length <= 3 ? 5 : 0;
    case 'merry':
      return opponentsOf(s, p).reduce((n, o) => n + tableauOf(s, o).filter((c) => c.dominant).length, 0);
    case 'mufflemops':
      return pile.filter((c) => c.sub?.includes('moonling')).length;
    case 'scintillant':
      return pile.filter((c) => c.sub?.includes('deepling') || c.sub?.includes('glitterling')).length;
    case 'slithy':
      return tableauOf(s, p).some((c) => (c.sub?.includes('moonling') || c.sub?.includes('deepling')) && c.under?.length) ? 5 : 0;
    case 'spineless':
      return -pile.filter((c) => effectiveFace(s, c) === 1).length;
    case 'stygian':
      return -2 * colorsHeld().length;
    case 'telescopic-eyes':
      return 2 * opponentsOf(s, p).filter((o) => tableauOf(s, o).length > pile.length).length;
    case 'thwopplers':
      return -Math.min(...s.seats.map((x) => genePoolOf(s, x.id)));
    case 'untold':
      return card.under?.length ?? 0;
    case 'awesome': {
      // "Add 2 face values in your hand to your score. (Max +17)" — the best two.
      const faces = hand.map(faceValue).sort((a, b) => b - a).slice(0, 2);
      return Math.min(17, faces.reduce((n, v) => n + v, 0));
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
  const drop = pile.reduce((n, c) => n + dropOfLifeOf(s, p, c, handVisible), 0) + prowlerPenalty(s, p) + jibwibBonus(s, p);
  const hiddenBonus = !handVisible && pile.some((c) => (HAND_CONTENT_BONUS.has(c.kind) || (c.dropOfLife && sparkles(s, p))) && !aiTakeoverHits(s, c));
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
      case 'stillWater': if (genePoolOf(s, p) === 1) end += 8; break;
      // ---- Overlush
      case 'algalSuperbloom': end += countColor(s, leftOf(s, p), 'blue'); break;
      case 'chokingVines': end += countColor(s, leftOf(s, p), 'green'); break;
      case 'tropicalSuperstorm': end += countColor(s, leftOf(s, p), 'purple'); break;
      case 'volcanicWinter': end += countColor(s, leftOf(s, p), 'red'); break;
      case 'ancientCorruption': end -= pile.filter((c) => c.action).length; break;
      case 'ashlands': if (countColor(s, p, 'purple') <= 2) end -= 4; break;
      case 'greatDeluge': if (countColor(s, p, 'blue') <= 2) end -= 4; break;
      case 'jungleRot': if (countColor(s, p, 'green') <= 2) end -= 4; break;
      case 'sacrifice': if (countColor(s, p, 'red') <= 2) end -= 4; break;
      case 'ecologicalCollapse': end += 2 * pile.filter((c) => effectiveFace(s, c) < 0).length; break;
      case 'endlessMonsoon': end -= handOf(s, p).length; break;
      case 'planetaryDeforestation': end -= genePoolOf(s, p); break;
      case 'strangeMatter': end -= 2 * pile.filter((c) => c.dropOfLife).length; break;
      case 'invasiveSpecies':
      case 'isolation': end += we.addFace?.[p] ?? 0; break;
      // ---- Imaginary Ends
      case 'abyssStaresBack': if (pile.length >= 12) end -= 5; break;
      case 'moonpocalypse': if (genePoolOf(s, p) >= 4) end -= 5; break;
      case 'tooMuchPink': {
        const cols = we.pinkColors ?? [];
        end += cols.length ? pile.filter((c) => traitColorsFor(s, p, c).some((x) => cols.includes(x))).length : countColor(s, p, 'colorless');
        break;
      }
      default: break;
    }
    end += we.tiebreak[p] ?? 0;
  }
  const cls = classBonusOf(s, p);
  const sup = suppressedCount(s, p);
  return { faceValue: face, dropOfLifeBonus: drop, classBonus: cls, suppressed: sup, worldsEndBonus: end, total: face + drop + cls + sup + end, hiddenBonus };
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
  if (a.twoIgnoringActions && !canPlayTwo(s, a.playerId)) throw new Error('you can’t play 2 traits this turn');
  s.turnStage = 'resolving';
  if (a.twoIgnoringActions) {
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} plays 2 traits this turn, ignoring their Actions (The Legend of Mokoko Village).`, 'normal');
    front(s, { t: 'play', p: a.playerId, cardId: card.id, from: 'hand', triggerAction: false }, { t: 'mokokoPlay', p: a.playerId }, { t: 'endTurn', p: a.playerId });
    return;
  }
  front(s, { t: 'play', p: a.playerId, cardId: card.id, from: 'hand', triggerAction: true }, { t: 'endTurn', p: a.playerId });
}

/** Overlush, The Legend of Mokoko Village: with Heroic in your pile you may play 2 traits, ignoring their Actions. */
export function canPlayTwo(s: DmState, p: PlayerId): boolean {
  return s.currentAge.ruleTag === 'mokokoLegend' && hasKind(s, p, 'heroic');
}

/**
 * Overlush cards you may discard for their effect during your turn: Nimble
 * from your hand (to discard a trait from your pile), Seedwing from your pile
 * (to play another trait, ignoring its Action).
 */
export function usableCards(s: DmState, p: PlayerId): DmTraitCard[] {
  if (s.phase !== 'playing' || s.prompt || s.turnStage !== 'main' || s.turnPlayerId !== p) return [];
  const nimble = tableauOf(s, p).some((c) => canDiscardFromPile(s, p, c)) ? handOf(s, p).filter((c) => c.kind === 'nimble') : [];
  const seedwing = tableauOf(s, p).filter((c) => c.kind === 'seedwing' && canDiscardFromPile(s, p, c));
  return [...nimble.slice(0, 1), ...seedwing];
}

function handleUseCard(s: DmState, a: Extract<DmAction, { type: 'useCard' }>) {
  const card = usableCards(s, a.playerId).find((c) => c.id === a.cardId);
  if (!card) throw new Error('you can’t use that card now');
  const p = a.playerId;
  if (card.kind === 'nimble') {
    discardHandCards(s, p, [card.id]);
    pushLog(s, p, `${seatName(s, p)} discards Nimble to discard a trait from their pile.`, 'normal');
    front(s, { t: 'pickTrait', p, mode: 'discardOwn', srcId: card.id });
  } else {
    pushLog(s, p, `${seatName(s, p)} discards Seedwing to play another trait.`, 'normal');
    const before = s.tasks.length;
    discardFromPile(s, p, card.id, { p, srcId: card.id });
    frontAfterNew(s, before, { t: 'playAnother', p, why: 'Seedwing: play another trait (its Action is ignored).', triggerAction: false });
  }
}

function handlePlayOutOfTurn(s: DmState, a: Extract<DmAction, { type: 'playOutOfTurn' }>) {
  const card = outOfTurnPlays(s, a.playerId).find((c) => c.id === a.cardId);
  if (!card) throw new Error('cannot play that out of turn now');
  if (card.kind === 'self-awareness') {
    if (a.targetPlayerId === a.playerId || !s.seats.some((x) => x.id === a.targetPlayerId)) throw new Error('choose an opponent');
  } else if (card.kind === 'umbleboos') {
    if (!umbleboosTargets(s).includes(a.targetPlayerId)) throw new Error('Umbleboos goes into a pile with a Gene Pool of 6 or more');
  } else if (a.targetPlayerId !== a.playerId) {
    throw new Error(`${card.name} goes into your own pile`);
  }
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
    case 'useCard':
      handleUseCard(s, action);
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
