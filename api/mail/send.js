// POST /api/mail/send — body: { to, subject, html, replyToUid? }.
// Sends via the caller's Hostinger SMTP and appends their signature if absent.
import { requireUser, adminClient, httpError, withErrors, readJsonBody } from "../_lib/auth.js";
import { getAccount, makeTransport } from "../_lib/mailAccount.js";

export default withErrors(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const { to, subject, html, replyToUid } = readJsonBody(req);
  if (!to || !subject) throw httpError(400, "to and subject are required");

  const account = await getAccount(user.id);

  // Read the stored signature (decrypted account doesn't carry it through, re-read).
  const supabase = adminClient();
  const { data: row } = await supabase
    .from("mail_accounts")
    .select("signature_html")
    .eq("user_id", user.id)
    .maybeSingle();
  const signature = row?.signature_html || "";

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

  res.status(200).json({ ok: true, messageId: info.messageId });
});
