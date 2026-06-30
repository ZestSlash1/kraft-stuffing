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
