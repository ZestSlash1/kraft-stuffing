# PHASE: IGM / BL Manifest Entry Module (Prototype)

**Scope note:** This is an internal prototype for Kraft Shipping & Logistics' own use inside Kraft Portal. It is a clean re-implementation based on functional requirements (what fields/workflow are needed to file IGM data), not a copy of any third-party vendor's code, database, UI, or compiled files. Do not import, reference, or copy any files, layouts, screen structure, labels, or code lists from the legacy "Nvocc App" installation — build all schema, UI, and logic fresh from the field/workflow description below. No ICEGATE submission integration in this phase — output is a downloadable JSON file only, for manual upload.

## 0. Design originality requirement

The legacy app is a 9-tab flat form replicating a 1990s-style Windows desktop layout (tab strip: Enquiry → Basic Entry → Shipper/Consignee → Shipper...Icegate → Marks & Descriptions → Cargo Details → Container Details → Freight Details → Freight Manifest). **Do not reproduce that structure, tab order, tab naming, or visual layout.** Instead:

- Design the information architecture from first principles around the *data relationships* (a voyage has BLs, a BL has parties/cargo/containers), not around mimicking a legacy tab sequence.
- Use Kraft Portal's own established interaction patterns (the same component/section patterns used in Stuffing Log or Documentary Suite) rather than a tabbed form-per-screen model.
- Field labels, grouping, and order should reflect what makes sense for someone using Kraft Portal today, not the legacy field ordering.
- Any resemblance should be limited to unavoidable domain terminology (BL Number, Port of Loading, HSN, IMDG, VGM, etc. — these are industry-standard terms, not the vendor's IP) — not to screen layout, navigation model, or visual design.

## 1. Purpose

Add a manifest/BL entry module to Kraft Portal (portal.shafrina.com) that supports the same underlying workflow — Voyage entry, BL entry, cargo/container line items — with an original, modern UX, and generates an ICEGATE-format JSON export. Integrates with Kraft Portal's existing voyage/vessel data where possible.

## 2. Functional requirements (functionality only — re-derived, not a layout spec)

### 2.1 Voyage record
A voyage needs: vessel identity (name, code, IMO number, call sign), voyage number, GRT/NRT, terminal operator, IGM number + date, vessel type, cargo summary description, purpose of call, transport mode, arrival port, last port of call, next port of call, crew count, passenger count, containers landed/loaded, ETA/ATA/ETD, sailing date, voyage reference.

### 2.2 Bill of Lading (BL) record
Each BL, linked to a voyage, needs: BL number + date, master BL number + date, freight-payable-at location, feeder vessel/voyage, mother vessel, port of receipt, port of loading, discharge port, delivery place, gross/net weight + unit, package count + unit, consolidated indicator, cargo type, nature of cargo, hazmat flag + UNO/IMO class if applicable, line number.

### 2.3 Parties per BL
Each BL has up to 6 party roles: Consignee, Forwarder, Notifier 1, Notifier 2, Shipper, Delivery Agent. Each party record: name, address (2 lines), city, PIN, state, country, email, PAN/code number.

### 2.4 Marks & description
Free-text marks and free-text description per BL.

### 2.5 Cargo lines
Per BL, one or more lines with: HSN code, UNO code, IMDG class, package count, package unit, cargo description.

### 2.6 Container lines
Per BL, one or more containers with: container number, size, type, seal type + number, VGM, package count, gross weight, tare weight, FCL/LCL flag, SOC flag, arrival/dispatch mode, temperature (reefer), cell location, dangerous cargo mark.

### 2.7 Export
A "Generate ICEGATE JSON" action per voyage that serializes voyage + all BLs + parties + cargo + container lines into a JSON file, downloadable. Exact field names/structure to be finalized once real sample output is available for reference — build the export as a clearly isolated module (`generateIgmJson(voyage)`) so the mapping layer can be swapped without touching the UI or data model.

## 3. Data model (Supabase / Postgres, RLS per Kraft Portal convention)

```sql
manifest_vessels        -- vessel master (name, code, imo_no, call_sign, grt, nrt)
manifest_voyages        -- fk vessel_id, voyage_ref, igm_no, igm_date, ports, eta/etd,
                         -- crew_count, pax_count, cntrs_landed, cntrs_loaded, status
manifest_bls            -- fk voyage_id, bl_number, bl_date, mbl_number, mbl_date,
                         -- feeder_vessel, feeder_voyage, mother_vessel,
                         -- port_of_receipt, port_of_loading, discharge_port, delivery_place,
                         -- gross_wt, net_wt, weight_unit, packages, package_unit,
                         -- consolidated_indicator, cargo_type, nature_of_cargo,
                         -- haz_cargo (bool), uno_code, imo_class, line_no
manifest_bl_parties     -- fk bl_id, party_type (enum: consignee/forwarder/notifier1/notifier2/shipper/dl_agent),
                         -- name, address_1, address_2, city, pin, state, country, email, pan
manifest_bl_marks       -- fk bl_id, marks_text, description_text
manifest_bl_cargo_lines -- fk bl_id, seq, hsn_code, uno_code, imdg_class, pkgs, pkgs_unit, description
manifest_bl_containers  -- fk bl_id, seq, container_no, size, type, seal_type, seal_no, vgm,
                         -- pkgs, gross_wt, tare_wt, fcl_lcl, soc, arr_mode, disp_mode,
                         -- temperature, cell_location, dng_mark
```

All tables: `id uuid pk default gen_random_uuid()`, `created_at`/`updated_at` in IST, `void_at`/`void_reason` nullable (void-only deletion per portal convention), RLS scoped to authenticated portal users.

## 4. UI/UX requirements

- Follow Kraft Portal hard invariants: Vite + React, inline styles only via `src/ui/theme.js` tokens, no Tailwind, no CSS files, offline-first via `runWrite`/`flushQueue`, IST timezone everywhere.
- **No tab-strip-per-screen legacy pattern.** Use a single scrollable BL entry view with sticky section anchors (e.g. Overview → Parties → Cargo → Containers), consistent with how other Kraft Portal modules are laid out.
- **Voyage list/detail view** — create/edit voyage, list of BLs under it.
- **Parties** — accordion or card-based sub-sections per role, not a flat radio-button party-type list like the legacy screen.
- **Cargo & container lines** — editable grid/table components (add row, delete row, inline edit), matching the pattern already used in Stuffing Log's challan import.
- **Typeahead pickers** for Vessel, Voyage, Port fields instead of raw dropdowns.
- **Inline validation**: container number ISO 6346 check-digit validation, PAN format check, required-field highlighting.
- **Autosave / draft state indicator** — no blind Save button; show "saved" / "unsaved changes" status.
- **Export panel** on voyage detail view: "Generate ICEGATE JSON" button, downloads file, shows a preview/summary before download.

## 5. Build sequence

1. Migrations for the 6 tables above + RLS policies
2. Voyage CRUD (list, create, edit)
3. BL entry form — Overview + Parties + Marks (core CRUD, single BL)
4. Cargo lines + Container lines grid components
5. BL list under a voyage (search/filter by consignee, POD, date)
6. JSON export module (`generateIgmJson`) + download UI, using placeholder field mapping (to be corrected once real ICEGATE sample output is available)
7. Polish pass: validation, autosave indicators, empty states

## 6. Explicitly out of scope for this phase

- Direct ICEGATE API submission/integration
- Any code, schema, UI layout, or code list copied or closely modeled from the legacy vendor app
- EGM 1.5, Landing/Survey, Arrival Notice, Carting/Slot Letter reports (legacy "Reports" menu items beyond the core IGM JSON) — defer until core BL entry is solid
- Legacy utilities: Line No Allotment, Container Enquiry, Empty Container Transfer — defer, revisit only if actually needed for daily ops
