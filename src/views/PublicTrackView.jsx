// PublicTrackView — the shell-free "where's my shipment" page (§A.4).
// Rendered directly from main.jsx for /t/:token, with NO auth context, NO app
// shell, and NO Supabase client. It fetches only /api/track/:token, whose
// response is an explicit field whitelist. Mobile-first; print-clean light card
// on a marine-tinted wash. No links back into the authed app.
import { useEffect, useState } from "react";

const NAVY = "#0f2438";
const STEEL = "#5a6b7d";
const AMBER = "#e8930a";
const GREEN = "#0b6b50";
const LINE = "#e2e8f0";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const COND = "'Barlow Condensed', system-ui, sans-serif";

const IST = { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" };
const fmtDate = (v) => {
  if (!v) return "";
  try {
    return new Date(v).toLocaleDateString("en-GB", IST);
  } catch {
    return "";
  }
};
const fmtStamp = (v) => {
  if (!v) return "";
  try {
    return new Date(v).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "";
  }
};

function tokenFromPath() {
  const m = window.location.pathname.match(/\/t\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

function Stepper({ timeline }) {
  return (
    <div style={{ position: "relative", paddingLeft: 4 }}>
      {timeline.map((m, i) => {
        const last = i === timeline.length - 1;
        const on = m.reached;
        const dot = on ? GREEN : "#cbd5e1";
        return (
          <div key={m.key} style={{ display: "flex", gap: 14, minHeight: last ? 34 : 54 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: on ? GREEN : "#fff",
                  border: `2px solid ${dot}`,
                  boxShadow: on ? `0 0 0 4px ${GREEN}18` : "none",
                  flexShrink: 0,
                }}
              />
              {!last && <div style={{ width: 2, flex: 1, background: on ? GREEN : LINE }} />}
            </div>
            <div style={{ paddingBottom: last ? 0 : 14, marginTop: -2 }}>
              <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 17, color: on ? NAVY : "#94a3b8", letterSpacing: "0.02em" }}>
                {m.label}
              </div>
              {m.reached && m.date && (
                <div style={{ fontFamily: MONO, fontSize: 11, color: STEEL, marginTop: 2 }}>{fmtDate(m.date)}</div>
              )}
              {!m.reached && m.expected && (
                <div style={{ fontFamily: MONO, fontSize: 11, color: AMBER, marginTop: 2 }}>
                  Expected {fmtDate(m.expected)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PublicTrackView() {
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    const token = tokenFromPath();
    if (!token) {
      setState({ status: "notfound", data: null });
      return;
    }
    let alive = true;
    fetch(`/api/track/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data) => alive && setState({ status: "ok", data }))
      .catch(() => alive && setState({ status: "notfound", data: null }));
    return () => {
      alive = false;
    };
  }, []);

  const wrap = {
    minHeight: "100vh",
    background: "linear-gradient(160deg, #eef3f8 0%, #e3edf5 40%, #dde8f2 100%)",
    padding: "28px 16px 48px",
    boxSizing: "border-box",
    fontFamily: "system-ui, sans-serif",
  };
  const card = {
    maxWidth: 440,
    margin: "0 auto",
    background: "#fff",
    borderRadius: 18,
    border: `1px solid ${LINE}`,
    boxShadow: "0 12px 40px rgba(15,36,56,0.10)",
    overflow: "hidden",
  };

  if (state.status === "loading") {
    return (
      <div style={wrap}>
        <div style={{ ...card, padding: 40, textAlign: "center", fontFamily: MONO, fontSize: 12, color: STEEL, letterSpacing: "0.2em" }}>
          LOADING…
        </div>
      </div>
    );
  }

  if (state.status === "notfound") {
    return (
      <div style={wrap}>
        <div style={{ ...card, padding: 44, textAlign: "center" }}>
          <img src="/kraft-logo.png" alt="Kraft" style={{ height: 44, marginBottom: 18, opacity: 0.85 }} />
          <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 22, color: NAVY }}>Link not found</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: STEEL, marginTop: 8, lineHeight: 1.6 }}>
            This tracking link is invalid or has been disabled.
          </div>
        </div>
      </div>
    );
  }

  const d = state.data;
  return (
    <div style={wrap}>
      <div style={card}>
        {/* Header — Kraft branding */}
        <div style={{ background: NAVY, padding: "22px 22px 20px", color: "#fff" }}>
          <img src="/kraft-logo.png" alt="Kraft Shipping & Logistics" style={{ height: 40, marginBottom: 14, filter: "brightness(0) invert(1)" }} />
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.22em", color: "#8fa6bd" }}>SHIPMENT TRACKING</div>
          <div style={{ fontFamily: COND, fontWeight: 800, fontSize: 30, letterSpacing: "0.01em", marginTop: 2 }}>{d.reference}</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: "#c3d2e0", marginTop: 6 }}>
            {(d.route?.pol || "—")} <span style={{ color: AMBER }}>→</span> {(d.route?.pod || "—")}
          </div>
        </div>

        {/* Vessel / voyage */}
        <div style={{ display: "flex", gap: 1, background: LINE, borderBottom: `1px solid ${LINE}` }}>
          {[
            ["VESSEL", d.vessel || "—"],
            ["VOYAGE", d.voyageNo || "—"],
            ["GROSS", d.grossKg != null ? `${(d.grossKg / 1000).toFixed(2)} MT` : "—"],
          ].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: "#fff", padding: "12px 14px" }}>
              <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: "0.14em", color: STEEL }}>{l}</div>
              <div style={{ fontFamily: COND, fontWeight: 700, fontSize: 16, color: NAVY, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: "22px 22px 8px" }}>
          {/* Timeline */}
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: STEEL, marginBottom: 16 }}>STATUS</div>
          <Stepper timeline={d.timeline || []} />

          {/* Containers */}
          {d.containers?.length > 0 && (
            <>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.16em", color: STEEL, margin: "22px 0 12px" }}>
                CONTAINERS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {d.containers.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      background: "#f6f9fc",
                      borderRadius: 10,
                      border: `1px solid ${LINE}`,
                    }}
                  >
                    <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, color: NAVY }}>{c.number}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontFamily: MONO, fontSize: 11, color: STEEL }}>{c.size}′</span>
                      {c.sealed && (
                        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: "0.08em", color: GREEN, border: `1px solid ${GREEN}`, borderRadius: 4, padding: "2px 6px" }}>
                          SEALED
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "18px 22px 22px", borderTop: `1px solid ${LINE}`, marginTop: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, color: STEEL, lineHeight: 1.7 }}>
            Kraft Shipping &amp; Logistics Pvt. Ltd., Kolkata
          </div>
          {d.lastUpdated && (
            <div style={{ fontFamily: MONO, fontSize: 10, color: "#9aa8b6", marginTop: 6 }}>
              Last updated {fmtStamp(d.lastUpdated)} IST
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
