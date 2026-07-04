// Slim red banner for failed Supabase writes. Never a browser alert() — tap to
// retry the failed write; auto-dismisses once the retry succeeds.
export default function SyncErrorBanner({ onRetry }) {
  return (
    <div
      onClick={onRetry}
      role="button"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 51,
        background: "rgba(255,77,77,0.16)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,77,77,0.45)",
        boxShadow: "0 0 24px rgba(255,77,77,0.25)",
        color: "#ff4d4d",
        fontFamily: `'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace`,
        fontSize: 11,
        letterSpacing: "0.05em",
        textAlign: "center",
        padding: "8px 12px",
        minHeight: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      Sync error — tap to retry
    </div>
  );
}
