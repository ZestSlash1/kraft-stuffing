# Kraft Portal — Feature & Architecture Overview

> Living inventory of what the portal is and does, for future modification /
> addition brainstorming. Live at **portal.shafrina.com**.
> (`stuff.shafrina.com` is a separate, older standalone app — not this portal.)

## Stack & infrastructure
- **Frontend:** Vite + React 18/19, inline styles only (no Tailwind). Light design
  system in `src/theme.js`; reusable primitives in `src/components/ui/`
  (Card, Input, Pill, StatusBadge, SpecLabel). GSAP available; lucide-react icons;
  recharts; XLSX (SheetJS) + jsPDF for exports.
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage), project ref
  `xdacidevdepagyrnebhh`, region ap-northeast-2. Vercel serverless functions in `/api`.
- **Routing:** `useState`-based router via `RouterContext` (no react-router, no hash).
  Section pages swapped in `AppShell`. Mail has its own internal sub-router.
- **Offline-first:** writes hit localStorage + a sync queue (`runWrite` / `flushQueue`
  in `src/lib/db.js`), replayed on reconnect.
- **Deploy:** Vercel; git push to `main` auto-deploys (occasionally lags → force with
  `vercel --prod`). SPA rewrite in `vercel.json` excludes `/api`.

## Auth & users
- **Email + password** login (`signInWithPassword`) with forgot-password reset flow
  and a dedicated set-password screen for reset/invite links (`PASSWORD_RECOVERY`).
- Login screen: frosted card, drifting amber/green aurora, animated
  Kolkata → Port Blair vessel motif.
- **Profiles** table: `display_name`, `title`, `role` (`admin` | `staff`).
  Profile is upserted on sign-in *and* on app load (`ensureProfile`) — important
  because every write FKs to `profiles(id)` (`expenses.logged_by`,
  `audit_log.changed_by`); a missing profile silently rejects all inserts.
- **Hardcoded super-admin:** `shahzeb@shafrina.com` is always promoted to admin
  (client `ADMIN_EMAILS` in `db.js` + server `requireAdmin` in `api/_lib/auth.js`),
  default title "Director."
- Roles: **admin** (manages team) vs **staff**. Single-tenant: `KRAFT_ORG_ID` hardcoded.

## Portal shell & navigation
- **App launcher** (`AppSelectorView`): 4 tiles — Stuffing, Manifest, Expenses, Mail —
  stagger animation, user name + role badge, sign-out.
- **Top nav** (desktop): icon+label items, amber active pill, Portal (back-to-launcher)
  button, a **LIVE presence pill** (online teammate count), and **live notification
  dots** (`LiveContext`): realtime stuffing activity flags Dashboard/Voyages until
  visited; Mail shows an unread-count badge.
- **Bottom nav** (mobile) mirrors the top nav. Desktop shows top nav only.

## Sections / features
1. **Stuffing Log** — Dashboard (vessel hero SVG, container slots, KPI stats),
   Voyages list + detail, per-container log (add cargo lines by unit, seal with VGM
   weight-limit alerts), realtime multi-user sync + presence avatars, PDF packing
   list + XLSX export. On seal → Supabase Edge Function (`notify-seal`) for WhatsApp.
2. **Manifest** — bookings, vessel movements, manifest document view; masters
   (shippers / consignees with search).
3. **Expenses** — ledger + summary tabs, income/expense entries (stored as integer
   paise), categories, this/last-month filters, charts, XLSX export. Audit-logged.
4. **Mail** (Hostinger IMAP/SMTP) — connect mailbox (password AES-256-GCM encrypted,
   server-only), Inbox + Sent (live IMAP fetch, auto-refresh 30s + unread polling),
   reading pane, Compose/Reply with signature append, Settings (signature editor).
   Routes: `/api/mail/{connect,list,thread,send,settings}`.
5. **Settings** — profile (name/title), Account Security (change password),
   **Team Management** (admin-only: invite via Supabase Auth, edit name/title/role,
   mail-connected flag; `/api/team`), org settings + container defaults
   (tare / CML / default POL / POD).

## Data model (key tables)
`orgs → voyages → containers → stuffing_lines`; `bookings`, `vessel_movements`;
`shippers`, `consignees`; `expenses`; `profiles`, `mail_accounts`; `audit_log`
(generic trigger `log_audit_event` on most tables). Realtime on containers,
stuffing_lines, expenses, presence. RLS: `auth_all` on most tables;
`mail_accounts` is strictly own-row (credentials never exposed, even to admins).
Conventions: money as integer paise, timestamps UTC ISO displayed in IST, uuid ids.

## Cross-cutting
Offline write queue, per-voyage realtime channels, presence tracking, audit trail,
PWA (manifest + service worker), error boundary, toast system.

## Required external config (not in repo)
- Vercel env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MAIL_ENCRYPTION_KEY`
  (64-char hex — never rotate once mailboxes are connected).
- Supabase Auth → URL config: Site URL + redirect = `https://portal.shafrina.com`
  (needed for reset/invite links).

## Gaps / brainstorming seeds
- **Nav dots** exist only for stuffing + mail — extend `LiveContext` to Manifest/Expenses.
- **Mail isn't stored** (live IMAP only): no offline access, search, attachments,
  folders beyond Inbox/Sent, or instant push. A cached `messages` table + background
  worker (IMAP IDLE) would enable all of these.
- **Email HTML is rendered unsanitized** (XSS risk) — add DOMPurify or iframe sandbox.
- **Audit log is written but barely surfaced** — an activity feed / "what changed"
  view is low-hanging.
- **Single-tenant** (`KRAFT_ORG_ID` hardcoded) — multi-org/workspace would need rework.
- **Coarse roles** (admin/staff) — no per-section / per-action permissions.
- Push/WhatsApp is seal-only — could broaden to expenses approvals, mail alerts, etc.
