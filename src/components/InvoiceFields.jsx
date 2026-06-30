import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { theme } from "../theme";

const inputStyle = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  color: theme.color.ink,
  borderRadius: 4,
  padding: "8px 10px",
  fontFamily: theme.font.mono,
  fontSize: 13,
  width: "100%",
};

const labelStyle = {
  fontSize: 11,
  color: theme.color.slate,
  marginBottom: 4,
  display: "block",
};

function Field({ label, children, width }) {
  return (
    <div style={{ flex: width ? "0 0 auto" : 1, minWidth: width || 140 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const hasAnyValue = (v) =>
  (v.invoiceNos?.length || 0) > 0 ||
  v.invoiceValue ||
  v.hsCode ||
  v.ewayBillNo ||
  v.chaRef ||
  v.notifyParty;

// Collapsible "Invoice & Docs" subform. All fields optional. Lives inside
// AddForm; the parent owns the actual field state and passes it down.
export default function InvoiceFields({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [invoiceDraft, setInvoiceDraft] = useState("");

  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });

  const addInvoiceNo = () => {
    const trimmed = invoiceDraft.trim();
    if (!trimmed) return;
    if (v.invoiceNos?.includes(trimmed)) {
      setInvoiceDraft("");
      return;
    }
    set({ invoiceNos: [...(v.invoiceNos || []), trimmed] });
    setInvoiceDraft("");
  };

  const removeInvoiceNo = (no) => {
    set({ invoiceNos: (v.invoiceNos || []).filter((n) => n !== no) });
  };

  return (
    <div
      style={{
        flex: "1 0 100%",
        border: `1px solid ${theme.color.border}`,
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "none",
          border: "none",
          color: theme.color.slate,
          fontFamily: theme.font.mono,
          fontSize: 12,
          padding: "8px 12px",
          cursor: "pointer",
        }}
      >
        <ChevronRight
          size={13}
          style={{
            transform: open ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s ease",
          }}
        />
        Invoice &amp; Docs
        {!open && hasAnyValue(v) && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: theme.color.amber,
              marginLeft: 2,
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            padding: "4px 12px 14px",
          }}
        >
          <Field label="invoice no(s)" width="100%">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 6,
              }}
            >
              {(v.invoiceNos || []).map((no) => (
                <span
                  key={no}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: theme.color.surface,
                    border: `1px solid ${theme.color.border}`,
                    borderRadius: 4,
                    padding: "3px 8px",
                    fontFamily: theme.font.mono,
                    fontSize: 11,
                    color: theme.color.ink,
                  }}
                >
                  {no}
                  <span
                    onClick={() => removeInvoiceNo(no)}
                    style={{ cursor: "pointer", color: theme.color.red }}
                  >
                    ×
                  </span>
                </span>
              ))}
            </div>
            <input
              value={invoiceDraft}
              onChange={(e) => setInvoiceDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addInvoiceNo();
                }
              }}
              placeholder="type invoice no, press Enter"
              style={inputStyle}
            />
          </Field>

          <Field label="invoice value">
            <input
              type="number"
              value={v.invoiceValue ?? ""}
              onChange={(e) => set({ invoiceValue: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="currency" width={100}>
            <select
              value={v.invoiceCurrency || "INR"}
              onChange={(e) => set({ invoiceCurrency: e.target.value })}
              style={inputStyle}
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
            </select>
          </Field>
          <Field label="hs code" width={110}>
            <input
              value={v.hsCode || ""}
              onChange={(e) => set({ hsCode: e.target.value })}
              maxLength={6}
              style={inputStyle}
            />
          </Field>
          <Field label="e-way bill no">
            <input
              value={v.ewayBillNo || ""}
              onChange={(e) => set({ ewayBillNo: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="cha reference">
            <input
              value={v.chaRef || ""}
              onChange={(e) => set({ chaRef: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="notify party">
            <input
              value={v.notifyParty || ""}
              onChange={(e) => set({ notifyParty: e.target.value })}
              style={inputStyle}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
