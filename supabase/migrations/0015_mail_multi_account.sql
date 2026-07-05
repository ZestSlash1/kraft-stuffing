-- Migration: Mail module — multiple mailboxes per user (up to 4, enforced in the API).
--
-- 0008 created mail_accounts with `unique(user_id)` (one mailbox per user). This
-- lifts that to several accounts per user and adds the metadata the switcher needs.
-- The AES-256-GCM `password_encrypted` column and its crypto path are UNCHANGED —
-- multi-account means more rows, never a different credential path.

-- 1. Drop the one-row-per-user constraint (auto-named <table>_<col>_key by Postgres).
alter table mail_accounts drop constraint if exists mail_accounts_user_id_key;

-- 2. New per-account metadata columns.
alter table mail_accounts add column if not exists display_name text;
alter table mail_accounts add column if not exists color        text;
alter table mail_accounts add column if not exists sort_order   int     not null default 0;
alter table mail_accounts add column if not exists is_default   boolean not null default false;
-- status: 'active' | 'error' (last sync failed auth) | 'disabled'
alter table mail_accounts add column if not exists status       text    not null default 'active';

-- 3. Backfill existing single-account rows. Each user currently has exactly one row
--    (the old unique constraint guaranteed it), so promoting them all to default and
--    active is safe and cannot violate the partial index created below.
update mail_accounts set display_name = email_address where display_name is null;
update mail_accounts set color = '#e8930a'            where color is null;      -- dock amber
update mail_accounts set is_default = true            where is_default = false;

-- 4. Uniqueness: one row per (user, mailbox address). Plain columns (no expression)
--    so connect.js can upsert onConflict (user_id, email_address) when re-connecting.
create unique index if not exists mail_accounts_user_email_key
  on mail_accounts (user_id, email_address);

-- 5. Exactly one default mailbox per user.
create unique index if not exists mail_accounts_one_default_key
  on mail_accounts (user_id) where is_default;

-- RLS is inherited from 0008 ("own mail account only", auth.uid() = user_id) and
-- still holds — it is row-scoped by user_id, which every new row also carries.
