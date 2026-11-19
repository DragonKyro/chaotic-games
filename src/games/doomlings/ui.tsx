// Doomlings — lobby config + in-game view, on the shared table kit.
//
// The table is a petri dish: an era timeline runs from the Birth of Life to
// World's End, the current Age sits beside it, and the middle of the board is
// your species — the creature your Trait Pile has grown into — with the pile
// itself. Opponents' species ride their plates. Hidden information: only
// `localPlayerId`'s hand is ever rendered (plus cards a prompt shows that
// player, e.g. Nosy); the decks are counts, and the next age is shown only to
// a player who may legitimately see it (Awakening, The Third Eye).

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
  bannedColors, canPlayTwo, computePlayerScore, endOfTurnMode, endOfTurnTarget, findCard, genePoolOf, handOf, outOfTurnPlays,
  peekedHand, playableFromHand, playBlock, previewLastAges, previewNextAge, tableauOf, turnFxOf, umbleboosTargets, usableCards,
  visibleDeckTop,
} from './reducer';
import type { DmAction, DmConfig, DmPrompt, DmState, DmTraitCard, DmTraitColor } from './types';
import { DM_EXPANSIONS, dmExpansionLockedReason } from './types';

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
  const toggle = (id: string) => {
    if (dmExpansionLockedReason(id)) return;
    onChange({ ...config, expansions: enabled.includes(id) ? enabled.filter((x) => x !== id) : [...enabled, id] });
  };
  return (
    <div className="game-config">
      <p className="lobby-hint" style={{ margin: 0 }}>
        Doomlings Classic (2nd edition): three Eras of Ages, one Catastrophe hiding in each. Play a trait a turn,
        stabilize to your Gene Pool, and be the weirdest survivor when the third Catastrophe ends the world.
      </p>
      <ExpansionPicker
        expansions={DM_EXPANSIONS}
        enabled={enabled}
        onToggle={toggle}
        readOnly={readOnly}
        lockedReason={dmExpansionLockedReason}
        title="Expansions (shuffled into the Classic decks)"
      />
    </div>
  );
}

// ============================================================================
// Words
// ============================================================================

const COLOR_WORD: Record<DmTraitColor, string> = { red: 'Red', blue: 'Blue', green: 'Green', purple: 'Purple', colorless: 'Colorless' };

/** Decisions whose wording would tell onlookers what is in the chooser's hand. */
const PRIVATE_TASKS: ReadonlySet<DmPrompt['task']['t']> = new Set([
  'parasiticWindow', 'preventWindow', 'late', 'sneaky', 'alienTerraform', 'extraPlay', 'stabilizeChoice',
  // Overlush reactions (their wording would say what the chooser holds)
  'removalWindow', 'elusive', 'muse', 'sleepyWindow', 'procrastination', 'snapTrap',
]);

/** Someone else's decision, in words that don't leak what they hold. */
function waitingTitle(s: DmState, p: DmPrompt): string {
  const who = seatName(s, p.playerId);
  return PRIVATE_TASKS.has(p.task.t) ? `${who} is thinking…` : `${who} is deciding`;
}

function waitingDetail(p: DmPrompt): string | undefined {
  return PRIVATE_TASKS.has(p.task.t) ? undefined : p.title;
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
  const fx = useFx();
  const [shaking, shake] = usePulse(560);
  const [tinting, tint] = usePulse(2200);
  const tintKind = useRef<'doom' | 'end'>('doom');

  const seated = me != null && s.seats.some((x) => x.id === me);
  const myHand = seated ? handOf(s, me!) : [];
  const prompt = s.subPhase === 'awaitingPrompt' ? s.prompt : null;
  const myPrompt = prompt && seated && prompt.playerId === me ? prompt : null;
  const isMyTurn = seated && s.subPhase === 'awaitingAction' && s.turnPlayerId === me && s.phase === 'playing';
  const opponents = s.seats.filter((x) => x.id !== me);
  // Only what this viewer may know: someone else's hand-content bonuses stay hidden until the end.
  const viewer = seated ? me : null;
  const scores = useMemo(() => Object.fromEntries(s.seats.map((x) => [x.id, computePlayerScore(s, x.id, viewer)])), [s, viewer]);
  const locked = s.currentAge.ruleTag === 'protectTraitPiles';

  // A fresh decision starts with nothing picked.
  const decisionKey = `${s.subPhase}|${s.activePlayerId}|${prompt?.title ?? ''}|${s.logSeq}`;
  useEffect(() => {
    setSelected([]);
  }, [decisionKey]);

  const send = (a: DmAction) => {
    dispatch(a);
    setSelected([]);
  };
  const answer = (rest: Omit<Extract<DmAction, { type: 'resolvePrompt' }>, 'type' | 'playerId'>) =>
    send({ type: 'resolvePrompt', playerId: me!, ...rest });

  // ---- what clicking a hand card does --------------------------------------------
  const handPrompt = myPrompt?.kind === 'cards' && myPrompt.from === 'hand' ? myPrompt : null;
  const handEligible = new Set(handPrompt?.cardIds ?? []);
  const playable = isMyTurn ? playableFromHand(s, me!) : [];
  const sneaks = isMyTurn ? outOfTurnPlays(s, me!) : [];
  const usable = isMyTurn ? usableCards(s, me!) : [];

  function toggleHand(c: DmTraitCard) {
    if (isMyTurn) {
      setSelected((cur) => (cur[0] === c.id ? [] : [c.id]));
      return;
    }
    if (!handPrompt) return;
    setSelected((cur) => {
      if (cur.includes(c.id)) return cur.filter((x) => x !== c.id);
      if (handPrompt.max === 1) return [c.id];
      return cur.length < handPrompt.max ? [...cur, c.id] : cur;
    });
  }

  // ---- trait-pile targets ---------------------------------------------------------------
  const pilePrompt = myPrompt?.kind === 'trait' ? myPrompt : null;
  const targetIds = new Set(pilePrompt?.targets.map((t) => t.cardId) ?? []);
  const pickTrait = (cardId: number) => answer({ targetCardId: cardId });
  const playerPrompt = myPrompt?.kind === 'player' ? myPrompt : null;

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
        const pickable = !!playerPrompt?.playerIds.includes(o.id);
        return (
          <PlayerPlate
            key={o.id}
            seat={o}
            active={s.phase === 'playing' && s.turnPlayerId === o.id}
            avatar={<Species traits={tab} seedKey={o.id} tint={o.color} size={50} label={`${o.name}'s species`} />}
            sub={<>{sc.total}{sc.hiddenBonus ? '+?' : ''} pts · {handOf(s, o.id).length} in hand</>}
            targetable={pickable}
            onClick={pickable ? () => answer({ targetPlayerId: o.id }) : undefined}
          >
            <div className="dm-plate-meta">
              <GenePool size={genePoolOf(s, o.id)} title={`${o.name}'s Gene Pool: ${genePoolOf(s, o.id)}`} />
              {deciding && <Chip tone="accent">Deciding…</Chip>}
              {unspentDenial(s, o.id) && <Chip tone="good" title="Ignores the next catastrophe">Denial ready</Chip>}
            </div>
            <div className="dm-plate-traits">
              {tab.map((c) => (
                <MiniTrait
                  key={c.id}
                  card={c}
                  protectedCard={c.dominant || locked}
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
  const nextAge = previewNextAge(s, seated ? me : null);
  const lastAges = previewLastAges(s, seated ? me : null);
  const deckTop = visibleDeckTop(s);
  const peekOwner = peekedHand(s, seated ? me : null);
  const revealed = s.revealed.map((r) => ({ ...r, card: findCard(s, r.cardId) })).filter((r) => r.card);
  const board = (
    <div className="dm-board">
      <div className="dm-era-row">
        <AgeCard key={s.currentAge.id} age={s.currentAge} wide className={ageKey ? 'is-arrived' : undefined} />
        <EraTimeline state={s} />
        <div className="dm-piles">
          <div className="dm-pile" title={deckTop ? `${s.currentAge.name}: the deck is flipped — its next card is face up` : undefined}>
            {deckTop ? <TraitCard card={deckTop} size="sm" /> : s.traitDeck.length ? <TraitBackCard size="sm" /> : <div className="dm-empty" />}
            <span><strong>{s.traitDeck.length}</strong> to draw</span>
          </div>
          <div className="dm-pile">
            {discardTop ? <TraitCard card={discardTop} size="sm" /> : <div className="dm-empty" />}
            <span><strong>{s.traitDiscard.length}</strong> discarded</span>
          </div>
        </div>
      </div>
      {nextAge && (
        <div className="dm-objective" title="Only you can see this">
          You can see the next age: <strong>{nextAge.name.trim()}</strong> — {nextAge.text}
          {nextAge.worldsEndText ? ` World's End: ${nextAge.worldsEndText}` : ''}
        </div>
      )}
      {lastAges.length > 0 && (
        <div className="dm-objective" title="Only you can see this">
          The last ages in the deck (Sapient): {lastAges.map((a, i) => <span key={a.id}>{i ? ', ' : ''}<strong>{a.name.trim()}</strong></span>)}
        </div>
      )}
      {peekOwner && (
        <div className="dm-objective" title="Only you can see this">
          {seatName(s, peekOwner)}&apos;s hand (Eyestalks):{' '}
          {handOf(s, peekOwner).length ? handOf(s, peekOwner).map((c, i) => <span key={c.id}>{i ? ', ' : ''}<strong>{c.name}</strong></span>) : 'empty'}
        </div>
      )}
      {revealed.length > 0 && (
        <div className="dm-objective">
          Revealed by Clever:{' '}
          {revealed.map((r, i) => (
            <span key={r.cardId}>{i ? ', ' : ''}<strong>{r.card!.name}</strong> ({seatName(s, r.ownerId)})</span>
          ))}
        </div>
      )}
      {s.phase === 'gameOver' ? (
        <Finale state={s} scores={scores} me={me} />
      ) : (
        <SpeciesPanel
          state={s}
          playerId={focusId}
          viewer={viewer}
          mine={seated}
          targets={pilePrompt ? targetIds : null}
          onPick={pickTrait}
        />
      )}
    </div>
  );

  // ---- dock ---------------------------------------------------------------------------------------
  function renderDock(): ReactNode {
    if (s.phase === 'gameOver') {
      const winners = s.seats.filter((x) => s.winnerIds.includes(x.id));
      const first = winners[0];
      return (
        <GameOverPanel
          seats={s.seats}
          finalScores={s.finalScores}
          winnerIds={s.winnerIds}
          localPlayerId={me}
          headline={winners.length > 1 ? `${winners.map((w) => w.name).join(' & ')} share the win at World's End!` : `${first?.name ?? 'Nobody'} wins at World's End!`}
          detail="Face value, plus Drop of Life bonuses, plus the World's End effects."
          art={first ? <Species traits={tableauOf(s, first.id)} seedKey={first.id} tint={first.color} size={96} /> : undefined}
          ranks={false}
        />
      );
    }
    if (prompt && !myPrompt) {
      const who = s.seats.find((x) => x.id === prompt.playerId) ?? null;
      return <Dock tone="wait" who={who} title={waitingTitle(s, prompt)}>{waitingDetail(prompt)}</Dock>;
    }
    if (myPrompt) return renderPrompt(myPrompt);
    if (isMyTurn) return renderTurn();
    const turnSeat = s.seats.find((x) => x.id === s.turnPlayerId) ?? null;
    return <Dock tone="wait" who={turnSeat} title={`${turnSeat?.name ?? 'Someone'} is evolving`} />;
  }

  function renderTurn(): ReactNode {
    const card = myHand.find((c) => c.id === selected[0]);
    const stab = endOfTurnTarget(s, me!);
    if (card && playable.some((c) => c.id === card.id)) {
      const sneak = sneaks.some((c) => c.id === card.id);
      const intoOpponent = sneak && card.kind === 'self-awareness';
      const umbleboos = sneak && card.kind === 'umbleboos';
      return (
        <Dock
          tone="turn"
          eyebrow="Your turn"
          title={`Evolve ${card.name}?`}
          actions={
            <>
              <button onClick={() => send({ type: 'playTrait', playerId: me!, cardId: card.id })}>Play into my pile ▶</button>
              {intoOpponent && opponents.map((o) => (
                <button key={o.id} className="secondary" onClick={() => send({ type: 'playOutOfTurn', playerId: me!, cardId: card.id, targetPlayerId: o.id })}>
                  Slip into {o.name}'s pile
                </button>
              ))}
              {umbleboos && umbleboosTargets(s).map((id) => (
                <button key={id} className="secondary" onClick={() => send({ type: 'playOutOfTurn', playerId: me!, cardId: card.id, targetPlayerId: id })}>
                  Slip into {id === me ? 'my' : `${seatName(s, id)}'s`} pile (Gene Pool {genePoolOf(s, id)})
                </button>
              ))}
              {sneak && !intoOpponent && !umbleboos && (
                <button className="secondary" onClick={() => send({ type: 'playOutOfTurn', playerId: me!, cardId: card.id, targetPlayerId: me! })}>
                  Play it now as a free play
                </button>
              )}
              {canPlayTwo(s, me!) && (
                <button className="secondary" onClick={() => send({ type: 'playTrait', playerId: me!, cardId: card.id, twoIgnoringActions: true })}>
                  Play it and a 2nd trait (Actions ignored)
                </button>
              )}
              <button className="secondary" onClick={() => setSelected([])}>Clear</button>
            </>
          }
        >
          {card.text || 'No effect.'}
          {intoOpponent && ' Slipping it into an opponent’s pile doesn’t use up your turn.'}
          {sneak && !intoOpponent && ' Played “at any time”, it doesn’t use up your turn.'}
        </Dock>
      );
    }
    const nimble = card && usable.find((c) => c.id === card.id);
    if (nimble) {
      return (
        <Dock
          tone="turn"
          eyebrow="Your turn"
          title={`Discard ${nimble.name}?`}
          actions={
            <>
              <button onClick={() => send({ type: 'useCard', playerId: me!, cardId: nimble.id })}>Discard it: discard a trait from my pile</button>
              <button className="secondary" onClick={() => setSelected([])}>Clear</button>
            </>
          }
        >
          {nimble.text} It doesn’t use up your turn.
        </Dock>
      );
    }
    const pileUses = usable.filter((c) => tableauOf(s, me!).some((x) => x.id === c.id));
    const useButtons = pileUses.map((c) => (
      <button key={c.id} className="secondary" onClick={() => send({ type: 'useCard', playerId: me!, cardId: c.id })}>
        Discard {c.name} from my pile: play another trait
      </button>
    ));
    if (!playable.length) {
      return (
        <Dock
          tone="turn"
          eyebrow="Your turn"
          title={myHand.length ? 'You can’t play any trait — your turn is skipped' : 'Your hand is empty — your turn is skipped'}
          actions={
            myHand.length ? (
              <>
                <button onClick={() => send({ type: 'passTurn', playerId: me! })}>Skip my turn</button>
                <button className="secondary" onClick={() => send({ type: 'passTurn', playerId: me!, discardHand: true })}>Discard my hand, draw 3</button>
              </>
            ) : (
              <button onClick={() => send({ type: 'passTurn', playerId: me! })}>Draw 5 and skip</button>
            )
          }
        >
          You don’t stabilize this turn.
        </Dock>
      );
    }
    const ending = endOfTurnMode(s, me!);
    const after = ending === 'none' ? 'you don’t stabilize this round' : ending === 'draw2' ? 'you draw 2 instead of stabilizing' : `you stabilize to ${stab} cards`;
    return (
      <Dock tone="turn" eyebrow="Your turn" title="Play one trait" actions={useButtons.length ? <>{useButtons}</> : undefined}>
        You must play a trait if you can. Pick one in your hand; afterwards {after}.
        {canPlayTwo(s, me!) && ' The Legend of Mokoko Village: with Heroic you may play 2 traits, ignoring their Actions.'}
      </Dock>
    );
  }

  function declineButton(p: DmPrompt) {
    if (!p.optional) return null;
    return <button className="secondary" onClick={() => answer({ decline: true })}>{p.declineLabel ?? 'Skip'}</button>;
  }

  function renderPrompt(p: DmPrompt): ReactNode {
    const reacting = p.task.t === 'parasiticWindow' || p.task.t === 'preventWindow';
    const tone = reacting ? 'react' : 'turn';
    switch (p.kind) {
      case 'cards': {
        if (p.from === 'shown') {
          const cards = p.cardIds.map((id) => findCard(s, id)).filter((c): c is DmTraitCard => !!c);
          return (
            <Dock tone={tone} eyebrow="Choose a card" title={p.title} actions={declineButton(p)}>
              {p.detail}
              <div className="dm-choices is-scroll">
                {cards.map((c) => <TraitCard key={c.id} card={c} size="sm" onClick={() => answer({ cardIds: [c.id] })} />)}
              </div>
            </Dock>
          );
        }
        const ok = selected.length >= p.min && selected.length <= p.max && selected.every((id) => handEligible.has(id));
        const range = p.min === p.max ? `${p.min}` : `${p.min}–${p.max}`;
        return (
          <Dock
            tone={p.task.t === 'stabilize' || p.task.t === 'discardFromHand' ? 'danger' : tone}
            eyebrow="Your hand"
            title={p.title}
            actions={
              <>
                <button disabled={!ok} onClick={() => answer({ cardIds: selected })}>Confirm ({selected.length}/{p.max})</button>
                {declineButton(p)}
              </>
            }
          >
            {p.detail ? `${p.detail} ` : ''}Select {range} card{p.max === 1 ? '' : 's'} in your hand (glowing cards are eligible).
          </Dock>
        );
      }
      case 'trait': {
        const owners = s.seats.filter((x) => p.targets.some((t) => t.ownerId === x.id));
        return (
          <Dock tone={tone} eyebrow="Choose a trait" title={p.title} actions={declineButton(p)}>
            {p.detail}
            <div className="dm-choices is-scroll">
              {owners.map((o) => (
                <div key={o.id} className="dm-owner">
                  <span className="dm-owner-name"><Species traits={tableauOf(s, o.id)} seedKey={o.id} tint={o.color} size={22} />{o.id === me ? 'Your pile' : o.name}</span>
                  <div className="dm-choices" style={{ marginTop: 0 }}>
                    {p.targets.filter((t) => t.ownerId === o.id).map(({ cardId }) => {
                      const card = findCard(s, cardId);
                      return card ? <TraitCard key={cardId} card={card} size="sm" onClick={() => pickTrait(cardId)} /> : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Dock>
        );
      }
      case 'player':
        return (
          <Dock tone={tone} eyebrow="Choose a player" title={p.title} actions={
            <>
              {p.playerIds.map((id) => (
                <button key={id} onClick={() => answer({ targetPlayerId: id })}>
                  {seatName(s, id)} ({handOf(s, id).length} in hand · {scores[id]!.total} pts)
                </button>
              ))}
              {declineButton(p)}
            </>
          }>
            {p.detail}
          </Dock>
        );
      case 'color':
        return (
          <Dock tone={tone} eyebrow="Choose a colour" title={p.title} actions={
            <div className="dm-colors">
              {p.colors.map((col) => (
                <button
                  key={col}
                  className="dm-color-btn"
                  style={{ '--swatch': HUE[col].core } as CSSProperties}
                  onClick={() => answer({ chosenColor: col })}
                >
                  <ColorCell color={col} />
                  {COLOR_WORD[col]}
                </button>
              ))}
              {declineButton(p)}
            </div>
          }>
            {p.detail}
          </Dock>
        );
      case 'option':
        return (
          <Dock tone={tone} eyebrow={reacting ? 'Out of turn' : 'Your choice'} title={p.title} actions={
            <>
              {p.options.map((o, i) => (
                <button key={o.id} className={i === 0 ? undefined : 'secondary'} onClick={() => answer({ optionId: o.id })}>{o.label}</button>
              ))}
            </>
          }>
            {p.detail}
          </Dock>
        );
    }
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
                    <small>{sc.faceValue} face · {sc.dropOfLifeBonus >= 0 ? '+' : ''}{sc.dropOfLifeBonus} drop{sc.classBonus ? ` · +${sc.classBonus} class` : ''}{sc.suppressed ? ` · +${sc.suppressed} hidden` : ''}{sc.worldsEndBonus ? ` · ${sc.worldsEndBonus > 0 ? '+' : ''}${sc.worldsEndBonus} end` : ''}</small>
                  </span>
                  <span className="dm-score-total" title={sc.hiddenBonus ? 'Plus a bonus that depends on cards in their hand' : undefined}><Tally value={sc.hiddenBonus ? `${sc.total}+?` : sc.total} /></span>
                </div>
              );
            })}
        </div>
      </Panel>
      <GameLog entries={s.log} seats={s.seats} title="Field notes" />
    </>
  );

  // ---- hand ----------------------------------------------------------------------------------------------
  const pickable = (c: DmTraitCard) => (isMyTurn ? playable.some((x) => x.id === c.id) || usable.some((x) => x.id === c.id) : handPrompt ? handEligible.has(c.id) : false);
  const hand = seated ? (
    <div className="dm-hand-area">
      <div className="dm-hand-head">
        <h4>Your hand ({myHand.length})</h4>
        <div className="dm-chips">
          <GenePool size={genePoolOf(s, me!)} />
          <EndOfTurnChip state={s} me={me!} />
          {bannedColors(s, me!).map((col) => (
            <Chip key={col} tone="danger" title="An opponent's Brainy: lasts until the end of this turn">No {col} this turn</Chip>
          ))}
          {handPrompt && <Chip tone="accent">Pick {handPrompt.min === handPrompt.max ? handPrompt.min : `${handPrompt.min}–${handPrompt.max}`}</Chip>}
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
                  title={isMyTurn && !ok ? playBlock(s, me!, c)?.why : undefined}
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

/** How the local player's turn will end: stabilize to N, draw 2 (Guanine Crystals) or not at all (Still Water). */
function EndOfTurnChip({ state: s, me }: { state: DmState; me: PlayerId }) {
  const mode = endOfTurnMode(s, me);
  if (mode === 'none') return <Chip tone="accent" title={`${s.currentAge.name}: nobody stabilizes at the end of their turn this round`}>No stabilizing</Chip>;
  if (mode === 'draw2' && s.turnPlayerId === me) return <Chip tone="accent" title="Guanine Crystals: draw 2 instead of stabilizing this turn">Draw 2 to end</Chip>;
  const harbor = s.turnPlayerId === me && turnFxOf(s, me)?.stabilizeTo;
  return <Chip title={harbor ? 'Harboring: stabilize to 6 at the end of this turn' : 'Hand size you stabilize to at the end of your turn'}>Stabilize to {endOfTurnTarget(s, me)}</Chip>;
}

function unspentDenial(s: DmState, p: PlayerId): boolean {
  return tableauOf(s, p).some((c) => c.kind === 'denial' && !s.spentDenials.some((d) => d.cardId === c.id));
}

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
    const skipped = a ? s.skippedAgeIds.includes(a.id) : false;
    const cls = `dm-node${a ? (a.kind === 'catastrophe' ? ' is-cat' : ' is-age') : ''}${i === now && !ended ? ' is-now' : ''}`;
    const title = a ? `${a.name.trim()}${skipped ? ' (skipped by Optimistic Nihilism)' : ''}` : 'Still to come';
    return <span key={`n${i}`} className={cls} title={title} style={skipped ? { opacity: 0.4 } : undefined}>{a ? (a.kind === 'catastrophe' ? '!' : '') : '?'}</span>;
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
function SpeciesPanel({ state: s, playerId, viewer, mine, targets, onPick }: {
  state: DmState;
  playerId: PlayerId;
  viewer: PlayerId | null;
  mine: boolean;
  targets: Set<number> | null;
  onPick: (cardId: number) => void;
}) {
  const seat = s.seats.find((x) => x.id === playerId)!;
  const tab = tableauOf(s, playerId);
  const sc = computePlayerScore(s, playerId, viewer);
  const grew = useChangeKey(tab.length);
  const locked = s.currentAge.ruleTag === 'protectTraitPiles';
  return (
    <section className="dm-species-panel" style={{ '--seat': seat.color } as CSSProperties}>
      <div className="dm-species-who">
        <span key={grew} className={grew ? 'dm-species is-grew' : undefined} style={{ display: 'block' }}>
          <Species traits={tab} seedKey={seat.id} tint={seat.color} size={112} label={`${seat.name}'s species`} />
        </span>
        <span className="dm-species-name">{mine ? 'Your species' : `${seat.name}'s species`}</span>
        <span className="dm-species-stats">
          <Chip title="Gene Pool: the hand size you stabilize to">GP {genePoolOf(s, playerId)}</Chip>
          {unspentDenial(s, playerId) && <Chip tone="good" title="Ignores the next catastrophe">Denial ready</Chip>}
        </span>
      </div>
      <div className="dm-species-main">
        <div className="dm-species-head">
          <h4>Trait Pile · {tab.length} trait{tab.length === 1 ? '' : 's'}</h4>
          <span className="dm-score">
            <Tally value={sc.total} />
            <small>{sc.faceValue} face {sc.dropOfLifeBonus >= 0 ? '+' : '−'} {Math.abs(sc.dropOfLifeBonus)} drop of life{sc.classBonus ? ` + ${sc.classBonus} class` : ''}{sc.suppressed ? ` + ${sc.suppressed} suppressed` : ''}{sc.worldsEndBonus ? ` ${sc.worldsEndBonus > 0 ? '+' : '−'} ${Math.abs(sc.worldsEndBonus)} world's end` : ''}</small>
          </span>
        </div>
        <div className="dm-pile-row">
          {tab.length === 0 && <span className="dm-pile-empty">{mine ? 'Nothing yet — play a trait and watch it grow.' : 'No traits yet.'}</span>}
          {tab.map((card) => (
            <TraitCard
              key={card.id}
              card={card}
              size="sm"
              className={`dm-pile-card${targets?.has(card.id) ? ' is-target' : ''}`}
              protectedCard={card.dominant || locked}
              onClick={targets?.has(card.id) ? () => onPick(card.id) : undefined}
            />
          ))}
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
        const tie = s.worldsEnd?.tiebreak[x.id];
        return (
          <div key={x.id} className={`dm-finalist${s.winnerIds.includes(x.id) ? ' is-winner' : ''}`} style={{ '--i': i } as CSSProperties}>
            <Species traits={tableauOf(s, x.id)} seedKey={x.id} tint={x.color} size={i === 0 ? 120 : 100} />
            <span className="dm-species-name">{x.name}{x.id === me ? ' (you)' : ''}</span>
            <div className="dm-break">
              <span>{tableauOf(s, x.id).length} traits</span><b>{sc.faceValue}</b>
              <span>Drop of Life</span><b>{sc.dropOfLifeBonus >= 0 ? '+' : ''}{sc.dropOfLifeBonus}</b>
              {sc.classBonus > 0 && <><span>Class bonuses</span><b>+{sc.classBonus}</b></>}
              {sc.suppressed > 0 && <><span>Suppressed</span><b>+{sc.suppressed}</b></>}
              <span>World&apos;s End{tie !== undefined ? ' (incl. tie-break)' : ''}</span><b>{sc.worldsEndBonus >= 0 ? '+' : ''}{sc.worldsEndBonus}</b>
              <span className="is-total">Total</span><b className="is-total">{s.finalScores?.[x.id] ?? sc.total}</b>
            </div>
          </div>
        );
      })}
    </div>
  );
}
