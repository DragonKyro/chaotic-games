// Casting Shadows — deterministic heuristic AI.

import type { PlayerId } from '@/core/types';
import {
  areHexesAdjacent,
  hexDistance,
  isHexInSpellRange,
  rollFiveResourceDice,
} from './cards';
import {
  boardOf,
  canAffordCost,
  canCollectCard,
  getShadowAbilityCost,
} from './reducer';
import type { CsAction, CsHexId, CsState } from './types';
import { livePlayerIds } from '@/core/state';

export function chooseAIAction(state: CsState, playerId: PlayerId): CsAction | null {
  if (state.phase === 'gameOver') return null;
  if (state.activePlayerId !== playerId) return null;

  const b = boardOf(state, playerId);

  if (state.subPhase === 'awaitingRoll') {
    const copy = { seed: (state.rngState.seed + state.logSeq * 0x9e3779b9) >>> 0 };
    return {
      type: 'rollResourceDice',
      playerId,
      dice: rollFiveResourceDice(copy),
    };
  }

  if (state.subPhase === 'awaitingCompanionPick') {
    const comp = state.companionPortal[0];
    if (!comp) return null;
    return { type: 'pickCompanion', playerId, companionId: comp.id };
  }

  if (state.subPhase === 'awaitingCounterspell') {
    const cs = b.spellBook.find((c) => c.type === 'counterspell');
    if (cs) {
      return { type: 'respondCounterspell', playerId, counterspellId: cs.id };
    }
    return { type: 'respondCounterspell', playerId };
  }

  if (state.subPhase === 'awaitingAction') {
    const enemies = livePlayerIds(state).filter((id) => id !== playerId);

    // 1. Use Shadow Ability if available and ready
    const saCost = getShadowAbilityCost(b);
    if (
      b.form === 'shadow' &&
      !b.usedShadowAbilityThisTurn &&
      b.shadowEnergy >= saCost
    ) {
      const sameHexEnemy = enemies.find((eId) => boardOf(state, eId).hexId === b.hexId);
      const rangeEnemy = enemies.find((eId) =>
        isHexInSpellRange(state.hexes, b.hexId, boardOf(state, eId).hexId, 'sameOrAdjacent'),
      );
      const adjEnemy = enemies.find((eId) =>
        areHexesAdjacent(state.hexes[b.hexId], state.hexes[boardOf(state, eId).hexId]),
      );
      const canUse =
        b.characterId === 'kit' ||
        b.characterId === 'frill' ||
        b.characterId === 'dread' ||
        (b.characterId === 'nuzzle' && !!sameHexEnemy) ||
        (b.characterId === 'talon' && !!sameHexEnemy) ||
        (b.characterId === 'nyx' && !!rangeEnemy) ||
        (b.characterId === 'ember' && !!rangeEnemy) ||
        (b.characterId === 'haze' && !!adjEnemy);
      if (canUse) {
        return {
          type: 'useShadowAbility',
          playerId,
          targetPlayerId: sameHexEnemy ?? rangeEnemy ?? enemies[0],
          targetHexId: adjEnemy
            ? boardOf(state, adjEnemy).hexId
            : rangeEnemy
              ? boardOf(state, rangeEnemy).hexId
              : undefined,
        };
      }
    }

    if (state.actionPointsRemaining <= 0) {
      return { type: 'transformAndEndTurn', playerId, transform: true };
    }

    // 2. Cast an Attack Spell if an enemy is in range and we can afford it
    for (const spell of b.spellBook) {
      if (spell.type !== 'attackSpell') continue;
      if (b.usedSpellIdsThisTurn.includes(spell.id)) continue;
      const tiers = spell.castTiers ?? [];
      for (let tIdx = tiers.length - 1; tIdx >= 0; tIdx--) {
        const tier = tiers[tIdx]!;
        if (!canAffordCost(state, tier.cost)) continue;
        const range = spell.range ?? 'sameOrAdjacent';

        if (spell.targetsAllOnHex) {
          const targetEnemy = enemies.find((eId) =>
            isHexInSpellRange(state.hexes, b.hexId, boardOf(state, eId).hexId, range),
          );
          if (targetEnemy) {
            return {
              type: 'castSpell',
              playerId,
              spellId: spell.id,
              tierIndex: tIdx,
              targetHexId: boardOf(state, targetEnemy).hexId,
            };
          }
        } else {
          const targetEnemy = enemies.find((eId) =>
            isHexInSpellRange(state.hexes, b.hexId, boardOf(state, eId).hexId, range),
          );
          if (targetEnemy) {
            return {
              type: 'castSpell',
              playerId,
              spellId: spell.id,
              tierIndex: tIdx,
              targetPlayerId: targetEnemy,
            };
          }
        }
      }
    }

    // 3. Collect the face-up card on our current Hex if we have < 4 cards and can afford it
    const curHex = state.hexes[b.hexId];
    if (
      curHex.faceUpCard &&
      b.spellBook.length < 4 &&
      canCollectCard(state, playerId, curHex.faceUpCard)
    ) {
      return { type: 'collectCard', playerId };
    }

    // 4. Protect if we are Burning or rolled Cursed Crystals and are low on HP
    if (b.burning && b.hp <= 12) {
      return { type: 'protect', playerId, clearStatus: 'burning' };
    }
    if (b.hp <= 8 && state.dicePool.includes('cursedCrystal')) {
      return { type: 'protect', playerId, clearStatus: 'cursedCrystal' };
    }

    // 5. Travel toward the nearest enemy (or toward a Hex with an Attack Spell if we have no Attack Spell yet)
    const adjacentHexIds = (Object.keys(state.hexes) as CsHexId[]).filter((hId) =>
      areHexesAdjacent(curHex, state.hexes[hId]),
    );

    const tryTravelTo = (destHexId: CsHexId): CsAction => {
      if (b.frozen) {
        return { type: 'unfreeze', playerId };
      }
      return { type: 'travel', playerId, toHexId: destHexId };
    };

    const hasAttackSpell = b.spellBook.some((c) => c.type === 'attackSpell');
    if (!hasAttackSpell) {
      const hexWithSpell = adjacentHexIds.find(
        (hId) => state.hexes[hId].faceUpCard?.type === 'attackSpell',
      );
      if (hexWithSpell && (!b.frozen || state.actionPointsRemaining >= 2)) {
        return tryTravelTo(hexWithSpell);
      }
    }

    const enemyHex = enemies[0] ? boardOf(state, enemies[0]).hexId : null;
    if (enemyHex && enemyHex !== b.hexId && (!b.frozen || state.actionPointsRemaining >= 2)) {
      if (adjacentHexIds.includes(enemyHex)) {
        return tryTravelTo(enemyHex);
      }
      const bestStep = [...adjacentHexIds].sort(
        (aId, bId) =>
          hexDistance(state.hexes[aId], state.hexes[enemyHex]) -
          hexDistance(state.hexes[bId], state.hexes[enemyHex]),
      )[0];
      if (bestStep) {
        return tryTravelTo(bestStep);
      }
    }

    return { type: 'transformAndEndTurn', playerId, transform: true };
  }

  return null;
}
