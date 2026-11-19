// Happy Little Dinosaurs — card frames. Point cards are cream stock with a
// fat number badge; Instants are printed on electric-violet stock; Disasters
// on their category's colour; Hazards behind caution stripes. Small cards
// show the full text on hover (Inspect).

import type { CSSProperties } from 'react';
import { CardShell, Inspect } from '@/ui/kit';
import { HLD_DINO_DEFS } from './cards';
import {
  CATEGORY_COLOR, CATEGORY_LABEL, CardBack, CardDoodle, CategoryIcon, DisasterArt, DisasterBack, HazardArt, tintOf, valueColor,
} from './CardArt';
import { DINO_LOOK, DinoArt, type DinoMood } from './DinoArt';
import type { HldCard, HldDinoId, HldDisasterCard, HldHazardCard } from './types';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

/** Instants that save you from a Disaster all say so; the rest are played during scoring. */
const isSaveInstant = (c: HldCard) => c.type === 'instant' && /would add a Disaster/i.test(c.text);

function PlayFace({ card, size, footnote }: { card: HldCard; size: CardSize; footnote?: string }) {
  const instant = card.type === 'instant';
  return (
    <>
      {instant && <span className="hld-card-ribbon">{isSaveInstant(card) ? 'Save' : 'Instant'}</span>}
      <span className="hld-card-art" style={{ '--tint': tintOf(card.kind) } as CSSProperties}>
        <CardDoodle kind={card.kind} />
      </span>
      {instant ? (
        <span className="hld-card-badge is-instant" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M13.5 2 L5 13.5 h6 L9.5 22 L19 9.5 h-6.2 Z" fill="#ffd23f" stroke="#2a1d16" strokeWidth={1.7} strokeLinejoin="round" /></svg>
        </span>
      ) : (
        <span className="hld-card-badge" style={{ '--badge': valueColor(card.value ?? 0) } as CSSProperties}>{card.value ?? 0}</span>
      )}
      {card.hasEffect && !instant && <span className="hld-card-fx" title="Has an effect">✦</span>}
      <span className="hld-card-name">{card.name}</span>
      {size === 'lg' && <span className="hld-card-text">{card.text}</span>}
      {footnote && <span className="hld-card-foot">{footnote}</span>}
    </>
  );
}

export function PlayCard({ card, size = 'md', selected, disabled, onClick, footnote, inspect, className }: {
  card: HldCard;
  size?: CardSize;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  footnote?: string;
  /** Hover for a big readable copy (default for sm / md). */
  inspect?: boolean;
  className?: string;
}) {
  const interactive = !!onClick && !disabled;
  const cls = [
    'hld-card',
    `hld-card-${size}`,
    `hld-type-${card.type}`,
    selected && 'is-selected',
    disabled && 'is-disabled',
    interactive && 'is-interactive',
    className,
  ].filter(Boolean).join(' ');
  const label = `${card.name}${card.type === 'point' ? ` (${card.value})` : ''}: ${card.text}`;
  const zoom = inspect ?? (size === 'sm' || size === 'md');
  return (
    <CardShell
      className={cls}
      onClick={onClick}
      disabled={disabled}
      selected={selected}
      label={label}
      preview={zoom ? <div className={`hld-card hld-card-lg hld-card-preview hld-type-${card.type}`}><PlayFace card={card} size="lg" /></div> : undefined}
    >
      <PlayFace card={card} size={size} footnote={footnote} />
    </CardShell>
  );
}

function DisasterFace({ disaster, size }: { disaster: HldDisasterCard; size: CardSize }) {
  return (
    <>
      <span className="hld-card-ribbon">{CATEGORY_LABEL[disaster.category]}</span>
      <span className="hld-card-art">
        <DisasterArt category={disaster.category} name={disaster.name} />
      </span>
      <span className="hld-card-badge is-cat"><CategoryIcon category={disaster.category} size={24} /></span>
      <span className="hld-card-name">{disaster.name}</span>
      {size === 'lg' && <span className="hld-card-text">{disaster.text}</span>}
      {disaster.drawsHazard && <span className="hld-card-foot">+ Hazard</span>}
    </>
  );
}

export function DisasterCard({ disaster, size = 'md', className, inspect }: {
  disaster: HldDisasterCard;
  size?: CardSize;
  className?: string;
  inspect?: boolean;
}) {
  const style = { '--cat': CATEGORY_COLOR[disaster.category] } as CSSProperties;
  const body = (
    <div className={`hld-card hld-card-${size} hld-type-disaster${className ? ` ${className}` : ''}`} style={style} title={`${disaster.name}: ${disaster.text}`}>
      <DisasterFace disaster={disaster} size={size} />
    </div>
  );
  if (!(inspect ?? (size === 'xs' || size === 'sm' || size === 'md'))) return body;
  return (
    <Inspect preview={<div className="hld-card hld-card-lg hld-card-preview hld-type-disaster" style={style}><DisasterFace disaster={disaster} size="lg" /></div>}>
      {body}
    </Inspect>
  );
}

function HazardFace({ hazard, size }: { hazard: HldHazardCard; size: CardSize }) {
  return (
    <>
      <span className="hld-card-ribbon">Hazard</span>
      <span className="hld-card-art"><HazardArt penalty={hazard.penalty} /></span>
      <span className="hld-card-name">{hazard.name}</span>
      {size === 'lg' && <span className="hld-card-text">{hazard.text}</span>}
    </>
  );
}

export function HazardCard({ hazard, size = 'sm', onClick, selected, className }: {
  hazard: HldHazardCard;
  size?: CardSize;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}) {
  const cls = `hld-card hld-card-${size} hld-type-hazard${onClick ? ' is-interactive' : ''}${selected ? ' is-selected' : ''}${className ? ` ${className}` : ''}`;
  const body = onClick ? (
    <button type="button" className={cls} onClick={onClick} aria-label={`${hazard.name}: ${hazard.text}`}>
      <HazardFace hazard={hazard} size={size} />
    </button>
  ) : (
    <div className={cls} title={`${hazard.name}: ${hazard.text}`}>
      <HazardFace hazard={hazard} size={size} />
    </div>
  );
  return (
    <Inspect preview={<div className="hld-card hld-card-lg hld-card-preview hld-type-hazard"><HazardFace hazard={hazard} size="lg" /></div>}>
      {body}
    </Inspect>
  );
}

export function FaceDownCard({ size = 'md', deck = 'main', className, label }: {
  size?: CardSize;
  deck?: 'main' | 'disaster';
  className?: string;
  label?: string;
}) {
  return (
    <div className={`hld-card hld-card-${size} is-facedown${className ? ` ${className}` : ''}`} aria-label={label ?? 'Face-down card'}>
      {deck === 'main' ? <CardBack /> : <DisasterBack />}
      {label && <span className="hld-card-back-label">{label}</span>}
    </div>
  );
}

/** A dinosaur board: the dino, its name and its trait. */
export function DinoCard({ dino, mood = 'happy', selected, onClick, compact }: {
  dino: HldDinoId;
  mood?: DinoMood;
  selected?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const def = HLD_DINO_DEFS.find((d) => d.id === dino)!;
  const look = DINO_LOOK[dino];
  const inner = (
    <>
      <span className="hld-dino-art"><DinoArt dino={dino} mood={mood} title={def.name} /></span>
      <span className="hld-dino-name">{def.name}</span>
      {!compact && (
        <span className="hld-dino-traits">
          <span className="hld-trait is-plus"><CategoryIcon category={def.plusCategory} size={16} /> +1</span>
          {def.minusCategory
            ? <span className="hld-trait is-minus"><CategoryIcon category={def.minusCategory} size={16} /> −1</span>
            : <span className="hld-trait">no weakness</span>}
        </span>
      )}
    </>
  );
  const cls = `hld-dino-card${selected ? ' is-selected' : ''}${compact ? ' is-compact' : ''}`;
  const style = { '--dino': look.body, '--dino-shade': look.shade } as CSSProperties;
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick} aria-pressed={selected} title={def.text}>{inner}</button>
  ) : (
    <div className={cls} style={style} title={def.text}>{inner}</div>
  );
}
