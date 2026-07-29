import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { theme } from "../../theme";
import { C, glass } from "../../ui/theme";
import { useToast } from "../../components/Toast";
import { useRouter } from "../../context/RouterContext";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useAutosave } from "../../hooks/useAutosave";
import {
  createIgmCargoLine,
  createIgmContainer,
  fetchIgmBl,
  updateIgmBl,
  updateIgmCargoLine,
  updateIgmContainer,
  updateIgmMarks,
  updateIgmParty,
  voidIgmCargoLine,
  voidIgmContainer,
} from "../../lib/igm";
import {
  BL_REQUIRED,
  CARGO_TYPES,
  COMMON_PORTS,
  IMDG_CLASSES,
  NATURE_OF_CARGO,
  PACKAGE_UNITS,
  WEIGHT_UNITS,
  blConsistency,
  blSectionState,
  blTotals,
  missingFields,
} from "../../data/igmHelpers";
import Typeahead from "../../components/igm/Typeahead";
import PartyCards from "../../components/igm/PartyCards";
import CargoLinesGrid from "../../components/igm/CargoLinesGrid";
import ContainerLinesGrid from "../../components/igm/ContainerLinesGrid";
import {
  CheckField,
  Field,
  OfflineNote,
  SaveState,
  Section,
  SectionDot,
  SelectInput,
  TextArea,
  TextInput,
  gridCols,
  headline,
  mono,
  secondaryBtn,
} from "../../components/igm/igmChrome";

// ─────────────────────────────────────────────────────────────────────────────
// BL entry — ONE scrollable view with a sticky section rail (Overview → Parties
// → Marks → Cargo → Containers). Deliberately not a tab-per-screen form: the
// operator works down a single BL, and the rail shows at a glance which sections
// still have nothing in them.
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "bl-overview", key: "overview", label: "Overview" },
  { id: "bl-parties", key: "parties", label: "Parties" },
  { id: "bl-marks", key: "marks", label: "Marks" },
  { id: "bl-cargo", key: "cargo", label: "Cargo" },
  { id: "bl-containers", key: "containers", label: "Containers" },
];

export default function IgmBlEntryView({ blId, igmVoyageId }) {
  const { navigate, setDirty } = useRouter();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  const [bl, setBl] = useState(null);
  const [active, setActive] = useState("bl-overview");
  const [rowStatus, setRowStatus] = useState("saved"); // writes outside the header form
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const scrollRef = useRef(null);

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

  useEffect(() => {
    let cancelled = false;
    fetchIgmBl(blId)
      .catch((err) => {
        console.warn("[igm] BL load failed:", err?.message);
        return { data: null, error: err };
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          showToast("Could not load BL", "error");
          navigate("igm-voyage", { igmVoyageId });
          return;
        }
        setBl(data);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blId]);

  // ── Saving ─────────────────────────────────────────────────────────────────
  const headerSave = useAutosave((patch) => updateIgmBl(blId, patch), {
    onDirtyChange: setDirty,
  });
  const marksSave = useAutosave(
    (patch) => (bl?.marks ? updateIgmMarks(bl.marks.id, patch) : Promise.resolve({ error: null })),
    { delay: 900 }
  );

  // Discrete writes (party fields, grid cells, row add/remove) happen on blur or
  // on a select change, so they go straight out — but the status still has to be
  // honest about failures.
  const track = useCallback(
    async (thunk) => {
      setRowStatus("saving");
      const res = (await thunk()) || {};
      if (res.error) {
        setRowStatus("error");
        showToast(`Save failed: ${res.error.message}`, "error");
        return res;
      }
      setRowStatus("saved");
      return res;
    },
    [showToast]
  );

  const setHeader = (key) => (value) => {
    setBl((b) => ({ ...b, [key]: value }));
    headerSave.queue({ [key]: value });
  };

  const setMarks = (key) => (value) => {
    setBl((b) => ({ ...b, marks: { ...b.marks, [key]: value } }));
    marksSave.queue({ [key]: value });
  };

  // ── Parties ────────────────────────────────────────────────────────────────
  const patchParty = (partyId, patch) => {
    setBl((b) => ({
      ...b,
      parties: b.parties.map((p) => (p.id === partyId ? { ...p, ...patch } : p)),
    }));
    track(() => updateIgmParty(partyId, patch));
  };

  // ── Cargo lines ────────────────────────────────────────────────────────────
  const addCargoLine = async () => {
    const seq = (bl.cargoLines || []).length;
    const { data, error } = await createIgmCargoLine({ blId, seq });
    if (error || !data) {
      showToast(`Could not add cargo line: ${error?.message || "unknown"}`, "error");
      return;
    }
    // The write returns the DB row shape; keep the view in app shape.
    setBl((b) => ({
      ...b,
      cargoLines: [
        ...b.cargoLines,
        { id: data.id, blId, seq, hsnCode: "", unoCode: "", imdgClass: "", pkgs: null, pkgsUnit: "PKG", description: "" },
      ],
    }));
  };

  const patchCargoLine = (id, patch) => {
    setBl((b) => ({
      ...b,
      cargoLines: b.cargoLines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
    track(() => updateIgmCargoLine(id, patch));
  };

  const removeCargoLine = async (row) => {
    if (!window.confirm("Remove this cargo line? It is voided, not deleted.")) return;
    setBl((b) => ({ ...b, cargoLines: b.cargoLines.filter((l) => l.id !== row.id) }));
    track(() => voidIgmCargoLine(row.id, "removed in BL entry"));
  };

  // ── Container lines ────────────────────────────────────────────────────────
  const addContainer = async () => {
    const seq = (bl.containers || []).length;
    const { data, error } = await createIgmContainer({ blId, seq });
    if (error || !data) {
      showToast(`Could not add container: ${error?.message || "unknown"}`, "error");
      return;
    }
    setBl((b) => ({
      ...b,
      containers: [
        ...b.containers,
        {
          id: data.id,
          blId,
          seq,
          containerNo: "",
          size: "20",
          type: "",
          sealType: "",
          sealNo: "",
          vgm: null,
          pkgs: null,
          grossWt: null,
          tareWt: null,
          fclLcl: "FCL",
          soc: false,
          arrMode: "",
          dispMode: "",
          temperature: null,
          cellLocation: "",
          dngMark: "",
        },
      ],
    }));
  };

  const patchContainer = (id, patch) => {
    setBl((b) => ({
      ...b,
      containers: b.containers.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    track(() => updateIgmContainer(id, patch));
  };

  const removeContainer = async (row) => {
    if (!window.confirm("Remove this container? It is voided, not deleted.")) return;
    setBl((b) => ({ ...b, containers: b.containers.filter((c) => c.id !== row.id) }));
    track(() => voidIgmContainer(row.id, "removed in BL entry"));
  };

  // ── Section rail state ─────────────────────────────────────────────────────
  const sectionState = useMemo(() => (bl ? blSectionState(bl) : {}), [bl]);
  const totals = useMemo(() => (bl ? blTotals(bl) : null), [bl]);
  const warnings = useMemo(() => (bl ? blConsistency(bl) : []), [bl]);

  // Highlight the rail entry for whatever section is currently in view.
  useEffect(() => {
    if (!bl) return;
    const root = scrollRef.current?.closest(".app-main") || null;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { root, rootMargin: "-88px 0px -60% 0px", threshold: 0 }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [bl]);

  const goSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setActive(id);
  };

  if (!bl) {
    return <div style={{ padding: 40, ...mono(12, theme.color.slate) }}>Loading…</div>;
  }

  const status =
    headerSave.status !== "saved"
      ? headerSave.status
      : marksSave.status !== "saved"
      ? marksSave.status
      : rowStatus;
  const missing = missingFields(bl, BL_REQUIRED);

  return (
    <div ref={scrollRef} style={{ minHeight: "100%", color: theme.color.ink }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 64px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
          <button
            onClick={() => navigate("igm-voyage", { igmVoyageId })}
            style={backBtn}
            title="Back to voyage"
          >
            <ArrowLeft size={16} />
          </button>
          <div style={headline(22)}>{bl.blNumber || "NEW BILL OF LADING"}</div>
          {bl.hazCargo && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                ...mono(10, C.warning),
                border: `1px solid rgba(232,147,10,0.4)`,
                borderRadius: 999,
                padding: "3px 9px",
                letterSpacing: "0.1em",
              }}
            >
              <AlertTriangle size={11} /> HAZARDOUS
            </span>
          )}
          <div style={{ flex: 1 }} />
          <OfflineNote online={online} />
          <SaveState status={status} />
        </div>
        <div style={{ ...mono(11.5, theme.color.slate), marginBottom: 14, paddingLeft: 46 }}>
          Line {bl.lineNo ?? "—"} · {totals.containers} container{totals.containers === 1 ? "" : "s"} ·{" "}
          {totals.cargoLines} cargo line{totals.cargoLines === 1 ? "" : "s"}
          {missing.length ? ` · missing ${missing.join(", ")}` : ""}
        </div>

        {/* Sticky section rail */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            padding: "8px 10px",
            marginBottom: 14,
            ...glass(theme.radius.pill),
          }}
        >
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => goSection(s.id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                background: active === s.id ? "rgba(255,255,255,0.10)" : "transparent",
                border: "none",
                borderRadius: 999,
                padding: "6px 12px",
                cursor: "pointer",
                ...mono(11.5, active === s.id ? theme.color.ink : theme.color.slate),
              }}
            >
              <SectionDot state={sectionState[s.key]} />
              {s.label}
            </button>
          ))}
        </div>

        {/* ── Overview ────────────────────────────────────────────────────── */}
        <Section id="bl-overview" title="Overview" state={sectionState.overview}>
          <div style={gridCols(isMobile, 4)}>
            <Field label="BL number" required>
              <TextInput
                key={`bln-${bl.id}`}
                defaultValue={bl.blNumber}
                onBlur={(e) => setHeader("blNumber")(e.target.value)}
              />
            </Field>
            <Field label="BL date">
              <TextInput
                type="date"
                key={`bld-${bl.id}`}
                defaultValue={bl.blDate}
                onBlur={(e) => setHeader("blDate")(e.target.value)}
              />
            </Field>
            <Field label="Master BL number">
              <TextInput
                key={`mbl-${bl.id}`}
                defaultValue={bl.mblNumber}
                onBlur={(e) => setHeader("mblNumber")(e.target.value)}
              />
            </Field>
            <Field label="Master BL date">
              <TextInput
                type="date"
                key={`mbld-${bl.id}`}
                defaultValue={bl.mblDate}
                onBlur={(e) => setHeader("mblDate")(e.target.value)}
              />
            </Field>

            <Field label="Line no">
              <TextInput
                type="number"
                key={`line-${bl.id}`}
                defaultValue={bl.lineNo ?? ""}
                onBlur={(e) => setHeader("lineNo")(e.target.value)}
              />
            </Field>
            <Field label="Freight payable at">
              <Typeahead
                value={bl.freightPayableAt}
                options={COMMON_PORTS}
                onChange={(v) => setBl((b) => ({ ...b, freightPayableAt: v }))}
                onCommit={(v) => headerSave.queue({ freightPayableAt: v })}
              />
            </Field>
            <Field label="Cargo type">
              <SelectInput
                value={bl.cargoType || ""}
                allowBlank
                options={CARGO_TYPES}
                onChange={(e) => setHeader("cargoType")(e.target.value)}
              />
            </Field>
            <Field label="Nature of cargo">
              <SelectInput
                value={bl.natureOfCargo || ""}
                allowBlank
                options={NATURE_OF_CARGO}
                onChange={(e) => setHeader("natureOfCargo")(e.target.value)}
              />
            </Field>

            <Field label="Port of receipt">
              <Typeahead
                value={bl.portOfReceipt}
                options={COMMON_PORTS}
                onChange={(v) => setBl((b) => ({ ...b, portOfReceipt: v }))}
                onCommit={(v) => headerSave.queue({ portOfReceipt: v })}
              />
            </Field>
            <Field label="Port of loading" required>
              <Typeahead
                value={bl.portOfLoading}
                options={COMMON_PORTS}
                onChange={(v) => setBl((b) => ({ ...b, portOfLoading: v }))}
                onCommit={(v) => headerSave.queue({ portOfLoading: v })}
              />
            </Field>
            <Field label="Discharge port" required>
              <Typeahead
                value={bl.dischargePort}
                options={COMMON_PORTS}
                onChange={(v) => setBl((b) => ({ ...b, dischargePort: v }))}
                onCommit={(v) => headerSave.queue({ dischargePort: v })}
              />
            </Field>
            <Field label="Place of delivery">
              <Typeahead
                value={bl.deliveryPlace}
                options={COMMON_PORTS}
                onChange={(v) => setBl((b) => ({ ...b, deliveryPlace: v }))}
                onCommit={(v) => headerSave.queue({ deliveryPlace: v })}
              />
            </Field>

            <Field label="Mother vessel">
              <TextInput
                key={`mv-${bl.id}`}
                defaultValue={bl.motherVessel}
                onBlur={(e) => setHeader("motherVessel")(e.target.value)}
              />
            </Field>
            <Field label="Feeder vessel">
              <TextInput
                key={`fv-${bl.id}`}
                defaultValue={bl.feederVessel}
                onBlur={(e) => setHeader("feederVessel")(e.target.value)}
              />
            </Field>
            <Field label="Feeder voyage">
              <TextInput
                key={`fvo-${bl.id}`}
                defaultValue={bl.feederVoyage}
                onBlur={(e) => setHeader("feederVoyage")(e.target.value)}
              />
            </Field>
            <CheckField
              label="Consolidated BL"
              checked={bl.consolidatedIndicator}
              onChange={(v) => setHeader("consolidatedIndicator")(v)}
            />

            <Field label="Gross weight">
              <TextInput
                type="number"
                key={`gw-${bl.id}`}
                defaultValue={bl.grossWt ?? ""}
                onBlur={(e) => setHeader("grossWt")(e.target.value)}
              />
            </Field>
            <Field label="Net weight">
              <TextInput
                type="number"
                key={`nw-${bl.id}`}
                defaultValue={bl.netWt ?? ""}
                onBlur={(e) => setHeader("netWt")(e.target.value)}
              />
            </Field>
            <Field label="Weight unit">
              <SelectInput
                value={bl.weightUnit || "KGS"}
                options={WEIGHT_UNITS}
                onChange={(e) => setHeader("weightUnit")(e.target.value)}
              />
            </Field>
            <div />

            <Field label="Packages">
              <TextInput
                type="number"
                key={`pkg-${bl.id}`}
                defaultValue={bl.packages ?? ""}
                onBlur={(e) => setHeader("packages")(e.target.value)}
              />
            </Field>
            <Field label="Package unit">
              <SelectInput
                value={bl.packageUnit || "PKG"}
                options={PACKAGE_UNITS}
                onChange={(e) => setHeader("packageUnit")(e.target.value)}
              />
            </Field>
            <CheckField
              label="Hazardous cargo"
              checked={bl.hazCargo}
              onChange={(v) => setHeader("hazCargo")(v)}
            />
            <div />

            {bl.hazCargo && (
              <>
                <Field label="UNO code" required>
                  <TextInput
                    key={`uno-${bl.id}`}
                    defaultValue={bl.unoCode}
                    onBlur={(e) => setHeader("unoCode")(e.target.value)}
                  />
                </Field>
                <Field label="IMO / IMDG class" required>
                  <SelectInput
                    value={bl.imoClass || ""}
                    allowBlank
                    options={IMDG_CLASSES}
                    onChange={(e) => setHeader("imoClass")(e.target.value)}
                  />
                </Field>
              </>
            )}
          </div>

          {warnings.length > 0 && (
            <div
              style={{
                marginTop: 14,
                background: "rgba(232,147,10,0.10)",
                border: `1px solid rgba(232,147,10,0.3)`,
                borderRadius: theme.radius.sm,
                padding: "10px 12px",
              }}
            >
              {warnings.map((w, i) => (
                <div key={i} style={{ ...mono(11, C.warning), lineHeight: 1.7 }}>
                  ⚠ {w}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── Parties ─────────────────────────────────────────────────────── */}
        <Section
          id="bl-parties"
          title="Parties"
          subtitle="Every role exists on the BL; blank roles are omitted from the export."
          state={sectionState.parties}
        >
          <PartyCards parties={bl.parties} onPatch={patchParty} isMobile={isMobile} />
        </Section>

        {/* ── Marks & description ─────────────────────────────────────────── */}
        <Section id="bl-marks" title="Marks & description" state={sectionState.marks}>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
            <Field label="Marks & numbers">
              <TextArea
                key={`marks-${bl.marks?.id}`}
                defaultValue={bl.marks?.marksText || ""}
                placeholder="As shown on the BL"
                onChange={(e) => setMarks("marksText")(e.target.value)}
              />
            </Field>
            <Field label="Goods description">
              <TextArea
                key={`desc-${bl.marks?.id}`}
                defaultValue={bl.marks?.descriptionText || ""}
                placeholder="Free-text description of goods"
                onChange={(e) => setMarks("descriptionText")(e.target.value)}
              />
            </Field>
          </div>
        </Section>

        {/* ── Cargo lines ─────────────────────────────────────────────────── */}
        <Section
          id="bl-cargo"
          title="Cargo lines"
          subtitle={
            totals.cargoPkgs
              ? `${totals.cargoPkgs} packages across ${totals.cargoLines} line${totals.cargoLines === 1 ? "" : "s"}`
              : "HSN-level commodity lines for this BL"
          }
          state={sectionState.cargo}
        >
          <CargoLinesGrid
            rows={bl.cargoLines}
            onPatch={patchCargoLine}
            onAdd={addCargoLine}
            onRemove={removeCargoLine}
            isMobile={isMobile}
          />
        </Section>

        {/* ── Containers ──────────────────────────────────────────────────── */}
        <Section
          id="bl-containers"
          title="Containers"
          subtitle={
            totals.containers
              ? `Gross ${totals.grossWt.toFixed(2)} · tare ${totals.tareWt.toFixed(2)} · VGM ${totals.vgm.toFixed(2)}`
              : "Boxes carried under this BL"
          }
          state={sectionState.containers}
        >
          <ContainerLinesGrid
            rows={bl.containers}
            onPatch={patchContainer}
            onAdd={addContainer}
            onRemove={removeContainer}
            isMobile={isMobile}
          />
        </Section>

        <button onClick={() => navigate("igm-voyage", { igmVoyageId })} style={secondaryBtn}>
          <ArrowLeft size={13} /> Back to voyage
        </button>
      </div>
    </div>
  );
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
