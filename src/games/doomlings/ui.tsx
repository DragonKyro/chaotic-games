// Doomlings — Thumbnail + LobbyConfig + GameView with full player decision support for Base Game & all 7 Expansions.

import { useState } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import {
  canPlayTrait,
  computePlayerScore,
  effectiveGenePool,
  handOf,
  isCardIndestructible,
  isObjectiveFulfilled,
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

export function DmThumbnail() {
  return (
    <svg viewBox="0 0 240 150" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="dm-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="55%" stopColor="#311042" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="dm-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="240" height="150" rx="14" fill="url(#dm-sky)" />
      {/* Distanthills */}
      <path d="M0 125 Q60 95 125 120 T240 112 L240 150 L0 150 Z" fill="#064e3b" opacity="0.7" />
      {/* Falling Catastrophe Comet */}
      <path d="M165 14 L212 46 L198 54 Z" fill="#f97316" opacity="0.85" />
      <circle cx="165" cy="18" r="11" fill="#ef4444" />
      <circle cx="163" cy="16" r="5" fill="#fde047" />
      {/* Four Trait Color Orbs */}
      <circle cx="38" cy="36" r="8" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
      <circle cx="60" cy="26" r="8" fill="#3b82f6" stroke="#fff" strokeWidth="1.5" />
      <circle cx="82" cy="36" r="8" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
      <circle cx="104" cy="26" r="8" fill="#a855f7" stroke="#fff" strokeWidth="1.5" />
      {/* Cute Doomling Creature */}
      <ellipse cx="120" cy="100" rx="34" ry="30" fill="url(#dm-body)" stroke="#ecfdf5" strokeWidth="2" />
      {/* Horns / Crown */}
      <path d="M98 76 L90 58 L108 71 Z" fill="#facc15" />
      <path d="M142 76 L150 58 L132 71 Z" fill="#facc15" />
      {/* Big Eyes */}
      <circle cx="108" cy="94" r="7" fill="#fff" />
      <circle cx="132" cy="94" r="7" fill="#fff" />
      <circle cx="109" cy="94" r="3.5" fill="#0f172a" />
      <circle cx="133" cy="94" r="3.5" fill="#0f172a" />
      {/* Smile */}
      <path d="M110 110 Q120 118 130 110" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function LobbyConfig({
  config,
  onChange,
}: {
  config: DmConfig;
  seats: Seat[];
  onChange: (c: DmConfig) => void;
}) {
  const selected = new Set(config.expansions ?? []);

  const toggleExpansion = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onChange({ ...config, expansions: Array.from(next) });
  };

  const selectAll = () => {
    onChange({ ...config, expansions: DM_EXPANSIONS.map((e) => e.id) });
  };

  const clearAll = () => {
    onChange({ ...config, expansions: [] });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p style={{ margin: 0, fontSize: '0.86rem', opacity: 0.85 }}>
        2–6 players. 3 Eras of 3 Ages + 1 Catastrophe each (13-card Age Deck starting with The Birth of Life). Play
        Traits, grow your Gene Pool, trigger Actions, and score Drop of Life &amp; World&apos;s End bonuses when the 3rd
        Catastrophe strikes!
      </p>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <strong style={{ fontSize: '0.85rem' }}>
          Expansions ({selected.size} / {DM_EXPANSIONS.length} enabled):
        </strong>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="secondary"
            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            onClick={selectAll}
          >
            Select All
          </button>
          <button
            type="button"
            className="secondary"
            style={{ fontSize: '0.75rem', padding: '3px 8px' }}
            onClick={clearAll}
          >
            Clear All
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        {DM_EXPANSIONS.map((exp) => {
          const isChecked = selected.has(exp.id);
          return (
            <label
              key={exp.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${isChecked ? '#22c55e' : 'rgba(255,255,255,0.15)'}`,
                background: isChecked ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.03)',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggleExpansion(exp.id)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 700 }}>{exp.name}</div>
                <div style={{ fontSize: '0.73rem', opacity: 0.8 }}>{exp.summary}</div>
              </div>
            </label>
          );
        })}
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
  hostName,
  isProtected,
  selected,
  disabled,
  onClick,
  compact,
}: {
  card: DmTraitCard;
  hostName?: string;
  isProtected?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const color = COLOR_HEX[card.color];
  const secColor = card.secondaryColor ? COLOR_HEX[card.secondaryColor] : null;
  const effectiveIndestructible = Boolean(isProtected ?? card.indestructible);

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      style={{
        border: `2px solid ${selected ? '#facc15' : card.dominant ? '#f59e0b' : color}`,
        borderRightColor: !selected && !card.dominant && secColor ? secColor : undefined,
        borderBottomColor: !selected && !card.dominant && secColor ? secColor : undefined,
        borderRadius: 8,
        padding: compact ? '6px 8px' : '8px 10px',
        background: selected
          ? 'rgba(250,204,21,0.16)'
          : card.dominant
            ? 'rgba(245,158,11,0.12)'
            : 'rgba(255,255,255,0.04)',
        width: compact ? 160 : 190,
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
          {card.isAttachment ? '📎 ' : ''}
          {effectiveIndestructible ? '🛡️ ' : ''}
          {card.isSwarm ? '🐝 ' : ''}
          {card.name}
        </strong>
        <span
          style={{
            fontSize: '0.72rem',
            padding: '1px 6px',
            borderRadius: 4,
            background: secColor ? `linear-gradient(135deg, ${color} 50%, ${secColor} 50%)` : color,
            color: '#fff',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          {card.points} pt
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', fontSize: '0.66rem', opacity: 0.85 }}>
        <span style={{ textTransform: 'uppercase', fontWeight: 600 }}>
          {card.secondaryColor ? `${card.color} / ${card.secondaryColor}` : card.color}
        </span>
        {hostName && (
          <span style={{ color: '#38bdf8', fontWeight: 600 }}>
            → Attached to {hostName}
          </span>
        )}
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
          Discard: <strong>{s.traitDiscard.length}</strong> · Turn: <strong>{seatName(s, s.turnPlayerId)}</strong>
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
          const suppressed = s.suppressedCount[seat.id] ?? 0;
          const obj = s.objectives[seat.id];
          const objFulfilled = obj ? isObjectiveFulfilled(s, seat.id, obj) : false;

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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                <div>
                  <strong>{seat.name}</strong> {seat.id === me && <em>(You)</em>}
                </div>
                <div style={{ fontSize: '0.82rem' }}>
                  Gene Pool: <strong>{gp}</strong> · Hand: <strong>{handOf(s, seat.id).length}</strong>
                  {suppressed > 0 && (
                    <>
                      {' '}
                      · Suppressed: <strong>{suppressed}</strong>
                    </>
                  )}{' '}
                  · Score: <strong style={{ color: '#facc15' }}>{score.total}</strong> ({score.faceValue} face +{' '}
                  {score.dropOfLifeBonus} drop
                  {score.worldsEndBonus !== 0 ? ` + ${score.worldsEndBonus} end` : ''})
                </div>
              </div>

              {obj && (
                <div
                  style={{
                    fontSize: '0.76rem',
                    padding: '5px 8px',
                    borderRadius: 6,
                    background: objFulfilled ? 'rgba(34,197,94,0.16)' : 'rgba(234,179,8,0.1)',
                    border: `1px solid ${objFulfilled ? '#22c55e' : 'rgba(234,179,8,0.4)'}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div>
                    <strong>{obj.kind === 'treasure' ? '🏆 Treasure' : '✨ Meaning of Life'}: {obj.name}</strong> —{' '}
                    {obj.text}
                  </div>
                  <span style={{ fontWeight: 700, whiteSpace: 'nowrap', color: objFulfilled ? '#4ade80' : '#facc15' }}>
                    {objFulfilled ? `✅ +${obj.points} pts` : `⏳ +${obj.points} pts`}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {tab.map((c) => {
                  const host = c.attachedToId !== undefined ? tab.find((h) => h.id === c.attachedToId) : undefined;
                  return (
                    <DmTraitTile
                      key={c.id}
                      card={c}
                      hostName={host?.name}
                      isProtected={isCardIndestructible(tab, c)}
                      compact
                    />
                  );
                })}
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
    const maxCount = Math.min(prompt.count, valid.length);
    const allowPartial = prompt.optional && prompt.effectTag === 'suppress';
    const canConfirm = allowPartial
      ? selectedIds.length >= 1 && selectedIds.length <= maxCount
      : selectedIds.length === maxCount;
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
                    : cur.length < maxCount
                      ? [...cur, c.id]
                      : cur,
                )
              }
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            disabled={!canConfirm}
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
            Confirm ({selectedIds.length} / {maxCount})
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
    const candidates =
      prompt.mode === 'playDirectly'
        ? s.traitDiscard.filter((c) => !c.dominant && canPlayTrait(s, me, c))
        : s.traitDiscard;
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxHeight: 220, overflowY: 'auto' }}>
          {candidates.map((c) => (
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
