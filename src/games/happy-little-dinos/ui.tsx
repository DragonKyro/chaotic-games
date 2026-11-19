// Happy Little Dinosaurs — lobby config + in-game view, on the shared table kit.
//
// Hidden information: only `localPlayerId`'s hand and own face-down pick are
// ever drawn face-up. Everyone else's pick is a card back until the reveal;
// deck order is never shown. Cards a prompt lets you see (Dino Grabber's peek
// at a hand, Treenoculars / Good Luck Rod / Fruit Shower's top cards, Really
// Thick Glasses' Disaster) are drawn only in that player's own dock. Bouquet
// of Flowers reveals its cards to everyone, as printed.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import { isLive, livePlayerIds, seatName } from '@/core/state';
import {
  CardFan, Chip, Dock, ExpansionPicker, FxLayer, GameLog, GameOverPanel, GameTable, Panel, PlayerPlate, PlayerStrip,
  TurnCue, useFx, usePulse,
} from '@/ui/kit';
import { EscapeRoute, SceneBackdrop, type TrackRunner } from './Board';
import { DinoCard, DisasterCard, FaceDownCard, PlayCard } from './Card';
import { CATEGORY_LABEL, CategoryIcon } from './CardArt';
import { availableDinos, HLD_DINO_DEFS } from './cards';
import { DinoArt, DinoBadge, type DinoMood } from './DinoArt';
import {
  assignDinos, canPlayDisasterSaveCard, canPlayScoringInstantCard, canSkipDisasterBonus, computeRoundScores, dinoTraitDelta,
  disasterScoringBonus, eliminationRule, isEliminatedByDisasters, selectableDinos, TARGETED_INSTANTS, twoPlayerRules,
  type EliminationRule,
} from './reducer';
import type {
  HldAction, HldCard, HldCardKind, HldConfig, HldDinoId, HldDisasterCard, HldDisasterCategory, HldExpansionId, HldPrompt,
  HldState,
} from './types';
import { HLD_EXPANSIONS } from './types';

// ============================================================================
// Lobby
// ============================================================================

export function LobbyConfig({ config, seats, onChange, readOnly }: {
  config: HldConfig;
  seats: Seat[];
  onChange: (c: HldConfig) => void;
  readOnly?: boolean;
}) {
  const toggle = (id: string) => {
    const has = config.expansions.includes(id as HldExpansionId);
    onChange({
      ...config,
      expansions: has ? config.expansions.filter((x) => x !== id) : [...config.expansions, id as HldExpansionId],
    });
  };
  const pool = availableDinos(config.expansions);
  const setDino = (seatId: PlayerId, dino: HldDinoId) =>
    onChange({ ...config, dinoSelections: { ...(config.dinoSelections ?? {}), [seatId]: dino } });
  // What each seat will actually get (taken boards fall through to the next free one).
  const resolved = assignDinos(config, seats);
  return (
    <div className="game-config">
      <label className="field">
        <span>Escape Route goal</span>
        <select value={config.trackLength} onChange={(e) => onChange({ ...config, trackLength: Number(e.target.value) })} disabled={readOnly}>
          <option value={50}>50 points (rulebook)</option>
          <option value={30}>30 points (quick game)</option>
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={config.twoPlayerVariant !== false}
          disabled={readOnly}
          onChange={(e) => onChange({ ...config, twoPlayerVariant: e.target.checked })}
        />
        <span>
          Rulebook 2-player rules
          <span className="lobby-hint" style={{ display: 'block', margin: 0 }}>
            With exactly 2 players: no Point cards worth 1–3, and you're out at four of one Disaster type or two of each.
          </span>
        </span>
      </label>
      <ExpansionPicker expansions={HLD_EXPANSIONS} enabled={config.expansions} onToggle={toggle} readOnly={readOnly} />
      <div className="hld-lobby-dinos">
        <div className="cg-expansions-head"><span>Dinosaurs</span></div>
        {seats.map((seat) => (
          <div key={seat.id} className="hld-lobby-seat">
            <strong>{seat.name}</strong>
            {pool.map((d) => {
              const takenByOther = seats.some((o) => o.id !== seat.id && resolved[o.id] === d.id);
              return (
                <DinoCard
                  key={d.id}
                  dino={d.id}
                  compact
                  selected={resolved[seat.id] === d.id}
                  onClick={readOnly || takenByOther ? undefined : () => setDino(seat.id, d.id)}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

const seatOf = (s: HldState, id: PlayerId | null | undefined) => (id ? s.seats.find((x) => x.id === id) ?? null : null);
const nameOf = (s: HldState, id: PlayerId | null | undefined) => seatName(s, id ?? null);
const totalDisasters = (s: HldState) => Object.values(s.disasterAreas).reduce((n, d) => n + d.length, 0);

const CATEGORIES: readonly HldDisasterCategory[] = ['natural', 'predator', 'emotional', 'meteor'];

/** The categories whose next Disaster would knock this player out. */
function deadlyCategories(cards: HldDisasterCard[], rule: EliminationRule): HldDisasterCategory[] {
  if (cards.length < 1) return [];
  return CATEGORIES.filter((c) => isEliminatedByDisasters([...cards, { id: -1, name: '', category: c, text: '' }], rule));
}

/** Instants that help their target default to you; the rest default to the leader. */
const HELPS: readonly HldCardKind[] = ['score-booster', 'bffs-help', 'joy-of-puberty'];
const isLowPoint = (c: HldCard) => c.type === 'point' && c.value !== null && c.value >= 1 && c.value <= 3;

interface TargetSpec {
  candidates: PlayerId[];
  count: 1 | 2;
  label: string;
  defaults: PlayerId[];
}

/** What someone else's pending decision is about — never names a card only they can see. */
function promptBlurb(s: HldState, p: HldPrompt): string {
  const card = s.revealedPicks[p.playerId]?.name ?? 'their card';
  switch (p.kind) {
    case 'discardAfterDisaster': return 'may discard a card after taking the Disaster…';
    case 'iceCream': return 'is choosing a Disaster to shed (Ice Cream!)…';
    case 'treasureTrove': return 'is searching the discard pile (Treasure Trove)…';
    case 'wishfulThinking': return 'is choosing who moves back 3 (Wishful Thinking)…';
    case 'peekDeck': return p.source === 'fruit-shower' ? 'is looking at the top 2 cards (Fruit Shower)…' : `is resolving ${card}…`;
    default: return `is resolving ${card}…`;
  }
}

// ============================================================================
// Game view
// ============================================================================

export function GameView({ state: s, localPlayerId: me, dispatch }: {
  state: HldState;
  localPlayerId: PlayerId | null;
  dispatch: (action: HldAction) => void;
}) {
  const fx = useFx();
  const [shaking, shake] = usePulse(560);
  const [meteorKey, setMeteorKey] = useState(0);

  // Per-decision choices; reset whenever the decision changes.
  const [selIds, setSelIds] = useState<number[]>([]);
  const [chosenCardId, setChosenCardId] = useState<number | null>(null);
  const [secondCardId, setSecondCardId] = useState<number | null>(null);
  const [targets, setTargets] = useState<PlayerId[]>([]);
  const [amount, setAmount] = useState<number | null>(null);

  const live = livePlayerIds(s);
  const alive = me != null && isLive(s, me);
  const myHand: HldCard[] = (me && s.hands[me]) || [];
  const myPick = me ? s.pendingPicks[me] ?? null : null;
  const sd = s.subPhase === 'suddenDeath';
  const iMustPick = alive && !myPick && (s.subPhase === 'selecting' || (sd && s.suddenDeathPlayers.includes(me!)));
  const prompt: HldPrompt | null = s.subPhase === 'pointEffects' || s.subPhase === 'resolving' ? s.promptQueue[0] ?? null : null;
  const myPrompt = prompt && prompt.playerId === me ? prompt : null;
  const myInstants = alive && s.subPhase === 'awaitingScoringInstants' && s.activePlayerId === me;
  const mySave = alive && s.subPhase === 'awaitingDisasterSave' && s.activePlayerId === me;
  const revealed = s.subPhase !== 'selecting' && live.some((id) => !!s.revealedPicks[id]);
  const scores = useMemo(() => (revealed ? computeRoundScores(s) : {}), [revealed, s]);
  const liveScores = live.map((id) => scores[id] ?? 0);
  const topScore = liveScores.length ? Math.max(...liveScores) : 0;
  const lowScore = liveScores.length ? Math.min(...liveScores) : 0;
  const rule = eliminationRule(s);

  const promptStage = prompt && prompt.kind === 'peekDeck' ? (prompt.cards ? 'shown' : 'ask') : '';
  const decisionKey = `${s.subPhase}|${s.roundNumber}|${prompt?.kind ?? ''}${promptStage}|${s.activePlayerId}|${s.promptQueue.length}|${s.instantResponderQueue.length}|${s.instantPlays.length}`;
  useEffect(() => {
    setSelIds([]);
    setChosenCardId(null);
    setSecondCardId(null);
    setTargets([]);
    setAmount(null);
  }, [decisionKey]);

  // ---- FX, from state transitions (never from log text) ------------------------
  const prev = useRef(s);
  useEffect(() => {
    const was = prev.current;
    prev.current = s;
    if (was === s) return;
    if (s.roundNumber > was.roundNumber && s.currentDisaster?.category === 'meteor') setMeteorKey((k) => k + 1);
    if (was.subPhase === 'selecting' && s.subPhase !== 'selecting' && s.phase === 'playing') fx.stamp('REVEAL!', 'accent');
    if (s.subPhase === 'suddenDeath' && was.subPhase !== 'suddenDeath') fx.stamp('SUDDEN DEATH!', 'danger');
    const hit = totalDisasters(s) > totalDisasters(was);
    if (hit) {
      const victim = s.seats.find((st) => (s.disasterAreas[st.id]?.length ?? 0) > (was.disasterAreas[st.id]?.length ?? 0));
      const card = victim ? s.disasterAreas[victim.id]!.at(-1) : null;
      if (card?.category === 'meteor') setMeteorKey((k) => k + 1);
      fx.stamp('DISASTER!', 'danger');
      shake();
    }
    if (was.subPhase === 'awaitingDisasterSave' && !hit) {
      if (s.subPhase === 'awaitingDisasterSave' && s.pendingDisasterVictimId !== was.pendingDisasterVictimId) fx.stamp('REDIRECTED!', 'accent');
      else if (s.subPhase !== 'awaitingDisasterSave' && !s.currentDisaster) fx.stamp('SAVED!', 'good');
    }
    if (s.eliminated.length > was.eliminated.length) {
      fx.stamp('EXTINCT!', 'danger');
      fx.burst([0.5, 0.35], '#e8342e');
    }
    const gainers = s.seats.filter((st) => (s.trackPosition[st.id] ?? 0) > (was.trackPosition[st.id] ?? 0) + 1);
    if (gainers.length) {
      fx.toast(gainers.map((g) => `${g.name} +${(s.trackPosition[g.id] ?? 0) - (was.trackPosition[g.id] ?? 0)}`).join(' · '), 'good');
    }
  }, [s]); // keyed on state alone: fx / shake only schedule animations

  // ---- who / what is being targeted ---------------------------------------------------
  const chosenCard = chosenCardId != null ? myHand.find((c) => c.id === chosenCardId) ?? null : null;
  const others = live.filter((id) => id !== me);
  const scoreLeader = (pool: PlayerId[]) => [...pool].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))[0];
  const routeLeader = (pool: PlayerId[]) => [...pool].sort((a, b) => (s.trackPosition[b] ?? 0) - (s.trackPosition[a] ?? 0))[0];

  const targetSpec: TargetSpec | null = (() => {
    if (myPrompt) {
      switch (myPrompt.kind) {
        case 'takeFromHand': {
          const c = others.filter((id) => (s.hands[id]?.length ?? 0) > 0);
          return { candidates: c, count: 1, label: 'Look at', defaults: c.slice(0, 1) };
        }
        case 'swapPoint':
          return { candidates: myPrompt.targets, count: 1, label: 'Swap with', defaults: myPrompt.targets.slice(0, 1) };
        case 'swapOthers': {
          const c = others.filter((id) => !!s.revealedPicks[id]);
          return { candidates: c, count: 2, label: 'Swap these two', defaults: c.slice(0, 2) };
        }
        case 'voodoo':
          return { candidates: live, count: 1, label: 'Lower the score of', defaults: [scoreLeader(others) ?? live[0]!] };
        case 'swapHands':
          return { candidates: others, count: 1, label: 'Swap hands with', defaults: others.slice(0, 1) };
        case 'wishfulThinking':
          return { candidates: live, count: 1, label: 'Move back 3', defaults: [routeLeader(others) ?? live[0]!] };
        default:
          return null;
      }
    }
    if (myInstants && chosenCard && TARGETED_INSTANTS.includes(chosenCard.kind)) {
      const def = HELPS.includes(chosenCard.kind)
        ? me!
        : (chosenCard.kind === 'baby-pictures' ? routeLeader(others) : scoreLeader(others)) ?? live[0]!;
      return { candidates: live, count: 1, label: 'Target', defaults: [def] };
    }
    if (mySave && chosenCard?.kind === 'disaster-redirect') {
      const safest = [...others].sort((a, b) => (s.disasterAreas[a]?.length ?? 0) - (s.disasterAreas[b]?.length ?? 0));
      return { candidates: others, count: 1, label: 'Send it to', defaults: safest.slice(0, 1) };
    }
    return null;
  })();
  // Until you pick, the sensible default stands; your first click edits it.
  const picked = targetSpec ? targets.filter((t) => targetSpec.candidates.includes(t)) : [];
  const effectiveTargets = targetSpec ? (picked.length ? picked : targetSpec.defaults) : [];
  function chooseTarget(id: PlayerId) {
    if (!targetSpec) return;
    if (targetSpec.count === 1) return setTargets([id]);
    const cur = effectiveTargets;
    setTargets(cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 2 ? [...cur, id] : [cur[0]!, id]);
  }
  const toggleSel = (id: number, max: number) =>
    setSelIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < max ? [...cur, id] : cur));

  // ---- what a click in your hand does -----------------------------------------------
  function onHandCard(c: HldCard): (() => void) | undefined {
    if (!me || !alive) return undefined;
    if (iMustPick && c.type === 'point') {
      return () => dispatch(sd ? { type: 'submitSuddenDeathPick', playerId: me, cardId: c.id } : { type: 'submitPick', playerId: me, cardId: c.id });
    }
    if (myPrompt?.kind === 'discardForPoints' && c.type === 'point' && (myPrompt.source !== 'delicious-smoothie' || c.hasEffect)) {
      return () => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: c.id });
    }
    if (myPrompt?.kind === 'discardUpTo') return () => toggleSel(c.id, myPrompt.max);
    if (myPrompt?.kind === 'voodoo' && c.type === 'point') return () => toggleSel(c.id, 99);
    if (myPrompt?.kind === 'discardAfterDisaster') return () => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: c.id });
    if (myInstants) {
      if (chosenCard?.kind === 'helping-hand' && isLowPoint(c)) return () => toggleSel(c.id, 99);
      if (canPlayScoringInstantCard(s, me, c)) return () => setChosenCardId((cur) => (cur === c.id ? null : c.id));
    }
    if (mySave && canPlayDisasterSaveCard(s, me, c)) return () => setChosenCardId((cur) => (cur === c.id ? null : c.id));
    return undefined;
  }

  // ---- opponents -------------------------------------------------------------------
  const opponents = s.seats.filter((x) => x.id !== me);
  const moodOf = (id: PlayerId): DinoMood =>
    !isLive(s, id) ? 'out' : s.pendingDisasterVictimId === id || (revealed && live.length > 1 && (scores[id] ?? 0) === lowScore && topScore !== lowScore) ? 'scared' : 'happy';

  const top = (
    <PlayerStrip>
      {opponents.map((o) => {
        const out = !isLive(s, o.id);
        const picking = (s.subPhase === 'selecting' || (sd && s.suddenDeathPlayers.includes(o.id))) && !out;
        const pickable = !!targetSpec && targetSpec.candidates.includes(o.id);
        return (
          <PlayerPlate
            key={o.id}
            seat={o}
            active={!out && s.activePlayerId === o.id && !picking}
            out={out}
            outLabel="EXTINCT"
            avatar={<span className="hld-plate-dino"><DinoBadge dino={s.dinos[o.id]!} color={o.color} mood={moodOf(o.id)} /></span>}
            sub={out ? 'Extinct' : `${s.trackPosition[o.id] ?? 0}/${s.config.trackLength} · ${s.hands[o.id]?.length ?? 0} cards`}
            targetable={pickable}
            selected={pickable && effectiveTargets.includes(o.id)}
            onClick={pickable ? () => chooseTarget(o.id) : undefined}
          >
            {!out && (
              <div className="hld-plate-row">
                <DisasterMeter cards={s.disasterAreas[o.id] ?? []} rule={rule} />
                <TraitChip s={s} id={o.id} />
                {picking && <Chip tone={s.pendingPicks[o.id] ? 'good' : 'dim'}>{s.pendingPicks[o.id] ? 'Ready' : 'Picking…'}</Chip>}
              </div>
            )}
          </PlayerPlate>
        );
      })}
    </PlayerStrip>
  );

  // ---- board: the scene, the route, the disaster and everyone's pick --------------
  const runners: TrackRunner[] = s.seats.map((st) => ({
    seat: st,
    dino: s.dinos[st.id]!,
    position: s.trackPosition[st.id] ?? 0,
    out: !isLive(s, st.id),
    mood: moodOf(st.id),
  }));
  const board = (
    <div className="hld-scene">
      <SceneBackdrop />
      <EscapeRoute length={s.config.trackLength} runners={runners} me={me} />
      <div className="hld-stage">
        <div className="hld-disaster-slot">
          <span className="hld-slot-label">Round {s.roundNumber} disaster</span>
          {s.currentDisaster ? (
            <DisasterCard key={s.currentDisaster.id} disaster={s.currentDisaster} size="md" />
          ) : (
            <FaceDownCard key="none" size="md" deck="disaster" />
          )}
        </div>
        <div className="hld-picks">
          {s.seats.filter((st) => isLive(s, st.id)).map((st, i) => (
            <PickSlot
              key={st.id}
              s={s}
              seat={st}
              index={i}
              mine={st.id === me}
              score={revealed ? scores[st.id] ?? 0 : null}
              top={revealed && (scores[st.id] ?? 0) === topScore}
              low={revealed && live.length > 1 && topScore !== lowScore && (scores[st.id] ?? 0) === lowScore}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // ---- the dock ------------------------------------------------------------------
  const targetPicker = targetSpec && (
    <div className="hld-targets">
      <span>{targetSpec.label}{targetSpec.count === 2 ? ' (two)' : ''}:</span>
      {targetSpec.candidates.map((id) => {
        const st = seatOf(s, id)!;
        return (
          <button key={id} type="button" className={`secondary tiny hld-target${effectiveTargets.includes(id) ? ' is-on' : ''}`} onClick={() => chooseTarget(id)}>
            <span className="hld-pick-dot" style={{ background: st.color }} />
            {id === me ? 'You' : st.name}
            {revealed && <small>{scores[id] ?? 0}</small>}
          </button>
        );
      })}
    </div>
  );

  function renderDock(): ReactNode {
    if (s.phase === 'gameOver') {
      const winner = seatOf(s, s.winnerId);
      const escaped = (s.trackPosition[s.winnerId ?? ''] ?? 0) >= s.config.trackLength;
      return (
        <GameOverPanel
          seats={s.seats}
          finalScores={s.finalScores}
          winnerIds={s.winnerId ? [s.winnerId] : []}
          localPlayerId={me}
          headline={escaped ? `${winner?.name ?? 'Someone'} escapes!` : `${winner?.name ?? 'Someone'} is the last dino standing!`}
          detail={escaped ? `Reached ${s.trackPosition[s.winnerId!] ?? 0} on the Escape Route.` : 'Everyone else went extinct.'}
          showScores={escaped}
          scoreLabel="escaped"
          art={s.winnerId ? <DinoArt dino={s.dinos[s.winnerId]!} title={winner?.name} /> : undefined}
        />
      );
    }
    const active = seatOf(s, s.activePlayerId);
    const disaster = s.currentDisaster;
    const disasterName = disaster ? `${disaster.name} (${CATEGORY_LABEL[disaster.category]})` : 'the Disaster';

    if (s.subPhase === 'selecting') {
      if (iMustPick) {
        const d = dinoTraitDelta(s, me!);
        return (
          <Dock tone="turn" eyebrow={`Round ${s.roundNumber} · everyone picks at once`} title="Play a Point card face-down">
            Highest score escapes up the route; lowest takes <strong>{disasterName}</strong>.
            {d !== 0 && <> Your dino gets <strong>{d > 0 ? `+${d}` : `−${-d}`}</strong> on this one.</>} Click a Point card in your hand.
          </Dock>
        );
      }
      const waiting = live.filter((id) => !s.pendingPicks[id]).map((id) => nameOf(s, id));
      return <Dock tone="wait" who={active} eyebrow={alive ? 'Your card is in' : undefined} title={`Waiting for ${waiting.join(', ') || 'the reveal'} to pick…`} />;
    }

    if (sd) {
      if (iMustPick) {
        return (
          <Dock tone="react" eyebrow="Sudden death" title="Tie for last — play another Point card">
            Lowest printed value takes <strong>{disasterName}</strong> (no traits, effects or Instants). Click one in your hand.
          </Dock>
        );
      }
      return <Dock tone="danger" who={active} eyebrow="Sudden death" title={`${s.suddenDeathPlayers.map((id) => nameOf(s, id)).join(' vs ')} — lowest card takes the Disaster`} />;
    }

    if ((s.subPhase === 'pointEffects' || s.subPhase === 'resolving') && prompt) {
      if (!myPrompt) return <Dock tone="wait" who={active} title={`${active?.name ?? 'Someone'} ${promptBlurb(s, prompt)}`} />;
      return (
        <PromptDock s={s} me={me!} prompt={myPrompt} dispatch={dispatch} selIds={selIds} targets={effectiveTargets} targetPicker={targetPicker} />
      );
    }

    if (s.subPhase === 'awaitingScoringInstants') {
      if (!myInstants) return <Dock tone="wait" who={active} eyebrow="Scoring" title={`${active?.name ?? 'Someone'} may play a Scoring Instant…`} />;
      const kind = chosenCard?.kind;
      const myPos = s.trackPosition[me!] ?? 0;
      const maxBack = Math.min(5, myPos);
      const back = amount ?? maxBack;
      const myArea = s.disasterAreas[me!] ?? [];
      const owaPick = secondCardId != null ? myArea.find((d) => d.id === secondCardId) ?? null : null;
      const needsTarget = !!kind && TARGETED_INSTANTS.includes(kind);
      const ready = !!chosenCard
        && (!needsTarget || effectiveTargets.length === 1)
        && (kind !== 'helping-hand' || selIds.length > 0)
        && (kind !== 'one-week-anniversary' || !!owaPick);
      const bonus = canSkipDisasterBonus(s, me!) ? disasterScoringBonus(s, me!) : 0;
      return (
        <Dock
          tone="react"
          eyebrow="Scoring · Instants"
          title={chosenCard ? `Play ${chosenCard.name}?` : 'Play a Scoring Instant?'}
          actions={
            <>
              {chosenCard && (
                <button
                  disabled={!ready}
                  onClick={() => dispatch({
                    type: 'playScoringInstant',
                    playerId: me!,
                    cardId: chosenCard.id,
                    ...(needsTarget && effectiveTargets[0] ? { targetPlayerId: effectiveTargets[0] } : {}),
                    ...(kind === 'helping-hand' ? { handCardIds: selIds } : {}),
                    ...(kind === 'joy-of-puberty' || kind === 'spiteful-bullying' ? { amount: back } : {}),
                    ...(kind === 'one-week-anniversary' && owaPick ? { disasterId: owaPick.id } : {}),
                  })}
                >
                  Play it ▶
                </button>
              )}
              {bonus > 0 && (
                <button className="secondary" onClick={() => dispatch({ type: 'skipDisasterBonus', playerId: me! })}>
                  Turn down my +{bonus} Disaster bonus
                </button>
              )}
              <button className="secondary" onClick={() => dispatch({ type: 'declineScoringInstant', playerId: me! })}>Pass</button>
            </>
          }
        >
          {chosenCard ? chosenCard.text : 'Click a glowing Instant in your hand to tamper with the scores — or pass.'}
          {bonus > 0 && !chosenCard && <> Your Disasters add <strong>+{bonus}</strong>; with the scores inverted you may prefer to turn it down.</>}
          {targetPicker}
          {kind === 'helping-hand' && <div className="lobby-hint" style={{ margin: 0 }}>Click your 1, 2 and 3 Point cards to discard them ({selIds.length} chosen).</div>}
          {(kind === 'joy-of-puberty' || kind === 'spiteful-bullying') && (
            <div className="hld-targets">
              <span>Move back:</span>
              {Array.from({ length: maxBack }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" className={`secondary tiny hld-target${back === n ? ' is-on' : ''}`} onClick={() => setAmount(n)}>{n}</button>
              ))}
            </div>
          )}
          {kind === 'one-week-anniversary' && (
            <div className="hld-choices">
              <span className="lobby-hint" style={{ margin: 0 }}>Swap the face-up Disaster with:</span>
              {myArea.map((d) => (
                <button key={d.id} type="button" className={`hld-pick-btn${owaPick?.id === d.id ? ' is-on' : ''}`} onClick={() => setSecondCardId(d.id)} aria-pressed={owaPick?.id === d.id}>
                  <DisasterCard disaster={d} size="sm" />
                </button>
              ))}
            </div>
          )}
        </Dock>
      );
    }

    if (s.subPhase === 'awaitingDisasterSave') {
      if (!mySave) return <Dock tone="danger" who={active} eyebrow="Disaster incoming" title={`${active?.name ?? 'Someone'} is about to take ${disasterName}…`} />;
      const ready = !!chosenCard && (chosenCard.kind !== 'disaster-redirect' || effectiveTargets.length === 1);
      return (
        <Dock
          tone="danger"
          eyebrow="The Disaster is headed your way"
          title={`${disaster?.name ?? 'A Disaster'} is coming for you!`}
          actions={
            <>
              {chosenCard && (
                <button
                  disabled={!ready}
                  onClick={() => dispatch({
                    type: 'playDisasterSave',
                    playerId: me!,
                    cardId: chosenCard.id,
                    ...(chosenCard.kind === 'disaster-redirect' && effectiveTargets[0] ? { targetPlayerId: effectiveTargets[0] } : {}),
                  })}
                >
                  Play {chosenCard.name}
                </button>
              )}
              <button className="secondary" onClick={() => dispatch({ type: 'declineDisasterSave', playerId: me! })}>Take the Disaster</button>
            </>
          }
        >
          {chosenCard ? chosenCard.text : 'Click a glowing Instant in your hand to dodge it — or take it on the chin.'}
          {chosenCard?.kind === 'disaster-redirect' && targetPicker}
        </Dock>
      );
    }
    return <Dock tone="wait" who={active} title={`${active?.name ?? 'Someone'} is thinking`} />;
  }

  // ---- side: round facts + log --------------------------------------------------------
  const side = (
    <>
      <Panel title={`Round ${s.roundNumber}`}>
        <div className="hld-plate-row" style={{ marginTop: 0 }}>
          <Chip>{s.deck.length} in deck</Chip>
          <Chip>{s.disasterDeck.length} disasters left</Chip>
          {s.seats.length >= 5 && <Chip tone="good">Top 2 score</Chip>}
          {twoPlayerRules(s) && <Chip tone="accent" title="4 of one type or 2 of each type eliminates">2-player rules</Chip>}
        </div>
      </Panel>
      <GameLog entries={s.log} seats={s.seats} title="Valley news" />
    </>
  );

  // ---- your area ---------------------------------------------------------------------
  const mySeat = seatOf(s, me);
  const canSwitchDino = alive && s.roundNumber === 1 && s.subPhase === 'selecting' && !myPick;
  const hand = alive && mySeat ? (
    <div className="hld-hand-area">
      <div className="hld-hand-head">
        <div className="hld-me">
          <DinoBadge dino={s.dinos[me!]!} color={mySeat.color} mood={moodOf(me!)} size={48} />
          <div>
            <h4>{HLD_DINO_DEFS.find((d) => d.id === s.dinos[me!])?.name ?? 'Your dino'}</h4>
            <div className="hld-me-sub">{s.trackPosition[me!] ?? 0}/{s.config.trackLength} escaped · {myHand.length} cards</div>
          </div>
          <DisasterMeter cards={s.disasterAreas[me!] ?? []} rule={rule} />
          <TraitChip s={s} id={me!} />
        </div>
        {canSwitchDino && (
          <div className="hld-swap-dino">
            <span>Switch dino:</span>
            {selectableDinos(s, me!).map((d) => (
              <DinoCard key={d} dino={d} compact selected={s.dinos[me!] === d} onClick={() => dispatch({ type: 'chooseDino', playerId: me!, dinoId: d })} />
            ))}
          </div>
        )}
      </div>
      <div className="hld-hand">
        {myHand.length === 0 ? (
          <p className="hld-hand-empty">Empty-handed. Bold.</p>
        ) : (
          <CardFan label="Your hand" maxTilt={8}>
            {myHand.map((c) => {
              const click = onHandCard(c);
              return (
                <PlayCard
                  key={c.id}
                  card={c}
                  selected={selIds.includes(c.id) || chosenCardId === c.id}
                  onClick={click}
                  disabled={!click}
                />
              );
            })}
          </CardFan>
        )}
      </div>
    </div>
  ) : (
    <div className="hld-hand-area">
      <p className="hld-hand-empty">{me ? 'Your dino went extinct. Cheer from the fossil record.' : 'Spectating — no hand to show.'}</p>
    </div>
  );

  return (
    <GameTable
      className={`hld-table${shaking ? ' is-shaking' : ''}`}
      top={top}
      board={board}
      side={side}
      dock={renderDock()}
      hand={hand}
      overlay={
        <>
          <FxLayer fx={fx} />
          {meteorKey > 0 && <Meteor key={meteorKey} />}
          <TurnCue active={s.phase === 'playing' && (iMustPick || !!myPrompt || myInstants || mySave)}>
            {iMustPick ? 'Pick a card!' : mySave ? 'Uh oh…' : 'Your move'}
          </TurnCue>
        </>
      }
    />
  );
}

// ============================================================================
// Pieces
// ============================================================================

/** The Disasters taken, plus one slot for the next; that slot glows red when it could be fatal. */
function DisasterMeter({ cards, rule }: { cards: HldDisasterCard[]; rule: EliminationRule }) {
  const deadly = deadlyCategories(cards, rule);
  const title = cards.length
    ? `${cards.map((c) => `${c.name} (${CATEGORY_LABEL[c.category]}${c.effect === 'counts-double' ? ' ×2' : ''})`).join(', ')}${deadly.length ? ` — next ${deadly.map((c) => CATEGORY_LABEL[c]).join('/')} is fatal` : ''}`
    : 'No disasters yet';
  const slots = Math.max(cards.length + 1, 3);
  return (
    <span className="hld-meter" title={title}>
      {Array.from({ length: slots }, (_, i) => {
        const c = cards[i];
        if (c) return <span key={i} className="hld-meter-slot is-full"><CategoryIcon category={c.category} size={22} /></span>;
        if (i === cards.length && deadly.length) {
          return <span key={i} className="hld-meter-slot is-deadly"><CategoryIcon category={deadly[0]!} size={16} /></span>;
        }
        return <span key={i} className="hld-meter-slot" />;
      })}
    </span>
  );
}

function TraitChip({ s, id }: { s: HldState; id: PlayerId }) {
  if (!s.currentDisaster) return null;
  const d = dinoTraitDelta(s, id);
  if (d === 0) return null;
  return <Chip tone={d > 0 ? 'good' : 'danger'} title="Dino trait vs this Disaster">{d > 0 ? `+${d}` : `−${-d}`} trait</Chip>;
}

function PickSlot({ s, seat, index, mine, score, top, low }: {
  s: HldState;
  seat: Seat;
  index: number;
  mine: boolean;
  score: number | null;
  top: boolean;
  low: boolean;
}) {
  const sdPlayer = s.subPhase === 'suddenDeath' && s.suddenDeathPlayers.includes(seat.id);
  const pending = s.pendingPicks[seat.id];
  const shown = s.revealedPicks[seat.id];
  let body: ReactNode;
  if ((s.subPhase === 'selecting' || sdPlayer) && pending) {
    // Face-up only for its owner; a back for everyone else until the reveal.
    body = mine ? <PlayCard card={pending} size="sm" className="is-landed" footnote="yours" /> : <FaceDownCard size="sm" className="is-landed" />;
  } else if (s.subPhase === 'selecting' || sdPlayer) {
    body = <div className="hld-pick-empty"><span>?</span></div>;
  } else if (shown) {
    body = (
      <div className="is-flipped" style={{ '--i': index } as CSSProperties}>
        <PlayCard card={shown} size="sm" />
      </div>
    );
  } else {
    body = <div className="hld-pick-empty">—</div>;
  }
  return (
    <div className="hld-pick">
      {score !== null && !sdPlayer && <span className={`hld-score${top ? ' is-top' : low ? ' is-low' : ''}`}>{score}</span>}
      {body}
      <span className="hld-pick-who"><span className="hld-pick-dot" style={{ background: seat.color }} />{mine ? 'You' : seat.name}</span>
      {score !== null && !sdPlayer && (top || low) && <span className={`hld-pick-tag ${top ? 'is-top' : 'is-low'}`}>{top ? 'escapes' : 'in danger'}</span>}
    </div>
  );
}

const DISCARD_TITLE: Record<'fire-spray' | 'trash-into-treasure' | 'a-bone-to-flick', string> = {
  'fire-spray': 'Torch up to 3 cards from your hand?',
  'trash-into-treasure': 'Trash up to 3 cards for +3 each?',
  'a-bone-to-flick': 'Flick away up to 3 cards?',
};

/** The single-player decisions: Point card effects, Lucky Days, Ice Cream!, the post-Disaster discard. */
function PromptDock({ s, me, prompt, dispatch, selIds, targets, targetPicker }: {
  s: HldState;
  me: PlayerId;
  prompt: HldPrompt;
  dispatch: (a: HldAction) => void;
  selIds: number[];
  targets: PlayerId[];
  targetPicker: ReactNode;
}) {
  const resolve = (extra: Omit<Extract<HldAction, { type: 'resolvePrompt' }>, 'type' | 'playerId'> = {}) =>
    dispatch({ type: 'resolvePrompt', playerId: me, ...extra });
  const skip = <button className="secondary" onClick={() => resolve({ decline: true })}>Skip</button>;
  const card = s.revealedPicks[me];
  const eyebrow = card ? `${card.name} effect` : 'Your decision';

  switch (prompt.kind) {
    case 'discardForPoints':
      return (
        <Dock tone="turn" eyebrow={eyebrow} title={prompt.source === 'delicious-smoothie' ? 'Blend a card into your score?' : 'Toss a Point card on the pile?'} actions={skip}>
          Click a {prompt.source === 'delicious-smoothie' ? 'Point card with an effect' : 'Point card'} in your hand: it's discarded and its value is added to your score this round.
        </Dock>
      );
    case 'takeFromHand': {
      const victim = targets[0];
      const theirs = victim ? s.hands[victim] ?? [] : [];
      return (
        <Dock tone="turn" eyebrow={eyebrow} title="Rummage through a hand and take one" actions={skip}>
          {targetPicker}
          <div className="hld-choices is-scroll">
            {theirs.map((c) => (
              <PlayCard key={c.id} card={c} size="sm" onClick={() => resolve({ targetPlayerId: victim!, targetCardId: c.id })} />
            ))}
          </div>
        </Dock>
      );
    }
    case 'swapPoint':
      return (
        <Dock
          tone="turn"
          eyebrow={eyebrow}
          title={prompt.source === 'grappling-snake' ? "Swap your Point card with a neighbour's?" : "Swap your Point card with another player's?"}
          actions={<><button disabled={!targets[0]} onClick={() => resolve({ targetPlayerId: targets[0]! })}>Swap ▶</button>{skip}</>}
        >
          Only cards without an effect can be taken.
          {targetPicker}
          <div className="hld-choices">
            {prompt.targets.map((id) => s.revealedPicks[id] && <PlayCard key={id} card={s.revealedPicks[id]!} size="sm" footnote={nameOf(s, id)} selected={targets[0] === id} />)}
          </div>
        </Dock>
      );
    case 'discardUpTo':
      return (
        <Dock
          tone="turn"
          eyebrow={eyebrow}
          title={DISCARD_TITLE[prompt.source]}
          actions={<><button disabled={selIds.length === 0} onClick={() => resolve({ cardIds: selIds })}>Discard {selIds.length || ''}</button>{skip}</>}
        >
          Click up to {prompt.max} cards in your hand.{prompt.source === 'a-bone-to-flick' && ' (Its Hazard token is not modeled.)'}
        </Dock>
      );
    case 'peekDeck': {
      if (prompt.cards === null) {
        return (
          <Dock
            tone="turn"
            eyebrow={eyebrow}
            title={prompt.source === 'good-luck-rod' ? 'Look at the top 3 cards of the deck?' : 'Look at the top 2 cards of the deck?'}
            actions={<><button onClick={() => resolve({ look: true })}>Look ▶</button>{skip}</>}
          >
            {prompt.source === 'good-luck-rod'
              ? 'If any is a Point card, add one of their values to your score; all three are then discarded.'
              : 'Keep one of them and discard the other.'}
          </Dock>
        );
      }
      if (prompt.source === 'bouquet-of-flowers') {
        const n = prompt.cards.filter((c) => c.type === 'instant').length;
        return (
          <Dock
            tone="turn"
            eyebrow={eyebrow}
            title={`Keep the ${n} Instant${n === 1 ? '' : 's'}?`}
            actions={<><button onClick={() => resolve()}>Keep them ▶</button><button className="secondary" onClick={() => resolve({ decline: true })}>Discard all</button></>}
          >
            <div className="hld-choices">{prompt.cards.map((c) => <PlayCard key={c.id} card={c} size="sm" />)}</div>
          </Dock>
        );
      }
      const rod = prompt.source === 'good-luck-rod';
      return (
        <Dock tone="turn" eyebrow={prompt.source === 'fruit-shower' ? 'Fruit Shower (Lucky Day)' : eyebrow} title={rod ? 'Add one Point card\'s value to your score' : 'Keep one, toss the other'}>
          <div className="hld-choices">
            {prompt.cards.map((c) => (
              <PlayCard key={c.id} card={c} size="md" disabled={rod && c.type !== 'point'} onClick={rod && c.type !== 'point' ? undefined : () => resolve({ targetCardId: c.id })} />
            ))}
          </div>
        </Dock>
      );
    }
    case 'swapOthers':
      return (
        <Dock
          tone="turn"
          eyebrow={eyebrow}
          title="Swap two other players' Point cards?"
          actions={<><button disabled={targets.length !== 2 || targets[0] === targets[1]} onClick={() => resolve({ targetPlayerId: targets[0]!, secondPlayerId: targets[1]! })}>Swap ▶</button>{skip}</>}
        >
          {targetPicker}
        </Dock>
      );
    case 'voodoo':
      return (
        <Dock
          tone="turn"
          eyebrow={eyebrow}
          title="Discard Point cards to curse a score?"
          actions={<><button disabled={selIds.length === 0 || !targets[0]} onClick={() => resolve({ cardIds: selIds, targetPlayerId: targets[0]! })}>Curse −{selIds.length} ▶</button>{skip}</>}
        >
          Click Point cards in your hand: −1 to that player's score this round for each.
          {targetPicker}
        </Dock>
      );
    case 'swapHands':
      return (
        <Dock tone="turn" eyebrow={eyebrow} title="Swap hands with someone?" actions={<><button disabled={!targets[0]} onClick={() => resolve({ targetPlayerId: targets[0]! })}>Swap hands ▶</button>{skip}</>}>
          {targetPicker}
        </Dock>
      );
    case 'peekDisaster':
      return (
        <Dock
          tone="turn"
          eyebrow={eyebrow}
          title="The next Disaster — keep it on top?"
          actions={<><button onClick={() => resolve()}>Leave it on top</button><button className="secondary" onClick={() => resolve({ toBottom: true })}>Send to the bottom</button></>}
        >
          <div className="hld-choices"><DisasterCard disaster={prompt.disaster} size="sm" /></div>
        </Dock>
      );
    case 'iceCream': {
      const area = s.disasterAreas[me] ?? [];
      return (
        <Dock tone="turn" eyebrow="Ice Cream! (highest score)" title="Send one of your Disasters to the bottom of the deck">
          <div className="hld-choices">
            {area.map((d) => (
              <button key={d.id} type="button" className="hld-pick-btn" onClick={() => resolve({ targetCardId: d.id })}>
                <DisasterCard disaster={d} size="sm" />
              </button>
            ))}
          </div>
        </Dock>
      );
    }
    case 'treasureTrove': {
      const pts = s.discard.filter((c) => c.type === 'point');
      return (
        <Dock tone="turn" eyebrow="Treasure Trove (Lucky Day)" title="Take a Point card from the discard pile">
          <div className="hld-choices is-scroll">
            {pts.map((c) => <PlayCard key={c.id} card={c} size="sm" onClick={() => resolve({ targetCardId: c.id })} />)}
          </div>
        </Dock>
      );
    }
    case 'wishfulThinking':
      return (
        <Dock tone="turn" eyebrow="Wishful Thinking (Lucky Day)" title="Choose a player to move back 3 spaces" actions={<button disabled={!targets[0]} onClick={() => resolve({ targetPlayerId: targets[0]! })}>Move them back ▶</button>}>
          {targetPicker}
        </Dock>
      );
    case 'discardAfterDisaster':
      return (
        <Dock tone="turn" eyebrow="After the Disaster" title="Discard a card from your hand?" actions={<button className="secondary" onClick={() => resolve({ decline: true })}>Keep my hand</button>}>
          Anyone who takes a Disaster may discard one card. Click it in your hand.
        </Dock>
      );
  }
}

/** A meteor streaking across the table. */
function Meteor() {
  return (
    <svg className="hld-meteor" viewBox="0 0 140 140" aria-hidden="true">
      <path d="M140 0 L60 80" stroke="#ff7a1a" strokeWidth={30} strokeLinecap="round" opacity={0.85} />
      <path d="M140 0 L64 76" stroke="#ffd23f" strokeWidth={13} strokeLinecap="round" />
      <circle cx={52} cy={88} r={24} fill="#7a4a2a" stroke="#2a1d16" strokeWidth={4} />
      <circle cx={46} cy={82} r={5} fill="#5a3418" />
    </svg>
  );
}
