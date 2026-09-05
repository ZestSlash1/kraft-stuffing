-- Migration: outbound notifications (TRACKING_AND_NOTIFICATIONS Part B)
-- Additive. Event + delivery ledger, plus per-booking external-recipient fields.
-- No existing write path, document logic, or mail credential handling is touched.

-- ── Event ledger: one row per operational moment worth notifying about. ──
-- Written server-side by the same moments that already exist (document issue,
-- seal confirm, voyage status change). payload is render-ready facts frozen at
-- event time so the email/worker never re-queries mutable state.
create table if not exists notification_events (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null,
  event_type text not null,   -- 'document_issued' | 'container_sealed' | 'voyage_departed' | 'voyage_arrived'
  entity_type text not null,  -- 'document' | 'container' | 'voyage' | 'booking'
  entity_id  uuid not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

-- ── Delivery ledger: one row per (event, channel, recipient). The worker walks
-- 'pending' rows, sends, and marks sent/failed. channel is WhatsApp-ready but
-- v1 only writes 'email' (§B.6). ──
create table if not exists notification_deliveries (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references notification_events(id) on delete cascade,
  channel    text not null,                          -- 'email' (v1) | 'whatsapp' (scaffolded)
  recipient  text not null,                          -- email address
  status     text not null default 'pending',        -- pending | sent | failed
  attempts   int not null default 0,                 -- bounded-retry counter
  error      text,
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notification_deliveries_pending
  on notification_deliveries (status, created_at)
  where status = 'pending';
create index if not exists idx_notification_deliveries_event
  on notification_deliveries (event_id);

-- ── Per-booking external recipients (§B.3). Optional customer emails + per-booking
-- opt-in toggles. DEFAULT OFF — emailing customers is never automatic. ──
alter table bookings add column if not exists shipper_email     text;
alter table bookings add column if not exists consignee_email   text;
alter table bookings add column if not exists notify_shipper    boolean not null default false; -- notify shipper on document issue
alter table bookings add column if not exists notify_consignee  boolean not null default false; -- notify consignee on departure/arrival

-- ── RLS: read/insert for authenticated app users (same 'auth_all' pattern as the
-- rest of the schema). The delivery worker uses the service role (bypasses RLS);
-- these policies just let the in-app deliveries panel read status. ──
alter table notification_events     enable row level security;
alter table notification_deliveries enable row level security;

do $$ begin
  create policy "auth_all" on notification_events
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth_all" on notification_deliveries
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;

-- Designated notification-sender account + team recipient config live in the
-- existing org_settings key/value store (0002) — no schema needed:
--   key 'notify_sender_account_id'  -> mail_accounts.id used as the From:
--   key 'notify_team_recipients'    -> JSON { event_type: [email, ...] }
