// GET  /api/team — admin only. All profiles + whether each has a connected mailbox.
// POST /api/team — admin only. Invite a new staff member via Supabase Auth.
//   body: { email, full_name?, title?, role? }
// Credentials are NEVER exposed here — only a boolean "connected" flag.
import { requireUser, requireAdmin, adminClient, httpError, withErrors, readJsonBody } from "../_lib/auth.js";

export default withErrors(async (req, res) => {
  const user = await requireUser(req);
  const adminProfile = await requireAdmin(user.id);
  const supabase = adminClient();

  if (req.method === "GET") {
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, display_name, title, role")
      .eq("org_id", adminProfile.org_id);
    if (error) throw httpError(500, "Could not load team");

    const { data: accounts } = await supabase.from("mail_accounts").select("user_id");
    const connected = new Set((accounts || []).map((a) => a.user_id));

    return res.status(200).json({
      team: (profiles || []).map((p) => ({
        id: p.id,
        full_name: p.display_name || "",
        title: p.title || "",
        role: p.role || "staff",
        mail_connected: connected.has(p.id),
      })),
    });
  }

  if (req.method === "POST") {
    const { email, full_name, title, role } = readJsonBody(req);
    if (!email) throw httpError(400, "email is required");

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);
    if (error || !data?.user) throw httpError(400, error?.message || "Invite failed");

    // Seed their profile row so they appear in the team list immediately.
    await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        org_id: adminProfile.org_id,
        display_name: full_name || email.split("@")[0],
        title: title || null,
        role: role === "admin" ? "admin" : "staff",
      },
      { onConflict: "id" }
    );

    return res.status(200).json({ ok: true, id: data.user.id });
  }

  throw httpError(405, "Method not allowed");
});
