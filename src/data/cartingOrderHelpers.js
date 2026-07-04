// Pure aggregation for the Export Carting Order — no writes, no side effects.
// The live on-screen preview AND the PDF generator both call these functions so
// the header summary math exists in exactly one place.
//
// A "container" here is the app-shaped carting-order container line:
//   { slNo, containerNo, sizeType, cargoGrWtKgs, tareWtKgs, vgmWtKgs,
//     cargoType, valuePaise, packageLines: [{ qty, unit }] }

// Concatenate every package line across a group's containers, in first-seen
// order, WITHOUT collapsing entries that share a unit. This mirrors the
// reference doc exactly ("471 PC, 45 PKGs, 18 PKGs" — the two PKGs entries stay
// separate), which the acceptance test requires to match line-for-line.
//
// NOTE: Section 3 of the spec is internally contradictory here — it also says
// to "sum matching units". We preserve entries because the reference PDF (the
// stated ground truth for acceptance #1) shows them un-summed. If cross-
// container same-unit summing is ever desired, it belongs behind an explicit
// option, not as the default that would break the reference reproduction.
function mergePackageLines(containers) {
  const out = [];
  for (const c of containers || []) {
    for (const line of c.packageLines || []) {
      const qty = Number(line?.qty || 0);
      const unit = (line?.unit ?? "").toString();
      if (!unit.trim() && !qty) continue;
      out.push({ qty, unit });
    }
  }
  return out;
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
