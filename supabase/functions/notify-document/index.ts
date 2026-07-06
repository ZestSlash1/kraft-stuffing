// Supabase Edge Function: notify-document
// Generalizes notify-seal for the Documentary Suite: sends an issued HBL /
// Arrival Notice / Delivery Order to a WhatsApp contact via Interakt, with a
// signed link to the stored PDF. Template names must be registered in the
// Interakt dashboard first (same one-time step as `container_sealed`).
import { createClient } from "jsr:@supabase/supabase-js@2";
import { emitNotification, teamRecipients } from "../_shared/notify.ts";

const INTERAKT_API_KEY = Deno.env.get("INTERAKT_API_KEY");
const NOTIFY_WHATSAPP_NUMBER = Deno.env.get("NOTIFY_WHATSAPP_NUMBER");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const TEMPLATE_BY_TYPE = {
  hbl: "hbl_issued",
  arrival_notice: "arrival_notice",
  delivery_order: "delivery_order_issued",
};

Deno.serve(async (req) => {
  try {
    const { documentId } = await req.json();
    if (!documentId) {
      return new Response(JSON.stringify({ error: "documentId required" }), { status: 400 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("*, voyages(voyage_no, vessel), bookings(id, notify_shipper, shipper_email, tracking_token)")
      .eq("id", documentId)
      .single();
    if (docErr || !doc) {
      return new Response(JSON.stringify({ error: docErr?.message || "document not found" }), {
        status: 404,
      });
    }
    if (doc.status !== "issued" || !doc.pdf_path) {
      return new Response(JSON.stringify({ error: "document is not issued yet" }), { status: 400 });
    }

    const { data: signed, error: signErr } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.pdf_path, 60 * 60 * 24); // 24h link
    if (signErr) {
      return new Response(JSON.stringify({ error: signErr.message }), { status: 500 });
    }

    const message =
      `${doc.type.toUpperCase()} ${doc.number} issued for voyage ${doc.voyages?.voyage_no || ""} ` +
      `(${doc.voyages?.vessel || ""}). Download: ${signed.signedUrl}`;

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
          name: TEMPLATE_BY_TYPE[doc.type] || "document_issued",
          languageCode: "en",
          bodyValues: [doc.number, doc.voyages?.voyage_no || "", doc.voyages?.vessel || "", signed.signedUrl],
        },
      }),
    });

    const result = await resp.json().catch(() => ({}));

    // Emit an email notification event (§B.1). Team recipients for this event
    // type + the booking's shipper IF opted in (external email is opt-in, §B.3).
    // Wrapped so a ledger failure never fails the WhatsApp/document flow.
    try {
      const booking = doc.bookings || null;
      const trackingUrl = booking?.tracking_token
        ? `https://portal.shafrina.com/t/${booking.tracking_token}`
        : null;
      const external =
        booking?.notify_shipper && booking?.shipper_email ? [booking.shipper_email] : [];
      const recipients = [...(await teamRecipients(supabase, "document_issued")), ...external];
      await emitNotification(supabase, {
        orgId: doc.org_id,
        eventType: "document_issued",
        entityType: "document",
        entityId: doc.id,
        payload: {
          docType: doc.type,
          number: doc.number,
          voyageNo: doc.voyages?.voyage_no || "",
          vessel: doc.voyages?.vessel || "",
          trackingUrl,
        },
        recipients,
      });
    } catch (emitErr) {
      console.error("[notify-document] emit failed (non-fatal):", emitErr?.message);
    }

    return new Response(JSON.stringify({ ok: resp.ok, message, result }), {
      status: resp.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
