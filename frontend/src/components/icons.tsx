/**
 * icons.tsx
 * Small stroke icons for the navigation, drawn on one 16 px grid so they read
 * as a set. Decorative only: every use sits next to a text label.
 */

type IconProps = { className?: string }

function Svg({ className = 'h-4 w-4', children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  )
}

/** Wordmark symbol: a shield whose face is a three-node graph. */
export function BrandMark({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 2.2 20 5.3v6.1c0 5-3.4 8.7-8 10.4-4.6-1.7-8-5.4-8-10.4V5.3Z"
        fill="none"
        stroke="#C9A45C"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M8.2 9.4 12 14.6l3.8-5.2M8.2 9.4h7.6" stroke="#A88746" strokeWidth="1.1" fill="none" />
      <circle cx="8.2" cy="9.4" r="1.45" fill="#E5D2A0" />
      <circle cx="15.8" cy="9.4" r="1.45" fill="#E5D2A0" />
      <circle cx="12" cy="14.6" r="1.65" fill="#C9A45C" />
    </svg>
  )
}

export const NavIcons = {
  dashboard: (p: IconProps) => (
    <Svg {...p}>
      <rect x="2" y="2" width="5" height="6" rx="1" />
      <rect x="9" y="2" width="5" height="3.5" rx="1" />
      <rect x="9" y="7.5" width="5" height="6.5" rx="1" />
      <rect x="2" y="10" width="5" height="4" rx="1" />
    </Svg>
  ),
  topology: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="3.5" cy="8" r="1.6" />
      <circle cx="12.5" cy="3.5" r="1.6" />
      <circle cx="12.5" cy="12.5" r="1.6" />
      <path d="M5 7.2 11 4.3M5 8.8l6 2.9M12.5 5.1v5.8" />
    </Svg>
  ),
  path: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="3" cy="12.5" r="1.5" />
      <circle cx="13" cy="3.5" r="1.5" />
      <path d="M4.5 12.5h3.5a2 2 0 0 0 2-2v-5a2 2 0 0 1 2-2" />
    </Svg>
  ),
  honeypot: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 1.8 13.4 4.9v6.2L8 14.2l-5.4-3.1V4.9Z" />
      <circle cx="8" cy="8" r="1.8" />
    </Svg>
  ),
  advanced: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 2v3M8 11v3M2 8h3M11 8h3" />
      <rect x="5" y="5" width="6" height="6" rx="1" />
    </Svg>
  ),
  planning: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 3.5h10M3 8h7M3 12.5h4" />
      <path d="m11 11 1.5 1.5L15 10" />
    </Svg>
  ),
  experiments: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2.5 13.5h11" />
      <path d="M4 11V8M7 11V4.5M10 11V6.5M13 11V3" />
    </Svg>
  ),
  scenarios: (p: IconProps) => (
    <Svg {...p}>
      <ellipse cx="8" cy="3.8" rx="5" ry="1.8" />
      <path d="M3 3.8v8.4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V3.8M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8" />
    </Svg>
  ),
  methodology: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 2.5h7l3 3v8H3Z" />
      <path d="M10 2.5v3h3M5.5 8.5h5M5.5 11h3.5" />
    </Svg>
  ),
  menu: (p: IconProps) => (
    <Svg {...p}>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </Svg>
  ),
}
