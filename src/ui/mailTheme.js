// src/ui/mailTheme.js — light, blue-accented, consumer-mail aesthetic. Mail views only.
// Do NOT import this in any non-mail view; do NOT add these values to src/ui/theme.js.

export const MC = {
  canvas:     '#f0f4ff',   // blue-tinted soft background
  canvasAlt:  '#eaeffa',
  surface:    '#ffffff',
  border:     '#e2e8f5',
  hair:       '#eceef6',

  ink:        '#1a1d24',
  inkDim:     '#6b7280',
  inkFaint:   '#9aa1ab',

  blue:       '#2f6bff',
  blueSoft:   '#eaf0ff',
  blueDeep:   '#1f4fd6',

  tagWork:    '#f4ead9',
  tagWorkInk: '#8a6a3a',

  danger:     '#e5484d',
  success:    '#12b886',
};

export const MR = { chip: 10, card: 18, pill: 999, panel: 20 };
export const MSP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

export const MF = {
  body: `'Inter', system-ui, sans-serif`,
  mono: `'JetBrains Mono', ui-monospace, monospace`,
};

// Gradient surfaces — the "gradient look" across white sections.
export const MG = {
  // Page-level wash: deep blue corner → soft lavender → near-white
  page:    'linear-gradient(145deg, #e8eeff 0%, #f3f5ff 40%, #f8f9ff 100%)',
  // Card gradient: crisp white top → barely-blue base
  card:    'linear-gradient(160deg, #ffffff 0%, #f4f7ff 100%)',
  // Sidebar gradient: white top → soft periwinkle bottom
  sidebar: 'linear-gradient(180deg, #ffffff 0%, #eef2ff 100%)',
  // Reading pane: cool white → faint blue-grey
  pane:    'linear-gradient(170deg, #ffffff 0%, #f2f5ff 100%)',
  // Active row: crisp blue-white gradient
  activeRow: 'linear-gradient(90deg, #eaf0ff 0%, #f0f5ff 100%)',
  // CTA button: vivid blue gradient
  cta:     'linear-gradient(135deg, #3b78ff 0%, #2357e8 100%)',
  // Header bar gradient
  header:  'linear-gradient(180deg, #ffffff 0%, #f6f8ff 100%)',
};

export const mailCard = (radius = MR.card) => ({
  background: MG.card,
  border: `1px solid ${MC.border}`,
  borderRadius: radius,
  boxShadow: '0 1px 3px rgba(30,60,180,0.06), 0 8px 32px -8px rgba(30,60,180,0.10)',
});

export const mailPill = (active) => ({
  borderRadius: MR.pill,
  padding: `${MSP.xs}px ${MSP.lg}px`,
  font: `600 13px ${MF.body}`,
  background: active ? MG.cta : MC.surface,
  color: active ? '#fff' : MC.inkDim,
  border: active ? 'none' : `1px solid ${MC.border}`,
  cursor: 'pointer',
  boxShadow: active ? '0 4px 14px rgba(47,107,255,0.30)' : 'none',
});

export const tagChip = (variant = 'new') => ({
  new:  { background: MC.blueSoft, color: MC.blueDeep },
  work: { background: MC.tagWork,  color: MC.tagWorkInk },
}[variant] ?? { background: MC.canvasAlt, color: MC.inkDim });

// Shared capability list — single source of truth for toolbar + context menu.
export const MAIL_ACTIONS = [
  { key: 'reply', label: 'Reply', shortLabel: 'Reply' },
  // Forward, delete, archive, star have no API endpoint — omitted entirely.
];
