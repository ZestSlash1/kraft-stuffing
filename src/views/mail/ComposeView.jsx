import { useEffect, useRef, useState } from "react";
import { Send, ChevronDown } from "lucide-react";
import gsap from "gsap";
import { MC, MF, MG, MSP, MR, mailCard } from "../../ui/mailTheme";
import { mailApi } from "../../lib/mailApi";
import { useDirtyGuard } from "../../lib/useDirtyGuard";

const field = {
  width: "100%",
  boxSizing: "border-box",
  background: "linear-gradient(135deg, #f8faff, #f3f6ff)",
  border: `1px solid ${MC.border}`,
  borderRadius: MR.chip,
  color: MC.ink,
  padding: `${MSP.md}px ${MSP.lg}px`,
  fontFamily: MF.body,
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.15s, box-shadow 0.15s",
};

export default function ComposeView({ reply, accounts = [], defaultAccountId, onSent }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [fromId, setFromId] = useState(
    () => reply?.accountId || defaultAccountId || accounts[0]?.id || null
  );
  const bodyRef = useRef(null);
  const cardRef = useRef(null);
  const titleRef = useRef(null);
  const btnRef = useRef(null);
  const { markDirty, markClean } = useDirtyGuard();

  const fromAccount = accounts.find((a) => a.id === fromId) || null;

  // Entrance animation
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const targets = [titleRef.current, cardRef.current].filter(Boolean);
    gsap.fromTo(targets,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.38, stagger: 0.1, ease: "power2.out", clearProps: "transform,opacity" }
    );
  }, []);

  useEffect(() => {
    if (reply) {
      setTo(reply.from?.address || "");
      setSubject(reply.subject?.startsWith("Re:") ? reply.subject : `Re: ${reply.subject || ""}`);
    }
  }, [reply]);

  useEffect(() => {
    let alive = true;
    const build = (sig) => {
      let html = "<br><br>";
      if (reply) {
        const orig = reply.html || (reply.text || "").replace(/\n/g, "<br>");
        html += `<blockquote style="border-left:3px solid ${MC.border};padding-left:12px;color:${MC.inkDim};margin:0 0 0 0">${orig}</blockquote>`;
      }
      if (sig) html += `<br>${sig}`;
      if (bodyRef.current) bodyRef.current.innerHTML = html;
    };
    if (!fromId) { build(""); return; }
    mailApi.getAccountSettings(fromId)
      .then((s) => alive && build(s.signature_html || ""))
      .catch(() => alive && build(""));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromId, reply]);

  const submit = async () => {
    setError("");
    if (!fromId) { setError("Choose an account to send from."); return; }
    if (!to.includes("@")) { setError("Enter a valid recipient."); return; }
    setLoading(true);
    if (btnRef.current) gsap.to(btnRef.current, { scale: 0.97, duration: 0.1 });
    try {
      await mailApi.send({ accountId: fromId, to, subject, html: bodyRef.current?.innerHTML || "", replyToUid: reply?.uid });
      markClean();
      setDone(true);
      if (btnRef.current) gsap.fromTo(btnRef.current, { scale: 0.97 }, { scale: 1, duration: 0.35, ease: "back.out(2.5)" });
      setTimeout(() => onSent?.(), 800);
    } catch (e) {
      if (btnRef.current) gsap.to(btnRef.current, { scale: 1, x: [-4, 4, -3, 3, 0], duration: 0.4, ease: "none" });
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: `${MSP.xxl}px ${MSP.xl}px`, background: MG.page, minHeight: "100%", boxSizing: "border-box" }}>
      <h2 ref={titleRef} style={{ fontFamily: MF.body, fontWeight: 700, fontSize: 22, color: MC.ink, margin: `0 0 ${MSP.xl}px`, letterSpacing: "-0.01em" }}>
        {reply ? "Reply" : "New Message"}
      </h2>

      <div ref={cardRef} style={{ ...mailCard(MR.panel), padding: MSP.xl, display: "flex", flexDirection: "column", gap: MSP.md }}>
        <FromSelect accounts={accounts} value={fromId} account={fromAccount}
          onChange={(id) => { markDirty(); setFromId(id); }} />

        <FieldRow label="To">
          <FocusInput
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => { markDirty(); setTo(e.target.value); }}
            style={field}
          />
        </FieldRow>

        <FieldRow label="Subject">
          <FocusInput
            placeholder="Subject"
            value={subject}
            onChange={(e) => { markDirty(); setSubject(e.target.value); }}
            style={field}
          />
        </FieldRow>

        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          onInput={markDirty}
          style={{ ...field, minHeight: 240, fontFamily: MF.body, fontSize: 14, lineHeight: 1.7, overflowY: "auto", borderRadius: MR.chip }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: MSP.lg, paddingTop: MSP.sm }}>
          <button ref={btnRef} onClick={submit} disabled={loading || done}
            style={{ display: "inline-flex", alignItems: "center", gap: MSP.sm, border: "none", borderRadius: MR.pill, background: done ? `linear-gradient(135deg,#1ac98a,#0ea472)` : MG.cta, color: "#fff", fontFamily: MF.body, fontWeight: 600, fontSize: 15, padding: `${MSP.md}px ${MSP.xl}px`, cursor: loading ? "wait" : "pointer", opacity: loading ? 0.75 : 1, minHeight: 44, boxShadow: done ? "0 4px 16px rgba(18,184,134,0.35)" : "0 4px 18px rgba(47,107,255,0.32)", willChange: "transform", transition: "box-shadow 0.2s" }}>
            <Send size={16} /> {done ? "Sent!" : loading ? "Sending…" : "Send"}
          </button>
          {error && <span style={{ fontFamily: MF.body, fontSize: 13, color: MC.danger }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}

// Input with GSAP focus ring glow
function FocusInput({ style, ...props }) {
  const ref = useRef(null);
  return (
    <input ref={ref}
      onFocus={() => { if (ref.current) gsap.to(ref.current, { boxShadow: `0 0 0 3px rgba(47,107,255,0.15)`, borderColor: MC.blue, duration: 0.2 }); }}
      onBlur={() => { if (ref.current) gsap.to(ref.current, { boxShadow: "none", borderColor: MC.border, duration: 0.2 }); }}
      style={style} {...props}
    />
  );
}

function FieldRow({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: MSP.xs }}>
      <span style={{ fontFamily: MF.body, fontWeight: 500, fontSize: 12, color: MC.inkDim }}>{label}</span>
      {children}
    </div>
  );
}

function FromSelect({ accounts, value, account, onChange }) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);

  useEffect(() => {
    if (!dropRef.current) return;
    if (open) gsap.fromTo(dropRef.current, { opacity: 0, y: -6, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: "power2.out" });
  }, [open]);

  const trigger = { display: "flex", alignItems: "center", gap: MSP.sm, background: "linear-gradient(135deg,#f5f8ff,#eef3ff)", border: `1px solid ${MC.border}`, borderRadius: MR.chip, padding: `${MSP.md}px ${MSP.lg}px` };
  const dot = (c) => <span style={{ width: 8, height: 8, borderRadius: "50%", background: c || MC.blue, flexShrink: 0, boxShadow: `0 0 0 2px rgba(47,107,255,0.15)` }} />;
  const line = (a) => (
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={{ fontFamily: MF.body, fontWeight: 600, fontSize: 13, color: MC.ink }}>{a.display_name || a.email_address}</span>{" "}
      <span style={{ fontFamily: MF.mono, fontSize: 11, color: MC.inkFaint }}>{a.email_address}</span>
    </span>
  );

  if (accounts.length <= 1) {
    return (
      <FieldRow label="From">
        <div style={trigger}>
          {account ? (<>{dot(account.color)}{line(account)}</>) : <span style={{ fontFamily: MF.body, fontSize: 13, color: MC.inkDim }}>default mailbox</span>}
        </div>
      </FieldRow>
    );
  }

  return (
    <FieldRow label="From">
      <div style={{ position: "relative" }}>
        <button onClick={() => setOpen((v) => !v)}
          style={{ ...trigger, width: "100%", cursor: "pointer", textAlign: "left" }}>
          {account ? (<>{dot(account.color)}{line(account)}</>) : <span style={{ flex: 1, fontFamily: MF.body, fontSize: 13, color: MC.inkDim }}>Choose account…</span>}
          <ChevronDown size={14} color={MC.inkDim} style={{ flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
        </button>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
            <div ref={dropRef} style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 21, ...mailCard(MR.chip), padding: 4 }}>
              {accounts.map((a) => (
                <button key={a.id} onClick={() => { onChange(a.id); setOpen(false); }}
                  style={{ display: "flex", alignItems: "center", gap: MSP.sm, width: "100%", background: a.id === value ? MG.activeRow : "none", border: "none", borderRadius: MR.chip - 2, padding: `${MSP.sm}px ${MSP.md}px`, cursor: "pointer", textAlign: "left" }}>
                  {dot(a.color)}{line(a)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </FieldRow>
  );
}
