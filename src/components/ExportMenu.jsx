import { useEffect, useRef, useState } from "react";
import { theme } from "../theme";
import { glass } from "../ui/theme";

const itemStyle = {
  display: "block",
  width: "100%",
  textAlign: "left",
  background: "none",
  border: "none",
  color: theme.color.ink,
  fontFamily: theme.font.mono,
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
          ...glass(theme.radius.input),
          color: theme.color.inkSoft,
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
            ...glass(theme.radius.sm),
            boxShadow: theme.shadow.raised,
            minWidth: 160,
            zIndex: 60,
            overflow: "hidden",
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
          {onExportPdf && (
            <button
              style={{ ...itemStyle, borderTop: `1px solid ${theme.color.border}` }}
              onClick={() => {
                setOpen(false);
                onExportPdf();
              }}
            >
              PDF — packing list
            </button>
          )}
        </div>
      )}
    </div>
  );
}
