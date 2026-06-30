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

export const mailApi = {
  connect: (email, password) => req("/api/mail/connect", { method: "POST", body: { email, password } }),
  list: (folder = "INBOX") => req(`/api/mail/list?folder=${encodeURIComponent(folder)}`),
  thread: (uid, folder = "INBOX") =>
    req(`/api/mail/thread?uid=${encodeURIComponent(uid)}&folder=${encodeURIComponent(folder)}`),
  send: (payload) => req("/api/mail/send", { method: "POST", body: payload }),
  getSettings: () => req("/api/mail/settings"),
  saveSignature: (signature_html) => req("/api/mail/settings", { method: "PUT", body: { signature_html } }),
  team: () => req("/api/team"),
  invite: (payload) => req("/api/team", { method: "POST", body: payload }),
  updateMember: (id, patch) => req(`/api/team/${id}`, { method: "PUT", body: patch }),
};

export default mailApi;
