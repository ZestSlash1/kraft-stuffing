import { useEffect, useState } from "react";
import TopNav from "./TopNav";
import BottomNav from "./BottomNav";
import { useRouter } from "../context/RouterContext";
import { C, F, WASH, glass } from "../ui/theme";
import DashboardView from "../views/DashboardView";
import VoyagesView from "../views/VoyagesView";
import VoyageDetailView from "../views/VoyageDetailView";
import ContainerLogView from "../views/ContainerLogView";
import MastersView from "../views/MastersView";
import SettingsView from "../views/SettingsView";
import ManifestShell from "./ManifestShell";
import ExpensesShell from "../views/expenses/ExpensesShell";
import MailShell from "../views/mail/MailShell";
import ActivityFeedView from "../views/ActivityFeedView";
import DocumentsView from "../views/DocumentsView";
import CartingOrdersView from "../views/CartingOrdersView";
import CartingOrderDetailView from "../views/CartingOrderDetailView";
import CommandPalette from "./CommandPalette";

// Part 6E — persistent offline banner, dismissable, re-appears on next drop.
function OfflineIndicator() {
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false
  );
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setOffline(false);
      setDismissed(false);
    };
    const goOffline = () => {
      setOffline(true);
      setDismissed(false);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!offline || dismissed) return null;
  return (
    <div
      style={{
        flexShrink: 0,
        ...glass(0),
        background: "rgba(232,147,10,0.12)",
        borderBottom: `1px solid rgba(232,147,10,0.35)`,
        color: C.warning,
        fontFamily: F.mono,
        fontSize: 10,
        letterSpacing: "0.04em",
        padding: "6px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <span>● OFFLINE — changes are saved locally and will sync when reconnected</span>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: "none",
          border: "none",
          color: C.warning,
          cursor: "pointer",
          fontFamily: F.mono,
          fontSize: 12,
        }}
      >
        ✕
      </button>
    </div>
  );
}

export default function AppShell({ app }) {
  const { route } = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K toggles the command palette from anywhere in the shell.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  let content;
  switch (route.page) {
    case "voyages":
      content = <VoyagesView app={app} />;
      break;
    case "voyage-detail":
      content = <VoyageDetailView app={app} voyageId={route.params.voyageId} />;
      break;
    case "container-log":
      content = <ContainerLogView app={app} containerId={route.params.containerId} />;
      break;
    case "masters":
      content = <MastersView app={app} />;
      break;
    case "settings":
      content = <SettingsView app={app} />;
      break;
    case "manifest":
      content = <ManifestShell app={app} />;
      break;
    case "expenses":
      content = <ExpensesShell app={app} />;
      break;
    case "mail":
      content = <MailShell app={app} />;
      break;
    case "activity":
      content = <ActivityFeedView app={app} />;
      break;
    case "documents":
      content = <DocumentsView app={app} />;
      break;
    case "carting":
      content = <CartingOrdersView app={app} />;
      break;
    case "carting-detail":
      content = (
        <CartingOrderDetailView
          app={app}
          orderId={route.params.orderId}
          voyageId={route.params.voyageId}
        />
      );
      break;
    case "dashboard":
    default:
      content = <DashboardView app={app} />;
      break;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: WASH,
        color: C.ink,
      }}
    >
      <OfflineIndicator />
      <TopNav onOpenSearch={() => setSearchOpen(true)} />
      <div className="app-main" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {content}
      </div>
      <BottomNav onOpenSearch={() => setSearchOpen(true)} />
      <CommandPalette app={app} open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
