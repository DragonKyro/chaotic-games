// Unstable Unicorns — lobby config + in-game view, on the shared table kit.
//
// Hidden information: only `localPlayerId`'s hand is rendered (plus hands a
// Nanny Cam makes public, and the cards a prompt legitimately shows — a deck
// search, Blatant Thievery's look). Deck order is never shown.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import { seatName } from '@/core/state';
import {
  CardFan, Chip, Dock, ExpansionPicker, FxLayer, GameLog, GameOverPanel, GameTable, PlayerPlate, PlayerStrip,
  Tally, TurnCue, useChangeKey, useFx,
} from '@/ui/kit';
import { UuCardBack, UuCardView } from './Card';
import { CardArt } from './CardArt';
import { isNeighCard } from './cards';
import {
  canPlayCardFromHand, canPlayNeigh, findCardInStable, handLimitOf, handOf, hasDragonsBlessing, hasNannyCam, hasPandamonium,
  isBlinded, queenBeeOwner, stableOf, unicornCount, validHandCards, validPileCards, validStableTargets,
} from './reducer';
import { INK } from './unicornArt';
import type { UuAction, UuCard, UuConfig, UuExpansionId, UuPhase, UuPrompt, UuState } from './types';
import { UU_EXPANSIONS } from './types';

// ============================================================================
// Lobby
// ============================================================================

export function LobbyConfig({ config, onChange, readOnly }: {
  config: UuConfig;
  seats?: Seat[];
  onChange: (c: UuConfig) => void;
  readOnly?: boolean;
}) {
  const toggle = (id: string) => {
    const has = config.expansions.includes(id as UuExpansionId);
    onChange({ ...config, expansions: has ? config.expansions.filter((x) => x !== id) : [...config.expansions, id as UuExpansionId] });
  };
  return (
    <div className="game-config">
      <label className="field">
        <span>Base edition</span>
        <select value={config.edition} onChange={(e) => onChange({ ...config, edition: e.target.value as UuConfig['edition'] })}>
          <option value="base-2nd">2nd Edition Base Deck (135 cards — default)</option>
          <option value="base">1st Edition / Original Print (Fertile, Puppicorn, Zombie, Angel, Shrinkray, Lasso)</option>
          <option value="control">Control Collector&apos;s Edition (Chronocorn, Time Shift, Absorb &amp; Reflect)</option>
          <option value="chaos">Chaos Collector&apos;s Edition (Unicorn of Chaos, Hell&apos;s Steedicorn, Redirect)</option>
          <option value="diamond">Diamond Edition (Diamond Unicorns, Crystal Narwhal, Prismatic Shield)</option>
          <option value="travel">Travel Edition (Compact 82-card portable deck)</option>
        </select>
      </label>
      {!readOnly && (
        <div className="uu-bulk">
          <button type="button" className="secondary tiny" onClick={() => onChange({ ...config, expansions: UU_EXPANSIONS.map((e) => e.id as UuExpansionId) })}>Select all</button>
          <button type="button" className="secondary tiny" onClick={() => onChange({ ...config, expansions: [] })}>Clear</button>
        </div>
      )}
      <ExpansionPicker expansions={UU_EXPANSIONS} enabled={config.expansions} onToggle={toggle} readOnly={readOnly} />
      <p className="lobby-hint" style={{ margin: 0 }}>
        2–8 players. First to 7 Unicorns wins (6 at 6–8 players). Mix any base edition with any of the 8 expansions.
      </p>
    </div>
  );
}

// ============================================================================
// Game view
// ============================================================================

interface ViewProps {
  state: UuState;
  localPlayerId: PlayerId | null;
  dispatch: (action: UuAction) => void;
}

const PHASE_LABEL: Record<UuPhase, string> = {
  beginningOfTurn: 'Start of turn',
  draw: 'Draw phase',
  action: 'Action phase',
  endOfTurn: 'End of turn',
  awaitingNeigh: 'Neigh window',
  awaitingPrompt: 'Resolving an effect',
  gameOver: 'Game over',
};

const seatOf = (s: UuState, id: PlayerId | null | undefined) => (id ? s.seats.find((x) => x.id === id) ?? null : null);
const nameOf = (s: UuState, id: PlayerId | null | undefined) => seatName(s, id ?? null);

/** Every unicorn in every Stable, by id → owner (for spotting destroyed / stolen ones). */
function herdIndex(s: UuState): Map<number, { owner: PlayerId; card: UuCard }> {
  const m = new Map<number, { owner: PlayerId; card: UuCard }>();
  for (const seat of s.seats) for (const u of s.stables[seat.id]?.unicorns ?? []) m.set(u.id, { owner: seat.id, card: u });
  return m;
}

/** Where a card from the hand may legally go. Magic resolves on its own (no Stable). */
function legalDestinations(s: UuState, me: PlayerId, c: UuCard): PlayerId[] {
  if (c.type === 'instant') return [];
  if (c.type === 'magic') return canPlayCardFromHand(s, me, c) ? [me] : [];
  return s.seats.map((x) => x.id).filter((id) => canPlayCardFromHand(s, me, c, id));
}

export function GameView({ state: s, localPlayerId: me, dispatch }: ViewProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [destination, setDestination] = useState<PlayerId | null>(null);
  const [handPicks, setHandPicks] = useState<number[]>([]);
  const fx = useFx();

  const seated = me != null && !!s.hands[me];
  const myHand: UuCard[] = seated ? handOf(s, me!) : [];
  const isMyTurn = seated && s.turnPlayerId === me;
  const prompt: UuPrompt | null = s.subPhase === 'awaitingPrompt' ? s.promptQueue[0] ?? null : null;
  const myPrompt = !!prompt && prompt.playerId === me;
  const promptKey = prompt ? JSON.stringify(prompt) : '';

  // A new decision clears half-made picks.
  useEffect(() => { setHandPicks([]); }, [promptKey]);
  useEffect(() => {
    if (!(isMyTurn && s.subPhase === 'action')) { setSelectedId(null); setDestination(null); }
  }, [isMyTurn, s.subPhase]);

  const playMode = isMyTurn && s.subPhase === 'action' && s.activePlayerId === me;
  const selectPrompt = myPrompt && prompt!.kind === 'chooseCardsFromHand' ? (prompt as Extract<UuPrompt, { kind: 'chooseCardsFromHand' }>) : null;
  const selectValid = useMemo(() => (selectPrompt ? new Set(validHandCards(s, selectPrompt).map((c) => c.id)) : new Set<number>()), [s, selectPrompt]);
  const selectNeeded = selectPrompt ? Math.min(selectPrompt.count, selectValid.size) : 0;

  const selected = playMode ? myHand.find((c) => c.id === selectedId) ?? null : null;
  const dests = selected && me ? legalDestinations(s, me, selected) : [];
  const qb = queenBeeOwner(s);
  const others = s.seats.filter((x) => x.id !== me);
  const leader = [...others].sort((a, b) => unicornCount(s, b.id) - unicornCount(s, a.id))[0]?.id ?? null;
  const defaultDest = !selected || !me ? null
    : selected.type === 'basicUnicorn' && qb && dests.includes(qb) ? qb
    : selected.type === 'downgrade' ? (leader && dests.includes(leader) ? leader : dests.find((d) => d !== me) ?? dests[0] ?? null)
    : dests.includes(me) ? me : dests[0] ?? null;
  const dest = destination && dests.includes(destination) ? destination : defaultDest;
  const needsStable = !!selected && selected.type !== 'magic';
  const pickingStable = needsStable && dests.length > 1;

  function send(a: UuAction) {
    dispatch(a);
    setSelectedId(null);
    setDestination(null);
  }

  function onHandCard(c: UuCard): (() => void) | undefined {
    if (playMode && me) {
      if (legalDestinations(s, me, c).length === 0) return undefined;
      return () => { setSelectedId((cur) => (cur === c.id ? null : c.id)); setDestination(null); };
    }
    if (selectPrompt && selectValid.has(c.id)) {
      return () => setHandPicks((cur) => (cur.includes(c.id) ? cur.filter((x) => x !== c.id) : cur.length < selectNeeded ? [...cur, c.id] : cur));
    }
    return undefined;
  }

  // ---- FX from state transitions -------------------------------------------------
  const prev = useRef(s);
  useEffect(() => {
    const was = prev.current;
    prev.current = s;
    if (was === s) return;
    const n0 = was.pending?.neighCards.length ?? 0;
    const n1 = s.pending?.neighCards.length ?? 0;
    if (s.pending && n1 > n0) {
      if (s.pending.superNeighed && !was.pending?.superNeighed) {
        fx.stamp(<span className="uu-holo-text">SUPER NEIGH!</span>, 'accent');
        fx.burst([0.5, 0.4], '#ffe27a');
      } else {
        fx.stamp(<span className="uu-stamp-hoof"><Hoof />NEIGH!</span>, 'danger');
      }
    }
    // Unicorns that left every Stable were destroyed or sacrificed.
    const before = herdIndex(was);
    const after = herdIndex(s);
    const gone = [...before.values()].filter((u) => !after.has(u.card.id));
    if (gone.length > 0) {
      fx.burst([0.5, 0.45], '#ff5fd2');
      fx.toast(gone.length === 1 ? `${gone[0]!.card.name} is gone. (${nameOf(s, gone[0]!.owner)})` : `${gone.length} unicorns are gone.`);
    } else {
      const stolen = [...before.values()].find((u) => after.has(u.card.id) && after.get(u.card.id)!.owner !== u.owner);
      if (stolen) fx.toast(`${nameOf(s, after.get(stolen.card.id)!.owner)} stole ${stolen.card.name}!`, 'accent');
    }
    if (s.phase === 'gameOver' && was.phase !== 'gameOver') fx.stamp('UNSTOPPABLE!', 'good');
  }, [s]);

  const drawKey = useChangeKey(s.deck.length);

  // ---- opponents --------------------------------------------------------------------
  const choosePlayerPrompt = myPrompt && prompt!.kind === 'choosePlayer' ? (prompt as Extract<UuPrompt, { kind: 'choosePlayer' }>) : null;
  const playerCandidates = choosePlayerPrompt
    ? s.seats.filter((x) => (choosePlayerPrompt.allowSelf || x.id !== me) && x.id !== choosePlayerPrompt.movedFromPlayerId).map((x) => x.id)
    : [];

  const top = (
    <PlayerStrip>
      {others.map((o) => {
        const st = stableOf(s, o.id);
        const hand = handOf(s, o.id);
        const count = unicornCount(s, o.id);
        const stableTarget = pickingStable && dests.includes(o.id);
        const playerTarget = playerCandidates.includes(o.id);
        const nanny = hasNannyCam(s, o.id) && hand.length > 0;
        return (
          <PlayerPlate
            key={o.id}
            seat={o}
            active={s.turnPlayerId === o.id && s.phase === 'playing'}
            sub={<span className="uu-plate-sub"><HornPips have={count} goal={s.unicornsToWin} /><span><Tally value={count} />/{s.unicornsToWin} · {hand.length} card{hand.length === 1 ? '' : 's'}</span></span>}
            targetable={stableTarget || playerTarget}
            selected={stableTarget && dest === o.id}
            onClick={
              playerTarget && me ? () => dispatch({ type: 'resolvePrompt', playerId: me, targetPlayerId: o.id })
              : stableTarget ? () => setDestination(o.id)
              : undefined
            }
          >
            <div className="uu-plate-herd">
              {[...st.unicorns, ...st.upgrades, ...st.downgrades].slice(0, 8).map((u) => <UuCardView key={u.id} card={u} size="xs" />)}
              {st.unicorns.length + st.upgrades.length + st.downgrades.length > 8 && (
                <span className="uu-plate-more">+{st.unicorns.length + st.upgrades.length + st.downgrades.length - 8}</span>
              )}
            </div>
            <StatusChips state={s} id={o.id} />
            {s.activePlayerId === o.id && s.turnPlayerId !== o.id && <div className="uu-plate-chips"><Chip tone="accent">Deciding…</Chip></div>}
            {nanny && (
              <div className="uu-plate-herd" title="Nanny Cam: this hand is public">
                {hand.map((c) => <UuCardView key={c.id} card={c} size="xs" />)}
              </div>
            )}
          </PlayerPlate>
        );
      })}
    </PlayerStrip>
  );

  // ---- board: piles · stage · your corral ----------------------------------------------
  const turnSeat = seatOf(s, s.turnPlayerId);
  const myStable = seated ? stableOf(s, me!) : null;
  const myCount = seated ? unicornCount(s, me!) : 0;
  const corralTarget = pickingStable && !!me && dests.includes(me);
  const board = (
    <div className="uu-board">
      <div className="uu-arena">
        <div className="uu-piles">
          <div className="uu-pile">
            <div className="uu-deck">
              {s.deck.length > 2 && <UuCardBack />}
              {s.deck.length > 1 && <UuCardBack />}
              {s.deck.length > 0 ? <UuCardBack key={drawKey} className={`uu-deck-top${drawKey ? ' is-drawn' : ''}`} /> : <div className="uu-empty">empty</div>}
              <span className="uu-count">{s.deck.length}</span>
            </div>
            <span className="uu-pile-label">Deck</span>
          </div>
          <div className="uu-pile" title="The Nursery: Baby Unicorns waiting for a Stable">
            <div className="uu-nursery">
              {s.nursery.slice(0, 3).map((c) => <UuCardView key={c.id} card={c} size="sm" />)}
              <Basket />
              <span className="uu-count">{s.nursery.length}</span>
            </div>
            <span className="uu-pile-label">Nursery</span>
          </div>
        </div>

        <div className="uu-stage">
          {s.pending ? (
            <Stage state={s} />
          ) : s.phase === 'gameOver' ? (
            <div className="uu-turn">The herd has spoken</div>
          ) : (
            <>
              <div className="uu-turn" style={{ '--seat': turnSeat?.color } as CSSProperties}>
                <span>{turnSeat?.id === me ? 'Your' : `${turnSeat?.name ?? '—'}'s`}</span> turn
              </div>
              <div className="uu-meta">
                <Chip>{PHASE_LABEL[s.subPhase]}</Chip>
                {s.subPhase === 'action' && <Chip tone="accent">{s.playsRemaining} play{s.playsRemaining === 1 ? '' : 's'} left</Chip>}
                <Chip>{s.unicornsToWin} unicorns to win</Chip>
                {qb && <Chip title="Basic Unicorns can only enter this player's Stable">Queen Bee: {nameOf(s, qb)}</Chip>}
              </div>
            </>
          )}
        </div>

        <div className="uu-pile">
          <div className="uu-discard">
            {s.discard.length === 0 && <div className="uu-empty">discard</div>}
            {s.discard.slice(-2).map((c, i, arr) => (
              <UuCardView key={c.id} card={c} className={i === arr.length - 1 ? 'is-top' : undefined} inspect={i === arr.length - 1} />
            ))}
          </div>
          <span className="uu-pile-label"><strong>{s.discard.length}</strong> discarded</span>
        </div>
      </div>

      {myStable && (
        <div
          className={`uu-corral${corralTarget ? ' is-target' : ''}${needsStable && dest === me ? ' is-dest' : ''}`}
          onClick={corralTarget ? () => setDestination(me) : undefined}
        >
          <div className="uu-corral-head">
            <h4>Your Stable</h4>
            <HornPips have={myCount} goal={s.unicornsToWin} />
            <span className="uu-chips">
              <Chip tone={myCount >= s.unicornsToWin - 1 ? 'accent' : undefined}><Tally value={myCount} /> / {s.unicornsToWin} unicorns</Chip>
              <StatusChips state={s} id={me!} inline />
            </span>
          </div>
          <div className="uu-corral-rows">
            <div className="uu-herd">
              {myStable.unicorns.length === 0 && <span className="uu-herd-empty">No unicorns yet — not even a baby.</span>}
              {myStable.unicorns.map((u) => <UuCardView key={u.id} card={u} size="sm" />)}
            </div>
            {(myStable.upgrades.length > 0 || myStable.downgrades.length > 0) && (
              <div className="uu-mods">
                {[...myStable.upgrades, ...myStable.downgrades].map((c) => <UuCardView key={c.id} card={c} size="sm" />)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );

  // ---- the dock ------------------------------------------------------------------------
  function renderDock(): ReactNode {
    if (s.phase === 'gameOver') {
      const winner = seatOf(s, s.winnerId);
      const best = winner ? stableOf(s, winner.id).unicorns.find((u) => u.type === 'magicalUnicorn') ?? stableOf(s, winner.id).unicorns[0] : undefined;
      return (
        <GameOverPanel
          seats={s.seats}
          finalScores={s.finalScores}
          winnerIds={s.winnerId ? [s.winnerId] : undefined}
          localPlayerId={me}
          headline={winner ? `${winner.name} wins!` : undefined}
          detail={winner ? `A Stable of ${unicornCount(s, winner.id)} unicorns. Everyone else: neighed.` : 'The deck ran dry — the biggest herd takes it.'}
          scoreLabel="unicorns"
          art={best ? <CardArt card={best} /> : undefined}
        />
      );
    }
    const active = seatOf(s, s.activePlayerId);

    // Neigh window: the current responder, or anyone queued (playing out of turn is allowed).
    if (s.subPhase === 'awaitingNeigh' && s.pending && me) {
      const queued = s.pending.responderQueue.includes(me);
      if (s.activePlayerId === me || (queued && canPlayNeigh(s, me))) {
        return <NeighDock state={s} me={me} mine={s.activePlayerId === me} dispatch={dispatch} />;
      }
      return <Dock tone="wait" who={active} eyebrow={`Neigh window · ${active?.name ?? '…'} may answer`} title={`${nameOf(s, s.pending.byPlayerId)} played ${s.pending.card.name}`} />;
    }

    if (prompt) {
      if (myPrompt && me) {
        return (
          <PromptDock
            key={promptKey}
            state={s}
            prompt={prompt}
            me={me}
            dispatch={dispatch}
            handPicks={handPicks}
            handNeeded={selectNeeded}
          />
        );
      }
      return (
        <Dock tone="wait" who={active} title={prompt.kind === 'beginningTrigger' ? `${prompt.sourceCard.name} stirs in ${active?.name ?? 'someone'}'s Stable` : `${active?.name ?? 'Someone'} is deciding`}>
          {'reason' in prompt ? prompt.reason : prompt.kind === 'oraclePeek' ? 'Peering at the top of the deck…' : null}
        </Dock>
      );
    }

    if (isMyTurn && s.subPhase === 'draw' && me) {
      return (
        <Dock tone="turn" eyebrow="Your turn · draw phase" title="Draw a card to start your turn" actions={<button onClick={() => send({ type: 'drawForTurn', playerId: me })}>Draw a card</button>} />
      );
    }

    if (playMode && me) {
      if (selected) {
        const playable = dests.length > 0 && (!needsStable || !!dest);
        const where = needsStable
          ? dest === me ? 'into your Stable' : `into ${nameOf(s, dest)}'s Stable`
          : 'its effect resolves after the Neigh window';
        return (
          <Dock
            tone="turn"
            eyebrow={`Your turn · ${s.playsRemaining} play${s.playsRemaining === 1 ? '' : 's'} left`}
            title={`Play ${selected.name}`}
            actions={
              <>
                <button disabled={!playable} onClick={() => send({ type: 'playCard', playerId: me, cardId: selected.id, ...(needsStable && dest ? { targetPlayerId: dest } : {}) })}>Play ▶</button>
                <button className="secondary" onClick={() => setSelectedId(null)}>Cancel</button>
              </>
            }
          >
            {playable ? `Goes ${where}.` : "This card can't be played right now."}
            {pickingStable && ' Click a player above (or your Stable) to send it somewhere else.'}
            {selected.type === 'basicUnicorn' && qb && qb !== me && ` The Queen Bee forces it into ${nameOf(s, qb)}'s Stable.`}
          </Dock>
        );
      }
      return (
        <Dock
          tone="turn"
          eyebrow={`Your turn · action phase · ${s.playsRemaining} play${s.playsRemaining === 1 ? '' : 's'} left`}
          title={s.actedInActionPhase ? 'Play another card — or wrap it up' : 'Play a card — or draw instead'}
          actions={s.actedInActionPhase
            ? <button className="secondary" onClick={() => send({ type: 'endActionPhase', playerId: me })}>End action phase</button>
            : <button className="secondary" onClick={() => send({ type: 'drawInsteadOfPlaying', playerId: me })}>Draw instead</button>}
        >
          Select a card in your hand. Dimmed cards can&apos;t be played right now.
        </Dock>
      );
    }

    return <Dock tone="wait" who={active} title={`${active?.name ?? 'Someone'}'s ${PHASE_LABEL[s.subPhase].toLowerCase()}`} />;
  }

  // ---- side + hand ----------------------------------------------------------------------------
  const side = <GameLog entries={s.log} seats={s.seats} title="Stable gossip" />;

  const hand = seated ? (
    <div className="uu-hand-area">
      <div className="uu-hand-head">
        <h4>Your hand ({myHand.length} / {handLimitOf(s, me!)})</h4>
        <div className="uu-chips">
          {selectPrompt && <Chip tone="accent">Choose {selectNeeded} · {handPicks.length} picked</Chip>}
          {playMode && !selected && <Chip>Click a card to play it</Chip>}
        </div>
      </div>
      <div className="uu-hand">
        {myHand.length === 0 ? (
          <p className="uu-hand-empty">Empty-handed. Very zen. Very vulnerable.</p>
        ) : (
          <CardFan label="Your hand" maxTilt={8}>
            {myHand.map((c) => {
              const click = onHandCard(c);
              const live = playMode || !!selectPrompt;
              return (
                <UuCardView
                  key={c.id}
                  card={c}
                  selected={selectedId === c.id || handPicks.includes(c.id)}
                  onClick={click}
                  disabled={live && !click}
                />
              );
            })}
          </CardFan>
        )}
      </div>
    </div>
  ) : (
    <div className="uu-hand-area"><p className="uu-hand-empty">Spectating — no hand to show.</p></div>
  );

  return (
    <GameTable
      className="uu-table"
      top={top}
      board={board}
      side={side}
      dock={renderDock()}
      hand={hand}
      overlay={
        <>
          <FxLayer fx={fx} />
          <TurnCue active={isMyTurn && s.subPhase === 'draw' && s.phase === 'playing'} />
        </>
      }
    />
  );
}

// ============================================================================
// Pieces
// ============================================================================

function Hoof() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <path d="M8 34 Q4 18 12 9 Q20 2 28 9 Q36 18 32 34 L25 34 L24 24 Q20 21 16 24 L15 34 Z" fill="currentColor" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
    </svg>
  );
}

function Basket() {
  return (
    <svg className="uu-basket" viewBox="0 0 96 46" aria-hidden="true">
      <path d="M4 10 Q48 22 92 10 L82 42 Q48 48 14 42 Z" fill="#f6c6e8" stroke="#12061a" strokeWidth={2.6} strokeLinejoin="round" />
      <path d="M10 22 Q48 32 86 22 M14 32 Q48 40 82 32" fill="none" stroke="#12061a" strokeWidth={1.4} opacity={0.45} />
      <path d="M4 10 Q48 22 92 10" fill="none" stroke="#fff" strokeWidth={4} strokeDasharray="1 6" strokeLinecap="round" />
    </svg>
  );
}

/** A row of horns: one per unicorn needed, lit as the herd grows. */
function HornPips({ have, goal }: { have: number; goal: number }) {
  return (
    <span className="uu-pips" aria-label={`${have} of ${goal} unicorns`}>
      {Array.from({ length: goal }, (_, i) => {
        const on = i < have;
        return (
          <svg key={i} viewBox="0 0 11 17" className={on ? 'is-on' : undefined} aria-hidden="true">
            <path d="M1.5 16 L6 1 L9.5 16 Z" fill={on ? '#ffe27a' : 'rgba(255,240,251,0.12)'} stroke={on ? '#12061a' : 'rgba(255,240,251,0.35)'} strokeWidth={1.3} strokeLinejoin="round" />
            {on && <path d="M3 11.5 L8.5 10.5 M4 7 L7.8 6.4" stroke="#12061a" strokeWidth={0.9} />}
          </svg>
        );
      })}
    </span>
  );
}

function StatusChips({ state: s, id, inline }: { state: UuState; id: PlayerId; inline?: boolean }) {
  const chips: ReactNode[] = [];
  if (hasPandamonium(s, id)) chips.push(<Chip key="p" tone="danger" title="Unicorns are pandas: they don't count">Pandamonium</Chip>);
  if (isBlinded(s, id)) chips.push(<Chip key="b" tone="danger" title="Unicorn effects are switched off">Blinded</Chip>);
  if (hasDragonsBlessing(s, id)) chips.push(<Chip key="d" tone="good" title="Downgrades don't affect them">Dragon&apos;s Blessing</Chip>);
  if (hasNannyCam(s, id)) chips.push(<Chip key="n" title="Their hand is public">Nanny Cam</Chip>);
  if (chips.length === 0) return null;
  return inline ? <>{chips}</> : <div className="uu-plate-chips">{chips}</div>;
}

/** The card waiting out its Neigh window, every Neigh slapped on top. */
function Stage({ state: s }: { state: UuState }) {
  const p = s.pending!;
  const n = p.neighCards.length;
  const verdict = p.superNeighed ? { cls: 'is-super', text: 'Super Neighed — final' } : n % 2 === 1 ? { cls: 'is-neighed', text: n > 1 ? `Neighed ×${n}` : 'Neighed!' } : n > 0 ? { cls: 'is-live', text: 'Back on!' } : null;
  const into = p.card.type !== 'magic' && p.card.type !== 'instant' && p.targetPlayerId && p.targetPlayerId !== p.byPlayerId
    ? ` into ${nameOf(s, p.targetPlayerId)}'s Stable` : '';
  return (
    <>
      <div className="uu-stage-cards">
        <UuCardView card={p.card} size="md" />
        <div className="uu-neighs">
          {p.neighCards.map((c, i) => (
            <span key={c.id} style={{ '--nx': `${i * 16 - 16}px`, '--ny': `${14 - i * 8}px`, '--nr': `${(i % 2 ? 1 : -1) * (12 + i * 4)}deg` } as CSSProperties}>
              <UuCardView card={c} size="sm" inspect={false} />
            </span>
          ))}
        </div>
      </div>
      <div className="uu-stage-caption"><strong>{nameOf(s, p.byPlayerId)}</strong> played {p.card.name}{into}</div>
      {verdict && <div className={`uu-verdict ${verdict.cls}`}>{verdict.text}</div>}
    </>
  );
}

/** Answer a play: one button per distinct Instant you hold, plus "let it happen". */
function NeighDock({ state: s, me, mine, dispatch }: { state: UuState; me: PlayerId; mine: boolean; dispatch: (a: UuAction) => void }) {
  const p = s.pending!;
  const neighed = p.neighCards.length % 2 === 1;
  const able = canPlayNeigh(s, me);
  const kinds = new Map<string, UuCard[]>();
  for (const c of handOf(s, me).filter(isNeighCard)) kinds.set(c.kind, [...(kinds.get(c.kind) ?? []), c]);
  return (
    <Dock
      tone="react"
      eyebrow={mine ? 'Neigh window · your call' : 'Neigh window · you can jump in'}
      title={neighed ? "It's Neighed — Neigh it back?" : `Neigh ${p.card.name}?`}
      actions={
        <>
          {able && [...kinds.values()].map((cards) => (
            <UuCardView
              key={cards[0]!.kind}
              card={cards[0]!}
              size="sm"
              inspect={false}
              footnote={cards.length > 1 ? `×${cards.length}` : undefined}
              onClick={() => dispatch({ type: 'playNeigh', playerId: me, cardId: cards[0]!.id })}
            />
          ))}
          {mine && <button className="secondary" onClick={() => dispatch({ type: 'declineNeigh', playerId: me })}>Let it happen</button>}
        </>
      }
    >
      <strong>{nameOf(s, p.byPlayerId)}</strong> played <strong>{p.card.name}</strong>
      {p.neighCards.length > 0 && ` — ${p.neighCards.length} on the stack`}.
      {!able && kinds.size > 0 && ' You can\'t play Instants right now.'}
      {!mine && ' Or wait your turn to answer.'}
    </Dock>
  );
}

function SkipButton({ me, dispatch }: { me: PlayerId; dispatch: (a: UuAction) => void }) {
  return <button className="secondary" onClick={() => dispatch({ type: 'resolvePrompt', playerId: me, decline: true })}>Skip</button>;
}

/** Every prompt the reducer can ask the local player. Keyed by the prompt, so local picks reset. */
function PromptDock({ state: s, prompt, me, dispatch, handPicks, handNeeded }: {
  state: UuState;
  prompt: UuPrompt;
  me: PlayerId;
  dispatch: (a: UuAction) => void;
  handPicks: number[];
  handNeeded: number;
}) {
  const [oraclePick, setOraclePick] = useState<number | null>(null);
  const [swapRest, setSwapRest] = useState(false);
  const resolve = (extra: Omit<Extract<UuAction, { type: 'resolvePrompt' }>, 'type' | 'playerId'>) => dispatch({ type: 'resolvePrompt', playerId: me, ...extra });

  switch (prompt.kind) {
    case 'beginningTrigger':
      return (
        <Dock tone="turn" eyebrow="Start of your turn" title={prompt.sourceCard.name} actions={
          <>
            <UuCardView card={prompt.sourceCard} size="sm" />
            <button onClick={() => resolve({})}>Activate</button>
            {!prompt.mandatory && <SkipButton me={me} dispatch={dispatch} />}
          </>
        }>
          {prompt.sourceCard.text}
        </Dock>
      );
    case 'chooseCardsFromHand':
      return (
        <Dock tone="turn" eyebrow="Choose from your hand" title={prompt.reason} actions={
          <>
            <button disabled={handPicks.length !== handNeeded} onClick={() => resolve({ cardIds: handPicks })}>Confirm</button>
            {prompt.optional && <SkipButton me={me} dispatch={dispatch} />}
          </>
        }>
          {handNeeded === 0 ? 'Nothing in your hand fits.' : `Click ${handNeeded} card${handNeeded === 1 ? '' : 's'} in your hand — ${handPicks.length} picked.`}
        </Dock>
      );
    case 'chooseStableCard': {
      const valid = validStableTargets(s, prompt);
      const owners = [...new Set(valid.map((v) => v.ownerId))];
      const verb = { sacrifice: 'Sacrifice', destroy: 'Destroy', steal: 'Steal', bounce: 'Return', moveSource: 'Move', swapGive: 'Give', swapSteal: 'Take' }[prompt.mode];
      return (
        <Dock tone={prompt.mode === 'destroy' || prompt.mode === 'sacrifice' ? 'danger' : 'turn'} eyebrow={`${verb} a card`} title={prompt.reason} actions={prompt.optional ? <SkipButton me={me} dispatch={dispatch} /> : undefined}>
          {valid.length === 0 && 'No card qualifies.'}
          <div className="uu-choices">
            {owners.map((o) => (
              <div key={o} className="uu-owner-group">
                <span>{o === me ? 'Your Stable' : `${nameOf(s, o)}'s Stable`}</span>
                <div>
                  {valid.filter((v) => v.ownerId === o).map(({ card }) => (
                    <UuCardView key={card.id} card={card} size="sm" onClick={() => resolve({ targetCardId: card.id })} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Dock>
      );
    }
    case 'choosePlayer': {
      const candidates = s.seats.filter((x) => (prompt.allowSelf ? true : x.id !== me) && x.id !== prompt.movedFromPlayerId);
      return (
        <Dock tone="turn" eyebrow="Pick a player" title={prompt.reason} actions={
          <>
            {candidates.map((c) => (
              <button key={c.id} className={c.id === me ? 'secondary' : undefined} onClick={() => resolve({ targetPlayerId: c.id })}>
                {c.id === me ? 'Me' : c.name} · {unicornCount(s, c.id)}🦄 · {handOf(s, c.id).length} cards
              </button>
            ))}
            {prompt.optional && <SkipButton me={me} dispatch={dispatch} />}
          </>
        }>
          Click a name — or a player above.
        </Dock>
      );
    }
    case 'chooseFromOpponentHand':
      return (
        <Dock tone="turn" eyebrow={`${nameOf(s, prompt.targetPlayerId)}'s hand`} title={prompt.reason}>
          <div className="uu-choices">
            {handOf(s, prompt.targetPlayerId).map((c) => <UuCardView key={c.id} card={c} size="sm" onClick={() => resolve({ targetCardId: c.id })} />)}
          </div>
        </Dock>
      );
    case 'chooseFromPile': {
      const valid = validPileCards(s, prompt);
      const pile = prompt.pile === 'deck' ? 'the deck' : prompt.pile === 'nursery' ? 'the Nursery' : 'the discard pile';
      return (
        <Dock tone="turn" eyebrow={`Search ${pile}`} title={prompt.reason} actions={prompt.optional ? <SkipButton me={me} dispatch={dispatch} /> : undefined}>
          {valid.length === 0 && 'Nothing there fits.'}
          <div className="uu-choices is-scroll">
            {valid.map((c) => <UuCardView key={c.id} card={c} size="sm" onClick={() => resolve({ targetCardId: c.id })} />)}
          </div>
        </Dock>
      );
    }
    case 'oraclePeek': {
      const pickedId = oraclePick ?? prompt.cards[0]?.id ?? null;
      const rest = prompt.cards.filter((c) => c.id !== pickedId);
      const ordered = swapRest && rest.length === 2 ? [rest[1]!, rest[0]!] : rest;
      return (
        <Dock tone="turn" eyebrow="Unicorn Oracle" title="Keep one — stack the rest" actions={
          <button disabled={pickedId === null} onClick={() => pickedId !== null && resolve({ oraclePickId: pickedId, oracleTopOrder: ordered.map((c) => c.id) })}>Confirm</button>
        }>
          Click the card to add to your hand. The others go back on top of the deck in the order shown.
          <div className="uu-choices">
            {prompt.cards.map((c) => (
              <UuCardView key={c.id} card={c} size="sm" selected={pickedId === c.id} footnote={pickedId === c.id ? 'keep' : undefined} onClick={() => setOraclePick(c.id)} />
            ))}
          </div>
          {ordered.length === 2 && (
            <div className="uu-oracle-rest">
              <span>Back on the deck: <strong>1st {ordered[0]!.name}</strong>, then <strong>{ordered[1]!.name}</strong></span>
              <button className="secondary tiny" onClick={() => setSwapRest((v) => !v)}>Swap order</button>
            </div>
          )}
        </Dock>
      );
    }
    case 'blackKnightSave': {
      const protector = findCardInStable(s, me, prompt.blackKnightCardId);
      const name = protector?.name ?? 'Black Knight Unicorn';
      return (
        <Dock tone="danger" eyebrow="Your unicorn is about to be destroyed" title={`Sacrifice ${name} instead?`} actions={
          <>
            {protector && <UuCardView card={protector} size="sm" />}
            <button onClick={() => resolve({ decline: false })}>Sacrifice {name}</button>
            <button className="secondary" onClick={() => resolve({ decline: true })}>Let it go</button>
          </>
        }>
          {name} can take the hit for the unicorn under attack.
        </Dock>
      );
    }
    default:
      return null;
  }
}
