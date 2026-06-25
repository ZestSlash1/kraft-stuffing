import { useEffect, useRef, useState } from "react";
import { TOKENS } from "../data/statusHelpers";

const itemStyle = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  color: "#e2e8f0",
  fontFamily: TOKENS.mono,
  fontSize: 12,
  padding: "12px 14px",
  cursor: "pointer",
  minHeight: 44,
};

export default function ExportMenu({ onExportXlsx, onExportPdf }) {
  const [open, setOpen] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="mono"
        style={{
          background: "none",
          border: `1px solid ${TOKENS.border}`,
          color: "#e2e8f0",
          borderRadius: 0,
          padding: "6px 14px",
          cursor: "pointer",
          minHeight: 44,
        }}
      >
        export ▾
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: TOKENS.surface,
            border: `1px solid ${TOKENS.border}`,
            minWidth: 160,
            zIndex: 60,
          }}
        >
          <button
            style={itemStyle}
            onClick={() => {
              setOpen(false);
              onExportXlsx?.();
            }}
          >
            XLSX — full export
          </button>
          <button
            style={{ ...itemStyle, borderTop: `1px solid ${TOKENS.border}` }}
            onClick={() => {
              setOpen(false);
              onExportPdf?.();
            }}
          >
            PDF — packing list
          </button>
        </div>
      )}
    </div>
  );
}
