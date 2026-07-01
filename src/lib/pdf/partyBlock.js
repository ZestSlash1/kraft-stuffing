import { INK, STEEL, num } from "./shared";

// Boxed Shipper / Consignee / Notify Party block. `party` is
// { name, address, contact }. Returns the box height actually used (may be
// taller than `h` if the address wraps).
export function partyBlock(doc, x, y, w, h, label, party) {
  const pad = 8;
  const lines = doc.splitTextToSize(num(party?.address), w - pad * 2);
  const contentHeight = 14 + 12 + lines.length * 10 + (party?.contact ? 10 : 0) + pad;
  const boxHeight = Math.max(h, contentHeight);

  doc.setDrawColor(...STEEL);
  doc.setLineWidth(0.6);
  doc.rect(x, y, w, boxHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...STEEL);
  doc.text(label.toUpperCase(), x + pad, y + 12);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...INK);
  doc.text(num(party?.name), x + pad, y + 26);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  let ty = y + 38;
  lines.forEach((line) => {
    doc.text(line, x + pad, ty);
    ty += 10;
  });
  if (party?.contact) {
    doc.setTextColor(...STEEL);
    doc.text(`Contact: ${party.contact}`, x + pad, ty);
  }

  return boxHeight;
}
