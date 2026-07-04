import { LayoutDashboard, Ship, FileText, Receipt, Mail, Settings, Search } from "lucide-react";
import { useRouter } from "../context/RouterContext";
import { useLive } from "../context/LiveContext";
import { theme } from "../theme";
import { C } from "../ui/theme";
import { NavDot } from "./TopNav";
import { SyncDot } from "./SyncPill";

// Mobile bar: the most-used sections + Mail. Masters lives in the desktop bar /
// portal only, to keep the phone bar to six tappable targets.
const ITEMS = [
  { page: "dashboard", label: "Home", Icon: LayoutDashboard },
  { page: "voyages", label: "Voyages", Icon: Ship },
  { page: "manifest", label: "Manifest", Icon: FileText },
  { page: "expenses", label: "Expenses", Icon: Receipt },
  { page: "mail", label: "Mail", Icon: Mail },
  { page: "settings", label: "Settings", Icon: Settings },
];

const GROUP = {
  dashboard: "dashboard",
  voyages: "voyages",
  "voyage-detail": "voyages",
  "container-log": "voyages",
  masters: "masters",
  manifest: "manifest",
  expenses: "expenses",
  mail: "mail",
  settings: "settings",
};

export default function BottomNav({ onOpenSearch }) {
  const { route, navigate } = useRouter();
  const { dirty, mailUnread } = useLive();
  const activeGroup = GROUP[route.page] || "dashboard";
  // Loadex dark variant app-wide (matches TopNav).
  const dark = true;

  return (
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
      {ITEMS.map(({ page, label, Icon }) => {
        const active = activeGroup === page;
        const color = active ? theme.color.amber : dark ? C.inkDim : theme.color.slate;
        const badge = page === "mail" ? mailUnread : dirty[page] ? -1 : 0;
        return (
          <button
            key={page}
            onClick={() => navigate(page)}
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
      <button
        onClick={onOpenSearch}
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
        <Search size={20} color={dark ? C.inkDim : theme.color.slate} />
        <span style={{ fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Search
        </span>
      </button>
    </div>
  );
}
