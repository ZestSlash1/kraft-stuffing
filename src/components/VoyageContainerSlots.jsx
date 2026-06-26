import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { containerStatus, TOKENS } from "../data/statusHelpers";

// Per-status slot styling (mapped from containerStatus()).
const SLOT_STYLE = {
  EMPTY: {
    background: "transparent",
    border: "1px dashed #1c3050",
    opacity: 0.6,
    dot: "#475569",
  },
  STUFFING: {
    background: "#3a200820",
    border: "1.5px solid #e8930a",
    boxShadow: "0 0 8px #e8930a44",
    dot: "#e8930a",
  },
  FULL: {
    background: "#5a301040",
    border: "1.5px solid #f59e0b",
    boxShadow: "0 0 6px #f59e0b33",
    dot: "#f59e0b",
  },
  OVER: {
    background: "#3a080840",
    border: "1.5px solid #ef4444",
    boxShadow: "0 0 6px #ef444433",
    dot: "#ef4444",
  },
  SEALED: {
    background: "#082a1a80",
    border: "1.5px solid #0b6b50",
    boxShadow: "0 0 10px #0b6b5033",
    dot: "#0b6b50",
  },
};

const MAX_SLOTS = 18;

// Short cargo summary for the tooltip, e.g. "340 bags potato".
function cargoSummary(c) {
  const lines = c.lines || [];
  if (lines.length === 0) return "empty";
  const totalQty = lines.reduce((a, l) => a + Number(l.qty || 0), 0);
  const primary = lines.reduce(
    (best, l) => (Number(l.qty || 0) > Number(best.qty || 0) ? l : best),
    lines[0]
  );
  const unit = (primary.unit || "bags").toLowerCase();
  const cargo = (primary.cargo || "cargo").toLowerCase();
  return `${totalQty} ${unit} ${cargo}`;
}

function Slot({ container, index, onContainerClick, registerRef }) {
  const status = containerStatus(container);
  const s = SLOT_STYLE[status] || SLOT_STYLE.EMPTY;
  const [hover, setHover] = useState(false);

  const num = (container.number || "").trim();
  const label = num ? num.slice(0, 8) : String(index + 1).padStart(2, "0");

  return (
    <div
      ref={(el) => registerRef(container.id, el)}
      className={`vessel-slot${status === "STUFFING" ? " vessel-slot--stuffing" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onContainerClick?.(container.id)}
      style={{
        position: "relative",
        width: "clamp(32px, 4vw, 56px)",
        height: "clamp(20px, 2.5vw, 34px)",
        borderRadius: 3,
        background: s.background,
        border: s.border,
        boxShadow: s.boxShadow,
        opacity: s.opacity ?? 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        pointerEvents: "auto",
        transform: hover ? "scale(1.08)" : "scale(1)",
        transition: "transform 0.15s ease",
        animation: status === "STUFFING" ? "containerPulse 2s ease-in-out infinite" : undefined,
        zIndex: hover ? 30 : 1,
      }}
    >
      {/* container number / slot index */}
      <span
        style={{
          fontFamily: TOKENS.mono,
          fontSize: 7,
          color: num ? "#e8eef4" : TOKENS.steel,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "92%",
          lineHeight: 1,
        }}
      >
        {label}
      </span>

      {/* status dot */}
      <span
        style={{
          position: "absolute",
          right: 2,
          bottom: 2,
          width: 4,
          height: 4,
          borderRadius: "50%",
          background: s.dot,
        }}
      />

      {/* tooltip */}
      {hover && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0a1020",
            border: "1px solid #1c2d42",
            padding: "6px 10px",
            borderRadius: 6,
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: 40,
          }}
        >
          <div
            style={{
              fontFamily: TOKENS.condensed,
              fontWeight: 700,
              fontSize: 11,
              color: "#e8eef4",
            }}
          >
            {num || "—"}
          </div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 9, color: s.dot }}>
            {status} · <span style={{ color: TOKENS.steel }}>{cargoSummary(container)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// Renders N coloured container slots on the ship's deck.
// Absolutely positioned over the VesselIllustration SVG.
export default function VoyageContainerSlots({ containers = [], onContainerClick }) {
  const slotRefs = useRef({});
  const prevSealed = useRef({});

  const registerRef = (id, el) => {
    if (el) slotRefs.current[id] = el;
  };

  // Seal flash: when a container's sealed flips to true, run a one-shot GSAP pulse.
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      containers.forEach((c) => (prevSealed.current[c.id] = !!c.sealed));
      return;
    }
    for (const c of containers) {
      const was = prevSealed.current[c.id];
      if (was === false && c.sealed) {
        const el = slotRefs.current[c.id];
        if (el) {
          gsap
            .timeline()
            .to(el, { boxShadow: "0 0 24px #0b6b50cc", duration: 0.2 })
            .to(el, { boxShadow: "0 0 10px #0b6b5033", duration: 0.6, ease: "power2.out" });
        }
      }
      prevSealed.current[c.id] = !!c.sealed;
    }
  }, [containers]);

  const total = containers.length;
  const overflow = total > MAX_SLOTS;
  const shown = overflow ? containers.slice(0, MAX_SLOTS - 1) : containers;
  const extra = total - (MAX_SLOTS - 1);

  // ≤10 → single row; >10 → two rows, bottom row first (loaded deck-up).
  // We render newest in the top row; CSS column-reverse keeps the bottom row visually first.
  const twoRows = shown.length > 10;
  const half = Math.ceil(shown.length / 2);
  const bottomRow = twoRows ? shown.slice(0, half) : shown;
  const topRow = twoRows ? shown.slice(half) : [];

  const renderRow = (items, startIdx) => (
    <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "nowrap" }}>
      {items.map((c, i) => (
        <Slot
          key={c.id}
          container={c}
          index={startIdx + i}
          onContainerClick={onContainerClick}
          registerRef={registerRef}
        />
      ))}
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        left: "20%",
        width: "48%",
        bottom: "52%",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        alignItems: "center",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {/* top row first in DOM so it sits above the bottom row visually */}
      {twoRows && renderRow(topRow, bottomRow.length)}
      {renderRow(bottomRow, 0)}

      {overflow && (
        <div
          style={{
            fontFamily: TOKENS.mono,
            fontSize: 8,
            color: TOKENS.steel,
            pointerEvents: "none",
          }}
        >
          +{extra} more
        </div>
      )}
    </div>
  );
}
