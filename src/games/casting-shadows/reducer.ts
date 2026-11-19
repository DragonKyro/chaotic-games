// Casting Shadows — pure deterministic reducer for the Base Game + The Ice Storm + The Molten Rock.
//
// Rules sources, and what is / isn't confirmed: see the header of types.ts.

import { createRng, shuffle } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import { buildCsDecks, buildMap, characterDef, hexDistance, isHexInSpellRange, pickCharacters } from './cards';
import type {
  CsAction,
  CsAttackSpecState,
  CsCard,
  CsConfig,
  CsExpansionId,
  CsHexId,
  CsPlayerBoard,
  CsResource,
  CsResourceCost,
  CsState,
} from './types';
import { cloneState, isLive, livePlayerIds, pushLog, seatName } from '@/core/state';

export const SPELLBOOK_LIMIT = 5;
const START_HP = 18;
/** Shadow Energy limits (rulebook p.11): Base Form 3, Shadow Form 5. */
const BASE_ENERGY_LIMIT = 3;
export const SHADOW_ENERGY_LIMIT = 5;
const TRANSFORM_COST = 3;
const AP_PER_TURN = 4;
/** Collecting a Counterspell at Dusty Desert: 1 Gem + 1 Orb of any colour. */
export const COUNTERSPELL_COST: CsResourceCost = { anyGem: 1, anyOrb: 1 };

export interface AttackEffects {
  inflictStun?: boolean;
  inflictFreeze?: boolean;
  inflictBurn?: boolean;
}

// ============================================================================
// Setup
// ============================================================================

export function createInitialState(config: CsConfig, seed: number, seats: Seat[]): CsState {
  const rngState = createRng(seed);
  const first = seats[0];
  if (!first) throw new Error('Casting Shadows needs at least one seat');

  // An expansion character brings its expansion's components; 5–6 players need an expansion's map.
  const expansions: CsExpansionId[] = [...config.expansions];
  const characters = pickCharacters(seats, config.characterByPlayer, expansions);
  for (const ch of characters) {
    if (ch.expansion && !expansions.includes(ch.expansion)) expansions.push(ch.expansion);
  }
  if (seats.length > 4 && expansions.length === 0) expansions.push('ice-storm');

  const { mainDeck, counterspellDeck, companionDeck } = buildCsDecks(rngState, expansions);
  const companionPortal = companionDeck.splice(0, 3);

  const hexes = buildMap(
    characters.map((c) => c.homeHex),
    expansions,
  );
  for (const h of Object.values(hexes)) {
    if (h.hasMainDeckSlot) h.faceUpCard = mainDeck.shift() ?? null;
  }

  const boards: Record<PlayerId, CsPlayerBoard> = {};
  seats.forEach((seat, idx) => {
    const ch = characters[idx]!;
    boards[seat.id] = {
      characterId: ch.id,
      form: 'light',
      hexId: ch.homeHex,
      hp: START_HP,
      maxHp: START_HP,
      shadowEnergy: 0,
      spellBook: [],
      usedSpellIdsThisTurn: [],
      companion: null,
      usedShadowAbilityThisTurn: false,
      stunned: false,
      frozen: false,
      fortified: 0,
      burning: false,
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
    companionDeck,
    companionPortal,

    turnPlayerId: first.id,
    actionPointsRemaining: 0,
    dicePool: [],
    diceSlots: [],
    bonusPool: [],
    turnStartStatus: { frozen: false, stunned: false },

    pendingAttack: null,
    pendingOffer: null,
    pendingStunSteal: null,
    winnerId: null,

    log: [],
    logSeq: 0,
    config: { ...config, expansions },
  };

  pushLog(state, null, `${seats.length} Shadow Casters enter the arena (18 HP each). Last player standing wins!`, 'normal');
  return state;
}

// ============================================================================
// Derived helpers (shared with the UI and the AI)
// ============================================================================

export function boardOf(s: CsState, id: PlayerId): CsPlayerBoard {
  const b = s.boards[id];
  if (!b) throw new Error(`unknown board ${id}`);
  return b;
}

/** The turn player's Resource Pool: bonus tokens first, then the dice. */
export function combinedPool(s: CsState): CsResource[] {
  return [...s.bonusPool, ...s.dicePool];
}

export function energyLimit(b: CsPlayerBoard): number {
  return b.form === 'shadow' ? SHADOW_ENERGY_LIMIT : BASE_ENERGY_LIMIT;
}

export function getShadowAbilityCost(b: CsPlayerBoard): number {
  const base = characterDef(b.characterId).shadowAbilityCost;
  // Lil' Shadow (reconstructed Ice Storm companion).
  return b.companion?.kind === 'lil-shadow' ? Math.max(1, base - 1) : base;
}

/** Shadow Form and fully charged (rulebook p.12: "you must fully charge your Shadow Energy before each use"). */
export function canUseShadowAbility(s: CsState, playerId: PlayerId): boolean {
  const b = boardOf(s, playerId);
  return (
    s.subPhase === 'awaitingAction' &&
    s.turnPlayerId === playerId &&
    b.form === 'shadow' &&
    !b.usedShadowAbilityThisTurn &&
    b.shadowEnergy >= SHADOW_ENERGY_LIMIT &&
    b.shadowEnergy >= getShadowAbilityCost(b)
  );
}

/** Action points a turn starts with (Hydrattle Snake: 5). */
function actionPointsFor(b: CsPlayerBoard): number {
  return b.companion?.kind === 'hydrattle-snake' ? AP_PER_TURN + 1 : AP_PER_TURN;
}

/** Living players other than `from`, in turn order starting with the next one (Counterspells resolve in this order). */
export function enemiesInTurnOrder(s: CsState, from: PlayerId): PlayerId[] {
  const n = s.seats.length;
  const start = s.seats.findIndex((x) => x.id === from);
  const out: PlayerId[] = [];
  for (let k = 1; k <= n; k++) {
    const id = s.seats[(start + k) % n]!.id;
    if (id !== from && isLive(s, id)) out.push(id);
  }
  return out;
}

const hexIdsOf = (s: CsState) => Object.keys(s.hexes) as CsHexId[];

export function adjacentHexIds(s: CsState, hexId: CsHexId): CsHexId[] {
  const here = s.hexes[hexId];
  return hexIdsOf(s).filter((h) => hexDistance(here, s.hexes[h]) === 1);
}

/** Hexes a Travel action can reach (Speed Mouster: "you may Travel twice instead of once"). */
export function travelDestinations(s: CsState, playerId: PlayerId): CsHexId[] {
  const b = boardOf(s, playerId);
  if (b.frozen) return [];
  const one = adjacentHexIds(s, b.hexId);
  if (b.companion?.kind !== 'speed-mouster') return one;
  const reach = new Set(one);
  for (const h of one) for (const n of adjacentHexIds(s, h)) if (n !== b.hexId) reach.add(n);
  return [...reach];
}

/**
 * Which entries of `pool` would pay `cost` (indices), or null if it can't be paid.
 * Purple Gems / Orbs stand in for Red or Blue ("you may use that Resource as Red OR
 * Blue"); gray costs take any colour. `exact` (same-colour Conversion Spells) turns
 * the purple stand-in off for coloured costs.
 */
export function spendIndices(pool: readonly CsResource[], cost: CsResourceCost, exact = false): number[] | null {
  const used = new Set<number>();
  const take = (ok: (r: CsResource) => boolean): boolean => {
    for (let i = 0; i < pool.length; i++) {
      if (!used.has(i) && ok(pool[i]!)) {
        used.add(i);
        return true;
      }
    }
    return false;
  };
  const coloured = (want: CsResource, wild: CsResource) => take((r) => r === want) || (!exact && take((r) => r === wild));
  const steps: [number | undefined, () => boolean][] = [
    [cost.redGem, () => coloured('redGem', 'purpleGem')],
    [cost.blueGem, () => coloured('blueGem', 'purpleGem')],
    [cost.redOrb, () => coloured('redOrb', 'purpleOrb')],
    [cost.blueOrb, () => coloured('blueOrb', 'purpleOrb')],
    [cost.purpleGem, () => take((r) => r === 'purpleGem')],
    [cost.purpleOrb, () => take((r) => r === 'purpleOrb')],
    [cost.anyGem, () => take((r) => r === 'redGem' || r === 'blueGem') || take((r) => r === 'purpleGem')],
    [cost.anyOrb, () => take((r) => r === 'redOrb' || r === 'blueOrb') || take((r) => r === 'purpleOrb')],
    [cost.shadowFragment, () => take((r) => r === 'shadowFragment')],
    [cost.cursedCrystal, () => take((r) => r === 'cursedCrystal')],
  ];
  for (const [n, pay] of steps) {
    for (let k = 0; k < (n ?? 0); k++) if (!pay()) return null;
  }
  return [...used];
}

export function canAffordCost(s: CsState, cost: CsResourceCost, exact = false): boolean {
  return spendIndices(combinedPool(s), cost, exact) !== null;
}

/** Pay from the Resource Pool (bonus tokens are spent before dice of the same kind). */
function payCostFromState(s: CsState, cost: CsResourceCost, exact = false) {
  const used = spendIndices(combinedPool(s), cost, exact);
  if (!used) throw new Error('insufficient resources for cost');
  const nb = s.bonusPool.length;
  const gone = new Set(used);
  s.bonusPool = s.bonusPool.filter((_, i) => !gone.has(i));
  const keepDie = s.dicePool.map((_, i) => !gone.has(nb + i));
  s.diceSlots = s.diceSlots.filter((_, i) => keepDie[i]);
  s.dicePool = s.dicePool.filter((_, i) => keepDie[i]);
}

/**
 * What collecting `card` (null = a Counterspell) asks you to give up from your Spell
 * Book, or null when nothing:
 *  - a Spell requirement (gray Spell symbol): any Attack or Conversion Spell of that level;
 *  - otherwise, with a full book (5 cards): any Spell or Resource card — never a Counterspell.
 * An empty array means it can't be collected (nothing legal to give up).
 */
export function roomNeededFor(s: CsState, playerId: PlayerId, card: CsCard | null): CsCard[] | null {
  const b = boardOf(s, playerId);
  if (card?.requiresSpellLevel) {
    const lvl = card.requiresSpellLevel;
    return b.spellBook.filter((c) => (c.type === 'attackSpell' || c.type === 'conversionSpell') && c.level === lvl);
  }
  if (b.spellBook.length < SPELLBOOK_LIMIT) return null;
  return b.spellBook.filter((c) => c.type !== 'counterspell');
}

export function canCollectCard(s: CsState, playerId: PlayerId, card: CsCard): boolean {
  if (boardOf(s, playerId).hexId === 'ancient-rune') return false;
  if (!canAffordCost(s, card.collectionCost)) return false;
  const room = roomNeededFor(s, playerId, card);
  return room === null || room.length > 0;
}

export function canCollectCounterspell(s: CsState, playerId: PlayerId): boolean {
  const room = roomNeededFor(s, playerId, null);
  return (
    boardOf(s, playerId).hexId === 'dusty-desert' &&
    s.counterspellDeck.length > 0 &&
    canAffordCost(s, COUNTERSPELL_COST) &&
    (room === null || room.length > 0)
  );
}

/** Where an Attack Spell could land from where you stand: enemies for a single-target spell, hexes for a hex-wide one. */
export function spellTargetOptions(
  s: CsState,
  playerId: PlayerId,
  spell: CsCard,
): { players: PlayerId[]; hexes: CsHexId[] } {
  if (spell.type !== 'attackSpell') return { players: [], hexes: [] };
  const range = spell.range ?? 'sameOrAdjacent';
  const here = boardOf(s, playerId).hexId;
  if (spell.targetsAllOnHex) {
    return { players: [], hexes: hexIdsOf(s).filter((h) => isHexInSpellRange(s.hexes, here, h, range)) };
  }
  return {
    players: enemiesInTurnOrder(s, playerId).filter((id) => isHexInSpellRange(s.hexes, here, boardOf(s, id).hexId, range)),
    hexes: [],
  };
}

export type CsProtectTarget = 'cursedCrystal' | 'burning';

/** What a Protect could clear for the turn player right now. */
export function protectOptions(s: CsState, playerId: PlayerId): CsProtectTarget[] {
  const b = boardOf(s, playerId);
  const out: CsProtectTarget[] = [];
  if (combinedPool(s).includes('cursedCrystal')) out.push('cursedCrystal');
  if (b.burning) out.push('burning');
  return out;
}

export type CsAbilityTargets =
  | { kind: 'none'; hits: boolean }
  | { kind: 'player'; options: PlayerId[] }
  | { kind: 'hex'; options: CsHexId[] }
  | { kind: 'amount'; max: number; hits: boolean };

/** Who / where the turn player's Shadow Ability could be aimed right now. */
export function shadowAbilityTargets(s: CsState, playerId: PlayerId): CsAbilityTargets {
  const b = boardOf(s, playerId);
  const aim = characterDef(b.characterId).aim;
  const enemies = enemiesInTurnOrder(s, playerId);
  switch (aim.kind) {
    case 'none':
      return { kind: 'none', hits: enemies.some((e) => aimNoneHits(s, playerId, e)) };
    case 'player':
      return { kind: 'player', options: enemies.filter((e) => isHexInSpellRange(s.hexes, b.hexId, boardOf(s, e).hexId, aim.range)) };
    case 'hex':
      return { kind: 'hex', options: hexIdsOf(s).filter((h) => isHexInSpellRange(s.hexes, b.hexId, h, aim.range)) };
    case 'amount':
      // Nuzzle can't give up his last HP (he'd be eliminated before the blow lands).
      return { kind: 'amount', max: Math.max(0, Math.min(aim.max, b.hp - 1)), hits: enemies.length > 0 };
  }
}

/** For untargeted abilities: would this enemy be caught? (Kit: everyone; Talon: your own hex.) */
function aimNoneHits(s: CsState, me: PlayerId, enemy: PlayerId): boolean {
  if (boardOf(s, me).characterId === 'talon') return boardOf(s, enemy).hexId === boardOf(s, me).hexId;
  return true;
}

function drawMainCard(s: CsState): CsCard | null {
  // Not in the rules: reshuffle the discard pile when the Main deck runs dry.
  if (s.mainDeck.length === 0 && s.mainDiscard.length > 0) {
    s.mainDeck = shuffle(s.rngState, s.mainDiscard);
    s.mainDiscard = [];
  }
  return s.mainDeck.shift() ?? null;
}

/** Discard a book card: Counterspells go to the bottom of their deck, everything else to the discard pile. */
function discardBookCard(s: CsState, card: CsCard) {
  if (card.type === 'counterspell') s.counterspellDeck.push(card);
  else if (card.type !== 'companion') s.mainDiscard.push(card);
}

// ============================================================================
// Damage, Counterspells & Elimination
// ============================================================================

function checkElimination(s: CsState, targetId: PlayerId) {
  const b = boardOf(s, targetId);
  if (b.hp <= 0 && isLive(s, targetId)) {
    b.hp = 0;
    s.eliminated.push(targetId);
    // Rulebook p.11: "move all the cards in your Spell Book to the discard pile".
    for (const c of b.spellBook) discardBookCard(s, c);
    b.spellBook = [];
    b.frozen = false;
    b.stunned = false;
    b.burning = false;
    pushLog(s, targetId, `💀 ${seatName(s, targetId)} has fallen!`, 'danger');
  }

  const live = livePlayerIds(s);
  if (live.length <= 1 && s.phase !== 'gameOver') {
    const winner = live[0] ?? s.eliminated[s.eliminated.length - 1] ?? s.seats[0]!.id;
    s.phase = 'gameOver';
    s.subPhase = 'gameOver';
    s.activePlayerId = null;
    s.winnerId = winner;
    s.pendingAttack = null;
    s.pendingOffer = null;
    s.pendingStunSteal = null;
    // Score = how many players you outlasted (the last-one-standing convention, as in
    // Exploding Kittens): the end screen then ranks the fallen in the order they fell.
    s.finalScores = Object.fromEntries(
      s.seats.map((st) => {
        const place = s.eliminated.indexOf(st.id);
        return [st.id, place < 0 ? s.seats.length - 1 : place];
      }),
    );
    pushLog(s, winner, `🏆 ${seatName(s, winner)} is the Ultimate Shadow Caster!`, 'good');
  }
}

/** Direct HP loss (no reductions, no Counterspells): Cursed Crystals, Burn, thorns, reflected DMG. */
function loseHp(s: CsState, id: PlayerId, n: number) {
  if (n <= 0 || !isLive(s, id)) return;
  const b = boardOf(s, id);
  b.hp = Math.max(0, b.hp - n);
  checkElimination(s, id);
}

function gainHp(b: CsPlayerBoard, n: number) {
  b.hp = Math.min(b.maxHp, b.hp + n);
}

function specEffects(spec: CsAttackSpecState): AttackEffects {
  return { inflictStun: spec.inflictStun, inflictFreeze: spec.inflictFreeze, inflictBurn: spec.inflictBurn };
}

/**
 * Could any Counterspell in this game answer this kind of DMG? Depends only on which
 * decks are in play (public), so opening the window leaks nothing about the cards.
 */
function counterWindowPossible(s: CsState, fromAttackSpell: boolean): boolean {
  if (fromAttackSpell) return true;
  // The reconstructed expansion Counterspells answer any enemy DMG.
  return s.config.expansions.length > 0;
}

/** The Counterspells `playerId` may reveal against the pending hit. */
export function legalCounterspells(s: CsState, playerId: PlayerId): CsCard[] {
  const atk = s.pendingAttack;
  if (!atk || atk.targetId !== playerId) return [];
  return boardOf(s, playerId).spellBook.filter(
    (c) => c.type === 'counterspell' && (atk.spec.fromAttackSpell || c.counterTrigger === 'anyEnemyDamage'),
  );
}

/**
 * Resolve an attack against each target in turn order. A target holding a
 * Counterspell parks the queue (`awaitingCounterspell`) until they answer; an
 * on-hit "you may …" for the attacker parks it too (`awaitingOffer`).
 */
function startAttackQueue(s: CsState, spec: CsAttackSpecState, targetIds: readonly PlayerId[]) {
  const queue = enemiesInTurnOrder(s, spec.attackerId).filter((id) => targetIds.includes(id));
  continueAttackQueue(s, spec, queue);
}

function continueAttackQueue(s: CsState, spec: CsAttackSpecState, queue: readonly PlayerId[]) {
  for (let i = 0; i < queue.length; i++) {
    if (s.phase === 'gameOver') return;
    const targetId = queue[i]!;
    if (!isLive(s, targetId)) continue;
    if (hitTarget(s, spec, targetId, queue.slice(i + 1)) === 'parked') return;
  }
  finishAttack(s, spec);
}

/**
 * The DMG a hit would do to `targetId` after the public, automatic modifiers — hex
 * tiles, companions, the reconstructed Fortify shield — but before any Counterspell.
 * `attackerHex` lets the AI ask "what if I stood there?".
 */
export function previewHitDamage(
  s: CsState,
  spec: Pick<CsAttackSpecState, 'attackerId' | 'baseDamage' | 'unreducible' | 'fromAttackSpell'>,
  targetId: PlayerId,
  attackerHex: CsHexId = boardOf(s, spec.attackerId).hexId,
): { damage: number; fortifyUsed: number } {
  const t = boardOf(s, targetId);
  let dmg = spec.baseDamage;
  // Mushroom Bog (Ice Storm): "If you deal DMG to an enemy while you are on this Hex tile, increase that DMG by 1."
  if (attackerHex === 'mushroom-bog' && dmg > 0) dmg += 1;
  if (spec.fromAttackSpell) {
    // Amber Mountain: "If you are alone on this Hex tile, you cannot take DMG from Attack Spell cards."
    const others = livePlayerIds(s).filter((id) => id !== targetId);
    const alone = others.every((id) => (id === spec.attackerId ? attackerHex : boardOf(s, id).hexId) !== t.hexId);
    if (t.hexId === 'amber-mountain' && alone) dmg = 0;
    if (!spec.unreducible) {
      // Mushroom Cave: "If an enemy tries to deal more than 1 DMG to you with an Attack Spell … reduce that DMG by 1."
      if (t.hexId === 'mushroom-cave' && dmg > 1) dmg -= 1;
      // Protective Panda: "Each time an enemy deals more than 1 DMG to you with an Attack Spell, reduce that DMG by 1."
      if (t.companion?.kind === 'protective-panda' && dmg > 1) dmg -= 1;
    }
  }
  // Reconstructed Molten Rock Fortify shield.
  let fortifyUsed = 0;
  if (!spec.unreducible && t.fortified > 0 && dmg > 0) {
    fortifyUsed = Math.min(dmg, t.fortified);
    dmg -= fortifyUsed;
  }
  return { damage: dmg, fortifyUsed };
}

/** Work out this target's DMG; open a Counterspell window, or land the hit. */
function hitTarget(s: CsState, spec: CsAttackSpecState, targetId: PlayerId, rest: PlayerId[]): 'parked' | 'done' {
  const t = boardOf(s, targetId);
  const unreducible = spec.unreducible;
  const { damage: dmg, fortifyUsed } = previewHitDamage(s, spec, targetId);
  if (fortifyUsed > 0) {
    t.fortified = 0;
    pushLog(s, targetId, `🛡️ ${seatName(s, targetId)}'s Fortify shield absorbed ${fortifyUsed} DMG!`, 'good');
  }

  // Counterspells trigger "when an enemy deals DMG to you". The window opens for anyone
  // holding a face-down Counterspell (public), whatever it is (secret).
  if (dmg > 0 && counterWindowPossible(s, spec.fromAttackSpell) && t.spellBook.some((c) => c.type === 'counterspell')) {
    s.pendingAttack = { attackerId: spec.attackerId, targetId, damage: dmg, unreducible, remainingTargetIds: rest, spec };
    s.subPhase = 'awaitingCounterspell';
    s.activePlayerId = targetId;
    return 'parked';
  }
  return landHit(s, spec, targetId, dmg, specEffects(spec), rest);
}

/** Apply a hit's DMG and statuses, then offer the attacker any on-hit "may" (which parks the queue). */
function landHit(
  s: CsState,
  spec: CsAttackSpecState,
  targetId: PlayerId,
  damage: number,
  effects: AttackEffects,
  rest: PlayerId[],
): 'parked' | 'done' {
  applyResolvedDamage(s, spec.attackerId, targetId, damage, effects);
  if (s.phase === 'gameOver') return 'done';
  if (damage > 0 && isLive(s, targetId) && offerHexStatus(s, spec, targetId, rest)) return 'parked';
  return 'done';
}

/** Desolate Glacier / Floating Temple: "If you deal DMG to an enemy while you are on this Hex tile, you may spend 1 Blue / Red Orb to Freeze / Stun that enemy." */
function offerHexStatus(s: CsState, spec: CsAttackSpecState, targetId: PlayerId, rest: PlayerId[]): boolean {
  const attackerId = spec.attackerId;
  if (attackerId !== s.turnPlayerId || !isLive(s, attackerId)) return false;
  const a = boardOf(s, attackerId);
  const t = boardOf(s, targetId);
  const offer =
    a.hexId === 'desolate-glacier' && !t.frozen
      ? { effect: 'freeze' as const, cost: { blueOrb: 1 } }
      : a.hexId === 'floating-temple' && !t.stunned
        ? { effect: 'stun' as const, cost: { redOrb: 1 } }
        : null;
  if (!offer || !canAffordCost(s, offer.cost)) return false;
  s.pendingOffer = { kind: 'hexStatus', playerId: attackerId, targetId, ...offer, resume: { spec, queue: rest } };
  s.subPhase = 'awaitingOffer';
  s.activePlayerId = attackerId;
  return true;
}

function applyStatus(s: CsState, byId: PlayerId, targetId: PlayerId, effects: AttackEffects) {
  if (!isLive(s, targetId)) return;
  const t = boardOf(s, targetId);
  // "You can only be affected by 1 Freeze token and 1 Stun token at a time."
  if (effects.inflictStun && !t.stunned) {
    t.stunned = true;
    pushLog(s, byId, `💫 ${seatName(s, targetId)} is Stunned (rolls 4 Resource dice next turn)!`, 'danger');
    // "If another player Stuns you during your turn, the player who Stunned you may choose and remove a Resource from your Resource Pool."
    if (targetId === s.turnPlayerId && byId !== targetId && !s.pendingStunSteal) {
      s.pendingStunSteal = { byId, victimId: targetId };
    }
  }
  if (effects.inflictFreeze && !t.frozen) {
    t.frozen = true;
    pushLog(s, byId, `❄️ ${seatName(s, targetId)} is Frozen (cannot Travel)!`, 'danger');
  }
  if (effects.inflictBurn && !t.burning) {
    t.burning = true;
    pushLog(s, byId, `🔥 ${seatName(s, targetId)} is Burning (1 DMG at the end of their turn)!`, 'danger');
  }
}

function applyResolvedDamage(s: CsState, attackerId: PlayerId, targetId: PlayerId, damage: number, effects: AttackEffects) {
  const t = boardOf(s, targetId);
  const attacker = boardOf(s, attackerId);
  applyStatus(s, attackerId, targetId, effects);

  if (damage > 0) {
    t.hp = Math.max(0, t.hp - damage);
    pushLog(s, attackerId, `⚡ ${seatName(s, attackerId)} dealt ${damage} DMG to ${seatName(s, targetId)} (${t.hp} HP left)!`, 'danger');
    checkElimination(s, targetId);
    if (s.phase === 'gameOver') return;

    // Thorns: Sharp Hedge (card text not archived — kept as built) and the reconstructed Mirror Crab.
    if (isLive(s, attackerId) && t.companion?.kind === 'sharp-hedge' && t.hexId === attacker.hexId) {
      pushLog(s, targetId, `Sharp Hedge dealt 1 thorns DMG back to ${seatName(s, attackerId)}!`, 'normal');
      loseHp(s, attackerId, 1);
    } else if (isLive(s, attackerId) && t.companion?.kind === 'mirror-crab') {
      pushLog(s, targetId, `Mirror Crab reflected 1 DMG back to ${seatName(s, attackerId)}!`, 'normal');
      loseHp(s, attackerId, 1);
    }
  }
}

/** The attack is over: offer Charging Stag, then hand the turn back to its owner (or past them, if it cost them their life). */
function finishAttack(s: CsState, spec: CsAttackSpecState | null) {
  s.pendingAttack = null;
  if (s.phase === 'gameOver') return;
  if (!isLive(s, s.turnPlayerId)) {
    advanceTurn(s);
    return;
  }
  if (spec?.fromAttackSpell && offerStagStrike(s)) return;
  returnToAction(s);
}

/** Back to the turn player's Action Phase — once any Stun-steal choice has been made. */
function returnToAction(s: CsState) {
  s.pendingOffer = null;
  const steal = s.pendingStunSteal;
  if (steal && isLive(s, steal.byId) && isLive(s, steal.victimId) && combinedPool(s).length > 0) {
    s.subPhase = 'awaitingStunSteal';
    s.activePlayerId = steal.byId;
    return;
  }
  s.pendingStunSteal = null;
  s.subPhase = 'awaitingAction';
  s.activePlayerId = s.turnPlayerId;
}

/** Charging Stag: "Each time you Cast an Attack Spell, you may spend 1 Gem to deal 2 DMG to an enemy on an adjacent Hex tile." */
function offerStagStrike(s: CsState): boolean {
  const pid = s.turnPlayerId;
  const b = boardOf(s, pid);
  if (b.companion?.kind !== 'charging-stag') return false;
  const cost: CsResourceCost = { anyGem: 1 };
  if (!canAffordCost(s, cost)) return false;
  const options = enemiesInTurnOrder(s, pid).filter((e) => isHexInSpellRange(s.hexes, b.hexId, boardOf(s, e).hexId, 'adjacent'));
  if (options.length === 0) return false;
  s.pendingOffer = { kind: 'stagStrike', playerId: pid, options, cost };
  s.subPhase = 'awaitingOffer';
  s.activePlayerId = pid;
  return true;
}

// ============================================================================
// Action Handlers
// ============================================================================

function handleRollResourceDice(s: CsState, a: Extract<CsAction, { type: 'rollResourceDice' }>) {
  if (s.subPhase !== 'awaitingRoll') throw new Error('already rolled this turn');
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');
  const b = boardOf(s, a.playerId);

  // Ice Storm Stun: "can only roll 4 Resource dice … instead of 5" (the caster picks the die to leave out).
  const want = b.stunned ? 4 : 5;
  const slots = a.slots ?? [0, 1, 2, 3, 4].slice(0, a.dice.length);
  if (a.dice.length !== want || slots.length !== want) throw new Error(`must roll ${want} Resource dice`);
  if (new Set(slots).size !== slots.length || slots.some((x) => !Number.isInteger(x) || x < 0 || x > 4)) {
    throw new Error('invalid dice');
  }

  s.dicePool = [...a.dice];
  s.diceSlots = [...slots];
  s.bonusPool = [];
  s.turnStartStatus = { frozen: b.frozen, stunned: b.stunned };

  // Start-of-turn Hex tile effects.
  const hex = s.hexes[b.hexId];
  if (hex?.startTurnResource) s.bonusPool.push(hex.startTurnResource);
  if (b.hexId === 'ancient-rune') gainHp(b, 2); // "If you start your turn on this Hex tile, gain 2 HP."
  // Reconstructed expansion companions.
  if (b.companion?.kind === 'undersea-healer') gainHp(b, 1);
  if (b.companion?.kind === 'dark-flutter') s.bonusPool.push('shadowFragment');
  if (b.companion?.kind === 'scaled-alchemist') b.fortified += 1;
  if (b.companion?.kind === 'hammerhead-harvester') s.bonusPool.push('redGem');

  s.actionPointsRemaining = actionPointsFor(b);
  b.usedSpellIdsThisTurn = [];
  b.usedShadowAbilityThisTurn = false;
  pushLog(
    s,
    a.playerId,
    `${seatName(s, a.playerId)} rolled ${want} Resource dice${b.stunned ? ' (Stunned)' : ''}${b.hexId === 'ancient-rune' ? ' and drew 2 HP from the Ancient Rune' : ''}.`,
    'normal',
  );
  s.subPhase = 'awaitingAction';
  s.activePlayerId = a.playerId;
}

function requireActionPhase(s: CsState, playerId: PlayerId, apCost: number) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot act during ${s.subPhase}`);
  if (playerId !== s.turnPlayerId) throw new Error('not your turn');
  if (s.actionPointsRemaining < apCost) throw new Error('not enough Action Points');
}

function handleTravel(s: CsState, a: Extract<CsAction, { type: 'travel' }>) {
  requireActionPhase(s, a.playerId, 1);
  const b = boardOf(s, a.playerId);
  if (b.frozen) throw new Error('cannot Travel while Frozen');
  if (!travelDestinations(s, a.playerId).includes(a.toHexId)) throw new Error('destination Hex is out of reach');
  s.actionPointsRemaining -= 1;
  b.hexId = a.toHexId;
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} traveled to ${s.hexes[a.toHexId].name}.`, 'normal');
}

function handleRerollDice(s: CsState, a: Extract<CsAction, { type: 'rerollDice' }>) {
  requireActionPhase(s, a.playerId, 1);
  if (a.diceIndices.length === 0 || a.diceIndices.length !== a.newValues.length) {
    throw new Error('invalid reroll indices');
  }
  if (new Set(a.diceIndices).size !== a.diceIndices.length) throw new Error('each die rerolls once');
  const raccoon = boardOf(s, a.playerId).companion?.kind === 'cursemaster-raccoon';
  for (const idx of a.diceIndices) {
    if (idx < 0 || idx >= s.dicePool.length) throw new Error('die index out of range');
    // "You cannot Reroll Cursed Crystals" — unless Cursemaster Raccoon lets you.
    if (s.dicePool[idx] === 'cursedCrystal' && !raccoon) throw new Error('cannot reroll Cursed Crystals');
  }
  s.actionPointsRemaining -= 1;
  a.diceIndices.forEach((dieIdx, i) => {
    s.dicePool[dieIdx] = a.newValues[i]!;
  });
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} rerolled ${a.diceIndices.length} Resource ${a.diceIndices.length === 1 ? 'die' : 'dice'}.`, 'normal');
}

function removeOneCursed(s: CsState) {
  const bIdx = s.bonusPool.indexOf('cursedCrystal');
  if (bIdx >= 0) {
    s.bonusPool.splice(bIdx, 1);
    return;
  }
  const idx = s.dicePool.indexOf('cursedCrystal');
  if (idx >= 0) {
    s.dicePool.splice(idx, 1);
    s.diceSlots.splice(idx, 1);
  }
}

function handleProtect(s: CsState, a: Extract<CsAction, { type: 'protect' }>) {
  requireActionPhase(s, a.playerId, 1);
  const b = boardOf(s, a.playerId);
  const options = protectOptions(s, a.playerId);
  const what = a.clearStatus ?? (options.length === 1 ? options[0] : undefined);
  if (!what) throw new Error(options.length ? 'choose what to Protect against' : 'nothing to Protect against');
  if (!options.includes(what)) throw new Error('nothing like that to Protect against');
  if (a.targetHexId && (b.companion?.kind !== 'occult-octo' || !isHexInSpellRange(s.hexes, b.hexId, a.targetHexId, 'adjacent'))) {
    throw new Error('Occult Octo strikes an adjacent Hex tile');
  }

  s.actionPointsRemaining -= 1;
  if (what === 'burning') {
    b.burning = false;
    pushLog(s, a.playerId, `🔥 ${seatName(s, a.playerId)} used Protect to extinguish Burn!`, 'good');
  } else {
    // "Remove 1 Cursed Crystal" — Swamp Monster: "any number … instead of 1".
    const total = combinedPool(s).filter((r) => r === 'cursedCrystal').length;
    const n = b.companion?.kind === 'swamp-monster' ? Math.max(1, Math.min(total, a.count ?? total)) : 1;
    for (let i = 0; i < n; i++) removeOneCursed(s);
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} used Protect to remove ${n} Cursed Crystal${n === 1 ? '' : 's'}.`, 'good');
  }

  // Reconstructed Molten Rock companion.
  if (b.companion?.kind === 'vital-shroom') {
    gainHp(b, 1);
    b.fortified += 1;
  }

  // Occult Octo: "Each time you Protect, you may deal 1 DMG to an adjacent Hex tile."
  if (a.targetHexId) {
    const enemies = enemiesInTurnOrder(s, a.playerId).filter((id) => boardOf(s, id).hexId === a.targetHexId);
    pushLog(s, a.playerId, `🐙 Occult Octo lashes ${s.hexes[a.targetHexId].name}!`, 'danger');
    startAttackQueue(s, { attackerId: a.playerId, baseDamage: 1, unreducible: false, fromAttackSpell: false }, enemies);
  }
}

function handleRefreshHexCard(s: CsState, a: Extract<CsAction, { type: 'refreshHexCard' }>) {
  requireActionPhase(s, a.playerId, 1);
  const b = boardOf(s, a.playerId);
  const hex = s.hexes[b.hexId];
  if (!hex.hasMainDeckSlot) throw new Error(`cannot Refresh at ${hex.name}`);
  s.actionPointsRemaining -= 1;
  if (hex.faceUpCard) s.mainDiscard.push(hex.faceUpCard);
  hex.faceUpCard = drawMainCard(s);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} refreshed the card at ${hex.name}.`, 'normal');
}

function handleCollectCard(s: CsState, a: Extract<CsAction, { type: 'collectCard' }>) {
  requireActionPhase(s, a.playerId, 1);
  const b = boardOf(s, a.playerId);
  const hex = s.hexes[b.hexId];
  const fromCounter = !!a.fromCounterspellDeck;

  let card: CsCard | null;
  if (fromCounter) {
    if (b.hexId !== 'dusty-desert') throw new Error('Counterspells are collected at Dusty Desert');
    card = s.counterspellDeck[0] ?? null;
    if (!card) throw new Error('the Counterspell deck is empty');
    if (!canAffordCost(s, COUNTERSPELL_COST)) throw new Error('cannot afford a Counterspell (1 Gem + 1 Orb)');
  } else {
    if (b.hexId === 'ancient-rune') throw new Error('cards cannot be collected from the Ancient Rune');
    card = hex.faceUpCard;
    if (!card) throw new Error('no face-up card on this Hex tile');
    if (!canAffordCost(s, card.collectionCost)) throw new Error(`cannot afford ${card.name}`);
  }

  // The book card to give up (a Spell requirement, or room in a full book). Forced when there's one choice.
  const room = roomNeededFor(s, a.playerId, fromCounter ? null : card);
  let out: CsCard | null = null;
  if (room) {
    if (room.length === 0) {
      throw new Error(!fromCounter && card.requiresSpellLevel ? `needs a Level ${card.requiresSpellLevel} Spell to give up` : 'no Spell or Resource card to make room with');
    }
    out =
      a.replaceSpellId !== undefined
        ? (room.find((c) => c.id === a.replaceSpellId) ?? null)
        : room.length === 1
          ? room[0]!
          : null;
    if (!out) throw new Error(a.replaceSpellId !== undefined ? 'that card cannot be given up for this' : 'choose a card to give up');
  }

  if (fromCounter) {
    payCostFromState(s, COUNTERSPELL_COST);
    s.counterspellDeck.shift();
  } else {
    payCostFromState(s, card.collectionCost);
    hex.faceUpCard = drawMainCard(s);
  }
  s.actionPointsRemaining -= 1;
  if (out) {
    const gone = out;
    b.spellBook = b.spellBook.filter((c) => c.id !== gone.id);
    discardBookCard(s, gone);
  }
  b.spellBook.push(card);
  pushLog(
    s,
    a.playerId,
    fromCounter
      ? `${seatName(s, a.playerId)} collected a Counterspell${out ? ` (discarding ${out.name})` : ''}.`
      : `${seatName(s, a.playerId)} collected ${card.name}${out ? ` (discarding ${out.name})` : ''}!`,
    'good',
  );
}

function handleUseResourceCard(s: CsState, a: Extract<CsAction, { type: 'useResourceCard' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot act during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');
  const b = boardOf(s, a.playerId);
  const card = b.spellBook.find((c) => c.id === a.cardId);
  if (!card || card.type !== 'resource' || !card.grantsResource) throw new Error('not a Resource card in your Spell Book');
  // "Move this card to the discard pile to add 1 … to your Resource Pool." Costs no Action point.
  const res = card.grantsResource;
  b.spellBook = b.spellBook.filter((c) => c.id !== card.id);
  s.mainDiscard.push(card);
  s.bonusPool.push(res);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} used the ${card.name} Resource card.`, 'normal');
}

function handleCastSpell(s: CsState, a: Extract<CsAction, { type: 'castSpell' }>) {
  requireActionPhase(s, a.playerId, 1);
  const b = boardOf(s, a.playerId);
  const spell = b.spellBook.find((c) => c.id === a.spellId);
  if (!spell) throw new Error('spell not in Spell Book');
  if (spell.type !== 'attackSpell' && spell.type !== 'conversionSpell') throw new Error('only Spells can be Cast');
  if (b.usedSpellIdsThisTurn.includes(spell.id)) throw new Error('each Spell can only be cast once per turn');

  const tier = (spell.castTiers ?? [])[a.tierIndex ?? 0];
  if (!tier) throw new Error('spell cannot be cast');
  const exact = spell.type === 'conversionSpell';
  if (!canAffordCost(s, tier.cost, exact)) throw new Error('cannot afford spell cast cost');

  // Validate the aim before paying anything.
  let targets: PlayerId[] = [];
  let targetHexes: CsHexId[] = [];
  if (spell.type === 'attackSpell') {
    const opts = spellTargetOptions(s, a.playerId, spell);
    if (spell.targetsAllOnHex) {
      const want = tier.hexCount ?? 1;
      targetHexes = a.targetHexIds ?? (a.targetHexId ? [a.targetHexId] : []);
      if (targetHexes.length !== want || new Set(targetHexes).size !== want) {
        throw new Error(`choose ${want} Hex tile${want === 1 ? '' : 's'} in range`);
      }
      if (targetHexes.some((h) => !opts.hexes.includes(h))) throw new Error('target Hex is out of range');
      targets = enemiesInTurnOrder(s, a.playerId).filter((id) => targetHexes.includes(boardOf(s, id).hexId));
    } else {
      const t = a.targetPlayerId;
      if (!t || !opts.players.includes(t)) throw new Error('choose an enemy in range');
      targets = [t];
    }
  }

  payCostFromState(s, tier.cost, exact);
  s.actionPointsRemaining -= 1;
  b.usedSpellIdsThisTurn.push(spell.id);

  if (tier.heal) gainHp(b, tier.heal);
  if (tier.produce) s.bonusPool.push(...tier.produce);
  if (tier.gainFortify) b.fortified += tier.gainFortify;
  if (tier.gainShadowEnergy) b.shadowEnergy = Math.min(energyLimit(b), b.shadowEnergy + tier.gainShadowEnergy);

  if (spell.type === 'conversionSpell') {
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} cast ${spell.name} (${tier.label}).`, 'good');
    // Recovery Raven: "Each time you Cast a Conversion Spell, you may spend 1 Orb to gain 1 HP."
    if (b.companion?.kind === 'recovery-raven' && canAffordCost(s, { anyOrb: 1 })) {
      s.pendingOffer = { kind: 'ravenHeal', playerId: a.playerId, cost: { anyOrb: 1 } };
      s.subPhase = 'awaitingOffer';
      s.activePlayerId = a.playerId;
    }
    return;
  }

  let dmg = tier.damage;
  const target0 = targets[0] ? boardOf(s, targets[0]) : null;
  // Lightning Bug: "Deal 0 DMG if that enemy is in Shadow Form."
  if (spell.kind === 'lightning-bug' && target0?.form === 'shadow') dmg = 0;
  // Reconstructed Ice Storm spell.
  if (spell.kind === 'shadow-swarm' && target0?.form === 'shadow') dmg *= 2;
  const effects: AttackEffects = {
    inflictStun: tier.inflictStun || spell.inflictStun,
    inflictFreeze: tier.inflictFreeze || spell.inflictFreeze,
    inflictBurn: tier.inflictBurn || spell.inflictBurn || b.companion?.kind === 'ravaging-draco',
  };
  pushLog(
    s,
    a.playerId,
    spell.targetsAllOnHex
      ? `${seatName(s, a.playerId)} cast ${spell.name} on ${targetHexes.map((h) => s.hexes[h].name).join(' & ')}!`
      : `${seatName(s, a.playerId)} cast ${spell.name} on ${seatName(s, targets[0]!)}!`,
    'danger',
  );
  startAttackQueue(s, { attackerId: a.playerId, baseDamage: dmg, unreducible: false, fromAttackSpell: true, ...effects }, targets);
}

function handleUseShadowAbility(s: CsState, a: Extract<CsAction, { type: 'useShadowAbility' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error('must be in Action phase');
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');
  const b = boardOf(s, a.playerId);
  if (b.form !== 'shadow') throw new Error('must be in Shadow Form');
  if (!canUseShadowAbility(s, a.playerId)) throw new Error(`Shadow Energy must be fully charged (${SHADOW_ENERGY_LIMIT})`);

  const me = a.playerId;
  const t = shadowAbilityTargets(s, me);

  // Validate the aim first.
  let targetPlayer: PlayerId | undefined;
  let targetHex: CsHexId | undefined;
  let amount = 0;
  if (t.kind === 'player') {
    targetPlayer = a.targetPlayerId ?? (t.options.length === 1 ? t.options[0] : undefined);
    if (t.options.length > 0 && (!targetPlayer || !t.options.includes(targetPlayer))) throw new Error('choose an enemy in range');
  } else if (t.kind === 'hex') {
    targetHex = a.targetHexId;
    if (!targetHex || !t.options.includes(targetHex)) throw new Error('choose a Hex tile in range');
  } else if (t.kind === 'amount') {
    amount = a.amount ?? 0;
    if (amount < 1 || amount > t.max) throw new Error(`choose how much HP to give up (1–${t.max})`);
  }

  b.shadowEnergy -= getShadowAbilityCost(b);
  b.usedShadowAbilityThisTurn = true;
  pushLog(s, me, `🌑 ${characterDef(b.characterId).shadowName} unleashes their Shadow Ability!`, 'danger');
  const enemies = enemiesInTurnOrder(s, me);
  const onHex = (h: CsHexId | undefined) => enemies.filter((e) => boardOf(s, e).hexId === h);
  const spec = (baseDamage: number, extra: Partial<CsAttackSpecState> = {}): CsAttackSpecState => ({
    attackerId: me,
    baseDamage,
    unreducible: false,
    fromAttackSpell: false,
    ...extra,
  });

  switch (b.characterId) {
    case 'kit':
      // "Spend 3 Shadow Energy to deal 1 DMG to each enemy. This DMG cannot be reduced."
      return startAttackQueue(s, spec(1, { unreducible: true }), enemies);
    case 'nuzzle':
      // "Spend 4 Shadow Energy to reduce your HP by up to 4, then deal the same amount of DMG to each enemy."
      b.hp -= amount;
      pushLog(s, me, `${seatName(s, me)} gave up ${amount} HP.`, 'danger');
      return startAttackQueue(s, spec(amount), enemies);
    case 'haze':
      // "Spend 5 Shadow Energy to deal 5 DMG to a Hex tile in range."
      return startAttackQueue(s, spec(5), onHex(targetHex));
    case 'frill':
      // Unconfirmed (board text not archived): gain 2 HP and deal 1 DMG to an enemy in range.
      gainHp(b, 2);
      return startAttackQueue(s, spec(1), targetPlayer ? [targetPlayer] : []);
    case 'talon':
      // Placeholder (unconfirmed): Stun each enemy on your current Hex tile.
      return startAttackQueue(s, spec(0, { inflictStun: true }), onHex(b.hexId));
    case 'frost':
      // Placeholder (unconfirmed): Freeze an enemy in range and deal 1 DMG to them.
      return startAttackQueue(s, spec(1, { inflictFreeze: true }), targetPlayer ? [targetPlayer] : []);
    case 'dread':
      // Placeholder (unconfirmed): +2 Fortify and 1 DMG to an enemy on your Hex tile.
      b.fortified += 2;
      return startAttackQueue(s, spec(1), targetPlayer ? [targetPlayer] : []);
    case 'ashe':
      // Placeholder (unconfirmed): 1 DMG and Burn to every enemy on a Hex tile in range.
      return startAttackQueue(s, spec(1, { inflictBurn: true }), onHex(targetHex));
    default:
      return finishAttack(s, null);
  }
}

function handleTransformAndEndTurn(s: CsState, a: Extract<CsAction, { type: 'transformAndEndTurn' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot end turn during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');

  // Phase 3: absorb the Shadow Fragments left in the pool, up to your form's limit.
  const b = boardOf(s, a.playerId);
  const fragments = combinedPool(s).filter((r) => r === 'shadowFragment').length;
  b.shadowEnergy = Math.min(energyLimit(b), b.shadowEnergy + fragments);

  // "If you've absorbed enough Shadow Energy and you are in your Base Form, you may immediately transform."
  if (b.form === 'light' && b.shadowEnergy >= TRANSFORM_COST && (a.transform ?? true)) {
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

  // "Take 1 damage (DMG) for each Cursed Crystal remaining in your Resource Pool" (none on Sacred Falls).
  const curses = combinedPool(s).filter((r) => r === 'cursedCrystal').length;
  if (curses > 0 && b.hexId !== 'sacred-falls') {
    pushLog(s, playerId, `💎 ${seatName(s, playerId)} took ${curses} DMG from Cursed Crystals (${Math.max(0, b.hp - curses)} HP left).`, 'danger');
    loseHp(s, playerId, curses);
    if (s.phase === 'gameOver') return;
  }

  // Reconstructed Molten Rock Burn: 1 DMG at the end of your turn, then it goes out.
  if (isLive(s, playerId) && b.burning) {
    b.burning = false;
    pushLog(s, playerId, `🔥 ${seatName(s, playerId)} took 1 DMG from Burn (${Math.max(0, b.hp - 1)} HP left).`, 'danger');
    loseHp(s, playerId, 1);
    if (s.phase === 'gameOver') return;
  }

  // Crushing Tortoise: "Each time you end your turn on the same Hex tile as an enemy, you may deal 1 DMG to that enemy."
  if (isLive(s, playerId) && b.companion?.kind === 'crushing-tortoise' && offerTortoise(s, enemiesInTurnOrder(s, playerId).filter((e) => boardOf(s, e).hexId === b.hexId))) {
    return;
  }
  endTurnTail(s);
}

function offerTortoise(s: CsState, options: PlayerId[]): boolean {
  if (options.length === 0) return false;
  s.pendingOffer = { kind: 'tortoise', playerId: s.turnPlayerId, options };
  s.subPhase = 'awaitingOffer';
  s.activePlayerId = s.turnPlayerId;
  return true;
}

/** The last step of a turn: status tokens you started it with come off, and play passes on. */
function endTurnTail(s: CsState) {
  const b = boardOf(s, s.turnPlayerId);
  // "If you started your turn Frozen / Stunned, remove the token … at the end of your turn."
  if (s.turnStartStatus.frozen) b.frozen = false;
  if (s.turnStartStatus.stunned) b.stunned = false;
  advanceTurn(s);
}

/** DMG dealt outside an attack (Bees Everywhere, Crushing Tortoise): Mushroom Bog still adds 1. */
function dealDirect(s: CsState, fromId: PlayerId, toId: PlayerId, n: number) {
  const bonus = boardOf(s, fromId).hexId === 'mushroom-bog' ? 1 : 0;
  pushLog(s, fromId, `⚡ ${seatName(s, fromId)} dealt ${n + bonus} DMG to ${seatName(s, toId)}!`, 'danger');
  loseHp(s, toId, n + bonus);
}

/** Empty the Resource Pool and pass the turn to the next living caster. */
function advanceTurn(s: CsState) {
  s.dicePool = [];
  s.diceSlots = [];
  s.bonusPool = [];
  s.actionPointsRemaining = 0;
  s.pendingAttack = null;
  s.pendingOffer = null;
  s.pendingStunSteal = null;
  s.turnStartStatus = { frozen: false, stunned: false };
  const next = enemiesInTurnOrder(s, s.turnPlayerId)[0];
  if (!next) return;
  s.turnPlayerId = next;
  s.activePlayerId = next;
  s.subPhase = 'awaitingRoll';
}

function handleRespondCounterspell(s: CsState, a: Extract<CsAction, { type: 'respondCounterspell' }>) {
  if (s.subPhase !== 'awaitingCounterspell') throw new Error('no pending attack');
  const atk = s.pendingAttack;
  if (!atk || atk.targetId !== a.playerId) throw new Error('not the attack target');

  const targetBoard = boardOf(s, a.playerId);
  let dmg = atk.damage;
  let effects = specEffects(atk.spec);

  if (a.counterspellId !== undefined) {
    const cs = legalCounterspells(s, a.playerId).find((c) => c.id === a.counterspellId);
    if (!cs) throw new Error('that Counterspell cannot answer this');
    // Run Away! needs its destination before anything moves.
    let runTo: CsHexId | undefined;
    if (cs.kind === 'run-away') {
      const options = adjacentHexIds(s, targetBoard.hexId);
      runTo = a.escapeHexId ?? (options.length === 1 ? options[0] : undefined);
      if (!runTo || !options.includes(runTo)) throw new Error('choose an adjacent Hex tile to run to');
    }
    targetBoard.spellBook = targetBoard.spellBook.filter((c) => c.id !== cs.id);
    // "After you use a Counterspell card, move it to the bottom of the Counterspell deck."
    s.counterspellDeck.push(cs);
    const reduce = (n: number) => {
      if (!atk.unreducible) dmg = Math.max(0, dmg - n);
    };
    const attackerId = atk.attackerId;
    const name = seatName(s, a.playerId);
    switch (cs.kind) {
      case 'pointed-shield':
        reduce(2);
        pushLog(s, a.playerId, `🛡️ ${name} revealed Pointed Shield (-2 DMG)!`, 'good');
        break;
      case 'safety-dome':
        if (!atk.unreducible) {
          dmg = 0;
          effects = {};
        }
        pushLog(s, a.playerId, `🛡️ ${name} revealed Safety Dome (DMG reduced to 0)!`, 'good');
        break;
      case 'run-away':
        // "Travel to an adjacent Hex tile" — the DMG still lands.
        targetBoard.hexId = runTo!;
        pushLog(s, a.playerId, `🏃 ${name} revealed Run Away! and fled to ${s.hexes[runTo!].name}!`, 'good');
        break;
      case 'bees-everywhere':
        pushLog(s, a.playerId, `🐝 ${name} revealed Bees Everywhere!`, 'good');
        dealDirect(s, a.playerId, attackerId, 3);
        if (s.phase === 'gameOver') return;
        break;
      // Reconstructed expansion Counterspells.
      case 'ice-wall':
        reduce(2);
        applyStatus(s, a.playerId, attackerId, { inflictFreeze: true });
        pushLog(s, a.playerId, `❄️ ${name} revealed Ice Wall!`, 'good');
        break;
      case 'frost-mirror':
        reduce(1);
        applyStatus(s, a.playerId, attackerId, { inflictFreeze: true });
        pushLog(s, a.playerId, `❄️ ${name} revealed Frost Mirror!`, 'good');
        loseHp(s, attackerId, 1);
        if (s.phase === 'gameOver') return;
        break;
      case 'icy-fists':
        applyStatus(s, a.playerId, attackerId, { inflictFreeze: true });
        pushLog(s, a.playerId, `❄️ ${name} revealed Icy Fists!`, 'good');
        loseHp(s, attackerId, 2);
        if (s.phase === 'gameOver') return;
        break;
      case 'shocking-waves':
        reduce(1);
        applyStatus(s, a.playerId, attackerId, { inflictStun: true });
        pushLog(s, a.playerId, `💫 ${name} revealed Shocking Waves!`, 'good');
        break;
      case 'magma-shield':
        reduce(2);
        applyStatus(s, a.playerId, attackerId, { inflictBurn: true });
        pushLog(s, a.playerId, `🔥 ${name} revealed Magma Shield!`, 'good');
        break;
      case 'smoke-screen':
        if (!atk.unreducible) {
          dmg = 0;
          effects = {};
        }
        targetBoard.fortified += 1;
        pushLog(s, a.playerId, `💨 ${name} revealed Smoke Screen!`, 'good');
        break;
      case 'molten-retaliation':
        targetBoard.fortified += 1;
        applyStatus(s, a.playerId, attackerId, { inflictBurn: true });
        pushLog(s, a.playerId, `🔥 ${name} revealed Molten Retaliation!`, 'good');
        loseHp(s, attackerId, 1);
        if (s.phase === 'gameOver') return;
        break;
    }
  }

  s.pendingAttack = null;
  if (landHit(s, atk.spec, atk.targetId, dmg, effects, atk.remainingTargetIds) === 'parked') return;
  continueAttackQueue(s, atk.spec, atk.remainingTargetIds);
}

function handleAnswerOffer(s: CsState, a: Extract<CsAction, { type: 'answerOffer' }>) {
  if (s.subPhase !== 'awaitingOffer' || !s.pendingOffer) throw new Error('nothing to answer');
  const offer = s.pendingOffer;
  if (offer.playerId !== a.playerId) throw new Error('not your offer');

  switch (offer.kind) {
    case 'hexStatus': {
      s.pendingOffer = null;
      if (a.accept) {
        payCostFromState(s, offer.cost);
        applyStatus(s, a.playerId, offer.targetId, offer.effect === 'freeze' ? { inflictFreeze: true } : { inflictStun: true });
      }
      if (offer.resume) continueAttackQueue(s, offer.resume.spec, offer.resume.queue);
      else finishAttack(s, null);
      return;
    }
    case 'stagStrike': {
      if (!a.accept) return returnToAction(s);
      const target = a.targetPlayerId ?? (offer.options.length === 1 ? offer.options[0] : undefined);
      if (!target || !offer.options.includes(target)) throw new Error('choose an enemy on an adjacent Hex tile');
      s.pendingOffer = null;
      payCostFromState(s, offer.cost);
      pushLog(s, a.playerId, `🦌 Charging Stag charges ${seatName(s, target)}!`, 'danger');
      // A Companion's DMG, not an Attack Spell: no second Stag strike, no Attack-Spell Counterspells.
      return startAttackQueue(s, { attackerId: a.playerId, baseDamage: 2, unreducible: false, fromAttackSpell: false }, [target]);
    }
    case 'ravenHeal': {
      if (a.accept) {
        payCostFromState(s, offer.cost);
        gainHp(boardOf(s, a.playerId), 1);
        pushLog(s, a.playerId, `🐦 Recovery Raven mends ${seatName(s, a.playerId)} (+1 HP).`, 'good');
      }
      return returnToAction(s);
    }
    case 'tortoise': {
      s.pendingOffer = null;
      if (!a.accept) return endTurnTail(s);
      const target = a.targetPlayerId ?? (offer.options.length === 1 ? offer.options[0] : undefined);
      if (!target || !offer.options.includes(target)) throw new Error('choose an enemy on your Hex tile');
      pushLog(s, a.playerId, `🐢 Crushing Tortoise crushes ${seatName(s, target)}!`, 'danger');
      dealDirect(s, a.playerId, target, 1);
      if (s.phase === 'gameOver') return;
      const rest = offer.options.filter((id) => id !== target && isLive(s, id));
      if (offerTortoise(s, rest)) return;
      return endTurnTail(s);
    }
  }
}

function handleStunSteal(s: CsState, a: Extract<CsAction, { type: 'stunSteal' }>) {
  if (s.subPhase !== 'awaitingStunSteal' || !s.pendingStunSteal) throw new Error('nothing to take');
  if (s.pendingStunSteal.byId !== a.playerId) throw new Error('not your choice');
  const victim = s.pendingStunSteal.victimId;
  if (a.poolIndex !== undefined) {
    const nb = s.bonusPool.length;
    if (!Number.isInteger(a.poolIndex) || a.poolIndex < 0 || a.poolIndex >= nb + s.dicePool.length) throw new Error('no such Resource');
    let taken: CsResource;
    if (a.poolIndex < nb) taken = s.bonusPool.splice(a.poolIndex, 1)[0]!;
    else {
      taken = s.dicePool.splice(a.poolIndex - nb, 1)[0]!;
      s.diceSlots.splice(a.poolIndex - nb, 1);
    }
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} removed a ${taken} from ${seatName(s, victim)}'s Resource Pool.`, 'danger');
  }
  s.pendingStunSteal = null;
  returnToAction(s);
}

// ============================================================================
// Entry point
// ============================================================================

export function applyAction(state: CsState, action: CsAction): CsState {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  const s = cloneState(state);

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
    case 'useResourceCard':
      handleUseResourceCard(s, action);
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
    case 'answerOffer':
      handleAnswerOffer(s, action);
      break;
    case 'stunSteal':
      handleStunSteal(s, action);
      break;
    default: {
      const never: never = action;
      throw new Error(`unknown action ${JSON.stringify(never)}`);
    }
  }

  return s;
}
