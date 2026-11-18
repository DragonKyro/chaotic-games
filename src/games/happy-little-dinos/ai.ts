// Happy Little Dinosaurs — deterministic heuristic AI.

import type { PlayerId } from '@/core/types';
import { computeRoundScores, handOf, livePlayerIds } from './reducer';
import type { HldAction, HldState } from './types';

export function chooseAIAction(state: HldState, playerId: PlayerId): HldAction | null {
  if (state.phase === 'gameOver') return null;
  if (state.activePlayerId !== playerId) return null;

  const hand = handOf(state, playerId);

  if (state.subPhase === 'selecting') {
    const pointCards = hand.filter((c) => c.type === 'point');
    pointCards.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    // If Pet Rock (0) is in hand along with another Point card, play Pet Rock or highest value
    const pick = pointCards[0];
    if (!pick) return null;
    return { type: 'submitPick', playerId, cardId: pick.id };
  }

  if (state.subPhase === 'suddenDeath') {
    const pointCards = hand.filter((c) => c.type === 'point');
    pointCards.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const pick = pointCards[0];
    if (!pick) return null;
    return { type: 'submitSuddenDeathPick', playerId, cardId: pick.id };
  }

  if (state.subPhase === 'pointEffects') {
    const prompt = state.promptQueue[0];
    if (!prompt || prompt.playerId !== playerId) return null;

    switch (prompt.kind) {
      case 'petRockDiscard': {
        const candidates = hand.filter(
          (c) => c.type === 'point' && (!prompt.smoothieOnlyEffects || c.hasEffect),
        );
        candidates.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
        if (candidates[0]) {
          return { type: 'resolvePrompt', playerId, targetCardId: candidates[0].id };
        }
        return { type: 'resolvePrompt', playerId, decline: true };
      }
      case 'dinoGrabberSteal': {
        const others = livePlayerIds(state).filter((id) => id !== playerId && handOf(state, id).length > 0);
        const t = others[0];
        const card = t ? handOf(state, t)[0] : null;
        if (t && card) {
          return { type: 'resolvePrompt', playerId, targetPlayerId: t, targetCardId: card.id };
        }
        return { type: 'resolvePrompt', playerId, decline: true };
      }
      case 'grapplingSnakeSwap': {
        const myVal = state.revealedPicks[playerId]?.value ?? 0;
        const better = prompt.validNeighbors.find(
          (n) => (state.revealedPicks[n]?.value ?? 0) > myVal,
        );
        if (better) {
          return { type: 'resolvePrompt', playerId, targetPlayerId: better };
        }
        return { type: 'resolvePrompt', playerId, decline: true };
      }
      case 'fireSprayDiscard': {
        return { type: 'resolvePrompt', playerId, decline: true };
      }
      case 'treenocularsPick': {
        const sorted = [...prompt.cards].sort((a, b) => (b.value ?? 5) - (a.value ?? 5));
        return { type: 'resolvePrompt', playerId, targetCardId: sorted[0]!.id };
      }
      case 'hungryPlantSwap': {
        const others = livePlayerIds(state).filter((id) => id !== playerId);
        const myVal = state.revealedPicks[playerId]?.value ?? 0;
        const higher = others.find((id) => (state.revealedPicks[id]?.value ?? 0) > myVal);
        if (higher) {
          return {
            type: 'resolvePrompt',
            playerId,
            targetPlayerId: playerId,
            secondPlayerId: higher,
          };
        }
        return { type: 'resolvePrompt', playerId, decline: true };
      }
    }
  }

  if (state.subPhase === 'awaitingScoringInstants') {
    const scores = computeRoundScores(state);
    const live = livePlayerIds(state);
    const minScore = Math.min(...live.map((id) => scores[id]!));
    if (scores[playerId] === minScore) {
      const booster = hand.find((c) => c.kind === 'score-booster');
      if (booster) {
        return {
          type: 'playScoringInstant',
          playerId,
          cardId: booster.id,
          targetPlayerId: playerId,
        };
      }
      const inversion = hand.find((c) => c.kind === 'score-inversion');
      if (inversion) {
        return { type: 'playScoringInstant', playerId, cardId: inversion.id };
      }
    }
    return { type: 'declineScoringInstant', playerId };
  }

  if (state.subPhase === 'awaitingDisasterSave') {
    const redirect = hand.find((c) => c.kind === 'disaster-redirect');
    const others = livePlayerIds(state).filter((id) => id !== playerId);
    if (redirect && others[0]) {
      return {
        type: 'playDisasterSave',
        playerId,
        cardId: redirect.id,
        targetPlayerId: others[0],
      };
    }
    const insurance = hand.find((c) => c.kind === 'disaster-insurance');
    if (insurance) {
      return { type: 'playDisasterSave', playerId, cardId: insurance.id };
    }
    return { type: 'declineDisasterSave', playerId };
  }

  return null;
}
