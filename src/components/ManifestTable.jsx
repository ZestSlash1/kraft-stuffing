import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ChevronRight, Lock, Unlock } from "lucide-react";
import { containerStatus } from "../data/statusHelpers";
import { theme } from "../theme";
import { glass } from "../ui/theme";
import { StatusBadge } from "./ui";
import CrossSectionFill from "./CrossSectionFill";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function ManifestSkeleton() {
  return (
    <div className="manifest-table">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 48, margin: "10px 16px" }}
        />
      ))}
    </div>
  );
}

export default function ManifestTable({
  containers,
  voyageNo,
  selectedContainerId,
  onSelectContainer,
  onOpenLog,
}) {
  const rowRefs = useRef(new Map());
  const sealedRef = useRef(new Map());
  const mountedRef = useRef(false);

  // Stagger-in once on first mount of the table (not on every data update).
  useEffect(() => {
    if (mountedRef.current || reducedMotion()) {
      mountedRef.current = true;
      return;
    }
    mountedRef.current = true;
    const els = containers.map((c) => rowRefs.current.get(c.id)).filter(Boolean);
    gsap.from(els, { opacity: 0, y: 8, duration: 0.35, stagger: 0.04, ease: "power2.out" });
  }, [containers]);

  // Seal confirmation: 3-step outline/boxShadow pulse on the row, fired once.
  useEffect(() => {
    if (reducedMotion()) return;
    containers.forEach((c) => {
      const wasSealed = sealedRef.current.get(c.id);
      const el = rowRefs.current.get(c.id);
      if (!wasSealed && c.sealed && el) {
        gsap
          .timeline()
          .set(el, { outline: `2px solid ${theme.color.green}`, boxShadow: `0 0 0 0px ${theme.color.green}` })
          .to(el, { boxShadow: `0 0 0 6px rgba(11,107,80,0.20)`, duration: 0.25, ease: "power1.out" })
          .to(el, { boxShadow: `0 0 0 0px rgba(11,107,80,0)`, duration: 0.4, ease: "power1.in" })
          .set(el, { outline: "none" });
      }
      sealedRef.current.set(c.id, c.sealed);
    });
  }, [containers]);

  const totals = containers.reduce(
    (acc, c) => {
      const bags = c.lines.reduce((a, l) => a + Number(l.qty || 0), 0);
      const kg = c.lines.reduce((a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0), 0);
      acc.bags += bags;
      acc.mt += kg / 1000;
      return acc;
    },
    { bags: 0, mt: 0 }
  );

  if (containers.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          minHeight: 280,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          textAlign: "center",
          padding: "0 20px",
        }}
      >
        <div className="condensed" style={{ fontSize: 32, fontWeight: 800, color: theme.color.slateFaint }}>
          NO CONTAINERS LOGGED
        </div>
        <div className="mono" style={{ fontSize: 12, color: theme.color.slate }}>
          Tap + to start logging for {voyageNo || "this voyage"}
        </div>
      </div>
    );
  }

  return (
    <div
      className="manifest-table light-manifest mono"
      style={{
        color: theme.color.ink,
        ...glass(theme.radius.card),
        boxShadow: theme.shadow.card,
        overflow: "hidden",
      }}
    >
      <div className="manifest-grid manifest-header label-xs">
        <span>FILL</span>
        <span>#</span>
        <span>CONTAINER</span>
        <span>CARGO</span>
        <span style={{ textAlign: "right" }}>BAGS/UNIT</span>
        <span style={{ textAlign: "right" }}>NET MT</span>
        <span>STATUS</span>
        <span />
      </div>

      {containers.map((c, i) => {
        const status = containerStatus(c);
        const bags = c.lines.reduce((a, l) => a + Number(l.qty || 0), 0);
        const kg = c.lines.reduce((a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0), 0);
        const cargoNames = [...new Set(c.lines.map((l) => l.cargo).filter(Boolean))];
        const selected = selectedContainerId === c.id;

        return (
          <div
            key={c.id}
            ref={(el) => {
              if (el) rowRefs.current.set(c.id, el);
              else rowRefs.current.delete(c.id);
            }}
            className="manifest-grid manifest-row"
            data-selected={selected}
            onClick={() => onSelectContainer(selected ? null : c.id)}
          >
            <span className="manifest-cell">
              <span className="manifest-cell-label label-xs">FILL&nbsp;</span>
              <CrossSectionFill container={c} />
            </span>

            <span className="manifest-cell condensed" style={{ fontSize: 20, fontWeight: 800, color: theme.color.slateFaint }}>
              {String(i + 1).padStart(2, "0")}
            </span>

            <span className="manifest-cell condensed" style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 8, color: theme.color.ink }}>
              <span className="manifest-cell-label label-xs">CONTAINER&nbsp;</span>
              {c.number || "Unassigned"}
              {c.sealed ? <Lock size={13} color={theme.color.green} /> : <Unlock size={13} color={theme.color.slateFaint} />}
            </span>

            <span className="manifest-cell" style={{ fontSize: 12, color: theme.color.slate }}>
              <span className="manifest-cell-label label-xs">CARGO&nbsp;</span>
              {cargoNames.length ? cargoNames.join(", ") : "—"}
            </span>

            <span className="manifest-cell" style={{ textAlign: "right", justifyContent: "flex-end", fontSize: 13, color: theme.color.inkSoft }}>
              <span className="manifest-cell-label label-xs">BAGS/UNIT&nbsp;</span>
              {bags}/{c.capacityBags}
            </span>

            <span className="manifest-cell" style={{ textAlign: "right", justifyContent: "flex-end", fontSize: 13, color: theme.color.inkSoft }}>
              <span className="manifest-cell-label label-xs">NET MT&nbsp;</span>
              {(kg / 1000).toFixed(2)}
            </span>

            <span className="manifest-cell">
              <span className="manifest-cell-label label-xs">STATUS&nbsp;</span>
              <StatusBadge status={status} size="sm" />
            </span>

            <span
              className="manifest-cell"
              style={{
                justifyContent: "flex-end",
                alignItems: "center",
                minHeight: 44,
                minWidth: 44,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenLog(c.id);
              }}
            >
              <ChevronRight size={18} color={theme.color.slateFaint} />
            </span>
          </div>
        );
      })}

      <div className="manifest-footer label-xs" style={{ display: "flex", gap: 10 }}>
        <span>VOYAGE TOTAL</span>
        <span>—</span>
        <span>{containers.length} containers</span>
        <span>—</span>
        <span>{totals.bags} bags</span>
        <span>—</span>
        <span>{totals.mt.toFixed(2)} MT</span>
      </div>
    </div>
  );
}
