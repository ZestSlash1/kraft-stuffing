import { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, CornerUpLeft, AlertTriangle, Paperclip, Search, X } from "lucide-react";
import gsap from "gsap";
import { MC, MF, MG, MSP, MR, mailCard, MAIL_ACTIONS } from "../../ui/mailTheme";
import { mailApi } from "../../lib/mailApi";
import { useMailList } from "../../lib/mailCache";
import { useIsMobile } from "../../hooks/useIsMobile";
import { formatRelative, formatAbsolute } from "../../lib/format";
import { useRouter } from "../../context/RouterContext";
import { globalSearch, ROUTE_FOR } from "../../lib/search";
import DocViewer from "../../components/DocViewer";

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
        <span key={`r${i}`}
          onClick={(e) => { e.stopPropagation(); onRef(refs[i]); }}
          style={{ fontFamily: MF.mono, color: MC.blue, textDecoration: "underline", textDecorationColor: MC.blue, textDecorationThickness: 1, cursor: "pointer" }}>
          {refs[i]}
        </span>
      );
  });
  return <span style={style}>{out}</span>;
}

const ERR_LABEL = { auth_failed: "sign-in failed", timeout: "timed out", sync_failed: "couldn't sync" };

export default function InboxView({ folder = "INBOX", accountId = null, accounts = [], onReply, onFixAccount }) {
  // Stale-while-revalidate: cached list paints instantly on account/folder switch,
  // a background refresh updates it silently. `loading` is true only on a cold read.
  const { data, loading, error, refresh, patchMessages } = useMailList(folder, accountId);
  const messages = data?.messages || [];
  const errors = data?.errors || {};
  const respAccounts = data?.accounts || null;
  const [selected, setSelected] = useState(null);
  const [loadingBody, setLoadingBody] = useState(false);
  const [bodyError, setBodyError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewerDoc, setViewerDoc] = useState(null);
  const isMobile = useIsMobile();
  const { navigate } = useRouter();
  const listRef = useRef(null);
  const paneRef = useRef(null);
  const headerRef = useRef(null);

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

  // Clear the open message when switching folder/account (cache handles the list).
  useEffect(() => {
    setSelected(null);
  }, [folder, accountId]);

  // Stagger-animate message rows when list loads
  useEffect(() => {
    if (loading || !listRef.current) return;
    const rows = listRef.current.querySelectorAll(".mail-row");
    if (rows.length === 0) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    gsap.fromTo(rows,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.32, stagger: 0.045, ease: "power2.out", clearProps: "transform,opacity" }
    );
  }, [loading, messages.length]);

  // Animate header on mount
  useEffect(() => {
    if (!headerRef.current) return;
    gsap.fromTo(headerRef.current, { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power2.out" });
  }, []);

  const open = (m) => {
    setLoadingBody(true);
    setBodyError("");
    const threadAccountId = m.accountId || (isAll ? null : accountId);
    mailApi.thread(m.uid, folder, threadAccountId)
      .then((msg) => {
        setSelected(msg);
        patchMessages((prev) => prev.map((x) => (x.uid === m.uid && x.accountId === m.accountId ? { ...x, seen: true } : x)));
        // Animate reading pane in
        if (paneRef.current) {
          const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (!prefersReduced) {
            gsap.fromTo(paneRef.current, { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" });
          }
        }
      })
      .catch((e) => setBodyError(e.message))
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
      {/* Message list panel */}
      <div style={{
        width: isMobile ? "100%" : 340, flexShrink: 0,
        borderRight: isMobile ? "none" : `1px solid ${MC.border}`,
        overflowY: "auto", display: showList ? "flex" : "none",
        flexDirection: "column",
        background: "linear-gradient(180deg, #f5f8ff 0%, #eef3ff 100%)",
      }}>
        {/* List header */}
        <div ref={headerRef} style={{
          display: "flex", flexDirection: "column", gap: MSP.sm,
          padding: `${MSP.md}px ${MSP.lg}px ${MSP.sm}px`,
          background: MG.header,
          borderBottom: `1px solid ${MC.border}`,
          position: "sticky", top: 0, zIndex: 2,
          boxShadow: "0 2px 8px rgba(30,60,180,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: MF.body, fontWeight: 700, fontSize: 17, color: MC.ink }}>
              {folder === "Sent" ? "Sent" : "Inbox"}
            </span>
            <RefreshButton onClick={refresh} />
          </div>

          {/* Search */}
          <div style={{ position: "relative" }}>
            <Search size={14} color={MC.inkFaint} style={{ position: "absolute", left: MSP.md, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
              style={{ width: "100%", boxSizing: "border-box", background: "linear-gradient(135deg,#f8faff,#f0f4ff)", border: `1px solid ${MC.border}`, borderRadius: MR.pill, padding: `${MSP.sm}px ${MSP.xl}px ${MSP.sm}px 34px`, fontFamily: MF.body, fontSize: 13, color: MC.ink, outline: "none" }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: MSP.sm, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: MC.inkFaint, padding: 2 }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* All / Unread filter tabs */}
          <div style={{ display: "flex", gap: MSP.sm }}>
            {["all", "unread"].map((f) => (
              <FilterTab key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
            ))}
          </div>
        </div>

        {loading && <SkeletonList />}
        {error && <Note tone="danger">{error}</Note>}

        {isAll && Object.entries(errors).map(([id, code]) => {
          const acc = accountMap[id];
          const name = acc?.email_address || acc?.display_name || "an account";
          return (
            <button key={`err-${id}`} onClick={() => onFixAccount?.()}
              style={{ display: "flex", alignItems: "center", gap: MSP.sm, width: "100%", textAlign: "left", background: "#fff0f0", border: "none", borderBottom: `1px solid ${MC.border}`, padding: `${MSP.sm}px ${MSP.lg}px`, cursor: "pointer" }}>
              <AlertTriangle size={13} color={MC.danger} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: MF.body, fontSize: 12, color: MC.inkDim }}>{name} {ERR_LABEL[code] || "couldn't sync"} — check settings</span>
            </button>
          );
        })}

        {!loading && !error && filteredMessages.length === 0 && (
          <EmptyState search={search} />
        )}

        <div ref={listRef} style={{ flex: 1 }}>
          {filteredMessages.map((m) => {
            const active = selected?.uid === m.uid && selected?.accountId === m.accountId;
            const acc = isAll ? accountMap[m.accountId] : null;
            const accent = acc?.color || MC.blue;
            const hasAttachments = m.attachments?.length > 0;
            return (
              <MessageRow key={`${m.accountId || "one"}-${m.uid}`}
                message={m} active={active} acc={acc} accent={accent}
                hasAttachments={hasAttachments} isAll={isAll}
                onClick={() => open(m)} openRef={openRef}
              />
            );
          })}
        </div>
      </div>

      {/* Reading pane */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", background: MG.pane, display: showPane ? "block" : "none" }}>
        {isMobile && selected && (
          <div style={{ padding: `${MSP.md}px ${MSP.lg}px 0`, position: "sticky", top: 0, background: MG.pane, zIndex: 2 }}>
            <button onClick={() => setSelected(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: MSP.sm, background: "none", border: "none", color: MC.blue, fontFamily: MF.body, fontWeight: 600, fontSize: 14, cursor: "pointer", padding: "4px 0" }}>
              <CornerUpLeft size={16} /> Back
            </button>
          </div>
        )}

        {loadingBody && <Note>Opening…</Note>}
        {!loadingBody && bodyError && <Note tone="danger">{bodyError}</Note>}
        {!loadingBody && !bodyError && !selected && !isMobile && (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: MSP.md }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: MC.blueSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: MSP.sm }}>
              <Paperclip size={20} color={MC.blue} strokeWidth={1.5} />
            </div>
            <div style={{ fontFamily: MF.body, fontSize: 14, color: MC.inkFaint }}>Select a message to read</div>
          </div>
        )}
        {!loadingBody && selected && (
          <div ref={paneRef}>
            <ThreadView message={selected} onReply={onReply} openRef={openRef} onViewAttachment={setViewerDoc} />
          </div>
        )}
      </div>

      <DocViewer open={!!viewerDoc} doc={viewerDoc} onClose={() => setViewerDoc(null)} />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MessageRow({ message: m, active, acc, accent, hasAttachments, isAll, onClick, openRef }) {
  const ref = useRef(null);

  const handleEnter = () => {
    if (active || !ref.current) return;
    gsap.to(ref.current, { x: 3, boxShadow: "2px 0 12px rgba(30,60,180,0.10)", duration: 0.18, ease: "power1.out" });
  };
  const handleLeave = () => {
    if (!ref.current) return;
    gsap.to(ref.current, { x: 0, boxShadow: "none", duration: 0.18, ease: "power1.in" });
  };

  return (
    <button ref={ref} className="mail-row" onClick={onClick}
      onMouseEnter={handleEnter} onMouseLeave={handleLeave}
      style={{
        display: "block", width: "100%", textAlign: "left",
        background: active ? MG.activeRow : "transparent",
        border: "none", borderBottom: `1px solid ${MC.hair}`,
        borderLeft: `3px solid ${active ? MC.blue : (isAll ? accent : "transparent")}`,
        padding: `${MSP.md}px ${MSP.lg}px`, cursor: "pointer",
        transition: "background 0.12s, border-color 0.15s",
        willChange: "transform",
      }}
    >
      {isAll && acc && (
        <div style={{ display: "flex", alignItems: "center", gap: MSP.xs, marginBottom: 3 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
          <span style={{ fontFamily: MF.mono, fontSize: 10, color: MC.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {acc.display_name || acc.email_address}
          </span>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: MSP.sm, marginBottom: 3 }}>
        {!m.seen && <span style={{ width: 7, height: 7, borderRadius: "50%", background: MC.blue, flexShrink: 0, boxShadow: `0 0 0 2px rgba(47,107,255,0.18)` }} />}
        <span style={{ flex: 1, fontFamily: MF.body, fontSize: 14, fontWeight: m.seen ? 500 : 700, color: MC.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
          {m.from?.name || m.from?.address || "Unknown"}
        </span>
        <span style={{ fontFamily: MF.mono, fontSize: 11, color: MC.inkFaint, flexShrink: 0 }}>
          {formatRelative(m.date)}
        </span>
      </div>
      <div style={{ fontFamily: MF.body, fontSize: 13, fontWeight: m.seen ? 400 : 600, color: m.seen ? MC.inkDim : MC.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: hasAttachments ? 4 : 0 }}>
        <RefText text={m.subject} onRef={openRef} />
      </div>
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
}

function ThreadView({ message, onReply, openRef, onViewAttachment }) {
  const isMobile = useIsMobile();
  const subjectRef = useRef(null);
  const metaRef = useRef(null);
  const bodyRef = useRef(null);
  const actionsRef = useRef(null);

  const actions = MAIL_ACTIONS.map((a) => ({
    ...a,
    handler: a.key === "reply" ? () => onReply?.(message) : null,
  })).filter((a) => a.handler);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const targets = [subjectRef, metaRef, bodyRef, actionsRef].map((r) => r.current).filter(Boolean);
    gsap.fromTo(targets,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.07, ease: "power2.out", clearProps: "transform,opacity" }
    );
  }, [message.uid]);

  return (
    <div style={{ padding: isMobile ? `${MSP.md}px ${MSP.lg}px` : `${MSP.xl}px ${MSP.xxl}px`, maxWidth: 860, margin: "0 auto" }}>
      <h1 ref={subjectRef} style={{ fontFamily: MF.body, fontWeight: 700, fontSize: isMobile ? 20 : 26, color: MC.ink, margin: `0 0 ${MSP.lg}px`, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
        <RefText text={message.subject} onRef={openRef} />
      </h1>

      {/* Sender meta card */}
      <div ref={metaRef} style={{ ...mailCard(MR.card), padding: `${MSP.md}px ${MSP.lg}px`, marginBottom: MSP.lg, display: "flex", flexDirection: "column", gap: MSP.sm }}>
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

      {/* Attachment chips */}
      {message.attachments?.length > 0 && (
        <AttachmentChips attachments={message.attachments} onView={onViewAttachment} />
      )}

      {/* Body */}
      <div ref={bodyRef} style={{ ...mailCard(MR.card), padding: `${MSP.xl}px`, marginBottom: MSP.xl, fontFamily: MF.body, fontSize: 15, color: MC.ink, lineHeight: 1.7, whiteSpace: message.html ? "normal" : "pre-wrap", wordBreak: "break-word", overflowX: "auto" }}
        {...(message.html
          ? { dangerouslySetInnerHTML: { __html: message.html } }
          : { children: <RefText text={message.text} onRef={openRef} /> })}
      />

      {/* Actions */}
      <div ref={actionsRef} style={{ display: "flex", gap: MSP.sm, flexWrap: "wrap" }}>
        {actions.map((a) => (
          <ActionButton key={a.key} icon={<CornerUpLeft size={15} />} label={a.label} onClick={a.handler} primary />
        ))}
      </div>
    </div>
  );
}

function AttachmentChips({ attachments, onView }) {
  return (
    <div style={{ ...mailCard(MR.card), padding: `${MSP.md}px ${MSP.lg}px`, marginBottom: MSP.lg, display: "flex", flexWrap: "wrap", gap: MSP.sm, alignItems: "center" }}>
      <Paperclip size={14} color={MC.inkDim} style={{ flexShrink: 0 }} />
      {attachments.map((att, i) => (
        <AttachChip key={i} att={att} onView={onView} />
      ))}
    </div>
  );
}

function AttachChip({ att, onView }) {
  const ref = useRef(null);
  return (
    <button ref={ref}
      onClick={() => { if (att.url) onView({ url: att.url, fileName: att.filename || att.name, mimeType: att.contentType || att.mimeType }); }}
      onMouseEnter={() => { if (ref.current) gsap.to(ref.current, { y: -2, boxShadow: "0 4px 12px rgba(47,107,255,0.18)", duration: 0.18, ease: "power1.out" }); }}
      onMouseLeave={() => { if (ref.current) gsap.to(ref.current, { y: 0, boxShadow: "none", duration: 0.18, ease: "power1.in" }); }}
      style={{ display: "inline-flex", alignItems: "center", gap: MSP.xs, background: "linear-gradient(135deg,#f5f8ff,#eaf0ff)", border: `1px solid ${MC.border}`, borderRadius: MR.chip, padding: `${MSP.xs}px ${MSP.md}px`, fontFamily: MF.body, fontSize: 12, color: MC.ink, cursor: att.url ? "pointer" : "default", willChange: "transform" }}
      title={att.url ? "View attachment" : "Preview unavailable"}
    >
      <Paperclip size={11} color={MC.blue} />
      {att.filename || att.name || "attachment"}
    </button>
  );
}

function ActionButton({ icon, label, onClick, primary }) {
  const ref = useRef(null);
  const handlePress = () => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { scale: 0.95 }, { scale: 1, duration: 0.25, ease: "back.out(2)" });
  };
  return (
    <button ref={ref} onClick={() => { handlePress(); onClick(); }}
      style={{ display: "inline-flex", alignItems: "center", gap: MSP.sm, background: primary ? MG.cta : MG.card, border: primary ? "none" : `1px solid ${MC.border}`, borderRadius: MR.pill, padding: `${MSP.sm + 2}px ${MSP.xl}px`, fontFamily: MF.body, fontWeight: 600, fontSize: 14, color: primary ? "#fff" : MC.inkDim, cursor: "pointer", minHeight: 40, boxShadow: primary ? "0 4px 16px rgba(47,107,255,0.30)" : "none", willChange: "transform" }}>
      {icon}{label}
    </button>
  );
}

function FilterTab({ label, active, onClick }) {
  const ref = useRef(null);
  const handleClick = () => {
    if (ref.current) gsap.fromTo(ref.current, { scale: 0.92 }, { scale: 1, duration: 0.22, ease: "back.out(2.5)" });
    onClick();
  };
  return (
    <button ref={ref} onClick={handleClick}
      style={{ background: active ? MG.cta : "none", border: active ? "none" : `1px solid ${MC.border}`, borderRadius: MR.pill, padding: `3px ${MSP.md}px`, fontFamily: MF.body, fontWeight: active ? 600 : 500, fontSize: 12, color: active ? "#fff" : MC.inkDim, cursor: "pointer", textTransform: "capitalize", boxShadow: active ? "0 2px 8px rgba(47,107,255,0.28)" : "none", willChange: "transform" }}>
      {label}
    </button>
  );
}

function RefreshButton({ onClick }) {
  const ref = useRef(null);
  const spin = () => {
    if (!ref.current) return;
    gsap.to(ref.current, { rotation: 360, duration: 0.55, ease: "power2.inOut", onComplete: () => gsap.set(ref.current, { rotation: 0 }) });
    onClick();
  };
  return (
    <button onClick={spin} style={{ background: "none", border: "none", cursor: "pointer", color: MC.inkFaint, padding: 4 }}>
      <RefreshCw ref={ref} size={15} />
    </button>
  );
}

function EmptyState({ search }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
  }, [search]);
  return (
    <div ref={ref} style={{ padding: `${MSP.xxl}px ${MSP.lg}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: MSP.md, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#eaf0ff,#dde8ff)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Search size={22} color={MC.blue} strokeWidth={1.5} />
      </div>
      <div style={{ fontFamily: MF.body, fontSize: 14, color: MC.inkFaint }}>
        {search ? `No results for "${search}"` : "No messages."}
      </div>
    </div>
  );
}

// Skeleton placeholder rows — shown only on a cold read (no cache). Keeps the list
// structure visible so a first load doesn't feel like a blocking spinner. Switching
// to an already-loaded account skips this entirely (cache paints immediately).
function SkeletonList() {
  const rowRef = useRef(null);
  useEffect(() => {
    if (!rowRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const bars = rowRef.current.querySelectorAll(".sk-bar");
    const tl = gsap.to(bars, { opacity: 0.35, duration: 0.7, ease: "sine.inOut", stagger: 0.05, yoyo: true, repeat: -1 });
    return () => tl.kill();
  }, []);
  return (
    <div ref={rowRef} style={{ padding: `${MSP.sm}px 0` }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{ padding: `${MSP.md}px ${MSP.lg}px`, borderBottom: `1px solid ${MC.hair}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="sk-bar" style={{ width: `${55 + (i % 3) * 12}%`, height: 11, borderRadius: 4, background: MC.blueSoft }} />
          <div className="sk-bar" style={{ width: `${72 - (i % 4) * 9}%`, height: 9, borderRadius: 4, background: MC.hair }} />
        </div>
      ))}
    </div>
  );
}

function Note({ children, tone }) {
  return (
    <div style={{ padding: `${MSP.xl}px ${MSP.lg}px`, fontFamily: MF.body, fontSize: 13, color: tone === "danger" ? MC.danger : MC.inkFaint }}>
      {children}
    </div>
  );
}
