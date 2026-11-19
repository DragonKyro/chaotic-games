// The end of a match: who won, how everyone placed, confetti for a win.

import type { CSSProperties, ReactNode } from 'react';
import type { PlayerId, Seat } from '@/core/types';
import { SeatAvatar } from './Table';
import { Confetti } from './Fx';

export function GameOverPanel({
  seats, finalScores, winnerIds, noWinner = false, localPlayerId, headline, detail, scoreLabel = 'pts', showScores = true, ranks = true, art, className,
}: {
  seats: readonly Seat[];
  finalScores: Record<PlayerId, number> | null;
  /** Defaults to whoever tops finalScores. */
  winnerIds?: readonly PlayerId[];
  /** The match ended with nobody winning (e.g. a dead tie where everyone loses). */
  noWinner?: boolean;
  localPlayerId: PlayerId | null;
  /** Replaces "<name> wins!". */
  headline?: ReactNode;
  detail?: ReactNode;
  scoreLabel?: string;
  /** False when finalScores are only a ranking (e.g. "players outlasted"). */
  showScores?: boolean;
  /** False to leave out the standings (a game that draws its own finale lineup). */
  ranks?: boolean;
  /** Game art beside the headline (a trophy, a survivor). */
  art?: ReactNode;
  className?: string;
}) {
  const score = (id: PlayerId) => finalScores?.[id] ?? 0;
  const ranked = [...seats].sort((a, b) => score(b.id) - score(a.id));
  const winners = noWinner ? [] : winnerIds?.length ? [...winnerIds] : ranked.length ? ranked.filter((s) => score(s.id) === score(ranked[0]!.id)).map((s) => s.id) : [];
  const winnerSeats = winners.map((id) => seats.find((s) => s.id === id)).filter((s): s is Seat => !!s);
  const youWon = !!localPlayerId && winners.includes(localPlayerId);
  const title = headline ?? (noWinner || !winnerSeats.length ? 'No winner' : winnerSeats.length === 1 ? `${winnerSeats[0]!.name} wins!` : `${winnerSeats.map((s) => s.name).join(' & ')} tie!`);
  let place = 0;
  let prevScore: number | null = null;
  return (
    <section
      className={`cg-gameover${youWon ? ' is-you' : ''}${className ? ` ${className}` : ''}`}
      style={{ '--seat': winnerSeats[0]?.color ?? 'var(--cg-accent)' } as CSSProperties}
    >
      {youWon && <Confetti colors={[winnerSeats[0]?.color ?? '#ffd23f', '#ffd23f', '#ffffff', '#ff5a6a', '#2de2c4']} />}
      <div className="cg-gameover-head">
        {art && <div className="cg-gameover-art">{art}</div>}
        <div>
          <div className="cg-gameover-eyebrow">{youWon ? 'Victory' : 'Game over'}</div>
          <h2 className="cg-gameover-title">{title}</h2>
          {detail && <div className="cg-gameover-detail">{detail}</div>}
        </div>
      </div>
      {ranks && <ol className="cg-gameover-ranks">
        {ranked.map((s, i) => {
          if (prevScore === null || score(s.id) !== prevScore) place = i + 1;
          prevScore = score(s.id);
          return (
            <li key={s.id} className={winners.includes(s.id) ? 'is-winner' : undefined} style={{ '--seat': s.color, '--i': i } as CSSProperties}>
              <span className="cg-rank">{place}</span>
              <SeatAvatar seat={s} size={28} />
              <span className="cg-rank-name">{s.name}{s.id === localPlayerId && <span className="cg-tag cg-tag-you">you</span>}</span>
              {showScores && finalScores && <span className="cg-rank-score">{score(s.id)} <small>{scoreLabel}</small></span>}
            </li>
          );
        })}
      </ol>}
    </section>
  );
}
