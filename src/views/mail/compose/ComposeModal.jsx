import { useEffect, useRef, useState } from "react";
import { X, ChevronDown, Maximize2, Minimize2, Minus } from "lucide-react";
import gsap from "gsap";
import { C, F, R, SP, glass, reduceMotion } from "../../../ui/theme";
import { mailApi } from "../../../lib/mailApi";
import { useDirtyGuard } from "../../../lib/useDirtyGuard";
import { supabase } from "../../../lib/supabase";
import { formatAbsolute } from "../../../lib/format";
import { focusFirstToken } from "../../../lib/mailTemplateVars";
import RecipientChips from "./RecipientChips";
import BodyEditor from "./BodyEditor";
import AttachmentCards, { uploadComposeAttachment } from "./AttachmentCards";
import ActionBar from "./ActionBar";
import ConfirmDialog from "../../../components/ConfirmDialog";

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

// Floating dark compose card — modal on desktop, full-screen sheet on mobile.
// docked=false renders centered+large; docked=true (pop-out) renders as a smaller
// bottom-right window, same component either way per the phase spec.
export default function ComposeModal({ reply, forward, accounts = [], defaultAccountId, onSent, onClose, isMobile }) {
  const source = reply || forward;
  const [fromId, setFromId] = useState(() => source?.accountId || defaultAccountId || accounts[0]?.id || null);
  const [to, setTo] = useState(() => (reply?.from?.address ? [{ name: reply.from.name || "", address: reply.from.address }] : []));
  const [cc, setCc] = useState([]);
  const [bcc, setBcc] = useState([]);
  const [ccOpen, setCcOpen] = useState(false);
  const [bccOpen, setBccOpen] = useState(false);
  const [subject, setSubject] = useState(() => {
    if (reply) return reply.subject?.startsWith("Re:") ? reply.subject : `Re: ${reply.subject || ""}`;
    if (forward) return forward.subject?.startsWith("Fwd:") ? forward.subject : `Fwd: ${forward.subject || ""}`;
    return "";
  });
  const [bodyHtml, setBodyHtml] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [scheduledAt, setScheduledAt] = useState(null);
  const [minimized, setMinimized] = useState(false);
  const [docked, setDocked] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [recipients, setRecipients] = useState([]);
  const [team, setTeam] = useState([]);

  const cardRef = useRef(null);
  const editorApi = useRef(null);
  const bodyInitRef = useRef(null);
  const { markDirty, markClean } = useDirtyGuard();

  const fromAccount = accounts.find((a) => a.id === fromId) || null;
  const teamRef = useRef(team);
  teamRef.current = team;

  // Prefill quoted reply / forward body + signature once the account resolves.
  useEffect(() => {
    let alive = true;
    const build = (sig) => {
      let html = "<p></p>";
      if (reply) {
        const orig = reply.html || (reply.text || "").replace(/\n/g, "<br>");
        html += `<blockquote style="border-left:3px solid ${C.hair};padding-left:12px;color:${C.inkDim};margin:8px 0 0 0">${orig}</blockquote>`;
      }
      if (forward) {
        const orig = forward.html || (forward.text || "").replace(/\n/g, "<br>");
        const to = (forward.to || []).map((t) => t.name || t.address).join(", ");
        html += `<div style="border-top:1px solid ${C.hair};padding-top:12px;margin-top:12px;color:${C.inkDim};font-size:13px;line-height:1.6">
          ---------- Forwarded message ----------<br>
          From: ${forward.from?.name || forward.from?.address || "Unknown"} &lt;${forward.from?.address || ""}&gt;<br>
          Date: ${formatAbsolute(forward.date)}<br>
          Subject: ${forward.subject || ""}<br>
          ${to ? `To: ${to}<br>` : ""}
        </div><br>${orig}`;
      }
      if (sig) html += `<br>${sig}`;
      bodyInitRef.current = html;
      if (!alive) return;
      setBodyHtml(html);
      editorApi.current?.commands.setContent(html);
    };
    if (!fromId) { build(""); return; }
    mailApi.getAccountSettings(fromId).then((s) => alive && build(s.signature_html || "")).catch(() => alive && build(""));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId]);

  useEffect(() => {
    if (!fromId) return;
    mailApi.recipients(fromId).then((r) => setRecipients(r.recipients || [])).catch(() => {});
  }, [fromId]);

  useEffect(() => {
    mailApi.team().then((r) => setTeam(r.team || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion() || !cardRef.current) return;
    gsap.fromTo(cardRef.current, { opacity: 0, y: 24, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.32, ease: "power2.out" });
  }, []);

  const hasContent = subject.trim() || to.length || attachments.length || (bodyHtml && bodyHtml !== bodyInitRef.current && bodyHtml.replace(/<[^>]+>/g, "").trim());

  const requestClose = () => {
    if (hasContent) { setConfirmDiscard(true); return; }
    markClean();
    onClose?.();
  };

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !minimized) requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasContent, minimized]);

  const onFiles = async (fileList) => {
    if (!fileList?.length || !fromAccount) return;
    const { data: sess } = await supabase.auth.getSession();
    const userId = sess?.session?.user?.id || "anon";
    const files = Array.from(fileList);
    const placeholders = files.map((f) => ({ id: uid(), fileName: f.name, mimeType: f.type, sizeBytes: f.size, uploading: true }));
    setAttachments((a) => [...a, ...placeholders]);
    markDirty();
    files.forEach(async (file, i) => {
      try {
        const uploaded = await uploadComposeAttachment(file, userId);
        setAttachments((a) => a.map((x) => (x.id === placeholders[i].id ? { ...uploaded, id: placeholders[i].id } : x)));
      } catch {
        setAttachments((a) => a.filter((x) => x.id !== placeholders[i].id));
      }
    });
  };

  const buildAttachmentRefs = () =>
    attachments.filter((a) => a.storagePath).map((a) => ({ filename: a.fileName, path: a.storagePath, contentType: a.mimeType }));

  const validTo = to.filter((r) => r.address);

  const submit = async () => {
    setError("");
    if (!fromId) { setError("Choose an account to send from."); return; }
    if (!validTo.length) { setError("Add at least one recipient."); return; }
    setSending(true);
    try {
      const payload = {
        accountId: fromId,
        to: validTo.map((r) => r.address),
        cc: cc.length ? cc.map((r) => r.address) : undefined,
        bcc: bcc.length ? bcc.map((r) => r.address) : undefined,
        subject,
        html: bodyHtml,
        attachments: buildAttachmentRefs(),
        replyToUid: reply?.uid,
      };
      if (scheduledAt) {
        await mailApi.scheduleSend({ account_id: fromId, to: payload.to, cc: payload.cc, bcc: payload.bcc, subject, body_html: bodyHtml, attachments: payload.attachments, reply_to_uid: reply?.uid, send_at: scheduledAt });
        mailApi.flushScheduledSends().catch(() => {});
      } else {
        await mailApi.send(payload);
      }
      markClean();
      onSent?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  const pickTemplate = (t) => {
    if (t.subject) setSubject(t.subject);
    setBodyHtml(t.body_html);
    editorApi.current?.commands.setContent(t.body_html);
    markDirty();
  };

  // Canned response: subject/body already have {{sender_name}} resolved and everything
  // else left literal — land the cursor on the first remaining token, if any.
  const pickCanned = (cr) => {
    if (cr.subject) setSubject(cr.subject);
    setBodyHtml(cr.bodyHtml);
    editorApi.current?.commands.setContent(cr.bodyHtml);
    focusFirstToken(editorApi.current);
    markDirty();
  };

  const title = reply ? "Reply" : forward ? "Forward" : "New email";

  if (minimized) {
    return (
      <div
        style={{
          position: "fixed", bottom: 0, right: 24, zIndex: 200, width: 280, ...glass(R.card),
          borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: `${SP.sm}px ${SP.md}px`,
          display: "flex", alignItems: "center", gap: SP.sm, cursor: "pointer",
        }}
        onClick={() => setMinimized(false)}
      >
        <span style={{ flex: 1, minWidth: 0, font: `600 12px ${F.mono}`, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {subject || title}
        </span>
        <button onClick={(e) => { e.stopPropagation(); requestClose(); }} style={headerIconBtn} title="Close"><X size={14} /></button>
      </div>
    );
  }

  const containerStyle = isMobile
    ? { position: "fixed", inset: 0, zIndex: 200, background: C.void, display: "flex", flexDirection: "column" }
    : docked
    ? { position: "fixed", bottom: 24, right: 24, zIndex: 200, width: 440, height: 520, display: "flex", flexDirection: "column" }
    : { position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: SP.xl };

  return (
    <>
      {!isMobile && !docked && (
        <div
          onClick={requestClose}
          style={{ position: "fixed", inset: 0, zIndex: 199, background: "rgba(2,4,8,0.6)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
        />
      )}
      <div style={containerStyle}>
        <div
          ref={cardRef}
          style={{
            ...glass(isMobile ? 0 : R.panel), width: isMobile ? "100%" : docked ? "100%" : 640, height: isMobile ? "100%" : docked ? "100%" : "min(88vh, 700px)",
            maxHeight: isMobile ? "100%" : "88vh", display: "flex", flexDirection: "column", overflow: "hidden",
            boxShadow: "0 30px 80px -20px rgba(0,0,0,0.85)",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: SP.sm, padding: `${SP.md}px ${SP.lg}px`, borderBottom: `1px solid ${C.hair}` }}>
            <span
              style={{ flex: 1, font: `700 15px ${F.head}`, letterSpacing: "0.01em", color: C.ink, cursor: isMobile ? "default" : "pointer" }}
              onClick={() => !isMobile && setMinimized(true)}
            >
              {title}
            </span>
            {!isMobile && (
              <>
                <button onClick={() => setMinimized(true)} style={headerIconBtn} title="Minimize"><Minus size={14} /></button>
                <button onClick={() => setDocked((d) => !d)} style={headerIconBtn} title={docked ? "Dock" : "Pop out"}>
                  {docked ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
              </>
            )}
            <button onClick={requestClose} style={headerIconBtn} title="Close"><X size={16} /></button>
          </div>

          {confirmDiscard && (
            <div style={{ padding: `${SP.sm}px ${SP.lg}px 0` }}>
              <ConfirmDialog
                message="Discard this draft? Your changes will be lost."
                confirmLabel="DISCARD"
                onConfirm={() => { markClean(); onClose?.(); }}
                onCancel={() => setConfirmDiscard(false)}
              />
            </div>
          )}

          {/* Recipients + subject */}
          <div style={{ padding: `${SP.md}px ${SP.lg}px`, borderBottom: `1px solid ${C.hair}`, display: "flex", flexDirection: "column", gap: SP.xs }}>
            <FromRow accounts={accounts} value={fromId} account={fromAccount} onChange={(id) => { markDirty(); setFromId(id); }} />
            <div style={{ display: "flex", alignItems: "flex-start", gap: SP.sm }}>
              <div style={{ flex: 1 }}>
                <RecipientChips label="To" value={to} onChange={(v) => { markDirty(); setTo(v); }} suggestions={recipients} placeholder="Recipients" autoFocus />
              </div>
              {!ccOpen && <TextLink onClick={() => setCcOpen(true)}>Cc</TextLink>}
              {!bccOpen && <TextLink onClick={() => setBccOpen(true)}>Bcc</TextLink>}
            </div>
            {ccOpen && <RecipientChips label="Cc" value={cc} onChange={(v) => { markDirty(); setCc(v); }} suggestions={recipients} placeholder="Carbon copy" />}
            {bccOpen && <RecipientChips label="Bcc" value={bcc} onChange={(v) => { markDirty(); setBcc(v); }} suggestions={recipients} placeholder="Blind copy" />}
            <input
              value={subject}
              onChange={(e) => { markDirty(); setSubject(e.target.value); }}
              placeholder="Subject"
              style={{ background: "transparent", border: "none", outline: "none", color: C.ink, font: `700 20px ${F.head}`, padding: "6px 0 2px", letterSpacing: "0.005em" }}
            />
          </div>

          {/* Body */}
          <div style={{ flex: 1, minHeight: 0, padding: `${SP.sm}px ${SP.lg}px`, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <BodyEditor
              initialHtml={bodyHtml}
              onChange={(html) => { setBodyHtml(html); markDirty(); }}
              getTeam={() => teamRef.current}
              editorRef={editorApi}
            />
            <AttachmentCards attachments={attachments} onChange={setAttachments} />
          </div>

          {/* Footer */}
          <div style={{ padding: `${SP.md}px ${SP.lg}px`, borderTop: `1px solid ${C.hair}`, display: "flex", flexDirection: "column", gap: SP.sm }}>
            {error && <span style={{ font: `500 12px ${F.mono}`, color: C.critical }}>{error}</span>}
            <ActionBar
              accountId={fromId}
              canSend={!!validTo.length && !!fromId}
              sending={sending}
              scheduledAt={scheduledAt}
              onFiles={onFiles}
              onPickTemplate={pickTemplate}
              onPickCanned={pickCanned}
              onSchedule={(iso) => { setScheduledAt(iso); markDirty(); }}
              onClearSchedule={() => setScheduledAt(null)}
              onPickContact={(r) => { setTo((t) => (t.some((x) => x.address === r.address) ? t : [...t, r])); markDirty(); }}
              recipients={recipients}
              currentSubject={subject}
              currentBodyHtml={bodyHtml}
              onSend={submit}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function TextLink({ children, onClick }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, font: `500 12px ${F.mono}`, padding: "6px 2px" }}>
      {children}
    </button>
  );
}

function FromRow({ accounts, value, account, onChange }) {
  const [open, setOpen] = useState(false);
  if (accounts.length <= 1) {
    return (
      <span style={{ font: `500 12px ${F.mono}`, color: C.inkFaint }}>
        From <span style={{ color: C.ink }}>{account?.display_name || account?.email_address || "default mailbox"}</span>
      </span>
    );
  }
  return (
    <div style={{ position: "relative", alignSelf: "flex-start" }}>
      <button onClick={() => setOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", font: `500 12px ${F.mono}`, color: C.inkFaint, padding: "2px 0" }}>
        From <span style={{ color: C.ink }}>{account?.display_name || account?.email_address || "Choose…"}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
          <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 21, background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.chip, padding: 4, minWidth: 220 }}>
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => { onChange(a.id); setOpen(false); }}
                style={{ display: "block", width: "100%", textAlign: "left", background: a.id === value ? "rgba(255,255,255,0.06)" : "none", border: "none", borderRadius: R.chip - 2, padding: "7px 8px", cursor: "pointer", color: C.ink, font: `500 12px ${F.mono}` }}
              >
                {a.display_name || a.email_address}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const headerIconBtn = {
  display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28,
  background: "none", border: "none", borderRadius: 7, color: C.inkDim, cursor: "pointer",
};
