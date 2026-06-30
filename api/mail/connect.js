// POST /api/mail/connect — body: { email, password }. Test-connects against
// Hostinger IMAP, then encrypts + upserts the caller's mail_accounts row.
import { ImapFlow } from "imapflow";
import { requireUser, adminClient, httpError, withErrors, readJsonBody } from "../_lib/auth.js";
import { encrypt } from "../_lib/mailCrypto.js";

const IMAP_HOST = "imap.hostinger.com";
const IMAP_PORT = 993;
const SMTP_HOST = "smtp.hostinger.com";
const SMTP_PORT = 465;

export default withErrors(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const { email, password } = readJsonBody(req);
  if (!email || !password) throw httpError(400, "email and password are required");

  // Verify the credentials work before persisting them.
  const probe = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: email, pass: password },
    logger: false,
  });
  try {
    await probe.connect();
    await probe.logout();
  } catch {
    throw httpError(401, "Could not sign in to Hostinger with that email + password");
  }

  const supabase = adminClient();
  const { error } = await supabase.from("mail_accounts").upsert(
    {
      user_id: user.id,
      email_address: email,
      imap_host: IMAP_HOST,
      imap_port: IMAP_PORT,
      smtp_host: SMTP_HOST,
      smtp_port: SMTP_PORT,
      password_encrypted: encrypt(password),
    },
    { onConflict: "user_id" }
  );
  if (error) throw httpError(500, "Could not save mail account");

  res.status(200).json({ ok: true, email });
});
