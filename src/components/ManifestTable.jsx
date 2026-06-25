import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ChevronRight, Lock, Unlock } from "lucide-react";
import { TOKENS, containerStatus, CONTAINER_COLORS } from "../data/statusHelpers";
import CrossSectionFill from "./CrossSectionFill";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function ManifestTable({
  containers,
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
          .set(el, { outline: `2px solid ${TOKENS.green}`, boxShadow: `0 0 0 0px ${TOKENS.green}` })
          .to(el, { boxShadow: `0 0 0 6px rgba(11,107,80,0.25)`, duration: 0.25, ease: "power1.out" })
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

  return (
    <div className="manifest-table mono" style={{ color: "#e2e8f0" }}>
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
        const colors = CONTAINER_COLORS[status] || CONTAINER_COLORS.EMPTY;
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

            <span className="manifest-cell condensed" style={{ fontSize: 20, fontWeight: 800, color: TOKENS.steel }}>
              {String(i + 1).padStart(2, "0")}
            </span>

            <span className="manifest-cell condensed" style={{ fontSize: 22, fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
              <span className="manifest-cell-label label-xs">CONTAINER&nbsp;</span>
              {c.number || "Unassigned"}
              {c.sealed ? <Lock size={13} color={TOKENS.green} /> : <Unlock size={13} color={TOKENS.steel} />}
            </span>

            <span className="manifest-cell" style={{ fontSize: 12, color: TOKENS.steel }}>
              <span className="manifest-cell-label label-xs">CARGO&nbsp;</span>
              {cargoNames.length ? cargoNames.join(", ") : "—"}
            </span>

            <span className="manifest-cell" style={{ textAlign: "right", justifyContent: "flex-end", fontSize: 13 }}>
              <span className="manifest-cell-label label-xs">BAGS/UNIT&nbsp;</span>
              {bags}/{c.capacityBags}
            </span>

            <span className="manifest-cell" style={{ textAlign: "right", justifyContent: "flex-end", fontSize: 13 }}>
              <span className="manifest-cell-label label-xs">NET MT&nbsp;</span>
              {(kg / 1000).toFixed(2)}
            </span>

            <span className="manifest-cell">
              <span className="manifest-cell-label label-xs">STATUS&nbsp;</span>
              <span
                className="label-xs"
                style={{
                  color: colors.accent,
                  border: `1px solid ${colors.accent}`,
                  padding: "3px 8px",
                  letterSpacing: "0.12em",
                }}
              >
                {status}
              </span>
            </span>

            <span
              className="manifest-cell"
              style={{ justifyContent: "flex-end" }}
              onClick={(e) => {
                e.stopPropagation();
                onOpenLog(c.id);
              }}
            >
              <ChevronRight size={18} color={TOKENS.steel} />
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
