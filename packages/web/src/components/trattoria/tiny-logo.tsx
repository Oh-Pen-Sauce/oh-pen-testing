/**
 * Stylised bowl of sauce with a pen sticking out like spaghetti.
 * Used in the sidebar brand block. Single SVG, no external deps.
 */
export function TinyLogo({ size = 34 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 60 60"
      width={size}
      height={size}
      style={{ display: "block" }}
      aria-hidden
    >
      <ellipse cx="30" cy="48" rx="22" ry="3" fill="#000" opacity="0.15" />
      <path
        d="M 8 30 Q 30 22, 52 30 L 52 33 Q 30 26, 8 33 Z"
        fill="var(--cream)"
        stroke="var(--ink)"
        strokeWidth="1.5"
      />
      <ellipse
        cx="30"
        cy="30"
        rx="22"
        ry="4"
        fill="var(--sauce)"
        stroke="var(--ink)"
        strokeWidth="1.5"
      />
      <path
        d="M 9 32 Q 13 48, 30 50 Q 47 48, 51 32"
        fill="var(--cream)"
        stroke="var(--ink)"
        strokeWidth="1.5"
      />
      <path
        d="M 13 40 Q 30 44, 47 40"
        fill="none"
        stroke="var(--sauce)"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <g transform="translate(27 8) rotate(12)">
        <rect
          x="0"
          y="0"
          width="6"
          height="12"
          rx="0.8"
          fill="var(--pen-blue)"
          stroke="var(--ink)"
          strokeWidth="1"
        />
        <rect x="0" y="10" width="6" height="2" fill="var(--sauce-dark)" />
        <rect
          x="0.5"
          y="12"
          width="5"
          height="14"
          fill="var(--cream)"
          stroke="var(--ink)"
          strokeWidth="1"
        />
        <path d="M 0.5 26 L 5.5 26 L 3 32 Z" fill="var(--ink)" />
      </g>
    </svg>
  );
}
