import { containerStatus, containerFillPct, CONTAINER_COLORS } from "../data/statusHelpers";

// Rich side-view dock scene: gantry cranes, a busy quay wall of background
// container stacks for port density, and a container ship whose deck carries
// one bright, status-coloured bay per voyage container (clickable + marked).

const VB_W = 1200;
const VB_H = 500;
const DECK_Y = 340; // deck line — lowest tier sits here
const BAY_W = 86;
const BAY_GAP = 8;
const TIER_H = 34;

const BACK_PALETTE = ["#16403a", "#1b4a55", "#34301d", "#1d4a40", "#123a4f"];

function tiersFor(status, pct) {
  if (status === "EMPTY") return 1;
  if (pct >= 80) return 4;
  if (pct >= 45) return 3;
  return 2;
}

function Box({ x, yTop, w, h, hull, stripe, accent, dim = false }) {
  return (
    <g opacity={dim ? 0.4 : 1}>
      <rect x={x} y={yTop} width={w} height={h} rx="2" fill={hull} />
      <rect x={x} y={yTop} width={w} height={5} rx="2" fill={accent} opacity={dim ? 0.4 : 0.55} />
      {Array.from({ length: 7 }).map((_, i) => (
        <line
          key={i}
          x1={x + 6 + i * ((w - 12) / 7)}
          y1={yTop + 6}
          x2={x + 6 + i * ((w - 12) / 7)}
          y2={yTop + h - 3}
          stroke={stripe}
          strokeWidth="2"
          opacity="0.5"
        />
      ))}
      <rect x={x} y={yTop} width="3" height={h} fill="#00000055" />
      <rect x={x + w - 3} y={yTop} width="3" height={h} fill="#00000055" />
      <rect x={x} y={yTop + h - 3} width={w} height={3} fill="#00000040" />
    </g>
  );
}

function Crane({ x }) {
  const stroke = "#1f5450";
  return (
    <g stroke={stroke} strokeWidth="4" fill="none" opacity="0.5">
      <line x1={x} y1="46" x2={x - 26} y2={DECK_Y} />
      <line x1={x + 90} y1="46" x2={x + 116} y2={DECK_Y} />
      <line x1={x} y1="46" x2={x + 90} y2="46" />
      <line x1={x - 46} y1="46" x2={x + 170} y2="46" />
      <line x1={x + 170} y1="46" x2={x + 170} y2="100" />
      <line x1={x + 44} y1="46" x2={x + 44} y2="140" strokeWidth="2" />
      <rect x={x + 33} y="140" width="22" height="13" fill={stroke} opacity="0.6" />
    </g>
  );
}

// Dim quay wall of container stacks across the full width — port density.
function BackdropStacks() {
  const w = 64;
  const stacks = [];
  let x = 20;
  let i = 0;
  while (x < VB_W - 20) {
    const tiers = 2 + ((i * 7) % 3);
    const color = BACK_PALETTE[i % BACK_PALETTE.length];
    for (let t = 0; t < tiers; t++) {
      stacks.push(
        <Box
          key={`${i}-${t}`}
          x={x}
          yTop={DECK_Y - (t + 1) * 28}
          w={w}
          h={28}
          hull={color}
          stripe="#0a201c"
          accent="#2a6a62"
          dim
        />
      );
    }
    x += w + 6;
    i += 1;
  }
  return <g>{stacks}</g>;
}

export default function DockScene({ containers = [], onContainerClick, style }) {
  const list = containers.slice(0, 12);
  const n = Math.max(list.length, 1);
  const totalW = n * BAY_W + (n - 1) * BAY_GAP;
  const startX = Math.max(120, (VB_W - totalW) / 2);
  const sternX = startX + totalW + 20;

  return (
    <svg viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="xMidYMid meet" style={style} role="img" aria-label="Dock operations">
      <defs>
        <radialGradient id="dockGlowRed" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ff5a5a" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#ff5a5a" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dockGlowAmber" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb04d" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#ffb04d" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dockGlowCyan" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#3fd0e0" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3fd0e0" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="hullGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#13403b" />
          <stop offset="100%" stopColor="#0a2a27" />
        </linearGradient>
        <linearGradient id="waterGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0c302c" />
          <stop offset="100%" stopColor="#061a17" />
        </linearGradient>
      </defs>

      {/* ambient light */}
      <ellipse cx={VB_W * 0.6} cy="90" rx="640" ry="240" fill="#1c5650" opacity="0.2" />

      {/* cranes */}
      <Crane x={180} />
      <Crane x={560} />
      <Crane x={940} />

      {/* dim quay wall */}
      <BackdropStacks />

      {/* status glows behind highlighted bays */}
      {list.map((c, i) => {
        const status = containerStatus(c);
        const x = startX + i * (BAY_W + BAY_GAP) + BAY_W / 2;
        const glow =
          status === "OVER" ? "url(#dockGlowRed)" :
          status === "STUFFING" ? "url(#dockGlowCyan)" :
          status === "FULL" ? "url(#dockGlowAmber)" : null;
        if (!glow) return null;
        return <circle key={`g${c.id}`} cx={x} cy={DECK_Y - 55} r="95" fill={glow} />;
      })}

      {/* hull */}
      <path
        d={`M 40 ${DECK_Y} L ${sternX + 80} ${DECK_Y} L ${sternX + 80} ${DECK_Y + 54} L 120 ${DECK_Y + 62} Z`}
        fill="url(#hullGrad)"
        stroke="#1f5450"
        strokeWidth="1"
      />
      <path d={`M 40 ${DECK_Y} L -70 ${DECK_Y + 22} L 120 ${DECK_Y + 62} Z`} fill="url(#hullGrad)" />
      <line x1="-60" y1={DECK_Y} x2={sternX + 80} y2={DECK_Y} stroke="#2a6a62" strokeWidth="2" opacity="0.6" />
      <rect x="40" y={DECK_Y + 24} width={sternX + 40} height="2" fill="#0c4f48" opacity="0.6" />

      {/* foreground data bays */}
      {list.map((c, i) => {
        const status = containerStatus(c);
        const colors = CONTAINER_COLORS[status] || CONTAINER_COLORS.EMPTY;
        const pct = Math.round(containerFillPct(c) * 100);
        const tiers = tiersFor(status, pct);
        const x = startX + i * (BAY_W + BAY_GAP);

        if (status === "EMPTY") {
          return (
            <g key={c.id} style={{ cursor: "pointer" }} onClick={() => onContainerClick?.(c.id)}>
              <rect x={x} y={DECK_Y - TIER_H} width={BAY_W} height={TIER_H} rx="2" fill="#0a2420" stroke="#2a6a62" strokeWidth="1.5" strokeDasharray="5 5" opacity="0.6" />
            </g>
          );
        }

        return (
          <g key={c.id} className="vessel-slot" style={{ cursor: "pointer" }} onClick={() => onContainerClick?.(c.id)}>
            {/* ground shadow */}
            <ellipse cx={x + BAY_W / 2} cy={DECK_Y + 4} rx={BAY_W / 2} ry="5" fill="#000000" opacity="0.25" />
            {Array.from({ length: tiers }).map((_, t) => (
              <Box key={t} x={x} yTop={DECK_Y - (t + 1) * TIER_H} w={BAY_W} h={TIER_H} hull={colors.hull} stripe={colors.stripe} accent={colors.accent} />
            ))}
            {(status === "OVER" || status === "STUFFING") && (
              <g transform={`translate(${x + BAY_W / 2}, ${DECK_Y - tiers * TIER_H - 24})`}>
                <circle r="14" fill="#0b201e" stroke={colors.accent} strokeWidth="1.5" />
                {status === "OVER" ? (
                  <text textAnchor="middle" y="6" fontSize="17" fill="#ff6b6b" fontWeight="700">!</text>
                ) : (
                  <circle r="4.5" fill={colors.accent} />
                )}
              </g>
            )}
          </g>
        );
      })}

      {/* accommodation block / bridge */}
      <g>
        <rect x={sternX} y={DECK_Y - 140} width="66" height="140" rx="3" fill="#103833" stroke="#1f5450" />
        <rect x={sternX + 14} y={DECK_Y - 174} width="38" height="34" rx="2" fill="#0d2e2a" stroke="#1f5450" />
        {Array.from({ length: 4 }).map((_, r) =>
          Array.from({ length: 4 }).map((_, col) => (
            <rect
              key={`${r}-${col}`}
              x={sternX + 10 + col * 13}
              y={DECK_Y - 126 + r * 26}
              width="8"
              height="10"
              rx="1"
              fill={(r + col) % 3 === 0 ? "#ffcf8a" : "#1a514a"}
              opacity={(r + col) % 3 === 0 ? 0.9 : 0.6}
            />
          ))
        )}
        <rect x={sternX + 24} y={DECK_Y - 204} width="20" height="32" rx="3" fill="#0e3631" stroke="#1f5450" />
        <rect x={sternX + 24} y={DECK_Y - 204} width="20" height="8" fill={CONTAINER_COLORS.STUFFING.hull} />
      </g>

      {/* water */}
      <rect x="0" y={DECK_Y + 38} width={VB_W} height={VB_H - DECK_Y - 38} fill="url(#waterGrad)" opacity="0.75" />
    </svg>
  );
}
