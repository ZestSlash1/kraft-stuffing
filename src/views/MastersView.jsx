import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { theme } from "../theme";
import { countShipperUsage, countConsigneeUsage } from "../lib/db";
import { useToast } from "../components/Toast";
import ConfirmDialog from "../components/ConfirmDialog";

const input = {
  width: "100%",
  boxSizing: "border-box",
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 12,
  color: theme.color.ink,
  padding: "10px 12px",
  fontFamily: theme.font.mono,
  fontSize: 13,
  outline: "none",
};

const SHIPPER_FIELDS = [
  { key: "name", label: "Name *" },
  { key: "address", label: "Address" },
  { key: "gstin", label: "GSTIN" },
  { key: "iecCode", label: "IEC Code" },
];
const CONSIGNEE_FIELDS = [
  { key: "name", label: "Name *" },
  { key: "address", label: "Address" },
  { key: "country", label: "Country" },
];

function InlineForm({ fields, initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  return (
    <div style={{ background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: 8, padding: 14, marginTop: 12 }}>
      <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {fields.map((f) => (
          <div key={f.key} style={f.key === "address" ? { gridColumn: "1 / -1" } : undefined}>
            <label className="label-xs" style={{ display: "block", marginBottom: 4 }}>{f.label}</label>
            <input
              style={input}
              value={form[f.key] || ""}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              onFocus={(e) => (e.target.style.borderColor = theme.color.amber)}
              onBlur={(e) => (e.target.style.borderColor = theme.color.border)}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={onCancel} style={{ background: "none", border: `1px solid ${theme.color.border}`, color: theme.color.slate, fontFamily: theme.font.mono, fontSize: 11, padding: "8px 14px", cursor: "pointer" }}>
          CANCEL
        </button>
        <button
          onClick={() => form.name?.trim() && onSave(form)}
          style={{ background: theme.color.amber, border: "none", color: theme.color.surface, fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 13, textTransform: "uppercase", padding: "8px 18px", cursor: "pointer" }}
        >
          SAVE
        </button>
      </div>
    </div>
  );
}

export default function MastersView({ app }) {
  const { state, createShipperEntry, createConsigneeEntry, removeShipper, removeConsignee } = app;
  const { showToast } = useToast();
  const [tab, setTab] = useState("SHIPPERS");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const [confirming, setConfirming] = useState(null); // id | {id, archive:true, count}

  const isShipper = tab === "SHIPPERS";
  const list = (isShipper ? state.shippers : state.consignees).filter((r) => !r.archived);
  const fields = isShipper ? SHIPPER_FIELDS : CONSIGNEE_FIELDS;
  const filtered = list.filter((r) => r.name?.toLowerCase().includes(search.toLowerCase()));

  const save = async (form) => {
    const fn = isShipper ? createShipperEntry : createConsigneeEntry;
    const res = await fn(form);
    setEditing(null);
    showToast(res ? `${isShipper ? "Shipper" : "Consignee"} saved` : "Save failed", res ? "success" : "error");
  };

  const startDelete = async (row) => {
    const count = isShipper ? await countShipperUsage(row.id) : await countConsigneeUsage(row.id);
    setConfirming({ id: row.id, name: row.name, count });
  };

  const doConfirm = async () => {
    const { id, count } = confirming;
    if (count > 0) {
      // Archive instead of delete to preserve referential integrity.
      const row = list.find((r) => r.id === id);
      const fn = isShipper ? createShipperEntry : createConsigneeEntry;
      await fn({ ...row, archived: true });
      showToast("Archived (preserved in existing entries)", "info");
    } else {
      (isShipper ? removeShipper : removeConsignee)(id);
      showToast("Deleted", "success");
    }
    setConfirming(null);
  };

  return (
    <div style={{ minHeight: "100%", background: theme.color.canvas, color: theme.color.ink }}>
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 18px 40px" }}>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 20, borderBottom: `1px solid ${theme.color.border}` }}>
        {["SHIPPERS", "CONSIGNEES"].map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setEditing(null); setConfirming(null); }}
            style={{
              background: "none",
              border: "none",
              borderBottom: tab === t ? `2px solid ${theme.color.amber}` : "2px solid transparent",
              color: tab === t ? theme.color.amberText : theme.color.slate,
              fontFamily: theme.font.condensed,
              fontWeight: 700,
              fontSize: 18,
              letterSpacing: "0.04em",
              padding: "10px 2px",
              cursor: "pointer",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...input, flex: 1, minWidth: 180 }}
        />
        <button
          onClick={() => setEditing("new")}
          style={{ background: theme.color.amber, border: "none", color: theme.color.surface, fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 13, textTransform: "uppercase", padding: "10px 16px", cursor: "pointer", whiteSpace: "nowrap" }}
        >
          + Add {isShipper ? "Shipper" : "Consignee"}
        </button>
      </div>

      {editing === "new" && (
        <InlineForm
          fields={fields}
          initial={isShipper ? {} : { country: "India" }}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* List */}
      <div style={{ marginTop: 16 }}>
        {filtered.length === 0 ? (
          <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 22, color: theme.color.slateFaint, textAlign: "center", padding: "40px 0" }}>
            {isShipper ? "NO SHIPPERS SAVED — add your first one" : "NO CONSIGNEES SAVED — add your first one"}
          </div>
        ) : (
          filtered.map((row) => (
            <div key={row.id}>
              <div
                className="master-row"
                style={{ display: "grid", gridTemplateColumns: "1.5fr 1.2fr 1fr 70px", gap: 12, alignItems: "center", padding: "12px 4px", borderBottom: `1px solid ${theme.color.border}` }}
              >
                <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 15, color: "#e8eef4" }}>{row.name}</div>
                <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>{isShipper ? row.gstin : row.country}</div>
                <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>{isShipper ? row.iecCode : ""}</div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setEditing(row.id)} style={{ background: "none", border: "none", color: theme.color.slate, cursor: "pointer" }}><Pencil size={14} /></button>
                  <button onClick={() => startDelete(row)} style={{ background: "none", border: "none", color: theme.color.red, cursor: "pointer" }}><Trash2 size={14} /></button>
                </div>
              </div>
              {editing === row.id && (
                <InlineForm fields={fields} initial={row} onSave={save} onCancel={() => setEditing(null)} />
              )}
              {confirming?.id === row.id && (
                <ConfirmDialog
                  message={
                    confirming.count > 0
                      ? `Used in ${confirming.count} entries — archive instead?`
                      : `Delete ${confirming.name}?`
                  }
                  confirmLabel={confirming.count > 0 ? "ARCHIVE" : "DELETE"}
                  confirmVariant={confirming.count > 0 ? "success" : "danger"}
                  onCancel={() => setConfirming(null)}
                  onConfirm={doConfirm}
                />
              )}
            </div>
          ))
        )}
      </div>
    </div>
    </div>
  );
}
