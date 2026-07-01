import { jsPDF } from "jspdf";
import { MARGIN, fmtIST } from "./shared";
import { letterhead } from "./letterhead";
import { partyBlock } from "./partyBlock";
import { kvTable, cargoTable } from "./tables";
import { terms } from "./terms";
import { docFooter } from "./footer";

const PAGE_BOTTOM = 745; // leaves room for docFooter on the last page

const CARGO_COLUMNS = [
  ["Marks & Nos", 90],
  ["No. & Kind of Pkgs", 100],
  ["Description of Goods", 165],
  ["Gross Wt (kg)", 80],
  ["Measurement (CBM)", 80],
];

const HBL_TERMS =
  "Received by the Carrier the goods as specified above in apparent good order and condition unless otherwise " +
  "stated, to be carried subject to the terms hereof from the Place of Receipt or Port of Loading to the Port of " +
  "Discharge or Place of Delivery. This House Bill of Lading is issued by Kraft Shipping & Logistics Pvt. Ltd. " +
  "acting as a Non-Vessel Operating Common Carrier (NVOCC) and is subject to its standard trading terms and " +
  "conditions, copies of which are available on request.";

// Compose the exact field set an HBL needs from live data. `shipperRecord` /
// `consigneeRecord` come from the shippers/consignees master lists (the
// stuffing_lines only carry a name string, not an address) — pass whichever
// record matches the line's shipperId/consigneeId, or null if not found.
// `overrides` carries the manual fields the draft modal exposes (freight
// term, number of originals, shipped-on-board date, place of issue, CBM).
export function buildHblPayload(voyage, container, booking, { shipperRecord, consigneeRecord, overrides = {} } = {}) {
  const line = container.lines?.[0] || null;

  const cargoLines = (container.lines || []).map((l) => ({
    marks: container.number || "—",
    packages: `${l.qty} ${l.unit}`,
    description: l.cargo,
    grossKg: Number(l.qty || 0) * Number(l.unitWeightKg || 0),
    cbm: overrides.cbmByLineId?.[l.id] ?? null,
  }));
  const totalGrossKg = cargoLines.reduce((a, l) => a + Number(l.grossKg || 0), 0);

  return {
    vessel: voyage.vessel,
    voyageNo: voyage.voyageNo,
    pol: voyage.pol,
    pod: voyage.pod,
    placeOfReceipt: overrides.placeOfReceipt || voyage.pol,
    placeOfDelivery: overrides.placeOfDelivery || voyage.pod,
    shipper: {
      name: line?.shipper || shipperRecord?.name || "—",
      address: shipperRecord?.address || "",
      contact: "",
    },
    consignee: {
      name: line?.consignee || consigneeRecord?.name || "—",
      address: consigneeRecord?.address || "",
      contact: "",
    },
    notifyParty: {
      name: line?.notifyParty || "Same as Consignee",
      address: "",
      contact: "",
    },
    containerNo: container.number || "—",
    sealNo: container.sealNo || "—",
    sealNo2: container.sealNo2 || "",
    cargoLines,
    totalGrossKg,
    freightTerm: overrides.freightTerm || (booking?.freightStatus === "paid" ? "Prepaid" : "Collect"),
    numberOfOriginals: overrides.numberOfOriginals ?? 3,
    shippedOnBoardDate: overrides.shippedOnBoardDate || new Date().toISOString(),
    placeOfIssue: overrides.placeOfIssue || "Kolkata",
    bookingRef: voyage.bookingRef || booking?.id || "",
  };
}

// Draws the boxed HBL layout onto `doc`. `meta` is { number, issuedAt } —
// pass a blank number/"—" for a draft preview.
export function renderHbl(doc, payload, meta = {}) {
  let y = letterhead(doc, { title: "HOUSE BILL OF LADING" });

  const halfW = (doc.internal.pageSize.getWidth() - MARGIN * 2 - 8) / 2;
  const boxTop = y + 6;
  const shipperH = partyBlock(doc, MARGIN, boxTop, halfW, 60, "Shipper", payload.shipper);
  const consigneeH = partyBlock(doc, MARGIN + halfW + 8, boxTop, halfW, 60, "Consignee", payload.consignee);
  y = boxTop + Math.max(shipperH, consigneeH) + 8;

  const notifyH = partyBlock(doc, MARGIN, y, halfW * 2 + 8, 44, "Notify Party", payload.notifyParty);
  y += notifyH + 10;

  const fullW = doc.internal.pageSize.getWidth() - MARGIN * 2;
  y = kvTable(doc, MARGIN, y, fullW, [
    ["Vessel / Voyage No", `${payload.vessel || "—"} / ${payload.voyageNo || "—"}`],
    ["Port of Loading", payload.pol],
    ["Port of Discharge", payload.pod],
    ["Place of Receipt", payload.placeOfReceipt],
    ["Place of Delivery", payload.placeOfDelivery],
    ["Container No / Seal No", `${payload.containerNo} / ${payload.sealNo}${payload.sealNo2 ? ", " + payload.sealNo2 : ""}`],
  ]);
  y += 10;

  y = cargoTable(
    doc,
    MARGIN,
    y,
    fullW,
    payload.cargoLines,
    CARGO_COLUMNS,
    (l) => [l.marks, l.packages, l.description, l.grossKg, l.cbm ?? "—"],
    {
      pageBottom: PAGE_BOTTOM,
      onNewPage: (d) => letterhead(d, { title: "HOUSE BILL OF LADING (contd.)" }),
    }
  );
  y += 10;

  if (y + 60 > PAGE_BOTTOM) {
    doc.addPage();
    y = letterhead(doc, { title: "HOUSE BILL OF LADING (contd.)" });
  }
  y = kvTable(doc, MARGIN, y, fullW, [
    ["Total Gross Weight", `${payload.totalGrossKg} kg`],
    ["Freight Terms", payload.freightTerm],
    ["Shipped on Board", fmtIST(payload.shippedOnBoardDate)],
    ["Booking Ref", payload.bookingRef || "—"],
  ]);
  y += 12;

  terms(doc, MARGIN, y, fullW, HBL_TERMS);

  docFooter(doc, {
    number: meta.number || "DRAFT",
    issuedAt: meta.issuedAt || new Date().toISOString(),
    place: payload.placeOfIssue,
    originals: payload.numberOfOriginals,
  });
}

export function generateHblPdf(payload, meta = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  renderHbl(doc, payload, meta);
  return doc.output("blob");
}
