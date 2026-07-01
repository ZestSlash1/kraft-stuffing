import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ChevronLeft, Lock } from "lucide-react";
import { Card, Input, Pill, StatusBadge, SpecLabel } from "../components/ui";
import { theme } from "../theme";
import AddForm from "../components/AddForm";
import LineCard from "../components/LineCard";
import SealConfirmDialog from "../components/SealConfirmDialog";
import { useToast } from "../components/Toast";
import { containerStatus, containerFillPct } from "../data/statusHelpers";
import { recordEntityVisit } from "../lib/recentEntities";

// ─────────────────────────────────────────────────────────────────────────────
// ContainerLogView — light anchor, now fully functional. Layout:
//   • container number hero + dimension / tare / VGM / CML spec labels
//   • editable details (number, tare, CML, condition, seals) + seal flow
//   • centred container placeholder (real render lands later)
//   • the logging form + cargo-line list
//   • a horizontal strip of the other containers in the same voyage
// ─────────────────────────────────────────────────────────────────────────────

const DIMS = {
  "20": "20′ GP · 5.90 × 2.35 × 2.39 m",
  "40": "40′ GP · 12.03 × 2.35 × 2.39 m",
  "40HC": "40′ HC · 12.03 × 2.35 × 2.70 m",
};
const DEFAULT_CML = { "20": 28000, "40": 30480, "40HC": 30480 };

const netKg = (c) =>
  (c.lines || []).reduce((a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0), 0);

const fmtKg = (n) => new Intl.NumberFormat("en-IN").format(Math.round(n));

const sectionLabel = {
  fontFamily: theme.font.mono,
  fontSize: 10,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: theme.color.slate,
  marginBottom: 10,
};

export default function ContainerLogView({ app, containerId }) {
  const {
    state,
    navigate,
    user,
    trackPresence,
    patchContainer,
    addLine,
    deleteLine,
    sealContainer,
    createShipperEntry,
    createConsigneeEntry,
  } = app;
  const { showToast } = useToast();

  const [sealing, setSealing] = useState(false);
  const [numberWarning, setNumberWarning] = useState(false);
  const bagCountRef = useRef();
  const prevBagsRef = useRef(null);

  const voyage = state.voyages.find((v) => v.containers.some((c) => c.id === containerId));
  const container = voyage?.containers.find((c) => c.id === containerId);

  const shipperName = (id) => state.shippers.find((s) => s.id === id)?.name || "";
  const consigneeName = (id) => state.consignees.find((c) => c.id === id)?.name || "";
  const bookings = (voyage?.bookings || []).map((b) => ({
    ...b,
    shipperName: shipperName(b.shipperId),
    consigneeName: consigneeName(b.consigneeId),
  }));

  useEffect(() => {
    if (container)
      recordEntityVisit({ type: "container", id: container.id, label: container.number || "Container" });
  }, [container?.id]);

  // Presence: tell other users which container this user is logging.
  useEffect(() => {
    if (!container || !trackPresence) return;
    trackPresence({
      userId: user?.id,
      displayName: user?.email || "staff",
      containerId: container.id,
    });
  }, [container?.id, trackPresence, user]);

  const totalBags = container?.lines.reduce((a, l) => a + Number(l.qty || 0), 0) || 0;

  // Pulse the bag-count readout whenever a line is added.
  useEffect(() => {
    if (
      prevBagsRef.current !== null &&
      totalBags !== prevBagsRef.current &&
      bagCountRef.current &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      gsap.fromTo(
        bagCountRef.current,
        { y: -8, opacity: 0.4 },
        { y: 0, opacity: 1, duration: 0.4, ease: "back.out(2)" }
      );
    }
    prevBagsRef.current = totalBags;
  }, [totalBags]);

  if (!container) {
    return (
      <div
        style={{
          minHeight: "100%",
          background: theme.color.canvas,
          padding: 40,
          fontFamily: theme.font.mono,
          color: theme.color.slate,
        }}
      >
        Container not found.{" "}
        <button
          onClick={() => navigate("voyages")}
          style={{ color: theme.color.amber, background: "none", border: "none", cursor: "pointer" }}
        >
          ← Back
        </button>
      </div>
    );
  }

  const status = containerStatus(container);
  const fillPct = Math.round(containerFillPct(container) * 100);
  const size = container.size || "20";

  const net = netKg(container);
  const tare = container.tareWeightKg;
  const cml = container.cmlKg || DEFAULT_CML[size] || 28000;
  const vgm = tare != null ? net + Number(tare) : null;
  const vgmOver = vgm != null && vgm > cml;

  const confirmSeal = ({ sealNo, sealNo2 }) => {
    sealContainer(container.id, { sealNo, sealNo2 });
    setSealing(false);
    showToast(`Container ${container.number || ""} sealed`, "success");
  };

  const crumb = {
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.color.slate,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
  };

  return (
    <div
      style={{
        minHeight: "100%",
        background: theme.color.canvas,
        color: theme.color.ink,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Breadcrumb */}
      <div style={{ padding: "16px 28px 0", display: "flex", alignItems: "center", gap: 6 }}>
        <button onClick={() => navigate("voyages")} style={crumb}>
          Voyages
        </button>
        <span style={{ color: theme.color.slateFaint }}>/</span>
        <button onClick={() => navigate("voyage-detail", { voyageId: voyage.id })} style={crumb}>
          {voyage.voyageNo}
        </button>
        <span style={{ color: theme.color.slateFaint }}>/</span>
        <span style={{ ...crumb, color: theme.color.inkSoft, cursor: "default" }}>
          {container.number || "CONTAINER"}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          maxWidth: 1040,
          width: "100%",
          margin: "0 auto",
          padding: "20px 28px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <Card style={{ padding: "28px 32px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: 16,
            }}
          >
            <div>
              <button
                onClick={() => navigate("voyage-detail", { voyageId: voyage.id })}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  marginBottom: 8,
                  fontFamily: theme.font.mono,
                  fontSize: 11,
                  color: theme.color.slate,
                }}
              >
                <ChevronLeft size={13} /> back to voyage
              </button>
              <div
                style={{
                  fontFamily: theme.font.condensed,
                  fontWeight: 300,
                  fontSize: "clamp(48px, 9vw, 92px)",
                  lineHeight: 0.95,
                  letterSpacing: "0.01em",
                  color: theme.color.ink,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                {container.number || "UNNUMBERED"}
                {container.sealed && <Lock size={28} color={theme.color.green} />}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontFamily: theme.font.body,
                  fontStyle: "italic",
                  fontSize: 13,
                  color: theme.color.slate,
                }}
              >
                {DIMS[size] || `${size}′ container`}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 12 }}>
              <StatusBadge status={status} label={`${status} · ${fillPct}%`} />
              <span ref={bagCountRef} style={{ fontFamily: theme.font.mono, fontSize: 13, color: theme.color.inkSoft }}>
                {totalBags}/{container.capacityBags} {container.capacityUnit || "Bags"}
              </span>
              <Pill
                value={container.condition || "Clean"}
                options={["Clean", "Damaged", "Fumigated"]}
                onChange={(e) => patchContainer(container.id, { condition: e.target.value })}
              />
            </div>
          </div>

          {/* Quiet spec labels */}
          <div
            style={{
              marginTop: 26,
              paddingTop: 22,
              borderTop: `1px solid ${theme.color.border}`,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: 22,
            }}
          >
            <SpecLabel label="Net cargo" value={fmtKg(net)} unit="kg" />
            <SpecLabel label="Tare" value={tare != null ? fmtKg(tare) : "—"} unit={tare != null ? "kg" : ""} />
            <SpecLabel
              label="VGM"
              value={vgm != null ? fmtKg(vgm) : "—"}
              unit={vgm != null ? "kg" : ""}
              tone={vgm == null ? undefined : vgmOver ? "over" : "ok"}
            />
            <SpecLabel label="CML" value={fmtKg(cml)} unit="kg" />
          </div>
          {vgmOver && (
            <div style={{ marginTop: 14, fontFamily: theme.font.mono, fontSize: 11, color: theme.color.red }}>
              ⚠ VGM exceeds CML by {fmtKg(vgm - cml)} kg
            </div>
          )}
        </Card>

        {/* ── Editable details + seal ───────────────────────────────────── */}
        <Card style={{ padding: "20px 24px" }}>
          <div style={sectionLabel}>Container details</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
            <Input
              label="container number"
              value={container.number}
              onChange={(e) => patchContainer(container.id, { number: e.target.value.toUpperCase() })}
              onBlur={(e) => setNumberWarning(!!e.target.value && !/^[A-Z]{4}[0-9]{7}$/.test(e.target.value))}
              invalid={numberWarning}
              hint={numberWarning ? "Format should be XXXX0000000 — check before sealing" : undefined}
              style={{ width: 170 }}
            />
            <Input
              label="tare (kg)"
              type="number"
              value={container.tareWeightKg ?? ""}
              onChange={(e) => patchContainer(container.id, { tareWeightKg: Number(e.target.value) })}
              style={{ width: 110 }}
            />
            <Input
              label="CML (kg)"
              type="number"
              value={container.cmlKg ?? ""}
              onChange={(e) => patchContainer(container.id, { cmlKg: Number(e.target.value) })}
              style={{ width: 110 }}
            />
            <Input
              label="seal no"
              value={container.sealNo || ""}
              onChange={(e) => patchContainer(container.id, { sealNo: e.target.value })}
              disabled={container.sealed}
              style={{ width: 120 }}
            />
            <Input
              label="seal 2"
              value={container.sealNo2 || ""}
              onChange={(e) => patchContainer(container.id, { sealNo2: e.target.value })}
              disabled={container.sealed}
              style={{ width: 120 }}
            />
            <div style={{ marginLeft: "auto" }}>
              {container.sealed ? (
                <StatusBadge status="SEALED" />
              ) : (
                <button
                  onClick={() => setSealing(true)}
                  style={{
                    background: theme.color.green,
                    color: theme.color.white,
                    border: "none",
                    borderRadius: theme.radius.input,
                    padding: "10px 18px",
                    minHeight: 44,
                    fontFamily: theme.font.condensed,
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    cursor: "pointer",
                  }}
                >
                  Mark sealed
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* ── Centred container placeholder ─────────────────────────────── */}
        <Card
          inset
          style={{ padding: "40px 24px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}
        >
          <ContainerPlaceholder fillPct={fillPct} status={status} />
          <span
            style={{
              fontFamily: theme.font.mono,
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: theme.color.slateFaint,
            }}
          >
            Container render — coming soon
          </span>
        </Card>

        {/* ── Logging form + lines ──────────────────────────────────────── */}
        <div>
          <div style={sectionLabel}>Stuffing log</div>
          <AddForm
            onAddLine={(line) => {
              addLine(container.id, line);
              showToast("Line added", "success");
            }}
            shippers={state.shippers}
            consignees={state.consignees}
            bookings={bookings}
            onCreateShipper={createShipperEntry}
            onCreateConsignee={createConsigneeEntry}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {container.lines.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "24px 0",
                  fontFamily: theme.font.mono,
                  fontSize: 12,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: theme.color.slateFaint,
                }}
              >
                Nothing logged yet — start entering cargo above
              </div>
            ) : (
              container.lines.map((l) => (
                <LineCard key={l.id} line={l} onDelete={(id) => deleteLine(container.id, id)} />
              ))
            )}
          </div>
        </div>

        {/* ── Sibling strip ─────────────────────────────────────────────── */}
        <div>
          <div style={sectionLabel}>Containers on {voyage.voyageNo}</div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
            {voyage.containers.map((c) => {
              const active = c.id === container.id;
              const cs = containerStatus(c);
              const cf = Math.round(containerFillPct(c) * 100);
              return (
                <button
                  key={c.id}
                  onClick={() => !active && navigate("container-log", { containerId: c.id })}
                  style={{
                    flex: "0 0 auto",
                    width: 176,
                    textAlign: "left",
                    background: theme.color.surface,
                    border: `1px solid ${active ? theme.color.amber : theme.color.border}`,
                    boxShadow: active ? `0 0 0 3px ${theme.color.amber}22` : theme.shadow.card,
                    borderRadius: theme.radius.card,
                    padding: "14px 16px",
                    cursor: active ? "default" : "pointer",
                  }}
                >
                  <div
                    style={{
                      fontFamily: theme.font.condensed,
                      fontWeight: 500,
                      fontSize: 22,
                      lineHeight: 1,
                      color: theme.color.ink,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {c.number || "—"}
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <StatusBadge status={cs} label={`${cs} · ${cf}%`} size="sm" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {sealing && (
        <SealConfirmDialog
          containerNumber={container.number}
          onConfirm={confirmSeal}
          onCancel={() => setSealing(false)}
        />
      )}
    </div>
  );
}

// Lightweight top-down container silhouette with a fill bar — stands in until
// the real cross-section render is built.
function ContainerPlaceholder({ fillPct, status }) {
  const tone = theme.status[status] || theme.status.EMPTY;
  const W = 300;
  const H = 150;
  const pad = 10;
  const innerW = W - pad * 2;
  const fillW = (innerW * Math.min(100, fillPct)) / 100;

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Container ${fillPct}% full`}>
      <rect x="2" y="2" width={W - 4} height={H - 4} rx="14" fill={theme.color.surface} stroke={theme.color.borderStrong} strokeWidth="2" />
      <rect x={pad} y={pad} width={fillW} height={H - pad * 2} rx="8" fill={tone.fill} />
      {Array.from({ length: 11 }).map((_, i) => (
        <line
          key={i}
          x1={pad + ((i + 1) * innerW) / 12}
          y1={pad}
          x2={pad + ((i + 1) * innerW) / 12}
          y2={H - pad}
          stroke={theme.color.border}
          strokeWidth="1"
        />
      ))}
      <rect x={pad} y={pad} width={innerW} height={H - pad * 2} rx="8" fill="none" stroke={tone.dot} strokeWidth="1.5" opacity="0.5" />
      <text
        x={W / 2}
        y={H / 2 + 5}
        textAnchor="middle"
        fontFamily="var(--font-condensed, sans-serif)"
        fontWeight="500"
        fontSize="34"
        fill={theme.color.inkSoft}
      >
        {fillPct}%
      </text>
    </svg>
  );
}
