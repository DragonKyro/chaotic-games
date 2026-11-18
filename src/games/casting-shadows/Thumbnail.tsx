export function Thumbnail() {
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label="Casting Shadows">
      <rect x={0} y={0} width={160} height={100} fill="#141024" />
      <polygon
        points="80,26 98,36 98,58 80,68 62,58 62,36"
        fill="#2e1065"
        stroke="#a855f7"
        strokeWidth={2}
      />
      <polygon
        points="44,18 58,26 58,42 44,50 30,42 30,26"
        fill="#1e3a8a"
        stroke="#38bdf8"
        strokeWidth={1.8}
      />
      <polygon
        points="116,18 130,26 130,42 116,50 102,42 102,26"
        fill="#7f1d1d"
        stroke="#fb923c"
        strokeWidth={1.8}
      />
      <polygon
        points="44,54 58,62 58,78 44,86 30,78 30,62"
        fill="#312e81"
        stroke="#818cf8"
        strokeWidth={1.8}
      />
      <polygon
        points="116,54 130,62 130,78 116,86 102,78 102,62"
        fill="#4c1d95"
        stroke="#c084fc"
        strokeWidth={1.8}
      />
      <circle cx={80} cy={47} r={11} fill="#0f0720" stroke="#e879f9" strokeWidth={1.8} />
      <path d="M80 39 L85 47 L80 55 L75 47 Z" fill="#facc15" />
      <circle cx={44} cy={34} r={5} fill="#38bdf8" />
      <circle cx={116} cy={34} r={5} fill="#ef4444" />
    </svg>
  );
}
