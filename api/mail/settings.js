// /api/mail/settings — account metadata list, per-account settings, and disconnect.
//
//   GET    /api/mail/settings               → { accounts: [meta…], limit }   (no secrets)
//   GET    /api/mail/settings?accountId=X    → { email, signature_html, … }   (one account)
//   PUT    /api/mail/settings?accountId=X    → update { signature_html?, display_name?,
//                                                       color?, is_default? }
//   DELETE /api/mail/settings?accountId=X    → disconnect (hard-delete credentials)
//
// Every accountId is ownership-checked (`.eq("user_id", user.id)`) before any write.
import { requireUser, adminClient, httpError, withErrors, readJsonBody } from "../_lib/auth.js";
import { listAccountsMeta, MAX_ACCOUNTS } from "../_lib/mailAccount.js";

// Confirm the account exists and belongs to the caller; returns its current row.
async function ownedAccount(supabase, userId, accountId) {
  const { data, error } = await supabase
    .from("mail_accounts")
    .select("id, email_address, is_default")
    .eq("id", accountId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw httpError(500, "Could not load mail account");
  if (!data) throw httpError(404, "Mail account not found");
  return data;
}

// Ensure exactly one default remains for this user, preferring `preferId`.
async function ensureOneDefault(supabase, userId, preferId) {
  const { data } = await supabase
    .from("mail_accounts")
    .select("id, is_default")
    .eq("user_id", userId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const rows = data || [];
  if (rows.length === 0) return;
  if (rows.some((r) => r.is_default)) return;
  const target = preferId && rows.find((r) => r.id === preferId) ? preferId : rows[0].id;
  await supabase.from("mail_accounts").update({ is_default: true }).eq("id", target).eq("user_id", userId);
}

export default withErrors(async (req, res) => {
  const user = await requireUser(req);
  const supabase = adminClient();
  const accountId = req.query.accountId ? req.query.accountId.toString() : null;

  // ── List all accounts (metadata only) — powers switcher + settings + connected check.
  if (req.method === "GET" && !accountId) {
    const accounts = await listAccountsMeta(user.id);
    return res.status(200).json({ accounts, limit: MAX_ACCOUNTS });
  }

  // ── One account's settings (signature editor / compose prefill).
  if (req.method === "GET") {
    const { data } = await supabase
      .from("mail_accounts")
      .select("id, email_address, display_name, color, is_default, status, signature_html")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!data) throw httpError(404, "Mail account not found");
    return res.status(200).json({
      id: data.id,
      email: data.email_address,
      display_name: data.display_name || data.email_address,
      color: data.color || null,
      is_default: data.is_default,
      status: data.status,
      signature_html: data.signature_html || "",
    });
  }

  if (req.method === "PUT") {
    if (!accountId) throw httpError(400, "accountId is required");
    await ownedAccount(supabase, user.id, accountId);
    const body = readJsonBody(req);

    // Making this account the default first clears any other default (partial unique
    // index allows only one is_default per user).
    if (body.is_default === true) {
      await supabase
        .from("mail_accounts")
        .update({ is_default: false })
        .eq("user_id", user.id)
        .neq("id", accountId);
    }

    const patch = {};
    if (typeof body.signature_html === "string") patch.signature_html = body.signature_html;
    if (typeof body.display_name === "string") patch.display_name = body.display_name;
    if (typeof body.color === "string") patch.color = body.color;
    if (body.is_default === true) patch.is_default = true;
    if (Object.keys(patch).length === 0) return res.status(200).json({ ok: true });

    const { error } = await supabase
      .from("mail_accounts")
      .update(patch)
      .eq("id", accountId)
      .eq("user_id", user.id);
    if (error) throw httpError(500, "Could not save mail settings");
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    if (!accountId) throw httpError(400, "accountId is required");
    const acct = await ownedAccount(supabase, user.id, accountId);
    // Hard-delete the row — retaining dead encrypted credentials has no value.
    const { error } = await supabase
      .from("mail_accounts")
      .delete()
      .eq("id", accountId)
      .eq("user_id", user.id);
    if (error) throw httpError(500, "Could not disconnect mail account");
    // If we removed the default, promote another account so one default always exists.
    if (acct.is_default) await ensureOneDefault(supabase, user.id, null);
    return res.status(200).json({ ok: true });
  }

  throw httpError(405, "Method not allowed");
});
