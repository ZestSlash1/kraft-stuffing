import { Download } from "lucide-react";
import { formatIST } from "../data/statusHelpers";
import { theme } from "../theme";
import { generateManifest } from "../lib/exportManifestPdf";

const cell = { fontFamily: theme.font.mono, fontSize: 11, color: theme.color.inkSoft, padding: "8px 10px" };
const headCell = {
  fontFamily: theme.font.mono,
  fontSize: 9,
  letterSpacing: "0.1em",
  color: theme.color.slate,
  padding: "8px 10px",
};

export default function ManifestDocumentView({ app, voyage }) {
  const { state } = app;

  if (!voyage) {
    return (
      <div style={{ padding: "40px 18px", textAlign: "center", fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>
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
          <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 28, color: theme.color.ink }}>
            CARGO MANIFEST
          </div>
          <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, marginTop: 4 }}>
            {voyage.voyageNo} — {voyage.vessel} — {voyage.pol} → {voyage.pod}
          </div>
        </div>
        <button
          onClick={() => generateManifest(voyage, sealedContainers.length ? sealedContainers : containers, state.shippers)}
          style={{
            background: theme.color.amber,
            border: "none",
            color: theme.color.surface,
            fontFamily: theme.font.condensed,
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
            border: `1px solid ${theme.color.amber}`,
            background: theme.color.amberSoft,
            color: "#b3700a",
            fontFamily: theme.font.mono,
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
          <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 24, color: theme.color.slateFaint }}>
            NO SEALED CONTAINERS YET
          </div>
          <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, marginTop: 8 }}>
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
                  background: theme.color.surface,
                  border: `1px solid ${theme.color.border}`,
                  padding: "10px 14px",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 18,
                  fontFamily: theme.font.mono,
                  fontSize: 11,
                  color: theme.color.ink,
                }}
              >
                <span>
                  <span style={{ color: theme.color.slate }}>CONTAINER </span>
                  {c.number || "Unassigned"}
                </span>
                <span>
                  <span style={{ color: theme.color.slate }}>SIZE </span>
                  {c.size}ft
                </span>
                <span>
                  <span style={{ color: theme.color.slate }}>SEAL </span>
                  {c.sealNo || "—"}
                </span>
                <span>
                  <span style={{ color: theme.color.slate }}>SEALED </span>
                  {formatIST(c.sealedAt)}
                </span>
                <span>
                  <span style={{ color: theme.color.slate }}>GROSS </span>
                  {grossKg.toFixed(0)} kg
                </span>
              </div>

              <div style={{ border: `1px solid ${theme.color.border}`, borderTop: "none" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.2fr 0.6fr 1.2fr 1fr 1.2fr 0.8fr 1.2fr",
                    borderBottom: `1px solid ${theme.color.border}`,
                  }}
                >
                  {["CARGO", "QTY", "SHIPPER", "GSTIN", "CONSIGNEE", "HS CODE", "INVOICE NOS"].map((h) => (
                    <div key={h} style={headCell}>
                      {h}
                    </div>
                  ))}
                </div>
                {(c.lines || []).length === 0 ? (
                  <div style={{ ...cell, color: theme.color.slate }}>No cargo logged.</div>
                ) : (
                  c.lines.map((l) => (
                    <div
                      key={l.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.2fr 0.6fr 1.2fr 1fr 1.2fr 0.8fr 1.2fr",
                        borderBottom: `1px solid ${theme.color.border}`,
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
