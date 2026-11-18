// Here to Slay — deterministic heuristic AI.

import { rngInt } from '@/core/rng';
import type { PlayerId } from '@/core/types';
import {
  canAttackMonster,
  computeRollTotals,
  handOf,
  partyClasses,
  partyOf,
  validHandCardsForPrompt,
  validHeroTargets,
} from './reducer';
import type { HtsAction, HtsState } from './types';

function roll2d6FromState(s: HtsState, salt: number): [number, number] {
  const copy = { seed: (s.rngState.seed + salt * 0x9e3779b9) >>> 0 };
  const d1 = rngInt(copy, 6) + 1;
  const d2 = rngInt(copy, 6) + 1;
  return [d1, d2];
}

export function chooseAIAction(state: HtsState, playerId: PlayerId): HtsAction | null {
  if (state.phase === 'gameOver') return null;
  if (state.activePlayerId !== playerId) return null;

  if (state.subPhase === 'awaitingChallenge') {
    const p = state.pendingPlay;
    if (!p) return null;
    // Challenge if opponent is about to win with a 6th class Hero
    const oppClasses = partyClasses(state, p.byPlayerId);
    const wouldCompleteParty =
      p.card.type === 'hero' && p.card.class && !oppClasses.has(p.card.class) && oppClasses.size >= 5;
    if (wouldCompleteParty) {
      const ch = handOf(state, playerId).find((c) => c.type === 'challenge');
      if (ch) {
        return {
          type: 'playChallenge',
          playerId,
          cardId: ch.id,
          actorDice: roll2d6FromState(state, state.logSeq + 1),
          challengerDice: roll2d6FromState(state, state.logSeq + 2),
        };
      }
    }
    return { type: 'declineChallenge', playerId };
  }

  if (state.subPhase === 'awaitingModifiers') {
    const r = state.pendingRoll;
    if (!r) return null;
    const { actorTotal } = computeRollTotals(state, r);
    const mods = handOf(state, playerId).filter((c) => c.type === 'modifier');

    // Help our own Monster or Hero roll if we are just short of threshold
    if (r.byPlayerId === playerId && r.reason !== 'challengeDuel') {
      const deficit = r.threshold - actorTotal;
      if (deficit > 0 && deficit <= 4 && mods.length > 0) {
        for (const m of mods) {
          const pos = (m.modifierChoices ?? []).find((v) => v >= deficit);
          if (pos !== undefined) {
            return {
              type: 'playModifier',
              playerId,
              cardId: m.id,
              chosenValue: pos,
              protectingHornDelta: 1,
            };
          }
        }
      }
    }

    return { type: 'declineModifier', playerId };
  }

  if (state.subPhase === 'awaitingPrompt') {
    const prompt = state.promptQueue[0];
    if (!prompt || prompt.playerId !== playerId) return null;

    switch (prompt.kind) {
      case 'rollEnteredHero': {
        return {
          type: 'resolvePrompt',
          playerId,
          dice: roll2d6FromState(state, state.logSeq + 3),
        };
      }
      case 'chooseHeroTarget': {
        const valid = validHeroTargets(state, prompt);
        if (valid.length === 0) {
          return { type: 'resolvePrompt', playerId, decline: true };
        }
        return {
          type: 'resolvePrompt',
          playerId,
          targetCardId: valid[0]!.hero.card.id,
        };
      }
      case 'chooseCardsFromHand': {
        const valid = validHandCardsForPrompt(state, prompt);
        if (valid.length === 0) {
          return { type: 'resolvePrompt', playerId, decline: true };
        }
        const count = prompt.upTo ? 1 : Math.min(prompt.count, valid.length);
        return {
          type: 'resolvePrompt',
          playerId,
          cardIds: valid.slice(0, count).map((c) => c.id),
        };
      }
      case 'choosePlayer': {
        const others = state.seats.filter((s) => s.id !== playerId);
        others.sort((a, b) => partyOf(state, b.id).length - partyOf(state, a.id).length);
        const target = others[0]?.id;
        if (!target) return { type: 'resolvePrompt', playerId, decline: true };
        return { type: 'resolvePrompt', playerId, targetPlayerId: target };
      }
      case 'chooseFromPile': {
        const first = prompt.cards[0];
        if (!first) return { type: 'resolvePrompt', playerId, decline: true };
        return { type: 'resolvePrompt', playerId, targetCardId: first.id };
      }
      case 'bullseyePeek': {
        const first = prompt.cards[0]!;
        const rest = prompt.cards.slice(1).map((c) => c.id);
        return {
          type: 'resolvePrompt',
          playerId,
          bullseyePickId: first.id,
          bullseyeTopOrder: rest,
        };
      }
      case 'peekHandAck': {
        return { type: 'resolvePrompt', playerId };
      }
      case 'corruptedSabretoothChoice': {
        return { type: 'resolvePrompt', playerId, decline: false };
      }
    }
  }

  if (state.subPhase === 'awaitingAction') {
    if (state.actionPointsRemaining <= 0) {
      return { type: 'endTurn', playerId };
    }

    const hand = handOf(state, playerId);
    const myClasses = partyClasses(state, playerId);

    // 1. Play a Hero of a class we don't have yet (or any Hero)
    const heroesInHand = hand.filter((c) => c.type === 'hero');
    const newClassHero = heroesInHand.find((c) => c.class && !myClasses.has(c.class));
    const heroToPlay = newClassHero ?? heroesInHand[0];
    if (heroToPlay) {
      return { type: 'playHero', playerId, cardId: heroToPlay.id };
    }

    // 2. Attack a Monster if we have >= 2 AP and meet requirements
    if (state.actionPointsRemaining >= 2) {
      const attackable = state.monsterRow.find((m) => canAttackMonster(state, playerId, m));
      if (attackable) {
        return {
          type: 'attackMonster',
          playerId,
          monsterCardId: attackable.card.id,
          dice: roll2d6FromState(state, state.logSeq + 5),
        };
      }
    }

    // 3. Equip a beneficial Item to one of our Heroes
    const myUnarmedHero = partyOf(state, playerId).find((h) => !h.equippedItem);
    const itemInHand = hand.find((c) => c.type === 'item');
    if (myUnarmedHero && itemInHand) {
      return {
        type: 'equipItem',
        playerId,
        cardId: itemInHand.id,
        targetPlayerId: playerId,
        heroCardId: myUnarmedHero.card.id,
      };
    }

    // 4. Use an unexhausted Hero ability in our Party
    const usableHero = partyOf(state, playerId).find(
      (h) => !h.usedThisTurn && h.equippedItem?.kind !== 'sealing-key' && h.card.kind !== 'napping-nibbles',
    );
    if (usableHero) {
      return {
        type: 'useHeroAbility',
        playerId,
        heroCardId: usableHero.card.id,
        dice: roll2d6FromState(state, state.logSeq + 7),
      };
    }

    // 5. Spend 1 AP to draw a card
    return { type: 'drawCard', playerId };
  }

  return null;
}
