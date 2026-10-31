export function Stone({ active = false }: { active?: boolean }) {
  const outline =
    "M39 126C36 105 56 83 86 75C114 67 153 70 178 82C202 94 211 113 201 132C189 154 151 168 115 169C79 170 46 153 39 126Z";
  return (
    <div className={`stone-frame ${active ? "stone-active" : ""}`}>
      <svg
        viewBox="0 0 240 240"
        role="img"
        aria-label="회색과 베이지색이 섞인 매끈한 타원형 조약돌"
      >
        <defs>
          <radialGradient id="pebble-surface" cx="36%" cy="23%" r="84%">
            <stop offset="0" stopColor="#d5cfc3" />
            <stop offset=".35" stopColor="#b7b1a6" />
            <stop offset=".7" stopColor="#97968c" />
            <stop offset="1" stopColor="#686e67" />
          </radialGradient>
          <radialGradient id="pebble-highlight" cx="40%" cy="15%" r="75%">
            <stop stopColor="#f3ecdc" stopOpacity=".55" />
            <stop offset="1" stopColor="#d4cabb" stopOpacity="0" />
          </radialGradient>
          <filter id="pebble-texture" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency=".7"
              numOctaves="4"
              seed="16"
              result="grain"
            />
            <feColorMatrix in="grain" type="saturate" values="0" />
            <feComponentTransfer>
              <feFuncA type="linear" slope=".36" />
            </feComponentTransfer>
            <feBlend in="SourceGraphic" mode="soft-light" />
          </filter>
          <filter
            id="pebble-shadow"
            x="-40%"
            y="-100%"
            width="180%"
            height="300%"
          >
            <feGaussianBlur stdDeviation="6" />
          </filter>
          <clipPath id="pebble-clip">
            <path d={outline} />
          </clipPath>
        </defs>
        <ellipse
          cx="126"
          cy="167"
          rx="72"
          ry="13"
          fill="#54564d"
          opacity=".24"
          filter="url(#pebble-shadow)"
          transform="rotate(-17 126 137)"
        />
        <g transform="rotate(-22 120 120)">
          <path d={outline} fill="url(#pebble-surface)" />
          <g clipPath="url(#pebble-clip)">
            <path
              d={outline}
              fill="url(#pebble-highlight)"
              filter="url(#pebble-texture)"
            />
            <path
              d="M43 128C61 156 120 176 175 150"
              fill="none"
              stroke="#535d53"
              strokeWidth="6"
              opacity=".1"
            />
            <path
              d="M58 100C90 77 143 76 173 88"
              fill="none"
              stroke="#e9e1cf"
              strokeWidth="2"
              opacity=".22"
            />
          </g>
        </g>
      </svg>
    </div>
  );
}
