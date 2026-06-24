export const TOKENS = {
  bg: "#07090e",
  surface: "#0d1520",
  border: "#1c2d42",
  amber: "#f5a623",
  green: "#22c55e",
  red: "#ef4444",
  mono: `ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace`,
};

export const CONTAINER_COLORS = {
  EMPTY: { hull: "#1e3040", emissive: "#000000", label: "#475569" },
  STUFFING: { hull: "#5a3010", emissive: "#201000", label: "#f5a623" },
  FULL: { hull: "#7a3500", emissive: "#301000", label: "#f59e0b" },
  OVER: { hull: "#7a0000", emissive: "#300000", label: "#ef4444" },
  SEALED: { hull: "#0d3a1a", emissive: "#001008", label: "#22c55e" },
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
