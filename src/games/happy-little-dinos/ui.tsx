// Happy Little Dinosaurs — lobby config + in-game view, on the shared table kit.
//
// Hidden information: only `localPlayerId`'s hand and own face-down pick are
// ever drawn face-up. Everyone else's pick is a card back until the reveal;
// deck order is never shown. (Dino Grabber / Bouquet legitimately look at an
// opponent's hand, so that prompt shows it.)

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import { isLive, livePlayerIds, seatName } from '@/core/state';
import {
  CardFan, Chip, Dock, ExpansionPicker, FxLayer, GameLog, GameOverPanel, GameTable, Panel, PlayerPlate, PlayerStrip,
  TurnCue, useFx, usePulse,
} from '@/ui/kit';
import { EscapeRoute, SceneBackdrop, type TrackRunner } from './Board';
import { DinoCard, DisasterCard, FaceDownCard, HazardCard, PlayCard } from './Card';
import { CATEGORY_LABEL, CategoryIcon } from './CardArt';
import { HLD_DINO_DEFS } from './cards';
import { DinoArt, DinoBadge, type DinoMood } from './DinoArt';
import {
  canPlayDisasterSaveCard, canPlayScoringInstantCard, computeRoundScores, dinoTraitDelta, hazardScorePenalty,
  isEliminatedByDisasters,
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
  const setDino = (seatId: PlayerId, dino: HldDinoId) =>
    onChange({ ...config, dinoSelections: { ...(config.dinoSelections ?? {}), [seatId]: dino } });
  return (
    <div className="game-config">
      <label className="field">
        <span>Escape Route goal</span>
        <select value={config.trackLength} onChange={(e) => onChange({ ...config, trackLength: Number(e.target.value) })}>
          <option value={50}>50 points (rulebook)</option>
          <option value={30}>30 points (quick game)</option>
        </select>
      </label>
      <ExpansionPicker expansions={HLD_EXPANSIONS} enabled={config.expansions} onToggle={toggle} readOnly={readOnly} />
      <div className="hld-lobby-dinos">
        <div className="cg-expansions-head"><span>Dinosaurs</span></div>
        {seats.map((seat, i) => {
          const current = config.dinoSelections?.[seat.id] ?? HLD_DINO_DEFS[i % HLD_DINO_DEFS.length]!.id;
          return (
            <div key={seat.id} className="hld-lobby-seat">
              <strong>{seat.name}</strong>
              {HLD_DINO_DEFS.map((d) => (
                <DinoCard key={d.id} dino={d.id} compact selected={current === d.id} onClick={readOnly ? undefined : () => setDino(seat.id, d.id)} />
              ))}
            </div>
          );
        })}
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
function deadlyCategories(cards: HldDisasterCard[]): HldDisasterCategory[] {
  if (cards.length < 2) return [];
  return CATEGORIES.filter((c) => isEliminatedByDisasters([...cards, { id: -1, name: '', category: c, text: '' }]));
}

/** How many targets an Instant needs, and whom. */
type TargetNeed = 'none' | 'any' | 'other' | 'two';
const INSTANT_NEED: Partial<Record<HldCardKind, TargetNeed>> = {
  'score-booster': 'any',
  'one-week-anniversary': 'any',
  'bffs-help': 'any',
  'score-sapper': 'any',
  'baby-pictures': 'any',
  roadblock: 'any',
  'awkward-first-kiss': 'other',
  'spiteful-bullying': 'two',
  'double-date': 'two',
};
/** Instants that hurt their target: default to the leader instead of yourself. */
const HURTS: readonly HldCardKind[] = ['score-sapper', 'baby-pictures', 'roadblock', 'awkward-first-kiss'];

interface TargetSpec {
  candidates: PlayerId[];
  count: 1 | 2;
  label: string;
  defaults: PlayerId[];
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

  const live = livePlayerIds(s);
  const alive = me != null && isLive(s, me);
  const myHand: HldCard[] = (me && s.hands[me]) || [];
  const myPick = me ? s.pendingPicks[me] ?? null : null;
  const sd = s.subPhase === 'suddenDeath';
  const iMustPick = alive && !myPick && (s.subPhase === 'selecting' || (sd && s.suddenDeathPlayers.includes(me!)));
  const prompt: HldPrompt | null = s.subPhase === 'pointEffects' ? s.promptQueue[0] ?? null : null;
  const myPrompt = prompt && prompt.playerId === me ? prompt : null;
  const myInstants = alive && s.subPhase === 'awaitingScoringInstants' && s.activePlayerId === me;
  const mySave = alive && s.subPhase === 'awaitingDisasterSave' && s.activePlayerId === me;
  const revealed = s.subPhase !== 'selecting' && live.some((id) => !!s.revealedPicks[id]);
  const scores = useMemo(() => (revealed ? computeRoundScores(s) : {}), [revealed, s]);
  const liveScores = live.map((id) => scores[id] ?? 0);
  const topScore = liveScores.length ? Math.max(...liveScores) : 0;
  const lowScore = liveScores.length ? Math.min(...liveScores) : 0;

  const decisionKey = `${s.subPhase}|${s.roundNumber}|${prompt?.kind ?? ''}|${s.activePlayerId}|${s.promptQueue.length}|${s.instantResponderQueue.length}`;
  useEffect(() => {
    setSelIds([]);
    setChosenCardId(null);
    setSecondCardId(null);
    setTargets([]);
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
      else if (s.subPhase !== 'awaitingDisasterSave') fx.stamp('SAVED!', 'good');
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
  const leader = (pool: PlayerId[]) => [...pool].sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))[0];

  const targetSpec: TargetSpec | null = (() => {
    if (myPrompt?.kind === 'dinoGrabberSteal') {
      const c = others.filter((id) => (s.hands[id]?.length ?? 0) > 0);
      return { candidates: c, count: 1, label: 'Peek at', defaults: c.slice(0, 1) };
    }
    if (myPrompt?.kind === 'grapplingSnakeSwap') return { candidates: myPrompt.validNeighbors, count: 1, label: 'Swap with', defaults: myPrompt.validNeighbors.slice(0, 1) };
    if (myPrompt?.kind === 'hungryPlantSwap') return { candidates: live, count: 2, label: 'Swap these two', defaults: live.slice(0, 2) };
    if (myPrompt?.kind === 'unwantedLunchSwap') return { candidates: others, count: 1, label: 'Trade with', defaults: others.slice(0, 1) };
    if (myPrompt?.kind === 'removeHazardPick' && myPrompt.canTransferToOpponent) return { candidates: others, count: 1, label: 'Dump it on', defaults: others.slice(0, 1) };
    if (myInstants && chosenCard) {
      const need = INSTANT_NEED[chosenCard.kind] ?? 'none';
      if (need === 'none') return null;
      if (need === 'two') {
        const pair = chosenCard.kind === 'double-date' ? [me!, others[0]!] : [leader(live)!, [...live].sort((a, b) => (scores[a] ?? 0) - (scores[b] ?? 0))[0]!];
        return { candidates: live, count: 2, label: 'Pick two players', defaults: [...new Set(pair)].filter(Boolean) };
      }
      const pool = need === 'other' ? others : live;
      const def = HURTS.includes(chosenCard.kind) ? leader(others) ?? pool[0]! : me!;
      return { candidates: pool, count: 1, label: 'Target', defaults: [def] };
    }
    if (mySave && chosenCard?.kind === 'disaster-redirect') {
      const safest = [...others].sort((a, b) => (s.disasterAreas[b]?.length ?? 0) - (s.disasterAreas[a]?.length ?? 0));
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

  // ---- what a click in your hand does -----------------------------------------------
  function onHandCard(c: HldCard): (() => void) | undefined {
    if (!me || !alive) return undefined;
    if (iMustPick && c.type === 'point') {
      return () => dispatch(sd ? { type: 'submitSuddenDeathPick', playerId: me, cardId: c.id } : { type: 'submitPick', playerId: me, cardId: c.id });
    }
    if (myPrompt?.kind === 'petRockDiscard' && c.type === 'point' && (!myPrompt.smoothieOnlyEffects || c.hasEffect)) {
      return () => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: c.id });
    }
    if (myPrompt?.kind === 'fireSprayDiscard') {
      return () => setSelIds((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : cur.length < 3 ? [...cur, c.id] : cur));
    }
    if (myPrompt?.kind === 'unwantedLunchSwap') {
      const t = effectiveTargets[0];
      return t ? () => dispatch({ type: 'resolvePrompt', playerId: me, targetPlayerId: t, targetCardId: c.id }) : undefined;
    }
    if (myInstants && canPlayScoringInstantCard(s, me, c)) return () => setChosenCardId((cur) => (cur === c.id ? null : c.id));
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
                <DisasterMeter cards={s.disasterAreas[o.id] ?? []} />
                <TraitChip s={s} id={o.id} />
                {picking && <Chip tone={s.pendingPicks[o.id] ? 'good' : 'dim'}>{s.pendingPicks[o.id] ? 'Ready' : 'Picking…'}</Chip>}
                {(s.hazardAreas[o.id] ?? []).map((h) => <Chip key={h.id} tone="danger" title={h.text}>{h.name}</Chip>)}
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
            {d !== 0 && <> Your dino gets <strong>{d > 0 ? '+1' : '−1'}</strong> on this one.</>} Click a Point card in your hand.
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
            Lowest Point card takes <strong>{disasterName}</strong>. Click one in your hand.
          </Dock>
        );
      }
      return <Dock tone="danger" who={active} eyebrow="Sudden death" title={`${s.suddenDeathPlayers.map((id) => nameOf(s, id)).join(' vs ')} — lowest card takes the Disaster`} />;
    }

    if (s.subPhase === 'pointEffects' && prompt) {
      if (!myPrompt) return <Dock tone="wait" who={active} title={`${active?.name ?? 'Someone'} is resolving ${s.revealedPicks[prompt.playerId]?.name ?? 'their card'}…`} />;
      return <PromptDock s={s} me={me!} prompt={myPrompt} dispatch={dispatch} selIds={selIds} targets={effectiveTargets} targetPicker={targetPicker} />;
    }

    if (s.subPhase === 'awaitingScoringInstants') {
      if (!myInstants) return <Dock tone="wait" who={active} eyebrow="Scoring" title={`${active?.name ?? 'Someone'} may play a Scoring Instant…`} />;
      const need = chosenCard ? INSTANT_NEED[chosenCard.kind] ?? 'none' : 'none';
      const points = myHand.filter((c) => c.type === 'point').sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      const bffCard = secondCardId != null ? points.find((c) => c.id === secondCardId) ?? points[0] : points[0];
      const ready = !!chosenCard && (need === 'none' || effectiveTargets.length === (need === 'two' ? 2 : 1));
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
                    ...(effectiveTargets[0] ? { targetPlayerId: effectiveTargets[0] } : {}),
                    ...(effectiveTargets[1] ? { secondPlayerId: effectiveTargets[1] } : {}),
                    ...(chosenCard.kind === 'bffs-help' && bffCard ? { handCardId: bffCard.id } : {}),
                  })}
                >
                  Play it ▶
                </button>
              )}
              <button className="secondary" onClick={() => dispatch({ type: 'declineScoringInstant', playerId: me! })}>Pass</button>
            </>
          }
        >
          {chosenCard ? chosenCard.text : 'Click a glowing Instant in your hand to tamper with the scores — or pass.'}
          {targetPicker}
          {chosenCard?.kind === 'bffs-help' && (
            <div className="hld-choices">
              {points.map((c) => <PlayCard key={c.id} card={c} size="sm" selected={bffCard?.id === c.id} onClick={() => setSecondCardId(c.id)} />)}
            </div>
          )}
        </Dock>
      );
    }

    if (s.subPhase === 'awaitingDisasterSave') {
      if (!mySave) return <Dock tone="danger" who={active} eyebrow="Disaster incoming" title={`${active?.name ?? 'Someone'} is about to take ${disasterName}…`} />;
      const points = myHand.filter((c) => c.type === 'point').sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
      const luckyDiscard = secondCardId != null ? points.find((c) => c.id === secondCardId) ?? points[0] : points[0];
      const ready = !!chosenCard && (chosenCard.kind !== 'disaster-redirect' || effectiveTargets.length === 1);
      return (
        <Dock
          tone="danger"
          eyebrow="You have the lowest score"
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
                    ...(chosenCard.kind === 'lucky-break' && luckyDiscard ? { discardCardId: luckyDiscard.id } : {}),
                  })}
                >
                  Play {chosenCard.name}
                </button>
              )}
              <button className="secondary" onClick={() => dispatch({ type: 'declineDisasterSave', playerId: me! })}>Take the Disaster</button>
            </>
          }
        >
          {chosenCard ? chosenCard.text : 'Click a save Instant in your hand to dodge it — or take it on the chin.'}
          {chosenCard?.kind === 'disaster-redirect' && targetPicker}
          {chosenCard?.kind === 'lucky-break' && (
            <div className="hld-choices">
              <span className="lobby-hint" style={{ margin: 0 }}>Discard:</span>
              {points.map((c) => <PlayCard key={c.id} card={c} size="sm" selected={luckyDiscard?.id === c.id} onClick={() => setSecondCardId(c.id)} />)}
            </div>
          )}
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
          {s.config.expansions.includes('hazards-ahead') && <Chip>{s.hazardDeck.length} hazards</Chip>}
          {s.seats.length >= 5 && <Chip tone="good">Top 2 score</Chip>}
        </div>
      </Panel>
      <GameLog entries={s.log} seats={s.seats} title="Valley news" />
    </>
  );

  // ---- your area ---------------------------------------------------------------------
  const mySeat = seatOf(s, me);
  const hand = alive && mySeat ? (
    <div className="hld-hand-area">
      <div className="hld-hand-head">
        <div className="hld-me">
          <DinoBadge dino={s.dinos[me!]!} color={mySeat.color} mood={moodOf(me!)} size={48} />
          <div>
            <h4>{HLD_DINO_DEFS.find((d) => d.id === s.dinos[me!])?.name ?? 'Your dino'}</h4>
            <div className="hld-me-sub">{s.trackPosition[me!] ?? 0}/{s.config.trackLength} escaped · {myHand.length} cards</div>
          </div>
          <DisasterMeter cards={s.disasterAreas[me!] ?? []} />
          <TraitChip s={s} id={me!} />
          {hazardScorePenalty(s, me!) < 0 && <Chip tone="danger">Hazards {hazardScorePenalty(s, me!)}</Chip>}
          {(s.hazardAreas[me!] ?? []).map((h) => <HazardCard key={h.id} hazard={h} size="xs" />)}
        </div>
        {s.roundNumber === 1 && s.subPhase === 'selecting' && !myPick && (
          <div className="hld-swap-dino">
            <span>Switch dino:</span>
            {HLD_DINO_DEFS.map((d) => (
              <DinoCard key={d.id} dino={d.id} compact selected={s.dinos[me!] === d.id} onClick={() => dispatch({ type: 'chooseDino', playerId: me!, dinoId: d.id })} />
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

/** Three slots: filled with the Disasters taken; empty slots that would be fatal glow red. */
function DisasterMeter({ cards }: { cards: HldDisasterCard[] }) {
  const deadly = deadlyCategories(cards);
  const title = cards.length
    ? `${cards.map((c) => `${c.name} (${CATEGORY_LABEL[c.category]})`).join(', ')}${deadly.length ? ` — next ${deadly.map((c) => CATEGORY_LABEL[c]).join('/')} is fatal` : ''}`
    : 'No disasters yet';
  return (
    <span className="hld-meter" title={title}>
      {[0, 1, 2].map((i) => {
        const c = cards[i];
        if (c) return <span key={i} className="hld-meter-slot is-full"><CategoryIcon category={c.category} size={22} /></span>;
        if (i === 2 && deadly.length) {
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
  return <Chip tone={d > 0 ? 'good' : 'danger'} title="Dino trait vs this Disaster">{d > 0 ? '+1' : '−1'} trait</Chip>;
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

/** The point-effect prompts (Pet Rock, Dino Grabber, Grappling Snake, …). */
function PromptDock({ s, me, prompt, dispatch, selIds, targets, targetPicker }: {
  s: HldState;
  me: PlayerId;
  prompt: HldPrompt;
  dispatch: (a: HldAction) => void;
  selIds: number[];
  targets: PlayerId[];
  targetPicker: ReactNode;
}) {
  const skip = <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>Skip</button>;
  const card = s.revealedPicks[me];
  const eyebrow = card ? `${card.name} effect` : 'Card effect';

  switch (prompt.kind) {
    case 'petRockDiscard':
      return (
        <Dock tone="turn" eyebrow={eyebrow} title={prompt.smoothieOnlyEffects ? 'Blend a card into your score?' : 'Toss a Point card on the pile?'} actions={skip}>
          Click a {prompt.smoothieOnlyEffects ? 'Point card with an effect' : 'Point card'} in your hand: it's discarded and its value is added to your score this round.
        </Dock>
      );
    case 'dinoGrabberSteal': {
      const victim = targets[0];
      const theirs = victim ? s.hands[victim] ?? [] : [];
      return (
        <Dock tone="turn" eyebrow={eyebrow} title="Rummage through a hand and take one" actions={skip}>
          {targetPicker}
          <div className="hld-choices is-scroll">
            {theirs.map((c) => (
              <PlayCard key={c.id} card={c} size="sm" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetPlayerId: victim!, targetCardId: c.id })} />
            ))}
          </div>
        </Dock>
      );
    }
    case 'grapplingSnakeSwap':
      return (
        <Dock
          tone="turn"
          eyebrow={eyebrow}
          title="Swap your Point card with a neighbour's?"
          actions={
            <>
              <button disabled={!targets[0]} onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetPlayerId: targets[0]! })}>Swap ▶</button>
              {skip}
            </>
          }
        >
          {targetPicker}
          <div className="hld-choices">
            {prompt.validNeighbors.map((id) => s.revealedPicks[id] && <PlayCard key={id} card={s.revealedPicks[id]!} size="sm" footnote={nameOf(s, id)} selected={targets[0] === id} />)}
          </div>
        </Dock>
      );
    case 'fireSprayDiscard':
      return (
        <Dock
          tone="turn"
          eyebrow={eyebrow}
          title="Torch up to 3 cards from your hand?"
          actions={
            <>
              <button disabled={selIds.length === 0} onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, cardIds: selIds })}>Discard {selIds.length || ''}</button>
              {skip}
            </>
          }
        >
          Click up to three cards in your hand.
        </Dock>
      );
    case 'treenocularsPick':
      return (
        <Dock tone="turn" eyebrow={eyebrow} title="Keep one, toss the other">
          <div className="hld-choices">
            {prompt.cards.map((c) => <PlayCard key={c.id} card={c} size="md" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: c.id })} />)}
          </div>
        </Dock>
      );
    case 'hungryPlantSwap':
      return (
        <Dock
          tone="turn"
          eyebrow={eyebrow}
          title="Swap any two players' Point cards?"
          actions={
            <>
              <button disabled={targets.length !== 2 || targets[0] === targets[1]} onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetPlayerId: targets[0]!, secondPlayerId: targets[1]! })}>Swap ▶</button>
              {skip}
            </>
          }
        >
          {targetPicker}
        </Dock>
      );
    case 'trashIntoTreasurePick': {
      const pts = s.discard.filter((c) => c.type === 'point');
      return (
        <Dock tone="turn" eyebrow={eyebrow} title="Dig a Point card out of the discard pile" actions={skip}>
          <div className="hld-choices is-scroll">
            {pts.map((c) => <PlayCard key={c.id} card={c} size="sm" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: c.id })} />)}
          </div>
        </Dock>
      );
    }
    case 'unwantedLunchSwap':
      return (
        <Dock tone="turn" eyebrow={eyebrow} title="Trade lunches" actions={skip}>
          Pick who you're trading with, then click a card in your hand to give them; you take one of theirs at random.
          {targetPicker}
        </Dock>
      );
    case 'coldFeetSwap': {
      const topCard = s.discard.find((c) => c.id === prompt.topDiscardPointCardId);
      return (
        <Dock
          tone="turn"
          eyebrow={eyebrow}
          title="Swap for the top Point card of the discard pile?"
          actions={
            <>
              {topCard && <PlayCard card={topCard} size="sm" />}
              <button onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: prompt.topDiscardPointCardId })}>Swap ▶</button>
              <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>Keep Cold Feet</button>
            </>
          }
        />
      );
    }
    case 'removeHazardPick': {
      const mine = s.hazardAreas[me] ?? [];
      return (
        <Dock tone="turn" eyebrow={eyebrow} title={prompt.canTransferToOpponent ? 'Pass a Hazard to someone else' : 'Clear away a Hazard'} actions={skip}>
          {prompt.canTransferToOpponent && targetPicker}
          <div className="hld-choices">
            {mine.map((h) => (
              <HazardCard
                key={h.id}
                hazard={h}
                size="sm"
                onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: h.id, ...(prompt.canTransferToOpponent && targets[0] ? { targetPlayerId: targets[0] } : {}) })}
              />
            ))}
          </div>
        </Dock>
      );
    }
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

