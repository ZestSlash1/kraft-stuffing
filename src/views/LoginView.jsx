import { useState } from "react";
import { supabase } from "../lib/supabase";
import { KRAFT_ORG_ID } from "../lib/db";
import { theme } from "../theme";

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 12,
  color: theme.color.ink,
  padding: "15px 16px",
  fontFamily: theme.font.mono,
  fontSize: 15,
  outline: "none",
};

const buttonBase = {
  width: "100%",
  border: "none",
  borderRadius: 12,
  padding: "15px 16px",
  fontFamily: theme.font.condensed,
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
        background: theme.color.canvas,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380, textAlign: "center" }}>
        <div
          style={{
            fontFamily: theme.font.condensed,
            fontWeight: 800,
            fontSize: 40,
            letterSpacing: "0.02em",
            color: theme.color.ink,
            lineHeight: 1,
          }}
        >
          KRAFT STUFFING LOG
        </div>
        <div
          style={{
            fontFamily: theme.font.mono,
            fontSize: 10,
            letterSpacing: "0.22em",
            color: theme.color.slate,
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
              onFocus={(e) => (e.target.style.borderColor = theme.color.amber)}
              onBlur={(e) => (e.target.style.borderColor = theme.color.border)}
              style={inputStyle}
            />
            <button
              onClick={sendOtp}
              disabled={loading}
              style={{
                ...buttonBase,
                background: theme.color.amber,
                color: theme.color.white,
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
            <div style={{ fontFamily: theme.font.mono, fontSize: 13, color: theme.color.slate }}>
              Check your email
            </div>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              placeholder="00000000"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 8))}
              onKeyDown={(e) => e.key === "Enter" && !loading && verifyOtp()}
              onFocus={(e) => (e.target.style.borderColor = theme.color.amber)}
              onBlur={(e) => (e.target.style.borderColor = theme.color.border)}
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
                background: theme.color.green,
                color: theme.color.white,
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
                color: theme.color.slate,
                fontFamily: theme.font.mono,
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
              fontFamily: theme.font.mono,
              fontSize: 12,
              color: theme.color.red,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
