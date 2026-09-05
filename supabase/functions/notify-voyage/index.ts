// Supabase Edge Function: notify-voyage
// Voyage status-change emission (§B.1). Client invokes this when a voyage reaches
// a departed/arrived milestone (voyage.status flips, or a 'sailed'/'discharged'
// vessel_movement is logged):
//   supabase.functions.invoke('notify-voyage', { body: { voyageId, eventType } })
// eventType: 'voyage_departed' | 'voyage_arrived'.
//
// Team recipients get one voyage-level event. Each booking on the voyage that has
// opted its consignee in (notify_consignee + consignee_email) gets its OWN
// booking-level event carrying that booking's tracking link (§B.3 synergy point).
// Emission only — sending is the Vercel cron worker's job.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { emitNotification, teamRecipients } from "../_shared/notify.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const VALID = new Set(["voyage_departed", "voyage_arrived"]);

Deno.serve(async (req) => {
  try {
    const { voyageId, eventType } = await req.json();
    if (!voyageId || !VALID.has(eventType)) {
      return new Response(JSON.stringify({ error: "voyageId + valid eventType required" }), {
        status: 400,
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: voyage, error: vErr } = await supabase
      .from("voyages")
      .select("id, org_id, voyage_no, vessel, pol, pod")
      .eq("id", voyageId)
      .single();
    if (vErr || !voyage) {
      return new Response(JSON.stringify({ error: vErr?.message || "voyage not found" }), {
        status: 404,
      });
    }

    const milestone = eventType === "voyage_departed" ? "departed" : "arrived";
    const baseFacts = {
      voyageNo: voyage.voyage_no || "",
      vessel: voyage.vessel || "",
      pol: voyage.pol || "",
      pod: voyage.pod || "",
      milestone,
    };

    // Team-level event.
    const team = await teamRecipients(supabase, eventType);
    await emitNotification(supabase, {
      orgId: voyage.org_id,
      eventType,
      entityType: "voyage",
      entityId: voyage.id,
      payload: { ...baseFacts, trackingUrl: null },
      recipients: team,
    });

    // Per-booking consignee events (opt-in only), each with its tracking link.
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, notify_consignee, consignee_email, tracking_token")
      .eq("voyage_id", voyage.id)
      .eq("notify_consignee", true);

    let consigneeEvents = 0;
    for (const b of bookings || []) {
      if (!b.consignee_email) continue;
      const trackingUrl = b.tracking_token
        ? `https://portal.shafrina.com/t/${b.tracking_token}`
        : null;
      await emitNotification(supabase, {
        orgId: voyage.org_id,
        eventType,
        entityType: "booking",
        entityId: b.id,
        payload: { ...baseFacts, trackingUrl },
        recipients: [b.consignee_email],
      });
      consigneeEvents++;
    }

    return new Response(
      JSON.stringify({ ok: true, teamRecipients: team.length, consigneeEvents }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
