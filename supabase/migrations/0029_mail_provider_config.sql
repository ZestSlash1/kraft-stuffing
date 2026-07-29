-- Migration: Mail module — generalized provider configuration.
--
-- Adds the pieces needed to support POP3 incoming mail (alongside the existing
-- IMAP path) and Outlook/M365 accounts (which require OAuth2, not a stored
-- password — Microsoft retired basic auth for IMAP/POP3/SMTP on Outlook.com and
-- Microsoft 365 mailboxes). host/port/security columns from 0008/0016 are reused
-- as-is for BOTH protocols — imap_host/imap_port/imap_security mean "incoming
-- server" regardless of incoming_protocol; no column rename to limit blast radius
-- across list.js/thread.js/actions.js/mailFolders.js/mailSync.js.

-- incoming_protocol: which client fetches mail. 'pop3' has no server-side folder
-- state — Move/Archive/Junk/filter-rules/folder-mapping/background sync are
-- IMAP-only features and stay disabled for pop3 accounts (enforced in API + UI).
alter table mail_accounts add column if not exists incoming_protocol text not null default 'imap'
  check (incoming_protocol in ('imap', 'pop3'));

-- auth_type: 'password' (existing AES-256-GCM password_encrypted path, unchanged)
-- or 'oauth2' (Outlook/M365 — refresh/access tokens, same AES-256-GCM helper).
alter table mail_accounts add column if not exists auth_type text not null default 'password'
  check (auth_type in ('password', 'oauth2'));

-- Convenience label for the UI (which preset produced this row) — not enforced
-- server-side, connection behavior is fully driven by auth_type/incoming_protocol
-- and the host/port/security columns.
alter table mail_accounts add column if not exists provider_preset text;

-- OAuth2 token storage — same AES-256-GCM packed format (iv:authTag:ciphertext
-- hex) as password_encrypted, via the existing api/_lib/mailCrypto.js helper.
alter table mail_accounts add column if not exists oauth_refresh_token_encrypted text;
alter table mail_accounts add column if not exists oauth_access_token_encrypted text;
alter table mail_accounts add column if not exists oauth_access_token_expires_at timestamptz;

-- Backfill: every existing row is a password-auth IMAP account under the old
-- Hostinger-only flow (or a since-added custom/Gmail IMAP account) — defaults
-- above already cover this, nothing to backfill.

-- password_encrypted was `not null` (0008) — oauth2 rows carry no password.
alter table mail_accounts alter column password_encrypted drop not null;

-- Every row must carry credentials appropriate to its auth_type: a password row
-- needs password_encrypted; an oauth2 row needs at least a refresh token (the
-- access token is short-lived and refreshed on demand, so it alone is not
-- sufficient — the refresh token is what makes the row durable).
alter table mail_accounts add constraint mail_accounts_credentials_ck check (
  (auth_type = 'password' and password_encrypted is not null)
  or (auth_type = 'oauth2' and oauth_refresh_token_encrypted is not null)
);

-- RLS is inherited from 0008 ("own mail account only", auth.uid() = user_id) —
-- still holds, row-scoped by user_id which every row carries regardless of
-- protocol/auth_type.
