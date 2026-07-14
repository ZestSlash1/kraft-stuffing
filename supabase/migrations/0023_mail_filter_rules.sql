-- Migration: Mail filter rules (auto-junk).
--
-- Marking a sender as junk creates a standing rule so future mail from that sender is
-- moved to Junk automatically during sync (before it ever lands in the Inbox mirror or
-- fires a notification). Keyed on the sender's email (sender_email) by default; a
-- sender_domain rule is also supported for broader matches.
--
-- target_folder_path snapshots the resolved junk path at rule-creation time so the sync
-- worker can move without re-resolving. created_from_message_id is audit only.

create table if not exists mail_filter_rules (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references mail_accounts(id) on delete cascade,
  -- Denormalised owner for RLS + fast per-user scoping (mirrors mail_accounts.user_id).
  user_id uuid not null references profiles(id) on delete cascade,
  match_type text not null check (match_type in ('sender_email', 'sender_domain')),
  match_value text not null,          -- e.g. 'billing@spammer.com' or 'spammer.com' (lowercased)
  action text not null default 'move_to_junk',
  target_folder_path text,            -- resolved junk path at rule-creation time
  created_from_message_id uuid,       -- audit: which message triggered this rule
  created_at timestamptz not null default now(),
  unique (account_id, match_type, match_value)
);

create index if not exists mail_filter_rules_account_idx on mail_filter_rules (account_id);

alter table mail_filter_rules enable row level security;

do $$ begin
  create policy "own mail filter rules only" on mail_filter_rules
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
