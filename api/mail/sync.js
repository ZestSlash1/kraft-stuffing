// POST /api/mail/sync?accountId=<id|all> — pull IMAP → mail_messages so reads stay
// DB-only. This is the ONLY read-triggered code path allowed to touch IMAP, and it
// never blocks a render: the client fires it in the background after painting cached
// DB data. Also runs on a Vercel cron (see vercel.json) as a freshness safety net.
//
// accountId omitted/'all' → sync every active account concurrently, isolating
// per-account failures. Explicit id → that account only (ownership-checked).
import { requireUser, httpError, withErrors, adminClient } from "../_lib/auth.js";
import { resolveAccount, listActiveAccounts, markAccountStatus } from "../_lib/mailAccount.js";
import { syncAccount } from "../_lib/mailSync.js";

export const config = { maxDuration: 60 };

// Same auth shape as the notify worker: the daily cron, a CRON_SECRET holder, or any
// logged-in user (the client triggers an on-demand sync). Cron runs have no user, so
// they sync every account across every owner.
async function resolveContext(req) {
  const db = adminClient();
  if (req.headers["x-vercel-cron"]) return { db, cron: true, user: null };
  const secret = process.env.CRON_SECRET;
  const header = req.headers.authorization || "";
  if (secret && header === `Bearer ${secret}`) return { db, cron: true, user: null };
  const user = await requireUser(req);
  return { db, cron: false, user };
}

function classify(err) {
  const m = (err?.message || "").toLowerCase();
  if (err?.authenticationFailed || m.includes("auth") || m.includes("login") || m.includes("credential"))
    return "auth_failed";
  if (m.includes("timeout")) return "timeout";
  return "sync_failed";
}

// Sync a list of decrypted accounts concurrently; return { [accountId]: errorCode }.
// POP3 accounts have no mail_messages mirror (see list.js/thread.js — they're fetched
// live instead), so there is nothing here for them to sync; skip silently.
async function syncMany(db, allAccounts) {
  const accounts = allAccounts.filter((a) => a.incoming_protocol !== "pop3");
  const errors = {};
  const settled = await Promise.allSettled(accounts.map((a) => syncAccount(db, a)));
  await Promise.all(
    settled.map(async (r, i) => {
      const acc = accounts[i];
      if (r.status === "fulfilled") {
        if (acc.status === "error") await markAccountStatus(acc.user_id, acc.id, "active");
      } else {
        const code = classify(r.reason);
        errors[acc.id] = code;
        if (code === "auth_failed" && acc.status !== "error")
          await markAccountStatus(acc.user_id, acc.id, "error");
      }
    })
  );
  return errors;
}

export default withErrors(async (req, res) => {
  // Client triggers with POST; Vercel cron fires GET. Reject anything else.
  if (req.method !== "POST" && req.method !== "GET") throw httpError(405, "Method not allowed");
  const { db, cron, user } = await resolveContext(req);

  // Cron: every active account across all owners.
  if (cron) {
    const { data: rows } = await db.from("mail_accounts").select("user_id").neq("status", "disabled");
    const owners = [...new Set((rows || []).map((r) => r.user_id))];
    const accounts = (await Promise.all(owners.map((uid) => listActiveAccounts(uid)))).flat();
    const errors = await syncMany(db, accounts);
    return res.status(200).json({ synced: accounts.length, errors });
  }

  // On-demand: this user's accounts only.
  const accountId = req.query.accountId ? req.query.accountId.toString() : null;
  const accounts =
    accountId && accountId !== "all"
      ? [await resolveAccount(user.id, accountId)]
      : await listActiveAccounts(user.id);
  const errors = await syncMany(db, accounts);
  return res.status(200).json({ synced: accounts.length, errors });
});
