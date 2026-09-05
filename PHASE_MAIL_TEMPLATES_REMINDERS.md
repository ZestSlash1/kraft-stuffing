# PHASE: Mail Canned Responses + Follow-up Reminders/Snooze

## Context
Kraft Portal (portal.shafrina.com) mail module already has: multi-account mail
(IMAP/SMTP via Hostinger), credentials AES-256-GCM encrypted and decrypted
server-side in Vercel functions, mail bodies synced into Supabase for instant
open, and a redesigned mail UI. This phase adds two features on top of that
foundation: (A) canned response templates, and (B) follow-up reminders/snooze
on threads.

Read CLAUDE.md and SPEC.md at repo root first — this file assumes and must
comply with all conventions established there (see "Conventions" below).

---

## A. Canned Responses / Templates

### Goal
Reusable reply/compose templates (Booking Confirmation, Arrival Notice Cover,
Payment Follow-up, Documentation Request, Customs Query, General) with
variable substitution pulled from booking/voyage context where available.

### Schema
```sql
create table mail_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'General',
    -- 'Booking Confirmation' | 'Arrival Notice' | 'Payment Follow-up'
    -- | 'Documentation Request' | 'Customs Query' | 'General'
  subject text,
  body text not null,
  is_void boolean not null default false, -- void-only deletion
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on mail_templates (category) where is_void = false;
```

RLS: same policy pattern as other org-scoped tables in SPEC.md — org members
can select/insert/update; void (soft-delete) via update, never delete.

### Variable substitution
Support `{{variable}}` tokens in subject and body. Resolve at insert-time
against whatever booking/voyage context the compose/reply modal already has
in scope (if the thread is linked to a booking — see reminders section for
similar linking pattern; if not linked, leave unresolved tokens as literal
text so the user can fill manually).

Minimum variable set:
- `{{customer_name}}`
- `{{booking_ref}}`
- `{{vessel_name}}`
- `{{voyage_no}}`
- `{{container_no}}`
- `{{eta}}`
- `{{sender_name}}` — defaults to logged-in user's display name

### UI
1. **Template picker in compose/reply modal** — dropdown or slide-over
   grouped by category, inserts into subject+body on select, cursor placed
   at first unresolved `{{variable}}` if any remain.
2. **Template management page** — `/mail/templates` — list (grouped by
   category), create/edit form (name, category, subject, body with live
   `{{variable}}` preview), void button (soft delete, confirm dialog).
3. Reuse existing theme tokens from `src/ui/theme.js` — no new colors/spacing
   values, no Tailwind, no CSS files, inline styles only per repo convention.

### Edge cases
- Voided templates must not appear in the picker but must remain
  queryable for audit/history.
- Empty body or subject-only templates are valid (e.g. quick one-liners).
- No two active templates need unique names — don't over-constrain this.

---

## B. Follow-up Reminders / Snooze

### Goal
Snooze a thread out of the inbox until a future time, or flag a thread with
a due-by reminder without hiding it. Surfaced via a dashboard widget and an
inbox badge — no push notification in this phase (WhatsApp provider still
pending; see "Deferred" below).

### Schema
```sql
create table mail_reminders (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references mail_threads(id),
  mode text not null default 'reminder', -- 'reminder' | 'snooze'
  remind_at timestamptz not null,
  note text,
  status text not null default 'pending', -- 'pending' | 'done' | 'dismissed'
  is_void boolean not null default false, -- void-only deletion
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index on mail_reminders (remind_at) where status = 'pending' and is_void = false;
create index on mail_reminders (thread_id) where is_void = false;
```

RLS: standard org-scoped select/insert/update; void-only deletion.

**Mode distinction:**
- `snooze` — thread is hidden from the default inbox view until `remind_at`
  passes, then resurfaces at the top with a "snoozed — back" badge.
- `reminder` — thread stays visible as normal; a due-date badge/chip is
  shown on the thread row, and it appears in the follow-ups widget once due.

### UI
1. **Snooze/remind control** on each thread row and inside the open thread
   — quick options (Tomorrow, 3 days, 1 week, Custom date/time — IST) plus
   an optional note field.
2. **Inbox badge** — count of threads with a pending reminder/snooze that
   is now due (`remind_at <= now()`), shown on the Mail nav item, consistent
   with how other nav badges already work in the portal.
3. **Follow-ups widget** — dashboard card listing due/overdue items across
   all mail accounts, each linking straight into the thread. Sort by
   `remind_at` ascending (most overdue first).
4. On open, a due reminder can be marked **Done** or **Dismissed** (soft
   status change, not deletion) or **Re-snoozed** (creates no new row —
   just updates `remind_at` and resets status to `pending`).

### Resolution logic
No cron/serverless job needed for v1 — reminders are resolved client-side
on load by querying `remind_at <= now()` (Supabase Realtime already covers
live updates elsewhere in the portal, so this stays consistent with that
pattern). A scheduled function only becomes necessary once outbound
notification (WhatsApp/email) is added — see Deferred.

### Edge cases
- A thread can have at most one **active** (`pending`, non-void) reminder
  at a time — creating a new one while one is pending should update the
  existing row rather than insert a second.
- Snoozing an already-snoozed thread just updates `remind_at`.
- Marking a thread as replied-to does **not** auto-clear its reminder —
  clearing is an explicit user action (avoids silently losing follow-ups
  on threads that get a one-line reply but still need chasing).

---

## Conventions (from CLAUDE.md/SPEC.md — do not deviate)
- Inline styles only, via `src/ui/theme.js` tokens. No Tailwind. No CSS
  files.
- Void-only deletion everywhere (`is_void` flag, never hard delete).
- RLS policies enforced on both new tables.
- All timestamps handled/displayed in IST.
- Match existing mail UI visual language — no new design system.

## Out of scope / deferred
- **WhatsApp push for due reminders** — schema supports it (just query
  `mail_reminders` where due), but sending is blocked on the Interakt
  provider decision already tracked elsewhere in the portal roadmap.
- **Recurring reminders** — not needed yet, keep v1 one-shot.
- **Team assignment / shared-inbox ownership** — deferred to a future
  role-based permissions phase; templates and reminders in this phase are
  org-wide/single-operator, not per-assignee.
- **Per-account template scoping** — start org-wide; revisit if multi-user
  mail handling becomes a real need.
