/**
 * Shared decorative background with gradient, blurred shapes, and faint fashion patterns.
 * Wrap page content with this component for the enhanced visual treatment.
 */
export function BackgroundDecor({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[hsl(270_30%_97%)] via-background to-[hsl(20_40%_95%)]">
      {/* Blurred abstract shapes */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full opacity-[0.07]"
        style={{ background: 'radial-gradient(circle, hsl(270 40% 80%), transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full opacity-[0.06]"
        style={{ background: 'radial-gradient(circle, hsl(20 60% 80%), transparent 70%)' }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 h-[300px] w-[300px] -translate-x-1/2 rounded-full opacity-[0.04]"
        style={{ background: 'radial-gradient(circle, hsl(163 50% 60%), transparent 70%)' }}
      />

      {/* Faint fashion line-art pattern overlay */}
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="fashion-pattern" x="0" y="0" width="120" height="120" patternUnits="userSpaceOnUse">
            {/* Hanger */}
            <path
              d="M60 20 L60 30 M45 35 Q60 20 75 35"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            {/* Dress silhouette */}
            <path
              d="M52 45 L48 80 Q60 85 72 80 L68 45 Q60 40 52 45Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
            {/* Shoe */}
            <path
              d="M20 100 Q20 95 30 95 L38 95 Q40 95 40 100 L20 100Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fashion-pattern)" />
      </svg>

      {/* Page content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
