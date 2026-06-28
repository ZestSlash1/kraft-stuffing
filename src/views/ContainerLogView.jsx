import LogView from "./LogView";
import { useToast } from "../components/Toast";
import { TOKENS } from "../data/statusHelpers";

export default function ContainerLogView({ app, containerId }) {
  const { state, navigate, user, presence, trackPresence, patchContainer, addLine, deleteLine, sealContainer, createShipperEntry, createConsigneeEntry } = app;
  const { showToast } = useToast();

  const voyage = state.voyages.find((v) => v.containers.some((c) => c.id === containerId));
  const container = voyage?.containers.find((c) => c.id === containerId);

  const shipperName = (id) => state.shippers.find((s) => s.id === id)?.name || "";
  const consigneeName = (id) => state.consignees.find((c) => c.id === id)?.name || "";
  const bookings = (voyage?.bookings || []).map((b) => ({
    ...b,
    shipperName: shipperName(b.shipperId),
    consigneeName: consigneeName(b.consigneeId),
  }));

  if (!container) {
    return (
      <div style={{ padding: 40, fontFamily: TOKENS.mono, color: TOKENS.steel }}>
        Container not found.{" "}
        <button onClick={() => navigate("voyages")} style={{ color: TOKENS.amber, background: "none", border: "none", cursor: "pointer" }}>
          ← Back
        </button>
      </div>
    );
  }

  const crumb = { fontFamily: TOKENS.mono, fontSize: 11, color: TOKENS.steel, background: "none", border: "none", cursor: "pointer", padding: 0 };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "10px 20px 0" }}>
        <button onClick={() => navigate("voyages")} style={crumb}>Voyages</button>
        <span style={{ color: TOKENS.steel, fontFamily: TOKENS.mono, fontSize: 11 }}> / </span>
        <button onClick={() => navigate("voyage-detail", { voyageId: voyage.id })} style={crumb}>
          {voyage.voyageNo}
        </button>
        <span style={{ color: TOKENS.steel, fontFamily: TOKENS.mono, fontSize: 11 }}> / </span>
        <span style={{ color: "#cbd5e1", fontFamily: TOKENS.mono, fontSize: 11 }}>
          {container.number || "CONTAINER"}
        </span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <LogView
          container={container}
          user={user}
          presenceMap={presence}
          trackPresence={trackPresence}
          shippers={state.shippers}
          consignees={state.consignees}
          bookings={bookings}
          onCreateShipper={createShipperEntry}
          onCreateConsignee={createConsigneeEntry}
          onBack={() => navigate("voyage-detail", { voyageId: voyage.id })}
          onAddLine={(line) => {
            addLine(container.id, line);
            showToast("Line added", "success");
          }}
          onDeleteLine={(lineId) => deleteLine(container.id, lineId)}
          onPatchContainer={(patch) => patchContainer(container.id, patch)}
          onSeal={(payload) => {
            sealContainer(container.id, payload);
            showToast(`Container ${container.number || ""} sealed`, "success");
          }}
        />
      </div>
    </div>
  );
}
