// Client-side wrapper for the /api/mail and /api/team serverless routes.
// Every call attaches the current Supabase access token as a bearer so the server
// can verify the session and scope queries to this user.
import { supabase } from "./supabase";

// Upload a signature image (logo) to the PUBLIC `mail-assets` bucket and return its
// permanent public URL — email recipients aren't authenticated, so signed URLs won't
// do. The URL is embedded straight into the account's signature_html. Returns the URL
// string; throws on failure.
export async function uploadSignatureImage(file) {
  if (!file) throw new Error("No file selected");
  if (!file.type?.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > 2 * 1024 * 1024) throw new Error("Image is too large (max 2 MB)");
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess?.session?.user?.id || "anon";
  const ext = (file.name?.split(".").pop() || "png").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "png";
  const path = `signatures/${uid}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("mail-assets")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message || "Upload failed");
  const { data } = supabase.storage.from("mail-assets").getPublicUrl(path);
  if (!data?.publicUrl) throw new Error("Could not resolve image URL");
  return data.publicUrl;
}

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
  // Update an account's connection settings (host/port/security). Server re-runs the
  // IMAP+SMTP test-connect before saving and rejects with a coded error on failure.
  updateAccountSettings: (accountId, patch) =>
    req(`/api/mail/settings?accountId=${encodeURIComponent(accountId)}`, { method: "PUT", body: patch }),
  disconnectAccount: (accountId) =>
    req(`/api/mail/settings?accountId=${encodeURIComponent(accountId)}`, { method: "DELETE" }),

  // Flush pending notification deliveries now (prompt send after an event is
  // emitted; the daily cron is only a retry safety net). Best-effort.
  flushNotifications: () => req("/api/notify/dispatch", { method: "POST" }),

  team: () => req("/api/team"),
  invite: (payload) => req("/api/team", { method: "POST", body: payload }),
  updateMember: (id, patch) => req(`/api/team?id=${encodeURIComponent(id)}`, { method: "PUT", body: patch }),
};

export default mailApi;
