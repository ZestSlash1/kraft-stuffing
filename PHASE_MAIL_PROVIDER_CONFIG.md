# PHASE: Mail Provider Configuration (Multi-Protocol Account Setup)

## Objective
Generalize the Portal's mail account setup so any provider can be added — not just
Hostinger — with per-account configurable protocols: **IMAP or POP3 for incoming**,
**SMTP for outgoing**. Add first-class support for adding Outlook / Office 365
mailboxes.

## Current State (assumption — verify against actual schema before building)
Mail accounts are currently modeled around Hostinger's fixed IMAP/SMTP endpoints,
with AES-256-GCM encrypted credentials stored per account. There is no protocol
selector and no per-account host/port/encryption override.

## ⚠️ Critical constraint: Outlook requires OAuth2, not password auth
Microsoft retired basic authentication (raw username + password) for IMAP, POP3,
and SMTP on Outlook.com and Microsoft 365 mailboxes. A stored-password flow will
fail silently or with an auth error for any Outlook account added this way. This
phase must treat Outlook as an **OAuth2 auth_type**, distinct from the
password-based flow used for Hostinger/Gmail-app-password/custom IMAP servers.
This means: app registration in Microsoft Entra (Azure AD), OAuth consent flow,
refresh token storage (encrypted, same as password), and token refresh handling
in the sync/fetch job. This is a materially bigger lift than "add a dropdown" —
flag this to yourself before scoping the phase into a single session.

If you want to defer OAuth2 to a follow-up phase, this spec can ship the generic
multi-protocol account model now (covers Hostinger, Gmail w/ app password, any
custom IMAP/POP3/SMTP server) and stub the Outlook option as "coming soon."

---

## 1. Data model changes

Add to `mail_accounts` (or equivalent table):

```sql
alter table mail_accounts
  add column auth_type text not null default 'password'
    check (auth_type in ('password', 'oauth2')),
  add column incoming_protocol text not null default 'imap'
    check (incoming_protocol in ('imap', 'pop3')),
  add column incoming_host text,
  add column incoming_port integer,
  add column incoming_encryption text default 'ssl'
    check (incoming_encryption in ('ssl', 'starttls', 'none')),
  add column outgoing_host text,
  add column outgoing_port integer,
  add column outgoing_encryption text default 'starttls'
    check (outgoing_encryption in ('ssl', 'starttls', 'none')),
  add column provider_preset text,          -- 'hostinger' | 'outlook' | 'gmail' | 'custom'
  add column oauth_refresh_token_encrypted text,
  add column oauth_access_token_encrypted text,
  add column oauth_token_expires_at timestamptz;
```

Keep existing RLS policies applying — extend them to the new columns, no new
tables needed. Void-only soft delete stays as-is for account removal.

## 2. Provider presets (UI convenience, not enforced server-side)

| Preset | Incoming | Port | Enc | Outgoing | Port | Enc | Auth |
|---|---|---|---|---|---|---|---|
| Hostinger | imap.hostinger.com | 993 | ssl | smtp.hostinger.com | 465 | ssl | password |
| Outlook / M365 | outlook.office365.com | 993 | ssl | smtp.office365.com | 587 | starttls | oauth2 |
| Gmail | imap.gmail.com | 993 | ssl | smtp.gmail.com | 587 | starttls | password (app password) |
| Custom | — | — | — | — | — | — | password |

Selecting a preset auto-fills the form fields; user can still edit any field
manually (this satisfies "customizable according to the email").

## 3. UI changes — Account Settings

Location: wherever mail accounts are currently added/edited in the Portal
settings area. Follow `src/ui/theme.js` tokens, inline styles only, light +
dark mode support per the existing ThemeProvider work.

- Provider dropdown: Hostinger / Outlook / Gmail / Custom
- On preset select: prefill host/port/encryption fields (still editable)
- Protocol toggle for incoming: IMAP / POP3 (radio or segmented control)
- If POP3 selected: show an inline warning that folder sync, move-to-folder,
  and junk filter rules (all IMAP-dependent features already shipped) will be
  unavailable for this account — see §4
- If Outlook preset selected: swap credential field for "Connect with
  Microsoft" OAuth button instead of password input
- "Test Connection" button: attempts a live handshake on incoming + outgoing
  before saving, surfaces the actual server error rather than a generic failure

## 4. POP3 feature degradation (important — don't build silently broken UI)

POP3 has no concept of server-side folders, no persistent read/unread flags
tied to a mailbox structure, and typically downloads-and-removes (or
download-and-leave, depending on setting) rather than syncing state. Several
already-shipped Portal features are IMAP-only by nature:

- Move to folder / delete to Trash / mark as junk with persistent filter rules
- Mail sync-to-Supabase for instant open (works differently — POP3 sync means
  "pull once, store locally," no live server folder state)
- Multi-device read-state consistency

Decide explicitly, per account, whether POP3 accounts:
(a) get a reduced feature set with those actions hidden/disabled in the UI, or
(b) are only allowed for a "leave mail on server" archival/read-only use case.

Recommend (a): disable folder actions and junk-filter UI for POP3 accounts,
label the account list row with a small "POP3" badge so it's visually obvious
which accounts have the reduced feature set.

## 5. Backend changes

- Connection logic branches on `incoming_protocol`: existing IMAP client stays
  as-is; add a POP3 client (e.g. `node-poplib` or equivalent) for the new path
- SMTP sending logic already exists — extend to read per-account
  outgoing_host/port/encryption instead of the hardcoded Hostinger values
- OAuth2 path (Outlook): requires a Microsoft Entra app registration
  (client ID/secret stored server-side, not per-user), an OAuth consent
  redirect flow, encrypted refresh token storage, and a token-refresh step
  before each IMAP/SMTP connection attempt (access tokens expire ~1hr)
- Credential encryption: reuse existing AES-256-GCM helper for both password
  and OAuth refresh/access tokens

## 6. Migration plan for existing Hostinger accounts

Existing rows get backfilled with `provider_preset = 'hostinger'`,
`auth_type = 'password'`, `incoming_protocol = 'imap'`, and the known
Hostinger host/port/encryption values — no behavior change for current users
of the mail feature.

## 7. Testing checklist

- [ ] Add Hostinger account via preset — unchanged behavior, existing mail loads
- [ ] Add custom IMAP/SMTP account with manual host/port entry
- [ ] Add POP3 account — confirm folder/junk-filter UI is hidden, badge shows
- [ ] Test Connection button surfaces real server errors (wrong port, wrong
      encryption, auth failure) rather than a generic message
- [ ] (If OAuth2 scoped in) Outlook account connects via Microsoft consent
      flow, token refreshes correctly after expiry, mail fetch succeeds
- [ ] Light mode + mobile layout for the new form fields matches existing
      Mail section styling
- [ ] RLS still enforced — one user cannot read another's account credentials
      or tokens
