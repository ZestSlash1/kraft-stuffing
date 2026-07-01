-- Phase 7: Documentary Suite — House B/L, Arrival Notice, Delivery Order.
-- Issued documents are immutable legal instruments: `payload` freezes a full
-- snapshot at issue time so later edits to voyages/containers/bookings never
-- retroactively change a document already handed to a customer. Never
-- hard-delete a row here — void + reissue instead.

create table documents (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references orgs(id),
  type          text not null check (type in ('hbl', 'arrival_notice', 'delivery_order')),
  number        text unique,                      -- assigned on issue, null while draft
  voyage_id     uuid references voyages(id),
  container_id  uuid references containers(id),
  booking_id    uuid references bookings(id),
  payload       jsonb,                            -- frozen snapshot at issue time
  status        text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  issued_at     timestamptz,
  issued_by     uuid references profiles(id),
  pdf_path      text,                             -- Supabase Storage path
  created_at    timestamptz not null default now()
);

alter table documents enable row level security;
create policy "auth_all" on documents
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

create trigger audit_documents after insert or update or delete on documents
  for each row execute function log_audit_event();

-- ── Document numbering (race-safe, per type per org per year) ───────────────
create table doc_counters (
  org_id   uuid not null,
  type     text not null,
  year     int not null,
  last_seq int not null default 0,
  primary key (org_id, type, year)
);

create or replace function next_doc_number(p_type text)
returns text language plpgsql as $$
declare
  y      int := extract(year from now());
  seq    int;
  prefix text;
  org    uuid := '00000000-0000-0000-0000-000000000001'; -- KRAFT_ORG_ID, single-tenant
begin
  insert into doc_counters (org_id, type, year, last_seq)
    values (org, p_type, y, 0)
    on conflict (org_id, type, year) do nothing;

  update doc_counters set last_seq = last_seq + 1
    where org_id = org and type = p_type and year = y
    returning last_seq into seq;

  prefix := case p_type
    when 'hbl' then 'HBL'
    when 'arrival_notice' then 'AN'
    when 'delivery_order' then 'DO'
  end;

  return format('KRAFT/%s/%s/%s', prefix, y, lpad(seq::text, 4, '0'));
end;
$$;

-- ── Storage: private `documents` bucket, served via signed URLs only ────────
insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

create policy "auth_all_documents_bucket_select" on storage.objects
  for select using (bucket_id = 'documents' and auth.role() = 'authenticated');
create policy "auth_all_documents_bucket_insert" on storage.objects
  for insert with check (bucket_id = 'documents' and auth.role() = 'authenticated');
create policy "auth_all_documents_bucket_update" on storage.objects
  for update using (bucket_id = 'documents' and auth.role() = 'authenticated');
