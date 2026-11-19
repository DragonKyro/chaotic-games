// Happy Little Dinosaurs — deterministic heuristic AI (Base + all 4 Expansions).
//
// One action per call; the shell's driver ticks it whenever the AI's seat is active. Every prompt the
// reducer can raise has an answer here, and every answer either consumes a card or closes a decision,
// so play always terminates. The AI reads only what its seat may see: its own hand, the table, the
// cards a prompt shows it, and public counts — never the deck order.

import type { PlayerId } from '@/core/types';
import {
  canPlayDisasterSaveCard,
  canPlayScoringInstantCard,
  canSkipDisasterBonus,
  computeRoundScores,
  eliminationRule,
  handOf,
  isEliminatedByDisasters,
} from './reducer';
import { HLD_DINO_DEFS } from './cards';
import type { HldAction, HldCard, HldInstantPlay, HldState } from './types';
import { livePlayerIds } from '@/core/state';

const byValueDesc = (a: HldCard, b: HldCard) => (b.value ?? 0) - (a.value ?? 0);
const byValueAsc = (a: HldCard, b: HldCard) => (a.value ?? 0) - (b.value ?? 0);

/** The live opponent furthest along the Escape Route. */
function leaderOf(s: HldState, me: PlayerId): PlayerId | undefined {
  return livePlayerIds(s)
    .filter((id) => id !== me)
    .sort((a, b) => (s.trackPosition[b] ?? 0) - (s.trackPosition[a] ?? 0))[0];
}

/** Scores if `extra` were also played (hypothetical; never mutates `s`). */
function scoresWith(s: HldState, extra: HldInstantPlay): Record<PlayerId, number> {
  return computeRoundScores({ ...s, instantPlays: [...s.instantPlays, extra] });
}

/** Whether `me` would no longer be alone at the bottom with these scores. */
function safeFromBottom(s: HldState, me: PlayerId, scores: Record<PlayerId, number>): boolean {
  const live = livePlayerIds(s);
  const min = Math.min(...live.map((id) => scores[id]!));
  return scores[me]! > min;
}

function chooseScoringInstant(s: HldState, me: PlayerId): HldAction {
  const hand = handOf(s, me);
  const scores = computeRoundScores(s);
  const live = livePlayerIds(s);
  const min = Math.min(...live.map((id) => scores[id]!));
  const pass: HldAction = { type: 'declineScoringInstant', playerId: me };

  // Turning down a Dating Disasters bonus only matters under an inversion — do it when it helps.
  if (canSkipDisasterBonus(s, me)) {
    const skipped = computeRoundScores({ ...s, skippedDisasterBonus: [...s.skippedDisasterBonus, me] });
    if (skipped[me]! > scores[me]!) return { type: 'skipDisasterBonus', playerId: me };
  }

  // Only spend Instants to climb off the bottom (keeps play simple and always terminating).
  if (scores[me] !== min) return pass;
  const playable = hand.filter((c) => canPlayScoringInstantCard(s, me, c));
  const others = live.filter((id) => id !== me);

  for (const c of playable) {
    let action: HldAction | null = null;
    let play: HldInstantPlay | null = null;
    switch (c.kind) {
      case 'score-booster':
      case 'bffs-help':
        play = { by: me, kind: c.kind, targetId: me };
        action = { type: 'playScoringInstant', playerId: me, cardId: c.id, targetPlayerId: me };
        break;
      case 'joy-of-puberty': {
        const n = Math.min(5, s.trackPosition[me] ?? 0);
        play = { by: me, kind: c.kind, targetId: me, amount: n };
        action = { type: 'playScoringInstant', playerId: me, cardId: c.id, targetPlayerId: me, amount: n };
        break;
      }
      case 'helping-hand': {
        const low = hand.filter((x) => x.type === 'point' && x.value !== null && x.value >= 1 && x.value <= 3);
        play = { by: me, kind: c.kind, amount: low.reduce((n, x) => n + (x.value ?? 0), 0) };
        action = { type: 'playScoringInstant', playerId: me, cardId: c.id, handCardIds: low.map((x) => x.id) };
        break;
      }
      case 'score-inversion':
        play = { by: me, kind: c.kind };
        action = { type: 'playScoringInstant', playerId: me, cardId: c.id };
        break;
      case 'score-sapper':
      case 'frenemys-curse':
      case 'spiteful-bullying': {
        // Knock down whoever sits just above us.
        const above = others.filter((id) => scores[id]! >= scores[me]!).sort((a, b) => scores[a]! - scores[b]!)[0];
        if (!above) break;
        const n = c.kind === 'spiteful-bullying' ? Math.min(5, s.trackPosition[me] ?? 0) : undefined;
        play = { by: me, kind: c.kind, targetId: above, ...(n !== undefined ? { amount: n } : {}) };
        action = { type: 'playScoringInstant', playerId: me, cardId: c.id, targetPlayerId: above, ...(n !== undefined ? { amount: n } : {}) };
        break;
      }
      default:
        break;
    }
    if (action && play && safeFromBottom(s, me, scoresWith(s, play))) return action;
  }
  return pass;
}

function chooseDisasterSave(s: HldState, me: PlayerId): HldAction {
  const hand = handOf(s, me);
  const playable = hand.filter((c) => canPlayDisasterSaveCard(s, me, c));
  const d = s.currentDisaster;
  const fatal = !!d && isEliminatedByDisasters([...(s.disasterAreas[me] ?? []), d], eliminationRule(s));
  const kiss = playable.find((c) => c.kind === 'awkward-first-kiss');
  // Awkward First Kiss pays 5 and keeps the window open — take it first unless the hit is fatal.
  if (kiss && !fatal) return { type: 'playDisasterSave', playerId: me, cardId: kiss.id };
  const dodge = playable.find((c) => c.kind === 'lucky-break') ?? playable.find((c) => c.kind === 'disaster-insurance');
  if (dodge) return { type: 'playDisasterSave', playerId: me, cardId: dodge.id };
  const redirect = playable.find((c) => c.kind === 'disaster-redirect');
  const target = leaderOf(s, me);
  if (redirect && target) return { type: 'playDisasterSave', playerId: me, cardId: redirect.id, targetPlayerId: target };
  if (kiss) return { type: 'playDisasterSave', playerId: me, cardId: kiss.id };
  return { type: 'declineDisasterSave', playerId: me };
}

function choosePrompt(s: HldState, me: PlayerId): HldAction | null {
  const prompt = s.promptQueue[0];
  if (!prompt || prompt.playerId !== me) return null;
  const hand = handOf(s, me);
  const others = livePlayerIds(s).filter((id) => id !== me);
  const skip: HldAction = { type: 'resolvePrompt', playerId: me, decline: true };

  switch (prompt.kind) {
    case 'discardForPoints': {
      const c = hand
        .filter((x) => x.type === 'point' && (prompt.source !== 'delicious-smoothie' || x.hasEffect))
        .sort(byValueDesc)[0];
      return c && (c.value ?? 0) > 0 ? { type: 'resolvePrompt', playerId: me, targetCardId: c.id } : skip;
    }
    case 'takeFromHand': {
      // Pick the biggest hand, then (having looked) its best Point card.
      const t = others.filter((id) => handOf(s, id).length > 0).sort((a, b) => handOf(s, b).length - handOf(s, a).length)[0];
      if (!t) return skip;
      const theirs = handOf(s, t);
      const c = [...theirs].filter((x) => x.type === 'point').sort(byValueDesc)[0] ?? theirs[0]!;
      return { type: 'resolvePrompt', playerId: me, targetPlayerId: t, targetCardId: c.id };
    }
    case 'swapPoint': {
      const mine = s.revealedPicks[me]?.value ?? 0;
      const best = [...prompt.targets].sort((a, b) => (s.revealedPicks[b]?.value ?? 0) - (s.revealedPicks[a]?.value ?? 0))[0];
      return best && (s.revealedPicks[best]?.value ?? 0) > mine ? { type: 'resolvePrompt', playerId: me, targetPlayerId: best } : skip;
    }
    case 'discardUpTo': {
      if (prompt.source === 'trash-into-treasure') {
        // +3 per card: dump the three weakest cards.
        const ids = [...hand].sort(byValueAsc).slice(0, prompt.max).map((c) => c.id);
        return ids.length ? { type: 'resolvePrompt', playerId: me, cardIds: ids } : skip;
      }
      // Fire Spray / A Bone to Flick: cycle away dead weight (Hazard Redirect, 0–1 Point cards).
      const junk = hand.filter((c) => c.kind === 'hazard-redirect' || (c.type === 'point' && (c.value ?? 0) <= 1)).slice(0, prompt.max);
      const keepsPoint = hand.some((c) => c.type === 'point' && !junk.includes(c));
      return junk.length && keepsPoint ? { type: 'resolvePrompt', playerId: me, cardIds: junk.map((c) => c.id) } : skip;
    }
    case 'peekDeck': {
      if (prompt.cards === null) return { type: 'resolvePrompt', playerId: me, look: true };
      if (prompt.source === 'bouquet-of-flowers') return { type: 'resolvePrompt', playerId: me };
      const pool = prompt.source === 'good-luck-rod' ? prompt.cards.filter((c) => c.type === 'point') : prompt.cards;
      const best = [...pool].sort((a, b) => (b.value ?? 5) - (a.value ?? 5))[0];
      return best ? { type: 'resolvePrompt', playerId: me, targetCardId: best.id } : skip;
    }
    case 'swapOthers': {
      // Saddle the Escape Route leader with the weakest card on the table.
      const lead = leaderOf(s, me);
      if (!lead) return skip;
      const leadVal = s.revealedPicks[lead]?.value ?? 0;
      const worst = others
        .filter((id) => id !== lead)
        .sort((a, b) => (s.revealedPicks[a]?.value ?? 0) - (s.revealedPicks[b]?.value ?? 0))[0];
      if (!worst || (s.revealedPicks[worst]?.value ?? 0) >= leadVal) return skip;
      return { type: 'resolvePrompt', playerId: me, targetPlayerId: lead, secondPlayerId: worst };
    }
    case 'voodoo': {
      const lows = hand.filter((c) => c.type === 'point' && (c.value ?? 0) <= 2);
      const keepsPoint = hand.some((c) => c.type === 'point' && !lows.includes(c));
      const lead = leaderOf(s, me);
      return lows.length && keepsPoint && lead
        ? { type: 'resolvePrompt', playerId: me, cardIds: lows.map((c) => c.id), targetPlayerId: lead }
        : skip;
    }
    case 'swapHands': {
      const t = others.filter((id) => handOf(s, id).length > hand.length).sort((a, b) => handOf(s, b).length - handOf(s, a).length)[0];
      return t && handOf(s, t).length >= hand.length + 2 ? { type: 'resolvePrompt', playerId: me, targetPlayerId: t } : skip;
    }
    case 'peekDisaster': {
      // Keep a Lucky Day or a Disaster our dino is good against; bury anything else.
      const d = prompt.disaster;
      if (d.category === 'lucky') return { type: 'resolvePrompt', playerId: me };
      const fatal = isEliminatedByDisasters([...(s.disasterAreas[me] ?? []), d], eliminationRule(s));
      const trait = HLD_DINO_DEFS.find((x) => x.id === s.dinos[me])?.traits[d.category] ?? 0;
      return { type: 'resolvePrompt', playerId: me, toBottom: fatal || trait <= 0 };
    }
    case 'iceCream': {
      const area = s.disasterAreas[me] ?? [];
      return area[0] ? { type: 'resolvePrompt', playerId: me, targetCardId: area[0].id } : skip;
    }
    case 'treasureTrove': {
      const best = s.discard.filter((c) => c.type === 'point').sort(byValueDesc)[0];
      return best ? { type: 'resolvePrompt', playerId: me, targetCardId: best.id } : skip;
    }
    case 'wishfulThinking': {
      const t = leaderOf(s, me) ?? me;
      return { type: 'resolvePrompt', playerId: me, targetPlayerId: t };
    }
    case 'discardAfterDisaster': {
      const junk = hand.find((c) => c.kind === 'hazard-redirect') ?? hand.filter((c) => c.type === 'point').sort(byValueAsc)[0];
      const keepsPoint = hand.some((c) => c.type === 'point' && c !== junk);
      return junk && keepsPoint && (junk.type !== 'point' || (junk.value ?? 0) <= 1)
        ? { type: 'resolvePrompt', playerId: me, targetCardId: junk.id }
        : skip;
    }
  }
}

export function chooseAIAction(state: HldState, playerId: PlayerId): HldAction | null {
  if (state.phase === 'gameOver') return null;
  if (state.activePlayerId !== playerId) return null;
  const hand = handOf(state, playerId);

  switch (state.subPhase) {
    case 'selecting':
    case 'suddenDeath': {
      const pick = hand.filter((c) => c.type === 'point').sort(byValueDesc)[0];
      if (!pick) return null;
      return state.subPhase === 'selecting'
        ? { type: 'submitPick', playerId, cardId: pick.id }
        : { type: 'submitSuddenDeathPick', playerId, cardId: pick.id };
    }
    case 'pointEffects':
    case 'resolving':
      return choosePrompt(state, playerId);
    case 'awaitingScoringInstants':
      return chooseScoringInstant(state, playerId);
    case 'awaitingDisasterSave':
      return chooseDisasterSave(state, playerId);
    default:
      return null;
  }
}
