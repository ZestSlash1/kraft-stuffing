// {{variable}} substitution for canned responses (PHASE_MAIL_TEMPLATES_REMINDERS.md §A).
// Only {{sender_name}} is ever resolvable here — the rest (customer_name, booking_ref,
// vessel_name, voyage_no, container_no, eta) need booking/voyage context that mail
// threads have no linkage to in this codebase, so per the spec they're left as literal
// text for the user to fill in manually.
const TOKEN_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi;

export function resolveVariables(text, ctx = {}) {
  if (!text) return "";
  return text.replace(TOKEN_RE, (match, name) => {
    const key = name.toLowerCase();
    if (key === "sender_name" && ctx.senderName) return ctx.senderName;
    return match; // unresolved — keep the literal {{token}}
  });
}

// Plain text (canned response body) → editor-ready HTML, preserving line breaks.
export function textToHtml(text) {
  const esc = (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${esc.replace(/\n/g, "<br>")}</p>`;
}

// Select the first remaining {{token}} in a Tiptap editor's document so the user lands
// right on it. No-op if every token was resolved.
export function focusFirstToken(editor) {
  if (!editor) return;
  let range = null;
  editor.state.doc.descendants((node, pos) => {
    if (range || !node.isText) return !range;
    const m = /\{\{[^}]*\}\}/.exec(node.text);
    if (m) range = [pos + m.index, pos + m.index + m[0].length];
    return false;
  });
  if (range) editor.chain().focus().setTextSelection({ from: range[0], to: range[1] }).run();
}
