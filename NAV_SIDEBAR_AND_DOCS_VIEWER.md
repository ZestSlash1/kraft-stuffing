# NAV_SIDEBAR_AND_DOCS_VIEWER.md

**Purpose:** Two additive changes to Kraft Portal:
(A) Replace the clustered top pill-nav with a **sectioned glass sidebar** (desktop) while keeping
mobile ergonomics intact.
(B) Add an **in-app PDF viewer** and **camera document scanning**, with scanned/uploaded files
attachable to voyages, bookings, and carting orders.

E-way bills are explicitly **out of scope** — do not build any e-way bill functionality.

For a **Claude Fable 5** Claude Code session. Additive + presentational only where marked; the
attachments feature is the only new data surface.

---

## 0. SESSION SETUP

1. `/model` → `claude-fable-5`.
2. Read pass (no edits): `src/components/AppShell.jsx`, `TopNav.jsx`, `BottomNav.jsx`,
   `CommandPalette.jsx`, `src/context/RouterContext.jsx`, `src/ui/theme.js`,
   `src/hooks/useIsMobile.js`, `src/lib/documents.js`, `src/views/DocumentsView.jsx`,
   one recent migration for schema conventions, and `package.json` (check whether `jspdf` /
   `pdfjs-dist` are already present before adding anything).
3. One file per turn, commit each, no re-reads of committed files, single `npm run build` at end.
4. All new UI in Loadex tokens from `src/ui/theme.js`. Inline styles only.

---

## 1. HARD INVARIANTS

- **Routing logic untouched.** `RouterContext` route names/handlers stay identical — the sidebar
  is a new presentation of the same routes. Every screen reachable today stays reachable.
- **⌘K CommandPalette stays** and gets *more* prominent, not less (see 2.4).
- **No changes** to data flow, `runWrite`/`flushQueue`, PDF generators, mail, RLS, money handling.
- **Attachments are additive**: one new table + one new Storage bucket. Never modify existing
  tables. Void-only semantics for attachments on issued documents (soft-delete flag), consistent
  with the rest of the app.
- **File uploads require connectivity** — do not attempt to queue binary files through the
  offline write queue. If offline, disable capture/upload affordances with a clear glass-tinted
  notice ("Reconnect to upload"); never let a user shoot 10 pages and silently lose them.
- **Camera never auto-uploads.** User reviews captured pages, then explicitly saves.
- **Viewer is read-only.** No annotation/editing of PDFs in v1.

---

## 2. (A) SIDEBAR NAVIGATION

### 2.1 Structure

Desktop (`!useIsMobile`): fixed left sidebar, ~240px expanded / 64px collapsed (icon rail),
`glass(0)` with right hairline border, full viewport height. Content area shifts accordingly in
`AppShell`. Collapse state persisted to `localStorage`.

Sections (label() headers, 1px hair divider between groups):

```
[Kraft logo + org]                ← top; click = AppSelectorView

OPERATIONS
  Dashboard
  Voyages
  Vessel Movements
  Bookings
  Manifest
  Container Log

DOCUMENTS
  Documents
  Carting Orders

FINANCE
  Expenses
  Voyage P&L

MAIL
  Inbox
  Compose

INSIGHTS
  Activity Feed
  Logs

────────── (pushed to bottom)
  Masters
  Team
  Settings
[SyncPill + PresenceAvatars row]  ← bottom strip
```

Map each item to the **existing** route names found in `RouterContext` — if any listed screen
doesn't exist as a route or is named differently, follow the real router, don't invent routes.

### 2.2 Item treatment

- Item: icon (lucide) + label, 40px min height, `R.chip` radius on hover/active.
- Active: soft `C.optimized`-tinted background (≈10% alpha) + 2px left accent bar + ink text;
  inactive `C.inkDim`, hover brightens to `C.ink`.
- Collapsed rail: icon-only with tooltip; section headers hide; active accent bar remains.
- Mail unread count / activity badge: small `F.mono` count chip, `GLOW.minor`, only if that count
  already exists in state — do not add polling to power a badge.

### 2.3 TopNav becomes a slim utility bar

`TopNav` keeps only: page title (from route), global search field (opens ⌘K), and the right
cluster (notifications, settings shortcut, avatar). Remove the pill route buttons on desktop —
they're the clutter being solved. Keep `TopNav` component; slim its contents.

### 2.4 Mobile

- Keep `BottomNav` with the 4–5 highest-traffic routes (Dashboard, Voyages, Bookings, Documents,
  More). "More" opens a full-screen glass drawer showing the same sectioned list as the desktop
  sidebar. No hover-dependent interactions anywhere on mobile.
- ⌘K palette: add a visible search affordance in the slim TopNav on mobile too (tap = palette).

### 2.5 Files

- New: `src/components/SideNav.jsx` (desktop sidebar + mobile drawer share the section config —
  define the section→route config **once** as a plain array in this file and render both from it).
- Edited: `AppShell.jsx` (layout slots), `TopNav.jsx` (slim down), `BottomNav.jsx` (More drawer
  trigger).

---

## 3. (B) PDF VIEWER + CAMERA SCAN + ATTACHMENTS

### 3.1 Viewer — `src/components/DocViewer.jsx`

- Full-screen glass overlay (same layer pattern as existing modals): toolbar (filename,
  page x/y, zoom −/+, download, share if `navigator.share` exists, close) + canvas area.
- Render with `pdfjs-dist` (add dependency only if absent). Render pages to canvas, virtualize:
  render current ±1 page only. Pinch/scroll zoom on mobile.
- Images (scans stored as images, if any) render in the same overlay via plain `<img>`.
- Entry points (reuse everywhere, one component):
  - `DocumentsView` / `CartingOrdersView`: "View" opens generated PDFs from Storage in DocViewer
    instead of a new tab (keep "open in new tab" as a secondary action in the toolbar).
  - Attachment lists (3.3): tap opens DocViewer.
  - Mail: if attachments are already surfaced in `InboxView`, PDF/image attachments open in
    DocViewer too; if mail attachments aren't currently implemented, **do not** build mail
    attachment fetching — skip this entry point.

### 3.2 Camera scan — `src/components/DocScanner.jsx`

- Trigger: "Scan document" action on voyage/booking/carting-order detail views (and inside the
  Attachments panel, 3.3).
- Capture via `<input type="file" accept="image/*" capture="environment" multiple>` — native
  camera on mobile, file picker fallback on desktop. **No getUserMedia custom camera UI in v1**
  (keeps scope sane and works offline-safe with the disable rule).
- Review screen: thumbnails of captured pages, reorder (up/down), remove, retake, rotate 90°.
- On save: client-side downscale each page (max long edge ~2000px, JPEG ~0.8) via canvas, then
  compose multi-page PDF with the **already-present jsPDF** (verify in package.json; it powers
  existing exports) — one page per image, A4, fit-with-margins. Single page can save as JPEG
  directly (smaller) — still viewable in DocViewer.
- Then upload (3.3). Show per-file progress; failures are retryable per file, never silent.

### 3.3 Attachments — the one new data surface

Migration (match real conventions from an existing migration before writing):

```sql
create table attachments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  parent_type text not null,        -- 'voyage' | 'booking' | 'carting_order' | 'document'
  parent_id uuid not null,
  file_name text not null,
  mime_type text not null,          -- application/pdf | image/jpeg
  size_bytes bigint not null,
  storage_path text not null,       -- Supabase Storage key
  source text not null default 'upload',  -- 'upload' | 'scan'
  voided_at timestamptz,            -- soft delete only
  created_by uuid,
  created_at timestamptz not null default now()
);
```

- New **private** Storage bucket `attachments`; RLS/storage policies mirroring the org-scoping
  pattern used by the existing documents bucket — copy that policy shape, don't design a new one.
- `src/components/AttachmentsPanel.jsx`: glass panel listing attachments for a parent (icon by
  type, name, size in `F.mono`, date), actions: view (DocViewer), download, void (confirm via
  existing `ConfirmDialog`). Buttons: "Upload file" (pdf/images) + "Scan document" (DocScanner).
- Mount `AttachmentsPanel` on: `VoyageDetailView`, `BookingDetailView`,
  `CartingOrderDetailView`. Nowhere else in v1.
- Upload path: direct Supabase Storage upload from client + one metadata insert. The metadata
  insert may go through the normal write path; the binary upload itself is online-only per the
  invariant.

### 3.4 Files summary

- New: `DocViewer.jsx`, `DocScanner.jsx`, `AttachmentsPanel.jsx`, one migration,
  `src/lib/attachments.js` (upload/list/void/signed-URL helpers — thin, no cleverness).
- Edited: the three detail views (mount panel), `DocumentsView`/`CartingOrdersView` (route "View"
  through DocViewer).

---

## 4. EXECUTION ORDER

1. Read pass (0.2).
2. `SideNav.jsx` + `AppShell` layout change.
3. `TopNav` slim-down, `BottomNav` More-drawer.
4. Attachments migration + `src/lib/attachments.js`.
5. `DocViewer.jsx`; wire into DocumentsView/CartingOrdersView.
6. `DocScanner.jsx`.
7. `AttachmentsPanel.jsx`; mount on the three detail views.
8. `npm run build`; fix compile errors only.

---

## 5. ACCEPTANCE CHECKLIST

- [ ] Every route reachable pre-change is reachable post-change (walk the router config).
- [ ] Desktop: sectioned sidebar, collapsible, state persisted; slim top bar; no pill route row.
- [ ] Mobile: BottomNav + More drawer; no hover-dependent nav; palette reachable by tap.
- [ ] ⌘K unchanged functionally and visibly accessible.
- [ ] Generated PDFs open in-app in DocViewer; new-tab remains as secondary action.
- [ ] Scan → review (reorder/rotate/remove) → multi-page PDF via existing jsPDF → upload →
      appears in AttachmentsPanel → opens in DocViewer.
- [ ] Offline: capture/upload affordances disabled with notice; nothing silently lost.
- [ ] Attachments void-only; private bucket; org-scoped policies copied from documents bucket.
- [ ] No e-way bill code anywhere.
- [ ] No changes to existing tables, write queue, PDF generators, mail logic, or route handlers.
- [ ] `npm run build` passes.
