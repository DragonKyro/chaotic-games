// A Casting Shadows card: a tarot-style frame with an arched art window, its
// element on the border, level numerals at the crown, and its cast tiers as
// gem costs → effect. Counterspells wear a silver ward frame, companions a
// verdant one; resources show the gem they grant.

import type { CSSProperties, ReactNode } from 'react';
import { CardShell } from '@/ui/kit';
import { CardArt, CardBackArt, CostRow, ELEMENT, elementOf, GemIconSvg } from './art';
import type { CsCard, CsCastTier, CsSpellRange } from './types';

type Size = 'xs' | 'sm' | 'md' | 'lg';

const NUMERAL = ['', 'I', 'II', 'III'] as const;

const TYPE_LABEL: Record<CsCard['type'], string> = {
  attackSpell: 'Attack',
  conversionSpell: 'Conversion',
  resource: 'Resource',
  counterspell: 'Counterspell',
  companion: 'Companion',
};

const RANGE_LABEL: Record<CsSpellRange, string> = {
  same: 'your hex',
  adjacent: 'adjacent hexes',
  sameOrAdjacent: 'here or adjacent',
  upToTwo: 'up to 2 hexes away',
  twoNotSame: '1–2 hexes away',
};

function rangeText(card: CsCard): string {
  if (card.type !== 'attackSpell') return TYPE_LABEL[card.type];
  const r = RANGE_LABEL[card.range ?? 'sameOrAdjacent'];
  return card.targetsAllOnHex ? `A whole hex · ${r}` : `One enemy · ${r}`;
}

/** What a tier does, as compact icons: damage, heals, gems made, shields. */
function TierEffect({ tier, size = 15 }: { tier: CsCastTier; size?: number }) {
  const parts: ReactNode[] = [];
  if (tier.damage > 0) parts.push(<span key="d" className="cs-fx-dmg">{tier.damage}</span>);
  if (tier.heal) parts.push(<span key="h" className="cs-fx-heal">+{tier.heal}♥</span>);
  if (tier.produce?.length) parts.push(<span key="p" className="cs-cost">{tier.produce.map((r, i) => <GemIconSvg key={i} icon={r} size={size} />)}</span>);
  if (tier.gainFortify) parts.push(<span key="f" className="cs-fx-shield">+{tier.gainFortify}⛨</span>);
  if (tier.gainShadowEnergy) parts.push(<span key="s" className="cs-fx-shade">+{tier.gainShadowEnergy}◐</span>);
  if (tier.inflictBurn) parts.push(<span key="b" className="cs-fx-status">burn</span>);
  if (tier.inflictFreeze) parts.push(<span key="z" className="cs-fx-status">freeze</span>);
  if (tier.inflictStun) parts.push(<span key="u" className="cs-fx-status">stun</span>);
  if (parts.length === 0) parts.push(<span key="n" className="cs-fx-status">—</span>);
  return <span className="cs-tier-fx">{parts}</span>;
}

export function TierLine({ tier, size = 14 }: { tier: CsCastTier; size?: number }) {
  return (
    <span className="cs-tier">
      <CostRow cost={tier.cost} size={size} />
      <span className="cs-tier-arrow">→</span>
      <TierEffect tier={tier} size={size} />
    </span>
  );
}

function Face({ card, size }: { card: CsCard; size: Size }) {
  const tiers = card.castTiers ?? [];
  return (
    <>
      <span className="cs-card-crown">{card.type === 'companion' ? '✶' : card.type === 'counterspell' ? '⛨' : NUMERAL[card.level]}</span>
      <span className="cs-card-window"><CardArt card={card} /></span>
      <span className="cs-card-name">{card.name}</span>
      {size !== 'xs' && <span className="cs-card-type">{rangeText(card)}</span>}
      {(size === 'md' || size === 'lg') && tiers.length > 0 && (
        <span className="cs-card-tiers">{tiers.map((t, i) => <TierLine key={i} tier={t} size={size === 'lg' ? 15 : 12} />)}</span>
      )}
      {(size === 'md' || size === 'lg') && card.type === 'resource' && card.grantsResource && (
        <span className="cs-card-tiers"><span className="cs-tier">discard for <GemIconSvg icon={card.grantsResource} size={size === 'lg' ? 16 : 13} /></span></span>
      )}
      {size === 'lg' && <span className="cs-card-text">{card.text}</span>}
      {size === 'lg' && card.type !== 'companion' && (
        <span className="cs-card-collect">
          collect {card.requiresSpellLevel ? <>a Level {card.requiresSpellLevel} spell + </> : null}
          {Object.keys(card.collectionCost).length ? <CostRow cost={card.collectionCost} size={13} /> : card.requiresSpellLevel ? null : 'free'}
        </span>
      )}
    </>
  );
}

export function CardView({ card, size = 'md', selected, disabled, used, onClick, footnote, inspect, className }: {
  card: CsCard;
  size?: Size;
  selected?: boolean;
  disabled?: boolean;
  /** Cast already this turn. */
  used?: boolean;
  onClick?: () => void;
  footnote?: string;
  /** Hover for a big copy; on by default below lg. */
  inspect?: boolean;
  className?: string;
}) {
  const el = elementOf(card);
  const pal = ELEMENT[el];
  const interactive = !!onClick && !disabled;
  const cls = [
    'cs-card',
    `cs-card-${size}`,
    `cs-type-${card.type}`,
    selected && 'is-selected',
    disabled && 'is-disabled',
    used && 'is-used',
    interactive && 'is-interactive',
    className,
  ].filter(Boolean).join(' ');
  const style = { '--el': pal.main, '--el-glow': pal.glow, '--el-deep': pal.deep } as CSSProperties;
  const zoom = inspect ?? size !== 'lg';
  return (
    <CardShell
      className={cls}
      style={style}
      onClick={onClick}
      disabled={disabled}
      selected={selected}
      label={`${card.name}: ${card.text}`}
      preview={zoom ? <div className={`cs-card cs-card-lg cs-card-preview cs-type-${card.type}`} style={style}><Face card={card} size="lg" /></div> : undefined}
    >
      <Face card={card} size={size} />
      {footnote && <span className="cs-card-foot">{footnote}</span>}
    </CardShell>
  );
}

export function CardBack({ size = 'md', variant = 'main', label, className }: { size?: Size; variant?: 'main' | 'ward'; label?: string; className?: string }) {
  return (
    <div className={`cs-card cs-card-${size} is-facedown${className ? ` ${className}` : ''}`}>
      <CardBackArt variant={variant} />
      {label && <span className="cs-card-back-label">{label}</span>}
    </div>
  );
}
