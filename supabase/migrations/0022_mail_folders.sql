-- Migration: Mail folder structure + message-action columns.
--
-- Phase "Mail Actions" prerequisite. Delete / Move-to / Mark-as-Junk all resolve a
-- real IMAP mailbox path per account (folder names vary by provider: "Trash",
-- "Deleted Items", "INBOX.Trash", "Junk", "Spam", …). We mirror the account's mailbox
-- list into mail_folders so the client can render a "Move to…" picker and so the
-- server can resolve the account's trash/junk targets without a live LIST every time.
--
-- Populated by the folder-sync step (IMAP LIST, with SPECIAL-USE where advertised) on
-- account connect and on the periodic sync pass. When a server exposes no special-use
-- flags we fall back to name matching (trash|deleted, junk|spam); the user can override
-- the resolved trash/junk mapping per account in Mail Settings (see the override
-- columns on mail_accounts below).

create table if not exists mail_folders (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references mail_accounts(id) on delete cascade,
  -- Denormalised owner for RLS + fast per-user scoping (mirrors mail_accounts.user_id).
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,           -- display name, e.g. "Archive"
  path text not null,           -- IMAP mailbox path, e.g. "INBOX.Archive"
  delimiter text not null default '.',  -- IMAP hierarchy delimiter, e.g. "." or "/"
  special_use text,             -- 'inbox' | 'sent' | 'trash' | 'junk' | 'drafts' | 'archive' | null
  created_at timestamptz not null default now(),
  unique (account_id, path)
);

create index if not exists mail_folders_account_idx on mail_folders (account_id);

alter table mail_folders enable row level security;

do $$ begin
  create policy "own mail folders only" on mail_folders
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Per-account manual override for the trash/junk targets. Null → use the special-use
-- (or name-matched) folder resolved into mail_folders. Set by the user in Mail
-- Settings when auto-detection is wrong or the server exposes no special-use flags.
alter table mail_accounts add column if not exists trash_folder_path text;
alter table mail_accounts add column if not exists junk_folder_path  text;

-- mail_messages: track the current IMAP folder path + a fast "in Trash" flag. The
-- read mirror still keys reads by the coarse `folder` ('INBOX' | 'Sent'); folder_path
-- records the precise IMAP path a message currently lives in after a move.
alter table mail_messages add column if not exists folder_path text;
alter table mail_messages add column if not exists is_deleted  boolean not null default false;
