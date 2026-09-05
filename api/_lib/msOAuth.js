// Microsoft identity platform (Entra ID / Azure AD) OAuth2 for Outlook.com and
// Microsoft 365 mailboxes. SERVER-ONLY — client secret never reaches the browser.
//
// Microsoft retired basic auth (username+password) for IMAP/POP3/SMTP on these
// mailboxes, so Outlook accounts authenticate via OAuth2 (XOAUTH2) instead of the
// password path every other provider uses. Requires an app registration in Entra ID
// (see PHASE_MAIL_PROVIDER_CONFIG.md for the exact setup steps) and four env vars:
//   MS_OAUTH_CLIENT_ID       — Application (client) ID
//   MS_OAUTH_CLIENT_SECRET   — a client secret VALUE (from Certificates & secrets)
//   MS_OAUTH_TENANT          — 'common' (personal + any org, default) | 'organizations' | a tenant ID
//   MS_OAUTH_REDIRECT_URI    — must exactly match the redirect URI registered in Entra
import { httpError } from "./auth.js";

// Delegated scopes: IMAP + SMTP over Exchange Online, plus Graph basics to resolve
// the mailbox address and keep a refresh token (offline_access).
const SCOPES = [
  "https://outlook.office365.com/IMAP.AccessAsUser.All",
  "https://outlook.office365.com/SMTP.Send",
  "https://graph.microsoft.com/User.Read",
  "offline_access",
  "openid",
  "email",
].join(" ");

function env(name) {
  const v = process.env[name];
  if (!v) throw httpError(500, `${name} is not configured`);
  return v;
}

function tenant() {
  return process.env.MS_OAUTH_TENANT || "common";
}

function authorityBase() {
  return `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0`;
}

// Build the Microsoft consent URL the client redirects to. `state` is an opaque
// anti-CSRF nonce the caller generates and later verifies on return.
export function getAuthorizeUrl(state) {
  const params = new URLSearchParams({
    client_id: env("MS_OAUTH_CLIENT_ID"),
    response_type: "code",
    redirect_uri: env("MS_OAUTH_REDIRECT_URI"),
    response_mode: "query",
    scope: SCOPES,
    state,
    prompt: "select_account",
  });
  return `${authorityBase()}/authorize?${params.toString()}`;
}

async function tokenRequest(body) {
  const res = await fetch(`${authorityBase()}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw httpError(422, json?.error_description ? `oauth_failed: ${json.error_description}` : "oauth_failed");
  }
  return json; // { access_token, refresh_token?, expires_in, ... }
}

// Authorization code → first token pair (includes a refresh_token, since
// offline_access was requested).
export function exchangeCodeForTokens(code) {
  return tokenRequest({
    client_id: env("MS_OAUTH_CLIENT_ID"),
    client_secret: env("MS_OAUTH_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: env("MS_OAUTH_REDIRECT_URI"),
    scope: SCOPES,
  });
}

// Refresh token → a fresh access token (and, per Microsoft's rotation policy,
// possibly a new refresh_token — callers must persist whichever is returned).
export function refreshAccessToken(refreshToken) {
  return tokenRequest({
    client_id: env("MS_OAUTH_CLIENT_ID"),
    client_secret: env("MS_OAUTH_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: SCOPES,
  });
}

// The signed-in mailbox address, via Graph /me — used right after consent since the
// authorization code alone doesn't carry the email address in a directly usable form.
export async function fetchMailboxAddress(accessToken) {
  const res = await fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw httpError(422, "oauth_failed: could not resolve mailbox address");
  const me = await res.json();
  const address = me.mail || me.userPrincipalName;
  if (!address) throw httpError(422, "oauth_failed: mailbox has no resolvable address");
  return address.toLowerCase();
}
