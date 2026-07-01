// ─────────────────────────────────────────────────────────────────────────────
// theme.js — Kraft Stuffing Log, LIGHT design system (the new direction)
//
// Single source of truth for the light theme. Import { theme } and read from it;
// never hardcode a hex value in a component. The old dark ops-room tokens live in
// data/statusHelpers.js (TOKENS) and are still used by the not-yet-migrated dark
// screens — do not mix the two. New light work imports from here only.
// ─────────────────────────────────────────────────────────────────────────────

export const theme = {
  color: {
    canvas: "#f6f7f9", // page background
    surface: "#ffffff", // cards, panels
    surfaceMuted: "#f1f3f6", // inset wells, sibling-strip track
    border: "#e6eaf0", // hairlines, dividers
    borderStrong: "#d7dde6", // input borders, focus rings at rest
    ink: "#0f172a", // primary text
    inkSoft: "#334155", // secondary text
    slate: "#64748b", // muted labels, italic spec labels
    slateFaint: "#94a3b8", // placeholder, disabled
    amber: "#e8930a", // primary accent
    amberSoft: "#fdf0d8", // amber tint fill
    green: "#0b6b50", // sealed / confirmed
    greenSoft: "#e2f0ea", // green tint fill
    red: "#dc2626", // over-capacity / error
    redSoft: "#fde4e4", // red tint fill (negative margin, over-capacity)
    white: "#ffffff",
  },

  // Status palette — dot + label colour by container status.
  // fill is a soft tint used behind the badge when emphasised.
  status: {
    EMPTY: { dot: "#94a3b8", label: "#64748b", fill: "#f1f3f6" },
    STUFFING: { dot: "#e8930a", label: "#b3700a", fill: "#fdf0d8" },
    FULL: { dot: "#ea7a0c", label: "#b85f08", fill: "#fdece0" },
    OVER: { dot: "#dc2626", label: "#b91c1c", fill: "#fde4e4" },
    SEALED: { dot: "#0b6b50", label: "#0b6b50", fill: "#e2f0ea" },
  },

  font: {
    condensed: "var(--font-condensed, 'Barlow Condensed', system-ui, sans-serif)",
    mono: "var(--font-mono, 'JetBrains Mono', ui-monospace, monospace)",
    body: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },

  radius: {
    sm: 8,
    input: 12, // Input primitive
    pill: 999, // Pill dropdown
    card: 20, // Card primitive
  },

  // Soft, low-contrast elevation for a clean light surface.
  shadow: {
    card: "0 1px 2px rgba(16,24,40,.06), 0 10px 30px rgba(16,24,40,.06)",
    pill: "0 1px 2px rgba(16,24,40,.05)",
    raised: "0 2px 4px rgba(16,24,40,.06), 0 18px 40px rgba(16,24,40,.10)",
  },

  space: (n) => n * 4, // 4px base scale
};

// Resolve a status key (falls back to EMPTY) → { dot, label, fill }.
export const statusTone = (status) => theme.status[status] || theme.status.EMPTY;

export default theme;
