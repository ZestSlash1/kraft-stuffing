// ─────────────────────────────────────────────────────────────────────────────
// expenseHelpers.js — category list + display formatters for the Expenses
// section. Live data comes from lib/db.js (fetchExpenses / createExpense /
// updateExpense / deleteExpense); this file only holds presentation helpers.
// ─────────────────────────────────────────────────────────────────────────────

// Category list — kept client-side rather than a master table (categories are
// a small fixed set, same as the `cargo` field on stuffing_lines).
export const CATEGORIES = [
  { name: "Port Charges", type: "expense" },
  { name: "CHA / Documentation", type: "expense" },
  { name: "Transport / Trucks", type: "expense" },
  { name: "Labour", type: "expense" },
  { name: "Freight Income", type: "income" },
  { name: "Other Income", type: "income" },
  { name: "Miscellaneous", type: "expense" },
];

export const categoryType = (name) =>
  CATEGORIES.find((c) => c.name === name)?.type || "expense";

// ── Money helpers ───────────────────────────────────────────────────────────
// All amounts are stored as integer paise. Display divides by 100.
export const fmtPaise = (paise) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Math.round(Number(paise || 0) / 100)
  );

// "DD/MM" short stamp for dense rows; "DD MMM YYYY" for group headers.
export const fmtDay = (iso) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export const fmtDateHeader = (iso) => {
  const d = new Date(iso);
  return d
    .toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    .toUpperCase();
};

// ── Voyage P&L (Phase 6) ─────────────────────────────────────────────────────
// Because the ledger already holds both income and expense rows, tagging each
// row with a voyage_id turns "expenses" into a per-voyage P&L. All math stays in
// integer paise; format to ₹ only at render via fmtPaise.
//
// revenue = Σ income rows · cost = Σ expense rows · margin = revenue − cost.
export const pnlOf = (rows = []) => {
  let revenue = 0;
  let cost = 0;
  for (const e of rows) {
    if (e.type === "income") revenue += Number(e.amount || 0);
    else cost += Number(e.amount || 0);
  }
  const margin = revenue - cost;
  // Guard divide-by-zero: margin % is undefined with no revenue.
  const marginPct = revenue > 0 ? (margin / revenue) * 100 : null;
  return { revenue, cost, margin, marginPct };
};

// One roll-up row per voyage that has ≥1 tagged entry, newest voyage first.
// `voyages` are the camelCase app-shaped rows (id, vessel, voyageNo).
export const voyagePnlRows = (expenses = [], voyages = []) => {
  const byVoyage = new Map();
  for (const e of expenses) {
    if (!e.voyageId) continue;
    if (!byVoyage.has(e.voyageId)) byVoyage.set(e.voyageId, []);
    byVoyage.get(e.voyageId).push(e);
  }
  return voyages
    .filter((v) => byVoyage.has(v.id))
    .map((v) => ({
      voyageId: v.id,
      vessel: v.vessel,
      voyageNo: v.voyageNo,
      label: `${v.vessel || "—"} · ${v.voyageNo || "—"}`,
      ...pnlOf(byVoyage.get(v.id)),
    }));
};

// Summed P&L of every entry with no voyage_id — surfaced as an "Untagged" row so
// nothing silently drops out of the totals. null when there are no such rows.
export const untaggedPnl = (expenses = []) => {
  const rows = expenses.filter((e) => !e.voyageId);
  return rows.length ? pnlOf(rows) : null;
};

// Cost (expense) rows grouped by category for one voyage's stacked breakdown.
export const voyageCostByCategory = (expenses = [], voyageId) => {
  const byCat = {};
  for (const e of expenses) {
    if (e.voyageId !== voyageId || e.type !== "expense") continue;
    byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0);
  }
  return Object.entries(byCat)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
};

// "42.5%" / "—" (no revenue). One decimal, matches the dense mono aesthetic.
export const fmtPct = (pct) => (pct == null ? "—" : `${pct.toFixed(1)}%`);
