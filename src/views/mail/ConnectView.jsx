import { useState } from "react";
import { Mail, ShieldCheck, Check } from "lucide-react";
import { theme } from "../../theme";
import { mailApi } from "../../lib/mailApi";
import { MAIL_COLORS, DEFAULT_MAIL_COLOR } from "./palette";

const field = {
  width: "100%",
  boxSizing: "border-box",
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.input,
  color: theme.color.ink,
  padding: "13px 14px",
  fontFamily: theme.font.mono,
  fontSize: 14,
  outline: "none",
};

// Hostinger IMAP/SMTP hosts + ports are fixed — only email + password are entered.
export default function ConnectView({ onConnected }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState(DEFAULT_MAIL_COLOR);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!email.includes("@") || !password) {
      setError("Enter your mailbox email and password.");
      return;
    }
    setLoading(true);
    try {
      const r = await mailApi.connect({
        email,
        password,
        display_name: displayName.trim() || email,
        color,
      });
      onConnected?.(r?.account);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 440, margin: "0 auto", padding: "56px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <Mail size={22} color={theme.color.amber} />
        <div
          style={{
            fontFamily: theme.font.condensed,
            fontWeight: 800,
            fontSize: 26,
            color: theme.color.ink,
            letterSpacing: "0.02em",
          }}
        >
          CONNECT YOUR MAILBOX
        </div>
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, marginBottom: 24 }}>
        Hostinger · imap.hostinger.com:993 · smtp.hostinger.com:465 (SSL/TLS)
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@shafrina.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = theme.color.amber)}
          onBlur={(e) => (e.target.style.borderColor = theme.color.border)}
          style={field}
        />
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Mailbox password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && submit()}
          onFocus={(e) => (e.target.style.borderColor = theme.color.amber)}
          onBlur={(e) => (e.target.style.borderColor = theme.color.border)}
          style={field}
        />
        <input
          type="text"
          placeholder="Display name (e.g. Kraft Operations)"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onFocus={(e) => (e.target.style.borderColor = theme.color.amber)}
          onBlur={(e) => (e.target.style.borderColor = theme.color.border)}
          style={field}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.14em", color: theme.color.slate, textTransform: "uppercase" }}>
            Accent
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {MAIL_COLORS.map((c) => {
              const active = c === color;
              return (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Accent ${c}`}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: c,
                    border: active ? `2px solid ${theme.color.ink}` : `2px solid transparent`,
                    boxShadow: active ? `0 0 0 2px ${c}` : "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                  }}
                >
                  {active && <Check size={13} color="#fff" />}
                </button>
              );
            })}
          </div>
        </div>
        <button
          onClick={submit}
          disabled={loading}
          style={{
            border: "none",
            borderRadius: theme.radius.input,
            background: theme.color.amber,
            color: theme.color.white,
            fontFamily: theme.font.condensed,
            fontWeight: 700,
            fontSize: 17,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "14px",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Connecting…" : "Connect"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 14, fontFamily: theme.font.mono, fontSize: 12, color: theme.color.red }}>
          {error}
        </div>
      )}

      <div
        style={{
          marginTop: 28,
          display: "flex",
          gap: 8,
          alignItems: "flex-start",
          fontFamily: theme.font.body,
          fontSize: 12,
          color: theme.color.slate,
          lineHeight: 1.5,
        }}
      >
        <ShieldCheck size={16} color={theme.color.green} style={{ flexShrink: 0, marginTop: 1 }} />
        Your password is encrypted (AES-256-GCM) before storage and is only ever decrypted
        server-side to reach your mailbox. It is never shown again.
      </div>
    </div>
  );
}
