// Here to Slay — deterministic heuristic AI.

import { rngInt } from '@/core/rng';
import type { PlayerId } from '@/core/types';
import {
  canAttackMonster,
  canEquipItemToHero,
  canUseBiggestRing,
  canMuscipulaDraw,
  canPlayChallengeCard,
  canRollHero,
  canUseNobleShaman,
  classesInGame,
  computeRollTotals,
  getClassesToWin,
  handOf,
  heroEffectiveClass,
  heroEquippedItems,
  heroRollCost,
  majestelkSidesOwed,
  modifierValuesFor,
  niceGiftsOf,
  partyClasses,
  partyOf,
  pickablePileCards,
  validHandCardsForPrompt,
  validHeroTargets,
  validMonsterTargets,
  validPartyCardTargets,
} from './reducer';
import type { HtsAction, HtsCard, HtsPartyHero, HtsPendingRoll, HtsState } from './types';

/**
 * Heroes the AI never brings back into play from the discard pile: Beholden
 * Retriever can sacrifice itself and fetch itself again, forever.
 */
const NO_RECALL = new Set(['beholden-retriever']);

/**
 * Heroes the AI won't roll for: Napping Nibbles does nothing, and a Beholden
 * Retriever alone in its Party would have to sacrifice itself — and could then
 * fetch itself back and do it again.
 */
function worthRolling(s: HtsState, playerId: PlayerId, kind: string): boolean {
  if (kind === 'napping-nibbles') return false;
  if (kind === 'beholden-retriever') return partyOf(s, playerId).length > 1;
  return true;
}

/** How much a Hero is worth keeping: a lone class in the Party matters most; a curse on it, not at all. */
function keepScore(party: HtsPartyHero[], h: HtsPartyHero): number {
  if (heroEquippedItems(h).some((i) => i.type === 'cursedItem')) return -1;
  const cls = heroEffectiveClass(h);
  const sameClass = party.filter((x) => heroEffectiveClass(x) === cls).length;
  return (sameClass === 1 ? 10 : 0) + heroEquippedItems(h).length;
}

/** Cards the AI parts with first (Biggest Ring Ever discards): Heroes and Modifiers last. */
const SHED_ORDER: Record<HtsCard['type'], number> = { challenge: 0, cursedItem: 0, item: 1, magic: 2, gift: 2, modifier: 3, hero: 4, partyLeader: 9, monster: 9 };

/** Which way the roller wants their own roll to go (+1 higher, -1 lower). */
function wantedDirection(s: HtsState, r: HtsPendingRoll, side: 'actor' | 'challenger'): 1 | -1 {
  if (side === 'challenger' || r.reason === 'challengeDuel') return 1;
  if (r.reason === 'monsterAttack') return s.monsterRow.find((m) => m.card.id === r.sourceCardId)?.slayOnLow ? -1 : 1;
  return r.rollLow ? -1 : 1;
}

/** Leader draft preference (no peeking at hands — there are none yet). */
const LEADER_PREFERENCE = [
  'leader-divine-arrow',
  'leader-charismatic-song',
  'leader-cloaked-sage',
  'leader-fist-of-reason',
  'leader-protecting-horn',
  'leader-shadow-claw',
];

function roll2d6FromState(s: HtsState, salt: number): [number, number] {
  const copy = { seed: (s.rngState.seed + salt * 0x9e3779b9) >>> 0 };
  const d1 = rngInt(copy, 6) + 1;
  const d2 = rngInt(copy, 6) + 1;
  return [d1, d2];
}

export function chooseAIAction(state: HtsState, playerId: PlayerId): HtsAction | null {
  if (state.phase === 'gameOver') return null;
  if (state.activePlayerId !== playerId) return null;

  if (state.subPhase === 'choosingLeaders') {
    const pool = state.leaderDraft?.pool ?? [];
    if (state.leaderDraft?.order[0] !== playerId || pool.length === 0) return null;
    const pick = LEADER_PREFERENCE.map((k) => pool.find((c) => c.kind === k)).find((c) => !!c) ?? pool[0]!;
    return { type: 'choosePartyLeader', playerId, leaderKind: pick.kind };
  }

  if (state.subPhase === 'awaitingChallenge') {
    const p = state.pendingPlay;
    if (!p) return null;
    // Challenge if opponent is about to win with a final class Hero
    const classesNeeded = getClassesToWin(state.config);
    const oppClasses = partyClasses(state, p.byPlayerId);
    const wouldCompleteParty =
      p.card.type === 'hero' &&
      p.card.class &&
      !oppClasses.has(p.card.class) &&
      oppClasses.size >= classesNeeded - 1;
    if (wouldCompleteParty) {
      const playable = handOf(state, playerId).filter((c) => canPlayChallengeCard(state, playerId, c));
      const ch = playable.sort((a, b) => (b.challengeBonus ?? 0) - (a.challengeBonus ?? 0))[0];
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
    const hand = handOf(state, playerId);
    // Modifier +7 discards the rest of the hand: only worth it with little else in it.
    const mods = (state.turnBuffs.noOpponentModifiers && playerId !== state.turnPlayerId ? [] : hand.filter((c) => c.type === 'modifier'))
      .filter((c) => c.kind !== 'mod-bn-plus-7' || hand.length <= 2)
      .sort((a, b) => Number(a.kind === 'mod-bn-plus-7') - Number(b.kind === 'mod-bn-plus-7'));
    const canNobleShaman = canUseNobleShaman(state, playerId);

    // Majestelk: a sign is owed on each of our own rolls - always the helpful one.
    const owed = majestelkSidesOwed(state, r, playerId)[0];
    if (owed) return { type: 'majestelkSign', playerId, sign: wantedDirection(state, r, owed), targetSide: owed };

    // Help our own Monster or Hero roll if we are just short of threshold
    if (r.byPlayerId === playerId && r.reason !== 'challengeDuel') {
      if (r.rollLow) {
        // Druid low-roll or Dracos: need actorTotal <= r.threshold!
        const excess = actorTotal - r.threshold;
        if (excess === 1 && canNobleShaman) {
          return { type: 'nobleShamanAdjust', playerId, delta: -1 };
        }
        if (excess > 0 && excess <= 4 && mods.length > 0) {
          for (const m of mods) {
            const neg = modifierValuesFor(r, playerId, m).find((v) => v <= -excess);
            if (neg !== undefined) {
              return {
                type: 'playModifier',
                playerId,
                cardId: m.id,
                chosenValue: neg,
                protectingHornDelta: -1,
              };
            }
          }
        }
      } else {
        const deficit = r.threshold - actorTotal;
        // Biggest Ring Ever: shed the cheapest cards, +2 each, when that is enough.
        const shed = Math.ceil(deficit / 2);
        if (deficit > 0 && shed <= 3 && shed <= hand.length && canUseBiggestRing(state, r, playerId)) {
          const cheapest = [...hand].sort((a, b) => SHED_ORDER[a.type] - SHED_ORDER[b.type]).slice(0, shed);
          return { type: 'biggestRingDiscard', playerId, cardIds: cheapest.map((c) => c.id) };
        }
        if (deficit > 0 && deficit <= 4 && mods.length > 0) {
          for (const m of mods) {
            const pos = modifierValuesFor(r, playerId, m).find((v) => v >= deficit);
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
    }

    // The Noble Shaman's -1 spoils an opponent's roll that only just succeeds.
    if (canNobleShaman && r.byPlayerId !== playerId && r.reason !== 'challengeDuel' && !r.rollLow && actorTotal === r.threshold) {
      return { type: 'nobleShamanAdjust', playerId, delta: -1 };
    }

    return { type: 'declineModifier', playerId };
  }

  if (state.subPhase === 'awaitingPrompt') {
    const prompt = state.promptQueue[0];
    if (!prompt || prompt.playerId !== playerId) return null;

    switch (prompt.kind) {
      case 'rollEnteredHero': {
        if (!worthRolling(state, playerId, prompt.heroCard.kind)) return { type: 'resolvePrompt', playerId, decline: true };
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
        let pick = valid[0]!;
        if (prompt.mode === 'sacrifice') {
          // Give up the Hero we'd miss least.
          const party = partyOf(state, playerId);
          pick = [...valid].sort((a, b) => keepScore(party, a.hero) - keepScore(party, b.hero))[0]!;
        }
        if (prompt.effectTag === 'unbridledFuryDestroy') {
          // Destroying a Berserker earns an extra action point.
          pick = valid.find((v) => heroEffectiveClass(v.hero) === 'berserker') ?? pick;
        }
        if (prompt.mode === 'bounceItem') {
          // Strip an opponent's good Item, or shed a curse of our own.
          const helps = (v: (typeof valid)[number]) => {
            const cursed = heroEquippedItems(v.hero).some((i) => i.type === 'cursedItem');
            return v.ownerId === playerId ? cursed : !cursed;
          };
          pick = valid.find(helps) ?? pick;
        }
        if (prompt.mode === 'equipItem') {
          // Curses go to an opponent's Hero, everything else to our own.
          const item = handOf(state, playerId).find((c) => c.id === prompt.itemCardId);
          const wantOwn = item?.type !== 'cursedItem';
          pick = valid.find((v) => (v.ownerId === playerId) === wantOwn) ?? pick;
        }
        return {
          type: 'resolvePrompt',
          playerId,
          targetCardId: pick.hero.card.id,
        };
      }
      case 'chooseCardsFromHand': {
        const valid = validHandCardsForPrompt(state, prompt);
        if (valid.length === 0) {
          return prompt.optional
            ? { type: 'resolvePrompt', playerId, decline: true }
            : { type: 'resolvePrompt', playerId, cardIds: [] };
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
        const all = pickablePileCards(prompt);
        const pickable = all.filter((c) => !(prompt.then === 'playImmediately' && NO_RECALL.has(c.kind)));
        // A mandatory pick with only an unwanted card on offer still has to be made.
        const first = pickable.find((c) => c.type === 'hero') ?? pickable[0] ?? (prompt.optional ? undefined : all[0]);
        if (!first) return { type: 'resolvePrompt', playerId, decline: true };
        return { type: 'resolvePrompt', playerId, targetCardId: first.id };
      }
      case 'choosePartyCard': {
        const valid = validPartyCardTargets(state, prompt);
        const idOf = (t: (typeof valid)[number]) => (t.item ? t.item.id : t.hero.card.id);
        if (prompt.mode === 'sacrifice') {
          // A curse on our own Hero is the ideal sacrifice; Rabid Beast stops there.
          const curse = valid.find((t) => t.item?.type === 'cursedItem');
          if (curse) return { type: 'resolvePrompt', playerId, targetCardId: idOf(curse) };
          if (prompt.optional) return { type: 'resolvePrompt', playerId, decline: true };
          const party = partyOf(state, playerId);
          const items = valid.filter((t) => t.item && t.item.class === null);
          const heroes = valid.filter((t) => !t.item).sort((a, b) => keepScore(party, a.hero) - keepScore(party, b.hero));
          const cheapest = items[0] ?? heroes[0] ?? valid[0];
          return cheapest ? { type: 'resolvePrompt', playerId, targetCardId: idOf(cheapest) } : { type: 'resolvePrompt', playerId, decline: true };
        }
        // Destroy: a whole Hero beats a good Item; never a curse that hurts them.
        const pick = valid.find((t) => !t.item) ?? valid.find((t) => t.item?.type !== 'cursedItem') ?? valid[0];
        return pick ? { type: 'resolvePrompt', playerId, targetCardId: idOf(pick) } : { type: 'resolvePrompt', playerId, decline: true };
      }
      case 'chooseMonster': {
        const targets = validMonsterTargets(state, prompt);
        const best = [...targets].sort((a, b) => a.slayThreshold - b.slayThreshold)[0];
        if (!best) return null;
        return prompt.mode === 'attack'
          ? { type: 'resolvePrompt', playerId, targetCardId: best.card.id, dice: roll2d6FromState(state, state.logSeq + 11) }
          : { type: 'resolvePrompt', playerId, targetCardId: best.card.id };
      }
      case 'chooseClass': {
        // The class that costs the other Parties the most Heroes and ours the fewest.
        const score = (cls: string) => state.seats.reduce((n, st) => {
          const count = partyOf(state, st.id).filter((h) => heroEffectiveClass(h) === cls).length;
          return n + (st.id === playerId ? -2 * count : count);
        }, 0);
        const cls = [...prompt.classes].sort((a, b) => score(b) - score(a))[0] ?? classesInGame(state)[0]!;
        return { type: 'resolvePrompt', playerId, className: cls };
      }
      case 'rerollHero':
        return { type: 'resolvePrompt', playerId, dice: roll2d6FromState(state, state.logSeq + 13) };
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
      case 'confirm': {
        return { type: 'resolvePrompt', playerId };
      }
      case 'step':
        // Steps resolve themselves; one never waits on a player.
        return null;
    }
  }

  if (state.subPhase === 'awaitingAction') {
    if (state.actionPointsRemaining <= 0) {
      return { type: 'endTurn', playerId };
    }

    const hand = handOf(state, playerId);
    const myClasses = partyClasses(state, playerId);

    // Muscipula Rex's free draw costs nothing.
    if (canMuscipulaDraw(state, playerId)) return { type: 'muscipulaDraw', playerId };

    // 0. If Here to Sleigh is enabled and we have 2 Nice Gifts + 2 AP + 1 Hero, claim the 3rd Nice Gift to win!
    if (
      state.config.expansions.includes('here-to-sleigh') &&
      state.actionPointsRemaining >= 2 &&
      partyOf(state, playerId).length >= 1 &&
      niceGiftsOf(state, playerId).length >= 2
    ) {
      return { type: 'claimHolidayGift', playerId };
    }

    // 1. Play a Hero of a class we don't have yet (or any Hero)
    const heroesInHand = hand.filter((c) => c.type === 'hero');
    const newClassHero = heroesInHand.find((c) => c.class && !myClasses.has(c.class));
    const heroToPlay = newClassHero ?? heroesInHand[0];
    if (heroToPlay) {
      return { type: 'playHero', playerId, cardId: heroToPlay.id };
    }

    // 2. Use The Gnawing Dread leader ability if discard has a Hero of a missing class
    if (
      state.partyLeaders[playerId]?.kind === 'leader-gnawing-dread' &&
      !state.turnBuffs.gnawingDreadUsed &&
      state.actionPointsRemaining >= 2 &&
      state.discard.some((c) => c.type === 'hero' && c.class && !myClasses.has(c.class))
    ) {
      return { type: 'gnawingDreadSearch', playerId };
    }

    // 3. Attack a Monster if we have >= 2 AP and meet requirements
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

    // 4. Equip a beneficial Item to one of our Heroes, or a curse to an opponent's
    for (const item of hand.filter((c) => c.type === 'item' || c.type === 'cursedItem')) {
      const owners = item.type === 'cursedItem' ? state.seats.filter((x) => x.id !== playerId).map((x) => x.id) : [playerId];
      for (const owner of owners) {
        const equipTarget = partyOf(state, owner).find((h) => canEquipItemToHero(h, item));
        if (equipTarget) {
          return {
            type: 'equipItem',
            playerId,
            cardId: item.id,
            targetPlayerId: owner,
            heroCardId: equipTarget.card.id,
          };
        }
      }
    }

    // 5. Use an unexhausted Hero ability in our Party - at most twice a turn
    // even with Bottomless Bag: with Temporal Hourglass a failed roll refunds
    // itself, and an unreachable roll would otherwise loop forever.
    const usableHero = partyOf(state, playerId).find(
      (h) => canRollHero(h) && (h.rollsThisTurn ?? 0) < 2 && heroRollCost(h) <= state.actionPointsRemaining && worthRolling(state, playerId, h.card.kind),
    );
    if (usableHero) {
      return {
        type: 'useHeroAbility',
        playerId,
        heroCardId: usableHero.card.id,
        dice: roll2d6FromState(state, state.logSeq + 7),
      };
    }

    // 6. Spend 1 AP to draw a card
    return { type: 'drawCard', playerId };
  }

  return null;
}
