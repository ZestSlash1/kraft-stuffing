import { useCallback, useEffect, useRef, useState } from "react";

// useAutosave — debounced field-level persistence with an honest status.
//
// The IGM entry forms have no Save button (PHASE_IGM_MANIFEST_MODULE.md §4), so
// the status this returns is the only signal the user gets: it must never claim
// "saved" for a write that hasn't landed. Edits accumulate into one patch object
// and flush together, so typing across four fields is one round-trip.
//
//   const { status, queue, flush } = useAutosave((patch) => updateIgmBl(id, patch));
//   <input onChange={(e) => queue({ blNumber: e.target.value })} />
//
// `commit` must return { error } (the runWrite contract). A queued offline write
// resolves without an error, so it correctly reports as saved — db.js replays it
// on reconnect.
export function useAutosave(commit, { delay = 700, onDirtyChange } = {}) {
  const [status, setStatus] = useState("saved"); // saved | unsaved | saving | error
  const pending = useRef({});
  const timer = useRef(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const dirtyCb = useRef(onDirtyChange);
  dirtyCb.current = onDirtyChange;

  const setStatusAndDirty = useCallback((next) => {
    setStatus(next);
    dirtyCb.current?.(next === "unsaved" || next === "saving" || next === "error");
  }, []);

  const flush = useCallback(async () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const patch = pending.current;
    if (!Object.keys(patch).length) return { error: null };
    pending.current = {};
    setStatusAndDirty("saving");
    const res = (await commitRef.current(patch)) || {};
    if (res.error) {
      // Put the patch back so a later flush (or retry) still carries the edit.
      pending.current = { ...patch, ...pending.current };
      setStatusAndDirty("error");
      return res;
    }
    // Only clear if nothing new was typed while the write was in flight.
    setStatusAndDirty(Object.keys(pending.current).length ? "unsaved" : "saved");
    return res;
  }, [setStatusAndDirty]);

  const queue = useCallback(
    (patch) => {
      pending.current = { ...pending.current, ...patch };
      setStatusAndDirty("unsaved");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        flush();
      }, delay);
    },
    [delay, flush, setStatusAndDirty]
  );

  // Flush a pending edit on unmount and on tab hide — leaving the view must not
  // silently drop the last keystroke.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  return { status, queue, flush, hasPending: () => Object.keys(pending.current).length > 0 };
}

export default useAutosave;
