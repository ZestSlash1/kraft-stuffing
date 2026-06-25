import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Lock, Unlock } from "lucide-react";
import { TOKENS, CONTAINER_COLORS, CARGO_COLORS, containerStatus, containerFillPct } from "../data/statusHelpers";
import VGMAlert from "./VGMAlert";
import PresenceAvatars from "./PresenceAvatars";

const STRIPE_COUNT = 16;

export default function ContainerCard({
  container,
  index,
  selected = false,
  compact = false,
  onClick,
  presenceMap,
  showVgm = false,
}) {
  const status = containerStatus(container);
  const colors = CONTAINER_COLORS[status] || CONTAINER_COLORS.EMPTY;
  const fillPct = Math.round(containerFillPct(container) * 100);
  const totalBags = container.lines.reduce((a, l) => a + Number(l.qty || 0), 0);
  const totalKg = container.lines.reduce(
    (a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0),
    0
  );
  const cargoColor = CARGO_COLORS[container.lines[0]?.cargo] || CARGO_COLORS.default;
  const capacityUnit = container.capacityUnit || "Bags";

  const cardRef = useRef();
  const wasSealed = useRef(container.sealed);
  useEffect(() => {
    if (!wasSealed.current && container.sealed && cardRef.current) {
      gsap.to(cardRef.current, {
        borderColor: TOKENS.green,
        duration: 0.2,
        yoyo: true,
        repeat: 1,
        ease: "power1.inOut",
      });
    }
    wasSealed.current = container.sealed;
  }, [container.sealed]);

  const height = compact ? 300 : 220;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: 10,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        background: colors.hull,
        border: selected ? `2px solid ${colors.accent}` : "2px solid rgba(0,0,0,0.4)",
        boxShadow: selected
          ? `0 0 0 4px rgba(255,255,255,0.04), 0 12px 28px -8px ${colors.accent}55`
          : "0 8px 20px -10px rgba(0,0,0,0.6)",
        transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
        transform: selected ? "translateY(-4px)" : "translateY(0)",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          opacity: 0.35,
          pointerEvents: "none",
        }}
      >
        {Array.from({ length: STRIPE_COUNT }, (_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              background: i % 2 === 0 ? colors.stripe : "transparent",
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "100%",
          height: 6,
          background: "rgba(0,0,0,0.35)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${fillPct}%`,
            background: cargoColor,
            boxShadow: `0 0 10px ${cargoColor}aa`,
            transition: "width 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 1,
          height: "70%",
          background: "rgba(0,0,0,0.35)",
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "32%",
          left: "calc(50% - 14px)",
          width: 10,
          height: 10,
          borderRadius: 2,
          background: "rgba(0,0,0,0.4)",
        }}
      />
      <div
        style={{
          position: "absolute",
          bottom: "32%",
          left: "calc(50% + 4px)",
          width: 10,
          height: 10,
          borderRadius: 2,
          background: "rgba(0,0,0,0.4)",
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 18,
          fontFamily: TOKENS.mono,
          fontWeight: 700,
          fontSize: compact ? 38 : 30,
          color: colors.text,
          letterSpacing: -1,
          textShadow: "0 2px 10px rgba(0,0,0,0.35)",
        }}
      >
        {String(index + 1).padStart(2, "0")}
      </div>

      <div
        style={{
          position: "absolute",
          top: 18,
          right: 16,
          display: "flex",
          alignItems: "center",
          gap: 8,
          color: colors.text,
        }}
      >
        <PresenceAvatars presenceMap={presenceMap} containerId={container.id} />
        {container.sealed ? <Lock size={16} /> : <Unlock size={16} />}
      </div>

      <div
        style={{
          position: "absolute",
          left: 18,
          bottom: 14,
          fontFamily: TOKENS.mono,
          color: colors.text,
          fontSize: 16,
          fontWeight: 600,
        }}
      >
        {container.number || "Unassigned"}
      </div>

      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 12,
          textAlign: "right",
          fontFamily: TOKENS.mono,
          fontSize: 10.5,
          lineHeight: 1.65,
          color: colors.text,
          opacity: 0.92,
        }}
      >
        <div>STATUS &nbsp;{status}</div>
        <div>FILL &nbsp;&nbsp;&nbsp;{fillPct}%</div>
        <div>
          {capacityUnit.toUpperCase()} &nbsp;{totalBags}/{container.capacityBags}
        </div>
        <div>KG &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{totalKg.toLocaleString()}</div>
        <div>SEAL &nbsp;&nbsp;{container.sealNo || "—"}</div>
      </div>

      {showVgm && (
        <div style={{ position: "absolute", left: 12, right: 12, top: 56 }}>
          <VGMAlert container={container} />
        </div>
      )}
    </div>
  );
}
