/**
 * CookingMarinara — animated inline SVG used as the starter-scan
 * progress indicator. Marinara (our tomato mascot) wears a chef's
 * toque, stirs a pot of sauce with a wooden spoon, bubbles pop in the
 * pot, steam rises in puffs. All pure SVG + CSS keyframes declared in
 * globals.css — no external assets, no animation libs, scales cleanly.
 *
 * The component is presentational only. It doesn't know about scan
 * state — the parent (StarterGate) controls when to show it.
 */
export function CookingMarinara({ size = 180 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 180 180"
      width={size}
      height={size}
      style={{ display: "block", overflow: "visible" }}
      role="img"
      aria-label="Marinara cooking a pot of sauce"
    >
      <defs>
        {/* subtle radial highlight used on the sauce surface */}
        <radialGradient id="sauce-glow" cx="50%" cy="30%" r="65%">
          <stop offset="0%" stopColor="#E64A32" />
          <stop offset="100%" stopColor="#8F1E10" />
        </radialGradient>
      </defs>

      {/* ——— steam puffs (rise + fade) ——— */}
      <g style={{ opacity: 0.85 }}>
        <ellipse
          className="steam-puff steam-a"
          cx="72"
          cy="48"
          rx="9"
          ry="7"
          fill="#F4E9D4"
        />
        <ellipse
          className="steam-puff steam-b"
          cx="92"
          cy="42"
          rx="10"
          ry="8"
          fill="#FBF4E4"
        />
        <ellipse
          className="steam-puff steam-c"
          cx="112"
          cy="52"
          rx="8"
          ry="6"
          fill="#F4E9D4"
        />
      </g>

      {/* ——— Marinara herself — tomato chef, bobbing ——— */}
      <g className="chef-bob">
        {/* chef toque (white with red band) */}
        <g transform="translate(58 36)">
          {/* fluffy top */}
          <ellipse cx="32" cy="10" rx="22" ry="14" fill="#FBF4E4" stroke="#221A14" strokeWidth="2" />
          <ellipse cx="18" cy="14" rx="10" ry="9" fill="#FBF4E4" stroke="#221A14" strokeWidth="2" />
          <ellipse cx="46" cy="14" rx="10" ry="9" fill="#FBF4E4" stroke="#221A14" strokeWidth="2" />
          {/* band */}
          <rect
            x="8"
            y="22"
            width="48"
            height="8"
            rx="1"
            fill="#C8321E"
            stroke="#221A14"
            strokeWidth="2"
          />
        </g>

        {/* tomato body */}
        <ellipse
          cx="90"
          cy="86"
          rx="30"
          ry="28"
          fill="#C8321E"
          stroke="#221A14"
          strokeWidth="2.5"
        />
        {/* highlight */}
        <ellipse
          cx="80"
          cy="74"
          rx="8"
          ry="6"
          fill="#E64A32"
          opacity="0.7"
        />
        {/* little green leaf poking from under the hat */}
        <path
          d="M 80 65 Q 90 58, 100 65 Q 95 62, 90 63 Q 85 62, 80 65 Z"
          fill="#3F7A3A"
          stroke="#221A14"
          strokeWidth="1.5"
        />

        {/* face */}
        <circle cx="82" cy="86" r="2" fill="#221A14" />
        <circle cx="98" cy="86" r="2" fill="#221A14" />
        <path
          d="M 83 94 Q 90 99, 97 94"
          stroke="#221A14"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
        {/* cheeks */}
        <circle cx="76" cy="91" r="3" fill="#8F1E10" opacity="0.35" />
        <circle cx="104" cy="91" r="3" fill="#8F1E10" opacity="0.35" />

        {/* ——— arm + wooden spoon (rotates to stir) ——— */}
        <g className="stirring-arm" style={{ transformOrigin: "118px 98px" }}>
          {/* shoulder/arm */}
          <path
            d="M 115 98 Q 130 92, 142 96"
            stroke="#C8321E"
            strokeWidth="8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M 115 98 Q 130 92, 142 96"
            stroke="#221A14"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* spoon handle */}
          <rect
            x="140"
            y="86"
            width="4"
            height="26"
            rx="1"
            fill="#B98A5A"
            stroke="#221A14"
            strokeWidth="1.5"
            transform="rotate(18 142 100)"
          />
          {/* spoon bowl */}
          <ellipse
            cx="150"
            cy="112"
            rx="7"
            ry="4"
            fill="#B98A5A"
            stroke="#221A14"
            strokeWidth="1.5"
            transform="rotate(18 150 112)"
          />
        </g>
      </g>

      {/* ——— pot ——— */}
      {/* rim shadow */}
      <ellipse cx="90" cy="125" rx="48" ry="6" fill="#221A14" opacity="0.15" />
      {/* pot body */}
      <path
        d="M 44 125 L 50 165 Q 50 170, 55 170 L 125 170 Q 130 170, 130 165 L 136 125 Z"
        fill="#221A14"
        stroke="#221A14"
        strokeWidth="2.5"
      />
      {/* body highlight */}
      <path
        d="M 52 133 L 56 164"
        stroke="#3E3128"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {/* handles */}
      <rect
        x="30"
        y="132"
        width="18"
        height="6"
        rx="3"
        fill="#221A14"
        stroke="#221A14"
        strokeWidth="2"
      />
      <rect
        x="132"
        y="132"
        width="18"
        height="6"
        rx="3"
        fill="#221A14"
        stroke="#221A14"
        strokeWidth="2"
      />
      {/* rim */}
      <ellipse
        cx="90"
        cy="125"
        rx="46"
        ry="8"
        fill="#3E3128"
        stroke="#221A14"
        strokeWidth="2.5"
      />
      {/* sauce surface */}
      <ellipse
        cx="90"
        cy="124"
        rx="42"
        ry="6"
        fill="url(#sauce-glow)"
        stroke="#8F1E10"
        strokeWidth="1.5"
      />

      {/* ——— bubbles in the sauce (stagger pop) ——— */}
      <g>
        <circle
          className="sauce-bubble bubble-a"
          cx="68"
          cy="122"
          r="2.5"
          fill="#FBF4E4"
        />
        <circle
          className="sauce-bubble bubble-b"
          cx="90"
          cy="126"
          r="3"
          fill="#FBF4E4"
        />
        <circle
          className="sauce-bubble bubble-c"
          cx="108"
          cy="121"
          r="2"
          fill="#FBF4E4"
        />
        <circle
          className="sauce-bubble bubble-d"
          cx="78"
          cy="124"
          r="2"
          fill="#FBF4E4"
        />
      </g>

      {/* checkered kitchen-floor accent under the pot */}
      <g transform="translate(14 170)">
        {Array.from({ length: 10 }).map((_, i) => (
          <rect
            key={i}
            x={i * 15}
            y={0}
            width={15}
            height={6}
            fill={i % 2 === 0 ? "#C8321E" : "#F4E9D4"}
            stroke="#221A14"
            strokeWidth="0.8"
          />
        ))}
      </g>
    </svg>
  );
}
