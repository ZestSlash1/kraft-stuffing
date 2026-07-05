import { useEffect, useMemo, useState } from "react";
import { RefreshCw, CornerUpLeft, AlertTriangle } from "lucide-react";
import { theme } from "../../theme";
import { mailApi } from "../../lib/mailApi";
import { useIsMobile } from "../../hooks/useIsMobile";
import { formatRelative, formatAbsolute } from "../../lib/format";
import { useRouter } from "../../context/RouterContext";
import { globalSearch, ROUTE_FOR } from "../../lib/search";

// Entity refs detected in mail text: container numbers (ABCD1234567) and
// document numbers from next_doc_number() ("KRAFT/HBL/2026/0001").
const REF_RE = /\b[A-Z]{4}\d{7}\b|\bKRAFT\/(?:HBL|AN|DO)\/\d{4}\/\d{4}\b/g;

// Highlight refs inside PLAIN text only (React-escaped) — never raw HTML.
// Click runs global_search for the ref and jumps to the first hit.
function RefText({ text, onRef, style }) {
  if (!text) return null;
  const parts = String(text).split(REF_RE);
  const refs = String(text).match(REF_RE) || [];
  if (refs.length === 0) return <span style={style}>{text}</span>;
  const out = [];
  parts.forEach((p, i) => {
    out.push(<span key={`t${i}`}>{p}</span>);
    if (refs[i] !== undefined)
      out.push(
        <span
          key={`r${i}`}
          onClick={(e) => {
            e.stopPropagation();
            onRef(refs[i]);
          }}
          style={{
            fontFamily: theme.font.mono,
            color: theme.color.ink,
            textDecoration: "underline",
            textDecorationColor: theme.color.amber,
            textDecorationThickness: 2,
            cursor: "pointer",
          }}
        >
          {refs[i]}
        </span>
      );
  });
  return <span style={style}>{out}</span>;
}

// Short label for a per-account sync error code.
const ERR_LABEL = { auth_failed: "sign-in failed", timeout: "timed out", sync_failed: "couldn't sync" };

export default function InboxView({ folder = "INBOX", accountId = null, accounts = [], onReply, onFixAccount }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({}); // per-account (all-inboxes mode)
  const [respAccounts, setRespAccounts] = useState(null); // account meta from an 'all' response
  const [selected, setSelected] = useState(null); // parsed thread
  const [loadingBody, setLoadingBody] = useState(false);
  const isMobile = useIsMobile();
  const { navigate } = useRouter();

  const isAll = accountId === "all";
  // id → { color, display_name, email_address }. Prefer the response's meta (fresh),
  // fall back to the accounts prop so single rows resolve too.
  const accountMap = useMemo(() => {
    const map = {};
    (accounts || []).forEach((a) => { map[a.id] = a; });
    (respAccounts || []).forEach((a) => { map[a.id] = { ...map[a.id], ...a }; });
    return map;
  }, [accounts, respAccounts]);

  // Ref click → global_search → first hit's route.
  const openRef = async (ref) => {
    const { rows } = await globalSearch(ref, { voyages: [], shippers: [], consignees: [], expenses: [] });
    const hit = rows?.[0];
    if (!hit) return;
    const target = ROUTE_FOR[hit.type] || { page: "dashboard" };
    navigate(target.page, target.param ? { [target.param]: hit.id } : {});
  };

  // `background` reloads skip the loading spinner so polling doesn't flicker the list.
  const load = (background = false) => {
    if (!background) setLoading(true);
    setError("");
    return mailApi
      .list(folder, accountId)
      .then((r) => {
        setMessages(r.messages || []);
        setErrors(r.errors || {});
        if (r.accounts) setRespAccounts(r.accounts);
      })
      .catch((e) => !background && setError(e.message))
      .finally(() => !background && setLoading(false));
  };

  useEffect(() => {
    setSelected(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, accountId]);

  // Near-real-time: poll every 30s while mounted, and refresh whenever the tab
  // regains focus. (True push needs a long-lived IMAP IDLE connection, which the
  // serverless API can't hold — polling is the pragmatic equivalent.)
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && load(true);
    const interval = setInterval(tick, 30000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, accountId]);

  // A thread is always single-account: use the message's own accountId in merged
  // mode, else the current selection (null resolves to the default server-side).
  const open = (m) => {
    setLoadingBody(true);
    const threadAccountId = m.accountId || (isAll ? null : accountId);
    mailApi
      .thread(m.uid, folder, threadAccountId)
      .then((msg) => {
        setSelected(msg);
        setMessages((prev) =>
          prev.map((x) => (x.uid === m.uid && x.accountId === m.accountId ? { ...x, seen: true } : x))
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingBody(false));
  };

  // On mobile the two panes become a master-detail: the list fills the screen,
  // and opening a message swaps to a full-width reading pane with a back button.
  const showList = !isMobile || !selected;
  const showPane = !isMobile || !!selected || loadingBody;

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* Message list */}
      <div
        style={{
          width: isMobile ? "100%" : 340,
          flexShrink: 0,
          borderRight: isMobile ? "none" : `1px solid ${theme.color.border}`,
          overflowY: "auto",
          display: showList ? "block" : "none",
        }}
      >
        <Header title={folder === "Sent" ? "Sent" : "Inbox"} onRefresh={load} />
        {loading && <Note>Loading messages…</Note>}
        {error && <Note tone="red">{error}</Note>}

        {/* Per-account sync failures in merged mode — a slim strip, never a blank screen. */}
        {isAll &&
          Object.entries(errors).map(([id, code]) => {
            const acc = accountMap[id];
            const name = acc?.email_address || acc?.display_name || "an account";
            return (
              <button
                key={`err-${id}`}
                onClick={() => onFixAccount?.()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  textAlign: "left",
                  background: theme.color.redSoft,
                  border: "none",
                  borderBottom: `1px solid ${theme.color.border}`,
                  padding: "9px 14px",
                  cursor: "pointer",
                }}
              >
                <AlertTriangle size={13} color={theme.color.red} style={{ flexShrink: 0 }} />
                <span style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.inkSoft }}>
                  {name} {ERR_LABEL[code] || "couldn't sync"} — check settings
                </span>
              </button>
            );
          })}

        {!loading && !error && messages.length === 0 && <Note>No messages.</Note>}
        {messages.map((m) => {
          const active = selected?.uid === m.uid && selected?.accountId === m.accountId;
          const acc = isAll ? accountMap[m.accountId] : null;
          const accent = acc?.color || theme.color.amber;
          return (
            <button
              key={`${m.accountId || "one"}-${m.uid}`}
              onClick={() => open(m)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: active ? theme.color.amberSoft : theme.color.surface,
                border: "none",
                borderBottom: `1px solid ${theme.color.border}`,
                borderLeft: isAll ? `2px solid ${accent}` : "2px solid transparent",
                padding: "12px 14px",
                cursor: "pointer",
              }}
            >
              {isAll && acc && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                  <span style={{ fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.04em", color: theme.color.slate, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {acc.display_name || acc.email_address}
                  </span>
                </div>
              )}
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
                {!m.seen && <span style={{ width: 7, height: 7, borderRadius: "50%", background: theme.color.amber, flexShrink: 0, alignSelf: "center" }} />}
                <span
                  style={{
                    fontFamily: theme.font.mono,
                    fontSize: 12,
                    fontWeight: 700,
                    color: theme.color.ink,
                    flexShrink: 0,
                    maxWidth: 130,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.from?.name || m.from?.address || "Unknown"}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontFamily: theme.font.body,
                    fontSize: 13,
                    fontWeight: m.seen ? 400 : 600,
                    color: theme.color.inkSoft,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  <RefText text={m.subject} onRef={openRef} />
                </span>
                <span style={{ fontFamily: theme.font.mono, fontSize: 10, color: theme.color.slateFaint, flexShrink: 0 }}>
                  {formatRelative(m.date)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Reading pane */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: isMobile ? 16 : 24, display: showPane ? "block" : "none" }}>
        {isMobile && selected && (
          <button
            onClick={() => setSelected(null)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "none",
              border: "none",
              color: theme.color.slate,
              fontFamily: theme.font.mono,
              fontSize: 12,
              cursor: "pointer",
              padding: "4px 0",
              marginBottom: 8,
            }}
          >
            <CornerUpLeft size={14} /> Back
          </button>
        )}
        {loadingBody && <Note>Opening…</Note>}
        {!loadingBody && !selected && <Note>Select a message to read.</Note>}
        {!loadingBody && selected && (
          <div>
            <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 24, color: theme.color.ink }}>
              <RefText text={selected.subject} onRef={openRef} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", margin: "10px 0 18px" }}>
              <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, minWidth: 0, overflowWrap: "break-word", wordBreak: "break-word" }}>
                {selected.from?.name ? `${selected.from.name} · ` : ""}
                {selected.from?.address} — {formatAbsolute(selected.date)}
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
                : { children: <RefText text={selected.text} onRef={openRef} /> })}
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
