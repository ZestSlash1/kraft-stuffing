// POST /api/mail/connect — body: { email, password, display_name?, color? }.
// Test-connects against Hostinger IMAP, then encrypts + upserts the caller's
// mail_accounts row. A user may connect up to MAX_ACCOUNTS mailboxes; the cap is
// enforced HERE (server-side), not only in the UI. Re-connecting an existing address
// updates its credentials in place and does not count against the cap.
import { ImapFlow } from "imapflow";
import { requireUser, adminClient, httpError, withErrors, readJsonBody } from "../_lib/auth.js";
import { encrypt } from "../_lib/mailCrypto.js";
import { MAX_ACCOUNTS, ACCOUNT_COLORS } from "../_lib/mailAccount.js";

const IMAP_HOST = "imap.hostinger.com";
const IMAP_PORT = 993;
const SMTP_HOST = "smtp.hostinger.com";
const SMTP_PORT = 465;

export default withErrors(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const { email: rawEmail, password, display_name, color } = readJsonBody(req);
  if (!rawEmail || !password) throw httpError(400, "email and password are required");
  const email = rawEmail.trim().toLowerCase();

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

  // Existing rows for this user: decide re-connect vs. new, and enforce the cap.
  const { data: existing, error: listErr } = await supabase
    .from("mail_accounts")
    .select("id, email_address")
    .eq("user_id", user.id);
  if (listErr) throw httpError(500, "Could not load mail accounts");
  const rows = existing || [];
  const match = rows.find((r) => r.email_address === email);
  if (!match && rows.length >= MAX_ACCOUNTS) {
    throw httpError(409, `You can connect at most ${MAX_ACCOUNTS} mailboxes.`);
  }

  const isFirst = rows.length === 0;
  const record = {
    user_id: user.id,
    email_address: email,
    imap_host: IMAP_HOST,
    imap_port: IMAP_PORT,
    smtp_host: SMTP_HOST,
    smtp_port: SMTP_PORT,
    password_encrypted: encrypt(password),
    status: "active",
  };
  // Metadata is only applied on first insert of an address — re-connect keeps the
  // user's chosen name/colour/default and just refreshes credentials + status.
  if (!match) {
    record.display_name = (display_name || "").trim() || email;
    record.color = color || ACCOUNT_COLORS[rows.length % ACCOUNT_COLORS.length];
    record.sort_order = rows.length;
    record.is_default = isFirst;
  }

  const { data: saved, error } = await supabase
    .from("mail_accounts")
    .upsert(record, { onConflict: "user_id,email_address" })
    .select("id, email_address, display_name, color, is_default, status")
    .single();
  if (error) throw httpError(500, "Could not save mail account");

  res.status(200).json({ ok: true, account: saved });
});
