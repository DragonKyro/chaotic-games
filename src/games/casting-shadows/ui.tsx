// Casting Shadows — lobby config + in-game view, on the shared table kit.
//
// Layout: opponents' plates (caster, HP crystals, shadow energy, statuses,
// public spells) · the hex map with the focused hex's details · the dock
// (what you must decide) · your area (caster, AP, the turn's gem dice, your
// spell book). Counterspells stay face-down for everyone but their owner;
// the dice are public.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { randomSeed } from '@/core/rng';
import { isLive, livePlayerIds, seatName } from '@/core/state';
import type { PlayerId, Seat } from '@/core/types';
import {
  CardFan, Chip, Die, Dock, ExpansionPicker, FxLayer, GameLog, GameOverPanel, GameTable, Inspect, Panel, PlayerPlate,
  PlayerStrip, TurnCue, useFx, usePulse,
} from '@/ui/kit';
import { CasterArt, characterName, CostRow, ELEMENT, elementOf, GemIconSvg } from './art';
import { HexMap } from './Board';
import { CardView, TierLine } from './Card';
import {
  areHexesAdjacent, CS_ALL_CHARACTERS, getCharactersForExpansions, isHexInSpellRange, rollFiveResourceDice, rollSingleDieForIndex,
} from './cards';
import { boardOf, canAffordCost, canCollectCard, combinedPool, getShadowAbilityCost } from './reducer';
import type { CsAction, CsCard, CsConfig, CsExpansionId, CsHexId, CsPlayerBoard, CsResource, CsState } from './types';
import { CS_EXPANSIONS } from './types';

const BOOK_LIMIT = 5;
const DIE_TONE = ['red', 'red', 'blue', 'blue', 'purple'] as const;

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
  const pick = (seatId: PlayerId, charId: string) => {
    const map: Record<PlayerId, string> = {};
    seats.forEach((st, i) => { map[st.id] = st.id === seatId ? charId : chosenFor(st.id, i); });
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
                {available.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`cs-lobby-caster${chosen === c.id ? ' is-on' : ''}`}
                    disabled={readOnly}
                    title={`${c.lightName} / ${c.shadowName} — ${c.shadowAbilityText}`}
                    aria-pressed={chosen === c.id}
                    onClick={() => pick(seat.id, c.id)}
                  >
                    <CasterArt characterId={c.id} />
                  </button>
                ))}
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

const hexIds = (s: CsState) => Object.keys(s.hexes) as CsHexId[];
const enemiesOf = (s: CsState, me: PlayerId) => livePlayerIds(s).filter((id) => id !== me);
const charOf = (characterId: string) => CS_ALL_CHARACTERS.find((c) => c.id === characterId);

/** Who / where a spell can hit from where you stand; null when it needs no target. */
function spellTargets(s: CsState, me: PlayerId, spell: CsCard): { players: PlayerId[]; hexes: CsHexId[] } | null {
  if (spell.type !== 'attackSpell') return null;
  const range = spell.range ?? 'sameOrAdjacent';
  const here = boardOf(s, me).hexId;
  if (spell.targetsAllOnHex) {
    const hexes = hexIds(s).filter((h) => isHexInSpellRange(s.hexes, here, h, range) && enemiesOf(s, me).some((e) => boardOf(s, e).hexId === h));
    return { players: [], hexes };
  }
  return { players: enemiesOf(s, me).filter((e) => isHexInSpellRange(s.hexes, here, boardOf(s, e).hexId, range)), hexes: [] };
}

type AbilityNeed =
  | { kind: 'none' }
  | { kind: 'player'; options: PlayerId[] }
  | { kind: 'hex'; options: CsHexId[] };

/** Mirrors who each shadow ability can be pointed at (the reducer picks a default when none is given). */
function abilityNeed(s: CsState, me: PlayerId): AbilityNeed {
  const b = boardOf(s, me);
  const enemies = enemiesOf(s, me);
  const sameHex = enemies.filter((e) => boardOf(s, e).hexId === b.hexId);
  const near = enemies.filter((e) => isHexInSpellRange(s.hexes, b.hexId, boardOf(s, e).hexId, 'sameOrAdjacent'));
  switch (b.characterId) {
    case 'frill':
    case 'nyx':
      return { kind: 'player', options: near };
    case 'nuzzle':
    case 'dread':
      return { kind: 'player', options: sameHex };
    case 'talon':
      return sameHex.length ? { kind: 'none' } : { kind: 'player', options: enemies };
    case 'haze':
      return { kind: 'hex', options: hexIds(s).filter((h) => areHexesAdjacent(s.hexes[b.hexId], s.hexes[h])) };
    default:
      return { kind: 'none' };
  }
}

/** Collecting this needs a spell to make room (an upgrade, or a full book). */
function replacementFor(b: CsPlayerBoard, card: CsCard | null): CsCard[] | null {
  const level = card?.level ?? 1;
  if (level < 2 && b.spellBook.length < BOOK_LIMIT) return null;
  const req = level === 3 ? 2 : 1;
  return b.spellBook.filter((c) => c.level >= req);
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
  const cap = b.form === 'shadow' ? 5 : 3;
  return (
    <span className="cs-energy" title={`Shadow energy ${b.shadowEnergy} / ${cap}`}>
      {Array.from({ length: cap }, (_, i) => <i key={i} className={i < b.shadowEnergy ? 'is-on' : undefined} />)}
    </span>
  );
}

function StatusChips({ b }: { b: CsPlayerBoard }) {
  return (
    <>
      {b.stunned && <Chip tone="accent" title="Loses 1 AP next turn">Stunned</Chip>}
      {b.frozen && <Chip title="Cannot travel until the ice breaks">Frozen</Chip>}
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
  | { k: 'cast'; spellId: number; tier: number | null }
  | { k: 'ability' }
  | { k: 'replace'; counter: boolean };

interface ViewProps {
  state: CsState;
  localPlayerId: PlayerId | null;
  dispatch: (action: CsAction) => void;
}

export function GameView({ state: s, localPlayerId: me, dispatch }: ViewProps) {
  const [mode, setMode] = useState<Mode>({ k: 'idle' });
  const [reroll, setReroll] = useState<number[]>([]);
  const [focusHex, setFocusHex] = useState<CsHexId | null>(null);
  const [escapeHex, setEscapeHex] = useState<CsHexId | null>(null);
  const fx = useFx();
  const [eclipse, flashEclipse] = usePulse(900);

  // Any move resets half-made decisions.
  useEffect(() => {
    setMode({ k: 'idle' });
    setReroll([]);
  }, [s.logSeq]);

  const alive = me != null && !!s.boards[me] && isLive(s, me);
  const myBoard = alive ? boardOf(s, me!) : null;
  const myTurn = alive && s.turnPlayerId === me;
  const acting = myTurn && s.subPhase === 'awaitingAction' && s.phase === 'playing';
  const ap = s.actionPointsRemaining;
  const pool = combinedPool(s);
  const turnSeat = s.seats.find((x) => x.id === s.turnPlayerId) ?? null;
  const activeSeat = s.seats.find((x) => x.id === s.activePlayerId) ?? null;
  const nameOf = (id: PlayerId | null | undefined) => seatName(s, id ?? null);

  // ---- dice tumbles: a fresh roll tumbles all five, a reroll only the changed ones
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
    if (s.counterspellDiscard.length > was.counterspellDiscard.length && was.pendingAttack) {
      fx.stamp('DISPELLED!', 'good');
    }
    const tb = s.boards[s.turnPlayerId];
    const wb = was.boards[s.turnPlayerId];
    if (tb && wb && s.turnPlayerId === was.turnPlayerId) {
      if (tb.usedSpellIdsThisTurn.length > wb.usedSpellIdsThisTurn.length) {
        const spell = wb.spellBook.find((c) => c.id === tb.usedSpellIdsThisTurn[tb.usedSpellIdsThisTurn.length - 1]) ?? tb.spellBook.find((c) => c.id === tb.usedSpellIdsThisTurn[tb.usedSpellIdsThisTurn.length - 1]);
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
  const castTargets = castSpell && mode.k === 'cast' && mode.tier !== null ? spellTargets(s, me!, castSpell) : null;
  const need = mode.k === 'ability' && alive ? abilityNeed(s, me!) : null;
  const runAway = !!myBoard && s.subPhase === 'awaitingCounterspell' && s.activePlayerId === me && myBoard.spellBook.some((c) => c.kind === 'run-away');
  const adjacentToMe = myBoard ? hexIds(s).filter((h) => areHexesAdjacent(s.hexes[myBoard.hexId], s.hexes[h])) : [];
  const chosenEscape = escapeHex && adjacentToMe.includes(escapeHex) ? escapeHex : adjacentToMe[0] ?? null;

  const targetPlayers: Set<PlayerId> | null =
    castTargets && castTargets.players.length ? new Set(castTargets.players)
    : need?.kind === 'player' && need.options.length ? new Set(need.options)
    : null;
  const targetHexes: Set<CsHexId> | null =
    castTargets && castTargets.hexes.length ? new Set(castTargets.hexes)
    : need?.kind === 'hex' ? new Set(need.options)
    : runAway ? new Set(adjacentToMe)
    : null;

  const reachable = useMemo(() => {
    if (!acting || !myBoard || myBoard.frozen || ap < 1 || mode.k !== 'idle') return new Set<CsHexId>();
    return new Set(hexIds(s).filter((h) => areHexesAdjacent(s.hexes[myBoard.hexId], s.hexes[h])));
  }, [acting, myBoard, ap, mode.k, s]);

  function fireCast(spell: CsCard, tier: number, target?: { player?: PlayerId; hex?: CsHexId }) {
    if (!me || !myBoard) return;
    dispatch({
      type: 'castSpell',
      playerId: me,
      spellId: spell.id,
      tierIndex: tier,
      ...(target?.player ? { targetPlayerId: target.player } : {}),
      targetHexId: target?.hex ?? myBoard.hexId,
    });
  }

  function fireAbility(target?: { player?: PlayerId; hex?: CsHexId }) {
    if (!me) return;
    dispatch({
      type: 'useShadowAbility',
      playerId: me,
      ...(target?.player ? { targetPlayerId: target.player } : {}),
      ...(target?.hex ? { targetHexId: target.hex } : {}),
    });
  }

  function chooseTier(spell: CsCard, tier: number) {
    if (!spellTargets(s, me!, spell)) fireCast(spell, tier);
    else setMode({ k: 'cast', spellId: spell.id, tier });
  }

  function onPlayerTarget(pid: PlayerId) {
    if (castSpell && mode.k === 'cast' && mode.tier !== null) fireCast(castSpell, mode.tier, { player: pid });
    else if (mode.k === 'ability') fireAbility({ player: pid });
  }

  function onHexClick(h: CsHexId) {
    if (castSpell && mode.k === 'cast' && mode.tier !== null && targetHexes?.has(h)) return fireCast(castSpell, mode.tier, { hex: h });
    if (mode.k === 'ability' && need?.kind === 'hex' && need.options.includes(h)) return fireAbility({ hex: h });
    if (runAway && adjacentToMe.includes(h)) return setEscapeHex(h);
    setFocusHex((cur) => (cur === h ? null : h));
  }

  function collect(counter: boolean) {
    if (!me || !myBoard) return;
    const hex = s.hexes[myBoard.hexId];
    const room = replacementFor(myBoard, counter ? null : hex.faceUpCard);
    if (room) setMode({ k: 'replace', counter });
    else dispatch({ type: 'collectCard', playerId: me, fromCounterspellDeck: counter });
  }

  function onBookCard(c: CsCard): (() => void) | undefined {
    if (!acting || !myBoard) return undefined;
    if (mode.k === 'replace') {
      const hex = s.hexes[myBoard.hexId];
      const room = replacementFor(myBoard, mode.counter ? null : hex.faceUpCard) ?? [];
      if (!room.some((x) => x.id === c.id)) return undefined;
      return () => dispatch({ type: 'collectCard', playerId: me!, fromCounterspellDeck: mode.counter, replaceSpellId: c.id });
    }
    if (!c.castTiers?.length || myBoard.usedSpellIdsThisTurn.includes(c.id) || ap < 1) return undefined;
    return () => {
      if (mode.k === 'cast' && mode.spellId === c.id) return setMode({ k: 'idle' });
      const tiers = c.castTiers!;
      const affordable = tiers.map((t) => canAffordCost(s, t.cost));
      if (tiers.length === 1 && affordable[0]) {
        const t = spellTargets(s, me!, c);
        if (!t) return fireCast(c, 0);
        return setMode({ k: 'cast', spellId: c.id, tier: 0 });
      }
      setMode({ k: 'cast', spellId: c.id, tier: null });
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
  const canBuyCounter = acting && onMyHex && ap >= 1 && hex.id === 'dusty-desert' && canAffordCost(s, { anyGem: 1, anyOrb: 1 }) && s.counterspellDeck.length + s.counterspellDiscard.length > 0;
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
              <span className="cs-hexinfo-effect">Collect for <CostRow cost={hex.faceUpCard.collectionCost} size={14} /></span>
              {acting && onMyHex && (
                <>
                  <button disabled={!canCollectHere} onClick={() => collect(false)} title={canCollectHere ? undefined : 'Not enough gems, or it needs a lower-level spell to upgrade'}>Collect · 1 AP</button>
                  {hex.hasMainDeckSlot && <button className="secondary" disabled={ap < 1} onClick={() => dispatch({ type: 'refreshHexCard', playerId: me! })}>Refresh · 1 AP</button>}
                </>
              )}
            </div>
          </div>
        )}
        {hex.id === 'dusty-desert' && acting && onMyHex && (
          <button disabled={!canBuyCounter} onClick={() => collect(true)}>Take a Counterspell · 1 AP</button>
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
                    onClick={() => dispatch({ type: 'respondCounterspell', playerId: me!, counterspellId: c.id, ...(c.kind === 'run-away' && chosenEscape ? { escapeHexId: chosenEscape } : {}) })}
                  />
                ))}
                <button className="secondary" onClick={() => dispatch({ type: 'respondCounterspell', playerId: me! })}>Take {atk.damage} damage</button>
              </>
            }
          >
            {counters.length ? 'Reveal a counterspell to answer it — or take the hit.' : 'No counterspells in your book.'}
            {atk.unreducible && ' This damage cannot be reduced.'}
            {runAway && (
              <div className="cs-choices">
                <span className="cs-hexinfo-effect">Run Away! to:</span>
                {adjacentToMe.map((h) => (
                  <button key={h} className={`secondary tiny${chosenEscape === h ? ' is-on' : ''}`} onClick={() => setEscapeHex(h)}>{s.hexes[h].name}</button>
                ))}
              </div>
            )}
          </Dock>
        );
      }
      return <Dock tone="wait" who={activeSeat} eyebrow={`${activeSeat?.name ?? 'Someone'} may counter`} title={`${nameOf(atk.attackerId)} hurls ${atk.damage} damage at ${nameOf(atk.targetId)}`} />;
    }
    if (s.subPhase === 'awaitingRoll') {
      if (!myTurn) return <Dock tone="wait" who={turnSeat} title={`${turnSeat?.name ?? 'Someone'} is about to roll`} />;
      const yields: CsResource[] = [];
      const hy = s.hexes[myBoard!.hexId]?.startTurnResource;
      if (hy) yields.push(hy);
      for (const c of myBoard!.spellBook) if (c.type === 'resource' && c.grantsResource) yields.push(c.grantsResource);
      return (
        <Dock
          tone="turn"
          eyebrow="Your turn · phase 1"
          title="Roll the gem dice"
          actions={<button onClick={() => dispatch({ type: 'rollResourceDice', playerId: me!, dice: rollFiveResourceDice({ seed: randomSeed() }) })}>Roll ✦</button>}
        >
          {yields.length ? <>You also gain {yields.map((r, i) => <GemIconSvg key={i} icon={r} size={16} />)} this turn.</> : 'Five dice: two red, two blue, one purple.'}
          {myBoard!.hexId === 'ancient-rune' && ' Ancient Rune grants you a fifth action point.'}
          {myBoard!.stunned && ' You are Stunned: one fewer action point.'}
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
          A familiar answers your shadow. Choose who walks beside you.
        </Dock>
      );
    }
    // awaitingAction
    if (!acting) return <Dock tone="wait" who={turnSeat} title={`${turnSeat?.name ?? 'Someone'} is weaving spells · ${ap} AP left`} />;
    const b = myBoard!;
    if (mode.k === 'replace') {
      const card = mode.counter ? null : s.hexes[b.hexId].faceUpCard;
      return (
        <Dock tone="turn" eyebrow="Make room" title={`Collect ${card?.name ?? 'a Counterspell'}`} actions={<button className="secondary" onClick={() => setMode({ k: 'idle' })}>Cancel</button>}>
          {card && card.level >= 2 ? 'An upgrade replaces a spell in your book.' : 'Your spell book is full.'} Click the card in your book to let go of.
        </Dock>
      );
    }
    if (mode.k === 'cast' && castSpell) {
      const tiers = castSpell.castTiers ?? [];
      const chosen = mode.tier;
      const t = chosen !== null ? spellTargets(s, me!, castSpell) : null;
      return (
        <Dock tone="turn" eyebrow={`Casting · ${ap} AP`} title={`Cast ${castSpell.name}`} actions={<button className="secondary" onClick={() => setMode({ k: 'idle' })}>Cancel</button>}>
          {chosen === null ? 'Choose how much to pour into it:' : t && t.players.length + t.hexes.length === 0 ? 'Nobody is in range.' : t?.hexes.length ? 'Choose a hex to strike — click it on the map.' : 'Choose your target — click their plate or orb.'}
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
              <button key={h} className="secondary" onClick={() => fireCast(castSpell, chosen, { hex: h })}>{s.hexes[h].name}</button>
            ))}
          </div>
        </Dock>
      );
    }
    if (mode.k === 'ability' && need) {
      const def = charOf(b.characterId);
      return (
        <Dock tone="turn" eyebrow={`Shadow ability · ${getShadowAbilityCost(b)} energy`} title={def?.shadowName ?? 'Shadow ability'} actions={
          <>
            {need.kind === 'none' && <button onClick={() => fireAbility()}>Unleash</button>}
            {need.kind === 'player' && need.options.length === 0 && <button onClick={() => fireAbility()}>Unleash anyway</button>}
            <button className="secondary" onClick={() => setMode({ k: 'idle' })}>Cancel</button>
          </>
        }>
          {def?.shadowAbilityText}
          {need.kind !== 'none' && (
            <div className="cs-choices">
              {need.kind === 'player' && need.options.map((pid) => {
                const seat = s.seats.find((x) => x.id === pid)!;
                return <button key={pid} className="secondary cs-target-btn" onClick={() => fireAbility({ player: pid })}><i style={{ background: seat.color }} />{seat.name}</button>;
              })}
              {need.kind === 'hex' && need.options.map((h) => <button key={h} className="secondary" onClick={() => fireAbility({ hex: h })}>{s.hexes[h].name}</button>)}
            </div>
          )}
        </Dock>
      );
    }
    const fragments = pool.filter((r) => r === 'shadowFragment').length;
    const canTransform = b.form === 'light' && b.shadowEnergy + fragments >= 3;
    const curses = pool.filter((r) => r === 'cursedCrystal').length;
    const pain = (b.companion?.kind === 'cursemaster-raccoon' ? 0 : curses) + (b.burning ? 1 : 0);
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
        {ap > 0 ? 'Click a spell in your book to cast it, or a glowing hex to travel.' : 'Absorb your shadow to end the turn.'}
        {fragments > 0 && ` Ending absorbs ${fragments} shadow fragment${fragments === 1 ? '' : 's'}.`}
        {pain > 0 && <strong> You will take {pain} damage at the end of your turn.</strong>}
      </Dock>
    );
  }

  // ---- your area: caster · dice · spell book ------------------------------------------
  const poolOwner = s.subPhase === 'awaitingAction' || s.subPhase === 'awaitingCounterspell' ? s.turnPlayerId : null;
  const myDiceTurn = acting;
  const toggleDie = (i: number) => setReroll((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  const curseInPool = pool.includes('cursedCrystal');
  const myself = me ? s.seats.find((x) => x.id === me) : undefined;
  const meDef = myBoard ? charOf(myBoard.characterId) : undefined;
  const abilityReady = acting && !!myBoard && myBoard.form === 'shadow' && !myBoard.usedShadowAbilityThisTurn && myBoard.shadowEnergy >= getShadowAbilityCost(myBoard);

  const poolView = (
    <section className="cs-you-section">
      <h4 className="cs-you-title">
        {poolOwner ? (poolOwner === me ? 'Your gem dice' : `${nameOf(poolOwner)}'s gem dice`) : 'Gem dice'}
        {myDiceTurn && reroll.length > 0 && <small>{reroll.length} picked</small>}
      </h4>
      {poolOwner && (s.dicePool.length + s.bonusPool.length) > 0 ? (
        <div className="cs-pool">
          {s.dicePool.map((r, i) => {
            const pickable = myDiceTurn && r !== 'cursedCrystal' && ap >= 1;
            return (
              <span
                key={`d${i}`}
                className={`cs-die cs-die-${DIE_TONE[i] ?? 'token'}${pickable ? ' is-pickable' : ''}${reroll.includes(i) ? ' is-picked' : ''}`}
                onClick={pickable ? () => toggleDie(i) : undefined}
                role={pickable ? 'button' : undefined}
                aria-pressed={pickable ? reroll.includes(i) : undefined}
              >
                <Die value={<GemIconSvg icon={r} size={28} />} rollKey={dieKeys[i] ?? 0} size={44} />
              </span>
            );
          })}
          {s.bonusPool.map((r, i) => (
            <span key={`b${i}`} className="cs-die cs-die-token is-token" title="Bonus token (hex, resource card or companion)">
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
              dispatch({ type: 'rerollDice', playerId: me!, diceIndices: reroll, newValues: reroll.map((i) => rollSingleDieForIndex(rng, i)) });
            }}
          >
            {reroll.length ? `Reroll ${reroll.length} · 1 AP` : 'Pick dice to reroll'}
          </button>
          {curseInPool && (
            <button
              className="secondary"
              disabled={ap < 1}
              onClick={() => {
                // Occult Octo strikes an adjacent hex when you Protect: aim it at the busiest one.
                const octo = myBoard!.companion?.kind === 'occult-octo'
                  ? [...adjacentToMe].sort((x, y) => enemiesOf(s, me!).filter((e) => boardOf(s, e).hexId === y).length - enemiesOf(s, me!).filter((e) => boardOf(s, e).hexId === x).length)[0]
                  : undefined;
                dispatch({ type: 'protect', playerId: me!, clearStatus: 'cursedCrystal', ...(octo ? { targetHexId: octo } : {}) });
              }}
            >
              Protect: purge <GemIconSvg icon="cursedCrystal" size={14} /> · 1 AP
            </button>
          )}
          {myBoard!.burning && <button className="secondary" disabled={ap < 1} onClick={() => dispatch({ type: 'protect', playerId: me!, clearStatus: 'burning' })}>Put out the burn · 1 AP</button>}
          {myBoard!.frozen && <button className="secondary" disabled={ap < 1} onClick={() => dispatch({ type: 'unfreeze', playerId: me! })}>Break the ice · 1 AP</button>}
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
                {myBoard.usedShadowAbilityThisTurn ? 'Shadow spent this turn' : `Shadow ability · ${getShadowAbilityCost(myBoard)} ◐`}
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
          Spell book {myBoard && <small>{myBoard.spellBook.length} / {BOOK_LIMIT}</small>}
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
                    footnote={mode.k === 'replace' && click ? 'let go' : undefined}
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

