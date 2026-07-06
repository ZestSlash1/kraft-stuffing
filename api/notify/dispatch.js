// GET /api/notify/dispatch — the notification delivery worker (§B.2).
// Runs on a Vercel cron (see vercel.json `crons`). Picks 'pending' email
// deliveries, sends each via the ONE designated org notification account (the
// existing per-account SMTP infrastructure — no new provider, no new secrets),
// and marks sent/failed. Bounded retries (MAX_ATTEMPTS) with the attempt counter
// on the row; exhausted rows rest as 'failed' and stay visible in-app.
//
// A send failure NEVER touches the operational action that emitted the event —
// events are already committed; this worker only moves the delivery ledger.
//
// WHATSAPP_TODO: WhatsApp is schema-ready (channel='whatsapp') but has no provider
// in v1 (§B.6). To add it: branch on delivery.channel here, resolve a WhatsApp
// provider (Meta/Twilio/Gupshup) transport, and send the same rendered facts.
// Do not add a provider SDK speculatively — it's a business/signup decision.
import { adminClient, httpError, withErrors } from "../_lib/auth.js";
import { makeTransport } from "../_lib/mailAccount.js";
import { decrypt } from "../_lib/mailCrypto.js";
import { renderNotificationEmail } from "../_lib/notifyEmail.js";

const BATCH = 25; // deliveries handled per run
const MAX_ATTEMPTS = 3; // bounded retries before resting as 'failed'

export const config = { maxDuration: 60 };

// Only Vercel cron (x-vercel-cron header) or a caller holding CRON_SECRET may run
// this — it is not a public endpoint.
function authorized(req) {
  if (req.headers["x-vercel-cron"]) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.authorization || "";
  return header === `Bearer ${secret}`;
}

// The designated notification sender (org_settings 'notify_sender_account_id').
async function loadSenderAccount(db) {
  const { data: setting } = await db
    .from("org_settings")
    .select("value")
    .eq("key", "notify_sender_account_id")
    .maybeSingle();
  const accountId = setting?.value;
  if (!accountId) return null;
  const { data: acct } = await db.from("mail_accounts").select("*").eq("id", accountId).maybeSingle();
  if (!acct) return null;
  return { ...acct, password: decrypt(acct.password_encrypted) };
}

export default withErrors(async (req, res) => {
  if (!authorized(req)) throw httpError(401, "Unauthorized");
  const db = adminClient();

  // Pull pending email deliveries with their (frozen) event payload.
  const { data: pending, error } = await db
    .from("notification_deliveries")
    .select("*, notification_events(event_type, payload)")
    .eq("status", "pending")
    .eq("channel", "email")
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (error) throw httpError(500, "Could not load deliveries");
  if (!pending || pending.length === 0) {
    return res.status(200).json({ ok: true, processed: 0 });
  }

  const account = await loadSenderAccount(db);
  if (!account) {
    // No sender configured — leave deliveries pending, report the gap.
    return res.status(200).json({ ok: false, processed: 0, error: "no_sender_configured" });
  }
  const transport = makeTransport(account);

  let sent = 0;
  let failed = 0;
  for (const d of pending) {
    const event = d.notification_events;
    const attempts = (d.attempts || 0) + 1;
    try {
      const { subject, html, text } = renderNotificationEmail(event);
      await transport.sendMail({ from: account.email_address, to: d.recipient, subject, html, text });
      await db
        .from("notification_deliveries")
        .update({ status: "sent", attempts, error: null, sent_at: new Date().toISOString() })
        .eq("id", d.id);
      sent++;
    } catch (err) {
      // Rest as 'failed' once retries are exhausted; otherwise stay 'pending'.
      const done = attempts >= MAX_ATTEMPTS;
      await db
        .from("notification_deliveries")
        .update({
          status: done ? "failed" : "pending",
          attempts,
          error: (err?.message || "send failed").slice(0, 300),
        })
        .eq("id", d.id);
      failed++;
    }
  }

  return res.status(200).json({ ok: true, processed: pending.length, sent, failed });
});
