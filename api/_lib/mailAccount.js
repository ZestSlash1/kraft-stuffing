// Helpers to load a caller's mail account and build IMAP/SMTP clients. SERVER-ONLY.
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { adminClient, httpError } from "./auth.js";
import { decrypt, encrypt } from "./mailCrypto.js";
import { testPop3Connect } from "./mailPop3.js";
import { refreshAccessToken } from "./msOAuth.js";

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

// A stored OAuth2 access token is short-lived (~1hr) — refresh proactively once
// within this window of expiring rather than waiting for a server-side rejection.
const REFRESH_SKEW_MS = 5 * 60 * 1000;

// Refresh (if needed) and return a live access token for an oauth2 account,
// persisting the new encrypted token (+ rotated refresh token, if Microsoft sent
// one) back to the row so the next call can reuse it without a round-trip.
async function ensureFreshAccessToken(row) {
  const expiresAt = row.oauth_access_token_expires_at ? new Date(row.oauth_access_token_expires_at).getTime() : 0;
  if (row.oauth_access_token_encrypted && expiresAt - Date.now() > REFRESH_SKEW_MS) {
    return decrypt(row.oauth_access_token_encrypted);
  }
  const refreshToken = decrypt(row.oauth_refresh_token_encrypted);
  const tokens = await refreshAccessToken(refreshToken);
  const patch = {
    oauth_access_token_encrypted: encrypt(tokens.access_token),
    oauth_access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  };
  if (tokens.refresh_token) patch.oauth_refresh_token_encrypted = encrypt(tokens.refresh_token);
  await adminClient().from("mail_accounts").update(patch).eq("id", row.id);
  return tokens.access_token;
}

// Full row + live credentials. Callers here already own the row (scoped queries).
// Password accounts decrypt password_encrypted; oauth2 accounts (Outlook) get a
// fresh access token instead — never a password, since Microsoft rejects basic auth.
async function withCredentials(row) {
  if (row.auth_type === "oauth2") {
    return { ...row, accessToken: await ensureFreshAccessToken(row) };
  }
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
  return withCredentials(data);
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
  return withCredentials(data);
}

// Resolve the account a request targets: an explicit (ownership-checked) id, or the
// default when the client sent none. Used by list/thread/send/settings.
export async function resolveAccount(userId, accountId) {
  return accountId ? getAccountById(userId, accountId) : getDefaultAccount(userId);
}

// All non-disabled accounts WITH live credentials — for the all-inboxes merge.
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
  return Promise.all((data || []).map(withCredentials));
}

// Metadata only — NEVER decrypts, NEVER selects password_encrypted. Safe to return
// to the client (switcher + settings list).
export async function listAccountsMeta(userId) {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("mail_accounts")
    .select(
      "id, email_address, display_name, color, sort_order, is_default, status, created_at, incoming_protocol, auth_type, provider_preset"
    )
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw httpError(500, "Could not load mail accounts");
  return data || [];
}

// Resolve the account a READ targets, WITHOUT decrypting credentials — the DB read
// path (list/thread) never needs the IMAP password. Explicit id is ownership-checked;
// null falls back to the caller's default (is_default, then earliest). Returns metadata
// only. Throws 404 when the caller has no matching account.
export async function resolveAccountMeta(userId, accountId) {
  const supabase = adminClient();
  let q = supabase
    .from("mail_accounts")
    .select("id, user_id, email_address, display_name, color, is_default, status, incoming_protocol, auth_type, provider_preset")
    .eq("user_id", userId);
  q = accountId
    ? q.eq("id", accountId)
    : q.order("is_default", { ascending: false }).order("sort_order", { ascending: true }).order("created_at", { ascending: true });
  const { data, error } = await q.limit(1).maybeSingle();
  if (error) throw httpError(500, "Could not load mail account");
  if (!data) throw httpError(404, accountId ? "Mail account not found" : "No mailbox connected");
  return data;
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
  if (err?.authenticationFailed) return true; // ImapFlow flag (message is generic "Command failed")
  if (err?.code === "EAUTH") return true; // nodemailer SMTP auth rejection
  const m = `${err?.message || ""} ${err?.responseText || ""}`.toLowerCase();
  return m.includes("auth") || m.includes("login") || m.includes("credential") || m.includes("password");
}

// A coded error whose message is credential-free and safe to surface to the client.
function connectError(code) {
  const err = httpError(400, code);
  err.code = code;
  return err;
}

// Auth block shared by ImapFlow: password accounts send `pass`; oauth2 accounts
// (Outlook) send a live `accessToken` instead (XOAUTH2) — Microsoft rejects a
// plain password on IMAP/POP3/SMTP for these mailboxes.
function imapAuth(account) {
  return account.auth_type === "oauth2"
    ? { user: account.email_address, accessToken: account.accessToken }
    : { user: account.email_address, pass: account.password };
}

// Verify a full set of host/port/security/credentials BEFORE persisting it. Opens
// the incoming connection (IMAP or POP3, per incoming_protocol) and asks the SMTP
// transport to verify auth. Throws a coded error (`imap_failed` | `smtp_failed` |
// `auth_failed`) on any failure so callers never save a broken account. `account`
// is a plain object (not yet a DB row) with email_address + password/accessToken +
// host/port/security fields.
export async function testConnect(account) {
  // Incoming side — IMAP or POP3.
  try {
    if (account.incoming_protocol === "pop3") {
      await testPop3Connect(account);
    } else {
      const client = await openImap(account);
      await client.logout().catch(() => {});
    }
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
    auth: imapAuth(account),
    logger: false, // never log — would expose credentials
    // Some providers (e.g. Zimbra proxies) are slow to greet — allow up to 20s
    // before giving up so a healthy-but-slow server isn't misreported as failed.
    connectionTimeout: 20000,
    greetingTimeout: 20000,
  });
  await client.connect();
  return client;
}

export function makeTransport(account) {
  const auth =
    account.auth_type === "oauth2"
      ? { type: "OAuth2", user: account.email_address, accessToken: account.accessToken }
      : { user: account.email_address, pass: account.password };
  return nodemailer.createTransport({
    host: account.smtp_host,
    port: account.smtp_port,
    ...smtpSecurityOpts(account.smtp_security),
    auth,
    // Match IMAP: tolerate slow SMTP handshakes rather than failing prematurely.
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 25000,
  });
}
