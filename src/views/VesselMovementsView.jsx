import { useState } from "react";
import { Trash2 } from "lucide-react";
import { formatIST } from "../data/statusHelpers";
import { theme } from "../theme";
import { VESSEL_EVENT_COLORS } from "../data/manifestHelpers";
import CreateMovementModal from "../components/CreateMovementModal";
import { useToast } from "../components/Toast";

function EventBadge({ type }) {
  const color = VESSEL_EVENT_COLORS[type] || theme.color.slate;
  return (
    <span
      style={{
        fontFamily: theme.font.mono,
        fontSize: 9,
        letterSpacing: "0.1em",
        color,
        border: `1px solid ${color}`,
        padding: "3px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {type.replace("_", " ").toUpperCase()}
    </span>
  );
}

export default function VesselMovementsView({ app, voyage }) {
  const { createMovementEntry, removeMovementEntry } = app;
  const { showToast } = useToast();
  const [adding, setAdding] = useState(false);

  if (!voyage) {
    return (
      <div style={{ padding: "40px 18px", textAlign: "center", fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>
        No active voyage selected.
      </div>
    );
  }

  const movements = voyage.vesselMovements || [];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 18px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 28, color: theme.color.ink }}>
          VESSEL MOVEMENTS — {voyage.voyageNo}
        </div>
        <button
          onClick={() => setAdding(true)}
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
          }}
        >
          + Add Movement
        </button>
      </div>

      {movements.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 24, color: theme.color.slateFaint }}>
            NO MOVEMENTS LOGGED
          </div>
          <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, marginTop: 8 }}>
            Log loading, sailing, and discharge events as the voyage progresses.
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 20, position: "relative", paddingLeft: 18 }}>
          <div style={{ position: "absolute", left: 4, top: 6, bottom: 6, width: 1, background: theme.color.border }} />
          {movements.map((m) => (
            <div key={m.id} style={{ position: "relative", paddingBottom: 22 }}>
              <div
                style={{
                  position: "absolute",
                  left: -18,
                  top: 4,
                  width: 9,
                  height: 9,
                  borderRadius: "50%",
                  background: VESSEL_EVENT_COLORS[m.eventType] || theme.color.slate,
                }}
              />
              <div
                style={{
                  border: `1px solid ${theme.color.border}`,
                  background: theme.color.surface,
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <EventBadge type={m.eventType} />
                    <span style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>
                      {formatIST(m.eventDate)}
                    </span>
                  </div>
                  <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 16, color: theme.color.ink, marginTop: 6 }}>
                    {m.location || "—"}
                  </div>
                  {m.notes && (
                    <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, marginTop: 4 }}>
                      {m.notes}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => {
                    removeMovementEntry(voyage.id, m.id);
                    showToast("Movement removed", "success");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: theme.color.slate,
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <CreateMovementModal
          onClose={() => setAdding(false)}
          onSubmit={async (draft) => {
            const m = await createMovementEntry(voyage.id, draft);
            setAdding(false);
            if (m) showToast("Movement logged", "success");
          }}
        />
      )}
    </div>
  );
}
