import { useEffect, useRef, useState } from "react";
import { Send, ChevronDown } from "lucide-react";
import { theme } from "../../theme";
import { mailApi } from "../../lib/mailApi";
import { useDirtyGuard } from "../../lib/useDirtyGuard";

const field = {
  width: "100%",
  boxSizing: "border-box",
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.input,
  color: theme.color.ink,
  padding: "12px 14px",
  fontFamily: theme.font.mono,
  fontSize: 14,
  outline: "none",
};

export default function ComposeView({ reply, accounts = [], defaultAccountId, onSent }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // The sending account is ALWAYS explicit. Replies default to the account that
  // received the thread; otherwise the current selection / default account.
  const [fromId, setFromId] = useState(
    () => reply?.accountId || defaultAccountId || accounts[0]?.id || null
  );
  const bodyRef = useRef(null);
  const { markDirty, markClean } = useDirtyGuard();

  const fromAccount = accounts.find((a) => a.id === fromId) || null;

  // Pre-fill recipient/subject from the reply once.
  useEffect(() => {
    if (reply) {
      setTo(reply.from?.address || "");
      setSubject(reply.subject?.startsWith("Re:") ? reply.subject : `Re: ${reply.subject || ""}`);
    }
  }, [reply]);

  // Pre-fill the body: quote the original (reply) + the SENDING account's signature.
  // Re-runs when the From account changes so the right signature is shown.
  useEffect(() => {
    let alive = true;
    const build = (sig) => {
      let html = "<br><br>";
      if (reply) {
        const orig = reply.html || (reply.text || "").replace(/\n/g, "<br>");
        html += `<blockquote style="border-left:2px solid #1a2a3c;padding-left:10px;color:#8a97a6">${orig}</blockquote>`;
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
    if (!fromId) {
      setError("Choose an account to send from.");
      return;
    }
    if (!to.includes("@")) {
      setError("Enter a valid recipient.");
      return;
    }
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
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px" }}>
      <div
        style={{
          fontFamily: theme.font.condensed,
          fontWeight: 800,
          fontSize: 24,
          letterSpacing: "0.02em",
          color: theme.color.ink,
          marginBottom: 18,
        }}
      >
        {reply ? "REPLY" : "NEW MESSAGE"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <FromSelect accounts={accounts} value={fromId} account={fromAccount} onChange={(id) => { markDirty(); setFromId(id); }} />
        <input placeholder="To" value={to} onChange={(e) => { markDirty(); setTo(e.target.value); }} style={field} />
        <input placeholder="Subject" value={subject} onChange={(e) => { markDirty(); setSubject(e.target.value); }} style={field} />
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          onInput={markDirty}
          style={{
            ...field,
            minHeight: 220,
            fontFamily: theme.font.body,
            fontSize: 14,
            lineHeight: 1.6,
            overflowY: "auto",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={submit}
            disabled={loading || done}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              border: "none",
              borderRadius: theme.radius.input,
              background: done ? theme.color.green : theme.color.amber,
              color: theme.color.white,
              fontFamily: theme.font.condensed,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "12px 22px",
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            <Send size={16} /> {done ? "Sent" : loading ? "Sending…" : "Send"}
          </button>
          {error && <span style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.red }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}

// "From" account chooser. A single account renders as a static label; multiple
// accounts render a glass dropdown so the sender is always an explicit choice.
function FromSelect({ accounts, value, account, onChange }) {
  const [open, setOpen] = useState(false);
  const labelWrap = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    background: theme.color.surfaceMuted,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.input,
    padding: "10px 14px",
  };
  const dot = (c) => <span style={{ width: 9, height: 9, borderRadius: "50%", background: c || theme.color.slate, flexShrink: 0 }} />;
  const line = (a) => (
    <span style={{ minWidth: 0, flex: 1 }}>
      <span style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 13, color: theme.color.ink }}>
        {a.display_name || a.email_address}
      </span>{" "}
      <span style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>{a.email_address}</span>
    </span>
  );

  if (accounts.length <= 1) {
    return (
      <div style={labelWrap}>
        <span style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.14em", color: theme.color.slate, textTransform: "uppercase" }}>From</span>
        {account ? (<>{dot(account.color)}{line(account)}</>) : (
          <span style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>default mailbox</span>
        )}
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={{ ...labelWrap, width: "100%", cursor: "pointer", textAlign: "left" }}>
        <span style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.14em", color: theme.color.slate, textTransform: "uppercase" }}>From</span>
        {account ? (<>{dot(account.color)}{line(account)}</>) : <span style={{ flex: 1, fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>Choose account…</span>}
        <ChevronDown size={14} color={theme.color.slate} style={{ flexShrink: 0 }} />
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
              background: theme.color.surface,
              border: `1px solid ${theme.color.borderStrong}`,
              borderRadius: theme.radius.input,
              boxShadow: theme.shadow.card,
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
                  gap: 9,
                  width: "100%",
                  background: a.id === value ? theme.color.amberSoft : "none",
                  border: "none",
                  borderRadius: theme.radius.sm,
                  padding: "9px 10px",
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
  );
}
