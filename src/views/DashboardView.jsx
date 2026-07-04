import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Ship, ChevronRight, ChevronDown, AlertTriangle, Loader, Lock, CircleDot } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  greeting,
  CARGO_COLORS,
  containerStatus,
  containerFillPct,
  voyageStats,
} from "../data/statusHelpers";
import { C, GLOW, R, SP, F, WASH, glass, label, num, statusColor, SEV, reduceMotion } from "../ui/theme";
import BayHero from "../ui/BayHero";
import { ActivityPanel } from "./ActivityFeedView";
import { useLive } from "../context/LiveContext";
import { fetchDocuments } from "../lib/documents";

// ─────────────────────────────────────────────────────────────────────────────
// DashboardView — Loadex dark-marine composition (LOADEX_UI_PASS.md).
// Presentational relayout only: every derived value shown by the previous
// light layout is still shown, restyled. No new queries, writes, or handlers.
// ─────────────────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Section label — spec label() bumped to inkDim for 4.5:1 contrast on glass.
const lbl = () => ({ ...label(), color: C.inkDim });

// GSAP count-up from 0 → value on mount.
function CountUp({ value, decimals = 0 }) {
  const ref = useRef(null);
  useEffect(() => {
    const obj = { n: 0 };
    const t = gsap.to(obj, {
      n: value,
      duration: 1.2,
      ease: "power2.out",
      onUpdate: () => {
        if (ref.current) ref.current.textContent = obj.n.toFixed(decimals);
      },
    });
    return () => t.kill();
  }, [value, decimals]);
  return <span ref={ref}>0</span>;
}

// ── Action Required strip ────────────────────────────────────────────────────
// Attention items surfaced in the monitor rail. VGM + Interakt-notify items are
// omitted: neither has a stored field to query (no vgm column, no notify flag).
const AR_COLLAPSED_KEY = "kraft-action-required-collapsed";

function ActionRequiredStrip({ navigate }) {
  const { mailUnread } = useLive();
  const [staleDrafts, setStaleDrafts] = useState(0);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(AR_COLLAPSED_KEY) === "1"
  );

  useEffect(() => {
    let alive = true;
    fetchDocuments({ status: "draft" }).then(({ data, error }) => {
      if (!alive || error) return;
      const cutoff = Date.now() - 24 * 3600 * 1000;
      setStaleDrafts(
        (data || []).filter((d) => d.createdAt && new Date(d.createdAt).getTime() < cutoff).length
      );
    });
    return () => {
      alive = false;
    };
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      localStorage.setItem(AR_COLLAPSED_KEY, c ? "0" : "1");
      return !c;
    });
  };

  const items = [
    mailUnread > 0 && {
      key: "mail",
      count: mailUnread,
      label: `unread mail message${mailUnread === 1 ? "" : "s"}`,
      go: () => navigate("mail"),
    },
    staleDrafts > 0 && {
      key: "drafts",
      count: staleDrafts,
      label: `draft document${staleDrafts === 1 ? "" : "s"} older than 24h`,
      go: () => navigate("documents", { status: "draft" }),
    },
  ].filter(Boolean);

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    background: "none",
    border: "none",
    padding: "8px 0",
    cursor: "pointer",
    fontFamily: F.mono,
    fontSize: 12,
    color: C.ink,
    textAlign: "left",
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${C.hair}`,
        borderLeft: `3px solid ${C.dockAmber}`,
        borderRadius: R.chip,
        padding: "8px 14px",
      }}
    >
      <button onClick={toggle} style={{ ...rowStyle, padding: "2px 0" }}>
        {collapsed ? <ChevronRight size={14} color={C.inkDim} /> : <ChevronDown size={14} color={C.inkDim} />}
        <span style={{ ...lbl(), flex: 1 }}>ACTION REQUIRED</span>
        {collapsed && items.length > 0 && (
          <span style={{ fontFamily: F.mono, fontSize: 11, color: C.dockAmber, fontVariantNumeric: "tabular-nums" }}>
            {items.reduce((a, i) => a + i.count, 0)}
          </span>
        )}
      </button>
      {!collapsed &&
        (items.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0 4px", fontFamily: F.mono, fontSize: 12, color: C.inkDim }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.optimized }} />
            All clear
          </div>
        ) : (
          items.map((it) => (
            <button key={it.key} onClick={it.go} style={rowStyle}>
              <span style={{ fontFamily: F.head, fontWeight: 800, fontSize: 18, color: C.dockAmber, minWidth: 24, fontVariantNumeric: "tabular-nums" }}>
                {it.count}
              </span>
              <span style={{ flex: 1 }}>{it.label}</span>
              <ChevronRight size={14} color={C.inkDim} />
            </button>
          ))
        ))}
    </div>
  );
}

// ── Left rail: vessel/container status card ─────────────────────────────────
const STATUS_VIEW = {
  STUFFING: { text: "Loading", Icon: Loader, spin: true },
  FULL: { text: "Loaded", Icon: CircleDot },
  OVER: { text: "Error", Icon: AlertTriangle },
  SEALED: { text: "Sealed", Icon: Lock },
  EMPTY: { text: "Queued", Icon: CircleDot },
};

function RailCard({ container, index, onClick }) {
  const status = containerStatus(container);
  const view = STATUS_VIEW[status] || STATUS_VIEW.EMPTY;
  const sev = SEV[status];
  const color = sev === "neutral" ? C.inkDim : statusColor(sev);
  const pct = Math.round(containerFillPct(container) * 100);
  const bags = (container.lines || []).reduce((a, l) => a + Number(l.qty || 0), 0);
  const mt = (container.lines || []).reduce((a, l) => a + (Number(l.qty || 0) * Number(l.unitWeightKg || 0)) / 1000, 0);
  const Icon = view.Icon;
  return (
    <button
      className="ldx-panel ldx-card"
      onClick={() => onClick?.(container.id)}
      style={{ ...glass(R.card), textAlign: "left", padding: "12px 14px", cursor: "pointer", width: "100%", display: "block", minHeight: 44 }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0 }}>
          <Ship size={13} color={C.inkDim} style={{ flexShrink: 0 }} />
          <span style={{ fontFamily: F.head, fontWeight: 700, fontSize: 17, color: C.ink, letterSpacing: "0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {container.number || `SLOT-${String(index + 1).padStart(2, "0")}`}
          </span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: F.mono, fontSize: 10.5, color, flexShrink: 0 }}>
          <Icon size={12} className={view.spin ? "vessel-spin" : undefined} />
          {view.text}
        </span>
      </div>
      <div style={{ marginTop: 9, fontFamily: F.mono, fontSize: 10, color: C.inkDim, fontVariantNumeric: "tabular-nums" }}>
        {status === "EMPTY" ? "Awaiting cargo" : `${pct}% · ${bags} bags · ${mt.toFixed(1)} MT`}
      </div>
      <div style={{ marginTop: 6, height: 3, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3, boxShadow: sev === "critical" ? GLOW.critical : "none" }} />
      </div>
    </button>
  );
}

// ── Bottom strip: arc gauge ──────────────────────────────────────────────────
function ArcGauge({ pct }) {
  const arcLen = Math.PI * 64;
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ position: "relative", width: 168, margin: "14px auto 0" }}>
      <svg viewBox="0 0 168 96" width="168" height="96" role="img" aria-label={`Average utilization ${clamped}%`}>
        <path d="M 20 88 A 64 64 0 0 1 148 88" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 20 88 A 64 64 0 0 1 148 88"
          fill="none"
          stroke={C.dockAmber}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * arcLen} ${arcLen}`}
        />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 4, textAlign: "center" }}>
        <span style={num(30)}>
          <CountUp value={clamped} />
        </span>
        <span style={{ ...num(14), color: C.inkDim }}>%</span>
      </div>
    </div>
  );
}

// ── Right rail: legend chips for the monitor panel ──────────────────────────
const LEGEND = [
  ["Critical", "critical"],
  ["Warning", "warning"],
  ["Minor", "minor"],
  ["Optimized", "optimized"],
];

export default function DashboardView({ app }) {
  const { state, profile, navigate } = app;

  const voyages = state.voyages.filter((v) => !v.archived);
  const now = new Date();

  // ── Aggregate cargo metrics across the tree ───────────────────────────────
  const allLines = [];
  for (const v of state.voyages) for (const c of v.containers) for (const l of c.lines || []) allLines.push(l);

  const istToday = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const bagsToday = allLines
    .filter((l) => l.loggedAt && new Date(l.loggedAt).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) === istToday)
    .reduce((a, l) => a + Number(l.qty || 0), 0);

  const mtThisMonth = allLines
    .filter((l) => {
      if (!l.loggedAt) return false;
      const d = new Date(l.loggedAt);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    })
    .reduce((a, l) => a + (Number(l.qty || 0) * Number(l.unitWeightKg || 0)) / 1000, 0);

  const activeVoyages = voyages.filter((v) => v.status === "LOADING" || v.status === "DRAFT").length;
  const containersLoading = voyages
    .filter((v) => v.status === "LOADING" || v.status === "DRAFT")
    .reduce((a, v) => a + v.containers.filter((c) => !c.sealed).length, 0);

  const hasData = allLines.length > 0;

  // ── Monthly cargo (last 6 months) ─────────────────────────────────────────
  const monthBuckets = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthBuckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: MONTHS[d.getMonth()], MT: 0 });
  }
  const bucketByKey = Object.fromEntries(monthBuckets.map((b) => [b.key, b]));
  for (const l of allLines) {
    if (!l.loggedAt) continue;
    const d = new Date(l.loggedAt);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (bucketByKey[key]) bucketByKey[key].MT += (Number(l.qty || 0) * Number(l.unitWeightKg || 0)) / 1000;
  }
  const monthlyData = monthBuckets.map((b) => ({ ...b, MT: Number(b.MT.toFixed(1)) }));

  // ── Cargo breakdown (bags per type, last 6 months) ────────────────────────
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const cargoMap = {};
  for (const l of allLines) {
    if (l.loggedAt && new Date(l.loggedAt) < sixMonthsAgo) continue;
    cargoMap[l.cargo] = (cargoMap[l.cargo] || 0) + Number(l.qty || 0);
  }
  const cargoData = Object.entries(cargoMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const cargoTotal = cargoData.reduce((a, c) => a + c.value, 0) || 1;

  // ── Active voyage widget ──────────────────────────────────────────────────
  const activeVoyage = voyages.find((v) => v.status === "LOADING") || voyages[0];

  // ── All-time quick stats ──────────────────────────────────────────────────
  let totalMt = 0;
  let utilSum = 0;
  let utilCount = 0;
  for (const v of state.voyages) {
    for (const c of v.containers) {
      const bags = (c.lines || []).reduce((a, l) => a + Number(l.qty || 0), 0);
      totalMt += (c.lines || []).reduce((a, l) => a + (Number(l.qty || 0) * Number(l.unitWeightKg || 0)) / 1000, 0);
      if (c.capacityBags > 0) {
        utilSum += Math.min(1, bags / c.capacityBags);
        utilCount += 1;
      }
    }
  }
  const avgUtil = utilCount > 0 ? Math.round((utilSum / utilCount) * 100) : 0;

  // Over-capacity containers across active voyages — display-only issues list
  // for the monitor rail (pure derived state, no fetch, no persistence).
  const overContainers = [];
  for (const v of voyages) for (const c of v.containers) if (containerStatus(c) === "OVER") overContainers.push(c);

  const greetName = (profile?.displayName || "there").toUpperCase();
  const railContainers = (activeVoyage?.containers || []).slice(0, 4);
  const vStats = voyageStats(activeVoyage);

  // Entrance: panels rise 16px with a 0.06 stagger, once on mount. Transform-only
  // (never opacity) so an interrupted tween can't leave a panel invisible.
  const rootRef = useRef(null);
  useLayoutEffect(() => {
    if (reduceMotion()) return;
    const ctx = gsap.context(() => {
      const panels = rootRef.current?.querySelectorAll(".ldx-panel");
      if (panels?.length) gsap.from(panels, { y: 16, stagger: 0.06, duration: 0.6, ease: "power3.out", clearProps: "transform" });
    }, rootRef);
    return () => ctx.revert();
  }, []);

  const tooltipStyle = {
    background: C.surface,
    border: `1px solid ${C.border}`,
    fontFamily: F.mono,
    fontSize: 11,
    color: C.ink,
  };

  const issueRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    background: "none",
    border: "none",
    padding: "8px 0",
    cursor: "pointer",
    fontFamily: F.mono,
    fontSize: 12,
    color: C.ink,
    textAlign: "left",
  };

  return (
    <div ref={rootRef} style={{ width: "100%", minHeight: "100%", background: WASH, color: C.ink }}>
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "28px 24px 64px" }}>
        {/* ── Header row ── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: SP.lg, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 28, color: C.ink, letterSpacing: "0.01em" }}>
              GOOD {greeting()}, {greetName}
            </div>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkDim, marginTop: 2 }}>
              {new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(now)}
            </div>
          </div>
          {activeVoyage && (
            <button
              className="ldx-card"
              onClick={() => navigate("voyage-detail", { voyageId: activeVoyage.id })}
              style={{
                background: "rgba(232,147,10,0.10)",
                border: `1px solid ${C.dockAmber}66`,
                color: C.dockAmber,
                fontFamily: F.head,
                fontWeight: 700,
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                padding: "11px 18px",
                borderRadius: R.pill,
                cursor: "pointer",
              }}
            >
              Open Voyage →
            </button>
          )}
        </div>

        {/* ── Main grid: left rail · hero · right rail ── */}
        <div className="ldx-main">
          {/* Left rail — vessel status */}
          <div style={{ display: "flex", flexDirection: "column", gap: SP.md, minWidth: 0 }}>
            <div style={lbl()}>Vessel Status</div>
            <div className="ldx-panel" style={{ ...glass(R.card), padding: "14px 16px" }}>
              {[
                ["Active Voyages", activeVoyages, "voyages in progress", !hasData && activeVoyages === 0],
                ["Containers Loading", containersLoading, "pending seal", !hasData && containersLoading === 0],
              ].map(([title, value, sub, empty], i) => (
                <div key={title} style={{ paddingTop: i ? SP.md : 0, marginTop: i ? SP.md : 0, borderTop: i ? `1px solid ${C.hair}` : "none" }}>
                  <div style={lbl()}>{title}</div>
                  <div style={{ ...num(30), fontWeight: 300, marginTop: 8 }}>{empty ? "—" : <CountUp value={value} />}</div>
                  <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkDim, marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </div>
            {railContainers.map((c, i) => (
              <RailCard key={c.id} container={c} index={i} onClick={(containerId) => navigate("container-log", { containerId })} />
            ))}
          </div>

          {/* Hero centerpiece */}
          <div className="ldx-hero" style={{ minWidth: 0 }}>
            <BayHero voyage={activeVoyage} onContainerClick={(containerId) => navigate("container-log", { containerId })} />
          </div>

          {/* Right rail — stow monitor */}
          <div style={{ minWidth: 0 }}>
            <div className="ldx-panel" style={{ ...glass(R.panel), padding: "16px 18px", display: "flex", flexDirection: "column", gap: SP.lg }}>
              <div style={lbl()}>Stow Monitor</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {LEGEND.map(([text, sev]) => (
                  <span
                    key={sev}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      background: "rgba(255,255,255,0.04)",
                      border: `1px solid ${C.hair}`,
                      borderRadius: R.pill,
                      padding: "4px 9px",
                      fontFamily: F.mono,
                      fontSize: 9,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: C.inkDim,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor(sev) }} />
                    {text}
                  </span>
                ))}
              </div>

              <ActionRequiredStrip navigate={navigate} />

              {overContainers.length > 0 && (
                <div>
                  <div style={lbl()}>Over Capacity</div>
                  {overContainers.slice(0, 5).map((c) => (
                    <button key={c.id} onClick={() => navigate("container-log", { containerId: c.id })} style={issueRowStyle}>
                      <AlertTriangle size={13} color={C.critical} style={{ flexShrink: 0 }} />
                      <span style={{ flex: 1 }}>{c.number || "Container"} over capacity</span>
                      <ChevronRight size={13} color={C.inkDim} />
                    </button>
                  ))}
                </div>
              )}

              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: `1px solid ${C.hair}`,
                  borderRadius: R.chip,
                  padding: "10px 12px",
                  fontFamily: F.mono,
                  fontSize: 11,
                  color: C.inkDim,
                  lineHeight: 1.6,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {activeVoyage
                  ? `${activeVoyage.vessel} · ${activeVoyage.voyageNo} — ${vStats.bags} bags, ${vStats.mt.toFixed(1)} MT across ${vStats.total} containers; ${vStats.sealed} sealed.`
                  : "No active voyage."}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom strip: gauge · throughput · cargo mix ── */}
        <div className="ldx-bottom">
          <div className="ldx-panel" style={{ ...glass(R.card), padding: "16px 18px" }}>
            <div style={lbl()}>Load Balance — Avg Utilization</div>
            <ArcGauge pct={avgUtil} />
            <div style={{ marginTop: SP.lg, borderTop: `1px solid ${C.hair}`, paddingTop: SP.md, display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Total Voyages", state.voyages.length],
                ["Total MT Shipped", totalMt.toFixed(1)],
              ].map(([title, value]) => (
                <div key={title} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 10, color: C.inkDim, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
                  <span style={num(18)}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ldx-panel" style={{ ...glass(R.card), padding: "16px 18px" }}>
            <div style={lbl()}>Loading Throughput</div>
            <div style={{ display: "flex", gap: SP.xxl, marginTop: SP.md, flexWrap: "wrap" }}>
              <div>
                <div style={{ ...num(34), fontWeight: 300 }}>{hasData ? <CountUp value={mtThisMonth} decimals={1} /> : "—"}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkDim, marginTop: 4 }}>net MT this month</div>
              </div>
              <div>
                <div style={{ ...num(34), fontWeight: 300 }}>{hasData ? <CountUp value={bagsToday} /> : "—"}</div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkDim, marginTop: 4 }}>bags stuffed today</div>
              </div>
            </div>
            {hasData && (
              <div style={{ marginTop: SP.md }}>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={monthlyData} margin={{ top: 4, right: 0, left: -24, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="month" stroke={C.inkFaint} tick={{ fontSize: 10, fontFamily: "monospace", fill: C.inkDim }} axisLine={false} tickLine={false} />
                    <YAxis stroke={C.inkFaint} tick={{ fontSize: 10, fontFamily: "monospace", fill: C.inkDim }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: "rgba(232,147,10,0.08)" }}
                      formatter={(val) => [`${val} MT`, "MT"]}
                    />
                    <Bar dataKey="MT" fill={C.dockAmber} radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="ldx-panel" style={{ ...glass(R.card), padding: "16px 18px", minWidth: 0 }}>
            <div style={lbl()}>Cargo Mix — Last 6 Months</div>
            {hasData && cargoData.length > 0 ? (
              <div style={{ display: "flex", gap: SP.md, marginTop: SP.md, overflowX: "auto", paddingBottom: 4 }}>
                {cargoData.map((entry) => (
                  <div
                    key={entry.name}
                    style={{
                      position: "relative",
                      flex: "0 0 auto",
                      minWidth: 130,
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${C.hair}`,
                      borderRadius: R.chip,
                      padding: "10px 12px 10px 16px",
                      overflow: "hidden",
                    }}
                  >
                    <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: CARGO_COLORS[entry.name] || CARGO_COLORS.default }} />
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkDim, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                      {entry.name}
                    </div>
                    <div style={{ ...num(26), fontWeight: 300, marginTop: 7 }}>{entry.value.toLocaleString("en-IN")}</div>
                    <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkDim, marginTop: 4 }}>
                      {Math.round((entry.value / cargoTotal) * 100)}% of volume
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontFamily: F.mono, fontSize: 11, color: C.inkDim, marginTop: SP.md }}>No cargo logged yet.</div>
            )}
          </div>
        </div>

        {/* ── Recent activity ── */}
        <div className="ldx-panel" style={{ ...glass(R.panel), padding: "18px 20px", marginTop: SP.xl }}>
          <ActivityPanel app={app} dark />
        </div>
      </div>

      {/* Grid stacking, hover lift, and critical pulse — media-query behaviour
          inline styles can't express (same pattern as TopNav's keyframes). */}
      <style>{`
        .ldx-main { display: grid; grid-template-columns: minmax(0,3fr) minmax(0,6fr) minmax(0,3fr); gap: 24px; margin-top: 24px; align-items: start; }
        .ldx-bottom { display: grid; grid-template-columns: minmax(0,3fr) minmax(0,4fr) minmax(0,5fr); gap: 24px; margin-top: 24px; align-items: start; }
        .ldx-card { transition: transform .25s ease, border-color .25s ease; }
        .ldx-card:hover { transform: translateY(-3px); border-color: rgba(18,184,134,0.35); }
        .ldx-card:focus-visible { outline: 2px solid ${C.dockAmber}; outline-offset: 2px; }
        .ldx-pulse { animation: ldxPulse 2.4s ease-in-out infinite; }
        @keyframes ldxPulse { 0%, 100% { opacity: 1; } 50% { opacity: .6; } }
        @media (max-width: 1100px) {
          .ldx-main { grid-template-columns: 1fr; }
          .ldx-hero { order: -1; }
          .ldx-bottom { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .ldx-hero .ldx-panel { min-height: 300px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ldx-card, .ldx-card:hover { transition: none; transform: none; }
          .ldx-pulse { animation: none; }
          .ldx-scan { display: none; }
        }
      `}</style>
    </div>
  );
}
