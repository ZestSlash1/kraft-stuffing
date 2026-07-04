# CLAUDE.md — Kraft Stuffing Log
> Claude Code reads this file automatically every session. Keep it updated.

## What this is
Container stuffing log for Kraft Shipping & Logistics, deployed at stuff.shafrina.com.
Logs what cargo goes into which container per voyage (MV APJ Karan 2, Kolkata → Port Blair).
Multi-user real-time: dockside staff log simultaneously. Voyage supervisor views live from office.

## Stack
- Vite + React 18, no CSS framework (inline styles only)
- Supabase: Postgres + Auth (email OTP) + Realtime + Storage
- GSAP 3.12 for animations
- XLSX (SheetJS) for export
- lucide-react for icons
- NO Tailwind, NO three.js, NO react-router (hash-based nav via useState)

## Supabase project
- Project ref: xdacidevdepagyrnebhh
- Region: ap-south-1 (Mumbai)
- Env vars in .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

## Design system — LIGHT (DO NOT DEVIATE)
> Pivoting from the dark ops-room theme to a clean light theme. Tokens live in
> `src/theme.js` (`import { theme }`). Reusable primitives in `src/components/ui/`.
> Migration is screen-by-screen, anchored on ContainerLogView first. Screens not
> yet migrated still read the legacy dark `TOKENS` from `src/data/statusHelpers.js`
> — DO NOT mix the two palettes inside one screen.

```
Colors (theme.color.*):
  canvas        #f6f7f9   page background
  surface       #ffffff   cards, panels
  surfaceMuted  #f1f3f6   inset wells, sibling-strip track
  border        #e6eaf0   hairlines, dividers
  borderStrong  #d7dde6   input borders, rest focus rings
  ink           #0f172a   primary text
  inkSoft       #334155   secondary text
  slate         #64748b   muted + italic spec labels
  slateFaint    #94a3b8   placeholder, disabled
  amber         #e8930a   primary accent
  green         #0b6b50   sealed / confirmed
  red           #dc2626   over-capacity / error

Radii (theme.radius.*):   sm 8 · input 12 · pill 999 · card 20
Shadows (theme.shadow.*): card · pill · raised  (soft, low-contrast)

Fonts (loaded in index.html):
  Barlow Condensed 300/400/500/700/800
    300 → huge light-weight hero numbers
    500 → sibling-card numbers; 700/800 → dense headers
  JetBrains Mono 400/600  → all data values, codes, weights, labels
  System UI (italic)      → SpecLabel labels, body text

NO scanline texture, NO dark void background. Light surfaces only.

EXCEPTION (Jul 2026): the Dashboard screen intentionally uses the dark
"Loadex" marine-glass system (LOADEX_UI_PASS.md, tokens in src/ui/theme.js),
including a route-aware dark TopNav/BottomNav variant on that route only.
Every other screen stays light. Never mix the two palettes inside one screen.
```

### Primitives (`src/components/ui/`, barrel: `index.js`)
```
Card        20px radius, hairline border, soft shadow. inset=muted well, raised=higher elevation
Pill        rounded dropdown (native <select> + chevron), amber focus ring
Input       12px radius text field, optional mono-caps label, hint, invalid state
StatusBadge coloured dot + label, tinted by status; size="sm" for strips
SpecLabel   italic slate label over mono value; tone "over" (red) / "ok" (green)
```

### Status palette (theme.status.* → { dot, label, fill })
```js
EMPTY:    { dot: '#94a3b8', label: '#64748b', fill: '#f1f3f6' }
STUFFING: { dot: '#e8930a', label: '#b3700a', fill: '#fdf0d8' }
FULL:     { dot: '#ea7a0c', label: '#b85f08', fill: '#fdece0' }
OVER:     { dot: '#dc2626', label: '#b91c1c', fill: '#fde4e4' }
SEALED:   { dot: '#0b6b50', label: '#0b6b50', fill: '#e2f0ea' }
```

## File structure
```
src/
  main.jsx
  App.jsx                  ← state, routing, auth gate
  theme.js                 ← LIGHT design tokens (color/radius/shadow/status)
  components/ui/           ← light primitives: Card, Pill, Input, StatusBadge, SpecLabel
  lib/
    supabase.js            ← supabase client init
    realtime.js            ← subscription helpers
  data/
    store.js               ← localStorage fallback (offline)
    statusHelpers.js       ← containerStatus(), fill%, colors
    cargoLayout.js         ← bag position calculator
  views/
    AuthView.jsx           ← email OTP login screen
    VoyageView.jsx         ← manifest table + header
    LogView.jsx            ← active stuffing: header + form + entries
  components/
    ManifestTable.jsx      ← the core voyage overview table
    ContainerCard.jsx      ← mobile card (collapses from table row)
    CrossSectionFill.jsx   ← top-down fill indicator component
    AddForm.jsx            ← stuffing entry form
    LineCard.jsx           ← single entry display
    ContainerInfoOverlay.jsx ← slide-up detail panel
    PresenceAvatars.jsx    ← live user dots on containers
    InvoiceFields.jsx      ← invoice/document subform
    ShipperConsigneeSelect.jsx ← master data dropdown with search
    ExportMenu.jsx         ← XLSX + PDF options
    VGMAlert.jsx           ← weight limit warning
  styles/
    global.css
vercel.json
CLAUDE.md                  ← this file
SPEC.md                    ← full feature spec (see separate file)
```

## Data model (Supabase tables)
See SPEC.md → Schema section for full SQL.
Key relationships: voyage → containers (many) → stuffing_lines (many)
Realtime enabled on: containers, stuffing_lines, user_presence

## Status colors — LEGACY DARK (unmigrated screens only)
> Light status palette is under Design system → Status palette above. The hull
> tones below remain in `data/statusHelpers.js` (`CONTAINER_COLORS`) for the dark
> screens not yet ported. New light work uses `theme.status.*`.
```js
EMPTY:    { hull: '#1a2535', label: '#475569' }
STUFFING: { hull: '#3a2008', label: '#e8930a' }
FULL:     { hull: '#3a1a00', label: '#f59e0b' }
OVER:     { hull: '#3a0808', label: '#ef4444' }
SEALED:   { hull: '#082a1a', label: '#0b6b50' }
```

## Key behaviors
- Offline-first: all writes go to localStorage first, then sync to Supabase
- Realtime: Supabase channel per voyageId; containers + stuffing_lines tables subscribed
- Presence: track which user is active on which container; show avatar dots
- Auth: Supabase email OTP; no passwords. Session persists via supabase-js localStorage
- Cargo types: Bags, Cartons, Rolls, Drums, Pallets, Bundles, Pieces — user picks unit
- VGM alert: warn if net_kg + tare_kg > container CML (default 28000kg for 20ft)
- On seal: fire Supabase Edge Function → Interakt WhatsApp API

## Conventions
- No <form> tags anywhere — use <div> + onClick buttons
- All monetary values: store as integer paise (₹) or cents (USD)
- Timestamps: UTC ISO strings, display in IST (UTC+5:30)
- IDs: uuid() from Supabase or crypto.randomUUID() client-side
- Never hardcode Supabase keys — always import from src/lib/supabase.js
