import { useCallback, useEffect, useRef, useState, Suspense, lazy } from "react";
import { Inbox, Send, PenSquare, Settings as SettingsIcon, ChevronDown, Plus, Layers, AlertTriangle, Ban, Archive as ArchiveIcon, Clock, FileText } from "lucide-react";
import gsap from "gsap";
import { C, F, SP, R, glass, WASH } from "../../ui/theme";
import { mailApi } from "../../lib/mailApi";
import { useRouter } from "../../context/RouterContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import InboxView from "./InboxView";
import ConnectView from "./ConnectView";
import MailSettingsView from "./MailSettingsView";
import OutboxView from "./OutboxView";
import TemplatesView from "./TemplatesView";

// Tiptap (compose's rich-text editor) is heavy — load it only once compose
// actually opens, so it lands in its own async chunk instead of the PWA's
// precached main bundle (2 MiB precache limit; see gen-icons build).
const ComposeModal = lazy(() => import("./compose/ComposeModal"));

const ALL = "all";
const STORE_KEY = "mail.selectedAccount";

// Deep-link params → the internal folder tab they land on (Follow-ups dashboard widget,
// nav badge click-through).
const VIEW_FOR_FOLDER = { INBOX: "inbox", Sent: "sent", Junk: "junk", Archive: "archive" };

export default function MailShell() {
  const { route } = useRouter();
  const isMobile = useIsMobile();
  const [sub, setSub] = useState(() => {
    const p = route?.params || {};
    return p.openUid ? { view: VIEW_FOR_FOLDER[p.folder] || "inbox", params: {} } : { view: "inbox", params: {} };
  });
  // Compose is a floating overlay, not a routed sub-view — null when closed,
  // { reply? } / { forward? } when open. route?.params?.compose opens it fresh on mount.
  const [composeState, setComposeState] = useState(() => (route?.params?.compose ? {} : null));
  const [accounts, setAccounts] = useState(null);
  const [limit, setLimit] = useState(4);
  const [selectedId, setSelectedId] = useState(() => {
    const p = route?.params || {};
    if (p.openUid && p.accountId) return p.accountId;
    try { return localStorage.getItem(STORE_KEY) || ALL; } catch { return ALL; }
  });
  // One-shot deep-link target for a specific message (Follow-ups widget / nav badge).
  // Consumed once by InboxView on mount, then left null.
  const [openTarget] = useState(() => {
    const p = route?.params || {};
    return p.openUid ? { accountId: p.accountId || null, folder: p.folder || "INBOX", uid: p.openUid } : null;
  });
  const sidebarRef = useRef(null);
  const contentRef = useRef(null);

  const go = useCallback((view, params = {}) => {
    // Animate content out → swap → in
    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.28, ease: "power2.out" }
      );
    }
    setSub({ view, params });
  }, []);

  const openCompose = useCallback((reply) => setComposeState(reply ? { reply } : {}), []);
  const openForward = useCallback((message) => setComposeState({ forward: message }), []);
  const closeCompose = useCallback(() => setComposeState(null), []);

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
    mailApi.listAccounts()
      .then((r) => { if (!alive) return; setAccounts(r.accounts || []); setLimit(r.limit || 4); })
      .catch(() => alive && setAccounts([]));
    return () => { alive = false; };
  }, []);

  // Sidebar entrance
  useEffect(() => {
    if (sidebarRef.current) {
      gsap.fromTo(sidebarRef.current, { x: -24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.45, ease: "power3.out" });
    }
  }, []);

  useEffect(() => {
    if (!accounts || selectedId === ALL) return;
    if (!accounts.some((a) => a.id === selectedId)) pickAccount(ALL);
  }, [accounts, selectedId, pickAccount]);

  const NAV = [
    { view: "inbox",    label: "Inbox",    Icon: Inbox },
    { view: "sent",     label: "Sent",     Icon: Send },
    { view: "junk",     label: "Junk",     Icon: Ban },
    { view: "archive",  label: "Archive",  Icon: ArchiveIcon },
    { view: "outbox",   label: "Outbox",   Icon: Clock },
    { view: "templates", label: "Templates", Icon: FileText },
    { view: "compose",  label: "Compose",  Icon: PenSquare },
    { view: "settings", label: "Settings", Icon: SettingsIcon },
  ];

  const effectiveAccountId =
    selectedId === ALL && accounts && accounts.length === 1 ? accounts[0].id : selectedId;
  const defaultAccount = accounts?.find((a) => a.is_default) || accounts?.[0] || null;
  const composeDefaultId = selectedId !== ALL ? selectedId : defaultAccount?.id || null;
  const selectedAccount = selectedId === ALL ? null : accounts?.find((a) => a.id === selectedId);
  const accountLabel = selectedAccount
    ? (selectedAccount.display_name || selectedAccount.email_address)
    : "All Inboxes";

  let content;
  if (accounts === null) {
    content = <Centered>Loading mailbox…</Centered>;
  } else if (accounts.length === 0 && sub.view !== "settings") {
    content = <ConnectView onConnected={async () => { const list = await refreshAccounts(); if (list[0]) pickAccount(list[0].id); go("inbox"); }} />;
  } else {
    switch (sub.view) {
      case "connect":
        content = <ConnectView onConnected={async (acct) => { await refreshAccounts(); if (acct?.id) pickAccount(acct.id); go("inbox"); }} />;
        break;
      case "sent":
        content = <InboxView folder="Sent" accountId={effectiveAccountId} accounts={accounts} onReply={openCompose} onForward={openForward} onFixAccount={() => go("settings")} openTarget={openTarget} />;
        break;
      case "junk":
        content = <InboxView folder="Junk" accountId={effectiveAccountId} accounts={accounts} onReply={openCompose} onForward={openForward} onFixAccount={() => go("settings")} openTarget={openTarget} />;
        break;
      case "archive":
        content = <InboxView folder="Archive" accountId={effectiveAccountId} accounts={accounts} onReply={openCompose} onForward={openForward} onFixAccount={() => go("settings")} openTarget={openTarget} />;
        break;
      case "outbox":
        content = <OutboxView accountId={effectiveAccountId} accounts={accounts} />;
        break;
      case "templates":
        content = <TemplatesView />;
        break;
      case "settings":
        content = <MailSettingsView accounts={accounts} limit={limit} onChanged={refreshAccounts} onAddAccount={() => go("connect")} />;
        break;
      default:
        content = <InboxView folder="INBOX" accountId={effectiveAccountId} accounts={accounts} onReply={openCompose} onForward={openForward} onFixAccount={() => go("settings")} openTarget={openTarget} />;
    }
  }

  const showSwitcher = accounts && accounts.length > 0;
  const composeModal = composeState && (
    <Suspense fallback={null}>
      <ComposeModal
        reply={composeState.reply}
        forward={composeState.forward}
        accounts={accounts}
        defaultAccountId={composeDefaultId}
        onSent={closeCompose}
        onClose={closeCompose}
        isMobile={isMobile}
      />
    </Suspense>
  );

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", background: WASH, fontFamily: F.mono }}>
        {/* Mobile top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: `${SP.md}px ${SP.lg}px`,
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 16, color: C.ink }}>
            {NAV.find((n) => n.view === sub.view)?.label || "Mail"}
          </span>
          {showSwitcher && (
            <AccountSwitcher accounts={accounts} limit={limit} selectedId={selectedId} accountLabel={accountLabel}
              onSelect={(id) => { pickAccount(id); if (sub.view === "connect") go("inbox"); }}
              onAdd={() => go("connect")} onFix={() => go("settings")} pill />
          )}
          <button onClick={openCompose}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: C.minor }}>
            <PenSquare size={20} />
          </button>
        </div>

        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div ref={contentRef} style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {content}
          </div>
        </div>

        {/* Mobile bottom nav */}
        <nav style={{ display: "flex", borderTop: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
          {NAV.filter((n) => n.view !== "compose").map(({ view, label, Icon }) => {
            const active = sub.view === view;
            return (
              <NavTab key={view} view={view} label={label} Icon={Icon} active={active} onClick={() => go(view)} />
            );
          })}
        </nav>
        {composeModal}
      </div>
    );
  }

  // Desktop
  return (
    <div style={{ display: "flex", height: "100%", background: WASH, fontFamily: F.mono }}>
      <aside ref={sidebarRef} style={{
        width: 220, flexShrink: 0,
        borderRight: `1px solid ${C.border}`,
        background: "rgba(10,16,32,0.4)",
        padding: `${SP.xl}px ${SP.md}px`,
        display: "flex", flexDirection: "column", gap: 2,
      }}>
        <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 18, color: C.ink, padding: `0 ${SP.sm}px ${SP.lg}px`, letterSpacing: "0.02em", textTransform: "uppercase" }}>
          Mail
        </div>

        {showSwitcher && (
          <AccountSwitcher accounts={accounts} limit={limit} selectedId={selectedId} accountLabel={accountLabel}
            onSelect={(id) => { pickAccount(id); if (sub.view === "connect") go("inbox"); }}
            onAdd={() => go("connect")} onFix={() => go("settings")} />
        )}

        <div style={{ height: SP.sm }} />

        {NAV.map(({ view, label, Icon }, i) => {
          const active = sub.view === view;
          return (
            <SideNavItem key={view} view={view} label={label} Icon={Icon} active={active} index={i}
              onClick={() => (view === "compose" ? openCompose() : go(view))} />
          );
        })}
      </aside>

      <div ref={contentRef} style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        {content}
      </div>
      {composeModal}
    </div>
  );
}

// Animated sidebar nav item
function SideNavItem({ label, Icon, active, onClick, index }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { x: -16, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.35, ease: "power2.out", delay: 0.08 + index * 0.06 }
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnter = () => {
    if (active || !ref.current) return;
    gsap.to(ref.current, { x: 3, duration: 0.18, ease: "power1.out" });
  };
  const handleLeave = () => {
    if (!ref.current) return;
    gsap.to(ref.current, { x: 0, duration: 0.18, ease: "power1.in" });
  };

  return (
    <button ref={ref} onClick={onClick} onMouseEnter={handleEnter} onMouseLeave={handleLeave}
      style={{
        display: "flex", alignItems: "center", gap: SP.md,
        background: active ? "rgba(59,163,255,0.12)" : "none",
        border: active ? `1px solid rgba(59,163,255,0.3)` : "1px solid transparent",
        borderRadius: R.chip,
        color: active ? C.minor : C.inkDim,
        fontFamily: F.mono, fontWeight: active ? 600 : 500, fontSize: 14,
        padding: `${SP.sm + 2}px ${SP.md}px`,
        cursor: "pointer", textAlign: "left",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <Icon size={16} strokeWidth={active ? 2.2 : 1.8} color={active ? C.minor : C.inkFaint} />
      {label}
      {active && (
        <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: C.minor }} />
      )}
    </button>
  );
}

// Mobile bottom nav tab with GSAP press feedback
function NavTab({ label, Icon, active, onClick }) {
  const ref = useRef(null);
  const handlePress = () => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { scale: 0.88 }, { scale: 1, duration: 0.3, ease: "back.out(2)" });
  };
  return (
    <button ref={ref} onClick={() => { handlePress(); onClick(); }}
      style={{
        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        background: "none", border: "none", padding: "10px 4px", cursor: "pointer",
        color: active ? C.minor : C.inkFaint,
        fontFamily: F.mono, fontSize: 11, fontWeight: active ? 600 : 400, minHeight: 44,
      }}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      {label}
      {active && <span style={{ width: 16, height: 2, borderRadius: 1, background: C.minor, marginTop: 1 }} />}
    </button>
  );
}

// Account switcher — pill for mobile, dropdown panel for desktop
function AccountSwitcher({ accounts, limit, selectedId, accountLabel, onSelect, onAdd, onFix, pill = false }) {
  const [open, setOpen] = useState(false);
  const dropRef = useRef(null);
  const selected = selectedId === ALL ? null : accounts.find((a) => a.id === selectedId);
  const canAdd = accounts.length < limit;

  useEffect(() => {
    if (!dropRef.current) return;
    if (open) {
      gsap.fromTo(dropRef.current,
        { opacity: 0, y: -8, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.22, ease: "power2.out" }
      );
    }
  }, [open]);

  const triggerStyle = pill
    ? { display: "flex", alignItems: "center", gap: SP.xs, background: "rgba(59,163,255,0.15)", border: "none", borderRadius: R.pill, padding: `${SP.xs}px ${SP.md}px`, cursor: "pointer", fontFamily: F.mono, fontWeight: 600, fontSize: 13, color: C.minor, maxWidth: 160, overflow: "hidden" }
    : { display: "flex", alignItems: "center", gap: SP.sm, width: "100%", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.hair}`, borderRadius: R.chip, padding: `${SP.sm}px ${SP.md}px`, cursor: "pointer", textAlign: "left", fontFamily: F.mono, marginBottom: SP.sm };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((v) => !v)} style={triggerStyle}>
        {!pill && (
          selected
            ? <span style={{ width: 8, height: 8, borderRadius: "50%", background: selected.color || C.minor, flexShrink: 0 }} />
            : <Layers size={13} color={C.inkDim} style={{ flexShrink: 0 }} />
        )}
        <span style={{ flex: pill ? undefined : 1, fontFamily: F.mono, fontWeight: 600, fontSize: 13, color: pill ? C.minor : C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {accountLabel}
        </span>
        <ChevronDown size={12} color={pill ? C.minor : C.inkDim} style={{ flexShrink: 0, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
          <div ref={dropRef} style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: pill ? undefined : 0, minWidth: 210, zIndex: 21, ...glass(R.chip), padding: 4 }}>
            <DropRow active={selectedId === ALL} onClick={() => { onSelect(ALL); setOpen(false); }}>
              <Layers size={13} color={C.inkDim} style={{ flexShrink: 0 }} />
              <span style={dropLabel}>All Inboxes</span>
            </DropRow>
            {accounts.map((a) => (
              <DropRow key={a.id} active={selectedId === a.id} onClick={() => { onSelect(a.id); setOpen(false); }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: a.status === "error" ? C.critical : (a.color || C.minor), flexShrink: 0 }} />
                <span style={{ ...dropLabel, flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.display_name || a.email_address}</span>
                  <span style={{ display: "block", fontFamily: F.mono, fontSize: 10, color: C.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email_address}</span>
                </span>
                {a.status === "error" && <AlertTriangle size={13} color={C.critical} style={{ flexShrink: 0 }} onClick={(e) => { e.stopPropagation(); setOpen(false); onFix(); }} />}
              </DropRow>
            ))}
            {canAdd && (
              <DropRow onClick={() => { setOpen(false); onAdd(); }}>
                <Plus size={13} color={C.minor} style={{ flexShrink: 0 }} />
                <span style={{ ...dropLabel, color: C.minor }}>Add account…</span>
              </DropRow>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const dropLabel = { fontFamily: F.mono, fontWeight: 500, fontSize: 13, color: C.ink };

function DropRow({ children, active, onClick }) {
  const ref = useRef(null);
  return (
    <button ref={ref} onClick={onClick}
      onMouseEnter={() => { if (ref.current && !active) gsap.to(ref.current, { x: 3, duration: 0.15, ease: "power1.out" }); }}
      onMouseLeave={() => { if (ref.current) gsap.to(ref.current, { x: 0, duration: 0.15, ease: "power1.in" }); }}
      style={{ display: "flex", alignItems: "center", gap: SP.sm, width: "100%", background: active ? "rgba(59,163,255,0.12)" : "none", border: "none", borderRadius: R.chip - 2, padding: `${SP.sm}px ${SP.sm}px`, cursor: "pointer", textAlign: "left" }}>
      {children}
    </button>
  );
}

function Centered({ children }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: F.mono, fontSize: 13, color: C.inkDim }}>
      {children}
    </div>
  );
}
