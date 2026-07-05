import { useState } from "react";
import {
  LayoutDashboard,
  Ship,
  Anchor,
  ClipboardList,
  FileText,
  FileCheck2,
  ScrollText,
  Receipt,
  TrendingUp,
  Inbox,
  PenSquare,
  Activity,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import { useRouter } from "../context/RouterContext";
import { useLive } from "../context/LiveContext";
import { C, F, R, SP, GLOW, glass, label } from "../ui/theme";
import SyncPill from "./SyncPill";
import PresenceAvatars from "./PresenceAvatars";

// ─────────────────────────────────────────────────────────────────────────────
// SideNav — sectioned glass sidebar (desktop) + full-screen drawer (mobile).
// Both surfaces render from the SAME section config below, so the nav can only
// ever drift in one place. Every item maps to a REAL route in App.jsx's router
// (see AppShell's switch + the manifest/expenses/mail internal tabs) — no routes
// are invented here.
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_SECTIONS = [
  {
    title: "Operations",
    items: [
      { key: "dashboard", label: "Dashboard", Icon: LayoutDashboard, page: "dashboard" },
      { key: "voyages", label: "Voyages", Icon: Ship, page: "voyages" },
      { key: "movements", label: "Vessel Movements", Icon: Anchor, page: "manifest", params: { tab: "movements" } },
      { key: "bookings", label: "Bookings", Icon: ClipboardList, page: "manifest", params: { tab: "bookings" } },
      { key: "manifest", label: "Manifest", Icon: FileText, page: "manifest", params: { tab: "document" } },
    ],
  },
  {
    title: "Documents",
    items: [
      { key: "documents", label: "Documents", Icon: FileCheck2, page: "documents" },
      { key: "carting", label: "Carting Orders", Icon: ScrollText, page: "carting" },
    ],
  },
  {
    title: "Finance",
    items: [
      { key: "expenses", label: "Expenses", Icon: Receipt, page: "expenses", params: { tab: "ledger" } },
      { key: "pnl", label: "Voyage P&L", Icon: TrendingUp, page: "expenses", params: { tab: "pnl" } },
    ],
  },
  {
    title: "Mail",
    items: [
      { key: "inbox", label: "Inbox", Icon: Inbox, page: "mail", badge: "mail" },
      { key: "compose", label: "Compose", Icon: PenSquare, page: "mail", params: { compose: true } },
    ],
  },
  {
    title: "Insights",
    items: [{ key: "activity", label: "Activity Feed", Icon: Activity, page: "activity" }],
  },
];

// Pushed to the bottom, above the sync/presence strip.
export const NAV_FOOTER = [
  { key: "masters", label: "Masters", Icon: Users, page: "masters" },
  { key: "settings", label: "Settings", Icon: Settings, page: "settings" },
];

// Which nav item lights up for the current route. Several items share a page
// (manifest tabs, expenses tabs, mail views) — disambiguate on the params the
// sidebar itself passed through navigate().
export function activeKeyFor(route) {
  const p = route?.page;
  const t = route?.params?.tab;
  if (p === "manifest") return t === "bookings" ? "bookings" : t === "movements" ? "movements" : "manifest";
  if (p === "expenses") return t === "pnl" ? "pnl" : "expenses";
  if (p === "mail") return route?.params?.compose ? "compose" : "inbox";
  const map = {
    dashboard: "dashboard",
    voyages: "voyages",
    "voyage-detail": "voyages",
    "container-log": "voyages",
    documents: "documents",
    carting: "carting",
    "carting-detail": "carting",
    activity: "activity",
    masters: "masters",
    settings: "settings",
  };
  return map[p] || "dashboard";
}

// A single nav row, shared by the rail and the drawer.
function NavItem({ item, active, collapsed, onGo, mailUnread, dirty }) {
  const { Icon } = item;
  const badge = item.badge === "mail" ? mailUnread : dirty?.[item.page] ? -1 : 0;
  const [hover, setHover] = useState(false);
  const color = active ? C.ink : hover ? C.ink : C.inkDim;

  return (
    <button
      onClick={() => onGo(item)}
      title={collapsed ? item.label : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        minHeight: 40,
        padding: collapsed ? "0 0" : "0 12px",
        justifyContent: collapsed ? "center" : "flex-start",
        background: active ? "rgba(18,184,134,0.10)" : "transparent",
        border: "none",
        borderRadius: R.chip,
        color,
        fontFamily: F.head,
        fontWeight: active ? 700 : 600,
        fontSize: 14,
        letterSpacing: "0.02em",
        cursor: "pointer",
        transition: "background .15s ease, color .15s ease",
        textAlign: "left",
      }}
    >
      {/* 2px left accent bar on the active item (kept in the collapsed rail too). */}
      {active && (
        <span
          style={{
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 2,
            borderRadius: 2,
            background: C.optimized,
            boxShadow: GLOW.optimized,
          }}
        />
      )}
      <span style={{ position: "relative", display: "flex", flexShrink: 0 }}>
        <Icon size={18} color={active ? C.optimized : "currentColor"} />
        {badge !== 0 && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -6,
              minWidth: badge > 0 ? 15 : 8,
              height: badge > 0 ? 15 : 8,
              padding: badge > 0 ? "0 3px" : 0,
              boxSizing: "border-box",
              borderRadius: 999,
              background: C.critical,
              color: "#fff",
              border: `1.5px solid ${C.void}`,
              fontFamily: F.mono,
              fontSize: 9,
              fontWeight: 600,
              lineHeight: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: GLOW.minor,
            }}
          >
            {badge > 0 ? (badge < 100 ? badge : "99+") : ""}
          </span>
        )}
      </span>
      {!collapsed && <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.label}</span>}
    </button>
  );
}

// The section list body, reused verbatim by the rail and the drawer.
function NavBody({ collapsed, onGo, activeKey, mailUnread, dirty }) {
  return (
    <>
      {NAV_SECTIONS.map((section) => (
        <div key={section.title} style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: SP.md }}>
          {!collapsed && (
            <div style={{ ...label(), padding: `${SP.sm}px 12px ${SP.xs}px` }}>{section.title}</div>
          )}
          {section.items.map((item) => (
            <NavItem
              key={item.key}
              item={item}
              active={activeKey === item.key}
              collapsed={collapsed}
              onGo={onGo}
              mailUnread={mailUnread}
              dirty={dirty}
            />
          ))}
        </div>
      ))}
    </>
  );
}

// ── Desktop rail ─────────────────────────────────────────────────────────────
const COLLAPSE_KEY = "kraft-sidenav-collapsed";

export default function SideNav({ app }) {
  const { route, navigate, goPortal } = useRouter();
  const { dirty, mailUnread } = useLive();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const toggle = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // storage unavailable — collapse just won't persist
      }
      return next;
    });
  };

  const activeKey = activeKeyFor(route);
  const onGo = (item) => navigate(item.page, item.params || {});

  return (
    <nav
      className="side-nav"
      style={{
        width: collapsed ? 64 : 240,
        flexShrink: 0,
        height: "100%",
        ...glass(0),
        borderRadius: 0,
        borderRight: `1px solid ${C.hair}`,
        borderTop: "none",
        borderBottom: "none",
        borderLeft: "none",
        display: "flex",
        flexDirection: "column",
        transition: "width .18s ease",
        overflow: "hidden",
      }}
    >
      {/* Brand — click returns to the app launcher (AppSelectorView). */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: collapsed ? "14px 0" : "14px 16px",
          justifyContent: collapsed ? "center" : "space-between",
          borderBottom: `1px solid ${C.hair}`,
        }}
      >
        <button
          onClick={goPortal}
          title="All sections"
          style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, minWidth: 0 }}
        >
          <img src="/kraft-logo.png" height="30" alt="Kraft" style={{ display: "block", flexShrink: 0 }} />
          {!collapsed && (
            <span style={{ fontFamily: F.head, fontWeight: 800, fontSize: 15, letterSpacing: "0.04em", color: C.ink, whiteSpace: "nowrap" }}>
              KRAFT
            </span>
          )}
        </button>
        {!collapsed && (
          <button
            onClick={toggle}
            title="Collapse"
            style={{ display: "flex", background: "none", border: "none", color: C.inkDim, cursor: "pointer", padding: 4 }}
          >
            <ChevronLeft size={18} />
          </button>
        )}
      </div>

      {/* Sections (scroll if they overflow a short viewport). */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: `${SP.md}px ${collapsed ? SP.sm : SP.md}px` }}>
        <NavBody collapsed={collapsed} onGo={onGo} activeKey={activeKey} mailUnread={mailUnread} dirty={dirty} />
      </div>

      {/* Footer items pushed to the bottom, above the sync/presence strip. */}
      <div style={{ borderTop: `1px solid ${C.hair}`, padding: `${SP.sm}px ${collapsed ? SP.sm : SP.md}px`, display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_FOOTER.map((item) => (
          <NavItem
            key={item.key}
            item={item}
            active={activeKey === item.key}
            collapsed={collapsed}
            onGo={onGo}
            mailUnread={mailUnread}
            dirty={dirty}
          />
        ))}
      </div>

      {/* Sync + live presence strip. */}
      <div
        style={{
          borderTop: `1px solid ${C.hair}`,
          padding: collapsed ? "10px 0" : "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 10,
        }}
      >
        {collapsed ? (
          <button onClick={toggle} title="Expand" style={{ display: "flex", background: "none", border: "none", color: C.inkDim, cursor: "pointer", padding: 4 }}>
            <ChevronRight size={18} />
          </button>
        ) : (
          <>
            <SyncPill />
            <PresenceAvatars presenceMap={app?.presence} />
          </>
        )}
      </div>
    </nav>
  );
}

// ── Mobile full-screen drawer (triggered by BottomNav's "More"). ─────────────
export function MobileNavDrawer({ open, onClose }) {
  const { route, navigate, goPortal } = useRouter();
  const { dirty, mailUnread } = useLive();
  if (!open) return null;

  const activeKey = activeKeyFor(route);
  const onGo = (item) => {
    navigate(item.page, item.params || {});
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", background: "rgba(3,5,8,0.72)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}>
      <div
        style={{
          ...glass(0),
          borderRadius: 0,
          margin: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${C.hair}` }}>
          <button onClick={() => { goPortal(); onClose(); }} style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
            <img src="/kraft-logo.png" height="30" alt="Kraft" style={{ display: "block" }} />
            <span style={{ fontFamily: F.head, fontWeight: 800, fontSize: 16, letterSpacing: "0.04em", color: C.ink }}>KRAFT</span>
          </button>
          <button onClick={onClose} title="Close" style={{ display: "flex", background: "none", border: "none", color: C.inkDim, cursor: "pointer", padding: 6 }}>
            <X size={22} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px calc(24px + env(safe-area-inset-bottom))" }}>
          <NavBody collapsed={false} onGo={onGo} activeKey={activeKey} mailUnread={mailUnread} dirty={dirty} />
          <div style={{ borderTop: `1px solid ${C.hair}`, marginTop: SP.sm, paddingTop: SP.sm, display: "flex", flexDirection: "column", gap: 2 }}>
            {NAV_FOOTER.map((item) => (
              <NavItem key={item.key} item={item} active={activeKey === item.key} collapsed={false} onGo={onGo} mailUnread={mailUnread} dirty={dirty} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
