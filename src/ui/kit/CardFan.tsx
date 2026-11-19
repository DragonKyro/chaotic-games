// A hand of cards: a gentle arc, cards overlapping just enough to fit the
// width (set --cg-card-w to the card width), hover-lift, and a deal-in for
// cards that just arrived. Works with any card element — pass keyed children.

import { Children, isValidElement, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';

/** How long a card counts as just-dealt (covers the stagger plus the animation). */
const NEW_MS = 1200;

export function CardFan({ children, className, maxTilt = 10, arc = 1, label }: {
  children: ReactNode;
  className?: string;
  /** Degrees of rotation at the outermost card. */
  maxTilt?: number;
  /** Arc depth multiplier (0 = flat row). */
  arc?: number;
  label?: string;
}) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const n = items.length;
  const keys = items.map((c) => String(c.key));

  // When each card first showed up. A card keeps its deal-in for NEW_MS even
  // if the hand re-renders meanwhile (an AI move landing mid-animation).
  const born = useRef(new Map<string, number>());
  const now = performance.now();
  for (const k of keys) if (!born.current.has(k)) born.current.set(k, now);
  for (const k of born.current.keys()) if (!keys.includes(k)) born.current.delete(k);
  const batch = new Map<number, number>(); // born time -> cards placed so far (for the stagger)

  const mid = (n - 1) / 2;
  const step = n > 1 ? Math.min(maxTilt / Math.max(mid, 1), 6) : 0;
  return (
    <div
      className={`cg-fan${className ? ` ${className}` : ''}`}
      style={{ '--fan-n': n } as CSSProperties}
      aria-label={label}
    >
      {items.map((child, i) => {
        const off = i - mid;
        const t = born.current.get(keys[i]!)!;
        const isNew = now - t < NEW_MS;
        const order = batch.get(t) ?? 0;
        batch.set(t, order + 1);
        const style = {
          '--tilt': `${(off * step).toFixed(2)}deg`,
          '--drop': `${(Math.abs(off) ** 1.6 * 2.2 * arc).toFixed(1)}px`,
          // Constant per card: the slot's DOM node (and its animation clock) persists across renders.
          '--deal-delay': `${order * 55}ms`,
          zIndex: i + 1,
        } as CSSProperties;
        return (
          <div key={keys[i]} className={`cg-fan-slot${isNew ? ' is-new' : ''}`} style={style}>
            {child}
          </div>
        );
      })}
    </div>
  );
}
