import { INK, STEEL, fmtIST, num } from "./shared";

// Place & date of issue, document number, originals count, signatory line —
// drawn on the last page only (caller decides which page is last).
export function docFooter(doc, { number, issuedAt, place, originals, signatory }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const y = 760;

  doc.setDrawColor(...STEEL);
  doc.setLineWidth(0.6);
  doc.line(40, y, pageWidth - 40, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...STEEL);
  doc.text(`Place of issue: ${num(place)}`, 40, y + 14);
  doc.text(`Date of issue: ${fmtIST(issuedAt)}`, 40, y + 26);
  if (originals != null) doc.text(`Number of originals: ${num(originals)}`, 40, y + 38);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text(`Document No: ${num(number)}`, pageWidth - 40, y + 14, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...STEEL);
  doc.text(signatory || "For Kraft Shipping & Logistics Pvt. Ltd. — Authorised Signatory", pageWidth - 40, y + 38, {
    align: "right",
  });
}
