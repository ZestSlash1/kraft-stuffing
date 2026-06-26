// Stylised side-profile of a small general-cargo vessel (bow facing LEFT).
// Pure decoration — container slots are overlaid separately by VoyageContainerSlots.
// Clean, geometric, infographic-quality. SVG only, no animation on the ship itself.
export default function VesselIllustration({ style }) {
  // The whole ship as one group, so the reflection can re-use it via transform.
  const ship = (
    <>
      {/* ── HULL ──────────────────────────────────────────────────────── */}
      <path
        d="M55,190 L130,128 L820,128 L880,148 L880,218 L820,225
           C660,237 300,237 160,222 L85,210 Z"
        fill="#0d2035"
        stroke="#1a3a5c"
        strokeWidth="2"
      />

      {/* ── HULL DETAIL LINES ─────────────────────────────────────────── */}
      <g stroke="#102840" strokeWidth="1" opacity="0.7">
        {/* waterline stripe */}
        <line x1="130" y1="195" x2="880" y2="195" />
        {/* strake lines between deck and waterline */}
        <line x1="135" y1="150" x2="870" y2="150" />
        <line x1="140" y1="170" x2="872" y2="170" />
        <line x1="150" y1="208" x2="820" y2="208" />
      </g>
      {/* bow anchor hawse */}
      <circle cx="105" cy="200" r="4" fill="none" stroke="#102840" strokeWidth="1" opacity="0.7" />

      {/* ── DECK FITTINGS ─────────────────────────────────────────────── */}
      {/* railing along deck edge */}
      <line x1="130" y1="126" x2="820" y2="126" stroke="#1a3a5c" strokeWidth="1" opacity="0.6" />
      {/* hatch coamings */}
      <rect x="200" y="123" width="120" height="6" fill="#0a1828" stroke="#163050" strokeWidth="0.5" />
      <rect x="340" y="123" width="120" height="6" fill="#0a1828" stroke="#163050" strokeWidth="0.5" />
      <rect x="480" y="123" width="120" height="6" fill="#0a1828" stroke="#163050" strokeWidth="0.5" />

      {/* ── CRANE / CARGO GEAR ────────────────────────────────────────── */}
      <line x1="660" y1="128" x2="660" y2="55" stroke="#1a3a5c" strokeWidth="3" />
      <line x1="660" y1="65" x2="590" y2="100" stroke="#1a3a5c" strokeWidth="2" />
      <line x1="660" y1="55" x2="700" y2="128" stroke="#163050" strokeWidth="1" opacity="0.6" />
      <line x1="660" y1="55" x2="620" y2="128" stroke="#163050" strokeWidth="1" opacity="0.6" />

      {/* ── SUPERSTRUCTURE / BRIDGE (toward stern) ────────────────────── */}
      <rect x="720" y="65" width="155" height="65" fill="#0a1828" stroke="#1a3a5c" strokeWidth="1.5" />
      <rect x="730" y="35" width="135" height="35" fill="#080f1e" stroke="#1a3a5c" strokeWidth="1.5" />

      {/* bridge windows (upper tier) */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={`bw${i}`}
          x={742 + i * 24}
          y="42"
          width="18"
          height="10"
          fill="#0a1e30"
          stroke="#1e3a5a"
          strokeWidth="1"
        />
      ))}

      {/* accommodation windows (two rows in base tier) */}
      {[0, 1].map((row) =>
        [0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
          <rect
            key={`aw${row}-${col}`}
            x={732 + col * 17}
            y={78 + row * 22}
            width="9"
            height="9"
            fill="#060d18"
            stroke="#132030"
            strokeWidth="0.75"
          />
        ))
      )}

      {/* ── FUNNEL ────────────────────────────────────────────────────── */}
      <rect x="780" y="10" width="35" height="28" fill="#07090e" stroke="#1a3a5c" strokeWidth="1.5" />
      <rect x="780" y="25" width="35" height="5" fill="rgba(255,255,255,0.08)" />

      {/* ── BOW ANCHOR ────────────────────────────────────────────────── */}
      <g stroke="#1a3a5c" strokeWidth="1" fill="none" opacity="0.8">
        <line x1="115" y1="192" x2="115" y2="204" />
        <path d="M110,202 Q115,208 120,202" />
        <line x1="111" y1="194" x2="119" y2="194" />
      </g>

      {/* ── PROPELLER HINT (stern, below waterline) ───────────────────── */}
      <ellipse cx="893" cy="216" rx="9" ry="14" fill="#0a1828" stroke="#163050" strokeWidth="1" />
    </>
  );

  return (
    <svg
      viewBox="0 0 1000 320"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      aria-hidden="true"
    >
      <defs>
        <filter id="vessel-reflect-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* water reflection — vertically flipped, blurred, faint */}
      <g transform="scale(1,-1) translate(0,-430)" opacity="0.08" filter="url(#vessel-reflect-blur)">
        {ship}
      </g>

      {ship}
    </svg>
  );
}
