import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Ban, Plus, Search } from "lucide-react";
import { theme } from "../../theme";
import { C } from "../../ui/theme";
import { Pill, StatusBadge } from "../../components/ui";
import { useToast } from "../../components/Toast";
import { useRouter } from "../../context/RouterContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAutosave } from "../../hooks/useAutosave";
import { formatDDMMYY } from "../../lib/format";
import {
  createIgmBl,
  ensureIgmVessel,
  fetchIgmBlSummaries,
  fetchIgmVessels,
  fetchIgmVoyage,
  updateIgmVessel,
  updateIgmVoyage,
  voidIgmBl,
} from "../../lib/igm";
import {
  COMMON_PORTS,
  IGM_VOYAGE_STATUS,
  PURPOSE_OF_CALL,
  TRANSPORT_MODES,
  VOYAGE_REQUIRED,
  missingFields,
} from "../../data/igmHelpers";
import Typeahead from "../../components/igm/Typeahead";
import IgmExportPanel from "../../components/igm/IgmExportPanel";
import {
  EmptyState,
  Field,
  OfflineNote,
  SaveState,
  Section,
  SelectInput,
  TextInput,
  gridCols,
  headline,
  iconBtn,
  mono,
  primaryBtn,
  secondaryBtn,
} from "../../components/igm/igmChrome";

// Voyage detail: the vessel/voyage record itself, the BLs filed under it, and the
// export panel. Everything autosaves — the status pill in the header is the only
// save affordance (PHASE_IGM_MANIFEST_MODULE.md §4).
const STATUS_BADGE = { draft: "DRAFT", filed: "ISSUED", closed: "SEALED" };

export default function IgmVoyageDetailView({ app, igmVoyageId }) {
  const { state, user } = app;
  const { navigate, setDirty } = useRouter();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  const [voyage, setVoyage] = useState(null);
  const [vesselDraft, setVesselDraft] = useState(null); // editable vessel identity
  const [vessels, setVessels] = useState([]);
  const [bls, setBls] = useState(null);
  const [query, setQuery] = useState("");
  const [podFilter, setPodFilter] = useState("all");
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // ── Load ───────────────────────────────────────────────────────────────────
  const loadBls = useCallback(async () => {
    try {
      const { data, error } = await fetchIgmBlSummaries(igmVoyageId);
      if (error) throw error;
      setBls(data);
    } catch (err) {
      console.warn("[igm] BL fetch failed:", err?.message);
      showToast("Could not load BLs", "error");
      setBls([]);
    }
  }, [igmVoyageId, showToast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let data = null;
      let vesselRows = [];
      try {
        const [voyageRes, vesselRes] = await Promise.all([
          fetchIgmVoyage(igmVoyageId),
          fetchIgmVessels(),
        ]);
        if (voyageRes.error) throw voyageRes.error;
        data = voyageRes.data;
        vesselRows = vesselRes.data || [];
      } catch (err) {
        console.warn("[igm] voyage load failed:", err?.message);
      }
      if (cancelled) return;
      if (!data) {
        showToast("Could not load voyage", "error");
        navigate("igm");
        return;
      }
      setVoyage(data);
      vesselCommit.current = { name: data.vessel?.name || "", inFlight: false };
      vesselIdRef.current = data.vessel?.id || null;
      setVesselDraft(
        data.vessel || { id: null, name: "", code: "", imoNo: "", callSign: "", vesselType: "", grt: "", nrt: "" }
      );
      setVessels(vesselRows);
      await loadBls();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igmVoyageId]);

  // ── Autosave: voyage fields ────────────────────────────────────────────────
  const voyageSave = useAutosave(
    (patch) => updateIgmVoyage(igmVoyageId, patch),
    { onDirtyChange: setDirty }
  );
  // The linked vessel row, tracked in a ref as well as state: field handlers are
  // bound at render time and a debounced flush runs later, so both need the id
  // that is current *now* — a stale closure would patch the wrong row (or none).
  const vesselIdRef = useRef(null);
  useEffect(() => {
    vesselIdRef.current = vesselDraft?.id || null;
  }, [vesselDraft?.id]);

  const vesselSave = useAutosave((patch) =>
    vesselIdRef.current
      ? updateIgmVessel(vesselIdRef.current, patch)
      : Promise.resolve({ error: null })
  );

  const setVoyageField = (key) => (value) => {
    setVoyage((v) => ({ ...v, [key]: value }));
    voyageSave.queue({ [key]: value });
  };

  const setVesselField = (key) => (value) => {
    setVesselDraft((v) => ({ ...v, [key]: value }));
    if (vesselIdRef.current) vesselSave.queue({ [key]: value });
  };

  // Committing a vessel name find-or-creates the master row and links it here, so
  // the operator never has to visit a separate vessel-master screen first.
  // Both Enter and blur can fire for one edit, so the last committed name and an
  // in-flight flag are held in a ref — two overlapping commits would otherwise
  // each miss the other's insert and create a duplicate vessel.
  const vesselCommit = useRef({ name: "", inFlight: false });
  const commitVesselName = async (name) => {
    const trimmed = String(name || "").trim();
    if (!trimmed) return;
    const { name: last, inFlight } = vesselCommit.current;
    if (inFlight || trimmed.toLowerCase() === last.toLowerCase()) return;
    vesselCommit.current = { name: trimmed, inFlight: true };
    try {
      const { data, error } = await ensureIgmVessel(trimmed, { createdBy: user?.id });
      if (error || !data) {
        vesselCommit.current = { name: last, inFlight: false };
        showToast(`Could not link vessel: ${error?.message || "unknown"}`, "error");
        return;
      }
      vesselIdRef.current = data.id;
      setVesselDraft(data);
      setVoyage((v) => ({ ...v, vesselId: data.id, vessel: data }));
      voyageSave.queue({ vesselId: data.id });
      const { data: vesselRows } = await fetchIgmVessels();
      setVessels(vesselRows || []);
    } finally {
      vesselCommit.current = { ...vesselCommit.current, inFlight: false };
    }
  };

  // Linking the operational stuffing voyage prefills what the portal already knows.
  const linkStuffingVoyage = async (stuffingVoyageId) => {
    setVoyage((v) => ({ ...v, stuffingVoyageId }));
    voyageSave.queue({ stuffingVoyageId: stuffingVoyageId || null });
    const src = state.voyages.find((v) => v.id === stuffingVoyageId);
    if (!src) return;
    const patch = {};
    if (!voyage?.voyageNo && src.voyageNo) patch.voyageNo = src.voyageNo;
    if (!voyage?.arrivalPort && src.pod) patch.arrivalPort = src.pod;
    if (!voyage?.lastPort && src.pol) patch.lastPort = src.pol;
    if (Object.keys(patch).length) {
      setVoyage((v) => ({ ...v, ...patch }));
      voyageSave.queue(patch);
    }
    if (src.vessel) await commitVesselName(src.vessel);
  };

  // ── BLs ────────────────────────────────────────────────────────────────────
  const onAddBl = async () => {
    const nextLine = (bls || []).reduce((max, b) => Math.max(max, Number(b.lineNo || 0)), 0) + 1;
    const { data, error } = await createIgmBl({
      voyageId: igmVoyageId,
      lineNo: nextLine,
      portOfLoading: voyage?.lastPort || "",
      dischargePort: voyage?.arrivalPort || "",
      createdBy: user?.id,
    });
    if (error || !data) {
      showToast(`Could not create BL: ${error?.message || "unknown"}`, "error");
      return;
    }
    navigate("igm-bl", { blId: data.id, igmVoyageId });
  };

  const onVoidBl = async (bl) => {
    const reason = window.prompt(
      `Void BL ${bl.blNumber || "(unnumbered)"}? It stays in the audit trail.\n\nReason (optional):`
    );
    if (reason === null) return;
    const { error } = await voidIgmBl(bl.id, reason);
    if (error) {
      showToast(`Void failed: ${error.message}`, "error");
      return;
    }
    loadBls();
  };

  const podOptions = useMemo(() => {
    const set = [...new Set((bls || []).map((b) => b.dischargePort).filter(Boolean))];
    return [{ value: "all", label: "All discharge ports" }, ...set.map((p) => ({ value: p, label: p }))];
  }, [bls]);

  const filteredBls = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (bls || []).filter((b) => {
      if (podFilter !== "all" && b.dischargePort !== podFilter) return false;
      if (!q) return true;
      return [b.blNumber, b.mblNumber, b.consigneeName, b.dischargePort, b.portOfLoading]
        .filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q));
    });
  }, [bls, query, podFilter]);

  if (!voyage || !vesselDraft) {
    return <div style={{ padding: 40, ...mono(12, theme.color.slate) }}>Loading…</div>;
  }

  const status = voyageSave.status !== "saved" ? voyageSave.status : vesselSave.status;
  const missing = missingFields({ ...voyage, vesselName: vesselDraft.name }, VOYAGE_REQUIRED);
  const ports = COMMON_PORTS;

  return (
    <div style={{ minHeight: "100%", color: theme.color.ink }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 48px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <button onClick={() => navigate("igm")} style={backBtn} title="Back to voyages">
            <ArrowLeft size={16} />
          </button>
          <div style={headline(24)}>{vesselDraft.name || "NEW IGM VOYAGE"}</div>
          <StatusBadge status={STATUS_BADGE[voyage.status] || "DRAFT"} size="sm" />
          <div style={{ flex: 1 }} />
          <OfflineNote online={online} />
          <SaveState status={status} />
        </div>
        <div style={{ ...mono(11.5, theme.color.slate), marginBottom: 16, paddingLeft: 46 }}>
          {voyage.voyageNo ? `Voyage ${voyage.voyageNo}` : "Voyage number not set"}
          {voyage.igmNo ? ` · IGM ${voyage.igmNo}` : ""}
          {missing.length ? ` · missing ${missing.join(", ")}` : ""}
        </div>

        {/* ── Vessel identity ─────────────────────────────────────────────── */}
        <Section
          id="vessel"
          title="Vessel"
          subtitle="Typing a new name creates the vessel in the master and links it to this voyage."
        >
          <div style={gridCols(isMobile, 4)}>
            <Field label="Vessel name" required check={vesselDraft.name ? undefined : { ok: false, reason: "Required for export" }}>
              <Typeahead
                value={vesselDraft.name}
                options={vessels.map((v) => ({ value: v.name, label: v.name, hint: v.imoNo || v.code || "" }))}
                onChange={(v) => setVesselDraft((d) => ({ ...d, name: v }))}
                onCommit={commitVesselName}
                placeholder="MV APJ KARAN"
              />
            </Field>
            <Field label="Vessel code">
              <TextInput
                key={`code-${vesselDraft.id}`}
                defaultValue={vesselDraft.code}
                disabled={!vesselDraft.id}
                onBlur={(e) => setVesselField("code")(e.target.value)}
              />
            </Field>
            <Field label="IMO number">
              <TextInput
                key={`imo-${vesselDraft.id}`}
                defaultValue={vesselDraft.imoNo}
                disabled={!vesselDraft.id}
                onBlur={(e) => setVesselField("imoNo")(e.target.value)}
              />
            </Field>
            <Field label="Call sign">
              <TextInput
                key={`cs-${vesselDraft.id}`}
                defaultValue={vesselDraft.callSign}
                disabled={!vesselDraft.id}
                onBlur={(e) => setVesselField("callSign")(e.target.value)}
              />
            </Field>
            <Field label="Vessel type">
              <TextInput
                key={`vt-${vesselDraft.id}`}
                defaultValue={vesselDraft.vesselType}
                disabled={!vesselDraft.id}
                onBlur={(e) => setVesselField("vesselType")(e.target.value)}
              />
            </Field>
            <Field label="GRT">
              <TextInput
                key={`grt-${vesselDraft.id}`}
                type="number"
                defaultValue={vesselDraft.grt ?? ""}
                disabled={!vesselDraft.id}
                onBlur={(e) => setVesselField("grt")(e.target.value)}
              />
            </Field>
            <Field label="NRT">
              <TextInput
                key={`nrt-${vesselDraft.id}`}
                type="number"
                defaultValue={vesselDraft.nrt ?? ""}
                disabled={!vesselDraft.id}
                onBlur={(e) => setVesselField("nrt")(e.target.value)}
              />
            </Field>
            <Field label="Linked stuffing voyage" hint="Prefills voyage no and ports">
              <SelectInput
                value={voyage.stuffingVoyageId || ""}
                allowBlank
                options={(state.voyages || [])
                  .filter((v) => !v.archived)
                  .map((v) => ({ value: v.id, label: `${v.voyageNo || "—"} · ${v.vessel || ""}` }))}
                onChange={(e) => linkStuffingVoyage(e.target.value || null)}
              />
            </Field>
          </div>
        </Section>

        {/* ── Voyage & IGM ────────────────────────────────────────────────── */}
        <Section id="voyage" title="Voyage & IGM">
          <div style={gridCols(isMobile, 4)}>
            <Field label="Voyage no" required>
              <TextInput
                key={`vno-${voyage.id}`}
                defaultValue={voyage.voyageNo}
                onBlur={(e) => setVoyageField("voyageNo")(e.target.value)}
              />
            </Field>
            <Field label="Voyage reference">
              <TextInput
                key={`vref-${voyage.id}`}
                defaultValue={voyage.voyageRef}
                onBlur={(e) => setVoyageField("voyageRef")(e.target.value)}
              />
            </Field>
            <Field label="IGM number">
              <TextInput
                key={`igm-${voyage.id}`}
                defaultValue={voyage.igmNo}
                onBlur={(e) => setVoyageField("igmNo")(e.target.value)}
              />
            </Field>
            <Field label="IGM date">
              <TextInput
                type="date"
                key={`igmd-${voyage.id}`}
                defaultValue={voyage.igmDate}
                onBlur={(e) => setVoyageField("igmDate")(e.target.value)}
              />
            </Field>
            <Field label="Terminal operator">
              <TextInput
                key={`term-${voyage.id}`}
                defaultValue={voyage.terminalOperator}
                onBlur={(e) => setVoyageField("terminalOperator")(e.target.value)}
              />
            </Field>
            <Field label="Purpose of call">
              <SelectInput
                value={voyage.purposeOfCall || ""}
                allowBlank
                options={PURPOSE_OF_CALL}
                onChange={(e) => setVoyageField("purposeOfCall")(e.target.value)}
              />
            </Field>
            <Field label="Transport mode">
              <SelectInput
                value={voyage.transportMode || "SEA"}
                options={TRANSPORT_MODES}
                onChange={(e) => setVoyageField("transportMode")(e.target.value)}
              />
            </Field>
            <Field label="Status">
              <SelectInput
                value={voyage.status}
                options={IGM_VOYAGE_STATUS.map((s) => ({ value: s, label: s.toUpperCase() }))}
                onChange={(e) => setVoyageField("status")(e.target.value)}
              />
            </Field>
            <Field label="Cargo summary" span={isMobile ? undefined : "1 / -1"}>
              <TextInput
                key={`cs-${voyage.id}`}
                defaultValue={voyage.cargoSummary}
                placeholder="Summary description of cargo carried on this voyage"
                onBlur={(e) => setVoyageField("cargoSummary")(e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* ── Ports & schedule ────────────────────────────────────────────── */}
        <Section id="schedule" title="Ports & schedule">
          <div style={gridCols(isMobile, 4)}>
            <Field label="Arrival port">
              <Typeahead
                value={voyage.arrivalPort}
                options={ports}
                onChange={(v) => setVoyage((x) => ({ ...x, arrivalPort: v }))}
                onCommit={(v) => voyageSave.queue({ arrivalPort: v })}
              />
            </Field>
            <Field label="Last port of call">
              <Typeahead
                value={voyage.lastPort}
                options={ports}
                onChange={(v) => setVoyage((x) => ({ ...x, lastPort: v }))}
                onCommit={(v) => voyageSave.queue({ lastPort: v })}
              />
            </Field>
            <Field label="Next port of call">
              <Typeahead
                value={voyage.nextPort}
                options={ports}
                onChange={(v) => setVoyage((x) => ({ ...x, nextPort: v }))}
                onCommit={(v) => voyageSave.queue({ nextPort: v })}
              />
            </Field>
            <Field label="Sailing date">
              <TextInput
                type="date"
                key={`sail-${voyage.id}`}
                defaultValue={voyage.sailingDate}
                onBlur={(e) => setVoyageField("sailingDate")(e.target.value)}
              />
            </Field>
            <Field label="ETA" hint="IST">
              <TextInput
                type="datetime-local"
                key={`eta-${voyage.id}`}
                defaultValue={toLocalInput(voyage.eta)}
                onBlur={(e) => setVoyageField("eta")(fromLocalInput(e.target.value))}
              />
            </Field>
            <Field label="ATA" hint="IST">
              <TextInput
                type="datetime-local"
                key={`ata-${voyage.id}`}
                defaultValue={toLocalInput(voyage.ata)}
                onBlur={(e) => setVoyageField("ata")(fromLocalInput(e.target.value))}
              />
            </Field>
            <Field label="ETD" hint="IST">
              <TextInput
                type="datetime-local"
                key={`etd-${voyage.id}`}
                defaultValue={toLocalInput(voyage.etd)}
                onBlur={(e) => setVoyageField("etd")(fromLocalInput(e.target.value))}
              />
            </Field>
          </div>
        </Section>

        {/* ── Counts ──────────────────────────────────────────────────────── */}
        <Section id="counts" title="Crew, passengers & container counts">
          <div style={gridCols(isMobile, 4)}>
            <Field label="Crew count">
              <TextInput
                type="number"
                key={`crew-${voyage.id}`}
                defaultValue={voyage.crewCount ?? ""}
                onBlur={(e) => setVoyageField("crewCount")(e.target.value)}
              />
            </Field>
            <Field label="Passenger count">
              <TextInput
                type="number"
                key={`pax-${voyage.id}`}
                defaultValue={voyage.paxCount ?? ""}
                onBlur={(e) => setVoyageField("paxCount")(e.target.value)}
              />
            </Field>
            <Field label="Containers landed">
              <TextInput
                type="number"
                key={`land-${voyage.id}`}
                defaultValue={voyage.cntrsLanded ?? ""}
                onBlur={(e) => setVoyageField("cntrsLanded")(e.target.value)}
              />
            </Field>
            <Field label="Containers loaded">
              <TextInput
                type="number"
                key={`load-${voyage.id}`}
                defaultValue={voyage.cntrsLoaded ?? ""}
                onBlur={(e) => setVoyageField("cntrsLoaded")(e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* ── BLs ─────────────────────────────────────────────────────────── */}
        <Section
          id="bls"
          title={`Bills of lading${bls ? ` (${bls.length})` : ""}`}
          right={
            <button onClick={onAddBl} style={primaryBtn}>
              <Plus size={14} /> Add BL
            </button>
          }
        >
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search
                size={14}
                color={theme.color.slate}
                style={{ position: "absolute", left: 11, top: 11, pointerEvents: "none" }}
              />
              <TextInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search BL no, consignee, port"
                style={{ paddingLeft: 32 }}
              />
            </div>
            <Pill value={podFilter} onChange={(e) => setPodFilter(e.target.value)} options={podOptions} />
          </div>

          {bls === null ? (
            <div style={mono(12, theme.color.slate)}>Loading…</div>
          ) : filteredBls.length === 0 ? (
            <EmptyState>
              {(bls || []).length === 0
                ? "No BLs under this voyage yet."
                : "No BLs match this search."}
            </EmptyState>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredBls.map((bl) => (
                <div
                  key={bl.id}
                  onClick={() => navigate("igm-bl", { blId: bl.id, igmVoyageId })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    border: `1px solid ${C.hair}`,
                    borderRadius: theme.radius.sm,
                    padding: "10px 12px",
                    cursor: "pointer",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <span style={{ ...mono(11, theme.color.slate), width: 26 }}>
                    {bl.lineNo ?? "—"}
                  </span>
                  <div style={{ flex: 1, minWidth: 150 }}>
                    <div style={mono(12.5)}>{bl.blNumber || "— unnumbered —"}</div>
                    <div style={{ ...mono(10.5, theme.color.slate), marginTop: 3 }}>
                      {bl.consigneeName || "no consignee"}
                      {bl.blDate ? ` · ${formatDDMMYY(bl.blDate)}` : ""}
                    </div>
                  </div>
                  <span style={{ ...mono(11, theme.color.inkSoft), minWidth: 120 }}>
                    {(bl.portOfLoading || "—") + " → " + (bl.dischargePort || "—")}
                  </span>
                  <span style={{ ...mono(10.5, theme.color.slate), minWidth: 96 }}>
                    {bl.containerCount} cntr · {bl.cargoLineCount} line
                    {bl.cargoLineCount === 1 ? "" : "s"}
                  </span>
                  {bl.hazCargo && (
                    <span style={{ ...mono(9.5, C.warning), letterSpacing: "0.1em" }}>HAZ</span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoidBl(bl);
                    }}
                    title="Void BL"
                    style={{ ...iconBtn, color: theme.color.red }}
                  >
                    <Ban size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        <IgmExportPanel voyageId={igmVoyageId} showToast={showToast} />

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => navigate("igm")} style={secondaryBtn}>
            <ArrowLeft size={13} /> All voyages
          </button>
        </div>
      </div>
    </div>
  );
}

// `datetime-local` speaks wall-clock time. The portal runs on IST, so render and
// parse in IST explicitly instead of trusting the browser's zone.
const IST_OFFSET_MIN = 330;

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60000);
  return ist.toISOString().slice(0, 16);
}

function fromLocalInput(value) {
  if (!value) return null;
  const asUtc = new Date(`${value}:00Z`);
  if (Number.isNaN(asUtc.getTime())) return null;
  return new Date(asUtc.getTime() - IST_OFFSET_MIN * 60000).toISOString();
}

const backBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 34,
  height: 34,
  background: "rgba(255,255,255,0.06)",
  border: `1px solid ${C.hair}`,
  borderRadius: 999,
  color: C.inkDim,
  cursor: "pointer",
  flexShrink: 0,
};
