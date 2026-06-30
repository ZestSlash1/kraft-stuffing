import { CARGO_COLORS } from "../data/statusHelpers";
import { theme } from "../theme";

export default function LineCard({ line, onDelete }) {
  const color = CARGO_COLORS[line.cargo] || CARGO_COLORS.default;
  const kg = Number(line.qty || 0) * Number(line.unitWeightKg || 0);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.input,
        boxShadow: theme.shadow.card,
        padding: "10px 14px",
        fontFamily: theme.font.mono,
        fontSize: 13,
        color: theme.color.ink,
      }}
    >
      <span style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
      <span style={{ width: 90 }}>{line.cargo}</span>
      <span style={{ width: 90 }}>
        {line.qty} {line.unit || "Bags"}
      </span>
      <span style={{ width: 100, color: theme.color.slate }}>{kg.toLocaleString()} kg</span>
      <span style={{ width: 110 }}>{line.truckNo || "—"}</span>
      <span style={{ flex: 1, color: theme.color.slate }}>
        {line.shipper} → {line.consignee}
      </span>
      {onDelete && (
        <button
          onClick={() => onDelete(line.id)}
          style={{
            background: theme.color.surface,
            border: `1px solid ${theme.color.borderStrong}`,
            color: theme.color.red,
            borderRadius: theme.radius.sm,
            padding: "4px 8px",
            minHeight: 44,
            minWidth: 44,
            cursor: "pointer",
            fontFamily: theme.font.mono,
            fontSize: 12,
          }}
        >
          remove
        </button>
      )}
    </div>
  );
}
