// IMAP folder discovery + special-use resolution for the mail-actions layer.
// SERVER-ONLY. Populates mail_folders from an IMAP LIST and resolves the account's
// trash/junk targets (special-use → name fallback → per-account manual override).
import { openImap } from "./mailAccount.js";
import { adminClient, httpError } from "./auth.js";

// Map an IMAP \Special-Use flag (or \Xlist name) onto our special_use enum.
const SPECIAL_FLAGS = {
  "\\Inbox": "inbox",
  "\\Sent": "sent",
  "\\Trash": "trash",
  "\\Junk": "junk",
  "\\Drafts": "drafts",
  "\\Archive": "archive",
  "\\All": "archive",
};

// Name-match fallback when a server exposes no special-use flags. Ordered: the first
// pattern to match a folder's leaf name wins that role.
const NAME_FALLBACK = [
  { use: "trash", re: /^(trash|deleted( items| messages)?|bin)$/i },
  { use: "junk", re: /^(junk( e-?mail)?|spam|bulk( mail)?)$/i },
  { use: "sent", re: /^(sent( items| messages| mail)?)$/i },
  { use: "drafts", re: /^drafts?$/i },
  { use: "archive", re: /^archive$/i },
];

function leafName(path, delimiter) {
  if (!delimiter) return path;
  const parts = path.split(delimiter);
  return parts[parts.length - 1] || path;
}

// Turn one imapflow mailbox entry into a mail_folders row shape (special_use resolved
// from its flags only — name fallback is applied afterwards across the whole set so it
// never overrides an explicit special-use flag).
function toFolderRow(account, mbox) {
  const flags = mbox.flags || new Set();
  let special = null;
  if (mbox.specialUse && SPECIAL_FLAGS[mbox.specialUse]) special = SPECIAL_FLAGS[mbox.specialUse];
  else {
    for (const [flag, use] of Object.entries(SPECIAL_FLAGS)) {
      if (flags.has && flags.has(flag)) { special = use; break; }
    }
  }
  if (!special && mbox.path.toUpperCase() === "INBOX") special = "inbox";
  return {
    account_id: account.id,
    user_id: account.user_id,
    name: mbox.name || leafName(mbox.path, mbox.delimiter),
    path: mbox.path,
    delimiter: mbox.delimiter || ".",
    special_use: special,
  };
}

// Apply name-match fallback for any role not already claimed by a special-use flag.
function applyNameFallback(rows) {
  const claimed = new Set(rows.map((r) => r.special_use).filter(Boolean));
  for (const row of rows) {
    if (row.special_use) continue;
    const leaf = leafName(row.path, row.delimiter);
    for (const { use, re } of NAME_FALLBACK) {
      if (claimed.has(use)) continue;
      if (re.test(leaf)) { row.special_use = use; claimed.add(use); break; }
    }
  }
  return rows;
}

// Fetch the account's mailbox list over IMAP and upsert it into mail_folders. Reuses an
// already-open client when given one (folder sync piggybacks on the message-sync
// connection); otherwise opens + closes its own. `account` must carry a decrypted
// password. Best-effort per row; throws only on a LIST-level failure.
export async function syncFolders(db, account, existingClient = null) {
  const client = existingClient || (await openImap(account));
  try {
    const list = await client.list();
    const rows = applyNameFallback((list || []).map((m) => toFolderRow(account, m)));
    if (rows.length) {
      await db.from("mail_folders").upsert(rows, { onConflict: "account_id,path" });
      // Prune folders that no longer exist on the server. Best-effort: compare against
      // what's currently stored and delete the difference by id (avoids a fragile
      // server-side `not in (…)` string over arbitrary folder names).
      try {
        const keep = new Set(rows.map((r) => r.path));
        const { data: stored } = await db
          .from("mail_folders")
          .select("id, path")
          .eq("account_id", account.id);
        const staleIds = (stored || []).filter((s) => !keep.has(s.path)).map((s) => s.id);
        if (staleIds.length) await db.from("mail_folders").delete().in("id", staleIds);
      } catch {
        /* pruning is non-essential — a lingering folder just shows an extra picker row */
      }
    }
    return rows;
  } finally {
    if (!existingClient) await client.logout().catch(() => {});
  }
}

// Resolve the IMAP path for a special-use role ('trash' | 'junk' | …) for an account.
// Precedence: per-account manual override → special_use row in mail_folders. Returns
// null when nothing resolves (caller must surface a "set it in Settings" error).
export async function resolveSpecialFolder(db, account, use) {
  if (use === "trash" && account.trash_folder_path) return account.trash_folder_path;
  if (use === "junk" && account.junk_folder_path) return account.junk_folder_path;
  const { data } = await db
    .from("mail_folders")
    .select("path")
    .eq("account_id", account.id)
    .eq("special_use", use)
    .limit(1)
    .maybeSingle();
  return data?.path || null;
}

// Same as resolveSpecialFolder but throws a clear, client-safe error pointing the user
// at Mail Settings when the role can't be resolved.
export async function requireSpecialFolder(db, account, use) {
  const path = await resolveSpecialFolder(db, account, use);
  if (!path) {
    const label = use === "trash" ? "Trash" : use === "junk" ? "Junk" : use;
    const err = httpError(409, `no_${use}_folder`);
    err.detail = `No ${label} folder is set for this account. Set it in Mail Settings.`;
    throw err;
  }
  return path;
}

// List folders for an account from the mirror (for the "Move to…" picker + Settings).
export async function listFolders(userId, accountId) {
  const db = adminClient();
  const { data, error } = await db
    .from("mail_folders")
    .select("name, path, delimiter, special_use")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .order("special_use", { ascending: true, nullsFirst: false })
    .order("path", { ascending: true });
  if (error) throw httpError(500, "Could not load folders");
  return data || [];
}
