# LOADEX_UIUX_MASTER.md

**Purpose:** Whole-app presentational overhaul of Kraft Portal (all views, all shared components)
to the "Loadex" aesthetic — deep marine glass, floating pill nav, glowing status accents,
isometric hero elements, monospace data. **Zero changes to data flow, offline sync, RLS,
document generation, or mail crypto.** This supersedes the single-page `LOADEX_UI_PASS.md` —
same visual language, extended to the entire repo.

Written for a **Claude Fable 5** Claude Code session against the Kraft Portal repo
(`portal.shafrina.com`). Read this whole file once, then execute in the order in Section 9.

---

## 0. SESSION SETUP — controls token cost on a repo this size

This repo has ~25 views and ~45 components. The only way to reskin all of it affordably is to
restyle a small set of **shared primitives and shell components once**, so every view inherits
the look automatically, then do a lighter per-view pass for layout only.

1. **Model:** `/model` → `claude-fable-5`.
2. **No exploratory reading.** The file tree below is already known — do not `ls`/`grep` to
   rediscover it. Only open a file when you're about to edit it.
3. **Reconcile the two existing theme files FIRST**, before touching anything else:
   - `view src/theme.js` and `view src/ui/theme.js`.
   - If `src/ui/theme.js` already contains the Loadex tokens from a prior session (C, GLOW, R, SP,
     F, glass(), label(), num(), statusColor()), that is canonical. Merge anything useful from
     `src/theme.js` into it, then make `src/theme.js` re-export from `src/ui/theme.js` (so any
     existing imports of the old path don't break), OR grep for all `from '.*theme'` imports and
     repoint them to `src/ui/theme.js`, then delete `src/theme.js`. Pick whichever is fewer edits.
   - If neither file has the Loadex tokens yet, create them fresh in `src/ui/theme.js` per
     Section 2 below, and repoint/delete `src/theme.js` the same way.
   - **Do this reconciliation in one pass and commit it before any view work.**
4. **Extend, don't duplicate.** Every subsequent component imports tokens from `src/ui/theme.js`.
   Never re-type a hex/blur/shadow that already has a token.
5. **Shared-first ordering is mandatory** (Section 9) — components used by 10+ views (`Card`,
   `StatusBadge`, `Pill`, `AppShell`, `TopNav`, `BottomNav`, `Toast`, `ConfirmDialog`) are done
   before any individual view. This is the single biggest cost lever on this repo.
6. **Edit, don't rewrite.** Targeted `str_replace` per file. Never regenerate a whole file to
   restyle it.
7. **One file per turn, commit after each.** Do not re-open committed files.
8. **No dev-server/screenshot loop.** One `npm run build` at the very end.
9. If a view's data shape doesn't match a mockup region, apply Section 8 (don't invent) rather
   than asking or fabricating.

---

## 1. HARD INVARIANTS — do not break these anywhere in the repo

- **Inline styles only** via `src/ui/theme.js` tokens/factories. No Tailwind, no CSS files beyond
  `src/styles/global.css` (font-face / resets only), no styled-components.
- **No Three.js/WebGL.** Hero/decorative visuals are SVG + CSS + GSAP only.
- **Never touch:** `src/data/appReducer.js`, `src/data/store.js`, `src/lib/db.js`,
  `src/lib/realtime.js`, `src/lib/supabase.js`, `src/lib/useDirtyGuard.js`, `src/lib/recentEntities.js`,
  `src/lib/search.js`, anything in `src/lib/pdf/**`, `src/lib/exportPdf.js`,
  `src/lib/exportManifestPdf.js`, `src/lib/exportXlsx.js`, `src/lib/documents.js`,
  `src/lib/mailApi.js`, any file under `api/**`, any file under `supabase/**`,
  `src/context/AuthContext.jsx` and `src/context/LiveContext.jsx` **logic** (their JSX output,
  if any, may be restyled — their state/effects/queries may not).
- **Do not change** props, hooks, state shape, handlers, validation, or derived-data math anywhere.
  Restyle the wrapper, keep the behavior identical.
- **Offline-first stays intact:** `OfflineBanner`, `SyncErrorBanner`, `SyncPill` keep their exact
  trigger conditions — only their visual presentation changes.
- **Seal/void/dirty-guard flows are untouched logically:** `SealConfirmDialog`, `ConfirmDialog`,
  `useDirtyGuard` gating stays wired exactly as-is; only the modal chrome is restyled.
- **Money stays integer paise**, documents stay rendered from frozen `jsonb` snapshots, records
  are void-only (no hard deletes) — none of this is UI, so none of this changes.
- **Mail credentials:** never render, log, or move decrypted credentials differently than today;
  `MailSettingsView`/`ConnectView` restyle the form chrome only, never the crypto/submit path.
- **No new network calls, tables, or writes anywhere**, including to "fill" a mockup region.
- **Preserve every interactive affordance and route** exactly (clicks, filters, modals, nav,
  command palette actions, keyboard shortcuts, presence indicators).
- **Accessibility parity or better** everywhere: focus states, ≥40px hit targets, ≥4.5:1 contrast,
  `prefers-reduced-motion` honored globally.

---

## 2. DESIGN SYSTEM — `src/ui/theme.js` (canonical, single source)

If not already present from the prior session, create these exports. If already present, extend
in place — do not redefine.

```js
// src/ui/theme.js

export const C = {
  void: '#030508', abyss: '#04110d', surface: '#0a1020',
  glass: 'rgba(12,26,30,0.72)', glass2: 'rgba(10,16,32,0.50)',
  hair: 'rgba(255,255,255,0.06)', border: '#102030',
  ink: '#e8eef0', inkDim: '#8a9aaa', inkFaint: '#4a5a66',
  critical: '#ff4d4d', warning: '#e8930a', minor: '#3ba3ff', optimized: '#12b886',
  dockAmber: '#e8930a', portGreen: '#0b6b50',
};

export const GLOW = {
  critical: '0 0 24px rgba(255,77,77,0.45)',
  warning:  '0 0 22px rgba(232,147,10,0.40)',
  minor:    '0 0 22px rgba(59,163,255,0.40)',
  optimized:'0 0 22px rgba(18,184,134,0.40)',
};

export const R = { chip: 12, card: 16, panel: 20, pill: 999, input: 10 };
export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, huge: 48 };
export const F = {
  head: `'Barlow Condensed', system-ui, sans-serif`,
  mono: `'JetBrains Mono', ui-monospace, monospace`,
};

export const glass = (radius = R.panel) => ({
  background: `linear-gradient(160deg, ${C.glass}, ${C.glass2})`,
  backdropFilter: 'blur(18px) saturate(120%)',
  WebkitBackdropFilter: 'blur(18px) saturate(120%)',
  border: `1px solid ${C.hair}`,
  borderRadius: radius,
  boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 40px -24px rgba(0,0,0,0.8)`,
});

export const label = () => ({
  font: `600 11px/1 ${F.head}`, letterSpacing: '0.14em',
  textTransform: 'uppercase', color: C.inkFaint,
});
export const num = (size = 28) => ({
  font: `500 ${size}px/1 ${F.mono}`, fontVariantNumeric: 'tabular-nums', color: C.ink,
});
export const statusColor = (s) => ({
  critical: C.critical, warning: C.warning, minor: C.minor, optimized: C.optimized,
  // extend as needed per view: loading→minor, loaded→optimized, queued→inkDim, void→inkFaint
}[String(s || '').toLowerCase()] || C.inkDim);

// App-wide additions beyond the dashboard token set:
export const input = () => ({
  ...glass(R.input),
  padding: `${SP.sm}px ${SP.md}px`, color: C.ink, font: `400 14px ${F.mono}`,
  outline: 'none',
});
export const pillNav = (active) => ({
  borderRadius: R.pill, padding: `${SP.xs}px ${SP.lg}px`,
  font: `600 13px ${F.head}`, letterSpacing: '0.02em',
  background: active ? '#fff' : 'transparent',
  color: active ? C.void : C.inkDim,
  border: active ? 'none' : `1px solid ${C.hair}`,
  transition: 'all .2s ease',
});
export const tableRow = () => ({
  borderBottom: `1px solid ${C.hair}`, font: `400 13px ${F.mono}`, color: C.ink,
});
```

Fonts: confirm `Barlow Condensed` + `JetBrains Mono` are linked in `index.html` (add `<link>` tags
if missing — the only allowed non-`src/` edit). `src/styles/global.css` may only hold `@font-face`
/ CSS resets, never component styling.

---

## 3. SHELL & GLOBAL CHROME — do these before any individual view

These wrap every screen in the app. Restyling them first means every view below inherits nav,
banners, toasts, and modals "for free."

| Component | Treatment |
|---|---|
| `AppShell.jsx` | Page background: radial marine wash (`radial-gradient(120% 80% at 60% -10%, #06201a 0%, ${C.abyss} 40%, ${C.void} 100%)`). Grid shell for content. |
| `TopNav.jsx` | Floating centered pill nav (`pillNav()`), glass top bar, right-cluster icon buttons in glass pills. |
| `BottomNav.jsx` (mobile) | Glass dock bar, active item glow-underlined, `GLOW.minor` on active icon. |
| `CommandPalette.jsx` | Glass modal, `input()` search field, results list with `tableRow()` styling, kbd hints in `F.mono`. |
| `Toast.jsx` | Glass chip, left status-accent bar via `statusColor`, slide-in from top-right. |
| `OfflineBanner.jsx` / `SyncErrorBanner.jsx` / `SyncPill.jsx` | Glass strip/pill, `warning`/`critical` tinted, same exact show/hide conditions. |
| `ConfirmDialog.jsx` / `SealConfirmDialog.jsx` | Centered glass modal, `R.panel` radius, destructive actions in `C.critical`, confirm in `C.optimized`. |
| `PresenceAvatars.jsx` | Overlapping glass-ringed circular avatars, subtle glow on the ring for the active user. |
| `ExportMenu.jsx` | Glass dropdown, `F.mono` for file-type rows. |
| `ui/Card.jsx`, `ui/Pill.jsx`, `ui/Input.jsx`, `ui/SpecLabel.jsx`, `ui/StatusBadge.jsx` | These are the load-bearing primitives — rebuild them directly on `glass()`, `pillNav()`/`Pill` variant, `input()`, `label()`, `statusColor()` respectively. Once these five are done, most views below need little more than spacing/layout tweaks. |

Commit each of these individually per Section 9's ordering rule.

---

## 4. VIEW-BY-VIEW REMAP (grouped by module, in execution order)

For every view: reuse the shell + primitives above; add only the module-specific layout/hero
treatment noted. Do not restyle a primitive again inside a view — import it.

### 4.1 Auth & entry
- `LoginView.jsx`, `AuthView.jsx`, `SetPasswordView.jsx` — centered glass card on the radial-wash
  background, brand mark top, `input()` fields, single accent CTA button (`C.optimized` fill).
- `AppSelectorView.jsx` — grid of glass app-tiles (Stuffing / Manifest / Expenses / Mail), each
  tile glows its brand accent on hover; keep existing routing.

### 4.2 Dashboard / live
- `DashboardView.jsx` — this is the primary Loadex screen from `LOADEX_UI_PASS.md`: hero + rails +
  bottom strip, per that file's Sections 4–7. If `src/ui/BayHero.jsx` already exists from the
  prior session, reuse it; only wire it to whatever live data this view actually holds — do not
  duplicate the hero component.
- `PortGlobeView.jsx` — glass panel frame around the existing globe/map viz; restyle chrome only,
  not the visualization's own rendering logic.
- `VesselHero.jsx`, `VesselIllustration.jsx`, `DockScene.jsx` — align these to the same isometric/
  glow language as `BayHero`; if they duplicate its job on this or other views, prefer reusing
  `BayHero` and only keep these where they render genuinely different content (e.g. a single-vessel
  detail illustration vs. the full bay).
- `CrossSectionFill.jsx`, `VoyageContainerSlots.jsx` — bay-slot visuals feeding into voyage/vessel
  views (4.3): same isometric-grid + `statusColor` treatment as `BayHero`, reused as a component,
  not reinvented per view.

### 4.3 Voyages & vessel movements
- `VoyagesView.jsx`, `VoyageView.jsx`, `VoyageDetailView.jsx` — list = glass row cards with
  `StatusBadge`; detail = hero slot visual (4.2) + glass metric strip (Load Balance / P&L teaser)
  echoing the dashboard's bottom strip.
- `CreateVoyageModal.jsx`, `CreateMovementModal.jsx` — glass modal + `input()` fields; keep
  validation/submit logic untouched.
- `VesselMovementsView.jsx` — timeline/list view, `tableRow()` rows, ETA columns in `F.mono`.

### 4.4 Bookings & manifest
- `BookingsView.jsx`, `BookingDetailView.jsx` — glass list/detail, `StatusBadge` for booking
  status, tonnage/weight figures in `num()`.
- `CreateBookingModal.jsx`, `BookingSelect.jsx`, `ShipperConsigneeSelect.jsx` — glass combobox/
  modal styling on `input()`; keep search/select logic as-is.
- `ManifestShell.jsx`, `ManifestTable.jsx` — dense data table: `tableRow()`, sticky glass header,
  status-tinted left accent bar per row (mirrors the mockup's cargo-card accent bar).
- `ManifestDocumentView.jsx` — restyle surrounding chrome only; the generated document content
  itself (fed by `src/lib/pdf/**`) is untouched output, not a UI target.
- `ContainerCard.jsx`, `ContainerInfoOverlay.jsx`, `ContainerLogView.jsx`, `LineCard.jsx` — glass
  cards per Section 5/row-10 of `LOADEX_UI_PASS.md` (big tabular tonnage numbers, status accent).
- `VGMAlert.jsx` — critical-tinted glass banner with `GLOW.critical`, same trigger logic.

### 4.5 Documents
- `DocumentsView.jsx` — glass list of generated documents, status/version badges via
  `StatusBadge`.
- `documents/DocumentDraftModal.jsx`, `documents/DocumentGenerateMenu.jsx`,
  `InvoiceFields.jsx` — glass modal/menu chrome + `input()` fields around the existing
  generation flow; do not touch what gets generated or how it's snapshotted.

### 4.6 Expenses & Voyage P&L
- `expenses/ExpensesShell.jsx`, `expenses/ExpenseListView.jsx`, `expenses/ExpenseDetailView.jsx` —
  glass list/detail, `expenses/CategoryBadge.jsx` restyled onto `statusColor`-style category
  tinting (distinct palette lane if categories ≠ status semantics — don't overload red/amber/
  green/blue meanings with unrelated categories).
- `expenses/ExpenseCard.jsx`, `expenses/ExpenseForm.jsx`, `expenses/ExpenseFilters.jsx` — glass
  card/form/filter-pill row on the same primitives.
- `expenses/ExpenseSummaryView.jsx`, `expenses/ExpenseSummaryStrip.jsx` — this is the natural home
  for the dashboard's "Loading Power"-style bar metric and headline `num()` count-ups, since it's
  where aggregate figures already live.
- `expenses/VoyagePnlView.jsx`, `expenses/VoyagePnlStrip.jsx` — P&L headline figures in large
  `num()`, profit/loss tinted `optimized`/`critical`, same underlying calculation.

### 4.7 Mail
- `mail/MailShell.jsx`, `mail/InboxView.jsx` — glass three-pane layout (folder rail / thread list
  / reading pane), unread indicator as a small glow dot, not a redesign of IMAP behavior.
- `mail/ComposeView.jsx` — glass compose panel, `input()` fields; send path untouched.
- `mail/ConnectView.jsx`, `mail/MailSettingsView.jsx` — glass form chrome around the Hostinger
  connect/settings flow; **never** alter how credentials are entered, transmitted, or encrypted —
  restyle the surrounding card/inputs only.

### 4.8 Ops, admin & misc
- `ActivityFeedView.jsx` — glass timeline, `tableRow()`-style entries, actor avatars via
  `PresenceAvatars` styling language.
- `LogView.jsx` — dense `F.mono` log table, subtle zebra via `C.hair` at low opacity.
- `MastersView.jsx`, `SettingsView.jsx` — glass form sections, grouped under `label()` headers.
- `TeamPanel.jsx` — glass roster cards, role badges via `StatusBadge`.

---

## 5. HERO / ISOMETRIC VISUALS — reuse, don't multiply

`BayHero.jsx` (already exists per repo tree) is the canonical isometric bay-plan component from
the prior session. Before styling `VesselIllustration`, `DockScene`, `VesselHero`,
`CrossSectionFill`, or `VoyageContainerSlots`:

- Check whether each is genuinely distinct content (e.g. single-vessel side profile vs. full bay
  grid vs. a movement-log map) or a near-duplicate of `BayHero`'s job on a different screen.
- **Reuse `BayHero`** wherever the underlying data is "containers in bay positions," passing
  different data instead of writing new SVG.
- Only write new SVG for a component whose visual subject is genuinely different (e.g. `DockScene`
  showing cranes/vessel side-on vs. `BayHero`'s overhead bay grid).
- All such visuals: SVG + CSS + GSAP only, respect `prefers-reduced-motion`, read-only unless the
  component already had click handlers — in which case keep them wired exactly as today.

---

## 6. MOTION — GSAP, consistent across the app

- **Entrance:** fade + `translateY(16→0)`, stagger `0.06`, `power3.out`, `0.6s`, once per mount —
  applied via the shell/primitives so it's inherited, not re-added per view.
- **Card hover:** `translateY(-3px)`, border brightens toward `C.optimized` at low alpha, `.25s`.
- **Critical states:** gentle opacity pulse `0.6→1`, `2.4s` loop, only where status is critical
  (`VGMAlert`, critical `StatusBadge`, `SyncErrorBanner`).
- **Numbers:** count-up on mount for headline `num()` figures (P&L, tonnage, totals) — small
  shared util, not per-view reimplementation.
- Always gate behind `prefers-reduced-motion`; never animate `top/left`, only `transform`/`opacity`.

---

## 7. TABLES & DENSE DATA — one pattern, reused

`ManifestTable`, `LogView`, expense lists, activity feed, mail thread list all want the same dense
data-row language: `tableRow()` base, `F.mono` for numeric/ID columns, sticky glass header with
`label()` column titles, status/category accent as a 2–3px left border rather than a full-row
tint. Build this once (e.g. as a small shared row style helper in `theme.js` or a thin
`ui/DataRow.jsx` if a component is cleaner than a style object) and reuse everywhere in Section 4
rather than restyling each table from scratch.

---

## 8. THE "DON'T INVENT" RULE (applies repo-wide)

If a mockup-style flourish (AI panel, gauge, power meter, glow metric) has no corresponding real
data on a given view, either:
(a) render it from data the view **already has** in props/state, purely as display, or
(b) omit it and let the layout breathe.
**Never** add a new Supabase query, table, `runWrite`/`flushQueue` call, model/API call, or mail
call to manufacture content for a visual slot, on any view, for any reason. This applies with
extra weight to `mail/**` (credentials) and `documents/**` (frozen snapshots) — those flows are
correctness-critical, not just data-critical.

---

## 9. EXECUTION ORDER (commit after each; never re-open committed files)

1. Theme reconciliation (Section 0.3) + `index.html` fonts.
2. Shell & primitives (Section 3) — `AppShell`, `TopNav`, `BottomNav`, `Toast`, banners,
   `ConfirmDialog`/`SealConfirmDialog`, `PresenceAvatars`, `ExportMenu`, then the five `ui/*`
   primitives.
3. Shared row/table pattern (Section 7).
4. Auth & entry (4.1).
5. Dashboard/live + hero reuse pass (4.2 + Section 5) — confirms `BayHero` reuse decisions before
   any other view references it.
6. Voyages & movements (4.3).
7. Bookings & manifest (4.4).
8. Documents (4.5).
9. Expenses & P&L (4.6).
10. Mail (4.7).
11. Ops/admin/misc (4.8).
12. Motion pass (Section 6) across already-styled components.
13. `npm run build` — fix only compile errors. Done.

---

## 10. ACCEPTANCE CHECKLIST

- [ ] `src/theme.js` duplication resolved; single canonical `src/ui/theme.js`.
- [ ] Every view visibly shares the same glass/glow/mono language — no view looks unstyled or
      styled differently from the rest.
- [ ] `BayHero` (or a deliberately distinct visual) used consistently, not reinvented per screen.
- [ ] Status color (`critical`/`warning`/`minor`/`optimized`) never used for anything but status;
      expense categories use a separate palette lane.
- [ ] Tables/dense lists share one row pattern across Manifest, Log, Expenses, Activity, Mail.
- [ ] All numerals/IDs monospace + tabular; labels uppercase/tracked.
- [ ] Motion is subtle and consistent app-wide; `prefers-reduced-motion` honored everywhere.
- [ ] Contrast ≥4.5:1, focus states intact, hit targets ≥40px, on every view.
- [ ] `npm run build` passes.
- [ ] **Full diff review:** no changes inside `src/data/**`, `src/lib/**` (except none), `api/**`,
      `supabase/**`, or to any hook/handler/prop signature anywhere. Revert any hunk that touches
      these — styling only, everywhere.

---

## 11. TOKEN-BUDGET REMINDERS (Fable 5, whole-repo scale)

- Reconcile theme once; never re-type a token after Section 0.3/2 is committed.
- Shell + 5 primitives first — this is what makes 25 views affordable.
- One shared table/row pattern, not one per view.
- One file per turn, targeted `str_replace`, commit and move on — never re-open or re-paste
  unchanged files.
- No dev-server/screenshot loop; one final build only.
- Reuse `BayHero` instead of writing new isometric SVG per screen wherever the data allows it.
