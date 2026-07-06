# MAIL_PER_ACCOUNT_SETTINGS.md

**Purpose:** Currently every connected mail account runs through one shared, presumably hardcoded
Hostinger IMAP/SMTP config. Make **host, port, security mode, and auth** fully per-account, so
each of the (up to 4) accounts connects to its own provider's servers with its own settings.

For a **Claude Fable 5** Claude Code session. Builds directly on `MAIL_MULTI_ACCOUNT.md` — read
that file's invariants too if the session doesn't already have that context.

---

## 0. SESSION SETUP

1. `/model` → `claude-fable-5`.
2. Read pass (no edits): `api/_lib/mailAccount.js`, `api/_lib/mailCrypto.js`, `api/mail/connect.js`,
   `api/mail/list.js`, `api/mail/send.js`, `api/mail/thread.js`, `api/mail/settings.js`,
   `supabase/migrations/0008_mail_module.sql`, `src/views/mail/ConnectView.jsx`,
   `src/views/mail/MailSettingsView.jsx`, and any `.env`/`vercel.json` entries referencing IMAP/
   SMTP host, port, or Hostinger — this is where the shared config is almost certainly living.
3. **First deliverable is a findings note:** exactly where today's IMAP/SMTP host/port/security
   values come from (hardcoded constant, env var, or already a column that's just unused/ignored
   by the handlers). The plan below assumes it's a shared constant/env var; adapt if not.
4. One file per turn, commit each, single `npm run build` + one manual two-provider smoke test
   at the end.

---

## 1. HARD INVARIANTS

- **Credentials handling is unchanged** per `MAIL_MULTI_ACCOUNT.md` Section 1: same
  `mailCrypto.js`, same server-side-only decryption, same ownership checks before any connection
  is opened. This change adds host/port/security as **per-account fields**, it does not touch how
  the password itself is stored or decrypted.
- **Host and port are not secrets** — store them as plain columns (not encrypted), same as email
  address/display name. Only username+password (or OAuth token, if ever added later) go through
  `mailCrypto.js`.
- **No global fallback that silently reactivates old behavior.** Once this ships, there is no
  shared "the IMAP host" — every code path reads host/port/security from the account row it's
  currently operating on. If that row somehow lacks values, fail loudly for that account (surface
  a per-account error, per the multi-account isolation invariant) rather than falling back to the
  old Hostinger constant.
- **Existing connected accounts keep working with zero action from the user** — the migration
  backfills today's real Hostinger host/port/security values onto every existing row, so nothing
  breaks on deploy.
- Nothing changes outside `api/mail/*`, `api/_lib/mailAccount.js`, the migration, `mailApi.js`,
  and `src/views/mail/ConnectView.jsx` / `MailSettingsView.jsx`.

---

## 2. DATA MODEL

Add to `mail_accounts` (adjust names to match real schema from the read pass):

```sql
alter table mail_accounts
  add column imap_host text,
  add column imap_port int,
  add column imap_security text,   -- 'ssl' | 'starttls' | 'none'
  add column smtp_host text,
  add column smtp_port int,
  add column smtp_security text;   -- 'ssl' | 'starttls' | 'none'

-- Backfill: set every existing row to today's real Hostinger values (find the actual
-- host/port/security in use from the Section 0 read pass — do not guess placeholder values).
update mail_accounts set
  imap_host = '<real current host>', imap_port = <real current port>, imap_security = '<real current mode>',
  smtp_host = '<real current host>', smtp_port = <real current port>, smtp_security = '<real current mode>'
where imap_host is null;

alter table mail_accounts
  alter column imap_host set not null,
  alter column imap_port set not null,
  alter column imap_security set not null,
  alter column smtp_host set not null,
  alter column smtp_port set not null,
  alter column smtp_security set not null;
```

---

## 3. API CHANGES

- **`api/_lib/mailAccount.js`:** the account-resolution helper now returns host/port/security
  alongside decrypted credentials, all read from that account's row — remove any reference to a
  shared constant/env var for these values entirely (don't leave it as an unused fallback).
- **`api/mail/connect.js`:**
  - Accepts host/port/security for both IMAP and SMTP from the client, plus a **provider preset**
    shortcut (see 4.1) that fills sensible defaults client-side before submit.
  - Before saving, **test-connect**: open the IMAP connection and attempt SMTP auth (or its
    equivalent lightweight check — mirror whatever library the existing connect flow already
    uses) with the submitted host/port/security/credentials. On failure, return a specific error
    (`imap_failed` | `smtp_failed` | `auth_failed`) — do not save a broken account silently.
  - Still enforces the ≤4 account limit from `MAIL_MULTI_ACCOUNT.md`.
- **`api/mail/list.js` / `thread.js` / `send.js`:** already resolve per-account via `accountId`
  (from the multi-account work) — just confirm they pull host/port/security from that same
  resolved account object rather than importing a shared config anywhere. This is the actual bug
  being fixed; audit each handler file for a leftover top-level import of a Hostinger constant.
- **`api/mail/settings.js`:** add update-settings support for an existing account's host/port/
  security (same test-connect-before-save behavior as `connect.js`), so a user can fix a
  misconfigured account without disconnecting and re-adding it.

---

## 4. UI

### 4.1 `ConnectView.jsx`
- Add a small **provider preset** selector above the connection fields: "Hostinger" (prefills
  today's real values), "Gmail", "Custom". Choosing a preset fills host/port/security fields,
  which remain editable — presets are a convenience, not a lock.
- Expose IMAP host/port/security and SMTP host/port/security as explicit fields (grouped in two
  small glass sub-panels: "Incoming (IMAP)" / "Outgoing (SMTP)"), using `label()`/`input()`
  tokens from `src/ui/theme.js`.
- On submit, show the test-connect result inline (success glow via `GLOW.optimized`, or the
  specific failure reason from `connect.js`) before treating the account as added.

### 4.2 `MailSettingsView.jsx`
- Each account row gets an "Advanced settings" expand: same IMAP/SMTP field groups as above,
  pre-filled with that account's current values, editable, save re-runs test-connect via the new
  `settings.js` path.
- Account status chip reflects `auth_failed` / `imap_failed` / `smtp_failed` distinctly (not just
  a generic "error"), so the user knows which side to fix.

### 4.3 `src/lib/mailApi.js`
- Thread host/port/security fields through `connectAccount()` and add
  `updateAccountSettings(accountId, patch)`.

---

## 5. EXECUTION ORDER

1. Read pass + findings note (0.2–0.3) — locate the real current Hostinger values before writing
   the migration.
2. Migration (Section 2) with real backfill values.
3. `api/_lib/mailAccount.js` — return per-account host/port/security; remove shared-config import.
4. `api/mail/connect.js` (preset defaults handled client-side, per-account fields, test-connect).
5. Audit + fix `list.js`, `thread.js`, `send.js` for any remaining shared-config reference.
6. `api/mail/settings.js` update-settings + test-connect.
7. `mailApi.js`.
8. `ConnectView.jsx` (preset + IMAP/SMTP field groups + inline test result).
9. `MailSettingsView.jsx` (advanced settings expand + specific status chips).
10. `npm run build`. Manual smoke: (a) confirm existing Hostinger accounts still fetch/send with
    zero user action, (b) add one non-Hostinger account with different host/port and confirm it
    connects on its own settings, (c) intentionally submit a wrong password and confirm
    `connect.js` rejects with a specific error rather than saving a broken account.

---

## 6. ACCEPTANCE CHECKLIST

- [ ] `mail_accounts` has per-row IMAP/SMTP host/port/security; existing rows backfilled with
      real current values, no user action needed post-deploy.
- [ ] No code path reads a shared/global IMAP or SMTP config anymore — confirmed by grep for the
      old constant/env var name across `api/mail/*` and `api/_lib/mailAccount.js`.
- [ ] Two accounts with genuinely different host/port/security both send and fetch correctly,
      independently.
- [ ] `connect.js` and `settings.js` test-connect before saving; specific failure reasons surface,
      never a silently-saved broken account.
- [ ] Credentials still only ever handled via `mailCrypto.js`, server-side; host/port stored plain.
- [ ] Per-account failure isolation from `MAIL_MULTI_ACCOUNT.md` still holds.
- [ ] `npm run build` passes; three-part smoke test in Section 5.10 done.
