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
- Project ref: [ADD AFTER SUPABASE PROJECT CREATED]
- Region: ap-south-1 (Mumbai)
- Env vars in .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

## Design system (DO NOT DEVIATE)
```
Colors:
  --void:    #030508   background
  --surface: #0a1020   cards, panels
  --border:  #102030   dividers, hairlines
  --amber:   #e8930a   primary accent (dock floodlight)
  --green:   #0b6b50   sealed/confirmed state
  --steel:   #8a9aaa   muted text, labels

Fonts (loaded in index.html):
  Barlow Condensed 700/800  → headers, numbers, container IDs
  JetBrains Mono 400/600    → all data values, codes, weights
  System UI                 → form inputs, body text

Scanline texture on body background:
  background-image: repeating-linear-gradient(
    0deg, transparent, transparent 1px, rgba(255,255,255,0.012) 1px, rgba(255,255,255,0.012) 2px
  );
```

## File structure
```
src/
  main.jsx
  App.jsx                  ← state, routing, auth gate
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

## Status colors
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
