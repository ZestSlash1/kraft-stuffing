import { TOKENS, CARGO_COLORS } from "../data/statusHelpers";

export default function LineCard({ line, onDelete }) {
  const color = CARGO_COLORS[line.cargo] || CARGO_COLORS.default;
  const kg = Number(line.qty || 0) * Number(line.unitWeightKg || 0);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: TOKENS.surface,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 6,
        padding: "10px 14px",
        fontFamily: TOKENS.mono,
        fontSize: 13,
        color: "#e2e8f0",
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ width: 90 }}>{line.cargo}</span>
      <span style={{ width: 90 }}>
        {line.qty} {line.unit || "Bags"}
      </span>
      <span style={{ width: 100, color: "#94a3b8" }}>{kg.toLocaleString()} kg</span>
      <span style={{ width: 110 }}>{line.truckNo || "—"}</span>
      <span style={{ flex: 1, color: "#64748b" }}>
        {line.shipper} → {line.consignee}
      </span>
      {onDelete && (
        <button
          onClick={() => onDelete(line.id)}
          style={{
            background: "none",
            border: `1px solid ${TOKENS.border}`,
            color: TOKENS.red,
            borderRadius: 4,
            padding: "4px 8px",
            minHeight: 44,
            minWidth: 44,
            cursor: "pointer",
            fontFamily: TOKENS.mono,
            fontSize: 12,
          }}
        >
          remove
        </button>
      )}
    </div>
  );
}
