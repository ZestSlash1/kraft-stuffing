-- Migration: Mail compose redesign — templates + scheduled sends.
--
-- Backs the new floating compose card (see PHASE_MAIL_COMPOSE_REDESIGN.md): a
-- template picker that populates subject+body, and a "schedule send" action that
-- queues a message instead of sending immediately. Both tables carry a denormalised
-- user_id (mirrors mail_accounts.user_id) for RLS + fast per-user scoping, same
-- pattern as mail_messages (0021).

create table if not exists mail_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references mail_accounts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  subject text,
  body_html text not null,
  created_at timestamptz not null default now()
);

create index if not exists mail_templates_account_idx
  on mail_templates (account_id, created_at desc);

alter table mail_templates enable row level security;

do $$ begin
  create policy "own mail templates only" on mail_templates
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create table if not exists mail_scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references mail_accounts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  to_addresses text[] not null,
  cc_addresses text[],
  bcc_addresses text[],
  subject text,
  body_html text not null,
  attachment_refs jsonb,       -- pointers to Supabase Storage objects
  reply_to_uid bigint,
  send_at timestamptz not null,
  status text not null default 'pending', -- 'pending' | 'sent' | 'failed' | 'canceled'
  error text,
  created_at timestamptz not null default now()
);

-- Processor: find due pending rows across all accounts.
create index if not exists mail_scheduled_sends_due_idx
  on mail_scheduled_sends (send_at) where status = 'pending';
create index if not exists mail_scheduled_sends_account_idx
  on mail_scheduled_sends (account_id, send_at desc);

alter table mail_scheduled_sends enable row level security;

do $$ begin
  create policy "own scheduled sends only" on mail_scheduled_sends
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
