import { describe, expect, it } from 'vitest';
import {
  buildHldDecks,
  copies,
  HLD_5_6_DISASTER_DEFS,
  HLD_5_6_MAIN_DECK_DEFS,
  HLD_DATING_DISASTER_DEFS,
  HLD_DATING_MAIN_DECK_DEFS,
  HLD_DINO_DEFS,
  HLD_DISASTER_DEFS,
  HLD_HAZARD_CARD_DEFS,
  HLD_HAZARDS_DISASTER_DEFS,
  HLD_HAZARDS_MAIN_DECK_DEFS,
  HLD_MAIN_DECK_DEFS,
  HLD_PUBERTY_DISASTER_DEFS,
  HLD_PUBERTY_MAIN_DECK_DEFS,
  type HldCardDef,
} from './cards';
import { chooseAIAction } from './ai';
import { happyLittleDinosModule } from './module';
import {
  applyAction,
  computeRoundScores,
  createInitialState,
  dinoTraitDelta,
  isEliminatedByDisasters,
} from './reducer';
import type { HldCard, HldCardKind, HldConfig, HldDisasterCard, HldDisasterCategory, HldExpansionId, HldState } from './types';
import { makeSeats, playOut } from '@/core/playout';

const DEFAULT_CFG: HldConfig = { expansions: [], trackLength: 50 };
const ALL_EXP: HldExpansionId[] = ['players-5-6', 'perils-of-puberty', 'dating-disasters', 'hazards-ahead'];

const ALL_DEFS: readonly HldCardDef[] = [
  ...HLD_MAIN_DECK_DEFS, ...HLD_5_6_MAIN_DECK_DEFS, ...HLD_PUBERTY_MAIN_DECK_DEFS, ...HLD_DATING_MAIN_DECK_DEFS, ...HLD_HAZARDS_MAIN_DECK_DEFS,
];
const sum = (defs: readonly HldCardDef[], type?: 'point' | 'instant') =>
  defs.filter((d) => !type || d.type === type).reduce((n, d) => n + d.count, 0);
const countOf = (defs: readonly HldCardDef[], kind: HldCardKind) => defs.filter((d) => d.kind === kind).reduce((n, d) => n + d.count, 0);

let nextId = 5000;
function card(kind: HldCardKind, value?: number): HldCard {
  const def = ALL_DEFS.find((d) => d.kind === kind)!;
  return { id: nextId++, kind, name: def.name, type: def.type, value: value ?? def.value, hasEffect: def.hasEffect, text: def.text };
}
/** A plain Point card worth `value`. */
const pt = (value: number): HldCard => ({ id: nextId++, kind: 'cool-stick', name: `Plain ${value}`, type: 'point', value, hasEffect: false, text: '' });
const disaster = (category: HldDisasterCategory, extra: Partial<HldDisasterCard> = {}): HldDisasterCard => ({
  id: nextId++, name: `Test ${category}`, category, text: '', ...extra,
});

/** A fresh game with empty hands, trait-neutral dinos and a Natural Disaster face-up. */
function rig(n: number, cfg: Partial<HldConfig> = {}): HldState {
  const seats = makeSeats(n, { ai: false });
  const s = createInitialState({ ...DEFAULT_CFG, twoPlayerVariant: false, ...cfg }, 1, seats);
  for (const st of seats) {
    s.dinos[st.id] = 'stego'; // only a Meteor trait: neutral against Natural
    s.hands[st.id] = [];
  }
  s.currentDisaster = disaster('natural');
  return s;
}
const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);
/** Everyone plays the given card (put into their hand first). */
function playAll(s: HldState, cards: HldCard[]): HldState {
  cards.forEach((c, i) => s.hands[`p${i + 1}`]!.push(c));
  let out = s;
  cards.forEach((c, i) => { out = applyAction(out, { type: 'submitPick', playerId: `p${i + 1}`, cardId: c.id }); });
  return out;
}

describe('Happy Little Dinosaurs — components (wiki inventory lists)', () => {
  it('base game: 28 Disasters (8/8/8 + 4 Meteor), 53 Point cards, 16 Instants', () => {
    expect(copies(HLD_DISASTER_DEFS)).toBe(28);
    for (const c of ['natural', 'predator', 'emotional'] as const) {
      expect(copies(HLD_DISASTER_DEFS.filter((d) => d.category === c))).toBe(8);
    }
    expect(copies(HLD_DISASTER_DEFS.filter((d) => d.category === 'meteor'))).toBe(4);
    expect(sum(HLD_MAIN_DECK_DEFS, 'point')).toBe(53);
    expect(sum(HLD_MAIN_DECK_DEFS, 'instant')).toBe(16);
    // Inventory: Disaster Insurance ×3, Disaster Redirect ×1, Score Booster ×5, Score Sapper ×5, Score Inversion ×2.
    expect(countOf(HLD_MAIN_DECK_DEFS, 'disaster-insurance')).toBe(3);
    expect(countOf(HLD_MAIN_DECK_DEFS, 'disaster-redirect')).toBe(1);
    expect(countOf(HLD_MAIN_DECK_DEFS, 'score-booster')).toBe(5);
  });

  it('expansions: 5–6 Player 50, Perils of Puberty 54, Dating Disasters 53, Hazards Ahead 50 cards', () => {
    expect(copies(HLD_5_6_DISASTER_DEFS) + sum(HLD_5_6_MAIN_DECK_DEFS)).toBe(50);
    expect(sum(HLD_5_6_MAIN_DECK_DEFS, 'point')).toBe(24);
    expect(copies(HLD_PUBERTY_DISASTER_DEFS)).toBe(16);
    expect(sum(HLD_PUBERTY_MAIN_DECK_DEFS, 'point')).toBe(28);
    expect(sum(HLD_PUBERTY_MAIN_DECK_DEFS, 'instant')).toBe(10);
    expect(copies(HLD_DATING_DISASTER_DEFS)).toBe(15);
    expect(sum(HLD_DATING_MAIN_DECK_DEFS, 'point')).toBe(26);
    expect(sum(HLD_DATING_MAIN_DECK_DEFS, 'instant')).toBe(12);
    expect(copies(HLD_HAZARDS_DISASTER_DEFS) + sum(HLD_HAZARDS_MAIN_DECK_DEFS) + HLD_HAZARD_CARD_DEFS.length).toBe(50);
    expect(copies(HLD_HAZARDS_DISASTER_DEFS.filter((d) => d.category === 'lucky'))).toBe(4);

    const built = buildHldDecks({ seed: 123 }, ALL_EXP);
    expect(built.disasterDeck.length).toBe(28 + 14 + 16 + 15 + 22);
    expect(built.deck.length).toBe(69 + 36 + 38 + 38 + 16);
  });

  it('dinosaur traits match the rulesheet boards', () => {
    const t = (id: string) => HLD_DINO_DEFS.find((d) => d.id === id)!.traits;
    expect(t('nervous-rex')).toEqual({ predator: 1, emotional: -1 });
    expect(t('cry-ceratops')).toEqual({ emotional: 1, natural: -1 });
    expect(t('bad-luck-bronto')).toEqual({ natural: 1, predator: -1 });
    expect(t('stego')).toEqual({ meteor: 1 });
    expect(t('raging-raptor')).toEqual({ predator: 2, emotional: -1, natural: -1 });
    expect(t('pterry-dactyl')).toEqual({ emotional: 1, predator: 1, natural: -2 });
  });

  it('a Meteor triggers only a Meteor trait', () => {
    const s = rig(2);
    s.dinos = { p1: 'stego', p2: 'raging-raptor' };
    s.currentDisaster = disaster('meteor');
    expect(dinoTraitDelta(s, 'p1')).toBe(1);
    expect(dinoTraitDelta(s, 'p2')).toBe(0);
    s.currentDisaster = disaster('predator');
    expect(dinoTraitDelta(s, 'p2')).toBe(2);
  });
});

describe('Happy Little Dinosaurs — setup & config', () => {
  it('deals 5 cards with at least 1 Point card to each player and flips the first Disaster', () => {
    const seats = makeSeats(4);
    const s = createInitialState(DEFAULT_CFG, 42, seats);
    expect(s.currentDisaster).toBeTruthy();
    expect(s.subPhase).toBe('selecting');
    for (const seat of seats) {
      expect(s.hands[seat.id]?.length).toBe(5);
      expect(s.hands[seat.id]?.some((c) => c.type === 'point')).toBe(true);
    }
  });

  it('gives every seat a distinct, available board and honours lobby choices', () => {
    const cfg: HldConfig = { expansions: ALL_EXP, trackLength: 50, dinoSelections: { p1: 'raging-raptor', p2: 'raging-raptor', p3: 'pterry-dactyl' } };
    expect(happyLittleDinosModule.validateConfig(cfg, makeSeats(5))).toEqual([]);
    const s = createInitialState(cfg, 7, makeSeats(5));
    expect(s.dinos.p1).toBe('raging-raptor');
    expect(s.dinos.p3).toBe('pterry-dactyl');
    expect(new Set(Object.values(s.dinos)).size).toBe(5);
    // Expansion boards are not handed out without their expansion.
    const base = createInitialState({ expansions: [], trackLength: 50, dinoSelections: { p1: 'raging-raptor' } }, 7, makeSeats(4));
    expect(Object.values(base.dinos).sort()).toEqual(['bad-luck-bronto', 'cry-ceratops', 'nervous-rex', 'stego']);
  });

  it('needs a board-adding expansion for 5–6 players', () => {
    expect(happyLittleDinosModule.validateConfig({ expansions: [], trackLength: 50 }, makeSeats(5)).length).toBe(1);
    expect(happyLittleDinosModule.validateConfig({ expansions: ['hazards-ahead'], trackLength: 50 }, makeSeats(6))).toEqual([]);
  });

  it('2-player rules: no 1–3 Point cards, and elimination at 4 of a type or 2 of each', () => {
    const s = createInitialState({ expansions: ['perils-of-puberty'], trackLength: 50, twoPlayerVariant: true }, 3, makeSeats(2));
    const all = [...s.deck, ...s.hands.p1!, ...s.hands.p2!];
    expect(all.some((c) => c.type === 'point' && c.value! >= 1 && c.value! <= 3)).toBe(false);
    const rule = { same: 4, each: 2 };
    const n = disaster('natural');
    const p = disaster('predator');
    const e = disaster('emotional');
    expect(isEliminatedByDisasters([n, p, e], rule)).toBe(false);
    expect(isEliminatedByDisasters([n, n, n], rule)).toBe(false);
    expect(isEliminatedByDisasters([n, n, n, n], rule)).toBe(true);
    expect(isEliminatedByDisasters([n, n, p, p, e, e], rule)).toBe(true);
    // Off with 3+ players.
    const three = createInitialState({ expansions: [], trackLength: 50, twoPlayerVariant: true }, 3, makeSeats(3));
    expect([...three.deck, ...three.hands.p1!].some((c) => c.type === 'point' && c.value === 1)).toBe(true);
  });

  it('switching dinos is only allowed before your first card, to a free board', () => {
    let s = rig(3);
    s.dinos = { p1: 'nervous-rex', p2: 'cry-ceratops', p3: 'stego' };
    expect(() => applyAction(s, { type: 'chooseDino', playerId: 'p1', dinoId: 'cry-ceratops' })).toThrow();
    s = applyAction(s, { type: 'chooseDino', playerId: 'p1', dinoId: 'bad-luck-bronto' });
    expect(s.dinos.p1).toBe('bad-luck-bronto');
    s.hands.p1!.push(pt(5));
    s = applyAction(s, { type: 'submitPick', playerId: 'p1', cardId: s.hands.p1!.at(-1)!.id });
    expect(() => applyAction(s, { type: 'chooseDino', playerId: 'p1', dinoId: 'nervous-rex' })).toThrow();
  });
});

describe('Happy Little Dinosaurs — scoring, ties and elimination', () => {
  it('evaluates 3 same, 3 different, Meteor wild, and "counts as 2" Disasters', () => {
    const n = disaster('natural');
    const p = disaster('predator');
    const e = disaster('emotional');
    const m = disaster('meteor');
    expect(isEliminatedByDisasters([n, n])).toBe(false);
    expect(isEliminatedByDisasters([n, n, n])).toBe(true);
    expect(isEliminatedByDisasters([n, p, e])).toBe(true);
    expect(isEliminatedByDisasters([n, n, m])).toBe(true);
    expect(isEliminatedByDisasters([n, p, m])).toBe(true);
    expect(isEliminatedByDisasters([m, m])).toBe(false);
    const double = disaster('emotional', { effect: 'counts-double' });
    expect(isEliminatedByDisasters([double])).toBe(false);
    expect(isEliminatedByDisasters([double, e])).toBe(true);
  });

  it('the highest collects, the lowest takes the Disaster, then +1 per Disaster at end of round', () => {
    let s = rig(3);
    s = playAll(s, [pt(9), pt(5), pt(2)]);
    expect(s.trackPosition.p1).toBe(9);
    expect(s.disasterAreas.p3!.length).toBe(1);
    expect(s.trackPosition.p3).toBe(1);
    expect(s.roundNumber).toBe(2);
  });

  it('if everyone ties, nobody collects and the Disaster goes to the bottom of the deck', () => {
    let s = rig(3);
    const d = s.currentDisaster!;
    s = playAll(s, [pt(4), pt(4), pt(4)]);
    expect(ids(3).map((id) => s.trackPosition[id])).toEqual([0, 0, 0]);
    expect(ids(3).every((id) => s.disasterAreas[id]!.length === 0)).toBe(true);
    expect(s.disasterDeck.at(-1)?.id).toBe(d.id);
  });

  it('5–6 players: the top two collect; a tie for highest shuts out second place', () => {
    let s = rig(5, { expansions: ['players-5-6'] });
    s = playAll(s, [pt(9), pt(7), pt(5), pt(3), pt(1)]);
    expect([s.trackPosition.p1, s.trackPosition.p2, s.trackPosition.p3]).toEqual([9, 7, 0]);
    expect(s.disasterAreas.p5!.length).toBe(1);

    let t = rig(5, { expansions: ['players-5-6'] });
    t = playAll(t, [pt(9), pt(9), pt(5), pt(3), pt(1)]);
    expect([t.trackPosition.p1, t.trackPosition.p2, t.trackPosition.p3]).toEqual([9, 9, 0]);
  });

  it('Sudden Death: tied lowest replay; the lowest printed value takes it', () => {
    let s = rig(3);
    const extra2 = pt(2);
    const extra6 = pt(6);
    s.hands.p2!.push(extra2);
    s.hands.p3!.push(extra6);
    s = playAll(s, [pt(8), pt(3), pt(3)]);
    expect(s.subPhase).toBe('suddenDeath');
    expect(s.suddenDeathPlayers).toEqual(['p2', 'p3']);
    s = applyAction(s, { type: 'submitSuddenDeathPick', playerId: 'p2', cardId: extra2.id });
    s = applyAction(s, { type: 'submitSuddenDeathPick', playerId: 'p3', cardId: extra6.id });
    expect(s.disasterAreas.p2!.length).toBe(1);
    expect(s.disasterAreas.p3!.length).toBe(0);
  });

  it('Sudden Death with several tied players out of Point cards: the Disaster goes to the bottom', () => {
    let s = rig(3);
    const d = s.currentDisaster!;
    s = playAll(s, [pt(8), pt(3), pt(3)]);
    expect(ids(3).every((id) => s.disasterAreas[id]!.length === 0)).toBe(true);
    expect(s.disasterDeck.at(-1)?.id).toBe(d.id);
  });

  it('a player who takes a Disaster may discard a card', () => {
    let s = rig(2);
    const junk = pt(0);
    s.hands.p2!.push(junk, pt(4));
    s = playAll(s, [pt(9), pt(1)]);
    expect(s.subPhase).toBe('resolving');
    expect(s.promptQueue[0]).toEqual({ kind: 'discardAfterDisaster', playerId: 'p2' });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p2', targetCardId: junk.id });
    expect(s.discard.some((c) => c.id === junk.id)).toBe(true);
    expect(s.roundNumber).toBe(2);
  });

  it('reaching the goal wins on the spot — even mid-round', () => {
    let s = rig(2);
    s.trackPosition.p1 = 45;
    s.hands.p2!.push(card('disaster-insurance'));
    s = playAll(s, [pt(9), pt(1)]);
    expect(s.phase).toBe('gameOver');
    expect(s.winnerId).toBe('p1');
    expect(s.disasterAreas.p2!.length).toBe(0); // never got as far as the Disaster

    let t = rig(2, { expansions: ['perils-of-puberty'] });
    t.trackPosition.p2 = 48;
    const lb = card('lucky-break');
    t.hands.p2!.push(lb);
    t = playAll(t, [pt(9), pt(1)]);
    t = applyAction(t, { type: 'playDisasterSave', playerId: 'p2', cardId: lb.id });
    expect(t.phase).toBe('gameOver');
    expect(t.winnerId).toBe('p2');
  });

  it('inversions swap every player tied for highest with every player tied for lowest', () => {
    let s = rig(3);
    s = playAll(s, [card('mouth-trap'), pt(3), pt(3)]);
    // Mouth Trap (5) vs two 3s → the 5 becomes 3 and both 3s become 5: p1 alone is lowest.
    expect(s.trackPosition.p2).toBe(5);
    expect(s.trackPosition.p3).toBe(5);
    expect(s.disasterAreas.p1!.length).toBe(1);
  });
});

describe('Happy Little Dinosaurs — Instants', () => {
  it('scoring Instants are answered one at a time in queue order', () => {
    let s = rig(3);
    const b1 = card('score-booster');
    const b3 = card('score-booster');
    s.hands.p1!.push(b1);
    s.hands.p3!.push(b3);
    s = playAll(s, [pt(5), pt(6), pt(2)]);
    expect(s.subPhase).toBe('awaitingScoringInstants');
    expect(s.instantResponderQueue).toEqual(['p1', 'p3']);
    expect(() => applyAction(s, { type: 'playScoringInstant', playerId: 'p3', cardId: b3.id, targetPlayerId: 'p3' })).toThrow();
    s = applyAction(s, { type: 'playScoringInstant', playerId: 'p1', cardId: b1.id, targetPlayerId: 'p1' });
    expect(computeRoundScores(s).p1).toBe(7);
    // The play reopened the window — p3 gets to answer.
    expect(s.instantResponderQueue).toEqual(['p3']);
  });

  it('Special Star Fruit doubles Score Booster / Sapper only; Swiss Shears halves other players\' boosters', () => {
    let s = rig(3, { expansions: ['players-5-6', 'perils-of-puberty'] });
    const boost = card('score-booster');
    const bff = card('bffs-help');
    s.hands.p2!.push(boost, bff);
    s = playAll(s, [card('special-star-fruit'), pt(2), pt(1)]);
    s = applyAction(s, { type: 'playScoringInstant', playerId: 'p2', cardId: boost.id, targetPlayerId: 'p2' });
    expect(computeRoundScores(s).p2).toBe(2 + 4);
    s = applyAction(s, { type: 'playScoringInstant', playerId: 'p2', cardId: bff.id, targetPlayerId: 'p2' });
    // BFF's Help is not doubled: 2 + 4 + 3 = 9 beats the Star Fruit's 6.
    expect(s.trackPosition.p2).toBe(9);

    let t = rig(3, { expansions: ['players-5-6'] });
    const b = card('score-booster');
    t.hands.p2!.push(b, card('score-booster'));
    t = playAll(t, [card('swiss-shears'), pt(2), pt(1)]);
    t = applyAction(t, { type: 'playScoringInstant', playerId: 'p2', cardId: b.id, targetPlayerId: 'p2' });
    expect(computeRoundScores(t).p2).toBe(3);
  });

  it('Behemoth Blade stops all scoring Instants; Cold Feet stops its holder\'s', () => {
    let s = rig(3, { expansions: ['players-5-6'] });
    s.hands.p2!.push(card('score-booster'));
    s = playAll(s, [card('behemoth-blade'), pt(5), pt(1)]);
    expect(s.subPhase).not.toBe('awaitingScoringInstants');

    let t = rig(3, { expansions: ['dating-disasters'] });
    t.hands.p1!.push(card('score-booster'));
    t.hands.p2!.push(card('score-booster'));
    t = playAll(t, [card('cold-feet'), pt(5), pt(1)]);
    expect(t.instantResponderQueue).toEqual(['p2']);
  });

  it('Lucky Break sends the Disaster to the bottom and collects 3; Awkward First Kiss collects 5 but still takes it', () => {
    let s = rig(2, { expansions: ['perils-of-puberty'] });
    const lb = card('lucky-break');
    s.hands.p2!.push(lb);
    s = playAll(s, [pt(9), pt(1)]);
    expect(s.subPhase).toBe('awaitingDisasterSave');
    s = applyAction(s, { type: 'playDisasterSave', playerId: 'p2', cardId: lb.id });
    expect(s.disasterAreas.p2!.length).toBe(0);
    expect(s.trackPosition.p2).toBe(3);

    let t = rig(2, { expansions: ['dating-disasters'] });
    const kiss = card('awkward-first-kiss');
    t.hands.p2!.push(kiss);
    t = playAll(t, [pt(9), pt(1)]);
    t = applyAction(t, { type: 'playDisasterSave', playerId: 'p2', cardId: kiss.id });
    expect(t.disasterAreas.p2!.length).toBe(1);
    expect(t.trackPosition.p2).toBe(5 + 1);
  });

  it('Disaster Redirect hands it to another player, who may answer in turn', () => {
    let s = rig(3);
    const r = card('disaster-redirect');
    const ins = card('disaster-insurance');
    s.hands.p3!.push(r);
    s.hands.p1!.push(ins);
    s = playAll(s, [pt(5), pt(6), pt(1)]);
    s = applyAction(s, { type: 'playDisasterSave', playerId: 'p3', cardId: r.id, targetPlayerId: 'p1' });
    expect(s.pendingDisasterVictimId).toBe('p1');
    s = applyAction(s, { type: 'playDisasterSave', playerId: 'p1', cardId: ins.id });
    expect(ids(3).every((id) => s.disasterAreas[id]!.length === 0)).toBe(true);
  });

  it('Double Date doubles every trait; Minty Gum doubles its holder\'s advantages; Crippling Shyness caps the highest at 5', () => {
    let s = rig(2, { expansions: ['dating-disasters'] });
    s.dinos = { p1: 'bad-luck-bronto', p2: 'cry-ceratops' }; // Natural: +1 / −1
    const dd = card('double-date');
    const cs = card('crippling-shyness');
    s.hands.p2!.push(dd, cs);
    s = playAll(s, [card('minty-gum'), pt(4)]);
    expect(computeRoundScores(s)).toEqual({ p1: 9 + 2, p2: 4 - 1 });
    s = applyAction(s, { type: 'playScoringInstant', playerId: 'p2', cardId: dd.id });
    expect(computeRoundScores(s)).toEqual({ p1: 9 + 4, p2: 4 - 2 });
    s = applyAction(s, { type: 'playScoringInstant', playerId: 'p2', cardId: cs.id });
    expect(s.trackPosition.p1).toBe(5);
  });

  it('One Week Anniversary swaps the face-up Disaster with one from your area', () => {
    let s = rig(2, { expansions: ['dating-disasters'] });
    const mine = disaster('predator');
    s.disasterAreas.p1 = [mine];
    const face = s.currentDisaster!;
    const owa = card('one-week-anniversary');
    s.hands.p1!.push(owa, card('score-booster'));
    s = playAll(s, [pt(2), pt(9)]);
    s = applyAction(s, { type: 'playScoringInstant', playerId: 'p1', cardId: owa.id, disasterId: mine.id });
    expect(s.currentDisaster?.id).toBe(mine.id);
    expect(s.disasterAreas.p1!.map((d) => d.id)).toEqual([face.id]);
  });

  it('Dating Disasters bonus: +1 per Disaster of its type, and can be turned down while scores are inverted', () => {
    let s = rig(3, { expansions: ['dating-disasters', 'players-5-6'] });
    s.disasterAreas.p3 = [disaster('emotional', { effect: 'scoring-bonus' }), disaster('emotional')];
    const inv = card('score-inversion');
    s.hands.p1!.push(inv);
    s.hands.p3!.push(card('score-booster'));
    s = playAll(s, [pt(9), pt(5), pt(5)]);
    expect(computeRoundScores(s).p3).toBe(7);
    s = applyAction(s, { type: 'playScoringInstant', playerId: 'p1', cardId: inv.id });
    // Inverted: p1 (9) ↔ p2 (5, lowest). p3 (7) may drop to 5 and tie for lowest → becomes highest.
    expect(s.instantResponderQueue).toEqual(['p3']);
    expect(computeRoundScores(s).p3).toBe(7);
    s = applyAction(s, { type: 'skipDisasterBonus', playerId: 'p3' });
    expect(computeRoundScores(s).p3).toBe(9);
  });
});

describe('Happy Little Dinosaurs — Point card effects', () => {
  it('effects resolve lowest value first, and Flaming Chainsaw cancels them all', () => {
    let s = rig(3);
    s.hands.p1!.push(pt(7));
    s.hands.p2!.push(pt(8));
    s = playAll(s, [card('dino-grabber'), card('pet-rock'), pt(5)]);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'discardForPoints', playerId: 'p2' });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p2', decline: true });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'takeFromHand', playerId: 'p1' });

    let t = rig(3);
    t.hands.p2!.push(pt(8));
    t = playAll(t, [card('flaming-chainsaw'), card('pet-rock'), pt(5)]);
    expect(t.promptQueue.some((p) => p.kind === 'discardForPoints')).toBe(false);
    expect(t.trackPosition.p1).toBe(9);
  });

  it('Pet Rock adds the discarded Point card\'s value; Smoothie only takes cards with an effect', () => {
    let s = rig(2);
    const eight = pt(8);
    s.hands.p1!.push(eight);
    s = playAll(s, [card('pet-rock'), pt(5)]);
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: eight.id });
    expect(s.trackPosition.p1).toBe(8);

    let t = rig(2);
    t.hands.p1!.push(pt(9));
    t = playAll(t, [card('delicious-smoothie'), pt(5)]);
    expect(t.promptQueue.some((p) => p.kind === 'discardForPoints')).toBe(false); // no Point card with an effect in hand
  });

  it('Hungry Plant swaps two OTHER players\' Point cards', () => {
    let s = rig(3);
    const low = pt(1);
    s = playAll(s, [card('hungry-plant'), pt(9), low]);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'swapOthers', playerId: 'p1' });
    expect(() => applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p1', secondPlayerId: 'p2' })).toThrow();
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p2', secondPlayerId: 'p3' });
    expect(s.trackPosition.p3).toBe(9);
    expect(s.disasterAreas.p2!.length).toBe(1);
  });

  it('Grappling Snake swaps with a neighbour\'s no-effect card; the swapped-in card is not re-used', () => {
    let s = rig(3);
    s = playAll(s, [card('grappling-snake'), pt(7), card('treenoculars')]);
    const prompt = s.promptQueue[0];
    expect(prompt).toMatchObject({ kind: 'swapPoint', targets: ['p2'] });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p2' });
    expect(s.revealedPicks.p2?.kind).toBe('grappling-snake');
    // Treenoculars (7) is next — p3's "you may look".
    expect(s.promptQueue[0]).toMatchObject({ kind: 'peekDeck', playerId: 'p3', cards: null });
  });

  it('Treenoculars is a "may": skip it, or look and keep one', () => {
    let s = rig(2);
    const top3 = pt(3);
    const top4 = pt(4);
    s.deck = [top3, top4, ...s.deck];
    s = playAll(s, [card('treenoculars'), pt(1)]);
    const deckBefore = s.deck.length;
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', look: true });
    const p = s.promptQueue[0];
    expect(p?.kind === 'peekDeck' && p.cards?.length).toBe(2);
    expect(s.deck.length).toBe(deckBefore - 2);
    expect(p?.kind === 'peekDeck' && p.cards!.map((c) => c.id)).toEqual([top3.id, top4.id]);
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: top4.id });
    expect(s.hands.p1!.some((c) => c.id === top4.id)).toBe(true);
    expect(s.discard.some((c) => c.id === top3.id)).toBe(true);

    let skip = rig(2);
    skip = playAll(skip, [card('treenoculars'), pt(1)]);
    const before = skip.deck.length;
    skip = applyAction(skip, { type: 'resolvePrompt', playerId: 'p1', decline: true });
    expect(skip.roundNumber).toBe(2);
    expect(skip.deck.length).toBeLessThan(before); // only the round-2 refill drew
  });

  it('Voodoo Dino, Trash into Treasure and Good Luck Rod adjust scores', () => {
    let s = rig(3, { expansions: ['players-5-6', 'perils-of-puberty'] });
    const v1 = pt(1);
    const v2 = pt(2);
    const t1 = pt(4);
    s.hands.p1!.push(v1, v2, pt(6));
    s.hands.p2!.push(t1);
    s = playAll(s, [card('voodoo-dino'), card('trash-into-treasure'), pt(8)]);
    // Trash into Treasure (0) first.
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p2', cardIds: [t1.id] });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', cardIds: [v1.id, v2.id], targetPlayerId: 'p3' });
    expect(s.trackPosition.p1).toBe(0);
    expect(s.trackPosition.p3).toBe(6); // 8 − 2 = 6, still highest

    let r = rig(2, { expansions: ['players-5-6'] });
    r.deck = [pt(9), pt(2), card('score-booster'), ...r.deck];
    r = playAll(r, [card('good-luck-rod'), pt(5)]);
    r = applyAction(r, { type: 'resolvePrompt', playerId: 'p1', look: true });
    const shown = r.promptQueue[0];
    const nine = shown?.kind === 'peekDeck' ? shown.cards!.find((c) => c.value === 9)! : null;
    r = applyAction(r, { type: 'resolvePrompt', playerId: 'p1', targetCardId: nine!.id });
    expect(r.trackPosition.p1).toBe(10);
  });

  it('Unwanted Lunch swaps whole hands', () => {
    let s = rig(2, { expansions: ['perils-of-puberty'] });
    const theirs = [pt(8), pt(9)];
    s.hands.p2!.push(...theirs);
    s = playAll(s, [card('unwanted-lunch'), pt(5)]);
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p2' });
    expect(theirs.every((c) => s.hands.p1!.some((x) => x.id === c.id))).toBe(true);
  });

  it('Extra Sharp Stick, Ice Cream!, Teddy Bear and Heart Bomb', () => {
    let s = rig(3, { expansions: ['perils-of-puberty', 'dating-disasters'] });
    const had = disaster('predator');
    s.disasterAreas.p2 = [had];
    s = playAll(s, [card('extra-sharp-stick'), card('ice-cream'), card('teddy-bear')]);
    // p1 9 + 2 extra; Ice Cream (6) isn't highest; Teddy Bear (5) is lowest but still collects 5 at round end.
    expect(s.trackPosition.p1).toBe(11);
    expect(s.disasterAreas.p2!.length).toBe(1);
    expect(s.trackPosition.p3).toBe(5 + 1);

    const gone = disaster('natural');
    let u = rig(2, { expansions: ['perils-of-puberty', 'dating-disasters'] });
    u.disasterAreas.p1 = [gone];
    const keep = pt(2);
    u.hands.p2!.push(keep);
    u = playAll(u, [card('ice-cream'), card('heart-bomb', 1)]);
    expect(u.disasterAreas.p1!.length).toBe(0);
    u = applyAction(u, { type: 'resolvePrompt', playerId: 'p2', decline: true }); // the post-Disaster discard
    expect(u.disasterDeck.some((d) => d.id === gone.id)).toBe(true);
    expect(u.discard.some((c) => c.id === keep.id)).toBe(true);
  });

  it('Lucky Day: goes to the bottom instead, and Treasure Trove takes a Point card from the discard', () => {
    let s = rig(2, { expansions: ['hazards-ahead'] });
    const lucky = disaster('lucky', { name: 'Treasure Trove', effect: 'treasure-trove' });
    s.currentDisaster = lucky;
    const nine = pt(9);
    s.discard.push(nine);
    s = playAll(s, [pt(8), pt(1)]);
    expect(s.promptQueue[0]).toEqual({ kind: 'treasureTrove', playerId: 'p2' });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p2', targetCardId: nine.id });
    expect(s.disasterAreas.p2!.length).toBe(0);
    expect(s.disasterDeck.some((d) => d.id === lucky.id)).toBe(true);
    expect(s.hands.p2!.some((c) => c.id === nine.id)).toBe(true);
  });
});

describe('Happy Little Dinosaurs — AI playouts', () => {
  it('plays full AI-vs-AI base games across 2, 3, and 4 players to completion', () => {
    for (const playerCount of [2, 3, 4]) {
      for (let seed = 1; seed <= 4; seed++) {
        const { state: s, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(DEFAULT_CFG, seed * 31, makeSeats(playerCount)), 3000);
        expect(stuck).toBe(false);
        expect(s.phase).toBe('gameOver');
        expect(s.winnerId).toBeTruthy();
      }
    }
  });

  it('plays full AI-vs-AI games with all 4 expansions enabled across 2–6 players', () => {
    const allExpConfig: HldConfig = { expansions: ALL_EXP, trackLength: 50 };
    for (const playerCount of [2, 3, 5, 6]) {
      for (let seed = 1; seed <= 3; seed++) {
        const { state: s, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(allExpConfig, seed * 47, makeSeats(playerCount)), 4000);
        expect(stuck).toBe(false);
        expect(s.phase).toBe('gameOver');
        expect(s.winnerId).toBeTruthy();
      }
    }
  });
});
