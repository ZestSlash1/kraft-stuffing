import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter } from "../context/RouterContext";
import { useAuth } from "../context/AuthContext";
import { TOKENS } from "../data/statusHelpers";

const LINKS = [
  { page: "dashboard", label: "Dashboard" },
  { page: "voyages", label: "Voyages" },
  { page: "masters", label: "Masters" },
  { page: "settings", label: "Settings" },
];

// Which top-level link should appear active for a given page.
const GROUP = {
  dashboard: "dashboard",
  voyages: "voyages",
  "voyage-detail": "voyages",
  "container-log": "voyages",
  masters: "masters",
  settings: "settings",
};

export default function TopNav() {
  const { route, navigate } = useRouter();
  const { user, profile } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const activeGroup = GROUP[route.page] || "dashboard";
  const displayName = profile?.displayName || (user?.email || "").split("@")[0] || "user";
  const initials = displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const signOut = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
  };

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        height: 52,
        flexShrink: 0,
        background: TOKENS.bg,
        borderBottom: `1px solid ${TOKENS.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
      }}
    >
      {/* Left: logo */}
      <button
        onClick={() => navigate("dashboard")}
        style={{ background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}
      >
        <div
          style={{
            fontFamily: TOKENS.condensed,
            fontWeight: 800,
            fontSize: 16,
            color: "#fff",
            lineHeight: 1,
            letterSpacing: "0.02em",
          }}
        >
          STUFFING LOG
        </div>
        <div
          style={{
            fontFamily: TOKENS.mono,
            fontSize: 9,
            color: TOKENS.steel,
            letterSpacing: "0.2em",
            marginTop: 2,
          }}
        >
          KRAFT
        </div>
      </button>

      {/* Center: nav links (desktop) */}
      <div className="topnav-links" style={{ display: "flex", gap: 4, margin: "0 auto" }}>
        {LINKS.map((l) => {
          const active = activeGroup === l.page;
          return (
            <button
              key={l.page}
              onClick={() => navigate(l.page)}
              style={{
                background: "none",
                border: "none",
                borderBottom: active ? `2px solid ${TOKENS.amber}` : "2px solid transparent",
                color: active ? TOKENS.amber : TOKENS.steel,
                fontFamily: TOKENS.condensed,
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                padding: "16px 12px",
                cursor: "pointer",
              }}
            >
              {l.label}
            </button>
          );
        })}
      </div>

      {/* Right: user */}
      <div ref={menuRef} style={{ position: "relative", marginLeft: "auto" }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span
            className="topnav-username"
            style={{ fontFamily: TOKENS.mono, fontSize: 12, color: TOKENS.steel }}
          >
            {displayName}
          </span>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: TOKENS.amber,
              color: TOKENS.bg,
              fontFamily: TOKENS.condensed,
              fontWeight: 800,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {initials}
          </span>
        </button>

        {menuOpen && (
          <div
            style={{
              position: "absolute",
              top: 40,
              right: 0,
              background: TOKENS.surface,
              border: `1px solid ${TOKENS.border}`,
              minWidth: 140,
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
              zIndex: 200,
            }}
          >
            {[
              ["Settings", () => { setMenuOpen(false); navigate("settings"); }],
              ["Sign out", signOut],
            ].map(([label, fn]) => (
              <button
                key={label}
                onClick={fn}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  color: label === "Sign out" ? TOKENS.red : "#e2e8f0",
                  fontFamily: TOKENS.mono,
                  fontSize: 12,
                  padding: "10px 14px",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
