import { useEffect, useRef, useState } from "react";
import { LayoutGrid } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useRouter } from "../context/RouterContext";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme";

const LINKS = [
  { page: "dashboard", label: "Dashboard" },
  { page: "voyages", label: "Voyages" },
  { page: "masters", label: "Masters" },
  { page: "manifest", label: "Manifest" },
  { page: "expenses", label: "Expenses" },
  { page: "settings", label: "Settings" },
];

// Which top-level link should appear active for a given page.
const GROUP = {
  dashboard: "dashboard",
  voyages: "voyages",
  "voyage-detail": "voyages",
  "container-log": "voyages",
  masters: "masters",
  manifest: "manifest",
  expenses: "expenses",
  settings: "settings",
};

export default function TopNav() {
  const { route, navigate, goPortal } = useRouter();
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
        background: theme.color.surface,
        borderBottom: `1px solid ${theme.color.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 16px",
      }}
    >
      {/* Left: logo */}
      <button
        onClick={() => navigate("dashboard")}
        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: theme.color.surfaceMuted,
            borderRadius: "50%",
            padding: 2,
          }}
        >
          <img src="/kraft-logo.png" height="36" alt="Kraft" style={{ display: "block" }} />
        </span>
      </button>

      {/* Portal: jump back to the app launcher without signing out. */}
      <button
        onClick={goPortal}
        title="Portal — all sections"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.pill,
          color: theme.color.slate,
          fontFamily: theme.font.condensed,
          fontWeight: 700,
          fontSize: 12,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "6px 12px",
          marginLeft: 12,
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = theme.color.amber;
          e.currentTarget.style.color = theme.color.amber;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = theme.color.border;
          e.currentTarget.style.color = theme.color.slate;
        }}
      >
        <LayoutGrid size={15} />
        <span className="portal-btn-label">Portal</span>
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
                borderBottom: active ? `2px solid ${theme.color.amber}` : "2px solid transparent",
                color: active ? theme.color.amber : theme.color.slate,
                fontFamily: theme.font.condensed,
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
            style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}
          >
            {displayName}
          </span>
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: theme.color.amber,
              color: theme.color.white,
              fontFamily: theme.font.condensed,
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
              background: theme.color.surface,
              border: `1px solid ${theme.color.border}`,
              borderRadius: theme.radius.sm,
              minWidth: 140,
              boxShadow: theme.shadow.raised,
              zIndex: 200,
              overflow: "hidden",
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
                  color: label === "Sign out" ? theme.color.red : theme.color.ink,
                  fontFamily: theme.font.mono,
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
