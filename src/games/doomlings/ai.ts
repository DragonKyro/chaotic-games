// Doomlings — deterministic heuristic AI for the Classic game and the built expansions.
//
// One decision per call; the shell's driver ticks it whenever an AI seat is
// `activePlayerId`. It answers every prompt kind, and reads only what its seat
// may know: its own hand, every trait pile, hand sizes, the discard pile, and
// cards a prompt shows it (Nosy, Clever). It never looks at the trait deck,
// the age deck, or an opponent's hand.

import type { PlayerId } from '@/core/types';
import { printedColors } from './cards';
import {
  ANY_TIME_OWN,
  canPlayTwo,
  computePlayerScore,
  fabledSet,
  usableCards,
  dropOfLifeOf,
  endOfTurnTarget,
  faceValue,
  findCard,
  genePoolOf,
  handOf,
  opponentsOf,
  outOfTurnPlays,
  playableFromHand,
  tableauOf,
  umbleboosTargets,
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
  // Castle Glass
  aposematic: 2.5, benthic: 1.5, biochromatic: 1, brainy: 1, 'copper-band': 1.5, 'crystal-skeleton': 0.5, 'fish-collector': 2.5,
  fragmentation: 2, 'glass-predator': 3.5, 'guanine-crystals': 1, harboring: 0.5, 'natural-symmetry': 0.5, pteridines: 1.5,
  sandy: 0.3, 'spiny-fins': 0.5, 'spiral-dome': 2, 'spiral-motion': 1.5,
  // Overlush
  agile: 0.3, antennae: -1, 'arrested-muscles': 1, 'booming-call': 2, bottomfeeder: 2, bushwhacker: 1, caffeinated: 1.5,
  'cheek-pouches': 1.5, cocoa: 1, 'compound-eyes': 0.5, contagious: 1.5, electroreception: 2.5, eusocial: 0, eyestalks: 2.5,
  'fearful-symmetry': 1, 'grooming-claws': 0.5, haustorium: -1, hydrofuge: 1.5, infectious: 1.5, jumpy: 2.5, mandibles: 1.5,
  noxious: 1.5, nutty: 0.5, playful: 1, psychedelic: 0.5, rover: 1.5, sapient: 0.5, seeker: 1.5, 'self-pruning': 0, shady: 2,
  sleek: 0.5, snuffler: -1, sprightly: 0.5, stasher: 0.3, 'stinging-tendrils': 1, swampy: 3, 'toe-beans': 1, torpor: 1.5,
  toxic: 1.5, trapper: 0, 'tricky-vines': 0.5, vagabond: 2.5, wanderlust: 1.5, willow: 0.5, woolly: 0,
  // Imaginary Ends
  bedazzled: 1.5, eccentric: 0.5, elegance: 0.5, extravagant: -0.5, 'fuffle-nuffs': 0, gurvendirs: -1.5, humdumpling: 1.5,
  hurmflerm: 1.5, imaginative: 0.5, 'magic-beans': 1, pink: -1, 'polka-dots': 0.5, scrappy: 1, sprinkles: -0.5, turkendurt: 1.5, whopple: 2,
};

/** Rough worth of a "when played" effect that isn't an Action. */
const ENTER_VALUE: Partial<Record<DmTraitKind, number>> = {
  opulent: 3, resplendent: 2.5, pearl: 2, pip: 1, fierce: 1, 'hive-mind': 2, collector: 1.5, trippy: 2, firebite: 2,
  // Imaginary Ends suppress effects (+1 a card) and other "when played" effects
  translucent: 1, 'whip-tail': 0.5, untold: 1.5, chemotroph: 1.5, effervescent: 1.5, hidden: 3, spineless: 0.5, baffling: 2.5,
  lure: 1, mimsy: 0.5, remarkable: 1, feisty: 0.5, atavism: 0,
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
  let v = pileGain(s, p, card) + card.genePoolDelta * 1.5 + (ENTER_VALUE[card.kind] ?? 0);
  if (card.action && s.currentAge.ruleTag !== 'ignoreActions') v += ACTION_VALUE[card.kind] ?? 0;
  if (card.kind === 'venomous') v += 2; // it leaves our pile again
  if (card.kind === 'super-spreader') v -= 1;
  if (card.kind === 'morality') {
    const gift = tableauOf(s, p).filter((c) => !c.dominant && faceValue(c) > 0).sort((a, b) => traitWorth(s, p, a) - traitWorth(s, p, b))[0];
    v -= gift ? traitWorth(s, p, gift) : 0;
  }
  if (card.kind === 'retractable-claws' || card.kind === 'xylophage') {
    const col = card.kind === 'xylophage' ? 'green' : 'red';
    const paid = tableauOf(s, p).filter((c) => !c.dominant && printedColors(c).includes(col)).sort((a, b) => traitWorth(s, p, a) - traitWorth(s, p, b))[0];
    v -= paid ? traitWorth(s, p, paid) : 0;
  }
  if (card.kind === 'metamorphosis') {
    const paid = tableauOf(s, p).filter((c) => !c.dominant && faceValue(c) >= 1).sort((a, b) => traitWorth(s, p, a) - traitWorth(s, p, b)).slice(0, 3);
    v -= paid.reduce((n, c) => n + traitWorth(s, p, c), 0);
  }
  if (card.kind === 'fabled') v -= 4; // four cards from hand
  if (card.playWhen && card.kind !== 'sneaky') v -= 1.5; // better held for its moment
  return v;
}

/** Worth of playing an "at any time" trait for free (it doesn't use up the turn). */
function freePlayValue(s: DmState, p: PlayerId, card: DmTraitCard): number {
  return playValue(s, p, card) + 1.5 + (card.kind === 'sunny' ? 1 : 0);
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
    case 'nosySteal':
    case 'pearl':
    case 'collector':
    case 'pyrophyte':
    case 'rover':
    case 'spotsPick':
    case 'seekerPlay':
    case 'vagabondPlay': {
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
    case 'kingReveal':
    case 'weInvasive': {
      const best = [...cards].sort((a, b) => faceValue(b) - faceValue(a) || a.id - b.id)[0]!;
      return pick([best.id]);
    }
    case 'fromDiscard': {
      const best = [...cards].sort((a, b) => keepValue(b) - keepValue(a) || a.id - b.id)[0]!;
      return prompt.optional && keepValue(best) < 2 ? decline : pick([best.id]);
    }
    case 'electro':
    case 'illusory': {
      const best = [...cards].sort((a, b) => (ACTION_VALUE[b.kind] ?? 0) - (ACTION_VALUE[a.kind] ?? 0) || a.id - b.id)[0]!;
      return (ACTION_VALUE[best.kind] ?? 0) >= 1 ? pick([best.id]) : decline;
    }
    case 'harrier':
    case 'suppressPick':
    case 'giveCards':
    case 'mimsy':
      return pick(lowFirst.slice(0, Math.max(1, prompt.min)).map((c) => c.id));
    case 'trapper':
      return decline;
    case 'shady': {
      // Hand an opponent the worst trait we can.
      const worst = [...cards].sort((a, b) => faceValue(a) - faceValue(b) || a.id - b.id)[0]!;
      return pick([worst.id]);
    }
    case 'fabledCost': {
      const set = fabledSet(cards);
      return pick((set ?? cards.slice(0, 4)).map((c) => c.id));
    }
    case 'adventure':
    case 'optDiscard':
    case 'toDeck': {
      const junk = lowFirst.filter((c) => keepValue(c) <= 1).slice(0, prompt.max);
      const ids = junk.length >= prompt.min ? junk : lowFirst.slice(0, prompt.min);
      if (!ids.length && prompt.optional) return decline;
      return pick(ids.map((c) => c.id));
    }
    case 'benthic': {
      // Trade the least useful card for another play, if something else is playable.
      const junk = lowFirst[0]!;
      const others = playableFromHand(s, p).filter((c) => c.id !== junk.id);
      return others.some((c) => playValue(s, p, c) > 0.5) ? pick([junk.id]) : decline;
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
  const decline: DmAction = { type: 'resolvePrompt', playerId: p, decline: true };
  if (prompt.optional) {
    const mine = options.filter((o) => o.ownerId === p);
    const cheapest = Math.min(...mine.map((o) => traitWorth(s, p, o.card)));
    switch (task.t) {
      case 'agile':
      case 'fierce':
        if (!(cheapest < (task.t === 'fierce' ? 1 : 0))) return decline;
        break;
      case 'lilyPad':
      case 'suppressPick':
        if (!(cheapest < 1)) return decline;
        break;
      case 'hiveMind': {
        const theirs = s.seats.filter((x) => x.id !== p).flatMap((x) => tableauOf(s, x.id).filter((c) => !c.dominant).map((c) => traitWorth(s, x.id, c, p)));
        if (!theirs.length || Math.max(...theirs) <= cheapest) return decline;
        break;
      }
      case 'pickTrait':
        if ((task.mode === 'discardOwn' || task.mode === 'returnOwn') && !(cheapest < 0)) return decline;
        if (task.mode === 'borrowAction' && !options.some((o) => (ACTION_VALUE[o.card.kind] ?? 0) >= 1)) return decline;
        break;
      default:
        break;
    }
  }
  if (task.t === 'suppressCards') {
    // The host: Untold scores them; Slithy wants a Moonling / Deepling host; otherwise a trait unlikely to move.
    const slithy = tableauOf(s, p).some((c) => c.kind === 'slithy');
    const rank = (c: DmTraitCard) => (c.kind === 'untold' ? 100 : 0) + (slithy && (c.sub?.includes('moonling') || c.sub?.includes('deepling')) ? 50 : 0) + traitWorth(s, p, c);
    const host = [...options].sort((a, b) => rank(b.card) - rank(a.card) || a.cardId - b.cardId)[0]!;
    return { type: 'resolvePrompt', playerId: p, targetCardId: host.cardId };
  }
  const mineFirst = ['discardOwn', 'territorial', 'clawsCost', 'weDiscard', 'moralityGift', 'giveOwn', 'swapOwn', 'returnOwn', 'discardCost'].includes(mode);
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
      case 'tolerance': {
        const col: DmTraitColor = findCard(s, task.srcId)?.kind === 'thermal-tolerance' ? 'red' : 'blue';
        target = [...ids].sort((a, b) => colorCountSum(s, [b], col) - colorCountSum(s, [a], col))[0]!;
        break;
      }
      case 'peekHand':
        target = mostCards(s, ids);
        break;
      case 'extravagant':
        target = trailer(s, p, ids);
        break;
      case 'nutty':
        target = trailer(s, p, ids);
        break;
      default:
        target = leader(s, p, ids);
    }
  } else if (task.t === 'moralityTo' || task.t === 'dotingTo' || task.t === 'gobLopters' || task.t === 'giveCards') {
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
  if (task.t === 'radialSymmetry') {
    // Discard a colour only if it holds nothing worth keeping.
    const junk = (c: DmTraitColor) => handOf(s, p).filter((x) => printedColors(x).includes(c)).reduce((n, x) => n + (1.5 - keepValue(x)), 0);
    const c = best(junk);
    return junk(c) > 0 && handOf(s, p).length > 2 ? choose(c) : { type: 'resolvePrompt', playerId: p, decline: true };
  }
  if (task.t === 'lureColor') {
    // Suppressed cards score for them: name the colour their pile has least of.
    return choose([...colors].sort((a, b) => colorCountSum(s, [task.victim], a) - colorCountSum(s, [task.victim], b))[0]!);
  }
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
    case 'rover':
    case 'harlequin':
    case 'paintedValley':
    case 'crackletown':
      // A colour our pile likes.
      return choose(best((c) => colorCountSum(s, [p], c) + handOf(s, p).filter((x) => printedColors(x).includes(c)).length * 0.1));
    case 'nectar':
    case 'ramblin':
      // A colour the opponents lean on (and we hold little of).
      return choose(best((c) => colorCountSum(s, opps, c) - handOf(s, p).filter((x) => printedColors(x).includes(c)).length));
    case 'spots':
      return choose(best((c) => colorCountSum(s, opps, c)));
    case 'tragedy':
      return choose(best((c) => handOf(s, p).filter((x) => printedColors(x).includes(c)).reduce((n, x) => n + keepValue(x), 0)));
    case 'stygian':
      // Each suppressed trait scores +1 instead of its worth.
      return choose(best((c) => tableauOf(s, p).filter((x) => !x.dominant && printedColors(x).includes(c)).reduce((n, x) => n + 1 - traitWorth(s, p, x), 0)));
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
      const hand = handOf(s, p).length;
      const target = endOfTurnTarget(s, p);
      // Countershading instead of stabilizing: a free trait when we'd only be discarding.
      if (ids.includes('countershading') && hand > target) return choose('countershading');
      if (ids.includes('skip')) return choose(hand > target ? 'skip' : 'stabilize');
      if (ids.includes('nietzsche') && target < 3) return choose('nietzsche');
      if (ids.includes('ethereal') && hand >= target) return choose('ethereal');
      if (ids.includes('countershading') && hand >= target) return choose('countershading');
      return choose('stabilize');
    }
    case 'late': {
      // Free plays after stabilizing: take the best one that is worth it.
      const plays = ids.filter((id) => id.startsWith('play:')).map((id) => ({ id, card: findCard(s, Number(id.slice(5))) }));
      const ranked = plays.filter((x) => x.card).sort((a, b) => freePlayValue(s, p, b.card!) - freePlayValue(s, p, a.card!));
      const top = ranked[0];
      if (top && freePlayValue(s, p, top.card!) > 0) return choose(top.id);
      for (const extra of ['mimicry', 'harrier', 'illusory']) if (ids.includes(extra)) return choose(extra);
      return choose('keep');
    }
    case 'procrastination':
    case 'snapTrap':
    case 'sleepyWindow':
    case 'removalWindow':
      return choose(ids.find((id) => id !== 'keep' && id !== 'pass') ?? ids[0]!);
    case 'elusive':
    case 'muse':
      return choose('play');
    case 'mycelium': {
      const top = s.traitDiscard[s.traitDiscard.length - 1];
      return choose(top && playValue(s, p, top) > 0 ? 'play' : 'no');
    }
    case 'strange':
    case 'wanderlust': {
      if (task.t === 'strange') return choose('none');
      const first = findCard(s, task.first);
      return choose(first && ids.includes('play') && playValue(s, p, first) > 0.5 ? 'play' : 'bottom');
    }
    case 'sapient':
      return choose('next');
    case 'glitterstorm':
      return choose('1');
    case 'urf':
      return choose(handOf(s, p).length <= 3 ? 'yes' : 'no');
    case 'scrappy': {
      const both = task.drawn.map((id) => findCard(s, id)).every((c) => c && playValue(s, p, c) > 0);
      return choose(both ? 'both' : 'neither');
    }
    case 'seeker':
      return choose('1');
    case 'selfPruning': {
      const junk = tableauOf(s, p).some((c) => !c.dominant && traitWorth(s, p, c) < 0);
      return choose(junk ? 'pile' : 'hand');
    }
    case 'torpor':
      return choose('draw');
    case 'vagabondChoice':
      return choose('steal');
    case 'duelingMoons':
      return choose('bottom');
    case 'colorDiscard': {
      const cards = handOf(s, p).filter((c) => printedColors(c).includes(task.color));
      return choose(cards.every((c) => keepValue(c) <= 1.5) ? 'yes' : 'no');
    }
    case 'stabilize': {
      const top = s.traitDiscard[s.traitDiscard.length - 1];
      return choose(top && keepValue(top) >= 3 ? 'discard' : 'deck');
    }
    case 'sneaky':
      return choose('play');
    case 'magicHour':
      return choose(genePoolOf(s, p) < 5 ? 'gp5' : 'draw');
    case 'pip': {
      const hand = handOf(s, p);
      const worth = (id: string) => hand.filter((c) => faceValue(c) === Number(id)).reduce((n, c) => n + playValue(s, p, c), 0);
      return choose([...ids].sort((a, b) => worth(b) - worth(a))[0]!);
    }
    case 'parasiticWindow': {
      const stolen = findCard(s, task.cardId);
      const gain = stolen ? traitWorth(s, task.actor, stolen, p) - 2 : -2;
      if (ids.includes('play') && gain >= 1) return choose('play');
      // Pinchy (0): the trait comes to our hand and its Action is stopped.
      if (ids.includes('pinchy') && stolen && (keepValue(stolen) >= 3 || (stolen.action && HOSTILE.has(stolen.kind)))) return choose('pinchy');
      return choose('pass');
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

  // Free plays first — they don't use up the turn: slip Self-Awareness (−1)
  // into the leader's pile; play Sea Glass / Conchomancy / Sunny if worth it.
  for (const card of outOfTurnPlays(s, playerId)) {
    if (card.kind === 'self-awareness') return { type: 'playOutOfTurn', playerId, cardId: card.id, targetPlayerId: leader(s, playerId) };
    if (ANY_TIME_OWN.has(card.kind) && freePlayValue(s, playerId, card) > 0) return { type: 'playOutOfTurn', playerId, cardId: card.id, targetPlayerId: playerId };
    if (card.kind === 'umbleboos') {
      // −2 Gene Pool for whoever gets it: an opponent with a big Gene Pool.
      const opps = umbleboosTargets(s).filter((q) => q !== playerId);
      if (opps.length) return { type: 'playOutOfTurn', playerId, cardId: card.id, targetPlayerId: leader(s, playerId, opps) };
    }
  }

  const playable = playableFromHand(s, playerId);
  // Overlush: Seedwing (−1) leaves our pile for an extra play; Nimble clears a bad trait.
  for (const card of usableCards(s, playerId)) {
    if (card.kind === 'seedwing' && playable.length >= 2) return { type: 'useCard', playerId, cardId: card.id };
    if (card.kind === 'nimble' && tableauOf(s, playerId).some((c) => !c.dominant && traitWorth(s, playerId, c) < 0)) return { type: 'useCard', playerId, cardId: card.id };
  }
  if (!playable.length) {
    const hand = handOf(s, playerId);
    return { type: 'passTurn', playerId, discardHand: hand.length > 0 && hand.length <= 3 };
  }
  const best = [...playable].sort((a, b) => playValue(s, playerId, b) - playValue(s, playerId, a) || a.id - b.id)[0]!;
  // The Legend of Mokoko Village (with Heroic): two traits, Actions ignored, when the best one has no Action to lose.
  if (canPlayTwo(s, playerId) && playable.length >= 2 && !best.action) return { type: 'playTrait', playerId, cardId: best.id, twoIgnoringActions: true };
  return { type: 'playTrait', playerId, cardId: best.id };
}
