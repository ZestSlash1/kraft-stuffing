import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { AlertTriangle, Loader, Lock } from "lucide-react";
import { voyageStats, containerStatus } from "../data/statusHelpers";
import DockScene from "../components/DockScene";
import { C, GLOW, R, F, glass, label, num, reduceMotion } from "./theme";

// ─────────────────────────────────────────────────────────────────────────────
// BayHero — Loadex hero centerpiece for the dark dashboard (LOADEX §7).
// Wraps the existing data-driven DockScene (status-coloured bays, click →
// container log) in a glass panel with a soft radial light, a slow GSAP scan
// line, and a floating alert chip. Read-only: reflects existing voyage state,
// reuses the existing container select handler, no fetches, no writes.
// ─────────────────────────────────────────────────────────────────────────────

export default function BayHero({ voyage, onContainerClick }) {
  const rootRef = useRef(null);
  const sceneRef = useRef(null);
  const scanRef = useRef(null);

  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
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

  const containers = voyage?.containers || [];
  const stats = voyageStats(voyage);
  const allSealed = stats.total > 0 && stats.sealed === stats.total;
  const overCount = containers.filter((c) => containerStatus(c) === "OVER").length;

  // Scan line sweep + slow float on the scene layer. Transform-only (never
  // opacity/visibility) so an interrupted tween can't leave anything hidden;
  // skipped entirely under prefers-reduced-motion.
  useLayoutEffect(() => {
    if (reduceMotion()) return;
    const ctx = gsap.context(() => {
      if (scanRef.current) {
        // Animate transform (compositor-only) rather than `top` — animating a
        // layout property here forced a full layout + repaint of the ~700-node
        // dock SVG every frame. Sweep is expressed in px from the panel height.
        const h = rootRef.current?.offsetHeight || 420;
        gsap.fromTo(
          scanRef.current,
          { y: 0 },
          { y: h * 0.66, duration: 7, ease: "sine.inOut", repeat: -1, yoyo: true }
        );
      }
      if (sceneRef.current) {
        gsap.to(sceneRef.current, { y: -6, duration: 4.5, ease: "sine.inOut", repeat: -1, yoyo: true });
      }
    }, rootRef);
    return () => ctx.revert();
  }, [voyage?.id]);

  const chip = overCount > 0
    ? { color: C.critical, glow: GLOW.critical, Icon: AlertTriangle, text: "Cargo loading error", pulse: true }
    : allSealed
      ? { color: C.optimized, glow: GLOW.optimized, Icon: Lock, text: "Ready to sail" }
      : { color: C.minor, glow: GLOW.minor, Icon: Loader, text: "Stuffing in progress", spin: true };
  const ChipIcon = chip.Icon;

  return (
    <div
      ref={rootRef}
      className="ldx-panel"
      style={{
        ...glass(R.panel),
        position: "relative",
        overflow: "hidden",
        minHeight: 420,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* soft radial light behind the scene */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(60% 55% at 50% 42%, rgba(18,184,134,0.08) 0%, rgba(18,184,134,0) 70%)",
          pointerEvents: "none",
        }}
      />

      {/* title */}
      <div style={{ position: "absolute", top: 20, left: 22, zIndex: 6, maxWidth: "58%" }}>
        <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: "clamp(26px,3.2vw,40px)", color: C.ink, lineHeight: 0.98, letterSpacing: "-0.01em" }}>
          Dock<br />Operations
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkDim, marginTop: 8 }}>
          {voyage ? `${voyage.vessel} · ${voyage.voyageNo}` : "No active voyage"}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkDim, marginTop: 2 }}>
          {online ? "● live" : "○ offline"}
        </div>
      </div>

      {/* alert chip + sealed headline */}
      <div style={{ position: "absolute", top: 20, right: 22, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
        <span
          className={chip.pulse ? "ldx-pulse" : undefined}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: "rgba(255,255,255,0.06)",
            border: `1px solid ${chip.color}66`,
            color: chip.color,
            borderRadius: R.pill,
            padding: "8px 14px",
            fontFamily: F.mono,
            fontSize: 11,
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            boxShadow: chip.glow,
            whiteSpace: "nowrap",
          }}
        >
          <ChipIcon size={13} className={chip.spin ? "vessel-spin" : undefined} /> {chip.text}
        </span>
        <div style={{ textAlign: "right" }}>
          <div style={{ ...num(40), fontWeight: 300 }}>
            {stats.sealed}/{stats.total}
          </div>
          <div style={{ ...label(), color: C.inkDim, marginTop: 5 }}>Containers Sealed</div>
          <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkDim, marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            {stats.bags} bags · {stats.mt.toFixed(1)} MT
          </div>
        </div>
      </div>

      {/* dock scene — data-driven, clickable bays */}
      <div ref={sceneRef} style={{ flex: 1, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 2, padding: "88px 8px 4px" }}>
        <DockScene containers={containers} onContainerClick={onContainerClick} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* scan line */}
      <div
        ref={scanRef}
        className="ldx-scan"
        style={{
          position: "absolute",
          left: "4%",
          right: "4%",
          top: "18%",
          height: 1,
          background: `linear-gradient(90deg, transparent, ${C.optimized}55 30%, ${C.optimized}88 50%, ${C.optimized}55 70%, transparent)`,
          zIndex: 4,
          pointerEvents: "none",
          willChange: "transform",
        }}
      />
    </div>
  );
}
