import { useCallback, useEffect, useState } from "react";
import { Inbox, Send, PenSquare, Settings as SettingsIcon, ChevronDown, Plus, Layers, AlertTriangle } from "lucide-react";
import { theme } from "../../theme";
import { mailApi } from "../../lib/mailApi";
import { useRouter } from "../../context/RouterContext";
import InboxView from "./InboxView";
import ConnectView from "./ConnectView";
import ComposeView from "./ComposeView";
import MailSettingsView from "./MailSettingsView";

const ALL = "all";
const STORE_KEY = "mail.selectedAccount";

// Mail has its own internal navigation (the app router only knows page="mail").
// sub: { view: 'inbox'|'sent'|'compose'|'settings'|'connect', params }.
export default function MailShell() {
  const { route } = useRouter();
  const [sub, setSub] = useState({ view: route?.params?.compose ? "compose" : "inbox", params: {} });
  const [accounts, setAccounts] = useState(null); // null = unknown; [] = none connected
  const [limit, setLimit] = useState(4);
  const [selectedId, setSelectedId] = useState(() => {
    try { return localStorage.getItem(STORE_KEY) || ALL; } catch { return ALL; }
  });
  const go = useCallback((view, params = {}) => setSub({ view, params }), []);

  const pickAccount = useCallback((id) => {
    setSelectedId(id);
    try { localStorage.setItem(STORE_KEY, id); } catch { /* private mode */ }
  }, []);

  const refreshAccounts = useCallback(async () => {
    try {
      const r = await mailApi.listAccounts();
      setAccounts(r.accounts || []);
      setLimit(r.limit || 4);
      return r.accounts || [];
    } catch {
      setAccounts([]);
      return [];
    }
  }, []);

  useEffect(() => {
    let alive = true;
    mailApi
      .listAccounts()
      .then((r) => {
        if (!alive) return;
        setAccounts(r.accounts || []);
        setLimit(r.limit || 4);
      })
      .catch(() => alive && setAccounts([]));
    return () => { alive = false; };
  }, []);

  // If the persisted selection points at a since-removed account, fall back to All.
  useEffect(() => {
    if (!accounts || selectedId === ALL) return;
    if (!accounts.some((a) => a.id === selectedId)) pickAccount(ALL);
  }, [accounts, selectedId, pickAccount]);

  const NAV = [
    { view: "inbox", label: "Inbox", Icon: Inbox },
    { view: "sent", label: "Sent", Icon: Send },
    { view: "compose", label: "Compose", Icon: PenSquare },
    { view: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  // Effective account id passed to fetching views: 'all' or a concrete id.
  const effectiveAccountId = selectedId;
  const defaultAccount = accounts?.find((a) => a.is_default) || accounts?.[0] || null;
  // The account compose should send from by default (single selection, else default).
  const composeDefaultId =
    selectedId !== ALL ? selectedId : defaultAccount?.id || null;

  let content;
  if (accounts === null) {
    content = <Centered>Loading mailbox…</Centered>;
  } else if (accounts.length === 0 && sub.view !== "settings") {
    // No mailbox yet → force the connect flow.
    content = <ConnectView onConnected={async () => { const list = await refreshAccounts(); if (list[0]) pickAccount(list[0].id); go("inbox"); }} />;
  } else {
    switch (sub.view) {
      case "connect":
        content = (
          <ConnectView
            onConnected={async (acct) => {
              await refreshAccounts();
              if (acct?.id) pickAccount(acct.id);
              go("inbox");
            }}
          />
        );
        break;
      case "sent":
        content = (
          <InboxView
            folder="Sent"
            accountId={effectiveAccountId}
            accounts={accounts}
            onReply={(msg) => go("compose", { reply: msg })}
            onFixAccount={() => go("settings")}
          />
        );
        break;
      case "compose":
        content = (
          <ComposeView
            reply={sub.params.reply}
            accounts={accounts}
            defaultAccountId={composeDefaultId}
            onSent={() => go("inbox")}
          />
        );
        break;
      case "settings":
        content = (
          <MailSettingsView
            accounts={accounts}
            limit={limit}
            onChanged={refreshAccounts}
            onAddAccount={() => go("connect")}
          />
        );
        break;
      case "inbox":
      default:
        content = (
          <InboxView
            folder="INBOX"
            accountId={effectiveAccountId}
            accounts={accounts}
            onReply={(msg) => go("compose", { reply: msg })}
            onFixAccount={() => go("settings")}
          />
        );
        break;
    }
  }

  const showSwitcher = accounts && accounts.length > 0;

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

        {showSwitcher && (
          <AccountSwitcher
            accounts={accounts}
            limit={limit}
            selectedId={selectedId}
            onSelect={(id) => { pickAccount(id); if (sub.view === "connect") go("inbox"); }}
            onAdd={() => go("connect")}
            onFix={() => go("settings")}
          />
        )}

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
                color: active ? "#e8930a" : theme.color.inkSoft,
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

// Glass dropdown at the top of the rail: All inboxes · each account · Add account…
function AccountSwitcher({ accounts, limit, selectedId, onSelect, onAdd, onFix }) {
  const [open, setOpen] = useState(false);
  const selected = selectedId === ALL ? null : accounts.find((a) => a.id === selectedId);
  const canAdd = accounts.length < limit;

  return (
    <div style={{ position: "relative", padding: "0 4px 10px", marginBottom: 6, borderBottom: `1px solid ${theme.color.border}` }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          background: theme.color.surfaceMuted,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.sm,
          padding: "8px 10px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {selected ? (
          <Dot color={selected.color} status={selected.status} />
        ) : (
          <Layers size={13} color={theme.color.slate} style={{ flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontFamily: theme.font.condensed,
              fontWeight: 700,
              fontSize: 13,
              color: theme.color.ink,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {selected ? selected.display_name || selected.email_address : "All inboxes"}
          </span>
          {selected && (
            <span
              style={{
                display: "block",
                fontFamily: theme.font.mono,
                fontSize: 9,
                color: theme.color.slate,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selected.email_address}
            </span>
          )}
        </span>
        <ChevronDown size={13} color={theme.color.slate} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 4,
              right: 4,
              zIndex: 21,
              marginTop: 4,
              background: theme.color.surface,
              border: `1px solid ${theme.color.borderStrong}`,
              borderRadius: theme.radius.sm,
              boxShadow: theme.shadow.card,
              padding: 4,
              overflow: "hidden",
            }}
          >
            <Row active={selectedId === ALL} onClick={() => { onSelect(ALL); setOpen(false); }}>
              <Layers size={13} color={theme.color.slate} style={{ flexShrink: 0 }} />
              <span style={rowLabel}>All inboxes</span>
            </Row>
            {accounts.map((a) => (
              <Row key={a.id} active={selectedId === a.id} onClick={() => { onSelect(a.id); setOpen(false); }}>
                <Dot color={a.color} status={a.status} />
                <span style={{ ...rowLabel, minWidth: 0, flex: 1 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.display_name || a.email_address}
                  </span>
                  <span style={{ display: "block", fontFamily: theme.font.mono, fontSize: 9, color: theme.color.slate, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.email_address}
                  </span>
                </span>
                {a.status === "error" && (
                  <AlertTriangle
                    size={13}
                    color={theme.color.red}
                    style={{ flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); setOpen(false); onFix(); }}
                  />
                )}
              </Row>
            ))}
            {canAdd && (
              <Row onClick={() => { setOpen(false); onAdd(); }}>
                <Plus size={13} color={theme.color.amber} style={{ flexShrink: 0 }} />
                <span style={{ ...rowLabel, color: theme.color.amberText }}>Add account…</span>
              </Row>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const rowLabel = {
  fontFamily: theme.font.condensed,
  fontWeight: 700,
  fontSize: 13,
  color: theme.color.ink,
  letterSpacing: "0.02em",
};

function Row({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        background: active ? theme.color.amberSoft : "none",
        border: "none",
        borderRadius: theme.radius.sm,
        padding: "8px 8px",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {children}
    </button>
  );
}

function Dot({ color, status }) {
  const c = status === "error" ? theme.color.red : color || theme.color.slate;
  return (
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: c,
        flexShrink: 0,
        boxShadow: status === "error" ? `0 0 0 2px ${theme.color.redSoft}` : "none",
      }}
    />
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
