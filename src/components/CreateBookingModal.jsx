import { useState } from "react";
import { TOKENS } from "../data/statusHelpers";
import ShipperConsigneeSelect from "./ShipperConsigneeSelect";

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

const FREIGHT_STATUSES = ["to_pay", "prepaid", "paid"];
const PAYMENT_STATUSES = ["pending", "partial", "paid"];

// Used for both create (no `booking`) and edit (pre-filled `booking`).
export default function CreateBookingModal({
  booking,
  shippers = [],
  consignees = [],
  onClose,
  onSubmit,
  onCreateShipper,
  onCreateConsignee,
}) {
  const initialShipper = shippers.find((s) => s.id === booking?.shipperId);
  const initialConsignee = consignees.find((c) => c.id === booking?.consigneeId);

  const [form, setForm] = useState({
    shipperId: booking?.shipperId || null,
    shipperName: initialShipper?.name || "",
    consigneeId: booking?.consigneeId || null,
    consigneeName: initialConsignee?.name || "",
    bookingDate: booking?.bookingDate || new Date().toISOString().slice(0, 10),
    freightAmount: booking?.freightAmount ?? "",
    freightCurrency: booking?.freightCurrency || "INR",
    freightStatus: booking?.freightStatus || "to_pay",
    paymentStatus: booking?.paymentStatus || "pending",
    notes: booking?.notes || "",
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = () => {
    if (!form.bookingDate) return;
    onSubmit({
      shipperId: form.shipperId,
      consigneeId: form.consigneeId,
      bookingDate: form.bookingDate,
      freightAmount: form.freightAmount === "" ? null : Number(form.freightAmount),
      freightCurrency: form.freightCurrency,
      freightStatus: form.freightStatus,
      paymentStatus: form.paymentStatus,
      notes: form.notes,
    });
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
          {booking ? "EDIT BOOKING" : "NEW BOOKING"}
        </div>

        <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Shipper">
            <ShipperConsigneeSelect
              kind="shipper"
              items={shippers}
              name={form.shipperName}
              onSelect={({ id, name }) => setForm((f) => ({ ...f, shipperId: id, shipperName: name }))}
              onCreate={onCreateShipper}
            />
          </Field>
          <Field label="Consignee">
            <ShipperConsigneeSelect
              kind="consignee"
              items={consignees}
              name={form.consigneeName}
              onSelect={({ id, name }) => setForm((f) => ({ ...f, consigneeId: id, consigneeName: name }))}
              onCreate={onCreateConsignee}
            />
          </Field>
          <Field label="Booking date *">
            <input type="date" {...fProps("bookingDate")} />
          </Field>
          <Field label="Freight currency">
            <input {...fProps("freightCurrency")} placeholder="INR" />
          </Field>
          <Field label="Freight amount">
            <input type="number" {...fProps("freightAmount")} placeholder="0" />
          </Field>
          <Field label="Freight status">
            <select {...fProps("freightStatus")}>
              {FREIGHT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Payment status">
            <select {...fProps("paymentStatus")}>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
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
              border: `1px solid ${TOKENS.border}`,
              color: TOKENS.steel,
              fontFamily: TOKENS.mono,
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
              background: TOKENS.amber,
              border: "none",
              color: TOKENS.bg,
              fontFamily: TOKENS.condensed,
              fontWeight: 700,
              fontSize: 16,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "12px 18px",
              cursor: "pointer",
            }}
          >
            {booking ? "Save Changes" : "Create Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
