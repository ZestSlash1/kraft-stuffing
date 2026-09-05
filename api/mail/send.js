// POST /api/mail/send — body: { to, cc?, bcc?, subject, html, replyToUid?, accountId?,
//   attachments?: [{ filename, path, contentType? }] }.
// Sends via the chosen account's Hostinger SMTP and appends its signature if absent.
// The sending account is ALWAYS explicit from the client (or the caller's default) —
// never inferred from "the account", since a user now has several.
// `attachments[].path` is a key inside the private Supabase `attachments` bucket
// (uploaded client-side by the compose card) — downloaded here as a buffer so
// nodemailer can attach real content, never a bare public URL.
import { requireUser, httpError, withErrors, readJsonBody, adminClient } from "../_lib/auth.js";
import { resolveAccount, makeTransport } from "../_lib/mailAccount.js";

// Sending over a slow SMTP host (+ attachment downloads) — raise above Vercel's
// short default.
export const config = { maxDuration: 45 };

// Resolve compose attachment refs into nodemailer attachment objects by downloading
// each from the private `attachments` Storage bucket. Best-effort per file: a single
// missing/corrupt object shouldn't sink the whole send.
export async function resolveAttachments(refs) {
  if (!Array.isArray(refs) || !refs.length) return [];
  const db = adminClient();
  const resolved = await Promise.all(
    refs.map(async (ref) => {
      if (!ref?.path) return null;
      const { data, error } = await db.storage.from("attachments").download(ref.path);
      if (error || !data) return null;
      const buffer = Buffer.from(await data.arrayBuffer());
      return { filename: ref.filename || ref.path.split("/").pop(), content: buffer, contentType: ref.contentType };
    })
  );
  return resolved.filter(Boolean);
}

export default withErrors(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const { to, cc, bcc, subject, html, replyToUid, accountId, attachments } = readJsonBody(req);
  if (!to || !subject) throw httpError(400, "to and subject are required");

  // resolveAccount ownership-checks accountId and returns the full row (incl. its
  // own signature_html), so no separate signature read is needed.
  const account = await resolveAccount(user.id, accountId);
  const signature = account.signature_html || "";

  let body = html || "";
  if (signature && !body.includes(signature)) {
    body = `${body}<br><br>${signature}`;
  }

  const transport = makeTransport(account);
  const info = await transport.sendMail({
    from: account.email_address,
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject,
    html: body,
    inReplyTo: replyToUid ? `<${replyToUid}>` : undefined,
    attachments: await resolveAttachments(attachments),
  });

  res.status(200).json({ ok: true, messageId: info.messageId, accountId: account.id });
});
