import { Plus, Trash2 } from "lucide-react";
import { theme } from "../../theme";
import { C, F } from "../../ui/theme";
import { IMDG_CLASSES, PACKAGE_UNITS } from "../../data/igmHelpers";
import { EmptyState, SelectInput, TextInput, iconBtn, mono, secondaryBtn } from "./igmChrome";

// Cargo lines for one BL — editable grid, same interaction contract as the
// Stuffing Log's cargo-items editor: add row, edit in place, remove row. Text
// cells commit on blur, selects commit immediately; the parent's autosave shows
// the resulting status.
//
// rows: [{ id, seq, hsnCode, unoCode, imdgClass, pkgs, pkgsUnit, description }]
export default function CargoLinesGrid({ rows = [], onPatch, onAdd, onRemove, isMobile }) {
  const cell = (row, key, props = {}) => (
    <TextInput
      defaultValue={row[key] ?? ""}
      key={`${row.id}-${key}`}
      onBlur={(e) => {
        const next = e.target.value;
        if (String(row[key] ?? "") !== next) onPatch(row.id, { [key]: next });
      }}
      {...props}
    />
  );

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.length === 0 && <EmptyState>No cargo lines yet.</EmptyState>}
        {rows.map((row, i) => (
          <div
            key={row.id}
            style={{
              border: `1px solid ${C.hair}`,
              borderRadius: theme.radius.sm,
              padding: 12,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between" }}>
              <span style={mono(11, theme.color.slate)}>LINE {i + 1}</span>
              <button onClick={() => onRemove(row)} style={{ ...iconBtn, color: theme.color.red }} title="Remove line">
                <Trash2 size={13} />
              </button>
            </div>
            <Labelled label="HSN">{cell(row, "hsnCode", { placeholder: "63053200" })}</Labelled>
            <Labelled label="Packages">{cell(row, "pkgs", { type: "number", inputMode: "decimal" })}</Labelled>
            <Labelled label="Unit">
              <SelectInput
                value={row.pkgsUnit || "PKG"}
                options={PACKAGE_UNITS}
                onChange={(e) => onPatch(row.id, { pkgsUnit: e.target.value })}
              />
            </Labelled>
            <Labelled label="UNO">{cell(row, "unoCode")}</Labelled>
            <Labelled label="IMDG class">
              <SelectInput
                value={row.imdgClass || ""}
                allowBlank
                options={IMDG_CLASSES}
                onChange={(e) => onPatch(row.id, { imdgClass: e.target.value })}
              />
            </Labelled>
            <Labelled label="Description" span="1 / -1">
              {cell(row, "description", { placeholder: "Cargo description" })}
            </Labelled>
          </div>
        ))}
        <button onClick={onAdd} style={secondaryBtn}>
          <Plus size={14} /> Add cargo line
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
          <thead>
            <tr>
              {[
                ["#", 34],
                ["HSN code", 110],
                ["UNO", 80],
                ["IMDG", 90],
                ["Packages", 100],
                ["Unit", 90],
                ["Cargo description", null],
                ["", 42],
              ].map(([h, w]) => (
                <th key={h} style={{ ...th, width: w || undefined }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ ...td, padding: 0 }}>
                  <div style={{ padding: "14px 0" }}>
                    <EmptyState>No cargo lines yet — add the first commodity line.</EmptyState>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={row.id}>
                  <td style={{ ...td, ...mono(11, theme.color.slate) }}>{i + 1}</td>
                  <td style={td}>{cell(row, "hsnCode", { placeholder: "63053200" })}</td>
                  <td style={td}>{cell(row, "unoCode")}</td>
                  <td style={td}>
                    <SelectInput
                      value={row.imdgClass || ""}
                      allowBlank
                      options={IMDG_CLASSES}
                      onChange={(e) => onPatch(row.id, { imdgClass: e.target.value })}
                    />
                  </td>
                  <td style={td}>
                    {cell(row, "pkgs", { type: "number", inputMode: "decimal", style: { textAlign: "right" } })}
                  </td>
                  <td style={td}>
                    <SelectInput
                      value={row.pkgsUnit || "PKG"}
                      options={PACKAGE_UNITS}
                      onChange={(e) => onPatch(row.id, { pkgsUnit: e.target.value })}
                    />
                  </td>
                  <td style={td}>{cell(row, "description", { placeholder: "Cargo description" })}</td>
                  <td style={{ ...td, textAlign: "right" }}>
                    <button
                      onClick={() => onRemove(row)}
                      style={{ ...iconBtn, color: theme.color.red }}
                      title="Remove line"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <button onClick={onAdd} style={{ ...secondaryBtn, marginTop: 12 }}>
        <Plus size={14} /> Add cargo line
      </button>
    </div>
  );
}

function Labelled({ label, span, children }) {
  return (
    <div style={{ gridColumn: span, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ ...mono(9, theme.color.slate), letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

const th = {
  textAlign: "left",
  fontFamily: F.mono,
  fontSize: 9,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: theme.color.slate,
  padding: "0 8px 8px",
  borderBottom: `1px solid ${C.hair}`,
  whiteSpace: "nowrap",
};

const td = {
  padding: "6px 8px",
  borderBottom: `1px solid ${C.hair}`,
  verticalAlign: "middle",
};
