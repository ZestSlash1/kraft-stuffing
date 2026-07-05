import { useCallback, useEffect, useState } from "react";
import { Inbox, Send, PenSquare, Settings as SettingsIcon, ChevronDown, Plus, Layers, AlertTriangle } from "lucide-react";
import { MC, MF, MSP, MR, mailCard, mailPill } from "../../ui/mailTheme";
import { mailApi } from "../../lib/mailApi";
import { useRouter } from "../../context/RouterContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import InboxView from "./InboxView";
import ConnectView from "./ConnectView";
import ComposeView from "./ComposeView";
import MailSettingsView from "./MailSettingsView";

const ALL = "all";
const STORE_KEY = "mail.selectedAccount";

export default function MailShell() {
  const { route } = useRouter();
  const isMobile = useIsMobile();
  const [sub, setSub] = useState({ view: route?.params?.compose ? "compose" : "inbox", params: {} });
  const [accounts, setAccounts] = useState(null);
  const [limit, setLimit] = useState(4);
  const [selectedId, setSelectedId] = useState(() => {
    try { return localStorage.getItem(STORE_KEY) || ALL; } catch { return ALL; }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const go = useCallback((view, params = {}) => { setSub({ view, params }); setMobileNavOpen(false); }, []);

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

  useEffect(() => {
    if (!accounts || selectedId === ALL) return;
    if (!accounts.some((a) => a.id === selectedId)) pickAccount(ALL);
  }, [accounts, selectedId, pickAccount]);

  const NAV = [
    { view: "inbox",   label: "Inbox",    Icon: Inbox },
    { view: "sent",    label: "Sent",     Icon: Send },
    { view: "compose", label: "Compose",  Icon: PenSquare },
    { view: "settings",label: "Settings", Icon: SettingsIcon },
  ];

  const effectiveAccountId =
    selectedId === ALL && accounts && accounts.length === 1 ? accounts[0].id : selectedId;
  const defaultAccount = accounts?.find((a) => a.is_default) || accounts?.[0] || null;
  const composeDefaultId =
    selectedId !== ALL ? selectedId : defaultAccount?.id || null;

  const selectedAccount = selectedId === ALL ? null : accounts?.find((a) => a.id === selectedId);
  const accountLabel = selectedAccount
    ? (selectedAccount.display_name || selectedAccount.email_address)
    : "All Inboxes";

  let content;
  if (accounts === null) {
    content = <Centered>Loading mailbox…</Centered>;
  } else if (accounts.length === 0 && sub.view !== "settings") {
    content = (
      <ConnectView
        onConnected={async () => {
          const list = await refreshAccounts();
          if (list[0]) pickAccount(list[0].id);
          go("inbox");
        }}
      />
    );
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

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: MC.canvas, fontFamily: MF.body }}>
        {/* Mobile top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: `${MSP.md}px ${MSP.lg}px`,
            background: MC.surface,
            borderBottom: `1px solid ${MC.border}`,
            flexShrink: 0,
          }}
        >
          {/* Left: current nav label */}
          <span style={{ fontFamily: MF.body, fontWeight: 600, fontSize: 16, color: MC.ink }}>
            {NAV.find((n) => n.view === sub.view)?.label || "Mail"}
          </span>

          {/* Center: account switcher pill */}
          {showSwitcher && (
            <AccountSwitcher
              accounts={accounts}
              limit={limit}
              selectedId={selectedId}
              accountLabel={accountLabel}
              onSelect={(id) => { pickAccount(id); if (sub.view === "connect") go("inbox"); }}
              onAdd={() => go("connect")}
              onFix={() => go("settings")}
              pill
            />
          )}

          {/* Right: compose shortcut */}
          <button
            onClick={() => go("compose")}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: MC.blue }}
          >
            <PenSquare size={20} />
          </button>
        </div>

        {/* Mobile bottom nav */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {content}
        </div>

        <nav
          style={{
            display: "flex",
            borderTop: `1px solid ${MC.border}`,
            background: MC.surface,
            flexShrink: 0,
          }}
        >
          {NAV.filter((n) => n.view !== "compose").map(({ view, label, Icon }) => {
            const active = sub.view === view;
            return (
              <button
                key={view}
                onClick={() => go(view)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  background: "none",
                  border: "none",
                  padding: "10px 4px",
                  cursor: "pointer",
                  color: active ? MC.blue : MC.inkFaint,
                  fontFamily: MF.body,
                  fontSize: 11,
                  fontWeight: active ? 600 : 400,
                  minHeight: 44,
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
                {label}
              </button>
            );
          })}
        </nav>
      </div>
    );
  }

  // Desktop layout
  return (
    <div style={{ display: "flex", height: "100%", background: MC.canvas, fontFamily: MF.body }}>
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: `1px solid ${MC.border}`,
          background: MC.surface,
          padding: `${MSP.xl}px ${MSP.md}px`,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <div
          style={{
            fontFamily: MF.body,
            fontWeight: 700,
            fontSize: 18,
            color: MC.ink,
            padding: `0 ${MSP.sm}px ${MSP.lg}px`,
            letterSpacing: "-0.01em",
          }}
        >
          Mail
        </div>

        {showSwitcher && (
          <AccountSwitcher
            accounts={accounts}
            limit={limit}
            selectedId={selectedId}
            accountLabel={accountLabel}
            onSelect={(id) => { pickAccount(id); if (sub.view === "connect") go("inbox"); }}
            onAdd={() => go("connect")}
            onFix={() => go("settings")}
          />
        )}

        <div style={{ height: MSP.sm }} />

        {NAV.map(({ view, label, Icon }) => {
          const active = sub.view === view;
          return (
            <button
              key={view}
              onClick={() => go(view)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: MSP.md,
                background: active ? MC.blueSoft : "none",
                border: "none",
                borderRadius: MR.chip,
                color: active ? MC.blue : MC.inkDim,
                fontFamily: MF.body,
                fontWeight: active ? 600 : 500,
                fontSize: 14,
                padding: `${MSP.sm + 2}px ${MSP.md}px`,
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} color={active ? MC.blue : MC.inkFaint} />
              {label}
            </button>
          );
        })}
      </aside>

      <div style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>{content}</div>
    </div>
  );
}

// Account switcher — pill variant for mobile top bar, dropdown for desktop rail
function AccountSwitcher({ accounts, limit, selectedId, accountLabel, onSelect, onAdd, onFix, pill = false }) {
  const [open, setOpen] = useState(false);
  const selected = selectedId === ALL ? null : accounts.find((a) => a.id === selectedId);
  const canAdd = accounts.length < limit;

  const triggerStyle = pill
    ? {
        display: "flex",
        alignItems: "center",
        gap: MSP.xs,
        background: MC.blueSoft,
        border: "none",
        borderRadius: MR.pill,
        padding: `${MSP.xs}px ${MSP.md}px`,
        cursor: "pointer",
        fontFamily: MF.body,
        fontWeight: 600,
        fontSize: 13,
        color: MC.blue,
        maxWidth: 160,
        overflow: "hidden",
      }
    : {
        display: "flex",
        alignItems: "center",
        gap: MSP.sm,
        width: "100%",
        background: MC.canvasAlt,
        border: `1px solid ${MC.border}`,
        borderRadius: MR.chip,
        padding: `${MSP.sm}px ${MSP.md}px`,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: MF.body,
        marginBottom: MSP.sm,
      };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={triggerStyle}>
        {!pill && (
          selected
            ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: selected.color || MC.blue, flexShrink: 0 }} />
            : <Layers size={13} color={MC.inkDim} style={{ flexShrink: 0 }} />
        )}
        <span
          style={{
            flex: pill ? undefined : 1,
            fontFamily: MF.body,
            fontWeight: 600,
            fontSize: 13,
            color: pill ? MC.blue : MC.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {accountLabel}
        </span>
        <ChevronDown size={12} color={pill ? MC.blue : MC.inkDim} style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: pill ? undefined : 0,
              minWidth: 200,
              zIndex: 21,
              marginTop: 4,
              ...mailCard(MR.chip),
              padding: 4,
            }}
          >
            <DropRow active={selectedId === ALL} onClick={() => { onSelect(ALL); setOpen(false); }}>
              <Layers size={13} color={MC.inkDim} style={{ flexShrink: 0 }} />
              <span style={dropLabel}>All Inboxes</span>
            </DropRow>
            {accounts.map((a) => (
              <DropRow key={a.id} active={selectedId === a.id} onClick={() => { onSelect(a.id); setOpen(false); }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.status === "error" ? MC.danger : (a.color || MC.blue), flexShrink: 0 }} />
                <span style={{ ...dropLabel, flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.display_name || a.email_address}
                  </span>
                  <span style={{ display: "block", fontFamily: MF.mono, fontSize: 10, color: MC.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.email_address}
                  </span>
                </span>
                {a.status === "error" && (
                  <AlertTriangle
                    size={13}
                    color={MC.danger}
                    style={{ flexShrink: 0 }}
                    onClick={(e) => { e.stopPropagation(); setOpen(false); onFix(); }}
                  />
                )}
              </DropRow>
            ))}
            {canAdd && (
              <DropRow onClick={() => { setOpen(false); onAdd(); }}>
                <Plus size={13} color={MC.blue} style={{ flexShrink: 0 }} />
                <span style={{ ...dropLabel, color: MC.blue }}>Add account…</span>
              </DropRow>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const dropLabel = {
  fontFamily: MF.body,
  fontWeight: 500,
  fontSize: 13,
  color: MC.ink,
};

function DropRow({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: MSP.sm,
        width: "100%",
        background: active ? MC.blueSoft : "none",
        border: "none",
        borderRadius: MR.chip - 2,
        padding: `${MSP.sm}px ${MSP.sm}px`,
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      {children}
    </button>
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
        fontFamily: MF.body,
        fontSize: 13,
        color: MC.inkDim,
      }}
    >
      {children}
    </div>
  );
}
