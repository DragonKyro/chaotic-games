export function Thumbnail() {
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label="Unstable Unicorns">
      <rect x={0} y={0} width={160} height={100} fill="#1b1530" />
      <g fill="none" strokeLinecap="round" strokeWidth={5} opacity={0.85}>
        <path d="M16,86 A64,64 0 0,1 144,86" stroke="#ef4444" />
        <path d="M22,86 A58,58 0 0,1 138,86" stroke="#f97316" />
        <path d="M28,86 A52,52 0 0,1 132,86" stroke="#eab308" />
        <path d="M34,86 A46,46 0 0,1 126,86" stroke="#22c55e" />
        <path d="M40,86 A40,40 0 0,1 120,86" stroke="#3b82f6" />
        <path d="M46,86 A34,34 0 0,1 114,86" stroke="#a855f7" />
      </g>
      <g transform="rotate(-14 48 56)">
        <rect x={26} y={24} width={44} height={60} rx={6} fill="#fef9ef" stroke="#221f33" strokeWidth={2.4} />
        <rect x={30} y={28} width={36} height={34} rx={3} fill="#ef4444" />
        <text x={48} y={50} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="bold">NEIGH!</text>
      </g>
      <g transform="rotate(14 112 56)">
        <rect x={90} y={24} width={44} height={60} rx={6} fill="#fef9ef" stroke="#221f33" strokeWidth={2.4} />
        <rect x={94} y={28} width={36} height={34} rx={3} fill="#22c55e" />
        <path d="M112,34 L115,43 L124,43 L117,48 L119,57 L112,52 L105,57 L107,48 L100,43 L109,43 Z" fill="#fde047" />
      </g>
      <g>
        <rect x={56} y={16} width={48} height={66} rx={6} fill="#ffffff" stroke="#221f33" strokeWidth={2.6} />
        <rect x={60} y={20} width={40} height={42} rx={4} fill="#3b82f6" />
        <path d="M72,56 Q68,40 78,34 Q88,34 90,44 Q94,46 92,52 Q86,56 72,56 Z" fill="#fff" stroke="#221f33" strokeWidth={2} />
        <path d="M80,34 L90,14 L85,36 Z" fill="#facc15" stroke="#221f33" strokeWidth={1.8} />
        <path d="M68,38 Q62,44 66,54" fill="none" stroke="#ec4899" strokeWidth={3.5} strokeLinecap="round" />
        <circle cx={83} cy={42} r={2} fill="#221f33" />
        <rect x={63} y={66} width={34} height={4} rx={2} fill="#cbd5e1" />
        <rect x={68} y={73} width={24} height={4} rx={2} fill="#cbd5e1" />
      </g>
    </svg>
  );
}
