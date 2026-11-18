// Doomlings — LobbyConfig + GameView with full player decision support.

import { useState } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import {
  canPlayTrait,
  computePlayerScore,
  effectiveGenePool,
  handOf,
  seatName,
  tableauOf,
  validTraitPileTargets,
} from './reducer';
import type {
  DmAction,
  DmConfig,
  DmPrompt,
  DmState,
  DmTraitCard,
  DmTraitColor,
} from './types';
import { DM_EXPANSIONS } from './types';

export function LobbyConfig({
  config: _config,
}: {
  config: DmConfig;
  seats: Seat[];
  onChange: (c: DmConfig) => void;
}) {
  void _config;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{ margin: 0, fontSize: '0.86rem', opacity: 0.85 }}>
        2–6 players. 3 Eras of 3 Ages + 1 Catastrophe each (13-card Age Deck starting with The Birth of Life). Play
        Traits, grow your Gene Pool, trigger Actions, and score Drop of Life &amp; World&apos;s End bonuses when the 3rd
        Catastrophe strikes!
      </p>
      <div style={{ fontSize: '0.8rem', opacity: 0.75 }}>
        <strong>Verified Expansions ({DM_EXPANSIONS.length}):</strong>{' '}
        {DM_EXPANSIONS.map((e) => e.name).join(', ')}.
      </div>
    </div>
  );
}

const COLOR_HEX: Record<DmTraitColor, string> = {
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#a855f7',
  colorless: '#94a3b8',
};

function DmTraitTile({
  card,
  selected,
  disabled,
  onClick,
  compact,
}: {
  card: DmTraitCard;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const color = COLOR_HEX[card.color];
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      style={{
        border: `2px solid ${selected ? '#facc15' : card.dominant ? '#f59e0b' : color}`,
        borderRadius: 8,
        padding: compact ? '6px 8px' : '8px 10px',
        background: selected
          ? 'rgba(250,204,21,0.16)'
          : card.dominant
            ? 'rgba(245,158,11,0.12)'
            : 'rgba(255,255,255,0.04)',
        width: compact ? 150 : 180,
        opacity: disabled ? 0.45 : 1,
        cursor: onClick && !disabled ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        <strong style={{ fontSize: '0.84rem' }}>
          {card.dominant ? '⭐ ' : ''}
          {card.name}
        </strong>
        <span
          style={{
            fontSize: '0.72rem',
            padding: '1px 6px',
            borderRadius: 4,
            background: color,
            color: '#fff',
            fontWeight: 700,
          }}
        >
          {card.points} pt
        </span>
      </div>
      <div style={{ fontSize: '0.73rem', opacity: 0.85, lineHeight: 1.25 }}>{card.text}</div>
    </div>
  );
}

export function GameView({
  state: s,
  localPlayerId: me,
  dispatch,
}: {
  state: DmState;
  localPlayerId: PlayerId | null;
  dispatch: (action: DmAction) => void;
}) {
  const myHand = me ? handOf(s, me) : [];
  const isMyTurn = me !== null && s.turnPlayerId === me;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Active Age / Catastrophe Banner */}
      <div
        style={{
          padding: 14,
          borderRadius: 10,
          border: `2px solid ${s.currentAge.kind === 'catastrophe' ? '#ef4444' : '#3b82f6'}`,
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
              background: s.currentAge.kind === 'catastrophe' ? '#ef4444' : '#3b82f6',
              color: '#fff',
              marginRight: 8,
              textTransform: 'uppercase',
            }}
          >
            {s.currentAge.kind}
          </span>
          <strong style={{ fontSize: '1.05rem' }}>{s.currentAge.name}</strong>
          <div style={{ fontSize: '0.84rem', opacity: 0.9, marginTop: 4 }}>{s.currentAge.text}</div>
          {s.currentAge.worldsEndText && (
            <div style={{ fontSize: '0.78rem', color: '#facc15', marginTop: 2 }}>{s.currentAge.worldsEndText}</div>
          )}
        </div>
        <div style={{ fontSize: '0.86rem' }}>
          Catastrophes: <strong>{s.catastrophesSeen} / 3</strong> · Ages Left: <strong>{s.ageDeck.length}</strong> ·
          Turn: <strong>{seatName(s, s.turnPlayerId)}</strong>
        </div>
      </div>

      {/* Game Over */}
      {s.phase === 'gameOver' && (
        <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.2)', border: '2px solid #22c55e' }}>
          <h3 style={{ margin: 0 }}>🌋 World&apos;s End — {seatName(s, s.winnerId)} wins Doomlings!</h3>
        </div>
      )}

      {/* Active Prompt */}
      {me && s.subPhase === 'awaitingPrompt' && s.activePlayerId === me && s.promptQueue[0] && (
        <DmPromptView state={s} prompt={s.promptQueue[0]} me={me} dispatch={dispatch} />
      )}

      {/* All Players' Trait Piles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        {s.seats.map((seat) => {
          const tab = tableauOf(s, seat.id);
          const gp = effectiveGenePool(s, seat.id);
          const score = computePlayerScore(s, seat.id);
          return (
            <div
              key={seat.id}
              style={{
                border: `2px solid ${s.turnPlayerId === seat.id ? seat.color : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 10,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{seat.name}</strong> {seat.id === me && <em>(You)</em>}
                </div>
                <div style={{ fontSize: '0.82rem' }}>
                  Gene Pool: <strong>{gp}</strong> · Hand: <strong>{handOf(s, seat.id).length}</strong> · Score:{' '}
                  <strong style={{ color: '#facc15' }}>{score.total}</strong> ({score.faceValue} face +{' '}
                  {score.dropOfLifeBonus} drop)
                </div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tab.map((c) => (
                  <DmTraitTile key={c.id} card={c} compact />
                ))}
                {tab.length === 0 && <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>No traits played yet</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Local Hand */}
      {me && (
        <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h4 style={{ margin: 0 }}>
              Your Hand ({myHand.length} · Stabilize to {effectiveGenePool(s, me)})
            </h4>
            {isMyTurn && s.subPhase === 'awaitingAction' && (
              <button className="secondary" onClick={() => dispatch({ type: 'passTurn', playerId: me })}>
                Pass / Stabilize
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {myHand.map((c) => {
              const legal = isMyTurn && s.subPhase === 'awaitingAction' && canPlayTrait(s, me, c);
              return (
                <DmTraitTile
                  key={c.id}
                  card={c}
                  disabled={isMyTurn && s.subPhase === 'awaitingAction' && !legal}
                  onClick={legal ? () => dispatch({ type: 'playTrait', playerId: me, cardId: c.id }) : undefined}
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

function DmPromptView({
  state: s,
  prompt,
  me,
  dispatch,
}: {
  state: DmState;
  prompt: DmPrompt;
  me: PlayerId;
  dispatch: (a: DmAction) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [giveTargetId, setGiveTargetId] = useState<PlayerId | null>(null);
  const myHand = handOf(s, me);

  if (prompt.kind === 'chooseCardsFromHand') {
    const valid =
      prompt.effectTag === 'playExtraTrait' || prompt.effectTag === 'eloquencePlay'
        ? myHand.filter((c) => canPlayTrait(s, me, c))
        : myHand;
    const needed = Math.min(prompt.count, valid.length);
    const opponents = s.seats.filter((st) => st.id !== me);
    const effectiveGiveTarget = giveTargetId ?? opponents[0]?.id;
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(234,179,8,0.15)', border: '2px solid #eab308' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        {prompt.effectTag === 'giveToOpponent' && opponents.length > 1 && (
          <div style={{ marginBottom: 8, fontSize: '0.85rem' }}>
            <span>Give to opponent: </span>
            <select value={effectiveGiveTarget ?? ''} onChange={(e) => setGiveTargetId(e.target.value)}>
              {opponents.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {valid.map((c) => (
            <DmTraitTile
              key={c.id}
              card={c}
              compact
              selected={selectedIds.includes(c.id)}
              onClick={() =>
                setSelectedIds((cur) =>
                  cur.includes(c.id)
                    ? cur.filter((x) => x !== c.id)
                    : cur.length < needed
                      ? [...cur, c.id]
                      : cur,
                )
              }
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            disabled={selectedIds.length !== needed}
            onClick={() => {
              dispatch({
                type: 'resolvePrompt',
                playerId: me,
                cardIds: selectedIds,
                targetPlayerId: prompt.effectTag === 'giveToOpponent' ? effectiveGiveTarget : undefined,
              });
              setSelectedIds([]);
            }}
          >
            Confirm ({selectedIds.length} / {needed})
          </button>
          {prompt.optional && (
            <button
              className="secondary"
              onClick={() => {
                dispatch({ type: 'resolvePrompt', playerId: me, decline: true });
                setSelectedIds([]);
              }}
            >
              Skip
            </button>
          )}
        </div>
      </div>
    );
  }

  if (prompt.kind === 'chooseTraitInPile') {
    const valid = validTraitPileTargets(s, prompt);
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '2px solid #3b82f6' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {valid.map(({ ownerId, card }) => (
            <div key={card.id}>
              <div style={{ fontSize: '0.74rem', opacity: 0.8 }}>{seatName(s, ownerId)}:</div>
              <DmTraitTile
                card={card}
                compact
                onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: card.id })}
              />
            </div>
          ))}
        </div>
        {prompt.optional && (
          <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
            Skip
          </button>
        )}
      </div>
    );
  }

  if (prompt.kind === 'chooseColor') {
    const colors: DmTraitColor[] = ['red', 'blue', 'green', 'purple'];
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(168,85,247,0.15)', border: '2px solid #a855f7' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          {colors.map((col) => (
            <button
              key={col}
              onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, chosenColor: col })}
            >
              {col.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (prompt.kind === 'chooseFromDiscard') {
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 220, overflowY: 'auto' }}>
          {s.traitDiscard.map((c) => (
            <DmTraitTile
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

  return null;
}
