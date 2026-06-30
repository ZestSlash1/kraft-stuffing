// GET /api/mail/list?folder=INBOX — message headers for one folder.
import { requireUser, httpError, withErrors } from "../_lib/auth.js";
import { getAccount, openImap } from "../_lib/mailAccount.js";

const MAX = 50; // newest N messages

export default withErrors(async (req, res) => {
  if (req.method !== "GET") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const folder = (req.query.folder || "INBOX").toString();

  const account = await getAccount(user.id);
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
    await client.logout();
  }

  messages.reverse(); // newest first
  res.status(200).json({ folder, messages });
});
