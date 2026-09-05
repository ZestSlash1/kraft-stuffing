// POST /api/mail/connect — body: { email, password, display_name?, color?,
//   imap_host, imap_port, imap_security, smtp_host, smtp_port, smtp_security }.
// Test-connects IMAP + SMTP with the SUBMITTED per-account settings, then encrypts
// + upserts the caller's mail_accounts row. There is no shared Hostinger constant
// anymore — the client sends the provider's servers (a preset merely prefills them).
// A user may connect up to MAX_ACCOUNTS mailboxes; the cap is enforced HERE
// (server-side), not only in the UI. Re-connecting an existing address updates its
// credentials + settings in place and does not count against the cap.
import { requireUser, adminClient, httpError, withErrors, readJsonBody } from "../_lib/auth.js";
import { encrypt } from "../_lib/mailCrypto.js";
import { MAX_ACCOUNTS, ACCOUNT_COLORS, testConnect } from "../_lib/mailAccount.js";
import { syncFolders } from "../_lib/mailFolders.js";

const SECURITY_MODES = new Set(["ssl", "starttls", "none"]);
// node-pop3 (the POP3 client) has no STLS support — POP3 accounts can only use
// implicit TLS or plaintext, never a STARTTLS upgrade.
const POP3_SECURITY_MODES = new Set(["ssl", "none"]);
const INCOMING_PROTOCOLS = new Set(["imap", "pop3"]);

// Validate + normalize the seven connection fields from the client. Throws 400 on
// anything missing/invalid so we never persist a half-configured account.
function readConnection(body) {
  const host = (v, name) => {
    const s = (v || "").toString().trim();
    if (!s) throw httpError(400, `${name} is required`);
    return s;
  };
  const port = (v, name) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 65535) throw httpError(400, `${name} must be a valid port`);
    return n;
  };
  const sec = (v, name, allowed) => {
    const s = (v || "").toString().trim().toLowerCase();
    if (!allowed.has(s)) throw httpError(400, `${name} must be ${[...allowed].join(", ")}`);
    return s;
  };
  const incoming_protocol = (body.incoming_protocol || "imap").toString().trim().toLowerCase();
  if (!INCOMING_PROTOCOLS.has(incoming_protocol)) throw httpError(400, "incoming_protocol must be imap or pop3");
  return {
    incoming_protocol,
    imap_host: host(body.imap_host, "imap_host"),
    imap_port: port(body.imap_port, "imap_port"),
    imap_security: sec(body.imap_security, "imap_security", incoming_protocol === "pop3" ? POP3_SECURITY_MODES : SECURITY_MODES),
    smtp_host: host(body.smtp_host, "smtp_host"),
    smtp_port: port(body.smtp_port, "smtp_port"),
    smtp_security: sec(body.smtp_security, "smtp_security", SECURITY_MODES),
  };
}

// Slow mail providers (e.g. Zimbra proxies) can take ~10s+ per handshake, and
// connect runs an IMAP + SMTP test-connect back-to-back. Raise the function budget
// above Vercel's short default so a healthy-but-slow server isn't killed mid-probe.
export const config = { maxDuration: 45 };

export default withErrors(async (req, res) => {
  if (req.method !== "POST") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const body = readJsonBody(req);
  const { email: rawEmail, password, display_name, color } = body;
  if (!rawEmail || !password) throw httpError(400, "email and password are required");
  const email = rawEmail.trim().toLowerCase();
  const conn = readConnection(body);

  // Verify BOTH IMAP and SMTP work with the submitted settings before persisting.
  // Throws a coded error (imap_failed | smtp_failed | auth_failed) on failure —
  // a broken account is never saved silently.
  // On failure the error MESSAGE is the machine code itself (auth_failed |
  // imap_failed | smtp_failed) — the UI maps it to a specific "which side to fix"
  // status. withErrors passes err.message straight through to the client as `error`.
  try {
    await testConnect({ email_address: email, password, ...conn });
  } catch (err) {
    if (err.code) throw httpError(422, err.code);
    throw err;
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
    ...conn,
    password_encrypted: encrypt(password),
    status: "active",
  };
  // Metadata is only applied on first insert of an address — re-connect keeps the
  // user's chosen name/colour/default and just refreshes credentials + settings.
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

  // Populate the account's mailbox list now so the Move-to picker and trash/junk
  // targets are available immediately (and refreshed on every later sync). Best-effort
  // — a LIST hiccup must not fail an otherwise-successful connect. POP3 has no server
  // folders to list — Move/Archive/Junk/filter-rules are IMAP-only and stay disabled
  // for these accounts (see mail/actions.js).
  if (conn.incoming_protocol !== "pop3") {
    try {
      await syncFolders(supabase, { id: saved.id, user_id: user.id, email_address: email, password, ...conn });
    } catch {
      /* folders will be populated on the next sync pass */
    }
  }

  res.status(200).json({ ok: true, account: saved });
});
