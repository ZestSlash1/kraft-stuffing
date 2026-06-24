import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import VoyageScene from "../three/VoyageScene";
import ContainerInfoOverlay from "../components/ContainerInfoOverlay";
import { TOKENS } from "../data/statusHelpers";

export default function VoyageView({
  voyages,
  activeVoyageId,
  onSelectVoyage,
  selectedContainerId,
  onSelectContainer,
  onOpenLog,
  justSealedId,
  onAckBurst,
  onExportXlsx,
}) {
  const voyage = voyages.find((v) => v.id === activeVoyageId) || voyages[0];
  const selectedContainer = voyage?.containers.find((c) => c.id === selectedContainerId);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 20px",
          fontFamily: TOKENS.mono,
          color: "#e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select
            value={voyage?.id}
            onChange={(e) => onSelectVoyage(e.target.value)}
            style={{
              background: TOKENS.surface,
              border: `1px solid ${TOKENS.border}`,
              color: "#e2e8f0",
              borderRadius: 4,
              padding: "6px 10px",
              fontFamily: TOKENS.mono,
            }}
          >
            {voyages.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vessel} · {v.voyageNo}
              </option>
            ))}
          </select>
          <span style={{ fontSize: 12, color: "#64748b" }}>{voyage?.date}</span>
        </div>
        <button
          onClick={onExportXlsx}
          style={{
            background: "none",
            border: `1px solid ${TOKENS.border}`,
            color: "#e2e8f0",
            borderRadius: 4,
            padding: "6px 14px",
            fontFamily: TOKENS.mono,
            cursor: "pointer",
          }}
        >
          export xlsx
        </button>
      </div>

      <Canvas
        shadows
        camera={{ position: [0, 5, 14], fov: 45 }}
        style={{ background: TOKENS.bg }}
      >
        <Suspense fallback={null}>
          {voyage && (
            <VoyageScene
              voyage={voyage}
              selectedId={selectedContainerId}
              onSelect={onSelectContainer}
              justSealedId={justSealedId}
              onAckBurst={onAckBurst}
            />
          )}
        </Suspense>
      </Canvas>

      {selectedContainer && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            pointerEvents: "none",
          }}
        >
          <div style={{ pointerEvents: "auto" }}>
            <ContainerInfoOverlay
              container={selectedContainer}
              onClose={() => onSelectContainer(null)}
              onSelectLine={() => onOpenLog(selectedContainer.id)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
