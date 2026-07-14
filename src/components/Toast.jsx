import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { theme } from "../theme";
import { glass } from "../ui/theme";

const ToastContext = createContext({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

let nextId = 1;

const BORDER_COLOR = {
  success: theme.color.green,
  error: theme.color.red,
  info: theme.color.amber,
};

function ToastItem({ toast, onDismiss }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.transform = "translateX(20px)";
      el.style.opacity = "0";
      requestAnimationFrame(() => {
        el.style.transform = "translateX(0)";
        el.style.opacity = "1";
      });
    }
    const t = setTimeout(() => onDismiss(toast.id), toast.duration || 3000);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  // An action toast (e.g. "Moved to Trash — Undo") carries a label + callback. The
  // action fires and then dismisses; clicking the body only dismisses.
  const hasAction = !!toast.action;

  return (
    <div
      ref={ref}
      onClick={() => !hasAction && onDismiss(toast.id)}
      style={{
        ...glass(theme.radius.input),
        borderLeft: `3px solid ${BORDER_COLOR[toast.type] || theme.color.amber}`,
        color: theme.color.ink,
        padding: "11px 16px",
        borderRadius: theme.radius.input,
        fontFamily: theme.font.mono,
        fontSize: 12,
        minWidth: 220,
        maxWidth: 340,
        cursor: hasAction ? "default" : "pointer",
        boxShadow: theme.shadow.raised,
        transition: "transform 0.25s ease, opacity 0.25s ease",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ flex: 1 }}>{toast.message}</span>
      {hasAction && (
        <button
          onClick={(e) => { e.stopPropagation(); toast.action.onClick(); onDismiss(toast.id); }}
          style={{
            background: "none",
            border: "none",
            color: theme.color.amber,
            fontFamily: theme.font.mono,
            fontSize: 12,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            cursor: "pointer",
            padding: "2px 4px",
            flexShrink: 0,
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  // showToast(message, type) — simple toast.
  // showToast(message, { type, duration, action: { label, onClick } }) — rich toast
  // with an optional action button (e.g. Undo) and custom auto-dismiss duration.
  const showToast = useCallback((message, typeOrOpts = "info") => {
    const opts = typeof typeOrOpts === "string" ? { type: typeOrOpts } : (typeOrOpts || {});
    const id = nextId++;
    setToasts((cur) => [...cur, { id, message, type: opts.type || "info", duration: opts.duration, action: opts.action }]);
    return id;
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast: dismiss }}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 12,
          right: 12,
          left: "auto",
          zIndex: 9999,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          alignItems: "flex-end",
          pointerEvents: "none",
        }}
        className="toast-stack"
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: "auto" }}>
            <ToastItem toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
