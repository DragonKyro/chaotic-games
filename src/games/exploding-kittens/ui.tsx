// Exploding Kittens — lobby config + in-game view.
//
// Hidden-information rule: this component renders a hand only for
// `localPlayerId`. In hot-seat the shell swaps that to whichever seat is active
// (behind its pass-the-device gate), so nobody sees anyone else's cards.
// `state.deck` is NEVER rendered except through `knownTopCards`, which is the
// knowledge that seat has legitimately earned.

import { useEffect, useMemo, useState } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import { Card, FaceDownCard } from './Card';
import {
  CARD_LABEL,
  detectCombo,
  isDefuseKind,
  isPlayableAction,
  maxPlayersForExpansions,
  needsTargetForKind,
} from './cards';
import {
  availableCombos,
  canHoldWithStreaking,
  drawDanger,
  findCloneTargetKind,
  isLive,
  kittensInDeck,
  knownTopCards,
} from './reducer';
import type {
  EkAction,
  EkBaseCardKind,
  EkCard,
  EkConfig,
  EkExpansionId,
  EkState,
} from './types';
import { EK_EXPANSIONS } from './types';

// ============================================================================
// Lobby
// ============================================================================

export function LobbyConfig({ config, seats, onChange }: {
  config: EkConfig;
  seats: unknown;
  onChange: (c: EkConfig) => void;
}) {
  const seatCount = Array.isArray(seats) ? (seats as Seat[]).length : undefined;
  const maxAllowed = maxPlayersForExpansions(config.expansions);

  function toggleExpansion(id: EkExpansionId) {
    const has = config.expansions.includes(id);
    const nextExpansions = has
      ? config.expansions.filter((x) => x !== id)
      : [...config.expansions, id];
    onChange({
      ...config,
      expansions: nextExpansions,
      ...(seatCount !== undefined ? { playerCount: seatCount } : {}),
    });
  }

  return (
    <div className="ek-lobby">
      <label className="ek-field">
        <span>Opening hand</span>
        <select
          value={config.handSize}
          onChange={(e) => onChange({ ...config, handSize: Number(e.target.value) })}
        >
          <option value={4}>4 cards + 1 Defuse (rulebook)</option>
          <option value={7}>7 cards + 1 Defuse (newer printings)</option>
        </select>
      </label>

      <label className="ek-check">
        <input
          type="checkbox"
          checked={config.combosCatsOnly}
          onChange={(e) => onChange({ ...config, combosCatsOnly: e.target.checked })}
        />
        <span>
          Combos from cat cards only
          <small>
            Off (default) means any matching cards can form a combo — two Skips is a
            legal pair. Turn this on if your group plays cats-only.
          </small>
        </span>
      </label>

      <div className="ek-expansion-note">
        <strong>Expansions (Max players: {maxAllowed})</strong>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          {EK_EXPANSIONS.map((exp) => {
            const id = exp.id as EkExpansionId;
            const checked = config.expansions.includes(id);
            return (
              <label key={exp.id} className="ek-check">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleExpansion(id)}
                />
                <span>
                  {exp.name}
                  <small>{exp.summary}</small>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Game view
// ============================================================================

interface ViewProps {
  state: EkState;
  localPlayerId: PlayerId | null;
  dispatch: (action: EkAction) => void;
}

export function GameView({ state: s, localPlayerId: me, dispatch }: ViewProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [target, setTarget] = useState<PlayerId | null>(null);
  const [demand, setDemand] = useState<EkBaseCardKind>('defuse');
  const [reviveTarget, setReviveTarget] = useState<PlayerId | null>(null);

  const myHand: EkCard[] = (me && s.hands[me]) || [];
  const isMyTurn = me != null && s.activePlayerId === me;
  const isCursed = me != null && (s.cursedPlayers?.includes(me) ?? false);
  const opponents = s.seats.filter((seat) => seat.id !== me);

  function clearSelection() {
    setSelected([]);
    setTarget(null);
  }

  function send(action: EkAction) {
    dispatch(action);
    clearSelection();
  }

  function toggleCard(id: number) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  // ---- what does the current selection amount to? ---------------------------
  const selectedCards = useMemo(
    () => selected.map((id) => myHand.find((c) => c.id === id)).filter((c): c is EkCard => !!c),
    [selected, myHand],
  );
  const combo = selectedCards.length > 1 ? detectCombo(selectedCards, s.config.combosCatsOnly) : null;
  const single = selectedCards.length === 1 ? selectedCards[0] : null;
  const clonedKind = single?.kind === 'clone' ? findCloneTargetKind(s) : null;
  const effectiveSingleKind = single ? (single.kind === 'clone' ? clonedKind : single.kind) : null;
  const singleIsPlayable = !!single && (
    isCursed
    || (single.kind === 'clone' ? clonedKind !== null : isPlayableAction(single.kind))
  );
  const isOutOfTurnNow = single?.kind === 'alterTheFutureNow';
  const needsTarget = !isCursed && (
    combo === 'pair'
    || combo === 'triple'
    || (effectiveSingleKind !== null && needsTargetForKind(effectiveSingleKind))
  );
  const liveOpponents = opponents.filter((o) => isLive(s, o.id));
  const canPlay = me != null
    && s.subPhase === 'awaitingAction'
    && (isMyTurn || isOutOfTurnNow)
    && (singleIsPlayable || combo !== null)
    && (!needsTarget || (target !== null && liveOpponents.some((o) => o.id === target)));

  const playLabel = isCursed && single ? 'Play blind card'
    : combo === 'pair' ? 'Play pair — steal at random'
    : combo === 'triple' ? `Play three of a kind — demand ${CARD_LABEL[demand]}`
    : combo === 'fiveDifferent' ? 'Play five different — raid the discard'
    : single ? `Play ${CARD_LABEL[single.kind]}${clonedKind ? ` (${CARD_LABEL[clonedKind]})` : ''}`
    : 'Select cards';

  function doPlay() {
    if (!me || !canPlay) return;
    send({
      type: 'playCards',
      playerId: me,
      cardIds: selected,
      ...(needsTarget && target ? { targetPlayerId: target } : {}),
      ...(combo === 'triple' ? { demandKind: demand } : {}),
    });
  }

  const known = me ? knownTopCards(s, me) : [];
  const danger = me && isLive(s, me) ? drawDanger(s, me) : 0;
  const hints = me && !isCursed ? availableCombos(s, me) : [];
  const activeEliminatedTarget = reviveTarget && s.eliminated.includes(reviveTarget)
    ? reviveTarget
    : (s.eliminated[0] ?? null);

  return (
    <div className="ek-root">
      {/* ---------------- table ---------------- */}
      <div className="ek-table">
        <div className="ek-opponents">
          {opponents.map((o) => {
            const dead = !isLive(s, o.id);
            const theirTurn = s.turnPlayerId === o.id;
            const owesResponse = s.activePlayerId === o.id;
            const peeking = (s.knownTopCount[o.id] ?? 0) > 0;
            const oppHand = s.hands[o.id] ?? [];
            const markedInHand = oppHand.filter((c) => s.markedCardIds?.includes(c.id));
            const stashCount = s.towerStash?.[o.id]?.length ?? 0;
            const oppCursed = s.cursedPlayers?.includes(o.id) ?? false;
            const takeFrom = s.illTakeThat?.[o.id];
            return (
              <div
                key={o.id}
                className={`ek-opponent${dead ? ' is-dead' : ''}${theirTurn ? ' is-turn' : ''}`}
              >
                <div className="ek-opponent-head">
                  <span className="ek-dot" style={{ background: o.color }} />
                  <strong>{o.name}</strong>
                  {dead && <span className="ek-tag ek-tag-dead">exploded</span>}
                  {!dead && owesResponse && <span className="ek-tag">deciding…</span>}
                  {!dead && oppCursed && <span className="ek-tag ek-tag-warn">🙈 cursed</span>}
                  {!dead && stashCount > 0 && <span className="ek-tag">👑 stash {stashCount}</span>}
                  {!dead && takeFrom && (
                    <span className="ek-tag ek-tag-warn">
                      next draw → {s.seats.find((x) => x.id === takeFrom)?.name}
                    </span>
                  )}
                </div>
                <div className="ek-opponent-cards">
                  {dead ? <span className="ek-muted">—</span> : (
                    <>
                      <span className="ek-handcount">{oppHand.length} cards</span>
                      {peeking && (
                        <span className="ek-tag ek-tag-warn" title="They played See the Future and still remember it">
                          👁 knows {s.knownTopCount[o.id]}
                        </span>
                      )}
                      {markedInHand.map((mc) => (
                        <span key={mc.id} className="ek-tag ek-tag-dead" title="Marked card">
                          🎯 {CARD_LABEL[mc.kind]}
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="ek-center">
          <div className="ek-pile">
            {s.implodingFaceUp && s.deck[0]?.kind === 'implodingKitten' ? (
              <Card kind="implodingKitten" size="md" />
            ) : (
              <FaceDownCard size="md" />
            )}
            <div className="ek-pile-meta">
              <strong>{s.deck.length}</strong> in deck
              <span className="ek-muted">
                {kittensInDeck(s)} kitten{kittensInDeck(s) === 1 ? '' : 's'} left
                {s.turnDirection === -1 ? ' • ↺ CCW' : ''}
              </span>
            </div>
          </div>

          <div className="ek-pile">
            {s.discard.length > 0 ? (
              <Card kind={s.discard[s.discard.length - 1]!.kind} size="md" />
            ) : (
              <div className="ek-card ek-card-md is-empty"><span>discard</span></div>
            )}
            <div className="ek-pile-meta">
              <strong>{s.discard.length}</strong> discarded
            </div>
          </div>
        </div>

        <div className="ek-log">
          {s.log.slice(-9).map((entry) => (
            <div key={entry.seq} className={`ek-log-line ek-log-${entry.tone}`}>
              {entry.text}
            </div>
          ))}
        </div>
      </div>

      {/* ---------------- prompts ---------------- */}
      {s.phase === 'gameOver' && <GameOverBanner state={s} />}

      {me && s.subPhase === 'awaitingNope' && s.activePlayerId === me && (
        <NopePrompt state={s} me={me} onSend={send} />
      )}

      {me && s.subPhase === 'awaitingDefuse' && s.activePlayerId === me && (
        <div className="ek-prompt is-danger">
          <h4>
            {s.pendingKitten?.kind === 'barkingKitten'
              ? '💥 You were hit by a Barking Kitten!'
              : '💥 You drew an Exploding Kitten!'}
          </h4>
          <p>Play a Defuse (or keep it with Streaking Kitten) or you are out.</p>
          {s.eliminated.length > 0 && myHand.some((c) => c.kind === 'zombieKitten') && (
            <div className="ek-picker" style={{ marginBottom: 8 }}>
              <span>Zombie Kitten resurrects:</span>
              {s.eliminated.map((deadId) => (
                <button
                  key={deadId}
                  className={`secondary tiny${activeEliminatedTarget === deadId ? ' is-on' : ''}`}
                  onClick={() => setReviveTarget(deadId)}
                >
                  {s.seats.find((x) => x.id === deadId)?.name ?? deadId}
                </button>
              ))}
            </div>
          )}
          <div className="ek-prompt-row">
            {myHand.filter((c) => isDefuseKind(c.kind)).map((c) => (
              <Card
                key={c.id}
                kind={c.kind}
                onClick={() => send({
                  type: 'playDefuse',
                  playerId: me,
                  cardId: c.id,
                  ...(c.kind === 'zombieKitten' && activeEliminatedTarget
                    ? { targetPlayerId: activeEliminatedTarget }
                    : {}),
                })}
              />
            ))}
            {s.pendingKitten?.kind === 'explodingKitten' && canHoldWithStreaking(s, me) && (
              <button onClick={() => send({ type: 'keepKitten', playerId: me })}>
                🐾 Keep in hand (Streaking Kitten)
              </button>
            )}
          </div>
        </div>
      )}

      {me && s.subPhase === 'awaitingKittenPlace' && s.activePlayerId === me && (
        <KittenPlacePrompt state={s} me={me} onSend={send} />
      )}

      {me && s.subPhase === 'awaitingBuryPlace' && s.activePlayerId === me && (
        <BuryPlacePrompt state={s} me={me} onSend={send} />
      )}

      {me && s.subPhase === 'awaitingFavorGive' && s.activePlayerId === me && (
        <div className="ek-prompt">
          <h4>Pay up</h4>
          <p>
            {s.seats.find((x) => x.id === s.pendingFavor?.toPlayerId)?.name} demanded a
            favour. Choose a card to hand over — your choice, so make it a bad one.
          </p>
          <div className="ek-prompt-row">
            {myHand.map((c) => (
              isCursed ? (
                <FaceDownCard
                  key={c.id}
                  onClick={() => send({ type: 'giveCard', playerId: me, cardId: c.id })}
                />
              ) : (
                <Card
                  key={c.id}
                  kind={c.kind}
                  onClick={() => send({ type: 'giveCard', playerId: me, cardId: c.id })}
                />
              )
            ))}
          </div>
        </div>
      )}

      {me && s.subPhase === 'awaitingGarbagePick' && s.activePlayerId === me && (
        <div className="ek-prompt">
          <h4>🗑️ Garbage Collection</h4>
          <p>Choose 1 card from your hand to shuffle back into the draw pile.</p>
          <div className="ek-prompt-row">
            {myHand.map((c) => (
              <Card
                key={c.id}
                kind={c.kind}
                onClick={() => send({ type: 'garbagePick', playerId: me, cardId: c.id })}
              />
            ))}
          </div>
        </div>
      )}

      {me && s.subPhase === 'awaitingPotluckPick' && s.activePlayerId === me && (
        <div className="ek-prompt">
          <h4>🍲 Potluck</h4>
          <p>Choose 1 card from your hand to place face-down on top of the deck.</p>
          <div className="ek-prompt-row">
            {myHand.map((c) => (
              <Card
                key={c.id}
                kind={c.kind}
                onClick={() => send({ type: 'potluckPick', playerId: me, cardId: c.id })}
              />
            ))}
          </div>
        </div>
      )}

      {me && s.subPhase === 'awaitingDigDeeper' && s.activePlayerId === me && s.pendingDigDeeper && (
        <div className="ek-prompt">
          <h4>⛏️ Dig Deeper</h4>
          <p>Choose 1 card to take into your hand; the other goes back on top of the deck.</p>
          <div className="ek-prompt-row">
            {s.pendingDigDeeper.cards.map((c, i) => (
              <Card
                key={c.id}
                kind={c.kind}
                footnote={i === 0 ? 'top' : '2nd'}
                onClick={() => send({ type: 'pickDigDeeper', playerId: me, cardId: c.id })}
              />
            ))}
          </div>
        </div>
      )}

      {me && s.subPhase === 'awaitingDiscardPick' && s.activePlayerId === me && (
        <div className="ek-prompt">
          <h4>Raid the discard pile</h4>
          <p>Take any one card.</p>
          <div className="ek-prompt-row ek-scroll">
            {s.discard.map((c) => (
              <Card key={c.id} kind={c.kind} size="sm" onClick={() => send({ type: 'takeFromDiscard', playerId: me, cardId: c.id })} />
            ))}
          </div>
        </div>
      )}

      {me && s.subPhase === 'awaitingFutureView' && s.peek?.playerId === me && (
        <FutureViewPrompt state={s} me={me} onSend={send} />
      )}

      {/* ---------------- my hand ---------------- */}
      {me && isLive(s, me) ? (
        <div className="ek-hand-area">
          <div className="ek-hand-head">
            <h4>
              Your hand ({myHand.length})
              {isCursed && ' — 🙈 Cursed (blind until you draw)'}
              {(s.towerStash?.[me]?.length ?? 0) > 0 && ` • 👑 Stash (${s.towerStash![me]!.length})`}
            </h4>
            {known.length > 0 && (
              <div className="ek-known">
                <span>You know what's coming:</span>
                {known.map((c, i) => (
                  <span
                    key={c.id}
                    className={`ek-known-chip${
                      c.kind === 'explodingKitten' || (c.kind === 'implodingKitten' && s.implodingFaceUp) ? ' is-bad' : ''
                    }`}
                  >
                    {i + 1}. {CARD_LABEL[c.kind]}
                  </span>
                ))}
              </div>
            )}
            {isMyTurn && s.subPhase === 'awaitingAction' && (
              <div className="ek-danger-meter" title="Chance the next card is a kitten">
                Draw risk: <strong className={danger >= 0.4 ? 'is-bad' : ''}>{Math.round(danger * 100)}%</strong>
              </div>
            )}
          </div>

          <div className="ek-hand">
            {myHand.map((c) => {
              const canSelect = s.subPhase === 'awaitingAction' && (isMyTurn || c.kind === 'alterTheFutureNow');
              if (isCursed) {
                return (
                  <FaceDownCard
                    key={c.id}
                    selected={selected.includes(c.id)}
                    onClick={canSelect ? () => toggleCard(c.id) : undefined}
                    disabled={!canSelect}
                  />
                );
              }
              return (
                <Card
                  key={c.id}
                  kind={c.kind}
                  selected={selected.includes(c.id)}
                  footnote={s.markedCardIds?.includes(c.id) ? '🎯 marked' : undefined}
                  onClick={canSelect ? () => toggleCard(c.id) : undefined}
                  disabled={!canSelect}
                />
              );
            })}
            {myHand.length === 0 && <p className="ek-muted">Empty. Bold strategy.</p>}
          </div>

          {(isMyTurn || isOutOfTurnNow) && s.subPhase === 'awaitingAction' && (
            <div className="ek-actions">
              {isMyTurn && s.turnsRemaining > 1 && (
                <div className="ek-owed">You owe {s.turnsRemaining} turns.</div>
              )}

              {selectedCards.length > 0 && (
                <div className="ek-play-builder">
                  {needsTarget && (
                    <div className="ek-picker">
                      <span>Target:</span>
                      {liveOpponents.map((o) => (
                        <button
                          key={o.id}
                          className={`secondary tiny${target === o.id ? ' is-on' : ''}`}
                          onClick={() => setTarget(o.id)}
                        >
                          {o.name} ({s.hands[o.id]?.length ?? 0})
                        </button>
                      ))}
                    </div>
                  )}
                  {combo === 'triple' && (
                    <div className="ek-picker">
                      <span>Demand:</span>
                      <select value={demand} onChange={(e) => setDemand(e.target.value as EkBaseCardKind)}>
                        {(Object.keys(CARD_LABEL) as EkBaseCardKind[])
                          .filter((k) => k !== 'explodingKitten' && k !== 'implodingKitten')
                          .map((k) => <option key={k} value={k}>{CARD_LABEL[k]}</option>)}
                      </select>
                    </div>
                  )}
                  {!singleIsPlayable && !combo && (
                    <p className="ek-hint-bad">
                      {selectedCards.length === 1
                        ? `${CARD_LABEL[selectedCards[0]!.kind]} can't be played on its own.`
                        : 'Those cards don\'t form a combo.'}
                    </p>
                  )}
                  <div className="ek-play-row">
                    <button onClick={doPlay} disabled={!canPlay}>{playLabel}</button>
                    <button className="secondary" onClick={clearSelection}>Clear</button>
                  </div>
                </div>
              )}

              {isMyTurn && selectedCards.length === 0 && hints.length > 0 && (
                <p className="ek-hint">
                  Combos available: {hints.map((h) => h.kind === 'fiveDifferent' ? 'five different' : h.kind).join(', ')}.
                </p>
              )}

              {isMyTurn && (
                <button className="ek-draw" onClick={() => send({ type: 'drawCard', playerId: me })}>
                  🐾 Draw &amp; end turn
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="ek-hand-area">
          <p className="ek-muted">
            {me && !isLive(s, me)
              ? 'You exploded. Enjoy the show.'
              : 'Spectating — no hand to show.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Prompt sub-views
// ============================================================================

function FutureViewPrompt({ state: s, me, onSend }: {
  state: EkState;
  me: PlayerId;
  onSend: (a: EkAction) => void;
}) {
  const peek = s.peek;
  const [ordered, setOrdered] = useState<EkCard[]>(() => peek?.cards ?? []);

  useEffect(() => {
    setOrdered(peek?.cards ?? []);
  }, [peek]);

  if (!peek) return null;

  function moveCard(idx: number, dir: -1 | 1) {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= ordered.length) return;
    const next = [...ordered];
    const tmp = next[idx]!;
    next[idx] = next[targetIdx]!;
    next[targetIdx] = tmp;
    setOrdered(next);
  }

  return (
    <div className="ek-prompt">
      <h4>
        {peek.canReorder
          ? `Rearrange the next ${peek.cards.length} cards`
          : `The next ${peek.cards.length} cards`}
      </h4>
      <p>
        Top of the deck first.{' '}
        {peek.shareWithNext
          ? 'The next player will also see the order you choose!'
          : 'Only you can see this.'}
      </p>
      <div className="ek-prompt-row">
        {ordered.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Card kind={c.kind} footnote={i === 0 ? 'next' : `+${i}`} />
            {peek.canReorder && ordered.length > 1 && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="secondary tiny"
                  disabled={i === 0}
                  onClick={() => moveCard(i, -1)}
                >
                  ←
                </button>
                <button
                  type="button"
                  className="secondary tiny"
                  disabled={i === ordered.length - 1}
                  onClick={() => moveCard(i, 1)}
                >
                  →
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="ek-play-row">
        {peek.canReorder ? (
          <button
            onClick={() => onSend({
              type: 'reorderFuture',
              playerId: me,
              orderedCardIds: ordered.map((c) => c.id),
            })}
          >
            Confirm Order
          </button>
        ) : (
          <button onClick={() => onSend({ type: 'ackPeek', playerId: me })}>Got it</button>
        )}
      </div>
    </div>
  );
}

function NopePrompt({ state: s, me, onSend }: {
  state: EkState;
  me: PlayerId;
  onSend: (a: EkAction) => void;
}) {
  const p = s.pending;
  if (!p) return null;
  const by = s.seats.find((x) => x.id === p.byPlayerId)?.name ?? 'Someone';
  const nopes = p.nopeCards.length;
  const live = nopes % 2 === 0;
  const myNopes = (s.hands[me] ?? []).filter((c) => c.kind === 'nope');

  return (
    <div className="ek-prompt is-nope">
      <h4>{live ? 'Let it happen?' : 'It has been Noped — un-Nope it?'}</h4>
      <p>
        {by} played{' '}
        <strong>
          {p.combo === 'pair' ? 'a pair'
            : p.combo === 'triple' ? `a three of a kind (demanding ${p.demandKind ? CARD_LABEL[p.demandKind] : '?'})`
            : p.combo === 'fiveDifferent' ? 'five different cards'
            : CARD_LABEL[p.cards[0]!.kind]}
        </strong>
        {p.targetPlayerId && <> on <strong>{s.seats.find((x) => x.id === p.targetPlayerId)?.name}</strong></>}
        .{nopes > 0 && ` ${nopes} Nope${nopes === 1 ? '' : 's'} on the stack.`}
      </p>
      <div className="ek-prompt-row">
        {myNopes.slice(0, 1).map((c) => (
          <Card key={c.id} kind={c.kind} onClick={() => onSend({ type: 'playNope', playerId: me, cardId: c.id })} />
        ))}
        <button className="secondary" onClick={() => onSend({ type: 'declineNope', playerId: me })}>
          Allow it
        </button>
      </div>
    </div>
  );
}

function KittenPlacePrompt({ state: s, me, onSend }: {
  state: EkState;
  me: PlayerId;
  onSend: (a: EkAction) => void;
}) {
  const max = s.deck.length;
  const [index, setIndex] = useState(0);
  const weDrawNext = s.turnsRemaining > 1;
  const isImploding = s.pendingKitten?.kind === 'implodingKitten';

  const quick: { label: string; value: number }[] = [
    { label: 'Top', value: 0 },
    { label: '2nd', value: Math.min(1, max) },
    { label: '3rd', value: Math.min(2, max) },
    { label: 'Middle', value: Math.floor(max / 2) },
    { label: 'Bottom', value: max },
  ];

  return (
    <div className="ek-prompt is-good">
      <h4>{isImploding ? '🌀 Place the Face-Up Imploding Kitten' : 'Hide the kitten'}</h4>
      <p>
        Slip it back anywhere in the {max}-card deck.{' '}
        {isImploding
          ? 'It goes back FACE-UP — whoever draws it next explodes immediately!'
          : 'Nobody sees where it goes.'}
        {weDrawNext && (
          <strong> Careful — you still owe {s.turnsRemaining} turns, so you draw next.</strong>
        )}
      </p>
      <div className="ek-picker">
        {quick.map((q) => (
          <button
            key={q.label}
            className={`secondary tiny${index === q.value ? ' is-on' : ''}`}
            onClick={() => setIndex(q.value)}
          >
            {q.label}
          </button>
        ))}
      </div>
      <div className="ek-slider">
        <input
          type="range"
          min={0}
          max={max}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
        />
        <span>
          {index === 0 ? 'on top' : index >= max ? 'at the bottom' : `${index} card${index === 1 ? '' : 's'} down`}
        </span>
      </div>
      <button onClick={() => onSend({ type: 'placeKitten', playerId: me, index })}>
        Bury it
      </button>
    </div>
  );
}

function BuryPlacePrompt({ state: s, me, onSend }: {
  state: EkState;
  me: PlayerId;
  onSend: (a: EkAction) => void;
}) {
  const max = s.deck.length;
  const [index, setIndex] = useState(0);
  const card = s.pendingBury;
  if (!card) return null;

  return (
    <div className="ek-prompt">
      <h4>⛏️ Bury the drawn card</h4>
      <p>You drew {CARD_LABEL[card.kind]}. Choose where to insert it back into the {max}-card deck.</p>
      <div className="ek-prompt-row">
        <Card kind={card.kind} />
      </div>
      <div className="ek-slider">
        <input
          type="range"
          min={0}
          max={max}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
        />
        <span>
          {index === 0 ? 'on top' : index >= max ? 'at the bottom' : `${index} card${index === 1 ? '' : 's'} down`}
        </span>
      </div>
      <button onClick={() => onSend({ type: 'placeBury', playerId: me, index })}>
        Bury card
      </button>
    </div>
  );
}

function GameOverBanner({ state: s }: { state: EkState }) {
  const winner = s.seats.find((seat) => !s.eliminated.includes(seat.id));
  return (
    <div className="ek-prompt is-good">
      <h4>🏆 {winner?.name ?? 'Nobody'} survives</h4>
      <p>
        Knocked out, in order: {s.eliminated.map((id) => s.seats.find((x) => x.id === id)?.name).join(' → ') || '—'}
      </p>
    </div>
  );
}
