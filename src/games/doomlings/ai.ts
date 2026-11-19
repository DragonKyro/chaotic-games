// Doomlings — deterministic heuristic AI for the Classic game.
//
// One decision per call; the shell's driver ticks it whenever an AI seat is
// `activePlayerId`. It answers every prompt kind, and reads only what its seat
// may know: its own hand, every trait pile, hand sizes, the discard pile, and
// cards a prompt shows it (Nosy, Clever). It never looks at the trait deck,
// the age deck, or an opponent's hand.

import type { PlayerId } from '@/core/types';
import { printedColors } from './cards';
import {
  computePlayerScore,
  dropOfLifeOf,
  faceValue,
  findCard,
  handOf,
  opponentsOf,
  outOfTurnPlays,
  playableFromHand,
  stabilizeTarget,
  tableauOf,
} from './reducer';
import type { DmAction, DmPrompt, DmState, DmTraitCard, DmTraitColor, DmTraitKind } from './types';
import { DM_SCORING_COLORS } from './types';

// ---- valuations -------------------------------------------------------------------

/** Rough worth of an Action when it resolves for us. */
const ACTION_VALUE: Partial<Record<DmTraitKind, number>> = {
  introspective: 3, 'iridescent-scales': 2.5, 'cold-blood': 3, photosynthesis: 2, propagation: 2.5, 'the-third-eye': 2,
  'costly-signaling': 2, selfish: 2.5, 'tiny-little-melons': 2.5, 'directly-register': 1.5, impatience: 2, nosy: 2.5, clever: 2,
  bad: 2, territorial: 1.5, poisonous: 1.5, telekinetic: 1, tentacles: 1, 'selective-memory': 2, 'self-replicating': 1.5, trunk: 1,
  inventive: 1.5, 'painted-shell': 1, venomous: 3, voracious: 0.5, reckless: 0.5, flight: 0, memory: 0.5, persuasive: 0.5,
  doting: -0.5, sweat: -0.5, 'hot-temper': -1.5, scutes: -2,
};

/** Score change for `p` if `card` were in their pile (and out of their hand). */
function pileGain(s: DmState, p: PlayerId, card: DmTraitCard): number {
  const before = computePlayerScore(s, p).total;
  const sim: DmState = {
    ...s,
    tableaus: { ...s.tableaus, [p]: [...tableauOf(s, p), card] },
    hands: { ...s.hands, [p]: handOf(s, p).filter((c) => c.id !== card.id) },
  };
  return computePlayerScore(sim, p).total - before;
}

/** How much we want to play `card` now. */
function playValue(s: DmState, p: PlayerId, card: DmTraitCard): number {
  let v = pileGain(s, p, card) + card.genePoolDelta * 1.5;
  if (card.action && s.currentAge.ruleTag !== 'ignoreActions') v += ACTION_VALUE[card.kind] ?? 0;
  if (card.kind === 'venomous') v += 2; // it leaves our pile again
  if (card.kind === 'super-spreader') v -= 1;
  if (card.kind === 'morality') {
    const gift = tableauOf(s, p).filter((c) => !c.dominant && faceValue(c) > 0).sort((a, b) => traitWorth(s, p, a) - traitWorth(s, p, b))[0];
    v -= gift ? traitWorth(s, p, gift) : 0;
  }
  if (card.kind === 'retractable-claws') {
    const red = tableauOf(s, p).filter((c) => !c.dominant && printedColors(c).includes('red')).sort((a, b) => traitWorth(s, p, a) - traitWorth(s, p, b))[0];
    v -= red ? traitWorth(s, p, red) : 0;
  }
  if (card.playWhen && card.kind !== 'sneaky') v -= 1.5; // better held for its moment
  return v;
}

/** What a trait in `owner`'s pile is worth to them, as far as `viewer` can tell. */
function traitWorth(s: DmState, owner: PlayerId, card: DmTraitCard, viewer: PlayerId = owner): number {
  return faceValue(card) + dropOfLifeOf(s, owner, card, owner === viewer) + card.genePoolDelta;
}

/** What a card in hand is worth keeping. */
function keepValue(card: DmTraitCard): number {
  return faceValue(card) + (card.dominant ? 3 : 0) + (card.action ? 1 : 0) + card.genePoolDelta + (card.playWhen ? 1.5 : 0) + (card.compassStar ? 2 : 0);
}

/** `who`'s score as `viewer` can see it (opponents' hand-content bonuses stay hidden). */
function score(s: DmState, who: PlayerId, viewer: PlayerId = who): number {
  return computePlayerScore(s, who, viewer).total;
}

/** The opponent doing best (ties: the next one round the table). */
function leader(s: DmState, p: PlayerId, among = opponentsOf(s, p)): PlayerId {
  return [...among].sort((a, b) => score(s, b, p) - score(s, a, p))[0]!;
}

function trailer(s: DmState, p: PlayerId, among = opponentsOf(s, p)): PlayerId {
  return [...among].sort((a, b) => score(s, a, p) - score(s, b, p))[0]!;
}

function mostCards(s: DmState, among: PlayerId[]): PlayerId {
  return [...among].sort((a, b) => handOf(s, b).length - handOf(s, a).length)[0]!;
}

const HOSTILE: ReadonlySet<DmTraitKind> = new Set([
  'bad', 'clever', 'flight', 'impatience', 'nosy', 'persuasive', 'poisonous', 'reckless', 'selfish', 'tiny-little-melons',
  'directly-register', 'territorial', 'costly-signaling', 'telekinetic', 'tentacles', 'venomous',
]);

// ---- prompt answers -----------------------------------------------------------------------

function answerCards(s: DmState, p: PlayerId, prompt: Extract<DmPrompt, { kind: 'cards' }>): DmAction {
  const cards = prompt.cardIds.map((id) => findCard(s, id)).filter((c): c is DmTraitCard => !!c);
  const lowFirst = [...cards].sort((a, b) => keepValue(a) - keepValue(b) || a.id - b.id);
  const pick = (ids: number[]): DmAction => ({ type: 'resolvePrompt', playerId: p, cardIds: ids });
  const decline: DmAction = { type: 'resolvePrompt', playerId: p, decline: true };
  const t = prompt.task.t;
  switch (t) {
    case 'playAnother':
    case 'extraPlay':
    case 'pickDiscard':
    case 'cleverSteal':
    case 'nosySteal': {
      const best = [...cards].sort((a, b) => playValue(s, p, b) - playValue(s, p, a) || a.id - b.id)[0]!;
      if (prompt.optional && playValue(s, p, best) < 0.5) return decline;
      return pick([best.id]);
    }
    case 'reasonKeep':
    case 'keepOne': {
      const best = [...cards].sort((a, b) => keepValue(b) - keepValue(a) || a.id - b.id)[0]!;
      return pick([best.id]);
    }
    case 'enlightenment': {
      const junk = lowFirst.filter((c) => keepValue(c) <= 1).slice(0, prompt.max);
      return junk.length >= prompt.min && junk.length ? pick(junk.map((c) => c.id)) : prompt.min === 0 ? pick([]) : pick(lowFirst.slice(0, prompt.min).map((c) => c.id));
    }
    case 'alienTerraform': {
      // Only throw away Dominants we can no longer play.
      const stuck = tableauOf(s, p).filter((c) => c.dominant).length >= 2 ? cards : [];
      return stuck.length ? pick(stuck.map((c) => c.id)) : decline;
    }
    default:
      // Discards, gifts, reveals: part with the least useful cards.
      return pick(lowFirst.slice(0, prompt.min).map((c) => c.id));
  }
}

function answerTrait(s: DmState, p: PlayerId, prompt: Extract<DmPrompt, { kind: 'trait' }>): DmAction {
  const task = prompt.task;
  const mode = task.t === 'pickTrait' ? task.mode : 'weDiscard';
  const options = prompt.targets.map((t) => ({ ...t, card: findCard(s, t.cardId)! })).filter((t) => t.card);
  const mineFirst = ['discardOwn', 'territorial', 'clawsCost', 'weDiscard', 'moralityGift', 'giveOwn', 'swapOwn'].includes(mode);
  const ranked = [...options].sort((a, b) => {
    if (mineFirst) {
      // Giving a trait away: a negative one is a gift to the leader.
      return traitWorth(s, a.ownerId, a.card, p) - traitWorth(s, b.ownerId, b.card, p) || a.cardId - b.cardId;
    }
    if (mode === 'borrowAction') return (ACTION_VALUE[b.card.kind] ?? 0) - (ACTION_VALUE[a.card.kind] ?? 0) || a.cardId - b.cardId;
    // Taking from / hurting an opponent: the best trait, preferring the leader's pile.
    const lead = leader(s, p);
    const va = traitWorth(s, a.ownerId, a.card, p) + (a.ownerId === lead ? 0.5 : 0);
    const vb = traitWorth(s, b.ownerId, b.card, p) + (b.ownerId === lead ? 0.5 : 0);
    return vb - va || a.cardId - b.cardId;
  });
  return { type: 'resolvePrompt', playerId: p, targetCardId: ranked[0]!.cardId };
}

function answerPlayer(s: DmState, p: PlayerId, prompt: Extract<DmPrompt, { kind: 'player' }>): DmAction {
  const task = prompt.task;
  const ids = prompt.playerIds;
  let target: PlayerId;
  if (task.t === 'pickPlayer') {
    switch (task.mode) {
      case 'swapHands':
      case 'stealRandom2':
      case 'nosy':
        target = mostCards(s, ids);
        break;
      default:
        target = leader(s, p, ids);
    }
  } else if (task.t === 'moralityTo' || task.t === 'dotingTo') {
    target = trailer(s, p, ids);
  } else {
    target = mostCards(s, ids);
  }
  return { type: 'resolvePrompt', playerId: p, targetPlayerId: target };
}

function colorCountSum(s: DmState, players: PlayerId[], col: DmTraitColor): number {
  return players.reduce((n, o) => n + tableauOf(s, o).filter((c) => printedColors(c).includes(col)).length, 0);
}

function answerColor(s: DmState, p: PlayerId, prompt: Extract<DmPrompt, { kind: 'color' }>): DmAction {
  const task = prompt.task;
  const colors = prompt.colors;
  const best = (f: (c: DmTraitColor) => number) => [...colors].sort((a, b) => f(b) - f(a))[0]!;
  const opps = opponentsOf(s, p);
  const choose = (c: DmTraitColor): DmAction => ({ type: 'resolvePrompt', playerId: p, chosenColor: c });
  if (task.t !== 'pickColor') return choose(colors[0]!);
  switch (task.mode) {
    case 'persuasive':
      return choose(best((c) => -handOf(s, p).filter((x) => printedColors(x).includes(c)).length));
    case 'hyperIntelligence':
    case 'viral':
      return choose(best((c) => colorCountSum(s, opps, c)));
    case 'sentience':
      return choose(best((c) => colorCountSum(s, [p], c)));
    case 'faithFrom': {
      const plan = bestFaith(s, p);
      return plan ? choose(plan.from) : { type: 'resolvePrompt', playerId: p, decline: true };
    }
    case 'faithTo': {
      const from = task.from!;
      return choose(best((to) => faithScore(s, p, from, to)));
    }
  }
}

function faithScore(s: DmState, p: PlayerId, from: DmTraitColor, to: DmTraitColor): number {
  if (!s.worldsEnd) return 0;
  const sim: DmState = { ...s, worldsEnd: { ...s.worldsEnd, colorChange: { ...s.worldsEnd.colorChange, [p]: { from, to } } } };
  return score(sim, p);
}

function bestFaith(s: DmState, p: PlayerId): { from: DmTraitColor; to: DmTraitColor } | null {
  const now = score(s, p);
  let bestPlan: { from: DmTraitColor; to: DmTraitColor } | null = null;
  let bestScore = now;
  for (const from of DM_SCORING_COLORS) for (const to of DM_SCORING_COLORS) {
    if (from === to) continue;
    const v = faithScore(s, p, from, to);
    if (v > bestScore) {
      bestScore = v;
      bestPlan = { from, to };
    }
  }
  return bestPlan;
}

function answerOption(s: DmState, p: PlayerId, prompt: Extract<DmPrompt, { kind: 'option' }>): DmAction {
  const task = prompt.task;
  const ids = prompt.options.map((o) => o.id);
  const choose = (id: string): DmAction => ({ type: 'resolvePrompt', playerId: p, optionId: ids.includes(id) ? id : ids[0]! });
  switch (task.t) {
    case 'stabilizeChoice': {
      if (ids.includes('skip')) return choose(handOf(s, p).length > stabilizeTarget(s, p) ? 'skip' : 'stabilize');
      return choose(stabilizeTarget(s, p) < 3 ? 'nietzsche' : 'stabilize');
    }
    case 'late':
    case 'sneaky':
      return choose('play');
    case 'parasiticWindow': {
      const stolen = findCard(s, task.cardId);
      const gain = stolen ? traitWorth(s, task.actor, stolen, p) - 2 : -2;
      return choose(gain >= 1 ? 'play' : 'pass');
    }
    case 'preventWindow': {
      const hostile = task.actor !== p && HOSTILE.has(task.kind) && score(s, p) >= score(s, task.actor, p) - 3;
      return choose(hostile ? ids[0]! : 'pass');
    }
    case 'selfReplicatingReturn':
      return choose('return');
    case 'memory': {
      const hand = handOf(s, p);
      const avg = hand.length ? hand.reduce((n, c) => n + keepValue(c), 0) / hand.length : 0;
      return choose(avg < 1.5 ? 'yes' : 'no');
    }
    case 'prepper': {
      if (!s.worldsEnd) return choose(ids[0]!);
      const margin = (effect: string) => {
        const sim: DmState = { ...s, worldsEnd: { ...s.worldsEnd!, effect: effect as NonNullable<DmState['worldsEnd']>['effect'] } };
        return score(sim, p) - Math.max(...opponentsOf(s, p).map((o) => score(sim, o, p)));
      };
      return choose([...ids].sort((a, b) => margin(b) - margin(a))[0]!);
    }
    default:
      return choose(ids[0]!);
  }
}

// ---- entry point ---------------------------------------------------------------------------

export function chooseAIAction(state: DmState, playerId: PlayerId): DmAction | null {
  const s = state;
  if (s.phase !== 'playing' || s.activePlayerId !== playerId) return null;

  if (s.subPhase === 'awaitingPrompt') {
    const prompt = s.prompt;
    if (!prompt || prompt.playerId !== playerId) return null;
    switch (prompt.kind) {
      case 'cards':
        return answerCards(s, playerId, prompt);
      case 'trait':
        return answerTrait(s, playerId, prompt);
      case 'player':
        return answerPlayer(s, playerId, prompt);
      case 'color':
        return answerColor(s, playerId, prompt);
      case 'option':
        return answerOption(s, playerId, prompt);
    }
  }

  if (s.subPhase !== 'awaitingAction' || s.turnPlayerId !== playerId) return null;

  // Slip Self-Awareness (−1) into the leader's pile first: it doesn't use up the turn.
  const sneak = outOfTurnPlays(s, playerId)[0];
  if (sneak) return { type: 'playOutOfTurn', playerId, cardId: sneak.id, targetPlayerId: leader(s, playerId) };

  const playable = playableFromHand(s, playerId);
  if (!playable.length) {
    const hand = handOf(s, playerId);
    return { type: 'passTurn', playerId, discardHand: hand.length > 0 && hand.length <= 3 };
  }
  const best = [...playable].sort((a, b) => playValue(s, playerId, b) - playValue(s, playerId, a) || a.id - b.id)[0]!;
  return { type: 'playTrait', playerId, cardId: best.id };
}
