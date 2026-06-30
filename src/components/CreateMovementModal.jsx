import { useState } from "react";
import { theme } from "../theme";
import { VESSEL_EVENT_TYPES } from "../data/manifestHelpers";

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
  border: `1px solid ${theme.color.border}`,
  borderRadius: 12,
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

export default function CreateMovementModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    eventType: "loading",
    eventDate: new Date().toISOString().slice(0, 16),
    location: "",
    latitude: "",
    longitude: "",
    notes: "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    if (!form.eventDate) return;
    onSubmit({
      eventType: form.eventType,
      eventDate: new Date(form.eventDate).toISOString(),
      location: form.location,
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
      notes: form.notes,
    });
  };

  const fProps = (k) => ({
    value: form[k],
    onChange: set(k),
    style: input,
    onFocus: (e) => (e.target.style.borderColor = theme.color.amber),
    onBlur: (e) => (e.target.style.borderColor = theme.color.border),
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
          maxWidth: 480,
          background: theme.color.surface,
          border: `1px solid ${theme.color.border}`,
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
          ADD MOVEMENT
        </div>

        <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Event type *">
            <select {...fProps("eventType")}>
              {VESSEL_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Event date/time *">
            <input type="datetime-local" {...fProps("eventDate")} />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Location">
              <input {...fProps("location")} placeholder="Kolkata Port" />
            </Field>
          </div>
          <Field label="Latitude">
            <input type="number" {...fProps("latitude")} placeholder="22.5726" />
          </Field>
          <Field label="Longitude">
            <input type="number" {...fProps("longitude")} placeholder="88.3639" />
          </Field>
          <div style={{ gridColumn: "1 / -1" }}>
            <Field label="Notes">
              <input {...fProps("notes")} />
            </Field>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              flex: "0 0 auto",
              background: "none",
              border: `1px solid ${theme.color.border}`,
              color: theme.color.slate,
              fontFamily: theme.font.mono,
              fontSize: 12,
              padding: "12px 18px",
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
              color: theme.color.surface,
              fontFamily: theme.font.condensed,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "12px 18px",
              cursor: "pointer",
            }}
          >
            Add Movement
          </button>
        </div>
      </div>
    </div>
  );
}
