import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, X, FileText, EyeOff, Eye } from "lucide-react";
import { C, F, R, SP, glass, input as inputStyle } from "../../ui/theme";
import { mailApi } from "../../lib/mailApi";
import { useToast } from "../../components/Toast";
import ConfirmDialog from "../../components/ConfirmDialog";

const CATEGORIES = ["Booking Confirmation", "Arrival Notice", "Payment Follow-up", "Documentation Request", "Customs Query", "General"];
const VARS = ["customer_name", "booking_ref", "vessel_name", "voyage_no", "container_no", "eta", "sender_name"];
const TOKEN_RE = /(\{\{[^}]*\}\})/g;

// Render text with {{tokens}} highlighted — used for the live preview and the list rows.
function TokenText({ text, style }) {
  if (!text) return null;
  const parts = String(text).split(TOKEN_RE);
  return (
    <span style={style}>
      {parts.map((p, i) =>
        TOKEN_RE.test(p) ? (
          <span key={i} style={{ color: C.minor, background: "rgba(59,163,255,0.14)", borderRadius: 3, padding: "0 2px" }}>{p}</span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  );
}

export default function TemplatesView() {
  const [responses, setResponses] = useState(null);
  const [showVoided, setShowVoided] = useState(false);
  const [editing, setEditing] = useState(null); // {} for new, or a response object
  const [confirmVoidId, setConfirmVoidId] = useState(null);
  const { showToast } = useToast();

  const load = () => {
    mailApi.cannedResponses().then((r) => setResponses(r.responses || [])).catch(() => setResponses([]));
  };
  useEffect(load, []);

  const grouped = useMemo(() => {
    const list = (responses || []).filter((r) => showVoided || !r.is_void);
    return list.reduce((acc, r) => {
      (acc[r.category] = acc[r.category] || []).push(r);
      return acc;
    }, {});
  }, [responses, showVoided]);

  const save = async (form) => {
    try {
      if (form.id) {
        await mailApi.updateCannedResponse(form.id, { name: form.name, category: form.category, subject: form.subject, body: form.body });
      } else {
        await mailApi.createCannedResponse({ name: form.name, category: form.category, subject: form.subject, body: form.body });
      }
      setEditing(null);
      load();
      showToast("Template saved", "success");
    } catch (e) {
      showToast(e.message || "Could not save template", "error");
    }
  };

  const voidResponse = async (id) => {
    try {
      await mailApi.updateCannedResponse(id, { is_void: true });
      setConfirmVoidId(null);
      load();
      showToast("Template voided", "success");
    } catch (e) {
      showToast(e.message || "Could not void template", "error");
    }
  };

  const restore = async (id) => {
    try {
      await mailApi.updateCannedResponse(id, { is_void: false });
      load();
    } catch (e) {
      showToast(e.message || "Could not restore template", "error");
    }
  };

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: `${SP.xxl}px ${SP.xl}px`, fontFamily: F.mono }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SP.lg }}>
        <div>
          <div style={{ font: `800 24px ${F.head}`, letterSpacing: "0.02em", color: C.ink }}>TEMPLATES</div>
          <div style={{ fontSize: 12, color: C.inkFaint, marginTop: 4 }}>Canned responses for compose &amp; reply — org-wide, grouped by category.</div>
        </div>
        <button onClick={() => setEditing({})} style={primaryBtn}>
          <Plus size={14} /> New template
        </button>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.inkFaint, cursor: "pointer", marginBottom: SP.lg }}>
        <input type="checkbox" checked={showVoided} onChange={(e) => setShowVoided(e.target.checked)} />
        Show voided templates
      </label>

      {responses === null && <div style={{ color: C.inkFaint, fontSize: 13 }}>Loading…</div>}
      {responses !== null && Object.keys(grouped).length === 0 && (
        <div style={{ ...glass(R.card), padding: SP.xl, textAlign: "center", color: C.inkFaint, fontSize: 13 }}>
          No templates yet.
        </div>
      )}

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} style={{ marginBottom: SP.lg }}>
          <div style={{ font: `600 11px/1 ${F.head}`, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkFaint, marginBottom: SP.sm }}>
            {category}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: SP.sm }}>
            {items.map((r) => (
              <div key={r.id} style={{ ...glass(R.card), padding: `${SP.md}px ${SP.lg}px`, opacity: r.is_void ? 0.5 : 1 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: SP.sm }}>
                  <FileText size={15} color={C.inkFaint} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: SP.sm }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: C.ink }}>{r.name}</span>
                      {r.is_void && <span style={{ fontSize: 10, color: C.critical, border: `1px solid ${C.critical}`, borderRadius: 999, padding: "1px 6px" }}>VOIDED</span>}
                    </div>
                    {r.subject && <div style={{ fontSize: 12, color: C.inkDim, marginTop: 2 }}>Subject: {r.subject}</div>}
                    <div style={{ fontSize: 12, color: C.inkFaint, marginTop: 4, maxHeight: 40, overflow: "hidden" }}>
                      <TokenText text={r.body} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {!r.is_void && (
                      <IconBtn title="Edit" onClick={() => setEditing(r)}><Pencil size={14} /></IconBtn>
                    )}
                    {r.is_void ? (
                      <IconBtn title="Restore" onClick={() => restore(r.id)}><Eye size={14} /></IconBtn>
                    ) : (
                      <IconBtn title="Void" onClick={() => setConfirmVoidId(r.id)}><EyeOff size={14} /></IconBtn>
                    )}
                  </div>
                </div>
                {confirmVoidId === r.id && (
                  <ConfirmDialog
                    message={`Void "${r.name}"? It will no longer appear in the compose picker.`}
                    confirmLabel="VOID"
                    onConfirm={() => voidResponse(r.id)}
                    onCancel={() => setConfirmVoidId(null)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {editing && <EditorModal initial={editing} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EditorModal({ initial, onSave, onClose }) {
  const [name, setName] = useState(initial.name || "");
  const [category, setCategory] = useState(initial.category || CATEGORIES[CATEGORIES.length - 1]);
  const [subject, setSubject] = useState(initial.subject || "");
  const [body, setBody] = useState(initial.body || "");

  const submit = () => {
    if (!name.trim() || !body.trim()) return;
    onSave({ id: initial.id, name: name.trim(), category, subject: subject.trim() || null, body });
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(2,4,8,0.6)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: SP.xl }}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...glass(R.panel), width: "100%", maxWidth: 560, maxHeight: "88vh", overflowY: "auto", padding: SP.xl }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: SP.lg }}>
          <span style={{ font: `700 16px ${F.head}`, color: C.ink }}>{initial.id ? "Edit template" : "New template"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: C.inkFaint, cursor: "pointer" }}><X size={16} /></button>
        </div>

        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Payment reminder — first notice" style={{ ...inputStyle(), width: "100%", boxSizing: "border-box" }} />
        </Field>

        <Field label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ ...inputStyle(), width: "100%", boxSizing: "border-box" }}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Subject (optional)">
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Leave blank to reuse the compose subject" style={{ ...inputStyle(), width: "100%", boxSizing: "border-box" }} />
        </Field>

        <Field label="Body">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
            placeholder={`Dear {{customer_name}},\n\nYour shipment on {{vessel_name}} (voyage {{voyage_no}}) is confirmed…`}
            style={{ ...inputStyle(), width: "100%", boxSizing: "border-box", resize: "vertical", lineHeight: 1.6 }} />
        </Field>

        <div style={{ fontSize: 10, color: C.inkFaint, marginBottom: SP.sm }}>
          Variables: {VARS.map((v) => `{{${v}}}`).join("  ")}
        </div>

        {(subject || body) && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.hair}`, borderRadius: R.chip, padding: SP.md, marginBottom: SP.lg }}>
            <div style={{ font: `600 10px ${F.head}`, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 6 }}>Preview</div>
            {subject && <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginBottom: 4 }}><TokenText text={subject} /></div>}
            <div style={{ fontSize: 12, color: C.inkDim, whiteSpace: "pre-wrap", lineHeight: 1.6 }}><TokenText text={body} /></div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: SP.sm }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button onClick={submit} disabled={!name.trim() || !body.trim()} style={{ ...primaryBtn, opacity: !name.trim() || !body.trim() ? 0.5 : 1 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: SP.md }}>
      <div style={{ font: `600 10px ${F.head}`, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function IconBtn({ children, title, onClick }) {
  return (
    <button onClick={onClick} title={title}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, background: "none", border: "none", borderRadius: R.chip - 2, color: C.inkDim, cursor: "pointer" }}>
      {children}
    </button>
  );
}

const primaryBtn = {
  display: "inline-flex", alignItems: "center", gap: 6, border: "none", borderRadius: R.pill,
  background: C.ink, color: C.void, font: `700 12px ${F.head}`, letterSpacing: "0.02em", padding: "8px 16px", cursor: "pointer",
};
const secondaryBtn = {
  border: `1px solid ${C.border}`, borderRadius: R.pill, background: "none", color: C.inkDim,
  font: `600 12px ${F.head}`, letterSpacing: "0.02em", padding: "8px 16px", cursor: "pointer",
};
