export function BigBrandLogo({ size = 96, className = '' }: { size?: number; className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-500 hover:scale-105"
      >
        <defs>
          <linearGradient id="bigBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
          <linearGradient id="bigRadarArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="anomalyArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EF4444" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#DC2626" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Ambient Outer Concentric Orbit */}
        <circle cx="50" cy="50" r="46" stroke="#E2E8F0" strokeWidth="1.5" strokeDasharray="4 4" />

        {/* Outer Signal Wave Arc */}
        <path
          d="M 50 16 A 34 34 0 0 1 84 50"
          stroke="url(#bigRadarArc)"
          strokeWidth="3.5"
          strokeLinecap="round"
        />

        {/* Inner Anomaly Signal Indicator Arc */}
        <path
          d="M 50 26 A 24 24 0 0 1 74 50"
          stroke="url(#anomalyArc)"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Coordinate Crosshairs */}
        <line x1="22" y1="50" x2="78" y2="50" stroke="#E2E8F0" strokeWidth="1.25" />
        <line x1="50" y1="22" x2="50" y2="78" stroke="#E2E8F0" strokeWidth="1.25" />

        {/* Diagonal Guideline */}
        <line x1="30" y1="30" x2="70" y2="70" stroke="#F1F5F9" strokeWidth="1" strokeDasharray="2 2" />

        {/* Central Geometric Core Housing */}
        <rect
          x="34"
          y="34"
          width="32"
          height="32"
          rx="8"
          fill="url(#bigBrandGrad)"
          className="shadow-lg"
        />

        {/* Precision Sensor Aperture */}
        <circle cx="50" cy="50" r="6" fill="#FFFFFF" />
        <circle cx="50" cy="50" r="2.5" fill="#2563EB" />

        {/* Satellite Sensor Nodes */}
        <circle cx="74" cy="50" r="4" fill="#10B981" />
        <circle cx="50" cy="26" r="3.5" fill="#3B82F6" />
        <circle cx="26" cy="50" r="3.5" fill="#94A3B8" />
        <circle cx="50" cy="74" r="3.5" fill="#94A3B8" />
      </svg>
    </div>
  );
}
