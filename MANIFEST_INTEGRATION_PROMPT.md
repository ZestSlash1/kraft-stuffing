# MANIFEST_INTEGRATION_PROMPT.md
## Kraft Portal — manifest section added to kraft-stuffing repo

Read CLAUDE.md first. All design tokens, fonts, and conventions there are canonical.
Execute one phase per session. Commit before moving on.

---

## Context

- New subdomain: kraft.shafrina.com (DNS: CNAME `kraft` → `cname.vercel-dns.com`)
- stuff.shafrina.com stays live (redirect or alias — Vercel handles this)
- One repo, one build, one Supabase project (the stuffing project)
- One login → app selector screen → two sections: STUFFING LOG | MANIFEST
- Manifest is a FRESH BUILD in the stuffing design system — no shadcn, no Tailwind,
  same inline-style approach used everywhere in this codebase

---

## Confirmed schema additions (approved, write migration SQL and apply)

```sql
-- Bookings: consignment-level commercial data (one booking → many stuffing_lines)
create table bookings (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references orgs(id),
  voyage_id        uuid references voyages(id),
  shipper_id       uuid references shippers(id),
  consignee_id     uuid references consignees(id),
  booking_date     date,
  freight_amount   numeric,
  freight_currency text default 'INR',
  freight_status   text default 'to_pay'
                   check (freight_status in ('to_pay','prepaid','paid')),
  payment_status   text default 'pending'
                   check (payment_status in ('pending','partial','paid')),
  notes            text,
  created_by       uuid references profiles(id),
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

-- stuffing_lines: two new columns only
-- (truck_no, eway_bill_no, shipper_id, consignee_id already exist — do NOT duplicate)
alter table stuffing_lines
  add column booking_id      uuid references bookings(id),
  add column eway_valid_till date;

-- Vessel movements: tracking/globe feed, separate axis from container fill/seal status
create table vessel_movements (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references orgs(id),
  voyage_id  uuid references voyages(id) on delete cascade,
  event_type text not null
             check (event_type in ('loading','sailed','in_transit','berthed',
                                   'discharging','discharged','delayed','other')),
  event_date timestamptz not null,
  location   text,
  latitude   numeric,
  longitude  numeric,
  notes      text,
  logged_by  uuid references profiles(id),
  created_at timestamptz default now()
);

-- Push subscriptions
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references orgs(id),
  user_id    uuid references profiles(id) on delete cascade,
  user_email text,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  user_agent text,
  created_at timestamptz default now(),
  unique (user_id, endpoint)  -- upsert on (user_id, endpoint), not endpoint alone
);

-- RLS (with check clause — matches existing pattern)
alter table bookings           enable row level security;
alter table vessel_movements   enable row level security;
alter table push_subscriptions enable row level security;

create policy "auth_all" on bookings
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
create policy "auth_all" on vessel_movements
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
create policy "auth_all" on push_subscriptions
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

-- Realtime
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table vessel_movements;

-- updated_at trigger (reuses existing touch_updated_at function)
create trigger touch_bookings before update on bookings
  for each row execute function touch_updated_at();
```

Confirm profiles.id = auth.users.id before applying. If profiles uses a separate
user_id FK, update the references above accordingly.

---

## PHASE A — Portal shell

1. Add app selector screen to AuthView (shown after successful OTP login, before
   entering the app). Two cards: STUFFING LOG and MANIFEST. Same void-black style,
   dock amber hover, Barlow Condensed 800 labels.
2. Add top-level route: `manifest` alongside existing routes. Hash/useState router —
   no react-router.
3. TopNav: add MANIFEST link (same active-amber style). BottomNav: replace one icon
   or add MANIFEST as 5th item.
4. ManifestShell component: placeholder "MANIFEST — COMING SOON" screen in full
   stuffing design system styling. Confirms routing works end to end.
5. Update Vercel project: add kraft.shafrina.com domain. stuff.shafrina.com stays.

Done when: login → app selector → click MANIFEST → ManifestShell renders.

---

## PHASE B — Schema + data layer

1. Apply the migration SQL above.
2. Create supabase query helpers for: bookings CRUD, vessel_movements CRUD,
   push_subscriptions upsert (on conflict (user_id, endpoint) do update).
3. Add booking_id linkage to the existing AddForm: optional "Link to booking" field
   (searchable dropdown of bookings for this voyage).

Done when: can create a booking and link stuffing lines to it via the form.

---

## PHASE C — Manifest screens (fresh build, stuffing design system)

Build each screen inline-styled, Barlow Condensed headers, JetBrains Mono data,
#102030 hairline borders, square corners, void-black background. No shadcn, no Tailwind.

Screens to build:
1. **BookingsView** — table of bookings per voyage. Columns: booking date, shipper,
   consignee, freight status (amber badge), payment status (green/red badge), amount.
   Click → BookingDetailView.
2. **BookingDetailView** — booking header + linked stuffing lines table + edit fields.
3. **ManifestView** — ANEMCO-style manifest document generated from a sealed voyage's
   containers + stuffing_lines. Print-ready layout. Export to PDF via jsPDF (reuse
   existing export conventions).
4. **VesselMovementsView** — chronological event log per voyage. Add movement form.
   Statuses: colour-coded badges matching the stuffing status palette.
5. **PortGlobeView** — react-globe.gl port network. Lazy-loaded (dynamic import).
   Dark globe, amber/green arcs, steel labels. Matches vessel-hero aesthetic.

---

## PHASE D — Polish

1. Lazy-load react-globe.gl (dynamic import — not in initial bundle).
2. Extend audit_log to cover bookings and vessel_movements actions.
3. Manifest PDF: match jsPDF styling conventions already used for packing list export.
4. PWA: add manifest routes to precache.
5. Bundle report: before/after sizes, confirm globe is code-split.

---

## Guardrails

- No shadcn, no Tailwind, no border-radius in manifest screens.
- All tokens from CLAUDE.md. No new colours.
- One Supabase client. Never reference the deleted manifest project.
- Do not touch containers.sealed / container status enum — vessel_movements is the
  separate loaded/sailed/delivered axis.
- GST reads from shippers.gstin via shipper_id — no per-line gst_number.
- truck_no and eway_bill_no already exist on stuffing_lines — do not add duplicates.
