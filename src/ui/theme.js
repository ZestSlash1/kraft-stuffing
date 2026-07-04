// ─────────────────────────────────────────────────────────────────────────────
// src/ui/theme.js — "Loadex" dark-marine tokens for the Dashboard screen ONLY.
//
// Single source of truth for the dashboard's glass reskin (LOADEX_UI_PASS.md).
// Inline-styles compliant: plain constants + style-object factories consumed as
// style={...}. The rest of the app uses the light system in src/theme.js —
// never mix the two palettes inside one screen.
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  // Base surfaces — marine-teal shift on the existing void base
  void:      '#030508',
  abyss:     '#04110d',   // teal-tinted wash (use in radial background)
  surface:   '#0a1020',   // raised panel base
  glass:     'rgba(12,26,30,0.72)',
  glass2:    'rgba(10,16,32,0.50)',
  hair:      'rgba(255,255,255,0.06)',
  border:    '#102030',

  // Text
  ink:       '#e8eef0',
  inkDim:    '#8a9aaa',   // steel
  inkFaint:  '#4a5a66',

  // Status (with matching glow tokens below)
  critical:  '#ff4d4d',
  warning:   '#e8930a',   // dock amber
  minor:     '#3ba3ff',
  optimized: '#12b886',   // bright port green

  // Brand
  dockAmber: '#e8930a',
  portGreen: '#0b6b50',
};

export const GLOW = {
  critical:  '0 0 24px rgba(255,77,77,0.45)',
  warning:   '0 0 22px rgba(232,147,10,0.40)',
  minor:     '0 0 22px rgba(59,163,255,0.40)',
  optimized: '0 0 22px rgba(18,184,134,0.40)',
};

export const R = { chip: 12, card: 16, panel: 20, pill: 999, input: 10 };
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 48 };

export const F = {
  head: `'Barlow Condensed', system-ui, sans-serif`,   // 800 hero, 700 headers
  mono: `'JetBrains Mono', ui-monospace, monospace`,    // all numerics + IDs
};

// Page wash behind the whole dashboard (LOADEX §4).
export const WASH = `radial-gradient(120% 80% at 60% -10%, #06201a 0%, ${C.abyss} 40%, ${C.void} 100%)`;

// Reusable style-object factories (return inline style objects)
export const glass = (radius = R.panel) => ({
  background: `linear-gradient(160deg, ${C.glass}, ${C.glass2})`,
  backdropFilter: 'blur(18px) saturate(120%)',
  WebkitBackdropFilter: 'blur(18px) saturate(120%)',
  border: `1px solid ${C.hair}`,
  borderRadius: radius,
  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px -24px rgba(0,0,0,0.8)`,
});

export const label = () => ({
  font: `600 11px/1 ${F.head}`,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: C.inkFaint,
});

export const num = (size = 28) => ({
  font: `500 ${size}px/1 ${F.mono}`,
  fontVariantNumeric: 'tabular-nums',
  color: C.ink,
});

export const statusColor = (s) => ({
  critical: C.critical, warning: C.warning, minor: C.minor, optimized: C.optimized,
}[String(s || '').toLowerCase()] || C.inkDim);

// containerStatus() (data/statusHelpers.js) → Loadex severity vocabulary.
// Pure display mapping — the real status string stays in the data.
export const SEV = {
  OVER: 'critical',      // over-capacity → red
  FULL: 'warning',       // loaded, awaiting seal → amber
  STUFFING: 'minor',     // actively loading → blue
  SEALED: 'optimized',   // done → green
  EMPTY: 'neutral',
};

// ── App-wide additions beyond the dashboard token set (LOADEX_UIUX_MASTER §2) ──

export const input = () => ({
  ...glass(R.input),
  padding: `${SP.sm}px ${SP.md}px`,
  color: C.ink,
  font: `400 14px ${F.mono}`,
  outline: 'none',
});

export const pillNav = (active) => ({
  borderRadius: R.pill,
  padding: `${SP.xs}px ${SP.lg}px`,
  font: `600 13px ${F.head}`,
  letterSpacing: '0.02em',
  background: active ? '#fff' : 'transparent',
  color: active ? C.void : C.inkDim,
  border: active ? 'none' : `1px solid ${C.hair}`,
  transition: 'all .2s ease',
});

export const tableRow = () => ({
  borderBottom: `1px solid ${C.hair}`,
  font: `400 13px ${F.mono}`,
  color: C.ink,
});

// ── Compat layer: dark-remapped `theme` object for legacy `from '../theme'`
// imports (previously the light system). Values now resolve into the Loadex
// palette so every consumer inherits the dark language without import churn. ──

export const theme = {
  color: {
    canvas: C.void,
    surface: C.surface,
    surfaceMuted: '#0d1626',
    border: C.border,
    borderStrong: '#1a2a3c',
    ink: C.ink,
    inkSoft: '#c2ccd6',
    slate: C.inkDim,
    slateFaint: C.inkFaint,
    amber: C.dockAmber,
    amberText: '#f0a63c',
    amberSoft: 'rgba(232,147,10,0.15)',
    green: C.optimized,
    greenSoft: 'rgba(18,184,134,0.15)',
    red: C.critical,
    redSoft: 'rgba(255,77,77,0.15)',
    white: '#ffffff',
  },
  status: {
    EMPTY:    { dot: C.inkDim,    label: C.inkDim,    fill: 'rgba(255,255,255,0.06)' },
    STUFFING: { dot: C.minor,     label: C.minor,     fill: 'rgba(59,163,255,0.14)' },
    FULL:     { dot: C.warning,   label: C.warning,   fill: 'rgba(232,147,10,0.14)' },
    OVER:     { dot: C.critical,  label: C.critical,  fill: 'rgba(255,77,77,0.14)' },
    SEALED:   { dot: C.optimized, label: C.optimized, fill: 'rgba(18,184,134,0.14)' },
    DRAFT:    { dot: C.inkDim,    label: C.inkDim,    fill: 'rgba(255,255,255,0.06)' },
    ISSUED:   { dot: C.optimized, label: C.optimized, fill: 'rgba(18,184,134,0.14)' },
    VOID:     { dot: C.critical,  label: C.critical,  fill: 'rgba(255,77,77,0.14)' },
  },
  font: {
    condensed: F.head,
    mono: F.mono,
    body: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  radius: { sm: R.input - 2, input: 12, pill: R.pill, card: R.panel },
  shadow: {
    card: '0 20px 40px -24px rgba(0,0,0,0.8)',
    pill: '0 6px 18px -10px rgba(0,0,0,0.8)',
    raised: '0 30px 60px -30px rgba(0,0,0,0.85)',
  },
  space: (n) => n * 4,
  breakpoints: { mobile: 640, tablet: 900 },
};

export const statusTone = (status) => theme.status[status] || theme.status.EMPTY;

export const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;
