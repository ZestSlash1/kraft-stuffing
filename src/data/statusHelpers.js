export const TOKENS = {
  bg: "var(--void, #030508)",
  surface: "var(--surface, #0a1020)",
  border: "var(--border, #102030)",
  amber: "var(--amber, #e8930a)",
  green: "var(--green, #0b6b50)",
  red: "#ef4444",
  steel: "var(--steel, #8a9aaa)",
  mono: "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)",
  condensed: "var(--font-condensed, 'Barlow Condensed', system-ui, sans-serif)",
};

// Bold, flat, "shipping-container paint job" palette — high-saturation hulls
// with a lighter ridge tone for the corrugation pass and a glow accent.
export const CONTAINER_COLORS = {
  EMPTY: { hull: "#16191f", stripe: "#262b34", accent: "#9aa7b5", text: "#f2f5f8" },
  STUFFING: { hull: "#c2780a", stripe: "#d68b14", accent: "#ffd28a", text: "#1a1206" },
  FULL: { hull: "#c9560f", stripe: "#dc6618", accent: "#ffb066", text: "#1a0e04" },
  OVER: { hull: "#b81f1f", stripe: "#cc2828", accent: "#ff8a8a", text: "#1a0606" },
  SEALED: { hull: "#0c4f8a", stripe: "#1463a8", accent: "#7ec4ff", text: "#eef7ff" },
};

export const CARGO_COLORS = {
  Potato: "#c4a35a",
  Onion: "#7a5c2a",
  Rice: "#e0d8b8",
  Garlic: "#e8e0cc",
  Sugar: "#f0ead8",
  default: "#8b7355",
};

export function containerStatus(c) {
  const bags = c.lines.reduce((a, l) => a + Number(l.qty || 0), 0);
  if (c.sealed) return "SEALED";
  if (bags === 0) return "EMPTY";
  if (bags > c.capacityBags) return "OVER";
  if (bags >= c.capacityBags) return "FULL";
  return "STUFFING";
}

export function containerFillPct(c) {
  const bags = c.lines.reduce((a, l) => a + Number(l.qty || 0), 0);
  return c.capacityBags > 0 ? Math.min(1, bags / c.capacityBags) : 0;
}

// ── Voyage helpers ────────────────────────────────────────────────────────────
export const VOYAGE_STATUS_COLORS = {
  DRAFT: TOKENS.steel,
  LOADING: TOKENS.amber,
  COMPLETED: TOKENS.green,
  ARCHIVED: "#475569",
};

export const VOYAGE_STATUS_CYCLE = ["DRAFT", "LOADING", "COMPLETED", "ARCHIVED"];

// Aggregate container/bag/MT/sealed counts for one voyage.
export function voyageStats(voyage) {
  const containers = voyage?.containers || [];
  let bags = 0;
  let mt = 0;
  let sealed = 0;
  for (const c of containers) {
    for (const l of c.lines || []) {
      bags += Number(l.qty || 0);
      mt += (Number(l.qty || 0) * Number(l.unitWeightKg || 0)) / 1000;
    }
    if (c.sealed) sealed += 1;
  }
  return { bags, mt, sealed, total: containers.length };
}

// "just now" | "5m ago" | "2h ago" | "yesterday" | "12 Jun"
export function timeAgo(iso) {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days === 1) return "yesterday";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short" }).format(new Date(then));
}

export function greeting(d = new Date()) {
  const h = d.getHours();
  if (h < 12) return "MORNING";
  if (h < 17) return "AFTERNOON";
  return "EVENING";
}

// Format a UTC ISO timestamp as IST (UTC+5:30) — "25 Jun 2026, 14:32 IST".
export function formatIST(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const formatted = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${formatted} IST`;
}
