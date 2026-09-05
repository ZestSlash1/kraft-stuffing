import { useState } from "react";
import { theme } from "../theme";
import ShipperConsigneeSelect from "./ShipperConsigneeSelect";
import { useDirtyGuard } from "../lib/useDirtyGuard";

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
    shipperEmail: booking?.shipperEmail || "",
    consigneeEmail: booking?.consigneeEmail || "",
    notifyShipper: booking?.notifyShipper || false,
    notifyConsignee: booking?.notifyConsignee || false,
  });

  const { markDirty, markClean } = useDirtyGuard();
  const set = (k) => (e) => {
    markDirty();
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };
  const setBool = (k) => (e) => {
    markDirty();
    setForm((f) => ({ ...f, [k]: e.target.checked }));
  };

  const submit = () => {
    if (!form.bookingDate) return;
    markClean();
    onSubmit({
      shipperId: form.shipperId,
      consigneeId: form.consigneeId,
      bookingDate: form.bookingDate,
      freightAmount: form.freightAmount === "" ? null : Number(form.freightAmount),
      freightCurrency: form.freightCurrency,
      freightStatus: form.freightStatus,
      paymentStatus: form.paymentStatus,
      notes: form.notes,
      shipperEmail: form.shipperEmail.trim(),
      consigneeEmail: form.consigneeEmail.trim(),
      notifyShipper: form.notifyShipper,
      notifyConsignee: form.notifyConsignee,
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
        background: "rgba(2,4,7,0.55)",
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

        {/* Customer notifications (§B.3) — external email is opt-in, default OFF. */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: `1px solid ${theme.color.border}`,
          }}
        >
          <div style={{ fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.16em", color: theme.color.slate, marginBottom: 10 }}>
            CUSTOMER NOTIFICATIONS (OPT-IN)
          </div>
          <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Shipper email">
              <input type="email" {...fProps("shipperEmail")} placeholder="shipper@example.com" />
            </Field>
            <Field label="Consignee email">
              <input type="email" {...fProps("consigneeEmail")} placeholder="consignee@example.com" />
            </Field>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: theme.font.mono, fontSize: 12, color: theme.color.inkSoft, cursor: "pointer" }}>
              <input type="checkbox" checked={form.notifyShipper} onChange={setBool("notifyShipper")} />
              Notify shipper on document issue
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: theme.font.mono, fontSize: 12, color: theme.color.inkSoft, cursor: "pointer" }}>
              <input type="checkbox" checked={form.notifyConsignee} onChange={setBool("notifyConsignee")} />
              Notify consignee on departure/arrival
            </label>
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
            {booking ? "Save Changes" : "Create Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}
