// The Chaotic Games mark: two fanned cards with a starburst going off in front
// of them. index.html carries the same drawing as its favicon.

/** Points of a jagged star: `n` spikes alternating between radius `r` and `r * inner`. */
function starburstPoints(cx: number, cy: number, r: number, n = 12, inner = 0.62, wobble = 0.12): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    // Irregular spikes read as an explosion rather than a badge.
    const jag = i % 2 === 0 ? 1 - wobble * ((i * 7) % 3) / 2 : inner;
    pts.push(`${(cx + Math.cos(a) * r * jag).toFixed(1)},${(cy + Math.sin(a) * r * jag).toFixed(1)}`);
  }
  return pts.join(' ');
}

function BrandMark() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <g stroke="#120c1f" strokeWidth={3} strokeLinejoin="round">
        <rect x={8} y={10} width={30} height={42} rx={5} fill="#9b6bff" transform="rotate(-16 23 31)" />
        <rect x={24} y={8} width={30} height={42} rx={5} fill="#2de2c4" transform="rotate(12 39 29)" />
        <polygon points={starburstPoints(32, 38, 22, 11, 0.6, 0.18)} fill="#ffd23f" />
        <polygon points={starburstPoints(32, 38, 11, 9, 0.6, 0.1)} fill="#ff5a6a" strokeWidth={2.4} />
      </g>
      <path d="M31 31 L33.5 31 L32.8 40 L31.6 40 Z" fill="#120c1f" />
      <circle cx={32.2} cy={44} r={1.7} fill="#120c1f" />
    </svg>
  );
}

export function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button type="button" className="brand" onClick={onClick} aria-label="Chaotic Games home">
      <BrandMark />
      <span className="brand-word">Chaotic <span>Games</span></span>
    </button>
  );
}

/** A decorative starburst for hero panels. */
export function Burst({ className, fill = '#ffd23f', core = '#ff5a6a' }: { className?: string; fill?: string; core?: string }) {
  return (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true">
      <g stroke="#120c1f" strokeWidth={5} strokeLinejoin="round">
        <polygon points={starburstPoints(100, 100, 96, 14, 0.66, 0.2)} fill={fill} />
        <polygon points={starburstPoints(100, 100, 52, 11, 0.62, 0.14)} fill={core} />
      </g>
    </svg>
  );
}
