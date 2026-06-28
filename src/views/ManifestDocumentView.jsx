import { Download } from "lucide-react";
import { TOKENS, formatIST } from "../data/statusHelpers";
import { generateManifest } from "../lib/exportManifestPdf";

const cell = { fontFamily: TOKENS.mono, fontSize: 11, color: "#cbd5e1", padding: "8px 10px" };
const headCell = {
  fontFamily: TOKENS.mono,
  fontSize: 9,
  letterSpacing: "0.1em",
  color: TOKENS.steel,
  padding: "8px 10px",
};

export default function ManifestDocumentView({ app, voyage }) {
  const { state } = app;

  if (!voyage) {
    return (
      <div style={{ padding: "40px 18px", textAlign: "center", fontFamily: TOKENS.mono, fontSize: 12, color: TOKENS.steel }}>
        No active voyage selected.
      </div>
    );
  }

  const containers = voyage.containers || [];
  const sealedContainers = containers.filter((c) => c.sealed);
  const unsealedCount = containers.length - sealedContainers.length;
  const shippersById = Object.fromEntries(state.shippers.map((s) => [s.id, s]));

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 18px 60px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: TOKENS.condensed, fontWeight: 800, fontSize: 28, color: "#e8eef4" }}>
            CARGO MANIFEST
          </div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 12, color: TOKENS.steel, marginTop: 4 }}>
            {voyage.voyageNo} — {voyage.vessel} — {voyage.pol} → {voyage.pod}
          </div>
        </div>
        <button
          onClick={() => generateManifest(voyage, sealedContainers.length ? sealedContainers : containers, state.shippers)}
          style={{
            background: TOKENS.amber,
            border: "none",
            color: TOKENS.bg,
            fontFamily: TOKENS.condensed,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "9px 16px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <Download size={15} /> Export PDF
        </button>
      </div>

      {unsealedCount > 0 && (
        <div
          style={{
            marginTop: 14,
            border: `1px solid ${TOKENS.amber}`,
            background: "#1a1206",
            color: TOKENS.amber,
            fontFamily: TOKENS.mono,
            fontSize: 11,
            padding: "8px 12px",
          }}
        >
          {unsealedCount} container{unsealedCount === 1 ? "" : "s"} not yet sealed — manifest below shows sealed
          containers only.
        </div>
      )}

      {sealedContainers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontFamily: TOKENS.condensed, fontWeight: 800, fontSize: 24, color: "#1c2d42" }}>
            NO SEALED CONTAINERS YET
          </div>
          <div style={{ fontFamily: TOKENS.mono, fontSize: 12, color: TOKENS.steel, marginTop: 8 }}>
            Seal at least one container to generate the cargo manifest.
          </div>
        </div>
      ) : (
        sealedContainers.map((c) => {
          const netKg = (c.lines || []).reduce((a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0), 0);
          const grossKg = netKg + Number(c.tareWeightKg || 0);
          return (
            <div key={c.id} style={{ marginTop: 24 }}>
              <div
                style={{
                  background: TOKENS.surface,
                  border: `1px solid ${TOKENS.border}`,
                  padding: "10px 14px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 18,
                  fontFamily: TOKENS.mono,
                  fontSize: 11,
                  color: "#e8eef4",
                }}
              >
                <span>
                  <span style={{ color: TOKENS.steel }}>CONTAINER </span>
                  {c.number || "Unassigned"}
                </span>
                <span>
                  <span style={{ color: TOKENS.steel }}>SIZE </span>
                  {c.size}ft
                </span>
                <span>
                  <span style={{ color: TOKENS.steel }}>SEAL </span>
                  {c.sealNo || "—"}
                </span>
                <span>
                  <span style={{ color: TOKENS.steel }}>SEALED </span>
                  {formatIST(c.sealedAt)}
                </span>
                <span>
                  <span style={{ color: TOKENS.steel }}>GROSS </span>
                  {grossKg.toFixed(0)} kg
                </span>
              </div>

              <div style={{ border: `1px solid ${TOKENS.border}`, borderTop: "none" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 0.6fr 1.2fr 1fr 1.2fr 0.8fr 1.2fr",
                    borderBottom: `1px solid ${TOKENS.border}`,
                  }}
                >
                  {["CARGO", "QTY", "SHIPPER", "GSTIN", "CONSIGNEE", "HS CODE", "INVOICE NOS"].map((h) => (
                    <div key={h} style={headCell}>
                      {h}
                    </div>
                  ))}
                </div>
                {(c.lines || []).length === 0 ? (
                  <div style={{ ...cell, color: TOKENS.steel }}>No cargo logged.</div>
                ) : (
                  c.lines.map((l) => (
                    <div
                      key={l.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 0.6fr 1.2fr 1fr 1.2fr 0.8fr 1.2fr",
                        borderBottom: `1px solid ${TOKENS.border}`,
                      }}
                    >
                      <div style={cell}>{l.cargo}</div>
                      <div style={cell}>
                        {l.qty} {l.unit}
                      </div>
                      <div style={cell}>{l.shipper || "—"}</div>
                      <div style={cell}>{shippersById[l.shipperId]?.gstin || "—"}</div>
                      <div style={cell}>{l.consignee || "—"}</div>
                      <div style={cell}>{l.hsCode || "—"}</div>
                      <div style={cell}>{(l.invoiceNos || []).join(", ") || "—"}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
