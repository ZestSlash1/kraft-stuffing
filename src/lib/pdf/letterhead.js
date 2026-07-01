import { MARGIN, INK, STEEL } from "./shared";

// Company block + document title for formal boxed documents (HBL / AN / DO).
// Unlike the packing list header, this is the neutral-NVOCC letterhead used
// across all three document types. Returns the y to continue drawing from.
export function letterhead(doc, { title }) {
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(...INK);
  doc.text("KRAFT SHIPPING & LOGISTICS PVT. LTD.", MARGIN, 44);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...STEEL);
  doc.text("Kolkata, West Bengal, India — NVOCC (Non-Vessel Operating Common Carrier)", MARGIN, 56);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...INK);
  doc.text(title, pageWidth - MARGIN, 44, { align: "right" });

  doc.setDrawColor(...INK);
  doc.setLineWidth(1);
  doc.line(MARGIN, 66, pageWidth - MARGIN, 66);

  return 78;
}
