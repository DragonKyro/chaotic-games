// Here to Slay — pure deterministic reducer for Base Game + Expansions
// (Warriors & Druids, Berserkers & Necromancers, Here to Sleigh).

import { createRng, rngInt, shuffle } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import { dealHtsSetup } from './cards';
import type {
  HtsAction,
  HtsBaseClass,
  HtsCard,
  HtsConfig,
  HtsMonster,
  HtsPartyHero,
  HtsPendingRoll,
  HtsPrompt,
  HtsRollRecord,
  HtsState,
} from './types';
import { cloneState, pushLog, seatName } from '@/core/state';

/** Cards dealt to each player once the leader draft is done (rulebook). There is no hand limit. */
const STARTING_HAND = 5;

/**
 * Classes needed for the "full Party" win. 6 in the base game; the Warriors &
 * Druids rulesheet raises it to 7 "when playing with this expansion". The
 * 7 for Berserkers & Necromancers, and for both class expansions together, is
 * unconfirmed (the lobby lets the host pick 6–8).
 */
export function getClassesToWin(config: HtsConfig): number {
  if (typeof config.classesToWin === 'number' && config.classesToWin > 0) {
    return config.classesToWin;
  }
  const hasClassExpansion =
    config.expansions.includes('warriors-druids') ||
    config.expansions.includes('berserkers-necromancers');
  return hasClassExpansion ? 7 : 6;
}

// ============================================================================
// Setup
// ============================================================================

export function createInitialState(config: HtsConfig, seed: number, seats: Seat[]): HtsState {
  const rngState = createRng(seed);
  const first = seats[0];
  if (!first) throw new Error('Here to Slay needs at least one seat');

  const { deck, monsterRow, monsterDeck, leaderPool, giftDeck } = dealHtsSetup(
    seats,
    rngState,
    config.expansions,
  );
  const classesToWin = getClassesToWin(config);
  // Leader draft: picked in reverse seat order so the first seat picks last
  // and — "whoever picked their Party Leader card last gets to go first" —
  // takes the first turn.
  const draftOrder = [...seats].reverse().map((s) => s.id);

  const state: HtsState = {
    phase: 'playing',
    seats,
    activePlayerId: draftOrder[0]!,
    finalScores: null,
    rngState,

    subPhase: 'choosingLeaders',
    leaderDraft: { order: draftOrder, pool: leaderPool },
    lastRoll: null,
    deck,
    discard: [],
    monsterRow,
    monsterDeck,
    hands: Object.fromEntries(seats.map((s) => [s.id, []])),
    partyLeaders: {},
    parties: Object.fromEntries(seats.map((s) => [s.id, []])),
    trophies: Object.fromEntries(seats.map((s) => [s.id, []])),
    niceGifts: Object.fromEntries(seats.map((s) => [s.id, []])),
    giftDeck,

    protectedFromSteal: Object.fromEntries(seats.map((s) => [s.id, false])),
    protectedFromDestroy: Object.fromEntries(seats.map((s) => [s.id, false])),

    turnPlayerId: first.id,
    actionPointsRemaining: 3,
    turnBuffs: {
      rollBonus: 0,
      unchallengeable: false,
      shadowClawUsed: false,
      nobleShamanUsed: false,
      gnawingDreadUsed: false,
      noOpponentModifiers: false,
    },

    bearyWisePool: [],
    pendingPlay: null,
    pendingRoll: null,
    promptQueue: [],

    winnerId: null,
    log: [],
    logSeq: 0,
    config,
  };

  pushLog(
    state,
    null,
    `${seats.length} players. Slay ${config.monstersToWin} Monsters or end your turn with ${classesToWin} classes${config.expansions.includes('here-to-sleigh') ? ' (or 3 Nice Gifts)' : ''} to win!`,
    'normal',
  );
  autoPickForcedLeader(state);
  return state;
}

/** Deal the starting hands from the top of the deck, in seat order. */
function dealStartingHands(s: HtsState) {
  for (const seat of s.seats) {
    s.hands[seat.id] = s.deck.splice(0, STARTING_HAND);
  }
}

function finishLeaderDraft(s: HtsState) {
  s.leaderDraft = null;
  dealStartingHands(s);
  s.subPhase = 'awaitingAction';
  s.activePlayerId = s.turnPlayerId;
  s.actionPointsRemaining = 3;
  pushLog(s, s.turnPlayerId, `Every Party has its leader. ${seatName(s, s.turnPlayerId)} picked last and goes first.`, 'normal');
}

function assignLeader(s: HtsState, playerId: PlayerId, leader: HtsCard) {
  const draft = s.leaderDraft!;
  draft.pool = draft.pool.filter((c) => c.id !== leader.id);
  draft.order.shift();
  s.partyLeaders[playerId] = leader;
  pushLog(s, playerId, `${seatName(s, playerId)} leads with ${leader.name}.`, 'normal');
}

/** The last picker facing a single leader has no decision to make. */
function autoPickForcedLeader(s: HtsState) {
  const draft = s.leaderDraft;
  if (!draft) return;
  while (draft.order.length > 0 && draft.pool.length === 1) {
    assignLeader(s, draft.order[0]!, draft.pool[0]!);
  }
  if (draft.order.length === 0 || draft.pool.length === 0) {
    finishLeaderDraft(s);
    return;
  }
  s.activePlayerId = draft.order[0]!;
}

// ============================================================================
// Helpers & Continuous Passive Queries
// ============================================================================

export function handOf(s: HtsState, id: PlayerId): HtsCard[] {
  const h = s.hands[id];
  if (!h) throw new Error(`unknown hand ${id}`);
  return h;
}

export function partyOf(s: HtsState, id: PlayerId): HtsPartyHero[] {
  const p = s.parties[id];
  if (!p) throw new Error(`unknown party ${id}`);
  return p;
}

export function trophiesOf(s: HtsState, id: PlayerId): HtsMonster[] {
  const t = s.trophies[id];
  if (!t) throw new Error(`unknown trophies ${id}`);
  return t;
}

export function niceGiftsOf(s: HtsState, id: PlayerId): HtsCard[] {
  if (!s.niceGifts) s.niceGifts = {};
  if (!s.niceGifts[id]) s.niceGifts[id] = [];
  return s.niceGifts[id]!;
}

function hasTrophy(s: HtsState, playerId: PlayerId, monsterKind: string): boolean {
  return trophiesOf(s, playerId).some((m) => m.card.kind === monsterKind);
}

export function heroEquippedItems(h: HtsPartyHero): HtsCard[] {
  const items: HtsCard[] = [];
  if (h.equippedItem) items.push(h.equippedItem);
  if (h.extraItems && h.extraItems.length > 0) items.push(...h.extraItems);
  return items;
}

export function heroHasItemKind(h: HtsPartyHero, kind: string): boolean {
  return heroEquippedItems(h).some((i) => i.kind === kind);
}

function heroMaxItems(h: HtsPartyHero): number {
  if (heroHasItemKind(h, 'bottomless-bag')) return 3;
  return h.card.maxItems ?? 1;
}

export function canEquipItemToHero(h: HtsPartyHero, itemCard?: HtsCard): boolean {
  const existing = heroEquippedItems(h);
  if (itemCard?.kind === 'bottomless-bag') {
    return existing.length < 3;
  }
  if (existing.length >= heroMaxItems(h)) return false;
  if (itemCard?.class && existing.some((i) => i.class !== null)) {
    return false;
  }
  return true;
}

function equipItemOnHero(h: HtsPartyHero, itemCard: HtsCard): boolean {
  if (!canEquipItemToHero(h, itemCard)) return false;
  if (!h.equippedItem) {
    h.equippedItem = itemCard;
  } else {
    h.extraItems = [...(h.extraItems ?? []), itemCard];
  }
  return true;
}

function countPartyEquippedItems(s: HtsState, playerId: PlayerId): number {
  let total = 0;
  for (const h of partyOf(s, playerId)) {
    total += heroEquippedItems(h).length;
  }
  return total;
}

function heroEffectiveClass(h: HtsPartyHero): HtsBaseClass | null {
  for (const item of heroEquippedItems(h)) {
    if (item.class) return item.class;
  }
  return h.card.class;
}

export function partyClasses(s: HtsState, playerId: PlayerId): Set<HtsBaseClass> {
  const classes = new Set<HtsBaseClass>();
  const leader = s.partyLeaders[playerId];
  if (leader?.class) classes.add(leader.class);
  for (const h of partyOf(s, playerId)) {
    const c = heroEffectiveClass(h);
    if (c) classes.add(c);
  }
  return classes;
}

/**
 * Party requirement to ATTACK (rulebook): a class symbol is met by a Hero of
 * that class *or* your Party Leader; each generic symbol needs a Hero of any
 * class, and the Party Leader never counts as a Hero. One Hero can't pay for
 * two symbols. `requiredHeroes` counts every symbol, class one included.
 */
export function canAttackMonster(s: HtsState, playerId: PlayerId, monster: HtsMonster): boolean {
  const party = partyOf(s, playerId);
  if (!monster.requiredClass) return party.length >= monster.requiredHeroes;
  if (s.partyLeaders[playerId]?.class === monster.requiredClass) {
    return party.length >= monster.requiredHeroes - 1;
  }
  return party.length >= monster.requiredHeroes && party.some((h) => heroEffectiveClass(h) === monster.requiredClass);
}

function canDestroyPartyHero(s: HtsState, ownerId: PlayerId): boolean {
  if (s.protectedFromDestroy[ownerId]) return false;
  if (hasTrophy(s, ownerId, 'monster-terratuga')) return false;
  return true;
}

function canStealPartyHero(s: HtsState, ownerId: PlayerId): boolean {
  if (s.protectedFromSteal[ownerId]) return false;
  return true;
}

export function validHeroTargets(
  s: HtsState,
  prompt: Extract<HtsPrompt, { kind: 'chooseHeroTarget' }>,
): { ownerId: PlayerId; hero: HtsPartyHero }[] {
  const results: { ownerId: PlayerId; hero: HtsPartyHero }[] = [];
  const item = prompt.mode === 'equipItem' ? handOf(s, prompt.playerId).find((c) => c.id === prompt.itemCardId) : undefined;
  if (prompt.mode === 'equipItem' && !item) return results;
  for (const seat of s.seats) {
    const ownerId = seat.id;
    if (prompt.scope === 'own' && ownerId !== prompt.playerId) continue;
    if (prompt.scope === 'others' && ownerId === prompt.playerId) continue;
    if (prompt.scope === 'specificPlayer' && ownerId !== prompt.specificPlayerId) continue;

    if (prompt.mode === 'destroy' && !canDestroyPartyHero(s, ownerId)) continue;
    if (prompt.mode === 'steal' && !canStealPartyHero(s, ownerId)) continue;

    for (const h of partyOf(s, ownerId)) {
      if ((prompt.mode === 'bounceItem' || prompt.mode === 'stealItem') && heroEquippedItems(h).length === 0) continue;
      if (prompt.mode === 'returnCursedItem' && !heroEquippedItems(h).some((i) => i.type === 'cursedItem')) continue;
      if (prompt.mode === 'equipItem' && !canEquipItemToHero(h, item)) continue;
      if (prompt.mode === 'steal' && prompt.sourceHeroId === h.card.id) continue;
      results.push({ ownerId, hero: h });
    }
  }
  return results;
}

/**
 * Compute the modified roll total for `pendingRoll`.
 * For a `challengeDuel`, returns `{ actorTotal, challengerTotal }`.
 */
export function computeRollTotals(s: HtsState, r: HtsPendingRoll): { actorTotal: number; challengerTotal: number } {
  let actorTotal = r.dice[0] + r.dice[1];
  let challengerTotal = r.challengerDice ? r.challengerDice[0] + r.challengerDice[1] : 0;

  // Actor passive bonuses
  if (r.byPlayerId === s.turnPlayerId) {
    actorTotal += s.turnBuffs.rollBonus;
  }
  if (hasTrophy(s, r.byPlayerId, 'monster-anuran-cauldron')) {
    actorTotal += 1;
  }
  // The Piercing Howl: "Each time you roll, +1 to your roll for each Item card
  // equipped to a Hero card in your Party." Every roll, either side of a Challenge.
  const howl = (id: PlayerId) => (s.partyLeaders[id]?.kind === 'leader-piercing-howl' ? countPartyEquippedItems(s, id) : 0);
  actorTotal += howl(r.byPlayerId);
  if (r.challengerId) challengerTotal += howl(r.challengerId);
  if (r.reason === 'heroAbility') {
    const leaderKind = s.partyLeaders[r.byPlayerId]?.kind;
    if (leaderKind === 'leader-charismatic-song') actorTotal += 1;
    if (leaderKind === 'leader-holly-spirit') actorTotal += 1;
    if (hasTrophy(s, r.byPlayerId, 'monster-dark-dragon-king')) actorTotal += 1;
    if (hasTrophy(s, r.byPlayerId, 'monster-frostbite-krampus')) actorTotal += 1;

    const hero = partyOf(s, r.byPlayerId).find((h) => h.card.id === r.sourceCardId);
    if (hero?.card.kind === 'hardened-hunter') {
      actorTotal += countPartyEquippedItems(s, r.byPlayerId);
    }
    if (hero) {
      for (const item of heroEquippedItems(hero)) {
        if (item.kind === 'really-big-ring' || item.kind === 'freshly-sharpened-skates') actorTotal += 2;
        if (item.kind === 'bloodstone') actorTotal += 3;
        if (item.kind === 'even-bigger-ring') actorTotal += 4;
        if (item.kind === 'bottomless-bag') actorTotal += 1;
        if (item.kind === 'curse-of-the-snakes-eyes' || item.kind === 'cursed-glove') actorTotal -= 2;
      }
    }
  } else if (r.reason === 'monsterAttack') {
    const leaderKind = s.partyLeaders[r.byPlayerId]?.kind;
    if (leaderKind === 'leader-divine-arrow') actorTotal += 1;
    if (leaderKind === 'leader-holly-spirit') actorTotal += 1;
    if (hasTrophy(s, r.byPlayerId, 'monster-abominable-snowbeast')) actorTotal += 2;
  } else if (r.reason === 'challengeDuel') {
    if (s.partyLeaders[r.byPlayerId]?.kind === 'leader-fist-of-reason') actorTotal += 2;
    if (hasTrophy(s, r.byPlayerId, 'monster-titan-wyvern')) actorTotal += 1;
    if (hasTrophy(s, r.byPlayerId, 'monster-feral-dragon')) actorTotal += 2;
    if (r.challengerId) {
      if (r.challengerId === s.turnPlayerId) challengerTotal += s.turnBuffs.rollBonus;
      if (hasTrophy(s, r.challengerId, 'monster-anuran-cauldron')) challengerTotal += 1;
      if (s.partyLeaders[r.challengerId]?.kind === 'leader-fist-of-reason') challengerTotal += 2;
      if (hasTrophy(s, r.challengerId, 'monster-titan-wyvern')) challengerTotal += 1;
      if (hasTrophy(s, r.challengerId, 'monster-feral-dragon')) challengerTotal += 2;
    }
  }

  // Abyss Queen: "Each time another player plays a Modifier card on one of
  // your rolls, +1 to your roll." (A leader's adjustment is not a Modifier card.)
  for (const mod of r.modifiers) {
    const isCard = mod.card.type === 'modifier';
    if (mod.targetSide === 'challenger') {
      challengerTotal += mod.amount;
      if (isCard && r.challengerId && mod.playerId !== r.challengerId && hasTrophy(s, r.challengerId, 'monster-abyss-queen')) {
        challengerTotal += 1;
      }
    } else {
      actorTotal += mod.amount;
      if (isCard && mod.playerId !== r.byPlayerId && hasTrophy(s, r.byPlayerId, 'monster-abyss-queen')) {
        actorTotal += 1;
      }
    }
  }

  return { actorTotal, challengerTotal };
}

function drawCards(s: HtsState, playerId: PlayerId, count: number): HtsCard[] {
  const drawn: HtsCard[] = [];
  let remaining = count;
  while (remaining > 0) {
    remaining--;
    if (s.deck.length === 0 && s.discard.length > 0) {
      s.deck = shuffle(s.rngState, s.discard);
      s.discard = [];
    }
    const c = s.deck.shift();
    if (!c) break;
    handOf(s, playerId).push(c);
    drawn.push(c);

    // Rex Major: "Each time you DRAW a Modifier card, you may reveal it, then
    // DRAW a second card." Revealed (logged) and taken automatically.
    if (c.type === 'modifier' && hasTrophy(s, playerId, 'monster-rex-major')) {
      pushLog(s, playerId, `Rex Major: ${seatName(s, playerId)} reveals ${c.name} and draws another card.`, 'good');
      remaining++;
    }
  }

  // Malamammoth / Orthus: "Each time you DRAW an Item (Magic) card, you may
  // play it immediately." Only on your own turn — Items and Magic are played on
  // your turn. The prompt opens on every draw, Item or not, so its appearance
  // doesn't tell the table what was drawn.
  if (drawn.length > 0 && playerId === s.turnPlayerId) {
    const ids = drawn.map((c) => c.id);
    if (hasTrophy(s, playerId, 'monster-malamammoth')) {
      s.promptQueue.push({
        kind: 'chooseCardsFromHand',
        playerId,
        reason: 'Malamammoth: if you drew an Item card, you may play it immediately.',
        count: 1,
        optional: true,
        filter: 'item',
        effectTag: 'playFreeItem',
        onlyCardIds: ids,
        keepIfEmpty: true,
      });
    }
    if (hasTrophy(s, playerId, 'monster-orthus')) {
      s.promptQueue.push({
        kind: 'chooseCardsFromHand',
        playerId,
        reason: 'Orthus: if you drew a Magic card, you may play it immediately.',
        count: 1,
        optional: true,
        filter: 'magic',
        effectTag: 'playFreeMagic',
        onlyCardIds: ids,
        keepIfEmpty: true,
      });
    }
  }
  return drawn;
}

function claimNiceGift(s: HtsState, playerId: PlayerId) {
  if (!s.giftDeck) s.giftDeck = [];
  let gift = s.giftDeck.shift();
  if (!gift) {
    gift = {
      id: 9000 + s.logSeq + 1,
      kind: 'gift-warm-socks',
      name: 'Warm Socks',
      type: 'gift',
      class: null,
      text: 'Nice List Gift — Collect 3 Nice Gifts to win!',
      abilityThreshold: null,
      modifierChoices: null,
      expansion: 'here-to-sleigh',
    };
  }
  niceGiftsOf(s, playerId).push(gift);
  if (gift.kind === 'gift-bag-of-holding') {
    drawCards(s, playerId, 1);
  } else if (gift.kind === 'gift-rudolphs-nose') {
    s.turnBuffs.rollBonus += 1;
  }
  pushLog(s, playerId, `🎁 ${seatName(s, playerId)} claimed Nice Gift: ${gift.name} (${niceGiftsOf(s, playerId).length}/3)!`, 'good');
}

/**
 * Here to Slay has no points: one player wins, everyone else loses. So the
 * shell's ranking is winner 1, everyone else 0 (tied for second).
 */
function endGame(s: HtsState, winnerId: PlayerId, reason: string) {
  s.phase = 'gameOver';
  s.subPhase = 'gameOver';
  s.activePlayerId = null;
  s.winnerId = winnerId;
  s.pendingPlay = null;
  s.pendingRoll = null;
  s.promptQueue = [];
  s.finalScores = Object.fromEntries(s.seats.map((st) => [st.id, st.id === winnerId ? 1 : 0]));
  pushLog(s, winnerId, `🏆 ${seatName(s, winnerId)} wins Here to Slay by ${reason}!`, 'good');
}

/**
 * Wins that land the moment they happen: SLAY the third Monster (rulebook
 * "Option 1"), and the unverified Here to Sleigh gift count. Checked once the
 * current effect has fully resolved.
 */
function checkWinCondition(s: HtsState): boolean {
  if (s.phase === 'gameOver') return true;
  if (s.pendingPlay || s.pendingRoll || s.promptQueue.length > 0) return false;

  const sleighEnabled = s.config.expansions.includes('here-to-sleigh');
  for (const seat of s.seats) {
    const monsterCount = trophiesOf(s, seat.id).length;
    if (monsterCount >= s.config.monstersToWin) {
      endGame(s, seat.id, `slaying ${monsterCount} Monsters`);
      return true;
    }
    const giftCount = niceGiftsOf(s, seat.id).length;
    if (sleighEnabled && giftCount >= 3) {
      endGame(s, seat.id, `collecting ${giftCount} Nice List Gifts`);
      return true;
    }
  }
  return false;
}

/**
 * Rulebook "Option 2: End your turn with a full Party" — only the player whose
 * turn is ending, and only at the end of it. A full Party mid-turn (or on
 * somebody else's turn) has to survive until then.
 */
function checkEndOfTurnWin(s: HtsState): boolean {
  if (checkWinCondition(s)) return true;
  const classesNeeded = getClassesToWin(s.config);
  if (partyClasses(s, s.turnPlayerId).size >= classesNeeded) {
    endGame(s, s.turnPlayerId, `ending their turn with a full ${classesNeeded}-class Party`);
    return true;
  }
  return false;
}

function advanceFlow(s: HtsState) {
  if (s.phase === 'gameOver') return;

  while (s.promptQueue.length > 0) {
    const front = s.promptQueue[0]!;
    if (front.kind === 'step') {
      s.promptQueue.shift();
      runStep(s, front);
      // A step can open a play (and so a Challenge window) of its own.
      if (s.pendingPlay || s.pendingRoll) return;
      continue;
    }
    if (isPromptImpossible(s, front)) {
      s.promptQueue.shift();
      continue;
    }
    break;
  }

  if (s.promptQueue.length > 0) {
    s.subPhase = 'awaitingPrompt';
    s.activePlayerId = s.promptQueue[0]!.playerId;
    return;
  }

  if (checkWinCondition(s)) return;

  s.subPhase = 'awaitingAction';
  s.activePlayerId = s.turnPlayerId;
}

function runStep(s: HtsState, p: Extract<HtsPrompt, { kind: 'step' }>) {
  const st = p.step;
  if (st.type === 'draw') {
    drawCards(s, p.playerId, st.count);
  } else if (st.type === 'moveHero') {
    if (partyOf(s, st.fromPlayerId).some((h) => h.card.id === st.heroCardId)) {
      removeHeroFromParty(s, st.fromPlayerId, st.heroCardId, 'move', { toPlayerId: st.toPlayerId });
      pushLog(s, p.playerId, `${seatName(s, st.toPlayerId)} receives a Hero from ${seatName(s, st.fromPlayerId)}'s Party.`, 'normal');
    }
  }
}

function isPromptImpossible(s: HtsState, p: HtsPrompt): boolean {
  if (p.kind === 'chooseHeroTarget') {
    return validHeroTargets(s, p).length === 0;
  }
  if (p.kind === 'chooseCardsFromHand') {
    if (p.keepIfEmpty) return false;
    const valid = validHandCardsForPrompt(s, p);
    return valid.length === 0;
  }
  if (p.kind === 'chooseFromPile') {
    return p.cards.length === 0;
  }
  if (p.kind === 'bullseyePeek') {
    return p.cards.length === 0;
  }
  return false;
}

export function validHandCardsForPrompt(
  s: HtsState,
  p: Extract<HtsPrompt, { kind: 'chooseCardsFromHand' }>,
): HtsCard[] {
  const hand = handOf(s, p.playerId);
  const playsItem = p.effectTag === 'playFreeItem' || p.effectTag === 'playFreeItemsUpTo2';
  return hand.filter((c) => {
    if (p.onlyCardIds && !p.onlyCardIds.includes(c.id)) return false;
    if (p.filter === 'hero') return c.type === 'hero';
    if (p.filter === 'item') {
      if (c.type !== 'item' && c.type !== 'cursedItem') return false;
      // An Item must be equipped the moment it is played: it needs a Hero that can take it.
      return !playsItem || s.seats.some((st) => partyOf(s, st.id).some((h) => canEquipItemToHero(h, c)));
    }
    if (p.filter === 'magic') return c.type === 'magic';
    return true;
  });
}

// ============================================================================
// Party Hero Removal & Movement
// ============================================================================

function removeItemFromHero(hero: HtsPartyHero, predicate: (item: HtsCard) => boolean): HtsCard | null {
  if (hero.equippedItem && predicate(hero.equippedItem)) {
    const removed = hero.equippedItem;
    hero.equippedItem = hero.extraItems?.shift() ?? null;
    return removed;
  }
  if (hero.extraItems) {
    const idx = hero.extraItems.findIndex(predicate);
    if (idx >= 0) {
      return hero.extraItems.splice(idx, 1)[0] ?? null;
    }
  }
  return null;
}

function removeHeroFromParty(
  s: HtsState,
  ownerId: PlayerId,
  heroCardId: number,
  reason: 'destroy' | 'sacrifice' | 'steal' | 'move',
  opts?: {
    byPlayerId?: PlayerId;
    toPlayerId?: PlayerId;
    stealEquippedItemToHand?: PlayerId;
    skipSabretoothCheck?: boolean;
  },
): 'done' | 'deferred' | 'saved' | 'missing' {
  const party = partyOf(s, ownerId);
  const idx = party.findIndex((h) => h.card.id === heroCardId);
  if (idx < 0) return 'missing';
  const hero = party[idx]!;

  // Corrupted Sabretooth check: "Each time you would DESTROY a Hero card, you may STEAL that Hero card instead."
  // (Only if the Hero could be stolen — Calming Voice / Roaryal Guard block it.)
  if (
    reason === 'destroy' &&
    opts?.byPlayerId &&
    opts.byPlayerId !== ownerId &&
    hasTrophy(s, opts.byPlayerId, 'monster-corrupted-sabretooth') &&
    canStealPartyHero(s, ownerId) &&
    !opts?.skipSabretoothCheck
  ) {
    s.promptQueue.unshift({
      kind: 'corruptedSabretoothChoice',
      playerId: opts.byPlayerId,
      ownerId,
      heroCardId,
      stealItemToHand: !!opts.stealEquippedItemToHand,
    });
    return 'deferred';
  }

  // Decoy Doll check on sacrifice or destroy
  if ((reason === 'destroy' || reason === 'sacrifice') && heroHasItemKind(hero, 'decoy-doll')) {
    const doll = removeItemFromHero(hero, (i) => i.kind === 'decoy-doll');
    if (doll) s.discard.push(doll);
    pushLog(s, ownerId, `Decoy Doll sacrificed itself to save ${hero.card.name}!`, 'good');
    return 'saved';
  }

  party.splice(idx, 1);

  if (reason === 'steal' || reason === 'move') {
    const destId = opts?.toPlayerId ?? opts?.byPlayerId;
    if (destId) {
      partyOf(s, destId).push(hero);
    }
    return 'done';
  }

  // Destroy or Sacrifice
  const hadSoulTether = heroHasItemKind(hero, 'soul-tether');
  for (const item of heroEquippedItems(hero)) {
    if (opts?.stealEquippedItemToHand) {
      handOf(s, opts.stealEquippedItemToHand).push(item);
    } else {
      s.discard.push(item);
    }
  }
  hero.equippedItem = null;
  hero.extraItems = [];

  if (hadSoulTether) {
    handOf(s, ownerId).push(hero.card);
    pushLog(s, ownerId, `Soul Tether returned ${hero.card.name} to ${seatName(s, ownerId)}'s hand!`, 'good');
  } else {
    s.discard.push(hero.card);
  }

  if (reason === 'destroy') {
    if (hasTrophy(s, ownerId, 'monster-dracos')) {
      drawCards(s, ownerId, 1);
      pushLog(s, ownerId, `Dracos: ${seatName(s, ownerId)} drew a card when their Hero was destroyed.`, 'good');
    }
    const destroyerId = opts?.byPlayerId;
    if (destroyerId) {
      if (hasTrophy(s, destroyerId, 'monster-venomous-gemini')) {
        drawCards(s, destroyerId, 1);
        pushLog(s, destroyerId, `Venomous Gemini: ${seatName(s, destroyerId)} drew a card for destroying a Hero!`, 'good');
      }
    }
  }
  return 'done';
}

// ============================================================================
// Challenge & Modifier Windows
// ============================================================================

/** Seat ids clockwise, starting with `from`. */
function seatsFrom(s: HtsState, from: PlayerId): PlayerId[] {
  const ids = s.seats.map((st) => st.id);
  const i = Math.max(0, ids.indexOf(from));
  return [...ids.slice(i), ...ids.slice(0, i)];
}

/**
 * Who may CHALLENGE a card being played: every other player holding a
 * Challenge card, clockwise from the player's left. A card can only be
 * challenged once, so the window closes after the first Challenge lands.
 */
function buildChallengeQueue(s: HtsState, byPlayerId: PlayerId, card: HtsCard): PlayerId[] {
  if (s.turnBuffs.unchallengeable && byPlayerId === s.turnPlayerId) return [];
  if ((card.type === 'item' || card.type === 'cursedItem') && hasTrophy(s, byPlayerId, 'monster-warworn-owlbear')) {
    return [];
  }
  return seatsFrom(s, byPlayerId).filter((id) => id !== byPlayerId && handOf(s, id).some((c) => c.type === 'challenge'));
}

/**
 * Put a Hero / Item / Magic card "into play" — from an action point or from an
 * effect that plays a card from your hand "immediately". Either way it is
 * played from your hand, so it can be Challenged (rulebook: "when that player
 * attempts to play a Hero, Item, or Magic card from their hand"). The caller
 * must not run advanceFlow afterwards: resolution does that.
 */
function beginPlay(s: HtsState, by: PlayerId, card: HtsCard, target?: { playerId: PlayerId; heroCardId: number }) {
  s.pendingPlay = {
    byPlayerId: by,
    card,
    targetPlayerId: target?.playerId ?? (card.type === 'hero' ? by : null),
    targetHeroCardId: target?.heroCardId ?? null,
    responderQueue: [],
  };
  openOrResolvePlay(s);
}

/** Take an Item from hand and play it onto a Hero (the target was chosen through a prompt). */
function playItemFromHand(s: HtsState, by: PlayerId, itemCardId: number, ownerId: PlayerId, heroCardId: number) {
  const hand = handOf(s, by);
  const idx = hand.findIndex((c) => c.id === itemCardId);
  if (idx < 0) throw new Error('item card not in hand');
  const card = hand.splice(idx, 1)[0]!;
  const hero = partyOf(s, ownerId).find((h) => h.card.id === heroCardId);
  pushLog(s, by, `${seatName(s, by)} played ${card.name} on ${hero?.card.name ?? 'a Hero'}.`, 'normal');
  beginPlay(s, by, card, { playerId: ownerId, heroCardId });
}

/** Ask `by` where the Item goes ("you must immediately equip it to a Hero card"). */
function queueEquipTarget(s: HtsState, by: PlayerId, item: HtsCard, front: boolean) {
  const prompt: HtsPrompt = {
    kind: 'chooseHeroTarget',
    playerId: by,
    reason: `Equip ${item.name}: choose the Hero to wear it${item.type === 'cursedItem' ? ' (cursed — best given away)' : ''}.`,
    optional: false,
    scope: 'any',
    mode: 'equipItem',
    itemCardId: item.id,
  };
  if (front) s.promptQueue.unshift(prompt);
  else s.promptQueue.push(prompt);
}

function openOrResolvePlay(s: HtsState) {
  const p = s.pendingPlay;
  if (!p) throw new Error('openOrResolvePlay with no pending play');
  const queue = buildChallengeQueue(s, p.byPlayerId, p.card);
  p.responderQueue = queue;
  const first = queue[0];
  if (!first) {
    resolvePendingPlay(s, false);
    return;
  }
  s.subPhase = 'awaitingChallenge';
  s.activePlayerId = first;
}

function resolvePendingPlay(s: HtsState, cancelled: boolean) {
  const p = s.pendingPlay;
  if (!p) throw new Error('no pendingPlay');
  s.pendingPlay = null;

  if (cancelled) {
    s.discard.push(p.card);
    pushLog(s, p.byPlayerId, `${p.card.name} was defeated in a Challenge and discarded!`, 'danger');
    advanceFlow(s);
    return;
  }

  const by = p.byPlayerId;
  if (p.card.type === 'hero') {
    partyOf(s, by).push({
      card: p.card,
      equippedItem: null,
      usedThisTurn: false,
    });
    // Prompt player to optionally roll 2d6 for free to use the newly played Hero's ability!
    s.promptQueue.unshift({
      kind: 'rollEnteredHero',
      playerId: by,
      heroCard: p.card,
    });
  } else if (p.card.type === 'item' || p.card.type === 'cursedItem') {
    const tPlayer = p.targetPlayerId ?? by;
    const hero = partyOf(s, tPlayer).find((h) => h.card.id === p.targetHeroCardId);
    if (hero && equipItemOnHero(hero, p.card)) {
      pushLog(s, by, `${seatName(s, by)} equipped ${p.card.name} to ${hero.card.name}.`, 'normal');
    } else {
      s.discard.push(p.card);
    }
  } else if (p.card.type === 'magic') {
    s.discard.push(p.card);
    if (s.partyLeaders[by]?.kind === 'leader-cloaked-sage') {
      drawCards(s, by, 1);
      pushLog(s, by, `The Cloaked Sage: ${seatName(s, by)} drew a card for playing a Magic card.`, 'good');
    }
    resolveMagicEffect(s, by, p.card);
  }

  advanceFlow(s);
}

function canPlayModifiers(s: HtsState, id: PlayerId): boolean {
  return !(s.turnBuffs.noOpponentModifiers && id !== s.turnPlayerId);
}

/**
 * The Noble Shaman: "Once per turn on each player's turn, you may choose any
 * player's roll. -1 to that roll." Not a Modifier card, so a no-Modifiers
 * effect doesn't stop it.
 */
export function canUseNobleShaman(s: HtsState, id: PlayerId): boolean {
  return s.partyLeaders[id]?.kind === 'leader-noble-shaman' && !s.turnBuffs.nobleShamanUsed;
}

/**
 * Everyone who could still change the roll, clockwise from the roller.
 * "Each player may play any number of Modifier cards on the same roll", so the
 * queue is rebuilt after every Modifier — including the player who just
 * played one. It terminates: each play spends a card, each decline advances.
 */
function buildModifierQueue(s: HtsState, rollerId: PlayerId): PlayerId[] {
  return seatsFrom(s, rollerId).filter((id) => {
    if (!canPlayModifiers(s, id)) return false;
    const hasModifierCard = handOf(s, id).some((c) => c.type === 'modifier');
    return hasModifierCard || canUseNobleShaman(s, id);
  });
}

function openOrResolveRoll(s: HtsState) {
  const r = s.pendingRoll;
  if (!r) throw new Error('openOrResolveRoll with no pendingRoll');
  const queue = buildModifierQueue(s, r.byPlayerId);
  r.responderQueue = queue;
  const first = queue[0];
  if (!first) {
    resolvePendingRoll(s);
    return;
  }
  s.subPhase = 'awaitingModifiers';
  s.activePlayerId = first;
}

function resolvePendingRoll(s: HtsState) {
  const r = s.pendingRoll;
  if (!r) throw new Error('no pendingRoll');
  s.pendingRoll = null;

  for (const mod of r.modifiers) {
    if (mod.card.type !== 'partyLeader') {
      s.discard.push(mod.card);
    }
  }

  const { actorTotal, challengerTotal } = computeRollTotals(s, r);
  const record = (subject: string, outcome: HtsRollRecord['outcome']) => {
    s.lastRoll = { seq: (s.lastRoll?.seq ?? 0) + 1, roll: { ...r, responderQueue: [] }, actorTotal, challengerTotal, subject, outcome };
  };

  if (r.reason === 'challengeDuel') {
    const challengerWon = challengerTotal >= actorTotal;
    record(s.pendingPlay?.card.name ?? 'the card', challengerWon ? 'challengeWon' : 'cardStands');
    pushLog(
      s,
      r.byPlayerId,
      `Challenge duel: ${seatName(s, r.byPlayerId)} rolled ${actorTotal} vs ${seatName(s, r.challengerId)} rolled ${challengerTotal}.`,
      challengerWon ? 'danger' : 'good',
    );
    resolvePendingPlay(s, challengerWon);
    return;
  }

  if (r.reason === 'heroAbility') {
    const hero = partyOf(s, r.byPlayerId).find((h) => h.card.id === r.sourceCardId);
    const heroCard = hero?.card;
    const isLow = Boolean(r.rollLow ?? hero?.card.rollLow);
    const success = isLow ? actorTotal <= r.threshold : actorTotal >= r.threshold;
    record(heroCard?.name ?? 'a Hero', success ? 'success' : 'failure');
    pushLog(
      s,
      r.byPlayerId,
      `${seatName(s, r.byPlayerId)} rolled ${actorTotal} (needed ${isLow ? `≤${r.threshold}` : `${r.threshold}+`}) for ${heroCard?.name ?? 'Hero'} — ${success ? 'SUCCESS!' : 'failed.'}`,
      success ? 'good' : 'normal',
    );

    if (success) {
      if (hasTrophy(s, r.byPlayerId, 'monster-arctic-aries')) {
        drawCards(s, r.byPlayerId, 1);
      }
      if (s.partyLeaders[r.byPlayerId]?.kind === 'leader-festive-noel' && (actorTotal >= 10 || (isLow && actorTotal <= 4))) {
        claimNiceGift(s, r.byPlayerId);
      }
      if (hero && heroHasItemKind(hero, 'milk-and-cookies')) {
        claimNiceGift(s, r.byPlayerId);
      }
      if (hero && heroHasItemKind(hero, 'suspiciously-shiny-coin') && handOf(s, r.byPlayerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: r.byPlayerId,
          reason: 'Suspiciously Shiny Coin: you must DISCARD a card after succeeding on your Hero roll.',
          count: 1,
          optional: false,
          filter: 'any',
          effectTag: 'discard',
        });
      }
      if (hero) {
        resolveHeroAbilityEffect(s, r.byPlayerId, hero.card);
      }
    } else {
      if (hero && heroHasItemKind(hero, 'particularly-rusty-coin')) {
        drawCards(s, r.byPlayerId, 1);
        pushLog(s, r.byPlayerId, 'Particularly Rusty Coin: drew a card after a failed roll!', 'good');
      }
      if (hero && heroHasItemKind(hero, 'temporal-hourglass')) {
        s.actionPointsRemaining += 1;
        pushLog(s, r.byPlayerId, 'Temporal Hourglass: gained +1 AP after a failed roll!', 'good');
      }
      if (hasTrophy(s, r.byPlayerId, 'monster-muscipula')) {
        drawCards(s, r.byPlayerId, 1);
        pushLog(s, r.byPlayerId, 'Muscipula: drew a card after an unsuccessful Hero roll!', 'good');
      }
    }

    advanceFlow(s);
    return;
  }

  if (r.reason === 'monsterAttack') {
    const idx = s.monsterRow.findIndex((m) => m.card.id === r.sourceCardId);
    const monster = idx >= 0 ? s.monsterRow[idx] : null;
    if (!monster) {
      advanceFlow(s);
      return;
    }

    const slain = monster.slayOnLow ? actorTotal <= monster.slayThreshold : actorTotal >= monster.slayThreshold;
    const failed = monster.slayOnLow ? actorTotal >= monster.failThreshold : actorTotal <= monster.failThreshold;
    record(monster.card.name, slain ? 'slain' : failed ? 'penalty' : 'nothing');

    if (slain) {
      s.monsterRow.splice(idx, 1);
      trophiesOf(s, r.byPlayerId).push(monster);
      if (monster.card.kind === 'monster-frostbite-krampus') {
        claimNiceGift(s, r.byPlayerId);
      }
      // The Raging Manticore: "Each time you SLAY a Monster card, DRAW 2 cards."
      if (s.partyLeaders[r.byPlayerId]?.kind === 'leader-raging-manticore') {
        drawCards(s, r.byPlayerId, 2);
        pushLog(s, r.byPlayerId, `The Raging Manticore: ${seatName(s, r.byPlayerId)} draws 2 cards for the slay.`, 'good');
      }
      const replacement = s.monsterDeck.shift();
      if (replacement) s.monsterRow.push(replacement);
      pushLog(s, r.byPlayerId, `⚔️ ${seatName(s, r.byPlayerId)} rolled ${actorTotal} and SLEW ${monster.card.name}!`, 'good');
    } else if (failed) {
      pushLog(s, r.byPlayerId, `💀 ${seatName(s, r.byPlayerId)} rolled ${actorTotal} against ${monster.card.name} and takes the penalty!`, 'danger');
      if (monster.failPenalty === 'sacrificeHero') {
        s.promptQueue.push({
          kind: 'chooseHeroTarget',
          playerId: r.byPlayerId,
          reason: `${monster.card.name} penalty: you must SACRIFICE a Hero card.`,
          optional: false,
          scope: 'own',
          mode: 'sacrifice',
        });
      } else if (monster.failPenalty === 'discard2' && handOf(s, r.byPlayerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: r.byPlayerId,
          reason: `${monster.card.name} penalty: you must DISCARD 2 cards.`,
          count: Math.min(2, handOf(s, r.byPlayerId).length),
          optional: false,
          filter: 'any',
          effectTag: 'discard',
        });
      }
    } else {
      pushLog(s, r.byPlayerId, `${seatName(s, r.byPlayerId)} rolled ${actorTotal} against ${monster.card.name} — no effect.`, 'normal');
    }

    advanceFlow(s);
  }
}

// ============================================================================
// Hero Ability & Magic Effect Resolution
// ============================================================================

function resolveHeroAbilityEffect(s: HtsState, byPlayerId: PlayerId, heroCard: HtsCard) {
  switch (heroCard.kind) {
    case 'bad-axe':
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Bad Axe: choose a Hero card to DESTROY.',
        optional: false,
        scope: 'others',
        mode: 'destroy',
      });
      break;
    case 'bear-claw':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Bear Claw: choose a player to pull a card from (pull a 2nd if it's a Hero).",
        optional: false,
        effectTag: 'bearClawPull',
      });
      break;
    case 'beary-wise': {
      s.bearyWisePool = [];
      const others = s.seats.filter((st) => st.id !== byPlayerId && handOf(s, st.id).length > 0);
      others.forEach((st, idx) => {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: st.id,
          reason: 'Beary Wise: you must DISCARD a card.',
          count: 1,
          optional: false,
          filter: 'any',
          effectTag: 'bearyWiseDiscard',
          toPlayerId: idx === others.length - 1 ? byPlayerId : undefined,
        });
      });
      break;
    }
    case 'fury-knuckle':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Fury Knuckle: choose a player to pull a card from (pull a 2nd if it's a Challenge).",
        optional: false,
        effectTag: 'furyKnucklePull',
      });
      break;
    case 'heavy-bear':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: 'Heavy Bear: choose a player to DISCARD 2 cards.',
        optional: false,
        effectTag: 'heavyBearDiscard',
      });
      break;
    case 'pan-chucks': {
      const drawn = drawCards(s, byPlayerId, 2);
      if (drawn.some((c) => c.type === 'challenge')) {
        s.promptQueue.push({
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Pan Chucks: you drew a Challenge card! You may DESTROY a Hero card.',
          optional: true,
          scope: 'others',
          mode: 'destroy',
        });
      }
      break;
    }
    case 'qi-bear':
      if (handOf(s, byPlayerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Qi Bear: DISCARD up to 3 cards. For each card discarded, DESTROY a Hero card.',
          count: Math.min(3, handOf(s, byPlayerId).length),
          upTo: true,
          optional: true,
          filter: 'any',
          effectTag: 'qiBearDiscard',
        });
      }
      break;
    case 'tough-teddy':
      for (const seat of s.seats) {
        if (
          seat.id !== byPlayerId &&
          partyClasses(s, seat.id).has('fighter') &&
          handOf(s, seat.id).length > 0
        ) {
          s.promptQueue.push({
            kind: 'chooseCardsFromHand',
            playerId: seat.id,
            reason: 'Tough Teddy: you have a Fighter in your Party and must DISCARD a card.',
            count: 1,
            optional: false,
            filter: 'any',
            effectTag: 'discard',
          });
        }
      }
      break;
    case 'dodgy-dealer':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: 'Dodgy Dealer: choose another player to trade hands with.',
        optional: false,
        effectTag: 'dodgyDealerTrade',
      });
      break;
    case 'fuzzy-cheeks':
      // "DRAW a card and play a Hero card from your hand immediately." — not a "may".
      drawCards(s, byPlayerId, 1);
      s.promptQueue.push({
        kind: 'chooseCardsFromHand',
        playerId: byPlayerId,
        reason: 'Fuzzy Cheeks: play a Hero card from your hand immediately.',
        count: 1,
        optional: false,
        filter: 'hero',
        effectTag: 'playFreeHero',
      });
      break;
    case 'greedy-cheeks':
      for (const seat of s.seats) {
        if (seat.id !== byPlayerId && handOf(s, seat.id).length > 0) {
          s.promptQueue.push({
            kind: 'chooseCardsFromHand',
            playerId: seat.id,
            reason: `Greedy Cheeks: you must give a card from your hand to ${seatName(s, byPlayerId)}.`,
            count: 1,
            optional: false,
            filter: 'any',
            effectTag: 'greedyCheeksGive',
            toPlayerId: byPlayerId,
          });
        }
      }
      break;
    case 'lucky-bucky':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Lucky Bucky: choose a player to pull a card from (if it's a Hero, you may play it immediately).",
        optional: false,
        effectTag: 'luckyBuckyPull',
      });
      break;
    case 'mellow-dee': {
      const drawn = drawCards(s, byPlayerId, 1);
      if (drawn.length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Mellow Dee: if the card you drew is a Hero card, you may play it immediately.',
          count: 1,
          optional: true,
          filter: 'hero',
          effectTag: 'playFreeHero',
          onlyCardIds: drawn.map((c) => c.id),
          keepIfEmpty: true,
        });
      }
      break;
    }
    case 'napping-nibbles':
      pushLog(s, byPlayerId, 'Napping Nibbles did nothing and took a nap.', 'normal');
      break;
    case 'peanut':
      drawCards(s, byPlayerId, 2);
      break;
    case 'tipsy-tootie':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: 'Tipsy Tootie: choose a player to STEAL a Hero from and give Tipsy Tootie to.',
        optional: false,
        effectTag: 'tipsyTootieSwap',
        sourceHeroId: heroCard.id,
      });
      break;
    case 'calming-voice':
      s.protectedFromSteal[byPlayerId] = true;
      pushLog(s, byPlayerId, 'Calming Voice: Heroes in your Party cannot be stolen until your next turn.', 'good');
      break;
    case 'guiding-light': {
      const heroes = s.discard.filter((c) => c.type === 'hero');
      if (heroes.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Guiding Light: choose a Hero card from the discard pile to add to your hand.',
          optional: false,
          cards: heroes,
          source: 'discard',
        });
      }
      break;
    }
    case 'holy-curselifter':
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Holy Curselifter: choose a Hero in your Party whose Cursed Item returns to your hand.',
        optional: false,
        scope: 'own',
        mode: 'returnCursedItem',
      });
      break;
    case 'iron-resolve':
      s.turnBuffs.unchallengeable = true;
      pushLog(s, byPlayerId, 'Iron Resolve: your cards cannot be challenged for the rest of your turn.', 'good');
      break;
    case 'mighty-blade':
      s.protectedFromDestroy[byPlayerId] = true;
      pushLog(s, byPlayerId, 'Mighty Blade: Heroes in your Party cannot be destroyed until your next turn.', 'good');
      break;
    case 'radiant-horn': {
      const mods = s.discard.filter((c) => c.type === 'modifier');
      if (mods.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Radiant Horn: choose a Modifier card from the discard pile to add to your hand.',
          optional: false,
          cards: mods,
          source: 'discard',
        });
      }
      break;
    }
    case 'vibrant-glow':
      s.turnBuffs.rollBonus += 5;
      pushLog(s, byPlayerId, 'Vibrant Glow: +5 to all of your rolls until the end of your turn!', 'good');
      break;
    case 'wise-shield':
      s.turnBuffs.rollBonus += 3;
      pushLog(s, byPlayerId, 'Wise Shield: +3 to all of your rolls until the end of your turn!', 'good');
      break;
    case 'bullseye': {
      const top3 = s.deck.splice(0, 3);
      if (top3.length > 0) {
        s.promptQueue.push({
          kind: 'bullseyePeek',
          playerId: byPlayerId,
          cards: top3,
        });
      }
      break;
    }
    case 'hook':
      // "Play an Item card from your hand immediately and DRAW a card." — play first, then draw.
      s.promptQueue.push(
        {
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Hook: play an Item card from your hand immediately (then DRAW a card).',
          count: 1,
          optional: false,
          filter: 'item',
          effectTag: 'playFreeItem',
        },
        { kind: 'step', playerId: byPlayerId, step: { type: 'draw', count: 1 } },
      );
      break;
    case 'lookie-rookie': {
      const items = s.discard.filter((c) => c.type === 'item' || c.type === 'cursedItem');
      if (items.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Lookie Rookie: choose an Item card from the discard pile to add to your hand.',
          optional: false,
          cards: items,
          source: 'discard',
        });
      }
      break;
    }
    case 'quick-draw': {
      const drawn = drawCards(s, byPlayerId, 2);
      if (drawn.length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Quick Draw: if one of the cards you drew is an Item card, you may play it immediately.',
          count: 1,
          optional: true,
          filter: 'item',
          effectTag: 'playFreeItem',
          onlyCardIds: drawn.map((c) => c.id),
          keepIfEmpty: true,
        });
      }
      break;
    }
    case 'serious-grey':
      s.promptQueue.push(
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Serious Grey: choose a Hero card to DESTROY (then DRAW a card).',
          optional: false,
          scope: 'others',
          mode: 'destroy',
        },
        { kind: 'step', playerId: byPlayerId, step: { type: 'draw', count: 1 } },
      );
      break;
    case 'sharp-fox':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Sharp Fox: choose another player to look at their hand.",
        optional: false,
        effectTag: 'sharpFoxLook',
      });
      break;
    case 'wildshot':
      drawCards(s, byPlayerId, 3);
      if (handOf(s, byPlayerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Wildshot: drew 3 cards — now DISCARD a card.',
          count: 1,
          optional: false,
          filter: 'any',
          effectTag: 'discard',
        });
      }
      break;
    case 'wily-red': {
      const needed = Math.max(0, 7 - handOf(s, byPlayerId).length);
      if (needed > 0) drawCards(s, byPlayerId, needed);
      break;
    }
    case 'kit-napper':
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Kit Napper: choose a Hero card to STEAL.',
        optional: false,
        scope: 'others',
        mode: 'steal',
      });
      break;
    case 'meowzio':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: 'Meowzio: choose a player to STEAL a Hero from and pull a card from their hand.',
        optional: false,
        effectTag: 'meowzioSteal',
      });
      break;
    case 'plundering-puma':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: 'Plundering Puma: choose a player to pull 2 cards from (they will draw 1 card).',
        optional: false,
        effectTag: 'plunderingPumaPull',
      });
      break;
    case 'shurikitty':
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Shurikitty: choose a Hero card to DESTROY (and take its equipped Item).',
        optional: false,
        scope: 'others',
        mode: 'destroy',
        effectTag: 'shurikittyDestroy',
      });
      break;
    case 'silent-shadow':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Silent Shadow: choose another player to look at their hand and take a card.",
        optional: false,
        effectTag: 'silentShadowSteal',
      });
      break;
    case 'slippery-paws':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: 'Slippery Paws: choose another player to pull 2 cards from (then discard 1).',
        optional: false,
        effectTag: 'slipperyPawsPull',
      });
      break;
    case 'sly-pickings':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Sly Pickings: choose a player to pull a card from (if it's an Item, you may play it immediately).",
        optional: false,
        effectTag: 'slyPickingsPull',
      });
      break;
    case 'smooth-mimimeow':
      for (const seat of s.seats) {
        if (
          seat.id !== byPlayerId &&
          partyClasses(s, seat.id).has('thief') &&
          handOf(s, seat.id).length > 0
        ) {
          const oppHand = handOf(s, seat.id);
          const idx = rngInt(s.rngState, oppHand.length);
          const [pulled] = oppHand.splice(idx, 1);
          if (pulled) handOf(s, byPlayerId).push(pulled);
        }
      }
      break;
    case 'bun-bun': {
      const magics = s.discard.filter((c) => c.type === 'magic');
      if (magics.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Bun Bun: choose a Magic card from the discard pile to add to your hand.',
          optional: false,
          cards: magics,
          source: 'discard',
        });
      }
      break;
    }
    case 'buttons':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Buttons: choose a player to pull a card from (if it's a Magic card, you may play it immediately).",
        optional: false,
        effectTag: 'buttonsPull',
      });
      break;
    case 'fluffy':
      s.promptQueue.push(
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Fluffy (1 of 2): choose a Hero card to DESTROY.',
          optional: false,
          scope: 'others',
          mode: 'destroy',
        },
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Fluffy (2 of 2): choose a second Hero card to DESTROY.',
          optional: false,
          scope: 'others',
          mode: 'destroy',
        },
      );
      break;
    case 'hopper':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: 'Hopper: choose a player who must SACRIFICE a Hero card.',
        optional: false,
        effectTag: 'hopperSacrifice',
      });
      break;
    case 'snowball': {
      const drawn = drawCards(s, byPlayerId, 1);
      if (drawn.length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Snowball: if the card you drew is a Magic card, you may play it immediately and DRAW a second card.',
          count: 1,
          optional: true,
          filter: 'magic',
          effectTag: 'snowballFreeMagic',
          onlyCardIds: drawn.map((c) => c.id),
          keepIfEmpty: true,
        });
      }
      break;
    }
    case 'spooky':
      for (const seat of s.seats) {
        if (seat.id !== byPlayerId && partyOf(s, seat.id).length > 0) {
          s.promptQueue.push({
            kind: 'chooseHeroTarget',
            playerId: seat.id,
            reason: 'Spooky: you must SACRIFICE a Hero card in your Party.',
            optional: false,
            scope: 'own',
            mode: 'sacrifice',
          });
        }
      }
      break;
    case 'whiskers':
      s.promptQueue.push(
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Whiskers (1 of 2): choose a Hero card to STEAL.',
          optional: false,
          scope: 'others',
          mode: 'steal',
        },
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Whiskers (2 of 2): choose a Hero card to DESTROY.',
          optional: false,
          scope: 'others',
          mode: 'destroy',
        },
      );
      break;
    case 'wiggles':
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Wiggles: choose a Hero card to STEAL and roll to use its effect immediately.',
        optional: false,
        scope: 'others',
        mode: 'steal',
        effectTag: 'wigglesStealAndRoll',
      });
      break;

    // ========================================================================
    // Warriors & Druids — Warrior Heroes (8)
    // ========================================================================
    case 'hardened-hunter':
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Hardened Hunter: choose a Hero card to DESTROY.',
        optional: false,
        scope: 'others',
        mode: 'destroy',
      });
      break;
    case 'blinding-blade':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Blinding Blade: choose a player to return all equipped Items in their Party to your hand.",
        optional: false,
        effectTag: 'blindingBladeStealItems',
      });
      break;
    case 'tenacious-timber':
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Tenacious Timber: choose a Hero with an equipped Item to STEAL that Item into your hand.',
        optional: true,
        scope: 'any',
        mode: 'stealItem',
      });
      break;
    case 'agile-dagger':
      if (handOf(s, byPlayerId).some((c) => c.type === 'item' || c.type === 'cursedItem')) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Agile Dagger: you may play up to 2 Item cards from your hand immediately.',
          count: 2,
          upTo: true,
          optional: true,
          filter: 'item',
          effectTag: 'playFreeItemsUpTo2',
        });
      }
      break;
    case 'looting-lupo': {
      const count = Math.max(1, countPartyEquippedItems(s, byPlayerId));
      drawCards(s, byPlayerId, count);
      pushLog(s, byPlayerId, `Looting Lupo: drew ${count} card(s) for equipped Items!`, 'good');
      break;
    }
    case 'mightyvis': {
      drawCards(s, byPlayerId, 1);
      const items = s.discard.filter((c) => c.type === 'item' || c.type === 'cursedItem');
      if (items.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Mightyvis: choose an Item card from the discard pile to add to your hand.',
          optional: false,
          cards: items,
          source: 'discard',
        });
      }
      break;
    }
    case 'valiant-valor':
      s.turnBuffs.rollBonus += 2;
      drawCards(s, byPlayerId, 1);
      pushLog(s, byPlayerId, 'Valiant Valor: +2 to all rolls this turn and drew 1 card!', 'good');
      break;
    case 'wild-buck':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Wild Buck: choose a player to pull a card from (pull a 2nd if it's an Item or Modifier).",
        optional: false,
        effectTag: 'wildBuckPull',
      });
      break;

    // ========================================================================
    // Warriors & Druids — Druid Heroes (8 — rollLow: true)
    // ========================================================================
    case 'big-buckley': {
      const pool = s.discard.filter((c) => c.type === 'hero' || c.type === 'item' || c.type === 'cursedItem');
      if (pool.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Big Buckley: choose a Hero or Item card from the discard pile to add to your hand.',
          optional: false,
          cards: pool,
          source: 'discard',
        });
      }
      break;
    }
    case 'buck-omens':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Buck Omens: choose another player to look at their hand and take a Hero (or any card).",
        optional: false,
        effectTag: 'buckOmensSteal',
      });
      break;
    case 'dose-of-dette':
      drawCards(s, byPlayerId, 2);
      for (const seat of s.seats) {
        if (seat.id !== byPlayerId) {
          drawCards(s, seat.id, 1);
        }
      }
      break;
    case 'glowing-antler':
      drawCards(s, byPlayerId, 2);
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Glowing Antler: choose a Hero with an equipped Item to return that Item to its owner.',
        optional: true,
        scope: 'any',
        mode: 'bounceItem',
      });
      break;
    case 'magus-moose': {
      const magics = s.discard.filter((c) => c.type === 'magic');
      if (magics.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Magus Moose: choose a Magic card from the discard pile to play immediately.',
          optional: false,
          cards: magics,
          source: 'discardPlayMagic',
        });
      } else {
        drawCards(s, byPlayerId, 2);
      }
      break;
    }
    case 'maegisty':
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Maegisty: choose a Hero card to STEAL.',
        optional: false,
        scope: 'others',
        mode: 'steal',
      });
      break;
    case 'stagguard':
      s.turnBuffs.noOpponentModifiers = true;
      drawCards(s, byPlayerId, 1);
      pushLog(s, byPlayerId, 'Stagguard: no other player can play Modifier cards until the end of your turn!', 'good');
      break;
    case 'wishing-wing':
      drawCards(s, byPlayerId, 2);
      if (handOf(s, byPlayerId).some((c) => c.type === 'hero')) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Wishing Wing: you may play a Hero card from your hand immediately.',
          count: 1,
          optional: true,
          filter: 'hero',
          effectTag: 'playFreeHero',
        });
      }
      break;

    // ========================================================================
    // Berserkers & Necromancers — Berserker Heroes (8)
    // ========================================================================
    case 'annihilator':
      drawCards(s, byPlayerId, 1);
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Annihilator: choose a Hero card to DESTROY.',
        optional: false,
        scope: 'others',
        mode: 'destroy',
      });
      break;
    case 'brawling-spirit':
      s.promptQueue.push(
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Brawling Spirit (1 of 3): choose one of your Hero cards to SACRIFICE.',
          optional: false,
          scope: 'own',
          mode: 'sacrifice',
        },
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Brawling Spirit (2 of 3): choose a Hero card to DESTROY.',
          optional: true,
          scope: 'others',
          mode: 'destroy',
        },
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Brawling Spirit (3 of 3): choose a second Hero card to DESTROY.',
          optional: true,
          scope: 'others',
          mode: 'destroy',
        },
      );
      break;
    case 'gruesome-gladiator':
      for (const seat of s.seats) {
        if (seat.id !== byPlayerId && partyOf(s, seat.id).length > 0) {
          s.promptQueue.push({
            kind: 'chooseHeroTarget',
            playerId: seat.id,
            reason: 'Gruesome Gladiator: you must SACRIFICE a Hero card in your Party.',
            optional: false,
            scope: 'own',
            mode: 'sacrifice',
          });
        }
      }
      break;
    case 'meowntain':
      s.turnBuffs.rollBonus += 4;
      pushLog(s, byPlayerId, 'Meowntain: +4 to all of your rolls until the end of your turn!', 'good');
      break;
    case 'rabid-beast':
      if (handOf(s, byPlayerId).length <= 3) {
        drawCards(s, byPlayerId, 2);
      }
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Rabid Beast: choose a Hero card to DESTROY.',
        optional: false,
        scope: 'others',
        mode: 'destroy',
      });
      break;
    case 'roaryal-guard':
      s.protectedFromDestroy[byPlayerId] = true;
      s.protectedFromSteal[byPlayerId] = true;
      pushLog(s, byPlayerId, 'Roaryal Guard: Heroes in your Party cannot be destroyed or stolen until your next turn!', 'good');
      break;
    case 'unbridled-fury':
      s.actionPointsRemaining += 1;
      pushLog(s, byPlayerId, 'Unbridled Fury: gained +1 Action Point this turn!', 'good');
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Unbridled Fury: choose a Hero card to DESTROY.',
        optional: false,
        scope: 'others',
        mode: 'destroy',
      });
      break;
    case 'vicious-wildcat':
      drawCards(s, byPlayerId, 1);
      s.promptQueue.push(
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Vicious Wildcat (1 of 2): choose a Hero card to DESTROY.',
          optional: true,
          scope: 'others',
          mode: 'destroy',
        },
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Vicious Wildcat (2 of 2): choose a second Hero card to DESTROY.',
          optional: true,
          scope: 'others',
          mode: 'destroy',
        },
      );
      break;

    // ========================================================================
    // Berserkers & Necromancers — Necromancer Heroes (8)
    // ========================================================================
    case 'bark-hexer':
      if (handOf(s, byPlayerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Bark Hexer: DISCARD a card, then each other player must DISCARD 2 cards.',
          count: 1,
          optional: false,
          filter: 'any',
          effectTag: 'barkHexerDiscard',
        });
      }
      break;
    case 'beholden-retriever': {
      const heroes = s.discard.filter((c) => c.type === 'hero');
      if (heroes.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Beholden Retriever: choose a Hero card from the discard pile to add to your hand.',
          optional: false,
          cards: heroes,
          source: 'discard',
        });
      }
      break;
    }
    case 'bone-collector': {
      const heroes = s.discard.filter((c) => c.type === 'hero');
      if (heroes.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Bone Collector: choose a Hero card from the discard pile to bring directly into your Party.',
          optional: false,
          cards: heroes,
          source: 'discardReviveToParty',
        });
      }
      break;
    }
    case 'boston-terror': {
      drawCards(s, byPlayerId, 1);
      const pool = s.discard.filter((c) => c.type === 'magic' || c.type === 'modifier');
      if (pool.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Boston Terror: choose a Magic or Modifier card from the discard pile to add to your hand.',
          optional: false,
          cards: pool,
          source: 'discard',
        });
      }
      break;
    }
    case 'grim-pupper': {
      const heroes = s.discard.filter((c) => c.type === 'hero');
      if (heroes.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Grim Pupper: choose a Hero card from the discard pile to add to your hand.',
          optional: false,
          cards: heroes,
          source: 'discard',
        });
      }
      break;
    }
    case 'hollow-husk': {
      if (s.discard.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Hollow Husk: choose any card from the discard pile to add to your hand.',
          optional: false,
          cards: [...s.discard],
          source: 'discard',
        });
      }
      break;
    }
    case 'perfect-vessel': {
      const heroes = s.discard.filter((c) => c.type === 'hero');
      if (heroes.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Perfect Vessel: choose a Hero card from the discard pile to revive into your Party and roll immediately.',
          optional: false,
          cards: heroes,
          source: 'discardReviveAndRoll',
        });
      }
      break;
    }
    case 'shadow-saint': {
      drawCards(s, byPlayerId, 1);
      const pool = s.discard.filter((c) => c.type === 'item' || c.type === 'cursedItem' || c.type === 'magic');
      if (pool.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Shadow Saint: choose an Item or Magic card from the discard pile to add to your hand.',
          optional: false,
          cards: pool,
          source: 'discard',
        });
      }
      break;
    }

    // ========================================================================
    // Here to Sleigh — Holiday Heroes (6)
    // ========================================================================
    case 'santa-claws':
      claimNiceGift(s, byPlayerId);
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Santa Claws: choose a Hero card to DESTROY.',
        optional: true,
        scope: 'others',
        mode: 'destroy',
      });
      break;
    case 'lil-drummer-bard':
      claimNiceGift(s, byPlayerId);
      drawCards(s, byPlayerId, 2);
      break;
    case 'holly-jolly':
      claimNiceGift(s, byPlayerId);
      s.protectedFromDestroy[byPlayerId] = true;
      break;
    case 'prancer':
      claimNiceGift(s, byPlayerId);
      s.turnBuffs.rollBonus += 2;
      break;
    case 'gift-bag-bandit':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: 'Gift Bag Bandit: choose a player to steal a Nice Gift from (or claim one) and pull a card from.',
        optional: false,
        effectTag: 'giftBagBanditSteal',
      });
      break;
    case 'snow-slinger':
      claimNiceGift(s, byPlayerId);
      if (s.discard.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Snow Slinger: choose any card from the discard pile to add to your hand.',
          optional: false,
          cards: [...s.discard],
          source: 'discard',
        });
      }
      break;

    default:
      break;
  }
}

function resolveMagicEffect(s: HtsState, byPlayerId: PlayerId, card: HtsCard) {
  switch (card.kind) {
    case 'call-to-the-fallen': {
      const heroes = s.discard.filter((c) => c.type === 'hero');
      if (heroes.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Call to the Fallen: choose a Hero card from the discard pile to add to your hand.',
          optional: false,
          cards: heroes,
          source: 'discard',
        });
      }
      break;
    }
    case 'critical-boost':
      drawCards(s, byPlayerId, 3);
      if (handOf(s, byPlayerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Critical Boost: drew 3 cards — now DISCARD a card.',
          count: 1,
          optional: false,
          filter: 'any',
          effectTag: 'discard',
        });
      }
      break;
    case 'destructive-spell':
      if (handOf(s, byPlayerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Destructive Spell: DISCARD a card, then DESTROY a Hero card.',
          count: 1,
          optional: false,
          filter: 'any',
          effectTag: 'destructiveSpellDiscard',
        });
      }
      break;
    case 'enchanted-spell':
      s.turnBuffs.rollBonus += 2;
      pushLog(s, byPlayerId, 'Enchanted Spell: +2 to all of your rolls until the end of your turn!', 'good');
      break;
    case 'entangling-trap':
      if (handOf(s, byPlayerId).length >= 2) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId: byPlayerId,
          reason: 'Entangling Trap: DISCARD 2 cards, then STEAL a Hero card.',
          count: 2,
          optional: false,
          filter: 'any',
          effectTag: 'entanglingTrapDiscard',
        });
      }
      break;
    case 'forced-exchange':
      if (partyOf(s, byPlayerId).length > 0) {
        s.promptQueue.push({
          kind: 'choosePlayer',
          playerId: byPlayerId,
          reason: 'Forced Exchange: choose a player to STEAL a Hero from and give one of your Heroes to.',
          optional: false,
          effectTag: 'forcedExchangeTarget',
        });
      }
      break;
    case 'forceful-winds':
      for (const seat of s.seats) {
        for (const h of partyOf(s, seat.id)) {
          for (const item of heroEquippedItems(h)) {
            handOf(s, seat.id).push(item);
          }
          h.equippedItem = null;
          h.extraItems = [];
        }
      }
      pushLog(s, byPlayerId, 'Forceful Winds returned every equipped Item card to its owner!', 'normal');
      break;
    case 'winds-of-change':
      s.promptQueue.push(
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: "Winds of Change: choose a Hero whose equipped Item returns to its owner's hand (then DRAW a card).",
          optional: false,
          scope: 'any',
          mode: 'bounceItem',
        },
        { kind: 'step', playerId: byPlayerId, step: { type: 'draw', count: 1 } },
      );
      break;
    case 'beast-call': {
      drawCards(s, byPlayerId, 1);
      const heroes = s.discard.filter((c) => c.type === 'hero');
      if (heroes.length > 0) {
        s.promptQueue.push({
          kind: 'chooseFromPile',
          playerId: byPlayerId,
          reason: 'Beast Call: choose a Hero card from the discard pile to add to your hand.',
          optional: false,
          cards: heroes,
          source: 'discard',
        });
      }
      break;
    }
    case 'rapid-refresh': {
      const hand = handOf(s, byPlayerId);
      s.discard.push(...hand);
      s.hands[byPlayerId] = [];
      drawCards(s, byPlayerId, 5);
      pushLog(s, byPlayerId, 'Rapid Refresh: discarded hand and drew 5 new cards!', 'good');
      break;
    }
    case 'mass-sacrifice':
      drawCards(s, byPlayerId, 2);
      for (const seat of s.seats) {
        if (seat.id !== byPlayerId && partyOf(s, seat.id).length > 0) {
          s.promptQueue.push({
            kind: 'chooseHeroTarget',
            playerId: seat.id,
            reason: 'Mass Sacrifice: you must SACRIFICE a Hero card in your Party.',
            optional: false,
            scope: 'own',
            mode: 'sacrifice',
          });
        }
      }
      break;
    case 'holiday-cheer':
      claimNiceGift(s, byPlayerId);
      drawCards(s, byPlayerId, 2);
      break;
    default:
      break;
  }
}

// ============================================================================
// Action Handlers
// ============================================================================

function requireTurnAction(s: HtsState, playerId: PlayerId, apCost: number) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot act during ${s.subPhase}`);
  if (playerId !== s.turnPlayerId) throw new Error('not your turn');
  if (s.actionPointsRemaining < apCost) throw new Error(`need ${apCost} AP (have ${s.actionPointsRemaining})`);
}

/**
 * Leader draft (setup only). "Your Party Leader card remains in your Party for
 * the duration of the game" — there is no way to change it afterwards.
 */
function handleChoosePartyLeader(s: HtsState, a: Extract<HtsAction, { type: 'choosePartyLeader' }>) {
  const draft = s.leaderDraft;
  if (s.subPhase !== 'choosingLeaders' || !draft) throw new Error('Party Leaders are chosen at the start of the game');
  if (draft.order[0] !== a.playerId) throw new Error('not your pick');
  const leader = draft.pool.find((c) => c.kind === a.leaderKind);
  if (!leader) throw new Error('that Party Leader is not available');
  assignLeader(s, a.playerId, leader);
  autoPickForcedLeader(s);
}

function handleDrawCard(s: HtsState, a: Extract<HtsAction, { type: 'drawCard' }>) {
  requireTurnAction(s, a.playerId, 1);
  s.actionPointsRemaining -= 1;
  drawCards(s, a.playerId, 1);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} spent 1 AP to draw a card.`, 'normal');
  advanceFlow(s);
}

function handlePlayHero(s: HtsState, a: Extract<HtsAction, { type: 'playHero' }>) {
  requireTurnAction(s, a.playerId, 1);
  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex((c) => c.id === a.cardId);
  if (idx < 0) throw new Error('card not in hand');
  const card = hand[idx]!;
  if (card.type !== 'hero') throw new Error('not a Hero card');

  hand.splice(idx, 1);
  s.actionPointsRemaining -= 1;
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} played Hero ${card.name}.`, 'normal');
  beginPlay(s, a.playerId, card);
}

function handleEquipItem(s: HtsState, a: Extract<HtsAction, { type: 'equipItem' }>) {
  requireTurnAction(s, a.playerId, 1);
  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex((c) => c.id === a.cardId);
  if (idx < 0) throw new Error('item card not in hand');
  const card = hand[idx]!;
  if (card.type !== 'item' && card.type !== 'cursedItem') throw new Error('not an Item card');

  const hero = partyOf(s, a.targetPlayerId).find((h) => h.card.id === a.heroCardId);
  if (!hero) throw new Error('target Hero not found');
  if (!canEquipItemToHero(hero, card)) throw new Error('target Hero cannot equip this Item');

  s.actionPointsRemaining -= 1;
  playItemFromHand(s, a.playerId, card.id, a.targetPlayerId, a.heroCardId);
}

function handlePlayMagic(s: HtsState, a: Extract<HtsAction, { type: 'playMagic' }>) {
  requireTurnAction(s, a.playerId, 1);
  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex((c) => c.id === a.cardId);
  if (idx < 0) throw new Error('magic card not in hand');
  const card = hand[idx]!;
  if (card.type !== 'magic') throw new Error('not a Magic card');

  hand.splice(idx, 1);
  s.actionPointsRemaining -= 1;
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} played Magic card ${card.name}.`, 'normal');
  beginPlay(s, a.playerId, card);
}

function handleUseHeroAbility(s: HtsState, a: Extract<HtsAction, { type: 'useHeroAbility' }>) {
  requireTurnAction(s, a.playerId, 1);
  const hero = partyOf(s, a.playerId).find((h) => h.card.id === a.heroCardId);
  if (!hero) throw new Error('Hero not in your Party');
  if (hero.usedThisTurn) throw new Error('Hero ability already used this turn');
  if (heroHasItemKind(hero, 'sealing-key')) throw new Error('Sealing Key prevents using this Hero ability');

  s.actionPointsRemaining -= 1;
  hero.usedThisTurn = true;

  s.pendingRoll = {
    byPlayerId: a.playerId,
    reason: 'heroAbility',
    dice: a.dice,
    challengerId: null,
    challengerDice: null,
    sourceCardId: hero.card.id,
    threshold: hero.card.abilityThreshold ?? 7,
    rollLow: hero.card.rollLow,
    modifiers: [],
    responderQueue: [],
  };
  openOrResolveRoll(s);
}

function handleAttackMonster(s: HtsState, a: Extract<HtsAction, { type: 'attackMonster' }>) {
  requireTurnAction(s, a.playerId, 2);
  const monster = s.monsterRow.find((m) => m.card.id === a.monsterCardId);
  if (!monster) throw new Error('Monster not in monster row');
  if (!canAttackMonster(s, a.playerId, monster)) {
    throw new Error(`Party does not meet requirement (${monster.requirementText})`);
  }

  s.actionPointsRemaining -= 2;
  s.pendingRoll = {
    byPlayerId: a.playerId,
    reason: 'monsterAttack',
    dice: a.dice,
    challengerId: null,
    challengerDice: null,
    sourceCardId: monster.card.id,
    threshold: monster.slayThreshold,
    rollLow: monster.slayOnLow,
    modifiers: [],
    responderQueue: [],
  };
  openOrResolveRoll(s);
}

function handleShadowClawPull(s: HtsState, a: Extract<HtsAction, { type: 'shadowClawPull' }>) {
  requireTurnAction(s, a.playerId, 1);
  if (s.partyLeaders[a.playerId]?.kind !== 'leader-shadow-claw') {
    throw new Error('your Party Leader is not The Shadow Claw');
  }
  if (s.turnBuffs.shadowClawUsed) {
    throw new Error('The Shadow Claw ability was already used this turn');
  }
  if (a.targetPlayerId === a.playerId) throw new Error('must target another player');
  const oppHand = handOf(s, a.targetPlayerId);
  if (oppHand.length === 0) throw new Error('target player has no cards in hand');

  s.actionPointsRemaining -= 1;
  s.turnBuffs.shadowClawUsed = true;
  const idx = rngInt(s.rngState, oppHand.length);
  const [pulled] = oppHand.splice(idx, 1);
  if (pulled) handOf(s, a.playerId).push(pulled);
  pushLog(s, a.playerId, `The Shadow Claw: ${seatName(s, a.playerId)} pulled a card from ${seatName(s, a.targetPlayerId)}'s hand.`, 'good');
  advanceFlow(s);
}

function handleNobleShamanAdjust(s: HtsState, a: Extract<HtsAction, { type: 'nobleShamanAdjust' }>) {
  if (s.partyLeaders[a.playerId]?.kind !== 'leader-noble-shaman') {
    throw new Error('your Party Leader is not The Noble Shaman');
  }
  if (!canUseNobleShaman(s, a.playerId)) throw new Error('The Noble Shaman was already used this turn');
  if (a.delta !== -1) throw new Error('The Noble Shaman gives -1 to a roll');
  if (s.subPhase !== 'awaitingModifiers' || !s.pendingRoll) throw new Error('The Noble Shaman answers a roll');
  const r = s.pendingRoll;
  const side = a.targetSide === 'challenger' && r.challengerId ? 'challenger' : 'actor';
  s.turnBuffs.nobleShamanUsed = true;
  r.modifiers.push({ playerId: a.playerId, card: s.partyLeaders[a.playerId]!, amount: -1, targetSide: side });
  const whose = side === 'challenger' ? r.challengerId : r.byPlayerId;
  pushLog(s, a.playerId, `The Noble Shaman: ${seatName(s, a.playerId)} gives ${seatName(s, whose)}'s roll -1.`, 'normal');
  openOrResolveRoll(s);
}

function handleGnawingDreadSearch(s: HtsState, a: Extract<HtsAction, { type: 'gnawingDreadSearch' }>) {
  requireTurnAction(s, a.playerId, 2);
  if (s.partyLeaders[a.playerId]?.kind !== 'leader-gnawing-dread') {
    throw new Error('your Party Leader is not The Gnawing Dread');
  }
  if (s.turnBuffs.gnawingDreadUsed) {
    throw new Error('The Gnawing Dread ability was already used this turn');
  }
  if (s.discard.length === 0) {
    throw new Error('the discard pile is empty');
  }

  s.actionPointsRemaining -= 2;
  s.turnBuffs.gnawingDreadUsed = true;
  s.promptQueue.push({
    kind: 'chooseFromPile',
    playerId: a.playerId,
    reason: 'The Gnawing Dread: choose any card from the discard pile to add to your hand.',
    optional: false,
    cards: [...s.discard],
    source: 'discard',
  });
  pushLog(s, a.playerId, `The Gnawing Dread: ${seatName(s, a.playerId)} spent 2 AP to search the discard pile!`, 'good');
  advanceFlow(s);
}

function handleClaimHolidayGift(s: HtsState, a: Extract<HtsAction, { type: 'claimHolidayGift' }>) {
  requireTurnAction(s, a.playerId, 2);
  if (!s.config.expansions.includes('here-to-sleigh')) {
    throw new Error('Here to Sleigh expansion is not enabled');
  }
  if (partyOf(s, a.playerId).length < 1) {
    throw new Error('need at least 1 Hero in your Party to deliver a Holiday Gift');
  }

  s.actionPointsRemaining -= 2;
  claimNiceGift(s, a.playerId);
  advanceFlow(s);
}

function handleDiscardAndRedraw(s: HtsState, a: Extract<HtsAction, { type: 'discardAndRedraw' }>) {
  requireTurnAction(s, a.playerId, 3);
  s.actionPointsRemaining -= 3;
  const hand = handOf(s, a.playerId);
  s.discard.push(...hand);
  s.hands[a.playerId] = [];
  drawCards(s, a.playerId, 5);
  pushLog(s, a.playerId, `${seatName(s, a.playerId)} spent 3 AP to discard their hand and draw 5 new cards.`, 'normal');
  advanceFlow(s);
}

function handlePlayChallenge(s: HtsState, a: Extract<HtsAction, { type: 'playChallenge' }>) {
  if (s.subPhase !== 'awaitingChallenge') throw new Error('no play to Challenge');
  const p = s.pendingPlay;
  if (!p) throw new Error('no pendingPlay');
  if (!p.responderQueue.includes(a.playerId)) throw new Error('you cannot Challenge this play');

  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex((c) => c.id === a.cardId && c.type === 'challenge');
  if (idx < 0) throw new Error('Challenge card not in hand');
  const [challengeCard] = hand.splice(idx, 1);
  if (challengeCard) s.discard.push(challengeCard);

  pushLog(s, a.playerId, `⚔️ ${seatName(s, a.playerId)} CHALLENGED ${seatName(s, p.byPlayerId)}'s ${p.card.name}!`, 'danger');

  // Bloodwing trophy check on the challenged player
  if (hasTrophy(s, p.byPlayerId, 'monster-bloodwing') && handOf(s, a.playerId).length > 0) {
    s.promptQueue.push({
      kind: 'chooseCardsFromHand',
      playerId: a.playerId,
      reason: `Bloodwing: you challenged ${seatName(s, p.byPlayerId)} and must DISCARD a card.`,
      count: 1,
      optional: false,
      filter: 'any',
      effectTag: 'discard',
    });
  }

  s.pendingRoll = {
    byPlayerId: p.byPlayerId,
    reason: 'challengeDuel',
    dice: a.actorDice,
    challengerId: a.playerId,
    challengerDice: a.challengerDice,
    sourceCardId: p.card.id,
    threshold: 0,
    modifiers: [],
    responderQueue: [],
  };
  openOrResolveRoll(s);
}

function handleDeclineChallenge(s: HtsState, a: Extract<HtsAction, { type: 'declineChallenge' }>) {
  if (s.subPhase !== 'awaitingChallenge') throw new Error('nothing to decline');
  const p = s.pendingPlay;
  if (!p) throw new Error('no pendingPlay');
  if (p.responderQueue[0] !== a.playerId) throw new Error('not your turn to respond');

  p.responderQueue.shift();
  const next = p.responderQueue[0];
  if (!next) {
    resolvePendingPlay(s, false);
    return;
  }
  s.activePlayerId = next;
}

function handlePlayModifier(s: HtsState, a: Extract<HtsAction, { type: 'playModifier' }>) {
  if (s.subPhase !== 'awaitingModifiers') throw new Error('no roll open for Modifiers');
  const r = s.pendingRoll;
  if (!r) throw new Error('no pendingRoll');

  if (!canPlayModifiers(s, a.playerId)) throw new Error('no other player can play Modifier cards this turn');
  const hand = handOf(s, a.playerId);
  const idx = hand.findIndex((c) => c.id === a.cardId && c.type === 'modifier');
  if (idx < 0) throw new Error('Modifier card not in hand');
  const card = hand[idx]!;
  if (!card.modifierChoices?.includes(a.chosenValue)) {
    throw new Error('invalid modifier value for this card');
  }

  hand.splice(idx, 1);

  let amount = a.chosenValue;
  if (s.partyLeaders[a.playerId]?.kind === 'leader-protecting-horn') {
    const delta = a.protectingHornDelta ?? (amount >= 0 ? 1 : -1);
    amount += delta;
  }

  r.modifiers.push({
    playerId: a.playerId,
    card,
    amount,
    targetSide: a.targetSide ?? 'actor',
  });

  // Crowned Serpent check: any player with Crowned Serpent draws 1 card when any Modifier is played
  for (const seat of s.seats) {
    if (hasTrophy(s, seat.id, 'monster-crowned-serpent')) {
      drawCards(s, seat.id, 1);
    }
  }

  pushLog(
    s,
    a.playerId,
    `${seatName(s, a.playerId)} played ${card.name} (${amount >= 0 ? `+${amount}` : amount})!`,
    amount >= 0 ? 'good' : 'danger',
  );

  openOrResolveRoll(s);
}

function handleDeclineModifier(s: HtsState, a: Extract<HtsAction, { type: 'declineModifier' }>) {
  if (s.subPhase !== 'awaitingModifiers') throw new Error('no roll open');
  const r = s.pendingRoll;
  if (!r) throw new Error('no pendingRoll');
  if (r.responderQueue[0] !== a.playerId) throw new Error('not your turn to respond');

  r.responderQueue.shift();
  const next = r.responderQueue[0];
  if (!next) {
    resolvePendingRoll(s);
    return;
  }
  s.activePlayerId = next;
}

function handleResolvePrompt(s: HtsState, a: Extract<HtsAction, { type: 'resolvePrompt' }>) {
  if (s.subPhase !== 'awaitingPrompt') throw new Error('no prompt open');
  const prompt = s.promptQueue[0];
  if (!prompt) throw new Error('prompt queue empty');
  if (a.playerId !== prompt.playerId) throw new Error('not your prompt');
  if (prompt.kind === 'step') throw new Error('nothing to decide');

  s.promptQueue.shift();

  switch (prompt.kind) {
    case 'rollEnteredHero': {
      if (a.decline || !a.dice) {
        advanceFlow(s);
        return;
      }
      const hero = partyOf(s, prompt.playerId).find((h) => h.card.id === prompt.heroCard.id);
      if (hero && !hero.usedThisTurn && !heroHasItemKind(hero, 'sealing-key')) {
        hero.usedThisTurn = true;
        s.pendingRoll = {
          byPlayerId: prompt.playerId,
          reason: 'heroAbility',
          dice: a.dice,
          challengerId: null,
          challengerDice: null,
          sourceCardId: hero.card.id,
          threshold: hero.card.abilityThreshold ?? 7,
          rollLow: hero.card.rollLow,
          modifiers: [],
          responderQueue: [],
        };
        openOrResolveRoll(s);
        return;
      }
      advanceFlow(s);
      return;
    }

    case 'chooseHeroTarget': {
      if (a.decline) {
        if (!prompt.optional) throw new Error('cannot decline mandatory Hero target');
        advanceFlow(s);
        return;
      }
      const valid = validHeroTargets(s, prompt);
      const target = valid.find((v) => v.hero.card.id === a.targetCardId);
      if (!target) throw new Error('invalid Hero target');

      if (prompt.mode === 'equipItem') {
        // Played from hand onto the chosen Hero — so it can be Challenged.
        playItemFromHand(s, prompt.playerId, prompt.itemCardId!, target.ownerId, target.hero.card.id);
        return;
      }
      if (prompt.mode === 'bounceItem') {
        const removed = removeItemFromHero(target.hero, () => true);
        if (removed) {
          handOf(s, target.ownerId).push(removed);
          pushLog(s, prompt.playerId, `${removed.name} returned to ${seatName(s, target.ownerId)}'s hand.`, 'normal');
        }
      } else if (prompt.mode === 'returnCursedItem') {
        const removed = removeItemFromHero(target.hero, (i) => i.type === 'cursedItem');
        if (removed) {
          handOf(s, prompt.playerId).push(removed);
          pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} lifted ${removed.name} off ${target.hero.card.name}.`, 'good');
        }
      } else if (prompt.mode === 'stealItem') {
        const removed = removeItemFromHero(target.hero, () => true);
        if (removed) {
          handOf(s, prompt.playerId).push(removed);
          pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} stole ${removed.name} from ${target.hero.card.name}!`, 'good');
        }
      } else if (prompt.mode === 'swapGive' && prompt.specificPlayerId) {
        removeHeroFromParty(s, target.ownerId, target.hero.card.id, 'move', {
          toPlayerId: prompt.specificPlayerId,
        });
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} moved ${target.hero.card.name} to ${seatName(s, prompt.specificPlayerId)}'s Party.`, 'normal');
      } else if (prompt.mode === 'steal') {
        removeHeroFromParty(s, target.ownerId, target.hero.card.id, 'steal', {
          byPlayerId: prompt.playerId,
          toPlayerId: prompt.playerId,
        });
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} stole ${target.hero.card.name} from ${seatName(s, target.ownerId)}!`, 'good');
        if (prompt.effectTag === 'wigglesStealAndRoll') {
          s.promptQueue.unshift({
            kind: 'rollEnteredHero',
            playerId: prompt.playerId,
            heroCard: target.hero.card,
          });
        }
      } else if (prompt.mode === 'sacrifice') {
        const res = removeHeroFromParty(s, target.ownerId, target.hero.card.id, 'sacrifice', {
          byPlayerId: prompt.playerId,
        });
        if (res === 'done') pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} sacrificed ${target.hero.card.name}.`, 'normal');
      } else if (prompt.mode === 'destroy') {
        const res = removeHeroFromParty(s, target.ownerId, target.hero.card.id, 'destroy', {
          byPlayerId: prompt.playerId,
          stealEquippedItemToHand: prompt.effectTag === 'shurikittyDestroy' ? prompt.playerId : undefined,
        });
        if (res === 'done') pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} destroyed ${target.hero.card.name}!`, 'danger');
      }

      advanceFlow(s);
      return;
    }

    case 'chooseCardsFromHand': {
      if (a.decline) {
        if (!prompt.optional) throw new Error('cannot decline mandatory hand choice');
        advanceFlow(s);
        return;
      }
      const valid = validHandCardsForPrompt(s, prompt);
      const ids = a.cardIds ?? [];
      if (new Set(ids).size !== ids.length) throw new Error('duplicate card');
      if (ids.some((id) => !valid.some((c) => c.id === id))) throw new Error('that card cannot be chosen');
      if (prompt.upTo) {
        if (ids.length < 1 || ids.length > prompt.count) throw new Error('invalid card count');
      } else {
        const needed = Math.min(prompt.count, valid.length);
        if (ids.length !== needed) throw new Error(`must choose ${needed} card(s)`);
      }

      // Items stay in hand until their Hero is picked: they are played (and
      // can be Challenged) only once they have somewhere to go.
      if (prompt.effectTag === 'playFreeItem' || prompt.effectTag === 'playFreeItemsUpTo2') {
        const hand = handOf(s, prompt.playerId);
        for (const id of [...ids].reverse()) {
          const item = hand.find((c) => c.id === id)!;
          queueEquipTarget(s, prompt.playerId, item, true);
        }
        advanceFlow(s);
        return;
      }

      const hand = handOf(s, prompt.playerId);
      const chosen: HtsCard[] = [];
      for (const id of ids) {
        const idx = hand.findIndex((c) => c.id === id);
        if (idx < 0) throw new Error('card not in hand');
        chosen.push(hand.splice(idx, 1)[0]!);
      }

      if (prompt.effectTag === 'playFreeHero') {
        const heroCard = chosen[0];
        if (heroCard) {
          pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} played Hero ${heroCard.name}.`, 'normal');
          beginPlay(s, prompt.playerId, heroCard);
          return;
        }
      } else if (prompt.effectTag === 'playFreeMagic' || prompt.effectTag === 'snowballFreeMagic') {
        const magic = chosen[0];
        if (magic) {
          if (prompt.effectTag === 'snowballFreeMagic') {
            s.promptQueue.unshift({ kind: 'step', playerId: prompt.playerId, step: { type: 'draw', count: 1 } });
          }
          pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} played Magic card ${magic.name}.`, 'normal');
          beginPlay(s, prompt.playerId, magic);
          return;
        }
      } else if (prompt.effectTag === 'greedyCheeksGive' && prompt.toPlayerId) {
        handOf(s, prompt.toPlayerId).push(...chosen);
      } else if (prompt.effectTag === 'bearyWiseDiscard') {
        s.discard.push(...chosen);
        s.bearyWisePool.push(...chosen);
        if (prompt.toPlayerId && s.bearyWisePool.length > 0) {
          s.promptQueue.unshift({
            kind: 'chooseFromPile',
            playerId: prompt.toPlayerId,
            reason: 'Beary Wise: choose one of the discarded cards to add to your hand.',
            optional: false,
            cards: [...s.bearyWisePool],
            source: 'bearyWisePool',
          });
          s.bearyWisePool = [];
        }
      } else {
        s.discard.push(...chosen);
        if (prompt.effectTag === 'qiBearDiscard') {
          // "For each card discarded, DESTROY a Hero card."
          for (let i = 0; i < chosen.length; i++) {
            s.promptQueue.unshift({
              kind: 'chooseHeroTarget',
              playerId: prompt.playerId,
              reason: `Qi Bear (${chosen.length - i} of ${chosen.length}): choose a Hero card to DESTROY.`,
              optional: false,
              scope: 'others',
              mode: 'destroy',
            });
          }
        } else if (prompt.effectTag === 'barkHexerDiscard') {
          for (const seat of s.seats) {
            if (seat.id !== prompt.playerId && handOf(s, seat.id).length > 0) {
              s.promptQueue.push({
                kind: 'chooseCardsFromHand',
                playerId: seat.id,
                reason: 'Bark Hexer: you must DISCARD 2 cards.',
                count: Math.min(2, handOf(s, seat.id).length),
                optional: false,
                filter: 'any',
                effectTag: 'discard',
              });
            }
          }
        } else if (prompt.effectTag === 'destructiveSpellDiscard') {
          s.promptQueue.unshift({
            kind: 'chooseHeroTarget',
            playerId: prompt.playerId,
            reason: 'Destructive Spell: choose a Hero card to DESTROY.',
            optional: false,
            scope: 'others',
            mode: 'destroy',
          });
        } else if (prompt.effectTag === 'entanglingTrapDiscard') {
          s.promptQueue.unshift({
            kind: 'chooseHeroTarget',
            playerId: prompt.playerId,
            reason: 'Entangling Trap: choose a Hero card to STEAL.',
            optional: false,
            scope: 'others',
            mode: 'steal',
          });
        }
      }

      advanceFlow(s);
      return;
    }

    case 'choosePlayer': {
      const targetId = a.targetPlayerId;
      if (!targetId || targetId === prompt.playerId || !s.seats.some((st) => st.id === targetId)) {
        throw new Error('invalid target player');
      }
      const oppHand = handOf(s, targetId);

      const pullOne = (): HtsCard | null => {
        if (oppHand.length === 0) return null;
        const idx = rngInt(s.rngState, oppHand.length);
        const [pulled] = oppHand.splice(idx, 1);
        if (pulled) handOf(s, prompt.playerId).push(pulled);
        return pulled ?? null;
      };
      /** "If that card is a <type>, you may play it immediately" — always asked, so the prompt doesn't reveal the card. */
      const mayPlayPulled = (card: HtsCard | null, filter: 'hero' | 'item' | 'magic', name: string) => {
        if (!card) return;
        const label = filter === 'hero' ? 'a Hero' : filter === 'item' ? 'an Item' : 'a Magic';
        s.promptQueue.unshift({
          kind: 'chooseCardsFromHand',
          playerId: prompt.playerId,
          reason: `${name}: if the card you pulled is ${label} card, you may play it immediately.`,
          count: 1,
          optional: true,
          filter,
          effectTag: filter === 'hero' ? 'playFreeHero' : filter === 'item' ? 'playFreeItem' : 'playFreeMagic',
          onlyCardIds: [card.id],
          keepIfEmpty: true,
        });
      };

      if (prompt.effectTag === 'bearClawPull') {
        const first = pullOne();
        if (first?.type === 'hero') pullOne();
      } else if (prompt.effectTag === 'furyKnucklePull') {
        const first = pullOne();
        if (first?.type === 'challenge') pullOne();
      } else if (prompt.effectTag === 'wildBuckPull') {
        const first = pullOne();
        if (first && (first.type === 'item' || first.type === 'cursedItem' || first.type === 'modifier')) {
          pullOne();
        }
      } else if (prompt.effectTag === 'luckyBuckyPull') {
        mayPlayPulled(pullOne(), 'hero', 'Lucky Bucky');
      } else if (prompt.effectTag === 'buttonsPull') {
        mayPlayPulled(pullOne(), 'magic', 'Buttons');
      } else if (prompt.effectTag === 'slyPickingsPull') {
        mayPlayPulled(pullOne(), 'item', 'Sly Pickings');
      } else if (prompt.effectTag === 'plunderingPumaPull') {
        const got = [pullOne(), pullOne()].filter((c): c is HtsCard => !!c);
        pushLog(s, prompt.playerId, `Plundering Puma: ${seatName(s, prompt.playerId)} pulled ${got.length} card(s) from ${seatName(s, targetId)}.`, 'normal');
        // "That player may DRAW a card." — their call.
        s.promptQueue.unshift({
          kind: 'confirm',
          playerId: targetId,
          reason: `Plundering Puma: ${seatName(s, prompt.playerId)} pulled cards from your hand. You may DRAW a card.`,
          effectTag: 'plunderingPumaDraw',
        });
      } else if (prompt.effectTag === 'slipperyPawsPull') {
        const pulled = [pullOne(), pullOne()].filter((c): c is HtsCard => !!c);
        if (pulled.length > 0) {
          // "…then DISCARD one of those cards."
          s.promptQueue.unshift({
            kind: 'chooseCardsFromHand',
            playerId: prompt.playerId,
            reason: 'Slippery Paws: DISCARD one of the cards you pulled.',
            count: 1,
            optional: false,
            filter: 'any',
            effectTag: 'slipperyPawsDiscard',
            onlyCardIds: pulled.map((c) => c.id),
          });
        }
      } else if (prompt.effectTag === 'dodgyDealerTrade') {
        const mine = handOf(s, prompt.playerId);
        s.hands[prompt.playerId] = oppHand;
        s.hands[targetId] = mine;
      } else if (prompt.effectTag === 'heavyBearDiscard' && oppHand.length > 0) {
        s.promptQueue.unshift({
          kind: 'chooseCardsFromHand',
          playerId: targetId,
          reason: 'Heavy Bear: you must DISCARD 2 cards.',
          count: Math.min(2, oppHand.length),
          optional: false,
          filter: 'any',
          effectTag: 'discard',
        });
      } else if (prompt.effectTag === 'hopperSacrifice' && partyOf(s, targetId).length > 0) {
        s.promptQueue.unshift({
          kind: 'chooseHeroTarget',
          playerId: targetId,
          reason: 'Hopper: you must SACRIFICE a Hero card.',
          optional: false,
          scope: 'own',
          mode: 'sacrifice',
        });
      } else if (prompt.effectTag === 'sharpFoxLook') {
        s.promptQueue.unshift({
          kind: 'peekHandAck',
          playerId: prompt.playerId,
          targetPlayerId: targetId,
          cards: [...oppHand],
        });
      } else if (prompt.effectTag === 'silentShadowSteal' || prompt.effectTag === 'buckOmensSteal') {
        if (oppHand.length > 0) {
          s.promptQueue.unshift({
            kind: 'chooseFromPile',
            playerId: prompt.playerId,
            reason: `${prompt.effectTag === 'buckOmensSteal' ? 'Buck Omens' : 'Silent Shadow'}: choose a card from ${seatName(s, targetId)}'s hand to take.`,
            optional: false,
            cards: [...oppHand],
            source: 'opponentHand',
            opponentId: targetId,
          });
        }
      } else if (prompt.effectTag === 'blindingBladeStealItems') {
        for (const h of partyOf(s, targetId)) {
          for (const item of heroEquippedItems(h)) {
            handOf(s, prompt.playerId).push(item);
          }
          h.equippedItem = null;
          h.extraItems = [];
        }
        pushLog(s, prompt.playerId, `Blinding Blade: returned all equipped Items from ${seatName(s, targetId)}'s Party to ${seatName(s, prompt.playerId)}'s hand!`, 'good');
      } else if (prompt.effectTag === 'giftBagBanditSteal') {
        pullOne();
        const targetGifts = niceGiftsOf(s, targetId);
        if (targetGifts.length > 0) {
          const stolenGift = targetGifts.pop()!;
          niceGiftsOf(s, prompt.playerId).push(stolenGift);
          pushLog(s, prompt.playerId, `Gift Bag Bandit: stole ${stolenGift.name} from ${seatName(s, targetId)}!`, 'good');
        } else {
          claimNiceGift(s, prompt.playerId);
        }
      } else if (prompt.effectTag === 'tipsyTootieSwap' && prompt.sourceHeroId) {
        // "STEAL a Hero card from that player's Party and move Tipsy Tootie to
        // that player's Party" — steal first (so Tootie can't be the one
        // stolen back), then she moves.
        s.promptQueue.unshift(
          {
            kind: 'chooseHeroTarget',
            playerId: prompt.playerId,
            reason: `Tipsy Tootie: choose a Hero in ${seatName(s, targetId)}'s Party to STEAL.`,
            optional: false,
            scope: 'specificPlayer',
            specificPlayerId: targetId,
            mode: 'steal',
            sourceHeroId: prompt.sourceHeroId,
          },
          {
            kind: 'step',
            playerId: prompt.playerId,
            step: { type: 'moveHero', heroCardId: prompt.sourceHeroId, fromPlayerId: prompt.playerId, toPlayerId: targetId },
          },
        );
      } else if (prompt.effectTag === 'meowzioSteal') {
        pullOne();
        s.promptQueue.unshift({
          kind: 'chooseHeroTarget',
          playerId: prompt.playerId,
          reason: `Meowzio: choose a Hero in ${seatName(s, targetId)}'s Party to STEAL.`,
          optional: false,
          scope: 'specificPlayer',
          specificPlayerId: targetId,
          mode: 'steal',
        });
      } else if (prompt.effectTag === 'forcedExchangeTarget') {
        s.promptQueue.unshift(
          {
            kind: 'chooseHeroTarget',
            playerId: prompt.playerId,
            reason: `Forced Exchange (1 of 2): choose a Hero in ${seatName(s, targetId)}'s Party to STEAL.`,
            optional: false,
            scope: 'specificPlayer',
            specificPlayerId: targetId,
            mode: 'steal',
          },
          {
            kind: 'chooseHeroTarget',
            playerId: prompt.playerId,
            reason: `Forced Exchange (2 of 2): choose a Hero in your Party to move to ${seatName(s, targetId)}'s Party.`,
            optional: false,
            scope: 'own',
            specificPlayerId: targetId,
            mode: 'swapGive',
          },
        );
      }

      advanceFlow(s);
      return;
    }

    case 'chooseFromPile': {
      const chosen = prompt.cards.find((c) => c.id === a.targetCardId);
      if (!chosen) throw new Error('invalid card selection');

      if (prompt.source === 'discard' || prompt.source === 'bearyWisePool') {
        const dIdx = s.discard.findIndex((c) => c.id === chosen.id);
        if (dIdx >= 0) s.discard.splice(dIdx, 1);
        handOf(s, prompt.playerId).push(chosen);
      } else if (prompt.source === 'discardReviveToParty' || prompt.source === 'discardReviveAndRoll') {
        const dIdx = s.discard.findIndex((c) => c.id === chosen.id);
        if (dIdx >= 0) s.discard.splice(dIdx, 1);
        partyOf(s, prompt.playerId).push({
          card: chosen,
          equippedItem: null,
          usedThisTurn: false,
        });
        pushLog(s, prompt.playerId, `Revived ${chosen.name} from the discard pile directly into ${seatName(s, prompt.playerId)}'s Party!`, 'good');
        if (
          prompt.source === 'discardReviveAndRoll' ||
          hasTrophy(s, prompt.playerId, 'monster-clawed-nightmare')
        ) {
          s.promptQueue.unshift({
            kind: 'rollEnteredHero',
            playerId: prompt.playerId,
            heroCard: chosen,
          });
        }
      } else if (prompt.source === 'discardPlayMagic') {
        resolveMagicEffect(s, prompt.playerId, chosen);
      } else if (prompt.source === 'opponentHand' && prompt.opponentId) {
        const oppHand = handOf(s, prompt.opponentId);
        const oIdx = oppHand.findIndex((c) => c.id === chosen.id);
        if (oIdx >= 0) oppHand.splice(oIdx, 1);
        handOf(s, prompt.playerId).push(chosen);
      }

      advanceFlow(s);
      return;
    }

    case 'bullseyePeek': {
      const pickId = a.bullseyePickId ?? a.targetCardId;
      const picked = prompt.cards.find((c) => c.id === pickId);
      if (!picked) throw new Error('must pick one of the top 3 cards');
      handOf(s, prompt.playerId).push(picked);
      const rest = prompt.cards.filter((c) => c.id !== picked.id);
      const order = a.bullseyeTopOrder;
      const ordered = order && order.length === rest.length ? order.map((id) => rest.find((c) => c.id === id)) : null;
      // "…return the other two to the top of the deck in any order."
      s.deck.unshift(...(ordered && ordered.every((c) => !!c) && new Set(order).size === rest.length ? (ordered as HtsCard[]) : rest));
      advanceFlow(s);
      return;
    }

    case 'peekHandAck': {
      advanceFlow(s);
      return;
    }

    case 'corruptedSabretoothChoice': {
      if (a.decline) {
        const res = removeHeroFromParty(s, prompt.ownerId, prompt.heroCardId, 'destroy', {
          byPlayerId: prompt.playerId,
          skipSabretoothCheck: true,
          stealEquippedItemToHand: prompt.stealItemToHand ? prompt.playerId : undefined,
        });
        if (res === 'done') pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} destroyed the Hero.`, 'danger');
      } else {
        removeHeroFromParty(s, prompt.ownerId, prompt.heroCardId, 'steal', {
          byPlayerId: prompt.playerId,
          toPlayerId: prompt.playerId,
        });
        pushLog(s, prompt.playerId, `Corrupted Sabretooth: ${seatName(s, prompt.playerId)} STOLE the Hero instead of destroying it!`, 'good');
      }
      advanceFlow(s);
      return;
    }

    case 'confirm': {
      if (prompt.effectTag === 'plunderingPumaDraw' && !a.decline) {
        drawCards(s, prompt.playerId, 1);
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} drew a card.`, 'normal');
      }
      advanceFlow(s);
      return;
    }
  }
}

function handleEndTurn(s: HtsState, a: Extract<HtsAction, { type: 'endTurn' }>) {
  if (s.subPhase !== 'awaitingAction') throw new Error(`cannot end turn during ${s.subPhase}`);
  if (a.playerId !== s.turnPlayerId) throw new Error('not your turn');
  // No hand limit in Here to Slay: the rulebook's turn simply ends.
  finishTurnAdvance(s);
}

function finishTurnAdvance(s: HtsState) {
  if (checkEndOfTurnWin(s)) return;

  // "Once per turn" is per turn, whoever's Party the Hero is in by now.
  for (const seat of s.seats) {
    for (const h of partyOf(s, seat.id)) h.usedThisTurn = false;
  }

  const idx = s.seats.findIndex((st) => st.id === s.turnPlayerId);
  const next = s.seats[(idx + 1) % s.seats.length]!;
  s.turnPlayerId = next.id;
  s.activePlayerId = next.id;
  s.subPhase = 'awaitingAction';
  s.actionPointsRemaining = hasTrophy(s, next.id, 'monster-mega-slime') ? 4 : 3;
  s.turnBuffs = {
    rollBonus: 0,
    unchallengeable: false,
    shadowClawUsed: false,
    nobleShamanUsed: false,
    gnawingDreadUsed: false,
    noOpponentModifiers: false,
  };
  s.protectedFromSteal[next.id] = false;
  s.protectedFromDestroy[next.id] = false;
}

// ============================================================================
// Entry point
// ============================================================================

export function applyAction(state: HtsState, action: HtsAction): HtsState {
  if (state.phase === 'gameOver') throw new Error('the game is over');
  const s = cloneState(state);

  switch (action.type) {
    case 'choosePartyLeader':
      handleChoosePartyLeader(s, action);
      break;
    case 'drawCard':
      handleDrawCard(s, action);
      break;
    case 'playHero':
      handlePlayHero(s, action);
      break;
    case 'equipItem':
      handleEquipItem(s, action);
      break;
    case 'playMagic':
      handlePlayMagic(s, action);
      break;
    case 'useHeroAbility':
      handleUseHeroAbility(s, action);
      break;
    case 'attackMonster':
      handleAttackMonster(s, action);
      break;
    case 'shadowClawPull':
      handleShadowClawPull(s, action);
      break;
    case 'nobleShamanAdjust':
      handleNobleShamanAdjust(s, action);
      break;
    case 'gnawingDreadSearch':
      handleGnawingDreadSearch(s, action);
      break;
    case 'claimHolidayGift':
      handleClaimHolidayGift(s, action);
      break;
    case 'discardAndRedraw':
      handleDiscardAndRedraw(s, action);
      break;
    case 'playChallenge':
      handlePlayChallenge(s, action);
      break;
    case 'declineChallenge':
      handleDeclineChallenge(s, action);
      break;
    case 'playModifier':
      handlePlayModifier(s, action);
      break;
    case 'declineModifier':
      handleDeclineModifier(s, action);
      break;
    case 'resolvePrompt':
      handleResolvePrompt(s, action);
      break;
    case 'endTurn':
      handleEndTurn(s, action);
      break;
    default: {
      const never: never = action;
      throw new Error(`unknown action ${JSON.stringify(never)}`);
    }
  }

  return s;
}
