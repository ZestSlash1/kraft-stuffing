-- Migration: Star/flag support for mail messages.
--
-- Mirrors the seen/seen_synced pattern from 0021: starring a message flips
-- `flagged` locally (instant, DB-only) and the sync worker pushes \Flagged (or
-- removes it) to IMAP on its next pass, then marks it synced. Same lag profile
-- the app already accepts for read/unread.

alter table mail_messages add column if not exists flagged boolean not null default false;
alter table mail_messages add column if not exists flagged_synced boolean not null default true;

-- Sync worker: find locally-flagged (or unflagged) rows whose state hasn't been
-- pushed to IMAP yet.
create index if not exists mail_messages_flagged_push_idx
  on mail_messages (account_id, folder) where not flagged_synced;
