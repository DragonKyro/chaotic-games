// Happy Little Dinosaurs — the dinosaurs. Original "papercraft" style: every
// part is a flat cut-out shape with a fat ink outline and a darker copy of
// itself peeking out underneath (the paper's shadow), so the six species read
// as one set. All drawn on a 0 0 120 100 canvas, facing right, feet at y≈92.
//
// One primitive, species-specific parts: tail / body / legs / head plus each
// species' signature (Rex's tiny arms, Ceratops' frill and horns, Bronto's
// neck and personal rain cloud, Stego's plates, Pterry's wings, Raptor's
// sickle claw and crest). `mood` changes the eyes and mouth.

import type { ReactNode } from 'react';
import type { HldDinoId } from './types';

export const INK = '#2a1d16';

export interface DinoLook {
  body: string;
  shade: string;
  belly: string;
  accent: string;
}

export const DINO_LOOK: Record<HldDinoId, DinoLook> = {
  'nervous-rex': { body: '#ff8a4c', shade: '#c4561d', belly: '#ffd8b0', accent: '#ffd23f' },
  'cry-ceratops': { body: '#5aa9ff', shade: '#2d6fc0', belly: '#d2e8ff', accent: '#ff7ab8' },
  'bad-luck-bronto': { body: '#6fd36b', shade: '#3b963a', belly: '#d9f6c9', accent: '#8f8fa8' },
  stego: { body: '#ffcf3f', shade: '#c4950c', belly: '#fff1bd', accent: '#ff6b4a' },
  'pterry-dactyl': { body: '#36d6c8', shade: '#1d968c', belly: '#cbfbf6', accent: '#ffa94d' },
  'raging-raptor': { body: '#ff5f9e', shade: '#bd336b', belly: '#ffd2e4', accent: '#8b5cff' },
  // Hazards Ahead boards reuse the closest silhouettes (Stego's plates, Bronto's long body) in their own colours.
  'easygoing-anky': { body: '#9bd35a', shade: '#5e9a24', belly: '#e6f7c9', accent: '#c98a4a' },
  'moody-mosasaur': { body: '#3fb7c9', shade: '#1f7d8c', belly: '#c9f1f6', accent: '#6b5cff' },
};

/** Boards without bespoke art borrow a silhouette. */
const SILHOUETTE: Partial<Record<HldDinoId, HldDinoId>> = { 'easygoing-anky': 'stego', 'moody-mosasaur': 'bad-luck-bronto' };
const speciesOf = (dino: HldDinoId) => SPECIES[dino] ?? SPECIES[SILHOUETTE[dino] ?? 'nervous-rex'] ?? SPECIES['nervous-rex']!;

export type DinoMood = 'happy' | 'scared' | 'out';

/** A cut-paper shape: a shadow copy nudged down-right, then the shape itself, outlined. */
function Cut({ d, fill, shade, sw = 3 }: { d: string; fill: string; shade: string; sw?: number }) {
  return (
    <>
      <path d={d} fill={shade} transform="translate(2.4 2.6)" />
      <path d={d} fill={fill} stroke={INK} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
    </>
  );
}

function Eye({ x, y, mood, r = 5 }: { x: number; y: number; mood: DinoMood; r?: number }) {
  if (mood === 'out') {
    return (
      <path
        d={`M${x - r * 0.8} ${y - r * 0.8} L${x + r * 0.8} ${y + r * 0.8} M${x + r * 0.8} ${y - r * 0.8} L${x - r * 0.8} ${y + r * 0.8}`}
        stroke={INK}
        strokeWidth={2.8}
        strokeLinecap="round"
      />
    );
  }
  const scared = mood === 'scared';
  return (
    <g>
      <circle cx={x} cy={y} r={scared ? r * 1.2 : r} fill="#fff" stroke={INK} strokeWidth={2.4} />
      <circle cx={x + (scared ? 0 : r * 0.25)} cy={y + (scared ? 0 : r * 0.1)} r={scared ? r * 0.32 : r * 0.55} fill={INK} />
      {!scared && <circle cx={x + r * 0.45} cy={y - r * 0.25} r={r * 0.2} fill="#fff" />}
    </g>
  );
}

/** A dinosaur, by species. */
export function DinoArt({ dino, mood = 'happy', className, title }: { dino: HldDinoId; mood?: DinoMood; className?: string; title?: string }) {
  const look = DINO_LOOK[dino] ?? DINO_LOOK['nervous-rex'];
  return (
    <svg viewBox="0 0 120 100" className={className} role="img" aria-label={title ?? dino}>
      <ellipse cx={60} cy={93} rx={42} ry={5} fill={INK} opacity={0.18} />
      {speciesOf(dino)(look, mood)}
    </svg>
  );
}

const leg = (x: number, top: number, w = 11, bottom = 91) =>
  `M${x} ${top} L${x} ${bottom - 3} Q${x} ${bottom} ${x + 3} ${bottom} L${x + w - 3} ${bottom} Q${x + w} ${bottom} ${x + w} ${bottom - 3} L${x + w} ${top} Z`;

const SPECIES: Partial<Record<HldDinoId, (l: DinoLook, mood: DinoMood) => ReactNode>> = {
  // ---------------------------------------------------------------- Rex: big head, tiny arms, sweating
  'nervous-rex': (l, mood) => (
    <g>
      <Cut d="M10 66 C24 58 38 55 50 56 L52 72 C40 75 24 74 10 66 Z" fill={l.body} shade={l.shade} />
      <Cut d={leg(47, 70, 12)} fill={l.body} shade={l.shade} />
      <Cut d="M44 60 C44 44 58 36 70 40 C82 44 84 60 78 72 C72 82 52 84 46 74 Z" fill={l.body} shade={l.shade} />
      <path d="M58 50 C66 48 75 56 73 67 C67 76 57 74 55 64 Z" fill={l.belly} />
      <Cut d={leg(63, 72, 13)} fill={l.body} shade={l.shade} />
      {/* tiny useless arm */}
      <path d="M76 54 Q84 54 86 60" stroke={INK} strokeWidth={5.4} fill="none" strokeLinecap="round" />
      <path d="M76 54 Q84 54 86 60" stroke={l.body} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      {/* back ridge */}
      <path d="M46 46 L50 40 L53 46 L57 39 L60 44" fill={l.accent} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Cut d="M64 40 C62 26 72 16 88 16 C102 16 111 23 111 31 L111 39 C104 46 90 48 78 46 C70 46 66 44 64 40 Z" fill={l.body} shade={l.shade} />
      <path d={mood === 'scared' ? 'M84 39 Q90 36 96 39 Q102 42 108 38' : 'M84 38 Q96 43 109 37'} stroke={INK} strokeWidth={2.4} fill="none" strokeLinecap="round" />
      <path d="M90 39.5 L92 42.5 L94 40 M98 40.5 L100 43 L102 40" fill="#fff" stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
      <circle cx={104} cy={26} r={1.4} fill={INK} />
      <Eye x={89} y={27} mood={mood} />
      {mood !== 'out' && <path d="M106 8 Q109 13 106 16 Q103 13 106 8 Z" fill="#8fdcff" stroke={INK} strokeWidth={1.6} />}
    </g>
  ),

  // ---------------------------------------------------------------- Ceratops: frill, three horns, one tear
  'cry-ceratops': (l, mood) => (
    <g>
      <Cut d="M8 64 C18 58 28 57 34 59 L35 71 C25 72 16 70 8 64 Z" fill={l.body} shade={l.shade} />
      <Cut d={leg(34, 70, 11)} fill={l.body} shade={l.shade} />
      <Cut d={leg(64, 70, 11)} fill={l.body} shade={l.shade} />
      <Cut d="M28 62 C28 46 46 40 64 42 C79 44 86 54 84 67 C80 80 40 82 31 74 Z" fill={l.body} shade={l.shade} />
      <path d="M40 66 C46 60 66 60 74 66 C70 74 48 76 40 66 Z" fill={l.belly} />
      <Cut d={leg(45, 72, 11)} fill={l.body} shade={l.shade} />
      <Cut d={leg(74, 72, 11)} fill={l.body} shade={l.shade} />
      {/* frill: a scalloped fan behind the head */}
      <Cut
        d="M70 52 C66 40 70 28 80 24 C82 20 88 20 90 23 C94 21 100 23 101 27 C106 28 109 33 107 38 C110 42 108 48 104 50 L92 58 Z"
        fill={l.accent}
        shade={l.shade}
      />
      <circle cx={82} cy={31} r={2.2} fill="#fff" opacity={0.7} />
      <circle cx={95} cy={28} r={2.2} fill="#fff" opacity={0.7} />
      <circle cx={102} cy={39} r={2.2} fill="#fff" opacity={0.7} />
      <Cut d="M78 54 C78 44 88 40 98 43 C108 46 113 55 109 63 C103 70 88 70 82 66 Z" fill={l.body} shade={l.shade} />
      {/* horns */}
      <path d="M90 44 L98 24 L96 45 Z" fill="#fff6e0" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M83 46 L84 28 L89 45 Z" fill="#fff6e0" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M105 51 L114 43 L110 56 Z" fill="#fff6e0" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <path d={mood === 'happy' ? 'M98 62 Q104 65 109 61' : 'M98 64 Q104 60 109 63'} stroke={INK} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Eye x={95} y={52} mood={mood} r={4.6} />
      {mood !== 'out' && <path d="M96 59 Q99 65 96 67 Q93 65 96 59 Z" fill="#8fdcff" stroke={INK} strokeWidth={1.5} />}
    </g>
  ),

  // ---------------------------------------------------------------- Bronto: long neck, a rain cloud that follows it around
  'bad-luck-bronto': (l, mood) => (
    <g>
      <Cut d="M4 72 C14 64 28 60 36 62 L38 75 C26 78 13 78 4 72 Z" fill={l.body} shade={l.shade} />
      <Cut d={leg(34, 72, 11)} fill={l.body} shade={l.shade} />
      <Cut d={leg(62, 72, 11)} fill={l.body} shade={l.shade} />
      <Cut d="M66 56 C70 42 74 30 80 22 L92 24 C88 34 84 46 80 62 Z" fill={l.body} shade={l.shade} />
      <Cut d="M30 66 C30 52 46 46 62 48 C76 50 83 60 80 72 C76 82 40 84 32 78 Z" fill={l.body} shade={l.shade} />
      <path d="M42 70 C48 64 66 64 72 70 C68 77 48 78 42 70 Z" fill={l.belly} />
      {/* band-aid: bad luck */}
      <g transform="rotate(-24 50 58)">
        <rect x={42} y={55} width={16} height={6} rx={3} fill="#ffe0b8" stroke={INK} strokeWidth={1.6} />
        <path d="M48 55 V61 M52 55 V61" stroke={INK} strokeWidth={1} />
      </g>
      <Cut d={leg(45, 74, 11)} fill={l.body} shade={l.shade} />
      <Cut d={leg(71, 74, 11)} fill={l.body} shade={l.shade} />
      <Cut d="M80 22 C80 14 88 10 96 12 C104 14 108 20 104 26 C98 31 86 31 82 28 Z" fill={l.body} shade={l.shade} />
      <path d={mood === 'happy' ? 'M94 26 Q99 28 103 24' : 'M94 27 Q99 24 103 27'} stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Eye x={93} y={18} mood={mood} r={3.8} />
      {/* its personal cloud */}
      {mood !== 'out' && (
        <g>
          <path d="M98 9 C94 9 93 4 97 3 C98 -1 104 -1 105 2 C109 1 112 4 110 7 C112 9 110 11 107 11 L99 11 C97 11 96 10 98 9 Z" fill={l.accent} stroke={INK} strokeWidth={1.8} strokeLinejoin="round" />
          <path d="M102 12 L100 17 L103 16 L101 21" stroke="#ffd23f" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </g>
  ),

  // ---------------------------------------------------------------- Stego: plates, tail spikes, unbothered
  stego: (l, mood) => (
    <g>
      <Cut d="M6 68 C14 62 24 60 32 62 L34 73 C24 75 14 74 6 68 Z" fill={l.body} shade={l.shade} />
      <path d="M10 64 L4 53 L15 62 Z M17 61 L14 50 L22 60 Z" fill="#fff6e0" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Cut d={leg(34, 70, 11)} fill={l.body} shade={l.shade} />
      <Cut d={leg(66, 70, 11)} fill={l.body} shade={l.shade} />
      {/* plates first, so the body overlaps their roots */}
      {[
        [36, 50, 7], [46, 42, 9], [57, 38, 10], [68, 40, 9], [78, 47, 7],
      ].map(([x, y, s]) => (
        <path
          key={x}
          d={`M${x - s! * 0.7} ${y! + s! * 0.6} L${x} ${y! - s!} L${x + s! * 0.7} ${y! + s! * 0.6} Z`}
          fill={l.accent}
          stroke={INK}
          strokeWidth={2.4}
          strokeLinejoin="round"
        />
      ))}
      <Cut d="M28 68 C30 50 50 42 68 46 C82 50 90 60 86 72 C80 82 40 82 30 76 Z" fill={l.body} shade={l.shade} />
      <path d="M40 72 C46 66 68 66 76 72 C70 79 48 79 40 72 Z" fill={l.belly} />
      <Cut d={leg(44, 74, 11)} fill={l.body} shade={l.shade} />
      <Cut d={leg(75, 74, 11)} fill={l.body} shade={l.shade} />
      <Cut d="M83 62 C86 56 96 54 104 58 C111 62 109 70 101 72 C92 73 86 70 83 66 Z" fill={l.body} shade={l.shade} />
      <path d={mood === 'happy' ? 'M98 68 Q103 70 107 66' : 'M98 69 Q103 66 107 69'} stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Eye x={98} y={61} mood={mood} r={3.6} />
    </g>
  ),

  // ---------------------------------------------------------------- Pterry: wings out, long beak, back crest
  'pterry-dactyl': (l, mood) => (
    <g>
      <Cut d="M54 52 L6 28 C12 42 18 54 30 62 L54 62 Z" fill={l.accent} shade={l.shade} />
      <Cut d="M66 52 L114 28 C108 42 102 54 90 62 L66 62 Z" fill={l.accent} shade={l.shade} />
      <path d="M50 54 L20 36 M50 58 L28 52 M70 54 L100 36 M70 58 L92 52" stroke={INK} strokeWidth={1.6} opacity={0.6} />
      <path d="M55 74 L52 90 M65 74 L68 90" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <path d="M46 90 L56 90 M64 90 L74 90" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <Cut d="M46 62 C46 48 74 48 74 62 C74 76 46 76 46 62 Z" fill={l.body} shade={l.shade} />
      <path d="M52 64 C54 58 66 58 68 64 C66 71 54 71 52 64 Z" fill={l.belly} />
      <Cut d="M62 37 L44 22 L64 31 Z" fill={l.accent} shade={l.shade} sw={2.4} />
      <Cut d="M56 44 C56 33 64 29 71 31 L104 38 L74 46 C67 49 58 49 56 44 Z" fill={l.body} shade={l.shade} />
      <path d="M74 41 L102 38" stroke={INK} strokeWidth={1.8} strokeLinecap="round" />
      <Eye x={67} y={37} mood={mood} r={4} />
    </g>
  ),

  // ---------------------------------------------------------------- Raptor: sickle claw, feather crest, furious brow
  'raging-raptor': (l, mood) => (
    <g>
      <Cut d="M4 48 C18 44 34 44 46 48 L46 60 C32 60 16 57 4 48 Z" fill={l.body} shade={l.shade} />
      <path d="M48 64 C50 72 50 78 46 88 L52 90 L56 74 Z" fill={l.shade} stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />
      <Cut d="M40 52 C40 42 58 38 70 42 C78 46 78 60 72 66 C64 72 46 70 42 62 Z" fill={l.body} shade={l.shade} />
      <path d="M50 58 C56 54 66 54 70 60 C66 66 54 66 50 58 Z" fill={l.belly} />
      <Cut d="M56 62 C62 70 64 76 60 86 L68 89 L70 72 Z" fill={l.body} shade={l.shade} />
      <path d="M68 89 C74 87 78 82 75 77" stroke={INK} strokeWidth={4.2} fill="none" strokeLinecap="round" />
      <path d="M68 89 C74 87 78 82 75 77" stroke="#fff6e0" strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <path d="M72 56 Q80 58 82 64" stroke={INK} strokeWidth={4.6} fill="none" strokeLinecap="round" />
      <path d="M72 56 Q80 58 82 64" stroke={l.body} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Cut d="M66 46 C70 36 74 30 80 28 L88 36 L74 50 Z" fill={l.body} shade={l.shade} />
      <path d="M80 23 L72 11 L84 19 L83 7 L90 19 Z" fill={l.accent} stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      <Cut d="M76 30 C76 22 86 18 96 20 C107 22 113 28 111 34 C105 39 90 40 82 38 Z" fill={l.body} shade={l.shade} />
      <path d="M86 35 L108 33" stroke={INK} strokeWidth={2} strokeLinecap="round" />
      <path d="M92 35 L94 38 L96 35 M100 34.5 L102 37.5 L104 34" fill="#fff" stroke={INK} strokeWidth={1.1} strokeLinejoin="round" />
      <Eye x={92} y={27} mood={mood} r={3.8} />
      {mood !== 'out' && <path d="M86 21 L97 24" stroke={INK} strokeWidth={2.8} strokeLinecap="round" />}
    </g>
  ),
};

/** The dino's shapes alone (0 0 120 100), for nesting inside another drawing. */
export function DinoShape({ dino, mood = 'happy' }: { dino: HldDinoId; mood?: DinoMood }) {
  return <>{speciesOf(dino)(DINO_LOOK[dino] ?? DINO_LOOK['nervous-rex'], mood)}</>;
}

/** A round token: the seat's colour behind the dino (plates, the track). */
export function DinoBadge({ dino, color, mood = 'happy', size = 44 }: { dino: HldDinoId; color: string; mood?: DinoMood; size?: number }) {
  return (
    <svg viewBox="0 0 60 60" width={size} height={size} className="hld-badge" aria-hidden="true">
      <circle cx={30} cy={30} r={27} fill={color} stroke={INK} strokeWidth={3} />
      <circle cx={22} cy={18} r={9} fill="#fff" opacity={0.25} />
      <svg x={4} y={9} width={52} height={44} viewBox="0 0 120 100">
        <DinoShape dino={dino} mood={mood} />
      </svg>
    </svg>
  );
}
