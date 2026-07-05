// GET /api/mail/thread?uid=X&folder=Y&accountId=Z — full parsed body for one message;
// marks read. accountId omitted → default account. A thread is always single-account.
import { simpleParser } from "mailparser";
import { requireUser, httpError, withErrors } from "../_lib/auth.js";
import { resolveAccount, openImap } from "../_lib/mailAccount.js";

export default withErrors(async (req, res) => {
  if (req.method !== "GET") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const uid = (req.query.uid || "").toString();
  const folder = (req.query.folder || "INBOX").toString();
  const accountId = req.query.accountId ? req.query.accountId.toString() : null;
  if (!uid) throw httpError(400, "uid is required");

  const account = await resolveAccount(user.id, accountId);
  const client = await openImap(account);
  let payload;
  try {
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(uid, { uid: true, source: true }, { uid: true });
      if (!msg) throw httpError(404, "Message not found");
      const parsed = await simpleParser(msg.source);
      payload = {
        accountId: account.id, // reply From defaults to the account that received it
        uid: Number(uid),
        subject: parsed.subject || "(no subject)",
        from: parsed.from?.value?.[0] || null,
        to: parsed.to?.value || [],
        date: parsed.date || null,
        html: parsed.html || null,
        text: parsed.text || "",
      };
      // Mark as read.
      await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  res.status(200).json(payload);
});
