import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, CornerUpLeft, AlertTriangle, Paperclip, Search, X, MoreVertical, Trash2, FolderInput, Ban, CheckSquare, Square } from "lucide-react";
import gsap from "gsap";
import { MC, MF, MG, MSP, MR, mailCard, MAIL_ACTIONS } from "../../ui/mailTheme";
import { mailApi } from "../../lib/mailApi";
import { useMailList } from "../../lib/mailCache";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useToast } from "../../components/Toast";
import { formatRelative, formatAbsolute } from "../../lib/format";
import { useRouter } from "../../context/RouterContext";
import { globalSearch, ROUTE_FOR } from "../../lib/search";
import DocViewer from "../../components/DocViewer";

// Map a mail-action error code (or raw message) to a user-facing sentence.
function actionErrorText(e) {
  const m = (e?.message || "").toLowerCase();
  if (m.includes("no_trash_folder")) return "No Trash folder is set for this account — configure it in Mail Settings.";
  if (m.includes("no_junk_folder")) return "No Junk folder is set for this account — configure it in Mail Settings.";
  if (m.includes("already_moved")) return "This message was already moved.";
  return e?.message || "Action failed";
}

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
          style={{ fontFamily: MF.mono, color: MC.blue, textDecoration: "underline", textDecorationColor: MC.blue, textDecorationThickness: 1, cursor: "pointer" }}>
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

export default function InboxView({ folder = "INBOX", accountId = null, accounts = [], onReply, onFixAccount }) {
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
  const isMobile = useIsMobile();
  const { showToast } = useToast();
  const { navigate } = useRouter();
  const listRef = useRef(null);
  const paneRef = useRef(null);
  const headerRef = useRef(null);

  const isAll = accountId === "all";
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

  // ── Message actions (Delete / Move / Junk) ──────────────────────────────────
  // The optimistic pattern mirrors runWrite elsewhere: remove from the list now, fire
  // the server IMAP move, and revert on failure. `folder` (INBOX|Sent) is the mirror key.
  const sameMsg = (a, b) => a.uid === b.uid && a.accountId === b.accountId;
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

  // Delete N messages (any mix of accounts — grouped so one call covers each account's
  // batch). Undo re-moves every group's messages back from Trash using the per-account
  // new-UID mapping the server returned.
  const doDeleteMany = useCallback((msgs) => {
    if (!msgs.length) return;
    msgs.forEach(removeFromList);
    const groups = groupByAccount(msgs);
    const undoGroups = [];
    let pending = groups.size;
    let anyErr = false;
    groups.forEach((list, acctId) => {
      mailApi
        .deleteMessage(acctId, list.map((m) => m.uid), folder)
        .then((r) => undoGroups.push({ accountId: acctId, trash: r.target, newUidByOld: r.newUidByOld || {}, msgs: list }))
        .catch((e) => {
          anyErr = true;
          if (!(e?.message || "").includes("already_moved")) list.forEach(reinsertToList);
          else resync(acctId);
        })
        .finally(() => {
          if (--pending > 0) return;
          const label = msgs.length > 1 ? `Moved ${msgs.length} messages to Trash` : "Moved to Trash";
          showToast(anyErr ? "Some messages could not be moved to Trash" : label, {
            type: anyErr ? "error" : "success",
            duration: 7000,
            action: !anyErr
              ? {
                  label: "Undo",
                  onClick: () => {
                    undoGroups.forEach(({ accountId: acctId, trash, newUidByOld, msgs: gm }) => {
                      const uids = gm.map((m) => newUidByOld[m.uid]).filter((u) => u != null);
                      if (!uids.length) return;
                      mailApi
                        .moveMessage(acctId, uids, trash, folder === "INBOX" ? "INBOX" : folder)
                        .then(() => { gm.forEach(reinsertToList); resync(acctId); })
                        .catch((e) => showToast(actionErrorText(e), "error"));
                    });
                  },
                }
              : undefined,
          });
        });
    });
  }, [folder, removeFromList, reinsertToList, resync, showToast]);
  const doDelete = useCallback((m) => doDeleteMany([m]), [doDeleteMany]);

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

  const filteredMessages = useMemo(() => {
    let list = messages;
    if (filter === "unread") list = list.filter((m) => !m.seen);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((m) =>
        (m.subject || "").toLowerCase().includes(q) ||
        (m.from?.name || "").toLowerCase().includes(q) ||
        (m.from?.address || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [messages, filter, search]);

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
    <div style={{ display: "flex", height: "100%", fontFamily: MF.body }}>
      {/* Message list panel */}
      <div style={{
        width: isMobile ? "100%" : 340, flexShrink: 0,
        borderRight: isMobile ? "none" : `1px solid ${MC.border}`,
        overflowY: "auto", display: showList ? "flex" : "none",
        flexDirection: "column",
        background: "linear-gradient(180deg, #f5f8ff 0%, #eef3ff 100%)",
      }}>
        {/* List header */}
        <div ref={headerRef} style={{
          display: "flex", flexDirection: "column", gap: MSP.sm,
          padding: `${MSP.md}px ${MSP.lg}px ${MSP.sm}px`,
          background: MG.header,
          borderBottom: `1px solid ${MC.border}`,
          position: "sticky", top: 0, zIndex: 2,
          boxShadow: "0 2px 8px rgba(30,60,180,0.05)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontFamily: MF.body, fontWeight: 700, fontSize: 17, color: MC.ink }}>
              {folder === "Sent" ? "Sent" : "Inbox"}
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
              onJunk={() => doJunkMany(selectedMessages)}
              onMove={() => setMovePicker({ msgs: selectedMessages })}
              canMove={canBulkMove}
            />
          ) : (
            <>
              {/* Search */}
              <div style={{ position: "relative" }}>
                <Search size={14} color={MC.inkFaint} style={{ position: "absolute", left: MSP.md, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search messages…"
                  style={{ width: "100%", boxSizing: "border-box", background: "linear-gradient(135deg,#f8faff,#f0f4ff)", border: `1px solid ${MC.border}`, borderRadius: MR.pill, padding: `${MSP.sm}px ${MSP.xl}px ${MSP.sm}px 34px`, fontFamily: MF.body, fontSize: 13, color: MC.ink, outline: "none" }}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ position: "absolute", right: MSP.sm, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: MC.inkFaint, padding: 2 }}>
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* All / Unread filter tabs */}
              <div style={{ display: "flex", gap: MSP.sm }}>
                {["all", "unread"].map((f) => (
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
              style={{ display: "flex", alignItems: "center", gap: MSP.sm, width: "100%", textAlign: "left", background: "#fff0f0", border: "none", borderBottom: `1px solid ${MC.border}`, padding: `${MSP.sm}px ${MSP.lg}px`, cursor: "pointer" }}>
              <AlertTriangle size={13} color={MC.danger} style={{ flexShrink: 0 }} />
              <span style={{ fontFamily: MF.body, fontSize: 12, color: MC.inkDim }}>{name} {ERR_LABEL[code] || "couldn't sync"} — check settings</span>
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
            const accent = acc?.color || MC.blue;
            const hasAttachments = m.attachments?.length > 0;
            return (
              <MessageRow key={rowKey(m)}
                message={m} active={active} acc={acc} accent={accent}
                hasAttachments={hasAttachments} isAll={isAll}
                onClick={() => open(m)} openRef={openRef}
                onDelete={() => doDelete(m)} onMove={() => setMovePicker({ msgs: [m] })} onJunk={() => doJunk(m)}
                selectMode={selectMode} checked={selectedKeys.has(rowKey(m))} onToggleSelect={() => toggleSelect(m)}
              />
            );
          })}
        </div>
      </div>

      {/* Reading pane */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", background: MG.pane, display: showPane ? "block" : "none" }}>
        {isMobile && selected && (
          <div style={{ padding: `${MSP.md}px ${MSP.lg}px 0`, position: "sticky", top: 0, background: MG.pane, zIndex: 2 }}>
            <button onClick={() => setSelected(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: MSP.sm, background: "none", border: "none", color: MC.blue, fontFamily: MF.body, fontWeight: 600, fontSize: 14, cursor: "pointer", padding: "4px 0" }}>
              <CornerUpLeft size={16} /> Back
            </button>
          </div>
        )}

        {loadingBody && <Note>Opening…</Note>}
        {!loadingBody && bodyError && <Note tone="danger">{bodyError}</Note>}
        {!loadingBody && !bodyError && !selected && !isMobile && (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: MSP.md }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: MC.blueSoft, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: MSP.sm }}>
              <Paperclip size={20} color={MC.blue} strokeWidth={1.5} />
            </div>
            <div style={{ fontFamily: MF.body, fontSize: 14, color: MC.inkFaint }}>Select a message to read</div>
          </div>
        )}
        {!loadingBody && selected && (
          <div ref={paneRef}>
            <ThreadView message={selected} onReply={onReply} openRef={openRef} onViewAttachment={setViewerDoc}
              onDelete={() => doDelete(selected)} onMove={() => setMovePicker({ msgs: [selected] })} onJunk={() => doJunk(selected)} />
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(10,20,40,0.32)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div ref={cardRef} onClick={(e) => e.stopPropagation()} style={{ ...mailCard(MR.card), width: "100%", maxWidth: 420, margin: MSP.md, maxHeight: "70vh", overflowY: "auto", padding: `${MSP.lg}px` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: MSP.md }}>
          <span style={{ fontFamily: MF.body, fontWeight: 700, fontSize: 16, color: MC.ink }}>
            {msgs.length > 1 ? `Move ${msgs.length} messages to…` : "Move to…"}
          </span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: MC.inkFaint, padding: 4 }}><X size={16} /></button>
        </div>
        {folders === null && !error && <div style={{ fontFamily: MF.body, fontSize: 13, color: MC.inkFaint, padding: `${MSP.md}px 0` }}>Loading folders…</div>}
        {error && <div style={{ fontFamily: MF.body, fontSize: 13, color: MC.danger, padding: `${MSP.md}px 0` }}>{error}</div>}
        {folders && !error && options.length === 0 && <div style={{ fontFamily: MF.body, fontSize: 13, color: MC.inkFaint, padding: `${MSP.md}px 0` }}>No other folders available.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {options.map((f) => (
            <button key={f.path} onClick={() => onPick(f.path, f.name)}
              style={{ display: "flex", alignItems: "center", gap: MSP.sm, width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: MR.chip, padding: `${MSP.sm + 2}px ${MSP.md}px`, cursor: "pointer", fontFamily: MF.body, fontSize: 14, color: MC.ink }}
              onMouseEnter={(e) => (e.currentTarget.style.background = MG.activeRow)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
              <FolderInput size={15} color={MC.inkDim} style={{ flexShrink: 0 }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function MessageRow({ message: m, active, acc, accent, hasAttachments, isAll, onClick, openRef, onDelete, onMove, onJunk, selectMode, checked, onToggleSelect }) {
  const ref = useRef(null);

  const handleEnter = () => {
    if (active || !ref.current) return;
    gsap.to(ref.current, { x: 3, boxShadow: "2px 0 12px rgba(30,60,180,0.10)", duration: 0.18, ease: "power1.out" });
  };
  const handleLeave = () => {
    if (!ref.current) return;
    gsap.to(ref.current, { x: 0, boxShadow: "none", duration: 0.18, ease: "power1.in" });
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
        gap: selectMode ? MSP.sm : undefined,
        width: "100%", textAlign: "left",
        background: active ? MG.activeRow : (checked ? MC.blueSoft : "transparent"),
        border: "none", borderBottom: `1px solid ${MC.hair}`,
        borderLeft: `3px solid ${active ? MC.blue : (isAll ? accent : "transparent")}`,
        padding: `${MSP.md}px ${selectMode ? MSP.md : (MSP.xxl + MSP.sm)}px ${MSP.md}px ${MSP.lg}px`, cursor: "pointer",
        transition: "background 0.12s, border-color 0.15s",
        willChange: "transform",
      }}
    >
      {selectMode && (
        <span style={{ flexShrink: 0, marginTop: 2, color: checked ? MC.blue : MC.inkFaint, display: "flex" }}>
          {checked ? <CheckSquare size={18} /> : <Square size={18} />}
        </span>
      )}
      <div style={selectMode ? { flex: 1, minWidth: 0 } : undefined}>
        {isAll && acc && (
          <div style={{ display: "flex", alignItems: "center", gap: MSP.xs, marginBottom: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
            <span style={{ fontFamily: MF.mono, fontSize: 10, color: MC.inkFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {acc.display_name || acc.email_address}
            </span>
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: MSP.sm, marginBottom: 3 }}>
          {!m.seen && <span style={{ width: 7, height: 7, borderRadius: "50%", background: MC.blue, flexShrink: 0, boxShadow: `0 0 0 2px rgba(47,107,255,0.18)` }} />}
          <span style={{ flex: 1, fontFamily: MF.body, fontSize: 14, fontWeight: m.seen ? 500 : 700, color: MC.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {m.from?.name || m.from?.address || "Unknown"}
          </span>
          <span style={{ fontFamily: MF.mono, fontSize: 11, color: MC.inkFaint, flexShrink: 0 }}>
            {formatRelative(m.date)}
          </span>
        </div>
        <div style={{ fontFamily: MF.body, fontSize: 13, fontWeight: m.seen ? 400 : 600, color: m.seen ? MC.inkDim : MC.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: hasAttachments ? 4 : 0 }}>
          <RefText text={m.subject} onRef={openRef} />
        </div>
        {hasAttachments && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <Paperclip size={11} color={MC.inkFaint} />
            <span style={{ fontFamily: MF.mono, fontSize: 10, color: MC.inkFaint }}>
              {m.attachments.length} attachment{m.attachments.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
    </button>
      {!selectMode && <RowKebab onDelete={onDelete} onMove={onMove} onJunk={onJunk} />}
    </div>
  );
}

// Header icon that flips the list into select mode (checkboxes appear, tapping a row
// toggles selection, the bulk toolbar replaces search/filter).
function SelectToggleButton({ active, onClick }) {
  return (
    <button onClick={onClick} title={active ? "Cancel selection" : "Select messages"}
      style={{ background: active ? MC.blueSoft : "none", border: "none", borderRadius: MR.chip, cursor: "pointer", color: active ? MC.blue : MC.inkFaint, padding: 4, display: "flex" }}>
      <CheckSquare size={15} />
    </button>
  );
}

// Bulk action bar shown in place of search/filter while select mode is active.
function BulkToolbar({ count, allSelected, onToggleAll, onCancel, onDelete, onJunk, onMove, canMove }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: MSP.sm, flexWrap: "wrap" }}>
      <button onClick={onToggleAll}
        style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", color: MC.blue, fontFamily: MF.mono, fontSize: 11, padding: 2 }}>
        {allSelected ? <CheckSquare size={15} /> : <Square size={15} />} All
      </button>
      <span style={{ fontFamily: MF.body, fontSize: 13, fontWeight: 600, color: MC.ink, flex: 1 }}>
        {count} selected
      </span>
      <BulkIconButton icon={<FolderInput size={13} />} label="Move" onClick={onMove} disabled={!count || !canMove} title={!canMove && count ? "Select messages from one account to move" : undefined} />
      <BulkIconButton icon={<Ban size={13} />} label="Junk" onClick={onJunk} disabled={!count} />
      <BulkIconButton icon={<Trash2 size={13} />} label="Delete" onClick={onDelete} disabled={!count} danger />
      <button onClick={onCancel} title="Cancel selection"
        style={{ background: "none", border: "none", cursor: "pointer", color: MC.inkFaint, padding: 4, display: "flex" }}>
        <X size={16} />
      </button>
    </div>
  );
}

function BulkIconButton({ icon, label, onClick, disabled, danger, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${danger ? MC.danger : MC.border}`, borderRadius: MR.pill, padding: `4px ${MSP.sm}px`, fontFamily: MF.mono, fontSize: 11, color: disabled ? MC.inkFaint : (danger ? MC.danger : MC.inkDim), cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}>
      {icon} {label}
    </button>
  );
}

// Three-dot menu overlaid on a message row (top-right). Rendered as a sibling of the
// row button — never nested inside it — so it stays valid + independently clickable.
function RowKebab({ onDelete, onMove, onJunk }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "absolute", top: MSP.sm, right: MSP.sm }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="Message actions"
        style={{ background: open ? MC.blueSoft : "none", border: "none", borderRadius: MR.chip, cursor: "pointer", color: MC.inkFaint, padding: 4, display: "flex" }}>
        <MoreVertical size={16} />
      </button>
      {open && (
        <>
          <div onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, minWidth: 170, zIndex: 31, ...mailCard(MR.chip), padding: 4 }}>
            <KebabItem icon={<FolderInput size={14} />} label="Move to…" onClick={(e) => { e.stopPropagation(); setOpen(false); onMove(); }} />
            <KebabItem icon={<Ban size={14} />} label="Mark as junk" onClick={(e) => { e.stopPropagation(); setOpen(false); onJunk(); }} />
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
      onMouseEnter={(e) => (e.currentTarget.style.background = MG.activeRow)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
      style={{ display: "flex", alignItems: "center", gap: MSP.sm, width: "100%", textAlign: "left", background: "none", border: "none", borderRadius: MR.chip - 2, padding: `${MSP.sm}px ${MSP.sm}px`, cursor: "pointer", fontFamily: MF.body, fontSize: 13, color: danger ? MC.danger : MC.ink }}>
      <span style={{ color: danger ? MC.danger : MC.inkDim, display: "flex", flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );
}

function ThreadView({ message, onReply, openRef, onViewAttachment, onDelete, onMove, onJunk }) {
  const isMobile = useIsMobile();
  const subjectRef = useRef(null);
  const metaRef = useRef(null);
  const bodyRef = useRef(null);
  const actionsRef = useRef(null);

  const actions = MAIL_ACTIONS.map((a) => ({
    ...a,
    handler: a.key === "reply" ? () => onReply?.(message) : null,
  })).filter((a) => a.handler);

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
    <div style={{ padding: isMobile ? `${MSP.md}px ${MSP.lg}px` : `${MSP.xl}px ${MSP.xxl}px`, maxWidth: 860, margin: "0 auto" }}>
      <h1 ref={subjectRef} style={{ fontFamily: MF.body, fontWeight: 700, fontSize: isMobile ? 20 : 26, color: MC.ink, margin: `0 0 ${MSP.lg}px`, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
        <RefText text={message.subject} onRef={openRef} />
      </h1>

      {/* Sender meta card */}
      <div ref={metaRef} style={{ ...mailCard(MR.card), padding: `${MSP.md}px ${MSP.lg}px`, marginBottom: MSP.lg, display: "flex", flexDirection: "column", gap: MSP.sm }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: MSP.md }}>
          <div>
            <div style={{ fontFamily: MF.body, fontWeight: 600, fontSize: 14, color: MC.ink }}>
              {message.from?.name || message.from?.address || "Unknown"}
            </div>
            {message.from?.name && (
              <div style={{ fontFamily: MF.mono, fontSize: 11, color: MC.inkFaint }}>{message.from.address}</div>
            )}
            {message.to?.length > 0 && (
              <div style={{ fontFamily: MF.body, fontSize: 12, color: MC.inkDim, marginTop: 2 }}>
                To: {message.to.map((t) => t.name || t.address).join(", ")}
              </div>
            )}
            {message.cc?.length > 0 && (
              <div style={{ fontFamily: MF.body, fontSize: 12, color: MC.inkDim }}>
                CC: {message.cc.map((t) => t.name || t.address).join(", ")}
              </div>
            )}
          </div>
          <span style={{ fontFamily: MF.mono, fontSize: 11, color: MC.inkFaint, flexShrink: 0, textAlign: "right" }}>
            {formatAbsolute(message.date)}
          </span>
        </div>
      </div>

      {/* Attachment chips */}
      {message.attachments?.length > 0 && (
        <AttachmentChips attachments={message.attachments} onView={onViewAttachment} />
      )}

      {/* Body */}
      <div ref={bodyRef} style={{ ...mailCard(MR.card), padding: `${MSP.xl}px`, marginBottom: MSP.xl, fontFamily: MF.body, fontSize: 15, color: MC.ink, lineHeight: 1.7, whiteSpace: message.html ? "normal" : "pre-wrap", wordBreak: "break-word", overflowX: "auto" }}
        {...(message.html
          ? { dangerouslySetInnerHTML: { __html: message.html } }
          : { children: <RefText text={message.text} onRef={openRef} /> })}
      />

      {/* Actions */}
      <div ref={actionsRef} style={{ display: "flex", gap: MSP.sm, flexWrap: "wrap" }}>
        {actions.map((a) => (
          <ActionButton key={a.key} icon={<CornerUpLeft size={15} />} label={a.label} onClick={a.handler} primary />
        ))}
        {onMove && <ActionButton icon={<FolderInput size={15} />} label="Move" onClick={onMove} />}
        {onJunk && <ActionButton icon={<Ban size={15} />} label="Junk" onClick={onJunk} />}
        {onDelete && <ActionButton icon={<Trash2 size={15} />} label="Delete" onClick={onDelete} danger />}
      </div>
    </div>
  );
}

function AttachmentChips({ attachments, onView }) {
  return (
    <div style={{ ...mailCard(MR.card), padding: `${MSP.md}px ${MSP.lg}px`, marginBottom: MSP.lg, display: "flex", flexWrap: "wrap", gap: MSP.sm, alignItems: "center" }}>
      <Paperclip size={14} color={MC.inkDim} style={{ flexShrink: 0 }} />
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
      onMouseEnter={() => { if (ref.current) gsap.to(ref.current, { y: -2, boxShadow: "0 4px 12px rgba(47,107,255,0.18)", duration: 0.18, ease: "power1.out" }); }}
      onMouseLeave={() => { if (ref.current) gsap.to(ref.current, { y: 0, boxShadow: "none", duration: 0.18, ease: "power1.in" }); }}
      style={{ display: "inline-flex", alignItems: "center", gap: MSP.xs, background: "linear-gradient(135deg,#f5f8ff,#eaf0ff)", border: `1px solid ${MC.border}`, borderRadius: MR.chip, padding: `${MSP.xs}px ${MSP.md}px`, fontFamily: MF.body, fontSize: 12, color: MC.ink, cursor: att.url ? "pointer" : "default", willChange: "transform" }}
      title={att.url ? "View attachment" : "Preview unavailable"}
    >
      <Paperclip size={11} color={MC.blue} />
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
      style={{ display: "inline-flex", alignItems: "center", gap: MSP.sm, background: primary ? MG.cta : MG.card, border: primary ? "none" : `1px solid ${danger ? MC.danger : MC.border}`, borderRadius: MR.pill, padding: `${MSP.sm + 2}px ${MSP.xl}px`, fontFamily: MF.body, fontWeight: 600, fontSize: 14, color: primary ? "#fff" : (danger ? MC.danger : MC.inkDim), cursor: "pointer", minHeight: 40, boxShadow: primary ? "0 4px 16px rgba(47,107,255,0.30)" : "none", willChange: "transform" }}>
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
      style={{ background: active ? MG.cta : "none", border: active ? "none" : `1px solid ${MC.border}`, borderRadius: MR.pill, padding: `3px ${MSP.md}px`, fontFamily: MF.body, fontWeight: active ? 600 : 500, fontSize: 12, color: active ? "#fff" : MC.inkDim, cursor: "pointer", textTransform: "capitalize", boxShadow: active ? "0 2px 8px rgba(47,107,255,0.28)" : "none", willChange: "transform" }}>
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
    <button onClick={spin} style={{ background: "none", border: "none", cursor: "pointer", color: MC.inkFaint, padding: 4 }}>
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
    <div ref={ref} style={{ padding: `${MSP.xxl}px ${MSP.lg}px`, display: "flex", flexDirection: "column", alignItems: "center", gap: MSP.md, textAlign: "center" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg,#eaf0ff,#dde8ff)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Search size={22} color={MC.blue} strokeWidth={1.5} />
      </div>
      <div style={{ fontFamily: MF.body, fontSize: 14, color: MC.inkFaint }}>
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
    <div ref={rowRef} style={{ padding: `${MSP.sm}px 0` }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} style={{ padding: `${MSP.md}px ${MSP.lg}px`, borderBottom: `1px solid ${MC.hair}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="sk-bar" style={{ width: `${55 + (i % 3) * 12}%`, height: 11, borderRadius: 4, background: MC.blueSoft }} />
          <div className="sk-bar" style={{ width: `${72 - (i % 4) * 9}%`, height: 9, borderRadius: 4, background: MC.hair }} />
        </div>
      ))}
    </div>
  );
}

function Note({ children, tone }) {
  return (
    <div style={{ padding: `${MSP.xl}px ${MSP.lg}px`, fontFamily: MF.body, fontSize: 13, color: tone === "danger" ? MC.danger : MC.inkFaint }}>
      {children}
    </div>
  );
}
