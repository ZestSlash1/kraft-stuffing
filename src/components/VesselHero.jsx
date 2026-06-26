import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { TOKENS, voyageStats } from "../data/statusHelpers";
import VesselIllustration from "./VesselIllustration";
import VoyageContainerSlots from "./VoyageContainerSlots";

const SCANLINE =
  "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.012) 1px, rgba(255,255,255,0.012) 2px)";

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

// Wave layer — two scrolling sinusoidal SVG paths pinned to the bottom.
function WaterAnimation({ waveRef }) {
  return (
    <div
      ref={waveRef}
      style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 60, zIndex: 3, pointerEvents: "none" }}
    >
      <svg className="vessel-wave vessel-wave--bg" viewBox="0 0 1440 60" preserveAspectRatio="none">
        <path d="M0,34 C220,16 420,54 640,34 S860,14 1440,34 L1440,60 L0,60 Z" fill="#060f1e" />
      </svg>
      <svg className="vessel-wave vessel-wave--fg" viewBox="0 0 1440 60" preserveAspectRatio="none">
        <path d="M0,30 C200,10 400,50 600,30 S800,10 1440,30 L1440,60 L0,60 Z" fill="#040c18" />
      </svg>
    </div>
  );
}

function Legend({ legendRef }) {
  const items = [
    ["Sealed", "#0b6b50", false],
    ["Stuffing", "#e8930a", false],
    ["Full", "#f59e0b", false],
    ["Empty", "#1c3050", true],
  ];
  return (
    <div
      ref={legendRef}
      style={{
        position: "absolute",
        bottom: 72,
        left: 20,
        display: "flex",
        gap: 16,
        zIndex: 6,
        pointerEvents: "none",
      }}
    >
      {items.map(([label, color, hollow]) => (
        <span
          key={label}
          style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: TOKENS.mono, fontSize: 9, color: TOKENS.steel }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: hollow ? "transparent" : color,
              border: hollow ? `1px solid ${color}` : "none",
            }}
          />
          {label}
        </span>
      ))}
    </div>
  );
}

export default function VesselHero({ voyage, onContainerClick }) {
  const rootRef = useRef(null);
  const bgRef = useRef(null);
  const svgWrapRef = useRef(null);
  const waveRef = useRef(null);
  const topLeftRef = useRef(null);
  const topRightRef = useRef(null);
  const legendRef = useRef(null);

  // LIVE indicator follows browser connectivity.
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
  const totalBags = stats.bags;
  const netMt = stats.mt;
  const allSealed = stats.total > 0 && stats.sealed === stats.total;

  // ETD within 48h → red.
  const etdSoon =
    voyage?.etd && new Date(voyage.etd).getTime() - Date.now() < 48 * 3600 * 1000;

  // ── GSAP entrance — "port display powering up" ──────────────────────────
  useLayoutEffect(() => {
    if (reduceMotion()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ delay: 0.1 });
      tl.fromTo(bgRef.current, { opacity: 0 }, { opacity: 1, duration: 0.4 }, 0);
      tl.fromTo(svgWrapRef.current, { x: 120, opacity: 0 }, { x: 0, opacity: 1, duration: 0.9, ease: "power3.out" }, 0.2);
      tl.fromTo(waveRef.current, { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0.6);
      tl.fromTo(topLeftRef.current, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.8);
      tl.fromTo(topRightRef.current, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4 }, 0.9);
      const slotEls = rootRef.current?.querySelectorAll(".vessel-slot");
      if (slotEls && slotEls.length) {
        tl.from(slotEls, { y: -30, opacity: 0, stagger: 0.06, duration: 0.5, ease: "bounce.out" }, 1.0);
      }
      tl.fromTo(legendRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 }, 1.4);
    }, rootRef);
    return () => ctx.revert();
  }, [voyage?.id]);

  const labelMono = { fontFamily: TOKENS.mono, fontSize: 10, color: TOKENS.steel };

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        width: "100%",
        minHeight: "48vh",
        maxHeight: "52vh",
        height: "50vh",
        overflow: "hidden",
      }}
    >
      {/* background gradient + scanline */}
      <div
        ref={bgRef}
        style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, #030508 0%, #060f1e 60%, #040c18 100%)",
          backgroundImage: SCANLINE,
          zIndex: 0,
        }}
      />

      {/* vessel illustration */}
      <div
        ref={svgWrapRef}
        style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}
      >
        <VesselIllustration style={{ width: "100%", height: "100%", maxWidth: 1100 }} />
      </div>

      {/* live container slots on the deck */}
      <VoyageContainerSlots containers={containers} onContainerClick={onContainerClick} />

      {/* water */}
      <WaterAnimation waveRef={waveRef} />

      {/* ── TOP LEFT: vessel + voyage info ── */}
      <div ref={topLeftRef} style={{ position: "absolute", top: 20, left: 20, zIndex: 6, pointerEvents: "none" }}>
        <div style={{ fontFamily: TOKENS.condensed, fontWeight: 800, fontSize: "clamp(18px,2.5vw,28px)", color: "#fff", lineHeight: 1.05 }}>
          {voyage?.vessel || "No active voyage"}
        </div>
        {voyage && (
          <>
            <div style={{ fontFamily: TOKENS.mono, fontSize: 11, color: TOKENS.amber, marginTop: 2 }}>
              {voyage.voyageNo || "—"}
            </div>
            <div style={{ ...labelMono, marginTop: 2 }}>
              {(voyage.pol || "Kolkata")} → {(voyage.pod || "Port Blair")}
            </div>
            <div style={{ ...labelMono, color: etdSoon ? TOKENS.red : TOKENS.steel, marginTop: 2 }}>
              ETD {fmtDate(voyage.etd)}
            </div>
          </>
        )}
      </div>

      {/* ── TOP RIGHT: container count ── */}
      <div ref={topRightRef} style={{ position: "absolute", top: 20, right: 20, textAlign: "right", zIndex: 6, pointerEvents: "none" }}>
        <div style={{ fontFamily: TOKENS.condensed, fontWeight: 800, fontSize: "clamp(28px,4vw,42px)", color: "#fff", lineHeight: 1 }}>
          {stats.sealed}/{stats.total}
        </div>
        <div style={{ fontFamily: TOKENS.mono, fontSize: 9, color: TOKENS.steel, letterSpacing: 1 }}>CONTAINERS</div>
        <div style={{ ...labelMono, marginTop: 2 }}>
          {totalBags} bags · {netMt.toFixed(1)} MT
        </div>
        {allSealed && (
          <div style={{ fontFamily: TOKENS.mono, fontSize: 9, color: TOKENS.green, marginTop: 4 }}>● READY TO SAIL</div>
        )}
      </div>

      {/* ── BOTTOM LEFT: legend ── */}
      <Legend legendRef={legendRef} />

      {/* ── BOTTOM RIGHT: live indicator ── */}
      <div
        style={{
          position: "absolute",
          bottom: 72,
          right: 20,
          fontFamily: TOKENS.mono,
          fontSize: 9,
          color: online ? TOKENS.green : TOKENS.steel,
          zIndex: 6,
          pointerEvents: "none",
        }}
      >
        {online ? "● LIVE" : "○ OFFLINE"}
      </div>
    </div>
  );
}
