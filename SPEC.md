# SPEC.md — Kraft Stuffing: Full Feature Spec + Build Phases

---

## SCHEMA (run this in Supabase SQL editor before any phase)

```sql
-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Organisations (for future multi-tenancy; for now just one row: Kraft)
create table orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz default now()
);

-- User profiles (extends Supabase auth.users)
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  org_id      uuid references orgs(id),
  display_name text,
  role        text default 'staff', -- 'admin' | 'staff' | 'viewer'
  created_at  timestamptz default now()
);

-- Shipper master
create table shippers (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references orgs(id),
  name        text not null,
  address     text,
  gstin       text,
  iec_code    text,
  created_at  timestamptz default now()
);

-- Consignee master
create table consignees (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid references orgs(id),
  name        text not null,
  address     text,
  country     text default 'IN',
  created_at  timestamptz default now()
);

-- Voyages
create table voyages (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references orgs(id),
  created_by      uuid references profiles(id),
  vessel          text,
  voyage_no       text,
  date            date,
  pol             text default 'Kolkata',
  pod             text default 'Port Blair',
  etd             timestamptz,
  shipping_line   text,
  imo_no          text,
  booking_ref     text,
  bl_no           text,
  cha_name        text,
  cha_contact     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Containers
create table containers (
  id              uuid primary key default gen_random_uuid(),
  voyage_id       uuid references voyages(id) on delete cascade,
  number          text,
  size            text default '20',
  capacity_bags   int default 340,
  capacity_unit   text default 'Bags',   -- Bags | Cartons | Pieces | etc
  seal_no         text,
  seal_no_2       text,
  sealed          boolean default false,
  sealed_at       timestamptz,
  sealed_by       uuid references profiles(id),
  tare_weight_kg  numeric default 2200,  -- 20ft standard tare
  cml_kg          numeric default 28000, -- container max limit
  condition       text default 'Clean',  -- Clean | Damaged | Fumigated
  sort_order      int default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Stuffing lines
create table stuffing_lines (
  id                uuid primary key default gen_random_uuid(),
  container_id      uuid references containers(id) on delete cascade,
  cargo             text not null,
  qty               numeric not null,
  unit              text default 'Bags',     -- Bags | Cartons | Rolls | Drums | Pallets | Bundles | Pieces | MT
  unit_weight_kg    numeric default 50,
  shipper_id        uuid references shippers(id),
  shipper_name      text,                    -- denormalized for speed
  consignee_id      uuid references consignees(id),
  consignee_name    text,
  notify_party      text,
  hs_code           text,
  invoice_nos       text[],                  -- array of invoice numbers
  invoice_value     numeric,                 -- in smallest currency unit (paise)
  invoice_currency  text default 'INR',
  eway_bill_no      text,
  cha_ref           text,
  truck_no          text,
  logged_by         uuid references profiles(id),
  logged_at         timestamptz default now(),
  sort_order        int default 0
);

-- User presence (ephemeral — who is active where right now)
create table user_presence (
  user_id       uuid primary key references profiles(id) on delete cascade,
  voyage_id     uuid references voyages(id),
  container_id  uuid references containers(id),
  display_name  text,
  last_seen     timestamptz default now()
);

-- Audit log
create table audit_log (
  id          bigserial primary key,
  table_name  text,
  row_id      uuid,
  action      text,   -- INSERT | UPDATE | DELETE
  changed_by  uuid references profiles(id),
  changed_at  timestamptz default now(),
  old_data    jsonb,
  new_data    jsonb
);

-- ── RLS ─────────────────────────────────────────────────────────────────
alter table voyages         enable row level security;
alter table containers      enable row level security;
alter table stuffing_lines  enable row level security;
alter table shippers        enable row level security;
alter table consignees      enable row level security;
alter table user_presence   enable row level security;

-- Simple policy: all authenticated users can do everything (one org for now)
create policy "auth_all" on voyages        for all using (auth.role() = 'authenticated');
create policy "auth_all" on containers     for all using (auth.role() = 'authenticated');
create policy "auth_all" on stuffing_lines for all using (auth.role() = 'authenticated');
create policy "auth_all" on shippers       for all using (auth.role() = 'authenticated');
create policy "auth_all" on consignees     for all using (auth.role() = 'authenticated');
create policy "auth_all" on user_presence  for all using (auth.role() = 'authenticated');

-- ── Realtime ─────────────────────────────────────────────────────────────
-- Enable in Supabase Dashboard → Database → Replication → Tables
-- Enable for: containers, stuffing_lines, user_presence
-- (Or run:)
alter publication supabase_realtime add table containers;
alter publication supabase_realtime add table stuffing_lines;
alter publication supabase_realtime add table user_presence;

-- ── Trigger: auto-update updated_at ─────────────────────────────────────
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger touch_voyages    before update on voyages    for each row execute function touch_updated_at();
create trigger touch_containers before update on containers for each row execute function touch_updated_at();

-- ── Seed: create Kraft org ───────────────────────────────────────────────
insert into orgs (id, name) values ('00000000-0000-0000-0000-000000000001', 'Kraft Shipping & Logistics Pvt. Ltd.');
```

---

## PHASE 1 PROMPT — Foundation: Supabase + Auth + Data Layer

> Paste this into a fresh Claude Code session after running the schema above.

```
Read CLAUDE.md and SPEC.md from the project root. Then implement Phase 1:

GOAL: Replace localStorage-only state with Supabase as the primary store.
Add email OTP authentication. Keep localStorage as offline fallback.

1. SUPABASE CLIENT (src/lib/supabase.js)
   - createClient from @supabase/supabase-js using VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
   - Export single client instance

2. AUTH (src/views/AuthView.jsx)
   - Email OTP flow: input email → "Send OTP" → input 6-digit code → verify
   - Supabase: signInWithOtp({email}) then verifyOtp({email, token, type:'email'})
   - Full-screen, centered, minimal — matches design system from CLAUDE.md
   - After auth: check if profile exists, create one if not (with org_id = Kraft org UUID)
   - Show loading state during OTP send

3. APP.JSX CHANGES
   - On mount: supabase.auth.getSession() to check existing session
   - Subscribe to supabase.auth.onAuthStateChange
   - If no session → render AuthView
   - If session → render VoyageView (current app)
   - Pass user object down as prop

4. DATA LAYER (src/lib/db.js) — thin wrappers around Supabase
   Write async functions (all return {data, error}):
   - fetchVoyages(orgId)
   - createVoyage(voyage)
   - updateVoyage(id, patch)
   - fetchContainers(voyageId)
   - createContainer(container)
   - updateContainer(id, patch)
   - fetchLines(containerId)
   - createLine(line)
   - deleteLine(id)
   - fetchShippers(orgId)
   - fetchConsignees(orgId)
   - upsertShipper(shipper)
   - upsertConsignee(consignee)

5. OFFLINE FALLBACK
   - All db.js writes: try Supabase first, on network error fall back to localStorage queue
   - On reconnect (navigator.onLine event): flush localStorage queue to Supabase
   - Show a subtle "Offline — changes saved locally" banner when offline

6. APP STATE
   - Replace useState(seed) with useReducer(appReducer, initialState)
   - Actions: SET_VOYAGES, SET_CONTAINERS, SET_LINES, ADD_LINE, UPDATE_CONTAINER, etc.
   - On each action: dispatch to reducer (instant UI update) AND call db.js (async sync)
   - This pattern ensures UI never waits for network

Do NOT implement Realtime yet (Phase 2). Do NOT change any UI styling yet (Phase 3).
Commit: "feat(phase1): supabase auth + data layer + offline queue"
```

---

## PHASE 2 PROMPT — Realtime + Features

> New Claude Code session after Phase 1 is committed.

```
Read CLAUDE.md and SPEC.md. Phase 1 is complete (check git log). Implement Phase 2:

GOAL: Multi-user real-time sync + all missing features.

── REALTIME (src/lib/realtime.js) ──────────────────────────────────────────
Create a useVoyageRealtime(voyageId, dispatch) hook:

  Subscribe to a single Supabase channel `voyage:${voyageId}`:
  
  1. postgres_changes on containers (voyage_id = voyageId)
     → on INSERT: dispatch ADD_CONTAINER with new row
     → on UPDATE: dispatch UPDATE_CONTAINER with new row  
     → on DELETE: dispatch REMOVE_CONTAINER with old row id
  
  2. postgres_changes on stuffing_lines
     Filter by container IDs belonging to this voyage.
     → INSERT: dispatch ADD_LINE
     → DELETE: dispatch REMOVE_LINE
  
  3. presence (for live user dots)
     → on sync: dispatch SET_PRESENCE with state map
     → on join/leave: same
  
  Call channel.track({ userId, displayName, containerId }) whenever active container changes.
  Unsubscribe and remove channel on unmount.
  
  Use in VoyageView: const presence = useVoyageRealtime(voyage.id, dispatch)

── PRESENCE UI (src/components/PresenceAvatars.jsx) ─────────────────────────
Props: presenceMap (object keyed by userId), containerId
Shows 1-3 avatar circles (initials from displayName, amber bg) if someone is actively
logging that container. Show a green pulse dot on the avatar if updated <5s ago.
Render these in both ManifestTable rows and ContainerCard.

── INVOICE FIELDS (src/components/InvoiceFields.jsx) ────────────────────────
Expandable accordion section inside AddForm, collapsed by default.
Fields (all optional):
  - Invoice No(s): tag input — type invoice number, press Enter to add, × to remove.
    Stores as array of strings (invoice_nos column).
  - Invoice Value: number input + currency select (INR / USD)
  - HS Code: text input (6-digit commodity code)
  - E-Way Bill No: text input
  - CHA Reference: text input
  - Notify Party: text input
Accordion toggle: "Invoice & Docs ▸" label, chevron rotates on open.
When at least one field is filled, show a dot indicator on the toggle even when closed.

── CARGO UNIT FLEXIBILITY ────────────────────────────────────────────────────
In AddForm, replace the hardcoded "bags" label with a unit dropdown:
  Options: Bags | Cartons | Rolls | Drums | Pallets | Bundles | Pieces | MT
Default: Bags. Store in stuffing_lines.unit column.
Label in LineCard shows unit: "340 Bags · 17,000 kg" or "12 Cartons · 480 kg"
ContainerCard capacity shows matching unit: "340/340 Bags" or "12/20 Cartons"

── VGM / WEIGHT ALERT (src/components/VGMAlert.jsx) ─────────────────────────
Calculate: grossKg = (sum of all line qty × unitWeightKg) + container.tare_weight_kg
If grossKg > container.cml_kg:
  Show red banner inside ContainerCard: "⚠ Over CML by X kg — VGM: Y MT"
If grossKg > container.cml_kg * 0.95 (within 5%):
  Show amber warning: "Approaching CML — VGM: Y MT"
Otherwise show subtly: "VGM: Y MT" in steel color.

── SHIPPER / CONSIGNEE MASTER (src/components/ShipperConsigneeSelect.jsx) ───
Replace plain text inputs for shipper/consignee in AddForm with a combo input:
  - Type to search existing shippers/consignees from Supabase (fetched on mount)
  - Shows dropdown of matches
  - If no match: "Add as new shipper" option at bottom of dropdown
  - On select: store both shipper_id (for FK) and shipper_name (denormalized)
  - On "add new": open a small inline form for name, address, GSTIN, IEC code
    Save to shippers table, then select the new entry.

── CONTAINER META EXPANSION ─────────────────────────────────────────────────
Add these fields to ContainerCard expanded section (already has number, size, seal):
  - Tare weight (kg): number input, default 2200 for 20ft / 3900 for 40ft
  - Second seal no: text input, label "Seal 2"
  - Condition: select Clean | Damaged | Fumigated
  - CML override: number input (default 28000 for 20ft), label "CML (kg)"
Store all in containers table columns (already in schema).

── WHATSAPP SEAL NOTIFICATION ───────────────────────────────────────────────
When container.sealed is set to true, call a Supabase Edge Function:
  Function name: notify-seal
  It calls Interakt WhatsApp API with template:
    "Container {number} sealed on voyage {voyageNo}.
     Cargo: {cargoSummary}. Bags: {totalBags}. Net: {netMT} MT.
     Seal: {sealNo}. Shipper: {shipper} → {consignee}"
  
  Create the edge function file at: supabase/functions/notify-seal/index.ts
  It reads INTERAKT_API_KEY and NOTIFY_WHATSAPP_NUMBER from Supabase secrets.
  Call it from the client after updateContainer({sealed: true}):
    supabase.functions.invoke('notify-seal', { body: { containerId } })

── SEAL FLOW ─────────────────────────────────────────────────────────────────
When user taps "Mark sealed" button:
  1. Show confirmation dialog (inline, not browser alert):
     "Seal container {number}?"
     Fields to confirm: Seal No (required), Seal No 2 (optional)
     Button: "Confirm Seal" (green) | "Cancel"
  2. On confirm: updateContainer({ sealed: true, seal_no, sealed_at: now(), sealed_by: userId })
  3. Fire notify-seal edge function
  4. Animate: container card border pulses green once (GSAP: border-color flash 400ms)

Commit: "feat(phase2): realtime + invoice fields + cargo units + VGM + shipper master + seal flow"
```

---

## PHASE 3 PROMPT — Awwwards Design Overhaul

> New Claude Code session after Phase 2 is committed.

```
Read CLAUDE.md and SPEC.md. Phases 1-2 are complete. Implement Phase 3: full visual overhaul.
Make zero functional changes — only styling, layout, and animation. Preserve all logic.

── FONTS (index.html) ───────────────────────────────────────────────────────
Add to <head>:
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">

── GLOBAL CSS (styles/global.css) ────────────────────────────────────────────
body {
  background: #030508;
  background-image: repeating-linear-gradient(
    0deg, transparent, transparent 1px,
    rgba(255,255,255,0.012) 1px, rgba(255,255,255,0.012) 2px
  );
  color: #e2e8f0;
  font-family: ui-sans-serif, system-ui, sans-serif;
}

Define CSS custom properties on :root for all tokens from CLAUDE.md.
Add utility classes: .mono (JetBrains Mono), .condensed (Barlow Condensed),
.label-xs (9px mono, uppercase, tracking 0.12em, steel color).

── VOYAGE VIEW — MANIFEST TABLE ─────────────────────────────────────────────
Replace the current carousel/card grid with a full-width manifest table.
This is the centrepiece. Make it look like a professional cargo document.

Table structure (src/components/ManifestTable.jsx):

  Header row (sticky):
  [FILL] | [#] | [CONTAINER] | [CARGO] | [BAGS / UNIT] | [NET MT] | [STATUS] | [ ]

  Each container = one data row:
  - FILL (48px): CrossSectionFill component (see below)
  - # (36px): "01" in Barlow Condensed 800, 20px, steel color
  - CONTAINER (160px): number in Barlow Condensed 700 18px white + size badge + seal icon
  - CARGO (auto): cargo type names with colored 6px dot per type, comma-separated
  - BAGS (90px): quantity in Barlow Condensed 700 22px amber; unit label in 10px mono below
  - NET MT (80px): value in JetBrains Mono 600 16px
  - STATUS (100px): pill badge with hull background color
  - ACTION (44px): "›" chevron → taps open ContainerInfoOverlay; or "+" to go to LogView

  Row styling:
  - Border-bottom: 1px solid #102030 (hairline)
  - On hover: background lightens slightly (#0d1828)
  - Selected row: left border 3px amber
  - Table has NO outer border, bleeds to viewport edges, max-width 960px centered

  Between the header and first row: one hairline #102030 at full width + 8px gap.
  Between rows: hairline only, no gap.

  Below the table: a summary footer row (not sticky):
  "VOYAGE TOTAL ——— {n} containers ——— {bags} bags ——— {MT} MT"
  In 11px mono, steel color, centered, with em-dash separators.

  On mobile (<640px): table columns collapse to stacked card layout.
  Each card shows: [CrossSectionFill] on top full-width, then number + status on one line,
  then cargo summary, then bags + MT in large Barlow Condensed.

── CROSS-SECTION FILL (src/components/CrossSectionFill.jsx) ────────────────
A small rectangle (44px wide × 20px tall) representing the container floor plan from above.
Inside: filled left-to-right with colored segments per cargo type.
Each segment width proportional to that cargo type's share of total bags.
Unfilled portion: #102030 (border color).
Outer border: 1px solid #1c2d42. Border-radius: 3px.
No label. Pure visual.

Example: container with 200 bags potato + 100 bags onion + 40 bags empty:
[█████████████░░░░░░░░░░░░░░░░░░]
 ████ = potato (#c4a35a) 57%
 ████ = onion  (#7a5c2a) 29%
 ░░░░ = empty  (#102030) 14%

── VOYAGE HEADER ─────────────────────────────────────────────────────────────
Sticky header, full width, no blur — solid #030508 with bottom hairline.
Layout (desktop): [LOGO] [VOYAGE SELECTOR] [vessel · voyageNo · date] [stats strip] [actions]
Layout (mobile): stacked, compact.

Logo treatment: "STUFFING LOG" in Barlow Condensed 800, 18px, letter-spacing 0.12em.
Below it: "KRAFT SHIPPING & LOGISTICS" in 9px mono, steel, tracking 0.2em.
The two lines together feel like a stencil.

Stats strip: 4 cells in a tight row — no cards, no backgrounds, no borders.
Just: [label in 9px mono steel] [value in 28px Barlow Condensed 700 white] spaced with wide gaps.
Cells: VESSELS · CONTAINERS · BAGS · NET MT
The large numbers with tiny labels above feel like an airport departures board.

── LOG VIEW — CONTAINER HEADER ─────────────────────────────────────────────
When logging into a container, the top section (above the form) shows:

[Container number in Barlow Condensed 800 at 64px — almost full viewport width]
[Status badge] [fill %] [bags/capacity] in 11px mono below
[CrossSectionFill component, full width, 28px tall]

This header is fixed height (120px). Container number at this scale feels like a port authority sign.
Below this fixed header: the scrollable form area.

The bag count in the form (live total as entries are added) increments with a GSAP animation:
When a new line is added and the bag count changes:
  gsap.from(bagCountEl, { y: -12, opacity: 0, duration: 0.25, ease: 'back.out(2)' })
This makes the number feel physical — it drops into place.

── CONTAINER INFO OVERLAY ────────────────────────────────────────────────────
Slide-up from bottom (already exists). Redesign the interior:

Top section: container number in Barlow Condensed 800 at 48px.
Below: horizontal rule (hairline), then a data grid.

Data grid: 2-column, each cell has a 9px mono label + value below.
Cells: SEAL NO | CONDITION | TARE | VGM | NET WT | GROSS WT | CML | STATUS

Below data grid: "STUFFING ENTRIES" heading (Barlow Condensed 700, 13px, steel, uppercase).
Then each LineCard entry.

Each LineCard in overlay: manifesto-style single line of text:
"{CARGO} ——— {QTY} {UNIT} ——— {TOTAL KG} kg ——— {SHIPPER} → {CONSIGNEE} ——— {TRUCK}"
In 11px mono with em-dash separators. Multiple invoices shown as stacked sub-lines.

── AUTH VIEW ─────────────────────────────────────────────────────────────────
Full-screen dark. Centered column, max-width 360px.

Top: "KRAFT STUFFING LOG" in Barlow Condensed 800 at 36px.
Below: "stuff.shafrina.com" in 9px mono, steel.
Large gap. Then: the OTP form.

Form fields: full-width, no border-radius (square corners — industrial aesthetic),
border 1px solid #102030, background #0a1020, padding 14px 16px.
Focus state: border color changes to #e8930a.
Submit button: full-width, background #e8930a, color #030508, Barlow Condensed 700 16px,
uppercase, square corners, no border-radius.

── SEAL ANIMATION ────────────────────────────────────────────────────────────
When container.sealed flips to true, on the manifest table row for that container:
  gsap.to(row, { '--border-color': '#0b6b50', duration: 0.1, ease: 'none' })
  then gsap.to(row, { boxShadow: '0 0 0 2px #0b6b5060', duration: 0.3, ease: 'power2.out' })
  then gsap.to(row, { boxShadow: 'none', duration: 0.5, delay: 0.4 })
Net effect: a single green pulse that settles. One moment, not looping.

── GENERAL ANIMATION RULES ────────────────────────────────────────────────────
- Page load: manifest table rows stagger in. gsap.from(rows, {y: 8, opacity: 0, stagger: 0.04, duration: 0.35, ease: 'power2.out'})
- New container added: row slides in from top with same ease
- Container overlay: gsap.from(overlay, {y: '100%', duration: 0.4, ease: 'power3.out'})
- NO looping animations anywhere
- Reduced motion: wrap all gsap calls in if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)

Commit: "feat(phase3): awwwards design — manifest table, Barlow Condensed, cross-section fill, seal pulse"
```

---

## PHASE 4 PROMPT — Export, PWA, Polish

> Run after Phase 3 is confirmed looking good.

```
Read CLAUDE.md and SPEC.md. Phases 1-3 are complete. Implement Phase 4: export, PWA, final polish.

── XLSX EXPORT (upgrade existing) ────────────────────────────────────────────
Extend the existing XLSX export to include all new columns:
  Stuffing lines sheet: add unit, invoice_nos (joined with |), invoice_value, invoice_currency,
  hs_code, eway_bill_no, cha_ref, notify_party, logged_by_name, logged_at
  New "Containers" sheet: container_no, size, tare_kg, net_kg, gross_kg, vgm_kg, cml_kg,
  seal_no, seal_no_2, condition, sealed_at, stuffed_by (all logged_by names joined)
  New "Voyage Summary" sheet: one row, all voyage fields

── PDF PACKING LIST ──────────────────────────────────────────────────────────
Use jsPDF (npm install jspdf):
Create src/lib/exportPdf.js

generatePackingList(voyage, containers):
  Page 1 header: "PACKING LIST" in large text. Voyage details as a 2-col table.
  Then one section per container:
    Container header row: number, size, seal, tare, net, gross
    Data rows: cargo | qty | unit | unit_wt | total_wt | shipper | consignee | invoice_nos
  Footer on each page: voyage no + page X of Y
  Download as: PackingList_{voyageNo}.pdf

── PWA (public/manifest.json + service worker) ───────────────────────────────
public/manifest.json:
{
  "name": "Kraft Stuffing Log",
  "short_name": "Stuffing Log",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#030508",
  "theme_color": "#030508",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}

Create src/sw.js (Vite PWA plugin: npm install vite-plugin-pwa):
Use vite-plugin-pwa with GenerateSW strategy.
Cache: app shell, Google Fonts, Supabase JS.
Offline fallback page: shows "Kraft Stuffing Log — Offline" with the logo.

Generate placeholder icons (simple canvas-drawn amber square with text "KS") using Node script:
  scripts/gen-icons.js — runs at build time, outputs to public/

── AUDIT LOG UI ──────────────────────────────────────────────────────────────
Add an "Audit" tab to ContainerInfoOverlay (alongside the entries list):
  Tab toggle: "ENTRIES" | "AUDIT"
  Audit tab: fetches audit_log rows for this container_id, ordered by changed_at desc
  Shows: {action} by {display_name} at {IST timestamp} — concise diff if UPDATE
  Style: same mono manifesto style as entries

── FINAL POLISH ──────────────────────────────────────────────────────────────
1. Empty state for voyage with no containers:
   Full-width message in Barlow Condensed 800: "NO CONTAINERS LOGGED"
   Below in mono: "Tap + to start logging for this voyage."
   No icons, no illustration — pure typography.

2. Error states: if Supabase call fails, show a slim red banner at top of screen:
   "Sync error — working offline" with retry button. Auto-dismisses when online.

3. Loading state: on initial data fetch, show skeleton rows in the manifest table.
   3 placeholder rows with animated shimmer (CSS animation, #0d1828 → #141e30 → #0d1828).
   NO spinner anywhere in the app.

4. Keyboard navigation: Esc key closes ContainerInfoOverlay and SealConfirmDialog.
   Tab order is correct through AddForm fields. Enter submits AddForm.

5. Touch targets: all tappable elements minimum 44×44px.
   Add padding as needed without affecting visual size.

Commit: "feat(phase4): PDF export, PWA, audit log UI, polish"
```

---

## DEPLOY CHECKLIST

After all 4 phases:
```bash
# Set Supabase secrets for edge function
supabase secrets set INTERAKT_API_KEY=your_key
supabase secrets set NOTIFY_WHATSAPP_NUMBER=+91XXXXXXXXXX

# Deploy edge function
supabase functions deploy notify-seal

# Push to GitHub → Vercel auto-deploys
git push origin main

# Vercel env vars to set:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY

# DNS: CNAME stuff → cname.vercel-dns.com
```

## TOKEN EFFICIENCY GUIDE

How to use minimal tokens in future Claude Code sessions:

1. CLAUDE.md is auto-read — never re-explain the stack in chat
2. Start each session: "Read CLAUDE.md and SPEC.md. Phase X is complete (check git log). 
   Implement Phase Y." — 30 words, full context.
3. For bugs: "Read CLAUDE.md. In [component], [specific behavior] is broken. 
   Check [file] first." — never paste code into chat.
4. @filename in Claude Code references files directly — use it.
5. End sessions at commit boundaries — a clean git log is your session memory.
6. If Claude Code drifts or hallucinates: start fresh session, point to the commit.
