import ContainerCard from "../components/ContainerCard";
import AddForm from "../components/AddForm";
import LineCard from "../components/LineCard";
import { TOKENS, containerStatus, containerFillPct } from "../data/statusHelpers";

export default function LogView({ container, onBack, onAddLine, onDeleteLine, onPatchContainer }) {
  if (!container) return null;

  const status = containerStatus(container);
  const fillPct = Math.round(containerFillPct(container) * 100);
  const totalBags = container.lines.reduce((a, l) => a + Number(l.qty || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 20px",
          fontFamily: TOKENS.mono,
          color: "#e2e8f0",
          borderBottom: `1px solid ${TOKENS.border}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: `1px solid ${TOKENS.border}`,
              color: "#e2e8f0",
              borderRadius: 4,
              padding: "6px 12px",
              cursor: "pointer",
              fontFamily: TOKENS.mono,
            }}
          >
            ← back
          </button>
          <div style={{ fontSize: 16, fontWeight: 600 }}>
            {container.number || "Unassigned"}
          </div>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {status} · {fillPct}% · {totalBags}/{container.capacityBags} bags
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            placeholder="container number"
            value={container.number}
            onChange={(e) => onPatchContainer({ number: e.target.value })}
            style={{
              background: TOKENS.bg,
              border: `1px solid ${TOKENS.border}`,
              color: "#e2e8f0",
              borderRadius: 4,
              padding: "6px 10px",
              fontFamily: TOKENS.mono,
              fontSize: 12,
              width: 150,
            }}
          />
          <input
            placeholder="seal no"
            value={container.sealNo}
            onChange={(e) => onPatchContainer({ sealNo: e.target.value })}
            style={{
              background: TOKENS.bg,
              border: `1px solid ${TOKENS.border}`,
              color: "#e2e8f0",
              borderRadius: 4,
              padding: "6px 10px",
              fontFamily: TOKENS.mono,
              fontSize: 12,
              width: 110,
            }}
          />
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="checkbox"
              checked={container.sealed}
              onChange={(e) => onPatchContainer({ sealed: e.target.checked })}
            />
            sealed
          </label>
        </div>
      </div>

      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          justifyContent: "center",
          padding: "20px 0 6px",
        }}
      >
        <div style={{ width: 360 }}>
          <ContainerCard container={container} index={0} compact />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        <AddForm onAddLine={onAddLine} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {container.lines.map((l) => (
            <LineCard key={l.id} line={l} onDelete={onDeleteLine} />
          ))}
        </div>
      </div>
    </div>
  );
}
