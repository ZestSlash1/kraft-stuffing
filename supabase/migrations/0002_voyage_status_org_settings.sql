-- Migration: voyage status/archived + org_settings key/value store
-- Run in Supabase SQL editor (or `supabase db push`).

-- Voyage lifecycle status + soft-delete flag
alter table voyages add column if not exists status   text default 'DRAFT';
-- 'DRAFT' | 'LOADING' | 'COMPLETED' | 'ARCHIVED'
alter table voyages add column if not exists archived boolean default false;

-- Master-data soft-delete flags
alter table shippers   add column if not exists archived boolean default false;
alter table consignees add column if not exists archived boolean default false;

-- Org-wide settings (tare/CML defaults, default ports, WhatsApp number, etc.)
create table if not exists org_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz default now()
);

alter table org_settings enable row level security;
do $$ begin
  create policy "auth_all" on org_settings for all using (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
