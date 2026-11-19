// Here to Slay — deterministic heuristic AI.

import { rngInt } from '@/core/rng';
import type { PlayerId } from '@/core/types';
import {
  canAttackMonster,
  canEquipItemToHero,
  canUseNobleShaman,
  computeRollTotals,
  getClassesToWin,
  handOf,
  heroEquippedItems,
  heroHasItemKind,
  niceGiftsOf,
  partyClasses,
  partyOf,
  validHandCardsForPrompt,
  validHeroTargets,
} from './reducer';
import type { HtsAction, HtsState } from './types';

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
    const canNobleShaman = canUseNobleShaman(state, playerId);

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
            const neg = (m.modifierChoices ?? []).find((v) => v <= -excess);
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
        if (prompt.mode === 'bounceItem' || prompt.mode === 'stealItem') {
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

    // 5. Use an unexhausted Hero ability in our Party
    const usableHero = partyOf(state, playerId).find(
      (h) => !h.usedThisTurn && !heroHasItemKind(h, 'sealing-key') && h.card.kind !== 'napping-nibbles',
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
