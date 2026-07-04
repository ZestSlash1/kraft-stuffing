import { useEffect, useState } from "react";
import { theme } from "../theme";
import { glass, input } from "../ui/theme";

const inputStyle = {
  ...input(),
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

// Inline (non-browser-alert) confirmation before sealing a container.
export default function SealConfirmDialog({ containerNumber, onConfirm, onCancel }) {
  const [sealNo, setSealNo] = useState("");
  const [sealNo2, setSealNo2] = useState("");

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(2,4,7,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          ...glass(theme.radius.card),
          boxShadow: theme.shadow.raised,
          padding: 20,
          width: 320,
          fontFamily: theme.font.mono,
          color: theme.color.ink,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
          Seal container {containerNumber || "Unassigned"}?
        </div>

        <label style={{ fontSize: 11, color: theme.color.slate, marginBottom: 4, display: "block" }}>
          Seal No (required)
        </label>
        <input
          autoFocus
          value={sealNo}
          onChange={(e) => setSealNo(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }}
        />

        <label style={{ fontSize: 11, color: theme.color.slate, marginBottom: 4, display: "block" }}>
          Seal No 2 (optional)
        </label>
        <input
          value={sealNo2}
          onChange={(e) => setSealNo2(e.target.value)}
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              background: theme.color.surface,
              border: `1px solid ${theme.color.borderStrong}`,
              color: theme.color.inkSoft,
              borderRadius: theme.radius.sm,
              padding: "8px 14px",
              minHeight: 44,
              fontFamily: theme.font.mono,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            disabled={!sealNo.trim()}
            onClick={() => sealNo.trim() && onConfirm({ sealNo: sealNo.trim(), sealNo2: sealNo2.trim() })}
            style={{
              background: sealNo.trim() ? theme.color.green : theme.color.surfaceMuted,
              border: "none",
              color: sealNo.trim() ? theme.color.white : theme.color.slateFaint,
              borderRadius: theme.radius.sm,
              padding: "8px 14px",
              minHeight: 44,
              fontFamily: theme.font.mono,
              fontWeight: 600,
              cursor: sealNo.trim() ? "pointer" : "not-allowed",
            }}
          >
            Confirm Seal
          </button>
        </div>
      </div>
    </div>
  );
}
