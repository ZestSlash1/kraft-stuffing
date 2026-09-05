// ─────────────────────────────────────────────────────────────────────────────
// ICEGATE JSON export — the ONLY place that knows the wire format.
//
// The real ICEGATE IGM field names have not been confirmed against a sample
// output yet (PHASE_IGM_MANIFEST_MODULE.md §2.7). Everything below is therefore
// a deliberately isolated PLACEHOLDER mapping: the UI and the data model never
// reference these keys, so when a genuine sample arrives, only this file
// changes. `MAPPING_VERSION` is stamped into the payload so a file generated
// today can be identified as pre-confirmation output.
//
// No submission happens here — the caller downloads a file for manual upload.
// ─────────────────────────────────────────────────────────────────────────────

import { blConsistency, blTotals, missingFields, BL_REQUIRED } from "../data/igmHelpers";

export const MAPPING_VERSION = "placeholder-1";

// Nulls, not empty strings: an absent value and a blank value are different
// things to a customs system, and we don't yet know which it wants.
const s = (v) => {
  const t = v === null || v === undefined ? "" : String(v).trim();
  return t === "" ? null : t;
};
const n = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const b = (v) => !!v;

// Dates go out as plain YYYY-MM-DD; timestamps as full ISO. IGM is filed against
// calendar dates, so a date field must never carry a timezone-shifted instant.
const d = (v) => {
  if (!v) return null;
  const str = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};
const ts = (v) => {
  if (!v) return null;
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const mapVessel = (vessel) => ({
  vesselName: s(vessel?.name),
  vesselCode: s(vessel?.code),
  imoNumber: s(vessel?.imoNo),
  callSign: s(vessel?.callSign),
  vesselType: s(vessel?.vesselType),
  grt: n(vessel?.grt),
  nrt: n(vessel?.nrt),
});

const mapParty = (party) => ({
  partyRole: s(party.partyType),
  name: s(party.name),
  addressLine1: s(party.address1),
  addressLine2: s(party.address2),
  city: s(party.city),
  pinCode: s(party.pin),
  state: s(party.state),
  country: s(party.country),
  email: s(party.email),
  panOrCode: s(party.pan),
});

const mapCargoLine = (line, index) => ({
  serialNumber: index + 1,
  hsnCode: s(line.hsnCode),
  unoCode: s(line.unoCode),
  imdgClass: s(line.imdgClass),
  packageCount: n(line.pkgs),
  packageUnit: s(line.pkgsUnit),
  cargoDescription: s(line.description),
});

const mapContainer = (container, index) => ({
  serialNumber: index + 1,
  containerNumber: s(container.containerNo),
  containerSize: s(container.size),
  containerType: s(container.type),
  sealType: s(container.sealType),
  sealNumber: s(container.sealNo),
  vgmKgs: n(container.vgm),
  packageCount: n(container.pkgs),
  grossWeight: n(container.grossWt),
  tareWeight: n(container.tareWt),
  loadStatus: s(container.fclLcl),
  shipperOwned: b(container.soc),
  arrivalMode: s(container.arrMode),
  dispatchMode: s(container.dispMode),
  temperatureC: n(container.temperature),
  cellLocation: s(container.cellLocation),
  dangerousCargoMark: s(container.dngMark),
});

const mapBl = (bl, index) => ({
  lineNumber: n(bl.lineNo) ?? index + 1,
  blNumber: s(bl.blNumber),
  blDate: d(bl.blDate),
  masterBlNumber: s(bl.mblNumber),
  masterBlDate: d(bl.mblDate),
  freightPayableAt: s(bl.freightPayableAt),
  feederVessel: s(bl.feederVessel),
  feederVoyage: s(bl.feederVoyage),
  motherVessel: s(bl.motherVessel),
  portOfReceipt: s(bl.portOfReceipt),
  portOfLoading: s(bl.portOfLoading),
  portOfDischarge: s(bl.dischargePort),
  placeOfDelivery: s(bl.deliveryPlace),
  grossWeight: n(bl.grossWt),
  netWeight: n(bl.netWt),
  weightUnit: s(bl.weightUnit),
  packageCount: n(bl.packages),
  packageUnit: s(bl.packageUnit),
  consolidatedIndicator: b(bl.consolidatedIndicator),
  cargoType: s(bl.cargoType),
  natureOfCargo: s(bl.natureOfCargo),
  hazardousCargo: b(bl.hazCargo),
  unoCode: s(bl.unoCode),
  imoClass: s(bl.imoClass),
  marks: s(bl.marks?.marksText),
  description: s(bl.marks?.descriptionText),
  parties: (bl.parties || []).filter((p) => s(p.name)).map(mapParty),
  cargoLines: (bl.cargoLines || []).map(mapCargoLine),
  containers: (bl.containers || []).map(mapContainer),
});

// voyage: the full tree from fetchIgmVoyageTree() — voyage + vessel + BLs with
// parties / marks / cargo lines / containers attached.
export function generateIgmJson(voyage) {
  if (!voyage) return null;
  const bls = voyage.bls || [];
  return {
    meta: {
      generatedAt: new Date().toISOString(),
      generatedBy: "Kraft Portal",
      mappingVersion: MAPPING_VERSION,
      // Explicit and machine-readable: this file has not been reconciled with a
      // real ICEGATE sample and must not be treated as submission-ready.
      fieldMappingConfirmed: false,
    },
    manifest: {
      igmNumber: s(voyage.igmNo),
      igmDate: d(voyage.igmDate),
      voyageNumber: s(voyage.voyageNo),
      voyageReference: s(voyage.voyageRef),
      transportMode: s(voyage.transportMode),
      purposeOfCall: s(voyage.purposeOfCall),
      terminalOperator: s(voyage.terminalOperator),
      cargoSummary: s(voyage.cargoSummary),
      arrivalPort: s(voyage.arrivalPort),
      lastPortOfCall: s(voyage.lastPort),
      nextPortOfCall: s(voyage.nextPort),
      crewCount: n(voyage.crewCount),
      passengerCount: n(voyage.paxCount),
      containersLanded: n(voyage.cntrsLanded),
      containersLoaded: n(voyage.cntrsLoaded),
      eta: ts(voyage.eta),
      ata: ts(voyage.ata),
      etd: ts(voyage.etd),
      sailingDate: d(voyage.sailingDate),
      vessel: mapVessel(voyage.vessel),
      billsOfLading: bls.map(mapBl),
    },
    totals: {
      blCount: bls.length,
      containerCount: bls.reduce((a, bl) => a + (bl.containers || []).length, 0),
      cargoLineCount: bls.reduce((a, bl) => a + (bl.cargoLines || []).length, 0),
      declaredGrossWeight: bls.reduce((a, bl) => a + Number(bl.grossWt || 0), 0),
      declaredPackages: bls.reduce((a, bl) => a + Number(bl.packages || 0), 0),
    },
  };
}

// Pre-download summary for the export panel: per-BL blockers and warnings, so
// the operator sees what's thin before generating a file.
export function igmExportSummary(voyage) {
  if (!voyage) return { blCount: 0, blockers: [], warnings: [], totals: null };
  const bls = voyage.bls || [];
  const blockers = [];
  const warnings = [];

  if (!String(voyage.igmNo || "").trim()) warnings.push("Voyage has no IGM number");
  if (!voyage.vessel) blockers.push("Voyage has no vessel linked");
  if (!bls.length) blockers.push("Voyage has no BLs");

  for (const bl of bls) {
    const label = bl.blNumber || "(unnumbered BL)";
    const missing = missingFields(bl, BL_REQUIRED);
    if (missing.length) blockers.push(`${label}: missing ${missing.join(", ")}`);
    if (!(bl.containers || []).length) warnings.push(`${label}: no containers`);
    if (!(bl.cargoLines || []).length) warnings.push(`${label}: no cargo lines`);
    for (const w of blConsistency(bl)) warnings.push(`${label}: ${w}`);
  }

  // `declaredGrossWt` mirrors the payload's totals.declaredGrossWeight (the sum of
  // BL header weights); `containerGrossWt` is what the container lines add up to.
  // Showing the declared figure keeps the panel and the file in agreement.
  const totals = bls.reduce(
    (acc, bl) => {
      const t = blTotals(bl);
      acc.containers += t.containers;
      acc.cargoLines += t.cargoLines;
      acc.containerGrossWt += t.grossWt;
      acc.declaredGrossWt += Number(bl.grossWt || 0);
      return acc;
    },
    { containers: 0, cargoLines: 0, containerGrossWt: 0, declaredGrossWt: 0 }
  );

  return { blCount: bls.length, blockers, warnings, totals };
}

export function igmFileName(voyage) {
  const part = (v, fallback) =>
    String(v || fallback).trim().replace(/[^A-Za-z0-9._-]+/g, "_") || fallback;
  const vessel = part(voyage?.vessel?.name, "VESSEL");
  const voy = part(voyage?.voyageNo, "VOY");
  const igm = part(voyage?.igmNo, "NOIGM");
  return `IGM_${vessel}_${voy}_${igm}.json`;
}

// Trigger a browser download of the generated payload. Kept next to the mapping
// so the view layer only deals with "export this voyage".
export function downloadIgmJson(voyage) {
  const payload = generateIgmJson(voyage);
  if (!payload) return { error: new Error("nothing to export") };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = igmFileName(voyage);
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a tick to start before revoking the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { payload, error: null };
}
