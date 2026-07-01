// Shared jsPDF building blocks — colors, date/number formatting, and the
// page-break pattern used by every document generator (packing list, HBL,
// arrival notice, delivery order).

export const MARGIN = 40;
export const INK = [10, 16, 32];
export const STEEL = [100, 116, 139];
export const SHADE = [13, 24, 40];

import { formatAbsolute } from "../format";

export const fmtIST = (iso) => formatAbsolute(iso);

export const num = (v) => (v == null || v === "" ? "—" : String(v));

// Add a page (re-running `onNewPage` to redraw the header) if the next section
// of height `sectionHeight` would overflow past `pageBottom`. Returns the y to
// continue drawing from.
export function pageBreakIfNeeded(doc, y, sectionHeight, pageBottom, onNewPage) {
  if (y + sectionHeight > pageBottom) {
    doc.addPage();
    return onNewPage(doc);
  }
  return y;
}
