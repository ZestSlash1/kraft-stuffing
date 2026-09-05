// Deterministic initial-avatar color for a recipient chip, hashed from their email
// address so the same address always renders the same color across sessions.
import { AVATAR_PALETTE } from "../ui/theme.js";

export function colorForEmail(email) {
  const s = (email || "").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[idx];
}

export function initialsForRecipient(name, email) {
  const source = (name || "").trim() || (email || "").split("@")[0] || "?";
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}
