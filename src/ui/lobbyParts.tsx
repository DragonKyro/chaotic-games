// Pieces shared by the local lobby (GameLobby) and the online one (OnlineLobby).

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { SEAT_COLORS, SEAT_COLOR_LABELS } from '@/core/seatColors';
import type { AnyGameModule } from '@/core/module';
import type { Seat } from '@/core/types';
import { seatAiLevel } from '@/core/seats';

/** Clickable seat-color picker. Shows the current swatch; clicking opens a
 *  small popover grid of the palette. Colors already used by OTHER seats are
 *  dimmed + show a tooltip saying which seat took them. */
export function ColorSwatchPicker({ value, takenBy, disabled, onChange }: {
  value: string;
  takenBy: Record<string, string>;
  disabled?: boolean;
  onChange: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        className="swatch-button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        title={SEAT_COLOR_LABELS[value] ?? value}
        aria-label={`Seat color: ${SEAT_COLOR_LABELS[value] ?? value}`}
        style={{ background: value }}
      />
      {open && !disabled && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 29 }} />
          <div className="swatch-pop" onClick={(e) => e.stopPropagation()}>
            {SEAT_COLORS.map((c) => {
              const taken = takenBy[c];
              return (
                <button
                  key={c}
                  type="button"
                  className={c === value ? 'is-current' : undefined}
                  onClick={() => { onChange(c); setOpen(false); }}
                  title={taken ? `${SEAT_COLOR_LABELS[c]} — taken by ${taken}` : SEAT_COLOR_LABELS[c]}
                  disabled={!!taken}
                  style={{ background: c }}
                />
              );
            })}
          </div>
        </>
      )}
    </span>
  );
}

/** A name field that commits after a pause, on blur or on Enter — not on
 *  every keystroke (online, each commit is a write to the room). */
export function NameInput({ value, onCommit, disabled, className, maxLength = 24 }: {
  value: string;
  onCommit: (name: string) => void;
  disabled?: boolean;
  className?: string;
  maxLength?: number;
}) {
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Follow the room's value unless the user is mid-edit.
  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const commit = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const clean = next.trim();
    if (clean && clean !== value) onCommit(clean);
  };
  return (
    <input
      className={className}
      value={draft}
      disabled={disabled}
      maxLength={maxLength}
      onFocus={() => { editing.current = true; }}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(next), 600);
      }}
      onBlur={() => {
        editing.current = false;
        commit(draft);
        if (!draft.trim()) setDraft(value);
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    />
  );
}

export function ChatInput({ onSend }: { onSend: (s: string) => void }) {
  const [v, setV] = useState('');
  return (
    <form className="chat-form" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onSend(v); setV(''); } }}>
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Chat…" maxLength={200} />
      <button type="submit" disabled={!v.trim()}>Send</button>
    </form>
  );
}

export function RulesModal({ title, Rules, onClose }: { title: string; Rules: React.ComponentType; onClose(): void }) {
  return (
    <div className="rules-modal-backdrop" onClick={onClose}>
      <div className="rules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rules-modal-header">
          <h3>{title} · Rules</h3>
          <button className="secondary tiny" onClick={onClose}>Close ✕</button>
        </div>
        <div className="rules-modal-body">
          <Rules />
        </div>
      </div>
    </div>
  );
}

export function playerRange(g: Pick<AnyGameModule, 'minPlayers' | 'maxPlayers'>): string {
  return g.minPlayers === g.maxPlayers ? `${g.minPlayers} players` : `${g.minPlayers}–${g.maxPlayers} players`;
}

/** The game's art, name and pitch across the top of a lobby panel. */
export function LobbyBanner({ module, children }: { module: AnyGameModule; children?: ReactNode }) {
  const Thumb = module.Thumbnail;
  return (
    <div className="lobby-banner" style={module.accent ? ({ '--tile-accent': module.accent } as React.CSSProperties) : undefined}>
      <div className="lobby-banner-art">{Thumb && <Thumb />}</div>
      <div>
        {children ?? <h3>{module.name}</h3>}
        <p>{module.tagline}</p>
        <p className="lobby-hint" style={{ marginTop: 6 }}>{playerRange(module)}</p>
      </div>
    </div>
  );
}

/** The levels an AI seat can be set to in this game, or null when its AI has one strength. */
function seatLevels(module: AnyGameModule): ReadonlyArray<{ id: string; label: string }> | null {
  return module.aiLevels && module.aiLevels.length > 1 ? module.aiLevels : null;
}

/** The level an AI seat plays at in this game (its own, else the module's default). */
function seatLevelId(module: AnyGameModule, seat: Seat): string | undefined {
  const levels = module.aiLevels;
  if (!levels?.length) return undefined;
  return seatAiLevel(levels, module.defaultAiLevel ?? levels[levels.length - 1]!.id, seat);
}

/** Per-seat AI difficulty picker; nothing for human seats or one-strength AIs. */
export function AiLevelSelect({ module, seat, disabled, onChange }: {
  module: AnyGameModule;
  seat: Seat;
  disabled?: boolean;
  onChange: (level: string) => void;
}) {
  const levels = seatLevels(module);
  if (!seat.isAI || !levels) return null;
  const value = seatLevelId(module, seat);
  if (disabled) {
    return <span className="online-tag">{levels.find((l) => l.id === value)?.label ?? value}</span>;
  }
  return (
    <select
      className="seat-level"
      aria-label={`${seat.name} difficulty`}
      title="AI difficulty"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
    </select>
  );
}
