# Portal Launcher \+ Mail Module — Build Prompt

Paste this whole file into Claude Code at the repo root of portal.shafrina.com. It auto-reads CLAUDE.md / SPEC.md for design tokens if present — match that aesthetic. If no tokens exist yet, use the fallback palette below.

## Part 1 — App Launcher Screen

Goal: a landing screen at `/` (replacing whatever currently loads first) that shows 4 large tappable tiles: Stuffing, Manifest, Expenses, Mail. Each tile routes to its existing app/section. Awwwards-tier execution, minimal token budget — so favor CSS-driven motion (transform/opacity transitions, subtle hover lift, no heavy JS animation libs unless GSAP is already a dependency) over anything novel.

Design direction:

- Full-bleed dark background, 4 tiles in a responsive grid (2x2 desktop, stacked mobile)  
- Each tile: icon (lucide-react), title, 1-line subtitle, faint bottom border that animates to a solid accent color on hover  
- Stagger-fade tiles in on mount (simple CSS animation-delay per tile, no JS orchestration needed)  
- Logged-in user's name \+ role badge (Admin/Staff) in top corner, sign-out in a small menu  
- If design tokens exist in CLAUDE.md/SPEC.md, use those exactly. Otherwise: background \#030508, surface \#0a1020, border \#102030, accent \#e8930a, text steel \#8a9aaa, headers in whatever display font is already loaded in the repo (check index.html / font imports first — do not add a new font family if one is already established)

Tiles:

1. Stuffing Log → existing stuffing route  
2. Manifest → existing manifest route  
3. Expenses → existing expense route  
4. Mail → new `/mail` route (built in Part 2\)

## Part 2 — Mail Module

### Schema (Supabase migration)

create table profiles (

  id uuid primary key references auth.users(id) on delete cascade,

  full\_name text not null,

  title text,

  role text not null default 'staff' check (role in ('admin','staff')),

  created\_at timestamptz default now()

);

create table mail\_accounts (

  id uuid primary key default gen\_random\_uuid(),

  user\_id uuid not null references profiles(id) on delete cascade,

  email\_address text not null,

  imap\_host text not null default 'imap.hostinger.com',

  imap\_port int not null default 993,

  smtp\_host text not null default 'smtp.hostinger.com',

  smtp\_port int not null default 465,

  password\_encrypted text not null,  \-- AES-256-GCM ciphertext, iv+tag packed in

  signature\_html text default '',

  created\_at timestamptz default now(),

  unique(user\_id)

);

alter table profiles enable row level security;

alter table mail\_accounts enable row level security;

\-- profiles: users see their own row; admins see all

create policy "own profile" on profiles for select using (auth.uid() \= id);

create policy "admin views all profiles" on profiles for select using (

  exists (select 1 from profiles p where p.id \= auth.uid() and p.role \= 'admin')

);

create policy "admin updates roles" on profiles for update using (

  exists (select 1 from profiles p where p.id \= auth.uid() and p.role \= 'admin')

);

\-- mail\_accounts: strictly own-row only, even for admins (credentials stay private)

create policy "own mail account only" on mail\_accounts for all using (auth.uid() \= user\_id);

### Encryption helper (`/lib/mailCrypto.js`)

Use Node's built-in `crypto`, AES-256-GCM, key from `process.env.MAIL_ENCRYPTION_KEY` (64-char hex \= 32 bytes). Pack iv \+ authTag \+ ciphertext into one stored string (e.g. `iv:authTag:ciphertext`, all hex). Export `encrypt(plaintext)` and `decrypt(packed)`. This file is only ever imported by serverless functions, never by frontend code — double check no Vite bundle pulls it client-side.

### API routes (Vercel serverless, `/api/mail/*`)

- `POST /api/mail/connect` — body: {email, password}. Encrypts password, upserts into mail\_accounts for the authenticated user (verify Supabase JWT server-side). Optionally test-connect via imapflow before saving, return clear error if auth fails against Hostinger.  
- `GET /api/mail/list?folder=INBOX` — looks up caller's mail\_accounts row, decrypts password, opens imapflow connection, fetches message headers (subject, from, date, flags, uid), closes connection, returns JSON.  
- `GET /api/mail/thread?uid=X&folder=Y` — fetches full message body (parse with mailparser) for one message, marks as read.  
- `POST /api/mail/send` — body: {to, subject, html, replyToUid?}. Decrypts password, sends via nodemailer using caller's SMTP creds, auto-appends their signature\_html if not already present in the body.  
- `GET/PUT /api/mail/settings` — get/update own signature\_html.  
- `GET /api/team` (admin only) — list all profiles \+ whether each has a connected mail\_account (boolean only, never expose credentials).  
- `PUT /api/team/:id` (admin only) — update full\_name/title/role for a given profile.

All routes: verify the Supabase session server-side first (reject if no valid JWT), then scope every DB query to that user's own row unless the route is explicitly admin-gated (check role from profiles table).

### Frontend routes

- `/mail/inbox` — folder sidebar (Inbox/Sent at minimum), message list, reading pane. Empty state if no mail\_account connected yet → prompts connect flow.  
- `/mail/connect` — simple form: email address (prefill from Hostinger defaults: imap.hostinger.com:993, smtp.hostinger.com:465, both SSL/TLS — these are fixed, only email \+ password are user input), submit to `/api/mail/connect`.  
- `/mail/compose` — to/subject/body, body pre-loads with `<br><br>` \+ signature\_html appended at bottom (cursor placed above it). Reply mode pre-fills quoted original \+ same signature append.  
- `/mail/settings` — edit signature (simple contenteditable toolbar: bold/italic/link is enough, no heavy WYSIWYG dependency needed).  
- `/mail/team` — admin only. Table of all staff: name, title (editable), role (editable dropdown admin/staff), mail connected (yes/no badge). Add new staff \= creates a Supabase Auth invite (use supabase.auth.admin inviteUserByEmail from a server route, not client-side).

### Libraries to add

`imapflow` (IMAP), `mailparser` (parse fetched messages), `nodemailer` (SMTP send) — all server-side only, in package.json normally (Vercel functions bundle them fine, no special config needed beyond standard serverless function setup already used elsewhere in this repo).

### Notes

- Do not store IMAP/SMTP passwords anywhere except password\_encrypted.  
- Do not log decrypted passwords, even in server console.log, ever.  
- Admin role in `mail_accounts` RLS is intentionally NOT given visibility into other users' credentials or mail — admin manages roles/titles only, not other people's inboxes.  
- Match existing repo conventions for Supabase client init, env var naming, and Vercel function structure — check existing /api functions in this repo before introducing a different pattern.

