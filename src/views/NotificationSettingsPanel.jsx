// Notification settings + deliveries visibility (§B.3, §B.5). Lives in SettingsView.
// - Designated sender: which connected mail account sends notifications
//   (org_settings 'notify_sender_account_id').
// - Team recipients per event type (org_settings 'notify_team_recipients' JSON).
// - Recent deliveries: what was sent, to whom, when, and failures with reasons.
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { saveOrgSettings } from "../lib/db";
import { mailApi } from "../lib/mailApi";
import { theme } from "../theme";
import { useToast } from "../components/Toast";
import { formatIST } from "../data/statusHelpers";

const EVENT_TYPES = [
  ["document_issued", "Document issued"],
  ["container_sealed", "Container sealed"],
  ["voyage_departed", "Vessel departed"],
  ["voyage_arrived", "Vessel arrived"],
];

const input = {
  width: "100%",
  boxSizing: "border-box",
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 12,
  color: theme.color.ink,
  padding: "10px 12px",
  fontFamily: theme.font.mono,
  fontSize: 13,
  outline: "none",
};

const STATUS_COLOR = { sent: theme.color.green, failed: theme.color.red, pending: theme.color.slate };

const parseEmails = (s) =>
  (s || "")
    .split(/[,\n]/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));

export default function NotificationSettingsPanel({ app }) {
  const { orgSettings, setOrgSettings } = app;
  const { showToast } = useToast();

  const [accounts, setAccounts] = useState([]);
  const [senderId, setSenderId] = useState(orgSettings?.notify_sender_account_id || "");
  // Per-event editable text (comma/newline separated), seeded from the JSON map.
  const [teamText, setTeamText] = useState(() => {
    const map = (() => {
      try {
        return JSON.parse(orgSettings?.notify_team_recipients || "{}") || {};
      } catch {
        return {};
      }
    })();
    return Object.fromEntries(EVENT_TYPES.map(([k]) => [k, (map[k] || []).join(", ")]));
  });
  const [deliveries, setDeliveries] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    mailApi
      .listAccounts()
      .then((r) => setAccounts(r?.accounts || []))
      .catch(() => setAccounts([]));
    loadDeliveries();
  }, []);

  const loadDeliveries = () => {
    supabase
      .from("notification_deliveries")
      .select("id, recipient, status, error, sent_at, created_at, notification_events(event_type)")
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setDeliveries(data || []));
  };

  const save = async () => {
    const map = Object.fromEntries(EVENT_TYPES.map(([k]) => [k, parseEmails(teamText[k])]));
    const entries = {
      notify_sender_account_id: senderId || "",
      notify_team_recipients: JSON.stringify(map),
    };
    const { error } = await saveOrgSettings(entries);
    setOrgSettings((cur) => ({ ...cur, ...entries }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    showToast(error ? "Saved locally (offline)" : "Notification settings saved", error ? "info" : "success");
  };

  return (
    <div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, marginBottom: 14, lineHeight: 1.6 }}>
        Notifications send via one connected mail account. Team recipients get every selected
        event; customers are opted in per booking (default off).
      </div>

      <label className="label-xs" style={{ display: "block", marginBottom: 4 }}>Sending account</label>
      <select style={{ ...input, marginBottom: 16 }} value={senderId} onChange={(e) => setSenderId(e.target.value)}>
        <option value="">— none (notifications paused) —</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.display_name || a.email_address} ({a.email_address})
          </option>
        ))}
      </select>

      {EVENT_TYPES.map(([key, lbl]) => (
        <div key={key} style={{ marginBottom: 12 }}>
          <label className="label-xs" style={{ display: "block", marginBottom: 4 }}>{lbl} — team emails</label>
          <input
            style={input}
            placeholder="ops@kraft.com, manager@kraft.com"
            value={teamText[key]}
            onChange={(e) => setTeamText((t) => ({ ...t, [key]: e.target.value }))}
          />
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <button
          onClick={save}
          style={{ background: theme.color.amber, border: "none", color: theme.color.surface, fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 13, textTransform: "uppercase", padding: "9px 18px", cursor: "pointer" }}
        >
          Save Settings
        </button>
        {saved && <span style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.green }}>Saved ✓</span>}
      </div>

      {/* Deliveries visibility (§B.5) */}
      <div style={{ marginTop: 24 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span className="label-xs">RECENT DELIVERIES</span>
          <button
            onClick={loadDeliveries}
            style={{ background: "none", border: `1px solid ${theme.color.border}`, color: theme.color.slate, fontFamily: theme.font.mono, fontSize: 11, padding: "4px 10px", cursor: "pointer" }}
          >
            Refresh
          </button>
        </div>
        {deliveries.length === 0 ? (
          <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, padding: "10px 0" }}>
            No notifications sent yet.
          </div>
        ) : (
          <div style={{ border: `1px solid ${theme.color.border}`, borderRadius: 8, overflow: "hidden" }}>
            {deliveries.map((d) => (
              <div
                key={d.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "9px 12px",
                  borderBottom: `1px solid ${theme.color.border}`,
                }}
              >
                <span
                  style={{
                    fontFamily: theme.font.mono,
                    fontSize: 9,
                    letterSpacing: "0.08em",
                    color: STATUS_COLOR[d.status] || theme.color.slate,
                    border: `1px solid ${STATUS_COLOR[d.status] || theme.color.slate}`,
                    borderRadius: 4,
                    padding: "2px 6px",
                    textTransform: "uppercase",
                  }}
                >
                  {d.status}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {d.recipient}
                  </div>
                  <div style={{ fontFamily: theme.font.mono, fontSize: 10, color: theme.color.slate }}>
                    {(d.notification_events?.event_type || "").replace(/_/g, " ")}
                    {d.error ? ` · ${d.error}` : ""}
                  </div>
                </div>
                <span style={{ fontFamily: theme.font.mono, fontSize: 10, color: theme.color.slate, whiteSpace: "nowrap" }}>
                  {formatIST(d.sent_at || d.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
