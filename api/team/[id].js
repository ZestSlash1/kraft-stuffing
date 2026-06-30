// PUT /api/team/:id — admin only. Update a profile's full_name / title / role.
import { requireUser, requireAdmin, adminClient, httpError, withErrors, readJsonBody } from "../_lib/auth.js";

export default withErrors(async (req, res) => {
  if (req.method !== "PUT") throw httpError(405, "Method not allowed");
  const user = await requireUser(req);
  const adminProfile = await requireAdmin(user.id);
  const id = (req.query.id || "").toString();
  if (!id) throw httpError(400, "profile id is required");

  const { full_name, title, role } = readJsonBody(req);
  const patch = {};
  if (full_name !== undefined) patch.display_name = full_name;
  if (title !== undefined) patch.title = title;
  if (role !== undefined) patch.role = role === "admin" ? "admin" : "staff";
  if (!Object.keys(patch).length) throw httpError(400, "Nothing to update");

  const supabase = adminClient();
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .eq("org_id", adminProfile.org_id); // scope to admin's org
  if (error) throw httpError(500, "Could not update profile");

  res.status(200).json({ ok: true });
});
