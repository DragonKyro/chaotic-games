import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import {
  buildHldDecks,
  HLD_5_6_DISASTER_DEFS,
  HLD_5_6_MAIN_DECK_DEFS,
  HLD_DATING_DISASTER_DEFS,
  HLD_DATING_MAIN_DECK_DEFS,
  HLD_DISASTER_DEFS,
  HLD_HAZARD_CARD_DEFS,
  HLD_HAZARDS_DISASTER_DEFS,
  HLD_HAZARDS_MAIN_DECK_DEFS,
  HLD_MAIN_DECK_DEFS,
  HLD_PUBERTY_DISASTER_DEFS,
  HLD_PUBERTY_MAIN_DECK_DEFS,
} from './cards';
import { chooseAIAction } from './ai';
import { happyLittleDinosModule } from './module';
import { applyAction, computeRoundScores, createInitialState, isEliminatedByDisasters } from './reducer';
import type { HldConfig } from './types';

function makeSeats(n: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    color: '#000',
    isAI: true,
    isLocal: false,
  }));
}

const DEFAULT_CFG: HldConfig = { expansions: [], trackLength: 50 };

describe('Happy Little Dinosaurs — deck & setup', () => {
  it('has 28 Disaster cards and 69 Main Deck cards (53 Point + 16 Instant = 97 total)', () => {
    expect(HLD_DISASTER_DEFS.length).toBe(28);
    const pointCount = HLD_MAIN_DECK_DEFS.filter((d) => d.type === 'point').reduce((s, d) => s + d.count, 0);
    const instCount = HLD_MAIN_DECK_DEFS.filter((d) => d.type === 'instant').reduce((s, d) => s + d.count, 0);
    expect(pointCount).toBe(53);
    expect(instCount).toBe(16);
    expect(pointCount + instCount + HLD_DISASTER_DEFS.length).toBe(97);
  });

  it('has exact card counts for all 4 expansions (5–6 Player, Perils of Puberty, Dating Disasters, Hazards Ahead)', () => {
    // 1. 5–6 Player Expansion: 14 Disasters + 36 Main cards (28 Point + 8 Instant) = 50 cards
    expect(HLD_5_6_DISASTER_DEFS.length).toBe(14);
    const p56Main = HLD_5_6_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0);
    expect(p56Main).toBe(36);

    // 2. Perils of Puberty: 16 Disasters + 28 Point + 10 Instant = 54 cards
    expect(HLD_PUBERTY_DISASTER_DEFS.length).toBe(16);
    const pubPoints = HLD_PUBERTY_MAIN_DECK_DEFS.filter((d) => d.type === 'point').reduce((s, d) => s + d.count, 0);
    const pubInsts = HLD_PUBERTY_MAIN_DECK_DEFS.filter((d) => d.type === 'instant').reduce((s, d) => s + d.count, 0);
    expect(pubPoints).toBe(28);
    expect(pubInsts).toBe(10);
    expect(HLD_PUBERTY_DISASTER_DEFS.length + pubPoints + pubInsts).toBe(54);

    // 3. Dating Disasters: 15 Disasters + 26 Point + 12 Instant = 53 cards
    expect(HLD_DATING_DISASTER_DEFS.length).toBe(15);
    const datPoints = HLD_DATING_MAIN_DECK_DEFS.filter((d) => d.type === 'point').reduce((s, d) => s + d.count, 0);
    const datInsts = HLD_DATING_MAIN_DECK_DEFS.filter((d) => d.type === 'instant').reduce((s, d) => s + d.count, 0);
    expect(datPoints).toBe(26);
    expect(datInsts).toBe(12);
    expect(HLD_DATING_DISASTER_DEFS.length + datPoints + datInsts).toBe(53);

    // 4. Hazards Ahead: 22 Disasters + 16 Standard + 12 Hazard cards = 50 cards
    expect(HLD_HAZARDS_DISASTER_DEFS.length).toBe(22);
    const hazMain = HLD_HAZARDS_MAIN_DECK_DEFS.reduce((s, d) => s + d.count, 0);
    const hazCards = HLD_HAZARD_CARD_DEFS.reduce((s, d) => s + d.count, 0);
    expect(hazMain).toBe(16);
    expect(hazCards).toBe(12);
    expect(HLD_HAZARDS_DISASTER_DEFS.length + hazMain + hazCards).toBe(50);

    // Verify buildHldDecks with all 4 expansions enabled
    const built = buildHldDecks(
      { seed: 123 },
      ['players-5-6', 'perils-of-puberty', 'dating-disasters', 'hazards-ahead'],
    );
    expect(built.disasterDeck.length).toBe(28 + 14 + 16 + 15 + 22);
    expect(built.deck.length).toBe(69 + 36 + 38 + 38 + 16);
    expect(built.hazardDeck.length).toBe(12);
  });

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

  it('validates all 4 expansion IDs and supports custom Dinosaur selection in config', () => {
    const seats = makeSeats(5);
    const cfg: HldConfig = {
      expansions: ['players-5-6', 'perils-of-puberty', 'dating-disasters', 'hazards-ahead'],
      trackLength: 50,
      dinoSelections: { p1: 'raging-raptor', p2: 'pterry-dactyl' },
    };
    expect(happyLittleDinosModule.validateConfig(cfg)).toEqual([]);
    expect(happyLittleDinosModule.Thumbnail).toBeTruthy();

    const s = createInitialState(cfg, 7, seats);
    expect(s.dinos.p1).toBe('raging-raptor');
    expect(s.dinos.p2).toBe('pterry-dactyl');
  });
});

describe('Happy Little Dinosaurs — elimination & mechanics', () => {
  it('evaluates 3 same, 3 different, and Meteor wild elimination rules', () => {
    expect(
      isEliminatedByDisasters([
        { id: 1, name: 'A', category: 'natural', text: '' },
        { id: 2, name: 'B', category: 'natural', text: '' },
      ]),
    ).toBe(false);

    // 3 same
    expect(
      isEliminatedByDisasters([
        { id: 1, name: 'A', category: 'natural', text: '' },
        { id: 2, name: 'B', category: 'natural', text: '' },
        { id: 3, name: 'C', category: 'natural', text: '' },
      ]),
    ).toBe(true);

    // 3 different
    expect(
      isEliminatedByDisasters([
        { id: 1, name: 'A', category: 'natural', text: '' },
        { id: 2, name: 'B', category: 'predator', text: '' },
        { id: 3, name: 'C', category: 'emotional', text: '' },
      ]),
    ).toBe(true);

    // 1 Meteor + 2 other cards = always eliminated
    expect(
      isEliminatedByDisasters([
        { id: 1, name: 'A', category: 'natural', text: '' },
        { id: 2, name: 'B', category: 'natural', text: '' },
        { id: 3, name: 'M', category: 'meteor', text: '' },
      ]),
    ).toBe(true);
  });

  it('awards points to both the 1st and 2nd highest scorers in a 5–6 player game', () => {
    const seats = makeSeats(5);
    let s = createInitialState({ expansions: ['players-5-6'], trackLength: 50 }, 99, seats);
    // Neutralize dino traits by setting a Meteor disaster and non-Stego dinos
    s.currentDisaster = { id: 900, name: 'Meteor!', category: 'meteor', text: 'Wild' };
    s.dinos = {
      p1: 'nervous-rex',
      p2: 'cry-ceratops',
      p3: 'bad-luck-bronto',
      p4: 'pterry-dactyl',
      p5: 'raging-raptor',
    };
    // Give each player a known plain Point card (9, 7, 5, 3, 1) and no instants
    const values = [9, 7, 5, 3, 1];
    seats.forEach((seat, idx) => {
      s.hands[seat.id] = [
        {
          id: 800 + idx,
          kind: 'meteor-cannon',
          name: `Pt${values[idx]}`,
          type: 'point',
          value: values[idx]!,
          hasEffect: false,
          text: '',
        },
      ];
    });

    for (let i = 0; i < 5; i++) {
      s = applyAction(s, { type: 'submitPick', playerId: `p${i + 1}`, cardId: 800 + i });
    }

    // Round resolved: p1 (score 9) and p2 (score 7) both advanced; p5 (score 1) took the Disaster (+1 end-of-round disaster bonus)
    expect(s.trackPosition.p1).toBe(9);
    expect(s.trackPosition.p2).toBe(7);
    expect(s.trackPosition.p3).toBe(0);
    expect(s.trackPosition.p4).toBe(0);
    expect(s.disasterAreas.p5?.length).toBe(1);
    expect(s.trackPosition.p5).toBe(1);
  });

  it('resolves Perils of Puberty cards (Trash into Treasure, BFFs Help, Lucky Break)', () => {
    const seats = makeSeats(3);
    let s = createInitialState({ expansions: ['perils-of-puberty'], trackLength: 50 }, 11, seats);
    s.currentDisaster = { id: 901, name: 'Meteor!', category: 'meteor', text: 'Wild' };
    s.dinos = { p1: 'nervous-rex', p2: 'cry-ceratops', p3: 'bad-luck-bronto' };

    // Put a Point card in the discard pile for Trash into Treasure
    s.discard.push({
      id: 700,
      kind: 'meteor-cannon',
      name: 'Meteor Cannon',
      type: 'point',
      value: 9,
      hasEffect: false,
      text: 'Point Value: 9.',
    });

    s.hands.p1 = [
      {
        id: 701,
        kind: 'trash-into-treasure',
        name: 'Trash into Treasure',
        type: 'point',
        value: 7,
        hasEffect: true,
        text: 'Take a Point card from discard.',
      },
    ];
    s.hands.p2 = [
      { id: 702, kind: 'run-home-bat', name: 'Run Home Bat', type: 'point', value: 5, hasEffect: false, text: '' },
      { id: 703, kind: 'bffs-help', name: "BFF's Help", type: 'instant', value: null, hasEffect: true, text: '' },
      { id: 704, kind: 'bow-and-dino', name: 'Bow and Dino', type: 'point', value: 6, hasEffect: false, text: '' },
    ];
    s.hands.p3 = [
      { id: 705, kind: 'cool-stick', name: 'Cool Stick', type: 'point', value: 1, hasEffect: false, text: '' },
      { id: 706, kind: 'lucky-break', name: 'Lucky Break', type: 'instant', value: null, hasEffect: true, text: '' },
      { id: 707, kind: 'handy-pan', name: 'Handy Pan', type: 'point', value: 2, hasEffect: false, text: '' },
    ];

    s = applyAction(s, { type: 'submitPick', playerId: 'p1', cardId: 701 });
    s = applyAction(s, { type: 'submitPick', playerId: 'p2', cardId: 702 });
    s = applyAction(s, { type: 'submitPick', playerId: 'p3', cardId: 705 });

    // Trash into Treasure prompt for p1
    expect(s.subPhase).toBe('pointEffects');
    expect(s.promptQueue[0]?.kind).toBe('trashIntoTreasurePick');
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: 700 });
    expect(s.hands.p1.some((c) => c.id === 700)).toBe(true);

    // Scoring Instants window: p2 plays BFF's Help using Bow and Dino (val 6) without discarding it
    expect(s.subPhase).toBe('awaitingScoringInstants');
    s = applyAction(s, {
      type: 'playScoringInstant',
      playerId: 'p2',
      cardId: 703,
      targetPlayerId: 'p2',
      handCardId: 704,
    });
    expect(s.hands.p2.some((c) => c.id === 704)).toBe(true);

    // p3 has lowest score (1) and holds Lucky Break + a Point card (707) -> awaitingDisasterSave
    expect(s.subPhase).toBe('awaitingDisasterSave');
    expect(s.pendingDisasterVictimId).toBe('p3');
    s = applyAction(s, {
      type: 'playDisasterSave',
      playerId: 'p3',
      cardId: 706,
      discardCardId: 707,
    });
    // p3 dodged the disaster!
    expect(s.disasterAreas.p3.length).toBe(0);
    expect(s.roundNumber).toBe(2);
  });

  it('resolves Dating Disasters cards (Cold Feet, Awkward First Kiss, Double Date)', () => {
    const seats = makeSeats(3);
    let s = createInitialState({ expansions: ['dating-disasters'], trackLength: 50 }, 23, seats);
    s.currentDisaster = { id: 902, name: 'Meteor!', category: 'meteor', text: 'Wild' };
    s.dinos = { p1: 'nervous-rex', p2: 'cry-ceratops', p3: 'bad-luck-bronto' };

    s.discard.push({
      id: 600,
      kind: 'mixtape',
      name: 'Mixtape',
      type: 'point',
      value: 9,
      hasEffect: false,
      text: 'Point Value: 9.',
    });

    s.hands.p1 = [
      { id: 601, kind: 'cold-feet', name: 'Cold Feet', type: 'point', value: 0, hasEffect: true, text: '' },
    ];
    s.hands.p2 = [
      { id: 602, kind: 'teddy-bear', name: 'Teddy Bear', type: 'point', value: 4, hasEffect: false, text: '' },
      { id: 603, kind: 'double-date', name: 'Double Date', type: 'instant', value: null, hasEffect: true, text: '' },
    ];
    s.hands.p3 = [
      { id: 604, kind: 'broken-high-heel', name: 'Broken High Heel', type: 'point', value: 1, hasEffect: false, text: '' },
      { id: 605, kind: 'awkward-first-kiss', name: 'Awkward First Kiss', type: 'instant', value: null, hasEffect: true, text: '' },
    ];

    s = applyAction(s, { type: 'submitPick', playerId: 'p1', cardId: 601 });
    s = applyAction(s, { type: 'submitPick', playerId: 'p2', cardId: 602 });
    s = applyAction(s, { type: 'submitPick', playerId: 'p3', cardId: 604 });

    // Cold Feet prompt for p1 swaps Cold Feet (0) with Mixtape (9) in discard
    expect(s.promptQueue[0]?.kind).toBe('coldFeetSwap');
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: 600 });
    expect(s.revealedPicks.p1?.id).toBe(600);

    // p2 plays Double Date (+2 to p2 and +2 to p1); queue advances automatically to p3
    expect(s.subPhase).toBe('awaitingScoringInstants');
    s = applyAction(s, {
      type: 'playScoringInstant',
      playerId: 'p2',
      cardId: 603,
      targetPlayerId: 'p2',
      secondPlayerId: 'p1',
    });
    expect(computeRoundScores(s).p1).toBe(11);
    expect(computeRoundScores(s).p2).toBe(6);

    // p3 plays Awkward First Kiss to swap scores with p1 (11 <-> 1), which finalizes round scoring
    s = applyAction(s, {
      type: 'playScoringInstant',
      playerId: 'p3',
      cardId: 605,
      targetPlayerId: 'p1',
    });
    // p3 had the highest score (11) after swapping with p1, so p3 advanced +11 on Escape Route!
    expect(s.trackPosition.p3).toBe(11);
  });

  it('resolves Hazards Ahead Hazard Deck, persistent penalties, and Molotov Crocktail removal', () => {
    const seats = makeSeats(2);
    let s = createInitialState({ expansions: ['hazards-ahead'], trackLength: 50 }, 55, seats);
    // Flip a Disaster that draws a Hazard card
    s.currentDisaster = {
      id: 950,
      name: 'Boiling Mud Pit',
      category: 'natural',
      text: 'Also draw a Hazard card.',
      drawsHazard: true,
    };
    s.dinos = { p1: 'stego', p2: 'stego' };
    s.hazardDeck = [
      {
        id: 960,
        name: 'Slippery Mud',
        penalty: 'score-minus-1',
        text: '-1 to your score each round.',
      },
    ];
    s.hands.p1 = [
      { id: 501, kind: 'hazard-suit', name: 'Hazard Suit', type: 'point', value: 8, hasEffect: false, text: '' },
    ];
    s.hands.p2 = [
      { id: 502, kind: 'safety-cone', name: 'Safety Cone', type: 'point', value: 3, hasEffect: false, text: '' },
    ];

    s = applyAction(s, { type: 'submitPick', playerId: 'p1', cardId: 501 });
    s = applyAction(s, { type: 'submitPick', playerId: 'p2', cardId: 502 });

    // p2 lost Round 1 and drew Slippery Mud into their Hazard Area!
    expect(s.hazardAreas.p2.length).toBe(1);
    expect(s.hazardAreas.p2[0]?.name).toBe('Slippery Mud');

    // In Round 2, p2 plays Molotov Crocktail (val 5) to remove the Hazard card
    s.currentDisaster = { id: 951, name: 'Meteor!', category: 'meteor', text: 'Wild' };
    s.hands.p1 = [
      { id: 503, kind: 'hazard-suit', name: 'Hazard Suit', type: 'point', value: 8, hasEffect: false, text: '' },
    ];
    s.hands.p2 = [
      {
        id: 504,
        kind: 'molotov-crocktail',
        name: 'Molotov Crocktail',
        type: 'point',
        value: 5,
        hasEffect: true,
        text: 'Remove a Hazard card.',
      },
    ];
    s = applyAction(s, { type: 'submitPick', playerId: 'p1', cardId: 503 });
    s = applyAction(s, { type: 'submitPick', playerId: 'p2', cardId: 504 });

    expect(s.subPhase).toBe('pointEffects');
    expect(s.promptQueue[0]?.kind).toBe('removeHazardPick');
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p2', targetCardId: 960 });
    expect(s.hazardAreas.p2.length).toBe(0);
    expect(s.hazardDiscard.length).toBe(1);
  });

  it('plays full AI-vs-AI games across 2, 3, and 4 players to completion', () => {
    for (const playerCount of [2, 3, 4]) {
      for (let seed = 1; seed <= 4; seed++) {
        let s = createInitialState(DEFAULT_CFG, seed * 31, makeSeats(playerCount));
        let steps = 0;
        while (s.phase !== 'gameOver' && steps < 2000) {
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

  it('plays full AI-vs-AI games with all 4 expansions enabled across 2–6 players', () => {
    const allExpConfig: HldConfig = {
      expansions: ['players-5-6', 'perils-of-puberty', 'dating-disasters', 'hazards-ahead'],
      trackLength: 50,
    };
    for (const playerCount of [3, 5, 6]) {
      for (let seed = 1; seed <= 3; seed++) {
        let s = createInitialState(allExpConfig, seed * 47, makeSeats(playerCount));
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
