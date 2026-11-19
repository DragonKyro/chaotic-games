// Doomlings — pure deterministic reducer for the Base Game and all 7 official expansions.

import { createRng, rngInt, shuffle } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import { buildDmDecks, traitCountsAsColor } from './cards';
import type {
  DmAction,
  DmConfig,
  DmObjectiveCard,
  DmPrompt,
  DmState,
  DmTraitCard,
  DmTraitColor,
} from './types';
import { cloneState, pushLog, seatName } from '@/core/state';
import { DM_SCORING_COLORS } from './types';


// ============================================================================
// Setup
// ============================================================================

export function createInitialState(config: DmConfig, seed: number, seats: Seat[]): DmState {
  const rngState = createRng(seed);
  const first = seats[0];
  if (!first) throw new Error('Doomlings needs at least one seat');

  const { traitDeck, ageDeck, birthOfLife, objectiveDeck } = buildDmDecks(
    rngState,
    config.expansions ?? [],
  );
  const hands: Record<PlayerId, DmTraitCard[]> = {};
  for (const seat of seats) {
    hands[seat.id] = traitDeck.splice(0, 5);
  }

  const state: DmState = {
    phase: 'playing',
    seats,
    activePlayerId: first.id,
    finalScores: null,
    rngState,

    subPhase: 'awaitingAction',
    traitDeck,
    traitDiscard: [],
    ageDeck,
    agesPlayed: [birthOfLife],
    currentAge: birthOfLife,

    hands,
    tableaus: Object.fromEntries(seats.map((s) => [s.id, []])),
    baseGenePool: Object.fromEntries(seats.map((s) => [s.id, 5])),
    suppressedCount: Object.fromEntries(seats.map((s) => [s.id, 0])),
    objectives: Object.fromEntries(seats.map((s, i) => [s.id, objectiveDeck[i] ?? null])),
    faithColorSwap: Object.fromEntries(seats.map((s) => [s.id, null])),
    viralPenalties: [],
    denialArmed: Object.fromEntries(seats.map((s) => [s.id, false])),

    firstPlayerIndex: 0,
    turnPlayerId: first.id,
    turnsTakenInRound: 0,
    catastrophesSeen: 0,
    turnEndingAfterPrompts: false,

    promptQueue: [],
    winnerId: null,

    log: [],
    logSeq: 0,
    config,
  };

  pushLog(state, null, `🌍 The Birth of Life begins! ${seats.length} species evolve toward World's End.`, 'good');
  return state;
}

// ============================================================================
// Helpers & Continuous Gene Pool / Scoring Queries
// ============================================================================

export function handOf(s: DmState, id: PlayerId): DmTraitCard[] {
  const h = s.hands[id];
  if (!h) throw new Error(`unknown hand ${id}`);
  return h;
}

export function tableauOf(s: DmState, id: PlayerId): DmTraitCard[] {
  const t = s.tableaus[id];
  if (!t) throw new Error(`unknown tableau ${id}`);
  return t;
}

export function isCardIndestructible(tab: DmTraitCard[], card: DmTraitCard): boolean {
  if (card.indestructible) return true;
  return tab.some(
    (c) => c.attachedToId === card.id && Boolean(c.indestructible || c.grantsIndestructible),
  );
}

function discardAttachmentsForHost(s: DmState, ownerId: PlayerId, hostCardId: number) {
  const tab = tableauOf(s, ownerId);
  for (let i = tab.length - 1; i >= 0; i--) {
    const c = tab[i]!;
    if (c.attachedToId === hostCardId) {
      tab.splice(i, 1);
      delete c.attachedToId;
      s.traitDiscard.push(c);
      pushLog(
        s,
        ownerId,
        `Attachment ${c.name} was discarded because its host left ${seatName(s, ownerId)}'s Trait Pile.`,
        'danger',
      );
    }
  }
}

/**
 * Effective Gene Pool size (clamped between 1 and 8), computed dynamically from
 * `baseGenePool[playerId]` plus `genePoolDelta` of all traits in `tableaus[playerId]`.
 */
export function effectiveGenePool(s: DmState, playerId: PlayerId): number {
  const base = s.baseGenePool[playerId] ?? 5;
  const traitSum = tableauOf(s, playerId).reduce((acc, c) => acc + c.genePoolDelta, 0);
  return Math.max(1, Math.min(8, base + traitSum));
}

export function countColorInTableau(s: DmState, playerId: PlayerId, color: DmTraitColor): number {
  const swap = s.faithColorSwap[playerId] ?? null;
  return tableauOf(s, playerId).filter((c) => traitCountsAsColor(c, color, swap)).length;
}

export function distinctColorsInTableau(s: DmState, playerId: PlayerId): DmTraitColor[] {
  const colors = DM_SCORING_COLORS;
  return colors.filter((col) => countColorInTableau(s, playerId, col) > 0);
}

export function isObjectiveFulfilled(
  s: DmState,
  playerId: PlayerId,
  obj?: DmObjectiveCard | null,
): boolean {
  const target = obj !== undefined ? obj : s.objectives[playerId];
  if (!target) return false;
  const tab = tableauOf(s, playerId);

  switch (target.conditionTag) {
    case 'twoOfEachColor':
      return DM_SCORING_COLORS.every(
        (col) => countColorInTableau(s, playerId, col) >= 2,
      );
    case 'genePool6Plus':
      return effectiveGenePool(s, playerId) >= 6;
    case 'fewestTraits': {
      const minLen = Math.min(...s.seats.map((st) => tableauOf(s, st.id).length));
      return tab.length === minLen;
    }
    case 'fiveRed':
      return countColorInTableau(s, playerId, 'red') >= 5;
    case 'fiveBlue':
      return countColorInTableau(s, playerId, 'blue') >= 5;
    case 'fiveGreen':
      return countColorInTableau(s, playerId, 'green') >= 5;
    case 'fivePurple':
      return countColorInTableau(s, playerId, 'purple') >= 5;
    case 'twoDominants':
      return tab.filter((c) => c.dominant).length >= 2;
    case 'fourColorless':
      return countColorInTableau(s, playerId, 'colorless') >= 4;
    case 'eightTraits':
      return tab.length >= 8;
    default:
      return false;
  }
}

export function canPlayTrait(s: DmState, playerId: PlayerId, card: DmTraitCard): boolean {
  const tab = tableauOf(s, playerId);

  // Max 2 Dominant traits in a Trait Pile
  if (card.dominant) {
    const domCount = tab.filter((c) => c.dominant).length;
    if (domCount >= 2) return false;
  }

  // Active Age restrictions (read dynamically from currentAge!)
  const rule = s.currentAge.ruleTag;
  if (rule === 'noDominants' && card.dominant) return false;
  if (rule === 'noColorless' && (card.color === 'colorless' || card.secondaryColor === 'colorless')) return false;
  if (rule === 'noBlue' && (card.color === 'blue' || card.secondaryColor === 'blue')) return false;
  if (rule === 'noGreen' && (card.color === 'green' || card.secondaryColor === 'green')) return false;
  if (rule === 'noRed' && (card.color === 'red' || card.secondaryColor === 'red')) return false;
  if (rule === 'noPurple' && (card.color === 'purple' || card.secondaryColor === 'purple')) return false;
  if (rule === 'maxFaceValue3' && card.points > 3) return false;

  // Card-specific requirements
  if (card.requireColor && countColorInTableau(s, playerId, card.requireColor) === 0) {
    return false;
  }
  if (card.requireTraitCount && tab.length < card.requireTraitCount) {
    return false;
  }

  return true;
}

export function validTraitPileTargets(
  s: DmState,
  prompt: Extract<DmPrompt, { kind: 'chooseTraitInPile' }>,
): { ownerId: PlayerId; card: DmTraitCard }[] {
  if (prompt.scope === 'others' && s.currentAge.ruleTag === 'protectTraitPiles') {
    return [];
  }
  const results: { ownerId: PlayerId; card: DmTraitCard }[] = [];
  for (const seat of s.seats) {
    if (prompt.scope === 'own' && seat.id !== prompt.playerId) continue;
    if (prompt.scope === 'others' && seat.id === prompt.playerId) continue;

    const tab = tableauOf(s, seat.id);
    for (const card of tab) {
      if (prompt.mode === 'attach') {
        if (card.dominant || card.isAttachment || card.id === prompt.attachmentCardId) continue;
        results.push({ ownerId: seat.id, card });
      } else {
        if (card.dominant || isCardIndestructible(tab, card)) continue;
        results.push({ ownerId: seat.id, card });
      }
    }
  }
  return results;
}

/**
 * Compute detailed score breakdown for `playerId` at any point in the game.
 */
export function computePlayerScore(s: DmState, playerId: PlayerId): {
  faceValue: number;
  dropOfLifeBonus: number;
  worldsEndBonus: number;
  total: number;
} {
  const tab = tableauOf(s, playerId);
  const faceValue = tab.reduce((acc, c) => acc + c.points, 0);

  let dropOfLifeBonus = 0;
  for (const c of tab) {
    if (c.isAttachment && c.attachedToId !== undefined && c.hostBonusPoints) {
      if (tab.some((h) => h.id === c.attachedToId)) {
        dropOfLifeBonus += c.hostBonusPoints;
      }
    }

    const mult = c.dropOfLifeMultiplier ?? 1;
    switch (c.dropOfLifeTag) {
      case 'perRed':
        dropOfLifeBonus += countColorInTableau(s, playerId, 'red') * mult;
        break;
      case 'perBlue':
        dropOfLifeBonus += countColorInTableau(s, playerId, 'blue') * mult;
        break;
      case 'perGreen':
        dropOfLifeBonus += countColorInTableau(s, playerId, 'green') * mult;
        break;
      case 'perPurple':
        dropOfLifeBonus += countColorInTableau(s, playerId, 'purple') * mult;
        break;
      case 'perColorless':
        dropOfLifeBonus += countColorInTableau(s, playerId, 'colorless') * mult;
        break;
      case 'minusPerColorless':
        dropOfLifeBonus -= countColorInTableau(s, playerId, 'colorless');
        break;
      case 'perColorPair': {
        const colored =
          countColorInTableau(s, playerId, 'red') +
          countColorInTableau(s, playerId, 'blue') +
          countColorInTableau(s, playerId, 'green') +
          countColorInTableau(s, playerId, 'purple');
        dropOfLifeBonus += Math.floor(colored / 2);
        break;
      }
      case 'perHandCard':
        dropOfLifeBonus += handOf(s, playerId).length * mult;
        break;
      case 'genePoolSize':
        dropOfLifeBonus += effectiveGenePool(s, playerId);
        break;
      case 'colorVariety': {
        const cols = distinctColorsInTableau(s, playerId).length;
        dropOfLifeBonus += c.dominant ? cols * 2 : cols;
        break;
      }
      case 'symbiosisLowestColor': {
        const counts = DM_SCORING_COLORS
          .map((col) => countColorInTableau(s, playerId, col))
          .filter((n) => n > 0);
        if (counts.length >= 2) {
          dropOfLifeBonus += Math.min(...counts) * 2;
        }
        break;
      }
      case 'apexPredatorMostTraits': {
        const myLen = tab.length;
        const strictlyMost = s.seats
          .filter((st) => st.id !== playerId)
          .every((st) => tableauOf(s, st.id).length < myLen);
        if (strictlyMost) dropOfLifeBonus += 4;
        break;
      }
      case 'perMultiColor': {
        const multiCount = tab.filter((t) => Boolean(t.secondaryColor || t.isAllColors)).length;
        dropOfLifeBonus += multiCount * mult;
        break;
      }
      case 'perAttachment': {
        const attCount = tab.filter((t) => Boolean(t.isAttachment)).length;
        dropOfLifeBonus += attCount * mult;
        break;
      }
      case 'perSuppressed': {
        dropOfLifeBonus += (s.suppressedCount[playerId] ?? 0) * mult;
        break;
      }
      case 'perSameKindOwnPile': {
        const sameCount = tab.filter((t) => t.kind === c.kind).length;
        dropOfLifeBonus += sameCount * mult;
        break;
      }
      case 'perSwarmAllPiles': {
        const swarmCount = s.seats.reduce(
          (sum, st) =>
            sum + tableauOf(s, st.id).filter((t) => Boolean(t.isSwarm || t.kind === c.kind)).length,
          0,
        );
        dropOfLifeBonus += swarmCount * mult;
        break;
      }
      case 'perDominant': {
        dropOfLifeBonus += tab.filter((t) => t.dominant).length * mult;
        break;
      }
      case 'perDiscardPile3': {
        dropOfLifeBonus += Math.min(6, Math.floor(s.traitDiscard.length / 3) * mult);
        break;
      }
      case 'glassHeartBonus': {
        if (tab.some((t) => isCardIndestructible(tab, t))) {
          dropOfLifeBonus += 4;
        }
        break;
      }
      default:
        break;
    }
  }

  let worldsEndBonus = 0;
  // Suppressed cards are worth +1 point each at World's End
  worldsEndBonus += s.suppressedCount[playerId] ?? 0;

  // Personal Meaning of Life / Treasure Objective bonus if fulfilled
  const obj = s.objectives[playerId];
  if (obj && isObjectiveFulfilled(s, playerId, obj)) {
    worldsEndBonus += obj.points;
  }

  // Viral penalties from opponents
  for (const vp of s.viralPenalties) {
    if (vp.byPlayerId !== playerId) {
      worldsEndBonus -= countColorInTableau(s, playerId, vp.color);
    }
  }

  // Final Catastrophe World's End gold effect (when game is over / 3rd Catastrophe revealed)
  if (s.catastrophesSeen >= 3 && s.currentAge.kind === 'catastrophe') {
    const we = s.currentAge.worldsEndEffect;
    if (we === 'minus1PerBlue') worldsEndBonus -= countColorInTableau(s, playerId, 'blue');
    else if (we === 'minus1PerGreen') worldsEndBonus -= countColorInTableau(s, playerId, 'green');
    else if (we === 'minus1PerRed') worldsEndBonus -= countColorInTableau(s, playerId, 'red');
    else if (we === 'minus1PerPurple') worldsEndBonus -= countColorInTableau(s, playerId, 'purple');
    else if (we === 'plus1PerColorless') worldsEndBonus += countColorInTableau(s, playerId, 'colorless');
    else if (we === 'plus2PerDominant') worldsEndBonus += tab.filter((c) => c.dominant).length * 2;
    else if (we === 'plus2PerMultiColor') {
      worldsEndBonus += tab.filter((c) => Boolean(c.secondaryColor || c.isAllColors)).length * 2;
    } else if (we === 'plus1PerSuppressed') {
      worldsEndBonus += s.suppressedCount[playerId] ?? 0;
    } else if (we === 'plus4FewestTraits') {
      const minLen = Math.min(...s.seats.map((st) => tableauOf(s, st.id).length));
      if (tab.length === minLen) worldsEndBonus += 4;
    } else if (we === 'minus5MostTraits') {
      const maxLen = Math.max(...s.seats.map((st) => tableauOf(s, st.id).length));
      if (tab.length === maxLen) worldsEndBonus -= 5;
    }
  }

  const total = faceValue + dropOfLifeBonus + worldsEndBonus;
  return { faceValue, dropOfLifeBonus, worldsEndBonus, total };
}

function drawTraits(s: DmState, playerId: PlayerId, count: number) {
  for (let i = 0; i < count; i++) {
    if (s.traitDeck.length === 0 && s.traitDiscard.length > 0) {
      s.traitDeck = shuffle(s.rngState, s.traitDiscard);
      s.traitDiscard = [];
    }
    const c = s.traitDeck.shift();
    if (!c) break;
    handOf(s, playerId).push(c);
  }
}

// ============================================================================
// Turn & Round Flow
// ============================================================================

function queueStabilizeAndEndTurn(s: DmState, playerId: PlayerId) {
  const target =
    s.currentAge.ruleTag === 'stabilizeTo4' ? 4 : effectiveGenePool(s, playerId);
  const hand = handOf(s, playerId);

  if (hand.length < target) {
    drawTraits(s, playerId, target - hand.length);
  } else if (hand.length > target) {
    s.promptQueue.push({
      kind: 'chooseCardsFromHand',
      playerId,
      reason: `Stabilize: discard down to ${target} card(s) to end your turn.`,
      count: hand.length - target,
      optional: false,
      effectTag: 'stabilizeDiscard',
    });
  }
}

function advanceFlow(s: DmState) {
  if (s.phase === 'gameOver') return;

  while (s.promptQueue.length > 0) {
    const front = s.promptQueue[0]!;
    if (isPromptImpossible(s, front)) {
      s.promptQueue.shift();
      continue;
    }
    break;
  }

  if (s.promptQueue.length > 0) {
    s.subPhase = 'awaitingPrompt';
    s.activePlayerId = s.promptQueue[0]!.playerId;
    return;
  }

  if (s.turnEndingAfterPrompts && s.catastrophesSeen < 3) {
    s.turnEndingAfterPrompts = false;
    queueStabilizeAndEndTurn(s, s.turnPlayerId);
    while (s.promptQueue.length > 0) {
      const front = s.promptQueue[0]!;
      if (isPromptImpossible(s, front)) {
        s.promptQueue.shift();
        continue;
      }
      break;
    }
    if (s.promptQueue.length > 0) {
      s.subPhase = 'awaitingPrompt';
      s.activePlayerId = s.promptQueue[0]!.playerId;
      return;
    }
    completeCurrentPlayerTurn(s);
    return;
  }

  // If 3rd Catastrophe has resolved all World's End prompts, finish the game!
  if (s.catastrophesSeen >= 3) {
    finishWorldsEndGame(s);
    return;
  }

  s.subPhase = 'awaitingAction';
  s.activePlayerId = s.turnPlayerId;
}

function isPromptImpossible(s: DmState, p: DmPrompt): boolean {
  if (p.kind === 'chooseCardsFromHand') {
    const hand = handOf(s, p.playerId);
    if (p.effectTag === 'playExtraTrait' || p.effectTag === 'eloquencePlay') {
      return !hand.some((c) => canPlayTrait(s, p.playerId, c));
    }
    return hand.length === 0;
  }
  if (p.kind === 'chooseTraitInPile') {
    return validTraitPileTargets(s, p).length === 0;
  }
  if (p.kind === 'chooseFromDiscard') {
    if (p.mode === 'playDirectly') {
      return !s.traitDiscard.some((c) => !c.dominant && canPlayTrait(s, p.playerId, c));
    }
    return s.traitDiscard.length === 0;
  }
  return false;
}

function completeCurrentPlayerTurn(s: DmState) {
  s.turnsTakenInRound += 1;
  if (s.turnsTakenInRound >= s.seats.length) {
    s.turnsTakenInRound = 0;
    flipNextAge(s);
    return;
  }

  const nextIdx = (s.firstPlayerIndex + s.turnsTakenInRound) % s.seats.length;
  s.turnPlayerId = s.seats[nextIdx]!.id;
  advanceFlow(s);
}

function flipNextAge(s: DmState) {
  const nextAge = s.ageDeck.shift();
  if (!nextAge) {
    s.catastrophesSeen = 3;
    advanceFlow(s);
    return;
  }

  s.agesPlayed.push(nextAge);
  s.currentAge = nextAge;

  if (nextAge.kind === 'age') {
    pushLog(s, null, `⏳ New Age: ${nextAge.name} — ${nextAge.text}`, 'normal');
    if (nextAge.ruleTag === 'plusOneGenePoolPerm') {
      for (const seat of s.seats) {
        s.baseGenePool[seat.id] = Math.min(8, (s.baseGenePool[seat.id] ?? 5) + 1);
      }
    } else if (nextAge.ruleTag === 'allDraw1') {
      for (const seat of s.seats) {
        drawTraits(s, seat.id, 1);
      }
    } else if (nextAge.ruleTag === 'allDraw2') {
      for (const seat of s.seats) {
        drawTraits(s, seat.id, 2);
      }
    } else if (nextAge.ruleTag === 'allDiscard1') {
      for (const seat of s.seats) {
        if (handOf(s, seat.id).length > 0) {
          s.promptQueue.push({
            kind: 'chooseCardsFromHand',
            playerId: seat.id,
            reason: `${nextAge.name}: discard 1 card from your hand.`,
            count: 1,
            optional: false,
            effectTag: 'discard',
          });
        }
      }
    } else if (nextAge.ruleTag === 'allSuppress1') {
      for (const seat of s.seats) {
        if (handOf(s, seat.id).length > 0) {
          s.promptQueue.push({
            kind: 'chooseCardsFromHand',
            playerId: seat.id,
            reason: `${nextAge.name}: you may Suppress 1 card from your hand (+1 pt at World's End).`,
            count: 1,
            optional: true,
            effectTag: 'suppress',
          });
        }
      }
    }
    s.turnPlayerId = s.seats[s.firstPlayerIndex]!.id;
    advanceFlow(s);
    return;
  }

  // Catastrophe!
  s.catastrophesSeen += 1;
  pushLog(
    s,
    null,
    `☄️ CATASTROPHE ${s.catastrophesSeen} OF 3: ${nextAge.name} — ${nextAge.text}`,
    'danger',
  );

  // Apply Gene Pool adjustment and Catastrophic effect (unless player has armed Denial!)
  for (const seat of s.seats) {
    if (s.denialArmed[seat.id] && nextAge.name !== 'The Four Horsemen') {
      s.denialArmed[seat.id] = false;
      pushLog(s, seat.id, `${seat.name}'s Denial ignored ${nextAge.name}!`, 'good');
      continue;
    }

    if (nextAge.genePoolDelta !== 0) {
      s.baseGenePool[seat.id] = Math.max(
        1,
        Math.min(8, (s.baseGenePool[seat.id] ?? 5) + nextAge.genePoolDelta),
      );
    }

    const eff = nextAge.catastropheEffect;
    if (eff === 'discardHandPerBlue' || eff === 'discardHandPerGreen' || eff === 'discardHandPerRed' || eff === 'discardHandPerPurple') {
      const col: DmTraitColor =
        eff === 'discardHandPerBlue'
          ? 'blue'
          : eff === 'discardHandPerGreen'
            ? 'green'
            : eff === 'discardHandPerRed'
              ? 'red'
              : 'purple';
      const count = Math.min(handOf(s, seat.id).length, countColorInTableau(s, seat.id, col));
      if (count > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: seat.id,
          reason: `${nextAge.name}: discard ${count} card(s) from your hand.`,
          count,
          optional: false,
          effectTag: 'discard',
        });
      }
    } else if (eff === 'sacrificeOneTrait') {
      s.promptQueue.push({
        kind: 'chooseTraitInPile',
        playerId: seat.id,
        reason: `${nextAge.name}: discard 1 non-Dominant trait from your Trait Pile.`,
        optional: false,
        scope: 'own',
        mode: 'sacrifice',
      });
    } else if (eff === 'drawPerColorType') {
      const cols = distinctColorsInTableau(s, seat.id).length;
      if (cols > 0) drawTraits(s, seat.id, cols);
    } else if (eff === 'discardAndRedrawGenePool') {
      s.traitDiscard.push(...handOf(s, seat.id));
      s.hands[seat.id] = [];
      drawTraits(s, seat.id, effectiveGenePool(s, seat.id));
    } else if (eff === 'suppressOneFromHand') {
      if (handOf(s, seat.id).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: seat.id,
          reason: `${nextAge.name}: Suppress 1 card from your hand.`,
          count: 1,
          optional: false,
          effectTag: 'suppress',
        });
      }
    }
  }

  if (s.catastrophesSeen < 3) {
    // Rotate first player 1 seat left
    s.firstPlayerIndex = (s.firstPlayerIndex + 1) % s.seats.length;
    s.turnPlayerId = s.seats[s.firstPlayerIndex]!.id;
    advanceFlow(s);
    return;
  }

  // 3rd Catastrophe -> Queue World's End trait effects in turn order!
  for (let i = 0; i < s.seats.length; i++) {
    const seat = s.seats[(s.firstPlayerIndex + i) % s.seats.length]!;
    for (const c of tableauOf(s, seat.id)) {
      if (c.worldsEndTag === 'hyperIntelligenceDiscardColor') {
        s.promptQueue.push({
          kind: 'chooseColor',
          playerId: seat.id,
          reason: "Hyper-Intelligence (World's End): choose a color — opponents discard 1 trait of that color.",
          effectTag: 'hyperIntelligence',
        });
      } else if (c.worldsEndTag === 'viralPenaltyColor') {
        s.promptQueue.push({
          kind: 'chooseColor',
          playerId: seat.id,
          reason: "Viral (World's End): choose a color — opponents get -1 point per trait of that color.",
          effectTag: 'viral',
        });
      } else if (c.worldsEndTag === 'faithChangeColor') {
        s.promptQueue.push({
          kind: 'chooseColor',
          playerId: seat.id,
          reason: "Faith (World's End): choose which color in your Trait Pile to convert.",
          effectTag: 'faithFrom',
        });
      } else if (c.worldsEndTag === 'eloquencePlayTrait') {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: seat.id,
          reason: "Eloquence (World's End): play 1 trait from your hand (ignoring its Action).",
          count: 1,
          optional: true,
          effectTag: 'eloquencePlay',
        });
      } else if (c.worldsEndTag === 'suppressHandAtWorldsEnd') {
        const maxSuppress = Math.min(2, handOf(s, seat.id).length);
        if (maxSuppress > 0) {
          s.promptQueue.push({
            kind: 'chooseCardsFromHand',
            playerId: seat.id,
            reason: `${c.name} (World's End): Suppress up to ${maxSuppress} card(s) from your hand.`,
            count: maxSuppress,
            optional: true,
            effectTag: 'suppress',
          });
        }
      }
    }
  }

  advanceFlow(s);
}

function finishWorldsEndGame(s: DmState) {
  s.phase = 'gameOver';
  s.subPhase = 'gameOver';
  s.activePlayerId = null;

  const scores: Record<PlayerId, number> = {};
  let bestId: PlayerId | null = null;
  let bestTotal = -Infinity;

  for (const seat of s.seats) {
    const { total } = computePlayerScore(s, seat.id);
    scores[seat.id] = total;
    if (total > bestTotal) {
      bestTotal = total;
      bestId = seat.id;
    }
  }

  s.finalScores = scores;
  s.winnerId = bestId;
  pushLog(s, bestId, `🌋 WORLD'S END! ${seatName(s, bestId)} wins Doomlings with ${bestTotal} points!`, 'good');
}

// ============================================================================
// Trait Entry & Action Resolution
// ============================================================================

function onTraitEnteredTableau(
  s: DmState,
  playerId: PlayerId,
  card: DmTraitCard,
  triggerAction: boolean,
) {
  const tab = tableauOf(s, playerId);
  tab.push(card);

  if (card.kind === 'denial') {
    s.denialArmed[playerId] = true;
  }

  if (card.isAttachment) {
    const hasHost = tab.some((c) => c.id !== card.id && !c.dominant && !c.isAttachment);
    if (hasHost) {
      s.promptQueue.push({
        kind: 'chooseTraitInPile',
        playerId,
        reason: `${card.name}: choose a non-Dominant trait in your Trait Pile to attach to.`,
        optional: true,
        scope: 'own',
        mode: 'attach',
        attachmentCardId: card.id,
      });
    }
  }

  if (triggerAction) {
    queueTraitActionEffect(s, playerId, card);
  }
}

function queueTraitActionEffect(s: DmState, playerId: PlayerId, card: DmTraitCard) {
  // Dominant trait abilities are NOT Actions so Age of Peace does not block them
  if (s.currentAge.ruleTag === 'ignoreActions' && !card.dominant) {
    return;
  }

  switch (card.actionTag) {
    case 'draw1':
      drawTraits(s, playerId, 1);
      break;
    case 'draw2':
      drawTraits(s, playerId, 2);
      break;
    case 'draw3':
      drawTraits(s, playerId, 3);
      break;
    case 'draw4':
      drawTraits(s, playerId, 4);
      break;
    case 'playExtraTrait':
      s.promptQueue.push({
        kind: 'chooseCardsFromHand',
        playerId,
        reason: `${card.name}: you may play another trait from your hand.`,
        count: 1,
        optional: true,
        effectTag: 'playExtraTrait',
      });
      break;
    case 'stealTrait':
    case 'vampirismSteal':
    case 'swapTraits':
      s.promptQueue.push({
        kind: 'chooseTraitInPile',
        playerId,
        reason: `${card.name}: choose a non-Dominant trait in an opponent's Trait Pile to STEAL.`,
        optional: true,
        scope: 'others',
        mode: 'steal',
      });
      break;
    case 'destroyOpponentTrait':
      s.promptQueue.push({
        kind: 'chooseTraitInPile',
        playerId,
        reason: `${card.name}: choose a non-Dominant trait in an opponent's Trait Pile to discard.`,
        optional: true,
        scope: 'others',
        mode: 'destroy',
      });
      break;
    case 'giveCardFromHand':
      if (handOf(s, playerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId,
          reason: `${card.name}: choose a card from your hand to give to an opponent.`,
          count: 1,
          optional: true,
          effectTag: 'giveToOpponent',
        });
      }
      break;
    case 'stealRandomHandCard': {
      const opp = s.seats.find((st) => st.id !== playerId && handOf(s, st.id).length > 0);
      if (opp) {
        const oppHand = handOf(s, opp.id);
        const idx = rngInt(s.rngState, oppHand.length);
        const [stolen] = oppHand.splice(idx, 1);
        if (stolen) handOf(s, playerId).push(stolen);
      }
      break;
    }
    case 'discardFromHand1':
      if (handOf(s, playerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId,
          reason: `${card.name}: discard 1 card from your hand.`,
          count: 1,
          optional: false,
          effectTag: 'discard',
        });
      }
      break;
    case 'discardFromHand2':
      if (handOf(s, playerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId,
          reason: `${card.name}: discard up to 2 cards from your hand.`,
          count: Math.min(2, handOf(s, playerId).length),
          optional: false,
          effectTag: 'discard',
        });
      }
      break;
    case 'takeFromDiscard1':
      if (s.traitDiscard.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromDiscard',
          playerId,
          reason: `${card.name}: choose 1 card from the discard pile to add to your hand.`,
          mode: 'takeToHand',
        });
      }
      break;
    case 'playFromDiscard1':
      if (s.traitDiscard.some((c) => !c.dominant && canPlayTrait(s, playerId, c))) {
        s.promptQueue.push({
          kind: 'chooseFromDiscard',
          playerId,
          reason: `${card.name}: choose 1 non-Dominant trait from the discard pile to play directly.`,
          mode: 'playDirectly',
        });
      }
      break;
    case 'venomousMoveSelf': {
      const opp = s.seats.find((st) => st.id !== playerId);
      if (opp) {
        const myTab = tableauOf(s, playerId);
        const idx = myTab.findIndex((c) => c.id === card.id);
        if (idx >= 0) {
          const [moved] = myTab.splice(idx, 1);
          if (moved) {
            discardAttachmentsForHost(s, playerId, moved.id);
            tableauOf(s, opp.id).push(moved);
          }
        }
      }
      break;
    }
    case 'suppressFromHand1':
      if (handOf(s, playerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId,
          reason: `${card.name}: choose 1 card from your hand to Suppress (+1 pt at World's End).`,
          count: 1,
          optional: true,
          effectTag: 'suppress',
        });
      }
      break;
    case 'suppressFromHand2':
      if (handOf(s, playerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId,
          reason: `${card.name}: choose up to 2 cards from your hand to Suppress (+1 pt each at World's End).`,
          count: Math.min(2, handOf(s, playerId).length),
          optional: true,
          effectTag: 'suppress',
        });
      }
      break;
    case 'suppressFromPile1':
      s.promptQueue.push({
        kind: 'chooseTraitInPile',
        playerId,
        reason: `${card.name}: choose a non-Dominant trait in your Trait Pile to Suppress (+1 pt at World's End).`,
        optional: true,
        scope: 'own',
        mode: 'suppress',
      });
      break;
    case 'draw2AndSuppress1':
      drawTraits(s, playerId, 2);
      if (handOf(s, playerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId,
          reason: `${card.name}: choose 1 card from your hand to Suppress (+1 pt at World's End).`,
          count: 1,
          optional: false,
          effectTag: 'suppress',
        });
      }
      break;
    case 'discard1ToDraw3':
      if (handOf(s, playerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId,
          reason: `${card.name}: discard 1 card from your hand to draw 3 cards.`,
          count: 1,
          optional: true,
          effectTag: 'discardToDraw3',
        });
      }
      break;
    default:
      break;
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

function handlePlayTrait(s: DmState, a: Extract<DmAction, { type: 'playTrait' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot play trait during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');

  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex((c) => c.id === a.cardId);
  if (idx < 0) throw new Error('card not in hand');
  const card = hand[idx]!;
  if (!canPlayTrait(s, a.playerId, card)) {
    throw new Error(`cannot legally play ${card.name}`);
  }

  hand.splice(idx, 1);
  const colorLabel = card.secondaryColor ? `${card.color}/${card.secondaryColor}` : card.color;
  pushLog(
    s,
    a.playerId,
    `${seatName(s, a.playerId)} played ${card.name} (${colorLabel}, ${card.points} pts).`,
    'normal',
  );

  onTraitEnteredTableau(s, a.playerId, card, true);
  s.turnEndingAfterPrompts = true;
  advanceFlow(s);
}

function handlePassTurn(s: DmState, a: Extract<DmAction, { type: 'passTurn' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot pass during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');

  const hand = handOf(s, a.playerId);
  if (hand.length === 0) {
    // Birth of Life rule: if you start your turn with 0 cards, draw 3 cards and pass turn
    drawTraits(s, a.playerId, 3);
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} had an empty hand, drew 3 cards, and passed.`, 'normal');
    completeCurrentPlayerTurn(s);
    return;
  }

  s.turnEndingAfterPrompts = true;
  advanceFlow(s);
}

function handleResolvePrompt(s: DmState, a: Extract<DmAction, { type: 'resolvePrompt' }>) {
  if (s.subPhase !== 'awaitingPrompt') throw new Error('no prompt awaiting resolution');
  const prompt = s.promptQueue[0];
  if (!prompt || prompt.playerId !== a.playerId) throw new Error('not your prompt');

  s.promptQueue.shift();

  switch (prompt.kind) {
    case 'chooseCardsFromHand': {
      if (!a.decline) {
        const hand = handOf(s, prompt.playerId);
        const ids = a.cardIds ?? [];
        const chosen: DmTraitCard[] = [];
        for (const id of ids.slice(0, prompt.count)) {
          const idx = hand.findIndex((c) => c.id === id);
          if (idx >= 0) chosen.push(hand.splice(idx, 1)[0]!);
        }

        if (prompt.effectTag === 'playExtraTrait' || prompt.effectTag === 'eloquencePlay') {
          const c = chosen[0];
          if (c && canPlayTrait(s, prompt.playerId, c)) {
            onTraitEnteredTableau(
              s,
              prompt.playerId,
              c,
              prompt.effectTag === 'playExtraTrait',
            );
          } else if (c) {
            hand.push(c);
          }
        } else if (prompt.effectTag === 'giveToOpponent') {
          const oppId = a.targetPlayerId ?? s.seats.find((st) => st.id !== prompt.playerId)?.id;
          if (oppId && chosen[0]) {
            handOf(s, oppId).push(chosen[0]);
          }
        } else if (prompt.effectTag === 'suppress') {
          if (chosen.length > 0) {
            s.suppressedCount[prompt.playerId] =
              (s.suppressedCount[prompt.playerId] ?? 0) + chosen.length;
            pushLog(
              s,
              prompt.playerId,
              `${seatName(s, prompt.playerId)} suppressed ${chosen.length} card(s) (+${chosen.length} pt at World's End).`,
              'good',
            );
          }
        } else if (prompt.effectTag === 'discardToDraw3') {
          if (chosen.length > 0) {
            s.traitDiscard.push(...chosen);
            drawTraits(s, prompt.playerId, 3);
            pushLog(
              s,
              prompt.playerId,
              `${seatName(s, prompt.playerId)} discarded ${chosen[0]!.name} to draw 3 cards.`,
              'normal',
            );
          }
        } else {
          s.traitDiscard.push(...chosen);
        }
      }

      if (prompt.effectTag === 'stabilizeDiscard' && s.promptQueue.length === 0 && s.catastrophesSeen < 3) {
        completeCurrentPlayerTurn(s);
        return;
      }
      break;
    }

    case 'chooseTraitInPile': {
      if (!a.decline && a.targetCardId !== undefined) {
        const valid = validTraitPileTargets(s, prompt);
        const found = valid.find((v) => v.card.id === a.targetCardId);
        if (found) {
          const ownerTab = tableauOf(s, found.ownerId);
          if (prompt.mode === 'attach') {
            const att =
              ownerTab.find((c) => c.id === prompt.attachmentCardId) ??
              [...ownerTab].reverse().find((c) => c.isAttachment && c.attachedToId === undefined);
            if (att) {
              att.attachedToId = found.card.id;
              if (att.indestructible || att.grantsIndestructible) {
                found.card.indestructible = true;
              }
              pushLog(
                s,
                prompt.playerId,
                `${seatName(s, prompt.playerId)} attached ${att.name} to ${found.card.name}!`,
                'good',
              );
            }
          } else {
            const idx = ownerTab.findIndex((c) => c.id === found.card.id);
            if (idx >= 0) {
              const [removed] = ownerTab.splice(idx, 1);
              if (removed) {
                delete removed.attachedToId;
                discardAttachmentsForHost(s, found.ownerId, removed.id);
                if (prompt.mode === 'steal') {
                  tableauOf(s, prompt.playerId).push(removed);
                  pushLog(
                    s,
                    prompt.playerId,
                    `${seatName(s, prompt.playerId)} stole ${removed.name} from ${seatName(s, found.ownerId)}!`,
                    'good',
                  );
                } else if (prompt.mode === 'suppress') {
                  s.suppressedCount[prompt.playerId] =
                    (s.suppressedCount[prompt.playerId] ?? 0) + 1;
                  pushLog(
                    s,
                    prompt.playerId,
                    `${seatName(s, prompt.playerId)} suppressed ${removed.name} from their Trait Pile.`,
                    'good',
                  );
                } else {
                  s.traitDiscard.push(removed);
                  pushLog(
                    s,
                    prompt.playerId,
                    `${removed.name} was discarded from ${seatName(s, found.ownerId)}'s Trait Pile.`,
                    'danger',
                  );
                }
              }
            }
          }
        }
      }
      break;
    }

    case 'chooseColor': {
      const col = a.chosenColor ?? 'red';
      if (prompt.effectTag === 'hyperIntelligence') {
        for (const seat of s.seats) {
          if (seat.id === prompt.playerId) continue;
          const tab = tableauOf(s, seat.id);
          const swap = s.faithColorSwap[seat.id] ?? null;
          const idx = tab.findIndex(
            (c) => !c.dominant && !isCardIndestructible(tab, c) && traitCountsAsColor(c, col, swap),
          );
          if (idx >= 0) {
            const [removed] = tab.splice(idx, 1);
            if (removed) {
              delete removed.attachedToId;
              s.traitDiscard.push(removed);
              discardAttachmentsForHost(s, seat.id, removed.id);
            }
          }
        }
      } else if (prompt.effectTag === 'viral') {
        s.viralPenalties.push({ byPlayerId: prompt.playerId, color: col });
      } else if (prompt.effectTag === 'faithFrom') {
        s.promptQueue.unshift({
          kind: 'chooseColor',
          playerId: prompt.playerId,
          reason: `Faith: convert all ${col} traits in your Trait Pile into which color?`,
          effectTag: 'faithTo',
          fromColor: col,
        });
      } else if (prompt.effectTag === 'faithTo' && prompt.fromColor) {
        s.faithColorSwap[prompt.playerId] = { from: prompt.fromColor, to: col };
      }
      break;
    }

    case 'chooseFromDiscard': {
      if (!a.decline && a.targetCardId !== undefined) {
        const idx = s.traitDiscard.findIndex((c) => c.id === a.targetCardId);
        if (idx >= 0) {
          const picked = s.traitDiscard[idx]!;
          if (prompt.mode === 'playDirectly') {
            if (!picked.dominant && canPlayTrait(s, prompt.playerId, picked)) {
              s.traitDiscard.splice(idx, 1);
              onTraitEnteredTableau(s, prompt.playerId, picked, false);
              pushLog(
                s,
                prompt.playerId,
                `${seatName(s, prompt.playerId)} played ${picked.name} from the discard pile!`,
                'good',
              );
            }
          } else {
            handOf(s, prompt.playerId).push(s.traitDiscard.splice(idx, 1)[0]!);
          }
        }
      }
      break;
    }
  }

  advanceFlow(s);
}

// ============================================================================
// Entry point
// ============================================================================

export function applyAction(state: DmState, action: DmAction): DmState {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  const s = cloneState(state);

  switch (action.type) {
    case 'playTrait':
      handlePlayTrait(s, action);
      break;
    case 'passTurn':
      handlePassTurn(s, action);
      break;
    case 'resolvePrompt':
      handleResolvePrompt(s, action);
      break;
    default: {
      const never: never = action;
      throw new Error(`unknown action ${JSON.stringify(never)}`);
    }
  }

  return s;
}
