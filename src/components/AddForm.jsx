import { useState } from "react";
import { TOKENS } from "../data/statusHelpers";
import InvoiceFields from "./InvoiceFields";
import ShipperConsigneeSelect from "./ShipperConsigneeSelect";
import BookingSelect from "./BookingSelect";

export const CARGO_UNITS = [
  "Bags",
  "Cartons",
  "Rolls",
  "Drums",
  "Pallets",
  "Bundles",
  "Pieces",
  "MT",
];

const inputStyle = {
  background: TOKENS.bg,
  border: `1px solid ${TOKENS.border}`,
  color: "#e2e8f0",
  borderRadius: 4,
  padding: "8px 10px",
  fontFamily: TOKENS.mono,
  fontSize: 13,
  width: "100%",
};

const labelStyle = {
  fontSize: 11,
  color: "#64748b",
  marginBottom: 4,
  display: "block",
};

function Field({ label, children }) {
  return (
    <div style={{ flex: 1, minWidth: 140 }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const emptyInvoice = {
  invoiceNos: [],
  invoiceValue: "",
  invoiceCurrency: "INR",
  hsCode: "",
  ewayBillNo: "",
  chaRef: "",
  notifyParty: "",
};

export default function AddForm({
  onAddLine,
  shippers = [],
  consignees = [],
  bookings = [],
  onCreateShipper,
  onCreateConsignee,
}) {
  const [cargo, setCargo] = useState("Potato");
  const [qty, setQty] = useState("");
  const [unit, setUnit] = useState("Bags");
  const [unitWeightKg, setUnitWeightKg] = useState("50");
  const [shipper, setShipper] = useState({ id: null, name: "Shafrina Impex LLP" });
  const [consignee, setConsignee] = useState({ id: null, name: "Y.E. Jadwet Group" });
  const [truckNo, setTruckNo] = useState("");
  const [bookingId, setBookingId] = useState(null);
  const [invoice, setInvoice] = useState(emptyInvoice);

  const submit = (e) => {
    e.preventDefault();
    if (!qty || Number(qty) <= 0) return;
    onAddLine({
      cargo,
      qty: Number(qty),
      unit,
      unitWeightKg: Number(unitWeightKg),
      shipperId: shipper.id,
      shipper: shipper.name,
      consigneeId: consignee.id,
      consignee: consignee.name,
      truckNo,
      bookingId,
      invoiceNos: invoice.invoiceNos,
      invoiceValue: invoice.invoiceValue === "" ? null : Number(invoice.invoiceValue),
      invoiceCurrency: invoice.invoiceCurrency,
      hsCode: invoice.hsCode,
      ewayBillNo: invoice.ewayBillNo,
      chaRef: invoice.chaRef,
      notifyParty: invoice.notifyParty,
    });
    setQty("");
    setTruckNo("");
    setBookingId(null);
    setInvoice(emptyInvoice);
  };

  const createShipper = async (draft) => {
    if (!onCreateShipper) return null;
    return onCreateShipper(draft);
  };

  const createConsignee = async (draft) => {
    if (!onCreateConsignee) return null;
    return onCreateConsignee(draft);
  };

  return (
    <form
      onSubmit={submit}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        background: TOKENS.surface,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 6,
        padding: 14,
        marginTop: 12,
      }}
    >
      <Field label="cargo">
        <select value={cargo} onChange={(e) => setCargo(e.target.value)} style={inputStyle}>
          {["Potato", "Onion", "Rice", "Garlic", "Sugar"].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label="qty">
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={inputStyle}
        />
      </Field>
      <Field label="unit">
        <select value={unit} onChange={(e) => setUnit(e.target.value)} style={inputStyle}>
          {CARGO_UNITS.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </Field>
      <Field label="unit weight (kg)">
        <input
          type="number"
          value={unitWeightKg}
          onChange={(e) => setUnitWeightKg(e.target.value)}
          style={inputStyle}
        />
      </Field>
      <Field label="shipper">
        <ShipperConsigneeSelect
          kind="shipper"
          items={shippers}
          name={shipper.name}
          onSelect={setShipper}
          onCreate={createShipper}
        />
      </Field>
      <Field label="consignee">
        <ShipperConsigneeSelect
          kind="consignee"
          items={consignees}
          name={consignee.name}
          onSelect={setConsignee}
          onCreate={createConsignee}
        />
      </Field>
      <Field label="truck no">
        <input value={truckNo} onChange={(e) => setTruckNo(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="link to booking">
        <BookingSelect
          bookings={bookings}
          shippers={shippers}
          consignees={consignees}
          bookingId={bookingId}
          onSelect={setBookingId}
        />
      </Field>

      <InvoiceFields value={invoice} onChange={setInvoice} />

      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <button
          type="submit"
          style={{
            background: TOKENS.green,
            color: "#07090e",
            border: "none",
            borderRadius: 4,
            padding: "9px 18px",
            minHeight: 44,
            fontFamily: TOKENS.mono,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          add line
        </button>
      </div>
    </form>
  );
}
