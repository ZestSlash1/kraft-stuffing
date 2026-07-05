// Helpers to load a caller's mail account and build IMAP/SMTP clients. SERVER-ONLY.
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { adminClient, httpError } from "./auth.js";
import { decrypt } from "./mailCrypto.js";

// The 4-account cap. Enforced here + in connect.js — never only in the UI.
export const MAX_ACCOUNTS = 4;

// Fixed accent palette for account chips (client picker mirrors this list).
export const ACCOUNT_COLORS = [
  "#e8930a", // dock amber
  "#3ba3ff", // minor blue
  "#12b886", // optimized green
  "#f0567a", // pink
  "#a06bff", // purple
  "#e0b341", // gold
];

// Full row + decrypted password. Callers here already own the row (scoped queries).
function withPassword(row) {
  return { ...row, password: decrypt(row.password_encrypted) };
}

// Resolve a SPECIFIC account by id, verifying it belongs to the caller. An accountId
// from the client is a claim — the `.eq("user_id", userId)` is the ownership check
// (the admin client bypasses RLS, so this filter is what prevents IDOR). Decrypts.
export async function getAccountById(userId, accountId) {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw httpError(500, "Could not load mail account");
  if (!data) throw httpError(404, "Mail account not found");
  return withPassword(data);
}

// The caller's default mailbox (is_default first, then earliest). Decrypts.
export async function getDefaultAccount(userId) {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw httpError(500, "Could not load mail account");
  if (!data) throw httpError(404, "No mailbox connected");
  return withPassword(data);
}

// Resolve the account a request targets: an explicit (ownership-checked) id, or the
// default when the client sent none. Used by list/thread/send/settings.
export async function resolveAccount(userId, accountId) {
  return accountId ? getAccountById(userId, accountId) : getDefaultAccount(userId);
}

// All non-disabled accounts WITH decrypted passwords — for the all-inboxes merge.
export async function listActiveAccounts(userId) {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .select("*")
    .eq("user_id", userId)
    .neq("status", "disabled")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw httpError(500, "Could not load mail accounts");
  return (data || []).map(withPassword);
}

// Metadata only — NEVER decrypts, NEVER selects password_encrypted. Safe to return
// to the client (switcher + settings list).
export async function listAccountsMeta(userId) {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .select("id, email_address, display_name, color, sort_order, is_default, status, created_at")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw httpError(500, "Could not load mail accounts");
  return data || [];
}

// Best-effort status flip (active <-> error) after a fetch. Never throws — a status
// bookkeeping failure must not fail the mail request itself.
export async function markAccountStatus(userId, accountId, status) {
  try {
    await adminClient()
      .from("mail_accounts")
      .update({ status })
      .eq("id", accountId)
      .eq("user_id", userId);
  } catch {
    /* non-fatal */
  }
}

// Map a stored security mode onto ImapFlow connection options. 'ssl' = implicit TLS
// (e.g. port 993); 'starttls' = plaintext connect then upgrade; 'none' = plaintext,
// never upgrade. There is NO shared default — the mode always comes from the row.
export function imapSecurityOpts(security) {
  if (security === "starttls") return { secure: false };
  if (security === "none") return { secure: false, disableStartTls: true };
  return { secure: true }; // 'ssl'
}

// Same mapping for nodemailer SMTP. 'starttls' requires the upgrade to succeed;
// 'none' explicitly forbids TLS. 'ssl' = implicit TLS (e.g. port 465).
export function smtpSecurityOpts(security) {
  if (security === "starttls") return { secure: false, requireTLS: true };
  if (security === "none") return { secure: false, ignoreTLS: true };
  return { secure: true }; // 'ssl'
}

// Does an error look like an authentication rejection (bad user/pass) vs. a
// connectivity/protocol failure? Used to split imap_failed/smtp_failed from
// auth_failed so the UI can tell the user which side to fix.
function isAuthError(err) {
  if (err?.code === "EAUTH") return true;
  const m = (err?.message || "").toLowerCase();
  return m.includes("auth") || m.includes("login") || m.includes("credential") || m.includes("password");
}

// A coded error whose message is credential-free and safe to surface to the client.
function connectError(code) {
  const err = httpError(400, code);
  err.code = code;
  return err;
}

// Verify a full set of host/port/security/credentials BEFORE persisting it. Opens
// the IMAP connection and asks the SMTP transport to verify auth. Throws a coded
// error (`imap_failed` | `smtp_failed` | `auth_failed`) on any failure so callers
// never save a broken account. `account` is a plain object (not yet a DB row) with
// email_address + password + host/port/security fields.
export async function testConnect(account) {
  // IMAP side.
  try {
    const client = await openImap(account);
    await client.logout().catch(() => {});
  } catch (err) {
    throw connectError(isAuthError(err) ? "auth_failed" : "imap_failed");
  }
  // SMTP side — verify() performs a login handshake without sending mail.
  try {
    await makeTransport(account).verify();
  } catch (err) {
    throw connectError(isAuthError(err) ? "auth_failed" : "smtp_failed");
  }
}

export async function openImap(account) {
  const client = new ImapFlow({
    host: account.imap_host,
    port: account.imap_port,
    ...imapSecurityOpts(account.imap_security),
    auth: { user: account.email_address, pass: account.password },
    logger: false, // never log — would expose credentials
  });
  await client.connect();
  return client;
}

export function makeTransport(account) {
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    ...smtpSecurityOpts(account.smtp_security),
    auth: { user: account.email_address, pass: account.password },
  });
}
