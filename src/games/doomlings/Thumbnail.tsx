export function DmThumbnail() {
  return (
    <svg viewBox="0 0 240 150" style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <linearGradient id="dm-sky" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="55%" stopColor="#311042" />
          <stop offset="100%" stopColor="#4c1d95" />
        </linearGradient>
        <linearGradient id="dm-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="240" height="150" rx="14" fill="url(#dm-sky)" />
      <path d="M0 125 Q60 95 125 120 T240 112 L240 150 L0 150 Z" fill="#064e3b" opacity="0.7" />
      <path d="M165 14 L212 46 L198 54 Z" fill="#f97316" opacity="0.85" />
      <circle cx="165" cy="18" r="11" fill="#ef4444" />
      <circle cx="163" cy="16" r="5" fill="#fde047" />
      <circle cx="38" cy="36" r="8" fill="#ef4444" stroke="#fff" strokeWidth="1.5" />
      <circle cx="60" cy="26" r="8" fill="#3b82f6" stroke="#fff" strokeWidth="1.5" />
      <circle cx="82" cy="36" r="8" fill="#22c55e" stroke="#fff" strokeWidth="1.5" />
      <circle cx="104" cy="26" r="8" fill="#a855f7" stroke="#fff" strokeWidth="1.5" />
      <ellipse cx="120" cy="100" rx="34" ry="30" fill="url(#dm-body)" stroke="#ecfdf5" strokeWidth="2" />
      <path d="M98 76 L90 58 L108 71 Z" fill="#facc15" />
      <path d="M142 76 L150 58 L132 71 Z" fill="#facc15" />
      <circle cx="108" cy="94" r="7" fill="#fff" />
      <circle cx="132" cy="94" r="7" fill="#fff" />
      <circle cx="109" cy="94" r="3.5" fill="#0f172a" />
      <circle cx="133" cy="94" r="3.5" fill="#0f172a" />
      <path d="M110 110 Q120 118 130 110" fill="none" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
