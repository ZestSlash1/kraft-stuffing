# MAIL_MULTI_ACCOUNT.md

**Purpose:** Extend Kraft Portal's mail module from one connected mailbox to **up to 4 accounts**
(e.g. shafrina.com + kraftshipping.com addresses), with an account switcher, an optional
"All inboxes" combined view, and compose that sends from an explicitly chosen account.

For a **Claude Fable 5** Claude Code session. This is a careful extension of a
**credential-handling** module — the crypto and transport layers are not to be redesigned.

---

## 0. SESSION SETUP

1. `/model` → `claude-fable-5`.
2. Read pass (no edits): `supabase/migrations/0008_mail_module.sql`, `api/_lib/mailAccount.js`,
   `api/_lib/mailCrypto.js`, `api/_lib/auth.js`, all of `api/mail/*.js`, `src/lib/mailApi.js`,
   all of `src/views/mail/*.jsx`.
3. **First deliverable is a findings note, not code:** state whether `mail_accounts` already
   allows multiple rows per user/org (unique constraints? how do the API handlers pick the
   account — first row? single-row assumption?). Everything below adapts to what's actually
   there; the plan assumes the common case (schema already multi-row-capable, code assumes one).
4. One file per turn, commit each, single `npm run build` + one manual smoke pass at end.

---

## 1. HARD INVARIANTS — this module handles credentials

- **`mailCrypto.js` is untouched.** Same AES-256-GCM encrypt/decrypt, same key handling, same
  server-side-only decryption in Vercel functions. Multi-account means more *rows*, never a
  different crypto path.
- **Credentials never reach the client** — no plaintext passwords in any API response, log, or
  client state, exactly as today. The connect flow posts credentials once; after that the client
  only ever holds account metadata (id, email address, display name, status).
- **Server-side ownership checks on every request:** every `api/mail/*` handler that now accepts
  an `accountId` must verify that account belongs to the authenticated user/org (via the existing
  `auth.js` pattern) **before** touching credentials. An `accountId` from the client is a claim,
  not a fact.
- **Per-account failure isolation:** one account's bad password / IMAP timeout must not break the
  other accounts' fetch. Errors surface per-account, never as a global mail failure.
- **Account limit: 4.** Enforced server-side in `connect` (count active accounts before insert),
  not just hidden in the UI.
- **Removing an account** deletes/voids its credential row (follow whatever the module does today
  for disconnect — if nothing exists, credentials are hard-deleted on disconnect since retaining
  dead encrypted credentials has no value; the *account metadata* row may be soft-deleted for
  audit consistency).
- No changes to anything outside `api/mail/*`, `api/_lib/mailAccount.js`, migration(s),
  `src/lib/mailApi.js`, and `src/views/mail/*`. Mail-adjacent UI (nav badge) only if it already
  exists.

---

## 2. DATA MODEL

Adapt to findings from 0.3. Expected shape:

- If `mail_accounts` has a one-account-per-user unique constraint → migration to drop it and add
  `(user_id/org_id, email)` uniqueness instead, plus `display_name text`, `color text` (account
  accent chip), `sort_order int`, `is_default boolean` (exactly one default per user — partial
  unique index `where is_default`), and `status text` ('active' | 'error' | 'disabled') if not
  present.
- If it's already multi-row-capable → only add the missing columns above.
- No new tables expected.

---

## 3. API CHANGES (`api/mail/*`)

- **`list.js` / `thread.js` / `send.js` / `settings.js`:** accept `accountId`; resolve the
  account via `mailAccount.js` scoped to the authenticated user (ownership check per invariant);
  behavior otherwise identical per account.
- **`list.js` additionally** supports `accountId=all`: fetch the same page window from each
  active account **concurrently with a per-account timeout** (e.g. 10s), merge by date desc, and
  return items tagged with their `accountId` + per-account error map
  (`{ items: [...], errors: { <accountId>: 'auth_failed' } }`). A slow/broken account returns an
  error entry; the rest still return mail. Keep pagination simple in v1: fetch page N from every
  account and merge — do not build cursor-perfect cross-account pagination.
- **`connect.js`:** unchanged flow, plus the ≤4 active accounts server-side check, plus setting
  `is_default` if it's the user's first account.
- **New minimal endpoints only if the current router pattern needs them:** list-accounts
  (metadata only) and disconnect-account. If `settings.js` already covers these shapes, extend it
  instead of adding files.
- `src/lib/mailApi.js`: thread `accountId` through every call; add `listAccounts()` /
  `disconnectAccount(id)`.

---

## 4. UI (`src/views/mail/*`) — Loadex tokens throughout

### 4.1 Account switcher — in `MailShell.jsx`
- Top of the mail folder rail: current-account selector (glass dropdown). Entries:
  **All inboxes**, then each account (color dot + display name + address in `F.mono`), then
  "Add account…" (→ ConnectView) when under the 4-account limit.
- Selected account persists (localStorage) across visits. Default on first load: All inboxes.
- Account in `status='error'`: warning-tinted dot + small "fix" affordance → MailSettingsView.

### 4.2 Inbox — `InboxView.jsx`
- Single-account mode: unchanged behavior, scoped to the selected account.
- **All-inboxes mode:** merged list; each row shows a 2px left accent bar + tiny chip in the
  account's `color` so the source account is always visible. Per-account fetch errors render as a
  slim inline warning strip ("kraftshipping.com couldn't sync — check settings"), not a blank
  screen.
- Opening a thread from the merged list passes that thread's own `accountId` — thread view is
  always single-account under the hood.

### 4.3 Compose — `ComposeView.jsx`
- New **From** selector at the top of compose: choose sending account (defaults: the account the
  user is viewing; in All-inboxes, the `is_default` account; **replies always default to the
  account that received the thread**).
- The From choice is passed explicitly to `send.js` as `accountId` — never inferred server-side
  from "the account."

### 4.4 Connect & settings — `ConnectView.jsx` / `MailSettingsView.jsx`
- ConnectView: unchanged form, now reachable repeatedly via "Add account…"; add `display_name` +
  color picker (small fixed palette — 6 swatches, not a color wheel).
- MailSettingsView: list of connected accounts (address, status, default toggle, disconnect with
  `ConfirmDialog`), each row's credentials editable via the existing per-account settings flow.
- At 4 accounts, "Add account…" hides and settings shows the limit note.

---

## 5. EXECUTION ORDER

1. Read pass + findings note (0.2–0.3).
2. Migration (Section 2, adapted to findings).
3. `api/_lib/mailAccount.js` — account resolution by id + ownership.
4. `api/mail/list.js` (incl. all-inboxes merge), then `thread.js`, `send.js`, `settings.js`,
   `connect.js` (limit + default).
5. `src/lib/mailApi.js`.
6. `MailShell` switcher → `InboxView` (merged mode + error strips) → `ComposeView` (From) →
   `ConnectView`/`MailSettingsView`.
7. `npm run build`. Manual smoke: connect a 2nd account, verify (a) merged inbox tags rows
   correctly, (b) reply from a kraftshipping thread sends from the kraftshipping account,
   (c) breaking one account's password degrades only that account.

---

## 6. ACCEPTANCE CHECKLIST

- [ ] Up to 4 accounts; limit enforced server-side.
- [ ] Every `api/mail/*` request resolves the account by id **with ownership verification**.
- [ ] Crypto path byte-for-byte unchanged (`mailCrypto.js` untouched in the diff).
- [ ] No plaintext credential ever appears client-side, in logs, or in responses.
- [ ] All-inboxes merges by date, tags rows by account, isolates per-account failures.
- [ ] Replies default to the receiving account; From is always explicit in `send.js` calls.
- [ ] Existing single-account users see zero behavior change until they add a second account.
- [ ] Disconnect removes credentials; UI + server agree on account status.
- [ ] `npm run build` passes; smoke pass in Section 5.7 done.
