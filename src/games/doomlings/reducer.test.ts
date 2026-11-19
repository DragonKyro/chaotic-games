import { describe, expect, it } from 'vitest';
import { makeSeats, playOut } from '@/core/playout';
import { CLASSIC_AGES, CLASSIC_CATASTROPHES, CLASSIC_TRAITS, classicAgeCards, classicTraitCards } from './cards';
import { chooseAIAction } from './ai';
import { doomlingsModule } from './module';
import {
  applyAction,
  canPlayTrait,
  computePlayerScore,
  createInitialState,
  genePoolOf,
  handOf,
  previewNextAge,
  tableauOf,
} from './reducer';
import { DM_EXPANSIONS } from './types';
import type { DmAction, DmAgeCard, DmCatastropheTag, DmState, DmTraitCard, DmTraitKind } from './types';

const CFG = { expansions: [] };
const ALL_TRAITS = classicTraitCards();
const AGES = classicAgeCards(1000);

let nextId = 5000;
/** A fresh copy of a Classic trait with a unique id. */
function T(kind: DmTraitKind): DmTraitCard {
  const c = ALL_TRAITS.find((x) => x.kind === kind);
  if (!c) throw new Error(`no trait ${kind}`);
  return { ...c, id: nextId++ };
}

function age(ruleTag: DmAgeCard['ruleTag']): DmAgeCard {
  return AGES.ages.find((a) => a.ruleTag === ruleTag)!;
}

function cat(tag: DmCatastropheTag): DmAgeCard {
  return AGES.catastrophes.find((a) => a.catastrophe === tag)!;
}

/** n seats, p1 to play, with controlled hands (filler = effectless traits). */
function setup(n = 2, seed = 7): DmState {
  const s = createInitialState(CFG, seed, makeSeats(n));
  for (const seat of s.seats) s.hands[seat.id] = [T('antlers'), T('bark'), T('fangs'), T('gills'), T('leaves')];
  return s;
}

/** Make `p` the last player of the round, ready to play. */
function lastTurn(s: DmState, p: string) {
  s.roundOrder = s.seats.map((x) => x.id);
  s.turnIndex = s.roundOrder.indexOf(p);
  s.turnPlayerId = p;
  s.activePlayerId = p;
}

function play(s: DmState, p: string, card: DmTraitCard): DmState {
  return applyAction(s, { type: 'playTrait', playerId: p, cardId: card.id });
}

function answer(s: DmState, rest: Omit<Extract<DmAction, { type: 'resolvePrompt' }>, 'type' | 'playerId'>): DmState {
  if (!s.prompt) throw new Error('no prompt');
  return applyAction(s, { type: 'resolvePrompt', playerId: s.prompt.playerId, ...rest });
}

describe('Doomlings — components & setup (Classic 2nd edition)', () => {
  it('has the official Classic pool: 116 traits (107 distinct), 25 ages, 15 catastrophes', () => {
    expect(ALL_TRAITS.length).toBe(116);
    expect(CLASSIC_TRAITS.length).toBe(107);
    expect(CLASSIC_AGES.length).toBe(25);
    expect(CLASSIC_CATASTROPHES.length).toBe(15);
    expect(ALL_TRAITS.filter((c) => c.kind === 'kidney').length).toBe(6);
    expect(ALL_TRAITS.filter((c) => c.kind === 'swarm').length).toBe(5);
    expect(ALL_TRAITS.filter((c) => c.dominant).length).toBe(15);
    // Spot checks against the card data.
    const tiny = ALL_TRAITS.find((c) => c.kind === 'tiny')!;
    expect([tiny.points, tiny.color, tiny.dominant]).toEqual([17, 'blue', true]);
    expect(ALL_TRAITS.find((c) => c.kind === 'warm-blood')!.genePoolDelta).toBe(2);
    expect(ALL_TRAITS.find((c) => c.kind === 'heroic')!.points).toBe(7);
    expect(cat('overpopulation').genePoolDelta).toBe(1);
    expect(cat('greyGoo').genePoolDelta).toBe(0);
  });

  it('builds the age deck from 3 shuffled piles of 3 ages + 1 catastrophe under The Birth of Life; deals 5, Gene Pool 5', () => {
    for (const seed of [1, 2, 3, 99]) {
      const s = createInitialState(CFG, seed, makeSeats(4));
      expect(s.currentAge.kind).toBe('birthOfLife');
      expect(s.ageDeck.length).toBe(12);
      for (let era = 0; era < 3; era++) {
        expect(s.ageDeck.slice(era * 4, era * 4 + 4).filter((a) => a.kind === 'catastrophe').length).toBe(1);
      }
      for (const seat of s.seats) {
        expect(handOf(s, seat.id).length).toBe(5);
        expect(genePoolOf(s, seat.id)).toBe(5);
      }
      expect(s.subPhase).toBe('awaitingAction');
      expect(s.activePlayerId).toBe('p1');
    }
  });

  it('lists only the real expansions, all locked: Ancient Fates (invented) is gone', () => {
    expect(DM_EXPANSIONS.map((e) => e.id)).toEqual(['overlush', 'imaginary-ends', 'legends-of-enderas', 'mokoko-village', 'shadow-puppets', 'castle-glass']);
    expect(doomlingsModule.validateConfig({ expansions: [] })).toEqual([]);
    expect(doomlingsModule.validateConfig({ expansions: ['overlush'] }).length).toBe(1);
    expect(doomlingsModule.validateConfig({ expansions: ['ancient-fates'] }).length).toBe(1);
  });
});

describe('Doomlings — taking a turn', () => {
  it('you must play a trait if you can (passing is refused)', () => {
    const s = setup();
    expect(() => applyAction(s, { type: 'passTurn', playerId: 'p1' })).toThrow(/must play/);
  });

  it('empty hand: draw 5 and skip the turn without stabilizing', () => {
    const s = setup();
    s.hands.p1 = [];
    s.genePool.p1 = 7;
    const n = applyAction(s, { type: 'passTurn', playerId: 'p1' });
    expect(handOf(n, 'p1').length).toBe(5);
    expect(n.turnPlayerId).toBe('p2');
  });

  it('cards but nothing playable: skip, optionally discarding the hand to draw 3 (no stabilize)', () => {
    const s = setup();
    s.currentAge = age('noRed');
    s.hands.p1 = [T('antlers'), T('fangs'), T('quick'), T('stone-skin')];
    expect(canPlayTrait(s, 'p1', s.hands.p1[0]!)).toBe(false);
    const n = applyAction(s, { type: 'passTurn', playerId: 'p1', discardHand: true });
    expect(handOf(n, 'p1').length).toBe(3);
    expect(n.traitDiscard.length).toBe(4);
    expect(n.turnPlayerId).toBe('p2');
  });

  it('stabilize draws up to the Gene Pool, or prompts the player to choose the excess to discard', () => {
    let s = setup();
    s.hands.p1.push(T('spiny'), T('quick')); // 7 cards, Gene Pool 5
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(s.prompt?.kind).toBe('cards');
    expect(s.prompt?.playerId).toBe('p1');
    if (s.prompt?.kind !== 'cards') throw new Error();
    expect([s.prompt.min, s.prompt.max]).toEqual([1, 1]);
    const drop = s.prompt.cardIds[2]!;
    s = answer(s, { cardIds: [drop] });
    expect(handOf(s, 'p1').length).toBe(5);
    expect(s.traitDiscard.some((c) => c.id === drop)).toBe(true);
    expect(s.turnPlayerId).toBe('p2');

    let t = setup();
    t.hands.p1 = [T('antlers')];
    t = play(t, 'p1', t.hands.p1[0]!);
    expect(handOf(t, 'p1').length).toBe(5);
  });
});

describe('Doomlings — Gene Pool', () => {
  it('an effect that would pass 8 is ignored, but a trait leaving always reverses its change', () => {
    let s = setup();
    s.genePool.p1 = 8;
    const warm = T('warm-blood');
    s.hands.p1 = [warm, T('bark'), T('gills'), T('leaves'), T('spiny')];
    s = play(s, 'p1', warm);
    expect(genePoolOf(s, 'p1')).toBe(8); // +2 ignored at 8
    // p2 steals it with Selfish: p1 loses 2 anyway, p2 gains 2.
    const selfish = T('selfish');
    s.hands.p2 = [selfish, T('bark'), T('gills'), T('leaves'), T('spiny')];
    s = play(s, 'p2', selfish);
    expect(tableauOf(s, 'p2').some((c) => c.id === warm.id)).toBe(true);
    expect(genePoolOf(s, 'p1')).toBe(6);
    expect(genePoolOf(s, 'p2')).toBe(7);
  });

  it('Super Spreader gives every player −1 while it is in play', () => {
    let s = setup(3);
    const ss = T('super-spreader');
    s.hands.p1[0] = ss;
    s = play(s, 'p1', ss);
    expect(s.seats.map((x) => genePoolOf(s, x.id))).toEqual([4, 4, 4]);
  });
});

describe('Doomlings — Dominants & requirements', () => {
  it('only 2 Dominants; Dominants can never be stolen', () => {
    const s = setup();
    s.tableaus.p1 = [T('tiny'), T('immunity')];
    expect(canPlayTrait(s, 'p1', T('apex-predator'))).toBe(false);
    s.tableaus.p2 = [T('apex-predator')]; // red, but Dominant
    let t = s;
    const selfish = T('selfish');
    t.hands.p1[0] = selfish;
    t = play(t, 'p1', selfish);
    expect(tableauOf(t, 'p2').length).toBe(1);
  });

  it('Heroic needs 3 green traits; Delicious needs a colorless trait', () => {
    const s = setup();
    s.tableaus.p1 = [T('bark'), T('leaves')];
    expect(canPlayTrait(s, 'p1', T('heroic'))).toBe(false);
    s.tableaus.p1.push(T('appealing'));
    expect(canPlayTrait(s, 'p1', T('heroic'))).toBe(true);
    expect(canPlayTrait(s, 'p1', T('delicious'))).toBe(false);
    s.tableaus.p1.push(T('fear'));
    expect(canPlayTrait(s, 'p1', T('delicious'))).toBe(true);
  });

  it('Morality: the player chooses which positive-value trait to give away', () => {
    let s = setup();
    const antlers = T('antlers');
    const bark = T('bark');
    s.tableaus.p1 = [antlers, bark, T('confusion')];
    const morality = T('morality');
    s.hands.p1[0] = morality;
    s = play(s, 'p1', morality);
    expect(s.prompt?.kind).toBe('trait');
    if (s.prompt?.kind !== 'trait') throw new Error();
    expect(s.prompt.targets.map((t) => t.cardId).sort()).toEqual([antlers.id, bark.id].sort()); // not Confusion (−2)
    s = answer(s, { targetCardId: bark.id });
    expect(tableauOf(s, 'p2').some((c) => c.id === bark.id)).toBe(true);
    expect(tableauOf(s, 'p1').some((c) => c.id === morality.id)).toBe(true);
  });

  it('Retractable Claws discards a red trait to play; Endurance comes straight back', () => {
    let s = setup();
    const endurance = T('endurance');
    s.tableaus.p1 = [endurance];
    const claws = T('retractable-claws');
    s.hands.p1[0] = claws;
    s = play(s, 'p1', claws);
    expect(tableauOf(s, 'p1').map((c) => c.kind).sort()).toEqual(['endurance', 'retractable-claws']);
    expect(s.traitDiscard.some((c) => c.id === endurance.id)).toBe(false);
  });
});

describe('Doomlings — trait actions prompt the player', () => {
  it('a steal with two legal targets asks which one; with one it resolves itself', () => {
    let s = setup();
    const antlers = T('antlers');
    const fangs = T('fangs');
    s.tableaus.p2 = [antlers, fangs, T('bark')];
    const selfish = T('selfish');
    s.hands.p1[0] = selfish;
    s = play(s, 'p1', selfish);
    expect(s.prompt?.kind).toBe('trait');
    if (s.prompt?.kind !== 'trait') throw new Error();
    expect(s.prompt.targets.length).toBe(2);
    s = answer(s, { targetCardId: fangs.id });
    expect(tableauOf(s, 'p1').some((c) => c.id === fangs.id)).toBe(true);
    expect(tableauOf(s, 'p2').some((c) => c.id === antlers.id)).toBe(true);
  });

  it('Reforestation: nothing can be stolen, so the steal does nothing', () => {
    let s = setup();
    s.currentAge = age('protectTraitPiles');
    s.tableaus.p2 = [T('antlers')];
    const selfish = T('selfish');
    s.hands.p1[0] = selfish;
    s = play(s, 'p1', selfish);
    expect(tableauOf(s, 'p2').length).toBe(1);
    expect(s.turnPlayerId).toBe('p2');
  });

  it('Flight with several opponents asks whose hand to swap with', () => {
    let s = setup(3);
    const flight = T('flight');
    s.hands.p1[0] = flight;
    s.hands.p3 = [T('spiny'), T('quick')];
    s = play(s, 'p1', flight);
    expect(s.prompt?.kind).toBe('player');
    s = answer(s, { targetPlayerId: 'p3' });
    // p1 got p3's two cards, then stabilized to 5.
    expect(handOf(s, 'p3').map((c) => c.kind).sort()).toEqual(['bark', 'fangs', 'gills', 'leaves']);
  });

  it('Persuasive asks for a colour and everyone discards that colour from hand', () => {
    let s = setup();
    const pers = T('persuasive');
    s.hands.p1[0] = pers;
    s.hands.p2 = [T('fangs'), T('quick'), T('bark')];
    s = play(s, 'p1', pers);
    expect(s.prompt?.kind).toBe('color');
    s = answer(s, { chosenColor: 'red' });
    expect(handOf(s, 'p2').map((c) => c.kind)).toEqual(['bark']);
  });

  it('Cold Blood: draw 3, then the player may decline to play one', () => {
    let s = setup();
    const cb = T('cold-blood');
    s.hands.p1[0] = cb;
    s.traitDeck.unshift(T('bark'), T('leaves'), T('gills'));
    s = play(s, 'p1', cb);
    expect(s.prompt?.kind).toBe('cards');
    expect(s.prompt?.optional).toBe(true);
    s = answer(s, { decline: true });
    expect(tableauOf(s, 'p1').length).toBe(1);
  });

  it('Self-Awareness slips into an opponent’s pile without using up the turn', () => {
    let s = setup();
    const sa = T('self-awareness');
    s.hands.p1[0] = sa;
    s = applyAction(s, { type: 'playOutOfTurn', playerId: 'p1', cardId: sa.id, targetPlayerId: 'p2' });
    expect(tableauOf(s, 'p2').some((c) => c.id === sa.id)).toBe(true);
    expect(s.subPhase).toBe('awaitingAction');
    expect(s.turnPlayerId).toBe('p1');
    expect(computePlayerScore(s, 'p2').total).toBe(-1);
  });

  it('The Third Eye lets only its player see the next age', () => {
    let s = setup();
    const eye = T('the-third-eye');
    s.hands.p1[0] = eye;
    s = play(s, 'p1', eye);
    // "Play another trait" — then stabilize.
    if (s.prompt?.kind === 'cards') s = answer(s, { cardIds: [s.prompt.cardIds[0]!] });
    expect(previewNextAge(s, 'p1')?.id).toBe(s.ageDeck[0]!.id);
    expect(previewNextAge(s, 'p2')).toBeNull();
  });
});

describe('Doomlings — out-of-turn reactions', () => {
  it('Automimicry: a holder is asked, and stopping the Action cancels it', () => {
    let s = setup();
    const intro = T('introspective');
    const mimic = T('automimicry');
    s.hands.p1[0] = intro;
    s.hands.p2[0] = mimic;
    s = play(s, 'p1', intro);
    expect(s.prompt?.kind).toBe('option');
    expect(s.prompt?.playerId).toBe('p2');
    s = answer(s, { optionId: 'automimicry' });
    expect(tableauOf(s, 'p2').some((c) => c.id === mimic.id)).toBe(true);
    // No draw 4: p1 just stabilized from 4 back to 5.
    expect(handOf(s, 'p1').length).toBe(5);
    expect(s.turnPlayerId).toBe('p2');
  });

  it('Parasitic: steal the trait an opponent just played and stop its Action', () => {
    let s = setup();
    const scales = T('iridescent-scales');
    const para = T('parasitic');
    s.hands.p1[0] = scales;
    s.hands.p2[0] = para;
    s = play(s, 'p1', scales);
    expect(s.prompt?.playerId).toBe('p2');
    s = answer(s, { optionId: 'play' });
    expect(tableauOf(s, 'p2').map((c) => c.id).sort()).toEqual([scales.id, para.id].sort());
    expect(tableauOf(s, 'p1').length).toBe(0);
    expect(handOf(s, 'p1').length).toBe(5); // no draw 3
  });

  it('declining the window lets the Action happen', () => {
    let s = setup();
    const scales = T('iridescent-scales');
    s.hands.p1[0] = scales;
    s.hands.p2[0] = T('chromatophores');
    s = play(s, 'p1', scales);
    s = answer(s, { optionId: 'pass' });
    // Drew 3 (4 → 7), then stabilize asks for 2 discards.
    expect(s.prompt?.kind).toBe('cards');
    expect(handOf(s, 'p1').length).toBe(7);
  });
});

describe('Doomlings — ages', () => {
  it('Age of Peace ignores Actions', () => {
    let s = setup();
    s.currentAge = age('ignoreActions');
    const intro = T('introspective');
    s.hands.p1[0] = intro;
    s = play(s, 'p1', intro);
    expect(handOf(s, 'p1').length).toBe(5);
  });

  it('Natural Harmony forbids the colour of the last trait played', () => {
    const s = setup();
    s.currentAge = age('naturalHarmony');
    s.lastPlayedColors = ['red'];
    expect(canPlayTrait(s, 'p1', T('fangs'))).toBe(false);
    expect(canPlayTrait(s, 'p1', T('bark'))).toBe(true);
  });

  it('The Messiah plays the round in reverse order', () => {
    let s = setup(3);
    lastTurn(s, 'p3');
    s.ageDeck.unshift(age('messiah'));
    s = play(s, 'p3', s.hands.p3[0]!);
    expect(s.currentAge.ruleTag).toBe('messiah');
    expect(s.roundOrder).toEqual(['p3', 'p2', 'p1']);
    expect(s.turnPlayerId).toBe('p3');
  });

  it('Prosperity asks whether to stabilize', () => {
    let s = setup();
    s.currentAge = age('prosperity');
    s.hands.p1.push(T('spiny'), T('quick'));
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(s.prompt?.kind).toBe('option');
    s = answer(s, { optionId: 'skip' });
    expect(handOf(s, 'p1').length).toBe(6);
  });
});

describe('Doomlings — catastrophes', () => {
  it('moves the first player left, changes every Gene Pool, and asks for the discards', () => {
    let s = setup();
    lastTurn(s, 'p2');
    s.ageDeck.unshift(cat('superVolcano'));
    s.tableaus.p1 = [T('gills'), T('spiny')]; // 2 blue
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(s.catastrophesSeen).toBe(1);
    expect(s.firstPlayerIndex).toBe(1);
    expect(genePoolOf(s, 'p1')).toBe(4);
    expect(genePoolOf(s, 'p2')).toBe(4);
    expect(s.prompt?.playerId).toBe('p1');
    if (s.prompt?.kind !== 'cards') throw new Error();
    expect(s.prompt.min).toBe(2);
    s = answer(s, { cardIds: s.prompt.cardIds.slice(0, 2) });
    expect(handOf(s, 'p1').length).toBe(3);
    // The catastrophe round starts with the new first player.
    expect(s.turnPlayerId).toBe('p2');
    expect(s.subPhase).toBe('awaitingAction');
  });

  it('Denial ignores the next catastrophe', () => {
    let s = setup();
    lastTurn(s, 'p2');
    s.ageDeck.unshift(cat('superVolcano'));
    s.tableaus.p1 = [T('denial'), T('gills')];
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(genePoolOf(s, 'p1')).toBe(5);
    expect(handOf(s, 'p1').length).toBe(5);
    expect(s.spentDenials.length).toBe(1);
  });

  it('The Big One: gifts are chosen from the original hands, then exchanged together', () => {
    let s = setup(3);
    lastTurn(s, 'p3');
    s.ageDeck.unshift(cat('theBigOne'));
    s = play(s, 'p3', s.hands.p3[0]!);
    const given: number[] = [];
    while (s.prompt && s.prompt.kind === 'cards') {
      const id = s.prompt.cardIds[0]!;
      expect(given).not.toContain(id);
      given.push(id);
      s = answer(s, { cardIds: [id] });
    }
    expect(given.length).toBe(6);
    expect(s.seats.map((x) => handOf(s, x.id).length)).toEqual([5, 5, 5]);
  });

  it('Mega Tsunami passes every hand to the right', () => {
    let s = setup(3);
    lastTurn(s, 'p3');
    s.ageDeck.unshift(cat('megaTsunami'));
    s.hands.p1 = [T('nocturnal')];
    s = play(s, 'p3', s.hands.p3[0]!);
    expect(handOf(s, 'p3').map((c) => c.kind)).toEqual(['nocturnal']);
  });

  it('Optimistic Nihilism skips every turn and age up to the next catastrophe, without stabilizing', () => {
    let s = setup();
    const on = T('optimistic-nihilism');
    s.hands.p1[0] = on;
    s.ageDeck = [age('flourish'), age('noRed'), cat('overpopulation'), ...s.ageDeck.filter((a) => a.ruleTag !== 'flourish' && a.ruleTag !== 'noRed' && a.catastrophe !== 'overpopulation')];
    s = play(s, 'p1', on);
    expect(s.skippedAgeIds.length).toBe(2);
    expect(s.catastrophesSeen).toBe(1);
    expect(s.currentAge.catastrophe).toBe('overpopulation');
    expect(s.turnPlayerId).toBe('p2');
    // p1 never stabilized (4 cards), then drew 1 per colour (Overpopulation: none — Optimistic Nihilism is colorless).
    expect(handOf(s, 'p1').length).toBe(4);
  });
});

describe("Doomlings — World's End & scoring", () => {
  function toWorldsEnd(s: DmState, final: DmCatastropheTag) {
    s.catastrophesSeen = 2;
    lastTurn(s, 'p2');
    s.ageDeck = [cat(final)];
  }

  it('ties are broken by drawing a trait and adding its face value', () => {
    let s = setup();
    toWorldsEnd(s, 'megaTsunami'); // WE: discard a red trait
    s.tableaus.p1 = [T('antlers'), T('nocturnal')];
    s.hands.p2 = [T('nocturnal'), T('fangs'), T('bark'), T('gills'), T('leaves'), T('spiny')];
    s.tableaus.p2 = [T('antlers')];
    s.traitDeck.unshift(T('blubber'), T('gills'));
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(s.phase).toBe('gameOver');
    // Both lost Antlers to Mega Tsunami: 3 v 3. First player is now p2, who draws Blubber (4); p1 draws Gills (1).
    expect(s.worldsEnd?.tiebreak).toEqual({ p2: 4, p1: 1 });
    expect(s.finalScores).toEqual({ p1: 4, p2: 7 });
    expect(s.winnerIds).toEqual(['p2']);
  });

  it('players still tied after the tie-break draw share the win', () => {
    let s = setup();
    toWorldsEnd(s, 'megaTsunami');
    s.tableaus.p1 = [T('nocturnal')];
    s.hands.p2 = [T('nocturnal'), T('fangs'), T('bark'), T('gills'), T('leaves'), T('spiny')];
    s.traitDeck.unshift(T('gills'), T('spiny'));
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(s.winnerIds).toEqual(['p1', 'p2']);
  });

  it("each player picks the order of their World's End effects; trait effects resolve before the catastrophe's", () => {
    let s = setup();
    toWorldsEnd(s, 'iceAge');
    s.tableaus.p1 = [T('viral'), T('sentience'), T('nocturnal'), T('big-ears')];
    s.tableaus.p2 = [T('bark'), T('leaves')];
    s = play(s, 'p2', s.hands.p2[0]!); // p2 plays Antlers (red)
    // Ice Age catastrophic: 1 discard each (p2 has Antlers, p1 has Sentience — both red).
    while (s.prompt?.task.t === 'discardFromHand') s = answer(s, { cardIds: [(s.prompt as { cardIds: number[] }).cardIds[0]!] });
    expect(s.prompt?.kind).toBe('option');
    expect(s.prompt?.task.t).toBe('weTraits');
    s = answer(s, { optionId: String(tableauOf(s, 'p1')[0]!.id) }); // Viral first
    s = answer(s, { chosenColor: 'green' });
    expect(s.prompt?.kind).toBe('color'); // then Sentience
    s = answer(s, { chosenColor: 'purple' });
    expect(s.phase).toBe('gameOver');
    // p2: Antlers 3 + Bark 2 + Leaves 1 = 6, −2 (Viral: 2 green), −1 (Ice Age: 1 red) = 3.
    expect(s.finalScores!.p2).toBe(3);
    // p1: 2 + 2 + 3 + 1 = 8, Sentience +2 (Viral and Nocturnal are… Viral purple, Nocturnal purple, Big Ears purple = 3), Ice Age −1.
    expect(computePlayerScore(s, 'p1').dropOfLifeBonus).toBe(3);
    expect(s.finalScores!.p1).toBe(8 + 3 - 1);
  });

  it("AI Takeover's World's End: non-Dominant colorless traits are worth 2 with no effects", () => {
    let s = setup();
    toWorldsEnd(s, 'aiTakeover');
    s.tableaus.p1 = [T('mindful'), T('fear'), T('confusion')];
    s = play(s, 'p2', s.hands.p2[0]!);
    while (s.prompt) s = answer(s, { cardIds: [(s.prompt as { cardIds: number[] }).cardIds[0]!] });
    expect(s.phase).toBe('gameOver');
    expect(computePlayerScore(s, 'p1')).toMatchObject({ faceValue: 6, dropOfLifeBonus: 0 });
  });

  it('Grey Goo: −5 to everyone tied for the most traits', () => {
    let s = setup();
    toWorldsEnd(s, 'greyGoo');
    s.tableaus.p1 = [T('nocturnal'), T('bark')];
    s.tableaus.p2 = [T('nocturnal')];
    s = play(s, 'p2', s.hands.p2[0]!);
    while (s.prompt) s = answer(s, { cardIds: (s.prompt as { cardIds: number[]; min: number }).cardIds.slice(0, (s.prompt as { min: number }).min) });
    expect(s.finalScores).toEqual({ p1: 5 - 5, p2: 6 - 5 });
  });

  it('Drop of Life bonuses follow the card text', () => {
    const s = setup();
    s.tableaus.p1 = [T('kidney'), T('kidney'), T('kidney'), T('heat-vision'), T('pack-behavior'), T('bark')];
    // Kidneys 3×3 = 9; Heat Vision: 4 red = 4; Pack Behavior: red pairs 2, green 1 pair? (2 green) = 3.
    const sc = computePlayerScore(s, 'p1');
    expect(sc.faceValue).toBe(-1 + 3 + 2);
    expect(sc.dropOfLifeBonus).toBe(9 + 4 + 3);
    s.tableaus.p2 = [T('tiny'), T('bark')];
    expect(computePlayerScore(s, 'p2').total).toBe(17 + 2 - 2);
  });

  it("opponents' hand-content bonuses stay hidden from other viewers", () => {
    const s = setup();
    s.tableaus.p2 = [T('brave')];
    s.hands.p2 = [T('tiny'), T('immunity')];
    expect(computePlayerScore(s, 'p2').dropOfLifeBonus).toBe(4);
    expect(computePlayerScore(s, 'p2', 'p1')).toMatchObject({ dropOfLifeBonus: 0, hiddenBonus: true });
    expect(computePlayerScore(s, 'p2', 'p2').dropOfLifeBonus).toBe(4);
  });
});

describe('Doomlings — AI', () => {
  it('plays full games to World’s End for 2–6 players', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      for (const seed of [11, 23]) {
        const { state, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(CFG, seed * n, makeSeats(n)), 3000);
        expect(stuck).toBe(false);
        expect(state.phase).toBe('gameOver');
        expect(state.catastrophesSeen).toBe(3);
        expect(state.winnerIds.length).toBeGreaterThan(0);
        expect(Object.keys(state.finalScores!).length).toBe(n);
      }
    }
  });

  it('is deterministic', () => {
    const a = playOut({ applyAction, chooseAIAction }, createInitialState(CFG, 4242, makeSeats(4)), 3000).state;
    const b = playOut({ applyAction, chooseAIAction }, createInitialState(CFG, 4242, makeSeats(4)), 3000).state;
    expect(a).toEqual(b);
  });

  it('never reads hidden information: deck order and opponents’ hand contents don’t change its turn', () => {
    let s = createInitialState(CFG, 77, makeSeats(3));
    let checked = 0;
    for (let step = 0; step < 400 && s.phase === 'playing'; step++) {
      const me = s.activePlayerId!;
      if (s.subPhase === 'awaitingAction') {
        const base = chooseAIAction(s, me);
        const alt: DmState = JSON.parse(JSON.stringify(s));
        alt.traitDeck.reverse();
        alt.ageDeck.reverse();
        for (const o of alt.seats.filter((x) => x.id !== me)) {
          // Swap each opponent's hand for deck cards of the same count.
          const n = alt.hands[o.id]!.length;
          const fresh = alt.traitDeck.splice(0, n);
          alt.traitDeck.push(...alt.hands[o.id]!);
          alt.hands[o.id] = fresh;
        }
        expect(chooseAIAction(alt, me)).toEqual(base);
        checked++;
      }
      s = applyAction(s, chooseAIAction(s, me)!);
    }
    expect(checked).toBeGreaterThan(20);
  });
});
