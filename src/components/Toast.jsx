import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { TOKENS } from "../data/statusHelpers";

const ToastContext = createContext({ showToast: () => {} });
export const useToast = () => useContext(ToastContext);

let nextId = 1;

const BORDER_COLOR = {
  success: TOKENS.green,
  error: TOKENS.red,
  info: TOKENS.amber,
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
    const t = setTimeout(() => onDismiss(toast.id), 3000);
    return () => clearTimeout(t);
  }, [toast.id, onDismiss]);

  return (
    <div
      ref={ref}
      onClick={() => onDismiss(toast.id)}
      style={{
        background: TOKENS.surface,
        border: `1px solid ${TOKENS.border}`,
        borderLeft: `3px solid ${BORDER_COLOR[toast.type] || TOKENS.amber}`,
        color: "#e2e8f0",
        padding: "11px 16px",
        fontFamily: TOKENS.mono,
        fontSize: 12,
        minWidth: 220,
        maxWidth: 340,
        cursor: "pointer",
        boxShadow: "0 6px 24px rgba(0,0,0,0.5)",
        transition: "transform 0.25s ease, opacity 0.25s ease",
      }}
    >
      {toast.message}
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = "info") => {
    const id = nextId++;
    setToasts((cur) => [...cur, { id, message, type }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
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
