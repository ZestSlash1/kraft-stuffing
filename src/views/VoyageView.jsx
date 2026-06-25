import ManifestTable, { ManifestSkeleton } from "../components/ManifestTable";
import ContainerInfoOverlay from "../components/ContainerInfoOverlay";
import ExportMenu from "../components/ExportMenu";
import { TOKENS } from "../data/statusHelpers";

export default function VoyageView({
  voyages,
  activeVoyageId,
  onSelectVoyage,
  selectedContainerId,
  onSelectContainer,
  onOpenLog,
  onExportXlsx,
  onExportPdf,
  profilesById,
  loading = false,
}) {
  const voyage = voyages.find((v) => v.id === activeVoyageId) || voyages[0];
  const selectedContainer = voyage?.containers.find((c) => c.id === selectedContainerId);

  const containers = voyage?.containers || [];
  const stats = containers.reduce(
    (acc, c) => {
      acc.bags += c.lines.reduce((a, l) => a + Number(l.qty || 0), 0);
      acc.mt += c.lines.reduce((a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0), 0) / 1000;
      acc.sealed += c.sealed ? 1 : 0;
      return acc;
    },
    { bags: 0, mt: 0, sealed: 0 }
  );

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
          padding: "18px 20px 14px",
          borderBottom: `1px solid ${TOKENS.border}`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div
              className="condensed"
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "0.03em",
                lineHeight: 1,
                color: "#e2e8f0",
                textShadow: `0 0 18px ${TOKENS.amber}33`,
              }}
            >
              STUFFING LOG
            </div>
            <div className="label-xs" style={{ marginTop: 4 }}>
              KRAFT SHIPPING &amp; LOGISTICS
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select
              value={voyage?.id}
              onChange={(e) => onSelectVoyage(e.target.value)}
              className="mono"
              style={{
                background: TOKENS.surface,
                border: `1px solid ${TOKENS.border}`,
                color: "#e2e8f0",
                borderRadius: 0,
                padding: "6px 10px",
              }}
            >
              {voyages.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.vessel} · {v.voyageNo}
                </option>
              ))}
            </select>
            <ExportMenu onExportXlsx={onExportXlsx} onExportPdf={onExportPdf} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 0, marginTop: 16, flexWrap: "wrap" }}>
          {[
            ["CONTAINERS", containers.length],
            ["BAGS", stats.bags],
            ["NET MT", stats.mt.toFixed(2)],
            ["SEALED", `${stats.sealed}/${containers.length}`],
          ].map(([label, value], i) => (
            <div
              key={label}
              style={{
                padding: "0 22px",
                borderLeft: i === 0 ? "none" : `1px solid ${TOKENS.border}`,
              }}
            >
              <div className="label-xs">{label}</div>
              <div className="condensed" style={{ fontSize: 24, fontWeight: 700, color: "#e2e8f0" }}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {loading ? (
          <ManifestSkeleton />
        ) : (
          <ManifestTable
            containers={containers}
            voyageNo={voyage?.voyageNo}
            selectedContainerId={selectedContainerId}
            onSelectContainer={onSelectContainer}
            onOpenLog={onOpenLog}
          />
        )}
      </div>

      {selectedContainer && (
        <ContainerInfoOverlay
          container={selectedContainer}
          onClose={() => onSelectContainer(null)}
          onSelectLine={() => onOpenLog(selectedContainer.id)}
          profilesById={profilesById}
        />
      )}
    </div>
  );
}
