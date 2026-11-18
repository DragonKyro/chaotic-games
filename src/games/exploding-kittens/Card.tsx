// A single rendered card. Used in hands, the discard pile, peeks and prompts.

import { CARD_ACCENT, CardArt, CardBack } from './CardArt';
import { CARD_LABEL, CARD_TEXT } from './cards';
import type { EkBaseCardKind } from './types';

interface Props {
  kind: EkBaseCardKind;
  selected?: boolean;
  disabled?: boolean;
  /** Compact rendering for the discard pile and inline mentions. */
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  /** Extra line under the name, e.g. "×3 in deck". */
  footnote?: string;
}

export function Card({ kind, selected, disabled, size = 'md', onClick, footnote }: Props) {
  const interactive = !!onClick && !disabled;
  const className = [
    'ek-card',
    `ek-card-${size}`,
    selected ? 'is-selected' : '',
    disabled ? 'is-disabled' : '',
    interactive ? 'is-interactive' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={className}
      style={{ '--ek-accent': CARD_ACCENT[kind] } as React.CSSProperties}
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      title={`${CARD_LABEL[kind]} — ${CARD_TEXT[kind]}`}
      aria-pressed={selected}
    >
      <span className="ek-card-art">
        <CardArt kind={kind} />
      </span>
      <span className="ek-card-name">{CARD_LABEL[kind]}</span>
      {footnote && <span className="ek-card-foot">{footnote}</span>}
    </button>
  );
}

/** A face-down card — other players' hands, cursed hands, and the deck itself. */
export function FaceDownCard({
  size = 'md',
  label,
  selected,
  disabled,
  onClick,
}: {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const interactive = !!onClick && !disabled;
  const className = [
    'ek-card',
    `ek-card-${size}`,
    'is-facedown',
    selected ? 'is-selected' : '',
    disabled ? 'is-disabled' : '',
    interactive ? 'is-interactive' : '',
  ].filter(Boolean).join(' ');

  if (interactive) {
    return (
      <button type="button" className={className} onClick={onClick} aria-pressed={selected}>
        <span className="ek-card-art">
          <CardBack />
        </span>
        {label && <span className="ek-card-name">{label}</span>}
      </button>
    );
  }

  return (
    <div className={className}>
      <span className="ek-card-art">
        <CardBack />
      </span>
      {label && <span className="ek-card-name">{label}</span>}
    </div>
  );
}
