import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { C, F, SP, R } from "../../../ui/theme";
import { colorForEmail, initialsForRecipient } from "../../../lib/avatarColor";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Avatar({ name, address, size = 18 }) {
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: colorForEmail(address), color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        font: `600 ${size * 0.42}px ${F.head}`, letterSpacing: 0,
      }}
    >
      {initialsForRecipient(name, address)}
    </span>
  );
}

// Multi-chip recipient field (To / Cc / Bcc). Type + Enter/comma/Tab to add;
// backspace on an empty input removes the last chip; × on hover removes any chip.
// `suggestions` is a flat [{name,address}] list filtered live as the user types.
export default function RecipientChips({ label, value, onChange, suggestions = [], placeholder, autoFocus }) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);

  const filtered = draft.trim()
    ? suggestions
        .filter((s) => !value.some((v) => v.address === s.address))
        .filter((s) => s.address.includes(draft.trim().toLowerCase()) || (s.name || "").toLowerCase().includes(draft.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  useEffect(() => setActiveIdx(0), [draft]);

  const commit = (raw) => {
    const addr = raw.trim().replace(/,$/, "");
    if (!addr) return;
    if (!EMAIL_RE.test(addr)) return;
    if (value.some((v) => v.address.toLowerCase() === addr.toLowerCase())) { setDraft(""); return; }
    onChange([...value, { name: "", address: addr.toLowerCase() }]);
    setDraft("");
    setOpen(false);
  };

  const pick = (s) => {
    if (value.some((v) => v.address === s.address)) { setDraft(""); return; }
    onChange([...value, s]);
    setDraft("");
    setOpen(false);
  };

  const removeAt = (i) => onChange(value.filter((_, idx) => idx !== i));

  const onKeyDown = (e) => {
    if (open && filtered.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => (i + 1) % filtered.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => (i - 1 + filtered.length) % filtered.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); pick(filtered[activeIdx]); return; }
      if (e.key === "Escape") { setOpen(false); return; }
    }
    if (e.key === "Enter" || e.key === "," || e.key === "Tab") {
      if (draft.trim()) { e.preventDefault(); commit(draft); }
      return;
    }
    if (e.key === "Backspace" && !draft && value.length) {
      removeAt(value.length - 1);
    }
  };

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "flex-start", gap: SP.sm, minHeight: 22 }}>
      <span style={{ font: `500 12px ${F.mono}`, color: C.inkFaint, paddingTop: 3, width: 34, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
        {value.map((r, i) => (
          <Chip key={r.address} recipient={r} onRemove={() => removeAt(i)} />
        ))}
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => { commit(draft); setTimeout(() => setOpen(false), 120); }}
          onKeyDown={onKeyDown}
          placeholder={value.length ? "" : placeholder}
          style={{
            flex: "1 0 120px", minWidth: 120, background: "transparent", border: "none", outline: "none",
            color: C.ink, font: `400 13px ${F.mono}`, padding: "3px 2px",
          }}
        />
      </div>
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 40, right: 0, zIndex: 5,
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.chip,
            boxShadow: "0 12px 28px -12px rgba(0,0,0,0.6)", padding: 4, maxHeight: 220, overflowY: "auto",
          }}
        >
          {filtered.map((s, i) => (
            <div
              key={s.address}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              style={{
                display: "flex", alignItems: "center", gap: SP.sm, padding: "7px 8px", borderRadius: R.chip - 2,
                cursor: "pointer", background: i === activeIdx ? "rgba(255,255,255,0.06)" : "transparent",
              }}
            >
              <Avatar name={s.name} address={s.address} />
              <span style={{ font: `500 12px ${F.mono}`, color: C.ink }}>{s.name || s.address}</span>
              {s.name && <span style={{ font: `400 11px ${F.mono}`, color: C.inkFaint }}>{s.address}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({ recipient, onRemove }) {
  const [hover, setHover] = useState(false);
  return (
    <span
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)",
        border: `1px solid ${C.hair}`, borderRadius: 999, padding: "3px 8px 3px 3px",
      }}
    >
      <Avatar name={recipient.name} address={recipient.address} size={16} />
      <span style={{ font: `500 12px ${F.mono}`, color: C.ink, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {recipient.name || recipient.address}
      </span>
      <button
        onClick={onRemove}
        title="Remove"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", width: 14, height: 14,
          background: "none", border: "none", cursor: "pointer", color: C.inkFaint,
          opacity: hover ? 1 : 0.35, transition: "opacity 0.12s",
        }}
      >
        <X size={11} />
      </button>
    </span>
  );
}
