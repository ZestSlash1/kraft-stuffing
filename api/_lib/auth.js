// Server-side Supabase helpers for serverless functions. SERVER-ONLY.
//
// Env (set in Vercel project settings, NOT committed):
//   SUPABASE_URL                — same project as VITE_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   — service role key (bypasses RLS; never sent to client)
//   MAIL_ENCRYPTION_KEY         — see mailCrypto.js
//
// Every /api/mail and /api/team route MUST call requireUser() first.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Admin client — bypasses RLS. Use only after the caller is verified + scope every
// query to their own user_id (or an explicit admin role check).
export function adminClient() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
  }
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Verify the Supabase JWT from the Authorization header. Returns the auth user or
// throws { status, message }. Reject anything without a valid bearer token.
export async function requireUser(req) {
  const header = req.headers.authorization || req.headers.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw httpError(401, "Missing bearer token");

  const supabase = adminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw httpError(401, "Invalid or expired session");
  return data.user;
}

// Load the caller's profile; throws if missing. Used for role gating.
export async function requireProfile(userId) {
  const supabase = adminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, title, role, org_id")
    .eq("id", userId)
    .single();
  if (error || !data) throw httpError(403, "No profile for this user");
  return data;
}

export async function requireAdmin(userId) {
  const profile = await requireProfile(userId);
  if (profile.role !== "admin") throw httpError(403, "Admin role required");
  return profile;
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// Wrap a handler so thrown httpErrors become clean JSON responses and unexpected
// errors never leak a stack (or a decrypted password) to the client.
export function withErrors(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      const status = err.status || 500;
      if (status >= 500) console.error("[api]", err.message); // never log secrets
      res.status(status).json({ error: err.message || "Server error" });
    }
  };
}

export function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}
