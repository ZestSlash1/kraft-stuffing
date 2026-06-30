import { LayoutDashboard, Ship, Users, FileText, Receipt, Settings } from "lucide-react";
import { useRouter } from "../context/RouterContext";
import { theme } from "../theme";

const ITEMS = [
  { page: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { page: "voyages", label: "Voyages", Icon: Ship },
  { page: "masters", label: "Masters", Icon: Users },
  { page: "manifest", label: "Manifest", Icon: FileText },
  { page: "expenses", label: "Expenses", Icon: Receipt },
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
  settings: "settings",
};

export default function BottomNav() {
  const { route, navigate } = useRouter();
  const activeGroup = GROUP[route.page] || "dashboard";

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
        background: theme.color.surface,
        borderTop: `1px solid ${theme.color.border}`,
        display: "flex",
      }}
    >
      {ITEMS.map(({ page, label, Icon }) => {
        const active = activeGroup === page;
        const color = active ? theme.color.amber : theme.color.slate;
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
              gap: 4,
              color,
            }}
          >
            <Icon size={20} color={color} />
            <span
              style={{
                fontFamily: theme.font.mono,
                fontSize: 9,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color,
              }}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
