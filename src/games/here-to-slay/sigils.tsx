// Here to Slay — the ten class sigils and their tinctures. Every sigil is
// drawn on a 0 0 24 24 canvas with the shared ink outline, so they read the
// same on a wax seal, a pennant, a goal slot or a crest's chief.

import type { HtsBaseClass } from './types';

export const INK = '#1d140d';

export const CLASS_META: Record<HtsBaseClass, { label: string; color: string; deep: string }> = {
  fighter: { label: 'Fighter', color: '#c4392f', deep: '#7a1d17' },
  bard: { label: 'Bard', color: '#e0791f', deep: '#8a4410' },
  guardian: { label: 'Guardian', color: '#d6a321', deep: '#81600f' },
  ranger: { label: 'Ranger', color: '#3d8f3b', deep: '#1f4f1f' },
  thief: { label: 'Thief', color: '#2f63b5', deep: '#173566' },
  wizard: { label: 'Wizard', color: '#7a4bc6', deep: '#40236f' },
  warrior: { label: 'Warrior', color: '#1f8b99', deep: '#0e4c55' },
  druid: { label: 'Druid', color: '#6f9a2e', deep: '#3a5617' },
  berserker: { label: 'Berserker', color: '#9c2235', deep: '#55101c' },
  necromancer: { label: 'Necromancer', color: '#4f3878', deep: '#281a40' },
};

/** One class's emblem, in `fill` (default: parchment) with ink outlines. */
export function SigilShape({ cls, fill = '#f4e6c4' }: { cls: HtsBaseClass; fill?: string }) {
  const s = { stroke: INK, strokeWidth: 1.5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  switch (cls) {
    case 'fighter': // crossed swords
      return (
        <g {...s} fill={fill}>
          <path d="M5 3.5 L7 3.5 L18 15.5 L16.5 17 Z" />
          <path d="M19 3.5 L17 3.5 L6 15.5 L7.5 17 Z" />
          <path d="M13.5 18.5 L18.5 13.5 M10.5 18.5 L5.5 13.5" strokeWidth={2.2} />
          <circle cx={19.6} cy={19.6} r={1.6} />
          <circle cx={4.4} cy={19.6} r={1.6} />
        </g>
      );
    case 'bard': // lute
      return (
        <g {...s} fill={fill}>
          <path d="M14.5 9.5 L19.5 3.5 L21 5 L15.5 11" />
          <ellipse cx={10} cy={14.5} rx={6.3} ry={6.8} transform="rotate(-40 10 14.5)" />
          <circle cx={9.4} cy={14.8} r={1.7} fill={INK} />
          <path d="M6.5 18.5 L14.5 10.5" strokeWidth={0.9} fill="none" />
        </g>
      );
    case 'guardian': // heater shield with a cross
      return (
        <g {...s}>
          <path d="M4 3.5 H20 V11 C20 16.5 16 19.5 12 21.5 C8 19.5 4 16.5 4 11 Z" fill={fill} />
          <path d="M12 6 V18.5 M7 10.5 H17" strokeWidth={2.4} fill="none" />
        </g>
      );
    case 'ranger': // bow and arrow
      return (
        <g {...s} fill="none">
          <path d="M6 3 Q20 12 6 21" strokeWidth={2.4} stroke={INK} />
          <path d="M6 3 Q20 12 6 21" strokeWidth={1} stroke={fill} />
          <path d="M6 3 L6 21" strokeWidth={0.9} />
          <path d="M3 12 H21" strokeWidth={1.6} />
          <path d="M21 12 L17.5 9.6 M21 12 L17.5 14.4" strokeWidth={1.6} />
          <path d="M3 12 L5 10 M3 12 L5 14" strokeWidth={1.2} />
        </g>
      );
    case 'thief': // domino mask
      return (
        <g {...s}>
          <path d="M2.5 10 Q4 6 12 7.5 Q20 6 21.5 10 Q21.5 16 16 15.5 Q13.5 15 12 12.5 Q10.5 15 8 15.5 Q2.5 16 2.5 10 Z" fill={fill} />
          <ellipse cx={7.6} cy={11} rx={2.3} ry={1.6} fill={INK} />
          <ellipse cx={16.4} cy={11} rx={2.3} ry={1.6} fill={INK} />
        </g>
      );
    case 'wizard': // pointed hat with a star
      return (
        <g {...s} fill={fill}>
          <path d="M12 2.5 Q14 8 17.5 17 H6.5 Q10 8 12 2.5 Z" />
          <path d="M3 18.5 Q12 15.5 21 18.5 Q12 21.5 3 18.5 Z" />
          <path d="M12.5 9 L13.3 11 L15.4 11.1 L13.8 12.4 L14.3 14.4 L12.5 13.3 L10.7 14.4 L11.2 12.4 L9.6 11.1 L11.7 11 Z" fill={INK} strokeWidth={0.6} />
        </g>
      );
    case 'warrior': // double-bitted axe
      return (
        <g {...s} fill={fill}>
          <path d="M12 3 V21.5" strokeWidth={2.4} fill="none" />
          <path d="M12 5 Q5 4 3.5 10 Q5 14 12 12 Z" />
          <path d="M12 5 Q19 4 20.5 10 Q19 14 12 12 Z" />
          <circle cx={12} cy={3} r={1.4} />
        </g>
      );
    case 'druid': // oak leaf
      return (
        <g {...s}>
          <path d="M12 21.5 C9 18 4.5 17 5 13.5 C3 12 4.5 9.5 6.5 9.5 C5.5 7 8 5 10 6 C10 3.5 14 3.5 14 6 C16 5 18.5 7 17.5 9.5 C19.5 9.5 21 12 19 13.5 C19.5 17 15 18 12 21.5 Z" fill={fill} />
          <path d="M12 21.5 V7 M12 12 L8 10 M12 15 L16 12.5 M12 18 L8.5 15.5" fill="none" strokeWidth={1} />
        </g>
      );
    case 'berserker': // horned helm
      return (
        <g {...s} fill={fill}>
          <path d="M6 12 Q2 10 2.5 4 Q5.5 8.5 8 9" />
          <path d="M18 12 Q22 10 21.5 4 Q18.5 8.5 16 9" />
          <path d="M5.5 15.5 Q5 7 12 7 Q19 7 18.5 15.5 Z" />
          <path d="M4.5 15.5 H19.5 V18 H4.5 Z" />
          <path d="M12 7 V18" strokeWidth={1} />
          <path d="M8 12 H10.5 M13.5 12 H16" strokeWidth={1.6} />
        </g>
      );
    case 'necromancer': // skull
      return (
        <g {...s}>
          <path d="M12 3 C6.5 3 4 6.5 4 10.5 C4 13.5 5.5 15 7 15.8 V19 H17 V15.8 C18.5 15 20 13.5 20 10.5 C20 6.5 17.5 3 12 3 Z" fill={fill} />
          <circle cx={8.8} cy={11} r={2.2} fill={INK} />
          <circle cx={15.2} cy={11} r={2.2} fill={INK} />
          <path d="M12 13 L11 15.2 H13 Z" fill={INK} strokeWidth={0.6} />
          <path d="M9.5 19 V17 M12 19 V17 M14.5 19 V17" strokeWidth={1} fill="none" />
        </g>
      );
  }
}

/** A class sigil on its own svg. */
export function ClassSigil({ cls, fill, title }: { cls: HtsBaseClass; fill?: string; title?: string }) {
  return (
    <svg viewBox="0 0 24 24" className="hts-sigil" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <SigilShape cls={cls} fill={fill} />
    </svg>
  );
}

/** The sigil pressed into a wax seal of the class colour. */
export function WaxSeal({ cls, title }: { cls: HtsBaseClass; title?: string }) {
  const m = CLASS_META[cls];
  return (
    <svg viewBox="0 0 32 32" className="hts-seal" role="img" aria-label={title ?? m.label}>
      <path
        d="M16 1.5 C19 1.5 19.5 3.5 22 3.6 C25 3.7 25.4 6 27.2 7.4 C29.4 9.1 28.4 11.3 29.6 13.6 C30.8 16 29 17.6 29.4 20.2 C29.8 23 27.5 23.8 26.4 26 C25.2 28.4 22.8 27.9 20.6 29.2 C18.3 30.6 16.4 29.4 14 29.9 C11.4 30.4 10.3 28.4 8 27.8 C5.4 27.1 5.2 24.8 3.6 23 C1.8 21 3 19 2.3 16.6 C1.6 14 3.4 12.6 3.5 10.1 C3.6 7.3 5.9 6.6 7.4 4.8 C9 2.9 11.3 3.6 13.4 2.3 C14.2 1.8 15 1.5 16 1.5 Z"
        fill={m.color}
        stroke={INK}
        strokeWidth={1.6}
      />
      <circle cx={16} cy={16} r={10.5} fill={m.deep} stroke={INK} strokeWidth={1} opacity={0.55} />
      <circle cx={12.5} cy={11} r={3} fill="#ffffff" opacity={0.18} />
      <g transform="translate(5.2 5.2) scale(0.9)">
        <SigilShape cls={cls} fill="#f6e2b0" />
      </g>
    </svg>
  );
}
