-- Migration: Mail sync-to-database layer.
--
-- Phase 2 of the mail instant-load work. Previously every inbox/thread read opened a
-- live IMAP connection (auth handshake + fetch) — slow by nature. This table is the
-- synced mirror the read path now serves from: a background sync worker (/api/mail/sync,
-- run on a cron + on-demand) pulls headers (and lazily bodies) from IMAP into these
-- rows, and /api/mail/list + /api/mail/thread read ONLY from here. IMAP is reserved for
-- the sync worker and for sending.
--
-- Bodies (html/body_text) are filled lazily: the sync worker fills recent missing
-- bodies each run (bounded), and thread.js back-fills on first open if still null. So
-- steady-state message opens are DB-only.

create table if not exists mail_messages (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references mail_accounts(id) on delete cascade,
  -- Denormalised owner for RLS + fast per-user scoping (mirrors mail_accounts.user_id).
  user_id uuid not null references profiles(id) on delete cascade,
  folder text not null,                 -- 'INBOX' | 'Sent'
  uid bigint not null,                  -- IMAP UID, unique within (account, folder)
  message_id text,                      -- RFC5322 Message-ID (dedupe/threading aid)
  subject text,
  from_name text,
  from_address text,
  to_recipients jsonb not null default '[]'::jsonb,  -- [{name,address}]
  cc_recipients jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,     -- [{filename,contentType,size}] meta only
  seen boolean not null default false,
  -- False after a local read until the sync worker pushes the \Seen flag back to IMAP.
  seen_synced boolean not null default true,
  received_at timestamptz,              -- envelope date / internalDate (list sort key)
  html text,                            -- null until body fetched
  body_text text default '',
  synced_at timestamptz not null default now(),
  unique (account_id, folder, uid)
);

-- List query: newest N per account+folder.
create index if not exists mail_messages_list_idx
  on mail_messages (account_id, folder, received_at desc);
-- Sync worker: find recent rows still missing a body to back-fill.
create index if not exists mail_messages_body_fill_idx
  on mail_messages (account_id, folder) where html is null;
-- Sync worker: find locally-read rows whose \Seen flag hasn't been pushed to IMAP.
create index if not exists mail_messages_seen_push_idx
  on mail_messages (account_id, folder) where seen and not seen_synced;

alter table mail_messages enable row level security;

-- Own-rows only, even for admins — mirrors the mail_accounts privacy policy. The API
-- uses the service role (bypasses RLS) and scopes every query by user_id explicitly;
-- this policy is defence-in-depth for any anon-key access path.
do $$ begin
  create policy "own mail messages only" on mail_messages
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
