# KRAFT PORTAL — UI/UX ENHANCEMENT PASS (UIUX\_PASS.md)

MODE: Execute phases in order. One commit per phase, message `uiux: <phase-name>`. Do NOT refactor, rename, or "improve" anything outside the listed scope. No new deps except where stated. Read CLAUDE.md first if not already loaded.

## HARD RULES (violating any \= wrong)

- Inline styles only. No Tailwind, no CSS files, no styled-components.  
- Reuse `src/theme.js` tokens \+ primitives in `src/components/ui/` (Card, Input, Pill, StatusBadge, SpecLabel). Extend primitives; don't fork one-off copies.  
- Money: paise int → render via ONE shared formatter (Task 7). Never divide inline.  
- Never hard-delete. Issued documents render from snapshot only.  
- Before touching any table/column: `grep` the actual name in src/ or check existing queries. Do not guess schema.  
- Writes go through `runWrite`/`flushQueue`. Never call supabase insert/update directly for user data.  
- Custom router (`RouterContext`), no react-router. No new routes without registering in the router \+ AppShell nav where relevant.  
- Minimal diffs. Do not reformat untouched lines. Do not add comments explaining obvious code.

## TOKEN DISCIPLINE (for you, Claude Code)

- Read only files you will edit \+ their direct imports. No repo-wide exploration.  
- Use grep/glob to locate symbols; don't open files speculatively.  
- No summaries between tasks. After each phase: one line — files changed \+ commit hash.  
- If a task's target file/symbol doesn't exist as described, STOP that task, report the mismatch in one line, continue to next task. Do not improvise a new location.

---

## PHASE 1 — shared formatters \+ contrast fix (foundation)

### Task 1.1: formatters

Create `src/lib/format.js`:

- `formatINR(paise)` → "₹1,23,456.00" (Indian grouping, `en-IN`, from paise int).  
- `formatRelative(ts)` → "2h ago" style (mins/hrs/days, fallback to date past 7d), IST.  
- `formatAbsolute(ts)` → "02 Jul 2026, 14:30 IST". Then grep for `toLocaleString`, `/100`, ad-hoc ₹ formatting across src/; replace money renders with `formatINR`. Feeds/lists use `formatRelative`; documents/PDFs use `formatAbsolute`. Do not change PDF layout logic, only the date/money strings.

### Task 1.2: contrast

Grep for amber `#e8930a` used as TEXT color on light backgrounds. Rule: amber is for fills/pills/borders with navy `#0B1B2E` text; never amber text on `#F6F3ED` or white. Fix violations in StatusBadge/Pill variants \+ anywhere else found. Keep amber-on-navy (dark fills) as-is.

## PHASE 2 — offline sync visibility

In `AppShell` next to the LIVE presence pill: a sync pill driven by the queue in `runWrite`/`flushQueue` (localStorage). States:

- hidden when queue empty \+ online  
- amber pill "N pending" when queue \> 0  
- brief (\~2s) green check pill after successful flush  
- grey "Offline" pill when navigator.onLine is false Expose queue length via a small subscription/event from the sync module (extend it minimally — e.g. emit on enqueue/flush). Mirror the pill in mobile bottom-nav area (compact dot \+ count is fine).

## PHASE 3 — dirty-form guard

Add to `RouterContext`: `setDirty(bool)` \+ navigation interception → if dirty, show confirm ("Unsaved changes — leave?") before route change. Also `beforeunload` listener while dirty. Wire into the highest-risk forms only: stuffing cargo-line editor, expense entry form, mail compose, booking form. Pattern: setDirty(true) on first change, setDirty(false) on save/discard/unmount-after-save. Reuse one small `useDirtyGuard()` hook in `src/lib/`.

## PHASE 4 — dashboard "Action Required" strip

On Stuffing dashboard, above stats, add an Action Required strip (Card \+ amber left border). Items (query cheaply, reuse existing data hooks where possible):

1. Containers on active voyage missing VGM  
2. Sealed containers with unsent Interakt notification (check existing sent-flag field — grep for how seal/notify status is stored; if none exists, SKIP and report)  
3. Unread mail count (reuse existing unread poll state)  
4. Documents in Draft state older than 24h Each item: count \+ label \+ chevron, deep-links via router to the filtered view. Empty state: single line "All clear" with green dot. Collapsible, remember collapsed in localStorage.

## PHASE 5 — voyage detail hub

Convert voyage detail into tabbed workspace. Tabs: Containers (current content) | Bookings | Documents | P\&L | Activity. Each tab \= existing section's list component filtered by `voyage_id` — REUSE the existing list components with a voyage filter prop; do not rebuild them. P\&L tab \= existing voyage\_pnl strip expanded (keep strip at top of all tabs). Activity tab \= audit feed filtered to this voyage's entities if the feed supports entity filters (grep first; if not feasible cheaply, filter client-side on loaded page). Tab state in URL/router param so deep links work.

## PHASE 6 — document lifecycle UI

- StatusBadge variants: Draft (grey), Issued (green), Void (red).  
- Documents list: voided rows → reduced opacity \+ line-through on doc number.  
- Document detail (voided): diagonal "VOID" watermark overlay (CSS transform, low opacity, non-interactive).  
- If schema has a supersede/reissue link field, render "Superseded by DOC-XXX" link; if not, add nullable `superseded_by` uuid column migration (verify table name first)  
  + set it in the existing void→reissue flow if one exists; otherwise just the column  
  + render, no new flow.

## PHASE 7 — global search polish

⌘K palette:

- Empty state: last 5 visited entities (track in localStorage on entity-page visit: {type, id, label, ts}) \+ static quick actions: New Booking, New Expense, Compose Mail, New Voyage → router navigations.  
- Mobile: add search icon to bottom nav opening the same palette full-screen.  
- Keep `global_search()` RPC \+ offline fallback untouched.

## PHASE 8 — mail density \+ entity linking

Mail list: one-line rows (sender bold, subject, relative time right-aligned, JetBrains Mono for detected refs). In list \+ reading pane, detect:

- container numbers: /\\b\[A-Z\]{4}\\d{7}\\b/  
- B/L numbers: grep the doc-number format from `next_doc_number()` usage and match it Highlight matches (amber underline, navy text); click → global\_search navigation for that ref. Run detection on sanitized output only (post-DOMPurify), never raw HTML.

---

## DONE CRITERIA

- `npm run build` clean after every phase.  
- No console errors on: dashboard, voyage detail, mail, documents, search palette.  
- Final report: ≤10 lines. Phases completed, phases skipped (with one-line reason), files touched count. Nothing else.

