import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { voyageStats, VOYAGE_STATUS_COLORS } from "../data/statusHelpers";
import { theme } from "../theme";
import CreateVoyageModal from "../components/CreateVoyageModal";
import { useToast } from "../components/Toast";

const TABS = ["All", "Loading", "Completed", "Archived"];

function StatusBadge({ status }) {
  const color = VOYAGE_STATUS_COLORS[status] || theme.color.slate;
  return (
    <span
      style={{
        fontFamily: theme.font.mono,
        fontSize: 9,
        letterSpacing: "0.1em",
        color,
        border: `1px solid ${color}`,
        padding: "3px 7px",
        borderRadius: theme.radius.pill,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function VoyageRow({ voyage, onOpen }) {
  const s = voyageStats(voyage);
  return (
    <div
      onClick={onOpen}
      className="voyage-row"
      style={{
        display: "grid",
        gridTemplateColumns: "1.2fr 1.4fr 0.8fr 1.4fr 0.9fr 0.7fr 0.6fr 28px",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        borderBottom: `1px solid ${theme.color.border}`,
        cursor: "pointer",
      }}
    >
      <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 16, color: theme.color.ink }}>
        {voyage.voyageNo || "—"}
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>{voyage.vessel}</div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>{voyage.date}</div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>
        {voyage.pol} → {voyage.pod}
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.inkSoft }}>
        {s.sealed} sealed / {s.total}
      </div>
      <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 16, color: theme.color.amber }}>
        {s.mt.toFixed(1)}
      </div>
      <StatusBadge status={voyage.status} />
      <ChevronRight size={16} color={theme.color.slateFaint} />
    </div>
  );
}

function VoyageCard({ voyage, onOpen }) {
  const s = voyageStats(voyage);
  return (
    <div
      onClick={onOpen}
      style={{
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.card,
        boxShadow: theme.shadow.card,
        padding: 16,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 18, color: theme.color.ink }}>
          {voyage.voyageNo || "—"}
        </div>
        <StatusBadge status={voyage.status} />
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, marginTop: 4 }}>
        {voyage.vessel}
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, marginTop: 6 }}>
        {voyage.pol} → {voyage.pod} · {voyage.date}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
        <span style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.inkSoft }}>
          {s.sealed} sealed / {s.total}
        </span>
        <span style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 16, color: theme.color.amber }}>
          {s.mt.toFixed(1)} MT
        </span>
      </div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ padding: "14px 18px", borderBottom: `1px solid ${theme.color.border}` }}>
          <div className="skeleton" style={{ height: 18, width: `${40 + (i % 3) * 15}%` }} />
        </div>
      ))}
    </div>
  );
}

const primaryBtn = {
  background: theme.color.amber,
  border: "none",
  color: theme.color.white,
  fontFamily: theme.font.condensed,
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  padding: "9px 16px",
  borderRadius: theme.radius.input,
  cursor: "pointer",
};

export default function VoyagesView({ app }) {
  const { state, navigate, createVoyageEntry, orgSettings } = app;
  const { showToast } = useToast();
  const [tab, setTab] = useState("All");
  const [creating, setCreating] = useState(false);

  const voyages = state.voyages.filter((v) => {
    if (tab === "Archived") return v.archived;
    if (v.archived) return false;
    if (tab === "Loading") return v.status === "LOADING";
    if (tab === "Completed") return v.status === "COMPLETED";
    return true;
  });

  const open = (id) => navigate("voyage-detail", { voyageId: id });

  const handleCreate = (draft) => {
    const v = createVoyageEntry(draft);
    setCreating(false);
    showToast(`Voyage ${v.voyageNo} created`, "success");
    navigate("voyage-detail", { voyageId: v.id });
  };

  return (
    <div style={{ minHeight: "100%", background: theme.color.canvas, color: theme.color.ink }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 18px 40px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 28, color: theme.color.ink }}>
            VOYAGES
          </div>
          <button onClick={() => setCreating(true)} style={primaryBtn}>
            + New Voyage
          </button>
        </div>

        <div style={{ display: "flex", gap: 18, marginTop: 16, borderBottom: `1px solid ${theme.color.border}` }}>
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "none",
                border: "none",
                borderBottom: tab === t ? `2px solid ${theme.color.amber}` : "2px solid transparent",
                color: tab === t ? theme.color.amber : theme.color.slate,
                fontFamily: theme.font.mono,
                fontSize: 12,
                padding: "8px 2px",
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          {state.loading ? (
            <SkeletonRows />
          ) : voyages.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 30, color: theme.color.slateFaint }}>
                NO VOYAGES YET
              </div>
              <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, marginTop: 8 }}>
                Create your first voyage to get started
              </div>
              <button onClick={() => setCreating(true)} style={{ ...primaryBtn, marginTop: 18, padding: "9px 18px" }}>
                + New Voyage
              </button>
            </div>
          ) : (
            <>
              <div className="voyages-table">
                {voyages.map((v) => (
                  <VoyageRow key={v.id} voyage={v} onOpen={() => open(v.id)} />
                ))}
              </div>
              <div className="voyages-cards" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {voyages.map((v) => (
                  <VoyageCard key={v.id} voyage={v} onOpen={() => open(v.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {creating && (
        <CreateVoyageModal
          defaults={orgSettings || {}}
          onClose={() => setCreating(false)}
          onSubmit={handleCreate}
        />
      )}
    </div>
  );
}
