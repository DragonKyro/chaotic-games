// The decision dock: the one place on the table that says what the local
// player has to do right now — and the waiting state when it's someone else.

import { useEffect, useRef, type ReactNode } from 'react';
import type { Seat } from '@/core/types';

export type DockTone = 'turn' | 'react' | 'wait' | 'info' | 'danger';

export function Dock({ tone = 'turn', title, eyebrow, children, actions, who, className }: {
  /** turn: your move. react: answer now (out of turn). wait: someone else is deciding. danger: high stakes. */
  tone?: DockTone;
  title: ReactNode;
  /** Small caps line above the title ("Your turn", "Nope window"). */
  eyebrow?: ReactNode;
  children?: ReactNode;
  /** Buttons, right-aligned on wide screens. */
  actions?: ReactNode;
  /** Whose decision it is, for the wait tone. */
  who?: Seat | null;
  className?: string;
}) {
  // Re-run the entrance whenever the decision itself changes.
  const ref = useRef<HTMLDivElement>(null);
  const titleKey = typeof title === 'string' ? title : '';
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;
    el.animate([{ transform: 'translateY(8px)', opacity: 0.4 }, { transform: 'none', opacity: 1 }], {
      duration: 260,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    });
  }, [tone, titleKey]);
  return (
    <div ref={ref} className={`cg-dock cg-dock-${tone}${className ? ` ${className}` : ''}`} role={tone === 'react' ? 'alert' : undefined}>
      <div className="cg-dock-text">
        {(eyebrow || (tone === 'wait' && who)) && (
          <div className="cg-dock-eyebrow">
            {tone === 'wait' && who ? <><span className="cg-dock-dot" style={{ background: who.color }} />{eyebrow ?? `${who.name} is deciding`}<span className="cg-dots" /></> : eyebrow}
          </div>
        )}
        <div className="cg-dock-title">{title}</div>
        {children && <div className="cg-dock-body">{children}</div>}
      </div>
      {actions && <div className="cg-dock-actions">{actions}</div>}
    </div>
  );
}
