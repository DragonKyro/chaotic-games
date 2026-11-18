// Happy Little Dinosaurs — LobbyConfig + GameView with full player decision support.

import { useState } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import { HLD_DINO_DEFS } from './cards';
import {
  computeRoundScores,
  dinoTraitDelta,
  handOf,
  isLive,
  livePlayerIds,
  seatName,
} from './reducer';
import type { HldAction, HldCard, HldConfig, HldExpansionId, HldPrompt, HldState } from './types';
import { HLD_EXPANSIONS } from './types';

export function LobbyConfig({
  config,
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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

      <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}>
        <input
          type="checkbox"
          checked={config.expansions.includes('players-5-6')}
          onChange={() => toggleExp('players-5-6')}
        />
        <span>Enable 5–6 Player Boards (Pterry Dactyl &amp; Raging Raptor)</span>
      </label>

      <p style={{ margin: 0, fontSize: '0.84rem', opacity: 0.8 }}>
        2–4 players (up to 6 with 5–6 Player toggle). Flip a Disaster, play a Point card face-down, resolve weapon
        effects &amp; Instants, and reach {config.trackLength} points before collecting 3 Disasters! ({HLD_EXPANSIONS.length} expansions listed.)
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
  const [redirectTarget, setRedirectTarget] = useState<PlayerId | null>(null);

  const myHand = me ? handOf(s, me) : [];
  const scores = s.subPhase !== 'selecting' ? computeRoundScores(s) : {};

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
            <div style={{ fontSize: '0.84rem', opacity: 0.85, marginTop: 4 }}>{s.currentDisaster.text}</div>
          </div>
          <div style={{ fontSize: '0.85rem' }}>
            Round <strong>{s.roundNumber}</strong> · Phase: <strong>{s.subPhase}</strong> · Deck: <strong>{s.deck.length}</strong>
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
          <div style={{ marginBottom: 8, fontSize: '0.85rem' }}>
            <span>Target Player (for Score Booster / Score Sapper): </span>
            <select
              value={instantTarget ?? me}
              onChange={(e) => setInstantTarget(e.target.value)}
            >
              {livePlayerIds(s).map((id) => (
                <option key={id} value={id}>
                  {seatName(s, id)} (Score: {scores[id] ?? 0})
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {myHand
              .filter(
                (c) =>
                  c.kind === 'score-booster' ||
                  c.kind === 'score-sapper' ||
                  c.kind === 'score-inversion',
              )
              .map((c) => (
                <button
                  key={c.id}
                  onClick={() =>
                    dispatch({
                      type: 'playScoringInstant',
                      playerId: me,
                      cardId: c.id,
                      targetPlayerId: instantTarget ?? me,
                    })
                  }
                >
                  Play {c.name}
                </button>
              ))}
            <button className="secondary" onClick={() => dispatch({ type: 'declineScoringInstant', playerId: me })}>
              Pass / Done
            </button>
          </div>
        </div>
      )}

      {/* Disaster Insurance / Redirect Window */}
      {me && s.subPhase === 'awaitingDisasterSave' && s.activePlayerId === me && (
        <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444' }}>
          <h4 style={{ margin: '0 0 8px' }}>💥 You have the lowest score! Play Disaster Insurance or Redirect?</h4>
          <div style={{ marginBottom: 8, fontSize: '0.85rem' }}>
            <span>Redirect Target: </span>
            <select
              value={redirectTarget ?? livePlayerIds(s).find((id) => id !== me) ?? ''}
              onChange={(e) => setRedirectTarget(e.target.value)}
            >
              {livePlayerIds(s)
                .filter((id) => id !== me)
                .map((id) => (
                  <option key={id} value={id}>
                    {seatName(s, id)}
                  </option>
                ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {myHand
              .filter((c) => c.kind === 'disaster-insurance' || c.kind === 'disaster-redirect')
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
                          ? redirectTarget ?? livePlayerIds(s).find((id) => id !== me)
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
          const revealed = s.revealedPicks[seat.id];
          const committed = s.pendingPicks[seat.id] !== null;
          const traitMod = dinoTraitDelta(s, seat.id);
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
                <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                  🦕 <strong>{dinoDef.name}</strong> ({dinoDef.text}) · Trait this round:{' '}
                  <strong>{traitMod >= 0 ? `+${traitMod}` : traitMod}</strong>
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
        <h4 style={{ margin: '0 0 8px' }}>Dino Grabber — Look at another player&apos;s hand and take 1 card</h4>
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
        <h4 style={{ margin: '0 0 8px' }}>Treenoculars — Choose 1 card to add to your hand (discard the other)</h4>
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

  return null;
}
