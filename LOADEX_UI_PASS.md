# LOADEX_UI_PASS.md

**Purpose:** Presentational-only overhaul of the vessel/stuffing operations dashboard to an
awwwards-grade "Loadex" aesthetic — deep marine glass, floating pill nav, glowing status
accents, a hero bay-plan centerpiece, monospace data. **Zero changes to data flow, queries,
writes, or business logic.** This is a reskin + relayout pass, not a feature pass.

Written for a **Claude Fable 5** Claude Code session. Read this whole file once, then execute.

---

## 0. SESSION SETUP — read this first, it controls token cost

This pass touches many components. Almost all token waste in a reskin comes from (a) re-reading
files you already changed, (b) re-typing the same hex/blur/shadow values into every component,
and (c) exploratory grepping. The rules below eliminate all three.

1. **Model:** run `/model` → `claude-fable-5`.
2. **Discovery is ONE step, not a habit.** Run exactly these two commands, read the output, do
   not open files speculatively:
   ```
   git ls-files 'src/**/*.jsx' 'src/**/*.tsx'
   grep -rl "Dock Operations\|Loading\|voyage\|stuffing\|bay" src --include=*.jsx --include=*.tsx -i
   ```
   From that, identify: the dashboard screen, the vessel/voyage status card, the metric/gauge
   components, and the cargo/booking card. Write those paths down in your first message. Do not
   re-discover later.
3. **Define the design system ONCE.** Your first edit creates `src/ui/theme.js` (Section 3).
   Every component thereafter imports from it. Never re-inline a hex value, blur, or shadow that
   already lives in `theme.js` — reference the token. This is the single biggest token saver.
4. **Edit, don't rewrite.** Use targeted `str_replace` on the JSX/style you are changing. Never
   regenerate a whole file to change styling. Never paste an unchanged file back.
5. **One component per turn, commit after each.** After committing a file, treat it as done —
   do not re-open it. Keep context lean.
6. **No in-loop verification theatre.** Do not spin the dev server or take screenshots between
   every edit. Do one build at the very end (`npm run build`) to confirm it compiles. The spec
   below is precise enough that you don't need to eyeball each step.
7. If a mapping is genuinely ambiguous (a mockup region has no matching data), **do not invent a
   feature** — see Section 6. Ask nothing; apply the fallback.

---

## 1. HARD INVARIANTS — do not break these (logic contract)

Violating any of these fails the pass, regardless of how good it looks.

- **Inline styles only.** No Tailwind, no CSS files, no styled-components. `theme.js` exports
  plain JS constants and style-object factories consumed as `style={...}`. This is still "inline
  styles only" — it is DRY inline styles, not a stylesheet.
- **No Three.js / no WebGL.** The hero centerpiece is SVG + CSS, driven by real data.
- **Do not touch:** `runWrite`, `flushQueue`, any Supabase query/mutation, offline queue logic,
  the paise integer money handling, frozen `jsonb` snapshot rendering, or void-vs-delete logic.
- **Do not change props, hooks, state shape, handlers, or data derivation.** You are changing
  what wraps the data, not the data. If a value is displayed today, display the same value — only
  restyled.
- **No new network calls, no new tables, no new writes.** If the mockup shows something you don't
  have data for, render it from existing derived state or as a static presentational element.
- **Preserve every interactive affordance** that exists today (clicks, filters, expand/collapse,
  navigation). Reskin the trigger; keep the handler.
- **Accessibility parity or better:** keep focus states, keep hit targets ≥ 40px, contrast ≥ 4.5:1
  for text, honor `prefers-reduced-motion`.

---

## 2. WHAT WE'RE COPYING FROM THE MOCKUP (the look, in words)

- Deep marine-teal, near-black background with a soft radial wash behind the hero.
- A **floating pill nav** centered at top; active tab is a solid white pill, others are ghost pills.
- **Glassmorphic panels** everywhere: translucent, blurred, hairline top-highlight, deep soft
  drop shadow, generous radius.
- A **hero centerpiece** (the ship + containers) as the visual anchor, with **glowing
  status-colored cells** (red = critical, amber = warning, blue = minor, green = optimized) and a
  floating alert chip.
- **Left rail** of vessel status cards with a status badge, a small vessel glyph, and 2–3 data rows.
- **Right rail** "optimizer / agent" panel: legend chips, an issues list, and a prompt/summary box.
- **Bottom strip**: an arc gauge (Load Balance), a bar-style metric (Loading Power), and a row of
  cargo cards with big tabular tonnage numbers.
- **Monospace numerals** for every number, ID, %, weight, kW, ETA. Tabular, aligned.

We keep this vocabulary but render it in your brand DNA (Section 3).

---

## 3. DESIGN SYSTEM — create `src/ui/theme.js` first

Create this file, then import from it everywhere. Nothing below should ever be re-typed inline.

```js
// src/ui/theme.js — single source of truth. Inline-styles compliant.

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

export const R = { chip: 12, card: 16, panel: 20, pill: 999 };
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 48 };

export const F = {
  head: `'Barlow Condensed', system-ui, sans-serif`,   // 800 hero, 700 headers
  mono: `'JetBrains Mono', ui-monospace, monospace`,    // all numerics + IDs
};

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
```

Fonts: if Barlow Condensed / JetBrains Mono aren't already linked, add the two `<link>` tags to
`index.html` (that's the only allowed non-component edit). Do not add a font build step.

---

## 4. LAYOUT BLUEPRINT

Wrap the dashboard in a page shell with a radial marine wash, then a 12-col grid. Keep whatever
router/screen wrapper exists — only replace its inner layout.

```
Background: radial-gradient(120% 80% at 60% -10%, #06201a 0%, ${C.abyss} 40%, ${C.void} 100%)

TOP BAR      [ brand ][ ......... floating pill nav ......... ][ search  gear  bell ]
MAIN GRID    [ left rail  3 ][      hero center  6      ][ right rail  3 ]
BOTTOM STRIP [ gauge  3 ][ bar metric  4 ][ cargo cards row  5 (h-scroll) ]
```

- Gutters `SP.xl` (24). Panels use `glass()`. Section labels use `label()`.
- Everything numeric uses `num()` / `F.mono`.
- Max content width ~1440, centered; graceful stack below ~1100 (rails drop under hero).

---

## 5. COMPONENT REMAP — mockup element → your component → treatment

Do these in this order (cheapest, highest-impact first). Each row = one commit.

| # | Mockup element | Your component (from discovery) | Treatment |
|---|---|---|---|
| 1 | Page background + shell | dashboard screen wrapper | Add radial wash + grid shell. Import `theme`. No logic change. |
| 2 | Floating pill nav | existing nav/tabs | Convert to centered ghost-pill row; active = solid white pill (`#fff` bg, `C.void` text). Keep existing route handlers verbatim. |
| 3 | Top-right cluster | existing search + settings + alerts | Reskin search into a `R.pill` glass field; gear + bell into round glass icon buttons. Keep handlers. |
| 4 | Vessel status card | voyage / vessel-movement card | `glass(R.card)`; status badge tinted via `statusColor`; vessel glyph as small SVG; data rows in `F.mono`. Map existing status → nearest of Loading/Loaded/Queued visually; keep the real status string in data. |
| 5 | Alert chip ("Cargo loading error") | existing error/toast state | Floating glass chip over hero, red triangle + text, `GLOW.critical`. Reuse existing error value; do not fabricate errors. |
| 6 | Hero centerpiece | bay-plan / stow view (or new presentational SVG from existing container data) | See Section 7. |
| 7 | Optimizer / AI panel | existing summary/issues panel (if any) | Reskin as glass panel: legend chips (Critical/Warning/Minor/Optimized), issues list, summary box. **If no such panel exists, do not build an AI backend** — render the region from the existing stuffing summary/issues you already compute, styled as this panel. |
| 8 | Load Balance gauge | existing stow-balance value (or derived) | SVG arc gauge, read-only, driven by an existing derived value. If no balance value exists, compute port/starboard % **in the component from already-loaded bay data** (pure display math, no new query/write) and render it; never persist it. |
| 9 | Loading Power / bar metric | nearest existing throughput/rate metric | Reskin as a thin animated bar row + big `num()` headline. If no analogous metric, repurpose the panel for an existing count (e.g., total tonnage / container count) — same rule: display existing data only. |
| 10 | Loading Cargo cards | booking / container cards | `glass(R.card)` cards, big tabular tonnage `num(30)`, platform + status rows, left status accent bar via `statusColor`. Horizontal scroll on overflow. Keep click-through to the real record. |

For any row where the mapped data doesn't exist: **fallback = present existing derived state as a
static styled element.** Never add a fetch, mutation, or table to satisfy the visual.

---

## 6. THE "DON'T INVENT" RULE (restated because it's the risky part)

The mockup shows an AI agent, a power gauge, and a balance dial. You may or may not have those.
- If you have the data/feature → reskin it.
- If you don't → render the panel from existing state as a **presentational** element, or omit the
  sub-metric and let the panel breathe. **Never** add a model call, a new Supabase call, a new
  table, `runWrite`, or `flushQueue` usage to fill a visual slot. A beautiful panel wired to
  nothing real is a fail. Presentational-from-existing-data or nothing.

---

## 7. HERO CENTERPIECE (no WebGL) — `src/ui/BayHero.jsx`

Build the anchor as an **isometric SVG bay plan** driven by the container/stuffing data already in
props/state. This is the awwwards focal point.

- Render bay slots as an isometric grid of rounded cells. Fill each cell by real container status
  via `statusColor`; apply the matching `GLOW.*` only to non-neutral cells.
- One soft radial light behind the grid (`C.optimized` at ~8% opacity).
- A thin animated "scan" line sweeping the grid on a slow loop (GSAP, respects reduced-motion).
- The alert chip (row 5) floats over the most-critical cell.
- **Read-only.** Cells reflect existing data; clicking a cell reuses the existing select handler if
  one exists, otherwise no-op. Do not add editing.
- If bay/positions data isn't available in this screen's props, render a **static decorative**
  isometric grid using neutral tones + brand accents (no data claim). Do not fetch to fill it.

Keep the SVG lightweight (target < ~200 cells) so it never janks.

---

## 8. MOTION — GSAP, tasteful, guarded

- **Entrance:** panels fade + `translateY(16→0)`, stagger `0.06`, `power3.out`, `0.6s`, once on mount.
- **Card hover:** `translateY(-3px)`, border brightens to `C.optimized` at low alpha, `0.25s`.
- **Critical glow:** gentle opacity pulse `0.6→1`, `2.4s` loop — **only** on critical status.
- **Hero:** slow float on the grid layer + tiny scroll parallax; the scan line loop.
- **Number count-up** on mount for the 3–4 headline metrics (small util; display-only).
- Wrap everything in `if (!prefers-reduced-motion)`. Under reduced-motion: no transforms, no
  pulse, no scan — final state only. Never animate layout properties that thrash (`top/left`);
  use `transform`/`opacity`.

---

## 9. EXECUTION ORDER (commit after each; don't re-open committed files)

1. `theme.js` + fonts in `index.html`.
2. Page shell + grid (row 1).
3. Nav + top-right cluster (rows 2–3).
4. Vessel status card (row 4).
5. `BayHero.jsx` + alert chip (rows 5–6).
6. Optimizer/summary panel (row 7).
7. Gauge (row 8).
8. Bar metric (row 9).
9. Cargo cards (row 10).
10. Motion pass (Section 8) across the already-styled components.
11. `npm run build` — fix only compile errors. Done.

---

## 10. ACCEPTANCE CHECKLIST (awwwards bar)

- [ ] One clear focal point (the bay hero); everything else supports it.
- [ ] Cohesive marine-glass palette; status color used **only** for status, never decoration.
- [ ] Depth reads through glass + hairline highlight + soft shadow + selective glow — not borders.
- [ ] All numerals monospace, tabular, aligned; labels uppercase tracked.
- [ ] Consistent spacing off the `SP` scale; generous negative space; nothing cramped.
- [ ] Micro-interactions on every interactive element; motion is subtle, never bouncy.
- [ ] `prefers-reduced-motion` fully honored.
- [ ] Contrast ≥ 4.5:1 for text; visible focus states; hit targets ≥ 40px.
- [ ] `npm run build` passes.
- [ ] **Diff review:** no changes to queries, writes, `runWrite`/`flushQueue`, money handling,
      snapshots, or handlers. If the diff shows any, revert that hunk — styling only.

---

## 11. TOKEN-BUDGET REMINDERS (Fable 5)

- Discover once. Never grep twice for the same thing.
- Reference `theme` tokens; never re-type hex/blur/shadow after `theme.js` exists.
- `str_replace` targeted hunks; never regenerate whole files for styling.
- One component per turn; don't re-read committed files; don't paste unchanged code back.
- No dev-server/screenshot loop; a single final build is the only verification.
