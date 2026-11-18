// Happy Little Dinosaurs — LobbyConfig + GameView + Thumbnail (Base + all 4 Expansions).

import { useState } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import { HLD_DINO_DEFS } from './cards';
import {
  canPlayDisasterSaveCard,
  canPlayScoringInstantCard,
  computeRoundScores,
  dinoTraitDelta,
  handOf,
  hazardScorePenalty,
  isLive,
  livePlayerIds,
  seatName,
} from './reducer';
import type {
  HldAction,
  HldCard,
  HldConfig,
  HldDinoId,
  HldExpansionId,
  HldPrompt,
  HldState,
} from './types';
import { HLD_EXPANSIONS } from './types';

export function HldThumbnail() {
  return (
    <svg viewBox="0 0 120 90" width="100%" height="100%" aria-label="Happy Little Dinosaurs">
      <defs>
        <linearGradient id="hldSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>
      </defs>
      <rect width="120" height="90" rx="10" fill="url(#hldSky)" />
      {/* Falling Meteor */}
      <path d="M98 10 L76 30" stroke="#f97316" strokeWidth="5" strokeLinecap="round" />
      <circle cx="74" cy="32" r="8" fill="#ef4444" />
      <circle cx="73" cy="31" r="4" fill="#facc15" />
      {/* Cute Happy Dino */}
      <path
        d="M24 72 C24 52, 34 40, 48 40 C58 40, 62 46, 62 54 C62 60, 54 62, 52 66 L54 78 L44 78 L44 70 L36 70 L36 78 L26 78 Z"
        fill="#22c55e"
        stroke="#14532d"
        strokeWidth="2"
      />
      {/* Dino Spikes */}
      <polygon points="34,42 38,34 42,40" fill="#facc15" />
      <polygon points="27,50 29,42 34,46" fill="#facc15" />
      <polygon points="23,60 22,52 28,55" fill="#facc15" />
      {/* Dino Eye & Smile */}
      <circle cx="53" cy="48" r="2.5" fill="#000" />
      <circle cx="54" cy="47" r="0.9" fill="#fff" />
      <path d="M52 55 Q57 58 60 54" stroke="#14532d" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function LobbyConfig({
  config,
  seats,
  onChange,
}: {
  config: HldConfig;
  seats: Seat[];
  onChange: (c: HldConfig) => void;
}) {
  function toggleExp(id: HldExpansionId) {
    const next = config.expansions.includes(id)
      ? config.expansions.filter((x) => x !== id)
      : [...config.expansions, id];
    onChange({ ...config, expansions: next });
  }

  function setSeatDino(seatId: PlayerId, dinoId: HldDinoId) {
    const nextSelections: Record<PlayerId, HldDinoId> = { ...(config.dinoSelections ?? {}) };
    nextSelections[seatId] = dinoId;
    onChange({ ...config, dinoSelections: nextSelections });
  }

  const availableDinos = config.expansions.includes('players-5-6') || seats.length > 4
    ? HLD_DINO_DEFS
    : HLD_DINO_DEFS;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>Escape Route Goal</span>
        <select
          value={config.trackLength}
          onChange={(e) => onChange({ ...config, trackLength: Number(e.target.value) })}
        >
          <option value={50}>50 Points (Standard Rulebook)</option>
          <option value={30}>30 Points (Quick Game)</option>
        </select>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong style={{ fontSize: '0.88rem' }}>Expansions ({HLD_EXPANSIONS.length})</strong>
        {HLD_EXPANSIONS.map((exp) => {
          const id = exp.id as HldExpansionId;
          const checked = config.expansions.includes(id);
          return (
            <label
              key={exp.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: '0.84rem',
                padding: '6px 8px',
                borderRadius: 6,
                background: checked ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${checked ? '#22c55e' : 'rgba(255,255,255,0.1)'}`,
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleExp(id)}
                style={{ marginTop: 3 }}
              />
              <div>
                <div>
                  <strong>{exp.name}</strong>
                </div>
                <div style={{ fontSize: '0.78rem', opacity: 0.8 }}>{exp.summary}</div>
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong style={{ fontSize: '0.88rem' }}>Choose Dinosaurs</strong>
        {seats.map((seat, idx) => {
          const currentDino =
            config.dinoSelections?.[seat.id] ??
            availableDinos[idx % availableDinos.length]!.id;
          return (
            <div
              key={seat.id}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: '0.84rem' }}
            >
              <span>{seat.name}</span>
              <select
                value={currentDino}
                onChange={(e) => setSeatDino(seat.id, e.target.value as HldDinoId)}
              >
                {availableDinos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.text})
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>

      <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.8 }}>
        2–6 players (with 5–6 Player Top-2 Scoring at 5–6 seats). Flip a Disaster, play a Point card face-down, resolve
        weapon effects &amp; Instants, and reach {config.trackLength} points before collecting 3 Disasters!
      </p>
    </div>
  );
}

const DISASTER_COLORS: Record<string, string> = {
  natural: '#22c55e',
  predator: '#ef4444',
  emotional: '#3b82f6',
  meteor: '#a855f7',
};

function HldCardBox({
  card,
  selected,
  onClick,
  compact,
}: {
  card: HldCard;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const isPoint = card.type === 'point';
  const color = isPoint ? '#f97316' : '#eab308';
  return (
    <div
      onClick={onClick}
      style={{
        border: `2px solid ${selected ? '#facc15' : color}`,
        borderRadius: 8,
        padding: compact ? '6px 8px' : '8px 10px',
        background: selected ? 'rgba(250,204,21,0.16)' : 'rgba(255,255,255,0.04)',
        width: compact ? 150 : 180,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: '0.85rem' }}>{card.name}</strong>
        <span
          style={{
            fontSize: '0.72rem',
            padding: '1px 6px',
            borderRadius: 4,
            background: color,
            color: '#000',
            fontWeight: 700,
          }}
        >
          {isPoint ? `Pt ${card.value}` : 'Instant'}
        </span>
      </div>
      <div style={{ fontSize: '0.74rem', opacity: 0.85, lineHeight: 1.25 }}>{card.text}</div>
    </div>
  );
}

export function GameView({
  state: s,
  localPlayerId: me,
  dispatch,
}: {
  state: HldState;
  localPlayerId: PlayerId | null;
  dispatch: (action: HldAction) => void;
}) {
  const [instantTarget, setInstantTarget] = useState<PlayerId | null>(null);
  const [instantSecondTarget, setInstantSecondTarget] = useState<PlayerId | null>(null);
  const [instantHandCardId, setInstantHandCardId] = useState<number | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<PlayerId | null>(null);
  const [luckyBreakCardId, setLuckyBreakCardId] = useState<number | null>(null);

  const myHand = me ? handOf(s, me) : [];
  const myPointCards = myHand.filter((c) => c.type === 'point');
  const scores = s.subPhase !== 'selecting' ? computeRoundScores(s) : {};
  const live = livePlayerIds(s);
  const hazardsEnabled =
    s.config.expansions.includes('hazards-ahead') ||
    s.hazardDeck.length > 0 ||
    s.seats.some((st) => (s.hazardAreas?.[st.id]?.length ?? 0) > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Active Disaster Banner */}
      {s.currentDisaster && (
        <div
          style={{
            padding: 14,
            borderRadius: 10,
            border: `2px solid ${DISASTER_COLORS[s.currentDisaster.category] ?? '#fff'}`,
            background: 'rgba(255,255,255,0.05)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '2px 6px',
                borderRadius: 4,
                background: DISASTER_COLORS[s.currentDisaster.category],
                color: '#fff',
                marginRight: 8,
                textTransform: 'uppercase',
              }}
            >
              {s.currentDisaster.category} Disaster
            </span>
            <strong style={{ fontSize: '1.05rem' }}>{s.currentDisaster.name}</strong>
            {s.currentDisaster.drawsHazard && (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: '0.72rem',
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: '#f59e0b',
                  color: '#000',
                  fontWeight: 700,
                }}
              >
                ⚠️ +1 Hazard Card
              </span>
            )}
            <div style={{ fontSize: '0.84rem', opacity: 0.85, marginTop: 4 }}>{s.currentDisaster.text}</div>
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            Round <strong>{s.roundNumber}</strong> · Phase: <strong>{s.subPhase}</strong> · Deck: <strong>{s.deck.length}</strong>
            {hazardsEnabled && (
              <>
                {' '}· Hazards: <strong>{s.hazardDeck.length}</strong>
              </>
            )}
            {s.seats.length >= 5 && (
              <div style={{ fontSize: '0.76rem', color: '#22c55e', marginTop: 2 }}>
                5–6 Player Rule: Top 2 scorers advance!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Over */}
      {s.phase === 'gameOver' && (
        <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.2)', border: '2px solid #22c55e' }}>
          <h3 style={{ margin: 0 }}>🦕 {seatName(s, s.winnerId)} wins Happy Little Dinosaurs!</h3>
        </div>
      )}

      {/* Point Effect Prompts */}
      {me && s.subPhase === 'pointEffects' && s.activePlayerId === me && s.promptQueue[0] && (
        <HldPromptView state={s} prompt={s.promptQueue[0]} me={me} dispatch={dispatch} />
      )}

      {/* Scoring Instants Window */}
      {me && s.subPhase === 'awaitingScoringInstants' && s.activePlayerId === me && (
        <div style={{ padding: 14, borderRadius: 8, background: 'rgba(234,179,8,0.15)', border: '2px solid #eab308' }}>
          <h4 style={{ margin: '0 0 8px' }}>Scoring Phase — Play a Scoring Instant?</h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8, fontSize: '0.85rem' }}>
            <label>
              <span>Target Player 1: </span>
              <select
                value={instantTarget ?? me}
                onChange={(e) => setInstantTarget(e.target.value)}
              >
                {live.map((id) => (
                  <option key={id} value={id}>
                    {seatName(s, id)} (Score: {scores[id] ?? 0})
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Target Player 2 (Double Date / Spiteful Bullying): </span>
              <select
                value={instantSecondTarget ?? live.find((id) => id !== (instantTarget ?? me)) ?? me}
                onChange={(e) => setInstantSecondTarget(e.target.value)}
              >
                {live.map((id) => (
                  <option key={id} value={id}>
                    {seatName(s, id)} (Score: {scores[id] ?? 0})
                  </option>
                ))}
              </select>
            </label>
            {myPointCards.length > 0 && (
              <label>
                <span>Hand Point Card (BFF&apos;s Help): </span>
                <select
                  value={instantHandCardId ?? myPointCards[0]!.id}
                  onChange={(e) => setInstantHandCardId(Number(e.target.value))}
                >
                  {myPointCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (+{c.value})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {myHand
              .filter((c) => canPlayScoringInstantCard(s, me, c))
              .map((c) => {
                const p1 = instantTarget ?? me;
                const p2 = instantSecondTarget ?? live.find((id) => id !== p1) ?? me;
                return (
                  <button
                    key={c.id}
                    onClick={() =>
                      dispatch({
                        type: 'playScoringInstant',
                        playerId: me,
                        cardId: c.id,
                        targetPlayerId: p1,
                        secondPlayerId: p2,
                        handCardId: instantHandCardId ?? myPointCards[0]?.id,
                      })
                    }
                  >
                    Play {c.name}
                  </button>
                );
              })}
            <button className="secondary" onClick={() => dispatch({ type: 'declineScoringInstant', playerId: me })}>
              Pass / Done
            </button>
          </div>
        </div>
      )}

      {/* Disaster Insurance / Redirect / Lucky Break / Crippling Shyness / Detour Window */}
      {me && s.subPhase === 'awaitingDisasterSave' && s.activePlayerId === me && (
        <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444' }}>
          <h4 style={{ margin: '0 0 8px' }}>💥 You have the lowest score! Play a Disaster Save Instant?</h4>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 8, fontSize: '0.85rem' }}>
            <label>
              <span>Redirect Target: </span>
              <select
                value={redirectTarget ?? live.find((id) => id !== me) ?? ''}
                onChange={(e) => setRedirectTarget(e.target.value)}
              >
                {live
                  .filter((id) => id !== me)
                  .map((id) => (
                    <option key={id} value={id}>
                      {seatName(s, id)}
                    </option>
                  ))}
              </select>
            </label>
            {myPointCards.length > 0 && (
              <label>
                <span>Point Card to Discard (Lucky Break): </span>
                <select
                  value={luckyBreakCardId ?? myPointCards[0]!.id}
                  onChange={(e) => setLuckyBreakCardId(Number(e.target.value))}
                >
                  {myPointCards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (Pt {c.value})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {myHand
              .filter((c) => canPlayDisasterSaveCard(s, me, c))
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    dispatch({
                      type: 'playDisasterSave',
                      playerId: me,
                      cardId: c.id,
                      targetPlayerId:
                        c.kind === 'disaster-redirect'
                          ? redirectTarget ?? live.find((id) => id !== me)
                          : undefined,
                      discardCardId:
                        c.kind === 'lucky-break'
                          ? luckyBreakCardId ?? myPointCards[0]?.id
                          : undefined,
                    })
                  }
                >
                  Play {c.name}
                </button>
              ))}
            <button className="secondary" onClick={() => dispatch({ type: 'declineDisasterSave', playerId: me })}>
              Accept Disaster
            </button>
          </div>
        </div>
      )}

      {/* Dinosaur Player Boards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        {s.seats.map((seat) => {
          const dinoDef = HLD_DINO_DEFS.find((d) => d.id === s.dinos[seat.id]);
          const dead = !isLive(s, seat.id);
          const disasters = s.disasterAreas[seat.id] ?? [];
          const hazards = s.hazardAreas?.[seat.id] ?? [];
          const revealed = s.revealedPicks[seat.id];
          const committed = s.pendingPicks[seat.id] !== null;
          const traitMod = dinoTraitDelta(s, seat.id);
          const hazPen = hazardScorePenalty(s, seat.id);
          return (
            <div
              key={seat.id}
              style={{
                border: `2px solid ${s.activePlayerId === seat.id ? seat.color : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 10,
                padding: 12,
                opacity: dead ? 0.5 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{seat.name}</strong> {seat.id === me && <em>(You)</em>}
                  {dead && <span style={{ marginLeft: 6, color: '#ef4444' }}>(Eliminated)</span>}
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  Escape Route: <strong>{s.trackPosition[seat.id] ?? 0} / {s.config.trackLength}</strong>
                </div>
              </div>

              {dinoDef && (
                <div style={{ fontSize: '0.78rem', opacity: 0.85, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span>
                    🦕 <strong>{dinoDef.name}</strong> ({dinoDef.text}) · Trait:{' '}
                    <strong>{traitMod >= 0 ? `+${traitMod}` : traitMod}</strong>
                    {hazPen < 0 && (
                      <span style={{ color: '#f59e0b', marginLeft: 4 }}>
                        · Hazard: <strong>{hazPen}</strong>
                      </span>
                    )}
                  </span>
                  {seat.id === me && s.roundNumber === 1 && s.subPhase === 'selecting' && !committed && (
                    <select
                      aria-label="Switch Dinosaur"
                      value={dinoDef.id}
                      onChange={(e) =>
                        dispatch({
                          type: 'chooseDino',
                          playerId: me,
                          dinoId: e.target.value as HldDinoId,
                        })
                      }
                      style={{ fontSize: '0.72rem' }}
                    >
                      {HLD_DINO_DEFS.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* Revealed or Committed Card */}
              <div style={{ fontSize: '0.82rem', padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }}>
                {s.subPhase === 'selecting' || s.subPhase === 'suddenDeath' ? (
                  <span>Point Card: <strong>{committed ? '✅ Committed face-down' : '⏳ Choosing…'}</strong></span>
                ) : revealed ? (
                  <div>
                    Played: <strong>{revealed.name}</strong> (Val {revealed.value}) · Round Score:{' '}
                    <strong style={{ color: '#facc15' }}>{scores[seat.id] ?? 0}</strong>
                  </div>
                ) : (
                  <span>—</span>
                )}
              </div>

              {/* Disaster Area */}
              <div>
                <div style={{ fontSize: '0.76rem', opacity: 0.75, marginBottom: 4 }}>
                  Disaster Area ({disasters.length} / 3):
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {disasters.map((d) => (
                    <span
                      key={d.id}
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: DISASTER_COLORS[d.category],
                        color: '#fff',
                      }}
                    >
                      {d.name} ({d.category})
                    </span>
                  ))}
                  {disasters.length === 0 && <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>None</span>}
                </div>
              </div>

              {/* Hazard Area */}
              {(hazardsEnabled || hazards.length > 0) && (
                <div>
                  <div style={{ fontSize: '0.76rem', opacity: 0.75, marginBottom: 4 }}>
                    Hazard Area ({hazards.length}):
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {hazards.map((h) => (
                      <span
                        key={h.id}
                        title={h.text}
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: '#f59e0b',
                          color: '#000',
                          fontWeight: 600,
                        }}
                      >
                        ⚠️ {h.name}
                      </span>
                    ))}
                    {hazards.length === 0 && <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>None</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Local Hand */}
      {me && isLive(s, me) && (
        <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: 12 }}>
          <h4 style={{ margin: '0 0 8px' }}>
            Your Hand ({myHand.length})
            {s.subPhase === 'selecting' && !s.pendingPicks[me] && ' — Click a Point card to commit it face-down!'}
            {s.subPhase === 'suddenDeath' &&
              s.suddenDeathPlayers.includes(me) &&
              !s.pendingPicks[me] &&
              ' — Sudden Death! Click a Point card to break the tie!'}
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {myHand.map((c) => {
              const canCommitMain =
                s.subPhase === 'selecting' && !s.pendingPicks[me] && c.type === 'point';
              const canCommitSD =
                s.subPhase === 'suddenDeath' &&
                s.suddenDeathPlayers.includes(me) &&
                !s.pendingPicks[me] &&
                c.type === 'point';
              return (
                <HldCardBox
                  key={c.id}
                  card={c}
                  onClick={
                    canCommitMain
                      ? () => dispatch({ type: 'submitPick', playerId: me, cardId: c.id })
                      : canCommitSD
                        ? () => dispatch({ type: 'submitSuddenDeathPick', playerId: me, cardId: c.id })
                        : undefined
                  }
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Log */}
      <div style={{ fontSize: '0.82rem', padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.25)', maxHeight: 130, overflowY: 'auto' }}>
        {s.log.slice(-8).map((entry) => (
          <div key={entry.seq}>{entry.text}</div>
        ))}
      </div>
    </div>
  );
}

function HldPromptView({
  state: s,
  prompt,
  me,
  dispatch,
}: {
  state: HldState;
  prompt: HldPrompt;
  me: PlayerId;
  dispatch: (a: HldAction) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [targetP1, setTargetP1] = useState<PlayerId | null>(null);
  const [targetP2, setTargetP2] = useState<PlayerId | null>(null);
  const myHand = handOf(s, me);

  if (prompt.kind === 'petRockDiscard') {
    const valid = myHand.filter(
      (c) => c.type === 'point' && (!prompt.smoothieOnlyEffects || c.hasEffect),
    );
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(249,115,22,0.15)', border: '2px solid #f97316' }}>
        <h4 style={{ margin: '0 0 6px' }}>
          {prompt.smoothieOnlyEffects ? 'Delicious Smoothie' : 'Pet Rock'} — Discard a Point card to add its value to your score?
        </h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {valid.map((c) => (
            <HldCardBox
              key={c.id}
              card={c}
              compact
              onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: c.id })}
            />
          ))}
        </div>
        <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
          Skip
        </button>
      </div>
    );
  }

  if (prompt.kind === 'dinoGrabberSteal') {
    const others = livePlayerIds(s).filter((id) => id !== me && handOf(s, id).length > 0);
    const chosenOpp = targetP1 ?? others[0] ?? null;
    const oppCards = chosenOpp ? handOf(s, chosenOpp) : [];
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e' }}>
        <h4 style={{ margin: '0 0 8px' }}>Look at another player&apos;s hand and take 1 card</h4>
        <div style={{ marginBottom: 8 }}>
          <select value={chosenOpp ?? ''} onChange={(e) => setTargetP1(e.target.value)}>
            {others.map((id) => (
              <option key={id} value={id}>
                {seatName(s, id)}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {oppCards.map((c) => (
            <HldCardBox
              key={c.id}
              card={c}
              compact
              onClick={() =>
                chosenOpp &&
                dispatch({
                  type: 'resolvePrompt',
                  playerId: me,
                  targetPlayerId: chosenOpp,
                  targetCardId: c.id,
                })
              }
            />
          ))}
        </div>
        <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
          Skip
        </button>
      </div>
    );
  }

  if (prompt.kind === 'grapplingSnakeSwap') {
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '2px solid #3b82f6' }}>
        <h4 style={{ margin: '0 0 8px' }}>Grappling Snake — Swap your Point card with a neighbor?</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          {prompt.validNeighbors.map((id) => (
            <button
              key={id}
              onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetPlayerId: id })}
            >
              Swap with {seatName(s, id)} ({s.revealedPicks[id]?.name})
            </button>
          ))}
          <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
            Skip
          </button>
        </div>
      </div>
    );
  }

  if (prompt.kind === 'fireSprayDiscard') {
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(249,115,22,0.15)', border: '2px solid #f97316' }}>
        <h4 style={{ margin: '0 0 8px' }}>Fire Spray — Discard up to 3 cards from your hand?</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {myHand.map((c) => (
            <HldCardBox
              key={c.id}
              card={c}
              compact
              selected={selectedIds.includes(c.id)}
              onClick={() =>
                setSelectedIds((cur) =>
                  cur.includes(c.id) ? cur.filter((x) => x !== c.id) : cur.length < 3 ? [...cur, c.id] : cur,
                )
              }
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            disabled={selectedIds.length === 0}
            onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, cardIds: selectedIds })}
          >
            Discard Selected ({selectedIds.length})
          </button>
          <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
            Skip
          </button>
        </div>
      </div>
    );
  }

  if (prompt.kind === 'treenocularsPick') {
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e' }}>
        <h4 style={{ margin: '0 0 8px' }}>Choose 1 card to add to your hand (discard the other)</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          {prompt.cards.map((c) => (
            <HldCardBox
              key={c.id}
              card={c}
              compact
              onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: c.id })}
            />
          ))}
        </div>
      </div>
    );
  }

  if (prompt.kind === 'hungryPlantSwap') {
    const live = livePlayerIds(s);
    const p1 = targetP1 ?? live[0] ?? me;
    const p2 = targetP2 ?? live[1] ?? me;
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(168,85,247,0.15)', border: '2px solid #a855f7' }}>
        <h4 style={{ margin: '0 0 8px' }}>Hungry Plant — Swap the Point cards of any two players?</h4>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <select value={p1} onChange={(e) => setTargetP1(e.target.value)}>
            {live.map((id) => (
              <option key={id} value={id}>
                {seatName(s, id)} ({s.revealedPicks[id]?.name})
              </option>
            ))}
          </select>
          <span>↔</span>
          <select value={p2} onChange={(e) => setTargetP2(e.target.value)}>
            {live.map((id) => (
              <option key={id} value={id}>
                {seatName(s, id)} ({s.revealedPicks[id]?.name})
              </option>
            ))}
          </select>
          <button
            disabled={p1 === p2}
            onClick={() =>
              dispatch({
                type: 'resolvePrompt',
                playerId: me,
                targetPlayerId: p1,
                secondPlayerId: p2,
              })
            }
          >
            Swap Point Cards
          </button>
          <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
            Skip
          </button>
        </div>
      </div>
    );
  }

  if (prompt.kind === 'trashIntoTreasurePick') {
    const discardPoints = s.discard.filter((c) => c.type === 'point');
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e' }}>
        <h4 style={{ margin: '0 0 8px' }}>Trash into Treasure — Choose a Point card from the discard pile to add to your hand</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {discardPoints.map((c) => (
            <HldCardBox
              key={c.id}
              card={c}
              compact
              onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: c.id })}
            />
          ))}
        </div>
        <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
          Skip
        </button>
      </div>
    );
  }

  if (prompt.kind === 'unwantedLunchSwap') {
    const others = livePlayerIds(s).filter((id) => id !== me);
    const chosenOpp = targetP1 ?? others[0] ?? null;
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(249,115,22,0.15)', border: '2px solid #f97316' }}>
        <h4 style={{ margin: '0 0 8px' }}>
          Unwanted Lunch — Give a card from your hand to another player and take 1 random card from theirs
        </h4>
        <div style={{ marginBottom: 8 }}>
          <span>Target Player: </span>
          <select value={chosenOpp ?? ''} onChange={(e) => setTargetP1(e.target.value)}>
            {others.map((id) => (
              <option key={id} value={id}>
                {seatName(s, id)} ({handOf(s, id).length} cards)
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {myHand.map((c) => (
            <HldCardBox
              key={c.id}
              card={c}
              compact
              onClick={() =>
                chosenOpp &&
                dispatch({
                  type: 'resolvePrompt',
                  playerId: me,
                  targetPlayerId: chosenOpp,
                  targetCardId: c.id,
                })
              }
            />
          ))}
        </div>
        <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
          Skip
        </button>
      </div>
    );
  }

  if (prompt.kind === 'coldFeetSwap') {
    const topCard = s.discard.find((c) => c.id === prompt.topDiscardPointCardId);
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '2px solid #3b82f6' }}>
        <h4 style={{ margin: '0 0 8px' }}>
          Cold Feet — Swap your Point card with the top Point card of the discard pile ({topCard?.name ?? 'Point Card'}, Pt {topCard?.value ?? 0})?
        </h4>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {topCard && <HldCardBox card={topCard} compact />}
          <button
            onClick={() =>
              dispatch({
                type: 'resolvePrompt',
                playerId: me,
                targetCardId: prompt.topDiscardPointCardId,
              })
            }
          >
            Swap with {topCard?.name ?? 'Discard'}
          </button>
          <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
            Keep Cold Feet
          </button>
        </div>
      </div>
    );
  }

  if (prompt.kind === 'removeHazardPick') {
    const myHazards = s.hazardAreas[me] ?? [];
    const others = livePlayerIds(s).filter((id) => id !== me);
    const chosenOpp = targetP1 ?? others[0] ?? null;
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(245,158,11,0.15)', border: '2px solid #f59e0b' }}>
        <h4 style={{ margin: '0 0 8px' }}>
          {prompt.canTransferToOpponent
            ? "Caution Sign — Move a Hazard card from your Hazard Area to another player's Hazard Area"
            : 'Remove a Hazard card from your Hazard Area'}
        </h4>
        {prompt.canTransferToOpponent && (
          <div style={{ marginBottom: 8 }}>
            <span>Target Player: </span>
            <select value={chosenOpp ?? ''} onChange={(e) => setTargetP1(e.target.value)}>
              {others.map((id) => (
                <option key={id} value={id}>
                  {seatName(s, id)}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {myHazards.map((h) => (
            <button
              key={h.id}
              onClick={() =>
                dispatch({
                  type: 'resolvePrompt',
                  playerId: me,
                  targetCardId: h.id,
                  targetPlayerId: prompt.canTransferToOpponent ? chosenOpp ?? undefined : undefined,
                })
              }
            >
              ⚠️ {h.name} ({h.text})
            </button>
          ))}
        </div>
        <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
          Skip
        </button>
      </div>
    );
  }

  return null;
}
