// GET /api/mail/list?folder=INBOX&accountId=<id|all> — message headers for one folder.
// IMAP accounts read DB-ONLY from the synced mail_messages mirror (freshness comes from
// /api/mail/sync). POP3 accounts have no server-side folders or persistent flags for a
// mirror to reconcile against, so they're fetched LIVE here instead (INBOX only — POP3
// has no Sent/Junk/Archive mailbox for other folders to return). accountId omitted →
// the caller's default account; accountId=all → merge every active account.
import { requireUser, httpError, withErrors, adminClient } from "../_lib/auth.js";
import { listAccountsMeta, resolveAccountMeta, getAccountById } from "../_lib/mailAccount.js";
import { listPop3Messages } from "../_lib/mailPop3.js";

export const config = { maxDuration: 45 }; // POP3 live fetch is a full handshake per request

const MAX = 50; // newest N messages per account (matches the sync window)

// Map a DB row onto the client message shape the inbox already expects.
function toMessage(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    uid: Number(row.uid),
    subject: row.subject || "(no subject)",
    from: row.from_address || row.from_name ? { name: row.from_name || "", address: row.from_address || "" } : null,
    date: row.received_at || null,
    seen: !!row.seen,
    flagged: !!row.flagged,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
  };
}

// Newest MAX rows for one IMAP account+folder, ordered by received_at desc.
async function listForAccount(db, userId, accountId, folder) {
  const { data, error } = await db
    .from("mail_messages")
    .select("id, account_id, uid, subject, from_name, from_address, received_at, seen, flagged, attachments")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("folder", folder)
    .order("received_at", { ascending: false })
    .limit(MAX);
  if (error) throw httpError(500, "Could not load messages");
  return (data || []).map(toMessage);
}

// Live POP3 fetch — INBOX only. Any other folder is simply empty (no server mailbox
// for it to come from). Needs decrypted credentials, unlike the DB-only IMAP path.
async function listPop3ForAccount(userId, accountMeta, folder) {
  if (folder !== "INBOX") return [];
  const account = await getAccountById(userId, accountMeta.id);
  const messages = await listPop3Messages(account, MAX);
  return messages.map((m) => ({
    id: `pop3:${accountMeta.id}:${m.uid}`,
    accountId: accountMeta.id,
    uid: m.uid,
    subject: m.subject,
    from: m.from,
    date: m.date,
    seen: m.seen,
    flagged: m.flagged,
    attachments: m.attachments,
  }));
}

function listForMeta(db, userId, accountMeta, folder) {
  return accountMeta.incoming_protocol === "pop3"
    ? listPop3ForAccount(userId, accountMeta, folder)
    : listForAccount(db, userId, accountMeta.id, folder);
}

export default withErrors(async (req, res) => {
  if (req.method !== "GET") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const db = adminClient();
  const folder = (req.query.folder || "INBOX").toString();
  const accountId = req.query.accountId ? req.query.accountId.toString() : null;

  // ── All-inboxes: query each active account, merge by date desc. ──
  if (accountId === "all") {
    const accounts = await listAccountsMeta(user.id);
    const perAccount = await Promise.all(
      accounts.map((a) => listForMeta(db, user.id, a, folder).catch(() => []))
    );
    const messages = perAccount.flat().sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const accountsMeta = accounts.map((a) => ({
      id: a.id,
      email_address: a.email_address,
      display_name: a.display_name || a.email_address,
      color: a.color || null,
    }));
    return res.status(200).json({ folder, accountId: "all", messages, errors: {}, accounts: accountsMeta });
  }

  // ── Single account (explicit id or the caller's default). ──
  const account = await resolveAccountMeta(user.id, accountId);
  const messages = await listForMeta(db, user.id, account, folder);
  return res.status(200).json({ folder, accountId: account.id, messages });
});
