-- Phase 8: Export Carting Order module.
-- A carting order authorises a port's DDMO to allow house-stuffed export
-- containers alongside a vessel. Like the documentary suite (0011), an issued
-- order freezes a full `snapshot` jsonb at issue time so later edits never
-- retroactively change an order already lodged with the port. Never hard-delete
-- an issued order — void + reissue instead.
--
-- Vessel / voyage no / POL / POD / booking-ref are pulled live from the voyage
-- and are NOT duplicated here. Rotation no and VCN have no home on `voyages`
-- yet, so they live as order-level header fields on carting_orders (still
-- frozen into `snapshot` on issue).

create table carting_orders (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references orgs(id),
  voyage_id     uuid not null references voyages(id),
  booking_id    uuid references bookings(id),        -- optional: relates to a booking
  order_date    date not null default current_date,
  pol           text not null default 'Kolkata',     -- prefilled from voyage, editable override
  pod           text not null default 'Port Blair',
  rotation_no   text,                                 -- EXP. Rotation No (order-level, not on voyage)
  rotation_date date,
  vcn           text,                                 -- Vessel Call Number (order-level)
  booking_no    text,                                 -- defaults from voyage.booking_ref, editable
  till_text     text not null default 'Till Finish',
  status        text not null default 'draft' check (status in ('draft', 'issued', 'void')),
  snapshot      jsonb,                                -- frozen full render payload once issued
  issued_at     timestamptz,
  issued_by     uuid references profiles(id),
  voided_at     timestamptz,
  pdf_path      text,                                 -- Supabase Storage path (issued PDF)
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);

create table carting_order_containers (
  id               uuid primary key default gen_random_uuid(),
  carting_order_id uuid not null references carting_orders(id) on delete restrict,
  sl_no            int not null,                      -- display order, 1-indexed
  container_no     text not null,
  size_type        text not null default '20',        -- '20' | '40' | '40HC' ...
  cargo_gr_wt_kgs  numeric not null default 0,
  tare_wt_kgs      numeric not null default 0,
  vgm_wt_kgs       numeric not null default 0,        -- INDEPENDENT manual entry — never derived
  cargo_type       text not null default '',          -- groups header aggregation
  value_paise      bigint not null default 0,         -- integer paise
  package_lines    jsonb not null default '[]',       -- [{ "qty": 471, "unit": "PC" }, ...]
  created_at       timestamptz not null default now()
);

create index carting_order_containers_order_idx
  on carting_order_containers (carting_order_id, sl_no);
create index carting_orders_voyage_idx on carting_orders (voyage_id, created_at desc);

alter table carting_orders           enable row level security;
alter table carting_order_containers enable row level security;

create policy "auth_all" on carting_orders
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');
create policy "auth_all" on carting_order_containers
  for all using (auth.role()='authenticated') with check (auth.role()='authenticated');

-- Audit trail, mirroring documents.
create trigger audit_carting_orders after insert or update or delete on carting_orders
  for each row execute function log_audit_event();
create trigger audit_carting_order_containers
  after insert or update or delete on carting_order_containers
  for each row execute function log_audit_event();

-- ── Carting-order numbering (race-safe, reuses the doc_counters table) ─────────
-- Type key 'carting_order'; prefix CO. Number assigned on issue.
create or replace function next_carting_order_number()
returns text language plpgsql as $$
declare
  y   int := extract(year from now());
  seq int;
  org uuid := '00000000-0000-0000-0000-000000000001'; -- KRAFT_ORG_ID, single-tenant
begin
  insert into doc_counters (org_id, type, year, last_seq)
    values (org, 'carting_order', y, 0)
    on conflict (org_id, type, year) do nothing;

  update doc_counters set last_seq = last_seq + 1
    where org_id = org and type = 'carting_order' and year = y
    returning last_seq into seq;

  return format('KRAFT/CO/%s/%s', y, lpad(seq::text, 4, '0'));
end;
$$;

-- Realtime for the list view (multi-user parity with the rest of the app).
alter publication supabase_realtime add table carting_orders;
