import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import { TOKENS, containerStatus, containerFillPct } from "../data/statusHelpers";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function ContainerInfoOverlay({ container, onClose, onSelectLine }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;
    if (reducedMotion()) return;
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
  const grossKg = totalKg + Number(container.tareWeightKg || 0);

  const dataGrid = [
    ["SEAL NO", container.sealNo || "—"],
    ["CONDITION", container.condition || "Clean"],
    ["TARE", container.tareWeightKg ? `${container.tareWeightKg} kg` : "—"],
    ["VGM", `${(grossKg / 1000).toFixed(2)} MT`],
    ["NET WT", `${(totalKg / 1000).toFixed(2)} MT`],
    ["GROSS WT", `${(grossKg / 1000).toFixed(2)} MT`],
    ["CML", container.cmlKg ? `${(container.cmlKg / 1000).toFixed(2)} MT` : "—"],
    ["STATUS", status],
  ];

  return (
    <div
      ref={ref}
      className="mono"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        background: TOKENS.surface,
        borderTop: `1px solid ${TOKENS.border}`,
        color: "#e2e8f0",
        maxHeight: "55%",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          height: 48,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 20px",
          borderBottom: `1px solid ${TOKENS.border}`,
          flexShrink: 0,
        }}
      >
        <div className="condensed" style={{ fontSize: 22, fontWeight: 800 }}>
          {container.number || "Unassigned"}{" "}
          <span className="label-xs" style={{ fontWeight: 400 }}>
            · {container.size}ft · {fillPct}% FULL · {totalBags}/{container.capacityBags}
          </span>
        </div>
        <button
          onClick={onClose}
          className="mono label-xs"
          style={{
            background: "none",
            border: `1px solid ${TOKENS.border}`,
            color: TOKENS.steel,
            borderRadius: 0,
            padding: "5px 12px",
            cursor: "pointer",
          }}
        >
          close
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 24px",
          padding: "16px 20px",
          borderBottom: `1px solid ${TOKENS.border}`,
        }}
      >
        {dataGrid.map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="label-xs">{label}</span>
            <span style={{ fontSize: 13, color: "#e2e8f0" }}>{value}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 20px" }}>
        {container.lines.length === 0 && (
          <div className="label-xs">No lines yet.</div>
        )}
        {container.lines.map((l) => (
          <div
            key={l.id}
            onClick={() => onSelectLine && onSelectLine(l.id)}
            style={{
              padding: "10px 0",
              borderBottom: `1px solid ${TOKENS.border}`,
              cursor: onSelectLine ? "pointer" : "default",
            }}
          >
            <div style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{l.cargo}</span>
              {" — "}
              {l.qty} {l.unit || "Bags"}
              {" — "}
              <span style={{ color: TOKENS.steel }}>{l.truckNo || "—"}</span>
            </div>
            <div style={{ marginLeft: 14, marginTop: 2, fontSize: 11, color: TOKENS.steel }}>
              {l.shipper} → {l.consignee}
            </div>
            {(l.invoiceNos?.length > 0 || l.hsCode) && (
              <div style={{ marginLeft: 14, marginTop: 1, fontSize: 11, color: TOKENS.steel }}>
                {l.invoiceNos?.length > 0 && `inv: ${l.invoiceNos.join(", ")}`}
                {l.invoiceNos?.length > 0 && l.hsCode && " — "}
                {l.hsCode && `HS: ${l.hsCode}`}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
