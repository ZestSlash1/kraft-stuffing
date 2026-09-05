import { useEffect, useState } from "react";
import { Clock, BellRing, Check, X } from "lucide-react";
import { C, F, R, SP, glass } from "../../ui/theme";
import { mailApi } from "../../lib/mailApi";
import { formatAbsolute } from "../../lib/format";

const QUICK = [
  { label: "Tomorrow", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
];

// remind_at for a quick option: 9am IST N days out.
function quickDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}

// Popover covering the full follow-up lifecycle for one message: set a reminder/snooze,
// see the current state, and (once due) resolve it — Done / Dismiss / Re-snooze. Shared
// by the thread-row kebab and the open-thread action bar.
export default function ReminderControl({ messageId, onClose, onChanged }) {
  const [current, setCurrent] = useState(undefined); // undefined = loading, null = none
  const [mode, setMode] = useState("reminder");
  const [customAt, setCustomAt] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    mailApi.reminderForMessage(messageId).then((r) => alive && setCurrent(r.reminder || null)).catch(() => alive && setCurrent(null));
    return () => { alive = false; };
  }, [messageId]);

  const isDue = current && new Date(current.remind_at) <= new Date();

  const set = async (remindAt) => {
    if (!remindAt) return;
    setBusy(true);
    try {
      const { reminder } = await mailApi.setReminder({ message_id: messageId, mode, remind_at: remindAt, note: note.trim() || undefined });
      setCurrent(reminder);
      onChanged?.();
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (status) => {
    if (!current) return;
    setBusy(true);
    try {
      await mailApi.resolveReminder(current.id, status);
      onChanged?.();
      onClose?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
      <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 41, width: 260, ...glass(R.card), padding: SP.md, boxShadow: "0 16px 36px -14px rgba(0,0,0,0.75)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SP.sm }}>
          <span style={{ font: `600 11px/1 ${F.head}`, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkFaint }}>Follow-up</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.inkFaint, cursor: "pointer", padding: 0 }}><X size={13} /></button>
        </div>

        {current === undefined ? (
          <div style={{ fontSize: 12, color: C.inkFaint, padding: "6px 0" }}>Loading…</div>
        ) : current && isDue ? (
          <>
            <div style={{ fontSize: 12, color: C.warning, marginBottom: SP.sm }}>
              {current.mode === "snooze" ? "Snooze is up" : "Reminder due"} — {formatAbsolute(current.remind_at)}
            </div>
            {current.note && <div style={{ fontSize: 12, color: C.inkDim, marginBottom: SP.sm }}>{current.note}</div>}
            <div style={{ display: "flex", gap: 6, marginBottom: SP.sm }}>
              <SmallBtn onClick={() => resolve("done")} disabled={busy}><Check size={12} /> Done</SmallBtn>
              <SmallBtn onClick={() => resolve("dismissed")} disabled={busy}>Dismiss</SmallBtn>
            </div>
            <QuickSet mode={mode} setMode={setMode} customAt={customAt} setCustomAt={setCustomAt} note={note} setNote={setNote} onPick={set} busy={busy} label="Re-snooze" />
          </>
        ) : current ? (
          <>
            <div style={{ fontSize: 12, color: C.ink, marginBottom: 4 }}>
              {current.mode === "snooze" ? "Snoozed until" : "Reminder set for"} <span style={{ color: C.minor }}>{formatAbsolute(current.remind_at)}</span>
            </div>
            {current.note && <div style={{ fontSize: 12, color: C.inkDim, marginBottom: SP.sm }}>{current.note}</div>}
            <SmallBtn onClick={() => resolve("dismissed")} disabled={busy} style={{ marginBottom: SP.sm }}>Clear follow-up</SmallBtn>
            <QuickSet mode={mode} setMode={setMode} customAt={customAt} setCustomAt={setCustomAt} note={note} setNote={setNote} onPick={set} busy={busy} label="Change" />
          </>
        ) : (
          <QuickSet mode={mode} setMode={setMode} customAt={customAt} setCustomAt={setCustomAt} note={note} setNote={setNote} onPick={set} busy={busy} />
        )}
      </div>
    </>
  );
}

function QuickSet({ mode, setMode, customAt, setCustomAt, note, setNote, onPick, busy, label }) {
  return (
    <div style={{ borderTop: label ? `1px solid ${C.hair}` : "none", paddingTop: label ? SP.sm : 0 }}>
      <div style={{ display: "flex", gap: 4, marginBottom: SP.sm }}>
        <ModeTab active={mode === "reminder"} onClick={() => setMode("reminder")} icon={<BellRing size={11} />} label="Remind" />
        <ModeTab active={mode === "snooze"} onClick={() => setMode("snooze")} icon={<Clock size={11} />} label="Snooze" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: SP.sm }}>
        {QUICK.map((q) => (
          <QuickRow key={q.label} onClick={() => onPick(quickDate(q.days).toISOString())} disabled={busy}>{q.label}</QuickRow>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: SP.sm }}>
        <input type="datetime-local" value={customAt} onChange={(e) => setCustomAt(e.target.value)}
          style={{ flex: 1, background: "transparent", border: `1px solid ${C.hair}`, borderRadius: 6, color: C.ink, font: `400 11px ${F.mono}`, padding: "6px 6px", outline: "none" }} />
        <SmallBtn onClick={() => onPick(customAt ? new Date(customAt).toISOString() : null)} disabled={busy || !customAt}>Set</SmallBtn>
      </div>
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)"
        style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: `1px solid ${C.hair}`, borderRadius: 6, color: C.ink, font: `400 11px ${F.mono}`, padding: "6px 8px", outline: "none" }} />
    </div>
  );
}

function ModeTab({ active, onClick, icon, label }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
      background: active ? "rgba(59,163,255,0.15)" : "transparent", border: "none", borderRadius: R.chip - 4,
      color: active ? C.minor : C.inkFaint, font: `600 10px ${F.mono}`, padding: "5px 0", cursor: "pointer",
    }}>
      {icon} {label}
    </button>
  );
}

function QuickRow({ children, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ textAlign: "left", background: "none", border: "none", borderRadius: R.chip - 4, padding: "6px 8px", color: C.ink, font: `500 12px ${F.mono}`, cursor: disabled ? "default" : "pointer" }}
      onMouseEnter={(e) => !disabled && (e.currentTarget.style.background = "rgba(59,163,255,0.1)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
      {children}
    </button>
  );
}

function SmallBtn({ children, onClick, disabled, style }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(255,255,255,0.06)", border: "none", borderRadius: R.chip - 4, padding: "5px 10px", color: C.ink, font: `600 11px ${F.mono}`, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1, ...style }}>
      {children}
    </button>
  );
}
