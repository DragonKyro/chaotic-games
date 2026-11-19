// Casting Shadows — deterministic heuristic AI.
//
// One action per call; the shell's driver ticks it repeatedly. Every Action-Phase
// move it makes either spends an Action point, spends a once-a-turn thing (the
// Shadow Ability, a Resource card), or ends the turn, so every turn finishes; every
// prompt (Counterspell window, "you may" offers, Stun steal, Companion pick) gets
// an answer.
//
// Movement is range-aware: the AI stands where an Attack Spell it holds can reach a
// living enemy, and travels (shortest path over the map) when none can. Without that,
// two casters sharing a hex whose spells only reach *adjacent* hexes stared at each
// other forever (seed 699613345, 3 seats).
//
// Fair play: it reads only public state plus its own Spell Book. Opponents' face-down
// Counterspells are counted (public) but never looked at; the decks are never read.

import type { PlayerId } from '@/core/types';
import { areHexesAdjacent, hexDistance, isHexInSpellRange, rollDiceSlots, rollDieSlot } from './cards';
import {
  boardOf,
  canAffordCost,
  canCollectCard,
  canCollectCounterspell,
  canUseShadowAbility,
  combinedPool,
  legalCounterspells,
  previewHitDamage,
  protectOptions,
  roomNeededFor,
  shadowAbilityTargets,
  spellTargetOptions,
  spendIndices,
  travelDestinations,
} from './reducer';
import type { CsAction, CsCard, CsCastTier, CsHexId, CsResource, CsState } from './types';
import { livePlayerIds } from '@/core/state';

/** A per-decision seed for dice this seat rolls. Never used to peek at anything. */
function rollSeed(state: CsState, salt: number): { seed: number } {
  return { seed: (state.rngState.seed + state.logSeq * 0x9e3779b9 + salt * 0x85ebca6b) >>> 0 };
}

const hexIdsOf = (state: CsState) => Object.keys(state.hexes) as CsHexId[];

function neighbours(state: CsState, hexId: CsHexId): CsHexId[] {
  return hexIdsOf(state).filter((h) => areHexesAdjacent(state.hexes[hexId], state.hexes[h]));
}

/** First step on a shortest path from `from` to any goal hex (null if already there, or no path). */
function stepToward(state: CsState, from: CsHexId, goals: ReadonlySet<CsHexId>): CsHexId | null {
  if (goals.has(from) || goals.size === 0) return null;
  const firstStep = new Map<CsHexId, CsHexId>();
  let frontier: CsHexId[] = [];
  for (const n of neighbours(state, from)) {
    firstStep.set(n, n);
    frontier.push(n);
  }
  const seen = new Set<CsHexId>([from, ...frontier]);
  while (frontier.length) {
    const hit = frontier.find((h) => goals.has(h));
    if (hit) return firstStep.get(hit)!;
    const next: CsHexId[] = [];
    for (const h of frontier) {
      for (const n of neighbours(state, h)) {
        if (seen.has(n)) continue;
        seen.add(n);
        firstStep.set(n, firstStep.get(h)!);
        next.push(n);
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * Hexes from which an Attack Spell in this caster's book would actually hurt a living
 * enemy where they stand now (in range, and not shrugged off by their hex tile — e.g.
 * someone alone on Amber Mountain can only be hit by joining them there).
 */
export function strikingHexes(state: CsState, playerId: PlayerId): Set<CsHexId> {
  const b = boardOf(state, playerId);
  const enemies = livePlayerIds(state).filter((id) => id !== playerId);
  const out = new Set<CsHexId>();
  for (const spell of b.spellBook) {
    if (spell.type !== 'attackSpell') continue;
    const range = spell.range ?? 'sameOrAdjacent';
    const top = Math.max(0, ...(spell.castTiers ?? []).map((t) => t.damage));
    for (const h of hexIdsOf(state)) {
      const hits = enemies.some((e) => {
        if (!isHexInSpellRange(state.hexes, h, boardOf(state, e).hexId, range)) return false;
        if (spell.kind === 'lightning-bug' && boardOf(state, e).form === 'shadow') return false;
        const spec = { attackerId: playerId, baseDamage: top, unreducible: false, fromAttackSpell: true };
        return hitScore(previewHitDamage(state, spec, e, h)) > 0;
      });
      if (hits) out.add(h);
    }
  }
  return out;
}

/** Could this caster ever collect `card` (a Spell requirement it can meet)? */
function collectable(state: CsState, playerId: PlayerId, card: CsCard | null): boolean {
  if (!card) return false;
  const room = roomNeededFor(state, playerId, card);
  return room === null || room.length > 0;
}

/** How much a card is worth keeping (higher = keep). */
function cardValue(c: CsCard): number {
  switch (c.type) {
    case 'attackSpell':
      return 10 + c.level * 4 + Math.max(0, ...(c.castTiers ?? []).map((t) => t.damage));
    case 'counterspell':
      return 9;
    case 'conversionSpell':
      return 4 + c.level;
    case 'resource':
      return 3;
    default:
      return 0;
  }
}

const COMPANION_PREFERENCE = [
  'protective-panda',
  'hydrattle-snake',
  'charging-stag',
  'speed-mouster',
  'swamp-monster',
  'crushing-tortoise',
  'occult-octo',
  'cursemaster-raccoon',
  'recovery-raven',
  'sharp-hedge',
];

export function chooseAIAction(state: CsState, playerId: PlayerId): CsAction | null {
  if (state.phase === 'gameOver') return null;
  if (state.activePlayerId !== playerId) return null;
  const b = boardOf(state, playerId);
  const enemies = livePlayerIds(state).filter((id) => id !== playerId);
  const enemiesOn = (h: CsHexId) => enemies.filter((e) => boardOf(state, e).hexId === h).length;
  const weakest = (ids: readonly PlayerId[]) => [...ids].sort((x, y) => boardOf(state, x).hp - boardOf(state, y).hp)[0];

  switch (state.subPhase) {
    case 'awaitingRoll': {
      // Stunned: leave out the special die (it carries the most Cursed Crystals).
      const slots = b.stunned ? [0, 1, 2, 3] : [0, 1, 2, 3, 4];
      return { type: 'rollResourceDice', playerId, dice: rollDiceSlots(rollSeed(state, 1), slots), slots };
    }

    case 'awaitingCompanionPick': {
      const rank = (c: CsCard) => {
        const i = COMPANION_PREFERENCE.indexOf(c.kind);
        return i < 0 ? COMPANION_PREFERENCE.length : i;
      };
      const comp = [...state.companionPortal].sort((x, y) => rank(x) - rank(y))[0];
      return comp ? { type: 'pickCompanion', playerId, companionId: comp.id } : null;
    }

    case 'awaitingCounterspell': {
      const atk = state.pendingAttack;
      const legal = legalCounterspells(state, playerId);
      if (!atk || legal.length === 0) return { type: 'respondCounterspell', playerId };
      const pref = (c: CsCard) =>
        c.kind === 'safety-dome' ? (atk.damage >= 4 ? 0 : 5) : c.kind === 'pointed-shield' ? 1 : c.kind === 'bees-everywhere' ? 2 : c.kind === 'run-away' ? 4 : 3;
      const cs = [...legal].sort((x, y) => pref(x) - pref(y))[0]!;
      if (cs.kind === 'run-away') {
        const away = [...neighbours(state, b.hexId)].sort((x, y) => enemiesOn(x) - enemiesOn(y))[0];
        return { type: 'respondCounterspell', playerId, counterspellId: cs.id, ...(away ? { escapeHexId: away } : {}) };
      }
      return { type: 'respondCounterspell', playerId, counterspellId: cs.id };
    }

    case 'awaitingOffer': {
      const offer = state.pendingOffer;
      if (!offer) return null;
      if (offer.kind === 'stagStrike' || offer.kind === 'tortoise') {
        const t = weakest(offer.options);
        return t ? { type: 'answerOffer', playerId, accept: true, targetPlayerId: t } : { type: 'answerOffer', playerId, accept: false };
      }
      if (offer.kind === 'ravenHeal') return { type: 'answerOffer', playerId, accept: b.hp < b.maxHp };
      return { type: 'answerOffer', playerId, accept: true };
    }

    case 'awaitingStunSteal': {
      // Take the most useful thing in the victim's pool — never a Cursed Crystal (that would help them).
      const pool = combinedPool(state);
      const order: CsResource[] = ['purpleGem', 'redGem', 'blueGem', 'purpleOrb', 'redOrb', 'blueOrb', 'shadowFragment'];
      for (const r of order) {
        const i = pool.indexOf(r);
        if (i >= 0) return { type: 'stunSteal', playerId, poolIndex: i };
      }
      return { type: 'stunSteal', playerId };
    }

    case 'awaitingAction':
      return chooseTurnAction(state, playerId);

    default:
      return null;
  }
}

function chooseTurnAction(state: CsState, playerId: PlayerId): CsAction {
  const b = boardOf(state, playerId);
  const enemies = livePlayerIds(state).filter((id) => id !== playerId);
  const enemiesOn = (h: CsHexId) => enemies.filter((e) => boardOf(state, e).hexId === h).length;
  const ap = state.actionPointsRemaining;
  const end: CsAction = { type: 'transformAndEndTurn', playerId, transform: true };

  // 1. Shadow Ability (free) when it would hit someone.
  if (canUseShadowAbility(state, playerId)) {
    const t = shadowAbilityTargets(state, playerId);
    if (t.kind === 'none' && t.hits) return { type: 'useShadowAbility', playerId };
    if (t.kind === 'player' && t.options.length) {
      const victim = [...t.options].sort((x, y) => boardOf(state, x).hp - boardOf(state, y).hp)[0]!;
      return { type: 'useShadowAbility', playerId, targetPlayerId: victim };
    }
    if (t.kind === 'hex') {
      const busiest = [...t.options].filter((h) => enemiesOn(h) > 0).sort((x, y) => enemiesOn(y) - enemiesOn(x))[0];
      if (busiest) return { type: 'useShadowAbility', playerId, targetHexId: busiest };
    }
    if (t.kind === 'amount' && t.hits && b.hp >= 10) {
      return { type: 'useShadowAbility', playerId, amount: Math.max(1, Math.min(t.max, b.hp - 8)) };
    }
  }

  if (ap <= 0) return end;

  // 2. Cast the hardest-hitting Attack Spell we can afford and aim.
  const cast = bestCast(state, playerId, combinedPool(state));
  if (cast) return cast.action;

  // 2b. A Resource card (free) that would let us cast one right now.
  for (const card of b.spellBook) {
    if (card.type !== 'resource' || !card.grantsResource) continue;
    if (bestCast(state, playerId, [...combinedPool(state), card.grantsResource])) {
      return { type: 'useResourceCard', playerId, cardId: card.id };
    }
  }

  // 3. Collect the card here when it's worth more than whatever it costs us from the book.
  const curHex = state.hexes[b.hexId];
  const attackCount = b.spellBook.filter((c) => c.type === 'attackSpell').length;
  const card = curHex.faceUpCard;
  if (card && canCollectCard(state, playerId, card)) {
    const room = roomNeededFor(state, playerId, card);
    const wanted = card.type === 'attackSpell' || (attackCount >= 1 && card.type === 'conversionSpell');
    if (wanted && !room) return { type: 'collectCard', playerId };
    if (wanted && room?.length) {
      const victim = [...room].sort((x, y) => cardValue(x) - cardValue(y))[0]!;
      if (cardValue(victim) < cardValue(card) || card.requiresSpellLevel) {
        return { type: 'collectCard', playerId, replaceSpellId: victim.id };
      }
    }
  }
  // A Counterspell, when we're at Dusty Desert anyway and have room.
  if (attackCount >= 1 && b.spellBook.length < 4 && canCollectCounterspell(state, playerId)) {
    return { type: 'collectCard', playerId, fromCounterspellDeck: true };
  }

  // 4. Get within range of an enemy — or go shopping for more firepower.
  const striking = strikingHexes(state, playerId);
  const dests = travelDestinations(state, playerId);
  const goTo = (goals: Set<CsHexId>): CsAction | null => {
    if (dests.length === 0) return null; // Frozen: can't move
    const direct = dests.find((h) => goals.has(h));
    if (direct) return { type: 'travel', playerId, toHexId: direct };
    const step = stepToward(state, b.hexId, goals);
    return step && dests.includes(step) ? { type: 'travel', playerId, toHexId: step } : null;
  };
  // An Attack Spell we can collect right now within reach this turn (keeping 1 AP to collect it).
  // This is what stops two casters trading blows smaller than the Ancient Rune's healing forever.
  if (ap >= 2 && (attackCount < 3 || striking.size === 0)) {
    const stride = b.companion?.kind === 'speed-mouster' ? 2 : 1;
    const shops = new Set(
      hexIdsOf(state).filter((h) => {
        const c = state.hexes[h].faceUpCard;
        if (h === b.hexId || c?.type !== 'attackSpell' || !collectable(state, playerId, c) || !canAffordCost(state, c.collectionCost)) return false;
        return Math.ceil(hexDistance(state.hexes[b.hexId], state.hexes[h]) / stride) <= ap - 1;
      }),
    );
    const move = goTo(shops);
    if (move) return move;
  }
  if (attackCount === 0 || striking.size === 0) {
    // No Attack Spell yet: head for the nearest one on the map, or turn this hex's card over.
    const spellHexes = new Set(
      hexIdsOf(state).filter((h) => state.hexes[h].faceUpCard?.type === 'attackSpell' && collectable(state, playerId, state.hexes[h].faceUpCard)),
    );
    if (spellHexes.has(b.hexId)) {
      // Standing on one we can't afford yet: try to reroll into it.
      const reroll = rerollToward(state, playerId, card?.collectionCost ?? {});
      if (reroll && ap >= 2) return reroll;
    } else {
      const move = goTo(spellHexes);
      if (move) return move;
      if (curHex.hasMainDeckSlot) return { type: 'refreshHexCard', playerId };
    }
  } else if (!striking.has(b.hexId)) {
    const move = goTo(striking);
    if (move) return move;
  }

  // 5. In range but short of resources: reroll toward the cheapest reachable spell (keep 1 AP to cast).
  if (ap >= 2 && striking.has(b.hexId)) {
    for (const spell of b.spellBook) {
      if (spell.type !== 'attackSpell' || b.usedSpellIdsThisTurn.includes(spell.id)) continue;
      if (!hasTarget(state, playerId, spell)) continue;
      const tier = spell.castTiers?.[0];
      if (!tier) continue;
      const reroll = rerollToward(state, playerId, tier.cost);
      if (reroll) return reroll;
    }
  }

  // 6. Shake off what will hurt at the end of the turn.
  const protect = protectOptions(state, playerId);
  if (protect.includes('cursedCrystal')) {
    const octo = b.companion?.kind === 'occult-octo'
      ? neighbours(state, b.hexId).filter((h) => enemiesOn(h) > 0).sort((x, y) => enemiesOn(y) - enemiesOn(x))[0]
      : undefined;
    return { type: 'protect', playerId, clearStatus: 'cursedCrystal', ...(octo ? { targetHexId: octo } : {}) };
  }
  if (protect.includes('burning')) return { type: 'protect', playerId, clearStatus: 'burning' };

  // 7. Still short of Attack Spells: turn this hex's card over for a fresh one.
  if (attackCount < 2 && curHex.hasMainDeckSlot && card?.type !== 'attackSpell') return { type: 'refreshHexCard', playerId };

  return end;
}

function hasTarget(state: CsState, playerId: PlayerId, spell: CsCard): boolean {
  const t = spellTargetOptions(state, playerId, spell);
  if (t.players.length) return true;
  return t.hexes.some((h) => livePlayerIds(state).some((e) => e !== playerId && boardOf(state, e).hexId === h));
}

/** A hit's worth: its DMG, plus a little for breaking a Fortify shield. */
const hitScore = (h: { damage: number; fortifyUsed: number }) => h.damage + h.fortifyUsed / 2;

/** The best Attack Spell cast payable from `pool` (most total DMG), or null. */
function bestCast(state: CsState, playerId: PlayerId, pool: readonly CsResource[]): { action: CsAction; dmg: number } | null {
  const b = boardOf(state, playerId);
  const enemies = livePlayerIds(state).filter((id) => id !== playerId);
  const enemiesOn = (h: CsHexId) => enemies.filter((e) => boardOf(state, e).hexId === h).length;
  let best: { action: CsAction; dmg: number } | null = null;
  for (const spell of b.spellBook) {
    if (spell.type !== 'attackSpell' || b.usedSpellIdsThisTurn.includes(spell.id)) continue;
    const tiers: CsCastTier[] = spell.castTiers ?? [];
    const t = spellTargetOptions(state, playerId, spell);
    for (let tIdx = tiers.length - 1; tIdx >= 0; tIdx--) {
      const tier = tiers[tIdx]!;
      if (!spendIndices(pool, tier.cost)) continue;
      if (spell.targetsAllOnHex) {
        const want = tier.hexCount ?? 1;
        const hexes = [...t.hexes].filter((h) => enemiesOn(h) > 0).sort((x, y) => enemiesOn(y) - enemiesOn(x));
        if (hexes.length < want) continue;
        const chosen = hexes.slice(0, want);
        const spec = { attackerId: playerId, baseDamage: tier.damage, unreducible: false, fromAttackSpell: true };
        const dmg = enemies
          .filter((e) => chosen.includes(boardOf(state, e).hexId))
          .reduce((n, e) => n + hitScore(previewHitDamage(state, spec, e)), 0);
        if (dmg > 0 && (!best || dmg > best.dmg)) {
          best = {
            action: { type: 'castSpell', playerId, spellId: spell.id, tierIndex: tIdx, ...(want > 1 ? { targetHexIds: chosen } : { targetHexId: chosen[0]! }) },
            dmg,
          };
        }
      } else if (t.players.length) {
        // Lightning Bug does nothing to a Shadow Form enemy.
        const spec = { attackerId: playerId, baseDamage: tier.damage, unreducible: false, fromAttackSpell: true };
        const scored = t.players
          .filter((p) => !(spell.kind === 'lightning-bug' && boardOf(state, p).form === 'shadow'))
          .map((p) => ({ p, dmg: hitScore(previewHitDamage(state, spec, p)) }))
          .filter((x) => x.dmg > 0)
          .sort((x, y) => y.dmg - x.dmg || boardOf(state, x.p).hp - boardOf(state, y.p).hp);
        const top = scored[0];
        if (top && (!best || top.dmg > best.dmg)) {
          best = { action: { type: 'castSpell', playerId, spellId: spell.id, tierIndex: tIdx, targetPlayerId: top.p }, dmg: top.dmg };
        }
      }
      break; // the highest affordable tier of this spell is the one worth weighing
    }
  }
  return best;
}

/** Reroll the dice that don't help pay `cost` (Cursed Crystals can't be rerolled). Null if nothing to gain. */
function rerollToward(state: CsState, playerId: PlayerId, cost: CsCastTier['cost']): CsAction | null {
  if (canAffordCost(state, cost)) return null;
  const pool = combinedPool(state);
  const nb = state.bonusPool.length;
  const keep = new Set<number>();
  // Keep whatever partly pays the cost: try each cost line on its own.
  for (const [k, v] of Object.entries(cost)) {
    for (let n = v ?? 0; n > 0; n--) {
      const used = spendIndices(pool.filter((_, i) => !keep.has(i)), { [k]: n });
      if (used) {
        const free = pool.map((_, i) => i).filter((i) => !keep.has(i));
        for (const u of used) keep.add(free[u]!);
        break;
      }
    }
  }
  const dice = state.dicePool
    .map((r, i) => ({ r, i }))
    .filter(({ r, i }) => r !== 'cursedCrystal' && r !== 'shadowFragment' && !keep.has(nb + i))
    .map(({ i }) => i);
  if (dice.length === 0) return null;
  const rng = rollSeed(state, 2);
  return {
    type: 'rerollDice',
    playerId,
    diceIndices: dice,
    newValues: dice.map((i) => rollDieSlot(rng, state.diceSlots[i] ?? i)),
  };
}
