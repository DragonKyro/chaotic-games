import { describe, expect, it } from 'vitest';
import {
  HTS_BERSERKERS_NECROMANCERS_DECK_DEFS,
  HTS_BERSERKERS_NECROMANCERS_LEADERS,
  HTS_BERSERKERS_NECROMANCERS_MONSTERS,
  HTS_MAIN_DECK_DEFS,
  HTS_MONSTER_DEFS,
  HTS_PARTY_LEADERS,
  HTS_SLEIGH_DECK_DEFS,
  HTS_SLEIGH_GIFTS,
  HTS_SLEIGH_LEADERS,
  HTS_SLEIGH_MONSTERS,
  HTS_WARRIORS_DRUIDS_DECK_DEFS,
  HTS_WARRIORS_DRUIDS_LEADERS,
  HTS_WARRIORS_DRUIDS_MONSTERS,
  defToCard,
} from './cards';
import { chooseAIAction } from './ai';
import { hereToSlayModule } from './module';
import {
  applyAction,
  canAttackMonster,
  canEquipItemToHero,
  createInitialState as createDrafting,
  getClassesToWin,
  partyClasses,
  pickablePileCards,
  validHeroTargets,
} from './reducer';
import type { HtsAction, HtsCard, HtsConfig, HtsMonster, HtsPartyHero, HtsState } from './types';
import { HTS_EXPANSIONS } from './types';
import { makeSeats, playOut } from '@/core/playout';
import type { Seat } from '@/core/types';

const DEFAULT_CFG: HtsConfig = { expansions: [], monstersToWin: 3 };

/** Run the opening Party Leader draft with the AI's picks. */
function finishDraft(s: HtsState): HtsState {
  return playOut({ applyAction, chooseAIAction }, s, 20, (x) => x.subPhase !== 'choosingLeaders').state;
}

/** A game that is past its leader draft: hands dealt, first seat to act. */
function createInitialState(cfg: HtsConfig, seed: number, seats: Seat[]): HtsState {
  return finishDraft(createDrafting(cfg, seed, seats));
}

describe('Here to Slay — deck & setup', () => {
  it('has 6 Party Leaders, 15 Monsters, and 115 main deck cards (48 Heroes, 11 Items, 4 Cursed Items, 13 Magic, 25 Modifiers, 14 Challenges)', () => {
    expect(HTS_PARTY_LEADERS.length).toBe(6);
    expect(HTS_MONSTER_DEFS.length).toBe(15);
    const totalMain = HTS_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0);
    expect(totalMain).toBe(115);
  });

  it('includes all 3 expansions and validates expansion configs with Thumbnail attached', () => {
    expect(HTS_WARRIORS_DRUIDS_LEADERS.length).toBe(2);
    expect(HTS_WARRIORS_DRUIDS_MONSTERS.length).toBe(2);
    expect(HTS_WARRIORS_DRUIDS_DECK_DEFS.filter((d) => d.type === 'hero').length).toBe(16);

    expect(HTS_BERSERKERS_NECROMANCERS_LEADERS.length).toBe(2);
    expect(HTS_BERSERKERS_NECROMANCERS_MONSTERS.length).toBe(2);
    expect(HTS_BERSERKERS_NECROMANCERS_DECK_DEFS.filter((d) => d.type === 'hero').length).toBe(16);

    expect(HTS_SLEIGH_LEADERS.length).toBe(2);
    expect(HTS_SLEIGH_MONSTERS.length).toBe(2);
    expect(HTS_SLEIGH_DECK_DEFS.filter((d) => d.type === 'hero').length).toBe(6);
    expect(HTS_SLEIGH_GIFTS.length).toBeGreaterThanOrEqual(6);

    expect(hereToSlayModule.Thumbnail).toBeTruthy();
    expect(
      hereToSlayModule.validateConfig({
        expansions: ['warriors-druids', 'berserkers-necromancers', 'here-to-sleigh'],
        monstersToWin: 3,
      }),
    ).toEqual([]);
  });

  it('deals 1 Party Leader and 5 cards to each player (after the draft) and 3 Monsters to the center row', () => {
    const seats = makeSeats(4);
    const s = createInitialState(DEFAULT_CFG, 42, seats);
    expect(s.subPhase).toBe('awaitingAction');
    expect(s.activePlayerId).toBe('p1');
    expect(s.monsterRow.length).toBe(3);
    expect(s.monsterDeck.length).toBe(12);
    for (const seat of seats) {
      expect(s.partyLeaders[seat.id]).toBeTruthy();
      expect(s.hands[seat.id]?.length).toBe(5);
    }
    expect(s.actionPointsRemaining).toBe(3);
  });
});

describe('Here to Slay — mechanics & player decisions', () => {
  it('resolves Challenge duels and dual-choice Modifiers', () => {
    const seats = makeSeats(2);
    let s = createInitialState(DEFAULT_CFG, 10, seats);
    s.partyLeaders.p1 = { id: 1, kind: 'leader-cloaked-sage', name: 'The Cloaked Sage', type: 'partyLeader', class: 'wizard', text: '', abilityThreshold: null, modifierChoices: null };
    s.partyLeaders.p2 = { id: 2, kind: 'leader-protecting-horn', name: 'The Protecting Horn', type: 'partyLeader', class: 'guardian', text: '', abilityThreshold: null, modifierChoices: null };

    const heroCard: HtsCard = { id: 901, kind: 'bad-axe', name: 'Bad Axe', type: 'hero', class: 'fighter', text: '', abilityThreshold: 8, modifierChoices: null };
    const challengeCard: HtsCard = { id: 902, kind: 'challenge', name: 'Challenge', type: 'challenge', class: null, text: '', abilityThreshold: null, modifierChoices: null };
    const modCard: HtsCard = { id: 903, kind: 'mod-plus-2-minus-2', name: 'Modifier +2/-2', type: 'modifier', class: null, text: '', abilityThreshold: null, modifierChoices: [2, -2] };

    s.hands.p1 = [heroCard];
    s.hands.p2 = [challengeCard, modCard];

    s = applyAction(s, { type: 'playHero', playerId: 'p1', cardId: 901 });
    expect(s.subPhase).toBe('awaitingChallenge');
    expect(s.activePlayerId).toBe('p2');

    // p2 Challenges! Actor rolls 8, Challenger rolls 6
    s = applyAction(s, {
      type: 'playChallenge',
      playerId: 'p2',
      cardId: 902,
      actorDice: [4, 4],
      challengerDice: [3, 3],
    });
    expect(s.subPhase).toBe('awaitingModifiers');

    // p2 plays Modifier +2/-2 choosing +2 on challenger, plus Protecting Horn +1 => +3 total => 6+3=9 vs 8!
    s = applyAction(s, {
      type: 'playModifier',
      playerId: 'p2',
      cardId: 903,
      chosenValue: 2,
      protectingHornDelta: 1,
      targetSide: 'challenger',
    });

    // No more modifiers in anyone's hand -> resolves immediately, p2 wins Challenge!
    expect(s.parties.p1?.length).toBe(0);
    expect(s.discard.some((c) => c.id === 901)).toBe(true);
  });

  it('tracks Mask class overrides and wins when 6 classes are assembled', () => {
    const seats = makeSeats(2);
    let s = createInitialState(DEFAULT_CFG, 99, seats);
    s.partyLeaders.p1 = { id: 1, kind: 'leader-fist-of-reason', name: 'The Fist of Reason', type: 'partyLeader', class: 'fighter', text: '', abilityThreshold: null, modifierChoices: null };
    s.parties.p1 = [
      { card: { id: 801, kind: 'peanut', name: 'Peanut', type: 'hero', class: 'bard', text: '', abilityThreshold: 7, modifierChoices: null }, equippedItem: null, usedThisTurn: true },
      { card: { id: 802, kind: 'wise-shield', name: 'Wise Shield', type: 'hero', class: 'guardian', text: '', abilityThreshold: 6, modifierChoices: null }, equippedItem: null, usedThisTurn: true },
      { card: { id: 803, kind: 'hook', name: 'Hook', type: 'hero', class: 'ranger', text: '', abilityThreshold: 6, modifierChoices: null }, equippedItem: null, usedThisTurn: true },
      { card: { id: 804, kind: 'kit-napper', name: 'Kit Napper', type: 'hero', class: 'thief', text: '', abilityThreshold: 9, modifierChoices: null }, equippedItem: null, usedThisTurn: true },
      { card: { id: 805, kind: 'bad-axe', name: 'Bad Axe', type: 'hero', class: 'fighter', text: '', abilityThreshold: 8, modifierChoices: null }, equippedItem: null, usedThisTurn: true },
    ];
    expect(partyClasses(s, 'p1').size).toBe(5);

    // Equip Wizard Mask onto Bad Axe (Fighter -> Wizard) to reach 6 distinct classes!
    const wizMask: HtsCard = { id: 806, kind: 'wizard-mask', name: 'Wizard Mask', type: 'item', class: 'wizard', text: '', abilityThreshold: null, modifierChoices: null };
    s.hands.p1 = [wizMask];
    s.hands.p2 = [];

    s = applyAction(s, {
      type: 'equipItem',
      playerId: 'p1',
      cardId: 806,
      targetPlayerId: 'p1',
      heroCardId: 805,
    });
    expect(partyClasses(s, 'p1').size).toBe(6);
    // "End your turn with a full Party" — not before.
    expect(s.phase).toBe('playing');
    s = applyAction(s, { type: 'endTurn', playerId: 'p1' });
    expect(s.phase).toBe('gameOver');
    expect(s.winnerId).toBe('p1');
    expect(s.finalScores).toEqual({ p1: 1, p2: 0 });
  });

  it('implements Here to Sleigh: Holiday Heroes, Milk and Cookies, and winning with 3 Nice List Gifts', () => {
    const cfg: HtsConfig = { expansions: ['here-to-sleigh'], monstersToWin: 3 };
    const seats = makeSeats(2);
    let s = createInitialState(cfg, 789, seats);
    s.hands.p1 = [];
    s.hands.p2 = [];

    const drummer: HtsCard = {
      id: 501,
      kind: 'lil-drummer-bard',
      name: "Lil' Drummer Bard",
      type: 'hero',
      class: 'bard',
      text: '',
      abilityThreshold: 6,
      modifierChoices: null,
    };
    const cookies: HtsCard = {
      id: 502,
      kind: 'milk-and-cookies',
      name: 'Milk and Cookies',
      type: 'item',
      class: null,
      text: '',
      abilityThreshold: null,
      modifierChoices: null,
    };
    s.parties.p1 = [{ card: drummer, equippedItem: cookies, usedThisTurn: false }];
    s.actionPointsRemaining = 3;

    // Roll ability on Lil' Drummer Bard with Milk and Cookies equipped -> claims 2 Nice Gifts!
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 501, dice: [4, 4] });
    expect(s.niceGifts.p1?.length).toBe(2);
    expect(s.phase).toBe('playing');

    // Spend 2 AP to deliver 3rd Holiday Gift and win the game!
    s = applyAction(s, { type: 'claimHolidayGift', playerId: 'p1' });
    expect(s.niceGifts.p1?.length).toBe(3);
    expect(s.phase).toBe('gameOver');
    expect(s.winnerId).toBe('p1');
  });

  it('plays full AI-vs-AI games to completion across Base Game and all Expansions', () => {
    for (const playerCount of [2, 3, 4]) {
      for (let seed = 1; seed <= 3; seed++) {
        const { state: s, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(DEFAULT_CFG, seed * 29, makeSeats(playerCount)), 2500);
        expect(stuck).toBe(false);
        expect(s.phase).toBe('gameOver');
        expect(s.winnerId).toBeTruthy();
      }
    }

    const expansionConfigs: HtsConfig[] = [
      { expansions: ['warriors-druids'], monstersToWin: 3 },
      { expansions: ['berserkers-necromancers'], monstersToWin: 3 },
      { expansions: ['here-to-sleigh'], monstersToWin: 3 },
      { expansions: ['warriors-druids', 'berserkers-necromancers', 'here-to-sleigh'], monstersToWin: 3 },
    ];

    for (const cfg of expansionConfigs) {
      const { state: s, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(cfg, 77, makeSeats(3)), 3000);
      expect(stuck).toBe(false);
      expect(s.phase).toBe('gameOver');
      expect(s.winnerId).toBeTruthy();
    }
  });
});

// ============================================================================
// Rules audit (2026-11): every fix below is pinned to the rulebook.
// ============================================================================

let nextTestId = 5000;
function mk(kind: string, type: HtsCard['type'], cls: HtsCard['class'] = null, extra: Partial<HtsCard> = {}): HtsCard {
  return { id: nextTestId++, kind, name: kind, type, class: cls, text: '', abilityThreshold: null, modifierChoices: null, ...extra };
}
const heroCard = (kind: string, cls: HtsCard['class'], threshold = 7) => mk(kind, 'hero', cls, { abilityThreshold: threshold });
const inParty = (card: HtsCard, item: HtsCard | null = null): HtsPartyHero => ({ card, equippedItem: item, usedThisTurn: false });
const leaderCard = (kind: string, cls: HtsCard['class']) => mk(kind, 'partyLeader', cls);

/** Two players past the draft, empty hands and parties, leaders with no roll bonuses. */
function cleanTwoPlayer(seed = 7): HtsState {
  const s = createInitialState(DEFAULT_CFG, seed, makeSeats(2));
  s.hands.p1 = [];
  s.hands.p2 = [];
  s.parties.p1 = [];
  s.parties.p2 = [];
  s.partyLeaders.p1 = leaderCard('leader-fist-of-reason', 'fighter');
  s.partyLeaders.p2 = leaderCard('leader-cloaked-sage', 'wizard');
  return s;
}

function monsterFrom(kind: string): HtsMonster {
  const def = [...HTS_MONSTER_DEFS, ...HTS_WARRIORS_DRUIDS_MONSTERS, ...HTS_BERSERKERS_NECROMANCERS_MONSTERS].find((m) => m.kind === kind)!;
  return {
    card: mk(def.kind, 'monster'),
    requiredHeroes: def.requiredHeroes,
    requiredClass: def.requiredClass,
    requirementText: def.requirementText,
    slayThreshold: def.slayThreshold,
    slayOnLow: def.slayOnLow,
    failThreshold: def.failThreshold,
    failPenalty: def.failPenalty,
  };
}

describe('Here to Slay — rules audit', () => {
  it('drafts Party Leaders at setup: reverse seat order, the last picker goes first, and leaders never change afterwards', () => {
    let s = createDrafting(DEFAULT_CFG, 3, makeSeats(3));
    expect(s.subPhase).toBe('choosingLeaders');
    expect(s.activePlayerId).toBe('p3');
    expect(Object.values(s.hands).every((h) => h.length === 0)).toBe(true);
    const deckBefore = s.deck.length;
    expect(() => applyAction(s, { type: 'choosePartyLeader', playerId: 'p1', leaderKind: 'leader-cloaked-sage' })).toThrow();
    s = applyAction(s, { type: 'choosePartyLeader', playerId: 'p3', leaderKind: 'leader-cloaked-sage' });
    // Taken leaders are gone from the pool.
    expect(() => applyAction(s, { type: 'choosePartyLeader', playerId: 'p2', leaderKind: 'leader-cloaked-sage' })).toThrow();
    s = applyAction(s, { type: 'choosePartyLeader', playerId: 'p2', leaderKind: 'leader-shadow-claw' });
    s = applyAction(s, { type: 'choosePartyLeader', playerId: 'p1', leaderKind: 'leader-divine-arrow' });
    expect(s.subPhase).toBe('awaitingAction');
    expect(s.turnPlayerId).toBe('p1');
    expect(s.activePlayerId).toBe('p1');
    expect(s.partyLeaders.p3?.kind).toBe('leader-cloaked-sage');
    for (const id of ['p1', 'p2', 'p3']) expect(s.hands[id]).toHaveLength(5);
    expect(s.deck.length).toBe(deckBefore - 15);
    // The old mid-game "swap your leader" is gone.
    expect(() => applyAction(s, { type: 'choosePartyLeader', playerId: 'p1', leaderKind: 'leader-fist-of-reason' })).toThrow();
  });

  it('leaves The Shadow Claw out of 2-player games and auto-assigns a forced last pick', () => {
    const two = createDrafting(DEFAULT_CFG, 3, makeSeats(2));
    expect(two.leaderDraft!.pool.some((c) => c.kind === 'leader-shadow-claw')).toBe(false);
    expect(two.leaderDraft!.pool).toHaveLength(5);
    expect(createDrafting(DEFAULT_CFG, 3, makeSeats(3)).leaderDraft!.pool.some((c) => c.kind === 'leader-shadow-claw')).toBe(true);

    let six = createDrafting(DEFAULT_CFG, 3, makeSeats(6));
    for (let i = 0; i < 5; i++) {
      six = applyAction(six, { type: 'choosePartyLeader', playerId: six.activePlayerId!, leaderKind: six.leaderDraft!.pool[0]!.kind });
    }
    expect(six.subPhase).toBe('awaitingAction');
    expect(Object.keys(six.partyLeaders)).toHaveLength(6);
  });

  it('lets a Party Leader meet a Monster class symbol but never count as a Hero', () => {
    const s = cleanTwoPlayer();
    const orthus = monsterFrom('monster-orthus'); // 1 Wizard + 1 Hero
    const abyss = monsterFrom('monster-abyss-queen'); // 2 Heroes
    const bard = heroCard('peanut', 'bard');
    s.parties.p1 = [inParty(bard)];
    s.partyLeaders.p1 = leaderCard('leader-cloaked-sage', 'wizard');
    expect(canAttackMonster(s, 'p1', orthus)).toBe(true);
    expect(canAttackMonster(s, 'p1', abyss)).toBe(false);
    s.partyLeaders.p1 = leaderCard('leader-fist-of-reason', 'fighter');
    expect(canAttackMonster(s, 'p1', orthus)).toBe(false);
    s.parties.p1 = [inParty(bard), inParty(heroCard('mellow-dee', 'bard'))];
    expect(canAttackMonster(s, 'p1', orthus)).toBe(false);
    // One Wizard Hero can't pay for both symbols…
    s.parties.p1 = [inParty(heroCard('hopper', 'wizard'))];
    expect(canAttackMonster(s, 'p1', orthus)).toBe(false);
    // …but a Wizard plus any Hero can.
    s.parties.p1 = [inParty(heroCard('hopper', 'wizard')), inParty(bard)];
    expect(canAttackMonster(s, 'p1', orthus)).toBe(true);
  });

  it('wins on a full Party only when that player ends their own turn', () => {
    let s = cleanTwoPlayer();
    // p2 holds all six classes (Wizard via the leader) while it is p1's turn.
    s.parties.p2 = [
      inParty(heroCard('bad-axe', 'fighter')),
      inParty(heroCard('peanut', 'bard')),
      inParty(heroCard('wise-shield', 'guardian')),
      inParty(heroCard('hook', 'ranger')),
      inParty(heroCard('kit-napper', 'thief')),
    ];
    expect(partyClasses(s, 'p2').size).toBe(6);
    s = applyAction(s, { type: 'drawCard', playerId: 'p1' });
    expect(s.phase).toBe('playing');
    s = applyAction(s, { type: 'endTurn', playerId: 'p1' });
    expect(s.phase).toBe('playing');
    expect(s.turnPlayerId).toBe('p2');
    s = applyAction(s, { type: 'endTurn', playerId: 'p2' });
    expect(s.phase).toBe('gameOver');
    expect(s.winnerId).toBe('p2');
    expect(s.finalScores).toEqual({ p1: 0, p2: 1 });
  });

  it('has no hand limit', () => {
    let s = cleanTwoPlayer();
    s.hands.p1 = Array.from({ length: 9 }, () => mk('challenge', 'challenge'));
    s = applyAction(s, { type: 'endTurn', playerId: 'p1' });
    expect(s.turnPlayerId).toBe('p2');
    expect(s.subPhase).toBe('awaitingAction');
    expect(s.hands.p1).toHaveLength(9);
  });

  it('records every resolved roll publicly, even one no Modifier window opened for', () => {
    let s = cleanTwoPlayer();
    const peanut = heroCard('peanut', 'bard', 7);
    s.parties.p1 = [inParty(peanut)];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: peanut.id, dice: [6, 5] });
    expect(s.pendingRoll).toBeNull();
    expect(s.lastRoll).toMatchObject({ seq: 1, actorTotal: 11, subject: 'peanut', outcome: 'success' });
    expect(s.lastRoll!.roll.dice).toEqual([6, 5]);
    expect(s.hands.p1).toHaveLength(2);
  });

  it('lets one player play several Modifiers on the same roll', () => {
    let s = cleanTwoPlayer();
    const peanut = heroCard('peanut', 'bard', 7);
    const plus2 = mk('mod-plus-2-minus-2', 'modifier', null, { modifierChoices: [2, -2] });
    const plus4 = mk('mod-plus-4', 'modifier', null, { modifierChoices: [4] });
    s.parties.p1 = [inParty(peanut)];
    s.hands.p1 = [plus2, plus4];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: peanut.id, dice: [1, 1] });
    expect(s.subPhase).toBe('awaitingModifiers');
    s = applyAction(s, { type: 'playModifier', playerId: 'p1', cardId: plus2.id, chosenValue: 2 });
    expect(s.subPhase).toBe('awaitingModifiers');
    expect(s.activePlayerId).toBe('p1');
    s = applyAction(s, { type: 'playModifier', playerId: 'p1', cardId: plus4.id, chosenValue: 4 });
    expect(s.lastRoll).toMatchObject({ actorTotal: 8, outcome: 'success' });
  });

  it('enforces "no other player can play Modifier cards" on the play itself, not just the queue', () => {
    let s = cleanTwoPlayer();
    const peanut = heroCard('peanut', 'bard', 7);
    s.parties.p1 = [inParty(peanut)];
    s.hands.p1 = [mk('mod-plus-4', 'modifier', null, { modifierChoices: [4] })];
    const theirs = mk('mod-minus-4', 'modifier', null, { modifierChoices: [-4] });
    s.hands.p2 = [theirs];
    s.turnBuffs.noOpponentModifiers = true;
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: peanut.id, dice: [4, 4] });
    expect(s.subPhase).toBe('awaitingModifiers');
    expect(s.pendingRoll!.responderQueue).toEqual(['p1']);
    expect(() => applyAction(s, { type: 'playModifier', playerId: 'p2', cardId: theirs.id, chosenValue: -4 })).toThrow();
  });

  it('lets a Hero played "immediately" by an effect be Challenged, without the prompt revealing the drawn card', () => {
    let s = cleanTwoPlayer();
    const mellow = heroCard('mellow-dee', 'bard', 7);
    const drawnHero = heroCard('bad-axe', 'fighter', 8);
    const challenge = mk('challenge', 'challenge');
    s.parties.p1 = [inParty(mellow)];
    s.hands.p2 = [challenge];
    s.deck.unshift(drawnHero);
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: mellow.id, dice: [6, 6] });
    const prompt = s.promptQueue[0];
    expect(prompt?.kind).toBe('chooseCardsFromHand');
    if (prompt?.kind !== 'chooseCardsFromHand') throw new Error('expected a hand prompt');
    expect(prompt.onlyCardIds).toEqual([drawnHero.id]);
    expect(prompt.reason).not.toMatch(/bad-axe|you drew a hero/i);
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', cardIds: [drawnHero.id] });
    expect(s.subPhase).toBe('awaitingChallenge');
    expect(s.activePlayerId).toBe('p2');
    s = applyAction(s, { type: 'playChallenge', playerId: 'p2', cardId: challenge.id, actorDice: [1, 1], challengerDice: [6, 6] });
    expect(s.parties.p1.some((h) => h.card.id === drawnHero.id)).toBe(false);
    expect(s.discard.some((c) => c.id === drawnHero.id)).toBe(true);
    expect(s.lastRoll?.outcome).toBe('challengeWon');
  });

  it('still asks Mellow Dee when the drawn card is not a Hero (nothing to pick, so the table learns nothing)', () => {
    let s = cleanTwoPlayer();
    const mellow = heroCard('mellow-dee', 'bard', 7);
    const drawnMagic = mk('critical-boost', 'magic');
    s.parties.p1 = [inParty(mellow)];
    s.deck.unshift(drawnMagic);
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: mellow.id, dice: [6, 6] });
    expect(s.subPhase).toBe('awaitingPrompt');
    expect(s.promptQueue[0]?.kind).toBe('chooseCardsFromHand');
    expect(() => applyAction(s, { type: 'resolvePrompt', playerId: 'p1', cardIds: [drawnMagic.id] })).toThrow();
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', decline: true });
    expect(s.subPhase).toBe('awaitingAction');
  });

  it('asks where an Item played by an effect goes (any Hero), and Hook draws after the play', () => {
    let s = cleanTwoPlayer();
    const hook = heroCard('hook', 'ranger', 6);
    const curse = mk('curse-of-the-snakes-eyes', 'cursedItem');
    const victim = heroCard('bad-axe', 'fighter', 8);
    s.parties.p1 = [inParty(hook)];
    s.parties.p2 = [inParty(victim)];
    s.hands.p1 = [curse];
    const top = s.deck[0]!;
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: hook.id, dice: [6, 6] });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseCardsFromHand', effectTag: 'playFreeItem', optional: false });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', cardIds: [curse.id] });
    const target = s.promptQueue[0];
    expect(target).toMatchObject({ kind: 'chooseHeroTarget', mode: 'equipItem', itemCardId: curse.id });
    if (target?.kind !== 'chooseHeroTarget') throw new Error('expected a hero prompt');
    expect(validHeroTargets(s, target).map((v) => v.hero.card.id).sort()).toEqual([hook.id, victim.id].sort());
    expect(s.hands.p1.map((c) => c.id)).toEqual([curse.id]); // not drawn yet
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: victim.id });
    expect(s.parties.p2[0]!.equippedItem?.id).toBe(curse.id);
    expect(s.hands.p1.map((c) => c.id)).toEqual([top.id]);
  });

  it('gives Plundering Puma\'s victim the choice to DRAW a card', () => {
    let s = cleanTwoPlayer();
    const puma = heroCard('plundering-puma', 'thief', 6);
    s.parties.p1 = [inParty(puma)];
    s.hands.p2 = [mk('a', 'challenge'), mk('b', 'challenge'), mk('c', 'challenge')];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: puma.id, dice: [6, 6] });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p2' });
    expect(s.hands.p1).toHaveLength(2);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'confirm', playerId: 'p2' });
    expect(s.activePlayerId).toBe('p2');
    const declined = applyAction(s, { type: 'resolvePrompt', playerId: 'p2', decline: true });
    expect(declined.hands.p2).toHaveLength(1);
    const accepted = applyAction(s, { type: 'resolvePrompt', playerId: 'p2' });
    expect(accepted.hands.p2).toHaveLength(2);
  });

  it('makes Slippery Paws discard one of the two pulled cards, not any card', () => {
    let s = cleanTwoPlayer();
    const paws = heroCard('slippery-paws', 'thief', 6);
    const mine = mk('mine', 'challenge');
    s.parties.p1 = [inParty(paws)];
    s.hands.p1 = [mine];
    s.hands.p2 = [mk('a', 'challenge'), mk('b', 'challenge')];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: paws.id, dice: [6, 6] });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p2' });
    expect(() => applyAction(s, { type: 'resolvePrompt', playerId: 'p1', cardIds: [mine.id] })).toThrow();
    const pulled = s.hands.p1.find((c) => c.id !== mine.id)!;
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', cardIds: [pulled.id] });
    expect(s.discard.some((c) => c.id === pulled.id)).toBe(true);
    expect(s.hands.p1.some((c) => c.id === mine.id)).toBe(true);
  });

  it('lets Holy Curselifter choose which cursed Hero to free', () => {
    let s = cleanTwoPlayer();
    const lifter = heroCard('holy-curselifter', 'guardian', 5);
    const c1 = mk('sealing-key', 'cursedItem');
    const c2 = mk('curse-of-the-snakes-eyes', 'cursedItem');
    const a = heroCard('peanut', 'bard');
    const b = heroCard('hook', 'ranger');
    s.parties.p1 = [inParty(lifter), inParty(a, c1), inParty(b, c2)];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: lifter.id, dice: [6, 6] });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseHeroTarget', mode: 'returnCursedItem' });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: b.id });
    expect(s.hands.p1.map((c) => c.id)).toEqual([c2.id]);
    expect(s.parties.p1.find((h) => h.card.id === a.id)!.equippedItem?.id).toBe(c1.id);
    expect(s.parties.p1.find((h) => h.card.id === b.id)!.equippedItem).toBeNull();
  });

  it('has Tipsy Tootie steal first, then move to that Party', () => {
    let s = cleanTwoPlayer();
    const tootie = heroCard('tipsy-tootie', 'bard', 6);
    const theirs = heroCard('bad-axe', 'fighter', 8);
    s.parties.p1 = [inParty(tootie)];
    s.parties.p2 = [inParty(theirs)];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: tootie.id, dice: [6, 6] });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetPlayerId: 'p2' });
    const steal = s.promptQueue[0];
    if (steal?.kind !== 'chooseHeroTarget') throw new Error('expected a steal prompt');
    expect(validHeroTargets(s, steal).map((v) => v.hero.card.id)).toEqual([theirs.id]);
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: theirs.id });
    expect(s.parties.p1.map((h) => h.card.id)).toEqual([theirs.id]);
    expect(s.parties.p2.map((h) => h.card.id)).toEqual([tootie.id]);
  });

  it('fixes the expansion leaders to their published text: Manticore draws on a slay, Howl boosts every roll, Shaman is a -1 on any turn', () => {
    // The Raging Manticore: "Each time you SLAY a Monster card, DRAW 2 cards."
    let s = cleanTwoPlayer();
    s.partyLeaders.p1 = leaderCard('leader-raging-manticore', 'berserker');
    s.parties.p1 = [inParty(heroCard('peanut', 'bard'))];
    const target = s.monsterRow.find((m) => !m.requiredClass && m.requiredHeroes === 1 && !m.slayOnLow) ?? (() => {
      const m = monsterFrom('monster-arctic-aries');
      s.monsterRow.push(m);
      return m;
    })();
    s = applyAction(s, { type: 'attackMonster', playerId: 'p1', monsterCardId: target.card.id, dice: [6, 6] });
    expect(s.trophies.p1).toHaveLength(1);
    expect(s.hands.p1).toHaveLength(2);

    // The Piercing Howl: "+1 to your roll for each Item card equipped to a Hero card in your Party" on every roll.
    s = cleanTwoPlayer();
    s.partyLeaders.p1 = leaderCard('leader-piercing-howl', 'warrior');
    const ringed = inParty(heroCard('peanut', 'bard'), mk('really-big-ring', 'item'));
    s.parties.p1 = [ringed];
    const terratuga = monsterFrom('monster-terratuga');
    s.monsterRow.push(terratuga);
    s = applyAction(s, { type: 'attackMonster', playerId: 'p1', monsterCardId: terratuga.card.id, dice: [5, 5] });
    expect(s.lastRoll).toMatchObject({ actorTotal: 11, outcome: 'slain' });

    // The Noble Shaman: once per turn on *each* player's turn, -1 to any roll.
    s = cleanTwoPlayer();
    s.partyLeaders.p2 = leaderCard('leader-noble-shaman', 'druid');
    const peanut = heroCard('peanut', 'bard', 7);
    s.parties.p1 = [inParty(peanut)];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: peanut.id, dice: [3, 4] });
    expect(s.subPhase).toBe('awaitingModifiers');
    expect(s.activePlayerId).toBe('p2');
    expect(() => applyAction(s, { type: 'nobleShamanAdjust', playerId: 'p2', delta: 1 })).toThrow();
    expect(chooseAIAction(s, 'p2')).toEqual({ type: 'nobleShamanAdjust', playerId: 'p2', delta: -1 });
    s = applyAction(s, { type: 'nobleShamanAdjust', playerId: 'p2', delta: -1 });
    expect(s.lastRoll).toMatchObject({ actorTotal: 6, outcome: 'failure' });
    // Not outside a roll, and not twice in one turn.
    expect(() => applyAction(s, { type: 'nobleShamanAdjust', playerId: 'p2', delta: -1 })).toThrow();
  });

  it('makes Fuzzy Cheeks play a Hero (no "may")', () => {
    let s = cleanTwoPlayer();
    const fuzzy = heroCard('fuzzy-cheeks', 'bard', 8);
    s.parties.p1 = [inParty(fuzzy)];
    s.hands.p1 = [heroCard('peanut', 'bard')];
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: fuzzy.id, dice: [6, 6] });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseCardsFromHand', effectTag: 'playFreeHero', optional: false });
    expect(() => applyAction(s, { type: 'resolvePrompt', playerId: 'p1', decline: true })).toThrow();
  });
});

// ============================================================================
// Warriors & Druids — rebuilt from the official inventory and card pages.
// ============================================================================

const WD_CFG: HtsConfig = { expansions: ['warriors-druids'], monstersToWin: 3 };

/** A W&D card by kind, as dealt. */
function wd(kind: string): HtsCard {
  const def = HTS_WARRIORS_DRUIDS_DECK_DEFS.find((d) => d.kind === kind);
  if (!def) throw new Error(`no W&D card ${kind}`);
  return defToCard(def, nextTestId++);
}

/** Past the draft, empty hands and parties; leaders with no roll bonuses. */
function cleanGame(cfg: HtsConfig = WD_CFG, players = 2, seed = 7): HtsState {
  const s = createInitialState(cfg, seed, makeSeats(players));
  const neutral = ['leader-shadow-claw', 'leader-cloaked-sage', 'leader-divine-arrow', 'leader-charismatic-song', 'leader-protecting-horn', 'leader-fist-of-reason'];
  const classes: HtsCard['class'][] = ['thief', 'wizard', 'ranger', 'bard', 'guardian', 'fighter'];
  s.seats.forEach((seat, i) => {
    s.hands[seat.id] = [];
    s.parties[seat.id] = [];
    s.partyLeaders[seat.id] = leaderCard(neutral[i]!, classes[i]!);
  });
  return s;
}

const roll = (s: HtsState, hero: HtsCard, dice: [number, number], playerId = 'p1') => applyAction(s, { type: 'useHeroAbility', playerId, heroCardId: hero.id, dice });
const answer = (s: HtsState, a: Omit<Extract<HtsAction, { type: 'resolvePrompt' }>, 'type' | 'playerId'>, playerId = 'p1') => applyAction(s, { type: 'resolvePrompt', playerId, ...a });

describe('Here to Slay — Warriors & Druids (official card list)', () => {
  it('matches the official inventory and card pages: 2 Party Leaders, 2 Monsters, 31 main-deck cards', () => {
    expect(HTS_WARRIORS_DRUIDS_LEADERS.map((d) => d.name).sort()).toEqual(['The Noble Shaman', 'The Piercing Howl']);
    const defs = HTS_WARRIORS_DRUIDS_DECK_DEFS;
    expect(defs.reduce((n, d) => n + d.count, 0)).toBe(31);
    expect(defs.every((d) => d.count === 1 && d.expansion === 'warriors-druids')).toBe(true);
    const ofType = (t: HtsCard['type']) => defs.filter((d) => d.type === t).length;
    expect([ofType('hero'), ofType('item'), ofType('cursedItem'), ofType('magic'), ofType('modifier'), ofType('challenge')]).toEqual([16, 5, 2, 2, 4, 2]);
    // Roll requirements as printed (Druids: that number or lower).
    const rolls = Object.fromEntries(defs.filter((d) => d.type === 'hero').map((d) => [d.name, `${d.abilityThreshold}${d.rollLow ? '-' : '+'}`]));
    expect(rolls).toEqual({
      'Big Buckley': '8-', 'Buck Omens': '6-', 'Doe Fallow': '7-', 'Glowing Antler': '7-', Maegisty: '7-', 'Magus Moose': '5-', Majestelk: '7-', Stagguard: '8-',
      'Agile Dagger': '7+', 'Blinding Blade': '8+', 'Critical Fang': '6+', 'Hardened Hunter': '9+', 'Looting Lupo': '5+', 'Silent Shield': '6+', 'Tenacious Timber': '8+', 'Wolfgang Pack': '5+',
    });
    expect(defs.filter((d) => d.maxItems === 2).map((d) => d.name).sort()).toEqual(['Agile Dagger', 'Critical Fang']);
    const monster = (kind: string) => {
      const m = HTS_WARRIORS_DRUIDS_MONSTERS.find((x) => x.kind === kind)!;
      return [m.requiredHeroes, m.requiredClass, m.slayThreshold, m.failThreshold, m.failPenalty];
    };
    expect(monster('monster-feral-dragon')).toEqual([2, null, 9, 6, 'sacrificeHero']);
    expect(monster('monster-muscipula-rex')).toEqual([3, null, 10, 7, 'sacrificeHero']);
    // The invented cards are gone.
    for (const name of ['Wild Buck', 'Mightyvis', 'Valiant Valor', 'Dose of Dette', 'Wishing Wing', 'Muscipula']) {
      expect(defs.some((d) => d.name === name) || HTS_WARRIORS_DRUIDS_MONSTERS.some((m) => m.name === name)).toBe(false);
    }
    expect(HTS_EXPANSIONS.find((e) => e.id === 'warriors-druids')?.verified).toBe(true);
  });

  it('needs seven classes to win; Druids succeed on a low roll; two-Item Warriors still take one Mask', () => {
    expect(getClassesToWin(WD_CFG)).toBe(7);
    expect(getClassesToWin(hereToSlayModule.defaultConfig(makeSeats(2)))).toBe(6);
    let s = cleanGame();
    s.partyLeaders.p1 = leaderCard('leader-noble-shaman', 'druid');
    s.parties.p1 = [heroCard('a', 'fighter'), heroCard('b', 'bard'), heroCard('c', 'guardian'), heroCard('d', 'ranger'), heroCard('e', 'thief')].map((c) => inParty(c));
    expect(partyClasses(s, 'p1').size).toBe(6);
    s = applyAction(s, { type: 'endTurn', playerId: 'p1' });
    expect(s.phase).toBe('playing');
    s.parties.p2 = [];
    s = applyAction(s, { type: 'endTurn', playerId: 'p2' });
    s.parties.p1.push(inParty(heroCard('f', 'wizard')));
    s = applyAction(s, { type: 'endTurn', playerId: 'p1' });
    expect(s.winnerId).toBe('p1');

    // Stagguard (8 or lower): 8 succeeds, 9 fails.
    s = cleanGame();
    const stag = wd('stagguard');
    s.parties.p1 = [inParty(stag)];
    expect(roll(s, stag, [4, 4]).lastRoll).toMatchObject({ actorTotal: 8, outcome: 'success' });
    expect(roll(s, stag, [4, 4]).turnBuffs.noOpponentModifiers).toBe(true);
    expect(roll(s, stag, [5, 4]).lastRoll).toMatchObject({ actorTotal: 9, outcome: 'failure' });

    const dagger = inParty(wd('agile-dagger'));
    expect(canEquipItemToHero(dagger, mk('really-big-ring', 'item'))).toBe(true);
    dagger.equippedItem = mk('druid-mask', 'item', 'druid');
    expect(canEquipItemToHero(dagger, mk('really-big-ring', 'item'))).toBe(true);
    expect(canEquipItemToHero(dagger, mk('warrior-mask', 'item', 'warrior'))).toBe(false);
    dagger.extraItems = [mk('really-big-ring', 'item')];
    expect(canEquipItemToHero(dagger, mk('decoy-doll', 'item'))).toBe(false);
    const plain = inParty(wd('blinding-blade'), mk('really-big-ring', 'item'));
    expect(canEquipItemToHero(plain, mk('decoy-doll', 'item'))).toBe(false);
  });

  it('lets a class Challenge be played only with that class in your Party, at +3', () => {
    const play = (s: HtsState) => {
      const hero = heroCard('peanut', 'bard');
      s.hands.p1 = [hero];
      return applyAction(s, { type: 'playHero', playerId: 'p1', cardId: hero.id });
    };
    let s = cleanGame();
    const ch = wd('challenge-druid');
    s.hands.p2 = [ch];
    expect(play(s).subPhase).not.toBe('awaitingChallenge');
    s = cleanGame();
    s.hands.p2 = [ch];
    s.parties.p2 = [inParty(heroCard('x', 'bard'), mk('druid-mask', 'item', 'druid'))];
    s = play(s);
    expect(s.subPhase).toBe('awaitingChallenge');
    s = applyAction(s, { type: 'playChallenge', playerId: 'p2', cardId: ch.id, actorDice: [4, 4], challengerDice: [3, 2] });
    expect(s.lastRoll).toMatchObject({ actorTotal: 8, challengerTotal: 8, outcome: 'challengeWon' });
  });

  it('Big Buckley attacks a Monster for free (requirement still applies); Buck Omens brings a Hero from a hand into the Party', () => {
    let s = cleanGame();
    const bb = wd('big-buckley');
    s.parties.p1 = [inParty(bb), inParty(heroCard('peanut', 'bard'))];
    const fd = monsterFrom('monster-feral-dragon');
    s.monsterRow = [fd];
    s.actionPointsRemaining = 1;
    s = roll(s, bb, [2, 3]);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseMonster', mode: 'attack' });
    s = answer(s, { targetCardId: fd.card.id, dice: [5, 5] });
    expect(s.trophies.p1.map((m) => m.card.kind)).toEqual(['monster-feral-dragon']);
    expect(s.actionPointsRemaining).toBe(0);
    // With only Big Buckley there is no Monster it may attack: nothing to ask.
    s = cleanGame();
    s.parties.p1 = [inParty(bb)];
    s.monsterRow = [monsterFrom('monster-feral-dragon')];
    expect(roll(s, bb, [2, 3]).subPhase).toBe('awaitingAction');

    s = cleanGame();
    const bo = wd('buck-omens');
    const theirs = heroCard('bad-axe', 'fighter', 8);
    const other = mk('challenge', 'challenge');
    s.parties.p1 = [inParty(bo)];
    s.hands.p2 = [theirs, other];
    s = roll(s, bo, [1, 2]);
    s = answer(s, { targetPlayerId: 'p2' });
    const look = s.promptQueue[0]!;
    if (look.kind !== 'chooseFromPile') throw new Error('expected a look at the hand');
    expect(look.cards).toHaveLength(2);
    expect(pickablePileCards(look).map((c) => c.id)).toEqual([theirs.id]);
    expect(() => answer(s, { targetCardId: other.id })).toThrow();
    s = answer(s, { targetCardId: theirs.id });
    expect(s.parties.p1.map((h) => h.card.id)).toEqual([bo.id, theirs.id]);
    expect(s.subPhase).toBe('awaitingAction'); // not played: no Challenge, no free roll
  });

  it('Doe Fallow sacrifices then draws to 7; Majestelk sacrifices and owes +5 / -5 on each roll until the next turn', () => {
    let s = cleanGame();
    const doe = wd('doe-fallow');
    const spare = heroCard('peanut', 'bard');
    s.parties.p1 = [inParty(doe), inParty(spare)];
    s.hands.p1 = [mk('a', 'challenge'), mk('b', 'challenge')];
    s = roll(s, doe, [3, 3]);
    s = answer(s, { targetCardId: spare.id });
    expect(s.hands.p1).toHaveLength(7);
    expect(s.discard.some((c) => c.id === spare.id)).toBe(true);

    s = cleanGame();
    const elk = wd('majestelk');
    const stag = wd('stagguard');
    s.parties.p1 = [inParty(elk), inParty(heroCard('peanut', 'bard')), inParty(stag)];
    s = roll(s, elk, [3, 3]);
    s = answer(s, { targetCardId: s.parties.p1[1]!.card.id });
    expect(s.majestelk?.p1).toBe(true);
    s = roll(s, stag, [5, 4]);
    expect(s.subPhase).toBe('awaitingModifiers');
    expect(s.activePlayerId).toBe('p1');
    expect(() => applyAction(s, { type: 'declineModifier', playerId: 'p1' })).toThrow(/Majestelk/);
    expect(chooseAIAction(s, 'p1')).toEqual({ type: 'majestelkSign', playerId: 'p1', sign: -1, targetSide: 'actor' });
    s = applyAction(s, { type: 'majestelkSign', playerId: 'p1', sign: -1 });
    expect(s.lastRoll).toMatchObject({ actorTotal: 4, outcome: 'success' });
    s = applyAction(s, { type: 'endTurn', playerId: 'p1' });
    expect(s.majestelk?.p1).toBe(true); // until *your* next turn
    s = applyAction(s, { type: 'endTurn', playerId: 'p2' });
    expect(s.majestelk?.p1).toBe(false);
  });

  it('Glowing Antler plays its two Magic cards one after the other, even when the first is Challenged', () => {
    let s = cleanGame();
    const antler = wd('glowing-antler');
    const spell1 = mk('enchanted-spell', 'magic');
    const spell2 = mk('enchanted-spell', 'magic');
    s.parties.p1 = [inParty(antler)];
    s.hands.p1 = [spell1, spell2];
    s.hands.p2 = [mk('challenge', 'challenge')];
    s = roll(s, antler, [2, 2]);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseCardsFromHand', effectTag: 'playFreeMagicsUpTo2', sequence: 1 });
    s = answer(s, { cardIds: [spell1.id] });
    expect(s.subPhase).toBe('awaitingChallenge');
    s = applyAction(s, { type: 'declineChallenge', playerId: 'p2' });
    expect(s.turnBuffs.rollBonus).toBe(2);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseCardsFromHand', sequence: 2 });
    s = answer(s, { cardIds: [spell2.id] });
    s = applyAction(s, { type: 'declineChallenge', playerId: 'p2' });
    expect(s.turnBuffs.rollBonus).toBe(4);
    expect(s.subPhase).toBe('awaitingAction');
  });

  it('Maegisty returns a Hero about to be destroyed to its hand (with its Item) until its owner\'s next turn', () => {
    let s = cleanGame();
    const maeg = wd('maegisty');
    const ringed = heroCard('peanut', 'bard');
    const ring = mk('really-big-ring', 'item');
    s.parties.p1 = [inParty(maeg), inParty(ringed, ring)];
    s = roll(s, maeg, [3, 3]);
    s = applyAction(s, { type: 'endTurn', playerId: 'p1' });
    const axe = heroCard('bad-axe', 'fighter', 8);
    s.parties.p2 = [inParty(axe)];
    s = roll(s, axe, [5, 5], 'p2');
    s = answer(s, { targetCardId: ringed.id }, 'p2');
    expect(s.hands.p1.map((c) => c.id).sort()).toEqual([ringed.id, ring.id].sort());
    expect(s.discard.some((c) => c.id === ringed.id)).toBe(false);
    s = applyAction(s, { type: 'endTurn', playerId: 'p2' });
    expect(s.returnToHandShield?.p1).toBe(false);
  });

  it('Magus Moose plays the Hero it finds, and that play can be Challenged', () => {
    let s = cleanGame();
    const moose = wd('magus-moose');
    const fallen = heroCard('bad-axe', 'fighter', 8);
    s.parties.p1 = [inParty(moose)];
    s.discard = [fallen];
    s.hands.p2 = [mk('challenge', 'challenge')];
    s = roll(s, moose, [2, 2]);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseFromPile', then: 'playImmediately' });
    s = answer(s, { targetCardId: fallen.id });
    expect(s.subPhase).toBe('awaitingChallenge');
    s = applyAction(s, { type: 'declineChallenge', playerId: 'p2' });
    expect(s.parties.p1.some((h) => h.card.id === fallen.id)).toBe(true);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'rollEnteredHero' });
  });

  it('Warriors: Blinding Blade may pick yourself, Critical Fang, Hardened Hunter, Looting Lupo, Wolfgang Pack, Tenacious Timber', () => {
    let s = cleanGame();
    const blade = wd('blinding-blade');
    const curse = mk('curse-of-the-snakes-eyes', 'cursedItem');
    s.parties.p1 = [inParty(blade, curse)];
    s = roll(s, blade, [6, 6]); // 12 - 2 for the curse it wears
    expect(s.promptQueue[0]).toMatchObject({ kind: 'choosePlayer', includeSelf: true });
    s = answer(s, { targetPlayerId: 'p1' });
    expect(s.hands.p1.map((c) => c.id)).toEqual([curse.id]);

    s = cleanGame();
    const fang = wd('critical-fang');
    const tortoise = monsterFrom('monster-terratuga'); // 1 Hero, slay 11+
    s.parties.p1 = [inParty(fang)];
    s.monsterRow = [tortoise];
    s = roll(s, fang, [3, 3]);
    s = applyAction(s, { type: 'attackMonster', playerId: 'p1', monsterCardId: tortoise.card.id, dice: [3, 4] });
    expect(s.lastRoll).toMatchObject({ actorTotal: 11, outcome: 'slain' });

    s = cleanGame();
    const hunter = wd('hardened-hunter');
    s.parties.p1 = [inParty(hunter)];
    s.trophies.p2 = [monsterFrom('monster-orthus'), monsterFrom('monster-dracos')];
    expect(roll(s, hunter, [5, 5]).hands.p1).toHaveLength(2);

    s = cleanGame();
    const lupo = wd('looting-lupo');
    s.parties.p1 = [inParty(lupo, mk('really-big-ring', 'item')), inParty(heroCard('x', 'bard'), mk('decoy-doll', 'item'))];
    expect(roll(s, lupo, [3, 3]).hands.p1).toHaveLength(2);
    s.parties.p1 = [inParty(lupo)];
    expect(roll(s, lupo, [3, 3]).hands.p1).toHaveLength(0);

    s = cleanGame();
    const wolf = wd('wolfgang-pack');
    s.parties.p1 = [inParty(wolf), inParty(heroCard('x', 'bard')), inParty(heroCard('y', 'thief'))];
    expect(roll(s, wolf, [3, 3]).turnBuffs.rollBonus).toBe(2);

    s = cleanGame();
    const timber = wd('tenacious-timber');
    const a = heroCard('a', 'bard');
    const b = heroCard('b', 'thief');
    s.parties.p1 = [inParty(timber)];
    s.parties.p2 = [inParty(a), inParty(b)];
    s.trophies.p1 = [monsterFrom('monster-orthus'), monsterFrom('monster-dracos')];
    s = roll(s, timber, [4, 4]);
    s = answer(s, { targetCardId: a.id });
    s = answer(s, { targetCardId: b.id });
    expect(s.parties.p1).toHaveLength(3);
    expect(s.parties.p2).toHaveLength(0);
  });

  it('Silent Shield offers a discard-pile Hero each time you sacrifice or destroy a Hero this turn', () => {
    let s = cleanGame();
    const shield = wd('silent-shield');
    const axe = heroCard('bad-axe', 'fighter', 8);
    const victim = heroCard('peanut', 'bard');
    const old = heroCard('old', 'wizard');
    s.parties.p1 = [inParty(shield), inParty(axe)];
    s.parties.p2 = [inParty(victim)];
    s.discard = [old];
    s = roll(s, shield, [3, 3]);
    s = roll(s, axe, [5, 5]);
    s = answer(s, { targetCardId: victim.id });
    const search = s.promptQueue[0]!;
    expect(search).toMatchObject({ kind: 'chooseFromPile', optional: true, source: 'discard' });
    if (search.kind !== 'chooseFromPile') throw new Error('expected a search');
    expect(search.cards.map((c) => c.id).sort()).toEqual([old.id, victim.id].sort());
    s = answer(s, { targetCardId: old.id });
    expect(s.hands.p1.map((c) => c.id)).toEqual([old.id]);
  });

  it('Items: Bottomless Bag rolls twice a turn, Even Bigger Ring +4, Temporal Hourglass refunds a failed roll', () => {
    let s = cleanGame();
    const peanut = heroCard('peanut', 'bard', 7);
    s.parties.p1 = [inParty(peanut, mk('bottomless-bag', 'item'))];
    s = roll(s, peanut, [6, 6]);
    s = roll(s, peanut, [6, 6]);
    expect(s.actionPointsRemaining).toBe(1);
    expect(s.hands.p1).toHaveLength(4);
    s.parties.p1 = [inParty(peanut)];
    s.parties.p1[0]!.usedThisTurn = true;
    expect(() => roll(s, peanut, [6, 6])).toThrow(/already used/);

    s = cleanGame();
    s.parties.p1 = [inParty(peanut, mk('even-bigger-ring', 'item'))];
    expect(roll(s, peanut, [1, 2]).lastRoll).toMatchObject({ actorTotal: 7, outcome: 'success' });

    s = cleanGame();
    s.parties.p1 = [inParty(peanut, mk('temporal-hourglass', 'item'))];
    expect(roll(s, peanut, [1, 1]).actionPointsRemaining).toBe(3);
  });

  it('Cursed Items: Cursed Glove follows a stolen partymate; Soul Tether goes down with a fallen one', () => {
    let s = cleanGame();
    const napper = heroCard('kit-napper', 'thief', 9);
    const a = heroCard('a', 'bard');
    const gloved = heroCard('b', 'wizard');
    s.parties.p1 = [inParty(napper)];
    s.parties.p2 = [inParty(a), inParty(gloved, wd('cursed-glove'))];
    s = roll(s, napper, [5, 5]);
    s = answer(s, { targetCardId: a.id });
    expect(s.parties.p1.map((h) => h.card.id)).toEqual([napper.id, a.id, gloved.id]);
    expect(s.parties.p2).toHaveLength(0);

    s = cleanGame();
    const axe = heroCard('bad-axe', 'fighter', 8);
    const tether = wd('soul-tether');
    const tethered = heroCard('c', 'ranger');
    s.parties.p1 = [inParty(axe)];
    s.parties.p2 = [inParty(a), inParty(tethered, tether)];
    s = roll(s, axe, [5, 5]);
    s = answer(s, { targetCardId: a.id });
    expect(s.parties.p2).toHaveLength(0);
    expect(s.discard.map((c) => c.id)).toEqual(expect.arrayContaining([a.id, tethered.id, tether.id]));
  });

  it('Magic: Beast Call turns the Monsters over and adds an action point; Rapid Refresh draws 4', () => {
    let s = cleanGame();
    const call = wd('beast-call');
    const before = s.monsterRow.map((m) => m.card.id);
    const next3 = s.monsterDeck.slice(0, 3).map((m) => m.card.id);
    s.hands.p1 = [call];
    s = applyAction(s, { type: 'playMagic', playerId: 'p1', cardId: call.id });
    expect(s.monsterRow.map((m) => m.card.id)).toEqual(next3);
    expect(s.monsterDeck.slice(-3).map((m) => m.card.id)).toEqual(before);
    expect(s.actionPointsRemaining).toBe(3);

    s = cleanGame();
    const refresh = wd('rapid-refresh');
    s.hands.p1 = [refresh, mk('a', 'challenge'), mk('b', 'challenge')];
    s = applyAction(s, { type: 'playMagic', playerId: 'p1', cardId: refresh.id });
    expect(s.hands.p1).toHaveLength(4);
  });

  it('Modifiers: +1/-1 draws 2, +2/-1 draws 1, +4 draws above 12, -4 searches the discard below 2', () => {
    const withMod = (mod: HtsCard, value: number, dice: [number, number]) => {
      let s = cleanGame();
      const peanut = heroCard('peanut', 'bard', 7);
      s.parties.p1 = [inParty(peanut)];
      s.hands.p2 = [mod];
      s.discard = [mk('lost', 'challenge')];
      s = roll(s, peanut, dice);
      return applyAction(s, { type: 'playModifier', playerId: 'p2', cardId: mod.id, chosenValue: value });
    };
    expect(withMod(wd('mod-wd-plus-1-minus-1'), -1, [3, 4]).hands.p2).toHaveLength(2);
    expect(withMod(wd('mod-wd-plus-2-minus-1'), 2, [3, 4]).hands.p2).toHaveLength(1);
    expect(withMod(wd('mod-wd-plus-4'), 4, [6, 4]).hands.p2).toHaveLength(1); // 14 > 12
    expect(withMod(wd('mod-wd-plus-4'), 4, [3, 4]).hands.p2).toHaveLength(0); // 11
    const low = withMod(wd('mod-wd-minus-4'), -4, [2, 3]); // 1 < 2
    expect(low.promptQueue[0]).toMatchObject({ kind: 'chooseFromPile', playerId: 'p2', source: 'discard' });
    expect(withMod(wd('mod-wd-minus-4'), -4, [3, 3]).subPhase).toBe('awaitingAction'); // 2: not below
  });

  it('Monsters: Feral Dragon draws on any sacrifice; Muscipula Rex gives one free draw a turn', () => {
    let s = cleanGame();
    s.trophies.p2 = [monsterFrom('monster-feral-dragon')];
    const doe = wd('doe-fallow');
    s.parties.p1 = [inParty(doe)];
    s.hands.p1 = Array.from({ length: 7 }, (_, i) => mk(`c${i}`, 'challenge'));
    s = roll(s, doe, [3, 3]);
    s = answer(s, { targetCardId: doe.id });
    expect(s.hands.p2).toHaveLength(1);

    s = cleanGame();
    s.trophies.p1 = [monsterFrom('monster-muscipula-rex')];
    s = applyAction(s, { type: 'muscipulaDraw', playerId: 'p1' });
    expect(s.hands.p1).toHaveLength(1);
    expect(s.actionPointsRemaining).toBe(3);
    expect(() => applyAction(s, { type: 'muscipulaDraw', playerId: 'p1' })).toThrow();
  });

  it('plays AI-vs-AI Warriors & Druids games to the end at every player count', () => {
    for (const players of [2, 3, 4, 5, 6]) {
      for (const seed of [3, 11]) {
        const { state, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(WD_CFG, seed * 13 + players, makeSeats(players)), 4000);
        expect(stuck).toBe(false);
        expect(state.phase).toBe('gameOver');
      }
    }
  });
});

// ============================================================================
// Berserkers & Necromancers — rebuilt from the official inventory and card pages.
// ============================================================================

const BN_CFG: HtsConfig = { expansions: ['berserkers-necromancers'], monstersToWin: 3 };

function bn(kind: string): HtsCard {
  const def = HTS_BERSERKERS_NECROMANCERS_DECK_DEFS.find((d) => d.kind === kind);
  if (!def) throw new Error(`no B&N card ${kind}`);
  return defToCard(def, nextTestId++);
}

describe('Here to Slay — Berserkers & Necromancers (official card list)', () => {
  it('matches the official inventory and card pages: 2 Party Leaders, 2 Monsters, 31 main-deck cards', () => {
    expect(HTS_BERSERKERS_NECROMANCERS_LEADERS.map((d) => d.name).sort()).toEqual(['The Gnawing Dread', 'The Raging Manticore']);
    const defs = HTS_BERSERKERS_NECROMANCERS_DECK_DEFS;
    expect(defs.reduce((n, d) => n + d.count, 0)).toBe(31);
    const ofType = (t: HtsCard['type']) => defs.filter((d) => d.type === t).reduce((n, d) => n + d.count, 0);
    expect([ofType('hero'), ofType('item'), ofType('cursedItem'), ofType('magic'), ofType('modifier'), ofType('challenge')]).toEqual([16, 5, 2, 4, 2, 2]);
    expect(defs.filter((d) => d.count === 2).map((d) => d.name).sort()).toEqual(['Lightning Labrys', 'Mass Sacrifice']);
    const rolls = Object.fromEntries(defs.filter((d) => d.type === 'hero').map((d) => [d.name, d.abilityThreshold]));
    expect(rolls).toEqual({
      'Bark Hexer': 7, 'Beholden Retriever': 5, 'Bone Collector': 7, 'Boston Terror': 7, 'Grim Pupper': 8, 'Hollow Husk': 6, 'Perfect Vessel': 4, 'Shadow Saint': 5,
      Annihilator: 6, 'Brawling Spirit': 9, 'Gruesome Gladiator': 10, Meowntain: 6, 'Rabid Beast': 6, 'Roaryal Guard': 9, 'Unbridled Fury': 8, 'Vicious Wildcat': 12,
    });
    expect(defs.some((d) => d.rollLow)).toBe(false);
    expect(defs.filter((d) => d.maxItems === 2).map((d) => d.name).sort()).toEqual(['Meowntain', 'Vicious Wildcat']);
    const monster = (kind: string) => {
      const m = HTS_BERSERKERS_NECROMANCERS_MONSTERS.find((x) => x.kind === kind)!;
      return [m.requiredHeroes, m.requiredClass, m.slayThreshold, m.failThreshold, m.failPenalty];
    };
    expect(monster('monster-doombringer')).toEqual([2, 'necromancer', 8, 4, 'discardHand']);
    expect(monster('monster-reptilian-ripper')).toEqual([2, 'berserker', 7, 6, 'sacrificeTwoHeroes']);
    for (const name of ['Soul Tether', 'Bloodstone', 'Clawed Nightmare', 'Venomous Gemini']) {
      expect(defs.some((d) => d.name === name) || HTS_BERSERKERS_NECROMANCERS_MONSTERS.some((m) => m.name === name)).toBe(false);
    }
    expect(HTS_EXPANSIONS.find((e) => e.id === 'berserkers-necromancers')?.verified).toBe(true);
    expect(getClassesToWin(BN_CFG)).toBe(7);
    expect(getClassesToWin({ expansions: ['warriors-druids', 'berserkers-necromancers'], monstersToWin: 3 })).toBe(7);
  });

  it('Necromancer costs come first: unpaid, the rest of the effect does not happen', () => {
    // Bark Hexer: DISCARD a card, then each other player DISCARDS 2.
    let s = cleanGame(BN_CFG);
    const hexer = bn('bark-hexer');
    s.parties.p1 = [inParty(hexer)];
    s.hands.p2 = [mk('a', 'challenge'), mk('b', 'challenge'), mk('c', 'challenge')];
    expect(roll(s, hexer, [4, 4]).hands.p2).toHaveLength(3); // no card to pay with
    s.hands.p1 = [mk('cost', 'challenge')];
    s = roll(s, hexer, [4, 4]);
    s = answer(s, { cardIds: [s.hands.p1[0]!.id] });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseCardsFromHand', playerId: 'p2', count: 2 });

    // Shadow Saint: DISCARD a Modifier card, then no other Modifiers this turn.
    s = cleanGame(BN_CFG);
    const saint = bn('shadow-saint');
    s.parties.p1 = [inParty(saint)];
    s.hands.p1 = [mk('not-a-modifier', 'challenge')];
    expect(roll(s, saint, [3, 3]).turnBuffs.noOpponentModifiers).toBe(false);
    const mod = mk('mod-plus-4', 'modifier', null, { modifierChoices: [4] });
    s.hands.p1.push(mod);
    s = roll(s, saint, [3, 3]);
    s = applyAction(s, { type: 'declineModifier', playerId: 'p1' }); // p1 could have modified the roll
    expect(() => answer(s, { cardIds: [s.hands.p1[0]!.id] })).toThrow();
    s = answer(s, { cardIds: [mod.id] });
    expect(s.turnBuffs.noOpponentModifiers).toBe(true);

    // Bone Collector: SACRIFICE an Item card, then fetch a Hero and play it.
    s = cleanGame(BN_CFG);
    const bones = bn('bone-collector');
    const fallen = heroCard('bad-axe', 'fighter', 8);
    s.parties.p1 = [inParty(bones)];
    s.discard = [fallen];
    expect(roll(s, bones, [4, 4]).subPhase).toBe('awaitingAction'); // no Item: nothing
    const ring = mk('really-big-ring', 'item');
    s.parties.p1 = [inParty(bones, ring)];
    s = roll(s, bones, [3, 3]); // 6 + 2 for the ring
    expect(s.promptQueue[0]).toMatchObject({ kind: 'choosePartyCard', filter: 'item' });
    s = answer(s, { targetCardId: ring.id });
    s = answer(s, { targetCardId: fallen.id });
    expect(s.parties.p1.map((h) => h.card.id)).toEqual([bones.id, fallen.id]);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'rollEnteredHero' });

    // Beholden Retriever: SACRIFICE a Hero, then fetch a Hero or Item and play it (an Item asks where).
    s = cleanGame(BN_CFG);
    const retriever = bn('beholden-retriever');
    const spare = heroCard('peanut', 'bard');
    const doll = mk('decoy-doll', 'item');
    s.parties.p1 = [inParty(retriever), inParty(spare)];
    s.discard = [doll];
    s = roll(s, retriever, [3, 3]);
    s = answer(s, { targetCardId: spare.id });
    s = answer(s, { targetCardId: doll.id });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseHeroTarget', mode: 'equipItem', itemCardId: doll.id });
    s = answer(s, { targetCardId: retriever.id });
    expect(s.parties.p1[0]!.equippedItem?.id).toBe(doll.id);

    // Perfect Vessel: SACRIFICE this card, then STEAL a Hero.
    s = cleanGame(BN_CFG);
    const vessel = bn('perfect-vessel');
    const theirs = heroCard('kit-napper', 'thief', 9);
    s.parties.p1 = [inParty(vessel)];
    s.parties.p2 = [inParty(theirs)];
    s = roll(s, vessel, [2, 2]);
    s = answer(s, { targetCardId: theirs.id });
    expect(s.parties.p1.map((h) => h.card.id)).toEqual([theirs.id]);
    expect(s.discard.some((c) => c.id === vessel.id)).toBe(true);
  });

  it('Boston Terror: the chosen player may give a card; if not, you may take 2 from the discard pile', () => {
    const start = () => {
      const s = cleanGame(BN_CFG);
      const terror = bn('boston-terror');
      s.parties.p1 = [inParty(terror)];
      s.discard = [mk('d1', 'challenge'), mk('d2', 'challenge'), mk('d3', 'challenge')];
      return { s: roll(s, terror, [4, 4]), terror };
    };
    let { s } = start();
    const gift = mk('gift', 'challenge');
    s.hands.p2 = [gift];
    s = answer(s, { targetPlayerId: 'p2' });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseCardsFromHand', playerId: 'p2', optional: true, effectTag: 'bostonTerrorGive' });
    const given = answer(s, { cardIds: [gift.id] }, 'p2');
    expect(given.hands.p1.map((c) => c.id)).toEqual([gift.id]);
    expect(given.subPhase).toBe('awaitingAction');
    let refused = answer(s, { decline: true }, 'p2');
    expect(refused.promptQueue[0]).toMatchObject({ kind: 'chooseFromPile', playerId: 'p1', optional: true });
    refused = answer(refused, { targetCardId: refused.discard[0]!.id });
    refused = answer(refused, { targetCardId: refused.discard[0]!.id });
    expect(refused.hands.p1).toHaveLength(2);
    // Nothing in hand to give: straight to the discard pile.
    ({ s } = start());
    s = answer(s, { targetPlayerId: 'p2' });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseFromPile', playerId: 'p1' });
  });

  it('"SACRIFICE a card" takes a Hero or an equipped Item: Grim Pupper, Brawling Spirit, Meowntain, Rabid Beast', () => {
    let s = cleanGame(BN_CFG, 3);
    const pupper = bn('grim-pupper');
    const ringed = heroCard('peanut', 'bard');
    const ring = mk('really-big-ring', 'item');
    s.parties.p1 = [inParty(pupper)];
    s.parties.p2 = [inParty(ringed, ring)];
    s = roll(s, pupper, [4, 4]);
    expect(s.promptQueue.map((p) => p.playerId)).toEqual(['p1', 'p2', 'p3']);
    s = answer(s, { targetCardId: pupper.id });
    expect(s.activePlayerId).toBe('p2'); // p3 has nothing to sacrifice: skipped after
    s = answer(s, { targetCardId: ring.id }, 'p2');
    expect(s.parties.p2[0]!.equippedItem).toBeNull();
    expect(s.discard.map((c) => c.id)).toEqual(expect.arrayContaining([pupper.id, ring.id]));
    expect(s.subPhase).toBe('awaitingAction');

    // Brawling Spirit: only Parties of more than 3 cards (Heroes and their Items).
    s = cleanGame(BN_CFG, 3);
    const brawler = bn('brawling-spirit');
    s.parties.p1 = [inParty(brawler)];
    s.parties.p2 = [inParty(heroCard('a', 'bard'), mk('r1', 'item')), inParty(heroCard('b', 'thief'), mk('r2', 'item'))];
    s.parties.p3 = [inParty(heroCard('c', 'bard')), inParty(heroCard('d', 'thief')), inParty(heroCard('e', 'wizard'))];
    s = roll(s, brawler, [5, 5]);
    expect(s.promptQueue.map((p) => p.playerId)).toEqual(['p2']);

    // Meowntain: +5 this turn and a card sacrificed.
    s = cleanGame(BN_CFG);
    const cat = bn('meowntain');
    s.parties.p1 = [inParty(cat), inParty(heroCard('x', 'bard'))];
    s = roll(s, cat, [3, 3]);
    expect(s.turnBuffs.rollBonus).toBe(5);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'choosePartyCard', optional: false, mode: 'sacrifice' });

    // Rabid Beast: sacrifice any number, then destroy that many.
    s = cleanGame(BN_CFG);
    const beast = bn('rabid-beast');
    const curse = mk('sealing-key', 'cursedItem');
    const fodder = heroCard('fodder', 'bard');
    const t1 = heroCard('t1', 'bard');
    const t2 = heroCard('t2', 'thief');
    s.parties.p1 = [inParty(beast), inParty(fodder, curse)];
    s.parties.p2 = [inParty(t1), inParty(t2, mk('t2ring', 'item'))];
    s = roll(s, beast, [3, 3]);
    s = answer(s, { targetCardId: curse.id });
    s = answer(s, { targetCardId: fodder.id });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'choosePartyCard', effectTag: 'rabidBeastSacrifice', tally: 2 });
    s = answer(s, { decline: true });
    expect(s.promptQueue.filter((p) => p.kind === 'choosePartyCard' && p.mode === 'destroy')).toHaveLength(2);
    s = answer(s, { targetCardId: t1.id });
    s = answer(s, { targetCardId: t2.id });
    expect(s.parties.p2).toHaveLength(0);
  });

  it('Hollow Husk takes a Magic card it may play; Gruesome Gladiator takes a card from every other hand; Annihilator finds a Challenge', () => {
    let s = cleanGame(BN_CFG);
    const husk = bn('hollow-husk');
    const spell = mk('enchanted-spell', 'magic');
    s.parties.p1 = [inParty(husk)];
    s.hands.p2 = [spell, heroCard('h', 'bard')];
    s = roll(s, husk, [3, 3]);
    s = answer(s, { targetPlayerId: 'p2' });
    s = answer(s, { targetCardId: spell.id });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseCardsFromHand', effectTag: 'playFreeMagic', onlyCardIds: [spell.id], optional: true });
    s = answer(s, { cardIds: [spell.id] });
    expect(s.turnBuffs.rollBonus).toBe(2);

    s = cleanGame(BN_CFG, 3);
    const glad = bn('gruesome-gladiator');
    s.parties.p1 = [inParty(glad)];
    s.hands.p2 = [mk('a', 'challenge')];
    s.hands.p3 = [mk('b', 'challenge'), mk('c', 'challenge')];
    s = roll(s, glad, [5, 5]);
    s = answer(s, { targetCardId: s.hands.p2[0]!.id });
    s = answer(s, { targetCardId: s.hands.p3[1]!.id });
    expect(s.hands.p1).toHaveLength(2);
    expect(s.hands.p3).toHaveLength(1);

    s = cleanGame(BN_CFG);
    const anni = bn('annihilator');
    const ch = mk('challenge', 'challenge');
    s.parties.p1 = [inParty(anni)];
    s.discard = [mk('x', 'magic'), ch];
    s = roll(s, anni, [3, 3]);
    s = answer(s, { targetCardId: ch.id });
    expect(s.hands.p1.map((c) => c.id)).toEqual([ch.id]);
  });

  it('Roaryal Guard sends a whole class home (Masks count); Unbridled Fury gains a point on a Berserker; Vicious Wildcat slays outright and ends the turn', () => {
    let s = cleanGame(BN_CFG);
    const guard = bn('roaryal-guard');
    const bard = heroCard('bard', 'bard');
    const masked = heroCard('masked', 'thief');
    const mask = mk('bard-mask', 'item', 'bard');
    s.parties.p1 = [inParty(guard)];
    s.parties.p2 = [inParty(bard), inParty(masked, mask), inParty(heroCard('wiz', 'wizard'))];
    s = roll(s, guard, [5, 5]);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseClass' });
    if (s.promptQueue[0]!.kind !== 'chooseClass') throw new Error('expected a class prompt');
    expect(s.promptQueue[0]!.classes).toContain('berserker');
    s = answer(s, { className: 'bard' });
    expect(s.parties.p2.map((h) => h.card.kind)).toEqual(['wiz']);
    expect(s.hands.p2.map((c) => c.id).sort()).toEqual([bard.id, masked.id, mask.id].sort());

    s = cleanGame(BN_CFG);
    const fury = bn('unbridled-fury');
    const zerk = bn('annihilator');
    const plain = heroCard('plain', 'bard');
    s.parties.p1 = [inParty(fury)];
    s.parties.p2 = [inParty(zerk), inParty(plain)];
    s = roll(s, fury, [4, 4]);
    expect(answer(s, { targetCardId: zerk.id }).actionPointsRemaining).toBe(3);
    expect(answer(s, { targetCardId: plain.id }).actionPointsRemaining).toBe(2);

    s = cleanGame(BN_CFG);
    const wildcat = bn('vicious-wildcat');
    s.parties.p1 = [inParty(wildcat)];
    const big = s.monsterRow[0]!;
    big.requiredHeroes = 4;
    s = roll(s, wildcat, [6, 6]);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseMonster', mode: 'slay' });
    s = answer(s, { targetCardId: big.card.id });
    expect(s.trophies.p1.map((m) => m.card.id)).toEqual([big.card.id]);
    expect(s.turnPlayerId).toBe('p2');
  });

  it('Items: Biggest Ring Ever, Goblet of Caffeination, Silver Lining; Cursed: Dragon\'s Bile, Soulbound Grimoire', () => {
    let s = cleanGame(BN_CFG);
    const peanut = heroCard('peanut', 'bard', 7);
    s.parties.p1 = [inParty(peanut, bn('biggest-ring-ever'))];
    s.hands.p1 = [mk('a', 'challenge'), mk('b', 'challenge')];
    s = roll(s, peanut, [1, 2]);
    expect(s.subPhase).toBe('awaitingModifiers');
    expect(chooseAIAction(s, 'p1')).toMatchObject({ type: 'biggestRingDiscard', cardIds: expect.any(Array) });
    s = applyAction(s, { type: 'biggestRingDiscard', playerId: 'p1', cardIds: s.hands.p1.map((c) => c.id) });
    expect(s.lastRoll).toMatchObject({ actorTotal: 7, outcome: 'success' });

    s = cleanGame(BN_CFG);
    const goblet = bn('goblet-of-caffeination');
    s.parties.p1 = [inParty(peanut, goblet)];
    s = roll(s, peanut, [1, 1]);
    expect(s.promptQueue[0]).toMatchObject({ kind: 'rerollHero', itemCardId: goblet.id });
    s = answer(s, { dice: [6, 6] });
    expect(s.lastRoll).toMatchObject({ actorTotal: 12, outcome: 'success' });
    expect(s.parties.p1[0]!.equippedItem).toBeNull();
    expect(s.discard.some((c) => c.id === goblet.id)).toBe(true);

    s = cleanGame(BN_CFG);
    s.parties.p1 = [inParty(peanut, bn('silver-lining'))];
    expect(roll(s, peanut, [1, 1]).turnBuffs.rollBonus).toBe(2);

    s = cleanGame(BN_CFG);
    s.parties.p1 = [inParty(peanut, bn('dragons-bile')), inParty(heroCard('x', 'thief'))];
    expect(roll(s, peanut, [1, 1]).promptQueue[0]).toMatchObject({ kind: 'chooseHeroTarget', mode: 'sacrifice', scope: 'own' });

    s = cleanGame(BN_CFG);
    s.parties.p1 = [inParty(peanut, bn('soulbound-grimoire'))];
    expect(roll(s, peanut, [6, 6]).actionPointsRemaining).toBe(1);
    s.actionPointsRemaining = 1;
    expect(() => roll(s, peanut, [6, 6])).toThrow(/AP/);
  });

  it('Modifiers: +2/-2 becomes +4 on your own Monster attack; +7 discards the rest of your hand', () => {
    let s = cleanGame(BN_CFG);
    const m22 = bn('mod-bn-plus-2-minus-2');
    const tortoise = monsterFrom('monster-terratuga');
    s.parties.p1 = [inParty(heroCard('x', 'bard'))];
    s.monsterRow = [tortoise];
    s.hands.p1 = [m22];
    s = applyAction(s, { type: 'attackMonster', playerId: 'p1', monsterCardId: tortoise.card.id, dice: [3, 4] });
    expect(() => applyAction(s, { type: 'playModifier', playerId: 'p1', cardId: m22.id, chosenValue: 2 })).toThrow();
    s = applyAction(s, { type: 'playModifier', playerId: 'p1', cardId: m22.id, chosenValue: 4 });
    expect(s.lastRoll).toMatchObject({ actorTotal: 11, outcome: 'slain' });

    s = cleanGame(BN_CFG);
    const seven = bn('mod-bn-plus-7');
    const peanut = heroCard('peanut', 'bard', 7);
    s.parties.p1 = [inParty(peanut)];
    s.hands.p2 = [seven, mk('a', 'challenge'), mk('b', 'challenge')];
    s = roll(s, peanut, [1, 1]);
    s = applyAction(s, { type: 'playModifier', playerId: 'p2', cardId: seven.id, chosenValue: 7 });
    expect(s.hands.p2).toHaveLength(0);
    expect(s.lastRoll).toMatchObject({ actorTotal: 9, outcome: 'success' });
  });

  it('Magic: Lightning Labrys makes one chosen player sacrifice per card discarded; Mass Sacrifice redraws 5', () => {
    let s = cleanGame(BN_CFG, 3);
    const labrys = bn('lightning-labrys');
    s.hands.p1 = [labrys, mk('a', 'challenge'), mk('b', 'challenge')];
    s.parties.p2 = [inParty(heroCard('x', 'bard')), inParty(heroCard('y', 'thief'))];
    s.parties.p3 = [inParty(heroCard('z', 'wizard'))];
    s = applyAction(s, { type: 'playMagic', playerId: 'p1', cardId: labrys.id });
    s = answer(s, { cardIds: s.hands.p1.map((c) => c.id) });
    expect(s.promptQueue.filter((p) => p.kind === 'choosePlayer')).toHaveLength(2);
    s = answer(s, { targetPlayerId: 'p2' });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseHeroTarget', playerId: 'p2', mode: 'sacrifice' });
    s = answer(s, { targetCardId: s.parties.p2[0]!.card.id }, 'p2');
    s = answer(s, { targetPlayerId: 'p2' });
    s = answer(s, { targetCardId: s.parties.p2[0]!.card.id }, 'p2');
    expect(s.parties.p2).toHaveLength(0);

    s = cleanGame(BN_CFG);
    const mass = bn('mass-sacrifice');
    s.hands.p1 = [mass, mk('a', 'challenge')];
    s = applyAction(s, { type: 'playMagic', playerId: 'p1', cardId: mass.id });
    expect(s.hands.p1).toHaveLength(5);
  });

  it('Monsters: Doombringer (discard your hand; a pick from the discard pile per sacrifice), Reptilian Ripper (sacrifice 2; +2 to attack)', () => {
    let s = cleanGame(BN_CFG);
    const doom = monsterFrom('monster-doombringer');
    s.partyLeaders.p1 = leaderCard('leader-gnawing-dread', 'necromancer');
    s.parties.p1 = [inParty(heroCard('x', 'bard'))];
    s.hands.p1 = [mk('a', 'challenge'), mk('b', 'challenge')];
    s.monsterRow = [doom];
    s = applyAction(s, { type: 'attackMonster', playerId: 'p1', monsterCardId: doom.card.id, dice: [1, 2] });
    expect(s.hands.p1).toHaveLength(0);

    s = cleanGame(BN_CFG);
    s.trophies.p1 = [monsterFrom('monster-doombringer')];
    const pupper = bn('grim-pupper');
    s.parties.p1 = [inParty(pupper)];
    s.discard = [mk('treasure', 'magic')];
    s = roll(s, pupper, [4, 4]);
    s = answer(s, { targetCardId: pupper.id });
    expect(s.promptQueue[0]).toMatchObject({ kind: 'chooseFromPile', playerId: 'p1', optional: true });
    s = answer(s, { targetCardId: s.discard.find((c) => c.kind === 'treasure')!.id });
    expect(s.hands.p1.map((c) => c.kind)).toEqual(['treasure']);

    s = cleanGame(BN_CFG);
    const ripper = monsterFrom('monster-reptilian-ripper');
    s.partyLeaders.p1 = leaderCard('leader-raging-manticore', 'berserker');
    s.parties.p1 = [inParty(heroCard('x', 'bard')), inParty(heroCard('y', 'thief'))];
    s.monsterRow = [ripper];
    s = applyAction(s, { type: 'attackMonster', playerId: 'p1', monsterCardId: ripper.card.id, dice: [2, 3] });
    expect(s.promptQueue.filter((p) => p.kind === 'chooseHeroTarget' && p.mode === 'sacrifice')).toHaveLength(2);
    s = cleanGame(BN_CFG);
    s.trophies.p1 = [monsterFrom('monster-reptilian-ripper')];
    s.parties.p1 = [inParty(heroCard('x', 'bard'))];
    const tortoise = monsterFrom('monster-terratuga');
    s.monsterRow = [tortoise];
    s = applyAction(s, { type: 'attackMonster', playerId: 'p1', monsterCardId: tortoise.card.id, dice: [4, 5] });
    expect(s.lastRoll).toMatchObject({ actorTotal: 11, outcome: 'slain' });
  });

  it('Berserker / Necromancer Challenges need that class in your Party', () => {
    let s = cleanGame(BN_CFG);
    const ch = bn('challenge-necromancer');
    s.hands.p2 = [ch];
    const hero = heroCard('peanut', 'bard');
    s.hands.p1 = [hero];
    expect(applyAction(s, { type: 'playHero', playerId: 'p1', cardId: hero.id }).subPhase).not.toBe('awaitingChallenge');
    s.partyLeaders.p2 = leaderCard('leader-gnawing-dread', 'necromancer');
    s = applyAction(s, { type: 'playHero', playerId: 'p1', cardId: hero.id });
    expect(s.subPhase).toBe('awaitingChallenge');
  });

  it('plays AI-vs-AI games to the end with Berserkers & Necromancers, alone and with Warriors & Druids', () => {
    for (const cfg of [BN_CFG, { expansions: ['warriors-druids', 'berserkers-necromancers'], monstersToWin: 3 } as HtsConfig]) {
      for (const players of [2, 3, 4, 5, 6]) {
        for (const seed of [5, 17]) {
          const { state, stuck } = playOut({ applyAction, chooseAIAction }, createInitialState(cfg, seed * 19 + players, makeSeats(players)), 4000);
          expect(stuck).toBe(false);
          expect(state.phase).toBe('gameOver');
        }
      }
    }
  });
});
