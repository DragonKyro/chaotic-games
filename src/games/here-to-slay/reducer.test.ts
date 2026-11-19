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
} from './cards';
import { chooseAIAction } from './ai';
import { hereToSlayModule } from './module';
import {
  applyAction,
  canAttackMonster,
  createInitialState as createDrafting,
  getClassesToWin,
  partyClasses,
  validHeroTargets,
} from './reducer';
import type { HtsCard, HtsConfig, HtsMonster, HtsPartyHero, HtsState } from './types';
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

  it('implements Warriors & Druids: 7-class win condition, Druid low-roll heroes, Piercing Howl, Noble Shaman, Feral Dragon, and Muscipula', () => {
    const cfg: HtsConfig = { expansions: ['warriors-druids'], monstersToWin: 3 };
    expect(getClassesToWin(cfg)).toBe(7);

    const seats = makeSeats(2);
    let s = createInitialState(cfg, 123, seats);
    s.hands.p1 = [];
    s.hands.p2 = [];

    // 1. Druid low-roll Hero (Big Buckley <=6) + AI preferring negative modifier on low-roll
    const bigBuckley: HtsCard = {
      id: 701,
      kind: 'big-buckley',
      name: 'Big Buckley',
      type: 'hero',
      class: 'druid',
      text: '',
      abilityThreshold: 6,
      rollLow: true,
      modifierChoices: null,
    };
    const discardedHero: HtsCard = {
      id: 702,
      kind: 'looting-lupo',
      name: 'Looting Lupo',
      type: 'hero',
      class: 'warrior',
      text: '',
      abilityThreshold: 5,
      modifierChoices: null,
    };
    const modCard: HtsCard = {
      id: 703,
      kind: 'mod-plus-1-minus-3',
      name: 'Modifier +1/-3',
      type: 'modifier',
      class: null,
      text: '',
      abilityThreshold: null,
      modifierChoices: [1, -3],
    };

    s.partyLeaders.p1 = {
      id: 1,
      kind: 'leader-noble-shaman',
      name: 'The Noble Shaman',
      type: 'partyLeader',
      class: 'druid',
      text: '',
      abilityThreshold: null,
      modifierChoices: null,
    };
    s.parties.p1 = [{ card: bigBuckley, equippedItem: null, usedThisTurn: false }];
    s.discard = [discardedHero];
    s.hands.p1 = [modCard];

    // Roll [4, 4] = 8 for Big Buckley (needs <=6). AI should pick Modifier -3!
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 701, dice: [4, 4] });
    expect(s.subPhase).toBe('awaitingModifiers');
    const aiModAction = chooseAIAction(s, 'p1');
    expect(aiModAction).toEqual({
      type: 'playModifier',
      playerId: 'p1',
      cardId: 703,
      chosenValue: -3,
      protectingHornDelta: -1,
    });
    s = applyAction(s, aiModAction!);
    // The window reopens for everyone after a Modifier (p1 still has an unused
    // Noble Shaman); 8 - 3 = 5 is already <= 6, so the AI passes.
    s = playOut({ applyAction, chooseAIAction }, s, 10, (x) => x.subPhase !== 'awaitingModifiers').state;
    // Total 5 <= 6! Prompt opens to choose from discard!
    expect(s.subPhase).toBe('awaitingPrompt');
    expect(s.promptQueue[0]?.kind).toBe('chooseFromPile');
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: 702 });
    expect(s.hands.p1.some((c) => c.id === 702)).toBe(true);

    // 2. Muscipula trophy draws a card when a Hero ability roll fails (e.g. rolling 10 on a <=6 Druid roll)
    s.trophies.p1 = [
      {
        card: { id: 710, kind: 'monster-muscipula', name: 'Muscipula', type: 'monster', class: null, text: '', abilityThreshold: null, modifierChoices: null },
        requiredHeroes: 2,
        requiredClass: 'druid',
        requirementText: '1 Druid + 1 Hero',
        slayThreshold: 8,
        failThreshold: 4,
        failPenalty: 'discard2',
      },
    ];
    s.parties.p1[0]!.usedThisTurn = false;
    s.turnBuffs.nobleShamanUsed = true;
    const handBeforeFail = s.hands.p1.length;
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 701, dice: [5, 5] });
    expect(s.hands.p1.length).toBe(handBeforeFail + 1);

    // 3. The Piercing Howl (+1 per equipped item in Party) & Agile Dagger equipping 2 items
    s.partyLeaders.p1 = {
      id: 2,
      kind: 'leader-piercing-howl',
      name: 'The Piercing Howl',
      type: 'partyLeader',
      class: 'warrior',
      text: '',
      abilityThreshold: null,
      modifierChoices: null,
    };
    const agileDagger: HtsCard = {
      id: 720,
      kind: 'agile-dagger',
      name: 'Agile Dagger',
      type: 'hero',
      class: 'warrior',
      text: '',
      abilityThreshold: 6,
      maxItems: 2,
      modifierChoices: null,
    };
    const ring1: HtsCard = { id: 721, kind: 'really-big-ring', name: 'Really Big Ring', type: 'item', class: null, text: '', abilityThreshold: null, modifierChoices: null };
    const bag: HtsCard = { id: 722, kind: 'bottomless-bag', name: 'Bottomless Bag', type: 'item', class: null, text: '', abilityThreshold: null, modifierChoices: null };
    s.parties.p1 = [{ card: agileDagger, equippedItem: null, usedThisTurn: false }];
    s.actionPointsRemaining = 3;
    s.hands.p1 = [ring1, bag];
    s = applyAction(s, { type: 'equipItem', playerId: 'p1', cardId: 721, targetPlayerId: 'p1', heroCardId: 720 });
    s = applyAction(s, { type: 'equipItem', playerId: 'p1', cardId: 722, targetPlayerId: 'p1', heroCardId: 720 });
    expect(s.parties.p1[0]?.equippedItem?.id).toBe(721);
    expect(s.parties.p1[0]?.extraItems?.length).toBe(1);
  });

  it('implements Berserkers & Necromancers: Raging Manticore, Gnawing Dread, Bone Collector revive, Clawed Nightmare, Venomous Gemini, and Soul Tether', () => {
    const cfg: HtsConfig = { expansions: ['berserkers-necromancers'], monstersToWin: 3 };
    const seats = makeSeats(2);
    let s = createInitialState(cfg, 456, seats);
    s.hands.p1 = [];
    s.hands.p2 = [];

    // 1. The Gnawing Dread spends 2 AP to search discard pile for any card
    s.partyLeaders.p1 = {
      id: 1,
      kind: 'leader-gnawing-dread',
      name: 'The Gnawing Dread',
      type: 'partyLeader',
      class: 'necromancer',
      text: '',
      abilityThreshold: null,
      modifierChoices: null,
    };
    const boneCollector: HtsCard = {
      id: 601,
      kind: 'bone-collector',
      name: 'Bone Collector',
      type: 'hero',
      class: 'necromancer',
      text: '',
      abilityThreshold: 8,
      modifierChoices: null,
    };
    const fallenFighter: HtsCard = {
      id: 602,
      kind: 'bad-axe',
      name: 'Bad Axe',
      type: 'hero',
      class: 'fighter',
      text: '',
      abilityThreshold: 8,
      modifierChoices: null,
    };
    s.discard = [boneCollector, fallenFighter];
    s.actionPointsRemaining = 3;

    s = applyAction(s, { type: 'gnawingDreadSearch', playerId: 'p1' });
    expect(s.actionPointsRemaining).toBe(1);
    expect(s.subPhase).toBe('awaitingPrompt');
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: 601 });
    expect(s.hands.p1.some((c) => c.id === 601)).toBe(true);

    // 2. Bone Collector revives Bad Axe from discard directly into Party, and Clawed Nightmare triggers free roll!
    s.trophies.p1 = [
      {
        card: { id: 610, kind: 'monster-clawed-nightmare', name: 'Clawed Nightmare', type: 'monster', class: null, text: '', abilityThreshold: null, modifierChoices: null },
        requiredHeroes: 2,
        requiredClass: 'necromancer',
        requirementText: '1 Necromancer + 1 Hero',
        slayThreshold: 8,
        failThreshold: 4,
        failPenalty: 'discard2',
      },
    ];
    s = applyAction(s, { type: 'playHero', playerId: 'p1', cardId: 601 });
    // Roll [5, 5] = 10 for Bone Collector's free entry roll
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', dice: [5, 5] });
    // Choose fallenFighter (602) from discard to revive directly into Party
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: 602 });
    expect(s.parties.p1.some((h) => h.card.id === 602)).toBe(true);
    // Clawed Nightmare triggers rollEnteredHero for the revived Hero!
    expect(s.promptQueue[0]?.kind).toBe('rollEnteredHero');
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', decline: true });

    // 3. Venomous Gemini (+1 card on destroy) + Soul Tether on victim. The Raging
    // Manticore draws on a SLAY, not a destroy, so it adds nothing here.
    s.partyLeaders.p1 = {
      id: 2,
      kind: 'leader-raging-manticore',
      name: 'The Raging Manticore',
      type: 'partyLeader',
      class: 'berserker',
      text: '',
      abilityThreshold: null,
      modifierChoices: null,
    };
    s.trophies.p1.push({
      card: { id: 611, kind: 'monster-venomous-gemini', name: 'Venomous Gemini', type: 'monster', class: null, text: '', abilityThreshold: null, modifierChoices: null },
      requiredHeroes: 2,
      requiredClass: 'berserker',
      requirementText: '1 Berserker + 1 Hero',
      slayThreshold: 8,
      failThreshold: 4,
      failPenalty: 'discard2',
    });
    const soulTether: HtsCard = {
      id: 620,
      kind: 'soul-tether',
      name: 'Soul Tether',
      type: 'item',
      class: null,
      text: '',
      abilityThreshold: null,
      modifierChoices: null,
    };
    const victimHero: HtsCard = {
      id: 621,
      kind: 'peanut',
      name: 'Peanut',
      type: 'hero',
      class: 'bard',
      text: '',
      abilityThreshold: 7,
      modifierChoices: null,
    };
    s.parties.p2 = [{ card: victimHero, equippedItem: soulTether, usedThisTurn: false }];
    s.actionPointsRemaining = 2;
    const p1HandBefore = s.hands.p1.length;

    // Use Bad Axe (602) in p1's party to destroy p2's Peanut (621)
    s = applyAction(s, { type: 'useHeroAbility', playerId: 'p1', heroCardId: 602, dice: [5, 5] });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: 621 });

    // Venomous Gemini (+1) only.
    expect(s.hands.p1.length).toBe(p1HandBefore + 1);
    // Soul Tether returned Peanut (621) to p2's hand instead of the discard pile!
    expect(s.hands.p2.some((c) => c.id === 621)).toBe(true);
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
  const def = HTS_MONSTER_DEFS.find((m) => m.kind === kind)!;
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
