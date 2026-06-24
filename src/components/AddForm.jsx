import { useState } from "react";
import { TOKENS } from "../data/statusHelpers";

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

export default function AddForm({ onAddLine }) {
  const [cargo, setCargo] = useState("Potato");
  const [qty, setQty] = useState("");
  const [unitWeightKg, setUnitWeightKg] = useState("50");
  const [shipper, setShipper] = useState("Shafrina Impex LLP");
  const [consignee, setConsignee] = useState("Y.E. Jadwet Group");
  const [truckNo, setTruckNo] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (!qty || Number(qty) <= 0) return;
    onAddLine({
      cargo,
      qty: Number(qty),
      unitWeightKg: Number(unitWeightKg),
      shipper,
      consignee,
      truckNo,
    });
    setQty("");
    setTruckNo("");
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
      <Field label="qty (bags)">
        <input
          type="number"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          style={inputStyle}
        />
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
        <input value={shipper} onChange={(e) => setShipper(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="consignee">
        <input value={consignee} onChange={(e) => setConsignee(e.target.value)} style={inputStyle} />
      </Field>
      <Field label="truck no">
        <input value={truckNo} onChange={(e) => setTruckNo(e.target.value)} style={inputStyle} />
      </Field>
      <div style={{ display: "flex", alignItems: "flex-end" }}>
        <button
          type="submit"
          style={{
            background: TOKENS.green,
            color: "#07090e",
            border: "none",
            borderRadius: 4,
            padding: "9px 18px",
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
