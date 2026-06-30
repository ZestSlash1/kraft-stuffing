import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { AlertTriangle, Loader, Lock, CircleDot } from "lucide-react";
import { voyageStats, containerStatus, containerFillPct } from "../data/statusHelpers";
import DockScene from "./DockScene";

// Deep-teal "Dock Operations" viewport — a deliberately dark, cinematic hero
// embedded at the top of the (otherwise light) Dashboard.
const T = {
  g0: "#0b2422",
  g1: "#0e2e2a",
  g2: "#071d1b",
  glass: "rgba(255,255,255,0.05)",
  glassBorder: "rgba(255,255,255,0.10)",
  text: "#f3faf8",
  textDim: "rgba(226,244,240,0.62)",
  textFaint: "rgba(226,244,240,0.40)",
  amber: "#e8930a",
  green: "#34d399",
  sealed: "#2bbd8e",
  red: "#f06363",
};

const MONO = "var(--font-mono, 'JetBrains Mono', monospace)";
const COND = "var(--font-condensed, 'Barlow Condensed', sans-serif)";

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// containerStatus() → rail card presentation.
const STATUS_VIEW = {
  STUFFING: { label: "Loading", color: T.green, Icon: Loader, spin: true },
  FULL: { label: "Loaded", color: T.amber, Icon: CircleDot },
  OVER: { label: "Error", color: T.red, Icon: AlertTriangle },
  SEALED: { label: "Sealed", color: T.sealed, Icon: Lock },
  EMPTY: { label: "Queued", color: T.textFaint, Icon: CircleDot },
};

function VesselCard({ container, index, onClick }) {
  const status = containerStatus(container);
  const view = STATUS_VIEW[status] || STATUS_VIEW.EMPTY;
  const pct = Math.round(containerFillPct(container) * 100);
  const Icon = view.Icon;
  return (
    <button
      className="vessel-rail-card"
      onClick={() => onClick?.(container.id)}
      style={{
        textAlign: "left",
        background: T.glass,
        border: `1px solid ${T.glassBorder}`,
        borderRadius: 16,
        padding: "12px 14px",
        cursor: "pointer",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "block",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: COND, fontWeight: 700, fontSize: 18, color: T.text, letterSpacing: "0.02em" }}>
          {container.number || `SLOT-${String(index + 1).padStart(2, "0")}`}
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: MONO, fontSize: 11, color: view.color }}>
          <Icon size={12} className={view.spin ? "vessel-spin" : undefined} />
          {view.label}
        </span>
      </div>
      <div style={{ marginTop: 10, fontFamily: MONO, fontSize: 10, color: T.textDim }}>
        {status === "EMPTY" ? "Awaiting cargo" : `Progress: ${pct}%`}
      </div>
      <div style={{ marginTop: 6, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: view.color, borderRadius: 3 }} />
      </div>
    </button>
  );
}

function WaterAnimation({ waveRef }) {
  return (
    <div
      ref={waveRef}
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 60, zIndex: 3, pointerEvents: "none" }}
    >
      <svg className="vessel-wave vessel-wave--bg" viewBox="0 0 1440 60" preserveAspectRatio="none">
        <path d="M0,34 C220,16 420,54 640,34 S860,14 1440,34 L1440,60 L0,60 Z" fill="#0a2724" />
      </svg>
      <svg className="vessel-wave vessel-wave--fg" viewBox="0 0 1440 60" preserveAspectRatio="none">
        <path d="M0,30 C200,10 400,50 600,30 S800,10 1440,30 L1440,60 L0,60 Z" fill="#061a18" />
      </svg>
    </div>
  );
}

function lastUpdate() {
  return "just now";
}

export default function VesselHero({ voyage, onContainerClick }) {
  const rootRef = useRef(null);
  const bgRef = useRef(null);
  const svgWrapRef = useRef(null);
  const waveRef = useRef(null);
  const railRef = useRef(null);
  const titleRef = useRef(null);

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
  const railContainers = containers.slice(0, 3);

  // Transform-only entrance with clearProps — background and text are always
  // visible, so an interrupted tween (e.g. StrictMode double-mount) can never
  // leave anything stuck invisible.
  useLayoutEffect(() => {
    if (reduceMotion()) return;
    const ctx = gsap.context(() => {
      // transform-only — never touch opacity/visibility, so an interrupted
      // tween can't leave anything hidden.
      gsap.from(svgWrapRef.current, { x: 90, duration: 0.8, ease: "power3.out", clearProps: "transform" });
      const cards = railRef.current?.querySelectorAll(".vessel-rail-card");
      if (cards?.length) gsap.from(cards, { x: -22, stagger: 0.08, duration: 0.45, delay: 0.3, ease: "power2.out", clearProps: "transform" });
      const slotEls = rootRef.current?.querySelectorAll(".vessel-slot");
      if (slotEls?.length) gsap.from(slotEls, { y: -22, stagger: 0.05, duration: 0.45, delay: 0.5, ease: "back.out(2)", clearProps: "transform" });
    }, rootRef);
    return () => ctx.revert();
  }, [voyage?.id]);

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "48vh",
        height: "52vh",
        maxHeight: 620,
        overflow: "hidden",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* teal background */}
      <div
        ref={bgRef}
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(120% 90% at 70% 20%, ${T.g1} 0%, ${T.g0} 45%, ${T.g2} 100%)`,
          zIndex: 0,
        }}
      />

      {/* dock scene — data-driven stacked container bays */}
      <div
        ref={svgWrapRef}
        style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 2, paddingBottom: 24 }}
      >
        <DockScene containers={containers} onContainerClick={onContainerClick} style={{ width: "100%", height: "100%", maxWidth: 1180 }} />
      </div>

      {/* water */}
      <WaterAnimation waveRef={waveRef} />

      {/* ── Title + status ── */}
      <div ref={titleRef} style={{ position: "absolute", top: 24, left: 24, zIndex: 6, maxWidth: "60%" }}>
        <div style={{ fontFamily: COND, fontWeight: 800, fontSize: "clamp(30px,5vw,52px)", color: T.text, lineHeight: 0.98, letterSpacing: "-0.01em" }}>
          Dock<br />Operations
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: T.textDim, marginTop: 8 }}>
          {voyage ? `${voyage.vessel} · ${voyage.voyageNo}` : "No active voyage"}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 10, color: T.textFaint, marginTop: 2 }}>
          Last update {lastUpdate()} · {online ? "● live" : "○ offline"}
        </div>
      </div>

      {/* ── Alert chip ── */}
      <div style={{ position: "absolute", top: 24, right: 24, zIndex: 6, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
        {overCount > 0 ? (
          <span style={chipStyle(T.red)}>
            <AlertTriangle size={13} /> Cargo loading error
          </span>
        ) : allSealed ? (
          <span style={chipStyle(T.sealed)}>
            <Lock size={13} /> Ready to sail
          </span>
        ) : (
          <span style={chipStyle(T.green)}>
            <Loader size={13} className="vessel-spin" /> Stuffing in progress
          </span>
        )}
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: COND, fontWeight: 800, fontSize: "clamp(28px,4vw,44px)", color: T.text, lineHeight: 1 }}>
            {stats.sealed}/{stats.total}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: T.textFaint, letterSpacing: "0.14em" }}>CONTAINERS SEALED</div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: T.textDim, marginTop: 3 }}>
            {stats.bags} bags · {stats.mt.toFixed(1)} MT
          </div>
        </div>
      </div>

      {/* ── Left rail: vessel/container cards ── */}
      <div
        ref={railRef}
        style={{
          position: "absolute",
          top: "clamp(150px, 26vh, 230px)",
          left: 24,
          width: 220,
          maxWidth: "44%",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          zIndex: 6,
        }}
      >
        {railContainers.map((c, i) => (
          <VesselCard key={c.id} container={c} index={i} onClick={onContainerClick} />
        ))}
      </div>
    </div>
  );
}

function chipStyle(color) {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${color}55`,
    color,
    borderRadius: 999,
    padding: "7px 13px",
    fontFamily: MONO,
    fontSize: 11,
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    whiteSpace: "nowrap",
  };
}
