import { STEEL } from "./shared";

// Small-print terms block. Returns the y position just below the block.
export function terms(doc, x, y, w, text) {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...STEEL);
  const lines = doc.splitTextToSize(text, w);
  doc.text(lines, x, y);
  return y + lines.length * 8;
}
