import { supabase } from "./supabase";
import { KRAFT_ORG_ID, registerExecutors, runWrite } from "./db";
import { PARTY_TYPES } from "../data/igmHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// IGM / BL manifest data layer (migration 0030).
//
// Mirrors lib/db.js in shape: snake_case DB rows ↔ camelCase app objects, plus
// offline-aware writes. Every write goes through runWrite() so it queues while
// offline and replays on reconnect — the executors below are registered into
// db.js's shared table at module load.
//
// Deletion is void-only across this module: rows get void_at/void_reason set and
// every read filters `void_at is null`. Nothing here hard-deletes.
// ─────────────────────────────────────────────────────────────────────────────

export const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

// Role list lives with the pure helpers; re-exported here so callers that
// already import the data layer don't need a second import.
export { PARTY_TYPES };

// ── Mappers ──────────────────────────────────────────────────────────────────
const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

export const fromDbIgmVessel = (r) => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name || "",
  code: r.code || "",
  imoNo: r.imo_no || "",
  callSign: r.call_sign || "",
  vesselType: r.vessel_type || "",
  grt: r.grt ?? null,
  nrt: r.nrt ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toDbIgmVessel = (v) => ({
  id: v.id ?? undefined,
  org_id: v.orgId ?? KRAFT_ORG_ID,
  name: v.name,
  code: v.code ?? null,
  imo_no: v.imoNo ?? null,
  call_sign: v.callSign ?? null,
  vessel_type: v.vesselType ?? null,
  grt: numOrNull(v.grt),
  nrt: numOrNull(v.nrt),
  created_by: v.createdBy ?? null,
});

const VESSEL_KEYMAP = {
  name: "name",
  code: "code",
  imoNo: "imo_no",
  callSign: "call_sign",
  vesselType: "vessel_type",
  grt: "grt",
  nrt: "nrt",
};

export const fromDbIgmVoyage = (r) => ({
  id: r.id,
  orgId: r.org_id,
  vesselId: r.vessel_id || null,
  stuffingVoyageId: r.stuffing_voyage_id || null,
  voyageNo: r.voyage_no || "",
  voyageRef: r.voyage_ref || "",
  igmNo: r.igm_no || "",
  igmDate: r.igm_date || "",
  terminalOperator: r.terminal_operator || "",
  cargoSummary: r.cargo_summary || "",
  purposeOfCall: r.purpose_of_call || "",
  transportMode: r.transport_mode || "SEA",
  arrivalPort: r.arrival_port || "",
  lastPort: r.last_port || "",
  nextPort: r.next_port || "",
  crewCount: r.crew_count ?? null,
  paxCount: r.pax_count ?? null,
  cntrsLanded: r.cntrs_landed ?? null,
  cntrsLoaded: r.cntrs_loaded ?? null,
  eta: r.eta || "",
  ata: r.ata || "",
  etd: r.etd || "",
  sailingDate: r.sailing_date || "",
  status: r.status || "draft",
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  vessel: null, // populated by fetchIgmVoyage()
  bls: [],
});

export const toDbIgmVoyage = (v) => ({
  id: v.id ?? undefined,
  org_id: v.orgId ?? KRAFT_ORG_ID,
  vessel_id: v.vesselId ?? null,
  stuffing_voyage_id: v.stuffingVoyageId ?? null,
  voyage_no: v.voyageNo ?? "",
  voyage_ref: v.voyageRef ?? null,
  igm_no: v.igmNo ?? null,
  igm_date: v.igmDate || null,
  terminal_operator: v.terminalOperator ?? null,
  cargo_summary: v.cargoSummary ?? null,
  purpose_of_call: v.purposeOfCall ?? null,
  transport_mode: v.transportMode ?? undefined,
  arrival_port: v.arrivalPort ?? null,
  last_port: v.lastPort ?? null,
  next_port: v.nextPort ?? null,
  crew_count: numOrNull(v.crewCount),
  pax_count: numOrNull(v.paxCount),
  cntrs_landed: numOrNull(v.cntrsLanded),
  cntrs_loaded: numOrNull(v.cntrsLoaded),
  eta: v.eta || null,
  ata: v.ata || null,
  etd: v.etd || null,
  sailing_date: v.sailingDate || null,
  status: v.status ?? undefined,
  created_by: v.createdBy ?? null,
});

const VOYAGE_KEYMAP = {
  vesselId: "vessel_id",
  stuffingVoyageId: "stuffing_voyage_id",
  voyageNo: "voyage_no",
  voyageRef: "voyage_ref",
  igmNo: "igm_no",
  igmDate: "igm_date",
  terminalOperator: "terminal_operator",
  cargoSummary: "cargo_summary",
  purposeOfCall: "purpose_of_call",
  transportMode: "transport_mode",
  arrivalPort: "arrival_port",
  lastPort: "last_port",
  nextPort: "next_port",
  crewCount: "crew_count",
  paxCount: "pax_count",
  cntrsLanded: "cntrs_landed",
  cntrsLoaded: "cntrs_loaded",
  eta: "eta",
  ata: "ata",
  etd: "etd",
  sailingDate: "sailing_date",
  status: "status",
};

export const fromDbIgmBl = (r) => ({
  id: r.id,
  voyageId: r.voyage_id,
  lineNo: r.line_no ?? null,
  blNumber: r.bl_number || "",
  blDate: r.bl_date || "",
  mblNumber: r.mbl_number || "",
  mblDate: r.mbl_date || "",
  freightPayableAt: r.freight_payable_at || "",
  feederVessel: r.feeder_vessel || "",
  feederVoyage: r.feeder_voyage || "",
  motherVessel: r.mother_vessel || "",
  portOfReceipt: r.port_of_receipt || "",
  portOfLoading: r.port_of_loading || "",
  dischargePort: r.discharge_port || "",
  deliveryPlace: r.delivery_place || "",
  grossWt: r.gross_wt ?? null,
  netWt: r.net_wt ?? null,
  weightUnit: r.weight_unit || "KGS",
  packages: r.packages ?? null,
  packageUnit: r.package_unit || "PKG",
  consolidatedIndicator: !!r.consolidated_indicator,
  cargoType: r.cargo_type || "",
  natureOfCargo: r.nature_of_cargo || "",
  hazCargo: !!r.haz_cargo,
  unoCode: r.uno_code || "",
  imoClass: r.imo_class || "",
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  parties: [],
  marks: null,
  cargoLines: [],
  containers: [],
});

export const toDbIgmBl = (b) => ({
  id: b.id ?? undefined,
  voyage_id: b.voyageId,
  line_no: numOrNull(b.lineNo),
  bl_number: b.blNumber ?? "",
  bl_date: b.blDate || null,
  mbl_number: b.mblNumber ?? null,
  mbl_date: b.mblDate || null,
  freight_payable_at: b.freightPayableAt ?? null,
  feeder_vessel: b.feederVessel ?? null,
  feeder_voyage: b.feederVoyage ?? null,
  mother_vessel: b.motherVessel ?? null,
  port_of_receipt: b.portOfReceipt ?? null,
  port_of_loading: b.portOfLoading ?? null,
  discharge_port: b.dischargePort ?? null,
  delivery_place: b.deliveryPlace ?? null,
  gross_wt: numOrNull(b.grossWt),
  net_wt: numOrNull(b.netWt),
  weight_unit: b.weightUnit ?? undefined,
  packages: numOrNull(b.packages),
  package_unit: b.packageUnit ?? undefined,
  consolidated_indicator: b.consolidatedIndicator ?? false,
  cargo_type: b.cargoType ?? null,
  nature_of_cargo: b.natureOfCargo ?? null,
  haz_cargo: b.hazCargo ?? false,
  uno_code: b.unoCode ?? null,
  imo_class: b.imoClass ?? null,
  created_by: b.createdBy ?? null,
});

const BL_KEYMAP = {
  lineNo: "line_no",
  blNumber: "bl_number",
  blDate: "bl_date",
  mblNumber: "mbl_number",
  mblDate: "mbl_date",
  freightPayableAt: "freight_payable_at",
  feederVessel: "feeder_vessel",
  feederVoyage: "feeder_voyage",
  motherVessel: "mother_vessel",
  portOfReceipt: "port_of_receipt",
  portOfLoading: "port_of_loading",
  dischargePort: "discharge_port",
  deliveryPlace: "delivery_place",
  grossWt: "gross_wt",
  netWt: "net_wt",
  weightUnit: "weight_unit",
  packages: "packages",
  packageUnit: "package_unit",
  consolidatedIndicator: "consolidated_indicator",
  cargoType: "cargo_type",
  natureOfCargo: "nature_of_cargo",
  hazCargo: "haz_cargo",
  unoCode: "uno_code",
  imoClass: "imo_class",
};

export const fromDbIgmParty = (r) => ({
  id: r.id,
  blId: r.bl_id,
  partyType: r.party_type,
  name: r.name || "",
  address1: r.address_1 || "",
  address2: r.address_2 || "",
  city: r.city || "",
  pin: r.pin || "",
  state: r.state || "",
  country: r.country || "IN",
  email: r.email || "",
  pan: r.pan || "",
});

export const toDbIgmParty = (p) => ({
  id: p.id ?? undefined,
  bl_id: p.blId,
  party_type: p.partyType,
  name: p.name ?? null,
  address_1: p.address1 ?? null,
  address_2: p.address2 ?? null,
  city: p.city ?? null,
  pin: p.pin ?? null,
  state: p.state ?? null,
  country: p.country ?? undefined,
  email: p.email ?? null,
  pan: p.pan ?? null,
});

const PARTY_KEYMAP = {
  name: "name",
  address1: "address_1",
  address2: "address_2",
  city: "city",
  pin: "pin",
  state: "state",
  country: "country",
  email: "email",
  pan: "pan",
};

export const fromDbIgmMarks = (r) => ({
  id: r.id,
  blId: r.bl_id,
  marksText: r.marks_text || "",
  descriptionText: r.description_text || "",
});

export const toDbIgmMarks = (m) => ({
  id: m.id ?? undefined,
  bl_id: m.blId,
  marks_text: m.marksText ?? null,
  description_text: m.descriptionText ?? null,
});

const MARKS_KEYMAP = { marksText: "marks_text", descriptionText: "description_text" };

export const fromDbIgmCargoLine = (r) => ({
  id: r.id,
  blId: r.bl_id,
  seq: r.seq ?? 0,
  hsnCode: r.hsn_code || "",
  unoCode: r.uno_code || "",
  imdgClass: r.imdg_class || "",
  pkgs: r.pkgs ?? null,
  pkgsUnit: r.pkgs_unit || "PKG",
  description: r.description || "",
});

export const toDbIgmCargoLine = (l) => ({
  id: l.id ?? undefined,
  bl_id: l.blId,
  seq: l.seq ?? 0,
  hsn_code: l.hsnCode ?? null,
  uno_code: l.unoCode ?? null,
  imdg_class: l.imdgClass ?? null,
  pkgs: numOrNull(l.pkgs),
  pkgs_unit: l.pkgsUnit ?? undefined,
  description: l.description ?? null,
});

const CARGO_LINE_KEYMAP = {
  seq: "seq",
  hsnCode: "hsn_code",
  unoCode: "uno_code",
  imdgClass: "imdg_class",
  pkgs: "pkgs",
  pkgsUnit: "pkgs_unit",
  description: "description",
};

export const fromDbIgmContainer = (r) => ({
  id: r.id,
  blId: r.bl_id,
  seq: r.seq ?? 0,
  containerNo: r.container_no || "",
  size: r.size || "20",
  type: r.type || "",
  sealType: r.seal_type || "",
  sealNo: r.seal_no || "",
  vgm: r.vgm ?? null,
  pkgs: r.pkgs ?? null,
  grossWt: r.gross_wt ?? null,
  tareWt: r.tare_wt ?? null,
  fclLcl: r.fcl_lcl || "FCL",
  soc: !!r.soc,
  arrMode: r.arr_mode || "",
  dispMode: r.disp_mode || "",
  temperature: r.temperature ?? null,
  cellLocation: r.cell_location || "",
  dngMark: r.dng_mark || "",
});

export const toDbIgmContainer = (c) => ({
  id: c.id ?? undefined,
  bl_id: c.blId,
  seq: c.seq ?? 0,
  container_no: c.containerNo ?? null,
  size: c.size ?? undefined,
  type: c.type ?? null,
  seal_type: c.sealType ?? null,
  seal_no: c.sealNo ?? null,
  vgm: numOrNull(c.vgm),
  pkgs: numOrNull(c.pkgs),
  gross_wt: numOrNull(c.grossWt),
  tare_wt: numOrNull(c.tareWt),
  fcl_lcl: c.fclLcl ?? undefined,
  soc: c.soc ?? false,
  arr_mode: c.arrMode ?? null,
  disp_mode: c.dispMode ?? null,
  temperature: numOrNull(c.temperature),
  cell_location: c.cellLocation ?? null,
  dng_mark: c.dngMark ?? null,
});

const CONTAINER_KEYMAP = {
  seq: "seq",
  containerNo: "container_no",
  size: "size",
  type: "type",
  sealType: "seal_type",
  sealNo: "seal_no",
  vgm: "vgm",
  pkgs: "pkgs",
  grossWt: "gross_wt",
  tareWt: "tare_wt",
  fclLcl: "fcl_lcl",
  soc: "soc",
  arrMode: "arr_mode",
  dispMode: "disp_mode",
  temperature: "temperature",
  cellLocation: "cell_location",
  dngMark: "dng_mark",
};

const mapKeys = (patch, keymap) => {
  const out = {};
  for (const k in patch) if (k in keymap) out[keymap[k]] = patch[k];
  return out;
};

// Strip undefined so partial writes never null a column by accident.
const clean = (obj) => {
  const out = {};
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};

// ── Reads ────────────────────────────────────────────────────────────────────
const live = (q) => q.is("void_at", null);

export async function fetchIgmVessels(orgId = KRAFT_ORG_ID) {
  const { data, error } = await live(
    supabase.from("manifest_vessels").select("*").eq("org_id", orgId)
  ).order("name", { ascending: true });
  return { data: (data || []).map(fromDbIgmVessel), error };
}

export async function fetchIgmVoyages(orgId = KRAFT_ORG_ID) {
  const { data, error } = await live(
    supabase.from("manifest_voyages").select("*").eq("org_id", orgId)
  ).order("created_at", { ascending: false });
  return { data: (data || []).map(fromDbIgmVoyage), error };
}

export async function fetchIgmBls(voyageId) {
  const { data, error } = await live(
    supabase.from("manifest_bls").select("*").eq("voyage_id", voyageId)
  ).order("created_at", { ascending: true });
  return { data: (data || []).map(fromDbIgmBl), error };
}

// BL list rows for the voyage detail view: header fields plus the consignee name
// and child counts, which is everything the list renders and filters on. Done as
// three flat queries rather than per-BL fetches so a voyage with 200 BLs is still
// one round-trip each.
export async function fetchIgmBlSummaries(voyageId) {
  const { data: bls, error } = await fetchIgmBls(voyageId);
  if (error) return { data: [], error };
  const ids = bls.map((b) => b.id);
  if (!ids.length) return { data: [], error: null };

  const [parties, cargo, containers] = await Promise.all([
    live(
      supabase
        .from("manifest_bl_parties")
        .select("bl_id, party_type, name")
        .in("bl_id", ids)
        .eq("party_type", "consignee")
    ),
    live(supabase.from("manifest_bl_cargo_lines").select("bl_id").in("bl_id", ids)),
    live(supabase.from("manifest_bl_containers").select("bl_id, pkgs, gross_wt").in("bl_id", ids)),
  ]);

  const consigneeByBl = {};
  for (const row of parties.data || []) consigneeByBl[row.bl_id] = row.name || "";
  const tally = (rows) =>
    (rows || []).reduce((acc, r) => ({ ...acc, [r.bl_id]: (acc[r.bl_id] || 0) + 1 }), {});
  const cargoCounts = tally(cargo.data);
  const containerCounts = tally(containers.data);

  return {
    data: bls.map((bl) => ({
      ...bl,
      consigneeName: consigneeByBl[bl.id] || "",
      cargoLineCount: cargoCounts[bl.id] || 0,
      containerCount: containerCounts[bl.id] || 0,
    })),
    error: parties.error || cargo.error || containers.error || null,
  };
}

// BL counts for the voyage list, in one query for all voyages on screen.
export async function fetchIgmBlCounts(voyageIds = []) {
  if (!voyageIds.length) return { data: {}, error: null };
  const { data, error } = await live(
    supabase.from("manifest_bls").select("voyage_id").in("voyage_id", voyageIds)
  );
  const counts = {};
  for (const row of data || []) counts[row.voyage_id] = (counts[row.voyage_id] || 0) + 1;
  return { data: counts, error };
}

// Voyage + its vessel + its BL headers (children of each BL are loaded lazily by
// the BL entry view — a voyage can carry hundreds of BLs).
export async function fetchIgmVoyage(id) {
  const { data, error } = await supabase
    .from("manifest_voyages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { data: null, error };
  const voyage = fromDbIgmVoyage(data);
  if (voyage.vesselId) {
    const { data: vRow } = await supabase
      .from("manifest_vessels")
      .select("*")
      .eq("id", voyage.vesselId)
      .maybeSingle();
    voyage.vessel = vRow ? fromDbIgmVessel(vRow) : null;
  }
  const { data: bls, error: blErr } = await fetchIgmBls(id);
  if (blErr) return { data: null, error: blErr };
  voyage.bls = bls;
  return { data: voyage, error: null };
}

// One BL with every child collection attached.
export async function fetchIgmBl(id) {
  const { data, error } = await supabase
    .from("manifest_bls")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return { data: null, error };
  const bl = fromDbIgmBl(data);

  const [parties, marks, cargo, containers] = await Promise.all([
    live(supabase.from("manifest_bl_parties").select("*").eq("bl_id", id)),
    live(supabase.from("manifest_bl_marks").select("*").eq("bl_id", id)),
    live(supabase.from("manifest_bl_cargo_lines").select("*").eq("bl_id", id)).order("seq"),
    live(supabase.from("manifest_bl_containers").select("*").eq("bl_id", id)).order("seq"),
  ]);
  const childError =
    parties.error || marks.error || cargo.error || containers.error || null;
  if (childError) return { data: null, error: childError };

  bl.parties = (parties.data || []).map(fromDbIgmParty);
  bl.marks = marks.data?.[0] ? fromDbIgmMarks(marks.data[0]) : null;
  bl.cargoLines = (cargo.data || []).map(fromDbIgmCargoLine);
  bl.containers = (containers.data || []).map(fromDbIgmContainer);
  return { data: bl, error: null };
}

// Whole voyage tree — used only by the JSON export, which needs every child row.
export async function fetchIgmVoyageTree(voyageId) {
  const { data: voyage, error } = await fetchIgmVoyage(voyageId);
  if (error || !voyage) return { data: null, error };
  const full = [];
  for (const bl of voyage.bls) {
    const { data, error: blErr } = await fetchIgmBl(bl.id);
    if (blErr) return { data: null, error: blErr };
    full.push(data);
  }
  return { data: { ...voyage, bls: full }, error: null };
}

// ── Executors (registered into db.js's offline queue) ─────────────────────────
const insert = (table) => (p) => supabase.from(table).insert(p).select().single();
const patch = (table) => ({ id, patch: p }) =>
  supabase.from(table).update(p).eq("id", id).select().single();

registerExecutors({
  igmVesselCreate: insert("manifest_vessels"),
  igmVesselUpdate: patch("manifest_vessels"),
  igmVoyageCreate: insert("manifest_voyages"),
  igmVoyageUpdate: patch("manifest_voyages"),
  igmBlCreate: insert("manifest_bls"),
  igmBlUpdate: patch("manifest_bls"),
  igmPartyCreate: insert("manifest_bl_parties"),
  igmPartyUpdate: patch("manifest_bl_parties"),
  igmMarksCreate: insert("manifest_bl_marks"),
  igmMarksUpdate: patch("manifest_bl_marks"),
  igmCargoLineCreate: insert("manifest_bl_cargo_lines"),
  igmCargoLineUpdate: patch("manifest_bl_cargo_lines"),
  igmContainerCreate: insert("manifest_bl_containers"),
  igmContainerUpdate: patch("manifest_bl_containers"),
});

// ── Writes ───────────────────────────────────────────────────────────────────
// Void, never delete: a manifest row may already have been filed with customs,
// so the record has to survive its own removal from the working set.
const voidPatch = (reason) => ({
  void_at: new Date().toISOString(),
  void_reason: reason || null,
});

export function createIgmVessel(vessel) {
  const p = clean(toDbIgmVessel({ id: vessel.id ?? uid(), ...vessel }));
  return runWrite("igmVesselCreate", p, p);
}

export function updateIgmVessel(id, fields) {
  const p = clean(mapKeys(fields, VESSEL_KEYMAP));
  return runWrite("igmVesselUpdate", { id, patch: p }, { id, ...p });
}

export function voidIgmVessel(id, reason) {
  return runWrite("igmVesselUpdate", { id, patch: voidPatch(reason) }, { id });
}

export function createIgmVoyage(voyage) {
  const p = clean(toDbIgmVoyage({ id: voyage.id ?? uid(), ...voyage }));
  return runWrite("igmVoyageCreate", p, p);
}

export function updateIgmVoyage(id, fields) {
  const p = clean(mapKeys(fields, VOYAGE_KEYMAP));
  return runWrite("igmVoyageUpdate", { id, patch: p }, { id, ...p });
}

export function voidIgmVoyage(id, reason) {
  return runWrite("igmVoyageUpdate", { id, patch: voidPatch(reason) }, { id });
}

// A BL is never useful on its own: it always owns one card per party role and a
// marks record. Creating them up-front (client-minted ids) means the entry form
// only ever patches by id — no upsert-on-conflict against a partial unique index,
// and it works the same offline.
export async function createIgmBl(draft) {
  const blId = draft.id ?? uid();
  const p = clean(toDbIgmBl({ ...draft, id: blId }));
  const { data, error } = await runWrite("igmBlCreate", p, p);
  if (error) return { data: null, error };

  const parties = [];
  for (const { type } of PARTY_TYPES) {
    const row = clean(toDbIgmParty({ id: uid(), blId, partyType: type }));
    const { data: pd, error: pErr } = await runWrite("igmPartyCreate", row, row);
    if (pErr) return { data: null, error: pErr };
    parties.push(fromDbIgmParty(pd || row));
  }
  const marksRow = clean(toDbIgmMarks({ id: uid(), blId }));
  const { data: md, error: mErr } = await runWrite("igmMarksCreate", marksRow, marksRow);
  if (mErr) return { data: null, error: mErr };

  const bl = fromDbIgmBl(data || p);
  bl.parties = parties;
  bl.marks = fromDbIgmMarks(md || marksRow);
  return { data: bl, error: null };
}

export function updateIgmBl(id, fields) {
  const p = clean(mapKeys(fields, BL_KEYMAP));
  return runWrite("igmBlUpdate", { id, patch: p }, { id, ...p });
}

export function voidIgmBl(id, reason) {
  return runWrite("igmBlUpdate", { id, patch: voidPatch(reason) }, { id });
}

export function updateIgmParty(id, fields) {
  const p = clean(mapKeys(fields, PARTY_KEYMAP));
  return runWrite("igmPartyUpdate", { id, patch: p }, { id, ...p });
}

export function updateIgmMarks(id, fields) {
  const p = clean(mapKeys(fields, MARKS_KEYMAP));
  return runWrite("igmMarksUpdate", { id, patch: p }, { id, ...p });
}

export function createIgmCargoLine(line) {
  const p = clean(toDbIgmCargoLine({ ...line, id: line.id ?? uid() }));
  return runWrite("igmCargoLineCreate", p, p);
}

export function updateIgmCargoLine(id, fields) {
  const p = clean(mapKeys(fields, CARGO_LINE_KEYMAP));
  return runWrite("igmCargoLineUpdate", { id, patch: p }, { id, ...p });
}

export function voidIgmCargoLine(id, reason) {
  return runWrite("igmCargoLineUpdate", { id, patch: voidPatch(reason) }, { id });
}

export function createIgmContainer(container) {
  const p = clean(toDbIgmContainer({ ...container, id: container.id ?? uid() }));
  return runWrite("igmContainerCreate", p, p);
}

export function updateIgmContainer(id, fields) {
  const p = clean(mapKeys(fields, CONTAINER_KEYMAP));
  return runWrite("igmContainerUpdate", { id, patch: p }, { id, ...p });
}

export function voidIgmContainer(id, reason) {
  return runWrite("igmContainerUpdate", { id, patch: voidPatch(reason) }, { id });
}

// Find-or-create a vessel by name — the typeahead lets the user commit a name
// that isn't in the master yet without leaving the voyage form.
export async function ensureIgmVessel(name, extras = {}) {
  const trimmed = (name || "").trim();
  if (!trimmed) return { data: null, error: new Error("vessel name required") };
  const { data: existing } = await live(
    supabase.from("manifest_vessels").select("*").ilike("name", trimmed)
  ).limit(1);
  if (existing?.[0]) return { data: fromDbIgmVessel(existing[0]), error: null };
  const { data, error } = await createIgmVessel({ name: trimmed, ...extras });
  return { data: data ? fromDbIgmVessel(data) : null, error };
}
