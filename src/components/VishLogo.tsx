interface VishLogoProps {
  size?: number;
  className?: string;
  glowing?: boolean;
}

export function VishLogo({ size = 48, className = "", glowing = false }: VishLogoProps) {
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {glowing && (
        <div
          className="absolute inset-0 rounded-full animate-glow-breathe"
          style={{
            background:
              "radial-gradient(circle, rgba(77, 225, 255, 0.26) 0%, rgba(162, 92, 255, 0.12) 48%, transparent 72%)",
            width: size * 1.8,
            height: size * 1.8,
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      {/* Inline glyph (no external logo file). */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        className="relative z-10"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M14 18C14 14.6863 16.6863 12 20 12H44C47.3137 12 50 14.6863 50 18V46C50 49.3137 47.3137 52 44 52H20C16.6863 52 14 49.3137 14 46V18Z"
          stroke="rgba(122, 149, 255, 0.5)"
          strokeWidth="2"
        />
        <path
          d="M22 20C22 19.4477 22.4477 19 23 19H25.4C25.78 19 26.1434 19.1482 26.4121 19.4121L41.6 34.4C41.8639 34.6639 42.0121 35.0273 42.0121 35.4073V37.8C42.0121 38.3523 41.5644 38.8 41.0121 38.8H38.6C38.2199 38.8 37.8565 38.6518 37.5926 38.3879L24.2 25C24.0009 24.8009 23.7351 24.691 23.4585 24.691H23C22.4477 24.691 22 25.1387 22 25.691V20Z"
          stroke="rgba(255, 197, 111, 0.95)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path
          d="M42.2 20.2H44.8C45.3523 20.2 45.8 20.6477 45.8 21.2V44.8C45.8 45.3523 45.3523 45.8 44.8 45.8H42.2C41.6477 45.8 41.2 45.3523 41.2 44.8V21.2C41.2 20.6477 41.6477 20.2 42.2 20.2Z"
          fill="rgba(77, 225, 255, 0.12)"
          stroke="rgba(162, 92, 255, 0.35)"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  );
}
