import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, FileText, Plus, Search, Ship } from "lucide-react";
import { theme } from "../../theme";
import { C, F } from "../../ui/theme";
import { Card, Pill, StatusBadge } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useRouter } from "../../context/RouterContext";
import { formatDDMMYY } from "../../lib/format";
import {
  createIgmVoyage,
  fetchIgmBlCounts,
  fetchIgmVessels,
  fetchIgmVoyages,
  fromDbIgmVoyage,
  voidIgmVoyage,
} from "../../lib/igm";
import {
  EmptyState,
  TextInput,
  headline,
  iconBtn,
  mono,
  primaryBtn,
} from "../../components/igm/igmChrome";

// Voyage list for the IGM module — the module's entry point. A voyage is the
// container for everything else (vessel identity, IGM number, its BLs), so the
// list is organised around it rather than around a form sequence.
const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "filed", label: "Filed" },
  { value: "closed", label: "Closed" },
];

const STATUS_BADGE = { draft: "DRAFT", filed: "ISSUED", closed: "SEALED" };

export default function IgmVoyagesView({ app }) {
  const { user } = app;
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const [voyages, setVoyages] = useState(null);
  const [vessels, setVessels] = useState([]);
  const [blCounts, setBlCounts] = useState({});
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    // A rejected fetch (offline, unreachable project) must still land the list on
    // a real state — never leave the view spinning on "Loading…".
    try {
      const [{ data: rows, error }, { data: vesselRows }] = await Promise.all([
        fetchIgmVoyages(),
        fetchIgmVessels(),
      ]);
      if (error) throw error;
      setVoyages(rows);
      setVessels(vesselRows || []);
      const { data: counts } = await fetchIgmBlCounts(rows.map((v) => v.id));
      setBlCounts(counts || {});
    } catch (err) {
      console.warn("[igm] voyage fetch failed:", err?.message);
      showToast("Could not load IGM voyages", "error");
      setVoyages([]);
    }
  }, [showToast]);

  useEffect(() => {
    reload();
  }, [reload]);

  const vesselName = useCallback(
    (id) => vessels.find((v) => v.id === id)?.name || "",
    [vessels]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (voyages || []).filter((v) => {
      if (status !== "all" && v.status !== status) return false;
      if (!q) return true;
      return [v.igmNo, v.voyageNo, v.voyageRef, vesselName(v.vesselId), v.arrivalPort]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q));
    });
  }, [voyages, query, status, vesselName]);

  const onNew = async () => {
    if (creating) return;
    setCreating(true);
    const { data, error } = await createIgmVoyage({ createdBy: user?.id });
    setCreating(false);
    if (error || !data) {
      showToast(`Could not create voyage: ${error?.message || "unknown"}`, "error");
      return;
    }
    navigate("igm-voyage", { igmVoyageId: fromDbIgmVoyage(data).id });
  };

  const onVoid = async (voyage) => {
    const reason = window.prompt(
      "Void this IGM voyage? It stays in the audit trail but leaves the working list.\n\nReason (optional):"
    );
    if (reason === null) return;
    const { error } = await voidIgmVoyage(voyage.id, reason);
    if (error) {
      showToast(`Void failed: ${error.message}`, "error");
      return;
    }
    showToast("Voyage voided", "success");
    reload();
  };

  return (
    <div style={{ minHeight: "100%", color: theme.color.ink }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 18px 40px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <div>
            <div style={{ ...headline(28), marginBottom: 4 }}>IGM MANIFEST</div>
            <div style={mono(12, theme.color.slate)}>
              Voyage → BL → cargo &amp; container entry, with ICEGATE JSON export.
            </div>
          </div>
          <button onClick={onNew} disabled={creating} style={primaryBtn}>
            <Plus size={15} /> New voyage
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search
              size={14}
              color={theme.color.slate}
              style={{ position: "absolute", left: 11, top: 11, pointerEvents: "none" }}
            />
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search vessel, voyage no, IGM no, arrival port"
              style={{ paddingLeft: 32 }}
            />
          </div>
          <Pill value={status} onChange={(e) => setStatus(e.target.value)} options={STATUS_FILTERS} />
        </div>

        {voyages === null ? (
          <div style={mono(12, theme.color.slate)}>Loading…</div>
        ) : filtered.length === 0 ? (
          <EmptyState>
            {voyages.length === 0
              ? "No IGM voyages yet. Create one to start entering BLs."
              : "No voyages match this search."}
          </EmptyState>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {filtered.map((v) => (
              <Card
                key={v.id}
                onClick={() => navigate("igm-voyage", { igmVoyageId: v.id })}
                style={{
                  padding: "13px 16px",
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 14,
                  cursor: "pointer",
                }}
              >
                <Ship size={16} color={C.inkDim} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={mono(13)}>
                    {vesselName(v.vesselId) || "— vessel not set —"}
                    {v.voyageNo ? ` · ${v.voyageNo}` : ""}
                  </div>
                  <div style={{ ...mono(11, theme.color.slate), marginTop: 3 }}>
                    IGM {v.igmNo || "—"}
                    {v.igmDate ? ` · ${formatDDMMYY(v.igmDate)}` : ""}
                    {v.arrivalPort ? ` · ${v.arrivalPort}` : ""}
                  </div>
                </div>
                <div style={{ ...mono(11, theme.color.inkSoft), display: "flex", alignItems: "center", gap: 6, width: 90 }}>
                  <FileText size={13} color={C.inkDim} />
                  {blCounts[v.id] || 0} BL{(blCounts[v.id] || 0) === 1 ? "" : "s"}
                </div>
                <div style={{ width: 88 }}>
                  <StatusBadge status={STATUS_BADGE[v.status] || "DRAFT"} size="sm" />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVoid(v);
                  }}
                  title="Void voyage"
                  style={{ ...iconBtn, color: theme.color.red }}
                >
                  <Ban size={14} />
                </button>
              </Card>
            ))}
          </div>
        )}

        <div style={{ ...mono(10.5, C.inkFaint), marginTop: 18, fontFamily: F.mono, lineHeight: 1.7 }}>
          Records are voided, never deleted — a voided voyage stays in the audit trail.
        </div>
      </div>
    </div>
  );
}
