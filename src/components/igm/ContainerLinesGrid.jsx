import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { theme } from "../../theme";
import { C, F } from "../../ui/theme";
import {
  CONTAINER_SIZES,
  CONTAINER_TYPES,
  MOVEMENT_MODES,
  SEAL_TYPES,
  normalizeContainerNo,
  validateContainerNo,
} from "../../data/igmHelpers";
import {
  CheckField,
  EmptyState,
  Field,
  SelectInput,
  TextInput,
  iconBtn,
  mono,
  secondaryBtn,
} from "./igmChrome";

// Container lines for one BL. The row carries the fields an operator fills for
// every box; the reefer / stowage / movement fields sit in a per-row expander so
// the common case stays one line. Container numbers are check-digit validated
// (ISO 6346) as you leave the cell — invalid ones are flagged, never rejected,
// because a physically mislabelled box still has to be manifested.
export default function ContainerLinesGrid({ rows = [], onPatch, onAdd, onRemove, isMobile }) {
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const commit = (row, key, raw) => {
    const next = key === "containerNo" ? normalizeContainerNo(raw) : raw;
    if (String(row[key] ?? "") !== String(next ?? "")) onPatch(row.id, { [key]: next });
  };

  const cell = (row, key, props = {}) => (
    <TextInput
      key={`${row.id}-${key}`}
      defaultValue={row[key] ?? ""}
      onBlur={(e) => commit(row, key, e.target.value)}
      {...props}
    />
  );

  const numCell = (row, key) =>
    cell(row, key, { type: "number", inputMode: "decimal", style: { textAlign: "right" } });

  const Advanced = ({ row }) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, minmax(0, 1fr))",
        gap: 12,
        padding: isMobile ? "12px 0 4px" : "14px 8px 6px",
        borderTop: `1px dashed ${C.hair}`,
      }}
    >
      <Field label="Seal type">
        <SelectInput
          value={row.sealType || ""}
          allowBlank
          options={SEAL_TYPES}
          onChange={(e) => onPatch(row.id, { sealType: e.target.value })}
        />
      </Field>
      <Field label="FCL / LCL">
        <SelectInput
          value={row.fclLcl || "FCL"}
          options={["FCL", "LCL"]}
          onChange={(e) => onPatch(row.id, { fclLcl: e.target.value })}
        />
      </Field>
      <Field label="Arrival mode">
        <SelectInput
          value={row.arrMode || ""}
          allowBlank
          options={MOVEMENT_MODES}
          onChange={(e) => onPatch(row.id, { arrMode: e.target.value })}
        />
      </Field>
      <Field label="Dispatch mode">
        <SelectInput
          value={row.dispMode || ""}
          allowBlank
          options={MOVEMENT_MODES}
          onChange={(e) => onPatch(row.id, { dispMode: e.target.value })}
        />
      </Field>
      <Field label="Temperature (°C)" hint="Reefer set point">
        {cell(row, "temperature", { type: "number", inputMode: "decimal" })}
      </Field>
      <Field label="Cell location">{cell(row, "cellLocation", { placeholder: "0120802" })}</Field>
      <Field label="Dangerous cargo mark">{cell(row, "dngMark")}</Field>
      <CheckField
        label="SOC (shipper-owned)"
        checked={row.soc}
        onChange={(v) => onPatch(row.id, { soc: v })}
      />
    </div>
  );

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {rows.length === 0 && <EmptyState>No containers yet.</EmptyState>}
        {rows.map((row, i) => {
          const check = validateContainerNo(row.containerNo);
          return (
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
                <span style={mono(11, theme.color.slate)}>CNTR {i + 1}</span>
                <button onClick={() => onRemove(row)} style={{ ...iconBtn, color: theme.color.red }} title="Remove container">
                  <Trash2 size={13} />
                </button>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Container no." check={check}>
                  {cell(row, "containerNo", { placeholder: "MSCU1234566", style: { textTransform: "uppercase" } })}
                </Field>
              </div>
              <Field label="Size">
                <SelectInput
                  value={row.size || "20"}
                  options={CONTAINER_SIZES}
                  onChange={(e) => onPatch(row.id, { size: e.target.value })}
                />
              </Field>
              <Field label="Type">
                <SelectInput
                  value={row.type || ""}
                  allowBlank
                  options={CONTAINER_TYPES}
                  onChange={(e) => onPatch(row.id, { type: e.target.value })}
                />
              </Field>
              <Field label="Seal no.">{cell(row, "sealNo")}</Field>
              <Field label="Packages">{numCell(row, "pkgs")}</Field>
              <Field label="Gross wt">{numCell(row, "grossWt")}</Field>
              <Field label="Tare wt">{numCell(row, "tareWt")}</Field>
              <Field label="VGM">{numCell(row, "vgm")}</Field>
              <div style={{ gridColumn: "1 / -1" }}>
                <button onClick={() => toggle(row.id)} style={{ ...secondaryBtn, width: "100%", justifyContent: "center" }}>
                  {expanded[row.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  Reefer, stowage & movement
                </button>
                {expanded[row.id] && <Advanced row={row} />}
              </div>
            </div>
          );
        })}
        <button onClick={onAdd} style={secondaryBtn}>
          <Plus size={14} /> Add container
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
          <thead>
            <tr>
              {[
                ["", 28],
                ["#", 30],
                ["Container no.", 150],
                ["Size", 90],
                ["Type", 90],
                ["Seal no.", 120],
                ["Pkgs", 90],
                ["Gross wt", 100],
                ["Tare wt", 100],
                ["VGM", 100],
                ["", 42],
              ].map(([h, w], i) => (
                <th key={`${h}-${i}`} style={{ ...th, width: w || undefined }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ ...td, padding: 0 }}>
                  <div style={{ padding: "14px 0" }}>
                    <EmptyState>No containers yet — add the boxes carried under this BL.</EmptyState>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const check = validateContainerNo(row.containerNo);
                return [
                  <tr key={row.id}>
                    <td style={td}>
                      <button
                        onClick={() => toggle(row.id)}
                        style={{ ...iconBtn, padding: 4 }}
                        title="Reefer, stowage & movement fields"
                      >
                        {expanded[row.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      </button>
                    </td>
                    <td style={{ ...td, ...mono(11, theme.color.slate) }}>{i + 1}</td>
                    <td style={td}>
                      {cell(row, "containerNo", {
                        placeholder: "MSCU1234566",
                        invalid: check.ok === false,
                        style: { textTransform: "uppercase" },
                      })}
                      {check.ok === false && (
                        <div style={{ ...mono(9.5, theme.color.red), marginTop: 3 }}>{check.reason}</div>
                      )}
                    </td>
                    <td style={td}>
                      <SelectInput
                        value={row.size || "20"}
                        options={CONTAINER_SIZES}
                        onChange={(e) => onPatch(row.id, { size: e.target.value })}
                      />
                    </td>
                    <td style={td}>
                      <SelectInput
                        value={row.type || ""}
                        allowBlank
                        options={CONTAINER_TYPES}
                        onChange={(e) => onPatch(row.id, { type: e.target.value })}
                      />
                    </td>
                    <td style={td}>{cell(row, "sealNo")}</td>
                    <td style={td}>{numCell(row, "pkgs")}</td>
                    <td style={td}>{numCell(row, "grossWt")}</td>
                    <td style={td}>{numCell(row, "tareWt")}</td>
                    <td style={td}>{numCell(row, "vgm")}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button
                        onClick={() => onRemove(row)}
                        style={{ ...iconBtn, color: theme.color.red }}
                        title="Remove container"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>,
                  expanded[row.id] && (
                    <tr key={`${row.id}-adv`}>
                      <td colSpan={11} style={{ ...td, padding: 0 }}>
                        <Advanced row={row} />
                      </td>
                    </tr>
                  ),
                ];
              })
            )}
          </tbody>
        </table>
      </div>
      <button onClick={onAdd} style={{ ...secondaryBtn, marginTop: 12 }}>
        <Plus size={14} /> Add container
      </button>
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
  verticalAlign: "top",
};
