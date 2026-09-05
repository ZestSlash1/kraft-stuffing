import { useRef, useState } from "react";
import { Paperclip, Clock, FileText, Contact, Send } from "lucide-react";
import { C, F, R, SP, glass } from "../../../ui/theme";
import TemplatePicker from "./TemplatePicker";
import SchedulePicker from "./SchedulePicker";
import ContactsPicker from "./ContactsPicker";

// Dark pill toolbar — attach / schedule / templates / contacts / send. Ask AI is
// intentionally omitted (out of scope for this pass).
export default function ActionBar({
  accountId, canSend, sending, scheduledAt, onFiles, onPickTemplate, onPickCanned, onSchedule, onClearSchedule,
  onPickContact, recipients, currentSubject, currentBodyHtml, onSend,
}) {
  const [open, setOpen] = useState(null); // 'templates' | 'schedule' | 'contacts' | null
  const fileRef = useRef(null);

  const toggle = (name) => setOpen((o) => (o === name ? null : name));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: SP.sm, ...glass(R.pill), padding: `${SP.sm}px ${SP.md}px`, position: "relative" }}>
      <IconBtn title="Attach files" onClick={() => fileRef.current?.click()}><Paperclip size={16} /></IconBtn>
      <input
        ref={fileRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }}
      />

      <div style={{ position: "relative" }}>
        <IconBtn title="Schedule send" active={open === "schedule"} onClick={() => toggle("schedule")}><Clock size={16} /></IconBtn>
        {open === "schedule" && <SchedulePicker onSchedule={(iso) => { onSchedule(iso); setOpen(null); }} onClose={() => setOpen(null)} />}
      </div>

      <div style={{ position: "relative" }}>
        <IconBtn title="Use template" active={open === "templates"} onClick={() => toggle("templates")}><FileText size={16} /></IconBtn>
        {open === "templates" && (
          <TemplatePicker
            accountId={accountId}
            currentSubject={currentSubject}
            currentBodyHtml={currentBodyHtml}
            onPick={(t) => { onPickTemplate(t); setOpen(null); }}
            onPickCanned={(cr) => { onPickCanned(cr); setOpen(null); }}
            onClose={() => setOpen(null)}
          />
        )}
      </div>

      <div style={{ position: "relative" }}>
        <IconBtn title="Contacts" active={open === "contacts"} onClick={() => toggle("contacts")}><Contact size={16} /></IconBtn>
        {open === "contacts" && (
          <ContactsPicker recipients={recipients} onPick={(r) => { onPickContact(r); setOpen(null); }} onClose={() => setOpen(null)} />
        )}
      </div>

      {scheduledAt && (
        <span
          onClick={onClearSchedule}
          title="Click to cancel schedule"
          style={{
            font: `500 11px ${F.mono}`, color: C.warning, cursor: "pointer", padding: "3px 8px",
            background: "rgba(232,147,10,0.12)", borderRadius: 999, whiteSpace: "nowrap",
          }}
        >
          ⏱ {new Date(scheduledAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} ×
        </span>
      )}

      <span style={{ flex: 1 }} />

      <button
        onClick={onSend}
        disabled={!canSend || sending}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: R.pill,
          background: canSend ? C.ink : "rgba(255,255,255,0.08)", color: canSend ? C.void : C.inkFaint,
          font: `700 13px ${F.head}`, letterSpacing: "0.02em", padding: `8px 18px`,
          cursor: canSend && !sending ? "pointer" : "default", opacity: sending ? 0.7 : 1,
        }}
      >
        <Send size={14} /> {sending ? "Sending…" : scheduledAt ? "Schedule" : "Send"}
      </button>
    </div>
  );
}

function IconBtn({ children, title, onClick, active }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34,
        background: active ? "rgba(255,255,255,0.1)" : "transparent", border: "none", borderRadius: R.chip - 2,
        color: active ? C.ink : C.inkDim, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
