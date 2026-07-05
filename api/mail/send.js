// POST /api/mail/send — body: { to, subject, html, replyToUid?, accountId? }.
// Sends via the chosen account's Hostinger SMTP and appends its signature if absent.
// The sending account is ALWAYS explicit from the client (or the caller's default) —
// never inferred from "the account", since a user now has several.
import { requireUser, httpError, withErrors, readJsonBody } from "../_lib/auth.js";
import { resolveAccount, makeTransport } from "../_lib/mailAccount.js";

export default withErrors(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const { to, subject, html, replyToUid, accountId } = readJsonBody(req);
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
    subject,
    html: body,
    inReplyTo: replyToUid ? `<${replyToUid}>` : undefined,
  });

  res.status(200).json({ ok: true, messageId: info.messageId, accountId: account.id });
});
