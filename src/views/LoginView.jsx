import { useState } from "react";
import { supabase } from "../lib/supabase";
import { KRAFT_ORG_ID } from "../lib/db";
import { TOKENS } from "../data/statusHelpers";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: TOKENS.surface,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 0,
  color: "#e2e8f0",
  padding: "15px 16px",
  fontFamily: TOKENS.mono,
  fontSize: 15,
  outline: "none",
};

const buttonBase = {
  width: "100%",
  border: "none",
  borderRadius: 0,
  padding: "15px 16px",
  fontFamily: TOKENS.condensed,
  fontWeight: 700,
  fontSize: 18,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export default function LoginView() {
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
    if (error) return setError(error.message);
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
      setError("Invalid code — try again");
      return;
    }
    // First login: upsert profile row for this org.
    if (data?.user) {
      const prefix = (data.user.email || email).split("@")[0];
      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          org_id: KRAFT_ORG_ID,
          display_name: prefix,
        },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }
    setLoading(false);
    // App's onAuthStateChange listener swaps to the AppShell.
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: TOKENS.bg,
        backgroundImage:
          "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.012) 1px, rgba(255,255,255,0.012) 2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div
          style={{
            fontFamily: TOKENS.condensed,
            fontWeight: 800,
            fontSize: 40,
            letterSpacing: "0.02em",
            color: "#e8eef4",
            lineHeight: 1,
          }}
        >
          KRAFT STUFFING LOG
        </div>
        <div
          style={{
            fontFamily: TOKENS.mono,
            fontSize: 10,
            letterSpacing: "0.22em",
            color: TOKENS.steel,
            marginTop: 10,
          }}
        >
          stuff.shafrina.com
        </div>

        <div style={{ height: 64 }} />

        {step === "email" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && sendOtp()}
              onFocus={(e) => (e.target.style.borderColor = TOKENS.amber)}
              onBlur={(e) => (e.target.style.borderColor = TOKENS.border)}
              style={inputStyle}
            />
            <button
              onClick={sendOtp}
              disabled={loading}
              style={{
                ...buttonBase,
                background: TOKENS.amber,
                color: TOKENS.bg,
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Sending…" : "Send OTP"}
            </button>
          </div>
        )}

        {step === "otp" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontFamily: TOKENS.mono, fontSize: 13, color: TOKENS.steel }}>
              Check your email
            </div>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && !loading && verifyOtp()}
              onFocus={(e) => (e.target.style.borderColor = TOKENS.amber)}
              onBlur={(e) => (e.target.style.borderColor = TOKENS.border)}
              style={{
                ...inputStyle,
                letterSpacing: "0.5em",
                textAlign: "center",
                fontSize: 26,
              }}
            />
            <button
              onClick={verifyOtp}
              disabled={loading}
              style={{
                ...buttonBase,
                background: TOKENS.green,
                color: "#eef7ff",
                cursor: loading ? "wait" : "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Verifying…" : "Verify"}
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
                color: TOKENS.steel,
                fontFamily: TOKENS.mono,
                fontSize: 12,
                cursor: "pointer",
                padding: 4,
              }}
            >
              ← Back
            </button>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: 16,
              fontFamily: TOKENS.mono,
              fontSize: 12,
              color: TOKENS.red,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
