import type { SVGProps } from 'react'

/** Compact brand mark: house + radar rings (uses currentColor for light/dark). */
export function HaushaltsRadarLogo({
  size = 28,
  title = 'HaushaltsRadar',
  ...props
}: SVGProps<SVGSVGElement> & { size?: number; title?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      {...props}
    >
      <title>{title}</title>
      {/* Outer radar ring */}
      <circle
        cx="16"
        cy="17"
        r="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.28"
      />
      {/* Mid radar ring */}
      <circle
        cx="16"
        cy="17"
        r="8.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.5"
      />
      {/* Sweep wedge */}
      <path
        d="M16 17 L26.2 11.2 A12 12 0 0 0 19.4 5.6 Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M16 17 L25.5 11.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* House mark */}
      <path
        d="M11.2 18.2 L16 13.6 L20.8 18.2 V23.2 H18.1 V20.2 H13.9 V23.2 H11.2 Z"
        fill="currentColor"
      />
      {/* Center blip */}
      <circle cx="16" cy="17" r="1.35" fill="currentColor" />
    </svg>
  )
}
