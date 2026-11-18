// Here to Slay — LobbyConfig + GameView with full player decision support.

import { useState } from 'react';
import { randomSeed, rngInt } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import { HTS_PARTY_LEADERS } from './cards';
import {
  canAttackMonster,
  computeRollTotals,
  handOf,
  heroEffectiveClass,
  partyClasses,
  partyOf,
  seatName,
  trophiesOf,
  validHandCardsForPrompt,
  validHeroTargets,
} from './reducer';
import type { HtsAction, HtsCard, HtsConfig, HtsPrompt, HtsState } from './types';
import { HTS_EXPANSIONS } from './types';

function rollClient2d6(): [number, number] {
  const rng = { seed: randomSeed() };
  return [rngInt(rng, 6) + 1, rngInt(rng, 6) + 1];
}

export function LobbyConfig({
  config,
  onChange,
}: {
  config: HtsConfig;
  seats: Seat[];
  onChange: (c: HtsConfig) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>Monsters to Slay to Win</span>
        <select
          value={config.monstersToWin}
          onChange={(e) => onChange({ ...config, monstersToWin: Number(e.target.value) })}
        >
          <option value={3}>3 Monsters (Standard Rulebook)</option>
          <option value={2}>2 Monsters (Quick Game)</option>
        </select>
      </label>
      <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.8 }}>
        2–6 players. 3 Action Points per turn. Slay {config.monstersToWin} Monsters OR assemble all 6 Hero classes
        (Fighter, Bard, Guardian, Ranger, Thief, Wizard) to win! ({HTS_EXPANSIONS.length} expansions listed for reference.)
      </p>
    </div>
  );
}

const CLASS_COLORS: Record<string, string> = {
  fighter: '#ef4444',
  bard: '#f97316',
  guardian: '#eab308',
  ranger: '#22c55e',
  thief: '#3b82f6',
  wizard: '#a855f7',
};

function HtsCardTile({
  card,
  selected,
  onClick,
  badgeText,
  compact,
}: {
  card: HtsCard;
  selected?: boolean;
  onClick?: () => void;
  badgeText?: string;
  compact?: boolean;
}) {
  const color = (card.class && CLASS_COLORS[card.class]) || '#64748b';
  return (
    <div
      onClick={onClick}
      style={{
        border: `2px solid ${selected ? '#facc15' : color}`,
        borderRadius: 8,
        padding: compact ? '6px 8px' : '8px 10px',
        background: selected ? 'rgba(250,204,21,0.15)' : 'rgba(255,255,255,0.04)',
        width: compact ? 155 : 185,
        cursor: onClick ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        <strong style={{ fontSize: '0.84rem' }}>{card.name}</strong>
        <span
          style={{
            fontSize: '0.68rem',
            padding: '1px 5px',
            borderRadius: 4,
            background: color,
            color: '#fff',
          }}
        >
          {badgeText ?? card.class ?? card.type}
        </span>
      </div>
      {card.abilityThreshold && (
        <div style={{ fontSize: '0.74rem', color: '#facc15' }}>Roll {card.abilityThreshold}+</div>
      )}
      <div style={{ fontSize: '0.73rem', opacity: 0.85, lineHeight: 1.25 }}>{card.text}</div>
    </div>
  );
}

export function GameView({
  state: s,
  localPlayerId: me,
  dispatch,
}: {
  state: HtsState;
  localPlayerId: PlayerId | null;
  dispatch: (action: HtsAction) => void;
}) {
  const [selectedHandId, setSelectedHandId] = useState<number | null>(null);
  const [equipTargetPlayer, setEquipTargetPlayer] = useState<PlayerId | null>(null);
  const [equipTargetHero, setEquipTargetHero] = useState<number | null>(null);
  const [shadowClawTarget, setShadowClawTarget] = useState<PlayerId | null>(null);

  const myHand = me ? handOf(s, me) : [];
  const isMyTurn = me !== null && s.turnPlayerId === me;
  const selectedCard = myHand.find((c) => c.id === selectedHandId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Top Status Bar */}
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
          <strong>Turn:</strong> {seatName(s, s.turnPlayerId)} · <strong>AP Remaining:</strong>{' '}
          <span style={{ color: '#facc15', fontWeight: 700 }}>{s.actionPointsRemaining}</span> ·{' '}
          <strong>Phase:</strong> {s.subPhase}
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: '0.88rem' }}>
          <span>Deck: <strong>{s.deck.length}</strong></span>
          <span>Discard: <strong>{s.discard.length}</strong></span>
          <span>Monsters Left: <strong>{s.monsterDeck.length}</strong></span>
        </div>
      </div>

      {/* Game Over */}
      {s.phase === 'gameOver' && (
        <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.2)', border: '2px solid #22c55e' }}>
          <h3 style={{ margin: 0 }}>🏆 {seatName(s, s.winnerId)} wins Here to Slay!</h3>
        </div>
      )}

      {/* Reaction / Prompt Windows */}
      {me && s.subPhase === 'awaitingChallenge' && s.activePlayerId === me && (
        <ChallengeWindowView state={s} me={me} dispatch={dispatch} />
      )}

      {me && s.subPhase === 'awaitingModifiers' && s.activePlayerId === me && (
        <ModifierWindowView state={s} me={me} dispatch={dispatch} />
      )}

      {me && s.subPhase === 'awaitingPrompt' && s.activePlayerId === me && s.promptQueue[0] && (
        <HtsPromptView state={s} prompt={s.promptQueue[0]} me={me} dispatch={dispatch} />
      )}

      {/* Shared Monster Row */}
      <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: 12 }}>
        <h4 style={{ margin: '0 0 8px' }}>🐉 Active Monsters (2 AP to Attack)</h4>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {s.monsterRow.map((m) => {
            const canAtk =
              me !== null &&
              isMyTurn &&
              s.subPhase === 'awaitingAction' &&
              s.actionPointsRemaining >= 2 &&
              canAttackMonster(s, me, m);
            return (
              <div
                key={m.card.id}
                style={{
                  border: '2px solid #dc2626',
                  borderRadius: 8,
                  padding: 10,
                  width: 240,
                  background: 'rgba(220,38,38,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <strong>{m.card.name}</strong>
                  <span style={{ fontSize: '0.75rem', color: '#facc15' }}>Req: {m.requirementText}</span>
                </div>
                <div style={{ fontSize: '0.76rem' }}>
                  <strong>SLAY:</strong> {m.slayOnLow ? `≤${m.slayThreshold}` : `${m.slayThreshold}+`} ·{' '}
                  <strong>FAIL:</strong> {m.slayOnLow ? `${m.failThreshold}+` : `≤${m.failThreshold}`} (
                  {m.failPenalty === 'sacrificeHero' ? 'Sacrifice Hero' : 'Discard 2'})
                </div>
                <div style={{ fontSize: '0.74rem', opacity: 0.85 }}>{m.card.text}</div>
                {isMyTurn && s.subPhase === 'awaitingAction' && me && (
                  <button
                    disabled={!canAtk}
                    onClick={() =>
                      dispatch({
                        type: 'attackMonster',
                        playerId: me,
                        monsterCardId: m.card.id,
                        dice: rollClient2d6(),
                      })
                    }
                  >
                    Attack (2 AP)
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Players' Parties & Leaders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        {s.seats.map((seat) => {
          const leader = s.partyLeaders[seat.id];
          const party = partyOf(s, seat.id);
          const trophies = trophiesOf(s, seat.id);
          const classes = Array.from(partyClasses(s, seat.id));
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
                <div style={{ fontSize: '0.8rem' }}>
                  Classes: <strong>{classes.length}/6</strong> · Monsters: <strong>{trophies.length}/{s.config.monstersToWin}</strong> · Hand: <strong>{handOf(s, seat.id).length}</strong>
                </div>
              </div>

              {leader && (
                <div style={{ fontSize: '0.78rem', padding: 6, borderRadius: 6, background: 'rgba(255,255,255,0.05)' }}>
                  <div>
                    <strong>Party Leader:</strong> {leader.name} ({leader.class}) — {leader.text}
                  </div>
                  {seat.id === me && isMyTurn && s.subPhase === 'awaitingAction' && (
                    <div style={{ marginTop: 4, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select
                        value={leader.kind}
                        onChange={(e) =>
                          dispatch({ type: 'choosePartyLeader', playerId: me, leaderKind: e.target.value })
                        }
                        style={{ fontSize: '0.75rem' }}
                      >
                        {HTS_PARTY_LEADERS.map((l) => (
                          <option key={l.kind} value={l.kind}>
                            {l.name} ({l.class})
                          </option>
                        ))}
                      </select>
                      {leader.kind === 'leader-shadow-claw' && !s.turnBuffs.shadowClawUsed && s.actionPointsRemaining >= 1 && (
                        <>
                          <select
                            value={shadowClawTarget ?? ''}
                            onChange={(e) => setShadowClawTarget(e.target.value)}
                            style={{ fontSize: '0.75rem' }}
                          >
                            <option value="">Target player…</option>
                            {s.seats
                              .filter((st) => st.id !== me && handOf(s, st.id).length > 0)
                              .map((st) => (
                                <option key={st.id} value={st.id}>
                                  {st.name}
                                </option>
                              ))}
                          </select>
                          <button
                            disabled={!shadowClawTarget}
                            onClick={() => {
                              if (!shadowClawTarget) return;
                              dispatch({ type: 'shadowClawPull', playerId: me, targetPlayerId: shadowClawTarget });
                            }}
                          >
                            Shadow Claw Pull (1 AP)
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {party.map((h) => {
                  const effClass = heroEffectiveClass(h);
                  const canRoll =
                    seat.id === me &&
                    isMyTurn &&
                    s.subPhase === 'awaitingAction' &&
                    s.actionPointsRemaining >= 1 &&
                    !h.usedThisTurn &&
                    h.equippedItem?.kind !== 'sealing-key';
                  return (
                    <div key={h.card.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <HtsCardTile
                        card={h.card}
                        compact
                        badgeText={`${effClass ?? ''}${h.equippedItem ? ` + ${h.equippedItem.name}` : ''}`}
                      />
                      {seat.id === me && isMyTurn && s.subPhase === 'awaitingAction' && (
                        <button
                          disabled={!canRoll}
                          onClick={() =>
                            dispatch({
                              type: 'useHeroAbility',
                              playerId: me,
                              heroCardId: h.card.id,
                              dice: rollClient2d6(),
                            })
                          }
                        >
                          {h.usedThisTurn ? 'Used This Turn' : `Roll Ability (1 AP)`}
                        </button>
                      )}
                    </div>
                  );
                })}
                {party.length === 0 && <span style={{ fontSize: '0.8rem', opacity: 0.5 }}>No Heroes in Party yet</span>}
              </div>

              {trophies.length > 0 && (
                <div style={{ fontSize: '0.76rem', color: '#22c55e' }}>
                  <strong>Slain Monsters:</strong> {trophies.map((t) => t.card.name).join(', ')}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Local Hand & Turn Actions */}
      {me && (
        <div style={{ border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <h4 style={{ margin: 0 }}>Your Hand ({myHand.length})</h4>
            {isMyTurn && s.subPhase === 'awaitingAction' && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  disabled={s.actionPointsRemaining < 1}
                  onClick={() => dispatch({ type: 'drawCard', playerId: me })}
                >
                  Draw 1 Card (1 AP)
                </button>
                <button
                  className="secondary"
                  disabled={s.actionPointsRemaining < 3}
                  onClick={() => dispatch({ type: 'discardAndRedraw', playerId: me })}
                >
                  Discard All &amp; Draw 5 (3 AP)
                </button>
                <button className="secondary" onClick={() => dispatch({ type: 'endTurn', playerId: me })}>
                  End Turn
                </button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {myHand.map((c) => (
              <HtsCardTile
                key={c.id}
                card={c}
                selected={selectedHandId === c.id}
                onClick={
                  isMyTurn && s.subPhase === 'awaitingAction'
                    ? () => setSelectedHandId((cur) => (cur === c.id ? null : c.id))
                    : undefined
                }
              />
            ))}
          </div>

          {isMyTurn && s.subPhase === 'awaitingAction' && selectedCard && s.actionPointsRemaining >= 1 && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: 10, borderRadius: 8, background: 'rgba(255,255,255,0.05)' }}>
              {selectedCard.type === 'hero' && (
                <button
                  onClick={() => {
                    dispatch({ type: 'playHero', playerId: me, cardId: selectedCard.id });
                    setSelectedHandId(null);
                  }}
                >
                  Play Hero {selectedCard.name} (1 AP)
                </button>
              )}
              {selectedCard.type === 'magic' && (
                <button
                  onClick={() => {
                    dispatch({ type: 'playMagic', playerId: me, cardId: selectedCard.id });
                    setSelectedHandId(null);
                  }}
                >
                  Play Magic {selectedCard.name} (1 AP)
                </button>
              )}
              {(selectedCard.type === 'item' || selectedCard.type === 'cursedItem') && (
                <>
                  <select
                    value={equipTargetPlayer ?? me}
                    onChange={(e) => {
                      setEquipTargetPlayer(e.target.value);
                      setEquipTargetHero(null);
                    }}
                  >
                    {s.seats.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}&apos;s Party
                      </option>
                    ))}
                  </select>
                  <select
                    value={equipTargetHero ?? ''}
                    onChange={(e) => setEquipTargetHero(Number(e.target.value))}
                  >
                    <option value="">Choose Hero…</option>
                    {partyOf(s, equipTargetPlayer ?? me)
                      .filter((h) => !h.equippedItem)
                      .map((h) => (
                        <option key={h.card.id} value={h.card.id}>
                          {h.card.name}
                        </option>
                      ))}
                  </select>
                  <button
                    disabled={!equipTargetHero}
                    onClick={() => {
                      if (!equipTargetHero) return;
                      dispatch({
                        type: 'equipItem',
                        playerId: me,
                        cardId: selectedCard.id,
                        targetPlayerId: equipTargetPlayer ?? me,
                        heroCardId: equipTargetHero,
                      });
                      setSelectedHandId(null);
                      setEquipTargetHero(null);
                    }}
                  >
                    Equip {selectedCard.name} (1 AP)
                  </button>
                </>
              )}
            </div>
          )}
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

// ============================================================================
// Challenge & Modifier Windows
// ============================================================================

function ChallengeWindowView({
  state: s,
  me,
  dispatch,
}: {
  state: HtsState;
  me: PlayerId;
  dispatch: (a: HtsAction) => void;
}) {
  const p = s.pendingPlay;
  if (!p) return null;
  const challenges = handOf(s, me).filter((c) => c.type === 'challenge');
  return (
    <div style={{ padding: 14, borderRadius: 8, background: 'rgba(239,68,68,0.15)', border: '2px solid #ef4444' }}>
      <h4 style={{ margin: '0 0 6px' }}>Challenge {seatName(s, p.byPlayerId)}&apos;s {p.card.name}?</h4>
      <p style={{ margin: '0 0 10px', fontSize: '0.88rem' }}>{p.card.text}</p>
      <div style={{ display: 'flex', gap: 8 }}>
        {challenges.slice(0, 1).map((c) => (
          <button
            key={c.id}
            onClick={() =>
              dispatch({
                type: 'playChallenge',
                playerId: me,
                cardId: c.id,
                actorDice: rollClient2d6(),
                challengerDice: rollClient2d6(),
              })
            }
          >
            Play Challenge! (Roll 2d6 Duel)
          </button>
        ))}
        <button className="secondary" onClick={() => dispatch({ type: 'declineChallenge', playerId: me })}>
          Pass
        </button>
      </div>
    </div>
  );
}

function ModifierWindowView({
  state: s,
  me,
  dispatch,
}: {
  state: HtsState;
  me: PlayerId;
  dispatch: (a: HtsAction) => void;
}) {
  const r = s.pendingRoll;
  const [hornDelta, setHornDelta] = useState<1 | -1>(1);
  const [targetSide, setTargetSide] = useState<'actor' | 'challenger'>('actor');
  if (!r) return null;

  const { actorTotal, challengerTotal } = computeRollTotals(s, r);
  const mods = handOf(s, me).filter((c) => c.type === 'modifier');
  const isProtectingHorn = s.partyLeaders[me]?.kind === 'leader-protecting-horn';

  return (
    <div style={{ padding: 14, borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '2px solid #3b82f6' }}>
      <h4 style={{ margin: '0 0 6px' }}>
        Roll Window — {seatName(s, r.byPlayerId)} rolled {r.dice[0]} + {r.dice[1]} (Current Total: {actorTotal}
        {r.reason !== 'challengeDuel' ? `, Needs ${r.threshold}+` : ` vs Challenger ${seatName(s, r.challengerId)}: ${challengerTotal}`})
      </h4>

      {r.reason === 'challengeDuel' && (
        <div style={{ marginBottom: 8, fontSize: '0.85rem' }}>
          <span>Apply modifier to: </span>
          <select value={targetSide} onChange={(e) => setTargetSide(e.target.value as 'actor' | 'challenger')}>
            <option value="actor">{seatName(s, r.byPlayerId)} (Card Player)</option>
            <option value="challenger">{seatName(s, r.challengerId)} (Challenger)</option>
          </select>
        </div>
      )}

      {isProtectingHorn && (
        <div style={{ marginBottom: 8, fontSize: '0.85rem' }}>
          <span>The Protecting Horn bonus: </span>
          <select value={hornDelta} onChange={(e) => setHornDelta(Number(e.target.value) as 1 | -1)}>
            <option value={1}>Extra +1</option>
            <option value={-1}>Extra -1</option>
          </select>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {mods.map((m) =>
          (m.modifierChoices ?? []).map((val) => (
            <button
              key={`${m.id}-${val}`}
              onClick={() =>
                dispatch({
                  type: 'playModifier',
                  playerId: me,
                  cardId: m.id,
                  chosenValue: val,
                  protectingHornDelta: isProtectingHorn ? hornDelta : undefined,
                  targetSide,
                })
              }
            >
              {m.name}: Apply {val >= 0 ? `+${val}` : val}
            </button>
          )),
        )}
        <button className="secondary" onClick={() => dispatch({ type: 'declineModifier', playerId: me })}>
          Pass
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Interactive Prompt View
// ============================================================================

function HtsPromptView({
  state: s,
  prompt,
  me,
  dispatch,
}: {
  state: HtsState;
  prompt: HtsPrompt;
  me: PlayerId;
  dispatch: (a: HtsAction) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bullseyePick, setBullseyePick] = useState<number | null>(null);
  const [swapBullseyeRest, setSwapBullseyeRest] = useState(false);

  if (prompt.kind === 'rollEnteredHero') {
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e' }}>
        <h4 style={{ margin: '0 0 6px' }}>{prompt.heroCard.name} entered your Party!</h4>
        <p style={{ margin: '0 0 10px', fontSize: '0.88rem' }}>
          Roll {prompt.heroCard.abilityThreshold}+ for free now: {prompt.heroCard.text}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, dice: rollClient2d6() })}>
            Roll 2d6 Now (Free)
          </button>
          <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
            Skip Roll
          </button>
        </div>
      </div>
    );
  }

  if (prompt.kind === 'chooseHeroTarget') {
    const valid = validHeroTargets(s, prompt);
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(249,115,22,0.15)', border: '2px solid #f97316' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {valid.map(({ ownerId, hero }) => (
            <div key={hero.card.id}>
              <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>{seatName(s, ownerId)}&apos;s Party:</div>
              <HtsCardTile
                card={hero.card}
                compact
                onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetCardId: hero.card.id })}
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

  if (prompt.kind === 'chooseCardsFromHand') {
    const valid = validHandCardsForPrompt(s, prompt);
    const maxCount = Math.min(prompt.count, valid.length);
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(234,179,8,0.15)', border: '2px solid #eab308' }}>
        <h4 style={{ margin: '0 0 6px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          {valid.map((c) => (
            <HtsCardTile
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
            disabled={prompt.upTo ? selectedIds.length < 1 : selectedIds.length !== maxCount}
            onClick={() => {
              dispatch({ type: 'resolvePrompt', playerId: me, cardIds: selectedIds });
              setSelectedIds([]);
            }}
          >
            Confirm ({selectedIds.length})
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

  if (prompt.kind === 'choosePlayer') {
    const others = s.seats.filter((st) => st.id !== me);
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(168,85,247,0.15)', border: '2px solid #a855f7' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {others.map((st) => (
            <button
              key={st.id}
              onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, targetPlayerId: st.id })}
            >
              {st.name} (Hand: {handOf(s, st.id).length}, Party: {partyOf(s, st.id).length})
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (prompt.kind === 'chooseFromPile') {
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e' }}>
        <h4 style={{ margin: '0 0 8px' }}>{prompt.reason}</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {prompt.cards.map((c) => (
            <HtsCardTile
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

  if (prompt.kind === 'bullseyePeek') {
    const pickedId = bullseyePick ?? prompt.cards[0]?.id ?? null;
    const rest = prompt.cards.filter((c) => c.id !== pickedId);
    const orderedRest = swapBullseyeRest && rest.length === 2 ? [rest[1]!, rest[0]!] : rest;
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '2px solid #3b82f6' }}>
        <h4 style={{ margin: '0 0 6px' }}>Bullseye — Choose 1 card for your hand &amp; order the other 2</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {prompt.cards.map((c) => (
            <HtsCardTile
              key={c.id}
              card={c}
              compact
              selected={pickedId === c.id}
              onClick={() => setBullseyePick(c.id)}
            />
          ))}
        </div>
        {orderedRest.length === 2 && (
          <div style={{ marginBottom: 8, fontSize: '0.85rem', display: 'flex', gap: 8, alignItems: 'center' }}>
            <span>Top of deck: 1st {orderedRest[0]!.name}, 2nd {orderedRest[1]!.name}</span>
            <button className="secondary" onClick={() => setSwapBullseyeRest((v) => !v)}>
              Swap Order
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
              bullseyePickId: pickedId,
              bullseyeTopOrder: orderedRest.map((c) => c.id),
            });
          }}
        >
          Confirm Bullseye Choice
        </button>
      </div>
    );
  }

  if (prompt.kind === 'peekHandAck') {
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(59,130,246,0.15)', border: '2px solid #3b82f6' }}>
        <h4 style={{ margin: '0 0 8px' }}>Sharp Fox — {seatName(s, prompt.targetPlayerId)}&apos;s Hand:</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {prompt.cards.map((c) => (
            <HtsCardTile key={c.id} card={c} compact />
          ))}
        </div>
        <button onClick={() => dispatch({ type: 'resolvePrompt', playerId: me })}>Got it</button>
      </div>
    );
  }

  if (prompt.kind === 'corruptedSabretoothChoice') {
    return (
      <div style={{ padding: 14, borderRadius: 8, background: 'rgba(34,197,94,0.15)', border: '2px solid #22c55e' }}>
        <h4 style={{ margin: '0 0 6px' }}>Corrupted Sabretooth — STEAL instead of DESTROY?</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: false })}>
            Steal Hero into Your Party
          </button>
          <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>
            Destroy Hero Normally
          </button>
        </div>
      </div>
    );
  }

  return null;
}
