import { useRef, useEffect, useState } from "react";
import { gsap } from "gsap";
import { containerStatus, containerFillPct, formatIST } from "../data/statusHelpers";
import { theme } from "../theme";
import { fetchAuditLog, fromDbAuditEntry } from "../lib/db";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function diffFields(oldData, newData) {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const out = [];
  for (const k of keys) {
    const before = oldData[k];
    const after = newData[k];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      out.push([k, before ?? "—", after ?? "—"]);
    }
  }
  return out;
}

function AuditTab({ container, profilesById }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    if (!container) return;
    const rowIds = [container.id, ...container.lines.map((l) => l.id)];
    let cancelled = false;
    fetchAuditLog(rowIds).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.warn("[audit] fetch failed:", error.message);
        setEntries([]);
        return;
      }
      setEntries((data || []).map(fromDbAuditEntry));
    });
    return () => {
      cancelled = true;
    };
  }, [container?.id]);

  if (entries === null) return <div className="label-xs">loading…</div>;
  if (entries.length === 0) return <div className="label-xs">No audit entries yet.</div>;

  return (
    <div>
      {entries.map((e) => {
        const who = (profilesById && profilesById[e.changedBy]) || e.changedBy?.slice(0, 8) || "—";
        const diffs = e.action === "UPDATE" ? diffFields(e.oldData, e.newData) : [];
        return (
          <div
            key={e.id}
            style={{ padding: "10px 0", borderBottom: `1px solid ${theme.color.border}` }}
          >
            <div style={{ fontSize: 12 }}>
              {e.action} by {who} — {formatIST(e.changedAt)}
            </div>
            {diffs.length > 0 && (
              <div style={{ marginLeft: 14, marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                {diffs.map(([k, before, after]) => (
                  <span key={k} style={{ fontSize: 11, color: theme.color.slate }}>
                    {k}: {String(before)} → {String(after)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ContainerInfoOverlay({ container, onClose, onSelectLine, profilesById }) {
  const ref = useRef();
  const [tab, setTab] = useState("entries");

  useEffect(() => {
    if (!ref.current) return;
    if (reducedMotion()) return;
    gsap.fromTo(
      ref.current,
      { y: 60, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" }
    );
  }, [container?.id]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setTab("entries");
  }, [container?.id]);

  if (!container) return null;

  const status = containerStatus(container);
  const fillPct = Math.round(containerFillPct(container) * 100);
  const totalBags = container.lines.reduce((a, l) => a + Number(l.qty || 0), 0);
  const totalKg = container.lines.reduce(
    (a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0),
    0
  );
  const grossKg = totalKg + Number(container.tareWeightKg || 0);

  const dataGrid = [
    ["SEAL NO", container.sealNo || "—"],
    ["CONDITION", container.condition || "Clean"],
    ["TARE", container.tareWeightKg ? `${container.tareWeightKg} kg` : "—"],
    ["VGM", `${(grossKg / 1000).toFixed(2)} MT`],
    ["NET WT", `${(totalKg / 1000).toFixed(2)} MT`],
    ["GROSS WT", `${(grossKg / 1000).toFixed(2)} MT`],
    ["CML", container.cmlKg ? `${(container.cmlKg / 1000).toFixed(2)} MT` : "—"],
    ["STATUS", status],
  ];

  return (
    <div
      ref={ref}
      className="mono"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        background: theme.color.surface,
        borderTop: `1px solid ${theme.color.border}`,
        boxShadow: "0 -8px 30px rgba(16,24,40,.10)",
        color: theme.color.ink,
        maxHeight: "55%",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          height: 48,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 20px",
          borderBottom: `1px solid ${theme.color.border}`,
          flexShrink: 0,
        }}
      >
        <div className="condensed" style={{ fontSize: 22, fontWeight: 800 }}>
          {container.number || "Unassigned"}{" "}
          <span className="label-xs" style={{ fontWeight: 400 }}>
            · {container.size}ft · {fillPct}% FULL · {totalBags}/{container.capacityBags}
          </span>
        </div>
        <button
          onClick={onClose}
          className="mono label-xs"
          style={{
            background: "none",
            border: `1px solid ${theme.color.border}`,
            color: theme.color.slate,
            borderRadius: 0,
            padding: "5px 12px",
            minWidth: 44,
            minHeight: 44,
            cursor: "pointer",
          }}
        >
          close
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px 24px",
          padding: "16px 20px",
          borderBottom: `1px solid ${theme.color.border}`,
        }}
      >
        {dataGrid.map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="label-xs">{label}</span>
            <span style={{ fontSize: 13, color: theme.color.ink }}>{value}</span>
          </div>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: 18,
          padding: "10px 20px 0",
          borderBottom: `1px solid ${theme.color.border}`,
        }}
      >
        {["entries", "audit"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="mono"
            style={{
              background: "none",
              border: "none",
              color: tab === t ? theme.color.ink : theme.color.slate,
              fontFamily: theme.font.condensed,
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              padding: "0 0 10px",
              minHeight: 44,
              cursor: "pointer",
              borderBottom: tab === t ? `2px solid ${theme.color.amber}` : "2px solid transparent",
            }}
          >
            {t === "entries" ? "Entries" : "Audit"}
          </button>
        ))}
      </div>

      <div style={{ padding: "12px 20px" }}>
        {tab === "audit" ? (
          <AuditTab container={container} profilesById={profilesById} />
        ) : (
          <>
            {container.lines.length === 0 && (
              <div className="label-xs">No lines yet.</div>
            )}
            {container.lines.map((l) => (
              <div
                key={l.id}
                onClick={() => onSelectLine && onSelectLine(l.id)}
                style={{
                  padding: "10px 0",
                  minHeight: 44,
                  borderBottom: `1px solid ${theme.color.border}`,
                  cursor: onSelectLine ? "pointer" : "default",
                }}
              >
                <div style={{ fontSize: 13 }}>
                  <span style={{ fontWeight: 600 }}>{l.cargo}</span>
                  {" — "}
                  {l.qty} {l.unit || "Bags"}
                  {" — "}
                  <span style={{ color: theme.color.slate }}>{l.truckNo || "—"}</span>
                </div>
                <div style={{ marginLeft: 14, marginTop: 2, fontSize: 11, color: theme.color.slate }}>
                  {l.shipper} → {l.consignee}
                </div>
                {(l.invoiceNos?.length > 0 || l.hsCode) && (
                  <div style={{ marginLeft: 14, marginTop: 1, fontSize: 11, color: theme.color.slate }}>
                    {l.invoiceNos?.length > 0 && `inv: ${l.invoiceNos.join(", ")}`}
                    {l.invoiceNos?.length > 0 && l.hsCode && " — "}
                    {l.hsCode && `HS: ${l.hsCode}`}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
