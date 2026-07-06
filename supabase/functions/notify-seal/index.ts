// Supabase Edge Function: notify-seal
// Fired by the client right after a container's `sealed` flag flips to true.
// Looks up the container + its lines, builds a WhatsApp template message, and
// sends it via Interakt.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { emitNotification, teamRecipients } from "../_shared/notify.ts";

const INTERAKT_API_KEY = Deno.env.get("INTERAKT_API_KEY");
const NOTIFY_WHATSAPP_NUMBER = Deno.env.get("NOTIFY_WHATSAPP_NUMBER");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

Deno.serve(async (req) => {
  try {
    const { containerId } = await req.json();
    if (!containerId) {
      return new Response(JSON.stringify({ error: "containerId required" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: container, error: cErr } = await supabase
      .from("containers")
      .select("*, voyages(voyage_no, org_id)")
      .eq("id", containerId)
      .single();
    if (cErr || !container) {
      return new Response(JSON.stringify({ error: cErr?.message || "container not found" }), {
        status: 404,
      });
    }

    const { data: lines, error: lErr } = await supabase
      .from("stuffing_lines")
      .select("*")
      .eq("container_id", containerId);
    if (lErr) {
      return new Response(JSON.stringify({ error: lErr.message }), { status: 500 });
    }

    const cargoSummary = [...new Set((lines || []).map((l) => l.cargo))].join(", ");
    const totalBags = (lines || []).reduce((a, l) => a + Number(l.qty || 0), 0);
    const netKg = (lines || []).reduce(
      (a, l) => a + Number(l.qty || 0) * Number(l.unit_weight_kg || 0),
      0
    );
    const netMt = (netKg / 1000).toFixed(2);
    const shipper = lines?.[0]?.shipper_name || "—";
    const consignee = lines?.[0]?.consignee_name || "—";

    const message =
      `Container ${container.number} sealed on voyage ${container.voyages?.voyage_no || ""}.\n` +
      `Cargo: ${cargoSummary}. Bags: ${totalBags}. Net: ${netMt} MT.\n` +
      `Seal: ${container.seal_no}. Shipper: ${shipper} → ${consignee}`;

    if (!INTERAKT_API_KEY || !NOTIFY_WHATSAPP_NUMBER) {
      return new Response(
        JSON.stringify({ error: "INTERAKT_API_KEY / NOTIFY_WHATSAPP_NUMBER not configured" }),
        { status: 500 }
      );
    }

    const resp = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: {
        Authorization: `Basic ${INTERAKT_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        countryCode: "+91",
        phoneNumber: NOTIFY_WHATSAPP_NUMBER.replace(/^\+?91/, ""),
        type: "Template",
        template: {
          name: "container_sealed",
          languageCode: "en",
          bodyValues: [
            container.number,
            container.voyages?.voyage_no || "",
            cargoSummary,
            String(totalBags),
            netMt,
            container.seal_no,
            shipper,
            consignee,
          ],
        },
      }),
    });

    const result = await resp.json().catch(() => ({}));

    // Emit an email notification event (§B.1) — team recipients only; sealing is
    // an internal milestone (external customer email is departure/arrival/doc, §B.3).
    try {
      await emitNotification(supabase, {
        orgId: container.voyages?.org_id,
        eventType: "container_sealed",
        entityType: "container",
        entityId: container.id,
        payload: {
          number: container.number,
          voyageNo: container.voyages?.voyage_no || "",
          cargoSummary,
          totalBags,
          netMt,
          sealNo: container.seal_no,
          shipper,
          consignee,
        },
        recipients: await teamRecipients(supabase, "container_sealed"),
      });
    } catch (emitErr) {
      console.error("[notify-seal] emit failed (non-fatal):", emitErr?.message);
    }

    return new Response(JSON.stringify({ ok: resp.ok, message, result }), {
      status: resp.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
