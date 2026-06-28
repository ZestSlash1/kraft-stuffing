-- Migration: Manifest portal — bookings, vessel_movements, push_subscriptions
-- Run in Supabase SQL editor (or `supabase db push`).
-- profiles.id references auth.users(id) directly (confirmed in SPEC.md) —
-- all profiles(id) FKs below are correct as-is.

-- Bookings: consignment-level commercial data (one booking → many stuffing_lines)
create table if not exists bookings (
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
  add column if not exists booking_id      uuid references bookings(id),
  add column if not exists eway_valid_till date;

-- Vessel movements: tracking/globe feed, separate axis from container fill/seal status
create table if not exists vessel_movements (
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
create table if not exists push_subscriptions (
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

do $$ begin
  create policy "auth_all" on bookings
    for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth_all" on vessel_movements
    for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "auth_all" on push_subscriptions
    for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
exception when duplicate_object then null; end $$;

-- Realtime
alter publication supabase_realtime add table bookings;
alter publication supabase_realtime add table vessel_movements;

-- updated_at trigger (reuses existing touch_updated_at function)
do $$ begin
  create trigger touch_bookings before update on bookings
    for each row execute function touch_updated_at();
exception when duplicate_object then null; end $$;
