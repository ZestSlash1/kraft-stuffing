import { jsPDF } from "jspdf";
import { fmtIST } from "./shared";
import { letterhead } from "./letterhead";
import { partyBlock } from "./partyBlock";
import { kvTable } from "./tables";
import { terms } from "./terms";
import { docFooter } from "./footer";

const AN_TERMS =
  "This is a courtesy notice of arrival and does not constitute authority to take delivery of the cargo. " +
  "Please contact Kraft Shipping & Logistics for clearance formalities and charges due prior to collection.";

// `hblDocument` is the issued HBL `documents` row (fromDbDocument shape) this
// notice references — callers must gate on one existing before calling this.
export function buildArrivalNoticePayload(voyage, container, { hblDocument, consigneeRecord, overrides = {} } = {}) {
  const line = container.lines?.[0] || null;
  const totalGrossKg = (container.lines || []).reduce(
    (a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0),
    0
  );
  const totalPackages = (container.lines || []).reduce((a, l) => a + Number(l.qty || 0), 0);

  const eta =
    overrides.eta ||
    [...(voyage.vesselMovements || [])]
      .filter((m) => /eta|arriv/i.test(m.eventType || ""))
      .sort((a, b) => new Date(b.eventDate) - new Date(a.eventDate))[0]?.eventDate ||
    null;

  return {
    blNumber: hblDocument?.number || "—",
    vessel: voyage.vessel,
    voyageNo: voyage.voyageNo,
    eta,
    deliveryLocation: overrides.deliveryLocation || voyage.pod,
    containerNo: container.number || "—",
    sealNo: container.sealNo || "—",
    totalPackages,
    totalGrossKg,
    consignee: {
      name: line?.consignee || consigneeRecord?.name || "—",
      address: consigneeRecord?.address || "",
      contact: "",
    },
    chargesDue: overrides.chargesDue || "",
    kraftContact: overrides.kraftContact || "Kraft Shipping & Logistics Pvt. Ltd., Kolkata",
    placeOfIssue: overrides.placeOfIssue || "Kolkata",
  };
}

export function renderArrivalNotice(doc, payload, meta = {}) {
  let y = letterhead(doc, { title: "ARRIVAL NOTICE" });

  const fullW = doc.internal.pageSize.getWidth() - 80;
  const h = partyBlock(doc, 40, y + 6, fullW, 50, "Consignee / Notify Party", payload.consignee);
  y = y + 6 + h + 10;

  y = kvTable(doc, 40, y, fullW, [
    ["Bill of Lading No", payload.blNumber],
    ["Vessel / Voyage No", `${payload.vessel || "—"} / ${payload.voyageNo || "—"}`],
    ["ETA", fmtIST(payload.eta)],
    ["Delivery Location", payload.deliveryLocation],
    ["Container No / Seal No", `${payload.containerNo} / ${payload.sealNo}`],
    ["Total Packages", payload.totalPackages],
    ["Total Gross Weight", `${payload.totalGrossKg} kg`],
    ["Charges Due", payload.chargesDue || "To be advised"],
  ]);
  y += 14;

  terms(doc, 40, y, fullW, `${AN_TERMS} Contact for clearance: ${payload.kraftContact}.`);

  docFooter(doc, {
    number: meta.number || "DRAFT",
    issuedAt: meta.issuedAt || new Date().toISOString(),
    place: payload.placeOfIssue,
  });
}

export function generateArrivalNoticePdf(payload, meta = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  renderArrivalNotice(doc, payload, meta);
  return doc.output("blob");
}
