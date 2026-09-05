# STUFFING_CARGO_ITEMS.md

**Purpose:** Change the stuffing log so a container can hold **multiple, free-typed cargo line
items** (any commodity, any package type — bags, bundles, crates, pieces, cartons, etc.), not one
fixed cargo type per container. This becomes the **source of truth** for cargo content, and the
already-drafted Carting Order module (`CARTING_ORDER_MODULE.md`) must be amended to pull from it
instead of asking for cargo type/packages a second time. **Apply this spec's Section 4 amendment
before building the Carting Order module** — build them together, in the order given in Section 5.

For a **Claude Fable 5** Claude Code session.

---

## 0. SESSION SETUP

1. `/model` → `claude-fable-5`.
2. Read pass (no edits): `src/data/cargoLayout.js`, `src/components/ContainerCard.jsx`,
   `src/components/ContainerInfoOverlay.jsx`, `src/views/ContainerLogView.jsx`,
   `src/data/manifestHelpers.js`, `src/components/ManifestTable.jsx`, `src/lib/exportManifestPdf.js`,
   `src/lib/exportXlsx.js`, `src/lib/recentEntities.js` (this likely already powers autocomplete
   elsewhere — reuse it for cargo description suggestions rather than building new autocomplete).
3. **Findings note first:** confirm exactly where "cargo type" currently lives today (a single
   text field? an enum/dropdown of known commodities like Onion/Rice/Potato/Plywood? on the
   container row or the booking row?) and every place that field is read (manifest table, PDF
   exports, xlsx exports, any existing summary/report). The migration must backfill every one of
   these correctly — don't guess the current shape.
4. One file per turn, commit each, single `npm run build` at the end.

---

## 1. HARD INVARIANTS

- **Value stays per-container, not per cargo item** (confirmed) — do not split value across items.
- **Free text, not a constrained enum.** The description field must accept anything typed —
  onion, rice, potato, plywood, machinery parts, whatever — with autocomplete-from-history as a
  convenience, never a restriction. Never validate against a fixed commodity list.
- **No data loss on migration.** Every container's existing single cargo type (whatever its real
  shape, per findings) becomes the first/only item in its new cargo-items list — nothing is
  dropped or blanked.
- **Offline-first parity:** adding/editing cargo item rows goes through the existing
  `runWrite`/`flushQueue` path like any other stuffing-log edit — no new write mechanism.
- **No hard deletes on issued/frozen records.** If a container's stuffing entry is already
  referenced by an issued document snapshot, editing its live cargo items must not retroactively
  change that snapshot — snapshots stay frozen exactly as today.
- **Inline styles only**, using the app's existing dark Loadex tokens (this is operational
  stuffing-log UI, not the mail module — stays on `src/ui/theme.js`, not `mailTheme.js`).

---

## 2. SCHEMA CHANGE

Adapt exact table/column names to the real findings from Section 0.3. Expected shape: containers
currently have a `cargo_type` (or similarly named) column directly on the container/stuffing row.

```sql
-- New child table — one row per cargo line item per container
create table container_cargo_items (
  id uuid primary key default gen_random_uuid(),
  container_id uuid not null references <containers table>(id) on delete cascade,
  sort_order int not null default 0,
  description text not null,        -- free text: "Onion", "Plywood sheets", "Machine parts", etc.
  qty numeric not null,
  unit text not null,                -- free text or small suggested list: PC, PKGs, Bags, Bundles,
                                      -- Crates, Cartons, Rolls, Boxes — suggestions, not enum
  created_at timestamptz not null default now()
);

-- Backfill: one row per existing container from its current single cargo_type field.
-- Use the real qty/unit if the existing schema has package-count fields (per findings);
-- if no qty/unit exists today, default qty to null-safe 1 and unit to a sensible placeholder
-- ("PKG") and flag every backfilled row for user review in the UI (small "unreviewed" badge)
-- rather than inventing numbers that look authoritative.

-- Keep the old cargo_type column in place, unused, for one release (safety net), then a follow-up
-- migration can drop it once confirmed nothing else reads it.
```

---

## 3. UI CHANGE — stuffing entry form

- Wherever cargo type is currently entered (per findings — likely inside `ContainerCard.jsx` /
  `ContainerInfoOverlay.jsx` / the add/edit container flow in `ContainerLogView.jsx`), replace the
  single field with a **repeatable cargo-item list**:
  - Row: description (free-text input with autocomplete suggestions sourced from
    `recentEntities.js` — past descriptions this org has typed, most-recent/most-frequent first),
    qty (numeric), unit (free-text input with a small suggestion chip row: PC / PKGs / Bags /
    Bundles / Crates / Cartons — tapping a chip fills the field, typing anything else is still
    allowed).
  - Add-row / remove-row controls; at least one row required to save.
  - Backfilled containers show their single migrated row with a small "please confirm" badge
    until the user opens and re-saves that container's entry once.
- `ManifestTable.jsx` and any container summary display: render cargo as a joined string of
  `"{qty} {unit} {description}"` items comma-separated (matching the reference document's own
  style — e.g. "471 PC Plywood, 45 PKGs Bundles"). Build this via one shared formatter function,
  used everywhere cargo needs to display as text, so the join logic isn't duplicated.
- `exportManifestPdf.js` / `exportXlsx.js`: same shared formatter for the cargo column/cell.

---

## 4. AMENDMENT TO `CARTING_ORDER_MODULE.md` — apply before building it

The earlier spec gave each `carting_order_containers` row a single `cargo_type text` +
`package_lines jsonb`, manually entered at carting-order time. That's now wrong — it duplicates
data this module already captures. Changes to make when building the Carting Order module:

- **Drop** `cargo_type` and `package_lines` from `carting_order_containers`. A carting order
  container row now only needs its own fields (container no, size/type, weights, VGM, value) —
  cargo content is read live from that container's `container_cargo_items` at generation time
  (or copied into the frozen snapshot at issue time, per the existing freeze invariant — copy,
  don't re-reference, so the issued PDF never changes if cargo items are edited afterward).
- **`groupByCargoType` becomes `groupByCargoDescription`**, and it now groups **cargo items**
  across all containers in the order (via each container's `container_cargo_items`), not
  containers themselves — a single container can legitimately contribute to more than one summary
  block if it holds multiple commodities.
- **Value attribution when a container has multiple cargo types:** since value is per-container
  (confirmed, Section 1), a mixed-cargo container's value cannot be cleanly split across multiple
  header groups. Default behavior: attribute the container's full value to the group for its
  **first-listed** cargo item (`sort_order = 0`), and show a small inline note in the
  `CartingOrderDetailView` preview ("Container {no}: value counted under {first item}") whenever a
  container has more than one cargo item — so the person building the order sees the approximation
  and can manually adjust which containers go on separate orders if precision matters for a
  specific shipment. Do not attempt to auto-split value proportionally by weight or item
  count — that would fabricate precision the data doesn't support.
- **Container-count-by-size summary line ("1X20") is unaffected** — it was already order-wide, not
  cargo-type-scoped.
- Everything else in `CARTING_ORDER_MODULE.md` (PDF layout, freeze/snapshot behavior, document
  infrastructure reuse, VGM-is-manual invariant) stays as written.

---

## 5. EXECUTION ORDER

1. Findings note (0.3).
2. Migration + backfill (Section 2).
3. Shared cargo-display formatter (Section 3's join function) — one place, reused everywhere.
4. Stuffing entry form change (repeatable cargo-item rows + autocomplete).
5. `ManifestTable.jsx`, `exportManifestPdf.js`, `exportXlsx.js` updated to the shared formatter.
6. Build `CARTING_ORDER_MODULE.md` **with the Section 4 amendment already applied** — i.e. its
   schema/aggregation should be written the corrected way from the start, not built then patched.
7. `npm run build`. Manual check: open a pre-existing container, confirm its migrated cargo item
   shows with the "please confirm" badge; add a second cargo item to a container; generate a
   carting order and confirm the container now appears correctly in two summary groups with the
   value-attribution note visible.

---

## 6. ACCEPTANCE CHECKLIST

- [ ] Cargo description field accepts free text — no commodity restricted to a preset list.
- [ ] Every pre-existing container's cargo data migrated with zero loss; backfilled rows flagged
      for one-time confirmation.
- [ ] A container can hold 2+ cargo items, each with independent description/qty/unit.
- [ ] Cargo display (manifest table, PDF export, xlsx export) uses one shared formatter function.
- [ ] Carting Order module reads cargo items live/at-freeze from this data — no duplicate manual
      cargo entry in the carting order screen.
- [ ] Multi-cargo-type containers correctly appear in multiple carting-order summary groups; value
      attributed to the first-listed item with a visible note, never silently split.
- [ ] Offline write behavior for cargo-item edits matches the rest of the stuffing log.
- [ ] Issued document snapshots remain frozen even if a container's live cargo items change later.
- [ ] `npm run build` passes; manual check in Section 5.7 done.
