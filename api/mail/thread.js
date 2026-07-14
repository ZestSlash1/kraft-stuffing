// GET /api/mail/thread?uid=X&folder=Y&accountId=Z — full body for one message, read
// from the synced mail_messages mirror. Marks the message read locally (DB-only,
// instant); the sync worker pushes the \Seen flag to IMAP on its next run.
//
// Bodies are filled lazily by the sync worker. If a message is opened before its body
// has synced (html IS null), we back-fill it ONCE from IMAP here and persist it — every
// subsequent open is DB-only. This is the sole remaining read-path IMAP fallback.
import { simpleParser } from "mailparser";
import { requireUser, httpError, withErrors, adminClient } from "../_lib/auth.js";
import { resolveAccountMeta, getAccountById, openImap } from "../_lib/mailAccount.js";

export const config = { maxDuration: 45 };

function rowToPayload(row) {
  return {
    id: row.id,
    accountId: row.account_id,
    uid: Number(row.uid),
    subject: row.subject || "(no subject)",
    from: row.from_address || row.from_name ? { name: row.from_name || "", address: row.from_address || "" } : null,
    to: Array.isArray(row.to_recipients) ? row.to_recipients : [],
    cc: Array.isArray(row.cc_recipients) ? row.cc_recipients : [],
    date: row.received_at || null,
    seen: !!row.seen,
    flagged: !!row.flagged,
    html: row.html || null,
    text: row.body_text || "",
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
  };
}

const addrList = (v) => (v || []).map((a) => ({ name: a.name || "", address: a.address || "" }));

// One-time IMAP back-fill for a message whose body hasn't synced yet. Persists the
// parsed body so future opens are DB-only. Requires the decrypted account.
async function backfillBody(db, userId, account, folder, uid, row) {
  const client = await openImap(account);
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
      if (!msg) throw httpError(404, "Message not found");
      const parsed = await simpleParser(msg.source);
      const patch = {
        html: parsed.html || "",
        body_text: parsed.text || "",
        to_recipients: parsed.to?.value ? addrList(parsed.to.value) : row.to_recipients,
        cc_recipients: parsed.cc?.value ? addrList(parsed.cc.value) : row.cc_recipients,
        attachments: (parsed.attachments || []).map((a) => ({
          filename: a.filename || "attachment",
          contentType: a.contentType || "",
          size: a.size || 0,
        })),
      };
      await db
        .from("mail_messages")
        .update(patch)
        .eq("user_id", userId)
        .eq("account_id", account.id)
        .eq("folder", folder)
        .eq("uid", uid);
      return { ...row, ...patch };
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }
}

export default withErrors(async (req, res) => {
  if (req.method !== "GET") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const db = adminClient();
  const uid = (req.query.uid || "").toString();
  const folder = (req.query.folder || "INBOX").toString();
  const accountId = req.query.accountId ? req.query.accountId.toString() : null;
  if (!uid) throw httpError(400, "uid is required");

  const account = await resolveAccountMeta(user.id, accountId);
  const { data: row, error } = await db
    .from("mail_messages")
    .select("*")
    .eq("user_id", user.id)
    .eq("account_id", account.id)
    .eq("folder", folder)
    .eq("uid", uid)
    .maybeSingle();
  if (error) throw httpError(500, "Could not load message");
  if (!row) throw httpError(404, "Message not found — try syncing");

  // Mark read locally (instant, DB-only). Sync worker pushes \Seen to IMAP later.
  if (!row.seen) {
    await db
      .from("mail_messages")
      .update({ seen: true, seen_synced: false })
      .eq("user_id", user.id)
      .eq("account_id", account.id)
      .eq("folder", folder)
      .eq("uid", uid);
  }

  // Body not synced yet → one-time IMAP back-fill (needs the decrypted account).
  let full = row;
  if (row.html === null) {
    const decrypted = await getAccountById(user.id, account.id);
    full = await backfillBody(db, user.id, decrypted, folder, uid, row);
  }

  res.status(200).json(rowToPayload(full));
});
