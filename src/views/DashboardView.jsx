import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Ship, Box, Package, Weight } from "lucide-react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  greeting,
  timeAgo,
  CARGO_COLORS,
} from "../data/statusHelpers";
import { theme } from "../theme";
import { fetchRecentActivity } from "../lib/db";
import VesselHero from "../components/VesselHero";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

function StatCard({ label, value, sub, decimals, Icon, empty }) {
  return (
    <div style={{ background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: 12, padding: "16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="label-xs">{label}</div>
        <Icon size={18} color={theme.color.amber} />
      </div>
      <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 40, color: theme.color.ink, lineHeight: 1.1, marginTop: 6 }}>
        {empty ? "—" : <CountUp value={value} decimals={decimals} />}
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 10, color: theme.color.slate, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function chartTitle(t) {
  return <div className="label-xs" style={{ marginBottom: 10 }}>{t}</div>;
}

export default function DashboardView({ app }) {
  const { state, profile, navigate, profilesById } = app;
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    fetchRecentActivity(12).then(({ data }) => setActivity(data || []));
  }, []);

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

  const greetName = (profile?.displayName || "there").toUpperCase();

  const tooltipStyle = {
    background: theme.color.surface,
    border: `1px solid ${theme.color.border}`,
    fontFamily: theme.font.mono,
    fontSize: 11,
    color: theme.color.ink,
  };

  return (
    <div style={{ width: "100%", minHeight: "100%", background: theme.color.canvas, color: theme.color.ink }}>
      {/* ── Vessel hero — port operations display ── */}
      <VesselHero
        voyage={activeVoyage}
        onContainerClick={(containerId) => navigate("container-log", { containerId })}
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 20px 50px" }}>
        <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 28, color: theme.color.ink }}>
          GOOD {greeting()}, {greetName}
        </div>
        <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, marginTop: 2 }}>
          {new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(now)}
        </div>

      {/* Stat cards */}
      <div className="stat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 18 }}>
        <StatCard label="Active Voyages" value={activeVoyages} sub="voyages in progress" Icon={Ship} empty={!hasData && activeVoyages === 0} />
        <StatCard label="Containers Loading" value={containersLoading} sub="pending seal" Icon={Box} empty={!hasData && containersLoading === 0} />
        <StatCard label="Bags Today" value={bagsToday} sub="bags stuffed today" Icon={Package} empty={!hasData} />
        <StatCard label="Net MT This Month" value={mtThisMonth} decimals={1} sub="metric tonnes" Icon={Weight} empty={!hasData} />
      </div>

      {/* Open active voyage */}
      {activeVoyage && (
        <div style={{ marginTop: 18, display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={() => navigate("voyage-detail", { voyageId: activeVoyage.id })}
            style={{
              background: "none",
              border: `1px solid ${theme.color.amber}`,
              color: theme.color.amber,
              fontFamily: theme.font.condensed,
              fontWeight: 700,
              fontSize: 14,
              textTransform: "uppercase",
              padding: "10px 16px",
              cursor: "pointer",
            }}
          >
            Open Voyage →
          </button>
        </div>
      )}

      {/* Charts */}
      {hasData && (
        <div className="chart-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 18 }}>
          <div style={{ background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: 12, padding: 16 }}>
            {chartTitle("MONTHLY CARGO (MT)")}
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid stroke={theme.color.border} vertical={false} />
                <XAxis dataKey="month" stroke={theme.color.slate} tick={{ fontSize: 11, fontFamily: "monospace", fill: theme.color.slate }} />
                <YAxis stroke={theme.color.slate} tick={{ fontSize: 11, fontFamily: "monospace", fill: theme.color.slate }} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "rgba(232,147,10,0.08)" }}
                  formatter={(val) => [`${val} MT`, "MT"]}
                />
                <Bar dataKey="MT" fill={theme.color.amber} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: 12, padding: 16 }}>
            {chartTitle("CARGO BREAKDOWN")}
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={cargoData} dataKey="value" nameKey="name" innerRadius="40%" outerRadius="80%" stroke="none">
                  {cargoData.map((entry) => (
                    <Cell key={entry.name} fill={CARGO_COLORS[entry.name] || CARGO_COLORS.default} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: 8 }}>
              {cargoData.map((c) => (
                <span key={c.name} style={{ fontFamily: theme.font.mono, fontSize: 10, color: theme.color.slate, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 8, height: 8, background: CARGO_COLORS[c.name] || CARGO_COLORS.default, display: "inline-block" }} />
                  {c.name} {Math.round((c.value / cargoTotal) * 100)}%
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent activity */}
      <div style={{ marginTop: 22 }}>
        <div className="label-xs" style={{ marginBottom: 10 }}>RECENT ACTIVITY</div>
        {activity.length === 0 ? (
          <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>No activity yet.</div>
        ) : (
          activity.map((e) => {
            const who = profilesById[e.changed_by] || "Someone";
            const detail = e.new_data?.voyage_no || e.new_data?.number || e.new_data?.cargo || e.table_name;
            return (
              <div key={e.id} style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.inkSoft, padding: "9px 0", borderBottom: `1px solid ${theme.color.border}` }}>
                {who} {e.action?.toLowerCase()} {e.table_name} — {detail} — <span style={{ color: theme.color.slate }}>{timeAgo(e.changed_at)}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Quick stats */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 40, marginTop: 26 }}>
        {[
          ["AVG CONTAINER UTILIZATION", `${avgUtil}%`],
          ["TOTAL VOYAGES", state.voyages.length],
          ["TOTAL MT SHIPPED", totalMt.toFixed(1)],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="label-xs">{label}</div>
            <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 28, color: theme.color.ink }}>{value}</div>
          </div>
        ))}
      </div>
      </div>
    </div>
  );
}
