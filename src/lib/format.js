// Shared display formatters — the single source for money and timestamp
// rendering. Money is stored as integer paise; divide by 100 only here.

const inr2 = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const inr0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

// "₹1,23,456.00" from integer paise.
export const formatINR = (paise) => `₹${inr2.format(Number(paise || 0) / 100)}`;

// Grouped whole-rupee number, no symbol — dense rows that style ₹ separately.
export const formatINRCompact = (paise) =>
  inr0.format(Math.round(Number(paise || 0) / 100));

// "just now" / "5m ago" / "2h ago" / "3d ago"; past 7 days → "02 Jul" (IST).
export function formatRelative(ts) {
  if (!ts) return "";
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return "";
  const min = Math.floor((Date.now() - then) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
  }).format(then);
}

// ── Carting order formatters ─────────────────────────────────────────────────
// The port's carting-order form prints weights/values as fixed 2-decimal
// numbers WITHOUT thousands separators (matching ILCU_1002028.pdf, e.g.
// "15700.00", "RS. 1500000.00") and dates as "DD.MM.YY" (e.g. "04.07.26").

// Plain 2-decimal weight in KGS, no grouping — "15700.00".
export const formatKg2 = (kg) => Number(kg || 0).toFixed(2);

// Rupees from integer paise, 2 decimals, no grouping — "1500000.00".
export const formatRupees2 = (paise) => (Number(paise || 0) / 100).toFixed(2);

// "DD.MM.YY" in IST from a Date | ISO string | "YYYY-MM-DD".
export function formatDDMMYY(input) {
  if (!input) return "";
  // Bare date strings ("2026-07-04") are parsed as UTC midnight; render the
  // same calendar day rather than shifting into the previous IST day.
  const d = typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)
    ? new Date(`${input}T00:00:00+05:30`)
    : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(d); // "04/07/26"
  return s.replace(/\//g, ".");
}

// "02 Jul 2026, 14:30 IST"
export function formatAbsolute(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${s.replace(/(\d{4}),?/, "$1,")} IST`;
}
