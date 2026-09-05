import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { theme } from "../../theme";
import { mailApi } from "../../lib/mailApi";
import { CONN_CODE_LABELS, MS_OAUTH_STATE_KEY } from "./ConnectView";

// Rendered instead of the whole app (see src/main.jsx) when Microsoft redirects back
// to /mail-oauth-callback?code=…&state=…. Runs as a normal authenticated page load —
// the user's Supabase session is still in localStorage from before the redirect, so
// this can call the completion endpoint with a normal bearer token like any other
// mail API call, no separate auth mechanism needed.
export default function OAuthCallbackView() {
  const [status, setStatus] = useState("working"); // 'working' | 'done' | 'error'
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const oauthError = params.get("error_description") || params.get("error");
      const expected = sessionStorage.getItem(MS_OAUTH_STATE_KEY);
      sessionStorage.removeItem(MS_OAUTH_STATE_KEY);

      if (oauthError) {
        if (alive) { setStatus("error"); setError(oauthError); }
        return;
      }
      if (!code || !state || state !== expected) {
        if (alive) { setStatus("error"); setError("This sign-in link is invalid or expired."); }
        return;
      }
      try {
        await mailApi.oauthMicrosoftComplete(code);
        if (alive) setStatus("done");
      } catch (e) {
        if (alive) { setStatus("error"); setError(CONN_CODE_LABELS[e.message] || e.message); }
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: theme.color.canvas, padding: 24 }}>
      <div style={{ maxWidth: 380, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        {status === "working" && (
          <>
            <Loader2 size={32} color={theme.color.amber} className="spin" style={{ animation: "spin 1s linear infinite" }} />
            <div style={{ fontFamily: theme.font.mono, fontSize: 13, color: theme.color.inkSoft }}>Finishing Microsoft sign-in…</div>
          </>
        )}
        {status === "done" && (
          <>
            <CheckCircle2 size={36} color={theme.color.green} />
            <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 18, color: theme.color.ink }}>Mailbox connected</div>
            <a href="/" style={{ fontFamily: theme.font.mono, fontSize: 13, color: theme.color.amberText }}>Back to Portal</a>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle size={36} color={theme.color.red} />
            <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 18, color: theme.color.ink }}>Couldn't connect</div>
            <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>{error}</div>
            <a href="/" style={{ fontFamily: theme.font.mono, fontSize: 13, color: theme.color.amberText }}>Back to Portal</a>
          </>
        )}
      </div>
      <style>{"@keyframes spin { to { transform: rotate(360deg); } }"}</style>
    </div>
  );
}
