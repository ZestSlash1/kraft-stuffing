import { useState } from "react";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import { theme } from "../theme";
import { recordCargoDescription, readCargoDescriptionSuggestions } from "../lib/cargoFormat";

const UNIT_CHIPS = ["PC", "PKGs", "Bags", "Bundles", "Crates", "Cartons", "Rolls", "Boxes"];

const inputStyle = {
  background: theme.color.surfaceMuted,
  border: `1px solid ${theme.color.borderStrong}`,
  color: theme.color.ink,
  borderRadius: theme.radius.sm,
  padding: "7px 10px",
  fontFamily: theme.font.mono,
  fontSize: 13,
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: theme.color.slate,
  marginBottom: 4,
  display: "block",
  fontFamily: theme.font.mono,
};

function ItemRow({ item, onUpdate, onDelete }) {
  const suggestions = readCargoDescriptionSuggestions();

  const handleDescBlur = (e) => {
    const v = e.target.value.trim();
    if (v) {
      recordCargoDescription(v);
      if (item.backfilled) onUpdate({ backfilled: false });
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        padding: "10px 12px",
        background: theme.color.surface,
        border: `1px solid ${item.backfilled ? theme.color.amber + "66" : theme.color.border}`,
        borderRadius: theme.radius.sm,
        position: "relative",
      }}
    >
      {item.backfilled && (
        <div
          title="Migrated from stuffing-line data — please confirm"
          style={{
            position: "absolute",
            top: -8,
            left: 10,
            background: theme.color.amber,
            color: "#fff",
            fontSize: 9,
            letterSpacing: "0.1em",
            fontFamily: theme.font.mono,
            padding: "1px 6px",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <AlertCircle size={9} /> PLEASE CONFIRM
        </div>
      )}

      {/* description */}
      <div style={{ flex: 3, minWidth: 120, marginTop: item.backfilled ? 8 : 0 }}>
        <label style={labelStyle}>Description</label>
        <input
          list={`cargo-desc-${item.id}`}
          value={item.description}
          onChange={(e) => onUpdate({ description: e.target.value, backfilled: false })}
          onBlur={handleDescBlur}
          placeholder="Onion, Plywood…"
          style={inputStyle}
        />
        <datalist id={`cargo-desc-${item.id}`}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      {/* qty */}
      <div style={{ flex: 1, minWidth: 70, marginTop: item.backfilled ? 8 : 0 }}>
        <label style={labelStyle}>Qty</label>
        <input
          type="number"
          min="0"
          value={item.qty ?? ""}
          onChange={(e) =>
            onUpdate({ qty: e.target.value === "" ? null : Number(e.target.value), backfilled: false })
          }
          placeholder="—"
          style={inputStyle}
        />
      </div>

      {/* unit */}
      <div style={{ flex: 1.5, minWidth: 90, marginTop: item.backfilled ? 8 : 0 }}>
        <label style={labelStyle}>Unit</label>
        <input
          list={`cargo-unit-${item.id}`}
          value={item.unit}
          onChange={(e) => onUpdate({ unit: e.target.value, backfilled: false })}
          style={inputStyle}
        />
        <datalist id={`cargo-unit-${item.id}`}>
          {UNIT_CHIPS.map((u) => (
            <option key={u} value={u} />
          ))}
        </datalist>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
          {UNIT_CHIPS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => onUpdate({ unit: u, backfilled: false })}
              style={{
                background: item.unit === u ? theme.color.amber : theme.color.surfaceMuted,
                color: item.unit === u ? "#fff" : theme.color.slate,
                border: "none",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 9,
                fontFamily: theme.font.mono,
                cursor: "pointer",
                letterSpacing: "0.06em",
              }}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onDelete}
        style={{
          background: "none",
          border: "none",
          color: theme.color.slateFaint,
          cursor: "pointer",
          padding: "6px",
          marginBottom: 2,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

export default function CargoItemsEditor({ container, onAdd, onUpdate, onRemove }) {
  const items = container?.cargoItems || [];
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ description: "", qty: "", unit: "Bags" });
  const suggestions = readCargoDescriptionSuggestions();

  const commitAdd = () => {
    if (!draft.description.trim()) return;
    if (draft.description.trim()) recordCargoDescription(draft.description.trim());
    onAdd({
      description: draft.description.trim(),
      qty: draft.qty === "" ? null : Number(draft.qty),
      unit: draft.unit || "Bags",
    });
    setDraft({ description: "", qty: "", unit: "Bags" });
    setAdding(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.length === 0 && !adding && (
        <div
          style={{
            padding: "14px 16px",
            fontFamily: theme.font.mono,
            fontSize: 11,
            color: theme.color.slateFaint,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            textAlign: "center",
            background: theme.color.surfaceMuted,
            borderRadius: theme.radius.sm,
          }}
        >
          No cargo items declared — add at least one
        </div>
      )}

      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          onUpdate={(patch) => onUpdate(item.id, patch)}
          onDelete={() => onRemove(item.id)}
        />
      ))}

      {adding ? (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-end",
            padding: "10px 12px",
            background: theme.color.surface,
            border: `1px dashed ${theme.color.amber}`,
            borderRadius: theme.radius.sm,
          }}
        >
          <div style={{ flex: 3 }}>
            <label style={labelStyle}>Description</label>
            <input
              autoFocus
              list="cargo-add-desc"
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && commitAdd()}
              placeholder="e.g. Onion"
              style={inputStyle}
            />
            <datalist id="cargo-add-desc">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Qty</label>
            <input
              type="number"
              min="0"
              value={draft.qty}
              onChange={(e) => setDraft((d) => ({ ...d, qty: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && commitAdd()}
              placeholder="—"
              style={inputStyle}
            />
          </div>
          <div style={{ flex: 1.5 }}>
            <label style={labelStyle}>Unit</label>
            <input
              list="cargo-add-unit"
              value={draft.unit}
              onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && commitAdd()}
              style={inputStyle}
            />
            <datalist id="cargo-add-unit">
              {UNIT_CHIPS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
              {UNIT_CHIPS.map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, unit: u }))}
                  style={{
                    background: draft.unit === u ? theme.color.amber : theme.color.surfaceMuted,
                    color: draft.unit === u ? "#fff" : theme.color.slate,
                    border: "none",
                    borderRadius: 4,
                    padding: "2px 6px",
                    fontSize: 9,
                    fontFamily: theme.font.mono,
                    cursor: "pointer",
                    letterSpacing: "0.06em",
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 2 }}>
            <button
              type="button"
              onClick={commitAdd}
              style={{
                background: theme.color.green,
                color: "#fff",
                border: "none",
                borderRadius: theme.radius.sm,
                padding: "7px 14px",
                fontFamily: theme.font.mono,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => { setAdding(false); setDraft({ description: "", qty: "", unit: "Bags" }); }}
              style={{
                background: "none",
                border: `1px solid ${theme.color.border}`,
                color: theme.color.slate,
                borderRadius: theme.radius.sm,
                padding: "7px 10px",
                fontFamily: theme.font.mono,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: `1px dashed ${theme.color.border}`,
            color: theme.color.slate,
            borderRadius: theme.radius.sm,
            padding: "8px 14px",
            fontFamily: theme.font.mono,
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            cursor: "pointer",
            width: "100%",
          }}
        >
          <Plus size={13} /> Add cargo item
        </button>
      )}
    </div>
  );
}
