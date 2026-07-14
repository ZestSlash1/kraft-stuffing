// Shared server logic for the message actions (move / delete / junk). SERVER-ONLY.
// Wraps the IMAP move primitive with mirror bookkeeping so the DB read layer reflects
// the action instantly on the next read.
import { httpError } from "./auth.js";
import { resolveSpecialFolder } from "./mailFolders.js";
import { moveMessages } from "./mailMove.js";

// The mirror keys reads by a coarse folder ('INBOX' | 'Sent'). Map that key onto the
// real IMAP mailbox path for this account (INBOX is literal; Sent may be nested, e.g.
// "INBOX.Sent"). Anything else is treated as an explicit IMAP path already.
export async function imapPathForFolderKey(db, account, folderKey) {
  if (!folderKey || folderKey.toUpperCase() === "INBOX") return "INBOX";
  if (folderKey === "Sent") return (await resolveSpecialFolder(db, account, "sent")) || "Sent";
  return folderKey;
}

// Perform the move on IMAP and drop the moved rows from the source folder's mirror so
// they leave the list immediately on the next read. Returns { newUidByOld, moved }.
// `sourceFolderKey` is the mirror key ('INBOX'|'Sent'); `targetPath` is a real IMAP path.
export async function performMove(db, account, sourceFolderKey, targetPath, uids) {
  const sourcePath = await imapPathForFolderKey(db, account, sourceFolderKey);
  if (sourcePath === targetPath) throw httpError(400, "Source and target are the same folder");

  let result;
  try {
    result = await moveMessages(account, sourcePath, targetPath, uids);
  } catch (err) {
    // A UID that no longer exists (moved by another client) surfaces here — let the
    // caller translate it into a "already moved" reconcile rather than a raw error.
    const m = (err?.message || "").toLowerCase();
    if (m.includes("not found") || m.includes("invalid") || m.includes("no such")) {
      throw httpError(410, "already_moved");
    }
    throw err;
  }

  // Remove the moved UIDs from the source mirror (the mirror only covers readable
  // folders; the message now lives in a folder we don't mirror for reading).
  const numeric = uids.map((u) => Number(u)).filter((n) => Number.isFinite(n));
  if (numeric.length) {
    await db
      .from("mail_messages")
      .delete()
      .eq("account_id", account.id)
      .eq("folder", sourceFolderKey || "INBOX")
      .in("uid", numeric);
  }
  return result;
}

// Normalise + validate a UID array from a request body.
export function readUids(body) {
  const raw = body?.message_uids ?? body?.uids ?? [];
  const uids = (Array.isArray(raw) ? raw : [raw]).map((u) => Number(u)).filter((n) => Number.isFinite(n));
  if (uids.length === 0) throw httpError(400, "message_uids is required");
  return uids;
}
