import { theme } from "../theme";

// Inline confirmation — slides in below the trigger button (no modal overlay).
export default function ConfirmDialog({
  message,
  confirmLabel = "CONFIRM",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}) {
  const accent = confirmVariant === "success" ? theme.color.green : theme.color.red;
  return (
    <div
      style={{
        marginTop: 10,
        background: theme.color.surface,
        border: `1px solid ${accent}`,
        borderRadius: theme.radius.input,
        boxShadow: theme.shadow.card,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.ink }}>{message}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            background: theme.color.surface,
            border: `1px solid ${theme.color.borderStrong}`,
            color: theme.color.inkSoft,
            fontFamily: theme.font.mono,
            fontSize: 11,
            padding: "7px 14px",
            borderRadius: theme.radius.sm,
            cursor: "pointer",
          }}
        >
          CANCEL
        </button>
        <button
          onClick={onConfirm}
          style={{
            background: accent,
            border: "none",
            color: "#fff",
            fontFamily: theme.font.condensed,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "7px 16px",
            borderRadius: theme.radius.sm,
            cursor: "pointer",
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
