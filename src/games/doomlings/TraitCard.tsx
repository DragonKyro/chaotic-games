// Doomlings cards. A trait is a specimen slide: a membrane border in its
// colour(s), the living cell in a round well, its face value on a cell-shaped
// badge, marker glyphs for Dominant / Action / Drop of Life / World's End /
// Attachment / Indestructible / Swarm. Large cards carry the rules text;
// smaller ones show it on hover (Inspect).

import type { CSSProperties, ReactNode } from 'react';
import { CardShell, Inspect } from '@/ui/kit';
import { AgeArt, MARK_LABEL, MarkIcon, OrganelleArt, TraitBack, membraneCss, traitColors, traitMarks } from './art';
import { HUE } from './shapes';
import type { DmAgeCard, DmTraitCard } from './types';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const COLOR_WORD = { red: 'Red', blue: 'Blue', green: 'Green', purple: 'Purple', colorless: 'Colorless' } as const;

function colorLabel(c: DmTraitCard): string {
  if (c.isAllColors) return 'All colours';
  return traitColors(c).map((k) => COLOR_WORD[k]).join(' / ');
}

/** Long single words shrink to fit the card instead of breaking mid-word. */
function nameScale(name: string): CSSProperties | undefined {
  const longest = Math.max(...name.split(/[\s-]+/).map((w) => w.length));
  return longest > 9 ? ({ '--ns': (9.5 / longest).toFixed(2) } as CSSProperties) : undefined;
}

function Face({ card, size, protectedCard, foot }: { card: DmTraitCard; size: CardSize; protectedCard: boolean; foot?: ReactNode }) {
  const marks = traitMarks(card, protectedCard);
  return (
    <>
      <span className="dm-card-well">
        <OrganelleArt look={card} label={card.name} />
      </span>
      <span className="dm-card-pts" title={`${card.points} point${card.points === 1 ? '' : 's'}`}>{card.points}</span>
      {marks.length > 0 && size !== 'xs' && (
        <span className="dm-card-marks">
          {marks.map((m) => (
            <span key={m} title={MARK_LABEL[m]}><MarkIcon mark={m} /></span>
          ))}
        </span>
      )}
      <span className="dm-card-name" style={nameScale(card.name)}>{card.name}</span>
      {(size === 'md' || size === 'lg') && <span className="dm-card-color">{colorLabel(card)}{card.genePoolDelta ? ` · ${card.genePoolDelta > 0 ? '+' : ''}${card.genePoolDelta} gene pool` : ''}</span>}
      {size === 'lg' && <span className="dm-card-text">{card.text}</span>}
      {foot && <span className="dm-card-foot">{foot}</span>}
    </>
  );
}

export function TraitCard({ card, size = 'md', selected, disabled, onClick, inspect, protectedCard = !!card.indestructible, foot, className, title }: {
  card: DmTraitCard;
  size?: CardSize;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Hover for a big readable copy. On by default below lg. */
  inspect?: boolean;
  /** Shows the shield (Indestructible, or protected by an attachment). */
  protectedCard?: boolean;
  /** A small tag on the card (an attachment's host, "new"). */
  foot?: ReactNode;
  className?: string;
  /** Tooltip override (why a card can't be played). */
  title?: string;
}) {
  const interactive = !!onClick && !disabled;
  const cls = [
    'dm-card',
    `dm-card-${size}`,
    card.dominant && 'is-dominant',
    selected && 'is-selected',
    disabled && 'is-disabled',
    interactive && 'is-interactive',
    className,
  ].filter(Boolean).join(' ');
  const style = {
    '--membrane': membraneCss(card),
    '--glow': HUE[card.color].core,
  } as CSSProperties;
  const label = `${card.name} (${colorLabel(card)}, ${card.points} pts): ${card.text}`;
  const zoom = inspect ?? size !== 'lg';
  return (
    <CardShell
      className={cls}
      style={style}
      onClick={onClick}
      disabled={disabled}
      selected={selected}
      label={label}
      title={title}
      preview={zoom ? <div className="dm-card dm-card-lg dm-card-preview" style={style}><Face card={card} size="lg" protectedCard={protectedCard} /></div> : undefined}
    >
      <Face card={card} size={size} protectedCard={protectedCard} foot={foot} />
    </CardShell>
  );
}

export function TraitBackCard({ size = 'md', className, label }: { size?: CardSize; className?: string; label?: ReactNode }) {
  return (
    <div className={`dm-card dm-card-${size} is-back${className ? ` ${className}` : ''}`}>
      <TraitBack />
      {label != null && <span className="dm-card-back-label">{label}</span>}
    </div>
  );
}

/** A trait as a small pill (opponents' piles on their plates). */
export function MiniTrait({ card, protectedCard, onClick, targetable }: {
  card: DmTraitCard;
  protectedCard?: boolean;
  onClick?: () => void;
  targetable?: boolean;
}) {
  const style = { '--membrane': membraneCss(card), '--glow': HUE[card.color].core } as CSSProperties;
  const cls = `dm-mini${card.dominant ? ' is-dominant' : ''}${targetable ? ' is-target' : ''}${card.isAttachment ? ' is-attach' : ''}`;
  const inner = (
    <>
      <span className="dm-mini-dot" />
      <span className="dm-mini-pts">{card.points}</span>
      {card.dominant && <MarkIcon mark="dominant" />}
      {protectedCard && <MarkIcon mark="shield" />}
    </>
  );
  const preview = <div className="dm-card dm-card-lg dm-card-preview" style={style}><Face card={card} size="lg" protectedCard={!!protectedCard} /></div>;
  return (
    <Inspect preview={preview}>
      {onClick ? (
        <button type="button" className={cls} style={style} onClick={onClick} aria-label={`${card.name}, ${card.points} points`}>{inner}</button>
      ) : (
        <span className={cls} style={style} aria-label={`${card.name}, ${card.points} points`}>{inner}</span>
      )}
    </Inspect>
  );
}

const AGE_KIND_LABEL = { birthOfLife: 'The beginning', age: 'Age', catastrophe: 'Catastrophe' } as const;

/** An Age / Catastrophe card. `wide` is the horizontal banner used on the board. */
export function AgeCard({ age, wide, className }: { age: DmAgeCard; wide?: boolean; className?: string }) {
  return (
    <div className={`dm-age dm-age-${age.kind}${wide ? ' is-wide' : ''}${className ? ` ${className}` : ''}`}>
      <div className="dm-age-art"><AgeArt age={age} /></div>
      <div className="dm-age-body">
        <div className="dm-age-kind">
          {AGE_KIND_LABEL[age.kind]}
          {age.genePoolDelta !== 0 && <span className="dm-age-gp">{age.genePoolDelta > 0 ? '+' : ''}{age.genePoolDelta} Gene Pool</span>}
        </div>
        <div className="dm-age-name">{age.name.trim()}</div>
        <div className="dm-age-text">{age.text}</div>
        {age.worldsEndText && <div className="dm-age-end">{age.worldsEndText}</div>}
      </div>
    </div>
  );
}
