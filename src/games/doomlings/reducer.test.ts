import { describe, expect, it } from 'vitest';
import type { Seat } from '@/core/types';
import {
  DM_AGE_DEFS,
  DM_CATASTROPHE_DEFS,
  DM_EXPANSION_AGE_DEFS,
  DM_EXPANSION_CATASTROPHE_DEFS,
  DM_EXPANSION_TRAIT_SEEDS,
  DM_OBJECTIVE_DEFS,
} from './cards';
import { chooseAIAction } from './ai';
import { doomlingsModule } from './module';
import {
  applyAction,
  canPlayTrait,
  computePlayerScore,
  countColorInTableau,
  createInitialState,
  distinctColorsInTableau,
  effectiveGenePool,
  isObjectiveFulfilled,
} from './reducer';
import { DM_EXPANSIONS } from './types';
import type { DmConfig, DmTraitCard } from './types';

function makeSeats(n: number): Seat[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Player ${i + 1}`,
    color: '#000',
    isAI: true,
    isLocal: false,
  }));
}

const DEFAULT_CFG: DmConfig = { expansions: [] };
const ALL_EXPANSIONS_CFG: DmConfig = {
  expansions: DM_EXPANSIONS.map((e) => e.id),
};

describe('Doomlings — deck & setup', () => {
  it('has 25 Ages, 15 Catastrophes, 7 verified expansions, and builds a 13-card Age Deck (Birth of Life + 3 Eras of 4)', () => {
    expect(DM_AGE_DEFS.length).toBe(25);
    expect(DM_CATASTROPHE_DEFS.length).toBe(15);
    expect(DM_EXPANSIONS.length).toBe(7);
    expect(DM_EXPANSION_TRAIT_SEEDS.length).toBeGreaterThanOrEqual(40);
    expect(DM_EXPANSION_AGE_DEFS.length).toBeGreaterThanOrEqual(10);
    expect(DM_EXPANSION_CATASTROPHE_DEFS.length).toBeGreaterThanOrEqual(2);
    expect(DM_OBJECTIVE_DEFS.length).toBeGreaterThanOrEqual(10);

    const seats = makeSeats(4);
    const s = createInitialState(DEFAULT_CFG, 42, seats);
    expect(s.currentAge.kind).toBe('birthOfLife');
    expect(s.ageDeck.length).toBe(12);
    expect(s.ageDeck.filter((a) => a.kind === 'catastrophe').length).toBe(3);
    for (const seat of seats) {
      expect(s.hands[seat.id]?.length).toBe(5);
      expect(effectiveGenePool(s, seat.id)).toBe(5);
      expect(s.suppressedCount[seat.id]).toBe(0);
      expect(s.objectives[seat.id]).toBeNull();
    }
  });

  it('validates all 7 expansions in module.ts and includes expansion cards per source', () => {
    expect(doomlingsModule.Thumbnail).toBeDefined();
    expect(doomlingsModule.validateConfig(ALL_EXPANSIONS_CFG)).toEqual([]);
    expect(doomlingsModule.validateConfig({ expansions: ['unknown-pack'] }).length).toBe(1);

    for (const exp of DM_EXPANSIONS) {
      const s = createInitialState({ expansions: [exp.id] }, 99, makeSeats(3));
      const allTraits = [
        ...s.traitDeck,
        ...Object.values(s.hands).flat(),
      ];
      expect(allTraits.some((c) => c.source === exp.id)).toBe(true);
    }
  });
});

describe('Doomlings — mechanics & scoring', () => {
  it('enforces the 2-Dominant limit, dynamic Gene Pool adjustments, and Drop of Life scoring', () => {
    const seats = makeSeats(2);
    const s = createInitialState(DEFAULT_CFG, 15, seats);

    const dom1: DmTraitCard = {
      id: 901,
      kind: 'camouflage',
      name: 'Camouflage',
      color: 'purple',
      points: 2,
      dominant: true,
      genePoolDelta: 1,
      dropOfLifeTag: 'perHandCard',
      dropOfLifeMultiplier: 1,
      text: '',
    };
    const dom2: DmTraitCard = {
      id: 902,
      kind: 'ruggedized',
      name: 'Ruggedized',
      color: 'colorless',
      points: 4,
      dominant: true,
      genePoolDelta: 1,
      text: '',
    };
    const dom3: DmTraitCard = {
      id: 903,
      kind: 'sentience',
      name: 'Sentience',
      color: 'colorless',
      points: 2,
      dominant: true,
      genePoolDelta: 0,
      text: '',
    };

    s.tableaus.p1 = [dom1, dom2];
    expect(effectiveGenePool(s, 'p1')).toBe(7);
    expect(canPlayTrait(s, 'p1', dom3)).toBe(false);

    // Score check: face (2 + 4 = 6) + Camouflage (+1 per hand card = 5) = 11
    const score = computePlayerScore(s, 'p1');
    expect(score.faceValue).toBe(6);
    expect(score.dropOfLifeBonus).toBe(5);
    expect(score.total).toBe(11);
  });

  it('supports Multi-color traits (Overlush & Imaginary Ends) counting as both colors', () => {
    const s = createInitialState({ expansions: ['overlush'] }, 21, makeSeats(2));
    const snaptrap: DmTraitCard = {
      id: 1001,
      kind: 'venus-snaptrap',
      name: 'Venus Snaptrap',
      color: 'red',
      secondaryColor: 'green',
      points: 2,
      dominant: false,
      genePoolDelta: 0,
      source: 'overlush',
      text: '',
    };
    const bloom: DmTraitCard = {
      id: 1002,
      kind: 'overlush-bloom',
      name: 'Overlush Bloom',
      color: 'green',
      secondaryColor: 'blue',
      points: 4,
      dominant: true,
      genePoolDelta: 1,
      dropOfLifeTag: 'perMultiColor',
      dropOfLifeMultiplier: 2,
      source: 'overlush',
      text: '',
    };

    s.tableaus.p1 = [snaptrap, bloom];
    expect(countColorInTableau(s, 'p1', 'red')).toBe(1);
    expect(countColorInTableau(s, 'p1', 'green')).toBe(2);
    expect(countColorInTableau(s, 'p1', 'blue')).toBe(1);
    expect(distinctColorsInTableau(s, 'p1')).toEqual(['red', 'blue', 'green']);

    // Heroic requires Green: satisfied by dual-color Green trait
    const heroic: DmTraitCard = {
      id: 1003,
      kind: 'heroic',
      name: 'Heroic',
      color: 'green',
      points: 7,
      dominant: true,
      genePoolDelta: 1,
      requireColor: 'green',
      text: '',
    };
    expect(canPlayTrait(s, 'p1', heroic)).toBe(true);

    // Age restriction noGreen blocks Red/Green dual-color trait
    s.currentAge = {
      id: 2000,
      name: 'Tectonic Shift',
      kind: 'age',
      genePoolDelta: 0,
      ruleTag: 'noGreen',
      text: '',
    };
    expect(canPlayTrait(s, 'p1', snaptrap)).toBe(false);

    // Score: face (2 + 4 = 6) + Overlush Bloom (+2 per multi-color * 2 = 4) = 10
    const score = computePlayerScore(s, 'p1');
    expect(score.faceValue).toBe(6);
    expect(score.dropOfLifeBonus).toBe(4);
    expect(score.total).toBe(10);
  });

  it('supports Attachment traits (attaching to host, granting indestructible, and discarding when host leaves)', () => {
    let s = createInitialState({ expansions: ['imaginary-ends', 'legends-of-enderas'] }, 33, makeSeats(2));
    // Clear objectives for clean score assertion
    s.objectives.p1 = null;
    s.objectives.p2 = null;

    const host1: DmTraitCard = {
      id: 1101,
      kind: 'horns',
      name: 'Horns',
      color: 'red',
      points: 3,
      dominant: false,
      genePoolDelta: 0,
      text: '',
    };
    const host2: DmTraitCard = {
      id: 1102,
      kind: 'bark',
      name: 'Bark',
      color: 'green',
      points: 3,
      dominant: false,
      genePoolDelta: 0,
      text: '',
    };
    const cyberImplant: DmTraitCard = {
      id: 1103,
      kind: 'cybernetic-implant',
      name: 'Cybernetic Implant',
      color: 'blue',
      points: 2,
      dominant: false,
      genePoolDelta: 1,
      isAttachment: true,
      source: 'imaginary-ends',
      text: '',
    };
    const goldenCrown: DmTraitCard = {
      id: 1104,
      kind: 'golden-crown',
      name: 'Golden Crown',
      color: 'colorless',
      points: 3,
      dominant: false,
      genePoolDelta: 1,
      isAttachment: true,
      indestructible: true,
      grantsIndestructible: true,
      source: 'legends-of-enderas',
      text: '',
    };

    s.tableaus.p1 = [host1, host2];
    s.hands.p1 = [cyberImplant, goldenCrown, ...s.hands.p1!.slice(0, 3)];

    // P1 plays Cybernetic Implant -> prompts to choose a host trait in P1's Trait Pile
    s = applyAction(s, { type: 'playTrait', playerId: 'p1', cardId: cyberImplant.id });
    expect(s.subPhase).toBe('awaitingPrompt');
    expect(s.promptQueue[0]?.kind).toBe('chooseTraitInPile');
    if (s.promptQueue[0]?.kind === 'chooseTraitInPile') {
      expect(s.promptQueue[0].mode).toBe('attach');
    }

    // Attach Cybernetic Implant to host1 (Horns)
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: host1.id });
    const attachedImplant = s.tableaus.p1!.find((c) => c.id === cyberImplant.id);
    expect(attachedImplant?.attachedToId).toBe(host1.id);
    expect(effectiveGenePool(s, 'p1')).toBe(6);

    // P2 plays Territorial to destroy P1's host1 (Horns) -> Cybernetic Implant is discarded with its host!
    const territorial: DmTraitCard = {
      id: 1105,
      kind: 'territorial',
      name: 'Territorial',
      color: 'red',
      points: 1,
      dominant: false,
      genePoolDelta: 0,
      actionTag: 'destroyOpponentTrait',
      text: '',
    };
    s.hands.p2 = [territorial, ...s.hands.p2!.slice(0, 4)];
    s = applyAction(s, { type: 'playTrait', playerId: 'p2', cardId: territorial.id });
    expect(s.subPhase).toBe('awaitingPrompt');
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p2', targetCardId: host1.id });

    // Both host1 and Cybernetic Implant are now in traitDiscard!
    expect(s.tableaus.p1!.some((c) => c.id === host1.id)).toBe(false);
    expect(s.tableaus.p1!.some((c) => c.id === cyberImplant.id)).toBe(false);
    expect(s.traitDiscard.some((c) => c.id === host1.id)).toBe(true);
    expect(s.traitDiscard.some((c) => c.id === cyberImplant.id)).toBe(true);

    // Now P1 plays Golden Crown and attaches it to host2 (Bark) -> makes Bark indestructible!
    s.promptQueue = [];
    s.turnPlayerId = 'p1';
    s.activePlayerId = 'p1';
    s.subPhase = 'awaitingAction';
    s = applyAction(s, { type: 'playTrait', playerId: 'p1', cardId: goldenCrown.id });
    s = applyAction(s, { type: 'resolvePrompt', playerId: 'p1', targetCardId: host2.id });
    const barkInPile = s.tableaus.p1!.find((c) => c.id === host2.id);
    expect(barkInPile?.indestructible).toBe(true);
  });

  it('supports the Suppress mechanic (Shadow Puppets & Ancient Fates) and +1 / +2 per suppressed scoring', () => {
    let s = createInitialState({ expansions: ['ancient-fates', 'shadow-puppets'] }, 44, makeSeats(2));

    const chronos: DmTraitCard = {
      id: 1201,
      kind: 'chronos-weaver',
      name: 'Chronos Weaver',
      color: 'purple',
      points: 3,
      dominant: true,
      genePoolDelta: 0,
      actionTag: 'suppressFromHand2',
      dropOfLifeTag: 'perSuppressed',
      dropOfLifeMultiplier: 2,
      source: 'ancient-fates',
      text: '',
    };
    const fodder1 = s.hands.p1![0]!;
    const fodder2 = s.hands.p1![1]!;
    s.hands.p1 = [chronos, ...s.hands.p1!];

    s = applyAction(s, { type: 'playTrait', playerId: 'p1', cardId: chronos.id });
    expect(s.subPhase).toBe('awaitingPrompt');
    expect(s.promptQueue[0]?.kind).toBe('chooseCardsFromHand');

    // Suppress 2 cards from hand
    s = applyAction(s, {
      type: 'resolvePrompt',
      playerId: 'p1',
      cardIds: [fodder1.id, fodder2.id],
    });

    expect(s.suppressedCount.p1).toBe(2);
    // Score: Chronos face (3) + Drop of Life (+2 * 2 = 4) + World's End base suppress (+1 * 2 = 2) = 9
    const score = computePlayerScore(s, 'p1');
    expect(score.faceValue).toBe(3);
    expect(score.dropOfLifeBonus).toBe(4);
    expect(score.worldsEndBonus).toBe(2);
    expect(score.total).toBe(9);
  });

  it('supports Swarm and Kidney self-multiplying traits (Mokoko Village)', () => {
    const s = createInitialState({ expansions: ['mokoko-village'] }, 55, makeSeats(2));

    const makeKidney = (id: number): DmTraitCard => ({
      id,
      kind: 'kidney',
      name: 'Kidney',
      color: 'red',
      points: 0,
      dominant: false,
      genePoolDelta: 0,
      dropOfLifeTag: 'perSameKindOwnPile',
      dropOfLifeMultiplier: 2,
      source: 'mokoko-village',
      text: '',
    });
    const makeSwarm = (id: number): DmTraitCard => ({
      id,
      kind: 'swarm',
      name: 'Swarm',
      color: 'green',
      points: 0,
      dominant: false,
      genePoolDelta: 0,
      isSwarm: true,
      dropOfLifeTag: 'perSwarmAllPiles',
      dropOfLifeMultiplier: 1,
      source: 'mokoko-village',
      text: '',
    });

    // P1 has 3 Kidneys (each scores 3 * 2 = 6 -> 18 total) and 2 Swarms
    // P2 has 2 Swarms -> 4 Swarms across all piles (each P1 Swarm scores 4 -> 8 total)
    s.tableaus.p1 = [makeKidney(1), makeKidney(2), makeKidney(3), makeSwarm(4), makeSwarm(5)];
    s.tableaus.p2 = [makeSwarm(6), makeSwarm(7)];

    const p1Score = computePlayerScore(s, 'p1');
    expect(p1Score.dropOfLifeBonus).toBe(18 + 8);
    expect(p1Score.total).toBe(26);
  });

  it('evaluates Meaning of Life & Treasure Objectives (Imaginary Ends & Legends of Enderas)', () => {
    const s = createInitialState({ expansions: ['imaginary-ends', 'legends-of-enderas'] }, 66, makeSeats(2));
    expect(s.objectives.p1).toBeTruthy();
    expect(s.objectives.p2).toBeTruthy();

    s.objectives.p1 = {
      id: 3001,
      name: 'The Boundless Mind',
      kind: 'meaningOfLife',
      source: 'imaginary-ends',
      points: 5,
      conditionTag: 'genePool6Plus',
      text: 'Have a Gene Pool of 6+ (+5 pts).',
    };
    expect(isObjectiveFulfilled(s, 'p1')).toBe(false);

    s.baseGenePool.p1 = 6;
    expect(isObjectiveFulfilled(s, 'p1')).toBe(true);
    const score = computePlayerScore(s, 'p1');
    expect(score.worldsEndBonus).toBe(5);
    expect(score.total).toBe(5);
  });

  it('plays full AI-vs-AI games across 2, 3, and 4 players through all 3 Catastrophes to World\'s End', () => {
    for (const playerCount of [2, 3, 4]) {
      for (let seed = 1; seed <= 4; seed++) {
        let s = createInitialState(DEFAULT_CFG, seed * 43, makeSeats(playerCount));
        let steps = 0;
        while (s.phase !== 'gameOver' && steps < 1500) {
          const active = s.activePlayerId;
          expect(active).toBeTruthy();
          const action = chooseAIAction(s, active!);
          expect(action).toBeTruthy();
          s = applyAction(s, action!);
          steps++;
        }
        expect(s.phase).toBe('gameOver');
        expect(s.catastrophesSeen).toBe(3);
        expect(s.winnerId).toBeTruthy();
        expect(s.finalScores).toBeTruthy();
      }
    }
  });

  it('plays full AI-vs-AI games for each of the 7 expansions individually and with ALL 7 expansions enabled', () => {
    const configs: DmConfig[] = [
      ...DM_EXPANSIONS.map((e) => ({ expansions: [e.id] })),
      ALL_EXPANSIONS_CFG,
    ];

    for (let i = 0; i < configs.length; i++) {
      const cfg = configs[i]!;
      let s = createInitialState(cfg, (i + 1) * 71, makeSeats(3));
      let steps = 0;
      while (s.phase !== 'gameOver' && steps < 1500) {
        const active = s.activePlayerId;
        expect(active).toBeTruthy();
        const action = chooseAIAction(s, active!);
        expect(action).toBeTruthy();
        s = applyAction(s, action!);
        steps++;
      }
      expect(s.phase).toBe('gameOver');
      expect(s.catastrophesSeen).toBe(3);
      expect(s.winnerId).toBeTruthy();
      expect(s.finalScores).toBeTruthy();
    }
  });
});
