# MAIL_UI_REDESIGN.md

**Purpose:** Restyle the mail module only — inbox, thread view, compose, folder rail — into a
light, airy, blue-accented consumer-mail aesthetic matching the two reference images (mobile
"Unified Mailbox" card UI + desktop sidebar/list/reading-pane UI). Responsive: one component set
that works on both web and mobile, not two parallel builds. **Rest of Kraft Portal (dashboard,
voyages, manifest, expenses, carting orders) is untouched and stays on the dark Loadex theme.**

For a **Claude Fable 5** Claude Code session. Builds on `MAIL_MULTI_ACCOUNT.md`,
`MAIL_PER_ACCOUNT_SETTINGS.md`, and `NAV_SIDEBAR_AND_DOCS_VIEWER.md` — read those for context on
the account switcher, DocViewer, and AttachmentsPanel this reuses rather than reinvents.

---

## 0. SESSION SETUP

1. `/model` → `claude-fable-5`.
2. Read pass (no edits): `src/views/mail/*`, `src/ui/theme.js`, `src/components/DocViewer.jsx`,
   `src/components/AttachmentsPanel.jsx`, `src/components/SideNav.jsx`, `src/hooks/useIsMobile.js`.
3. **This module gets its own token file**, `src/ui/mailTheme.js` — do not add these light-theme
   values to `src/ui/theme.js` and do not let any non-mail view import from `mailTheme.js`. The
   two coexist; nothing global changes.
4. One file per turn, commit each, single `npm run build` at the end.

---

## 1. HARD INVARIANTS

- **Scope: mail views only.** `src/views/mail/**` and mail-specific components. No edits to
  `AppShell`, `SideNav`, dashboard, voyages, expenses, carting orders, or their tokens.
- **No new mail actions beyond what the backend actually supports.** The desktop reference shows
  a rich context menu (reply, reply all, forward, forward as attachment, mark unread, move to
  junk, mute, delete, star/rate, archive, move to, copy to). Before wiring any menu item, check
  it against real handlers in `api/mail/*` (from the multi-account work). **Only include actions
  that call a real, working endpoint.** Anything without a backend (e.g. star-rating, move-to-
  folder, copy-to, mute, forward-as-attachment) is either omitted from the menu entirely or shown
  disabled with a "coming soon" tooltip — never wired to a no-op or fake success toast.
- **Account switcher = the existing multi-account selector**, restyled to match the "Unified
  Mailbox ▾" pill in the mobile reference. Do not build a second account-switching mechanism —
  this is a skin on `MailShell`'s existing dropdown from `MAIL_MULTI_ACCOUNT.md`.
- **Attachment chips open the existing `DocViewer`.** Do not build a second PDF/image preview.
- **Offline/error states preserved:** per-account fetch failures still surface (per multi-account
  invariant), just restyled to fit the light theme instead of dark glass.
- **Accessibility:** this is a lighter background — hold contrast ≥4.5:1 for body text against the
  light canvas (don't assume light-mode is automatically accessible; check actual hex values).
  Focus states, ≥40px hit targets, `prefers-reduced-motion` all still apply.

---

## 2. DESIGN TOKENS — `src/ui/mailTheme.js` (new, mail-only)

```js
// src/ui/mailTheme.js — light, blue-accented, consumer-mail aesthetic. Mail views only.

export const MC = {
  canvas:     '#f3f4f6',   // soft neutral background behind cards
  canvasAlt:  '#eef1f5',
  surface:    '#ffffff',   // cards, panes
  border:     '#e6e8ec',
  hair:       '#eceef2',

  ink:        '#1a1d24',
  inkDim:     '#6b7280',
  inkFaint:   '#9aa1ab',

  blue:       '#2f6bff',   // primary accent — badges, active states, CTA
  blueSoft:   '#eaf0ff',   // tag chip / hover background
  blueDeep:   '#1f4fd6',

  tagWork:    '#f4ead9',   // "Work" chip bg (warm neutral, from reference)
  tagWorkInk: '#8a6a3a',

  danger:     '#e5484d',
  success:    '#12b886',
};

export const MR = { chip: 10, card: 18, pill: 999, panel: 20 };
export const MSP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Readable humanist sans for mail body/subject/sender — distinct from the app's industrial
// Barlow Condensed/JetBrains Mono, matching the reference's clean consumer feel.
export const MF = {
  body: `'Inter', system-ui, sans-serif`,
  mono: `'JetBrains Mono', ui-monospace, monospace`,  // timestamps, counts only
};

export const mailCard = (radius = MR.card) => ({
  background: MC.surface,
  border: `1px solid ${MC.border}`,
  borderRadius: radius,
  boxShadow: '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -12px rgba(16,24,40,0.10)',
});

export const mailPill = (active) => ({
  borderRadius: MR.pill,
  padding: `${MSP.xs}px ${MSP.lg}px`,
  font: `600 13px ${MF.body}`,
  background: active ? MC.blue : MC.surface,
  color: active ? '#fff' : MC.inkDim,
  border: active ? 'none' : `1px solid ${MC.border}`,
});

export const tagChip = (variant = 'new') => ({
  new:  { background: MC.blueSoft, color: MC.blueDeep },
  work: { background: MC.tagWork,  color: MC.tagWorkInk },
}[variant] ?? { background: MC.canvasAlt, color: MC.inkDim });
```

Add `Inter` to `index.html` font links if not already present (check first — many stacks already
ship it as a system-ui fallback source).

---

## 3. LAYOUT — responsive from one component set

### Mobile (`useIsMobile`) — matches reference image 1
- Top bar: avatar, centered **"{Account label} ▾"** pill (this is the existing account switcher,
  restyled with `mailPill`) — shows "Unified Mailbox" when in all-inboxes mode, or the specific
  account's short label otherwise; unread-count badge to its right in a small `MC.blue` circle.
- List: swipeable/tabbed sections if the reference's two-panel "inbox / se[nt]" idea maps to real
  folders that exist; otherwise a single scrollable list — don't invent a Sent-tab swipe gesture
  if there's no folder concept in the data yet.
- Message card (`mailCard()`): tag chips row (`tagChip('new')`, `tagChip('work')` — only render
  tags that correspond to real thread state, e.g. new/unread and any existing labels; don't
  fabricate a "Work" category if the schema has no such field), sender row (avatar + name +
  "CC" badge if the thread has CC recipients), timestamp top-right in `MF.mono`, bold subject,
  2–3 line body preview, attachment-count pill if attachments exist.
- Card footer actions: "Read Email" primary (`mailPill(true)`) + secondary "Reply Now" / "Mark as
  Read" — wire only to real actions (open thread; reply; mark-read if that endpoint exists, else
  omit "Mark as Read" rather than faking it).
- Thread-open view: header shows the account pill again (as in reference's "Work Mail" state),
  New badge + relative timestamp, From/CC rows, subject, full body, **Attachments row** — chips
  reusing `AttachmentsPanel`'s file-chip styling, tapping opens `DocViewer`. Bottom action bar:
  Reply / (Pin, Schedule, "Action" only if real features exist — otherwise reduce to the actions
  that are real: Reply, Forward if supported, Mark Read/Unread) / Read-toggle.

### Desktop — matches reference image 2
- Left icon rail: reuse `SideNav`'s collapsed-rail pattern visually but restyled to `mailTheme`
  tokens only *within the mail route* — i.e. when inside `/mail/*`, the persistent app SideNav can
  stay as the outer rail (don't duplicate global nav), and the mail-specific folder list sits as
  its own second rail/panel to its right, per the reference's two-rail structure.
- Folder panel: Inbox (unread count badge), plus only folders/labels that actually exist in the
  data model today — do not add Important/Sent/Drafts/Deleted as decorative if the backend has
  no concept of them; check `api/mail/*` for what's real.
- Inbox list: search field, All/Read/Unread tabs (wire to real read-state filtering), rows in
  `mailCard()`-lite (flatter, list-row style rather than full card), unread = filled `MC.blue`
  dot, hover = `MC.canvasAlt`.
- Reading pane: toolbar (Reply, Reply All if supported, Forward if supported, Delete/Archive if
  supported, Important/star if supported) — **omit unsupported icons rather than rendering
  dead buttons.** Sender row, To/CC line, body, attachment chips → `DocViewer`.
- Right-click / "•••" context menu: build the menu **dynamically from a capability list** (e.g.
  `mailActions = [{key:'reply', label:'Reply', enabled: true}, ...]`) so it's trivial to see which
  reference items are real vs. omitted, rather than hardcoding all 12 reference items and hoping
  half silently do nothing.

---

## 4. COMPONENT MAP

| Reference element | Real component | Notes |
|---|---|---|
| "Unified Mailbox ▾" pill | `MailShell` account switcher (existing) | Restyle only, same dropdown logic from `MAIL_MULTI_ACCOUNT.md`. |
| Unread count badge | existing unread count state | Style as small `MC.blue` circle, `MF.mono` number. |
| Tag chips (New/Work) | thread unread flag + real labels only | No fabricated categories. |
| Attachment chips | `AttachmentsPanel` file-chip pattern | Tap → `DocViewer`, not a new viewer. |
| Bottom action bar (mobile) / toolbar (desktop) | real `api/mail/*` actions only | Build from a capability list; hide the rest. |
| Context menu | same capability list, desktop right-click/kebab | Same source of truth as the toolbar — don't maintain two separate action lists. |
| Sidebar folders (desktop) | real folder/label data only | If mail has no folder concept yet, ship Inbox only; note the gap rather than inventing folders. |

---

## 5. MOTION (light theme, same discipline as the dark app)

- Card hover/press: `translateY(-2px)` + shadow deepen, `.2s`.
- List item read/unread transition: dot fade, `.15s`.
- Thread open: content fade + slight slide, `.25s`, `power2.out`.
- All gated behind `prefers-reduced-motion`, consistent with the rest of the app.

---

## 6. EXECUTION ORDER

1. `src/ui/mailTheme.js` + font check.
2. `MailShell.jsx` — account-switcher pill restyle, folder panel (real folders only).
3. `InboxView.jsx` — mobile card list + desktop list, tabs, capability-driven row actions.
4. Thread/detail view — header, body, attachment chips → `DocViewer`, action bar.
5. `ComposeView.jsx` — light-theme pass (From selector from multi-account work stays functionally
   identical, just restyled).
6. Context menu component built from the shared capability list.
7. `npm run build`; manual check on both a narrow (mobile) and wide (desktop) viewport.

---

## 7. ACCEPTANCE CHECKLIST

- [ ] Only `src/views/mail/**` and mail-specific components changed; rest of the app's visuals
      untouched (diff review confirms no edits to `src/ui/theme.js`, `AppShell`, other views).
- [ ] One responsive component set — not a separate mobile/desktop mail implementation.
- [ ] Every visible action (button, menu item) maps to a real, working endpoint; nothing fires a
      fake success or does nothing silently.
- [ ] Account switcher is the existing multi-account dropdown, restyled — not a new mechanism.
- [ ] Attachments open via `DocViewer`.
- [ ] Contrast ≥4.5:1 on the new light backgrounds; focus states and reduced-motion respected.
- [ ] `npm run build` passes.
