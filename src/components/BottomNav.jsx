import { useState } from "react";
import { LayoutDashboard, Ship, ClipboardList, FileCheck2, Menu } from "lucide-react";
import { useRouter } from "../context/RouterContext";
import { useLive } from "../context/LiveContext";
import { theme } from "../theme";
import { C } from "../ui/theme";
import { NavDot } from "./TopNav";
import { SyncDot } from "./SyncPill";
import { MobileNavDrawer } from "./SideNav";

// Mobile bar: the highest-traffic routes + a "More" drawer that surfaces the
// full sectioned nav (same config as the desktop sidebar).
const ITEMS = [
  { key: "dashboard", label: "Home", Icon: LayoutDashboard, page: "dashboard" },
  { key: "voyages", label: "Voyages", Icon: Ship, page: "voyages" },
  { key: "bookings", label: "Bookings", Icon: ClipboardList, page: "manifest", params: { tab: "bookings" } },
  { key: "documents", label: "Docs", Icon: FileCheck2, page: "documents" },
];

// Which bar item lights up for the current page.
const GROUP = {
  dashboard: "dashboard",
  voyages: "voyages",
  "voyage-detail": "voyages",
  "container-log": "voyages",
  manifest: "bookings",
  documents: "documents",
  carting: "documents",
  "carting-detail": "documents",
};

export default function BottomNav() {
  const { route, navigate } = useRouter();
  const { dirty, mailUnread } = useLive();
  const [moreOpen, setMoreOpen] = useState(false);
  const activeGroup = GROUP[route.page];
  // Loadex dark variant app-wide (matches TopNav).
  const dark = true;

  return (
    <>
      <div
        className="bottom-nav"
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 56,
          paddingBottom: "env(safe-area-inset-bottom)",
          background: dark ? "rgba(4,10,14,0.92)" : "rgba(255,255,255,0.92)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: `1px solid ${dark ? C.hair : theme.color.border}`,
          display: "flex",
        }}
      >
        <SyncDot />
        {ITEMS.map(({ key, label, Icon, page, params }) => {
          const active = activeGroup === key;
          const color = active ? theme.color.amber : dark ? C.inkDim : theme.color.slate;
          const badge = dirty[page] ? -1 : 0;
          return (
            <button
              key={key}
              onClick={() => navigate(page, params || {})}
              style={{
                flex: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                color,
              }}
            >
              <span
                style={{
                  position: "relative",
                  display: "flex",
                  filter: active ? "drop-shadow(0 0 8px rgba(232,147,10,0.55))" : "none",
                }}
              >
                <Icon size={20} color={color} />
                <NavDot badge={badge} />
                {active && (
                  <span
                    style={{
                      position: "absolute",
                      bottom: -7,
                      left: "50%",
                      transform: "translateX(-50%)",
                      width: 4,
                      height: 4,
                      borderRadius: "50%",
                      background: theme.color.amber,
                    }}
                  />
                )}
              </span>
              <span
                style={{
                  fontFamily: theme.font.mono,
                  fontSize: 9,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color,
                }}
              >
                {label}
              </span>
            </button>
          );
        })}
        {/* "More" opens the full sectioned nav drawer. */}
        <button
          onClick={() => setMoreOpen(true)}
          style={{
            flex: 1,
            background: "none",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 3,
            color: dark ? C.inkDim : theme.color.slate,
          }}
        >
          <span style={{ position: "relative", display: "flex" }}>
            <Menu size={20} color={dark ? C.inkDim : theme.color.slate} />
            <NavDot badge={mailUnread} />
          </span>
          <span style={{ fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            More
          </span>
        </button>
      </div>

      <MobileNavDrawer open={moreOpen} onClose={() => setMoreOpen(false)} />
    </>
  );
}
