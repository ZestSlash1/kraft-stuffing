// src/ui/mailTheme.js — light, blue-accented, consumer-mail aesthetic. Mail views only.
// Do NOT import this in any non-mail view; do NOT add these values to src/ui/theme.js.

export const MC = {
  canvas:     '#f3f4f6',   // soft neutral background behind cards
  canvasAlt:  '#eef1f5',
  surface:    '#ffffff',   // cards, panes
  border:     '#e6e8ec',
  hair:       '#eceef2',

  ink:        '#1a1d24',
  inkDim:     '#6b7280',
  inkFaint:   '#9aa1ab',

  blue:       '#2f6bff',   // primary accent — badges, active states, CTA
  blueSoft:   '#eaf0ff',   // tag chip / hover background
  blueDeep:   '#1f4fd6',

  tagWork:    '#f4ead9',   // "Work" chip bg (warm neutral, from reference)
  tagWorkInk: '#8a6a3a',

  danger:     '#e5484d',
  success:    '#12b886',
};

export const MR = { chip: 10, card: 18, pill: 999, panel: 20 };
export const MSP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Readable humanist sans for mail body/subject/sender — distinct from the app's
// industrial Barlow Condensed/JetBrains Mono, matching a clean consumer feel.
export const MF = {
  body: `'Inter', system-ui, sans-serif`,
  mono: `'JetBrains Mono', ui-monospace, monospace`,  // timestamps, counts only
};

export const mailCard = (radius = MR.card) => ({
  background: MC.surface,
  border: `1px solid ${MC.border}`,
  borderRadius: radius,
  boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -12px rgba(16,24,40,0.10)',
});

export const mailPill = (active) => ({
  borderRadius: MR.pill,
  padding: `${MSP.xs}px ${MSP.lg}px`,
  font: `600 13px ${MF.body}`,
  background: active ? MC.blue : MC.surface,
  color: active ? '#fff' : MC.inkDim,
  border: active ? 'none' : `1px solid ${MC.border}`,
  cursor: 'pointer',
});

export const tagChip = (variant = 'new') => ({
  new:  { background: MC.blueSoft, color: MC.blueDeep },
  work: { background: MC.tagWork,  color: MC.tagWorkInk },
}[variant] ?? { background: MC.canvasAlt, color: MC.inkDim });

// Shared mail capability list — single source of truth for toolbar + context menu.
// Only actions with a real backend endpoint are enabled: true.
export const MAIL_ACTIONS = [
  { key: 'reply',   label: 'Reply',   shortLabel: 'Reply' },
  // Forward, delete, archive, star — no API endpoint yet, omitted entirely.
];
