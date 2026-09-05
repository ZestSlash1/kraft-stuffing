-- Phase 9: Container cargo items — multi-commodity per container.
-- Replaces the single constrained cargo_type field on stuffing_lines (which
-- was a 5-option dropdown) with a free-text, repeatable cargo-item list per
-- container. Stuffing lines retain their `cargo` column for per-truck labelling
-- but the manifest/carting-order source-of-truth is now container_cargo_items.

create table container_cargo_items (
  id           uuid primary key default gen_random_uuid(),
  container_id uuid not null references containers(id) on delete cascade,
  sort_order   int not null default 0,
  description  text not null,
  qty          numeric,          -- null = backfilled placeholder, user must confirm
  unit         text not null default 'PKG',
  backfilled   boolean not null default false,  -- true = migrated from old line data, needs review
  created_at   timestamptz not null default now()
);

create index container_cargo_items_container_idx
  on container_cargo_items (container_id, sort_order);

alter table container_cargo_items enable row level security;

create policy "auth_all" on container_cargo_items
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Backfill: one row per unique cargo name per container, qty summed from
-- stuffing_lines, unit from the first matching line. Rows are flagged
-- backfilled=true so the UI shows a "please confirm" badge.
insert into container_cargo_items (container_id, sort_order, description, qty, unit, backfilled)
select
  sl.container_id,
  row_number() over (partition by sl.container_id order by min(sl.sort_order)) - 1 as sort_order,
  sl.cargo as description,
  sum(sl.qty) as qty,
  (array_agg(sl.unit order by sl.sort_order))[1] as unit,
  true as backfilled
from stuffing_lines sl
where sl.cargo is not null and sl.cargo <> ''
group by sl.container_id, sl.cargo
on conflict do nothing;

-- ── Carting Order amendment (Section 4) ──────────────────────────────────────
-- Drop cargo_type and package_lines from carting_order_containers; cargo is
-- now read live from container_cargo_items at generation / frozen into snapshot
-- at issue time.
alter table carting_order_containers
  drop column if exists cargo_type,
  drop column if exists package_lines;
