import { useState } from "react";
import { theme } from "../theme";

const label = {
  fontFamily: theme.font.mono,
  fontSize: 9,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: theme.color.slate,
  marginBottom: 4,
  display: "block",
};

const input = {
  width: "100%",
  boxSizing: "border-box",
  background: theme.color.surface,
  border: `1px solid ${theme.color.borderStrong}`,
  borderRadius: theme.radius.input,
  color: theme.color.ink,
  padding: "10px 12px",
  fontFamily: theme.font.mono,
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
    onFocus: (e) => (e.target.style.borderColor = theme.color.amber),
    onBlur: (e) => (e.target.style.borderColor = theme.color.borderStrong),
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(15,23,42,0.35)",
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
          background: theme.color.surface,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.card,
          boxShadow: theme.shadow.raised,
          padding: 20,
          maxHeight: "92vh",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            fontFamily: theme.font.condensed,
            fontWeight: 800,
            fontSize: 24,
            color: theme.color.ink,
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
              background: theme.color.surface,
              border: `1px solid ${theme.color.borderStrong}`,
              color: theme.color.inkSoft,
              fontFamily: theme.font.mono,
              fontSize: 12,
              padding: "12px 18px",
              borderRadius: theme.radius.input,
              cursor: "pointer",
            }}
          >
            CANCEL
          </button>
          <button
            onClick={submit}
            style={{
              flex: 1,
              background: theme.color.amber,
              border: "none",
              color: theme.color.white,
              fontFamily: theme.font.condensed,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "12px 18px",
              borderRadius: theme.radius.input,
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
