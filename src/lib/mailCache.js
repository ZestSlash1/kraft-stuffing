// In-memory, stale-while-revalidate cache for mail list reads.
//
// Reads currently hit live IMAP (via /api/mail/list) — one auth handshake + fetch
// per account, so a cold read is slow by nature. This cache keeps the last good
// result per (folder, account) in module scope so it survives InboxView unmounts
// (folder switches) and accountId prop changes (account switches). Switching back to
// an already-loaded account renders instantly from cache while a background refresh
// silently updates it — the same offline-first "serve cached, sync behind" philosophy
// as runWrite/flushQueue elsewhere in the portal.
//
// Module scope (not React state) is deliberate: the entry must outlive the component
// so a remount reads the previous result synchronously with zero refetch delay.
import { useCallback, useEffect, useRef, useState } from "react";
import { mailApi } from "./mailApi";

const FRESH_MS = 30000; // within this age, cached data is treated as fresh (skip nothing, but no "stale" tag)
const cache = new Map(); // key -> { messages, errors, accounts, ts }

const keyOf = (folder, accountId) => `${folder}::${accountId ?? "default"}`;

export function readMailCache(folder, accountId) {
  return cache.get(keyOf(folder, accountId)) || null;
}

function writeMailCache(folder, accountId, value) {
  cache.set(keyOf(folder, accountId), { ...value, ts: Date.now() });
}

// Mutate the cached messages array for a key in place (e.g. flip a message to seen
// after opening it) so switching away and back preserves the change without a refetch.
export function patchMailCache(folder, accountId, updater) {
  const entry = cache.get(keyOf(folder, accountId));
  if (!entry) return;
  cache.set(keyOf(folder, accountId), { ...entry, messages: updater(entry.messages || []) });
}

// SWR-style hook for one folder+account list.
// Returns cached data immediately (if any) and refreshes in the background. `loading`
// is true only on a cold read with no cache to show — never when we already have data.
export function useMailList(folder, accountId) {
  const initial = readMailCache(folder, accountId);
  const [data, setData] = useState(initial); // { messages, errors, accounts } | null
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState("");
  const reqId = useRef(0);

  const load = useCallback(
    (background) => {
      const cached = readMailCache(folder, accountId);
      if (!background && cached) {
        setData(cached); // paint cache instantly, then revalidate below
        background = true; // we have something on screen — refresh silently
      }
      if (!background) setLoading(true);
      setError("");
      const id = ++reqId.current;
      return mailApi
        .list(folder, accountId)
        .then((r) => {
          if (id !== reqId.current) return; // a newer switch superseded this fetch
          const value = { messages: r.messages || [], errors: r.errors || {}, accounts: r.accounts || null };
          writeMailCache(folder, accountId, value);
          setData(value);
        })
        .catch((e) => {
          if (id !== reqId.current) return;
          if (!readMailCache(folder, accountId)) setError(e.message); // only surface if nothing cached to show
        })
        .finally(() => {
          if (id === reqId.current) setLoading(false);
        });
    },
    [folder, accountId]
  );

  // Kick a background IMAP→DB sync, then reload the (now-fresh) list from the DB. The
  // read path itself never touches IMAP — this is the only place that pulls, and it
  // never blocks: the UI already shows cached/DB data while this runs. Best-effort.
  const syncThenReload = useCallback(() => {
    mailApi
      .sync(accountId)
      .then(() => load(true))
      .catch(() => {}); // a sync failure leaves the last good DB data on screen
  }, [accountId, load]);

  // On folder/account change: show cache synchronously, read DB, then sync in background.
  useEffect(() => {
    const cached = readMailCache(folder, accountId);
    setData(cached);
    setLoading(!cached);
    setError("");
    load(!!cached).then(() => syncThenReload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, accountId]);

  // Background refresh on focus / visibility / 30s tick — never blocks the UI.
  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && syncThenReload();
    const interval = setInterval(tick, FRESH_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder, accountId]);

  // Optimistically patch both local state and the shared cache.
  const patchMessages = useCallback(
    (updater) => {
      patchMailCache(folder, accountId, updater);
      setData((d) => (d ? { ...d, messages: updater(d.messages || []) } : d));
    },
    [folder, accountId]
  );

  return { data, loading, error, refresh: () => load(false), patchMessages };
}
