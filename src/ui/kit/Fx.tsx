// Transient table effects: rubber stamps ("NOPE!"), particle bursts, toasts,
// the "your turn" cue and confetti. All CSS animation over a pointer-events:
// none layer; nothing here touches game state.
//
//   const fx = useFx();
//   // in an effect comparing the previous state with this one:
//   if (nopesNow > nopesBefore) fx.stamp('NOPE!', 'danger');
//   <GameTable … overlay={<FxLayer fx={fx} />} />
//
// Fire effects from state transitions, never by parsing log text.

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';

export type FxTone = 'accent' | 'danger' | 'good' | 'neutral';

interface FxItem {
  id: number;
  kind: 'stamp' | 'toast' | 'burst';
  content?: ReactNode;
  tone: FxTone;
  /** Burst origin, as a fraction of the layer (0..1). */
  at?: [number, number];
  color?: string;
}

export interface Fx {
  items: FxItem[];
  /** A big word slammed onto the middle of the table. */
  stamp(content: ReactNode, tone?: FxTone): void;
  /** A short line sliding down from the top. */
  toast(content: ReactNode, tone?: FxTone): void;
  /** A ring of particles at (x, y) in 0..1 of the table. */
  burst(at?: [number, number], color?: string): void;
}

const LIFETIME: Record<FxItem['kind'], number> = { stamp: 1300, toast: 2600, burst: 900 };

export function useFx(): Fx {
  const [items, setItems] = useState<FxItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const live = timers.current;
    return () => live.forEach(clearTimeout);
  }, []);
  const add = useCallback((item: Omit<FxItem, 'id'>) => {
    const id = nextId.current++;
    // At most three of a kind on screen; the oldest makes room.
    setItems((cur) => {
      const same = cur.filter((x) => x.kind === item.kind);
      const drop = same.length >= 3 ? same[0]!.id : null;
      return [...cur.filter((x) => x.id !== drop), { ...item, id }];
    });
    const t = setTimeout(() => {
      timers.current.delete(t);
      setItems((cur) => cur.filter((x) => x.id !== id));
    }, LIFETIME[item.kind]);
    timers.current.add(t);
  }, []);
  return useMemo(() => ({
    items,
    stamp: (content, tone = 'accent') => add({ kind: 'stamp', content, tone }),
    toast: (content, tone = 'neutral') => add({ kind: 'toast', content, tone }),
    burst: (at = [0.5, 0.45], color) => add({ kind: 'burst', tone: 'accent', at, color }),
  }), [items, add]);
}

const BURST_N = 14;

export function FxLayer({ fx }: { fx: Fx }) {
  return (
    <div className="cg-fx" aria-live="polite">
      {fx.items.map((it) => {
        if (it.kind === 'stamp') {
          return (
            <div key={it.id} className={`cg-fx-stamp cg-fx-${it.tone}`} style={{ '--stamp-tilt': `${(it.id % 3) * 5 - 9}deg` } as CSSProperties}>
              {it.content}
            </div>
          );
        }
        if (it.kind === 'toast') {
          return <div key={it.id} className={`cg-fx-toast cg-fx-${it.tone}`}>{it.content}</div>;
        }
        const [x, y] = it.at ?? [0.5, 0.45];
        return (
          <div key={it.id} className="cg-fx-burst" style={{ left: `${x * 100}%`, top: `${y * 100}%` }}>
            {Array.from({ length: BURST_N }, (_, i) => {
              const a = (i / BURST_N) * Math.PI * 2;
              const d = 60 + ((i * 37) % 50);
              return (
                <span
                  key={i}
                  style={{
                    '--dx': `${Math.cos(a) * d}px`,
                    '--dy': `${Math.sin(a) * d}px`,
                    '--rot': `${(i % 2 ? 1 : -1) * 220}deg`,
                    background: it.color ?? (i % 3 === 0 ? '#ffd23f' : i % 3 === 1 ? '#ff5a6a' : '#2de2c4'),
                  } as CSSProperties}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Slides a banner in when `active` turns true ("Your turn"), then gets out of the way. */
export function TurnCue({ active, children = 'Your turn' }: { active: boolean; children?: ReactNode }) {
  const [show, setShow] = useState(0);
  const was = useRef(active);
  useEffect(() => {
    if (active && !was.current) setShow((n) => n + 1);
    was.current = active;
  }, [active]);
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => setShow(0), 1500);
    return () => clearTimeout(t);
  }, [show]);
  if (!show) return null;
  return <div key={show} className="cg-turn-cue" role="status">{children}</div>;
}

const CONFETTI = 70;

/** A one-shot confetti fall over the whole screen. */
export function Confetti({ colors = ['#ffd23f', '#ff5a6a', '#2de2c4', '#9b6bff', '#ffffff'] }: { colors?: string[] }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI }, (_, i) => ({
        left: (i * 61) % 100,
        delay: (i * 37) % 900,
        dur: 1800 + ((i * 53) % 1400),
        dx: ((i * 29) % 160) - 80,
        rot: 360 + ((i * 97) % 720),
        color: colors[i % colors.length]!,
        wide: i % 3 === 0,
      })),
    [colors],
  );
  return (
    <div className="cg-confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <span
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            width: p.wide ? 12 : 7,
            animationDelay: `${p.delay}ms`,
            animationDuration: `${p.dur}ms`,
            '--dx': `${p.dx}px`,
            '--rot': `${p.rot}deg`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
