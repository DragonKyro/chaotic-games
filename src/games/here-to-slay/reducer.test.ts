import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import { HTS_MAIN_DECK_DEFS, HTS_MONSTER_DEFS, HTS_PARTY_LEADERS } from './cards';
import { chooseAIAction } from './ai';
import { applyAction, createInitialState, partyClasses } from './reducer';
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

  it('plays full AI-vs-AI games to completion', () => {
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
  });
});
