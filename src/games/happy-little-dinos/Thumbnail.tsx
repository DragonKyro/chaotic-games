export function HldThumbnail() {
  return (
    <svg viewBox="0 0 120 90" width="100%" height="100%" aria-label="Happy Little Dinosaurs">
      <defs>
        <linearGradient id="hldSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e1b4b" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>
      </defs>
      <rect width="120" height="90" rx="10" fill="url(#hldSky)" />
      <path d="M98 10 L76 30" stroke="#f97316" strokeWidth="5" strokeLinecap="round" />
      <circle cx="74" cy="32" r="8" fill="#ef4444" />
      <circle cx="73" cy="31" r="4" fill="#facc15" />
      <path
        d="M24 72 C24 52, 34 40, 48 40 C58 40, 62 46, 62 54 C62 60, 54 62, 52 66 L54 78 L44 78 L44 70 L36 70 L36 78 L26 78 Z"
        fill="#22c55e"
        stroke="#14532d"
        strokeWidth="2"
      />
      <polygon points="34,42 38,34 42,40" fill="#facc15" />
      <polygon points="27,50 29,42 34,46" fill="#facc15" />
      <polygon points="23,60 22,52 28,55" fill="#facc15" />
      <circle cx="53" cy="48" r="2.5" fill="#000" />
      <circle cx="54" cy="47" r="0.9" fill="#fff" />
      <path d="M52 55 Q57 58 60 54" stroke="#14532d" strokeWidth="1.8" fill="none" strokeLinecap="round" />
    </svg>
  );
}
