interface VishLogoProps {
  size?: number;
  className?: string;
  glowing?: boolean;
}

export function VishLogo({ size = 48, className = "", glowing = false }: VishLogoProps) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Glow effect behind logo */}
      {glowing && (
        <div
          className="absolute inset-0 rounded-full animate-glow-breathe"
          style={{
            background: 'radial-gradient(circle, rgba(0, 245, 255, 0.3) 0%, transparent 70%)',
            width: size * 1.8,
            height: size * 1.8,
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      )}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10"
      >
        <defs>
          <linearGradient id="vish-gradient" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F5FF" />
            <stop offset="100%" stopColor="#7000FF" />
          </linearGradient>
          <linearGradient id="vish-hook-gradient" x1="28" y1="44" x2="36" y2="56" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00F5FF" />
            <stop offset="100%" stopColor="#00C8FF" />
          </linearGradient>
          <filter id="vish-glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* The V shape — geometric angular hook */}
        <path
          d="M16 10L32 46L48 10"
          stroke="url(#vish-gradient)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#vish-glow)"
        />

        {/* The hook/anchor curl at bottom of V */}
        <path
          d="M32 46C32 46 32 52 28 54C24 56 22 52 22 50"
          stroke="url(#vish-hook-gradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          filter="url(#vish-glow)"
        />

        {/* Small circle at hook tip — like a lure/sonar dot */}
        <circle
          cx="22"
          cy="49"
          r="2.5"
          fill="#00F5FF"
          filter="url(#vish-glow)"
        />
      </svg>
    </div>
  );
}
