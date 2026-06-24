import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ContainerCard from "../components/ContainerCard";
import ContainerInfoOverlay from "../components/ContainerInfoOverlay";
import { TOKENS } from "../data/statusHelpers";

const CARD_WIDTH = 320;
const GAP = 18;

export default function VoyageView({
  voyages,
  activeVoyageId,
  onSelectVoyage,
  selectedContainerId,
  onSelectContainer,
  onOpenLog,
  onExportXlsx,
}) {
  const trackRef = useRef();
  const voyage = voyages.find((v) => v.id === activeVoyageId) || voyages[0];
  const selectedContainer = voyage?.containers.find((c) => c.id === selectedContainerId);

  const scrollBy = (dir) => {
    trackRef.current?.scrollBy({ left: dir * (CARD_WIDTH + GAP), behavior: "smooth" });
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
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

      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          minHeight: 0,
        }}
      >
        <div style={{ width: "100%", maxWidth: 980, position: "relative" }}>
          <button
            onClick={() => scrollBy(-1)}
            aria-label="scroll left"
            style={{
              position: "absolute",
              left: -6,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 4,
              background: TOKENS.surface,
              border: `1px solid ${TOKENS.border}`,
              color: "#e2e8f0",
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={18} />
          </button>

          <div
            ref={trackRef}
            style={{
              display: "flex",
              gap: GAP,
              overflowX: "auto",
              scrollSnapType: "x mandatory",
              padding: "8px 60px",
              scrollbarWidth: "none",
            }}
          >
            {voyage?.containers.map((c, i) => (
              <div
                key={c.id}
                style={{ width: CARD_WIDTH, flexShrink: 0, scrollSnapAlign: "center" }}
              >
                <ContainerCard
                  container={c}
                  index={i}
                  selected={selectedContainerId === c.id}
                  onClick={() =>
                    onSelectContainer(selectedContainerId === c.id ? null : c.id)
                  }
                />
              </div>
            ))}
          </div>

          <button
            onClick={() => scrollBy(1)}
            aria-label="scroll right"
            style={{
              position: "absolute",
              right: -6,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 4,
              background: TOKENS.surface,
              border: `1px solid ${TOKENS.border}`,
              color: "#e2e8f0",
              borderRadius: "50%",
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {selectedContainer && (
        <ContainerInfoOverlay
          container={selectedContainer}
          onClose={() => onSelectContainer(null)}
          onSelectLine={() => onOpenLog(selectedContainer.id)}
        />
      )}
    </div>
  );
}
