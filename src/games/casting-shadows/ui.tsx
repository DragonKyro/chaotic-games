// Casting Shadows — lobby config + in-game view, on the shared table kit.
//
// Layout: opponents' plates (caster, HP crystals, shadow energy, statuses,
// public spells) · the hex map with the focused hex's details · the dock
// (what you must decide) · your area (caster, AP, the turn's gem dice, your
// spell book). Counterspells stay face-down for everyone but their owner;
// the dice are public.
//
// Every decision the rules give a player is asked here, never picked for them:
// targets, tiers, which spell to give up, where Run Away! runs to, which die a
// Stunned caster leaves out, Nuzzle's HP sacrifice, every "you may" offer.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { randomSeed } from '@/core/rng';
import { isLive, seatName } from '@/core/state';
import type { PlayerId, Seat } from '@/core/types';
import {
  CardFan, Chip, Die, Dock, ExpansionPicker, FxLayer, GameLog, GameOverPanel, GameTable, Inspect, Panel, PlayerPlate,
  PlayerStrip, TurnCue, useFx, usePulse,
} from '@/ui/kit';
import { CasterArt, characterName, CostRow, ELEMENT, elementOf, GemIconSvg } from './art';
import { HexMap } from './Board';
import { CardView, TierLine } from './Card';
import { CS_ALL_CHARACTERS, getCharactersForExpansions, rollDiceSlots, rollDieSlot } from './cards';
import {
  adjacentHexIds, boardOf, canAffordCost, canCollectCard, canCollectCounterspell, canUseShadowAbility, combinedPool,
  COUNTERSPELL_COST, energyLimit, enemiesInTurnOrder, getShadowAbilityCost, legalCounterspells, protectOptions,
  roomNeededFor, shadowAbilityTargets, SHADOW_ENERGY_LIMIT, SPELLBOOK_LIMIT, spellTargetOptions, travelDestinations,
} from './reducer';
import type { CsAction, CsCard, CsConfig, CsExpansionId, CsHexId, CsPlayerBoard, CsResource, CsState } from './types';
import { CS_EXPANSIONS } from './types';

const DIE_TONE = ['red', 'red', 'blue', 'blue', 'purple'] as const;
const RESOURCE_NAME: Record<CsResource, string> = {
  redGem: 'Red Gem',
  blueGem: 'Blue Gem',
  purpleGem: 'Purple Gem',
  redOrb: 'Red Orb',
  blueOrb: 'Blue Orb',
  purpleOrb: 'Purple Orb',
  shadowFragment: 'Shadow Fragment',
  cursedCrystal: 'Cursed Crystal',
};

// ============================================================================
// Lobby
// ============================================================================

export function LobbyConfig({ config, seats, onChange, readOnly }: {
  config: CsConfig;
  seats: Seat[];
  onChange: (c: CsConfig) => void;
  readOnly?: boolean;
}) {
  const available = getCharactersForExpansions(config.expansions);
  const chosenFor = (seatId: PlayerId, idx: number) => {
    const cur = config.characterByPlayer[seatId];
    return cur && available.some((c) => c.id === cur) ? cur : available[idx % available.length]!.id;
  };
  const toggle = (expId: string) => {
    const id = expId as CsExpansionId;
    const next = config.expansions.includes(id) ? config.expansions.filter((x) => x !== id) : [...config.expansions, id];
    const nextAvail = getCharactersForExpansions(next);
    const map: Record<PlayerId, string> = {};
    seats.forEach((seat, idx) => {
      const cur = config.characterByPlayer[seat.id];
      map[seat.id] = cur && nextAvail.some((c) => c.id === cur) ? cur : nextAvail[idx % nextAvail.length]!.id;
    });
    onChange({ ...config, expansions: next, characterByPlayer: map });
  };
  // Each Character has one Player Board: picking one another seat holds swaps the two.
  const pick = (seatId: PlayerId, charId: string) => {
    const map: Record<PlayerId, string> = {};
    seats.forEach((st, i) => { map[st.id] = chosenFor(st.id, i); });
    const mine = map[seatId]!;
    for (const st of seats) if (st.id !== seatId && map[st.id] === charId) map[st.id] = mine;
    map[seatId] = charId;
    onChange({ ...config, characterByPlayer: map });
  };
  return (
    <div className="game-config">
      <ExpansionPicker
        title="Expansions · 5–6 players need one"
        expansions={CS_EXPANSIONS}
        enabled={config.expansions}
        onToggle={toggle}
        readOnly={readOnly}
      />
      <div className="cs-lobby-casters">
        {seats.map((seat, idx) => {
          const chosen = chosenFor(seat.id, idx);
          const def = available.find((c) => c.id === chosen);
          return (
            <div key={seat.id} className="cs-lobby-seat">
              <span className="cs-lobby-seat-name" style={{ '--seat': seat.color } as CSSProperties}>
                <i />{seat.name} <small>{def ? `${def.lightName} → ${def.shadowName}` : ''}</small>
              </span>
              <span className="cs-lobby-pick">
                {available.map((c) => {
                  const takenBy = seats.find((st, i) => st.id !== seat.id && chosenFor(st.id, i) === c.id);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      className={`cs-lobby-caster${chosen === c.id ? ' is-on' : ''}`}
                      disabled={readOnly}
                      title={`${c.lightName} / ${c.shadowName} — ${c.shadowAbilityText}${takenBy ? ` (swaps with ${takenBy.name})` : ''}`}
                      aria-pressed={chosen === c.id}
                      onClick={() => pick(seat.id, c.id)}
                    >
                      <CasterArt characterId={c.id} />
                    </button>
                  );
                })}
              </span>
            </div>
          );
        })}
      </div>
      <p className="lobby-hint" style={{ margin: 0 }}>
        Last caster standing wins. Each turn: roll five gem dice, spend 4 action points to travel, cast, reroll,
        protect, refresh or collect — then absorb your shadow. Three shadow energy turns you into your Shadow Form.
      </p>
    </div>
  );
}

// ============================================================================
// Derived, UI-side helpers (pure; no rules of their own)
// ============================================================================

const charOf = (characterId: string) => CS_ALL_CHARACTERS.find((c) => c.id === characterId);
const enemiesOn = (s: CsState, me: PlayerId, h: CsHexId) => enemiesInTurnOrder(s, me).filter((e) => boardOf(s, e).hexId === h);

/** Who / where a spell can hit from where you stand; null when it needs no target. Hex spells list only occupied hexes. */
function spellTargets(s: CsState, me: PlayerId, spell: CsCard): { players: PlayerId[]; hexes: CsHexId[] } | null {
  if (spell.type !== 'attackSpell') return null;
  const t = spellTargetOptions(s, me, spell);
  return { players: t.players, hexes: t.hexes.filter((h) => enemiesOn(s, me, h).length > 0) };
}

/** HP shown as crystals, with a damage / heal number popping when it moves. */
function HpMeter({ b }: { b: CsPlayerBoard }) {
  const prev = useRef(b.hp);
  const [pop, setPop] = useState<{ key: number; delta: number } | null>(null);
  useEffect(() => {
    const d = b.hp - prev.current;
    prev.current = b.hp;
    if (d !== 0) setPop((p) => ({ key: (p?.key ?? 0) + 1, delta: d }));
  }, [b.hp]);
  return (
    <div className="cs-hp" title={`${b.hp} / ${b.maxHp} HP`}>
      <span className={`cs-hp-bar${b.hp <= 6 ? ' is-low' : ''}`} style={{ '--max': b.maxHp } as CSSProperties}>
        {Array.from({ length: b.maxHp }, (_, i) => <i key={i} className={i < b.hp ? 'is-on' : undefined} />)}
      </span>
      <span className="cs-hp-num">{b.hp}</span>
      {pop && <span key={pop.key} className={`cs-pop ${pop.delta < 0 ? 'is-hurt' : 'is-heal'}`}>{pop.delta > 0 ? `+${pop.delta}` : pop.delta}</span>}
    </div>
  );
}

function EnergyPips({ b }: { b: CsPlayerBoard }) {
  const cap = energyLimit(b);
  return (
    <span className="cs-energy" title={`Shadow energy ${b.shadowEnergy} / ${cap}`}>
      {Array.from({ length: cap }, (_, i) => <i key={i} className={i < b.shadowEnergy ? 'is-on' : undefined} />)}
    </span>
  );
}

function StatusChips({ b }: { b: CsPlayerBoard }) {
  return (
    <>
      {b.stunned && <Chip tone="accent" title="Rolls only 4 Resource dice next turn">Stunned</Chip>}
      {b.frozen && <Chip title="Cannot travel">Frozen</Chip>}
      {b.burning && <Chip tone="danger" title="1 damage at the end of their turn">Burning</Chip>}
      {b.fortified > 0 && <Chip tone="good" title="Absorbs incoming damage">Shield {b.fortified}</Chip>}
    </>
  );
}

// ============================================================================
// Game view
// ============================================================================

type Mode =
  | { k: 'idle' }
  | { k: 'cast'; spellId: number; tier: number | null; hexes: CsHexId[] }
  | { k: 'ability' }
  | { k: 'replace'; counter: boolean }
  | { k: 'runAway'; counterspellId: number }
  | { k: 'protect' };

interface ViewProps {
  state: CsState;
  localPlayerId: PlayerId | null;
  dispatch: (action: CsAction) => void;
}

export function GameView({ state: s, localPlayerId: me, dispatch }: ViewProps) {
  const [mode, setMode] = useState<Mode>({ k: 'idle' });
  const [reroll, setReroll] = useState<number[]>([]);
  const [focusHex, setFocusHex] = useState<CsHexId | null>(null);
  const fx = useFx();
  const [eclipse, flashEclipse] = usePulse(900);

  // Any move resets half-made decisions.
  useEffect(() => {
    setMode({ k: 'idle' });
    setReroll([]);
  }, [s.logSeq, s.subPhase]);

  const alive = me != null && !!s.boards[me] && isLive(s, me);
  const myBoard = alive ? boardOf(s, me!) : null;
  const myTurn = alive && s.turnPlayerId === me;
  const acting = myTurn && s.subPhase === 'awaitingAction' && s.phase === 'playing';
  const ap = s.actionPointsRemaining;
  const pool = combinedPool(s);
  const turnSeat = s.seats.find((x) => x.id === s.turnPlayerId) ?? null;
  const activeSeat = s.seats.find((x) => x.id === s.activePlayerId) ?? null;
  const nameOf = (id: PlayerId | null | undefined) => seatName(s, id ?? null);

  // ---- dice tumbles: a fresh roll tumbles every die, a reroll only the changed ones
  const [dieKeys, setDieKeys] = useState<number[]>([]);
  const prevDice = useRef<{ phase: string; pool: CsResource[] }>({ phase: s.subPhase, pool: s.dicePool });
  useEffect(() => {
    const was = prevDice.current;
    prevDice.current = { phase: s.subPhase, pool: s.dicePool };
    if (was.phase === 'awaitingRoll' && s.subPhase === 'awaitingAction') {
      setDieKeys((k) => s.dicePool.map((_, i) => (k[i] ?? 0) + 1));
    } else if (was.pool.length === s.dicePool.length && was.pool.some((r, i) => r !== s.dicePool[i])) {
      setDieKeys((k) => s.dicePool.map((r, i) => (r !== was.pool[i] ? (k[i] ?? 0) + 1 : k[i] ?? 0)));
    }
  }, [s.subPhase, s.dicePool]);

  // ---- table FX, from state transitions ---------------------------------------
  const prev = useRef(s);
  useEffect(() => {
    const was = prev.current;
    prev.current = s;
    if (was === s) return;
    if (s.eliminated.length > was.eliminated.length) {
      const fallen = s.eliminated[s.eliminated.length - 1];
      fx.stamp('FALLEN!', 'danger');
      fx.toast(`${nameOf(fallen)} has fallen to the shadows.`, 'danger');
      fx.burst([0.5, 0.4], '#ff5a6a');
    }
    for (const seat of s.seats) {
      const a = was.boards[seat.id];
      const b = s.boards[seat.id];
      if (a && b && a.form === 'light' && b.form === 'shadow') {
        fx.stamp('SHADOW FORM', 'accent');
        fx.burst([0.5, 0.45], '#b06bff');
        flashEclipse();
      }
    }
    // A used Counterspell goes to the bottom of its deck.
    if (was.pendingAttack && s.counterspellDeck.length > was.counterspellDeck.length) fx.stamp('DISPELLED!', 'good');
    const tb = s.boards[s.turnPlayerId];
    const wb = was.boards[s.turnPlayerId];
    if (tb && wb && s.turnPlayerId === was.turnPlayerId) {
      if (tb.usedSpellIdsThisTurn.length > wb.usedSpellIdsThisTurn.length) {
        const id = tb.usedSpellIdsThisTurn[tb.usedSpellIdsThisTurn.length - 1];
        const spell = wb.spellBook.find((c) => c.id === id) ?? tb.spellBook.find((c) => c.id === id);
        if (spell) fx.toast(`${nameOf(s.turnPlayerId)} casts ${spell.name}`, spell.type === 'attackSpell' ? 'danger' : 'accent');
      }
      if (tb.usedShadowAbilityThisTurn && !wb.usedShadowAbilityThisTurn) {
        fx.toast(`${characterName(charOf(tb.characterId), 'shadow')} unleashes their shadow`, 'danger');
      }
    }
    if (s.phase === 'gameOver' && was.phase !== 'gameOver') {
      fx.burst([0.5, 0.35], '#7cf5ff');
      if (s.winnerId === me) fx.stamp('VICTORY', 'good');
    }
  }, [s]);

  // ---- targeting --------------------------------------------------------------
  const castSpell = mode.k === 'cast' && myBoard ? myBoard.spellBook.find((c) => c.id === mode.spellId) ?? null : null;
  const castTier = castSpell && mode.k === 'cast' && mode.tier !== null ? castSpell.castTiers?.[mode.tier] ?? null : null;
  const castTargets = castSpell && castTier ? spellTargets(s, me!, castSpell) : null;
  const need = mode.k === 'ability' && alive ? shadowAbilityTargets(s, me!) : null;
  const runChoices = mode.k === 'runAway' && myBoard ? adjacentHexIds(s, myBoard.hexId) : null;
  const octoChoices = mode.k === 'protect' && myBoard ? adjacentHexIds(s, myBoard.hexId) : null;

  const targetPlayers: Set<PlayerId> | null =
    castTargets && castTargets.players.length ? new Set(castTargets.players)
    : need?.kind === 'player' && need.options.length ? new Set(need.options)
    : null;
  const targetHexes: Set<CsHexId> | null =
    castTargets && castTargets.hexes.length ? new Set(castTargets.hexes)
    : need?.kind === 'hex' ? new Set(need.options)
    : runChoices ? new Set(runChoices)
    : octoChoices ? new Set(octoChoices)
    : null;

  const reachable = useMemo(() => {
    if (!acting || !myBoard || ap < 1 || mode.k !== 'idle') return new Set<CsHexId>();
    return new Set(travelDestinations(s, me!));
  }, [acting, myBoard, ap, mode.k, s, me]);

  function fireCast(spell: CsCard, tier: number, target?: { player?: PlayerId; hexes?: CsHexId[] }) {
    if (!me || !myBoard) return;
    const hexes = target?.hexes ?? [];
    dispatch({
      type: 'castSpell',
      playerId: me,
      spellId: spell.id,
      tierIndex: tier,
      ...(target?.player ? { targetPlayerId: target.player } : {}),
      ...(hexes.length > 1 ? { targetHexIds: hexes } : hexes.length === 1 ? { targetHexId: hexes[0] } : {}),
    });
  }

  function fireAbility(target?: { player?: PlayerId; hex?: CsHexId; amount?: number }) {
    if (!me) return;
    dispatch({
      type: 'useShadowAbility',
      playerId: me,
      ...(target?.player ? { targetPlayerId: target.player } : {}),
      ...(target?.hex ? { targetHexId: target.hex } : {}),
      ...(target?.amount ? { amount: target.amount } : {}),
    });
  }

  function chooseTier(spell: CsCard, tier: number) {
    if (!spellTargets(s, me!, spell)) fireCast(spell, tier);
    else setMode({ k: 'cast', spellId: spell.id, tier, hexes: [] });
  }

  /** Pick a hex for a hex spell; multi-hex tiers (Sudden Doom) fire once enough are picked. */
  function pickCastHex(h: CsHexId) {
    if (!castSpell || !castTier || mode.k !== 'cast' || mode.tier === null) return;
    const want = castTier.hexCount ?? 1;
    const next = mode.hexes.includes(h) ? mode.hexes.filter((x) => x !== h) : [...mode.hexes, h];
    if (next.length >= want) fireCast(castSpell, mode.tier, { hexes: next.slice(0, want) });
    else setMode({ ...mode, hexes: next });
  }

  function onPlayerTarget(pid: PlayerId) {
    if (castSpell && castTier && mode.k === 'cast' && mode.tier !== null) fireCast(castSpell, mode.tier, { player: pid });
    else if (mode.k === 'ability') fireAbility({ player: pid });
  }

  function fireProtect(octoHex?: CsHexId) {
    if (!me || !myBoard) return;
    const total = pool.filter((r) => r === 'cursedCrystal').length;
    dispatch({
      type: 'protect',
      playerId: me,
      clearStatus: 'cursedCrystal',
      ...(octoHex ? { targetHexId: octoHex } : {}),
      ...(myBoard.companion?.kind === 'swamp-monster' ? { count: total } : {}),
    });
  }

  function onHexClick(h: CsHexId) {
    if (castSpell && castTier && targetHexes?.has(h)) return pickCastHex(h);
    if (mode.k === 'ability' && need?.kind === 'hex' && need.options.includes(h)) return fireAbility({ hex: h });
    if (mode.k === 'runAway' && runChoices?.includes(h)) {
      return dispatch({ type: 'respondCounterspell', playerId: me!, counterspellId: mode.counterspellId, escapeHexId: h });
    }
    if (mode.k === 'protect' && octoChoices?.includes(h)) return fireProtect(h);
    setFocusHex((cur) => (cur === h ? null : h));
  }

  function collect(counter: boolean) {
    if (!me || !myBoard) return;
    const hex = s.hexes[myBoard.hexId];
    const room = roomNeededFor(s, me, counter ? null : hex.faceUpCard);
    if (room && room.length > 1) setMode({ k: 'replace', counter });
    else dispatch({ type: 'collectCard', playerId: me, fromCounterspellDeck: counter, ...(room?.[0] ? { replaceSpellId: room[0].id } : {}) });
  }

  function onBookCard(c: CsCard): (() => void) | undefined {
    if (!acting || !myBoard) return undefined;
    if (mode.k === 'replace') {
      const hex = s.hexes[myBoard.hexId];
      const room = roomNeededFor(s, me!, mode.counter ? null : hex.faceUpCard) ?? [];
      if (!room.some((x) => x.id === c.id)) return undefined;
      return () => dispatch({ type: 'collectCard', playerId: me!, fromCounterspellDeck: mode.counter, replaceSpellId: c.id });
    }
    // A Resource card is spent for its token (no Action point).
    if (c.type === 'resource') return () => dispatch({ type: 'useResourceCard', playerId: me!, cardId: c.id });
    if (!c.castTiers?.length || myBoard.usedSpellIdsThisTurn.includes(c.id) || ap < 1) return undefined;
    return () => {
      if (mode.k === 'cast' && mode.spellId === c.id) return setMode({ k: 'idle' });
      const tiers = c.castTiers!;
      if (tiers.length === 1 && canAffordCost(s, tiers[0]!.cost)) {
        if (!spellTargets(s, me!, c)) return fireCast(c, 0);
        return setMode({ k: 'cast', spellId: c.id, tier: 0, hexes: [] });
      }
      setMode({ k: 'cast', spellId: c.id, tier: null, hexes: [] });
    };
  }

  // ---- opponents ------------------------------------------------------------------
  const opponents = s.seats.filter((x) => x.id !== me);
  const top = (
    <PlayerStrip>
      {opponents.map((o) => {
        const b = s.boards[o.id]!;
        const def = charOf(b.characterId);
        const dead = !isLive(s, o.id);
        const pickable = targetPlayers?.has(o.id) ?? false;
        return (
          <PlayerPlate
            key={o.id}
            seat={o}
            active={!dead && s.turnPlayerId === o.id && s.phase === 'playing'}
            out={dead}
            outLabel="FALLEN"
            sub={`${characterName(def, b.form)} · ${s.hexes[b.hexId]?.name ?? ''}`}
            avatar={<span className={`cs-plate-avatar${b.form === 'shadow' ? ' is-shadow' : ''}`} style={{ '--seat': o.color } as CSSProperties}><CasterArt characterId={b.characterId} form={b.form} /></span>}
            targetable={pickable}
            onClick={pickable ? () => onPlayerTarget(o.id) : undefined}
          >
            {!dead && (
              <>
                <HpMeter b={b} />
                <div className="cs-plate-row">
                  <EnergyPips b={b} />
                  <span className="cs-pips" aria-label={`${b.spellBook.length} cards in their spell book`}>
                    {b.spellBook.map((c) => c.type === 'counterspell'
                      ? <span key={c.id} className="cs-pip is-hidden" title="A hidden counterspell" />
                      : (
                        <Inspect key={c.id} preview={<CardView card={c} size="lg" inspect={false} className="cs-card-preview" />}>
                          <span className="cs-pip" style={{ '--el': ELEMENT[elementOf(c)].main } as CSSProperties} title={c.name} />
                        </Inspect>
                      ))}
                  </span>
                  <StatusChips b={b} />
                  {b.companion && (
                    <Inspect preview={<CardView card={b.companion} size="lg" inspect={false} className="cs-card-preview" />}>
                      <Chip tone="good">✶ {b.companion.name}</Chip>
                    </Inspect>
                  )}
                  {s.activePlayerId === o.id && s.subPhase === 'awaitingCounterspell' && <Chip tone="danger">Deciding…</Chip>}
                </div>
              </>
            )}
          </PlayerPlate>
        );
      })}
    </PlayerStrip>
  );

  // ---- board: map + focused hex --------------------------------------------------
  const infoHex = focusHex ?? myBoard?.hexId ?? s.boards[s.turnPlayerId]?.hexId ?? 'ancient-rune';
  const hex = s.hexes[infoHex];
  const onMyHex = !!myBoard && myBoard.hexId === infoHex;
  const here = s.seats.filter((x) => isLive(s, x.id) && s.boards[x.id]!.hexId === infoHex);
  const canCollectHere = acting && onMyHex && ap >= 1 && !!hex.faceUpCard && canCollectCard(s, me!, hex.faceUpCard);
  const canBuyCounter = acting && onMyHex && ap >= 1 && canCollectCounterspell(s, me!);
  const board = (
    <div className="cs-boardwrap">
      <div className="cs-mapframe">
        <HexMap
          state={s}
          me={me}
          selected={focusHex}
          reachable={reachable}
          targetHexes={targetHexes}
          targetPlayers={targetPlayers}
          onHex={onHexClick}
          onTravel={(h) => me && dispatch({ type: 'travel', playerId: me, toHexId: h })}
          onPlayer={onPlayerTarget}
        />
      </div>
      <Panel className="cs-hexinfo" title={onMyHex ? 'You are here' : focusHex ? 'Hex' : s.turnPlayerId === me ? 'You are here' : `${nameOf(s.turnPlayerId)} is here`}>
        <h4>{hex.name}</h4>
        <p className="cs-hexinfo-effect">
          {hex.startTurnResource && <><GemIconSvg icon={hex.startTurnResource} size={15} /> </>}
          {hex.effectText}
        </p>
        <div className="cs-hexinfo-who">
          {here.length ? here.map((x) => <Chip key={x.id} title={x.name}><i className="cs-dot" style={{ background: x.color }} />{x.name}</Chip>) : <span className="cs-hexinfo-effect">No casters here.</span>}
        </div>
        {hex.faceUpCard && (
          <div className="cs-hexinfo-card">
            <CardView card={hex.faceUpCard} size="sm" />
            <div className="cs-hexinfo-actions">
              <span className="cs-hexinfo-effect">
                Collect for {hex.faceUpCard.requiresSpellLevel ? `a Level ${hex.faceUpCard.requiresSpellLevel} spell + ` : ''}
                <CostRow cost={hex.faceUpCard.collectionCost} size={14} />
              </span>
              {acting && onMyHex && (
                <>
                  <button disabled={!canCollectHere} onClick={() => collect(false)} title={canCollectHere ? undefined : 'Not enough gems, or no spell of the right level to give up'}>Collect · 1 AP</button>
                  {hex.hasMainDeckSlot && <button className="secondary" disabled={ap < 1} onClick={() => dispatch({ type: 'refreshHexCard', playerId: me! })}>Refresh · 1 AP</button>}
                </>
              )}
            </div>
          </div>
        )}
        {hex.id === 'dusty-desert' && acting && onMyHex && (
          <button disabled={!canBuyCounter} onClick={() => collect(true)}>
            Take a Counterspell (<CostRow cost={COUNTERSPELL_COST} size={13} />) · 1 AP
          </button>
        )}
        {reachable.has(infoHex) && <button onClick={() => dispatch({ type: 'travel', playerId: me!, toHexId: infoHex })}>Travel here · 1 AP</button>}
      </Panel>
    </div>
  );

  // ---- dock ---------------------------------------------------------------------------
  function renderDock(): ReactNode {
    if (s.phase === 'gameOver') {
      const winner = s.seats.find((x) => x.id === s.winnerId);
      const wb = winner ? s.boards[winner.id] : undefined;
      return (
        <GameOverPanel
          seats={s.seats}
          finalScores={s.finalScores}
          winnerIds={winner ? [winner.id] : []}
          localPlayerId={me}
          headline={`${winner?.name ?? 'Nobody'} is the last caster standing!`}
          detail={`Fallen, in order: ${s.eliminated.map((id) => nameOf(id)).join(' → ') || '—'}`}
          showScores={false}
          art={wb ? <span className="cs-gameover-art" style={{ '--seat': winner!.color } as CSSProperties}><CasterArt characterId={wb.characterId} form={wb.form} /></span> : undefined}
        />
      );
    }

    if (s.subPhase === 'awaitingCounterspell' && s.pendingAttack) {
      const atk = s.pendingAttack;
      if (s.activePlayerId === me && myBoard) {
        const counters = myBoard.spellBook.filter((c) => c.type === 'counterspell');
        const legal = new Set(legalCounterspells(s, me!).map((c) => c.id));
        if (mode.k === 'runAway' && runChoices) {
          return (
            <Dock tone="react" eyebrow="Run Away!" title="Where do you run to?" actions={<button className="secondary" onClick={() => setMode({ k: 'idle' })}>Back</button>}>
              You still take the {atk.damage} damage, but you get away. Pick an adjacent hex (on the map or here):
              <div className="cs-choices">
                {runChoices.map((h) => (
                  <button key={h} className="secondary" onClick={() => dispatch({ type: 'respondCounterspell', playerId: me!, counterspellId: mode.counterspellId, escapeHexId: h })}>{s.hexes[h].name}</button>
                ))}
              </div>
            </Dock>
          );
        }
        return (
          <Dock
            tone="react"
            eyebrow="Incoming spell"
            title={`${nameOf(atk.attackerId)} hits you for ${atk.damage}!`}
            actions={
              <>
                {counters.map((c) => (
                  <CardView
                    key={c.id}
                    card={c}
                    size="sm"
                    disabled={!legal.has(c.id)}
                    onClick={legal.has(c.id)
                      ? () => (c.kind === 'run-away' ? setMode({ k: 'runAway', counterspellId: c.id }) : dispatch({ type: 'respondCounterspell', playerId: me!, counterspellId: c.id }))
                      : undefined}
                  />
                ))}
                <button className="secondary" onClick={() => dispatch({ type: 'respondCounterspell', playerId: me! })}>Take {atk.damage} damage</button>
              </>
            }
          >
            {legal.size ? 'Reveal a counterspell to answer it — or take the hit.' : 'None of your counterspells answers this.'}
            {atk.unreducible && ' This damage cannot be reduced.'}
          </Dock>
        );
      }
      return <Dock tone="wait" who={activeSeat} eyebrow={`${activeSeat?.name ?? 'Someone'} may counter`} title={`${nameOf(atk.attackerId)} hurls ${atk.damage} damage at ${nameOf(atk.targetId)}`} />;
    }

    if (s.subPhase === 'awaitingOffer' && s.pendingOffer) {
      const offer = s.pendingOffer;
      if (offer.playerId !== me) return <Dock tone="wait" who={activeSeat} title={`${activeSeat?.name ?? 'Someone'} is deciding`} />;
      const no = <button className="secondary" onClick={() => dispatch({ type: 'answerOffer', playerId: me!, accept: false })}>No thanks</button>;
      if (offer.kind === 'hexStatus') {
        const what = offer.effect === 'freeze' ? 'Freeze' : 'Stun';
        return (
          <Dock tone="turn" eyebrow={s.hexes[myBoard!.hexId].name} title={`${what} ${nameOf(offer.targetId)}?`} actions={
            <><button onClick={() => dispatch({ type: 'answerOffer', playerId: me!, accept: true })}>Spend <CostRow cost={offer.cost} size={14} /> to {what.toLowerCase()}</button>{no}</>
          }>
            {offer.effect === 'freeze' ? 'A Frozen caster cannot travel.' : 'A Stunned caster rolls only four dice on their next turn.'}
          </Dock>
        );
      }
      if (offer.kind === 'stagStrike') {
        return (
          <Dock tone="turn" eyebrow="Charging Stag" title="Charge an enemy on an adjacent hex?" actions={
            <>
              {offer.options.map((pid) => {
                const seat = s.seats.find((x) => x.id === pid)!;
                return <button key={pid} className="cs-target-btn" onClick={() => dispatch({ type: 'answerOffer', playerId: me!, accept: true, targetPlayerId: pid })}><i style={{ background: seat.color }} />{seat.name} · 2 DMG</button>;
              })}
              {no}
            </>
          }>
            Spend <CostRow cost={offer.cost} size={14} /> to deal 2 damage.
          </Dock>
        );
      }
      if (offer.kind === 'tortoise') {
        return (
          <Dock tone="turn" eyebrow="Crushing Tortoise" title="Crush an enemy on your hex?" actions={
            <>
              {offer.options.map((pid) => {
                const seat = s.seats.find((x) => x.id === pid)!;
                return <button key={pid} className="cs-target-btn" onClick={() => dispatch({ type: 'answerOffer', playerId: me!, accept: true, targetPlayerId: pid })}><i style={{ background: seat.color }} />{seat.name} · 1 DMG</button>;
              })}
              <button className="secondary" onClick={() => dispatch({ type: 'answerOffer', playerId: me!, accept: false })}>{offer.options.length > 1 ? 'No more' : 'No thanks'}</button>
            </>
          }>
            Ending your turn beside an enemy, your tortoise may deal them 1 damage.
          </Dock>
        );
      }
      return (
        <Dock tone="turn" eyebrow="Recovery Raven" title="Heal 1 HP?" actions={
          <><button onClick={() => dispatch({ type: 'answerOffer', playerId: me!, accept: true })}>Spend <CostRow cost={offer.cost} size={14} /></button>{no}</>
        }>
          Your raven mends you when you cast a conversion spell.
        </Dock>
      );
    }

    if (s.subPhase === 'awaitingStunSteal' && s.pendingStunSteal) {
      const steal = s.pendingStunSteal;
      if (steal.byId !== me) return <Dock tone="wait" who={activeSeat} title={`${activeSeat?.name ?? 'Someone'} is raiding ${nameOf(steal.victimId)}'s resources`} />;
      return (
        <Dock tone="react" eyebrow="You stunned them" title={`Take a resource from ${nameOf(steal.victimId)}?`} actions={
          <>
            {pool.map((r, i) => (
              <button key={i} className="secondary" title={RESOURCE_NAME[r]} onClick={() => dispatch({ type: 'stunSteal', playerId: me!, poolIndex: i })}><GemIconSvg icon={r} size={20} /></button>
            ))}
            <button className="secondary" onClick={() => dispatch({ type: 'stunSteal', playerId: me! })}>Take nothing</button>
          </>
        }>
          Stunning someone on their own turn lets you remove one resource from their pool.
        </Dock>
      );
    }

    if (s.subPhase === 'awaitingRoll') {
      if (!myTurn) return <Dock tone="wait" who={turnSeat} title={`${turnSeat?.name ?? 'Someone'} is about to roll`} />;
      const hy = s.hexes[myBoard!.hexId]?.startTurnResource;
      const roll = (slots: number[]) => dispatch({ type: 'rollResourceDice', playerId: me!, dice: rollDiceSlots({ seed: randomSeed() }, slots), slots });
      if (myBoard!.stunned) {
        return (
          <Dock tone="turn" eyebrow="Your turn · phase 1 · Stunned" title="Roll four gem dice — which one sits out?" actions={
            <>
              <button onClick={() => roll([1, 2, 3, 4])}>Leave out a red die</button>
              <button onClick={() => roll([0, 1, 3, 4])}>Leave out a blue die</button>
              <button onClick={() => roll([0, 1, 2, 3])}>Leave out the purple die</button>
            </>
          }>
            A Stunned caster rolls only four of the five Resource dice.
          </Dock>
        );
      }
      return (
        <Dock tone="turn" eyebrow="Your turn · phase 1" title="Roll the gem dice" actions={<button onClick={() => roll([0, 1, 2, 3, 4])}>Roll ✦</button>}>
          Five dice: two red, two blue, one purple.
          {hy && <> You also gain <GemIconSvg icon={hy} size={16} /> from {s.hexes[myBoard!.hexId].name}.</>}
          {myBoard!.hexId === 'ancient-rune' && ' The Ancient Rune heals you 2 HP.'}
        </Dock>
      );
    }

    if (s.subPhase === 'awaitingCompanionPick') {
      if (!myTurn) return <Dock tone="wait" who={turnSeat} title={`${turnSeat?.name ?? 'Someone'} is summoning a companion`} />;
      return (
        <Dock tone="turn" eyebrow="Shadow form!" title="Summon a companion" actions={
          <div className="cs-choices is-cards">
            {s.companionPortal.map((c) => <CardView key={c.id} card={c} size="md" onClick={() => dispatch({ type: 'pickCompanion', playerId: me!, companionId: c.id })} />)}
          </div>
        }>
          A familiar answers your shadow. Choose who walks beside you — it stays for the rest of the game.
        </Dock>
      );
    }

    // awaitingAction
    if (!acting) return <Dock tone="wait" who={turnSeat} title={`${turnSeat?.name ?? 'Someone'} is weaving spells · ${ap} AP left`} />;
    const b = myBoard!;
    if (mode.k === 'replace') {
      const card = mode.counter ? null : s.hexes[b.hexId].faceUpCard;
      const lvl = card?.requiresSpellLevel;
      return (
        <Dock tone="turn" eyebrow="Make room" title={`Collect ${card?.name ?? 'a Counterspell'}`} actions={<button className="secondary" onClick={() => setMode({ k: 'idle' })}>Cancel</button>}>
          {lvl ? `It costs a Level ${lvl} spell from your book.` : 'Your spell book is full (5 cards) — discard a spell or resource card.'} Click the card in your book to give up.
        </Dock>
      );
    }
    if (mode.k === 'protect' && octoChoices) {
      return (
        <Dock tone="turn" eyebrow="Occult Octo" title="Protect — and lash out?" actions={
          <>
            {octoChoices.map((h) => (
              <button key={h} className="secondary" onClick={() => fireProtect(h)}>
                {s.hexes[h].name}{enemiesOn(s, me!, h).length ? ` (${enemiesOn(s, me!, h).length} enem${enemiesOn(s, me!, h).length === 1 ? 'y' : 'ies'})` : ''}
              </button>
            ))}
            <button className="secondary" onClick={() => fireProtect()}>Just protect</button>
            <button className="secondary" onClick={() => setMode({ k: 'idle' })}>Cancel</button>
          </>
        }>
          Your octopus may deal 1 damage to everyone on an adjacent hex.
        </Dock>
      );
    }
    if (mode.k === 'cast' && castSpell) {
      const tiers = castSpell.castTiers ?? [];
      const chosen = mode.tier;
      const t = chosen !== null ? spellTargets(s, me!, castSpell) : null;
      const want = castTier?.hexCount ?? 1;
      const prompt =
        chosen === null ? 'Choose how much to pour into it:'
        : t && t.players.length + t.hexes.length === 0 ? 'Nobody is in range.'
        : t?.hexes.length ? (want > 1 ? `Choose ${want} hexes to strike (${mode.hexes.length} picked) — click them on the map.` : 'Choose a hex to strike — click it on the map.')
        : 'Choose your target — click their plate or orb.';
      return (
        <Dock tone="turn" eyebrow={`Casting · ${ap} AP`} title={`Cast ${castSpell.name}`} actions={<button className="secondary" onClick={() => setMode({ k: 'idle' })}>Cancel</button>}>
          {prompt}
          <div className="cs-choices">
            {chosen === null && tiers.map((tier, i) => (
              <button key={i} className="secondary cs-tier-btn" disabled={!canAffordCost(s, tier.cost)} onClick={() => chooseTier(castSpell, i)}>
                <TierLine tier={tier} size={16} />
              </button>
            ))}
            {chosen !== null && t?.players.map((pid) => {
              const seat = s.seats.find((x) => x.id === pid)!;
              return (
                <button key={pid} className="secondary cs-target-btn" onClick={() => fireCast(castSpell, chosen, { player: pid })}>
                  <i style={{ background: seat.color }} />{seat.name} · {s.boards[pid]!.hp} HP
                </button>
              );
            })}
            {chosen !== null && t?.hexes.map((h) => (
              <button key={h} className={`secondary${mode.hexes.includes(h) ? ' is-on' : ''}`} onClick={() => pickCastHex(h)}>{s.hexes[h].name}</button>
            ))}
          </div>
        </Dock>
      );
    }
    if (mode.k === 'ability' && need) {
      const def = charOf(b.characterId);
      return (
        <Dock tone="turn" eyebrow={`Shadow ability · spends ${getShadowAbilityCost(b)} energy`} title={def?.shadowName ?? 'Shadow ability'} actions={
          <>
            {need.kind === 'none' && <button onClick={() => fireAbility()}>Unleash</button>}
            {need.kind === 'player' && need.options.length === 0 && <button onClick={() => fireAbility()}>Unleash anyway</button>}
            <button className="secondary" onClick={() => setMode({ k: 'idle' })}>Cancel</button>
          </>
        }>
          {def?.shadowAbilityText}
          <div className="cs-choices">
            {need.kind === 'player' && need.options.map((pid) => {
              const seat = s.seats.find((x) => x.id === pid)!;
              return <button key={pid} className="secondary cs-target-btn" onClick={() => fireAbility({ player: pid })}><i style={{ background: seat.color }} />{seat.name}</button>;
            })}
            {need.kind === 'hex' && need.options.map((h) => <button key={h} className="secondary" onClick={() => fireAbility({ hex: h })}>{s.hexes[h].name}</button>)}
            {need.kind === 'amount' && (need.max > 0
              ? Array.from({ length: need.max }, (_, i) => i + 1).map((n) => (
                <button key={n} className="secondary" onClick={() => fireAbility({ amount: n })}>Give up {n} HP → {n} DMG to each enemy</button>
              ))
              : <span className="cs-hexinfo-effect">You have no HP to spare.</span>)}
          </div>
        </Dock>
      );
    }
    const fragments = pool.filter((r) => r === 'shadowFragment').length;
    const canTransform = b.form === 'light' && Math.min(energyLimit(b), b.shadowEnergy + fragments) >= 3;
    const curses = pool.filter((r) => r === 'cursedCrystal').length;
    const pain = (b.hexId === 'sacred-falls' ? 0 : curses) + (b.burning ? 1 : 0);
    return (
      <Dock
        tone="turn"
        eyebrow={`Your turn · ${ap} action point${ap === 1 ? '' : 's'}`}
        title={ap > 0 ? 'Cast, travel, gather — or end your turn' : 'Out of action points'}
        actions={canTransform ? (
          <>
            <button onClick={() => dispatch({ type: 'transformAndEndTurn', playerId: me!, transform: true })}>End turn &amp; transform ◐</button>
            <button className="secondary" onClick={() => dispatch({ type: 'transformAndEndTurn', playerId: me!, transform: false })}>End turn, stay in light</button>
          </>
        ) : (
          <button onClick={() => dispatch({ type: 'transformAndEndTurn', playerId: me!, transform: true })}>End turn</button>
        )}
      >
        {ap > 0 ? 'Click a spell in your book to cast it (a resource card to spend it), or a glowing hex to travel.' : 'Absorb your shadow to end the turn.'}
        {b.frozen && ' You are Frozen and cannot travel.'}
        {fragments > 0 && ` Ending absorbs ${fragments} shadow fragment${fragments === 1 ? '' : 's'}.`}
        {pain > 0 && <strong> You will take {pain} damage at the end of your turn.</strong>}
      </Dock>
    );
  }

  // ---- your area: caster · dice · spell book ------------------------------------------
  const poolOwner = s.subPhase === 'awaitingRoll' || s.phase === 'gameOver' ? null : s.turnPlayerId;
  const myDiceTurn = acting;
  const toggleDie = (i: number) => setReroll((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  const protects = acting ? protectOptions(s, me!) : [];
  const myself = me ? s.seats.find((x) => x.id === me) : undefined;
  const meDef = myBoard ? charOf(myBoard.characterId) : undefined;
  const abilityReady = acting && canUseShadowAbility(s, me!);
  const raccoon = myBoard?.companion?.kind === 'cursemaster-raccoon';

  const poolView = (
    <section className="cs-you-section">
      <h4 className="cs-you-title">
        {poolOwner ? (poolOwner === me ? 'Your gem dice' : `${nameOf(poolOwner)}'s gem dice`) : 'Gem dice'}
        {myDiceTurn && reroll.length > 0 && <small>{reroll.length} picked</small>}
      </h4>
      {poolOwner && (s.dicePool.length + s.bonusPool.length) > 0 ? (
        <div className="cs-pool">
          {s.dicePool.map((r, i) => {
            const slot = s.diceSlots[i] ?? i;
            const pickable = myDiceTurn && (r !== 'cursedCrystal' || raccoon) && ap >= 1;
            return (
              <span
                key={`d${i}`}
                className={`cs-die cs-die-${DIE_TONE[slot] ?? 'token'}${pickable ? ' is-pickable' : ''}${reroll.includes(i) ? ' is-picked' : ''}`}
                onClick={pickable ? () => toggleDie(i) : undefined}
                role={pickable ? 'button' : undefined}
                aria-pressed={pickable ? reroll.includes(i) : undefined}
                title={RESOURCE_NAME[r]}
              >
                <Die value={<GemIconSvg icon={r} size={28} />} rollKey={dieKeys[i] ?? 0} size={44} />
              </span>
            );
          })}
          {s.bonusPool.map((r, i) => (
            <span key={`b${i}`} className="cs-die cs-die-token is-token" title={`${RESOURCE_NAME[r]} token`}>
              <Die value={<GemIconSvg icon={r} size={24} />} size={38} />
            </span>
          ))}
        </div>
      ) : (
        <div className="cs-pool cs-pool-empty">{s.subPhase === 'awaitingRoll' ? 'Waiting for the roll…' : 'No dice in play.'}</div>
      )}
      {myDiceTurn && (
        <div className="cs-pool-actions">
          <button
            className="secondary"
            disabled={ap < 1 || reroll.length === 0}
            onClick={() => {
              const rng = { seed: randomSeed() };
              dispatch({ type: 'rerollDice', playerId: me!, diceIndices: reroll, newValues: reroll.map((i) => rollDieSlot(rng, s.diceSlots[i] ?? i)) });
            }}
          >
            {reroll.length ? `Reroll ${reroll.length} · 1 AP` : 'Pick dice to reroll'}
          </button>
          {protects.includes('cursedCrystal') && (
            <button
              className="secondary"
              disabled={ap < 1}
              onClick={() => (myBoard!.companion?.kind === 'occult-octo' ? setMode({ k: 'protect' }) : fireProtect())}
            >
              Protect: purge {myBoard!.companion?.kind === 'swamp-monster' ? 'every' : 'one'} <GemIconSvg icon="cursedCrystal" size={14} /> · 1 AP
            </button>
          )}
          {protects.includes('burning') && <button className="secondary" disabled={ap < 1} onClick={() => dispatch({ type: 'protect', playerId: me!, clearStatus: 'burning' })}>Put out the burn · 1 AP</button>}
        </div>
      )}
    </section>
  );

  const hand = (
    <div className="cs-you">
      <section className="cs-you-section">
        {myBoard && myself ? (
          <>
            <div className="cs-me">
              <span className={`cs-me-portrait${myBoard.form === 'shadow' ? ' is-shadow' : ''}`} style={{ '--seat': myself.color } as CSSProperties}>
                <CasterArt characterId={myBoard.characterId} form={myBoard.form} />
              </span>
              <div style={{ minWidth: 0, flex: 1, position: 'relative' }}>
                <div className="cs-me-name">{characterName(meDef, myBoard.form)}</div>
                <HpMeter b={myBoard} />
                <div className="cs-plate-row">
                  <EnergyPips b={myBoard} />
                  {acting && (
                    <span className="cs-ap" title={`${ap} action points left`}>
                      {Array.from({ length: Math.max(ap, 4) }, (_, i) => <i key={i} className={i < ap ? 'is-on' : undefined} />)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="cs-status-chips">
              <StatusChips b={myBoard} />
              {myBoard.companion && (
                <Inspect preview={<CardView card={myBoard.companion} size="lg" inspect={false} className="cs-card-preview" />}>
                  <Chip tone="good">✶ {myBoard.companion.name}</Chip>
                </Inspect>
              )}
            </div>
            {myBoard.form === 'shadow' && (
              <button
                className={abilityReady ? undefined : 'secondary'}
                disabled={!abilityReady}
                onClick={() => setMode((m) => (m.k === 'ability' ? { k: 'idle' } : { k: 'ability' }))}
                title={meDef?.shadowAbilityText}
              >
                {myBoard.usedShadowAbilityThisTurn
                  ? 'Shadow spent this turn'
                  : myBoard.shadowEnergy < SHADOW_ENERGY_LIMIT
                    ? `Shadow ability · charge to ${SHADOW_ENERGY_LIMIT} ◐`
                    : `Shadow ability · ${getShadowAbilityCost(myBoard)} ◐`}
              </button>
            )}
          </>
        ) : (
          <p className="cs-pool-empty">{me ? 'You have fallen. The shadows play on.' : 'Spectating — no caster of your own.'}</p>
        )}
      </section>
      {poolView}
      <section className="cs-you-section cs-you-book">
        <h4 className="cs-you-title">
          Spell book {myBoard && <small>{myBoard.spellBook.length} / {SPELLBOOK_LIMIT}</small>}
        </h4>
        <div className="cs-book">
          {myBoard && myBoard.spellBook.length > 0 ? (
            <CardFan label="Your spell book" maxTilt={6}>
              {myBoard.spellBook.map((c) => {
                const click = onBookCard(c);
                const used = myBoard.usedSpellIdsThisTurn.includes(c.id);
                return (
                  <CardView
                    key={c.id}
                    card={c}
                    size="md"
                    used={used}
                    selected={(mode.k === 'cast' && mode.spellId === c.id)}
                    onClick={click}
                    disabled={!click && acting && !used && mode.k !== 'replace'}
                    footnote={mode.k === 'replace' && click ? 'give up' : c.type === 'resource' && click ? 'spend' : undefined}
                  />
                );
              })}
            </CardFan>
          ) : (
            <p className="cs-book-empty">{myBoard ? 'Empty. Collect spells from the hexes.' : '—'}</p>
          )}
        </div>
      </section>
    </div>
  );

  const side = (
    <>
      <Panel title="The deep">
        <div className="cs-plate-row" style={{ marginTop: 0 }}>
          <Chip title="Main deck">{s.mainDeck.length} spells</Chip>
          <Chip title="Counterspell deck">{s.counterspellDeck.length} counters</Chip>
          <Chip title="Companion portal">{s.companionPortal.length} familiars</Chip>
        </div>
      </Panel>
      <GameLog entries={s.log} seats={s.seats} />
    </>
  );

  return (
    <GameTable
      className={`cs-table${eclipse ? ' is-eclipse' : ''}`}
      top={top}
      board={board}
      side={side}
      dock={renderDock()}
      hand={hand}
      overlay={
        <>
          <FxLayer fx={fx} />
          <TurnCue active={myTurn && s.subPhase === 'awaitingRoll' && s.phase === 'playing'} />
        </>
      }
    />
  );
}
