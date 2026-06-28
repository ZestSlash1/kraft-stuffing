import { useState } from "react";
import { ClipboardList, FileText, Ship, Globe2 } from "lucide-react";
import { TOKENS } from "../data/statusHelpers";
import BookingsView from "../views/BookingsView";
import ManifestDocumentView from "../views/ManifestDocumentView";
import VesselMovementsView from "../views/VesselMovementsView";
import PortGlobeView from "../views/PortGlobeView";

const TABS = [
  { id: "bookings", label: "Bookings", Icon: ClipboardList },
  { id: "document", label: "Document", Icon: FileText },
  { id: "movements", label: "Movements", Icon: Ship },
  { id: "globe", label: "Port Network", Icon: Globe2 },
];

export default function ManifestShell({ app }) {
  const { state, setActiveVoyage } = app;
  const [tab, setTab] = useState("bookings");

  const voyages = state.voyages.filter((v) => !v.archived);
  const voyage = state.voyages.find((v) => v.id === state.activeVoyageId);

  return (
    <div>
      <div
        style={{
          borderBottom: `1px solid ${TOKENS.border}`,
          padding: "14px 18px 0",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: active ? `2px solid ${TOKENS.amber}` : "2px solid transparent",
                  color: active ? TOKENS.amber : TOKENS.steel,
                  fontFamily: TOKENS.mono,
                  fontSize: 12,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "10px 12px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            );
          })}
        </div>

        <select
          value={voyage?.id || ""}
          onChange={(e) => setActiveVoyage(e.target.value)}
          style={{
            background: TOKENS.bg,
            border: `1px solid ${TOKENS.border}`,
            color: "#e2e8f0",
            fontFamily: TOKENS.mono,
            fontSize: 12,
            padding: "8px 10px",
            marginBottom: 8,
          }}
        >
          {voyages.map((v) => (
            <option key={v.id} value={v.id}>
              {v.voyageNo} — {v.vessel}
            </option>
          ))}
        </select>
      </div>

      {tab === "bookings" && <BookingsView app={app} voyage={voyage} />}
      {tab === "document" && <ManifestDocumentView app={app} voyage={voyage} />}
      {tab === "movements" && <VesselMovementsView app={app} voyage={voyage} />}
      {tab === "globe" && <PortGlobeView voyage={voyage} />}
    </div>
  );
}
