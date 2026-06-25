import { useState } from "react";
import { supabase } from "../lib/supabase";
import { ensureProfile } from "../lib/db";

// Design tokens straight from CLAUDE.md (industrial: square corners, amber accent)
const VOID = "var(--void, #030508)";
const SURFACE = "var(--surface, #0a1020)";
const BORDER = "var(--border, #102030)";
const AMBER = "var(--amber, #e8930a)";
const STEEL = "var(--steel, #8a9aaa)";
const MONO = "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)";
const CONDENSED = "var(--font-condensed, 'Barlow Condensed', system-ui, sans-serif)";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 0,
  color: "#e2e8f0",
  padding: "14px 16px",
  fontFamily: MONO,
  fontSize: 15,
  outline: "none",
};

export default function AuthView() {
  const [step, setStep] = useState("email"); // 'email' | 'otp'
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const sendOtp = async () => {
    setError("");
    if (!email || !email.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setStep("otp");
  };

  const verifyOtp = async () => {
    setError("");
    if (token.length < 6) {
      setError("Enter the 6-digit code.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    // Create the profile row if this is a first sign-in (idempotent).
    if (data?.user) await ensureProfile(data.user);
    setLoading(false);
    // App's onAuthStateChange listener takes over from here.
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: VOID,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div
          style={{
            fontFamily: CONDENSED,
            fontWeight: 800,
            fontSize: 36,
            letterSpacing: "0.04em",
            color: "#e2e8f0",
            lineHeight: 1,
          }}
        >
          KRAFT STUFFING LOG
        </div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "0.2em",
            color: STEEL,
            marginTop: 8,
            textTransform: "uppercase",
          }}
        >
          stuff.shafrina.com
        </div>

        <div style={{ height: 48 }} />

        {step === "email" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && sendOtp()}
              onFocus={(e) => (e.target.style.borderColor = AMBER)}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
              style={inputStyle}
            />
            <button
              onClick={sendOtp}
              disabled={loading}
              style={{
                width: "100%",
                background: AMBER,
                color: VOID,
                border: "none",
                borderRadius: 0,
                padding: "14px 16px",
                fontFamily: CONDENSED,
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </div>
        )}

        {step === "otp" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: STEEL }}>
              Code sent to {email}
            </div>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={token}
              onChange={(e) =>
                setToken(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              onKeyDown={(e) => e.key === "Enter" && !loading && verifyOtp()}
              onFocus={(e) => (e.target.style.borderColor = AMBER)}
              onBlur={(e) => (e.target.style.borderColor = BORDER)}
              style={{ ...inputStyle, letterSpacing: "0.4em", textAlign: "center" }}
            />
            <button
              onClick={verifyOtp}
              disabled={loading}
              style={{
                width: "100%",
                background: AMBER,
                color: VOID,
                border: "none",
                borderRadius: 0,
                padding: "14px 16px",
                fontFamily: CONDENSED,
                fontWeight: 700,
                fontSize: 16,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Verifying…" : "Verify & Sign In"}
            </button>
            <button
              onClick={() => {
                setStep("email");
                setToken("");
                setError("");
              }}
              style={{
                background: "none",
                border: "none",
                color: STEEL,
                fontFamily: MONO,
                fontSize: 11,
                cursor: "pointer",
                padding: 4,
              }}
            >
              ← use a different email
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 14,
              fontFamily: MONO,
              fontSize: 11,
              color: "#ef4444",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
