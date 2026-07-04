import { jsPDF } from "jspdf";
import { MARGIN, INK } from "./shared";
import { letterhead } from "./letterhead";
import { cargoTable } from "./tables";
import { docFooter } from "./footer";
import {
  groupByCargoType,
  containerCountSummary,
  formatPackageLines,
} from "../../data/cartingOrderHelpers";
import { formatKg2, formatRupees2, formatDDMMYY } from "../format";

const SHIPPER = "KRAFT SHIPPING & LOGISTICS PVT LTD";

// Build the frozen render payload from live order + voyage + container lines.
// This is exactly what gets snapshotted on issue, so both the draft preview and
// the issued PDF render from an identical shape.
export function buildCartingOrderPayload(order, voyage, containers) {
  const rows = (containers || [])
    .slice()
    .sort((a, b) => a.slNo - b.slNo)
    .map((c) => ({
      slNo: c.slNo,
      containerNo: c.containerNo,
      sizeType: c.sizeType,
      cargoGrWtKgs: Number(c.cargoGrWtKgs || 0),
      tareWtKgs: Number(c.tareWtKgs || 0),
      vgmWtKgs: Number(c.vgmWtKgs || 0),
    }));

  return {
    orderDate: order.orderDate,
    pol: order.pol,
    pod: order.pod,
    vessel: voyage?.vessel || "",
    voyageNo: voyage?.voyageNo || "",
    rotationNo: order.rotationNo || "",
    rotationDate: order.rotationDate || null,
    vcn: order.vcn || "",
    bookingNo: order.bookingNo || voyage?.bookingRef || "",
    tillText: order.tillText || "Till Finish",
    portCode: `${order.pod || "KPD"}/KOLKATA`.toUpperCase(),
    shipper: SHIPPER,
    containerCount: containerCountSummary(containers),
    groups: groupByCargoType(containers).map((g) => ({
      cargoType: g.cargoType,
      grWtTotalKgs: g.grWtTotalKgs,
      valuePaiseTotal: g.valuePaiseTotal,
      packageLines: g.packageLines,
    })),
    rows,
  };
}

// Draw a sequence of inline runs [{ t, bold }] on one baseline, returning the
// x just past the last run. Lets us bold only specific tokens within a line
// (container count, vessel name) as the reference form does.
function drawRuns(doc, x, y, runs, { size = 9.5 } = {}) {
  doc.setFontSize(size);
  doc.setTextColor(...INK);
  let cx = x;
  for (const run of runs) {
    doc.setFont("helvetica", run.bold ? "bold" : "normal");
    doc.text(run.t, cx, y);
    cx += doc.getTextWidth(run.t);
  }
  return cx;
}

export function renderCartingOrder(doc, payload, meta = {}) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const fullW = pageWidth - MARGIN * 2;
  const rightX = pageWidth - MARGIN;

  let y = letterhead(doc, { title: "EXPORT CARTING ORDER" });
  y += 8;

  // ── 2. Two-column header ────────────────────────────────────────────────────
  const leftTop = y;
  doc.setTextColor(...INK);
  doc.setFontSize(9.5);
  const toLines = [
    "TO",
    "The D.D.M.O",
    "K.P.D.",
    "SYAMA PARASAD MOOKERJEE PORT",
    "Kolkata",
  ];
  toLines.forEach((t, i) => {
    doc.setFont("helvetica", i === 0 ? "bold" : "normal");
    doc.text(t, MARGIN, leftTop + i * 12);
  });

  doc.setFont("helvetica", "bold");
  doc.text(`DT: ${formatDDMMYY(payload.orderDate)}.`, rightX, leftTop, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`POL : ${payload.pol}`, rightX, leftTop + 14, { align: "right" });
  doc.text(`POD: ${payload.pod}`, rightX, leftTop + 26, { align: "right" });

  y = leftTop + toLines.length * 12 + 14;

  // ── 3. Per-cargo-type summary blocks ────────────────────────────────────────
  doc.setTextColor(...INK);
  (payload.groups || []).forEach((g) => {
    const pkgs = formatPackageLines(g.packageLines);
    const line1 =
      `Gr. WT.${formatKg2(g.grWtTotalKgs)} KGS, ` +
      (pkgs ? `${pkgs} ` : "") +
      `CARGO: ${g.cargoType}.`;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const wrapped = doc.splitTextToSize(line1, fullW);
    doc.text(wrapped, MARGIN, y);
    y += wrapped.length * 12;
    doc.text(`VALUE : RS. ${formatRupees2(g.valuePaiseTotal)}`, MARGIN, y);
    y += 16;
  });

  // ── 4. Booking No ───────────────────────────────────────────────────────────
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  const bookingLabel = "Booking No: ";
  doc.text(bookingLabel, MARGIN, y);
  const labelW = doc.getTextWidth(bookingLabel);
  doc.text(payload.bookingNo || "—", MARGIN + labelW, y);
  // underline the label per the reference
  doc.setDrawColor(...INK);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, y + 1.5, MARGIN + labelW - doc.getTextWidth(" "), y + 1.5);
  y += 20;

  // ── 5. Centered title ───────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Export Carting Order for ${payload.portCode}`, pageWidth / 2, y, {
    align: "center",
  });
  y += 20;

  // ── 6. "Please allow …" line (mixed bold) ───────────────────────────────────
  drawRuns(doc, MARGIN, y, [
    { t: "Please allow " },
    { t: payload.containerCount || "—", bold: true },
    { t: ", house stuffed export containers per M.V. " },
    { t: payload.vessel || "—", bold: true },
    { t: ` VOY No: ${payload.voyageNo || "—"}` },
  ]);
  y += 14;

  // ── 7. Rotation / VCN / till line ───────────────────────────────────────────
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  const rotDt = payload.rotationDate ? formatDDMMYY(payload.rotationDate) : "—";
  doc.text(
    `.EXP.Rot No. ${payload.rotationNo || "—"} Dt. ${rotDt} VCN: ${payload.vcn || "—"} , UPTO ${payload.tillText}`,
    MARGIN,
    y
  );
  y += 18;

  // ── 8. Shipper ──────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(`SHIPPER : ${payload.shipper}`, MARGIN, y);
  y += 16;

  // ── 9. Container table ──────────────────────────────────────────────────────
  const columns = [
    ["Sl. NO.", 40],
    ["Container Nos.", 120],
    ["Size / Type", 70],
    ["Cargo Gr. Wt. (KGS)", 110],
    ["Tare WT. (KGS)", 90],
    ["VGM WT (KGS)", 85],
  ];
  const rowsOf = (r) => [
    String(r.slNo),
    r.containerNo,
    r.sizeType,
    formatKg2(r.cargoGrWtKgs),
    formatKg2(r.tareWtKgs),
    formatKg2(r.vgmWtKgs),
  ];
  cargoTable(doc, MARGIN, y, fullW, payload.rows, columns, rowsOf, {
    pageBottom: 720,
    onNewPage: (d) => letterhead(d, { title: "EXPORT CARTING ORDER" }) + 8,
  });

  // ── 10. Footer (shared signature/stamp block) ───────────────────────────────
  docFooter(doc, {
    number: meta.number || "DRAFT",
    issuedAt: meta.issuedAt || new Date().toISOString(),
    place: "Kolkata",
    signatory: "For Kraft Shipping & Logistics Pvt. Ltd. — Authorised Signatory",
  });
}

export function generateCartingOrderPdf(payload, meta = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  renderCartingOrder(doc, payload, meta);
  return doc.output("blob");
}
