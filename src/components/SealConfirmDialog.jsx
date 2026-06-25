import { useEffect, useState } from "react";
import { TOKENS } from "../data/statusHelpers";

const inputStyle = {
  background: TOKENS.bg,
  border: `1px solid ${TOKENS.border}`,
  color: "#e2e8f0",
  borderRadius: 4,
  padding: "8px 10px",
  fontFamily: TOKENS.mono,
  fontSize: 13,
  width: "100%",
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
        background: "rgba(3,5,8,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: TOKENS.surface,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 8,
          padding: 20,
          width: 320,
          fontFamily: TOKENS.mono,
          color: "#e2e8f0",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 14 }}>
          Seal container {containerNumber || "Unassigned"}?
        </div>

        <label style={{ fontSize: 11, color: "#64748b", marginBottom: 4, display: "block" }}>
          Seal No (required)
        </label>
        <input
          autoFocus
          value={sealNo}
          onChange={(e) => setSealNo(e.target.value)}
          style={{ ...inputStyle, marginBottom: 10 }}
        />

        <label style={{ fontSize: 11, color: "#64748b", marginBottom: 4, display: "block" }}>
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
              background: "none",
              border: `1px solid ${TOKENS.border}`,
              color: "#94a3b8",
              borderRadius: 4,
              padding: "8px 14px",
              minHeight: 44,
              fontFamily: TOKENS.mono,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            disabled={!sealNo.trim()}
            onClick={() => sealNo.trim() && onConfirm({ sealNo: sealNo.trim(), sealNo2: sealNo2.trim() })}
            style={{
              background: sealNo.trim() ? TOKENS.green : "#1c2d42",
              border: "none",
              color: sealNo.trim() ? "#07090e" : "#64748b",
              borderRadius: 4,
              padding: "8px 14px",
              minHeight: 44,
              fontFamily: TOKENS.mono,
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
