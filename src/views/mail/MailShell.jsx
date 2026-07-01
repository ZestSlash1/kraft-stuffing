import { useCallback, useEffect, useState } from "react";
import { Inbox, Send, PenSquare, Settings as SettingsIcon } from "lucide-react";
import { theme } from "../../theme";
import { mailApi } from "../../lib/mailApi";
import { useRouter } from "../../context/RouterContext";
import InboxView from "./InboxView";
import ConnectView from "./ConnectView";
import ComposeView from "./ComposeView";
import MailSettingsView from "./MailSettingsView";

// Mail has its own internal navigation (the app router only knows page="mail").
// sub: { view: 'inbox'|'sent'|'compose'|'settings', params }. Team management now
// lives in Settings (admin-only), not here.
export default function MailShell() {
  const { route } = useRouter();
  const [sub, setSub] = useState({ view: route?.params?.compose ? "compose" : "inbox", params: {} });
  const [connected, setConnected] = useState(null); // null = unknown, false/true known
  const go = useCallback((view, params = {}) => setSub({ view, params }), []);

  // On mount, find out whether this user has a mailbox connected.
  useEffect(() => {
    let alive = true;
    mailApi
      .getSettings()
      .then((s) => alive && setConnected(!!s.connected))
      .catch(() => alive && setConnected(false));
    return () => {
      alive = false;
    };
  }, []);

  const NAV = [
    { view: "inbox", label: "Inbox", Icon: Inbox },
    { view: "sent", label: "Sent", Icon: Send },
    { view: "compose", label: "Compose", Icon: PenSquare },
    { view: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  // Not connected yet → force the connect flow regardless of which view is picked.
  const forceConnect = connected === false && sub.view !== "settings";

  let content;
  if (connected === null) {
    content = <Centered>Loading mailbox…</Centered>;
  } else if (forceConnect) {
    content = <ConnectView onConnected={() => { setConnected(true); go("inbox"); }} />;
  } else {
    switch (sub.view) {
      case "sent":
        content = <InboxView folder="Sent" onReply={(msg) => go("compose", { reply: msg })} />;
        break;
      case "compose":
        content = <ComposeView reply={sub.params.reply} onSent={() => go("inbox")} />;
        break;
      case "settings":
        content = <MailSettingsView connected={connected} onConnect={() => go("inbox")} />;
        break;
      case "inbox":
      default:
        content = <InboxView folder="INBOX" onReply={(msg) => go("compose", { reply: msg })} />;
        break;
    }
  }

  return (
    <div className="mail-shell" style={{ display: "flex", height: "100%", background: theme.color.canvas }}>
      <aside
        style={{
          width: 200,
          flexShrink: 0,
          borderRight: `1px solid ${theme.color.border}`,
          background: theme.color.surface,
          padding: "16px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        <div
          style={{
            fontFamily: theme.font.mono,
            fontSize: 10,
            letterSpacing: "0.22em",
            color: theme.color.slate,
            textTransform: "uppercase",
            padding: "4px 10px 12px",
          }}
        >
          Mail
        </div>
        {NAV.map(({ view, label, Icon }) => {
          const active = sub.view === view;
          return (
            <button
              key={view}
              onClick={() => go(view)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                background: active ? theme.color.amberSoft : "none",
                border: "none",
                borderRadius: theme.radius.sm,
                color: active ? "#b3700a" : theme.color.inkSoft,
                fontFamily: theme.font.condensed,
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.03em",
                textTransform: "uppercase",
                padding: "10px 12px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Icon size={16} color={active ? theme.color.amber : theme.color.slate} />
              {label}
            </button>
          );
        })}
      </aside>
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{content}</div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: theme.font.mono,
        fontSize: 12,
        color: theme.color.slate,
        letterSpacing: "0.1em",
      }}
    >
      {children}
    </div>
  );
}
