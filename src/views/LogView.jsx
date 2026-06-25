import { useEffect, useState } from "react";
import ContainerCard from "../components/ContainerCard";
import AddForm from "../components/AddForm";
import LineCard from "../components/LineCard";
import SealConfirmDialog from "../components/SealConfirmDialog";
import { TOKENS, containerStatus, containerFillPct } from "../data/statusHelpers";

const inputStyle = {
  background: TOKENS.bg,
  border: `1px solid ${TOKENS.border}`,
  color: "#e2e8f0",
  borderRadius: 4,
  padding: "6px 10px",
  fontFamily: TOKENS.mono,
  fontSize: 12,
};

export default function LogView({
  container,
  user,
  presenceMap,
  trackPresence,
  shippers,
  consignees,
  onCreateShipper,
  onCreateConsignee,
  onBack,
  onAddLine,
  onDeleteLine,
  onPatchContainer,
  onSeal,
}) {
  const [sealing, setSealing] = useState(false);

  // Tell other users (via presence) which container this user is actively logging.
  useEffect(() => {
    if (!container || !trackPresence) return;
    trackPresence({
      userId: user?.id,
      displayName: user?.email || "staff",
      containerId: container.id,
    });
  }, [container?.id, trackPresence, user]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !sealing) onBack();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onBack, sealing]);

  if (!container) return null;

  const status = containerStatus(container);
  const fillPct = Math.round(containerFillPct(container) * 100);
  const totalBags = container.lines.reduce((a, l) => a + Number(l.qty || 0), 0);

  const confirmSeal = ({ sealNo, sealNo2 }) => {
    onSeal({ sealNo, sealNo2 });
    setSealing(false);
  };

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
          flexWrap: "wrap",
          gap: 10,
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
            {status} · {fillPct}% · {totalBags}/{container.capacityBags} {container.capacityUnit || "Bags"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            placeholder="container number"
            value={container.number}
            onChange={(e) => onPatchContainer({ number: e.target.value })}
            style={{ ...inputStyle, width: 150 }}
          />
          <input
            type="number"
            placeholder="tare (kg)"
            value={container.tareWeightKg ?? ""}
            onChange={(e) => onPatchContainer({ tareWeightKg: Number(e.target.value) })}
            style={{ ...inputStyle, width: 90 }}
          />
          <input
            type="number"
            placeholder="CML (kg)"
            value={container.cmlKg ?? ""}
            onChange={(e) => onPatchContainer({ cmlKg: Number(e.target.value) })}
            style={{ ...inputStyle, width: 90 }}
          />
          <select
            value={container.condition || "Clean"}
            onChange={(e) => onPatchContainer({ condition: e.target.value })}
            style={inputStyle}
          >
            {["Clean", "Damaged", "Fumigated"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            placeholder="seal no"
            value={container.sealNo}
            onChange={(e) => onPatchContainer({ sealNo: e.target.value })}
            disabled={container.sealed}
            style={{ ...inputStyle, width: 100 }}
          />
          <input
            placeholder="seal 2"
            value={container.sealNo2 || ""}
            onChange={(e) => onPatchContainer({ sealNo2: e.target.value })}
            disabled={container.sealed}
            style={{ ...inputStyle, width: 100 }}
          />
          {container.sealed ? (
            <span
              style={{
                fontSize: 11,
                color: TOKENS.green,
                border: `1px solid ${TOKENS.green}`,
                borderRadius: 4,
                padding: "5px 10px",
              }}
            >
              SEALED
            </span>
          ) : (
            <button
              onClick={() => setSealing(true)}
              style={{
                background: TOKENS.green,
                color: "#07090e",
                border: "none",
                borderRadius: 4,
                padding: "6px 12px",
                fontFamily: TOKENS.mono,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              mark sealed
            </button>
          )}
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
          <ContainerCard container={container} index={0} compact presenceMap={presenceMap} showVgm />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        <AddForm
          onAddLine={onAddLine}
          shippers={shippers}
          consignees={consignees}
          onCreateShipper={onCreateShipper}
          onCreateConsignee={onCreateConsignee}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
          {container.lines.map((l) => (
            <LineCard key={l.id} line={l} onDelete={onDeleteLine} />
          ))}
        </div>
      </div>

      {sealing && (
        <SealConfirmDialog
          containerNumber={container.number}
          onConfirm={confirmSeal}
          onCancel={() => setSealing(false)}
        />
      )}
    </div>
  );
}
