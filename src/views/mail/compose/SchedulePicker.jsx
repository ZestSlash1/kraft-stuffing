import { useState } from "react";
import { Clock } from "lucide-react";
import { C, F, SP } from "../../../ui/theme";
import { Popover } from "./TemplatePicker";

const QUICK = [
  { label: "In 1 hour", offsetMs: 60 * 60 * 1000 },
  { label: "This evening (6 PM)", at: (d) => d.setHours(18, 0, 0, 0) },
  { label: "Tomorrow morning (9 AM)", at: (d) => { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); } },
  { label: "Monday morning (9 AM)", at: (d) => { const day = d.getDay(); d.setDate(d.getDate() + ((8 - day) % 7 || 7)); d.setHours(9, 0, 0, 0); } },
];

// Time picker for the "schedule send" bottom-bar action. Offers quick presets
// plus a raw datetime-local input for anything else.
export default function SchedulePicker({ onSchedule, onClose }) {
  const [custom, setCustom] = useState("");

  const pick = (date) => {
    if (date.getTime() <= Date.now()) date = new Date(Date.now() + 60000);
    onSchedule(date.toISOString());
  };

  return (
    <Popover title="Schedule send" onClose={onClose} width={240}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {QUICK.map((q) => (
          <button
            key={q.label}
            onClick={() => {
              const d = new Date();
              if (q.offsetMs) pick(new Date(Date.now() + q.offsetMs));
              else { q.at(d); pick(d); }
            }}
            style={rowBtn}
          >
            <Clock size={13} color={C.inkFaint} /> {q.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginTop: SP.sm, paddingTop: SP.sm, borderTop: `1px solid ${C.hair}` }}>
        <input
          type="datetime-local"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          style={{ flex: 1, background: "transparent", border: `1px solid ${C.hair}`, borderRadius: 6, color: C.ink, font: `400 12px ${F.mono}`, padding: "6px 8px", outline: "none", colorScheme: "dark" }}
        />
        <button
          onClick={() => custom && pick(new Date(custom))}
          disabled={!custom}
          style={{
            padding: "0 12px", background: custom ? "rgba(59,163,255,0.15)" : "transparent", color: custom ? C.minor : C.inkFaint,
            border: "none", borderRadius: 6, cursor: custom ? "pointer" : "default", font: `600 11px ${F.mono}`,
          }}
        >
          Set
        </button>
      </div>
    </Popover>
  );
}

const rowBtn = {
  display: "flex", alignItems: "center", gap: SP.sm, background: "none", border: "none",
  borderRadius: 8, padding: "7px 8px", cursor: "pointer", textAlign: "left", color: C.ink, font: `500 12px ${F.mono}`, width: "100%",
};
