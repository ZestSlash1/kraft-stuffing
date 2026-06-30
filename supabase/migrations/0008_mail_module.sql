-- Migration: Mail module — per-user IMAP/SMTP accounts + profile titles.
--
-- `profiles` already exists (id, org_id, display_name, role) from the base schema.
-- We only add `title` here; display_name stays the canonical name field (the build
-- prompt's `full_name` maps onto the existing display_name — we do NOT rename it).
--
-- mail_accounts holds one Hostinger mailbox per user. The IMAP/SMTP password is
-- stored ONLY as AES-256-GCM ciphertext in password_encrypted (iv:authTag:cipher,
-- all hex). It is never exposed to the client — only serverless functions decrypt it.

alter table profiles add column if not exists title text;

create table if not exists mail_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  email_address text not null,
  imap_host text not null default 'imap.hostinger.com',
  imap_port int not null default 993,
  smtp_host text not null default 'smtp.hostinger.com',
  smtp_port int not null default 465,
  password_encrypted text not null, -- AES-256-GCM, iv:authTag:ciphertext (hex)
  signature_html text default '',
  created_at timestamptz default now(),
  unique(user_id)
);

alter table mail_accounts enable row level security;

-- mail_accounts: strictly own-row only, even for admins — credentials stay private.
do $$ begin
  create policy "own mail account only" on mail_accounts
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Admins manage roles/titles only (never other users' mail). The base "auth_all"
-- policy on profiles already lets the app read/update profile rows; admin gating
-- for role/title edits is enforced in the /api/team route against the role column.
