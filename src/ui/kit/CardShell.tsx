// A card's outer element, the same for every game's frame: a pressable
// <button> when it can be clicked, a plain <div> otherwise, optionally
// wrapped in a hover zoom. The game draws the frame (className, style) and
// the face (children).

import type { CSSProperties, ReactNode } from 'react';
import { Inspect } from './Bits';

export function CardShell({ className, style, onClick, disabled, selected, label, title, preview, children }: {
  className: string;
  style?: CSSProperties;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  /** Accessible name of a clickable card, and the hover title of one that isn't (unless `title` is set). */
  label?: string;
  title?: string;
  /** A large copy shown on hover (mouse) — leave out for cards already big enough to read. */
  preview?: ReactNode;
  children: ReactNode;
}) {
  const body = onClick && !disabled ? (
    <button type="button" className={className} style={style} onClick={onClick} aria-pressed={selected} aria-label={label} title={title}>
      {children}
    </button>
  ) : (
    <div className={className} style={style} title={title ?? label}>
      {children}
    </div>
  );
  return preview ? <Inspect preview={preview}>{body}</Inspect> : body;
}
