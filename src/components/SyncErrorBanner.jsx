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
        background: "#ef4444",
        color: "#1a0606",
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
