-- Migration: canned response templates (PHASE_MAIL_TEMPLATES_REMINDERS.md §A).
--
-- Deliberately a SEPARATE table from mail_templates (0024/0026): mail_templates backs
-- the compose card's per-account "save this draft" / signature pickers (owner-only RLS,
-- account-scoped). mail_canned_responses is the org-wide library of reusable reply
-- content grouped by category with {{variable}} substitution — different shape, different
-- audience (anyone composing on behalf of Kraft/Shafrina, not one operator's drafts).
-- Uses the schema's standard "auth_all" org-wide RLS pattern (see notification_events,
-- 0020) rather than mail_templates' per-user pattern, since these are meant to be shared.

create table if not exists mail_canned_responses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
    -- 'Booking Confirmation' | 'Arrival Notice' | 'Payment Follow-up'
    -- | 'Documentation Request' | 'Customs Query' | 'General'
  subject text,
  body text not null,
  is_void boolean not null default false, -- void-only deletion
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mail_canned_responses_category_idx
  on mail_canned_responses (category) where is_void = false;

alter table mail_canned_responses enable row level security;

do $$ begin
  create policy "auth_all" on mail_canned_responses
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
