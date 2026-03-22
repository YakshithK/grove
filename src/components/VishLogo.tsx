interface VishLogoProps {
  size?: number;
  className?: string;
  glowing?: boolean;
}

export function VishLogo({
  size = 48,
  className = "",
  glowing = false,
}: VishLogoProps) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {glowing && (
        <div
          className="absolute rounded-full"
          style={{
            width: size * 1.8,
            height: size * 1.8,
            background:
              "radial-gradient(circle, rgba(155, 255, 215, 0.62) 0%, rgba(155, 255, 215, 0.18) 46%, transparent 72%)",
            filter: "blur(10px)",
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
        aria-hidden="true"
      >
        <path
          d="M35.8 8.8c11.8 1.6 18.4 11.8 15.9 24.2-2.7 13-13.2 22-26 22-8.9 0-15.7-4.2-18.4-11.6-3.8-10.4 2.2-24 16.2-31.4 3.4-1.8 7.9-3 12.3-3.2Z"
          fill="url(#leafGlow)"
        />
        <path
          d="M35.8 8.8c11.8 1.6 18.4 11.8 15.9 24.2-2.7 13-13.2 22-26 22-8.9 0-15.7-4.2-18.4-11.6-3.8-10.4 2.2-24 16.2-31.4 3.4-1.8 7.9-3 12.3-3.2Z"
          stroke="rgba(214, 255, 235, 0.95)"
          strokeWidth="2.1"
        />
        <path
          d="M15 39.6c10.2-10.4 19.1-16.8 31.1-22.2"
          stroke="rgba(221, 255, 238, 0.92)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M29.5 17.7c1.3 9.7-.3 18.2-5.7 27.5"
          stroke="rgba(221, 255, 238, 0.75)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="leafGlow" x1="11" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="rgba(214,255,235,0.98)" />
            <stop offset="0.48" stopColor="rgba(155,255,215,0.98)" />
            <stop offset="1" stopColor="rgba(104,231,181,0.92)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
