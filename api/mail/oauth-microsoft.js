// /api/mail/oauth-microsoft — Outlook/M365 OAuth2 consent flow, in one function
// (GET start + POST complete) to stay under Vercel's Hobby-plan 12-function cap,
// same reasoning as actions.js consolidating its dozen mutations.
//
//   GET  /api/mail/oauth-microsoft         → { url, state } — the Microsoft consent
//                                             URL to redirect to, and the anti-CSRF
//                                             state the client must send back to
//                                             `complete` unchanged.
//   POST /api/mail/oauth-microsoft { code } → exchanges the authorization code for
//                                             tokens, resolves the mailbox address via
//                                             Graph, and saves/updates the account.
//
// Both steps require a logged-in Portal user (requireUser) — the OAuth `state` is
// only an anti-CSRF nonce, not an auth mechanism: the redirect back from Microsoft
// lands on the SPA (still logged in, same browser), which calls `complete` with its
// normal Supabase bearer token, exactly like every other mail endpoint.
import crypto from "node:crypto";
import { requireUser, adminClient, httpError, withErrors, readJsonBody } from "../_lib/auth.js";
import { encrypt } from "../_lib/mailCrypto.js";
import { getAuthorizeUrl, exchangeCodeForTokens, fetchMailboxAddress } from "../_lib/msOAuth.js";
import { MAX_ACCOUNTS, ACCOUNT_COLORS } from "../_lib/mailAccount.js";

// Fixed Outlook/M365 endpoints — never user-editable, unlike the password presets.
const OUTLOOK_CONN = {
  incoming_protocol: "imap",
  imap_host: "outlook.office365.com",
  imap_port: 993,
  imap_security: "ssl",
  smtp_host: "smtp.office365.com",
  smtp_port: 587,
  smtp_security: "starttls",
};

export const config = { maxDuration: 30 };

export default withErrors(async (req, res) => {
  const user = await requireUser(req);

  if (req.method === "GET") {
    const state = crypto.randomUUID();
    return res.status(200).json({ url: getAuthorizeUrl(state), state });
  }

  if (req.method !== "POST") throw httpError(405, "Method not allowed");

  const body = readJsonBody(req);
  const code = (body?.code || "").toString();
  if (!code) throw httpError(400, "code is required");

  const tokens = await exchangeCodeForTokens(code);
  if (!tokens.refresh_token) {
    // offline_access was requested — no refresh_token means consent didn't grant it
    // (e.g. re-consent without the "select_account" prompt reusing an old grant).
    throw httpError(422, "oauth_failed: no refresh token granted — reconnect and accept offline access");
  }
  const email = await fetchMailboxAddress(tokens.access_token);

  const supabase = adminClient();
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

  const record = {
    user_id: user.id,
    email_address: email,
    ...OUTLOOK_CONN,
    auth_type: "oauth2",
    provider_preset: "outlook",
    password_encrypted: null,
    oauth_refresh_token_encrypted: encrypt(tokens.refresh_token),
    oauth_access_token_encrypted: encrypt(tokens.access_token),
    oauth_access_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    status: "active",
  };
  if (!match) {
    record.display_name = email;
    record.color = ACCOUNT_COLORS[rows.length % ACCOUNT_COLORS.length];
    record.sort_order = rows.length;
    record.is_default = rows.length === 0;
  }

  const { data: saved, error } = await supabase
    .from("mail_accounts")
    .upsert(record, { onConflict: "user_id,email_address" })
    .select("id, email_address, display_name, color, is_default, status")
    .single();
  if (error) throw httpError(500, "Could not save mail account");

  res.status(200).json({ ok: true, account: saved });
});
