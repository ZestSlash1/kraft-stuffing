import { useEffect, useState } from "react";
import { RefreshCw, CornerUpLeft } from "lucide-react";
import { theme } from "../../theme";
import { mailApi } from "../../lib/mailApi";

const IST = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })
    : "";

export default function InboxView({ folder = "INBOX", onReply }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null); // parsed thread
  const [loadingBody, setLoadingBody] = useState(false);

  const load = () => {
    setLoading(true);
    setError("");
    mailApi
      .list(folder)
      .then((r) => setMessages(r.messages || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setSelected(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder]);

  const open = (uid) => {
    setLoadingBody(true);
    mailApi
      .thread(uid, folder)
      .then((msg) => {
        setSelected(msg);
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingBody(false));
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Message list */}
      <div style={{ width: 340, flexShrink: 0, borderRight: `1px solid ${theme.color.border}`, overflowY: "auto" }}>
        <Header title={folder === "Sent" ? "Sent" : "Inbox"} onRefresh={load} />
        {loading && <Note>Loading messages…</Note>}
        {error && <Note tone="red">{error}</Note>}
        {!loading && !error && messages.length === 0 && <Note>No messages.</Note>}
        {messages.map((m) => {
          const active = selected?.uid === m.uid;
          return (
            <button
              key={m.uid}
              onClick={() => open(m.uid)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: active ? theme.color.amberSoft : theme.color.surface,
                border: "none",
                borderBottom: `1px solid ${theme.color.border}`,
                padding: "12px 14px",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span
                  style={{
                    fontFamily: theme.font.mono,
                    fontSize: 12,
                    fontWeight: m.seen ? 400 : 600,
                    color: theme.color.ink,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.from?.name || m.from?.address || "Unknown"}
                </span>
                {!m.seen && <span style={{ width: 7, height: 7, borderRadius: "50%", background: theme.color.amber, flexShrink: 0, marginTop: 4 }} />}
              </div>
              <div
                style={{
                  fontFamily: theme.font.body,
                  fontSize: 13,
                  fontWeight: m.seen ? 400 : 600,
                  color: theme.color.inkSoft,
                  marginTop: 2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {m.subject}
              </div>
              <div style={{ fontFamily: theme.font.mono, fontSize: 10, color: theme.color.slateFaint, marginTop: 4 }}>
                {IST(m.date)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Reading pane */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: 24 }}>
        {loadingBody && <Note>Opening…</Note>}
        {!loadingBody && !selected && <Note>Select a message to read.</Note>}
        {!loadingBody && selected && (
          <div>
            <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 24, color: theme.color.ink }}>
              {selected.subject}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "10px 0 18px" }}>
              <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>
                {selected.from?.name ? `${selected.from.name} · ` : ""}
                {selected.from?.address} — {IST(selected.date)}
              </div>
              <button
                onClick={() => onReply?.(selected)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: theme.color.surface,
                  border: `1px solid ${theme.color.borderStrong}`,
                  borderRadius: theme.radius.pill,
                  color: theme.color.inkSoft,
                  fontFamily: theme.font.condensed,
                  fontWeight: 700,
                  fontSize: 13,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "7px 14px",
                  cursor: "pointer",
                }}
              >
                <CornerUpLeft size={14} /> Reply
              </button>
            </div>
            <div
              style={{
                fontFamily: theme.font.body,
                fontSize: 14,
                color: theme.color.ink,
                lineHeight: 1.6,
                whiteSpace: selected.html ? "normal" : "pre-wrap",
                wordBreak: "break-word",
              }}
              {...(selected.html
                ? { dangerouslySetInnerHTML: { __html: selected.html } }
                : { children: selected.text })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Header({ title, onRefresh }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 14px",
        borderBottom: `1px solid ${theme.color.border}`,
        position: "sticky",
        top: 0,
        background: theme.color.surface,
      }}
    >
      <span
        style={{
          fontFamily: theme.font.condensed,
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: theme.color.ink,
        }}
      >
        {title}
      </span>
      <button onClick={onRefresh} style={{ background: "none", border: "none", cursor: "pointer", color: theme.color.slate, padding: 4 }}>
        <RefreshCw size={15} />
      </button>
    </div>
  );
}

function Note({ children, tone }) {
  return (
    <div
      style={{
        padding: 20,
        fontFamily: theme.font.mono,
        fontSize: 12,
        color: tone === "red" ? theme.color.red : theme.color.slate,
      }}
    >
      {children}
    </div>
  );
}
