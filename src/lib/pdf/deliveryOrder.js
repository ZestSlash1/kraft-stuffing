import { jsPDF } from "jspdf";
import { fmtIST } from "./shared";
import { letterhead } from "./letterhead";
import { partyBlock } from "./partyBlock";
import { kvTable } from "./tables";
import { terms } from "./terms";
import { docFooter } from "./footer";

const DO_TERMS =
  "This Delivery Order is issued subject to full compliance with customs, port and carrier requirements, and " +
  "settlement of all outstanding charges. Kraft Shipping & Logistics Pvt. Ltd. accepts no liability for cargo " +
  "released against this order beyond the validity date stated above.";

// `hblDocument` is the issued HBL `documents` row this DO references —
// callers must gate on one existing before calling this.
export function buildDeliveryOrderPayload(voyage, container, { hblDocument, consigneeRecord, overrides = {} } = {}) {
  const line = container.lines?.[0] || null;
  const totalPackages = (container.lines || []).reduce((a, l) => a + Number(l.qty || 0), 0);
  const consigneeName = line?.consignee || consigneeRecord?.name || "—";

  return {
    blNumber: hblDocument?.number || "—",
    consignee: {
      name: consigneeName,
      address: consigneeRecord?.address || "",
      contact: "",
    },
    releaseTo: overrides.releaseTo || consigneeName,
    containerNo: container.number || "—",
    sealNo: container.sealNo || "—",
    totalPackages,
    validityDate: overrides.validityDate || null,
    remarks: overrides.remarks || "",
    chargesCleared: !!overrides.chargesCleared,
    placeOfIssue: overrides.placeOfIssue || "Kolkata",
  };
}

export function renderDeliveryOrder(doc, payload, meta = {}) {
  let y = letterhead(doc, { title: "DELIVERY ORDER" });

  const fullW = doc.internal.pageSize.getWidth() - 80;
  const h = partyBlock(doc, 40, y + 6, fullW, 50, "Consignee", payload.consignee);
  y = y + 6 + h + 10;

  y = kvTable(doc, 40, y, fullW, [
    ["Bill of Lading No", payload.blNumber],
    ["Release To", payload.releaseTo],
    ["Container No / Seal No", `${payload.containerNo} / ${payload.sealNo}`],
    ["Total Packages", payload.totalPackages],
    ["Valid Until", payload.validityDate ? fmtIST(payload.validityDate) : "—"],
    ["Charges Cleared", payload.chargesCleared ? "Yes" : "Pending confirmation"],
  ]);
  y += 14;

  if (payload.remarks) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Release Conditions / Remarks:", 40, y);
    y += 12;
    doc.setFont("helvetica", "normal");
    const lines = doc.splitTextToSize(payload.remarks, fullW);
    doc.text(lines, 40, y);
    y += lines.length * 10 + 10;
  }

  terms(doc, 40, y, fullW, DO_TERMS);

  docFooter(doc, {
    number: meta.number || "DRAFT",
    issuedAt: meta.issuedAt || new Date().toISOString(),
    place: payload.placeOfIssue,
  });
}

export function generateDeliveryOrderPdf(payload, meta = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  renderDeliveryOrder(doc, payload, meta);
  return doc.output("blob");
}
