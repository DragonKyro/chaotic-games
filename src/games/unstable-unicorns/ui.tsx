// Unstable Unicorns — LobbyConfig + GameView with full player decision support.

import { useState } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import {
  canPlayCardFromHand,
  canPlayNeigh,
  findCardInStable,
  handLimitOf,
  handOf,
  hasDragonsBlessing,
  hasNannyCam,
  hasPandamonium,
  isBlinded,
  queenBeeOwner,
  seatName,
  stableOf,
  unicornCount,
  validHandCards,
  validPileCards,
  validStableTargets,
} from './reducer';
import { isNeighCard } from './cards';
import type { UuAction, UuCard, UuConfig, UuExpansionId, UuPrompt, UuState } from './types';
import { UU_EXPANSIONS } from './types';

export function Thumbnail() {
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label="Unstable Unicorns">
      <rect x={0} y={0} width={160} height={100} fill="#1b1530" />
      {/* Rainbow arch */}
      <g fill="none" strokeLinecap="round" strokeWidth={5} opacity={0.85}>
        <path d="M16,86 A64,64 0 0,1 144,86" stroke="#ef4444" />
        <path d="M22,86 A58,58 0 0,1 138,86" stroke="#f97316" />
        <path d="M28,86 A52,52 0 0,1 132,86" stroke="#eab308" />
        <path d="M34,86 A46,46 0 0,1 126,86" stroke="#22c55e" />
        <path d="M40,86 A40,40 0 0,1 120,86" stroke="#3b82f6" />
        <path d="M46,86 A34,34 0 0,1 114,86" stroke="#a855f7" />
      </g>
      {/* Fanned cards */}
      <g transform="rotate(-14 48 56)">
        <rect x={26} y={24} width={44} height={60} rx={6} fill="#fef9ef" stroke="#221f33" strokeWidth={2.4} />
        <rect x={30} y={28} width={36} height={34} rx={3} fill="#ef4444" />
        <text x={48} y={50} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">NEIGH!</text>
      </g>
      <g transform="rotate(14 112 56)">
        <rect x={90} y={24} width={44} height={60} rx={6} fill="#fef9ef" stroke="#221f33" strokeWidth={2.4} />
        <rect x={94} y={28} width={36} height={34} rx={3} fill="#22c55e" />
        <path d="M112,34 L115,43 L124,43 L117,48 L119,57 L112,52 L105,57 L107,48 L100,43 L109,43 Z" fill="#fde047" />
      </g>
      {/* Center Unicorn card */}
      <g>
        <rect x={56} y={16} width={48} height={66} rx={6} fill="#ffffff" stroke="#221f33" strokeWidth={2.6} />
        <rect x={60} y={20} width={40} height={42} rx={4} fill="#3b82f6" />
        {/* Unicorn head + golden horn */}
        <path d="M72,56 Q68,40 78,34 Q88,34 90,44 Q94,46 92,52 Q86,56 72,56 Z" fill="#fff" stroke="#221f33" strokeWidth={2} />
        <path d="M80,34 L90,14 L85,36 Z" fill="#facc15" stroke="#221f33" strokeWidth={1.8} />
        <path d="M68,38 Q62,44 66,54" fill="none" stroke="#ec4899" strokeWidth={3.5} strokeLinecap="round" />
        <circle cx={83} cy={42} r={2} fill="#221f33" />
        <rect x={63} y={66} width={34} height={4} rx={2} fill="#cbd5e1" />
        <rect x={68} y={73} width={24} height={4} rx={2} fill="#cbd5e1" />
      </g>
    </svg>
  );
}

// ============================================================================
// Lobby Config
// ============================================================================

export function LobbyConfig({
  config,
  onChange,
}: {
  config: UuConfig;
  seats: Seat[];
  onChange: (c: UuConfig) => void;
}) {
  const toggleExpansion = (id: UuExpansionId) => {
    const exists = config.expansions.includes(id);
    const next = exists ? config.expansions.filter((x) => x !== id) : [...config.expansions, id];
    onChange({ ...config, expansions: next });
  };

  return (
    <div className="uu-lobby" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span><strong>Base Edition</strong></span>
        <select
          value={config.edition}
          onChange={(e) => onChange({ ...config, edition: e.target.value as UuConfig['edition'] })}
        >
          <option value="base-2nd">2nd Edition Base Deck (135 cards — default)</option>
          <option value="base">1st Edition / Original Print (Fertile, Puppicorn, Zombie, Angel, Shrinkray, Lasso)</option>
          <option value="control">Control Collector&apos;s Edition (Chronocorn, Time Shift, Absorb &amp; Reflect)</option>
          <option value="chaos">Chaos Collector&apos;s Edition (Unicorn of Chaos, Hell&apos;s Steedicorn, Redirect)</option>
          <option value="diamond">Diamond Edition (Diamond Unicorns, Crystal Narwhal, Prismatic Shield)</option>
          <option value="travel">Travel Edition (Compact 82-card portable deck)</option>
        </select>
      </label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><strong>Expansions ({config.expansions.length} / {UU_EXPANSIONS.length} enabled)</strong></span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="secondary"
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
              onClick={() =>
                onChange({
                  ...config,
                  expansions: UU_EXPANSIONS.map((e) => e.id as UuExpansionId),
                })
              }
            >
              Select All
            </button>
            <button
              type="button"
              className="secondary"
              style={{ fontSize: '0.75rem', padding: '2px 8px' }}
              onClick={() => onChange({ ...config, expansions: [] })}
            >
              Clear
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 6 }}>
          {UU_EXPANSIONS.map((exp) => {
            const id = exp.id as UuExpansionId;
            const checked = config.expansions.includes(id);
            return (
              <label
                key={exp.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: `1px solid ${checked ? '#a855f7' : 'rgba(255,255,255,0.12)'}`,
                  background: checked ? 'rgba(168, 85, 247, 0.14)' : 'rgba(255,255,255,0.03)',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleExpansion(id)}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <div><strong>{exp.name}</strong></div>
                  <div style={{ fontSize: '0.74rem', opacity: 0.8 }}>{exp.summary}</div>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.8 }}>
        2–8 players. First to 7 Unicorns wins (6 at 6–8 players). Combine any Base Edition with any of the 8 official Expansion packs!
      </p>
    </div>
  );
}

// ============================================================================
// Card Pill / Tile component
// ============================================================================

const TYPE_BADGE: Record<UuCard['type'], { label: string; color: string }> = {
  babyUnicorn: { label: 'Baby Unicorn', color: '#a855f7' },
  basicUnicorn: { label: 'Basic Unicorn', color: '#6366f1' },
  magicalUnicorn: { label: 'Magical Unicorn', color: '#3b82f6' },
  magic: { label: 'Magic', color: '#22c55e' },
  instant: { label: 'Instant', color: '#ef4444' },
  upgrade: { label: 'Upgrade', color: '#f97316' },
  downgrade: { label: 'Downgrade', color: '#eab308' },
};

function UuCardBox({
  card,
  selected,
  disabled,
  onClick,
  compact,
}: {
  card: UuCard;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const badge = TYPE_BADGE[card.type];
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      title={`${card.name} (${badge.label})\n${card.text}`}
      style={{
        border: `2px solid ${selected ? '#facc15' : badge.color}`,
        borderRadius: 8,
        padding: compact ? '6px 8px' : '8px 10px',
        background: selected ? 'rgba(250, 204, 21, 0.15)' : 'rgba(255,255,255,0.04)',
        width: compact ? 150 : 180,
        cursor: onClick && !disabled ? 'pointer' : 'default',
        opacity: disabled ? 0.45 : 1,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        <strong style={{ fontSize: compact ? '0.8rem' : '0.88rem' }}>{card.name}</strong>
        <span
          style={{
            fontSize: '0.68rem',
            padding: '1px 5px',
            borderRadius: 4,
            background: badge.color,
            color: '#fff',
            whiteSpace: 'nowrap',
          }}
        >
          {badge.label}
        </span>
      </div>
      {card.text && (
        <div style={{ fontSize: '0.74rem', opacity: 0.85, lineHeight: 1.25 }}>
          {card.text}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// GameView
// ============================================================================

export function GameView({
  state: s,
  localPlayerId: me,
  dispatch,
}: {
  state: UuState;
  localPlayerId: PlayerId | null;
  dispatch: (action: UuAction) => void;
}) {
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [targetStablePlayerId, setTargetStablePlayerId] = useState<PlayerId | null>(null);

  const myHand = me ? s.hands[me] ?? [] : [];
  const isMyTurn = me !== null && s.turnPlayerId === me;
  const selectedCard = myHand.find((c) => c.id === selectedCardId) ?? null;

  const qbOwner = queenBeeOwner(s);
  const defaultTargetStable =
    selectedCard?.type === 'downgrade'
      ? s.seats.find((st) => st.id !== me)?.id ?? me
      : selectedCard?.type === 'basicUnicorn' && qbOwner
        ? qbOwner
        : me;
  const effectiveTargetStable = targetStablePlayerId ?? defaultTargetStable ?? undefined;

  const canPlaySelected =
    me !== null &&
    isMyTurn &&
    s.subPhase === 'action' &&
    selectedCard !== null &&
    canPlayCardFromHand(s, me, selectedCard, effectiveTargetStable);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top Status Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.05)',
        }}
      >
        <div>
          <strong>Turn:</strong> {seatName(s, s.turnPlayerId)} · <strong>Phase:</strong> {s.subPhase} ·{' '}
          <strong>Goal:</strong> {s.unicornsToWin} Unicorns
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: '0.9rem' }}>
          <span>Deck: <strong>{s.deck.length}</strong></span>
          <span>Discard: <strong>{s.discard.length}</strong></span>
          <span>Nursery: <strong>{s.nursery.length}</strong></span>
        </div>
      </div>

      {/* Game Over Banner */}
      {s.phase === 'gameOver' && (
        <div
          style={{
            padding: 16,
            borderRadius: 8,
            background: 'rgba(34, 197, 94, 0.2)',
            border: '2px solid #22c55e',
          }}
        >
          <h3 style={{ margin: '0 0 6px' }}>🦄 {seatName(s, s.winnerId)} wins Unstable Unicorns!</h3>
        </div>
      )}

      {/* Active Reaction / Prompt Window */}
      {me && s.subPhase === 'awaitingNeigh' && s.activePlayerId === me && (
        <NeighPromptView state={s} me={me} dispatch={dispatch} />
      )}

      {me && s.subPhase === 'awaitingPrompt' && s.activePlayerId === me && s.promptQueue[0] && (
        <PromptResolutionView state={s} prompt={s.promptQueue[0]} me={me} dispatch={dispatch} />
      )}

      {/* Draw / Action Phase Controls */}
      {me && isMyTurn && s.subPhase === 'draw' && (
        <div
          style={{
            padding: 14,
            borderRadius: 8,
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid #3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span><strong>Draw Phase:</strong> Draw 1 card to start your turn.</span>
          <button onClick={() => dispatch({ type: 'drawForTurn', playerId: me })}>
            Draw 1 Card
          </button>
        </div>
      )}

      {/* All Players' Stables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        {s.seats.map((seat) => {
          const st = stableOf(s, seat.id);
          const count = unicornCount(s, seat.id);
          const panda = hasPandamonium(s, seat.id);
          const blinded = isBlinded(s, seat.id);
          const blessed = hasDragonsBlessing(s, seat.id);
          const nanny = hasNannyCam(s, seat.id);
          const oppHand = handOf(s, seat.id);
          return (
            <div
              key={seat.id}
              style={{
                border: `2px solid ${s.turnPlayerId === seat.id ? seat.color : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 10,
                padding: 12,
                background: 'rgba(255,255,255,0.02)',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: seat.color,
                      marginRight: 6,
                    }}
                  />
                  <strong>{seat.name}</strong> {seat.id === me && <em>(You)</em>}
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  Unicorns: <strong>{count} / {s.unicornsToWin}</strong>
                  {panda && <span style={{ marginLeft: 6, color: '#eab308' }}>(🐼 Pandas!)</span>}
                  {blinded && <span style={{ marginLeft: 6, color: '#f97316' }}>(Blinded)</span>}
                  {blessed && <span style={{ marginLeft: 6, color: '#22c55e' }}>(✨ Dragon&apos;s Blessing)</span>}
                  {' · '}Hand: <strong>{oppHand.length} / {handLimitOf(s, seat.id)}</strong>
                </div>
              </div>

              {nanny && seat.id !== me && oppHand.length > 0 && (
                <div style={{ fontSize: '0.78rem', padding: 6, borderRadius: 6, background: 'rgba(234, 179, 8, 0.12)' }}>
                  <strong>🎥 Nanny Cam (Visible Hand):</strong> {oppHand.map((c) => c.name).join(', ')}
                </div>
              )}

              <div>
                <div style={{ fontSize: '0.78rem', opacity: 0.7, marginBottom: 4 }}>
                  Unicorns ({st.unicorns.length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {st.unicorns.map((u) => (
                    <UuCardBox key={u.id} card={u} compact />
                  ))}
                  {st.unicorns.length === 0 && <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>None</span>}
                </div>
              </div>

              {(st.upgrades.length > 0 || st.downgrades.length > 0) && (
                <div>
                  <div style={{ fontSize: '0.78rem', opacity: 0.7, marginBottom: 4 }}>
                    Upgrades ({st.upgrades.length}) &amp; Downgrades ({st.downgrades.length})
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {st.upgrades.map((u) => (
                      <UuCardBox key={u.id} card={u} compact />
                    ))}
                    {st.downgrades.map((d) => (
                      <UuCardBox key={d.id} card={d} compact />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Local Player's Hand & Action Phase Controls */}
      {me && (
        <div
          style={{
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 10,
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h4 style={{ margin: 0 }}>Your Hand ({myHand.length} / {handLimitOf(s, me)} limit)</h4>
            {isMyTurn && s.subPhase === 'action' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.85rem' }}>
                  Plays remaining: <strong>{s.playsRemaining}</strong>
                </span>
                {!s.actedInActionPhase && (
                  <button
                    className="secondary"
                    onClick={() => {
                      dispatch({ type: 'drawInsteadOfPlaying', playerId: me });
                      setSelectedCardId(null);
                    }}
                  >
                    Draw 1 Card Instead of Playing
                  </button>
                )}
                {s.actedInActionPhase && (
                  <button
                    className="secondary"
                    onClick={() => {
                      dispatch({ type: 'endActionPhase', playerId: me });
                      setSelectedCardId(null);
                    }}
                  >
                    End Action Phase
                  </button>
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {myHand.map((c) => (
              <UuCardBox
                key={c.id}
                card={c}
                selected={selectedCardId === c.id}
                onClick={
                  isMyTurn && s.subPhase === 'action'
                    ? () => {
                        setSelectedCardId((cur) => (cur === c.id ? null : c.id));
                        setTargetStablePlayerId(null);
                      }
                    : undefined
                }
              />
            ))}
            {myHand.length === 0 && <span style={{ opacity: 0.6 }}>Your hand is empty.</span>}
          </div>

          {isMyTurn && s.subPhase === 'action' && selectedCard && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
                padding: 10,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              {selectedCard.type !== 'magic' && selectedCard.type !== 'instant' && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.88rem' }}>
                  <span>Play into Stable of:</span>
                  <select
                    value={effectiveTargetStable ?? me}
                    onChange={(e) => setTargetStablePlayerId(e.target.value)}
                  >
                    {s.seats.map((seat) => (
                      <option key={seat.id} value={seat.id}>
                        {seat.name} {seat.id === me ? '(You)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <button
                disabled={!canPlaySelected}
                onClick={() => {
                  if (!canPlaySelected) return;
                  dispatch({
                    type: 'playCard',
                    playerId: me,
                    cardId: selectedCard.id,
                    targetPlayerId: effectiveTargetStable,
                  });
                  setSelectedCardId(null);
                  setTargetStablePlayerId(null);
                }}
              >
                Play {selectedCard.name}
              </button>
              <button className="secondary" onClick={() => setSelectedCardId(null)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Action Log */}
      <div
        style={{
          fontSize: '0.82rem',
          padding: 10,
          borderRadius: 8,
          background: 'rgba(0,0,0,0.25)',
          maxHeight: 140,
          overflowY: 'auto',
        }}
      >
        {s.log.slice(-8).map((entry) => (
          <div key={entry.seq} style={{ opacity: 0.9, marginBottom: 2 }}>
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Neigh Window Component
// ============================================================================

function NeighPromptView({
  state: s,
  me,
  dispatch,
}: {
  state: UuState;
  me: PlayerId;
  dispatch: (a: UuAction) => void;
}) {
  const p = s.pending;
  if (!p) return null;
  const myNeighs = handOf(s, me).filter((c) => isNeighCard(c));
  const cancelled = p.neighCards.length % 2 === 1;

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 8,
        background: 'rgba(239, 68, 68, 0.15)',
        border: '2px solid #ef4444',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <h4 style={{ margin: 0 }}>
        {cancelled ? 'Play is currently Neighed — Counter-Neigh it?' : 'Neigh this card?'}
      </h4>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>
        <strong>{seatName(s, p.byPlayerId)}</strong> played <strong>{p.card.name}</strong> ({p.card.text}).
        {p.neighCards.length > 0 && ` (${p.neighCards.length} Neigh card(s) on the stack)`}
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {canPlayNeigh(s, me) &&
          myNeighs.map((c) => (
            <button key={c.id} onClick={() => dispatch({ type: 'playNeigh', playerId: me, cardId: c.id })}>
              Play {c.name}
            </button>
          ))}
        <button className="secondary" onClick={() => dispatch({ type: 'declineNeigh', playerId: me })}>
          Allow / Pass
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Interactive Prompt Resolution Component
// ============================================================================

function PromptResolutionView({
  state: s,
  prompt,
  me,
  dispatch,
}: {
  state: UuState;
  prompt: UuPrompt;
  me: PlayerId;
  dispatch: (a: UuAction) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [oraclePick, setOraclePick] = useState<number | null>(null);
  const [swapOracleRest, setSwapOracleRest] = useState(false);

  if (prompt.kind === 'beginningTrigger') {
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(249, 115, 22, 0.15)', border: '2px solid #f97316' }}>
        <h4 style={{ margin: '0 0 6px' }}>Beginning of Turn: {prompt.sourceCard.name}</h4>
        <p style={{ margin: '0 0 10px', fontSize: '0.9rem' }}>{prompt.sourceCard.text}</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => dispatch({ type: 'resolvePrompt', playerId: me })}>
            Activate {prompt.sourceCard.name}
          </button>
          {!prompt.mandatory && (
            <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
              Skip / Decline
            </button>
          )}
        </div>
      </div>
    );
  }

  if (prompt.kind === 'chooseCardsFromHand') {
    const valid = validHandCards(s, prompt);
    const needed = Math.min(prompt.count, valid.length);
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(234, 179, 8, 0.15)', border: '2px solid #eab308' }}>
        <h4 style={{ margin: '0 0 6px' }}>{prompt.reason}</h4>
        <p style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
          Select {needed} card(s) ({selectedIds.length} / {needed} selected):
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {valid.map((c) => (
            <UuCardBox
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
              dispatch({ type: 'resolvePrompt', playerId: me, cardIds: selectedIds });
              setSelectedIds([]);
            }}
          >
            Confirm Selection
          </button>
          {prompt.optional && (
            <button
              className="secondary"
              onClick={() => {
                dispatch({ type: 'resolvePrompt', playerId: me, decline: true });
                setSelectedIds([]);
              }}
            >
              Skip / Decline
            </button>
          )}
        </div>
      </div>
    );
  }

  if (prompt.kind === 'chooseStableCard') {
    const valid = validStableTargets(s, prompt);
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', border: '2px solid #3b82f6' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          {valid.map(({ ownerId, card }) => (
            <div key={card.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>{seatName(s, ownerId)}'s Stable:</span>
              <UuCardBox
                card={card}
                compact
                onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: card.id })}
              />
            </div>
          ))}
        </div>
        {prompt.optional && (
          <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
            Skip / Decline
          </button>
        )}
      </div>
    );
  }

  if (prompt.kind === 'choosePlayer') {
    const candidates = s.seats.filter(
      (st) => (prompt.allowSelf ? true : st.id !== me) && st.id !== prompt.movedFromPlayerId,
    );
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(168, 85, 247, 0.15)', border: '2px solid #a855f7' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {candidates.map((st) => (
            <button
              key={st.id}
              onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetPlayerId: st.id })}
            >
              {st.name} (Hand: {handOf(s, st.id).length}, Unicorns: {unicornCount(s, st.id)})
            </button>
          ))}
          {prompt.optional && (
            <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
              Skip / Decline
            </button>
          )}
        </div>
      </div>
    );
  }

  if (prompt.kind === 'chooseFromOpponentHand') {
    const oppHand = handOf(s, prompt.targetPlayerId);
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34, 197, 94, 0.15)', border: '2px solid #22c55e' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {oppHand.map((c) => (
            <UuCardBox
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

  if (prompt.kind === 'chooseFromPile') {
    const valid = validPileCards(s, prompt);
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34, 197, 94, 0.15)', border: '2px solid #22c55e' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxHeight: 260, overflowY: 'auto', marginBottom: 10 }}>
          {valid.map((c) => (
            <UuCardBox
              key={c.id}
              card={c}
              compact
              onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: c.id })}
            />
          ))}
        </div>
        {prompt.optional && (
          <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
            Skip / Decline
          </button>
        )}
      </div>
    );
  }

  if (prompt.kind === 'oraclePeek') {
    const pickedId = oraclePick ?? prompt.cards[0]?.id ?? null;
    const rest = prompt.cards.filter((c) => c.id !== pickedId);
    const orderedRest = swapOracleRest && rest.length === 2 ? [rest[1]!, rest[0]!] : rest;
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(59, 130, 246, 0.15)', border: '2px solid #3b82f6' }}>
        <h4 style={{ margin: '0 0 6px' }}>Unicorn Oracle — Look at top 3 cards</h4>
        <p style={{ margin: '0 0 8px', fontSize: '0.85rem' }}>
          Click a card to choose which 1 to add to your hand, and arrange the remaining {orderedRest.length} for the top of the deck:
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {prompt.cards.map((c) => (
            <UuCardBox
              key={c.id}
              card={c}
              compact
              selected={pickedId === c.id}
              onClick={() => setOraclePick(c.id)}
            />
          ))}
        </div>
        {orderedRest.length === 2 && (
          <div style={{ marginBottom: 10, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>
              Top of deck order: <strong>1st: {orderedRest[0]!.name}</strong>, <strong>2nd: {orderedRest[1]!.name}</strong>
            </span>
            <button className="secondary" onClick={() => setSwapOracleRest((v) => !v)}>
              Swap Top 2 Order
            </button>
          </div>
        )}
        <button
          disabled={pickedId === null}
          onClick={() => {
            if (pickedId === null) return;
            dispatch({
              type: 'resolvePrompt',
              playerId: me,
              oraclePickId: pickedId,
              oracleTopOrder: orderedRest.map((c) => c.id),
            });
            setOraclePick(null);
            setSwapOracleRest(false);
          }}
        >
          Confirm Oracle Choice
        </button>
      </div>
    );
  }

  if (prompt.kind === 'blackKnightSave') {
    const protectorName = findCardInStable(s, me, prompt.blackKnightCardId)?.name ?? 'Black Knight Unicorn';
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239, 68, 68, 0.15)', border: '2px solid #ef4444' }}>
        <h4 style={{ margin: '0 0 6px' }}>{protectorName} — Protect your Unicorn?</h4>
        <p style={{ margin: '0 0 10px', fontSize: '0.9rem' }}>
          One of your Unicorns is about to be destroyed. You may SACRIFICE {protectorName} instead!
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: false })}>
            Sacrifice {protectorName}
          </button>
          <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
            Let Unicorn be Destroyed
          </button>
        </div>
      </div>
    );
  }

  return null;
}
