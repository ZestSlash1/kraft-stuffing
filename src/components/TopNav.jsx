import { useEffect, useRef, useState } from "react";
import {
  LayoutGrid,
  LayoutDashboard,
  Ship,
  FileText,
  FileCheck2,
  Receipt,
  Activity,
  Mail,
  Users,
  Settings,
  Search,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { useRouter } from "../context/RouterContext";
import { useAuth } from "../context/AuthContext";
import { useLive } from "../context/LiveContext";
import { theme } from "../theme";
import { C } from "../ui/theme";
import SyncPill from "./SyncPill";

const NAV = [
  { page: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { page: "voyages", label: "Voyages", Icon: Ship },
  { page: "manifest", label: "Manifest", Icon: FileText },
  { page: "expenses", label: "Expenses", Icon: Receipt },
  { page: "documents", label: "Documents", Icon: FileCheck2 },
  { page: "activity", label: "Activity", Icon: Activity },
  { page: "mail", label: "Mail", Icon: Mail },
  { page: "masters", label: "Masters", Icon: Users },
  { page: "settings", label: "Settings", Icon: Settings },
];

// Which top-level item lights up for a given page.
const GROUP = {
  dashboard: "dashboard",
  voyages: "voyages",
  "voyage-detail": "voyages",
  "container-log": "voyages",
  masters: "masters",
  manifest: "manifest",
  expenses: "expenses",
  documents: "documents",
  activity: "activity",
  mail: "mail",
  settings: "settings",
};

export default function TopNav({ onOpenSearch }) {
  const { route, navigate, goPortal } = useRouter();
  const { user, profile } = useAuth();
  const { dirty, online, mailUnread } = useLive();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const activeGroup = GROUP[route.page] || "dashboard";
  // Loadex dark-marine variant: dashboard route only — every other screen keeps
  // the light nav. Presentational switch; all handlers identical in both modes.
  const dark = route.page === "dashboard";
  const displayName = profile?.displayName || (user?.email || "").split("@")[0] || "user";
  const title = profile?.title || (profile?.role === "admin" ? "Admin" : "Staff");
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

  const badgeFor = (page) => (page === "mail" ? mailUnread : dirty[page] ? -1 : 0);

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
        gap: 8,
      }}
    >
      {/* Left: logo + Portal */}
      <button
        onClick={() => navigate("dashboard")}
        style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 0 }}
      >
        <img src="/kraft-logo.png" height="34" alt="Kraft" style={{ display: "block" }} />
      </button>
      <button
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

      {/* Center: nav items (desktop) */}
      <div
        className="topnav-links"
        style={{
          display: "flex",
          gap: 2,
          margin: "0 auto",
          alignItems: "center",
          // Dark mode: the links group itself becomes the floating glass pill.
          ...(dark && {
            background: "rgba(255,255,255,0.04)",
            border: `1px solid ${C.hair}`,
            borderRadius: 999,
            padding: 3,
          }),
        }}
      >
        {NAV.map(({ page, label, Icon }) => {
          const active = activeGroup === page;
          const badge = badgeFor(page);
          const restColor = dark ? C.inkDim : theme.color.slate;
          const hoverColor = dark ? C.ink : theme.color.ink;
          return (
            <button
              key={page}
              onClick={() => navigate(page)}
              title={label}
              style={{
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 7,
                background: active ? (dark ? "#fff" : theme.color.amberSoft) : "transparent",
                border: "none",
                borderRadius: theme.radius.pill,
                color: active ? (dark ? C.void : "#b3700a") : restColor,
                fontFamily: theme.font.condensed,
                fontWeight: 700,
                fontSize: 13.5,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                padding: "8px 13px",
                cursor: "pointer",
                transition: "background .15s ease, color .15s ease",
              }}
              onMouseEnter={(e) => !active && (e.currentTarget.style.color = hoverColor)}
              onMouseLeave={(e) => !active && (e.currentTarget.style.color = restColor)}
            >
              <span style={{ position: "relative", display: "flex" }}>
                <Icon size={16} color={active ? (dark ? C.void : theme.color.amber) : "currentColor"} />
                <NavDot badge={badge} />
              </span>
              <span className="topnav-label">{label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: search + live presence + user */}
      <button
        onClick={onOpenSearch}
        title="Search (⌘K)"
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
        <Search size={16} />
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
        @media (max-width: 1100px) { .topnav-label { display: none !important; } }
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
