// Pure aggregation for the Export Carting Order — no writes, no side effects.
// The live on-screen preview AND the PDF generator both call these functions so
// the header summary math exists in exactly one place.
//
// A "container" here is the app-shaped carting-order container line:
//   { slNo, containerNo, sizeType, cargoGrWtKgs, tareWtKgs, vgmWtKgs,
//     cargoType, valuePaise, packageLines: [{ qty, unit }] }

// Merge package lines across a group of containers, summing qty for lines that
// share a `unit`, preserving first-seen order. Mirrors the reference doc's
// "471 PC, 45 PKGs, 18 PKGs" — units are matched case-insensitively but the
// first-seen label is kept for display.
function mergePackageLines(containers) {
  const order = [];
  const byUnit = new Map();
  for (const c of containers || []) {
    for (const line of c.packageLines || []) {
      const qty = Number(line?.qty || 0);
      const unit = (line?.unit ?? "").toString();
      const key = unit.trim().toLowerCase();
      if (!key && !qty) continue;
      if (byUnit.has(key)) {
        byUnit.get(key).qty += qty;
      } else {
        const entry = { qty, unit };
        byUnit.set(key, entry);
        order.push(entry);
      }
    }
  }
  return order.map((e) => ({ qty: e.qty, unit: e.unit }));
}

// Group containers by cargo_type (first-seen order) → one summary block each.
// [{ cargoType, grWtTotalKgs, valuePaiseTotal, packageLines }]
export function groupByCargoType(containers) {
  const order = [];
  const groups = new Map();
  for (const c of containers || []) {
    const cargoType = (c.cargoType ?? "").toString();
    const key = cargoType.trim().toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { cargoType, items: [] });
      order.push(key);
    }
    groups.get(key).items.push(c);
  }
  return order.map((key) => {
    const { cargoType, items } = groups.get(key);
    return {
      cargoType,
      grWtTotalKgs: items.reduce((a, c) => a + Number(c.cargoGrWtKgs || 0), 0),
      valuePaiseTotal: items.reduce((a, c) => a + Number(c.valuePaise || 0), 0),
      packageLines: mergePackageLines(items),
    };
  });
}

// Order-wide container count by size/type — "1X20" or "2X20, 1X40".
// Spans ALL containers regardless of cargo type.
export function containerCountSummary(containers) {
  const order = [];
  const counts = new Map();
  for (const c of containers || []) {
    const size = (c.sizeType ?? "").toString().trim() || "20";
    if (!counts.has(size)) {
      counts.set(size, 0);
      order.push(size);
    }
    counts.set(size, counts.get(size) + 1);
  }
  return order.map((size) => `${counts.get(size)}X${size}`).join(", ");
}

// Next 1-indexed sl_no for a freshly added container line.
export function nextSlNo(containers) {
  return (containers?.length || 0) + 1;
}

// Format a merged package-line list as "471 PC, 45 PKGs, 18 PKGs".
export function formatPackageLines(packageLines) {
  return (packageLines || [])
    .map((l) => `${Number(l.qty || 0)} ${l.unit || ""}`.trim())
    .filter(Boolean)
    .join(", ");
}
