export function BrandLogo({ className = '', size = 28, pulse = true }: { className?: string; size?: number; pulse?: boolean }) {
  return (
    <div className={`relative flex items-center justify-center shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="transition-transform duration-300 hover:scale-105"
      >
        <defs>
          <linearGradient id="brandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#1D4ED8" />
          </linearGradient>
          <linearGradient id="radarArc" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        <circle cx="18" cy="18" r="16.5" stroke="#E2E8F0" strokeWidth="1.2" strokeDasharray="3 3" />

        <path
          d="M 18 6 A 12 12 0 0 1 30 18"
          stroke="url(#radarArc)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M 18 10 A 8 8 0 0 1 26 18"
          stroke="#3B82F6"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeOpacity="0.75"
        />

        <line x1="8" y1="18" x2="28" y2="18" stroke="#E2E8F0" strokeWidth="1" />
        <line x1="18" y1="8" x2="18" y2="28" stroke="#E2E8F0" strokeWidth="1" />

        <rect
          x="12"
          y="12"
          width="12"
          height="12"
          rx="3.5"
          fill="url(#brandGrad)"
          className="shadow-sm"
        />

        <circle cx="18" cy="18" r="2.5" fill="#FFFFFF" />
        <circle cx="28" cy="18" r="2" fill="#10B981" />
      </svg>

      {pulse && (
        <span
          className="absolute inset-0 rounded-full bg-blue-500/10 pointer-events-none animate-ping"
          style={{ animationDuration: '4s' }}
        />
      )}
    </div>
  );
}
