// Casting Shadows — LobbyConfig + GameView + Thumbnail with full expansion support.

import { useState } from 'react';
import { randomSeed } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import {
  areHexesAdjacent,
  CS_ALL_CHARACTERS,
  CS_CHARACTERS,
  getCharactersForExpansions,
  isHexInSpellRange,
  rollFiveResourceDice,
  rollSingleDieForIndex,
} from './cards';
import {
  boardOf,
  canAffordCost,
  canCollectCard,
  combinedPool,
  getShadowAbilityCost,
  isLive,
  livePlayerIds,
  seatName,
} from './reducer';
import type { CsAction, CsConfig, CsExpansionId, CsHexId, CsState } from './types';
import { CS_EXPANSIONS } from './types';

export function Thumbnail() {
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label="Casting Shadows">
      <rect x={0} y={0} width={160} height={100} fill="#141024" />
      {/* Center & outer hexes */}
      <polygon
        points="80,26 98,36 98,58 80,68 62,58 62,36"
        fill="#2e1065"
        stroke="#a855f7"
        strokeWidth={2}
      />
      <polygon
        points="44,18 58,26 58,42 44,50 30,42 30,26"
        fill="#1e3a8a"
        stroke="#38bdf8"
        strokeWidth={1.8}
      />
      <polygon
        points="116,18 130,26 130,42 116,50 102,42 102,26"
        fill="#7f1d1d"
        stroke="#fb923c"
        strokeWidth={1.8}
      />
      <polygon
        points="44,54 58,62 58,78 44,86 30,78 30,62"
        fill="#312e81"
        stroke="#818cf8"
        strokeWidth={1.8}
      />
      <polygon
        points="116,54 130,62 130,78 116,86 102,78 102,62"
        fill="#4c1d95"
        stroke="#c084fc"
        strokeWidth={1.8}
      />
      {/* Shadow crest & elemental gems */}
      <circle cx={80} cy={47} r={11} fill="#0f0720" stroke="#e879f9" strokeWidth={1.8} />
      <path d="M80 39 L85 47 L80 55 L75 47 Z" fill="#facc15" />
      <circle cx={44} cy={34} r={5} fill="#38bdf8" />
      <circle cx={116} cy={34} r={5} fill="#ef4444" />
    </svg>
  );
}

export function LobbyConfig({
  config,
  seats,
  onChange,
}: {
  config: CsConfig;
  seats: Seat[];
  onChange: (c: CsConfig) => void;
}) {
  const availableCharacters = getCharactersForExpansions(config.expansions);

  const toggleExpansion = (expId: CsExpansionId, checked: boolean) => {
    const nextExpansions = checked
      ? [...config.expansions, expId]
      : config.expansions.filter((x) => x !== expId);
    const nextAvail = getCharactersForExpansions(nextExpansions);
    const nextCharMap: Record<PlayerId, string> = {};
    seats.forEach((seat, idx) => {
      const cur = config.characterByPlayer[seat.id];
      nextCharMap[seat.id] =
        cur && nextAvail.some((c) => c.id === cur)
          ? cur
          : nextAvail[idx % nextAvail.length]!.id;
    });
    onChange({
      ...config,
      expansions: nextExpansions,
      characterByPlayer: nextCharMap,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <strong>Expansions (enable at least one for 5–6 players):</strong>
        {CS_EXPANSIONS.map((exp) => {
          const id = exp.id as CsExpansionId;
          const checked = config.expansions.includes(id);
          return (
            <label
              key={exp.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.88rem' }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => toggleExpansion(id, e.target.checked)}
              />
              <span>
                <strong>{exp.name}</strong> — {exp.summary}
              </span>
            </label>
          );
        })}
      </div>

      {seats.map((seat, idx) => {
        const chosen =
          config.characterByPlayer[seat.id] &&
          availableCharacters.some((c) => c.id === config.characterByPlayer[seat.id])
            ? config.characterByPlayer[seat.id]!
            : availableCharacters[idx % availableCharacters.length]!.id;
        return (
          <label key={seat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span>{seat.name}&apos;s Character:</span>
            <select
              value={chosen}
              onChange={(e) => {
                const nextCharMap: Record<PlayerId, string> = {};
                seats.forEach((st, i) => {
                  nextCharMap[st.id] =
                    st.id === seat.id
                      ? e.target.value
                      : config.characterByPlayer[st.id] ??
                        availableCharacters[i % availableCharacters.length]!.id;
                });
                onChange({
                  ...config,
                  characterByPlayer: nextCharMap,
                });
              }}
            >
              {availableCharacters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.lightName} / {c.shadowName}
                  {c.expansion ? ` (${c.expansion === 'ice-storm' ? 'Ice Storm' : 'Molten Rock'})` : ''}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      <p style={{ margin: 0, fontSize: '0.84rem', opacity: 0.8 }}>
        2–6 players (5–6 with Ice Storm or Molten Rock). Hex board, 5 Resource Dice, 4 AP per turn (Travel, Cast,
        Reroll, Protect, Refresh, Collect), Shadow Form transformation, Companions, Counterspells, and Status Effects!
      </p>
    </div>
  );
}

const RES_LABEL: Record<string, { label: string; color: string }> = {
  redGem: { label: '♦ Red Gem', color: '#ef4444' },
  blueGem: { label: '♦ Blue Gem', color: '#3b82f6' },
  purpleGem: { label: '♦ Purple Gem (Wild)', color: '#a855f7' },
  redOrb: { label: '● Red Orb', color: '#f97316' },
  blueOrb: { label: '● Blue Orb', color: '#06b6d4' },
  purpleOrb: { label: '● Purple Orb (Wild)', color: '#c084fc' },
  shadowFragment: { label: '🌑 Shadow Fragment', color: '#64748b' },
  cursedCrystal: { label: '💀 Cursed Crystal', color: '#dc2626' },
};

export function GameView({
  state: s,
  localPlayerId: me,
  dispatch,
}: {
  state: CsState;
  localPlayerId: PlayerId | null;
  dispatch: (action: CsAction) => void;
}) {
  const [rerollSelection, setRerollSelection] = useState<number[]>([]);
  const [castTargetPlayer, setCastTargetPlayer] = useState<PlayerId | null>(null);
  const [castTargetHex, setCastTargetHex] = useState<CsHexId | null>(null);
  const [replaceSpellId, setReplaceSpellId] = useState<number | undefined>(undefined);

  const isMyTurn = me !== null && s.turnPlayerId === me;
  const myBoard = me ? boardOf(s, me) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 10,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(255,255,255,0.05)',
        }}
      >
        <div>
          <strong>Turn:</strong> {seatName(s, s.turnPlayerId)} · <strong>Phase:</strong> {s.subPhase} ·{' '}
          <strong>AP Left:</strong> <span style={{ color: '#facc15', fontWeight: 700 }}>{s.actionPointsRemaining}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: '0.86rem' }}>
          <span>Main Deck: <strong>{s.mainDeck.length}</strong></span>
          <span>Counterspells: <strong>{s.counterspellDeck.length}</strong></span>
        </div>
      </div>

      {/* Game Over */}
      {s.phase === 'gameOver' && (
        <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.2)', border: '2px solid #22c55e' }}>
          <h3 style={{ margin: 0 }}>🏆 {seatName(s, s.winnerId)} is the Ultimate Shadow Caster!</h3>
        </div>
      )}

      {/* Phase 1: Roll Resource Dice */}
      {me && isMyTurn && s.subPhase === 'awaitingRoll' && (
        <div style={{ padding: 14, borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '2px solid #3b82f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><strong>Phase 1 — Resource Roll:</strong> Roll the 5 Resource Dice to start your turn!</span>
          <button
            onClick={() => {
              const rng = { seed: randomSeed() };
              dispatch({ type: 'rollResourceDice', playerId: me, dice: rollFiveResourceDice(rng) });
            }}
          >
            🎲 Roll 5 Resource Dice
          </button>
        </div>
      )}

      {/* Companion Portal Selection */}
      {me && isMyTurn && s.subPhase === 'awaitingCompanionPick' && (
        <div style={{ padding: 14, borderRadius: 8, background: 'rgba(168,85,247,0.15)', border: '2px solid #a855f7' }}>
          <h4 style={{ margin: '0 0 8px' }}>🐾 You transformed into Shadow Form! Summon 1 Companion from the Portal:</h4>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {s.companionPortal.map((c) => (
              <div key={c.id} style={{ border: '1px solid #a855f7', borderRadius: 8, padding: 10, width: 210 }}>
                <strong>{c.name}</strong>
                <div style={{ fontSize: '0.76rem', margin: '4px 0 8px' }}>{c.text}</div>
                <button onClick={() => dispatch({ type: 'pickCompanion', playerId: me, companionId: c.id })}>
                  Summon {c.name}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Counterspell Reaction Prompt */}
      {me && s.subPhase === 'awaitingCounterspell' && s.activePlayerId === me && s.pendingAttack && myBoard && (
        <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444' }}>
          <h4 style={{ margin: '0 0 6px' }}>
            ⚡ Incoming Attack from {seatName(s, s.pendingAttack.attackerId)} ({s.pendingAttack.damage} DMG)! Reveal a Counterspell?
          </h4>
          {myBoard.spellBook.some((c) => c.kind === 'run-away') && (
            <div style={{ marginBottom: 8, fontSize: '0.84rem' }}>
              <span>Escape Hex (for Run Away!): </span>
              <select
                value={
                  castTargetHex && areHexesAdjacent(s.hexes[myBoard.hexId], s.hexes[castTargetHex])
                    ? castTargetHex
                    : (Object.keys(s.hexes) as CsHexId[]).find((hId) =>
                        areHexesAdjacent(s.hexes[myBoard.hexId], s.hexes[hId]),
                      ) ?? myBoard.hexId
                }
                onChange={(e) => setCastTargetHex(e.target.value as CsHexId)}
              >
                {(Object.keys(s.hexes) as CsHexId[])
                  .filter((hId) => areHexesAdjacent(s.hexes[myBoard.hexId], s.hexes[hId]))
                  .map((hId) => (
                    <option key={hId} value={hId}>
                      {s.hexes[hId].name}
                    </option>
                  ))}
              </select>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {myBoard.spellBook
              .filter((c) => c.type === 'counterspell')
              .map((cs) => (
                <button
                  key={cs.id}
                  onClick={() =>
                    dispatch({
                      type: 'respondCounterspell',
                      playerId: me,
                      counterspellId: cs.id,
                      escapeHexId:
                        cs.kind === 'run-away'
                          ? castTargetHex && areHexesAdjacent(s.hexes[myBoard.hexId], s.hexes[castTargetHex])
                            ? castTargetHex
                            : (Object.keys(s.hexes) as CsHexId[]).find((hId) =>
                                areHexesAdjacent(s.hexes[myBoard.hexId], s.hexes[hId]),
                              )
                          : undefined,
                    })
                  }
                >
                  Reveal {cs.name} ({cs.text})
                </button>
              ))}
            <button className="secondary" onClick={() => dispatch({ type: 'respondCounterspell', playerId: me })}>
              Take {s.pendingAttack.damage} DMG
            </button>
          </div>
        </div>
      )}

      {/* Active Player's Resource Pool & Action Bar */}
      {s.subPhase === 'awaitingAction' && (
        <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <strong>{seatName(s, s.turnPlayerId)}&apos;s Resource Pool:</strong>
            </div>
            {me && isMyTurn && myBoard && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  disabled={s.actionPointsRemaining < 1 || rerollSelection.length === 0}
                  onClick={() => {
                    const rng = { seed: randomSeed() };
                    const newValues = rerollSelection.map((i) => rollSingleDieForIndex(rng, i));
                    dispatch({
                      type: 'rerollDice',
                      playerId: me,
                      diceIndices: rerollSelection,
                      newValues,
                    });
                    setRerollSelection([]);
                  }}
                >
                  Reroll Selected Dice ({rerollSelection.length}) (1 AP)
                </button>
                <button
                  disabled={s.actionPointsRemaining < 1 || !combinedPool(s).includes('cursedCrystal')}
                  onClick={() =>
                    dispatch({
                      type: 'protect',
                      playerId: me,
                      clearStatus: 'cursedCrystal',
                      targetHexId: castTargetHex ?? undefined,
                    })
                  }
                >
                  Protect (-1 Cursed Crystal) (1 AP)
                </button>
                {myBoard.burning && (
                  <button
                    disabled={s.actionPointsRemaining < 1}
                    onClick={() =>
                      dispatch({
                        type: 'protect',
                        playerId: me,
                        clearStatus: 'burning',
                        targetHexId: castTargetHex ?? undefined,
                      })
                    }
                  >
                    🔥 Extinguish Burn (1 AP)
                  </button>
                )}
                {myBoard.frozen && (
                  <button
                    disabled={s.actionPointsRemaining < 1}
                    onClick={() => dispatch({ type: 'unfreeze', playerId: me })}
                  >
                    ❄️ Break Ice / Unfreeze (1 AP)
                  </button>
                )}
                <button
                  onClick={() => dispatch({ type: 'transformAndEndTurn', playerId: me, transform: true })}
                >
                  Phase 3: Absorb Shadow &amp; End Turn
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {s.dicePool.map((res, idx) => {
              const meta = RES_LABEL[res] ?? { label: res, color: '#fff' };
              const sel = rerollSelection.includes(idx);
              const canToggle = isMyTurn && res !== 'cursedCrystal';
              return (
                <div
                  key={`die-${idx}`}
                  onClick={
                    canToggle
                      ? () =>
                          setRerollSelection((cur) =>
                            cur.includes(idx) ? cur.filter((x) => x !== idx) : [...cur, idx],
                          )
                      : undefined
                  }
                  style={{
                    border: `2px solid ${sel ? '#facc15' : meta.color}`,
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: '0.8rem',
                    cursor: canToggle ? 'pointer' : 'default',
                    background: sel ? 'rgba(250,204,21,0.2)' : 'rgba(255,255,255,0.04)',
                  }}
                >
                  Die: {meta.label}
                </div>
              );
            })}
            {s.bonusPool.map((res, idx) => {
              const meta = RES_LABEL[res] ?? { label: res, color: '#fff' };
              return (
                <div
                  key={`bonus-${idx}`}
                  style={{
                    border: `1px dashed ${meta.color}`,
                    borderRadius: 6,
                    padding: '4px 8px',
                    fontSize: '0.8rem',
                  }}
                >
                  Token: {meta.label}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hex World Map */}
      <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: 12 }}>
        <h4 style={{ margin: '0 0 8px' }}>🗺️ {Object.keys(s.hexes).length}-Hex World Map</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 10 }}>
          {(Object.values(s.hexes) as CsState['hexes'][CsHexId][]).map((hex) => {
            const occupants = s.seats.filter((st) => isLive(s, st.id) && boardOf(s, st.id).hexId === hex.id);
            const isMyHex = myBoard?.hexId === hex.id;
            const canTravelHere =
              me !== null &&
              isMyTurn &&
              s.subPhase === 'awaitingAction' &&
              s.actionPointsRemaining >= 1 &&
              myBoard !== null &&
              !myBoard.frozen &&
              areHexesAdjacent(s.hexes[myBoard.hexId], hex);
            const canCollectHere =
              me !== null &&
              isMyTurn &&
              s.subPhase === 'awaitingAction' &&
              s.actionPointsRemaining >= 1 &&
              isMyHex &&
              ((hex.faceUpCard !== null && canCollectCard(s, me, hex.faceUpCard)) ||
                (hex.id === 'dusty-desert' && canAffordCost(s, { anyGem: 1, anyOrb: 1 })));

            return (
              <div
                key={hex.id}
                style={{
                  border: `2px solid ${isMyHex ? '#facc15' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: 8,
                  padding: 10,
                  background: isMyHex ? 'rgba(250,204,21,0.06)' : 'rgba(255,255,255,0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{hex.name}</strong>
                  {isMyHex && <span style={{ fontSize: '0.72rem', color: '#facc15' }}>📍 You are here</span>}
                </div>
                <div style={{ fontSize: '0.74rem', opacity: 0.8 }}>{hex.effectText}</div>

                <div style={{ fontSize: '0.78rem' }}>
                  <strong>Casters here:</strong>{' '}
                  {occupants.length > 0 ? occupants.map((o) => o.name).join(', ') : 'None'}
                </div>

                {hex.faceUpCard && (
                  <div style={{ padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.05)', fontSize: '0.76rem' }}>
                    <div>
                      <strong>Card: {hex.faceUpCard.name}</strong> (Lv.{hex.faceUpCard.level} {hex.faceUpCard.type})
                    </div>
                    <div style={{ opacity: 0.85 }}>{hex.faceUpCard.text}</div>
                  </div>
                )}

                {me && isMyTurn && s.subPhase === 'awaitingAction' && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {canTravelHere && (
                      <button onClick={() => dispatch({ type: 'travel', playerId: me, toHexId: hex.id })}>
                        Travel Here (1 AP)
                      </button>
                    )}
                    {isMyHex && hex.hasMainDeckSlot && (
                      <button
                        className="secondary"
                        disabled={s.actionPointsRemaining < 1}
                        onClick={() => dispatch({ type: 'refreshHexCard', playerId: me })}
                      >
                        Refresh Card (1 AP)
                      </button>
                    )}
                    {isMyHex && (hex.faceUpCard || hex.id === 'dusty-desert') && (
                      <button
                        disabled={!canCollectHere}
                        onClick={() =>
                          dispatch({
                            type: 'collectCard',
                            playerId: me,
                            fromCounterspellDeck: hex.id === 'dusty-desert',
                            replaceSpellId,
                          })
                        }
                      >
                        Collect {hex.id === 'dusty-desert' ? 'Counterspell' : hex.faceUpCard?.name} (1 AP)
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Player Boards & Spell Books */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        {s.seats.map((seat) => {
          const b = boardOf(s, seat.id);
          const charDef =
            CS_ALL_CHARACTERS.find((c) => c.id === b.characterId) ?? CS_CHARACTERS[0]!;
          const saCost = getShadowAbilityCost(b);
          const dead = !isLive(s, seat.id);
          const isMe = seat.id === me;
          return (
            <div
              key={seat.id}
              style={{
                border: `2px solid ${s.turnPlayerId === seat.id ? seat.color : 'rgba(255,255,255,0.12)'}`,
                borderRadius: 10,
                padding: 12,
                opacity: dead ? 0.5 : 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <strong>{seat.name}</strong> — {b.form === 'shadow' ? `🌑 ${charDef.shadowName}` : charDef.lightName}
                </div>
                <div>
                  ❤️ <strong>{b.hp}/{b.maxHp}</strong> · 🌑 <strong>{b.shadowEnergy}/{b.form === 'shadow' ? 5 : 3}</strong>
                </div>
              </div>

              {/* Status Effect Badges */}
              {(b.stunned || b.frozen || b.fortified > 0 || b.burning) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.75rem' }}>
                  {b.stunned && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'rgba(250,204,21,0.2)',
                        border: '1px solid #facc15',
                        color: '#fde047',
                      }}
                    >
                      💫 Stunned (-1 AP next turn)
                    </span>
                  )}
                  {b.frozen && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'rgba(56,189,248,0.2)',
                        border: '1px solid #38bdf8',
                        color: '#7dd3fc',
                      }}
                    >
                      ❄️ Frozen (Cannot Travel)
                    </span>
                  )}
                  {b.fortified > 0 && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'rgba(34,197,94,0.2)',
                        border: '1px solid #22c55e',
                        color: '#86efac',
                      }}
                    >
                      🛡️ Fortified (+{b.fortified} Shield)
                    </span>
                  )}
                  {b.burning && (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        background: 'rgba(249,115,22,0.2)',
                        border: '1px solid #f97316',
                        color: '#fdba74',
                      }}
                    >
                      🔥 Burning (1 DMG at end of turn)
                    </span>
                  )}
                </div>
              )}

              {b.companion && (
                <div style={{ fontSize: '0.78rem', color: '#c084fc' }}>
                  🐾 <strong>Companion:</strong> {b.companion.name} — {b.companion.text}
                </div>
              )}

              {isMe && isMyTurn && s.subPhase === 'awaitingAction' && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                  <span>Target Enemy:</span>
                  <select
                    value={castTargetPlayer ?? livePlayerIds(s).find((id) => id !== me) ?? ''}
                    onChange={(e) => setCastTargetPlayer(e.target.value)}
                  >
                    {livePlayerIds(s)
                      .filter((id) => id !== me)
                      .map((id) => (
                        <option key={id} value={id}>
                          {seatName(s, id)} (at {s.hexes[boardOf(s, id).hexId]?.name})
                        </option>
                      ))}
                  </select>
                  <span>Target Hex:</span>
                  <select
                    value={castTargetHex ?? b.hexId}
                    onChange={(e) => setCastTargetHex(e.target.value as CsHexId)}
                  >
                    {(Object.keys(s.hexes) as CsHexId[]).map((hId) => (
                      <option key={hId} value={hId}>
                        {s.hexes[hId].name}
                      </option>
                    ))}
                  </select>
                  {b.form === 'shadow' && !b.usedShadowAbilityThisTurn && b.shadowEnergy >= saCost && (
                    <button
                      onClick={() =>
                        dispatch({
                          type: 'useShadowAbility',
                          playerId: me,
                          targetPlayerId: castTargetPlayer ?? livePlayerIds(s).find((id) => id !== me),
                          targetHexId: castTargetHex ?? undefined,
                        })
                      }
                    >
                      Use Shadow Ability ({saCost} Shadow)
                    </button>
                  )}
                </div>
              )}

              {/* Spell Book */}
              <div>
                <div style={{ fontSize: '0.78rem', opacity: 0.75, marginBottom: 4 }}>
                  Spell Book ({b.spellBook.length} / 5):
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {b.spellBook.map((sp) => {
                    const used = b.usedSpellIdsThisTurn.includes(sp.id);
                    const hiddenCounter = sp.type === 'counterspell' && !isMe;
                    return (
                      <div
                        key={sp.id}
                        style={{
                          padding: 6,
                          borderRadius: 6,
                          background: 'rgba(255,255,255,0.04)',
                          fontSize: '0.78rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div>
                          <strong>{hiddenCounter ? 'Face-down Counterspell' : sp.name}</strong>
                          {!hiddenCounter && <div style={{ opacity: 0.8 }}>{sp.text}</div>}
                        </div>
                        {isMe && isMyTurn && s.subPhase === 'awaitingAction' && (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {(sp.castTiers ?? []).map((tier, tIdx) => {
                              const targetEnemy =
                                castTargetPlayer ?? livePlayerIds(s).find((id) => id !== me) ?? null;
                              const inRange =
                                sp.type === 'conversionSpell' ||
                                (sp.targetsAllOnHex
                                  ? isHexInSpellRange(
                                      s.hexes,
                                      b.hexId,
                                      castTargetHex ?? b.hexId,
                                      sp.range ?? 'sameOrAdjacent',
                                    )
                                  : targetEnemy !== null &&
                                    isHexInSpellRange(
                                      s.hexes,
                                      b.hexId,
                                      boardOf(s, targetEnemy).hexId,
                                      sp.range ?? 'sameOrAdjacent',
                                    ));
                              const canCast =
                                !used &&
                                s.actionPointsRemaining >= 1 &&
                                canAffordCost(s, tier.cost) &&
                                inRange;
                              return (
                                <button
                                  key={tIdx}
                                  disabled={!canCast}
                                  onClick={() =>
                                    dispatch({
                                      type: 'castSpell',
                                      playerId: me,
                                      spellId: sp.id,
                                      tierIndex: tIdx,
                                      targetPlayerId: targetEnemy ?? undefined,
                                      targetHexId: castTargetHex ?? b.hexId,
                                    })
                                  }
                                >
                                  Cast ({tier.label})
                                </button>
                              );
                            })}
                            <button
                              className="secondary"
                              onClick={() => setReplaceSpellId((cur) => (cur === sp.id ? undefined : sp.id))}
                            >
                              {replaceSpellId === sp.id ? 'Selected to Replace' : 'Mark to Upgrade/Replace'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Log */}
      <div style={{ fontSize: '0.82rem', padding: 10, borderRadius: 8, background: 'rgba(0,0,0,0.25)', maxHeight: 130, overflowY: 'auto' }}>
        {s.log.slice(-8).map((entry) => (
          <div key={entry.seq}>{entry.text}</div>
        ))}
      </div>
    </div>
  );
}
