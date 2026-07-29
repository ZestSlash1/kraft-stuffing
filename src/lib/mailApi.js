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

  // Outlook/M365 OAuth2 consent flow — start() returns the Microsoft consent URL to
  // redirect to (+ the anti-CSRF state to stash and compare on return); complete()
  // exchanges the returned authorization code for tokens and saves the account.
  oauthMicrosoftStart: () => req("/api/mail/oauth-microsoft"),
  oauthMicrosoftComplete: (code) => req("/api/mail/oauth-microsoft", { method: "POST", body: { code } }),
  list: (folder = "INBOX", accountId) =>
    req(`/api/mail/list?folder=${encodeURIComponent(folder)}${acctParam(accountId)}`),
  thread: (uid, folder = "INBOX", accountId) =>
    req(
      `/api/mail/thread?uid=${encodeURIComponent(uid)}&folder=${encodeURIComponent(folder)}${acctParam(accountId)}`
    ),
  send: (payload) => req("/api/mail/send", { method: "POST", body: payload }),

  // Compose card: recent recipients for autocomplete, sourced from mail history.
  recipients: (accountId) => req(`/api/mail/actions?op=recipients&accountId=${encodeURIComponent(accountId)}`),

  // Templates (subject + body_html picker). kind: 'compose' (default) | 'signature' —
  // signature templates (Settings) are stored separately from compose templates so
  // neither picker shows the other's rows.
  templates: (accountId, kind = "compose") => req(`/api/mail/actions?op=templates&accountId=${encodeURIComponent(accountId)}&kind=${encodeURIComponent(kind)}`),
  createTemplate: (payload) => req("/api/mail/actions?op=templates", { method: "POST", body: payload }),
  updateTemplate: (id, patch) => req(`/api/mail/actions?op=templates&id=${encodeURIComponent(id)}`, { method: "PUT", body: patch }),
  deleteTemplate: (id) => req(`/api/mail/actions?op=templates&id=${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Canned responses: org-wide reusable reply library, grouped by category, distinct
  // from the compose-drafts `templates` above.
  cannedResponses: (category) => req(`/api/mail/actions?op=canned-responses${category ? `&category=${encodeURIComponent(category)}` : ""}`),
  createCannedResponse: (payload) => req("/api/mail/actions?op=canned-responses", { method: "POST", body: payload }),
  updateCannedResponse: (id, patch) => req(`/api/mail/actions?op=canned-responses&id=${encodeURIComponent(id)}`, { method: "PUT", body: patch }),

  // Follow-up reminders / snooze on a message. `due()` powers the nav badge + dashboard
  // widget; `forMessage()` shows the current state on a thread row / open thread.
  dueReminders: () => req("/api/mail/actions?op=reminders&due=1"),
  activeReminders: () => req("/api/mail/actions?op=reminders"),
  reminderForMessage: (messageId) => req(`/api/mail/actions?op=reminders&messageId=${encodeURIComponent(messageId)}`),
  setReminder: (payload) => req("/api/mail/actions?op=reminders", { method: "POST", body: payload }),
  resolveReminder: (id, status) => req(`/api/mail/actions?op=reminders&id=${encodeURIComponent(id)}`, { method: "PUT", body: { status } }),

  // Scheduled send: queue instead of sending immediately, then best-effort flush
  // due rows right away (the daily cron is only a retry safety net on Hobby tier).
  scheduleSend: (payload) => req("/api/mail/actions?op=schedule-send", { method: "POST", body: payload }),
  flushScheduledSends: () => req("/api/mail/actions?op=process-scheduled", { method: "POST" }),

  // Outbox: pending + recent scheduled sends for an account, and cancel-before-send.
  scheduledSends: (accountId) => req(`/api/mail/actions?op=scheduled-sends&accountId=${encodeURIComponent(accountId)}`),
  cancelScheduledSend: (id) => req("/api/mail/actions?op=cancel-scheduled", { method: "POST", body: { id } }),

  // Pull IMAP → Supabase for this account (or all when omitted/'all'). The read path is
  // DB-only; this is fired in the background to keep the mirror fresh. Best-effort.
  sync: (accountId) =>
    req(`/api/mail/sync${accountId ? `?accountId=${encodeURIComponent(accountId)}` : ""}`, { method: "POST" }),

  // ── Message actions (Delete / Move / Junk). Each performs the real IMAP move on
  // the server AND updates the DB mirror; the client patches its cache optimistically.
  // uids is an array; source is the mirror folder key ('INBOX' | 'Sent').
  // All message actions share one serverless function (/api/mail/actions?op=…) to stay
  // under Vercel's Hobby-plan function cap.
  moveMessage: (accountId, uids, sourceFolder, targetFolder) =>
    req("/api/mail/actions?op=move", {
      method: "POST",
      body: { account_id: accountId, message_uids: uids, source_folder: sourceFolder, target_folder: targetFolder },
    }),
  deleteMessage: (accountId, uids, sourceFolder) =>
    req("/api/mail/actions?op=delete", {
      method: "POST",
      body: { account_id: accountId, message_uids: uids, source_folder: sourceFolder },
    }),
  archiveMessage: (accountId, uids, sourceFolder) =>
    req("/api/mail/actions?op=archive", {
      method: "POST",
      body: { account_id: accountId, message_uids: uids, source_folder: sourceFolder },
    }),
  star: (accountId, uids, sourceFolder, flagged) =>
    req("/api/mail/actions?op=star", {
      method: "POST",
      body: { account_id: accountId, message_uids: uids, source_folder: sourceFolder, flagged },
    }),
  markJunk: (accountId, uids, sourceFolder) =>
    req("/api/mail/actions?op=junk", {
      method: "POST",
      body: { account_id: accountId, message_uids: uids, source_folder: sourceFolder },
    }),
  markNotJunk: (accountId, { ruleId, matchValue, uids, sourceFolder } = {}) =>
    req("/api/mail/actions?op=not-junk", {
      method: "POST",
      body: { account_id: accountId, rule_id: ruleId, match_value: matchValue, message_uids: uids, source_folder: sourceFolder },
    }),

  // Mailbox structure (Move-to picker + Settings mapping). POST forces a fresh LIST.
  folders: (accountId) => req(`/api/mail/actions?op=folders&accountId=${encodeURIComponent(accountId)}`),
  refreshFolders: (accountId) => req(`/api/mail/actions?op=folders&accountId=${encodeURIComponent(accountId)}`, { method: "POST" }),

  // Standing junk filter rules (Settings list).
  filterRules: (accountId) => req(`/api/mail/actions?op=filter-rules&accountId=${encodeURIComponent(accountId)}`),
  deleteFilterRule: (accountId, id) =>
    req(`/api/mail/actions?op=filter-rules&accountId=${encodeURIComponent(accountId)}&id=${encodeURIComponent(id)}`, { method: "DELETE" }),

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
