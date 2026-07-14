-- Migration: distinguish compose templates from signature templates.
--
-- mail_templates (0024) was built for the compose card's subject+body picker. The
-- Settings signature editor now reuses the same table for user-saved signature
-- snippets (alongside the built-in Kraft/Shafrina templates, which stay hardcoded in
-- client code — no DB row) — `kind` keeps the two pickers from showing each other's rows.

alter table mail_templates add column if not exists kind text not null default 'compose';

do $$ begin
  alter table mail_templates add constraint mail_templates_kind_check check (kind in ('compose', 'signature'));
exception when duplicate_object then null; end $$;

create index if not exists mail_templates_kind_idx on mail_templates (account_id, kind, created_at desc);
