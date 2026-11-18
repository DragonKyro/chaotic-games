export function Thumbnail() {
  return (
    <svg viewBox="0 0 240 140" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <defs>
        <linearGradient id="hts-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="50%" stopColor="#311042" />
          <stop offset="100%" stopColor="#450a0a" />
        </linearGradient>
      </defs>
      <rect width="240" height="140" rx="12" fill="url(#hts-bg)" />
      <path d="M58 106 L124 40 M50 98 L66 114" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
      <path d="M182 106 L116 40 M190 98 L174 114" stroke="#e2e8f0" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M120 26 L152 38 V68 C152 92 136 108 120 116 C104 108 88 92 88 68 V38 Z"
        fill="#7f1d1d"
        stroke="#facc15"
        strokeWidth="3"
      />
      <rect x="99" y="54" width="18" height="18" rx="3" fill="#f8fafc" stroke="#0f172a" strokeWidth="1.5" />
      <circle cx="104" cy="59" r="1.7" fill="#0f172a" />
      <circle cx="112" cy="67" r="1.7" fill="#0f172a" />
      <rect x="123" y="54" width="18" height="18" rx="3" fill="#facc15" stroke="#0f172a" strokeWidth="1.5" />
      <circle cx="128" cy="59" r="1.7" fill="#0f172a" />
      <circle cx="132" cy="63" r="1.7" fill="#0f172a" />
      <circle cx="136" cy="67" r="1.7" fill="#0f172a" />
      <circle cx="36" cy="36" r="6" fill="#ef4444" />
      <circle cx="36" cy="56" r="6" fill="#f97316" />
      <circle cx="36" cy="76" r="6" fill="#eab308" />
      <circle cx="204" cy="36" r="6" fill="#22c55e" />
      <circle cx="204" cy="56" r="6" fill="#3b82f6" />
      <circle cx="204" cy="76" r="6" fill="#a855f7" />
      <text
        x="120"
        y="131"
        textAnchor="middle"
        fill="#fef08a"
        fontSize="12"
        fontWeight="700"
        letterSpacing="1"
      >
        HERE TO SLAY
      </text>
    </svg>
  );
}
