# TRACKING_AND_NOTIFICATIONS — Findings Note (read pass, no edits)

Read pass per §0.2. Answers §0.3 (a)(b)(c) before any code.

## (a) What the two `notify-*` functions already do & how they're triggered

Both are **Supabase Edge Functions (Deno)** that send **WhatsApp** messages via the
**Interakt** API (`https://api.interakt.ai/v1/public/message/`, Basic auth, template
messages). Neither sends email. Neither writes any table.

- `supabase/functions/notify-seal/index.ts` — body `{ containerId }`. Loads the
  container + its `stuffing_lines`, computes cargo summary / bag count / net MT / shipper /
  consignee, and sends the `container_sealed` Interakt template to a single hardcoded env
  number (`NOTIFY_WHATSAPP_NUMBER`). Per SPEC §Phase2 it is **client-invoked**:
  `supabase.functions.invoke('notify-seal', { body: { containerId } })` right after the
  container's `sealed` flag flips true. Fails/aborts if `INTERAKT_API_KEY` /
  `NOTIFY_WHATSAPP_NUMBER` are unset (returns 500) — but it's fire-and-forget from the
  client, so a failure never blocks the seal write.
- `supabase/functions/notify-document/index.ts` — body `{ documentId }`. Generalizes the
  above for the Documentary Suite: loads a `documents` row (must be `status='issued'` with a
  `pdf_path`), creates a 24h signed Storage URL, and sends `hbl_issued` /`arrival_notice` /
  `delivery_order_issued` template (by `doc.type`) to the same single env number. Also
  client-invoked, same single-recipient env-number model.

**Implication for B.1:** there is **no** server-side event table today and **no** trigger
invoking these — emission is client-side, single WhatsApp recipient. The spec's B.1 requires
server-side event emission. Cleanest path that respects "extend existing, don't duplicate":
have these functions **insert a `notification_events` row** (and let the delivery worker fan
out to email) in addition to / instead of the direct Interakt call. Since they're invoked
from the client today, the "server-side moment" is the edge function body itself — acceptable
per the spec's "extend the existing notify-* functions … to insert notification_events".
Voyage-status change has **no** existing function; add a matching emission point where voyage
`status` / a `vessel_movements` row is written.

## (b) Do bookings store shipper/consignee email/phone anywhere?

**No.** Checked `bookings` (0003), `shippers`, `consignees` (SPEC schema). None carry
`email` or `phone`:
- `bookings`: voyage_id, shipper_id, consignee_id, booking_date, freight_*, payment_status,
  notes. No contact fields.
- `shippers`: name, address, gstin, iec_code. No email/phone.
- `consignees`: name, address, country. No email/phone.

**Implication for B.3:** external-recipient emails require **new per-booking email fields**
(`bookings.consignee_email`, `bookings.shipper_email`) plus per-booking opt-in toggles.
Add to the booking form. Default OFF (external email is opt-in per §B.3).

## (c) Status/timestamp fields that a tracking page can honestly display

Milestones with real backing data (for the §A.3 timeline):

| Milestone            | Source field(s)                                             | Honesty note |
|----------------------|-------------------------------------------------------------|--------------|
| Booked               | `bookings.booking_date` / `bookings.created_at`             | always known |
| Stuffed              | earliest `stuffing_lines.logged_at` for the booking's lines | derived      |
| Sealed               | `containers.sealed` + `containers.sealed_at`                | per container |
| Departed (On Board)  | `vessel_movements` `event_type='sailed'` `event_date`; also `voyages.status='LOADING/COMPLETED'` | actual |
| In transit           | `vessel_movements` `event_type='in_transit'`                | actual |
| Arrived / Discharged | `vessel_movements` `event_type in ('berthed','discharged')` | actual |
| **Delivered**        | **no field**                                                | **omit** — do not fabricate |

- **ETD exists** (`voyages.etd timestamptz`) → show labeled **"Expected"** departure per
  §A.3. There is **no** arrival-ETA field → omit any arrival ETA (do not compute).
- `voyages`: vessel, voyage_no, pol (default Kolkata), pod (default Port Blair), etd, status
  (`DRAFT|LOADING|COMPLETED|ARCHIVED`), archived.
- `containers`: number, size ('20'/'40'), seal_no, sealed, sealed_at. **Excluded from
  public per §A.3:** tare_weight_kg, cml_kg (VGM-adjacent). Gross weight can be derived from
  lines (default include per §A.3) but tare/VGM never.
- `vessel_movements` (0003): event_type `loading|sailed|in_transit|berthed|discharging|
  discharged|delayed|other`, event_date, location, lat/long, notes — the real timeline axis.

## Supporting facts for implementation

- **Public route:** `vercel.json` is a single SPA rewrite `"/((?!api/).*)" → /index.html`.
  A `/t/{token}` path already falls through to the SPA. So the public page can be a
  **route inside the SPA** rendered without the auth shell (App.jsx uses hash/state routing,
  `route={page,params}`), reading from a public API endpoint. `/api/*` is excluded from the
  rewrite, so `api/track/[token].js` works as a serverless function.
- **Serverless auth pattern** (`api/_lib/auth.js`): `adminClient()` (service role, bypasses
  RLS), `requireUser(req)`, `withErrors()`, `readJsonBody()`. The public track endpoint must
  **NOT** call requireUser (it's public) but MUST use `adminClient()` + its own token lookup
  and an explicit field projection — never `select *`. No existing per-IP rate-limit
  framework → **note as a gap** (§A.1), don't build one.
- **SMTP send path** (`api/mail/send.js` + `api/_lib/mailAccount.js`): per-account Hostinger
  SMTP via `nodemailer`, `resolveAccount(userId, accountId)` + `makeTransport(account)`,
  passwords encrypted (`mailCrypto.js`). Confirms **B.2 is viable**: a notification delivery
  worker can pick a designated `mail_accounts` row and `makeTransport().sendMail()`. The
  designated-sender setting fits `org_settings` (key/value store, 0002).
- **Scheduling:** no existing Vercel cron / Supabase scheduled function in repo. Delivery
  worker → add a **Vercel cron** (`vercel.json` `crons`) hitting a new `api/notify/dispatch.js`.
  Note in worker: `WHATSAPP_TODO` insertion point (§B.6).
- **org id:** `KRAFT_ORG_ID` constant in `src/lib/db.js`; `notification_events.org_id` uses it.
- **Audit log** (0004): generic `log_audit_event()` trigger on bookings/voyages/containers/
  etc. It's an audit sink, not an event bus — **not** repurposed for notifications (spec wants
  a dedicated `notification_events` table). Noted as the "natural event source" but kept
  separate to keep render-ready payloads.

## Gaps flagged
- No per-IP rate limiting surface exists → public endpoint ships without it (constant-time-ish
  404 for unknown tokens only).
- No existing scheduler → introducing Vercel cron is new infra (minimal, config-only).
- WhatsApp channel is schema-ready only; no provider code (§B.6).
