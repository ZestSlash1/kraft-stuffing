import { jsPDF } from "jspdf";
import {
  groupByCargoDescription,
  containerCountSummary,
  formatPackageLines,
} from "../../data/cartingOrderHelpers";
import { formatKg2, formatRupees2, formatDDMMYY } from "../format";

// Pixel-faithful replica of the port DDMO "Export Carting Order" form
// (reference: ILCU 1002028). Unlike the app's other documents, this form is a
// plain black Times-serif letter on the Kraft letterhead — NOT the house
// helvetica/boxed style — so it is built from scratch here rather than on the
// shared pdf helpers.

const RED = [200, 16, 46]; // Kraft wordmark red
const GOLD = [242, 194, 0]; // letterhead underline
const GREY = [240, 240, 240]; // letterhead box fill
const BLACK = [0, 0, 0];

const SHIPPER = "KRAFT SHIPPING & LOGISTICS PVT LTD";
const ADDRESS =
  "P-15, LU SHUN SARANI, 3RD FLOOR, KOLKATA - 700 073, WEST BENGAL, INDIA,  TEL. : 033 4803 9816";

// ── Logo: fetched once, cached as a data URL for synchronous addImage ─────────
let _logoPromise = null;
export function loadKraftLogo() {
  if (_logoPromise) return _logoPromise;
  _logoPromise = fetch("/kraft-logo.png")
    .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("logo"))))
    .then(
      (blob) =>
        new Promise((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result);
          fr.onerror = rej;
          fr.readAsDataURL(blob);
        })
    )
    .catch(() => null);
  return _logoPromise;
}

// Build the frozen render payload from live order + voyage + container lines —
// snapshotted verbatim on issue so the draft preview and issued PDF are identical.
// stuffingContainersByNo: { "ABCD1234567": container } — keyed by container number
// in upper case. Provide from voyage.containers so cargo items are included.
export function buildCartingOrderPayload(order, voyage, containers, stuffingContainersByNo = {}) {
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
    portCode: order.portCode || "KPD/KOLKATA",
    shipper: SHIPPER,
    containerCount: containerCountSummary(containers),
    groups: groupByCargoDescription(containers, stuffingContainersByNo).map((g) => ({
      cargoType: g.cargoType,      // description alias — used by the PDF renderer below
      grWtTotalKgs: g.grWtTotalKgs,
      valuePaiseTotal: g.valuePaiseTotal,
      packageLines: g.packageLines,
    })),
    rows,
  };
}

// Draw inline runs [{ t, bold }] on one baseline (Times); returns end x.
function runs(doc, x, y, parts, size = 12) {
  doc.setFontSize(size);
  doc.setTextColor(...BLACK);
  let cx = x;
  for (const p of parts) {
    doc.setFont("times", p.bold ? "bold" : "normal");
    doc.text(p.t, cx, y);
    cx += doc.getTextWidth(p.t);
  }
  return cx;
}

export function renderCartingOrder(doc, payload, meta = {}) {
  const pageW = doc.internal.pageSize.getWidth();
  const M = 40;
  const rightX = 360; // start of the DT / POL / POD column

  // ── Letterhead ──────────────────────────────────────────────────────────────
  const boxX = 60, boxY = 42, boxW = 470, boxH = 72;
  doc.setFillColor(...GREY);
  doc.rect(boxX, boxY, boxW, boxH, "F");
  if (meta.logoDataUrl) {
    try {
      doc.addImage(meta.logoDataUrl, "PNG", boxX + 8, boxY + 8, 56, 56);
    } catch {
      /* logo optional — proceed without it */
    }
  }
  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...RED);
  doc.text("Kraft Shipping and Logistics Pvt. Ltd.", boxX + 78, boxY + 40);
  doc.setFont("times", "bold");
  doc.setFontSize(7.2);
  doc.setTextColor(...BLACK);
  doc.text(ADDRESS, boxX + 78, boxY + 54);
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(2.6);
  doc.line(boxX + 78, boxY + 59, boxX + 452, boxY + 59);

  // ── TO / DT / POL / POD block ───────────────────────────────────────────────
  const lh = 16;
  let y = 180;
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...BLACK);
  const toLines = ["TO", "The D.D.M.O", "K.P.D.", "SYAMA PARASAD MOOKERJEE PORT", "Kolkata"];
  toLines.forEach((t, i) => doc.text(t, M, y + i * lh));
  doc.text(`DT: ${formatDDMMYY(payload.orderDate)}.`, rightX, y);
  doc.text(`POL : ${payload.pol}`, rightX, y + 3 * lh);
  doc.text(`POD: ${payload.pod}`, rightX, y + 4 * lh);
  y += 4 * lh;

  // ── Gr. WT / package / cargo + VALUE ────────────────────────────────────────
  y += 30;
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  (payload.groups || []).forEach((g) => {
    const pkgs = formatPackageLines(g.packageLines);
    const line =
      `Gr. WT.${formatKg2(g.grWtTotalKgs)} KGS,  ` +
      (pkgs ? `${pkgs}  ` : "") +
      `CARGO: ${g.cargoType}.`;
    const wrapped = doc.splitTextToSize(line, pageW - M * 2);
    doc.text(wrapped, M, y);
    y += wrapped.length * 15 + 3;
    doc.text(`VALUE   :   RS. ${formatRupees2(g.valuePaiseTotal)}`, M, y);
    y += 24;
  });

  // ── Booking No (label bold + underlined) ────────────────────────────────────
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  const bLabel = "Booking No:";
  doc.text(bLabel, M, y);
  const bW = doc.getTextWidth(bLabel);
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.7);
  doc.line(M, y + 1.5, M + bW, y + 1.5);
  doc.text(` ${payload.bookingNo || "—"}`, M + bW, y);
  y += 26;

  // ── Centered title ──────────────────────────────────────────────────────────
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text(`Export Carting Order for ${payload.portCode}`, pageW / 2, y, { align: "center" });
  y += 16;

  // ── Please allow … (mixed bold) ─────────────────────────────────────────────
  runs(doc, M, y, [
    { t: "Please allow    " },
    { t: payload.containerCount || "—", bold: true },
    { t: " , house stuffed export containers per  M.V. " },
    { t: payload.vessel || "—", bold: true },
    { t: "   VOY No: ", bold: true },
    { t: payload.voyageNo || "—", bold: true },
  ], 11.5);
  y += 16;

  // ── Rotation / VCN / till ───────────────────────────────────────────────────
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  const rotDt = payload.rotationDate ? formatDDMMYY(payload.rotationDate) : "—";
  doc.text(
    `.EXP.Rot No.  ${payload.rotationNo || "—"} Dt. ${rotDt}  VCN: ${payload.vcn || "—"}  , UPTO  ${payload.tillText}`,
    M,
    y
  );
  y += 24;

  // ── Shipper ─────────────────────────────────────────────────────────────────
  doc.setFont("times", "bold");
  doc.setFontSize(12);
  doc.text(`SHIPPER : ${payload.shipper}`, M, y);
  y += 18;

  // ── Container table (bordered, min 8 rows like the reference) ────────────────
  drawTable(doc, M, y, pageW - M * 2, payload.rows || []);
}

function drawTable(doc, x, y, w, rows) {
  const cols = [
    { w: 42, head: ["Sl.", "NO."], align: "center" },
    { w: 138, head: ["Container Nos."], align: "left" },
    { w: 66, head: ["Size /", "Type"], align: "center" },
    { w: 95, head: ["Cargo Gr.", "Wt. (KGS)"], align: "left" },
    { w: 87, head: ["Tare WT.", "(KGS)"], align: "left" },
    { w: 87, head: ["VGM WT", "(KGS)"], align: "left" },
  ];
  const total = cols.reduce((a, c) => a + c.w, 0);
  const scale = w / total;
  cols.forEach((c) => (c.w *= scale));

  const headH = 40;
  const rowH = 30;
  const minRows = 8;
  const bodyRows = Math.max(minRows, rows.length);

  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.8);

  // Header
  doc.rect(x, y, w, headH);
  doc.setFont("times", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...BLACK);
  let cx = x;
  cols.forEach((c) => {
    if (cx > x) doc.line(cx, y, cx, y + headH); // column divider
    const lines = c.head;
    const startY = y + (headH - (lines.length - 1) * 12) / 2 + 4;
    lines.forEach((t, i) => {
      const tx = c.align === "center" ? cx + c.w / 2 : cx + 6;
      doc.text(t, tx, startY + i * 12, c.align === "center" ? { align: "center" } : undefined);
    });
    cx += c.w;
  });

  // Body rows
  let ry = y + headH;
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  for (let r = 0; r < bodyRows; r++) {
    doc.rect(x, ry, w, rowH);
    let bx = x;
    const row = rows[r];
    cols.forEach((c, ci) => {
      if (bx > x) doc.line(bx, ry, bx, ry + rowH);
      if (row) {
        const val = cellValue(row, ci);
        if (val !== "") {
          doc.setFont("times", ci === 0 ? "bold" : "normal");
          const cy = ry + 18;
          if (c.align === "center") doc.text(val, bx + c.w / 2, cy, { align: "center" });
          else doc.text(val, bx + 6, cy);
        }
      }
      bx += c.w;
    });
    ry += rowH;
  }
}

function cellValue(row, ci) {
  switch (ci) {
    case 0: return String(row.slNo);
    case 1: return row.containerNo || "";
    case 2: return row.sizeType || "";
    case 3: return formatKg2(row.cargoGrWtKgs);
    case 4: return formatKg2(row.tareWtKgs);
    case 5: return formatKg2(row.vgmWtKgs);
    default: return "";
  }
}

export function generateCartingOrderPdf(payload, meta = {}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  renderCartingOrder(doc, payload, meta);
  return doc.output("blob");
}
