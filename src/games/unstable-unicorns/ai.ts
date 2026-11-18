// Unstable Unicorns — deterministic heuristic AI.
// Fair-play rule: never reads state.deck except when resolving a legitimate deck search or oraclePeek prompt.

import type { PlayerId } from '@/core/types';
import { isNeighCard } from './cards';
import {
  canPlayCardFromHand,
  canPlayNeigh,
  handOf,
  queenBeeOwner,
  stableOf,
  unicornCount,
  validHandCards,
  validPileCards,
  validStableTargets,
} from './reducer';
import { isUnicornType } from './types';
import type { UuAction, UuCard, UuState } from './types';

function cardPriority(c: UuCard): number {
  if (c.kind === 'super-neigh') return 10;
  if (
    c.kind === 'absorb-and-reflect' ||
    c.kind === 'unicorn-net' ||
    c.kind === 'redirect' ||
    c.kind === 'flare-gun' ||
    c.kind === 'jingle-all-the-neigh'
  ) {
    return 8.5;
  }
  if (c.type === 'instant') return 8;
  if (
    c.kind === 'ginormous-unicorn' ||
    c.kind === 'bahamuticorn' ||
    c.kind === 'twin-dragoncorns' ||
    c.kind === 'diamond-unicorn'
  ) {
    return 7.8;
  }
  if (c.type === 'magicalUnicorn') return 7;
  if (c.type === 'upgrade') return 6;
  if (c.type === 'magic') return 5.5;
  if (c.type === 'basicUnicorn') return 4.5;
  if (c.type === 'downgrade') return 4;
  return 3;
}

function leadingOpponent(s: UuState, me: PlayerId): PlayerId | null {
  const others = s.seats.filter((x) => x.id !== me);
  if (others.length === 0) return null;
  others.sort((a, b) => unicornCount(s, b.id) - unicornCount(s, a.id));
  return others[0]!.id;
}

export function chooseAIAction(state: UuState, playerId: PlayerId): UuAction | null {
  if (state.phase === 'gameOver') return null;
  if (state.activePlayerId !== playerId) return null;

  if (state.subPhase === 'draw') {
    return { type: 'drawForTurn', playerId };
  }

  if (state.subPhase === 'awaitingNeigh') {
    const p = state.pending;
    if (!p) return null;
    const currentlyCancelled = p.neighCards.length % 2 === 1;
    const isMyPlay = p.byPlayerId === playerId;

    // Counter-Neigh if our own play is currently cancelled
    if (isMyPlay && currentlyCancelled && canPlayNeigh(state, playerId)) {
      const neigh = handOf(state, playerId).find((c) => isNeighCard(c));
      if (neigh) return { type: 'playNeigh', playerId, cardId: neigh.id };
    }

    // Respond with an Instant card to an opponent's play if it isn't already cancelled and either:
    // - they are within 2 unicorns of winning and playing a unicorn/magic, or
    // - they are playing a Downgrade on us, or
    // - they are playing a high-impact Magic/Unicorn/Upgrade card
    if (!isMyPlay && !currentlyCancelled && canPlayNeigh(state, playerId)) {
      const oppUnicorns = unicornCount(state, p.byPlayerId);
      const aboutToWin = isUnicornType(p.card.type) && oppUnicorns + 1 >= state.unicornsToWin - 1;
      const downgradeOnMe = p.card.type === 'downgrade' && p.targetPlayerId === playerId;
      const dangerousPlay =
        aboutToWin ||
        downgradeOnMe ||
        p.card.kind === 'two-for-one' ||
        p.card.kind === 'unicorn-poison' ||
        p.card.kind === 'seductive-unicorn' ||
        p.card.kind === 'catastrophe' ||
        p.card.kind === 'rainbow-apocalypse-magic' ||
        p.card.kind === 'plague-of-death' ||
        p.card.kind === 'dragons-breath' ||
        p.card.kind === 'raze-the-stables' ||
        p.card.kind === 'fireball' ||
        p.card.kind === 'black-hole' ||
        p.card.kind === 'nightmare-pact' ||
        p.card.kind === 'humbug' ||
        p.card.kind === 'ghosted' ||
        p.card.kind === 'unicorn-shrinkray' ||
        p.card.kind === 'chaos-storm' ||
        p.card.kind === 'bahamuticorn' ||
        p.card.kind === 'twin-dragoncorns' ||
        p.card.kind === 'diamond-unicorn' ||
        p.card.kind === 'cutthroat-captain-unicorn';

      if (dangerousPlay) {
        const neigh =
          handOf(state, playerId).find((c) => isNeighCard(c) && c.kind !== 'super-neigh') ??
          handOf(state, playerId).find((c) => isNeighCard(c));
        if (neigh) return { type: 'playNeigh', playerId, cardId: neigh.id };
      }
    }

    return { type: 'declineNeigh', playerId };
  }

  if (state.subPhase === 'awaitingPrompt') {
    const prompt = state.promptQueue[0];
    if (!prompt || prompt.playerId !== playerId) return null;

    switch (prompt.kind) {
      case 'beginningTrigger': {
        if (prompt.mandatory) {
          return { type: 'resolvePrompt', playerId };
        }
        const kind = prompt.sourceCard.kind;
        // Always activate free value triggers
        if (
          kind === 'apocalypse-bunker' ||
          kind === 'dragons-fortune' ||
          kind === 'dwarven-forge' ||
          kind === 'saved-by-the-sigil' ||
          kind === 'gingerbread-stable' ||
          kind === 'gift-inspector' ||
          kind === 'vip-lounge' ||
          kind === 'extra-tail' ||
          kind === 'rainbow-mane' ||
          kind === 'unicorn-lasso' ||
          kind === 'aura-of-order' ||
          kind === 'angel-unicorn' ||
          kind === 'extremely-fertile-unicorn' ||
          kind === 'zombie-unicorn' ||
          kind === 'summoning-ritual'
        ) {
          return { type: 'resolvePrompt', playerId };
        }
        if (kind === 'jack-the-reapercorn' && handOf(state, playerId).length >= 2) {
          return { type: 'resolvePrompt', playerId };
        }
        if (kind === 'claw-machine' && handOf(state, playerId).length >= 3) {
          return { type: 'resolvePrompt', playerId };
        }
        if (
          (kind === 'caffeine-overload' || kind === 'glitter-bomb' || kind === 'altar-of-chaos') &&
          stableOf(state, playerId).downgrades.length > 0
        ) {
          return { type: 'resolvePrompt', playerId };
        }
        if (kind === 'stable-artillery' && handOf(state, playerId).length >= 4) {
          return { type: 'resolvePrompt', playerId };
        }
        if (kind === 'rainbow-lasso' && handOf(state, playerId).length >= 5) {
          return { type: 'resolvePrompt', playerId };
        }
        return { type: 'resolvePrompt', playerId, decline: true };
      }

      case 'chooseCardsFromHand': {
        const valid = validHandCards(state, prompt);
        if (prompt.optional && prompt.effectTag === 'seductiveDiscard' && valid.length === 0) {
          return { type: 'resolvePrompt', playerId, decline: true };
        }
        const sorted = [...valid].sort((a, b) => cardPriority(a) - cardPriority(b));
        const count = Math.min(prompt.count, sorted.length);
        if (count === 0 && prompt.optional) {
          return { type: 'resolvePrompt', playerId, decline: true };
        }
        return {
          type: 'resolvePrompt',
          playerId,
          cardIds: sorted.slice(0, count).map((c) => c.id),
        };
      }

      case 'chooseStableCard': {
        const valid = validStableTargets(state, prompt);
        if (valid.length === 0) {
          return { type: 'resolvePrompt', playerId, decline: true };
        }
        if (prompt.mode === 'sacrifice') {
          // Prefer sacrificing our own Downgrades first, then Baby/Basic Unicorns
          const ownDowngrade = valid.find((v) => v.card.type === 'downgrade');
          const picked = ownDowngrade ?? valid[0]!;
          return { type: 'resolvePrompt', playerId, targetCardId: picked.card.id };
        }
        if (prompt.effectTag?.startsWith('sharkSacrifice:') && prompt.optional) {
          // Only sacrifice Shark With a Horn if an opponent is close to winning
          const leader = leadingOpponent(state, playerId);
          if (!leader || unicornCount(state, leader) < state.unicornsToWin - 2) {
            return { type: 'resolvePrompt', playerId, decline: true };
          }
        }
        // Prefer targeting the leading opponent's cards
        const sorted = [...valid].sort(
          (a, b) => unicornCount(state, b.ownerId) - unicornCount(state, a.ownerId),
        );
        return { type: 'resolvePrompt', playerId, targetCardId: sorted[0]!.card.id };
      }

      case 'choosePlayer': {
        const candidates = state.seats
          .map((s) => s.id)
          .filter((id) => (prompt.allowSelf ? true : id !== playerId) && id !== prompt.movedFromPlayerId);
        const target =
          candidates.find((id) => id !== playerId) ??
          leadingOpponent(state, playerId) ??
          candidates[0];
        if (!target) return { type: 'resolvePrompt', playerId, decline: true };
        return { type: 'resolvePrompt', playerId, targetPlayerId: target };
      }

      case 'chooseFromOpponentHand': {
        const oppHand = handOf(state, prompt.targetPlayerId);
        const sorted = [...oppHand].sort((a, b) => cardPriority(b) - cardPriority(a));
        const pick = sorted[0];
        if (!pick) return null;
        return { type: 'resolvePrompt', playerId, targetCardId: pick.id };
      }

      case 'chooseFromPile': {
        const valid = validPileCards(state, prompt);
        if (valid.length === 0) {
          return { type: 'resolvePrompt', playerId, decline: true };
        }
        const sorted = [...valid].sort((a, b) => cardPriority(b) - cardPriority(a));
        return { type: 'resolvePrompt', playerId, targetCardId: sorted[0]!.id };
      }

      case 'oraclePeek': {
        const sorted = [...prompt.cards].sort((a, b) => cardPriority(b) - cardPriority(a));
        const pick = sorted[0]!;
        const rest = sorted.slice(1).map((c) => c.id);
        return {
          type: 'resolvePrompt',
          playerId,
          oraclePickId: pick.id,
          oracleTopOrder: rest,
        };
      }

      case 'blackKnightSave': {
        return { type: 'resolvePrompt', playerId, decline: false };
      }
    }
  }

  if (state.subPhase === 'action') {
    const hand = handOf(state, playerId);
    const leader = leadingOpponent(state, playerId);

    // 1. Prefer playing a Magical Unicorn or Basic Unicorn into our own Stable (unless Queen Bee belongs to someone else)
    const qb = queenBeeOwner(state);
    const myCount = unicornCount(state, playerId);
    const oppCount = leader ? unicornCount(state, leader) : 0;
    const playableUnicorns = hand.filter(
      (c) =>
        isUnicornType(c.type) &&
        !(c.type === 'basicUnicorn' && qb && qb !== playerId) &&
        !(c.kind === 'extremely-destructive-unicorn' && myCount > oppCount) &&
        canPlayCardFromHand(state, playerId, c, playerId),
    );
    if (playableUnicorns.length > 0) {
      playableUnicorns.sort((a, b) => cardPriority(b) - cardPriority(a));
      return {
        type: 'playCard',
        playerId,
        cardId: playableUnicorns[0]!.id,
        targetPlayerId: playerId,
      };
    }

    // 2. Play an Upgrade into our own Stable
    const playableUpgrades = hand.filter(
      (c) => c.type === 'upgrade' && canPlayCardFromHand(state, playerId, c, playerId),
    );
    if (playableUpgrades.length > 0) {
      return {
        type: 'playCard',
        playerId,
        cardId: playableUpgrades[0]!.id,
        targetPlayerId: playerId,
      };
    }

    // 3. Play a Downgrade onto the leading opponent
    if (leader) {
      const playableDowngrades = hand.filter(
        (c) => c.type === 'downgrade' && canPlayCardFromHand(state, playerId, c, leader),
      );
      if (playableDowngrades.length > 0) {
        return {
          type: 'playCard',
          playerId,
          cardId: playableDowngrades[0]!.id,
          targetPlayerId: leader,
        };
      }
    }

    // 4. Play a helpful Magic card
    const playableMagic = hand.filter(
      (c) =>
        c.type === 'magic' &&
        c.kind !== 'reset-button' &&
        c.kind !== 'glitter-tornado' &&
        !((c.kind === 'catastrophe' || c.kind === 'chaos-storm') && myCount >= oppCount) &&
        !(c.kind === 'gift-receipt' && stableOf(state, playerId).downgrades.length === 0) &&
        canPlayCardFromHand(state, playerId, c),
    );
    if (playableMagic.length > 0) {
      return {
        type: 'playCard',
        playerId,
        cardId: playableMagic[0]!.id,
      };
    }

    if (state.actedInActionPhase) {
      return { type: 'endActionPhase', playerId };
    }
    return { type: 'drawInsteadOfPlaying', playerId };
  }

  return null;
}
