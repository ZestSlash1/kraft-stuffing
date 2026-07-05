import { useState } from "react";
import { Mail, ShieldCheck, Check } from "lucide-react";
import { theme } from "../../theme";
import { glass } from "../../ui/theme";
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

// Provider presets prefill host/port/security; fields stay editable ("Custom" = blank).
export const MAIL_PRESETS = {
  hostinger: { label: "Hostinger", imap_host: "imap.hostinger.com", imap_port: 993, imap_security: "ssl", smtp_host: "smtp.hostinger.com", smtp_port: 465, smtp_security: "ssl" },
  gmail: { label: "Gmail", imap_host: "imap.gmail.com", imap_port: 993, imap_security: "ssl", smtp_host: "smtp.gmail.com", smtp_port: 587, smtp_security: "starttls" },
  custom: { label: "Custom", imap_host: "", imap_port: 993, imap_security: "ssl", smtp_host: "", smtp_port: 465, smtp_security: "ssl" },
};

// Machine codes from connect.js/settings.js → which side of the config to fix.
export const CONN_CODE_LABELS = {
  auth_failed: "Sign-in rejected — check the email and password.",
  imap_failed: "Couldn't reach the IMAP server — check the incoming host, port, and security.",
  smtp_failed: "Couldn't reach the SMTP server — check the outgoing host, port, and security.",
};

// Editable IMAP or SMTP sub-panel. `conn`/`setConn` hold the flat connection object.
export function ConnGroup({ title, prefix, conn, setConn }) {
  const set = (k, v) => setConn((c) => ({ ...c, [`${prefix}_${k}`]: v }));
  const lbl = { fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.14em", color: theme.color.slate, textTransform: "uppercase", marginBottom: 4, display: "block" };
  return (
    <div style={{ ...glass(theme.radius.input), padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", color: theme.color.ink, textTransform: "uppercase" }}>{title}</div>
      <div>
        <label style={lbl}>Host</label>
        <input value={conn[`${prefix}_host`]} onChange={(e) => set("host", e.target.value)} placeholder="mail.example.com" style={field} />
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: "0 0 96px" }}>
          <label style={lbl}>Port</label>
          <input inputMode="numeric" value={conn[`${prefix}_port`]} onChange={(e) => set("port", e.target.value.replace(/[^0-9]/g, ""))} style={field} />
        </div>
        <div style={{ flex: 1 }}>
          <label style={lbl}>Security</label>
          <select value={conn[`${prefix}_security`]} onChange={(e) => set("security", e.target.value)} style={{ ...field, appearance: "auto", cursor: "pointer" }}>
            <option value="ssl">SSL / TLS</option>
            <option value="starttls">STARTTLS</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>
    </div>
  );
}

// Provider host/port/security are per-account; a preset prefills them, then editable.
export default function ConnectView({ onConnected }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState(DEFAULT_MAIL_COLOR);
  const [preset, setPreset] = useState("hostinger");
  const [conn, setConn] = useState(() => {
    const { label, ...rest } = MAIL_PRESETS.hostinger; // eslint-disable-line no-unused-vars
    return rest;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const applyPreset = (key) => {
    setPreset(key);
    const { label, ...rest } = MAIL_PRESETS[key]; // eslint-disable-line no-unused-vars
    setConn(rest);
  };

  const submit = async () => {
    setError("");
    if (!email.includes("@") || !password) {
      setError("Enter your mailbox email and password.");
      return;
    }
    if (!conn.imap_host || !conn.smtp_host) {
      setError("Enter the incoming (IMAP) and outgoing (SMTP) server hosts.");
      return;
    }
    setLoading(true);
    try {
      const r = await mailApi.connect({
        email,
        password,
        display_name: displayName.trim() || email,
        color,
        imap_host: conn.imap_host,
        imap_port: Number(conn.imap_port),
        imap_security: conn.imap_security,
        smtp_host: conn.smtp_host,
        smtp_port: Number(conn.smtp_port),
        smtp_security: conn.smtp_security,
      });
      onConnected?.(r?.account);
    } catch (e) {
      setError(CONN_CODE_LABELS[e.message] || e.message);
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
        Connect any IMAP/SMTP mailbox — pick a provider preset or enter custom servers.
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
        {/* Provider preset — prefills the server fields below (still editable). */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.14em", color: theme.color.slate, textTransform: "uppercase" }}>
            Provider
          </span>
          <select
            value={preset}
            onChange={(e) => applyPreset(e.target.value)}
            style={{ ...field, width: "auto", flex: 1, appearance: "auto", cursor: "pointer" }}
          >
            {Object.entries(MAIL_PRESETS).map(([k, p]) => (
              <option key={k} value={k}>{p.label}</option>
            ))}
          </select>
        </div>

        <ConnGroup title="Incoming (IMAP)" prefix="imap" conn={conn} setConn={setConn} />
        <ConnGroup title="Outgoing (SMTP)" prefix="smtp" conn={conn} setConn={setConn} />

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
