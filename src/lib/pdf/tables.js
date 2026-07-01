import { INK, STEEL, SHADE, num } from "./shared";

// Boxed label/value grid (2 columns of pairs per row) — used for the routing
// band, freight box, etc. `rows` is a flat list of [label, value] pairs.
// Returns the y position just below the box.
export function kvTable(doc, x, y, w, rows) {
  const colW = w / 2;
  const rowH = 18;
  const pairRows = Math.ceil(rows.length / 2);
  const boxHeight = pairRows * rowH + 8;

  doc.setDrawColor(...STEEL);
  doc.setLineWidth(0.6);
  doc.rect(x, y, w, boxHeight);
  doc.line(x + colW, y, x + colW, y + boxHeight);

  let cursor = y + 16;
  for (let i = 0; i < rows.length; i += 2) {
    [0, 1].forEach((j) => {
      const pair = rows[i + j];
      if (!pair) return;
      const cx = x + j * colW + 8;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(...STEEL);
      doc.text(pair[0].toUpperCase(), cx, cursor);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...INK);
      doc.text(num(pair[1]), cx, cursor + 11);
    });
    cursor += rowH;
  }

  return y + boxHeight;
}

// Boxed cargo/particulars grid — header row + one row per line, paginating
// via `onNewPage(doc)` (redraw letterhead etc.) when a row would overflow
// `pageBottom`. `columns` is [[label, width], ...]; `rowsOf(line)` maps a
// cargo line to an array of cell values matching `columns`.
export function cargoTable(doc, x, y, w, lines, columns, rowsOf, { pageBottom, onNewPage } = {}) {
  const rowH = 16;

  function drawHeader(headerY) {
    doc.setFillColor(...SHADE);
    doc.rect(x, headerY, w, rowH, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    let cx = x;
    columns.forEach(([label, colWidth]) => {
      doc.text(label.toUpperCase(), cx + 4, headerY + 11);
      cx += colWidth;
    });
    return headerY + rowH;
  }

  let cursor = drawHeader(y);

  const list = lines?.length ? lines : [null];
  list.forEach((line) => {
    if (pageBottom && cursor + rowH > pageBottom) {
      doc.addPage();
      const top = onNewPage ? onNewPage(doc) : 78;
      cursor = drawHeader(top);
    }

    doc.setDrawColor(...STEEL);
    doc.setLineWidth(0.4);
    doc.rect(x, cursor, w, rowH);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...INK);
    const values = line ? rowsOf(line) : ["No cargo logged.", "", "", "", ""];
    let cx = x;
    columns.forEach(([, colWidth], i) => {
      const text = String(num(values[i])).slice(0, Math.floor(colWidth / 4.2));
      doc.text(text, cx + 4, cursor + 11);
      cx += colWidth;
    });
    cursor += rowH;
  });

  return cursor;
}
