import { TOKENS } from "../data/statusHelpers";

// Inline confirmation — slides in below the trigger button (no modal overlay).
export default function ConfirmDialog({
  message,
  confirmLabel = "CONFIRM",
  confirmVariant = "danger",
  onConfirm,
  onCancel,
}) {
  const accent = confirmVariant === "success" ? TOKENS.green : TOKENS.red;
  return (
    <div
      style={{
        marginTop: 10,
        background: TOKENS.surface,
        border: `1px solid ${accent}`,
        borderRadius: 8,
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <span style={{ fontFamily: TOKENS.mono, fontSize: 12, color: "#e2e8f0" }}>{message}</span>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            background: "none",
            border: `1px solid ${TOKENS.border}`,
            color: TOKENS.steel,
            fontFamily: TOKENS.mono,
            fontSize: 11,
            padding: "7px 14px",
            borderRadius: 4,
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
            fontFamily: TOKENS.condensed,
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "7px 16px",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
