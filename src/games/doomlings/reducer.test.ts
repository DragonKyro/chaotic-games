import { describe, expect, it } from 'vitest';
import { makeSeats, playOut } from '@/core/playout';
import { CLASSIC_AGES, CLASSIC_CATASTROPHES, CLASSIC_TRAITS, classicAgeCards, classicTraitCards, packAgeCards, packTraitCards } from './cards';
import { chooseAIAction } from './ai';
import { doomlingsModule } from './module';
import {
  applyAction,
  canPlayTrait,
  classBonusOf,
  computePlayerScore,
  createInitialState,
  genePoolOf,
  handOf,
  outOfTurnPlays,
  previewNextAge,
  tableauOf,
  usableCards,
  visibleDeckTop,
} from './reducer';
import { DM_BUILT_EXPANSIONS, DM_EXPANSIONS } from './types';
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

  it('lists the nine published sets in the sources; only built ones can be enabled; Ancient Fates (invented) is gone', () => {
    expect(DM_EXPANSIONS.map((e) => e.id)).toEqual([
      'castle-glass', 'overlush', 'imaginary-ends', 'magical-merchants', 'legends-of-enderas', 'mokoko-village', 'shadow-puppets', 'nightflower-island',
      'upgrade', 'special-edition',
    ]);
    for (const e of DM_EXPANSIONS) expect(e.verified).toBe(DM_BUILT_EXPANSIONS.includes(e.id as never));
    expect(doomlingsModule.validateConfig({ expansions: [] })).toEqual([]);
    expect(doomlingsModule.validateConfig({ expansions: ['castle-glass', 'overlush', 'imaginary-ends'] })).toEqual([]);
    expect(doomlingsModule.validateConfig({ expansions: ['magical-merchants'] }).length).toBe(1);
    expect(doomlingsModule.validateConfig({ expansions: ['legends-of-enderas'] }).length).toBe(1);
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

// ============================================================================
// Castle Glass
// ============================================================================

describe('Doomlings — Castle Glass', () => {
  const CG_CARDS = packTraitCards('castle-glass', 3000);
  const CG_AGES = packAgeCards('castle-glass', 3500);
  const CGCFG = { expansions: ['castle-glass'] };

  /** A fresh copy of a Castle Glass trait with a unique id. */
  function C(kind: DmTraitKind): DmTraitCard {
    const c = CG_CARDS.find((x) => x.kind === kind);
    if (!c) throw new Error(`no Castle Glass trait ${kind}`);
    return { ...c, id: nextId++ };
  }

  /** setup(), plus a deck of effectless fillers so stabilizing never draws a surprise. */
  function cg(n = 2, seed = 7): DmState {
    const s = setup(n, seed);
    s.traitDeck = Array.from({ length: 40 }, (_, i) => T((['antlers', 'bark', 'gills', 'leaves'] as const)[i % 4]!));
    return s;
  }

  const kinds = (cards: DmTraitCard[]) => cards.map((c) => c.kind);

  it('has its 40 numbered cards: 30 traits, 7 Dominants, 2 Ages, 1 Catastrophe — Special Edition Luminous / Radiant left out', () => {
    expect(CG_CARDS.length).toBe(37);
    expect(CG_CARDS.filter((c) => c.dominant).length).toBe(7);
    expect(CG_AGES.ages.map((a) => a.name)).toEqual(['Castle Glass', 'Magic Hour']);
    expect(CG_AGES.catastrophes.map((a) => [a.name, a.genePoolDelta])).toEqual([['Still Water', -2]]);
    expect(CG_CARDS.some((c) => c.name === 'Luminous' || c.name === 'Radiant')).toBe(false);
    // Spot checks against the card data.
    expect(C('keystone')).toMatchObject({ points: 5, color: 'purple', dominant: true, cls: 'coral', tier: 'exotic' });
    expect(C('resplendent')).toMatchObject({ color: 'blue', secondaryColor: 'green', genePoolDelta: 1, cls: 'fish', tier: 'exotic' });
    expect(C('glass-predator')).toMatchObject({ points: -3, action: true, cls: 'fish' });
    expect(C('fish-collector').cls).toBeUndefined();
    expect(C('sunny').cls).toBeUndefined();
  });

  it('is shuffled into the Classic decks', () => {
    const s = createInitialState(CGCFG, 3, makeSeats(4));
    const all = [...s.traitDeck, ...s.seats.flatMap((x) => handOf(s, x.id))];
    expect(all.length).toBe(116 + 37);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    let sawCgAge = false;
    for (let seed = 1; seed <= 30 && !sawCgAge; seed++) {
      const t = createInitialState(CGCFG, seed, makeSeats(3));
      expect(t.ageDeck.length).toBe(12);
      sawCgAge = t.ageDeck.some((a) => a.source === 'castle-glass');
    }
    expect(sawCgAge).toBe(true);
    // Without the pack nothing changes.
    expect(createInitialState(CFG, 3, makeSeats(4)).traitDeck.some((c) => c.source === 'castle-glass')).toBe(false);
  });

  it('class bonuses score like the rules card’s examples', () => {
    const s = cg();
    const bonus = (...cards: DmTraitCard[]) => {
      s.tableaus.p1 = cards;
      return classBonusOf(s, 'p1');
    };
    expect(bonus(C('glossy'), C('biochromatic'))).toBe(0); // Shell + Coral
    expect(bonus(C('glossy'), C('striated'), C('brainy'))).toBe(2); // Shell + Shell + Coral
    expect(bonus(C('glossy'), C('porous'), C('sandy'))).toBe(6); // Shell + Curious Shell + Exotic Shell
    expect(bonus(C('biochromatic'), C('harboring'), C('glossy'), C('sandy'))).toBe(7); // Coral + Curious Coral, Shell + Exotic Shell
    s.tableaus.p1 = [C('glossy'), C('porous'), C('sandy')];
    expect(computePlayerScore(s, 'p1')).toMatchObject({ faceValue: 3, classBonus: 6, total: 9 });
  });

  it('Mucous Coating is +3 with a Coral in your pile', () => {
    const s = cg();
    s.tableaus.p1 = [C('mucous-coating')];
    expect(computePlayerScore(s, 'p1').dropOfLifeBonus).toBe(0);
    s.tableaus.p1.push(C('tabular'));
    expect(computePlayerScore(s, 'p1').dropOfLifeBonus).toBe(3);
  });

  it('Brainy: opponents can’t play purple on their next turn, and only then', () => {
    let s = cg();
    const brainy = C('brainy');
    s.hands.p1[0] = brainy;
    s.hands.p2 = [T('adorable'), T('bark'), T('gills'), T('leaves'), T('fangs')];
    s = play(s, 'p1', brainy);
    expect(s.turnPlayerId).toBe('p2');
    expect(canPlayTrait(s, 'p2', handOf(s, 'p2')[0]!)).toBe(false); // purple Adorable
    expect(() => play(s, 'p2', handOf(s, 'p2')[0]!)).toThrow(/Brainy/);
    s = play(s, 'p2', handOf(s, 'p2')[1]!);
    expect(s.turnBans).toEqual([]);
  });

  it('Guanine Crystals: draw 2 instead of stabilizing; Harboring: stabilize to 6', () => {
    let s = cg();
    s.hands.p1[0] = C('guanine-crystals');
    s.hands.p1.push(T('fangs'), T('fangs')); // 7 cards
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(s.turnPlayerId).toBe('p2');
    expect(handOf(s, 'p1').length).toBe(8); // 6 left + 2, no discards

    let t = cg();
    t.hands.p1[0] = C('harboring');
    t = play(t, 'p1', t.hands.p1[0]!);
    expect(handOf(t, 'p1').length).toBe(6);
    expect(genePoolOf(t, 'p1')).toBe(5);
  });

  it('Countershading can be played instead of stabilizing', () => {
    let s = cg();
    const cs = C('countershading');
    s.hands.p1.push(cs, T('fangs')); // 7 cards
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(s.prompt?.kind).toBe('option');
    if (s.prompt?.kind !== 'option') throw new Error();
    expect(s.prompt.options.map((o) => o.id)).toEqual(['stabilize', 'countershading']);
    s = answer(s, { optionId: 'countershading' });
    expect(tableauOf(s, 'p1').map((c) => c.id)).toContain(cs.id);
    expect(handOf(s, 'p1').length).toBe(5); // 7 − 2 played, never stabilized
    expect(s.turnPlayerId).toBe('p2');
  });

  it('Spiny Fins discards the trait it plays; Spiral Motion returns it, and only once a turn', () => {
    let s = cg();
    s.hands.p1[0] = C('spiny-fins');
    const bark = s.hands.p1[1]!;
    s = play(s, 'p1', s.hands.p1[0]!);
    s = answer(s, { cardIds: [bark.id] });
    expect(kinds(tableauOf(s, 'p1'))).toEqual(['spiny-fins']);
    expect(s.traitDiscard.map((c) => c.id)).toContain(bark.id);

    let t = cg();
    const [m1, m2] = [C('spiral-motion'), C('spiral-motion')];
    t.hands.p1 = [m1, m2, T('bark'), T('fangs'), T('gills')];
    t = play(t, 'p1', m1);
    t = answer(t, { cardIds: [m2.id] }); // its own Spiral Motion effect is ignored this turn
    expect(kinds(tableauOf(t, 'p1'))).toEqual(['spiral-motion']);
    expect(handOf(t, 'p1').map((c) => c.id)).toContain(m2.id);
    expect(t.turnPlayerId).toBe('p2');
  });

  it('Fish Collector steals face-value-1 traits from up to two different piles, and may stop', () => {
    let s = cg(3);
    const [leaves, fangs, gills] = [T('leaves'), T('fangs'), T('gills')];
    s.tableaus.p2 = [leaves, fangs, T('bark')];
    s.tableaus.p3 = [gills];
    s.hands.p1[0] = C('fish-collector');
    s = play(s, 'p1', s.hands.p1[0]!);
    if (s.prompt?.kind !== 'trait') throw new Error('expected a trait prompt');
    expect(s.prompt.optional).toBe(true);
    expect(s.prompt.targets.map((t) => t.cardId).sort()).toEqual([leaves.id, fangs.id, gills.id].sort());
    s = answer(s, { targetCardId: leaves.id });
    if (s.prompt?.kind !== 'trait') throw new Error('expected a second pick');
    expect(s.prompt.targets.map((t) => t.cardId)).toEqual([gills.id]); // a different pile
    s = answer(s, { decline: true });
    expect(kinds(tableauOf(s, 'p1'))).toEqual(['fish-collector', 'leaves']);
    expect(tableauOf(s, 'p3').length).toBe(1);
  });

  it('Pip plays every trait of the chosen face value (ignoring Actions); Pearl one trait per colour', () => {
    let s = cg();
    s.hands.p1 = [C('pip'), T('bark'), T('hot-temper'), T('leaves'), T('deep-roots')];
    s = play(s, 'p1', s.hands.p1[0]!);
    if (s.prompt?.kind !== 'option') throw new Error('expected the face-value choice');
    expect(s.prompt.options.map((o) => o.id)).toEqual(['1', '2']);
    s = answer(s, { optionId: '2' });
    // Bark, Hot Temper (its discard Action ignored) and Deep Roots; Leaves stays.
    expect(kinds(tableauOf(s, 'p1')).sort()).toEqual(['bark', 'deep-roots', 'hot-temper', 'pip']);
    expect(s.turnPlayerId).toBe('p2');

    let t = cg();
    const [antlers, bark, fangs, gills] = [T('antlers'), T('bark'), T('fangs'), T('gills')];
    t.hands.p1 = [C('pearl'), antlers, bark, fangs, gills];
    t = play(t, 'p1', t.hands.p1[0]!);
    t = answer(t, { cardIds: [antlers.id] });
    if (t.prompt?.kind !== 'cards') throw new Error('expected another Pearl pick');
    expect(t.prompt.cardIds.sort()).toEqual([bark.id, gills.id].sort()); // red is used up
    t = answer(t, { decline: true });
    expect(kinds(tableauOf(t, 'p1'))).toEqual(['pearl', 'antlers']);
  });

  it('Sandy sends the next age to the bottom; Natural Symmetry lets everyone preview it', () => {
    let s = cg();
    const next = s.ageDeck[0]!;
    s.hands.p1[0] = C('sandy');
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(s.ageDeck[s.ageDeck.length - 1]!.id).toBe(next.id);
    expect(s.ageDeck[0]!.id).not.toBe(next.id);

    let t = cg(3);
    t.hands.p1[0] = C('natural-symmetry');
    t = play(t, 'p1', t.hands.p1[0]!);
    for (const p of ['p1', 'p2', 'p3']) expect(previewNextAge(t, p)?.id).toBe(t.ageDeck[0]!.id);
  });

  it('“Play at any time” traits are free plays that don’t use up the turn; Sunny stabilizes to 8', () => {
    let s = cg();
    const glass = C('sea-glass');
    const sunny = C('sunny');
    s.hands.p1 = [glass, sunny, T('bark'), T('fangs'), T('gills')];
    expect(outOfTurnPlays(s, 'p1').map((c) => c.kind)).toEqual(['sea-glass', 'sunny']);
    expect(() => applyAction(s, { type: 'playOutOfTurn', playerId: 'p1', cardId: glass.id, targetPlayerId: 'p2' })).toThrow(/own pile/);
    s = applyAction(s, { type: 'playOutOfTurn', playerId: 'p1', cardId: glass.id, targetPlayerId: 'p1' });
    expect(s.turnPlayerId).toBe('p1');
    expect(s.subPhase).toBe('awaitingAction');
    s = applyAction(s, { type: 'playOutOfTurn', playerId: 'p1', cardId: sunny.id, targetPlayerId: 'p1' });
    expect(handOf(s, 'p1').length).toBe(8);
    expect(kinds(tableauOf(s, 'p1'))).toEqual(['sea-glass', 'sunny']);
    expect(s.turnPlayerId).toBe('p1');
  });

  it('Conchomancy and Sea Glass are offered again right after you stabilize', () => {
    let s = cg();
    const conch = C('conchomancy');
    s.hands.p1.push(conch);
    s = play(s, 'p1', s.hands.p1[0]!);
    if (s.prompt?.kind !== 'option' || s.prompt.task.t !== 'late') throw new Error('expected the after-stabilize window');
    s = answer(s, { optionId: `play:${conch.id}` });
    expect(kinds(tableauOf(s, 'p1'))).toContain('conchomancy');
    expect(previewNextAge(s, 'p1')).not.toBeNull();
    expect(s.turnPlayerId).toBe('p2');
  });

  it('Still Water: everyone draws 3, nobody stabilizes that round; World’s End +8 at Gene Pool 1', () => {
    let s = cg();
    lastTurn(s, 'p2');
    s.ageDeck.unshift(CG_AGES.catastrophes[0]!);
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(s.currentAge.catastrophe).toBe('stillWater');
    expect(genePoolOf(s, 'p1')).toBe(3);
    expect(s.turnPlayerId).toBe('p2');
    const before = handOf(s, 'p2').length;
    s = play(s, 'p2', handOf(s, 'p2')[0]!);
    expect(handOf(s, 'p2').length).toBe(before - 1);
    expect(s.turnPlayerId).toBe('p1');

    const t = cg();
    t.genePool.p1 = 1;
    t.worldsEnd = { effect: 'stillWater', resolved: [], chosenColor: {}, colorChange: { p1: null, p2: null }, deusDraws: {}, tiebreak: {}, chosenPlayer: {} };
    expect(computePlayerScore(t, 'p1').worldsEndBonus).toBe(8);
    expect(computePlayerScore(t, 'p2').worldsEndBonus).toBe(0);
  });

  it('the Castle Glass age can’t discard class cards; Magic Hour lets each player choose', () => {
    let s = cg();
    lastTurn(s, 'p2');
    s.ageDeck.unshift(CG_AGES.ages[0]!, CG_AGES.ages[1]!);
    const [glossy, striated] = [C('glossy'), C('striated')];
    s.hands.p1 = [glossy, striated, T('bark'), T('fangs'), T('gills')];
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(s.currentAge.ruleTag).toBe('castleGlass');
    if (s.prompt?.kind !== 'cards' || s.prompt.playerId !== 'p1') throw new Error('expected p1 to discard');
    expect(s.prompt.cardIds).not.toContain(glossy.id);
    expect(s.prompt.cardIds).not.toContain(striated.id);
    s = answer(s, { cardIds: s.prompt.cardIds.slice(0, 2) });
    expect(handOf(s, 'p1').length).toBe(5);
    expect(handOf(s, 'p1').map((c) => c.id)).toEqual(expect.arrayContaining([glossy.id, striated.id]));

    let t = cg();
    lastTurn(t, 'p2');
    t.ageDeck.unshift(CG_AGES.ages[1]!);
    t.genePool.p1 = 3;
    t = play(t, 'p2', t.hands.p2[0]!);
    expect(t.prompt?.task.t).toBe('magicHour');
    t = answer(t, { optionId: 'gp5' });
    expect(genePoolOf(t, 'p1')).toBe(5);
    const h2 = handOf(t, 'p2').length;
    t = answer(t, { optionId: 'draw' });
    expect(handOf(t, 'p2').length).toBe(h2 + 2);
  });

  it('Thermal Tolerance counts the red traits of the opponent chosen at World’s End', () => {
    let s = cg(3);
    s.catastrophesSeen = 2;
    lastTurn(s, 'p3');
    s.ageDeck = [cat('greyGoo')];
    s.tableaus.p1 = [C('thermal-tolerance')];
    s.tableaus.p2 = [T('antlers')];
    s.tableaus.p3 = [T('antlers'), T('fangs'), T('quick')];
    s = play(s, 'p3', s.hands.p3[1]!); // Bark, not a red trait
    // Grey Goo first makes everyone discard and stabilize; then p1 chooses whose pile counts.
    while (s.prompt && s.prompt.task.t !== 'pickPlayer') s = applyAction(s, chooseAIAction(s, s.activePlayerId!)!);
    if (s.prompt?.kind !== 'player') throw new Error('expected the opponent choice');
    expect(s.prompt.playerIds.sort()).toEqual(['p2', 'p3']);
    s = answer(s, { targetPlayerId: 'p3' });
    expect(s.phase).toBe('gameOver');
    expect(computePlayerScore(s, 'p1').dropOfLifeBonus).toBe(3);
  });

  it('Radial Symmetry: at the start of your turn you may discard every card of one colour', () => {
    let s = cg();
    s.tableaus.p2 = [C('radial-symmetry')];
    s.hands.p2 = [T('antlers'), T('fangs'), T('bark'), T('gills'), T('leaves')];
    s = play(s, 'p1', s.hands.p1[0]!);
    if (s.prompt?.kind !== 'color' || s.prompt.playerId !== 'p2') throw new Error('expected the colour choice');
    expect(s.prompt.optional).toBe(true);
    s = answer(s, { chosenColor: 'red' });
    expect(kinds(handOf(s, 'p2'))).toEqual(['bark', 'gills', 'leaves']);
    expect(s.subPhase).toBe('awaitingAction');
  });

  it('Benthic trades a card for another play; Fragmentation stabilizes to 4 first; Glass Predator steals then plays', () => {
    let s = cg();
    s.hands.p1 = [C('benthic'), T('bark'), T('fangs'), T('gills'), T('leaves')];
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(s.prompt?.task.t).toBe('benthic');
    s = answer(s, { cardIds: [handOf(s, 'p1')[1]!.id] }); // Fangs
    s = answer(s, { cardIds: [handOf(s, 'p1')[0]!.id] }); // Bark
    expect(kinds(tableauOf(s, 'p1'))).toEqual(['benthic', 'bark']);

    let t = cg();
    t.hands.p1 = [C('fragmentation'), T('bark'), T('fangs'), T('gills'), T('leaves'), T('spiny'), T('quick')];
    t = play(t, 'p1', t.hands.p1[0]!);
    if (t.prompt?.kind !== 'cards') throw new Error('expected the stabilize-to-4 discard');
    expect(t.prompt.min).toBe(2);
    t = answer(t, { cardIds: t.prompt.cardIds.slice(0, 2) });
    expect(t.prompt?.task.t).toBe('playAnother');

    let g = cg();
    g.tableaus.p2 = [T('blubber')];
    g.hands.p1[0] = C('glass-predator');
    g = play(g, 'p1', g.hands.p1[0]!);
    expect(kinds(tableauOf(g, 'p1'))).toEqual(['glass-predator', 'blubber']);
    expect(g.prompt?.task.t).toBe('playAnother');
  });

  it('Biochromatic: opponents discard their colorless cards and stabilize; Crystal Skeleton: everyone sheds Dominants', () => {
    let s = cg();
    s.hands.p1[0] = C('biochromatic');
    s.hands.p2 = [T('fear'), T('flatulence'), T('bark'), T('fangs'), T('gills')];
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(handOf(s, 'p2').length).toBe(5);
    expect(handOf(s, 'p2').some((c) => c.kind === 'fear' || c.kind === 'flatulence')).toBe(false);

    let t = cg();
    t.hands.p1 = [C('crystal-skeleton'), T('tiny'), T('bark'), T('fangs'), T('gills')];
    t.hands.p2 = [T('immunity'), T('heroic'), T('bark'), T('fangs'), T('gills')];
    t = play(t, 'p1', t.hands.p1[0]!);
    for (const p of ['p1', 'p2']) expect(handOf(t, p).some((c) => c.dominant)).toBe(false);
    expect(handOf(t, 'p2').length).toBe(5);
  });

  it('Opulent and Resplendent play another trait when they enter, even in the Age of Peace', () => {
    let s = cg();
    s.currentAge = age('ignoreActions');
    s.hands.p1 = [C('opulent'), T('bark'), T('fangs'), T('gills'), T('leaves')];
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(handOf(s, 'p1').length).toBe(5); // 4 + drew 1
    expect(s.prompt?.task.t).toBe('playAnother');
  });

  it('the AI plays full Castle Glass games for 2–6 players', () => {
    for (const n of [2, 3, 4, 5, 6]) {
      const { state, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(CGCFG, 900 + n, makeSeats(n)), 4000);
      expect(stuck).toBe(false);
      expect(state.phase).toBe('gameOver');
      expect(state.catastrophesSeen).toBe(3);
    }
  });
});

// ============================================================================
// Overlush
// ============================================================================

describe('Doomlings — Overlush', () => {
  const OV_CARDS = packTraitCards('overlush', 6000);
  const OV_AGES = packAgeCards('overlush', 6500);
  const OVCFG = { expansions: ['overlush'] };

  /** A fresh copy of an Overlush trait with a unique id. */
  function O(kind: DmTraitKind): DmTraitCard {
    const c = OV_CARDS.find((x) => x.kind === kind);
    if (!c) throw new Error(`no Overlush trait ${kind}`);
    return { ...c, id: nextId++ };
  }
  const ovAge = (tag: DmAgeCard['ruleTag']) => OV_AGES.ages.find((a) => a.ruleTag === tag)!;
  const ovCat = (tag: DmCatastropheTag) => OV_AGES.catastrophes.find((a) => a.catastrophe === tag)!;

  /** setup(), plus a deck of effectless fillers. */
  function ov(n = 2, seed = 7): DmState {
    const s = setup(n, seed);
    s.traitDeck = Array.from({ length: 40 }, (_, i) => T((['antlers', 'bark', 'gills', 'leaves'] as const)[i % 4]!));
    return s;
  }
  const kinds = (cards: DmTraitCard[]) => cards.map((c) => c.kind);

  it('has the whole collection, and each game draws 40 traits, 8 Dominants, 8 Ages and 4 Catastrophes from it', () => {
    expect(OV_CARDS.length).toBe(146);
    expect(OV_CARDS.filter((c) => c.dominant).length).toBe(35);
    expect(OV_CARDS.filter((c) => c.kind === 'kidney').map((c) => c.color)).toEqual(['green', 'green', 'green', 'green', 'green']);
    expect(new Set(OV_CARDS.filter((c) => c.kind === 'swarm').map((c) => c.color)).size).toBe(5);
    expect(OV_AGES.ages.length).toBe(28);
    expect(OV_AGES.catastrophes.length).toBe(15);
    expect(O('epic')).toMatchObject({ points: 10, color: 'red', dominant: true });
    expect(O('indomitable')).toMatchObject({ points: 8, genePoolDelta: -2, dominant: true });
    expect(ovCat('algalSuperbloom').genePoolDelta).toBe(0);
    for (const seed of [1, 2]) {
      const s = createInitialState(OVCFG, seed, makeSeats(3));
      const all = [...s.traitDeck, ...s.seats.flatMap((x) => handOf(s, x.id))];
      const mine = all.filter((c) => c.source === 'overlush');
      expect(mine.length).toBe(48);
      expect(mine.filter((c) => c.dominant).length).toBe(8);
      expect(all.length).toBe(116 + 48);
      expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    }
  });

  it('Dart, Quills and Patches answer an opponent taking a trait from your pile', () => {
    let s = ov();
    const fangs = T('fangs');
    const [dart, quills] = [O('dart'), O('quills')];
    s.tableaus.p2 = [fangs];
    s.hands.p2 = [dart, quills, T('bark'), T('gills'), T('leaves')];
    s.hands.p1[0] = T('selfish');
    s = play(s, 'p1', s.hands.p1[0]!);
    if (s.prompt?.kind !== 'option' || s.prompt.task.t !== 'removalWindow') throw new Error('expected the removal window');
    expect(s.prompt.playerId).toBe('p2');
    s = answer(s, { optionId: `quills:${quills.id}` });
    expect(kinds(tableauOf(s, 'p1'))).toEqual(['selfish', 'fangs', 'quills']);
    s = answer(s, { optionId: `play:${dart.id}` });
    expect(kinds(tableauOf(s, 'p2'))).toEqual(['dart']);

    let t = ov();
    const patches = O('patches');
    t.tableaus.p2 = [T('fangs')];
    t.hands.p2 = [patches, T('bark'), T('gills'), T('leaves'), T('spiny')];
    t.hands.p1[0] = T('selfish');
    t = play(t, 'p1', t.hands.p1[0]!);
    t = answer(t, { optionId: `patches:${patches.id}` });
    expect(kinds(tableauOf(t, 'p2')).sort()).toEqual(['fangs', 'patches']);
    expect(kinds(tableauOf(t, 'p1'))).toEqual(['selfish']);
  });

  it('Dart can’t be played on your own turn; Patches can’t undo a Dominant’s removal', () => {
    const s = ov();
    s.hands.p1 = [O('dart'), T('bark')];
    expect(canPlayTrait(s, 'p1', s.hands.p1[0]!)).toBe(false);
    let t = ov(2);
    t.catastrophesSeen = 2;
    lastTurn(t, 'p2');
    t.ageDeck = [cat('greyGoo')];
    t.tableaus.p2 = [O('chompers')];
    t.tableaus.p1 = [T('bark')];
    t = play(t, 'p2', t.hands.p2[0]!);
    // Grey Goo makes everyone discard and stabilize, then Chompers eats p1's effectless Bark.
    while (t.prompt) t = applyAction(t, chooseAIAction(t, t.activePlayerId!)!);
    expect(t.phase).toBe('gameOver');
    expect(tableauOf(t, 'p1').length).toBe(0);
  });

  it('Pinchy stops an opponent’s play: the trait goes to your hand, and they may play another', () => {
    let s = ov();
    const pinchy = O('pinchy');
    const melons = T('tiny-little-melons');
    s.hands.p2 = [pinchy, T('bark'), T('gills'), T('leaves'), T('spiny')];
    s.tableaus.p2 = [T('leaves')];
    s.hands.p1[0] = melons;
    s = play(s, 'p1', melons);
    expect(s.prompt?.task.t).toBe('parasiticWindow');
    s = answer(s, { optionId: 'pinchy' });
    expect(handOf(s, 'p2').map((c) => c.id)).toContain(melons.id);
    expect(kinds(tableauOf(s, 'p2'))).toEqual(['leaves', 'pinchy']); // Melons' steal never happened
    expect(s.prompt?.task.t).toBe('playAnother');
    expect(s.prompt?.playerId).toBe('p1');
  });

  it('Snap-Trap steals one of the traits an opponent played once they play a 2nd', () => {
    let s = ov();
    const trap = O('snap-trap');
    s.hands.p2 = [trap, T('bark'), T('gills'), T('leaves'), T('spiny')];
    const [prop, blubber] = [T('propagation'), T('blubber')];
    s.hands.p1 = [prop, blubber, T('fangs'), T('gills'), T('leaves')];
    s = play(s, 'p1', prop);
    s = answer(s, { cardIds: [blubber.id] });
    expect(s.prompt?.task.t).toBe('snapTrap');
    s = answer(s, { optionId: `play:${trap.id}` });
    if (s.prompt?.kind !== 'trait') throw new Error('expected the steal');
    expect(s.prompt.targets.map((t) => t.cardId).sort()).toEqual([prop.id, blubber.id].sort());
    s = answer(s, { targetCardId: blubber.id });
    expect(kinds(tableauOf(s, 'p2'))).toEqual(['snap-trap', 'blubber']);
  });

  it('Elusive can be played when it reaches your hand on an opponent’s turn; Muse when it is discarded', () => {
    let s = ov();
    const elusive = O('elusive');
    s.hands.p1 = [T('doting'), elusive];
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(s.prompt?.task.t).toBe('elusive');
    expect(s.prompt?.playerId).toBe('p2');
    s = answer(s, { optionId: 'play' });
    expect(kinds(tableauOf(s, 'p2'))).toEqual(['elusive']);

    let t = ov();
    const muse = O('muse');
    t.hands.p2 = [muse, T('bark')];
    t.hands.p1[0] = T('bad');
    t = play(t, 'p1', t.hands.p1[0]!);
    expect(t.prompt?.task.t).toBe('muse');
    t = answer(t, { optionId: 'play' });
    expect(kinds(tableauOf(t, 'p2'))).toEqual(['muse']);
  });

  it('Procrastination takes another turn after the last turn of the round', () => {
    let s = ov();
    lastTurn(s, 'p2');
    const proc = O('procrastination');
    s.hands.p1.push(proc);
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(s.prompt?.task.t).toBe('procrastination');
    s = answer(s, { optionId: `play:${proc.id}` });
    expect(s.turnPlayerId).toBe('p1');
    expect(s.subPhase).toBe('awaitingAction');
    const ageBefore = s.currentAge.id;
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(s.currentAge.id).not.toBe(ageBefore); // then the next age
  });

  it('Sleepy ignores a catastrophe’s Gene Pool effect', () => {
    let s = ov();
    lastTurn(s, 'p2');
    s.ageDeck.unshift(cat('superVolcano'));
    s.hands.p1.push(O('sleepy'));
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(s.prompt?.task.t).toBe('sleepyWindow');
    if (s.prompt?.kind !== 'option') throw new Error('expected the Sleepy choice');
    s = answer(s, { optionId: s.prompt.options[0]!.id });
    expect(genePoolOf(s, 'p1')).toBe(5);
    expect(genePoolOf(s, 'p2')).toBe(4);
  });

  it('Age of Certainty flips the deck: its next card is face up and is the one drawn', () => {
    let s = ov();
    s.currentAge = ovAge('certainty');
    const next = visibleDeckTop(s)!;
    expect(next.id).toBe(s.traitDeck[s.traitDeck.length - 1]!.id);
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(handOf(s, 'p1').map((c) => c.id)).toContain(next.id);
  });

  it('Star Tails: draw 3, then no more drawing this round', () => {
    let s = ov();
    lastTurn(s, 'p2');
    s.ageDeck.unshift(ovAge('starTails'));
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(handOf(s, 'p1').length).toBe(8);
    s.hands.p1 = [T('bark')];
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(handOf(s, 'p1').length).toBe(0);
  });

  it('Ramblin’ River Markets bans a colour for you and the player on your left', () => {
    let s = ov(3);
    lastTurn(s, 'p3');
    s.ageDeck.unshift(ovAge('ramblinRiver'));
    s = play(s, 'p3', s.hands.p3[0]!);
    s = answer(s, { chosenColor: 'red' }); // p1
    s = answer(s, { chosenColor: 'blue' }); // p2
    s = answer(s, { chosenColor: 'green' }); // p3
    expect(canPlayTrait(s, 'p1', T('fangs'))).toBe(false); // p1's own red
    expect(canPlayTrait(s, 'p2', T('fangs'))).toBe(false); // left of p1
    expect(canPlayTrait(s, 'p3', T('gills'))).toBe(false); // left of p2
    expect(canPlayTrait(s, 'p1', T('bark'))).toBe(false); // left of p3
    expect(canPlayTrait(s, 'p3', T('fangs'))).toBe(true);
  });

  it('King of the Jungle: only the single highest card keeps its hand', () => {
    let s = ov();
    lastTurn(s, 'p2');
    s.ageDeck.unshift(ovAge('kingOfTheJungle'));
    s.hands.p1 = [T('blubber'), T('bark'), T('gills'), T('leaves'), T('spiny')];
    s = play(s, 'p2', s.hands.p2[0]!);
    const kept = handOf(s, 'p1').map((c) => c.id);
    s = answer(s, { cardIds: [s.hands.p1[0]!.id] }); // Blubber (4)
    s = answer(s, { cardIds: [handOf(s, 'p2')[0]!.id] }); // Bark (2)
    expect(handOf(s, 'p1').map((c) => c.id)).toEqual(kept);
    expect(handOf(s, 'p2').length).toBe(3);
  });

  it('Psychedelic restarts the age with you as first player — once', () => {
    let s = ov(3);
    s.roundOrder = ['p1', 'p2', 'p3'];
    s.turnIndex = 1;
    s.turnPlayerId = 'p2';
    s.activePlayerId = 'p2';
    const [ps1, ps2] = [O('psychedelic'), O('psychedelic')];
    s.hands.p2 = [ps1, ps2, T('bark'), T('gills'), T('leaves')];
    s = play(s, 'p2', ps1);
    expect(s.firstPlayerIndex).toBe(1);
    expect(s.roundOrder).toEqual(['p2', 'p3', 'p1']);
    expect(s.turnPlayerId).toBe('p2');
    expect(s.subPhase).toBe('awaitingAction');
    s = play(s, 'p2', ps2);
    expect(s.turnPlayerId).toBe('p3'); // no second restart
  });

  it('a paid "to play" cost meets its requirement (Morality may give away your only positive trait)', () => {
    let s = ov();
    const blubber = T('blubber');
    s.tableaus.p1 = [blubber, T('confusion')];
    s.hands.p1[0] = T('morality');
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(kinds(tableauOf(s, 'p1')).sort()).toEqual(['confusion', 'morality']);
    expect(tableauOf(s, 'p2').map((c) => c.id)).toEqual([blubber.id]);
  });

  it('Epic takes both Dominant slots; Opposable Thumbs becomes a copy of your other Dominant', () => {
    let s = ov();
    s.hands.p1 = [O('epic'), T('tiny'), T('bark'), T('gills'), T('leaves')];
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(canPlayTrait(s, 'p1', T('tiny'))).toBe(false);
    const t = ov();
    t.tableaus.p1 = [T('tiny')];
    expect(canPlayTrait(t, 'p1', O('epic'))).toBe(false);
    let u = ov();
    u.tableaus.p1 = [T('immunity')];
    u.hands.p1[0] = O('opposable-thumbs');
    u = play(u, 'p1', u.hands.p1[0]!);
    const copy = tableauOf(u, 'p1')[1]!;
    expect(copy).toMatchObject({ kind: 'immunity', points: 4, dominant: true, copyOf: 'Immunity' });
  });

  it('Ironwood and Meek keep your green / red traits from being removed', () => {
    let s = ov();
    s.tableaus.p2 = [O('ironwood'), T('leaves'), T('fangs')];
    s.hands.p1[0] = T('tiny-little-melons');
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(tableauOf(s, 'p2').length).toBe(3);
    let t = ov();
    t.tableaus.p2 = [O('meek'), T('fangs')];
    t.hands.p1[0] = T('selfish');
    t = play(t, 'p1', t.hands.p1[0]!);
    expect(tableauOf(t, 'p2').length).toBe(2);
  });

  it('scores Sparkles, Prowler, Mutualism, Constrictor and the two-colour bonuses', () => {
    let s = ov();
    s.tableaus.p1 = [O('sparkles'), T('egg-clusters')];
    s.hands.p1 = [T('gills'), T('spiny')];
    expect(computePlayerScore(s, 'p1').dropOfLifeBonus).toBe(3);
    expect(computePlayerScore(s, 'p1', 'p2')).toMatchObject({ dropOfLifeBonus: 1, hiddenBonus: true });
    s.tableaus.p1 = [O('prowler')]; // purple
    s.tableaus.p2 = [T('bark')];
    expect(computePlayerScore(s, 'p2').dropOfLifeBonus).toBe(-2);
    s.tableaus.p1 = [O('sweet'), T('bark'), T('leaves'), T('gills')]; // Sweet is blue/green: 3 green, 2 blue
    expect(computePlayerScore(s, 'p1').dropOfLifeBonus).toBe(2);
    s.hands.p1[0] = O('mutualism');
    s.tableaus.p1 = [];
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(genePoolOf(s, 'p2')).toBe(6);
    expect(computePlayerScore(s, 'p1').dropOfLifeBonus).toBe(6);
    let t = ov(3);
    t.hands.p1[0] = O('constrictor');
    t = play(t, 'p1', t.hands.p1[0]!);
    expect(t.seats.map((x) => genePoolOf(t, x.id))).toEqual([5, 4, 4]);
  });

  it('Cheek Pouches skips stabilizing; Apricity offers to; Age of Envy stabilizes to the Gene Pool on your right', () => {
    let s = ov();
    s.hands.p1[0] = O('cheek-pouches');
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(handOf(s, 'p1').length).toBe(6);
    expect(s.turnPlayerId).toBe('p2');

    let t = ov();
    t.tableaus.p1 = [O('apricity')];
    t.hands.p1.push(T('fangs'));
    t = play(t, 'p1', t.hands.p1[0]!);
    if (t.prompt?.kind !== 'option') throw new Error('expected the stabilize choice');
    expect(t.prompt.options.map((o) => o.id)).toContain('skip');

    let u = ov(3);
    u.currentAge = ovAge('envy');
    u.genePool.p3 = 3; // on p1's right
    u = play(u, 'p1', u.hands.p1[0]!);
    if (u.prompt?.kind !== 'cards') throw new Error('expected a discard to 3');
    expect(u.prompt.min).toBe(1);
  });

  it('Scavenger may stabilize from the discard pile', () => {
    let s = ov();
    s.tableaus.p1 = [O('scavenger')];
    const blubber = T('blubber');
    s.traitDiscard = [blubber];
    s.hands.p1 = [T('bark')];
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(s.prompt?.task.t).toBe('stabilize');
    s = answer(s, { optionId: 'discard' });
    expect(handOf(s, 'p1').map((c) => c.id)).toContain(blubber.id);
    expect(handOf(s, 'p1').length).toBe(5);
  });

  it('Fabled costs 4 cards of the 4 colours; Metamorphosis 3 traits of face value 1 or more', () => {
    let s = ov();
    const four = [T('antlers'), T('gills'), T('bark'), T('adorable')];
    s.hands.p1 = [O('fabled'), ...four, T('fangs')];
    expect(canPlayTrait(s, 'p1', s.hands.p1[0]!)).toBe(true);
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(s.prompt?.task.t).toBe('fabledCost');
    expect(() => answer(s, { cardIds: [four[0]!.id, four[1]!.id, four[2]!.id, s.hands.p1[5]!.id] })).toThrow(/each colour/);
    s = answer(s, { cardIds: four.map((c) => c.id) });
    expect(kinds(tableauOf(s, 'p1'))).toEqual(['fabled']);
    expect(genePoolOf(s, 'p1')).toBe(6);

    let t = ov();
    t.tableaus.p1 = [T('antlers'), T('bark'), T('gills'), T('confusion')];
    t.hands.p1[0] = O('metamorphosis');
    t = play(t, 'p1', t.hands.p1[0]!);
    for (let i = 0; i < 2; i++) {
      if (t.prompt?.kind !== 'trait') throw new Error('expected a cost pick');
      t = answer(t, { targetCardId: t.prompt.targets[0]!.cardId });
    }
    expect(kinds(tableauOf(t, 'p1')).sort()).toEqual(['confusion', 'metamorphosis']);
  });

  it('Seedwing and Nimble are discarded for their effect without using the turn', () => {
    let s = ov();
    const seedwing = O('seedwing');
    s.tableaus.p1 = [seedwing];
    expect(usableCards(s, 'p1').map((c) => c.id)).toEqual([seedwing.id]);
    s = applyAction(s, { type: 'useCard', playerId: 'p1', cardId: seedwing.id });
    s = answer(s, { cardIds: [s.hands.p1[1]!.id] });
    expect(tableauOf(s, 'p1').length).toBe(1);
    expect(s.turnPlayerId).toBe('p1');
    expect(s.subPhase).toBe('awaitingAction');

    let t = ov();
    const nimble = O('nimble');
    t.tableaus.p1 = [T('confusion')];
    t.hands.p1[0] = nimble;
    t = applyAction(t, { type: 'useCard', playerId: 'p1', cardId: nimble.id });
    expect(tableauOf(t, 'p1').length).toBe(0);
    expect(t.subPhase).toBe('awaitingAction');
  });

  it('The Legend of Mokoko Village: with Heroic, play 2 traits ignoring their Actions', () => {
    let s = ov();
    s.currentAge = ovAge('mokokoLegend');
    s.tableaus.p1 = [T('heroic')];
    const [temper, bark] = [T('hot-temper'), T('bark')];
    s.hands.p1 = [temper, bark, T('gills'), T('leaves'), T('spiny')];
    s = applyAction(s, { type: 'playTrait', playerId: 'p1', cardId: temper.id, twoIgnoringActions: true });
    expect(s.prompt?.task.t).toBe('playAnother'); // not Hot Temper's discard
    s = answer(s, { cardIds: [bark.id] });
    expect(kinds(tableauOf(s, 'p1'))).toEqual(['heroic', 'hot-temper', 'bark']);
  });

  it('Choking Vines ignores blue and green Actions', () => {
    let s = ov();
    s.currentAge = ovCat('chokingVines');
    s.hands.p1[0] = T('iridescent-scales');
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(s.prompt).toBeNull();
    expect(handOf(s, 'p1').length).toBe(5);
  });

  it('Booming Call swaps itself away and plays the Action it gets', () => {
    let s = ov();
    s.tableaus.p2 = [T('introspective')];
    s.hands.p1[0] = O('booming-call');
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(kinds(tableauOf(s, 'p1'))).toEqual(['introspective']);
    expect(kinds(tableauOf(s, 'p2'))).toEqual(['booming-call']);
    expect(handOf(s, 'p1').length).toBe(8); // 4 + Introspective's 4: too many, so a stabilize prompt waits
    expect(s.prompt?.task.t).toBe('stabilize');
  });

  it('Vagabond: opponents each play a trait, then you steal one of them', () => {
    let s = ov(3);
    s.hands.p1[0] = O('vagabond');
    s = play(s, 'p1', s.hands.p1[0]!);
    s = answer(s, { cardIds: [handOf(s, 'p2')[0]!.id] }); // Antlers
    s = answer(s, { cardIds: [handOf(s, 'p3')[1]!.id] }); // Bark
    expect(s.prompt?.task.t).toBe('vagabondChoice');
    s = answer(s, { optionId: 'steal' });
    if (s.prompt?.kind !== 'trait') throw new Error('expected the steal');
    expect(s.prompt.targets.length).toBe(2);
    s = answer(s, { targetCardId: s.prompt.targets[0]!.cardId });
    expect(tableauOf(s, 'p1').length).toBe(2);
  });

  it('Caffeinated: everyone draws 3 and passes 1 to the right, all at once', () => {
    let s = ov(3);
    s.hands.p1[0] = O('caffeinated');
    s = play(s, 'p1', s.hands.p1[0]!);
    const given: number[] = [];
    while (s.prompt?.task.t === 'gift') {
      const id = (s.prompt as Extract<DmState['prompt'], { kind: 'cards' }>).cardIds[0]!;
      given.push(id);
      s = answer(s, { cardIds: [id] });
    }
    expect(given.length).toBe(3);
    expect(handOf(s, 'p3').map((c) => c.id)).toContain(given[0]!); // p1's right is p3
  });

  it("World's End: Lily Pad scores what it returns; Planetary Deforestation subtracts your Gene Pool; Invasive Species adds a card", () => {
    let s = ov();
    s.catastrophesSeen = 2;
    lastTurn(s, 'p2');
    s.ageDeck = [ovCat('planetaryDeforestation')];
    s.tableaus.p1 = [O('lily-pad'), T('confusion'), T('bark')];
    s = play(s, 'p2', s.hands.p2[1]!);
    while (s.prompt && s.prompt.task.t !== 'lilyPad') s = applyAction(s, chooseAIAction(s, s.activePlayerId!)!);
    s = answer(s, { targetCardId: tableauOf(s, 'p1')[1]!.id }); // Confusion back to hand: +1 and −(−2)
    s = answer(s, { decline: true });
    expect(s.phase).toBe('gameOver');
    const sc = computePlayerScore(s, 'p1');
    expect(sc.dropOfLifeBonus).toBe(1);
    expect(sc.worldsEndBonus).toBe(-genePoolOf(s, 'p1'));

    let t = ov();
    t.catastrophesSeen = 2;
    lastTurn(t, 'p2');
    t.ageDeck = [ovCat('invasiveSpecies')];
    t = play(t, 'p2', t.hands.p2[1]!);
    while (t.prompt) t = applyAction(t, chooseAIAction(t, t.activePlayerId!)!);
    expect(t.phase).toBe('gameOver');
    expect(Object.keys(t.worldsEnd?.addFace ?? {}).length).toBe(2);
  });

  it('the AI plays full Overlush games (with and without Castle Glass) for 2–6 players', () => {
    for (const exp of [['overlush'], ['overlush', 'castle-glass']]) {
      for (const n of [2, 3, 4, 5, 6]) {
        const { state, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState({ expansions: exp }, 1200 + n, makeSeats(n)), 5000);
        expect(stuck).toBe(false);
        expect(state.phase).toBe('gameOver');
        expect(state.catastrophesSeen).toBe(3);
      }
    }
  });
});

// ============================================================================
// Imaginary Ends
// ============================================================================

describe('Doomlings — Imaginary Ends', () => {
  const IE_CARDS = packTraitCards('imaginary-ends', 8000);
  const IE_AGES = packAgeCards('imaginary-ends', 8500);
  const IECFG = { expansions: ['imaginary-ends'] };

  function I(kind: DmTraitKind): DmTraitCard {
    const c = IE_CARDS.find((x) => x.kind === kind);
    if (!c) throw new Error(`no Imaginary Ends trait ${kind}`);
    return { ...c, id: nextId++ };
  }
  const ieAge = (tag: DmAgeCard['ruleTag']) => IE_AGES.ages.find((a) => a.ruleTag === tag)!;
  const ieCat = (tag: DmCatastropheTag) => IE_AGES.catastrophes.find((a) => a.catastrophe === tag)!;
  function ie(n = 2, seed = 7): DmState {
    const s = setup(n, seed);
    s.traitDeck = Array.from({ length: 40 }, (_, i) => T((['antlers', 'bark', 'gills', 'leaves'] as const)[i % 4]!));
    return s;
  }
  const kinds = (cards: DmTraitCard[]) => cards.map((c) => c.kind);

  it('has the four collections’ 64 traits (7 Dominants), 8 Ages and 4 Catastrophes', () => {
    expect(IE_CARDS.length).toBe(64);
    expect(IE_CARDS.filter((c) => c.dominant).length).toBe(7);
    expect(IE_AGES.ages.length).toBe(8);
    expect(IE_AGES.catastrophes.map((c) => c.genePoolDelta)).toEqual([-1, -1, -2, -1]);
    expect(I('awesome').isAllColors).toBe(true);
    expect(I('remarkable').sub).toEqual(['deepling', 'glitterling', 'moonling']);
    expect(IE_CARDS.filter((c) => c.sub?.includes('deepling')).length).toBe(25);
    const s = createInitialState(IECFG, 4, makeSeats(3));
    expect([...s.traitDeck, ...s.seats.flatMap((x) => handOf(s, x.id))].length).toBe(116 + 64);
  });

  it('suppressing hides a card under a trait: +1 point, not a trait, never under a Dominant', () => {
    let s = ie();
    const [tiny, bark] = [T('tiny'), T('bark')];
    s.tableaus.p1 = [tiny, bark];
    const fangs = T('fangs');
    s.hands.p1 = [I('translucent'), fangs, T('gills'), T('leaves'), T('spiny')];
    s = play(s, 'p1', s.hands.p1[0]!);
    if (s.prompt?.kind !== 'cards') throw new Error('expected the hand pick');
    s = answer(s, { cardIds: [fangs.id] });
    if (s.prompt?.kind !== 'trait') throw new Error('expected the host');
    expect(s.prompt.targets.map((t) => t.cardId)).not.toContain(tiny.id);
    s = answer(s, { targetCardId: bark.id });
    expect(tableauOf(s, 'p1').length).toBe(3);
    expect(tableauOf(s, 'p1').find((c) => c.id === bark.id)!.under!.map((c) => c.id)).toEqual([fangs.id]);
    expect(computePlayerScore(s, 'p1').suppressed).toBe(1);
  });

  it('suppressed cards go to the bottom of the deck when their trait leaves the pile', () => {
    let s = ie();
    const gills = T('gills');
    const host = { ...T('fangs'), under: [gills] };
    s.tableaus.p2 = [host];
    s.hands.p1[0] = T('selfish');
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(tableauOf(s, 'p1').find((c) => c.id === host.id)?.under).toBeUndefined();
    expect(s.traitDeck.some((c) => c.id === gills.id)).toBe(true);
  });

  it('Whip Tail suppresses a pile trait (its Gene Pool change is reversed); Untold scores the cards under it', () => {
    let s = ie();
    const fec = T('fecundity');
    s.tableaus.p1 = [fec];
    s.genePool.p1 = 6;
    s.hands.p1[0] = I('whip-tail');
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(genePoolOf(s, 'p1')).toBe(5);
    expect(kinds(tableauOf(s, 'p1'))).toEqual(['whip-tail']);
    expect(tableauOf(s, 'p1')[0]!.under?.length).toBe(1);

    let t = ie();
    t.tableaus.p1 = [T('bark'), T('leaves')];
    const untold = I('untold');
    t.hands.p1[0] = untold;
    t = play(t, 'p1', untold);
    for (let i = 0; i < 2; i++) {
      if (t.prompt?.task.t === 'suppressPick' && t.prompt.kind === 'trait') t = answer(t, { targetCardId: t.prompt.targets.find((x) => x.cardId !== untold.id)!.cardId });
      if (t.prompt?.task.t === 'suppressCards') t = answer(t, { targetCardId: untold.id });
    }
    expect(computePlayerScore(t, 'p1')).toMatchObject({ suppressed: 2, dropOfLifeBonus: 2 });
  });

  it('Hidden steals a trait and suppresses it; Lure lets the opponent on your right name the colour', () => {
    let s = ie();
    s.tableaus.p2 = [T('blubber')];
    s.tableaus.p1 = [T('bark')];
    s.hands.p1[0] = I('hidden');
    s = play(s, 'p1', s.hands.p1[0]!);
    if (s.prompt?.task.t === 'suppressCards') s = answer(s, { targetCardId: (s.prompt as Extract<DmState['prompt'], { kind: 'trait' }>).targets[0]!.cardId });
    expect(tableauOf(s, 'p2').length).toBe(0);
    expect(computePlayerScore(s, 'p1').suppressed).toBe(1);

    let t = ie();
    t.tableaus.p1 = [T('bark')];
    t.hands.p1 = [I('lure'), T('antlers'), T('fangs'), T('gills'), T('leaves')];
    t = play(t, 'p1', t.hands.p1[0]!);
    expect(t.prompt?.playerId).toBe('p2');
    t = answer(t, { chosenColor: 'red' });
    if (t.prompt?.task.t === 'suppressCards') t = answer(t, { targetCardId: (t.prompt as Extract<DmState['prompt'], { kind: 'trait' }>).targets[0]!.cardId });
    expect(computePlayerScore(t, 'p1').suppressed).toBe(2); // Antlers and Fangs
  });

  it('Grobblebobble can’t be discarded from a hand', () => {
    let s = ie();
    const grob = I('grobblebobble');
    s.hands.p1 = [T('bark'), grob, T('fangs'), T('gills'), T('leaves'), T('spiny'), T('quick')];
    s = play(s, 'p1', s.hands.p1[0]!);
    if (s.prompt?.kind !== 'cards') throw new Error('expected the stabilize discard');
    expect(s.prompt.cardIds).not.toContain(grob.id);
    let t = ie();
    t.hands.p2 = [grob];
    t.hands.p1[0] = T('bad');
    t = play(t, 'p1', t.hands.p1[0]!);
    expect(handOf(t, 'p2').map((c) => c.id)).toContain(grob.id);
  });

  it('Popplebelly fixes your Gene Pool at 1 and draws 2 at the start of each of your turns', () => {
    let s = ie();
    s.hands.p1[0] = I('popplebelly');
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(genePoolOf(s, 'p1')).toBe(1);
    if (s.prompt?.kind !== 'cards') throw new Error('expected the stabilize-to-1 discard');
    s = answer(s, { cardIds: s.prompt.cardIds.slice(0, 3) });
    expect(handOf(s, 'p1').length).toBe(1);
    s.hands.p1.push(T('warm-blood'));
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(handOf(s, 'p1').length).toBe(4); // 2 + Popplebelly's 2
    s = play(s, 'p1', handOf(s, 'p1').find((c) => c.kind === 'warm-blood')!);
    expect(genePoolOf(s, 'p1')).toBe(1);
  });

  it('Ethereal: with 6 or fewer cards you may suppress 1 instead of stabilizing', () => {
    let s = ie();
    s.tableaus.p1 = [I('ethereal'), T('bark')];
    s = play(s, 'p1', s.hands.p1[0]!);
    if (s.prompt?.kind !== 'option') throw new Error('expected the stabilize choice');
    s = answer(s, { optionId: 'ethereal' });
    s = answer(s, { cardIds: [handOf(s, 'p1')[0]!.id] });
    if (s.prompt?.task.t === 'suppressCards') s = answer(s, { targetCardId: (s.prompt as Extract<DmState['prompt'], { kind: 'trait' }>).targets[0]!.cardId });
    expect(handOf(s, 'p1').length).toBe(3);
    expect(computePlayerScore(s, 'p1').suppressed).toBe(1);
    expect(s.turnPlayerId).toBe('p2');
  });

  it('Remarkable: hold 3 or fewer; opponents pass their hands right and stabilize; your hand is suppressed', () => {
    let s = ie(3);
    const rem = I('remarkable');
    s.tableaus.p1 = [T('bark')];
    s.hands.p1 = [rem, T('fangs'), T('gills'), T('leaves'), T('spiny')];
    expect(canPlayTrait(s, 'p1', rem)).toBe(false);
    s.hands.p1 = [rem, T('fangs'), T('gills')];
    const p2hand = handOf(s, 'p2').map((c) => c.id);
    s = play(s, 'p1', rem);
    while (s.prompt?.task.t === 'suppressCards') s = answer(s, { targetCardId: (s.prompt as Extract<DmState['prompt'], { kind: 'trait' }>).targets[0]!.cardId });
    expect(computePlayerScore(s, 'p1').suppressed).toBe(2);
    expect(handOf(s, 'p3').map((c) => c.id)).toEqual(expect.arrayContaining(p2hand)); // p2's right is... p1; p3 passes to p2
  });

  it('Moonpocalypse can’t take a Gene Pool below 4; Abyss Stares Back suppresses your whole hand', () => {
    let s = ie();
    lastTurn(s, 'p2');
    s.ageDeck.unshift(ieCat('moonpocalypse'));
    s.genePool.p2 = 3;
    s.hands.p2 = [T('bark'), T('gills'), T('leaves'), T('spiny')]; // stabilizes to 3 without a discard
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(genePoolOf(s, 'p1')).toBe(4);
    expect(genePoolOf(s, 'p2')).toBe(3);

    let t = ie();
    lastTurn(t, 'p2');
    t.ageDeck.unshift(ieCat('abyssStaresBack'));
    t.tableaus.p1 = [T('bark')];
    t = play(t, 'p2', t.hands.p2[0]!);
    expect(computePlayerScore(t, 'p1').suppressed).toBe(5);
  });

  it('Fading Away suppresses each non-Dominant trait once it has resolved', () => {
    let s = ie();
    s.currentAge = ieAge('fadingAway');
    s.tableaus.p1 = [T('bark')];
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(tableauOf(s, 'p1').length).toBe(1);
    expect(computePlayerScore(s, 'p1').suppressed).toBe(1);
  });

  it('Umbleboos is a free play into a pile with a Gene Pool of 6 or more', () => {
    let s = ie();
    const umb = I('umbleboos');
    s.hands.p1[0] = umb;
    expect(outOfTurnPlays(s, 'p1').some((c) => c.id === umb.id)).toBe(false);
    s.genePool.p2 = 6;
    expect(() => applyAction(s, { type: 'playOutOfTurn', playerId: 'p1', cardId: umb.id, targetPlayerId: 'p1' })).toThrow(/6 or more/);
    s = applyAction(s, { type: 'playOutOfTurn', playerId: 'p1', cardId: umb.id, targetPlayerId: 'p2' });
    expect(genePoolOf(s, 'p2')).toBe(4);
    expect(s.turnPlayerId).toBe('p1');
  });

  it('scores Jibwib, Thwopplers, Enigma and Telescopic Eyes', () => {
    const s = ie();
    s.tableaus.p1 = [I('jibwib')];
    s.genePool.p2 = 2;
    expect(computePlayerScore(s, 'p2').dropOfLifeBonus).toBe(5);
    expect(computePlayerScore(s, 'p1').dropOfLifeBonus).toBe(0);
    s.tableaus.p1 = [I('thwopplers'), I('enigma')];
    s.tableaus.p2 = [T('bark'), T('gills'), T('leaves')];
    expect(computePlayerScore(s, 'p1').dropOfLifeBonus).toBe(-2 + 10);
    s.tableaus.p1 = [I('telescopic-eyes')];
    expect(computePlayerScore(s, 'p1').dropOfLifeBonus).toBe(2);
  });

  it('Gob Lopters costs 2 random cards to an opponent; Whimsy plays the card it reveals', () => {
    let s = ie();
    s.hands.p1 = [I('gob-lopters'), T('bark'), T('fangs'), T('gills'), T('leaves')];
    s = play(s, 'p1', s.hands.p1[0]!);
    expect(kinds(tableauOf(s, 'p1'))).toEqual(['gob-lopters']);
    expect(handOf(s, 'p2').length).toBe(7);

    let t = ie();
    t.traitDeck.unshift(T('blubber'));
    t.hands.p1[0] = I('whimsy');
    t = play(t, 'p1', t.hands.p1[0]!);
    expect(kinds(tableauOf(t, 'p1'))).toEqual(['whimsy', 'blubber']);
  });

  it('Glitterstorm: choose how many random cards to discard, then stabilize; Moonlight depends on your Gene Pool', () => {
    let s = ie();
    lastTurn(s, 'p2');
    s.ageDeck.unshift(ieAge('glitterstorm'));
    s = play(s, 'p2', s.hands.p2[0]!);
    expect(s.prompt?.task.t).toBe('glitterstorm');
    s = answer(s, { optionId: '3' });
    expect(handOf(s, 'p1').length).toBe(5);

    let t = ie();
    lastTurn(t, 'p2');
    t.ageDeck.unshift(ieAge('moonlight'));
    t.genePool.p2 = 3;
    t.hands.p2 = [T('bark'), T('gills'), T('leaves'), T('spiny')];
    t = play(t, 'p2', t.hands.p2[0]!);
    expect(t.prompt?.playerId).toBe('p1'); // Gene Pool 5: discard 1
    t = answer(t, { cardIds: [handOf(t, 'p1')[0]!.id] });
    expect(handOf(t, 'p2').length).toBe(5); // Gene Pool 3: draw 2
  });

  it('Rainbow Magic may return to your hand after you stabilize to play a random card', () => {
    let s = ie();
    s.tableaus.p1 = [I('rainbow-magic')];
    s = play(s, 'p1', s.hands.p1[0]!);
    if (s.prompt?.kind !== 'option') throw new Error('expected the after-stabilize window');
    s = answer(s, { optionId: 'rainbow' });
    expect(tableauOf(s, 'p1').length).toBe(2);
  });

  it('the AI plays full Imaginary Ends games (and with every built pack) for 2–6 players', () => {
    for (const exp of [['imaginary-ends'], ['imaginary-ends', 'overlush', 'castle-glass']]) {
      for (const n of [2, 3, 4, 5, 6]) {
        const { state, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState({ expansions: exp }, 1500 + n, makeSeats(n)), 5000);
        expect(stuck).toBe(false);
        expect(state.phase).toBe('gameOver');
      }
    }
  });
});
