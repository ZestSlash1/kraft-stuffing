-- Migration: Mail module — per-account IMAP/SMTP security mode.
--
-- host/port are ALREADY per-account columns (0008: imap_host/imap_port/smtp_host/
-- smtp_port, Hostinger defaults). What was still shared/hardcoded was the security
-- mode — every connection opened with `secure: true` in code. This adds the missing
-- security columns so host, port AND security are all read from the account row.
--
-- security: 'ssl' (implicit TLS) | 'starttls' (upgrade) | 'none' (plaintext).
-- The AES-256-GCM `password_encrypted` path is UNCHANGED — host/port/security are
-- plain (non-secret) columns, same class as email_address/display_name.

alter table mail_accounts add column if not exists imap_security text;
alter table mail_accounts add column if not exists smtp_security text;

-- Backfill: existing rows are all Hostinger implicit-TLS (993/465), which the code
-- opened as `secure: true` → 'ssl'. Existing accounts keep working with zero action.
update mail_accounts set imap_security = 'ssl' where imap_security is null;
update mail_accounts set smtp_security = 'ssl' where smtp_security is null;

-- No global fallback: every row must carry its own security mode.
alter table mail_accounts
  alter column imap_security set not null,
  alter column smtp_security set not null;
