import { useState } from "react";
import { Search } from "lucide-react";
import { C, F, SP } from "../../../ui/theme";
import { Popover } from "./TemplatePicker";
import { colorForEmail, initialsForRecipient } from "../../../lib/avatarColor";

// Address book: recent recipients pulled from mail history (see /api/mail/actions
// ?op=recipients — no dedicated contacts table exists yet). Click inserts into To.
export default function ContactsPicker({ recipients, onPick, onClose }) {
  const [query, setQuery] = useState("");
  const filtered = recipients.filter(
    (r) => !query.trim() || r.address.includes(query.toLowerCase()) || (r.name || "").toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Popover title="Contacts" onClose={onClose} width={260}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: `1px solid ${C.hair}`, borderRadius: 8, padding: "6px 8px", marginBottom: SP.sm }}>
        <Search size={13} color={C.inkFaint} />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.ink, font: `400 12px ${F.mono}` }}
        />
      </div>
      {filtered.length === 0 ? (
        <div style={{ font: `400 12px ${F.mono}`, color: C.inkFaint, padding: `${SP.sm}px 0` }}>No contacts yet — they appear here after you exchange mail.</div>
      ) : (
        <div style={{ maxHeight: 240, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {filtered.map((r) => (
            <button key={r.address} onClick={() => onPick(r)} style={rowBtn}>
              <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: colorForEmail(r.address), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", font: `600 8px ${F.head}` }}>
                {initialsForRecipient(r.name, r.address)}
              </span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name || r.address}</span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

const rowBtn = {
  display: "flex", alignItems: "center", gap: SP.sm, background: "none", border: "none",
  borderRadius: 8, padding: "7px 8px", cursor: "pointer", textAlign: "left", color: C.ink, font: `500 12px ${F.mono}`, width: "100%",
};
