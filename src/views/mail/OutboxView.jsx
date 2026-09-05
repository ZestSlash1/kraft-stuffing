import { useCallback, useEffect, useState } from "react";
import { Clock, X, RefreshCw } from "lucide-react";
import { C, F, SP, R, glass } from "../../ui/theme";
import { mailApi } from "../../lib/mailApi";
import { useToast } from "../../components/Toast";

const STATUS_TONE = {
  pending: { label: "Pending", color: C.warning },
  sent: { label: "Sent", color: C.optimized },
  failed: { label: "Failed", color: C.critical },
  canceled: { label: "Canceled", color: C.inkFaint },
};

const fmtSendAt = (iso) => {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso || "";
  }
};

// Outbox: pending + recent scheduled sends (see compose's "Schedule send"). There's no
// SMTP send queue to browse otherwise — a normal Send is synchronous and never rests
// in an intermediate state, so this view's only content is the scheduled-send table.
export default function OutboxView({ accountId, accounts = [] }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const { showToast } = useToast();

  const load = useCallback(() => {
    setError("");
    const targets = accountId === "all" ? accounts.map((a) => a.id) : [accountId].filter(Boolean);
    if (!targets.length) { setRows([]); return; }
    Promise.all(
      targets.map((id) =>
        mailApi.scheduledSends(id).then((r) => (r.scheduled || []).map((s) => ({ ...s, accountId: id })))
      )
    )
      .then((lists) => setRows(lists.flat().sort((a, b) => new Date(a.send_at) - new Date(b.send_at))))
      .catch((e) => setError(e.message || "Could not load Outbox"));
  }, [accountId, accounts]);

  useEffect(() => { setRows(null); load(); }, [load]);

  const cancel = (id) => {
    setRows((r) => r.map((row) => (row.id === id ? { ...row, status: "canceled" } : row)));
    mailApi.cancelScheduledSend(id)
      .then(() => showToast("Scheduled send canceled", "success"))
      .catch((e) => { showToast(e.message || "Could not cancel", "error"); load(); });
  };

  const accountLabel = (id) => {
    const a = accounts.find((x) => x.id === id);
    return a?.display_name || a?.email_address || "";
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: `${SP.xl}px ${SP.xxl}px`, fontFamily: F.mono }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SP.lg }}>
        <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 22, color: C.ink, letterSpacing: "0.02em", textTransform: "uppercase" }}>
          Outbox
        </div>
        <button onClick={load} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 4, display: "flex" }} title="Refresh">
          <RefreshCw size={15} />
        </button>
      </div>

      {rows === null && !error && (
        <div style={{ color: C.inkFaint, fontSize: 13, padding: `${SP.lg}px 0` }}>Loading…</div>
      )}
      {error && <div style={{ color: C.critical, fontSize: 13, padding: `${SP.lg}px 0` }}>{error}</div>}
      {rows && !error && rows.length === 0 && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md, padding: `${SP.xxl}px 0`, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(59,163,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Clock size={22} color={C.minor} strokeWidth={1.5} />
          </div>
          <div style={{ color: C.inkFaint, fontSize: 14 }}>
            Nothing scheduled. Use "Schedule send" in Compose to queue a message for later.
          </div>
        </div>
      )}

      {rows && rows.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: SP.sm }}>
          {rows.map((row) => {
            const tone = STATUS_TONE[row.status] || STATUS_TONE.pending;
            return (
              <div key={row.id} style={{ ...glass(R.card), padding: `${SP.md}px ${SP.lg}px`, display: "flex", alignItems: "flex-start", gap: SP.md }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: SP.sm, marginBottom: 3 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: tone.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: tone.color, fontWeight: 600 }}>{tone.label}</span>
                    {accountId === "all" && (
                      <span style={{ fontSize: 10, color: C.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        · {accountLabel(row.accountId)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.subject || "(no subject)"}
                  </div>
                  <div style={{ fontSize: 12, color: C.inkDim, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    To: {(row.to_addresses || []).join(", ")}
                  </div>
                  {row.status === "failed" && row.error && (
                    <div style={{ fontSize: 11, color: C.critical, marginTop: 4 }}>{row.error}</div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: SP.xs, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: C.inkFaint, whiteSpace: "nowrap" }}>{fmtSendAt(row.send_at)}</span>
                  {row.status === "pending" && (
                    <button onClick={() => cancel(row.id)} title="Cancel"
                      style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${C.border}`, borderRadius: R.pill, padding: `2px ${SP.sm}px`, color: C.inkDim, fontSize: 11, cursor: "pointer" }}>
                      <X size={11} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
