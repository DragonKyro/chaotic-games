// A rendered Unstable Unicorns card. Frame: holographic foil in the card
// type's colour (the sheen sweeps across on hover, never on its own), a plum
// art window, a corner glyph, the name in Shrikhand. Large cards carry the
// rules text; smaller ones show it on hover (Inspect).

import type { CSSProperties } from 'react';
import { CardShell } from '@/ui/kit';
import { CardArt, CardBack, TYPE_META, TypeGlyph, windowTint } from './CardArt';
import type { UuCard } from './types';

type Size = 'xs' | 'sm' | 'md' | 'lg';

type CardFace = Pick<UuCard, 'kind' | 'type' | 'name' | 'text'>;

function style(card: CardFace): CSSProperties {
  const m = TYPE_META[card.type];
  return { '--uu-frame': m.frame, '--uu-frame2': m.frame2, '--uu-window': windowTint(card.kind) } as CSSProperties;
}

function Face({ card, size, footnote }: { card: CardFace; size: Size; footnote?: string }) {
  return (
    <>
      <span className="uu-card-art"><CardArt card={card} /></span>
      <span className="uu-card-glyph" title={TYPE_META[card.type].label}><TypeGlyph type={card.type} /></span>
      <span className="uu-card-name">{card.name}</span>
      {size === 'lg' && (
        <>
          <span className="uu-card-type">{TYPE_META[card.type].label}</span>
          <span className="uu-card-text">{card.text}</span>
        </>
      )}
      {footnote && <span className="uu-card-foot">{footnote}</span>}
    </>
  );
}

export function UuCardView({ card, size = 'md', selected, disabled, onClick, footnote, inspect, className }: {
  card: CardFace;
  size?: Size;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  footnote?: string;
  /** Hover for a big, readable copy. On by default for xs / sm / md. */
  inspect?: boolean;
  className?: string;
}) {
  const interactive = !!onClick && !disabled;
  const cls = [
    'uu-card',
    `uu-card-${size}`,
    `uu-t-${card.type}`,
    selected && 'is-selected',
    disabled && 'is-disabled',
    interactive && 'is-interactive',
    className,
  ].filter(Boolean).join(' ');
  const label = `${card.name} (${TYPE_META[card.type].label}): ${card.text}`;
  const zoom = inspect ?? size !== 'lg';
  return (
    <CardShell
      className={cls}
      style={style(card)}
      onClick={onClick}
      disabled={disabled}
      selected={selected}
      label={label}
      preview={zoom ? <div className={`uu-card uu-card-lg uu-card-preview uu-t-${card.type}`} style={style(card)}><Face card={card} size="lg" /></div> : undefined}
    >
      <Face card={card} size={size} footnote={footnote} />
    </CardShell>
  );
}

/** A face-down card: the deck, other players' hands. */
export function UuCardBack({ size = 'md', label, className }: { size?: Size; label?: string; className?: string }) {
  return (
    <div className={`uu-card uu-card-${size} is-facedown${className ? ` ${className}` : ''}`}>
      <CardBack />
      {label && <span className="uu-back-label">{label}</span>}
    </div>
  );
}
