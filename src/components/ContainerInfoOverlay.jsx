import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { TOKENS, containerStatus, containerFillPct } from "../data/statusHelpers";

export default function ContainerInfoOverlay({ container, onClose, onSelectLine }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(
      ref.current,
      { y: 60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }
    );
  }, [container?.id]);

  if (!container) return null;

  const status = containerStatus(container);
  const fillPct = Math.round(containerFillPct(container) * 100);
  const totalBags = container.lines.reduce((a, l) => a + Number(l.qty || 0), 0);
  const totalKg = container.lines.reduce(
    (a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0),
    0
  );

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        background: TOKENS.surface,
        borderTop: `1px solid ${TOKENS.border}`,
        padding: "16px 20px",
        fontFamily: TOKENS.mono,
        color: "#e2e8f0",
        maxHeight: "45%",
        overflowY: "auto",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          {container.number || "Unassigned"}{" "}
          <span style={{ color: "#64748b", fontSize: 12 }}>· {container.size}ft</span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: `1px solid ${TOKENS.border}`,
            color: "#94a3b8",
            borderRadius: 4,
            padding: "4px 10px",
            cursor: "pointer",
            fontFamily: TOKENS.mono,
          }}
        >
          close
        </button>
      </div>

      <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
        <span>status: <b style={{ color: "#e2e8f0" }}>{status}</b></span>
        <span>fill: <b style={{ color: "#e2e8f0" }}>{fillPct}%</b></span>
        <span>bags: <b style={{ color: "#e2e8f0" }}>{totalBags}/{container.capacityBags}</b></span>
        <span>kg: <b style={{ color: "#e2e8f0" }}>{totalKg.toLocaleString()}</b></span>
        <span>seal: <b style={{ color: "#e2e8f0" }}>{container.sealNo || "—"}</b></span>
      </div>

      <div style={{ marginTop: 12 }}>
        {container.lines.length === 0 && (
          <div style={{ color: "#64748b", fontSize: 12 }}>No lines yet.</div>
        )}
        {container.lines.map((l) => (
          <div
            key={l.id}
            onClick={() => onSelectLine && onSelectLine(l.id)}
            style={{
              display: "flex",
              gap: 12,
              fontSize: 12,
              padding: "6px 0",
              borderBottom: `1px solid ${TOKENS.border}`,
              cursor: onSelectLine ? "pointer" : "default",
            }}
          >
            <span style={{ width: 80 }}>{l.cargo}</span>
            <span style={{ width: 60 }}>{l.qty} bags</span>
            <span style={{ width: 90 }}>{l.truckNo}</span>
            <span style={{ flex: 1, color: "#64748b" }}>{l.shipper} → {l.consignee}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
