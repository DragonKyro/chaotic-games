// Happy Little Dinosaurs — deterministic heuristic AI (Base + all 4 Expansions).

import type { PlayerId } from '@/core/types';
import {
  canPlayDisasterSaveCard,
  canPlayScoringInstantCard,
  computeRoundScores,
  handOf,
  livePlayerIds,
} from './reducer';
import type { HldAction, HldState } from './types';

export function chooseAIAction(state: HldState, playerId: PlayerId): HldAction | null {
  if (state.phase === 'gameOver') return null;
  if (state.activePlayerId !== playerId) return null;

  const hand = handOf(state, playerId);

  if (state.subPhase === 'selecting') {
    const pointCards = hand.filter((c) => c.type === 'point');
    // If player has Hazard cards and holds a Hazard-removing Point card (Molotov Crocktail, Suck Up, Caution Sign), prefer it
    if ((state.hazardAreas?.[playerId]?.length ?? 0) > 0) {
      const hazRemover = pointCards.find(
        (c) => c.kind === 'molotov-crocktail' || c.kind === 'suck-up' || c.kind === 'caution-sign',
      );
      if (hazRemover) {
        return { type: 'submitPick', playerId, cardId: hazRemover.id };
      }
    }
    pointCards.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
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
      case 'trashIntoTreasurePick': {
        const discardPts = state.discard.filter((c) => c.type === 'point');
        discardPts.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
        if (discardPts[0]) {
          return { type: 'resolvePrompt', playerId, targetCardId: discardPts[0].id };
        }
        return { type: 'resolvePrompt', playerId, decline: true };
      }
      case 'unwantedLunchSwap': {
        const others = livePlayerIds(state).filter((id) => id !== playerId && handOf(state, id).length > 0);
        const sortedHand = [...hand].sort((a, b) => (a.value ?? 4) - (b.value ?? 4));
        const giveCard = sortedHand[0];
        if (others[0] && giveCard && (giveCard.value ?? 4) <= 3) {
          return {
            type: 'resolvePrompt',
            playerId,
            targetPlayerId: others[0],
            targetCardId: giveCard.id,
          };
        }
        return { type: 'resolvePrompt', playerId, decline: true };
      }
      case 'coldFeetSwap': {
        const topDiscard = state.discard.find((c) => c.id === prompt.topDiscardPointCardId);
        const myVal = state.revealedPicks[playerId]?.value ?? 0;
        if (topDiscard && (topDiscard.value ?? 0) > myVal) {
          return { type: 'resolvePrompt', playerId, targetCardId: topDiscard.id };
        }
        return { type: 'resolvePrompt', playerId, decline: true };
      }
      case 'removeHazardPick': {
        const myHazards = state.hazardAreas[playerId] ?? [];
        const haz = myHazards[0];
        if (!haz) return { type: 'resolvePrompt', playerId, decline: true };
        const others = livePlayerIds(state).filter((id) => id !== playerId);
        return {
          type: 'resolvePrompt',
          playerId,
          targetCardId: haz.id,
          targetPlayerId: prompt.canTransferToOpponent ? others[0] : undefined,
        };
      }
    }
  }

  if (state.subPhase === 'awaitingScoringInstants') {
    const scores = computeRoundScores(state);
    const live = livePlayerIds(state);
    const minScore = Math.min(...live.map((id) => scores[id]!));
    const maxScore = Math.max(...live.map((id) => scores[id]!));
    const others = live.filter((id) => id !== playerId);
    const playable = hand.filter((c) => canPlayScoringInstantCard(state, playerId, c));

    if (scores[playerId] === minScore && playable.length > 0) {
      const boost = playable.find(
        (c) =>
          c.kind === 'score-booster' ||
          c.kind === 'one-week-anniversary' ||
          c.kind === 'double-date' ||
          c.kind === 'bffs-help' ||
          (c.kind === 'joy-of-puberty' && (state.disasterAreas[playerId]?.length ?? 0) > 0),
      );
      if (boost) {
        const ptCards = hand.filter((c) => c.type === 'point').sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
        return {
          type: 'playScoringInstant',
          playerId,
          cardId: boost.id,
          targetPlayerId: playerId,
          secondPlayerId: others[0],
          handCardId: ptCards[0]?.id,
        };
      }

      const swapper = playable.find(
        (c) => c.kind === 'score-inversion' || c.kind === 'awkward-first-kiss' || c.kind === 'spiteful-bullying',
      );
      const highestOther = others.find((id) => scores[id] === maxScore) ?? others[0];
      if (swapper && highestOther && scores[highestOther]! > scores[playerId]!) {
        return {
          type: 'playScoringInstant',
          playerId,
          cardId: swapper.id,
          targetPlayerId: swapper.kind === 'awkward-first-kiss' ? highestOther : playerId,
          secondPlayerId: highestOther,
        };
      }

      const sapper = playable.find(
        (c) => c.kind === 'score-sapper' || c.kind === 'baby-pictures' || c.kind === 'frenemys-curse' || c.kind === 'roadblock',
      );
      const closeOther = others.find((id) => (scores[id] ?? 0) - (scores[playerId] ?? 0) <= 3);
      if (sapper && closeOther) {
        return {
          type: 'playScoringInstant',
          playerId,
          cardId: sapper.id,
          targetPlayerId: closeOther,
        };
      }
    }

    return { type: 'declineScoringInstant', playerId };
  }

  if (state.subPhase === 'awaitingDisasterSave') {
    const playable = hand.filter((c) => canPlayDisasterSaveCard(state, playerId, c));
    const redirect = playable.find((c) => c.kind === 'disaster-redirect');
    const others = livePlayerIds(state).filter((id) => id !== playerId);
    if (redirect && others[0]) {
      return {
        type: 'playDisasterSave',
        playerId,
        cardId: redirect.id,
        targetPlayerId: others[0],
      };
    }

    const detourOrIns = playable.find(
      (c) => c.kind === 'detour' || c.kind === 'disaster-insurance' || c.kind === 'crippling-shyness',
    );
    if (detourOrIns) {
      return { type: 'playDisasterSave', playerId, cardId: detourOrIns.id };
    }

    const luckyBreak = playable.find((c) => c.kind === 'lucky-break');
    const ptCards = hand.filter((c) => c.type === 'point').sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    if (luckyBreak && ptCards[0]) {
      return {
        type: 'playDisasterSave',
        playerId,
        cardId: luckyBreak.id,
        discardCardId: ptCards[0].id,
      };
    }

    return { type: 'declineDisasterSave', playerId };
  }

  return null;
}
