// Pure helpers for the IGM / BL manifest module: field validation, section
// completeness, and BL roll-ups. No React, no Supabase — everything here is
// testable in isolation and reused by both the entry form and the JSON export.

// The six BL party roles, in the order the entry form renders them. Lives here
// (not in lib/igm.js) so these helpers stay free of any Supabase import.
export const PARTY_TYPES = [
  { type: "shipper", label: "Shipper" },
  { type: "consignee", label: "Consignee" },
  { type: "forwarder", label: "Forwarder" },
  { type: "notifier1", label: "Notify Party 1" },
  { type: "notifier2", label: "Notify Party 2" },
  { type: "dl_agent", label: "Delivery Agent" },
];

// ── ISO 6346 container number ────────────────────────────────────────────────
// 4 letters (owner code + category) + 6 digits + 1 check digit. Each character
// gets a weight of 2^position; letters use the standard value table where
// multiples of 11 are skipped. Sum mod 11, then mod 10, is the check digit.
const LETTER_VALUES = (() => {
  const map = {};
  let value = 10;
  for (let i = 0; i < 26; i++) {
    if (value % 11 === 0) value++; // 11, 22, 33 are never used
    map[String.fromCharCode(65 + i)] = value;
    value++;
  }
  return map;
})();

export const normalizeContainerNo = (raw) =>
  String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

export function iso6346CheckDigit(prefix10) {
  const s = normalizeContainerNo(prefix10).slice(0, 10);
  if (!/^[A-Z]{4}\d{6}$/.test(s)) return null;
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const ch = s[i];
    const value = i < 4 ? LETTER_VALUES[ch] : Number(ch);
    sum += value * 2 ** i;
  }
  return (sum % 11) % 10;
}

// { ok, reason, expected } — `ok` is true for a valid 11-character number.
// Blank is not "invalid": the field is allowed to be empty while drafting.
export function validateContainerNo(raw) {
  const s = normalizeContainerNo(raw);
  if (!s) return { ok: true, blank: true };
  if (!/^[A-Z]{4}\d{7}$/.test(s))
    return { ok: false, reason: "Expected 4 letters + 7 digits (e.g. MSCU1234566)" };
  const expected = iso6346CheckDigit(s.slice(0, 10));
  if (expected === null) return { ok: false, reason: "Malformed owner/serial part" };
  if (Number(s[10]) !== expected)
    return { ok: false, reason: `Check digit should be ${expected}`, expected };
  return { ok: true };
}

// ── PAN ──────────────────────────────────────────────────────────────────────
export const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function validatePan(raw) {
  const s = String(raw || "").toUpperCase().trim();
  if (!s) return { ok: true, blank: true };
  if (!PAN_RE.test(s)) return { ok: false, reason: "Format AAAAA9999A" };
  return { ok: true };
}

// ── Other light field checks ─────────────────────────────────────────────────
export function validatePin(raw) {
  const s = String(raw || "").trim();
  if (!s) return { ok: true, blank: true };
  if (!/^\d{6}$/.test(s)) return { ok: false, reason: "6 digits" };
  return { ok: true };
}

export function validateEmail(raw) {
  const s = String(raw || "").trim();
  if (!s) return { ok: true, blank: true };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return { ok: false, reason: "Invalid email" };
  return { ok: true };
}

// ── Required fields ──────────────────────────────────────────────────────────
// Deliberately minimal: only what makes a record meaningless without it. IGM
// filing needs far more, but blocking a draft on every customs field would make
// the form unusable during data entry — the export panel reports the rest.
export const VOYAGE_REQUIRED = [
  ["vesselName", "Vessel"],
  ["voyageNo", "Voyage No"],
];

export const BL_REQUIRED = [
  ["blNumber", "BL Number"],
  ["portOfLoading", "Port of Loading"],
  ["dischargePort", "Discharge Port"],
];

export function missingFields(obj, required) {
  return required
    .filter(([key]) => {
      const v = obj?.[key];
      return v === null || v === undefined || String(v).trim() === "";
    })
    .map(([, label]) => label);
}

// ── BL roll-ups ──────────────────────────────────────────────────────────────
const sum = (rows, key) => rows.reduce((a, r) => a + Number(r[key] || 0), 0);

export function blTotals(bl) {
  const cargo = bl?.cargoLines || [];
  const containers = bl?.containers || [];
  return {
    cargoLines: cargo.length,
    containers: containers.length,
    cargoPkgs: sum(cargo, "pkgs"),
    containerPkgs: sum(containers, "pkgs"),
    grossWt: sum(containers, "grossWt"),
    tareWt: sum(containers, "tareWt"),
    vgm: sum(containers, "vgm"),
  };
}

// Declared header weights/packages vs. the sum of the line items. A mismatch is
// a warning, never an error — the BL header is what the shipper declared and the
// lines are what was actually entered; the operator decides which to correct.
export function blConsistency(bl) {
  const t = blTotals(bl);
  const warnings = [];
  if (bl?.packages && t.cargoPkgs && Number(bl.packages) !== t.cargoPkgs)
    warnings.push(
      `Header packages (${bl.packages}) ≠ cargo lines total (${t.cargoPkgs})`
    );
  if (bl?.grossWt && t.grossWt && Math.abs(Number(bl.grossWt) - t.grossWt) > 0.5)
    warnings.push(
      `Header gross weight (${bl.grossWt}) ≠ container total (${t.grossWt})`
    );
  if (bl?.hazCargo && !bl?.unoCode && !bl?.imoClass)
    warnings.push("Hazardous flag set but no UNO code / IMO class given");
  return warnings;
}

// Per-section completeness for the BL entry rail: "empty" | "partial" | "ok".
export function blSectionState(bl) {
  const filled = (v) => String(v ?? "").trim() !== "";
  const overviewKeys = ["blNumber", "blDate", "portOfLoading", "dischargePort", "packages", "grossWt"];
  const overviewFilled = overviewKeys.filter((k) => filled(bl?.[k])).length;

  const parties = bl?.parties || [];
  const namedParties = parties.filter((p) => filled(p.name)).length;

  const marksFilled = filled(bl?.marks?.marksText) || filled(bl?.marks?.descriptionText);

  const state = (n, total) => (n === 0 ? "empty" : n >= total ? "ok" : "partial");

  return {
    overview: state(overviewFilled, overviewKeys.length),
    parties: namedParties === 0 ? "empty" : namedParties >= 2 ? "ok" : "partial",
    marks: marksFilled ? "ok" : "empty",
    cargo: (bl?.cargoLines || []).length ? "ok" : "empty",
    containers: (bl?.containers || []).length ? "ok" : "empty",
  };
}

export const partyLabel = (type) =>
  PARTY_TYPES.find((p) => p.type === type)?.label || type;

// Sorted party list in the fixed role order, tolerating rows arriving in any
// order from the DB.
export function orderedParties(parties = []) {
  const order = PARTY_TYPES.map((p) => p.type);
  return [...parties].sort(
    (a, b) => order.indexOf(a.partyType) - order.indexOf(b.partyType)
  );
}

// ── Pick-list values ─────────────────────────────────────────────────────────
export const WEIGHT_UNITS = ["KGS", "MTS", "LBS"];
export const PACKAGE_UNITS = ["PKG", "BAG", "CTN", "DRM", "PLT", "BDL", "ROL", "PCS", "BLK"];
export const CARGO_TYPES = ["FCL", "LCL", "BREAK BULK", "LIQUID BULK", "DRY BULK"];
export const NATURE_OF_CARGO = ["GENERAL", "HAZARDOUS", "REEFER", "OVER DIMENSIONAL", "LIVE STOCK"];
export const CONTAINER_SIZES = ["20", "40", "40HC", "45"];
export const CONTAINER_TYPES = ["GP", "HC", "RF", "OT", "FR", "TK", "VE"];
export const SEAL_TYPES = ["SHIPPER", "CUSTOMS", "LINE", "AGENT"];
export const MOVEMENT_MODES = ["ROAD", "RAIL", "SEA", "COASTAL", "TRANSHIP"];
export const IMDG_CLASSES = [
  "1", "2.1", "2.2", "2.3", "3", "4.1", "4.2", "4.3",
  "5.1", "5.2", "6.1", "6.2", "7", "8", "9",
];
export const TRANSPORT_MODES = ["SEA", "AIR", "LAND"];

// Typeahead seed list only — every port field stays free text, because a BL can
// name any port on earth. Kraft's own trade lanes come first.
export const COMMON_PORTS = [
  { value: "Kolkata", hint: "INCCU" },
  { value: "Haldia", hint: "INHAL" },
  { value: "Port Blair", hint: "INIXZ" },
  { value: "Chennai", hint: "INMAA" },
  { value: "Nhava Sheva", hint: "INNSA" },
  { value: "Mundra", hint: "INMUN" },
  { value: "Kandla", hint: "INIXY" },
  { value: "Cochin", hint: "INCOK" },
  { value: "Tuticorin", hint: "INTUT" },
  { value: "Visakhapatnam", hint: "INVTZ" },
  { value: "Paradip", hint: "INPRT" },
  { value: "Kattupalli", hint: "INKAT" },
  { value: "Krishnapatnam", hint: "INKRI" },
  { value: "Mangalore", hint: "INNML" },
  { value: "Colombo", hint: "LKCMB" },
  { value: "Singapore", hint: "SGSIN" },
  { value: "Port Klang", hint: "MYPKG" },
  { value: "Dubai", hint: "AEDXB" },
];
export const PURPOSE_OF_CALL = ["IMPORT", "EXPORT", "IMPORT & EXPORT", "BUNKERING", "TRANSHIPMENT"];
export const IGM_VOYAGE_STATUS = ["draft", "filed", "closed"];
