-- Migration: follow-up reminders / snooze on mail messages (PHASE_MAIL_TEMPLATES_REMINDERS.md §B).
--
-- The phase doc's schema references mail_threads(id), but this codebase has no thread
-- concept — mail is read message-by-message (mail_messages, 0021), keyed by
-- (account_id, folder, uid) with a uuid `id` primary key. That uuid is the closest
-- equivalent to "thread" here, so message_id references mail_messages(id) directly.
--
-- RLS is owner-only (auth.uid() = created_by), NOT the org-wide "auth_all" pattern the
-- phase doc suggests for other tables in this set: mail is a private per-user IMAP
-- mailbox (mail_messages itself is "own rows only"), so a reminder on a message must
-- follow the same visibility — another user can't read the underlying message, so they
-- shouldn't be able to read a reminder's note/due-date either.

create table if not exists mail_reminders (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references mail_messages(id) on delete cascade,
  mode text not null default 'reminder', -- 'reminder' | 'snooze'
  remind_at timestamptz not null,
  note text,
  status text not null default 'pending', -- 'pending' | 'done' | 'dismissed'
  is_void boolean not null default false, -- void-only deletion
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mail_reminders_due_idx
  on mail_reminders (created_by, remind_at) where status = 'pending' and is_void = false;
create index if not exists mail_reminders_message_idx
  on mail_reminders (message_id) where is_void = false;

alter table mail_reminders enable row level security;

do $$ begin
  create policy "own mail reminders only" on mail_reminders
    for all using (auth.uid() = created_by) with check (auth.uid() = created_by);
exception when duplicate_object then null; end $$;
