import { useEffect, useMemo, useState } from "react";
import { RefreshCw, CornerUpLeft, AlertTriangle, Paperclip, Search, X } from "lucide-react";
import { MC, MF, MSP, MR, mailCard, tagChip, MAIL_ACTIONS } from "../../ui/mailTheme";
import { mailApi } from "../../lib/mailApi";
import { useIsMobile } from "../../hooks/useIsMobile";
import { formatRelative, formatAbsolute } from "../../lib/format";
import { useRouter } from "../../context/RouterContext";
import { globalSearch, ROUTE_FOR } from "../../lib/search";
import DocViewer from "../../components/DocViewer";

// Entity refs detected in mail text: container numbers and KRAFT document numbers.
const REF_RE = /\b[A-Z]{4}\d{7}\b|\bKRAFT\/(?:HBL|AN|DO)\/\d{4}\/\d{4}\b/g;

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
          onClick={(e) => { e.stopPropagation(); onRef(refs[i]); }}
          style={{
            fontFamily: MF.mono,
            color: MC.blue,
            textDecoration: "underline",
            textDecorationColor: MC.blue,
            textDecorationThickness: 1,
            cursor: "pointer",
          }}
        >
          {refs[i]}
        </span>
      );
  });
  return <span style={style}>{out}</span>;
}

const ERR_LABEL = { auth_failed: "sign-in failed", timeout: "timed out", sync_failed: "couldn't sync" };

export default function InboxView({ folder = "INBOX", accountId = null, accounts = [], onReply, onFixAccount }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState({});
  const [respAccounts, setRespAccounts] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loadingBody, setLoadingBody] = useState(false);
  const [filter, setFilter] = useState("all"); // 'all' | 'unread'
  const [search, setSearch] = useState("");
  const [viewerDoc, setViewerDoc] = useState(null);
  const isMobile = useIsMobile();
  const { navigate } = useRouter();

  const isAll = accountId === "all";
  const accountMap = useMemo(() => {
    const map = {};
    (accounts || []).forEach((a) => { map[a.id] = a; });
    (respAccounts || []).forEach((a) => { map[a.id] = { ...map[a.id], ...a }; });
    return map;
  }, [accounts, respAccounts]);

  const openRef = async (ref) => {
    const { rows } = await globalSearch(ref, { voyages: [], shippers: [], consignees: [], expenses: [] });
    const hit = rows?.[0];
    if (!hit) return;
    const target = ROUTE_FOR[hit.type] || { page: "dashboard" };
    navigate(target.page, target.param ? { [target.param]: hit.id } : {});
  };

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

  const filteredMessages = useMemo(() => {
    let list = messages;
    if (filter === "unread") list = list.filter((m) => !m.seen);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) =>
        (m.subject || "").toLowerCase().includes(q) ||
        (m.from?.name || "").toLowerCase().includes(q) ||
        (m.from?.address || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [messages, filter, search]);

  const showList = !isMobile || !selected;
  const showPane = !isMobile || !!selected || loadingBody;

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: MF.body }}>
      {/* Message list */}
      <div
        style={{
          width: isMobile ? "100%" : 340,
          flexShrink: 0,
          borderRight: isMobile ? "none" : `1px solid ${MC.border}`,
          overflowY: "auto",
          display: showList ? "flex" : "none",
          flexDirection: "column",
          background: MC.canvas,
        }}
      >
        {/* List header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: MSP.sm,
            padding: `${MSP.md}px ${MSP.lg}px ${MSP.sm}px`,
            background: MC.surface,
            borderBottom: `1px solid ${MC.border}`,
            position: "sticky",
            top: 0,
            zIndex: 2,
          }}
        >
          {/* Title + refresh */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: MF.body, fontWeight: 700, fontSize: 17, color: MC.ink }}>
              {folder === "Sent" ? "Sent" : "Inbox"}
            </span>
            <button onClick={() => load()} style={{ background: "none", border: "none", cursor: "pointer", color: MC.inkFaint, padding: 4 }}>
              <RefreshCw size={15} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={14} color={MC.inkFaint} style={{ position: "absolute", left: MSP.md, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: MC.canvasAlt,
                border: `1px solid ${MC.border}`,
                borderRadius: MR.pill,
                padding: `${MSP.sm}px ${MSP.xl}px ${MSP.sm}px 34px`,
                fontFamily: MF.body,
                fontSize: 13,
                color: MC.ink,
                outline: "none",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={{ position: "absolute", right: MSP.sm, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: MC.inkFaint, padding: 2 }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* All / Unread tabs */}
          <div style={{ display: "flex", gap: MSP.sm }}>
            {["all", "unread"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  background: filter === f ? MC.blue : "none",
                  border: filter === f ? "none" : `1px solid ${MC.border}`,
                  borderRadius: MR.pill,
                  padding: `3px ${MSP.md}px`,
                  fontFamily: MF.body,
                  fontWeight: filter === f ? 600 : 500,
                  fontSize: 12,
                  color: filter === f ? "#fff" : MC.inkDim,
                  cursor: "pointer",
                  textTransform: "capitalize",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {loading && <Note>Loading messages…</Note>}
        {error && <Note tone="danger">{error}</Note>}

        {/* Per-account sync errors in merged mode */}
        {isAll && Object.entries(errors).map(([id, code]) => {
          const acc = accountMap[id];
          const name = acc?.email_address || acc?.display_name || "an account";
          return (
            <button
              key={`err-${id}`}
              onClick={() => onFixAccount?.()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: MSP.sm,
                width: "100%",
                textAlign: "left",
                background: "#fff5f5",
                border: "none",
                borderBottom: `1px solid ${MC.border}`,
                padding: `${MSP.sm}px ${MSP.lg}px`,
                cursor: "pointer",
              }}
            >
              <AlertTriangle size={13} color={MC.danger} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: MF.body, fontSize: 12, color: MC.inkDim }}>
                {name} {ERR_LABEL[code] || "couldn't sync"} — check settings
              </span>
            </button>
          );
        })}

        {!loading && !error && filteredMessages.length === 0 && (
          <Note>{messages.length === 0 ? "No messages." : "No messages match."}</Note>
        )}

        {/* Message rows */}
        <div style={{ flex: 1 }}>
          {filteredMessages.map((m) => {
            const active = selected?.uid === m.uid && selected?.accountId === m.accountId;
            const acc = isAll ? accountMap[m.accountId] : null;
            const accent = acc?.color || MC.blue;
            const hasAttachments = m.attachments?.length > 0;
            return (
              <button
                key={`${m.accountId || "one"}-${m.uid}`}
                onClick={() => open(m)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: active ? MC.blueSoft : MC.surface,
                  border: "none",
                  borderBottom: `1px solid ${MC.hair}`,
                  borderLeft: `3px solid ${active ? MC.blue : (isAll ? accent : "transparent")}`,
                  padding: `${MSP.md}px ${MSP.lg}px`,
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
              >
                {/* Account label in merged mode */}
                {isAll && acc && (
                  <div style={{ display: "flex", alignItems: "center", gap: MSP.xs, marginBottom: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                    <span style={{ fontFamily: MF.mono, fontSize: 10, color: MC.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {acc.display_name || acc.email_address}
                    </span>
                  </div>
                )}

                {/* Sender + timestamp row */}
                <div style={{ display: "flex", alignItems: "center", gap: MSP.sm, marginBottom: 3 }}>
                  {!m.seen && (
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: MC.blue, flexShrink: 0 }} />
                  )}
                  <span
                    style={{
                      flex: 1,
                      fontFamily: MF.body,
                      fontSize: 14,
                      fontWeight: m.seen ? 500 : 700,
                      color: MC.ink,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      minWidth: 0,
                    }}
                  >
                    {m.from?.name || m.from?.address || "Unknown"}
                  </span>
                  <span style={{ fontFamily: MF.mono, fontSize: 11, color: MC.inkFaint, flexShrink: 0 }}>
                    {formatRelative(m.date)}
                  </span>
                </div>

                {/* Subject */}
                <div
                  style={{
                    fontFamily: MF.body,
                    fontSize: 13,
                    fontWeight: m.seen ? 400 : 600,
                    color: m.seen ? MC.inkDim : MC.ink,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    marginBottom: hasAttachments ? 4 : 0,
                  }}
                >
                  <RefText text={m.subject} onRef={openRef} />
                </div>

                {/* Attachment indicator */}
                {hasAttachments && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Paperclip size={11} color={MC.inkFaint} />
                    <span style={{ fontFamily: MF.mono, fontSize: 10, color: MC.inkFaint }}>
                      {m.attachments.length} attachment{m.attachments.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Reading pane */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          background: MC.canvas,
          display: showPane ? "block" : "none",
        }}
      >
        {isMobile && selected && (
          <div style={{ padding: `${MSP.md}px ${MSP.lg}px 0`, position: "sticky", top: 0, background: MC.canvas, zIndex: 2 }}>
            <button
              onClick={() => setSelected(null)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: MSP.sm,
                background: "none",
                border: "none",
                color: MC.blue,
                fontFamily: MF.body,
                fontWeight: 500,
                fontSize: 14,
                cursor: "pointer",
                padding: "4px 0",
              }}
            >
              <CornerUpLeft size={16} /> Back
            </button>
          </div>
        )}

        {loadingBody && <Note>Opening…</Note>}
        {!loadingBody && !selected && !isMobile && (
          <div
            style={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              gap: MSP.md,
            }}
          >
            <div style={{ fontFamily: MF.body, fontSize: 14, color: MC.inkFaint }}>Select a message to read</div>
          </div>
        )}
        {!loadingBody && selected && (
          <ThreadView
            message={selected}
            onReply={onReply}
            openRef={openRef}
            onViewAttachment={setViewerDoc}
          />
        )}
      </div>

      {/* DocViewer for mail attachments */}
      <DocViewer open={!!viewerDoc} doc={viewerDoc} onClose={() => setViewerDoc(null)} />
    </div>
  );
}

// ─── Thread / reading pane ────────────────────────────────────────────────────

function ThreadView({ message, onReply, openRef, onViewAttachment }) {
  const isMobile = useIsMobile();

  // Build action list from MAIL_ACTIONS (single source of truth).
  const actions = MAIL_ACTIONS.map((a) => ({
    ...a,
    handler: a.key === "reply" ? () => onReply?.(message) : null,
  })).filter((a) => a.handler);

  return (
    <div style={{ padding: isMobile ? `${MSP.md}px ${MSP.lg}px` : `${MSP.xl}px ${MSP.xxl}px` }}>
      {/* Subject */}
      <h1
        style={{
          fontFamily: MF.body,
          fontWeight: 700,
          fontSize: isMobile ? 20 : 24,
          color: MC.ink,
          margin: `0 0 ${MSP.lg}px`,
          lineHeight: 1.25,
          letterSpacing: "-0.01em",
        }}
      >
        <RefText text={message.subject} onRef={openRef} />
      </h1>

      {/* Meta row */}
      <div
        style={{
          ...mailCard(MR.card),
          padding: `${MSP.md}px ${MSP.lg}px`,
          marginBottom: MSP.lg,
          display: "flex",
          flexDirection: "column",
          gap: MSP.sm,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: MSP.md }}>
          <div>
            <div style={{ fontFamily: MF.body, fontWeight: 600, fontSize: 14, color: MC.ink }}>
              {message.from?.name || message.from?.address || "Unknown"}
            </div>
            {message.from?.name && (
              <div style={{ fontFamily: MF.mono, fontSize: 11, color: MC.inkFaint }}>{message.from.address}</div>
            )}
            {message.to?.length > 0 && (
              <div style={{ fontFamily: MF.body, fontSize: 12, color: MC.inkDim, marginTop: 2 }}>
                To: {message.to.map((t) => t.name || t.address).join(", ")}
              </div>
            )}
            {message.cc?.length > 0 && (
              <div style={{ fontFamily: MF.body, fontSize: 12, color: MC.inkDim }}>
                CC: {message.cc.map((t) => t.name || t.address).join(", ")}
              </div>
            )}
          </div>
          <span style={{ fontFamily: MF.mono, fontSize: 11, color: MC.inkFaint, flexShrink: 0, textAlign: "right" }}>
            {formatAbsolute(message.date)}
          </span>
        </div>
      </div>

      {/* Attachments */}
      {message.attachments?.length > 0 && (
        <AttachmentChips attachments={message.attachments} onView={onViewAttachment} />
      )}

      {/* Body */}
      <div
        style={{
          ...mailCard(MR.card),
          padding: `${MSP.xl}px`,
          marginBottom: MSP.xl,
          fontFamily: MF.body,
          fontSize: 15,
          color: MC.ink,
          lineHeight: 1.65,
          whiteSpace: message.html ? "normal" : "pre-wrap",
          wordBreak: "break-word",
          overflowX: "auto",
        }}
        {...(message.html
          ? { dangerouslySetInnerHTML: { __html: message.html } }
          : { children: <RefText text={message.text} onRef={openRef} /> })}
      />

      {/* Action toolbar — only real actions */}
      <div style={{ display: "flex", gap: MSP.sm, flexWrap: "wrap" }}>
        {actions.map((a) => (
          <ActionButton key={a.key} icon={<CornerUpLeft size={15} />} label={a.label} onClick={a.handler} primary />
        ))}
      </div>
    </div>
  );
}

function AttachmentChips({ attachments, onView }) {
  return (
    <div
      style={{
        ...mailCard(MR.card),
        padding: `${MSP.md}px ${MSP.lg}px`,
        marginBottom: MSP.lg,
        display: "flex",
        flexWrap: "wrap",
        gap: MSP.sm,
        alignItems: "center",
      }}
    >
      <Paperclip size={14} color={MC.inkDim} style={{ flexShrink: 0 }} />
      {attachments.map((att, i) => (
        <button
          key={i}
          onClick={() => {
            if (att.url) onView({ url: att.url, fileName: att.filename || att.name, mimeType: att.contentType || att.mimeType });
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: MSP.xs,
            background: MC.canvasAlt,
            border: `1px solid ${MC.border}`,
            borderRadius: MR.chip,
            padding: `${MSP.xs}px ${MSP.md}px`,
            fontFamily: MF.body,
            fontSize: 12,
            color: MC.ink,
            cursor: att.url ? "pointer" : "default",
            transition: "background 0.12s",
          }}
          title={att.url ? "View attachment" : "Attachment preview unavailable"}
        >
          <Paperclip size={11} color={MC.inkDim} />
          {att.filename || att.name || "attachment"}
        </button>
      ))}
    </div>
  );
}

function ActionButton({ icon, label, onClick, primary }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: MSP.sm,
        background: primary ? MC.blue : MC.surface,
        border: primary ? "none" : `1px solid ${MC.border}`,
        borderRadius: MR.pill,
        padding: `${MSP.sm + 2}px ${MSP.xl}px`,
        fontFamily: MF.body,
        fontWeight: 600,
        fontSize: 14,
        color: primary ? "#fff" : MC.inkDim,
        cursor: "pointer",
        transition: "opacity 0.15s",
        minHeight: 40,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function Note({ children, tone }) {
  return (
    <div
      style={{
        padding: `${MSP.xl}px ${MSP.lg}px`,
        fontFamily: MF.body,
        fontSize: 13,
        color: tone === "danger" ? MC.danger : MC.inkFaint,
      }}
    >
      {children}
    </div>
  );
}
