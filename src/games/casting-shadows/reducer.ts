// Casting Shadows — pure deterministic reducer for the Base Game.

import { shuffle } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import {
  areHexesAdjacent,
  buildCsDecks,
  CS_CHARACTERS,
  CS_HEX_DEFS,
  isHexInSpellRange,
} from './cards';
import type {
  CsAction,
  CsCard,
  CsConfig,
  CsHexId,
  CsHexTile,
  CsPlayerBoard,
  CsResource,
  CsResourceCost,
  CsState,
} from './types';

const LOG_CAP = 60;
const SPELLBOOK_LIMIT = 5;

// ============================================================================
// Setup
// ============================================================================

export function createInitialState(config: CsConfig, seed: number, seats: Seat[]): CsState {
  const rngState = { seed: seed >>> 0 };
  const first = seats[0];
  if (!first) throw new Error('Casting Shadows needs at least one seat');

  const { mainDeck, counterspellDeck, companionDeck } = buildCsDecks(rngState);
  const companionPortal = companionDeck.splice(0, 3);

  const hexes = {} as Record<CsHexId, CsHexTile>;
  for (const h of CS_HEX_DEFS) {
    hexes[h.id] = {
      ...h,
      faceUpCard: h.hasMainDeckSlot ? mainDeck.shift() ?? null : null,
    };
  }

  const boards: Record<PlayerId, CsPlayerBoard> = {};
  seats.forEach((seat, idx) => {
    const chosenId = config.characterByPlayer[seat.id];
    const charDef =
      CS_CHARACTERS.find((c) => c.id === chosenId) ??
      CS_CHARACTERS[idx % CS_CHARACTERS.length]!;
    boards[seat.id] = {
      characterId: charDef.id,
      form: 'light',
      hexId: charDef.homeHex,
      hp: 18,
      maxHp: 18,
      shadowEnergy: 0,
      spellBook: [],
      usedSpellIdsThisTurn: [],
      companion: null,
      usedShadowAbilityThisTurn: false,
    };
  });

  const state: CsState = {
    phase: 'playing',
    seats,
    activePlayerId: first.id,
    finalScores: null,
    rngState,

    subPhase: 'awaitingRoll',
    hexes,
    boards,
    eliminated: [],

    mainDeck,
    mainDiscard: [],
    counterspellDeck,
    counterspellDiscard: [],
    companionDeck,
    companionPortal,

    turnPlayerId: first.id,
    actionPointsRemaining: 4,
    dicePool: [],
    bonusPool: [],

    pendingAttack: null,
    winnerId: null,

    log: [],
    logSeq: 0,
    config,
  };

  pushLog(state, null, `${seats.length} Shadow Casters enter the arena (18 HP each). Last player standing wins!`, 'normal');
  return state;
}

// ============================================================================
// Helpers & Resource Payment
// ============================================================================

function clone(state: CsState): CsState {
  return JSON.parse(JSON.stringify(state)) as CsState;
}

function pushLog(s: CsState, byPlayerId: PlayerId | null, text: string, tone: 'normal' | 'danger' | 'good') {
  s.logSeq += 1;
  s.log.push({ seq: s.logSeq, byPlayerId, text, tone });
  if (s.log.length > LOG_CAP) s.log = s.log.slice(-LOG_CAP);
}

export function seatName(s: CsState, id: PlayerId | null): string {
  if (!id) return 'Someone';
  return s.seats.find((x) => x.id === id)?.name ?? 'Someone';
}

export function boardOf(s: CsState, id: PlayerId): CsPlayerBoard {
  const b = s.boards[id];
  if (!b) throw new Error(`unknown board ${id}`);
  return b;
}

export function isLive(s: CsState, id: PlayerId): boolean {
  return !s.eliminated.includes(id);
}

export function livePlayerIds(s: CsState): PlayerId[] {
  return s.seats.filter((st) => isLive(s, st.id)).map((st) => st.id);
}

export function combinedPool(s: CsState): CsResource[] {
  return [...s.bonusPool, ...s.dicePool];
}

/**
 * Try to pay `cost` from a resource array. Returns the remaining resources if affordable, or null.
 */
function tryConsumeResources(pool: readonly CsResource[], cost: CsResourceCost): CsResource[] | null {
  const rem = [...pool];
  const take = (pred: (r: CsResource) => boolean): boolean => {
    const idx = rem.findIndex(pred);
    if (idx < 0) return false;
    rem.splice(idx, 1);
    return true;
  };

  for (let i = 0; i < (cost.redGem ?? 0); i++) {
    if (!take((r) => r === 'redGem') && !take((r) => r === 'purpleGem')) return null;
  }
  for (let i = 0; i < (cost.blueGem ?? 0); i++) {
    if (!take((r) => r === 'blueGem') && !take((r) => r === 'purpleGem')) return null;
  }
  for (let i = 0; i < (cost.redOrb ?? 0); i++) {
    if (!take((r) => r === 'redOrb') && !take((r) => r === 'purpleOrb')) return null;
  }
  for (let i = 0; i < (cost.blueOrb ?? 0); i++) {
    if (!take((r) => r === 'blueOrb') && !take((r) => r === 'purpleOrb')) return null;
  }
  for (let i = 0; i < (cost.anyGem ?? 0); i++) {
    if (!take((r) => r === 'redGem' || r === 'blueGem' || r === 'purpleGem')) return null;
  }
  for (let i = 0; i < (cost.anyOrb ?? 0); i++) {
    if (!take((r) => r === 'redOrb' || r === 'blueOrb' || r === 'purpleOrb')) return null;
  }
  for (let i = 0; i < (cost.shadowFragment ?? 0); i++) {
    if (!take((r) => r === 'shadowFragment')) return null;
  }
  for (let i = 0; i < (cost.cursedCrystal ?? 0); i++) {
    if (!take((r) => r === 'cursedCrystal')) return null;
  }
  return rem;
}

export function canAffordCost(s: CsState, cost: CsResourceCost): boolean {
  return tryConsumeResources(combinedPool(s), cost) !== null;
}

function payCostFromState(s: CsState, cost: CsResourceCost) {
  const all = combinedPool(s);
  const after = tryConsumeResources(all, cost);
  if (!after) throw new Error('insufficient resources for cost');
  // Keep remaining items in dicePool
  s.bonusPool = [];
  s.dicePool = after;
}

export function canCollectCard(s: CsState, playerId: PlayerId, card: CsCard): boolean {
  if (!canAffordCost(s, card.collectionCost)) return false;
  const b = boardOf(s, playerId);
  if (card.level === 2) {
    return b.spellBook.some((c) => c.type === 'attackSpell' && c.level >= 1);
  }
  if (card.level === 3) {
    return b.spellBook.some((c) => c.type === 'attackSpell' && c.level >= 2);
  }
  return true;
}

function drawMainCard(s: CsState): CsCard | null {
  if (s.mainDeck.length === 0 && s.mainDiscard.length > 0) {
    s.mainDeck = shuffle(s.rngState, s.mainDiscard);
    s.mainDiscard = [];
  }
  return s.mainDeck.shift() ?? null;
}

function drawCounterspellCard(s: CsState): CsCard | null {
  if (s.counterspellDeck.length === 0 && s.counterspellDiscard.length > 0) {
    s.counterspellDeck = shuffle(s.rngState, s.counterspellDiscard);
    s.counterspellDiscard = [];
  }
  return s.counterspellDeck.shift() ?? null;
}

// ============================================================================
// Damage, Counterspells & Elimination
// ============================================================================

function checkElimination(s: CsState, targetId: PlayerId) {
  const b = boardOf(s, targetId);
  if (b.hp <= 0 && isLive(s, targetId)) {
    b.hp = 0;
    s.eliminated.push(targetId);
    pushLog(s, targetId, `💀 ${seatName(s, targetId)} has fallen!`, 'danger');
  }

  const live = livePlayerIds(s);
  if (live.length <= 1) {
    const winner = live[0] ?? s.seats[0]!.id;
    s.phase = 'gameOver';
    s.subPhase = 'gameOver';
    s.activePlayerId = null;
    s.winnerId = winner;
    s.finalScores = Object.fromEntries(
      s.seats.map((st) => [st.id, isLive(s, st.id) ? 100 + boardOf(s, st.id).hp : 0]),
    );
    pushLog(s, winner, `🏆 ${seatName(s, winner)} is the Ultimate Shadow Caster!`, 'good');
  }
}

function startAttackQueue(
  s: CsState,
  attackerId: PlayerId,
  targetIds: PlayerId[],
  baseDamage: number,
  unreducible: boolean,
) {
  const validTargets = targetIds.filter((id) => isLive(s, id) && id !== attackerId);
  if (validTargets.length === 0) return;

  const first = validTargets[0]!;
  const rest = validTargets.slice(1);
  beginSingleTargetAttack(s, attackerId, first, baseDamage, unreducible, rest);
}

function beginSingleTargetAttack(
  s: CsState,
  attackerId: PlayerId,
  targetId: PlayerId,
  baseDamage: number,
  unreducible: boolean,
  remainingTargetIds: PlayerId[],
) {
  const targetBoard = boardOf(s, targetId);
  let dmg = baseDamage;

  // Lightning Bug deals 0 DMG if target is in Shadow Form
  // Protective Panda reduces Attack Spell damage by 1 unless on Crystal Crypt or unreducible
  const onCrystalCrypt = targetBoard.hexId === 'crystal-crypt';
  if (!unreducible && !onCrystalCrypt && targetBoard.companion?.kind === 'protective-panda') {
    dmg = Math.max(0, dmg - 1);
  }

  const hasCounterspell = targetBoard.spellBook.some((c) => c.type === 'counterspell');
  if (dmg > 0 && hasCounterspell) {
    s.pendingAttack = {
      attackerId,
      targetId,
      damage: dmg,
      unreducible: unreducible || onCrystalCrypt,
      remainingTargetIds,
    };
    s.subPhase = 'awaitingCounterspell';
    s.activePlayerId = targetId;
    return;
  }

  applyResolvedDamage(s, attackerId, targetId, dmg, remainingTargetIds);
}

function applyResolvedDamage(
  s: CsState,
  attackerId: PlayerId,
  targetId: PlayerId,
  damage: number,
  remainingTargetIds: PlayerId[],
) {
  const targetBoard = boardOf(s, targetId);
  const attackerBoard = boardOf(s, attackerId);

  if (damage > 0) {
    targetBoard.hp = Math.max(0, targetBoard.hp - damage);
    pushLog(s, attackerId, `⚡ ${seatName(s, attackerId)} dealt ${damage} DMG to ${seatName(s, targetId)} (${targetBoard.hp} HP left)!`, 'danger');

    // Sharp Hedge companion: if attacker is on same Hex, deal 1 DMG back
    if (targetBoard.companion?.kind === 'sharp-hedge' && targetBoard.hexId === attackerBoard.hexId) {
      attackerBoard.hp = Math.max(0, attackerBoard.hp - 1);
      pushLog(s, targetId, `Sharp Hedge dealt 1 thorns DMG back to ${seatName(s, attackerId)}!`, 'normal');
      checkElimination(s, attackerId);
    }

    checkElimination(s, targetId);
    if (s.phase === 'gameOver') return;
  }

  if (remainingTargetIds.length > 0 && s.pendingAttack) {
    const next = remainingTargetIds[0]!;
    const rest = remainingTargetIds.slice(1);
    const dmg = s.pendingAttack.damage;
    const unred = s.pendingAttack.unreducible;
    s.pendingAttack = null;
    beginSingleTargetAttack(s, attackerId, next, dmg, unred, rest);
    return;
  }

  s.pendingAttack = null;
  s.subPhase = 'awaitingAction';
  s.activePlayerId = s.turnPlayerId;
}

// ============================================================================
// Action Handlers
// ============================================================================

function handleRollResourceDice(s: CsState, a: Extract<CsAction, { type: 'rollResourceDice' }>) {
  if (s.subPhase !== 'awaitingRoll') throw new Error('already rolled this turn');
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');
  if (a.dice.length !== 5) throw new Error('must roll all 5 Resource dice');

  const b = boardOf(s, a.playerId);
  const hex = s.hexes[b.hexId];

  s.dicePool = [...a.dice];
  s.bonusPool = [];

  if (hex.startTurnResource) {
    s.bonusPool.push(hex.startTurnResource);
  }
  for (const card of b.spellBook) {
    if (card.type === 'resource' && card.grantsResource) {
      s.bonusPool.push(card.grantsResource);
    }
  }
  if (b.companion?.kind === 'hydrattle-snake') {
    s.bonusPool.push('purpleGem');
  } else if (b.companion?.kind === 'speed-mouster') {
    s.bonusPool.push('purpleOrb');
  } else if (b.companion?.kind === 'swamp-monster') {
    const cap = b.form === 'shadow' ? 5 : 3;
    b.shadowEnergy = Math.min(cap, b.shadowEnergy + 1);
  }

  s.actionPointsRemaining = b.hexId === 'ancient-rune' ? 5 : 4;
  b.usedSpellIdsThisTurn = [];
  b.usedShadowAbilityThisTurn = false;
  s.subPhase = 'awaitingAction';
  s.activePlayerId = a.playerId;

  pushLog(s, a.playerId, `${seatName(s, a.playerId)} rolled Resource Dice (${s.actionPointsRemaining} AP).`, 'normal');
}

function requireActionPhase(s: CsState, playerId: PlayerId, apCost: number) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot act during ${s.subPhase}`);
  if (playerId !== s.turnPlayerId) throw new Error('not your turn');
  if (s.actionPointsRemaining < apCost) throw new Error('not enough Action Points');
}

function handleTravel(s: CsState, a: Extract<CsAction, { type: 'travel' }>) {
  requireActionPhase(s, a.playerId, 1);
  const b = boardOf(s, a.playerId);
  const fromHex = s.hexes[b.hexId];
  const toHex = s.hexes[a.toHexId];
  if (!toHex || !areHexesAdjacent(fromHex, toHex)) {
    throw new Error('destination Hex is not adjacent');
  }

  s.actionPointsRemaining -= 1;
  b.hexId = a.toHexId;
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} traveled to ${toHex.name}.`, 'normal');
}

function handleRerollDice(s: CsState, a: Extract<CsAction, { type: 'rerollDice' }>) {
  requireActionPhase(s, a.playerId, 1);
  if (a.diceIndices.length === 0 || a.diceIndices.length !== a.newValues.length) {
    throw new Error('invalid reroll indices');
  }
  for (const idx of a.diceIndices) {
    if (idx < 0 || idx >= s.dicePool.length) throw new Error('die index out of range');
    if (s.dicePool[idx] === 'cursedCrystal') {
      throw new Error('cannot reroll Cursed Crystals');
    }
  }

  s.actionPointsRemaining -= 1;
  a.diceIndices.forEach((dieIdx, i) => {
    s.dicePool[dieIdx] = a.newValues[i]!;
  });
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} rerolled ${a.diceIndices.length} Resource die/dice.`, 'normal');
}

function handleProtect(s: CsState, a: Extract<CsAction, { type: 'protect' }>) {
  requireActionPhase(s, a.playerId, 1);
  const idx = s.dicePool.findIndex((r) => r === 'cursedCrystal');
  const bIdx = s.bonusPool.findIndex((r) => r === 'cursedCrystal');
  if (idx < 0 && bIdx < 0) throw new Error('no Cursed Crystal in Resource Pool');

  s.actionPointsRemaining -= 1;
  if (idx >= 0) s.dicePool.splice(idx, 1);
  else s.bonusPool.splice(bIdx, 1);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} used Protect to remove 1 Cursed Crystal.`, 'good');

  const b = boardOf(s, a.playerId);
  if (b.companion?.kind === 'occult-octo' && a.targetHexId) {
    const curHex = s.hexes[b.hexId];
    const tHex = s.hexes[a.targetHexId];
    if (tHex && areHexesAdjacent(curHex, tHex)) {
      const enemies = livePlayerIds(s).filter((id) => id !== a.playerId && boardOf(s, id).hexId === a.targetHexId);
      startAttackQueue(s, a.playerId, enemies, 1, false);
    }
  }
}

function handleRefreshHexCard(s: CsState, a: Extract<CsAction, { type: 'refreshHexCard' }>) {
  requireActionPhase(s, a.playerId, 1);
  const b = boardOf(s, a.playerId);
  const hex = s.hexes[b.hexId];
  if (!hex.hasMainDeckSlot) {
    throw new Error('cannot Refresh on Ancient Rune or Dusty Desert');
  }

  s.actionPointsRemaining -= 1;
  if (hex.faceUpCard) s.mainDiscard.push(hex.faceUpCard);
  hex.faceUpCard = drawMainCard(s);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} refreshed the card at ${hex.name}.`, 'normal');
}

function handleCollectCard(s: CsState, a: Extract<CsAction, { type: 'collectCard' }>) {
  requireActionPhase(s, a.playerId, 1);
  const b = boardOf(s, a.playerId);
  const hex = s.hexes[b.hexId];

  let card: CsCard | null = null;
  if (a.fromCounterspellDeck || b.hexId === 'dusty-desert') {
    if (b.hexId !== 'dusty-desert') throw new Error('must be on Dusty Desert to collect a Counterspell');
    const cost: CsResourceCost = { anyGem: 1, anyOrb: 1 };
    if (!canAffordCost(s, cost)) throw new Error('cannot afford Counterspell (1 Gem + 1 Orb)');
    card = drawCounterspellCard(s);
    if (!card) throw new Error('Counterspell deck is empty');
    payCostFromState(s, cost);
  } else {
    card = hex.faceUpCard;
    if (!card) throw new Error('no face-up card on this Hex tile');
    if (!canCollectCard(s, a.playerId, card)) {
      throw new Error(`cannot collect ${card.name}`);
    }
    payCostFromState(s, card.collectionCost);
    hex.faceUpCard = drawMainCard(s);
  }

  s.actionPointsRemaining -= 1;

  // Handle Spell Book replacement if upgrading a Level 2/3 spell or if Spell Book is at 5 cards
  if (card.level >= 2 || b.spellBook.length >= SPELLBOOK_LIMIT) {
    const reqLevel = card.level === 3 ? 2 : card.level === 2 ? 1 : 1;
    const idx =
      a.replaceSpellId !== undefined
        ? b.spellBook.findIndex((c) => c.id === a.replaceSpellId && c.level >= reqLevel)
        : b.spellBook.findIndex((c) => c.level >= reqLevel);
    if (idx >= 0) {
      const [old] = b.spellBook.splice(idx, 1);
      if (old) {
        if (old.type === 'counterspell') s.counterspellDiscard.push(old);
        else s.mainDiscard.push(old);
      }
    } else if (b.spellBook.length >= SPELLBOOK_LIMIT) {
      const [old] = b.spellBook.splice(0, 1);
      if (old) s.mainDiscard.push(old);
    }
  }

  b.spellBook.push(card);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} collected ${card.name}!`, 'good');
}

function handleCastSpell(s: CsState, a: Extract<CsAction, { type: 'castSpell' }>) {
  requireActionPhase(s, a.playerId, 1);
  const b = boardOf(s, a.playerId);
  const spell = b.spellBook.find((c) => c.id === a.spellId);
  if (!spell) throw new Error('spell not in Spell Book');
  if (b.usedSpellIdsThisTurn.includes(spell.id)) {
    throw new Error('each Spell can only be cast once per turn');
  }

  const tiers = spell.castTiers ?? [];
  const tier = tiers[a.tierIndex ?? 0];
  if (!tier) throw new Error('spell cannot be cast');
  if (!canAffordCost(s, tier.cost)) throw new Error('cannot afford spell cast cost');

  payCostFromState(s, tier.cost);
  s.actionPointsRemaining -= 1;
  b.usedSpellIdsThisTurn.push(spell.id);

  if (tier.heal) {
    b.hp = Math.min(b.maxHp, b.hp + tier.heal);
  }
  if (tier.produce) {
    s.bonusPool.push(...tier.produce);
  }

  if (spell.type === 'conversionSpell') {
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} cast Conversion Spell ${spell.name}.`, 'good');
    return;
  }

  // Attack Spell!
  const range = spell.range ?? 'sameOrAdjacent';
  const stagBonus = b.companion?.kind === 'charging-stag' ? 1 : 0;
  let dmg = tier.damage + stagBonus;

  if (spell.targetsAllOnHex) {
    const targetHexId = a.targetHexId ?? b.hexId;
    if (!isHexInSpellRange(s.hexes, b.hexId, targetHexId, range)) {
      throw new Error('target Hex is out of range');
    }
    const targets = livePlayerIds(s).filter((id) => id !== a.playerId && boardOf(s, id).hexId === targetHexId);
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} cast ${spell.name} on ${s.hexes[targetHexId].name}!`, 'danger');
    startAttackQueue(s, a.playerId, targets, dmg, false);
    return;
  }

  const targetId = a.targetPlayerId;
  if (!targetId || targetId === a.playerId || !isLive(s, targetId)) {
    throw new Error('must choose a valid enemy target');
  }
  const targetBoard = boardOf(s, targetId);
  if (!isHexInSpellRange(s.hexes, b.hexId, targetBoard.hexId, range)) {
    throw new Error('target enemy is out of spell range');
  }
  if (spell.kind === 'lightning-bug' && targetBoard.form === 'shadow') {
    dmg = 0;
  }

  pushLog(s, a.playerId, `${seatName(s, a.playerId)} cast ${spell.name} on ${seatName(s, targetId)}!`, 'danger');
  startAttackQueue(s, a.playerId, [targetId], dmg, false);
}

function handleUseShadowAbility(s: CsState, a: Extract<CsAction, { type: 'useShadowAbility' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error('must be in Action phase');
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');
  const b = boardOf(s, a.playerId);
  if (b.form !== 'shadow') throw new Error('must be in Shadow Form');
  if (b.usedShadowAbilityThisTurn) throw new Error('already used Shadow Ability this turn');

  const charDef = CS_CHARACTERS.find((c) => c.id === b.characterId)!;
  if (b.shadowEnergy < charDef.shadowAbilityCost) {
    throw new Error(`need ${charDef.shadowAbilityCost} Shadow Energy`);
  }

  b.shadowEnergy -= charDef.shadowAbilityCost;
  b.usedShadowAbilityThisTurn = true;

  if (b.characterId === 'kit') {
    const enemies = livePlayerIds(s).filter((id) => id !== a.playerId);
    pushLog(s, a.playerId, `🌑 Kit the Turbulent unleashed Shadow Ability (1 DMG to all enemies)!`, 'danger');
    startAttackQueue(s, a.playerId, enemies, 1, true);
  } else if (b.characterId === 'frill') {
    b.hp = Math.min(b.maxHp, b.hp + 2);
    const targetId =
      a.targetPlayerId ??
      livePlayerIds(s).find(
        (id) =>
          id !== a.playerId &&
          isHexInSpellRange(s.hexes, b.hexId, boardOf(s, id).hexId, 'sameOrAdjacent'),
      );
    pushLog(s, a.playerId, `🌑 Frill the Regenerator healed 2 HP and struck an enemy!`, 'good');
    if (targetId) startAttackQueue(s, a.playerId, [targetId], 1, false);
  } else if (b.characterId === 'nuzzle') {
    const targetId =
      a.targetPlayerId ??
      livePlayerIds(s).find((id) => id !== a.playerId && boardOf(s, id).hexId === b.hexId);
    pushLog(s, a.playerId, `🌑 Nuzzle the Savage struck for 2 DMG!`, 'danger');
    if (targetId) startAttackQueue(s, a.playerId, [targetId], 2, false);
  } else if (b.characterId === 'haze') {
    const targetHexId =
      a.targetHexId ??
      (Object.keys(s.hexes) as CsHexId[]).find((hId) =>
        areHexesAdjacent(s.hexes[b.hexId], s.hexes[hId]),
      )!;
    const enemies = livePlayerIds(s).filter((id) => id !== a.playerId && boardOf(s, id).hexId === targetHexId);
    pushLog(s, a.playerId, `🌑 Haze the Devastator blasted ${s.hexes[targetHexId].name} for 3 DMG!`, 'danger');
    startAttackQueue(s, a.playerId, enemies, 3, false);
  }
}

function handleTransformAndEndTurn(s: CsState, a: Extract<CsAction, { type: 'transformAndEndTurn' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot end turn during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');

  const b = boardOf(s, a.playerId);
  const all = combinedPool(s);
  const fragments = all.filter((r) => r === 'shadowFragment').length;
  const cap = b.form === 'shadow' ? 5 : 3;
  b.shadowEnergy = Math.min(cap, b.shadowEnergy + fragments);

  // Check if transforming into Shadow Form
  if (b.form === 'light' && b.shadowEnergy >= 3 && (a.transform ?? true)) {
    b.form = 'shadow';
    b.shadowEnergy = 0;
    pushLog(s, a.playerId, `🌑 ${seatName(s, a.playerId)} transformed into SHADOW FORM!`, 'good');
    if (s.companionPortal.length > 0 && !b.companion) {
      s.subPhase = 'awaitingCompanionPick';
      s.activePlayerId = a.playerId;
      return;
    }
  }

  finishEndOfTurnCleanup(s);
}

function handlePickCompanion(s: CsState, a: Extract<CsAction, { type: 'pickCompanion' }>) {
  if (s.subPhase !== 'awaitingCompanionPick') throw new Error('not picking a Companion');
  if (a.playerId !== s.turnPlayerId) throw new Error('not your Companion pick');

  const idx = s.companionPortal.findIndex((c) => c.id === a.companionId);
  if (idx < 0) throw new Error('Companion not in Companion Portal');
  const [comp] = s.companionPortal.splice(idx, 1);
  const replacement = s.companionDeck.shift();
  if (replacement) s.companionPortal.push(replacement);

  const b = boardOf(s, a.playerId);
  b.companion = comp!;
  pushLog(s, a.playerId, `🐾 ${seatName(s, a.playerId)} summoned Companion: ${comp!.name}!`, 'good');

  finishEndOfTurnCleanup(s);
}

function finishEndOfTurnCleanup(s: CsState) {
  const playerId = s.turnPlayerId;
  const b = boardOf(s, playerId);
  const all = combinedPool(s);

  // 1. Cursed Crystal damage (unless Cursemaster Raccoon companion)
  const curses = all.filter((r) => r === 'cursedCrystal').length;
  if (curses > 0 && b.companion?.kind !== 'cursemaster-raccoon') {
    b.hp = Math.max(0, b.hp - curses);
    pushLog(s, playerId, `💎 ${seatName(s, playerId)} took ${curses} DMG from unremoved Cursed Crystal(s) (${b.hp} HP left).`, 'danger');
    checkElimination(s, playerId);
    if (s.phase === 'gameOver') return;
  }

  // 2. End-of-turn Companion effects
  if (isLive(s, playerId)) {
    if (b.companion?.kind === 'recovery-raven') {
      b.hp = Math.min(b.maxHp, b.hp + 1);
    }
    if (b.companion?.kind === 'crushing-tortoise') {
      const sameHexEnemies = livePlayerIds(s).filter((id) => id !== playerId && boardOf(s, id).hexId === b.hexId);
      for (const enemyId of sameHexEnemies) {
        const eb = boardOf(s, enemyId);
        eb.hp = Math.max(0, eb.hp - 1);
        checkElimination(s, enemyId);
        if (s.phase === 'gameOver') return;
      }
    }
  }

  s.dicePool = [];
  s.bonusPool = [];

  // Advance to next living player
  const n = s.seats.length;
  const start = s.seats.findIndex((st) => st.id === playerId);
  for (let step = 1; step <= n; step++) {
    const nextSeat = s.seats[(start + step) % n]!;
    if (isLive(s, nextSeat.id)) {
      s.turnPlayerId = nextSeat.id;
      s.activePlayerId = nextSeat.id;
      s.subPhase = 'awaitingRoll';
      return;
    }
  }
}

function handleRespondCounterspell(s: CsState, a: Extract<CsAction, { type: 'respondCounterspell' }>) {
  if (s.subPhase !== 'awaitingCounterspell') throw new Error('no pending attack');
  const atk = s.pendingAttack;
  if (!atk || atk.targetId !== a.playerId) throw new Error('not the attack target');

  const targetBoard = boardOf(s, a.playerId);
  let dmg = atk.damage;

  if (a.counterspellId !== undefined) {
    const idx = targetBoard.spellBook.findIndex(
      (c) => c.id === a.counterspellId && c.type === 'counterspell',
    );
    if (idx < 0) throw new Error('Counterspell not in Spell Book');
    const [cs] = targetBoard.spellBook.splice(idx, 1);
    if (cs) {
      s.counterspellDiscard.push(cs);
      if (cs.kind === 'pointed-shield') {
        if (!atk.unreducible) dmg = Math.max(0, dmg - 2);
        pushLog(s, a.playerId, `🛡️ ${seatName(s, a.playerId)} revealed Pointed Shield!`, 'good');
      } else if (cs.kind === 'safety-dome') {
        if (!atk.unreducible) dmg = 0;
        pushLog(s, a.playerId, `🛡️ ${seatName(s, a.playerId)} revealed Safety Dome (0 DMG)!`, 'good');
      } else if (cs.kind === 'run-away') {
        if (!atk.unreducible) dmg = Math.max(0, dmg - 1);
        const curHex = s.hexes[targetBoard.hexId];
        const destHexId =
          a.escapeHexId && areHexesAdjacent(curHex, s.hexes[a.escapeHexId])
            ? a.escapeHexId
            : (Object.keys(s.hexes) as CsHexId[]).find((hId) =>
                areHexesAdjacent(curHex, s.hexes[hId]),
              );
        if (destHexId) targetBoard.hexId = destHexId;
        pushLog(s, a.playerId, `🏃 ${seatName(s, a.playerId)} revealed Run Away!`, 'good');
      } else if (cs.kind === 'bees-everywhere') {
        const attackerBoard = boardOf(s, atk.attackerId);
        attackerBoard.hp = Math.max(0, attackerBoard.hp - 2);
        pushLog(s, a.playerId, `🐝 ${seatName(s, a.playerId)} revealed Bees Everywhere (2 DMG back to ${seatName(s, atk.attackerId)})!`, 'good');
        checkElimination(s, atk.attackerId);
        if (s.phase === 'gameOver') return;
      }
    }
  }

  applyResolvedDamage(s, atk.attackerId, atk.targetId, dmg, atk.remainingTargetIds);
}

// ============================================================================
// Entry point
// ============================================================================

export function applyAction(state: CsState, action: CsAction): CsState {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  const s = clone(state);

  switch (action.type) {
    case 'rollResourceDice':
      handleRollResourceDice(s, action);
      break;
    case 'travel':
      handleTravel(s, action);
      break;
    case 'rerollDice':
      handleRerollDice(s, action);
      break;
    case 'protect':
      handleProtect(s, action);
      break;
    case 'refreshHexCard':
      handleRefreshHexCard(s, action);
      break;
    case 'collectCard':
      handleCollectCard(s, action);
      break;
    case 'castSpell':
      handleCastSpell(s, action);
      break;
    case 'useShadowAbility':
      handleUseShadowAbility(s, action);
      break;
    case 'transformAndEndTurn':
      handleTransformAndEndTurn(s, action);
      break;
    case 'pickCompanion':
      handlePickCompanion(s, action);
      break;
    case 'respondCounterspell':
      handleRespondCounterspell(s, action);
      break;
    default: {
      const never: never = action;
      throw new Error(`unknown action ${JSON.stringify(never)}`);
    }
  }

  return s;
}
