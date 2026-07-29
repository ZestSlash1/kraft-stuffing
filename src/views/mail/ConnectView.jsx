import { useState } from "react";
import { Mail, ShieldCheck, Check, AlertTriangle } from "lucide-react";
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

// sessionStorage key for the OAuth anti-CSRF nonce — set here before redirecting to
// Microsoft, read back by OAuthCallbackView when the browser returns.
export const MS_OAUTH_STATE_KEY = "mail.msOAuthState";

// Provider presets prefill host/port/security; fields stay editable ("Custom" = blank).
// Outlook is oauth2-only and its servers are fixed — the UI hides the editable fields
// entirely for it (Microsoft retired basic auth for IMAP/POP3/SMTP on these mailboxes).
export const MAIL_PRESETS = {
  hostinger: { label: "Hostinger", auth_type: "password", incoming_protocol: "imap", imap_host: "imap.hostinger.com", imap_port: 993, imap_security: "ssl", smtp_host: "smtp.hostinger.com", smtp_port: 465, smtp_security: "ssl" },
  gmail: { label: "Gmail", auth_type: "password", incoming_protocol: "imap", imap_host: "imap.gmail.com", imap_port: 993, imap_security: "ssl", smtp_host: "smtp.gmail.com", smtp_port: 587, smtp_security: "starttls" },
  outlook: { label: "Outlook / Microsoft 365", auth_type: "oauth2", incoming_protocol: "imap", imap_host: "outlook.office365.com", imap_port: 993, imap_security: "ssl", smtp_host: "smtp.office365.com", smtp_port: 587, smtp_security: "starttls" },
  custom: { label: "Custom", auth_type: "password", incoming_protocol: "imap", imap_host: "", imap_port: 993, imap_security: "ssl", smtp_host: "", smtp_port: 465, smtp_security: "ssl" },
};

// Machine codes from connect.js/settings.js → which side of the config to fix.
export const CONN_CODE_LABELS = {
  auth_failed: "Sign-in rejected — check the email and password.",
  imap_failed: "Couldn't reach the IMAP server — check the incoming host, port, and security.",
  smtp_failed: "Couldn't reach the SMTP server — check the outgoing host, port, and security.",
  oauth_failed: "Microsoft sign-in didn't complete — try Connect with Microsoft again.",
};

// Editable IMAP or SMTP sub-panel. `conn`/`setConn` hold the flat connection object.
// `securityOptions` narrows the Security dropdown (POP3 has no STARTTLS support).
export function ConnGroup({ title, prefix, conn, setConn, securityOptions }) {
  const set = (k, v) => setConn((c) => ({ ...c, [`${prefix}_${k}`]: v }));
  const lbl = { fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.14em", color: theme.color.slate, textTransform: "uppercase", marginBottom: 4, display: "block" };
  const opts = securityOptions || ["ssl", "starttls", "none"];
  const OPT_LABEL = { ssl: "SSL / TLS", starttls: "STARTTLS", none: "None" };
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
            {opts.map((o) => <option key={o} value={o}>{OPT_LABEL[o]}</option>)}
          </select>
        </div>
      </div>
    </div>
  );
}

// Which security modes are valid for a given incoming protocol — POP3 clients here
// have no STARTTLS support, so it's SSL/TLS or plaintext only.
const incomingSecurityOptions = (protocol) => (protocol === "pop3" ? ["ssl", "none"] : ["ssl", "starttls", "none"]);

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

  const isOutlook = preset === "outlook";
  const isPop3 = conn.incoming_protocol === "pop3";

  const applyPreset = (key) => {
    setPreset(key);
    const { label, ...rest } = MAIL_PRESETS[key]; // eslint-disable-line no-unused-vars
    setConn(rest);
    setError("");
  };

  const setIncomingProtocol = (p) => {
    // POP3 has no STARTTLS — drop to 'ssl' if the current security mode won't fit.
    setConn((c) => ({
      ...c,
      incoming_protocol: p,
      imap_security: p === "pop3" && c.imap_security === "starttls" ? "ssl" : c.imap_security,
    }));
  };

  const submit = async () => {
    setError("");
    if (!email.includes("@") || !password) {
      setError("Enter your mailbox email and password.");
      return;
    }
    if (!conn.imap_host || !conn.smtp_host) {
      setError("Enter the incoming and outgoing server hosts.");
      return;
    }
    setLoading(true);
    try {
      const r = await mailApi.connect({
        email,
        password,
        display_name: displayName.trim() || email,
        color,
        incoming_protocol: conn.incoming_protocol,
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

  // Outlook has no password field — kick off the Microsoft consent redirect instead.
  // The nonce is stashed in sessionStorage and compared against Microsoft's returned
  // `state` by OAuthCallbackView (src/views/mail/OAuthCallbackView.jsx) when the
  // browser comes back to /mail-oauth-callback.
  const connectMicrosoft = async () => {
    setError("");
    setLoading(true);
    try {
      const { url, state } = await mailApi.oauthMicrosoftStart();
      sessionStorage.setItem(MS_OAUTH_STATE_KEY, state);
      window.location.href = url;
    } catch (e) {
      setError(CONN_CODE_LABELS[e.message] || e.message);
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
        Connect any IMAP/POP3/SMTP mailbox — pick a provider preset or enter custom servers.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Provider preset — decides the flow below (password fields vs. Microsoft sign-in). */}
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

        {isOutlook ? (
          <>
            <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, lineHeight: 1.6 }}>
              Outlook.com and Microsoft 365 mailboxes require signing in with Microsoft —
              stored passwords no longer work for these accounts.
            </div>
            <input
              type="text"
              placeholder="Display name (e.g. Kraft Operations)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onFocus={(e) => (e.target.style.borderColor = theme.color.amber)}
              onBlur={(e) => (e.target.style.borderColor = theme.color.border)}
              style={field}
            />
            <button
              onClick={connectMicrosoft}
              disabled={loading}
              style={{
                border: "none",
                borderRadius: theme.radius.input,
                background: "#2564cf",
                color: "#ffffff",
                fontFamily: theme.font.condensed,
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "0.04em",
                padding: "14px",
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Redirecting…" : "Connect with Microsoft"}
            </button>
          </>
        ) : (
          <>
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

            {/* Incoming protocol — POP3 has no server folders/persistent flags, so Move,
                Archive, Junk (with filter rules), and folder mapping are unavailable. */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.14em", color: theme.color.slate, textTransform: "uppercase" }}>
                Incoming
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                {["imap", "pop3"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setIncomingProtocol(p)}
                    style={{
                      border: `1px solid ${conn.incoming_protocol === p ? theme.color.amber : theme.color.border}`,
                      background: conn.incoming_protocol === p ? theme.color.amberSoft : "none",
                      borderRadius: theme.radius.sm,
                      color: conn.incoming_protocol === p ? theme.color.amberText : theme.color.inkSoft,
                      fontFamily: theme.font.mono,
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      padding: "6px 14px",
                      cursor: "pointer",
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            {isPop3 && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start", fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, lineHeight: 1.6, background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, padding: "10px 12px" }}>
                <AlertTriangle size={14} color={theme.color.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  POP3 mailboxes have no server-side folders or persistent flags — Move to
                  folder, Delete to Trash, Mark as junk (with filter rules), and Archive are
                  unavailable for this account. You can still read Inbox mail, send, and
                  permanently delete a message.
                </span>
              </div>
            )}

            <ConnGroup title={`Incoming (${isPop3 ? "POP3" : "IMAP"})`} prefix="imap" conn={conn} setConn={setConn} securityOptions={incomingSecurityOptions(conn.incoming_protocol)} />
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
          </>
        )}
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
        {isOutlook
          ? "Microsoft handles your sign-in directly — the Portal never sees or stores your password, only an encrypted access token."
          : "Your password is encrypted (AES-256-GCM) before storage and is only ever decrypted server-side to reach your mailbox. It is never shown again."}
      </div>
    </div>
  );
}
