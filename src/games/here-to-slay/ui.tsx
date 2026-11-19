// Here to Slay — lobby config + in-game view, on the shared table kit.
//
// Hidden information: only `localPlayerId`'s hand is ever rendered (cards
// shown to a player by Sharp Fox / Bullseye come from their own prompt). The
// deck is only ever a count. Dice are public: every roll goes through the
// roll tray — live while a modifier window is open, and afterwards (from the
// state's public `lastRoll`, so every device sees every roll) for a few
// seconds with its verdict.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { randomSeed, rngInt } from '@/core/rng';
import type { PlayerId, Seat } from '@/core/types';
import { seatName } from '@/core/state';
import {
  CardFan, Chip, Die, Dock, ExpansionPicker, FxLayer, GameLog, GameOverPanel, GameTable, PlayerPlate, PlayerStrip,
  TurnCue, useFx, usePulse,
} from '@/ui/kit';
import { LeaderBanner } from './art';
import {
  ApLanterns, ClassSlots, FaceDownCard, HtsCardView, MonsterCard, Pennant, TrophyRow, rollLabel,
} from './Card';
import {
  canAttackMonster, canEquipItemToHero, canMuscipulaDraw, canPlayChallengeCard, canRollHero, canUseBiggestRing, canUseNobleShaman, computeRollTotals,
  getClassesToWin, handOf, heroEquippedItems, heroHasItemKind, heroRollCost, majestelkSidesOwed, modifierValuesFor, niceGiftsOf, partyClasses, partyOf,
  pickablePileCards, trophiesOf, validHandCardsForPrompt, validHeroTargets, validMonsterTargets, validPartyCardTargets,
} from './reducer';
import { CLASS_META, WaxSeal } from './sigils';
import type { HtsAction, HtsCard, HtsConfig, HtsExpansionId, HtsMonster, HtsPartyHero, HtsPendingRoll, HtsPrompt, HtsRollRecord, HtsState } from './types';
import { HTS_EXPANSIONS } from './types';

function rollClient2d6(): [number, number] {
  const rng = { seed: randomSeed() };
  return [rngInt(rng, 6) + 1, rngInt(rng, 6) + 1];
}

// ============================================================================
// Lobby
// ============================================================================

export function LobbyConfig({ config, onChange, readOnly }: {
  config: HtsConfig;
  seats?: Seat[];
  onChange: (c: HtsConfig) => void;
  readOnly?: boolean;
}) {
  const classesToWin = getClassesToWin(config);
  // Toggling an expansion drops any chosen class count, so it follows the expansions again.
  const toggle = (id: string) => {
    const expId = id as HtsExpansionId;
    const next = config.expansions.includes(expId) ? config.expansions.filter((x) => x !== expId) : [...config.expansions, expId];
    const { classesToWin: _chosen, ...rest } = config;
    onChange({ ...rest, expansions: next });
  };
  return (
    <div className="game-config">
      <label className="field">
        <span>Monsters to slay to win</span>
        <select value={config.monstersToWin} onChange={(e) => onChange({ ...config, monstersToWin: Number(e.target.value) })}>
          <option value={3}>3 monsters (rulebook)</option>
          <option value={2}>2 monsters (quick game)</option>
        </select>
      </label>
      <label className="field">
        <span>Distinct classes to win</span>
        <select value={classesToWin} onChange={(e) => onChange({ ...config, classesToWin: Number(e.target.value) })}>
          <option value={6}>6 classes (base game)</option>
          <option value={7}>7 classes (with a class expansion)</option>
          <option value={8}>8 classes (epic party)</option>
        </select>
      </label>
      <ExpansionPicker expansions={HTS_EXPANSIONS} enabled={config.expansions} onToggle={toggle} readOnly={readOnly} />
      <p className="lobby-hint" style={{ margin: 0 }}>
        3 action points a turn. Slay {config.monstersToWin} monsters or gather {classesToWin} classes
        {config.expansions.includes('here-to-sleigh') ? ', or collect 3 Nice Gifts,' : ''} to win.
      </p>
    </div>
  );
}

// ============================================================================
// Game view
// ============================================================================

interface ViewProps {
  state: HtsState;
  localPlayerId: PlayerId | null;
  dispatch: (action: HtsAction) => void;
}

const PROMPT_WAIT: Record<HtsPrompt['kind'], string> = {
  rollEnteredHero: 'is rolling for a new hero',
  chooseHeroTarget: 'is choosing a hero',
  chooseCardsFromHand: 'is choosing cards',
  choosePlayer: 'is choosing a player',
  chooseFromPile: 'is choosing a card',
  bullseyePeek: 'is peeking at the deck',
  peekHandAck: 'is peeking at a hand',
  corruptedSabretoothChoice: 'is deciding to steal or destroy',
  confirm: 'is deciding',
  step: 'is resolving an effect',
  choosePartyCard: 'is choosing a card in a party',
  chooseMonster: 'is choosing a monster',
  chooseClass: 'is choosing a class',
  rerollHero: 'is deciding whether to roll again',
};

function maxAp(s: HtsState, id: PlayerId): number {
  return trophiesOf(s, id).some((m) => m.card.kind === 'monster-mega-slime') ? 4 : 3;
}

function rollSubject(s: HtsState, r: HtsPendingRoll): string {
  if (r.reason === 'monsterAttack') return s.monsterRow.find((m) => m.card.id === r.sourceCardId)?.card.name ?? 'a monster';
  if (r.reason === 'challengeDuel') return s.pendingPlay?.card.name ?? 'the card';
  for (const seat of s.seats) {
    const h = partyOf(s, seat.id).find((x) => x.card.id === r.sourceCardId);
    if (h) return h.card.name;
  }
  return 'a hero';
}

/** The verdict of a resolved roll, as recorded by the reducer. */
const VERDICT: Record<HtsRollRecord['outcome'], { good: boolean; label: string }> = {
  success: { good: true, label: 'Success!' },
  failure: { good: false, label: 'Failed' },
  slain: { good: true, label: 'Slain!' },
  penalty: { good: false, label: 'Mauled!' },
  nothing: { good: false, label: 'It holds…' },
  challengeWon: { good: false, label: 'Challenge won!' },
  cardStands: { good: true, label: 'Card stands!' },
};

export function GameView({ state: s, localPlayerId: me, dispatch }: ViewProps) {
  const [selectedHandId, setSelectedHandId] = useState<number | null>(null);
  const [picked, setPicked] = useState<number[]>([]);
  const [clawArmed, setClawArmed] = useState(false);
  // The last resolved roll lingers on the tray for a few seconds.
  const [shownRollSeq, setShownRollSeq] = useState<number | null>(null);
  const fx = useFx();
  const [shaking, shake] = usePulse(520);

  const myHand = me ? handOf(s, me) : [];
  const isMyTurn = me !== null && s.turnPlayerId === me && s.phase === 'playing';
  const canAct = isMyTurn && s.subPhase === 'awaitingAction';
  const prompt = s.subPhase === 'awaitingPrompt' ? s.promptQueue[0] ?? null : null;
  const myPrompt = prompt && me && prompt.playerId === me && s.activePlayerId === me ? prompt : null;
  const selectedCard = canAct ? myHand.find((c) => c.id === selectedHandId) ?? null : null;
  const opponents = s.seats.filter((x) => x.id !== me);
  const classesToWin = getClassesToWin(s.config);
  const sleigh = s.config.expansions.includes('here-to-sleigh');

  // Prompt-local selections reset whenever the decision changes.
  const promptKey = myPrompt ? `${myPrompt.kind}-${s.logSeq}-${s.promptQueue.length}` : '';
  useEffect(() => { setPicked([]); }, [promptKey]);
  useEffect(() => { if (!canAct) { setSelectedHandId(null); setClawArmed(false); } }, [canAct]);

  function send(a: HtsAction) {
    dispatch(a);
    setSelectedHandId(null);
    setPicked([]);
    setClawArmed(false);
  }

  /** Throw dice for one of this device's own rolls (they go into the action; the tray reads them back from state). */
  function throwDice(make: (dice: [number, number]) => HtsAction) {
    send(make(rollClient2d6()));
  }

  /** Challenge the pending play: both sides' dice are thrown here. */
  function throwDuel(challengeCardId: number) {
    if (!s.pendingPlay || !me) return;
    send({ type: 'playChallenge', playerId: me, cardId: challengeCardId, actorDice: rollClient2d6(), challengerDice: rollClient2d6() });
  }

  // ---- FX from state transitions --------------------------------------------------
  const prev = useRef(s);
  useEffect(() => {
    const was = prev.current;
    prev.current = s;
    if (was === s) return;
    // A roll resolved: keep its result on the tray for a moment.
    if (s.lastRoll && s.lastRoll.seq !== was.lastRoll?.seq) setShownRollSeq(s.lastRoll.seq);
    if (s.pendingRoll?.reason === 'challengeDuel' && was.pendingRoll?.reason !== 'challengeDuel') fx.stamp('CHALLENGE!', 'danger');
    for (const seat of s.seats) {
      const before = trophiesOf(was, seat.id);
      const after = trophiesOf(s, seat.id);
      if (after.length > before.length) {
        fx.stamp('SLAIN!', 'good');
        fx.burst([0.45, 0.32], '#ffb02e');
        fx.toast(`${seat.name} slew ${after[after.length - 1]!.card.name}!`, 'good');
      }
      if (niceGiftsOf(s, seat.id).length > niceGiftsOf(was, seat.id).length) fx.toast(`${seat.name} claimed a Nice Gift!`, 'good');
    }
    // Heroes that left a party: stolen (now elsewhere) or destroyed / sacrificed (gone).
    const where = new Map<number, PlayerId>();
    for (const seat of s.seats) for (const h of partyOf(s, seat.id)) where.set(h.card.id, seat.id);
    for (const seat of was.seats) {
      for (const h of partyOf(was, seat.id)) {
        const now = where.get(h.card.id);
        if (now === seat.id) continue;
        if (now) fx.toast(`${seatName(s, now)} stole ${h.card.name} from ${seat.name}!`, 'danger');
        else {
          fx.toast(`${seat.name} lost ${h.card.name}.`, 'danger');
          fx.burst([0.5, 0.12], CLASS_META[h.card.class ?? 'fighter'].color);
          if (seat.id === me) shake();
        }
      }
    }
    if (s.phase === 'gameOver' && was.phase !== 'gameOver') fx.stamp('VICTORY!', 'good');
    // Keyed on the state alone: fx and shake only schedule animations.
  }, [s]);

  // The tray's afterglow fades.
  useEffect(() => {
    if (shownRollSeq === null) return;
    const t = setTimeout(() => setShownRollSeq((q) => (q === shownRollSeq ? null : q)), 7000);
    return () => clearTimeout(t);
  }, [shownRollSeq]);
  const recent = s.lastRoll && s.lastRoll.seq === shownRollSeq ? s.lastRoll : null;

  // ---- valid targets for the current decision -------------------------------------------
  const heroTargets = myPrompt?.kind === 'chooseHeroTarget' ? validHeroTargets(s, myPrompt) : [];
  const heroTargetIds = new Set(heroTargets.map((t) => t.hero.card.id));
  const pickHero = (heroId: number) => send({ type: 'resolvePrompt', playerId: me!, targetCardId: heroId });
  const playerPick = myPrompt?.kind === 'choosePlayer';
  const clawTargets = clawArmed ? new Set(opponents.filter((o) => handOf(s, o.id).length > 0).map((o) => o.id)) : null;
  const handPick = myPrompt?.kind === 'chooseCardsFromHand' ? myPrompt : null;
  const handPickValid = handPick ? new Set(validHandCardsForPrompt(s, handPick).map((c) => c.id)) : null;
  const handPickMax = handPick ? Math.min(handPick.count, handPickValid!.size) : 0;
  function togglePick(id: number) {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < handPickMax ? [...cur, id] : cur));
  }

  function onPlate(id: PlayerId): (() => void) | undefined {
    if (playerPick) return () => send({ type: 'resolvePrompt', playerId: me!, targetPlayerId: id });
    if (clawTargets?.has(id)) return () => send({ type: 'shadowClawPull', playerId: me!, targetPlayerId: id });
    return undefined;
  }

  // ---- opponents ------------------------------------------------------------------------
  const top = (
    <PlayerStrip>
      {opponents.map((o) => {
        const party = partyOf(s, o.id);
        const leader = s.partyLeaders[o.id];
        const click = onPlate(o.id);
        return (
          <PlayerPlate
            key={o.id}
            seat={o}
            active={s.turnPlayerId === o.id && s.phase === 'playing'}
            sub={<>Hand {handOf(s, o.id).length} · {leader?.name ?? 'no leader'}{s.activePlayerId === o.id && s.turnPlayerId !== o.id ? ' · deciding…' : ''}</>}
            targetable={!!click}
            onClick={click}
          >
            <div className="hts-plate-row">
              <div className="hts-pennants">
                {leader?.class && <span className="hts-plate-seal" title={leader.name}><WaxSeal cls={leader.class} /></span>}
                {party.map((h) => (
                  <Pennant
                    key={h.card.id}
                    hero={h}
                    onClick={heroTargetIds.has(h.card.id) ? () => pickHero(h.card.id) : undefined}
                    selected={heroTargetIds.has(h.card.id)}
                  />
                ))}
              </div>
              {s.turnPlayerId === o.id && s.phase === 'playing' && <ApLanterns remaining={s.actionPointsRemaining} max={maxAp(s, o.id)} />}
            </div>
            <div className="hts-goals">
              <ClassSlots have={Array.from(partyClasses(s, o.id))} need={classesToWin} />
              <TrophyRow have={trophiesOf(s, o.id).length} need={s.config.monstersToWin} />
              {sleigh && <span className="hts-gifts">🎁 {niceGiftsOf(s, o.id).length}/3</span>}
            </div>
          </PlayerPlate>
        );
      })}
    </PlayerStrip>
  );

  // ---- board: piles · monsters · roll tray ------------------------------------------------
  const topDiscard = s.discard[s.discard.length - 1];
  const board = (
    <div className="hts-board">
      <div className="hts-piles">
        <div className="hts-pile-group">
          <div className="hts-pile">
            {s.deck.length > 1 && <FaceDownCard />}
            {s.deck.length > 0 ? <FaceDownCard /> : <div className="hts-pile-empty" />}
            <span className="hts-pile-count">{s.deck.length}</span>
          </div>
          <span className="hts-pile-name">Deck</span>
        </div>
        <div className="hts-pile-group">
          <div className="hts-pile">
            {topDiscard ? <HtsCardView key={topDiscard.id} card={topDiscard} size="sm" className="hts-discard-top" /> : <div className="hts-pile-empty" />}
            <span className="hts-pile-count">{s.discard.length}</span>
          </div>
          <span className="hts-pile-name">Discard</span>
        </div>
      </div>

      <div className="hts-monsters">
        <div className="hts-board-label">The monsters</div>
        <div className="hts-monster-row">
          {s.monsterRow.map((m) => (
            <MonsterSlot key={m.card.id} state={s} monster={m} me={me} canAct={canAct} onAttack={() => throwDice(
              (dice) => ({ type: 'attackMonster', playerId: me!, monsterCardId: m.card.id, dice }),
            )} />
          ))}
        </div>
        <div className="hts-monster-left">{s.monsterDeck.length} more lurking in the dark</div>
      </div>

      <RollTray state={s} recent={recent} />
    </div>
  );

  // ---- the dock ---------------------------------------------------------------------------
  const dock = renderDock();

  function renderDock(): ReactNode {
    if (s.phase === 'gameOver') {
      const w = s.winnerId;
      const how = w
        ? trophiesOf(s, w).length >= s.config.monstersToWin ? `slew ${trophiesOf(s, w).length} monsters`
          : sleigh && niceGiftsOf(s, w).length >= 3 ? 'collected 3 Nice Gifts'
          : `gathered a ${partyClasses(s, w).size}-class party`
        : '';
      return (
        <GameOverPanel
          seats={s.seats}
          finalScores={s.finalScores}
          winnerIds={w ? [w] : undefined}
          localPlayerId={me}
          headline={`${seatName(s, w)} wins!`}
          detail={how ? `${seatName(s, w)} ${how}.` : undefined}
          showScores={false}
          art={<svg viewBox="0 0 100 100"><LeaderBanner cls={s.partyLeaders[w ?? '']?.class ?? null} /></svg>}
        />
      );
    }
    const active = s.seats.find((x) => x.id === s.activePlayerId) ?? null;
    const mine = !!me && s.activePlayerId === me;

    if (s.subPhase === 'choosingLeaders' && s.leaderDraft) {
      const pool = s.leaderDraft.pool;
      if (mine) {
        return (
          <Dock tone="turn" eyebrow="Choose your Party Leader" title="Who leads your Party?">
            Your leader stays with you all game and its class counts toward your Party.{s.seats.length === 2 ? ' (The Shadow Claw sits out 2-player games.)' : ''}
            <div className="hts-choices is-scroll">
              {pool.map((c) => (
                <HtsCardView key={c.id} card={c} size="sm" onClick={() => send({ type: 'choosePartyLeader', playerId: me!, leaderKind: c.kind })} />
              ))}
            </div>
          </Dock>
        );
      }
      return (
        <Dock tone="wait" who={active} eyebrow="Choosing Party Leaders" title={`${active?.name ?? 'Someone'} is choosing a Party Leader`}>
          Whoever picks last takes the first turn. Cards are dealt once every leader is chosen.
        </Dock>
      );
    }

    if (s.subPhase === 'awaitingChallenge' && s.pendingPlay) {
      const p = s.pendingPlay;
      if (mine) {
        // One button per kind of Challenge card you can play (class Challenges need that class in your Party).
        const playable = myHand.filter((c) => canPlayChallengeCard(s, me!, c)).filter((c, i, all) => all.findIndex((x) => x.kind === c.kind) === i);
        return (
          <Dock
            tone="react"
            eyebrow="Challenge window"
            title={`Challenge ${seatName(s, p.byPlayerId)}'s ${p.card.name}?`}
            actions={
              <>
                {playable.map((challenge) => (
                  <span key={challenge.id} className="hts-inline-choice">
                    <HtsCardView card={challenge} size="xs" inspect={false} />
                    <button onClick={() => throwDuel(challenge.id)}>{challenge.challengeBonus ? `${challenge.name} (+${challenge.challengeBonus})` : 'Challenge!'}</button>
                  </span>
                ))}
                <button className="secondary" onClick={() => send({ type: 'declineChallenge', playerId: me! })}>Let it be</button>
              </>
            }
          >
            Play a Challenge and you both roll — beat or tie their roll and the card is discarded.
          </Dock>
        );
      }
      return <Dock tone="wait" who={active} eyebrow={`Challenge window · ${active?.name ?? '…'} may challenge`} title={`${seatName(s, p.byPlayerId)} played ${p.card.name}`} />;
    }

    if (s.subPhase === 'awaitingModifiers' && s.pendingRoll) {
      if (mine) return <ModifierDock key={`${s.pendingRoll.sourceCardId}-${s.pendingRoll.dice.join('')}`} state={s} me={me!} onSend={send} />;
      return <Dock tone="wait" who={active} eyebrow={`Modifier window · ${active?.name ?? '…'} may tamper`} title={`${seatName(s, s.pendingRoll.byPlayerId)} rolled for ${rollSubject(s, s.pendingRoll)}`} />;
    }

    if (prompt) {
      if (!myPrompt) {
        const who = s.seats.find((x) => x.id === prompt.playerId) ?? active;
        const publicText = prompt.kind === 'chooseCardsFromHand' ? prompt.publicReason ?? prompt.reason : 'reason' in prompt ? prompt.reason : undefined;
        return <Dock tone="wait" who={who} title={`${who?.name ?? 'Someone'} ${PROMPT_WAIT[prompt.kind]}`}>{publicText}</Dock>;
      }
      return renderPrompt(myPrompt);
    }

    // awaitingAction
    if (!isMyTurn) {
      const t = s.seats.find((x) => x.id === s.turnPlayerId) ?? null;
      return <Dock tone="wait" who={t} eyebrow={`${t?.name ?? '…'} has ${s.actionPointsRemaining} action point${s.actionPointsRemaining === 1 ? '' : 's'}`} title={`${t?.name ?? 'Someone'}'s turn`} />;
    }
    return renderTurnDock();
  }

  function renderTurnDock(): ReactNode {
    const ap = s.actionPointsRemaining;
    const leader = me ? s.partyLeaders[me] : undefined;
    const tools = (
      <div className="hts-leader-tools">
        <button className="secondary tiny" disabled={ap < 1} onClick={() => send({ type: 'drawCard', playerId: me! })}>Draw · 1 AP</button>
        <button className="secondary tiny" disabled={ap < 3} onClick={() => send({ type: 'discardAndRedraw', playerId: me! })}>New hand · 3 AP</button>
        {sleigh && (
          <button className="secondary tiny" disabled={ap < 2 || partyOf(s, me!).length < 1} onClick={() => send({ type: 'claimHolidayGift', playerId: me! })}>Deliver a gift · 2 AP</button>
        )}
        {leader?.kind === 'leader-shadow-claw' && !s.turnBuffs.shadowClawUsed && ap >= 1 && (
          <button className={`secondary tiny${clawArmed ? ' is-on' : ''}`} onClick={() => setClawArmed((v) => !v)}>Shadow Claw pull · 1 AP</button>
        )}
        {leader?.kind === 'leader-gnawing-dread' && !s.turnBuffs.gnawingDreadUsed && ap >= 2 && s.discard.length > 0 && (
          <button className="secondary tiny" onClick={() => send({ type: 'gnawingDreadSearch', playerId: me! })}>Gnawing Dread search · 2 AP</button>
        )}
        {me && canMuscipulaDraw(s, me) && (
          <button className="secondary tiny" onClick={() => send({ type: 'muscipulaDraw', playerId: me })}>Muscipula Rex draw · free</button>
        )}
      </div>
    );
    const end = <button className="secondary" onClick={() => send({ type: 'endTurn', playerId: me! })}>End turn</button>;
    const eyebrow = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>Your turn <ApLanterns remaining={ap} max={maxAp(s, me!)} /></span>;

    if (clawArmed) {
      return (
        <Dock tone="turn" eyebrow={eyebrow} title="Shadow Claw: whose hand?" actions={<><button className="secondary" onClick={() => setClawArmed(false)}>Cancel</button>{end}</>}>
          Click an opponent above to pull a card from their hand.
        </Dock>
      );
    }
    const c = selectedCard;
    if (c && (c.type === 'item' || c.type === 'cursedItem')) {
      const targets = s.seats
        .map((seat) => ({ seat, heroes: partyOf(s, seat.id).filter((h) => canEquipItemToHero(h, c)) }))
        .filter((g) => g.heroes.length > 0);
      return (
        <Dock tone="turn" eyebrow={eyebrow} title={`Equip ${c.name} · 1 AP`} actions={<><button className="secondary" onClick={() => setSelectedHandId(null)}>Cancel</button>{end}</>}>
          {targets.length ? `Pick the hero to wear it${c.type === 'cursedItem' ? ' — cursed items are best given away' : ''}.` : 'No hero can take this item right now.'}
          <div className="hts-choices is-scroll">
            {targets.map(({ seat, heroes }) => (
              <div key={seat.id} className="hts-owner-group">
                <span>{seat.id === me ? 'Your party' : `${seat.name}'s party`}</span>
                <div>
                  {heroes.map((h) => (
                    <HtsCardView key={h.card.id} card={h.card} size="sm" disabled={ap < 1} onClick={() => send({ type: 'equipItem', playerId: me!, cardId: c.id, targetPlayerId: seat.id, heroCardId: h.card.id })} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Dock>
      );
    }
    if (c && (c.type === 'hero' || c.type === 'magic')) {
      const hero = c.type === 'hero';
      return (
        <Dock
          tone="turn"
          eyebrow={eyebrow}
          title={hero ? `Recruit ${c.name}?` : `Cast ${c.name}?`}
          actions={
            <>
              <button disabled={ap < 1} onClick={() => send(hero ? { type: 'playHero', playerId: me!, cardId: c.id } : { type: 'playMagic', playerId: me!, cardId: c.id })}>
                {hero ? 'Recruit' : 'Cast'} · 1 AP
              </button>
              <button className="secondary" onClick={() => setSelectedHandId(null)}>Cancel</button>
            </>
          }
        >
          {c.text}
          {hero && ' Recruiting lets you roll its ability right away, for free.'}
        </Dock>
      );
    }
    return (
      <Dock tone="turn" eyebrow={eyebrow} title={c ? `${c.name} waits for a roll` : ap > 0 ? 'Spend your action points' : 'Out of action points'} actions={end}>
        {c
          ? c.type === 'modifier' ? 'Modifiers are played when someone rolls.' : c.type === 'challenge' ? "Challenges answer other players' cards." : c.text
          : ap > 0 ? 'Pick a card from your hand, roll a hero below, or attack a monster.' : 'Your lanterns are spent — end your turn.'}
        {tools}
      </Dock>
    );
  }

  function renderPrompt(p: HtsPrompt): ReactNode {
    const decline = () => send({ type: 'resolvePrompt', playerId: me!, decline: true });
    switch (p.kind) {
      case 'rollEnteredHero': {
        const h = p.heroCard;
        return (
          <Dock
            tone="turn"
            eyebrow="A hero joins your party"
            title={`Roll for ${h.name}?`}
            actions={
              <>
                <HtsCardView card={h} size="sm" />
                <button onClick={() => throwDice((dice) => ({ type: 'resolvePrompt', playerId: me!, dice }))}>Roll · free</button>
                <button className="secondary" onClick={decline}>Skip</button>
              </>
            }
          >
            Needs {rollLabel(h.abilityThreshold ?? 7, h.rollLow)}: {h.text}
          </Dock>
        );
      }
      case 'chooseHeroTarget': {
        const harsh = p.mode === 'destroy' || p.mode === 'sacrifice' || p.mode === 'steal';
        const byOwner = s.seats.map((seat) => ({ seat, list: heroTargets.filter((t) => t.ownerId === seat.id) })).filter((g) => g.list.length);
        const item = p.mode === 'equipItem' ? myHand.find((c) => c.id === p.itemCardId) : undefined;
        return (
          <Dock
            tone={harsh ? 'danger' : 'turn'}
            eyebrow={item ? 'Equip an item' : 'Choose a hero'}
            title={p.reason}
            actions={<>{item && <HtsCardView card={item} size="xs" inspect={false} />}{p.optional && <button className="secondary" onClick={decline}>Skip</button>}</>}
          >
            {byOwner.length ? 'Click a hero here, or a pennant above.' : 'No hero can be chosen.'}
            <div className="hts-choices is-scroll">
              {byOwner.map(({ seat, list }) => (
                <div key={seat.id} className="hts-owner-group">
                  <span>{seat.id === me ? 'Your party' : `${seat.name}'s party`}</span>
                  <div>{list.map(({ hero }) => <HtsCardView key={hero.card.id} card={hero.card} size="sm" onClick={() => pickHero(hero.card.id)} />)}</div>
                </div>
              ))}
            </div>
          </Dock>
        );
      }
      case 'chooseCardsFromHand': {
        const ok = p.upTo ? picked.length >= 1 : picked.length === handPickMax;
        // Effects that hinge on a card just drawn / pulled show that card here.
        const shown = p.onlyCardIds ? myHand.filter((c) => p.onlyCardIds!.includes(c.id)) : [];
        const nothing = handPickValid!.size === 0;
        return (
          <Dock
            tone={p.effectTag.toLowerCase().includes('discard') ? 'danger' : 'turn'}
            eyebrow={nothing ? 'Nothing to play' : `Choose ${p.upTo ? 'up to ' : ''}${handPickMax} from your hand`}
            title={p.reason}
            actions={
              <>
                {!nothing && <button disabled={!ok} onClick={() => send({ type: 'resolvePrompt', playerId: me!, cardIds: picked })}>Confirm ({picked.length})</button>}
                {p.optional && <button className="secondary" onClick={decline}>{nothing ? 'OK' : 'Skip'}</button>}
              </>
            }
          >
            {nothing ? (shown.length ? 'None of these can be played now.' : 'Nothing in your hand fits.') : 'Click the cards in your hand below.'}
            {shown.length > 0 && (
              <div className="hts-choices">{shown.map((c) => (
                <HtsCardView
                  key={c.id}
                  card={c}
                  size="sm"
                  selected={picked.includes(c.id)}
                  disabled={!handPickValid!.has(c.id)}
                  onClick={handPickValid!.has(c.id) ? () => togglePick(c.id) : undefined}
                />
              ))}</div>
            )}
          </Dock>
        );
      }
      case 'choosePlayer':
        return (
          <Dock tone="turn" eyebrow="Choose a player" title={p.reason} actions={
            <>
              {opponents.map((o) => (
                <button key={o.id} className="secondary tiny" onClick={() => send({ type: 'resolvePrompt', playerId: me!, targetPlayerId: o.id })}>{o.name}</button>
              ))}
              {p.includeSelf && <button className="secondary tiny" onClick={() => send({ type: 'resolvePrompt', playerId: me!, targetPlayerId: me! })}>Yourself</button>}
            </>
          }>
            Click a player above.
          </Dock>
        );
      case 'chooseFromPile': {
        const pickable = new Set(pickablePileCards(p).map((c) => c.id));
        const nothing = pickable.size === 0;
        const looking = p.source === 'opponentHand' && p.opponentId;
        return (
          <Dock
            tone="turn"
            eyebrow={looking ? `${seatName(s, p.opponentId!)}'s hand` : p.source === 'discard' ? 'Search the discard pile' : 'Choose a card'}
            title={p.reason}
            actions={(p.optional || nothing) && <button className="secondary" onClick={decline}>{nothing ? 'OK' : 'Skip'}</button>}
          >
            {nothing ? 'Nothing here can be taken.' : pickable.size < p.cards.length ? 'Click one of the highlighted cards.' : 'Click a card.'}
            <div className="hts-choices is-scroll">
              {p.cards.map((c) => (
                <HtsCardView
                  key={c.id}
                  card={c}
                  size="sm"
                  disabled={!pickable.has(c.id)}
                  onClick={pickable.has(c.id) ? () => send({ type: 'resolvePrompt', playerId: me!, targetCardId: c.id }) : undefined}
                />
              ))}
            </div>
          </Dock>
        );
      }
      case 'choosePartyCard': {
        const targets = validPartyCardTargets(s, p);
        const owners = s.seats.map((seat) => ({ seat, list: targets.filter((t) => t.ownerId === seat.id) })).filter((g) => g.list.length);
        return (
          <Dock
            tone="danger"
            eyebrow={p.mode === 'sacrifice' ? 'Sacrifice a card' : 'Destroy a card'}
            title={p.reason}
            actions={p.optional && <button className="secondary" onClick={decline}>{p.effectTag === 'rabidBeastSacrifice' ? 'Stop' : 'Skip'}</button>}
          >
            {p.filter === 'item' ? 'Pick an equipped Item.' : 'Pick a Hero (its Items go with it) or a single equipped Item.'}
            <div className="hts-choices is-scroll">
              {owners.map(({ seat, list }) => (
                <div key={seat.id} className="hts-owner-group">
                  <span>{seat.id === me ? 'Your party' : `${seat.name}'s party`}</span>
                  <div>
                    {list.map((t) => {
                      const card = t.item ?? t.hero.card;
                      return <HtsCardView key={card.id} card={card} size="sm" footnote={t.item ? `on ${t.hero.card.name}` : undefined} onClick={() => send({ type: 'resolvePrompt', playerId: me!, targetCardId: card.id })} />;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Dock>
        );
      }
      case 'chooseMonster': {
        const targets = validMonsterTargets(s, p);
        const pick = (m: HtsMonster) => (p.mode === 'attack'
          ? throwDice((dice) => ({ type: 'resolvePrompt', playerId: me!, targetCardId: m.card.id, dice }))
          : send({ type: 'resolvePrompt', playerId: me!, targetCardId: m.card.id }));
        return (
          <Dock tone="turn" eyebrow={p.mode === 'attack' ? 'Attack a monster · free' : 'Slay a monster'} title={p.reason}>
            {p.mode === 'attack' ? 'Pick the monster to attack — you roll as soon as you click.' : 'Pick the monster to slay. Your turn ends afterwards.'}
            <div className="hts-choices is-scroll">
              {targets.map((m) => <MonsterCard key={m.card.id} monster={m} size="sm" onClick={() => pick(m)} />)}
            </div>
          </Dock>
        );
      }
      case 'chooseClass':
        return (
          <Dock tone="danger" eyebrow="Choose a class" title={p.reason}>
            Every Hero of that class goes back to its owner's hand (Masks count).
            <div className="hts-class-picks">
              {p.classes.map((cls) => (
                <button key={cls} className="secondary hts-class-pick" onClick={() => send({ type: 'resolvePrompt', playerId: me!, className: cls })}>
                  <WaxSeal cls={cls} /> {CLASS_META[cls].label}
                </button>
              ))}
            </div>
          </Dock>
        );
      case 'rerollHero': {
        const hero = partyOf(s, p.playerId).find((h) => h.card.id === p.heroCardId);
        return (
          <Dock
            tone="turn"
            eyebrow="Goblet of Caffeination"
            title={p.reason}
            actions={
              <>
                {hero && <HtsCardView card={hero.card} size="xs" inspect={false} />}
                <button onClick={() => throwDice((dice) => ({ type: 'resolvePrompt', playerId: me!, dice }))}>Sacrifice it &amp; roll again</button>
                <button className="secondary" onClick={decline}>Keep the Goblet</button>
              </>
            }
          />
        );
      }
      case 'bullseyePeek':
        return <BullseyeDock key={p.cards.map((c) => c.id).join('-')} cards={p.cards} onConfirm={(pick, order) => send({ type: 'resolvePrompt', playerId: me!, bullseyePickId: pick, bullseyeTopOrder: order })} />;
      case 'peekHandAck':
        return (
          <Dock tone="turn" eyebrow="Sharp Fox" title={`${seatName(s, p.targetPlayerId)}'s hand`} actions={<button onClick={() => send({ type: 'resolvePrompt', playerId: me! })}>Got it</button>}>
            <div className="hts-choices is-scroll">{p.cards.map((c) => <HtsCardView key={c.id} card={c} size="sm" />)}</div>
          </Dock>
        );
      case 'confirm':
        return (
          <Dock tone="turn" eyebrow="Your call" title={p.reason} actions={
            <>
              <button onClick={() => send({ type: 'resolvePrompt', playerId: me! })}>Yes</button>
              <button className="secondary" onClick={decline}>No</button>
            </>
          } />
        );
      case 'step':
        return null;
      case 'corruptedSabretoothChoice':
        return (
          <Dock tone="danger" eyebrow="Corrupted Sabretooth" title="Steal the hero instead of destroying it?" actions={
            <>
              <button onClick={() => send({ type: 'resolvePrompt', playerId: me!, decline: false })}>Steal it</button>
              <button className="secondary" onClick={() => send({ type: 'resolvePrompt', playerId: me!, decline: true })}>Destroy it</button>
            </>
          } />
        );
    }
  }

  // ---- your party + hand ---------------------------------------------------------------------
  const myParty = me ? partyOf(s, me) : [];
  const myLeader = me ? s.partyLeaders[me] : undefined;
  const handMode: 'play' | 'pick' | 'idle' = handPick ? 'pick' : canAct ? 'play' : 'idle';

  function onHandCard(c: HtsCard): (() => void) | undefined {
    if (handMode === 'pick') {
      if (!handPickValid!.has(c.id)) return undefined;
      return () => togglePick(c.id);
    }
    if (handMode === 'play') return () => setSelectedHandId((cur) => (cur === c.id ? null : c.id));
    return undefined;
  }

  const hand = me ? (
    <div className="hts-home">
      <div className="hts-home-head">
        <h4>Your party</h4>
        <div className="hts-goals">
          <ClassSlots have={Array.from(partyClasses(s, me))} need={classesToWin} />
          <TrophyRow have={trophiesOf(s, me).length} need={s.config.monstersToWin} />
          {sleigh && <span className="hts-gifts">🎁 {niceGiftsOf(s, me).length}/3</span>}
          <Chip>{myHand.length} in hand</Chip>
        </div>
      </div>
      <div className="hts-home-row">
      <div className="hts-party">
        {myLeader && <HtsCardView card={myLeader} size="sm" />}
        <span className="hts-party-divider" />
        {myParty.length === 0 && <span className="hts-party-empty">{s.subPhase === 'choosingLeaders' ? 'Choose a Party Leader first.' : 'No heroes yet — recruit one from your hand.'}</span>}
        {myParty.map((h) => (
          <PartyHero
            key={h.card.id}
            hero={h}
            ap={s.actionPointsRemaining}
            canAct={canAct}
            targetable={heroTargetIds.has(h.card.id)}
            onTarget={() => pickHero(h.card.id)}
            onRoll={() => throwDice((dice) => ({ type: 'useHeroAbility', playerId: me, heroCardId: h.card.id, dice }))}
          />
        ))}
      </div>
      <div className="hts-hand">
        {myHand.length === 0 ? (
          <p className="hts-hand-empty">Your hand is empty.</p>
        ) : (
          <CardFan label="Your hand" maxTilt={8}>
            {myHand.map((c) => {
              const click = onHandCard(c);
              return (
                <HtsCardView
                  key={c.id}
                  card={c}
                  selected={handMode === 'pick' ? picked.includes(c.id) : selectedHandId === c.id}
                  disabled={!click}
                  onClick={click}
                />
              );
            })}
          </CardFan>
        )}
      </div>
      </div>
    </div>
  ) : (
    <div className="hts-home"><p className="hts-hand-empty">Spectating — no hand to show.</p></div>
  );

  return (
    <GameTable
      className={`hts-table${shaking ? ' is-shaking' : ''}`}
      top={top}
      board={board}
      side={<GameLog entries={s.log} seats={s.seats} title="Tavern tales" />}
      dock={dock}
      hand={hand}
      overlay={
        <>
          <FxLayer fx={fx} />
          <TurnCue active={canAct && s.actionPointsRemaining === maxAp(s, me!)}>Your turn</TurnCue>
        </>
      }
    />
  );
}

// ============================================================================
// Pieces
// ============================================================================

function MonsterSlot({ state: s, monster: m, me, canAct, onAttack }: {
  state: HtsState;
  monster: HtsMonster;
  me: PlayerId | null;
  canAct: boolean;
  onAttack: () => void;
}) {
  const meets = me ? canAttackMonster(s, me, m) : false;
  const ready = canAct && meets && s.actionPointsRemaining >= 2;
  const why = !canAct ? null : !meets ? `Needs ${m.requirementText}` : s.actionPointsRemaining < 2 ? 'Needs 2 AP' : null;
  return (
    <div className={`hts-monster-slot${ready ? ' is-ready' : ''}`}>
      <MonsterCard monster={m} onClick={ready ? onAttack : undefined} />
      {canAct && (
        <>
          <button className="hts-attack" disabled={!ready} onClick={onAttack}>Attack · 2 AP</button>
          {why && <span className="hts-why">{why}</span>}
        </>
      )}
    </div>
  );
}

function PartyHero({ hero: h, ap, canAct, targetable, onTarget, onRoll }: {
  hero: HtsPartyHero;
  ap: number;
  canAct: boolean;
  targetable: boolean;
  onTarget: () => void;
  onRoll: () => void;
}) {
  const sealed = heroHasItemKind(h, 'sealing-key');
  const cost = heroRollCost(h);
  const can = canAct && ap >= cost && canRollHero(h);
  const items = heroEquippedItems(h);
  const label = sealed ? 'Sealed' : !canRollHero(h) ? 'Used' : `Roll ${rollLabel(h.card.abilityThreshold ?? 7, h.card.rollLow)}${h.usedThisTurn ? ' again' : ''} · ${cost} AP`;
  return (
    <div className="hts-party-hero">
      <HtsCardView card={h.card} size="sm" selected={targetable} onClick={targetable ? onTarget : undefined} footnote={h.usedThisTurn && !canAct ? 'used' : undefined} />
      {items.length > 0 && (
        <div className="hts-party-items">{items.map((it) => <HtsCardView key={it.id} card={it} size="xs" />)}</div>
      )}
      {canAct && <button className="secondary tiny" disabled={!can} onClick={onRoll}>{label}</button>}
    </div>
  );
}

/** Every 2d6: live while modifiers can still land, then its result for a few seconds. */
function RollTray({ state: s, recent }: { state: HtsState; recent: HtsRollRecord | null }) {
  if (s.pendingRoll) {
    const r = s.pendingRoll;
    const { actorTotal, challengerTotal } = computeRollTotals(s, r);
    return <TrayRoll state={s} roll={r} actorTotal={actorTotal} challengerTotal={challengerTotal} subject={rollSubject(s, r)} live />;
  }
  if (s.subPhase === 'awaitingChallenge' && s.pendingPlay) {
    return (
      <div className="hts-tray">
        <div className="hts-staged">
          <HtsCardView key={s.pendingPlay.card.id} card={s.pendingPlay.card} size="sm" />
          <div className="hts-tray-title">{seatName(s, s.pendingPlay.byPlayerId)} plays {s.pendingPlay.card.name}</div>
          <div className="hts-tray-sub">…unless someone challenges</div>
        </div>
      </div>
    );
  }
  if (recent) {
    return <TrayRoll key={recent.seq} state={s} roll={recent.roll} actorTotal={recent.actorTotal} challengerTotal={recent.challengerTotal} subject={recent.subject} verdictOf={recent} />;
  }
  return (
    <div className="hts-tray">
      <div className="hts-tray-idle">
        <svg viewBox="0 0 20 28" aria-hidden="true" className="hts-lantern-big">
          <path d="M7 2 H13 M10 2 V5" stroke="#1d140d" strokeWidth={1.6} strokeLinecap="round" />
          <path d="M5 6 H15 L16 9 H4 Z" fill="#5a3a1e" stroke="#1d140d" strokeWidth={1.2} />
          <path d="M5 9 H15 V22 H5 Z" fill="#ffcf6a" stroke="#1d140d" strokeWidth={1.4} />
          <path d="M10 20 Q7 16 10 11 Q13 16 10 20 Z" fill="#fff3c2" />
          <path d="M4 22 H16 L15 25 H5 Z" fill="#5a3a1e" stroke="#1d140d" strokeWidth={1.2} />
        </svg>
        <div className="hts-tray-title">The dice are quiet</div>
        <div className="hts-tray-sub">Every roll lands here.</div>
      </div>
    </div>
  );
}

function TrayRoll({ state: s, roll: r, actorTotal, challengerTotal, subject, live, verdictOf }: {
  state: HtsState;
  roll: HtsPendingRoll;
  actorTotal: number;
  challengerTotal: number;
  subject: string;
  live?: boolean;
  verdictOf?: HtsRollRecord;
}) {
  const v = verdictOf ? VERDICT[verdictOf.outcome] : null;
  const bone = '#f4ecd8';
  const modsOn = (side: 'actor' | 'challenger') => r.modifiers.filter((m) => m.targetSide === side);
  const bonus = (side: 'actor' | 'challenger', total: number, dice: [number, number]) =>
    total - dice[0] - dice[1] - modsOn(side).reduce((a, m) => a + m.amount, 0);
  const chips = (side: 'actor' | 'challenger', total: number, dice: [number, number]) => {
    const b = bonus(side, total, dice);
    return (
      <div className="hts-mods">
        {modsOn(side).map((m, i) => (
          <Chip key={i} tone={m.amount >= 0 ? 'good' : 'danger'} title={`${m.card.name} by ${seatName(s, m.playerId)}`}>
            {m.amount >= 0 ? '+' : '−'}{Math.abs(m.amount)} {seatName(s, m.playerId)}
          </Chip>
        ))}
        {b !== 0 && <Chip tone="accent" title="Leader, trophies, items and turn bonuses">{b > 0 ? '+' : '−'}{Math.abs(b)} bonuses</Chip>}
      </div>
    );
  };
  const rollKey = `${r.sourceCardId}-${r.dice.join('')}-${r.challengerDice?.join('') ?? ''}`;
  if (r.reason === 'challengeDuel' && r.challengerDice) {
    const ahead = challengerTotal >= actorTotal ? 'challenger' : 'actor';
    return (
      <div className="hts-tray">
        <div className="hts-tray-title">Challenge: {subject}</div>
        <div className="hts-duel">
          <div className={`hts-duel-side${ahead === 'actor' ? ' is-ahead' : ''}`}>
            <span className="hts-duel-name">{seatName(s, r.byPlayerId)}</span>
            <div className="hts-dice"><Die value={r.dice[0]} rollKey={rollKey} size={34} color={bone} /><Die value={r.dice[1]} rollKey={rollKey} size={34} color={bone} /></div>
            <div className="hts-total">{actorTotal}</div>
            {chips('actor', actorTotal, r.dice)}
          </div>
          <span className="hts-duel-vs">vs</span>
          <div className={`hts-duel-side${ahead === 'challenger' ? ' is-ahead' : ''}`}>
            <span className="hts-duel-name">{seatName(s, r.challengerId)}</span>
            <div className="hts-dice"><Die value={r.challengerDice[0]} rollKey={rollKey} size={34} color={bone} /><Die value={r.challengerDice[1]} rollKey={rollKey} size={34} color={bone} /></div>
            <div className="hts-total">{challengerTotal}</div>
            {chips('challenger', challengerTotal, r.challengerDice)}
          </div>
        </div>
        {live ? <div className="hts-tray-sub">Ties go to the challenger · modifiers may still land</div> : v && <div className={`hts-verdict ${v.good ? 'is-good' : 'is-bad'}`}>{v.label}</div>}
      </div>
    );
  }
  const need = r.reason === 'monsterAttack'
    ? (() => {
        const m = s.monsterRow.find((x) => x.card.id === r.sourceCardId);
        return m ? `slay ${m.slayOnLow ? `≤${m.slayThreshold}` : `${m.slayThreshold}+`} · fail ${m.slayOnLow ? `${m.failThreshold}+` : `≤${m.failThreshold}`}` : '';
      })()
    : `needs ${rollLabel(r.threshold, r.rollLow)}`;
  return (
    <div className="hts-tray">
      <div className="hts-tray-title">{seatName(s, r.byPlayerId)} {r.reason === 'monsterAttack' ? 'attacks' : 'rolls for'} {subject}</div>
      <div className="hts-dice">
        <Die value={r.dice[0]} rollKey={rollKey} color={bone} />
        <Die value={r.dice[1]} rollKey={rollKey} color={bone} />
      </div>
      <div className="hts-total">{actorTotal} <small>{need}</small></div>
      {chips('actor', actorTotal, r.dice)}
      {live ? <div className="hts-tray-sub">Modifiers may still land…</div> : v && <div className={`hts-verdict ${v.good ? 'is-good' : 'is-bad'}`}>{v.label}</div>}
    </div>
  );
}

function ModifierDock({ state: s, me, onSend }: { state: HtsState; me: PlayerId; onSend: (a: HtsAction) => void }) {
  const r = s.pendingRoll!;
  const [horn, setHorn] = useState<1 | -1>(1);
  const [side, setSide] = useState<'actor' | 'challenger'>(r.byPlayerId === me ? 'actor' : r.challengerId === me ? 'challenger' : 'actor');
  const { actorTotal, challengerTotal } = computeRollTotals(s, r);
  // Stagguard-style "no other player can play Modifier cards" leaves only the leader skill.
  const blocked = !!s.turnBuffs.noOpponentModifiers && me !== s.turnPlayerId;
  const mods = blocked ? [] : handOf(s, me).filter((c) => c.type === 'modifier');
  const isHorn = s.partyLeaders[me]?.kind === 'leader-protecting-horn';
  const shaman = canUseNobleShaman(s, me);
  const duel = r.reason === 'challengeDuel';
  const subject = rollSubject(s, r);
  // Majestelk: +5 or -5 must be declared on each of your own rolls before you can pass.
  const owedSign = majestelkSidesOwed(s, r, me)[0];
  // Biggest Ring Ever: pick up to 3 cards from your hand to discard, +2 each.
  const ring = canUseBiggestRing(s, r, me);
  const [ringPick, setRingPick] = useState<number[]>([]);
  const toggleRing = (id: number) => setRingPick((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 3 ? [...cur, id] : cur));
  return (
    <Dock
      tone="react"
      eyebrow="Modifier window"
      title={duel ? `Tip the duel? ${actorTotal} vs ${challengerTotal}` : `Modify ${seatName(s, r.byPlayerId)}'s roll of ${actorTotal}?`}
      actions={
        <>
          {owedSign && (
            <>
              <button className="hts-modbtn" onClick={() => onSend({ type: 'majestelkSign', playerId: me, sign: 1, targetSide: owedSign })}>+5<small>Majestelk</small></button>
              <button className="hts-modbtn" onClick={() => onSend({ type: 'majestelkSign', playerId: me, sign: -1, targetSide: owedSign })}>−5<small>Majestelk</small></button>
            </>
          )}
          {shaman && (
            <button className="secondary tiny" title="The Noble Shaman: once per turn, -1 to any roll" onClick={() => onSend({ type: 'nobleShamanAdjust', playerId: me, delta: -1, targetSide: side })}>
              Noble Shaman −1
            </button>
          )}
          {mods.flatMap((m) => modifierValuesFor(r, me, m).map((val) => (
            <button
              key={`${m.id}-${val}`}
              className="hts-modbtn"
              onClick={() => onSend({ type: 'playModifier', playerId: me, cardId: m.id, chosenValue: val, protectingHornDelta: isHorn ? horn : undefined, targetSide: side })}
            >
              {val >= 0 ? `+${val}` : `−${Math.abs(val)}`}
              <small>{m.name.replace('Modifier ', '')}</small>
            </button>
          )))}
          <button className="secondary" disabled={!!owedSign} title={owedSign ? 'Choose +5 or −5 for Majestelk first' : undefined} onClick={() => onSend({ type: 'declineModifier', playerId: me })}>Pass</button>
        </>
      }
    >
      {duel ? `${seatName(s, r.byPlayerId)} defends ${subject} against ${seatName(s, r.challengerId)}.` : `For ${subject}: ${r.reason === 'monsterAttack' ? 'a monster attack' : `needs ${rollLabel(r.threshold, r.rollLow)}`}.`}
      {ring && (
        <div className="hts-ring-pick">
          <span>Biggest Ring Ever — discard up to 3 for +2 each:</span>
          {handOf(s, me).map((c) => (
            <HtsCardView key={c.id} card={c} size="xs" selected={ringPick.includes(c.id)} onClick={() => toggleRing(c.id)} />
          ))}
          <button className="secondary tiny" disabled={ringPick.length === 0} onClick={() => onSend({ type: 'biggestRingDiscard', playerId: me, cardIds: ringPick })}>
            Discard {ringPick.length} · +{2 * ringPick.length}
          </button>
        </div>
      )}
      {(duel || isHorn) && (mods.length > 0 || shaman) && (
        <div className="hts-picker">
          {duel && (
            <>
              <span>Help:</span>
              <button className={`secondary tiny${side === 'actor' ? ' is-on' : ''}`} onClick={() => setSide('actor')}>{seatName(s, r.byPlayerId)}</button>
              <button className={`secondary tiny${side === 'challenger' ? ' is-on' : ''}`} onClick={() => setSide('challenger')}>{seatName(s, r.challengerId)}</button>
            </>
          )}
          {isHorn && (
            <>
              <span>Protecting Horn:</span>
              <button className={`secondary tiny${horn === 1 ? ' is-on' : ''}`} onClick={() => setHorn(1)}>extra +1</button>
              <button className={`secondary tiny${horn === -1 ? ' is-on' : ''}`} onClick={() => setHorn(-1)}>extra −1</button>
            </>
          )}
        </div>
      )}
    </Dock>
  );
}

function BullseyeDock({ cards, onConfirm }: { cards: HtsCard[]; onConfirm: (pick: number, order: number[]) => void }) {
  const [pick, setPick] = useState<number | null>(cards[0]?.id ?? null);
  const [swap, setSwap] = useState(false);
  const rest = cards.filter((c) => c.id !== pick);
  const ordered = swap && rest.length === 2 ? [rest[1]!, rest[0]!] : rest;
  return (
    <Dock
      tone="turn"
      eyebrow="Bullseye"
      title="Keep one, stack the rest"
      actions={<button disabled={pick === null} onClick={() => pick !== null && onConfirm(pick, ordered.map((c) => c.id))}>Confirm</button>}
    >
      Click the card to keep. The others go back on top{ordered.length === 2 ? `: ${ordered[0]!.name} first, then ${ordered[1]!.name}` : ''}.
      {ordered.length === 2 && <button className="secondary tiny" style={{ marginLeft: 8 }} onClick={() => setSwap((v) => !v)}>Swap order</button>}
      <div className="hts-choices">
        {cards.map((c) => <HtsCardView key={c.id} card={c} size="sm" selected={pick === c.id} onClick={() => setPick(c.id)} footnote={pick === c.id ? 'keep' : undefined} />)}
      </div>
    </Dock>
  );
}
