// Here to Slay — card frames and the small table pieces built from them.
//
// One parchment frame for the whole deck, dressed per type: a coloured ribbon
// naming the card's class or kind, a wax seal for heroes and leaders, the art
// window, the name in blackletter, and the roll target as a little die.
// Monsters print on black stock with their slay / fail targets as dice.

import type { CSSProperties, ReactNode } from 'react';
import { CardShell } from '@/ui/kit';
import { CardBack, ChallengeArt, GiftArt, HeroCrest, ItemArt, LeaderBanner, MagicArt, ModifierArt, MonsterArt } from './art';
import { CLASS_META, ClassSigil, INK, WaxSeal } from './sigils';
import type { HtsBaseClass, HtsCard, HtsCardType, HtsMonster, HtsPartyHero } from './types';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const TYPE_META: Record<HtsCardType, { label: string; ribbon: string; deep: string }> = {
  hero: { label: 'Hero', ribbon: '#7a6a55', deep: '#3e3428' },
  partyLeader: { label: 'Party Leader', ribbon: '#b8862a', deep: '#5e4210' },
  item: { label: 'Item', ribbon: '#2f7d74', deep: '#174540' },
  cursedItem: { label: 'Cursed Item', ribbon: '#5a2e78', deep: '#2a123b' },
  magic: { label: 'Magic', ribbon: '#2e48a0', deep: '#16245a' },
  modifier: { label: 'Modifier', ribbon: '#9a6a1e', deep: '#4e340c' },
  challenge: { label: 'Challenge', ribbon: '#b3262b', deep: '#5c1013' },
  monster: { label: 'Monster', ribbon: '#2a1416', deep: '#0d0607' },
  gift: { label: 'Nice Gift', ribbon: '#2f7a3d', deep: '#163d1d' },
};

export function rollLabel(threshold: number | null, low?: boolean): string | null {
  if (threshold == null) return null;
  return low ? `≤${threshold}` : `${threshold}+`;
}

function ribbonOf(card: Pick<HtsCard, 'type' | 'class'>) {
  if ((card.type === 'hero' || card.type === 'partyLeader') && card.class) {
    const m = CLASS_META[card.class];
    return { label: card.type === 'hero' ? m.label : 'Leader', ribbon: m.color, deep: m.deep };
  }
  return TYPE_META[card.type];
}

function CardArtFor({ card }: { card: HtsCard }) {
  let art: ReactNode;
  switch (card.type) {
    case 'hero': art = <HeroCrest kind={card.kind} cls={card.class} />; break;
    case 'partyLeader': art = <LeaderBanner cls={card.class} />; break;
    case 'item':
    case 'cursedItem': art = <ItemArt card={card} />; break;
    case 'magic': art = <MagicArt card={card} />; break;
    case 'modifier': art = <ModifierArt choices={card.modifierChoices} />; break;
    case 'challenge': art = <ChallengeArt />; break;
    case 'gift': art = <GiftArt kind={card.kind} />; break;
    case 'monster': art = <MonsterArt kind={card.kind} />; break;
  }
  return <svg viewBox="0 0 100 100" role="img" aria-label={card.name}>{art}</svg>;
}

/** A die-shaped badge: a roll target, a slay or fail number. */
function DieBadge({ children, tone = 'gold', title }: { children: ReactNode; tone?: 'gold' | 'good' | 'bad'; title?: string }) {
  return <span className={`hts-diebadge is-${tone}`} title={title}>{children}</span>;
}

function Face({ card, size, footnote }: { card: HtsCard; size: CardSize; footnote?: string }) {
  const rib = ribbonOf(card);
  const roll = card.type === 'hero' ? rollLabel(card.abilityThreshold, card.rollLow) : null;
  return (
    <>
      <span className="hts-card-ribbon">{rib.label}</span>
      {(card.type === 'hero' || card.type === 'partyLeader') && card.class && (
        <span className="hts-card-seal"><WaxSeal cls={card.class} /></span>
      )}
      <span className="hts-card-art"><CardArtFor card={card} /></span>
      {roll && (
        <span className="hts-card-roll" title={card.rollLow ? `Roll ${card.abilityThreshold} or less` : `Roll ${card.abilityThreshold} or more`}>
          <DieBadge tone={card.rollLow ? 'good' : 'gold'}>{roll}</DieBadge>
        </span>
      )}
      <span className="hts-card-name">{card.name}</span>
      {size === 'lg' && <span className="hts-card-text">{card.text}</span>}
      {footnote && <span className="hts-card-foot">{footnote}</span>}
    </>
  );
}

function frameClass(card: Pick<HtsCard, 'type'>, size: CardSize, extra: (string | false | undefined)[]) {
  return ['hts-card', `hts-card-${size}`, `hts-t-${card.type}`, ...extra].filter(Boolean).join(' ');
}

function frameStyle(card: Pick<HtsCard, 'type' | 'class'>): CSSProperties {
  const rib = ribbonOf(card);
  return { '--rib': rib.ribbon, '--rib-deep': rib.deep } as CSSProperties;
}

export function HtsCardView({ card, size = 'md', selected, disabled, onClick, footnote, inspect, className, title }: {
  card: HtsCard;
  size?: CardSize;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  footnote?: string;
  /** Hover zoom; on by default below lg. */
  inspect?: boolean;
  className?: string;
  title?: string;
}) {
  const interactive = !!onClick && !disabled;
  const cls = frameClass(card, size, [selected && 'is-selected', disabled && 'is-disabled', interactive && 'is-interactive', className]);
  const style = frameStyle(card);
  const zoom = inspect ?? size !== 'lg';
  return (
    <CardShell
      className={cls}
      style={style}
      onClick={onClick}
      disabled={disabled}
      selected={selected}
      label={`${card.name}: ${card.text}`}
      title={title}
      preview={zoom ? <div className={frameClass(card, 'lg', ['hts-card-preview'])} style={style}><Face card={card} size="lg" /></div> : undefined}
    >
      <Face card={card} size={size} footnote={footnote} />
    </CardShell>
  );
}

function MonsterFace({ monster, size }: { monster: HtsMonster; size: CardSize }) {
  const slay = monster.slayOnLow ? `≤${monster.slayThreshold}` : `${monster.slayThreshold}+`;
  const fail = monster.slayOnLow ? `${monster.failThreshold}+` : `≤${monster.failThreshold}`;
  const penalty = monster.failPenalty === 'sacrificeHero' ? 'sacrifice a Hero' : 'discard 2 cards';
  return (
    <>
      <span className="hts-card-ribbon">Monster</span>
      <span className="hts-card-art"><CardArtFor card={monster.card} /></span>
      <span className="hts-card-name">{monster.card.name}</span>
      <span className="hts-monster-stats">
        <span className="hts-req" title={`Needs ${monster.requirementText}`}>
          <HeroPips n={monster.requiredHeroes} />
          {monster.requiredClass && <span className="hts-req-class"><ClassSigil cls={monster.requiredClass} fill={CLASS_META[monster.requiredClass].color} /></span>}
        </span>
        <DieBadge tone="good" title={`Slay on ${slay}`}>{slay}</DieBadge>
        <DieBadge tone="bad" title={`Fail on ${fail}: ${penalty}`}>{fail}</DieBadge>
      </span>
      {size === 'lg' && (
        <span className="hts-card-text">
          <strong>Needs {monster.requirementText}.</strong> Fail ({fail}): {penalty}. <em>Slain:</em> {monster.card.text}
        </span>
      )}
    </>
  );
}

export function MonsterCard({ monster, size = 'md', onClick, disabled, className, inspect }: {
  monster: HtsMonster;
  size?: CardSize;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  inspect?: boolean;
}) {
  const interactive = !!onClick && !disabled;
  const cls = frameClass(monster.card, size, [interactive && 'is-interactive', disabled && 'is-disabled', className]);
  const style = frameStyle(monster.card);
  const zoom = inspect ?? size !== 'lg';
  return (
    <CardShell
      className={cls}
      style={style}
      onClick={onClick}
      disabled={disabled}
      label={`Attack ${monster.card.name}`}
      title={monster.card.name}
      preview={zoom ? <div className={frameClass(monster.card, 'lg', ['hts-card-preview'])} style={style}><MonsterFace monster={monster} size="lg" /></div> : undefined}
    >
      <MonsterFace monster={monster} size={size} />
    </CardShell>
  );
}

export function FaceDownCard({ size = 'md', className }: { size?: CardSize; className?: string }) {
  return (
    <div className={['hts-card', `hts-card-${size}`, 'is-facedown', className].filter(Boolean).join(' ')}>
      <CardBack />
    </div>
  );
}

// ============================================================================
// Small pieces
// ============================================================================

/** `n` little helmets: how many heroes a monster demands. */
function HeroPips({ n }: { n: number }) {
  return (
    <span className="hts-pips" aria-label={`${n} heroes`}>
      {Array.from({ length: n }, (_, i) => (
        <svg key={i} viewBox="0 0 12 14" aria-hidden="true">
          <path d="M2 8 Q2 2 6 2 Q10 2 10 8 L10 12 H2 Z" fill="#d8c79a" stroke={INK} strokeWidth={1.2} />
          <path d="M3.5 8 H8.5" stroke={INK} strokeWidth={1.2} />
        </svg>
      ))}
    </span>
  );
}

/** A hero as a hanging pennant of its class (opponents' parties, at a glance). */
export function Pennant({ hero, onClick, selected }: { hero: HtsPartyHero; onClick?: () => void; selected?: boolean }) {
  const cls = hero.card.class;
  const m = cls ? CLASS_META[cls] : { color: '#7a6a55', deep: '#3e3428', label: '' };
  const items = (hero.equippedItem ? 1 : 0) + (hero.extraItems?.length ?? 0);
  const inner = (
    <svg viewBox="0 0 24 32" aria-hidden="true">
      <path d="M2 2 H22 V29 L12 23 L2 29 Z" fill={m.color} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M2 2 H22 V6 H2 Z" fill={m.deep} />
      {cls && <g transform="translate(4 7) scale(0.66)"><ClassSigil cls={cls} /></g>}
      {items > 0 && <circle cx={20} cy={27} r={3.6} fill="#e8b84a" stroke={INK} strokeWidth={1.2} />}
    </svg>
  );
  const title = `${hero.card.name}${cls ? ` (${m.label})` : ''}${items ? ' — equipped' : ''}${hero.usedThisTurn ? ' — used this turn' : ''}`;
  return onClick ? (
    <button type="button" className={`hts-pennant${selected ? ' is-selected' : ''}`} onClick={onClick} title={title} aria-label={title}>{inner}</button>
  ) : (
    <span className={`hts-pennant${hero.usedThisTurn ? ' is-used' : ''}`} title={title}>{inner}</span>
  );
}

/** The road to a full party: one slot per class needed, filled with the classes held. */
export function ClassSlots({ have, need }: { have: HtsBaseClass[]; need: number }) {
  const slots = Array.from({ length: Math.max(need, have.length) }, (_, i) => have[i] ?? null);
  return (
    <span className="hts-slots" title={`${have.length} of ${need} classes`}>
      {slots.map((c, i) => (c
        ? <span key={i} className="hts-slot is-filled"><WaxSeal cls={c} /></span>
        : <span key={i} className="hts-slot" />))}
    </span>
  );
}

/** Slain monsters as little skull trophies, out of the number needed. */
export function TrophyRow({ have, need }: { have: number; need: number }) {
  return (
    <span className="hts-trophies" title={`${have} of ${need} monsters slain`}>
      {Array.from({ length: Math.max(need, have) }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={i < have ? 'is-slain' : undefined} aria-hidden="true">
          <path d="M12 3 C6.5 3 4 6.5 4 10.5 C4 13.5 5.5 15 7 15.8 V19 H17 V15.8 C18.5 15 20 13.5 20 10.5 C20 6.5 17.5 3 12 3 Z" />
          <circle cx={8.8} cy={11} r={2.2} />
          <circle cx={15.2} cy={11} r={2.2} />
        </svg>
      ))}
    </span>
  );
}

/** Action points as lanterns: lit ones are still to spend. */
export function ApLanterns({ remaining, max }: { remaining: number; max: number }) {
  const total = Math.max(max, remaining);
  return (
    <span className="hts-lanterns" aria-label={`${remaining} action point${remaining === 1 ? '' : 's'} left`}>
      {Array.from({ length: total }, (_, i) => {
        const lit = i < remaining;
        return (
          <svg key={i} viewBox="0 0 20 28" className={`hts-lantern${lit ? ' is-lit' : ''}${lit && i === remaining - 1 ? ' is-next' : ''}`} aria-hidden="true">
            <path d="M7 2 H13 M10 2 V5" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />
            <path d="M5 6 H15 L16 9 H4 Z" fill="#5a3a1e" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
            <path d="M5 9 H15 V22 H5 Z" fill={lit ? '#ffcf6a' : '#6a5440'} stroke={INK} strokeWidth={1.4} />
            {lit && <path d="M10 20 Q7 16 10 11 Q13 16 10 20 Z" fill="#fff3c2" />}
            <path d="M8 9 V22 M12 9 V22" stroke={INK} strokeWidth={0.8} opacity={0.6} />
            <path d="M4 22 H16 L15 25 H5 Z" fill="#5a3a1e" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
          </svg>
        );
      })}
    </span>
  );
}

