-- Phase 9: Attachments — the one new data surface for the docs-viewer work.
-- A single additive table + a private Storage bucket lets any voyage, booking,
-- carting order, or document carry uploaded/scanned files (PDF or image).
-- Existing tables are never modified. Like the rest of the app, issued/lodged
-- records are never hard-deleted: attachments soft-delete via `voided_at`, and
-- the binary in Storage stays put. Storage policies mirror the private
-- `documents` bucket (0011) — same org-scoped, authenticated-only shape.

create table attachments (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references orgs(id),
  parent_type  text not null check (parent_type in ('voyage', 'booking', 'carting_order', 'document')),
  parent_id    uuid not null,
  file_name    text not null,
  mime_type    text not null,                       -- application/pdf | image/jpeg | ...
  size_bytes   bigint not null,
  storage_path text not null,                       -- key in the `attachments` bucket
  source       text not null default 'upload' check (source in ('upload', 'scan')),
  voided_at    timestamptz,                          -- soft delete only
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now()
);

create index attachments_parent_idx
  on attachments (parent_type, parent_id, created_at desc);

alter table attachments enable row level security;

create policy "auth_all" on attachments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Audit trail, mirroring documents / carting_orders.
create trigger audit_attachments after insert or update or delete on attachments
  for each row execute function log_audit_event();

-- ── Storage: private `attachments` bucket, served via signed URLs only ──────
insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

create policy "auth_all_attachments_bucket_select" on storage.objects
  for select using (bucket_id = 'attachments' and auth.role() = 'authenticated');
create policy "auth_all_attachments_bucket_insert" on storage.objects
  for insert with check (bucket_id = 'attachments' and auth.role() = 'authenticated');
create policy "auth_all_attachments_bucket_update" on storage.objects
  for update using (bucket_id = 'attachments' and auth.role() = 'authenticated');
