# CARTING_ORDER_MODULE.md

**Purpose:** New standalone module in Kraft Portal — "Export Carting Order" — that lets a user
add containers one at a time (with weights, VGM, cargo type, value, package breakdown), auto-
aggregates the header summary lines, and outputs a **pixel-accurate replica** of the port
authority's carting order format (reference: `ILCU_1002028.pdf`, Kraft Shipping & Logistics Pvt.
Ltd. → D.D.M.O., K.P.D., Syama Parasad Mookerjee Port). Save / Print / View / Share all produce
the same exact layout, populated with whatever was entered.

Written for a **Claude Fable 5** Claude Code session against the Kraft Portal repo. This is an
**additive feature** — it must not alter existing stuffing, manifest, booking, or document logic.

---

## 0. SESSION SETUP

1. `/model` → `claude-fable-5`.
2. **Read before writing anything:**
   - `view src/lib/pdf/index.js`, `letterhead.js`, `footer.js`, `partyBlock.js`, `tables.js`,
     `terms.js`, `shared.js`, `hbl.js` (as a layout-pattern reference, not to copy content).
   - `view src/components/documents/DocumentGenerateMenu.jsx` and `DocumentDraftModal.jsx`.
   - `view src/views/DocumentsView.jsx`, `src/views/BookingDetailView.jsx`,
     `src/views/VoyageDetailView.jsx`, `src/data/manifestHelpers.js`, `src/lib/format.js`.
   - `view src/ui/theme.js` (Loadex tokens from the prior UI pass — reuse for this module's screens).
   - Check `supabase/migrations/*` for existing `voyages`, `bookings`, `containers`-type tables and
     their exact column names before writing any new migration — reuse existing IDs/FKs, don't
     duplicate data that already exists (vessel name, voyage no, rotation no, VCN, booking no,
     POL/POD should already live on `voyages`/`bookings` — pull them, don't re-enter them).
3. This repo already generates other port/shipping documents (arrival notice, delivery order,
   HBL) via `src/lib/pdf/**` with a shared letterhead/footer/table system and a frozen-jsonb-
   snapshot pattern via `DocumentDraftModal`/`DocumentGenerateMenu`. **Reuse that infrastructure**
   — the carting order is a new document *type* in that same system, not a parallel one. The
   "new standalone module" the user wants is the **data-entry screen** (per-container rows are
   unlike any existing document form), not a reimplementation of PDF/snapshot plumbing.
4. One file per turn, commit after each, no re-reading committed files, no dev-server loop —
   one `npm run build` at the end.
5. **Before finalizing the PDF template**, confirm with a quick visual diff against the actual
   `ILCU_1002028.pdf` that nothing below the table (signature line, stamp box, footer terms) was
   cropped out of the reference we worked from. If the real form has a footer/signature area not
   shown in the excerpt Claude was given, reuse `src/lib/pdf/footer.js` for it rather than
   inventing one — flag this to the user if `footer.js`'s existing footer doesn't obviously fit.

---

## 1. HARD INVARIANTS

- **Money in integer paise**, everywhere — `Value` per container is entered in rupees in the UI
  but stored/summed as paise internally, matching the rest of the app.
- **Frozen snapshot on issue.** The moment an order is generated (Save/Print/View/Share), render
  it from a frozen `jsonb` snapshot of the entered data — exactly like other documents in
  `src/components/documents/**`. Editing containers afterward creates a new version, it does not
  mutate the issued snapshot. **No hard deletes** — corrections are new versions or void, never
  overwrite/delete.
- **Do not touch:** existing stuffing/container/booking tables' write paths, `runWrite`/
  `flushQueue`, RLS policies, existing PDF modules for other document types, `useDirtyGuard`
  gating patterns (reuse them, don't rewrite them).
- **Auto-pulled fields (vessel, voyage no, rotation no, VCN, booking no, POL/POD) are read-only
  in this UI**, sourced from the existing voyage/booking record — never duplicated as free-typed
  fields that could drift from the source of truth.
- **VGM WT is an independent manual field.** Do not calculate it as Cargo Gr. Wt + Tare WT — the
  reference document's own numbers don't reconcile that way (verified weight vs. component sum
  are legitimately different in this domain). Never silently "fix" or derive it.
- **Inline styles only** for the data-entry UI, using `src/ui/theme.js` tokens (this module is
  new UI, so it should already be built in the Loadex visual language, not a plain form).
- **Offline-first parity:** container rows being added before a save should behave like other
  offline-capable entry flows in this app (`OfflineBanner`/`SyncPill` conventions) — don't build a
  form that silently loses data if connectivity drops mid-entry.

---

## 2. DATA MODEL (new, additive — verify against existing schema first per Section 0.2)

Two new tables. Names illustrative — match existing snake_case/FK conventions once real schema
is inspected.

```sql
-- carting_orders: one row per issued/draft order (order-level fields)
create table carting_orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,                    -- match existing multi-tenant pattern if present
  voyage_id uuid not null references voyages(id),
  booking_id uuid references bookings(id), -- nullable: an order can span/relate to a booking, optional
  order_date date not null default current_date,
  pol text not null,                       -- prefilled from voyage, editable override
  pod text not null,
  till_text text not null default 'Till Finish',
  status text not null default 'draft',    -- draft | issued | void
  snapshot jsonb,                          -- frozen full render payload once issued
  issued_at timestamptz,
  voided_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

-- carting_order_containers: one row per container line in the order
create table carting_order_containers (
  id uuid primary key default gen_random_uuid(),
  carting_order_id uuid not null references carting_orders(id) on delete restrict,
  sl_no int not null,                      -- display order, 1-indexed, auto-managed
  container_no text not null,
  size_type text not null,                 -- '20', '40', '40HC' etc.
  cargo_gr_wt_kgs numeric not null,
  tare_wt_kgs numeric not null,
  vgm_wt_kgs numeric not null,             -- independent manual entry, see invariant above
  cargo_type text not null,                -- groups header aggregation
  value_paise bigint not null,             -- integer paise
  package_lines jsonb not null default '[]', -- [{ "qty": 471, "unit": "PC" }, { "qty": 45, "unit": "PKGs" }, ...]
  created_at timestamptz not null default now()
);
```

No hard deletes on either table — a removed container line before issue can be a real delete
(it's still a draft), but once `status = 'issued'`, both tables become read-only and corrections
happen via a new order version, consistent with the rest of the app's void/no-hard-delete pattern
for issued documents.

---

## 3. AGGREGATION LOGIC (pure functions, no writes — put in `src/data/cartingOrderHelpers.js`)

```js
// groupByCargoType(containers) → [{ cargoType, grWtTotalKgs, valuePaiseTotal, packageLines }]
// - group containers by cargo_type
// - grWtTotalKgs = sum of cargo_gr_wt_kgs in group
// - valuePaiseTotal = sum of value_paise in group
// - packageLines = merge package_lines across the group's containers, summing qty for lines
//   with matching `unit` in first-seen order (mirrors the reference doc's "471 PC, 45 PKGs,
//   18 PKGs" — don't collapse different qty entries that share a unit into one, only sum
//   matching units; if a container has two lines with the same unit, both contribute to that
//   unit's running total)

// containerCountSummary(containers) → e.g. "1X20" or "2X20, 1X40"
// - group ALL containers (regardless of cargo type) by size_type, count each, format "NxSIZE",
//   join with ", " — this line is order-wide, not per cargo-type group

// nextSlNo(containers) → containers.length + 1
```

Both the live on-screen preview and the final PDF render must call these same functions — do not
duplicate the aggregation math in two places.

---

## 4. UI — new screen(s)

### `src/views/CartingOrdersView.jsx`
List of carting orders (draft + issued) for the current voyage/org — glass cards, `StatusBadge`
for draft/issued/void, `F.mono` for booking no / date. Reuse `AppShell`/`TopNav` — add a nav entry
alongside Documents/Manifest per the "new standalone module" placement.

### `src/views/CartingOrderDetailView.jsx`
The core entry screen:
- **Header panel** (glass, read-only): vessel, voyage no, rotation no + date, VCN, booking no,
  POL/POD — pulled from the voyage/booking record, with a small "override" affordance only if a
  genuine exception is needed (e.g. edge-case corridor change), not as the default path.
- **Order fields**: order date (defaults today), "till" text — small editable inputs.
- **Container entry table** — this is the working surface:
  - Add-row action opens an inline row or small modal (reuse `CreateBookingModal`-style pattern)
    with fields: Container No., Size/Type (dropdown of known sizes), Cargo Gr. Wt, Tare WT,
    VGM WT, Cargo Type, Value (rupees, converted to paise on save), and a repeatable
    "package line" mini-list (qty + unit, add/remove rows).
  - If a container number matches one already known to this voyage/booking (existing stuffing
    data), **prefill** Size/Type, Cargo Gr. Wt, Tare WT from that record — user only needs to
    confirm/add VGM, cargo type, value, and package lines, which likely don't exist elsewhere yet.
    Never overwrite the source stuffing record from this screen.
  - Table itself styled per the shared dense-table pattern from `LOADEX_UIUX_MASTER.md` Section 7
    (`tableRow()`, `F.mono` numerics, sticky glass header) — but the **column set and order must
    match the reference PDF exactly**: Sl.NO. / Container Nos. / Size/Type / Cargo Gr. Wt.(KGS) /
    Tare WT.(KGS) / VGM WT(KGS). Cargo type, value, and package lines are edited via the row's
    add/edit affordance but are not extra visible table columns — they feed the header summary,
    matching how the reference document itself doesn't show them per-row either.
- **Live header preview**: as containers are added, render the exact stacked summary blocks
  (one per cargo type, via `groupByCargoType`) plus the "NxSIZE" line, so the user sees precisely
  what the PDF will say before generating it.
- **Actions**: Save (draft, no snapshot yet), Print / View / Share (each calls the same PDF
  generator in Section 5, differing only in what happens to the resulting file — open print
  dialog, open in a viewer, or trigger native/share-sheet download — and each transitions the
  order to `issued` + writes the `snapshot` on first generation, per the invariant in Section 1).

Use `src/ui/theme.js` tokens throughout — this screen should visually match the rest of the
Loadex-reskinned app, not look like a bolted-on plain form.

---

## 5. PDF TEMPLATE — `src/lib/pdf/cartingOrder.js`

Build this using the **same helper modules** as the other document types (`letterhead.js`,
`footer.js`, `partyBlock.js`, `tables.js`, `shared.js`) so visual consistency with arrival notice/
D.O./HBL is automatic, not re-derived.

Exact layout, top to bottom, matching `ILCU_1002028.pdf`:

1. **Letterhead** (existing `letterhead.js` — logo + "Kraft Shipping and Logistics Pvt. Ltd." +
   address/tel line + rule). Do not modify this helper's output.
2. **Two-column header row**: left = "TO / The D.D.M.O / K.P.D. / SYAMA PARASAD MOOKERJEE PORT /
   Kolkata" (fixed text); right = "DT: {order_date, formatted DD.MM.YY}." then below it
   "POL : {pol}" / "POD: {pod}". Use `partyBlock.js` if its two-column layout fits; otherwise a
   simple two-column table via `tables.js`.
3. **Per-cargo-type summary blocks** (one per group from `groupByCargoType`, stacked in order):
   `Gr. WT.{grWtTotalKgs formatted to 2dp} KGS, {packageLines joined as "{qty} {unit}"} CARGO:
   {cargoType}.` then on its own line `VALUE : RS. {valuePaiseTotal / 100 formatted to 2dp}`.
4. Blank line, then **Booking No: {booking_no}** (label bold+underlined per reference, value bold).
5. Blank line, centered bold: **Export Carting Order for KPD/KOLKATA** (or the port code embedded
   in the recipient block, if that ever varies — keep it derived from the same source as line 2,
   not hand-typed separately).
6. `Please allow {containerCountSummary}, house stuffed export containers per M.V. {vessel_name}
   VOY No: {voyage_no}` — bold for the `{containerCountSummary}` and `{vessel_name}` tokens per
   the reference's bolding.
7. `.EXP.Rot No. {rot_no} Dt. {rot_dt formatted} VCN: {vcn} , UPTO {till_text}`
8. Bold: **SHIPPER : KRAFT SHIPPING & LOGISTICS PVT LTD** (or the real shipper if this ever needs
   to vary — default constant).
9. **Container table** via `tables.js`, exact columns/widths/header wrapping as the reference:
   `Sl. NO.` / `Container Nos.` / `Size / Type` / `Cargo Gr. Wt. (KGS)` / `Tare WT. (KGS)` /
   `VGM WT (KGS)`. Populate rows from the order's containers in `sl_no` order. If fewer than the
   reference's ~8 visible rows, either pad with blank ruled rows (matching the reference's blank
   trailing rows) or size the table to content — match whichever convention the existing
   `tables.js` helper already uses for variable-length tables elsewhere in this repo.
10. Whatever comes after the table in the real (uncropped) document — reuse `footer.js` if it's a
    signature/stamp block already used elsewhere; do not invent new footer content.

**Number formatting:** weights to 2 decimal places, values to 2 decimal places with the `RS.`
prefix, dates as `DD.MM.YY` matching the reference (`04.07.26`), all via `src/lib/format.js` if it
already has these formatters — extend it rather than writing new ad hoc formatting inline.

---

## 6. WIRE INTO EXISTING DOCUMENT INFRASTRUCTURE

- Add "Export Carting Order" as a document type option in
  `src/components/documents/DocumentGenerateMenu.jsx`, pointing at the new generator.
- `src/components/documents/DocumentDraftModal.jsx` snapshot/issue flow should be reused for the
  issue-and-freeze step — don't build a second snapshot mechanism.
- Add the new nav entry (`CartingOrdersView`) alongside Documents/Manifest in whatever nav
  structure `TopNav`/routing already uses — this satisfies "new standalone module" while the
  generation/versioning/freeze mechanics ride on infrastructure that already exists and is
  already trusted.

---

## 7. EXECUTION ORDER

1. Section 0 read pass (theme, existing pdf modules, existing schema) — no edits yet.
2. Migration for the two new tables (Section 2), matching real existing FK/column conventions.
3. `src/data/cartingOrderHelpers.js` (Section 3) — pure functions, unit-testable mentally before
   wiring to UI.
4. `src/lib/pdf/cartingOrder.js` (Section 5), built on existing pdf helpers.
5. `src/views/CartingOrdersView.jsx` (list).
6. `src/views/CartingOrderDetailView.jsx` (entry screen + live preview + actions).
7. Wire into `DocumentGenerateMenu`/`DocumentDraftModal`/nav (Section 6).
8. `npm run build`; then a manual check: generate one order with the exact reference data
   (container `ILCU 1002028`, 15700.00/2180.00/13520.00, Plywood, 471 PC/45 PKGs/18 PKGs,
   1500000.00) and confirm the output matches `ILCU_1002028.pdf` line-for-line.

---

## 8. ACCEPTANCE CHECKLIST

- [ ] Single-container order reproduces `ILCU_1002028.pdf` exactly (text, layout, bolding, table).
- [ ] Multi-container, single-cargo-type order: one summary block, correctly summed.
- [ ] Multi-container, multiple-cargo-type order: one stacked summary block per cargo type, each
      summed only from its own group; "NxSIZE" line still spans all containers regardless of type.
- [ ] VGM WT is never auto-calculated from Cargo Gr. Wt + Tare WT.
- [ ] Vessel/voyage/rotation/VCN/booking-no/POL/POD are pulled, not retyped.
- [ ] Values stored as integer paise end-to-end; displayed as rupees only at the edges (form, PDF).
- [ ] Issuing (Save/Print/View/Share) freezes a jsonb snapshot; later edits create a new
      version/void, never mutate the issued record.
- [ ] No existing stuffing/booking/document logic changed; new tables only.
- [ ] Entry screen matches the Loadex visual language from the prior UI pass.
- [ ] `npm run build` passes.
