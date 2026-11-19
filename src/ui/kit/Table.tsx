// The table every game view is laid out on, and the player plates around it.
//
//   ┌──────────────── top (opponents) ────────────────┐
//   │ board                                  │ side   │
//   │                                        │ (log)  │
//   │ dock (your decision)                   │        │
//   ├──────────────── hand ───────────────────────────┤
//
// A game themes it by setting the --cg-* variables (kit.css) on its own
// class, e.g. <GameTable className="ek-table" …>.

import type { CSSProperties, ReactNode } from 'react';
import type { Seat } from '@/core/types';

export function GameTable({ className, style, top, board, side, dock, hand, overlay }: {
  className?: string;
  style?: CSSProperties;
  /** Opponents, usually a <PlayerStrip>. */
  top?: ReactNode;
  /** The shared play area. */
  board: ReactNode;
  /** Log, scores, reference — beside the board on wide screens, below on narrow. */
  side?: ReactNode;
  /** The local player's current decision (a <Dock>). */
  dock?: ReactNode;
  /** The local player's own area: hand, tableau. */
  hand?: ReactNode;
  /** Absolutely positioned FX (an <FxLayer>, <TurnCue>, <Confetti>). */
  overlay?: ReactNode;
}) {
  return (
    <div className={`cg-table${className ? ` ${className}` : ''}`} style={style}>
      {top && <div className="cg-table-top">{top}</div>}
      <div className="cg-table-board">{board}</div>
      {side && <aside className="cg-table-side">{side}</aside>}
      {dock && <div className="cg-table-dock">{dock}</div>}
      {hand && <div className="cg-table-hand">{hand}</div>}
      {overlay}
    </div>
  );
}

export function PlayerStrip({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`cg-strip${className ? ` ${className}` : ''}`}>{children}</div>;
}

/** The default avatar: the seat's colour with its initial (AI seats get a visor). */
export function SeatAvatar({ seat, size = 40 }: { seat: Seat; size?: number }) {
  const initial = (seat.name.trim()[0] ?? '?').toUpperCase();
  return (
    <svg className="cg-avatar" viewBox="0 0 40 40" width={size} height={size} aria-hidden="true">
      <circle cx={20} cy={20} r={18} fill={seat.color} stroke="var(--cg-ink, #120c1f)" strokeWidth={2.5} />
      <circle cx={15} cy={13} r={6} fill="#fff" opacity={0.22} />
      {seat.isAI ? (
        <g>
          <rect x={9} y={15} width={22} height={9} rx={4.5} fill="var(--cg-ink, #120c1f)" />
          <circle cx={15} cy={19.5} r={2} fill="#7ef7e1" />
          <circle cx={25} cy={19.5} r={2} fill="#7ef7e1" />
          <path d="M20 4 v5" stroke="var(--cg-ink, #120c1f)" strokeWidth={2.2} strokeLinecap="round" />
          <circle cx={20} cy={4} r={2.2} fill="var(--cg-ink, #120c1f)" />
        </g>
      ) : (
        <text x={20} y={26.5} textAnchor="middle" fontSize={17} fontWeight={800} fill="var(--cg-ink, #120c1f)" fontFamily="var(--font-ui)">
          {initial}
        </text>
      )}
    </svg>
  );
}

/**
 * A player's nameplate. `active` gives it the turn glow, `out` greys it and
 * stamps it, `targetable` + `onClick` turn it into a target picker.
 */
export function PlayerPlate({
  seat, you, active, out, outLabel = 'OUT', sub, avatar, children, onClick, targetable, selected, className,
}: {
  seat: Seat;
  you?: boolean;
  active?: boolean;
  out?: boolean;
  outLabel?: string;
  /** A short status line under the name (card count, score…). */
  sub?: ReactNode;
  /** Replaces the default <SeatAvatar>. */
  avatar?: ReactNode;
  /** Extra game-specific content (a mini tableau, chips). */
  children?: ReactNode;
  onClick?: () => void;
  targetable?: boolean;
  selected?: boolean;
  className?: string;
}) {
  const cls = [
    'cg-plate',
    active && 'is-active',
    out && 'is-out',
    you && 'is-you',
    targetable && 'is-target',
    selected && 'is-selected',
    className,
  ].filter(Boolean).join(' ');
  const clickable = !!onClick && (targetable ?? true);
  return (
    <div
      className={cls}
      style={{ '--seat': seat.color } as CSSProperties}
      onClick={clickable ? onClick : undefined}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick!(); } } : undefined}
    >
      <div className="cg-plate-avatar">{avatar ?? <SeatAvatar seat={seat} />}</div>
      <div className="cg-plate-main">
        <div className="cg-plate-name">
          <span className="cg-plate-label">{seat.name}</span>
          {you && <span className="cg-tag cg-tag-you">you</span>}
        </div>
        {sub != null && <div className="cg-plate-sub">{sub}</div>}
        {children}
      </div>
      {out && <div className="cg-plate-stamp">{outLabel}</div>}
    </div>
  );
}

/** A small count / status pill. */
export function Chip({ children, tone, title, icon }: {
  children: ReactNode;
  tone?: 'accent' | 'good' | 'danger' | 'dim';
  title?: string;
  icon?: ReactNode;
}) {
  return (
    <span className={`cg-chip${tone ? ` cg-chip-${tone}` : ''}`} title={title}>
      {icon && <span className="cg-chip-icon">{icon}</span>}
      {children}
    </span>
  );
}

/** A titled panel on the table (deck area, scoreboard, the log). */
export function Panel({ title, children, className, actions }: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={`cg-panel${className ? ` ${className}` : ''}`}>
      {(title || actions) && (
        <header className="cg-panel-head">
          {title && <h4>{title}</h4>}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
