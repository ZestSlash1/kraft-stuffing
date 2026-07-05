// GET /api/mail/list?folder=INBOX&accountId=<id|all> — message headers for one folder.
// accountId omitted → the caller's default account. accountId=all → merge every active
// account's page window, isolating per-account failures.
import { requireUser, httpError, withErrors } from "../_lib/auth.js";
import {
  resolveAccount,
  listActiveAccounts,
  markAccountStatus,
  openImap,
} from "../_lib/mailAccount.js";

const MAX = 50; // newest N messages per account
const PER_ACCOUNT_TIMEOUT = 10000; // one slow/broken mailbox must not stall the rest

// Classify a fetch failure into a short, credential-free code for the client.
function classifyError(err) {
  const m = (err?.message || "").toLowerCase();
  if (m.includes("auth") || m.includes("login") || m.includes("credential")) return "auth_failed";
  if (m.includes("timeout")) return "timeout";
  return "sync_failed";
}

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// Fetch header rows for one decrypted account. Opens + always closes its own IMAP
// connection so one account's teardown can't affect another's.
async function fetchHeaders(account, folder) {
  const client = await openImap(account);
  const messages = [];
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const total = client.mailbox.exists;
      if (total > 0) {
        const start = Math.max(1, total - MAX + 1);
        for await (const msg of client.fetch(`${start}:*`, {
          uid: true,
          flags: true,
          envelope: true,
          internalDate: true,
        })) {
          const from = msg.envelope?.from?.[0];
          messages.push({
            accountId: account.id,
            uid: msg.uid,
            subject: msg.envelope?.subject || "(no subject)",
            from: from ? { name: from.name || "", address: from.address || "" } : null,
            date: msg.envelope?.date || msg.internalDate || null,
            seen: msg.flags?.has ? msg.flags.has("\\Seen") : false,
          });
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
  messages.reverse(); // newest first
  return messages;
}

export default withErrors(async (req, res) => {
  if (req.method !== "GET") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const folder = (req.query.folder || "INBOX").toString();
  const accountId = req.query.accountId ? req.query.accountId.toString() : null;

  // ── All-inboxes: fetch each active account concurrently, merge by date desc. ──
  if (accountId === "all") {
    const accounts = await listActiveAccounts(user.id);
    const settled = await Promise.allSettled(
      accounts.map((a) => withTimeout(fetchHeaders(a, folder), PER_ACCOUNT_TIMEOUT))
    );

    const messages = [];
    const errors = {}; // { accountId: 'auth_failed' | 'timeout' | 'sync_failed' }
    const statusWrites = [];
    settled.forEach((r, i) => {
      const acc = accounts[i];
      if (r.status === "fulfilled") {
        messages.push(...r.value);
        if (acc.status === "error") statusWrites.push(markAccountStatus(user.id, acc.id, "active"));
      } else {
        const code = classifyError(r.reason);
        errors[acc.id] = code;
        if (code === "auth_failed" && acc.status !== "error") {
          statusWrites.push(markAccountStatus(user.id, acc.id, "error"));
        }
      }
    });
    // Await status bookkeeping before responding — a serverless function may be frozen
    // right after res.json, dropping still-pending writes. markAccountStatus never throws.
    await Promise.all(statusWrites);
    messages.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    // Lightweight per-account meta so the client can colour/tag rows without secrets.
    const accountsMeta = accounts.map((a) => ({
      id: a.id,
      email_address: a.email_address,
      display_name: a.display_name || a.email_address,
      color: a.color || null,
    }));
    return res.status(200).json({ folder, accountId: "all", messages, errors, accounts: accountsMeta });
  }

  // ── Single account (explicit id or the caller's default). ──
  const account = await resolveAccount(user.id, accountId);
  try {
    const messages = await fetchHeaders(account, folder);
    if (account.status === "error") await markAccountStatus(user.id, account.id, "active");
    return res.status(200).json({ folder, accountId: account.id, messages });
  } catch (err) {
    if (classifyError(err) === "auth_failed") await markAccountStatus(user.id, account.id, "error");
    throw err;
  }
});
