# TRACKING_AND_NOTIFICATIONS.md

**Purpose:** Two additive modules for Kraft Portal:
(A) **Public tracking links** — a shareable, read-only "where's my shipment" page per booking,
requiring no login, safe to hand to any consignee.
(B) **Outbound notifications** — email alerts on key operational events (document issued,
container sealed, vessel departed/arrived), to team members and optionally to the shipper/
consignee on a booking. WhatsApp is scaffolded but not enabled in v1 (see B.6).

For a **Claude Fable 5** Claude Code session. Additive only — no changes to existing tables'
write paths, document logic, or mail credential handling.

---

## 0. SESSION SETUP

1. `/model` → `claude-fable-5`.
2. Read pass (no edits): `supabase/functions/notify-document/index.ts`,
   `supabase/functions/notify-seal/index.ts` (these are half-built notification plumbing — the
   findings note must state what they currently do and how they're triggered),
   `supabase/migrations/0004_audit_log_triggers.sql` (the audit log is the natural event source),
   `src/lib/documents.js`, `api/_lib/auth.js`, `api/mail/send.js` + `api/_lib/mailAccount.js`
   (to assess whether outbound notifications can ride the existing SMTP path — see B.2),
   `src/views/BookingDetailView.jsx`, `vercel.json` (routing for a public page).
3. **Findings note first**, then code: (a) what the two notify functions already do, (b) whether
   bookings already store shipper/consignee email/phone anywhere, (c) which status/timestamp
   fields exist on bookings/voyages/containers that a tracking page can honestly display.
4. One file per turn, commit each, single `npm run build` at the end.

---

## PART A — PUBLIC TRACKING LINKS

### A.1 Security model (the part that matters most)

- Each booking can have a **tracking token**: 128-bit+ random, URL-safe (e.g. 22-char base62 from
  `crypto.getRandomValues`), stored hashed or plain per existing repo convention — but **never**
  sequential, never derived from booking id/number.
- Public URL: `https://portal.shafrina.com/t/{token}` (route via `vercel.json` — confirm the SPA
  routing pattern; a dedicated lightweight public route component, not the authed app shell).
- The public page is served data by a **single dedicated endpoint** (`api/track/[token].js` or
  equivalent) that:
  - Looks up by token only. No booking ids, no enumeration, no list endpoint.
  - Returns a **hand-picked whitelist of fields** (A.3) — never `select *`, never joins that drag
    in financials, expenses, values, mail, or internal notes. The whitelist is defined once as an
    explicit projection in this endpoint; adding a field later is a deliberate code change.
  - Uses the service-role/server-side path with its own token check — do not weaken any RLS
    policy on existing tables to make this work. Public access exists *only* through this one
    endpoint's projection.
  - Basic abuse guard: 404 (identical response/time as far as practical) for unknown tokens; a
    simple per-IP rate limit if the existing API surface has a pattern for it (don't build a
    rate-limiting framework if none exists — note it as a gap instead).
- **Revocable and regenerable:** owner can disable a link (null the token) or regenerate it
  (invalidate old, issue new) from `BookingDetailView`. Voided bookings' links always 404.
- Token creation/revocation goes through the normal authed write path.

### A.2 Schema

```sql
alter table bookings add column tracking_token text unique;      -- null = no public link
alter table bookings add column tracking_enabled_at timestamptz; -- audit convenience
```

(Adapt naming to real schema; if bookings table is named differently, follow reality.)

### A.3 What the public page shows (whitelist — nothing else)

- Booking number, POL → POD, vessel name + voyage number.
- Container number(s), size/type.
- **Status timeline** derived from fields that actually exist (per findings 0.3): e.g.
  Booked → Stuffed → Sealed → On Board → Departed → Arrived → Delivered, each with its date if
  known, honestly showing only reached milestones. Do not fabricate ETA math that the data
  doesn't support — if ETA exists on the voyage, show it labeled "Expected"; if not, omit.
- Kraft Shipping branding + contact line (from existing letterhead constants).
- **Explicitly excluded:** cargo value, weights beyond what a consignee reasonably needs (include
  gross weight only if desired — default include; nothing about tare/VGM), any party's private
  contact details, expenses, P&L, document files themselves, internal remarks.

### A.4 Page treatment

- Standalone lightweight route (no auth context, no app shell, minimal JS). Loadex-adjacent but
  print-clean: white/light card on a subtle marine-tinted background, Kraft logo, big status
  timeline (the one place a vertical stepper with dates is exactly right), container list in
  monospace. Mobile-first — consignees will open this on phones.
- A "last updated" timestamp so stale data is honest.
- No login prompts, no links into the authed app.

### A.5 Owner-side UI

- `BookingDetailView`: a "Tracking link" glass panel — status (off / active), Create link,
  Copy link, Regenerate (with `ConfirmDialog` — old link stops working), Disable.
- Optional convenience: "Share via mail" pre-fills a compose draft with the link (uses the
  existing compose view; does not auto-send).

---

## PART B — OUTBOUND NOTIFICATIONS (email v1)

### B.1 Event model

One new table, written by the same server-side moments that already exist (document issue, seal
confirm, voyage status change) — **do not** invent client-side event emission:

```sql
create table notification_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  event_type text not null,      -- 'document_issued' | 'container_sealed' | 'voyage_departed' | 'voyage_arrived'
  entity_type text not null,     -- 'document' | 'container' | 'voyage' | 'booking'
  entity_id uuid not null,
  payload jsonb not null,        -- render-ready facts captured at event time
  created_at timestamptz not null default now()
);

create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references notification_events(id),
  channel text not null,         -- 'email' (v1) | 'whatsapp' (scaffolded, unused v1)
  recipient text not null,       -- email address
  status text not null default 'pending',  -- pending | sent | failed
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
```

Emission points: extend the **existing** `notify-document` / `notify-seal` Supabase functions (or
the triggers that invoke them, per findings) to insert `notification_events`; add the voyage
status-change emission following the same pattern. If the findings show these functions already
send something (e.g. a webhook or email), fold that behavior in rather than duplicating it.

### B.2 Sending — decision baked in, revisit if findings contradict

Notifications send via **one designated org notification account** using the existing per-account
SMTP infrastructure (`mailAccount.js` + the send path): a settings field selects which connected
mail account is the "Notifications sender" (e.g. a noreply@/ops@ mailbox). Rationale: the SMTP
plumbing, encryption, and per-account settings already exist and are trusted; adding a third-party
transactional email provider (Resend/SES) is new surface + new secrets for marginal v1 gain.
**Tradeoff to know:** business-mailbox SMTP has sending limits and weaker deliverability than a
transactional provider — fine at Kraft's volume (tens/day), revisit if volume grows or
deliverability suffers. The `notification_deliveries` table makes a later provider swap a
send-function change, not a schema change.

Delivery worker: a small server-side function (Vercel cron or Supabase scheduled function —
follow whichever scheduling mechanism the repo/platform already uses; findings note should say)
that picks `pending` deliveries, sends via the designated account, marks sent/failed. Failures
retry a bounded number of times (e.g. 3, backoff), then rest as `failed` and visible in UI.
Never let a send failure block or roll back the operational action that caused the event.

### B.3 Recipients & rules

Settings screen (`SettingsView` section or a `NotificationSettingsView`):
- **Team recipients:** per event type, choose team members (from existing team data) to email.
- **External recipients:** per booking, optional shipper/consignee email fields (add to the
  booking form if findings show they don't exist) with per-booking toggles: "Notify consignee on
  departure/arrival", "Notify shipper on document issue". Default OFF for external parties —
  emailing customers is opt-in per booking, never automatic.
- Every external email includes the booking's tracking link (Part A) if one is active — this is
  the synergy point: "Your shipment departed Kolkata — track it here."

### B.4 Email content

- Simple, reliable HTML: Kraft letterhead header (logo + name), one-line event statement, a small
  facts table (booking no, vessel/voyage, container(s), date), tracking-link button when
  applicable, contact footer. Build once as a tiny template helper; all event types use it with
  different copy. No external images beyond the logo; must read fine in plain-text fallback.

### B.5 In-app visibility

- `notification_deliveries` surfaced in the Activity Feed pattern (or a small "Notifications"
  panel in settings): what was sent, to whom, when, and failures with reasons — so a "did the
  consignee get the arrival email?" question has a checkable answer.

### B.6 WhatsApp — scaffolded, not built

The `channel` column and delivery table are WhatsApp-ready, but v1 does **not** integrate a
provider. WhatsApp Business messaging requires a Meta Business account + a provider (Twilio,
Gupshup, etc.), template pre-approval, and per-message costs — a signup/business decision, not a
coding task. Leave a short `WHATSAPP_TODO` note in the delivery worker marking the insertion
point. Do not add a provider SDK speculatively.

---

## EXECUTION ORDER

1. Findings note (0.2–0.3).
2. Part A: migration → public endpoint (whitelist projection) → public page/route →
   BookingDetailView panel.
3. Part B: migrations → event emission (extend existing notify functions + voyage status) →
   designated-sender setting → delivery worker → recipients settings UI → email template →
   deliveries visibility.
4. `npm run build`. Smoke: (a) create a tracking link, open it logged-out on a phone, confirm
   only whitelisted fields render; regenerate and confirm the old link 404s; (b) issue a test
   document and confirm a team email arrives with correct facts; (c) kill SMTP settings
   temporarily and confirm the delivery records `failed` visibly without breaking the document
   issue itself.

---

## ACCEPTANCE CHECKLIST

- [ ] Tracking tokens are ≥128-bit random, unique, revocable, regenerable; unknown tokens 404.
- [ ] Public endpoint returns only the explicit field whitelist; no RLS policy on existing tables
      was weakened; no other public surface added.
- [ ] Public page: no auth context, mobile-first, honest timeline (no fabricated milestones/ETA).
- [ ] Cargo value, tare/VGM, expenses, internal notes never appear in any public response.
- [ ] Events emitted server-side from existing operational moments; UI actions never blocked by
      notification failures.
- [ ] External (customer) emails are per-booking opt-in, default off; team emails configurable
      per event type.
- [ ] Deliveries logged with status + errors, visible in-app; bounded retries.
- [ ] WhatsApp is schema-ready but no provider code shipped.
- [ ] No changes to mail credential handling; sender is a normal connected account chosen in
      settings.
- [ ] `npm run build` passes; all three smoke tests done.
