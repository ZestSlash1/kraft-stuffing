// Client-side wrapper for the /api/mail and /api/team serverless routes.
// Every call attaches the current Supabase access token as a bearer so the server
// can verify the session and scope queries to this user.
import { supabase } from "./supabase";

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function req(path, { method = "GET", body } = {}) {
  const headers = { ...(await authHeader()) };
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
  return json;
}

// accountId is optional on list/thread; when present it's appended and the server
// ownership-checks it. "all" is a valid accountId for the merged inbox.
const acctParam = (accountId) => (accountId ? `&accountId=${encodeURIComponent(accountId)}` : "");

export const mailApi = {
  connect: (payload) => req("/api/mail/connect", { method: "POST", body: payload }),
  list: (folder = "INBOX", accountId) =>
    req(`/api/mail/list?folder=${encodeURIComponent(folder)}${acctParam(accountId)}`),
  thread: (uid, folder = "INBOX", accountId) =>
    req(
      `/api/mail/thread?uid=${encodeURIComponent(uid)}&folder=${encodeURIComponent(folder)}${acctParam(accountId)}`
    ),
  send: (payload) => req("/api/mail/send", { method: "POST", body: payload }),

  // Account metadata + per-account settings (no secrets ever returned).
  listAccounts: () => req("/api/mail/settings"),
  getAccountSettings: (accountId) => req(`/api/mail/settings?accountId=${encodeURIComponent(accountId)}`),
  saveAccountSettings: (accountId, patch) =>
    req(`/api/mail/settings?accountId=${encodeURIComponent(accountId)}`, { method: "PUT", body: patch }),
  disconnectAccount: (accountId) =>
    req(`/api/mail/settings?accountId=${encodeURIComponent(accountId)}`, { method: "DELETE" }),

  team: () => req("/api/team"),
  invite: (payload) => req("/api/team", { method: "POST", body: payload }),
  updateMember: (id, patch) => req(`/api/team?id=${encodeURIComponent(id)}`, { method: "PUT", body: patch }),
};

export default mailApi;
