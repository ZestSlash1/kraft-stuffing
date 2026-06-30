import { useEffect, useRef, useState } from "react";
import { Ship, ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase";
import { KRAFT_ORG_ID } from "../lib/db";
import { theme } from "../theme";

// Passwordless login, reimagined as a single fluid motion:
//   email → (auto-sent) → 6-digit code that auto-submits on the last digit.
// No "Verify" button to hunt for; each step is exactly one action.
export default function LoginView() {
  const [step, setStep] = useState("email"); // 'email' | 'otp'
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const otpRef = useRef(null);

  const sendOtp = async () => {
    setError("");
    if (!email || !email.includes("@")) return setError("Enter a valid email address.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) return setError(error.message);
    setStep("otp");
  };

  const verifyOtp = async (code) => {
    const t = code ?? token;
    setError("");
    if (t.length < 6) return;
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: t, type: "email" });
    if (error) {
      setLoading(false);
      setToken("");
      setError("That code didn't match — try again.");
      otpRef.current?.focus();
      return;
    }
    if (data?.user) {
      const prefix = (data.user.email || email).split("@")[0];
      await supabase.from("profiles").upsert(
        { id: data.user.id, org_id: KRAFT_ORG_ID, display_name: prefix },
        { onConflict: "id", ignoreDuplicates: true }
      );
    }
    // onAuthStateChange swaps to the portal; keep the spinner until it does.
  };

  // Auto-submit the moment six digits are present (typed or pasted).
  useEffect(() => {
    if (step === "otp" && token.length === 6 && !loading) verifyOtp(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, step]);

  useEffect(() => {
    if (step === "otp") setTimeout(() => otpRef.current?.focus(), 350);
  }, [step]);

  return (
    <div style={{ position: "fixed", inset: 0, background: theme.color.canvas, overflow: "hidden" }}>
      <Aurora />
      <RouteMotif />

      <div
        style={{
          position: "relative",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <div
          key={step}
          style={{
            width: "100%",
            maxWidth: 400,
            background: "rgba(255,255,255,0.72)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            border: `1px solid ${theme.color.border}`,
            borderRadius: 28,
            boxShadow: theme.shadow.raised,
            padding: "40px 34px 34px",
            textAlign: "center",
            animation: "cardIn .55s cubic-bezier(.2,.8,.2,1) both",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 22px",
              borderRadius: 18,
              background: theme.color.ink,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: theme.shadow.card,
            }}
          >
            <Ship size={26} color={theme.color.amber} />
          </div>

          <div
            style={{
              fontFamily: theme.font.condensed,
              fontWeight: 800,
              fontSize: 30,
              letterSpacing: "0.01em",
              color: theme.color.ink,
              lineHeight: 1,
            }}
          >
            KRAFT PORTAL
          </div>
          <div
            style={{
              fontFamily: theme.font.mono,
              fontSize: 10,
              letterSpacing: "0.24em",
              color: theme.color.slate,
              marginTop: 10,
              textTransform: "uppercase",
            }}
          >
            {step === "email" ? "Sign in with your email" : `Code sent to ${email}`}
          </div>

          <div style={{ height: 30 }} />

          {step === "email" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && sendOtp()}
                style={fieldStyle}
                onFocus={(e) => (e.target.style.borderColor = theme.color.amber)}
                onBlur={(e) => (e.target.style.borderColor = theme.color.borderStrong)}
              />
              <button onClick={sendOtp} disabled={loading} style={primaryBtn(loading)}>
                {loading ? "Sending…" : "Continue"}
                {!loading && <ArrowRight size={18} />}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input
                ref={otpRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="••••••"
                value={token}
                disabled={loading}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{
                  ...fieldStyle,
                  textAlign: "center",
                  fontSize: 30,
                  letterSpacing: "0.6em",
                  paddingLeft: "0.6em",
                  opacity: loading ? 0.6 : 1,
                }}
                onFocus={(e) => (e.target.style.borderColor = theme.color.amber)}
                onBlur={(e) => (e.target.style.borderColor = theme.color.borderStrong)}
              />
              <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>
                {loading ? "Verifying…" : "Enter the 6-digit code — it submits automatically"}
              </div>
              <button
                onClick={() => {
                  setStep("email");
                  setToken("");
                  setError("");
                }}
                style={linkBtn}
              >
                ← Use a different email
              </button>
            </div>
          )}

          {error && (
            <div style={{ marginTop: 16, fontFamily: theme.font.mono, fontSize: 12, color: theme.color.red }}>
              {error}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes cardIn { from { opacity: 0; transform: translateY(16px) scale(.985); } to { opacity: 1; transform: none; } }
        @keyframes auroraA { 0%,100% { transform: translate(-8%, -6%) scale(1); } 50% { transform: translate(10%, 8%) scale(1.18); } }
        @keyframes auroraB { 0%,100% { transform: translate(8%, 10%) scale(1.1); } 50% { transform: translate(-10%, -8%) scale(1); } }
        @keyframes sail { from { offset-distance: 0%; } to { offset-distance: 100%; } }
        @keyframes dash { to { stroke-dashoffset: -28; } }
      `}</style>
    </div>
  );
}

const fieldStyle = {
  width: "100%",
  boxSizing: "border-box",
  background: theme.color.surface,
  border: `1px solid ${theme.color.borderStrong}`,
  borderRadius: 14,
  color: theme.color.ink,
  padding: "15px 16px",
  fontFamily: theme.font.mono,
  fontSize: 15,
  outline: "none",
  transition: "border-color .15s ease",
};

const primaryBtn = (loading) => ({
  width: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "none",
  borderRadius: 14,
  padding: "15px 16px",
  background: theme.color.amber,
  color: theme.color.white,
  fontFamily: theme.font.condensed,
  fontWeight: 700,
  fontSize: 18,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  cursor: loading ? "wait" : "pointer",
  opacity: loading ? 0.75 : 1,
});

const linkBtn = {
  background: "none",
  border: "none",
  color: theme.color.slate,
  fontFamily: theme.font.mono,
  fontSize: 12,
  cursor: "pointer",
  padding: 4,
};

// Two slow-drifting tinted blobs — subtle motion, never distracting.
function Aurora() {
  const blob = (color, anim, pos) => ({
    position: "absolute",
    width: 520,
    height: 520,
    borderRadius: "50%",
    filter: "blur(90px)",
    opacity: 0.5,
    background: color,
    animation: `${anim} 18s ease-in-out infinite`,
    ...pos,
  });
  return (
    <>
      <div style={blob("rgba(232,147,10,0.45)", "auroraA", { top: "-10%", left: "-6%" })} />
      <div style={blob("rgba(11,107,80,0.30)", "auroraB", { bottom: "-12%", right: "-8%" })} />
    </>
  );
}

// The real voyage as ambient branding: Kolkata → Port Blair with a drifting vessel
// tracing the dashed route. Anchored to the bottom, low-contrast.
function RouteMotif() {
  return (
    <svg
      viewBox="0 0 1000 200"
      preserveAspectRatio="none"
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, width: "100%", height: 200, opacity: 0.5 }}
    >
      <path
        id="kraft-route"
        d="M 120 150 C 360 60, 640 60, 880 150"
        fill="none"
        stroke={theme.color.borderStrong}
        strokeWidth="2"
        strokeDasharray="6 10"
        strokeLinecap="round"
        style={{ animation: "dash 1.4s linear infinite" }}
      />
      <Port cx={120} cy={150} label="KOLKATA" />
      <Port cx={880} cy={150} label="PORT BLAIR" />
      <g style={{ offsetPath: "path('M 120 150 C 360 60, 640 60, 880 150')", animation: "sail 9s ease-in-out infinite" }}>
        <circle r="9" fill={theme.color.surface} stroke={theme.color.amber} strokeWidth="2" />
        <circle r="3" fill={theme.color.amber} />
      </g>
    </svg>
  );
}

function Port({ cx, cy, label }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="5" fill={theme.color.amber} />
      <text
        x={cx}
        y={cy + 26}
        textAnchor="middle"
        fontFamily="'JetBrains Mono', monospace"
        fontSize="11"
        letterSpacing="2"
        fill={theme.color.slate}
      >
        {label}
      </text>
    </g>
  );
}
