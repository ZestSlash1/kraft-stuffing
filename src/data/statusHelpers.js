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

export const CONTAINER_COLORS = {
  EMPTY: { hull: "#2a3441", stripe: "#323e4d", accent: "#64748b", text: "#e2e8f0" },
  STUFFING: { hull: "#8a5a1c", stripe: "#9c6a24", accent: "#ffc861", text: "#1a1206" },
  FULL: { hull: "#9c4a12", stripe: "#ad551a", accent: "#ffb066", text: "#1a0e04" },
  OVER: { hull: "#8c1c1c", stripe: "#9e2424", accent: "#ff7a7a", text: "#1a0606" },
  SEALED: { hull: "#14532d", stripe: "#196336", accent: "#4ade80", text: "#06170c" },
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
