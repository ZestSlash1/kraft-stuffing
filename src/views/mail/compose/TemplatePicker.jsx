import { useEffect, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { C, F, R, SP, glass } from "../../../ui/theme";
import { mailApi } from "../../../lib/mailApi";
import { supabase } from "../../../lib/supabase";
import { resolveVariables, textToHtml } from "../../../lib/mailTemplateVars";

// Small popover anchored above the Templates action-bar button. Two sections: the
// org-wide canned-response library (grouped by category, {{variable}} substitution)
// on top, and this account's own saved compose drafts below — same trigger, since
// both are "insert some reusable content into the draft" from the user's POV.
export default function TemplatePicker({ accountId, currentSubject, currentBodyHtml, onPick, onPickCanned, onClose }) {
  const [templates, setTemplates] = useState(null);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [canned, setCanned] = useState(null);
  const [senderName, setSenderName] = useState("");

  useEffect(() => {
    let alive = true;
    mailApi.templates(accountId).then((r) => alive && setTemplates(r.templates || [])).catch(() => alive && setTemplates([]));
    return () => { alive = false; };
  }, [accountId]);

  useEffect(() => {
    let alive = true;
    mailApi.cannedResponses().then((r) => alive && setCanned(r.responses || [])).catch(() => alive && setCanned([]));
    supabase.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id;
      if (!uid) return;
      supabase.from("profiles").select("display_name").eq("id", uid).maybeSingle()
        .then(({ data: p }) => alive && setSenderName(p?.display_name || ""));
    });
    return () => { alive = false; };
  }, []);

  const pickCanned = (cr) => {
    const ctx = { senderName };
    onPickCanned?.({
      subject: cr.subject ? resolveVariables(cr.subject, ctx) : "",
      bodyHtml: textToHtml(resolveVariables(cr.body, ctx)),
    });
  };

  const cannedByCategory = (canned || []).reduce((acc, cr) => {
    (acc[cr.category] = acc[cr.category] || []).push(cr);
    return acc;
  }, {});

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { template } = await mailApi.createTemplate({ account_id: accountId, name: name.trim(), subject: currentSubject, body_html: currentBodyHtml });
      setTemplates((t) => [template, ...(t || [])]);
      setName("");
    } catch {
      /* best-effort */
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    setTemplates((t) => t.filter((x) => x.id !== id));
    mailApi.deleteTemplate(id).catch(() => {});
  };

  return (
    <Popover onClose={onClose} title="Templates" width={280}>
      <div style={{ font: `600 10px/1 ${F.head}`, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint, marginBottom: 4 }}>
        Canned Responses
      </div>
      {canned === null ? (
        <Empty>Loading…</Empty>
      ) : canned.length === 0 ? (
        <Empty>None yet — add some on the Templates page.</Empty>
      ) : (
        <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, marginBottom: SP.sm }}>
          {Object.entries(cannedByCategory).map(([category, items]) => (
            <div key={category}>
              <div style={{ font: `500 9px ${F.mono}`, color: C.inkFaint, padding: "4px 8px 2px" }}>{category}</div>
              {items.map((cr) => (
                <button key={cr.id} onClick={() => pickCanned(cr)} style={rowBtn}>
                  <FileText size={13} color={C.inkFaint} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cr.name}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}

      <div style={{ font: `600 10px/1 ${F.head}`, letterSpacing: "0.08em", textTransform: "uppercase", color: C.inkFaint, margin: `${SP.sm}px 0 4px`, paddingTop: SP.sm, borderTop: `1px solid ${C.hair}` }}>
        Saved Drafts
      </div>
      {templates === null ? (
        <Empty>Loading…</Empty>
      ) : templates.length === 0 ? (
        <Empty>No saved templates yet.</Empty>
      ) : (
        <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
          {templates.map((t) => (
            <div key={t.id} style={row}>
              <button onClick={() => onPick(t)} style={rowBtn}>
                <FileText size={13} color={C.inkFaint} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
              </button>
              <button onClick={() => remove(t.id)} style={iconBtn} title="Delete"><Trash2 size={12} /></button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginTop: SP.sm, paddingTop: SP.sm, borderTop: `1px solid ${C.hair}` }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Save current draft as…"
          onKeyDown={(e) => e.key === "Enter" && save()}
          style={{ flex: 1, background: "transparent", border: `1px solid ${C.hair}`, borderRadius: 6, color: C.ink, font: `400 12px ${F.mono}`, padding: "6px 8px", outline: "none" }}
        />
        <button onClick={save} disabled={saving || !name.trim()} style={{ ...iconBtn, width: 28, height: 28, background: name.trim() ? "rgba(59,163,255,0.15)" : "transparent", color: name.trim() ? C.minor : C.inkFaint }} title="Save template">
          <Plus size={14} />
        </button>
      </div>
    </Popover>
  );
}

export function Popover({ title, children, onClose, width = 260 }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
      <div
        style={{
          position: "absolute", bottom: "calc(100% + 10px)", left: 0, zIndex: 41, width,
          ...glass(R.card), padding: SP.md, boxShadow: "0 16px 36px -14px rgba(0,0,0,0.75)",
        }}
      >
        <div style={{ font: `600 11px/1 ${F.head}`, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkFaint, marginBottom: SP.sm }}>
          {title}
        </div>
        {children}
      </div>
    </>
  );
}

function Empty({ children }) {
  return <div style={{ font: `400 12px ${F.mono}`, color: C.inkFaint, padding: `${SP.sm}px 0` }}>{children}</div>;
}

const row = { display: "flex", alignItems: "center", gap: 4 };
const rowBtn = {
  flex: 1, display: "flex", alignItems: "center", gap: SP.sm, background: "none", border: "none",
  borderRadius: R.chip - 2, padding: "7px 8px", cursor: "pointer", textAlign: "left", color: C.ink, font: `500 12px ${F.mono}`,
};
const iconBtn = {
  display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22,
  background: "none", border: "none", borderRadius: 6, color: C.inkFaint, cursor: "pointer", flexShrink: 0,
};
