// Doomlings — deterministic heuristic AI.

import type { PlayerId } from '@/core/types';
import {
  canPlayTrait,
  handOf,
  validTraitPileTargets,
} from './reducer';
import type { DmAction, DmState, DmTraitColor } from './types';

export function chooseAIAction(state: DmState, playerId: PlayerId): DmAction | null {
  if (state.phase === 'gameOver') return null;
  if (state.activePlayerId !== playerId) return null;

  const hand = handOf(state, playerId);

  if (state.subPhase === 'awaitingPrompt') {
    const prompt = state.promptQueue[0];
    if (!prompt || prompt.playerId !== playerId) return null;

    switch (prompt.kind) {
      case 'chooseCardsFromHand': {
        if (prompt.effectTag === 'playExtraTrait' || prompt.effectTag === 'eloquencePlay') {
          const playable = hand.filter((c) => canPlayTrait(state, playerId, c) && c.points >= 0);
          playable.sort((a, b) => b.points - a.points);
          if (playable[0]) {
            return { type: 'resolvePrompt', playerId, cardIds: [playable[0].id] };
          }
          return { type: 'resolvePrompt', playerId, decline: true };
        }
        // Discard lowest-point cards
        const sorted = [...hand].sort((a, b) => a.points - b.points);
        const count = Math.min(prompt.count, sorted.length);
        return {
          type: 'resolvePrompt',
          playerId,
          cardIds: sorted.slice(0, count).map((c) => c.id),
        };
      }

      case 'chooseTraitInPile': {
        const valid = validTraitPileTargets(state, prompt);
        if (valid.length === 0) {
          return { type: 'resolvePrompt', playerId, decline: true };
        }
        if (prompt.mode === 'sacrifice') {
          valid.sort((a, b) => a.card.points - b.card.points);
        } else {
          valid.sort((a, b) => b.card.points - a.card.points);
        }
        return {
          type: 'resolvePrompt',
          playerId,
          targetCardId: valid[0]!.card.id,
        };
      }

      case 'chooseColor': {
        const colors: DmTraitColor[] = ['red', 'blue', 'green', 'purple'];
        return {
          type: 'resolvePrompt',
          playerId,
          chosenColor: colors[0],
        };
      }

      case 'chooseFromDiscard': {
        const sorted = [...state.traitDiscard].sort((a, b) => b.points - a.points);
        const pick = sorted[0];
        if (!pick) return { type: 'resolvePrompt', playerId, decline: true };
        return { type: 'resolvePrompt', playerId, targetCardId: pick.id };
      }
    }
  }

  if (state.subPhase === 'awaitingAction') {
    const playable = hand.filter((c) => canPlayTrait(state, playerId, c));
    if (playable.length === 0) {
      return { type: 'passTurn', playerId };
    }
    // Prefer Dominants first, then highest points + Gene Pool delta
    playable.sort(
      (a, b) =>
        (b.dominant ? 6 : 0) +
        b.points +
        b.genePoolDelta * 2 -
        ((a.dominant ? 6 : 0) + a.points + a.genePoolDelta * 2),
    );
    return { type: 'playTrait', playerId, cardId: playable[0]!.id };
  }

  return null;
}
