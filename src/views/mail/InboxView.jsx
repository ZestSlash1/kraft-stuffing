import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, CornerUpLeft, CornerUpRight, AlertTriangle, Paperclip, Search, X, MoreVertical, Trash2, Archive, FolderInput, Ban, CheckSquare, Square, Star, Inbox as InboxIcon, BellRing, Clock as ClockIcon } from "lucide-react";
import gsap from "gsap";
import { C, F, SP, R, glass } from "../../ui/theme";
import { mailApi } from "../../lib/mailApi";
import { useMailList } from "../../lib/mailCache";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useToast } from "../../components/Toast";
import { formatRelative, formatAbsolute } from "../../lib/format";
import { useRouter } from "../../context/RouterContext";
import { globalSearch, ROUTE_FOR } from "../../lib/search";
import DocViewer from "../../components/DocViewer";
import ReminderControl from "./ReminderControl";

// Map a mail-action error code (or raw message) to a user-facing sentence.
function actionErrorText(e) {
  const m = (e?.message || "").toLowerCase();
  if (m.includes("no_trash_folder")) return "No Trash folder is set for this account — configure it in Mail Settings.";
  if (m.includes("no_junk_folder")) return "No Junk folder is set for this account — configure it in Mail Settings.";
  if (m.includes("no_archive_folder")) return "No Archive folder is set for this account — configure it in Mail Settings.";
  if (m.includes("already_moved")) return "This message was already moved.";
  return e?.message || "Action failed";
}

const FOLDER_TITLE = { INBOX: "Inbox", Sent: "Sent", Junk: "Junk", Archive: "Archive" };

const REF_RE = /\b[A-Z]{4}\d{7}\b|\bKRAFT\/(?:HBL|AN|DO)\/\d{4}\/\d{4}\b/g;

function RefText({ text, onRef, style }) {
  if (!text) return null;
  const parts = String(text).split(REF_RE);
  const refs = String(text).match(REF_RE) || [];
  if (refs.length === 0) return <span style={style}>{text}</span>;
  const out = [];
  parts.forEach((p, i) => {
    out.push(<span key={`t${i}`}>{p}</span>);
    if (refs[i] !== undefined)
      out.push(
        <span key={`r${i}`}
          onClick={(e) => { e.stopPropagation(); onRef(refs[i]); }}
          style={{ fontFamily: F.mono, color: C.minor, textDecoration: "underline", textDecorationColor: C.minor, textDecorationThickness: 1, cursor: "pointer" }}>
          {refs[i]}
        </span>
      );
  });
  return <span style={style}>{out}</span>;
}

const ERR_LABEL = { auth_failed: "sign-in failed", timeout: "timed out", sync_failed: "couldn't sync" };

// Stable per-row identity — a message is unique by (account, uid), not uid alone (the
// "All Inboxes" merge can show the same UID from two different accounts).
const rowKey = (m) => `${m.accountId || "one"}-${m.uid}`;
const sameMsg = (a, b) => a.uid === b.uid && a.accountId === b.accountId;

// Bucket a flat message list by account so a batched action (Delete/Move/Junk) that
// spans accounts fires one server call per account rather than one per message.
function groupByAccount(msgs) {
  const map = new Map();
  for (const m of msgs) {
    const arr = map.get(m.accountId) || [];
    arr.push(m);
    map.set(m.accountId, arr);
  }
  return map;
}

export default function InboxView({ folder = "INBOX", accountId = null, accounts = [], onReply, onForward, onFixAccount, openTarget = null }) {
  // Stale-while-revalidate: cached list paints instantly on account/folder switch,
  // a background refresh updates it silently. `loading` is true only on a cold read.
  const { data, loading, error, refresh, patchMessages } = useMailList(folder, accountId);
  const messages = data?.messages || [];
  const errors = data?.errors || {};
  const respAccounts = data?.accounts || null;
  const [selected, setSelected] = useState(null);
  const [loadingBody, setLoadingBody] = useState(false);
  const [bodyError, setBodyError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [viewerDoc, setViewerDoc] = useState(null);
  const [movePicker, setMovePicker] = useState(null); // { msgs } while the Move-to sheet is open
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(() => new Set());
  const [reminders, setReminders] = useState(new Map()); // message_id -> {id, mode, remind_at, status}
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const { navigate } = useRouter();
  const listRef = useRef(null);
  const paneRef = useRef(null);
  const headerRef = useRef(null);

  const isAll = accountId === "all";
  const isJunkView = folder === "Junk";
  const isArchiveView = folder === "Archive";
  const accountMap = useMemo(() => {
    const map = {};
    (accounts || []).forEach((a) => { map[a.id] = a; });
    (respAccounts || []).forEach((a) => { map[a.id] = { ...map[a.id], ...a }; });
    return map;
  }, [accounts, respAccounts]);

  const openRef = async (ref) => {
    const { rows } = await globalSearch(ref, { voyages: [], shippers: [], consignees: [], expenses: [] });
    const hit = rows?.[0];
    if (!hit) return;
    const target = ROUTE_FOR[hit.type] || { page: "dashboard" };
    navigate(target.page, target.param ? { [target.param]: hit.id } : {});
  };

  // Clear the open message + any in-progress selection when switching folder/account
  // (cache handles the list).
  useEffect(() => {
    setSelected(null);
    setSelectMode(false);
    setSelectedKeys(new Set());
  }, [folder, accountId]);

  // Active (pending, non-void) reminders/snoozes for this user, across every account —
  // loaded once (reminders aren't folder-scoped) and refreshed after any change. Used to
  // hide snoozed-not-yet-due threads and badge rows/the open thread with their state.
  const loadReminders = useCallback(() => {
    mailApi.activeReminders()
      .then((r) => setReminders(new Map((r.reminders || []).map((x) => [x.message_id, x]))))
      .catch(() => {});
  }, []);
  useEffect(() => { loadReminders(); }, [loadReminders]);

  const toggleSelect = useCallback((m) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      const k = rowKey(m);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  // Stagger-animate message rows when list loads
  useEffect(() => {
    if (loading || !listRef.current) return;
    const rows = listRef.current.querySelectorAll(".mail-row");
    if (rows.length === 0) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    gsap.fromTo(rows,
      { opacity: 0, y: 14 },
      { opacity: 1, y: 0, duration: 0.32, stagger: 0.045, ease: "power2.out", clearProps: "transform,opacity" }
    );
  }, [loading, messages.length]);

  // Animate header on mount
  useEffect(() => {
    if (!headerRef.current) return;
    gsap.fromTo(headerRef.current, { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: "power2.out" });
  }, []);

  const open = (m) => {
    setLoadingBody(true);
    setBodyError("");
    const threadAccountId = m.accountId || (isAll ? null : accountId);
    mailApi.thread(m.uid, folder, threadAccountId)
      .then((msg) => {
        setSelected(msg);
        patchMessages((prev) => prev.map((x) => (x.uid === m.uid && x.accountId === m.accountId ? { ...x, seen: true } : x)));
        // Animate reading pane in
        if (paneRef.current) {
          const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (!prefersReduced) {
            gsap.fromTo(paneRef.current, { opacity: 0, x: 18 }, { opacity: 1, x: 0, duration: 0.3, ease: "power2.out" });
          }
        }
      })
      .catch((e) => setBodyError(e.message))
      .finally(() => setLoadingBody(false));
  };

  // One-shot deep-link (Follow-ups dashboard widget / nav badge click-through): open a
  // specific message straight into the reading pane once this view matches its folder.
  const openedTargetRef = useRef(false);
  useEffect(() => {
    if (openedTargetRef.current || !openTarget || openTarget.folder !== folder) return;
    openedTargetRef.current = true;
    open({ uid: openTarget.uid, accountId: openTarget.accountId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTarget, folder]);

  // ── Message actions (Delete / Archive / Move / Junk / Star) ─────────────────
  // The optimistic pattern mirrors runWrite elsewhere: remove from the list now, fire
  // the server IMAP move, and revert on failure. `folder` (INBOX|Sent) is the mirror key.
  const removeFromList = useCallback((m) => {
    patchMessages((prev) => prev.filter((x) => !sameMsg(x, m)));
    setSelected((s) => (s && s.uid === m.uid && (s.accountId ?? m.accountId) === m.accountId ? null : s));
  }, [patchMessages]);
  const reinsertToList = useCallback((m) => {
    patchMessages((prev) => {
      if (prev.some((x) => sameMsg(x, m))) return prev;
      return [...prev, m].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    });
  }, [patchMessages]);

  // After an undo (server moved the message back), the mirror is stale until the next
  // sync — pull fresh so the restored message shows its real (new) UID.
  const resync = useCallback((acctId) => {
    mailApi.sync(acctId).then(() => refresh()).catch(() => {});
  }, [refresh]);

  // Generic "move N messages out of the list via `mover`" — shared by Delete/Archive.
  // `mover(acctId, uids, folder)` performs the server-side move; the toast/undo copy
  // and the undo target folder differ per action.
  const doMoveOutMany = useCallback((msgs, { mover, verb, targetLabel }) => {
    if (!msgs.length) return;
    msgs.forEach(removeFromList);
    const groups = groupByAccount(msgs);
    const undoGroups = [];
    let pending = groups.size;
    let anyErr = false;
    groups.forEach((list, acctId) => {
      mover(acctId, list.map((m) => m.uid), folder)
        .then((r) => undoGroups.push({ accountId: acctId, target: r.target, newUidByOld: r.newUidByOld || {}, msgs: list }))
        .catch((e) => {
          anyErr = true;
          if (!(e?.message || "").includes("already_moved")) list.forEach(reinsertToList);
          else resync(acctId);
          showToast(actionErrorText(e), "error");
        })
        .finally(() => {
          if (--pending > 0) return;
          const label = msgs.length > 1 ? `${verb} ${msgs.length} messages${targetLabel ? ` to ${targetLabel}` : ""}` : `${verb}${targetLabel ? ` to ${targetLabel}` : ""}`;
          if (!anyErr) {
            showToast(label, {
              type: "success", duration: 7000,
              action: {
                label: "Undo",
                onClick: () => {
                  undoGroups.forEach(({ accountId: gAcctId, target, newUidByOld, msgs: gm }) => {
                    const uids = gm.map((m) => newUidByOld[m.uid]).filter((u) => u != null);
                    if (!uids.length) return;
                    mailApi
                      .moveMessage(gAcctId, uids, target, folder === "INBOX" ? "INBOX" : folder)
                      .then(() => { gm.forEach(reinsertToList); resync(gAcctId); })
                      .catch((e) => showToast(actionErrorText(e), "error"));
                  });
                },
              },
            });
          }
        });
    });
  }, [folder, removeFromList, reinsertToList, resync, showToast]);

  const doDeleteMany = useCallback((msgs) =>
    doMoveOutMany(msgs, { mover: mailApi.deleteMessage, verb: "Moved", targetLabel: "Trash" }),
    [doMoveOutMany]);
  const doDelete = useCallback((m) => doDeleteMany([m]), [doDeleteMany]);

  const doArchiveMany = useCallback((msgs) =>
    doMoveOutMany(msgs, { mover: mailApi.archiveMessage, verb: "Archived", targetLabel: "" }),
    [doMoveOutMany]);
  const doArchive = useCallback((m) => doArchiveMany([m]), [doArchiveMany]);

  // Mark N messages (any mix of accounts) as junk; one standing rule is created per
  // distinct sender within each account (server-side, in mark-junk).
  const doJunkMany = useCallback((msgs) => {
    if (!msgs.length) return;
    msgs.forEach(removeFromList);
    const groups = groupByAccount(msgs);
    const senders = new Set(msgs.map((m) => m.from?.address || m.from?.name).filter(Boolean));
    let pending = groups.size;
    let anyErr = false;
    groups.forEach((list, acctId) => {
      mailApi
        .markJunk(acctId, list.map((m) => m.uid), folder)
        .catch((e) => {
          anyErr = true;
          if (!(e?.message || "").includes("already_moved")) list.forEach(reinsertToList);
          else resync(acctId);
        })
        .finally(() => {
          if (--pending > 0) return;
          const senderText = senders.size === 1 ? [...senders][0] : `${senders.size} senders`;
          showToast(
            anyErr
              ? "Some messages could not be marked as junk"
              : `Marked as junk. Future mail from ${senderText} will be moved here automatically.`,
            { type: anyErr ? "error" : "success", duration: 7000 }
          );
        });
    });
  }, [folder, removeFromList, reinsertToList, resync, showToast]);
  const doJunk = useCallback((m) => doJunkMany([m]), [doJunkMany]);

  // Move N messages to an explicit IMAP folder. All messages must share one account
  // (the picker enforces this for bulk — folder namespaces aren't shared across
  // accounts), so this is always a single server call.
  const doMove = useCallback((msgs, targetPath, targetName) => {
    setMovePicker(null);
    if (!msgs.length) return;
    msgs.forEach(removeFromList);
    const acctId = msgs[0].accountId;
    mailApi
      .moveMessage(acctId, msgs.map((m) => m.uid), folder, targetPath)
      .then(() => showToast(msgs.length > 1 ? `Moved ${msgs.length} messages to ${targetName}.` : `Moved to ${targetName}.`, "success"))
      .catch((e) => {
        if (!(e?.message || "").includes("already_moved")) msgs.forEach(reinsertToList);
        else resync(acctId);
        showToast(actionErrorText(e), "error");
      });
  }, [folder, removeFromList, reinsertToList, resync, showToast]);

  // Star / unstar — optimistic, DB-only (IMAP catches up on the next sync pass, same
  // lag as read/unread). No list removal; the row just re-renders with the new state.
  const doStar = useCallback((m, flagged) => {
    patchMessages((prev) => prev.map((x) => (sameMsg(x, m) ? { ...x, flagged } : x)));
    setSelected((s) => (s && sameMsg(s, m) ? { ...s, flagged } : s));
    mailApi.star(m.accountId, [m.uid], folder, flagged).catch((e) => {
      patchMessages((prev) => prev.map((x) => (sameMsg(x, m) ? { ...x, flagged: !flagged } : x)));
      setSelected((s) => (s && sameMsg(s, m) ? { ...s, flagged: !flagged } : s));
      showToast(e.message || "Could not update star", "error");
    });
  }, [folder, patchMessages, showToast]);

  // Forward needs the full message body — the list row shape lacks html/text/to, so
  // fetch the thread first unless we already have it (forwarding from the open pane).
  const doForward = useCallback((m) => {
    if (m.html !== undefined || m.text !== undefined) { onForward?.(m); return; }
    const threadAccountId = m.accountId || (isAll ? null : accountId);
    mailApi.thread(m.uid, folder, threadAccountId).then((full) => onForward?.(full)).catch((e) => showToast(e.message, "error"));
  }, [folder, accountId, isAll, onForward, showToast]);

  const filteredMessages = useMemo(() => {
    let list = messages;
    // Snoozed threads are hidden from the default view until they come due, then
    // resurface at the top with a badge (sorted first regardless of received_at).
    const now = Date.now();
    const isSnoozedHidden = (m) => {
      const r = m.id && reminders.get(m.id);
      return r && r.mode === "snooze" && new Date(r.remind_at).getTime() > now;
    };
    list = list.filter((m) => !isSnoozedHidden(m));
    if (filter === "unread") list = list.filter((m) => !m.seen);
    if (filter === "starred") list = list.filter((m) => m.flagged);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) =>
        (m.subject || "").toLowerCase().includes(q) ||
        (m.from?.name || "").toLowerCase().includes(q) ||
        (m.from?.address || "").toLowerCase().includes(q)
      );
    }
    // Resurfaced snoozes (now due) float to the top, newest-due first.
    const resurfacedAt = (m) => {
      const r = m.id && reminders.get(m.id);
      return r && r.mode === "snooze" && new Date(r.remind_at).getTime() <= now ? new Date(r.remind_at).getTime() : null;
    };
    const withResurfaced = list.some((m) => resurfacedAt(m) != null);
    if (withResurfaced) {
      list = [...list].sort((a, b) => {
        const ra = resurfacedAt(a), rb = resurfacedAt(b);
        if (ra != null && rb != null) return rb - ra;
        if (ra != null) return -1;
        if (rb != null) return 1;
        return 0;
      });
    }
    return list;
  }, [messages, filter, search, reminders]);

  const selectedMessages = useMemo(
    () => filteredMessages.filter((m) => selectedKeys.has(rowKey(m))),
    [filteredMessages, selectedKeys]
  );
  const allVisibleSelected = filteredMessages.length > 0 && filteredMessages.every((m) => selectedKeys.has(rowKey(m)));
  const toggleSelectAll = () => setSelectedKeys(allVisibleSelected ? new Set() : new Set(filteredMessages.map(rowKey)));
  // Bulk Move needs one shared IMAP folder namespace — only offer it when every
  // selected message belongs to the same account (always true outside "All Inboxes").
  const canBulkMove = selectedMessages.length > 0 && selectedMessages.every((m) => m.accountId === selectedMessages[0].accountId);

  const showList = !isMobile || !selected;
  const showPane = !isMobile || !!selected || loadingBody;

  return (
    <div style={{ display: "flex", height: "100%", fontFamily: F.mono }}>
      {/* Message list panel */}
      <div style={{
        width: isMobile ? "100%" : 340, flexShrink: 0,
        borderRight: isMobile ? "none" : `1px solid ${C.border}`,
        overflowY: "auto", display: showList ? "flex" : "none",
        flexDirection: "column",
        background: "rgba(10,16,32,0.35)",
      }}>
        {/* List header */}
        <div ref={headerRef} style={{
          display: "flex", flexDirection: "column", gap: SP.sm,
          padding: `${SP.md}px ${SP.lg}px ${SP.sm}px`,
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          position: "sticky", top: 0, zIndex: 2,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 17, color: C.ink, letterSpacing: "0.01em" }}>
              {FOLDER_TITLE[folder] || folder}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <SelectToggleButton
                active={selectMode}
                onClick={() => { setSelectMode((v) => !v); setSelectedKeys(new Set()); }}
              />
              <RefreshButton onClick={refresh} />
            </div>
          </div>

          {selectMode ? (
            <BulkToolbar
              count={selectedKeys.size}
              allSelected={allVisibleSelected}
              onToggleAll={toggleSelectAll}
              onCancel={() => { setSelectMode(false); setSelectedKeys(new Set()); }}
              onDelete={() => doDeleteMany(selectedMessages)}
              onArchive={isArchiveView ? undefined : () => doArchiveMany(selectedMessages)}
              onJunk={isJunkView ? () => doMove(selectedMessages, "INBOX", "Inbox") : () => doJunkMany(selectedMessages)}
              junkLabel={isJunkView ? "Move to Inbox" : "Junk"}
              junkIcon={isJunkView ? <InboxIcon size={13} /> : <Ban size={13} />}
              onMove={() => setMovePicker({ msgs: selectedMessages })}
              canMove={canBulkMove}
            />
          ) : (
            <>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <Search size={14} color={C.inkFaint} style={{ position: "absolute", left: SP.md, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search messages…"
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: `1px solid ${C.hair}`, borderRadius: R.pill, padding: `${SP.sm}px ${SP.xl}px ${SP.sm}px 34px`, fontFamily: F.mono, fontSize: 13, color: C.ink, outline: "none" }}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ position: "absolute", right: SP.sm, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 2 }}>
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* All / Unread / Starred filter tabs */}
              <div style={{ display: "flex", gap: SP.sm }}>
                {["all", "unread", "starred"].map((f) => (
                  <FilterTab key={f} label={f} active={filter === f} onClick={() => setFilter(f)} />
                ))}
              </div>
            </>
          )}
        </div>

        {loading && <SkeletonList />}
        {error && <Note tone="danger">{error}</Note>}

        {isAll && Object.entries(errors).map(([id, code]) => {
          const acc = accountMap[id];
          const name = acc?.email_address || acc?.display_name || "an account";
          return (
            <button key={`err-${id}`} onClick={() => onFixAccount?.()}
              style={{ display: "flex", alignItems: "center", gap: SP.sm, width: "100%", textAlign: "left", background: "rgba(255,77,77,0.08)", border: "none", borderBottom: `1px solid ${C.border}`, padding: `${SP.sm}px ${SP.lg}px`, cursor: "pointer" }}>
              <AlertTriangle size={13} color={C.critical} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: F.mono, fontSize: 12, color: C.inkDim }}>{name} {ERR_LABEL[code] || "couldn't sync"} — check settings</span>
            </button>
          );
        })}

        {!loading && !error && filteredMessages.length === 0 && (
          <EmptyState search={search} />
        )}

        <div ref={listRef} style={{ flex: 1 }}>
          {filteredMessages.map((m) => {
            const active = selected?.uid === m.uid && selected?.accountId === m.accountId;
            const acc = isAll ? accountMap[m.accountId] : null;
            const accent = acc?.color || C.minor;
            const hasAttachments = m.attachments?.length > 0;
            return (
              <MessageRow key={rowKey(m)}
                message={m} active={active} acc={acc} accent={accent}
                hasAttachments={hasAttachments} isAll={isAll}
                onClick={() => open(m)} openRef={openRef}
                onDelete={() => doDelete(m)} onArchive={isArchiveView ? undefined : () => doArchive(m)} onMove={() => setMovePicker({ msgs: [m] })}
                onJunk={isJunkView ? () => doMove([m], "INBOX", "Inbox") : () => doJunk(m)}
                junkLabel={isJunkView ? "Move to Inbox" : "Mark as junk"}
                junkIcon={isJunkView ? <InboxIcon size={14} /> : <Ban size={14} />}
                onForward={() => doForward(m)} onStar={(flagged) => doStar(m, flagged)}
                selectMode={selectMode} checked={selectedKeys.has(rowKey(m))} onToggleSelect={() => toggleSelect(m)}
                reminder={m.id ? reminders.get(m.id) : null} onReminderChanged={loadReminders}
              />
            );
          })}
        </div>
      </div>

      {/* Reading pane */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", background: "rgba(6,12,24,0.5)", display: showPane ? "block" : "none" }}>
        {isMobile && selected && (
          <div style={{ padding: `${SP.md}px ${SP.lg}px 0`, position: "sticky", top: 0, background: "rgba(6,12,24,0.9)", zIndex: 2 }}>
            <button onClick={() => setSelected(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: SP.sm, background: "none", border: "none", color: C.minor, fontFamily: F.mono, fontWeight: 600, fontSize: 14, cursor: "pointer", padding: "4px 0" }}>
              <CornerUpLeft size={16} /> Back
            </button>
          </div>
        )}

        {loadingBody && <Note>Opening…</Note>}
        {!loadingBody && bodyError && <Note tone="danger">{bodyError}</Note>}
        {!loadingBody && !bodyError && !selected && !isMobile && (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: SP.md }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(59,163,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: SP.sm }}>
              <Paperclip size={20} color={C.minor} strokeWidth={1.5} />
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 14, color: C.inkFaint }}>Select a message to read</div>
          </div>
        )}
        {!loadingBody && selected && (
          <div ref={paneRef}>
            <ThreadView message={selected} onReply={onReply} onForward={() => doForward(selected)} openRef={openRef} onViewAttachment={setViewerDoc}
              onDelete={() => doDelete(selected)} onArchive={isArchiveView ? undefined : () => doArchive(selected)} onMove={() => setMovePicker({ msgs: [selected] })}
              onJunk={isJunkView ? () => doMove([selected], "INBOX", "Inbox") : () => doJunk(selected)}
              junkLabel={isJunkView ? "Move to Inbox" : "Junk"}
              junkIcon={isJunkView ? <InboxIcon size={15} /> : <Ban size={15} />}
              onStar={(flagged) => doStar(selected, flagged)}
              reminder={selected.id ? reminders.get(selected.id) : null} onReminderChanged={loadReminders} />
          </div>
        )}
      </div>

      <DocViewer open={!!viewerDoc} doc={viewerDoc} onClose={() => setViewerDoc(null)} />

      {movePicker && movePicker.msgs.length > 0 && (
        <MoveFolderPicker
          msgs={movePicker.msgs}
          currentFolder={folder}
          onClose={() => setMovePicker(null)}
          onPick={(path, name) => doMove(movePicker.msgs, path, name)}
        />
      )}
    </div>
  );
}

// Slide-up folder picker for "Move to…" — used for both a single message and a bulk
// selection (msgs.length > 1). Loads the target account's folders from mail_folders
// (via /api/mail/folders), excludes the current folder + Inbox, and hands the chosen
// IMAP path back to doMove. All of `msgs` are assumed to share one account (enforced by
// the caller: the per-row action always passes one message; the bulk toolbar disables
// Move when the selection spans accounts).
function MoveFolderPicker({ msgs, currentFolder, onClose, onPick }) {
  const [folders, setFolders] = useState(null);
  const [error, setError] = useState("");
  const cardRef = useRef(null);
  const accountId = msgs[0].accountId;

  useEffect(() => {
    let alive = true;
    mailApi
      .folders(accountId)
      .then((r) => { if (alive) setFolders(r.folders || []); })
      .catch((e) => { if (alive) setError(e.message || "Could not load folders"); });
    return () => { alive = false; };
  }, [accountId]);

  useEffect(() => {
    if (cardRef.current) gsap.fromTo(cardRef.current, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.28, ease: "power3.out" });
  }, []);

  const currentPath = currentFolder === "INBOX" ? "INBOX" : currentFolder;
  const options = (folders || []).filter(
    (f) => f.path !== currentPath && f.special_use !== "inbox" && f.path.toUpperCase() !== "INBOX"
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(2,4,8,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div ref={cardRef} onClick={(e) => e.stopPropagation()} style={{ ...glass(R.card), width: "100%", maxWidth: 420, margin: SP.md, maxHeight: "70vh", overflowY: "auto", padding: `${SP.lg}px` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SP.md }}>
          <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 16, color: C.ink }}>
            {msgs.length > 1 ? `Move ${msgs.length} messages to…` : "Move to…"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 4 }}><X size={16} /></button>
        </div>
        {folders === null && !error && <div style={{ fontFamily: F.mono, fontSize: 13, color: C.inkFaint, padding: `${SP.md}px 0` }}>Loading folders…</div>}
        {error && <div style={{ fontFamily: F.mono, fontSize: 13, color: C.critical, padding: `${SP.md}px 0` }}>{error}</div>}
        {folders && !error && options.length === 0 && <div style={{ fontFamily: F.mono, fontSize: 13, color: C.inkFaint, padding: `${SP.md}px 0` }}>No other folders available.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {options.map((f) => (
            <button key={f.path} onClick={() => onPick(f.path, f.name)}
              style={{ display: "flex", alignItems: "center", gap: SP.sm, width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: R.chip, padding: `${SP.sm + 2}px ${SP.md}px`, cursor: "pointer", fontFamily: F.mono, fontSize: 14, color: C.ink }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(59,163,255,0.1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
              <FolderInput size={15} color={C.inkDim} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MessageRow({ message: m, active, acc, accent, hasAttachments, isAll, onClick, openRef, onDelete, onArchive, onMove, onJunk, junkLabel, junkIcon, onForward, onStar, selectMode, checked, onToggleSelect, reminder, onReminderChanged }) {
  const ref = useRef(null);
  const reminderDue = reminder && new Date(reminder.remind_at) <= new Date();

  const handleEnter = () => {
    if (active || !ref.current) return;
    gsap.to(ref.current, { x: 3, duration: 0.18, ease: "power1.out" });
  };
  const handleLeave = () => {
    if (!ref.current) return;
    gsap.to(ref.current, { x: 0, duration: 0.18, ease: "power1.in" });
  };

  // In select mode, tapping anywhere on the row toggles its checkbox instead of
  // opening the thread; the kebab menu (per-message actions) is hidden in favour of
  // the bulk toolbar above the list.
  const rowClick = selectMode ? onToggleSelect : onClick;

  return (
    <div style={{ position: "relative" }} className="mail-row-wrap">
    <button ref={ref} className="mail-row" onClick={rowClick}
      onMouseEnter={handleEnter} onMouseLeave={handleLeave}
      style={{
        display: selectMode ? "flex" : "block",
        alignItems: selectMode ? "flex-start" : undefined,
        gap: selectMode ? SP.sm : undefined,
        width: "100%", textAlign: "left",
        background: active ? "rgba(59,163,255,0.1)" : (checked ? "rgba(59,163,255,0.08)" : "transparent"),
        border: "none", borderBottom: `1px solid ${C.hair}`,
        borderLeft: `3px solid ${active ? C.minor : (isAll ? accent : "transparent")}`,
        padding: `${SP.md}px ${selectMode ? SP.md : (SP.xxl + SP.sm + 20)}px ${SP.md}px ${SP.lg}px`, cursor: "pointer",
        transition: "background 0.12s, border-color 0.15s",
        willChange: "transform",
      }}
    >
      {selectMode && (
        <span style={{ flexShrink: 0, marginTop: 2, color: checked ? C.minor : C.inkFaint, display: "flex" }}>
          {checked ? <CheckSquare size={18} /> : <Square size={18} />}
        </span>
      )}
      <div style={selectMode ? { flex: 1, minWidth: 0 } : undefined}>
        {isAll && acc && (
          <div style={{ display: "flex", alignItems: "center", gap: SP.xs, marginBottom: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {acc.display_name || acc.email_address}
            </span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: SP.sm, marginBottom: 3 }}>
          {!m.seen && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.minor, flexShrink: 0 }} />}
          <span style={{ flex: 1, fontFamily: F.mono, fontSize: 14, fontWeight: m.seen ? 500 : 700, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {m.from?.name || m.from?.address || "Unknown"}
          </span>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaint, flexShrink: 0 }}>
            {formatRelative(m.date)}
          </span>
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 13, fontWeight: m.seen ? 400 : 600, color: m.seen ? C.inkDim : C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: hasAttachments ? 4 : 0 }}>
          <RefText text={m.subject} onRef={openRef} />
        </div>
        {hasAttachments && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Paperclip size={11} color={C.inkFaint} />
            <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaint }}>
              {m.attachments.length} attachment{m.attachments.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        {reminder && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: hasAttachments ? 3 : 4 }}>
            {reminder.mode === "snooze" ? <ClockIcon size={11} color={C.warning} /> : <BellRing size={11} color={reminderDue ? C.warning : C.inkFaint} />}
            <span style={{ fontFamily: F.mono, fontSize: 10, color: reminderDue ? C.warning : C.inkFaint }}>
              {reminder.mode === "snooze" ? "Snoozed — back" : reminderDue ? "Follow-up due" : `Follow-up ${formatRelative(reminder.remind_at)}`}
            </span>
          </div>
        )}
      </div>
    </button>
      {!selectMode && (
        <div style={{ position: "absolute", top: SP.sm, right: SP.sm, display: "flex", alignItems: "center", gap: 2 }}>
          <StarButton flagged={!!m.flagged} onToggle={onStar} />
          {m.id && <FollowUpButton messageId={m.id} active={!!reminder} onChanged={onReminderChanged} />}
          <RowKebab onDelete={onDelete} onArchive={onArchive} onMove={onMove} onJunk={onJunk} junkLabel={junkLabel} junkIcon={junkIcon} onForward={onForward} />
        </div>
      )}
    </div>
  );
}

// Icon button (parallel to Star) that opens the ReminderControl popover for one message.
function FollowUpButton({ messageId, active, onChanged }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="Follow-up reminder"
        style={{ background: open || active ? "rgba(232,147,10,0.15)" : "none", border: "none", borderRadius: R.chip, cursor: "pointer", color: active ? C.warning : C.inkFaint, padding: 4, display: "flex" }}>
        <BellRing size={14} />
      </button>
      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          <ReminderControl messageId={messageId} onClose={() => setOpen(false)} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

function StarButton({ flagged, onToggle }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(!flagged); }}
      title={flagged ? "Unstar" : "Star"}
      style={{ background: "none", border: "none", borderRadius: R.chip, cursor: "pointer", color: flagged ? C.warning : C.inkFaint, padding: 4, display: "flex" }}>
      <Star size={15} fill={flagged ? C.warning : "none"} />
    </button>
  );
}

// Header icon that flips the list into select mode (checkboxes appear, tapping a row
// toggles selection, the bulk toolbar replaces search/filter).
function SelectToggleButton({ active, onClick }) {
  return (
    <button onClick={onClick} title={active ? "Cancel selection" : "Select messages"}
      style={{ background: active ? "rgba(59,163,255,0.15)" : "none", border: "none", borderRadius: R.chip, cursor: "pointer", color: active ? C.minor : C.inkFaint, padding: 4, display: "flex" }}>
      <CheckSquare size={15} />
    </button>
  );
}

// Bulk action bar shown in place of search/filter while select mode is active.
function BulkToolbar({ count, allSelected, onToggleAll, onCancel, onDelete, onArchive, onJunk, junkLabel, junkIcon, onMove, canMove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: SP.sm, flexWrap: "wrap" }}>
      <button onClick={onToggleAll}
        style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: C.minor, fontFamily: F.mono, fontSize: 11, padding: 2 }}>
        {allSelected ? <CheckSquare size={15} /> : <Square size={15} />} All
      </button>
      <span style={{ fontFamily: F.mono, fontSize: 13, fontWeight: 600, color: C.ink, flex: 1 }}>
        {count} selected
      </span>
      <BulkIconButton icon={<FolderInput size={13} />} label="Move" onClick={onMove} disabled={!count || !canMove} title={!canMove && count ? "Select messages from one account to move" : undefined} />
      {onArchive && <BulkIconButton icon={<Archive size={13} />} label="Archive" onClick={onArchive} disabled={!count} />}
      <BulkIconButton icon={junkIcon || <Ban size={13} />} label={junkLabel || "Junk"} onClick={onJunk} disabled={!count} />
      <BulkIconButton icon={<Trash2 size={13} />} label="Delete" onClick={onDelete} disabled={!count} danger />
      <button onClick={onCancel} title="Cancel selection"
        style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 4, display: "flex" }}>
        <X size={16} />
      </button>
    </div>
  );
}

function BulkIconButton({ icon, label, onClick, disabled, danger, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${danger ? C.critical : C.border}`, borderRadius: R.pill, padding: `4px ${SP.sm}px`, fontFamily: F.mono, fontSize: 11, color: disabled ? C.inkFaint : (danger ? C.critical : C.inkDim), cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      {icon} {label}
    </button>
  );
}

// Three-dot menu overlaid on a message row (top-right). Rendered as a sibling of the
// row button — never nested inside it — so it stays valid + independently clickable.
function RowKebab({ onDelete, onArchive, onMove, onJunk, junkLabel, junkIcon, onForward }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="Message actions"
        style={{ background: open ? "rgba(59,163,255,0.15)" : "none", border: "none", borderRadius: R.chip, cursor: "pointer", color: C.inkFaint, padding: 4, display: "flex" }}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, minWidth: 170, zIndex: 31, ...glass(R.chip), padding: 4 }}>
            <KebabItem icon={<CornerUpRight size={14} />} label="Forward" onClick={(e) => { e.stopPropagation(); setOpen(false); onForward(); }} />
            <KebabItem icon={<FolderInput size={14} />} label="Move to…" onClick={(e) => { e.stopPropagation(); setOpen(false); onMove(); }} />
            {onArchive && <KebabItem icon={<Archive size={14} />} label="Archive" onClick={(e) => { e.stopPropagation(); setOpen(false); onArchive(); }} />}
            <KebabItem icon={junkIcon || <Ban size={14} />} label={junkLabel || "Mark as junk"} onClick={(e) => { e.stopPropagation(); setOpen(false); onJunk(); }} />
            <KebabItem icon={<Trash2 size={14} />} label="Delete" danger onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }} />
          </div>
        </>
      )}
    </div>
  );
}

function KebabItem({ icon, label, onClick, danger }) {
  return (
    <button onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(59,163,255,0.1)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      style={{ display: "flex", alignItems: "center", gap: SP.sm, width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: R.chip - 2, padding: `${SP.sm}px ${SP.sm}px`, cursor: "pointer", fontFamily: F.mono, fontSize: 13, color: danger ? C.critical : C.ink }}>
      <span style={{ color: danger ? C.critical : C.inkDim, display: "flex", flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

function ThreadView({ message, onReply, onForward, openRef, onViewAttachment, onDelete, onArchive, onMove, onJunk, junkLabel, junkIcon, onStar, reminder, onReminderChanged }) {
  const isMobile = useIsMobile();
  const [reminderOpen, setReminderOpen] = useState(false);
  const subjectRef = useRef(null);
  const metaRef = useRef(null);
  const bodyRef = useRef(null);
  const actionsRef = useRef(null);
  const reminderDue = reminder && new Date(reminder.remind_at) <= new Date();

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const targets = [subjectRef, metaRef, bodyRef, actionsRef].map((r) => r.current).filter(Boolean);
    gsap.fromTo(targets,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.35, stagger: 0.07, ease: "power2.out", clearProps: "transform,opacity" }
    );
  }, [message.uid]);

  return (
    <div style={{ padding: isMobile ? `${SP.md}px ${SP.lg}px` : `${SP.xl}px ${SP.xxl}px`, maxWidth: 860, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: SP.md, marginBottom: SP.lg }}>
        <h1 ref={subjectRef} style={{ flex: 1, fontFamily: F.head, fontWeight: 700, fontSize: isMobile ? 20 : 26, color: C.ink, margin: 0, lineHeight: 1.2, letterSpacing: "0.005em" }}>
          <RefText text={message.subject} onRef={openRef} />
        </h1>
        {onStar && (
          <button onClick={() => onStar(!message.flagged)} title={message.flagged ? "Unstar" : "Star"}
            style={{ background: "none", border: "none", cursor: "pointer", color: message.flagged ? C.warning : C.inkFaint, padding: 4, flexShrink: 0, marginTop: 4 }}>
            <Star size={20} fill={message.flagged ? C.warning : "none"} />
          </button>
        )}
      </div>

      {reminder && (
        <div style={{ display: "flex", alignItems: "center", gap: SP.sm, background: reminderDue ? "rgba(232,147,10,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${reminderDue ? "rgba(232,147,10,0.3)" : C.hair}`, borderRadius: R.chip, padding: `${SP.sm}px ${SP.md}px`, marginBottom: SP.lg }}>
          {reminder.mode === "snooze" ? <ClockIcon size={13} color={C.warning} /> : <BellRing size={13} color={reminderDue ? C.warning : C.inkFaint} />}
          <span style={{ fontFamily: F.mono, fontSize: 12, color: reminderDue ? C.warning : C.inkDim, flex: 1 }}>
            {reminder.mode === "snooze" ? "Snoozed until" : "Follow-up"} {formatAbsolute(reminder.remind_at)}{reminderDue ? " — due" : ""}
          </span>
        </div>
      )}

      {/* Sender meta card */}
      <div ref={metaRef} style={{ ...glass(R.card), padding: `${SP.md}px ${SP.lg}px`, marginBottom: SP.lg, display: "flex", flexDirection: "column", gap: SP.sm }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: SP.md }}>
          <div>
            <div style={{ fontFamily: F.mono, fontWeight: 600, fontSize: 14, color: C.ink }}>
              {message.from?.name || message.from?.address || "Unknown"}
            </div>
            {message.from?.name && (
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaint }}>{message.from.address}</div>
            )}
            {message.to?.length > 0 && (
              <div style={{ fontFamily: F.mono, fontSize: 12, color: C.inkDim, marginTop: 2 }}>
                To: {message.to.map((t) => t.name || t.address).join(", ")}
              </div>
            )}
            {message.cc?.length > 0 && (
              <div style={{ fontFamily: F.mono, fontSize: 12, color: C.inkDim }}>
                CC: {message.cc.map((t) => t.name || t.address).join(", ")}
              </div>
            )}
          </div>
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaint, flexShrink: 0, textAlign: "right" }}>
            {formatAbsolute(message.date)}
          </span>
        </div>
      </div>

      {/* Attachment chips */}
      {message.attachments?.length > 0 && (
        <AttachmentChips attachments={message.attachments} onView={onViewAttachment} />
      )}

      {/* Body */}
      <div ref={bodyRef} style={{ ...glass(R.card), padding: `${SP.xl}px`, marginBottom: SP.xl, fontFamily: F.mono, fontSize: 15, color: C.ink, lineHeight: 1.7, whiteSpace: message.html ? "normal" : "pre-wrap", wordBreak: "break-word", overflowX: "auto" }}
        {...(message.html
          ? { dangerouslySetInnerHTML: { __html: message.html } }
          : { children: <RefText text={message.text} onRef={openRef} /> })}
      />

      {/* Actions */}
      <div ref={actionsRef} style={{ display: "flex", gap: SP.sm, flexWrap: "wrap" }}>
        {onReply && <ActionButton icon={<CornerUpLeft size={15} />} label="Reply" onClick={() => onReply(message)} primary />}
        {onForward && <ActionButton icon={<CornerUpRight size={15} />} label="Forward" onClick={onForward} />}
        {onMove && <ActionButton icon={<FolderInput size={15} />} label="Move" onClick={onMove} />}
        {onArchive && <ActionButton icon={<Archive size={15} />} label="Archive" onClick={onArchive} />}
        {onJunk && <ActionButton icon={junkIcon || <Ban size={15} />} label={junkLabel || "Junk"} onClick={onJunk} />}
        {message.id && (
          <div style={{ position: "relative" }}>
            <ActionButton icon={<BellRing size={15} />} label={reminder ? "Follow-up" : "Remind me"} onClick={() => setReminderOpen((v) => !v)} />
            {reminderOpen && (
              <ReminderControl messageId={message.id} onClose={() => setReminderOpen(false)} onChanged={onReminderChanged} />
            )}
          </div>
        )}
        {onDelete && <ActionButton icon={<Trash2 size={15} />} label="Delete" onClick={onDelete} danger />}
      </div>
    </div>
  );
}

function AttachmentChips({ attachments, onView }) {
  return (
    <div style={{ ...glass(R.card), padding: `${SP.md}px ${SP.lg}px`, marginBottom: SP.lg, display: "flex", flexWrap: "wrap", gap: SP.sm, alignItems: "center" }}>
      <Paperclip size={14} color={C.inkDim} style={{ flexShrink: 0 }} />
      {attachments.map((att, i) => (
        <AttachChip key={i} att={att} onView={onView} />
      ))}
    </div>
  );
}

function AttachChip({ att, onView }) {
  const ref = useRef(null);
  return (
    <button ref={ref}
      onClick={() => { if (att.url) onView({ url: att.url, fileName: att.filename || att.name, mimeType: att.contentType || att.mimeType }); }}
      onMouseEnter={() => { if (ref.current) gsap.to(ref.current, { y: -2, duration: 0.18, ease: "power1.out" }); }}
      onMouseLeave={() => { if (ref.current) gsap.to(ref.current, { y: 0, duration: 0.18, ease: "power1.in" }); }}
      style={{ display: "inline-flex", alignItems: "center", gap: SP.xs, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.hair}`, borderRadius: R.chip, padding: `${SP.xs}px ${SP.md}px`, fontFamily: F.mono, fontSize: 12, color: C.ink, cursor: att.url ? "pointer" : "default", willChange: "transform" }}
      title={att.url ? "View attachment" : "Preview unavailable"}
    >
      <Paperclip size={11} color={C.minor} />
      {att.filename || att.name || "attachment"}
    </button>
  );
}

function ActionButton({ icon, label, onClick, primary, danger }) {
  const ref = useRef(null);
  const handlePress = () => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { scale: 0.95 }, { scale: 1, duration: 0.25, ease: "back.out(2)" });
  };
  return (
    <button ref={ref} onClick={() => { handlePress(); onClick(); }}
      style={{ display: "inline-flex", alignItems: "center", gap: SP.sm, background: primary ? C.minor : "rgba(255,255,255,0.05)", border: primary ? "none" : `1px solid ${danger ? C.critical : C.border}`, borderRadius: R.pill, padding: `${SP.sm + 2}px ${SP.xl}px`, fontFamily: F.mono, fontWeight: 600, fontSize: 14, color: primary ? C.void : (danger ? C.critical : C.inkDim), cursor: "pointer", minHeight: 40, willChange: "transform" }}>
      {icon}{label}
    </button>
  );
}

function FilterTab({ label, active, onClick }) {
  const ref = useRef(null);
  const handleClick = () => {
    if (ref.current) gsap.fromTo(ref.current, { scale: 0.92 }, { scale: 1, duration: 0.22, ease: "back.out(2.5)" });
    onClick();
  };
  return (
    <button ref={ref} onClick={handleClick}
      style={{ background: active ? C.minor : "none", border: active ? "none" : `1px solid ${C.border}`, borderRadius: R.pill, padding: `3px ${SP.md}px`, fontFamily: F.mono, fontWeight: active ? 600 : 500, fontSize: 12, color: active ? C.void : C.inkDim, cursor: "pointer", textTransform: "capitalize", willChange: "transform" }}>
      {label}
    </button>
  );
}

function RefreshButton({ onClick }) {
  const ref = useRef(null);
  const spin = () => {
    if (!ref.current) return;
    gsap.to(ref.current, { rotation: 360, duration: 0.55, ease: "power2.inOut", onComplete: () => gsap.set(ref.current, { rotation: 0 }) });
    onClick();
  };
  return (
    <button onClick={spin} style={{ background: "none", border: "none", cursor: "pointer", color: C.inkFaint, padding: 4 }}>
      <RefreshCw ref={ref} size={15} />
    </button>
  );
}

function EmptyState({ search }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
  }, [search]);
  return (
    <div ref={ref} style={{ padding: `${SP.xxl}px ${SP.lg}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(59,163,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Search size={22} color={C.minor} strokeWidth={1.5} />
      </div>
      <div style={{ fontFamily: F.mono, fontSize: 14, color: C.inkFaint }}>
        {search ? `No results for "${search}"` : "No messages."}
      </div>
    </div>
  );
}

// Skeleton placeholder rows — shown only on a cold read (no cache). Keeps the list
// structure visible so a first load doesn't feel like a blocking spinner. Switching
// to an already-loaded account skips this entirely (cache paints immediately).
function SkeletonList() {
  const rowRef = useRef(null);
  useEffect(() => {
    if (!rowRef.current) return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;
    const bars = rowRef.current.querySelectorAll(".sk-bar");
    const tl = gsap.to(bars, { opacity: 0.35, duration: 0.7, ease: "sine.inOut", stagger: 0.05, yoyo: true, repeat: -1 });
    return () => tl.kill();
  }, []);
  return (
    <div ref={rowRef} style={{ padding: `${SP.sm}px 0` }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{ padding: `${SP.md}px ${SP.lg}px`, borderBottom: `1px solid ${C.hair}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="sk-bar" style={{ width: `${55 + (i % 3) * 12}%`, height: 11, borderRadius: 4, background: "rgba(59,163,255,0.15)" }} />
          <div className="sk-bar" style={{ width: `${72 - (i % 4) * 9}%`, height: 9, borderRadius: 4, background: C.hair }} />
        </div>
      ))}
    </div>
  );
}

function Note({ children, tone }) {
  return (
    <div style={{ padding: `${SP.xl}px ${SP.lg}px`, fontFamily: F.mono, fontSize: 13, color: tone === "danger" ? C.critical : C.inkFaint }}>
      {children}
    </div>
  );
}
