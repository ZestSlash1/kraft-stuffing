import { useEffect, useRef, useState } from "react";
import { Send, ChevronDown } from "lucide-react";
import { MC, MF, MSP, MR, mailCard } from "../../ui/mailTheme";
import { mailApi } from "../../lib/mailApi";
import { useDirtyGuard } from "../../lib/useDirtyGuard";

const field = {
  width: "100%",
  boxSizing: "border-box",
  background: MC.surface,
  border: `1px solid ${MC.border}`,
  borderRadius: MR.chip,
  color: MC.ink,
  padding: `${MSP.md}px ${MSP.lg}px`,
  fontFamily: MF.body,
  fontSize: 14,
  outline: "none",
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
  const { markDirty, markClean } = useDirtyGuard();

  const fromAccount = accounts.find((a) => a.id === fromId) || null;

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
        html += `<blockquote style="border-left:2px solid ${MC.border};padding-left:10px;color:${MC.inkDim};margin:0">${orig}</blockquote>`;
      }
      if (sig) html += `<br>${sig}`;
      if (bodyRef.current) bodyRef.current.innerHTML = html;
    };
    if (!fromId) { build(""); return; }
    mailApi
      .getAccountSettings(fromId)
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
    try {
      await mailApi.send({
        accountId: fromId,
        to,
        subject,
        html: bodyRef.current?.innerHTML || "",
        replyToUid: reply?.uid,
      });
      markClean();
      setDone(true);
      setTimeout(() => onSent?.(), 700);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: `${MSP.xxl}px ${MSP.xl}px` }}>
      <h2
        style={{
          fontFamily: MF.body,
          fontWeight: 700,
          fontSize: 22,
          color: MC.ink,
          margin: `0 0 ${MSP.xl}px`,
          letterSpacing: "-0.01em",
        }}
      >
        {reply ? "Reply" : "New Message"}
      </h2>

      <div style={{ ...mailCard(MR.panel), padding: MSP.xl, display: "flex", flexDirection: "column", gap: MSP.md }}>
        <FromSelect accounts={accounts} value={fromId} account={fromAccount} onChange={(id) => { markDirty(); setFromId(id); }} />

        <FieldRow label="To">
          <input
            placeholder="recipient@example.com"
            value={to}
            onChange={(e) => { markDirty(); setTo(e.target.value); }}
            style={field}
          />
        </FieldRow>

        <FieldRow label="Subject">
          <input
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
          style={{
            ...field,
            minHeight: 240,
            fontFamily: MF.body,
            fontSize: 14,
            lineHeight: 1.65,
            overflowY: "auto",
            borderRadius: MR.chip,
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: MSP.lg, paddingTop: MSP.sm }}>
          <button
            onClick={submit}
            disabled={loading || done}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: MSP.sm,
              border: "none",
              borderRadius: MR.pill,
              background: done ? MC.success : MC.blue,
              color: "#fff",
              fontFamily: MF.body,
              fontWeight: 600,
              fontSize: 15,
              padding: `${MSP.md}px ${MSP.xl}px`,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
              minHeight: 44,
              transition: "background 0.2s, opacity 0.2s",
            }}
          >
            <Send size={16} /> {done ? "Sent!" : loading ? "Sending…" : "Send"}
          </button>
          {error && (
            <span style={{ fontFamily: MF.body, fontSize: 13, color: MC.danger }}>{error}</span>
          )}
        </div>
      </div>
    </div>
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

  const trigger = {
    display: "flex",
    alignItems: "center",
    gap: MSP.sm,
    background: MC.canvasAlt,
    border: `1px solid ${MC.border}`,
    borderRadius: MR.chip,
    padding: `${MSP.md}px ${MSP.lg}px`,
  };

  const dot = (c) => (
    <span style={{ width: 8, height: 8, borderRadius: "50%", background: c || MC.blue, flexShrink: 0 }} />
  );

  const line = (a) => (
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={{ fontFamily: MF.body, fontWeight: 600, fontSize: 13, color: MC.ink }}>
        {a.display_name || a.email_address}
      </span>{" "}
      <span style={{ fontFamily: MF.mono, fontSize: 11, color: MC.inkFaint }}>{a.email_address}</span>
    </span>
  );

  if (accounts.length <= 1) {
    return (
      <FieldRow label="From">
        <div style={trigger}>
          {account ? (<>{dot(account.color)}{line(account)}</>) : (
            <span style={{ fontFamily: MF.body, fontSize: 13, color: MC.inkDim }}>default mailbox</span>
          )}
        </div>
      </FieldRow>
    );
  }

  return (
    <FieldRow label="From">
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ ...trigger, width: "100%", cursor: "pointer", textAlign: "left" }}
        >
          {account ? (<>{dot(account.color)}{line(account)}</>) : (
            <span style={{ flex: 1, fontFamily: MF.body, fontSize: 13, color: MC.inkDim }}>Choose account…</span>
          )}
          <ChevronDown size={14} color={MC.inkDim} style={{ flexShrink: 0 }} />
        </button>
        {open && (
          <>
            <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                zIndex: 21,
                marginTop: 4,
                background: MC.surface,
                border: `1px solid ${MC.border}`,
                borderRadius: MR.chip,
                boxShadow: "0 4px 24px rgba(16,24,40,0.10)",
                padding: 4,
              }}
            >
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => { onChange(a.id); setOpen(false); }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: MSP.sm,
                    width: "100%",
                    background: a.id === value ? MC.blueSoft : "none",
                    border: "none",
                    borderRadius: MR.chip - 2,
                    padding: `${MSP.sm}px ${MSP.md}px`,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {dot(a.color)}
                  {line(a)}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </FieldRow>
  );
}
