import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "../context/RouterContext";

// Dirty-form guard: call markDirty() on first change, markClean() on
// save/discard. Clears the flag automatically on unmount.
export function useDirtyGuard() {
  const { setDirty } = useRouter();
  const dirtyRef = useRef(false);

  const markDirty = useCallback(() => {
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
    }
  }, [setDirty]);

  const markClean = useCallback(() => {
    if (dirtyRef.current) {
      dirtyRef.current = false;
      setDirty(false);
    }
  }, [setDirty]);

  useEffect(() => () => markClean(), [markClean]);

  return { markDirty, markClean };
}
