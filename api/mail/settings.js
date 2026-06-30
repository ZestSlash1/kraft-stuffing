// GET/PUT /api/mail/settings — read or update the caller's own signature_html.
import { requireUser, adminClient, httpError, withErrors, readJsonBody } from "../_lib/auth.js";

export default withErrors(async (req, res) => {
  const user = await requireUser(req);
  const supabase = adminClient();

  if (req.method === "GET") {
    const { data } = await supabase
      .from("mail_accounts")
      .select("email_address, signature_html")
      .eq("user_id", user.id)
      .maybeSingle();
    return res.status(200).json({
      connected: !!data,
      email: data?.email_address || null,
      signature_html: data?.signature_html || "",
    });
  }

  if (req.method === "PUT") {
    const { signature_html } = readJsonBody(req);
    const { error } = await supabase
      .from("mail_accounts")
      .update({ signature_html: signature_html || "" })
      .eq("user_id", user.id);
    if (error) throw httpError(500, "Could not save signature");
    return res.status(200).json({ ok: true });
  }

  throw httpError(405, "Method not allowed");
});
