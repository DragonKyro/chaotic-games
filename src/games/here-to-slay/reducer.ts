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
  HtsPileFilter,
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
    returnToHandShield: {},
    majestelk: {},

    turnPlayerId: first.id,
    actionPointsRemaining: 3,
    turnBuffs: freshTurnBuffs(),

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

/**
 * One Item per Hero (rulebook); two on a Warrior / Berserker printed with the
 * two-Item symbol, of which at most one may be a Mask (W&D, B&N rulesheets).
 */
export function canEquipItemToHero(h: HtsPartyHero, itemCard?: HtsCard): boolean {
  const existing = heroEquippedItems(h);
  if (existing.length >= (h.card.maxItems ?? 1)) return false;
  if (itemCard?.class && existing.some((i) => i.class !== null)) return false;
  return true;
}

/**
 * Whether this Hero's effect can be rolled for now: once per turn, unless it
 * wears Bottomless Bag ("more than once per turn, at a cost of one action
 * point for each roll"). Sealing Key forbids it outright.
 */
export function canRollHero(h: HtsPartyHero): boolean {
  if (heroHasItemKind(h, 'sealing-key')) return false;
  return !h.usedThisTurn || heroHasItemKind(h, 'bottomless-bag');
}

/** Action points to roll for a Hero's effect (Soulbound Grimoire: 2). */
export function heroRollCost(h: HtsPartyHero): number {
  return heroHasItemKind(h, 'soulbound-grimoire') ? 2 : 1;
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

export function heroEffectiveClass(h: HtsPartyHero): HtsBaseClass | null {
  for (const item of heroEquippedItems(h)) {
    if (item.class) return item.class;
  }
  return h.card.class;
}

/**
 * A class symbol in your Party: a Hero of that class (Masks count) or your
 * Party Leader of that class — the rulebook's reading of a Monster's class
 * requirement, used for the class Challenge cards too.
 */
export function partyHasClassSymbol(s: HtsState, playerId: PlayerId, cls: HtsBaseClass): boolean {
  if (s.partyLeaders[playerId]?.class === cls) return true;
  return partyOf(s, playerId).some((h) => heroEffectiveClass(h) === cls);
}

/**
 * "Cards in their Party" (Brawling Spirit): the Hero cards and the Item cards
 * equipped to them — the rulebook's Party is "the area in front of you in
 * which you play Hero cards and Item cards". Leaving out the Party Leader and
 * slain Monsters is UNCONFIRMED.
 */
export function partyCardCount(s: HtsState, playerId: PlayerId): number {
  return partyOf(s, playerId).reduce((n, h) => n + 1 + heroEquippedItems(h).length, 0);
}

/** Every class in this game (base six plus each class expansion's two), for "Choose a Class". */
export function classesInGame(s: HtsState): HtsBaseClass[] {
  const classes: HtsBaseClass[] = ['fighter', 'bard', 'guardian', 'ranger', 'thief', 'wizard'];
  if (s.config.expansions.includes('warriors-druids')) classes.push('warrior', 'druid');
  if (s.config.expansions.includes('berserkers-necromancers')) classes.push('berserker', 'necromancer');
  return classes;
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
      if (prompt.mode === 'bounceItem' && heroEquippedItems(h).length === 0) continue;
      if (prompt.mode === 'returnCursedItem' && !heroEquippedItems(h).some((i) => i.type === 'cursedItem')) continue;
      if (prompt.mode === 'equipItem' && !canEquipItemToHero(h, item)) continue;
      if (prompt.mode === 'steal' && prompt.sourceHeroId === h.card.id) continue;
      results.push({ ownerId, hero: h });
    }
  }
  return results;
}

/**
 * The cards a 'choosePartyCard' prompt can pick: Heroes (with their Items)
 * and single equipped Items. Not Party Leaders ("cannot be sacrificed,
 * destroyed, stolen"), and not slain Monster cards (UNCONFIRMED).
 */
export function validPartyCardTargets(
  s: HtsState,
  prompt: Extract<HtsPrompt, { kind: 'choosePartyCard' }>,
): { ownerId: PlayerId; hero: HtsPartyHero; item: HtsCard | null }[] {
  const out: { ownerId: PlayerId; hero: HtsPartyHero; item: HtsCard | null }[] = [];
  for (const seat of s.seats) {
    const ownerId = seat.id;
    if (prompt.scope === 'own' ? ownerId !== prompt.playerId : ownerId === prompt.playerId) continue;
    const heroesOk = prompt.filter === 'any' && (prompt.mode !== 'destroy' || canDestroyPartyHero(s, ownerId));
    for (const h of partyOf(s, ownerId)) {
      if (heroesOk) out.push({ ownerId, hero: h, item: null });
      for (const item of heroEquippedItems(h)) out.push({ ownerId, hero: h, item });
    }
  }
  return out;
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
    if (hero) {
      for (const item of heroEquippedItems(hero)) {
        if (item.kind === 'really-big-ring' || item.kind === 'freshly-sharpened-skates') actorTotal += 2;
        if (item.kind === 'even-bigger-ring') actorTotal += 4;
        if (item.kind === 'curse-of-the-snakes-eyes') actorTotal -= 2;
      }
    }
  } else if (r.reason === 'monsterAttack') {
    const leaderKind = s.partyLeaders[r.byPlayerId]?.kind;
    if (leaderKind === 'leader-divine-arrow') actorTotal += 1;
    if (leaderKind === 'leader-holly-spirit') actorTotal += 1;
    if (hasTrophy(s, r.byPlayerId, 'monster-abominable-snowbeast')) actorTotal += 2;
    // Reptilian Ripper: "Each time you roll to ATTACK a Monster card, +2 to your roll."
    if (hasTrophy(s, r.byPlayerId, 'monster-reptilian-ripper')) actorTotal += 2;
    // Critical Fang: "+4 to your rolls to ATTACK a Monster card until the end of your turn."
    if (r.byPlayerId === s.turnPlayerId) actorTotal += s.turnBuffs.attackBonus ?? 0;
  } else if (r.reason === 'challengeDuel') {
    if (s.partyLeaders[r.byPlayerId]?.kind === 'leader-fist-of-reason') actorTotal += 2;
    if (hasTrophy(s, r.byPlayerId, 'monster-titan-wyvern')) actorTotal += 1;
    if (r.challengerId) {
      if (r.challengerId === s.turnPlayerId) challengerTotal += s.turnBuffs.rollBonus;
      if (hasTrophy(s, r.challengerId, 'monster-anuran-cauldron')) challengerTotal += 1;
      if (s.partyLeaders[r.challengerId]?.kind === 'leader-fist-of-reason') challengerTotal += 2;
      if (hasTrophy(s, r.challengerId, 'monster-titan-wyvern')) challengerTotal += 1;
      // A class Challenge card's own "+3 to your roll".
      challengerTotal += r.challengerBonus ?? 0;
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
    if (front.kind === 'chooseFromPile') refreshPilePrompt(s, front);
    if (isPromptImpossible(s, front)) {
      s.promptQueue.shift();
      onPromptSkipped(s, front);
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

  // Vicious Wildcat: "SLAY any Monster card, then end your turn."
  if (s.endTurnPending) {
    s.endTurnPending = false;
    pushLog(s, s.turnPlayerId, `${seatName(s, s.turnPlayerId)}'s turn ends.`, 'normal');
    finishTurnAdvance(s);
    return;
  }

  s.subPhase = 'awaitingAction';
  s.activePlayerId = s.turnPlayerId;
}

function runStep(s: HtsState, p: Extract<HtsPrompt, { kind: 'step' }>) {
  const st = p.step;
  if (st.type === 'draw') {
    drawCards(s, p.playerId, st.count);
  } else if (st.type === 'drawUntil') {
    const need = st.handSize - handOf(s, p.playerId).length;
    if (need > 0) drawCards(s, p.playerId, need);
  } else if (st.type === 'moveHero') {
    if (partyOf(s, st.fromPlayerId).some((h) => h.card.id === st.heroCardId)) {
      removeHeroFromParty(s, st.fromPlayerId, st.heroCardId, 'move', { toPlayerId: st.toPlayerId });
      pushLog(s, p.playerId, `${seatName(s, st.toPlayerId)} receives a Hero from ${seatName(s, st.fromPlayerId)}'s Party.`, 'normal');
    }
  }
}

function isPromptImpossible(s: HtsState, p: HtsPrompt): boolean {
  switch (p.kind) {
    case 'chooseHeroTarget':
      return validHeroTargets(s, p).length === 0;
    case 'choosePartyCard':
      return validPartyCardTargets(s, p).length === 0;
    case 'chooseCardsFromHand':
      return !p.keepIfEmpty && validHandCardsForPrompt(s, p).length === 0;
    case 'chooseFromPile':
    case 'bullseyePeek':
      return p.cards.length === 0;
    case 'chooseMonster':
      return validMonsterTargets(s, p).length === 0;
    case 'rerollHero':
      return !partyOf(s, p.playerId).some((h) => h.card.id === p.heroCardId && heroEquippedItems(h).some((i) => i.id === p.itemCardId));
    default:
      return false;
  }
}

/** A prompt dropped for want of targets may still owe the rest of its effect. */
function onPromptSkipped(s: HtsState, p: HtsPrompt) {
  if (p.kind === 'choosePartyCard' && p.effectTag === 'rabidBeastSacrifice') queueRabidBeastDestroys(s, p.playerId, p.tally ?? 0);
}

/** Boston Terror, when no card is given: "you may choose 2 cards from the discard pile and add them to your hand." */
function queueBostonTerrorPicks(s: HtsState, playerId: PlayerId) {
  for (const n of [2, 1]) {
    queueDiscardSearch(s, playerId, 'any', `Boston Terror (${n} of 2): you may choose a card from the discard pile to add to your hand.`, { optional: true, front: true });
  }
}

const CLASS_LABEL: Record<HtsBaseClass, string> = {
  fighter: 'Fighter', bard: 'Bard', guardian: 'Guardian', ranger: 'Ranger', thief: 'Thief', wizard: 'Wizard',
  warrior: 'Warrior', druid: 'Druid', berserker: 'Berserker', necromancer: 'Necromancer',
};

export function validMonsterTargets(s: HtsState, p: Extract<HtsPrompt, { kind: 'chooseMonster' }>): HtsMonster[] {
  return p.mode === 'attack' ? s.monsterRow.filter((m) => canAttackMonster(s, p.playerId, m)) : [...s.monsterRow];
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
    if (p.effectTag === 'shadowSaintCost') return c.type === 'modifier';
    return true;
  });
}

// ============================================================================
// Pile searches
// ============================================================================

export function matchesPileFilter(c: HtsCard, filter: HtsPileFilter | undefined): boolean {
  switch (filter ?? 'any') {
    case 'any': return true;
    case 'hero': return c.type === 'hero';
    case 'item': return c.type === 'item' || c.type === 'cursedItem';
    case 'magic': return c.type === 'magic';
    case 'modifier': return c.type === 'modifier';
    case 'challenge': return c.type === 'challenge';
    case 'heroOrItem': return c.type === 'hero' || c.type === 'item' || c.type === 'cursedItem';
    default: return false;
  }
}

/** "Search the discard pile for …": the choices are read when the prompt comes up. */
function queueDiscardSearch(
  s: HtsState,
  playerId: PlayerId,
  filter: HtsPileFilter,
  reason: string,
  opts: { optional?: boolean; then?: Extract<HtsPrompt, { kind: 'chooseFromPile' }>['then']; front?: boolean; at?: number } = {},
) {
  const prompt: HtsPrompt = {
    kind: 'chooseFromPile',
    playerId,
    reason,
    optional: !!opts.optional,
    cards: s.discard.filter((c) => matchesPileFilter(c, filter)),
    source: 'discard',
    filter,
    then: opts.then,
  };
  if (opts.at !== undefined) s.promptQueue.splice(opts.at, 0, prompt);
  else if (opts.front) s.promptQueue.unshift(prompt);
  else s.promptQueue.push(prompt);
}

/** "Look at another player's hand. Choose a <type> card (if they have one)…" */
function lookAtHandPrompt(
  s: HtsState,
  playerId: PlayerId,
  opponentId: PlayerId,
  filter: HtsPileFilter,
  reason: string,
  then?: Extract<HtsPrompt, { kind: 'chooseFromPile' }>['then'],
): HtsPrompt {
  const p: Extract<HtsPrompt, { kind: 'chooseFromPile' }> = {
    kind: 'chooseFromPile',
    playerId,
    reason,
    optional: false,
    cards: [],
    source: 'opponentHand',
    opponentId,
    filter,
    then,
  };
  refreshPilePrompt(s, p);
  return p;
}

/** Re-read a queued search from the live discard pile / hand. */
function refreshPilePrompt(s: HtsState, p: Extract<HtsPrompt, { kind: 'chooseFromPile' }>) {
  if (p.source === 'discard' && p.filter) {
    p.cards = s.discard.filter((c) => matchesPileFilter(c, p.filter));
  } else if (p.source === 'discard') {
    // A fixed list (Here to Sleigh's Snow Slinger): drop whatever has left the pile.
    p.cards = p.cards.filter((c) => s.discard.some((d) => d.id === c.id));
  } else if (p.source === 'opponentHand' && p.opponentId && p.filter) {
    p.cards = [...handOf(s, p.opponentId)];
    if (p.filter !== 'any') p.onlyCardIds = p.cards.filter((c) => matchesPileFilter(c, p.filter)).map((c) => c.id);
  }
}

/** The cards a chooseFromPile prompt lets you take (the others are only shown). */
export function pickablePileCards(p: Extract<HtsPrompt, { kind: 'chooseFromPile' }>): HtsCard[] {
  return p.onlyCardIds ? p.cards.filter((c) => p.onlyCardIds!.includes(c.id)) : p.cards;
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

/**
 * A Hero (and its Items) back to its owner's hand: "If a Hero card with an
 * equipped Item card is … returned to your hand, that Item card is also …
 * returned to your hand along with the Hero card" (rulebook).
 */
function returnHeroToHand(s: HtsState, ownerId: PlayerId, hero: HtsPartyHero) {
  handOf(s, ownerId).push(...heroEquippedItems(hero), hero.card);
  hero.equippedItem = null;
  hero.extraItems = [];
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
    /** Logged once the Hero really goes (after any replacement effect), before what that triggers. */
    announce?: string;
  },
): 'done' | 'deferred' | 'saved' | 'missing' {
  const party = partyOf(s, ownerId);
  const idx = party.findIndex((h) => h.card.id === heroCardId);
  if (idx < 0) return 'missing';
  const hero = party[idx]!;

  // Corrupted Sabretooth check: "Each time you would DESTROY a Hero card, you may STEAL that Hero card instead."
  // (Only if the Hero could be stolen — Calming Voice blocks it.)
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

  if (reason === 'destroy' || reason === 'sacrifice') {
    // Decoy Doll: "If the equipped Hero card would be sacrificed or destroyed, move this card to the discard pile instead."
    if (heroHasItemKind(hero, 'decoy-doll')) {
      const doll = removeItemFromHero(hero, (i) => i.kind === 'decoy-doll');
      if (doll) s.discard.push(doll);
      pushLog(s, ownerId, `Decoy Doll sacrificed itself to save ${hero.card.name}!`, 'good');
      return 'saved';
    }
    // Maegisty: "Until your next turn, if a Hero card in your Party would be
    // sacrificed or destroyed, return it to your hand instead." Replaced, so
    // nothing that triggers on a sacrifice / destroy fires.
    if (s.returnToHandShield?.[ownerId]) {
      party.splice(idx, 1);
      returnHeroToHand(s, ownerId, hero);
      pushLog(s, ownerId, `Maegisty: ${hero.card.name} returns to ${seatName(s, ownerId)}'s hand instead.`, 'good');
      return 'saved';
    }
  }

  party.splice(idx, 1);
  if (opts?.announce) pushLog(s, opts.byPlayerId ?? ownerId, opts.announce, reason === 'destroy' ? 'danger' : 'normal');

  if (reason === 'steal' || reason === 'move') {
    const destId = opts?.toPlayerId ?? opts?.byPlayerId;
    if (destId) {
      partyOf(s, destId).push(hero);
      // Cursed Glove: "If another Hero card in your Party is stolen, move the
      // equipped Hero card to the Party of the player who stole it as well."
      if (reason === 'steal') {
        for (const gloved of party.filter((h) => heroHasItemKind(h, 'cursed-glove'))) {
          party.splice(party.indexOf(gloved), 1);
          partyOf(s, destId).push(gloved);
          pushLog(s, ownerId, `Cursed Glove drags ${gloved.card.name} along to ${seatName(s, destId)}'s Party.`, 'danger');
        }
      }
    }
    return 'done';
  }

  // Destroy or Sacrifice: the Hero and its Items go to the discard pile
  // (Shurikitty takes the Items instead).
  for (const item of heroEquippedItems(hero)) {
    if (opts?.stealEquippedItemToHand) {
      handOf(s, opts.stealEquippedItemToHand).push(item);
    } else {
      s.discard.push(item);
    }
  }
  hero.equippedItem = null;
  hero.extraItems = [];
  s.discard.push(hero.card);

  if (reason === 'destroy' && hasTrophy(s, ownerId, 'monster-dracos')) {
    drawCards(s, ownerId, 1);
    pushLog(s, ownerId, `Dracos: ${seatName(s, ownerId)} drew a card when their Hero was destroyed.`, 'good');
  }
  afterHeroGone(s, ownerId, reason, opts?.byPlayerId);
  return 'done';
}

/** What fires once a Hero has been sacrificed or destroyed. */
function afterHeroGone(s: HtsState, ownerId: PlayerId, reason: 'destroy' | 'sacrifice', byPlayerId: PlayerId | undefined) {
  if (reason === 'sacrifice') onCardSacrificed(s, ownerId);
  // Silent Shield: "For the rest of your turn, if you SACRIFICE or DESTROY a
  // Hero card, you may search the discard pile for a Hero card…"
  const doer = reason === 'sacrifice' ? ownerId : byPlayerId;
  if (doer && doer === s.turnPlayerId && s.turnBuffs.silentShield) {
    queueDiscardSearch(s, doer, 'hero', 'Silent Shield: you may search the discard pile for a Hero card and add it to your hand.', { optional: true, front: true });
  }
  // Soul Tether: "If any Hero card in your Party is sacrificed or destroyed, SACRIFICE the equipped Hero card."
  for (const tethered of partyOf(s, ownerId).filter((h) => heroHasItemKind(h, 'soul-tether'))) {
    pushLog(s, ownerId, `Soul Tether: ${seatName(s, ownerId)} must sacrifice ${tethered.card.name} too.`, 'danger');
    removeHeroFromParty(s, ownerId, tethered.card.id, 'sacrifice', { byPlayerId: ownerId });
  }
}

/** Every "SACRIFICE a card" — a Hero or an Item — passes through here. */
function onCardSacrificed(s: HtsState, sacrificerId: PlayerId) {
  // Feral Dragon: "Each time any player sacrifices a card, DRAW a card."
  for (const seat of s.seats) {
    if (hasTrophy(s, seat.id, 'monster-feral-dragon')) {
      drawCards(s, seat.id, 1);
      pushLog(s, seat.id, `Feral Dragon: ${seatName(s, seat.id)} draws a card for ${seatName(s, sacrificerId)}'s sacrifice.`, 'good');
    }
  }
  // Doombringer: "Each time you SACRIFICE a card, you may choose a card from the discard pile and add it to your hand."
  if (hasTrophy(s, sacrificerId, 'monster-doombringer')) {
    queueDiscardSearch(s, sacrificerId, 'any', 'Doombringer: you sacrificed a card — you may choose a card from the discard pile to add to your hand.', { optional: true, front: true });
  }
}

/** SACRIFICE an equipped Item card (it leaves its Hero for the discard pile). */
function sacrificeItem(s: HtsState, ownerId: PlayerId, hero: HtsPartyHero, itemId: number) {
  const item = removeItemFromHero(hero, (i) => i.id === itemId);
  if (!item) return;
  s.discard.push(item);
  pushLog(s, ownerId, `${seatName(s, ownerId)} sacrificed ${item.name}.`, 'normal');
  onCardSacrificed(s, ownerId);
}

/** DESTROY an equipped Item card in another player's Party. */
function destroyItem(s: HtsState, byPlayerId: PlayerId, ownerId: PlayerId, hero: HtsPartyHero, itemId: number) {
  const item = removeItemFromHero(hero, (i) => i.id === itemId);
  if (!item) return;
  s.discard.push(item);
  pushLog(s, byPlayerId, `${seatName(s, byPlayerId)} destroyed ${item.name} on ${seatName(s, ownerId)}'s ${hero.card.name}.`, 'danger');
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
 * Whether `playerId` may play this Challenge card. Class Challenges (W&D,
 * B&N) need that class in your Party: the official card pages list the class
 * symbol under "Requirement to Play Card". A Party Leader of the class meeting
 * it (as it does a Monster's class symbol) is UNCONFIRMED.
 */
export function canPlayChallengeCard(s: HtsState, playerId: PlayerId, card: HtsCard): boolean {
  if (card.type !== 'challenge') return false;
  return !card.challengeClass || partyHasClassSymbol(s, playerId, card.challengeClass);
}

/**
 * Who may CHALLENGE a card being played: every other player holding a
 * Challenge card they can play, clockwise from the player's left. A card can
 * only be challenged once, so the window closes after the first Challenge lands.
 */
function buildChallengeQueue(s: HtsState, byPlayerId: PlayerId, card: HtsCard): PlayerId[] {
  if (s.turnBuffs.unchallengeable && byPlayerId === s.turnPlayerId) return [];
  if ((card.type === 'item' || card.type === 'cursedItem') && hasTrophy(s, byPlayerId, 'monster-warworn-owlbear')) {
    return [];
  }
  return seatsFrom(s, byPlayerId).filter((id) => id !== byPlayerId && handOf(s, id).some((c) => canPlayChallengeCard(s, id, c)));
}

/**
 * Put a Hero / Item / Magic card "into play" — from an action point or from an
 * effect that plays a card from your hand "immediately". Either way it is
 * played from your hand, so it can be Challenged (rulebook: "when that player
 * attempts to play a Hero, Item, or Magic card from their hand"). The caller
 * must not run advanceFlow afterwards: resolution does that. `after` is queued
 * once the play has resolved, whether it stood or was challenged away.
 */
function beginPlay(s: HtsState, by: PlayerId, card: HtsCard, target?: { playerId: PlayerId; heroCardId: number }, after?: HtsPrompt[]) {
  s.pendingPlay = {
    byPlayerId: by,
    card,
    targetPlayerId: target?.playerId ?? (card.type === 'hero' ? by : null),
    targetHeroCardId: target?.heroCardId ?? null,
    responderQueue: [],
  };
  if (after?.length) s.pendingPlay.after = after;
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

/** "…then play it immediately": a card just added to your hand is played from it. */
function playFromHandNow(s: HtsState, by: PlayerId, card: HtsCard) {
  const hand = handOf(s, by);
  if (card.type === 'item' || card.type === 'cursedItem') {
    // Stays in hand until a Hero to wear it is chosen (no Hero: it stays there).
    queueEquipTarget(s, by, card, true);
    advanceFlow(s);
    return;
  }
  const idx = hand.findIndex((c) => c.id === card.id);
  if (idx < 0) {
    advanceFlow(s);
    return;
  }
  hand.splice(idx, 1);
  pushLog(s, by, `${seatName(s, by)} played ${card.type === 'hero' ? 'Hero' : 'Magic card'} ${card.name}.`, 'normal');
  beginPlay(s, by, card);
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
    if (p.after) s.promptQueue.push(...p.after);
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

  if (p.after) s.promptQueue.push(...p.after);
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

/** The stand-in card a Majestelk adjustment is recorded under (not a Modifier card: never discarded). */
const MAJESTELK_SIGN: HtsCard = {
  id: -1,
  kind: 'majestelk-sign',
  name: 'Majestelk',
  type: 'hero',
  class: 'druid',
  text: '+5 or -5 to each of your rolls until your next turn.',
  abilityThreshold: null,
  modifierChoices: [5, -5],
};

/**
 * Majestelk: "+5 or -5 to each of your rolls until your next turn." The
 * player declares the sign on each roll, after seeing the dice, like a
 * two-option Modifier (per-roll choice: UNCONFIRMED). Which of this roll's
 * sides `playerId` still owes a sign on.
 */
export function majestelkSidesOwed(s: HtsState, r: HtsPendingRoll, playerId: PlayerId): ('actor' | 'challenger')[] {
  if (!s.majestelk?.[playerId]) return [];
  const sides: ('actor' | 'challenger')[] = [];
  if (r.byPlayerId === playerId) sides.push('actor');
  if (r.challengerId === playerId) sides.push('challenger');
  return sides.filter((side) => !r.modifiers.some((m) => m.playerId === playerId && m.card.kind === MAJESTELK_SIGN.kind && m.targetSide === side));
}

/**
 * Biggest Ring Ever: "Each time you roll to use the equipped Hero card's
 * effect, you may DISCARD up to 3 cards. For each card discarded, +2 to your
 * roll." Used once per roll, in the Modifier window.
 */
export function canUseBiggestRing(s: HtsState, r: HtsPendingRoll, playerId: PlayerId): boolean {
  if (r.reason !== 'heroAbility' || r.byPlayerId !== playerId || r.ringUsed) return false;
  const hero = partyOf(s, playerId).find((h) => h.card.id === r.sourceCardId);
  return !!hero && heroHasItemKind(hero, 'biggest-ring-ever') && handOf(s, playerId).length > 0;
}

/**
 * The values a Modifier card offers on this roll. B&N's Modifier +2/-2: "If
 * you are attacking a Monster card, +4 to that roll instead."
 */
export function modifierValuesFor(r: HtsPendingRoll, playerId: PlayerId, card: HtsCard): number[] {
  if (card.kind === 'mod-bn-plus-2-minus-2' && r.reason === 'monsterAttack' && r.byPlayerId === playerId) return [4];
  return card.modifierChoices ?? [];
}

/**
 * Everyone who could still change the roll, clockwise from the roller.
 * "Each player may play any number of Modifier cards on the same roll", so the
 * queue is rebuilt after every Modifier — including the player who just
 * played one. It terminates: each play spends a card, each decline advances.
 */
function buildModifierQueue(s: HtsState, r: HtsPendingRoll): PlayerId[] {
  return seatsFrom(s, r.byPlayerId).filter((id) => {
    const hasModifierCard = canPlayModifiers(s, id) && handOf(s, id).some((c) => c.type === 'modifier');
    return hasModifierCard || canUseNobleShaman(s, id) || majestelkSidesOwed(s, r, id).length > 0 || canUseBiggestRing(s, r, id);
  });
}

function openOrResolveRoll(s: HtsState) {
  const r = s.pendingRoll;
  if (!r) throw new Error('openOrResolveRoll with no pendingRoll');
  const queue = buildModifierQueue(s, r);
  r.responderQueue = queue;
  const first = queue[0];
  if (!first) {
    resolvePendingRoll(s);
    return;
  }
  s.subPhase = 'awaitingModifiers';
  s.activePlayerId = first;
}

/**
 * Modifier cards whose bonus depends on the final roll (W&D): Modifier +4
 * "If the roll is modified above 12, DRAW a card"; Modifier -4 "If the roll is
 * modified below 2, choose a card from the discard pile". Checked against the
 * side's final total once every Modifier is in (UNCONFIRMED timing).
 */
function modifierAftermath(s: HtsState, r: HtsPendingRoll, totals: { actorTotal: number; challengerTotal: number }) {
  for (const mod of r.modifiers) {
    const total = mod.targetSide === 'challenger' ? totals.challengerTotal : totals.actorTotal;
    if (mod.card.kind === 'mod-wd-plus-4' && total > 12) {
      drawCards(s, mod.playerId, 1);
      pushLog(s, mod.playerId, `Modifier +4: the roll went above 12, so ${seatName(s, mod.playerId)} draws a card.`, 'good');
    } else if (mod.card.kind === 'mod-wd-minus-4' && total < 2) {
      queueDiscardSearch(s, mod.playerId, 'any', 'Modifier -4: the roll went below 2 — choose a card from the discard pile to add to your hand.');
    }
  }
}

/** Move a face-up Monster to `playerId`'s Party and flip its replacement. */
function slayMonster(s: HtsState, playerId: PlayerId, monster: HtsMonster) {
  const idx = s.monsterRow.findIndex((m) => m.card.id === monster.card.id);
  if (idx < 0) return;
  s.monsterRow.splice(idx, 1);
  trophiesOf(s, playerId).push(monster);
  if (monster.card.kind === 'monster-frostbite-krampus') {
    claimNiceGift(s, playerId);
  }
  // The Raging Manticore: "Each time you SLAY a Monster card, DRAW 2 cards."
  if (s.partyLeaders[playerId]?.kind === 'leader-raging-manticore') {
    drawCards(s, playerId, 2);
    pushLog(s, playerId, `The Raging Manticore: ${seatName(s, playerId)} draws 2 cards for the slay.`, 'good');
  }
  const replacement = s.monsterDeck.shift();
  if (replacement) s.monsterRow.push(replacement);
}

function queueMonsterPenalty(s: HtsState, playerId: PlayerId, monster: HtsMonster) {
  const name = monster.card.name;
  const sacrifice = (reason: string): HtsPrompt => ({ kind: 'chooseHeroTarget', playerId, reason, optional: false, scope: 'own', mode: 'sacrifice' });
  switch (monster.failPenalty) {
    case 'sacrificeHero':
      s.promptQueue.push(sacrifice(`${name} penalty: you must SACRIFICE a Hero card.`));
      break;
    case 'sacrificeTwoHeroes':
      s.promptQueue.push(
        sacrifice(`${name} penalty (1 of 2): you must SACRIFICE a Hero card.`),
        sacrifice(`${name} penalty (2 of 2): you must SACRIFICE another Hero card.`),
      );
      break;
    case 'discard2':
      if (handOf(s, playerId).length > 0) {
        s.promptQueue.push({
          kind: 'chooseCardsFromHand',
          playerId,
          reason: `${name} penalty: you must DISCARD 2 cards.`,
          count: Math.min(2, handOf(s, playerId).length),
          optional: false,
          filter: 'any',
          effectTag: 'discard',
        });
      }
      break;
    case 'discardHand': {
      const hand = handOf(s, playerId);
      s.discard.push(...hand);
      s.hands[playerId] = [];
      pushLog(s, playerId, `${name}: ${seatName(s, playerId)} discards their hand.`, 'danger');
      break;
    }
  }
}

function resolvePendingRoll(s: HtsState) {
  const r = s.pendingRoll;
  if (!r) throw new Error('no pendingRoll');
  s.pendingRoll = null;

  // Modifier cards go to the discard pile; leader skills and the Majestelk sign were never cards.
  for (const mod of r.modifiers) {
    if (mod.card.type === 'modifier') {
      s.discard.push(mod.card);
    }
  }

  const totals = computeRollTotals(s, r);
  const { actorTotal, challengerTotal } = totals;
  const record = (subject: string, outcome: HtsRollRecord['outcome']) => {
    s.lastRoll = { seq: (s.lastRoll?.seq ?? 0) + 1, roll: { ...r, responderQueue: [] }, actorTotal, challengerTotal, subject, outcome };
  };
  modifierAftermath(s, r, totals);

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
    } else if (hero) {
      heroRollFailed(s, r.byPlayerId, hero);
    }

    advanceFlow(s);
    return;
  }

  if (r.reason === 'monsterAttack') {
    const monster = s.monsterRow.find((m) => m.card.id === r.sourceCardId);
    if (!monster) {
      advanceFlow(s);
      return;
    }

    const slain = monster.slayOnLow ? actorTotal <= monster.slayThreshold : actorTotal >= monster.slayThreshold;
    const failed = monster.slayOnLow ? actorTotal >= monster.failThreshold : actorTotal <= monster.failThreshold;
    record(monster.card.name, slain ? 'slain' : failed ? 'penalty' : 'nothing');

    if (slain) {
      slayMonster(s, r.byPlayerId, monster);
      pushLog(s, r.byPlayerId, `⚔️ ${seatName(s, r.byPlayerId)} rolled ${actorTotal} and SLEW ${monster.card.name}!`, 'good');
    } else if (failed) {
      pushLog(s, r.byPlayerId, `💀 ${seatName(s, r.byPlayerId)} rolled ${actorTotal} against ${monster.card.name} and takes the penalty!`, 'danger');
      queueMonsterPenalty(s, r.byPlayerId, monster);
    } else {
      pushLog(s, r.byPlayerId, `${seatName(s, r.byPlayerId)} rolled ${actorTotal} against ${monster.card.name} — no effect.`, 'normal');
    }

    advanceFlow(s);
  }
}

/** "If you unsuccessfully roll to use the equipped Hero card's effect, …" */
function heroRollFailed(s: HtsState, playerId: PlayerId, hero: HtsPartyHero) {
  if (heroHasItemKind(hero, 'particularly-rusty-coin')) {
    drawCards(s, playerId, 1);
    pushLog(s, playerId, 'Particularly Rusty Coin: drew a card after a failed roll!', 'good');
  }
  // Temporal Hourglass: "…you may spend an extra action point this turn." Pure upside: taken.
  if (heroHasItemKind(hero, 'temporal-hourglass') && playerId === s.turnPlayerId) {
    s.actionPointsRemaining += 1;
    pushLog(s, playerId, 'Temporal Hourglass: +1 action point this turn after the failed roll.', 'good');
  }
  // Silver Lining: "…+2 to all of your rolls for the rest of your turn."
  if (heroHasItemKind(hero, 'silver-lining') && playerId === s.turnPlayerId) {
    s.turnBuffs.rollBonus += 2;
    pushLog(s, playerId, 'Silver Lining: +2 to all of your rolls for the rest of your turn.', 'good');
  }
  // Dragon's Bile: "…SACRIFICE a Hero card."
  if (heroHasItemKind(hero, 'dragons-bile')) {
    s.promptQueue.push({
      kind: 'chooseHeroTarget',
      playerId,
      reason: "Dragon's Bile: the roll failed — you must SACRIFICE a Hero card.",
      optional: false,
      scope: 'own',
      mode: 'sacrifice',
    });
  }
  // Goblet of Caffeination: "…you may SACRIFICE this card, then roll to use that effect again immediately."
  const goblet = heroEquippedItems(hero).find((i) => i.kind === 'goblet-of-caffeination');
  if (goblet) {
    s.promptQueue.push({
      kind: 'rerollHero',
      playerId,
      heroCardId: hero.card.id,
      itemCardId: goblet.id,
      reason: `Goblet of Caffeination: sacrifice it to roll for ${hero.card.name} again?`,
    });
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
    case 'guiding-light':
      queueDiscardSearch(s, byPlayerId, 'hero', 'Guiding Light: choose a Hero card from the discard pile to add to your hand.');
      break;
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
    case 'radiant-horn':
      queueDiscardSearch(s, byPlayerId, 'modifier', 'Radiant Horn: choose a Modifier card from the discard pile to add to your hand.');
      break;
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
    case 'lookie-rookie':
      queueDiscardSearch(s, byPlayerId, 'item', 'Lookie Rookie: choose an Item card from the discard pile to add to your hand.');
      break;
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
    case 'bun-bun':
      queueDiscardSearch(s, byPlayerId, 'magic', 'Bun Bun: choose a Magic card from the discard pile to add to your hand.');
      break;
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
    // Warriors & Druids — Druid Heroes (roll that number or lower)
    // ========================================================================
    case 'big-buckley':
      // "ATTACK a Monster card immediately. (You must still meet its Party requirement.)"
      s.promptQueue.push({
        kind: 'chooseMonster',
        playerId: byPlayerId,
        reason: 'Big Buckley: ATTACK a Monster card immediately (no action points).',
        mode: 'attack',
      });
      break;
    case 'buck-omens':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Buck Omens: choose a player whose hand you'll look at — take a Hero card from it into your Party.",
        optional: false,
        effectTag: 'buckOmensLook',
      });
      break;
    case 'doe-fallow':
      s.promptQueue.push(
        {
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Doe Fallow: SACRIFICE a Hero card (then DRAW until you have 7 cards).',
          optional: false,
          scope: 'own',
          mode: 'sacrifice',
        },
        { kind: 'step', playerId: byPlayerId, step: { type: 'drawUntil', handSize: 7 } },
      );
      break;
    case 'glowing-antler':
      // "You may play up to 2 Magic cards immediately." One at a time: the
      // first resolves (or is challenged away) before the second is chosen.
      s.promptQueue.push(glowingAntlerPrompt(byPlayerId, 1));
      break;
    case 'maegisty':
      if (!s.returnToHandShield) s.returnToHandShield = {};
      s.returnToHandShield[byPlayerId] = true;
      pushLog(s, byPlayerId, 'Maegisty: until your next turn, a Hero in your Party that would be sacrificed or destroyed returns to your hand instead.', 'good');
      break;
    case 'magus-moose':
      queueDiscardSearch(s, byPlayerId, 'hero', 'Magus Moose: choose a Hero card from the discard pile — it goes to your hand, then you play it immediately.', { then: 'playImmediately' });
      break;
    case 'majestelk':
      // "SACRIFICE a Hero card. +5 or -5 to each of your rolls until your next turn."
      if (!s.majestelk) s.majestelk = {};
      s.majestelk[byPlayerId] = true;
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Majestelk: SACRIFICE a Hero card.',
        optional: false,
        scope: 'own',
        mode: 'sacrifice',
      });
      pushLog(s, byPlayerId, 'Majestelk: +5 or -5 to each of your rolls until your next turn.', 'good');
      break;
    case 'stagguard':
      s.turnBuffs.noOpponentModifiers = true;
      pushLog(s, byPlayerId, 'Stagguard: no other player can play Modifier cards until the end of your turn!', 'good');
      break;

    // ========================================================================
    // Warriors & Druids — Warrior Heroes
    // ========================================================================
    case 'agile-dagger':
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
      break;
    case 'blinding-blade':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Blinding Blade: choose any player — every Item equipped in that player's Party goes to your hand.",
        optional: false,
        effectTag: 'blindingBladeStealItems',
        includeSelf: true,
      });
      break;
    case 'critical-fang':
      s.turnBuffs.attackBonus = (s.turnBuffs.attackBonus ?? 0) + 4;
      pushLog(s, byPlayerId, 'Critical Fang: +4 to your rolls to ATTACK a Monster card until the end of your turn!', 'good');
      break;
    case 'hardened-hunter': {
      const count = s.seats.filter((st) => st.id !== byPlayerId).reduce((n, st) => n + trophiesOf(s, st.id).length, 0);
      if (count > 0) drawCards(s, byPlayerId, count);
      pushLog(s, byPlayerId, `Hardened Hunter: ${seatName(s, byPlayerId)} draws ${count} card${count === 1 ? '' : 's'} (one per Monster in the other Parties).`, 'good');
      break;
    }
    case 'looting-lupo': {
      const count = countPartyEquippedItems(s, byPlayerId);
      if (count > 0) drawCards(s, byPlayerId, count);
      pushLog(s, byPlayerId, `Looting Lupo: ${seatName(s, byPlayerId)} draws ${count} card${count === 1 ? '' : 's'} (one per equipped Item).`, 'good');
      break;
    }
    case 'silent-shield':
      s.turnBuffs.silentShield = true;
      pushLog(s, byPlayerId, 'Silent Shield: for the rest of your turn, each Hero you sacrifice or destroy lets you search the discard pile for a Hero.', 'good');
      break;
    case 'tenacious-timber': {
      const n = trophiesOf(s, byPlayerId).length;
      for (let i = 0; i < n; i++) {
        s.promptQueue.push({
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: `Tenacious Timber (${i + 1} of ${n}): choose a Hero card to STEAL.`,
          optional: false,
          scope: 'others',
          mode: 'steal',
        });
      }
      if (n === 0) pushLog(s, byPlayerId, 'Tenacious Timber: no Monsters in your Party, so nothing to steal.', 'normal');
      break;
    }
    case 'wolfgang-pack': {
      const others = Math.max(0, partyOf(s, byPlayerId).length - 1);
      s.turnBuffs.rollBonus += others;
      pushLog(s, byPlayerId, `Wolfgang Pack: +${others} to all of your rolls until the end of your turn!`, 'good');
      break;
    }

    // ========================================================================
    // Berserkers & Necromancers — Necromancer Heroes. "You must pay the cost
    // stated at the beginning of the card's effect in order to use the rest of
    // that card's effect" (B&N rulesheet): the rest is queued only once the
    // cost is paid, so an unpayable cost leaves the effect unused.
    // ========================================================================
    case 'bark-hexer':
      s.promptQueue.push({
        kind: 'chooseCardsFromHand',
        playerId: byPlayerId,
        reason: 'Bark Hexer: DISCARD a card (the cost) — then each other player must DISCARD 2 cards.',
        count: 1,
        optional: false,
        filter: 'any',
        effectTag: 'barkHexerDiscard',
      });
      break;
    case 'beholden-retriever':
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Beholden Retriever: SACRIFICE a Hero card (the cost) — then take a Hero or Item card from the discard pile and play it.',
        optional: false,
        scope: 'own',
        mode: 'sacrifice',
        effectTag: 'beholdenCost',
      });
      break;
    case 'bone-collector':
      s.promptQueue.push({
        kind: 'choosePartyCard',
        playerId: byPlayerId,
        reason: 'Bone Collector: SACRIFICE an Item card in your Party (the cost) — then take a Hero card from the discard pile and play it.',
        optional: false,
        scope: 'own',
        mode: 'sacrifice',
        filter: 'item',
        effectTag: 'boneCollectorCost',
      });
      break;
    case 'boston-terror':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: 'Boston Terror: choose a player — they may give you a card; if not, you may take 2 cards from the discard pile.',
        optional: false,
        effectTag: 'bostonTerrorAsk',
      });
      break;
    case 'grim-pupper':
      // "Each player (including you) must SACRIFICE a card." — a Hero or an Item.
      for (const id of seatsFrom(s, byPlayerId)) {
        s.promptQueue.push({
          kind: 'choosePartyCard',
          playerId: id,
          reason: `Grim Pupper: ${id === byPlayerId ? 'you' : 'every player'} must SACRIFICE a card (a Hero or an equipped Item).`,
          optional: false,
          scope: 'own',
          mode: 'sacrifice',
          filter: 'any',
        });
      }
      break;
    case 'hollow-husk':
      s.promptQueue.push({
        kind: 'choosePlayer',
        playerId: byPlayerId,
        reason: "Hollow Husk: choose a player whose hand you'll look at — take a Magic card from it (you may play it).",
        optional: false,
        effectTag: 'hollowHuskLook',
      });
      break;
    case 'perfect-vessel': {
      // Cost: "SACRIFICE this card, then STEAL a Hero card."
      const res = removeHeroFromParty(s, byPlayerId, heroCard.id, 'sacrifice', { byPlayerId, announce: `${seatName(s, byPlayerId)} sacrificed Perfect Vessel.` });
      if (res !== 'missing') {
        s.promptQueue.push({
          kind: 'chooseHeroTarget',
          playerId: byPlayerId,
          reason: 'Perfect Vessel: STEAL a Hero card.',
          optional: false,
          scope: 'others',
          mode: 'steal',
        });
      }
      break;
    }
    case 'shadow-saint':
      s.promptQueue.push({
        kind: 'chooseCardsFromHand',
        playerId: byPlayerId,
        reason: 'Shadow Saint: DISCARD a Modifier card (the cost) — then no other player can play Modifier cards until the end of your turn.',
        publicReason: 'Shadow Saint: discarding a Modifier card to shut out every other Modifier this turn.',
        count: 1,
        optional: false,
        filter: 'any',
        effectTag: 'shadowSaintCost',
      });
      break;

    // ========================================================================
    // Berserkers & Necromancers — Berserker Heroes
    // ========================================================================
    case 'annihilator':
      queueDiscardSearch(s, byPlayerId, 'challenge', 'Annihilator: choose a Challenge card from the discard pile to add to your hand.');
      break;
    case 'brawling-spirit': {
      // "Each player (including you) with more than 3 cards in their Party must SACRIFICE a card."
      const crowded = seatsFrom(s, byPlayerId).filter((id) => partyCardCount(s, id) > 3);
      for (const id of crowded) {
        s.promptQueue.push({
          kind: 'choosePartyCard',
          playerId: id,
          reason: 'Brawling Spirit: your Party has more than 3 cards — you must SACRIFICE one (a Hero or an equipped Item).',
          optional: false,
          scope: 'own',
          mode: 'sacrifice',
          filter: 'any',
        });
      }
      if (crowded.length === 0) pushLog(s, byPlayerId, 'Brawling Spirit: no Party has more than 3 cards.', 'normal');
      break;
    }
    case 'gruesome-gladiator':
      // "Look at each other player's hand. Choose a card from each player's hand and add it to your hand."
      for (const id of seatsFrom(s, byPlayerId)) {
        if (id === byPlayerId || handOf(s, id).length === 0) continue;
        s.promptQueue.push(lookAtHandPrompt(s, byPlayerId, id, 'any', `Gruesome Gladiator: choose a card from ${seatName(s, id)}'s hand to take.`));
      }
      break;
    case 'meowntain':
      s.turnBuffs.rollBonus += 5;
      pushLog(s, byPlayerId, 'Meowntain: +5 to all of your rolls until the end of your turn!', 'good');
      s.promptQueue.push({
        kind: 'choosePartyCard',
        playerId: byPlayerId,
        reason: 'Meowntain: SACRIFICE a card (a Hero or an equipped Item).',
        optional: false,
        scope: 'own',
        mode: 'sacrifice',
        filter: 'any',
      });
      break;
    case 'rabid-beast':
      s.promptQueue.push({
        kind: 'choosePartyCard',
        playerId: byPlayerId,
        reason: rabidBeastReason(0),
        optional: true,
        scope: 'own',
        mode: 'sacrifice',
        filter: 'any',
        effectTag: 'rabidBeastSacrifice',
        tally: 0,
      });
      break;
    case 'roaryal-guard':
      s.promptQueue.push({
        kind: 'chooseClass',
        playerId: byPlayerId,
        reason: "Roaryal Guard: choose a Class — every Hero of that Class returns to its player's hand.",
        classes: classesInGame(s),
        effectTag: 'roaryalGuard',
      });
      break;
    case 'unbridled-fury':
      s.promptQueue.push({
        kind: 'chooseHeroTarget',
        playerId: byPlayerId,
        reason: 'Unbridled Fury: DESTROY a Hero card (a Berserker gives you an extra action point).',
        optional: false,
        scope: 'others',
        mode: 'destroy',
        effectTag: 'unbridledFuryDestroy',
      });
      break;
    case 'vicious-wildcat':
      s.promptQueue.push({
        kind: 'chooseMonster',
        playerId: byPlayerId,
        reason: 'Vicious Wildcat: SLAY any Monster card — then your turn ends.',
        mode: 'slay',
      });
      break;

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

/** The rest of an effect once a 'choosePartyCard' choice is made. */
function afterPartyCardChosen(s: HtsState, prompt: Extract<HtsPrompt, { kind: 'choosePartyCard' }>, at: number) {
  const by = prompt.playerId;
  switch (prompt.effectTag) {
    case 'rabidBeastSacrifice':
      // "SACRIFICE any number of cards, then DESTROY the same number of cards." Ask for another.
      s.promptQueue.splice(at, 0, { ...prompt, tally: (prompt.tally ?? 0) + 1, reason: rabidBeastReason((prompt.tally ?? 0) + 1) });
      break;
    case 'boneCollectorCost':
      queueDiscardSearch(s, by, 'hero', 'Bone Collector: choose a Hero card from the discard pile — it goes to your hand, then you play it immediately.', { then: 'playImmediately', at });
      break;
    default:
      break;
  }
}

function rabidBeastReason(tally: number): string {
  return `Rabid Beast: SACRIFICE a card (${tally} so far) — or stop, then DESTROY that many cards.`;
}

function queueRabidBeastDestroys(s: HtsState, playerId: PlayerId, n: number) {
  for (let i = n; i >= 1; i--) {
    s.promptQueue.unshift({
      kind: 'choosePartyCard',
      playerId,
      reason: `Rabid Beast (${i} of ${n}): DESTROY a card in another player's Party.`,
      optional: false,
      scope: 'others',
      mode: 'destroy',
      filter: 'any',
    });
  }
}

/** Glowing Antler: "You may play up to 2 Magic cards immediately." — one at a time. */
function glowingAntlerPrompt(playerId: PlayerId, n: 1 | 2): HtsPrompt {
  return {
    kind: 'chooseCardsFromHand',
    playerId,
    reason: `Glowing Antler (${n} of 2): you may play a Magic card from your hand immediately.`,
    count: 1,
    optional: true,
    filter: 'magic',
    effectTag: 'playFreeMagicsUpTo2',
    sequence: n,
  };
}

function resolveMagicEffect(s: HtsState, byPlayerId: PlayerId, card: HtsCard) {
  switch (card.kind) {
    case 'call-to-the-fallen':
      queueDiscardSearch(s, byPlayerId, 'hero', 'Call to the Fallen: choose a Hero card from the discard pile to add to your hand.');
      break;
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
    // Warriors & Druids
    case 'beast-call': {
      // "Move all face-up Monster cards to the bottom of the Monster deck and
      // flip the top 3 cards from the Monster deck face up. You may spend an
      // extra action point this turn." (The extra point is pure upside: taken.)
      s.monsterDeck.push(...s.monsterRow);
      s.monsterRow = s.monsterDeck.splice(0, 3);
      if (byPlayerId === s.turnPlayerId) s.actionPointsRemaining += 1;
      pushLog(s, byPlayerId, `Beast Call: new Monsters prowl in — ${s.monsterRow.map((m) => m.card.name).join(', ')}. +1 action point this turn.`, 'good');
      break;
    }
    case 'rapid-refresh': {
      // "DISCARD every card in your hand (if you have any) and DRAW 4 cards."
      const hand = handOf(s, byPlayerId);
      s.discard.push(...hand);
      s.hands[byPlayerId] = [];
      drawCards(s, byPlayerId, 4);
      pushLog(s, byPlayerId, 'Rapid Refresh: discarded their hand and drew 4 cards.', 'good');
      break;
    }

    // Berserkers & Necromancers
    case 'lightning-labrys':
      // "DISCARD up to 3 cards. For each card discarded, choose a player. That player must SACRIFICE a Hero card."
      s.promptQueue.push({
        kind: 'chooseCardsFromHand',
        playerId: byPlayerId,
        reason: 'Lightning Labrys: DISCARD up to 3 cards — for each, choose a player who must SACRIFICE a Hero card.',
        count: 3,
        upTo: true,
        optional: true,
        filter: 'any',
        effectTag: 'lightningLabrysDiscard',
      });
      break;
    case 'mass-sacrifice': {
      // "DISCARD your hand, then DRAW 5 cards."
      const hand = handOf(s, byPlayerId);
      s.discard.push(...hand);
      s.hands[byPlayerId] = [];
      drawCards(s, byPlayerId, 5);
      pushLog(s, byPlayerId, 'Mass Sacrifice: discarded their hand and drew 5 cards.', 'good');
      break;
    }
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
  if (heroHasItemKind(hero, 'sealing-key')) throw new Error('Sealing Key prevents using this Hero ability');
  if (!canRollHero(hero)) throw new Error('Hero ability already used this turn');
  const cost = heroRollCost(hero);
  requireTurnAction(s, a.playerId, cost);

  s.actionPointsRemaining -= cost;
  hero.usedThisTurn = true;
  hero.rollsThisTurn = (hero.rollsThisTurn ?? 0) + 1;

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
  queueDiscardSearch(s, a.playerId, 'any', 'The Gnawing Dread: choose a card from the discard pile to add to your hand.');
  pushLog(s, a.playerId, `The Gnawing Dread: ${seatName(s, a.playerId)} spent 2 AP to search the discard pile!`, 'good');
  advanceFlow(s);
}

/** Muscipula Rex: "Once per turn on your turn, you may DRAW a card without spending an action point." */
export function canMuscipulaDraw(s: HtsState, playerId: PlayerId): boolean {
  return s.subPhase === 'awaitingAction' && playerId === s.turnPlayerId && hasTrophy(s, playerId, 'monster-muscipula-rex') && !s.turnBuffs.muscipulaUsed;
}

function handleMuscipulaDraw(s: HtsState, a: Extract<HtsAction, { type: 'muscipulaDraw' }>) {
  if (!canMuscipulaDraw(s, a.playerId)) throw new Error('no free Muscipula Rex draw available');
  s.turnBuffs.muscipulaUsed = true;
  drawCards(s, a.playerId, 1);
  pushLog(s, a.playerId, `Muscipula Rex: ${seatName(s, a.playerId)} draws a card for free.`, 'normal');
  advanceFlow(s);
}

function handleBiggestRingDiscard(s: HtsState, a: Extract<HtsAction, { type: 'biggestRingDiscard' }>) {
  if (s.subPhase !== 'awaitingModifiers' || !s.pendingRoll) throw new Error('Biggest Ring Ever works on your own Hero roll');
  const r = s.pendingRoll;
  if (!canUseBiggestRing(s, r, a.playerId)) throw new Error('Biggest Ring Ever cannot be used on this roll');
  const ids = a.cardIds;
  if (ids.length < 1 || ids.length > 3 || new Set(ids).size !== ids.length) throw new Error('discard 1 to 3 different cards');
  const hand = handOf(s, a.playerId);
  if (ids.some((id) => !hand.some((c) => c.id === id))) throw new Error('card not in hand');
  s.discard.push(...hand.filter((c) => ids.includes(c.id)));
  s.hands[a.playerId] = hand.filter((c) => !ids.includes(c.id));
  const ring = heroEquippedItems(partyOf(s, a.playerId).find((h) => h.card.id === r.sourceCardId)!).find((i) => i.kind === 'biggest-ring-ever')!;
  r.ringUsed = true;
  r.modifiers.push({ playerId: a.playerId, card: ring, amount: 2 * ids.length, targetSide: 'actor' });
  pushLog(s, a.playerId, `Biggest Ring Ever: ${seatName(s, a.playerId)} discards ${ids.length} card${ids.length === 1 ? '' : 's'} for +${2 * ids.length}.`, 'good');
  openOrResolveRoll(s);
}

function handleMajestelkSign(s: HtsState, a: Extract<HtsAction, { type: 'majestelkSign' }>) {
  if (s.subPhase !== 'awaitingModifiers' || !s.pendingRoll) throw new Error('Majestelk adjusts one of your rolls');
  const r = s.pendingRoll;
  const owed = majestelkSidesOwed(s, r, a.playerId);
  const side = a.targetSide && owed.includes(a.targetSide) ? a.targetSide : owed[0];
  if (!side) throw new Error('no Majestelk choice owed on this roll');
  if (a.sign !== 1 && a.sign !== -1) throw new Error('Majestelk is +5 or -5');
  r.modifiers.push({ playerId: a.playerId, card: MAJESTELK_SIGN, amount: 5 * a.sign, targetSide: side });
  pushLog(s, a.playerId, `Majestelk: ${a.sign > 0 ? '+5' : '-5'} to ${seatName(s, a.playerId)}'s roll.`, a.sign > 0 ? 'good' : 'normal');
  openOrResolveRoll(s);
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
  if (!canPlayChallengeCard(s, a.playerId, hand[idx]!)) throw new Error(`you need a ${hand[idx]!.challengeClass} in your Party to play that Challenge`);
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
  if (challengeCard?.challengeBonus) s.pendingRoll.challengerBonus = challengeCard.challengeBonus;
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
  if (!modifierValuesFor(r, a.playerId, card).includes(a.chosenValue)) {
    throw new Error('invalid modifier value for this card');
  }

  hand.splice(idx, 1);
  // B&N Modifier +7: "DISCARD your hand. +7 to that roll."
  if (card.kind === 'mod-bn-plus-7' && hand.length > 0) {
    s.discard.push(...hand);
    s.hands[a.playerId] = [];
    pushLog(s, a.playerId, `${seatName(s, a.playerId)} discards their hand for Modifier +7.`, 'danger');
  }

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

  // W&D Modifiers that also draw: +1/-1 "DRAW 2 cards", +2/-1 "DRAW a card".
  const extraDraw = card.kind === 'mod-wd-plus-1-minus-1' ? 2 : card.kind === 'mod-wd-plus-2-minus-1' ? 1 : 0;
  if (extraDraw > 0) drawCards(s, a.playerId, extraDraw);

  openOrResolveRoll(s);
}

function handleDeclineModifier(s: HtsState, a: Extract<HtsAction, { type: 'declineModifier' }>) {
  if (s.subPhase !== 'awaitingModifiers') throw new Error('no roll open');
  const r = s.pendingRoll;
  if (!r) throw new Error('no pendingRoll');
  if (r.responderQueue[0] !== a.playerId) throw new Error('not your turn to respond');
  if (majestelkSidesOwed(s, r, a.playerId).length > 0) throw new Error('Majestelk: choose +5 or -5 for your roll first');

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
        hero.rollsThisTurn = (hero.rollsThisTurn ?? 0) + 1;
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
      } else if (prompt.mode === 'swapGive' && prompt.specificPlayerId) {
        removeHeroFromParty(s, target.ownerId, target.hero.card.id, 'move', {
          toPlayerId: prompt.specificPlayerId,
          announce: `${seatName(s, prompt.playerId)} moved ${target.hero.card.name} to ${seatName(s, prompt.specificPlayerId)}'s Party.`,
        });
      } else if (prompt.mode === 'steal') {
        removeHeroFromParty(s, target.ownerId, target.hero.card.id, 'steal', {
          byPlayerId: prompt.playerId,
          toPlayerId: prompt.playerId,
          announce: `${seatName(s, prompt.playerId)} stole ${target.hero.card.name} from ${seatName(s, target.ownerId)}!`,
        });
        if (prompt.effectTag === 'wigglesStealAndRoll') {
          s.promptQueue.unshift({
            kind: 'rollEnteredHero',
            playerId: prompt.playerId,
            heroCard: target.hero.card,
          });
        }
      } else if (prompt.mode === 'sacrifice') {
        const queued = s.promptQueue.length;
        removeHeroFromParty(s, target.ownerId, target.hero.card.id, 'sacrifice', {
          byPlayerId: prompt.playerId,
          announce: `${seatName(s, prompt.playerId)} sacrificed ${target.hero.card.name}.`,
        });
        // Beholden Retriever's cost is paid: "Search the discard pile for a Hero
        // or Item card and add it to your hand, then play it immediately."
        if (prompt.effectTag === 'beholdenCost') {
          queueDiscardSearch(s, prompt.playerId, 'heroOrItem', 'Beholden Retriever: choose a Hero or Item card from the discard pile — it goes to your hand, then you play it immediately.', { then: 'playImmediately', at: s.promptQueue.length - queued });
        }
      } else if (prompt.mode === 'destroy') {
        const berserker = heroEffectiveClass(target.hero) === 'berserker';
        const res = removeHeroFromParty(s, target.ownerId, target.hero.card.id, 'destroy', {
          byPlayerId: prompt.playerId,
          stealEquippedItemToHand: prompt.effectTag === 'shurikittyDestroy' ? prompt.playerId : undefined,
          announce: `${seatName(s, prompt.playerId)} destroyed ${target.hero.card.name}!`,
        });
        // Unbridled Fury: "If that Hero card is a Berserker, you may spend an extra action point this turn."
        if (prompt.effectTag === 'unbridledFuryDestroy' && berserker && res === 'done' && prompt.playerId === s.turnPlayerId) {
          s.actionPointsRemaining += 1;
          pushLog(s, prompt.playerId, 'Unbridled Fury: that was a Berserker — +1 action point this turn.', 'good');
        }
      }

      advanceFlow(s);
      return;
    }

    case 'chooseCardsFromHand': {
      if (a.decline) {
        if (!prompt.optional) throw new Error('cannot decline mandatory hand choice');
        // Boston Terror: "If they do not, you may choose 2 cards from the discard pile…"
        if (prompt.effectTag === 'bostonTerrorGive' && prompt.toPlayerId) queueBostonTerrorPicks(s, prompt.toPlayerId);
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
      } else if (prompt.effectTag === 'playFreeMagic' || prompt.effectTag === 'snowballFreeMagic' || prompt.effectTag === 'playFreeMagicsUpTo2') {
        const magic = chosen[0];
        if (magic) {
          if (prompt.effectTag === 'snowballFreeMagic') {
            s.promptQueue.unshift({ kind: 'step', playerId: prompt.playerId, step: { type: 'draw', count: 1 } });
          }
          // Glowing Antler: the second Magic is offered once the first has resolved.
          const next = prompt.effectTag === 'playFreeMagicsUpTo2' && (prompt.sequence ?? 1) < 2 ? [glowingAntlerPrompt(prompt.playerId, 2)] : undefined;
          pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} played Magic card ${magic.name}.`, 'normal');
          beginPlay(s, prompt.playerId, magic, undefined, next);
          return;
        }
      } else if ((prompt.effectTag === 'greedyCheeksGive' || prompt.effectTag === 'bostonTerrorGive') && prompt.toPlayerId) {
        handOf(s, prompt.toPlayerId).push(...chosen);
        if (prompt.effectTag === 'bostonTerrorGive') pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} gives ${seatName(s, prompt.toPlayerId)} a card.`, 'normal');
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
        } else if (prompt.effectTag === 'shadowSaintCost') {
          s.turnBuffs.noOpponentModifiers = true;
          pushLog(s, prompt.playerId, 'Shadow Saint: no other player can play Modifier cards until the end of the turn!', 'good');
        } else if (prompt.effectTag === 'lightningLabrysDiscard') {
          for (let i = chosen.length; i >= 1; i--) {
            s.promptQueue.unshift({
              kind: 'choosePlayer',
              playerId: prompt.playerId,
              reason: `Lightning Labrys (${i} of ${chosen.length}): choose a player who must SACRIFICE a Hero card.`,
              optional: false,
              effectTag: 'lightningLabrysSacrifice',
            });
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
      if (!targetId || (targetId === prompt.playerId && !prompt.includeSelf) || !s.seats.some((st) => st.id === targetId)) {
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
      } else if (prompt.effectTag === 'silentShadowSteal') {
        if (oppHand.length > 0) {
          s.promptQueue.unshift(lookAtHandPrompt(s, prompt.playerId, targetId, 'any', `Silent Shadow: choose a card from ${seatName(s, targetId)}'s hand to take.`));
        }
      } else if (prompt.effectTag === 'bostonTerrorAsk') {
        if (oppHand.length > 0) {
          s.promptQueue.unshift({
            kind: 'chooseCardsFromHand',
            playerId: targetId,
            reason: `Boston Terror: you may give ${seatName(s, prompt.playerId)} a card from your hand. If you don't, they may take 2 cards from the discard pile.`,
            count: 1,
            optional: true,
            filter: 'any',
            effectTag: 'bostonTerrorGive',
            toPlayerId: prompt.playerId,
          });
        } else {
          queueBostonTerrorPicks(s, prompt.playerId);
        }
      } else if (prompt.effectTag === 'hollowHuskLook') {
        if (oppHand.length > 0) {
          s.promptQueue.unshift(lookAtHandPrompt(s, prompt.playerId, targetId, 'magic', `Hollow Husk: ${seatName(s, targetId)}'s hand — take a Magic card (you may play it immediately).`, 'mayPlay'));
        }
      } else if (prompt.effectTag === 'lightningLabrysSacrifice') {
        s.promptQueue.unshift({
          kind: 'chooseHeroTarget',
          playerId: targetId,
          reason: `Lightning Labrys: ${seatName(s, prompt.playerId)} chose you — you must SACRIFICE a Hero card.`,
          optional: false,
          scope: 'own',
          mode: 'sacrifice',
        });
      } else if (prompt.effectTag === 'buckOmensLook') {
        // "Look at another player's hand. Choose a Hero card from their hand (if
        // they have one) and bring it into your Party." Not played: no
        // Challenge, no free roll.
        if (oppHand.length > 0) {
          s.promptQueue.unshift(lookAtHandPrompt(s, prompt.playerId, targetId, 'hero', `Buck Omens: ${seatName(s, targetId)}'s hand — choose a Hero card to bring into your Party.`, 'bringToParty'));
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
      const pickable = pickablePileCards(prompt);
      if (a.decline) {
        // Optional searches, and a look at a hand with nothing to take, end here.
        if (!prompt.optional && pickable.length > 0) throw new Error('you must choose a card');
        advanceFlow(s);
        return;
      }
      const chosen = pickable.find((c) => c.id === a.targetCardId);
      if (!chosen) throw new Error('invalid card selection');

      // Take it from where it lies.
      if (prompt.source === 'discard' || prompt.source === 'bearyWisePool') {
        const dIdx = s.discard.findIndex((c) => c.id === chosen.id);
        if (dIdx < 0) throw new Error('that card is no longer in the discard pile');
        s.discard.splice(dIdx, 1);
      } else if (prompt.source === 'opponentHand' && prompt.opponentId) {
        const oppHand = handOf(s, prompt.opponentId);
        const oIdx = oppHand.findIndex((c) => c.id === chosen.id);
        if (oIdx < 0) throw new Error('that card is no longer in their hand');
        oppHand.splice(oIdx, 1);
      }

      const then = prompt.then ?? 'hand';
      if (then === 'bringToParty' && chosen.type === 'hero') {
        partyOf(s, prompt.playerId).push({ card: chosen, equippedItem: null, usedThisTurn: false });
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} brings ${chosen.name} into their Party.`, 'good');
        advanceFlow(s);
        return;
      }
      handOf(s, prompt.playerId).push(chosen);
      if (then === 'playImmediately') {
        // "…add it to your hand, then play it immediately" — played from the
        // hand, so it can be Challenged (an Item asks which Hero wears it).
        playFromHandNow(s, prompt.playerId, chosen);
        return;
      }
      if (then === 'mayPlay') {
        const filter = chosen.type === 'hero' ? 'hero' : chosen.type === 'magic' ? 'magic' : 'item';
        s.promptQueue.unshift({
          kind: 'chooseCardsFromHand',
          playerId: prompt.playerId,
          // No card name: the other players are told this prompt's reason.
          reason: 'You may play the card you just took immediately.',
          count: 1,
          optional: true,
          filter,
          effectTag: filter === 'hero' ? 'playFreeHero' : filter === 'magic' ? 'playFreeMagic' : 'playFreeItem',
          onlyCardIds: [chosen.id],
        });
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
        removeHeroFromParty(s, prompt.ownerId, prompt.heroCardId, 'destroy', {
          byPlayerId: prompt.playerId,
          skipSabretoothCheck: true,
          stealEquippedItemToHand: prompt.stealItemToHand ? prompt.playerId : undefined,
          announce: `${seatName(s, prompt.playerId)} destroyed the Hero.`,
        });
      } else {
        removeHeroFromParty(s, prompt.ownerId, prompt.heroCardId, 'steal', {
          byPlayerId: prompt.playerId,
          toPlayerId: prompt.playerId,
          announce: `Corrupted Sabretooth: ${seatName(s, prompt.playerId)} STOLE the Hero instead of destroying it!`,
        });
      }
      advanceFlow(s);
      return;
    }

    case 'choosePartyCard': {
      if (a.decline) {
        if (!prompt.optional) throw new Error('you must choose a card');
        if (prompt.effectTag === 'rabidBeastSacrifice') queueRabidBeastDestroys(s, prompt.playerId, prompt.tally ?? 0);
        advanceFlow(s);
        return;
      }
      const target = validPartyCardTargets(s, prompt).find((t) => (t.item ? t.item.id : t.hero.card.id) === a.targetCardId);
      if (!target) throw new Error('invalid card choice');
      const { ownerId, hero, item } = target;
      const queued = s.promptQueue.length;
      if (prompt.mode === 'sacrifice') {
        if (item) sacrificeItem(s, ownerId, hero, item.id);
        else removeHeroFromParty(s, ownerId, hero.card.id, 'sacrifice', { byPlayerId: prompt.playerId, announce: `${seatName(s, prompt.playerId)} sacrificed ${hero.card.name}.` });
      } else if (item) {
        destroyItem(s, prompt.playerId, ownerId, hero, item.id);
      } else {
        removeHeroFromParty(s, ownerId, hero.card.id, 'destroy', { byPlayerId: prompt.playerId, announce: `${seatName(s, prompt.playerId)} destroyed ${hero.card.name}!` });
      }
      // What the sacrifice / destroy itself set off goes first.
      afterPartyCardChosen(s, prompt, s.promptQueue.length - queued);
      advanceFlow(s);
      return;
    }

    case 'chooseClass': {
      const cls = a.className;
      if (!cls || !prompt.classes.includes(cls)) throw new Error('choose one of the classes');
      // Roaryal Guard: "Return every Hero card of that Class to its respective player's hand."
      let returned = 0;
      for (const seat of s.seats) {
        const party = partyOf(s, seat.id);
        for (const h of party.filter((x) => heroEffectiveClass(x) === cls)) {
          party.splice(party.indexOf(h), 1);
          returnHeroToHand(s, seat.id, h);
          returned++;
        }
      }
      pushLog(s, prompt.playerId, `Roaryal Guard: ${seatName(s, prompt.playerId)} names ${CLASS_LABEL[cls]} — ${returned} Hero${returned === 1 ? '' : 'es'} return to their players' hands.`, 'danger');
      advanceFlow(s);
      return;
    }

    case 'rerollHero': {
      if (a.decline) {
        advanceFlow(s);
        return;
      }
      if (!a.dice) throw new Error('roll the dice');
      const hero = partyOf(s, prompt.playerId).find((h) => h.card.id === prompt.heroCardId);
      if (!hero) throw new Error('that Hero is gone');
      sacrificeItem(s, prompt.playerId, hero, prompt.itemCardId);
      hero.rollsThisTurn = (hero.rollsThisTurn ?? 0) + 1;
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

    case 'chooseMonster': {
      const monster = validMonsterTargets(s, prompt).find((m) => m.card.id === a.targetCardId);
      if (!monster) throw new Error('choose one of the face-up Monsters you can target');
      if (prompt.mode === 'attack') {
        // Big Buckley: an ATTACK like any other (bonuses, Modifiers, penalty), for no action points.
        if (!a.dice) throw new Error('roll the dice to attack');
        pushLog(s, prompt.playerId, `${seatName(s, prompt.playerId)} attacks ${monster.card.name}!`, 'normal');
        s.pendingRoll = {
          byPlayerId: prompt.playerId,
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
        return;
      }
      // Vicious Wildcat: "SLAY any Monster card, then end your turn."
      slayMonster(s, prompt.playerId, monster);
      pushLog(s, prompt.playerId, `⚔️ ${seatName(s, prompt.playerId)} SLEW ${monster.card.name} outright!`, 'good');
      if (prompt.playerId === s.turnPlayerId) s.endTurnPending = true;
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

    default: {
      const never: never = prompt;
      throw new Error(`unknown prompt ${JSON.stringify(never)}`);
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
    for (const h of partyOf(s, seat.id)) {
      h.usedThisTurn = false;
      if (h.rollsThisTurn) h.rollsThisTurn = 0;
    }
  }

  const idx = s.seats.findIndex((st) => st.id === s.turnPlayerId);
  const next = s.seats[(idx + 1) % s.seats.length]!;
  s.turnPlayerId = next.id;
  s.activePlayerId = next.id;
  s.subPhase = 'awaitingAction';
  s.actionPointsRemaining = hasTrophy(s, next.id, 'monster-mega-slime') ? 4 : 3;
  s.turnBuffs = freshTurnBuffs();
  // "Until your next turn" effects end as that player's turn begins.
  s.protectedFromSteal[next.id] = false;
  s.protectedFromDestroy[next.id] = false;
  if (s.returnToHandShield?.[next.id]) s.returnToHandShield[next.id] = false;
  if (s.majestelk?.[next.id]) s.majestelk[next.id] = false;
}

function freshTurnBuffs(): HtsState['turnBuffs'] {
  return {
    rollBonus: 0,
    unchallengeable: false,
    shadowClawUsed: false,
    nobleShamanUsed: false,
    gnawingDreadUsed: false,
    noOpponentModifiers: false,
    attackBonus: 0,
    silentShield: false,
    muscipulaUsed: false,
  };
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
    case 'muscipulaDraw':
      handleMuscipulaDraw(s, action);
      break;
    case 'biggestRingDiscard':
      handleBiggestRingDiscard(s, action);
      break;
    case 'majestelkSign':
      handleMajestelkSign(s, action);
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
