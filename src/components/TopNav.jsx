import { useEffect, useRef, useState } from "react";
import { LayoutGrid, Search } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useRouter } from "../context/RouterContext";
import { useAuth } from "../context/AuthContext";
import { useLive } from "../context/LiveContext";
import { theme } from "../theme";
import { C } from "../ui/theme";
import SyncPill from "./SyncPill";

// Slim utility bar: page title + global search (opens ⌘K) + right cluster.
// The old pill route row moved into the sectioned SideNav — this bar is no
// longer where you navigate between sections.
const PAGE_TITLES = {
  dashboard: "Dashboard",
  voyages: "Voyages",
  "voyage-detail": "Voyage",
  "container-log": "Container Log",
  masters: "Masters",
  settings: "Settings",
  manifest: "Manifest",
  expenses: "Expenses",
  mail: "Mail",
  activity: "Activity Feed",
  documents: "Documents",
  carting: "Carting Orders",
  "carting-detail": "Carting Order",
};

export default function TopNav({ onOpenSearch }) {
  const { route, navigate, goPortal } = useRouter();
  const { user, profile } = useAuth();
  const { online } = useLive();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Loadex dark-marine variant, app-wide (LOADEX_UIUX_MASTER.md).
  const dark = true;
  const displayName = profile?.displayName || (user?.email || "").split("@")[0] || "user";
  const title = profile?.title || (profile?.role === "admin" ? "Admin" : "Staff");
  const initials = displayName.slice(0, 2).toUpperCase();
  const pageTitle = PAGE_TITLES[route.page] || "Kraft";

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
        height: 56,
        flexShrink: 0,
        background: dark ? "rgba(3,6,9,0.92)" : "rgba(255,255,255,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${dark ? C.hair : theme.color.border}`,
        display: "flex",
        alignItems: "center",
        padding: "0 14px",
        gap: 10,
      }}
    >
      {/* Mobile-only: logo + portal button (no sidebar on phones). */}
      <button
        className="topnav-logo"
        onClick={() => navigate("dashboard")}
        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0, flexShrink: 0 }}
      >
        <img src="/kraft-logo.png" height="30" alt="Kraft" style={{ display: "block" }} />
      </button>
      <button
        className="topnav-portal"
        onClick={goPortal}
        title="Portal — all sections"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          background: dark ? "rgba(255,255,255,0.06)" : theme.color.surfaceMuted,
          border: `1px solid ${dark ? C.hair : theme.color.border}`,
          borderRadius: dark ? 999 : 10,
          color: dark ? C.inkDim : theme.color.slate,
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        <LayoutGrid size={16} />
      </button>

      {/* Page title (desktop). */}
      <div
        className="topnav-title"
        style={{
          fontFamily: theme.font.condensed,
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: "0.03em",
          textTransform: "uppercase",
          color: dark ? C.ink : theme.color.ink,
          whiteSpace: "nowrap",
        }}
      >
        {pageTitle}
      </div>

      {/* Global search field — opens the ⌘K command palette. */}
      <button
        className="topnav-search"
        onClick={onOpenSearch}
        title="Search (⌘K)"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          margin: "0 auto",
          width: "min(420px, 42vw)",
          maxWidth: 420,
          height: 36,
          padding: "0 12px",
          background: dark ? "rgba(255,255,255,0.05)" : theme.color.surfaceMuted,
          border: `1px solid ${dark ? C.hair : theme.color.border}`,
          borderRadius: 999,
          color: dark ? C.inkDim : theme.color.slate,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <Search size={15} />
        <span className="topnav-search-label" style={{ fontFamily: theme.font.mono, fontSize: 12, letterSpacing: "0.02em", flex: 1 }}>
          Search voyages, containers, docs…
        </span>
        <span
          className="topnav-search-kbd"
          style={{
            fontFamily: theme.font.mono,
            fontSize: 10,
            letterSpacing: "0.06em",
            padding: "2px 6px",
            borderRadius: 6,
            border: `1px solid ${dark ? C.hair : theme.color.border}`,
            color: dark ? C.inkDim : theme.color.slate,
          }}
        >
          ⌘K
        </span>
      </button>

      <LivePill online={online} dark={dark} />
      <SyncPill />
      <div ref={menuRef} style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          style={{ display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer" }}
        >
          <span className="topnav-username" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.15 }}>
            <span style={{ fontFamily: theme.font.mono, fontSize: 12, color: dark ? C.ink : theme.color.ink }}>{displayName}</span>
            <span style={{ fontFamily: theme.font.mono, fontSize: 9, color: dark ? C.inkDim : theme.color.slate, letterSpacing: "0.04em" }}>{title}</span>
          </span>
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: profile?.role === "admin" ? (dark ? "#fff" : theme.color.ink) : theme.color.amber,
              color: profile?.role === "admin" && dark ? C.void : theme.color.white,
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
              top: 44,
              right: 0,
              background: dark ? C.surface : theme.color.surface,
              border: `1px solid ${dark ? C.border : theme.color.border}`,
              borderRadius: theme.radius.sm,
              minWidth: 150,
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
                  color: label === "Sign out" ? theme.color.red : dark ? C.ink : theme.color.ink,
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

      <style>{`
        @keyframes navPulse { 0% { box-shadow: 0 0 0 0 rgba(220,38,38,.45); } 70% { box-shadow: 0 0 0 5px rgba(220,38,38,0); } 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); } }
        @keyframes livePulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
        /* Desktop: the sidebar owns the logo/portal; hide the mobile duplicates. */
        @media (min-width: 768px) {
          .topnav-logo { display: none !important; }
          .topnav-portal { display: none !important; }
        }
        @media (max-width: 767px) {
          .topnav-title { display: none !important; }
          .topnav-search-label { display: none !important; }
          .topnav-search-kbd { display: none !important; }
          /* Collapse the search field to a round icon button on phones. */
          .topnav-search { width: 36px !important; padding: 0 !important; justify-content: center !important; margin: 0 0 0 auto !important; }
        }
      `}</style>
    </div>
  );
}

// badge: positive number = unread count; -1 = generic live dot; 0 = none.
export function NavDot({ badge }) {
  if (!badge) return null;
  const count = badge > 0 ? badge : null;
  return (
    <span
      style={{
        position: "absolute",
        top: -5,
        right: -6,
        minWidth: count ? 15 : 9,
        height: count ? 15 : 9,
        padding: count ? "0 3px" : 0,
        boxSizing: "border-box",
        borderRadius: 999,
        background: theme.color.red,
        color: theme.color.white,
        border: `1.5px solid ${theme.color.surface}`,
        fontFamily: theme.font.mono,
        fontSize: 9,
        fontWeight: 600,
        lineHeight: count ? "12px" : 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "navPulse 1.8s infinite",
      }}
    >
      {count && count < 100 ? count : count ? "99+" : ""}
    </span>
  );
}

// Small "LIVE · n" presence pill — green when others are online, grey when alone.
function LivePill({ online, dark = false }) {
  const others = Math.max(0, online - 1);
  const on = others > 0;
  const bg = dark
    ? on ? "rgba(18,184,134,0.12)" : "rgba(255,255,255,0.05)"
    : on ? theme.color.greenSoft : theme.color.surfaceMuted;
  const border = dark
    ? on ? "rgba(18,184,134,0.35)" : C.hair
    : on ? "#bfe0d3" : theme.color.border;
  const fg = dark
    ? on ? C.optimized : C.inkDim
    : on ? theme.color.green : theme.color.slate;
  return (
    <span
      title={on ? `${others} other ${others === 1 ? "person" : "people"} online` : "Realtime connected"}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: theme.radius.pill,
        padding: "5px 10px",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: dark ? (on ? C.optimized : C.inkFaint) : on ? theme.color.green : theme.color.slateFaint,
          animation: "livePulse 1.6s infinite",
        }}
      />
      <span
        className="livepill-label"
        style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.1em", color: fg }}
      >
        {on ? `LIVE · ${others}` : "LIVE"}
      </span>
    </span>
  );
}
