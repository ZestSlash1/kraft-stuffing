// GET /api/mail/list?folder=INBOX&accountId=<id|all> — message headers for one folder,
// read DB-ONLY from the synced mail_messages mirror. No IMAP here: freshness comes
// from /api/mail/sync (cron + client-triggered background sync). accountId omitted →
// the caller's default account; accountId=all → merge every active account.
import { requireUser, httpError, withErrors, adminClient } from "../_lib/auth.js";
import { listAccountsMeta, resolveAccountMeta } from "../_lib/mailAccount.js";

const MAX = 50; // newest N messages per account (matches the sync window)

// Map a DB row onto the client message shape the inbox already expects.
function toMessage(row) {
  return {
    accountId: row.account_id,
    uid: Number(row.uid),
    subject: row.subject || "(no subject)",
    from: row.from_address || row.from_name ? { name: row.from_name || "", address: row.from_address || "" } : null,
    date: row.received_at || null,
    seen: !!row.seen,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
  };
}

// Newest MAX rows for one account+folder, ordered by received_at desc.
async function listForAccount(db, userId, accountId, folder) {
  const { data, error } = await db
    .from("mail_messages")
    .select("account_id, uid, subject, from_name, from_address, received_at, seen, attachments")
    .eq("user_id", userId)
    .eq("account_id", accountId)
    .eq("folder", folder)
    .order("received_at", { ascending: false })
    .limit(MAX);
  if (error) throw httpError(500, "Could not load messages");
  return (data || []).map(toMessage);
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
    const perAccount = await Promise.all(accounts.map((a) => listForAccount(db, user.id, a.id, folder)));
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
  const messages = await listForAccount(db, user.id, account.id, folder);
  return res.status(200).json({ folder, accountId: account.id, messages });
});
