# PHASE: Mail Compose Redesign — Floating Card UI + New Functionality

## Reference

Design reference is a "New email" compose surface: floating rounded card, chip-based
recipients with avatars, large bold subject line, rich text body with a floating
selection toolbar (bold/italic/underline/strikethrough/align/link), inline @mention
highlighting, inline text highlighting, redesigned attachment cards with file-type
badges, and a bottom action bar (attach / schedule / templates / contacts / Ask AI /
Send).

**Design translation note:** the reference is a light glassmorphic card. Kraft
Portal's shipped aesthetic is the dark ops-room theme, so this spec carries over the
*layout and interaction model* faithfully but maps every color to existing
`theme.js` tokens — elevated dark surface for the card, dimmed/blurred backdrop
behind it, accent color for mentions/active states instead of the reference's
purple/yellow. Do not hardcode any new hex values; extend `theme.js` if a needed
token doesn't exist yet, don't inline arbitrary colors into components.

---

## 1. Modal container & header

- Floating card, ~24px radius, centered over a dimmed + blurred backdrop (click
  outside or Esc to close, with a "discard draft?" confirm if body/subject is non-empty).
- Header row: "New email" (or "Reply" / "Forward" depending on context) on the left;
  pop-out icon (undocks into a separate resizable window state — can reuse the same
  compose component, just toggle a `docked: boolean` prop) and close (X) on the right.
- Card should sit above everything else in the mail module but not block navigation
  entirely — support minimized/collapsed state (click header to collapse to a small
  bar, like Gmail) if that's feasible within current scope; otherwise a single
  open/closed state is fine for v1.

## 2. Recipients (To / Cc / Bc)

- Multi-chip input for **To**. Each chip: avatar + email address, removable via a
  small × that appears on hover, or backspace when the input is empty and focused
  at the end of the chip list.
- Avatar: since we don't have profile photos for arbitrary recipients, generate a
  deterministic colored initial-avatar from the email address (hash → pick from a
  small fixed palette in `theme.js`). If the recipient matches a known contact/customer
  in the portal with a stored avatar, use that instead.
- Autocomplete against existing contacts/customers as the user types (reuse whatever
  contact source is already wired into mail settings, if any; otherwise pull from
  `customers`/similar table if one exists in the schema).
- **Cc** / **Bc** shown as small text links to the right of the To row by default,
  expanding into their own chip rows when clicked — matches reference behavior.

## 3. Subject

- Large, bold, single-line input, no visible border/background — reads as a heading,
  not a form field. Placeholder: "Subject".

## 4. Rich text body + floating selection toolbar

- Body is a rich text editor. If a rich text lib is already in use elsewhere in the
  portal (mail body composition, notes, etc.), reuse it. If none exists yet, Tiptap
  is a reasonable default (small, headless, works well with a custom floating toolbar).
- On text selection, show a floating toolbar directly above the selection (dark pill,
  matches the reference's positioning) with: **Bold, Italic, Underline, Strikethrough,
  Align left, Align center, Align right, Link**. Active formatting states shown with
  a filled/dark background on that icon (see reference: Bold is active/filled when
  the selection is bold).
- Link icon opens a small inline input for the URL rather than a browser `prompt()`.

## 5. Mentions

- Typing `@` opens an autocomplete dropdown of team members (portal users under the
  Shafrina org). Selecting one inserts an inline mention rendered in the accent color,
  bold, non-editable-as-text (deletes as a single unit).
- Scope for v1: purely visual/organizational (helps the sender remember who's being
  addressed inline). Notifying the mentioned person is out of scope unless you want
  it — flag if so, since it would need a notification hook into the existing activity
  feed.

## 6. Highlight tool

- Add a highlight option to the floating selection toolbar (or as a small color swatch
  next to Bold/Italic/etc.) that applies a background-color span to the selected text,
  using a token-defined highlight color (soft, not the reference's literal yellow —
  pick something that reads well on the dark card surface, e.g. a low-opacity accent
  fill).

## 7. Attachments redesign

- Replace current attachment display with cards: file-type icon badge (color-coded —
  PDF red, image type, spreadsheet green, generic gray/default; small fixed map of
  extension → icon + color in `theme.js` or a local constants file), file name (bold),
  file size (muted), and a three-dot overflow menu per card (Remove, Rename, Preview —
  Preview should open the existing in-app PDF viewer for PDFs).
- "N attachments" label above the card row, matching reference.

## 8. Bottom action bar

Dark pill toolbar — this part of the reference already matches the portal's existing
dark aesthetic, so it's mostly a direct port.

- **Attach** (paperclip): opens file picker, adds to attachment cards.
- **Schedule send** (clock): opens a small time picker; on confirm, the send action
  queues instead of sending immediately (see schema below). *Assumption: this icon
  is for scheduled send, not draft history — flag if you meant something else.*
- **Templates** (document icon): opens a template picker (see schema below); selecting
  one populates subject + body. Hover shows a "Use template" tooltip, per reference.
- **Contacts** (person icon): opens the address book to insert a recipient into To/Cc/Bc.
- **Ask AI**: opens a small assist drawer above the compose card with quick actions
  (Improve writing, Fix grammar, Make shorter, Make longer, Change tone) plus a
  free-form instruction input. Applies the result back into the body editor, with an
  Undo available (keep the pre-AI version in memory for one step back).
- **Send**: primary CTA, disabled until To has at least one valid recipient.

---

## 9. Schema additions

```sql
create table mail_templates (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references mail_accounts(id) on delete cascade,
  name text not null,
  subject text,
  body_html text not null,
  created_at timestamptz not null default now()
);

create table mail_scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references mail_accounts(id) on delete cascade,
  to_addresses text[] not null,
  cc_addresses text[],
  bcc_addresses text[],
  subject text,
  body_html text not null,
  attachment_refs jsonb,       -- pointers to Supabase Storage objects
  send_at timestamptz not null,
  status text not null default 'pending', -- 'pending' | 'sent' | 'failed' | 'canceled'
  created_at timestamptz not null default now()
);
```

- `mail_scheduled_sends` needs a trigger mechanism — Vercel Cron hitting an endpoint
  every minute (or Supabase `pg_cron` if already set up for anything else) that finds
  `status = 'pending' and send_at <= now()`, sends via the account's SMTP connection,
  and flips status to `sent`/`failed`.

## 10. New / updated endpoints

- `/api/mail/templates` — CRUD for `mail_templates`.
- `/api/mail/schedule-send` — writes to `mail_scheduled_sends` instead of sending
  immediately.
- `/api/mail/ai-assist` — `{ body_html, instruction }` → calls an LLM via server-side
  API key (env var, never exposed client-side) → returns revised `body_html`. Keep
  the prompt simple and pass the instruction through mostly verbatim; no need to
  over-engineer prompt scaffolding for v1.

## 11. Assumptions to confirm before build

1. Clock icon = scheduled send (not draft history) — see §8.
2. Mentions are visual-only for v1, no notification side effect — see §5.
3. Compose card stays in the dark theme; light glassmorphic look from the reference
   is not being adopted wholesale.
4. "Ask AI" needs an LLM API key added as a Vercel env var if one isn't already
   configured for the project.

## 12. Suggested build order

1. Modal container + header + backdrop (dark theme version).
2. Recipient chips (To) + Cc/Bc expand — functionality first, autocomplete after.
3. Subject + body rich text editor with floating selection toolbar.
4. Attachment card redesign.
5. Bottom action bar shell (icons wired to no-ops except Attach + Send, which should
   already work).
6. Templates (table + CRUD + picker UI).
7. Scheduled send (table + cron endpoint + time picker UI).
8. Mentions.
9. Highlight tool.
10. Ask AI assist drawer + endpoint.
