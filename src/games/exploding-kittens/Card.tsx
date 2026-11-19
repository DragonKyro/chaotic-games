// A single rendered card. Used in hands, the discard pile, peeks and prompts.
//
// Frame: cream stock and a thick ink outline; the art sits in a lit window of
// the card's accent colour with halftone dots; the name rides a ribbon under
// it, and a corner badge says what kind of card it is. Large cards carry the
// rules text; smaller ones show it on hover (Inspect).

import type { CSSProperties } from 'react';
import { CardShell } from '@/ui/kit';
import { CARD_ACCENT, CardArt, CardBack, CategoryIcon, type EkCategory } from './CardArt';
import { CARD_LABEL, CARD_TEXT, isCatKind, isDefuseKind } from './cards';
import type { EkBaseCardKind } from './types';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const KITTENS: readonly EkBaseCardKind[] = ['explodingKitten', 'implodingKitten', 'barkingKitten'];
const REACTIONS: readonly EkBaseCardKind[] = ['nope', 'alterTheFutureNow'];

function cardCategory(kind: EkBaseCardKind): EkCategory {
  if (KITTENS.includes(kind)) return 'kitten';
  if (isDefuseKind(kind)) return 'defuse';
  if (isCatKind(kind)) return 'cat';
  if (REACTIONS.includes(kind)) return 'reaction';
  return 'action';
}

const CATEGORY_LABEL: Record<EkCategory, string> = {
  kitten: 'Kitten',
  defuse: 'Defuse',
  cat: 'Cat',
  reaction: 'Any time',
  action: 'Action',
};

interface Props {
  kind: EkBaseCardKind;
  selected?: boolean;
  disabled?: boolean;
  size?: Size;
  onClick?: () => void;
  /** Extra line under the name, e.g. "next" or "marked". */
  footnote?: string;
  /** Hover for a big, readable copy. On by default for sm / md. */
  inspect?: boolean;
  className?: string;
}

function Face({ kind, size, footnote }: { kind: EkBaseCardKind; size: Size; footnote?: string }) {
  const category = cardCategory(kind);
  return (
    <>
      <span className="ek-card-art">
        <CardArt kind={kind} />
      </span>
      <span className="ek-card-badge" title={CATEGORY_LABEL[category]}>
        <CategoryIcon category={category} />
      </span>
      <span className="ek-card-name">{CARD_LABEL[kind]}</span>
      {size === 'lg' && <span className="ek-card-text">{CARD_TEXT[kind]}</span>}
      {footnote && <span className="ek-card-foot">{footnote}</span>}
    </>
  );
}

export function Card({ kind, selected, disabled, size = 'md', onClick, footnote, inspect, className }: Props) {
  const interactive = !!onClick && !disabled;
  const cls = [
    'ek-card',
    `ek-card-${size}`,
    `ek-cat-${cardCategory(kind)}`,
    selected && 'is-selected',
    disabled && 'is-disabled',
    interactive && 'is-interactive',
    className,
  ].filter(Boolean).join(' ');
  const style = { '--ek-accent': CARD_ACCENT[kind] } as CSSProperties;
  const zoom = inspect ?? (size === 'sm' || size === 'md');
  return (
    <CardShell
      className={cls}
      style={style}
      onClick={onClick}
      disabled={disabled}
      selected={selected}
      label={`${CARD_LABEL[kind]}: ${CARD_TEXT[kind]}`}
      preview={zoom ? <div className="ek-card ek-card-lg ek-card-preview" style={style}><Face kind={kind} size="lg" /></div> : undefined}
    >
      <Face kind={kind} size={size} footnote={footnote} />
    </CardShell>
  );
}

/** A face-down card — other players' hands, cursed hands, and the deck itself. */
export function FaceDownCard({ size = 'md', label, selected, disabled, onClick, className }: {
  size?: Size;
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const interactive = !!onClick && !disabled;
  const cls = [
    'ek-card',
    `ek-card-${size}`,
    'is-facedown',
    selected && 'is-selected',
    disabled && 'is-disabled',
    interactive && 'is-interactive',
    className,
  ].filter(Boolean).join(' ');
  const inner = (
    <>
      <CardBack />
      {label && <span className="ek-card-back-label">{label}</span>}
    </>
  );
  return interactive ? (
    <button type="button" className={cls} onClick={onClick} aria-pressed={selected} aria-label={label ?? 'Face-down card'}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
