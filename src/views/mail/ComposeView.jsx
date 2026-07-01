import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
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

export default function ComposeView({ reply, onSent }) {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const bodyRef = useRef(null);
  const { markDirty, markClean } = useDirtyGuard();

  // Pre-fill the body: signature appended below, cursor placed above it. In reply
  // mode also quote the original. Signature comes from /api/mail/settings.
  useEffect(() => {
    let alive = true;
    mailApi.getSettings().then((s) => {
      if (!alive) return;
      const sig = s.signature_html || "";
      let html = "<br><br>";
      if (reply) {
        const orig = reply.html || (reply.text || "").replace(/\n/g, "<br>");
        html += `<blockquote style="border-left:2px solid #d7dde6;padding-left:10px;color:#64748b">${orig}</blockquote>`;
      }
      if (sig) html += `<br>${sig}`;
      if (bodyRef.current) bodyRef.current.innerHTML = html;
    });
    if (reply) {
      setTo(reply.from?.address || "");
      setSubject(reply.subject?.startsWith("Re:") ? reply.subject : `Re: ${reply.subject || ""}`);
    }
    return () => {
      alive = false;
    };
  }, [reply]);

  const submit = async () => {
    setError("");
    if (!to.includes("@")) {
      setError("Enter a valid recipient.");
      return;
    }
    setLoading(true);
    try {
      await mailApi.send({
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
