// Exploding Kittens — lobby config + in-game view, on the shared table kit.
//
// Hidden-information rule: this component renders a hand only for
// `localPlayerId`. In hot-seat the shell swaps that to whichever seat is active
// (behind its pass-the-device gate), so nobody sees anyone else's cards.
// `state.deck` is NEVER rendered except through `knownTopCards`, which is the
// knowledge that seat has legitimately earned (and the face-up Imploding
// Kitten, which is public).

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import { isLive } from '@/core/state';
import {
  CardFan, Chip, Dock, ExpansionPicker, FxLayer, GameLog, GameOverPanel, GameTable, Panel, PlayerPlate,
  PlayerStrip, TurnCue, useChangeKey, useFx, usePulse,
} from '@/ui/kit';
import { Card, FaceDownCard } from './Card';
import { CardArt } from './CardArt';
import {
  CARD_LABEL, detectCombo, isDefuseKind, isPlayableAction, maxPlayersForExpansions, needsTargetForKind,
} from './cards';
import { availableCombos, canHoldWithStreaking, drawDanger, findCloneTargetKind, kittensInDeck, knownTopCards } from './reducer';
import type { EkAction, EkBaseCardKind, EkCard, EkConfig, EkExpansionId, EkPendingPlay, EkState } from './types';
import { EK_EXPANSIONS } from './types';

// ============================================================================
// Lobby
// ============================================================================

export function LobbyConfig({ config, onChange, readOnly }: {
  config: EkConfig;
  seats?: Seat[];
  onChange: (c: EkConfig) => void;
  readOnly?: boolean;
}) {
  const toggle = (id: string) => {
    const has = config.expansions.includes(id as EkExpansionId);
    onChange({
      ...config,
      expansions: has ? config.expansions.filter((x) => x !== id) : [...config.expansions, id as EkExpansionId],
    });
  };
  return (
    <div className="game-config">
      <label className="field">
        <span>Opening hand</span>
        <select value={config.handSize} onChange={(e) => onChange({ ...config, handSize: Number(e.target.value) })}>
          <option value={4}>4 cards + 1 Defuse (rulebook)</option>
          <option value={7}>7 cards + 1 Defuse (newer printings)</option>
        </select>
      </label>
      <label>
        <input type="checkbox" checked={config.combosCatsOnly} onChange={(e) => onChange({ ...config, combosCatsOnly: e.target.checked })} />
        <span>
          Combos from cat cards only
          <span className="lobby-hint" style={{ display: 'block', margin: 0 }}>
            Off (default): any matching cards form a combo — two Skips is a legal pair.
          </span>
        </span>
      </label>
      <ExpansionPicker
        title={`Expansions · up to ${maxPlayersForExpansions(config.expansions)} players`}
        expansions={EK_EXPANSIONS}
        enabled={config.expansions}
        onToggle={toggle}
        readOnly={readOnly}
      />
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

const ATTACKS: readonly EkBaseCardKind[] = ['attack', 'targetedAttack', 'personalAttack'];
const SHUFFLES: readonly EkBaseCardKind[] = ['shuffle'];

/** What clicking a card in your hand does right now. */
type HandMode = 'play' | 'give' | 'garbage' | 'potluck' | 'idle';

const seatOf = (s: EkState, id: PlayerId | null | undefined) => (id ? s.seats.find((x) => x.id === id) ?? null : null);
const nameOf = (s: EkState, id: PlayerId | null | undefined) => seatOf(s, id)?.name ?? 'Someone';

function describePlay(s: EkState, p: EkPendingPlay): string {
  const what = p.combo === 'pair' ? 'a pair'
    : p.combo === 'triple' ? `three of a kind (demanding ${p.demandKind ? CARD_LABEL[p.demandKind] : '?'})`
    : p.combo === 'fiveDifferent' ? 'five different cards'
    : CARD_LABEL[p.cards[0]!.kind];
  return p.targetPlayerId ? `${what} on ${nameOf(s, p.targetPlayerId)}` : what;
}

export function GameView({ state: s, localPlayerId: me, dispatch }: ViewProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [target, setTarget] = useState<PlayerId | null>(null);
  const [demand, setDemand] = useState<EkBaseCardKind>('defuse');
  const [reviveTarget, setReviveTarget] = useState<PlayerId | null>(null);
  const fx = useFx();
  const [shaking, shake] = usePulse(560);

  const alive = me != null && isLive(s, me);
  const myHand: EkCard[] = (me && s.hands[me]) || [];
  const isMyTurn = me != null && s.activePlayerId === me;
  const isCursed = me != null && (s.cursedPlayers?.includes(me) ?? false);
  const opponents = s.seats.filter((seat) => seat.id !== me);
  const liveOpponents = opponents.filter((o) => isLive(s, o.id));

  function clearSelection() {
    setSelected([]);
    setTarget(null);
  }
  function send(action: EkAction) {
    dispatch(action);
    clearSelection();
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
  const singleIsPlayable = !!single && (isCursed || (single.kind === 'clone' ? clonedKind !== null : isPlayableAction(single.kind)));
  const isOutOfTurnNow = single?.kind === 'alterTheFutureNow';
  const needsTarget = !isCursed && (combo === 'pair' || combo === 'triple' || (effectiveSingleKind !== null && needsTargetForKind(effectiveSingleKind)));
  const targetOk = !needsTarget || (target !== null && liveOpponents.some((o) => o.id === target));
  const canPlay = me != null && s.subPhase === 'awaitingAction' && (isMyTurn || isOutOfTurnNow) && (singleIsPlayable || combo !== null) && targetOk;

  const playLabel = isCursed && single ? 'Play blind card'
    : combo === 'pair' ? 'Play pair — steal at random'
    : combo === 'triple' ? `Play three of a kind — demand ${CARD_LABEL[demand]}`
    : combo === 'fiveDifferent' ? 'Play five different — raid the discard'
    : single ? `Play ${CARD_LABEL[single.kind]}${clonedKind ? ` (as ${CARD_LABEL[clonedKind]})` : ''}`
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
  const danger = alive ? drawDanger(s, me!) : 0;
  const hints = me && !isCursed ? availableCombos(s, me) : [];
  const kittensLeft = kittensInDeck(s);

  const handMode: HandMode = !alive ? 'idle'
    : isMyTurn && s.subPhase === 'awaitingFavorGive' ? 'give'
    : isMyTurn && s.subPhase === 'awaitingGarbagePick' ? 'garbage'
    : isMyTurn && s.subPhase === 'awaitingPotluckPick' ? 'potluck'
    : s.subPhase === 'awaitingAction' ? 'play'
    : 'idle';

  function onHandCard(c: EkCard): (() => void) | undefined {
    if (!me) return undefined;
    if (handMode === 'give') return () => send({ type: 'giveCard', playerId: me, cardId: c.id });
    if (handMode === 'garbage') return () => send({ type: 'garbagePick', playerId: me, cardId: c.id });
    if (handMode === 'potluck') return () => send({ type: 'potluckPick', playerId: me, cardId: c.id });
    if (handMode === 'play' && (isMyTurn || c.kind === 'alterTheFutureNow')) {
      return () => setSelected((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : [...cur, c.id]));
    }
    return undefined;
  }

  // ---- table FX, from state transitions (never from log text) ----------------
  const prev = useRef(s);
  useEffect(() => {
    const was = prev.current;
    prev.current = s;
    if (was === s) return;
    if (s.eliminated.length > was.eliminated.length) {
      fx.stamp('KABOOM!', 'danger');
      fx.burst([0.5, 0.42], '#ff4d4d');
      shake();
    }
    if ((s.pending?.nopeCards.length ?? 0) > (was.pending?.nopeCards.length ?? 0)) fx.stamp('NOPE!', 'danger');
    if (was.subPhase === 'awaitingDefuse' && s.subPhase !== 'awaitingDefuse' && s.eliminated.length === was.eliminated.length) {
      fx.stamp('DEFUSED!', 'good');
    }
    const top = s.discard[s.discard.length - 1];
    if (top && top.id !== was.discard[was.discard.length - 1]?.id && !s.pending) {
      if (ATTACKS.includes(top.kind)) fx.stamp('ATTACK!', 'accent');
      else if (top.kind === 'skip' || top.kind === 'superSkip') fx.toast(`${nameOf(s, was.turnPlayerId)} skipped.`);
    }
    // Keyed on the state alone: fx and shake only schedule animations.
  }, [s]);

  const topDiscard = s.discard[s.discard.length - 1];
  const shuffleKey = useChangeKey(topDiscard && SHUFFLES.includes(topDiscard.kind) && !s.pending ? topDiscard.id : null);
  const drawKey = useChangeKey(s.deck.length);

  // ---- opponents ---------------------------------------------------------------
  const top = (
    <PlayerStrip>
      {opponents.map((o) => {
        const dead = !isLive(s, o.id);
        const hand = s.hands[o.id] ?? [];
        const peeking = s.knownTopCount[o.id] ?? 0;
        const marked = hand.filter((c) => s.markedCardIds?.includes(c.id));
        const stash = s.towerStash?.[o.id]?.length ?? 0;
        const cursed = s.cursedPlayers?.includes(o.id) ?? false;
        const takeFrom = s.illTakeThat?.[o.id];
        const deciding = s.activePlayerId === o.id && s.turnPlayerId !== o.id;
        const pickable = needsTarget && !dead && selectedCards.length > 0;
        return (
          <PlayerPlate
            key={o.id}
            seat={o}
            active={!dead && s.turnPlayerId === o.id}
            out={dead}
            outLabel="BOOM"
            sub={dead ? 'Exploded' : `${hand.length} card${hand.length === 1 ? '' : 's'}`}
            targetable={pickable}
            selected={pickable && target === o.id}
            onClick={pickable ? () => setTarget(o.id) : undefined}
          >
            {!dead && (
              <>
                <div className="ek-mini-hand" aria-hidden="true">
                  {hand.slice(0, 8).map((c) => <span key={c.id} className="ek-mini-back" />)}
                  {hand.length > 8 && <span className="ek-mini-more">+{hand.length - 8}</span>}
                </div>
                <div className="ek-plate-chips">
                  {deciding && <Chip tone="accent">Deciding…</Chip>}
                  {cursed && <Chip tone="danger" title="Plays blind until they draw">Cursed</Chip>}
                  {stash > 0 && <Chip title="Tower of Power stash">Stash {stash}</Chip>}
                  {peeking > 0 && <Chip title="They have seen the top of the deck">Knows top {peeking}</Chip>}
                  {marked.map((mc) => <Chip key={mc.id} tone="danger" title="Marked card">Marked {CARD_LABEL[mc.kind]}</Chip>)}
                  {takeFrom && <Chip tone="danger">Next draw → {nameOf(s, takeFrom)}</Chip>}
                </div>
              </>
            )}
          </PlayerPlate>
        );
      })}
    </PlayerStrip>
  );

  // ---- board: deck · stage · discard ----------------------------------------------
  const showImploding = s.implodingFaceUp && s.deck[0]?.kind === 'implodingKitten';
  const turnSeat = seatOf(s, s.turnPlayerId);
  const board = (
    <div className="ek-board">
      <div className="ek-pile">
        <div
          className={`ek-deck${danger >= 0.25 ? ' is-hot' : ''}${shuffleKey ? ' is-shuffled' : ''}`}
          key={`deck-${shuffleKey}`}
          style={{ '--risk': danger } as CSSProperties}
        >
          {s.deck.length > 2 && <FaceDownCard />}
          {s.deck.length > 1 && <FaceDownCard />}
          {s.deck.length > 0 && (showImploding
            ? <Card kind="implodingKitten" className="ek-deck-top" inspect={false} />
            : <FaceDownCard key={drawKey} className={`ek-deck-top${drawKey ? ' is-drawn' : ''}`} />)}
          {s.deck.length === 0 && <div className="ek-empty-slot">empty</div>}
          <span className="ek-deck-count">{s.deck.length}</span>
        </div>
        <div className="ek-pile-label"><strong>{kittensLeft}</strong> kitten{kittensLeft === 1 ? '' : 's'} in deck</div>
        {alive && (
          <div className={`ek-risk${danger >= 0.4 ? ' is-bad' : ''}`} title="Chance the next card is a kitten, from what you know">
            <span>Draw risk <strong>{Math.round(danger * 100)}%</strong></span>
            <span className="ek-risk-bar"><span style={{ width: `${Math.max(4, danger * 100)}%` }} /></span>
          </div>
        )}
      </div>

      <div className="ek-stage">
        {s.pending ? (
          <Stage state={s} pending={s.pending} />
        ) : s.subPhase === 'awaitingDefuse' && s.pendingKitten ? (
          <>
            {/* A drawn kitten is announced to everyone, so it's fine to show. */}
            <Card kind={s.pendingKitten.kind} size="lg" className="ek-ticking" inspect={false} />
            <div className="ek-stage-caption"><strong>{nameOf(s, s.activePlayerId)}</strong> drew a kitten!</div>
          </>
        ) : s.subPhase === 'awaitingKittenPlace' ? (
          <>
            <FaceDownCard className="ek-hiding" />
            <div className="ek-stage-caption"><strong>{nameOf(s, s.activePlayerId)}</strong> is hiding the kitten…</div>
          </>
        ) : s.phase === 'gameOver' ? (
          <div className="ek-idle">
            <div className="ek-idle-turn">The dust settles</div>
          </div>
        ) : (
          <div className="ek-idle" style={{ '--seat': turnSeat?.color } as CSSProperties}>
            <div className="ek-idle-turn"><span>{turnSeat?.id === me ? 'Your' : `${turnSeat?.name ?? '—'}'s`}</span> turn</div>
            <div className="ek-meta">
              {s.turnsRemaining > 1 && <Chip tone="danger">Owes {s.turnsRemaining} turns</Chip>}
              <Chip>{s.deck.length} cards to draw</Chip>
              {s.turnDirection === -1 && <Chip tone="accent">↺ Reversed</Chip>}
            </div>
          </div>
        )}
      </div>

      <div className="ek-pile">
        <div className="ek-discard">
          {s.discard.length === 0 && <div className="ek-empty-slot">discard</div>}
          {s.discard.slice(-3).map((c, i, arr) => (
            <Card key={c.id} kind={c.kind} className={i === arr.length - 1 ? 'is-top' : undefined} inspect={i === arr.length - 1} />
          ))}
        </div>
        <div className="ek-pile-label"><strong>{s.discard.length}</strong> discarded</div>
      </div>
    </div>
  );

  // ---- the dock: what you have to do, or who we're waiting on ------------------
  const dock = renderDock();

  function renderDock(): ReactNode {
    if (s.phase === 'gameOver') {
      const winner = s.seats.find((seat) => isLive(s, seat.id));
      return (
        <GameOverPanel
          seats={s.seats}
          finalScores={s.finalScores}
          winnerIds={winner ? [winner.id] : []}
          localPlayerId={me}
          headline={`${winner?.name ?? 'Nobody'} survives!`}
          detail={`Knocked out, in order: ${s.eliminated.map((id) => nameOf(s, id)).join(' → ') || '—'}`}
          showScores={false}
          art={<CardArt kind="towerOfPower" />}
        />
      );
    }
    const active = seatOf(s, s.activePlayerId);
    const mine = !!me && s.activePlayerId === me;

    if (s.subPhase === 'awaitingNope') {
      if (mine && s.pending) {
        const live = s.pending.nopeCards.length % 2 === 0;
        const myNope = myHand.find((c) => c.kind === 'nope');
        return (
          <Dock
            tone="react"
            eyebrow="Nope window"
            title={live ? 'Let it happen?' : "It's been Noped — un-Nope it?"}
            actions={
              <>
                {myNope && <Card kind="nope" size="sm" inspect={false} onClick={() => send({ type: 'playNope', playerId: me!, cardId: myNope.id })} />}
                <button className="secondary" onClick={() => send({ type: 'declineNope', playerId: me! })}>Allow it</button>
              </>
            }
          >
            {nameOf(s, s.pending.byPlayerId)} played <strong>{describePlay(s, s.pending)}</strong>.
            {s.pending.nopeCards.length > 0 && ` ${s.pending.nopeCards.length} Nope${s.pending.nopeCards.length === 1 ? '' : 's'} on the stack.`}
          </Dock>
        );
      }
      return <Dock tone="wait" who={active} eyebrow={`Nope window · ${active?.name ?? '…'} may answer`} title={s.pending ? `${nameOf(s, s.pending.byPlayerId)} played ${describePlay(s, s.pending)}` : 'Nope window'} />;
    }

    if (s.subPhase === 'awaitingDefuse') {
      const bark = s.pendingKitten?.kind === 'barkingKitten';
      if (mine) {
        const defuses = myHand.filter((c) => isDefuseKind(c.kind));
        const revive = reviveTarget && s.eliminated.includes(reviveTarget) ? reviveTarget : s.eliminated[0] ?? null;
        return (
          <Dock
            tone="danger"
            eyebrow="Tick… tick…"
            title={bark ? 'You were hit by a Barking Kitten!' : 'You drew an Exploding Kitten!'}
            actions={
              <>
                {defuses.map((c) => (
                  <Card
                    key={c.id}
                    kind={c.kind}
                    size="sm"
                    inspect={false}
                    onClick={() => send({
                      type: 'playDefuse',
                      playerId: me!,
                      cardId: c.id,
                      ...(c.kind === 'zombieKitten' && revive ? { targetPlayerId: revive } : {}),
                    })}
                  />
                ))}
                {s.pendingKitten?.kind === 'explodingKitten' && canHoldWithStreaking(s, me!) && (
                  <button onClick={() => send({ type: 'keepKitten', playerId: me! })}>Keep it (Streaking Kitten)</button>
                )}
              </>
            }
          >
            {defuses.length ? 'Play a Defuse — or you are out.' : 'No Defuse. This is going to hurt.'}
            {s.eliminated.length > 0 && myHand.some((c) => c.kind === 'zombieKitten') && (
              <div className="ek-picker">
                <span>Zombie Kitten brings back:</span>
                {s.eliminated.map((id) => (
                  <button key={id} className={`secondary tiny${revive === id ? ' is-on' : ''}`} onClick={() => setReviveTarget(id)}>{nameOf(s, id)}</button>
                ))}
              </div>
            )}
          </Dock>
        );
      }
      return <Dock tone="danger" who={active} eyebrow="Tick… tick…" title={`${active?.name ?? 'Someone'} drew a kitten!`} />;
    }

    if (s.subPhase === 'awaitingKittenPlace' || s.subPhase === 'awaitingBuryPlace') {
      if (!mine) return <Dock tone="wait" who={active} title={`${active?.name ?? 'Someone'} is hiding a card in the deck…`} />;
      if (s.subPhase === 'awaitingBuryPlace') {
        if (!s.pendingBury) return null;
        return (
          <PlacePrompt
            key="bury"
            deckSize={s.deck.length}
            eyebrow="Bury"
            title={`Bury your ${CARD_LABEL[s.pendingBury.kind]}`}
            card={s.pendingBury.kind}
            onPlace={(index) => send({ type: 'placeBury', playerId: me!, index })}
          >
            Slide it back anywhere in the deck.
          </PlacePrompt>
        );
      }
      const imploding = s.pendingKitten?.kind === 'implodingKitten';
      return (
        <PlacePrompt
          key="kitten"
          deckSize={s.deck.length}
          eyebrow="Defused — for now"
          title={imploding ? 'Place the face-up Imploding Kitten' : 'Hide the kitten'}
          card={imploding ? 'implodingKitten' : 'explodingKitten'}
          onPlace={(index) => send({ type: 'placeKitten', playerId: me!, index })}
        >
          {imploding ? 'It goes back face-up: whoever draws it next is out on the spot.' : 'Nobody sees where it goes.'}
          {s.turnsRemaining > 1 && <strong> Careful — you still owe {s.turnsRemaining} turns, so you draw next.</strong>}
        </PlacePrompt>
      );
    }

    if (s.subPhase === 'awaitingFavorGive') {
      return mine
        ? <Dock tone="turn" eyebrow="Favor" title="Pay up">{nameOf(s, s.pendingFavor?.toPlayerId)} demanded a favour. Click a card in your hand to hand it over — make it a bad one.</Dock>
        : <Dock tone="wait" who={active} title={`${active?.name ?? 'Someone'} is choosing a card for ${nameOf(s, s.pendingFavor?.toPlayerId)}…`} />;
    }
    if (s.subPhase === 'awaitingGarbagePick') {
      return mine
        ? <Dock tone="turn" eyebrow="Garbage Collection" title="Throw one back">Click a card in your hand to shuffle it into the deck.</Dock>
        : <Dock tone="wait" who={active} title={`${active?.name ?? 'Someone'} is picking a card to throw back…`} />;
    }
    if (s.subPhase === 'awaitingPotluckPick') {
      return mine
        ? <Dock tone="turn" eyebrow="Potluck" title="Bring a dish">Click a card in your hand to put face-down on top of the deck.</Dock>
        : <Dock tone="wait" who={active} title={`${active?.name ?? 'Someone'} is bringing a dish…`} />;
    }
    if (s.subPhase === 'awaitingDigDeeper' && s.pendingDigDeeper) {
      if (!mine) return <Dock tone="wait" who={active} title={`${active?.name ?? 'Someone'} is digging deeper…`} />;
      return (
        <Dock tone="turn" eyebrow="Dig Deeper" title="Keep one" actions={
          <div className="ek-choices">
            {s.pendingDigDeeper.cards.map((c, i) => (
              <Card key={c.id} kind={c.kind} size="sm" footnote={i === 0 ? 'top' : '2nd'} onClick={() => send({ type: 'pickDigDeeper', playerId: me!, cardId: c.id })} />
            ))}
          </div>
        }>
          Take one into your hand; the other goes back on top.
        </Dock>
      );
    }
    if (s.subPhase === 'awaitingDiscardPick') {
      if (!mine) return <Dock tone="wait" who={active} title={`${active?.name ?? 'Someone'} is raiding the discard pile…`} />;
      return (
        <Dock tone="turn" eyebrow="Five different" title="Raid the discard pile">
          Take any one card.
          <div className="ek-choices is-scroll">
            {s.discard.map((c) => (
              <Card key={c.id} kind={c.kind} size="sm" onClick={() => send({ type: 'takeFromDiscard', playerId: me!, cardId: c.id })} />
            ))}
          </div>
        </Dock>
      );
    }
    if (s.subPhase === 'awaitingFutureView') {
      if (s.peek && s.peek.playerId === me) return <FutureView key={s.peek.cards.map((c) => c.id).join('-')} state={s} me={me!} onSend={send} />;
      return <Dock tone="wait" who={seatOf(s, s.peek?.playerId)} title={`${nameOf(s, s.peek?.playerId)} is peering into the future…`} />;
    }

    // awaitingAction
    if (selectedCards.length > 0 && (isMyTurn || isOutOfTurnNow)) {
      const problem = !singleIsPlayable && !combo
        ? (selectedCards.length === 1 ? `${CARD_LABEL[selectedCards[0]!.kind]} can't be played on its own.` : "Those cards don't form a combo.")
        : null;
      return (
        <Dock
          tone="turn"
          eyebrow={isMyTurn ? 'Your turn' : 'Out of turn'}
          title={playLabel}
          actions={
            <>
              <button onClick={doPlay} disabled={!canPlay}>Play ▶</button>
              <button className="secondary" onClick={clearSelection}>Clear</button>
              {isMyTurn && <button className="secondary" onClick={() => send({ type: 'drawCard', playerId: me! })}>Draw &amp; end turn</button>}
            </>
          }
        >
          {problem ?? (needsTarget && !targetOk ? 'Pick a target: click an opponent above.' : needsTarget ? `Target: ${nameOf(s, target)}.` : 'Ready when you are.')}
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
        </Dock>
      );
    }
    if (isMyTurn) {
      return (
        <Dock
          tone="turn"
          eyebrow={s.turnsRemaining > 1 ? `Your turn · you owe ${s.turnsRemaining}` : 'Your turn'}
          title="Play cards, or draw to end your turn"
          actions={<button className="ek-draw-btn" onClick={() => send({ type: 'drawCard', playerId: me! })}>Draw &amp; end turn</button>}
        >
          {hints.length > 0
            ? `Combos available: ${hints.map((h) => (h.kind === 'fiveDifferent' ? 'five different' : h.kind)).join(', ')}.`
            : 'Select cards in your hand to play them.'}
        </Dock>
      );
    }
    return <Dock tone="wait" who={active} title={`${active?.name ?? 'Someone'} is thinking`} />;
  }

  // ---- side: log + what you know ---------------------------------------------------
  const side = (
    <>
      {known.length > 0 && (
        <Panel title="You know what's coming">
          <div className="ek-known">
            {known.map((c, i) => <Card key={c.id} kind={c.kind} size="sm" footnote={i === 0 ? 'next' : `+${i}`} />)}
          </div>
        </Panel>
      )}
      <GameLog entries={s.log} seats={s.seats} />
    </>
  );

  // ---- your hand ---------------------------------------------------------------------
  const hand = alive ? (
    <div className="ek-hand-area">
      <div className="ek-hand-head">
        <h4>Your hand ({myHand.length})</h4>
        <div className="ek-chips">
          {isCursed && <Chip tone="danger">Cursed — blind until you draw</Chip>}
          {(s.towerStash?.[me!]?.length ?? 0) > 0 && <Chip>Stash {s.towerStash![me!]!.length}</Chip>}
          {handMode === 'give' && <Chip tone="accent">Click a card to give it</Chip>}
          {(handMode === 'garbage' || handMode === 'potluck') && <Chip tone="accent">Click a card</Chip>}
        </div>
      </div>
      <div className="ek-hand">
        {myHand.length === 0 ? (
          <p className="ek-hand-empty">Empty. Bold strategy.</p>
        ) : (
          <CardFan label="Your hand" maxTilt={8}>
            {myHand.map((c) => {
              const click = onHandCard(c);
              return isCursed ? (
                <FaceDownCard key={c.id} selected={selected.includes(c.id)} onClick={click} disabled={!click} />
              ) : (
                <Card
                  key={c.id}
                  kind={c.kind}
                  selected={selected.includes(c.id)}
                  footnote={s.markedCardIds?.includes(c.id) ? 'marked' : undefined}
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
    <div className="ek-hand-area">
      <p className="ek-hand-empty">{me ? 'You exploded. Enjoy the show.' : 'Spectating — no hand to show.'}</p>
    </div>
  );

  return (
    <GameTable
      className={`ek-table${shaking ? ' is-shaking' : ''}`}
      top={top}
      board={board}
      side={side}
      dock={dock}
      hand={hand}
      overlay={
        <>
          <FxLayer fx={fx} />
          <TurnCue active={isMyTurn && s.subPhase === 'awaitingAction' && s.phase === 'playing'} />
        </>
      }
    />
  );
}

// ============================================================================
// Pieces
// ============================================================================

/** The play waiting out its Nope window, with every Nope slapped on top. */
function Stage({ state: s, pending: p }: { state: EkState; pending: EkPendingPlay }) {
  const live = p.nopeCards.length % 2 === 0;
  return (
    <>
      <div className="ek-stage-cards">
        {p.cards.map((c) => <Card key={c.id} kind={c.kind} size="md" />)}
        <div className="ek-nopes">
          {/* each Nope lands a little askew, stacking up */}
          {p.nopeCards.map((c, i) => (
            <span key={c.id} style={{ '--nx': `${i * 14 - 20}px`, '--ny': `${18 - i * 8}px`, '--nr': `${(i % 2 ? 1 : -1) * (10 + i * 4)}deg` } as CSSProperties}>
              <Card kind="nope" size="sm" inspect={false} />
            </span>
          ))}
        </div>
      </div>
      <div className="ek-stage-caption">
        <strong>{nameOf(s, p.byPlayerId)}</strong> played {describePlay(s, p)}
      </div>
      {p.nopeCards.length > 0 && (
        <div className={`ek-verdict ${live ? 'is-live' : 'is-noped'}`}>{live ? 'Back on!' : `Noped ×${p.nopeCards.length}`}</div>
      )}
    </>
  );
}

/** Choose where a card goes back into the deck: quick picks plus a ruler. */
function PlacePrompt({ deckSize, eyebrow, title, card, onPlace, children }: {
  deckSize: number;
  eyebrow: string;
  title: string;
  card: EkBaseCardKind;
  onPlace: (index: number) => void;
  children?: ReactNode;
}) {
  const max = deckSize;
  const [index, setIndex] = useState(0);
  const quick: { label: string; value: number }[] = [
    { label: 'Top', value: 0 },
    { label: '2nd', value: Math.min(1, max) },
    { label: '3rd', value: Math.min(2, max) },
    { label: 'Middle', value: Math.floor(max / 2) },
    { label: 'Bottom', value: max },
  ];
  const where = index === 0 ? 'on top' : index >= max ? 'at the bottom' : `${index} card${index === 1 ? '' : 's'} down`;
  return (
    <Dock tone="turn" eyebrow={eyebrow} title={title} actions={
      <>
        <Card kind={card} size="sm" inspect={false} />
        <button onClick={() => onPlace(index)}>Bury it {where}</button>
      </>
    }>
      {children}
      <div className="ek-bury">
        <div className="ek-picker">
          {quick.map((q) => (
            <button key={q.label} className={`secondary tiny${index === q.value ? ' is-on' : ''}`} onClick={() => setIndex(q.value)}>{q.label}</button>
          ))}
        </div>
        <div className="ek-bury-track">
          <span>Top</span>
          <div className="ek-bury-ruler" style={{ '--n': Math.max(1, max) } as CSSProperties}>
            <input type="range" min={0} max={max} value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label={`Position in the ${max}-card deck`} />
            <svg className="ek-bury-pin" viewBox="0 0 26 52" style={{ left: `${max ? (index / max) * 100 : 0}%` }} aria-hidden="true">
              <path d="M13 50 L13 18" stroke="#120709" strokeWidth={3} />
              <circle cx={13} cy={13} r={10} fill="#ff4d4d" stroke="#120709" strokeWidth={3} />
            </svg>
          </div>
          <span>Bottom</span>
        </div>
      </div>
    </Dock>
  );
}

/** See / alter the future: the next cards, reorderable when the card allows. */
function FutureView({ state: s, me, onSend }: { state: EkState; me: PlayerId; onSend: (a: EkAction) => void }) {
  const peek = s.peek!;
  const [ordered, setOrdered] = useState<EkCard[]>(peek.cards);
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= ordered.length) return;
    const next = [...ordered];
    [next[idx], next[j]] = [next[j]!, next[idx]!];
    setOrdered(next);
  }
  return (
    <Dock
      tone="turn"
      eyebrow={peek.canReorder ? 'Alter the future' : 'See the future'}
      title={peek.canReorder ? `Rearrange the next ${peek.cards.length} cards` : `The next ${peek.cards.length} cards`}
      actions={peek.canReorder
        ? <button onClick={() => onSend({ type: 'reorderFuture', playerId: me, orderedCardIds: ordered.map((c) => c.id) })}>Confirm order</button>
        : <button onClick={() => onSend({ type: 'ackPeek', playerId: me })}>Got it</button>}
    >
      Top of the deck first. {peek.shareWithNext ? 'The next player sees the order you choose!' : 'Only you can see this.'}
      <div className="ek-future">
        {ordered.map((c, i) => (
          <div key={c.id} className="ek-future-slot">
            <Card kind={c.kind} size="sm" footnote={i === 0 ? 'next' : `+${i}`} />
            {peek.canReorder && ordered.length > 1 && (
              <div className="ek-picker" style={{ marginTop: 0 }}>
                <button type="button" className="secondary tiny" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Earlier">←</button>
                <button type="button" className="secondary tiny" disabled={i === ordered.length - 1} onClick={() => move(i, 1)} aria-label="Later">→</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Dock>
  );
}
