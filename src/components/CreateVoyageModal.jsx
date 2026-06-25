import { useState } from "react";
import { TOKENS } from "../data/statusHelpers";

const label = {
  fontFamily: TOKENS.mono,
  fontSize: 9,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: TOKENS.steel,
  marginBottom: 4,
  display: "block",
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  background: TOKENS.bg,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 0,
  color: "#e2e8f0",
  padding: "10px 12px",
  fontFamily: TOKENS.mono,
  fontSize: 13,
  outline: "none",
};

function Field({ label: l, children }) {
  return (
    <div>
      <label style={label}>{l}</label>
      {children}
    </div>
  );
}

// Used for both create (no `voyage`) and edit (pre-filled `voyage`).
export default function CreateVoyageModal({ voyage, defaults = {}, onClose, onSubmit }) {
  const [form, setForm] = useState({
    vessel: voyage?.vessel || "",
    voyageNo: voyage?.voyageNo || "",
    date: voyage?.date || new Date().toISOString().slice(0, 10),
    pol: voyage?.pol || defaults.default_pol || "Kolkata",
    pod: voyage?.pod || defaults.default_pod || "Port Blair",
    etd: voyage?.etd ? voyage.etd.slice(0, 16) : "",
    shippingLine: voyage?.shippingLine || "",
    bookingRef: voyage?.bookingRef || "",
    chaName: voyage?.chaName || "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    if (!form.vessel.trim() || !form.voyageNo.trim() || !form.date) return;
    onSubmit({ ...form, etd: form.etd || null });
  };

  const fProps = (k) => ({
    value: form[k],
    onChange: set(k),
    style: input,
    onFocus: (e) => (e.target.style.borderColor = TOKENS.amber),
    onBlur: (e) => (e.target.style.borderColor = TOKENS.border),
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
      className="modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card"
        style={{
          width: "100%",
          maxWidth: 520,
          background: TOKENS.surface,
          border: `1px solid ${TOKENS.border}`,
          borderRadius: 16,
          padding: 20,
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontFamily: TOKENS.condensed,
            fontWeight: 800,
            fontSize: 24,
            color: "#e8eef4",
            marginBottom: 16,
          }}
        >
          {voyage ? "EDIT VOYAGE" : "NEW VOYAGE"}
        </div>

        <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Vessel name *">
            <input {...fProps("vessel")} placeholder="MV APJ Karan 2" />
          </Field>
          <Field label="Voyage No *">
            <input {...fProps("voyageNo")} placeholder="AK2-118" />
          </Field>
          <Field label="Date *">
            <input type="date" {...fProps("date")} />
          </Field>
          <Field label="ETD">
            <input type="datetime-local" {...fProps("etd")} />
          </Field>
          <Field label="Port of Loading">
            <input {...fProps("pol")} />
          </Field>
          <Field label="Port of Discharge">
            <input {...fProps("pod")} />
          </Field>
          <Field label="Shipping Line">
            <input {...fProps("shippingLine")} />
          </Field>
          <Field label="Booking Reference">
            <input {...fProps("bookingRef")} />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="CHA Name">
              <input {...fProps("chaName")} />
            </Field>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: "0 0 auto",
              background: "none",
              border: `1px solid ${TOKENS.border}`,
              color: TOKENS.steel,
              fontFamily: TOKENS.mono,
              fontSize: 12,
              padding: "12px 18px",
              borderRadius: 0,
              cursor: "pointer",
            }}
          >
            CANCEL
          </button>
          <button
            onClick={submit}
            style={{
              flex: 1,
              background: TOKENS.amber,
              border: "none",
              color: TOKENS.bg,
              fontFamily: TOKENS.condensed,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "12px 18px",
              borderRadius: 0,
              cursor: "pointer",
            }}
          >
            {voyage ? "Save Changes" : "Create Voyage"}
          </button>
        </div>
      </div>
    </div>
  );
}
