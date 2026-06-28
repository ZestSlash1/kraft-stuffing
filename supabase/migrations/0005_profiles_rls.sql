-- Migration: profiles RLS policy (was missing from the base schema in SPEC.md)
-- Without a policy, RLS-enabled `profiles` rejects every insert, so ensureProfile()
-- silently fails on login. That leaves created_by FKs (voyages, bookings,
-- vessel_movements, stuffing_lines) unsatisfiable and forces the app into its
-- local-seed fallback — which is why "create booking" fails with a FK violation.
--
-- Grant authenticated users full access, matching every other table's policy.

alter table profiles enable row level security;

do $$ begin
  create policy "auth_all" on profiles
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
