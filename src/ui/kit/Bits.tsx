// Small shared pieces: the lobby's expansion picker, dice, an animated tally,
// and a hover-to-inspect zoom for cards whose text is too small to read.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ExpansionMeta } from '@/core/types';
import { useChangeKey } from './hooks';

/** Expansion toggles for a LobbyConfig. `lockedReason(id)` disables one with an explanation. */
export function ExpansionPicker({ expansions, enabled, onToggle, readOnly, lockedReason, title = 'Expansions' }: {
  expansions: readonly ExpansionMeta[];
  enabled: readonly string[];
  onToggle: (id: string) => void;
  readOnly?: boolean;
  lockedReason?: (id: string) => string | null;
  title?: string;
}) {
  return (
    <div className="cg-expansions">
      <div className="cg-expansions-head">
        <span>{title}</span>
        <span className="cg-expansions-count">{enabled.length} / {expansions.length}</span>
      </div>
      <div className="cg-expansions-grid">
        {expansions.map((e) => {
          const on = enabled.includes(e.id);
          const locked = lockedReason?.(e.id) ?? null;
          return (
            <label key={e.id} className={`cg-exp${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}`} title={locked ?? e.summary}>
              <input type="checkbox" checked={on} disabled={readOnly || !!locked} onChange={() => onToggle(e.id)} />
              <span className="cg-exp-check" aria-hidden="true">{on ? '✓' : ''}</span>
              <span className="cg-exp-text">
                <span className="cg-exp-name">{e.name}{!e.verified && <em className="cg-exp-unverified"> · unverified</em>}</span>
                <span className="cg-exp-summary">{locked ?? e.summary}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 26], [72, 26], [28, 50], [72, 50], [28, 74], [72, 74]],
};

/**
 * A die. `value` 1–6 draws pips; any other node is drawn as the face (resource
 * symbols). It tumbles whenever `rollKey` changes.
 */
export function Die({ value, rollKey, size = 46, color = '#fbf7ee', pip = '#1a1424', title }: {
  value: number | ReactNode;
  rollKey?: unknown;
  size?: number;
  color?: string;
  pip?: string;
  title?: string;
}) {
  const k = useChangeKey(rollKey);
  return (
    <span className="cg-die" style={{ width: size, height: size, '--die': color } as CSSProperties} title={title}>
      <span key={k} className={`cg-die-face${k ? ' is-rolling' : ''}`}>
        {typeof value === 'number' && PIPS[value] ? (
          <svg viewBox="0 0 100 100" aria-label={String(value)}>
            {PIPS[value]!.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={10} fill={pip} />)}
          </svg>
        ) : (
          value
        )}
      </span>
    </span>
  );
}

/** A number that pops when it changes (scores, counts). */
export function Tally({ value, className }: { value: number | string; className?: string }) {
  const k = useChangeKey(value);
  return <span key={k} className={`cg-tally${k ? ' is-changed' : ''}${className ? ` ${className}` : ''}`}>{value}</span>;
}

/**
 * Hover (mouse) or keyboard-focus a card for a moment to see `preview` large,
 * pinned beside the pointer and kept on screen.
 */
export function Inspect({ children, preview, delay = 380, className }: {
  children: ReactNode;
  preview: ReactNode;
  delay?: number;
  className?: string;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef({ x: 0, y: 0 });
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPos(null);
  };
  const place = (x: number, y: number) => {
    // Beside the pointer, flipped to whichever side has room.
    const W = 300;
    const H = 420;
    const left = x + 24 + W > window.innerWidth ? x - 24 - W : x + 24;
    const top = Math.min(Math.max(8, y - H / 2), window.innerHeight - H - 8);
    return { x: Math.max(8, left), y: top };
  };
  return (
    <span
      className={`cg-inspect${className ? ` ${className}` : ''}`}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'mouse') return;
        last.current = { x: e.clientX, y: e.clientY };
        timer.current = setTimeout(() => setPos(place(last.current.x, last.current.y)), delay);
      }}
      onPointerMove={(e) => {
        last.current = { x: e.clientX, y: e.clientY };
        if (pos) setPos(place(e.clientX, e.clientY));
      }}
      onPointerLeave={cancel}
      onPointerDown={cancel}
    >
      {children}
      {pos && (
        <span className="cg-inspect-pop" style={{ left: pos.x, top: pos.y }} aria-hidden="true">
          {preview}
        </span>
      )}
    </span>
  );
}
