import { useEffect, useRef, useState } from "react";
import { theme } from "../theme";
import { pendingCount, onSyncChange } from "../lib/db";

// Shared state hook: pending queue length, online flag, and a brief "synced"
// flash (~2s) after a successful flush. Driven by onSyncChange from lib/db.js.
export function useSyncState() {
  const [pending, setPending] = useState(pendingCount());
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [justFlushed, setJustFlushed] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    const off = onSyncChange(({ pending: p, flushed }) => {
      setPending(p);
      if (flushed > 0 && p === 0) {
        setJustFlushed(true);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setJustFlushed(false), 2000);
      }
    });
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      off();
      clearTimeout(timer.current);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return { pending, online, justFlushed };
}

// Sync status pill for the top nav. Hidden when idle + online.
export default function SyncPill() {
  const { pending, online, justFlushed } = useSyncState();

  let tone = null;
  if (!online) tone = { bg: theme.color.surfaceMuted, border: theme.color.border, fg: theme.color.slate, dot: theme.color.slateFaint, label: "OFFLINE" };
  else if (pending > 0) tone = { bg: theme.color.amberSoft, border: theme.color.amber, fg: theme.color.amberText, dot: theme.color.amber, label: `${pending} PENDING` };
  else if (justFlushed) tone = { bg: theme.color.greenSoft, border: "#bfe0d3", fg: theme.color.green, dot: theme.color.green, label: "SYNCED ✓" };
  if (!tone) return null;

  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        borderRadius: theme.radius.pill,
        padding: "5px 10px",
        flexShrink: 0,
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: tone.dot }} />
      <span style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.1em", color: tone.fg }}>
        {tone.label}
      </span>
    </span>
  );
}

// Compact mirror for the mobile bottom nav: dot + count only.
export function SyncDot() {
  const { pending, online, justFlushed } = useSyncState();
  let color = null;
  if (!online) color = theme.color.slateFaint;
  else if (pending > 0) color = theme.color.amber;
  else if (justFlushed) color = theme.color.green;
  if (!color) return null;

  return (
    <span
      style={{
        position: "absolute",
        top: 6,
        right: 8,
        display: "flex",
        alignItems: "center",
        gap: 3,
        pointerEvents: "none",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
      {pending > 0 && (
        <span style={{ fontFamily: theme.font.mono, fontSize: 9, color: theme.color.amberText }}>
          {pending}
        </span>
      )}
    </span>
  );
}
