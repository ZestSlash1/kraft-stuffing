-- Phase: IGM / BL Manifest Entry module (PHASE_IGM_MANIFEST_MODULE.md).
--
-- Import General Manifest data entry: a vessel voyage carries many Bills of
-- Lading; each BL carries parties, marks, cargo lines and container lines. The
-- schema is modelled on those relationships (voyage → BL → children), NOT on
-- any legacy vendor form layout — every column here is derived from the
-- functional field list in the phase doc.
--
-- Conventions followed from the rest of the portal:
--   • uuid pk default gen_random_uuid()
--   • created_at / updated_at as timestamptz (rendered in IST client-side —
--     see src/lib/format.js; the DB stays absolute so multi-device writes order
--     correctly)
--   • void-only deletion: void_at / void_reason instead of DELETE. Reads filter
--     `void_at is null`; nothing in this module ever hard-deletes.
--   • RLS: single "auth_all" policy scoped to authenticated portal users
--   • audit trail via the shared log_audit_event() trigger (0004)
--
-- No ICEGATE submission here — the export is a client-side JSON file
-- (src/lib/igmExport.js).

-- ── Vessel master ────────────────────────────────────────────────────────────
create table manifest_vessels (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid references orgs(id),
  name         text not null,
  code         text,                              -- carrier/line vessel code
  imo_no       text,
  call_sign    text,
  vessel_type  text,
  grt          numeric,                           -- gross registered tonnage
  nrt          numeric,                           -- net registered tonnage
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  void_at      timestamptz,
  void_reason  text
);

create unique index manifest_vessels_name_idx
  on manifest_vessels (org_id, lower(name)) where void_at is null;

-- ── Voyage ───────────────────────────────────────────────────────────────────
-- `stuffing_voyage_id` optionally ties an IGM voyage to the operational voyage
-- already tracked in the stuffing log, so vessel/voyage-no can be prefilled and
-- the two records stay reconcilable without duplicating either side.
create table manifest_voyages (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid references orgs(id),
  vessel_id          uuid references manifest_vessels(id),
  stuffing_voyage_id uuid references voyages(id),
  voyage_no          text not null default '',
  voyage_ref         text,
  igm_no             text,
  igm_date           date,
  terminal_operator  text,
  cargo_summary      text,                        -- summary description of cargo carried
  purpose_of_call    text,
  transport_mode     text not null default 'SEA',
  arrival_port       text,
  last_port          text,                        -- last port of call
  next_port          text,                        -- next port of call
  crew_count         int,
  pax_count          int,
  cntrs_landed       int,
  cntrs_loaded       int,
  eta                timestamptz,
  ata                timestamptz,
  etd                timestamptz,
  sailing_date       date,
  status             text not null default 'draft'
                     check (status in ('draft', 'filed', 'closed')),
  created_by         uuid references profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  void_at            timestamptz,
  void_reason        text
);

create index manifest_voyages_org_idx on manifest_voyages (org_id, created_at desc);
create index manifest_voyages_vessel_idx on manifest_voyages (vessel_id);

-- ── Bill of Lading ───────────────────────────────────────────────────────────
create table manifest_bls (
  id                     uuid primary key default gen_random_uuid(),
  voyage_id              uuid not null references manifest_voyages(id),
  line_no                int,                     -- line number allotted for the BL
  bl_number              text not null default '',
  bl_date                date,
  mbl_number             text,                    -- master BL
  mbl_date               date,
  freight_payable_at     text,
  feeder_vessel          text,
  feeder_voyage          text,
  mother_vessel          text,
  port_of_receipt        text,
  port_of_loading        text,
  discharge_port         text,
  delivery_place         text,
  gross_wt               numeric,
  net_wt                 numeric,
  weight_unit            text not null default 'KGS',
  packages               numeric,
  package_unit           text not null default 'PKG',
  consolidated_indicator boolean not null default false,
  cargo_type             text,                    -- e.g. FCL / LCL / BREAK BULK
  nature_of_cargo        text,                    -- e.g. GENERAL / HAZARDOUS / REEFER
  haz_cargo              boolean not null default false,
  uno_code               text,                    -- UN number, when hazardous
  imo_class              text,                    -- IMO/IMDG class, when hazardous
  created_by             uuid references profiles(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  void_at                timestamptz,
  void_reason            text
);

create index manifest_bls_voyage_idx on manifest_bls (voyage_id, created_at desc);
create index manifest_bls_number_idx on manifest_bls (lower(bl_number));

-- ── Parties per BL ───────────────────────────────────────────────────────────
-- Six fixed roles; one row per role per BL (the UI renders a card per role).
create type manifest_party_type as enum
  ('consignee', 'forwarder', 'notifier1', 'notifier2', 'shipper', 'dl_agent');

create table manifest_bl_parties (
  id          uuid primary key default gen_random_uuid(),
  bl_id       uuid not null references manifest_bls(id),
  party_type  manifest_party_type not null,
  name        text,
  address_1   text,
  address_2   text,
  city        text,
  pin         text,
  state       text,
  country     text default 'IN',
  email       text,
  pan         text,                               -- PAN / code number
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  void_at     timestamptz,
  void_reason text
);

create unique index manifest_bl_parties_role_idx
  on manifest_bl_parties (bl_id, party_type) where void_at is null;

-- ── Marks & description per BL ───────────────────────────────────────────────
create table manifest_bl_marks (
  id               uuid primary key default gen_random_uuid(),
  bl_id            uuid not null references manifest_bls(id),
  marks_text       text,
  description_text text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  void_at          timestamptz,
  void_reason      text
);

create unique index manifest_bl_marks_bl_idx
  on manifest_bl_marks (bl_id) where void_at is null;

-- ── Cargo lines per BL ───────────────────────────────────────────────────────
create table manifest_bl_cargo_lines (
  id          uuid primary key default gen_random_uuid(),
  bl_id       uuid not null references manifest_bls(id),
  seq         int not null default 0,
  hsn_code    text,
  uno_code    text,
  imdg_class  text,
  pkgs        numeric,
  pkgs_unit   text not null default 'PKG',
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  void_at     timestamptz,
  void_reason text
);

create index manifest_bl_cargo_lines_bl_idx on manifest_bl_cargo_lines (bl_id, seq);

-- ── Container lines per BL ───────────────────────────────────────────────────
create table manifest_bl_containers (
  id            uuid primary key default gen_random_uuid(),
  bl_id         uuid not null references manifest_bls(id),
  seq           int not null default 0,
  container_no  text,
  size          text not null default '20',
  type          text,                             -- GP / RF / OT / FR / TK ...
  seal_type     text,                             -- SHIPPER / CUSTOMS / LINE
  seal_no       text,
  vgm           numeric,                          -- verified gross mass, manual entry
  pkgs          numeric,
  gross_wt      numeric,
  tare_wt       numeric,
  fcl_lcl       text not null default 'FCL' check (fcl_lcl in ('FCL', 'LCL')),
  soc           boolean not null default false,   -- shipper-owned container
  arr_mode      text,                             -- arrival mode
  disp_mode     text,                             -- dispatch mode
  temperature   numeric,                          -- reefer set point (°C)
  cell_location text,
  dng_mark      text,                             -- dangerous cargo marking
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  void_at       timestamptz,
  void_reason   text
);

create index manifest_bl_containers_bl_idx on manifest_bl_containers (bl_id, seq);

-- ── updated_at maintenance ───────────────────────────────────────────────────
-- touch_updated_at() already exists (used by 0003/0006) but it lives in the base
-- schema rather than a checked-in migration — redeclare it idempotently so this
-- file applies cleanly to a fresh project too.
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_manifest_vessels before update on manifest_vessels
  for each row execute function touch_updated_at();
create trigger touch_manifest_voyages before update on manifest_voyages
  for each row execute function touch_updated_at();
create trigger touch_manifest_bls before update on manifest_bls
  for each row execute function touch_updated_at();
create trigger touch_manifest_bl_parties before update on manifest_bl_parties
  for each row execute function touch_updated_at();
create trigger touch_manifest_bl_marks before update on manifest_bl_marks
  for each row execute function touch_updated_at();
create trigger touch_manifest_bl_cargo_lines before update on manifest_bl_cargo_lines
  for each row execute function touch_updated_at();
create trigger touch_manifest_bl_containers before update on manifest_bl_containers
  for each row execute function touch_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table manifest_vessels         enable row level security;
alter table manifest_voyages         enable row level security;
alter table manifest_bls             enable row level security;
alter table manifest_bl_parties      enable row level security;
alter table manifest_bl_marks        enable row level security;
alter table manifest_bl_cargo_lines  enable row level security;
alter table manifest_bl_containers   enable row level security;

create policy "auth_all" on manifest_vessels
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on manifest_voyages
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on manifest_bls
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on manifest_bl_parties
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on manifest_bl_marks
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on manifest_bl_cargo_lines
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "auth_all" on manifest_bl_containers
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ── Audit trail ──────────────────────────────────────────────────────────────
create trigger audit_manifest_vessels after insert or update or delete on manifest_vessels
  for each row execute function log_audit_event();
create trigger audit_manifest_voyages after insert or update or delete on manifest_voyages
  for each row execute function log_audit_event();
create trigger audit_manifest_bls after insert or update or delete on manifest_bls
  for each row execute function log_audit_event();
create trigger audit_manifest_bl_parties after insert or update or delete on manifest_bl_parties
  for each row execute function log_audit_event();
create trigger audit_manifest_bl_marks after insert or update or delete on manifest_bl_marks
  for each row execute function log_audit_event();
create trigger audit_manifest_bl_cargo_lines
  after insert or update or delete on manifest_bl_cargo_lines
  for each row execute function log_audit_event();
create trigger audit_manifest_bl_containers
  after insert or update or delete on manifest_bl_containers
  for each row execute function log_audit_event();

-- Realtime for the voyage/BL lists (multi-user parity with the rest of the app).
alter publication supabase_realtime add table manifest_voyages;
alter publication supabase_realtime add table manifest_bls;
