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
