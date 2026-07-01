-- Phase 5C: global_search() — one unioned, type-discriminated result set for the
-- ⌘K command palette. ilike is sufficient at corridor data volumes; full-text /
-- ranking is deliberately out of scope for v1.
--
-- Column notes (adapted to the real schema — the spec sketch assumed some names
-- that don't exist here):
--   * bookings has NO text ref column (it references shipper_id/consignee_id),
--     so bookings are surfaced via their shipper/consignee names instead.
--   * containers.number is the container no; seal_no / seal_no_2 are the seals.
--   * voyages.vessel / voyage_no / booking_ref / bl_no are the searchable fields.
--
-- SECURITY INVOKER (default) so row-level security still applies per caller.

create or replace function global_search(q text)
returns table (type text, id uuid, label text, sublabel text, route text)
language sql stable as $$
  select 'container', c.id, coalesce(nullif(c.number, ''), c.seal_no),
         v.vessel, 'container-log'
  from containers c
  join voyages v on v.id = c.voyage_id
  where c.number ilike '%'||q||'%' or c.seal_no ilike '%'||q||'%'
     or c.seal_no_2 ilike '%'||q||'%'
  union all
  select 'voyage', v.id, coalesce(nullif(v.vessel, ''), v.voyage_no),
         v.voyage_no, 'voyage-detail'
  from voyages v
  where v.vessel ilike '%'||q||'%' or v.voyage_no ilike '%'||q||'%'
     or v.booking_ref ilike '%'||q||'%' or v.bl_no ilike '%'||q||'%'
  union all
  select 'shipper', s.id, s.name, coalesce(s.address, ''), 'masters'
  from shippers s
  where s.name ilike '%'||q||'%'
  union all
  select 'consignee', cn.id, cn.name, coalesce(cn.address, ''), 'masters'
  from consignees cn
  where cn.name ilike '%'||q||'%'
  union all
  select 'expense', e.id, coalesce(nullif(e.description, ''), e.category),
         e.category, 'expenses'
  from expenses e
  where e.description ilike '%'||q||'%' or e.category ilike '%'||q||'%'
     or e.reference_no ilike '%'||q||'%'
  limit 40;
$$;

grant execute on function global_search(text) to authenticated, anon;
