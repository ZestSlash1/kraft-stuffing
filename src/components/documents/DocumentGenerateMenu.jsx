import { useEffect, useRef, useState } from "react";
import { theme } from "../../theme";
import DocumentDraftModal from "./DocumentDraftModal";

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

const TYPES = [
  ["hbl", "House Bill of Lading"],
  ["arrival_notice", "Arrival Notice"],
  ["delivery_order", "Delivery Order"],
];

// Dropdown offering the three document types; pre-scoped to `containerId`
// when opened from a specific container (e.g. ContainerInfoOverlay), or left
// for the draft modal's own container picker when opened voyage-wide.
export default function DocumentGenerateMenu({ app, voyage, containerId }) {
  const [open, setOpen] = useState(false);
  const [activeType, setActiveType] = useState(null);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          background: theme.color.surface,
          border: `1px solid ${theme.color.borderStrong}`,
          color: theme.color.inkSoft,
          borderRadius: theme.radius.input,
          padding: "6px 14px",
          cursor: "pointer",
          minHeight: 44,
          fontFamily: theme.font.mono,
          fontSize: 12,
        }}
      >
        documents ▾
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            background: theme.color.surface,
            border: `1px solid ${theme.color.border}`,
            borderRadius: theme.radius.sm,
            boxShadow: theme.shadow.raised,
            minWidth: 200,
            zIndex: 60,
            overflow: "hidden",
          }}
        >
          {TYPES.map(([type, label], i) => (
            <button
              key={type}
              style={{ ...itemStyle, borderTop: i > 0 ? `1px solid ${theme.color.border}` : "none" }}
              onClick={() => {
                setOpen(false);
                setActiveType(type);
              }}
            >
              Generate {label}
            </button>
          ))}
          {/* The Export Carting Order is order-level (multi-container), so it has
              its own standalone module rather than the container draft modal. */}
          <button
            style={{ ...itemStyle, borderTop: `1px solid ${theme.color.border}`, color: theme.color.amberText }}
            onClick={() => {
              setOpen(false);
              app.navigate("carting", { voyageId: voyage.id });
            }}
          >
            Export Carting Order →
          </button>
        </div>
      )}

      {activeType && (
        <DocumentDraftModal
          app={app}
          voyage={voyage}
          type={activeType}
          initialContainerId={containerId}
          onClose={() => setActiveType(null)}
        />
      )}
    </div>
  );
}
