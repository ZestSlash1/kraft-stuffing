// Subtle top-of-screen banner shown while the device is offline. Pending writes
// are queued locally and flushed automatically on reconnect (see lib/db.js).
export default function OfflineBanner({ pending = 0 }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: "#3a2008",
        color: "#e8930a",
        fontFamily: `'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace`,
        fontSize: 11,
        letterSpacing: "0.05em",
        textAlign: "center",
        padding: "5px 12px",
        borderBottom: "1px solid #102030",
      }}
    >
      ● Offline — changes saved locally
      {pending > 0 ? ` (${pending} pending)` : ""}
    </div>
  );
}
