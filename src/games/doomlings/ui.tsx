// Doomlings — lobby config + in-game view, on the shared table kit.
//
// The table is a petri dish: an era timeline runs from the Birth of Life to
// World's End, the current Age sits beside it, and the middle of the board is
// your species — the creature your Trait Pile has grown into — with the pile
// itself. Opponents' species ride their plates. Hidden information: only
// `localPlayerId`'s hand is ever rendered; the trait deck and the age deck are
// shown as counts (and played Ages), never their order.

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import { seatName } from '@/core/state';
import {
  CardFan, Chip, Dock, ExpansionPicker, FxLayer, GameLog, GameOverPanel, GameTable, Panel, PlayerPlate,
  PlayerStrip, Tally, TurnCue, useChangeKey, useFx, usePulse,
} from '@/ui/kit';
import { GenePool, Species } from './art';
import { HUE } from './shapes';
import { AgeCard, MiniTrait, TraitBackCard, TraitCard } from './TraitCard';
import {
  canPlayTrait, computePlayerScore, effectiveGenePool, handOf, isCardIndestructible, isObjectiveFulfilled, tableauOf,
  validTraitPileTargets,
} from './reducer';
import type { DmAction, DmConfig, DmPrompt, DmState, DmTraitCard, DmTraitColor } from './types';
import { DM_EXPANSIONS, DM_SCORING_COLORS } from './types';

// ============================================================================
// Lobby
// ============================================================================

export function LobbyConfig({ config, onChange, readOnly }: {
  config: DmConfig;
  seats?: Seat[];
  onChange: (c: DmConfig) => void;
  readOnly?: boolean;
}) {
  const enabled = config.expansions ?? [];
  const toggle = (id: string) =>
    onChange({ ...config, expansions: enabled.includes(id) ? enabled.filter((x) => x !== id) : [...enabled, id] });
  return (
    <div className="game-config">
      <p className="lobby-hint" style={{ margin: 0 }}>
        Three Eras of Ages, one Catastrophe hiding in each. Play a trait a turn, grow your Gene Pool, and be the
        weirdest survivor when the third Catastrophe ends the world.
      </p>
      {!readOnly && (
        <div className="lobby-actions" style={{ marginTop: 0 }}>
          <button type="button" className="secondary tiny" onClick={() => onChange({ ...config, expansions: DM_EXPANSIONS.map((e) => e.id) })}>
            All expansions
          </button>
          <button type="button" className="secondary tiny" onClick={() => onChange({ ...config, expansions: [] })}>
            Base game only
          </button>
        </div>
      )}
      <ExpansionPicker expansions={DM_EXPANSIONS} enabled={enabled} onToggle={toggle} readOnly={readOnly} />
    </div>
  );
}

// ============================================================================
// Words
// ============================================================================

type HandPrompt = Extract<DmPrompt, { kind: 'chooseCardsFromHand' }>;

const HAND_EYEBROW: Record<HandPrompt['effectTag'], string> = {
  discard: 'Discard',
  stabilizeDiscard: 'Stabilize',
  giveToOpponent: 'Give a card',
  playExtraTrait: 'Bonus trait',
  eloquencePlay: "World's End · Eloquence",
  suppress: 'Suppress',
  discardToDraw3: 'Discard to draw 3',
};

function waitingPhrase(p: DmPrompt): string {
  switch (p.kind) {
    case 'chooseCardsFromHand':
      return ({
        discard: 'is discarding',
        stabilizeDiscard: 'is stabilizing their hand',
        giveToOpponent: 'is choosing a card to give away',
        playExtraTrait: 'may play another trait',
        eloquencePlay: 'may play one last trait',
        suppress: 'is suppressing cards',
        discardToDraw3: 'is deciding whether to discard for 3',
      } as const)[p.effectTag];
    case 'chooseTraitInPile':
      return ({
        steal: 'is picking a trait to steal',
        destroy: 'is picking a trait to destroy',
        sacrifice: 'must give up a trait',
        attach: 'is attaching a trait',
        suppress: 'is suppressing a trait',
      } as const)[p.mode];
    case 'chooseColor':
      return 'is choosing a colour';
    case 'chooseFromDiscard':
      return 'is rummaging through the discard pile';
  }
}

const COLOR_WORD: Record<DmTraitColor, string> = { red: 'Red', blue: 'Blue', green: 'Green', purple: 'Purple', colorless: 'Colorless' };

/** Why the reducer refused a card, in words (the decision itself stays canPlayTrait's). */
function whyNot(s: DmState, card: DmTraitCard): string {
  if (card.requireTraitCount) return `Needs ${card.requireTraitCount}+ traits in your pile.`;
  if (card.requireColor) return `Needs a ${COLOR_WORD[card.requireColor]} trait in your pile.`;
  if (card.dominant) return 'You can only keep two Dominants (or this Age forbids them).';
  return `Not this Age: ${s.currentAge.text}`;
}


// ============================================================================
// Game view
// ============================================================================

interface ViewProps {
  state: DmState;
  localPlayerId: PlayerId | null;
  dispatch: (action: DmAction) => void;
}

export function GameView({ state: s, localPlayerId: me, dispatch }: ViewProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [giveTo, setGiveTo] = useState<PlayerId | null>(null);
  const fx = useFx();
  const [shaking, shake] = usePulse(560);
  const [tinting, tint] = usePulse(2200);
  const tintKind = useRef<'doom' | 'end'>('doom');

  const seated = me != null && s.seats.some((x) => x.id === me);
  const myHand = seated ? handOf(s, me!) : [];
  const prompt = s.subPhase === 'awaitingPrompt' ? s.promptQueue[0] ?? null : null;
  const myPrompt = prompt && seated && prompt.playerId === me ? prompt : null;
  const isMyTurn = seated && s.subPhase === 'awaitingAction' && s.turnPlayerId === me && s.phase === 'playing';
  const opponents = s.seats.filter((x) => x.id !== me);
  const scores = useMemo(() => Object.fromEntries(s.seats.map((x) => [x.id, computePlayerScore(s, x.id)])), [s]);

  // A fresh decision starts with nothing picked.
  const decisionKey = `${s.subPhase}|${s.activePlayerId}|${s.promptQueue.length}|${prompt?.reason ?? ''}|${s.logSeq}`;
  useEffect(() => {
    setSelected([]);
    setGiveTo(null);
  }, [decisionKey]);

  const send = (a: DmAction) => {
    dispatch(a);
    setSelected([]);
  };

  // ---- what clicking a hand card does --------------------------------------------
  const handPrompt = myPrompt?.kind === 'chooseCardsFromHand' ? myPrompt : null;
  const handValid = handPrompt
    ? (handPrompt.effectTag === 'playExtraTrait' || handPrompt.effectTag === 'eloquencePlay'
      ? myHand.filter((c) => canPlayTrait(s, me!, c))
      : myHand)
    : [];
  const pickMax = handPrompt ? Math.min(handPrompt.count, handValid.length) : 0;

  function toggleHand(c: DmTraitCard) {
    if (isMyTurn) {
      setSelected((cur) => (cur[0] === c.id ? [] : [c.id]));
      return;
    }
    if (!handPrompt) return;
    setSelected((cur) => {
      if (cur.includes(c.id)) return cur.filter((x) => x !== c.id);
      if (pickMax === 1) return [c.id];
      return cur.length < pickMax ? [...cur, c.id] : cur;
    });
  }

  // ---- trait-pile targets ---------------------------------------------------------------
  const pilePrompt = myPrompt?.kind === 'chooseTraitInPile' ? myPrompt : null;
  const pileTargets = pilePrompt ? validTraitPileTargets(s, pilePrompt) : [];
  const targetIds = new Set(pileTargets.map((t) => t.card.id));
  const pickTrait = (cardId: number) => send({ type: 'resolvePrompt', playerId: me!, targetCardId: cardId });

  const giveTarget = handPrompt?.effectTag === 'giveToOpponent' ? (giveTo ?? opponents[0]?.id ?? null) : null;

  // ---- FX, from state transitions ---------------------------------------------------------
  const prev = useRef(s);
  useEffect(() => {
    const was = prev.current;
    prev.current = s;
    if (was === s) return;
    if (s.phase === 'gameOver' && was.phase !== 'gameOver') {
      tintKind.current = 'end';
      fx.stamp("WORLD'S END", 'danger');
      fx.burst([0.5, 0.38], '#ffd23f');
      fx.burst([0.3, 0.52], '#ff4f6d');
      fx.burst([0.7, 0.52], '#b56cff');
      tint();
      shake();
    } else if (s.catastrophesSeen > was.catastrophesSeen) {
      tintKind.current = 'doom';
      fx.stamp('CATASTROPHE!', 'danger');
      tint();
      shake();
    } else if (s.currentAge.id !== was.currentAge.id) {
      fx.toast(`A new Age dawns: ${s.currentAge.name.trim()}`, 'good');
    }
    const others = s.seats.filter((x) => x.id !== me);
    for (const seat of s.seats) {
      const before = new Set((was.tableaus[seat.id] ?? []).map((c) => c.id));
      const fresh = (s.tableaus[seat.id] ?? []).filter((c) => !before.has(c.id));
      if (!fresh.length) continue;
      const i = others.findIndex((o) => o.id === seat.id);
      const at: [number, number] = seat.id === me || i < 0 ? [0.12, 0.5] : [(i + 0.5) / Math.max(1, others.length) * 0.76, 0.07];
      fx.burst(at, HUE[fresh[0]!.color].core);
    }
    // Keyed on state alone: fx / tint / shake only schedule animations.
  }, [s]);

  // ---- opponents ----------------------------------------------------------------------------
  const top = (
    <PlayerStrip>
      {opponents.map((o) => {
        const tab = tableauOf(s, o.id);
        const sc = scores[o.id]!;
        const deciding = s.activePlayerId === o.id && s.subPhase === 'awaitingPrompt';
        const givePick = !!giveTarget;
        return (
          <PlayerPlate
            key={o.id}
            seat={o}
            active={s.phase === 'playing' && s.turnPlayerId === o.id}
            avatar={<Species traits={tab} seedKey={o.id} tint={o.color} size={50} label={`${o.name}'s species`} />}
            sub={<>{sc.total} pts · {handOf(s, o.id).length} in hand</>}
            targetable={givePick}
            selected={givePick && giveTarget === o.id}
            onClick={givePick ? () => setGiveTo(o.id) : undefined}
          >
            <div className="dm-plate-meta">
              <GenePool size={effectiveGenePool(s, o.id)} title={`${o.name}'s Gene Pool: ${effectiveGenePool(s, o.id)}`} />
              {deciding && <Chip tone="accent">Deciding…</Chip>}
              {(s.suppressedCount[o.id] ?? 0) > 0 && <Chip title="Suppressed cards (+1 each at World's End)">{s.suppressedCount[o.id]} tucked</Chip>}
            </div>
            <div className="dm-plate-traits">
              {tab.map((c) => (
                <MiniTrait
                  key={c.id}
                  card={c}
                  protectedCard={isCardIndestructible(tab, c)}
                  targetable={targetIds.has(c.id)}
                  onClick={targetIds.has(c.id) ? () => pickTrait(c.id) : undefined}
                />
              ))}
            </div>
          </PlayerPlate>
        );
      })}
    </PlayerStrip>
  );

  // ---- board ------------------------------------------------------------------------------------
  const ageKey = useChangeKey(s.currentAge.id);
  const focusId = seated ? me! : s.turnPlayerId;
  const discardTop = s.traitDiscard[s.traitDiscard.length - 1];
  const board = (
    <div className="dm-board">
      <div className="dm-era-row">
        <AgeCard key={s.currentAge.id} age={s.currentAge} wide className={ageKey ? 'is-arrived' : undefined} />
        <EraTimeline state={s} />
        <div className="dm-piles">
          <div className="dm-pile">
            {s.traitDeck.length ? <TraitBackCard size="sm" /> : <div className="dm-empty" />}
            <span><strong>{s.traitDeck.length}</strong> to draw</span>
          </div>
          <div className="dm-pile">
            {discardTop ? <TraitCard card={discardTop} size="sm" /> : <div className="dm-empty" />}
            <span><strong>{s.traitDiscard.length}</strong> discarded</span>
          </div>
        </div>
      </div>
      {s.phase === 'gameOver' ? (
        <Finale state={s} scores={scores} me={me} />
      ) : (
        <SpeciesPanel
          state={s}
          playerId={focusId}
          mine={seated}
          targets={pilePrompt?.scope === 'own' ? targetIds : null}
          onPick={pickTrait}
        />
      )}
    </div>
  );

  // ---- dock ---------------------------------------------------------------------------------------
  function renderDock(): ReactNode {
    if (s.phase === 'gameOver') {
      const winner = s.seats.find((x) => x.id === s.winnerId);
      return (
        <GameOverPanel
          seats={s.seats}
          finalScores={s.finalScores}
          winnerIds={s.winnerId ? [s.winnerId] : undefined}
          localPlayerId={me}
          headline={`${winner?.name ?? 'Nobody'} wins at World's End!`}
          detail="Face value, plus Drop of Life bonuses, plus every World's End effect."
          art={winner ? <Species traits={tableauOf(s, winner.id)} seedKey={winner.id} tint={winner.color} size={96} /> : undefined}
          ranks={false}
        />
      );
    }
    if (prompt && !myPrompt) {
      const who = s.seats.find((x) => x.id === prompt.playerId) ?? null;
      return <Dock tone="wait" who={who} title={`${who?.name ?? 'Someone'} ${waitingPhrase(prompt)}`}>{prompt.reason}</Dock>;
    }
    if (myPrompt) return renderPrompt(myPrompt);
    if (isMyTurn) {
      const card = myHand.find((c) => c.id === selected[0]);
      const stabilize = s.currentAge.ruleTag === 'stabilizeTo4' ? 4 : effectiveGenePool(s, me!);
      if (card) {
        return (
          <Dock
            tone="turn"
            eyebrow="Your turn"
            title={`Evolve ${card.name}?`}
            actions={
              <>
                <button onClick={() => send({ type: 'playTrait', playerId: me!, cardId: card.id })}>Play trait ▶</button>
                <button className="secondary" onClick={() => setSelected([])}>Clear</button>
              </>
            }
          >
            {card.text}
          </Dock>
        );
      }
      return (
        <Dock
          tone="turn"
          eyebrow="Your turn"
          title={myHand.length ? 'Play one trait — or pass' : 'Your hand is empty'}
          actions={
            <button className="secondary" onClick={() => send({ type: 'passTurn', playerId: me! })}>
              {myHand.length ? 'Pass & stabilize' : 'Draw 3 & pass'}
            </button>
          }
        >
          {myHand.length ? `Pick a trait in your hand; afterwards you stabilize to ${stabilize} cards.` : 'Draw three cards and end your turn.'}
        </Dock>
      );
    }
    const turnSeat = s.seats.find((x) => x.id === s.turnPlayerId) ?? null;
    return <Dock tone="wait" who={turnSeat} title={`${turnSeat?.name ?? 'Someone'} is evolving`} />;
  }

  function renderPrompt(p: DmPrompt): ReactNode {
    if (p.kind === 'chooseCardsFromHand') {
      const partial = p.optional && p.effectTag === 'suppress';
      const ok = partial ? selected.length >= 1 && selected.length <= pickMax : selected.length === pickMax;
      const upTo = partial ? `up to ${pickMax}` : String(pickMax);
      return (
        <Dock
          tone={p.effectTag === 'stabilizeDiscard' || p.effectTag === 'discard' ? 'danger' : 'turn'}
          eyebrow={HAND_EYEBROW[p.effectTag]}
          title={p.reason}
          actions={
            <>
              <button
                disabled={!ok}
                onClick={() => send({
                  type: 'resolvePrompt',
                  playerId: me!,
                  cardIds: selected,
                  targetPlayerId: p.effectTag === 'giveToOpponent' ? giveTarget ?? undefined : undefined,
                })}
              >
                Confirm ({selected.length}/{pickMax})
              </button>
              {p.optional && <button className="secondary" onClick={() => send({ type: 'resolvePrompt', playerId: me!, decline: true })}>Skip</button>}
            </>
          }
        >
          Select {upTo} card{pickMax === 1 && !partial ? '' : 's'} in your hand.
          {p.effectTag === 'giveToOpponent' && giveTarget && <> Giving to <strong>{seatName(s, giveTarget)}</strong>{opponents.length > 1 ? ' — click another plate to change.' : '.'}</>}
        </Dock>
      );
    }
    if (p.kind === 'chooseTraitInPile') {
      const skip = p.optional && <button className="secondary" onClick={() => send({ type: 'resolvePrompt', playerId: me!, decline: true })}>Skip</button>;
      if (p.scope === 'own') {
        return (
          <Dock tone={p.mode === 'sacrifice' ? 'danger' : 'turn'} eyebrow="Your Trait Pile" title={p.reason} actions={skip}>
            Click a glowing trait in your pile.
          </Dock>
        );
      }
      const owners = s.seats.filter((x) => pileTargets.some((t) => t.ownerId === x.id));
      return (
        <Dock tone="turn" eyebrow={p.mode === 'steal' ? 'Steal' : p.mode === 'destroy' ? 'Destroy' : 'Choose a trait'} title={p.reason} actions={skip}>
          <div className="dm-choices is-scroll">
            {owners.map((o) => (
              <div key={o.id} className="dm-owner">
                <span className="dm-owner-name"><Species traits={tableauOf(s, o.id)} seedKey={o.id} tint={o.color} size={22} />{o.name}</span>
                <div className="dm-choices" style={{ marginTop: 0 }}>
                  {pileTargets.filter((t) => t.ownerId === o.id).map(({ card }) => (
                    <TraitCard key={card.id} card={card} size="sm" onClick={() => pickTrait(card.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Dock>
      );
    }
    if (p.kind === 'chooseColor') {
      return (
        <Dock tone="turn" eyebrow="Choose a colour" title={p.reason} actions={
          <div className="dm-colors">
            {DM_SCORING_COLORS.map((col) => (
              <button
                key={col}
                className="dm-color-btn"
                style={{ '--swatch': HUE[col].core } as CSSProperties}
                disabled={p.effectTag === 'faithTo' && p.fromColor === col}
                onClick={() => send({ type: 'resolvePrompt', playerId: me!, chosenColor: col })}
              >
                <ColorCell color={col} />
                {COLOR_WORD[col]}
              </button>
            ))}
          </div>
        } />
      );
    }
    // chooseFromDiscard
    const candidates = p.mode === 'playDirectly'
      ? s.traitDiscard.filter((c) => !c.dominant && canPlayTrait(s, me!, c))
      : s.traitDiscard;
    return (
      <Dock tone="turn" eyebrow={p.mode === 'playDirectly' ? 'Play from the discard' : 'Take from the discard'} title={p.reason}>
        <div className="dm-choices is-scroll">
          {candidates.map((c) => <TraitCard key={c.id} card={c} size="sm" onClick={() => send({ type: 'resolvePrompt', playerId: me!, targetCardId: c.id })} />)}
        </div>
      </Dock>
    );
  }

  // ---- side ------------------------------------------------------------------------------------------
  const side = (
    <>
      <Panel title="Survival of the fittest">
        <div className="dm-scores">
          {[...s.seats]
            .sort((a, b) => scores[b.id]!.total - scores[a.id]!.total)
            .map((x) => {
              const sc = scores[x.id]!;
              return (
                <div key={x.id} className={`dm-score-row${s.turnPlayerId === x.id && s.phase === 'playing' ? ' is-turn' : ''}`} style={{ '--seat': x.color } as CSSProperties}>
                  <Species traits={tableauOf(s, x.id)} seedKey={x.id} tint={x.color} size={26} />
                  <span className="dm-score-name">
                    {x.name}{x.id === me ? ' (you)' : ''}
                    <small>{sc.faceValue} face · {sc.dropOfLifeBonus >= 0 ? '+' : ''}{sc.dropOfLifeBonus} drop{sc.worldsEndBonus ? ` · ${sc.worldsEndBonus > 0 ? '+' : ''}${sc.worldsEndBonus} end` : ''}</small>
                  </span>
                  <span className="dm-score-total"><Tally value={sc.total} /></span>
                </div>
              );
            })}
        </div>
      </Panel>
      <GameLog entries={s.log} seats={s.seats} title="Field notes" />
    </>
  );

  // ---- hand ----------------------------------------------------------------------------------------------
  const pickable = (c: DmTraitCard) =>
    isMyTurn ? canPlayTrait(s, me!, c) : handPrompt ? handValid.some((v) => v.id === c.id) : false;
  const hand = seated ? (
    <div className="dm-hand-area">
      <div className="dm-hand-head">
        <h4>Your hand ({myHand.length})</h4>
        <div className="dm-chips">
          <GenePool size={effectiveGenePool(s, me!)} />
          <Chip title="Hand size you stabilize to at the end of your turn">Gene Pool {effectiveGenePool(s, me!)}</Chip>
          {handPrompt && <Chip tone="accent">Pick {pickMax === 1 ? 'a card' : `${pickMax} cards`}</Chip>}
        </div>
      </div>
      <div className="dm-hand">
        {myHand.length === 0 ? (
          <p className="dm-hand-empty">No cards. A lean, mean organism.</p>
        ) : (
          <CardFan label="Your hand" maxTilt={8}>
            {myHand.map((c) => {
              const ok = pickable(c);
              const live = isMyTurn || !!handPrompt;
              return (
                <TraitCard
                  key={c.id}
                  card={c}
                  selected={selected.includes(c.id)}
                  disabled={live && !ok}
                  onClick={live && ok ? () => toggleHand(c) : undefined}
                  title={isMyTurn && !ok ? whyNot(s, c) : undefined}
                />
              );
            })}
          </CardFan>
        )}
      </div>
    </div>
  ) : (
    <div className="dm-hand-area">
      <p className="dm-hand-empty">Spectating — no hand to show.</p>
    </div>
  );

  return (
    <GameTable
      className={`dm-table${shaking ? ' is-shaking' : ''}`}
      top={top}
      board={board}
      side={side}
      dock={renderDock()}
      hand={hand}
      overlay={
        <>
          {tinting && <div className={`dm-tint${tintKind.current === 'end' ? ' is-end' : ''}`} />}
          <FxLayer fx={fx} />
          <TurnCue active={isMyTurn}>Evolve!</TurnCue>
        </>
      }
    />
  );
}

// ============================================================================
// Pieces
// ============================================================================

function ColorCell({ color }: { color: DmTraitColor }) {
  const h = HUE[color];
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true">
      <circle cx={17} cy={17} r={14} fill={h.core} stroke={h.glow} strokeWidth={2} />
      <circle cx={19} cy={19} r={5} fill={h.deep} />
      <path d="M8 12 Q11 6 18 6" stroke="#fff" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.5} />
    </svg>
  );
}

/** Birth of Life → three Eras of four → World's End. Played slots show what came up; future ones stay secret. */
function EraTimeline({ state: s }: { state: DmState }) {
  const played = s.agesPlayed;
  const slots = played.length - 1 + s.ageDeck.length;
  const eras = Math.max(1, Math.ceil(slots / 4));
  const now = played.length - 1;
  const ended = s.phase === 'gameOver';
  const node = (i: number) => {
    const a = played[i];
    const cls = `dm-node${a ? (a.kind === 'catastrophe' ? ' is-cat' : ' is-age') : ''}${i === now && !ended ? ' is-now' : ''}`;
    return <span key={`n${i}`} className={cls} title={a ? a.name.trim() : 'Still to come'}>{a ? (a.kind === 'catastrophe' ? '!' : '') : '?'}</span>;
  };
  const items: ReactNode[] = [<span key="birth" className={`dm-node is-birth${now === 0 && !ended ? ' is-now' : ''}`} title="The Birth of Life" />];
  for (let e = 0; e < eras; e++) {
    items.push(<span key={`g${e}`} className="dm-era-gap" />);
    for (let k = 0; k < 4; k++) {
      const i = 1 + e * 4 + k;
      if (i > slots) break;
      if (k) items.push(<span key={`l${i}`} className={`dm-link${i <= now ? ' is-done' : ''}`} />);
      items.push(node(i));
    }
  }
  items.push(<span key="gend" className="dm-era-gap" />);
  items.push(
    <span key="end" className={`dm-node is-end${ended ? ' is-reached' : ''}`} title="World's End">
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 1 L12 7 L18 5 L14 10 L19 14 L12.5 13.5 L11 19 L8.5 13.5 L2 15 L6 10 L1 6 L7.5 7 Z" fill="currentColor" />
      </svg>
    </span>,
  );
  return (
    <div className="dm-timeline">
      <div className="dm-timeline-head">
        <span>{ended ? "World's End" : `Age ${now + 1} of ${slots + 1} · ${s.ageDeck.length} to come`}</span>
        <span className="dm-dooms" title={`${s.catastrophesSeen} of 3 Catastrophes`}>
          {[0, 1, 2].map((i) => <span key={i} className={`dm-doom${i < s.catastrophesSeen ? ' is-hit' : ''}`} />)}
        </span>
      </div>
      <div className="dm-track">{items}</div>
      <div className="dm-era-labels">
        <span>Birth</span>
        {Array.from({ length: eras }, (_, e) => <span key={e}>Era {['I', 'II', 'III', 'IV', 'V'][e] ?? e + 1}</span>)}
        <span>World&apos;s End</span>
      </div>
    </div>
  );
}

/** Your creature and the Trait Pile it grew from. `targets` makes pile cards pickable. */
function SpeciesPanel({ state: s, playerId, mine, targets, onPick }: {
  state: DmState;
  playerId: PlayerId;
  mine: boolean;
  targets: Set<number> | null;
  onPick: (cardId: number) => void;
}) {
  const seat = s.seats.find((x) => x.id === playerId)!;
  const tab = tableauOf(s, playerId);
  const sc = computePlayerScore(s, playerId);
  const grew = useChangeKey(tab.length);
  const obj = s.objectives[playerId];
  const objDone = obj ? isObjectiveFulfilled(s, playerId, obj) : false;
  const hosts = tab.filter((c) => !(c.isAttachment && c.attachedToId !== undefined && tab.some((h) => h.id === c.attachedToId)));
  return (
    <section className="dm-species-panel" style={{ '--seat': seat.color } as CSSProperties}>
      <div className="dm-species-who">
        <span key={grew} className={grew ? 'dm-species is-grew' : undefined} style={{ display: 'block' }}>
          <Species traits={tab} seedKey={seat.id} tint={seat.color} size={112} label={`${seat.name}'s species`} />
        </span>
        <span className="dm-species-name">{mine ? 'Your species' : `${seat.name}'s species`}</span>
        <span className="dm-species-stats">
          <Chip title="Gene Pool: your hand size">GP {effectiveGenePool(s, playerId)}</Chip>
          {(s.suppressedCount[playerId] ?? 0) > 0 && <Chip title="Suppressed cards: +1 each at World's End">{s.suppressedCount[playerId]} tucked</Chip>}
          {s.denialArmed[playerId] && <Chip tone="good" title="Ignores the next Catastrophe">Denial armed</Chip>}
        </span>
      </div>
      <div className="dm-species-main">
        <div className="dm-species-head">
          <h4>Trait Pile · {tab.length} trait{tab.length === 1 ? '' : 's'}</h4>
          <span className="dm-score">
            <Tally value={sc.total} />
            <small>{sc.faceValue} face {sc.dropOfLifeBonus >= 0 ? '+' : '−'} {Math.abs(sc.dropOfLifeBonus)} drop of life{sc.worldsEndBonus ? ` ${sc.worldsEndBonus > 0 ? '+' : '−'} ${Math.abs(sc.worldsEndBonus)} world's end` : ''}</small>
          </span>
        </div>
        {obj && (
          <span className={`dm-objective${objDone ? ' is-done' : ''}`} title={obj.text}>
            {obj.kind === 'treasure' ? 'Treasure' : 'Meaning of Life'}: <strong>{obj.name}</strong> · {objDone ? `+${obj.points} secured` : `+${obj.points} if: ${obj.text}`}
          </span>
        )}
        <div className="dm-pile-row">
          {tab.length === 0 && <span className="dm-pile-empty">{mine ? 'Nothing yet — play a trait and watch it grow.' : 'No traits yet.'}</span>}
          {hosts.map((c) => {
            const attached = tab.filter((a) => a.attachedToId === c.id);
            const pick = (card: DmTraitCard) => targets?.has(card.id) ? () => onPick(card.id) : undefined;
            const cardEl = (card: DmTraitCard, foot?: string) => (
              <TraitCard
                key={card.id}
                card={card}
                size="sm"
                className={`dm-pile-card${targets?.has(card.id) ? ' is-target' : ''}`}
                protectedCard={isCardIndestructible(tab, card)}
                onClick={pick(card)}
                foot={foot}
              />
            );
            return attached.length ? (
              <div key={c.id} className="dm-host">
                {cardEl(c)}
                {attached.map((a) => cardEl(a, 'attached'))}
              </div>
            ) : cardEl(c);
          })}
        </div>
      </div>
    </section>
  );
}

/** World's End: every species lined up with how its score came together. */
function Finale({ state: s, scores, me }: {
  state: DmState;
  scores: Record<PlayerId, ReturnType<typeof computePlayerScore>>;
  me: PlayerId | null;
}) {
  const order = [...s.seats].sort((a, b) => (s.finalScores?.[b.id] ?? scores[b.id]!.total) - (s.finalScores?.[a.id] ?? scores[a.id]!.total));
  return (
    <div className="dm-finale">
      {order.map((x, i) => {
        const sc = scores[x.id]!;
        return (
          <div key={x.id} className={`dm-finalist${x.id === s.winnerId ? ' is-winner' : ''}`} style={{ '--i': i } as CSSProperties}>
            <Species traits={tableauOf(s, x.id)} seedKey={x.id} tint={x.color} size={i === 0 ? 120 : 100} />
            <span className="dm-species-name">{x.name}{x.id === me ? ' (you)' : ''}</span>
            <div className="dm-break">
              <span>{tableauOf(s, x.id).length} traits</span><b>{sc.faceValue}</b>
              <span>Drop of Life</span><b>{sc.dropOfLifeBonus >= 0 ? '+' : ''}{sc.dropOfLifeBonus}</b>
              <span>World&apos;s End</span><b>{sc.worldsEndBonus >= 0 ? '+' : ''}{sc.worldsEndBonus}</b>
              <span className="is-total">Total</span><b className="is-total">{s.finalScores?.[x.id] ?? sc.total}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
}
