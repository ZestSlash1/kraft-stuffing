import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { fetchActivityPage } from "../lib/db";
import { theme } from "../theme";
import { formatRelative } from "../lib/format";
import { useRouter } from "../context/RouterContext";
import {
  formatActivity,
  TABLE_SECTION,
  SECTION_FILTERS,
} from "../lib/activity/format";

// ─────────────────────────────────────────────────────────────────────────────
// ActivityFeedView — "what changed" timeline over audit_log. Full-page section
// (filters + keyset pagination + live prepend) plus a compact <ActivityPanel>
// reused on the Stuffing Dashboard.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE = 30;
const CAP = 200; // in-memory ceiling so a long-lived tab can't grow unbounded

const PERIODS = [
  { id: "all", label: "All Time" },
  { id: "this-month", label: "This Month" },
  { id: "last-month", label: "Last Month" },
];

// Convert a period id into a changed_at {from, to} ISO range (local-month based).
function periodRange(period) {
  if (period === "all") return { from: null, to: null };
  const now = new Date();
  const startOfMonth = (offset) =>
    new Date(now.getFullYear(), now.getMonth() + offset, 1);
  if (period === "this-month")
    return { from: startOfMonth(0).toISOString(), to: null };
  return {
    from: startOfMonth(-1).toISOString(),
    to: startOfMonth(0).toISOString(),
  };
}

// Build the lookup context the humanizer needs from app state.
function useActivityCtx(app) {
  return useMemo(() => {
    const containersById = {};
    const voyagesById = {};
    for (const v of app?.state?.voyages || []) {
      voyagesById[v.id] = v;
      for (const c of v.containers || []) containersById[c.id] = c;
    }
    return { profilesById: app?.profilesById || {}, containersById, voyagesById };
  }, [app?.state?.voyages, app?.profilesById]);
}

// Does an audit row pass the active filters? Used to gate live-prepended rows.
function matchesFilters(row, { section, userId, period }) {
  if (section && TABLE_SECTION[row.table_name] !== section) return false;
  if (userId && row.changed_by !== userId) return false;
  const { from, to } = periodRange(period);
  if (from && row.changed_at < from) return false;
  if (to && row.changed_at >= to) return false;
  return true;
}

function ActivityRow({ entry, ctx, onNavigate, dense }) {
  const f = formatActivity(entry, ctx);
  if (!f) return null;
  const { Icon, text, tone, route } = f;
  const iconColor =
    tone === "green" ? theme.color.green : theme.color.amber;
  return (
    <button
      onClick={() => route && onNavigate(route.page, route.params || {})}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        textAlign: "left",
        background: "none",
        border: "none",
        borderBottom: `1px solid ${theme.color.border}`,
        padding: dense ? "9px 0" : "12px 4px",
        cursor: route ? "pointer" : "default",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = theme.color.surfaceMuted)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
    >
      <span
        style={{
          flexShrink: 0,
          width: 30,
          height: 30,
          borderRadius: 8,
          background: theme.color.surfaceMuted,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={15} color={iconColor} />
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontFamily: theme.font.mono,
          fontSize: dense ? 12 : 13,
          color: theme.color.inkSoft,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </span>
      <span
        style={{
          flexShrink: 0,
          fontFamily: theme.font.mono,
          fontSize: 10,
          color: theme.color.slate,
        }}
      >
        {formatRelative(entry.changed_at)}
      </span>
    </button>
  );
}

// ── Compact 5-row panel for the Dashboard ─────────────────────────────────────
export function ActivityPanel({ app, limit = 5 }) {
  const { navigate } = useRouter();
  const ctx = useActivityCtx(app);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchActivityPage({ limit }).then(({ data }) => alive && setRows(data));
    const ch = supabase
      .channel("activity-panel")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log" },
        (p) => alive && setRows((r) => [p.new, ...r].slice(0, limit))
      )
      .subscribe();
    return () => {
      alive = false;
      supabase.removeChannel(ch);
    };
  }, [limit]);

  return (
    <div>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}
      >
        <div className="label-xs">RECENT ACTIVITY</div>
        <button
          onClick={() => navigate("activity")}
          style={{
            background: "none",
            border: "none",
            color: theme.color.amberText,
            fontFamily: theme.font.mono,
            fontSize: 10,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          View all →
        </button>
      </div>
      {rows.length === 0 ? (
        <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>
          No activity yet.
        </div>
      ) : (
        rows.map((e) => (
          <ActivityRow key={e.id} entry={e} ctx={ctx} onNavigate={navigate} dense />
        ))
      )}
    </div>
  );
}

// ── Full-page section ─────────────────────────────────────────────────────────
export default function ActivityFeedView({ app }) {
  const { navigate } = useRouter();
  const ctx = useActivityCtx(app);
  const profiles = app?.state?.profiles || [];

  const [section, setSection] = useState(null);
  const [userId, setUserId] = useState(null);
  const [period, setPeriod] = useState("all");

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState(false);
  const filtersRef = useRef({ section, userId, period });
  filtersRef.current = { section, userId, period };

  // Reload from scratch whenever a filter changes.
  const reload = useCallback(async () => {
    setLoading(true);
    setDone(false);
    const { from, to } = periodRange(period);
    const { data } = await fetchActivityPage({
      tables: section
        ? Object.keys(TABLE_SECTION).filter((t) => TABLE_SECTION[t] === section)
        : null,
      changedBy: userId,
      from,
      to,
      limit: PAGE,
    });
    setRows(data);
    setDone(data.length < PAGE);
    setLoading(false);
  }, [section, userId, period]);

  useEffect(() => {
    reload();
  }, [reload]);

  const loadMore = async () => {
    const cursor = rows[rows.length - 1]?.changed_at;
    if (!cursor) return;
    const { from, to } = periodRange(period);
    const { data } = await fetchActivityPage({
      cursor,
      tables: section
        ? Object.keys(TABLE_SECTION).filter((t) => TABLE_SECTION[t] === section)
        : null,
      changedBy: userId,
      from,
      to,
      limit: PAGE,
    });
    setRows((r) => [...r, ...data]);
    if (data.length < PAGE) setDone(true);
  };

  // Live prepend — respect the active filters, cap the in-memory list.
  useEffect(() => {
    const ch = supabase
      .channel("activity-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "audit_log" },
        (p) => {
          if (!matchesFilters(p.new, filtersRef.current)) return;
          setRows((r) =>
            r.some((x) => x.id === p.new.id) ? r : [p.new, ...r].slice(0, CAP)
          );
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  return (
    <div style={{ minHeight: "100%", background: theme.color.canvas, color: theme.color.ink }}>
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "24px 20px 60px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: theme.font.condensed,
              fontWeight: 800,
              fontSize: 34,
              letterSpacing: "0.02em",
              lineHeight: 1,
            }}
          >
            ACTIVITY
          </div>
          <div
            style={{
              marginTop: 4,
              fontFamily: theme.font.mono,
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: theme.color.slate,
            }}
          >
            What changed across the corridor
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <Chip label="All" active={!section} onClick={() => setSection(null)} />
          {SECTION_FILTERS.map((s) => (
            <Chip
              key={s.id}
              label={s.label}
              active={section === s.id}
              onClick={() => setSection((cur) => (cur === s.id ? null : s.id))}
            />
          ))}
          <span
            style={{ width: 1, alignSelf: "stretch", background: theme.color.border, margin: "0 4px" }}
          />
          {PERIODS.map((p) => (
            <Chip
              key={p.id}
              label={p.label}
              active={period === p.id}
              onClick={() => setPeriod(p.id)}
            />
          ))}
          <select
            value={userId || ""}
            onChange={(e) => setUserId(e.target.value || null)}
            style={{
              marginLeft: "auto",
              background: theme.color.surface,
              border: `1px solid ${theme.color.border}`,
              borderRadius: theme.radius.pill,
              color: theme.color.inkSoft,
              fontFamily: theme.font.mono,
              fontSize: 11,
              padding: "7px 12px",
              cursor: "pointer",
            }}
          >
            <option value="">All users</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.displayName || p.id}
              </option>
            ))}
          </select>
        </div>

        {/* Feed */}
        <div
          style={{
            background: theme.color.surface,
            border: `1px solid ${theme.color.border}`,
            borderRadius: theme.radius.card,
            boxShadow: theme.shadow.card,
            padding: "6px 16px",
          }}
        >
          {loading && rows.length === 0 ? (
            <div style={{ padding: "24px 0", fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: "24px 0", fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>
              No activity matches these filters.
            </div>
          ) : (
            rows.map((e) => (
              <ActivityRow key={e.id} entry={e} ctx={ctx} onNavigate={navigate} />
            ))
          )}
        </div>

        {!done && rows.length > 0 && (
          <button
            onClick={loadMore}
            style={{
              alignSelf: "center",
              background: "none",
              border: `1px solid ${theme.color.borderStrong}`,
              borderRadius: theme.radius.pill,
              color: theme.color.inkSoft,
              fontFamily: theme.font.condensed,
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              padding: "9px 22px",
              cursor: "pointer",
            }}
          >
            Load more
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? theme.color.amberSoft : theme.color.surface,
        border: `1px solid ${active ? theme.color.amber : theme.color.border}`,
        color: active ? theme.color.amberText : theme.color.inkSoft,
        borderRadius: theme.radius.pill,
        padding: "7px 14px",
        fontFamily: theme.font.mono,
        fontSize: 11,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
