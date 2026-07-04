import { useState } from "react";
import { KeyRound } from "lucide-react";
import { supabase } from "../lib/supabase";
import { theme } from "../theme";
import { C, WASH, glass } from "../ui/theme";

// Shown when a user arrives via a reset / invite link (PASSWORD_RECOVERY). They
// already have a (recovery) session, so we just set a new password and continue.
export default function SetPasswordView({ onDone }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(error.message);
    onDone?.();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: WASH,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 400,
          ...glass(28),
          boxShadow: theme.shadow.raised,
          padding: "40px 34px 34px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            margin: "0 auto 22px",
            borderRadius: 18,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid rgba(255,255,255,0.08)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <KeyRound size={24} color={theme.color.amber} />
        </div>
        <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 28, color: theme.color.ink, lineHeight: 1 }}>
          SET YOUR PASSWORD
        </div>
        <div style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.22em", color: theme.color.slate, marginTop: 10, textTransform: "uppercase" }}>
          Choose a new password
        </div>

        <div style={{ height: 28 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="password"
            autoComplete="new-password"
            autoFocus
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={field}
            onFocus={(e) => (e.target.style.borderColor = theme.color.amber)}
            onBlur={(e) => (e.target.style.borderColor = theme.color.borderStrong)}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && submit()}
            style={field}
            onFocus={(e) => (e.target.style.borderColor = theme.color.amber)}
            onBlur={(e) => (e.target.style.borderColor = theme.color.borderStrong)}
          />
          <button onClick={submit} disabled={loading} style={btn(loading)}>
            {loading ? "Saving…" : "Save password & continue"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop: 16, fontFamily: theme.font.mono, fontSize: 12, color: theme.color.red }}>{error}</div>
        )}
      </div>
    </div>
  );
}

const field = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${theme.color.borderStrong}`,
  borderRadius: 14,
  color: theme.color.ink,
  padding: "15px 16px",
  fontFamily: theme.font.mono,
  fontSize: 15,
  outline: "none",
  transition: "border-color .15s ease",
};

const btn = (loading) => ({
  width: "100%",
  border: "none",
  borderRadius: 14,
  padding: "15px 16px",
  background: C.optimized,
  color: C.void,
  fontFamily: theme.font.condensed,
  fontWeight: 700,
  fontSize: 17,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  cursor: loading ? "wait" : "pointer",
  opacity: loading ? 0.75 : 1,
});
