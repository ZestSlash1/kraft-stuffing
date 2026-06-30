import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link as LinkIcon } from "lucide-react";
import { theme } from "../../theme";
import { mailApi } from "../../lib/mailApi";

// Signature editor — a lightweight contenteditable with bold/italic/link only.
export default function MailSettingsView({ connected }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    mailApi
      .getSettings()
      .then((s) => {
        setEmail(s.email || "");
        if (ref.current) ref.current.innerHTML = s.signature_html || "";
      })
      .finally(() => setLoading(false));
  }, []);

  const cmd = (command) => {
    if (command === "createLink") {
      const url = window.prompt("Link URL");
      if (url) document.execCommand("createLink", false, url);
    } else {
      document.execCommand(command, false, null);
    }
    ref.current?.focus();
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await mailApi.saveSignature(ref.current?.innerHTML || "");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Pad>Loading…</Pad>;

  return (
    <div style={{ maxWidth: 620, margin: "0 auto", padding: "32px 24px" }}>
      <div
        style={{
          fontFamily: theme.font.condensed,
          fontWeight: 800,
          fontSize: 24,
          letterSpacing: "0.02em",
          color: theme.color.ink,
        }}
      >
        MAIL SETTINGS
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, margin: "6px 0 24px" }}>
        {connected ? `Connected · ${email}` : "No mailbox connected yet"}
      </div>

      <div style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.18em", color: theme.color.slate, textTransform: "uppercase", marginBottom: 8 }}>
        Signature
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {[
          { Icon: Bold, c: "bold" },
          { Icon: Italic, c: "italic" },
          { Icon: LinkIcon, c: "createLink" },
        ].map(({ Icon, c }) => (
          <button
            key={c}
            onMouseDown={(e) => { e.preventDefault(); cmd(c); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 32,
              background: theme.color.surface,
              border: `1px solid ${theme.color.borderStrong}`,
              borderRadius: theme.radius.sm,
              color: theme.color.inkSoft,
              cursor: "pointer",
            }}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        style={{
          minHeight: 120,
          background: theme.color.surface,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.input,
          padding: "12px 14px",
          fontFamily: theme.font.body,
          fontSize: 14,
          lineHeight: 1.6,
          color: theme.color.ink,
          outline: "none",
        }}
      />
      <button
        onClick={save}
        disabled={saving}
        style={{
          marginTop: 16,
          border: "none",
          borderRadius: theme.radius.input,
          background: saved ? theme.color.green : theme.color.amber,
          color: theme.color.white,
          fontFamily: theme.font.condensed,
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "11px 22px",
          cursor: saving ? "wait" : "pointer",
        }}
      >
        {saved ? "Saved" : saving ? "Saving…" : "Save signature"}
      </button>
    </div>
  );
}

function Pad({ children }) {
  return (
    <div style={{ padding: 32, fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>{children}</div>
  );
}
