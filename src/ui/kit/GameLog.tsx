// The move log, newest at the bottom, each line marked with its player's colour.

import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/core/state';
import type { Seat } from '@/core/types';

export function GameLog({ entries, seats, title = 'Table talk', limit = 40, className }: {
  entries: readonly LogEntry[];
  seats: readonly Seat[];
  title?: string;
  limit?: number;
  className?: string;
}) {
  const ref = useRef<HTMLOListElement>(null);
  const shown = entries.slice(-limit);
  const top = shown.length ? shown[shown.length - 1]!.seq : 0;
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [top]);
  const color = (id: string | null) => (id ? seats.find((s) => s.id === id)?.color : undefined);
  return (
    <section className={`cg-log${className ? ` ${className}` : ''}`}>
      <h4 className="cg-log-title">{title}</h4>
      <ol ref={ref} className="cg-log-list">
        {shown.map((e) => (
          <li key={e.seq} className={`cg-log-${e.tone}`}>
            <span className="cg-log-dot" style={{ background: color(e.byPlayerId) ?? 'transparent' }} />
            <span>{e.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
