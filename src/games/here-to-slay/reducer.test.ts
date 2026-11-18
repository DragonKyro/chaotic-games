import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
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
import { applyAction, createInitialState, getClassesToWin, partyClasses } from './reducer';
import type { HtsCard, HtsConfig } from './types';

function makeSeats(n: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    color: '#000',
    isAI: true,
    isLocal: false,
  }));
}

const DEFAULT_CFG: HtsConfig = { expansions: [], monstersToWin: 3 };

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

  it('deals 1 Party Leader and 5 cards to each player and 3 Monsters to the center row', () => {
    const seats = makeSeats(4);
    const s = createInitialState(DEFAULT_CFG, 42, seats);
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
    expect(s.phase).toBe('gameOver');
    expect(s.winnerId).toBe('p1');
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
    // Now total is 8 - 3 = 5 <= 6! Prompt opens to choose from discard!
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

    // 3. The Raging Manticore (+2 cards on destroy) + Venomous Gemini (+1 card on destroy) + Soul Tether on victim
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

    // Raging Manticore (+2) + Venomous Gemini (+1) => p1 drew 3 cards!
    expect(s.hands.p1.length).toBe(p1HandBefore + 3);
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
        let s = createInitialState(DEFAULT_CFG, seed * 29, makeSeats(playerCount));
        let steps = 0;
        while (s.phase !== 'gameOver' && steps < 2500) {
          const active = s.activePlayerId;
          expect(active).toBeTruthy();
          const action = chooseAIAction(s, active!);
          expect(action).toBeTruthy();
          s = applyAction(s, action!);
          steps++;
        }
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
      let s = createInitialState(cfg, 77, makeSeats(3));
      let steps = 0;
      while (s.phase !== 'gameOver' && steps < 3000) {
        const active = s.activePlayerId;
        expect(active).toBeTruthy();
        const action = chooseAIAction(s, active!);
        expect(action).toBeTruthy();
        s = applyAction(s, action!);
        steps++;
      }
      expect(s.phase).toBe('gameOver');
      expect(s.winnerId).toBeTruthy();
    }
  });
});
