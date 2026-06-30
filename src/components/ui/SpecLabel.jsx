import { theme } from "../../theme";

// SpecLabel — a quiet spec readout: italic slate label above a mono value.
// Used for dimension / tare / VGM / CML on the container hero.
// `tone` optionally colours the value (e.g. "over" for a breached VGM).
export default function SpecLabel({ label, value, unit, tone, align = "left", style }) {
  const valueColor =
    tone === "over" ? theme.color.red : tone === "ok" ? theme.color.green : theme.color.ink;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 3,
        alignItems: align === "center" ? "center" : "flex-start",
        textAlign: align,
        ...style,
      }}
    >
      <span
        style={{
          fontFamily: theme.font.body,
          fontStyle: "italic",
          fontSize: 11,
          color: theme.color.slate,
          letterSpacing: "0.01em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: theme.font.mono,
          fontSize: 15,
          fontWeight: 600,
          color: valueColor,
          lineHeight: 1.1,
        }}
      >
        {value}
        {unit != null && (
          <span style={{ fontSize: 11, color: theme.color.slate, marginLeft: 3, fontWeight: 400 }}>
            {unit}
          </span>
        )}
      </span>
    </div>
  );
}
