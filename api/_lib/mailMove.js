// The one IMAP primitive shared by Delete, Move-to, and Mark-as-Junk: move a set of
// UIDs from one mailbox to another. SERVER-ONLY.
//
// Prefers UID MOVE (RFC 6851) when the server advertises the MOVE capability; otherwise
// falls back to UID COPY → set \Deleted on the source → EXPUNGE. imapflow's messageMove
// already implements that fallback internally, but we branch explicitly so the
// COPY+delete path is exercised (and observable) on servers without MOVE rather than
// silently assumed.
import { openImap } from "./mailAccount.js";

// Move `uids` from `source` mailbox to `target` mailbox over one IMAP connection.
// Returns { newUidByOld: { [oldUid]: newUid|null }, moved: number }. A null new UID
// means the server didn't report a UIDPLUS mapping (move still happened) — callers that
// need to undo should re-resolve by Message-ID/sync in that case.
export async function moveMessages(account, source, target, uids, existingClient = null) {
  const client = existingClient || (await openImap(account));
  const numeric = uids.map((u) => Number(u)).filter((n) => Number.isFinite(n));
  const newUidByOld = {};
  try {
    if (numeric.length === 0) return { newUidByOld, moved: 0 };
    const supportsMove = client.capabilities?.has ? client.capabilities.has("MOVE") : false;
    const lock = await client.getMailboxLock(source);
    let uidMap;
    try {
      if (supportsMove) {
        // UID MOVE — atomic on the server. uidMap: source UID → destination UID.
        const res = await client.messageMove(numeric, target, { uid: true });
        uidMap = res?.uidMap;
      } else {
        // Fallback: COPY to target, then delete (STORE +\Deleted + EXPUNGE) on source.
        const res = await client.messageCopy(numeric, target, { uid: true });
        uidMap = res?.uidMap;
        await client.messageDelete(numeric, { uid: true });
      }
    } finally {
      lock.release();
    }
    for (const old of numeric) {
      const mapped = uidMap && (uidMap.get ? uidMap.get(old) : uidMap[old]);
      newUidByOld[old] = mapped != null ? Number(mapped) : null;
    }
    return { newUidByOld, moved: numeric.length };
  } finally {
    if (!existingClient) await client.logout().catch(() => {});
  }
}
