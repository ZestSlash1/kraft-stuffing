import { jsPDF } from "jspdf";

const MARGIN = 40;
const INK = [10, 16, 32];
const STEEL = [100, 116, 139];
const SHADE = [13, 24, 40];
const HEADER_TOP = 36;
const CONTENT_TOP = 78;
const FOOTER_Y = 805;

const fmtIST = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
};

const num = (v) => (v == null || v === "" ? "—" : String(v));

function drawHeader(doc, voyage) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...INK);
  doc.text("PACKING LIST", MARGIN, HEADER_TOP);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...STEEL);
  const right = `${voyage.voyageNo || ""} / ${voyage.vessel || ""}`;
  doc.text(right, doc.internal.pageSize.getWidth() - MARGIN, HEADER_TOP - 4, { align: "right" });

  doc.setDrawColor(...STEEL);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, HEADER_TOP + 12, doc.internal.pageSize.getWidth() - MARGIN, HEADER_TOP + 12);
}

function drawVoyageDetails(doc, voyage, y) {
  const pairs = [
    ["POL", voyage.pol],
    ["POD", voyage.pod],
    ["ETD", voyage.etd ? fmtIST(voyage.etd) : "—"],
    ["Booking Ref", voyage.bookingRef],
    ["BL No", voyage.blNo],
    ["CHA", voyage.chaName],
  ];
  const colW = (doc.internal.pageSize.getWidth() - MARGIN * 2) / 2;
  doc.setFontSize(9);
  let cursor = y;
  for (let i = 0; i < pairs.length; i += 2) {
    [0, 1].forEach((j) => {
      const pair = pairs[i + j];
      if (!pair) return;
      const x = MARGIN + j * colW;
      doc.setFont("courier", "bold");
      doc.setTextColor(...STEEL);
      doc.text(pair[0].toUpperCase(), x, cursor);
      doc.setFont("courier", "normal");
      doc.setTextColor(...INK);
      doc.text(num(pair[1]), x + 80, cursor);
    });
    cursor += 16;
  }
  cursor += 4;
  doc.setDrawColor(...STEEL);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, cursor, doc.internal.pageSize.getWidth() - MARGIN, cursor);
  return cursor + 18;
}

const CONTAINER_COLS = [
  ["No", 70],
  ["Size", 36],
  ["Seal", 70],
  ["Tare", 50],
  ["Net", 50],
  ["Gross", 50],
  ["VGM", 60],
];

const LINE_COLS = [
  ["Cargo", 80],
  ["Qty", 40],
  ["Unit", 50],
  ["Unit Wt (kg)", 64],
  ["Total Wt (kg)", 70],
  ["Shipper", 90],
  ["Consignee", 90],
  ["Invoice Nos", 90],
];

function drawContainerHeader(doc, c, y) {
  const w = doc.internal.pageSize.getWidth() - MARGIN * 2;
  doc.setFillColor(...SHADE);
  doc.rect(MARGIN, y, w, 18, "F");

  const netKg = c.lines.reduce((a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0), 0);
  const tareKg = Number(c.tareWeightKg || 0);
  const grossKg = netKg + tareKg;
  const values = [c.number || "Unassigned", c.size, c.sealNo || "—", tareKg, netKg, grossKg, grossKg];

  doc.setFont("courier", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  let x = MARGIN + 4;
  CONTAINER_COLS.forEach(([label, colWidth], i) => {
    doc.text(`${label}: ${num(values[i])}`, x, y + 12);
    x += colWidth;
  });
  return y + 18 + 6;
}

function drawLineRow(doc, l, y) {
  const values = [
    l.cargo,
    l.qty,
    l.unit || "Bags",
    l.unitWeightKg,
    Number(l.qty || 0) * Number(l.unitWeightKg || 0),
    l.shipper,
    l.consignee,
    (l.invoiceNos || []).join("|"),
  ];
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK);
  let x = MARGIN + 4;
  LINE_COLS.forEach(([, colWidth], i) => {
    const text = String(num(values[i])).slice(0, Math.floor(colWidth / 4.2));
    doc.text(text, x, y);
    x += colWidth;
  });
}

function drawFooter(doc, voyageNo, dateStr, page, total) {
  doc.setFont("courier", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...STEEL);
  const text = `Voyage ${voyageNo || ""} — Page ${page} of ${total} — Generated ${dateStr}`;
  doc.text(text, doc.internal.pageSize.getWidth() / 2, FOOTER_Y, { align: "center" });
}

export function generatePackingList(voyage, containers) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageBottom = FOOTER_Y - 24;

  drawHeader(doc, voyage);
  let y = drawVoyageDetails(doc, voyage, CONTENT_TOP);

  const list = containers || voyage.containers || [];

  list.forEach((c) => {
    const rowsNeeded = Math.max(1, c.lines.length);
    const sectionHeight = 24 + rowsNeeded * 14;
    if (y + sectionHeight > pageBottom) {
      doc.addPage();
      drawHeader(doc, voyage);
      y = CONTENT_TOP;
    }

    y = drawContainerHeader(doc, c, y);

    if (c.lines.length === 0) {
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...STEEL);
      doc.text("No cargo logged.", MARGIN + 4, y);
      y += 14;
    } else {
      c.lines.forEach((l) => {
        if (y > pageBottom) {
          doc.addPage();
          drawHeader(doc, voyage);
          y = CONTENT_TOP;
        }
        drawLineRow(doc, l, y);
        y += 14;
      });
    }
    y += 10;
  });

  const total = doc.getNumberOfPages();
  const dateStr = fmtIST(new Date().toISOString());
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, voyage.voyageNo, dateStr, p, total);
  }

  const fileDate = new Date().toISOString().slice(0, 10);
  doc.save(`PackingList_${voyage.voyageNo || "voyage"}_${fileDate}.pdf`);
}
