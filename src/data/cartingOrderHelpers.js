// Pure aggregation for the Export Carting Order — no writes, no side effects.
// The live on-screen preview AND the PDF generator both call these functions so
// the header summary math exists in exactly one place.
//
// A "cartingContainer" here is the app-shaped carting-order container line:
//   { slNo, containerNo, sizeType, cargoGrWtKgs, tareWtKgs, vgmWtKgs, valuePaise }
// Cargo content comes from container_cargo_items (via stuffingContainersByNo lookup),
// NOT from a cargoType/packageLines field on the carting container itself.

// Concatenate package lines for each container contribution, preserving each
// item entry un-summed (mirrors the reference PDF "471 PC, 45 PKGs").
function mergePackageLines(contributions) {
  const out = [];
  for (const c of contributions || []) {
    for (const line of c.packageLines || []) {
      const qty = Number(line?.qty || 0);
      const unit = (line?.unit ?? "").toString();
      if (!unit.trim() && !qty) continue;
      out.push({ qty, unit });
    }
  }
  return out;
}

// Group cargo items across all carting containers → one summary block per
// unique cargo description. A container with multiple cargo items contributes
// to multiple groups. Weight + value are attributed to the FIRST cargo item's
// group only (to avoid double-counting); subsequent groups get package info only.
//
// stuffingContainersByNo: { "ABCD1234567": container } — from voyage.containers,
//   keyed by container number in upper case. Provide this so the function can
//   read each container's cargoItems.
//
// Returns: [{ description, cargoType, grWtTotalKgs, valuePaiseTotal,
//             packageLines, mixedValueContainers }]
export function groupByCargoDescription(cartingContainers, stuffingContainersByNo = {}) {
  const order = [];
  const groups = new Map();

  for (const c of cartingContainers || []) {
    const stuffing =
      stuffingContainersByNo[(c.containerNo || "").trim().toUpperCase()] || null;
    const cargoItems = (stuffing?.cargoItems || [])
      .slice()
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

    const isMultiCargo = cargoItems.length > 1;
    const valuePaise = Number(c.valuePaise || 0);
    const grWt = Number(c.cargoGrWtKgs || 0);

    if (cargoItems.length === 0) {
      // Container has no cargo items declared — place in a blank group.
      const key = "__unset__";
      if (!groups.has(key)) {
        groups.set(key, { description: "", items: [] });
        order.push(key);
      }
      groups.get(key).items.push({
        ...c,
        packageLines: [],
        attributedValue: valuePaise,
        attributedGrWt: grWt,
        multiValueNote: null,
      });
      continue;
    }

    cargoItems.forEach((item, idx) => {
      const key = item.description.trim().toLowerCase();
      if (!groups.has(key)) {
        groups.set(key, { description: item.description, items: [] });
        order.push(key);
      }
      const isFirst = idx === 0;
      groups.get(key).items.push({
        ...c,
        packageLines: item.qty != null ? [{ qty: item.qty, unit: item.unit }] : [],
        attributedValue: isFirst ? valuePaise : 0,
        attributedGrWt: isFirst ? grWt : 0,
        multiValueNote: isMultiCargo && isFirst ? c.containerNo : null,
      });
    });
  }

  return order.map((key) => {
    const { description, items } = groups.get(key);
    const mixedValueContainers = items
      .filter((i) => i.multiValueNote)
      .map((i) => i.containerNo)
      .filter(Boolean);
    return {
      description,
      cargoType: description, // alias for backward-compat with PDF generator + snapshot
      grWtTotalKgs: items.reduce((a, c) => a + (c.attributedGrWt ?? Number(c.cargoGrWtKgs || 0)), 0),
      valuePaiseTotal: items.reduce((a, c) => a + (c.attributedValue ?? Number(c.valuePaise || 0)), 0),
      packageLines: mergePackageLines(items),
      mixedValueContainers,
    };
  });
}

// Legacy alias — used by buildCartingOrderPayload when replaying an issued
// snapshot that has no stuffingContainersByNo context. Containers in the
// snapshot carry their cargo info inline (frozen at issue time).
export function groupByCargoType(containers) {
  return groupByCargoDescription(containers, {});
}

// Order-wide container count by size/type — "1X20" or "2X20, 1X40".
// Spans ALL containers regardless of cargo description.
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
